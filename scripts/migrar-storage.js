// scripts/migrar-storage.js
// Copia TODOS os buckets e arquivos do projeto antigo para o projeto novo (migração de 10/2026,
// projeto `uqrqzjafhigjuvtjqzid` → `xqsazcazsjxajmtmirzd`, org DM - Inovação e IA).
// Do antigo só LÊ (list + download). Escreve só no novo (createBucket + upload com upsert).
//
// Env (use o .env + a linha do foreach do roteiro docs/MIGRACAO-PROJETO.md):
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY            → projeto ANTIGO (origem)
//   NOVO_SUPABASE_URL / NOVO_SUPABASE_SERVICE_ROLE_KEY  → projeto NOVO (destino)
// Flags:
//   --dry-run                 só lista, conta e grava o relatório; não cria bucket nem sobe arquivo
//   --pular=orfaos-<data>.json  órfãos de luma-template-assets que ficam para trás (o novo já nasce
//                             limpo). Aceita `orfaos: [{path}]` (saída do limpar-assets-orfaos.js)
//                             e/ou `pastas: ["<tid>", ...]` (pastas inteiras de template apagado —
//                             foi o formato usado em 14/10/2026, porque o limpar-assets-orfaos.js
//                             não roda no antigo: a service_role não tem USAGE no schema luma)
//   --bucket=luma-covers      migra só esse bucket (para repetir um que falhou)
// Idempotente: arquivo que já existe no destino com o mesmo tamanho é pulado — pode rodar de novo.
// Cache: arquivo imutável (termina em -<uuid>.<ext>, em luma-template-assets e luma-covers) sobe
// com max-age de 1 ano, o mesmo que o Estúdio passou a gravar em 14/10/2026; os demais mantêm o
// cacheControl de origem. Requer @supabase/supabase-js (já no package.json). NUNCA commite chaves.

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const DRY = process.argv.includes('--dry-run');
const PULAR = (process.argv.find((a) => a.startsWith('--pular=')) || '').slice(8);
const SO_BUCKET = (process.argv.find((a) => a.startsWith('--bucket=')) || '').slice(9);
const PAGE = 100;
const LOTE = 8;
const TENTATIVAS = 3;
const TIMEOUT_MS = 90_000;
const UM_ANO = '31536000';
const IMUTAVEL = /-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$/i;
const BUCKETS_IMUTAVEIS = new Set(['luma-template-assets', 'luma-covers']);

function url(v) {
  v = (v || '').trim().replace(/\/+$/, '');
  return v && !/^https?:\/\//i.test(v) ? 'https://' + v : v;
}
const ANTIGO_URL = url(process.env.SUPABASE_URL);
const ANTIGO_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NOVO_URL = url(process.env.NOVO_SUPABASE_URL);
const NOVO_KEY = process.env.NOVO_SUPABASE_SERVICE_ROLE_KEY;
if (!ANTIGO_URL || !ANTIGO_KEY || !NOVO_URL || !NOVO_KEY) {
  console.error('Faltam variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (antigo), NOVO_SUPABASE_URL, NOVO_SUPABASE_SERVICE_ROLE_KEY (novo).');
  process.exit(1);
}
if (ANTIGO_URL === NOVO_URL) {
  console.error('Origem e destino são o mesmo projeto. Confira o .env.');
  process.exit(1);
}
const antigo = createClient(ANTIGO_URL, ANTIGO_KEY, { auth: { persistSession: false } });
const novo = createClient(NOVO_URL, NOVO_KEY, { auth: { persistSession: false } });

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
function comTimeout(p, ms, oQue) {
  let id;
  const estouro = new Promise((_, rej) => { id = setTimeout(() => rej(new Error(`tempo esgotado (${ms / 1000}s) em ${oQue}`)), ms); });
  return Promise.race([p, estouro]).finally(() => clearTimeout(id));
}
async function comRetry(fn, oQue) {
  let ultimo;
  for (let n = 1; n <= TENTATIVAS; n++) {
    try { return await comTimeout(fn(), TIMEOUT_MS, oQue); }
    catch (e) { ultimo = e; if (n < TENTATIVAS) await espera(2000 * Math.pow(3, n - 1)); }
  }
  throw ultimo;
}

// Lista recursiva (mesmo motor do backup-storage.js), com os metadados que o upload precisa.
async function listAll(cliente, bucket, prefix = '') {
  const out = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await cliente.storage.from(bucket).list(prefix, { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    if (!data || !data.length) break;
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null || item.metadata == null) out.push(...(await listAll(cliente, bucket, full)));
      else out.push({ path: full, size: item.metadata.size || 0, mimetype: item.metadata.mimetype, cacheControl: item.metadata.cacheControl });
    }
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

function cacheDe(bucket, arquivo) {
  if (BUCKETS_IMUTAVEIS.has(bucket) && IMUTAVEL.test(arquivo.path)) return UM_ANO;
  const m = /max-age=(\d+)/.exec(arquivo.cacheControl || '');
  return m ? m[1] : '3600';
}

async function garantirBucket(b) {
  const { data: existente } = await novo.storage.getBucket(b.name);
  if (existente) return 'já existia';
  if (DRY) return 'seria criado';
  const { error } = await novo.storage.createBucket(b.name, { public: b.public, fileSizeLimit: b.file_size_limit, allowedMimeTypes: b.allowed_mime_types });
  if (error) throw new Error(`criar bucket ${b.name}: ${error.message}`);
  return 'criado';
}

async function copiar(bucket, a) {
  const blob = await comRetry(async () => {
    const { data, error } = await antigo.storage.from(bucket).download(a.path);
    if (error) throw error;
    return data;
  }, `download ${bucket}/${a.path}`);
  await comRetry(async () => {
    const { error } = await novo.storage.from(bucket).upload(a.path, blob, { upsert: true, contentType: a.mimetype || 'application/octet-stream', cacheControl: cacheDe(bucket, a) });
    if (error) throw error;
  }, `upload ${bucket}/${a.path}`);
}

async function main() {
  const pular = new Set();
  const pularPastas = new Set();
  if (PULAR) {
    const j = JSON.parse(fs.readFileSync(PULAR, 'utf8'));
    (j.orfaos || []).forEach((o) => pular.add('luma-template-assets/' + o.path));
    (j.pastas || []).forEach((p) => pularPastas.add(p));
    console.log(`Pulando ${pular.size} órfão(s) e ${pularPastas.size} pasta(s) de template apagado listados em ${PULAR}.`);
  }
  const { data: buckets, error } = await antigo.storage.listBuckets();
  if (error) { console.error('Erro listando buckets do antigo:', error.message); process.exit(1); }
  const relatorio = { geradoEm: new Date().toISOString(), dryRun: DRY, origem: ANTIGO_URL, destino: NOVO_URL, buckets: [], falhas: [] };
  let total = 0, copiados = 0, pulados = 0, iguais = 0;

  for (const b of buckets) {
    if (SO_BUCKET && b.name !== SO_BUCKET) continue;
    console.log(`\n# ${b.name} (${b.public ? 'público' : 'privado'})`);
    const estadoBucket = await garantirBucket(b);
    console.log(`  bucket no destino: ${estadoBucket}`);
    const origem = await listAll(antigo, b.name);
    const destino = new Map();
    if (estadoBucket === 'já existia') (await listAll(novo, b.name)).forEach((d) => destino.set(d.path, d.size));
    const fila = origem.filter((a) => {
      if (pular.has(b.name + '/' + a.path) || (b.name === 'luma-template-assets' && pularPastas.has(a.path.split('/')[0]))) { pulados++; return false; }
      if (destino.get(a.path) === a.size) { iguais++; return false; }
      return true;
    });
    total += origem.length;
    console.log(`  ${origem.length} arquivo(s) na origem · ${fila.length} a copiar · ${origem.length - fila.length} pulado(s)`);
    const bm = { name: b.name, origem: origem.length, aCopiar: fila.length, copiados: 0 };
    if (!DRY) {
      for (let i = 0; i < fila.length; i += LOTE) {
        const lote = fila.slice(i, i + LOTE);
        const res = await Promise.all(lote.map((a) => copiar(b.name, a).then(() => true).catch((e) => { relatorio.falhas.push(`${b.name}/${a.path}: ${e.message}`); return false; })));
        bm.copiados += res.filter(Boolean).length;
        process.stdout.write('.');
      }
      copiados += bm.copiados;
      console.log(`\n  copiados: ${bm.copiados}/${fila.length}`);
    }
    relatorio.buckets.push(bm);
  }
  const saida = path.join(process.cwd(), `migracao-storage-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(saida, JSON.stringify(relatorio, null, 2));
  console.log(`\n${DRY ? 'DRY-RUN — nada foi enviado. ' : ''}Origem: ${total} · copiados agora: ${copiados} · já iguais no destino: ${iguais} · órfãos pulados: ${pulados} · falhas: ${relatorio.falhas.length}.`);
  console.log(`Relatório: ${saida}`);
  if (relatorio.falhas.length) { relatorio.falhas.forEach((f) => console.error('  - ' + f)); process.exitCode = 2; }
}

main().catch((e) => { console.error(e); process.exit(1); });
