-- ============================================================
-- LUMA — funções de policy não executáveis sem login, 23/09/2026
-- ============================================================
-- Aviso do Supabase (lint 0028): is_designer(), is_ativo() e get_user_role() são SECURITY DEFINER
-- e o papel `anon` podia chamá-las por /rest/v1/rpc. O Luma não tem nada sem login: a suíte
-- supabase/tests/rls.sql já mostrava o anon recusado nas tabelas. Tirar o EXECUTE do anon fecha
-- a porta sem mudar nada para quem está logado.
-- ⚠ NÃO revogar de `authenticated`: as policies chamam estas funções com o privilégio de quem
-- consulta — sem EXECUTE, todo o catálogo e a telemetria param (ver changelog de 23/09).

revoke execute on function public.is_designer() from anon, public;
revoke execute on function public.is_ativo() from anon, public;
revoke execute on function public.get_user_role() from anon, public;
grant execute on function public.is_designer() to authenticated;
grant execute on function public.is_ativo() to authenticated;
grant execute on function public.get_user_role() to authenticated;
