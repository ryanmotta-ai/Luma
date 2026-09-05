-- ============================================================
-- LUMA — hardening de RLS: WITH CHECK no Storage + conta desativada
-- ============================================================
--
-- Idempotente (DROP ... IF EXISTS antes de cada CREATE). Pode rodar sozinha
-- no SQL Editor. Não cria tabela, não muda coluna, não migra dado.
--
-- ------------------------------------------------------------
-- §1 — POLICY DE UPDATE SEM `WITH CHECK` NO STORAGE (falha real)
-- ------------------------------------------------------------
-- `20260618094000_storage_buckets.sql` criou 3 policies de UPDATE em
-- storage.objects definindo só o `USING`. `USING` responde "esta linha pode
-- ser alcançada?" — ele NÃO valida a linha DEPOIS da alteração. Sem
-- `WITH CHECK`, o dono de `<uid>/foto.png` podia emitir
--
--     UPDATE storage.objects SET name = '<uid-de-outro>/foto.png' WHERE ...
--
-- e o Postgres aceitava: a linha ANTES da mudança estava na pasta dele, e
-- não havia nada checando a linha DEPOIS. Mesmo caminho para `bucket_id`,
-- o que movia o arquivo de um bucket privado para outro. Resultado:
-- sobrescrever ou sequestrar arquivo alheio com uma requisição PostgREST.
--
-- A correção é `WITH CHECK` espelhando exatamente o `USING`: a linha precisa
-- satisfazer a condição nos dois lados da alteração.
-- (`06_OPERATING_SYSTEM` §7: "Policy de UPDATE precisa de WITH CHECK".)
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "designer atualiza em buckets luma públicos" ON storage.objects;
CREATE POLICY "designer atualiza em buckets luma públicos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id IN ('luma-covers', 'luma-template-assets', 'luma-fontes')
    AND public.is_designer()
  )
  WITH CHECK (
    bucket_id IN ('luma-covers', 'luma-template-assets', 'luma-fontes')
    AND public.is_designer()
  );

DROP POLICY IF EXISTS "dono atualiza seus uploads luma privados" ON storage.objects;
CREATE POLICY "dono atualiza seus uploads luma privados"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id IN ('luma-user-uploads', 'luma-renders')
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id IN ('luma-user-uploads', 'luma-renders')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------------------------------------------------
-- §2 — CONTA DESATIVADA AINDA LIA DADO (backlog registrado em auth.js:50)
-- ------------------------------------------------------------
-- "Desativar acesso" na aba Equipe grava `profiles.ativo = false`. O front
-- encerra a sessão no próximo boot (`auth.js`), mas isso é FRONT: o JWT já
-- emitido continua válido até expirar, e as policies de leitura pediam só
-- `auth.uid() IS NOT NULL`. Com o token na mão (DevTools, curl), o desativado
-- seguia lendo variáveis, fontes e a vitrine de pastas.
--
-- `is_ativo()` fecha isso na RLS, que é onde a fronteira mora.
--
-- ⚠ Formulação deliberada: "autenticado E NÃO explicitamente desativado".
-- Não é `ativo = TRUE`. A diferença importa no primeiro login, quando o
-- trigger `handle_new_user` pode ainda não ter gravado o profile: com
-- `= TRUE` o usuário legítimo tomaria deny-all numa corrida de milissegundos.
-- Fail-open em linha AUSENTE, fail-closed em linha que diz `ativo = false` —
-- que é exatamente o caso que se quer barrar.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_ativo()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.ativo = FALSE
     );
$$;

-- Mesma trava das outras funções SECURITY DEFINER do projeto
-- (`20260622150000_luma_sec_revoke_trigger_funcs.sql`): a policy chama a
-- função, o cliente não precisa de EXECUTE direto.
REVOKE EXECUTE ON FUNCTION public.is_ativo() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "franqueado vê pastas ativas; designer vê todas" ON luma.pastas;
CREATE POLICY "franqueado vê pastas ativas; designer vê todas"
  ON luma.pastas FOR SELECT
  USING (public.is_designer() OR (public.is_ativo() AND ativa = TRUE));

DROP POLICY IF EXISTS "autenticado lê variaveis" ON luma.variaveis;
CREATE POLICY "autenticado lê variaveis"
  ON luma.variaveis FOR SELECT
  USING (public.is_ativo());

DROP POLICY IF EXISTS "autenticado lê fontes" ON luma.fontes;
CREATE POLICY "autenticado lê fontes"
  ON luma.fontes FOR SELECT
  USING (public.is_ativo());

-- luma.templates fica FORA desta leva de propósito: a policy dele já não usa
-- `auth.uid() IS NOT NULL` (é `publicado = TRUE AND validade >= hoje`), e o
-- template publicado é conteúdo da rede, não dado pessoal. Trancá-lo por
-- `ativo` é decisão de produto, não correção de falha — fica para quando
-- alguém pedir, com o motivo escrito.
