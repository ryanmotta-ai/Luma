/**
 * js/creative/creative.js
 *
 * Luma Creative — modo em TESTES, só a gestão (trava em main.js e na Edge Function `ai`).
 * Um chat que compõe arte nova. A IA (task `arte.compor`) NÃO desenha: devolve a composição em
 * JSON — qual das 5 diagramações aprovadas da skill luma-creative, a copy e os dados (preço,
 * cupom, anos). Quem desenha é crCompor, com os blocos oficiais da skill e já no contrato do
 * importador de SVG (data-luma / data-campo / g#foto_produto): "Abrir no Estúdio" vira template
 * sem retrabalho. Sem IA, crLerPedido lê o pedido (palavras-chave, preço, código, anos) e o
 * mesmo motor compõe. A legenda do post sai junto (fFetchAICaptionSuggestions, chat.js).
 *
 * Motor:  crCompor(spec) → {svg, campos, estouros}  ·  crEmbutir(svg) → SVG autônomo (base64)
 * Chat:   crEntrar (transição da aba) · crEnviar (pedido → briefing com perguntas → passos → arte + legenda)
 * Editor: crEditar — mexe no SVG na hora (arrastar blocos, texto, tamanho); salvar = nova versão
 * Foto:   anexo no pedido ou resposta à pergunta; entra recortada no slot foto_produto
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
  forte: { fam: 'Roboto', peso: 900, it: false, ls: 0 }
};
const CR_COMPOSICOES = {
  oferta:      'Oferta de produto',
  cupom:       'Cupom',
  evento:      'Evento na cidade',
  destaque:    'Destaque com palavra vazada',
  aniversario: 'Aniversário da franquia'
};
const CR_RECEITA = {
  oferta:      'Realce no herói + preço-assinatura',
  cupom:       'Roboto Light itálica × Black + Realce no valor',
  evento:      'Realce em duas linhas + selo de data',
  destaque:    'Roboto Black minúscula × Realce vazada',
  aniversario: 'Número em Realce + Roboto Black + frase leve/forte'
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
  if(foto){
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
// Botão pílula: cheio (branco, texto laranja) ou vazado (contorno branco)
function crBotao(x, y, txt, cheio, alinhaDireita){
  const z = 56, tw = crMede(txt, 'hero', z), w = Math.max(288, _r(tw + 128)), h = 96;
  const x0 = alinhaDireita ? x - w : x;
  const caixa = cheio
    ? '<rect x="' + _r(x0) + '" y="' + _r(y) + '" width="' + w + '" height="' + h + '" rx="48" fill="#FFFFFF" filter="url(#shs)"/>'
    : '<rect x="' + _r(x0) + '" y="' + _r(y) + '" width="' + w + '" height="' + h + '" rx="48" fill="none" stroke="#FFFFFF" stroke-width="4"/>';
  return { svg: caixa + crTexto(x0 + w / 2, y + 68, 'hero', z, cheio ? '#F85400' : '#FFFFFF', txt, ' text-anchor="middle"'), w };
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
    + ".forte{font-family:'Roboto',sans-serif;font-weight:900}\n</style>\n"
    + '<filter id="sh" x="-10%" y="-10%" width="125%" height="135%"><feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#434343" flood-opacity="0.25"/></filter>\n'
    + '<filter id="shs" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#434343" flood-opacity="0.2"/></filter>\n</defs>\n';
}
// Preço-assinatura: R$ e centavos sobrescritos (o importador lê como {{precoPor:inteiro}}/{{:centavos}})
function crPreco(x, y, por, larg){
  const m = /^(\d+)(?:,(\d{2}))?$/.exec(String(por).replace(/\s/g, ''));
  const int = m ? m[1] : String(por), cent = m ? ',' + (m[2] || '00') : '';
  let big = 168, sm = 92;
  const w = crMede('R$', 'hero', sm) + 6 + crMede(int, 'hero', big) + crMede(cent, 'hero', sm);
  if(w > larg){ const k = larg / w; big = Math.floor(big * k); sm = Math.floor(sm * k); }
  const dy = _r(big * 0.351);
  return '<text x="' + _r(x) + '" y="' + _r(y) + '" class="hero" font-size="' + big + '" data-campo="precoPor" fill="#F85400">'
    + '<tspan font-size="' + sm + '" dy="-' + dy + '">R$</tspan><tspan dy="' + dy + '" dx="6">' + crX(int) + '</tspan>'
    + (cent ? '<tspan font-size="' + sm + '" dy="-' + dy + '">' + crX(cent) + '</tspan>' : '') + '</text>';
}

/* ══════════════════════════════════════════════════════════════
   COMPOSIÇÕES — as 5 diagramações aprovadas, em feed (1080×1350) e story (1080×1920)
══════════════════════════════════════════════════════════════ */
function crArea(fmt){ return fmt === 'story' ? { H: 1920, top: 290, base: 1640, story: true } : { H: 1350, top: 80, base: 1250, story: false }; }

// Bloco = o que o editor (crEditar) move junto. Ganha transform ao arrastar; o importador lê a matriz.
const crBloco = (nome, svg) => svg ? '<g data-bloco="' + nome + '">' + svg + '</g>' : '';

const CR_MONTA = {
  // refino_01: logo · herói · apoio · foto · selo · card de preço sobreposto · botão vazado · legal
  oferta(sp, a, est){
    const out = [], lg = crLogo(CR_M, a.top, a.story);
    out.push(crBloco('logo', lg.svg));
    const h = crQuebra(sp.titulo, 'hero', a.story ? 170 : 151, CR_L, 96, est);
    const ys = h.linhas.map((l, i) => a.top + lg.h + 58 + h.size * 0.73 + i * h.size * 0.94);
    let y = ys[ys.length - 1];
    let tit = '<g id="produto">' + crHeroi(CR_M, ys, h.size, '#FFFFFF', h.linhas, ' data-campo="produto"') + '</g>';
    if(sp.apoio){ y += 68; tit += crTexto(CR_M, y, 'body', crCabe(sp.apoio, 'body', 40, sp.selo.length ? 660 : CR_L, 30, est), '#FFFFFF', sp.apoio); }
    out.push(crBloco('titulo', tit));
    const temPreco = !!sp.precoPor, cardH = sp.precoDe ? 310 : 250;
    const cardBot = a.base - 70, cardTop = cardBot - cardH;
    const fotoTop = y + 62, fotoBot = temPreco ? cardTop + 80 : cardBot - 96 - 40;
    out.push(crBloco('foto', crFoto(CR_M, fotoTop, CR_L, Math.max(200, fotoBot - fotoTop), 56, sp.fotoLegenda, sp.foto)));
    out.push(crBloco('selo', crSelo(880, fotoTop + 22, 100, sp.selo)));
    if(temPreco){
      let p = '<g data-sobrepoe="foto"><rect x="' + CR_M + '" y="' + _r(cardTop) + '" width="470" height="' + cardH + '" rx="36" fill="#FFFFFF" filter="url(#sh)"/><g id="preco">';
      let py = cardTop;
      if(sp.precoDe){ p += crTexto(148, py + 64, 'body', 40, '#434343', 'DE R$ ' + sp.precoDe, ' text-decoration="line-through" data-campo="precoDe"'); py += 58; }
      p += crTexto(150, py + 64, 'sup', 38, '#434343', 'POR') + crPreco(146, py + 206, sp.precoPor, 374) + '</g></g>';
      out.push(crBloco('preco', p));
      out.push(crBloco('botao', crBotao(980, cardBot - 96, sp.cta, false, true).svg));
    }else{
      out.push(crBloco('botao', crBotao(CR_M, cardBot - 96, sp.cta, true).svg));
    }
    out.push(crBloco('legal', crLegal(CR_M, a.base, sp.legal, '', est)));
    return out;
  },

  // refino_02: pattern · logo central · chamada leve/forte · valor gigante · ticket com código · legal
  cupom(sp, a, est){
    const out = [], k = a.story ? 1 : 0.9;
    const lg = crLogo(0, 0, a.story);
    const zc = Math.min(76 * k, ...sp.chamada.map(l => Math.floor(76 * k * CR_L / Math.max(1, crMedeMista(l, 76 * k)))));
    // valor: "R$" + número + OFF / NO SEU / PEDIDO (lockup medido)
    const pct = /%$/.test(sp.cupomValor), num = sp.cupomValor;
    let zn = 360 * k;
    const wR = pct ? 0 : crMede('R$', 'hero', 130 * k), wO = Math.max(crMede('OFF', 'forte', 150 * k), crMede('NO SEU', 'forte', 56 * k), crMede('PEDIDO', 'forte', 56 * k));
    const g1 = pct ? 0 : 22 * k, g2 = 36 * k;
    let wN = crMede(num, 'hero', zn);
    if(wR + g1 + wN + g2 + wO > CR_L){ zn = Math.floor(zn * (CR_L - wR - g1 - g2 - wO) / wN); wN = crMede(num, 'hero', zn); }
    const alturas = { logo: lg.h, chamada: zc * 0.75 + (sp.chamada.length - 1) * zc * 1.37, lockup: zn * 0.73, ticket: 324 * k };
    const gaps = [95 * k, 96 * k, 120 * k, 116 * k];
    const total = alturas.logo + gaps[0] + alturas.chamada + gaps[1] + alturas.lockup + gaps[2] + alturas.ticket + (sp.legal ? gaps[3] : 0);
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
    const tx = (CR_W - 880 * k) / 2, cx = tx + 222 * k, cl = 568 * k;
    out.push(crBloco('cupom', crTicket(tx, y, k)
      + '<g id="detalhes">' + crTexto(cx, y + 82 * k, 'sup', 34 * k, '#434343', sp.cupomRotulo)
      + crTexto(cx, y + 194 * k, 'hero', crCabe(sp.cupomCodigo, 'hero', 116 * k, cl, 60, est), '#F85400', sp.cupomCodigo, ' data-campo="codigo_cupom" data-larg="' + _r(cl) + '"')
      + '<line x1="' + _r(cx) + '" y1="' + _r(y + 222 * k) + '" x2="' + _r(cx + cl) + '" y2="' + _r(y + 222 * k) + '" stroke="#FFB900" stroke-width="3" stroke-linecap="round"/>'
      + (sp.apoio ? crTexto(cx, y + 272 * k, 'body', crCabe(sp.apoio, 'body', 32 * k, cl, 24, est), '#434343', sp.apoio, ' data-larg="' + _r(cl) + '"') : '') + '</g>'));
    y += 324 * k + gaps[3];
    out.push(crBloco('legal', crLegal(CR_W / 2, y, sp.legal, 'middle', est)));
    return out;
  },

  // refino_03: foto sangrando no topo · selo de data · herói em 2 linhas · apoio · botão cheio · logo no rodapé
  evento(sp, a, est){
    const out = [];
    const ctaTop = a.base - 165, apoioY = ctaTop - 36;
    const h = crQuebra(sp.titulo, 'hero', a.story ? 190 : 172, CR_L, 96, est);
    const ultima = sp.apoio ? apoioY - 76 : ctaTop - 60;
    const primeira = ultima - (h.linhas.length - 1) * h.size * 0.94;
    const fotoBot = primeira - h.size * 0.73 - 60;
    out.push(crBloco('foto', crFoto(-60, -60, 1200, fotoBot + 60, 56, sp.fotoLegenda || 'Use aqui a foto do evento', sp.foto)));
    // Selo na borda da foto; se o herói chega embaixo dele, sobe para dentro da foto (não cobre texto)
    const largH = Math.max(...h.linhas.map(l => crMede(l, 'hero', h.size)));
    out.push(crBloco('selo', crSelo(850, CR_M + largH + 30 > 850 - 120 ? fotoBot - 64 : fotoBot, 120, sp.selo)));
    out.push(crBloco('titulo', '<g id="produto">' + crHeroi(CR_M, h.linhas.map((l, i) => primeira + i * h.size * 0.94), h.size, '#FFFFFF', h.linhas, ' data-campo="titulo"') + '</g>'));
    if(sp.apoio) out.push(crBloco('apoio', crTexto(CR_M, apoioY, 'body', crCabe(sp.apoio, 'body', 40, CR_L, 30, est), '#FFFFFF', sp.apoio)));
    const b = crBotao(CR_M, ctaTop, sp.cta, true);
    out.push(crBloco('botao', b.svg));
    const lg = crLogo(0, 0, false);
    if(CR_M + b.w + 40 < 980 - lg.w) out.push(crBloco('logo', crLogo(980 - lg.w, ctaTop + 22, false).svg));
    out.push(crBloco('legal', crLegal(CR_M, a.base, sp.legal, '', est)));
    return out;
  },

  // refino_04: logo · palavra minúscula forte · herói vazado · apoio · foto · selo · botão cheio
  destaque(sp, a, est){
    const out = [], lg = crLogo(CR_M, a.top, a.story);
    out.push(crBloco('logo', lg.svg));
    const z1 = crCabe(sp.palavra, 'forte', a.story ? 250 : 190, CR_L, 90, est);
    const z2 = crCabe(sp.titulo, 'hero', a.story ? 380 : 290, CR_L, 120, est);
    let y = a.top + lg.h + 50 + z1 * 0.76;
    const b1 = y;
    y += z1 * 0.24 + 80 * (a.story ? 1 : 0.6) + z2 * 0.73;
    out.push(crBloco('titulo', '<g id="produto">' + crTexto(CR_M, b1, 'forte', z1, '#FFFFFF', sp.palavra, ' letter-spacing="-3"')
      + crTexto(CR_M, y, 'hero', z2, 'none', sp.titulo, ' stroke="#FFFFFF" stroke-width="7" stroke-linejoin="round" data-campo="titulo"') + '</g>'));
    if(sp.apoio){ y += 78; out.push(crBloco('apoio', crTexto(CR_M, y, 'body', crCabe(sp.apoio, 'body', 42, CR_L, 30, est), '#FFFFFF', sp.apoio))); }
    const ctaTop = sp.legal ? a.base - 70 - 96 : a.base - 76;
    const fotoTop = y + 72, fotoBot = ctaTop - 40;
    if(fotoBot - fotoTop >= 200){
      out.push(crBloco('foto', crFoto(CR_M, fotoTop, CR_L, fotoBot - fotoTop, 56, sp.fotoLegenda, sp.foto)));
      out.push(crBloco('selo', crSelo(880, fotoTop + 15, 100, sp.selo)));
    }
    out.push(crBloco('botao', crBotao(CR_M, ctaTop, sp.cta, true).svg));
    out.push(crBloco('legal', crLegal(CR_M, a.base, sp.legal, '', est)));
    return out;
  },

  // refino_14: logo · tag · número gigante + ANOS NA SUA CIDADE · frase leve/forte · ticket do presente · legal
  aniversario(sp, a, est){
    const out = [], lg = crLogo(CR_M, 0, a.story);
    const anoTxt = sp.anos === '1' ? 'ANO' : 'ANOS';
    let zn = 450;
    const wB = Math.max(crMede(anoTxt, 'forte', 144), crMede('NA SUA', 'forte', 86), crMede('CIDADE', 'forte', 86));
    let wN = crMede(sp.anos, 'hero', zn);
    if(wN + 24 + wB > CR_L){ zn = Math.floor(zn * (CR_L - 24 - wB) / wN); wN = crMede(sp.anos, 'hero', zn); }
    const zt = 40, tw = crMede(sp.topo, 'hero', zt), pw = Math.max(330, _r(tw + 64));
    const zc = Math.min(66, ...sp.chamada.map(l => Math.floor(66 * CR_L / Math.max(1, crMedeMista(l, 66)))));
    const total = lg.h + (sp.topo ? 38 + 70 : 0) + 35 + 450 * 0.73 + 104 + (sp.chamada.length - 1) * 80 + 78 + 324 + (sp.legal ? 136 : 0);
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
    out.push(crBloco('legal', crLegal(CR_M, ty + 324 + 116, sp.legal, '', est)));
    return out;
  }
};

// Completa o que faltou com o padrão das artes aprovadas. Nada aqui inventa preço: sem precoPor,
// a oferta sai sem card (só o botão). Cupom/anos/código são CAMPOS — o franqueado troca.
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
  const comp = CR_COMPOSICOES[s.composicao] ? s.composicao : 'oferta';
  const out = {
    composicao: comp,
    formato: s.formato === 'story' ? 'story' : 'feed',
    fundo: comp === 'cupom' ? 'pattern' : (s.fundo === 'pattern' ? 'pattern' : 'liso'),
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
    fotoLegenda: txt(s.fotoLegenda, 34),
    foto: /^data:image\/(png|jpeg|webp);base64,/.test(s.foto || '') ? s.foto : '',
    chamada: (Array.isArray(s.chamada) ? s.chamada : []).map(l => txt(l, 32)).filter(Boolean).slice(0, 2)
  };
  const P = {
    oferta:      { titulo: 'OFERTA DO DIA', apoio: 'Direto pelo app', cta: 'PEDIR' },
    cupom:       { chamada: ['pega este *cupom*', 'pra você *economizar!*'], cupomRotulo: 'USE O CÓDIGO', cupomCodigo: 'SEUCODIGO', cupomValor: '10' },
    evento:      { titulo: 'FESTIVAL', apoio: 'Direto pelo app', cta: 'VER NO APP' },
    destaque:    { palavra: 'entrega', titulo: 'GRÁTIS', apoio: 'em pedidos pelo app', cta: 'PEÇA AGORA' },
    aniversario: { topo: 'BORA COMEMORAR!', anos: '3', chamada: ['o aniversário é *nosso,*', 'o presente é *seu!*'], cupomRotulo: 'SEU PRESENTE', cupomCodigo: 'NIVERDM', cupomValor: '15' }
  }[comp];
  Object.keys(P).forEach(k => { if(!out[k] || (Array.isArray(out[k]) && !out[k].length)) out[k] = P[k]; });
  if(out.precoDe && !out.precoPor){ out.precoPor = out.precoDe; out.precoDe = ''; }
  if(comp === 'oferta' && !out.legal && out.precoPor) out.legal = 'Imagem ilustrativa. Oferta válida enquanto durarem os estoques.';
  return out;
}

// spec normalizado → SVG legível (asset: nos arquivos) + campos do template + textos que estouraram
function crCompor(bruto){
  const sp = crNormaliza(bruto), a = crArea(sp.formato), est = [];
  const corpo = CR_MONTA[sp.composicao](sp, a, est).filter(Boolean).join('\n');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" data-luma="1" viewBox="0 0 ' + CR_W + ' ' + a.H + '" width="' + CR_W + '" height="' + a.H + '">'
    + crDefs() + '<rect width="' + CR_W + '" height="' + a.H + '" fill="#F85400"/>\n'
    + (sp.fundo === 'pattern' ? CR_PATTERN.replace('{Y}', String(-720 - (1920 - a.H))) + '\n' : '') + corpo + '\n</svg>';
  const campos = [...new Set((svg.match(/data-campo="([^"]+)"/g) || []).map(m => m.slice(12, -1)))];
  if(/id="foto_produto"/.test(svg)) campos.push('foto_produto');
  return { svg, spec: sp, campos, estouros: est, w: CR_W, h: a.H };
}

/* Conferência leve da marca, sobre o SVG que saiu (não sobre a intenção) */
function crConfere(r){
  const cores = (r.svg.match(/#[0-9A-Fa-f]{6}\b/g) || []).map(c => c.toUpperCase());
  const fora = [...new Set(cores.filter(c => CR_PALETA.indexOf(c) < 0))];
  const tams = (r.svg.match(/font-size="(\d+)"/g) || []).map(m => +m.slice(11, -1));
  const menor = Math.min(...tams);
  return [
    { ok: !fora.length, t: fora.length ? 'Cor fora da paleta: ' + fora.join(', ') : 'Paleta oficial, zero subtons' },
    { ok: menor >= 22, t: menor >= 22 ? 'Nenhum texto abaixo de 22 px' : 'Texto com ' + menor + ' px' },
    { ok: !r.estouros.length, t: r.estouros.length ? 'Texto longo demais: ' + r.estouros[0] : 'Tudo cabe na margem de 100 px' },
    { ok: true, t: 'Realce e Roboto embutidas' }
  ];
}

/* Fecha a arte: asset:… vira base64 (SVG como imagem não carrega nada de fora) */
const _crAssetCache = new Map();
function _crAsset(rel){
  if(!_crAssetCache.has(rel)){
    _crAssetCache.set(rel, fetch(CR_BASE + rel).then(r => { if(!r.ok) throw new Error('asset ' + rel); return r.blob(); })
      .then(b => new Promise((ok, erro) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = erro; fr.readAsDataURL(b); }))
      .then(u => u.replace(/^data:[^;,]*/, 'data:' + (/\.woff2$/.test(rel) ? 'font/woff2' : 'image/png')))
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
function crLerPedido(texto, fmt){
  const t = String(texto || ''), n = t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const sp = { formato: /\bstor(y|ies)\b/.test(n) ? 'story' : (fmt || 'feed') };
  sp.composicao = /anivers/.test(n) ? 'aniversario'
    : /cupom|codigo/.test(n) ? 'cupom'
    : /(entrega|frete)\s+gratis|gratis/.test(n) ? 'destaque'
    : /evento|festival|feira|show|semana d|rodizio/.test(n) ? 'evento' : 'oferta';
  const reais = [...t.matchAll(/R\$\s*(\d+(?:[.,]\d{1,2})?)/gi)].map(m => m[1].replace('.', ','));
  const fmtR = v => /,/.test(v) ? v.replace(/,(\d)$/, ',$10') : v + ',00';
  const minimo = /(?:m[ií]nimo|acima)\s+(?:de\s+)?R\$\s*(\d+)/i.exec(t);
  const semMin = reais.filter(v => !minimo || v.split(',')[0] !== minimo[1]);
  const pct = /(\d{1,2})\s*%/.exec(t);
  const codigo = (t.match(/\b(?=[A-Z0-9]*[A-Z])[A-Z0-9]{5,14}\b/g) || []).find(c => !/^(OFERTA|CUPOM|STORY|FEED)$/.test(c));
  const anos = /(\d{1,2})\s*anos?\b/i.exec(t);
  if(minimo) sp.legal = 'Válido para pedidos acima de R$ ' + minimo[1] + '. Consulte as regras no app.';
  if(sp.composicao === 'oferta'){
    if(semMin.length >= 2){ const v = semMin.slice(0, 2).sort((a, b) => parseFloat(b.replace(',', '.')) - parseFloat(a.replace(',', '.'))); sp.precoDe = fmtR(v[0]); sp.precoPor = fmtR(v[1]); }
    else if(semMin.length) sp.precoPor = fmtR(semMin[0]);
    if(pct) sp.selo = [pct[1] + '%', 'OFF'];
    const prod = /(?:oferta|promo(?:ção|cao)?|arte|post)?\s*(?:de|do|da)?\s*([^:,.\d$]{3,40})/i.exec(t.replace(/^(arte|post|feed|story)\s+(de|do|da|para)?\s*/i, ''));
    if(prod) sp.titulo = prod[1].split(/\s+(?:para|pra|pro|no|na|neste|nesse|nessa|hoje|amanh[ãa]|esse|este|essa|desta|dessa|com)\b/i)[0]
      .replace(/\b(oferta|promo(ção|cao)?|arte|post|feed|story|de|do|da|por)\b/gi, ' ').replace(/\s{2,}/g, ' ').trim();
  }
  if(sp.composicao === 'cupom' || sp.composicao === 'aniversario'){
    if(pct) sp.cupomValor = pct[1] + '%'; else if(semMin.length) sp.cupomValor = semMin[0].split(',')[0];
    if(codigo) sp.cupomCodigo = codigo;
  }
  if(anos && sp.composicao === 'aniversario') sp.anos = anos[1];
  if(sp.composicao === 'destaque' && /frete/.test(n)) sp.palavra = 'frete';
  if(sp.composicao === 'evento'){
    const ev = /(festival|feira|semana|show|rod[ií]zio)((?:\s+(?!na\b|no\b|em\b|de\b|da\b|do\b|dia\b)[\wÀ-ú]+){0,2})/i.exec(t);
    if(ev) sp.titulo = ev[1] + ev[2];
    const data = /(\d{1,2})\s*(?:a|até)\s*(\d{1,2})\s*de\s*([a-zç]+)/i.exec(t);
    if(data) sp.selo = [data[1] + ' A ' + data[2], data[3]];
  }
  sp.resumo = 'Entendi: ' + CR_COMPOSICOES[sp.composicao].toLowerCase() + ', em ' + sp.formato + '. Compus com o motor local — a IA não respondeu.';
  return sp;
}

/* ══════════════════════════════════════════════════════════════
   BRIEFING — antes de compor, pergunta só o que muda a arte (como o Claude Code faz)
══════════════════════════════════════════════════════════════ */
const CR_COM_FOTO = { oferta: true, evento: true, destaque: true };
const _crReal = v => /,/.test(v) ? v.replace(/,(\d)$/, ',$10') : v + ',00';
const _crAspas = s => String(s || '').replace(/"""/g, '"');

// Sem IA: as perguntas saem do que crLerPedido NÃO achou no pedido. `campo` diz onde a resposta entra.
function crBriefingLocal(fio){
  const sp = crLerPedido(fio.pedido, fio.fmt), c = sp.composicao, q = [];
  if(!/\b(stor(y|ies)|feed)\b/i.test(fio.pedido)){
    const ops = [{ rotulo: 'Feed', desc: '1080 × 1350, post no perfil', valor: 'feed' }, { rotulo: 'Story', desc: '1080 × 1920, tela cheia', valor: 'story' }];
    q.push({ titulo: 'Formato', pergunta: 'Onde a arte vai ser postada?', campo: 'formato', livre: false, opcoes: fio.fmt === 'story' ? ops.reverse() : ops });
  }
  if(c === 'oferta' && !sp.precoPor) q.push({ titulo: 'Preço', pergunta: 'Qual o preço que vai na arte?', campo: 'precoPor', dica: 'Ex.: 22,90 — ou "de 28,00 por 22,90"', opcoes: [{ rotulo: 'Sem preço na arte', valor: '' }] });
  if((c === 'cupom' || c === 'aniversario') && !sp.cupomValor) q.push({ titulo: 'Desconto', pergunta: 'Qual o valor do desconto?', campo: 'cupomValor', dica: 'Ex.: 15 ou 20%', opcoes: [{ rotulo: 'R$ 10' }, { rotulo: 'R$ 15' }, { rotulo: '20%' }] });
  if((c === 'cupom' || c === 'aniversario') && !sp.cupomCodigo) q.push({ titulo: 'Código', pergunta: 'Qual o código do cupom?', campo: 'cupomCodigo', dica: 'Ex.: QUEROPIZZA', opcoes: [{ rotulo: 'Deixar para o franqueado preencher', valor: '' }] });
  if(c === 'aniversario' && !sp.anos) q.push({ titulo: 'Anos', pergunta: 'Quantos anos a franquia faz na cidade?', campo: 'anos', opcoes: [{ rotulo: '1' }, { rotulo: '2' }, { rotulo: '3' }, { rotulo: '5' }] });
  if(c === 'evento' && !(sp.selo && sp.selo.length)) q.push({ titulo: 'Data', pergunta: 'Quando é o evento?', campo: 'data', dica: 'Ex.: 10 a 20 de outubro', opcoes: [{ rotulo: 'Sem data na arte', valor: '' }] });
  return { resumo: 'Entendi: ' + CR_COMPOSICOES[c].toLowerCase() + '.', composicao: c, perguntas: q.slice(0, 3) };
}
function crPromptBriefing(fio){
  return [
    'Você é o diretor de arte da Delivery Much (app de delivery de cidades do interior do Brasil). A gestão pediu uma arte para redes sociais.',
    'ANTES de compor, faça o briefing: entenda o pedido e pergunte SÓ o que muda a arte e o pedido não responde.',
    '', 'PEDIDO: """' + _crAspas(fio.pedido).slice(0, 1200) + '"""',
    'FORMATO MARCADO NA TELA: ' + fio.fmt + '. FOTO ENVIADA: ' + (fio.foto ? 'sim' : 'não') + '.',
    '', 'DIAGRAMAÇÕES: oferta (produto + preço + foto), cupom (valor + código), evento (foto do local + data), destaque (benefício curto, ex. entrega grátis), aniversario (anos da franquia + presente).',
    '', 'REGRAS DAS PERGUNTAS:',
    '- No máximo 3. Se o pedido já basta, "perguntas": [].',
    '- Bons alvos: dado que vai impresso na arte e faltou (preço, valor e código do cupom, data do evento, anos da franquia, pedido mínimo), o foco da peça, o tom da chamada, feed ou story quando o pedido não diz.',
    '- NUNCA pergunte o que o pedido já diz. NUNCA pergunte de cor, fonte ou layout (é regra da marca). NÃO pergunte de foto (o Luma pergunta à parte).',
    '- titulo: até 12 caracteres ("Preço", "Formato"). pergunta: frase curta terminada em "?". opcoes: 2 a 4 respostas prováveis e curtas (até 40 caracteres); a pessoa também pode digitar outra.',
    '- NUNCA invente dado como opção (preço, código, data): para esses, ofereça só saídas como "Sem preço na arte" ou "Deixar para o franqueado preencher" — a pessoa digita o valor.',
    '- resumo: 1 frase do que você entendeu (tipo de arte, ponto focal, ação).',
    '', 'Responda SÓ o JSON:',
    '{"resumo":"","composicao":"oferta|cupom|evento|destaque|aniversario","perguntas":[{"titulo":"","pergunta":"","opcoes":["",""]}]}'
  ].join('\n');
}
async function crPedirBriefing(fio){
  if(typeof gAskAI !== 'function' || typeof gAiReady !== 'function' || !gAiReady()) return null;
  const j = (typeof gAiParseJson === 'function') ? gAiParseJson(await gAskAI('arte.compor', crPromptBriefing(fio), { json: true, cache: false })) : null;
  if(!j || typeof j !== 'object' || !CR_COMPOSICOES[j.composicao]) return null;
  const t = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  const perguntas = (Array.isArray(j.perguntas) ? j.perguntas : []).map(p => ({
    titulo: t(p && p.titulo, 14) || 'Pergunta', pergunta: t(p && p.pergunta, 140),
    opcoes: (Array.isArray(p && p.opcoes) ? p.opcoes : []).map(o => t(o, 48)).filter(Boolean).slice(0, 4).map(o => ({ rotulo: o }))
  })).filter(p => p.pergunta).slice(0, 3);
  return { resumo: t(j.resumo, 220), composicao: j.composicao, perguntas };
}
// + a pergunta da foto quando a diagramação leva foto e a pessoa ainda não mandou
function crPerguntasFinais(br, fio){
  const q = br.perguntas.slice(0, 3);
  if(CR_COM_FOTO[br.composicao] && !fio.foto){
    q.push({ tipo: 'foto', titulo: 'Foto', livre: false,
      pergunta: br.composicao === 'evento' ? 'Tem uma foto do local ou do evento?' : 'Tem a foto do produto?',
      opcoes: [{ rotulo: 'Deixar o espaço da foto', desc: 'o franqueado coloca a foto dele depois' }] });
  }
  return q;
}
// Respostas com `campo` entram direto na composição (determinístico, por cima do que a IA devolveu)
function crAplicaRespostas(sp, resp){
  const o = Object.assign({}, sp);
  (resp || []).forEach(r => {
    if(r.pulou || !r.campo) return;
    const v = String(r.valor != null ? r.valor : (r.resposta || '')).trim();
    if(r.campo === 'formato') o.formato = v.toLowerCase() === 'story' ? 'story' : 'feed';
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
function crPrompt(fio, evitar){
  const br = _crBriefingTexto(fio);
  return [
    'Você é o diretor de arte da Delivery Much (app de delivery de cidades do interior do Brasil). A gestão pediu uma arte para redes sociais.',
    'Você NÃO desenha: escolhe a diagramação e escreve a copy. O código desenha com os blocos oficiais da marca.',
    '', 'PEDIDO: """' + _crAspas(fio.pedido).slice(0, 1200) + '"""',
    br ? 'BRIEFING (respostas da pessoa — valem mais que o pedido):\n' + _crAspas(br).slice(0, 800) : '',
    'FORMATO: ' + fio.fmt + ' (se o pedido ou o briefing disserem outro, siga eles).',
    fio.foto ? 'FOTO: a pessoa enviou a foto. Use uma diagramação COM foto (oferta, evento ou destaque).' : '',
    evitar ? 'VARIAÇÃO: já saiu a diagramação "' + evitar + '". Escolha OUTRA diagramação que sirva ao pedido, ou a mesma com outra copy se só ela servir.' : '',
    '', 'DIAGRAMAÇÕES (escolha 1 em "composicao"):',
    '- "oferta": produto + foto + selo + card de preço de/por. Para produto com preço.',
    '- "cupom": chamada em 2 linhas + valor gigante do desconto + ticket com o código. Para cupom.',
    '- "evento": foto sangrando no topo + título em até 2 linhas + selo com a data + botão. Evento, festival, data especial na cidade.',
    '- "destaque": 1 palavra minúscula forte + 1 palavra gigante vazada + foto + selo + botão. Benefício curto: entrega grátis, frete, novidade.',
    '- "aniversario": número de anos gigante + ANOS NA SUA CIDADE + chamada + ticket do presente. Aniversário da franquia.',
    '', 'REGRAS DA COPY:',
    '- PT-BR, tom próximo e direto. Sem emoji, sem hashtag, sem aspas.',
    '- NUNCA invente preço, desconto, código, data ou número de anos que o pedido e o briefing não deram: campo sem informação = "".',
    '- titulo: o herói, até 22 caracteres, sem ponto final (oferta = nome do produto; evento = nome do evento; destaque = a palavra vazada, ex. "GRÁTIS").',
    '- palavra: só no destaque, 1 palavra minúscula (ex. "entrega").',
    '- chamada: 2 linhas curtas (até 22 caracteres cada), frase leve com 1 palavra forte entre *asteriscos*: "pega este *cupom*", "pra você *economizar!*".',
    '- apoio: 1 linha de até 40 caracteres.',
    '- selo: 1 ou 2 palavras curtas, ex. ["18%","OFF"], ["SÓ","HOJE"], ["10 A 20","OUTUBRO"]; [] se não couber.',
    '- cta: verbo curto em maiúsculas, até 12 caracteres (PEDIR, PEÇA AGORA, VER NO APP).',
    '- legal: 1 linha de letra miúda quando houver condição (pedido mínimo, validade); senão "".',
    '- precoDe/precoPor: número com vírgula ("28,00"). cupomValor: só o número ("15") ou com % ("20%"). anos: só o número.',
    '- topo: tag curta do aniversário (ex. "BORA COMEMORAR!").',
    '- fundo: "pattern" pede o grafismo da marca ao fundo (bom sem foto); senão "liso".',
    '- resumo: 1 frase para a gestão dizendo o que você fez: diagramação, ponto focal e ação.',
    '', 'Responda SÓ o JSON:',
    '{"resumo":"","composicao":"","formato":"feed|story","fundo":"liso|pattern","topo":"","chamada":["",""],"titulo":"","palavra":"","apoio":"","selo":[],"precoDe":"","precoPor":"","cupomValor":"","cupomCodigo":"","cupomRotulo":"","anos":"","cta":"","legal":""}'
  ].filter(l => l !== '').join('\n');
}
async function crPedirComposicao(fio, evitar){
  if(typeof gAskAI !== 'function' || typeof gAiReady !== 'function' || !gAiReady()) return null;
  const txt = await gAskAI('arte.compor', crPrompt(fio, evitar), { json: true, cache: false });
  const j = (typeof gAiParseJson === 'function') ? gAiParseJson(txt) : null;
  return (j && typeof j === 'object' && CR_COMPOSICOES[j.composicao]) ? j : null;
}
// Legenda do post: o motor do chat do franqueado (regras de preço, hashtag e SEO já moram lá)
function crLegenda(sp){
  if(typeof fFetchAICaptionSuggestions !== 'function') return Promise.resolve([]);
  const valor = sp.cupomValor ? (/%$/.test(sp.cupomValor) ? sp.cupomValor + ' OFF' : 'R$ ' + sp.cupomValor + ' OFF') : '';
  const dados = {
    produto: (sp.composicao === 'oferta' || sp.composicao === 'evento') ? sp.titulo : '',
    precoDe: sp.precoDe ? 'R$ ' + sp.precoDe : '', precoPor: sp.precoPor ? 'R$ ' + sp.precoPor : '',
    desconto: sp.composicao === 'cupom' || sp.composicao === 'aniversario' ? valor
      : sp.composicao === 'destaque' ? sp.palavra + ' ' + sp.titulo.toLocaleLowerCase('pt-BR') : sp.selo.join(' '),
    cupom: sp.composicao === 'cupom' || sp.composicao === 'aniversario' ? sp.cupomCodigo : ''
  };
  const nome = sp.composicao === 'aniversario' ? 'Aniversário de ' + sp.anos + ' anos da franquia' : 'Delivery Much';
  return fFetchAICaptionSuggestions(dados, { name: nome }, { id: sp.formato }).catch(() => []);
}

/* ══════════════════════════════════════════════════════════════
   CHAT — visual próprio e motion de terminal (spinner, passos, perguntas, digitação)
══════════════════════════════════════════════════════════════ */
const crState = { fmt: 'feed', rodando: null, saudou: false, fios: [], anexo: null, aoFoto: null };
const CR_GLIFOS = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'];
const CR_VERBOS = ['Compondo', 'Diagramando', 'Medindo', 'Equilibrando', 'Alinhando', 'Contrastando', 'Lapidando', 'Ajustando o kerning', 'Escolhendo o herói'];
const CR_EXEMPLOS = {
  oferta: 'Oferta de pizza calabresa: de R$ 28,00 por R$ 22,90, 18% off',
  cupom: 'Cupom QUEROPIZZA de R$ 15 para pedidos acima de R$ 40',
  evento: 'Festival gastronômico na cidade, de 10 a 20 de outubro',
  aniversario: 'Aniversário de 3 anos da franquia na cidade, presente: cupom NIVERDM15 de R$ 15, pedido mínimo de R$ 40',
  destaque: 'Entrega grátis hoje em pedidos acima de R$ 40',
  story: 'Story: cupom QUEROPIZZA de R$ 15'
};
const CR_NOME_BLOCO = { logo: 'Logo', titulo: 'Título', foto: 'Foto', selo: 'Selo', preco: 'Preço', botao: 'Botão', legal: 'Letra miúda',
  chamada: 'Chamada', valor: 'Valor', cupom: 'Cupom', apoio: 'Apoio', tag: 'Tag', anos: 'Anos' };
const _crReduz = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const _crEsp = ms => new Promise(r => setTimeout(r, _crReduz() ? 0 : ms));
const _crEl = id => document.getElementById(id);
const CR_ICO = {
  faisca: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/></svg>',
  baixar: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/></svg>',
  estudio: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m14.5 4.5 5 5L8 21H3v-5z"/></svg>',
  editar: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 9V5h4M15 5h4v4M19 15v4h-4M9 19H5v-4"/><path d="M9 12h6M12 9v6"/></svg>',
  refazer: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
  copiar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  foto: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/></svg>',
  desfazer: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>',
  lixo: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  menos: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M5 12h14"/></svg>',
  mais: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg>'
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
  if(!crState.saudou){ crState.saudou = true; crSaudar(); }
  setTimeout(() => { const i = _crEl('cr-pedido'); if(i && window.innerWidth > 760) i.focus({ preventScroll: true }); }, 380);
  crFontesProntas().catch(() => {});
}
function crSaudar(){
  const conv = _crEl('cr-conversa');
  if(!conv) return;
  const m = _crMsgIA(conv);
  _crDigita(m.querySelector('.cr-bolha'), 'O que vamos criar hoje? Conte o objetivo da arte — se tiver a foto do produto ou do local, anexe. Eu pergunto o que faltar, componho com as regras da marca e entrego com a legenda do post.');
}
function _crMsgIA(conv){
  const m = document.createElement('div');
  m.className = 'cr-msg cr-entra';
  m.innerHTML = '<div class="cr-ava cr-ava-ia" aria-hidden="true">' + CR_ICO.faisca + '</div><div class="cr-corpo"><div class="cr-bolha"></div></div>';
  conv.appendChild(m);
  _crRola();
  return m;
}
function _crRola(){ const p = _crEl('cr-palco'); if(p) requestAnimationFrame(() => p.scrollTo({ top: p.scrollHeight, behavior: _crReduz() ? 'auto' : 'smooth' })); }
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
  el.innerHTML = '<span class="cr-glifo" aria-hidden="true">✻</span><span class="cr-verbo">Compondo…</span><span class="cr-tempo">(0s · esc para interromper)</span>';
  host.appendChild(el);
  const g = el.querySelector('.cr-glifo'), v = el.querySelector('.cr-verbo'), tm = el.querySelector('.cr-tempo');
  const t0 = Date.now(); let f = 0, k = 0, parado = false;
  const giro = setInterval(() => { g.textContent = CR_GLIFOS[f++ % CR_GLIFOS.length]; }, 120);
  const relogio = setInterval(() => { tm.textContent = '(' + Math.floor((Date.now() - t0) / 1000) + 's · esc para interromper)'; }, 1000);
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
  li.innerHTML = '<div class="cr-passo-cab"><span class="cr-bola" aria-hidden="true">⏺</span><span class="cr-passo-tit"></span><small class="cr-passo-t"></small></div><div class="cr-passo-res" hidden><span aria-hidden="true">⎿</span><span class="cr-passo-txt"></span></div>';
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
      box.innerHTML = '<div class="cr-q-topo"><span class="cr-q-chip">' + gEsc(q.titulo) + '</span>' + (perguntas.length > 1 ? '<span class="cr-q-prog">' + (i + 1) + ' de ' + perguntas.length + '</span>' : '') + '</div>'
        + '<p class="cr-q-txt">' + gEsc(q.pergunta) + '</p><ol class="cr-q-ops" role="listbox" aria-label="' + gEsc(q.pergunta) + '">' + ops + '</ol>'
        + '<div class="cr-q-rodape"><span>↑↓ navega · Enter escolhe · 1–' + n + ' atalho · Esc interrompe</span><button type="button" class="cr-q-pular">Pular</button></div>';
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
document.addEventListener('dragover', e => { if(document.body.classList.contains('mode-creative')) e.preventDefault(); });
document.addEventListener('drop', e => {
  if(!document.body.classList.contains('mode-creative')) return;
  e.preventDefault();
  const f = [...((e.dataTransfer && e.dataTransfer.files) || [])].find(x => /^image\//.test(x.type));
  if(f) crAnexar(f);
});

function crUsarExemplo(chave){
  const i = _crEl('cr-pedido');
  if(!i || !CR_EXEMPLOS[chave]) return;
  if(chave === 'story') crFormato('story');
  i.value = CR_EXEMPLOS[chave];
  crAutoAltura(i);
  i.focus();
  i.setSelectionRange(i.value.length, i.value.length);
}
function crFormato(f){
  crState.fmt = f === 'story' ? 'story' : 'feed';
  document.querySelectorAll('#cr-formato button').forEach(b => {
    const on = b.dataset.fmt === crState.fmt;
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}
function crAutoAltura(el){ el.style.height = 'auto'; el.style.height = Math.min(160, el.scrollHeight) + 'px'; }
function crTecla(e){
  if(e.key === 'Enter' && !e.shiftKey && !e.isComposing){ e.preventDefault(); crEnviar(); }
}
document.addEventListener('keydown', e => {
  const r = crState.rodando;
  if(e.key === 'Escape' && r && document.body.classList.contains('mode-creative')){ r.parado = true; if(r.cancelar) r.cancelar(); }
});

function crEnviar(e, repetir){
  if(e && e.preventDefault) e.preventDefault();
  if(crState.rodando) return;
  const inp = _crEl('cr-pedido'), conv = _crEl('cr-conversa');
  const pedido = repetir ? repetir.pedido : String((inp && inp.value) || '').trim();
  if(!pedido || !conv) return;
  let fio = repetir;
  if(!repetir){
    fio = { pedido, fmt: crState.fmt, foto: crState.anexo, briefing: null, versoes: [] };
    crState.fios.push(fio);
    inp.value = ''; crAutoAltura(inp); crTirarAnexo();
    const m = document.createElement('div');
    m.className = 'cr-msg cr-eu cr-entra';
    const u = (typeof gCurrentUser === 'function' && gCurrentUser()) || {};
    const ini = String(u.nome || u.email || 'G').trim()[0] || 'G';
    m.innerHTML = '<div class="cr-ava" aria-hidden="true">' + gEsc(ini.toUpperCase()) + '</div><div class="cr-corpo">'
      + (fio.foto ? '<img class="cr-bolha-foto" alt="Foto enviada" src="' + fio.foto + '">' : '')
      + '<div class="cr-bolha">' + gEsc(pedido) + '</div></div>';
    conv.appendChild(m);
  }
  crGerar(fio, conv);
}

async function crGerar(fio, conv){
  const run = { parado: false, cancelar: null };
  crState.rodando = run;
  document.body.classList.add('cr-ocupado');
  const msg = _crMsgIA(conv), corpo = msg.querySelector('.cr-corpo');
  msg.querySelector('.cr-bolha').remove();
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
    const evitar = fio.versoes.length ? fio.versoes[fio.versoes.length - 1].spec.composicao : '';
    let p;
    // 1) Briefing: só na primeira vez (a 2ª versão reaproveita as respostas)
    if(!fio.briefing){
      p = _crPasso(lista, 'Entendendo o pedido');
      let br = null;
      try{ br = await crPedirBriefing(fio); }catch(err){ br = null; }
      if(!br) br = crBriefingLocal(fio);
      if(parou()) return;
      p.feito(br.resumo || CR_COMPOSICOES[br.composicao]);
      const perguntas = crPerguntasFinais(br, fio);
      fio.briefing = [];
      if(perguntas.length){
        status.parar();
        const resp = await _crPerguntar(corpo, perguntas, run);
        if(!resp || run.parado){ fio.briefing = null; aviso('Interrompido. Ajuste o pedido e mande de novo.'); return; }
        fio.briefing = resp;
        resp.forEach(r => { if(r.foto) fio.foto = r.foto; if(r.campo === 'formato' && !r.pulou) fio.fmt = r.valor === 'story' ? 'story' : 'feed'; });
        const ditas = resp.filter(r => !r.pulou).map(r => r.titulo + ': ' + r.resposta);
        _crPasso(lista, 'Briefing').feito(ditas.length ? ditas.join(' · ') : 'sem respostas — sigo com o padrão das artes aprovadas');
        status = _crStatus(corpo);
      }
    }

    // 2) Composição (IA → JSON; sem IA, a leitura local do pedido + briefing)
    p = _crPasso(lista, 'Escolhendo composição e receita tipográfica');
    let bruto = null, viaIA = false;
    try{ bruto = await crPedirComposicao(fio, evitar); viaIA = !!bruto; }catch(err){ bruto = null; }
    if(!bruto){
      bruto = crLerPedido(fio.pedido, fio.fmt);
      if(evitar && bruto.composicao === evitar) bruto.fundo = bruto.fundo === 'pattern' ? 'liso' : 'pattern';
    }
    bruto = crAplicaRespostas(bruto, fio.briefing);
    if(fio.foto) bruto.foto = fio.foto;
    if(parou()) return;
    const sp0 = crNormaliza(bruto);
    p.feito('"' + sp0.composicao + '" · ' + sp0.formato + ' · ' + CR_RECEITA[sp0.composicao] + (viaIA ? ' · IA' : ' · motor local'));

    // 3) Montagem + legenda em paralelo
    p = _crPasso(lista, 'Compondo a arte com os blocos da marca');
    await crFontesProntas();
    const r = crCompor(bruto);
    const legProm = crLegenda(r.spec);
    const svgFinal = await crEmbutir(r.svg);
    if(parou()) return;
    const blocos = (r.svg.match(/data-bloco=/g) || []).length;
    p.feito(blocos + ' blocos' + (fio.foto ? (CR_COM_FOTO[r.spec.composicao] ? ' · com a sua foto' : ' · esta diagramação não leva foto') : ''));

    p = _crPasso(lista, 'Conferindo paleta, tamanhos e contraste');
    const conf = crConfere(r);
    await _crEsp(200);
    p.feito(conf.filter(c => c.ok).length + '/' + conf.length + ' ok', conf.some(c => !c.ok));

    p = _crPasso(lista, 'Escrevendo a legenda do post');
    const leg = await legProm;
    if(parou()) return;
    p.feito(leg.length ? leg.length + ' opções' : 'sem legenda agora', !leg.length);

    status.parar();
    const versao = { ia: viaIA, svg: svgFinal, spec: r.spec, leg, w: r.w, h: r.h, url: URL.createObjectURL(new Blob([svgFinal], { type: 'image/svg+xml' })) };
    fio.versoes.push(versao);
    const fala = document.createElement('div'); fala.className = 'cr-bolha';
    corpo.appendChild(fala);
    await _crDigita(fala, (viaIA && r.spec.resumo) || ('Pronto: ' + CR_COMPOSICOES[r.spec.composicao].toLowerCase() + ' em ' + r.spec.formato + '. Se quiser, edite a arte aqui mesmo.'));
    conv.appendChild(_crResultado(fio, versao));
    _crRola();
    if(typeof gTrackEvent === 'function') try{ gTrackEvent('creative_arte', { composicao: r.spec.composicao, formato: r.spec.formato, ia: viaIA, foto: !!fio.foto, versao: fio.versoes.length }); }catch(err){}
  }catch(err){
    console.error('[creative]', err);
    status.parar();
    aviso('Não consegui compor a arte agora (' + ((err && err.message) || 'erro') + '). Tente de novo.');
  }finally{
    if(crState.rodando === run) crState.rodando = null;
    document.body.classList.remove('cr-ocupado');
  }
}

// A entrega: arte, legenda, versões e ações — sem bastidor (conferência e campos ficam nos passos)
function _crResultado(fio, v){
  const el = document.createElement('div');
  el.className = 'cr-resultado';
  const nome = 'Arte ' + CR_COMPOSICOES[v.spec.composicao].toLowerCase() + ' (' + v.spec.formato + ')';
  const origem = x => x.editada ? 'Editada por você · Testes' : (x.ia ? 'Composta pela IA' : 'Composta pelo motor local') + ' · Testes';
  const admin = typeof gIsAdmin === 'function' && gIsAdmin();
  el.innerHTML =
    '<div class="cr-arte-col"><div class="cr-arte" style="aspect-ratio:' + v.w + '/' + v.h + '"><img alt="' + gEsc(nome) + '" src="' + v.url + '"></div>'
    + '<span class="cr-selo-ia">' + origem(v) + '</span></div>'
    + '<div class="cr-lado">'
    + (v.leg.length ? '<section><h4>Legenda do post</h4><div class="cr-leg"><div class="cr-leg-abas" role="tablist">'
      + v.leg.map((l, i) => '<button type="button" role="tab" class="' + (i ? '' : 'on') + '" aria-selected="' + (i ? 'false' : 'true') + '" data-i="' + i + '">' + gEsc(l.label) + '</button>').join('')
      + '</div><p class="cr-leg-txt"></p><button type="button" class="cr-btn cr-btn-mini cr-leg-copiar">' + CR_ICO.copiar + 'Copiar legenda</button></div></section>' : '')
    + (fio.versoes.length > 1 ? '<div class="cr-versoes"><span>Versões</span>' + fio.versoes.map((x, i) => '<button type="button" class="' + (x === v ? 'on' : '') + '" data-i="' + i + '" aria-label="Versão ' + (i + 1) + (x.editada ? ' (editada)' : '') + '"><img alt="" src="' + x.url + '"></button>').join('') + '</div>' : '')
    + '<div class="cr-acoes">'
    + '<button type="button" class="cr-btn cr-prim" data-acao="png">' + CR_ICO.baixar + 'Baixar PNG</button>'
    + '<button type="button" class="cr-btn" data-acao="editar">' + CR_ICO.editar + 'Editar</button>'
    + '<button type="button" class="cr-btn" data-acao="refazer">' + CR_ICO.refazer + 'Gerar outra versão</button>'
    + (admin ? '<button type="button" class="cr-btn" data-acao="estudio">' + CR_ICO.estudio + 'Abrir no Estúdio</button>' : '')
    + '</div></div>';
  let atual = v;
  const img = el.querySelector('.cr-arte img'), ltxt = el.querySelector('.cr-leg-txt');
  const mostraLeg = i => {
    if(!ltxt) return;
    el.querySelectorAll('.cr-leg-abas button').forEach(b => { const on = +b.dataset.i === i; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    ltxt.textContent = (atual.leg[i] || atual.leg[0] || {}).text || '';
    ltxt.dataset.i = i;
  };
  mostraLeg(0);
  img.addEventListener('load', () => el.classList.add('cr-nitida'), { once: true });
  img.addEventListener('dblclick', () => crEditar(el, fio, atual));
  el.addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if(!b || b.closest('.cr-ed-barra')) return;
    if(b.closest('.cr-leg-abas')) return mostraLeg(+b.dataset.i);
    if(b.classList.contains('cr-leg-copiar')) return crCopiar(ltxt.textContent);
    if(b.closest('.cr-versoes')){
      atual = fio.versoes[+b.dataset.i] || atual;
      img.src = atual.url;
      el.querySelector('.cr-arte').style.aspectRatio = atual.w + '/' + atual.h;
      el.querySelector('.cr-selo-ia').textContent = origem(atual);
      el.querySelectorAll('.cr-versoes button').forEach(x => x.classList.toggle('on', x === b));
      return mostraLeg(+ltxt.dataset.i || 0);
    }
    if(b.dataset.acao === 'png') return crBaixarPNG(atual, b);
    if(b.dataset.acao === 'editar') return crEditar(el, fio, atual);
    if(b.dataset.acao === 'estudio') return crAbrirNoEstudio(atual);
    if(b.dataset.acao === 'refazer') return crEnviar(null, fio);
  });
  return el;
}

/* ══════════════════════════════════════════════════════════════
   EDITOR NA HORA — o SVG da arte vivo num shadow root (o <style> dele não vaza pro app).
   Arrasta bloco (guias na margem de 100 px e no centro), setas ajustam, duplo clique edita
   texto, tamanho e remover, Ctrl+Z. Salvar = nova versão (o importador lê os transforms).
══════════════════════════════════════════════════════════════ */
const CR_ED_CSS = ':host{display:block;position:relative;overflow:hidden;border-radius:10px;outline:none;box-shadow:0 18px 50px rgba(0,0,0,.45);touch-action:none}'
  + ':host(:focus-visible){box-shadow:0 0 0 2px var(--dm-orange),0 18px 50px rgba(0,0,0,.45)}'
  + 'svg{display:block;width:100%;height:auto;user-select:none;-webkit-user-select:none}'
  + '[data-bloco]{cursor:grab}'
  + 'svg .hero{font-family:"LC Realce","Realce",sans-serif}svg .sup,svg .body,svg .legal,svg .leve,svg .forte{font-family:"LC Roboto","Roboto",sans-serif}'
  + '.sel{position:absolute;pointer-events:none;border:1.5px solid var(--dm-yellow);border-radius:4px;box-shadow:0 0 0 1px rgba(0,0,0,.35)}'
  + '.sel::after{content:attr(data-nome);position:absolute;left:3px;top:3px;padding:2px 7px;border-radius:5px;background:var(--dm-yellow);color:var(--grafite);font:700 11px/1.4 Roboto,sans-serif;white-space:nowrap}'
  + '.guia{position:absolute;top:0;bottom:0;width:0;border-left:1px dashed var(--dm-yellow);pointer-events:none}'
  + '.ed-txt{position:absolute;z-index:2;max-width:calc(100% - 12px);padding:6px 8px;border-radius:8px;border:1.5px solid var(--dm-orange);background:var(--cr-surf);color:var(--cr-text);font:500 15px/1.4 Roboto,sans-serif;resize:none;outline:none;box-shadow:0 10px 30px rgba(0,0,0,.5)}'
  + '[hidden]{display:none!important}';
const _crNS = 'http://www.w3.org/2000/svg';

function crEditar(card, fio, v){
  if(card.classList.contains('cr-editando')) return;
  card.classList.add('cr-editando');
  const col = card.querySelector('.cr-arte-col'), lado = card.querySelector('.cr-lado');
  lado.hidden = true;
  const btn = (acao, ico, rot) => '<button type="button" class="cr-ed-btn" data-ed="' + acao + '" title="' + rot + '" aria-label="' + rot + '">' + ico + '</button>';
  col.innerHTML = '<div class="cr-ed-barra" role="toolbar" aria-label="Edição da arte">'
    + btn('desfazer', CR_ICO.desfazer, 'Desfazer (Ctrl+Z)') + '<span class="cr-ed-sep"></span>'
    + btn('menor', CR_ICO.menos, 'Diminuir o bloco') + btn('maior', CR_ICO.mais, 'Aumentar o bloco') + btn('remover', CR_ICO.lixo, 'Remover o bloco (Delete)')
    + '<span class="cr-ed-dica">Arraste para mover · duplo clique edita o texto · setas ajustam</span>'
    + '<span class="cr-ed-fim"><button type="button" class="cr-btn cr-btn-mini" data-ed="cancelar">Cancelar</button><button type="button" class="cr-btn cr-btn-mini cr-prim" data-ed="salvar">Salvar versão</button></span></div>'
    + '<div class="cr-ed-palco" tabindex="0" aria-label="Arte em edição" style="--cr-ar:' + (v.w / v.h) + '"></div>';
  const host = col.querySelector('.cr-ed-palco'), barra = col.querySelector('.cr-ed-barra');
  const raiz = host.attachShadow({ mode: 'open' });
  const st = document.createElement('style'); st.textContent = CR_ED_CSS; raiz.appendChild(st);
  const svg = document.importNode(new DOMParser().parseFromString(v.svg, 'image/svg+xml').documentElement, true);
  raiz.appendChild(svg);
  const caixa = document.createElement('div'); caixa.className = 'sel'; caixa.hidden = true; raiz.appendChild(caixa);
  const guia = document.createElement('div'); guia.className = 'guia'; guia.hidden = true; raiz.appendChild(guia);
  const W = v.w, hist = [];
  let atual = null;
  const r1 = n => Math.round(n * 10) / 10;
  const escala = () => W / svg.getBoundingClientRect().width;
  const guarda = () => { hist.push(svg.innerHTML); if(hist.length > 30) hist.shift(); };
  const estado = g => ({ dx: +g.dataset.dx || 0, dy: +g.dataset.dy || 0, s: +g.dataset.s || 1 });
  function aplica(g, e){
    g.dataset.dx = r1(e.dx); g.dataset.dy = r1(e.dy); g.dataset.s = Math.round(e.s * 1000) / 1000;
    let t = 'translate(' + r1(e.dx) + ',' + r1(e.dy) + ')';
    if(Math.abs(e.s - 1) > 0.001){
      if(!g.dataset.cx){ const b = g.getBBox(); g.dataset.cx = r1(b.x + b.width / 2); g.dataset.cy = r1(b.y + b.height / 2); }
      t += ' translate(' + g.dataset.cx + ',' + g.dataset.cy + ') scale(' + g.dataset.s + ') translate(' + (-g.dataset.cx) + ',' + (-g.dataset.cy) + ')';
    }
    g.setAttribute('transform', t);
    mostraSel();
  }
  function mostraSel(){
    const ok = !!(atual && atual.isConnected);
    caixa.hidden = !ok;
    barra.querySelectorAll('[data-ed="menor"],[data-ed="maior"],[data-ed="remover"]').forEach(b => { b.disabled = !ok; });
    barra.querySelector('[data-ed="desfazer"]').disabled = !hist.length;
    if(!ok) return;
    const hr = host.getBoundingClientRect(), r = atual.getBoundingClientRect();
    Object.assign(caixa.style, { left: (r.left - hr.left) + 'px', top: (r.top - hr.top) + 'px', width: r.width + 'px', height: r.height + 'px' });
    caixa.dataset.nome = CR_NOME_BLOCO[atual.dataset.bloco] || 'Bloco';
  }
  const seleciona = g => { atual = g || null; mostraSel(); };
  const desfaz = () => { if(!hist.length) return; svg.innerHTML = hist.pop(); seleciona(null); };
  const escalaBloco = f => { if(!atual) return; guarda(); const e = estado(atual); e.s = Math.min(2.5, Math.max(0.4, e.s * f)); aplica(atual, e); };
  const remove = () => { if(!atual) return; guarda(); atual.remove(); seleciona(null); };

  raiz.addEventListener('pointerdown', e => {
    if(e.button !== 0 || e.target.closest('.ed-txt')) return;
    const g = e.target.closest ? e.target.closest('[data-bloco]') : null;
    seleciona(g); host.focus({ preventScroll: true });
    if(!g) return;
    e.preventDefault();
    const e0 = estado(g), x0 = e.clientX, y0 = e.clientY, k = escala(), antes = svg.innerHTML;
    const hr = host.getBoundingClientRect(), sr = svg.getBoundingClientRect(), r0 = g.getBoundingClientRect();
    const L0 = (r0.left - sr.left) * k, Lw = r0.width * k;
    let mexeu = false;
    const move = ev => {
      if(!mexeu && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 3) return;
      // Captura só quando vira arrasto: capturar no pointerdown mandava o dblclick pro host
      // (fora do shadow root) e o duplo clique no texto nunca chegava
      if(!mexeu) try{ host.setPointerCapture(e.pointerId); }catch(err){}
      mexeu = true;
      let dx = (ev.clientX - x0) * k, dy = (ev.clientY - y0) * k, gx = null;
      // guias: margem esquerda (100), centro (540) e margem direita (980) — Alt solta o ímã
      if(!ev.altKey) for(const [alvo, borda] of [[CR_M, L0 + dx], [W / 2, L0 + dx + Lw / 2], [W - CR_M, L0 + dx + Lw]]){
        if(Math.abs(borda - alvo) < 8){ dx += alvo - borda; gx = alvo; break; }
      }
      aplica(g, { dx: e0.dx + dx, dy: e0.dy + dy, s: e0.s });
      guia.hidden = gx == null;
      if(gx != null) guia.style.left = (sr.left - hr.left + gx / k) + 'px';
    };
    const solta = () => {
      host.removeEventListener('pointermove', move); host.removeEventListener('pointerup', solta); host.removeEventListener('pointercancel', solta);
      guia.hidden = true;
      if(mexeu){ hist.push(antes); if(hist.length > 30) hist.shift(); mostraSel(); }
    };
    host.addEventListener('pointermove', move); host.addEventListener('pointerup', solta); host.addEventListener('pointercancel', solta);
  });
  raiz.addEventListener('dblclick', e => {
    const t = e.target.closest ? e.target.closest('text') : null;
    if(t && t.closest('[data-bloco]')) editaTexto(t);
  });
  host.addEventListener('keydown', e => {
    const alvo = e.composedPath()[0];
    if(alvo && alvo.tagName === 'TEXTAREA') return;
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z'){ e.preventDefault(); return desfaz(); }
    if(!atual) return;
    const p = e.shiftKey ? 10 : 2;
    const mv = { ArrowLeft: [-p, 0], ArrowRight: [p, 0], ArrowUp: [0, -p], ArrowDown: [0, p] }[e.key];
    if(mv){ e.preventDefault(); guarda(); const s = estado(atual); aplica(atual, { dx: s.dx + mv[0], dy: s.dy + mv[1], s: s.s }); }
    else if(e.key === 'Delete' || e.key === 'Backspace'){ e.preventDefault(); remove(); }
    else if(e.key === 'Enter'){ const t = atual.querySelector('text'); if(t){ e.preventDefault(); editaTexto(t); } }
    else if(e.key === 'Escape'){ e.stopPropagation(); seleciona(null); }
  });

  // Texto: simples, várias linhas (um <tspan y> por linha), frase leve/forte (*forte*) ou preço-assinatura
  function editaTexto(t){
    const filhos = [...t.children];
    const tipo = t.getAttribute('data-campo') === 'precoPor' ? 'preco'
      : filhos.some(c => c.hasAttribute('y')) ? 'linhas'
      : filhos.some(c => c.classList.contains('forte') || c.classList.contains('leve')) ? 'mista'
      : filhos.length ? '' : 'simples';
    if(!tipo) return gToast('Este texto não se edita aqui', 'info');
    const val = tipo === 'linhas' ? filhos.map(c => c.textContent).join('\n')
      : tipo === 'mista' ? filhos.map(c => c.classList.contains('forte') ? '*' + c.textContent + '*' : c.textContent).join('')
      : tipo === 'preco' ? t.textContent.replace(/^R\$\s*/, '') : t.textContent;
    const hr = host.getBoundingClientRect(), r = t.getBoundingClientRect();
    const ta = document.createElement('textarea');
    ta.className = 'ed-txt'; ta.value = val; ta.rows = tipo === 'linhas' ? Math.max(2, val.split('\n').length) : 1;
    ta.setAttribute('aria-label', 'Editar texto');
    if(tipo === 'mista') ta.title = 'A palavra entre *asteriscos* fica em destaque';
    Object.assign(ta.style, { left: Math.max(6, r.left - hr.left - 6) + 'px', top: Math.max(6, r.top - hr.top - 6) + 'px', width: Math.max(180, r.width + 12) + 'px' });
    raiz.appendChild(ta); ta.focus(); ta.select();
    let feito = false;
    const fecha = ok => {
      if(feito) return; feito = true;
      const nv = ta.value; ta.remove(); host.focus({ preventScroll: true });
      if(ok && nv.trim() && nv !== val){ guarda(); aplicaTexto(t, tipo, nv); mostraSel(); }
    };
    ta.addEventListener('keydown', ev => {
      ev.stopPropagation();
      if(ev.key === 'Escape'){ ev.preventDefault(); fecha(false); }
      else if(ev.key === 'Enter' && !(ev.shiftKey && tipo === 'linhas')){ ev.preventDefault(); fecha(true); }
    });
    ta.addEventListener('blur', () => fecha(true));
  }
  function aplicaTexto(t, tipo, nv){
    const up = s => t.classList.contains('hero') ? s.toLocaleUpperCase('pt-BR') : s;
    const span = (txt, attrs) => { const s = document.createElementNS(_crNS, 'tspan'); Object.keys(attrs || {}).forEach(a => s.setAttribute(a, attrs[a])); s.textContent = txt; return s; };
    if(tipo === 'preco'){
      const novo = new DOMParser().parseFromString('<svg xmlns="' + _crNS + '">' + crPreco(+t.getAttribute('x'), +t.getAttribute('y'), nv.replace(/[^\d,]/g, '') || '0', 374) + '</svg>', 'image/svg+xml').documentElement.firstElementChild;
      t.replaceWith(document.importNode(novo, true));
      return;
    }
    if(tipo === 'simples') t.textContent = up(nv.replace(/\s*\n+\s*/g, ' '));
    else if(tipo === 'linhas'){
      const ls = nv.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 3);
      const ts = [...t.children], x = ts[0].getAttribute('x'), y0 = +ts[0].getAttribute('y');
      const passo = ts[1] ? +ts[1].getAttribute('y') - y0 : (parseFloat(t.getAttribute('font-size')) || 100) * 0.94;
      t.textContent = '';
      ls.forEach((l, i) => t.appendChild(span(up(l), { x, y: Math.round(y0 + i * passo) })));
    }else if(tipo === 'mista'){
      t.textContent = '';
      crTrechos(nv.replace(/\s*\n+\s*/g, ' ')).forEach(r => t.appendChild(span(r.t, { class: r.cls })));
    }
    // Não deixa o texto novo passar do espaço dele: encolhe o corpo (mínimo 22 px, regra da marca)
    if(t.getAttribute('transform')) return;
    const anc = t.getAttribute('text-anchor'), x = +t.getAttribute('x') || +((t.children[0] || t).getAttribute('x')) || 0;
    const lim = +t.getAttribute('data-larg') || (anc === 'middle' ? CR_L : W - CR_M - x);
    const w = t.getBBox().width;
    if(w > lim){
      const k = lim / w;
      [t, ...t.querySelectorAll('[font-size]')].forEach(n => { const f = parseFloat(n.getAttribute('font-size')); if(f) n.setAttribute('font-size', Math.max(22, Math.floor(f * k))); });
    }
  }

  const fechar = nova => {
    const novo = _crResultado(fio, nova || v);
    card.replaceWith(novo);
    if(nova) gToast('Versão salva', 'success');
  };
  barra.addEventListener('click', e => {
    const b = e.target.closest('[data-ed]'); if(!b) return;
    const a = b.dataset.ed;
    if(a === 'desfazer') desfaz();
    else if(a === 'menor') escalaBloco(1 / 1.08);
    else if(a === 'maior') escalaBloco(1.08);
    else if(a === 'remover') remove();
    else if(a === 'cancelar') fechar(null);
    else if(a === 'salvar'){
      if(!hist.length) return fechar(null);
      const xml = new XMLSerializer().serializeToString(svg);
      const nova = Object.assign({}, v, { svg: xml, editada: true, url: URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' })) });
      fio.versoes.push(nova);
      fechar(nova);
    }
  });
  window.addEventListener('resize', mostraSel, { passive: true });
  mostraSel();
  requestAnimationFrame(() => { host.focus({ preventScroll: true }); card.scrollIntoView({ block: 'start', behavior: _crReduz() ? 'auto' : 'smooth' }); });
}

function crCopiar(txt){
  const ok = () => gToast('Legenda copiada', 'success');
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, () => gToast('Não foi possível copiar', 'error'));
  else gToast('Não foi possível copiar', 'error');
}
function crBaixarPNG(v, btn){
  if(btn) btn.disabled = true;
  const im = new Image();
  im.onload = () => {
    const c = document.createElement('canvas'); c.width = v.w; c.height = v.h;
    c.getContext('2d').drawImage(im, 0, 0, v.w, v.h);
    c.toBlob(b => {
      if(btn) btn.disabled = false;
      if(!b) return gToast('Não foi possível gerar o PNG', 'error');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = 'luma-creative-' + v.spec.composicao + '-' + v.spec.formato + '.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      gToast('PNG baixado', 'success');
    }, 'image/png');
  };
  im.onerror = () => { if(btn) btn.disabled = false; gToast('Não foi possível gerar o PNG', 'error'); };
  im.src = v.url;
}
// O importador de SVG do Estúdio lê o contrato (data-campo, foto_produto) e abre a revisão
async function crAbrirNoEstudio(v){
  if(typeof setMode !== 'function' || typeof dSvgHandleFile !== 'function') return gToast('Estúdio indisponível agora', 'error');
  setMode('designer');
  if(!document.body.classList.contains('mode-designer')) return;
  await dSvgHandleFile(v.svg, 'luma-creative-' + v.spec.composicao + '-' + v.spec.formato + '.svg');
}
