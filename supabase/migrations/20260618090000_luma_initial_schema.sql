-- ============================================================
-- LUMA — Editor de Artes (Delivery Much)  ·  Fase 5.1 backend
-- Migration 1/5: profiles + helpers de role + RLS base
-- ============================================================
--
-- CONTEXTO: front Vanilla JS falando DIRETO com o Supabase via supabase-js
-- (anon key PÚBLICA). Sem Server Action no meio → a RLS é a ÚNICA fronteira
-- de segurança.
--
-- MESCLABILIDADE (decisão de projeto): o LUMA roda hoje num banco PRÓPRIO,
-- mas é desenhado pra fundir no projeto do DM CRM no futuro com mínimo atrito:
--   • profiles, roles e helpers ESPELHAM o DM CRM (ver docs/LUMA-BACK_CONTEXT.md);
--   • o domínio do LUMA vive no schema `luma.*` (migrations 2/3), isolado do `public`;
--   • buckets prefixados `luma-` (migration 5);
--   • analytics.fct_eventos idêntico ao do CRM (migration 4).
-- Na fusão: traz-se o schema `luma` inteiro e os profiles coincidem.
--
-- ROLES (idênticos ao CRM) — 3 valores, 2 personas no LUMA:
--   'franqueado'           → persona Franqueado (consome catálogo, gera artes)
--   'equipe_dm' / 'gestao' → persona Designer (cria/publica) — helper is_designer()
--   'gestao'               → também gerencia roles/usuários (topo)
-- ============================================================

-- ============================================================
-- PROFILES — estende auth.users. Estrutura idêntica à do DM CRM.
-- ============================================================
CREATE TABLE public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome         TEXT NOT NULL,
  email        TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'franqueado'
                 CHECK (role IN ('franqueado', 'equipe_dm', 'gestao')),
  departamento TEXT,                                  -- usado por equipe_dm (igual ao CRM)
  avatar_url   TEXT,
  ativo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.profiles IS 'Perfil de usuário. Espelha o DM CRM p/ fusão futura.';
COMMENT ON COLUMN public.profiles.role IS 'franqueado | equipe_dm | gestao. Promoção a designer é MANUAL (ver README).';

-- ============================================================
-- HELPERS de role (usados por toda a RLS). Assinaturas idênticas às do CRM
-- (CREATE OR REPLACE → na fusão coincidem, não conflitam).
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Exclusivo do LUMA (o CRM não tem) → sem colisão na fusão.
CREATE OR REPLACE FUNCTION public.is_designer()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role IN ('equipe_dm', 'gestao') FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

-- ============================================================
-- TRIGGER: cria profile ao cadastrar usuário.
-- SEGURANÇA: role SEMPRE 'franqueado' — NÃO confiamos em metadata->>'role'
-- (com a anon key qualquer um faz signup; confiar seria escalonamento).
-- NOTA p/ fusão: o handle_new_user do CRM confia no metadata; ao fundir,
-- prevaleça ESTA versão (mais segura) ou alinhe a política de signup.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    'franqueado'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TRIGGER: só 'gestao' pode alterar a coluna role (de qualquer perfil).
-- Fecha o "UPDATE no próprio profile setando role=gestao".
-- ============================================================
CREATE OR REPLACE FUNCTION public.guard_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- auth.uid() NULL = contexto de servidor (service_role / SQL Editor): confiado.
    IF auth.uid() IS NOT NULL AND COALESCE(public.get_user_role(), '') <> 'gestao' THEN
      RAISE EXCEPTION 'Apenas gestao pode alterar o role de um perfil.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_profile_role_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role();

-- ============================================================
-- HELPER genérico: toca updated_at (reusado pelas migrations 2/3).
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER touch_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- RLS — profiles
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario lê próprio perfil; designer lê todos"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.is_designer());

-- O próprio usuário (sem mexer em role — bloqueado pelo guard) ou gestao (qualquer um).
CREATE POLICY "usuario atualiza próprio perfil; gestao atualiza todos"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid() OR public.get_user_role() = 'gestao')
  WITH CHECK (id = auth.uid() OR public.get_user_role() = 'gestao');

-- Sem policy de INSERT (perfis nascem só pelo trigger, que é DEFINER).
-- Sem policy de DELETE (cascata via auth.users).
