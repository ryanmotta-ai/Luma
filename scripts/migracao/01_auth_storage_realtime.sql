-- scripts/migracao/01_auth_storage_realtime.sql — rodar NO PROJETO NOVO, depois do restore (passo 2).
-- O `supabase db dump` não exporta objetos dos schemas gerenciados (auth, storage) nem as policies
-- do Realtime. Este arquivo recria o que o Luma tinha neles, copiado do projeto antigo em
-- 14/10/2026 (pg_trigger, pg_policies, pg_publication_tables). Idempotente: pode rodar de novo.
-- As funções usadas (handle_new_user, is_designer, is_ativo) vêm no schema.sql do passo 2.

-- 1. Auth: o perfil nasce junto com o usuário.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Storage. Buckets públicos (covers, template-assets, fontes): todo logado lê, designer escreve.
drop policy if exists "autenticado lê buckets luma públicos" on storage.objects;
create policy "autenticado lê buckets luma públicos" on storage.objects
  for select to authenticated
  using (bucket_id = any (array['luma-covers'::text, 'luma-template-assets'::text, 'luma-fontes'::text]));

drop policy if exists "designer envia em buckets luma públicos" on storage.objects;
create policy "designer envia em buckets luma públicos" on storage.objects
  for insert
  with check ((bucket_id = any (array['luma-covers'::text, 'luma-template-assets'::text, 'luma-fontes'::text])) and is_designer());

drop policy if exists "designer atualiza em buckets luma públicos" on storage.objects;
create policy "designer atualiza em buckets luma públicos" on storage.objects
  for update
  using ((bucket_id = any (array['luma-covers'::text, 'luma-template-assets'::text, 'luma-fontes'::text])) and is_designer())
  with check ((bucket_id = any (array['luma-covers'::text, 'luma-template-assets'::text, 'luma-fontes'::text])) and is_designer());

drop policy if exists "designer apaga em buckets luma públicos" on storage.objects;
create policy "designer apaga em buckets luma públicos" on storage.objects
  for delete
  using ((bucket_id = any (array['luma-covers'::text, 'luma-template-assets'::text, 'luma-fontes'::text])) and is_designer());

-- Buckets por dono (user-uploads, renders): só a pasta do próprio uid.
drop policy if exists "dono lê seus uploads luma privados" on storage.objects;
create policy "dono lê seus uploads luma privados" on storage.objects
  for select
  using ((bucket_id = any (array['luma-user-uploads'::text, 'luma-renders'::text])) and ((storage.foldername(name))[1] = (auth.uid())::text));

drop policy if exists "dono envia em pasta própria luma" on storage.objects;
create policy "dono envia em pasta própria luma" on storage.objects
  for insert
  with check ((bucket_id = any (array['luma-user-uploads'::text, 'luma-renders'::text])) and ((storage.foldername(name))[1] = (auth.uid())::text));

drop policy if exists "dono atualiza seus uploads luma privados" on storage.objects;
create policy "dono atualiza seus uploads luma privados" on storage.objects
  for update
  using ((bucket_id = any (array['luma-user-uploads'::text, 'luma-renders'::text])) and ((storage.foldername(name))[1] = (auth.uid())::text))
  with check ((bucket_id = any (array['luma-user-uploads'::text, 'luma-renders'::text])) and ((storage.foldername(name))[1] = (auth.uid())::text));

drop policy if exists "dono apaga seus uploads luma privados" on storage.objects;
create policy "dono apaga seus uploads luma privados" on storage.objects
  for delete
  using ((bucket_id = any (array['luma-user-uploads'::text, 'luma-renders'::text])) and ((storage.foldername(name))[1] = (auth.uid())::text));

-- Suporte ao vivo (bucket privado luma-suporte): o franqueado na própria conversa, a equipe em todas.
drop policy if exists "suporte: envia anexo na própria conversa; equipe em qualquer" on storage.objects;
create policy "suporte: envia anexo na própria conversa; equipe em qualquer" on storage.objects
  for insert to authenticated
  with check ((bucket_id = 'luma-suporte'::text) and (select is_ativo()) and (((storage.foldername(name))[1] = ((select auth.uid()))::text) or (select is_designer())));

drop policy if exists "suporte: lê anexo da própria conversa; equipe lê todos" on storage.objects;
create policy "suporte: lê anexo da própria conversa; equipe lê todos" on storage.objects
  for select to authenticated
  using ((bucket_id = 'luma-suporte'::text) and (select is_ativo()) and (((storage.foldername(name))[1] = ((select auth.uid()))::text) or (select is_designer())));

-- 3. Realtime: presença da equipe no canal privado luma:suporte.
drop policy if exists "suporte: logado vê a presença da equipe" on realtime.messages;
create policy "suporte: logado vê a presença da equipe" on realtime.messages
  for select to authenticated
  using (((select realtime.topic()) = 'luma:suporte'::text) and (extension = 'presence'::text) and (select is_ativo()));

drop policy if exists "suporte: só a equipe anuncia presença" on realtime.messages;
create policy "suporte: só a equipe anuncia presença" on realtime.messages
  for insert to authenticated
  with check (((select realtime.topic()) = 'luma:suporte'::text) and (extension = 'presence'::text) and (select is_designer()));

-- 4. Publicação do Realtime (a caixa de suporte escuta esta tabela).
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'luma' and tablename = 'suporte_mensagens') then
    alter publication supabase_realtime add table luma.suporte_mensagens;
  end if;
end $$;

-- 5. Conferência. "event trigger ensure_rls" tem que ser 1: é a opção "Enable automatic RLS" do
-- projeto (criada pela plataforma, não dá para criar por SQL). Se vier 0, ligar no Dashboard.
select 'policies storage.objects' as item, count(*)::text as valor from pg_policies where schemaname = 'storage' and tablename = 'objects'
union all select 'policies realtime.messages', count(*)::text from pg_policies where schemaname = 'realtime' and tablename = 'messages'
union all select 'trigger auth.users', coalesce(string_agg(tgname, ', '), '(nenhum)') from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal
union all select 'publication supabase_realtime', coalesce(string_agg(schemaname||'.'||tablename, ', '), '(vazia)') from pg_publication_tables where pubname = 'supabase_realtime'
union all select 'event trigger ensure_rls', count(*)::text from pg_event_trigger where evtname = 'ensure_rls';
