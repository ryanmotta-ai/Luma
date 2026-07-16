-- ============================================================
-- LUMA — Storage: policy de SELECT nos buckets públicos do designer
-- ============================================================
-- INCIDENTE (2026-07-16): NENHUM upload de designer jamais chegou ao Storage —
-- luma-covers, luma-template-assets e luma-fontes estavam com 0 objetos, enquanto
-- luma-user-uploads (franqueado) tinha 44. Capa de pasta não salvava, fontes não
-- subiam e as imagens dos templates nunca eram externalizadas (raiz do base64
-- gigante em luma.templates → o problema original de tráfego/egress).
--
-- CAUSA-RAIZ: todo upload do app usa {upsert:true}, e o upsert do Storage exige
-- INSERT + SELECT + UPDATE nas policies de storage.objects. Os 3 buckets públicos
-- só tinham INSERT/UPDATE/DELETE (is_designer) — sem SELECT, o Storage recusa o
-- upsert. luma-user-uploads funcionava porque tem policy própria de SELECT
-- ("dono lê seus uploads"). "Bucket público" dispensa SELECT só para leitura via
-- URL/CDN — NÃO para a API autenticada do upsert.
--
-- Escopo mínimo: SELECT para authenticated apenas nos 3 buckets públicos do
-- designer. Não amplia leitura real (public=true já serve tudo via CDN a anon).
CREATE POLICY "autenticado lê buckets luma públicos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('luma-covers','luma-template-assets','luma-fontes'));
