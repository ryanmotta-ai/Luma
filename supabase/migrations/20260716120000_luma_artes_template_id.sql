-- ============================================================
-- LUMA — luma.artes: vínculo com o template de origem (template_id)
-- ============================================================
-- O front sempre gravou template_id:null (js/franqueado/history.js) porque a
-- coluna não existia. Sem o vínculo, "Editar" uma arte sincronizada em OUTRO
-- device não sabe qual material abrir (materialId:null no _fRowToArte) — o
-- cross-device do histórico perde a função de retomada.
--
-- Não-destrutivo: linhas antigas ficam NULL (o front já trata). FK com
-- ON DELETE SET NULL: apagar um template não quebra o histórico de artes.
-- Coluna herda as políticas RLS existentes (dono-only) — nada a alterar.
--
-- Depois de aplicar: avisar p/ ligar o front (history.js grava/lê o vínculo).
ALTER TABLE luma.artes ADD COLUMN IF NOT EXISTS template_id UUID
  REFERENCES luma.templates(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_artes_template_id ON luma.artes(template_id);
