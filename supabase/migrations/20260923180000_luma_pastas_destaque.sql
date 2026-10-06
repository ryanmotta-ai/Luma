-- ============================================================
-- LUMA — pastas.destaque: a seção da vitrine sai do código, 23/09/2026
-- ============================================================
-- A vitrine do franqueado tem duas seções — "Ativas agora" e "Outras campanhas" — e quem
-- decidia era só a LISTA do js/00-config.js em que a campanha tinha sido escrita
-- (CAMPS_ATIVAS × CAMPS_OUTRAS). Mudar uma campanha de seção exigia deploy. Agora é um
-- interruptor no modal da pasta, no Estúdio (decisão do Ryan).
--
-- Padrão true: campanha nova criada no Estúdio já entra em "Ativas agora", como entrava.
-- As que estavam em CAMPS_OUTRAS nascem false para a vitrine não mudar de um dia para o outro.

alter table luma.pastas add column if not exists destaque boolean not null default true;

update luma.pastas set destaque = false
where camp_id in ('pt', 'gb', 'otp', 'eg', 'ac', 'aai', 'mna', 'cc');
