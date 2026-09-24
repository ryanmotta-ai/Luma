-- Dados → IA: consumo por MODELO (chamadas, tokens de entrada/saída) para a calculadora de custo.
-- Só conta chamada que DEU CERTO: nas falhas o front registra o modelo padrão, não o que tentou.
-- Tokens = os que o provedor contou (function `ai` v18 em diante); chamadas antigas vêm sem eles
-- e aparecem em `sem_tokens`, para o front estimar pela média.
-- A autorização é a mesma do resto do painel (luma._dados_autoriza): o preço fica no front.
create or replace function luma.dados_ia_modelos(p_de timestamptz, p_ate timestamptz)
returns jsonb
language plpgsql
stable
set search_path to ''
as $$
declare
  v_de  timestamptz := coalesce(p_de, now() - interval '30 days');
  v_ate timestamptz := coalesce(p_ate, now());
  r jsonb;
begin
  perform luma._dados_autoriza();
  if v_ate <= v_de then v_ate := v_de + interval '1 day'; end if;
  with ch as (
    select coalesce(nullif(e.payload->>'modelo', ''), '?') as modelo,
           e.user_id,
           case when e.payload->>'tokens_in'  ~ '^\d+$' then (e.payload->>'tokens_in')::bigint  end as tin,
           case when e.payload->>'tokens_out' ~ '^\d+$' then (e.payload->>'tokens_out')::bigint end as tout
    from analytics.fct_eventos e
    where e.evento = 'ia_chamada' and e.ocorreu_em >= v_de and e.ocorreu_em < v_ate
      and coalesce((e.payload->>'ok')::boolean, false)
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('de', v_de, 'ate', v_ate),
    'por_modelo', coalesce((select jsonb_agg(t order by (t->>'n')::int desc) from (
        select jsonb_build_object(
          'modelo', modelo, 'n', count(*), 'pessoas', count(distinct user_id),
          'com_tokens', count(*) filter (where tin is not null),
          'sem_tokens', count(*) filter (where tin is null),
          'tokens_in', coalesce(sum(tin), 0), 'tokens_out', coalesce(sum(tout), 0)) t
        from ch group by modelo) q), '[]'::jsonb)
  ) into r;
  return r;
end;
$$;

revoke all on function luma.dados_ia_modelos(timestamptz, timestamptz) from public;
grant execute on function luma.dados_ia_modelos(timestamptz, timestamptz) to authenticated;
