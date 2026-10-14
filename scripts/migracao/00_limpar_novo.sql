-- scripts/migracao/00_limpar_novo.sql — rodar NO PROJETO NOVO antes de REPETIR o restore (passo 2).
-- O restore é "do zero": o data.sql é COPY puro e duplicaria linha (chave primária) num banco que
-- já tem dados. Como o antigo continua vivo até a virada, o ensaio de 14/10 é refeito no dia: este
-- arquivo devolve o novo ao estado "vazio" sem tocar no Storage (os arquivos ficam; a cópia é
-- idempotente) nem nas policies de storage/realtime (o 01 é idempotente e roda de novo).
-- As funções de `public` ficam (o schema.sql usa CREATE OR REPLACE) — inclusive a do gatilho do Auth.
-- DELETE em vez de TRUNCATE de propósito: em auth.* o postgres não é dono das tabelas, e o DELETE
-- em auth.users cascateia (identities, sessions, refresh_tokens, mfa_*, one_time_tokens).
-- ⛔ NUNCA rodar no projeto antigo: a trava é o host da string de conexão. Confira antes.

begin;
drop schema if exists luma cascade;
drop schema if exists analytics cascade;
drop table if exists public.profiles cascade;
drop table if exists supabase_migrations.schema_migrations;   -- o history_schema.sql recria com as constraints
delete from auth.users;
delete from auth.audit_log_entries;
delete from auth.flow_state;
commit;

-- Conferência: tudo "false"/0, menos o Storage.
select 'schema luma existe' as item, (to_regnamespace('luma') is not null)::text as valor
union all select 'schema analytics existe', (to_regnamespace('analytics') is not null)::text
union all select 'public.profiles existe', (to_regclass('public.profiles') is not null)::text
union all select 'auth.users (linhas)', count(*)::text from auth.users
union all select 'auth.identities (linhas)', count(*)::text from auth.identities
union all select 'migrations (tabela existe)', (to_regclass('supabase_migrations.schema_migrations') is not null)::text
union all select 'storage objetos (ficam)', count(*)::text from storage.objects;
