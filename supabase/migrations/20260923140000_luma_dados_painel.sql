-- ============================================================
-- LUMA — Painel de Dados (product intelligence), 23/09/2026
-- ============================================================
-- Três leituras para a área "Dados" do painel de gestão (js/core/dados.js). O schema
-- analytics segue FORA da Data API: o front só enxerga estas funções no schema luma.
--
-- SECURITY INVOKER de propósito: quem responde pela fronteira continua sendo a RLS
-- ("designer lê eventos" em analytics.fct_eventos; profiles/templates/pastas/feedback já
-- liberam leitura para a equipe). A checagem no topo só dá uma mensagem clara em vez de
-- um painel vazio. Quem vê: gestão e equipe DM (is_designer) — decisão do Ryan.
--
-- SESSÃO: eventos novos trazem payload._ctx.sid (uma por aba). Eventos antigos (antes de
-- 23/09) não têm; para eles a "sessão" é pessoa+dia. A mesma chave serve ao funil.
-- DIA: sempre no fuso de America/Sao_Paulo.

create or replace function luma._dados_autoriza()
returns void language plpgsql stable security invoker set search_path = ''
as $$
begin
  if not (public.is_designer() and public.is_ativo()) then
    raise exception 'Somente gestão e equipe DM veem os dados' using errcode = '42501';
  end if;
end;
$$;
revoke all on function luma._dados_autoriza() from public, anon;
grant execute on function luma._dados_autoriza() to authenticated;

-- Último login mora em auth.users, que o usuário logado não lê. Esta função devolve só
-- id/last_sign_in_at/created_at, e só para quem é da equipe (vazio para os demais).
create or replace function luma._dados_logins()
returns table(id uuid, last_sign_in_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select u.id, u.last_sign_in_at, u.created_at from auth.users u where public.is_designer();
$$;
revoke all on function luma._dados_logins() from public, anon;
grant execute on function luma._dados_logins() to authenticated;

create or replace function luma.dados_painel(p_de timestamptz, p_ate timestamptz)
returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_de  timestamptz := coalesce(p_de, now() - interval '30 days');
  v_ate timestamptz := coalesce(p_ate, now());
  v_len interval;
  r jsonb;
begin
  perform luma._dados_autoriza();
  if v_ate <= v_de then v_ate := v_de + interval '1 day'; end if;
  v_len := v_ate - v_de;

  with
  ev as (
    select e.id, e.evento, e.user_id, e.role, e.payload, e.ocorreu_em,
           (e.ocorreu_em at time zone 'America/Sao_Paulo')::date as dia,
           coalesce(e.payload->'_ctx'->>'sid',
                    e.user_id::text || ':' || ((e.ocorreu_em at time zone 'America/Sao_Paulo')::date)::text) as chave
    from analytics.fct_eventos e
    where e.ocorreu_em >= v_de and e.ocorreu_em < v_ate
  ),
  ev_ant as (
    select e.evento, e.user_id,
           coalesce(e.payload->'_ctx'->>'sid',
                    e.user_id::text || ':' || ((e.ocorreu_em at time zone 'America/Sao_Paulo')::date)::text) as chave
    from analytics.fct_eventos e
    where e.ocorreu_em >= v_de - v_len and e.ocorreu_em < v_de
  ),
  -- Tempo ATIVO: soma dos intervalos entre ações, ignorando pausas de +30 min. Evento antigo
  -- (sem sid) agrupa o dia inteiro; sem isto a pessoa que abriu às 8h e às 18h "ficou" 10h.
  ev_ord as (
    select chave, user_id, evento, ocorreu_em,
           extract(epoch from ocorreu_em - lag(ocorreu_em) over (partition by chave order by ocorreu_em)) as gap_s
    from ev
  ),
  sess as (
    select chave, min(user_id::text)::uuid as user_id, min(ocorreu_em) as ini, max(ocorreu_em) as fim,
           coalesce(sum(gap_s) filter (where gap_s <= 1800), 0) as dur_s,
           min(ocorreu_em) filter (where evento = 'arte_gerada') as primeira_arte
    from ev_ord group by chave
  ),
  dl as (
    select * from ev where evento in ('arte_baixada','lote_baixado','kit_baixado','arte_compartilhada')
  ),
  kpis as (
    select jsonb_build_object(
      'pessoas_ativas', (select count(distinct user_id) from ev),
      'pessoas_total', (select count(*) from public.profiles where ativo),
      'sessoes', (select count(*) from sess),
      'dur_mediana_s', (select round(percentile_cont(0.5) within group (order by dur_s))::int from sess),
      'artes_geradas', (select count(*) from ev where evento = 'arte_gerada'),
      'downloads', (select count(*) from dl),
      'downloads_tipo', jsonb_build_object(
        'png', (select count(*) from dl where evento = 'arte_baixada' and coalesce(payload->>'tipo','png') = 'png'),
        'pdf', (select count(*) from dl where evento = 'arte_baixada' and payload->>'tipo' = 'pdf'),
        'lote', (select count(*) from dl where evento = 'lote_baixado'),
        'kit', (select count(*) from dl where evento = 'kit_baixado'),
        'compartilhada', (select count(*) from dl where evento = 'arte_compartilhada')),
      'taxa_download', (select case when g = 0 then null else round(least(b::numeric / g, 1), 4) end
                        from (select count(*) filter (where evento = 'arte_gerada') g,
                                     count(*) filter (where evento in ('arte_baixada','arte_compartilhada')) b from ev) t),
      'primeira_arte_mediana_s', (select round(percentile_cont(0.5) within group
                                   (order by extract(epoch from primeira_arte - ini)))::int
                                  from sess where primeira_arte is not null),
      'anterior', jsonb_build_object(
        'pessoas_ativas', (select count(distinct user_id) from ev_ant),
        'sessoes', (select count(distinct chave) from ev_ant),
        'artes_geradas', (select count(*) from ev_ant where evento = 'arte_gerada'),
        'downloads', (select count(*) from ev_ant where evento in ('arte_baixada','lote_baixado','kit_baixado','arte_compartilhada')))
    ) as j
  ),
  dias as (
    select d::date as dia
    from generate_series((v_de at time zone 'America/Sao_Paulo')::date,
                         ((v_ate - interval '1 second') at time zone 'America/Sao_Paulo')::date, interval '1 day') d
  ),
  por_dia as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'dia', to_char(dd.dia, 'YYYY-MM-DD'),
      'pessoas', coalesce(x.pessoas, 0), 'sessoes', coalesce(x.sessoes, 0),
      'artes', coalesce(x.artes, 0), 'downloads', coalesce(x.downloads, 0)) order by dd.dia), '[]') as j
    from dias dd left join (
      select dia, count(distinct user_id) pessoas, count(distinct chave) sessoes,
             count(*) filter (where evento = 'arte_gerada') artes,
             count(*) filter (where evento in ('arte_baixada','lote_baixado','kit_baixado','arte_compartilhada')) downloads
      from ev group by dia) x on x.dia = dd.dia
  ),
  funil_geral as (
    select jsonb_agg(jsonb_build_object('etapa', etapa, 'rotulo', rotulo,
             'n', (select count(distinct chave) from ev where evento = any(evs))) order by ordem) as j
    from (values
      (1, 'campanha_aberta', 'Campanha aberta', array['campanha_aberta']),
      (2, 'material_aberto', 'Material aberto', array['material_aberto']),
      (3, 'pergunta_respondida', 'Preencheu campos', array['pergunta_respondida']),
      (4, 'arte_gerada', 'Arte gerada', array['arte_gerada']),
      (5, 'arte_baixada', 'Baixou ou compartilhou', array['arte_baixada','arte_compartilhada'])
    ) f(ordem, etapa, rotulo, evs)
  ),
  por_material as (
    select coalesce(jsonb_agg(to_jsonb(m) order by m.abriu desc, m.gerou desc), '[]') as j from (
      select ev.payload->>'template_id' as template_id,
             coalesce(max(t.nome), max(ev.payload->>'template_name')) as template_name,
             coalesce(max(p.nome), max(ev.payload->>'camp_name')) as camp_name,
             count(distinct ev.chave) filter (where ev.evento = 'material_aberto') as abriu,
             count(distinct ev.chave) filter (where ev.evento = 'pergunta_respondida') as respondeu,
             count(distinct ev.chave) filter (where ev.evento = 'arte_gerada') as gerou,
             count(distinct ev.chave) filter (where ev.evento in ('arte_baixada','arte_compartilhada')) as baixou
      from ev
      left join luma.templates t on t.id::text = ev.payload->>'template_id'
      left join luma.pastas p on p.id = t.pasta_id
      where ev.payload->>'template_id' is not null
        and ev.evento in ('material_aberto','pergunta_respondida','arte_gerada','arte_baixada','arte_compartilhada')
      group by ev.payload->>'template_id'
      order by abriu desc limit 30) m
  ),
  pessoas as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', pr.id, 'nome', coalesce(pr.nome, split_part(pr.email, '@', 1)), 'email', pr.email,
      'role', pr.role, 'cidade', pr.cidade, 'franquia', pr.franquia, 'ativo', pr.ativo,
      'ultimo_acesso', greatest(ua.ult, u.last_sign_in_at),
      'sessoes', coalesce(s.sessoes, 0), 'tempo_s', coalesce(s.tempo_s, 0)::int,
      'artes', coalesce(a.artes, 0), 'downloads', coalesce(a.downloads, 0), 'disp', d.disp
    ) order by greatest(ua.ult, u.last_sign_in_at) desc nulls last), '[]') as j
    from public.profiles pr
    left join luma._dados_logins() u on u.id = pr.id
    left join (select user_id, max(ocorreu_em) ult from analytics.fct_eventos group by user_id) ua on ua.user_id = pr.id
    left join (select user_id, count(*) sessoes, sum(dur_s) tempo_s from sess group by user_id) s on s.user_id = pr.id
    left join (select user_id, count(*) filter (where evento = 'arte_gerada') artes,
                      count(*) filter (where evento in ('arte_baixada','lote_baixado','kit_baixado','arte_compartilhada')) downloads
               from ev group by user_id) a on a.user_id = pr.id
    left join (select distinct on (user_id) user_id, payload->'_ctx'->>'disp' as disp
               from ev where payload->'_ctx'->>'disp' is not null
               group by user_id, payload->'_ctx'->>'disp' order by user_id, count(*) desc) d on d.user_id = pr.id
  ),
  uso_tpl as (
    select payload->>'template_id' as tid,
           count(*) filter (where evento = 'material_aberto') abertos,
           count(*) filter (where evento = 'arte_gerada') gerados,
           count(*) filter (where evento in ('arte_baixada','arte_compartilhada')) baixados
    from ev where payload->>'template_id' is not null group by 1
  ),
  usado_sempre as (
    select distinct payload->>'template_id' as tid from analytics.fct_eventos
    where evento in ('material_aberto','arte_gerada','arte_baixada') and payload->>'template_id' is not null
  ),
  conteudo as (
    select jsonb_build_object(
      'templates', (select coalesce(jsonb_agg(jsonb_build_object(
          'template_id', t.id, 'nome', t.nome, 'pasta', p.nome, 'publicado', t.publicado,
          'abertos', coalesce(u.abertos, 0), 'gerados', coalesce(u.gerados, 0), 'baixados', coalesce(u.baixados, 0))
          order by coalesce(u.gerados, 0) desc, coalesce(u.abertos, 0) desc), '[]')
        from luma.templates t left join luma.pastas p on p.id = t.pasta_id
        left join uso_tpl u on u.tid = t.id::text
        where t.publicado or u.tid is not null),
      'nunca_usados', (select coalesce(jsonb_agg(jsonb_build_object(
          'template_id', t.id, 'nome', t.nome, 'pasta', p.nome, 'publicado_em', t.publicado_em)
          order by t.publicado_em nulls last), '[]')
        from luma.templates t left join luma.pastas p on p.id = t.pasta_id
        where t.publicado and not exists (select 1 from usado_sempre s where s.tid = t.id::text)),
      'campanhas', (select coalesce(jsonb_agg(to_jsonb(c) order by c.abertas desc), '[]') from (
          select ev.payload->>'camp_id' as camp_id,
                 coalesce(max(p.nome), max(ev.payload->>'camp_name')) as camp_name,
                 count(*) filter (where evento = 'campanha_aberta') abertas,
                 count(*) filter (where evento = 'arte_gerada') geradas,
                 count(*) filter (where evento in ('arte_baixada','arte_compartilhada')) baixadas,
                 count(distinct ev.user_id) pessoas
          from ev left join luma.pastas p on p.camp_id = ev.payload->>'camp_id'
          where ev.payload->>'camp_id' is not null
          group by ev.payload->>'camp_id') c),
      'formatos', (select coalesce(jsonb_agg(to_jsonb(f) order by f.geradas desc), '[]') from (
          select payload->>'fmt_id' as fmt_id,
                 count(*) filter (where evento = 'arte_gerada') geradas,
                 count(*) filter (where evento in ('arte_baixada','arte_compartilhada')) baixadas
          from ev where payload->>'fmt_id' is not null and evento in ('arte_gerada','arte_baixada','arte_compartilhada')
          group by 1) f)
    ) as j
  ),
  buscas as (
    select jsonb_build_object(
      'top', (select coalesce(jsonb_agg(to_jsonb(b) order by b.n desc), '[]') from (
          select coalesce(min(payload->>'query'), payload->>'query_normalized') as q, count(*) n,
                 bool_or(coalesce((payload->>'result_count')::int, 1) = 0) as sem_resultado
          from ev where evento = 'search_performed' and coalesce(payload->>'query_normalized','') <> ''
          group by payload->>'query_normalized' order by n desc limit 30) b),
      'sem_resultado', (select coalesce(jsonb_agg(to_jsonb(b) order by b.n desc), '[]') from (
          select coalesce(min(payload->>'query'), payload->>'query_normalized') as q, count(*) n, max(ocorreu_em) ultima
          from ev where evento = 'search_performed' and (payload->>'result_count')::int = 0
            and coalesce(payload->>'query_normalized','') <> ''
          group by payload->>'query_normalized' order by n desc limit 30) b),
      'pedidos', (select coalesce(jsonb_agg(to_jsonb(b) order by b.n desc), '[]') from (
          select min(f.query) as q, count(*) n, max(f.created_at) ultima
          from luma.campaign_feedback f
          where f.type = 'content_request' and f.created_at >= v_de and f.created_at < v_ate
          group by f.query_normalized order by n desc limit 30) b)
    ) as j
  ),
  qualidade as (
    select jsonb_build_object(
      'nao_cabe', (select coalesce(jsonb_agg(to_jsonb(q) order by q.n desc), '[]') from (
          select ev.payload->>'template_id' as template_id, max(t.nome) as template_name,
                 ev.payload->>'campo' as campo, count(*) n,
                 count(*) filter (where (ev.payload->>'tem_versao')::boolean) as com_versao
          from ev left join luma.templates t on t.id::text = ev.payload->>'template_id'
          where ev.evento = 'texto_nao_cabe'
          group by ev.payload->>'template_id', ev.payload->>'campo' order by n desc limit 30) q),
      'copyfit', jsonb_build_object(
          'exibido', (select count(*) from ev where evento = 'copyfit_balao_exibido'),
          'aplicado', (select count(*) from ev where evento = 'copyfit_aplicado'),
          'desfeito', (select count(*) from ev where evento = 'copyfit_desfeito'),
          'ia', (select count(*) from ev where evento = 'copyfit_ia')),
      'enquadramento', jsonb_build_object(
          'aplicar', (select count(*) from ev where evento = 'enquadramento_ajustado' and payload->>'acao' = 'aplicar'),
          'cancelar', (select count(*) from ev where evento = 'enquadramento_ajustado' and payload->>'acao' = 'cancelar')),
      'fotos', (select count(*) from ev where evento = 'foto_enviada'),
      'erros', (select coalesce(jsonb_agg(to_jsonb(x) order by x.n desc), '[]') from (
          select payload->>'msg' as msg, count(*) n, count(distinct user_id) pessoas, max(ocorreu_em) ultimo
          from ev where evento = 'erro_app' group by payload->>'msg' order by n desc limit 30) x)
    ) as j
  ),
  feedback as (
    select jsonb_build_object(
      'positivo', count(*) filter (where f.rating = 'positive'),
      'negativo', count(*) filter (where f.rating = 'negative'),
      'motivos', (select coalesce(jsonb_agg(to_jsonb(m) order by m.n desc), '[]') from (
          select reason, count(*) n from luma.campaign_feedback
          where type = 'campaign_feedback' and rating = 'negative' and created_at >= v_de and created_at < v_ate
          group by reason) m),
      'recentes', (select coalesce(jsonb_agg(to_jsonb(rc) order by rc.created_at desc), '[]') from (
          select coalesce(pr.nome, split_part(pr.email, '@', 1)) as nome, f2.camp_name, f2.rating, f2.reason,
                 f2.comment, f2.created_at
          from luma.campaign_feedback f2 left join public.profiles pr on pr.id = f2.user_id
          where f2.type = 'campaign_feedback' and f2.created_at >= v_de and f2.created_at < v_ate
          order by f2.created_at desc limit 20) rc)
    ) as j
    from luma.campaign_feedback f
    where f.type = 'campaign_feedback' and f.created_at >= v_de and f.created_at < v_ate
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('de', v_de, 'ate', v_ate, 'dias', ceil(extract(epoch from v_len) / 86400)::int),
    'kpis', (select j from kpis),
    'por_dia', (select j from por_dia),
    'funil', jsonb_build_object('geral', (select j from funil_geral), 'por_material', (select j from por_material)),
    'pessoas', (select j from pessoas),
    'conteudo', (select j from conteudo),
    'buscas', (select j from buscas),
    'qualidade', (select j from qualidade),
    'feedback', (select j from feedback)
  ) into r;
  return r;
end;
$$;
revoke all on function luma.dados_painel(timestamptz, timestamptz) from public, anon;
grant execute on function luma.dados_painel(timestamptz, timestamptz) to authenticated;

create or replace function luma.dados_pessoa(p_user uuid, p_de timestamptz, p_ate timestamptz)
returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
declare r jsonb;
begin
  perform luma._dados_autoriza();
  select jsonb_build_object(
    'pessoa', (select jsonb_build_object('user_id', pr.id, 'nome', coalesce(pr.nome, split_part(pr.email, '@', 1)),
                 'email', pr.email, 'role', pr.role, 'cidade', pr.cidade, 'franquia', pr.franquia, 'ativo', pr.ativo,
                 'ultimo_acesso', greatest((select max(ocorreu_em) from analytics.fct_eventos where user_id = pr.id), u.last_sign_in_at),
                 'criado_em', u.created_at)
               from public.profiles pr left join luma._dados_logins() u on u.id = pr.id where pr.id = p_user),
    'eventos', (select coalesce(jsonb_agg(jsonb_build_object('ocorreu_em', e.ocorreu_em, 'evento', e.evento, 'payload', e.payload)
                 order by e.ocorreu_em desc), '[]')
               from (select * from analytics.fct_eventos
                     where user_id = p_user
                       and ocorreu_em >= coalesce(p_de, now() - interval '30 days') and ocorreu_em < coalesce(p_ate, now())
                     order by ocorreu_em desc limit 500) e)
  ) into r;
  return r;
end;
$$;
revoke all on function luma.dados_pessoa(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function luma.dados_pessoa(uuid, timestamptz, timestamptz) to authenticated;

create or replace function luma.dados_eventos(p_de timestamptz, p_ate timestamptz, p_evento text default null,
                                               p_user uuid default null, p_limit int default 50, p_offset int default 0)
returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_de timestamptz := coalesce(p_de, now() - interval '30 days');
  v_ate timestamptz := coalesce(p_ate, now());
  r jsonb;
begin
  perform luma._dados_autoriza();
  with base as (
    select e.* from analytics.fct_eventos e
    where e.ocorreu_em >= v_de and e.ocorreu_em < v_ate
      and (p_user is null or e.user_id = p_user)
  )
  select jsonb_build_object(
    'total', (select count(*) from base where p_evento is null or evento = p_evento),
    'eventos_disponiveis', (select coalesce(jsonb_agg(jsonb_build_object('evento', evento, 'n', n) order by n desc), '[]')
                            from (select evento, count(*) n from base group by evento) x),
    'linhas', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'ocorreu_em', b.ocorreu_em, 'evento', b.evento,
                 'user_id', b.user_id, 'nome', coalesce(pr.nome, split_part(pr.email, '@', 1)), 'role', b.role,
                 'payload', b.payload) order by b.ocorreu_em desc), '[]')
               from (select * from base where p_evento is null or evento = p_evento
                     order by ocorreu_em desc
                     limit greatest(1, least(coalesce(p_limit, 50), 500)) offset greatest(0, coalesce(p_offset, 0))) b
               left join public.profiles pr on pr.id = b.user_id)
  ) into r;
  return r;
end;
$$;
revoke all on function luma.dados_eventos(timestamptz, timestamptz, text, uuid, int, int) from public, anon;
grant execute on function luma.dados_eventos(timestamptz, timestamptz, text, uuid, int, int) to authenticated;

