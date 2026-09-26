-- ============================================================
-- LUMA — Suporte: atendimento com dono, estado e histórico, 26/09/2026
-- ============================================================
-- A v1 (20260923188000) era conversa pura: sem estado, sem dono. Com mais de uma pessoa da
-- equipe atendendo, duas respondiam o mesmo franqueado e ninguém sabia quem estava cuidando.
--
-- A conversa CONTINUA sendo o franqueado (franqueado_id). O que nasce aqui é o ATENDIMENTO
-- em cima dela — uma linha por franqueado em luma.suporte_conversas — e o histórico de quem
-- assumiu, repassou e resolveu em luma.suporte_eventos. Resolvida + nova mensagem do
-- franqueado = o mesmo atendimento REABRE (volta à fila), não uma segunda linha.
--
-- Estados:  novo → em_atendimento ⇄ aguardando_usuario → resolvido
--   novo               = ninguém assumiu (a fila)
--   em_atendimento     = tem responsável e a vez é da EQUIPE
--   aguardando_usuario = a equipe respondeu; a vez é do franqueado
--   resolvido          = alguém da equipe fechou; nova mensagem do franqueado reabre como novo
--
-- ⛔ Ninguém escreve nessas duas tabelas pelo cliente. Quem muda o estado é:
--   · o gatilho suporte_msg_estado, a cada mensagem (a resposta da equipe assume o atendimento
--     sem dono e passa a vez ao franqueado; a mensagem do franqueado devolve a vez à equipe);
--   · as RPCs suporte_assumir / suporte_repassar / suporte_resolver (só equipe).
-- A TRAVA contra dois atendentes vive no gatilho: com responsável definido, só ele responde.
-- Quem quiser entrar numa conversa de outro assume antes (e isso fica no histórico). O
-- `for update` serializa duas respostas simultâneas na mesma conversa: a segunda espera a
-- primeira gravar o dono e aí é recusada.

create table if not exists luma.suporte_conversas (
  franqueado_id  uuid primary key references public.profiles(id) on delete cascade,
  status         text not null default 'novo'
                 check (status in ('novo', 'em_atendimento', 'aguardando_usuario', 'resolvido')),
  responsavel_id uuid references public.profiles(id) on delete set null,
  aberta_em      timestamptz not null default now(),   -- início do ciclo atual (reabrir zera)
  resolvida_em   timestamptz,
  atualizada_em  timestamptz not null default now()
);
create index if not exists suporte_conv_responsavel_idx on luma.suporte_conversas (responsavel_id)
  where responsavel_id is not null;
comment on table luma.suporte_conversas is
  'Atendimento do suporte: uma linha por franqueado. Escrita só pelo gatilho suporte_msg_estado e pelas RPCs suporte_*.';

-- Nomes COPIADOS na hora (primeiro nome), como autor_nome das mensagens: o franqueado não lê
-- o perfil da equipe, e o histórico precisa dizer quem foi mesmo depois de a pessoa sair.
create table if not exists luma.suporte_eventos (
  id            bigint generated always as identity primary key,
  franqueado_id uuid not null references public.profiles(id) on delete cascade,
  tipo          text not null check (tipo in ('assumiu', 'repassou', 'resolveu', 'reabriu')),
  ator_id       uuid references public.profiles(id) on delete set null,
  ator_nome     text check (char_length(ator_nome) <= 80),
  de_id         uuid references public.profiles(id) on delete set null,   -- quem era o responsável
  de_nome       text check (char_length(de_nome) <= 80),
  para_id       uuid references public.profiles(id) on delete set null,   -- repassou: para quem
  para_nome     text check (char_length(para_nome) <= 80),
  created_at    timestamptz not null default now()
);
create index if not exists suporte_evt_conversa_idx on luma.suporte_eventos (franqueado_id, created_at desc);
comment on table luma.suporte_eventos is
  'Histórico do atendimento (assumiu/repassou/resolveu/reabriu). Escrito só por funções do banco.';

create or replace function luma.suporte_primeiro_nome(p_id uuid)
returns text language sql stable security definer set search_path = ''
as $$ select nullif(split_part(btrim(coalesce(p.nome, '')), ' ', 1), '') from public.profiles p where p.id = p_id $$;
revoke all on function luma.suporte_primeiro_nome(uuid) from public, anon, authenticated;

create or replace function luma.suporte_evento(p_franqueado uuid, p_tipo text, p_de uuid, p_para uuid)
returns void language sql security definer set search_path = ''
as $$
  insert into luma.suporte_eventos (franqueado_id, tipo, ator_id, ator_nome, de_id, de_nome, para_id, para_nome)
  values (p_franqueado, p_tipo, auth.uid(), luma.suporte_primeiro_nome(auth.uid()),
          p_de, luma.suporte_primeiro_nome(p_de), p_para, luma.suporte_primeiro_nome(p_para));
$$;
revoke all on function luma.suporte_evento(uuid, text, uuid, uuid) from public, anon, authenticated;

-- Roda DEPOIS de suporte_msg_carimbo (gatilhos BEFORE disparam em ordem alfabética), então
-- autor_id, da_equipe e franqueado_id já vêm carimbados pelo banco, não pelo navegador.
create or replace function luma.suporte_msg_estado()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare c luma.suporte_conversas%rowtype;
begin
  insert into luma.suporte_conversas (franqueado_id, status)
  values (new.franqueado_id, 'novo')
  on conflict (franqueado_id) do nothing;
  select * into c from luma.suporte_conversas where franqueado_id = new.franqueado_id for update;

  if new.da_equipe then
    if c.status <> 'resolvido' and c.responsavel_id is not null and c.responsavel_id <> new.autor_id then
      raise exception 'SUPORTE_OUTRO_RESPONSAVEL'
        using errcode = 'P0001', hint = 'Assuma o atendimento (luma.suporte_assumir) antes de responder.';
    end if;
    if c.responsavel_id is distinct from new.autor_id then
      perform luma.suporte_evento(new.franqueado_id, 'assumiu', c.responsavel_id, null);
    end if;
    update luma.suporte_conversas
       set status = 'aguardando_usuario', responsavel_id = new.autor_id, resolvida_em = null, atualizada_em = now()
     where franqueado_id = new.franqueado_id;
  else
    if c.status = 'resolvido' then
      perform luma.suporte_evento(new.franqueado_id, 'reabriu', c.responsavel_id, null);
      update luma.suporte_conversas
         set status = 'novo', responsavel_id = null, aberta_em = now(), resolvida_em = null, atualizada_em = now()
       where franqueado_id = new.franqueado_id;
    else
      update luma.suporte_conversas
         set status = case when responsavel_id is null then 'novo' else 'em_atendimento' end, atualizada_em = now()
       where franqueado_id = new.franqueado_id;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function luma.suporte_msg_estado() from public, anon, authenticated;
drop trigger if exists suporte_msg_estado on luma.suporte_mensagens;
create trigger suporte_msg_estado before insert on luma.suporte_mensagens
  for each row execute function luma.suporte_msg_estado();

/* ── RPCs da equipe. Devolvem {ok:false, responsavel_nome} em vez de erro quando o motivo é
   "outra pessoa está atendendo": é estado normal, a tela mostra quem é e oferece assumir. ── */

-- p_forcar = tirar de quem está atendendo (fica no histórico como "assumiu de <fulano>").
create or replace function luma.suporte_assumir(p_franqueado uuid, p_forcar boolean default false)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare c luma.suporte_conversas%rowtype; eu uuid := auth.uid();
begin
  if not coalesce(public.is_designer(), false) then raise exception 'SUPORTE_SO_EQUIPE' using errcode = '42501'; end if;
  select * into c from luma.suporte_conversas where franqueado_id = p_franqueado for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'sem_conversa'); end if;
  if c.responsavel_id = eu and c.status <> 'resolvido' then return jsonb_build_object('ok', true); end if;
  if c.status <> 'resolvido' and c.responsavel_id is not null and c.responsavel_id <> eu and not p_forcar then
    return jsonb_build_object('ok', false, 'erro', 'outro_responsavel',
                              'responsavel_id', c.responsavel_id, 'responsavel_nome', luma.suporte_primeiro_nome(c.responsavel_id));
  end if;
  perform luma.suporte_evento(p_franqueado, 'assumiu', nullif(c.responsavel_id, eu), null);
  update luma.suporte_conversas
     set responsavel_id = eu, resolvida_em = null, atualizada_em = now(),
         status = case when status in ('novo', 'resolvido') then 'em_atendimento' else status end
   where franqueado_id = p_franqueado;
  return jsonb_build_object('ok', true);
end;
$$;

-- Repassa quem é responsável (ou a conversa ainda sem dono: atribuição a partir da fila).
create or replace function luma.suporte_repassar(p_franqueado uuid, p_para uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare c luma.suporte_conversas%rowtype; eu uuid := auth.uid();
begin
  if not coalesce(public.is_designer(), false) then raise exception 'SUPORTE_SO_EQUIPE' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles p where p.id = p_para and p.role in ('equipe_dm', 'gestao') and p.ativo) then
    return jsonb_build_object('ok', false, 'erro', 'destino_invalido');
  end if;
  select * into c from luma.suporte_conversas where franqueado_id = p_franqueado for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'sem_conversa'); end if;
  if c.responsavel_id is not null and c.responsavel_id <> eu and c.status <> 'resolvido' then
    return jsonb_build_object('ok', false, 'erro', 'outro_responsavel',
                              'responsavel_id', c.responsavel_id, 'responsavel_nome', luma.suporte_primeiro_nome(c.responsavel_id));
  end if;
  if c.responsavel_id = p_para and c.status <> 'resolvido' then return jsonb_build_object('ok', true); end if;
  perform luma.suporte_evento(p_franqueado, 'repassou', c.responsavel_id, p_para);
  update luma.suporte_conversas
     set responsavel_id = p_para, resolvida_em = null, atualizada_em = now(),
         status = case when status in ('novo', 'resolvido') then 'em_atendimento' else status end
   where franqueado_id = p_franqueado;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function luma.suporte_resolver(p_franqueado uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare c luma.suporte_conversas%rowtype; eu uuid := auth.uid();
begin
  if not coalesce(public.is_designer(), false) then raise exception 'SUPORTE_SO_EQUIPE' using errcode = '42501'; end if;
  select * into c from luma.suporte_conversas where franqueado_id = p_franqueado for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'sem_conversa'); end if;
  if c.status = 'resolvido' then return jsonb_build_object('ok', true); end if;
  if c.responsavel_id is not null and c.responsavel_id <> eu then
    return jsonb_build_object('ok', false, 'erro', 'outro_responsavel',
                              'responsavel_id', c.responsavel_id, 'responsavel_nome', luma.suporte_primeiro_nome(c.responsavel_id));
  end if;
  perform luma.suporte_evento(p_franqueado, 'resolveu', null, null);
  update luma.suporte_conversas
     set status = 'resolvido', responsavel_id = eu, resolvida_em = now(), atualizada_em = now()
   where franqueado_id = p_franqueado;
  return jsonb_build_object('ok', true);
end;
$$;

-- O cartão de quem atende: foto, nome e cargo. Cargo = profiles.departamento (só a gestão
-- edita — guard_profile_role), com "Equipe DM" quando vazio. SECURITY DEFINER porque o
-- franqueado não lê profiles da equipe; devolve SÓ estes quatro campos e SÓ da equipe ativa.
create or replace function luma.suporte_equipe()
returns table (id uuid, nome text, cargo text, avatar_url text)
language sql stable security definer set search_path = ''
as $$
  select p.id, btrim(coalesce(p.nome, '')), coalesce(nullif(btrim(p.departamento), ''), 'Equipe DM'), p.avatar_url
    from public.profiles p
   where p.role in ('equipe_dm', 'gestao') and p.ativo and (select public.is_ativo())
   order by p.nome;
$$;

revoke all on function luma.suporte_assumir(uuid, boolean) from public, anon;
revoke all on function luma.suporte_repassar(uuid, uuid) from public, anon;
revoke all on function luma.suporte_resolver(uuid) from public, anon;
revoke all on function luma.suporte_equipe() from public, anon;
grant execute on function luma.suporte_assumir(uuid, boolean) to authenticated;
grant execute on function luma.suporte_repassar(uuid, uuid) to authenticated;
grant execute on function luma.suporte_resolver(uuid) to authenticated;
grant execute on function luma.suporte_equipe() to authenticated;

/* ── RLS: leitura igual à das mensagens; nenhuma escrita pelo cliente. ── */
alter table luma.suporte_conversas enable row level security;
alter table luma.suporte_eventos enable row level security;

drop policy if exists "suporte: lê o próprio atendimento; equipe lê todos" on luma.suporte_conversas;
create policy "suporte: lê o próprio atendimento; equipe lê todos" on luma.suporte_conversas
  for select to authenticated
  using ((select public.is_ativo()) and (franqueado_id = (select auth.uid()) or (select public.is_designer())));

drop policy if exists "suporte: lê o próprio histórico; equipe lê todos" on luma.suporte_eventos;
create policy "suporte: lê o próprio histórico; equipe lê todos" on luma.suporte_eventos
  for select to authenticated
  using ((select public.is_ativo()) and (franqueado_id = (select auth.uid()) or (select public.is_designer())));

revoke all on luma.suporte_conversas, luma.suporte_eventos from anon, authenticated;
grant select on luma.suporte_conversas, luma.suporte_eventos to authenticated;

/* ── Caixa de entrada: + status e responsável (colunas NOVAS no fim, exigência do replace). ── */
create or replace view luma.suporte_caixa with (security_invoker = true) as
select distinct on (m.franqueado_id)
  m.franqueado_id,
  p.nome,
  p.cidade,
  p.avatar_url,
  m.texto        as ultimo_texto,
  (m.anexo_path is not null) as ultimo_tem_anexo,
  m.da_equipe    as ultima_da_equipe,
  m.created_at   as ultima_em,
  m.contexto     as ultimo_contexto,
  (select count(*) from luma.suporte_mensagens x
    where x.franqueado_id = m.franqueado_id and not x.da_equipe and x.lida_em is null) as nao_lidas,
  c.status,
  c.responsavel_id
from luma.suporte_mensagens m
left join public.profiles p on p.id = m.franqueado_id
left join luma.suporte_conversas c on c.franqueado_id = m.franqueado_id
order by m.franqueado_id, m.created_at desc;
revoke all on luma.suporte_caixa from anon, authenticated;
grant select on luma.suporte_caixa to authenticated;

-- Realtime do atendimento: quem assumiu/repassou aparece na hora para os outros atendentes
-- (é o que tira o campo de resposta de quem não é o responsável). A RLS filtra o stream.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'luma' and tablename = 'suporte_conversas') then
    alter publication supabase_realtime add table luma.suporte_conversas;
  end if;
end $$;

/* ── Conversas que já existiam: a vez é de quem não mandou a última mensagem. Se a última
   foi da equipe, quem a mandou vira o responsável (era quem estava atendendo). ── */
insert into luma.suporte_conversas (franqueado_id, status, responsavel_id, aberta_em, atualizada_em)
select distinct on (m.franqueado_id)
       m.franqueado_id,
       case when m.da_equipe then 'aguardando_usuario' else 'novo' end,
       case when m.da_equipe then m.autor_id end,
       (select min(x.created_at) from luma.suporte_mensagens x where x.franqueado_id = m.franqueado_id),
       m.created_at
  from luma.suporte_mensagens m
 order by m.franqueado_id, m.created_at desc
on conflict (franqueado_id) do nothing;

-- ============================================================
-- APÓS APLICAR: rodar supabase/tests/rls.sql (casos "atendimento") e conferir:
--   select tablename from pg_publication_tables where tablename in ('suporte_mensagens','suporte_conversas');
--   select status, count(*) from luma.suporte_conversas group by 1;
-- ============================================================
