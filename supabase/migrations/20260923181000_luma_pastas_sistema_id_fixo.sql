-- ============================================================
-- LUMA — pastas de sistema com id fixo + faxina das duplicatas, 23/09/2026
-- ============================================================
-- "⭐ Modelo de exemplo" e "Rascunhos" nasciam com id local em cada aparelho e o push dava a
-- cada uma um id novo: 20 Modelo (a vitrine mostrava todas como campanha) e 8 Rascunhos. O
-- front (v=128) passa a usar id FIXO — G_PASTA_MODELO_ID / G_PASTA_RASC_ID em js/00-config.js.
-- Aqui: cria as duas linhas de id fixo, MOVE os templates das cópias para elas e só então
-- apaga as cópias. ⚠ templates.pasta_id é ON DELETE CASCADE: a exclusão exige a pasta vazia
-- (not exists) — nenhum template pode ir junto. Aprovado pelo Ryan (apagar as vazias, juntar
-- as que têm conteúdo).
--
-- ORDEM: rodar DEPOIS do front v=128 no ar. Com o front antigo, um cache local ainda
-- reenviaria as pastas velhas no próximo save.

begin;

-- 1) As linhas de id fixo, copiando a cópia mais completa de cada uma.
insert into luma.pastas (id, nome, cor, camp_id, cover_url, badge, expira_dias, popular, preview_prod,
  preview_de, preview_por, perguntas, grupos, agendamento, ordem, ativa, destaque, criado_por)
select '4c554d41-0000-4000-8000-00000000000a', nome, cor, null, cover_url, badge, expira_dias, popular,
  preview_prod, preview_de, preview_por, perguntas, grupos, agendamento, ordem, ativa, destaque, criado_por
from luma.pastas p where p.nome = '⭐ Modelo de exemplo'
order by (select count(*) from luma.templates t where t.pasta_id = p.id) desc, p.updated_at desc limit 1
on conflict (id) do nothing;

insert into luma.pastas (id, nome, cor, camp_id, cover_url, badge, expira_dias, popular, preview_prod,
  preview_de, preview_por, perguntas, grupos, agendamento, ordem, ativa, destaque, criado_por)
select '4c554d41-0000-4000-8000-00000000000b', nome, cor, null, cover_url, badge, expira_dias, popular,
  preview_prod, preview_de, preview_por, perguntas, grupos, agendamento, ordem, false, destaque, criado_por
from luma.pastas p where p.nome = 'Rascunhos'
order by p.updated_at desc limit 1
on conflict (id) do nothing;

-- 2) Templates das cópias → a pasta de id fixo.
update luma.templates set pasta_id = '4c554d41-0000-4000-8000-00000000000a'
where pasta_id in (select id from luma.pastas where nome = '⭐ Modelo de exemplo'
                   and id <> '4c554d41-0000-4000-8000-00000000000a');
update luma.templates set pasta_id = '4c554d41-0000-4000-8000-00000000000b'
where pasta_id in (select id from luma.pastas where nome = 'Rascunhos'
                   and id <> '4c554d41-0000-4000-8000-00000000000b');

-- 3) Apaga as cópias — só as que ficaram VAZIAS.
delete from luma.pastas p
where p.nome in ('⭐ Modelo de exemplo', 'Rascunhos')
  and p.id not in ('4c554d41-0000-4000-8000-00000000000a', '4c554d41-0000-4000-8000-00000000000b')
  and not exists (select 1 from luma.templates t where t.pasta_id = p.id);

commit;
