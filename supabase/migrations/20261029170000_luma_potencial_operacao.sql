-- ============================================================
-- LUMA — Potencial: cidades com operação da DM (Base Ops OUT.26), 29/10/2026
-- ============================================================
-- A equipe tentava gerar o slide de cidades que a DM já opera (ex.: Tupã/SP) e a base de
-- 20261029120100 não as tratava como tais. Esta migration:
--   · cria `operacao_modelo` e `operacao_fase` (a tela avisa "já tem operação DM aqui");
--   · marca as 99 cidades da aba "Base Ops OUT.26" que casam com a base IBGE
--     (Santana do Livramento = "Sant'Ana do Livramento" no IBGE, casada à mão);
--   · cria Barracão/SC (Implementação), que a base IBGE não tem (só PR e RS), com a população
--     das abas de GMV da própria Base Ops.
-- Idempotente.

alter table luma.potencial_cidades
  add column if not exists operacao_modelo text,
  add column if not exists operacao_fase   text;

insert into luma.potencial_cidades (chave, uf, nome, busca, populacao, concorrentes, vender)
values ('SC-Barracão', 'SC', 'Barracão', 'barracao sc', 10312, null, true)
on conflict (chave) do nothing;

update luma.potencial_cidades c
   set operacao_modelo = v.modelo, operacao_fase = v.fase
  from (values
  ('SC-Canoinhas','Acelerada 2.0','Operação Ongoing'),
  ('MG-Caratinga','Acelerada 2.0','Operação Ongoing'),
  ('RS-Erechim','Acelerada 2.0','Operação Ongoing'),
  ('GO-Formosa','Acelerada 2.0','Operação Ongoing'),
  ('SC-Indaial','Acelerada 2.0','Operação Ongoing'),
  ('SC-Joaçaba','Acelerada 2.0','Operação Ongoing'),
  ('SP-Mirandópolis','Acelerada 2.0','Operação Ongoing'),
  ('RS-Nova Prata','Acelerada 2.0','Operação Ongoing'),
  ('RS-Panambi','Acelerada 2.0','Operação Ongoing'),
  ('RO-Pimenta Bueno','Acelerada 2.0','Operação Ongoing'),
  ('RO-Rolim de Moura','Acelerada 2.0','Operação Ongoing'),
  ('RS-Santa Maria','Acelerada 2.0','Operação Ongoing'),
  ('MT-Sapezal','Acelerada 2.0','Operação Ongoing'),
  ('RS-Sarandi','Acelerada 2.0','Operação Ongoing'),
  ('RS-Teutônia','Acelerada 2.0','Operação Ongoing'),
  ('SC-Timbó','Acelerada 2.0','Operação Ongoing'),
  ('SC-Três Barras','Acelerada 2.0','Operação Ongoing'),
  ('RS-Veranópolis','Acelerada 2.0','Operação Ongoing'),
  ('RO-Vilhena','Acelerada 2.0','Operação Ongoing'),
  ('SC-Águas de Chapecó','Acelerada 2.0','Operação Ongoing'),
  ('RS-Alegrete','Acelerada 2.0','Operação Ongoing'),
  ('MT-Cáceres','Acelerada 2.0','Operação Ongoing'),
  ('RO-Cacoal','Acelerada 2.0','Operação Ongoing'),
  ('MA-Colinas','Acelerada 2.0','Operação Ongoing'),
  ('RS-Dom Pedrito','Acelerada 2.0','Operação Ongoing'),
  ('RS-Frederico Westphalen','Acelerada 2.0','Operação Ongoing'),
  ('SC-Itapiranga','Acelerada 2.0','Operação Ongoing'),
  ('RO-Ji-Paraná','Acelerada 2.0','Operação Ongoing'),
  ('SP-José Bonifácio','Acelerada 2.0','Operação Ongoing'),
  ('SC-Nova Itaberaba','Acelerada 2.0','Operação Ongoing'),
  ('SC-Otacílio Costa','Acelerada 2.0','Operação Ongoing'),
  ('SC-Pinhalzinho','Acelerada 2.0','Operação Ongoing'),
  ('RS-Rosário do Sul','Acelerada 2.0','Operação Ongoing'),
  ('RS-Santa Rosa','Acelerada 2.0','Operação Ongoing'),
  ('RS-Sant''Ana do Livramento','Acelerada 2.0','Operação Ongoing'),
  ('SC-São Carlos','Acelerada 2.0','Operação Ongoing'),
  ('RS-São Gabriel','Acelerada 2.0','Operação Ongoing'),
  ('SC-São Joaquim','Acelerada 2.0','Operação Ongoing'),
  ('RS-Uruguaiana','Acelerada','Operação Ongoing'),
  ('SC-Caçador','Acelerada 2.0','Implementação'),
  ('SC-Dionísio Cerqueira','Acelerada 2.0','Implementação'),
  ('RS-Giruá','Acelerada 2.0','Implementação'),
  ('GO-Goianésia','Acelerada 2.0','Implementação'),
  ('SP-Guapiaçu','Acelerada 2.0','Implementação'),
  ('MS-Maracaju','Acelerada 2.0','Operação Própria'),
  ('RS-Palmeira das Missões','Acelerada 2.0','Implementação'),
  ('PA-Paragominas','Acelerada 2.0','Implementação'),
  ('SP-Piedade','Acelerada 2.0','Implementação'),
  ('SC-Seara','Acelerada 2.0','Implementação'),
  ('MS-Sidrolândia','Acelerada 2.0','Implementação'),
  ('SC-Urubici','Acelerada 2.0','Implementação'),
  ('BA-Barreiras','Acelerada 2.0','Operação Ongoing'),
  ('RS-Cachoeira do Sul','Acelerada 2.0','Operação Ongoing'),
  ('MT-Campo Verde','Acelerada 2.0','Operação Ongoing'),
  ('RS-Carlos Barbosa','Acelerada 2.0','Operação Ongoing'),
  ('SP-Dracena','Acelerada 2.0','Operação Ongoing'),
  ('RS-Garibaldi','Acelerada 2.0','Operação Ongoing'),
  ('SP-Junqueirópolis','Acelerada 2.0','Operação Ongoing'),
  ('SC-Lages','Acelerada 2.0','Operação Ongoing'),
  ('SC-Mafra','Acelerada 2.0','Operação Ongoing'),
  ('PR-Marialva','Acelerada 2.0','Operação Ongoing'),
  ('MT-Pontes e Lacerda','Acelerada 2.0','Operação Ongoing'),
  ('MT-Primavera do Leste','Acelerada 2.0','Operação Ongoing'),
  ('SC-Rio do Sul','Acelerada 2.0','Operação Ongoing'),
  ('PR-Rio Negro','Acelerada 2.0','Operação Ongoing'),
  ('MT-Rondonópolis','Acelerada','Operação Ongoing'),
  ('SP-Tupã','Acelerada 2.0','Operação Ongoing'),
  ('RS-Vacaria','Acelerada 2.0','Operação Ongoing'),
  ('MG-Andradas','Acelerada 2.0','Operação Ongoing'),
  ('SC-Capinzal','Acelerada 2.0','Operação Ongoing'),
  ('PR-Castro','Acelerada 2.0','Operação Ongoing'),
  ('RO-Cerejeiras','Acelerada 2.0','Operação Ongoing'),
  ('MT-Guarantã do Norte','Acelerada 2.0','Operação Própria'),
  ('SP-Ibiúna','Acelerada 2.0','Operação Ongoing'),
  ('PR-Jacarezinho','Acelerada 2.0','Operação Ongoing'),
  ('MT-Jaciara','Acelerada 2.0','Operação Ongoing'),
  ('SP-Jales','Acelerada 2.0','Operação Ongoing'),
  ('RS-Lagoa Vermelha','Acelerada 2.0','Operação Ongoing'),
  ('SP-Mairinque','Acelerada 2.0','Operação Ongoing'),
  ('SC-Ouro','Acelerada 2.0','Operação Ongoing'),
  ('SP-Presidente Venceslau','Acelerada 2.0','Operação Ongoing'),
  ('SP-São Roque','Acelerada 2.0','Operação Ongoing'),
  ('RS-Tenente Portela','Acelerada 2.0','Operação Ongoing'),
  ('SP-Birigui','Operação Própria','Operação Própria'),
  ('MT-Paranatinga','Acelerada 2.0','Implementação'),
  ('SC-Caibi','Acelerada 2.0','Operação Própria'),
  ('MT-Campo Novo do Parecis','Operação Própria','Operação Própria'),
  ('MG-Diamantina','Operação Própria','Operação Própria'),
  ('RS-Espumoso','Operação Própria','Operação Própria'),
  ('SP-Itapeva','Operação Própria','Operação Própria'),
  ('GO-Jataí','Operação Própria','Operação Própria'),
  ('MT-Lucas do Rio Verde','Operação Própria','Operação Própria'),
  ('SC-Palmitos','Acelerada 2.0','Operação Própria'),
  ('SP-Penápolis','Operação Própria','Operação Própria'),
  ('GO-Rio Verde','Operação Própria','Operação Própria'),
  ('RS-Santo Ângelo','Operação Própria','Operação Própria'),
  ('SC-São Miguel do Oeste','Operação Própria','Operação Própria'),
  ('RS-Soledade','Operação Própria','Operação Própria'),
  ('SC-Videira','Operação Própria','Operação Própria')
       ) as v(chave, modelo, fase)
 where c.chave = v.chave;

update luma.potencial_cidades
   set operacao_modelo = 'Acelerada 2.0', operacao_fase = 'Implementação'
 where chave = 'SC-Barracão';
