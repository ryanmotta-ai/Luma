-- ============================================================
-- LUMA — Franquias (unidades) e o vínculo usuário ↔ unidade, 23/09/2026
-- ============================================================
-- Até aqui "franquia" era um texto solto no perfil (profiles.franquia/cidade, de hoje cedo):
-- sem tabela, sem identificador, sem como uma pessoa estar em duas unidades e sem base para
-- filtrar conteúdo por unidade.
--
--   · luma.franquias          — a unidade: nome, cidade, UF, código interno único, status.
--   · luma.usuario_franquias  — N:N usuário ↔ unidade (dono de duas cidades existe).
--   · RLS: franqueado vê só as próprias unidades; equipe DM e gestão veem todas; SÓ a gestão
--     escreve (mesma regra do guard_profile_role para cidade/franquia).
--   · A tela Equipe continua editando os dois textos do perfil. Um gatilho em profiles traduz:
--     acha (ou cria) a unidade por nome+cidade e liga a pessoa. A estrutura se monta sem mudar
--     a interface. ⚠ Pela tela a pessoa fica com UMA unidade — o gatilho troca o vínculo que
--     ELE criou (origem = 'perfil'); vínculos extras feitos direto na tabela são preservados.
--
-- Filtrar CONTEÚDO por unidade (pasta só para a franquia X) não entra aqui: a base existe,
-- a regra de negócio ainda não foi decidida.

create table if not exists luma.franquias (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null check (length(btrim(nome)) between 1 and 120),
  cidade      text check (cidade is null or length(cidade) <= 120),
  uf          text check (uf is null or uf ~ '^[A-Z]{2}$'),
  codigo      text unique check (codigo is null or length(codigo) <= 40),
  status      text not null default 'ativa' check (status in ('ativa', 'inativa')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- Uma unidade por nome+cidade (sem caixa, sem espaço sobrando): é a chave que o gatilho usa.
create unique index if not exists franquias_nome_cidade_uq
  on luma.franquias (lower(btrim(nome)), lower(btrim(coalesce(cidade, ''))));

create table if not exists luma.usuario_franquias (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  franquia_id  uuid not null references luma.franquias(id) on delete restrict,
  origem       text not null default 'manual' check (origem in ('manual', 'perfil')),
  created_at   timestamptz not null default now(),
  primary key (user_id, franquia_id)
);
create index if not exists usuario_franquias_franquia_idx on luma.usuario_franquias (franquia_id);

drop trigger if exists touch_franquias_updated on luma.franquias;
create trigger touch_franquias_updated before update on luma.franquias
  for each row execute function public.touch_updated_at();

alter table luma.franquias enable row level security;
alter table luma.usuario_franquias enable row level security;

drop policy if exists "equipe vê franquias; franqueado vê as suas" on luma.franquias;
create policy "equipe vê franquias; franqueado vê as suas" on luma.franquias
  for select to authenticated using (
    (select public.is_designer())
    or ((select public.is_ativo()) and exists (
      select 1 from luma.usuario_franquias uf where uf.franquia_id = franquias.id and uf.user_id = (select auth.uid()))));
drop policy if exists "gestão gerencia franquias" on luma.franquias;
create policy "gestão gerencia franquias" on luma.franquias
  for all to authenticated
  using ((select public.get_user_role()) = 'gestao')
  with check ((select public.get_user_role()) = 'gestao');

drop policy if exists "equipe vê vínculos; franqueado vê os seus" on luma.usuario_franquias;
create policy "equipe vê vínculos; franqueado vê os seus" on luma.usuario_franquias
  for select to authenticated using ((select public.is_designer()) or user_id = (select auth.uid()));
drop policy if exists "gestão gerencia vínculos" on luma.usuario_franquias;
create policy "gestão gerencia vínculos" on luma.usuario_franquias
  for all to authenticated
  using ((select public.get_user_role()) = 'gestao')
  with check ((select public.get_user_role()) = 'gestao');

grant select, insert, update, delete on luma.franquias, luma.usuario_franquias to authenticated;

-- Perfil → unidade. SECURITY DEFINER porque roda dentro do update do perfil; quem pode mudar
-- cidade/franquia já foi decidido antes pelo guard_profile_role (só gestão).
create or replace function luma.perfil_para_franquia()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare fid uuid; nome_ text := nullif(btrim(coalesce(new.franquia, '')), ''); cid_ text := nullif(btrim(coalesce(new.cidade, '')), '');
begin
  if tg_op = 'UPDATE' and new.franquia is not distinct from old.franquia and new.cidade is not distinct from old.cidade then
    return new;
  end if;
  delete from luma.usuario_franquias where user_id = new.id and origem = 'perfil';
  if nome_ is null then return new; end if;
  select id into fid from luma.franquias
   where lower(btrim(nome)) = lower(nome_) and lower(btrim(coalesce(cidade, ''))) = lower(coalesce(cid_, ''));
  if fid is null then
    insert into luma.franquias (nome, cidade) values (nome_, cid_) returning id into fid;
  end if;
  insert into luma.usuario_franquias (user_id, franquia_id, origem) values (new.id, fid, 'perfil')
  on conflict (user_id, franquia_id) do nothing;
  return new;
end;
$$;
revoke all on function luma.perfil_para_franquia() from public, anon, authenticated;

drop trigger if exists perfil_para_franquia on public.profiles;
create trigger perfil_para_franquia after insert or update of franquia, cidade on public.profiles
  for each row execute function luma.perfil_para_franquia();
