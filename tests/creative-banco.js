/* BANCO DE CASOS do Luma Creative — pedidos reais do dia a dia do franqueado (sem IA).
   É a régua do motor local: a nota de design, a busca e as composições são medidas aqui.
   Cada pedido tem o objetivo, o grupo de uso (A–G, docs/PROMPT-MOTOR-DESIGN-LOCAL.md), os formatos em
   que o franqueado usa aquela peça e o texto em 4 tamanhos: t = título [curto, médio, longo, extremo]
   e a = apoio (idem; um só vale para os 4). Nada aqui é dado inventado pela máquina: preço, código e
   data são os que o pedido diz — campo vazio é campo que o pedido não deu.
   Quem usa: tests/svg-import-cases.js (portão), tests/_galeria-composicoes.html (ferramenta) e a
   curadoria da gestão (carregada sob demanda). crBancoCasos() expande pedido × formato × texto × foto
   × much+ em casos prontos para crCandidatos. */
const CR_BANCO = [
  // A — prato e oferta do dia
  { id: 'a01', grupo: 'A', objetivo: 'oferta', formatos: ['feed', 'story'], much: false, pedido: 'Prato do dia: feijoada completa por R$ 24,90',
    t: ['FEIJOADA', 'FEIJOADA COMPLETA', 'FEIJOADA COMPLETA DA CASA', 'FEIJOADA COMPLETA COM TORRESMO'], a: ['Só hoje', 'Arroz, couve e laranja', 'Arroz, couve, farofa e laranja', 'Arroz, couve, farofa, laranja e torresmo'], precoPor: '24,90', topo: 'PRATO DO DIA' },
  { id: 'a02', grupo: 'A', objetivo: 'oferta', formatos: ['feed', 'story'], pedido: 'Almoço executivo de R$ 32 por R$ 26,90 com sobremesa',
    t: ['EXECUTIVO', 'ALMOÇO EXECUTIVO', 'ALMOÇO EXECUTIVO COMPLETO', 'ALMOÇO EXECUTIVO COM SOBREMESA'], a: ['Com sobremesa', 'Prato + bebida, pelo app', 'Prato do dia + bebida, pelo app', 'Prato do dia, bebida e sobremesa pelo app'], precoDe: '32,00', precoPor: '26,90', selo: ['COM', 'DOCE'] },
  { id: 'a03', grupo: 'A', objetivo: 'oferta', formatos: ['feed', 'story', 'inapp'], pedido: 'Combo família: 2 pizzas grandes + refri 2L por R$ 89,90',
    t: ['COMBO', 'COMBO FAMÍLIA', 'COMBO FAMÍLIA DE SÁBADO', 'COMBO FAMÍLIA COM DUAS PIZZAS'], a: ['2 pizzas + refri', '2 pizzas grandes + refri 2L', '2 pizzas grandes, borda e refri 2L', '2 pizzas grandes com borda recheada e refri 2L'], precoDe: '109,90', precoPor: '89,90', selo: ['18%', 'OFF'] },
  { id: 'a04', grupo: 'A', objetivo: 'oferta', formatos: ['feed', 'story'], pedido: '2 por 1 no açaí de 500ml, R$ 19,90',
    t: ['2 POR 1', 'AÇAÍ 2 POR 1', 'AÇAÍ 500ML 2 POR 1', 'AÇAÍ DE 500ML EM DOBRO HOJE'], a: ['Leve dois', 'Leve dois, pague um', 'Leve dois e pague um, só pelo app', 'Leve dois açaís e pague só um, só pelo app'], precoPor: '19,90' },
  { id: 'a05', grupo: 'A', objetivo: 'oferta', formatos: ['feed', 'story', 'banner'], pedido: 'Preço em destaque: X-bacon por R$ 18,90',
    t: ['X-BACON', 'X-BACON DUPLO', 'X-BACON DUPLO COM FRITAS', 'X-BACON DUPLO COM FRITAS E REFRI'], a: ['Pão brioche', 'Pão brioche e cheddar', 'Pão brioche, cheddar e bacon crocante', 'Pão brioche, cheddar duplo e bacon crocante'], precoPor: '18,90' },
  { id: 'a06', grupo: 'A', objetivo: 'oferta', formatos: ['feed', 'story', 'emailTopo'], pedido: 'Marmita a partir de R$ 15,90',
    t: ['MARMITA', 'MARMITA CASEIRA', 'MARMITA CASEIRA DA SEMANA', 'MARMITA CASEIRA DE SEGUNDA'], a: ['A partir de', 'Todo dia um cardápio', 'Todo dia um cardápio diferente', 'Todo dia um cardápio diferente, feito na hora'], precoPor: '15,90', topo: 'A PARTIR DE' },
  { id: 'a07', grupo: 'A', objetivo: 'oferta', formatos: ['story', 'carrossel'], pedido: 'Ofertas do dia: burger 24,90; pizza 39,90; açaí 19,90',
    t: ['OFERTAS', 'OFERTAS DO DIA', 'OFERTAS DO DIA NO APP', 'AS OFERTAS DO DIA NA SUA CIDADE'], a: ['Só hoje', 'Só hoje, pelo app', 'Só hoje, direto pelo app', 'Só hoje, nos parceiros participantes'], itens: ['Burger clássico R$ 24,90', 'Pizza calabresa R$ 39,90', 'Açaí 500ml R$ 19,90'] },
  // B — horário e ocasião
  { id: 'b01', grupo: 'B', objetivo: 'oferta', formatos: ['feed', 'story'], pedido: 'Happy hour: chopp 2x1 das 17h às 20h',
    t: ['HAPPY HOUR', 'HAPPY HOUR 2X1', 'HAPPY HOUR COM CHOPP 2X1', 'HAPPY HOUR COM CHOPP EM DOBRO'], a: ['Das 17h às 20h', 'Das 17h às 20h, só no app', 'Das 17h às 20h nos bares do app', 'Das 17h às 20h, nos bares participantes do app'], selo: ['2X1'] },
  { id: 'b02', grupo: 'B', objetivo: 'oferta', formatos: ['feed', 'story', 'inapp'], pedido: 'Sextou com burger: combo da sexta por R$ 29,90',
    t: ['SEXTOU', 'SEXTOU COM BURGER', 'SEXTOU COM BURGER E FRITAS', 'SEXTOU COM BURGER E BATATA'], a: ['Combo da sexta', 'O combo da sexta chegou', 'O combo da sexta chegou no app', 'O combo da sexta chegou, peça no app'], precoPor: '29,90', selo: ['SÓ', 'HOJE'] },
  { id: 'b03', grupo: 'B', objetivo: 'evento', formatos: ['feed', 'story'], pedido: 'Domingo doce: sobremesas com entrega',
    t: ['DOMINGO DOCE', 'DOMINGO DOCE', 'DOMINGO DOCE NO APP', 'DOMINGO DOCE COM SOBREMESA'], a: ['Pede um doce', 'As sobremesas da cidade', 'As sobremesas da cidade no app', 'As melhores sobremesas da cidade no app'] },
  { id: 'b04', grupo: 'B', objetivo: 'oferta', formatos: ['story', 'feed'], pedido: 'Janta: pizza grande por R$ 44,90 depois das 19h',
    t: ['JANTA', 'BORA JANTAR', 'A JANTA TÁ GARANTIDA', 'A JANTA DE HOJE JÁ TÁ RESOLVIDA'], a: ['Depois das 19h', 'Pizza grande depois das 19h', 'Pizza grande, depois das 19h no app', 'Pizza grande com borda, depois das 19h no app'], precoPor: '44,90' },
  { id: 'b05', grupo: 'B', objetivo: 'evento', formatos: ['story', 'feed'], pedido: 'Madrugada: lanches até as 3h',
    t: ['MADRUGADA', 'FOME DE MADRUGADA', 'BATEU A FOME DE MADRUGADA', 'A FOME BATEU NA MADRUGADA, PEDE'], a: ['Até as 3h', 'Lanches até as 3h', 'Lanches e porções até as 3h', 'Lanches, porções e bebidas até as 3h da manhã'] },
  { id: 'b06', grupo: 'B', objetivo: 'evento', formatos: ['feed', 'story', 'banner'], pedido: 'Chove, a gente leva — pede sem sair de casa',
    t: ['CHOVEU', 'CHOVE, A GENTE LEVA', 'CHOVE LÁ FORA, A GENTE LEVA', 'TÁ CHOVENDO? A GENTE LEVA'], a: ['Fica em casa', 'Pede sem sair de casa', 'Fica quentinho e pede pelo app', 'Fica quentinho em casa e pede pelo app'] },
  { id: 'b07', grupo: 'B', objetivo: 'evento', formatos: ['feed', 'story'], pedido: 'Fim de semana: rodízio de pizza no app',
    t: ['FIM DE SEMANA', 'FIM DE SEMANA', 'FIM DE SEMANA DE PIZZA', 'FIM DE SEMANA COM RODÍZIO'], a: ['Sábado e domingo', 'Sábado e domingo no app', 'Sábado e domingo, nos parceiros', 'Sábado e domingo nos parceiros do app'] },
  // C — cupom e entrada
  { id: 'c01', grupo: 'C', objetivo: 'cupom', formatos: ['feed', 'story'], much: true, pedido: 'Cupom da semana QUEROPIZZA de R$ 15 acima de R$ 40',
    t: ['', '', '', ''], cupomValor: '15', cupomCodigo: 'QUEROPIZZA', legal: 'Válido para pedidos acima de R$ 40. Consulte as regras no app.' },
  { id: 'c02', grupo: 'C', objetivo: 'cupom', formatos: ['feed', 'story', 'inapp'], much: true, pedido: 'Primeira compra: cupom BEMVINDO 20% off',
    t: ['', '', '', ''], cupomValor: '20%', cupomCodigo: 'BEMVINDO', cupomRotulo: 'PRIMEIRA COMPRA', chamada: ['sua *primeira*', 'compra com *desconto!*'] },
  { id: 'c03', grupo: 'C', objetivo: 'beneficio', formatos: ['feed', 'story', 'banner'], much: true, pedido: 'Frete grátis acima de R$ 30 hoje',
    t: ['GRÁTIS', 'GRÁTIS', 'GRÁTIS HOJE', 'GRÁTIS O DIA INTEIRO'], palavra: 'frete', a: ['Acima de R$ 30', 'Em pedidos acima de R$ 30', 'Em pedidos acima de R$ 30, só hoje', 'Em pedidos acima de R$ 30, só hoje pelo app'], selo: ['SÓ', 'HOJE'] },
  { id: 'c04', grupo: 'C', objetivo: 'beneficio', formatos: ['feed', 'story'], much: true, pedido: 'Entrega grátis com pedido mínimo de R$ 25',
    t: ['GRÁTIS', 'GRÁTIS', 'GRÁTIS NO APP', 'GRÁTIS NA SUA CIDADE'], palavra: 'entrega', a: ['Mínimo R$ 25', 'Pedido mínimo de R$ 25', 'Com pedido mínimo de R$ 25', 'Com pedido mínimo de R$ 25 nos parceiros'], legal: 'Pedido mínimo de R$ 25. Consulte as regras no app.' },
  { id: 'c05', grupo: 'C', objetivo: 'beneficio', formatos: ['feed', 'story', 'inapp'], much: true, pedido: 'Clube much+: cashback em todo pedido',
    t: ['CASHBACK', 'CASHBACK MUCH+', 'CASHBACK EM TODO PEDIDO', 'CASHBACK EM TODO PEDIDO MUCH+'], palavra: 'seu', a: ['Volta pra você', 'Parte do pedido volta pra você', 'Parte de cada pedido volta pra você', 'Parte de cada pedido volta pra você no clube'] },
  { id: 'c06', grupo: 'C', objetivo: 'cupom', formatos: ['story', 'capa'], much: true, pedido: 'Cupom much+ de R$ 10, código MUCH10',
    t: ['', '', '', ''], cupomValor: '10', cupomCodigo: 'MUCH10', legal: 'Exclusivo para assinantes much+. Consulte as regras no app.' },
  // D — parceiros
  { id: 'd01', grupo: 'D', objetivo: 'parceiro', formatos: ['feed', 'story'], pedido: 'Novo parceiro: Pizzaria Nonna chegou no app',
    t: ['NONNA', 'PIZZARIA NONNA', 'PIZZARIA DA NONNA', 'PIZZARIA DA NONNA CHEGOU NO APP'], a: ['Já no app', 'Conheça o cardápio no app', 'Conheça o cardápio completo no app', 'Conheça o cardápio completo da casa no app'], topo: 'NOVO PARCEIRO', loja: 'Pizzaria Nonna' },
  { id: 'd02', grupo: 'D', objetivo: 'parceiro', formatos: ['feed', 'story'], pedido: 'Lojista da semana: Burger Club',
    t: ['BURGER CLUB', 'BURGER CLUB', 'O BURGER CLUB DA CIDADE', 'BURGER CLUB, O LOJISTA DA SEMANA'], a: ['Destaque da semana', 'O destaque da semana no app', 'O destaque da semana, peça no app', 'O destaque da semana na cidade, peça no app'], topo: 'LOJISTA DA SEMANA', loja: 'Burger Club' },
  { id: 'd03', grupo: 'D', objetivo: 'parceiro', formatos: ['feed', 'story', 'banner'], pedido: 'Mais vendidos do app na cidade',
    t: ['TOP 3', 'MAIS VENDIDOS', 'OS MAIS VENDIDOS DO APP', 'OS MAIS PEDIDOS DA CIDADE NO APP'], a: ['Da semana', 'Os campeões da semana', 'Os campeões da semana na cidade', 'Os campeões de pedido da semana na cidade'], itens: ['Burger clássico', 'Pizza calabresa', 'Açaí 500ml'] },
  { id: 'd04', grupo: 'D', objetivo: 'parceiro', formatos: ['feed', 'story'], pedido: 'Inauguração da Doce Vida, dia 20 de outubro',
    t: ['INAUGUROU', 'INAUGURAÇÃO', 'INAUGURAÇÃO DA DOCE VIDA', 'INAUGURAÇÃO DA DOCE VIDA HOJE'], a: ['Dia 20', 'Agora também no app', 'A confeitaria agora também no app', 'A confeitaria do bairro agora também no app'], selo: ['20', 'OUTUBRO'], loja: 'Doce Vida' },
  { id: 'd05', grupo: 'D', objetivo: 'parceiro', formatos: ['story', 'carrossel'], pedido: 'Ofertas do dia de várias lojas: Sushi Kai, Burger Club, Açaí Tropical',
    t: ['OFERTAS', 'OFERTAS DO DIA', 'AS OFERTAS DAS LOJAS', 'AS OFERTAS DO DIA DAS LOJAS'], a: ['Só hoje', 'Só hoje nas lojas', 'Só hoje nas lojas do app', 'Só hoje nas lojas parceiras do app'], itens: ['Sushi Kai', 'Burger Club', 'Açaí Tropical'] },
  // E — datas e cidade
  { id: 'e01', grupo: 'E', objetivo: 'evento', formatos: ['feed', 'story'], pedido: 'Dia das Mães: presente com entrega',
    t: ['MÃES', 'DIA DAS MÃES', 'FELIZ DIA DAS MÃES', 'PRA MÃE, O QUE ELA MAIS GOSTA'], a: ['Com carinho', 'Mime ela pelo app', 'Mime ela com o que ela mais gosta', 'Mime ela com o que ela mais gosta, pelo app'], selo: ['10', 'MAIO'] },
  { id: 'e02', grupo: 'E', objetivo: 'evento', formatos: ['feed', 'story'], pedido: 'Dia dos Namorados: jantar a dois',
    t: ['A DOIS', 'JANTAR A DOIS', 'DIA DOS NAMORADOS', 'O JANTAR A DOIS DOS NAMORADOS'], a: ['12 de junho', 'O jantar chega até vocês', 'O jantar especial chega até vocês', 'O jantar especial chega até vocês pelo app'], selo: ['12', 'JUNHO'] },
  { id: 'e03', grupo: 'E', objetivo: 'evento', formatos: ['feed', 'story', 'carrossel'], pedido: 'Festa junina: comidas típicas no app',
    t: ['ARRAIÁ', 'ARRAIÁ NO APP', 'FESTA JUNINA NO APP', 'O ARRAIÁ CHEGOU COM TUDO'], a: ['Comida típica', 'Pamonha, quentão e pinhão', 'Pamonha, quentão, pinhão e canjica', 'Pamonha, quentão, pinhão e canjica pelo app'], itens: ['Pamonha', 'Quentão', 'Pinhão', 'Canjica'] },
  { id: 'e04', grupo: 'E', objetivo: 'evento', formatos: ['feed', 'story'], pedido: 'Jogo do Brasil: peça antes do apito',
    t: ['É JOGO', 'DIA DE JOGO', 'BORA TORCER EM CASA', 'PEÇA ANTES DO APITO INICIAL'], a: ['Antes do apito', 'Peça antes do apito', 'Peça antes do apito e não perca nada', 'Peça antes do apito e não perca nenhum lance'] },
  { id: 'e05', grupo: 'E', objetivo: 'evento', formatos: ['feed', 'story', 'capa'], pedido: 'Aniversário da cidade: 70 anos de Chapecó',
    t: ['PARABÉNS', 'PARABÉNS, CHAPECÓ', 'CHAPECÓ FAZ 70 ANOS', 'PARABÉNS, CHAPECÓ, PELOS 70 ANOS'], a: ['70 anos', 'Orgulho de entregar aqui', 'Orgulho de entregar na nossa cidade', 'Orgulho de fazer parte da nossa cidade'], selo: ['70', 'ANOS'] },
  { id: 'e06', grupo: 'E', objetivo: 'cupom', formatos: ['feed', 'story', 'banner'], much: true, pedido: 'Black Friday: cupom BLACK30 de 30% off',
    t: ['', '', '', ''], cupomValor: '30%', cupomCodigo: 'BLACK30', chamada: ['é *black*', '*friday!*'], legal: 'Válido de 24 a 30/11. Consulte as regras no app.' },
  { id: 'e07', grupo: 'E', objetivo: 'evento', formatos: ['feed', 'story'], pedido: 'Natal: ceia com entrega no dia 24',
    t: ['NATAL', 'CEIA DE NATAL', 'A CEIA DE NATAL CHEGA', 'A CEIA DE NATAL CHEGA ATÉ VOCÊ'], a: ['Dia 24', 'Encomende a sua ceia', 'Encomende a ceia até o dia 22', 'Encomende a ceia completa até o dia 22'], selo: ['24', 'DEZ'] },
  { id: 'e08', grupo: 'E', objetivo: 'aniversario', formatos: ['feed', 'story'], pedido: 'Aniversário da franquia: 5 anos, cupom NIVER5 de R$ 15',
    t: ['', '', '', ''], anos: '5', cupomValor: '15', cupomCodigo: 'NIVER5' },
  // F — operação e aviso
  { id: 'f01', grupo: 'F', objetivo: 'aviso', formatos: ['feed', 'story'], pedido: 'Horário especial no feriado: das 11h às 22h',
    t: ['FERIADO', 'HORÁRIO ESPECIAL', 'HORÁRIO DE FERIADO', 'HORÁRIO ESPECIAL NO FERIADO'], a: ['Das 11h às 22h', 'Abertos das 11h às 22h', 'Os parceiros abrem das 11h às 22h', 'Os parceiros participantes abrem das 11h às 22h'], selo: ['15', 'NOV'] },
  { id: 'f02', grupo: 'F', objetivo: 'aviso', formatos: ['feed', 'story', 'inapp'], pedido: 'Estamos entregando normalmente',
    t: ['ABERTOS', 'ESTAMOS ENTREGANDO', 'ESTAMOS ENTREGANDO HOJE', 'SIM, ESTAMOS ENTREGANDO HOJE'], a: ['Pode pedir', 'Pode pedir pelo app', 'Pode pedir que a gente leva', 'Pode pedir pelo app que a gente leva até você'] },
  { id: 'f03', grupo: 'F', objetivo: 'aviso', formatos: ['feed', 'story', 'banner'], pedido: 'Pausa temporária nas entregas por causa da chuva',
    t: ['PAUSA', 'PAUSA RÁPIDA', 'PAUSA NAS ENTREGAS', 'PAUSA TEMPORÁRIA NAS ENTREGAS'], a: ['Voltamos já', 'Voltamos assim que a chuva passar', 'Voltamos assim que a chuva der trégua', 'Por segurança, voltamos assim que a chuva passar'] },
  { id: 'f04', grupo: 'F', objetivo: 'aviso', formatos: ['feed', 'story', 'emailTopo'], pedido: 'Aviso importante: mudança no horário de atendimento',
    t: ['AVISO', 'AVISO IMPORTANTE', 'NOVO HORÁRIO DE ATENDIMENTO', 'MUDOU O HORÁRIO DO ATENDIMENTO'], a: ['Fique de olho', 'O atendimento muda a partir de segunda', 'O atendimento muda a partir de segunda-feira', 'O atendimento pelo app muda na segunda-feira'] },
  // G — prospecção e comunidade
  { id: 'g01', grupo: 'G', objetivo: 'prospeccao', formatos: ['feed', 'story', 'carrossel'], pedido: 'Seja parceiro: venda pelo app da Delivery Much',
    t: ['SEJA PARCEIRO', 'SEJA PARCEIRO', 'VENDA MAIS PELO APP', 'SUA LOJA VENDENDO MAIS PELO APP'], a: ['Cadastre sua loja', 'Cadastre sua loja no app', 'Cadastre sua loja e venda mais', 'Cadastre sua loja e venda mais na cidade'], itens: ['Mais pedidos', 'Entrega com a gente', 'Suporte local'], cta: 'QUERO VENDER' },
  { id: 'g02', grupo: 'G', objetivo: 'prospeccao', formatos: ['feed', 'story', 'carrossel'], pedido: 'Seja entregador: renda extra no seu horário',
    t: ['ENTREGADOR', 'SEJA ENTREGADOR', 'SEJA ENTREGADOR PARCEIRO', 'SEJA ENTREGADOR NO SEU HORÁRIO'], a: ['Renda extra', 'Renda extra no seu horário', 'Renda extra no horário que você quiser', 'Renda extra no horário que você quiser fazer'], itens: ['Seu horário', 'Renda semanal', 'Rotas na sua cidade'], cta: 'CADASTRAR' },
  { id: 'g03', grupo: 'G', objetivo: 'prospeccao', formatos: ['feed', 'story', 'inapp', 'banner'], pedido: 'Baixe o app da Delivery Much',
    t: ['BAIXE O APP', 'BAIXE O APP', 'BAIXE O APP AGORA', 'BAIXE O APP E PEÇA SEM SAIR'], a: ['É grátis', 'Tudo da cidade num só app', 'Os restaurantes da cidade num só app', 'Os restaurantes da cidade inteira num só app'], cta: 'BAIXAR' },
  { id: 'g04', grupo: 'G', objetivo: 'prospeccao', formatos: ['feed', 'story'], pedido: 'Peça no app: tudo que a cidade tem',
    t: ['PEÇA NO APP', 'PEÇA NO APP', 'TUDO NUM APP SÓ', 'TUDO QUE A CIDADE TEM NUM APP'], a: ['Rápido e fácil', 'Rápido, fácil e perto de você', 'Os parceiros da cidade, rápido e fácil', 'Os parceiros da cidade inteira, rápido e fácil'], cta: 'PEDIR AGORA' },
  { id: 'g05', grupo: 'G', objetivo: 'prospeccao', formatos: ['feed', 'story', 'emailTopo'], pedido: 'Agradecimento: obrigado, cidade, pelo carinho',
    t: ['OBRIGADO', 'OBRIGADO, CIDADE', 'OBRIGADO PELO CARINHO', 'OBRIGADO PELO CARINHO DE SEMPRE'], a: ['De coração', 'Vocês fazem a gente crescer', 'Cada pedido faz a gente crescer', 'Cada pedido de vocês faz a gente crescer'] },
  // Os objetivos de antes, com o texto de sempre (régua de não-regressão)
  { id: 'x01', grupo: 'A', objetivo: 'oferta', formatos: ['feed', 'story', 'inapp', 'banner', 'emailTopo', 'capa'], pedido: 'Oferta de pizza calabresa: de R$ 28 por R$ 22,90, 18% off',
    t: ['PIZZA', 'PIZZA CALABRESA', 'PIZZA CALABRESA GRANDE', 'PIZZA CALABRESA COM BORDA'], a: ['Tradicional', 'Tradicional, direto pelo app', 'Tradicional, com borda, direto pelo app', 'Tradicional, com borda recheada, direto pelo app'], precoDe: '28,00', precoPor: '22,90', selo: ['18%', 'OFF'] },
  { id: 'x02', grupo: 'E', objetivo: 'evento', formatos: ['feed', 'story', 'inapp', 'capa'], pedido: 'Festival gastronômico de 10 a 20 de outubro',
    t: ['FESTIVAL', 'FESTIVAL GASTRONÔMICO', 'FESTIVAL GASTRONÔMICO 2026', 'FESTIVAL GASTRONÔMICO DA CIDADE'], a: ['No app', 'Os pratos do festival no app', 'Os pratos do festival, direto no app', 'Os pratos do festival da cidade, direto no app'], selo: ['10 A 20', 'OUTUBRO'] },
  { id: 'x03', grupo: 'C', objetivo: 'cupom', formatos: ['feed', 'story', 'inapp', 'banner', 'capa', 'emailTopo'], much: true, pedido: 'Cupom NIVERDM15 de R$ 15',
    t: ['', '', '', ''], cupomValor: '15', cupomCodigo: 'NIVERDM15', legal: 'Válido para pedidos acima de R$ 40.' }
];
// Expande o banco: pedido × formato × tamanho do texto × foto × much+ → [{id, sp}] (sp = conteúdo bruto
// de crCandidatos). `filtro` = { formatos, textos: [0..3], fotos: [false, true], much: [false, true] }.
// A foto é o slot (placeholder) ou a imagem passada em `foto`: a geometria é a mesma.
function crBancoCasos(filtro, foto){
  const f = filtro || {}, out = [], TX = ['curto', 'medio', 'longo', 'extremo'];
  CR_BANCO.forEach(p => p.formatos.forEach(formato => {
    if(f.formatos && f.formatos.indexOf(formato) < 0) return;
    (f.textos || [0, 1, 2, 3]).forEach(k => (f.fotos || [false, true]).forEach(comFoto => (f.much || [false, true]).forEach(much => {
      if(much && !p.much) return;
      const sp = Object.assign({}, p, { formato, foto: comFoto ? (foto || 'slot') : '', marca: much ? 'much' : 'dm' });
      sp.titulo = p.t[k] || ''; sp.apoio = Array.isArray(p.a) ? (p.a[k] || p.a[p.a.length - 1]) : (p.a || '');
      delete sp.t; delete sp.a; delete sp.formatos; delete sp.much;
      out.push({ id: p.id + '/' + formato + '/' + TX[k] + (comFoto ? '/foto' : '') + (much ? '/much' : ''), pedido: p, sp });
    })));
  }));
  return out;
}
