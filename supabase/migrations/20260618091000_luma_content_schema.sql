-- ============================================================
-- LUMA — Editor de Artes  ·  Migration 2/5: conteúdo do designer
-- Schema `luma`: pastas, templates, variaveis, fontes, snippets, biblioteca_assets
-- ============================================================
--
-- MESCLABILIDADE: todo o domínio do LUMA vive no schema `luma` (não em `public`).
-- Na fusão com o DM CRM, traz-se o schema `luma` inteiro sem colidir com o `public`
-- do CRM. profiles/auth/analytics ficam compartilhados (public/analytics).
--
-- IMPORTANTE p/ o front: como o schema é custom, é preciso (1) expô-lo em
-- Project Settings → API → Exposed schemas e (2) usar sb.schema('luma').from('...')
-- no supabase-js. RLS funciona igual.
--
-- MODELO single-tenant: conteúdo COMPARTILHADO entre todos os designers
-- (espelha o localStorage único). criado_por é só auditoria.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS luma;
GRANT USAGE ON SCHEMA luma TO authenticated;

-- ============================================================
-- luma.pastas — campanhas (yngs_folders_v1, nível pasta)
-- ============================================================
CREATE TABLE luma.pastas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         TEXT NOT NULL,
  cor          TEXT,
  camp_id      TEXT,                       -- id da campanha em js/00-config.js
  cover_url    TEXT,                       -- bucket 'luma-covers'
  badge        TEXT DEFAULT '',
  expira_dias  INT  NOT NULL DEFAULT 7,
  popular      BOOLEAN NOT NULL DEFAULT FALSE,
  preview_prod TEXT DEFAULT '',
  preview_de   TEXT DEFAULT '',
  preview_por  TEXT DEFAULT '',
  perguntas    JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{id,texto,sugestoes:[]}]
  grupos       JSONB NOT NULL DEFAULT '["Todos os usuários"]'::jsonb,
  agendamento  JSONB,
  ordem        INT  NOT NULL DEFAULT 0,
  ativa        BOOLEAN NOT NULL DEFAULT TRUE,
  criado_por   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_pastas_camp_id ON luma.pastas(camp_id);

-- ============================================================
-- luma.templates — materiais publicados. publishMeta ABERTO em colunas
-- (publicado/validade são colunas reais: a RLS do franqueado filtra por elas).
-- ============================================================
CREATE TABLE luma.templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pasta_id     UUID NOT NULL REFERENCES luma.pastas(id) ON DELETE CASCADE,
  nome         TEXT NOT NULL,
  fmt          TEXT NOT NULL,                          -- story | feed | post
  formats      JSONB NOT NULL DEFAULT '["story","feed","wide"]'::jsonb,
  layers       JSONB NOT NULL DEFAULT '[]'::jsonb,     -- imagens apontam p/ Storage
  publicado    BOOLEAN NOT NULL DEFAULT FALSE,
  publicado_em TIMESTAMPTZ,
  validade     DATE,                                   -- NULL = sem validade
  instrucoes   TEXT NOT NULL DEFAULT '',
  permissoes   JSONB NOT NULL DEFAULT '{}'::jsonb,     -- {varName:{edit,maxLen}}
  thumb_url    TEXT,
  criado_por   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_templates_pasta      ON luma.templates(pasta_id);
CREATE INDEX idx_templates_publicados ON luma.templates(publicado, validade);

-- ============================================================
-- luma.variaveis — catálogo dVars (yngs_vars_v1). Único e compartilhado.
-- ============================================================
CREATE TABLE luma.variaveis (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,                  -- chave do {{token}}
  label         TEXT,
  type          TEXT NOT NULL DEFAULT 'text'
                  CHECK (type IN ('text','number','currency','image','select','date','color','boolean')),
  default_value TEXT,
  required      BOOLEAN NOT NULL DEFAULT FALSE,
  options       JSONB,        -- select
  palette       JSONB,        -- color (hex[])
  max_len       INT,
  category      TEXT,         -- produto|preco|campanha|midia|outros
  ordem         INT NOT NULL DEFAULT 0,
  criado_por    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- luma.fontes — fontes enviadas (yngs_fonts_v1). Arquivo no bucket 'luma-fontes'.
-- ============================================================
CREATE TABLE luma.fontes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family       TEXT NOT NULL,            -- custom:Família no front
  formato      TEXT,                     -- ttf | otf | woff | woff2
  arquivo_url  TEXT NOT NULL,            -- bucket 'luma-fontes'
  criado_por   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- luma.snippets — blocos reutilizáveis (yngs_snippets_v1)
-- ============================================================
CREATE TABLE luma.snippets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         TEXT NOT NULL,
  layers       JSONB NOT NULL DEFAULT '[]'::jsonb,
  criado_por   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- luma.biblioteca_assets — imagens da biblioteca do designer
-- ============================================================
CREATE TABLE luma.biblioteca_assets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         TEXT,
  categoria    TEXT,
  url          TEXT NOT NULL,            -- bucket 'luma-template-assets'
  tipo         TEXT,                     -- image | svg
  criado_por   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================
CREATE TRIGGER touch_pastas_updated    BEFORE UPDATE ON luma.pastas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_templates_updated BEFORE UPDATE ON luma.templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_variaveis_updated BEFORE UPDATE ON luma.variaveis
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_snippets_updated  BEFORE UPDATE ON luma.snippets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- GRANTS — schema custom não tem default-privileges do Supabase.
-- Concede ao role `authenticated`; a RLS abaixo faz o controle fino.
-- (anon fica de fora: o LUMA exige login pra ver qualquer coisa.)
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA luma TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA luma
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE luma.pastas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE luma.templates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE luma.variaveis          ENABLE ROW LEVEL SECURITY;
ALTER TABLE luma.fontes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE luma.snippets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE luma.biblioteca_assets  ENABLE ROW LEVEL SECURITY;

-- ── pastas ── designer vê todas; franqueado só as ativas
CREATE POLICY "franqueado vê pastas ativas; designer vê todas"
  ON luma.pastas FOR SELECT
  USING (public.is_designer() OR (auth.uid() IS NOT NULL AND ativa = TRUE));
CREATE POLICY "designer gerencia pastas"
  ON luma.pastas FOR ALL
  USING (public.is_designer()) WITH CHECK (public.is_designer());

-- ── templates ── designer vê tudo; franqueado só publicado e não-vencido
CREATE POLICY "franqueado vê templates publicados; designer vê todos"
  ON luma.templates FOR SELECT
  USING (
    public.is_designer()
    OR (publicado = TRUE AND (validade IS NULL OR validade >= CURRENT_DATE))
  );
CREATE POLICY "designer gerencia templates"
  ON luma.templates FOR ALL
  USING (public.is_designer()) WITH CHECK (public.is_designer());

-- ── variaveis ── franqueado lê (precisa do tipo); designer escreve
CREATE POLICY "autenticado lê variaveis"
  ON luma.variaveis FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "designer gerencia variaveis"
  ON luma.variaveis FOR ALL
  USING (public.is_designer()) WITH CHECK (public.is_designer());

-- ── fontes ── franqueado lê (PNG usa fontes custom); designer escreve
CREATE POLICY "autenticado lê fontes"
  ON luma.fontes FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "designer gerencia fontes"
  ON luma.fontes FOR ALL
  USING (public.is_designer()) WITH CHECK (public.is_designer());

-- ── snippets / biblioteca ── só designer
CREATE POLICY "designer gerencia snippets"
  ON luma.snippets FOR ALL
  USING (public.is_designer()) WITH CHECK (public.is_designer());
CREATE POLICY "designer gerencia biblioteca"
  ON luma.biblioteca_assets FOR ALL
  USING (public.is_designer()) WITH CHECK (public.is_designer());
