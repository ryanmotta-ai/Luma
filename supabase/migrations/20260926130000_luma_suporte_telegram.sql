-- ============================================================
-- LUMA — Suporte pelo Telegram (a ponte), 26/09/2026
-- ============================================================
-- Decisão do Ryan (26/09): a equipe recebe e responde o suporte pelo Telegram, sem o painel do
-- Luma aberto. Prints vão junto. Quem se declara disponível no Telegram aparece ONLINE para o
-- franqueado. Jurídico aprovou os dados do franqueado no Telegram. Estudo: docs/SUPORTE-TELEGRAM.md.
-- ⛔ Depende de 20260926120000_luma_suporte_atendimento (estado, responsável, trava).
--
-- COMO FUNCIONA
--   Luma → Telegram: toda mensagem nascida no Luma e todo evento do atendimento entram na fila
--     luma.suporte_telegram_saida. O INSERT na fila chama a Edge Function `suporte-telegram` por
--     pg_net (sai depois do commit); o pg_cron chama de novo a cada minuto, porque o pg_net NÃO
--     tenta de novo quando falha. A função posta no tópico do franqueado (um tópico por conversa,
--     no supergrupo privado da equipe).
--   Telegram → Luma: o webhook cai na mesma função, que chama luma.suporte_telegram_acao. Ela
--     assume a identidade do atendente VINCULADO só dentro da transação (request.jwt.claims) e
--     grava pelo caminho normal — o gatilho de carimbo, a trava de responsável e o histórico valem
--     igual à resposta dada no Luma. Nada de segundo caminho de escrita.
--
-- SEGURANÇA
--   · Tudo que a função usa é RPC SECURITY DEFINER com execute SÓ para service_role.
--   · A função confere o segredo (cabeçalho X-Telegram-Bot-Api-Secret-Token) — o mesmo valor
--     mora no Vault (luma_suporte_telegram_segredo) para o banco chamar a função. Sem o segredo
--     no Vault, a ponte está desligada: nada entra na fila.
--   · Vínculo de conta: o bot entrega um código de uso único (10 min, guardado como hash) e a
--     pessoa da equipe cola no Luma. Só equipe ATIVA responde; desativar no Luma corta na hora.

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- De onde veio a mensagem. Quem decide é o gatilho abaixo, nunca o navegador: a RPC da ponte
-- marca a transação, e qualquer outro INSERT vira 'luma'.
alter table luma.suporte_mensagens add column if not exists via text not null default 'luma'
  check (via in ('luma', 'telegram'));

create or replace function luma.suporte_msg_via()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.via := case when current_setting('luma.suporte_via', true) = 'telegram' then 'telegram' else 'luma' end;
  return new;
end;
$$;
revoke all on function luma.suporte_msg_via() from public, anon, authenticated;
drop trigger if exists suporte_msg_via on luma.suporte_mensagens;
create trigger suporte_msg_via before insert on luma.suporte_mensagens
  for each row execute function luma.suporte_msg_via();

/* ── Tabelas da ponte. Nenhuma escrita pelo cliente; a pessoa lê só o próprio vínculo. ── */
create table if not exists luma.suporte_telegram_contas (
  profile_id       uuid primary key references public.profiles(id) on delete cascade,
  telegram_user_id bigint not null unique,
  telegram_nome    text check (char_length(telegram_nome) <= 80),
  disponivel_ate   timestamptz,   -- /disponivel no Telegram: conta como ONLINE para o franqueado até aqui
  vinculada_em     timestamptz not null default now()
);

create table if not exists luma.suporte_telegram_codigos (
  codigo_hash      text primary key,
  telegram_user_id bigint not null,
  telegram_nome    text check (char_length(telegram_nome) <= 80),
  expira_em        timestamptz not null
);

create table if not exists luma.suporte_telegram_topicos (
  franqueado_id uuid primary key references public.profiles(id) on delete cascade,
  chat_id       bigint not null,
  thread_id     bigint not null,
  criado_em     timestamptz not null default now(),
  unique (chat_id, thread_id)
);

create table if not exists luma.suporte_telegram_saida (
  id            bigint generated always as identity primary key,
  franqueado_id uuid not null references public.profiles(id) on delete cascade,
  mensagem_id   bigint references luma.suporte_mensagens(id) on delete cascade,
  evento_id     bigint references luma.suporte_eventos(id) on delete cascade,
  criado_em     timestamptz not null default now(),
  pego_em       timestamptz,        -- "aluguel" de 2 min: duas execuções da função não mandam o mesmo item
  enviado_em    timestamptz,
  tentativas    int not null default 0,
  erro          text,
  constraint suporte_tg_saida_um_alvo check ((mensagem_id is null) <> (evento_id is null))
);
create index if not exists suporte_tg_saida_pendente_idx on luma.suporte_telegram_saida (id) where enviado_em is null;

-- O Telegram reenvia o update quando a resposta não é 2XX: o update_id descarta o repetido.
create table if not exists luma.suporte_telegram_updates (
  update_id   bigint primary key,
  recebido_em timestamptz not null default now()
);

alter table luma.suporte_telegram_contas  enable row level security;
alter table luma.suporte_telegram_codigos enable row level security;
alter table luma.suporte_telegram_topicos enable row level security;
alter table luma.suporte_telegram_saida   enable row level security;
alter table luma.suporte_telegram_updates enable row level security;

drop policy if exists "telegram: lê o próprio vínculo" on luma.suporte_telegram_contas;
create policy "telegram: lê o próprio vínculo" on luma.suporte_telegram_contas
  for select to authenticated using (profile_id = (select auth.uid()));

revoke all on luma.suporte_telegram_contas, luma.suporte_telegram_codigos, luma.suporte_telegram_topicos,
              luma.suporte_telegram_saida, luma.suporte_telegram_updates from anon, authenticated;
grant select on luma.suporte_telegram_contas to authenticated;

/* ── Fila: o que nasce no Luma vai para o Telegram. O que veio do Telegram não volta (eco). ── */
create or replace function luma.suporte_telegram_enfileirar()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  -- Ponte não configurada (sem segredo no Vault) = não acumula fila para despejar depois.
  if not exists (select 1 from vault.secrets where name = 'luma_suporte_telegram_segredo') then return null; end if;
  if tg_table_name = 'suporte_mensagens' then
    if new.via = 'luma' then
      insert into luma.suporte_telegram_saida (franqueado_id, mensagem_id) values (new.franqueado_id, new.id);
    end if;
  else
    insert into luma.suporte_telegram_saida (franqueado_id, evento_id) values (new.franqueado_id, new.id);
  end if;
  return null;
end;
$$;
revoke all on function luma.suporte_telegram_enfileirar() from public, anon, authenticated;
drop trigger if exists suporte_telegram_msg on luma.suporte_mensagens;
create trigger suporte_telegram_msg after insert on luma.suporte_mensagens
  for each row execute function luma.suporte_telegram_enfileirar();
drop trigger if exists suporte_telegram_evt on luma.suporte_eventos;
create trigger suporte_telegram_evt after insert on luma.suporte_eventos
  for each row execute function luma.suporte_telegram_enfileirar();

-- Acorda a função. A URL é pública (é o endereço do projeto); o segredo vem do Vault.
-- ⛔ Nunca lança: um aviso que falha não pode derrubar a mensagem do franqueado.
create or replace function luma.suporte_telegram_chutar()
returns void language plpgsql security definer set search_path = ''
as $$
declare s text;
begin
  if not exists (select 1 from luma.suporte_telegram_saida where enviado_em is null and tentativas < 8) then return; end if;
  select decrypted_secret into s from vault.decrypted_secrets where name = 'luma_suporte_telegram_segredo';
  if s is null then return; end if;
  perform net.http_post(
    url := 'https://uqrqzjafhigjuvtjqzid.supabase.co/functions/v1/suporte-telegram',
    body := '{"chute":true}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-Telegram-Bot-Api-Secret-Token', s),
    timeout_milliseconds := 10000);
exception when others then
  raise warning '[suporte-telegram] chute falhou: %', sqlerrm;
end;
$$;
revoke all on function luma.suporte_telegram_chutar() from public, anon, authenticated;

create or replace function luma.suporte_telegram_chutar_trg()
returns trigger language plpgsql security definer set search_path = ''
as $$ begin perform luma.suporte_telegram_chutar(); return null; end; $$;
revoke all on function luma.suporte_telegram_chutar_trg() from public, anon, authenticated;
drop trigger if exists suporte_telegram_chute on luma.suporte_telegram_saida;
create trigger suporte_telegram_chute after insert on luma.suporte_telegram_saida
  for each statement execute function luma.suporte_telegram_chutar_trg();

-- Rede de segurança: a cada minuto, o que ficou para trás (falha do pg_net, 429, função fria).
select cron.schedule('luma-suporte-telegram', '* * * * *', 'select luma.suporte_telegram_chutar()');

/* ── RPCs da Edge Function (execute SÓ para service_role) ── */

-- Pega até N itens da fila com "aluguel" de 2 min e devolve tudo o que a função precisa para postar.
create or replace function luma.suporte_telegram_pegar(p_limite int default 10)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare r jsonb;
begin
  with pegos as (
    update luma.suporte_telegram_saida s set pego_em = now()
     where s.id in (select x.id from luma.suporte_telegram_saida x
                     where x.enviado_em is null and x.tentativas < 8
                       and (x.pego_em is null or x.pego_em < now() - interval '2 minutes')
                     order by x.id limit greatest(1, least(coalesce(p_limite, 10), 50))
                     for update skip locked)
    returning s.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'franqueado_id', p.franqueado_id,
           'franqueado_nome', pr.nome, 'cidade', pr.cidade,
           'chat_id', t.chat_id, 'thread_id', t.thread_id,
           'mensagem', case when m.id is null then null else jsonb_build_object(
               'texto', m.texto, 'anexo_path', m.anexo_path, 'da_equipe', m.da_equipe,
               'autor_nome', m.autor_nome, 'contexto', m.contexto) end,
           'evento', case when e.id is null then null else jsonb_build_object(
               'tipo', e.tipo, 'ator_nome', e.ator_nome, 'de_nome', e.de_nome, 'para_nome', e.para_nome) end
         ) order by p.id), '[]'::jsonb)
    into r
    from pegos p
    left join public.profiles pr on pr.id = p.franqueado_id
    left join luma.suporte_telegram_topicos t on t.franqueado_id = p.franqueado_id
    left join luma.suporte_mensagens m on m.id = p.mensagem_id
    left join luma.suporte_eventos e on e.id = p.evento_id;
  delete from luma.suporte_telegram_updates where recebido_em < now() - interval '2 days';
  return r;
end;
$$;

-- Enviado (p_erro nulo) ou falhou: a falha conta tentativa e o aluguel devolve o item em 2 min.
create or replace function luma.suporte_telegram_feito(p_id bigint, p_erro text)
returns void language sql security definer set search_path = ''
as $$
  update luma.suporte_telegram_saida
     set enviado_em = case when p_erro is null then now() end,
         erro       = left(p_erro, 500),
         tentativas = tentativas + case when p_erro is null then 0 else 1 end
   where id = p_id;
$$;

-- Guarda (ou esquece, com p_thread nulo) o tópico do franqueado.
create or replace function luma.suporte_telegram_topico(p_franqueado uuid, p_chat bigint, p_thread bigint)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_thread is null then
    delete from luma.suporte_telegram_topicos where franqueado_id = p_franqueado;
    return;
  end if;
  insert into luma.suporte_telegram_topicos (franqueado_id, chat_id, thread_id) values (p_franqueado, p_chat, p_thread)
  on conflict (franqueado_id) do update set chat_id = excluded.chat_id, thread_id = excluded.thread_id, criado_em = now();
end;
$$;

-- true = update novo; false = repetido (já tratado).
create or replace function luma.suporte_telegram_update(p_update_id bigint)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  insert into luma.suporte_telegram_updates (update_id) values (p_update_id) on conflict do nothing;
  return found;
end;
$$;

-- Código de vínculo pedido no chat privado com o bot (/start). Vale 10 min, uso único.
create or replace function luma.suporte_telegram_codigo(p_tg bigint, p_nome text)
returns text language plpgsql security definer set search_path = ''
as $$
declare c text := upper(encode(extensions.gen_random_bytes(4), 'hex'));
begin
  delete from luma.suporte_telegram_codigos where expira_em < now() or telegram_user_id = p_tg;
  insert into luma.suporte_telegram_codigos (codigo_hash, telegram_user_id, telegram_nome, expira_em)
  values (encode(sha256(convert_to(c, 'UTF8')), 'hex'), p_tg, left(btrim(coalesce(p_nome, '')), 80), now() + interval '10 minutes');
  return substr(c, 1, 4) || '-' || substr(c, 5, 4);
end;
$$;

-- Quem no Luma é este usuário do Telegram — só equipe ATIVA (desativar no Luma corta a ponte).
create or replace function luma.suporte_telegram_pessoa(p_tg bigint)
returns uuid language sql stable security definer set search_path = ''
as $$
  select c.profile_id from luma.suporte_telegram_contas c
    join public.profiles p on p.id = c.profile_id
   where c.telegram_user_id = p_tg and p.role in ('equipe_dm', 'gestao') and p.ativo;
$$;
revoke all on function luma.suporte_telegram_pessoa(bigint) from public, anon, authenticated;

-- De quem é este tópico, e quem escreveu tem conta vinculada?
create or replace function luma.suporte_telegram_conversa(p_tg bigint, p_chat bigint, p_thread bigint)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('franqueado_id', t.franqueado_id, 'vinculado', luma.suporte_telegram_pessoa(p_tg) is not null)
    from luma.suporte_telegram_topicos t where t.chat_id = p_chat and t.thread_id = p_thread;
$$;

-- Tudo que vem do Telegram entra por aqui: responder, assumir, resolver, repassar, disponível, ausente.
create or replace function luma.suporte_telegram_acao(p_tg bigint, p_franqueado uuid, p_acao text,
                                                     p_texto text default null, p_anexo text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare eu uuid := luma.suporte_telegram_pessoa(p_tg); para text; n int; ate timestamptz;
begin
  if eu is null then return jsonb_build_object('ok', false, 'erro', 'nao_vinculado'); end if;
  -- Daqui para baixo o banco enxerga ESTA pessoa (auth.uid()), só nesta transação.
  perform set_config('request.jwt.claims', json_build_object('sub', eu, 'role', 'authenticated')::text, true);

  if p_acao = 'disponivel' then
    ate := now() + interval '8 hours';   -- um turno; /ausente encerra antes
    update luma.suporte_telegram_contas set disponivel_ate = ate where profile_id = eu;
    return jsonb_build_object('ok', true, 'ate', ate);
  elsif p_acao = 'ausente' then
    update luma.suporte_telegram_contas set disponivel_ate = null where profile_id = eu;
    return jsonb_build_object('ok', true);
  end if;

  if p_franqueado is null then return jsonb_build_object('ok', false, 'erro', 'sem_conversa'); end if;
  if p_acao = 'assumir' then return luma.suporte_assumir(p_franqueado, true); end if;
  if p_acao = 'resolver' then return luma.suporte_resolver(p_franqueado); end if;
  if p_acao = 'repassar' then
    select count(*), min(p.id::text) into n, para from public.profiles p
     where p.role in ('equipe_dm', 'gestao') and p.ativo
       and lower(split_part(btrim(p.nome), ' ', 1)) = lower(split_part(btrim(coalesce(p_texto, '')), ' ', 1));
    if n = 0 then return jsonb_build_object('ok', false, 'erro', 'destino_invalido'); end if;
    if n > 1 then return jsonb_build_object('ok', false, 'erro', 'destino_ambiguo'); end if;
    return luma.suporte_repassar(p_franqueado, para::uuid);
  end if;

  if p_acao = 'responder' then
    perform set_config('luma.suporte_via', 'telegram', true);
    begin
      insert into luma.suporte_mensagens (franqueado_id, texto, anexo_path)
      values (p_franqueado, coalesce(left(p_texto, 4000), ''), p_anexo);
      perform set_config('luma.suporte_via', '', true);   -- a marca vale só para ESTE insert
    exception when others then
      if sqlerrm like '%SUPORTE_OUTRO_RESPONSAVEL%' then
        return jsonb_build_object('ok', false, 'erro', 'outro_responsavel', 'responsavel_nome',
          luma.suporte_primeiro_nome((select c.responsavel_id from luma.suporte_conversas c where c.franqueado_id = p_franqueado)));
      end if;
      raise;
    end;
    -- Respondeu = leu: o franqueado vê o "Visto" como se a resposta tivesse saído do Luma.
    update luma.suporte_mensagens set lida_em = now()
     where franqueado_id = p_franqueado and not da_equipe and lida_em is null;
    return jsonb_build_object('ok', true);
  end if;
  return jsonb_build_object('ok', false, 'erro', 'acao_invalida');
end;
$$;

revoke all on function luma.suporte_telegram_pegar(int) from public, anon, authenticated;
revoke all on function luma.suporte_telegram_feito(bigint, text) from public, anon, authenticated;
revoke all on function luma.suporte_telegram_topico(uuid, bigint, bigint) from public, anon, authenticated;
revoke all on function luma.suporte_telegram_update(bigint) from public, anon, authenticated;
revoke all on function luma.suporte_telegram_codigo(bigint, text) from public, anon, authenticated;
revoke all on function luma.suporte_telegram_conversa(bigint, bigint, bigint) from public, anon, authenticated;
revoke all on function luma.suporte_telegram_acao(bigint, uuid, text, text, text) from public, anon, authenticated;
grant usage on schema luma to service_role;
grant execute on function luma.suporte_telegram_pegar(int) to service_role;
grant execute on function luma.suporte_telegram_feito(bigint, text) to service_role;
grant execute on function luma.suporte_telegram_topico(uuid, bigint, bigint) to service_role;
grant execute on function luma.suporte_telegram_update(bigint) to service_role;
grant execute on function luma.suporte_telegram_codigo(bigint, text) to service_role;
grant execute on function luma.suporte_telegram_conversa(bigint, bigint, bigint) to service_role;
grant execute on function luma.suporte_telegram_acao(bigint, uuid, text, text, text) to service_role;

/* ── RPCs do Luma (a pessoa da equipe, logada) ── */
create or replace function luma.suporte_telegram_vincular(p_codigo text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare c luma.suporte_telegram_codigos%rowtype; eu uuid := auth.uid(); h text;
begin
  if not coalesce(public.is_designer(), false) then raise exception 'SUPORTE_SO_EQUIPE' using errcode = '42501'; end if;
  h := encode(sha256(convert_to(upper(regexp_replace(coalesce(p_codigo, ''), '[^0-9A-Za-z]', '', 'g')), 'UTF8')), 'hex');
  select * into c from luma.suporte_telegram_codigos where codigo_hash = h and expira_em > now();
  if not found then return jsonb_build_object('ok', false, 'erro', 'codigo_invalido'); end if;
  delete from luma.suporte_telegram_codigos where codigo_hash = h;
  -- Um Telegram = uma pessoa do Luma: vincular aqui desfaz um vínculo antigo do mesmo Telegram.
  delete from luma.suporte_telegram_contas where telegram_user_id = c.telegram_user_id and profile_id <> eu;
  insert into luma.suporte_telegram_contas (profile_id, telegram_user_id, telegram_nome)
  values (eu, c.telegram_user_id, c.telegram_nome)
  on conflict (profile_id) do update
    set telegram_user_id = excluded.telegram_user_id, telegram_nome = excluded.telegram_nome,
        vinculada_em = now(), disponivel_ate = null;
  return jsonb_build_object('ok', true, 'telegram_nome', c.telegram_nome);
end;
$$;

create or replace function luma.suporte_telegram_desvincular()
returns void language sql security definer set search_path = ''
as $$ delete from luma.suporte_telegram_contas where profile_id = auth.uid(); $$;

revoke all on function luma.suporte_telegram_vincular(text) from public, anon;
revoke all on function luma.suporte_telegram_desvincular() from public, anon;
grant execute on function luma.suporte_telegram_vincular(text) to authenticated;
grant execute on function luma.suporte_telegram_desvincular() to authenticated;

/* ── O cartão da equipe ganha "disponível pelo Telegram até": é o que põe essa pessoa no
   "online agora" do franqueado (decisão do Ryan). Mudar colunas de retorno exige drop. ── */
drop function if exists luma.suporte_equipe();
create function luma.suporte_equipe()
returns table (id uuid, nome text, cargo text, avatar_url text, telegram_ate timestamptz)
language sql stable security definer set search_path = ''
as $$
  select p.id, btrim(coalesce(p.nome, '')), coalesce(nullif(btrim(p.departamento), ''), 'Equipe DM'), p.avatar_url,
         case when c.disponivel_ate > now() then c.disponivel_ate end
    from public.profiles p
    left join luma.suporte_telegram_contas c on c.profile_id = p.id
   where p.role in ('equipe_dm', 'gestao') and p.ativo and (select public.is_ativo())
   order by p.nome;
$$;
revoke all on function luma.suporte_equipe() from public, anon;
grant execute on function luma.suporte_equipe() to authenticated;

-- Chave do Controle do produto para a tela de vínculo. Nasce DESLIGADA: a gestão liga depois de
-- criar o bot e configurar os segredos (docs/SUPORTE-TELEGRAM.md, "Como ligar").
insert into luma.feature_flags (feature_key, enabled, disabled_behavior)
values ('global.help.suporte.telegram', false, 'hide')
on conflict (feature_key) do nothing;

-- ============================================================
-- DEPOIS DE APLICAR (e só com o bot criado — docs/SUPORTE-TELEGRAM.md, "Como ligar"):
--   select vault.create_secret('<o mesmo TELEGRAM_WEBHOOK_SECRET da função>', 'luma_suporte_telegram_segredo');
--   select jobname, schedule from cron.job where jobname = 'luma-suporte-telegram';
-- E rodar supabase/tests/rls.sql (casos "telegram:").
-- ============================================================
