-- ============================================================
-- LUMA — Acesso restrito a uma área (hoje: só o Potencial), 29/10/2026
-- ============================================================
-- O Aladim (comercial) precisa da calculadora Potencial, que só a equipe DM abre — e `equipe_dm`
-- também abre o Estúdio, o Dados e o Console. Esta tabela marca quem deve ver SÓ uma área:
-- o front (`gAreaRestrita`, js/core/auth.js) esconde o resto da navegação.
--
-- ⚠ É restrição de NAVEGAÇÃO, não de segurança. A role continua `equipe_dm`, então a RLS ainda
-- deixa essa conta fazer o que `is_designer()` deixa (ex.: gravar template pela API). Se isso
-- virar problema, o endurecimento é trocar `is_designer()` por uma função que descontasse quem
-- está aqui — e republicar o Apps Script, que confere a role em `profiles`.
-- Falha de leitura no front = menu completo (fail-open): é conforto, não fronteira.
--
-- Quem lê: cada pessoa, a própria linha. Quem escreve: só a gestão (SQL Editor por enquanto).
-- Idempotente.

create table if not exists luma.acesso_restrito (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  area       text not null check (area in ('potencial')),
  criado_em  timestamptz not null default now()
);
comment on table luma.acesso_restrito is
  'Quem deve ver só uma área do Luma (navegação). Não substitui a RLS.';

alter table luma.acesso_restrito enable row level security;

drop policy if exists "acesso restrito: cada um lê o próprio" on luma.acesso_restrito;
create policy "acesso restrito: cada um lê o próprio" on luma.acesso_restrito
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "acesso restrito: gestão escreve" on luma.acesso_restrito;
create policy "acesso restrito: gestão escreve" on luma.acesso_restrito
  for all to authenticated
  using (public.get_user_role() = 'gestao') with check (public.get_user_role() = 'gestao');

grant select, insert, update, delete on luma.acesso_restrito to authenticated;

-- Aladim Alves dos Santos (comercial): só o Potencial.
insert into luma.acesso_restrito (user_id, area)
select id, 'potencial' from public.profiles where email = 'aladim.santos@deliverymuch.com.br'
on conflict (user_id) do nothing;
