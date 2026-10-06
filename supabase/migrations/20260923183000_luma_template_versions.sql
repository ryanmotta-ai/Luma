-- ============================================================
-- LUMA — Versionamento de templates, 23/09/2026
-- ============================================================
-- PROBLEMA: publicar SOBRESCREVIA luma.templates.layers, e a arte do franqueado guardava só o
-- template_id. Mexer no template hoje mudava a arte que alguém criou ontem ao reabrir/rebaixar,
-- não havia rollback, e "o que estava no ar dia X" não tinha resposta.
--
-- DESENHO:
--   · luma.template_versions — foto IMUTÁVEL do conteúdo de um template publicado. Sem policy
--     de insert/update/delete: nenhum cliente escreve nem apaga. Quem grava é o gatilho.
--   · Gatilho BEFORE em luma.templates: template PUBLICADO cujo conteúdo (layers, tamanho, fundo,
--     formatos, permissões) difere da versão atual ganha uma versão nova, e
--     templates.versao_atual_id aponta para ela. É o servidor quem garante — publicar pelo
--     front antigo, pelo console ou por SQL versiona igual. Rascunho não versiona.
--   · luma.artes.template_version_id — a versão usada na arte. Reabrir usa ELA.
--   · luma.restaurar_versao(id) — rollback: copia a versão antiga de volta para o template;
--     o gatilho registra isso como versão NOVA (o histórico não se perde).
--
-- template_versions.template_id NÃO tem FK de propósito: excluir o template não pode levar
-- junto a versão que uma arte antiga usa. Custo medido: layers têm ~1,3 KB em média (as
-- imagens moram no Storage), então uma versão por mudança publicada é barato.

create table if not exists luma.template_versions (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null,
  versao       integer not null,
  nome         text,
  fmt          text,
  formats      jsonb,
  w            integer,
  h            integer,
  bg           text,
  layers       jsonb not null,
  permissoes   jsonb,
  instrucoes   text,
  criado_por   uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  unique (template_id, versao)
);
create index if not exists template_versions_template_idx on luma.template_versions (template_id, versao desc);

alter table luma.template_versions enable row level security;
-- Franqueado lê: reabrir a própria arte precisa do conteúdo da versão que ela usou. Só existe
-- versão de template que foi publicado, então isto não expõe rascunho.
drop policy if exists "conta ativa lê versões" on luma.template_versions;
create policy "conta ativa lê versões" on luma.template_versions
  for select to authenticated using ((select public.is_designer()) or (select public.is_ativo()));

alter table luma.templates add column if not exists versao_atual_id uuid references luma.template_versions(id);
alter table luma.artes add column if not exists template_version_id uuid references luma.template_versions(id) on delete set null;
create index if not exists artes_template_version_idx on luma.artes (template_version_id);

create or replace function luma.versionar_template()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  atual luma.template_versions;
  nova_id uuid;
begin
  if not coalesce(new.publicado, false) then return new; end if;
  if new.versao_atual_id is not null then
    select * into atual from luma.template_versions where id = new.versao_atual_id;
  end if;
  if atual.id is not null
     and atual.layers is not distinct from new.layers
     and atual.w is not distinct from new.w and atual.h is not distinct from new.h
     and atual.bg is not distinct from new.bg and atual.fmt is not distinct from new.fmt
     and atual.formats is not distinct from new.formats
     and atual.permissoes is not distinct from new.permissoes then
    return new;   -- nada mudou no que o franqueado vê: autosave não gera versão
  end if;
  insert into luma.template_versions (template_id, versao, nome, fmt, formats, w, h, bg, layers, permissoes, instrucoes)
  values (new.id,
          coalesce((select max(v.versao) from luma.template_versions v where v.template_id = new.id), 0) + 1,
          new.nome, new.fmt, new.formats, new.w, new.h, new.bg, coalesce(new.layers, '[]'::jsonb),
          new.permissoes, new.instrucoes)
  returning id into nova_id;
  new.versao_atual_id := nova_id;
  return new;
end;
$$;
revoke all on function luma.versionar_template() from public, anon, authenticated;

drop trigger if exists versionar_template on luma.templates;
create trigger versionar_template before insert or update on luma.templates
  for each row execute function luma.versionar_template();

-- Rollback. INVOKER: quem pode é quem a RLS de luma.templates deixa atualizar (designer).
create or replace function luma.restaurar_versao(p_version uuid)
returns uuid language plpgsql security invoker set search_path = ''
as $$
declare v luma.template_versions; r uuid;
begin
  select * into v from luma.template_versions where id = p_version;
  if v.id is null then raise exception 'versão não encontrada' using errcode = 'P0002'; end if;
  update luma.templates
     set layers = v.layers, w = v.w, h = v.h, bg = v.bg, fmt = v.fmt, formats = v.formats, permissoes = v.permissoes
   where id = v.template_id
  returning versao_atual_id into r;
  if r is null then raise exception 'template não encontrado ou sem permissão' using errcode = '42501'; end if;
  return r;
end;
$$;
revoke all on function luma.restaurar_versao(uuid) from public, anon;
grant execute on function luma.restaurar_versao(uuid) to authenticated;
grant select on luma.template_versions to authenticated;

-- Carga inicial: versão 1 de todo template já publicado. Sem passar pelo gatilho de
-- updated_at — tocar updated_at faria o Estúdio aberto acusar "alguém salvou depois".
alter table luma.templates disable trigger touch_templates_updated;
update luma.templates set layers = layers where publicado and versao_atual_id is null;
alter table luma.templates enable trigger touch_templates_updated;
