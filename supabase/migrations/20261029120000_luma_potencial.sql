-- ============================================================
-- LUMA — Potencial da cidade (calculadora comercial), 29/10/2026
-- ============================================================
-- A "Calculadora de Franquias 2026" (planilha do Aladim) vira uma tela do Luma: escolhe a
-- cidade, vê os 3 cenários e gera o slide "Potencial" no Google Slides. Esta migration cria
-- os DADOS que a planilha tinha espalhados em abas:
--
--   · luma.potencial_faixas      — aba "Calcular taxas aqui!": taxa de franquia e base de
--                                  marketing por faixa de população (37 faixas).
--   · luma.potencial_parametros  — constantes soltas: IPCA, multiplicador por nº de
--                                  concorrentes, comissão, rebate, Simples, ticket por região,
--                                  cenários (2% / 20% / 35%) e a URL do gerador de slide.
--   · luma.potencial_cidades     — aba "Base IBGE" (carga em 20261029120100).
--
-- ⛔ SEGURANÇA = RLS. Tarifa e margem comercial NÃO podem ir para o JS (o Luma é estático e
-- público no GitHub Pages): ficam aqui, lidas só pela equipe (`is_designer()` = equipe_dm +
-- gestao, conta ativa). Franqueado não lê nada disto. Escrever: só a gestão — por enquanto
-- pelo SQL Editor; não há tela de edição de preço.
--
-- Idempotente: pode rodar duas vezes no SQL Editor.

-- ------------------------------------------------------------
-- §1 — Faixas de população (taxa de franquia + base de marketing)
-- ------------------------------------------------------------
create table if not exists luma.potencial_faixas (
  id             smallint primary key,
  pop_min        integer  not null,
  pop_max        integer,                       -- null = sem teto ("Acima de 2M")
  taxa_franquia  numeric  not null,
  mkt_base       numeric  not null,             -- "MKT OFF + TRADE" ANTES de IPCA e concorrência
  constraint potencial_faixas_ordem check (pop_max is null or pop_max >= pop_min)
);
comment on table luma.potencial_faixas is
  'Faixas da aba "Calcular taxas aqui!". Investimento de lançamento = CEILING(mkt_base*(1+ipca)*mult_concorrencia, 50).';

insert into luma.potencial_faixas (id, pop_min, pop_max, taxa_franquia, mkt_base) values
  (1, 1, 20000, 8500, 8250),
  (2, 20001, 30000, 10500, 10312.5),
  (3, 30001, 40000, 14000, 13750),
  (4, 40001, 50000, 17500, 17187.5),
  (5, 50001, 60000, 21500, 20625),
  (6, 60001, 70000, 24500, 24062.5),
  (7, 70001, 80000, 28200, 27500),
  (8, 80001, 90000, 31500, 30937.5),
  (9, 90001, 100000, 35000, 34375),
  (10, 100001, 110000, 36000, 35475),
  (11, 110001, 120000, 38500, 38700),
  (12, 120001, 130000, 40500, 41925),
  (13, 130001, 140000, 43000, 45150),
  (14, 140001, 150000, 44500, 48375),
  (15, 150001, 200000, 53000, 64500),
  (16, 200001, 250000, 61500, 80625),
  (17, 250001, 300000, 70000, 96750),
  (18, 300001, 350000, 78500, 112875),
  (19, 350001, 400000, 87000, 129000),
  (20, 400001, 450000, 95500, 145125),
  (21, 450001, 500000, 104000, 161250),
  (22, 500001, 550000, 112500, 177375),
  (23, 550001, 600000, 121000, 193500),
  (24, 600001, 650000, 129500, 209625),
  (25, 650001, 700000, 138000, 225750),
  (26, 700001, 750000, 146500, 241875),
  (27, 750001, 800000, 155000, 258000),
  (28, 800001, 850000, 163500, 274125),
  (29, 850001, 900000, 172000, 290250),
  (30, 900001, 950000, 180500, 306375),
  (31, 950001, 1000000, 189000, 322500),
  (32, 1000001, 1200000, 223000, 387000),
  (33, 1200001, 1400000, 257000, 451500),
  (34, 1400001, 1600000, 291000, 516000),
  (35, 1600001, 1800000, 325000, 580500),
  (36, 1800001, 2000000, 359000, 645000),
  (37, 2000001, null, 393000, 709500)
on conflict (id) do update
  set pop_min=excluded.pop_min, pop_max=excluded.pop_max,
      taxa_franquia=excluded.taxa_franquia, mkt_base=excluded.mkt_base;

-- ------------------------------------------------------------
-- §2 — Parâmetros (chave → jsonb)
-- ------------------------------------------------------------
create table if not exists luma.potencial_parametros (
  chave          text primary key,
  valor          jsonb not null,
  descricao      text,
  atualizado_em  timestamptz not null default now()
);

-- `on conflict do nothing`: rodar de novo NÃO desfaz um ajuste feito pela gestão.
insert into luma.potencial_parametros (chave, valor, descricao) values
  ('ipca',               '0.3033'::jsonb, 'IPCA acumulado 2022→2025 (Abr/2026). Corrige a base de marketing.'),
  ('mult_concorrencia',  '{"0":1,"1":1.25,"2":1.45}'::jsonb, 'Multiplicador do marketing por nº de concorrentes. 3+ não existe na planilha (devolvia FALSE): a tela avisa.'),
  ('comissao',           '0.12'::jsonb, 'Comissionamento médio sobre o GMV.'),
  ('rebate_franqueado',  '0.5'::jsonb,  'Parte da comissão que fica com o franqueado.'),
  ('simples',            '0.06'::jsonb, 'Simples Nacional sobre a receita do franqueado.'),
  ('ticket_regional',    '{"Sul":73.58,"Nordeste":71.08,"Norte":64.02,"Sudeste":61.57,"Centro-Oeste":60.89}'::jsonb, 'Ticket médio por região (aba Automação).'),
  ('fator_ticket',       '{"ruim":0.975,"real":1,"top":1.025}'::jsonb, 'Ajuste do ticket em cada cenário.'),
  ('cenarios',           '[{"id":"ruim","pct":0.02},{"id":"real","pct":0.2},{"id":"top","pct":0.35}]'::jsonb, 'Quanto da população vira usuário ativo em cada cenário.'),
  ('slides_webapp_url',  'null'::jsonb, 'URL do Apps Script que copia o deck-modelo e troca os placeholders. null = gerador ainda não configurado.')
on conflict (chave) do nothing;

-- ------------------------------------------------------------
-- §3 — Cidades (a carga vem na migration seguinte)
-- ------------------------------------------------------------
create table if not exists luma.potencial_cidades (
  chave                    text primary key,    -- "GO-Aruanã" (igual à coluna A da planilha)
  uf                       char(2) not null,
  nome                     text    not null,
  busca                    text    not null default '',   -- "aruana go": minúsculo, sem acento (a busca da tela)
  populacao                integer not null,    -- estimada 2025
  pib_per_capita           numeric,             -- 2023
  concorrentes             smallint,
  taxa_franquia_override   numeric,             -- taxa negociada da cidade; null = usa a faixa
  vender                   boolean not null default true   -- false = "não vender" na planilha
);
-- 5,5 mil linhas: a busca por `ilike '%…%'` em `busca` é varredura barata; sem índice de propósito.

-- ------------------------------------------------------------
-- §4 — RLS
-- ------------------------------------------------------------
alter table luma.potencial_faixas     enable row level security;
alter table luma.potencial_parametros enable row level security;
alter table luma.potencial_cidades    enable row level security;

drop policy if exists "potencial faixas: equipe lê" on luma.potencial_faixas;
create policy "potencial faixas: equipe lê" on luma.potencial_faixas
  for select to authenticated using (public.is_designer());
drop policy if exists "potencial faixas: gestão escreve" on luma.potencial_faixas;
create policy "potencial faixas: gestão escreve" on luma.potencial_faixas
  for all to authenticated
  using (public.get_user_role() = 'gestao') with check (public.get_user_role() = 'gestao');

drop policy if exists "potencial parametros: equipe lê" on luma.potencial_parametros;
create policy "potencial parametros: equipe lê" on luma.potencial_parametros
  for select to authenticated using (public.is_designer());
drop policy if exists "potencial parametros: gestão escreve" on luma.potencial_parametros;
create policy "potencial parametros: gestão escreve" on luma.potencial_parametros
  for all to authenticated
  using (public.get_user_role() = 'gestao') with check (public.get_user_role() = 'gestao');

drop policy if exists "potencial cidades: equipe lê" on luma.potencial_cidades;
create policy "potencial cidades: equipe lê" on luma.potencial_cidades
  for select to authenticated using (public.is_designer());
drop policy if exists "potencial cidades: gestão escreve" on luma.potencial_cidades;
create policy "potencial cidades: gestão escreve" on luma.potencial_cidades
  for all to authenticated
  using (public.get_user_role() = 'gestao') with check (public.get_user_role() = 'gestao');

grant select on luma.potencial_faixas, luma.potencial_parametros, luma.potencial_cidades to authenticated;
grant insert, update, delete on luma.potencial_faixas, luma.potencial_parametros, luma.potencial_cidades to authenticated;
