-- scripts/migracao/03_verificar.sql — rodar nos DOIS projetos e comparar linha a linha.
-- Só leitura. Devolve uma tabela item → valor; as duas saídas têm que bater, exceto:
--   · "linhas com host antigo": antigo > 0, novo = 0 (depois do 02_reescrever_urls.sql)
--   · "storage objetos <bucket>": no novo = antigo − órfãos pulados (luma-template-assets)
--   · "auth.users": igual (18 em 14/10/2026)

with tabelas as (
  select n.nspname as esquema, c.relname as tabela
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r' and n.nspname in ('luma','analytics','public')
),
contagens as (
  select 'linhas '||esquema||'.'||tabela as item,
         (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', esquema, tabela), false, true, '')))[1]::text as valor
  from tabelas
)
select * from contagens
union all select 'auth.users', count(*)::text from auth.users
union all select 'auth.identities', count(*)::text from auth.identities
union all select 'storage buckets', string_agg(id||(case when public then ' (público)' else ' (privado)' end), ', ' order by id) from storage.buckets
union all select 'storage objetos '||bucket_id, count(*)::text from storage.objects group by bucket_id
union all select 'funcoes luma/public/analytics', count(*)::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('luma','analytics','public')
union all select 'views', count(*)::text from pg_views where schemaname in ('luma','analytics','public')
union all select 'policies '||schemaname||'.'||tablename, count(*)::text from pg_policies where schemaname in ('luma','analytics','public','storage','realtime') group by schemaname, tablename
union all select 'triggers (sem internos)', count(*)::text from pg_trigger t join pg_class c on c.oid=t.tgrelid where not t.tgisinternal and c.relnamespace::regnamespace::text in ('luma','analytics','public','auth')
union all select 'trigger auth.users', string_agg(tgname, ', ') from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal
union all select 'event trigger ensure_rls', count(*)::text from pg_event_trigger where evtname='ensure_rls'
union all select 'publication supabase_realtime', coalesce(string_agg(schemaname||'.'||tablename, ', '), '(vazia)') from pg_publication_tables where pubname='supabase_realtime'
union all select 'extensoes', string_agg(extname, ', ' order by extname) from pg_extension where extname <> 'plpgsql'
union all select 'migrations registradas', count(*)::text from supabase_migrations.schema_migrations
union all select 'grants anon em luma.*', coalesce(string_agg(distinct table_name||':'||privilege_type, ', '), '(nenhum)') from information_schema.role_table_grants where grantee='anon' and table_schema='luma'
union all select 'grants authenticated em luma.* (tabelas)', count(distinct table_name)::text from information_schema.role_table_grants where grantee='authenticated' and table_schema='luma'
union all select 'rls desligado em alguma tabela', coalesce(string_agg(schemaname||'.'||tablename, ', '), '(nenhuma)') from pg_tables where schemaname in ('luma','analytics','public') and not rowsecurity
union all select 'linhas com host antigo (templates+versions+artes+pastas+biblioteca+profiles+fontes)',
  ((select count(*) from luma.templates where layers::text like '%uqrqzjafhigjuvtjqzid%' or thumb_url like '%uqrqzjafhigjuvtjqzid%')
  +(select count(*) from luma.template_versions where layers::text like '%uqrqzjafhigjuvtjqzid%')
  +(select count(*) from luma.artes where dados::text like '%uqrqzjafhigjuvtjqzid%' or sig like '%uqrqzjafhigjuvtjqzid%' or thumb_url like '%uqrqzjafhigjuvtjqzid%')
  +(select count(*) from luma.pastas where cover_url like '%uqrqzjafhigjuvtjqzid%')
  +(select count(*) from luma.fontes where arquivo_url like '%uqrqzjafhigjuvtjqzid%')
  +(select count(*) from luma.biblioteca_assets where url like '%uqrqzjafhigjuvtjqzid%')
  +(select count(*) from public.profiles where avatar_url like '%uqrqzjafhigjuvtjqzid%'))::text
order by 1;
