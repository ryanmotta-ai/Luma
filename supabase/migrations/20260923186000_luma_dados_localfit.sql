-- ============================================================
-- LUMA — Painel de Dados: observabilidade do Local Fit, 23/09/2026
-- ============================================================
-- O front já grava `layout_resolvido` a cada resolução de layout (js/core/auto-layout.js):
-- {status, origem:'preview'|'export', campo, template, material, ms, …}. Faltava LER: é daqui que
-- sai, com dado, se o "o Local Fit resolve ~90% sozinho" é verdade.
--
-- Status: original · wrapped · shrunk (resolveu) · overflow (não coube → bloqueio seguro).
-- `adapted`/`unsafe` são do motor anterior (antes de 23/09) e aparecem como tal.
-- Conta por ORIGEM separada: `export` é a arte que saiu (a que importa); `preview` conta cada
-- repintura da prévia e infla.

create or replace function luma.dados_localfit(p_de timestamptz, p_ate timestamptz)
returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_de  timestamptz := coalesce(p_de, now() - interval '30 days');
  v_ate timestamptz := coalesce(p_ate, now());
  r jsonb;
begin
  perform luma._dados_autoriza();
  with ev as (
    select coalesce(nullif(payload->>'status', ''), 'original') as status,
           coalesce(nullif(payload->>'origem', ''), 'preview') as origem,
           nullif(payload->>'campo', '') as campo,
           coalesce(nullif(payload->>'material', ''), nullif(payload->>'template', '')) as material,
           case when payload->>'ms' ~ '^\d+(\.\d+)?$' then (payload->>'ms')::numeric end as ms
    from analytics.fct_eventos
    where evento = 'layout_resolvido' and ocorreu_em >= v_de and ocorreu_em < v_ate
  )
  select jsonb_build_object(
    'por_status', coalesce((select jsonb_agg(jsonb_build_object('origem', origem, 'status', status, 'n', n) order by origem, n desc)
                   from (select origem, status, count(*) n from ev group by 1, 2) x), '[]'::jsonb),
    'resolveu', (select jsonb_build_object(
        'export_total', count(*) filter (where origem = 'export'),
        'export_ok', count(*) filter (where origem = 'export' and status in ('original', 'wrapped', 'shrunk', 'adapted')),
        'ms_p50', percentile_disc(0.5) within group (order by ms) filter (where ms is not null)) from ev),
    'nao_coube', coalesce((select jsonb_agg(jsonb_build_object('campo', campo, 'material', material, 'n', n) order by n desc)
                   from (select campo, material, count(*) n from ev where status in ('overflow', 'unsafe')
                         group by 1, 2 order by 3 desc limit 20) y), '[]'::jsonb)
  ) into r;
  return r;
end;
$$;
revoke all on function luma.dados_localfit(timestamptz, timestamptz) from public, anon;
grant execute on function luma.dados_localfit(timestamptz, timestamptz) to authenticated;
