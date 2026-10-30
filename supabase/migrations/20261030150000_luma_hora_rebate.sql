-- ============================================================
-- LUMA — Hora rebate: o tempo que o Luma devolve ao franqueado, em horas e em R$ (30/10/2026)
-- ============================================================
-- Definição (Marco Severo, 30/10/2026): hora rebate = rebate médio mensal das franquias ÷ horas de
-- trabalho no mês (arbitradas em 240 h; funcionário são 200 h). Devolvido = Σ por ação
-- [quantidade × (tempo antes − tempo com o Luma)] × hora rebate. "Antes" por arte avulsa: 6 a 7 min
-- no Deskfy (Cícero, via Ryan); por lote/cardápio: "uma semana" (Marco) — premissas, não medidas.
-- Com o Luma é MEDIDO: tempo ativo por arte (sessões que geraram arte) e total_s do lote_gerado.
--
-- 1) Premissas em luma.potencial_parametros (já tem RLS: equipe lê, gestão escreve). Rebate médio
--    nasce 0 = "não informado": a tela mostra as horas e pede o valor. on conflict do nothing: rodar de
--    novo não desfaz ajuste da gestão.
-- 2) luma.dados_painel reescrita (a de 20261019120000) com kpis.hora_rebate.

insert into luma.potencial_parametros (chave, valor, descricao) values
  ('hora_rebate.rebate_medio',   '0'::jsonb,   'Hora rebate: rebate médio mensal das franquias, em R$. 0 = ainda não informado (a tela pede).'),
  ('hora_rebate.horas_mes',      '240'::jsonb, 'Hora rebate: horas de trabalho do franqueado no mês. 240 arbitradas pelo Marco (30/10/2026): é mais que as 200 de um funcionário.'),
  ('hora_rebate.antes_arte_min', '6.5'::jsonb, 'Hora rebate: minutos por arte ANTES do Luma (Deskfy). 6 a 7 min, base conversada com o Cícero (Ryan, 30/10/2026).'),
  ('hora_rebate.antes_lote_h',   '40'::jsonb,  'Hora rebate: horas por lote/cardápio ANTES do Luma. "Uma semana" (Marco, 30/10/2026) = 5 dias × 8 h. Premissa, não medida.')
on conflict (chave) do nothing;

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
  -- JORNADA EM TEMPO (19/10/2026): por sessão, a 1ª vez em cada etapa; devolve, por etapa, a mediana
  -- do intervalo desde a etapa anterior (só sessões que passaram pelas duas, na ordem) e desde a
  -- entrada (1º evento da sessão). "Até a 1ª arte" dos KPIs é o mesmo relógio: entrada → arte_gerada.
  jornada as (
    select chave, min(ocorreu_em) as t0,
           min(ocorreu_em) filter (where evento = 'campanha_aberta') as t1,
           min(ocorreu_em) filter (where evento = 'material_aberto') as t2,
           min(ocorreu_em) filter (where evento = 'pergunta_respondida') as t3,
           min(ocorreu_em) filter (where evento = 'arte_gerada') as t4,
           min(ocorreu_em) filter (where evento in ('arte_baixada','arte_compartilhada')) as t5
    from ev group by chave
  ),
  jornada_tempos as (
    select jsonb_agg(jsonb_build_object('etapa', e.etapa, 'rotulo', e.rotulo, 'n', x.n,
             'desde_anterior_s', x.ant, 'desde_entrada_s', x.acum) order by e.ordem) as j
    from (values
      (1, 'campanha_aberta', 'Campanha aberta'), (2, 'material_aberto', 'Material aberto'),
      (3, 'pergunta_respondida', 'Preencheu campos'), (4, 'arte_gerada', 'Arte gerada'),
      (5, 'arte_baixada', 'Baixou ou compartilhou')) e(ordem, etapa, rotulo)
    cross join lateral (
      -- n e "desde a entrada": toda sessão que chegou à etapa (bate com o funil e com o KPI da 1ª
      -- arte); "desde a anterior": só as que passaram pelas duas, na ordem (senão o intervalo é negativo).
      select count(*) filter (where s.tn is not null) as n,
             round(percentile_cont(0.5) within group (order by extract(epoch from s.tn - s.tp))
                   filter (where s.tn is not null and s.tp is not null and s.tn >= s.tp))::int as ant,
             round(percentile_cont(0.5) within group (order by extract(epoch from s.tn - s.t0))
                   filter (where s.tn is not null))::int as acum
      from (select j.t0,
                   case e.ordem when 1 then j.t1 when 2 then j.t2 when 3 then j.t3 when 4 then j.t4 else j.t5 end as tn,
                   case e.ordem when 1 then j.t0 when 2 then j.t1 when 3 then j.t2 when 4 then j.t3 else j.t4 end as tp
            from jornada j) s
    ) x
  ),
  -- CHURN (19/10/2026): só franqueados ativos (gestão e equipe testando inflariam a base). "Ativo" =
  -- qualquer evento no período. perdidos = ativo no período anterior e sem evento neste; voltaram =
  -- ativo agora, parado no anterior, mas com histórico antes dele; novos = 1ª atividade neste período.
  fr as (
    select id, coalesce(nome, split_part(email, '@', 1)) as nome, cidade
    from public.profiles where role = 'franqueado' and ativo
  ),
  fr_st as (
    select f.id, f.nome, f.cidade,
           exists (select 1 from ev a where a.user_id = f.id) as agora,
           exists (select 1 from ev_ant b where b.user_id = f.id) as antes,
           exists (select 1 from analytics.fct_eventos c where c.user_id = f.id and c.ocorreu_em < v_de - v_len) as antigo,
           (select max(ocorreu_em) from analytics.fct_eventos c where c.user_id = f.id) as ult
    from fr f
  ),
  churn as (
    select jsonb_build_object(
      'ativos_anterior', count(*) filter (where antes),
      'perdidos', count(*) filter (where antes and not agora),
      'voltaram', count(*) filter (where agora and not antes and antigo),
      'novos', count(*) filter (where agora and not antes and not antigo),
      'taxa', case when count(*) filter (where antes) = 0 then null
                   else round((count(*) filter (where antes and not agora))::numeric / count(*) filter (where antes), 4) end,
      'lista_perdidos', coalesce((select jsonb_agg(jsonb_build_object('user_id', s.id, 'nome', s.nome, 'cidade', s.cidade, 'ultimo_acesso', s.ult)
                                         order by s.ult desc nulls last)
                                  from fr_st s where s.antes and not s.agora), '[]')
    ) as j
    from fr_st
  ),
  -- HORA REBATE (30/10/2026, Marco Severo via Pedro): quanto tempo o Luma devolveu ao franqueado e
  -- quanto isso vale pela hora dele (rebate médio mensal ÷ horas do mês; o Marco arbitrou 240 h porque
  -- o franqueado trabalha mais que as 200 h de um funcionário). Premissas em luma.potencial_parametros
  -- (chaves hora_rebate.*), editáveis pela gestão na tela — número de negócio nunca mora no JS.
  -- Só franqueados. Arte avulsa: tempo ATIVO das sessões que geraram arte ÷ artes geradas (inclui
  -- ajustar e refazer). Lote: o evento lote_gerado (total_s = abrir o painel → último render).
  prm as (
    select (select (valor#>>'{}')::numeric from luma.potencial_parametros where chave = 'hora_rebate.rebate_medio') as rebate,
           coalesce((select (valor#>>'{}')::numeric from luma.potencial_parametros where chave = 'hora_rebate.horas_mes'), 240) as horas_mes,
           coalesce((select (valor#>>'{}')::numeric from luma.potencial_parametros where chave = 'hora_rebate.antes_arte_min'), 6.5) as antes_arte_min,
           coalesce((select (valor#>>'{}')::numeric from luma.potencial_parametros where chave = 'hora_rebate.antes_lote_h'), 40) as antes_lote_h
  ),
  fr_sess as (
    select s.user_id, s.dur_s, (select count(*) from ev e where e.chave = s.chave and e.evento = 'arte_gerada') as artes
    from sess s join public.profiles p on p.id = s.user_id and p.role = 'franqueado'
    where s.primeira_arte is not null
  ),
  fr_lote as (
    select count(*) as lotes, coalesce(sum((e.payload->>'n')::int), 0) as artes,
           coalesce(sum((e.payload->>'total_s')::numeric), 0) as total_s
    from ev e join public.profiles p on p.id = e.user_id and p.role = 'franqueado'
    where e.evento = 'lote_gerado' and coalesce((e.payload->>'cancelado')::boolean, false) = false
  ),
  hora_rebate as (
    select jsonb_build_object(
      'premissas', jsonb_build_object('rebate_medio', p.rebate, 'horas_mes', p.horas_mes,
                                      'antes_arte_min', p.antes_arte_min, 'antes_lote_h', p.antes_lote_h),
      'franqueados', a.franqueados, 'artes', a.artes, 'min_por_arte', a.min_por_arte,
      'lotes', l.lotes, 'artes_lote', l.artes, 'h_lote', round(l.total_s / 3600.0, 2),
      'h_devolvidas', round(h.h, 2),
      'hora_rebate_rs', case when p.rebate > 0 then round(p.rebate / p.horas_mes, 2) end,
      'valor_rs', case when p.rebate > 0 then round(h.h * p.rebate / p.horas_mes, 2) end,
      'pct_rebate', case when p.rebate > 0 and a.franqueados > 0
                         then round((h.h * p.rebate / p.horas_mes) / a.franqueados / p.rebate, 4) end
    ) as j
    from prm p, fr_lote l,
      lateral (select count(distinct user_id) as franqueados, coalesce(sum(artes), 0) as artes,
                      case when coalesce(sum(artes), 0) = 0 then null else round(sum(dur_s) / sum(artes) / 60.0, 2) end as min_por_arte
               from fr_sess) a,
      lateral (select a.artes * (p.antes_arte_min - coalesce(a.min_por_arte, 0)) / 60.0
                      + l.lotes * p.antes_lote_h - l.total_s / 3600.0 as h) h
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
      'churn', (select j from churn),
      'hora_rebate', (select j from hora_rebate),
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
    'funil', jsonb_build_object('geral', (select j from funil_geral), 'por_material', (select j from por_material),
                                'tempos', (select j from jornada_tempos)),
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
