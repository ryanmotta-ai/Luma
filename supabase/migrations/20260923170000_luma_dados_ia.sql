-- ============================================================
-- LUMA — Painel de Dados: aba IA (uso, erro, latência, legendas), 23/09/2026
-- ============================================================
-- Leitura separada da dados_painel de propósito: a aba IA busca só quando abre, e a
-- função grande (já testada) não é tocada. Mesma fronteira: SECURITY INVOKER sobre a RLS
-- de analytics.fct_eventos + a checagem de gestão/equipe DM (luma._dados_autoriza).
--
-- Fontes (front, 23/09/2026):
--   ia_chamada      {task, ok, status, erro, ms, anexos, tipo_anexo, gateway, modelo}
--                   — UMA por ida à Edge Function `ai` (gAiEdgeFetch, js/core/ai.js).
--   legenda_gerada  {fonte:'local'|'ia', n, variacao, camp_id, template_id}
--   legenda_copiada {fonte, origem:'botao'|'download'|'instagram'|'whatsapp', variacao}
--   copyfit_ia      {ok_n, reprovadas_n, respondeu}

create or replace function luma.dados_ia(p_de timestamptz, p_ate timestamptz)
returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_de  timestamptz := coalesce(p_de, now() - interval '30 days');
  v_ate timestamptz := coalesce(p_ate, now());
  r jsonb;
begin
  perform luma._dados_autoriza();
  if v_ate <= v_de then v_ate := v_de + interval '1 day'; end if;

  with
  ev as (
    select e.evento, e.user_id, e.payload, e.ocorreu_em,
           (e.ocorreu_em at time zone 'America/Sao_Paulo')::date as dia
    from analytics.fct_eventos e
    where e.ocorreu_em >= v_de and e.ocorreu_em < v_ate
      and e.evento in ('ia_chamada', 'legenda_gerada', 'legenda_copiada', 'copyfit_ia')
  ),
  ch as (
    select user_id, dia, ocorreu_em,
           coalesce(nullif(payload->>'task', ''), '?') as task,
           coalesce((payload->>'ok')::boolean, false) as ok,
           nullif(payload->>'erro', '') as erro,
           case when payload->>'ms' ~ '^\d+$' then (payload->>'ms')::int end as ms
    from ev where evento = 'ia_chamada'
  ),
  dias as (
    select d::date as dia
    from generate_series((v_de at time zone 'America/Sao_Paulo')::date,
                         ((v_ate - interval '1 second') at time zone 'America/Sao_Paulo')::date,
                         interval '1 day') d
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('de', v_de, 'ate', v_ate),
    'resumo', (select jsonb_build_object(
        'chamadas', count(*),
        'erros', count(*) filter (where not ok),
        'taxa_erro', case when count(*) > 0 then round((count(*) filter (where not ok))::numeric / count(*), 4) end,
        'pessoas', count(distinct user_id),
        'p50_ms', percentile_disc(0.5) within group (order by ms) filter (where ok and ms is not null),
        'p95_ms', percentile_disc(0.95) within group (order by ms) filter (where ok and ms is not null))
      from ch),
    'por_task', coalesce((select jsonb_agg(t order by (t->>'n')::int desc) from (
        select jsonb_build_object(
          'task', task, 'n', count(*), 'ok', count(*) filter (where ok),
          'erros', count(*) filter (where not ok), 'pessoas', count(distinct user_id),
          'p50_ms', percentile_disc(0.5) within group (order by ms) filter (where ok and ms is not null),
          'p95_ms', percentile_disc(0.95) within group (order by ms) filter (where ok and ms is not null)) t
        from ch group by task) q), '[]'::jsonb),
    'por_dia', coalesce((select jsonb_agg(jsonb_build_object(
          'dia', d.dia,
          'n', (select count(*) from ch where ch.dia = d.dia),
          'erros', (select count(*) from ch where ch.dia = d.dia and not ch.ok)) order by d.dia)
        from dias d), '[]'::jsonb),
    'erros', coalesce((select jsonb_agg(t order by (t->>'n')::int desc) from (
        select jsonb_build_object('task', task, 'erro', erro, 'n', count(*),
                                  'pessoas', count(distinct user_id), 'ultimo', max(ocorreu_em)) t
        from ch where not ok group by task, erro order by count(*) desc limit 20) q), '[]'::jsonb),
    'legendas', (select jsonb_build_object(
        'geradas_local', count(*) filter (where evento = 'legenda_gerada' and coalesce(payload->>'fonte', 'local') = 'local'),
        'geradas_ia', count(*) filter (where evento = 'legenda_gerada' and payload->>'fonte' = 'ia'),
        'copiadas_local', count(*) filter (where evento = 'legenda_copiada' and coalesce(payload->>'fonte', 'local') = 'local'),
        'copiadas_ia', count(*) filter (where evento = 'legenda_copiada' and payload->>'fonte' = 'ia'),
        'por_origem', coalesce((select jsonb_agg(jsonb_build_object('origem', o, 'n', n) order by n desc) from (
            select coalesce(payload->>'origem', '?') o, count(*) n from ev
            where evento = 'legenda_copiada' group by 1) x), '[]'::jsonb))
      from ev),
    'copyfit_ia', (select jsonb_build_object(
        'pedidos', count(*),
        'sem_resposta', count(*) filter (where payload->>'respondeu' = 'false'),
        'opcoes_ok', coalesce(sum(case when payload->>'ok_n' ~ '^\d+$' then (payload->>'ok_n')::int end), 0),
        'reprovadas', coalesce(sum(case when payload->>'reprovadas_n' ~ '^\d+$' then (payload->>'reprovadas_n')::int end), 0))
      from ev where evento = 'copyfit_ia')
  ) into r;

  return r;
end;
$$;
revoke all on function luma.dados_ia(timestamptz, timestamptz) from public, anon;
grant execute on function luma.dados_ia(timestamptz, timestamptz) to authenticated;
