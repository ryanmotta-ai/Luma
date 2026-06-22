# LUMA — Rotina de Backup

Backup automático **diário** do projeto Supabase do LUMA (`uqrqzjafhigjuvtjqzid`), rodando no GitHub Actions. Cobre **banco** (schema + dados) e **Storage** (os arquivos dos buckets, que o `pg_dump` não pega).

- **Workflow:** [.github/workflows/backup.yml](../.github/workflows/backup.yml)
- **Agendamento:** todo dia às **03:00 BRT** (`cron: '0 6 * * *'` em UTC). Também roda sob demanda (botão **Run workflow**).
- **Onde ficam:** como *artifacts* do workflow, com **retenção de 90 dias**. Aba **Actions › Backup LUMA (Supabase)** › abra a execução › seção **Artifacts**.

---

## O que entra (e o que não entra)

| Item | Coberto? | Como |
| --- | --- | --- |
| Schema de `public`, `luma`, `analytics` (tabelas, views, funções, policies) | ✅ | `supabase db dump` → `schema.sql.gz` |
| **Dados** de `public`, `luma`, `analytics` (profiles, pastas, templates, artes, variáveis, fontes…) | ✅ | `supabase db dump --data-only` → `data.sql.gz` |
| **Storage**: buckets `luma-covers`, `luma-fontes`, `luma-renders` (privado), `luma-template-assets`, `luma-user-uploads` | ✅ | `scripts/backup-storage.js` baixa todos os objetos |
| `auth.users` (logins, senhas hasheadas) | ❌ | Gerenciado pelo GoTrue/Supabase. Ver nota de restore abaixo. |
| Estrutura base (extensions, schemas, roles, trigger `handle_new_user`) | ✅ (no git) | Fonte da verdade é `supabase/migrations/`, não o backup |

> **Mentalidade:** as **migrations** (`supabase/migrations/`) são a verdade da *estrutura*; o **backup** guarda os *dados* e os *arquivos*, que não estão no git. O `schema.sql.gz` é um snapshot redundante de segurança.

---

## Pré-requisito: configurar 3 secrets (uma vez)

No GitHub: **Settings › Secrets and variables › Actions › New repository secret**.

| Secret | Onde pegar no Supabase | Observação |
| --- | --- | --- |
| `SUPABASE_DB_URL` | **Project Settings › Database › Connection string › `Session pooler`** | Use o **Session pooler** (IPv4, porta 5432). A conexão *Direct* é IPv6-only no free tier e **não conecta** do GitHub Actions. A string já vem com a senha do banco. |
| `SUPABASE_URL` | `https://uqrqzjafhigjuvtjqzid.supabase.co` | Não é sensível, mas fica como secret por portabilidade. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Project Settings › API › `service_role`** | **Secreta de verdade** — dá acesso total, ignora RLS. Só vive nos secrets do Actions; nunca no front nem no repo. |

Sem esses secrets o workflow falha com mensagem explícita (não corrompe nada).

---

## Rodar manualmente

GitHub › **Actions** › **Backup LUMA (Supabase)** › **Run workflow** › branch `main` › **Run**.
Ao terminar, o resumo da execução mostra o tamanho dos dumps; os arquivos ficam em **Artifacts**.

---

## Restore

### A) Recuperar dados no MESMO projeto (caso comum — apagou/corrompeu uma tabela)

1. Baixe o artifact `luma-db-backup-<n>` e extraia. `gunzip data.sql.gz`.
2. Restaure só o que precisa. O `data.sql` usa `COPY`; para repor uma tabela específica, edite o arquivo ou rode inteiro:
   ```bash
   psql "<SUPABASE_DB_URL>" -f data.sql
   ```
   Como `auth.users` já existe aqui, a FK de `public.profiles` é satisfeita.

### B) Disaster recovery em projeto NOVO/vazio

1. **Estrutura primeiro** — aplique as migrations do repo (montam extensions, schemas, roles, triggers):
   ```bash
   supabase db push   # ou rode os .sql de supabase/migrations/ em ordem
   ```
   (Alternativa de emergência: `psql "<URL>" -f schema.sql` do backup.)
2. **Usuários** — `auth.users` não está no backup. Recrie os logins pelo Dashboard (Authentication) ou importe via Admin API. O trigger `handle_new_user` cria o `profiles` correspondente automaticamente.
3. **Dados** — aplique `data.sql`. Se algum `COPY` de `profiles` conflitar com linhas já criadas pelo trigger, limpe `public.profiles` antes ou ajuste o `data.sql`.

### C) Restore do Storage (os arquivos)

1. Baixe o artifact `luma-storage-backup-<n>` e extraia para `./storage-backup`.
2. Rode o script de restore (cria buckets que faltarem e faz upsert dos arquivos):
   ```bash
   # Git Bash
   SUPABASE_URL=https://uqrqzjafhigjuvtjqzid.supabase.co \
   SUPABASE_SERVICE_ROLE_KEY=<service_role> \
   IN_DIR=./storage-backup \
   node scripts/restore-storage.js
   ```
   ```powershell
   # PowerShell
   $env:SUPABASE_URL='https://uqrqzjafhigjuvtjqzid.supabase.co'
   $env:SUPABASE_SERVICE_ROLE_KEY='<service_role>'
   $env:IN_DIR='./storage-backup'
   node scripts/restore-storage.js
   ```

> As URLs públicas dos assets ficam guardadas nas tabelas (`thumb_url`, `arquivo_url`, etc.). Restaurando os arquivos **com os mesmos caminhos** (o script faz isso), as URLs voltam a funcionar sem precisar reescrever o banco.

---

## Backup local sob demanda (Windows)

Sem esperar o agendado. A partir da raiz do repo:

```powershell
# Banco (precisa da Supabase CLI: scoop install supabase  /  ou npx supabase)
supabase db dump --db-url "<SUPABASE_DB_URL>" --schema public,luma,analytics -f schema.sql
supabase db dump --db-url "<SUPABASE_DB_URL>" --schema public,luma,analytics --data-only --use-copy -f data.sql

# Storage
$env:SUPABASE_URL='https://uqrqzjafhigjuvtjqzid.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY='<service_role>'
node scripts/backup-storage.js   # cai em ./storage-backup
```

---

## Notas

- **Backup gerenciado do Supabase:** o plano free tem retenção curta e sem PITR (Point-in-Time Recovery é add-on pago). Por isso esta rotina externa — não dependemos só do Supabase.
- **Regra 3-2-1:** os artifacts são *uma* cópia, fora do banco. Para algo mais sério, baixe periodicamente um artifact e guarde em outro lugar (Drive da empresa, etc.), ou aponte o upload para um storage externo.
- **Falha parcial não derruba tudo:** o script de Storage continua mesmo que um objeto falhe e sinaliza no fim (exit code 2) — o que baixou é preservado.
- Mudou a frequência? Edite o `cron` em [.github/workflows/backup.yml](../.github/workflows/backup.yml).
