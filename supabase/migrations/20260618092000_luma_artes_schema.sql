-- ============================================================
-- LUMA — Editor de Artes  ·  Migration 3/5: histórico de artes
-- luma.artes  (dm_artes_hist_v2) — escopo por usuário (franqueado)
-- ============================================================
--
-- Colunas espelham 1:1 a entrada de fAddHist (js/franqueado/history.js):
--   id(ts)→id+created_at · tsBaixada→baixada_em · _sig→sig
--   campId/campName/campColor · fmtId/fmtName · materialId→template_id · materialName
--   dados(jsonb) · prod/por/de · status
-- ============================================================
CREATE TABLE luma.artes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  camp_id       TEXT,
  camp_name     TEXT,
  camp_color    TEXT,
  fmt_id        TEXT,
  fmt_name      TEXT,
  template_id   UUID REFERENCES luma.templates(id) ON DELETE SET NULL,  -- materialId
  material_name TEXT,
  dados         JSONB NOT NULL DEFAULT '{}'::jsonb,
  prod          TEXT,
  por           TEXT,
  de            TEXT,
  status        TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'baixada')),
  sig           TEXT,                              -- assinatura de dedup
  thumb_url     TEXT,                              -- bucket 'luma-renders' (opcional)
  baixada_em    TIMESTAMPTZ,                       -- tsBaixada
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW() -- ts
);

CREATE INDEX idx_artes_user_created ON luma.artes(user_id, created_at DESC);
CREATE INDEX idx_artes_user_sig     ON luma.artes(user_id, sig);

COMMENT ON TABLE luma.artes IS
  'Histórico de artes do franqueado. Escopo por usuário (RLS). Dedup app-side por (user_id, sig) em 5min.';

-- Grants (schema custom) + default privileges p/ esta tabela.
GRANT SELECT, INSERT, UPDATE, DELETE ON luma.artes TO authenticated;

-- ============================================================
-- RLS — dono only
-- ============================================================
ALTER TABLE luma.artes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dono lê suas artes"
  ON luma.artes FOR SELECT  USING (user_id = auth.uid());
CREATE POLICY "dono cria arte em nome próprio"
  ON luma.artes FOR INSERT  WITH CHECK (user_id = auth.uid());
CREATE POLICY "dono atualiza suas artes"
  ON luma.artes FOR UPDATE  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "dono apaga suas artes"
  ON luma.artes FOR DELETE  USING (user_id = auth.uid());

-- NOTA: designer NÃO lê artes de franqueados aqui (mantido apertado). As
-- métricas do Módulo 3 vêm de analytics.fct_eventos, não desta tabela.
