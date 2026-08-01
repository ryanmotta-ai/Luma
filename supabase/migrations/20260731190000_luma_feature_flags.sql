-- ============================================================
-- LUMA — CONTROLE DO PRODUTO · governança de disponibilidade funcional
-- ============================================================
--
-- O QUE ESTA MIGRATION RESOLVE: hoje, desligar uma ferramenta do Luma exige
-- editar HTML, comentar função e fazer deploy. Não existe caminho para a
-- gestão dizer "o texto vertical sai do ar enquanto passa por melhorias" sem
-- mexer em código. Esta migration cria a persistência dessa decisão.
--
-- O QUE **NÃO** É: isto NÃO é segurança. Feature flag governa EXPERIÊNCIA
-- (o que aparece e o que pode ser acionado). Quem protege DADO continua sendo
-- a RLS das tabelas de conteúdo. Um usuário com DevTools consegue forçar
-- `enabled` no cache local e reabrir um botão escondido — e isso está certo:
-- o que ele NÃO consegue é ler/escrever nada que a RLS já não permitisse.
-- Por isso o fallback do front é deliberadamente "fail-open" (sem backend e
-- sem cache, tudo funciona como hoje): uma flag indisponível não pode derrubar
-- o produto inteiro.
--
-- MODELO (2 tabelas):
--   luma.feature_flags         → estado operacional de cada recurso
--   luma.feature_flag_history  → trilha de auditoria APPEND-ONLY (por trigger)
--
-- O QUE **NÃO** VAI PARA O BANCO: rótulo, descrição, categoria, hierarquia
-- pai/filho e comportamentos permitidos. Isso é metadado de INTERFACE e vive
-- versionado junto do código, em G_FEATURE_REGISTRY (js/core/feature-flags.js).
-- Duplicar aqui criaria duas fontes de verdade que saem de sincronia no
-- primeiro rename de recurso.
--
-- CASCATA: um pai desativado torna os filhos EFETIVAMENTE indisponíveis, mas
-- esta migration NÃO propaga nada por trigger de propósito. A resolução é
-- calculada no cliente a cada consulta; o estado CONFIGURADO do filho fica
-- intacto. Assim, religar o pai devolve cada filho ao próprio estado anterior
-- em vez de acordar tudo ligado.
-- ============================================================

-- ============================================================
-- 1) FEATURE FLAGS — o estado configurado
-- ============================================================
CREATE TABLE luma.feature_flags (
  -- feature_key: a chave estável do registro do front ('designer.tools.text.vertical').
  -- É PK de propósito: uma flag por recurso, sem linha órfã e sem histórico de
  -- versões aqui (para isso existe feature_flag_history).
  feature_key       TEXT PRIMARY KEY,

  enabled           BOOLEAN NOT NULL DEFAULT TRUE,

  -- Como o recurso se comporta quando desativado. O registro do front pode
  -- restringir ainda mais por recurso (ex.: 'readonly' não faz sentido para uma
  -- ferramenta de criação), mas o banco garante que nunca entra valor inventado.
  --   hide        → some da interface (continua com guard no handler)
  --   disabled    → visível, aria-disabled, clique explica
  --   readonly    → visualiza, não cria nem altera
  --   maintenance → reconhecível, com mensagem de manutenção
  disabled_behavior TEXT NOT NULL DEFAULT 'hide'
                      CHECK (disabled_behavior IN ('hide','disabled','readonly','maintenance')),

  -- role_overrides: {"franqueado": false} = desligado só para franqueado.
  -- Ausência da chave = herda o estado global. O CHECK abaixo remove as três
  -- roles reais e exige que sobre um objeto vazio — é o jeito sem subquery
  -- (proibida em CHECK) de impedir que uma chave inventada ("cidade_x",
  -- "departamento") vire regra fantasma que ninguém consegue ler na tela.
  -- ⚠ Teto assumido: o tipo do VALOR não é validado aqui (exigiria função).
  -- O front só escreve booleano e a resolução compara com === true/false, então
  -- um valor não-booleano vindo por outro caminho é tratado como "herdar".
  role_overrides    JSONB NOT NULL DEFAULT '{}'::jsonb
                      CHECK (role_overrides - 'franqueado' - 'equipe_dm' - 'gestao' = '{}'::jsonb),

  -- motivo: o que a gestão digitou ("Em melhorias"). Aparece para o usuário no
  -- comportamento 'maintenance' e sempre no histórico. É dado de usuário →
  -- passa por gEsc() em todo ponto de innerHTML no front.
  motivo            TEXT,

  atualizado_por    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE luma.feature_flags IS
  'Controle do produto: estado operacional de cada recurso. Metadado de interface (rótulo, hierarquia) vive no registro do front, não aqui.';

CREATE INDEX idx_ff_enabled ON luma.feature_flags(enabled);

CREATE TRIGGER touch_ff_updated BEFORE UPDATE ON luma.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- 2) HISTÓRICO — append-only, escrito só por trigger
-- ============================================================
CREATE TABLE luma.feature_flag_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key    TEXT NOT NULL,
  operacao       TEXT NOT NULL CHECK (operacao IN ('INSERT','UPDATE','DELETE')),
  -- Linha inteira em JSONB (não só o campo mudado): reconstitui o estado exato
  -- de antes e depois mesmo que a tabela ganhe colunas novas depois.
  valor_anterior JSONB,
  valor_novo     JSONB,
  autor          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  motivo         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE luma.feature_flag_history IS
  'Trilha de auditoria imutável. Sem policy de escrita: só luma.ff_auditar() grava.';

CREATE INDEX idx_ff_hist_key ON luma.feature_flag_history(feature_key, created_at DESC);
CREATE INDEX idx_ff_hist_recente ON luma.feature_flag_history(created_at DESC);

-- ============================================================
-- 3) TRIGGER DE AUDITORIA
-- ------------------------------------------------------------
-- SECURITY DEFINER é NECESSÁRIO aqui, não conveniência: `authenticated` não tem
-- INSERT em feature_flag_history (é o que torna o histórico imutável para o
-- cliente). Sem DEFINER, o INSERT do trigger rodaria como o usuário e seria
-- negado — a auditoria falharia justamente na hora em que importa.
-- Auditar no banco, e não no front, é o ponto: mesmo que alguém escreva na
-- tabela por fora da tela (SQL Editor, PostgREST na mão), o rastro sai igual.
-- ============================================================
CREATE OR REPLACE FUNCTION luma.ff_auditar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO luma.feature_flag_history
    (feature_key, operacao, valor_anterior, valor_novo, autor, motivo)
  VALUES (
    COALESCE(NEW.feature_key, OLD.feature_key),
    TG_OP,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    auth.uid(),
    CASE WHEN TG_OP = 'DELETE' THEN OLD.motivo ELSE NEW.motivo END
  );
  RETURN NULL;   -- AFTER trigger: o retorno é ignorado
END;
$$;

CREATE TRIGGER ff_auditar_trg
  AFTER INSERT OR UPDATE OR DELETE ON luma.feature_flags
  FOR EACH ROW EXECUTE FUNCTION luma.ff_auditar();

-- Padrão de 20260622150000_luma_sec_revoke_trigger_funcs.sql: função de trigger
-- não precisa ser executável por usuário — o trigger a chama como parte do comando.
REVOKE ALL ON FUNCTION luma.ff_auditar() FROM PUBLIC;
REVOKE ALL ON FUNCTION luma.ff_auditar() FROM anon;
REVOKE ALL ON FUNCTION luma.ff_auditar() FROM authenticated;

-- ============================================================
-- 4) GRANTS — schema custom não herda default-privileges do Supabase
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON luma.feature_flags TO authenticated;
-- Histórico: SELECT só. Escrita é exclusividade da função DEFINER.
GRANT SELECT ON luma.feature_flag_history TO authenticated;
-- anon não recebe nada (nem SELECT): flag não é dado público.

-- ============================================================
-- 5) RLS
-- ------------------------------------------------------------
-- Leitura das flags é para TODO autenticado — sem ela o franqueado não
-- consegue montar a própria experiência. Escrita é só gestão, e a política de
-- UPDATE tem USING **e** WITH CHECK (sem o WITH CHECK, um não-gestão que
-- passasse pelo USING poderia gravar valor arbitrário).
-- (select ...) entre parênteses = initplan, o padrão de perf desta base
-- (ver 20260622130000_luma_perf_rls_initplan.sql).
-- ============================================================
ALTER TABLE luma.feature_flags        ENABLE ROW LEVEL SECURITY;
ALTER TABLE luma.feature_flag_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autenticado lê flags"
  ON luma.feature_flags FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "gestao cria flags"
  ON luma.feature_flags FOR INSERT TO authenticated
  WITH CHECK ((select public.get_user_role()) = 'gestao');

CREATE POLICY "gestao atualiza flags"
  ON luma.feature_flags FOR UPDATE TO authenticated
  USING ((select public.get_user_role()) = 'gestao')
  WITH CHECK ((select public.get_user_role()) = 'gestao');

CREATE POLICY "gestao remove flags"
  ON luma.feature_flags FOR DELETE TO authenticated
  USING ((select public.get_user_role()) = 'gestao');

-- Histórico: gestão LÊ; ninguém escreve pelo cliente. RLS habilitada sem policy
-- de INSERT/UPDATE/DELETE = deny-all — é isso que torna a auditoria imutável.
CREATE POLICY "gestao lê histórico de flags"
  ON luma.feature_flag_history FOR SELECT TO authenticated
  USING ((select public.get_user_role()) = 'gestao');

-- ============================================================
-- 6) SEED — os recursos REAIS controlados na primeira entrega
-- ------------------------------------------------------------
-- Todos nascem ligados: o comportamento do Luma não muda no dia em que esta
-- migration for aplicada. Cada chave aqui está conectada a um fluxo real do
-- código — não existe switch decorativo.
-- ON CONFLICT DO NOTHING: rodar duas vezes não sobrescreve decisão já tomada
-- pela gestão.
-- ============================================================
INSERT INTO luma.feature_flags (feature_key, enabled, disabled_behavior) VALUES
  -- Módulos da topbar
  ('module.franqueado',              TRUE, 'hide'),
  ('module.academia',                TRUE, 'hide'),
  ('module.designer',                TRUE, 'hide'),
  -- Franqueado
  ('franqueado.catalogo',            TRUE, 'hide'),
  ('franqueado.historico',           TRUE, 'hide'),
  ('franqueado.chat',                TRUE, 'maintenance'),
  ('franqueado.legendas',            TRUE, 'hide'),
  ('franqueado.sheets',              TRUE, 'hide'),
  ('franqueado.export',              TRUE, 'hide'),
  ('franqueado.export.png',          TRUE, 'hide'),
  ('franqueado.export.pdf',          TRUE, 'hide'),
  ('franqueado.export.zip',          TRUE, 'hide'),
  -- Estúdio
  ('designer.tools',                 TRUE, 'hide'),
  ('designer.tools.text',            TRUE, 'hide'),
  ('designer.tools.text.vertical',   TRUE, 'hide'),
  ('designer.tools.text.mask',       TRUE, 'hide'),
  ('designer.tools.shape',           TRUE, 'hide'),
  ('designer.tools.paint',           TRUE, 'hide'),
  ('designer.tools.fill',            TRUE, 'hide'),
  ('designer.tools.effects',         TRUE, 'hide'),
  ('designer.tools.measure',         TRUE, 'hide'),
  ('designer.import',                TRUE, 'hide'),
  ('designer.import.psd',            TRUE, 'hide'),
  ('designer.import.svg',            TRUE, 'hide'),
  ('designer.publish',               TRUE, 'disabled'),
  ('designer.campos',                TRUE, 'hide'),
  ('designer.campanhas',             TRUE, 'hide'),
  ('designer.assets',                TRUE, 'hide'),
  ('designer.checklist',             TRUE, 'hide'),
  -- Global
  ('global.help',                    TRUE, 'hide'),
  ('global.help.chat',               TRUE, 'hide'),
  ('global.tutorials',               TRUE, 'hide')
ON CONFLICT (feature_key) DO NOTHING;

-- ============================================================
-- APÓS APLICAR: conferir com um SELECT (lição do incidente 2026-07-16 —
-- migration versionada e não aplicada quebrou o sync por 5 dias).
--
--   SELECT feature_key, enabled, disabled_behavior FROM luma.feature_flags ORDER BY 1;
--   -- esperado: 32 linhas, todas enabled = true
--
--   SELECT count(*) FROM luma.feature_flag_history;
--   -- esperado: 32 (o próprio seed é o primeiro registro de auditoria)
-- ============================================================
