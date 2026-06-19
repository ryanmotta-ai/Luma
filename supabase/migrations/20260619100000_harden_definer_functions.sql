-- ============================================================
-- LUMA — Hardening: funções SECURITY DEFINER (advisor 0028/0029)
-- Aplicado via MCP no banco; arquivado aqui pra o repo refletir o banco.
-- ============================================================
--
-- Funções SECURITY DEFINER de TRIGGER/EVENT não devem ser chamáveis via
-- /rest/v1/rpc. Revoga EXECUTE de anon/authenticated/public — elas continuam
-- rodando normalmente nos seus triggers.
REVOKE EXECUTE ON FUNCTION public.guard_profile_role()      FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()         FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION analytics.evt_forca_identidade() FROM anon, authenticated, public;

-- ⚠ NÃO revogar get_user_role()/is_designer(): elas são usadas DENTRO das policies
-- RLS, que são avaliadas no CONTEXTO DO USUÁRIO. Sem EXECUTE pro role, a policy
-- falha com "permission denied for function" e a RLS inteira quebra (testado).
-- O WARN do advisor nessas duas é aceito (risco baixo: retornam só o role do
-- próprio caller). Eliminar exigiria movê-las pra um schema privado não-exposto.

-- Obs.: public.rls_auto_enable() (event trigger do "Automatic RLS", criado pelo
-- dashboard) também teve EXECUTE revogado via MCP — não consta aqui por não fazer
-- parte do schema base destas migrations.
