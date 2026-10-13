// scripts/limpar-assets-orfaos.js
// Lista — e, com --apagar, remove — os arquivos de `luma-template-assets` que nenhum template,
// versão ou item da biblioteca referencia mais. Até 13/10/2026 apagar um template no Estúdio
// deixava a pasta <tid>/ inteira no bucket: 65 templates apagados = 670 arquivos (140 MB),
// metade do bucket. O Estúdio passou a levar a pasta junto; este script limpa o que ficou.
//
// Uso (raiz do repo):
//   SUPABASE_URL=https://uqrqzjafhigjuvtjqzid.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service_role> \
//   node scripts/limpar-assets-orfaos.js            # só lista e grava orfaos-<data>.json
//   node scripts/limpar-assets-orfaos.js --apagar   # remove (rode scripts/backup-storage.js antes)
//   --dias=N   ignora arquivos mais novos que N dias (padrão 7: rascunho em voo ainda não gravou a URL)
// (No PowerShell: $env:SUPABASE_URL='...'; $env:SUPABASE_SERVICE_ROLE_KEY='...'; node scripts/limpar-assets-orfaos.js)
//
// Tem que ser pela API do Storage: DELETE direto em storage.objects deixa o arquivo físico no S3,
// contando no Storage Size. Requer @supabase/supabase-js (já no package.json). NUNCA commite a service_role key.

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const BUCKET = 'luma-template-assets';
const PAGE = 100;
const APAGAR = process.argv.includes('--apagar');
const DIAS = Number((process.argv.find((a) => a.startsWith('--dias=')) || '--dias=7').slice(7)) || 7;

let URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error('Faltam as variáveis SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
URL = URL.trim().replace(/\/+$/, '');
if (!/^https?:\/\//i.test(URL)) URL = 'https://' + URL;
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

// Mesmo lister do backup-storage.js: paginado e por "pasta", recursão nas subpastas.
async function listAll(prefix = '') {
  const out = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await sb.storage
      .from(BUCKET)
      .list(prefix, { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null || item.metadata == null) out.push(...(await listAll(full)));
      else out.push({ path: full, size: item.metadata.size || 0, criadoEm: item.created_at });
    }
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

// Lê a tabela inteira em páginas de 1000 (teto do PostgREST).
async function todas(tabela, cols) {
  const out = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await sb.schema('luma').from(tabela).select(cols).range(de, de + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
const mb = (b) => (b / 1048576).toFixed(1) + ' MB';

async function main() {
  const [arquivos, templates, versoes, biblioteca] = await Promise.all([
    listAll(),
    todas('templates', 'id,layers'),
    todas('template_versions', 'template_id,layers'),
    todas('biblioteca_assets', 'url'),
  ]);
  const vivos = new Set(templates.map((t) => t.id));
  const emUso = JSON.stringify([templates, versoes, biblioteca]);
  // Conservador: referência crua, codificada na URL ou só o UUID do upload — qualquer uma segura o arquivo.
  const usado = (p) => {
    const u = (p.slice(p.lastIndexOf('/') + 1).match(UUID) || [])[0];
    return emUso.includes(p) || emUso.includes(encodeURI(p)) || (!!u && emUso.includes(u));
  };
  const corte = Date.now() - DIAS * 86400e3;
  const semUso = arquivos.filter((a) => !usado(a.path));
  const orfaos = semUso.filter((a) => new Date(a.criadoEm).getTime() < corte);
  const recentes = semUso.length - orfaos.length;

  const porPasta = {};
  for (const o of orfaos) {
    const tid = o.path.split('/')[0];
    const p = (porPasta[tid] = porPasta[tid] || { n: 0, bytes: 0, templateVivo: vivos.has(tid) });
    p.n++;
    p.bytes += o.size;
  }
  const totalBucket = arquivos.reduce((s, a) => s + a.size, 0);
  const totalOrfaos = orfaos.reduce((s, a) => s + a.size, 0);
  console.log(`Bucket ${BUCKET}: ${arquivos.length} arquivos, ${mb(totalBucket)}.`);
  console.log(`Órfãos com mais de ${DIAS} dias: ${orfaos.length} (${mb(totalOrfaos)}) em ${Object.keys(porPasta).length} pasta(s). Sem uso mas recentes (ignorados): ${recentes}.`);
  Object.entries(porPasta)
    .sort((a, b) => b[1].bytes - a[1].bytes)
    .forEach(([tid, p]) =>
      console.log(`  ${tid}  ${String(p.n).padStart(4)} arq  ${mb(p.bytes).padStart(9)}  ${p.templateVivo ? 'template VIVO (camada trocada ou removida)' : 'template apagado'}`)
    );

  const saida = path.join(process.cwd(), `orfaos-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(saida, JSON.stringify({ geradoEm: new Date().toISOString(), dias: DIAS, apagou: APAGAR, orfaos }, null, 2));
  console.log(`Lista gravada em ${saida}.`);

  if (!APAGAR) {
    console.log('Nada apagado (sem --apagar).');
    return;
  }
  let apagados = 0;
  for (let i = 0; i < orfaos.length; i += 100) {
    const lote = orfaos.slice(i, i + 100).map((o) => o.path);
    const { data, error } = await sb.storage.from(BUCKET).remove(lote);
    if (error) {
      console.error(`\nErro no lote ${i / 100 + 1}: ${error.message}`);
      process.exitCode = 2;
      continue;
    }
    apagados += (data || []).length;
    process.stdout.write('.');
  }
  console.log(`\nApagados: ${apagados} de ${orfaos.length}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
