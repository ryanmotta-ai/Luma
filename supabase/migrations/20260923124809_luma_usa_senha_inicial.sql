-- LUMA — a pessoa logada ainda está com a senha inicial compartilhada? (23/09/2026)
-- O front usa para obrigar a troca no primeiro acesso SEM conhecer a senha: ela vive só
-- aqui e na Edge Function invite-user. Responde apenas sobre auth.uid(); anon não executa.
-- Substituída no mesmo dia por 20260923125556_luma_senha_inicial_dmbrasil.sql.
create or replace function luma.usa_senha_inicial()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select u.encrypted_password = extensions.crypt('dmbrasil@123', u.encrypted_password)
    from auth.users u where u.id = auth.uid()
  ), false);
$$;
revoke all on function luma.usa_senha_inicial() from public, anon;
grant execute on function luma.usa_senha_inicial() to authenticated;
