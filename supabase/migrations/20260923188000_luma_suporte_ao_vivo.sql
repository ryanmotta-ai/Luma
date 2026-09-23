-- ============================================================
-- LUMA — Suporte ao vivo: franqueado ↔ equipe DM, 23/09/2026
-- ============================================================
-- Até aqui o widget de ajuda só tinha a IA + a Central, e os dois botões de suporte humano
-- (G_SUPPORT_FORM_URL / G_SUPPORT_EMAIL em js/core/help.js) estavam vazios. Agora a equipe DM
-- (equipe_dm + gestao) responde o franqueado de dentro do Luma, em tempo real.
--
-- UMA tabela. A conversa É o franqueado (franqueado_id): não existe tabela de "conversa" para
-- manter em sincronia com as mensagens. "Aguardando resposta" é DERIVADO — a última mensagem
-- da conversa veio do franqueado. Nada de status que alguém esquece de fechar.
--
-- ⛔ da_equipe, autor_id e autor_nome são decididos pelo GATILHO, nunca pelo navegador. Sem
-- isso, um franqueado grava da_equipe=true na própria conversa e "a equipe" diz o que ele quiser.
-- autor_nome é o primeiro nome copiado na hora do envio: o franqueado não lê o perfil da equipe
-- (RLS de profiles), e sem isto a bolha da resposta não teria quem assinar.
--
-- Realtime: a tabela entra na publicação supabase_realtime — o stream respeita a RLS de SELECT.
-- Presença ("equipe online agora"): canal PRIVADO 'luma:suporte'; só a equipe anuncia (INSERT),
-- todo logado ativo escuta (SELECT). Assim o franqueado não consegue fingir equipe online.
-- Anexo (print da tela): bucket PRIVADO luma-suporte, caminho '<franqueado_id>/<arquivo>', só imagem.

create table if not exists luma.suporte_mensagens (
  id            bigint generated always as identity primary key,
  franqueado_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  autor_id      uuid default auth.uid() references public.profiles(id) on delete set null,
  autor_nome    text check (char_length(autor_nome) <= 80),
  da_equipe     boolean not null default false,
  texto         text not null default '' check (char_length(texto) <= 4000),
  anexo_path    text check (char_length(anexo_path) <= 300),
  -- Onde o franqueado estava ao escrever (modo, campanha, formato, origem). Pequeno de propósito.
  contexto      jsonb check (octet_length(contexto::text) <= 2000),
  lida_em       timestamptz,
  created_at    timestamptz not null default now(),
  constraint suporte_msg_nao_vazia check (char_length(btrim(texto)) > 0 or anexo_path is not null)
);
create index if not exists suporte_msg_conversa_idx on luma.suporte_mensagens (franqueado_id, created_at desc);
comment on table luma.suporte_mensagens is
  'Suporte ao vivo. A conversa é o franqueado_id; da_equipe/autor são gravados pelo gatilho, nunca pelo cliente.';

create or replace function luma.suporte_msg_carimbo()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.autor_id   := auth.uid();
  new.da_equipe  := coalesce((select public.is_designer()), false);
  new.autor_nome := (select split_part(btrim(p.nome), ' ', 1) from public.profiles p where p.id = auth.uid());
  new.lida_em    := null;
  new.created_at := now();
  -- Franqueado só escreve na PRÓPRIA conversa, qualquer que seja o franqueado_id enviado.
  if not new.da_equipe then new.franqueado_id := auth.uid(); end if;
  return new;
end;
$$;
revoke all on function luma.suporte_msg_carimbo() from public, anon, authenticated;
drop trigger if exists suporte_msg_carimbo on luma.suporte_mensagens;
create trigger suporte_msg_carimbo before insert on luma.suporte_mensagens
  for each row execute function luma.suporte_msg_carimbo();

alter table luma.suporte_mensagens enable row level security;

drop policy if exists "suporte: lê a própria conversa; equipe lê todas" on luma.suporte_mensagens;
create policy "suporte: lê a própria conversa; equipe lê todas" on luma.suporte_mensagens
  for select to authenticated
  using ((select public.is_ativo()) and (franqueado_id = (select auth.uid()) or (select public.is_designer())));

drop policy if exists "suporte: escreve na própria conversa; equipe responde" on luma.suporte_mensagens;
create policy "suporte: escreve na própria conversa; equipe responde" on luma.suporte_mensagens
  for insert to authenticated
  with check ((select public.is_ativo()) and autor_id = (select auth.uid())
              and (franqueado_id = (select auth.uid()) or (select public.is_designer())));

-- "Visto": cada lado marca como lida a mensagem do OUTRO lado. O grant por coluna garante que
-- só lida_em muda — texto, autor e conversa ficam como foram enviados.
drop policy if exists "suporte: marca como lida a mensagem do outro lado" on luma.suporte_mensagens;
create policy "suporte: marca como lida a mensagem do outro lado" on luma.suporte_mensagens
  for update to authenticated
  using ((select public.is_ativo()) and ((franqueado_id = (select auth.uid()) and da_equipe)
                                         or ((select public.is_designer()) and not da_equipe)))
  with check ((select public.is_ativo()) and ((franqueado_id = (select auth.uid()) and da_equipe)
                                              or ((select public.is_designer()) and not da_equipe)));
-- Sem policy de DELETE: ninguém apaga conversa de suporte pelo app.

revoke all on luma.suporte_mensagens from anon, authenticated;
grant select, insert on luma.suporte_mensagens to authenticated;
grant update (lida_em) on luma.suporte_mensagens to authenticated;

-- Caixa de entrada da equipe: a última mensagem de cada conversa + quem é + quantas não lidas.
-- security_invoker: quem consulta passa pela RLS da tabela (franqueado vê só a própria linha).
create or replace view luma.suporte_caixa with (security_invoker = true) as
select distinct on (m.franqueado_id)
  m.franqueado_id,
  p.nome,
  p.cidade,
  p.avatar_url,           -- 20260923187500_luma_profiles_avatar.sql (roda antes desta)
  m.texto        as ultimo_texto,
  (m.anexo_path is not null) as ultimo_tem_anexo,
  m.da_equipe    as ultima_da_equipe,
  m.created_at   as ultima_em,
  m.contexto     as ultimo_contexto,
  (select count(*) from luma.suporte_mensagens x
    where x.franqueado_id = m.franqueado_id and not x.da_equipe and x.lida_em is null) as nao_lidas
from luma.suporte_mensagens m
left join public.profiles p on p.id = m.franqueado_id
order by m.franqueado_id, m.created_at desc;
revoke all on luma.suporte_caixa from anon, authenticated;
grant select on luma.suporte_caixa to authenticated;

-- Realtime das mensagens (a RLS de SELECT acima filtra o que cada um recebe).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'luma' and tablename = 'suporte_mensagens') then
    alter publication supabase_realtime add table luma.suporte_mensagens;
  end if;
end $$;

-- Presença da equipe no canal privado 'luma:suporte'.
drop policy if exists "suporte: logado vê a presença da equipe" on realtime.messages;
create policy "suporte: logado vê a presença da equipe" on realtime.messages
  for select to authenticated
  using ((select realtime.topic()) = 'luma:suporte' and extension = 'presence' and (select public.is_ativo()));
drop policy if exists "suporte: só a equipe anuncia presença" on realtime.messages;
create policy "suporte: só a equipe anuncia presença" on realtime.messages
  for insert to authenticated
  with check ((select realtime.topic()) = 'luma:suporte' and extension = 'presence' and (select public.is_designer()));

-- Prints anexados. Privado: pode mostrar dado de loja; lido por URL assinada.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('luma-suporte', 'luma-suporte', false, 5 * 1024 * 1024, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "suporte: lê anexo da própria conversa; equipe lê todos" on storage.objects;
create policy "suporte: lê anexo da própria conversa; equipe lê todos" on storage.objects
  for select to authenticated
  using (bucket_id = 'luma-suporte' and (select public.is_ativo())
         and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_designer())));
drop policy if exists "suporte: envia anexo na própria conversa; equipe em qualquer" on storage.objects;
create policy "suporte: envia anexo na própria conversa; equipe em qualquer" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'luma-suporte' and (select public.is_ativo())
              and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_designer())));

-- Chave do Controle do produto: a gestão desliga o suporte humano sem deploy (ex.: sem
-- ninguém para atender). Filha de global.help, como o chat da IA.
insert into luma.feature_flags (feature_key, enabled, disabled_behavior)
values ('global.help.suporte', true, 'hide')
on conflict (feature_key) do nothing;

-- ============================================================
-- APÓS APLICAR: rodar supabase/tests/rls.sql (casos "suporte" no fim) e conferir:
--   select pubname, schemaname, tablename from pg_publication_tables where tablename = 'suporte_mensagens';
--   select id, public, allowed_mime_types from storage.buckets where id = 'luma-suporte';
-- ============================================================
