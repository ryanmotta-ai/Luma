-- ============================================================
-- LUMA — luma.fontes: colunas extras pro front (aplicado via MCP)
-- ============================================================
-- O front guarda nome amigável (label) e peso da fonte além de family/arquivo.
ALTER TABLE luma.fontes ADD COLUMN IF NOT EXISTS nome   TEXT;
ALTER TABLE luma.fontes ADD COLUMN IF NOT EXISTS weight INT NOT NULL DEFAULT 400;
