CREATE OR REPLACE VIEW analytics.vw_artes_por_dia AS
SELECT date_trunc('day', created_at)::date AS dia,
       count(*) AS artes,
       count(*) FILTER (WHERE status = 'baixada') AS baixadas,
       count(DISTINCT user_id) AS franqueados
FROM luma.artes
GROUP BY 1
ORDER BY 1 DESC;

CREATE OR REPLACE VIEW analytics.vw_uso_por_campanha AS
SELECT camp_id, camp_name,
       count(*) AS artes,
       count(*) FILTER (WHERE status = 'baixada') AS baixadas,
       count(DISTINCT user_id) AS franqueados
FROM luma.artes
GROUP BY camp_id, camp_name
ORDER BY artes DESC;

CREATE OR REPLACE VIEW analytics.vw_uso_por_formato AS
SELECT fmt_id, fmt_name,
       count(*) AS artes,
       count(*) FILTER (WHERE status = 'baixada') AS baixadas
FROM luma.artes
GROUP BY fmt_id, fmt_name
ORDER BY artes DESC;

CREATE OR REPLACE VIEW analytics.vw_taxa_download AS
SELECT count(*) AS total_artes,
       count(*) FILTER (WHERE status = 'baixada') AS baixadas,
       round(100.0 * count(*) FILTER (WHERE status = 'baixada') / NULLIF(count(*), 0), 1) AS pct_download
FROM luma.artes;

CREATE OR REPLACE VIEW analytics.vw_franqueados_ativos AS
SELECT p.id, p.nome, p.email,
       count(a.id) AS artes,
       count(a.id) FILTER (WHERE a.status = 'baixada') AS baixadas,
       max(a.created_at) AS ultima_arte
FROM public.profiles p
LEFT JOIN luma.artes a ON a.user_id = p.id
WHERE p.role = 'franqueado'
GROUP BY p.id, p.nome, p.email
ORDER BY artes DESC;

CREATE OR REPLACE VIEW analytics.vw_templates_publicados AS
SELECT pa.nome AS pasta, pa.camp_id,
       count(t.id) AS templates,
       count(t.id) FILTER (WHERE t.publicado) AS publicados,
       max(t.publicado_em) AS ultima_publicacao
FROM luma.pastas pa
LEFT JOIN luma.templates t ON t.pasta_id = pa.id
GROUP BY pa.nome, pa.camp_id
ORDER BY templates DESC;
