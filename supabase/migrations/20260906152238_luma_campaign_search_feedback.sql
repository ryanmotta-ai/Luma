-- Busca e feedback V1. O schema analytics permanece fora da Data API.
-- Todas as funções são INVOKER: os grants e a RLS continuam a fronteira.

create function luma.registrar_evento(p_id uuid, p_evento text, p_payload jsonb default null)
returns boolean
language plpgsql security invoker set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id=auth.uid() and ativo) then
    raise exception 'Conta ativa necessária' using errcode='42501';
  end if;
  if p_id is null or p_evento is null or char_length(btrim(p_evento)) not between 1 and 64
     or (p_payload is not null and (jsonb_typeof(p_payload)<>'object' or pg_column_size(p_payload)>=8192)) then
    raise exception 'Evento inválido' using errcode='22023';
  end if;
  if p_payload->>'user_id' is not null and p_payload->>'user_id'<>auth.uid()::text then
    raise exception 'A sessão mudou; tente com a conta original' using errcode='42501';
  end if;
  insert into analytics.fct_eventos(id,evento,user_id,role,payload)
  values(p_id,btrim(p_evento),auth.uid(),public.get_user_role(),p_payload)
  on conflict do nothing;
  return true;
end;
$$;
revoke all on function luma.registrar_evento(uuid,text,jsonb) from public,anon;
grant execute on function luma.registrar_evento(uuid,text,jsonb) to authenticated;

-- Só equivalência determinística: não juntar intenções por fuzzy matching.
create function luma.feedback_query_normalized(p_query text)
returns text language sql immutable parallel safe security invoker set search_path = ''
as $$
  select btrim(regexp_replace(
    regexp_replace(normalize(lower(btrim(coalesce(p_query,''))),NFD), U&'[\0300-\036f]', '', 'g'),
    '[[:space:]]+', ' ', 'g'));
$$;
revoke all on function luma.feedback_query_normalized(text) from public,anon;
grant execute on function luma.feedback_query_normalized(text) to authenticated;

create table luma.campaign_feedback (
  id uuid primary key,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  type text not null check(type in ('campaign_feedback','content_request')),
  action_id text not null check(char_length(btrim(action_id)) between 1 and 320),
  camp_id text check(char_length(camp_id)<=160),
  camp_name text check(char_length(camp_name)<=240),
  template_id text check(char_length(template_id)<=160),
  template_name text check(char_length(template_name)<=240),
  fmt_id text check(char_length(fmt_id)<=80),
  franchise_id text check(char_length(franchise_id)<=160),
  rating text,
  reason text,
  comment text check(char_length(comment)<=1000),
  query text check(char_length(query)<=240),
  query_normalized text generated always as (luma.feedback_query_normalized(query)) stored,
  source text not null check(source in ('generation','download','search')),
  client_created_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id,action_id,type),
  constraint campaign_feedback_shape check (
    (type='campaign_feedback' and coalesce(char_length(btrim(camp_id)),0)>0
      and source in ('generation','download')
      and ((rating='positive' and reason is null)
        or (rating='negative' and reason in ('missing_format','no_suitable_art',
          'editing_difficulty','confusing_information','generation_download_issue','other')))
      and rating is not null and (rating<>'negative' or reason is not null))
    or
    (type='content_request' and rating is null and reason is null and source='search'
      and char_length(luma.feedback_query_normalized(query))>0)
  )
);
comment on table luma.campaign_feedback is
  'Respostas contextuais e pedidos de conteúdo. Sem entidade de franquia no V1; franchise_id fica nulo.';
create index campaign_feedback_user_created on luma.campaign_feedback(user_id,created_at desc);
create index campaign_feedback_created on luma.campaign_feedback(created_at desc,id);
create index campaign_feedback_requests on luma.campaign_feedback(query_normalized,created_at desc)
  where type='content_request';
alter table luma.campaign_feedback enable row level security;
revoke all on luma.campaign_feedback from anon,authenticated;
grant select,insert on luma.campaign_feedback to authenticated;
create policy "conta ativa grava feedback próprio" on luma.campaign_feedback
  for insert to authenticated with check (
    user_id=(select auth.uid()) and exists (
      select 1 from public.profiles where id=(select auth.uid()) and ativo
    )
  );
create policy "dono ou equipe lê feedback" on luma.campaign_feedback
  for select to authenticated using (
    exists (select 1 from public.profiles where id=(select auth.uid()) and ativo)
    and (user_id=(select auth.uid()) or (select public.is_designer()))
  );

-- Definir horário/identidade no banco também para INSERT direto, que é permitido
-- pela policy. Um cliente não pode empurrar feedback pro futuro no painel.
create function luma.feedback_before_insert()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.user_id is distinct from auth.uid() then
    raise exception 'Feedback deve pertencer à conta atual' using errcode='42501';
  end if;
  new.created_at:=now();
  return new;
end;
$$;
revoke all on function luma.feedback_before_insert() from public,anon,authenticated;
create trigger feedback_identity before insert on luma.campaign_feedback
  for each row execute function luma.feedback_before_insert();

-- O evento nasce na mesma transação. Falha de rede/retry não diverge a contagem
-- do registro canônico; não emitir outro evento equivalente no JavaScript.
create function luma.feedback_after_insert()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  insert into analytics.fct_eventos(evento,user_id,role,payload)
  values(
    case when new.type='content_request' then 'content_requested' else 'campaign_feedback_submitted' end,
    new.user_id,public.get_user_role(),
    jsonb_build_object('feedback_id',new.id,'action_id',new.action_id,'camp_id',new.camp_id,
      'template_id',new.template_id,'fmt_id',new.fmt_id,'franchise_id',new.franchise_id,
      'rating',new.rating,'reason',new.reason,'query',new.query,'query_normalized',new.query_normalized,
      'source',new.source,'client_created_at',new.client_created_at)
  );
  return new;
end;
$$;
revoke all on function luma.feedback_after_insert() from public,anon,authenticated;
create trigger feedback_event after insert on luma.campaign_feedback
  for each row execute function luma.feedback_after_insert();

create function luma.submit_feedback(p_feedback jsonb)
returns uuid language plpgsql security invoker set search_path = ''
as $$
declare
  confirmed_id uuid;
begin
  if not exists (select 1 from public.profiles where id=auth.uid() and ativo) then
    raise exception 'Conta ativa necessária' using errcode='42501';
  end if;
  if p_feedback is null or jsonb_typeof(p_feedback)<>'object' or pg_column_size(p_feedback)>8192 then
    raise exception 'Feedback inválido' using errcode='22023';
  end if;
  if p_feedback->>'user_id' is not null and p_feedback->>'user_id'<>auth.uid()::text then
    raise exception 'A sessão mudou; tente com a conta original' using errcode='42501';
  end if;
  insert into luma.campaign_feedback (
    id,user_id,type,action_id,camp_id,camp_name,template_id,template_name,fmt_id,franchise_id,
    rating,reason,comment,query,source,client_created_at
  ) values (
    (p_feedback->>'id')::uuid,auth.uid(),p_feedback->>'type',p_feedback->>'action_id',
    p_feedback->>'camp_id',p_feedback->>'camp_name',p_feedback->>'template_id',
    p_feedback->>'template_name',p_feedback->>'fmt_id',p_feedback->>'franchise_id',
    p_feedback->>'rating',p_feedback->>'reason',nullif(btrim(p_feedback->>'comment'),''),
    nullif(btrim(p_feedback->>'query'),''),p_feedback->>'source',
    coalesce((p_feedback->>'client_created_at')::timestamptz,now())
  ) on conflict do nothing;
  select id into confirmed_id from luma.campaign_feedback
    where user_id=auth.uid() and action_id=p_feedback->>'action_id' and type=p_feedback->>'type';
  if confirmed_id is null then
    raise exception 'Identidade do feedback já utilizada; tente novamente' using errcode='22023';
  end if;
  return confirmed_id;
end;
$$;
revoke all on function luma.submit_feedback(jsonb) from public,anon;
grant execute on function luma.submit_feedback(jsonb) to authenticated;

create function luma.content_requests(p_limit integer default 20,p_offset integer default 0)
returns table(query_normalized text,query text,request_count bigint,last_requested_at timestamptz)
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if not public.is_designer() or not exists (
    select 1 from public.profiles where id=auth.uid() and ativo
  ) then
    raise exception 'Somente a equipe pode consultar solicitações' using errcode='42501';
  end if;
  return query select f.query_normalized,min(f.query),count(*),max(f.created_at)
    from luma.campaign_feedback f where f.type='content_request'
    group by f.query_normalized
    order by count(*) desc,max(f.created_at) desc,f.query_normalized
    limit greatest(1,least(coalesce(p_limit,20),100)) offset greatest(0,coalesce(p_offset,0));
end;
$$;
revoke all on function luma.content_requests(integer,integer) from public,anon;
grant execute on function luma.content_requests(integer,integer) to authenticated;
