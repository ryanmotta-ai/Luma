-- ============================================================
-- LUMA — Franquias: cidades da Base Ops OUT.26 no "Qual é a sua franquia?", 29/10/2026
-- ============================================================
-- O pop-up de primeiro acesso (`gFranquiaIniciar`) lista só `luma.franquias` com status 'ativa'
-- e `codigo` preenchido (RPC `franquias_para_escolha`). Só 42 cidades estavam lá: o franqueado
-- de Tupã/SP e de outras cidades operadas pela DM não achava a própria franquia ("Escolha uma
-- franquia da lista"). Esta migration inclui as cidades da aba "Base Ops OUT.26" nas fases
-- Operação Ongoing e Implementação que ainda não existem.
--
--   · "Operação Própria" (17 cidades) fica de FORA: não tem franqueado, e cada cidade a mais na
--     lista é uma chance de escolha errada — que só a gestão desfaz.
--   · Já existe (mesmo `codigo` OU mesma cidade+UF)? Não duplica.
--   · lat/lon ficam nulos: só servem ao "Usar minha localização" (que ignora quem não tem);
--     digitar o nome funciona. Preencher depois se quiserem o GPS.
-- Idempotente.

insert into luma.franquias (codigo, nome, cidade, uf, status)
select v.codigo, v.nome, v.cidade, v.uf, 'ativa'
  from (values
  ('canoinhas-sc','Canoinhas','Canoinhas','SC'),
  ('caratinga-mg','Caratinga','Caratinga','MG'),
  ('erechim-rs','Erechim','Erechim','RS'),
  ('formosa-go','Formosa','Formosa','GO'),
  ('indaial-sc','Indaial','Indaial','SC'),
  ('joacaba-sc','Joaçaba','Joaçaba','SC'),
  ('mirandopolis-sp','Mirandópolis','Mirandópolis','SP'),
  ('nova-prata-rs','Nova Prata','Nova Prata','RS'),
  ('panambi-rs','Panambi','Panambi','RS'),
  ('pimenta-bueno-ro','Pimenta Bueno','Pimenta Bueno','RO'),
  ('rolim-de-moura-ro','Rolim de Moura','Rolim de Moura','RO'),
  ('santa-maria-rs','Santa Maria','Santa Maria','RS'),
  ('sapezal-mt','Sapezal','Sapezal','MT'),
  ('sarandi-rs','Sarandi','Sarandi','RS'),
  ('teutonia-rs','Teutônia','Teutônia','RS'),
  ('timbo-sc','Timbó','Timbó','SC'),
  ('tres-barras-sc','Três Barras','Três Barras','SC'),
  ('veranopolis-rs','Veranópolis','Veranópolis','RS'),
  ('vilhena-ro','Vilhena','Vilhena','RO'),
  ('aguas-de-chapeco-sc','Águas de Chapecó','Águas de Chapecó','SC'),
  ('alegrete-rs','Alegrete','Alegrete','RS'),
  ('caceres-mt','Cáceres','Cáceres','MT'),
  ('cacoal-ro','Cacoal','Cacoal','RO'),
  ('colinas-ma','Colinas','Colinas','MA'),
  ('dom-pedrito-rs','Dom Pedrito','Dom Pedrito','RS'),
  ('frederico-westphalen-rs','Frederico Westphalen','Frederico Westphalen','RS'),
  ('itapiranga-sc','Itapiranga','Itapiranga','SC'),
  ('ji-parana-ro','Ji-Paraná','Ji-Paraná','RO'),
  ('jose-bonifacio-sp','José Bonifácio','José Bonifácio','SP'),
  ('nova-itaberaba-sc','Nova Itaberaba','Nova Itaberaba','SC'),
  ('otacilio-costa-sc','Otacílio Costa','Otacílio Costa','SC'),
  ('pinhalzinho-sc','Pinhalzinho','Pinhalzinho','SC'),
  ('rosario-do-sul-rs','Rosário do Sul','Rosário do Sul','RS'),
  ('santa-rosa-rs','Santa Rosa','Santa Rosa','RS'),
  ('santana-do-livramento-rs','Santana do Livramento','Santana do Livramento','RS'),
  ('sao-carlos-sc','São Carlos','São Carlos','SC'),
  ('sao-gabriel-rs','São Gabriel','São Gabriel','RS'),
  ('sao-joaquim-sc','São Joaquim','São Joaquim','SC'),
  ('uruguaiana-rs','Uruguaiana','Uruguaiana','RS'),
  ('barracao-sc','Barracão','Barracão','SC'),
  ('cacador-sc','Caçador','Caçador','SC'),
  ('dionisio-cerqueira-sc','Dionísio Cerqueira','Dionísio Cerqueira','SC'),
  ('girua-rs','Giruá','Giruá','RS'),
  ('goianesia-go','Goianésia','Goianésia','GO'),
  ('guapiacu-sp','Guapiaçu','Guapiaçu','SP'),
  ('palmeira-das-missoes-rs','Palmeira das Missões','Palmeira das Missões','RS'),
  ('paragominas-pa','Paragominas','Paragominas','PA'),
  ('piedade-sp','Piedade','Piedade','SP'),
  ('seara-sc','Seara','Seara','SC'),
  ('sidrolandia-ms','Sidrolândia','Sidrolândia','MS'),
  ('urubici-sc','Urubici','Urubici','SC'),
  ('barreiras-ba','Barreiras','Barreiras','BA'),
  ('cachoeira-do-sul-rs','Cachoeira do Sul','Cachoeira do Sul','RS'),
  ('campo-verde-mt','Campo Verde','Campo Verde','MT'),
  ('carlos-barbosa-rs','Carlos Barbosa','Carlos Barbosa','RS'),
  ('dracena-sp','Dracena','Dracena','SP'),
  ('garibaldi-rs','Garibaldi','Garibaldi','RS'),
  ('junqueiropolis-sp','Junqueirópolis','Junqueirópolis','SP'),
  ('lages-sc','Lages','Lages','SC'),
  ('mafra-sc','Mafra','Mafra','SC'),
  ('marialva-pr','Marialva','Marialva','PR'),
  ('pontes-e-lacerda-mt','Pontes e Lacerda','Pontes e Lacerda','MT'),
  ('primavera-do-leste-mt','Primavera do Leste','Primavera do Leste','MT'),
  ('rio-do-sul-sc','Rio do Sul','Rio do Sul','SC'),
  ('rio-negro-pr','Rio Negro','Rio Negro','PR'),
  ('rondonopolis-mt','Rondonópolis','Rondonópolis','MT'),
  ('tupa-sp','Tupã','Tupã','SP'),
  ('vacaria-rs','Vacaria','Vacaria','RS'),
  ('andradas-mg','Andradas','Andradas','MG'),
  ('capinzal-sc','Capinzal','Capinzal','SC'),
  ('castro-pr','Castro','Castro','PR'),
  ('cerejeiras-ro','Cerejeiras','Cerejeiras','RO'),
  ('ibiuna-sp','Ibiúna','Ibiúna','SP'),
  ('jacarezinho-pr','Jacarezinho','Jacarezinho','PR'),
  ('jaciara-mt','Jaciara','Jaciara','MT'),
  ('jales-sp','Jales','Jales','SP'),
  ('lagoa-vermelha-rs','Lagoa Vermelha','Lagoa Vermelha','RS'),
  ('mairinque-sp','Mairinque','Mairinque','SP'),
  ('ouro-sc','Ouro','Ouro','SC'),
  ('presidente-venceslau-sp','Presidente Venceslau','Presidente Venceslau','SP'),
  ('sao-roque-sp','São Roque','São Roque','SP'),
  ('tenente-portela-rs','Tenente Portela','Tenente Portela','RS'),
  ('paranatinga-mt','Paranatinga','Paranatinga','MT')
       ) as v(codigo, nome, cidade, uf)
 where not exists (
   select 1 from luma.franquias f
    where f.codigo = v.codigo
       or (lower(f.cidade) = lower(v.cidade) and f.uf = v.uf));
