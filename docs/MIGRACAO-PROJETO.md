# Migração do projeto Supabase — `uqrqzjafhigjuvtjqzid` → `xqsazcazsjxajmtmirzd`

> Roteiro de 14/10/2026. O Luma sai do projeto Free do Ryan para o projeto da org
> **DM - Inovação e IA** (plano Pro). Regra do roteiro: **no projeto antigo só leitura**. A troca
> de produção é o último passo e é um commit; até lá o Luma no ar continua no antigo.
>
> Inventário do antigo em 14/10: 18 tabelas (luma/public/analytics), 44 funções, 7 views, 23
> gatilhos, 10 policies no Storage, 2 no Realtime, 1 gatilho no Auth, 6 buckets com 1.656
> arquivos, 18 usuários, 33 migrations registradas. Postgres 17.6.

## 0. Antes de começar

- **Docker Desktop aberto.** O `supabase db dump` roda o `pg_dump` num container; o restore usa
  `psql` também por container (não precisa instalar Postgres).
- Supabase CLI (`supabase --version`), Node e Git. Tudo já está na máquina.
- Uns 2 GB livres no disco.
- No `.env` (está no `.gitignore`; nunca commitar), além do que já existe:

  ```
  NOVO_SUPABASE_URL=https://xqsazcazsjxajmtmirzd.supabase.co
  NOVO_SUPABASE_SERVICE_ROLE_KEY=<sb_secret ou service_role do projeto novo>
  ANTIGO_DB_URL=<string "Session pooler" do projeto antigo, com a senha>
  NOVO_DB_URL=<string "Session pooler" do projeto novo, com a senha>
  ```

  As strings vêm de **Dashboard → Connect → Session pooler** em cada projeto. A senha do banco
  antigo é a que está no secret `SUPABASE_DB_URL` do GitHub (quem configurou o backup tem); se
  ninguém tiver, resetar em Database → Settings e atualizar o secret — é a única mexida no antigo,
  e não toca em dado.
- Carregar o `.env` na janela do PowerShell (repetir em toda janela nova):

  ```powershell
  foreach ($l in Get-Content .env) { if ($l -match '^(\w+)=(.+)$') { Set-Item "env:$($matches[1])" $matches[2] } }
  ```

- **Avisar a equipe:** durante a migração ninguém publica no Estúdio. O que entrar no antigo
  depois do dump não vai para o novo.

## 1. Dump do antigo (só leitura)

```powershell
mkdir migracao
supabase db dump --db-url $env:ANTIGO_DB_URL -f migracao/roles.sql --role-only
supabase db dump --db-url $env:ANTIGO_DB_URL -f migracao/schema.sql
supabase db dump --db-url $env:ANTIGO_DB_URL -f migracao/data.sql --use-copy --data-only -x storage.buckets_vectors -x storage.vector_indexes -x storage.objects -x storage.buckets
supabase db dump --db-url $env:ANTIGO_DB_URL -f migracao/history_data.sql --use-copy --data-only --schema supabase_migrations
```

O `data.sql` inclui `auth.users` com as senhas em hash (por isso `migracao/` está no `.gitignore`).
`storage.objects` e `storage.buckets` ficam de fora de propósito: os buckets e os arquivos entram
pelo script do passo 4, que grava as linhas certas.

## 2. Restore no novo (banco, dados, usuários)

```powershell
docker run --rm -i -v "${PWD}\migracao:/m" postgres:17 psql --single-transaction --variable ON_ERROR_STOP=1 --file /m/roles.sql --file /m/schema.sql --command "SET session_replication_role = replica" --file /m/data.sql --dbname $env:NOVO_DB_URL
docker run --rm -i -v "${PWD}\migracao:/m" postgres:17 psql --single-transaction --variable ON_ERROR_STOP=1 --file /m/history_data.sql --dbname $env:NOVO_DB_URL
```

Transação única: se der erro, **nada entrou** — corrige o arquivo e roda de novo. Erros conhecidos
(guia oficial): role que já existe no novo (`supabase_privileged_role`, `cli_login_postgres`) →
comentar a linha em `roles.sql`; `ALTER ... OWNER TO "supabase_admin"` → comentar em `schema.sql`;
`COPY` de tabela que não existe no novo → comentar o bloco até o `\.`.

## 3. O que o dump não cobre: Auth, Storage, Realtime

Rodar `scripts/migracao/01_auth_storage_realtime.sql` no **SQL Editor do projeto novo** (ou via
psql como acima). Recria o gatilho `on_auth_user_created`, as 10 policies de `storage.objects`,
as 2 de `realtime.messages`, a publicação do Realtime e o event trigger `ensure_rls`.

## 4. Arquivos do Storage

```powershell
node scripts/limpar-assets-orfaos.js                        # só lista; gera orfaos-<data>.json (lê o antigo)
node scripts/migrar-storage.js --dry-run --pular=orfaos-<data>.json
node scripts/migrar-storage.js --pular=orfaos-<data>.json   # copia (uns 20 min); pode repetir
```

Cria os 6 buckets com a mesma configuração, copia tudo menos os órfãos, e os arquivos imutáveis
sobem com cache de 1 ano. Se algum falhar, o relatório `migracao-storage-<data>.json` lista; rodar
de novo copia só o que falta.

## 5. URLs dentro dos dados

Rodar `scripts/migracao/02_reescrever_urls.sql` no SQL Editor do novo. A conferência no fim tem
que devolver zero em todas as linhas.

## 6. Verificar

Rodar `scripts/migracao/03_verificar.sql` **nos dois projetos** e comparar. Tem que bater, exceto
"linhas com host antigo" (zero no novo) e os objetos de `luma-template-assets` (novo = antigo −
órfãos pulados).

## 7. Edge Functions e secrets

```powershell
supabase login
supabase functions deploy --project-ref xqsazcazsjxajmtmirzd
supabase secrets set --project-ref xqsazcazsjxajmtmirzd GEMINI_API_KEY=... CLOUDFLARE_ACCOUNT_ID=... TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... TELEGRAM_WEBHOOK_SECRET=...
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` as functions recebem sozinhas.
O `config.toml` já diz que `suporte-telegram` roda com `verify_jwt = false`. Se o bot do Telegram
estiver em uso, registrar o webhook na URL nova (`docs/SUPORTE-TELEGRAM.md`).

## 8. Só no Dashboard do novo (não tem SQL)

- **Data API → Exposed schemas:** `public, graphql_public, luma` (o antigo tira `analytics` e os internos).
- **Auth → URL Configuration:** Site URL `https://ryanmotta-ai.github.io/Luma/` e as Redirect URLs
  iguais às do antigo.
- **Auth → Emails / SMTP:** comparar com o antigo (templates do convite e da redefinição de senha).
- **Billing → Spend cap:** decidir (ligado bloqueia acima da cota; desligado cobra).

## 9. Teste sem commit

Trocar `url` e `anonKey` em `js/core/supabase-config.js` pelos do novo (Legacy API keys → anon),
abrir o `index.html` local e passar por: login, catálogo, gerar e baixar uma arte, Estúdio
(publicar um material de teste e excluir), suporte. Depois `git checkout -- js/core/supabase-config.js`.

## 10. Virada

1. `js/core/supabase-config.js` com url e anon key do novo; `.mcp.json` (o `supabase-novo` vira
   `supabase`); `.env.example`, `supabase/README.md`, `supabase/MIGRATIONS.md`,
   `luma-brain/02_ARCHITECTURE.md`, cabeçalhos dos scripts; entrada no `docs/LUMA-BACKEND-CHANGELOG.md`.
2. Secrets do GitHub (Settings → Secrets → Actions): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `SUPABASE_DB_URL` com os valores do novo. Depois rodar o workflow de backup à mão para conferir.
3. Commit e push na `talpaipai` (com `?v=` subido, porque toca `js/`).
4. Todo mundo faz login de novo: o JWT é por projeto. A senha é a mesma.

## 11. Se der ruim

`git revert` do commit da virada e push: o Luma volta para o antigo, que não foi tocado. Deixar o
antigo vivo por 30 dias; depois pausar (não apagar).
