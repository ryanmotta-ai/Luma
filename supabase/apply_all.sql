-- LUMA — script único (6 migrations + seed) p/ colar no SQL Editor.
-- Banco PRÓPRIO do LUMA, desenhado pra fundir no DM CRM. Rode num projeto LIMPO.
-- Depois: exponha 'luma' e 'analytics' em Settings>API>Exposed schemas.

-- ============================================================
-- ARQUIVO: migrations/20260618090000_luma_initial_schema.sql
-- ============================================================
-- ============================================================
-- LUMA — Editor de Artes (Delivery Much)  ·  Fase 5.1 backend
-- Migration 1/5: profiles + helpers de role + RLS base
-- ============================================================
--
-- CONTEXTO: front Vanilla JS falando DIRETO com o Supabase via supabase-js
-- (anon key PÚBLICA). Sem Server Action no meio → a RLS é a ÚNICA fronteira
-- de segurança.
--
-- MESCLABILIDADE (decisão de projeto): o LUMA roda hoje num banco PRÓPRIO,
-- mas é desenhado pra fundir no projeto do DM CRM no futuro com mínimo atrito:
--   • profiles, roles e helpers ESPELHAM o DM CRM (ver docs/LUMA-BACK_CONTEXT.md);
--   • o domínio do LUMA vive no schema `luma.*` (migrations 2/3), isolado do `public`;
--   • buckets prefixados `luma-` (migration 5);
--   • analytics.fct_eventos idêntico ao do CRM (migration 4).
-- Na fusão: traz-se o schema `luma` inteiro e os profiles coincidem.
--
-- ROLES (idênticos ao CRM) — 3 valores, 2 personas no LUMA:
--   'franqueado'           → persona Franqueado (consome catálogo, gera artes)
--   'equipe_dm' / 'gestao' → persona Designer (cria/publica) — helper is_designer()
--   'gestao'               → também gerencia roles/usuários (topo)
-- ============================================================

-- ============================================================
-- PROFILES — estende auth.users. Estrutura idêntica à do DM CRM.
-- ============================================================
CREATE TABLE public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome         TEXT NOT NULL,
  email        TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'franqueado'
                 CHECK (role IN ('franqueado', 'equipe_dm', 'gestao')),
  departamento TEXT,                                  -- usado por equipe_dm (igual ao CRM)
  avatar_url   TEXT,
  ativo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.profiles IS 'Perfil de usuário. Espelha o DM CRM p/ fusão futura.';
COMMENT ON COLUMN public.profiles.role IS 'franqueado | equipe_dm | gestao. Promoção a designer é MANUAL (ver README).';

-- ============================================================
-- HELPERS de role (usados por toda a RLS). Assinaturas idênticas às do CRM
-- (CREATE OR REPLACE → na fusão coincidem, não conflitam).
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Exclusivo do LUMA (o CRM não tem) → sem colisão na fusão.
CREATE OR REPLACE FUNCTION public.is_designer()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role IN ('equipe_dm', 'gestao') FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

-- ============================================================
-- TRIGGER: cria profile ao cadastrar usuário.
-- SEGURANÇA: role SEMPRE 'franqueado' — NÃO confiamos em metadata->>'role'
-- (com a anon key qualquer um faz signup; confiar seria escalonamento).
-- NOTA p/ fusão: o handle_new_user do CRM confia no metadata; ao fundir,
-- prevaleça ESTA versão (mais segura) ou alinhe a política de signup.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    'franqueado'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TRIGGER: só 'gestao' pode alterar a coluna role (de qualquer perfil).
-- Fecha o "UPDATE no próprio profile setando role=gestao".
-- ============================================================
CREATE OR REPLACE FUNCTION public.guard_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- auth.uid() NULL = contexto de servidor (service_role / SQL Editor): confiado.
    IF auth.uid() IS NOT NULL AND COALESCE(public.get_user_role(), '') <> 'gestao' THEN
      RAISE EXCEPTION 'Apenas gestao pode alterar o role de um perfil.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_profile_role_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role();

-- ============================================================
-- HELPER genérico: toca updated_at (reusado pelas migrations 2/3).
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER touch_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- RLS — profiles
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario lê próprio perfil; designer lê todos"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.is_designer());

-- O próprio usuário (sem mexer em role — bloqueado pelo guard) ou gestao (qualquer um).
CREATE POLICY "usuario atualiza próprio perfil; gestao atualiza todos"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid() OR public.get_user_role() = 'gestao')
  WITH CHECK (id = auth.uid() OR public.get_user_role() = 'gestao');

-- Sem policy de INSERT (perfis nascem só pelo trigger, que é DEFINER).
-- Sem policy de DELETE (cascata via auth.users).


-- ============================================================
-- ARQUIVO: migrations/20260618091000_luma_content_schema.sql
-- ============================================================
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


-- ============================================================
-- ARQUIVO: migrations/20260618092000_luma_artes_schema.sql
-- ============================================================
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


-- ============================================================
-- ARQUIVO: migrations/20260618093000_analytics_schema.sql
-- ============================================================
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


-- ============================================================
-- ARQUIVO: migrations/20260618094000_storage_buckets.sql
-- ============================================================
-- ============================================================
-- LUMA — Editor de Artes  ·  Migration 5/5: Storage (object storage)
-- ============================================================
--
-- Resolve o maior gargalo do produto: hoje imagens >70KB viram '__local__'
-- (gPackImgUrl) e SOMEM no reload. Com Storage, o layer JSON guarda só a URL.
--
-- MESCLABILIDADE: buckets prefixados `luma-` → não colidem com buckets do CRM
-- (ex.: 'comunicados') quando os projetos forem fundidos.
--
-- BUCKETS:
--   luma-covers          (PÚBLICO)  capas de pasta + thumbs de template
--   luma-template-assets (PÚBLICO)  imagens fixas em templates + biblioteca
--   luma-fontes          (PÚBLICO)  arquivos de fonte (via FontFace por URL)
--   luma-user-uploads    (PRIVADO)  fotos do franqueado (foto_produto, logo_loja)
--   luma-renders         (PRIVADO)  PNG/PDF finais (podem conter foto do franqueado)
--
-- Públicos: leitura aberta (getPublicUrl → URL estável p/ <img>/canvas/FontFace),
-- escrita só do designer. Privados: leitura/escrita só do dono; caminho '<uid>/arquivo'.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('luma-covers',          'luma-covers',          TRUE,   5 * 1024 * 1024),
  ('luma-template-assets', 'luma-template-assets', TRUE,  10 * 1024 * 1024),
  ('luma-fontes',          'luma-fontes',          TRUE,   3 * 1024 * 1024),
  ('luma-user-uploads',    'luma-user-uploads',    FALSE,  8 * 1024 * 1024),
  ('luma-renders',         'luma-renders',         FALSE, 15 * 1024 * 1024)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- POLICIES — buckets PÚBLICOS (leitura pública pelo flag; escrita só designer)
-- ============================================================
CREATE POLICY "designer envia em buckets luma públicos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id IN ('luma-covers', 'luma-template-assets', 'luma-fontes')
    AND public.is_designer()
  );

CREATE POLICY "designer atualiza em buckets luma públicos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id IN ('luma-covers', 'luma-template-assets', 'luma-fontes')
    AND public.is_designer()
  );

CREATE POLICY "designer apaga em buckets luma públicos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id IN ('luma-covers', 'luma-template-assets', 'luma-fontes')
    AND public.is_designer()
  );

-- ============================================================
-- POLICIES — buckets PRIVADOS (dono only; caminho '<uid>/arquivo')
-- ============================================================
CREATE POLICY "dono lê seus uploads luma privados"
  ON storage.objects FOR SELECT
  USING (
    bucket_id IN ('luma-user-uploads', 'luma-renders')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "dono envia em pasta própria luma"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id IN ('luma-user-uploads', 'luma-renders')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "dono atualiza seus uploads luma privados"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id IN ('luma-user-uploads', 'luma-renders')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "dono apaga seus uploads luma privados"
  ON storage.objects FOR DELETE
  USING (
    bucket_id IN ('luma-user-uploads', 'luma-renders')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ============================================================
-- ARQUIVO: migrations/20260618095000_luma_hardening.sql
-- ============================================================
-- ============================================================
-- LUMA — Editor de Artes  ·  Migration 6/6: hardening pós-auditoria
-- ============================================================
--
-- Aplica ao LUMA as lições dos achados do DM CRM (docs/LUMA-REGRAS_BACKEND.md §11/§12).
-- Idempotente (CREATE OR REPLACE / IF EXISTS) — pode rodar sozinha no SQL Editor.
-- ============================================================

-- ------------------------------------------------------------
-- §11.1 (reforço) — guard de auto-modificação de campos privilegiados.
-- Além de 'role', bloqueia 'departamento' e 'ativo' p/ quem não é gestao.
-- (CREATE OR REPLACE sobrescreve a versão da migration 1.)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.role         IS DISTINCT FROM OLD.role
      OR NEW.departamento IS DISTINCT FROM OLD.departamento
      OR NEW.ativo        IS DISTINCT FROM OLD.ativo) THEN
    -- auth.uid() NULL = contexto de servidor (service_role / SQL Editor): confiado.
    IF auth.uid() IS NOT NULL AND COALESCE(public.get_user_role(), '') <> 'gestao' THEN
      RAISE EXCEPTION 'Apenas gestao pode alterar role/departamento/ativo de um perfil.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- §11.14 — o cliente NÃO controla a identidade do evento de analytics.
-- Trigger força user_id = auth.uid() e role = role real do profiles,
-- ignorando o que o front mandar (anti-spoofing de role/usuário).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION analytics.evt_forca_identidade()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.user_id := auth.uid();
  NEW.role    := (SELECT role FROM public.profiles WHERE id = auth.uid());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS evt_forca_identidade_trg ON analytics.fct_eventos;
CREATE TRIGGER evt_forca_identidade_trg
  BEFORE INSERT ON analytics.fct_eventos
  FOR EACH ROW EXECUTE FUNCTION analytics.evt_forca_identidade();

-- ------------------------------------------------------------
-- §12.15 — teto de tamanho do payload de evento (anti-DoS de storage).
-- ------------------------------------------------------------
ALTER TABLE analytics.fct_eventos DROP CONSTRAINT IF EXISTS fct_eventos_payload_max;
ALTER TABLE analytics.fct_eventos ADD  CONSTRAINT fct_eventos_payload_max
  CHECK (payload IS NULL OR pg_column_size(payload) < 8192);


-- ============================================================
-- ARQUIVO: seed.sql
-- ============================================================
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


