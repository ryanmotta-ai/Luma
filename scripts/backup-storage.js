// scripts/backup-storage.js
// Backup completo dos buckets do Supabase Storage (todos os luma-*, inclusive o privado luma-renders).
// O pg_dump NÃO cobre os arquivos do Storage — só os metadados/URLs nas tabelas. Este script fecha esse buraco.
//
// Uso local (Git Bash ou PowerShell), a partir da raiz do repo:
//   SUPABASE_URL=https://uqrqzjafhigjuvtjqzid.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service_role> \
//   node scripts/backup-storage.js
// (No PowerShell: $env:SUPABASE_URL='...'; $env:SUPABASE_SERVICE_ROLE_KEY='...'; node scripts/backup-storage.js)
//
// No CI é chamado pelo workflow .github/workflows/backup.yml.
// Requer @supabase/supabase-js (já está no package.json). NUNCA commite a service_role key.

const fs = require('fs');
const path = require('path');

/* ── TENTAR DE NOVO ANTES DE DESISTIR ──────────────────────────────────────────
   Em 06/08/2026 o backup ficou VERMELHO por UM arquivo de 969: um `fetch failed`
   em `luma-template-assets/.../mask_l-psd-3-720.png`. O relógio do log entrega o
   que foi — o bucket começou 08:39:53 e o erro só saiu 08:57:02: dezessete
   minutos pendurado num download só. Soluço de rede, não arquivo corrompido (o
   backup do dia seguinte passou limpo).
   O problema não era o arquivo, era o script: nenhuma tentativa extra e nenhum
   teto de tempo, e qualquer erro pintava o run inteiro de vermelho. Backup que
   fica vermelho por soluço vira ruído — e ruído a gente para de olhar. Quando
   falhar de verdade, ninguém nota a diferença.
   Agora: 3 tentativas com espera crescente e teto de 60s por arquivo. Vermelho
   volta a significar alguma coisa. */
const TENTATIVAS = 3;
const TIMEOUT_MS = 60_000;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// `download` do supabase-js não aceita sinal de abort — o teto vem por fora, senão
// um socket pendurado segura o backup inteiro (foi o que aconteceu).
function comTimeout(promessa, ms, oQue) {
  let id;
  const estouro = new Promise((_, rej) => {
    id = setTimeout(() => rej(new Error(`tempo esgotado (${ms / 1000}s) em ${oQue}`)), ms);
  });
  return Promise.race([promessa, estouro]).finally(() => clearTimeout(id));
}

async function baixarComRetry(cliente, bucket, caminho) {
  let ultimo;
  for (let n = 1; n <= TENTATIVAS; n++) {
    try {
      const { data, error } = await comTimeout(
        cliente.storage.from(bucket).download(caminho), TIMEOUT_MS, `${bucket}/${caminho}`
      );
      if (error) throw error;
      if (n > 1) console.error(`\n  ok na tentativa ${n}: ${bucket}/${caminho}`);
      return data;
    } catch (e) {
      ultimo = e;
      if (n < TENTATIVAS) {
        const pausa = 2000 * Math.pow(3, n - 1);   // 2s, 6s
        console.error(`\n  tentativa ${n}/${TENTATIVAS} falhou em ${bucket}/${caminho}: ${e.message} — repetindo em ${pausa / 1000}s`);
        await espera(pausa);
      }
    }
  }
  throw ultimo;
}

// Exportado para quem precisa do MESMO motor sem a CLI — hoje o teste do retry.
// Fica ANTES do require do supabase-js e da checagem de env de propósito: assim o
// motor de tentativa é testável sem credencial e sem dependência instalada.
module.exports = { baixarComRetry, comTimeout, TENTATIVAS, TIMEOUT_MS };
if (require.main !== module) return;   // carregado como módulo: não roda o backup

const { createClient } = require('@supabase/supabase-js');

let URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OUT = process.env.OUT_DIR || path.join(process.cwd(), 'storage-backup');
const PAGE = 100;

if (!URL || !KEY) {
  console.error('Faltam as variáveis SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
// Tolera URL colada sem esquema, com espaços ou barra no fim.
URL = URL.trim().replace(/\/+$/, '');
if (!/^https?:\/\//i.test(URL)) URL = 'https://' + URL;

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

// Storage.list é paginado e lista por "pasta"; recursão para descer nas subpastas.
async function listAll(bucket, prefix = '') {
  const out = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await sb.storage
      .from(bucket)
      .list(prefix, { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      // item sem id/metadata é uma "pasta" -> recursa
      if (item.id === null || item.metadata == null) {
        const sub = await listAll(bucket, full);
        out.push(...sub);
      } else {
        out.push({ path: full, size: item.metadata.size });
      }
    }
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

async function main() {
  const { data: buckets, error } = await sb.storage.listBuckets();
  if (error) {
    console.error('Erro listando buckets:', error.message);
    process.exit(1);
  }

  fs.mkdirSync(OUT, { recursive: true });
  const manifest = { geradoEm: new Date().toISOString(), buckets: [] };
  let totalFiles = 0;
  let totalErrors = 0;
  const falhas = [];

  for (const b of buckets) {
    console.log(`\n# bucket: ${b.name} (public=${b.public})`);
    let objs = [];
    try {
      objs = await listAll(b.name);
    } catch (e) {
      console.error(`  erro listando ${b.name}: ${e.message}`);
      totalErrors++;
      continue;
    }

    const bucketDir = path.join(OUT, b.name);
    fs.mkdirSync(bucketDir, { recursive: true });
    const bm = { name: b.name, public: b.public, arquivos: [] };

    for (const o of objs) {
      try {
        const data = await baixarComRetry(sb, b.name, o.path);
        const buf = Buffer.from(await data.arrayBuffer());
        const dest = path.join(bucketDir, o.path);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, buf);
        bm.arquivos.push({ path: o.path, size: buf.length });
        totalFiles++;
        process.stdout.write('.');
      } catch (e) {
        console.error(`\n  DESISTIU de ${b.name}/${o.path} após ${TENTATIVAS} tentativas: ${e.message}`);
        falhas.push(`${b.name}/${o.path}`);
        totalErrors++;
      }
    }
    manifest.buckets.push(bm);
  }

  // A lista de quem ficou de fora entra no manifesto: quem for restaurar precisa saber
  // exatamente o que falta, sem ter que garimpar log de workflow.
  manifest.falhas = falhas;
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\n\nOK: ${totalFiles} arquivo(s) salvos em ${OUT}. Erros: ${totalErrors}.`);
  if (falhas.length) {
    console.error(`\nNão baixados (${falhas.length}), mesmo com ${TENTATIVAS} tentativas:`);
    falhas.forEach((f) => console.error('  - ' + f));
  }
  // Vermelho só depois de esgotar as tentativas — antes disso é soluço, não falha.
  if (totalErrors > 0) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
