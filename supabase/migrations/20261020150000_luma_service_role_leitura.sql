-- 20261020150000_luma_service_role_leitura.sql
-- A service_role tinha SELECT em 7 tabelas de `luma` e de `analytics`, mas NÃO tinha USAGE nos
-- schemas: qualquer leitura server-side dava "permission denied for schema luma". Quem sofria:
-- o relatório semanal (scripts/digest-semanal.py, GET /rest/v1 com Accept-Profile: luma) e a
-- limpeza de órfãos (scripts/limpar-assets-orfaos.js, .schema('luma')). Era assim no projeto
-- antigo também; a migração de 16/10/2026 trouxe o defeito junto.
-- Só LEITURA: o CI não escreve no domínio. A service_role ignora RLS por desenho, por isso o
-- mínimo. Escrita, se um dia precisar, nasce em migration própria.
grant usage on schema luma to service_role;
grant usage on schema analytics to service_role;
grant select on all tables in schema luma to service_role;
grant select on all tables in schema analytics to service_role;
alter default privileges for role postgres in schema luma grant select on tables to service_role;
alter default privileges for role postgres in schema analytics grant select on tables to service_role;
