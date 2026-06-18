-- ============================================================
-- LUMA — Editor de Artes  ·  Seed OPCIONAL
-- ============================================================

-- ── Catálogo base de variáveis (dPreloadFolders defaults) ──
-- Sem isso, o franqueado não consegue identificar vars de imagem nem resolver tipos.
INSERT INTO luma.variaveis (name, label, type, required, default_value, category, ordem)
VALUES
  ('produto',      'Produto',         'text',   TRUE,  NULL,                          'produto',  0),
  ('precoPor',     'Preço Promo',     'number', TRUE,  NULL,                          'preco',    1),
  ('precoDe',      'Preço Original',  'number', FALSE, NULL,                          'preco',    2),
  ('validade',     'Validade',        'text',   FALSE, 'Promoção por tempo limitado', 'campanha', 3),
  ('foto_produto', 'Foto do produto', 'image',  FALSE, NULL,                          'midia',    4),
  ('logo_loja',    'Logo da loja',    'image',  FALSE, NULL,                          'midia',    5)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- PROMOÇÃO DA EQUIPE DM A DESIGNER (rodar DEPOIS que criarem conta)
-- ------------------------------------------------------------
-- Todo signup nasce 'franqueado'. Os e-mails @deliverymuch.com.br (js/core/auth.js)
-- são a equipe Designer. Roles alinhados ao DM CRM: gestao (topo) / equipe_dm.
--
--   UPDATE public.profiles SET role = 'gestao'
--     WHERE email = 'ryan.motta@deliverymuch.com.br';
--
--   UPDATE public.profiles SET role = 'equipe_dm'
--     WHERE email IN (
--       'pedro.moraes@deliverymuch.com.br',
--       'laura.ferrari@deliverymuch.com.br',
--       'ricardo.moreira@deliverymuch.com.br',
--       'vanessa.rosa@deliverymuch.com.br',
--       'ana.almeida@deliverymuch.com.br',
--       'joviane.santos@deliverymuch.com.br',
--       'marco.severo@deliverymuch.com.br',
--       'brenda.santos@deliverymuch.com.br'
--     );
-- ============================================================
