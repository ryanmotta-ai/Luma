# Migrations do Luma — estado real (conferido em 23/09/2026)

> O banco é definido pelos arquivos de `supabase/migrations/`, em ordem de nome. Este arquivo diz
> **o que está aplicado no projeto `uqrqzjafhigjuvtjqzid`** e onde o histórico do banco não
> bate com o repo. Conferido objeto a objeto (tabela, coluna, função, policy), não pelo nome.

## Regra

1. Toda mudança de schema, RLS, função ou gatilho **nasce como arquivo** aqui, com o mesmo nome
   usado no `apply_migration`. Nada de editar produção pelo Dashboard sem arquivo.
2. Depois de aplicar, **confira com um select** (a lição de 07/2026: migration só está pronta
   quando aplicada e conferida).
3. Mexeu em policy, função de policy ou tabela nova → rode **`supabase/tests/rls.sql`** (40
   casos em 23/09/2026, todos verdes). Qualquer `ok = false` bloqueia.

## Estado

| Arquivo | No banco? | Observação |
|---|---|---|
| `20260618090000` … `20260618095000` (schema inicial, conteúdo, artes, analytics, buckets, hardening) | ✅ objetos existem | Aplicados pelo Dashboard **antes** do registro de migrations — não aparecem em `schema_migrations`. |
| `20260619100000` … `20260622150000` | ✅ registrados | Nomes no banco levam outro timestamp (`20260619162147`…), mesmo conteúdo. |
| `20260711120000_luma_templates_size_cols` | ✅ `w/h/bg` existem | Aplicada fora do registro. |
| `20260716120000` … `20260716160000` | ✅ objetos existem | `artes.template_id`, gatilho `updated_at`, policy de leitura dos buckets, `profiles.telefone`. Fora do registro. |
| `20260731120000_luma_academia` · `20260731180000_luma_academia_conclusao` | ❌ **NÃO aplicadas** | As 8 tabelas da Academia (`cursos`, `matriculas`, `certificados`…) não existem — o front roda em modo demo. Decisão aberta #2 do roadmap. |
| `20260731190000_luma_feature_flags` | ✅ | Fora do registro. |
| `20260905120000` · `20260906152238` | ✅ | Aplicadas em 23/09 (nomes com timestamp de 23/09 no banco). |
| `20260923187500_luma_profiles_avatar` · `20260923188000_luma_suporte_ao_vivo` | ✅ aplicadas (23/09) | Foto de perfil (CHECK na `avatar_url`, que já existia) e suporte ao vivo (tabela, view, Realtime, presença, bucket `luma-suporte`, flag). Casos "suporte:" e "foto:" do `rls.sql`: 15/15 verdes. |
| `20260923124809` → `20260923183000` | ✅ registradas | Painel de Dados, IA, `destaque`, pastas de sistema, MIME dos buckets, versões de template. `luma_dados_painel` teve dois ajustes aplicados (`_fix_alias`, `_tempo_ativo`) já incorporados no arquivo. |

**Todas as funções que existem no banco estão em algum arquivo daqui** (conferido: `rls_auto_enable`,
`evt_forca_identidade`, `ff_auditar`, `handle_new_user`, `get_user_role`, `registrar_evento`…).
Ou seja: o repo é um **superconjunto** do banco — reconstrói tudo o que está em produção, mais a
Academia pendente.

## O que ainda falta para "reconstruir do zero" com confiança

- **Nunca foi testado** aplicar os arquivos em sequência num banco vazio. Algumas migrations
  foram escritas para um banco que já tinha objetos (usam `if not exists`, outras não). O teste
  certo é um projeto de desenvolvimento separado (ou `supabase db reset` local) rodando tudo do zero.
- **Baseline oficial:** com a senha do banco em mãos, `supabase db dump --schema luma,public,analytics`
  gera o retrato exato de produção para comparar com o repo. Não roda aqui (sem a senha e sem CLI).
- **Ambiente de desenvolvimento:** hoje só existe produção. Toda migration vai direto para os
  franqueados.
