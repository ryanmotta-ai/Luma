-- ============================================================
-- LUMA — Fotos da franquia: bucket privado + biblioteca por unidade, 27/10/2026
-- ============================================================
-- O franqueado precisa das fotos REAIS dos restaurantes da cidade dele (prato, fachada)
-- dentro das artes. Até aqui, a única foto que saía do navegador ia para
-- `luma-user-uploads` — bucket PÚBLICO por decisão registrada (avatar, QR, arte final) — e
-- o painel do chat só guardava "recentes" no IndexedDB do próprio aparelho. Resultado:
-- a foto real não existia em lugar nenhum depois de outro computador, e não havia
-- biblioteca. Esta migration cria a biblioteca da unidade, com isolamento estrito.
--
--   · bucket `luma-fotos-franquia`  — PRIVADO. Caminho `<franquia_id>/<user_id>/<uuid>.<ext>`.
--   · luma.fotos_franquia           — o índice (nome, tamanho, dimensões) do que está no bucket.
--   · Quem lê: membro da franquia (e a equipe DM, para suporte — leitura, não escrita).
--   · Quem escreve/apaga: só o dono do arquivo, e só dentro da própria franquia.
--
-- ⚠ O bucket NÃO é público de propósito: o que outras franquias não podem ver não pode
-- estar a uma URL previsível de distância. A URL que o front usa é ASSINADA (1 h), criada
-- pelo `createSignedUrls` do supabase-js; ela nunca é gravada em banco nem em localStorage.
--
-- ⚠ Depende de `luma.sou_da_franquia(uuid)` (20260930200000): é o motor ÚNICO de
-- "esta pessoa é desta unidade". Não crie um segundo. Se a migration de 30/09 não estiver
-- aplicada, esta falha aqui — de propósito, com o motivo à vista.
--
-- Idempotente: pode rodar duas vezes no SQL Editor.

-- ------------------------------------------------------------
-- §1 — O bucket
-- ------------------------------------------------------------
-- 8 MB é o mesmo teto do `luma-user-uploads` e maior que a foto já redimensionada pelo
-- front (2500 px, JPEG 0.88) — quem controla o peso de verdade é o motor de imagem do chat,
-- não o servidor. O teto aqui existe para um `curl` não encher o plano.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'luma-fotos-franquia',
  'luma-fotos-franquia',
  false,
  8 * 1024 * 1024,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ------------------------------------------------------------
-- §2 — Ler a franquia do caminho SEM quebrar em caminho inválido
-- ------------------------------------------------------------
-- `((storage.foldername(name))[1])::uuid` dentro de policy estoura 22P02 quando alguém
-- envia um arquivo para `abc/...` — e o erro aparece como falha de upload, não como
-- "caminho inválido". A função devolve null (→ a policy nega) em vez de explodir.
create or replace function luma.franquia_da_pasta(p_name text)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare fid uuid;
begin
  begin
    fid := ((storage.foldername(p_name))[1])::uuid;
  exception when others then
    return null;
  end;
  return fid;
end;
$$;
revoke all on function luma.franquia_da_pasta(text) from public, anon;
grant execute on function luma.franquia_da_pasta(text) to authenticated;

-- ------------------------------------------------------------
-- §3 — Policies do bucket (só o dono escreve; só a unidade lê)
-- ------------------------------------------------------------
-- SELECT: qualquer membro da franquia da pasta 1. Inclui `is_designer()` porque a equipe DM
-- atende o franqueado e precisa abrir a foto que ele mandou no suporte — leitura, nunca
-- escrita (nenhuma policy de INSERT/UPDATE/DELETE fala de designer).
drop policy if exists "fotos da franquia: membro lê" on storage.objects;
create policy "fotos da franquia: membro lê" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'luma-fotos-franquia'
    and (
      (select public.is_designer())
      or ((select public.is_ativo()) and (select luma.sou_da_franquia(luma.franquia_da_pasta(name))))
    )
  );

-- INSERT: a pasta 1 tem de ser a MINHA franquia e a pasta 2 tem de ser o MEU uid. As duas
-- condições juntas impedem o caso clássico de "membro da unidade A grava na pasta da B"
-- (ser membro da A não ajuda, porque a pasta 1 seria a B).
drop policy if exists "fotos da franquia: dono envia" on storage.objects;
create policy "fotos da franquia: dono envia" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'luma-fotos-franquia'
    and (select public.is_ativo())
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and (select luma.sou_da_franquia(luma.franquia_da_pasta(name)))
  );

-- UPDATE/DELETE: mesma regra nos DOIS lados (USING e WITH CHECK). Sem WITH CHECK, o dono
-- de `<minha-franquia>/<meu-uid>/x.jpg` poderia mover a linha para a pasta de outra unidade
-- — o furo que a leva de 05/09/2026 fechou em `luma-user-uploads`.
drop policy if exists "fotos da franquia: dono altera" on storage.objects;
create policy "fotos da franquia: dono altera" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'luma-fotos-franquia'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and (select luma.sou_da_franquia(luma.franquia_da_pasta(name)))
  )
  with check (
    bucket_id = 'luma-fotos-franquia'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and (select luma.sou_da_franquia(luma.franquia_da_pasta(name)))
  );

drop policy if exists "fotos da franquia: dono apaga" on storage.objects;
create policy "fotos da franquia: dono apaga" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'luma-fotos-franquia'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and (select luma.sou_da_franquia(luma.franquia_da_pasta(name)))
  );

-- ------------------------------------------------------------
-- §4 — O índice da biblioteca
-- ------------------------------------------------------------
-- Sem tabela, listar exigiria `storage.objects.list` + ler nome do arquivo como rótulo.
-- A tabela dá nome legível, dimensões e ordenação — e faz o isolamento aparecer também no
-- PostgREST, não só no Storage (duas fronteiras, a mesma regra).
create table if not exists luma.fotos_franquia (
  id            uuid primary key default gen_random_uuid(),
  franquia_id   uuid not null references luma.franquias(id) on delete cascade,
  user_id       uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  storage_path  text not null unique,
  nome          text check (nome is null or length(btrim(nome)) between 1 and 80),
  bytes         bigint check (bytes is null or bytes > 0),
  largura       int check (largura is null or largura > 0),
  altura        int check (altura is null or altura > 0),
  criado_em     timestamptz not null default now()
);
create index if not exists fotos_franquia_franquia_idx
  on luma.fotos_franquia (franquia_id, criado_em desc);

alter table luma.fotos_franquia enable row level security;

drop policy if exists "fotos: a unidade lê a própria biblioteca" on luma.fotos_franquia;
create policy "fotos: a unidade lê a própria biblioteca" on luma.fotos_franquia
  for select to authenticated
  using (
    (select public.is_designer())
    or ((select public.is_ativo()) and (select luma.sou_da_franquia(franquia_id)))
  );

-- O índice só aceita caminho dentro da própria pasta da unidade: mesmo que alguém chame o
-- PostgREST na mão, não dá para catalogar arquivo de outra franquia.
drop policy if exists "fotos: dono cataloga a própria foto" on luma.fotos_franquia;
create policy "fotos: dono cataloga a própria foto" on luma.fotos_franquia
  for insert to authenticated
  with check (
    (select public.is_ativo())
    and user_id = (select auth.uid())
    and (select luma.sou_da_franquia(franquia_id))
    and storage_path like franquia_id::text || '/%'
  );

drop policy if exists "fotos: dono tira da própria biblioteca" on luma.fotos_franquia;
create policy "fotos: dono tira da própria biblioteca" on luma.fotos_franquia
  for delete to authenticated
  using (
    (select public.is_ativo())
    and user_id = (select auth.uid())
    and (select luma.sou_da_franquia(franquia_id))
  );

-- Sem policy de UPDATE: a biblioteca não edita metadado. Quem quiser trocar a foto, apaga
-- e envia de novo — um caminho, não dois.

grant select, insert, delete on luma.fotos_franquia to authenticated;
revoke update on luma.fotos_franquia from authenticated;

-- ------------------------------------------------------------
-- Verificação rápida (rode no SQL Editor depois de aplicar):
--   select id, public, file_size_limit, allowed_mime_types
--     from storage.buckets where id = 'luma-fotos-franquia';
--   select policyname, cmd from pg_policies
--    where (schemaname = 'storage' and tablename = 'objects' and policyname like 'fotos da franquia%')
--       or (schemaname = 'luma' and tablename = 'fotos_franquia');
--   -- e a suíte completa: supabase/tests/rls.sql (3 roles, casos negativos)
-- ------------------------------------------------------------
