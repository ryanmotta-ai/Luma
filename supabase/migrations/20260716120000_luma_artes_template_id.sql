-- ============================================================
-- LUMA — luma.artes: vínculo com o template de origem  [NO-OP — ver nota]
-- ============================================================
-- NOTA (2026-07-16, pós-aplicação): esta migration nasceu redundante nas DUAS
-- partes. A coluna template_id JÁ EXISTE desde o schema inicial aplicado
-- (20260618092000_luma_artes_schema.sql) e o índice criado aqui
-- (idx_artes_template_id) DUPLICA o idx_artes_template da migration de
-- performance 20260622120000 — o advisor acusa `duplicate_index` em luma.artes.
--
-- O arquivo fica versionado como no-op (padrão da 20260716130000) e o bloco
-- abaixo DESFAZ a duplicata onde a versão original chegou a ser aplicada
-- (produção, 2026-07-16). Idempotente e não-destrutivo: o índice original
-- idx_artes_template permanece.
ALTER TABLE luma.artes ADD COLUMN IF NOT EXISTS template_id UUID
  REFERENCES luma.templates(id) ON DELETE SET NULL;
DROP INDEX IF EXISTS luma.idx_artes_template_id;
