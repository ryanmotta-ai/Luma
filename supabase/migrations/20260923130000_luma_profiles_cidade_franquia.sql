-- ============================================================
-- LUMA — cidade e franquia no perfil (painel de Dados, 23/09/2026)
-- ============================================================
-- A adesão da rede por cidade/franquia era impossível: o perfil só tinha nome,
-- departamento e telefone. Decisão do Ryan: a GESTÃO preenche (aba Equipe), então os
-- dois campos entram na mesma trava de role/departamento/ativo — o próprio usuário não
-- se muda de franquia. Nulos até alguém preencher; nada é migrado.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cidade   text CHECK (char_length(cidade)   <= 120);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS franquia text CHECK (char_length(franquia) <= 120);
COMMENT ON COLUMN public.profiles.cidade   IS 'Cidade da operação (preenchida pela gestão). Painel de Dados: adesão por cidade.';
COMMENT ON COLUMN public.profiles.franquia IS 'Nome da franquia/unidade (preenchido pela gestão).';

CREATE OR REPLACE FUNCTION public.guard_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF (NEW.role         IS DISTINCT FROM OLD.role
      OR NEW.departamento IS DISTINCT FROM OLD.departamento
      OR NEW.ativo        IS DISTINCT FROM OLD.ativo
      OR NEW.cidade       IS DISTINCT FROM OLD.cidade
      OR NEW.franquia     IS DISTINCT FROM OLD.franquia) THEN
    -- auth.uid() NULL = contexto de servidor (service_role / SQL Editor): confiado.
    IF auth.uid() IS NOT NULL AND COALESCE(public.get_user_role(), '') <> 'gestao' THEN
      RAISE EXCEPTION 'Apenas gestao pode alterar role/departamento/ativo/cidade/franquia de um perfil.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
