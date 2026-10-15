-- Luma Creative: contador de uso por dia e limite diário por franqueado.
--
-- ⚠ PREPARADA, NÃO APLICADA (14/10/2026): o conector do Supabase estava sem autorização na sessão
-- que a escreveu, então nada aqui foi executado nem testado contra o banco. Antes de aplicar:
-- rodar numa branch/projeto de teste e passar pelas 3 roles (franqueado, equipe_dm, gestao).
--
-- DECISÕES (Ryan, 14/10/2026):
--   · 20 artes por dia por franqueado; gestão e equipe_dm sem limite (o uso deles só é contado);
--   · "arte" = uma geração completa (inclui "Outras opções"), mesmo que gaste várias chamadas de IA;
--   · modelo "Rápido" (gemini-3.1-flash-lite) gasta 1; qualquer outro ("Capaz") gasta 2;
--   · o dia vira à meia-noite de Brasília.
--
-- COMO O LIMITE VALE (e o teto assumido): o front chama `luma_creative_consumir` ANTES de gerar. Ela
-- conta, grava o modelo e abre uma JANELA de 4 minutos. A Edge Function `ai`, para quem não é
-- gestão, só atende `arte.*` dentro dessa janela e usa o modelo registrado nela. Quem ignora o front
-- e chama a function direto fica sem janela (403). Quem chama `consumir` uma vez e depois dispara
-- chamadas na mão ainda tem 4 minutos, limitados pelo rate-limit de 20/min da function — é um freio
-- de custo, não contabilidade à prova de adulteração.
create table if not exists luma.creative_uso (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  dia        date        not null,
  usado      int         not null default 0 check (usado >= 0),
  pendente   int         not null default 0 check (pendente >= 0),   -- custo da última geração ainda não confirmada (estorno só vale sobre ele)
  modelo     text,
  janela_ate timestamptz,
  atualizado_em timestamptz not null default now(),
  primary key (user_id, dia)
);

alter table luma.creative_uso enable row level security;
-- Sem policy de INSERT/UPDATE/DELETE: só as funções abaixo (SECURITY DEFINER) escrevem.
drop policy if exists creative_uso_le_proprio on luma.creative_uso;
create policy creative_uso_le_proprio on luma.creative_uso for select to authenticated using (user_id = auth.uid());
drop policy if exists creative_uso_gestao_le on luma.creative_uso;
create policy creative_uso_gestao_le on luma.creative_uso for select to authenticated using (public.get_user_role() = 'gestao');
grant select on luma.creative_uso to authenticated;

-- Limite por papel. NULL = sem limite. Mudar o número aqui muda a regra (o front lê daqui).
create or replace function public.luma_creative_limite(p_papel text)
returns int language sql immutable set search_path = '' as $$
  select case when p_papel = 'franqueado' then 20 else null end;
$$;

create or replace function public.luma_creative_custo(p_modelo text)
returns int language sql immutable set search_path = '' as $$
  select case when p_modelo = 'gemini-3.1-flash-lite' then 1 else 2 end;
$$;

-- Estado de hoje (o contador do front).
create or replace function public.luma_creative_uso()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_dia date := (now() at time zone 'America/Sao_Paulo')::date;
  v_papel text := public.get_user_role();
  v_lim int := public.luma_creative_limite(v_papel);
  v_usado int := 0;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'erro', 'não autenticado'); end if;
  select coalesce(u.usado, 0) into v_usado from luma.creative_uso u where u.user_id = auth.uid() and u.dia = v_dia;
  return jsonb_build_object('ok', true, 'usado', coalesce(v_usado, 0), 'limite', v_lim,
    'restante', case when v_lim is null then null else greatest(0, v_lim - coalesce(v_usado, 0)) end,
    'ilimitado', v_lim is null, 'dia', v_dia);
end $$;

-- Conta uma geração (custo vem do MODELO, nunca do cliente) e abre a janela de 4 minutos.
create or replace function public.luma_creative_consumir(p_modelo text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_dia date := (now() at time zone 'America/Sao_Paulo')::date;
  v_papel text := public.get_user_role();
  v_lim int := public.luma_creative_limite(v_papel);
  v_custo int := public.luma_creative_custo(p_modelo);
  v_usado int;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'erro', 'não autenticado'); end if;
  insert into luma.creative_uso (user_id, dia) values (auth.uid(), v_dia) on conflict (user_id, dia) do nothing;
  select usado into v_usado from luma.creative_uso where user_id = auth.uid() and dia = v_dia for update;
  if v_lim is not null and v_usado + v_custo > v_lim then
    return jsonb_build_object('ok', false, 'motivo', 'limite', 'usado', v_usado, 'limite', v_lim, 'restante', greatest(0, v_lim - v_usado), 'custo', v_custo);
  end if;
  update luma.creative_uso
     set usado = usado + v_custo, pendente = v_custo, modelo = p_modelo,
         janela_ate = now() + interval '4 minutes', atualizado_em = now()
   where user_id = auth.uid() and dia = v_dia
  returning usado into v_usado;
  return jsonb_build_object('ok', true, 'usado', v_usado, 'limite', v_lim, 'custo', v_custo,
    'restante', case when v_lim is null then null else greatest(0, v_lim - v_usado) end, 'ilimitado', v_lim is null);
end $$;

-- Gerou e entregou: o que estava pendente vira definitivo (não dá mais para estornar).
create or replace function public.luma_creative_confirmar()
returns void language sql volatile security definer set search_path = '' as $$
  update luma.creative_uso set pendente = 0
   where user_id = auth.uid() and dia = (now() at time zone 'America/Sao_Paulo')::date;
$$;

-- Não entregou (erro ou "parar" antes da entrega): devolve o que estava pendente e fecha a janela.
create or replace function public.luma_creative_estornar()
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_dia date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  update luma.creative_uso
     set usado = greatest(0, usado - pendente), pendente = 0, janela_ate = now(), atualizado_em = now()
   where user_id = auth.uid() and dia = v_dia;
  return public.luma_creative_uso();
end $$;

-- Para a Edge Function: há geração contada e a janela está aberta? Devolve o modelo que foi pago.
create or replace function public.luma_creative_janela()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object('ok', true, 'modelo', u.modelo) from luma.creative_uso u
      where u.user_id = auth.uid() and u.dia = (now() at time zone 'America/Sao_Paulo')::date and u.janela_ate > now()),
    jsonb_build_object('ok', false));
$$;

revoke all on function public.luma_creative_uso(), public.luma_creative_consumir(text), public.luma_creative_confirmar(),
  public.luma_creative_estornar(), public.luma_creative_janela() from public, anon;
grant execute on function public.luma_creative_uso(), public.luma_creative_consumir(text), public.luma_creative_confirmar(),
  public.luma_creative_estornar(), public.luma_creative_janela() to authenticated;
grant execute on function public.luma_creative_limite(text), public.luma_creative_custo(text) to authenticated;
