// scripts/restore-storage.js
// Restaura um backup de Storage (gerado por scripts/backup-storage.js) de volta para os buckets.
// Cria o bucket se não existir (com a visibilidade registrada no manifest) e faz upsert dos arquivos.
//
// Uso (a partir da raiz do repo, com a pasta storage-backup/ extraída de um artifact):
//   SUPABASE_URL=https://uqrqzjafhigjuvtjqzid.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service_role> \
//   IN_DIR=./storage-backup \
//   node scripts/restore-storage.js
//
// CUIDADO: faz upsert (sobrescreve arquivos de mesmo caminho). Aponte para o projeto certo.

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

let URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IN = process.env.IN_DIR || path.join(process.cwd(), 'storage-backup');

if (!URL || !KEY) {
  console.error('Faltam as variáveis SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
// Tolera URL colada sem esquema, com espaços ou barra no fim.
URL = URL.trim().replace(/\/+$/, '');
if (!/^https?:\/\//i.test(URL)) URL = 'https://' + URL;
if (!fs.existsSync(IN)) {
  console.error(`Pasta de backup não encontrada: ${IN}`);
  process.exit(1);
}

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

function walk(dir, base) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

async function main() {
  const manifestPath = path.join(IN, 'manifest.json');
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : null;

  const { data: existing } = await sb.storage.listBuckets();
  const existingNames = new Set((existing || []).map((b) => b.name));

  const bucketDirs = fs
    .readdirSync(IN, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  let up = 0;
  let errs = 0;

  for (const d of bucketDirs) {
    const bucket = d.name;
    let isPublic = true;
    if (manifest) {
      const bm = manifest.buckets.find((b) => b.name === bucket);
      if (bm && typeof bm.public === 'boolean') isPublic = bm.public;
    }

    if (!existingNames.has(bucket)) {
      const { error } = await sb.storage.createBucket(bucket, { public: isPublic });
      if (error) {
        console.error(`erro criando bucket ${bucket}: ${error.message}`);
        errs++;
        continue;
      }
      console.log(`bucket criado: ${bucket} (public=${isPublic})`);
    }

    const baseDir = path.join(IN, bucket);
    const files = walk(baseDir, baseDir);
    console.log(`\n# ${bucket}: ${files.length} arquivo(s)`);
    for (const rel of files) {
      try {
        const buf = fs.readFileSync(path.join(baseDir, rel));
        const { error } = await sb.storage.from(bucket).upload(rel, buf, { upsert: true });
        if (error) throw error;
        up++;
        process.stdout.write('.');
      } catch (e) {
        console.error(`\nerro upload ${bucket}/${rel}: ${e.message}`);
        errs++;
      }
    }
  }

  console.log(`\n\nOK: ${up} arquivo(s) restaurados. Erros: ${errs}.`);
  if (errs > 0) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
