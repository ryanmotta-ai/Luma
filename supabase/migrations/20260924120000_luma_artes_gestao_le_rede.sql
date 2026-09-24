-- Modo "Rede ao vivo" (catalog.js, menu de 3 pontos da campanha): a gestão vê o mosaico das
-- artes que as franquias geraram. Só LEITURA e só role 'gestao' (decisão do Ryan, 2026-09-24);
-- equipe_dm continua lendo apenas as próprias. Escrita segue exclusiva do dono.
CREATE POLICY "gestao lê artes da rede"
  ON luma.artes FOR SELECT
  USING ((SELECT public.get_user_role()) = 'gestao');
