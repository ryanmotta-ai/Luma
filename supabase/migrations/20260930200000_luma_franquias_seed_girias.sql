-- ============================================================
-- LUMA — As franquias da rede, a escolha da própria franquia e as gírias por franquia, 30/09/2026
-- ============================================================
-- Até aqui luma.franquias tinha 1 linha (a do bot de teste) e 1 dos 8 franqueados vinculado:
-- a cidade do franqueado era adivinhada pelo campo da arte. Esta migration:
--   · cadastra as 41 franquias da lista do Ryan (30/09), com coordenada aproximada do centro
--     da cidade, que serve só para SUGERIR a franquia pela localização;
--   · luma.franquias_para_escolha(): a lista para o franqueado escolher. Ele não enxerga
--     luma.franquias pela RLS (só as próprias), por isso a função;
--   · luma.escolher_minha_franquia(id): o próprio franqueado se vincula, UMA vez. Trocar
--     depois é com a gestão (a tela Equipe), para ninguém pular de cidade;
--   · luma.franquia_girias: o "jeito de falar" de cada franquia (reunião de 30/09, síntese em
--     .maestri/reuniao-legenda/4-sintese.md). A IA sugere, o franqueado aprova; só `aprovada`
--     entra na legenda. Linha com franquia_id NULO e status `vetada` = veto da DM para a rede.

alter table luma.franquias add column if not exists lat double precision;
alter table luma.franquias add column if not exists lon double precision;

insert into luma.franquias (nome, cidade, uf, codigo, lat, lon) values
  ('Cáceres', 'Cáceres', 'MT', 'caceres-mt', -16.07, -57.68),
  ('Cacoal', 'Cacoal', 'RO', 'cacoal-ro', -11.44, -61.45),
  ('DM Jacarezinho', 'Jacarezinho', 'PR', 'jacarezinho-pr', -23.16, -49.97),
  ('Veranópolis', 'Veranópolis', 'RS', 'veranopolis-rs', -28.94, -51.55),
  ('Santana do Livramento', 'Santana do Livramento', 'RS', 'santana-do-livramento-rs', -30.89, -55.53),
  ('Sarandi e Constantina', 'Sarandi', 'RS', 'sarandi-constantina-rs', -27.94, -52.92),
  ('Santa Maria', 'Santa Maria', 'RS', 'santa-maria-rs', -29.68, -53.81),
  ('Capinzal-SC', 'Capinzal', 'SC', 'capinzal-sc', -27.34, -51.61),
  ('Itapiranga', 'Itapiranga', 'SC', 'itapiranga-sc', -27.17, -53.71),
  ('Mafra', 'Mafra', 'SC', 'mafra-sc', -26.11, -49.80),
  ('Comercial Lages', 'Lages', 'SC', 'lages-sc', -27.82, -50.33),
  ('São Carlos - SC', 'São Carlos', 'SC', 'sao-carlos-sc', -27.08, -53.00),
  ('Otacílio Costa', 'Otacílio Costa', 'SC', 'otacilio-costa-sc', -27.48, -50.12),
  ('Frederico Westphalen', 'Frederico Westphalen', 'RS', 'frederico-westphalen-rs', -27.36, -53.39),
  ('Ji-Paraná', 'Ji-Paraná', 'RO', 'ji-parana-ro', -10.88, -61.95),
  ('Canoinhas-SC', 'Canoinhas', 'SC', 'canoinhas-sc', -26.18, -50.39),
  ('Comercial Paragominas', 'Paragominas', 'PA', 'paragominas-pa', -2.99, -47.35),
  ('Barreiras - BA', 'Barreiras', 'BA', 'barreiras-ba', -12.15, -45.00),
  ('Deborah Gouveia (F)', null, null, 'deborah-gouveia', null, null),
  ('Rio do Sul', 'Rio do Sul', 'SC', 'rio-do-sul-sc', -27.21, -49.64),
  ('DM Andradas', 'Andradas', 'MG', 'andradas-mg', -22.07, -46.57),
  ('Giruá - RS', 'Giruá', 'RS', 'girua-rs', -28.03, -54.35),
  ('Santa Rosa', 'Santa Rosa', 'RS', 'santa-rosa-rs', -27.87, -54.48),
  ('Tenente Portela', 'Tenente Portela', 'RS', 'tenente-portela-rs', -27.37, -53.76),
  ('Comercial Lagoa Vermelha', 'Lagoa Vermelha', 'RS', 'lagoa-vermelha-rs', -28.21, -51.53),
  ('Castro', 'Castro', 'PR', 'castro-pr', -24.79, -50.01),
  ('Alegrete', 'Alegrete', 'RS', 'alegrete-rs', -29.78, -55.79),
  ('Jaciara-MT', 'Jaciara', 'MT', 'jaciara-mt', -15.96, -54.97),
  ('Teutônia', 'Teutônia', 'RS', 'teutonia-rs', -29.45, -51.81),
  ('Dom Pedrito', 'Dom Pedrito', 'RS', 'dom-pedrito-rs', -30.98, -54.67),
  ('São Joaquim - SC', 'São Joaquim', 'SC', 'sao-joaquim-sc', -28.29, -49.93),
  ('Jales-SP', 'Jales', 'SP', 'jales-sp', -20.27, -50.55),
  ('Erechim', 'Erechim', 'RS', 'erechim-rs', -27.63, -52.27),
  ('Comercial Sidrolândia', 'Sidrolândia', 'MS', 'sidrolandia-ms', -20.93, -54.96),
  ('Rondonópolis', 'Rondonópolis', 'MT', 'rondonopolis-mt', -16.47, -54.64),
  ('DM Dracena', 'Dracena', 'SP', 'dracena-sp', -21.48, -51.53),
  ('Carlos Barbosa', 'Carlos Barbosa', 'RS', 'carlos-barbosa-rs', -29.30, -51.50),
  ('Comercial Caçador', 'Caçador', 'SC', 'cacador-sc', -26.78, -51.01),
  ('Comercial Paranatinga', 'Paranatinga', 'MT', 'paranatinga-mt', -14.43, -54.05),
  ('Cachoeira do Sul-RS', 'Cachoeira do Sul', 'RS', 'cachoeira-do-sul-rs', -30.04, -52.89),
  ('Mirandópolis-SP', 'Mirandópolis', 'SP', 'mirandopolis-sp', -21.13, -51.10)
on conflict (codigo) do update set nome = excluded.nome, cidade = excluded.cidade, uf = excluded.uf,
  lat = excluded.lat, lon = excluded.lon;

-- A lista para escolher. Só franquias da rede (com código): a do bot de teste fica de fora.
create or replace function luma.franquias_para_escolha()
returns table (id uuid, nome text, cidade text, uf text, lat double precision, lon double precision)
language sql stable security definer set search_path = ''
as $$
  select f.id, f.nome, f.cidade, f.uf, f.lat, f.lon
    from luma.franquias f
   where f.status = 'ativa' and f.codigo is not null and (select public.is_ativo())
   order by f.nome;
$$;
revoke all on function luma.franquias_para_escolha() from public, anon;
grant execute on function luma.franquias_para_escolha() to authenticated;

-- O próprio franqueado se vincula, só se ainda não tem franquia nenhuma.
create or replace function luma.escolher_minha_franquia(p_franquia uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not (select public.is_ativo()) then raise exception 'não autenticado'; end if;
  if exists (select 1 from luma.usuario_franquias where user_id = uid) then
    raise exception 'você já tem uma franquia; para trocar, fale com a gestão';
  end if;
  if not exists (select 1 from luma.franquias where id = p_franquia and status = 'ativa' and codigo is not null) then
    raise exception 'franquia não encontrada';
  end if;
  insert into luma.usuario_franquias (user_id, franquia_id, origem) values (uid, p_franquia, 'manual');
  return p_franquia;
end;
$$;
revoke all on function luma.escolher_minha_franquia(uuid) from public, anon;
grant execute on function luma.escolher_minha_franquia(uuid) to authenticated;

-- ── Gírias por franquia ─────────────────────────────────────────────────────
create table if not exists luma.franquia_girias (
  id           uuid primary key default gen_random_uuid(),
  franquia_id  uuid references luma.franquias(id) on delete cascade,   -- nulo = vale para a rede (veto da DM)
  termo        text not null check (length(btrim(termo)) between 1 and 24),
  significado  text check (significado is null or length(significado) <= 80),
  origem       text not null default 'ia' check (origem in ('ia', 'franqueado', 'dm')),
  status       text not null default 'sugerida' check (status in ('sugerida', 'aprovada', 'vetada')),
  criado_por   uuid default auth.uid(),
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists franquia_girias_termo_uq
  on luma.franquia_girias (coalesce(franquia_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(termo)));

alter table luma.franquia_girias enable row level security;

-- Membro da franquia: é por aqui que o franqueado lê e escreve só a própria.
create or replace function luma.sou_da_franquia(p_franquia uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from luma.usuario_franquias where franquia_id = p_franquia and user_id = auth.uid()) $$;
revoke all on function luma.sou_da_franquia(uuid) from public, anon;
grant execute on function luma.sou_da_franquia(uuid) to authenticated;

drop policy if exists "ler gírias da própria franquia e vetos da rede" on luma.franquia_girias;
create policy "ler gírias da própria franquia e vetos da rede" on luma.franquia_girias
  for select to authenticated using (
    (select public.is_designer())
    or ((select public.is_ativo()) and (franquia_id is null or (select luma.sou_da_franquia(franquia_id)))));

drop policy if exists "franqueado cuida das gírias da própria franquia" on luma.franquia_girias;
create policy "franqueado cuida das gírias da própria franquia" on luma.franquia_girias
  for all to authenticated
  using ((select public.is_ativo()) and franquia_id is not null and origem <> 'dm' and (select luma.sou_da_franquia(franquia_id)))
  with check ((select public.is_ativo()) and franquia_id is not null and origem <> 'dm' and (select luma.sou_da_franquia(franquia_id)));

drop policy if exists "equipe DM cuida de todas as gírias" on luma.franquia_girias;
create policy "equipe DM cuida de todas as gírias" on luma.franquia_girias
  for all to authenticated
  using ((select public.is_designer()))
  with check ((select public.is_designer()));

grant select, insert, update, delete on luma.franquia_girias to authenticated;

drop trigger if exists touch_franquia_girias on luma.franquia_girias;
create or replace function luma.touch_girias() returns trigger language plpgsql set search_path = ''
as $$ begin new.atualizado_em := now(); return new; end; $$;
create trigger touch_franquia_girias before update on luma.franquia_girias
  for each row execute function luma.touch_girias();
