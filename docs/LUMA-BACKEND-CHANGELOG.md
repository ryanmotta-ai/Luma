# LUMA — Changelog do Backend (Fase 5.1)

> Registro de TODAS as alterações da integração com o Supabase. Atualizado a cada mudança.
> Projeto Supabase: **`uqrqzjafhigjuvtjqzid`** (banco próprio do LUMA, separado do DM CRM).
> Arquitetura: front Vanilla JS falando direto com Supabase via `supabase-js` (anon key pública) → **RLS é a única fronteira de segurança**. Schema desenhado pra **fundir no DM CRM** depois.

---

## 2026-06-19 — Persistência: Pastas + Templates (LEITURA) — ciclo fechado

**Arquivos:** `js/designer/layers.js` + `js/main.js`.
- **novas:** `dSyncFoldersFromBackend()` (2 queries: `SELECT luma.pastas` + `luma.templates`, monta `dFolders` com **merge** que preserva pastas locais não sincronizadas, por `remoteId`/`campId`); `_dRowToFolder`/`_dRowToTemplate` (banco→objeto, publishMeta remontado).
- `main.js`: `gOnLoginSuccess` chama `dSyncFoldersFromBackend()` no boot (junto com as variáveis). Re-hidrata `idb://` (cache local) depois.

**Validado via API (REST autenticado, RLS designer):** ciclo **escrita→leitura OK** (insert pasta+template → 201; leitura traz ambos com defaults). ⚠️ **Teste no navegador ainda pendente** (criar no designer → recarregar → vir do banco).

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

**Segurança:** auditado contra os achados do DM CRM (`docs/LUMA-REGRAS_BACKEND.md`). Testes anônimos confirmam que nada vaza. Detalhes no README.

---

## 2026-06-19 — Versionamento

- Repo git inicializado e conectado ao remoto oficial **`github.com/ryanmotta-ai/Luma`** (privado).
- Commit `dced413` ("Backend Supabase Fase 5.1") aplicado **em cima** do histórico existente (`f1a5356 "0.6"`), sem perdas.
- Commit `6835b79` ("Auth real + persistência de variáveis via Supabase") — auth real, reconciliação de roles, sync de variáveis offline-first/não-destrutivo + este changelog.
- `.gitignore` limpo (credenciais removidas; `supabase-config.js` ignorado).

---

## Pendências / próximos passos

- [x] **Login real testado no navegador** — funciona (login + promoção a `gestao` OK, 2026-06-19).
- [~] `js/core/user-profile.js`: badges do perfil próprio reconciliados (`gestao`/`equipe_dm`, 2026-06-19). Tela de *Gestão de Equipe* ainda é MOCK (lista `AUTH_USERS`, não os profiles) — migrar junto com a gestão de usuários.
- [~] **Persistência do designer**: ✅ variáveis (`dVars` → `luma.variaveis`); ✅ pastas + templates + Storage (escrita+leitura, validado via API — falta exercer no navegador). Falta: `dFontsPersist` (fontes), `snippets`, `biblioteca_assets`.
- [ ] **Persistência do franqueado**: `fSaveHist`/`fAddHist` + upload de fotos do chat → `luma.artes` + Storage.
- [ ] **Analytics**: emitir eventos em `analytics.fct_eventos` nos pontos-chave.
- [ ] **XSS (H.1)**: `gEsc()` global antes de produção (achado §11.3 do CRM).
- [ ] Migrar a gestão de usuários mock (`AUTH_USERS`) pra Supabase Admin (Edge Function).
