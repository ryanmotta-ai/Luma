/* GOLDEN DA REGRESSÃO do Luma Creative — as artes aprovadas que não podem piorar.
   Cada linha é uma arte: a composição/receita, o formato, o pedido do banco (tests/creative-banco.js:
   caso e texto 0–3), com ou sem foto, a marca e a nota de design no dia da aprovação. A suíte
   svg-import refaz cada uma pela busca daquela receita e falha se surgir erro da marca, se a nota cair
   mais que CR_GOLDEN_TOL ou se a arte deixar de entrar no importador.
   Quem escreve: scripts/catalogo-composicoes.js põe as linhas de cada composição NOVA (frente 4) e só
   regrava as de uma composição quando chamado com --golden=<id> — mudança consciente, com o motivo no
   commit. As artes aprovadas na curadoria do gestor (frente 5) entram aqui pelo mesmo formato. */
const CR_GOLDEN_TOL = 3;
const CR_GOLDEN = [
// <golden>
  {"receita":"pratoDoDiaLado","formato":"feed","caso":"a01","texto":0,"foto":true,"marca":"dm","nota":77},
  {"receita":"pratoDoDiaLado","formato":"feed","caso":"a01","texto":2,"foto":true,"marca":"dm","nota":86},
  {"receita":"pratoDoDiaLado","formato":"feed","caso":"a02","texto":1,"foto":true,"marca":"much","nota":90},
  {"receita":"faixaPreco","formato":"feed","caso":"a02","texto":0,"foto":false,"marca":"dm","nota":81},
  {"receita":"faixaPreco","formato":"feed","caso":"a02","texto":2,"foto":false,"marca":"dm","nota":89},
  {"receita":"faixaPreco","formato":"feed","caso":"a06","texto":1,"foto":false,"marca":"much","nota":86},
  {"receita":"fotoQuadradaPreco","formato":"feed","caso":"a03","texto":0,"foto":true,"marca":"dm","nota":85},
  {"receita":"fotoQuadradaPreco","formato":"feed","caso":"a03","texto":2,"foto":true,"marca":"dm","nota":88},
  {"receita":"fotoQuadradaPreco","formato":"feed","caso":"a05","texto":1,"foto":true,"marca":"much","nota":88},
  {"receita":"precoGigante","formato":"feed","caso":"a06","texto":0,"foto":false,"marca":"dm","nota":85},
  {"receita":"precoGigante","formato":"feed","caso":"a06","texto":2,"foto":false,"marca":"dm","nota":86},
  {"receita":"precoGigante","formato":"feed","caso":"a05","texto":1,"foto":false,"marca":"much","nota":86},
  {"receita":"listaOfertas","formato":"feed","caso":"a07","texto":0,"foto":false,"marca":"dm","nota":84},
  {"receita":"listaOfertas","formato":"feed","caso":"a07","texto":2,"foto":false,"marca":"dm","nota":98},
  {"receita":"listaOfertas","formato":"feed","caso":"d05","texto":1,"foto":false,"marca":"much","nota":95},
  {"receita":"blocoCentral","formato":"feed","caso":"a04","texto":0,"foto":false,"marca":"dm","nota":92},
  {"receita":"blocoCentral","formato":"feed","caso":"a04","texto":2,"foto":false,"marca":"dm","nota":92},
  {"receita":"blocoCentral","formato":"feed","caso":"b02","texto":1,"foto":false,"marca":"much","nota":86},
  {"receita":"fotoCapaStory","formato":"story","caso":"a01","texto":0,"foto":true,"marca":"dm","nota":78},
  {"receita":"fotoCapaStory","formato":"story","caso":"a01","texto":2,"foto":true,"marca":"dm","nota":78},
  {"receita":"fotoCapaStory","formato":"story","caso":"a03","texto":1,"foto":true,"marca":"much","nota":83},
  {"receita":"vitrineCentral","formato":"story","caso":"a02","texto":0,"foto":true,"marca":"dm","nota":94},
  {"receita":"vitrineCentral","formato":"story","caso":"a02","texto":2,"foto":true,"marca":"dm","nota":86},
  {"receita":"vitrineCentral","formato":"story","caso":"x01","texto":1,"foto":true,"marca":"much","nota":86},
  {"receita":"precoVertical","formato":"story","caso":"a05","texto":0,"foto":false,"marca":"dm","nota":73},
  {"receita":"precoVertical","formato":"story","caso":"a05","texto":2,"foto":false,"marca":"dm","nota":82},
  {"receita":"precoVertical","formato":"story","caso":"b04","texto":1,"foto":false,"marca":"much","nota":89},
  {"receita":"listaStory","formato":"story","caso":"a07","texto":0,"foto":false,"marca":"dm","nota":86},
  {"receita":"listaStory","formato":"story","caso":"a07","texto":2,"foto":false,"marca":"dm","nota":98},
  {"receita":"listaStory","formato":"story","caso":"d05","texto":1,"foto":false,"marca":"much","nota":98},
// </golden>
];
