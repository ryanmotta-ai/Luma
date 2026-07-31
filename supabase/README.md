# Backend do LUMA — Supabase

Migrations do **LUMA standalone** (editor de artes). Front Vanilla JS falando **direto** com o Supabase via `supabase-js` no browser. Não há Next.js/Server Actions — **a RLS é a única fronteira de segurança**.

Projeto atual: **`uqrqzjafhigjuvtjqzid`** (banco próprio do LUMA, separado do DM CRM).

## Desenhado pra fundir no DM CRM depois

O LUMA roda hoje em banco próprio, mas foi modelado pra **mesclar no projeto do DM CRM** com mínimo atrito:

- **Domínio no schema `luma.*`** (não em `public`) → na fusão, traz-se o schema `luma` inteiro sem colidir com o `public` do CRM.
- **`profiles`, roles e helpers idênticos ao CRM** (`franqueado`/`equipe_dm`/`gestao`) → os perfis coincidem; funções usam `CREATE OR REPLACE`.
- **Buckets prefixados `luma-`** → não colidem com os do CRM.
- **`analytics.fct_eventos` idêntico ao do CRM** → os eventos caem na mesma tabela.

## Migrations (ordem)

| Arquivo | O que cria |
|---|---|
| `…090000_luma_initial_schema.sql` | `public.profiles`, `get_user_role()`/`is_designer()`, trigger de signup, guard de role, RLS |
| `…091000_luma_content_schema.sql` | schema `luma` + `pastas`/`templates`/`variaveis`/`fontes`/`snippets`/`biblioteca_assets` + grants + RLS |
| `…092000_luma_artes_schema.sql` | `luma.artes` (histórico do franqueado) + RLS |
| `…093000_analytics_schema.sql` | schema `analytics` + `fct_eventos` (Módulo 3) + RLS |
| `…094000_storage_buckets.sql` | buckets `luma-*` + policies |
| `…20260731120000_luma_academia.sql` | **Academia**: `cursos`/`curso_modulos`/`curso_aulas`/`matriculas`/`aula_progresso`/`aula_notas`/`aula_mensagens`/`certificados` + RLS + RPC `ac_emitir_certificado` + bucket privado `luma-aulas` |
| `…20260731180000_luma_academia_conclusao.sql` | Experiência de conclusão: `cursos.conclusao` (JSONB) + colunas de estado em `matriculas` (splash/vídeo dos CEOs). Sem tabela nem bucket novo |
| `seed.sql` | (opcional) variáveis base + snippet de promoção da equipe |
| `apply_all.sql` | os 6 do **schema base** concatenados, pra colar num projeto LIMPO |

⚠️ A tabela acima lista o schema base + a Academia. Entre eles há mais migrations (hardening,
índices, RLS initplan, colunas extras) — a pasta `migrations/` em ordem de nome é a fonte da
verdade, e `apply_all.sql` **não** as inclui: ele serve pra levantar um projeto do zero.

## Mapa localStorage → Postgres

| localStorage (hoje) | Vira |
|---|---|
| `yngs_folders_v1` (pastas) | `luma.pastas` |
| `yngs_folders_v1` (templates + `publishMeta`) | `luma.templates` (`publicado`/`validade` viram colunas) |
| `yngs_vars_v1` (`dVars`) | `luma.variaveis` |
| `yngs_fonts_v1` (base64) | `luma.fontes` + bucket `luma-fontes` |
| `yngs_snippets_v1` | `luma.snippets` |
| biblioteca de assets | `luma.biblioteca_assets` + bucket `luma-template-assets` |
| `dm_artes_hist_v2` | `luma.artes` |
| imagens `__local__` (somem hoje) | buckets `luma-user-uploads` / `luma-renders` |

## Roles (idênticos ao CRM — 3 valores, 2 personas)

`franqueado` · `equipe_dm` · `gestao`. Persona **Designer** = `equipe_dm` + `gestao` → `is_designer()`. `gestao` também gerencia roles.

## Aplicar

**Via SQL Editor (recomendado — o CLI `link` está barrado por privilégio de org):**
1. Copia `supabase/apply_all.sql` → SQL Editor do projeto → **Run**.
2. **Settings → API → Exposed schemas:** adiciona **`luma`** e **`analytics`** (deve ficar `public, graphql_public, luma, analytics`).

**Via CLI (quando o `link` funcionar):** `supabase link --project-ref uqrqzjafhigjuvtjqzid` → `supabase db push`.

## Implicações no front (camada de dados — não UI)

- Tabelas do domínio ficam no schema `luma` → no supabase-js use **`sb.schema('luma').from('pastas')`** etc. `profiles` fica no schema default; eventos em `sb.schema('analytics')`.
- Precisa **expor `luma` e `analytics`** na API (passo 2 acima), senão o PostgREST não os enxerga.

## Segurança

1. **Signup nasce sempre `franqueado`** — o trigger ignora `metadata.role` de propósito. Promova a equipe DM a `equipe_dm`/`gestao` manualmente (ver `seed.sql`).
2. **Franqueados são externos** → não dá pra restringir signup por domínio. Mantenha "Confirm email" + "Leaked Password Protection".
3. **A anon/publishable key é pública** (vai no front). O que protege os dados são as policies. Nunca exponha a `service_role`.
4. **XSS ainda pendente (H.1)** no front — resolver `gEsc()` antes de produção.

## Próximos passos (fora desta entrega)

- ✅ `supabase-js` vendorizado + `js/core/supabase.js` (client `window.sb`) + config — **já feito**.
- Trocar o mock de `js/core/auth.js` por `supabase.auth.signInWithPassword` (Auth real).
- Adaptar `dPersistFolders`/`fSaveHist`/`dFontsPersist`/etc. pra ler/escrever no Supabase (com `.schema('luma')`) e subir imagens pro Storage.
