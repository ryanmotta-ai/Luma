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
        const { data, error: dErr } = await sb.storage.from(b.name).download(o.path);
        if (dErr) throw dErr;
        const buf = Buffer.from(await data.arrayBuffer());
        const dest = path.join(bucketDir, o.path);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, buf);
        bm.arquivos.push({ path: o.path, size: buf.length });
        totalFiles++;
        process.stdout.write('.');
      } catch (e) {
        console.error(`\n  erro baixando ${b.name}/${o.path}: ${e.message}`);
        totalErrors++;
      }
    }
    manifest.buckets.push(bm);
  }

  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\n\nOK: ${totalFiles} arquivo(s) salvos em ${OUT}. Erros: ${totalErrors}.`);
  if (totalErrors > 0) process.exitCode = 2; // sinaliza falha parcial sem perder o que já baixou
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
