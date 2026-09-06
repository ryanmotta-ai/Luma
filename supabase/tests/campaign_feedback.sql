-- Executar como postgres após as migrations. Tudo é revertido, inclusive fixtures.
-- Sem pgTAP: qualquer asserção quebrada aborta a transação.
begin;

create function pg_temp.expect_denied(statement text, expected text default '42501')
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected then return; end if;
    raise;
  end;
  raise exception 'Operação deveria falhar (%): %', expected, statement;
end;
$$;

insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-4000-9000-00000000f001','feedback-test-a@example.invalid','{}'),
 ('00000000-0000-4000-9000-00000000f002','feedback-test-b@example.invalid','{}'),
 ('00000000-0000-4000-9000-00000000f003','feedback-test-equipe@example.invalid','{}'),
 ('00000000-0000-4000-9000-00000000f004','feedback-test-gestao@example.invalid','{}'),
 ('00000000-0000-4000-9000-00000000f005','feedback-test-inativo@example.invalid','{}');
update public.profiles set role='equipe_dm' where id='00000000-0000-4000-9000-00000000f003';
update public.profiles set role='gestao' where id='00000000-0000-4000-9000-00000000f004';
update public.profiles set ativo=false where id='00000000-0000-4000-9000-00000000f005';

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-00000000f001',true);
do $$
declare payload jsonb; first_id uuid; retry_id uuid;
begin
  payload := '{"id":"00000000-0000-4000-9000-00000000c001","action_id":"test-feedback-a","type":"campaign_feedback","camp_id":"camp-test","rating":"positive","source":"generation"}';
  first_id := luma.submit_feedback(payload);
  retry_id := luma.submit_feedback(payload);
  if first_id is distinct from retry_id then raise exception 'Retry mudou a identidade'; end if;
  retry_id := luma.submit_feedback(payload || '{"id":"00000000-0000-4000-9000-00000000c002"}'::jsonb);
  if first_id is distinct from retry_id then raise exception 'Retry por action_id duplicou feedback'; end if;
  if (select count(*) from luma.campaign_feedback where action_id='test-feedback-a')<>1 then raise exception 'Feedback duplicado'; end if;
  perform luma.submit_feedback('{"id":"00000000-0000-4000-9000-00000000c003","action_id":"test-request-a","type":"content_request","query":"  PROMOÇÃO   Pizza  ","source":"search"}');
  if luma.feedback_query_normalized('  PROMOÇÃO   Pizza  ')<>'promocao pizza' then raise exception 'Normalização incorreta'; end if;
  if luma.feedback_query_normalized(E'\tPROMOÇÃO Pizza\n')<>'promocao pizza' then raise exception 'Normalização de whitespace incorreta'; end if;
  perform luma.submit_feedback(jsonb_build_object('id','00000000-0000-4000-9000-00000000c006','action_id','request:'||repeat('x',240),'type','content_request','query',repeat('x',240),'source','search'));
  perform pg_temp.expect_denied('select * from luma.content_requests()');
  perform pg_temp.expect_denied('update luma.campaign_feedback set comment=''alterado''');
  perform pg_temp.expect_denied('delete from luma.campaign_feedback');
  perform pg_temp.expect_denied($q$select luma.submit_feedback('{"id":"00000000-0000-4000-9000-00000000c004","action_id":"test-invalid","type":"campaign_feedback","camp_id":"camp-test","source":"download"}')$q$,'23514');
  perform pg_temp.expect_denied($q$select luma.submit_feedback('{"id":"00000000-0000-4000-9000-00000000c004","action_id":"test-invalid","type":"campaign_feedback","camp_id":"camp-test","rating":"negative","source":"download"}')$q$,'23514');
  perform pg_temp.expect_denied($q$select luma.submit_feedback('{"id":"00000000-0000-4000-9000-00000000c004","action_id":"test-invalid","type":"content_request","query":" ","source":"search"}')$q$,'23514');
  perform pg_temp.expect_denied($q$select luma.submit_feedback('{"user_id":"00000000-0000-4000-9000-00000000f002"}')$q$);
  perform pg_temp.expect_denied($q$insert into luma.campaign_feedback(id,user_id,type,action_id,query,source) values(gen_random_uuid(),'00000000-0000-4000-9000-00000000f002','content_request','test-spoof','pizza','search')$q$);
  perform luma.registrar_evento('00000000-0000-4000-9000-00000000e001','test_event','{}');
  perform luma.registrar_evento('00000000-0000-4000-9000-00000000e001','test_event','{}');
  perform pg_temp.expect_denied($q$select luma.registrar_evento(gen_random_uuid(),'test','{"user_id":"00000000-0000-4000-9000-00000000f002"}')$q$);
  perform pg_temp.expect_denied($q$select luma.registrar_evento(gen_random_uuid(),'test','[]')$q$,'22023');
end;
$$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-00000000f002',true);
do $$
begin
  if exists(select 1 from luma.campaign_feedback where action_id='test-feedback-a') then raise exception 'Franqueado leu feedback alheio'; end if;
  perform luma.submit_feedback('{"id":"00000000-0000-4000-9000-00000000c005","action_id":"test-request-b","type":"content_request","query":"promocao pizza","source":"search"}');
  perform pg_temp.expect_denied($q$select luma.submit_feedback('{"id":"00000000-0000-4000-9000-00000000c001","action_id":"test-collision","type":"content_request","query":"pizza","source":"search"}')$q$,'22023');
end;
$$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-00000000f003',true);
do $$
begin
  if (select count(*) from luma.campaign_feedback where action_id like 'test-%')<>3 then raise exception 'Equipe não leu feedback da rede'; end if;
  if (select request_count from luma.content_requests() where query_normalized='promocao pizza')<>2 then raise exception 'Agrupamento incorreto'; end if;
  if (select count(*) from analytics.fct_eventos where payload->>'action_id'='test-feedback-a')<>1 then raise exception 'Retry duplicou evento de feedback'; end if;
  if (select count(*) from analytics.fct_eventos where id='00000000-0000-4000-9000-00000000e001')<>1 then raise exception 'Retry duplicou evento'; end if;
  perform luma.submit_feedback('{"id":"00000000-0000-4000-9000-00000000c007","action_id":"role-equipe","type":"campaign_feedback","camp_id":"camp-test","rating":"negative","reason":"missing_format","source":"download"}');
end;
$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-00000000f004',true);
do $$
begin
  if (select count(*) from luma.campaign_feedback where action_id like 'test-%')<>3 then raise exception 'Gestão não leu feedback da rede'; end if;
  if (select request_count from luma.content_requests() where query_normalized='promocao pizza')<>2 then raise exception 'Gestão não consultou pedidos'; end if;
  perform luma.submit_feedback('{"id":"00000000-0000-4000-9000-00000000c008","action_id":"role-gestao","type":"campaign_feedback","camp_id":"camp-test","rating":"positive","source":"download"}');
end;
$$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-00000000f005',true);
do $$
begin
  if exists(select 1 from luma.campaign_feedback) then raise exception 'Conta inativa leu feedback'; end if;
  perform pg_temp.expect_denied($q$select luma.submit_feedback('{}')$q$);
  perform pg_temp.expect_denied($q$select luma.registrar_evento(gen_random_uuid(),'test','{}')$q$);
  perform pg_temp.expect_denied('select * from luma.content_requests()');
end;
$$;

set local role anon;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.expect_denied('select * from luma.campaign_feedback');
select pg_temp.expect_denied($q$select luma.submit_feedback('{}')$q$);
select pg_temp.expect_denied($q$select luma.registrar_evento(gen_random_uuid(),'test','{}')$q$);
select pg_temp.expect_denied('select * from luma.content_requests()');
rollback;
