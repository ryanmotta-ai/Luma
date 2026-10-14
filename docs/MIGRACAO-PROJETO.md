# Migração do projeto Supabase — `uqrqzjafhigjuvtjqzid` → `xqsazcazsjxajmtmirzd`

> Roteiro de 14/10/2026. O Luma sai do projeto Free do Ryan para o projeto da org
> **DM - Inovação e IA** (plano Pro). Regra do roteiro: **no projeto antigo só leitura**. A troca
> de produção é o último passo e é um commit; até lá o Luma no ar continua no antigo.
>
> Inventário do antigo em 14/10 (linha de base completa em `migracao/verificar-antigo.txt`, gerada
> pelo `03_verificar.sql`): 18 tabelas (luma/public/analytics), 34 funções nesses esquemas, 7 views,
> 22 gatilhos, 10 policies no Storage, 2 no Realtime, 1 gatilho no Auth, 6 buckets com 1.660
> arquivos (423 MB, maior 7,9 MB, nomes todos ASCII), 19 usuários, 33 migrations registradas,
> 433 linhas com URL do host antigo. Postgres 17.6. Vault vazio, sem pg_net, sem pg_cron.
>
> **Revisão de 14/10 (antes do passo 1), conferida por SQL no antigo:** o `01_auth_storage_realtime.sql`
> bate policy a policy com `pg_policies` e o gatilho com `pg_get_triggerdef`; `is_designer`, `is_ativo`
> e `handle_new_user` moram em `public` (vêm no `schema.sql`); **nenhuma função do banco cita o host
> antigo** — a migration do Telegram que tem a URL fixa (`20260926130000_luma_suporte_telegram.sql`)
> nunca foi aplicada no antigo, então o dump não a carrega. O `supabase-novo` do `.mcp.json` é
> opcional: todo SQL no novo roda pelo `psql` do Docker (comandos abaixo).

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

  As strings vêm de **Dashboard → Connect → Session pooler** em cada projeto (a aba "Direct
  connection", `db.<ref>.supabase.co`, é só IPv6 e não conecta daqui). O Dashboard entrega a
  string com `[YOUR-PASSWORD]` no lugar da senha: **trocar pelo valor real**, com os colchetes
  fora — com o placeholder a CLI responde `invalid userinfo`. A senha do banco
  antigo é a que está no secret `SUPABASE_DB_URL` do GitHub (quem configurou o backup tem); se
  ninguém tiver, resetar em Database → Settings e atualizar o secret — é a única mexida no antigo,
  e não toca em dado. Se a senha tiver `@`, `#`, `%`, `/` ou `?`, ela precisa ir **percent-encoded**
  dentro da string (`@` → `%40`, `#` → `%23`, `%` → `%25`): a CLI exige.
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
supabase db dump --db-url $env:ANTIGO_DB_URL -f migracao/data.sql --use-copy --data-only -x storage.objects -x storage.buckets -x storage.buckets_analytics -x storage.buckets_vectors -x storage.vector_indexes -x storage.s3_multipart_uploads -x storage.s3_multipart_uploads_parts
supabase db dump --db-url $env:ANTIGO_DB_URL -f migracao/history_schema.sql --schema supabase_migrations
supabase db dump --db-url $env:ANTIGO_DB_URL -f migracao/history_data.sql --use-copy --data-only --schema supabase_migrations
```

O `data.sql` inclui `auth.users` com as senhas em hash (por isso `migracao/` está no `.gitignore`).
**Toda** tabela de `storage` fica de fora de propósito (são as 7 que existem no antigo): os buckets
e os arquivos entram pelo script do passo 4, que grava as linhas certas — e um `COPY` vazio numa
tabela que o novo não tenha derrubaria a transação inteira do restore. A CLI já exclui sozinha
`auth.schema_migrations`, `storage.migrations` e os esquemas da plataforma (`vault`, `extensions`,
`realtime`...). O `history_schema.sql` é o que o guia oficial manda: sai com `CREATE ... IF NOT
EXISTS`, então não briga se o novo já tiver a tabela de histórico.

## 2. Restore no novo (banco, dados, usuários)

```powershell
docker run --rm -i -v "${PWD}\migracao:/m" postgres:17 psql --single-transaction --variable ON_ERROR_STOP=1 --file /m/roles.sql --file /m/schema.sql --command "SET session_replication_role = replica" --file /m/data.sql --dbname $env:NOVO_DB_URL
docker run --rm -i -v "${PWD}\migracao:/m" postgres:17 psql --single-transaction --variable ON_ERROR_STOP=1 --file /m/history_schema.sql --file /m/history_data.sql --dbname $env:NOVO_DB_URL
```

Transação única: se der erro, **nada entrou** — corrige o arquivo e roda de novo. Erros conhecidos
(guia oficial): role que já existe no novo (`supabase_privileged_role`, `cli_login_postgres`) →
comentar a linha em `roles.sql`; `ALTER ... OWNER TO "supabase_admin"` → comentar em `schema.sql`;
`COPY` de tabela que não existe no novo → comentar o bloco até o `\.`. O antigo não tem role
própria (conferido): se o `roles.sql` só der dor de cabeça, pode sair da linha — as roles do novo
já existem. O `data.sql` já começa com `SET session_replication_role = replica` (a CLI põe); o
`--command` na linha é cinto e suspensório.

## 3. O que o dump não cobre: Auth, Storage, Realtime

```powershell
docker run --rm -i -v "${PWD}\scripts\migracao:/s" postgres:17 psql --variable ON_ERROR_STOP=1 --file /s/01_auth_storage_realtime.sql --dbname $env:NOVO_DB_URL
```

(ou colar `scripts/migracao/01_auth_storage_realtime.sql` no SQL Editor do projeto novo). Recria o
gatilho `on_auth_user_created`, as 10 policies de `storage.objects`, as 2 de `realtime.messages` e
a publicação do Realtime; no fim imprime a conferência — `event trigger ensure_rls` tem que ser 1.

## 4. Arquivos do Storage

```powershell
node scripts/migrar-storage.js --dry-run --pular=orfaos-2026-10-14.json
node scripts/migrar-storage.js --pular=orfaos-2026-10-14.json   # copia (uns 20 min); pode repetir
```

Cria os 6 buckets com a mesma configuração, copia tudo menos os órfãos, e os arquivos imutáveis
sobem com cache de 1 ano. Se algum falhar, o relatório `migracao-storage-<data>.json` lista; rodar
de novo copia só o que falta.

O `orfaos-2026-10-14.json` (ignorado pelo git) **não** veio do `limpar-assets-orfaos.js`: esse script
falha no antigo com `permission denied for schema luma` — a `service_role` nunca ganhou `USAGE` no
schema `luma` (só `authenticated` tem; a RLS continua sendo a fronteira). A lista foi tirada por SQL
no antigo, com critério mais conservador que o do script: **pasta inteira `<tid>/` de template
apagado**, em que nenhum arquivo é citado por `templates`, `template_versions` ou
`biblioteca_assets` (pelo caminho ou pelo UUID do nome) e nenhum tem menos de 7 dias — 70 pastas,
776 arquivos, 147 MB. Os 99 arquivos sem uso em pastas de template vivo (camada trocada) e as 4
pastas de template apagado com arquivo ainda citado (template duplicado) **vão junto**.

## 5. URLs dentro dos dados

```powershell
docker run --rm -i -v "${PWD}\scripts\migracao:/s" postgres:17 psql --variable ON_ERROR_STOP=1 --file /s/02_reescrever_urls.sql --dbname $env:NOVO_DB_URL
```

A conferência no fim tem que devolver zero em todas as linhas.

## 6. Verificar

```powershell
docker run --rm -i -v "${PWD}\scripts\migracao:/s" -v "${PWD}\migracao:/m" postgres:17 psql --variable ON_ERROR_STOP=1 --file /s/03_verificar.sql --output /m/verificar-novo.txt --dbname $env:NOVO_DB_URL
```

Comparar `migracao/verificar-novo.txt` com a linha de base `migracao/verificar-antigo.txt` (o mesmo
SQL rodado no antigo em 14/10). Tem que bater, exceto "linhas com host antigo" (zero no novo) e os
objetos de `luma-template-assets` (novo = antigo − órfãos pulados).

## 7. Edge Functions e secrets

```powershell
supabase login
supabase functions deploy ai --project-ref xqsazcazsjxajmtmirzd
supabase functions deploy invite-user --project-ref xqsazcazsjxajmtmirzd
supabase secrets set --project-ref xqsazcazsjxajmtmirzd GEMINI_API_KEY=... NVIDIA_API_KEY=... NVIDIA2_API_KEY=... OLLAMA_API_KEY=... CLOUDFLARE_API_KEY=... CLOUDFLARE_ACCOUNT_ID=... OPENROUTER_API_KEY=...
```

O que o antigo tem no ar (conferido em 14/10): **só `ai` (v23, de 30/09) e `invite-user` (v13)**, as
duas com `verify_jwt = true`. `suporte-telegram` nunca foi publicada nem a migration dela aplicada —
não entra (quando entrar, é com `verify_jwt = false`, webhook e secrets `TELEGRAM_*`, ver
`docs/SUPORTE-TELEGRAM.md`). O `ai/index.ts` do repositório está **à frente** do que roda no antigo:
tem as tarefas `arte.compor`/`arte.criticar` do Luma Creative (commit 6cceba8, 14/10), que o v23
não tem — o novo sobe com o do repositório, que é a fonte. Secrets: só `GEMINI_API_KEY` é
obrigatório; os outros seis são as reservas do `ai` (secret ausente = provedor pulado). O Dashboard
do antigo mostra os **nomes** dos secrets, não os valores — os valores vêm de quem os criou ou dos
painéis dos provedores. `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` as
functions recebem sozinhas.

## 8. Só no Dashboard do novo (não tem SQL)

- **Data API → Exposed schemas:** `public, graphql_public, luma` (o antigo tira `analytics` e os internos).
- **Auth → URL Configuration:** Site URL `https://ryanmotta-ai.github.io/Luma/` e as Redirect URLs
  iguais às do antigo.
- **Auth → Emails / SMTP:** comparar com o antigo (templates do convite e da redefinição de senha).
  Sem SMTP próprio, o convite do `invite-user` sai pelo remetente padrão do Supabase (limite baixo).
- **Auth → Sign In / Providers → Email:** confirmar e-mail, tamanho mínimo da senha e validade do
  JWT iguais aos do antigo.
- **Storage → Settings:** limite global de upload ≥ 15 MB (o maior limite por bucket, `luma-renders`).
- **Billing → Spend cap:** decidir (ligado bloqueia acima da cota; desligado cobra).

## 9. Teste sem commit

Trocar `url` e `anonKey` em `js/core/supabase-config.js` pelos do novo (Legacy API keys → anon),
abrir o `index.html` local e passar por: login, catálogo, gerar e baixar uma arte, Estúdio
(publicar um material de teste e excluir), suporte. Depois `git checkout -- js/core/supabase-config.js`.

## 10. Virada

**O ensaio de 14/10 (passos 1 a 6) passou inteiro**: restore em transação única sem erro, 01/02/03
limpos, e o `03_verificar.sql` do novo bate com a linha de base do antigo em todas as linhas, menos
as esperadas (host antigo 0; `luma-template-assets` 425 = 1.201 − 776) e as que cresceram no antigo
entre a linha de base e o dump (artes, eventos, versões, 1 migration que o Ryan aplicou às 17:01 UTC).
Ou seja: **o antigo continua vivo e muda**, e o `data.sql` é COPY puro — repetir o restore por cima
duplicaria linha. Por isso a virada **refaz a parte do banco do zero**, com a equipe parada:

0. Avisar: ninguém publica, gera arte nem convida usuário até o fim (uns 15 min).
0. Zerar o novo: `docker run --rm -i -v "${PWD}\scripts\migracao:/s" postgres:17 psql --variable ON_ERROR_STOP=1 --file /s/00_limpar_novo.sql --dbname $env:NOVO_DB_URL`
   (apaga só banco e usuários do novo; Storage e policies ficam). Depois repetir os passos **1, 2,
   3, 5 e 6** (dump, restore, 01, 02, 03) — mesmos comandos, mesma ordem.
1. `js/core/supabase-config.js` com url e anon key do novo; `.mcp.json` (o `supabase-novo` vira
   `supabase`); `.env.example`, `supabase/README.md`, `supabase/MIGRATIONS.md`,
   `luma-brain/02_ARCHITECTURE.md`, cabeçalhos dos scripts; entrada no `docs/LUMA-BACKEND-CHANGELOG.md`.
   A lista completa é `grep -rn uqrqzjafhigjuvtjqzid --exclude-dir=node_modules --exclude-dir=.git .`
   — em 14/10 ainda citam o antigo, além dos acima: `.codex/config.toml`, `docs/LUMA.md` (§ backend,
   duas vezes), `docs/SUPORTE-TELEGRAM.md` (URL do webhook), `supabase/migrations/20260926130000_luma_suporte_telegram.sql`
   (URL fixa do `net.http_post`; nunca aplicada, mas trocar antes de aplicar), os comentários de
   `.github/workflows/backup.yml` e `digest-semanal.yml`, `scripts/backup-storage.js`,
   `scripts/limpar-assets-orfaos.js`, `scripts/restore-storage.js` e `presentation/CLAIMS.md`
   (a claim "R$ 0 de infra, plano Free" deixa de valer — o novo é Pro).
2. Secrets do GitHub (Settings → Secrets → Actions): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `SUPABASE_DB_URL` com os valores do novo. Depois rodar o workflow de backup à mão para conferir.
3. Repetir o `node scripts/migrar-storage.js --pular=orfaos-2026-10-14.json` na hora da virada: o
   antigo continua vivo (durante a primeira cópia, em 14/10, entraram 3 fotos novas em
   `luma-user-uploads`) e a repetição só sobe o que falta.
4. Commit e push na `talpaipai` (com `?v=` subido, porque toca `js/`).
5. Todo mundo faz login de novo: o JWT é por projeto. A senha é a mesma.

## 11. Se der ruim

`git revert` do commit da virada e push: o Luma volta para o antigo, que não foi tocado. Deixar o
antigo vivo por 30 dias; depois pausar (não apagar).
