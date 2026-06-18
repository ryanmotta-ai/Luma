-- ============================================================
-- LUMA — Editor de Artes  ·  Migration 6/6: hardening pós-auditoria
-- ============================================================
--
-- Aplica ao LUMA as lições dos achados do DM CRM (docs/LUMA-REGRAS_BACKEND.md §11/§12).
-- Idempotente (CREATE OR REPLACE / IF EXISTS) — pode rodar sozinha no SQL Editor.
-- ============================================================

-- ------------------------------------------------------------
-- §11.1 (reforço) — guard de auto-modificação de campos privilegiados.
-- Além de 'role', bloqueia 'departamento' e 'ativo' p/ quem não é gestao.
-- (CREATE OR REPLACE sobrescreve a versão da migration 1.)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.role         IS DISTINCT FROM OLD.role
      OR NEW.departamento IS DISTINCT FROM OLD.departamento
      OR NEW.ativo        IS DISTINCT FROM OLD.ativo) THEN
    -- auth.uid() NULL = contexto de servidor (service_role / SQL Editor): confiado.
    IF auth.uid() IS NOT NULL AND COALESCE(public.get_user_role(), '') <> 'gestao' THEN
      RAISE EXCEPTION 'Apenas gestao pode alterar role/departamento/ativo de um perfil.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- §11.14 — o cliente NÃO controla a identidade do evento de analytics.
-- Trigger força user_id = auth.uid() e role = role real do profiles,
-- ignorando o que o front mandar (anti-spoofing de role/usuário).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION analytics.evt_forca_identidade()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.user_id := auth.uid();
  NEW.role    := (SELECT role FROM public.profiles WHERE id = auth.uid());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS evt_forca_identidade_trg ON analytics.fct_eventos;
CREATE TRIGGER evt_forca_identidade_trg
  BEFORE INSERT ON analytics.fct_eventos
  FOR EACH ROW EXECUTE FUNCTION analytics.evt_forca_identidade();

-- ------------------------------------------------------------
-- §12.15 — teto de tamanho do payload de evento (anti-DoS de storage).
-- ------------------------------------------------------------
ALTER TABLE analytics.fct_eventos DROP CONSTRAINT IF EXISTS fct_eventos_payload_max;
ALTER TABLE analytics.fct_eventos ADD  CONSTRAINT fct_eventos_payload_max
  CHECK (payload IS NULL OR pg_column_size(payload) < 8192);
