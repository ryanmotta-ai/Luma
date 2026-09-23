-- ============================================================
-- LUMA — Conta desativada perde o poder no BANCO, não só na tela, 23/09/2026
-- ============================================================
-- Achado do ataque simulado de 23/09 (transação desfeita, supabase/tests/rls.sql): desativar
-- alguém (`profiles.ativo = false`) só derrubava a pessoa NO APP (auth.js desloga no boot). A
-- senha continua valendo no Supabase Auth, e pela API:
--   · equipe_dm desativada → `is_designer()` seguia true: despublicar e apagar template,
--     arquivar pasta, mexer nos 946 assets do Storage;
--   · gestao desativada → `get_user_role()` seguia 'gestao': mexer nas 35 flags e promover
--     qualquer conta a gestão.
-- Ou seja: tirar um ex-funcionário do Luma não tirava o poder dele.
--
-- A correção mora nas DUAS funções que todas as policies consultam — não em policy por policy.
-- Conta desativada: is_designer() = false e get_user_role() = null. Tudo que é "só equipe" ou
-- "só gestão" fecha junto, inclusive o guard de papel (`guard_profile_role`: quem está
-- desativado não se reativa nem muda papel).
-- ⚠ Consequência aceita: gestão que se desativa por engano não se reativa sozinha — a outra
-- conta de gestão (ou o SQL Editor) reativa.
--
-- E o catálogo: `templates` era a única tabela de conteúdo em que o franqueado desativado ainda
-- lia (pastas, variáveis, fontes e versões já pediam is_ativo()). Agora pede também.

create or replace function public.is_designer()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce(
    (select role in ('equipe_dm', 'gestao') and ativo from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.get_user_role()
returns text language sql stable security definer set search_path to 'public' as $$
  select role from public.profiles where id = auth.uid() and ativo;
$$;

alter policy "franqueado vê templates publicados; designer vê todos" on luma.templates
  using ( (select public.is_designer())
          or ( (select public.is_ativo())
               and publicado = true
               and (validade is null or validade >= current_date) ) );
