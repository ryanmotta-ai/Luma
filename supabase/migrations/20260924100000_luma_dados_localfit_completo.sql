-- ============================================================
-- LUMA — Painel de Dados: Local Fit completo, 24/09/2026
-- ============================================================
-- Amplia luma.dados_localfit (mesma assinatura; o retorno é um SUPERCONJUNTO do de 23/09 —
-- por_status, resolveu e nao_coube continuam com as mesmas chaves). Vira a aba "Local Fit" do
-- painel: é a bancada para decidir o que melhorar no motor e em quais templates.
--
-- Fonte: `layout_resolvido` (js/core/auto-layout.js · gLayoutTelemetry) —
--   {status, origem, material, formato, ms, camadas_alteradas, camadas_invalidas, campo,
--    limite_seguro, fonte, _ctx:{sid, disp, nav, v, area}}.
-- Recuperação depois do bloqueio: texto_nao_cabe, copyfit_* e arte_baixada (mesma sessão = _ctx.sid).
--
-- Grupos de status: original (coube como desenhado) · ajustou (wrapped, shrunk e o `adapted` do
-- motor antigo) · bloqueou (overflow e o `unsafe` do motor antigo).
-- `preview` conta cada estado novo da prévia (o front já deduplica por template|formato|status|
-- campo); `export` é a arte que virou arquivo — é a taxa que importa.

create or replace function luma.dados_localfit(p_de timestamptz, p_ate timestamptz)
returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_de  timestamptz := coalesce(p_de, now() - interval '30 days');
  v_ate timestamptz := coalesce(p_ate, now());
  v_ant timestamptz := v_de - (v_ate - v_de);   -- período anterior, do mesmo tamanho
  r jsonb;
begin
  perform luma._dados_autoriza();
  with base as materialized (
    select e.ocorreu_em,
           coalesce(e.user_id::text, nullif(e.payload->>'user_id', '')) as uid,
           coalesce(nullif(e.payload->>'status', ''), 'original') as status,
           coalesce(nullif(e.payload->>'origem', ''), 'preview') as origem,
           nullif(e.payload->>'campo', '') as campo,
           coalesce(nullif(e.payload->>'material', ''), nullif(e.payload->>'template', '')) as material,
           coalesce(nullif(e.payload->>'formato', ''), '—') as formato,
           case when e.payload->>'ms' ~ '^\d+(\.\d+)?$' then (e.payload->>'ms')::numeric end as ms,
           case when e.payload->>'camadas_alteradas' ~ '^\d+$' then (e.payload->>'camadas_alteradas')::int else 0 end as alt,
           case when e.payload->>'camadas_invalidas' ~ '^\d+$' then (e.payload->>'camadas_invalidas')::int else 0 end as inv,
           case when e.payload->>'limite_seguro' ~ '^\d+(\.\d+)?$' then (e.payload->>'limite_seguro')::numeric end as limite,
           coalesce(nullif(e.payload->>'fonte', ''), 'desconhecida') as fonte,
           coalesce(nullif(e.payload->'_ctx'->>'disp', ''), 'sem contexto') as disp,
           coalesce(nullif(e.payload->'_ctx'->>'nav', ''), 'sem contexto') as nav,
           nullif(e.payload->'_ctx'->>'v', '') as versao,
           nullif(e.payload->'_ctx'->>'sid', '') as sid
    from analytics.fct_eventos e
    where e.evento = 'layout_resolvido' and e.ocorreu_em >= v_ant and e.ocorreu_em < v_ate
  ),
  todos as (
    select b.*,
           case when b.status = 'original' then 'original'
                when b.status in ('overflow', 'unsafe') then 'bloqueou'
                else 'ajustou' end as grupo
    from base b
  ),
  ev as materialized (select * from todos where ocorreu_em >= v_de),
  ant as (select * from todos where ocorreu_em < v_de),
  nomes as (
    select t.id::text as material, t.nome, p.nome as pasta
    from luma.templates t left join luma.pastas p on p.id = t.pasta_id
  ),
  outros as materialized (
    select e.evento, e.ocorreu_em, e.payload, nullif(e.payload->'_ctx'->>'sid', '') as sid
    from analytics.fct_eventos e
    where e.ocorreu_em >= v_de and e.ocorreu_em < v_ate
      and e.evento in ('texto_nao_cabe', 'copyfit_balao_exibido', 'copyfit_aplicado', 'copyfit_desfeito', 'copyfit_ia', 'arte_baixada')
  ),
  bloq_sessao as (
    select sid, min(ocorreu_em) as primeiro from ev where grupo = 'bloqueou' and sid is not null group by sid
  )
  select jsonb_build_object(
    -- ── compatível com 23/09 ────────────────────────────────────────────────────────────
    'por_status', coalesce((select jsonb_agg(jsonb_build_object('origem', origem, 'status', status, 'n', n) order by origem, n desc)
                   from (select origem, status, count(*) n from ev group by 1, 2) x), '[]'::jsonb),
    'resolveu', (select jsonb_build_object(
        'export_total', count(*) filter (where origem = 'export'),
        'export_ok', count(*) filter (where origem = 'export' and grupo <> 'bloqueou'),
        'ms_p50', percentile_disc(0.5) within group (order by ms) filter (where ms is not null)) from ev),

    -- ── resumo ──────────────────────────────────────────────────────────────────────────
    'resumo', (select jsonb_build_object(
        'total', count(*),
        'export_total', count(*) filter (where origem = 'export'),
        'export_original', count(*) filter (where origem = 'export' and grupo = 'original'),
        'export_ajustou', count(*) filter (where origem = 'export' and grupo = 'ajustou'),
        'export_bloqueou', count(*) filter (where origem = 'export' and grupo = 'bloqueou'),
        'preview_total', count(*) filter (where origem <> 'export'),
        'preview_bloqueou', count(*) filter (where origem <> 'export' and grupo = 'bloqueou'),
        'ms_p50', percentile_disc(0.5) within group (order by ms) filter (where ms is not null),
        'ms_p95', percentile_disc(0.95) within group (order by ms) filter (where ms is not null),
        'ms_max', max(ms),
        'pessoas', count(distinct uid),
        'pessoas_bloqueadas', count(distinct uid) filter (where grupo = 'bloqueou'),
        'materiais', count(distinct material),
        'materiais_bloqueados', count(distinct material) filter (where grupo = 'bloqueou'),
        'alt_media', round(avg(alt) filter (where grupo = 'ajustou'), 2),
        'caixas_estouradas', coalesce(sum(inv), 0),   -- camadas_invalidas = caixas que estouraram no bloqueio
        'fonte_nao_ok', count(*) filter (where fonte in ('parcial', 'substituida')),
        'fonte_conhecida', count(*) filter (where fonte <> 'desconhecida')) from ev),
    'anterior', (select jsonb_build_object(
        'total', count(*),
        'export_total', count(*) filter (where origem = 'export'),
        'export_original', count(*) filter (where origem = 'export' and grupo = 'original'),
        'export_bloqueou', count(*) filter (where origem = 'export' and grupo = 'bloqueou'),
        'ms_p50', percentile_disc(0.5) within group (order by ms) filter (where ms is not null)) from ant),

    -- ── tendência diária (todas as origens + recorte do export) ────────────────────────
    'por_dia', coalesce((select jsonb_agg(jsonb_build_object('dia', dia, 'n', n, 'original', o, 'ajustou', a, 'bloqueou', b,
                         'export_n', en, 'export_bloqueou', eb) order by dia)
                 from (select to_char(ocorreu_em at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') dia, count(*) n,
                              count(*) filter (where grupo = 'original') o, count(*) filter (where grupo = 'ajustou') a,
                              count(*) filter (where grupo = 'bloqueou') b,
                              count(*) filter (where origem = 'export') en,
                              count(*) filter (where origem = 'export' and grupo = 'bloqueou') eb
                       from ev group by 1) d), '[]'::jsonb),

    -- ── por template: onde o motor mais trabalha / mais bloqueia ───────────────────────
    'por_material', coalesce((select jsonb_agg(to_jsonb(m) order by m.bloqueou desc, m.ajustou desc, m.n desc)
                 from (select ev.material, max(nm.nome) as nome, max(nm.pasta) as pasta, count(*) n,
                              count(*) filter (where origem = 'export') export_n,
                              count(*) filter (where grupo = 'original') original,
                              count(*) filter (where status = 'wrapped') wrapped,
                              count(*) filter (where status in ('shrunk', 'adapted')) shrunk,
                              count(*) filter (where grupo = 'ajustou') ajustou,
                              count(*) filter (where grupo = 'bloqueou') bloqueou,
                              percentile_disc(0.5) within group (order by ms) filter (where ms is not null) ms_p50,
                              round(avg(alt) filter (where grupo = 'ajustou'), 2) alt_media,
                              count(distinct uid) pessoas, count(distinct formato) formatos, max(ocorreu_em) ultimo
                       from ev left join nomes nm on nm.material = ev.material
                       group by ev.material order by 10 desc, 9 desc, 4 desc limit 50) m), '[]'::jsonb),

    -- ── campos que bloquearam (diagnóstico do motor) ───────────────────────────────────
    'nao_coube', coalesce((select jsonb_agg(to_jsonb(y) order by y.n desc)
                 from (select ev.campo, ev.material, max(nm.nome) as nome, max(nm.pasta) as pasta, count(*) n,
                              count(*) filter (where origem = 'export') export_n,
                              count(distinct uid) pessoas,
                              percentile_disc(0.5) within group (order by limite) filter (where limite is not null) limite_p50,
                              string_agg(distinct formato, ', ') formatos, max(ocorreu_em) ultimo
                       from ev left join nomes nm on nm.material = ev.material
                       where grupo = 'bloqueou' group by ev.campo, ev.material order by 5 desc limit 30) y), '[]'::jsonb),

    -- ── recortes: formato, aparelho, navegador, fonte, versão do app ───────────────────
    'por_formato', coalesce((select jsonb_agg(to_jsonb(x) order by x.n desc) from (
        select formato as chave, count(*) n, count(*) filter (where grupo = 'original') original,
               count(*) filter (where grupo = 'ajustou') ajustou, count(*) filter (where grupo = 'bloqueou') bloqueou,
               percentile_disc(0.5) within group (order by ms) filter (where ms is not null) ms_p50,
               percentile_disc(0.95) within group (order by ms) filter (where ms is not null) ms_p95
        from ev group by 1) x), '[]'::jsonb),
    'por_dispositivo', coalesce((select jsonb_agg(to_jsonb(x) order by x.n desc) from (
        select disp as chave, count(*) n, count(*) filter (where grupo = 'original') original,
               count(*) filter (where grupo = 'ajustou') ajustou, count(*) filter (where grupo = 'bloqueou') bloqueou,
               percentile_disc(0.5) within group (order by ms) filter (where ms is not null) ms_p50,
               percentile_disc(0.95) within group (order by ms) filter (where ms is not null) ms_p95
        from ev group by 1) x), '[]'::jsonb),
    'por_navegador', coalesce((select jsonb_agg(to_jsonb(x) order by x.n desc) from (
        select nav as chave, count(*) n, count(*) filter (where grupo = 'original') original,
               count(*) filter (where grupo = 'ajustou') ajustou, count(*) filter (where grupo = 'bloqueou') bloqueou,
               percentile_disc(0.5) within group (order by ms) filter (where ms is not null) ms_p50,
               percentile_disc(0.95) within group (order by ms) filter (where ms is not null) ms_p95
        from ev group by 1) x), '[]'::jsonb),
    'por_fonte', coalesce((select jsonb_agg(to_jsonb(x) order by x.n desc) from (
        select fonte as chave, count(*) n, count(*) filter (where grupo = 'original') original,
               count(*) filter (where grupo = 'ajustou') ajustou, count(*) filter (where grupo = 'bloqueou') bloqueou,
               percentile_disc(0.5) within group (order by ms) filter (where ms is not null) ms_p50,
               percentile_disc(0.95) within group (order by ms) filter (where ms is not null) ms_p95
        from ev group by 1) x), '[]'::jsonb),
    'por_versao', coalesce((select jsonb_agg(to_jsonb(x) order by x.ordem desc nulls last) from (
        select coalesce(versao, 'sem contexto') as chave,
               case when versao ~ '^\d+$' then versao::int end as ordem,
               count(*) n, count(*) filter (where grupo = 'original') original,
               count(*) filter (where grupo = 'ajustou') ajustou, count(*) filter (where grupo = 'bloqueou') bloqueou,
               percentile_disc(0.5) within group (order by ms) filter (where ms is not null) ms_p50,
               percentile_disc(0.95) within group (order by ms) filter (where ms is not null) ms_p95,
               min(ocorreu_em) primeiro, max(ocorreu_em) ultimo
        from ev group by 1, 2 order by 2 desc nulls last limit 15) x), '[]'::jsonb),

    -- ── distribuições ──────────────────────────────────────────────────────────────────
    'tempo_faixas', coalesce((select jsonb_agg(jsonb_build_object('faixa', faixa, 'n', n) order by ordem) from (
        select case when ms < 5 then 1 when ms < 20 then 2 when ms < 50 then 3 when ms < 100 then 4 else 5 end ordem,
               case when ms < 5 then 'até 5 ms' when ms < 20 then '5–20 ms' when ms < 50 then '20–50 ms'
                    when ms < 100 then '50–100 ms' else '100 ms ou mais' end faixa,
               count(*) n
        from ev where ms is not null group by 1, 2) t), '[]'::jsonb),
    'camadas_faixas', coalesce((select jsonb_agg(jsonb_build_object('faixa', faixa, 'n', n) order by ordem) from (
        select least(alt, 3) ordem,
               case when alt = 0 then 'Nenhuma' when alt = 1 then '1 camada' when alt = 2 then '2 camadas' else '3 ou mais' end faixa,
               count(*) n
        from ev group by 1, 2) c), '[]'::jsonb),

    -- ── depois do bloqueio: o franqueado se recuperou? ─────────────────────────────────
    'recuperacao', (select jsonb_build_object(
        'nao_cabe', count(*) filter (where evento = 'texto_nao_cabe'),
        'nao_cabe_com_versao', count(*) filter (where evento = 'texto_nao_cabe' and (payload->>'tem_versao')::boolean is true),
        'balao_exibido', count(*) filter (where evento = 'copyfit_balao_exibido'),
        'aplicado', count(*) filter (where evento = 'copyfit_aplicado'),
        'aplicado_balao', count(*) filter (where evento = 'copyfit_aplicado' and coalesce(payload->>'origem', 'balao') = 'balao'),
        'aplicado_chat', count(*) filter (where evento = 'copyfit_aplicado' and payload->>'origem' = 'chat'),
        'aplicado_ia', count(*) filter (where evento = 'copyfit_aplicado' and payload->>'origem' = 'ia'),
        'desfeito', count(*) filter (where evento = 'copyfit_desfeito'),
        'ia_pedidos', count(*) filter (where evento = 'copyfit_ia'),
        'ia_com_opcao', count(*) filter (where evento = 'copyfit_ia' and coalesce(nullif(payload->>'ok_n', ''), '0') ~ '^[1-9]\d*$'),
        'sessoes_bloqueadas', (select count(*) from bloq_sessao),
        'sessoes_baixaram', (select count(*) from bloq_sessao bs where exists (
            select 1 from outros o where o.evento = 'arte_baixada' and o.sid = bs.sid and o.ocorreu_em >= bs.primeiro))
      ) from outros),

    -- ── quem mais esbarra no bloqueio ──────────────────────────────────────────────────
    'por_pessoa', coalesce((select jsonb_agg(to_jsonb(x) order by x.bloqueou desc, x.n desc) from (
        select ev.uid, max(coalesce(pr.nome, split_part(pr.email, '@', 1))) nome, max(pr.cidade) cidade,
               count(*) n, count(*) filter (where grupo = 'ajustou') ajustou, count(*) filter (where grupo = 'bloqueou') bloqueou,
               max(ocorreu_em) ultimo
        from ev left join public.profiles pr on pr.id::text = ev.uid
        where ev.uid is not null group by ev.uid order by 6 desc, 4 desc limit 20) x), '[]'::jsonb),

    -- ── casos para reproduzir ──────────────────────────────────────────────────────────
    'recentes', coalesce((select jsonb_agg(to_jsonb(x) order by x.ocorreu_em desc) from (
        select ev.ocorreu_em, coalesce(pr.nome, split_part(pr.email, '@', 1)) nome, pr.cidade, ev.material,
               nm.nome as template, nm.pasta, ev.campo, ev.formato, ev.origem, ev.status, ev.disp, ev.nav, ev.fonte,
               ev.limite, ev.versao, ev.ms
        from ev left join public.profiles pr on pr.id::text = ev.uid left join nomes nm on nm.material = ev.material
        where ev.grupo = 'bloqueou' order by ev.ocorreu_em desc limit 25) x), '[]'::jsonb)
  ) into r;
  return r;
end;
$$;
revoke all on function luma.dados_localfit(timestamptz, timestamptz) from public, anon;
grant execute on function luma.dados_localfit(timestamptz, timestamptz) to authenticated;
