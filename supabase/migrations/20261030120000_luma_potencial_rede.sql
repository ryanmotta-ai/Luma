-- ============================================================
-- LUMA — Potencial: a rede de verdade (GMV real das cidades que a DM já opera), 30/10/2026
-- ============================================================
-- A planilha de projeção tem UMA curva: não sabe o quanto uma cidade parecida realmente vende. A aba
-- "Base Ops OUT.26" e as abas de GMV mensal da planilha de operações trazem o GMV REAL de ~99 cidades
-- (fev, mar, jun, ago e set/2026) e, para junho, pedidos, ticket médio, clientes ativos e frequência.
-- O Luma usa isto para dizer em que percentil cai cada cenário e para calibrar a projeção de 24 meses
-- (js/potencial/motor.js → potRedeEstatisticas / potCalibraModelo). Achados: docs/POTENCIAL-CALIBRACAO.md.
--
-- ⚠ É dado COMERCIAL da rede: RLS por luma.pode_potencial() (equipe DM ou liberado só para o Potencial).
--    Franqueado não lê. Escrever: só a gestão. Sem série mensal completa e sem data de lançamento por cidade:
--    é uma FOTO de 5 datas, não uma curva de crescimento — a calibração compara níveis, não rampas.
-- Depende de 20261030100000_luma_potencial_v2.sql (luma.pode_potencial). Idempotente.

create table if not exists luma.potencial_rede (
  chave           text primary key,         -- "UF-Nome", igual a luma.potencial_cidades.chave
  nome            text    not null,
  uf              char(2) not null,
  populacao       integer not null,
  fase            text    not null,         -- Operação Ongoing | Implementação | Operação Própria
  modelo          text,
  curva           text,                     -- A | B | C (classificação interna por faturamento)
  gmv_fev         numeric, gmv_mar numeric, gmv_jun numeric, gmv_ago numeric,
  gmv_set         numeric,                  -- o mais recente: é o que a referência usa
  gmv_2025        numeric,                  -- GMV do ano de 2025
  pedidos_jun     numeric, ticket_jun numeric, clientes_jun numeric, frequencia_jun numeric,
  atualizado_em   timestamptz not null default now()
);
comment on table luma.potencial_rede is
  'GMV real das cidades operadas pela DM (Base Ops, fev–set/2026). Referência e calibração do Potencial.';

alter table luma.potencial_rede enable row level security;

drop policy if exists "potencial rede: equipe lê" on luma.potencial_rede;
create policy "potencial rede: equipe lê" on luma.potencial_rede
  for select to authenticated using (luma.pode_potencial());
drop policy if exists "potencial rede: gestão escreve" on luma.potencial_rede;
create policy "potencial rede: gestão escreve" on luma.potencial_rede
  for all to authenticated
  using (public.get_user_role() = 'gestao') with check (public.get_user_role() = 'gestao');
grant select, insert, update, delete on luma.potencial_rede to authenticated;

insert into luma.potencial_rede
  (chave, nome, uf, populacao, fase, modelo, curva, gmv_fev, gmv_mar, gmv_jun, gmv_ago, gmv_set, gmv_2025, pedidos_jun, ticket_jun, clientes_jun, frequencia_jun) values
  ('SC-Canoinhas','Canoinhas','SC',56948,'Operação Ongoing','Acelerada 2.0','B',404598.0,423873.0,467121.62,397251.0,425610.0,4960635.17,6639.0,70.36,2870.0,2.313),
  ('MG-Caratinga','Caratinga','MG',90890,'Operação Ongoing','Acelerada 2.0','C',1875.0,1317.0,721.81,975.0,1838.0,69229.56,19.0,37.99,11.0,1.727),
  ('RS-Erechim','Erechim','RS',109609,'Operação Ongoing','Acelerada 2.0','A',651286.0,678494.0,677018.88,628834.0,632363.0,8180149.97,6948.0,97.44,3188.0,2.179),
  ('GO-Formosa','Formosa','GO',121559,'Operação Ongoing','Acelerada 2.0','B',143674.0,146307.0,132483.28,100321.0,114624.0,2281515.34,2136.0,62.02,961.0,2.223),
  ('SC-Indaial','Indaial','SC',75682,'Operação Ongoing','Acelerada 2.0','C',34131.0,30240.0,27594.58,26779.0,26515.0,709676.51,312.0,88.44,225.0,1.387),
  ('SC-Joaçaba','Joaçaba','SC',31809,'Operação Ongoing','Acelerada 2.0','B',368436.0,372701.0,398809.75,340859.0,376988.0,5199974.29,4517.0,88.29,2001.0,2.257),
  ('SP-Mirandópolis','Mirandópolis','SP',27999,'Operação Ongoing','Acelerada 2.0','C',189622.0,189221.0,183841.66,156977.0,181469.0,1925490.46,2941.0,62.51,1143.0,2.573),
  ('RS-Nova Prata','Nova Prata','RS',25992,'Operação Ongoing','Acelerada 2.0','B',291906.0,312015.0,365068.54,334294.0,359289.0,3417734.97,4306.0,84.78,1971.0,2.185),
  ('RS-Panambi','Panambi','RS',45102,'Operação Ongoing','Acelerada 2.0','C',9388.0,8092.0,4635.12,2997.0,2144.0,220993.76,66.0,70.23,46.0,1.435),
  ('RO-Pimenta Bueno','Pimenta Bueno','RO',40606,'Operação Ongoing','Acelerada 2.0','B',204163.0,235069.0,268899.13,249129.0,266365.0,2363580.78,5018.0,53.59,1942.0,2.584),
  ('RO-Rolim de Moura','Rolim de Moura','RO',61976,'Operação Ongoing','Acelerada 2.0','A',710399.0,776466.0,839927.61,860810.0,907924.0,7907904.25,15124.0,55.54,4999.0,3.025),
  ('RS-Santa Maria','Santa Maria','RS',282395,'Operação Ongoing','Acelerada 2.0','A',676361.0,712750.0,717520.5,533929.0,573564.0,10181900.77,8500.0,84.41,4230.0,2.009),
  ('MT-Sapezal','Sapezal','MT',30085,'Operação Ongoing','Acelerada 2.0','C',61996.0,62013.0,57935.44,null,57102.0,794864.34,966.0,59.97,421.0,2.295),
  ('RS-Sarandi','Sarandi','RS',22990,'Operação Ongoing','Acelerada 2.0','B',262713.0,295796.0,394904.25,351551.0,397058.0,2929390.64,5921.0,66.7,2180.0,2.716),
  ('RS-Teutônia','Teutônia','RS',33205,'Operação Ongoing','Acelerada 2.0','B',233839.0,259012.0,273947.4,258030.0,266323.0,2901137.8,4210.0,65.07,1825.0,2.307),
  ('SC-Timbó','Timbó','SC',48933,'Operação Ongoing','Acelerada 2.0','C',4286.0,5843.0,3932.27,2868.0,3278.0,120104.19,50.0,78.65,36.0,1.389),
  ('SC-Três Barras','Três Barras','SC',20977,'Operação Ongoing','Acelerada 2.0','C',6374.0,7105.0,6414.98,4757.0,2750.0,91095.37,117.0,54.83,92.0,1.272),
  ('RS-Veranópolis','Veranópolis','RS',24191,'Operação Ongoing','Acelerada 2.0','B',236415.0,257202.0,297905.02,249053.0,279193.0,2869202.84,3702.0,80.47,1495.0,2.476),
  ('RO-Vilhena','Vilhena','RO',109651,'Operação Ongoing','Acelerada 2.0','A',2478497.0,2730262.0,2780824.9,2550124.0,2772531.0,30267901.83,41969.0,66.26,14254.0,2.944),
  ('SC-Águas de Chapecó','Águas de Chapecó','SC',6227,'Operação Ongoing','Acelerada 2.0','C',33112.0,33449.0,35830.89,42889.0,47396.0,169084.37,755.0,47.46,349.0,2.163),
  ('RS-Alegrete','Alegrete','RS',74285,'Operação Ongoing','Acelerada 2.0','A',518809.0,551250.0,606215.67,508093.0,546644.0,7583044.67,7606.0,79.7,3175.0,2.396),
  ('MT-Cáceres','Cáceres','MT',91767,'Operação Ongoing','Acelerada 2.0','A',822179.0,925885.0,953684.57,829515.0,937301.0,8990533.83,17288.0,55.16,5614.0,3.079),
  ('RO-Cacoal','Cacoal','RO',98280,'Operação Ongoing','Acelerada 2.0','A',1438904.0,1554799.0,1612167.52,1421990.0,1572443.0,18126911.63,22654.0,71.16,7857.0,2.883),
  ('MA-Colinas','Colinas','MA',41612,'Operação Ongoing','Acelerada 2.0','C',8795.0,7719.0,6421.3,7056.0,8940.0,252774.56,174.0,36.9,101.0,1.723),
  ('RS-Dom Pedrito','Dom Pedrito','RS',60454,'Operação Ongoing','Acelerada 2.0','B',293458.0,329299.0,387743.57,315113.0,375877.0,2978648.33,6147.0,63.08,2314.0,2.656),
  ('RS-Frederico Westphalen','Frederico Westphalen','RS',32707,'Operação Ongoing','Acelerada 2.0','B',391205.0,426948.0,522803.39,506325.0,531653.0,5128664.77,7787.0,67.14,2885.0,2.699),
  ('SC-Itapiranga','Itapiranga','SC',17500,'Operação Ongoing','Acelerada 2.0','C',48463.0,53379.0,111870.68,117662.0,121478.0,426263.31,1536.0,72.83,671.0,2.289),
  ('RO-Ji-Paraná','Ji-Paraná','RO',148301,'Operação Ongoing','Acelerada 2.0','A',332646.0,356902.0,327408.74,294890.0,299634.0,5392218.1,5068.0,64.6,2352.0,2.155),
  ('SP-José Bonifácio','José Bonifácio','SP',36585,'Operação Ongoing','Acelerada 2.0','C',11895.0,11713.0,9949.18,9263.0,10998.0,250004.78,208.0,47.83,120.0,1.733),
  ('SC-Nova Itaberaba','Nova Itaberaba','SC',4700,'Operação Ongoing','Acelerada 2.0','C',1312.0,1072.0,306.0,146.0,294.0,35919.05,6.0,51.0,6.0,1.0),
  ('SC-Otacílio Costa','Otacílio Costa','SC',18406,'Operação Ongoing','Acelerada 2.0','C',57359.0,63156.0,76289.23,60314.0,57744.0,568176.31,1187.0,64.27,581.0,2.043),
  ('SC-Pinhalzinho','Pinhalzinho','SC',22794,'Operação Ongoing','Acelerada 2.0','C',29765.0,31232.0,32029.07,27990.0,27144.0,394681.92,462.0,69.33,257.0,1.798),
  ('RS-Rosário do Sul','Rosário do Sul','RS',36819,'Operação Ongoing','Acelerada 2.0','C',1594.0,1521.0,1041.99,693.0,807.0,40803.78,19.0,54.84,16.0,1.188),
  ('RS-Santa Rosa','Santa Rosa','RS',79488,'Operação Ongoing','Acelerada 2.0','C',65876.0,67746.0,76014.11,57618.0,51397.0,927902.73,982.0,77.41,651.0,1.508),
  ('RS-Sant''Ana do Livramento','Sant''Ana do Livramento','RS',87329,'Operação Ongoing','Acelerada 2.0','A',729274.0,765387.0,800887.87,687144.0,708707.0,8457689.73,11133.0,71.94,4348.0,2.56),
  ('SC-São Carlos','São Carlos','SC',10900,'Operação Ongoing','Acelerada 2.0','C',116961.0,120025.0,172199.76,157633.0,170228.0,633081.4,2637.0,65.3,1083.0,2.435),
  ('RS-São Gabriel','São Gabriel','RS',60090,'Operação Ongoing','Acelerada 2.0','A',470343.0,481583.0,584854.4,533559.0,571906.0,5646753.92,9489.0,61.63,3713.0,2.556),
  ('SC-São Joaquim','São Joaquim','SC',27599,'Operação Ongoing','Acelerada 2.0','C',39624.0,35105.0,44217.15,40376.0,38271.0,357635.67,611.0,72.37,321.0,1.903),
  ('RS-Uruguaiana','Uruguaiana','RS',120819,'Operação Ongoing','Acelerada','C',86033.0,90999.0,70367.92,55557.0,57365.0,1877570.51,780.0,90.22,417.0,1.871),
  ('SC-Barracão','Barracão','SC',10312,'Implementação','Acelerada 2.0','I',null,null,1251.44,178.0,411.0,null,15.0,83.43,15.0,1.0),
  ('SC-Caçador','Caçador','SC',76298,'Implementação','Acelerada 2.0','I',38346.0,42306.0,50410.45,40377.0,40310.0,662903.19,648.0,77.79,370.0,1.751),
  ('SC-Dionísio Cerqueira','Dionísio Cerqueira','SC',15895,'Implementação','Acelerada 2.0','I',null,null,2560.39,1001.0,541.0,null,37.0,69.2,23.0,1.609),
  ('RS-Giruá','Giruá','RS',16180,'Implementação','Acelerada 2.0','I',25850.0,29157.0,27956.94,28175.0,32354.0,291945.41,480.0,58.24,243.0,1.975),
  ('GO-Goianésia','Goianésia','GO',78009,'Implementação','Acelerada 2.0','I',9152.0,8913.0,197.96,42.0,36.0,62917.48,5.0,39.59,5.0,1.0),
  ('SP-Guapiaçu','Guapiaçu','SP',21713,'Implementação','Acelerada 2.0','I',19901.0,18595.0,27141.15,32668.0,38499.0,null,643.0,42.21,300.0,2.143),
  ('MS-Maracaju','Maracaju','MS',48073,'Operação Própria','Acelerada 2.0','OPP',19366.0,14888.0,8453.79,2991.0,2493.0,170368.1,174.0,48.59,89.0,1.955),
  ('RS-Palmeira das Missões','Palmeira das Missões','RS',33303,'Implementação','Acelerada 2.0','C',21161.0,22238.0,14032.71,5287.0,6381.0,215049.53,211.0,66.51,118.0,1.788),
  ('PA-Paragominas','Paragominas','PA',113498,'Implementação','Acelerada 2.0','I',10530.0,13121.0,14224.54,9483.0,16957.0,null,328.0,43.37,165.0,1.988),
  ('SP-Piedade','Piedade','SP',51659,'Implementação','Acelerada 2.0','I',17778.0,19786.0,18852.43,18889.0,16979.0,364803.48,320.0,58.91,173.0,1.85),
  ('SC-Seara','Seara','SC',19748,'Implementação','Acelerada 2.0','C',null,51448.0,81953.06,85674.0,82729.0,null,1193.0,68.69,608.0,1.962),
  ('MS-Sidrolândia','Sidrolândia','MS',52713,'Implementação','Acelerada 2.0','I',123339.0,131981.0,115077.21,96261.0,102943.0,1712177.58,1980.0,58.12,872.0,2.271),
  ('SC-Urubici','Urubici','SC',11830,'Implementação','Acelerada 2.0','I',2500.0,1641.0,560.33,211.0,278.0,121791.75,6.0,93.39,5.0,1.2),
  ('BA-Barreiras','Barreiras','BA',168315,'Operação Ongoing','Acelerada 2.0','A',1841337.0,1801706.0,1710274.18,1465263.0,1615570.0,23726380.5,23303.0,73.39,8362.0,2.787),
  ('RS-Cachoeira do Sul','Cachoeira do Sul','RS',82222,'Operação Ongoing','Acelerada 2.0','B',230001.0,234725.0,190330.76,173586.0,184112.0,3551438.95,2901.0,65.61,1634.0,1.775),
  ('MT-Campo Verde','Campo Verde','MT',49053,'Operação Ongoing','Acelerada 2.0','A',1103671.0,1184918.0,1211634.77,1070713.0,1195479.0,13821043.13,19695.0,61.52,6476.0,3.041),
  ('RS-Carlos Barbosa','Carlos Barbosa','RS',31585,'Operação Ongoing','Acelerada 2.0','A',785887.0,848115.0,943824.2,823785.0,918249.0,8693182.92,11999.0,78.66,4516.0,2.657),
  ('SP-Dracena','Dracena','SP',45351,'Operação Ongoing','Acelerada 2.0','A',455629.0,468701.0,478738.65,392315.0,413121.0,6026772.1,7192.0,66.57,2688.0,2.676),
  ('RS-Garibaldi','Garibaldi','RS',35563,'Operação Ongoing','Acelerada 2.0','A',456455.0,477546.0,543751.56,473053.0,485443.0,5574941.92,5966.0,91.14,2659.0,2.244),
  ('SP-Junqueirópolis','Junqueirópolis','SP',20441,'Operação Ongoing','Acelerada 2.0','C',100.0,null,null,null,null,1683.17,null,null,null,null),
  ('SC-Lages','Lages','SC',172458,'Operação Ongoing','Acelerada 2.0','B',292810.0,283705.0,283332.37,230602.0,249126.0,4691532.76,3717.0,76.23,2075.0,1.791),
  ('SC-Mafra','Mafra','SC',57262,'Operação Ongoing','Acelerada 2.0','A',468065.0,500789.0,544983.32,475043.0,499055.0,5543348.65,6590.0,82.7,2951.0,2.233),
  ('PR-Marialva','Marialva','PR',47247,'Operação Ongoing','Acelerada 2.0','B',337179.0,346392.0,374085.21,308605.0,338138.0,4390578.66,6305.0,59.33,2108.0,2.991),
  ('MT-Pontes e Lacerda','Pontes e Lacerda','MT',55762,'Operação Ongoing','Acelerada 2.0','A',1396939.0,1500300.0,1360750.43,1271758.0,1329302.0,16307949.34,21775.0,62.49,6378.0,3.414),
  ('MT-Primavera do Leste','Primavera do Leste','MT',96006,'Operação Ongoing','Acelerada 2.0','B',168399.0,157477.0,139705.1,108676.0,105786.0,3485803.17,1564.0,89.33,823.0,1.9),
  ('SC-Rio do Sul','Rio do Sul','SC',77451,'Operação Ongoing','Acelerada 2.0','A',626182.0,662643.0,671203.45,586481.0,605991.0,8679979.35,8669.0,77.43,3581.0,2.421),
  ('PR-Rio Negro','Rio Negro','PR',31552,'Operação Ongoing','Acelerada 2.0','C',197456.0,187900.0,223184.45,182924.0,202415.0,2063432.82,2450.0,91.1,1496.0,1.638),
  ('MT-Rondonópolis','Rondonópolis','MT',263708,'Operação Ongoing','Acelerada','A',299731.0,301623.0,261074.98,202958.0,176506.0,5554422.45,3212.0,81.28,1724.0,1.863),
  ('SP-Tupã','Tupã','SP',63695,'Operação Ongoing','Acelerada 2.0','A',557123.0,561278.0,534598.25,442134.0,457645.0,8170817.13,8063.0,66.3,2594.0,3.108),
  ('RS-Vacaria','Vacaria','RS',66146,'Operação Ongoing','Acelerada 2.0','A',1355225.0,1489205.0,1598363.36,1420414.0,1560093.0,14212367.99,19395.0,82.41,6478.0,2.994),
  ('MG-Andradas','Andradas','MG',41844,'Operação Ongoing','Acelerada 2.0','C',80787.0,82529.0,68810.83,64871.0,68736.0,1144329.17,1187.0,57.97,519.0,2.287),
  ('SC-Capinzal','Capinzal','SC',24585,'Operação Ongoing','Acelerada 2.0','C',128543.0,152439.0,179801.02,177923.0,204117.0,1225964.38,2892.0,62.17,1303.0,2.219),
  ('PR-Castro','Castro','PR',76310,'Operação Ongoing','Acelerada 2.0','B',132227.0,121715.0,107637.26,85192.0,89716.0,2181366.66,1670.0,64.45,923.0,1.809),
  ('RO-Cerejeiras','Cerejeiras','RO',16515,'Operação Ongoing','Acelerada 2.0','C',2487.0,3606.0,3759.49,3118.0,1671.0,37424.59,71.0,52.95,49.0,1.449),
  ('MT-Guarantã do Norte','Guarantã do Norte','MT',31209,'Operação Própria','Acelerada 2.0','C',18719.0,18912.0,17469.11,14042.0,12616.0,330628.62,258.0,67.71,140.0,1.843),
  ('SP-Ibiúna','Ibiúna','SP',85013,'Operação Ongoing','Acelerada 2.0','B',161168.0,171141.0,166077.99,153694.0,176630.0,2325435.69,2798.0,59.36,1157.0,2.418),
  ('PR-Jacarezinho','Jacarezinho','PR',41493,'Operação Ongoing','Acelerada 2.0','C',71407.0,80582.0,77994.48,74841.0,72853.0,1043351.98,1640.0,47.56,773.0,2.122),
  ('MT-Jaciara','Jaciara','MT',27485,'Operação Ongoing','Acelerada 2.0','B',186799.0,187708.0,190381.87,170344.0,188042.0,2204519.8,3771.0,50.49,1405.0,2.684),
  ('SP-Jales','Jales','SP',48877,'Operação Ongoing','Acelerada 2.0','C',77469.0,76553.0,63989.33,50054.0,55715.0,1135273.27,941.0,68.0,482.0,1.952),
  ('RS-Lagoa Vermelha','Lagoa Vermelha','RS',27959,'Operação Ongoing','Acelerada 2.0','C',165746.0,177267.0,174248.99,146337.0,177593.0,1864657.97,2599.0,67.04,1105.0,2.352),
  ('SP-Mairinque','Mairinque','SP',48206,'Operação Ongoing','Acelerada 2.0','C',1318.0,1097.0,1639.41,1417.0,1177.0,37205.33,26.0,63.05,24.0,1.083),
  ('SC-Ouro','Ouro','SC',7450,'Operação Ongoing','Acelerada 2.0','C',37624.0,50830.0,54337.98,49392.0,53555.0,445164.81,818.0,66.43,511.0,1.601),
  ('SP-Presidente Venceslau','Presidente Venceslau','SP',35119,'Operação Ongoing','Acelerada 2.0','B',282495.0,291337.0,367377.36,317953.0,350506.0,3394109.21,6373.0,57.65,2165.0,2.944),
  ('SP-São Roque','São Roque','SP',81366,'Operação Ongoing','Acelerada 2.0','B',198785.0,190025.0,186123.78,158725.0,169278.0,2941956.76,2823.0,65.93,1200.0,2.353),
  ('RS-Tenente Portela','Tenente Portela','RS',14684,'Operação Ongoing','Acelerada 2.0','B',199344.0,199764.0,237512.03,197020.0,202116.0,2279391.06,2849.0,83.37,1132.0,2.517),
  ('SP-Birigui','Birigui','SP',123340,'Operação Própria','Operação Própria','C',21603.0,22015.0,16216.52,null,8176.0,709555.37,293.0,55.35,169.0,1.734),
  ('SC-Caibi','Caibi','SC',6574,'Operação Própria','Acelerada 2.0','C',3776.0,1736.0,1432.0,287.0,940.0,97978.15,19.0,75.37,15.0,1.267),
  ('MT-Campo Novo do Parecis','Campo Novo do Parecis','MT',51722,'Operação Própria','Operação Própria','C',30154.0,26647.0,24560.87,null,14411.0,476866.91,421.0,58.34,293.0,1.437),
  ('MG-Diamantina','Diamantina','MG',49357,'Operação Própria','Operação Própria','C',6343.0,6098.0,2233.83,null,1854.0,210985.24,49.0,45.59,31.0,1.581),
  ('RS-Espumoso','Espumoso','RS',15316,'Operação Própria','Operação Própria','C',2301.0,1060.0,69.8,null,null,131233.36,1.0,69.8,1.0,1.0),
  ('SP-Itapeva','Itapeva','SP',92393,'Operação Própria','Operação Própria','C',18809.0,14636.0,9276.1,null,3129.0,584535.47,115.0,80.66,68.0,1.691),
  ('GO-Jataí','Jataí','GO',111634,'Operação Própria','Operação Própria','C',239.0,25.0,190.0,null,120.0,8937.59,5.0,38.0,3.0,1.667),
  ('MT-Lucas do Rio Verde','Lucas do Rio Verde','MT',95792,'Operação Própria','Operação Própria','C',6666.0,6394.0,4245.26,null,1676.0,160149.85,38.0,111.72,26.0,1.462),
  ('SC-Palmitos','Palmitos','SC',16571,'Operação Própria','Acelerada 2.0','C',4159.0,1943.0,266.79,331.0,479.0,75672.74,5.0,53.36,3.0,1.667),
  ('SP-Penápolis','Penápolis','SP',63426,'Operação Própria','Operação Própria','C',33846.0,26153.0,14269.48,null,7777.0,739625.41,295.0,48.37,158.0,1.867),
  ('GO-Rio Verde','Rio Verde','GO',241494,'Operação Própria','Operação Própria','C',3091.0,2400.0,1931.49,null,1453.0,61621.13,32.0,60.36,16.0,2.0),
  ('RS-Santo Ângelo','Santo Ângelo','RS',79146,'Operação Própria','Operação Própria','C',73864.0,76365.0,51337.37,null,34117.0,1663138.11,573.0,89.59,356.0,1.61),
  ('SC-São Miguel do Oeste','São Miguel do Oeste','SC',46602,'Operação Própria','Operação Própria','C',1857.0,962.0,1192.19,null,null,205050.39,11.0,108.38,11.0,1.0),
  ('RS-Soledade','Soledade','RS',30454,'Operação Própria','Operação Própria','C',23680.0,23099.0,19265.68,null,19556.0,623838.28,263.0,73.25,166.0,1.584),
  ('SC-Videira','Videira','SC',59074,'Operação Própria','Operação Própria','C',2181.0,2491.0,2721.13,null,2014.0,74038.45,33.0,82.46,26.0,1.269)
on conflict (chave) do update set
  nome=excluded.nome, uf=excluded.uf, populacao=excluded.populacao, fase=excluded.fase, modelo=excluded.modelo, curva=excluded.curva,
  gmv_fev=excluded.gmv_fev, gmv_mar=excluded.gmv_mar, gmv_jun=excluded.gmv_jun, gmv_ago=excluded.gmv_ago, gmv_set=excluded.gmv_set, gmv_2025=excluded.gmv_2025,
  pedidos_jun=excluded.pedidos_jun, ticket_jun=excluded.ticket_jun, clientes_jun=excluded.clientes_jun, frequencia_jun=excluded.frequencia_jun,
  atualizado_em=now();
