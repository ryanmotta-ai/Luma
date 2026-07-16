# LUMA — Changelog do Backend (Fase 5.1)

> Registro de TODAS as alterações da integração com o Supabase. Atualizado a cada mudança.
> Projeto Supabase: **`uqrqzjafhigjuvtjqzid`** (banco próprio do LUMA, separado do DM CRM).
> Arquitetura: front Vanilla JS falando direto com Supabase via `supabase-js` (anon key pública) → **RLS é a única fronteira de segurança**. Schema desenhado pra **fundir no DM CRM** depois.

---

## 2026-06-22 — Hardening pós-incidente: views SECURITY INVOKER + revoke de funções de trigger

**Contexto:** ao mexer em **Settings › API › Exposed schemas**, o schema `analytics` foi exposto pela Data API. Isso disparou **6 ERROR** de segurança (`security_definer_view` — view `SECURITY DEFINER` exposta fura RLS) + WARN de funções `SECURITY DEFINER` chamáveis via `/rest/v1/rpc/`. **Os dados não vazaram:** as views já estavam sem grant de `SELECT` pra `anon`/`authenticated`.

**Correções no banco:**
- `20260622140000_luma_analytics_views_security_invoker`: as 6 views `analytics.vw_*` viraram `security_invoker = on` → respeitam a permissão de quem consulta (remediação oficial do lint 0010). Extração admin (SQL Editor / service_role) segue intacta. **6 ERROR zerados.**
- `20260622150000_luma_sec_revoke_trigger_funcs`: `REVOKE EXECUTE` de `PUBLIC`/`anon`/`authenticated` nas 4 funções de **trigger** (`handle_new_user`, `guard_profile_role`, `rls_auto_enable`, `evt_forca_identidade`). Trigger dispara independente desse grant → não quebra nada. **8 WARN zerados.**
- **NÃO mexido:** `get_user_role`/`is_designer` mantêm `EXECUTE` — são usadas nas RLS policies; revogar quebraria o RLS (lição da Fase 5.1). Os 4 WARN delas são inerentes ao modelo e inofensivos (retornam só dado do próprio usuário logado).

**Ação no Dashboard (Pedro):** Exposed schemas = só `public`, `graphql_public`, `luma`. Tirar `analytics` (extração não vai pela API) e qualquer schema interno (`auth`/`storage`/`vault`/…).

**Estado de segurança:** 0 ERROR. WARN restantes e aceitos: `get_user_role`/`is_designer` (necessárias ao RLS) + Leaked Password Protection (toggle do Dashboard).

---

## 2026-06-22 — Rotina de backup (GitHub Actions, diário)

Backup automatizado, **fora** do Supabase (o free tier tem retenção curta e PITR é pago). Doc completa: [docs/LUMA-BACKUP.md](LUMA-BACKUP.md).

**Arquivos novos:**
- `.github/workflows/backup.yml` — workflow diário (`cron 0 6 * * *` = 03:00 BRT) + `workflow_dispatch`. Dois jobs independentes (um não derruba o outro):
  - **db-backup**: Supabase CLI (`supabase db dump`) → `schema.sql.gz` + `data.sql.gz` dos schemas `public,luma,analytics`. CLI escolhida em vez de `pg_dump` cru porque casa sozinha com o Postgres **17.6** do projeto.
  - **storage-backup**: `node scripts/backup-storage.js` baixa todos os objetos dos 5 buckets `luma-*` (inclusive o privado `luma-renders`) — o `pg_dump` só guarda as URLs, não os arquivos.
  - Saída como **artifacts** (retenção 90 dias).
- `scripts/backup-storage.js` — varre buckets recursivamente (paginado), baixa objetos, gera `manifest.json` (com visibilidade de cada bucket). Falha parcial não aborta (exit 2). CommonJS, usa `@supabase/supabase-js` (já no `package.json`).
- `scripts/restore-storage.js` — caminho de volta: cria buckets que faltarem (visibilidade do manifest) e faz upsert dos arquivos. Backup sem restore testado não é backup.
- `docs/LUMA-BACKUP.md` — o que entra/não entra, setup dos 3 secrets (com onde achar no dashboard), restore (3 cenários: mesmo projeto, projeto novo, Storage), backup local no Windows, notas (3-2-1, `auth.users`).

**Secrets a configurar no GitHub** (Pedro faz, não passam por mim): `SUPABASE_DB_URL` (Session pooler — IPv4; a Direct é IPv6-only e não conecta do Actions), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

**`.gitignore`:** adicionados `backup/`, `storage-backup/`, `*.sql.gz`.

**Validado end-to-end (2026-06-25):** os 2 jobs rodaram **verdes** via `workflow_dispatch`, gerando os artifacts. Ajustes que apareceram no primeiro run real:
1. **Node 22** no runner — `supabase-js` recente exige WebSocket nativo, ausente no Node 20 (`Node.js 20 detected without native WebSocket support`).
2. **`SUPABASE_DB_URL` = Session pooler** (IPv4, host `…pooler.supabase.com:5432`). A *Direct connection* (`db.<ref>.supabase.co`) é **IPv6** e o GitHub Actions não tem IPv6 (`Network is unreachable`).
3. Scripts de Storage normalizam a URL (trim + prefixo `https://`) pra tolerar secret colado sem esquema.

---

## 2026-06-22 — Performance: índice de FK + RLS initplan (guiado pelo advisor)

Rodada de performance baseada no **advisor do Supabase** (`get_advisors performance`). Só banco — front intocado.

**1) Índice na FK `artes.template_id`** (migration `20260622120000_luma_perf_indexes`): `artes` é a única tabela que cresce de verdade; sem índice na FK, remover um template antigo causaria seq scan na tabela inteira. Criado `idx_artes_template`.

**2) RLS `initplan`** (migration `20260622130000_luma_perf_rls_initplan`): as policies chamavam `auth.uid()` / `is_designer()` / `get_user_role()` **reavaliando por linha**. Envolvidas em `(select …)` → avaliadas **uma vez por query** (recomendação oficial do Supabase). Semântica idêntica; aplicado via `ALTER POLICY` (atômico, sem janela de exposição). Cobre `luma.artes` (4 policies), `pastas`, `templates`, `fontes`, `variaveis`, `biblioteca_assets`, `snippets`, `public.profiles` (2) e `analytics.fct_eventos` (2). **Resultado: os 9 WARN de `auth_rls_initplan` foram zerados.**

**Decisões conscientes (NÃO feito, com motivo):**
- **Sem índices em `criado_por`** (6 tabelas): nenhuma query filtra por essa coluna e profile quase nunca é apagado → nasceriam como `unused_index`. Índice morto só custa escrita.
- **`multiple_permissive_policies`** (WARN, em `fontes`/`pastas`/`templates`/`variaveis`): cada SELECT avalia 2 policies permissivas (a de leitura + a `FOR ALL` de designer). Resolver exige fatiar o `FOR ALL` em 3 policies (INSERT/UPDATE/DELETE) por tabela. Ganho desprezível na escala atual (tabelas de dezenas de linhas) e mexer em RLS com o sistema em uso tem risco desproporcional → **deixado como dívida**; revisitar na fusão com o CRM ou se as tabelas crescerem.

**Validado:** `pg_policies` confirma `(SELECT auth.uid())` nas expressões (lógica preservada); advisor sem nenhum lint de `initplan`; `idx_artes_template` presente.

---

## 2026-06-22 — Analytics por extração: views SQL (schema `analytics`)

Decisão: o analytics **não vira dashboard no app** — os estudos saem por **extração** (SQL Editor / BI), em cima dos dados transacionais (`luma.artes`, `luma.templates`, `luma.pastas`, `public.profiles`). Sem event-sourcing, sem peso no front.

**Migration:** `supabase/migrations/20260619120000_luma_analytics_views.sql` (aplicada no banco). **6 views** no schema `analytics`:
- `vw_artes_por_dia` — artes/baixadas/franqueados por dia.
- `vw_uso_por_campanha` — uso agregado por campanha (`camp_id`/`camp_name`).
- `vw_uso_por_formato` — uso por formato (`fmt_id`/`fmt_name`).
- `vw_taxa_download` — total de artes, baixadas e **% de download**.
- `vw_franqueados_ativos` — por franqueado: nº de artes, baixadas e última atividade.
- `vw_templates_publicados` — por pasta: nº de templates, publicados e última publicação.

**Segurança validada:** as views **não têm grant** pra `anon`/`authenticated` (query em `role_table_grants` voltou vazia) → **não expostas via PostgREST/REST**. Acesso só com credencial admin (SQL Editor / service_role). São de **extração**, não da aplicação.

**Estado dos dados:** `vw_templates_publicados` já retorna 15 pastas; as views de artes estão zeradas porque nenhum franqueado gerou arte real ainda — vão popular sozinhas conforme o uso.

---

## 2026-06-19 — Gestão de usuários real no Supabase (Fase 1)

A tela de **Equipe** (modal de perfil) deixou de usar o mock (`AUTH_USERS`) e passou a usar o Supabase via RLS.
- `auth.js`: `gGetAllUsers` (SELECT `public.profiles` — gestão lê todos), `gSetUserRole` (UPDATE `role` — só gestão; guard garante), **nova** `gSetUserAtivo` (ativar/desativar). `gAddManagedUser` orienta o Dashboard (criar usuário precisa Edge Function — Fase 2). `gRemoveManagedUser` = desativar (`ativo=false`). Removidas as funções mock (`luma_role_overrides`/`luma_managed_users`).
- `user-profile.js`: `gProfileRenderEquipe`/`gProfilePickRole`/`gProfileSetUserRole`/`gProfileRemoveUser` viraram **async**; `_EQUIPE_ROLE_CFG` e os seletores de role alinhados aos roles reais (`franqueado`/`equipe_dm`/`gestao`).
- **Validado:** gestão lista todos os profiles via RLS. Escrita (role/ativo) não testada mutativamente (pra não mexer na conta real do Ryan); garantida pela policy (gestao atualiza todos) + guard (bloqueia não-gestão).

**Falta (Fase 2):** criar/convidar/excluir usuário pelo app via Edge Function (`service_role`).

---

## 2026-06-19 — Persistência: fontes, snippets, biblioteca (B) + histórico de artes (C1)

Mesmo padrão offline-first (localStorage cache + push background só designer + sync no boot).

**B — designer:**
- **Fontes** (`fonts.js` → `luma.fontes` + bucket `luma-fontes`): o arquivo da fonte sobe pro Storage e o FontFace carrega da URL. Colunas `nome`/`weight` adicionadas (migration `luma_fontes_extra_cols`). Remoção explícita (`dDeleteFontFromBackend`).
- **Snippets** (`library.js` → `luma.snippets`): blocos reutilizáveis. Remoção explícita.
- **Biblioteca de assets** (`library.js` → `luma.biblioteca_assets` + bucket `luma-template-assets`): **antes nem persistia** (só memória) — agora sobe imagens e cataloga. Remoção explícita.

**C1 — franqueado:**
- **Histórico de artes** (`history.js` → `luma.artes`, **escopo por usuário**): push das artes novas (upsert), sync no boot (merge cross-device), propagação rascunho→baixada (`fMarkBaixadaBackend`). Fotos do `dados` ainda inline (C2 sobe pro Storage).

`main.js`: o boot agora dispara **6 syncs** (variaveis, folders, fontes, snippets, biblioteca, artes). Shapes todos validados via MCP. **Teste no navegador pendente.**

**C2 (feito):** fotos **enviadas** (base64) no `dados` sobem pro bucket `luma-user-uploads` (tornado **PÚBLICO** — viram arte pública) → URL pública no histórico. `_fUploadUserImg` em `history.js`. URLs externas (ex.: coladas de um site) ficam como estão.

**Teste no navegador (2026-06-19):** template "Hambug" publicado com imagem por **URL externa** (gstatic) → foi pro banco. Upload de **arquivo** pro Storage (base64 → bucket) ainda não exercido no browser (só via API).

---

## 2026-06-19 — Persistência: Pastas + Templates (LEITURA) — ciclo fechado

**Arquivos:** `js/designer/layers.js` + `js/main.js`.
- **novas:** `dSyncFoldersFromBackend()` (2 queries: `SELECT luma.pastas` + `luma.templates`, monta `dFolders` com **merge** que preserva pastas locais não sincronizadas, por `remoteId`/`campId`); `_dRowToFolder`/`_dRowToTemplate` (banco→objeto, publishMeta remontado).
- `main.js`: `gOnLoginSuccess` chama `dSyncFoldersFromBackend()` no boot (junto com as variáveis). Re-hidrata `idb://` (cache local) depois.

**Validado via API (REST autenticado, RLS designer):** ciclo **escrita→leitura OK** (insert pasta+template → 201; leitura traz ambos com defaults).

**✅ Escrita validada no NAVEGADOR (2026-06-19):** o Pedro publicou um template no designer → gravou em `luma.templates` ("Prancheta 1", Copa do Mundo, feed, publicado) + as 16 pastas do catálogo sincronizadas. Falta exercer: upload de **imagem real** pro Storage (templates testados não tinham foto) e confirmar a **leitura cross-device** (outro device/localStorage limpo).

**Decisão de arquitetura:** backend = **Supabase é a fonte** (cross-device). O **IndexedDB (`img-store` do Ryan) fica como cache local complementar** — não passamos por cima: já está integrado (no push, imagens `idb://`/`data:` são resolvidas e sobem pro Storage; o banco guarda a URL).

---

## 2026-06-19 — Persistência: Pastas + Templates + Storage (ESCRITA)

**Arquivo:** `js/designer/layers.js`.
- `dPersistFolders()` dispara `dPushFoldersToBackend()` (debounce 1.2s) em background.
- **novas:** `_dPushFoldersNow()` (upsert `luma.pastas` + `luma.templates`; cada pasta/template ganha `remoteId` UUID = PK no banco, **sem mexer no `id` interno** nem nas referências); `_dUploadDataUrl()` (sobe `data:`URL pro Storage → URL pública); `_dUploadLayerImages()` (sobe imagens base64 dos layers).
- **Storage:** capa → bucket `luma-covers`; imagens de layer → `luma-template-assets`. base64 vira URL no JSON → resolve "imagens somem" **e** alivia o localStorage.
- `publishMeta` aberto nas colunas (`publicado`/`publicado_em`/`validade`/`instrucoes`/`permissoes`).

**Falta (LEITURA):** `dPreloadFolders` puxar o catálogo do banco no boot (próximo sub-passo).

**⚠ Teste no navegador PENDENTE:** o shape do insert foi validado via MCP (pasta+template+cascade OK), mas o fluxo completo (criar template com imagem no designer → grava em `luma.*` + sobe pro Storage) **ainda não foi exercido no browser**. Validar antes de confiar.

---

## 2026-06-19 — MCP conectado + hardening de funções SECURITY DEFINER

- **MCP do Supabase conectado** nesta sessão (execute_sql, apply_migration, get_advisors, etc.).
- **Advisor 0028/0029** (funções SECURITY DEFINER chamáveis via `/rest/v1/rpc`): revogado EXECUTE de `guard_profile_role`, `handle_new_user`, `analytics.evt_forca_identidade` e `rls_auto_enable` (trigger/event — seguras). Migration `harden_revoke_execute_definer_functions` + arquivo `20260619100000_harden_definer_functions.sql`.
- **⚠ Tentativa que falhou e foi revertida:** revogar `get_user_role`/`is_designer` **quebrou a RLS** (`permission denied for function`) — elas são usadas dentro das policies, avaliadas no contexto do usuário. Revertido na hora (`fix_grant_execute_policy_helpers`: GRANT de volta). Lição: helpers de policy **precisam** de EXECUTE pelo role.
- **Sobra (aceito):** WARN nessas 2 funções (risco baixo) + Leaked Password Protection (toggle no dashboard). Eliminar o 1º exigiria schema privado (refactor futuro).

---

## 2026-06-19 — Persistência: Variáveis (dVars → luma.variaveis)

**Estratégia: offline-first.** localStorage continua como cache (boot rápido, síncrono); o Supabase é a fonte compartilhada.

**Arquivos tocados:**
- `js/designer/layers.js`:
  - `dPersistVars()` (segue síncrono) agora também dispara `dPushVarsToBackend()` em background.
  - **novas**: `_dVarToRow`/`_dRowToVar` (mapeamento dVars↔coluna), `dPushVarsToBackend()` (upsert por `name` + remove as que sumiram; só designer), `dSyncVarsFromBackend()` (carrega do banco no boot, com **merge** que preserva e sobe vars locais ainda não sincronizadas).
- `js/main.js`: `gOnLoginSuccess()` chama `dSyncVarsFromBackend()` após o login.

**RLS:** SELECT pra autenticado; write só designer (`is_designer`). Validado via API (gestao faz upsert/delete → HTTP 201/204).

**Comportamento:** designer cria/edita variável → vai pro banco; no boot, o catálogo vem do banco (cross-device). Sem backend configurado, cai no localStorage (inalterado).

**Validado no navegador (2026-06-19):** criar campo no designer → apareceu em `luma.variaveis` com UUID gerado.

**✓ Sync não-destrutivo (2026-06-19):** `dPushVarsToBackend` agora **só faz upsert** (nunca apaga em massa). A remoção do banco é explícita via `dDeleteVarFromBackend(name)`, chamada por `dRemoveVar` (apaga a var removida) e `dRenameVar` (apaga o nome antigo). Elimina o risco de um designer apagar variáveis criadas por outro.

---

## 2026-06-19 — Auth real (login via Supabase)

**Arquivos tocados:**
- `js/core/auth.js` — núcleo de autenticação migrado do mock pro Supabase:
  - `gLogin` → `sb.auth.signInWithPassword`
  - `gLogout` → `sb.auth.signOut` (corrige o "logout falso" — antes só dava reload)
  - `gForgotPassword` → `sb.auth.resetPasswordForEmail`
  - `gResetPassword(newPassword)` → `sb.auth.updateUser` (assinatura mudou: era `(token, newPassword)`)
  - **nova** `gLoadProfile()` — carrega `sb.auth.getUser()` + `SELECT role,nome,departamento FROM profiles` e popula `gAuthState`
  - `ROLE_HIERARCHY` agora `{franqueado:1, equipe_dm:2, gestao:3}` (era admin/superadmin)
  - `gIsAdmin()` = role ∈ (`equipe_dm`,`gestao`); `gIsSuperAdmin()` = `gestao`
  - `gUpdateUserTopbar()` — cores/labels do badge adaptados pros novos roles
  - **Mantido (mock, dívida):** `AUTH_USERS` + gestão de usuários (`gGetAllUsers`/`gSetUserRole`/…)
- `js/main.js` — boot (`DOMContentLoaded`) virou `async`: `await gLoadProfile()` checa a sessão real antes de decidir login vs app.

**Validação:** login real testado via API (`pedro.moraes@deliverymuch.com.br`); ataque de auto-promoção a `gestao` **bloqueado** pelo guard trigger (HTTP 400).

**Pendência:** `js/core/user-profile.js` ainda tem badges/seletores com roles antigos (`admin`/`superadmin`) — **cosmético**, não quebra; reconciliar depois.

---

## 2026-06-19 — Fundação do client Supabase

**Arquivos tocados:**
- `assets/vendor/supabase.js` — SDK `supabase-js` v2 (UMD) vendorizado (expõe `window.supabase`).
- `js/core/supabase-config.js` — credenciais (URL + anon key). **Gitignored** (não vai pro repo).
- `js/core/supabase-config.example.js` — modelo versionado com placeholders.
- `js/core/supabase.js` — cria `window.sb` (defensivo: sem credenciais, app segue em modo local). Helpers `gSupabase()` / `gHasBackend()`.
- `index.html` — 3 `<script>` (vendor + config + client) carregados **antes** de `js/core/auth.js`.

---

## 2026-06-19 — Schema do banco (migrations)

**Arquivos:** `supabase/migrations/` (6 migrations) + `supabase/seed.sql` + `supabase/apply_all.sql` (concatenado p/ SQL Editor) + `supabase/README.md` + `supabase/config.toml`.

**O que criou** (no projeto `uqrqzjafhigjuvtjqzid`, aplicado via SQL Editor):
- `public.profiles` + helpers (`get_user_role`, `is_designer`) + trigger de signup + guard de role.
- Schema **`luma.*`**: `pastas`, `templates`, `variaveis`, `fontes`, `snippets`, `biblioteca_assets`, `artes`.
- Schema **`analytics`**: `fct_eventos` (Módulo 3).
- **RLS** em todas as tabelas (anon sem acesso; designer vs franqueado por `is_designer()`).
- **Storage**: buckets `luma-*` (públicos p/ assets de marca; privados p/ uploads do franqueado).
- **Hardening** (migration 6): guard anti-auto-promoção, anti-spoofing de eventos, teto de payload.

**Config no dashboard:** schemas `luma` e `analytics` expostos em Settings → API → Exposed schemas. Automatic RLS habilitado.

**Mapa localStorage → Postgres:** ver `supabase/README.md`.

**Segurança:** auditado contra os achados do DM CRM (`docs/LUMA-REGRAS_BACKEND.md` — removido em 2026-07-16; lições em `docs/LUMA.md` §14.9). Testes anônimos confirmam que nada vaza. Detalhes no README.

---

## 2026-06-19 — Versionamento

- Repo git inicializado e conectado ao remoto oficial **`github.com/ryanmotta-ai/Luma`** (privado).
- Commit `dced413` ("Backend Supabase Fase 5.1") aplicado **em cima** do histórico existente (`f1a5356 "0.6"`), sem perdas.
- Commit `6835b79` ("Auth real + persistência de variáveis via Supabase") — auth real, reconciliação de roles, sync de variáveis offline-first/não-destrutivo + este changelog.
- `.gitignore` limpo (credenciais removidas; `supabase-config.js` ignorado).

---

## 2026-07-16 — INCIDENTE: sync de templates quebrado desde 11/07 (migration não aplicada)

**Sintoma:** diagnóstico no console (sessão real do designer) mostrou 30 pastas no banco e **0 templates** — os 2 templates locais presos em `_syncPending`. Franqueados sem catálogo de materiais novos.

**Causa-raiz:** a migration `20260711120000_luma_templates_size_cols.sql` (colunas `w/h/bg` em `luma.templates`) foi versionada no repo mas **nunca aplicada no banco**. O push do designer grava essas colunas em todo upsert → PostgREST rejeita a linha inteira (`column templates.w does not exist`, HTTP 400). O pull do boot pede as mesmas colunas no `select` → também falha. Pastas não usam as colunas → sobem normal (por isso o problema passou despercebido: metade do sync funcionava).

**Por que ficou mudo 5 dias:** os erros de upsert/pull eram engolidos (só viravam `_syncPending`/catch silencioso). O badge "não sincronizado" acendeu, mas sem o motivo. Correção de visibilidade: `console.warn` nos erros de push/pull do sync (`js/designer/layers.js`, esta data).

**Correção de banco:** SQL na pendência 🔴 abaixo (Pedro). **Lição de processo:** migration só está "pronta" quando aplicada — versionar no repo não muda o banco; conferir com um `select` na coluna nova após aplicar.

## 2026-07-16 — Aviso de conflito cross-device no sync do designer

**Arquivo tocado:** `js/designer/layers.js` (só front — `updated_at` + trigger já existiam no banco desde o schema inicial). Fecha o item P0 do roadmap "upsert last-write-wins sem versão — lock + `updated_at` com aviso de conflito" (o lock já existia).

- **Pull** (`dSyncFoldersFromBackend`/`_dRowToTemplate`): baixa `updated_at` e guarda como snapshot `_remoteUpdatedAt` no template local.
- **Push** (`_dPushFoldersNow`): antes de gravar, uma consulta em lote compara o carimbo atual do banco com o snapshot. Carimbo mais novo = outro device gravou nesse meio-tempo → o push segue (LWW continua sendo a regra), mas `gToast` avisa quais templates foram sobrescritos — a perda deixa de ser silenciosa.
- Depois de cada upsert o snapshot é renovado com o carimbo que o próprio write gerou (senão o push seguinte acusaria conflito com a própria gravação).
- Sem rede na consulta do carimbo → só perde o aviso; o push não muda.

## 2026-07-16 — Histórico de artes ligado ao template de origem (`template_id`)

**Arquivo tocado:** `js/franqueado/history.js` (só front — a coluna `luma.artes.template_id` já existia desde o schema inicial).

- **Push** (`fPushArtesToBackend`): grava `template_id` de verdade via `_fTemplateUuidFor(h)` — resolve o `materialId` local pro UUID remoto do template (via `dFolders`, com fallback regex pra device onde o id local já é o UUID). Materiais-demo e templates nunca sincronizados → `null`, como antes.
- **Guarda de FK:** se o template foi apagado no banco antes da arte sincronizar, o upsert re-tenta uma vez com `template_id:null` — o vínculo nunca segura a arte fora do histórico cross-device.
- **Pull** (`_fRowToArte`): `materialId` volta do banco (`r.template_id`) em vez de `null` — **"Editar" uma arte sincronizada em outro device volta a achar o material de origem** (num device recém-sincronizado o id local do template É o UUID do banco).

## Pendências / próximos passos

- [x] **Login real testado no navegador** — funciona (login + promoção a `gestao` OK, 2026-06-19).
- [x] `js/core/user-profile.js`: badges + tela de *Gestão de Equipe* migrados pro Supabase (lista profiles reais via RLS; Fase 1).
- [x] **Persistência do designer**: ✅ variáveis, ✅ pastas + templates + Storage, ✅ fontes, ✅ snippets, ✅ biblioteca de assets (todas via API; falta exercer no navegador).
- [x] **Persistência do franqueado**: ✅ histórico de artes (`luma.artes`) + ✅ fotos do chat → bucket `luma-user-uploads` (tornado público).
- [x] **Analytics**: eventos emitidos nos pontos-chave — `sessao_iniciada`, `arte_gerada`, `arte_baixada`, e (2026-07-16) `template_publicado`, `campanha_aberta`, `material_aberto` (funil completo campanha → material → arte). As views `vw_*` consultam-se via SQL Editor/service_role.
- [ ] 🔴 **URGENTE (Pedro, 30s no SQL Editor)** — **templates não sincronizam desde 11/07** (incidente confirmado em 2026-07-16, ver entrada acima): a migration `20260711120000_luma_templates_size_cols.sql` nunca foi aplicada. Sem as colunas `w/h/bg`, TODO upsert de template falha (`column templates.w does not exist`) e o pull do catálogo também — franqueado não vê material novo, designer acumula pendência. Colar no SQL Editor (idempotente, não-destrutivo):
  ```sql
  ALTER TABLE luma.templates ADD COLUMN IF NOT EXISTS w  INT;
  ALTER TABLE luma.templates ADD COLUMN IF NOT EXISTS h  INT;
  ALTER TABLE luma.templates ADD COLUMN IF NOT EXISTS bg TEXT;
  -- aproveitando: índice da migration 20260716120000
  CREATE INDEX IF NOT EXISTS idx_artes_template_id ON luma.artes(template_id);
  ```
  Depois de aplicar, avisar o Ryan: recarregar o Estúdio e clicar no badge "não sincronizado" — os templates presos sobem sozinhos.
- [ ] **PENDENTE DE APLICAÇÃO (Pedro, ~5 min no SQL Editor)** — 2 migrations escritas em 2026-07-16, versionadas em `supabase/migrations/`:
  - `20260716120000_luma_artes_template_id.sql` — coluna `template_id` em `luma.artes` (FK SET NULL + índice). **Nota (2026-07-16): a coluna já existe no schema inicial aplicado (`20260618092000`)** — o que esta migration adiciona de fato é o índice. O front **já foi ligado** (ver entrada abaixo); a migration segue valendo aplicar pelo índice.
  - `20260716130000_luma_updated_at.sql` — **virou NO-OP (2026-07-16)**: coluna e trigger já existiam desde o schema inicial (`touch_*_updated`). O arquivo foi reescrito pra só desfazer a duplicata caso a versão original tenha sido aplicada. **Resumo pro Pedro: só a `20260716120000` vale aplicar (e só pelo índice).**
- [ ] **XSS (H.1)**: `gEsc()` global antes de produção (achado §11.3 do CRM).
- [~] Gestão de usuários: ✅ Fase 1 (listar/role/ativo via RLS). **Fase 2 (criar via Edge Function) ADIADA** — por ora criar/excluir usuário é feito direto no Dashboard do Supabase (decisão 2026-06-19).
