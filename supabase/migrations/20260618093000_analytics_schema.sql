-- ============================================================
-- LUMA — Editor de Artes  ·  Migration 4/5: analytics (Módulo 3)
-- analytics.fct_eventos  (event sourcing leve)
-- ============================================================
--
-- ESTRUTURA IDÊNTICA à do schema analytics do DM CRM (docs/LUMA-BACK_CONTEXT.md).
-- Na fusão, os eventos do LUMA caem na MESMA tabela do CRM (CREATE TABLE IF NOT
-- EXISTS respeita a do CRM). Eventos esperados (alimentam js/dados/*):
--   arte_gerada, arte_baixada, template_publicado, campanha_aberta,
--   material_aberto, pagina_aberta — payload {camp_id, fmt_id, template_id...}.
--
-- LEMBRE: exponha 'analytics' em Project Settings → API → Exposed schemas.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.fct_eventos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento      TEXT NOT NULL,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  role        TEXT,
  payload     JSONB,
  ocorreu_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fct_eventos_evento      ON analytics.fct_eventos(evento);
CREATE INDEX IF NOT EXISTS idx_fct_eventos_user        ON analytics.fct_eventos(user_id);
CREATE INDEX IF NOT EXISTS idx_fct_eventos_ocorreu     ON analytics.fct_eventos(ocorreu_em);
CREATE INDEX IF NOT EXISTS idx_fct_eventos_payload_gin ON analytics.fct_eventos USING GIN(payload);

COMMENT ON TABLE analytics.fct_eventos IS
  'Captura bruta de eventos de uso (event sourcing leve). PII: user_id. Alimenta o Módulo 3.';

ALTER TABLE analytics.fct_eventos ENABLE ROW LEVEL SECURITY;

-- Qualquer autenticado grava evento em nome próprio (franqueado e designer).
CREATE POLICY "usuario autenticado grava evento em nome próprio"
  ON analytics.fct_eventos FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Designer (equipe_dm/gestao) lê eventos — fonte do dashboard de Dados.
-- (No CRM o SELECT é restrito a 'gestao'; ao fundir, alinhe se necessário.)
CREATE POLICY "designer lê eventos"
  ON analytics.fct_eventos FOR SELECT
  USING (public.is_designer());

GRANT USAGE ON SCHEMA analytics TO authenticated;
GRANT INSERT, SELECT ON analytics.fct_eventos TO authenticated;
