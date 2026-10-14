-- scripts/migracao/02_reescrever_urls.sql — rodar NO PROJETO NOVO, depois do restore do banco.
-- Troca o host do projeto antigo pelo novo em toda coluna que guarda URL pública do Storage.
-- Sem isto, camada, capa, avatar e biblioteca apontariam para o projeto antigo.
-- Colunas medidas no antigo em 14/10/2026 (linhas com a URL): template_versions.layers 233 ·
-- artes.dados 146 · templates.layers 49 · artes.sig 33 · biblioteca_assets.url 5 ·
-- pastas.cover_url 4 · profiles.avatar_url 3. Nenhuma constraint, função ou default cita o host.
-- Gatilhos desligados na transação (session_replication_role = replica): sem isto o
-- versionar_template criaria uma versão nova de cada template só pela troca de texto, e o
-- touch_updated_at carimbaria updated_at em tudo.

begin;
set local session_replication_role = replica;

update luma.templates
   set layers = replace(layers::text, 'uqrqzjafhigjuvtjqzid.supabase.co', 'xqsazcazsjxajmtmirzd.supabase.co')::jsonb
 where layers::text like '%uqrqzjafhigjuvtjqzid.supabase.co%';

update luma.template_versions
   set layers = replace(layers::text, 'uqrqzjafhigjuvtjqzid.supabase.co', 'xqsazcazsjxajmtmirzd.supabase.co')::jsonb
 where layers::text like '%uqrqzjafhigjuvtjqzid.supabase.co%';

update luma.artes
   set dados = replace(dados::text, 'uqrqzjafhigjuvtjqzid.supabase.co', 'xqsazcazsjxajmtmirzd.supabase.co')::jsonb
 where dados::text like '%uqrqzjafhigjuvtjqzid.supabase.co%';

update luma.artes
   set sig = replace(sig, 'uqrqzjafhigjuvtjqzid.supabase.co', 'xqsazcazsjxajmtmirzd.supabase.co')
 where sig like '%uqrqzjafhigjuvtjqzid.supabase.co%';

update luma.artes
   set thumb_url = replace(thumb_url, 'uqrqzjafhigjuvtjqzid.supabase.co', 'xqsazcazsjxajmtmirzd.supabase.co')
 where thumb_url like '%uqrqzjafhigjuvtjqzid.supabase.co%';

update luma.templates
   set thumb_url = replace(thumb_url, 'uqrqzjafhigjuvtjqzid.supabase.co', 'xqsazcazsjxajmtmirzd.supabase.co')
 where thumb_url like '%uqrqzjafhigjuvtjqzid.supabase.co%';

update luma.biblioteca_assets
   set url = replace(url, 'uqrqzjafhigjuvtjqzid.supabase.co', 'xqsazcazsjxajmtmirzd.supabase.co')
 where url like '%uqrqzjafhigjuvtjqzid.supabase.co%';

update luma.pastas
   set cover_url = replace(cover_url, 'uqrqzjafhigjuvtjqzid.supabase.co', 'xqsazcazsjxajmtmirzd.supabase.co')
 where cover_url like '%uqrqzjafhigjuvtjqzid.supabase.co%';

update luma.fontes
   set arquivo_url = replace(arquivo_url, 'uqrqzjafhigjuvtjqzid.supabase.co', 'xqsazcazsjxajmtmirzd.supabase.co')
 where arquivo_url like '%uqrqzjafhigjuvtjqzid.supabase.co%';

update public.profiles
   set avatar_url = replace(avatar_url, 'uqrqzjafhigjuvtjqzid.supabase.co', 'xqsazcazsjxajmtmirzd.supabase.co')
 where avatar_url like '%uqrqzjafhigjuvtjqzid.supabase.co%';

commit;

-- Conferência: tem que devolver zero linhas.
select 'templates.layers' as coluna, count(*) from luma.templates where layers::text like '%uqrqzjafhigjuvtjqzid%'
union all select 'template_versions.layers', count(*) from luma.template_versions where layers::text like '%uqrqzjafhigjuvtjqzid%'
union all select 'artes.dados', count(*) from luma.artes where dados::text like '%uqrqzjafhigjuvtjqzid%'
union all select 'artes.sig', count(*) from luma.artes where sig like '%uqrqzjafhigjuvtjqzid%'
union all select 'biblioteca_assets.url', count(*) from luma.biblioteca_assets where url like '%uqrqzjafhigjuvtjqzid%'
union all select 'pastas.cover_url', count(*) from luma.pastas where cover_url like '%uqrqzjafhigjuvtjqzid%'
union all select 'profiles.avatar_url', count(*) from public.profiles where avatar_url like '%uqrqzjafhigjuvtjqzid%';
