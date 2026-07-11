-- ============================================================
-- LUMA — luma.templates: tamanho real do template (w / h / bg)
-- ============================================================
-- O front (dLoadTemplate) usa w/h/bg pra renderizar a arte no tamanho REAL.
-- É essencial p/ templates 'orig' (PSD custom, sem preset em DFMT_SIZES):
-- antes o tamanho só existia no localStorage e NUNCA subia. Ao baixar o
-- material do catálogo, os layers desciam mas a prancheta assumia o tamanho
-- default (story) → arte fora da tela = "parece que não baixou".
--
-- São escalares leves → o sync do boot (dSyncFoldersFromBackend) já os traz
-- junto do catálogo; não precisam do lazy-fetch dos layers.
--
-- Não-destrutivo: linhas antigas ficam com NULL e o front cai no preset do
-- fmt (comportamento atual); republicar o material grava o tamanho correto.
-- Colunas herdam as políticas RLS existentes da tabela — nada a alterar.
ALTER TABLE luma.templates ADD COLUMN IF NOT EXISTS w  INT;
ALTER TABLE luma.templates ADD COLUMN IF NOT EXISTS h  INT;
ALTER TABLE luma.templates ADD COLUMN IF NOT EXISTS bg TEXT;
