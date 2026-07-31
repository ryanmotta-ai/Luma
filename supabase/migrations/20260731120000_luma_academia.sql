-- ============================================================
-- LUMA — ACADEMIA DELIVERY MUCH · formação e implementação do franqueado
-- ============================================================
--
-- O QUE ESTA MIGRATION RESOLVE: a implementação de um franqueado novo é hoje
-- um processo fora do Luma (planilha + reunião + PDF solto). Aqui ela passa a
-- ser uma jornada com progresso persistente, materiais, anotações, agente
-- educacional e certificado — no mesmo produto onde ele já cria as artes.
--
-- ONDE MORA: schema `luma` (como todo domínio do Luma), nomes em PT-BR como as
-- tabelas existentes (pastas/templates/artes). Na fusão com o DM CRM vem junto
-- com o resto do schema, sem colidir com o `public` do CRM.
--
-- MODELO (8 tabelas — deliberadamente menos que o desenho conceitual):
--   CONTEÚDO (escrita só equipe_dm/gestao via is_designer())
--     luma.cursos           → a formação (versão, carga horária, critérios)
--     luma.curso_modulos    → etapas ordenadas, com pré-requisito
--     luma.curso_aulas      → aulas ordenadas; transcrição, materiais e
--                             atividade são JSONB na própria aula (não valem
--                             tabela: ninguém consulta uma alternativa de
--                             pergunta isolada, elas só viajam com a aula)
--   PROGRESSO (escrita do próprio dono)
--     luma.matriculas       → curso iniciado/concluído por usuário
--     luma.aula_progresso   → posição do vídeo, % assistido, conclusão, salva
--     luma.aula_notas       → anotações pessoais (PRIVADAS até da equipe)
--     luma.aula_mensagens   → conversa com o agente (PRIVADA até da equipe)
--   PROVA
--     luma.certificados     → emissão registrada em dados, não só o arquivo
--
-- SEGURANÇA — o ponto sensível é o certificado. O franqueado ESCREVE o próprio
-- progresso (precisa), então quem valida a conclusão não pode ser o cliente:
-- `luma.certificados` NÃO tem policy de INSERT/UPDATE/DELETE (RLS sem policy =
-- deny-all) e a emissão só acontece dentro de luma.ac_emitir_certificado(),
-- SECURITY DEFINER, que re-checa as aulas obrigatórias no servidor.
-- ⚠ Teto assumido e honesto: um franqueado com DevTools consegue marcar as
-- próprias aulas como concluídas e assim satisfazer a função. O que ele NÃO
-- consegue é forjar um certificado sem esse rastro, nem emitir para outra
-- pessoa. Fechar o teto exigiria progresso escrito só por RPC com heurística
-- de tempo real assistido — decisão de produto, não desta migration.
-- ============================================================

-- ============================================================
-- 1) CURSOS
-- ============================================================
CREATE TABLE luma.cursos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT NOT NULL UNIQUE,              -- 'formacao-franqueado'
  nome              TEXT NOT NULL,
  descricao         TEXT NOT NULL DEFAULT '',
  objetivo          TEXT NOT NULL DEFAULT '',
  capa_url          TEXT,                              -- bucket 'luma-covers'
  carga_horaria_min INT,                               -- NULL = não divulgada no certificado
  -- versao: sobe só em mudança GRANDE de conteúdo. O certificado guarda a versão
  -- concluída, então subir aqui não invalida formação antiga — cria uma nova.
  versao            INT NOT NULL DEFAULT 1,
  -- criterios: {pct_min: 0.85} = quanto do vídeo conta como assistido.
  -- Aula obrigatória vem de curso_aulas.obrigatoria, não daqui.
  criterios         JSONB NOT NULL DEFAULT '{"pct_min":0.85}'::jsonb,
  -- certificado: {assinaturas:[{nome,cargo}], mensagem}
  certificado       JSONB NOT NULL DEFAULT '{}'::jsonb,
  publicado         BOOLEAN NOT NULL DEFAULT FALSE,
  publicado_em      TIMESTAMPTZ,
  ordem             INT NOT NULL DEFAULT 0,
  criado_por        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE luma.cursos IS 'Academia DM: uma formação. Franqueado só vê publicado=true.';

-- ============================================================
-- 2) MÓDULOS
-- ============================================================
CREATE TABLE luma.curso_modulos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id         UUID NOT NULL REFERENCES luma.cursos(id) ON DELETE CASCADE,
  nome             TEXT NOT NULL,
  descricao        TEXT NOT NULL DEFAULT '',
  ordem            INT  NOT NULL DEFAULT 0,
  publicado        BOOLEAN NOT NULL DEFAULT FALSE,
  -- ON DELETE SET NULL: apagar um módulo não pode travar a jornada inteira
  -- deixando o seguinte com pré-requisito órfão e inalcançável.
  prereq_modulo_id UUID REFERENCES luma.curso_modulos(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ac_modulos_curso ON luma.curso_modulos(curso_id, ordem);

-- ============================================================
-- 3) AULAS
-- ============================================================
CREATE TABLE luma.curso_aulas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- curso_id repetido de propósito (o módulo já liga ao curso): a RLS e a home
  -- filtram aula por curso sem JOIN, e o trigger abaixo garante que os dois
  -- caminhos nunca divergem.
  curso_id      UUID NOT NULL REFERENCES luma.cursos(id) ON DELETE CASCADE,
  modulo_id     UUID NOT NULL REFERENCES luma.curso_modulos(id) ON DELETE CASCADE,
  titulo        TEXT NOT NULL,
  descricao     TEXT NOT NULL DEFAULT '',
  objetivo      TEXT NOT NULL DEFAULT '',
  resumo        TEXT NOT NULL DEFAULT '',
  -- Vídeo: DOIS caminhos possíveis, nunca os dois ao mesmo tempo na prática.
  --   video_path = arquivo no bucket PRIVADO 'luma-aulas' (upload pela equipe)
  --   video_url  = MP4 já hospedado em outro lugar (link colado pela equipe)
  -- Guardar o path (não a URL) é o que permite trocar de assinatura/CDN depois
  -- sem reescrever linha nenhuma.
  video_path    TEXT,
  video_url     TEXT,
  video_mime    TEXT,
  duracao_seg   INT,
  thumb_url     TEXT,
  -- transcricao: [{t: 272, texto: "..."}] — t em segundos, permite clicar e ir
  -- ao ponto do vídeo. Sem timestamp o agente NÃO cita minutagem (não inventa).
  transcricao   JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- materiais: [{id,tipo,titulo,url,path,tamanho}] tipo = pdf|doc|planilha|link|checklist
  materiais     JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- atividade: {tipo:'quiz'|'checklist', titulo, itens:[{id,enunciado,opcoes:[],correta,explicacao}]}
  atividade     JSONB NOT NULL DEFAULT '{}'::jsonb,
  obrigatoria   BOOLEAN NOT NULL DEFAULT TRUE,
  ordem         INT  NOT NULL DEFAULT 0,
  publicado     BOOLEAN NOT NULL DEFAULT FALSE,
  publicado_em  TIMESTAMPTZ,
  -- conteudo_versao: a equipe sobe quando a aula muda de forma relevante. Quem
  -- já concluiu NÃO perde a conclusão (regra do produto) — a aula só aparece
  -- marcada como "atualizada" comparando com aula_progresso.visto_conteudo_versao.
  conteudo_versao INT NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ac_aulas_modulo ON luma.curso_aulas(modulo_id, ordem);
CREATE INDEX idx_ac_aulas_curso  ON luma.curso_aulas(curso_id, publicado);

-- Guarda de integridade: aula.curso_id TEM de ser o curso do seu módulo.
-- Sem isto, um UPDATE errado na gestão faria a aula aparecer em outra formação
-- (a home lista por curso_id) enquanto a sidebar a mostraria no módulo antigo.
CREATE OR REPLACE FUNCTION luma.ac_guard_aula_curso()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE v_curso UUID;
BEGIN
  SELECT curso_id INTO v_curso FROM luma.curso_modulos WHERE id = NEW.modulo_id;
  IF v_curso IS NULL THEN
    RAISE EXCEPTION 'Módulo % não existe.', NEW.modulo_id;
  END IF;
  NEW.curso_id := v_curso;   -- corrige em vez de recusar: a fonte é o módulo
  RETURN NEW;
END;
$$;
CREATE TRIGGER ac_guard_aula_curso_trg
  BEFORE INSERT OR UPDATE OF modulo_id, curso_id ON luma.curso_aulas
  FOR EACH ROW EXECUTE FUNCTION luma.ac_guard_aula_curso();

-- ============================================================
-- 4) MATRÍCULAS (curso iniciado / concluído por usuário)
-- ============================================================
CREATE TABLE luma.matriculas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  curso_id       UUID NOT NULL REFERENCES luma.cursos(id) ON DELETE CASCADE,
  iniciado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultimo_acesso  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultima_aula_id UUID REFERENCES luma.curso_aulas(id) ON DELETE SET NULL,
  concluido_em   TIMESTAMPTZ,          -- escrito só pela função de emissão
  curso_versao   INT,                  -- versão vigente quando concluiu
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, curso_id)
);
CREATE INDEX idx_ac_matriculas_curso ON luma.matriculas(curso_id, concluido_em);

-- ============================================================
-- 5) PROGRESSO POR AULA
-- ============================================================
CREATE TABLE luma.aula_progresso (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  curso_id      UUID NOT NULL REFERENCES luma.cursos(id) ON DELETE CASCADE,
  aula_id       UUID NOT NULL REFERENCES luma.curso_aulas(id) ON DELETE CASCADE,
  posicao_seg   INT  NOT NULL DEFAULT 0,          -- retomar de onde parou
  pct_assistido NUMERIC(5,4) NOT NULL DEFAULT 0,  -- 0..1
  concluida     BOOLEAN NOT NULL DEFAULT FALSE,
  concluida_em  TIMESTAMPTZ,
  salva         BOOLEAN NOT NULL DEFAULT FALSE,   -- "salvar para revisar"
  revisitada_em TIMESTAMPTZ,                      -- revisão pós-formação (não altera concluida)
  -- visto_conteudo_versao: qual versão da aula esta pessoa viu. Menor que a
  -- versão atual da aula = badge "atualizada", sem tocar na conclusão.
  visto_conteudo_versao INT NOT NULL DEFAULT 1,
  -- tentativas: [{em, acertos, total, respostas:{itemId:valor}}]
  tentativas    JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, aula_id)
);
CREATE INDEX idx_ac_prog_user_curso ON luma.aula_progresso(user_id, curso_id);
CREATE INDEX idx_ac_prog_curso      ON luma.aula_progresso(curso_id, concluida);

-- ============================================================
-- 6) ANOTAÇÕES PESSOAIS  (privadas — nem a equipe lê)
-- ============================================================
CREATE TABLE luma.aula_notas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  curso_id   UUID NOT NULL REFERENCES luma.cursos(id) ON DELETE CASCADE,
  aula_id    UUID NOT NULL REFERENCES luma.curso_aulas(id) ON DELETE CASCADE,
  texto      TEXT NOT NULL,
  video_seg  INT,                     -- NULL = nota da aula, não de um momento
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ac_notas_user_aula ON luma.aula_notas(user_id, aula_id, created_at DESC);

-- ============================================================
-- 7) CONVERSA COM O AGENTE  (privada — nem a equipe lê)
-- ============================================================
CREATE TABLE luma.aula_mensagens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aula_id    UUID NOT NULL REFERENCES luma.curso_aulas(id) ON DELETE CASCADE,
  papel      TEXT NOT NULL CHECK (papel IN ('usuario','agente')),
  texto      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ac_msgs_user_aula ON luma.aula_mensagens(user_id, aula_id, created_at);

-- ============================================================
-- 8) CERTIFICADOS
-- ============================================================
CREATE TABLE luma.certificados (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  curso_id          UUID NOT NULL REFERENCES luma.cursos(id) ON DELETE CASCADE,
  codigo            TEXT NOT NULL UNIQUE,      -- código de validação (LUMA-XXXX-XXXX)
  -- Snapshot no momento da emissão: reemitir o PDF anos depois não pode depender
  -- de o curso ainda existir com o mesmo nome nem de o perfil ter o mesmo nome.
  nome_completo     TEXT NOT NULL,
  curso_nome        TEXT NOT NULL,
  curso_versao      INT  NOT NULL,
  carga_horaria_min INT,
  concluido_em      TIMESTAMPTZ NOT NULL,
  emitido_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dados             JSONB NOT NULL DEFAULT '{}'::jsonb,  -- assinaturas, totais de aulas
  UNIQUE (user_id, curso_id, curso_versao)
);
COMMENT ON TABLE luma.certificados IS
  'Emissão registrada em DADOS (reconstitui o PDF). Sem policy de INSERT: só luma.ac_emitir_certificado() escreve.';

-- ============================================================
-- TRIGGERS updated_at (reusa public.touch_updated_at do schema inicial)
-- ============================================================
CREATE TRIGGER touch_ac_cursos_updated   BEFORE UPDATE ON luma.cursos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_ac_modulos_updated  BEFORE UPDATE ON luma.curso_modulos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_ac_aulas_updated    BEFORE UPDATE ON luma.curso_aulas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_ac_matriculas_updated BEFORE UPDATE ON luma.matriculas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_ac_prog_updated     BEFORE UPDATE ON luma.aula_progresso
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_ac_notas_updated    BEFORE UPDATE ON luma.aula_notas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- GRANTS — schema custom não herda default-privileges do Supabase.
-- (o ALTER DEFAULT PRIVILEGES da migration 2/5 já cobre tabelas novas, mas
--  repetimos explícito: se aquele comando não tiver sido aplicado, RLS sem
--  grant vira "permission denied" e a feature quebra em silêncio.)
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON
  luma.cursos, luma.curso_modulos, luma.curso_aulas,
  luma.matriculas, luma.aula_progresso, luma.aula_notas, luma.aula_mensagens
  TO authenticated;
-- Certificado: SELECT só. Escrita é exclusividade da função DEFINER.
GRANT SELECT ON luma.certificados TO authenticated;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE luma.cursos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE luma.curso_modulos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE luma.curso_aulas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE luma.matriculas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE luma.aula_progresso  ENABLE ROW LEVEL SECURITY;
ALTER TABLE luma.aula_notas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE luma.aula_mensagens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE luma.certificados    ENABLE ROW LEVEL SECURITY;

-- ── CONTEÚDO ──
-- Rascunho é invisível pro franqueado (mesma regra de luma.templates).
-- (select auth.uid()) entre parênteses: initplan, o padrão de perf desta base
-- (ver 20260622130000_luma_perf_rls_initplan.sql).
CREATE POLICY "franqueado vê cursos publicados; designer vê todos"
  ON luma.cursos FOR SELECT
  USING ((select public.is_designer()) OR ((select auth.uid()) IS NOT NULL AND publicado = TRUE));
CREATE POLICY "designer gerencia cursos"
  ON luma.cursos FOR ALL
  USING ((select public.is_designer())) WITH CHECK ((select public.is_designer()));

CREATE POLICY "franqueado vê módulos publicados; designer vê todos"
  ON luma.curso_modulos FOR SELECT
  USING (
    (select public.is_designer())
    OR ((select auth.uid()) IS NOT NULL AND publicado = TRUE
        AND EXISTS (SELECT 1 FROM luma.cursos c WHERE c.id = curso_id AND c.publicado))
  );
CREATE POLICY "designer gerencia módulos"
  ON luma.curso_modulos FOR ALL
  USING ((select public.is_designer())) WITH CHECK ((select public.is_designer()));

CREATE POLICY "franqueado vê aulas publicadas; designer vê todas"
  ON luma.curso_aulas FOR SELECT
  USING (
    (select public.is_designer())
    OR ((select auth.uid()) IS NOT NULL AND publicado = TRUE
        AND EXISTS (
          SELECT 1 FROM luma.curso_modulos m JOIN luma.cursos c ON c.id = m.curso_id
          WHERE m.id = modulo_id AND m.publicado AND c.publicado
        ))
  );
CREATE POLICY "designer gerencia aulas"
  ON luma.curso_aulas FOR ALL
  USING ((select public.is_designer())) WITH CHECK ((select public.is_designer()));

-- ── PROGRESSO ── dono escreve; equipe LÊ (acompanhar a formação da rede).
-- WITH CHECK em todo UPDATE/INSERT: sem ele o dono poderia gravar linha em nome
-- de outro user_id (policy de UPDATE sem WITH CHECK é a armadilha clássica).
CREATE POLICY "dono lê sua matrícula; designer lê todas"
  ON luma.matriculas FOR SELECT
  USING (user_id = (select auth.uid()) OR (select public.is_designer()));
CREATE POLICY "dono cria matrícula própria"
  ON luma.matriculas FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "dono atualiza matrícula própria"
  ON luma.matriculas FOR UPDATE
  USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "dono lê seu progresso; designer lê todos"
  ON luma.aula_progresso FOR SELECT
  USING (user_id = (select auth.uid()) OR (select public.is_designer()));
CREATE POLICY "dono cria progresso próprio"
  ON luma.aula_progresso FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "dono atualiza progresso próprio"
  ON luma.aula_progresso FOR UPDATE
  USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

-- ── PRIVADO DE VERDADE ── anotação e conversa: só o dono, nem is_designer().
-- (Anotação de estudo e dúvida crua são material de aprendizado, não de gestão.)
CREATE POLICY "dono gerencia suas anotações"
  ON luma.aula_notas FOR ALL
  USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "dono gerencia suas mensagens"
  ON luma.aula_mensagens FOR ALL
  USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

-- ── CERTIFICADOS ── leitura do dono + equipe (conferir formação da rede).
-- SEM policy de INSERT/UPDATE/DELETE de propósito → cliente não forja nem apaga.
CREATE POLICY "dono lê seu certificado; designer lê todos"
  ON luma.certificados FOR SELECT
  USING (user_id = (select auth.uid()) OR (select public.is_designer()));

-- ============================================================
-- FUNÇÃO DE EMISSÃO — a única porta de escrita do certificado.
-- SECURITY DEFINER + search_path fixo (padrão de 20260619100000_harden_definer_functions).
-- Idempotente: chamar de novo devolve o certificado que já existe (reemissão
-- não gera código novo — o código é a identidade do documento).
-- ============================================================
CREATE OR REPLACE FUNCTION luma.ac_emitir_certificado(p_curso UUID)
RETURNS luma.certificados
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_curso     luma.cursos;
  v_pct_min   NUMERIC;
  v_faltam    INT;
  v_total     INT;
  v_concl     TIMESTAMPTZ;
  v_nome      TEXT;
  v_cert      luma.certificados;
  v_codigo    TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Faça login para emitir o certificado.';
  END IF;

  SELECT * INTO v_curso FROM luma.cursos WHERE id = p_curso AND publicado;
  IF v_curso.id IS NULL THEN
    RAISE EXCEPTION 'Formação não encontrada ou ainda não publicada.';
  END IF;

  -- Já emitido nesta versão? Devolve o mesmo (reemissão pede o MESMO documento).
  SELECT * INTO v_cert FROM luma.certificados
   WHERE user_id = v_uid AND curso_id = p_curso AND curso_versao = v_curso.versao;
  IF v_cert.id IS NOT NULL THEN
    RETURN v_cert;
  END IF;

  v_pct_min := COALESCE((v_curso.criterios->>'pct_min')::NUMERIC, 0.85);

  -- Requisito: TODA aula obrigatória publicada (de módulo publicado) concluída.
  -- Aula sem vídeo (duracao_seg NULL/0) não exige pct — o critério dela é a
  -- marcação de conclusão, senão aula só de leitura travaria a formação.
  SELECT COUNT(*) INTO v_total
    FROM luma.curso_aulas a
    JOIN luma.curso_modulos m ON m.id = a.modulo_id
   WHERE a.curso_id = p_curso AND a.publicado AND m.publicado AND a.obrigatoria;

  IF v_total = 0 THEN
    RAISE EXCEPTION 'Esta formação ainda não tem aulas obrigatórias publicadas.';
  END IF;

  SELECT COUNT(*) INTO v_faltam
    FROM luma.curso_aulas a
    JOIN luma.curso_modulos m ON m.id = a.modulo_id
    LEFT JOIN luma.aula_progresso p
           ON p.aula_id = a.id AND p.user_id = v_uid
   WHERE a.curso_id = p_curso AND a.publicado AND m.publicado AND a.obrigatoria
     AND (
       p.id IS NULL
       OR NOT p.concluida
       OR (COALESCE(a.duracao_seg,0) > 0 AND p.pct_assistido < v_pct_min)
     );

  IF v_faltam > 0 THEN
    RAISE EXCEPTION 'Ainda faltam % aula(s) obrigatória(s) para concluir a formação.', v_faltam;
  END IF;

  SELECT MAX(p.concluida_em) INTO v_concl
    FROM luma.aula_progresso p
    JOIN luma.curso_aulas a ON a.id = p.aula_id
   WHERE p.user_id = v_uid AND a.curso_id = p_curso AND p.concluida;
  v_concl := COALESCE(v_concl, NOW());

  SELECT COALESCE(NULLIF(TRIM(nome), ''), email) INTO v_nome
    FROM public.profiles WHERE id = v_uid;
  v_nome := COALESCE(v_nome, 'Franqueado Delivery Much');

  -- Código de validação legível ao telefone: LUMA-XXXX-XXXX, sem 0/O/1/I.
  -- Loop porque é aleatório: colisão é improvável, não impossível.
  LOOP
    SELECT 'LUMA-' ||
           string_agg(substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ',
                             1 + floor(random()*32)::int, 1), '')
      INTO v_codigo FROM generate_series(1,4);
    SELECT v_codigo || '-' ||
           string_agg(substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ',
                             1 + floor(random()*32)::int, 1), '')
      INTO v_codigo FROM generate_series(1,4);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM luma.certificados WHERE codigo = v_codigo);
  END LOOP;

  -- Matrícula recebe a conclusão junto (a home passa pro modo pós-formação).
  INSERT INTO luma.matriculas (user_id, curso_id, concluido_em, curso_versao)
       VALUES (v_uid, p_curso, v_concl, v_curso.versao)
  ON CONFLICT (user_id, curso_id) DO UPDATE
     SET concluido_em = COALESCE(matriculas.concluido_em, EXCLUDED.concluido_em),
         curso_versao = EXCLUDED.curso_versao,
         updated_at   = NOW();

  INSERT INTO luma.certificados
    (user_id, curso_id, codigo, nome_completo, curso_nome, curso_versao,
     carga_horaria_min, concluido_em, dados)
  VALUES
    (v_uid, p_curso, v_codigo, v_nome, v_curso.nome, v_curso.versao,
     v_curso.carga_horaria_min, v_concl,
     jsonb_build_object(
       'aulas_obrigatorias', v_total,
       'assinaturas', COALESCE(v_curso.certificado->'assinaturas', '[]'::jsonb),
       'mensagem',    COALESCE(v_curso.certificado->>'mensagem', '')
     ))
  RETURNING * INTO v_cert;

  RETURN v_cert;
END;
$$;

-- REVOKE de public/anon (padrão de 20260622150000_luma_sec_revoke_*): a função
-- é DEFINER, então quem pode executá-la roda com privilégio elevado.
REVOKE ALL ON FUNCTION luma.ac_emitir_certificado(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION luma.ac_emitir_certificado(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION luma.ac_emitir_certificado(UUID) TO authenticated;

REVOKE ALL ON FUNCTION luma.ac_guard_aula_curso() FROM PUBLIC;
REVOKE ALL ON FUNCTION luma.ac_guard_aula_curso() FROM anon;
REVOKE ALL ON FUNCTION luma.ac_guard_aula_curso() FROM authenticated;

-- ============================================================
-- STORAGE — bucket 'luma-aulas' (vídeo MP4 + materiais das aulas)
-- ============================================================
-- PRIVADO de propósito: aula de formação é conteúdo interno da rede. Os outros
-- buckets de conteúdo são públicos porque a arte final é pública; vídeo de
-- treinamento não é. O front resolve com createSignedUrl (2h) no play.
-- 500MB: aula longa em MP4 cabe sem forçar a equipe a comprimir na mão.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('luma-aulas', 'luma-aulas', FALSE, 500 * 1024 * 1024,
        ARRAY['video/mp4','application/pdf','image/png','image/jpeg','image/webp',
              'text/vtt','text/csv',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
ON CONFLICT (id) DO NOTHING;

-- Leitura: qualquer autenticado (o franqueado precisa assistir). A privacidade
-- que importa aqui é "não vaza pra internet aberta", não "cada um vê o seu".
CREATE POLICY "autenticado lê aulas luma"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'luma-aulas' AND (select auth.uid()) IS NOT NULL);
CREATE POLICY "designer envia aulas luma"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'luma-aulas' AND (select public.is_designer()));
CREATE POLICY "designer atualiza aulas luma"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'luma-aulas' AND (select public.is_designer()))
  WITH CHECK (bucket_id = 'luma-aulas' AND (select public.is_designer()));
CREATE POLICY "designer apaga aulas luma"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'luma-aulas' AND (select public.is_designer()));
