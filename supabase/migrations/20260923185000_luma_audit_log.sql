-- ============================================================
-- LUMA — Audit log: "quem fez isso?", 23/09/2026
-- ============================================================
-- Até aqui só as feature flags tinham histórico (feature_flag_history). Criar, editar,
-- publicar, despublicar e arquivar campanha/template, mudar papel ou desativar alguém: nada
-- registrava quem nem quando.
--
-- Um gatilho genérico AFTER em pastas, templates, profiles, franquias e usuario_franquias grava
-- em luma.audit_log: tabela, id do registro, ação, quem (auth.uid()), quando e QUAIS campos
-- mudaram — nomes de coluna, não valores (layers de template não entram: o conteúdo já mora em
-- template_versions). Ações de negócio ganham nome próprio: publicou / despublicou / arquivou /
-- desarquivou / mudou_papel / desativou / reativou. `resumo` guarda o essencial legível
-- (nome, papel antigo → novo), sem dado pessoal além do que a própria tabela já tem.
--
-- Lê: gestão e equipe DM. Escreve: só o gatilho (SECURITY DEFINER). Ninguém edita nem apaga.
-- Mudança feita pelo banco sem usuário (migration, service role) fica com quem = NULL.

create table if not exists luma.audit_log (
  id          bigint generated always as identity primary key,
  tabela      text not null,
  registro_id text not null,
  acao        text not null,
  campos      text[],
  resumo      jsonb,
  quem        uuid default auth.uid(),
  quando      timestamptz not null default now()
);
create index if not exists audit_log_registro_idx on luma.audit_log (tabela, registro_id, quando desc);
create index if not exists audit_log_quando_idx on luma.audit_log (quando desc);
create index if not exists audit_log_quem_idx on luma.audit_log (quem, quando desc);

alter table luma.audit_log enable row level security;
drop policy if exists "equipe lê auditoria" on luma.audit_log;
create policy "equipe lê auditoria" on luma.audit_log
  for select to authenticated using ((select public.is_designer()));
grant select on luma.audit_log to authenticated;

create or replace function luma.auditar()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  o jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  n jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  -- Colunas que mudam sozinhas ou são conteúdo pesado: não contam como "o que mudou".
  ignora text[] := array['updated_at','created_at','layers','versao_atual_id','thumb_url'];
  campos text[];
  acao text := lower(tg_op);
  r jsonb := coalesce(n, o);
begin
  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into campos
      from jsonb_object_keys(n) k
     where not (k = any(ignora)) and (o -> k) is distinct from (n -> k);
    -- Só o que o sistema mexe sozinho (ex.: updated_at, versão atual): não é ação de ninguém.
    if campos is null and (o -> 'layers') is not distinct from (n -> 'layers') then return null; end if;
    if campos is null then
      campos := array['layers'];
      -- Autosave do Estúdio grava o template a cada edição. Mexida SÓ no conteúdo, pela mesma
      -- pessoa, no mesmo registro: uma linha a cada 10 min basta para "quem editou".
      if exists (select 1 from luma.audit_log a
                  where a.tabela = tg_table_name and a.registro_id = r->>'id' and a.acao = 'update'
                    and a.quem is not distinct from auth.uid() and a.quando > now() - interval '10 minutes') then
        return null;
      end if;
    end if;
    if tg_table_name = 'templates' and (o->>'publicado') is distinct from (n->>'publicado') then
      acao := case when (n->>'publicado')::boolean then 'publicou' else 'despublicou' end;
    elsif tg_table_name = 'pastas' and (o->>'ativa') is distinct from (n->>'ativa') then
      acao := case when (n->>'ativa')::boolean then 'desarquivou' else 'arquivou' end;
    elsif tg_table_name = 'profiles' and (o->>'role') is distinct from (n->>'role') then
      acao := 'mudou_papel';
    elsif tg_table_name = 'profiles' and (o->>'ativo') is distinct from (n->>'ativo') then
      acao := case when (n->>'ativo')::boolean then 'reativou' else 'desativou' end;
    end if;
  end if;
  insert into luma.audit_log (tabela, registro_id, acao, campos, resumo)
  values (tg_table_name,
          coalesce(r->>'id', (r->>'user_id') || ':' || (r->>'franquia_id')),
          acao, campos,
          jsonb_strip_nulls(jsonb_build_object(
            'nome', coalesce(r->>'nome', r->>'name'),
            'papel_antes', case when acao = 'mudou_papel' then o->>'role' end,
            'papel_depois', case when acao = 'mudou_papel' then n->>'role' end,
            'pasta_id', r->>'pasta_id', 'camp_id', r->>'camp_id', 'franquia_id', r->>'franquia_id')));
  return null;
end;
$$;
revoke all on function luma.auditar() from public, anon, authenticated;

do $$ declare t text; begin
  foreach t in array array['luma.pastas','luma.templates','public.profiles','luma.franquias','luma.usuario_franquias'] loop
    execute format('drop trigger if exists auditar on %s', t);
    execute format('create trigger auditar after insert or update or delete on %s for each row execute function luma.auditar()', t);
  end loop;
end $$;
