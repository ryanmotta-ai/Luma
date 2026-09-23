-- ============================================================
-- LUMA — Storage: cada bucket só aceita o tipo de arquivo que usa, 23/09/2026
-- ============================================================
-- Até aqui nenhum bucket restringia MIME (allowed_mime_types = NULL): qualquer arquivo com
-- nome .png podia ir parar num bucket PÚBLICO — um HTML ou executável servido pela URL do
-- projeto. O teto de tamanho já existia; faltava o tipo.
--
-- Listas tiradas do que o front ENVIA hoje (contentType = blob.type nos uploads):
--   luma-covers / luma-template-assets → js/designer/layers.js (_dUploadDataUrl), library.js
--   luma-fontes                        → js/designer/fonts.js (o navegador varia o MIME da fonte)
--   luma-user-uploads                  → js/franqueado/history.js (foto do franqueado, PNG do QR)
--   luma-renders                       → privado, reservado para export
-- SVG só onde o designer da DM envia (biblioteca). Onde o franqueado envia, nunca: SVG carrega
-- script. ⚠ luma-user-uploads segue PÚBLICO por decisão registrada (roadmap, decisão 3: a arte
-- vai para o Instagram, e o "Ver no meu celular" por QR abre sem login).

update storage.buckets set allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif','image/avif']
where id = 'luma-covers';

update storage.buckets set allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml']
where id = 'luma-template-assets';

update storage.buckets set allowed_mime_types = array['font/ttf','font/otf','font/woff','font/woff2','font/sfnt',
  'application/x-font-ttf','application/x-font-otf','application/font-woff','application/font-woff2',
  'application/vnd.ms-opentype','application/octet-stream']
where id = 'luma-fontes';

update storage.buckets set allowed_mime_types = array['image/png','image/jpeg','image/webp']
where id = 'luma-user-uploads';

update storage.buckets set allowed_mime_types = array['image/png','image/jpeg','application/pdf']
where id = 'luma-renders';
