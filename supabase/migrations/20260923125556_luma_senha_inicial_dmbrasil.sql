-- LUMA — senha inicial passa a ser 'dmbrasil' (pedido do Ryan, 23/09/2026). A antiga
-- 'dmbrasil@123' segue reconhecida: quem ainda está nela também é levado a criar a própria.
-- ⚠ Mudou SENHA_PADRAO em supabase/functions/invite-user? Mude aqui também.
create or replace function luma.usa_senha_inicial()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select u.encrypted_password = extensions.crypt('dmbrasil', u.encrypted_password)
        or u.encrypted_password = extensions.crypt('dmbrasil@123', u.encrypted_password)
    from auth.users u where u.id = auth.uid()
  ), false);
$$;
revoke all on function luma.usa_senha_inicial() from public, anon;
grant execute on function luma.usa_senha_inicial() to authenticated;
