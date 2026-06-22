ALTER POLICY "dono lê suas artes" ON luma.artes USING (user_id = (select auth.uid()));
ALTER POLICY "dono cria arte em nome próprio" ON luma.artes WITH CHECK (user_id = (select auth.uid()));
ALTER POLICY "dono atualiza suas artes" ON luma.artes USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
ALTER POLICY "dono apaga suas artes" ON luma.artes USING (user_id = (select auth.uid()));

ALTER POLICY "designer gerencia pastas" ON luma.pastas USING ((select public.is_designer())) WITH CHECK ((select public.is_designer()));
ALTER POLICY "franqueado vê pastas ativas; designer vê todas" ON luma.pastas USING ((select public.is_designer()) OR (((select auth.uid()) IS NOT NULL) AND (ativa = true)));

ALTER POLICY "designer gerencia templates" ON luma.templates USING ((select public.is_designer())) WITH CHECK ((select public.is_designer()));
ALTER POLICY "franqueado vê templates publicados; designer vê todos" ON luma.templates USING ((select public.is_designer()) OR ((publicado = true) AND ((validade IS NULL) OR (validade >= CURRENT_DATE))));

ALTER POLICY "autenticado lê fontes" ON luma.fontes USING (((select auth.uid()) IS NOT NULL));
ALTER POLICY "designer gerencia fontes" ON luma.fontes USING ((select public.is_designer())) WITH CHECK ((select public.is_designer()));

ALTER POLICY "autenticado lê variaveis" ON luma.variaveis USING (((select auth.uid()) IS NOT NULL));
ALTER POLICY "designer gerencia variaveis" ON luma.variaveis USING ((select public.is_designer())) WITH CHECK ((select public.is_designer()));

ALTER POLICY "designer gerencia biblioteca" ON luma.biblioteca_assets USING ((select public.is_designer())) WITH CHECK ((select public.is_designer()));

ALTER POLICY "designer gerencia snippets" ON luma.snippets USING ((select public.is_designer())) WITH CHECK ((select public.is_designer()));

ALTER POLICY "usuario lê próprio perfil; designer lê todos" ON public.profiles USING ((id = (select auth.uid())) OR (select public.is_designer()));
ALTER POLICY "usuario atualiza próprio perfil; gestao atualiza todos" ON public.profiles USING ((id = (select auth.uid())) OR ((select public.get_user_role()) = 'gestao'::text)) WITH CHECK ((id = (select auth.uid())) OR ((select public.get_user_role()) = 'gestao'::text));

ALTER POLICY "designer lê eventos" ON analytics.fct_eventos USING ((select public.is_designer()));
ALTER POLICY "usuario autenticado grava evento em nome próprio" ON analytics.fct_eventos WITH CHECK (user_id = (select auth.uid()));
