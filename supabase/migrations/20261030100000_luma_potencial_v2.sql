-- ============================================================
-- LUMA — Potencial v2: parâmetros do modelo de 24 meses, histórico de propostas e trava de verdade, 30/10/2026
-- ============================================================
-- A v2 do módulo passa a rodar o modelo de 24 meses da planilha (aba Calculadora, linhas 26–50), guarda
-- cada slide gerado e deixa a gestão editar tarifas na tela. Esta migration cria o que isso pede no banco:
--
--   §1  Parâmetros do modelo de 24 meses (`on conflict do nothing`: rodar de novo não desfaz ajuste da gestão).
--   §2  luma.pode_potencial() — o motor ÚNICO de "esta pessoa usa o Potencial": equipe DM (`is_designer()`)
--       OU quem foi liberado SÓ para ele em luma.acesso_restrito. As policies passam a usar esta função.
--       Resultado: a conta do Aladim pode voltar a ser `franqueado` e ainda assim ler as tarifas — e deixa
--       de ter, pelo banco, os poderes de designer (gravar template etc.).
--   §3  luma.potencial_propostas — o histórico: quem gerou o quê, para qual cidade, com quais ajustes.
--
-- Depende de 20261029190000_luma_acesso_restrito.sql e de 20261029120000_luma_potencial.sql.
-- ⚠ NÃO troca a role de ninguém: reverter o Aladim para `franqueado` só depois de o Apps Script novo estar
-- publicado (o antigo confere a role em `profiles` e passaria a recusá-lo). Ver o prompt do Cowork.
-- Idempotente.

-- ------------------------------------------------------------
-- §1 — Parâmetros novos
-- ------------------------------------------------------------
insert into luma.potencial_parametros (chave, valor, descricao) values
  ('ticket_medio',              '70'::jsonb,    'Ticket médio padrão (aba Calculadora C13 — fonte Getnet/Ticket 2025 + IPCA). Vale para os 3 cenários, com o fator de cada um.'),
  ('ticket_apresentacao',       '45'::jsonb,    'Ticket que estava digitado na aba "Cenários" e no slide antigo do Aruanã. Aparece como atalho na tela.'),
  ('parcelas_taxa',             '1'::jsonb,     'Em quantas vezes a taxa de franquia é paga (1 a 5).'),
  ('mkt_apos_mes5',             '0.15'::jsonb,  'Reinvestimento do franqueado a partir do mês 6: % da comissão bruta do mês anterior.'),
  ('delta_mkt',                 '3'::jsonb,     'Quanto de GMV cada R$ 1 de marketing gera nos meses 1 a 5 (lançamento).'),
  ('delta_ongoing',             '4'::jsonb,     'Quanto de GMV cada R$ 1 de marketing gera do mês 6 em diante.'),
  ('nfe',                       '0.0565'::jsonb,'Imposto da NFe sobre a comissão bruta.'),
  ('inadimplencia',             '0.02'::jsonb,  'Inadimplência sobre a comissão do mês anterior.'),
  ('inadimplencia_todos_meses', 'false'::jsonb, 'false = igual à planilha, que só aplica a inadimplência no mês 2 (a referência da fórmula "anda" para células vazias). true = todo mês.'),
  ('mkt_franqueadora_pct',      '0.5'::jsonb,   'Marketing da franqueadora nos meses 1 a 3: este % da taxa de franquia, dividido em 3.')
on conflict (chave) do nothing;

-- ------------------------------------------------------------
-- §2 — Quem usa o Potencial (motor único) e as policies que passam a depender dele
-- ------------------------------------------------------------
create or replace function luma.pode_potencial()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select (select public.is_designer())
      or exists (select 1 from luma.acesso_restrito a
                  where a.user_id = (select auth.uid()) and a.area = 'potencial'
                    and (select public.is_ativo()));
$$;
grant execute on function luma.pode_potencial() to authenticated;

drop policy if exists "potencial faixas: equipe lê" on luma.potencial_faixas;
create policy "potencial faixas: equipe lê" on luma.potencial_faixas
  for select to authenticated using (luma.pode_potencial());

drop policy if exists "potencial parametros: equipe lê" on luma.potencial_parametros;
create policy "potencial parametros: equipe lê" on luma.potencial_parametros
  for select to authenticated using (luma.pode_potencial());

drop policy if exists "potencial cidades: equipe lê" on luma.potencial_cidades;
create policy "potencial cidades: equipe lê" on luma.potencial_cidades
  for select to authenticated using (luma.pode_potencial());

-- ------------------------------------------------------------
-- §3 — Histórico de propostas
-- ------------------------------------------------------------
create table if not exists luma.potencial_propostas (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cidade_chave  text not null,
  cidade_nome   text not null,
  uf            text not null,
  ajustes       jsonb not null default '{}'::jsonb,   -- o que a pessoa mexeu na tela (concorrentes, ticket…)
  resumo        jsonb not null default '{}'::jsonb,   -- os números que foram para o slide (investimento, GMV, payback…)
  slide_url     text,
  criado_em     timestamptz not null default now()
);
comment on table luma.potencial_propostas is
  'Cada slide de Potencial gerado: quem, qual cidade, com quais ajustes e quais números.';
create index if not exists potencial_propostas_user_idx on luma.potencial_propostas (user_id, criado_em desc);
create index if not exists potencial_propostas_data_idx on luma.potencial_propostas (criado_em desc);

alter table luma.potencial_propostas enable row level security;

-- Cada um vê as próprias; a gestão vê todas.
drop policy if exists "propostas: dono e gestão leem" on luma.potencial_propostas;
create policy "propostas: dono e gestão leem" on luma.potencial_propostas
  for select to authenticated
  using (luma.pode_potencial() and (user_id = (select auth.uid()) or public.get_user_role() = 'gestao'));

-- Grava só em nome próprio, e só quem usa o Potencial.
drop policy if exists "propostas: grava em nome próprio" on luma.potencial_propostas;
create policy "propostas: grava em nome próprio" on luma.potencial_propostas
  for insert to authenticated
  with check (luma.pode_potencial() and user_id = (select auth.uid()));

-- Histórico não se edita; só a gestão apaga (limpeza de teste).
drop policy if exists "propostas: gestão apaga" on luma.potencial_propostas;
create policy "propostas: gestão apaga" on luma.potencial_propostas
  for delete to authenticated using (public.get_user_role() = 'gestao');

grant select, insert, delete on luma.potencial_propostas to authenticated;
