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
--   luma-user-uploads    (PÚBLICO)  fotos do franqueado (foto_produto, logo_loja) — viram arte pública; escrita ainda owner-scoped
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
  ('luma-user-uploads',    'luma-user-uploads',    TRUE,   8 * 1024 * 1024),  -- PÚBLICO (2026-06-19): fotos do franqueado viram arte pública
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
