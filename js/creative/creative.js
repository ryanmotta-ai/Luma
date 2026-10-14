/**
 * js/creative/creative.js
 *
 * Luma Creative — modo em TESTES, só a gestão (trava em main.js e na Edge Function `ai`).
 * Um chat que compõe arte nova. A IA (task `arte.compor`) NÃO desenha: devolve a composição em
 * JSON — qual das 5 diagramações aprovadas da skill luma-creative, a copy e os dados (preço,
 * cupom, anos). Quem desenha é crCompor, com os blocos oficiais da skill e já no contrato do
 * importador de SVG (data-luma / data-campo / g#foto_produto): a arte já nasce pronta para virar template
 * sem retrabalho. Sem IA, crLerPedido lê o pedido (palavras-chave, preço, código, anos) e o
 * mesmo motor compõe. A legenda do post sai junto (fFetchAICaptionSuggestions, chat.js).
 *
 * Motor:  crCompor(spec) → {svg, campos, estouros}  ·  crEmbutir(svg) → SVG autônomo (base64)
 * Motor:  crCandidatos — a gramática (CR_RECEITAS × pilha) gera as diagramações que servem, crAvaliar
 *         confere a geometria no navegador (o lint-art.js da skill) e crEscolher3 tira 3 famílias
 * Designer: crDesenhos (task `arte.compor`) — a IA compõe como designer (skill §4.2): ideia + caixas
 *         dos blocos + grafismos do inventário; crDesenhar encaixa os blocos oficiais e crAvaliar confere
 * Juiz:   crJulgar (task `arte.criticar`) — a IA olha os prints com a régua e aponta ajustes
 * Chat:   crEntrar (transição da aba) · crEnviar (pedido → briefing → copy → 3 opções + legenda)
 * Editor: crEditar — tela com painel (camadas, texto ao vivo, tamanho, alinhar, ordem, foto, fundo)
 * Foto:   anexo no pedido ou resposta à pergunta; sem foto a arte é tipográfica (a IA não gera imagem)
 * Formatos: CR_FORMATOS — feed, story, inapp (pilha) e os deitados banner do app, cabeçalho/rodapé
 *         de email, capa Deskfy e slide (composições próprias em CR_LOCKUPS; medidas da skill §3.5)
 * Assets: assets/creative/ (fontes woff2 e logo recortado, cópia da skill — .agents/ não é servido)
 */

const CR_BASE = (function(){
  const s = (document.currentScript && document.currentScript.src) || '';
  return /js\/creative\/creative\.js/.test(s) ? s.replace(/js\/creative\/creative\.js.*$/, 'assets/creative/') : 'assets/creative/';
})();
const CR_W = 1080;
const CR_M = 100;                       // margem lateral da skill
const CR_L = CR_W - 2 * CR_M;           // largura útil (880)
const CR_PALETA = ['#F85400', '#FF9000', '#FFB900', '#FFFFFF', '#434343', '#D9D9D9', '#F62900'];
const CR_FONTES = [
  ['Realce', 'realce-black.woff2', 900, 'normal'],
  ['Roboto', 'Roboto-Regular.woff2', 400, 'normal'],
  ['Roboto', 'Roboto-Medium.woff2', 500, 'normal'],
  ['Roboto', 'Roboto-Light.woff2', 300, 'normal'],
  ['Roboto', 'Roboto-LightItalic.woff2', 300, 'italic'],
  ['Roboto', 'Roboto-Black.woff2', 900, 'normal']
];
// As classes de texto da skill (mesmos nomes e espaçamentos das artes refino_*).
const CR_ESTILO = {
  hero:  { fam: 'Realce', peso: 900, it: false, ls: 0.5 },
  sup:   { fam: 'Roboto', peso: 400, it: false, ls: 1.2 },
  body:  { fam: 'Roboto', peso: 400, it: false, ls: 0 },
  legal: { fam: 'Roboto', peso: 300, it: false, ls: 0.3 },
  leve:  { fam: 'Roboto', peso: 300, it: true,  ls: 0 },
  forte: { fam: 'Roboto', peso: 900, it: false, ls: 0 },
  media: { fam: 'Roboto', peso: 500, it: false, ls: 0.5 }
};
const CR_OBJETIVOS = {
  oferta:      'Oferta de produto',
  cupom:       'Cupom',
  evento:      'Evento na cidade',
  beneficio:   'Benefício (entrega grátis, frete)',
  aniversario: 'Aniversário da franquia'
};
// Ticket oficial (assets/cards-preco/ticket-cupom.svg da skill, 680×250).
const CR_TICKET_D = 'M 30 0 L 650 0 C 665 0 680 15 680 30 C 655 55 655 85 680 110 C 655 135 655 165 680 190 C 655 215 655 240 680 250 L 30 250 C 15 250 0 235 0 220 C 25 195 25 165 0 140 C 25 115 25 85 0 60 C 25 35 25 15 0 0 Z';
// Pattern ancorado oficial em escala de massa (refino_02): dois arcos do símbolo, metade visível.
// Ancorado no rodapé: no feed sobe 570 (1920 − 1350) para continuar meio visível no canto.
const CR_PATTERN = '<g id="pattern-ancorado" color="#FF9000" fill="currentColor" opacity="0.5" transform="translate(-2580,{Y}) scale(3) matrix(1 0 0 -1 0 1080)"><g transform="matrix(1 0 0 1 1161.3643 307.7339)"><path d="M 0 0 C 5.072 -53.327, -56.515 -86.656, -98.249 -53.327 C -112.595 -41.879, -117.232 -29.851, -121.145 -13.042 L -97.669 -9.274 C -95.061 -19.853, -92.742 -27.533, -83.178 -34.923 C -58.109 -54.631, -21.157 -34.923, -23.62 -2.898 L -24.055 2.753 L -0.58 6.521 Z" fill-rule="evenodd"/></g><g transform="matrix(1 0 0 1 841.6246 147.9541)"><path d="M 0 0 C 0.483 87.084, 105.53 130.963, 167.607 70.253 C 188.947 49.399, 194.489 29.189, 198.079 1.362 L 159.493 -0.908 C 156.997 16.627, 154.498 29.428, 140.232 42.94 C 102.892 78.902, 39.911 53.043, 38.679 0.84 L 38.461 -8.372 L -0.125 -10.642 Z" fill-rule="evenodd"/></g></g>';

/* ══════════════════════════════════════════════════════════════
   MEDIDA — o texto é medido com as MESMAS fontes que vão embutidas
══════════════════════════════════════════════════════════════ */
let _crFontesProm = null, _crCtx = null;
function crFontesProntas(){
  if(!_crFontesProm){
    _crFontesProm = Promise.all(CR_FONTES.map(([fam, arq, peso, estilo]) =>
      new FontFace('LC ' + fam, 'url(' + CR_BASE + 'fontes/' + arq + ')', { weight: String(peso), style: estilo })
        .load().then(f => { document.fonts.add(f); })
    )).catch(e => { _crFontesProm = null; throw e; });
  }
  return _crFontesProm;
}
function crMede(txt, cls, size){
  const e = CR_ESTILO[cls];
  if(!_crCtx) _crCtx = document.createElement('canvas').getContext('2d');
  _crCtx.font = (e.it ? 'italic ' : '') + e.peso + ' ' + size + 'px "LC ' + e.fam + '"';
  const s = String(txt || '');
  return _crCtx.measureText(s).width + e.ls * [...s].length;
}
// Maior corpo (≤ max) em que o texto cabe em `larg`. Abaixo de `min` não desce: marca estouro.
function crCabe(txt, cls, max, larg, min, estouros){
  const w = crMede(txt, cls, max);
  let s = w > larg ? Math.floor(max * larg / w) : max;
  if(min && s < min){ s = min; if(estouros) estouros.push(txt); }
  return s;
}
// Herói em 1 ou 2 linhas: 1 linha se couber com ≥ 80% do corpo; senão 2 linhas equilibradas.
function crQuebra(txt, cls, max, larg, min, estouros){
  const um = crCabe(txt, cls, max, larg, 0);
  const pal = String(txt).split(/\s+/).filter(Boolean);
  if(um >= max * 0.8 || pal.length < 2) return { linhas: [txt], size: Math.max(um, min || 0) };
  let melhor = null;
  for(let i = 1; i < pal.length; i++){
    const l = [pal.slice(0, i).join(' '), pal.slice(i).join(' ')];
    const w = Math.max(crMede(l[0], cls, 100), crMede(l[1], cls, 100));
    if(!melhor || w < melhor.w) melhor = { l, w };
  }
  let s = Math.min(max, Math.floor(100 * larg / melhor.w));
  if(min && s < min){ s = min; if(estouros) estouros.push(txt); }
  return { linhas: melhor.l, size: s };
}
// "pega este *cupom*" → trechos leve/forte
function crTrechos(linha){
  return String(linha || '').split(/(\*[^*]+\*)/).filter(Boolean)
    .map(t => /^\*.*\*$/.test(t) ? { cls: 'forte', t: t.slice(1, -1) } : { cls: 'leve', t });
}
function crMedeMista(linha, size){ return crTrechos(linha).reduce((a, r) => a + crMede(r.t, r.cls, size), 0); }

/* ══════════════════════════════════════════════════════════════
   BLOCOS — os mesmos da skill (refino_01…14), em SVG do contrato
══════════════════════════════════════════════════════════════ */
function crX(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
const _r = n => Math.round(n);
function crTexto(x, y, cls, size, fill, txt, extra){
  return '<text x="' + _r(x) + '" y="' + _r(y) + '" class="' + cls + '" font-size="' + _r(size) + '" fill="' + fill + '"' + (extra || '') + '>' + crX(txt) + '</text>';
}
function crMista(x, y, size, fill, linha, anchor){
  return '<text x="' + _r(x) + '" y="' + _r(y) + '"' + (anchor ? ' text-anchor="' + anchor + '"' : '') + ' font-size="' + _r(size) + '" fill="' + fill + '">'
    + crTrechos(linha).map(r => '<tspan class="' + r.cls + '">' + crX(r.t) + '</tspan>').join('') + '</text>';
}
// Herói de 1 ou 2 linhas num <text> só (uma linha por <tspan> com y próprio): o importador
// lê como UM campo de várias linhas — nunca a 2ª linha solta como texto fixo.
function crHeroi(x, ys, size, fill, linhas, extra){
  if(linhas.length === 1) return crTexto(x, ys[0], 'hero', size, fill, linhas[0], extra);
  return '<text x="' + _r(x) + '" y="' + _r(ys[0]) + '" class="hero" font-size="' + _r(size) + '" fill="' + fill + '"' + (extra || '') + '>'
    + linhas.map((l, i) => '<tspan x="' + _r(x) + '" y="' + _r(ys[i]) + '">' + crX(l) + '</tspan>').join('') + '</text>';
}
function crLogo(x, y, story){
  const w = story ? 300 : 260, h = story ? 60 : 52;
  return { svg: '<image href="asset:logos/dm-h-branca.png" x="' + _r(x) + '" y="' + _r(y) + '" width="' + w + '" height="' + h + '"/>', w, h };
}
// Slot da foto (contrato: g#foto_produto vira moldura). Com a foto que a pessoa enviou, ela entra
// recortada no slot (cover); sem foto, o placeholder oficial da skill.
function crFoto(x, y, w, h, rx, legenda, foto){
  const caixa = 'x="' + _r(x) + '" y="' + _r(y) + '" width="' + _r(w) + '" height="' + _r(h) + '" rx="' + rx + '"';
  let s = '<g id="foto_produto"><rect ' + caixa + ' fill="#D9D9D9"/>';
  if(foto && foto !== 'slot'){
    return s + '<clipPath id="crfoto"><rect ' + caixa + '/></clipPath><image href="' + foto + '" x="' + _r(x) + '" y="' + _r(y) + '" width="' + _r(w) + '" height="' + _r(h)
      + '" preserveAspectRatio="xMidYMid slice" clip-path="url(#crfoto)"/></g>';
  }
  if(h >= 240){
    const cx = Math.max(x, 0) + Math.min(w, CR_W) / 2, cy = y + h / 2 - 20;
    s += '<g transform="translate(' + _r(Math.min(cx, CR_W / 2)) + ',' + _r(cy) + ')">'
      + '<rect x="-65" y="-68" width="130" height="98" rx="18" fill="none" stroke="#434343" stroke-width="7.5"/>'
      + '<circle cx="26" cy="-38" r="8" fill="#434343"/>'
      + '<polyline points="-42,12 -8,-24 24,12" fill="none" stroke="#434343" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>'
      + '<polyline points="6,12 32,-14 48,12" fill="none" stroke="#434343" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>'
      + '<text x="0" y="85" text-anchor="middle" class="body" font-size="32" fill="#434343">' + crX(legenda || 'Use aqui sua foto do produto') + '</text></g>';
  }
  return s + '</g>';
}
// Selo circular amarelo (1 ou 2 linhas em Realce grafite)
function crSelo(cx, cy, r, linhas){
  const l = (linhas || []).filter(Boolean).slice(0, 2);
  if(!l.length) return '';
  let s = '<g transform="translate(' + _r(cx) + ',' + _r(cy) + ')" filter="url(#shs)"><circle r="' + r + '" fill="#FFB900"/>';
  if(l.length === 1){
    const z = crCabe(l[0], 'hero', r * 0.8, r * 1.5, 0);
    s += crTexto(0, z * 0.36, 'hero', z, '#434343', l[0], ' text-anchor="middle" data-larg="' + _r(r * 1.5) + '"');
  }else{
    const z1 = crCabe(l[0], 'hero', r * 0.72, r * 1.55, 0), z2 = crCabe(l[1], 'hero', r * 0.58, r * 1.4, 0);
    const alt = z1 * 0.73 + r * 0.14 + z2 * 0.73, b1 = -alt / 2 + z1 * 0.73, b2 = b1 + r * 0.14 + z2 * 0.73;
    const lg = ' text-anchor="middle" data-larg="' + _r(r * 1.5) + '"';
    s += crTexto(0, b1, 'hero', z1, '#434343', l[0], lg) + crTexto(0, b2, 'hero', z2, '#434343', l[1], lg);
  }
  return s + '</g>';
}
// Botão pílula (§3 item 5): 'cheio' branco + texto #F85400 (fundo #F85400) · 'contorno' branco
// (quando o preço é o foco) · 'laranja' #F85400 + texto branco (fundo #FF9000). `ancora`: x é a
// borda esquerda (padrão), a direita ('dir') ou o centro ('centro') do botão.
function crBotaoMede(txt){ return Math.max(288, _r(crMede(txt, 'hero', 56) + 128)); }
function crBotao(x, y, txt, estilo, ancora){
  if(estilo === true) estilo = 'cheio'; else if(estilo === false || !estilo) estilo = 'contorno';
  if(ancora === true) ancora = 'dir';
  const z = 56, w = crBotaoMede(txt), h = 96;
  const x0 = ancora === 'dir' ? x - w : ancora === 'centro' ? x - w / 2 : x;
  const r = '<rect x="' + _r(x0) + '" y="' + _r(y) + '" width="' + w + '" height="' + h + '" rx="48" ';
  const caixa = estilo === 'cheio' ? r + 'fill="#FFFFFF" filter="url(#shs)"/>'
    : estilo === 'laranja' ? r + 'fill="#F85400" filter="url(#shs)"/>'
    : r + 'fill="none" stroke="#FFFFFF" stroke-width="4"/>';
  return { svg: caixa + crTexto(x0 + w / 2, y + 68, 'hero', z, estilo === 'cheio' ? '#F85400' : '#FFFFFF', txt, ' text-anchor="middle"'), w };
}
// Ticket oficial em escala k (880×324 em k=1) + "CUPOM" girado na aba vermelha
function crTicket(x, y, k){
  const s = 1.2941 * k;
  return '<clipPath id="tkf"><path d="' + CR_TICKET_D + '"/></clipPath>'
    + '<g transform="translate(' + _r(x) + ',' + _r(y) + ') scale(' + (Math.round(s * 10000) / 10000) + ')" filter="url(#sh)"><g clip-path="url(#tkf)">'
    + '<rect width="680" height="250" fill="#FFFFFF"/><rect width="144" height="250" fill="#F62900"/>'
    + '<path d="' + CR_TICKET_D + '" fill="none" stroke="#FF9000" stroke-width="28"/></g></g>'
    + '<text transform="translate(' + _r(x + 126 * k) + ',' + _r(y + 162 * k) + ') rotate(-90)" text-anchor="middle" class="hero" font-size="' + _r(66 * k) + '" fill="#FFFFFF">CUPOM</text>';
}
function crLegal(x, y, txt, anchor, est){
  if(!txt) return '';
  const z = crCabe(txt, 'legal', 26, CR_L, 22, est);
  return crTexto(x, y, 'legal', z, '#FFFFFF', txt, anchor ? ' text-anchor="' + anchor + '"' : '');
}
function crDefs(){
  const ff = CR_FONTES.map(([fam, arq, peso, estilo]) => "@font-face{font-family:'" + fam + "';src:url('asset:fontes/" + arq + "') format('woff2');font-weight:" + peso + ';' + (estilo === 'italic' ? 'font-style:italic;' : '') + '}').join('\n');
  return '<defs><style>\n' + ff + '\n'
    + ".hero{font-family:'Realce',sans-serif;font-weight:900;letter-spacing:0.5px}\n"
    + ".sup{font-family:'Roboto',sans-serif;font-weight:400;letter-spacing:1.2px}\n"
    + ".body{font-family:'Roboto',sans-serif;font-weight:400}\n"
    + ".legal{font-family:'Roboto',sans-serif;font-weight:300;letter-spacing:0.3px}\n"
    + ".leve{font-family:'Roboto',sans-serif;font-weight:300;font-style:italic}\n"
    + ".forte{font-family:'Roboto',sans-serif;font-weight:900}\n"
    + ".media{font-family:'Roboto',sans-serif;font-weight:500;letter-spacing:0.5px}\n</style>\n"
    + '<filter id="sh" x="-10%" y="-10%" width="125%" height="135%"><feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#434343" flood-opacity="0.25"/></filter>\n'
    + '<filter id="shs" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#434343" flood-opacity="0.2"/></filter>\n</defs>\n';
}
// Preço-assinatura (§2.1): R$ e centavos a 55% do número e suspensos 35%. crPrecoMede devolve o
// corpo que cabe em `larg` e a largura real (para centralizar).
function crPrecoMede(por, larg, big0){
  const m = /^(\d+)(?:,(\d{2}))?$/.exec(String(por).replace(/\s/g, ''));
  const int = m ? m[1] : String(por), cent = m ? ',' + (m[2] || '00') : '';
  let big = big0 || 168, sm = Math.round(big * 0.55);
  const larguraEm = (b, s) => crMede('R$', 'hero', s) + 6 + crMede(int, 'hero', b) + crMede(cent, 'hero', s);
  let w = larguraEm(big, sm);
  if(w > larg){ const k = larg / w; big = Math.floor(big * k); sm = Math.floor(sm * k); w = larguraEm(big, sm); }
  return { int, cent, big, sm, w };
}
function crPreco(x, y, por, larg, fill, big0){
  const { int, cent, big, sm } = crPrecoMede(por, larg, big0);
  const dy = _r(big * 0.351);
  return '<text x="' + _r(x) + '" y="' + _r(y) + '" class="hero" font-size="' + big + '" data-campo="precoPor" fill="' + (fill || '#F85400') + '">'
    + '<tspan font-size="' + sm + '" dy="-' + dy + '">R$</tspan><tspan dy="' + dy + '" dx="6">' + crX(int) + '</tspan>'
    + (cent ? '<tspan font-size="' + sm + '" dy="-' + dy + '">' + crX(cent) + '</tspan>' : '') + '</text>';
}

/* ══════════════════════════════════════════════════════════════
   FORMATOS — um cadastro (medidas da skill §3.5, tiradas dos PSDs). Os altos (w 1080) usam a
   pilha; os deitados (`deitado`) têm composições próprias (CR_LOCKUPS). top/base = faixa útil do
   texto; fim = limite de baixo dos blocos; m = margem lateral; piso = menor texto; heroi/preco =
   menor herói/preço aceito; png = escala do PNG baixado (o banner do app sai @2x).
══════════════════════════════════════════════════════════════ */
const CR_FORMATOS = {
  feed:    { nome: 'Feed',  desc: '1080 × 1350, post no perfil', h: 1350, top: 80,  base: 1250, fim: 1270, seguroTopo: 60,  seguroBase: 1290 },
  story:   { nome: 'Story', desc: '1080 × 1920, tela cheia',     h: 1920, top: 290, base: 1640, fim: 1660, seguroTopo: 250, seguroBase: 1670 },
  inapp:   { nome: 'Inapp', desc: '1080 × 1920, pop-up no app',  h: 1920, top: 140, base: 1560, fim: 1600, seguroTopo: 100, seguroBase: 1830, social: false },
  banner:  { nome: 'Banner do app', desc: '764 × 204, carrossel da home', w: 764, h: 204, m: 23, seguroTopo: 0, seguroBase: 204, piso: 20, heroi: 30, heroiMax: 62, preco: 40, png: 2, deitado: true, social: false, card: [23, 9, 730, 175, 30] },
  emailTopo:   { nome: 'Cabeçalho de email', desc: '1080 × 300, topo do email', h: 300, m: 40, seguroTopo: 20, seguroBase: 280, piso: 28, heroi: 56, heroiMax: 92, preco: 64, deitado: true, social: false },
  emailRodape: { nome: 'Rodapé de email', desc: '1080 × 121, assinatura do email', h: 121, m: 40, seguroTopo: 8, seguroBase: 113, piso: 26, heroi: 0, preco: 0, deitado: true, social: false, fixo: true },
  capa:    { nome: 'Capa Deskfy', desc: '750 × 400, capa de pasta', w: 750, h: 400, m: 50, seguroTopo: 20, seguroBase: 385, piso: 20, heroi: 48, heroiMax: 80, preco: 56, png: 2, deitado: true, social: false },
  // Carrossel: 3 lâminas de 1080×1350 numa cena só (3240 de largura), cortada em 3 PNGs. Texto
  // respeita a margem de CADA lâmina (nunca atravessa a divisa); grafismo atravessa e amarra as lâminas.
  carrossel: { nome: 'Carrossel', desc: '3 lâminas de 1080 × 1350, post', w: 3240, h: 1350, m: 100, seguroTopo: 60, seguroBase: 1290, laminas: 3, deitado: true, heroi: 80, heroiMax: 300, preco: 96 },
  slide:   { nome: 'Slide', desc: '1920 × 1080, apresentação', w: 1920, h: 1080, m: 120, seguroTopo: 60, seguroBase: 1020, piso: 28, heroi: 60, heroiMax: 140, preco: 96, deitado: true, social: false }
};
function crArea(fmt){
  const k = CR_FORMATOS[fmt] ? fmt : 'feed', f = CR_FORMATOS[k];
  return { fmt: k, W: f.w || CR_W, H: f.h, M: f.m || CR_M, top: f.top, base: f.base, fim: f.fim, seguroTopo: f.seguroTopo, seguroBase: f.seguroBase,
    story: f.h === 1920, deitado: !!f.deitado, piso: f.piso || 22, heroiMin: f.heroi == null ? 80 : f.heroi, heroiMax: f.heroiMax || 0,
    precoMin: f.preco == null ? 96 : f.preco, card: f.card || null, laminas: f.laminas || 0, p: {} };
}

// Bloco = o que o editor (crEditar) move junto. Ganha transform ao arrastar; o importador lê a matriz.
const crBloco = (nome, svg) => svg ? '<g data-bloco="' + nome + '">' + svg + '</g>' : '';

/* ══════════════════════════════════════════════════════════════
   PILHA — o motor das diagramações: blocos de cima para baixo num eixo só (esquerda x=100 ou
   centro x=540), vãos em token (40 colado ao herói, 60/80 entre blocos, até 120 de folga) e a foto
   como ÚNICO bloco elástico (35–55% da altura útil). Bloco que não cabe = diagramação inviável
   (devolve null) — nunca se encolhe texto abaixo do piso da skill para caber.
══════════════════════════════════════════════════════════════ */
const CR_BLOCOS = {
  logo(b, c){
    const lg = crLogo(0, 0, c.a.story);
    return { nome: 'logo', h: lg.h, desenha: y => crBloco('logo', crLogo(c.centro ? (CR_W - lg.w) / 2 : CR_M, y, c.a.story).svg) };
  },
  tag(b, c){
    if(!c.sp.topo) return null;
    const z = 40, w = Math.max(330, _r(crMede(c.sp.topo, 'hero', z) + 64)), x = c.centro ? (CR_W - w) / 2 : CR_M;
    return { nome: 'tag', h: 70, desenha: y => crBloco('tag', '<rect x="' + _r(x) + '" y="' + _r(y) + '" width="' + w + '" height="70" rx="35" fill="#FFFFFF"/>'
      + crTexto(x + w / 2, y + 49, 'hero', z, '#F85400', c.sp.topo, ' text-anchor="middle"')) };
  },
  // Herói: 'realce' (1–2 linhas), 'duplo' (palavra de impacto 1,15–1,30× o complemento, §2.1),
  // 'vazado' (receita B: minúscula Roboto Black + Realce vazado)
  heroi(b, c){
    const { sp, a, est } = c, kh = (a.p.kh || 1) * (a.p.kt || 1) * (b.k || 1), campo = sp.objetivo === 'oferta' ? ' data-campo="produto"' : ' data-campo="titulo"';
    const estilo = b.estilo === 'vazado' && !sp.palavra ? 'realce' : b.estilo;
    if(estilo === 'vazado'){
      const z1 = crCabe(sp.palavra, 'forte', (a.story ? 250 : 190) * kh, CR_L, 90, est), z2 = crCabe(sp.titulo, 'hero', (a.story ? 380 : 290) * kh, CR_L, 140, est);
      const vao = a.story ? 80 : 48;
      return { nome: 'titulo', heroi: z2, h: z1 * 1.0 + vao + z2 * 0.73, desenha: y => {
        const b1 = y + z1 * 0.76, b2 = y + z1 + vao + z2 * 0.73;
        return crBloco('titulo', '<g id="produto">' + crTexto(c.X, b1, 'forte', z1, '#FFFFFF', sp.palavra, ' letter-spacing="-3"' + c.anc)
          + crTexto(c.X, b2, 'hero', z2, 'none', sp.titulo, ' stroke="#FFFFFF" stroke-width="7" stroke-linejoin="round"' + c.anc + campo) + '</g>');
      } };
    }
    const max = (a.story ? 170 : 151) * kh;
    const pal = sp.titulo.split(/\s+/);
    if(estilo === 'duplo'){
      if(pal.length < 2) return null;
      const l1 = pal[0], l2 = pal.slice(1).join(' ');
      const s2 = crCabe(l2, 'hero', max, CR_L, 80, est), s1 = Math.min(crCabe(l1, 'hero', max * 1.6, CR_L, 0), Math.round(s2 * 1.28));
      if(s1 < s2 * 1.15) return null;   // sem contraste de tamanho, não é "duplo" — outra diagramação cobre
      return { nome: 'titulo', heroi: s1, h: s1 * 0.73 + s2 * 0.94, desenha: y => crBloco('titulo', '<g id="produto">'
        + crTexto(c.X, y + s1 * 0.73, 'hero', s1, '#FFFFFF', l1, c.anc) + crTexto(c.X, y + s1 * 0.73 + s2 * 0.94, 'hero', s2, '#FFFFFF', l2, c.anc + campo) + '</g>') };
    }
    const q = crQuebra(sp.titulo, 'hero', max, b.larg || CR_L, 80, est), n = q.linhas.length;
    return { nome: 'titulo', heroi: q.size, h: q.size * 0.73 + (n - 1) * q.size * 0.94, desenha: y => crBloco('titulo', '<g id="produto">'
      + crHeroi(c.X, q.linhas.map((l, i) => y + q.size * 0.73 + i * q.size * 0.94), q.size, '#FFFFFF', q.linhas, c.anc + campo) + '</g>') };
  },
  apoio(b, c){
    if(!c.sp.apoio) return null;
    const z = crCabe(c.sp.apoio, 'body', c.a.story ? 42 : 40, b.larg || CR_L, 32, c.est);
    return { nome: 'apoio', apoio: z, h: z * 0.92, desenha: y => crBloco('apoio', crTexto(c.X, y + z * 0.72, 'body', z, '#FFFFFF', c.sp.apoio, c.anc)) };
  },
  chamada(b, c){
    const ls = c.sp.chamada; if(!ls.length) return null;
    const max = c.a.story ? 76 : 68, zc = Math.min(max, ...ls.map(l => Math.floor(max * CR_L / Math.max(1, crMedeMista(l, max)))));
    return { nome: 'chamada', h: zc * 0.75 + (ls.length - 1) * zc * 1.3 + zc * 0.2, desenha: y => crBloco('chamada',
      ls.map((l, i) => crMista(c.X, y + zc * 0.75 + i * zc * 1.3, zc, '#FFFFFF', l, c.centro ? 'middle' : '')).join('')) };
  },
  // Preço direto no fundo (branco): DE riscado · POR preso ao R$ · valor-assinatura
  preco(b, c){
    const { sp, a } = c;
    if(!sp.precoPor) return null;
    const pm = crPrecoMede(sp.precoPor, CR_L, (a.story ? 190 : 170) * (b.k || 1) * (a.p.kt || 1));
    const de = sp.precoDe ? 37 + 24 : 0, h = de + 44 + pm.big * 0.73;
    return { nome: 'preco', preco: pm.big, h, desenha: y => {
      const x0 = c.centro ? (CR_W - pm.w) / 2 : CR_M;
      let s = '<g id="preco">';
      if(sp.precoDe) s += crTexto(c.X, y + 29, 'body', 40, '#FFFFFF', 'DE R$ ' + sp.precoDe, ' text-decoration="line-through" data-campo="precoDe"' + c.anc);
      const topoNum = y + de + 44;
      s += crTexto(x0 + 2, topoNum - 18, 'sup', 36, '#FFFFFF', 'POR') + crPreco(x0, topoNum + pm.big * 0.73, sp.precoPor, CR_L, '#FFFFFF', pm.big) + '</g>';
      return crBloco('preco', s);
    } };
  },
  // Selo sozinho na linha (sem foto para se prender): data de evento, % OFF
  selo(b, c){
    const l = c.sp.selo; if(!l.length) return null;
    const r = _r(120 * Math.min(1.3, c.a.p.kt || 1));
    return { nome: 'selo', h: r * 2, desenha: y => crBloco('selo', crSelo(c.centro ? CR_W / 2 : CR_M + r, y + r, r, l)) };
  },
  cta(b, c){
    if(!c.sp.cta) return null;
    const estilo = c.fundo === '#FF9000' ? 'laranja' : (b.estilo || 'cheio');
    return { nome: 'botao', h: 96, desenha: y => crBloco('botao', crBotao(c.centro ? CR_W / 2 : CR_M, y, c.sp.cta, estilo, c.centro ? 'centro' : '').svg) };
  },
  // Rodapé: botão à esquerda + logo à direita (refino_03)
  rodape(b, c){
    const lg = crLogo(0, 0, false), w = c.sp.cta ? crBotaoMede(c.sp.cta) : 0;
    if(CR_M + w + 40 > 980 - lg.w) return null;
    const estilo = c.fundo === '#FF9000' ? 'laranja' : 'cheio';
    return { nome: 'botao', h: 96, desenha: y => (c.sp.cta ? crBloco('botao', crBotao(CR_M, y, c.sp.cta, estilo).svg) : '') + crBloco('logo', crLogo(980 - lg.w, y + 22, false).svg) };
  },
  legal(b, c){
    if(!c.sp.legal) return null;
    const z = crCabe(c.sp.legal, 'legal', c.a.story ? 28 : 26, CR_L, 24, c.est);
    return { nome: 'legal', h: z * 0.92, desenha: y => crBloco('legal', crTexto(c.X, y + z * 0.72, 'legal', z, '#FFFFFF', c.sp.legal, c.anc)) };
  },
  // Foto: único bloco elástico. sangra 'topo'|'base' (largura cheia, passa da borda); selo preso na
  // quina; card de preço branco preso à borda de baixo (§2.2, data-sobrepoe), com o botão em contorno ao lado.
  foto(b, c){
    const { sp, a } = c;
    if(!sp.foto) return null;
    const util = a.fim - a.top, kf = a.p.kf || 1;
    const comCard = b.card && sp.precoPor, cardH = sp.precoDe ? 310 : 250;
    const r = sp.selo.some(t => t.length > 5) ? 120 : 100;
    const selo = sp.selo.length && b.selo ? b.selo : '';
    return { nome: 'foto', flex: true, sangra: b.sangra || '',
      min: (a.story ? 420 : 340), max: util * (a.story ? 0.5 : 0.55) * kf + (b.sangra ? 60 : 0),
      // o selo na quina de cima avança r−22 sobre o bloco anterior; o card avança cardH−80 abaixo
      folgaAntes: selo === 'td' || selo === 'te' ? r - 22 + 40 : 0,
      abaixo: comCard ? cardH - 80 : (selo === 'bd' ? r * 0.65 : 0),
      desenha: (y, h) => {
        let x = CR_M, w = CR_L, yy = y, hh = h;
        if(b.sangra === 'topo'){ x = -60; w = 1200; yy = -60; hh = h + 60; }
        else if(b.sangra === 'base'){ x = -60; w = 1200; hh = a.H - y + 60; }
        let s = crBloco('foto', crFoto(x, yy, w, hh, 56, '', sp.foto));
        if(selo){
          const cx = selo === 'te' ? CR_M + r : CR_W - CR_M - r;
          const cy = selo === 'bd' ? y + h - r * 0.35 : y + 22;
          s += crBloco('selo', crSelo(cx, cy, r, sp.selo));
        }
        if(comCard){
          const dir = b.card === 'dir', cx = dir ? CR_W - CR_M - 470 : CR_M, top = y + h - 80;
          let p = '<g data-sobrepoe="foto"><rect x="' + cx + '" y="' + _r(top) + '" width="470" height="' + cardH + '" rx="36" fill="#FFFFFF" filter="url(#sh)"/><g id="preco">';
          let py = top;
          if(sp.precoDe){ p += crTexto(cx + 48, py + 64, 'body', 40, '#434343', 'DE R$ ' + sp.precoDe, ' text-decoration="line-through" data-campo="precoDe"'); py += 58; }
          p += crTexto(cx + 50, py + 64, 'sup', 38, '#434343', 'POR') + crPreco(cx + 46, py + 206, sp.precoPor, 374) + '</g></g>';
          s += crBloco('preco', p);
          if(sp.cta) s += crBloco('botao', dir ? crBotao(CR_M, top + cardH - 96, sp.cta, 'contorno').svg : crBotao(980, top + cardH - 96, sp.cta, 'contorno', 'dir').svg);
        }
        return s;
      } };
  }
};

function _crVao(antes, depois, a){
  if(antes.nome === 'titulo' && (depois.nome === 'apoio' || depois.nome === 'preco')) return { v: 40, fixo: true };
  return { v: Math.max(a.story ? 80 : 60, depois.folgaAntes || 0), fixo: false };
}
function crPilha(cfg){
  return (sp, a, est, fundo) => {
    const centro = cfg.eixo === 'centro';
    const c = { sp, a, est, fundo, centro, X: centro ? CR_W / 2 : CR_M, anc: centro ? ' text-anchor="middle"' : '' };
    const defs = typeof cfg.blocos === 'function' ? cfg.blocos(sp) : cfg.blocos;
    const bs = [];
    for(const d of defs){
      const b = CR_BLOCOS[d.t](d, c);
      if(b) bs.push(b); else if(d.exige) return null;    // bloco essencial que não coube/não existe
    }
    if(!bs.length) return null;
    const ini = bs[0].sangra === 'topo' ? 0 : a.top;
    const fim = bs[bs.length - 1].sangra === 'base' ? a.H : a.fim;
    const vaos = bs.slice(1).map((b, i) => _crVao(bs[i], b, a));
    const foto = bs.find(b => b.flex);
    let livre = (fim - ini) - bs.reduce((s, b) => s + (b.flex ? 0 : b.h) + (b.abaixo || 0), 0) - vaos.reduce((s, v) => s + v.v, 0);
    let hf = 0;
    if(foto){ if(livre < foto.min) return null; hf = Math.min(foto.max, livre); livre -= hf; }
    else if(livre < 0) return null;
    // Sobra vai para os vãos (até 120 no feed; no story até 200 — §FASE 2: distribuir pela faixa
    // inteira) com ritmo igual, e o resto centraliza — nunca "boia" num canto
    const soltos = vaos.filter(v => !v.fixo), teto = a.story ? 200 : 120;
    while(livre > 0.5 && soltos.some(v => v.v < teto)){
      const cabe = soltos.filter(v => v.v < teto), d = Math.min(livre / cabe.length, ...cabe.map(v => teto - v.v));
      cabe.forEach(v => { v.v += d; }); livre -= d * cabe.length;
    }
    let y = ini + (bs[0].sangra === 'topo' || bs[bs.length - 1].sangra === 'base' ? 0 : livre / 2);
    if(bs[0].sangra === 'topo' && livre > 0) vaos[0].v += livre;          // foto no topo: a folga fica logo abaixo dela
    else if(bs[bs.length - 1].sangra === 'base' && livre > 0) y += livre;  // foto na base: o texto desce até ela
    const out = [];
    bs.forEach((b, i) => {
      const h = b.flex ? hf : b.h;
      out.push(b.desenha(y, h));
      y += h + (b.abaixo || 0) + (i < vaos.length ? vaos[i].v : 0);
    });
    return out;
  };
}

/* Composições de tipo (sem foto): lockups da skill que não são pilha simples */
const CR_LOCKUPS = {
  // refino_02: logo central · chamada leve/forte · valor gigante · ticket com código · legal
  valor(sp, a, est, fundo, v){
    const out = [], k = a.story ? 1 : 0.9;
    const lg = crLogo(0, 0, a.story);
    const zc = Math.min(76 * k, ...sp.chamada.map(l => Math.floor(76 * k * CR_L / Math.max(1, crMedeMista(l, 76 * k)))));
    const pct = /%$/.test(sp.cupomValor), num = sp.cupomValor;
    let zn = 360 * k * (a.p.kh || 1);
    const wR = pct ? 0 : crMede('R$', 'hero', 130 * k), wO = Math.max(crMede('OFF', 'forte', 150 * k), crMede('NO SEU', 'forte', 56 * k), crMede('PEDIDO', 'forte', 56 * k));
    const g1 = pct ? 0 : 22 * k, g2 = 36 * k;
    let wN = crMede(num, 'hero', zn);
    if(wR + g1 + wN + g2 + wO > CR_L){ zn = Math.floor(zn * (CR_L - wR - g1 - g2 - wO) / wN); wN = crMede(num, 'hero', zn); }
    const alturas = { logo: lg.h, chamada: zc * 0.75 + (sp.chamada.length - 1) * zc * 1.37, lockup: zn * 0.73, ticket: 324 * k };
    const gaps = [95 * k, 96 * k, 120 * k, 116 * k];
    const total = alturas.logo + gaps[0] + alturas.chamada + gaps[1] + alturas.lockup + gaps[2] + alturas.ticket + (sp.legal ? gaps[3] : 0);
    if(total > a.base - a.top + 40) return null;
    let y = a.top + Math.max(0, (a.base - a.top - total) / 2);
    out.push(crBloco('logo', crLogo((CR_W - lg.w) / 2, y, a.story).svg));
    y += lg.h + gaps[0] + zc * 0.75;
    let ch = '';
    sp.chamada.forEach((l, i) => { ch += crMista(CR_W / 2, y, zc, '#FFFFFF', l, 'middle'); if(i < sp.chamada.length - 1) y += zc * 1.37; });
    out.push(crBloco('chamada', ch));
    y += gaps[1] + zn * 0.73;
    const x0 = (CR_W - (wR + g1 + wN + g2 + wO)) / 2, xn = x0 + wR + g1, xo = xn + wN + g2;
    let lk = '<g id="produto">';
    if(!pct) lk += crTexto(x0, y - zn * 0.458, 'hero', 130 * k, '#FFFFFF', 'R$');
    lk += crTexto(xn, y, 'hero', zn, '#FFFFFF', num, ' data-campo="desconto_valor"')
      + crTexto(xo, y - 152 * k, 'forte', 150 * k, '#FFFFFF', 'OFF') + crTexto(xo, y - 65 * k, 'forte', 56 * k, '#FFFFFF', 'NO SEU') + crTexto(xo, y, 'forte', 56 * k, '#FFFFFF', 'PEDIDO') + '</g>';
    out.push(crBloco('valor', lk));
    y += gaps[2];
    const tk = v.inclinar ? Math.min(k, 0.86) : k;   // girado, a caixa do ticket cresce: escala menor
    const tx = (CR_W - 880 * tk) / 2, cx = tx + 222 * tk, cl = 568 * tk;
    // Uma inclinação por peça (§2.2): o ticket pode girar −6° para dar energia
    const gira = v.inclinar ? ' transform="rotate(-6 ' + _r(CR_W / 2) + ' ' + _r(y + 162 * tk) + ')"' : '';
    out.push(crBloco('cupom', '<g' + gira + '>' + crTicket(tx, y, tk)
      + '<g id="detalhes">' + crTexto(cx, y + 82 * tk, 'sup', 34 * tk, '#434343', sp.cupomRotulo)
      + crTexto(cx, y + 194 * tk, 'hero', crCabe(sp.cupomCodigo, 'hero', 116 * tk, cl, 60, est), '#F85400', sp.cupomCodigo, ' data-campo="codigo_cupom" data-larg="' + _r(cl) + '"')
      + '<line x1="' + _r(cx) + '" y1="' + _r(y + 222 * tk) + '" x2="' + _r(cx + cl) + '" y2="' + _r(y + 222 * tk) + '" stroke="#FFB900" stroke-width="3" stroke-linecap="round"/>'
      + (sp.apoio ? crTexto(cx, y + 272 * tk, 'body', crCabe(sp.apoio, 'body', 32 * tk, cl, 24, est), '#434343', sp.apoio, ' data-larg="' + _r(cl) + '"') : '') + '</g></g>'));
    y += 324 * tk + gaps[3];
    out.push(crBloco('legal', crLegal(CR_W / 2, y, sp.legal, 'middle', est)));
    return out;
  },

  // refino_14: logo · tag · número gigante + ANOS NA SUA CIDADE · frase leve/forte · ticket do presente · legal
  aniversario(sp, a, est){
    const out = [], lg = crLogo(CR_M, 0, a.story);
    const anoTxt = sp.anos === '1' ? 'ANO' : 'ANOS';
    let zn = 450 * (a.p.kh || 1);
    const wB = Math.max(crMede(anoTxt, 'forte', 144), crMede('NA SUA', 'forte', 86), crMede('CIDADE', 'forte', 86));
    let wN = crMede(sp.anos, 'hero', zn);
    if(wN + 24 + wB > CR_L){ zn = Math.floor(zn * (CR_L - 24 - wB) / wN); wN = crMede(sp.anos, 'hero', zn); }
    const zt = 40, tw = crMede(sp.topo, 'hero', zt), pw = Math.max(330, _r(tw + 64));
    const zc = Math.min(66, ...sp.chamada.map(l => Math.floor(66 * CR_L / Math.max(1, crMedeMista(l, 66)))));
    const total = lg.h + (sp.topo ? 38 + 70 : 0) + 35 + 450 * 0.73 + 104 + (sp.chamada.length - 1) * 80 + 78 + 324 + (sp.legal ? 100 : 0);
    let y = a.top + Math.max(0, (a.base + 20 - a.top - total) / 2);
    out.push(crBloco('logo', crLogo(CR_M, y, a.story).svg));
    y += lg.h;
    if(sp.topo){
      y += 38;
      out.push(crBloco('tag', '<rect x="' + CR_M + '" y="' + _r(y) + '" width="' + pw + '" height="70" rx="35" fill="#FFFFFF"/>' + crTexto(CR_M + pw / 2, y + 49, 'hero', zt, '#F85400', sp.topo, ' text-anchor="middle"')));
      y += 70;
    }
    const B = y + 35 + 450 * 0.73, xb = CR_M + wN + 24;
    out.push(crBloco('anos', '<g id="produto">' + crTexto(CR_M, B, 'hero', zn, '#FFFFFF', sp.anos, ' data-campo="anos"')
      + crTexto(xb, B - 222, 'forte', 144, '#FFFFFF', anoTxt) + crTexto(xb, B - 111, 'forte', 86, '#FFFFFF', 'NA SUA') + crTexto(xb, B, 'forte', 86, '#FFFFFF', 'CIDADE') + '</g>'));
    y = B + 104;
    let ch = '';
    sp.chamada.forEach((l, i) => { ch += crMista(CR_M, y, zc, '#FFFFFF', l); if(i < sp.chamada.length - 1) y += 80; });
    out.push(crBloco('chamada', ch));
    const ty = y + 78, cx = CR_M + 222, cl = 568;
    const valor = /%$/.test(sp.cupomValor) ? sp.cupomValor + ' OFF' : 'R$ ' + sp.cupomValor + ' OFF';
    const wc = crMede('CÓDIGO', 'sup', 30);
    out.push(crBloco('cupom', crTicket(CR_M, ty, 1)
      + '<g id="detalhes">' + crTexto(cx, ty + 82, 'sup', 34, '#434343', sp.cupomRotulo)
      + crTexto(cx, ty + 180, 'hero', crCabe(valor, 'hero', 104, cl, 60, est), '#F85400', valor, ' data-campo="desconto_valor" data-larg="' + cl + '"')
      + '<line x1="' + cx + '" y1="' + _r(ty + 206) + '" x2="' + (cx + cl) + '" y2="' + _r(ty + 206) + '" stroke="#FFB900" stroke-width="3" stroke-linecap="round"/>'
      + crTexto(cx, ty + 266, 'sup', 30, '#434343', 'CÓDIGO')
      + crTexto(cx + wc + 18, ty + 266, 'forte', crCabe(sp.cupomCodigo, 'forte', 50, cl - wc - 18, 30, est), '#434343', sp.cupomCodigo, ' data-campo="codigo_cupom" data-larg="' + _r(cl - wc - 18) + '"') + '</g>'));
    out.push(crBloco('legal', crLegal(CR_M, ty + 324 + 84, sp.legal, '', est)));
    return out;
  },

  /* ── Formatos deitados (skill §3.5): a mesma copy, composição própria de cada canal ── */

  // Capa Deskfy e slide (§3.4): adesivo central — pré-título em pílula, herói em Realce com borda
  // branca grossa, complemento em card branco — e o logo no rodapé. Desenhado em 750×400 e escalado.
  sticker(sp, a, est, fundo, v){
    const k = a.W / 750, oy = (a.H - 400 * k) / 2, ch = crChave(sp), anc = ' text-anchor="middle"';
    const q = crQuebra(ch.titulo, 'hero', a.heroiMax * (a.p.kh || 1), 560 * k, a.heroiMin, est), z = q.size, n = q.linhas.length;
    const hh = z * 0.73 + (n - 1) * z * 0.94, vao = 14 * k;
    const [pf, pc] = fundo === '#FFB900' ? ['#F85400', '#FFFFFF'] : ['#FFFFFF', '#F85400'];
    let g = '';
    if(ch.pre){
      const zp = crCabe(ch.pre, 'media', 22 * k, 420 * k, a.piso, est), pl = crPilula(0, -hh / 2 - vao - zp * 0.875, ch.pre, 'media', zp, pf, pc, 8 * k);
      g += pl.svg;
    }
    g += crHeroi(0, q.linhas.map((l, i) => -hh / 2 + z * 0.73 + i * z * 0.94), z, '#F85400', q.linhas,
      anc + ' stroke="#FFFFFF" stroke-width="' + _r(z * 0.26) + '" stroke-linejoin="round" paint-order="stroke fill" data-campo="' + ch.campo + '"');
    const comp = ch.valor ? (ch.valor.preco ? 'POR R$ ' + ch.valor.preco : ch.valor.txt) : ch.comp;
    if(comp){
      const cls = ch.valor ? 'hero' : 'media', zc = crCabe(comp, cls, (ch.valor ? 30 : 22) * k, 480 * k, a.piso, est);
      g += crPilula(0, hh / 2 + vao + zc * 0.875, comp, cls, zc, '#FFFFFF', '#F85400', 10 * k).svg;
    }
    const arco = '<path d="M ' + _r(100 * k) + ' ' + _r(oy + 170 * k) + ' Q ' + _r(375 * k) + ' ' + _r(oy + 270 * k) + ' ' + _r(650 * k) + ' ' + _r(oy + 170 * k)
      + '" fill="none" stroke="' + (fundo === '#FFB900' ? '#F85400' : '#FF9000') + '" stroke-width="' + _r(44 * k) + '" stroke-linecap="round" opacity="' + (fundo === '#FFB900' ? 0.2 : 0.6) + '"/>';
    const gira = v.inclinar ? ' rotate(-8)' : '';
    return [arco,
      crBloco('titulo', '<g transform="translate(' + _r(375 * k) + ',' + _r(oy + 175 * k) + ')' + gira + '" filter="url(#sh)">' + g + '</g>'),
      crBloco('logo', '<image href="asset:logos/dm-h-branca.png" x="' + _r((a.W - 174 * k) / 2) + '" y="' + _r(oy + 336 * k) + '" width="' + _r(174 * k) + '" height="' + _r(35 * k) + '"/>')];
  },

  // Foto numa metade (sangrando), logo + herói + valor centrados na outra: capa, slide e cabeçalho
  metade(sp, a, est, fundo, v){
    if(!sp.foto) return null;
    const ch = crChave(sp), meio = a.W / 2, esq = v.lado === 'esq';
    const x0 = (esq ? meio : 0) + a.M, larg = meio - 2 * a.M, cx = x0 + larg / 2, anc = ' text-anchor="middle"';
    const lw = Math.min(300, _r(larg * 0.45)), lh = lw / 4.97;
    const q = crQuebra(ch.titulo, 'hero', a.heroiMax * (a.p.kh || 1), larg, a.heroiMin, est), z = q.size, n = q.linhas.length;
    const hh = z * 0.73 + (n - 1) * z * 0.94;
    let pm = null, zc = 0;
    if(ch.valor && ch.valor.preco) pm = crPrecoMede(ch.valor.preco, larg, _r(a.heroiMax * 1.05));
    else if(ch.valor || (ch.comp && crMede(ch.comp, 'media', a.piso) <= larg)) zc = crCabe(ch.valor ? ch.valor.txt : ch.comp, ch.valor ? 'hero' : 'media', ch.valor ? z * 0.6 : Math.max(a.piso, z * 0.38), larg, a.piso, est);
    const vao = Math.max(16, _r(a.H * 0.06)), util = a.seguroBase - a.seguroTopo;
    if(zc && lh + vao + hh + vao + zc * 0.95 > util) zc = 0;          // apoio não cabe na altura: fica herói + logo
    const ch2 = pm ? pm.big * 0.73 : zc * 0.95, total = lh + vao + hh + (ch2 ? vao + ch2 : 0);
    if(total > util) return null;
    let y = (a.H - total) / 2;
    const out = [crBloco('foto', crFoto(esq ? 0 : meio, 0, meio, a.H, 0, '', sp.foto)),
      crBloco('logo', '<image href="asset:logos/dm-h-branca.png" x="' + _r(cx - lw / 2) + '" y="' + _r(y) + '" width="' + lw + '" height="' + _r(lh) + '"/>')];
    y += lh + vao;
    out.push(crBloco('titulo', '<g id="produto">' + crHeroi(cx, q.linhas.map((l, i) => y + z * 0.73 + i * z * 0.94), z, '#FFFFFF', q.linhas, anc + ' data-campo="' + ch.campo + '"') + '</g>'));
    y += hh + vao;
    if(pm) out.push(crBloco('preco', '<g id="preco">' + crPreco(cx - pm.w / 2, y + pm.big * 0.73, ch.valor.preco, larg, '#FFFFFF', pm.big) + '</g>'));
    else if(zc) out.push(crBloco(ch.valor ? 'valor' : 'apoio', crTexto(cx, y + zc * 0.75, ch.valor ? 'hero' : 'media', zc, '#FFFFFF', ch.valor ? ch.valor.txt : ch.comp, anc)));
    return out;
  },

  // Cabeçalho de email (ref. burger fest): metade da marca (logo) | metade amarela com o herói
  // e, com foto, a foto embaixo da faixa amarela
  emailMarca(sp, a, est){
    const ch = crChave(sp), meio = a.W / 2, lw = 300, lh = lw / 4.97, anc = ' text-anchor="middle"';
    const faixa = sp.foto ? 118 : a.H, cx = meio + meio / 2, larg = meio - 2 * a.M;
    // com foto, o herói vai numa faixa de 118 px: uma linha só (não cabe = outra composição cobre)
    const um = sp.foto && crCabe(ch.titulo, 'hero', 76 * (a.p.kh || 1), larg, 0);
    if(sp.foto && um < a.heroiMin) return null;
    const q = sp.foto ? { linhas: [ch.titulo], size: um } : crQuebra(ch.titulo, 'hero', a.heroiMax * (a.p.kh || 1), larg, a.heroiMin, est), z = q.size, n = q.linhas.length;
    const hh = z * 0.73 + (n - 1) * z * 0.94;
    let comp = !sp.foto && (ch.valor ? (ch.valor.preco ? 'POR R$ ' + ch.valor.preco : ch.valor.txt) : ch.comp);
    if(comp && crMede(comp, 'media', a.piso) > larg) comp = '';      // apoio longo não cabe na metade: fica só o herói
    const zc = comp ? crCabe(comp, 'media', 34, larg, a.piso, est) : 0, total = hh + (zc ? 22 + zc * 0.75 : 0);
    const y = (faixa - total) / 2;
    const out = ['<rect x="' + meio + '" y="0" width="' + meio + '" height="' + faixa + '" fill="#FFB900"/>',
      crBloco('logo', '<image href="asset:logos/dm-h-branca.png" x="' + _r((meio - lw) / 2) + '" y="' + _r((a.H - lh) / 2) + '" width="' + lw + '" height="' + _r(lh) + '"/>'),
      crBloco('titulo', '<g id="produto">' + crHeroi(cx, q.linhas.map((l, i) => y + z * 0.73 + i * z * 0.94), z, '#F85400', q.linhas, anc + ' data-campo="' + ch.campo + '"') + '</g>')];
    if(zc) out.push(crBloco('apoio', crTexto(cx, y + hh + 22 + zc * 0.75, 'media', zc, '#434343', comp, anc)));
    if(sp.foto) out.push(crBloco('foto', crFoto(meio, faixa, meio, a.H - faixa, 0, '', sp.foto)));
    return out;
  },

  // Cabeçalho de email em faixa única: logo à esquerda, herói e valor alinhados à direita
  emailFaixa(sp, a, est){
    const ch = crChave(sp), lw = 260, lh = lw / 4.97, xd = a.W - a.M - 20, larg = a.W - 2 * a.M - lw - 120, anc = ' text-anchor="end"';
    const q = crQuebra(ch.titulo, 'hero', a.heroiMax * (a.p.kh || 1), larg, a.heroiMin, est), z = q.size, n = q.linhas.length;
    const hh = z * 0.73 + (n - 1) * z * 0.94;
    const comp = ch.valor ? (ch.valor.preco ? 'POR R$ ' + ch.valor.preco : ch.valor.txt) : ch.comp;
    const zc = comp ? crCabe(comp, ch.valor ? 'hero' : 'media', ch.valor ? 48 : 34, larg, a.piso, est) : 0;
    const total = hh + (zc ? 24 + zc * 0.75 : 0);
    if(total > a.seguroBase - a.seguroTopo) return null;
    const y = (a.H - total) / 2;
    const out = [crBloco('logo', '<image href="asset:logos/dm-h-branca.png" x="' + (a.M + 20) + '" y="' + _r((a.H - lh) / 2) + '" width="' + lw + '" height="' + _r(lh) + '"/>'),
      crBloco('titulo', '<g id="produto">' + crHeroi(xd, q.linhas.map((l, i) => y + z * 0.73 + i * z * 0.94), z, '#FFFFFF', q.linhas, anc + ' data-campo="' + ch.campo + '"') + '</g>')];
    if(zc) out.push(crBloco(ch.valor ? 'valor' : 'apoio', crTexto(xd, y + hh + 24 + zc * 0.75, ch.valor ? 'hero' : 'media', zc, '#FFFFFF', comp, anc)));
    return out;
  },

  // Banner do app (ref. Promo Turbinada): card em dois tons — herói à esquerda, valor na zona
  // amarela à direita e, com foto, a foto no meio passando da borda do card
  bannerSplit(sp, a, est, fundo){
    const ch = crChave(sp), [cx0, cy0, cw, chh] = a.card, cy = cy0 + chh / 2;
    const valor = ch.valor || (ch.selo.length ? { txt: ch.selo.join(' ') } : null);
    if(!valor) return null;
    const corte = sp.foto ? 330 : 420, fx = 316, fw = 200, z0 = cx0 + 28;
    const q = crQuebra(ch.titulo, 'hero', a.heroiMax * (a.p.kh || 1), corte - z0 - 24, a.heroiMin, est), z = q.size, n = q.linhas.length;
    const hh = z * 0.73 + (n - 1) * z * 0.94, x1 = sp.foto ? fx + fw : corte, zl = cx0 + cw - x1 - 44, xm = x1 + 18 + zl / 2;
    const out = ['<clipPath id="crcard"><rect x="' + cx0 + '" y="' + cy0 + '" width="' + cw + '" height="' + chh + '" rx="' + a.card[4] + '"/></clipPath>'
      + '<rect x="' + corte + '" y="' + cy0 + '" width="' + (cx0 + cw - corte) + '" height="' + chh + '" fill="#FFB900" clip-path="url(#crcard)"/>',
      crBloco('titulo', '<g id="produto">' + crHeroi(z0, q.linhas.map((l, i) => cy - hh / 2 + z * 0.73 + i * z * 0.94), z, '#FFFFFF', q.linhas, ' data-campo="' + ch.campo + '"') + '</g>')];
    if(sp.foto) out.push(crBloco('foto', crFoto(fx, 0, fw, a.H, 24, '', sp.foto)));
    if(valor.preco){
      const pm = crPrecoMede(valor.preco, zl, 76);
      out.push(crBloco('preco', '<g id="preco">' + crPreco(xm - pm.w / 2, cy + pm.big * 0.365, valor.preco, zl, '#F85400', pm.big) + '</g>'));
    }else{
      const zv = crCabe(valor.txt, 'hero', 64, zl, a.heroiMin, est);
      out.push(crBloco('valor', crTexto(xm, cy + zv * 0.36, 'hero', zv, '#F85400', valor.txt, ' text-anchor="middle"')));
    }
    return out;
  },

  // Banner em um tom: herói à esquerda e selo circular amarelo com o valor à direita
  bannerSelo(sp, a, est){
    const ch = crChave(sp), [cx0, cy0, cw, chh] = a.card, cy = cy0 + chh / 2;
    if(!ch.selo.length) return null;
    const r = 70, sx = cx0 + cw - 28 - r, z0 = cx0 + 32;
    const q = crQuebra(ch.titulo, 'hero', a.heroiMax * (a.p.kh || 1), sx - r - 32 - z0, a.heroiMin, est), z = q.size, n = q.linhas.length;
    const hh = z * 0.73 + (n - 1) * z * 0.94;
    return [crBloco('titulo', '<g id="produto">' + crHeroi(z0, q.linhas.map((l, i) => cy - hh / 2 + z * 0.73 + i * z * 0.94), z, '#FFFFFF', q.linhas, ' data-campo="' + ch.campo + '"') + '</g>'),
      crBloco('selo', crSelo(sx, cy, r, ch.selo))];
  },

  // Banner com a foto em cartão à direita e o selo na quina dela
  bannerFoto(sp, a, est){
    if(!sp.foto) return null;
    const ch = crChave(sp), [cx0, cy0, cw, chh] = a.card, cy = cy0 + chh / 2, fx = 400, z0 = cx0 + 32;
    const q = crQuebra(ch.titulo, 'hero', a.heroiMax * (a.p.kh || 1), fx - 28 - z0, a.heroiMin, est), z = q.size, n = q.linhas.length;
    const hh = z * 0.73 + (n - 1) * z * 0.94;
    const out = [crBloco('titulo', '<g id="produto">' + crHeroi(z0, q.linhas.map((l, i) => cy - hh / 2 + z * 0.73 + i * z * 0.94), z, '#FFFFFF', q.linhas, ' data-campo="' + ch.campo + '"') + '</g>'),
      crBloco('foto', crFoto(fx, cy0, cx0 + cw - fx, chh, a.card[4], '', sp.foto))];
    if(ch.selo.length) out.push(crBloco('selo', crSelo(cx0 + cw - 62, cy0 + 58, 50, ch.selo)));
    return out;
  },

  // Carrossel (ref. Dia do Solteiro): lâmina 1 = capa (logo + título gigante + seta para o lado),
  // 2 = conteúdo (itens em cards, ou a foto), 3 = ação (preço/valor/cupom + botão + logo). O sorriso
  // atravessa a divisa 1→2 por baixo e amarra as lâminas.
  carrossel(sp, a, est, fundo){
    const L = 1080, M = a.M, larg = L - 2 * M, ch = crChave(sp), out = [];
    const decorSvg = (id, x, y, w, rot) => { const d = CR_DECOR[id]; if(!_crDoInv(id, sp)) return ''; const h = Math.round(w * d.h / d.w);
      return crBloco('decor', '<image href="asset:inv/' + id + '.png" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"' + (rot ? ' transform="rotate(' + rot + ' ' + _r(x + w / 2) + ' ' + _r(y + h / 2) + ')"' : '') + '/>'); };
    out.push(decorSvg('sorriso-arco', 660, 1010, 860, 0), decorSvg('seta-rabisco', 120, 1110, 300, -8));
    // lâmina 1
    out.push(crBloco('logo', crLogo(M, 90, false).svg));
    const q = _crHeroiCaixa(ch.titulo || sp.titulo, larg, 560, 300);
    if(q.size < a.heroiMin) est.push(ch.titulo);
    out.push(crBloco('titulo', '<g id="produto">' + crHeroi(M, q.linhas.map((l, k) => 360 + q.size * 0.73 + k * q.size * 0.94), q.size, '#FFFFFF', q.linhas, ' data-campo="' + (sp.objetivo === 'oferta' ? 'produto' : 'titulo') + '"') + '</g>'));
    // lâmina 2
    const x2 = L + M;
    if(sp.itens.length){
      if(sp.apoio) out.push(crBloco('apoio', crTexto(x2, 170, 'body', crCabe(sp.apoio, 'body', 48, larg, 32, est), '#FFFFFF', sp.apoio)));
      out.push(crBloco('itens', crItens(x2, 280, larg, 660, sp.itens, est)));
    }else if(sp.foto){
      out.push(crBloco('foto', crFoto(L + M, 120, larg, 780, 56, '', sp.foto)));
      if(sp.apoio) out.push(crBloco('apoio', crTexto(x2, 990, 'body', crCabe(sp.apoio, 'body', 48, larg, 32, est), '#FFFFFF', sp.apoio)));
    }else if(sp.chamada.length){
      const zc = Math.floor(Math.min(96, ...sp.chamada.map(l => larg * 90 / Math.max(1, crMedeMista(l, 90)))));
      out.push(crBloco('chamada', sp.chamada.map((l, k) => crMista(x2, 420 + zc * 0.75 + k * zc * 1.3, zc, '#FFFFFF', l)).join('')));
    }else if(sp.apoio){
      const qa = _crHeroiCaixa(sp.apoio.toLocaleUpperCase('pt-BR'), larg, 520, 150);
      out.push(crBloco('chamada', crHeroi(x2, qa.linhas.map((l, k) => 320 + qa.size * 0.73 + k * qa.size * 0.94), qa.size, '#FFFFFF', qa.linhas)));
    }else return null;
    // lâmina 3
    const x3 = 2 * L + M;
    let y3 = 200;
    if(sp.precoPor){
      const pm = crPrecoMede(sp.precoPor, larg, 230), de = sp.precoDe ? 61 : 0;
      let pr = '<g id="preco">' + (sp.precoDe ? crTexto(x3, y3 + 29, 'body', 40, '#FFFFFF', 'DE R$ ' + sp.precoDe, ' text-decoration="line-through" data-campo="precoDe"') : '');
      pr += crTexto(x3 + 2, y3 + de + 26, 'sup', 36, '#FFFFFF', 'POR') + crPreco(x3, y3 + de + 44 + pm.big * 0.73, sp.precoPor, larg, '#FFFFFF', pm.big) + '</g>';
      out.push(crBloco('preco', pr)); y3 += de + 44 + pm.big * 0.73 + 120;
    }else if(sp.cupomCodigo && (sp.objetivo === 'cupom' || sp.objetivo === 'aniversario')){
      const zv = 150, val = ch.valor ? ch.valor.txt : (sp.cupomValor ? 'R$ ' + sp.cupomValor + ' OFF' : '');
      if(val){ const z = crCabe(val, 'hero', zv, larg, 96, est); out.push(crBloco('valor', crTexto(x3, y3 + z * 0.73, 'hero', z, '#FFFFFF', val, ' data-campo="desconto_valor"'))); y3 += z * 0.73 + 100; }
      out.push(crBloco('cupom', crTicket(x3, y3, 1) + '<g id="detalhes">' + crTexto(x3 + 222, y3 + 82, 'sup', 34, '#434343', sp.cupomRotulo)
        + crTexto(x3 + 222, y3 + 194, 'hero', crCabe(sp.cupomCodigo, 'hero', 116, 568, 48, est), '#F85400', sp.cupomCodigo, ' data-campo="codigo_cupom" data-larg="568"') + '</g>'));
      y3 += 324 + 100;
    }else if(ch.selo.length){
      out.push(crBloco('selo', crSelo(x3 + 150, y3 + 150, 150, ch.selo))); y3 += 300 + 100;
    }
    const cta = sp.cta || 'PEÇA NO APP';
    out.push(crBloco('botao', crBotao(x3, Math.max(y3, 760), cta, fundo === '#FF9000' ? 'laranja' : 'cheio').svg));
    if(sp.legal) out.push(crBloco('legal', crTexto(x3, 1140, 'legal', crCabe(sp.legal, 'legal', 26, larg, 22, est), '#FFFFFF', sp.legal)));
    out.push(crBloco('logo', crLogo(x3, 1200, false).svg));
    return out.filter(Boolean);
  },

  /* ── Slide (Template de Apresentações 2026, assets/creative/slides/): fundos do template, Roboto,
     logo do template. Capa · destaque em pílula · conteúdo no branco com arco · mockup · cards ── */
  slide(sp, a, est, fundo, v){
    // o template escreve título em caixa normal ("Título de uma linha"), não em maiúsculas
    const W = a.W, H = a.H, M = 200, out = [], ch = crChave(sp), t0 = String(ch.titulo || sp.titulo).toLocaleLowerCase('pt-BR'), tit = t0.charAt(0).toLocaleUpperCase('pt-BR') + t0.slice(1);
    const bg = f => '<image href="asset:slides/' + f + '.jpg" x="0" y="0" width="' + W + '" height="' + H + '" preserveAspectRatio="xMidYMid slice"/>';
    // logo da Delivery Much (decisão do Ryan, 14/10): branco sobre laranja, laranja sobre o branco
    const logoB = (x, y, w) => crBloco('logo', '<image href="asset:logos/dm-h-branca.png" x="' + _r(x) + '" y="' + _r(y) + '" width="' + w + '" height="' + _r(w / 4.97) + '"/>');
    const logoC = (x, y, w) => crBloco('logo', '<image href="asset:logos/dm-h-laranja.png" x="' + _r(x) + '" y="' + _r(y) + '" width="' + w + '" height="' + _r(w * 61 / 298) + '"/>');
    const titulo = (x, y, w, h, max, cor, anc) => {
      // o título do template é Roboto (não Realce): 1–2 linhas equilibradas, o maior corpo que cabe
      const ls = _crLinhas(tit, 'body', crMede(tit, 'body', max) > w ? 2 : 1), zz = Math.floor(Math.min(max, h / (0.73 + (ls.length - 1) * 1.15), w * 100 / Math.max(...ls.map(l => crMede(l, 'body', 100)))));
      return { h: zz * 0.73 + (ls.length - 1) * zz * 1.15, svg: crBloco('titulo', '<g id="produto"><text x="' + _r(x) + '" y="' + _r(y + zz * 0.73) + '" class="body" font-size="' + zz + '" fill="' + cor + '"' + (anc || '') + ' data-campo="' + (sp.objetivo === 'oferta' ? 'produto' : 'titulo') + '">'
        + ls.map((l, k) => '<tspan x="' + _r(x) + '" y="' + _r(y + zz * 0.73 + k * zz * 1.15) + '">' + crX(l) + '</tspan>').join('') + '</text></g>'), z: zz < a.heroiMin ? est.push(tit) : 0 };
    };
    const corpo = (x, y, w, cor) => {
      let yy = y, s = '';
      if(sp.apoio){ const z = crCabe(sp.apoio, 'media', 44, w, a.piso, est); s += crTexto(x, yy + z * 0.75, 'media', z, cor, sp.apoio); yy += z + 36; }
      sp.itens.forEach(t => { const z = crCabe(t, 'body', 38, w - 40, a.piso, est); s += '<circle cx="' + _r(x + 8) + '" cy="' + _r(yy + z * 0.45) + '" r="7" fill="' + cor + '"/>' + crTexto(x + 36, yy + z * 0.75, 'body', z, '#434343', t); yy += z + 30; });
      return s ? crBloco('apoio', s) : '';
    };
    if(v.tipo === 'capa'){
      out.push(bg('fundo-arco-laranja'), logoB(M, 190, 300));
      const t = titulo(M, 430, 1150, 330, 140, '#FFFFFF');
      out.push(t.svg);
      if(sp.apoio) out.push(crBloco('apoio', crTexto(M, 430 + t.h + 60 + 48, 'body', crCabe(sp.apoio, 'body', 60, 1150, a.piso, est), '#FFFFFF', sp.apoio)));
    }else if(v.tipo === 'destaque'){
      out.push(bg('fundo-arco-laranja-2'));
      const t0 = _crLinhas(tit, 'body', 1), z = Math.floor(Math.min(110, 1260 * 100 / crMede(t0[0], 'body', 100)));
      if(z < a.heroiMin) est.push(tit);
      out.push(crBloco('titulo', '<rect x="240" y="440" width="1440" height="200" rx="48" fill="#FFFFFF" filter="url(#sh)"/><g id="produto">' + crTexto(960, 540 + z * 0.36, 'body', z, '#F85400', tit, ' text-anchor="middle" data-campo="titulo" data-larg="1260"') + '</g>'));
      out.push(logoB(960 - 140, 900, 280));
    }else if(v.tipo === 'conteudo'){
      if(!sp.apoio && !sp.itens.length) return null;
      out.push(bg('fundo-branco-arco'), logoC(M, 110, 280));
      const t = titulo(M, 300, 820, 260, 110, '#F85400');
      out.push(t.svg, corpo(M, 300 + t.h + 70, 820, '#F85400'));
    }else if(v.tipo === 'mockup'){
      if(!sp.foto) return null;
      // notebook do template; a foto entra na tela (127–974 × 32–560 do PNG de 1100×651)
      const nx = 120, ny = 260, nw = 1000, k = nw / 1100;
      out.push('<rect width="1060" height="' + H + '" fill="#F85400"/>', '<rect x="1060" width="' + (W - 1060) + '" height="' + H + '" fill="#FFFFFF"/>', logoB(120, 100, 260),
        crBloco('foto', crFoto(nx + 127 * k, ny + 32 * k, (974 - 127) * k, (560 - 32) * k, 0, '', sp.foto)),
        crBloco('mockup', '<image href="asset:slides/mockup-notebook.png" x="' + nx + '" y="' + ny + '" width="' + nw + '" height="' + _r(651 * k) + '"/>'));
      const t = titulo(1200, 320, 600, 260, 100, '#F85400');
      out.push(t.svg, corpo(1200, 320 + t.h + 60, 600, '#F85400'));
    }else if(v.tipo === 'cards'){
      if(sp.itens.length < 2) return null;
      out.push(bg('fundo-branco-arco'), logoC(M, 110, 280));
      const t = titulo(M, 250, 1500, 130, 90, '#F85400');
      out.push(t.svg);
      const n = sp.itens.length, gap = 40, cw = (W - 2 * M - gap * (n - 1)) / n, cy = 250 + t.h + 80, chh = 1000 - cy;
      out.push(crBloco('itens', sp.itens.map((it, i) => { const cx = M + i * (cw + gap);
        const ls = _crLinhas(it, 'media', crMede(it, 'media', 50) > cw - 80 ? 2 : 1), zz = Math.min(50, Math.floor((cw - 80) * 100 / Math.max(...ls.map(l => crMede(l, 'media', 100)))));
        return '<rect x="' + _r(cx) + '" y="' + _r(cy) + '" width="' + _r(cw) + '" height="' + _r(chh) + '" rx="36" fill="#FFFFFF" filter="url(#sh)"/>'
          + crTexto(cx + 40, cy + 110, 'hero', 72, '#F85400', String(i + 1)) + '<line x1="' + _r(cx + 40) + '" y1="' + _r(cy + 150) + '" x2="' + _r(cx + cw - 40) + '" y2="' + _r(cy + 150) + '" stroke="#F85400" stroke-width="3"/>'
          + ls.map((l, j) => crTexto(cx + 40, cy + 220 + j * zz * 1.2, 'media', zz, '#F85400', l)).join(''); }).join('')));
    }
    return out;
  },

  // Rodapé de email (peça fixa da marca): sorriso amarelo · redes + @deliverymuchbrasil · ícone do app
  rodape(sp, a, est, fundo){
    const ic = 29, z = 30, txt = 'deliverymuchbrasil', w = ic * 2 + 4 + 14 + crMede(txt, 'media', z), x0 = (a.W - w) / 2, my = a.H / 2;
    const app = fundo === '#FF9000' ? '#F85400' : '#FF9000';
    return ['<path d="M 92 -14 A 88 88 0 0 0 268 -14" fill="none" stroke="#FFB900" stroke-width="48"/>',
      crBloco('redes', '<image href="asset:elementos/icone-tiktok.png" x="' + _r(x0) + '" y="' + _r(my - ic / 2) + '" width="' + ic + '" height="' + ic + '"/>'
        + '<image href="asset:elementos/icone-instagram.png" x="' + _r(x0 + ic + 4) + '" y="' + _r(my - ic / 2) + '" width="' + ic + '" height="' + ic + '"/>'
        + crTexto(x0 + ic * 2 + 18, my + z * 0.36, 'media', z, '#FFFFFF', txt)),
      crBloco('logo', '<rect x="939" y="16" width="89" height="89" rx="14" fill="' + app + '" stroke="#FFFFFF" stroke-width="3"/>'
        + '<image href="asset:logos/dm-vertical-branca.png" x="961" y="34" width="45" height="53"/>')];
  }
};

// O que a peça diz, por objetivo, nas camadas dos formatos deitados: pré-título, herói, complemento,
// valor (preço ou desconto) e as linhas do selo circular
function crChave(sp){
  const off = sp.cupomValor ? (/%$/.test(sp.cupomValor) ? sp.cupomValor + ' OFF' : 'R$ ' + sp.cupomValor + ' OFF') : '';
  const num = sp.cupomValor ? (/%$/.test(sp.cupomValor) ? sp.cupomValor : 'R$' + sp.cupomValor) : '';
  const base = { pre: '', titulo: sp.titulo, campo: 'titulo', comp: sp.apoio, valor: null, selo: sp.selo };
  if(sp.objetivo === 'oferta') return Object.assign(base, { pre: sp.topo, campo: 'produto', valor: sp.precoPor ? { preco: sp.precoPor } : null,
    selo: sp.precoPor && !sp.selo.length ? ['POR', 'R$' + sp.precoPor] : sp.selo });
  // cupom: o código é o herói e o valor vai no complemento/selo (nunca os dois com o mesmo valor)
  if(sp.objetivo === 'cupom') return Object.assign(base, sp.cupomCodigo ? { pre: 'CUPOM', titulo: sp.cupomCodigo, campo: 'codigo_cupom', comp: '', valor: off ? { txt: off } : null }
    : { pre: 'CUPOM', titulo: off || 'CUPOM', comp: '' }, { selo: num && sp.cupomCodigo ? [num, 'OFF'] : [] });
  if(sp.objetivo === 'beneficio') return Object.assign(base, { titulo: [sp.palavra, sp.titulo].filter(Boolean).join(' ').toLocaleUpperCase('pt-BR') });
  if(sp.objetivo === 'aniversario') return Object.assign(base, { pre: sp.topo, titulo: sp.anos + (sp.anos === '1' ? ' ANO' : ' ANOS'), comp: 'NA SUA CIDADE',
    valor: off ? { txt: off } : null, selo: [sp.anos, sp.anos === '1' ? 'ANO' : 'ANOS'] });
  return Object.assign(base, { pre: sp.selo.join(' ') });    // evento: a data vira o pré-título
}
// Pílula de texto centrada em (cx, cy)
function crPilula(cx, cy, txt, cls, z, fundo, cor, rx){
  const w = _r(crMede(txt, cls, z) + z * 1.6), h = _r(z * 1.75);
  return { w, h, svg: '<rect x="' + _r(cx - w / 2) + '" y="' + _r(cy - h / 2) + '" width="' + w + '" height="' + h + '" rx="' + _r(rx) + '" fill="' + fundo + '"/>'
    + crTexto(cx, cy + z * 0.36, cls, z, cor, txt, ' text-anchor="middle"') };
}
// Lista de itens em cards brancos (carrossel): número em Realce + frase, empilhados na caixa
function crItens(x, y, w, h, itens, est){
  const n = itens.length, gap = 28, ch = Math.min(170, (h - gap * (n - 1)) / n);
  return itens.map((t, i) => {
    const yy = y + i * (ch + gap), z = crCabe(t, 'forte', Math.min(46, ch * 0.34), w - 170, 26, est), zn = Math.min(84, ch * 0.62);
    return '<rect x="' + _r(x) + '" y="' + _r(yy) + '" width="' + _r(w) + '" height="' + _r(ch) + '" rx="36" fill="#FFFFFF" filter="url(#shs)"/>'
      + crTexto(x + 48, yy + ch / 2 + zn * 0.36, 'hero', zn, '#F85400', String(i + 1)) + crTexto(x + 130, yy + ch / 2 + z * 0.36, 'forte', z, '#434343', t, ' data-larg="' + _r(w - 170) + '"');
  }).join('');
}
// Inapp: o botão largo da base (824×125, skill §3.5), texto minúsculo de ação
function crBotaoLargo(sp, fundo){
  const txt = (sp.cta || { cupom: 'usar meu cupom', aniversario: 'pegar meu presente' }[sp.objetivo] || 'pedir agora').toLocaleLowerCase('pt-BR');
  const w = 824, h = 125, x = (CR_W - w) / 2, y = 1693, z = crCabe(txt, 'forte', 64, w - 120, 40);
  const [bg, cor] = fundo === '#FF9000' ? ['#F85400', '#FFFFFF'] : ['#FFFFFF', '#F85400'];
  return crBloco('botao', '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="62" fill="' + bg + '" filter="url(#shs)"/>'
    + crTexto(CR_W / 2, y + h / 2 + z * 0.36, 'forte', z, cor, txt, ' text-anchor="middle"'));
}

/* ══════════════════════════════════════════════════════════════
   DIAGRAMAÇÕES — a gramática. Cada uma é uma família aprovada (refino_* e referências) que a pilha
   adapta ao conteúdo. `peso` = curadoria (quanto a família serve ao objetivo); `foto` = exige foto
   (true) ou só sem foto (false). Família nova = uma entrada aqui.
══════════════════════════════════════════════════════════════ */
const _crSemFoto = sp => !sp.foto;
function _crTodos(n){ const o = {}; Object.keys(CR_OBJETIVOS).forEach(k => { o[k] = n; }); return o; }
const CR_RECEITAS = [
  { id: 'cardPreso', nome: 'Card preso à foto', foto: true, peso: { oferta: 10, evento: 4 },
    pilha: { eixo: 'esq', blocos: sp => [{ t: 'logo' }, { t: 'heroi', exige: true }, { t: 'apoio', larg: sp.selo.length ? 660 : CR_L },
      { t: 'foto', exige: true, selo: 'td', card: 'esq' }].concat(sp.precoPor ? [] : [{ t: 'cta' }]).concat([{ t: 'legal' }]) } },
  { id: 'fotoTopo', nome: 'Foto no topo', foto: true, peso: { evento: 10, oferta: 7, beneficio: 6 },
    pilha: { eixo: 'esq', blocos: sp => [{ t: 'foto', exige: true, sangra: 'topo', selo: 'bd' },
      { t: 'heroi', exige: true, estilo: sp.objetivo === 'beneficio' ? 'vazado' : 'realce' },
      sp.precoPor ? { t: 'preco' } : { t: 'apoio' }, { t: 'rodape' }, { t: 'legal' }] } },
  { id: 'fotoBase', nome: 'Foto na base', foto: true, peso: { oferta: 7, evento: 7, beneficio: 5 },
    pilha: { eixo: 'esq', blocos: sp => [{ t: 'logo' }, { t: 'heroi', exige: true, estilo: sp.objetivo === 'beneficio' ? 'vazado' : 'realce' },
      sp.precoPor ? { t: 'preco' } : { t: 'apoio' }, { t: 'cta' }, { t: 'legal' }, { t: 'foto', exige: true, sangra: 'base', selo: 'td' }] } },
  { id: 'duplo', nome: 'Título em dois tamanhos', foto: true, peso: { oferta: 8, evento: 6 },
    pilha: { eixo: 'esq', blocos: sp => [{ t: 'logo' }, { t: 'heroi', exige: true, estilo: 'duplo' }, { t: 'foto', exige: true, selo: 'te', card: 'dir' }]
      .concat(sp.precoPor ? [] : [{ t: 'cta' }]).concat([{ t: 'legal' }]) } },
  { id: 'centro', nome: 'Centralizada', foto: true, peso: { oferta: 5, evento: 6, beneficio: 6 },
    pilha: { eixo: 'centro', blocos: sp => [{ t: 'logo' }, { t: 'heroi', exige: true, estilo: sp.objetivo === 'beneficio' ? 'vazado' : 'realce', k: sp.objetivo === 'beneficio' ? 0.72 : 1 },
      { t: 'foto', exige: true, selo: 'td' }, sp.precoPor ? { t: 'preco', k: 0.85 } : { t: 'apoio' }, { t: 'cta' }, { t: 'legal' }] } },
  // Sem foto: a tipografia é a arte (a entrega é o PNG final — nada de cinza "Use aqui sua foto")
  { id: 'precoHeroi', nome: 'Preço em destaque', foto: false, peso: { oferta: 10 }, serve: sp => !!sp.precoPor,
    pilha: { eixo: 'esq', blocos: [{ t: 'logo' }, { t: 'heroi', exige: true }, { t: 'apoio' }, { t: 'preco', exige: true, k: 1.15 }, { t: 'cta' }, { t: 'legal' }] } },
  { id: 'tipoCentro', nome: 'Tipográfica centralizada', foto: false, peso: { oferta: 6, evento: 8, beneficio: 7 }, fundos: ['#F85400', '#FF9000'],
    pilha: { eixo: 'centro', blocos: sp => [{ t: 'logo' }, { t: 'heroi', exige: true, k: 1.12, estilo: sp.objetivo === 'beneficio' ? 'vazado' : 'realce' },
      { t: 'apoio' }, sp.precoPor ? { t: 'preco' } : { t: 'selo' }, { t: 'cta' }, { t: 'legal' }] } },
  { id: 'tipoDuplo', nome: 'Título gigante', foto: false, peso: { oferta: 7, evento: 9 },
    pilha: { eixo: 'esq', blocos: sp => [{ t: 'heroi', exige: true, estilo: 'duplo', k: 1.15 }, { t: 'apoio' },
      sp.precoPor ? { t: 'preco' } : { t: 'selo' }, { t: 'rodape' }, { t: 'legal' }] } },
  { id: 'vazado', nome: 'Palavra vazada', foto: null, peso: { beneficio: 10 }, serve: sp => !!sp.palavra, fundos: ['#F85400', '#FF9000'],
    pilha: { eixo: 'esq', blocos: sp => [{ t: 'logo' }, { t: 'heroi', exige: true, estilo: 'vazado', k: sp.foto ? 0.78 : 1.1 }, { t: 'apoio' },
      { t: 'foto', selo: 'td' }, { t: 'cta' }, { t: 'legal' }] } },
  { id: 'valor', nome: 'Valor do cupom', foto: null, peso: { cupom: 10 }, padrao: true, lockup: 'valor' },
  { id: 'valorInclinado', nome: 'Cupom inclinado', foto: null, peso: { cupom: 8 }, lockup: 'valor', variante: { inclinar: true } },
  { id: 'aniversario', nome: 'Número de anos', foto: null, peso: { aniversario: 10 }, lockup: 'aniversario' },
  { id: 'aniversarioPattern', nome: 'Anos com grafismo', foto: null, peso: { aniversario: 8 }, padrao: true, lockup: 'aniversario', formatos: ['story', 'inapp'] },
  // Formatos deitados (§3.5): servem a qualquer objetivo — o cadastro do formato decide
  { id: 'capaSticker', nome: 'Adesivo inclinado', foto: null, peso: _crTodos(10), lockup: 'sticker', variante: { inclinar: true }, formatos: ['capa'], fundos: ['#F85400', '#FFB900'] },
  { id: 'capaReta', nome: 'Adesivo reto', foto: null, peso: _crTodos(7), lockup: 'sticker', formatos: ['capa'] },
  { id: 'capaFoto', nome: 'Foto ao lado', foto: true, peso: _crTodos(9), lockup: 'metade', variante: { lado: 'dir' }, formatos: ['capa'] },
  // Slide: layouts do Template de Apresentações 2026
  { id: 'slideCapa', nome: 'Capa do template', foto: null, peso: _crTodos(9), lockup: 'slide', variante: { tipo: 'capa' }, formatos: ['slide'] },
  { id: 'slideConteudo', nome: 'Conteúdo no branco', foto: null, peso: _crTodos(10), lockup: 'slide', variante: { tipo: 'conteudo' }, formatos: ['slide'] },
  { id: 'slideCards', nome: 'Cards de tópicos', foto: null, peso: _crTodos(10), lockup: 'slide', variante: { tipo: 'cards' }, formatos: ['slide'] },
  { id: 'slideMockup', nome: 'Notebook com a foto', foto: true, peso: _crTodos(10), lockup: 'slide', variante: { tipo: 'mockup' }, formatos: ['slide'] },
  { id: 'slideDestaque', nome: 'Título em destaque', foto: null, peso: _crTodos(7), lockup: 'slide', variante: { tipo: 'destaque' }, formatos: ['slide'] },
  { id: 'emailMarca', nome: 'Marca e chamada', foto: null, peso: _crTodos(10), lockup: 'emailMarca', formatos: ['emailTopo'] },
  { id: 'emailFaixa', nome: 'Faixa com logo', foto: null, peso: _crTodos(7), lockup: 'emailFaixa', formatos: ['emailTopo'] },
  { id: 'emailFoto', nome: 'Foto ao lado', foto: true, peso: _crTodos(9), lockup: 'metade', variante: { lado: 'esq' }, formatos: ['emailTopo'] },
  { id: 'bannerSplit', nome: 'Dois tons', foto: null, peso: _crTodos(10), lockup: 'bannerSplit', formatos: ['banner'] },
  { id: 'bannerSelo', nome: 'Selo de valor', foto: null, peso: _crTodos(8), lockup: 'bannerSelo', formatos: ['banner'] },
  { id: 'bannerFoto', nome: 'Foto em cartão', foto: true, peso: _crTodos(9), lockup: 'bannerFoto', formatos: ['banner'] },
  { id: 'carrosselTres', nome: 'Capa, conteúdo e ação', foto: null, peso: _crTodos(9), lockup: 'carrossel', formatos: ['carrossel'] },
  { id: 'rodape', nome: 'Rodapé da marca', foto: null, peso: _crTodos(10), lockup: 'rodape', formatos: ['emailRodape'], fundos: ['#F85400', '#FF9000'] }
];
// Objetivo → receitas que servem (fotos e dados do conteúdo decidem o resto)
const CR_SERVE = { oferta: ['cardPreso', 'fotoTopo', 'fotoBase', 'duplo', 'centro', 'precoHeroi', 'tipoCentro', 'tipoDuplo'],
  evento: ['fotoTopo', 'fotoBase', 'duplo', 'centro', 'cardPreso', 'tipoCentro', 'tipoDuplo'],
  beneficio: ['vazado', 'fotoTopo', 'fotoBase', 'centro', 'tipoCentro'],
  cupom: ['valor', 'valorInclinado'], aniversario: ['aniversario', 'aniversarioPattern'] };

// Completa o que faltou com o padrão das artes aprovadas. Nada aqui inventa preço: sem precoPor,
// não há bloco de preço. Cupom/anos/código têm exemplo claro (o editor troca).
const CR_LEGADO = { destaque: 'beneficio', institucional: 'evento' };
/* Sub-marca much+ (skill §3.5): a peça nasce na paleta DM e é repintada na das referências much+ —
   laranja → rosa #E52676, solar → amarelo #FFB900, logo much+. Só a much+ usa o rosa. */
const _crMarcaDita = t => /much\s*(\+|mais)|muchmais/i.test(String(t || ''));
const CR_MUCH = { '#F85400': '#E52676', '#FF9000': '#FFB900', '#F62900': '#E52676' };
function _crMarca(svg, sp){
  if(!sp || sp.marca !== 'much') return svg;
  return svg.replace(/#(F85400|FF9000|F62900)\b/gi, m => CR_MUCH[m.toUpperCase()]).replace(/asset:logos\/dm-h-branca\.png/g, 'asset:logos/much-plus-branco.png');
}
function crNormaliza(bruto){
  const s = Object.assign({}, bruto || {});
  // Corta na palavra, nunca no meio dela ("ARTESANAL DUP")
  const txt = (v, n) => {
    const t = String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    if(t.length <= n) return t;
    const c = t.slice(0, n + 1), i = c.lastIndexOf(' ');
    return (i > n * 0.5 ? c.slice(0, i) : t.slice(0, n)).trim();
  };
  const up = v => v.toLocaleUpperCase('pt-BR');
  let obj = s.objetivo || s.composicao;
  obj = CR_LEGADO[obj] || obj;
  if(!CR_OBJETIVOS[obj]) obj = 'oferta';
  const out = {
    objetivo: obj,
    formato: CR_FORMATOS[s.formato] ? s.formato : 'feed',
    resumo: txt(s.resumo, 220),
    topo: up(txt(s.topo, 24)),
    titulo: up(txt(s.titulo, 32)),
    palavra: txt(s.palavra, 14).toLocaleLowerCase('pt-BR'),
    apoio: txt(s.apoio, 48),
    selo: (Array.isArray(s.selo) ? s.selo : []).map(v => up(txt(v, 9))).filter(Boolean).slice(0, 2),
    precoDe: txt(s.precoDe, 9).replace(/^R\$\s*/i, ''),
    precoPor: txt(s.precoPor, 9).replace(/^R\$\s*/i, ''),
    cupomValor: txt(s.cupomValor, 5).replace(/^R\$\s*/i, '').replace(/\s*OFF$/i, ''),
    cupomCodigo: up(txt(s.cupomCodigo, 14)).replace(/\s+/g, ''),
    cupomRotulo: up(txt(s.cupomRotulo, 18)),
    anos: txt(s.anos, 2).replace(/\D/g, ''),
    cta: up(txt(s.cta, 14)),
    legal: txt(s.legal, 90),
    // 'slot' = sem foto agora, mas com o espaço (placeholder cinza do contrato g#foto_produto)
    foto: s.foto === 'slot' || /^data:image\/(png|jpeg|webp);base64,/.test(s.foto || '') ? s.foto : '',
    marca: s.marca === 'much' ? 'much' : 'dm',
    chamada: (Array.isArray(s.chamada) ? s.chamada : []).map(l => txt(l, 32)).filter(Boolean).slice(0, 2),
    itens: (Array.isArray(s.itens) ? s.itens : []).map(l => txt(l, 40)).filter(Boolean).slice(0, 4).map(l => l.charAt(0).toLocaleUpperCase('pt-BR') + l.slice(1))
  };
  const P = {
    oferta:      { titulo: 'OFERTA DO DIA', apoio: 'Direto pelo app', cta: 'PEDIR' },
    cupom:       { chamada: ['pega este *cupom*', 'pra você *economizar!*'], cupomRotulo: 'USE O CÓDIGO', cupomCodigo: 'SEUCODIGO', cupomValor: '10' },
    evento:      { titulo: 'FESTIVAL', apoio: 'Direto pelo app', cta: 'VER NO APP' },
    beneficio:   { palavra: 'entrega', titulo: 'GRÁTIS', apoio: 'em pedidos pelo app', cta: 'PEÇA AGORA' },
    aniversario: { topo: 'BORA COMEMORAR!', anos: '3', chamada: ['o aniversário é *nosso,*', 'o presente é *seu!*'], cupomRotulo: 'SEU PRESENTE', cupomCodigo: 'NIVERDM', cupomValor: '15' }
  }[obj];
  Object.keys(P).forEach(k => { if(!out[k] || (Array.isArray(out[k]) && !out[k].length)) out[k] = P[k]; });
  if(out.precoDe && !out.precoPor){ out.precoPor = out.precoDe; out.precoDe = ''; }
  if(obj === 'oferta' && !out.legal && out.precoPor) out.legal = 'Imagem ilustrativa. Oferta válida enquanto durarem os estoques.';
  return out;
}

// Monta UMA diagramação. → {svg, spec, receita, fundo, campos, estouros, w, h} ou null se não cabe.
function crMontar(sp, receita, fundo, p){
  const a = crArea(sp.formato); a.p = p || {};
  const est = [], cor = fundo || '#F85400';
  // Inapp: o botão largo da base é do formato (§3.5) — a pilha não desenha outro
  const spP = a.fmt === 'inapp' ? Object.assign({}, sp, { cta: '' }) : sp;
  let pecas = null;
  if(receita.lockup) pecas = CR_LOCKUPS[receita.lockup](spP, a, est, cor, receita.variante || {});
  else if(!sp.foto){
    // Sem foto, a tipografia é a arte: herói e preço crescem até a pilha encher (teto 1,45×) — o
    // conteúdo não "boia" no meio com faixas laranja vazias em cima e embaixo
    for(const kt of [1.45, 1.35, 1.25, 1.15, 1.05, 1]){
      est.length = 0; a.p = Object.assign({}, p || {}, { kt });
      pecas = crPilha(receita.pilha)(spP, a, est, cor);
      if(pecas && !est.length) break;
    }
  }else pecas = crPilha(receita.pilha)(spP, a, est, cor);
  if(!pecas) return null;
  if(a.fmt === 'inapp') pecas.push(crBotaoLargo(sp, cor));
  // Pattern na regra de inversão (§3 item 9) e ancorado no rodapé; no feed sobe 570 (1920 − 1350)
  const padrao = receita.padrao && a.story && sp.marca !== 'much' ? CR_PATTERN.replace('#FF9000', cor === '#FF9000' ? '#F85400' : '#FF9000').replace('{Y}', String(-720 - (1920 - a.H))) + '\n' : '';
  // Banner do app: o fundo é o card arredondado; em volta, transparente (o app põe o próprio fundo)
  const fundoSvg = a.card ? '<rect data-fundo="1" x="' + a.card[0] + '" y="' + a.card[1] + '" width="' + a.card[2] + '" height="' + a.card[3] + '" rx="' + a.card[4] + '" fill="' + cor + '"/>'
    : '<rect data-fundo="1" width="' + a.W + '" height="' + a.H + '" fill="' + cor + '"/>';
  let svg = '<svg xmlns="http://www.w3.org/2000/svg" data-luma="1" viewBox="0 0 ' + a.W + ' ' + a.H + '" width="' + a.W + '" height="' + a.H + '">'
    + crDefs() + fundoSvg + '\n' + padrao + pecas.filter(Boolean).join('\n') + '\n</svg>';
  svg = _crMarca(svg, sp);
  const campos = [...new Set((svg.match(/data-campo="([^"]+)"/g) || []).map(m => m.slice(12, -1)))];
  if(/id="foto_produto"/.test(svg)) campos.push('foto_produto');
  return { svg, spec: sp, receita: receita.id, nomeReceita: receita.nome, fundo: _crMarca(cor, sp), p: a.p, campos, estouros: est, w: a.W, h: a.H };
}

/* ══════════════════════════════════════════════════════════════
   CONFERÊNCIA GEOMÉTRICA (o lint-art.js da skill, no navegador): o SVG é montado invisível com
   as fontes reais e as caixas dos blocos são medidas. ERRO reprova a diagramação; AVISO tira nota.
══════════════════════════════════════════════════════════════ */
let _crMesa = null;
function _crMede(svgTxt){
  if(!_crMesa){
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:fixed;left:-20000px;top:0;width:1080px;visibility:hidden;pointer-events:none;';
    const raiz = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    const st = document.createElement('style');
    st.textContent = 'svg{display:block}svg .hero{font-family:"LC Realce","Realce",sans-serif}svg .sup,svg .body,svg .legal,svg .leve,svg .forte,svg .media{font-family:"LC Roboto","Roboto",sans-serif}';
    raiz.appendChild(st); document.body.appendChild(host);
    _crMesa = raiz;
  }
  const svg = document.importNode(new DOMParser().parseFromString(svgTxt.replace(/href="data:[^"]*"/g, 'href=""').replace(/asset:[\w./-]+/g, ''), 'image/svg+xml').documentElement, true);
  _crMesa.appendChild(svg);
  const r0 = svg.getBoundingClientRect();
  const rel = r => ({ x0: r.left - r0.left, y0: r.top - r0.top, x1: r.right - r0.left, y1: r.bottom - r0.top });
  if(!_crCtx) _crCtx = document.createElement('canvas').getContext('2d');
  // Caixa de TINTA do texto (como o lint-art.js): a caixa do navegador é a da fonte (sobra acima
  // das maiúsculas e abaixo da linha) e acusaria colisão onde o olho vê 40 px de ar.
  const tinta = (el, txt, fs) => {
    const cs = getComputedStyle(el), r = rel(el.getBoundingClientRect());
    _crCtx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + fs + 'px ' + cs.fontFamily;
    const m = _crCtx.measureText(txt);
    const topo = r.y0 + Math.max(0, m.fontBoundingBoxAscent - m.actualBoundingBoxAscent);
    return { x0: r.x0, x1: r.x1, y0: topo, y1: Math.min(r.y1, topo + m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) };
  };
  const caixaDe = g => {
    const cx = [];
    g.querySelectorAll('rect,circle,ellipse,path,line,polyline,image').forEach(el => {
      if(!el.closest('clipPath,defs,mask')) cx.push(rel(el.getBoundingClientRect()));
    });
    g.querySelectorAll('text').forEach(t => {
      if(t.closest('[transform*="rotate"]') || /rotate/.test(t.getAttribute('transform') || '')){ cx.push(rel(t.getBoundingClientRect())); return; }
      const fs = Math.max(...[t, ...t.querySelectorAll('tspan')].map(n => parseFloat(getComputedStyle(n).fontSize) || 0));
      const linhas = [...t.children].filter(c => c.hasAttribute('y'));
      (linhas.length ? linhas : [t]).forEach(l => cx.push(tinta(l, l.textContent, fs)));
    });
    if(!cx.length) return { x: 0, y: 0, w: 0, h: 0 };
    const x0 = Math.min(...cx.map(c => c.x0)), y0 = Math.min(...cx.map(c => c.y0)), x1 = Math.max(...cx.map(c => c.x1)), y1 = Math.max(...cx.map(c => c.y1));
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  };
  const blocos = [...svg.querySelectorAll(':scope > [data-bloco]')].map(g => {
    // a foto conta pelo retângulo do slot (a imagem dentro pode ser maior que o recorte)
    const fr = g.dataset.bloco === 'foto' && g.querySelector('#foto_produto > rect');
    const c = fr ? (r => ({ x: r.x0, y: r.y0, w: r.x1 - r.x0, h: r.y1 - r.y0 }))(rel(fr.getBoundingClientRect())) : caixaDe(g);
    const fs = [...g.querySelectorAll('[font-size]')].map(t => parseFloat(t.getAttribute('font-size')) || 0);
    return Object.assign(c, { nome: g.dataset.bloco, sobre: !!g.querySelector('[data-sobrepoe]'), maiorFonte: Math.max(0, ...fs), menorFonte: fs.length ? Math.min(...fs) : 0 });
  });
  svg.remove();
  return blocos;
}
function crAvaliar(r){
  const a = crArea(r.spec.formato), sp = r.spec, erros = [], avisos = [];
  // grafismo (decor) é fundo: pode sangrar e passar atrás do texto — fica fora da conferência
  const todos = _crMede(r.svg), bs = todos.filter(b => b.nome !== 'decor');
  const foto = bs.find(b => b.nome === 'foto');
  const solidos = bs.filter(b => b.nome !== 'foto');
  r.estouros.forEach(t => erros.push('Texto longo demais: ' + t));
  (r.faltas || []).forEach(k => erros.push('Faltou o bloco ' + k));
  // grafismo pode sangrar, mas nunca passar atrás de texto (skill §3.1): só da foto ele pode encostar
  todos.filter(b => b.nome === 'decor').forEach(d => bs.forEach(q => {
    if(q.nome === 'foto') return;
    const ix = Math.min(d.x + d.w, q.x + q.w) - Math.max(d.x, q.x), iy = Math.min(d.y + d.h, q.y + q.h) - Math.max(d.y, q.y);
    if(ix > 8 && iy > 8) erros.push('Grafismo atrás de ' + q.nome);
  }));
  solidos.forEach(b => {
    if(a.laminas){
      // carrossel: a margem é a da LÂMINA — texto atravessando a divisa sai cortado em dois posts
      const lam = Math.floor((b.x + b.w / 2) / 1080), x0 = b.x - lam * 1080;
      if(x0 < a.M - 6 || x0 + b.w > 1080 - a.M + 6) erros.push(b.nome + ' fora da margem da lâmina ' + (lam + 1));
    }else if(b.x < a.M - 6 || b.x + b.w > a.W - a.M + 6) erros.push(b.nome + ' fora da margem lateral');
    if(b.y < a.seguroTopo - 2 || b.y + b.h > a.seguroBase + 2) erros.push(b.nome + ' fora da zona útil');
    if(b.menorFonte && b.menorFonte < a.piso) erros.push(b.nome + ' com texto < ' + a.piso + ' px');
  });
  // Colisão: só a lista fechada da §2.2 pode sobrepor a foto (selo na quina, card de preço)
  for(let i = 0; i < bs.length; i++) for(let j = i + 1; j < bs.length; j++){
    const p = bs[i], q = bs[j];
    const ix = Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x), iy = Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y);
    const comFoto = p.nome === 'foto' || q.nome === 'foto', outro = p.nome === 'foto' ? q : p;
    if(comFoto && (outro.nome === 'selo' || (outro.nome === 'preco' && outro.sobre) || (outro.nome === 'botao' && a.fmt === 'inapp') || outro.nome === 'mockup')) continue;   // a moldura do mockup abraça a foto
    if(ix > 0 && iy > 0) erros.push('Colisão: ' + p.nome + ' × ' + q.nome);
    else if(ix > 0 && iy > -24 && !(p.nome === 'titulo' || q.nome === 'titulo')) avisos.push('Vão curto: ' + p.nome + ' × ' + q.nome);
  }
  // Faixa vazia na zona útil (o conteúdo "boiando")
  const ocupado = bs.map(b => [Math.max(a.seguroTopo, b.y), Math.min(a.seguroBase, b.y + b.h)]).filter(v => v[1] > v[0]).sort((u, v) => u[0] - v[0]);
  let cursor = a.seguroTopo, maiorVazio = 0;
  ocupado.forEach(([y0, y1]) => { maiorVazio = Math.max(maiorVazio, y0 - cursor); cursor = Math.max(cursor, y1); });
  maiorVazio = Math.max(maiorVazio, a.seguroBase - cursor);
  if(maiorVazio > 220 && !a.deitado) avisos.push('Faixa vazia de ' + _r(maiorVazio) + ' px');
  // Hierarquia: herói ≥ 2,5× o apoio; herói ≥ 80 (110 sobre #FF9000); preço ≥ 96
  const tit = bs.find(b => b.nome === 'titulo' || b.nome === 'valor' || b.nome === 'anos'), ap = bs.find(b => b.nome === 'apoio');
  const heroi = tit ? tit.maiorFonte : 0;
  if(tit && heroi < (r.fundo === '#FF9000' && !a.deitado ? 110 : a.heroiMin)) erros.push('Herói pequeno (' + heroi + ' px)');
  if(tit && ap && heroi < ap.maiorFonte * 2.5 && a.fmt !== 'slide') avisos.push('Herói menos de 2,5× o apoio');   // slide: escala de apresentação
  const pr = bs.find(b => b.nome === 'preco');
  if(pr && pr.maiorFonte < a.precoMin) erros.push('Preço pequeno (' + pr.maiorFonte + ' px)');
  if(r.fundo === '#FF9000' && !a.deitado && (sp.legal || (pr && !pr.sobre) || (ap && ap.maiorFonte < 36))) erros.push('Fundo #FF9000 com preço, legal ou apoio pequeno direto (contraste)');
  const fracFoto = foto && !a.deitado ? Math.min(foto.h, a.fim - a.top) / (a.fim - a.top) : 0;
  return { erros, avisos, blocos: bs, heroi, preco: pr ? pr.maiorFonte : 0, fracFoto, maiorVazio };
}
// Nota 0–100: curadoria da família + escala do herói/preço + foto na faixa certa + respiro
// Aprende com a escolha: o que a pessoa baixa ou edita ganha peso (neste navegador) — família da
// receita, ou "designer" para as composições da IA. Teto de +10 na nota.
const CR_PREF_CHAVE = 'luma_creative_pref';
function _crPref(){ try{ return JSON.parse(localStorage.getItem(CR_PREF_CHAVE) || '{}') || {}; }catch(e){ return {}; } }
function crAprende(r, como){
  const k = r.desenho ? 'designer' : r.receita, p = _crPref();
  p[k] = Math.min(20, (p[k] || 0) + (como === 'editou' ? 1 : 2));
  try{ localStorage.setItem(CR_PREF_CHAVE, JSON.stringify(p)); }catch(e){}
  if(typeof gTrackEvent === 'function') try{ gTrackEvent('creative_escolha', { como, receita: k, ideia: r.desenho ? r.nomeReceita : '', formato: r.spec.formato, objetivo: r.spec.objetivo, marca: r.spec.marca, juiz: r.juiz ? +r.juiz.nota.toFixed(1) : null }); }catch(e){}
}
function crNota(r, av){
  const a = crArea(r.spec.formato), rec = CR_RECEITAS.find(x => x.id === r.receita) || {};
  const lim = (v, a0, a1) => Math.max(0, Math.min(1, (v - a0) / (a1 - a0)));
  let n = 50 + (r.desenho ? 20 : (rec.peso && rec.peso[r.spec.objetivo] || 0) * 2);   // composição da IA designer vale como família de peso 10
  if(a.deitado){ if(a.heroiMax) n += lim(av.heroi, a.heroiMin, a.heroiMax) * 14; }
  else n += lim(av.heroi, 90, a.story ? 200 : 170) * 14;
  if(r.spec.precoPor && !a.deitado) n += lim(av.preco, 110, a.story ? 200 : 180) * 8;
  if(av.fracFoto) n += Math.max(0, 1 - Math.abs(av.fracFoto - 0.45) / 0.2) * 8;
  n -= Math.min(24, Math.max(0, av.maiorVazio - 140) / 10);
  n -= av.avisos.length * 4;
  n += Math.min(10, _crPref()[r.desenho ? 'designer' : r.receita] || 0);
  return Math.round(Math.max(0, Math.min(100, n)));
}

/* Todas as diagramações que servem ao conteúdo, montadas, conferidas e com nota (melhor primeiro) */
function crCandidatos(bruto, p){
  const sp = crNormaliza(bruto), lista = [], deitado = !!CR_FORMATOS[sp.formato].deitado;
  // Formato deitado: as composições do próprio formato; alto: as que servem ao objetivo
  const ids = deitado ? CR_RECEITAS.filter(x => x.formatos && x.formatos.indexOf(sp.formato) >= 0).map(x => x.id) : (CR_SERVE[sp.objetivo] || []);
  ids.forEach(id => {
    const rec = CR_RECEITAS.find(x => x.id === id);
    if(!rec || (rec.foto === true && !sp.foto) || (rec.foto === false && sp.foto) || (rec.serve && !rec.serve(sp))
      || (rec.formatos && rec.formatos.indexOf(sp.formato) < 0)) return;
    (sp.marca === 'much' ? ['#F85400'] : (rec.fundos || ['#F85400'])).forEach(cor => {
      const r = crMontar(sp, rec, cor, p);
      if(!r) return;
      const av = crAvaliar(r);
      r.avaliacao = av; r.nota = av.erros.length ? 0 : crNota(r, av);
      lista.push(r);
    });
  });
  // Editorial (§4.2 sem IA): 3 composições de designer nos formatos altos — vêm antes das receitas antigas
  if(['feed', 'story', 'inapp'].indexOf(sp.formato) >= 0) [1, 2, 3].forEach(v => {
    const comp = crEditorial(sp, v); if(!comp) return;
    const r = crDesenhar(sp, comp, 20 + v); r.receita = 'editorial' + v; r.avaliacao = crAvaliar(r);
    r.nota = r.avaliacao.erros.length ? 0 : crNota(r, r.avaliacao) + 14;
    lista.push(r);
  });
  return lista.sort((u, v) => v.nota - u.nota);
}
// As 3 melhores APROVADAS, de famílias diferentes; `evitar` = famílias já mostradas
function crEscolher3(cands, evitar){
  const ok = cands.filter(c => !c.avaliacao.erros.length), fora = new Set(evitar || []), out = [], vistas = new Set();
  [ok.filter(c => !fora.has(c.receita)), ok].forEach(grupo => grupo.forEach(c => {
    if(out.length < 3 && !vistas.has(c.receita) && out.indexOf(c) < 0){ out.push(c); vistas.add(c.receita); }
  }));
  ok.forEach(c => { if(out.length < 3 && out.indexOf(c) < 0) out.push(c); });
  return out;
}
// Compatível com o uso antigo: a melhor diagramação aprovada (ou a melhor que existir)
function crCompor(bruto, p){
  const cands = crCandidatos(bruto, p);
  return crEscolher3(cands)[0] || cands[0] || null;
}

/* ══════════════════════════════════════════════════════════════
   DESIGNER — a IA compõe como designer gráfico (skill §4.2): devolve a IDEIA da composição e uma
   CAIXA por bloco (x, y, w, h no canvas) + grafismos do inventário. Ela não desenha nem cria
   asset: crDesenhar encaixa o bloco oficial na caixa (o maior corpo que cabe, nunca abaixo do
   piso) e crAvaliar confere as regras da marca. O que reprova volta para a IA uma vez, com os
   erros, para ela corrigir. Sem IA (ou se nada passar), o motor de receitas segue sozinho.
══════════════════════════════════════════════════════════════ */
// O INVENTÁRIO que a IA designer pode usar — a biblioteca da skill inteira (assets/creative/inv/,
// cópia leve). `max` = largura máxima nítida na arte; `marca` = dm | much | todas (filtra pela peça).
const CR_DECOR = {   // gerado de .agents/skills/luma-creative/assets (cópia leve em assets/creative/inv/)
  'sorriso-arco': { w: 700, h: 593, max: 979, marca: 'dm', tipo: 'grafismo', desc: "arco do sorriso DM laranja solar — grande, sangrando num canto (sobre fundo #F85400)" },
  'explosao': { w: 340, h: 340, max: 475, marca: 'todas', tipo: 'grafismo', desc: "explosão amarela de raios — atrás de selo/valor ou sangrando numa borda" },
  'respingo': { w: 318, h: 307, max: 445, marca: 'dm', tipo: 'grafismo', desc: "respingo amarelo de molho — atrás de logo ou produto" },
  'pattern-macarrao': { w: 700, h: 669, max: 900, marca: 'dm', tipo: 'grafismo', desc: "arcos amarelos soltos (textura) — num canto, nunca atrás de texto" },
  'estrela-amarela': { w: 165, h: 192, max: 200, marca: 'todas', tipo: 'acento', desc: "estrela amarela de 4 pontas — perto do ponto focal" },
  'estrela-branca': { w: 59, h: 58, max: 82, marca: 'todas', tipo: 'acento', desc: "estrela branca pequena" },
  'seta-rabisco': { w: 275, h: 88, max: 380, marca: 'todas', tipo: 'acento', desc: "seta rabiscada branca — aponta para a ação ou para o lado (carrossel)" },
  'mais-amarelo': { w: 600, h: 594, max: 420, marca: 'much', tipo: 'grafismo', desc: "+ amarelo com brilhos rosa — símbolo much+, sangrando num canto" },
  'mais-rosa': { w: 600, h: 594, max: 420, marca: 'much', tipo: 'grafismo', desc: "+ rosa com brilhos — símbolo much+ (sobre fundo claro/amarelo)" },
  'selo-off': { w: 80, h: 59, max: 112, marca: 'dm', tipo: 'sticker', desc: "selo serrilhado amarelo \"off\"" },
  'tag-numero-1': { w: 72, h: 72, max: 100, marca: 'dm', tipo: 'sticker', desc: "etiqueta \"#1\"" },
  'faixa-se-renda': { w: 144, h: 51, max: 201, marca: 'dm', tipo: 'sticker', desc: "faixa amarela \"SE RENDA!\"" },
  'sticker-xis': { w: 600, h: 253, max: 420, marca: 'dm', tipo: 'sticker', desc: "ilustração de xis (sanduíche) com contorno creme" },
  'sticker-maionese': { w: 486, h: 600, max: 380, marca: 'dm', tipo: 'sticker', desc: "ilustração de sachê de maionese" },
  'sticker-chimarrao': { w: 383, h: 600, max: 380, marca: 'dm', tipo: 'sticker', desc: "ilustração de chimarrão" },
  'sticker-mouse': { w: 405, h: 600, max: 380, marca: 'dm', tipo: 'sticker', desc: "ilustração de mouse (mascote)" },
  'sticker-cachorro-bexiga': { w: 600, h: 559, max: 420, marca: 'dm', tipo: 'sticker', desc: "cachorro de bexiga laranja — festa/aniversário" },
  'sticker-balao-15': { w: 522, h: 600, max: 420, marca: 'dm', tipo: 'sticker', desc: "balão \"15\" laranja — só aniversário de 15 anos" },
  'sticker-planetario': { w: 600, h: 312, max: 420, marca: 'dm', tipo: 'sticker', desc: "lettering \"PLANETÁRIO\" — campanha" },
  'sticker-real': { w: 182, h: 196, max: 254, marca: 'todas', tipo: 'sticker', desc: "\"R$\" amarelo inflado — perto de preço/desconto" },
  'sticker-porcento': { w: 136, h: 162, max: 190, marca: 'todas', tipo: 'sticker', desc: "\"%\" amarelo inflado — perto de desconto" },
  'selo-15-anos': { w: 600, h: 284, max: 420, marca: 'dm', tipo: 'sticker', desc: "selo \"15 anos Delivery Much\" laranja — só aniversário de 15 anos" },
  'cupom-laranja': { w: 600, h: 280, max: 520, marca: 'dm', tipo: 'cupom', desc: "ticket laranja vazio com aba \"CUPOM\", inclinado — decorativo" },
  'ingresso-laranja': { w: 240, h: 156, max: 336, marca: 'dm', tipo: 'cupom', desc: "ingresso laranja — evento" },
  'cupom-much': { w: 600, h: 540, max: 420, marca: 'much', tipo: 'cupom', desc: "ticket much+ (borda amarela) — inclinado, rompendo a borda" },
  'cupom-rosa': { w: 600, h: 314, max: 520, marca: 'much', tipo: 'cupom', desc: "ticket rosa vazio — much+" },
  'icone-app-much': { w: 400, h: 400, max: 260, marca: 'much', tipo: 'logo', desc: "ícone do app much+ (quadrado rosa)" },
  'celular-app': { w: 390, h: 700, max: 520, marca: 'todas', tipo: 'mockup', desc: "celular com a tela do app — \"peça pelo app\"" },
  'celular-moldura': { w: 410, h: 700, max: 520, marca: 'todas', tipo: 'mockup', desc: "moldura de celular vazia" },
  'icone-instagram': { w: 29, h: 29, max: 40, marca: 'todas', tipo: 'acento', desc: "ícone do Instagram" },
  // Template de Apresentações 2026 (só em slide)
  'icone-pin': { w: 315, h: 420, max: 300, marca: 'slide', tipo: 'icone', desc: 'ícone branco de localização' },
  'icone-pessoa': { w: 157, h: 420, max: 204, marca: 'slide', tipo: 'icone', desc: 'ícone branco de pessoa' },
  'icone-foguete': { w: 160, h: 160, max: 208, marca: 'slide', tipo: 'icone', desc: 'ícone branco de foguete (lançamento, crescimento)' },
  'icone-engrenagens': { w: 198, h: 158, max: 257, marca: 'slide', tipo: 'icone', desc: 'ícone branco de engrenagens (operação)' },
  'icone-grafico': { w: 160, h: 140, max: 208, marca: 'slide', tipo: 'icone', desc: 'ícone branco de gráfico (resultado)' },
  'icone-prancheta': { w: 121, h: 160, max: 157, marca: 'slide', tipo: 'icone', desc: 'ícone branco de prancheta (lista, tarefas)' },
  'emoji-casa': { w: 153, h: 158, max: 198, marca: 'slide', tipo: 'icone', desc: 'emoji 3D de casa' },
  'emoji-presente': { w: 160, h: 160, max: 208, marca: 'slide', tipo: 'icone', desc: 'emoji 3D de presente' },
  'emoji-estrelas': { w: 160, h: 153, max: 208, marca: 'slide', tipo: 'icone', desc: 'emoji 3D com olhos de estrela' },
  'emoji-coracao': { w: 150, h: 150, max: 195, marca: 'slide', tipo: 'icone', desc: 'emoji 3D de coração laranja' },
  'emoji-festa': { w: 160, h: 160, max: 208, marca: 'slide', tipo: 'icone', desc: 'emoji 3D de festa' },
  'emoji-foguete': { w: 158, h: 151, max: 205, marca: 'slide', tipo: 'icone', desc: 'emoji 3D de foguete' },
  'area-financeiro': { w: 420, h: 284, max: 460, marca: 'slide', tipo: 'sticker', desc: 'adesivo da área financeiro (time interno)' },
  'area-juridico': { w: 420, h: 285, max: 460, marca: 'slide', tipo: 'sticker', desc: 'adesivo da área juridico (time interno)' },
  'area-infraestrutura': { w: 420, h: 219, max: 460, marca: 'slide', tipo: 'sticker', desc: 'adesivo da área infraestrutura (time interno)' },
  'area-implementacao': { w: 420, h: 205, max: 460, marca: 'slide', tipo: 'sticker', desc: 'adesivo da área implementacao (time interno)' },
  'area-novos-negocios': { w: 420, h: 408, max: 460, marca: 'slide', tipo: 'sticker', desc: 'adesivo da área novos negocios (time interno)' },
  'area-marketing': { w: 420, h: 257, max: 460, marca: 'slide', tipo: 'sticker', desc: 'adesivo da área marketing (time interno)' },
  'area-departamento-pessoal': { w: 420, h: 294, max: 460, marca: 'slide', tipo: 'sticker', desc: 'adesivo da área departamento pessoal (time interno)' },
  'area-operacoes': { w: 420, h: 253, max: 460, marca: 'slide', tipo: 'sticker', desc: 'adesivo da área operacoes (time interno)' },
  'area-pessoas': { w: 420, h: 246, max: 460, marca: 'slide', tipo: 'sticker', desc: 'adesivo da área pessoas (time interno)' },
  'area-expansao': { w: 420, h: 266, max: 460, marca: 'slide', tipo: 'sticker', desc: 'adesivo da área expansao (time interno)' },
  'area-tech': { w: 420, h: 358, max: 460, marca: 'slide', tipo: 'sticker', desc: 'adesivo da área tech (time interno)' },
  'icone-tiktok': { w: 29, h: 29, max: 40, marca: 'todas', tipo: 'acento', desc: "ícone do TikTok" }
};
const _crDoInv = (id, sp) => !!CR_DECOR[id] && (CR_DECOR[id].marca === 'slide' ? !!sp && sp.formato === 'slide'
  : CR_DECOR[id].marca === 'todas' || CR_DECOR[id].marca === ((sp && sp.marca) || 'dm'));
// O conteúdo da peça em blocos (o que a IA posiciona) — só os que têm conteúdo
function crConteudoBlocos(sp){
  const b = { logo: 'logo branco Delivery Much' };
  const tit = sp.objetivo === 'beneficio' ? [sp.palavra, sp.titulo].filter(Boolean).join(' ').toLocaleUpperCase('pt-BR')
    : sp.objetivo === 'aniversario' ? sp.anos + (sp.anos === '1' ? ' ANO' : ' ANOS') : sp.objetivo === 'cupom' ? '' : sp.titulo;
  if(tit) b.titulo = tit;
  if(sp.topo && sp.objetivo === 'aniversario') b.tag = sp.topo;
  if(sp.chamada.length && (sp.objetivo === 'cupom' || sp.objetivo === 'aniversario')) b.chamada = sp.chamada.join(' / ');
  if(sp.apoio) b.apoio = sp.apoio;
  if(sp.precoPor) b.preco = (sp.precoDe ? 'DE R$ ' + sp.precoDe + ' ' : '') + 'POR R$ ' + sp.precoPor;
  if(sp.cupomValor && (sp.objetivo === 'cupom' || sp.objetivo === 'aniversario')) b.valor = (/%$/.test(sp.cupomValor) ? sp.cupomValor : 'R$ ' + sp.cupomValor) + ' OFF';
  if(sp.cupomCodigo && (sp.objetivo === 'cupom' || sp.objetivo === 'aniversario')) b.cupom = sp.cupomRotulo + ' ' + sp.cupomCodigo;
  if(sp.selo.length && sp.objetivo !== 'cupom') b.selo = sp.selo.join(' ');
  if(sp.cta) b.cta = sp.cta;
  if(sp.legal) b.legal = sp.legal;
  if(sp.foto) b.foto = sp.foto === 'slot' ? 'ESPAÇO da foto (placeholder cinza que o franqueado preenche): dê a ele tamanho de foto de verdade' : 'foto enviada pela pessoa';
  if(sp.itens.length && (sp.formato === 'carrossel' || sp.formato === 'slide')) b.itens = sp.itens.join(' / ');
  return b;
}
// Quebra equilibrada em n linhas (minimiza a linha mais larga)
function _crLinhas(txt, cls, n){
  const p = String(txt).split(/\s+/).filter(Boolean);
  if(n <= 1 || p.length < 2) return [p.join(' ')];
  let melhor = null;
  const tenta = (resto, k, acc) => {
    if(k === 1){ const l = acc.concat([resto.join(' ')]); const w = Math.max(...l.map(x => crMede(x, cls, 100))); if(!melhor || w < melhor.w) melhor = { l, w }; return; }
    for(let i = 1; i <= resto.length - k + 1; i++) tenta(resto.slice(i), k - 1, acc.concat([resto.slice(0, i).join(' ')]));
  };
  tenta(p, Math.min(n, p.length), []);
  return melhor.l;
}
// Maior corpo de herói (1–3 linhas) que cabe na caixa
function _crHeroiCaixa(txt, w, h, max){
  let best = null;
  for(let n = 1; n <= 3; n++){
    const l = _crLinhas(txt, 'hero', n);
    const s = Math.min(max, h / (0.73 + (l.length - 1) * 0.94), w * 100 / Math.max(...l.map(x => crMede(x, 'hero', 100))));
    if(!best || s > best.size * 1.04) best = { linhas: l, size: Math.floor(s) };
  }
  return best;
}
function crDesenhar(sp, comp, i){
  const a = crArea(sp.formato); a.p = {};
  const est = [], faltas = [], W = a.W, H = a.H;
  const fundo = sp.marca !== 'much' && comp.fundo === '#FF9000' ? '#FF9000' : '#F85400';
  const tem = crConteudoBlocos(sp), n = v => Math.round(+v || 0);
  const campo = sp.objetivo === 'oferta' ? 'produto' : 'titulo';
  const pecas = [], decor = [], vistos = new Set();
  (Array.isArray(comp.grafismos) ? comp.grafismos : []).slice(0, 5).forEach(g => {
    const d = _crDoInv(g && g.asset, sp) && CR_DECOR[g.asset]; if(!d) return;
    const w = Math.max(20, Math.min(d.max, n(g.w) || d.w)), h = Math.round(w * d.h / d.w), x = n(g.x), y = n(g.y), rot = Math.max(-45, Math.min(45, n(g.rot)));
    decor.push(crBloco('decor', '<image href="asset:inv/' + g.asset + '.png" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"'
      + (rot ? ' transform="rotate(' + rot + ' ' + _r(x + w / 2) + ' ' + _r(y + h / 2) + ')"' : '') + '/>'));
  });
  (Array.isArray(comp.blocos) ? comp.blocos : []).forEach(b => {
    const t = b && b.bloco;
    if(!tem[t] || vistos.has(t)) return;
    vistos.add(t);
    const x = n(b.x), y = n(b.y), w = Math.max(40, n(b.w)), h = Math.max(20, n(b.h));
    const al = b.alinhar === 'centro' || b.alinhar === 'dir' ? b.alinhar : 'esq';
    const ax = al === 'centro' ? x + w / 2 : al === 'dir' ? x + w : x, anc = al === 'centro' ? ' text-anchor="middle"' : al === 'dir' ? ' text-anchor="end"' : '';
    const lg = ' data-larg="' + w + '"';
    if(t === 'logo'){
      const lw = Math.min(300, w, h * 4.97), lh = lw / 4.97, lx = al === 'centro' ? x + (w - lw) / 2 : al === 'dir' ? x + w - lw : x;
      pecas.push(crBloco('logo', '<image href="asset:logos/dm-h-branca.png" x="' + _r(lx) + '" y="' + y + '" width="' + _r(lw) + '" height="' + _r(lh) + '"/>'));
    }else if(t === 'titulo'){
      const q = _crHeroiCaixa(tem.titulo, w, h, a.deitado ? a.heroiMax : 560);
      if(q.size < a.heroiMin) est.push(tem.titulo);
      pecas.push(crBloco('titulo', '<g id="produto">' + crHeroi(ax, q.linhas.map((l, k) => y + q.size * 0.73 + k * q.size * 0.94), q.size, '#FFFFFF', q.linhas, anc + ' data-campo="' + campo + '"') + '</g>'));
    }else if(t === 'tag'){
      const z = 40, tw = Math.max(330, _r(crMede(sp.topo, 'hero', z) + 64)), tx = al === 'centro' ? x + (w - tw) / 2 : al === 'dir' ? x + w - tw : x;
      pecas.push(crBloco('tag', '<rect x="' + _r(tx) + '" y="' + y + '" width="' + tw + '" height="70" rx="35" fill="#FFFFFF"/>' + crTexto(tx + tw / 2, y + 49, 'hero', z, '#F85400', sp.topo, ' text-anchor="middle"')));
    }else if(t === 'apoio'){
      const z = crCabe(sp.apoio, 'body', Math.min(56, h / 0.92), w, a.piso, est);
      pecas.push(crBloco('apoio', crTexto(ax, y + z * 0.72, 'body', z, '#FFFFFF', sp.apoio, anc + lg)));
    }else if(t === 'chamada'){
      const ls = sp.chamada, zc = Math.floor(Math.min(84, h / (0.95 + (ls.length - 1) * 1.3), ...ls.map(l => w * 80 / Math.max(1, crMedeMista(l, 80)))));
      if(zc < a.piso) est.push(ls.join(' '));
      pecas.push(crBloco('chamada', ls.map((l, k) => crMista(ax, y + zc * 0.75 + k * zc * 1.3, zc, '#FFFFFF', l, al === 'centro' ? 'middle' : al === 'dir' ? 'end' : '')).join('')));
    }else if(t === 'preco'){
      const de = sp.precoDe ? 61 : 0, pm = crPrecoMede(sp.precoPor, w, Math.min(280, (h - de - 44) / 0.73));
      const x0 = al === 'centro' ? x + (w - pm.w) / 2 : al === 'dir' ? x + w - pm.w : x, top = y + de + 44;
      let s = '<g id="preco">';
      if(sp.precoDe) s += crTexto(al === 'centro' ? x + w / 2 : al === 'dir' ? x + w : x, y + 29, 'body', 40, '#FFFFFF', 'DE R$ ' + sp.precoDe, ' text-decoration="line-through" data-campo="precoDe"' + anc);
      s += crTexto(x0 + 2, top - 18, 'sup', 36, '#FFFFFF', 'POR') + crPreco(x0, top + pm.big * 0.73, sp.precoPor, w, '#FFFFFF', pm.big) + '</g>';
      pecas.push(crBloco('preco', s));
    }else if(t === 'valor'){
      // receita C: R$ a 36% alinhado ao topo · número · coluna OFF / NO SEU / PEDIDO na linha de base
      const pct = /%$/.test(sp.cupomValor), num = sp.cupomValor;
      let zn = Math.min(560, h / 0.73);
      const larg = z => (pct ? 0 : crMede('R$', 'hero', z * 0.36) + z * 0.06) + crMede(num, 'hero', z) + z * 0.1 + Math.max(crMede('OFF', 'forte', z * 0.417), crMede('PEDIDO', 'forte', z * 0.156));
      if(larg(zn) > w) zn = Math.floor(zn * w / larg(zn));
      const B = y + zn * 0.73, tw = larg(zn), x0 = al === 'centro' ? x + (w - tw) / 2 : al === 'dir' ? x + w - tw : x;
      const xn = x0 + (pct ? 0 : crMede('R$', 'hero', zn * 0.36) + zn * 0.06), xo = xn + crMede(num, 'hero', zn) + zn * 0.1;
      pecas.push(crBloco('valor', '<g id="produto">' + (pct ? '' : crTexto(x0, B - zn * 0.458, 'hero', zn * 0.36, '#FFFFFF', 'R$'))
        + crTexto(xn, B, 'hero', zn, '#FFFFFF', num, ' data-campo="desconto_valor"') + crTexto(xo, B - zn * 0.422, 'forte', zn * 0.417, '#FFFFFF', 'OFF')
        + crTexto(xo, B - zn * 0.18, 'forte', zn * 0.156, '#FFFFFF', 'NO SEU') + crTexto(xo, B, 'forte', zn * 0.156, '#FFFFFF', 'PEDIDO') + '</g>'));
    }else if(t === 'cupom'){
      const k = Math.min(1.1, w / 880, h / 324), tx = al === 'centro' ? x + (w - 880 * k) / 2 : al === 'dir' ? x + w - 880 * k : x, cx = tx + 222 * k, cl = 568 * k;
      pecas.push(crBloco('cupom', crTicket(tx, y, k) + '<g id="detalhes">' + crTexto(cx, y + 82 * k, 'sup', Math.max(a.piso, 34 * k), '#434343', sp.cupomRotulo)
        + crTexto(cx, y + 194 * k, 'hero', crCabe(sp.cupomCodigo, 'hero', 116 * k, cl, 48, est), '#F85400', sp.cupomCodigo, ' data-campo="codigo_cupom" data-larg="' + _r(cl) + '"')
        + '<line x1="' + _r(cx) + '" y1="' + _r(y + 222 * k) + '" x2="' + _r(cx + cl) + '" y2="' + _r(y + 222 * k) + '" stroke="#FFB900" stroke-width="3" stroke-linecap="round"/></g>'));
    }else if(t === 'selo'){
      const r = Math.max(90, Math.min(170, Math.min(w, h) / 2));
      pecas.push(crBloco('selo', crSelo(x + w / 2, y + h / 2, r, sp.selo)));
    }else if(t === 'cta'){
      if(a.fmt === 'inapp') return;                    // o botão do inapp é o largo da base (crMontar)
      const est2 = fundo === '#FF9000' ? 'laranja' : (b.estilo === 'contorno' ? 'contorno' : 'cheio');
      pecas.push(crBloco('botao', crBotao(ax, y, sp.cta, est2, al === 'centro' ? 'centro' : al === 'dir' ? 'dir' : '').svg));
    }else if(t === 'legal'){
      const z = crCabe(sp.legal, 'legal', 28, w, Math.max(22, a.piso), est);
      pecas.push(crBloco('legal', crTexto(ax, y + z * 0.72, 'legal', z, '#FFFFFF', sp.legal, anc)));
    }else if(t === 'itens'){
      pecas.push(crBloco('itens', crItens(x, y, w, h, sp.itens, est)));
    }else if(t === 'foto'){
      const sangra = x <= 0 || y <= 0 || x + w >= W || y + h >= H;
      pecas.unshift(crBloco('foto', crFoto(x, y, w, h, sangra ? 0 : 56, '', sp.foto)));
    }
  });
  // todo bloco com conteúdo tem de entrar (o logo e a foto também)
  Object.keys(tem).forEach(k => { if(!vistos.has(k) && !(k === 'cta' && a.fmt === 'inapp')) faltas.push(k); });
  if(a.fmt === 'inapp') pecas.push(crBotaoLargo(sp, fundo));
  let svg = '<svg xmlns="http://www.w3.org/2000/svg" data-luma="1" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">'
    + crDefs() + (a.card ? '<rect data-fundo="1" x="' + a.card[0] + '" y="' + a.card[1] + '" width="' + a.card[2] + '" height="' + a.card[3] + '" rx="' + a.card[4] + '" fill="' + fundo + '"/>'
      : '<rect data-fundo="1" width="' + W + '" height="' + H + '" fill="' + fundo + '"/>') + '\n' + decor.concat(pecas).join('\n') + '\n</svg>';
  svg = _crMarca(svg, sp);
  const campos = [...new Set((svg.match(/data-campo="([^"]+)"/g) || []).map(m => m.slice(12, -1)))];
  if(/id="foto_produto"/.test(svg)) campos.push('foto_produto');
  const ideia = String(comp.ideia || '').trim().slice(0, 90) || 'Composição livre';
  return { svg, spec: sp, receita: 'designer' + (i || 0), nomeReceita: ideia, fundo: _crMarca(fundo, sp), p: {}, campos, estouros: est, faltas, w: W, h: H, desenho: comp };
}
function crPromptDesenho(sp, n, evitar, consertar, img){
  const a = crArea(sp.formato), f = CR_FORMATOS[sp.formato], tem = crConteudoBlocos(sp);
  const zona = a.fmt === 'inapp' ? '140 a 1600 (de 1693 a 1818 fica o botão largo do inapp, fixo — não posicione cta)' : a.seguroTopo + ' a ' + a.seguroBase;
  const alturas = {
    logo: 'w 240–300, h = w ÷ 5', titulo: 'Realce branco; o corpo sai da caixa: h ≈ 0,73×corpo (+0,94×corpo por linha a mais); corpo ' + (a.deitado ? a.heroiMin + '–' + a.heroiMax : '110–520'),
    tag: 'pílula branca h 70, w ≥ 330', chamada: 'frase leve/forte, h ≈ corpo×(0,95 + 1,3 por linha a mais), corpo 56–84', apoio: 'h ≈ 0,92×corpo, corpo 32–56',
    preco: 'h ≈ 0,73×valor + 44 (+61 se tiver DE), valor ≥ ' + a.precoMin, valor: 'número gigante + coluna OFF: h = 0,73×número, número 220–520, w ≈ 1,9×h',
    cupom: 'ticket oficial 880×324 em escala (w/h = 2,72), w 600–880', selo: 'círculo amarelo: w = h, 180–300', cta: 'pílula h 96, w ≥ 320 (estilo cheio ou contorno)',
    legal: 'h 30, letra miúda', itens: 'cards brancos empilhados (um por item), h ≈ 150 por item + 28 de vão', foto: 'retângulo; pode sangrar pelas bordas (x/y negativos ou passando do canvas); 35–55% da altura'
  };
  return [
    'Você é designer gráfico sênior da Delivery Much (app de delivery do interior do Brasil). Componha a arte como um DESIGNER, não como um sistema.',
    'Você NÃO desenha nem cria imagem ou asset: posiciona os BLOCOS oficiais (o Luma desenha cada um dentro da caixa que você der) e pode usar GRAFISMOS do inventário.',
    img && (img.regua || img.ref) ? 'IMAGENS: ' + (img.regua ? 'as ' + img.regua + ' primeiras são a RÉGUA — peças aprovadas da marca: aprenda a linguagem (escala, respiro, acabamento, uso dos assets), NÃO copie a planta' : '')
      + (img.ref ? (img.regua ? '; a última' : 'a imagem') + ' é a REFERÊNCIA que a pessoa mandou — siga a pegada dela (composição, energia), dentro das regras da marca' : '') + '.' : '',
    sp.marca === 'much' ? 'SUB-MARCA MUCH+ (assinatura de cupons): o Luma repinta a peça em rosa #E52676 + amarelo #FFB900 e usa o logo much+ — pense na linguagem das peças much+ (o "+" amarelo, tickets much+ inclinados rompendo a borda, estrelas).' : '',
    'PEÇA: ' + CR_OBJETIVOS[sp.objetivo] + '. FORMATO: ' + f.nome + ' — canvas ' + a.W + '×' + a.H + '.',
    a.laminas ? 'CARROSSEL: ' + a.laminas + ' lâminas de 1080×1350 lado a lado (divisas em x = 1080 e 2160). Cada bloco de texto fica INTEIRO dentro de uma lâmina, com margem de ' + a.M + ' px das bordas DELA (nunca atravessa a divisa). Lâmina 1 = capa (logo + título), 2 = conteúdo (itens/apoio/foto), 3 = ação (preço, valor ou cupom + cta + legal). Grafismos atravessando a divisa amarram as lâminas e convidam a arrastar.' : '',
    'ZONA DO TEXTO (y): ' + zona + '. Margem lateral dos blocos: ' + a.M + ' px' + (a.laminas ? ' de cada lâmina' : ' (x ≥ ' + a.M + ' e x+w ≤ ' + (a.W - a.M) + ')') + '. Grafismos e foto podem sangrar pelas bordas e entrar fora da zona.',
    '', 'BLOCOS (use TODOS, cada um uma vez):', ...Object.keys(tem).map(k => '- ' + k + ': ' + JSON.stringify(tem[k]) + ' — ' + alturas[k]),
    '', 'INVENTÁRIO (grafismos, stickers, cupons e mockups oficiais; 0 a 4 por peça, sempre atrás do texto e nunca cobrindo texto; use pela intenção, não por enfeite):',
    ...Object.keys(CR_DECOR).filter(k => _crDoInv(k, sp)).map(k => '- ' + k + ' [' + CR_DECOR[k].tipo + '] (' + CR_DECOR[k].w + '×' + CR_DECOR[k].h + ', largura até ' + CR_DECOR[k].max + '): ' + CR_DECOR[k].desc),
    '', 'COMO UM DESIGNER COMPÕE (skill luma-creative §4.2):',
    '- Use a zona inteira: o 1º bloco perto do topo da zona, o último perto do fim. Nada de tudo empilhado no meio.',
    '- Proximidade: dentro de um grupo (título+apoio, valor+cupom, cta+legal) 24–48 px; ENTRE grupos ' + (a.story ? '100–140' : a.deitado ? '24–60' : '80–120') + ' px.',
    '- Assimetria por padrão: eixo à esquerda (x = ' + a.M + ', alinhar "esq") e o lado oposto para grafismo/foto sangrando. Centralizado só quando a peça é uma ideia só.',
    '- UM elemento em escala dramática (o ponto focal: preço, valor ou título enorme); o resto menor. Hierarquia é diferença de tamanho.',
    '- Peso nos cantos: grafismos sangrando pelas bordas abrem o centro. Deixe uma área grande de respiro intencional.',
    '- Um eixo de alinhamento por peça. Caixas de texto nunca se sobrepõem; o selo pode prender na quina da foto.',
    '- Fundo: "#F85400" (padrão) ou "#FF9000" (só peça limpa, sem preço nem letra miúda). Texto sempre branco; o Luma cuida das cores dos blocos.',
    n > 1 ? '- As ' + n + ' composições têm IDEIAS DIFERENTES entre si (outra posição do ponto focal, outro eixo, outro grafismo).' : '',
    evitar && evitar.length ? '- Ideias já mostradas (não repita): ' + evitar.join(' | ') : '',
    consertar ? '\nCORRIJA estas composições (mesma ideia, ajuste as caixas) — os erros vieram da conferência da marca:\n' + consertar.map(c => JSON.stringify(c.desenho) + '\nERROS: ' + c.erros.join('; ')).join('\n') : '',
    '', 'Responda SÓ o JSON, ' + n + ' composição(ões): {"composicoes":[{"ideia":"1 frase de até 80 caracteres descrevendo a composição","fundo":"#F85400","blocos":[{"bloco":"titulo","x":0,"y":0,"w":0,"h":0,"alinhar":"esq|centro|dir"}],"grafismos":[{"asset":"","x":0,"y":0,"w":0,"rot":0}]}]}'
  ].filter(l => l !== '').join('\n');
}
// O juiz (diretor de arte) achou a composição da IA fraca: ela refaz com a crítica, uma vez. Só troca se passar.
async function crRefazerDesenhos(lista){
  if(!lista.length) return [];
  const sp = lista[0].r.spec;
  const regua = await crRegua(sp).catch(() => []), parts = regua.map(d => ({ mimeType: 'image/jpeg', data: d }));
  const consertar = lista.map(x => ({ desenho: x.r.desenho, erros: ['diretor de arte: ' + x.critica] }));
  const j = (typeof gAiParseJson === 'function') ? gAiParseJson(await gAskAI('arte.compor', crPromptDesenho(sp, lista.length, [], consertar, { regua: regua.length, ref: 0 }), { json: true, cache: false, parts })) : null;
  const comps = j && Array.isArray(j.composicoes) ? j.composicoes : [];
  return lista.map((x, i) => {
    if(!comps[i]) return x.r;
    const novo = crDesenhar(sp, comps[i], 10 + i); novo.avaliacao = crAvaliar(novo);
    if(novo.avaliacao.erros.length) return x.r;
    novo.nota = crNota(novo, novo.avaliacao); novo.refeito = x.critica; crMetricas.refeitas++;
    return novo;
  });
}
// A IA compõe n opções; as que reprovam voltam 1 vez com os erros. → [r aprovadas, com nota]
// Métricas do designer (por sessão, e no gTrackEvent): quantas pedidas, aprovadas de 1ª, salvas na correção, refeitas pelo juiz
const crMetricas = { pedidas: 0, primeira: 0, corrigidas: 0, refeitas: 0 };
async function crDesenhos(sp, n, evitar, refPessoa){
  if(CR_FORMATOS[sp.formato].fixo || typeof gAskAI !== 'function' || typeof gAiReady !== 'function' || !gAiReady()) return [];
  // O designer VÊ: a régua do formato (linguagem, escala, acabamento) e a referência que a pessoa mandou
  const regua = await crRegua(sp).catch(() => []), m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(refPessoa || ''), ref = m ? [m[2]] : [];
  const parts = regua.map(d => ({ mimeType: 'image/jpeg', data: d })).concat(m ? [{ mimeType: m[1], data: m[2] }] : []);
  const pede = async (qtd, consertar) => {
    const j = (typeof gAiParseJson === 'function') ? gAiParseJson(await gAskAI('arte.compor', crPromptDesenho(sp, qtd, evitar, consertar, { regua: regua.length, ref: ref.length }), { json: true, cache: false, parts })) : null;
    return j && Array.isArray(j.composicoes) ? j.composicoes.slice(0, qtd) : [];
  };
  const monta = (comps, base) => comps.map((c, i) => { const r = crDesenhar(sp, c || {}, base + i); r.avaliacao = crAvaliar(r); return r; });
  let rs = monta(await pede(n), 0);
  crMetricas.pedidas += rs.length;
  const ruins = rs.filter(r => r.avaliacao.erros.length);
  crMetricas.primeira += rs.length - ruins.length;
  if(ruins.length){
    const novos = monta(await pede(ruins.length, ruins.map(r => ({ desenho: r.desenho, erros: r.avaliacao.erros.slice(0, 6) }))), n);
    crMetricas.corrigidas += novos.filter(r => !r.avaliacao.erros.length).length;
    rs = rs.filter(r => !r.avaliacao.erros.length).concat(novos);
  }
  return rs.filter(r => !r.avaliacao.erros.length).map(r => { r.nota = crNota(r, r.avaliacao); return r; });
}

/* ══════════════════════════════════════════════════════════════
   EDITORIAL — o motor compondo como designer (skill §4.2), sem IA: monta as caixas dos blocos
   com a faixa útil inteira, grupos com respiro (perto dentro, longe entre), eixo à esquerda,
   um ponto focal em escala dramática e grafismo sangrando nos cantos livres. Sai no mesmo
   formato da IA designer ({ideia, blocos, grafismos}) e é desenhado por crDesenhar.
   3 variações: âncora (foco à esquerda), contrapeso (foco à direita), apoio no alto.
══════════════════════════════════════════════════════════════ */
function crEditorial(sp, v){
  const a = crArea(sp.formato), tem = crConteudoBlocos(sp), M = a.M, L = a.W - 2 * M;
  const ini = a.fmt === 'feed' ? 90 : a.fmt === 'inapp' ? 150 : 290, fim = a.fmt === 'feed' ? 1265 : a.fmt === 'inapp' ? 1590 : 1650;
  // o ponto focal: preço > anos do aniversário > valor do cupom > título
  const focal = tem.preco ? 'preco' : sp.objetivo === 'aniversario' ? 'titulo' : tem.valor ? 'valor' : 'titulo', dir = v === 2;
  const box = (bloco, w, h, extra) => Object.assign({ bloco, x: M, w, h, alinhar: 'esq' }, extra || {});
  // alturas reais: o texto é medido como o crDesenhar vai desenhar
  const hTit = (txt, w, max) => { const q = _crHeroiCaixa(txt, w, max * 2, max); return Math.ceil(q.size * (0.73 + 0.94 * (q.linhas.length - 1))); };
  const G = [];   // grupos (cada um: lista de caixas empilhadas, vão interno 36)
  G.push([box('logo', 260, 52)]);
  const intro = [];
  if(tem.tag) intro.push(box('tag', 400, 70));
  if(tem.chamada) intro.push(box('chamada', L, Math.ceil(72 * (0.95 + 1.3 * (sp.chamada.length - 1)))));
  if(tem.titulo && focal !== 'titulo') intro.push(box('titulo', L, hTit(tem.titulo, L, a.story ? 150 : 130)));
  if(tem.apoio && focal !== 'titulo') intro.push(box('apoio', L, 48));
  if(intro.length) G.push(intro);
  // o ponto focal, em escala dramática (encolhe se faltar altura)
  const focalBox = k => {
    if(focal === 'preco'){ const big = Math.round((a.story ? 280 : 230) * k), w = tem.selo ? L - 320 : L; return [box('preco', w, Math.ceil((sp.precoDe ? 61 : 0) + 44 + 0.73 * big), dir ? { x: M + L - w, alinhar: 'dir' } : null)].concat(tem.selo ? [box('selo', 290, 290, { x: dir ? M : M + L - 290, lado: true })] : []); }
    if(focal === 'valor') return [box('valor', L, Math.ceil(0.73 * Math.round((a.story ? 440 : 360) * k)), dir ? { alinhar: 'dir' } : null)];
    const tb = [box('titulo', L, hTit(tem.titulo, L, Math.round((a.story ? 230 : 190) * k)), dir ? { alinhar: 'dir' } : null)];
    return tem.apoio ? tb.concat([box('apoio', L, 48, dir ? { alinhar: 'dir' } : null)]) : tb;
  };
  const sup = [];
  if(tem.valor && focal !== 'valor') sup.push(box('valor', L, Math.ceil(0.73 * (a.story ? 220 : 180))));
  if(tem.cupom) sup.push(box('cupom', 880, 324));
  if(tem.selo && focal !== 'preco') sup.push(box('selo', 300, 300, { x: dir ? M : M + L - 300 }));
  if(tem.foto) sup.push(box('foto', L, 0, { flex: true }));
  const acao = [];
  if(tem.cta && a.fmt !== 'inapp') acao.push(box('cta', 360, 96));
  if(tem.legal) acao.push(box('legal', L, 30));
  // ordem dos grupos por variação; mede e distribui pela faixa inteira
  // o foco cresce até encher a faixa (com no mínimo 110 de respiro entre grupos); o que sobrar vira respiro
  // tenta com 110 de respiro entre grupos; se o conteúdo não couber, aceita 80 (piso da §4.2)
  for(const vmin of [110, 80]) for(const k of [1.8, 1.6, 1.45, 1.3, 1.15, 1, 0.9, 0.8, 0.7, 0.62]){
    const F = focalBox(k), ordem = v === 3 ? [G[0], ...(sup.length ? [sup] : []), ...G.slice(1), F, ...(acao.length ? [acao] : [])]
      : [...G, F, ...(sup.length ? [sup] : []), ...(acao.length ? [acao] : [])];
    const altura = g => g.filter(b => !b.lado).reduce((s, b) => s + b.h, 0) + 36 * (g.filter(b => !b.lado).length - 1);
    // a foto (elástica) entra com altura 0 na conta; o que sobrar dá a altura dela
    const fotoG = ordem.find(g => g.some(b => b.flex)), f = fotoG && fotoG.find(b => b.flex);
    if(f) f.h = 0;
    const fixo = ordem.reduce((s, g) => s + altura(g), 0), nv = ordem.length - 1;
    let livre = (fim - ini) - fixo - nv * vmin;
    if(f){ f.h = Math.min(a.story ? 700 : 460, Math.max(0, livre)); if(f.h < (a.story ? 480 : 360)) continue; livre -= f.h; }   // foto de verdade, não uma faixa
    if(livre < 0) continue;
    const vao = vmin + Math.min(a.story ? 150 : 110, livre / Math.max(1, nv));
    let y = ini;
    const blocos = [];
    ordem.forEach((g, gi) => {
      // a ação ancora na base da faixa: o respiro que sobra fica entre o conteúdo e o botão
      if(gi === ordem.length - 1 && g === acao) y = Math.max(y, fim - altura(g));
      let yy = y;
      g.forEach(b => {
        if(b.lado){ blocos.push(Object.assign({}, b, { y: Math.round(y + Math.max(0, (altura(g) - b.h) / 2)) })); return; }
        blocos.push(Object.assign({}, b, { y: Math.round(yy) })); yy += b.h + 36;
      });
      y = yy - 36 + vao;
    });
    // grafismo nos cantos livres: alto à direita (o logo fica à esquerda) e/ou base do lado oposto ao foco
    const much = sp.marca === 'much', g = [];
    const canto = much ? 'mais-amarelo' : (v === 2 ? 'explosao' : 'sorriso-arco');
    if(a.story || a.fmt === 'inapp') g.push({ asset: canto, x: v === 2 ? -160 : 700, y: v === 2 ? 1690 : -210, w: much ? 420 : 560, rot: v === 2 ? 0 : 12 });
    else g.push({ asset: canto, x: 800, y: -190, w: much ? 300 : 380, rot: 10 });
    if(much && tem.cupom) g.push({ asset: 'cupom-much', x: 820, y: (blocos.find(b => b.bloco === 'cupom') || {}).y - 60 || 1200, w: 300, rot: -14 });
    // o maior vão entre grupos (≥ 320) não fica "sobrando": ganha um grafismo grande sangrando pela borda
    // oposta ao eixo — como o designer usaria o vazio, sem passar atrás de texto
    const ord = blocos.slice().sort((p, q) => p.y - q.y);
    let vazio = null;
    for(let i = 1; i < ord.length; i++){
      const topo = Math.max(...ord.slice(0, i).map(b => b.y + b.h)), d = ord[i].y - topo;
      if(d >= 320 && (!vazio || d > vazio.d)) vazio = { d, y: topo };
    }
    if(vazio){
      const id = much ? 'mais-amarelo' : (v === 3 ? 'sorriso-arco' : 'explosao'), D = CR_DECOR[id];
      const h = vazio.d - 90, w = Math.min(D.max, Math.round(h * D.w / D.h));
      const ox = v === 2 ? -Math.round(w * 0.35) : a.W - Math.round(w * 0.65);
      g.push({ asset: id, x: ox, y: Math.round(vazio.y + 45), w, rot: v === 2 ? -8 : 8 });
    }
    const nomes = { 1: 'Âncora à esquerda: ' + (focal === 'titulo' ? 'título' : focal) + ' gigante e grupos com respiro', 2: 'Contrapeso: ' + (focal === 'titulo' ? 'título' : focal) + ' à direita, grafismo na base', 3: 'Apoio no alto, ' + (focal === 'titulo' ? 'título' : focal) + ' gigante no meio' };
    return { ideia: nomes[v], fundo: '#F85400', blocos: blocos.map(b => ({ bloco: b.bloco, x: b.x, y: b.y, w: b.w, h: b.h, alinhar: b.alinhar })), grafismos: g };
  }
  return null;
}

/* Conferência leve da marca, sobre o SVG que saiu (não sobre a intenção) */
function crConfere(r){
  const cores = (r.svg.replace(/href="data:[^"]*"/g, '').match(/#[0-9A-Fa-f]{6}\b/g) || []).map(c => c.toUpperCase());
  const pal = r.spec.marca === 'much' ? CR_PALETA.concat(['#E52676']) : CR_PALETA;
  const fora = [...new Set(cores.filter(c => pal.indexOf(c) < 0))];
  const tams = (r.svg.match(/font-size="(\d+)"/g) || []).map(m => +m.slice(11, -1));
  const menor = Math.min(...tams), piso = crArea(r.spec.formato).piso;
  return [
    { ok: !fora.length, t: fora.length ? 'Cor fora da paleta: ' + fora.join(', ') : 'Paleta oficial, zero subtons' },
    { ok: menor >= piso, t: menor >= piso ? 'Nenhum texto abaixo de ' + piso + ' px' : 'Texto com ' + menor + ' px' },
    { ok: !r.estouros.length, t: r.estouros.length ? 'Texto longo demais: ' + r.estouros[0] : 'Tudo cabe na margem de 100 px' },
    { ok: true, t: 'Realce e Roboto embutidas' }
  ];
}

/* ══════════════════════════════════════════════════════════════
   JUIZ — a revisão comparativa da skill (FASE 5.6) feita pela IA olhando os PRINTS: as 3 opções
   ao lado da régua (artes aprovadas do mesmo objetivo). Devolve nota por critério, um "porquê"
   curto e até 2 ajustes de uma LISTA FECHADA — que o motor aplica e confere de novo. A IA nunca
   mexe no SVG: só aponta, e o código decide se o ajuste passa nas regras.
══════════════════════════════════════════════════════════════ */
const CR_REGUA = {            // as referências que o Ryan subir entram aqui (por objetivo)
  oferta: ['refino_01_oferta_pizza_feed.png', 'refino_08_sextou_burger_story.png'],
  cupom: ['refino_02_cupom_story.png'], evento: ['refino_03_evento_feed.png'],
  beneficio: ['refino_04_entrega_gratis_story.png'], aniversario: ['refino_14_aniversario_franquia_feed.png']
};
// Régua dos formatos de canal (§3.5): peças reais do Ryan, em assets/creative/regua/ (540 px)
const CR_REGUA_FMT = {
  inapp: ['inapp-festival-do-xis.jpg', 'inapp-much-mandou-bem.jpg'], banner: ['banner-promo-turbinada-30.jpg', 'banner-mais-vendidos.jpg'],
  emailTopo: ['cabecalho-burger-fest.jpg', 'cabecalho-dm-produto-700.jpg'], emailRodape: ['rodape-padrao-sorriso.jpg'],
  capa: ['capa-promo-turbinada.jpg', 'capa-cupons-exclusivos.jpg'], slide: ['slide-capa.jpg', 'slide-conteudo.jpg'], carrossel: ['carrossel-dia-do-solteiro.jpg']
};
const CR_AJUSTES = {
  heroiMaior: { p: { kh: 1.12 } }, heroiMenor: { p: { kh: 1 / 1.12 } },
  fotoMaior: { p: { kf: 1.12 } }, fotoMenor: { p: { kf: 1 / 1.12 } },
  semApoio: { sp: { apoio: '' } }, semSelo: { sp: { selo: [] } }
};
const _crRaiz = () => CR_BASE.replace(/assets\/creative\/$/, '');
function _crJpeg(src, larg){
  return new Promise((ok, erro) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas'); c.width = larg; c.height = Math.round(larg * im.naturalHeight / im.naturalWidth);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      ok(c.toDataURL('image/jpeg', 0.8).split(',')[1]);
    };
    im.onerror = erro; im.src = src;
  });
}
async function crArteJpeg(r){
  const svg = await crEmbutir(r.svg), url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try{ return await _crJpeg(url, 432); }finally{ URL.revokeObjectURL(url); }
}
function crPromptJuiz(sp, nRef, n){
  return [
    'Você é diretor de arte sênior da Delivery Much (app de delivery do interior do Brasil). Seja exigente: nota sem régua aprova o mediano.',
    'IMAGENS: ' + (nRef ? 'as ' + nRef + ' primeiras são a RÉGUA (artes aprovadas da marca); ' : '') + 'as ' + n + ' seguintes são as OPÇÕES 1 a ' + n + ', na ordem, da mesma peça.',
    'FORMATO: ' + CR_FORMATOS[sp.formato].nome + ' (' + CR_FORMATOS[sp.formato].desc + ').',
    'PEÇA: ' + CR_OBJETIVOS[sp.objetivo] + ' — ' + [sp.palavra, sp.titulo].filter(Boolean).join(' ') + (sp.precoPor ? ', por R$ ' + sp.precoPor : '') + '.',
    'CONTEXTO FIXO (não critique): paleta fechada (#F85400, #FF9000, #FFB900, #434343, branco), títulos em Realce e textos em Roboto, logo branco, sem imagem gerada por IA, faixas de 250 px vazias no topo e na base do story, transparência em volta do card do banner do app.',
    'Para cada opção: notas 0–5 em foco (um ponto focal claro), hierarquia, respiro, contraste e acabamento; compare com a régua: o que ela tem que a opção não tem?',
    'Teste do celular: a ~360 px de largura, o herói, o preço e o ponto focal se leem de relance?',
    'porque: 1 frase de até 70 caracteres com o ponto forte da opção, para mostrar à pessoa (ex.: "Preço é o ponto focal e a foto ganha espaço").',
    'ajustes: até 2 desta lista fechada, só se fizerem diferença real: heroiMaior, heroiMenor, fotoMaior, fotoMenor, semApoio, semSelo.',
    'critica: a mudança de composição mais importante, concreta e com posição (ex.: "o botão cola no preço: desça o botão 80 px e suba o título"; "tudo empilhado no meio: espalhe pela altura e ancore o valor à esquerda"). "" se a opção já está no nível da régua.',
    'Respiro e composição pesam: tudo agrupado no meio, vãos curtos e iguais entre grupos ou faixas vazias grandes no topo/base = respiro ≤ 2.',
    'Responda SÓ o JSON: {"opcoes":[{"notas":{"foco":0,"hierarquia":0,"respiro":0,"contraste":0,"acabamento":0},"porque":"","critica":"","ajustes":[]}]}'
  ].join('\n');
}
// → [{nota, porque, ajustes}] na ordem das opções, ou null (sem IA, falha, resposta torta)
// A régua da peça (2 artes aprovadas, JPEG 432 px): much+ > formato de canal > objetivo. Juiz e designer usam a mesma.
async function crRegua(sp){
  const fmt = sp.marca === 'much' ? ['much-beneficios-story.jpg', 'much-mandou-bem-inapp.jpg'] : CR_REGUA_FMT[sp.formato];
  const regua = (fmt || CR_REGUA[sp.objetivo] || []).slice(0, 2), pasta = fmt ? CR_BASE + 'regua/' : _crRaiz() + 'assets/templates/refino/prints/';
  return (await Promise.all(regua.map(f => _crJpeg(pasta + f, 432).catch(() => null)))).filter(Boolean);
}
async function crJulgar(tres){
  if(!tres.length || typeof gAskAI !== 'function' || typeof gAiReady !== 'function' || !gAiReady()) return null;
  const sp = tres[0].spec, refs = await crRegua(sp);
  const ops = await Promise.all(tres.map(crArteJpeg));
  const parts = refs.concat(ops).map(d => ({ mimeType: 'image/jpeg', data: d }));
  const j = (typeof gAiParseJson === 'function') ? gAiParseJson(await gAskAI('arte.criticar', crPromptJuiz(sp, refs.length, tres.length), { json: true, cache: false, parts })) : null;
  const lista = j && Array.isArray(j.opcoes) ? j.opcoes : null;
  if(!lista || lista.length < tres.length) return null;
  return tres.map((r, i) => {
    const o = lista[i] || {}, nt = o.notas || {};
    const ks = ['foco', 'hierarquia', 'respiro', 'contraste', 'acabamento'];
    const vals = ks.map(k => Math.max(0, Math.min(5, +nt[k] || 0)));
    return { nota: vals.reduce((a, b) => a + b, 0) / vals.length, piores: Math.min(...vals), notas: ks.map((k, j) => [k, vals[j]]),
      porque: String(o.porque || '').trim().slice(0, 90), critica: String(o.critica || '').trim().slice(0, 200),
      ajustes: (Array.isArray(o.ajustes) ? o.ajustes : []).filter(x => CR_AJUSTES[x]).slice(0, 2) };
  });
}
// Uma rodada de refino: aplica os ajustes do juiz e só fica com o resultado se passar na conferência
function crRefinar(r, ajustes){
  if(!ajustes || !ajustes.length) return r;
  const p = Object.assign({}, r.p), sp = Object.assign({}, r.spec);
  ajustes.forEach(k => { const a = CR_AJUSTES[k]; Object.keys(a.p || {}).forEach(x => { p[x] = (p[x] || 1) * a.p[x]; }); Object.assign(sp, a.sp || {}); });
  const rec = CR_RECEITAS.find(x => x.id === r.receita), novo = rec && crMontar(sp, rec, r.fundo, p);
  if(!novo) return r;
  novo.avaliacao = crAvaliar(novo);
  if(novo.avaliacao.erros.length) return r;
  novo.nota = crNota(novo, novo.avaliacao); novo.ajustado = ajustes;
  return novo;
}

/* Fecha a arte: asset:… vira base64 (SVG como imagem não carrega nada de fora) */
const _crAssetCache = new Map();
function _crAsset(rel){
  if(!_crAssetCache.has(rel)){
    _crAssetCache.set(rel, fetch(CR_BASE + rel).then(r => { if(!r.ok) throw new Error('asset ' + rel); return r.blob(); })
      .then(b => new Promise((ok, erro) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = erro; fr.readAsDataURL(b); }))
      .then(u => u.replace(/^data:[^;,]*/, 'data:' + (/\.woff2$/.test(rel) ? 'font/woff2' : /\.jpe?g$/.test(rel) ? 'image/jpeg' : 'image/png')))
      .catch(e => { _crAssetCache.delete(rel); throw e; }));
  }
  return _crAssetCache.get(rel);
}
async function crEmbutir(svg){
  const rels = [...new Set((svg.match(/asset:[\w./-]+/g) || []).map(m => m.slice(6)))];
  const urls = await Promise.all(rels.map(_crAsset));
  let out = svg;
  rels.forEach((rel, i) => { out = out.split('asset:' + rel).join(urls[i]); });
  return out;
}

/* ══════════════════════════════════════════════════════════════
   LEITURA LOCAL DO PEDIDO (sem IA) — palavras-chave + números que o pedido deu
══════════════════════════════════════════════════════════════ */
// Formato que o próprio pedido diz ("story", "banner", "rodapé do email"…) — '' se não diz.
// A ordem importa: "rodapé de email" antes de "email"; "capa" antes de "feed".
const CR_FORMATO_DITO = [
  ['emailRodape', /\b(rodape|footer)\b/], ['emailTopo', /\b(cabecalho|header|e-?mail|newsletter)\b/],
  ['carrossel', /\b(carross?el|carrocel|laminas?)\b/], ['inapp', /\b(in-?app|pop-?up)\b/], ['banner', /\b(super ?)?banners?\b/], ['capa', /\b(capas?|deskfy|pasta)\b/],
  ['slide', /\b(slides?|apresentacao|deck)\b/], ['story', /\b(story|stories)\b/], ['feed', /\bfeed\b/]
];
function _crFormatoDito(t){
  const n = String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const f = CR_FORMATO_DITO.find(([, re]) => re.test(n));
  return f ? f[0] : '';
}
function crLerPedido(texto, fmt){
  const t = String(texto || ''), n = t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const sp = { formato: _crFormatoDito(t) || fmt || 'feed', marca: _crMarcaDita(t) ? 'much' : 'dm' };
  sp.objetivo = /anivers/.test(n) ? 'aniversario'
    : /cupom|codigo/.test(n) ? 'cupom'
    : /(entrega|frete)\s+gratis|gratis/.test(n) ? 'beneficio'
    : /evento|festival|feira|show|semana d|rodizio/.test(n) ? 'evento' : 'oferta';
  const reais = [...t.matchAll(/R\$\s*(\d+(?:[.,]\d{1,2})?)/gi)].map(m => m[1].replace('.', ','));
  const fmtR = v => /,/.test(v) ? v.replace(/,(\d)$/, ',$10') : v + ',00';
  const minimo = /(?:m[ií]nimo|acima)\s+(?:de\s+)?R\$\s*(\d+)/i.exec(t);
  const semMin = reais.filter(v => !minimo || v.split(',')[0] !== minimo[1]);
  const pct = /(\d{1,2})\s*%/.exec(t);
  const codigo = (t.match(/\b(?=[A-Z0-9]*[A-Z])[A-Z0-9]{5,14}\b/g) || []).find(c => !/^(OFERTA|CUPOM|STORY|FEED)$/.test(c));
  const anos = /(\d{1,2})\s*anos?\b/i.exec(t);
  if(minimo) sp.legal = 'Válido para pedidos acima de R$ ' + minimo[1] + '. Consulte as regras no app.';
  if(sp.objetivo === 'oferta'){
    if(semMin.length >= 2){ const v = semMin.slice(0, 2).sort((a, b) => parseFloat(b.replace(',', '.')) - parseFloat(a.replace(',', '.'))); sp.precoDe = fmtR(v[0]); sp.precoPor = fmtR(v[1]); }
    else if(semMin.length) sp.precoPor = fmtR(semMin[0]);
    if(pct) sp.selo = [pct[1] + '%', 'OFF'];
    // o nome do produto, sem as palavras do formato ("banner do app", "cabeçalho de email"…) nem o "R" de "R$"
    const FMT = 'arte|post|feed|story|stories|banner|super ?banner|in-?app|pop-?up|cabe[çc]alho|rodap[ée]|e-?mail|capa|pasta|deskfy|slide|apresenta[çc][ãa]o|app';
    const limpo = t.replace(new RegExp('^((' + FMT + ')(?=\\s|$)\\s*((de|do|da|para|no|na)\\s+)?)+', 'i'), '');
    const prod = /(?:oferta|promo(?:ção|cao)?|arte|post)?\s*(?:de|do|da)?\s*([^:,.\d$]{3,40})/i.exec(limpo);
    if(prod) sp.titulo = prod[1].split(/\s+(?:para|pra|pro|no|na|neste|nesse|nessa|hoje|amanh[ãa]|esse|este|essa|desta|dessa|com)\b/i)[0]
      .replace(new RegExp('(^|\\s)(oferta|promo(ção|cao)?|de|do|da|por|' + FMT + ')(?=\\s|$)', 'gi'), ' ').replace(/\s+R$/i, '').replace(/\s{2,}/g, ' ').trim();
  }
  if(sp.objetivo === 'cupom' || sp.objetivo === 'aniversario'){
    if(pct) sp.cupomValor = pct[1] + '%'; else if(semMin.length) sp.cupomValor = semMin[0].split(',')[0];
    if(codigo) sp.cupomCodigo = codigo;
  }
  if(anos && sp.objetivo === 'aniversario') sp.anos = anos[1];
  // Lista no pedido (linhas, "•", "-" ou ";") vira os itens da lâmina do meio do carrossel
  const itens = (t.indexOf(':') > 0 ? t.slice(t.indexOf(':') + 1) : t).split(/\n|;|•|\s-\s/).map(x => x.replace(/^[\s\-–*\d.)]+/, '').trim()).filter(x => x.length > 2 && x.length <= 60);
  if(itens.length >= 2) sp.itens = itens.slice(0, 4);
  if(sp.objetivo === 'beneficio' && /frete/.test(n)) sp.palavra = 'frete';
  if(sp.objetivo === 'evento'){
    const ev = /(festival|feira|semana|show|rod[ií]zio)((?:\s+(?!na\b|no\b|em\b|de\b|da\b|do\b|dia\b)[\wÀ-ú]+){0,2})/i.exec(t);
    if(ev) sp.titulo = ev[1] + ev[2];
    const data = /(\d{1,2})\s*(?:a|até)\s*(\d{1,2})\s*de\s*([a-zç]+)/i.exec(t);
    if(data) sp.selo = [data[1] + ' A ' + data[2], data[3]];
  }
  sp.resumo = 'Entendi: ' + CR_OBJETIVOS[sp.objetivo].toLowerCase() + '.';
  return sp;
}

/* ══════════════════════════════════════════════════════════════
   BRIEFING — antes de compor, pergunta só o que muda a arte (como o Claude Code faz)
══════════════════════════════════════════════════════════════ */
const CR_COM_FOTO = { oferta: true, evento: true, beneficio: true };
const _crReal = v => /,/.test(v) ? v.replace(/,(\d)$/, ',$10') : v + ',00';
const _crAspas = s => String(s || '').replace(/"""/g, '"');

// O formato é sempre perguntado pelo Luma (opções = o cadastro CR_FORMATOS), salvo se o pedido já diz
function _crPerguntaFormato(fio){
  if(_crFormatoDito(fio.pedido)) return null;
  return { titulo: 'Formato', pergunta: 'Onde a arte vai ser postada?', campo: 'formato', livre: false,
    opcoes: Object.keys(CR_FORMATOS).map(f => ({ rotulo: CR_FORMATOS[f].nome, desc: CR_FORMATOS[f].desc, valor: f })) };
}
// Sem IA: as perguntas saem do que crLerPedido NÃO achou no pedido. `campo` diz onde a resposta entra.
function crBriefingLocal(fio){
  const sp = crLerPedido(fio.pedido, fio.fmt), c = sp.objetivo, q = [];
  if(c === 'oferta' && !sp.precoPor) q.push({ titulo: 'Preço', pergunta: 'Qual o preço que vai na arte?', campo: 'precoPor', dica: 'Ex.: 22,90 — ou "de 28,00 por 22,90"', opcoes: [{ rotulo: 'Sem preço na arte', valor: '' }] });
  if((c === 'cupom' || c === 'aniversario') && !sp.cupomValor) q.push({ titulo: 'Desconto', pergunta: 'Qual o valor do desconto?', campo: 'cupomValor', dica: 'Ex.: 15 ou 20%', opcoes: [{ rotulo: 'R$ 10' }, { rotulo: 'R$ 15' }, { rotulo: '20%' }] });
  if((c === 'cupom' || c === 'aniversario') && !sp.cupomCodigo) q.push({ titulo: 'Código', pergunta: 'Qual o código do cupom?', campo: 'cupomCodigo', dica: 'Ex.: QUEROPIZZA', opcoes: [] });
  if(c === 'aniversario' && !sp.anos) q.push({ titulo: 'Anos', pergunta: 'Quantos anos a franquia faz na cidade?', campo: 'anos', opcoes: [{ rotulo: '1' }, { rotulo: '2' }, { rotulo: '3' }, { rotulo: '5' }] });
  if(c === 'evento' && !(sp.selo && sp.selo.length)) q.push({ titulo: 'Data', pergunta: 'Quando é o evento?', campo: 'data', dica: 'Ex.: 10 a 20 de outubro', opcoes: [{ rotulo: 'Sem data na arte', valor: '' }] });
  return { resumo: sp.resumo, objetivo: c, perguntas: q.slice(0, 3) };
}
function crPromptBriefing(fio){
  return [
    'Você é o diretor de arte da Delivery Much (app de delivery de cidades do interior do Brasil). A gestão pediu uma arte (post, inapp, banner do app, email, capa ou slide).',
    'ANTES de compor, faça o briefing: entenda o pedido e pergunte SÓ o que muda a arte e o pedido não responde.',
    '', 'PEDIDO: """' + _crAspas(fio.pedido).slice(0, 1200) + '"""',
    'FORMATO MARCADO NA TELA: ' + fio.fmt + '. FOTO ENVIADA: ' + (fio.foto ? 'sim' : 'não') + '.',
    '', 'OBJETIVOS: oferta (produto + preço), cupom (valor + código), evento (data especial na cidade), beneficio (benefício curto, ex. entrega grátis), aniversario (anos da franquia + presente).',
    '', 'REGRAS DAS PERGUNTAS:',
    '- No máximo 3. Se o pedido já basta, "perguntas": [].',
    '- Bons alvos: dado que vai impresso na arte e faltou (preço, valor e código do cupom, data do evento, anos da franquia, pedido mínimo), o foco da peça, o tom da chamada.',
    '- NUNCA pergunte o que o pedido já diz. NUNCA pergunte de cor, fonte ou layout (é regra da marca). NÃO pergunte de foto nem de formato (o Luma pergunta à parte).',
    '- titulo: até 12 caracteres ("Preço", "Formato"). pergunta: frase curta terminada em "?". opcoes: 2 a 4 respostas prováveis e curtas (até 40 caracteres); a pessoa também pode digitar outra.',
    '- NUNCA invente dado como opção (preço, código, data): para esses, ofereça só saídas como "Sem preço na arte" ou "Deixar para o franqueado preencher" — a pessoa digita o valor.',
    '- resumo: 1 frase do que você entendeu (tipo de arte, ponto focal, ação).',
    '', 'Responda SÓ o JSON:',
    '{"resumo":"","objetivo":"oferta|cupom|evento|beneficio|aniversario","perguntas":[{"titulo":"","pergunta":"","opcoes":["",""]}]}'
  ].join('\n');
}
async function crPedirBriefing(fio){
  if(typeof gAskAI !== 'function' || typeof gAiReady !== 'function' || !gAiReady()) return null;
  const j = (typeof gAiParseJson === 'function') ? gAiParseJson(await gAskAI('arte.compor', crPromptBriefing(fio), { json: true, cache: false })) : null;
  const obj = j && (CR_LEGADO[j.objetivo] || j.objetivo);
  if(!j || typeof j !== 'object' || !CR_OBJETIVOS[obj]) return null;
  const t = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  const perguntas = (Array.isArray(j.perguntas) ? j.perguntas : []).map(p => ({
    titulo: t(p && p.titulo, 14) || 'Pergunta', pergunta: t(p && p.pergunta, 140),
    opcoes: (Array.isArray(p && p.opcoes) ? p.opcoes : []).map(o => t(o, 48)).filter(Boolean).slice(0, 4).map(o => ({ rotulo: o }))
  })).filter(p => p.pergunta).slice(0, 3);
  return { resumo: t(j.resumo, 220), objetivo: obj, perguntas };
}
// Formato primeiro (do cadastro), as do briefing, e a da foto quando o objetivo combina com foto.
// Sem foto a arte é tipográfica — a IA NUNCA gera imagem (decisão do Ryan, 14/10).
function crPerguntasFinais(br, fio){
  const f = _crPerguntaFormato(fio);
  if(!f && CR_FORMATOS[fio.fmt].fixo) return [];          // rodapé de email: peça fixa da marca
  const q = (f ? [f] : []).concat(br.perguntas.slice(0, f ? 2 : 3));
  if(CR_COM_FOTO[br.objetivo] && !fio.foto){
    // Sem foto agora, o padrão é DEIXAR O ESPAÇO (placeholder cinza): a arte vira template e o
    // franqueado põe a foto dele. "Só tipografia" é escolha explícita.
    q.push({ tipo: 'foto', titulo: 'Foto', livre: false,
      pergunta: br.objetivo === 'evento' ? 'Tem uma foto do local ou do evento?' : 'Tem a foto do produto?',
      opcoes: [{ rotulo: 'Deixar o espaço da foto', desc: 'placeholder para o franqueado colocar a foto dele', valor: 'slot' },
        { rotulo: 'Sem foto', desc: 'a arte fica só com tipografia', valor: 'nada' }] });
  }
  return q;
}
// Respostas com `campo` entram direto na composição (determinístico, por cima do que a IA devolveu)
function crAplicaRespostas(sp, resp){
  const o = Object.assign({}, sp);
  (resp || []).forEach(r => {
    if(r.pulou || !r.campo) return;
    const v = String(r.valor != null ? r.valor : (r.resposta || '')).trim();
    if(r.campo === 'formato') o.formato = CR_FORMATOS[v] ? v : 'feed';
    else if(r.campo === 'precoPor'){
      const n = (v.match(/\d+(?:[.,]\d{1,2})?/g) || []).map(x => x.replace('.', ','));
      if(n.length >= 2){ const d = n.slice(0, 2).sort((a, b) => parseFloat(b.replace(',', '.')) - parseFloat(a.replace(',', '.'))); o.precoDe = _crReal(d[0]); o.precoPor = _crReal(d[1]); }
      else if(n.length){ o.precoPor = _crReal(n[0]); o.precoDe = ''; }
      else { o.precoPor = ''; o.precoDe = ''; }
    }
    else if(r.campo === 'cupomValor'){ const m = /(\d{1,3})\s*(%)?/.exec(v); if(m) o.cupomValor = m[1] + (m[2] || ''); }
    else if(r.campo === 'cupomCodigo') o.cupomCodigo = v.toUpperCase().replace(/[^A-Z0-9]/g, '');
    else if(r.campo === 'anos'){ const m = /\d{1,2}/.exec(v); if(m) o.anos = m[0]; }
    else if(r.campo === 'data'){
      const d = /(\d{1,2})\s*(?:a|até)\s*(\d{1,2})\s*de\s*([a-zç]+)/i.exec(v), d1 = /(\d{1,2})\s*de\s*([a-zç]+)/i.exec(v);
      o.selo = d ? [d[1] + ' A ' + d[2], d[3]] : d1 ? [d1[1], d1[2]] : v ? v.split(/\s+/).slice(0, 2) : [];
    }
  });
  return o;
}
function _crBriefingTexto(fio){
  return (fio.briefing || []).filter(r => !r.pulou && !r.foto && r.resposta).map(r => '- ' + r.pergunta + ' → ' + r.resposta).join('\n');
}

/* ══════════════════════════════════════════════════════════════
   IA — task `arte.compor` (só gestão também no servidor)
══════════════════════════════════════════════════════════════ */
function crPrompt(fio){
  const br = _crBriefingTexto(fio);
  return [
    'Você é o redator e diretor de arte da Delivery Much (app de delivery de cidades do interior do Brasil). A gestão pediu uma arte (post, inapp, banner do app, email, capa ou slide).',
    'Você NÃO desenha nem escolhe layout: entende a mensagem e escreve a copy. O motor do Luma diagrama com os blocos oficiais e mostra 3 opções.',
    '', 'PEDIDO: """' + _crAspas(fio.pedido).slice(0, 1200) + '"""',
    br ? 'BRIEFING (respostas da pessoa — valem mais que o pedido):\n' + _crAspas(br).slice(0, 800) : '',
    'FORMATO: ' + (CR_FORMATOS[fio.fmt] || CR_FORMATOS.feed).nome + ' (' + (CR_FORMATOS[fio.fmt] || CR_FORMATOS.feed).desc + ')'
      + (CR_FORMATOS[fio.fmt] && CR_FORMATOS[fio.fmt].deitado ? ' — peça deitada e pequena: titulo de até 3 palavras, apoio curto ou vazio, sem legal.' : '') + '. ' + (fio.foto === 'slot' ? 'Vai ter foto (o espaço fica reservado para o franqueado).' : fio.foto ? 'Há foto do produto/local.' : 'Sem foto: a arte é só tipografia — a copy precisa segurar a peça sozinha.'),
    '', 'OBJETIVOS (escolha 1 em "objetivo"): oferta (produto com preço), cupom (valor + código), evento (data especial, festival, novo parceiro), beneficio (benefício curto: entrega grátis, frete), aniversario (anos da franquia).',
    '', 'REGRAS DA COPY (skill luma-creative):',
    '- PT-BR, tom próximo e direto da Delivery Much. Sem emoji, sem hashtag, sem aspas.',
    '- NUNCA invente preço, desconto, código, data ou número de anos que o pedido e o briefing não deram: campo sem informação = "".',
    '- titulo: o herói, até 4 palavras e 22 caracteres, sem ponto final (oferta = nome do produto; evento = nome do evento; beneficio = a palavra vazada, ex. "GRÁTIS"). Ordem que quebra bem em 2 linhas por sentido.',
    '- palavra: só no beneficio, 1 palavra minúscula (ex. "entrega").',
    '- chamada (cupom/aniversário): 2 linhas curtas (até 22 caracteres), frase leve com 1 palavra forte entre *asteriscos*: "pega este *cupom*", "pra você *economizar!*".',
    '- apoio: 1 frase de até 38 caracteres, em caixa normal.',
    '- selo: 1 ou 2 palavras curtas, ex. ["18%","OFF"], ["SÓ","HOJE"], ["10 A 20","OUTUBRO"]; [] se não houver. O % do selo bate com (DE − POR) ÷ DE.',
    '- cta: imperativo curto em maiúsculas, até 12 caracteres (PEDIR, PEDIR AGORA, VER NO APP).',
    '- legal: 1 linha de letra miúda quando houver condição (pedido mínimo, validade); senão "".',
    '- precoDe/precoPor: número com vírgula ("28,00"). cupomValor: só o número ("15") ou com % ("20%"). anos: só o número.',
    '- topo: tag curta do aniversário (ex. "BORA COMEMORAR!").',
    '- itens: SÓ no carrossel e no slide — 3 ou 4 frases curtas (até 40 caracteres): no carrossel, o conteúdo da lâmina do meio; no slide, os tópicos; nos outros formatos [].',
    '- resumo: 1 frase para a gestão: a mensagem, o ponto focal e a ação.',
    '', 'Responda SÓ o JSON:',
    '{"resumo":"","objetivo":"","topo":"","chamada":["",""],"titulo":"","palavra":"","apoio":"","selo":[],"precoDe":"","precoPor":"","cupomValor":"","cupomCodigo":"","cupomRotulo":"","anos":"","cta":"","legal":"","itens":[]}'
  ].filter(l => l !== '').join('\n');
}
async function crPedirComposicao(fio){
  if(typeof gAskAI !== 'function' || typeof gAiReady !== 'function' || !gAiReady()) return null;
  const txt = await gAskAI('arte.compor', crPrompt(fio), { json: true, cache: false });
  const j = (typeof gAiParseJson === 'function') ? gAiParseJson(txt) : null;
  if(!j || typeof j !== 'object') return null;
  j.objetivo = CR_LEGADO[j.objetivo] || j.objetivo;
  return CR_OBJETIVOS[j.objetivo] ? j : null;
}
// Legenda do post: o motor do chat do franqueado (regras de preço, hashtag e SEO já moram lá)
function crLegenda(sp){
  if(typeof fFetchAICaptionSuggestions !== 'function') return Promise.resolve([]);
  const valor = sp.cupomValor ? (/%$/.test(sp.cupomValor) ? sp.cupomValor + ' OFF' : 'R$ ' + sp.cupomValor + ' OFF') : '';
  const dados = {
    produto: (sp.objetivo === 'oferta' || sp.objetivo === 'evento') ? sp.titulo : '',
    precoDe: sp.precoDe ? 'R$ ' + sp.precoDe : '', precoPor: sp.precoPor ? 'R$ ' + sp.precoPor : '',
    desconto: sp.objetivo === 'cupom' || sp.objetivo === 'aniversario' ? valor
      : sp.objetivo === 'beneficio' ? sp.palavra + ' ' + sp.titulo.toLocaleLowerCase('pt-BR') : sp.selo.join(' '),
    cupom: sp.objetivo === 'cupom' || sp.objetivo === 'aniversario' ? sp.cupomCodigo : ''
  };
  const nome = sp.objetivo === 'aniversario' ? 'Aniversário de ' + sp.anos + ' anos da franquia' : 'Delivery Much';
  return fFetchAICaptionSuggestions(dados, { name: nome }, { id: sp.formato }).catch(() => []);
}

/* ══════════════════════════════════════════════════════════════
   CHAT — visual próprio e motion de terminal (spinner, passos, perguntas, digitação)
══════════════════════════════════════════════════════════════ */
// fmt/much = o que o compositor mostra (null = automático: o formato sai do texto do pedido)
const crState = { rodando: null, fios: [], anexo: null, aoFoto: null, fmt: null, much: false };
// ︎ força a apresentação de TEXTO: sem ele o macOS/iOS troca ✳ e ✴ por emoji colorido
const CR_GLIFOS = ['·', '✢', '✳︎', '✶', '✻', '✽', '✻', '✶', '✳︎', '✢'];
const CR_VERBOS = ['Compondo', 'Diagramando', 'Medindo', 'Equilibrando', 'Alinhando', 'Contrastando', 'Lapidando', 'Ajustando o kerning', 'Escolhendo o herói'];
const CR_NOME_BLOCO = { logo: 'Logo', titulo: 'Título', foto: 'Foto', selo: 'Selo', preco: 'Preço', botao: 'Botão', legal: 'Letra miúda',
  chamada: 'Chamada', valor: 'Valor', cupom: 'Cupom', apoio: 'Apoio', tag: 'Tag', anos: 'Anos', decor: 'Grafismo', redes: 'Redes', itens: 'Itens', mockup: 'Mockup' };
const _crReduz = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const _crEsp = ms => new Promise(r => setTimeout(r, _crReduz() ? 0 : ms));
const _crEl = id => document.getElementById(id);
const CR_ICO = {
  faisca: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/></svg>',
  baixar: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/></svg>',
  editar: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 9V5h4M15 5h4v4M19 15v4h-4M9 19H5v-4"/><path d="M9 12h6M12 9v6"/></svg>',
  refazer: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
  copiar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  foto: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/></svg>',
  desfazer: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>',
  lixo: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  menos: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M5 12h14"/></svg>',
  mais: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg>',
  refazerSeta: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/></svg>',
  olho: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  olhoFechado: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a10.6 10.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
  celular: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6.75" y="2" width="10.5" height="20" rx="3"/><path d="M10.5 5.5h3"/></svg>',
  mover: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg>',
  alEsq: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 3v18"/><rect x="8" y="6" width="12" height="4" rx="1"/><rect x="8" y="14" width="7" height="4" rx="1"/></svg>',
  alCentro: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v18"/><rect x="5" y="6" width="14" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/></svg>',
  alDir: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 3v18"/><rect x="4" y="6" width="12" height="4" rx="1"/><rect x="9" y="14" width="7" height="4" rx="1"/></svg>',
  frente: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" fill="currentColor" fill-opacity=".18"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/></svg>',
  tras: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="4" width="12" height="12" rx="2"/><path d="M20 8v10a2 2 0 0 1-2 2H8"/></svg>'
};

// Entrada no modo: revela a view em círculo a partir da aba (o resto é CSS)
function crEntrar(aba){
  const v = _crEl('view-creative');
  if(!v) return;
  if(aba){ const r = aba.getBoundingClientRect(); v.style.setProperty('--cr-ox', Math.round(r.left + r.width / 2) + 'px'); }
  v.classList.remove('cr-revelando', 'cr-itens'); void v.offsetWidth; v.classList.add('cr-revelando', 'cr-itens');
  // Solta o recorte no fim: preso, ele cortava a view ao redimensionar a janela
  // (e a cascata dos itens logo depois, senão a mensagem nova herdaria o atraso da entrada)
  const solta = ev => {
    if(ev.target !== v) return;
    v.classList.remove('cr-revelando'); v.removeEventListener('animationend', solta);
    setTimeout(() => v.classList.remove('cr-itens'), 400);
  };
  v.addEventListener('animationend', solta);
  if(_crReduz()) v.classList.remove('cr-revelando', 'cr-itens');
  setTimeout(() => { const i = _crEl('cr-pedido'); if(i && window.innerWidth > 760) i.focus({ preventScroll: true }); }, 380);
  crFontesProntas().catch(() => {});
}
function _crMsgIA(conv){
  const m = document.createElement('div');
  m.className = 'cr-msg cr-entra';
  m.innerHTML = '<div class="cr-ava cr-ava-ia" aria-hidden="true">' + CR_ICO.faisca + '</div><div class="cr-corpo"><div class="cr-bolha"></div></div>';
  conv.appendChild(m);
  _crRola(true);
  return m;
}
// Rolagem automática é interrupção, não ajuda (motion.md §4): só desce se a pessoa já estava no fim.
// Quem subiu para reler a diagramação não é arrastado de volta a cada passo novo.
function _crRola(forca){
  const p = _crEl('cr-palco'); if(!p) return;
  const noFim = p.scrollHeight - p.scrollTop - p.clientHeight < 140;
  if(forca || noFim) requestAnimationFrame(() => p.scrollTo({ top: p.scrollHeight, behavior: _crReduz() ? 'auto' : 'smooth' }));
}
// Texto chegando como digitado, com cursor (pula a animação com reduced-motion)
function _crDigita(el, texto){
  return new Promise(res => {
    if(_crReduz()){ el.textContent = texto; return res(); }
    el.textContent = '';
    const alvo = document.createElement('span'), cursor = document.createElement('span');
    cursor.className = 'cr-cursor'; el.append(alvo, cursor);
    let i = 0;
    (function passo(){
      i = Math.min(texto.length, i + 1 + Math.floor(Math.random() * 3));
      alvo.textContent = texto.slice(0, i);
      if(i < texto.length) setTimeout(passo, 14 + Math.random() * 22);
      else setTimeout(() => { cursor.remove(); res(); }, 420);
    })();
  });
}

// Linha de status do terminal: glifo girando + verbo com brilho + tempo decorrido
function _crStatus(host){
  const el = document.createElement('div');
  el.className = 'cr-status';
  el.innerHTML = '<span class="cr-glifo" aria-hidden="true">✻︎</span><span class="cr-verbo">Compondo…</span><span class="cr-tempo">0s</span><span class="cr-esc"><kbd>esc</kbd> interrompe</span>';
  host.appendChild(el);
  const g = el.querySelector('.cr-glifo'), v = el.querySelector('.cr-verbo'), tm = el.querySelector('.cr-tempo');
  const t0 = Date.now(); let f = 0, k = 0, parado = false;
  const giro = setInterval(() => { g.textContent = CR_GLIFOS[f++ % CR_GLIFOS.length]; }, 120);
  const relogio = setInterval(() => { tm.textContent = Math.floor((Date.now() - t0) / 1000) + 's'; }, 1000);
  const troca = setInterval(() => {
    v.classList.add('cr-sai');
    setTimeout(() => { v.textContent = CR_VERBOS[++k % CR_VERBOS.length] + '…'; v.classList.remove('cr-sai'); }, 180);
  }, 2600);
  return { parar(){ if(parado) return; parado = true; clearInterval(giro); clearInterval(relogio); clearInterval(troca); el.classList.add('cr-some'); setTimeout(() => el.remove(), 260); } };
}
// Passo no formato de chamada de ferramenta: ⏺ título · ⎿ resultado
function _crPasso(lista, titulo){
  const li = document.createElement('li');
  li.className = 'cr-passo cr-agora';
  li.innerHTML = '<div class="cr-passo-cab"><span class="cr-bola" aria-hidden="true"></span><span class="cr-passo-tit"></span><small class="cr-passo-t"></small></div><div class="cr-passo-res" hidden><span class="cr-elo" aria-hidden="true"></span><span class="cr-passo-txt"></span></div>';
  li.querySelector('.cr-passo-tit').textContent = titulo;
  lista.appendChild(li);
  const t0 = Date.now();
  _crRola();
  return {
    feito(res, erro){
      li.classList.remove('cr-agora'); li.classList.add(erro ? 'cr-erro' : 'cr-feito');
      const s = (Date.now() - t0) / 1000;
      li.querySelector('.cr-passo-t').textContent = s < 0.1 ? '' : s.toFixed(1).replace('.', ',') + ' s';
      if(res){ const r = li.querySelector('.cr-passo-res'); r.querySelector('.cr-passo-txt').textContent = res; r.hidden = false; }
    }
  };
}

/* Pergunta do briefing no jeito do Claude Code: opções numeradas, ↑↓ + Enter, atalho 1–N,
   "Outra resposta" digitável e Pular. Uma por vez. Resolve com as respostas, ou null se interrompido. */
function _crPerguntar(corpo, perguntas, run){
  return new Promise(resolve => {
    const box = document.createElement('div');
    box.className = 'cr-pergunta cr-entra'; box.tabIndex = -1;
    corpo.appendChild(box);
    const resp = []; let i = 0, sel = 0, encerrou = false;
    const fecha = val => {
      if(encerrou) return; encerrou = true; run.cancelar = null; crState.aoFoto = null;
      box.classList.add('cr-some'); setTimeout(() => box.remove(), 240); resolve(val);
    };
    run.cancelar = () => fecha(null);
    const itens = () => [...box.querySelectorAll('.cr-q-op')];
    const responde = r => {
      const q = perguntas[i];
      resp.push(Object.assign({ titulo: q.titulo, pergunta: q.pergunta, campo: q.campo || '' }, r));
      if(++i < perguntas.length) desenha(); else fecha(resp);
    };
    const recebeFoto = file => crFotoLer(file).then(u => responde({ resposta: 'foto enviada', foto: u }))
      .catch(() => gToast('Não consegui ler essa imagem', 'error'));
    const escolherArquivo = () => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
      inp.onchange = () => { if(inp.files && inp.files[0]) recebeFoto(inp.files[0]); };
      inp.click();
    };
    const marca = k => {
      const its = itens(); if(!its.length) return;
      sel = (k + its.length) % its.length;
      its.forEach((li, j) => { li.classList.toggle('on', j === sel); li.setAttribute('aria-selected', j === sel ? 'true' : 'false'); });
      const inp = its[sel].querySelector('input');
      if(inp) inp.focus({ preventScroll: true }); else box.focus({ preventScroll: true });
    };
    const escolhe = k => {
      const li = itens()[k]; if(!li) return;
      if(li.dataset.tipo === 'outro'){
        const v = li.querySelector('input').value.trim();
        return v ? responde({ resposta: v, valor: v }) : marca(k);
      }
      if(li.dataset.tipo === 'upload') return escolherArquivo();
      const o = perguntas[i].opcoes[+li.dataset.k];
      responde({ resposta: o.rotulo, valor: o.valor != null ? o.valor : o.rotulo });
    };
    const op = (tipo, k, rot, desc, n) => '<li class="cr-q-op" role="option" data-tipo="' + tipo + '" data-k="' + k + '"><span class="cr-q-seta" aria-hidden="true">❯</span><span class="cr-q-n">' + n + '.</span><span class="cr-q-rot">' + rot + (desc ? '<small>' + gEsc(desc) + '</small>' : '') + '</span></li>';
    function desenha(){
      const q = perguntas[i];
      crState.aoFoto = q.tipo === 'foto' ? recebeFoto : null;
      let ops = '', n = 0;
      if(q.tipo === 'foto') ops += op('upload', '', '<span class="cr-q-l">' + CR_ICO.foto + 'Enviar a foto</span>', 'arraste aqui, cole ou escolha o arquivo', ++n);
      q.opcoes.forEach((o, k) => { ops += op('opcao', k, gEsc(o.rotulo), o.desc, ++n); });
      if(q.livre !== false) ops += '<li class="cr-q-op" role="option" data-tipo="outro"><span class="cr-q-seta" aria-hidden="true">❯</span><span class="cr-q-n">' + (++n) + '.</span><input type="text" maxlength="80" placeholder="' + gEsc(q.dica || 'Outra resposta…') + '" aria-label="Outra resposta"></li>';
      box.innerHTML = '<div class="cr-q-topo"><span class="cr-q-chip">' + gEsc(q.titulo) + '</span>' + (perguntas.length > 1 ? '<span class="cr-q-prog" aria-label="Pergunta ' + (i + 1) + ' de ' + perguntas.length + '">' + perguntas.map((_, k) => '<i class="' + (k < i ? 'feita' : k === i ? 'agora' : '') + '"></i>').join('') + '</span>' : '') + '</div>'
        + '<p class="cr-q-txt">' + gEsc(q.pergunta) + '</p><ol class="cr-q-ops" role="listbox" aria-label="' + gEsc(q.pergunta) + '">' + ops + '</ol>'
        + '<div class="cr-q-rodape"><span><kbd>↑</kbd><kbd>↓</kbd> navega <kbd>↵</kbd> escolhe <kbd>1</kbd>–<kbd>' + n + '</kbd> atalho <kbd>esc</kbd> interrompe</span><button type="button" class="cr-q-pular">Pular</button></div>';
      box.classList.toggle('cr-q-foto', q.tipo === 'foto');
      box.classList.remove('cr-q-troca'); void box.offsetWidth; box.classList.add('cr-q-troca');
      marca(0); _crRola();
    }
    box.addEventListener('keydown', e => {
      const emInput = e.target.tagName === 'INPUT';
      if(e.key === 'ArrowDown'){ e.preventDefault(); marca(sel + 1); }
      else if(e.key === 'ArrowUp'){ e.preventDefault(); marca(sel - 1); }
      else if(e.key === 'Enter'){ e.preventDefault(); escolhe(sel); }
      else if(!emInput && /^[1-9]$/.test(e.key) && +e.key <= itens().length){ e.preventDefault(); marca(+e.key - 1); escolhe(+e.key - 1); }
    });
    box.addEventListener('click', e => {
      if(e.target.closest('.cr-q-pular')) return responde({ resposta: 'pulou', pulou: true });
      const li = e.target.closest('.cr-q-op'); if(!li) return;
      const k = itens().indexOf(li);
      if(li.dataset.tipo === 'outro') return marca(k);
      escolhe(k);
    });
    desenha();
  });
}

/* ── Foto: anexo no pedido (clipe, colar, arrastar) ou resposta à pergunta ── */
// Reduz para 1600 px no lado maior (JPEG): a foto vai embutida no SVG e no template.
async function crFotoLer(file){
  if(!file || !/^image\//.test(file.type)) throw new Error('não é imagem');
  const url = URL.createObjectURL(file);
  try{
    const im = new Image(); im.src = url; await im.decode();
    const k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.86);
  }finally{ URL.revokeObjectURL(url); }
}
function crAnexar(file){
  if(crState.aoFoto) return crState.aoFoto(file);
  crFotoLer(file).then(u => { crState.anexo = u; _crMostraAnexo(file.name || 'foto'); })
    .catch(() => gToast('Não consegui ler essa imagem', 'error'));
}
function crEscolherFoto(){
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => { if(inp.files && inp.files[0]) crAnexar(inp.files[0]); };
  inp.click();
}
function crTirarAnexo(){ crState.anexo = null; _crMostraAnexo(''); }
function _crMostraAnexo(nome){
  const a = _crEl('cr-anexo'); if(!a) return;
  a.hidden = !crState.anexo;
  if(crState.anexo){ a.querySelector('img').src = crState.anexo; a.querySelector('span').textContent = nome; }
}
function crColar(e){
  const f = [...((e.clipboardData && e.clipboardData.files) || [])].find(x => /^image\//.test(x.type));
  if(f){ e.preventDefault(); crAnexar(f); }
}
// Arrastar foto: a tela ganha o véu "Solte a foto aqui" (o dragleave dispara a cada filho cruzado,
// por isso o contador em vez de um liga/desliga)
let _crArrasto = 0;
const _crSolta = on => { const v = _crEl('view-creative'); if(v) v.classList.toggle('cr-arrastando', on); };
const _crNoCreative = () => document.body.classList.contains('mode-creative');
const _crTemArquivo = e => !!(e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files'));
document.addEventListener('dragenter', e => { if(_crNoCreative() && _crTemArquivo(e)){ _crArrasto++; _crSolta(true); } });
document.addEventListener('dragleave', e => { if(_crNoCreative() && _crTemArquivo(e) && --_crArrasto <= 0){ _crArrasto = 0; _crSolta(false); } });
document.addEventListener('dragover', e => { if(_crNoCreative()) e.preventDefault(); });
document.addEventListener('drop', e => {
  if(!_crNoCreative()) return;
  e.preventDefault(); _crArrasto = 0; _crSolta(false);
  const f = [...((e.dataTransfer && e.dataTransfer.files) || [])].find(x => /^image\//.test(x.type));
  if(f) crAnexar(f);
});

function crAutoAltura(el){ el.style.height = 'auto'; el.style.height = Math.min(160, el.scrollHeight) + 'px'; _crPodeEnviar(); }
// Enter só envia com texto — e só quando NÃO está rodando (parar é o botão, nunca a tecla de enviar)
function crTecla(e){
  if(e.key === 'Enter' && !e.shiftKey && !e.isComposing){ e.preventDefault(); if(!crState.rodando) crEnviar(); }
}
// O botão de enviar só acende quando há o que enviar (ou quando é "parar")
function _crPodeEnviar(){
  const i = _crEl('cr-pedido'), b = document.querySelector('#view-creative .cr-enviar');
  if(b) b.classList.toggle('cr-pronto', !!(i && i.value.trim()));
}
// "ocupado" liga o fio de progresso, a borda giratória do campo e transforma enviar em parar
function _crOcupado(on){
  document.body.classList.toggle('cr-ocupado', on);
  const b = document.querySelector('#view-creative .cr-enviar');
  if(b) b.setAttribute('aria-label', on ? 'Interromper' : 'Gerar arte');
}
function crParar(){
  const r = crState.rodando;
  if(r){ r.parado = true; if(r.cancelar) r.cancelar(); }
}
document.addEventListener('keydown', e => {
  if(e.key === 'Escape' && crState.rodando && _crNoCreative()) crParar();
});

/* ── Compositor: formato (menu), Much+ (liga/desliga) e "ideias de partida" ── */
function _crRotuloFmt(){
  const f = CR_FORMATOS[crState.fmt];
  const r = _crEl('cr-fmt-rot'); if(r) r.textContent = f ? f.nome : 'Formato: automático';
  const b = _crEl('cr-fmt-btn'); if(b) b.classList.toggle('cr-pill-on', !!f);
}
function _crMenuFmt(abrir){
  const m = _crEl('cr-fmt-menu'), b = _crEl('cr-fmt-btn'); if(!m || !b) return;
  if(abrir === undefined) abrir = m.hidden;
  if(abrir && !m.children.length){
    m.innerHTML = [['', 'Automático', 'Eu leio o formato do seu pedido']].concat(Object.keys(CR_FORMATOS).map(k => [k, CR_FORMATOS[k].nome, CR_FORMATOS[k].desc]))
      .map((o, i) => '<li role="option" tabindex="-1" data-fmt="' + o[0] + '" style="--i:' + i + '"><b>' + gEsc(o[1]) + '</b><small>' + gEsc(o[2]) + '</small></li>').join('');
  }
  if(abrir){
    [...m.children].forEach(li => li.setAttribute('aria-selected', String(li.dataset.fmt === (crState.fmt || ''))));
    m.hidden = false; void m.offsetWidth; m.classList.add('aberto');
    const li = m.querySelector('[aria-selected="true"]') || m.firstElementChild; if(li) li.focus({ preventScroll: true });
  }else{
    m.classList.remove('aberto');
    setTimeout(() => { if(!m.classList.contains('aberto')) m.hidden = true; }, _crReduz() ? 0 : 160);
  }
  b.setAttribute('aria-expanded', String(abrir));
}
function crEscolheFormato(k){
  crState.fmt = CR_FORMATOS[k] ? k : null;
  _crRotuloFmt(); _crMenuFmt(false);
  const b = _crEl('cr-fmt-btn'); if(b) b.focus({ preventScroll: true });
}
// Ligar Much+ re-tokeniza a tela inteira (CSS: #view-creative.cr-much). Com View Transitions o
// navegador faz o cross-fade do antes/depois sozinho; sem elas a troca é seca, e tudo funciona igual.
function crLigaMuch(on){
  const v = on === undefined ? !crState.much : !!on;
  if(v === crState.much) return;
  crState.much = v;
  const aplica = () => {
    const b = _crEl('cr-much'); if(b) b.setAttribute('aria-pressed', String(v));
    const vw = _crEl('view-creative'); if(vw) vw.classList.toggle('cr-much', v);
  };
  if(document.startViewTransition && !_crReduz()) document.startViewTransition(aplica); else aplica();
}
// Ponto de partida: preenche o pedido, ajusta formato/marca e deixa o texto selecionado
// (digitar substitui; Enter roda como está). Nada dispara sozinho.
function crIdeia(btn){
  const i = _crEl('cr-pedido'); if(!i || crState.rodando) return;
  i.value = btn.dataset.ideia || '';
  crState.fmt = CR_FORMATOS[btn.dataset.fmt] && btn.dataset.fmt !== 'feed' ? btn.dataset.fmt : null;
  _crRotuloFmt(); crLigaMuch(btn.dataset.marca === 'much');
  crAutoAltura(i); i.focus(); i.select();
}
document.addEventListener('click', e => {
  if(!_crNoCreative()) return;
  const ideia = e.target.closest('.cr-ideia'); if(ideia) return crIdeia(ideia);
  if(e.target.closest('#cr-fmt-btn')) return _crMenuFmt();
  const op = e.target.closest('#cr-fmt-menu [data-fmt]'); if(op) return crEscolheFormato(op.dataset.fmt);
  if(e.target.closest('#cr-much')) return crLigaMuch();
  if(!e.target.closest('.cr-menu-host')) _crMenuFmt(false);
});
document.addEventListener('keydown', e => {
  const m = _crEl('cr-fmt-menu'); if(!m || m.hidden || !_crNoCreative()) return;
  const li = [...m.children], k = li.indexOf(document.activeElement);
  if(e.key === 'ArrowDown'){ e.preventDefault(); li[(k + 1) % li.length].focus(); }
  else if(e.key === 'ArrowUp'){ e.preventDefault(); li[(k - 1 + li.length) % li.length].focus(); }
  else if(e.key === 'Enter' || e.key === ' '){ if(k >= 0){ e.preventDefault(); crEscolheFormato(li[k].dataset.fmt); } }
  else if(e.key === 'Escape' || e.key === 'Tab'){ _crMenuFmt(false); if(e.key === 'Escape'){ e.stopPropagation(); const b = _crEl('cr-fmt-btn'); if(b) b.focus({ preventScroll: true }); } }
}, true);
// Barra do topo ganha a linha (e o vidro) só quando há conteúdo passando por baixo dela
(function(){
  const p = _crEl('cr-palco'); if(!p) return;
  p.addEventListener('scroll', () => { const v = _crEl('view-creative'); if(v) v.classList.toggle('cr-rolou', p.scrollTop > 8); }, { passive: true });
})();

function crEnviar(e){
  if(e && e.preventDefault) e.preventDefault();
  // o botão vira "parar" durante a geração; Enter nunca chega aqui nesse estado (crTecla)
  if(crState.rodando){ if(e && e.type === 'submit') crParar(); return; }
  const inp = _crEl('cr-pedido'), conv = _crEl('cr-conversa');
  const pedido = String((inp && inp.value) || '').trim();
  if(!pedido || !conv) return;
  _crMenuFmt(false);
  // Imagem anexada com "referência / nessa pegada / parecido" é REFERÊNCIA para o designer, não a foto da arte
  const ehRef = !!crState.anexo && /refer[eê]ncia|pegada|parecid|inspira|nesse estilo|nesse jeito/i.test(pedido);
  // O que a pessoa ESCREVEU vence o compositor: "story" no texto ganha do formato marcado no menu
  const fio = { pedido, fmt: _crFormatoDito(pedido) || crState.fmt || 'feed', marca: _crMarcaDita(pedido) || crState.much ? 'much' : 'dm', foto: ehRef ? null : crState.anexo, ref: ehRef ? crState.anexo : null, briefing: null, conteudo: null, legenda: null, mostradas: [], viaIA: false };
  crState.fios.push(fio);
  inp.value = ''; crAutoAltura(inp); crTirarAnexo();
  // A tela de boas-vindas recolhe (altura real, não some de repente) e "Nova arte" acende
  const v = _crEl('view-creative'); if(v) v.classList.add('cr-conversando');
  const nova = _crEl('cr-nova'); if(nova) nova.disabled = false;
  const m = document.createElement('div');
  m.className = 'cr-msg cr-eu cr-entra';
  m.innerHTML = '<div class="cr-corpo">' + (/^data:/.test(fio.foto || '') || fio.ref ? '<img class="cr-bolha-foto" alt="' + (fio.ref ? 'Referência enviada' : 'Foto enviada') + '" src="' + (fio.foto || fio.ref) + '">' : '')
    + '<div class="cr-bolha">' + gEsc(pedido) + '</div></div>';
  conv.appendChild(m);
  _crRola(true);
  crGerar(fio, conv);
}
// Recomeça do zero: o que está na tela só existe na memória desta sessão, então confirma antes
async function crNova(){
  const conv = _crEl('cr-conversa'); if(!conv || !crState.fios.length) return;
  const ok = await gConfirm('Começar uma arte nova? As opções desta conversa saem da tela.', { title: 'Nova arte', okLabel: 'Começar de novo', cancelLabel: 'Continuar aqui' });
  if(!ok) return;
  crParar();
  crState.rodando = null; _crOcupado(false);
  conv.classList.add('cr-saindo');
  await _crEsp(220);
  conv.innerHTML = ''; conv.classList.remove('cr-saindo');
  crState.fios = []; crState.fmt = null; crTirarAnexo(); crLigaMuch(false); _crRotuloFmt();
  const v = _crEl('view-creative'); if(v) v.classList.remove('cr-conversando', 'cr-rolou');
  const nova = _crEl('cr-nova'); if(nova) nova.disabled = true;
  const p = _crEl('cr-palco'); if(p) p.scrollTo({ top: 0 });
  const i = _crEl('cr-pedido'); if(i) i.focus({ preventScroll: true });
}
function crOutrasOpcoes(fio){
  if(crState.rodando) return;
  crGerar(fio, _crEl('cr-conversa'), true);
}

async function crGerar(fio, conv, outras){
  const run = { parado: false, cancelar: null };
  crState.rodando = run;
  _crOcupado(true);
  const msg = _crMsgIA(conv), corpo = msg.querySelector('.cr-corpo'), t0 = Date.now();
  msg.querySelector('.cr-bolha').remove();
  msg.classList.add('cr-pensando');
  let esq = null;   // esqueleto das opções: ocupa o lugar exato da entrega enquanto o motor diagrama
  const lista = document.createElement('ul'); lista.className = 'cr-passos';
  corpo.appendChild(lista);
  let status = _crStatus(corpo);
  const aviso = txt => { const b = document.createElement('div'); b.className = 'cr-bolha cr-interrompido'; b.textContent = txt; corpo.appendChild(b); _crRola(); };
  const parou = () => {
    if(!run.parado) return false;
    status.parar(); aviso('Interrompido. Ajuste o pedido e mande de novo.');
    return true;
  };
  try{
    let p;
    if(!outras){
      // 1) Briefing: entende o pedido e pergunta só o que muda a arte
      p = _crPasso(lista, 'Entendendo o pedido');
      let br = null;
      try{ br = await crPedirBriefing(fio); }catch(err){ br = null; }
      if(!br) br = crBriefingLocal(fio);
      if(parou()) return;
      p.feito(br.resumo || CR_OBJETIVOS[br.objetivo]);
      const perguntas = crPerguntasFinais(br, fio);
      fio.briefing = [];
      if(perguntas.length){
        status.parar();
        const resp = await _crPerguntar(corpo, perguntas, run);
        if(!resp || run.parado){ fio.briefing = null; aviso('Interrompido. Ajuste o pedido e mande de novo.'); return; }
        fio.briefing = resp;
        resp.forEach(r => {
          if(r.foto) fio.foto = r.foto;
          else if(r.titulo === 'Foto' && (r.pulou || r.valor === 'slot')) fio.foto = 'slot';   // pulou = fica o espaço
          if(r.campo === 'formato' && !r.pulou && CR_FORMATOS[r.valor]) fio.fmt = r.valor;
        });
        const ditas = resp.filter(r => !r.pulou).map(r => r.titulo + ': ' + r.resposta);
        _crPasso(lista, 'Briefing').feito(ditas.length ? ditas.join(' · ') : 'sem respostas — sigo com o padrão das artes aprovadas');
        status = _crStatus(corpo);
      }
      // 2) Copy (IA; sem ela, a leitura local) — o formato é do Luma, as respostas valem mais
      p = _crPasso(lista, 'Escrevendo a copy');
      let bruto = null;
      try{ bruto = await crPedirComposicao(fio); fio.viaIA = !!bruto; }catch(err){ bruto = null; }
      if(!bruto) bruto = crLerPedido(fio.pedido, fio.fmt);
      bruto = crAplicaRespostas(bruto, fio.briefing);
      bruto.formato = fio.fmt;
      bruto.marca = fio.marca;
      bruto.foto = fio.foto || '';
      if(parou()) return;
      fio.conteudo = bruto;
      const sp0 = crNormaliza(bruto);
      p.feito([sp0.palavra, sp0.titulo].filter(Boolean).join(' ') + (sp0.precoPor ? ' · R$ ' + sp0.precoPor : '') + (fio.viaIA ? ' · IA' : ' · IA indisponível agora: motor local (sem designer nem juiz)'));
      // a legenda corre em paralelo e chega junto — só para post (inapp, banner, email, capa e slide não têm)
      fio.legProm = CR_FORMATOS[sp0.formato].social === false ? Promise.resolve([]) : crLegenda(sp0);
    }

    // 3) Diagramação: todas as famílias que servem, conferidas pelas regras da marca
    p = _crPasso(lista, outras ? 'Diagramando outros caminhos' : 'Diagramando as opções');
    esq = _crEsqueleto(fio.fmt); msg.after(esq); _crRola();
    await crFontesProntas();
    // Cada rodada de "Outras opções" muda as proporções: família que volta não volta idêntica
    fio.rodada = (fio.rodada || 0) + (outras ? 1 : 0);
    const variacao = [null, { kh: 1.12, kf: 0.88 }, { kh: 0.92, kf: 1.12 }][fio.rodada % 3];
    const cands = crCandidatos(fio.conteudo, variacao);
    p.feito(cands.length + ' diagramações testadas · ' + cands.filter(c => !c.avaliacao.erros.length).length + ' aprovadas nas regras da marca');
    // A IA compõe como designer (skill §4.2): 2 composições próprias; o motor completa a 3ª
    let ia = [];
    if(!CR_FORMATOS[fio.fmt].fixo && typeof gAiReady === 'function' && gAiReady()){
      p = _crPasso(lista, 'Compondo como designer');
      try{ ia = await crDesenhos(crNormaliza(fio.conteudo), 2, fio.ideias || [], fio.ref); }catch(err){ ia = []; }
      if(parou()) return;
      fio.ideias = (fio.ideias || []).concat(ia.map(r => r.nomeReceita));
      p.feito(ia.length ? ia.map(r => r.nomeReceita).join(' · ') : 'sem composição aprovada agora — sigo com o motor', !ia.length);
    }
    let tres = ia.slice(0, 2).concat(crEscolher3(cands, fio.mostradas)).slice(0, 3);
    if(!tres.length) throw new Error('nenhuma diagramação passou nas regras da marca');

    // 4) Juiz: os prints lado a lado com a régua, 1 rodada de ajuste
    p = _crPasso(lista, 'Revisando os prints com a régua da marca');
    let juiz = null;
    try{ juiz = await crJulgar(tres); }catch(err){ juiz = null; }
    if(parou()) return;
    if(juiz){
      tres = tres.map((r, i) => { const n = crRefinar(r, juiz[i].ajustes); n.juiz = juiz[i]; return n; });
      // Composição da IA abaixo da régua: o designer refaz com a crítica do juiz (1 rodada)
      const fracas = tres.map((r, i) => ({ r, i, critica: r.juiz.critica })).filter(x => x.r.desenho && x.critica && (x.r.juiz.nota < 4 || x.r.juiz.piores < 3));
      if(fracas.length){
        const p2 = _crPasso(lista, 'Refazendo com a crítica do diretor de arte');
        let novas = [];
        try{ novas = await crRefazerDesenhos(fracas); }catch(err){ novas = fracas.map(x => x.r); }
        if(parou()) return;
        novas.forEach((n, k) => { const x = fracas[k]; if(n !== x.r){ n.juiz = Object.assign({}, x.r.juiz, { porque: x.r.juiz.porque }); tres[x.i] = n; } });
        p2.feito(fracas.map(x => '“' + x.critica + '”').join(' · ').slice(0, 220));
      }
      tres.sort((u, v) => v.juiz.nota - u.juiz.nota);
      const aj = tres.filter(r => r.ajustado).length;
      p.feito('notas ' + tres.map(r => r.juiz.nota.toFixed(1).replace('.', ',')).join(' · ') + (aj ? ' · ' + aj + (aj > 1 ? ' ajustes aplicados' : ' ajuste aplicado') : ''));
    }else p.feito('sem IA agora — ordem pela nota do motor');
    fio.mostradas.push(...tres.map(r => r.receita));
    const opcoes = await Promise.all(tres.map(async r => {
      r.svgFinal = await crEmbutir(r.svg);
      r.url = URL.createObjectURL(new Blob([r.svgFinal], { type: 'image/svg+xml' }));
      return r;
    }));
    if(parou()) return;

    // 5) Legenda (uma, bem escrita)
    if(fio.legenda == null && CR_FORMATOS[fio.fmt].social === false) fio.legenda = '';
    if(fio.legenda == null){
      p = _crPasso(lista, 'Escrevendo a legenda do post');
      const leg = await fio.legProm;
      fio.legenda = (leg && leg[0] && leg[0].text) || '';
      p.feito(fio.legenda ? (leg._ia ? 'pronta · IA' : 'pronta · motor local') : 'sem legenda agora', !fio.legenda);
    }
    status.parar();
    const fala = document.createElement('div'); fala.className = 'cr-bolha';
    corpo.appendChild(fala);
    const f = CR_FORMATOS[opcoes[0].spec.formato];
    if(run.parado) return;
    await _crDigita(fala, outras ? 'Mais ' + opcoes.length + (opcoes.length > 1 ? ' caminhos, de famílias diferentes' : ' caminho, de família diferente') + ' das anteriores.'
      : ((fio.viaIA && opcoes[0].spec.resumo) ? opcoes[0].spec.resumo + ' ' : '') + 'Separei ' + opcoes.length + (opcoes.length > 1 ? ' opções' : ' opção') + ' em ' + f.nome.toLowerCase() + ': escolha uma, ajuste no editor se quiser e baixe.');
    if(run.parado) return;
    const ent = _crEntrega(fio, opcoes);
    // a pessoa estava no fim? então a entrega (o destino) sobe até o topo da tela dela
    const seguia = (() => { const pl = _crEl('cr-palco'); return !pl || pl.scrollHeight - pl.scrollTop - pl.clientHeight < 200; })();
    if(esq && esq.isConnected) esq.replaceWith(ent); else conv.appendChild(ent);
    esq = null;
    _crMontar(ent, opcoes);
    _crResumo(corpo, lista, t0);
    if(seguia) requestAnimationFrame(() => ent.scrollIntoView({ block: 'start', behavior: _crReduz() ? 'auto' : 'smooth' }));
    if(typeof gTrackEvent === 'function') try{ gTrackEvent('creative_arte', { objetivo: opcoes[0].spec.objetivo, formato: opcoes[0].spec.formato, marca: opcoes[0].spec.marca, ia: fio.viaIA, juiz: !!juiz, foto: !!fio.foto, ref: !!fio.ref,
      receitas: opcoes.map(o => o.receita).join(','), designer: Object.assign({}, crMetricas), notas: juiz ? opcoes.map(o => o.juiz ? +o.juiz.nota.toFixed(1) : null).join(',') : '' }); }catch(err){}
  }catch(err){
    console.error('[creative]', err);
    status.parar();
    aviso('Não consegui compor a arte agora (' + ((err && err.message) || 'erro') + '). Tente de novo.');
  }finally{
    if(esq) esq.remove();
    msg.classList.remove('cr-pensando');
    if(crState.rodando === run){ crState.rodando = null; _crOcupado(false); }
  }
}

// Esqueleto da entrega: a mesma casca e a mesma proporção do formato, para a arte "revelar" no lugar
function _crEsqueleto(fmt){
  const f = CR_FORMATOS[fmt] || CR_FORMATOS.feed, w = f.w || CR_W, h = f.h;
  const el = document.createElement('section');
  el.className = 'cr-entrega cr-esq'; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<header class="cr-ent-cab"><div><span class="cr-esq-l" style="width:132px;height:22px"></span><span class="cr-esq-l" style="width:210px;margin-top:10px"></span></div></header>'
    + '<div class="cr-ops' + (w > h * 1.2 ? ' cr-ops-deitadas' : '') + '">'
    + [0, 1, 2].map(i => '<div class="cr-op" style="--i:' + i + '"><span class="cr-op-arte cr-esq-arte" style="aspect-ratio:' + w + '/' + h + '"></span><span class="cr-esq-l" style="width:' + (96 + i * 18) + 'px"></span></div>').join('') + '</div>';
  return el;
}
// Depois da entrega, as etapas viram uma linha ("Trabalhou por 14 s · 6 etapas") que abre a lista:
// a diagramação é o assunto, o making-of fica a um clique
function _crResumo(corpo, lista, t0){
  if(!lista || !lista.isConnected || !lista.children.length) return;
  const s = Math.max(1, Math.round((Date.now() - t0) / 1000)), n = lista.children.length;
  const w = document.createElement('div');
  w.className = 'cr-trab aberto';
  w.innerHTML = '<button type="button" class="cr-trab-cab" aria-expanded="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg><span>Trabalhou por ' + s + ' s · ' + n + (n > 1 ? ' etapas' : ' etapa') + '</span></button><div class="cr-trab-corpo"><div class="cr-trab-in"></div></div>';
  lista.replaceWith(w);
  w.querySelector('.cr-trab-in').appendChild(lista);
  const b = w.querySelector('.cr-trab-cab');
  b.addEventListener('click', () => b.setAttribute('aria-expanded', String(w.classList.toggle('aberto'))));
  // recolhe depois de a pessoa ver o último passo fechar: a altura anima até 0, não "pula"
  setTimeout(() => { w.classList.remove('aberto'); b.setAttribute('aria-expanded', 'false'); }, _crReduz() ? 0 : 900);
}

/* ══════════════════════════════════════════════════════════════
   ENTREGA — as 3 opções lado a lado, a escolhida em destaque, uma legenda diagramada e as ações.
══════════════════════════════════════════════════════════════ */
// Legenda em parágrafos; a linha só de hashtags vira etiquetas discretas
function _crLegendaHtml(txt){
  return String(txt || '').trim().split(/\n{2,}/).map(par => {
    const tags = par.trim().split(/\s+/);
    if(tags.length && tags.every(t => /^#[\p{L}\d_]+$/u.test(t))) return '<p class="cr-leg-tags">' + tags.map(t => '<span>' + gEsc(t) + '</span>').join('') + '</p>';
    return '<p>' + par.split('\n').map(gEsc).join('<br>') + '</p>';
  }).join('');
}
function _crEntrega(fio, ops){
  const el = document.createElement('section');
  el.className = 'cr-entrega';
  el.setAttribute('aria-label', 'Arte pronta');
  const f = CR_FORMATOS[ops[0].spec.formato];
  let sel = 0;
  const rotulo = (o, i) => '<span class="cr-op-rot"><b>' + (i + 1) + '</b><span>' + gEsc(o.nomeReceita) + '</span>' + (o.editada ? '<em>editada</em>' : '') + _crMedidor(o) + '</span>';
  const postavel = typeof fOpenPosted === 'function' && CR_FORMATOS[ops[0].spec.formato].social !== false && !!fPostedContextForFormat({ material: { w: ops[0].w, h: ops[0].h } });
  el.innerHTML = '<header class="cr-ent-cab"><div><h3>Sua arte</h3><p>' + ops.length + (ops.length > 1 ? ' opções' : ' opção') + ' · ' + gEsc(f.nome) + ' ' + gEsc(f.desc.split(',')[0]) + '</p></div>'
    + '<span class="cr-ent-selo"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>' + (ops[0].juiz ? 'Revisada pela IA' : 'Conferida nas regras da marca') + '</span></header>'
    + '<div class="cr-ops' + (ops[0].w > ops[0].h * 1.2 ? ' cr-ops-deitadas' : '') + '" role="radiogroup" aria-label="Opções de arte">'
    + ops.map((o, i) => '<button type="button" class="cr-op' + (i ? '' : ' on') + '" role="radio" aria-checked="' + (i ? 'false' : 'true') + '" data-i="' + i + '">'
      + '<span class="cr-op-arte"' + (CR_FORMATOS[o.spec.formato].laminas ? ' data-laminas="' + CR_FORMATOS[o.spec.formato].laminas + '"' : '') + ' style="aspect-ratio:' + o.w + '/' + o.h + '"><img alt="Opção ' + (i + 1) + ': ' + gEsc(o.nomeReceita) + '" src="' + o.url + '"><span class="cr-mont" aria-hidden="true"></span><span class="cr-mont-rot" aria-hidden="true"></span>' + _crDetalheNota(o) + '<span class="cr-op-ok" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span></span>'
      + rotulo(o, i) + (o.juiz && o.juiz.porque ? '<span class="cr-op-pq">' + gEsc(o.juiz.porque) + '</span>' : '') + '</button>').join('')
    + '</div>'
    + '<div class="cr-acoes">'
    + '<button type="button" class="cr-btn cr-prim" data-acao="png">' + CR_ICO.baixar + 'Baixar PNG</button>'
    + '<button type="button" class="cr-btn" data-acao="editar">' + CR_ICO.editar + 'Editar</button>'
    + (postavel ? '<button type="button" class="cr-btn" data-acao="postado">' + CR_ICO.celular + 'Ver postado</button>' : '')
    + '<button type="button" class="cr-btn cr-btn-leve" data-acao="outras">' + CR_ICO.refazer + 'Outras opções</button>'
    + '</div>'
    + (fio.legenda ? '<div class="cr-leg"><div class="cr-leg-cab"><h4>Legenda do post</h4><button type="button" class="cr-btn cr-btn-mini" data-acao="copiar">' + CR_ICO.copiar + 'Copiar</button></div>'
      + '<div class="cr-leg-corpo">' + _crLegendaHtml(fio.legenda) + '</div></div>' : '');
  const botoes = () => [...el.querySelectorAll('.cr-op')];
  const escolhe = i => {
    sel = i;
    botoes().forEach((b, j) => { b.classList.toggle('on', j === i); b.setAttribute('aria-checked', j === i ? 'true' : 'false'); });
  };
  botoes().forEach((b, i) => {
    const img = b.querySelector('img');
    // a montagem (_crMontar) decide quando a arte aparece; sem ela, aparece ao carregar
    img.addEventListener('load', () => { if(!b.dataset.mont) b.classList.add('cr-nitida'); }, { once: true });
    b.addEventListener('dblclick', () => abre(i));
  });
  const abre = i => {
    escolhe(i);
    crEditar(ops[i], nova => {
      Object.assign(ops[i], nova, { editada: true });
      crAprende(ops[i], 'editou');
      const b = botoes()[i];
      b.querySelector('img').src = ops[i].url;
      b.querySelector('.cr-op-rot').outerHTML = rotulo(ops[i], i);
    });
  };
  el.addEventListener('keydown', e => { if(/^[1-3]$/.test(e.key) && e.target.closest('.cr-ops')) escolhe(Math.min(ops.length, +e.key) - 1); });
  el.addEventListener('click', ev => {
    const b = ev.target.closest('button'); if(!b) return;
    if(b.classList.contains('cr-op')) return escolhe(+b.dataset.i);
    if(b.dataset.acao === 'png'){ crAprende(ops[sel], 'baixou'); return crBaixarPNG(ops[sel], b); }
    if(b.dataset.acao === 'editar') return abre(sel);
    if(b.dataset.acao === 'postado') return crVerPostado(ops[sel], fio);
    if(b.dataset.acao === 'outras') return crOutrasOpcoes(fio);
    if(b.dataset.acao === 'copiar') return crCopiar(fio.legenda, b);
  });
  el._ops = ops;
  return el;
}

// ── Nota do juiz como medidor: anel que enche até a nota (de 5) e, no hover, o boletim das 5 réguas
const CR_REGUAS = { foco: 'Foco', hierarquia: 'Hierarquia', respiro: 'Respiro', contraste: 'Contraste', acabamento: 'Acabamento' };
const _crNota = n => n.toFixed(1).replace('.', ',');
function _crMedidor(o){
  if(!o.juiz || o.editada) return '';   // editou: a nota era da diagramação original
  const n = o.juiz.nota;
  return '<span class="cr-medidor ' + (n >= 4 ? 'alta' : n >= 3 ? 'media' : 'baixa') + '" role="img" aria-label="Nota da revisão: ' + _crNota(n) + ' de 5" style="--n:' + (n / 5).toFixed(3) + '" data-nota="' + n + '">'
    + '<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="cr-med-fundo" cx="12" cy="12" r="9.5"/><circle class="cr-med-arco" cx="12" cy="12" r="9.5" pathLength="100"/></svg><span class="cr-med-n">' + _crNota(0) + '</span></span>';
}
function _crDetalheNota(o){
  if(!o.juiz || !o.juiz.notas) return '';
  return '<span class="cr-op-det" aria-hidden="true"><b class="cr-det-tit">Revisão da IA <em>' + _crNota(o.juiz.nota) + ' / 5</em></b>'
    + o.juiz.notas.map(([k, v]) => '<span class="cr-det-linha"><span>' + CR_REGUAS[k] + '</span><i style="--v:' + (v / 5).toFixed(2) + '"></i><u>' + _crNota(v) + '</u></span>').join('')
    + (o.juiz.porque ? '<small>' + gEsc(o.juiz.porque) + '</small>' : '') + '</span>';
}
// Tokens de motion lidos do CSS (nunca ms no JS — motion.md §1); 0 com movimento reduzido
const _crDur = t => _crReduz() ? 0 : (parseFloat(getComputedStyle(document.documentElement).getPropertyValue(t)) || 0);
function _crContaNotas(el){
  el.querySelectorAll('.cr-medidor').forEach((m, i) => {
    const alvo = +m.dataset.nota, num = m.querySelector('.cr-med-n'), dur = _crDur('--dur-celebration') * 1.4;
    if(!dur){ num.textContent = _crNota(alvo); m.classList.add('pronto'); return; }
    setTimeout(() => {
      m.classList.add('pronto');   // o anel enche por transição de CSS; o número acompanha por aqui
      const t0 = performance.now();
      (function passo(t){
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        num.textContent = _crNota(alvo * e);
        if(k < 1) requestAnimationFrame(passo);
      })(t0);
    }, _crDur('--dur-slow') + i * _crDur('--dur-micro'));
  });
}

/* ── A arte se montando: o SVG da opção entra num shadow root (o <style> dele não vaza pro app) e
   os blocos nomeados (logo, título, foto, preço…) entram um a um, na ordem em que o motor os
   empilhou. Quando o último assenta, a <img> real assume por cima — o que fica na tela é sempre o
   arquivo que se baixa. Movimento reduzido: a arte aparece pronta. ── */
const CR_MONT_CSS = 'svg{display:block;width:100%;height:auto}'
  + 'svg .hero{font-family:"LC Realce","Realce",sans-serif}svg .sup,svg .body,svg .legal,svg .leve,svg .forte{font-family:"LC Roboto","Roboto",sans-serif}'
  + '[data-bloco]{transform-box:fill-box;transform-origin:center;animation:ent var(--dur-slow) var(--ease-out) backwards;animation-delay:calc(var(--k) * var(--dur-micro) + var(--d))}'
  + '@keyframes ent{from{opacity:0;translate:0 28px;scale:.94}to{opacity:1;translate:0 0;scale:1}}';
function _crMontar(el, ops){
  el.querySelectorAll('.cr-op').forEach((b, i) => {
    const o = ops[i], host = b.querySelector('.cr-mont'), rot = b.querySelector('.cr-mont-rot');
    b.dataset.mont = '1';
    const direto = () => { b.classList.add('cr-nitida'); if(host) host.remove(); if(rot) rot.remove(); };
    if(!o || !host || !o.svgFinal || o.editada || _crReduz()) return direto();
    let svg;
    try{
      const doc = new DOMParser().parseFromString(o.svgFinal, 'image/svg+xml');
      if(doc.querySelector('parsererror')) throw new Error('svg');
      svg = document.importNode(doc.documentElement, true);
    }catch(err){ return direto(); }
    const blocos = [...svg.querySelectorAll(':scope > [data-bloco]')];
    if(!blocos.length) return direto();
    const micro = _crDur('--dur-micro'), atraso = i * micro * 1.3;
    host.style.setProperty('--d', atraso + 'ms');
    blocos.forEach((g, k) => g.style.setProperty('--k', Math.min(k, 8)));
    const raiz = host.attachShadow({ mode: 'open' }), st = document.createElement('style');
    st.textContent = CR_MONT_CSS; raiz.append(st, svg);
    b.classList.add('cr-montando');
    blocos.forEach((g, k) => setTimeout(() => { if(rot) rot.textContent = 'Colocando · ' + (CR_NOME_BLOCO[g.dataset.bloco] || 'Bloco'); }, atraso + Math.min(k, 8) * micro));
    const fim = atraso + Math.min(blocos.length - 1, 8) * micro + _crDur('--dur-slow') + 60;
    setTimeout(() => {
      b.classList.remove('cr-montando'); b.classList.add('cr-nitida');
      if(rot){ rot.classList.add('cr-some'); setTimeout(() => rot.remove(), _crDur('--dur-base') + 40); }
      setTimeout(() => host.remove(), _crDur('--dur-slow') + 60);
    }, fim);
  });
  _crContaNotas(el);
}

/* ── Ver postado: a arte escolhida no celular (Stories/Feed/WhatsApp). Reusa o chassi do Franqueado
   (live-preview.js) — nenhum segundo desenho de celular. Ele lê o formato do fState e a legenda do
   painel do chat; aqui o fState é emprestado enquanto o modal está aberto e devolvido ao fechar. ── */
let _crLegendaVer = '';
async function crVerPostado(op, fio){
  const modal = _crEl('f-posted-modal'), seg = _crEl('posted-seg');
  if(!modal || !seg || typeof _fPostedPaint !== 'function') return gToast('A prévia do celular não carregou', 'error');
  const principal = fPostedContextForFormat({ material: { w: op.w, h: op.h } });
  if(!principal) return gToast('Esse formato não tem simulação de post', 'error');
  const cv = await new Promise(res => {
    const im = new Image();
    im.onload = () => { const c = document.createElement('canvas'); c.width = op.w; c.height = op.h; c.className = 'pst-art'; c.getContext('2d').drawImage(im, 0, 0, op.w, op.h); res(c); };
    im.onerror = () => res(null); im.src = op.url;
  });
  if(!cv) return gToast('Não consegui montar a prévia', 'error');
  const antes = fState.material;
  fState.material = { w: op.w, h: op.h, layers: [] };
  _crLegendaVer = fio.legenda || '';
  _postedArt = { canvas: cv, w: op.w, h: op.h };
  _postedCtx = principal;
  seg.innerHTML = _fPostedContextsFor(principal).map(c => '<button type="button" class="pst-seg-btn' + (c.id === _postedCtx ? ' active' : '') + '" data-ctx="' + c.id + '" role="radio" aria-checked="' + (c.id === _postedCtx) + '" onclick="fPostedSetCtx(\'' + c.id + '\')">' + c.label + '</button>').join('');
  modal.classList.add('open', 'cr-postado'); modal.setAttribute('aria-hidden', 'false');
  _fPostedPaint();
  document.addEventListener('keydown', _fPostedKey, true);
  const olha = new MutationObserver(() => {
    if(modal.getAttribute('aria-hidden') !== 'true') return;
    olha.disconnect(); fState.material = antes; _crLegendaVer = ''; modal.classList.remove('cr-postado');
  });
  olha.observe(modal, { attributes: true, attributeFilter: ['aria-hidden'] });
}

/* ══════════════════════════════════════════════════════════════
   EDITOR — tela própria: a arte viva num shadow root (o <style> dela não vaza pro app) e um painel
   com camadas, textos editados ao vivo, tamanho, alinhamento, ordem, foto (trocar, zoom,
   enquadrar) e fundo. Desfazer/refazer em snapshots. Salvar devolve o SVG com os transforms nos
   blocos (o importador do Estúdio lê, se a arte um dia virar template).
══════════════════════════════════════════════════════════════ */
const CR_ED_CSS = ':host{display:block;position:relative;overflow:hidden;border-radius:4px;outline:none;touch-action:none;'
  + 'box-shadow:0 1px 2px rgba(67,67,67,.08),0 18px 48px rgba(67,67,67,.16)}'
  + ':host(:focus-visible){box-shadow:0 0 0 2px var(--dm-orange),0 18px 48px rgba(67,67,67,.16)}'
  + 'svg{display:block;width:100%;height:auto;user-select:none;-webkit-user-select:none}'
  + '[data-bloco]{cursor:grab}:host(.enquadrar) [data-bloco="foto"]{cursor:move}'
  + 'svg .hero{font-family:"LC Realce","Realce",sans-serif}svg .sup,svg .body,svg .legal,svg .leve,svg .forte{font-family:"LC Roboto","Roboto",sans-serif}'
  + '.sel,.paira{position:absolute;pointer-events:none;border-radius:3px}'
  + '.sel{border:1.5px solid var(--dm-orange);box-shadow:0 0 0 1px rgba(255,255,255,.7)}'
  + '.paira{border:1px dashed rgba(248,84,0,.6)}'
  + '.sel::after{content:attr(data-nome);position:absolute;left:-1.5px;bottom:calc(100% + 4px);padding:2px 7px;border-radius:4px;background:var(--dm-orange);color:#fff;font:600 11px/1.5 Roboto,sans-serif;white-space:nowrap}'
  + '.sel.dentro::after{bottom:auto;top:4px;left:4px}'
  + '.guia{position:absolute;pointer-events:none}.guia.v{top:0;bottom:0;border-left:1px solid var(--dm-orange)}.guia.h{left:0;right:0;border-top:1px solid var(--dm-orange)}'
  + '[hidden]{display:none!important}';
const _crNS = 'http://www.w3.org/2000/svg';
const CR_NOME_CAMPO = { produto: 'Título', titulo: 'Título', precoPor: 'Preço', precoDe: 'Preço antigo (DE)', desconto_valor: 'Valor do desconto', codigo_cupom: 'Código do cupom', anos: 'Anos' };

function crEditar(op, aoSalvar){
  const view = _crEl('view-creative');
  if(!view || view.querySelector('.cr-ed')) return;
  const ed = document.createElement('div');
  ed.className = 'cr-ed'; ed.setAttribute('role', 'dialog'); ed.setAttribute('aria-label', 'Editar arte');
  const bt = (acao, ico, rot, extra) => '<button type="button" class="cr-ed-ico" data-ed="' + acao + '" title="' + rot + '" aria-label="' + rot + '"' + (extra || '') + '>' + ico + '</button>';
  ed.innerHTML = '<header class="cr-ed-topo">'
    + '<div class="cr-ed-tit"><b>Editar arte</b><span>' + gEsc(op.nomeReceita) + ' · ' + gEsc(CR_FORMATOS[op.spec.formato].nome) + '</span></div>'
    + '<div class="cr-ed-hist">' + bt('desfazer', CR_ICO.desfazer, 'Desfazer (Ctrl+Z)') + bt('refazer', CR_ICO.refazerSeta, 'Refazer (Ctrl+Shift+Z)') + '</div>'
    + '<div class="cr-ed-fim"><button type="button" class="cr-btn cr-btn-leve" data-ed="cancelar">Cancelar</button><button type="button" class="cr-btn cr-prim" data-ed="salvar">Salvar alterações</button></div>'
    + '</header><div class="cr-ed-corpo"><div class="cr-ed-mesa"><div class="cr-ed-palco" tabindex="0" aria-label="Arte em edição" style="--cr-ar:' + (op.w / op.h) + '"></div>'
    + '<p class="cr-ed-dica">Clique para selecionar · arraste para mover · duplo clique edita o texto · setas ajustam</p></div>'
    + '<aside class="cr-ed-painel" aria-label="Propriedades"><section class="cr-ed-sec"><h4>Camadas</h4><ul class="cr-ed-camadas"></ul></section><div class="cr-ed-props"></div></aside></div>';
  view.appendChild(ed);
  requestAnimationFrame(() => ed.classList.add('aberto'));
  const host = ed.querySelector('.cr-ed-palco'), lista = ed.querySelector('.cr-ed-camadas'), props = ed.querySelector('.cr-ed-props');
  const raiz = host.attachShadow({ mode: 'open' });
  const st = document.createElement('style'); st.textContent = CR_ED_CSS; raiz.appendChild(st);
  const svg = document.importNode(new DOMParser().parseFromString(op.svgFinal, 'image/svg+xml').documentElement, true);
  raiz.appendChild(svg);
  const mk = cls => { const d = document.createElement('div'); d.className = cls; d.hidden = true; raiz.appendChild(d); return d; };
  const caixa = mk('sel'), paira = mk('paira'), guiaV = mk('guia v'), guiaH = mk('guia h');
  const W = op.w, H = op.h, M = crArea(op.spec.formato).M, hist = [], fut = [];
  let atual = null, enquadrar = false, mexeu = false;
  const r1 = n => Math.round(n * 10) / 10;
  const escala = () => W / svg.getBoundingClientRect().width;
  const blocos = () => [...svg.querySelectorAll(':scope > [data-bloco]')];
  const guarda = () => { hist.push(svg.innerHTML); if(hist.length > 60) hist.shift(); fut.length = 0; mexeu = true; botoesHist(); };
  const botoesHist = () => { ed.querySelector('[data-ed="desfazer"]').disabled = !hist.length; ed.querySelector('[data-ed="refazer"]').disabled = !fut.length; };
  const restaura = html => { svg.innerHTML = html; atual = null; tudo(); };
  const desfaz = () => { if(!hist.length) return; fut.push(svg.innerHTML); restaura(hist.pop()); botoesHist(); };
  const refaz = () => { if(!fut.length) return; hist.push(svg.innerHTML); restaura(fut.pop()); botoesHist(); };
  const estado = g => ({ dx: +g.dataset.dx || 0, dy: +g.dataset.dy || 0, s: +g.dataset.s || 1 });
  function aplica(g, e){
    g.dataset.dx = r1(e.dx); g.dataset.dy = r1(e.dy); g.dataset.s = Math.round(e.s * 1000) / 1000;
    let t = 'translate(' + r1(e.dx) + ',' + r1(e.dy) + ')';
    if(Math.abs(e.s - 1) > 0.001){
      if(!g.dataset.cx){ const b = g.getBBox(); g.dataset.cx = r1(b.x + b.width / 2); g.dataset.cy = r1(b.y + b.height / 2); }
      t += ' translate(' + g.dataset.cx + ',' + g.dataset.cy + ') scale(' + g.dataset.s + ') translate(' + (-g.dataset.cx) + ',' + (-g.dataset.cy) + ')';
    }
    g.setAttribute('transform', t);
    marca();
  }
  const nomeBloco = g => (CR_NOME_BLOCO[g.dataset.bloco] || 'Bloco');
  function poe(el, g){
    if(!g || !g.isConnected || g.getAttribute('display') === 'none'){ el.hidden = true; return; }
    const hr = host.getBoundingClientRect(), r = g.getBoundingClientRect();
    Object.assign(el.style, { left: (r.left - hr.left) + 'px', top: (r.top - hr.top) + 'px', width: r.width + 'px', height: r.height + 'px' });
    el.hidden = false;
    return r.top - hr.top;
  }
  function marca(){
    const topo = poe(caixa, atual);
    if(atual){ caixa.dataset.nome = nomeBloco(atual); caixa.classList.toggle('dentro', topo < 24); }
  }
  function seleciona(g){ atual = g || null; if(atual !== null) paira.hidden = true; marca(); painel(); camadas(); }
  function tudo(){ marca(); painel(); camadas(); }

  /* ── Camadas: da frente para trás, com olho para ocultar ── */
  function camadas(){
    lista.innerHTML = blocos().reverse().map((g, i) => {
      const oculto = g.getAttribute('display') === 'none';
      return '<li class="' + (g === atual ? 'on' : '') + (oculto ? ' oculto' : '') + '"><button type="button" class="cr-ed-cam" data-cam="' + i + '">' + gEsc(nomeBloco(g)) + '</button>'
        + '<button type="button" class="cr-ed-olho" data-olho="' + i + '" aria-label="' + (oculto ? 'Mostrar ' : 'Ocultar ') + gEsc(nomeBloco(g)) + '" title="' + (oculto ? 'Mostrar' : 'Ocultar') + '">' + (oculto ? CR_ICO.olhoFechado : CR_ICO.olho) + '</button></li>';
    }).join('');
  }
  lista.addEventListener('click', e => {
    const bs = blocos().reverse(), c = e.target.closest('[data-cam]'), o = e.target.closest('[data-olho]');
    if(c) seleciona(bs[+c.dataset.cam]);
    else if(o){ const g = bs[+o.dataset.olho]; guarda(); if(g.getAttribute('display') === 'none') g.removeAttribute('display'); else g.setAttribute('display', 'none'); if(g === atual) atual = null; tudo(); }
  });

  /* ── Textos: tipo de cada <text> e como reescrever ── */
  function tipoTexto(t){
    const f = [...t.children];
    return t.getAttribute('data-campo') === 'precoPor' ? 'preco' : f.some(c => c.hasAttribute('y')) ? 'linhas'
      : f.some(c => c.classList.contains('forte') || c.classList.contains('leve')) ? 'mista' : f.length ? '' : 'simples';
  }
  function valorTexto(t, tipo){
    const f = [...t.children];
    return tipo === 'linhas' ? f.map(c => c.textContent).join('\n') : tipo === 'mista' ? f.map(c => c.classList.contains('forte') ? '*' + c.textContent + '*' : c.textContent).join('')
      : tipo === 'preco' ? t.textContent.replace(/^R\$\s*/, '') : t.textContent;
  }
  function escalaTexto(t, k){
    const nos = [t, ...t.querySelectorAll('tspan')];
    nos.forEach(n => {
      ['font-size', 'dx', 'dy'].forEach(a => { const v = parseFloat(n.getAttribute(a)); if(v) n.setAttribute(a, Math.max(a === 'font-size' ? 22 : -9999, Math.round(v * k))); });
    });
    const ls = [...t.children].filter(c => c.hasAttribute('y'));
    if(ls.length > 1){ const y0 = +ls[0].getAttribute('y'); ls.forEach(l => l.setAttribute('y', Math.round(y0 + (+l.getAttribute('y') - y0) * k))); }
  }
  // Reescreve o texto; devolve o elemento (o preço é recriado inteiro)
  function aplicaTexto(t, tipo, nv){
    const up = s => t.classList.contains('hero') ? s.toLocaleUpperCase('pt-BR') : s;
    const span = (txt, attrs) => { const s = document.createElementNS(_crNS, 'tspan'); Object.keys(attrs || {}).forEach(a => s.setAttribute(a, attrs[a])); s.textContent = txt; return s; };
    if(tipo === 'preco'){
      const fs = parseFloat(t.getAttribute('font-size')) || 168, cor = t.getAttribute('fill');
      const novo = new DOMParser().parseFromString('<svg xmlns="' + _crNS + '">' + crPreco(+t.getAttribute('x'), +t.getAttribute('y'), nv.replace(/[^\d,]/g, '') || '0', 9999, cor, fs) + '</svg>', 'image/svg+xml').documentElement.firstElementChild;
      const vivo = document.importNode(novo, true);
      t.replaceWith(vivo);
      return vivo;
    }
    if(tipo === 'simples') t.textContent = up(nv.replace(/\s*\n+\s*/g, ' '));
    else if(tipo === 'linhas'){
      const ls = nv.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 4);
      const ts = [...t.children], x = ts[0].getAttribute('x'), y0 = +ts[0].getAttribute('y');
      const passo = ts[1] ? +ts[1].getAttribute('y') - y0 : (parseFloat(t.getAttribute('font-size')) || 100) * 0.94;
      t.textContent = '';
      (ls.length ? ls : [' ']).forEach((l, i) => t.appendChild(span(up(l), { x, y: Math.round(y0 + i * passo) })));
    }else if(tipo === 'mista'){
      t.textContent = '';
      crTrechos(nv.replace(/\s*\n+\s*/g, ' ')).forEach(r => t.appendChild(span(r.t, { class: r.cls })));
    }
    return t;
  }

  // Espaço do texto: a largura do card/selo (data-larg) ou até a margem de 100 px
  function limiteTexto(t){
    if(t.closest('[transform*="rotate"]') || /rotate/.test(t.getAttribute('transform') || '')) return 0;
    const anc = t.getAttribute('text-anchor'), x = +t.getAttribute('x') || +((t.children[0] || t).getAttribute('x')) || 0;
    return +t.getAttribute('data-larg') || (anc === 'middle' ? W - 2 * M : anc === 'end' ? x - M : W - M - x);
  }
  function avisaMargem(campo, t){
    const al = campo && campo.querySelector('.cr-ed-alerta'), lim = limiteTexto(t);
    if(al) al.hidden = !(lim && t.getBBox().width > lim + 4);
  }
  /* ── Painel de propriedades ── */
  const _sec = (titulo, html) => '<section class="cr-ed-sec"><h4>' + titulo + '</h4>' + html + '</section>';
  function painel(){
    if(!atual){
      const fundo = svg.querySelector('[data-fundo]'), cor = (fundo && fundo.getAttribute('fill') || '').toUpperCase();
      props.innerHTML = _sec('Fundo', '<div class="cr-ed-cores">' + (op.spec.marca === 'much' ? ['#E52676', '#FFB900'] : ['#F85400', '#FF9000']).map(c => '<button type="button" class="cr-ed-cor' + (c === cor ? ' on' : '') + '" data-cor="' + c + '" style="--c:' + c + '" aria-label="Fundo ' + c + '"></button>').join('')
        + '</div><p class="cr-ed-nota">#FF9000 só em peça limpa: pouco texto e título grande (contraste).</p>')
        + '<p class="cr-ed-vazio">Clique num elemento da arte (ou nas camadas) para editar.</p>';
      return;
    }
    const g = atual, e = estado(g), ts = [...g.querySelectorAll('text')].filter(t => tipoTexto(t));
    let h = '<div class="cr-ed-selcab"><b>' + gEsc(nomeBloco(g)) + '</b><span>' + bt('ocultar', CR_ICO.olho, 'Ocultar') + bt('remover', CR_ICO.lixo, 'Remover (Delete)') + '</span></div>';
    if(ts.length){
      h += _sec('Texto', ts.map((t, i) => {
        const tipo = tipoTexto(t), campo = t.getAttribute('data-campo'), fs = Math.round(parseFloat(t.getAttribute('font-size')) || 0);
        const rot = ts.length > 1 && g.dataset.bloco === 'titulo' ? 'Linha ' + (i + 1) : (CR_NOME_CAMPO[campo] || (ts.length > 1 ? 'Texto ' + (i + 1) : 'Texto'));
        return '<div class="cr-ed-campo" data-ti="' + i + '"><label>' + gEsc(rot) + (tipo === 'mista' ? '<small>*palavra* fica em destaque</small>' : tipo === 'linhas' ? '<small>uma linha por linha</small>' : '') + '</label>'
          + '<textarea rows="' + (tipo === 'linhas' ? 2 : 1) + '" spellcheck="true">' + gEsc(valorTexto(t, tipo)) + '</textarea>'
          + '<div class="cr-ed-faixa"><span>Tamanho</span><input type="range" min="22" max="' + Math.max(420, fs * 2) + '" value="' + fs + '" data-fs="' + i + '" aria-label="Tamanho do texto"><output>' + fs + ' px</output></div>'
          + '<p class="cr-ed-alerta" hidden>Passa da margem de 100 px</p></div>';
      }).join(''));
    }
    const fotoImg = g.dataset.bloco === 'foto' ? g.querySelector('#foto_produto image') : null;
    if(fotoImg){
      const z = +fotoImg.dataset.z || 1;
      h += _sec('Foto', '<div class="cr-ed-linha"><button type="button" class="cr-btn cr-btn-mini" data-ed="trocarFoto">' + CR_ICO.foto + 'Trocar foto</button>'
        + '<button type="button" class="cr-btn cr-btn-mini' + (enquadrar ? ' on' : '') + '" data-ed="enquadrar" aria-pressed="' + enquadrar + '">' + CR_ICO.mover + 'Enquadrar</button></div>'
        + '<div class="cr-ed-faixa"><span>Zoom</span><input type="range" min="100" max="300" value="' + Math.round(z * 100) + '" data-zoom aria-label="Zoom da foto"><output>' + Math.round(z * 100) + '%</output></div>'
        + (enquadrar ? '<p class="cr-ed-nota">Arraste a foto para enquadrar dentro do quadro.</p>' : ''));
    }
    h += _sec('Bloco', '<div class="cr-ed-faixa"><span>Tamanho</span><input type="range" min="40" max="250" value="' + Math.round(e.s * 100) + '" data-bs aria-label="Tamanho do bloco"><output>' + Math.round(e.s * 100) + '%</output></div>'
      + '<div class="cr-ed-linha"><span class="cr-ed-rot">Alinhar</span>' + bt('alEsq', CR_ICO.alEsq, 'Na margem esquerda') + bt('alCentro', CR_ICO.alCentro, 'No centro') + bt('alDir', CR_ICO.alDir, 'Na margem direita') + '</div>'
      + '<div class="cr-ed-linha"><span class="cr-ed-rot">Ordem</span>' + bt('frente', CR_ICO.frente, 'Trazer para a frente') + bt('tras', CR_ICO.tras, 'Enviar para trás') + '</div>');
    props.innerHTML = h;
  }
  // Campos de texto: digitar reescreve a arte ao vivo (1 passo de desfazer por campo focado)
  let tFoco = null;
  props.addEventListener('focusin', e => { if(e.target.matches('textarea')) tFoco = null; });
  props.addEventListener('input', e => {
    const g = atual; if(!g) return;
    const ts = [...g.querySelectorAll('text')].filter(t => tipoTexto(t));
    const campo = e.target.closest('.cr-ed-campo');
    if(e.target.matches('textarea') && campo){
      if(tFoco !== e.target){ guarda(); tFoco = e.target; }
      let t = ts[+campo.dataset.ti];
      if(t){
        t = aplicaTexto(t, tipoTexto(t), e.target.value);
        // Digitando, o texto encolhe para caber no espaço dele (nunca abaixo de 22 px)
        const lim = limiteTexto(t), w = t.getBBox().width;
        if(lim && w > lim) escalaTexto(t, lim / w);
        const fsN = Math.round(parseFloat(t.getAttribute('font-size')) || 0), faixa = campo.querySelector('[data-fs]');
        if(faixa){ faixa.value = fsN; faixa.nextElementSibling.textContent = fsN + ' px'; }
        avisaMargem(campo, t); marca();
      }
      e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px';
    }else if(e.target.matches('[data-fs]')){
      if(tFoco !== e.target){ guarda(); tFoco = e.target; }
      const t = ts[+e.target.dataset.fs], atualFs = parseFloat(t.getAttribute('font-size')) || 1;
      escalaTexto(t, +e.target.value / atualFs);
      e.target.nextElementSibling.textContent = e.target.value + ' px'; avisaMargem(campo, t); marca();
    }else if(e.target.matches('[data-bs]')){
      if(tFoco !== e.target){ guarda(); tFoco = e.target; }
      const st = estado(g); st.s = +e.target.value / 100; aplica(g, st);
      e.target.nextElementSibling.textContent = e.target.value + '%';
    }else if(e.target.matches('[data-zoom]')){
      if(tFoco !== e.target){ guarda(); tFoco = e.target; }
      zoomFoto(+e.target.value / 100);
      e.target.nextElementSibling.textContent = e.target.value + '%';
    }
  });
  props.addEventListener('change', () => { tFoco = null; camadas(); });

  /* ── Foto: zoom e enquadramento dentro do slot (a imagem sempre cobre o quadro) ── */
  function fotoPartes(){
    const g = atual && atual.dataset.bloco === 'foto' ? atual : blocos().find(b => b.dataset.bloco === 'foto');
    const im = g && g.querySelector('#foto_produto image'), rc = g && g.querySelector('#foto_produto > rect');
    return im && rc ? { im, x: +rc.getAttribute('x'), y: +rc.getAttribute('y'), w: +rc.getAttribute('width'), h: +rc.getAttribute('height') } : null;
  }
  function poeFoto(f, z, px, py){
    const mx = (z - 1) * f.w / 2, my = (z - 1) * f.h / 2;
    px = Math.max(-mx, Math.min(mx, px)); py = Math.max(-my, Math.min(my, py));
    const w = f.w * z, h = f.h * z;
    Object.assign(f.im.dataset, { z, px, py });
    f.im.setAttribute('x', r1(f.x + (f.w - w) / 2 + px)); f.im.setAttribute('y', r1(f.y + (f.h - h) / 2 + py));
    f.im.setAttribute('width', r1(w)); f.im.setAttribute('height', r1(h));
  }
  function zoomFoto(z){ const f = fotoPartes(); if(f) poeFoto(f, z, +f.im.dataset.px || 0, +f.im.dataset.py || 0); }

  /* ── Mesa: selecionar, arrastar com ímã (margens 100/980, centro), enquadrar a foto ── */
  raiz.addEventListener('pointermove', e => {
    if(e.buttons) return;
    const g = e.target.closest ? e.target.closest('[data-bloco]') : null;
    if(g && g !== atual){ poe(paira, g); } else paira.hidden = true;
  });
  host.addEventListener('pointerleave', () => { paira.hidden = true; });
  raiz.addEventListener('pointerdown', e => {
    if(e.button !== 0) return;
    const g = e.target.closest ? e.target.closest('[data-bloco]') : null;
    if(g !== atual) seleciona(g);
    host.focus({ preventScroll: true });
    if(!g) return;
    e.preventDefault();
    const k = escala(), x0 = e.clientX, y0 = e.clientY, antes = svg.innerHTML;
    const hr = host.getBoundingClientRect(), sr = svg.getBoundingClientRect(), r0 = g.getBoundingClientRect();
    const L0 = (r0.left - sr.left) * k, Lw = r0.width * k, T0 = (r0.top - sr.top) * k, Th = r0.height * k;
    const e0 = estado(g), foto = enquadrar && g.dataset.bloco === 'foto' ? fotoPartes() : null;
    const f0 = foto ? { px: +foto.im.dataset.px || 0, py: +foto.im.dataset.py || 0, z: +foto.im.dataset.z || 1 } : null;
    let andou = false;
    const move = ev => {
      if(!andou && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 3) return;
      if(!andou) try{ host.setPointerCapture(e.pointerId); }catch(err){}
      andou = true;
      let dx = (ev.clientX - x0) * k, dy = (ev.clientY - y0) * k;
      if(foto){ poeFoto(foto, f0.z, f0.px + dx, f0.py + dy); return; }
      let gx = null, gy = null;
      if(!ev.altKey){
        for(const [alvo, borda] of [[M, L0 + dx], [W / 2, L0 + dx + Lw / 2], [W - M, L0 + dx + Lw]]) if(Math.abs(borda - alvo) < 8){ dx += alvo - borda; gx = alvo; break; }
        if(Math.abs(T0 + dy + Th / 2 - H / 2) < 8){ dy += H / 2 - (T0 + dy + Th / 2); gy = H / 2; }
      }
      aplica(g, { dx: e0.dx + dx, dy: e0.dy + dy, s: e0.s });
      guiaV.hidden = gx == null; guiaH.hidden = gy == null;
      if(gx != null) guiaV.style.left = (sr.left - hr.left + gx / k) + 'px';
      if(gy != null) guiaH.style.top = (sr.top - hr.top + gy / k) + 'px';
    };
    const solta = () => {
      host.removeEventListener('pointermove', move); host.removeEventListener('pointerup', solta); host.removeEventListener('pointercancel', solta);
      guiaV.hidden = guiaH.hidden = true;
      if(andou){ hist.push(antes); if(hist.length > 60) hist.shift(); fut.length = 0; mexeu = true; botoesHist(); marca(); }
    };
    host.addEventListener('pointermove', move); host.addEventListener('pointerup', solta); host.addEventListener('pointercancel', solta);
  });
  // Duplo clique no texto: seleciona o bloco e põe o cursor no campo dele, no painel
  raiz.addEventListener('dblclick', e => {
    const t = e.target.closest ? e.target.closest('text') : null, g = t && t.closest('[data-bloco]');
    if(!g) return;
    if(g !== atual) seleciona(g);
    const ts = [...g.querySelectorAll('text')].filter(x => tipoTexto(x)), i = ts.indexOf(t);
    const ta = props.querySelector('.cr-ed-campo[data-ti="' + Math.max(0, i) + '"] textarea');
    if(ta){ ta.focus(); ta.select(); ta.closest('.cr-ed-campo').classList.add('pisca'); setTimeout(() => ta.closest('.cr-ed-campo').classList.remove('pisca'), 700); }
  });
  // Desfazer/refazer na tela inteira do editor: fora de um campo de texto, o Ctrl+Z nativo do
  // navegador desfaria a ÚLTIMA caixa editada da página (a do pedido) — então ele é barrado aqui
  ed.addEventListener('keydown', e => {
    if(!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if(k !== 'z' && k !== 'y') return;
    if(e.target.matches('textarea') && e.target.closest('.cr-ed-painel')) return;   // o campo desfaz o próprio texto
    e.preventDefault(); e.stopPropagation();
    if(k === 'y' || e.shiftKey) refaz(); else desfaz();
  });
  host.addEventListener('keydown', e => {
    if(!atual) return;
    const p = e.shiftKey ? 10 : 2;
    const mv = { ArrowLeft: [-p, 0], ArrowRight: [p, 0], ArrowUp: [0, -p], ArrowDown: [0, p] }[e.key];
    if(mv){ e.preventDefault(); guarda(); const s = estado(atual); aplica(atual, { dx: s.dx + mv[0], dy: s.dy + mv[1], s: s.s }); }
    else if(e.key === 'Delete' || e.key === 'Backspace'){ e.preventDefault(); acao('remover'); }
    else if(e.key === 'Escape'){ e.stopPropagation(); seleciona(null); }
  });

  /* ── Ações do painel e do topo ── */
  function acao(a, b){
    const g = atual;
    if(a === 'desfazer') return desfaz();
    if(a === 'refazer') return refaz();
    if(a === 'cancelar') return fechar(null);
    if(a === 'salvar'){
      if(!mexeu) return fechar(null);
      const xml = new XMLSerializer().serializeToString(svg);
      return fechar({ svgFinal: xml, url: URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' })) });
    }
    if(b && b.dataset.cor){
      guarda();
      const fundo = svg.querySelector('[data-fundo]'); if(fundo) fundo.setAttribute('fill', b.dataset.cor);
      const pt = svg.querySelector('#pattern-ancorado'); if(pt) pt.setAttribute('color', b.dataset.cor === '#FF9000' ? '#F85400' : '#FF9000');
      return painel();
    }
    if(!g) return;
    if(a === 'remover'){ guarda(); g.remove(); return seleciona(null); }
    if(a === 'ocultar'){ guarda(); g.setAttribute('display', 'none'); return seleciona(null); }
    if(a === 'frente' || a === 'tras'){
      guarda();
      if(a === 'frente') svg.appendChild(g);
      else{ const ancora = svg.querySelector('#pattern-ancorado') || svg.querySelector('[data-fundo]'); ancora.after(g); }
      return tudo();
    }
    if(a === 'alEsq' || a === 'alCentro' || a === 'alDir'){
      guarda();
      const k = escala(), sr = svg.getBoundingClientRect(), r = g.getBoundingClientRect();
      const L = (r.left - sr.left) * k, Lw = r.width * k, e = estado(g);
      e.dx += a === 'alEsq' ? M - L : a === 'alDir' ? (W - M) - (L + Lw) : W / 2 - (L + Lw / 2);
      return aplica(g, e);
    }
    if(a === 'enquadrar'){ enquadrar = !enquadrar; host.classList.toggle('enquadrar', enquadrar); return painel(); }
    if(a === 'trocarFoto'){
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
      inp.onchange = () => {
        const f = inp.files && inp.files[0]; if(!f) return;
        crFotoLer(f).then(u => { const fp = fotoPartes(); if(!fp) return; guarda(); fp.im.setAttribute('href', u); })
          .catch(() => gToast('Não consegui ler essa imagem', 'error'));
      };
      inp.click();
    }
  }
  ed.addEventListener('click', e => {
    const b = e.target.closest('[data-ed],[data-cor]');
    if(b && !b.disabled) acao(b.dataset.ed, b);
  });
  const reposiciona = () => marca();
  window.addEventListener('resize', reposiciona, { passive: true });
  function fechar(nova){
    window.removeEventListener('resize', reposiciona);
    ed.classList.remove('aberto');
    setTimeout(() => ed.remove(), _crReduz() ? 0 : 220);
    if(nova){ aoSalvar(nova); gToast('Alterações salvas', 'success'); }
  }
  botoesHist();
  tudo();
  requestAnimationFrame(() => host.focus({ preventScroll: true }));
}

// Retorno no próprio botão: troca o rótulo por "Copiado" com o check e devolve depois
function _crOk(btn, rot){
  if(!btn || btn.classList.contains('cr-ok')) return;
  const html = btn.innerHTML;
  btn.classList.add('cr-ok');
  btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>' + rot;
  setTimeout(() => { btn.classList.remove('cr-ok'); btn.innerHTML = html; }, 1700);
}
function crCopiar(txt, btn){
  const ok = () => { _crOk(btn, 'Copiado'); gToast('Legenda copiada', 'success'); };
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, () => gToast('Não foi possível copiar', 'error'));
  else gToast('Não foi possível copiar', 'error');
}
function crBaixarPNG(v, btn){
  if(btn) btn.disabled = true;
  const im = new Image(), nl = CR_FORMATOS[v.spec.formato].laminas;
  if(nl) im.onload = () => {
    // carrossel: um PNG por lâmina (1080×1350), na ordem
    const base = 'luma-creative-' + v.spec.objetivo + '-carrossel-';
    for(let i = 0; i < nl; i++){
      const c = document.createElement('canvas'); c.width = 1080; c.height = v.h;
      c.getContext('2d').drawImage(im, -i * 1080, 0, v.w, v.h);
      c.toBlob(b => {
        if(!b) return;
        const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = base + (i + 1) + '.png';
        setTimeout(() => { document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, i * 400);
      }, 'image/png');
    }
    setTimeout(() => { if(btn) btn.disabled = false; _crOk(btn, 'Baixado'); gToast(nl + ' lâminas baixadas', 'success'); }, nl * 400);
  };
  else im.onload = () => {
    const k = CR_FORMATOS[v.spec.formato].png || 1;     // banner do app e capa saem @2x (skill §3.5)
    const c = document.createElement('canvas'); c.width = v.w * k; c.height = v.h * k;
    c.getContext('2d').drawImage(im, 0, 0, v.w * k, v.h * k);
    c.toBlob(b => {
      if(btn) btn.disabled = false;
      if(!b) return gToast('Não foi possível gerar o PNG', 'error');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = 'luma-creative-' + v.spec.objetivo + '-' + v.receita + '-' + v.spec.formato + '.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      _crOk(btn, 'Baixado'); gToast('PNG baixado', 'success');
    }, 'image/png');
  };
  im.onerror = () => { if(btn) btn.disabled = false; gToast('Não foi possível gerar o PNG', 'error'); };
  im.src = v.url;
}
