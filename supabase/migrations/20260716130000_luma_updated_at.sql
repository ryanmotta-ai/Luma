-- ============================================================
-- LUMA — updated_at em luma.pastas / luma.templates (base p/ aviso de conflito)
-- ============================================================
-- O sync do designer é last-write-wins: dois devices editando o mesmo template
-- se sobrescrevem em silêncio. Com updated_at mantido por trigger, o front pode
-- comparar o carimbo antes do upsert e AVISAR o designer do conflito (roadmap
-- Fase 1). O lock de push local já existe; isto cobre o cross-device.
--
-- Não-destrutivo: default now() nas linhas novas; antigas ficam com o momento
-- da migration. Trigger padrão (sem extensão) — colunas herdam a RLS existente.
ALTER TABLE luma.pastas    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE luma.templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION luma.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;
-- Função interna de trigger: sem grant de EXECUTE (mesmo padrão da migration
-- 20260622150000 de revoke em funções de trigger).
REVOKE EXECUTE ON FUNCTION luma.set_updated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_pastas_updated_at ON luma.pastas;
CREATE TRIGGER trg_pastas_updated_at BEFORE UPDATE ON luma.pastas
  FOR EACH ROW EXECUTE FUNCTION luma.set_updated_at();
DROP TRIGGER IF EXISTS trg_templates_updated_at ON luma.templates;
CREATE TRIGGER trg_templates_updated_at BEFORE UPDATE ON luma.templates
  FOR EACH ROW EXECUTE FUNCTION luma.set_updated_at();
