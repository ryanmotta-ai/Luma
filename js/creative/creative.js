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
 * Juiz:   crJulgar (task `arte.criticar`) — a IA olha os prints com a régua e aponta ajustes
 * Chat:   crEntrar (transição da aba) · crEnviar (pedido → briefing → copy → 3 opções + legenda)
 * Editor: crEditar — tela com painel (camadas, texto ao vivo, tamanho, alinhar, ordem, foto, fundo)
 * Foto:   anexo no pedido ou resposta à pergunta; sem foto a arte é tipográfica (a IA não gera imagem)
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
    + ".forte{font-family:'Roboto',sans-serif;font-weight:900}\n</style>\n"
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
   FORMATOS — um cadastro: banner do app, super banner e capa entram aqui (uma linha cada) quando
   chegarem com as referências. top/base = faixa útil do texto; fim = limite de baixo dos blocos.
══════════════════════════════════════════════════════════════ */
const CR_FORMATOS = {
  feed:  { nome: 'Feed',  desc: '1080 × 1350, post no perfil', h: 1350, top: 80,  base: 1250, fim: 1270, seguroTopo: 60,  seguroBase: 1290 },
  story: { nome: 'Story', desc: '1080 × 1920, tela cheia',     h: 1920, top: 290, base: 1640, fim: 1660, seguroTopo: 250, seguroBase: 1670 }
};
function crArea(fmt){
  const f = CR_FORMATOS[fmt] || CR_FORMATOS.feed;
  return { fmt: CR_FORMATOS[fmt] ? fmt : 'feed', H: f.h, top: f.top, base: f.base, fim: f.fim, seguroTopo: f.seguroTopo, seguroBase: f.seguroBase, story: fmt === 'story', p: {} };
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
  }
};

/* ══════════════════════════════════════════════════════════════
   DIAGRAMAÇÕES — a gramática. Cada uma é uma família aprovada (refino_* e referências) que a pilha
   adapta ao conteúdo. `peso` = curadoria (quanto a família serve ao objetivo); `foto` = exige foto
   (true) ou só sem foto (false). Família nova = uma entrada aqui.
══════════════════════════════════════════════════════════════ */
const _crSemFoto = sp => !sp.foto;
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
  { id: 'aniversarioPattern', nome: 'Anos com grafismo', foto: null, peso: { aniversario: 8 }, padrao: true, lockup: 'aniversario', formatos: ['story'] }
];
// Objetivo → receitas que servem (fotos e dados do conteúdo decidem o resto)
const CR_SERVE = { oferta: ['cardPreso', 'fotoTopo', 'fotoBase', 'duplo', 'centro', 'precoHeroi', 'tipoCentro', 'tipoDuplo'],
  evento: ['fotoTopo', 'fotoBase', 'duplo', 'centro', 'cardPreso', 'tipoCentro', 'tipoDuplo'],
  beneficio: ['vazado', 'fotoTopo', 'fotoBase', 'centro', 'tipoCentro'],
  cupom: ['valor', 'valorInclinado'], aniversario: ['aniversario', 'aniversarioPattern'] };

// Completa o que faltou com o padrão das artes aprovadas. Nada aqui inventa preço: sem precoPor,
// não há bloco de preço. Cupom/anos/código têm exemplo claro (o editor troca).
const CR_LEGADO = { destaque: 'beneficio', institucional: 'evento' };
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
    foto: /^data:image\/(png|jpeg|webp);base64,/.test(s.foto || '') ? s.foto : '',
    chamada: (Array.isArray(s.chamada) ? s.chamada : []).map(l => txt(l, 32)).filter(Boolean).slice(0, 2)
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
  let pecas = null;
  if(receita.lockup) pecas = CR_LOCKUPS[receita.lockup](sp, a, est, cor, receita.variante || {});
  else if(!sp.foto){
    // Sem foto, a tipografia é a arte: herói e preço crescem até a pilha encher (teto 1,45×) — o
    // conteúdo não "boia" no meio com faixas laranja vazias em cima e embaixo
    for(const kt of [1.45, 1.35, 1.25, 1.15, 1.05, 1]){
      est.length = 0; a.p = Object.assign({}, p || {}, { kt });
      pecas = crPilha(receita.pilha)(sp, a, est, cor);
      if(pecas && !est.length) break;
    }
  }else pecas = crPilha(receita.pilha)(sp, a, est, cor);
  if(!pecas) return null;
  // Pattern na regra de inversão (§3 item 9) e ancorado no rodapé; no feed sobe 570 (1920 − 1350)
  const padrao = receita.padrao && a.story ? CR_PATTERN.replace('#FF9000', cor === '#FF9000' ? '#F85400' : '#FF9000').replace('{Y}', String(-720 - (1920 - a.H))) + '\n' : '';
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" data-luma="1" viewBox="0 0 ' + CR_W + ' ' + a.H + '" width="' + CR_W + '" height="' + a.H + '">'
    + crDefs() + '<rect data-fundo="1" width="' + CR_W + '" height="' + a.H + '" fill="' + cor + '"/>\n' + padrao + pecas.filter(Boolean).join('\n') + '\n</svg>';
  const campos = [...new Set((svg.match(/data-campo="([^"]+)"/g) || []).map(m => m.slice(12, -1)))];
  if(/id="foto_produto"/.test(svg)) campos.push('foto_produto');
  return { svg, spec: sp, receita: receita.id, nomeReceita: receita.nome, fundo: cor, p: a.p, campos, estouros: est, w: CR_W, h: a.H };
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
    st.textContent = 'svg{display:block}svg .hero{font-family:"LC Realce","Realce",sans-serif}svg .sup,svg .body,svg .legal,svg .leve,svg .forte{font-family:"LC Roboto","Roboto",sans-serif}';
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
  const bs = _crMede(r.svg);
  const foto = bs.find(b => b.nome === 'foto');
  const solidos = bs.filter(b => b.nome !== 'foto');
  r.estouros.forEach(t => erros.push('Texto longo demais: ' + t));
  solidos.forEach(b => {
    if(b.x < CR_M - 6 || b.x + b.w > CR_W - CR_M + 6) erros.push(b.nome + ' fora da margem lateral');
    if(b.y < a.seguroTopo - 2 || b.y + b.h > a.seguroBase + 2) erros.push(b.nome + ' fora da zona útil');
    if(b.menorFonte && b.menorFonte < 22) erros.push(b.nome + ' com texto < 22 px');
  });
  // Colisão: só a lista fechada da §2.2 pode sobrepor a foto (selo na quina, card de preço)
  for(let i = 0; i < bs.length; i++) for(let j = i + 1; j < bs.length; j++){
    const p = bs[i], q = bs[j];
    const ix = Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x), iy = Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y);
    const comFoto = p.nome === 'foto' || q.nome === 'foto', outro = p.nome === 'foto' ? q : p;
    if(comFoto && (outro.nome === 'selo' || (outro.nome === 'preco' && outro.sobre))) continue;
    if(ix > 0 && iy > 0) erros.push('Colisão: ' + p.nome + ' × ' + q.nome);
    else if(ix > 0 && iy > -24 && !(p.nome === 'titulo' || q.nome === 'titulo')) avisos.push('Vão curto: ' + p.nome + ' × ' + q.nome);
  }
  // Faixa vazia na zona útil (o conteúdo "boiando")
  const ocupado = bs.map(b => [Math.max(a.seguroTopo, b.y), Math.min(a.seguroBase, b.y + b.h)]).filter(v => v[1] > v[0]).sort((u, v) => u[0] - v[0]);
  let cursor = a.seguroTopo, maiorVazio = 0;
  ocupado.forEach(([y0, y1]) => { maiorVazio = Math.max(maiorVazio, y0 - cursor); cursor = Math.max(cursor, y1); });
  maiorVazio = Math.max(maiorVazio, a.seguroBase - cursor);
  if(maiorVazio > 220) avisos.push('Faixa vazia de ' + _r(maiorVazio) + ' px');
  // Hierarquia: herói ≥ 2,5× o apoio; herói ≥ 80 (110 sobre #FF9000); preço ≥ 96
  const tit = bs.find(b => b.nome === 'titulo' || b.nome === 'valor' || b.nome === 'anos'), ap = bs.find(b => b.nome === 'apoio');
  const heroi = tit ? tit.maiorFonte : 0;
  if(tit && heroi < (r.fundo === '#FF9000' ? 110 : 80)) erros.push('Herói pequeno (' + heroi + ' px)');
  if(tit && ap && heroi < ap.maiorFonte * 2.5) avisos.push('Herói menos de 2,5× o apoio');
  const pr = bs.find(b => b.nome === 'preco');
  if(pr && pr.maiorFonte < 96) erros.push('Preço pequeno (' + pr.maiorFonte + ' px)');
  if(r.fundo === '#FF9000' && (sp.legal || (pr && !pr.sobre) || (ap && ap.maiorFonte < 36))) erros.push('Fundo #FF9000 com preço, legal ou apoio pequeno direto (contraste)');
  const fracFoto = foto ? Math.min(foto.h, a.fim - a.top) / (a.fim - a.top) : 0;
  return { erros, avisos, blocos: bs, heroi, preco: pr ? pr.maiorFonte : 0, fracFoto, maiorVazio };
}
// Nota 0–100: curadoria da família + escala do herói/preço + foto na faixa certa + respiro
function crNota(r, av){
  const a = crArea(r.spec.formato), rec = CR_RECEITAS.find(x => x.id === r.receita) || {};
  const lim = (v, a0, a1) => Math.max(0, Math.min(1, (v - a0) / (a1 - a0)));
  let n = 50 + (rec.peso && rec.peso[r.spec.objetivo] || 0) * 2;
  n += lim(av.heroi, 90, a.story ? 200 : 170) * 14;
  if(r.spec.precoPor) n += lim(av.preco, 110, a.story ? 200 : 180) * 8;
  if(av.fracFoto) n += Math.max(0, 1 - Math.abs(av.fracFoto - 0.45) / 0.2) * 8;
  n -= Math.min(24, Math.max(0, av.maiorVazio - 140) / 10);
  n -= av.avisos.length * 4;
  return Math.round(Math.max(0, Math.min(100, n)));
}

/* Todas as diagramações que servem ao conteúdo, montadas, conferidas e com nota (melhor primeiro) */
function crCandidatos(bruto, p){
  const sp = crNormaliza(bruto), lista = [];
  (CR_SERVE[sp.objetivo] || []).forEach(id => {
    const rec = CR_RECEITAS.find(x => x.id === id);
    if(!rec || (rec.foto === true && !sp.foto) || (rec.foto === false && sp.foto) || (rec.serve && !rec.serve(sp))
      || (rec.formatos && rec.formatos.indexOf(sp.formato) < 0)) return;
    (rec.fundos || ['#F85400']).forEach(cor => {
      const r = crMontar(sp, rec, cor, p);
      if(!r) return;
      const av = crAvaliar(r);
      r.avaliacao = av; r.nota = av.erros.length ? 0 : crNota(r, av);
      lista.push(r);
    });
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

/* Conferência leve da marca, sobre o SVG que saiu (não sobre a intenção) */
function crConfere(r){
  const cores = (r.svg.replace(/href="data:[^"]*"/g, '').match(/#[0-9A-Fa-f]{6}\b/g) || []).map(c => c.toUpperCase());
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
    'PEÇA: ' + CR_OBJETIVOS[sp.objetivo] + ' — ' + [sp.palavra, sp.titulo].filter(Boolean).join(' ') + (sp.precoPor ? ', por R$ ' + sp.precoPor : '') + '.',
    'CONTEXTO FIXO (não critique): paleta fechada (#F85400, #FF9000, #FFB900, #434343, branco), títulos em Realce e textos em Roboto, logo branco, sem imagem gerada por IA, faixas de 250 px vazias no topo e na base do story.',
    'Para cada opção: notas 0–5 em foco (um ponto focal claro), hierarquia, respiro, contraste e acabamento; compare com a régua: o que ela tem que a opção não tem?',
    'Teste do celular: a ~360 px de largura, o herói, o preço e o ponto focal se leem de relance?',
    'porque: 1 frase de até 70 caracteres com o ponto forte da opção, para mostrar à pessoa (ex.: "Preço é o ponto focal e a foto ganha espaço").',
    'ajustes: até 2 desta lista fechada, só se fizerem diferença real: heroiMaior, heroiMenor, fotoMaior, fotoMenor, semApoio, semSelo.',
    'Responda SÓ o JSON: {"opcoes":[{"notas":{"foco":0,"hierarquia":0,"respiro":0,"contraste":0,"acabamento":0},"porque":"","ajustes":[]}]}'
  ].join('\n');
}
// → [{nota, porque, ajustes}] na ordem das opções, ou null (sem IA, falha, resposta torta)
async function crJulgar(tres){
  if(!tres.length || typeof gAskAI !== 'function' || typeof gAiReady !== 'function' || !gAiReady()) return null;
  const sp = tres[0].spec;
  const regua = (CR_REGUA[sp.objetivo] || []).slice(0, 2);
  const refs = (await Promise.all(regua.map(f => _crJpeg(_crRaiz() + 'assets/templates/refino/prints/' + f, 432).catch(() => null)))).filter(Boolean);
  const ops = await Promise.all(tres.map(crArteJpeg));
  const parts = refs.concat(ops).map(d => ({ mimeType: 'image/jpeg', data: d }));
  const j = (typeof gAiParseJson === 'function') ? gAiParseJson(await gAskAI('arte.criticar', crPromptJuiz(sp, refs.length, tres.length), { json: true, cache: false, parts })) : null;
  const lista = j && Array.isArray(j.opcoes) ? j.opcoes : null;
  if(!lista || lista.length < tres.length) return null;
  return tres.map((r, i) => {
    const o = lista[i] || {}, nt = o.notas || {};
    const vals = ['foco', 'hierarquia', 'respiro', 'contraste', 'acabamento'].map(k => Math.max(0, Math.min(5, +nt[k] || 0)));
    return { nota: vals.reduce((a, b) => a + b, 0) / vals.length, piores: Math.min(...vals),
      porque: String(o.porque || '').trim().slice(0, 90), ajustes: (Array.isArray(o.ajustes) ? o.ajustes : []).filter(x => CR_AJUSTES[x]).slice(0, 2) };
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
// Formato que o próprio pedido diz ("story", "feed"…), pelo cadastro — '' se não diz
function _crFormatoDito(t){
  const n = String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return Object.keys(CR_FORMATOS).find(f => new RegExp('\\b' + f + (f === 'story' ? '|\\bstories' : '') + '\\b').test(n)) || '';
}
function crLerPedido(texto, fmt){
  const t = String(texto || ''), n = t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const sp = { formato: _crFormatoDito(t) || fmt || 'feed' };
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
    const prod = /(?:oferta|promo(?:ção|cao)?|arte|post)?\s*(?:de|do|da)?\s*([^:,.\d$]{3,40})/i.exec(t.replace(/^(arte|post|feed|story)\s+(de|do|da|para)?\s*/i, ''));
    if(prod) sp.titulo = prod[1].split(/\s+(?:para|pra|pro|no|na|neste|nesse|nessa|hoje|amanh[ãa]|esse|este|essa|desta|dessa|com)\b/i)[0]
      .replace(/\b(oferta|promo(ção|cao)?|arte|post|feed|story|de|do|da|por)\b/gi, ' ').replace(/\s{2,}/g, ' ').trim();
  }
  if(sp.objetivo === 'cupom' || sp.objetivo === 'aniversario'){
    if(pct) sp.cupomValor = pct[1] + '%'; else if(semMin.length) sp.cupomValor = semMin[0].split(',')[0];
    if(codigo) sp.cupomCodigo = codigo;
  }
  if(anos && sp.objetivo === 'aniversario') sp.anos = anos[1];
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
    'Você é o diretor de arte da Delivery Much (app de delivery de cidades do interior do Brasil). A gestão pediu uma arte para redes sociais.',
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
  const f = _crPerguntaFormato(fio), q = (f ? [f] : []).concat(br.perguntas.slice(0, f ? 2 : 3));
  if(CR_COM_FOTO[br.objetivo] && !fio.foto){
    q.push({ tipo: 'foto', titulo: 'Foto', livre: false,
      pergunta: br.objetivo === 'evento' ? 'Tem uma foto do local ou do evento?' : 'Tem a foto do produto?',
      opcoes: [{ rotulo: 'Sem foto', desc: 'a arte fica só com tipografia' }] });
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
function crPrompt(fio){
  const br = _crBriefingTexto(fio);
  return [
    'Você é o redator e diretor de arte da Delivery Much (app de delivery de cidades do interior do Brasil). A gestão pediu uma arte para redes sociais.',
    'Você NÃO desenha nem escolhe layout: entende a mensagem e escreve a copy. O motor do Luma diagrama com os blocos oficiais e mostra 3 opções.',
    '', 'PEDIDO: """' + _crAspas(fio.pedido).slice(0, 1200) + '"""',
    br ? 'BRIEFING (respostas da pessoa — valem mais que o pedido):\n' + _crAspas(br).slice(0, 800) : '',
    'FORMATO: ' + (CR_FORMATOS[fio.fmt] || CR_FORMATOS.feed).nome + '. ' + (fio.foto ? 'Há foto do produto/local.' : 'Sem foto: a arte é só tipografia — a copy precisa segurar a peça sozinha.'),
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
    '- resumo: 1 frase para a gestão: a mensagem, o ponto focal e a ação.',
    '', 'Responda SÓ o JSON:',
    '{"resumo":"","objetivo":"","topo":"","chamada":["",""],"titulo":"","palavra":"","apoio":"","selo":[],"precoDe":"","precoPor":"","cupomValor":"","cupomCodigo":"","cupomRotulo":"","anos":"","cta":"","legal":""}'
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
const crState = { rodando: null, saudou: false, fios: [], anexo: null, aoFoto: null };
const CR_GLIFOS = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'];
const CR_VERBOS = ['Compondo', 'Diagramando', 'Medindo', 'Equilibrando', 'Alinhando', 'Contrastando', 'Lapidando', 'Ajustando o kerning', 'Escolhendo o herói'];
const CR_NOME_BLOCO = { logo: 'Logo', titulo: 'Título', foto: 'Foto', selo: 'Selo', preco: 'Preço', botao: 'Botão', legal: 'Letra miúda',
  chamada: 'Chamada', valor: 'Valor', cupom: 'Cupom', apoio: 'Apoio', tag: 'Tag', anos: 'Anos' };
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
  if(!crState.saudou){ crState.saudou = true; crSaudar(); }
  setTimeout(() => { const i = _crEl('cr-pedido'); if(i && window.innerWidth > 760) i.focus({ preventScroll: true }); }, 380);
  crFontesProntas().catch(() => {});
}
function crSaudar(){
  const conv = _crEl('cr-conversa');
  if(!conv) return;
  const m = _crMsgIA(conv);
  _crDigita(m.querySelector('.cr-bolha'), 'O que vamos criar hoje? Conte o objetivo da arte e anexe a foto do produto ou do local, se tiver. Eu pergunto o que faltar e entrego 3 opções com a legenda do post.');
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

function crAutoAltura(el){ el.style.height = 'auto'; el.style.height = Math.min(160, el.scrollHeight) + 'px'; }
function crTecla(e){
  if(e.key === 'Enter' && !e.shiftKey && !e.isComposing){ e.preventDefault(); crEnviar(); }
}
document.addEventListener('keydown', e => {
  const r = crState.rodando;
  if(e.key === 'Escape' && r && document.body.classList.contains('mode-creative')){ r.parado = true; if(r.cancelar) r.cancelar(); }
});

function crEnviar(e){
  if(e && e.preventDefault) e.preventDefault();
  if(crState.rodando) return;
  const inp = _crEl('cr-pedido'), conv = _crEl('cr-conversa');
  const pedido = String((inp && inp.value) || '').trim();
  if(!pedido || !conv) return;
  const fio = { pedido, fmt: _crFormatoDito(pedido) || 'feed', foto: crState.anexo, briefing: null, conteudo: null, legenda: null, mostradas: [], viaIA: false };
  crState.fios.push(fio);
  inp.value = ''; crAutoAltura(inp); crTirarAnexo();
  const m = document.createElement('div');
  m.className = 'cr-msg cr-eu cr-entra';
  m.innerHTML = '<div class="cr-corpo">' + (fio.foto ? '<img class="cr-bolha-foto" alt="Foto enviada" src="' + fio.foto + '">' : '')
    + '<div class="cr-bolha">' + gEsc(pedido) + '</div></div>';
  conv.appendChild(m);
  crGerar(fio, conv);
}
function crOutrasOpcoes(fio){
  if(crState.rodando) return;
  crGerar(fio, _crEl('cr-conversa'), true);
}

async function crGerar(fio, conv, outras){
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
        resp.forEach(r => { if(r.foto) fio.foto = r.foto; if(r.campo === 'formato' && !r.pulou && CR_FORMATOS[r.valor]) fio.fmt = r.valor; });
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
      bruto.foto = fio.foto || '';
      if(parou()) return;
      fio.conteudo = bruto;
      const sp0 = crNormaliza(bruto);
      p.feito([sp0.palavra, sp0.titulo].filter(Boolean).join(' ') + (sp0.precoPor ? ' · R$ ' + sp0.precoPor : '') + (fio.viaIA ? ' · IA' : ' · motor local'));
      fio.legProm = crLegenda(sp0);   // a legenda corre em paralelo e chega junto
    }

    // 3) Diagramação: todas as famílias que servem, conferidas pelas regras da marca
    p = _crPasso(lista, outras ? 'Diagramando outros caminhos' : 'Diagramando as opções');
    await crFontesProntas();
    // Cada rodada de "Outras opções" muda as proporções: família que volta não volta idêntica
    fio.rodada = (fio.rodada || 0) + (outras ? 1 : 0);
    const variacao = [null, { kh: 1.12, kf: 0.88 }, { kh: 0.92, kf: 1.12 }][fio.rodada % 3];
    const cands = crCandidatos(fio.conteudo, variacao);
    let tres = crEscolher3(cands, fio.mostradas);
    if(!tres.length) throw new Error('nenhuma diagramação passou nas regras da marca');
    p.feito(cands.length + ' diagramações testadas · ' + cands.filter(c => !c.avaliacao.erros.length).length + ' aprovadas nas regras da marca');

    // 4) Juiz: os prints lado a lado com a régua, 1 rodada de ajuste
    p = _crPasso(lista, 'Revisando os prints com a régua da marca');
    let juiz = null;
    try{ juiz = await crJulgar(tres); }catch(err){ juiz = null; }
    if(parou()) return;
    if(juiz){
      tres = tres.map((r, i) => { const n = crRefinar(r, juiz[i].ajustes); n.juiz = juiz[i]; return n; }).sort((u, v) => v.juiz.nota - u.juiz.nota);
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
    await _crDigita(fala, outras ? 'Mais ' + opcoes.length + ' caminhos, de famílias diferentes das anteriores.'
      : ((fio.viaIA && opcoes[0].spec.resumo) ? opcoes[0].spec.resumo + ' ' : '') + 'Separei ' + opcoes.length + ' opções em ' + f.nome.toLowerCase() + ': escolha uma, ajuste no editor se quiser e baixe.');
    conv.appendChild(_crEntrega(fio, opcoes));
    _crRola();
    if(typeof gTrackEvent === 'function') try{ gTrackEvent('creative_arte', { objetivo: opcoes[0].spec.objetivo, formato: opcoes[0].spec.formato, ia: fio.viaIA, juiz: !!juiz, foto: !!fio.foto, receitas: opcoes.map(o => o.receita).join(',') }); }catch(err){}
  }catch(err){
    console.error('[creative]', err);
    status.parar();
    aviso('Não consegui compor a arte agora (' + ((err && err.message) || 'erro') + '). Tente de novo.');
  }finally{
    if(crState.rodando === run) crState.rodando = null;
    document.body.classList.remove('cr-ocupado');
  }
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
  const rotulo = (o, i) => '<span class="cr-op-rot"><b>' + (i + 1) + '</b><span>' + gEsc(o.nomeReceita) + '</span>' + (o.editada ? '<em>editada</em>' : '') + '</span>';
  el.innerHTML = '<header class="cr-ent-cab"><div><h3>Sua arte</h3><p>' + ops.length + ' opções · ' + gEsc(f.nome) + ' ' + gEsc(f.desc.split(',')[0]) + '</p></div>'
    + '<span class="cr-ent-selo">' + (ops[0].juiz ? 'Revisada pela IA' : 'Conferida nas regras da marca') + ' · Testes</span></header>'
    + '<div class="cr-ops" role="radiogroup" aria-label="Opções de arte">'
    + ops.map((o, i) => '<button type="button" class="cr-op' + (i ? '' : ' on') + '" role="radio" aria-checked="' + (i ? 'false' : 'true') + '" data-i="' + i + '">'
      + '<span class="cr-op-arte" style="aspect-ratio:' + o.w + '/' + o.h + '"><img alt="Opção ' + (i + 1) + ': ' + gEsc(o.nomeReceita) + '" src="' + o.url + '"></span>'
      + rotulo(o, i) + (o.juiz && o.juiz.porque ? '<span class="cr-op-pq">' + gEsc(o.juiz.porque) + '</span>' : '') + '</button>').join('')
    + '</div>'
    + '<div class="cr-acoes">'
    + '<button type="button" class="cr-btn cr-prim" data-acao="png">' + CR_ICO.baixar + 'Baixar PNG</button>'
    + '<button type="button" class="cr-btn" data-acao="editar">' + CR_ICO.editar + 'Editar</button>'
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
    img.addEventListener('load', () => b.classList.add('cr-nitida'), { once: true });
    b.addEventListener('dblclick', () => abre(i));
  });
  const abre = i => {
    escolhe(i);
    crEditar(ops[i], nova => {
      Object.assign(ops[i], nova, { editada: true });
      const b = botoes()[i];
      b.querySelector('img').src = ops[i].url;
      b.querySelector('.cr-op-rot').outerHTML = rotulo(ops[i], i);
    });
  };
  el.addEventListener('keydown', e => { if(/^[1-3]$/.test(e.key) && e.target.closest('.cr-ops')) escolhe(Math.min(ops.length, +e.key) - 1); });
  el.addEventListener('click', ev => {
    const b = ev.target.closest('button'); if(!b) return;
    if(b.classList.contains('cr-op')) return escolhe(+b.dataset.i);
    if(b.dataset.acao === 'png') return crBaixarPNG(ops[sel], b);
    if(b.dataset.acao === 'editar') return abre(sel);
    if(b.dataset.acao === 'outras') return crOutrasOpcoes(fio);
    if(b.dataset.acao === 'copiar') return crCopiar(fio.legenda);
  });
  return el;
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
  const W = op.w, H = op.h, hist = [], fut = [];
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
    return +t.getAttribute('data-larg') || (anc === 'middle' ? W - 2 * CR_M : W - CR_M - x);
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
      props.innerHTML = _sec('Fundo', '<div class="cr-ed-cores">' + ['#F85400', '#FF9000'].map(c => '<button type="button" class="cr-ed-cor' + (c === cor ? ' on' : '') + '" data-cor="' + c + '" style="--c:' + c + '" aria-label="Fundo ' + c + '"></button>').join('')
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
        for(const [alvo, borda] of [[CR_M, L0 + dx], [W / 2, L0 + dx + Lw / 2], [W - CR_M, L0 + dx + Lw]]) if(Math.abs(borda - alvo) < 8){ dx += alvo - borda; gx = alvo; break; }
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
      e.dx += a === 'alEsq' ? CR_M - L : a === 'alDir' ? (W - CR_M) - (L + Lw) : W / 2 - (L + Lw / 2);
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
      a.download = 'luma-creative-' + v.spec.objetivo + '-' + v.receita + '-' + v.spec.formato + '.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      gToast('PNG baixado', 'success');
    }, 'image/png');
  };
  im.onerror = () => { if(btn) btn.disabled = false; gToast('Não foi possível gerar o PNG', 'error'); };
  im.src = v.url;
}
