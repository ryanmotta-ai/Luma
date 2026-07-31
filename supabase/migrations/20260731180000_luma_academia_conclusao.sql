-- ============================================================
-- LUMA — ACADEMIA · experiência de conclusão (splash + vídeo dos CEOs)
-- ============================================================
--
-- O QUE RESOLVE: concluir a formação era um overlay igual ao de fechar um módulo.
-- A conclusão é uma MUDANÇA DE FASE do franqueado na rede — merece splash,
-- mensagem institucional e o vídeo dos CEOs. Nada disso pode ser hardcoded: a
-- equipe precisa trocar texto e vídeo sem deploy.
--
-- POR QUE NÃO TEM TABELA NOVA:
--   • A CONFIGURAÇÃO é uma por curso → coluna JSONB em luma.cursos. Tabela
--     separada seria um JOIN garantido de 1:1 pra sempre.
--   • O ESTADO é um por (usuário, curso) → colunas em luma.matriculas, que já é
--     exatamente essa cardinalidade e já tem a policy de dono certa.
-- Storage também não precisa de bucket novo: o vídeo institucional entra em
-- luma-aulas sob `conclusao/`, com as mesmas policies (leitura autenticada,
-- escrita is_designer()).
-- ============================================================

-- ============================================================
-- 1) CONFIGURAÇÃO DA EXPERIÊNCIA (por curso)
-- ============================================================
ALTER TABLE luma.cursos
  ADD COLUMN IF NOT EXISTS conclusao JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN luma.cursos.conclusao IS
$$Experiência de conclusão da formação. Forma esperada:
{
  "splash":  { "ativa": true, "titulo": "...", "mensagem": "...", "frase_final": "...",
               "cta_label": "...", "cta_destino": "certificado|home|aula|url",
               "cta_url": "https://…"   -- só quando cta_destino = 'url'
             },
  "video":   { "ativo": true, "versao": 1, "titulo": "...", "intro": "...",
               "path": "conclusao/<curso>/ceos.mp4",   -- bucket luma-aulas
               "url": "https://…",                      -- alternativa ao path
               "thumb_url": "...", "legenda_url": "...", "duracao_seg": 180,
               "obrigatorio": false, "publicado_em": "2026-07-31",
               "cta_label": "..."
             }
}
Chave ausente = recurso desligado. `versao` do vídeo é o que permite publicar uma
mensagem nova sem forçar quem já se formou a rever (ver matriculas.video_visto_versao).$$;

-- ============================================================
-- 2) ESTADO DA EXPERIÊNCIA (por usuário + curso)
-- ============================================================
-- Sem isto, a splash reapareceria a cada abertura do app — o oposto de um marco.
ALTER TABLE luma.matriculas
  ADD COLUMN IF NOT EXISTS splash_vista_em     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS splash_versao       INT,
  ADD COLUMN IF NOT EXISTS video_visto_em      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS video_ignorado_em   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS video_visto_versao  INT,
  ADD COLUMN IF NOT EXISTS video_posicao_seg   INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN luma.matriculas.splash_versao IS
  'Versão do CURSO em que a splash foi vista. Nova versão da formação = nova conclusão = splash de novo.';
COMMENT ON COLUMN luma.matriculas.video_visto_versao IS
  'Versão do VÍDEO institucional já visto. Vídeo novo publicado (versao maior) aparece como mensagem nova, sem reabrir a splash.';
COMMENT ON COLUMN luma.matriculas.video_posicao_seg IS
  'Retomada do vídeo dos CEOs. Mesma ideia de aula_progresso.posicao_seg, mas o vídeo institucional não é aula e não entra no progresso da formação.';

-- ⚠ Nenhuma policy nova: as colunas entram em luma.matriculas, cujas policies já
-- são "dono lê/escreve o próprio; designer lê todos" (com WITH CHECK no UPDATE).
-- Marcar a própria splash como vista não é decisão de segurança — o pior caso é
-- a pessoa rever ou pular a própria celebração.

-- ============================================================
-- 3) SEMENTE DE TEXTO (só onde ainda está vazio)
-- ============================================================
-- Texto de partida para a equipe editar na tela de gestão, não conteúdo final.
-- ⚠ NÃO inventa fala de CEO: o vídeo nasce desligado (`ativo: false`) e sem URL.
-- Quem liga e aponta o arquivo é a equipe, com material oficial em mãos.
UPDATE luma.cursos
   SET conclusao = jsonb_build_object(
         'splash', jsonb_build_object(
           'ativa', TRUE,
           'titulo', 'Formação concluída',
           'mensagem', 'Você concluiu sua jornada de formação como franqueado Delivery Much.',
           'frase_final', 'Agora começa uma nova etapa da sua jornada na rede.',
           'cta_label', 'Ver meu certificado',
           'cta_destino', 'certificado'
         ),
         'video', jsonb_build_object(
           'ativo', FALSE,
           'versao', 1,
           'titulo', 'Uma mensagem para o início da sua nova jornada',
           'intro', 'Conteúdo a ser gravado e publicado pela equipe Delivery Much.',
           'obrigatorio', FALSE,
           'cta_label', 'Continuar'
         )
       )
 WHERE conclusao = '{}'::jsonb;
