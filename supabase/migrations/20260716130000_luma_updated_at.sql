-- ============================================================
-- LUMA — updated_at em luma.pastas / luma.templates  [NO-OP — ver nota]
-- ============================================================
-- NOTA (2026-07-16): esta migration nasceu redundante. As colunas updated_at e
-- os triggers touch_pastas_updated / touch_templates_updated JÁ EXISTEM desde o
-- schema inicial aplicado em 2026-06-19 (20260618091000_luma_content_schema.sql,
-- via public.touch_updated_at). A versão original deste arquivo criaria um
-- SEGUNDO conjunto de triggers (trg_*) por cima dos touch_* — updated_at seria
-- gravado duas vezes por UPDATE.
--
-- O arquivo fica versionado como no-op (em vez de sumir) para não confundir
-- quem já viu a referência a ele no changelog. Aplicar não faz nada; se a
-- versão original chegou a ser aplicada, o bloco abaixo desfaz a duplicata.
DROP TRIGGER IF EXISTS trg_pastas_updated_at ON luma.pastas;
DROP TRIGGER IF EXISTS trg_templates_updated_at ON luma.templates;
DROP FUNCTION IF EXISTS luma.set_updated_at();
