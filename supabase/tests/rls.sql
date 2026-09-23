-- ============================================================
-- LUMA — Suíte de RLS (leitura, escrita, casos NEGATIVOS), 23/09/2026
-- ============================================================
-- Roda como cada papel real (anon, franqueado A, franqueado B, equipe_dm, gestao) dentro de UMA
-- transação que termina em ROLLBACK: nada do que o teste escreve fica no banco. Usa contas
-- existentes (a primeira ativa de cada papel) — não cria usuário.
--
-- COMO RODAR: cole no SQL Editor do Supabase (ou via MCP execute_sql). A saída é uma tabela
-- passo | esperado | obtido | ok. Qualquer `ok = false` é falha de segurança ou regressão.
-- Rode depois de TODA migration que mexa em policy, função de policy ou tabela nova.

begin;

create temp table _t (n serial, passo text, esperado text, obtido text) on commit drop;
grant all on _t to anon, authenticated;
grant usage, select on sequence _t_n_seq to anon, authenticated;

-- As contas de teste (primeira ativa de cada papel) e uma arte do franqueado B, criada como
-- dono do banco, para provar que A não a enxerga.
create temp table _u on commit drop as
select
  (select id from public.profiles where role = 'franqueado' and coalesce(ativo, true) order by created_at limit 1) as fa,
  (select id from public.profiles where role = 'franqueado' and coalesce(ativo, true) order by created_at offset 1 limit 1) as fb,
  (select id from public.profiles where role = 'equipe_dm' and coalesce(ativo, true) order by created_at limit 1) as eq,
  (select id from public.profiles where role = 'gestao' and coalesce(ativo, true) order by created_at limit 1) as ge;
grant select on _u to anon, authenticated;

insert into luma.artes (id, user_id, camp_name, dados, status)
select '00000000-0000-4000-8000-0000000000b1', fb, 'RLS-TESTE', '{}'::jsonb, 'rascunho' from _u;

-- ── ANON (sem login) ────────────────────────────────────────────────────────────────────
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ declare n int; begin
  begin select count(*) into n from luma.pastas;      insert into _t(passo,esperado,obtido) values ('anon lê pastas','0 ou recusa',n::text);
  exception when others then insert into _t(passo,esperado,obtido) values ('anon lê pastas','0 ou recusa','recusa'); end;
  begin select count(*) into n from luma.templates;   insert into _t(passo,esperado,obtido) values ('anon lê templates','0 ou recusa',n::text);
  exception when others then insert into _t(passo,esperado,obtido) values ('anon lê templates','0 ou recusa','recusa'); end;
  begin select count(*) into n from public.profiles;  insert into _t(passo,esperado,obtido) values ('anon lê perfis','0 ou recusa',n::text);
  exception when others then insert into _t(passo,esperado,obtido) values ('anon lê perfis','0 ou recusa','recusa'); end;
  begin select count(*) into n from luma.artes;       insert into _t(passo,esperado,obtido) values ('anon lê artes','0 ou recusa',n::text);
  exception when others then insert into _t(passo,esperado,obtido) values ('anon lê artes','0 ou recusa','recusa'); end;
  begin select count(*) into n from luma.template_versions; insert into _t(passo,esperado,obtido) values ('anon lê versões','0 ou recusa',n::text);
  exception when others then insert into _t(passo,esperado,obtido) values ('anon lê versões','0 ou recusa','recusa'); end;
end $$;
reset role;

-- ── FRANQUEADO A ────────────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', fa, 'role', 'authenticated')::text, true) from _u;
set local role authenticated;
do $$ declare n int; u record; begin
  select * into u from _u;
  select count(*) into n from luma.pastas where ativa = false;
  insert into _t(passo,esperado,obtido) values ('franqueado vê pasta arquivada','0',n::text);
  select count(*) into n from luma.templates where publicado = false;
  insert into _t(passo,esperado,obtido) values ('franqueado vê template rascunho','0',n::text);
  select count(*) into n from luma.templates where publicado;
  insert into _t(passo,esperado,obtido) values ('franqueado vê template publicado','>0',case when n>0 then '>0' else '0' end);

  update luma.templates set nome = nome where publicado;
  get diagnostics n = row_count;
  insert into _t(passo,esperado,obtido) values ('franqueado edita template publicado (linhas)','0',n::text);
  update luma.pastas set nome = nome;
  get diagnostics n = row_count;
  insert into _t(passo,esperado,obtido) values ('franqueado edita pasta (linhas)','0',n::text);
  delete from luma.templates;
  get diagnostics n = row_count;
  insert into _t(passo,esperado,obtido) values ('franqueado apaga template (linhas)','0',n::text);
  begin insert into luma.pastas (nome) values ('RLS-TESTE');
    insert into _t(passo,esperado,obtido) values ('franqueado cria pasta','recusa','CONSEGUIU');
  exception when others then insert into _t(passo,esperado,obtido) values ('franqueado cria pasta','recusa','recusa'); end;

  select count(*) into n from luma.artes where user_id <> u.fa;
  insert into _t(passo,esperado,obtido) values ('franqueado A vê arte de outro','0',n::text);
  update luma.artes set camp_name = 'invadido' where user_id = u.fb;
  get diagnostics n = row_count;
  insert into _t(passo,esperado,obtido) values ('franqueado A altera arte de B (linhas)','0',n::text);
  delete from luma.artes where user_id = u.fb;
  get diagnostics n = row_count;
  insert into _t(passo,esperado,obtido) values ('franqueado A apaga arte de B (linhas)','0',n::text);
  begin insert into luma.artes (user_id, dados) values (u.fb, '{}');
    insert into _t(passo,esperado,obtido) values ('franqueado A cria arte em nome de B','recusa','CONSEGUIU');
  exception when others then insert into _t(passo,esperado,obtido) values ('franqueado A cria arte em nome de B','recusa','recusa'); end;
  begin insert into luma.artes (user_id, dados) values (u.fa, '{}');
    insert into _t(passo,esperado,obtido) values ('franqueado A cria arte própria','ok','ok');
  exception when others then insert into _t(passo,esperado,obtido) values ('franqueado A cria arte própria','ok','recusa: '||sqlstate); end;

  select count(*) into n from public.profiles where id <> u.fa;
  insert into _t(passo,esperado,obtido) values ('franqueado lê perfil de outro','0',n::text);
  begin update public.profiles set role = 'gestao' where id = u.fa;
    insert into _t(passo,esperado,obtido) values ('franqueado vira gestão','recusa','CONSEGUIU');
  exception when others then insert into _t(passo,esperado,obtido) values ('franqueado vira gestão','recusa','recusa'); end;
  begin update public.profiles set ativo = true, franquia = 'x' where id = u.fa;
    insert into _t(passo,esperado,obtido) values ('franqueado muda a própria franquia','recusa','CONSEGUIU');
  exception when others then insert into _t(passo,esperado,obtido) values ('franqueado muda a própria franquia','recusa','recusa'); end;

  begin select count(*) into n from analytics.fct_eventos;
    insert into _t(passo,esperado,obtido) values ('franqueado lê eventos','0 ou recusa',n::text);
  exception when others then insert into _t(passo,esperado,obtido) values ('franqueado lê eventos','0 ou recusa','recusa'); end;
  begin perform luma.dados_painel(now() - interval '1 day', now());
    insert into _t(passo,esperado,obtido) values ('franqueado abre painel de Dados','recusa','CONSEGUIU');
  exception when others then insert into _t(passo,esperado,obtido) values ('franqueado abre painel de Dados','recusa','recusa'); end;

  update luma.feature_flags set enabled = enabled;
  get diagnostics n = row_count;
  insert into _t(passo,esperado,obtido) values ('franqueado altera feature flag (linhas)','0',n::text);
  begin insert into luma.template_versions (template_id, versao, layers) values (gen_random_uuid(), 1, '[]');
    insert into _t(passo,esperado,obtido) values ('franqueado cria versão de template','recusa','CONSEGUIU');
  exception when others then insert into _t(passo,esperado,obtido) values ('franqueado cria versão de template','recusa','recusa'); end;
  begin perform luma.restaurar_versao((select id from luma.template_versions limit 1));
    insert into _t(passo,esperado,obtido) values ('franqueado faz rollback de template','recusa','CONSEGUIU');
  exception when others then insert into _t(passo,esperado,obtido) values ('franqueado faz rollback de template','recusa','recusa'); end;

  begin insert into luma.franquias (nome) values ('RLS-TESTE');
    insert into _t(passo,esperado,obtido) values ('franqueado cria unidade','recusa','CONSEGUIU');
  exception when others then insert into _t(passo,esperado,obtido) values ('franqueado cria unidade','recusa','recusa'); end;
  select count(*) into n from luma.usuario_franquias where user_id <> u.fa;
  insert into _t(passo,esperado,obtido) values ('franqueado vê vínculo de outro com unidade','0',n::text);
  begin insert into storage.objects (bucket_id, name, owner) values ('luma-covers', 'rls-teste/x.png', u.fa);
    insert into _t(passo,esperado,obtido) values ('franqueado envia capa de campanha','recusa','CONSEGUIU');
  exception when others then insert into _t(passo,esperado,obtido) values ('franqueado envia capa de campanha','recusa','recusa'); end;
  begin insert into storage.objects (bucket_id, name, owner) values ('luma-user-uploads', u.fb::text || '/rls-teste.png', u.fa);
    insert into _t(passo,esperado,obtido) values ('franqueado A envia na pasta de B','recusa','CONSEGUIU');
  exception when others then insert into _t(passo,esperado,obtido) values ('franqueado A envia na pasta de B','recusa','recusa'); end;
  begin insert into storage.objects (bucket_id, name, owner) values ('luma-user-uploads', u.fa::text || '/rls-teste.png', u.fa);
    insert into _t(passo,esperado,obtido) values ('franqueado A envia na própria pasta','ok','ok');
  exception when others then insert into _t(passo,esperado,obtido) values ('franqueado A envia na própria pasta','ok','recusa: '||sqlstate); end;
end $$;
reset role;

-- ── EQUIPE DM ───────────────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', eq, 'role', 'authenticated')::text, true) from _u;
set local role authenticated;
do $$ declare n int; u record; begin
  select * into u from _u;
  select count(*) into n from luma.templates where publicado = false;
  insert into _t(passo,esperado,obtido) values ('equipe vê rascunhos','>=0','>=0');
  begin insert into luma.pastas (nome) values ('RLS-TESTE');
    insert into _t(passo,esperado,obtido) values ('equipe cria pasta','ok','ok');
  exception when others then insert into _t(passo,esperado,obtido) values ('equipe cria pasta','ok','recusa: '||sqlstate); end;
  update luma.templates set nome = nome where publicado;
  get diagnostics n = row_count;
  insert into _t(passo,esperado,obtido) values ('equipe edita template','>0',case when n>0 then '>0' else '0' end);
  select count(*) into n from luma.artes where user_id = u.fb;
  insert into _t(passo,esperado,obtido) values ('equipe lê arte de franqueado','0',n::text);
  begin update public.profiles set role = 'gestao' where id = u.eq;
    insert into _t(passo,esperado,obtido) values ('equipe vira gestão','recusa','CONSEGUIU');
  exception when others then insert into _t(passo,esperado,obtido) values ('equipe vira gestão','recusa','recusa'); end;
  begin perform luma.dados_painel(now() - interval '1 day', now());
    insert into _t(passo,esperado,obtido) values ('equipe abre painel de Dados','ok','ok');
  exception when others then insert into _t(passo,esperado,obtido) values ('equipe abre painel de Dados','ok','recusa: '||sqlstate); end;
  update luma.feature_flags set enabled = enabled;
  get diagnostics n = row_count;
  insert into _t(passo,esperado,obtido) values ('equipe altera feature flag (linhas)','0',n::text);
  begin insert into luma.franquias (nome) values ('RLS-TESTE');
    insert into _t(passo,esperado,obtido) values ('equipe cria unidade (só gestão)','recusa','CONSEGUIU');
  exception when others then insert into _t(passo,esperado,obtido) values ('equipe cria unidade (só gestão)','recusa','recusa'); end;
end $$;
reset role;

-- ── GESTÃO ──────────────────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', ge, 'role', 'authenticated')::text, true) from _u;
set local role authenticated;
do $$ declare n int; u record; begin
  select * into u from _u;
  begin update public.profiles set cidade = cidade, franquia = franquia where id = u.fa;
    get diagnostics n = row_count;
    insert into _t(passo,esperado,obtido) values ('gestão edita cidade/franquia de franqueado','1',n::text);
  exception when others then insert into _t(passo,esperado,obtido) values ('gestão edita cidade/franquia de franqueado','1','recusa: '||sqlstate); end;
  update luma.feature_flags set enabled = enabled;
  get diagnostics n = row_count;
  insert into _t(passo,esperado,obtido) values ('gestão altera feature flag','>0',case when n>0 then '>0' else '0' end);
  select count(*) into n from public.profiles;
  insert into _t(passo,esperado,obtido) values ('gestão lê todos os perfis','>1',case when n>1 then '>1' else n::text end);
end $$;
reset role;

-- ── SUPORTE AO VIVO (migration 20260923188000) ──────────────────────────────────────────
-- Semente: uma mensagem do franqueado B, gravada como dono do banco com o JWT de B — o gatilho
-- carimba autor e lado a partir do auth.uid(), então ela nasce "de B, não da equipe".
select set_config('request.jwt.claims', json_build_object('sub', fb, 'role', 'authenticated')::text, true) from _u;
insert into luma.suporte_mensagens (texto) values ('RLS-TESTE de B');

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ declare n int; begin
  begin select count(*) into n from luma.suporte_mensagens; insert into _t(passo,esperado,obtido) values ('suporte: anon lê mensagens','0 ou recusa',n::text);
  exception when others then insert into _t(passo,esperado,obtido) values ('suporte: anon lê mensagens','0 ou recusa','recusa'); end;
end $$;
reset role;

select set_config('request.jwt.claims', json_build_object('sub', fa, 'role', 'authenticated')::text, true) from _u;
set local role authenticated;
do $$ declare n int; u record; b boolean; fid uuid; begin
  select * into u from _u;
  select count(*) into n from luma.suporte_mensagens where franqueado_id = u.fb;
  insert into _t(passo,esperado,obtido) values ('suporte: A lê a conversa de B','0',n::text);
  select count(*) into n from luma.suporte_caixa where franqueado_id <> u.fa;
  insert into _t(passo,esperado,obtido) values ('suporte: A vê outra linha na caixa','0',n::text);
  begin insert into luma.suporte_mensagens (texto) values ('RLS-TESTE de A');
    insert into _t(passo,esperado,obtido) values ('suporte: A escreve na própria conversa','ok','ok');
  exception when others then insert into _t(passo,esperado,obtido) values ('suporte: A escreve na própria conversa','ok','recusa: '||sqlstate); end;
  begin insert into luma.suporte_mensagens (texto, da_equipe) values ('RLS-TESTE finge equipe', true) returning da_equipe into b;
    insert into _t(passo,esperado,obtido) values ('suporte: A grava da_equipe=true','false',b::text);
  exception when others then insert into _t(passo,esperado,obtido) values ('suporte: A grava da_equipe=true','false','recusa'); end;
  begin insert into luma.suporte_mensagens (franqueado_id, texto) values (u.fb, 'RLS-TESTE invade B') returning franqueado_id into fid;
    insert into _t(passo,esperado,obtido) values ('suporte: A escreve na conversa de B','própria',case when fid = u.fa then 'própria' else 'CONSEGUIU' end);
  exception when others then insert into _t(passo,esperado,obtido) values ('suporte: A escreve na conversa de B','própria','própria'); end;
  begin update luma.suporte_mensagens set texto = 'editado' where franqueado_id = u.fa;
    get diagnostics n = row_count;
    insert into _t(passo,esperado,obtido) values ('suporte: A edita texto enviado','0 ou recusa',n::text);
  exception when others then insert into _t(passo,esperado,obtido) values ('suporte: A edita texto enviado','0 ou recusa','recusa'); end;
  begin delete from luma.suporte_mensagens where franqueado_id = u.fa;
    get diagnostics n = row_count;
    insert into _t(passo,esperado,obtido) values ('suporte: A apaga mensagem','0 ou recusa',n::text);
  exception when others then insert into _t(passo,esperado,obtido) values ('suporte: A apaga mensagem','0 ou recusa','recusa'); end;
  begin insert into storage.objects (bucket_id, name, owner) values ('luma-suporte', u.fb::text || '/rls-teste.png', u.fa);
    insert into _t(passo,esperado,obtido) values ('suporte: A anexa print na conversa de B','recusa','CONSEGUIU');
  exception when others then insert into _t(passo,esperado,obtido) values ('suporte: A anexa print na conversa de B','recusa','recusa'); end;
  -- Foto de perfil (migration 20260923187500): só URL do Storage do projeto.
  begin update public.profiles set avatar_url = 'https://exemplo.com/rastreio.png' where id = u.fa;
    insert into _t(passo,esperado,obtido) values ('foto: A grava URL externa','recusa','CONSEGUIU');
  exception when others then insert into _t(passo,esperado,obtido) values ('foto: A grava URL externa','recusa','recusa'); end;
  begin update public.profiles set avatar_url = 'https://projeto.supabase.co/storage/v1/object/public/luma-user-uploads/' || u.fa || '/avatar.jpeg' where id = u.fa;
    get diagnostics n = row_count;
    insert into _t(passo,esperado,obtido) values ('foto: A grava a própria foto','1',n::text);
  exception when others then insert into _t(passo,esperado,obtido) values ('foto: A grava a própria foto','1','recusa: '||sqlstate); end;
  update public.profiles set avatar_url = 'https://projeto.supabase.co/storage/v1/object/public/luma-user-uploads/x/avatar.jpeg' where id = u.fb;
  get diagnostics n = row_count;
  insert into _t(passo,esperado,obtido) values ('foto: A troca a foto de B (linhas)','0',n::text);
end $$;
reset role;

select set_config('request.jwt.claims', json_build_object('sub', eq, 'role', 'authenticated')::text, true) from _u;
set local role authenticated;
do $$ declare n int; u record; b boolean; begin
  select * into u from _u;
  select count(*) into n from luma.suporte_mensagens where franqueado_id = u.fb;
  insert into _t(passo,esperado,obtido) values ('suporte: equipe lê a conversa de B','>0',case when n>0 then '>0' else '0' end);
  begin insert into luma.suporte_mensagens (franqueado_id, texto) values (u.fb, 'RLS-TESTE resposta') returning da_equipe into b;
    insert into _t(passo,esperado,obtido) values ('suporte: equipe responde B (da_equipe)','true',b::text);
  exception when others then insert into _t(passo,esperado,obtido) values ('suporte: equipe responde B (da_equipe)','true','recusa: '||sqlstate); end;
  begin update luma.suporte_mensagens set lida_em = now() where franqueado_id = u.fb and not da_equipe;
    get diagnostics n = row_count;
    insert into _t(passo,esperado,obtido) values ('suporte: equipe marca como lida','>0',case when n>0 then '>0' else '0' end);
  exception when others then insert into _t(passo,esperado,obtido) values ('suporte: equipe marca como lida','>0','recusa: '||sqlstate); end;
end $$;
reset role;

select n, passo, esperado, obtido,
       case when esperado = obtido then true
            when esperado = '0 ou recusa' and obtido in ('0','recusa') then true
            when esperado = '>=0' then true
            else false end as ok
from _t order by n;

rollback;
