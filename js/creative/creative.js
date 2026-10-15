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
 * Chat:   crEntrar (transição da aba) · crEnviar (pedido → briefing → copy → CR_OPCOES opções + legenda)
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
// As cores da marca pelo nome (o código do motor fala CR_C.laranja, não o hex solto); rosa é só da much+
const CR_C = { laranja: '#F85400', solar: '#FF9000', amarelo: '#FFB900', branco: '#FFFFFF', grafite: '#434343', cinza: '#D9D9D9', vermelho: '#F62900', rosa: '#E52676' };
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
  aniversario: 'Aniversário da franquia',
  // 15/10 (frente 4): usos do dia a dia que não cabiam nos cinco de cima
  aviso:       'Aviso e operação (horário especial, feriado, pausa)',
  parceiro:    'Parceiro (nova loja, destaque, mais vendidos)',
  prospeccao:  'Prospecção e comunidade (seja parceiro, entregador, baixe o app)'
};
// O TEMA do pedido (happy hour, chuva, feriado, entregador…): só escolhe as composições especialistas
// daquele uso — nunca vira dado na arte. Lido do pedido, do título e do apoio.
const CR_TEMAS = {
  happy: /happy|chopp|cerveja|drinks?\b/, sextou: /sextou|sexta/, domingo: /domingo/, janta: /\bjanta|jantar/, madrugada: /madrugada|ate as [1-5]h|24h/,
  fds: /fim de semana|sabado|fds/, chuva: /chuv|chove|frio/, maes: /\bmaes?\b|dia das maes/, pais: /\bdia dos pais\b/, namorados: /namorad|a dois/,
  criancas: /criancas?\b/, natal: /natal|ceia/, junina: /junin|arraia|quentao|pamonha/, jogo: /\bjogo\b|copa|torc|apito/, cidade: /parabens,? [a-z]|anos d[ae] [a-z]|aniversario da cidade|nossa cidade/,
  black: /black/, feriado: /feriado/, horario: /horario/, pausa: /pausa|suspens|fechad/, entregando: /entregando|abertos?\b/, avisoImp: /aviso|importante|comunicado/,
  primeira: /primeira compra|bem.?vindo/, frete: /frete|entrega gratis/, cashback: /cashback|clube|much\s*(\+|mais)/, inauguracao: /inaugur/, maisvendidos: /mais vendid|mais pedid|ranking|\btop \d/,
  lojista: /lojista|loja da semana|destaque da semana/, novo: /novo parceiro|chegou no app|chegou/, entregador: /entregador|motoboy|renda extra/,
  sejaParceiro: /seja parceiro|venda (mais )?pelo app|cadastre sua loja|sua loja/, baixe: /baix[ae]r? o app|baixe|instal/, pecaApp: /pec[ao] no app|peca pelo app/, obrigado: /obrigad|agradec|gratid/,
  ofertas: /ofertas/, doisPorUm: /2\s*(por|x)\s*1/, aPartir: /a partir de/, executivo: /executivo|almoco|marmita|prato do dia/, combo: /combo|familia/
};
function crTema(t){
  const n = String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return Object.keys(CR_TEMAS).filter(k => CR_TEMAS[k].test(n));
}
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
const _crMedeMemo = new Map();
function crMede(txt, cls, size){
  const s = String(txt || ''), k = cls + '|' + size + '|' + s;
  let w = _crMedeMemo.get(k);
  if(w != null) return w;
  const e = CR_ESTILO[cls];
  if(!_crCtx) _crCtx = document.createElement('canvas').getContext('2d');
  _crCtx.font = (e.it ? 'italic ' : '') + e.peso + ' ' + size + 'px "LC ' + e.fam + '"';
  // o Realce leva os pares de CR_KERN (o SVG desenha com o mesmo dx — medida e desenho batem)
  w = _crCtx.measureText(s).width + e.ls * [...s].length + (cls === 'hero' ? _crKernSoma(s) * size : 0);
  if(_crMedeMemo.size > 30000) _crMedeMemo.clear();
  _crMedeMemo.set(k, w);
  return w;
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
  const pal = _crPalavras(txt);
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
   TIPOGRAFIA DE AGÊNCIA — o que separa "texto posto" de "título desenhado":
   · unidades que não se quebram (_crPalavras): "R$ 22,90", "2 POR 1", "500 ML", artigo e preposição
     colados na palavra seguinte ("É JOGO", "A DOIS", "DA CIDADE") — nunca linha terminando em "DE";
   · quebra equilibrada (crLockup, Knuth–Plass simplificado até 4 linhas, sem hifenizar) e, no lockup,
     corpo por linha para igualar as larguras (variação limitada);
   · entrelinha pela TINTA (_crAlt): o acento do Realce (É, Ã) sobe 0,11 em acima das maiúsculas e o
     Ç desce — a linha de baixo ganha o respiro que precisa e a caixa do bloco é a tinta de verdade;
   · alinhamento óptico (_crOptico): o recuo do 1º glifo em corpo grande é compensado (até 5 px, dentro
     da tolerância da régua da margem); aspas e parêntese de abertura penduram;
   · pares de letras do Realce que abrem buraco em corpo grande (CR_KERN, medidos por área entre os
     glifos a 200 px; o Realce já traz AV/AT/LT/YA — a tabela só fecha o que sobrou).
══════════════════════════════════════════════════════════════ */
// em do Realce; É/Ê herdam o E. Medido: espaço médio entre as tintas linha a linha contra HH/HI/NN.
const CR_KERN = { FY: -0.025, FT: -0.024, PT: -0.022, LJ: -0.02, FV: -0.017, PY: -0.016, EY: -0.014, ET: -0.013,
  TY: -0.011, TT: -0.011, YT: -0.011, PV: -0.009, FW: -0.007, EV: -0.006, LT: -0.005 };
const _crKernPar = (a, b) => CR_KERN[(a === 'É' || a === 'Ê' ? 'E' : a) + b] || 0;
function _crKernSoma(s){ let k = 0; for(let i = 1; i < s.length; i++) k += _crKernPar(s[i - 1], s[i]); return k; }
// atributo dx com o ajuste por par (só no Realce; '' quando não há par)
function _crKernDx(s, z){
  const ch = [...String(s || '')], v = ch.map((c, i) => i ? Math.round(_crKernPar(ch[i - 1], c) * z * 10) / 10 : 0);
  return v.some(x => x) ? ' dx="' + v.join(' ') + '"' : '';
}
// Palavras que não ficam sozinhas no fim da linha (vão com a seguinte)
const _CR_COLA = /^(a|o|e|as|os|um|uma|de|da|do|das|dos|em|no|na|nos|nas|por|pra|pro|com|sem|ao|aos|à|às|é|que|se|só|ou|nem|r\$|até)$/i;
function _crPalavras(txt){
  const ws = String(txt || '').split(/\s+/).filter(Boolean), out = [];
  for(let i = 0; i < ws.length; i++){
    let u = ws[i];
    // cola para frente: palavra de função, "R$", número antes de unidade ou palavra curta ("500 ML", "2 POR 1", "10 A 20")
    while(i + 1 < ws.length){
      const ult = u.split(' ').pop(), prox = ws[i + 1];
      if(_CR_COLA.test(ult) || (/^\d+[.,]?\d*$/.test(ult) && [...prox].length <= 3)) u += ' ' + ws[++i];
      else break;
    }
    out.push(u);
  }
  // a última unidade não fica sozinha se for palavra de função ("SEXTOU COM")
  if(out.length > 1 && _CR_COLA.test(out[out.length - 1])) out.splice(-2, 2, out[out.length - 2] + ' ' + out[out.length - 1]);
  return out;
}
const _crFonteDe = (cls, z) => _crFonteCls(cls, z);
// Altura de tinta de linhas de UM corpo (ou de corpos por linha, zs): baselines relativas ao topo da
// tinta e a altura total. Entrelinha base 0,94 em (a das artes aprovadas); cresce quando o acento da
// linha de baixo ou a descendente da de cima pediriam encostar (respiro mínimo de 0,1 em).
const _crAltMemo = new Map();
function _crAlt(linhas, z, cls, zs){
  const c = cls || 'hero', k = c + '|' + z + '|' + (zs ? zs.join(',') : '') + '|' + linhas.join('\n');
  let r = _crAltMemo.get(k);
  if(r) return r;
  const ls = _CR_LS_CLASSE[c] ? CR_ESTILO[c].ls : 0, Z = i => (zs ? zs[i] : z);
  const m = linhas.map((l, i) => _crMetrica(l, _crFonteDe(c, Z(i)), ls));
  const passo = c === 'hero' ? 0.94 : 1.25, cap = c === 'hero' ? 0.72 : 0.71;
  const ys = [m[0].a];
  for(let i = 1; i < linhas.length; i++){
    const base = cap * Z(i) + (passo - cap) * (Z(i - 1) + Z(i)) / 2;   // = passo × z quando o corpo é igual
    ys.push(ys[i - 1] + Math.max(base, m[i - 1].d + 0.1 * Math.min(Z(i - 1), Z(i)) + m[i].a));
  }
  r = { ys, h: ys[ys.length - 1] + m[m.length - 1].d, asc: m[0].a };
  if(_crAltMemo.size > 4000) _crAltMemo.clear();
  _crAltMemo.set(k, r);
  return r;
}
// Alinhamento óptico: o deslocamento do x da linha para a TINTA encostar no eixo (texto grande,
// alinhado à esquerda ou à direita). Limitado a 5 px: a régua da margem tem tolerância de 6.
function _crOptico(l, z, al, cls){
  const c = cls || 'hero';
  if(z < 80 || al === 'middle' || !l) return 0;
  const ls = _CR_LS_CLASSE[c] ? CR_ESTILO[c].ls : 0, f = _crFonteDe(c, z), ch = [...l];
  if(al === 'end'){ const u = _crMetrica(ch[ch.length - 1], f, ls); return Math.min(5, Math.max(0, u.w - u.r)); }
  let d = Math.max(-5, Math.min(0, _crMetrica(ch[0], f, ls).l));                   // recuo do 1º glifo
  if(/^["“«(]/.test(l)) d = Math.max(-6, d - _crMetrica(ch[0], f, ls).w);           // pontuação pendurada
  return d;
}
/* Lockup de título: a melhor quebra em até `linhas` linhas (sem hifenizar, sem separar o que cola) e,
   com `iguala`, um corpo por linha para as larguras baterem (variação máxima `varia`). Custo: o corpo
   que a leitura enxerga (média geométrica entre o menor e o médio), a irregularidade das larguras,
   a última linha curta (órfã), palavra solta numa linha e cada linha a mais.
   o = { cls, larg, alt, max, min, linhas, iguala, varia } → { linhas, zs, size, h, ys, larguras } */
function crLockup(txt, o){
  const cls = o.cls || 'hero', tk = _crPalavras(txt), N = Math.max(1, Math.min(o.linhas || 3, tk.length));
  const wU = l => crMede(l, cls, 100) / 100;
  let melhor = null;
  const avalia = ls => {
    const ws = ls.map(wU);
    let zs;
    if(o.iguala && ls.length > 1){
      // a linha mais longa manda (até o teto do herói); as curtas crescem até igualar, com variação limitada
      zs = ws.map(w => o.larg / w);
      const zMin = Math.min(o.max, ...zs); zs = zs.map(z => Math.min(z, zMin * (o.varia || 1.3)));
    }else{ const z = Math.min(o.max, o.larg / Math.max(...ws)); zs = ws.map(() => z); }
    zs = zs.map(z => Math.floor(z));
    let g = _crAlt(ls, zs[0], cls, zs);
    if(o.alt && g.h > o.alt){ const k = o.alt / g.h; zs = zs.map(z => Math.floor(z * k)); g = _crAlt(ls, zs[0], cls, zs); }
    // a regularidade se mede contra a linha mais larga (quando a altura ou o teto mandam, nenhuma chega à largura)
    const zMin = Math.min(...zs), zMed = zs.reduce((a, b) => a + b, 0) / zs.length, lw = ls.map((l, i) => ws[i] * zs[i]), fr = lw.map(w => w / Math.max(...lw));
    const rag = ls.length > 1 ? fr.reduce((s, x) => s + (1 - x) * (1 - x), 0) / ls.length : 0;
    let s = Math.sqrt(zMin * zMed) * (1 - 0.6 * rag) * (1 - 0.05 * (ls.length - 1));
    if(ls.length > 1 && fr[fr.length - 1] < 0.42 && !o.iguala) s *= 0.86;                 // órfã
    if(ls.length > 1 && ls.some(l => [...l].length <= 3)) s *= 0.88;                       // palavra solta
    if(zMin < (o.min || 0)) s *= 0.5;                                                      // abaixo do piso: último recurso
    if(!melhor || s > melhor.s + 1e-6) melhor = { s, linhas: ls, zs, size: Math.max(...zs), zMin, h: g.h, ys: g.ys, larguras: ws.map((w, i) => w * zs[i]) };
  };
  const quebra = (ini, k, acc) => {
    if(k === 1){ avalia(acc.concat([tk.slice(ini).join(' ')])); return; }
    for(let i = ini + 1; i <= tk.length - k + 1; i++) quebra(i, k - 1, acc.concat([tk.slice(ini, i).join(' ')]));
  };
  for(let n = 1; n <= N; n++) quebra(0, n, []);
  return melhor;
}
// Apoio e letra miúda: 1 linha enquanto o corpo fica ≥ 85% do ideal; senão 2 linhas equilibradas,
// sem órfã (a 2ª linha nunca é uma palavra só, nem menor que 35% da 1ª). → { linhas, z, h, ys }
function crTextoLinhas(txt, cls, max, larg, min, est){
  const z1 = crCabe(txt, cls, max, larg, 0);
  const um = () => { const z = Math.max(z1, min || 0); if(min && z1 < min && est) est.push(txt); const g = _crAlt([txt], z, cls); return { linhas: [txt], z, h: g.h, ys: g.ys }; };
  if(z1 >= max * 0.85) return um();
  const tk = _crPalavras(txt);
  if(tk.length < 3) return um();
  let b = null;
  for(let i = 1; i <= tk.length - 2; i++){
    const l = [tk.slice(0, i).join(' '), tk.slice(i).join(' ')], w = l.map(x => crMede(x, cls, 100));
    if(w[1] < w[0] * 0.35) continue;
    const z = Math.min(max, Math.floor(100 * larg / Math.max(...w)));
    if(!b || z > b.z || (z === b.z && Math.abs(w[0] - w[1]) < Math.abs(b.w[0] - b.w[1]))) b = { l, z, w };
  }
  if(!b || b.z < z1 * 1.12 || b.z < (min || 0)) return um();
  const g = _crAlt(b.l, b.z, cls);
  return { linhas: b.l, z: b.z, h: g.h, ys: g.ys };
}
// Texto de 1 ou 2 linhas (apoio, letra miúda) num <text> só: o importador lê como UM campo
function crTextoMulti(x, y0, cls, q, fill, extra){
  if(q.linhas.length === 1) return crTexto(x, y0 + q.ys[0], cls, q.z, fill, q.linhas[0], extra);
  return '<text x="' + _r(x) + '" y="' + _r(y0 + q.ys[0]) + '" class="' + cls + '" font-size="' + _r(q.z) + '" fill="' + fill + '"' + (extra || '') + '>'
    + q.linhas.map((l, i) => '<tspan x="' + _r(x) + '" y="' + _r(y0 + q.ys[i]) + '">' + crX(l) + '</tspan>').join('') + '</text>';
}

/* ══════════════════════════════════════════════════════════════
   BLOCOS — os mesmos da skill (refino_01…14), em SVG do contrato
══════════════════════════════════════════════════════════════ */
function crX(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
const _r = n => Math.round(n);
function crTexto(x, y, cls, size, fill, txt, extra){
  let k = '';
  if(cls === 'hero' && !/\bdx="/.test(extra || '') && !/rotate/.test(extra || '')){
    k = _crKernDx(txt, _r(size));
    const an = /text-anchor="(middle|end)"/.exec(extra || '');
    x += _crOptico(String(txt || ''), size, an ? an[1] : 'start');
  }
  return '<text x="' + _r(x) + '" y="' + _r(y) + '" class="' + cls + '" font-size="' + _r(size) + '" fill="' + fill + '"' + (extra || '') + k + '>' + crX(txt) + '</text>';
}
function crMista(x, y, size, fill, linha, anchor){
  return '<text x="' + _r(x) + '" y="' + _r(y) + '"' + (anchor ? ' text-anchor="' + anchor + '"' : '') + ' font-size="' + _r(size) + '" fill="' + fill + '">'
    + crTrechos(linha).map(r => '<tspan class="' + r.cls + '">' + crX(r.t) + '</tspan>').join('') + '</text>';
}
// Herói de 1 ou 2 linhas num <text> só (uma linha por <tspan> com y próprio): o importador
// lê como UM campo de várias linhas — nunca a 2ª linha solta como texto fixo.
// zs = corpo por linha (lockup que iguala as larguras); cada linha leva o kerning e o alinhamento óptico dela
function crHeroi(x, ys, size, fill, linhas, extra, zs){
  if(linhas.length === 1 && !zs) return crTexto(x, ys[0], 'hero', size, fill, linhas[0], extra);
  const an = /text-anchor="(middle|end)"/.exec(extra || ''), al = an ? an[1] : 'start', Z = i => (zs ? zs[i] : size);
  return '<text x="' + _r(x) + '" y="' + _r(ys[0]) + '" class="hero" font-size="' + _r(zs ? Math.max(...zs) : size) + '" fill="' + fill + '"' + (extra || '') + '>'
    + linhas.map((l, i) => '<tspan x="' + _r(x + _crOptico(l, Z(i), al)) + '" y="' + _r(ys[i]) + '"' + (zs ? ' font-size="' + _r(zs[i]) + '"' : '') + _crKernDx(l, _r(Z(i))) + '>' + crX(l) + '</tspan>').join('') + '</text>';
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
    // no centro da parte VISÍVEL da foto (a que sangra pela direita não leva o ícone para cima do texto)
    const x1 = x < CR_W ? Math.min(x + w, CR_W) : x + w, cx = (Math.max(x, 0) + x1) / 2, cy = Math.max(y, 0) / 2 + (y + h) / 2 - 20;
    const rot = legenda || 'Use aqui sua foto do produto', fz = Math.max(20, Math.min(32, 32 * (x1 - Math.max(x, 0) - 48) / crMede(rot, 'body', 32)));
    s += '<g transform="translate(' + _r(cx) + ',' + _r(cy) + ')">'
      + '<rect x="-65" y="-68" width="130" height="98" rx="18" fill="none" stroke="#434343" stroke-width="7.5"/>'
      + '<circle cx="26" cy="-38" r="8" fill="#434343"/>'
      + '<polyline points="-42,12 -8,-24 24,12" fill="none" stroke="#434343" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>'
      + '<polyline points="6,12 32,-14 48,12" fill="none" stroke="#434343" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>'
      + '<text x="0" y="85" text-anchor="middle" class="body" font-size="' + _r(fz) + '" fill="#434343">' + crX(rot) + '</text></g>';
  }
  return s + '</g>';
}
// Selo circular amarelo (1 ou 2 linhas em Realce grafite)
function crSelo(cx, cy, r, linhas, fundo, cor){
  const l = (linhas || []).filter(Boolean).slice(0, 2), tx = cor || CR_C.grafite;
  if(!l.length) return '';
  let s = '<g transform="translate(' + _r(cx) + ',' + _r(cy) + ')" filter="url(#shs)"><circle r="' + r + '" fill="' + (fundo || CR_C.amarelo) + '"/>';
  if(l.length === 1){
    const z = crCabe(l[0], 'hero', r * 0.8, r * 1.5, 0);
    s += crTexto(0, z * 0.36, 'hero', z, tx, l[0], ' text-anchor="middle" data-larg="' + _r(r * 1.5) + '"');
  }else{
    const z1 = crCabe(l[0], 'hero', r * 0.72, r * 1.55, 0), z2 = crCabe(l[1], 'hero', r * 0.58, r * 1.4, 0);
    const alt = z1 * 0.73 + r * 0.14 + z2 * 0.73, b1 = -alt / 2 + z1 * 0.73, b2 = b1 + r * 0.14 + z2 * 0.73;
    const lg = ' text-anchor="middle" data-larg="' + _r(r * 1.5) + '"';
    s += crTexto(0, b1, 'hero', z1, tx, l[0], lg) + crTexto(0, b2, 'hero', z2, tx, l[1], lg);
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
  const q = crTextoLinhas(txt, 'legal', 26, CR_L, 22, est);
  return crTextoMulti(x, y - q.ys[0], 'legal', q, '#FFFFFF', anchor ? ' text-anchor="' + anchor + '"' : '');
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
// Os vãos e a suspensão do preço-assinatura, a partir das alturas de maiúscula MEDIDAS no Realce:
// "R$" e centavos (55% do número, regra da marca) com o topo da tinta na altura do topo do número.
function _crPrecoGeo(big, sm){
  const cap = z => _crMetrica('0', _crFonteCls('hero', z), CR_ESTILO.hero.ls).a;
  return { dy: Math.max(0, _r(cap(big) - cap(sm))), gR: Math.max(4, _r(big * 0.035)), gC: Math.max(2, _r(big * 0.015)) };
}
// Preço-assinatura (§2.1): R$ e centavos a 55% do número, topo alinhado ao do número. Algarismos
// ESTÁVEIS: o corpo é decidido pela largura tabular ("11,90" e "88,90" saem do mesmo tamanho — o "1"
// e o "7" do Realce são mais estreitos e fariam o preço pular de corpo). `w` é a largura real (centralizar).
function crPrecoMede(por, larg, big0){
  const m = /^(\d+)(?:,(\d{2}))?$/.exec(String(por).replace(/\s/g, ''));
  const int = m ? m[1] : String(por), cent = m ? ',' + (m[2] || '00') : '';
  let big = big0 || 168, sm = Math.round(big * 0.55);
  const tab = (t, z) => Math.max(crMede(t, 'hero', z), /^\d+$/.test(t) ? t.length * crMede('0', 'hero', z) : 0);
  const larguraEm = (b, s, f) => { const g = _crPrecoGeo(b, s); return crMede('R$', 'hero', s) + g.gR + f(int, b) + g.gC + crMede(cent, 'hero', s); };
  let w = larguraEm(big, sm, tab);
  if(w > larg){ const k = larg / w; big = Math.floor(big * k); sm = Math.floor(sm * k); }
  return { int, cent, big, sm, w: larguraEm(big, sm, (t, z) => crMede(t, 'hero', z)) };
}
function crPreco(x, y, por, larg, fill, big0){
  const { int, cent, big, sm } = crPrecoMede(por, larg, big0), g = _crPrecoGeo(big, sm);
  return '<text x="' + _r(x) + '" y="' + _r(y) + '" class="hero" font-size="' + big + '" data-campo="precoPor" fill="' + (fill || '#F85400') + '">'
    + '<tspan font-size="' + sm + '" dy="-' + g.dy + '">R$</tspan><tspan dy="' + g.dy + '" dx="' + g.gR + '">' + crX(int) + '</tspan>'
    + (cent ? '<tspan font-size="' + sm + '" dy="-' + g.dy + '" dx="' + g.gC + '">' + crX(cent) + '</tspan>' : '') + '</text>';
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
    const pal = _crPalavras(sp.titulo);   // "A DOIS", "É JOGO" não se separam
    if(estilo === 'duplo'){
      if(pal.length < 2) return null;
      const l1 = pal[0], l2 = pal.slice(1).join(' ');
      const s2 = crCabe(l2, 'hero', max, CR_L, 80, est), s1 = Math.min(crCabe(l1, 'hero', max * 1.6, CR_L, 0), Math.round(s2 * 1.28));
      if(s1 < s2 * 1.15) return null;   // sem contraste de tamanho, não é "duplo" — outra diagramação cobre
      // UM <text> com as duas linhas (o importador lê um campo só); entrelinha pela tinta
      const g = _crAlt([l1, l2], s1, 'hero', [s1, s2]);
      return { nome: 'titulo', heroi: s1, h: g.h, desenha: y => crBloco('titulo', '<g id="produto">'
        + crHeroi(c.X, g.ys.map(v => y + v), s1, '#FFFFFF', [l1, l2], c.anc + campo, [s1, s2]) + '</g>') };
    }
    // Realce: lockup de 1 a 3 linhas (quebra equilibrada); a busca pode pedir o corpo por linha (a.p.lockup)
    const q = crLockup(sp.titulo, { larg: b.larg || CR_L, max, min: 80, linhas: 3, iguala: !!a.p.lockup, varia: 1.35 });
    if(q.zMin < 80) est.push(sp.titulo);
    const zs = q.zs.some(z => z !== q.zs[0]) ? q.zs : null;
    return { nome: 'titulo', heroi: q.size, h: q.h, desenha: y => crBloco('titulo', '<g id="produto">'
      + crHeroi(c.X, q.ys.map(v => y + v), q.size, '#FFFFFF', q.linhas, c.anc + campo, zs) + '</g>') };
  },
  apoio(b, c){
    if(!c.sp.apoio) return null;
    // 1 linha enquanto o corpo fica perto do ideal; texto longo quebra em 2 linhas sem órfã (não encolhe até sumir)
    const q = crTextoLinhas(c.sp.apoio, 'body', c.a.story ? 42 : 40, b.larg || CR_L, 32, c.est);
    return { nome: 'apoio', apoio: q.z, h: q.h, desenha: y => crBloco('apoio', crTextoMulti(c.X, y, 'body', q, '#FFFFFF', c.anc)) };
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
    const q = crTextoLinhas(c.sp.legal, 'legal', c.a.story ? 28 : 26, CR_L, 24, c.est);
    return { nome: 'legal', h: q.h, desenha: y => crBloco('legal', crTextoMulti(c.X, y, 'legal', q, '#FFFFFF', c.anc)) };
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

// kv (busca, 1–1,5) abre os vãos mínimos entre grupos; nunca fecha abaixo do token (60 no feed, 80 no story)
function _crVao(antes, depois, a){
  if(antes.nome === 'titulo' && (depois.nome === 'apoio' || depois.nome === 'preco')) return { v: 40, fixo: true };
  if(antes.nome === 'tag' && depois.nome === 'titulo') return { v: 32, fixo: true };   // a tag é do grupo do título
  return { v: Math.max(Math.round((a.story ? 80 : 60) * Math.max(1, Math.min(1.5, a.p.kv || 1))), depois.folgaAntes || 0), fixo: false };
}
function crPilha(cfg){
  return (sp, a, est, fundo) => {
    const centro = ((a.p && a.p.eixo) || cfg.eixo) === 'centro';   // a busca pode trocar o eixo (busca.eixo)
    const c = { sp, a, est, fundo, centro, X: centro ? CR_W / 2 : CR_M, anc: centro ? ' text-anchor="middle"' : '' };
    let defs = typeof cfg.blocos === 'function' ? cfg.blocos(sp, a.p || {}) : cfg.blocos;
    // a tag que o pedido deu ("PRATO DO DIA", "A PARTIR DE") vai logo acima do herói: receita nenhuma a perde
    const ih = defs.findIndex(d => d.t === 'heroi');
    if(sp.topo && ih >= 0 && !defs.some(d => d.t === 'tag') && crConteudoBlocos(sp).tag) defs = defs.slice(0, ih).concat([{ t: 'tag' }], defs.slice(ih));
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
    // inteira) com ritmo igual, e o resto centraliza — nunca "boia" num canto. A busca escolhe a
    // distribuição (a.p.dist): 'centro' (padrão), 'ancora' (o que sobra fica antes do último grupo:
    // a ação ancora na base) ou 'espalha' (sem teto: a faixa útil inteira, ritmo igual).
    const dist = a.p.dist || 'centro', soltos = vaos.filter(v => !v.fixo), teto = dist === 'espalha' ? Infinity : (a.story ? 200 : 120) * Math.max(1, Math.min(1.5, a.p.kv || 1));
    while(livre > 0.5 && soltos.some(v => v.v < teto)){
      const cabe = soltos.filter(v => v.v < teto), d = Math.min(livre / cabe.length, ...cabe.map(v => teto - v.v));
      cabe.forEach(v => { v.v += d; }); livre -= d * cabe.length;
    }
    if(dist === 'ancora' && livre > 0.5 && soltos.length > 1){ soltos[soltos.length - 1].v += livre; livre = 0; }
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
    const hh = _crAlt(q.linhas, z).h, vao = 14 * k;
    const [pf, pc] = fundo === '#FFB900' ? ['#F85400', '#FFFFFF'] : ['#FFFFFF', '#F85400'];
    let g = '';
    if(ch.pre){
      const zp = crCabe(ch.pre, 'media', 22 * k, 420 * k, a.piso, est), pl = crPilula(0, -hh / 2 - vao - zp * 0.875, ch.pre, 'media', zp, pf, pc, 8 * k);
      g += pl.svg;
    }
    g += crHeroi(0, q.linhas.map((l, i) => -hh / 2 + _crAlt(q.linhas, z).ys[i]), z, '#F85400', q.linhas,
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
    const hh = _crAlt(q.linhas, z).h;
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
    out.push(crBloco('titulo', '<g id="produto">' + crHeroi(cx, q.linhas.map((l, i) => y + _crAlt(q.linhas, z).ys[i]), z, '#FFFFFF', q.linhas, anc + ' data-campo="' + ch.campo + '"') + '</g>'));
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
    const hh = _crAlt(q.linhas, z).h;
    let comp = !sp.foto && (ch.valor ? (ch.valor.preco ? 'POR R$ ' + ch.valor.preco : ch.valor.txt) : ch.comp);
    if(comp && crMede(comp, 'media', a.piso) > larg) comp = '';      // apoio longo não cabe na metade: fica só o herói
    const zc = comp ? crCabe(comp, 'media', 34, larg, a.piso, est) : 0, total = hh + (zc ? 22 + zc * 0.75 : 0);
    const y = (faixa - total) / 2;
    const out = ['<rect x="' + meio + '" y="0" width="' + meio + '" height="' + faixa + '" fill="#FFB900"/>',
      crBloco('logo', '<image href="asset:logos/dm-h-branca.png" x="' + _r((meio - lw) / 2) + '" y="' + _r((a.H - lh) / 2) + '" width="' + lw + '" height="' + _r(lh) + '"/>'),
      crBloco('titulo', '<g id="produto">' + crHeroi(cx, q.linhas.map((l, i) => y + _crAlt(q.linhas, z).ys[i]), z, '#F85400', q.linhas, anc + ' data-campo="' + ch.campo + '"') + '</g>')];
    if(zc) out.push(crBloco('apoio', crTexto(cx, y + hh + 22 + zc * 0.75, 'media', zc, '#434343', comp, anc)));
    if(sp.foto) out.push(crBloco('foto', crFoto(meio, faixa, meio, a.H - faixa, 0, '', sp.foto)));
    return out;
  },

  // Cabeçalho de email em faixa única: logo à esquerda, herói e valor alinhados à direita
  emailFaixa(sp, a, est){
    const ch = crChave(sp), lw = 260, lh = lw / 4.97, xd = a.W - a.M - 20, larg = a.W - 2 * a.M - lw - 120, anc = ' text-anchor="end"';
    const q = crQuebra(ch.titulo, 'hero', a.heroiMax * (a.p.kh || 1), larg, a.heroiMin, est), z = q.size, n = q.linhas.length;
    const hh = _crAlt(q.linhas, z).h;
    const comp = ch.valor ? (ch.valor.preco ? 'POR R$ ' + ch.valor.preco : ch.valor.txt) : ch.comp;
    const zc = comp ? crCabe(comp, ch.valor ? 'hero' : 'media', ch.valor ? 48 : 34, larg, a.piso, est) : 0;
    const total = hh + (zc ? 24 + zc * 0.75 : 0);
    if(total > a.seguroBase - a.seguroTopo) return null;
    const y = (a.H - total) / 2;
    const out = [crBloco('logo', '<image href="asset:logos/dm-h-branca.png" x="' + (a.M + 20) + '" y="' + _r((a.H - lh) / 2) + '" width="' + lw + '" height="' + _r(lh) + '"/>'),
      crBloco('titulo', '<g id="produto">' + crHeroi(xd, q.linhas.map((l, i) => y + _crAlt(q.linhas, z).ys[i]), z, '#FFFFFF', q.linhas, anc + ' data-campo="' + ch.campo + '"') + '</g>')];
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
    const hh = _crAlt(q.linhas, z).h, x1 = sp.foto ? fx + fw : corte, zl = cx0 + cw - x1 - 44, xm = x1 + 18 + zl / 2;
    const out = ['<clipPath id="crcard"><rect x="' + cx0 + '" y="' + cy0 + '" width="' + cw + '" height="' + chh + '" rx="' + a.card[4] + '"/></clipPath>'
      + '<rect x="' + corte + '" y="' + cy0 + '" width="' + (cx0 + cw - corte) + '" height="' + chh + '" fill="#FFB900" clip-path="url(#crcard)"/>',
      crBloco('titulo', '<g id="produto">' + crHeroi(z0, q.linhas.map((l, i) => cy - hh / 2 + _crAlt(q.linhas, z).ys[i]), z, '#FFFFFF', q.linhas, ' data-campo="' + ch.campo + '"') + '</g>')];
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
    const hh = _crAlt(q.linhas, z).h;
    return [crBloco('titulo', '<g id="produto">' + crHeroi(z0, q.linhas.map((l, i) => cy - hh / 2 + _crAlt(q.linhas, z).ys[i]), z, '#FFFFFF', q.linhas, ' data-campo="' + ch.campo + '"') + '</g>'),
      crBloco('selo', crSelo(sx, cy, r, ch.selo))];
  },

  // Banner com a foto em cartão à direita e o selo na quina dela
  bannerFoto(sp, a, est){
    if(!sp.foto) return null;
    const ch = crChave(sp), [cx0, cy0, cw, chh] = a.card, cy = cy0 + chh / 2, fx = 400, z0 = cx0 + 32;
    const q = crQuebra(ch.titulo, 'hero', a.heroiMax * (a.p.kh || 1), fx - 28 - z0, a.heroiMin, est), z = q.size, n = q.linhas.length;
    const hh = _crAlt(q.linhas, z).h;
    const out = [crBloco('titulo', '<g id="produto">' + crHeroi(z0, q.linhas.map((l, i) => cy - hh / 2 + _crAlt(q.linhas, z).ys[i]), z, '#FFFFFF', q.linhas, ' data-campo="' + ch.campo + '"') + '</g>'),
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
    out.push(crBloco('titulo', '<g id="produto">' + crHeroi(M, q.linhas.map((l, k) => 360 + _crAlt(q.linhas, q.size).ys[k]), q.size, '#FFFFFF', q.linhas, ' data-campo="' + (sp.objetivo === 'oferta' ? 'produto' : 'titulo') + '"') + '</g>'));
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
      out.push(crBloco('chamada', crHeroi(x2, qa.linhas.map((l, k) => 320 + _crAlt(qa.linhas, qa.size).ys[k]), qa.size, '#FFFFFF', qa.linhas)));
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
  if(sp.objetivo === 'aviso') return Object.assign(base, { pre: sp.selo.join(' ') || sp.topo, comp: sp.horario || sp.apoio });
  if(sp.objetivo === 'parceiro' || sp.objetivo === 'prospeccao') return Object.assign(base, { pre: sp.topo });
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
  { id: 'cardPreso', nome: 'Card preso à foto', foto: true, peso: { oferta: 10, evento: 4 }, busca: { card: ['esq', 'dir'], selo: ['td', 'te'] },
    pilha: { eixo: 'esq', blocos: (sp, p) => [{ t: 'logo' }, { t: 'heroi', exige: true }, { t: 'apoio', larg: sp.selo.length ? 660 : CR_L },
      { t: 'foto', exige: true, selo: p.selo || 'td', card: p.card || 'esq' }].concat(sp.precoPor ? [] : [{ t: 'cta' }]).concat([{ t: 'legal' }]) } },
  { id: 'fotoTopo', nome: 'Foto no topo', foto: true, peso: { evento: 10, oferta: 7, beneficio: 6 },
    pilha: { eixo: 'esq', blocos: (sp, p) => [{ t: 'foto', exige: true, sangra: 'topo', selo: 'bd' },
      { t: 'heroi', exige: true, estilo: sp.objetivo === 'beneficio' ? 'vazado' : 'realce' },
      sp.precoPor ? { t: 'preco' } : { t: 'apoio' }, { t: 'rodape' }, { t: 'legal' }] } },
  { id: 'fotoBase', nome: 'Foto na base', foto: true, peso: { oferta: 7, evento: 7, beneficio: 5 }, busca: { eixo: ['esq', 'centro'] },
    pilha: { eixo: 'esq', blocos: sp => [{ t: 'logo' }, { t: 'heroi', exige: true, estilo: sp.objetivo === 'beneficio' ? 'vazado' : 'realce' },
      sp.precoPor ? { t: 'preco' } : { t: 'apoio' }, { t: 'cta' }, { t: 'legal' }, { t: 'foto', exige: true, sangra: 'base', selo: 'td' }] } },
  { id: 'duplo', nome: 'Título em dois tamanhos', foto: true, peso: { oferta: 8, evento: 6 }, busca: { card: ['dir', 'esq'], selo: ['te', 'td'] },
    pilha: { eixo: 'esq', blocos: (sp, p) => [{ t: 'logo' }, { t: 'heroi', exige: true, estilo: 'duplo' }, { t: 'foto', exige: true, selo: p.selo || 'te', card: p.card || 'dir' }]
      .concat(sp.precoPor ? [] : [{ t: 'cta' }]).concat([{ t: 'legal' }]) } },
  { id: 'centro', nome: 'Centralizada', foto: true, peso: { oferta: 5, evento: 6, beneficio: 6 },
    pilha: { eixo: 'centro', blocos: sp => [{ t: 'logo' }, { t: 'heroi', exige: true, estilo: sp.objetivo === 'beneficio' ? 'vazado' : 'realce', k: sp.objetivo === 'beneficio' ? 0.72 : 1 },
      { t: 'foto', exige: true, selo: 'td' }, sp.precoPor ? { t: 'preco', k: 0.85 } : { t: 'apoio' }, { t: 'cta' }, { t: 'legal' }] } },
  // Sem foto: a tipografia é a arte (a entrega é o PNG final — nada de cinza "Use aqui sua foto")
  { id: 'precoHeroi', nome: 'Preço em destaque', foto: false, peso: { oferta: 10 }, serve: sp => !!sp.precoPor, busca: { eixo: ['esq', 'centro'] },
    pilha: { eixo: 'esq', blocos: [{ t: 'logo' }, { t: 'heroi', exige: true }, { t: 'apoio' }, { t: 'preco', exige: true, k: 1.15 }, { t: 'cta' }, { t: 'legal' }] } },
  { id: 'tipoCentro', nome: 'Tipográfica centralizada', foto: false, peso: { oferta: 6, evento: 8, beneficio: 7 }, fundos: ['#F85400', '#FF9000'], busca: { eixo: ['centro', 'esq'] },
    pilha: { eixo: 'centro', blocos: sp => [{ t: 'logo' }, { t: 'heroi', exige: true, k: 1.12, estilo: sp.objetivo === 'beneficio' ? 'vazado' : 'realce' },
      { t: 'apoio' }, sp.precoPor ? { t: 'preco' } : { t: 'selo' }, { t: 'cta' }, { t: 'legal' }] } },
  { id: 'tipoDuplo', nome: 'Título gigante', foto: false, peso: { oferta: 7, evento: 9 },
    pilha: { eixo: 'esq', blocos: sp => [{ t: 'heroi', exige: true, estilo: 'duplo', k: 1.15 }, { t: 'apoio' },
      sp.precoPor ? { t: 'preco' } : { t: 'selo' }, { t: 'rodape' }, { t: 'legal' }] } },
  { id: 'vazado', nome: 'Palavra vazada', foto: null, peso: { beneficio: 10 }, serve: sp => !!sp.palavra, fundos: ['#F85400', '#FF9000'], busca: { eixo: ['esq', 'centro'] },
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
  cupom: ['valor', 'valorInclinado'], aniversario: ['aniversario', 'aniversarioPattern'],
  // os objetivos novos começam com as famílias tipográficas e de foto; as composições especialistas
  // da frente 4 (composicoes.js) se acrescentam aqui ao carregar
  aviso: ['tipoCentro', 'tipoDuplo', 'fotoTopo', 'fotoBase', 'centro'], parceiro: ['fotoTopo', 'centro', 'tipoCentro', 'tipoDuplo'], prospeccao: ['tipoCentro', 'tipoDuplo', 'fotoTopo', 'fotoBase', 'centro'] };

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
    let r = (i > n * 0.5 ? c.slice(0, i) : t.slice(0, n)).trim();
    // nunca termina pendurado em artigo ou preposição ("DOMINGO DOCE COM SOBREMESA EM")
    while(/\s/.test(r) && _CR_COLA.test(r.split(/\s+/).pop())) r = r.replace(/\s+\S+$/, '');
    return r;
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
    itens: (Array.isArray(s.itens) ? s.itens : []).map(l => txt(l, 40)).filter(Boolean).slice(0, 4).map(l => l.charAt(0).toLocaleUpperCase('pt-BR') + l.slice(1)),
    // frente 4: nome da loja parceira (como a pessoa escreveu) e horário ("11H ÀS 22H") — só o que o pedido deu
    loja: txt(s.loja, 28),
    horario: up(txt(s.horario, 20)),
    tema: Array.isArray(s.tema) ? s.tema.slice() : crTema([s.pedido, s.titulo, s.apoio, s.topo, s.palavra].filter(Boolean).join(' '))
  };
  const P = {
    oferta:      { titulo: 'OFERTA DO DIA', apoio: 'Direto pelo app', cta: 'PEDIR' },
    cupom:       { chamada: ['pega este *cupom*', 'pra você *economizar!*'], cupomRotulo: 'USE O CÓDIGO', cupomCodigo: 'SEUCODIGO', cupomValor: '10' },
    evento:      { titulo: 'FESTIVAL', apoio: 'Direto pelo app', cta: 'VER NO APP' },
    beneficio:   { palavra: 'entrega', titulo: 'GRÁTIS', apoio: 'em pedidos pelo app', cta: 'PEÇA AGORA' },
    aniversario: { topo: 'BORA COMEMORAR!', anos: '3', chamada: ['o aniversário é *nosso,*', 'o presente é *seu!*'], cupomRotulo: 'SEU PRESENTE', cupomCodigo: 'NIVERDM', cupomValor: '15' },
    // copy genérica (não é dado): aviso não tem botão de pedir; o nome da loja nunca é inventado
    aviso:       { titulo: 'AVISO', apoio: 'Fique de olho no app' },
    parceiro:    { titulo: 'NOVIDADE NO APP', apoio: 'Conheça o cardápio no app', cta: 'PEDIR AGORA' },
    prospeccao:  { titulo: 'PEÇA NO APP', apoio: 'Tudo da sua cidade num app só', cta: 'SAIBA MAIS' }
  }[obj];
  // semCta: a leitura do pedido decidiu que a peça não pede ação no app (evento da cidade) — sem o botão padrão
  Object.keys(P).forEach(k => { if(k === 'cta' && s.semCta) return; if(!out[k] || (Array.isArray(out[k]) && !out[k].length)) out[k] = P[k]; });
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
  // Composições da frente 4 (js/creative/composicoes.js): a receita devolve as CAIXAS dos blocos
  // (e as zonas e grafismos) e quem desenha é o crDesenhar — o mesmo renderizador da IA designer
  if(receita.comp){
    const sc = receita.lista ? Object.assign({}, sp, { listar: true }) : sp;
    const c = receita.comp(sc, a, a.p, est);
    if(!c) return null;
    const r = crDesenhar(sc, Object.assign({ fundo: cor }, c), 0);
    r.receita = receita.id; r.nomeReceita = receita.nome; r.p = a.p; r.desenho = null; r.estouros = r.estouros.concat(est);
    return r;
  }
  if(receita.lockup) pecas = CR_LOCKUPS[receita.lockup](spP, a, est, cor, receita.variante || {});
  else if(!sp.foto){
    // Sem foto, a tipografia é a arte: herói e preço crescem até a pilha encher (teto 1,45×) — o
    // conteúdo não "boia" no meio com faixas laranja vazias em cima e embaixo. Com a busca, o kt
    // vem dela (uma tentativa só: não coube, a busca tenta outro valor).
    for(const kt of (p && p.kt ? [p.kt] : [1.45, 1.35, 1.25, 1.15, 1.05, 1])){
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
   GEOMETRIA SEM DOM — a caixa de cada bloco lida do SVG que o PRÓPRIO motor emitiu. A gramática é
   nossa e é fechada (rect, circle, ellipse, line, polyline, path, image, text/tspan e g com
   transform), então dá para ler sem montar nada na página: o texto é medido no canvas com as
   fontes reais, como a pilha já mede. É o que deixa a conferência e a nota rodarem milhares de
   vezes por segundo na busca. A medida pelo DOM (_crMede, mais abaixo) virou a VERIFICAÇÃO: as
   finalistas passam por ela, e a suíte prova que as duas não divergem mais que 3 px.
   Caixa de TEXTO = caixa de tinta de cada trecho (nó de texto) com a fonte DELE: largura pelo
   avanço (com o letter-spacing da classe), altura pela tinta dos glifos. Texto girado conta pela
   caixa da fonte girada (o olho vê o bloco inteiro, não a tinta de cada letra).
══════════════════════════════════════════════════════════════ */
const _crMet = new Map();
function _crMetrica(txt, fonte, ls){
  const k = fonte + '|' + ls + '|' + txt;
  let m = _crMet.get(k);
  if(!m){
    if(!_crCtx) _crCtx = document.createElement('canvas').getContext('2d');
    _crCtx.font = fonte;
    const t = _crCtx.measureText(txt);
    const n = [...txt].length;
    // a tinta da direita anda com o letter-spacing dos n−1 glifos de antes (negativo puxa, positivo empurra)
    m = { w: t.width + ls * n, a: t.actualBoundingBoxAscent, d: t.actualBoundingBoxDescent, fa: t.fontBoundingBoxAscent, fd: t.fontBoundingBoxDescent,
      l: t.actualBoundingBoxLeft, r: t.actualBoundingBoxRight + ls * Math.max(0, n - 1) };
    if(_crMet.size > 30000) _crMet.clear();
    _crMet.set(k, m);
  }
  return m;
}
// letter-spacing que a CLASSE declara no <style> da arte (crDefs) vence o atributo; as outras herdam o atributo
const _CR_LS_CLASSE = { hero: 1, sup: 1, legal: 1, media: 1 };
const _crFonteCls = (cls, size) => { const e = CR_ESTILO[cls]; return e ? (e.it ? 'italic ' : '') + e.peso + ' ' + size + 'px "LC ' + e.fam + '"' : '400 ' + size + 'px serif'; };
const _crMul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
function _crTransf(s){
  let m = [1, 0, 0, 1, 0, 0];
  String(s || '').replace(/(matrix|translate|scale|rotate)\s*\(([^)]*)\)/g, (x, f, a) => {
    const v = a.split(/[\s,]+/).filter(Boolean).map(Number);
    let n;
    if(f === 'matrix') n = v.length === 6 ? v : [1, 0, 0, 1, 0, 0];
    else if(f === 'translate') n = [1, 0, 0, 1, v[0] || 0, v[1] || 0];
    else if(f === 'scale') n = [v[0], 0, 0, v[1] == null ? v[0] : v[1], 0, 0];
    else {
      const r = (v[0] || 0) * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r);
      n = [c, sn, -sn, c, 0, 0];
      if(v.length > 2) n = _crMul(_crMul([1, 0, 0, 1, v[1], v[2]], n), [1, 0, 0, 1, -v[1], -v[2]]);
    }
    m = _crMul(m, n);
    return x;
  });
  return m;
}
// Caixa alinhada aos eixos de um retângulo local depois do transform (é o que o getBoundingClientRect faz)
function _crCaixaM(m, x0, y0, x1, y1){
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].forEach(([x, y]) => {
    const px = m[0] * x + m[2] * y + m[4], py = m[1] * x + m[3] * y + m[5];
    if(px < a) a = px; if(py < b) b = py; if(px > c) c = px; if(py > d) d = py;
  });
  return { x0: a, y0: b, x1: c, y1: d };
}
// Caixa justa de um path (curvas pelos extremos de verdade, arcos amostrados)
function _crPathCaixa(d){
  const tk = String(d || '').match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || [];
  let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, qx = 0, qy = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const pt = (px, py) => { if(px < x0) x0 = px; if(py < y0) y0 = py; if(px > x1) x1 = px; if(py > y1) y1 = py; };
  const num = () => +tk[i++];
  const ext3 = (p0, p1, p2, p3) => {   // raízes de B'(t) = 0 num eixo
    const a = -p0 + 3 * p1 - 3 * p2 + p3, b = 2 * (p0 - 2 * p1 + p2), c = p1 - p0, ts = [];
    if(Math.abs(a) < 1e-9){ if(Math.abs(b) > 1e-9) ts.push(-c / b); }
    else { const disc = b * b - 4 * a * c; if(disc >= 0){ const q = Math.sqrt(disc); ts.push((-b + q) / (2 * a), (-b - q) / (2 * a)); } }
    return ts.filter(t => t > 0 && t < 1);
  };
  const cub = (ax, ay, bx, by, cx, cy, dx, dy) => {
    pt(dx, dy);
    const B = (t, p0, p1, p2, p3) => { const u = 1 - t; return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3; };
    ext3(ax, bx, cx, dx).concat(ext3(ay, by, cy, dy)).forEach(t => pt(B(t, ax, bx, cx, dx), B(t, ay, by, cy, dy)));
  };
  const quad = (ax, ay, bx, by, cx, cy) => cub(ax, ay, ax + 2 / 3 * (bx - ax), ay + 2 / 3 * (by - ay), cx + 2 / 3 * (bx - cx), cy + 2 / 3 * (by - cy), cx, cy);
  const arco = (rx, ry, rot, fa, fs, ex, ey) => {
    pt(ex, ey);
    if(!rx || !ry) return;
    const f = rot * Math.PI / 180, cf = Math.cos(f), sf = Math.sin(f);
    const dx2 = (x - ex) / 2, dy2 = (y - ey) / 2, x1p = cf * dx2 + sf * dy2, y1p = -sf * dx2 + cf * dy2;
    rx = Math.abs(rx); ry = Math.abs(ry);
    const lam = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry);
    if(lam > 1){ rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
    const sg = fa === fs ? -1 : 1, nume = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
    const co = sg * Math.sqrt(Math.max(0, nume / (rx * rx * y1p * y1p + ry * ry * x1p * x1p)));
    const cxp = co * rx * y1p / ry, cyp = -co * ry * x1p / rx, cx = cf * cxp - sf * cyp + (x + ex) / 2, cy = sf * cxp + cf * cyp + (y + ey) / 2;
    const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
    let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if(!fs && dt > 0) dt -= 2 * Math.PI; else if(fs && dt < 0) dt += 2 * Math.PI;
    for(let k = 1; k < 32; k++){ const t = t1 + dt * k / 32; pt(cx + rx * Math.cos(t) * cf - ry * Math.sin(t) * sf, cy + rx * Math.cos(t) * sf + ry * Math.sin(t) * cf); }
  };
  while(i < tk.length){
    if(/[a-zA-Z]/.test(tk[i])) cmd = tk[i++];
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0;
    if(C === 'Z'){ x = sx; y = sy; continue; }
    if(C === 'M'){ x = ox + num(); y = oy + num(); sx = x; sy = y; pt(x, y); cmd = rel ? 'l' : 'L'; qx = x; qy = y; }
    else if(C === 'L'){ x = ox + num(); y = oy + num(); pt(x, y); qx = x; qy = y; }
    else if(C === 'H'){ x = ox + num(); pt(x, y); qx = x; qy = y; }
    else if(C === 'V'){ y = oy + num(); pt(x, y); qx = x; qy = y; }
    else if(C === 'C'){ const a = ox + num(), b = oy + num(), c = ox + num(), e = oy + num(), g = ox + num(), h = oy + num(); cub(x, y, a, b, c, e, g, h); qx = c; qy = e; x = g; y = h; }
    else if(C === 'S'){ const a = 2 * x - qx, b = 2 * y - qy, c = ox + num(), e = oy + num(), g = ox + num(), h = oy + num(); cub(x, y, a, b, c, e, g, h); qx = c; qy = e; x = g; y = h; }
    else if(C === 'Q'){ const a = ox + num(), b = oy + num(), g = ox + num(), h = oy + num(); quad(x, y, a, b, g, h); qx = a; qy = b; x = g; y = h; }
    else if(C === 'T'){ const a = 2 * x - qx, b = 2 * y - qy, g = ox + num(), h = oy + num(); quad(x, y, a, b, g, h); qx = a; qy = b; x = g; y = h; }
    else if(C === 'A'){ const rx = num(), ry = num(), rot = num(), fa = num(), fs = num(), g = ox + num(), h = oy + num(); arco(rx, ry, rot, fa, fs, g, h); x = g; y = h; qx = x; qy = y; }
    else i++;
  }
  return x0 === Infinity ? null : { x0, y0, x1, y1 };
}
const _crDesEnt = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
function _crAttrs(s){ const o = {}; s.replace(/([\w:-]+)\s*=\s*"([^"]*)"/g, (m, k, v) => { o[k] = v; return ''; }); return o; }
const _CR_FORA = { defs: 1, clipPath: 1, mask: 1, style: 1, filter: 1, linearGradient: 1, radialGradient: 1, pattern: 1, symbol: 1, title: 1, desc: 1 };
const _crNums = s => String(s || '').split(/[\s,]+/).filter(Boolean).map(Number);

// → { W, H, blocos: [{nome, x, y, w, h, maiorFonte, menorFonte, sobre}], textos: [{bloco, x0, y0, x1, y1, corpo, cls, cor, fundo, txt}] }
function crGeometria(svg){
  const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg) || [];
  const W = +vb[1] || CR_W, H = +vb[2] || 1350;
  const blocos = [], textos = [], formas = [];
  const pilha = [{ tag: '#', m: [1, 0, 0, 1, 0, 0], fora: false, bloco: null, fill: '#000000', stroke: 'none', op: 1, rot: false, cls: '', fs: 16, ls: 0, anc: 'start' }];
  let tx = null, ordem = 0;
  const re = /<!--[\s\S]*?-->|<(\/?)([\w:-]+)((?:\s+[\w:-]+\s*=\s*"[^"]*")*)\s*(\/?)>|([^<]+)/g;
  const caixa = (fr, b) => { if(b && fr.bloco && !fr.fora) fr.bloco.cx.push(b); };
  const solido = (fr, at, b) => {
    const f = at.fill || fr.fill, op = fr.op * (at.opacity != null ? +at.opacity : 1) * (at['fill-opacity'] != null ? +at['fill-opacity'] : 1);
    if(b && !fr.fora && /^#[0-9a-f]{6}$/i.test(f) && op >= 0.9) formas.push({ b, cor: f.toUpperCase(), ordem: ordem++ });
  };
  const fechaChunk = () => {
    if(!tx || !tx.chunk) return;
    const c = tx.chunk, w = tx.pen - c.x, k = c.anc === 'middle' ? w / 2 : c.anc === 'end' ? w : 0;
    c.runs.forEach(r => { r.x0 -= k; r.x1 -= k; });
    tx.chunk = null;
  };
  const novoChunk = (x, anc) => { fechaChunk(); tx.pen = x; tx.chunk = { x, anc, runs: [] }; tx.chunks.push(tx.chunk); };
  let mt;
  while((mt = re.exec(svg))){
    const fr = pilha[pilha.length - 1];
    if(mt[5] != null){
      if(!tx || fr.fora) continue;
      const s = _crDesEnt(mt[5].replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' '));
      if(!s) continue;
      if(!tx.chunk) novoChunk(tx.pen, fr.anc);
      const ls = _CR_LS_CLASSE[fr.cls] ? CR_ESTILO[fr.cls].ls : fr.ls, fonte = _crFonteCls(fr.cls, fr.fs), met = _crMetrica(s, fonte, ls);
      // dx/dy pendentes: os do elemento mais de dentro valem; a lista de dx é por caractere
      let dx = 0;
      for(let k = pilha.length - 1; k > 0; k--){
        const q = pilha[k];
        if(q.dxs && q.dxs.length){ const usa = q.dxs.splice(0, [...s].length); tx.pen += usa[0]; dx = usa.slice(1).reduce((u, v) => u + v, 0); break; }
        if(q.tag === 'text') break;
      }
      for(let k = pilha.length - 1; k > 0; k--){
        const q = pilha[k];
        if(q.dy != null){ tx.base += q.dy; q.dy = null; break; }
        if(q.tag === 'text') break;
      }
      // a caixa vai do avanço; quando a tinta do glifo passa dele (o "A" final do Realce em corpo
      // grande), o navegador estende a caixa até a tinta + 2 px — a medida segue o navegador
      const run = { x0: tx.pen - (met.l > 0 ? met.l + 2 : 0), x1: Math.max(tx.pen + met.w + dx, met.r > met.w ? tx.pen + dx + met.r + 2 : 0), base: tx.base, met, size: fr.fs, cls: fr.cls, cor: fr.fill === 'none' ? fr.stroke : fr.fill, txt: s, m: fr.m,
        // contorno grosso (o "adesivo": herói laranja com borda branca) separa o texto do fundo
        contorno: fr.fill !== 'none' && /^#[0-9a-f]{6}$/i.test(fr.stroke) && fr.sw >= fr.fs * 0.1 ? fr.stroke.toUpperCase() : null };
      tx.pen += met.w + dx;
      if(s.trim()) { tx.runs.push(run); tx.chunk.runs.push(run); }
      continue;
    }
    if(!mt[2]) continue;
    const tag = mt[2];
    if(mt[1] === '/'){
      const sai = pilha.pop();
      if(tag === 'text' && tx && sai.tag === 'text'){
        fechaChunk();
        if(tx.runs.length && !sai.fora){
          let b;
          if(sai.rot){
            // texto girado: a caixa da FONTE do <text> inteiro (união local dos trechos), girada — é o
            // que o navegador devolve (girar cada linha separada dá uma caixa menor que a dele)
            const x0 = Math.min(...tx.runs.map(r => r.x0)), x1 = Math.max(...tx.runs.map(r => r.x1));
            const y0 = Math.min(...tx.runs.map(r => r.base - Math.max(r.met.fa, r.met.a))), y1 = Math.max(...tx.runs.map(r => r.base + Math.max(r.met.fd, r.met.d)));
            b = _crCaixaM(tx.runs[0].m, x0, y0, x1, y1);
          }else{
            let u = null;
            tx.runs.forEach(r => { const c = _crCaixaM(r.m, r.x0, r.base - r.met.a, r.x1, r.base + r.met.d); u = u ? { x0: Math.min(u.x0, c.x0), y0: Math.min(u.y0, c.y0), x1: Math.max(u.x1, c.x1), y1: Math.max(u.y1, c.y1) } : c; });
            b = u;
          }
          caixa(sai, b);
          const maior = tx.runs.reduce((p, r) => (r.size * r.txt.length > p.size * p.txt.length ? r : p), tx.runs[0]);
          textos.push({ bloco: sai.bloco ? sai.bloco.nome : '', x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, corpo: Math.max(...tx.runs.map(r => r.size)),
            cls: maior.cls, cor: String(maior.cor || '').toUpperCase(), contorno: maior.contorno, txt: tx.runs.map(r => r.txt).join(''), ordem: ordem++, fundo: null,
            linhas: tx.chunks.map(c => c.runs.map(r => r.txt).join('').trim()).filter(Boolean) });
        }
        tx = null;
      }
      if(sai.blocoAqui){
        const bl = sai.blocoAqui;
        const c = bl.foto || (bl.cx.length ? bl.cx.reduce((u, q) => ({ x0: Math.min(u.x0, q.x0), y0: Math.min(u.y0, q.y0), x1: Math.max(u.x1, q.x1), y1: Math.max(u.y1, q.y1) })) : { x0: 0, y0: 0, x1: 0, y1: 0 });
        blocos.push({ nome: bl.nome, x: c.x0, y: c.y0, w: c.x1 - c.x0, h: c.y1 - c.y0, sobre: bl.sobre, maiorFonte: Math.max(0, ...bl.fs), menorFonte: bl.fs.length ? Math.min(...bl.fs) : 0 });
      }
      continue;
    }
    const at = _crAttrs(mt[3] || ''), auto = mt[4] === '/';
    const nf = { tag, m: at.transform ? _crMul(fr.m, _crTransf(at.transform)) : fr.m, fora: fr.fora || !!_CR_FORA[tag], bloco: fr.bloco,
      fill: at.fill || fr.fill, stroke: at.stroke || fr.stroke, sw: at['stroke-width'] != null ? parseFloat(at['stroke-width']) || 0 : (fr.sw || 0), op: fr.op * (at.opacity != null && tag === 'g' ? +at.opacity : 1),
      rot: fr.rot || /rotate|matrix/.test(at.transform || ''), cls: at.class || fr.cls, fs: at['font-size'] != null ? +at['font-size'] : fr.fs,
      ls: at['letter-spacing'] != null ? parseFloat(at['letter-spacing']) || 0 : fr.ls, anc: at['text-anchor'] || fr.anc, fotoG: at.id === 'foto_produto' };
    if(tag === 'g' && at['data-bloco'] != null && pilha.length === 2 && pilha[1].tag === 'svg'){
      nf.bloco = nf.blocoAqui = { nome: at['data-bloco'], cx: [], fs: [], sobre: false, foto: null };
    }
    if(nf.bloco && !nf.fora){
      if(at['data-sobrepoe'] != null) nf.bloco.sobre = true;
      if(at['font-size'] != null) nf.bloco.fs.push(parseFloat(at['font-size']) || 0);
    }
    if(!nf.fora){
      let b = null;
      if(tag === 'rect'){
        const x = +at.x || 0, y = +at.y || 0, w = +at.width || 0, h = +at.height || 0;
        if(w > 0 && h > 0) b = _crCaixaM(nf.m, x, y, x + w, y + h);
        if(b && fr.fotoG && nf.bloco && nf.bloco.nome === 'foto' && !nf.bloco.foto) nf.bloco.foto = b;
        solido(fr, at, b);
      }else if(tag === 'circle' || tag === 'ellipse'){
        const cx = +at.cx || 0, cy = +at.cy || 0, rx = +(at.r || at.rx) || 0, ry = +(at.r || at.ry) || 0;
        if(rx > 0 && ry > 0){ b = _crCaixaM(nf.m, cx - rx, cy - ry, cx + rx, cy + ry); solido(fr, at, b); }
      }else if(tag === 'line'){
        b = _crCaixaM(nf.m, Math.min(+at.x1 || 0, +at.x2 || 0), Math.min(+at.y1 || 0, +at.y2 || 0), Math.max(+at.x1 || 0, +at.x2 || 0), Math.max(+at.y1 || 0, +at.y2 || 0));
      }else if(tag === 'polyline' || tag === 'polygon'){
        const v = _crNums(at.points), xs = v.filter((n, k) => !(k % 2)), ys = v.filter((n, k) => k % 2);
        if(xs.length) b = _crCaixaM(nf.m, Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
      }else if(tag === 'path'){
        const p = _crPathCaixa(at.d);
        if(p){ b = _crCaixaM(nf.m, p.x0, p.y0, p.x1, p.y1); solido(fr, at, b); }
      }else if(tag === 'image'){
        const x = +at.x || 0, y = +at.y || 0, w = +at.width || 0, h = +at.height || 0;
        if(w > 0 && h > 0) b = _crCaixaM(nf.m, x, y, x + w, y + h);
      }else if(tag === 'text'){
        tx = { runs: [], chunk: null, chunks: [], pen: _crNums(at.x)[0] || 0, base: _crNums(at.y)[0] || 0 };
        if(at.dx != null) nf.dxs = _crNums(at.dx);
        if(at.dy != null) nf.dy = _crNums(at.dy)[0] || 0;
      }else if(tag === 'tspan' && tx){
        if(at.y != null) tx.base = _crNums(at.y)[0] || 0;
        if(at.x != null) novoChunk(_crNums(at.x)[0] || 0, nf.anc);
        if(at.dx != null) nf.dxs = _crNums(at.dx);
        if(at.dy != null) nf.dy = _crNums(at.dy)[0] || 0;
      }
      if(b && tag !== 'text' && tag !== 'tspan') caixa(nf, b);
    }
    if(!auto) pilha.push(nf);
    else if(nf.blocoAqui) blocos.push({ nome: nf.blocoAqui.nome, x: 0, y: 0, w: 0, h: 0, sobre: false, maiorFonte: 0, menorFonte: 0 });
    else if(tag === 'text') tx = null;
  }
  // fundo de cada texto: a forma sólida mais de cima, desenhada antes dele, sob o centro do texto
  const fundoArte = (formas[0] && formas[0].cor) || '#F85400';
  textos.forEach(t => {
    const px = (t.x0 + t.x1) / 2, py = (t.y0 + t.y1) / 2;
    let f = null;
    for(let k = formas.length - 1; k >= 0; k--){ const q = formas[k]; if(q.ordem < t.ordem && px >= q.b.x0 && px <= q.b.x1 && py >= q.b.y0 && py <= q.b.y1){ f = q.cor; break; } }
    t.fundo = f || fundoArte;
  });
  // as zonas de cor (placas, cartões, faixas) que as composições desenham por trás dos blocos
  const zonas = [...svg.matchAll(/<rect data-zona="1" x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)].map(m => ({ x: +m[1], y: +m[2], w: +m[3], h: +m[4] }));
  return { W, H, blocos, textos, zonas };
}

/* ══════════════════════════════════════════════════════════════
   CONFERÊNCIA GEOMÉTRICA (o lint-art.js da skill): ERRO reprova a diagramação; AVISO é dica.
   As regras rodam sobre a geometria sem DOM (crAvaliar, a da busca) e sobre a medida pelo DOM
   (crAvaliarDom, a verificação final): é a MESMA função de regras, com as duas réguas.
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
  // Caixa de TINTA do texto, trecho a trecho (cada nó de texto com a fonte do elemento dele): a caixa
  // do navegador é a da fonte (sobra acima das maiúsculas e abaixo da linha) e acusaria colisão onde
  // o olho vê 40 px de ar. Antes media o <text> inteiro no maior corpo e com a fonte do <text> — o
  // "R$" do preço contava no tamanho do número e a chamada leve/forte era medida em serifa.
  const tintas = t => {
    const cx = [], w = document.createTreeWalker(t, NodeFilter.SHOW_TEXT);
    for(let n = w.nextNode(); n; n = w.nextNode()){
      const s = n.nodeValue.replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ');
      if(!s.trim()) continue;
      const el = n.parentNode, cs = getComputedStyle(el), r = rel(el.getBoundingClientRect()), fs = parseFloat(cs.fontSize) || 16;
      _crCtx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + fs + 'px ' + cs.fontFamily;
      // a caixa do navegador começa na tinta quando o acento passa da altura da fonte (É, Á do Realce)
      const m = _crCtx.measureText(s), topo = r.y0 + Math.max(0, m.fontBoundingBoxAscent - m.actualBoundingBoxAscent);
      cx.push({ x0: r.x0, x1: r.x1, y0: topo, y1: topo + m.actualBoundingBoxAscent + m.actualBoundingBoxDescent });
    }
    return cx;
  };
  const caixaDe = g => {
    const cx = [];
    g.querySelectorAll('rect,circle,ellipse,path,line,polyline,image').forEach(el => {
      if(!el.closest('clipPath,defs,mask')) cx.push(rel(el.getBoundingClientRect()));
    });
    g.querySelectorAll('text').forEach(t => {
      if(t.closest('clipPath,defs,mask')) return;
      if(t.closest('[transform*="rotate"],[transform*="matrix"]')){ cx.push(rel(t.getBoundingClientRect())); return; }
      cx.push(...tintas(t));
    });
    if(!cx.length) return { x: 0, y: 0, w: 0, h: 0 };
    const x0 = Math.min(...cx.map(c => c.x0)), y0 = Math.min(...cx.map(c => c.y0)), x1 = Math.max(...cx.map(c => c.x1)), y1 = Math.max(...cx.map(c => c.y1));
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  };
  const blocos = [...svg.querySelectorAll(':scope > [data-bloco]')].map(g => {
    // a foto conta pelo retângulo do slot (a imagem dentro pode ser maior que o recorte)
    const fr = g.dataset.bloco === 'foto' && g.querySelector('#foto_produto > rect');
    const c = fr ? (r => ({ x: r.x0, y: r.y0, w: r.x1 - r.x0, h: r.y1 - r.y0 }))(rel(fr.getBoundingClientRect())) : caixaDe(g);
    const fs = [...g.querySelectorAll('[font-size]')].filter(t => !t.closest('clipPath,defs,mask')).map(t => parseFloat(t.getAttribute('font-size')) || 0);
    return Object.assign(c, { nome: g.dataset.bloco, sobre: !!g.querySelector('[data-sobrepoe]'), maiorFonte: Math.max(0, ...fs), menorFonte: fs.length ? Math.min(...fs) : 0 });
  });
  svg.remove();
  return blocos;
}
// As regras da marca sobre uma lista de blocos (de qualquer das duas réguas)
function _crRegras(r, todos){
  const a = crArea(r.spec.formato), sp = r.spec, erros = [], avisos = [];
  // grafismo (decor) é fundo: pode sangrar e passar atrás do texto — fica fora da conferência
  const bs = todos.filter(b => b.nome !== 'decor');
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
// A da busca (sem DOM): a geometria fica junto, para a nota não ler o SVG duas vezes
function crAvaliar(r){
  const geo = crGeometria(r.svg), av = _crRegras(r, geo.blocos);
  av.geo = geo;
  return av;
}
// A da verificação final (as finalistas): o navegador mede de verdade
function crAvaliarDom(r){ return _crRegras(r, _crMede(r.svg)); }

/* ══════════════════════════════════════════════════════════════
   NOTA DE DESIGN — função pura e determinística sobre a geometria (sem DOM, sem IA). Seis partes de
   0 a 1, pesadas por objetivo e formato (CR_NOTA_PESOS, um objeto editável — a curadoria do Ryan
   ajusta os mesmos números). Regra da marca não entra aqui como "pontinho a menos": erro de
   crAvaliar zera a nota antes de qualquer conta.
══════════════════════════════════════════════════════════════ */
const CR_NOTA_PARTES = ['equilibrio', 'vazio', 'eixos', 'escala', 'contraste', 'respiro'];
const CR_NOTA_PESOS = {
  padrao:   { equilibrio: 1.1, vazio: 1.3, eixos: 0.8, escala: 1.4, contraste: 0.6, respiro: 0.8 },
  objetivo: {
    oferta: { escala: 1.2 }, cupom: { escala: 1.15, eixos: 0.85 }, evento: { vazio: 1.1 }, beneficio: { escala: 1.1 },
    aniversario: { escala: 1.1, eixos: 0.9 }, aviso: { contraste: 1.3, eixos: 1.1 }, parceiro: { equilibrio: 1.1 }, prospeccao: { eixos: 1.1 }
  },
  formato:  {
    feed: {}, story: { vazio: 1.15 }, inapp: { vazio: 1.1 }, carrossel: { equilibrio: 0.8, vazio: 0.9 },
    banner: { vazio: 0.5, equilibrio: 0.8, eixos: 0.8 }, emailTopo: { vazio: 0.6, eixos: 0.8 }, emailRodape: { vazio: 0.4 }, capa: { vazio: 0.7 }, slide: { escala: 0.8 }
  }
};
let _crPesosCuradoria = null;   // pesos ajustados pelos votos da curadoria (frente 5); null = os do código
function crNotaPesos(objetivo, formato){
  const base = Object.assign({}, CR_NOTA_PESOS.padrao), o = CR_NOTA_PESOS.objetivo[objetivo] || {}, f = CR_NOTA_PESOS.formato[formato] || {}, c = _crPesosCuradoria || {};
  CR_NOTA_PARTES.forEach(k => { base[k] *= (o[k] || 1) * (f[k] || 1) * (c[k] || 1); });
  return base;
}
const CR_NOTA_FRASES = {
  equilibrio: ['peso bem distribuído', 'peso desequilibrado na peça'], vazio: ['respiro com ritmo', 'vazio mal distribuído'],
  eixos: ['tudo num eixo só', 'alinhamentos demais'], escala: ['hierarquia clara', 'hierarquia tipográfica fraca'],
  contraste: ['leitura com contraste', 'contraste baixo em algum texto'], respiro: ['margens e foto na medida', 'margens ou foto fora da medida']
};
// Contraste WCAG entre duas cores #RRGGBB
function crContraste(c1, c2){
  const L = h => { const v = [1, 3, 5].map(i => parseInt(String(h).slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  if(!/^#[0-9A-F]{6}$/i.test(c1) || !/^#[0-9A-F]{6}$/i.test(c2)) return 4.5;
  const a = L(c1), b = L(c2);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
const _CR_PAR_MARCA = { [CR_C.branco + CR_C.solar]: 1, [CR_C.laranja + CR_C.amarelo]: 1, [CR_C.rosa + CR_C.amarelo]: 1 };
const _crLim = (v, a, b) => Math.max(0, Math.min(1, (v - a) / (b - a)));
const _CR_PAPEL = { titulo: 'heroi', valor: 'heroi', anos: 'heroi', preco: 'heroi', apoio: 'apoio', chamada: 'apoio', itens: 'apoio', legal: 'legal' };
const _CR_GRUPO = { logo: 'marca', tag: 'intro', chamada: 'intro', titulo: 'msg', apoio: 'msg', anos: 'msg', preco: 'oferta', valor: 'oferta', selo: 'oferta', cupom: 'oferta',
  foto: 'imagem', mockup: 'imagem', botao: 'acao', legal: 'acao', itens: 'conteudo' };

// geo = crGeometria(svg) · ctx = { formato, objetivo, fundo, erros } → { total, partes, porque }
function crNotaDesign(geo, ctx){
  const c = ctx || {}, a = crArea(c.formato), partes = {};
  if(c.erros){ CR_NOTA_PARTES.forEach(k => { partes[k] = 0; }); return { total: 0, partes, porque: 'Reprovada nas regras da marca' }; }
  const L = a.laminas ? 1080 : a.W, n = a.laminas || 1;
  const z = { x0: a.card ? a.card[0] : a.M, x1: a.card ? a.card[0] + a.card[2] : L - a.M, y0: a.seguroTopo, y1: a.seguroBase };
  const zw = z.x1 - z.x0, zh = z.y1 - z.y0;
  const todos = geo.blocos.filter(b => b.w > 0 && b.h > 0);
  // carrossel: cada lâmina é um post — equilíbrio, vazio, eixos e margens por lâmina, e a média
  // (o bloco que atravessa a divisa — a foto, um grafismo — aparece nos dois posts: entra recortado em cada lâmina)
  const porLamina = k => n === 1 ? todos : todos.filter(b => b.x < (k + 1) * L && b.x + b.w > k * L && (b.nome === 'foto' || b.nome === 'decor' || Math.floor((b.x + b.w / 2) / L) === k))
    .map(b => { const x0 = Math.max(b.x, k * L - (b.x < k * L ? 40 : 0)), x1 = Math.min(b.x + b.w, (k + 1) * L + (b.x + b.w > (k + 1) * L ? 40 : 0)); return Object.assign({}, b, { x: x0 - k * L, w: x1 - x0 }); });
  const textos = geo.textos.filter(t => t.bloco && t.bloco !== 'decor' && t.bloco !== 'foto');   // o placeholder da foto não é texto da arte
  // com contorno grosso, o texto se lê pelo par mais fraco entre texto→contorno e contorno→fundo
  const corDe = t => t.contorno ? Math.max(crContraste(t.cor, t.fundo), Math.min(crContraste(t.cor, t.contorno), crContraste(t.contorno, t.fundo))) : crContraste(t.cor, t.fundo);
  const cfBloco = nome => { const ts = textos.filter(t => t.bloco === nome); if(!ts.length) return 0.8; const t = ts.reduce((p, q) => ((q.x1 - q.x0) * (q.y1 - q.y0) > (p.x1 - p.x0) * (p.y1 - p.y0) ? q : p)); return Math.max(0.2, Math.min(1, (corDe(t) - 1) / 3)); };
  const sangra = b => b.x < -2 || b.y < -2 || b.x + b.w > L + 2 || b.y + b.h > a.H + 2;
  const media = f => { let s = 0; for(let k = 0; k < n; k++) s += f(porLamina(k)); return s / n; };

  // 1) Equilíbrio: centro de massa (área × corpo × contraste) contra o centro da zona útil
  const eixoDe = bs => {
    const al = bs.filter(b => b.nome !== 'decor' && !sangra(b) && b.w < zw * 0.9);
    let e = 0, d = 0, cc = 0;
    al.forEach(b => { const l = Math.abs(b.x - z.x0) <= 6, r = Math.abs(b.x + b.w - z.x1) <= 6, m = Math.abs(b.x + b.w / 2 - (z.x0 + z.x1) / 2) <= 6; if(m) cc++; else if(l) e++; else if(r) d++; });
    return cc > e && cc > d ? 'centro' : d > e ? 'dir' : 'esq';
  };
  partes.equilibrio = media(bs => {
    let mx = 0, my = 0, mt = 0;
    bs.forEach(b => {
      const x0 = Math.max(0, b.x), y0 = Math.max(0, b.y), x1 = Math.min(L, b.x + b.w), y1 = Math.min(a.H, b.y + b.h);
      if(x1 <= x0 || y1 <= y0) return;
      const f = b.nome === 'foto' ? 1.1 : b.nome === 'decor' ? 0.3 : b.nome === 'logo' ? 0.7 : b.maiorFonte ? Math.sqrt(Math.max(0.4, Math.min(2.5, b.maiorFonte / 80))) : 0.6;
      const k = (x1 - x0) * (y1 - y0) * f * (b.nome === 'foto' ? 0.9 : b.nome === 'decor' ? 0.6 : cfBloco(b.nome));
      mx += k * (x0 + x1) / 2; my += k * (y0 + y1) / 2; mt += k;
    });
    if(!mt) return 0;
    const dy = (my / mt - (z.y0 + z.y1) / 2) / (zh / 2), dx = (mx / mt - (z.x0 + z.x1) / 2) / (zw / 2), eixo = eixoDe(bs);
    const sv = 1 - _crLim(Math.abs(dy + 0.04), 0.1, 0.55);
    // assimetria intencional: com eixo à esquerda o peso pode morar na metade esquerda (e vice-versa)
    const [lo, hi] = eixo === 'esq' ? [-0.5, 0.12] : eixo === 'dir' ? [-0.12, 0.5] : [-0.12, 0.12];
    const sh = 1 - _crLim(dx < lo ? lo - dx : dx > hi ? dx - hi : 0, 0, 0.4);
    return a.deitado && !a.laminas ? 0.35 * sv + 0.65 * sh : 0.6 * sv + 0.4 * sh;
  });

  // 2) Vazio e ritmo: proporção de vazio, maior faixa contínua vazia e proximidade dos grupos
  partes.vazio = media(bs => {
    const cheios = bs.filter(b => b.nome !== 'decor');
    // área ocupada (união aproximada por grade de 20 px dentro da zona)
    const passo = 20, cols = Math.ceil(zw / passo), lins = Math.ceil(zh / passo), grade = new Uint8Array(cols * lins);
    cheios.forEach(b => {
      const c0 = Math.max(0, Math.floor((b.x - z.x0) / passo)), c1 = Math.min(cols, Math.ceil((b.x + b.w - z.x0) / passo));
      const l0 = Math.max(0, Math.floor((b.y - z.y0) / passo)), l1 = Math.min(lins, Math.ceil((b.y + b.h - z.y0) / passo));
      for(let l = l0; l < l1; l++) for(let cc = c0; cc < c1; cc++) grade[l * cols + cc] = 1;
    });
    let oc = 0; grade.forEach(v => { oc += v; });
    const vazio = 1 - oc / grade.length;
    const sProp = a.deitado ? 1 - _crLim(Math.abs(vazio - 0.45), 0.2, 0.45) : 1 - _crLim(vazio < 0.3 ? 0.3 - vazio : vazio > 0.66 ? vazio - 0.66 : 0, 0, 0.25);
    // maior faixa horizontal vazia (o conteúdo "boiando" ou um buraco no meio)
    // (um grafismo grande ou uma placa contida — cartão, placa que não sangra — no vão não deixa a faixa
    // vazia; a faixa que sangra de ponta a ponta é fundo. A ocupação acima continua só com conteúdo.)
    const placas = (geo.zonas || []).filter(q => q.x > 0 && q.x + q.w < L * n && q.w * q.h > 40000).map(q => ({ y: q.y, h: q.h }));
    const ys = cheios.concat(bs.filter(b => b.nome === 'decor' && b.w >= 120), placas).map(b => [Math.max(z.y0, b.y), Math.min(z.y1, b.y + b.h)]).filter(v => v[1] > v[0]).sort((u, v) => u[0] - v[0]);
    let cur = z.y0, faixa = 0;
    ys.forEach(([y0, y1]) => { faixa = Math.max(faixa, y0 - cur); cur = Math.max(cur, y1); });
    faixa = Math.max(faixa, z.y1 - cur);
    const sFaixa = a.deitado ? 1 : 1 - _crLim(faixa / zh, 0.12, 0.28);
    // proximidade: o vão DENTRO de um grupo é menor que o vão ENTRE grupos
    const seq = cheios.filter(b => b.nome !== 'foto' || !sangra(b)).slice().sort((p, q) => p.y - q.y);
    const intra = [], entre = [];
    for(let k = 1; k < seq.length; k++){
      const p = seq[k - 1], q = seq[k], gap = q.y - (p.y + p.h);
      if(gap < 0 || Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x) < -40) continue;   // lado a lado ou sobrepostos: não é ritmo vertical
      ((_CR_GRUPO[p.nome] || p.nome) === (_CR_GRUPO[q.nome] || q.nome) ? intra : entre).push(gap);
    }
    let sProx = 1;
    if(intra.length && entre.length){ let ok = 0, t = 0; intra.forEach(i => entre.forEach(e => { t++; if(i < e * 0.85) ok++; })); sProx = ok / t; }
    if(entre.length > 1){ const mn = Math.min(...entre), mx = Math.max(...entre); if(mx > mn * 3.2 && !a.deitado) sProx *= 0.85; }
    return 0.3 * sProp + 0.4 * sFaixa + 0.3 * sProx;
  });

  // 3) Eixos de alinhamento: quantas bordas esquerdas, centros e direitas distintas (6 px)
  partes.eixos = media(bs => {
    const al = bs.filter(b => b.nome !== 'decor' && !sangra(b));
    if(al.length < 2) return 1;
    const cands = [];
    al.forEach(b => [['e', b.x], ['c', b.x + b.w / 2], ['d', b.x + b.w]].forEach(([t, v]) => cands.push({ t, v })));
    const cobre = (e, b) => Math.abs((e.t === 'e' ? b.x : e.t === 'c' ? b.x + b.w / 2 : b.x + b.w) - e.v) <= 6;
    let resto = al.slice(), nx = 0, dom = 0;
    while(resto.length){
      let melhor = null, mq = -1;
      cands.forEach(e => { const q = resto.filter(b => cobre(e, b)).length; if(q > mq){ mq = q; melhor = e; } });
      if(!nx) dom = mq / al.length;
      resto = resto.filter(b => !cobre(melhor, b)); nx++;
    }
    return Math.min(1, 1 - Math.max(0, nx - 1) * 0.2 + (dom >= 0.7 ? 0.15 : 0));
  });

  // 4) Escala tipográfica: níveis (3 é o ideal), razão entre níveis (1,5–3×) e herói dominante
  {
    const papel = [];
    todos.forEach(b => {
      const p = _CR_PAPEL[b.nome]; if(!p) return;
      let corpo = b.maiorFonte;
      if(p !== 'heroi'){ const ts = textos.filter(t => t.bloco === b.nome); if(ts.length) corpo = ts.reduce((q, t) => (t.txt.length > q.txt.length ? t : q)).corpo; }
      if(corpo) papel.push({ p, corpo, lam: Math.floor((b.x + b.w / 2) / L) });
    });
    papel.sort((u, v) => v.corpo - u.corpo);
    const vals = papel.map(x => x.corpo);
    if(!vals.length) partes.escala = 0.5;
    else {
      const niveis = [];
      vals.forEach(v => { if(!niveis.length || niveis[niveis.length - 1] / v > 1.2) niveis.push(v); });
      const sN = [0.45, 0.45, 0.8, 1, 0.85, 0.65, 0.5][Math.min(6, niveis.length)];
      let sR = 1;
      if(niveis.length > 1){
        const rs = niveis.slice(1).map((v, k) => niveis[k] / v);
        sR = rs.reduce((s, r) => s + (r < 1.5 ? 0.25 + 0.75 * _crLim(r, 1.2, 1.5) : r <= 3.4 ? 1 : 1 - 0.45 * _crLim(r, 3.4, 6)), 0) / rs.length;
      }
      const heroi = vals[0], seg = vals[1] || 0;
      // dois heróis do mesmo tamanho brigam (título e preço quase iguais): um tem de mandar
      // (no carrossel, heróis em lâminas diferentes não brigam: cada lâmina é um post)
      const sD = !seg || papel[0].lam !== papel[1].lam ? 1 : _crLim(heroi / seg, 1.04, 1.35);
      // foco: o herói tem de OCUPAR a peça (tinta do maior herói sobre a zona útil) e vir cedo na
      // leitura — herói miúdo num canvas vazio, ou o valor do cupom depois do ticket, é hierarquia fraca
      const hb = todos.filter(b => _CR_PAPEL[b.nome] === 'heroi').sort((p, q) => q.maiorFonte - p.maiorFonte)[0];
      // (carrossel: cada lâmina é um post — o herói se mede contra a lâmina dele, com a régua do feed)
      const share = hb ? hb.w * hb.h / (zw * zh) : 0, sF = _crLim(share, a.deitado && !a.laminas ? 0.06 : 0.03, a.deitado && !a.laminas ? 0.2 : 0.09);
      const leitura = todos.filter(b => _CR_PAPEL[b.nome] || ['cupom', 'botao', 'selo'].indexOf(b.nome) >= 0).sort((p, q) => p.y - q.y || p.x - q.x);
      const ih = leitura.findIndex(b => _CR_PAPEL[b.nome] === 'heroi'), sO = ih <= 1 ? 1 : ih === 2 ? 0.75 : 0.45;
      // quebra de linha: título, apoio ou letra miúda terminando em artigo/preposição, ou uma palavrinha
      // sozinha na última linha, é erro de diagramador — cada uma tira 20% da escala
      let ruins = 0;
      textos.forEach(t => {
        if(!_CR_PAPEL[t.bloco] || !t.linhas || t.linhas.length < 2) return;
        t.linhas.slice(0, -1).forEach(l => { if(_CR_COLA.test(l.split(/\s+/).pop())) ruins++; });
        const u = t.linhas[t.linhas.length - 1]; if(!/\s/.test(u) && [...u].length <= 3) ruins++;
      });
      partes.escala = (0.15 * sN + 0.2 * sR + 0.2 * sD + 0.3 * sF + 0.15 * sO) * Math.max(0.4, 1 - 0.2 * ruins);
    }
  }

  // 5) Contraste: WCAG de cada texto contra o fundo sólido dele (as regras do #FF9000 continuam como erro)
  {
    let s = 0, p = 0;
    textos.forEach(t => {
      const area = Math.max(1, (t.x1 - t.x0) * (t.y1 - t.y0)), w = Math.sqrt(area), r = corDe(t), alvo = t.corpo >= 40 ? 3 : 4.5;
      let v = r >= alvo ? 1 : r >= 3 ? 0.85 : 0.7 * _crLim(r, 1.4, alvo);
      // pares de display aprovados da marca (branco no #FF9000 com herói ≥ 110; laranja/rosa no amarelo,
      // como a Promo Turbinada): valem, mas não são o melhor par
      if(r < 3 && t.corpo >= Math.max(40, a.heroiMin) && _CR_PAR_MARCA[t.cor + t.fundo] && (t.fundo !== CR_C.solar || t.corpo >= 110)) v = Math.max(v, 0.75);
      s += v * w; p += w;
    });
    partes.contraste = p ? s / p : 1;
  }

  // 6) Respiro lateral e foto: margens simétricas; fração e posição da foto
  partes.respiro = media(bs => {
    const fr = bs.filter(b => b.nome !== 'decor' && !sangra(b)), f = bs.find(b => b.nome === 'foto');
    // foto ocupando um lado inteiro (sangrando pela lateral): a assimetria das margens é a composição
    const lado = f && sangra(f) && (f.x <= 2 || f.x + f.w >= L - 2) && f.w < L * 0.8 && f.h > a.H * 0.6;
    let sM = 1;
    if(fr.length && !lado){
      const mL = Math.min(...fr.map(b => b.x)) - (a.card ? a.card[0] : 0), mR = (a.card ? a.card[0] + a.card[2] : L) - Math.max(...fr.map(b => b.x + b.w));
      sM = 1 - _crLim(Math.abs(mL - mR), 16, 16 + 0.22 * L);
    }
    if(!f) return sM;
    const x0 = Math.max(0, f.x), y0 = Math.max(0, f.y), x1 = Math.min(L, f.x + f.w), y1 = Math.min(a.H, f.y + f.h);
    const frac = Math.max(0, x1 - x0) * Math.max(0, y1 - y0) / (L * a.H), [lo, hi] = a.deitado ? [0.2, 0.55] : [0.24, 0.5];
    const sF = 1 - _crLim(frac < lo ? lo - frac : frac > hi ? frac - hi : 0, 0, 0.18);
    const dentro = f.x >= a.M - 6 && f.x + f.w <= L - a.M + 6, borda = sangra(f) || f.x <= 2 || f.x + f.w >= L - 2 || f.y <= 2 || f.y + f.h >= a.H - 2;
    return 0.5 * sM + 0.5 * sF * (dentro || borda ? 1 : 0.6);
  });

  const pesos = crNotaPesos(c.objetivo, a.fmt);
  let soma = 0, pt = 0;
  CR_NOTA_PARTES.forEach(k => { partes[k] = Math.round(Math.max(0, Math.min(1, partes[k])) * 1000) / 1000; soma += pesos[k] * partes[k]; pt += pesos[k]; });
  // o elo mais fraco pesa: uma peça é tão boa quanto o pior defeito dela (média alta com um buraco
  // no meio não é arte boa) — a média cai até 30% conforme a pior parte relevante
  const piorRel = Math.min(...CR_NOTA_PARTES.filter(k => pesos[k] >= 0.7).map(k => partes[k]));
  const total = Math.round(100 * (soma / pt) * (0.7 + 0.3 * piorRel));
  const ord = CR_NOTA_PARTES.slice().sort((u, v) => partes[v] * pesos[v] - partes[u] * pesos[u] || CR_NOTA_PARTES.indexOf(u) - CR_NOTA_PARTES.indexOf(v));
  const pior = CR_NOTA_PARTES.slice().sort((u, v) => partes[u] - partes[v] || CR_NOTA_PARTES.indexOf(u) - CR_NOTA_PARTES.indexOf(v))[0];
  const frase = CR_NOTA_FRASES[ord[0]][0] + (ord[1] && partes[ord[1]] >= 0.85 ? ' e ' + CR_NOTA_FRASES[ord[1]][0] : '');
  const porque = frase.charAt(0).toUpperCase() + frase.slice(1) + (partes[pior] < 0.7 ? '; ' + CR_NOTA_FRASES[pior][1] : '');
  return { total, partes, porque, sinais: _crSinais(porLamina(0), z, L, a, eixoDe) };
}
// A assinatura de design de uma peça (o que o olho percebe primeiro): de que lado mora o peso, em
// que altura, o eixo, o tamanho e o lugar da foto, a escala do herói. A busca usa para que as 3
// finalistas sejam diferentes de verdade — não a mesma planta com outro nome de receita.
function _crSinais(bs, z, L, a, eixoDe){
  let mx = 0, my = 0, mt = 0;
  bs.forEach(b => {
    const x0 = Math.max(0, b.x), y0 = Math.max(0, b.y), x1 = Math.min(L, b.x + b.w), y1 = Math.min(a.H, b.y + b.h);
    if(x1 <= x0 || y1 <= y0 || b.nome === 'decor') return;
    const k = (x1 - x0) * (y1 - y0) * (b.nome === 'foto' ? 1 : b.maiorFonte ? Math.sqrt(Math.max(0.4, Math.min(2.5, b.maiorFonte / 80))) : 0.6);
    mx += k * (x0 + x1) / 2; my += k * (y0 + y1) / 2; mt += k;
  });
  const dx = mt ? (mx / mt - (z.x0 + z.x1) / 2) / ((z.x1 - z.x0) / 2) : 0, dy = mt ? (my / mt - (z.y0 + z.y1) / 2) / ((z.y1 - z.y0) / 2) : 0;
  const f = bs.find(b => b.nome === 'foto'), h = bs.filter(b => _CR_PAPEL[b.nome] === 'heroi').sort((p, q) => q.maiorFonte - p.maiorFonte)[0];
  const frac = f ? Math.max(0, Math.min(L, f.x + f.w) - Math.max(0, f.x)) * Math.max(0, Math.min(a.H, f.y + f.h) - Math.max(0, f.y)) / (L * a.H) : 0;
  const share = h ? h.w * h.h / ((z.x1 - z.x0) * (z.y1 - z.y0)) : 0, fy = f ? (f.y + f.h / 2) / a.H : 0, fx = f ? (f.x + f.w / 2) / L : 0;
  const s = {
    peso: dx < -0.15 ? 'esq' : dx > 0.15 ? 'dir' : 'centro', altura: dy < -0.12 ? 'alto' : dy > 0.12 ? 'baixo' : 'meio', eixo: eixoDe(bs),
    foto: !f ? '-' : frac < 0.22 ? 'p' : frac < 0.38 ? 'm' : 'g', pos: !f ? '-' : (f.w < L * 0.62 && Math.abs(fx - 0.5) > 0.12) ? 'lado' : fy < 0.4 ? 'topo' : fy > 0.6 ? 'base' : 'meio',
    escala: share < 0.05 ? 's' : share < 0.1 ? 'm' : 'g'
  };
  s.txt = [s.peso, s.altura, s.eixo, s.foto, s.pos, s.escala].join('|');
  return s;
}
const CR_SINAIS = ['peso', 'altura', 'eixo', 'foto', 'pos', 'escala'];
const crDistAssinatura = (a, b) => CR_SINAIS.reduce((d, k) => d + (a[k] !== b[k] ? 1 : 0), 0);
/* Planta da arte: grade 6×8 com o que domina cada célula — F foto, H herói (título, valor, preço),
   T texto, A ação e marca, L lista, Z placa de cor, · vazio. A assinatura diz o JEITO da peça; a planta
   diz o DESENHO: duas composições com a mesma planta para o mesmo conteúdo são clones. */
const _CR_PLANTA = { foto: 'F', mockup: 'F', titulo: 'H', valor: 'H', anos: 'H', preco: 'H', itens: 'L', botao: 'A', logo: 'A', logoLoja: 'A', decor: '' };
function crPlanta(r){
  // (carrossel: 6 colunas POR lâmina — cada lâmina é um post)
  const f = CR_FORMATOS[r.spec && r.spec.formato] || {}, geo = crGeometria(r.svg), C = 6 * (f.laminas || 1), L = 8, cw = geo.W / C, ch = geo.H / L, out = [];
  const zonas = [...r.svg.matchAll(/<rect data-zona="1" x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)]
    .map(m => ({ nome: 'zona', x: +m[1], y: +m[2], w: +m[3], h: +m[4] }));
  const pecas = zonas.concat(geo.blocos);
  for(let j = 0; j < L; j++) for(let i = 0; i < C; i++){
    const x0 = i * cw, y0 = j * ch;
    let rot = '·', melhor = 0.12;   // a célula é do que cobre mais dela (o de cima ganha o empate)
    pecas.forEach(b => {
      const k = _CR_PLANTA[b.nome] !== undefined ? _CR_PLANTA[b.nome] : b.nome === 'zona' ? 'Z' : 'T';
      if(!k) return;
      const a = Math.max(0, Math.min(x0 + cw, b.x + b.w) - Math.max(x0, b.x)) * Math.max(0, Math.min(y0 + ch, b.y + b.h) - Math.max(y0, b.y)) / (cw * ch);
      if(a >= melhor){ melhor = a; rot = k; }
    });
    out.push(rot);
  }
  return out.join('');
}
// Distância entre plantas: a fração de células diferentes (0 = o mesmo desenho)
const crDistPlanta = (a, b) => { let d = 0; for(let i = 0; i < a.length; i++) if(a[i] !== b[i]) d++; return d / a.length; };

// Aprende com a escolha: o que a pessoa baixa ou edita ganha peso (neste navegador) — família da
// receita, ou "designer" para as composições da IA. NÃO entra na nota de design (que é pura): só
// desempata a ordem das candidatas, com teto de +5.
const CR_PREF_CHAVE = 'luma_creative_pref';
function _crPref(){ try{ return JSON.parse(localStorage.getItem(CR_PREF_CHAVE) || '{}') || {}; }catch(e){ return {}; } }
function crAprende(r, como){
  const k = r.desenho ? 'designer' : r.receita, p = _crPref();
  p[k] = Math.min(20, (p[k] || 0) + (como === 'editou' ? 1 : 2));
  try{ localStorage.setItem(CR_PREF_CHAVE, JSON.stringify(p)); }catch(e){}
  if(typeof gTrackEvent === 'function') try{ gTrackEvent('creative_escolha', { como, receita: k, ideia: r.desenho ? r.nomeReceita : '', formato: r.spec.formato, objetivo: r.spec.objetivo, marca: r.spec.marca, juiz: r.juiz ? +r.juiz.nota.toFixed(1) : null }); }catch(e){}
}
// A nota de uma diagramação já avaliada: a de design (0 com erro). Guarda o boletim em r.design.
function crNota(r, av){
  const d = crNotaDesign(av.geo || crGeometria(r.svg), { formato: r.spec.formato, objetivo: r.spec.objetivo, fundo: r.fundo, erros: av.erros.length });
  r.design = d;
  return d.total;
}
// Ordem das candidatas: a nota manda; a preferência aprendida só desempata (até +5)
const _crOrdem = r => r.nota + Math.min(5, (_crPref()[r.desenho && !/^editorial/.test(r.receita) ? 'designer' : r.receita] || 0) / 2);

/* ══════════════════════════════════════════════════════════════
   BUSCA DE COMPOSIÇÕES — cada receita é uma gramática com parâmetros: escala do herói (kh), da foto
   (kf) e do texto sem foto (kt), vãos (kv), distribuição do vazio (dist), lado do card e do selo,
   fundo e as variantes que a receita declara (`busca`). Dentro de cada receita que serve àquele
   formato e àquele conteúdo, o motor procura os valores que dão a melhor nota de design: grade
   grossa amostrada com semente determinística (hash do conteúdo + rodada) e refino local,
   coordenada a coordenada. Tudo passa por crAvaliar (sem DOM): a busca nunca devolve arte que viola
   a marca. O ponto "de fábrica" de cada receita (o que o motor antigo faria) entra sempre, então a
   busca só melhora. As 3 finalistas são de famílias diferentes E de assinaturas diferentes, e o DOM
   confere cada uma antes de entrar.
══════════════════════════════════════════════════════════════ */
const CR_BUSCA_ORCAMENTO = 640;       // avaliações por pedido (determinístico; ~0,3 ms cada)
const CR_BUSCA_TETO_MS = 1500;        // segurança em máquina lenta: para e fica com o melhor achado
const CR_EDITORIAL = { id: 'editorial', nome: 'Editorial', editorial: true };
function _crHash(s){ let h = 2166136261; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function _crRng(seed){
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// As receitas que servem a este conteúdo neste formato. Receita de um formato nunca vaza para outro.
function _crReceitasDe(sp){
  const deitado = !!CR_FORMATOS[sp.formato].deitado;
  const ids = deitado ? CR_RECEITAS.filter(x => x.formatos && x.formatos.indexOf(sp.formato) >= 0).map(x => x.id) : (CR_SERVE[sp.objetivo] || []);
  const out = [];
  ids.forEach(id => {
    const rec = CR_RECEITAS.find(x => x.id === id);
    if(!rec || (rec.foto === true && !sp.foto) || (rec.foto === false && sp.foto) || (rec.serve && !rec.serve(sp))
      || (rec.formatos && rec.formatos.indexOf(sp.formato) < 0) || (rec.objetivos && rec.objetivos.indexOf(sp.objetivo) < 0)) return;
    out.push(rec);
  });
  if(['feed', 'story', 'inapp'].indexOf(sp.formato) >= 0) out.push(CR_EDITORIAL);
  return out;
}
// O espaço de busca da receita: contínuos [mín, máx] e discretos [opções]. `busca` na receita
// acrescenta ou troca (ex.: card: ['esq', 'dir']). `padrao` = o ponto de fábrica (o motor antigo).
function _crEspaco(rec, sp){
  const cont = {}, disc = {}, padrao = {};
  if(rec.editorial){ cont.kfoco = [0.9, 1.8]; disc.v = [1, 2, 3]; disc.vmin = [110, 80]; padrao.kfoco = 1.8; padrao.vmin = 0; }
  else if(rec.pilha){
    cont.kh = [0.86, 1.3]; cont.kv = [1, 1.5]; disc.dist = ['centro', 'ancora', 'espalha']; disc.lockup = [false, true];
    padrao.kh = 1; padrao.kv = 1; padrao.dist = 'centro'; padrao.lockup = false;
    if(sp.foto){ cont.kf = [0.8, 1.25]; padrao.kf = 1; } else { cont.kt = [1, 1.5]; padrao.kt = 0; }
  }else if(!rec.comp){ cont.kh = [0.86, 1.2]; padrao.kh = 1; }
  const b = rec.busca || {};
  Object.keys(b).forEach(k => {
    if(b[k].length === 2 && typeof b[k][0] === 'number' && typeof b[k][1] === 'number') cont[k] = b[k];
    else { disc[k] = b[k]; }
    if(padrao[k] == null) padrao[k] = Array.isArray(b[k]) && typeof b[k][0] !== 'number' ? b[k][0] : (b[k][0] + b[k][1]) / 2;
  });
  disc.fundo = sp.marca === 'much' ? ['#F85400'] : (rec.fundos || ['#F85400']);
  return { cont, disc, padrao };
}
// Uma avaliação: monta, confere sem DOM e dá a nota. Arte idêntica (mesmo SVG) é avaliada uma vez só.
function _crAvaliaUma(sp, rec, p, memo){
  let r;
  if(rec.editorial){
    const comp = crEditorial(sp, p.v, p.kfoco || p.vmin ? p : null);
    if(!comp) return null;
    r = crDesenhar(sp, comp, 20 + p.v); r.receita = 'editorial' + p.v;
  }else r = crMontar(sp, rec, p.fundo, p);
  if(!r) return null;
  const k = _crHash(r.svg) + ':' + r.svg.length;
  if(memo.has(k)) return memo.get(k);
  r.avaliacao = crAvaliar(r); r.nota = crNota(r, r.avaliacao); r.params = p; r.familia = rec.id;
  memo.set(k, r);
  return r;
}
// Busca dentro de UMA receita (gerador: cede a vez depois de cada avaliação, para rodar em fatias)
function* _crBuscaReceita(sp, rec, rng, memo, cota){
  const { cont, disc, padrao } = _crEspaco(rec, sp), ck = Object.keys(cont), dk = Object.keys(disc);
  let gastou = 0;
  const ok = r => r && !r.avaliacao.erros.length;
  const avalia = p => { gastou++; return _crAvaliaUma(sp, rec, p, memo); };
  // 1) o ponto de fábrica de cada combinação discreta "de família" (fundo, variante) — garante o piso
  const combos = [{}];
  dk.forEach(k => { const vs = disc[k]; const novos = []; combos.forEach(c => vs.forEach(v => novos.push(Object.assign({}, c, { [k]: v })))); combos.splice(0, combos.length, ...novos); });
  const fabrica = combos.filter(c => dk.every(k => k === 'fundo' || k === 'v' || c[k] === padrao[k])).map(c => {
    const p = Object.assign({}, c); ck.forEach(k => { p[k] = padrao[k]; });
    if(rec.editorial){ delete p.kfoco; delete p.vmin; }
    else if(p.kt === 0) delete p.kt;
    return p;
  });
  const vistos = [];
  for(const p of fabrica){ vistos.push(avalia(p)); yield; }
  // 2) grade grossa: 3 níveis por contínuo × as combinações discretas, amostrada pela semente
  const niv = k => { const [lo, hi] = cont[k]; return [lo, (lo + hi) / 2, hi]; };
  let grade = combos.map(c => Object.assign({}, c));
  ck.forEach(k => { const novos = []; grade.forEach(g => niv(k).forEach(v => novos.push(Object.assign({}, g, { [k]: v })))); grade = novos; });
  for(let i = grade.length - 1; i > 0; i--){ const j = Math.floor(rng() * (i + 1)); const t = grade[i]; grade[i] = grade[j]; grade[j] = t; }
  const nGrade = Math.min(grade.length, Math.max(4, Math.floor(cota * 0.55) - fabrica.length));
  for(let i = 0; i < nGrade; i++){ vistos.push(avalia(grade[i])); yield; }
  // 3) refino local nos melhores (de assinaturas diferentes): passo de 1/4 e depois 1/8 da faixa
  const bons = vistos.filter(ok).sort((u, v) => v.nota - u.nota), sementes = [];
  bons.forEach(r => { if(sementes.length < 3 && sementes.every(s => crDistAssinatura(s.design.sinais, r.design.sinais) > 0)) sementes.push(r); });
  for(const s0 of sementes){
    let cur = s0;
    for(const passo of [0.25, 0.125]){
      for(const k of ck){
        for(const dir of [-1, 1]){
          if(gastou >= cota) return;
          const [lo, hi] = cont[k], base = cur.params[k] == null ? padrao[k] || (lo + hi) / 2 : cur.params[k];
          const v = Math.max(lo, Math.min(hi, Math.round((base + dir * passo * (hi - lo)) * 1000) / 1000));
          if(v === base) continue;
          const r = avalia(Object.assign({}, cur.params, { [k]: v }));
          yield;
          if(ok(r) && r.nota > cur.nota) cur = r;
        }
      }
    }
  }
}
// A busca inteira: as receitas que servem, cada uma com a sua cota. `fora` recebe tudo o que foi avaliado.
function* _crBusca(sp, opts, fora){
  const recs = _crReceitasDe(sp).filter(r => !(opts && opts.receitas) || opts.receitas.indexOf(r.id) >= 0), memo = new Map();
  const rng = _crRng(_crHash(JSON.stringify(sp) + '|' + ((opts && opts.rodada) || 0)));
  const cota = Math.max(10, Math.floor(((opts && opts.avaliacoes) || CR_BUSCA_ORCAMENTO) / Math.max(1, recs.length)));
  for(const rec of recs){
    yield* _crBuscaReceita(sp, rec, rng, memo, cota);
    fora.length = 0; memo.forEach(r => fora.push(r));
  }
  fora.length = 0; memo.forEach(r => fora.push(r));
}
const _crOrdena = l => l.sort((u, v) => _crOrdem(v) - _crOrdem(u) || (u.familia < v.familia ? -1 : u.familia > v.familia ? 1 : 0));
/* Todas as composições avaliadas (síncrono — a suíte e o crCompor usam), melhor primeiro.
   `opts` = { rodada, avaliacoes }. */
function crCandidatos(bruto, opts){
  const sp = crNormaliza(bruto), todas = [], it = _crBusca(sp, opts || {}, todas);
  while(!it.next().done);
  return _crOrdena(todas);
}
/* A mesma busca em fatias de ~10 ms (nunca congela a tela): devolve { cands, avaliacoes, ms }. */
function crBuscar(bruto, opts){
  const o = opts || {}, sp = crNormaliza(bruto), todas = [], it = _crBusca(sp, o, todas), t0 = performance.now();
  let n = 0;
  const canal = typeof MessageChannel === 'function' ? new MessageChannel() : null;
  return new Promise(ok => {
    const fim = () => ok({ cands: _crOrdena(todas.slice()), avaliacoes: n, ms: Math.round(performance.now() - t0) });
    const fatia = () => {
      const ini = performance.now();
      while(performance.now() - ini < 10){
        if(it.next().done) return fim();
        n++;
        if(o.parar && o.parar()) return fim();
        if(performance.now() - t0 > (o.teto || CR_BUSCA_TETO_MS)){ it.return(); return fim(); }
      }
      if(canal) canal.port2.postMessage(0); else setTimeout(fatia, 0);
    };
    if(canal) canal.port1.onmessage = fatia;
    fatia();
  });
}
// A conferência pelo DOM (verificação final), uma vez por candidata
const _crDomOk = c => (c._domOk != null ? c._domOk : (c._domOk = !crAvaliarDom(c).erros.length));
// As 3 finalistas: aprovadas, de famílias diferentes e com assinaturas de design diferentes (≥ 2
// sinais de distância; relaxa para 1 e depois para 0 só se faltar opção). `evitar` = famílias ou
// assinaturas já mostradas ("Outras opções"). O DOM confere cada uma antes de entrar.
// Quantas opções a entrega mostra (decisão do Ryan, 15/10: 2, desenhadas ao mesmo tempo). O motor segue
// escolhendo 3 (crEscolher3) — a curadoria e a bancada votam e medem as 3; a entrega mostra as primeiras.
const CR_OPCOES = 2;
function crEscolher3(cands, evitar){
  const ok = _crOrdena(cands.filter(c => !c.avaliacao.erros.length)), fora = new Set(evitar || []), out = [];
  const ass = c => (c.design && c.design.sinais) || { txt: '' };
  // respeita: 2 = nem família nem assinatura já mostradas; 1 = família pode voltar, assinatura nunca
  // ("Outras opções" não repete planta: se não houver 3 novas, mostra menos)
  const passos = [[2, 2], [1, 2], [2, 1], [1, 1], [0, 1]];
  for(const [dmin, respeita] of passos){
    for(const c of ok){
      if(out.length >= 3) break;
      if(out.indexOf(c) >= 0 || out.some(o => o.receita === c.receita && o.fundo === c.fundo)) continue;
      if(dmin && out.some(o => o.receita === c.receita)) continue;
      if((respeita >= 2 && fora.has(c.receita)) || fora.has(ass(c).txt)) continue;
      if(out.some(o => crDistAssinatura(ass(o), ass(c)) < dmin)) continue;
      if(!_crDomOk(c)) continue;
      out.push(c);
    }
  }
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
  if(sp.topo && (sp.objetivo === 'aniversario' || sp.objetivo === 'oferta' || sp.objetivo === 'parceiro' || sp.objetivo === 'aviso' || sp.objetivo === 'prospeccao' || sp.objetivo === 'evento')) b.tag = sp.topo;
  if(sp.horario) b.horario = sp.horario;
  if(sp.loja && crNormalizaTexto(sp.loja) !== crNormalizaTexto(tit)) b.loja = sp.loja;
  if(sp.chamada.length && (sp.objetivo === 'cupom' || sp.objetivo === 'aniversario')) b.chamada = sp.chamada.join(' / ');
  if(sp.apoio) b.apoio = sp.apoio;
  if(sp.precoPor) b.preco = (sp.precoDe ? 'DE R$ ' + sp.precoDe + ' ' : '') + 'POR R$ ' + sp.precoPor;
  if(sp.cupomValor && (sp.objetivo === 'cupom' || sp.objetivo === 'aniversario')) b.valor = (/%$/.test(sp.cupomValor) ? sp.cupomValor : 'R$ ' + sp.cupomValor) + ' OFF';
  if(sp.cupomCodigo && (sp.objetivo === 'cupom' || sp.objetivo === 'aniversario')) b.cupom = sp.cupomRotulo + ' ' + sp.cupomCodigo;
  if(sp.selo.length && sp.objetivo !== 'cupom') b.selo = sp.selo.join(' ');
  if(sp.cta) b.cta = sp.cta;
  if(sp.legal) b.legal = sp.legal;
  if(sp.foto) b.foto = sp.foto === 'slot' ? 'ESPAÇO da foto (placeholder cinza que o franqueado preenche): dê a ele tamanho de foto de verdade' : 'foto enviada pela pessoa';
  if(sp.itens.length && (sp.formato === 'carrossel' || sp.formato === 'slide' || sp.listar)) b.itens = sp.itens.join(' / ');
  return b;
}
const crNormalizaTexto = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
// Quebra equilibrada em n linhas (minimiza a linha mais larga)
function _crLinhas(txt, cls, n){
  const p = _crPalavras(txt);
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
    let s = Math.floor(Math.min(max, h / (0.73 + (l.length - 1) * 0.94), w * 100 / Math.max(...l.map(x => crMede(x, 'hero', 100)))));
    const ht = _crAlt(l, s).h; if(ht > h) s = Math.floor(s * h / ht);   // acento e Ç contam na altura
    if(!best || s > best.size * 1.04) best = { linhas: l, size: s };
  }
  return best;
}
// Tom de uma área da arte: no fundo escuro (laranja, solar, vermelho, rosa) o texto é branco; no
// claro (placa branca, faixa amarela) o herói e o preço vão em laranja e o texto miúdo em grafite.
const _CR_ESCURO = { [CR_C.laranja]: 1, [CR_C.solar]: 1, [CR_C.vermelho]: 1, [CR_C.rosa]: 1 };
const _CR_ZONA_COR = { branco: CR_C.branco, amarelo: CR_C.amarelo, laranja: CR_C.laranja, solar: CR_C.solar, vermelho: CR_C.vermelho };
function _crTom(cor, fundoArte){
  const c = String(cor || '').toUpperCase(), esc = !!_CR_ESCURO[c];
  return { escuro: esc, cor: c, heroi: esc ? CR_C.branco : CR_C.laranja, texto: esc ? CR_C.branco : CR_C.grafite, logo: esc ? 'dm-h-branca' : 'dm-h-laranja',
    botao: esc ? (c === CR_C.solar || fundoArte === CR_C.solar ? 'laranja' : 'cheio') : 'laranja', tagFundo: esc ? CR_C.branco : CR_C.laranja, tagTexto: esc ? CR_C.laranja : CR_C.branco,
    seloFundo: c === CR_C.amarelo ? CR_C.laranja : CR_C.amarelo, seloTexto: c === CR_C.amarelo ? CR_C.branco : CR_C.grafite };
}
// Linha de lista: "Burger clássico R$ 24,90" → { nome, preco: '24,90' }
const _crItemPreco = t => { const m = /^(.*?)\s*(?:[-–:]\s*)?R\$\s*(\d+(?:[.,]\d{1,2})?)\s*$/i.exec(String(t || '')); return m ? { nome: m[1].trim(), preco: _crReal(m[2].replace('.', ',')) } : { nome: String(t || ''), preco: '' }; };
// Slot do logo da loja (contrato: g#logo_loja vira moldura no Estúdio): círculo branco + aviso
function crLogoLoja(x, y, d){
  const r = d / 2, cx = x + r, cy = y + r;
  return '<g id="logo_loja"><rect x="' + _r(x) + '" y="' + _r(y) + '" width="' + _r(d) + '" height="' + _r(d) + '" rx="' + _r(r) + '" fill="' + CR_C.branco + '" filter="url(#shs)"/>'
    + (d >= 160 ? '<text x="' + _r(cx) + '" y="' + _r(cy + 10) + '" text-anchor="middle" class="body" font-size="' + _r(Math.max(24, d * 0.09)) + '" fill="' + CR_C.grafite + '">Logo da loja</text>' : '') + '</g>';
}
// Lista de itens, em 4 estilos: 'cards' (os do carrossel), 'precos' (cards brancos com nome + preço),
// 'ranking' (números grandes + nome, sem card) e 'linhas' (nome + preço com fio entre as linhas)
function crLista(x, y, w, h, itens, estilo, tom, est, piso){
  if(estilo === 'cards' || !estilo) return crItens(x, y, w, h, itens, est);
  const n = itens.length, gap = estilo === 'linhas' ? 0 : 24, ch = Math.min(estilo === 'ranking' ? 190 : 230, (h - gap * (n - 1)) / n);
  return itens.map((t, i) => {
    const it = _crItemPreco(t), yy = y + i * (ch + gap);
    if(estilo === 'ranking'){
      const zn = Math.min(150, ch * 0.9), xn = x + crMede('0', 'hero', zn) * 1.15 + 24, z = crCabe(it.nome, 'forte', Math.min(52, ch * 0.36), w - (xn - x), piso, est);
      return crTexto(x, yy + ch / 2 + zn * 0.36, 'hero', zn, tom.escuro ? CR_C.amarelo : CR_C.laranja, String(i + 1)) + crTexto(xn, yy + ch / 2 + z * 0.36, 'forte', z, tom.texto, it.nome, ' data-larg="' + _r(w - (xn - x)) + '"');
    }
    if(estilo === 'linhas'){
      const wp = it.preco ? crPrecoMede(it.preco, w * 0.42, Math.min(96, ch * 0.62)) : null, z = crCabe(it.nome, 'forte', Math.min(46, ch * 0.34), w - (wp ? wp.w + 40 : 0), piso, est);
      return (i ? '<line x1="' + _r(x) + '" y1="' + _r(yy) + '" x2="' + _r(x + w) + '" y2="' + _r(yy) + '" stroke="' + tom.texto + '" stroke-width="2" opacity="0.5"/>' : '')
        + crTexto(x, yy + ch / 2 + z * 0.36, 'forte', z, tom.texto, it.nome) + (wp ? crPreco(x + w - wp.w, yy + ch / 2 + wp.big * 0.36, it.preco, w * 0.42, tom.heroi, wp.big).replace(' data-campo="precoPor"', '') : '');
    }
    // 'precos': card branco, número à esquerda, nome, preço à direita em laranja
    const pad = Math.min(44, ch * 0.25), wp = it.preco ? crPrecoMede(it.preco, w * 0.36, Math.min(100, ch * 0.55)) : null;
    const zn = Math.min(96, ch * 0.55), xn = x + pad + crMede(String(i + 1), 'hero', zn) + 24, ln = w - (xn - x) - pad - (wp ? wp.w + 24 : 0), z = crCabe(it.nome, 'forte', Math.min(60, ch * 0.3), ln, piso, est);
    return '<rect x="' + _r(x) + '" y="' + _r(yy) + '" width="' + _r(w) + '" height="' + _r(ch) + '" rx="32" fill="' + CR_C.branco + '" filter="url(#shs)"/>'
      + crTexto(x + pad, yy + ch / 2 + zn * 0.36, 'hero', zn, CR_C.laranja, String(i + 1)) + crTexto(xn, yy + ch / 2 + z * 0.36, 'forte', z, CR_C.grafite, it.nome, ' data-larg="' + _r(ln) + '"')
      + (wp ? crPreco(x + w - pad - wp.w, yy + ch / 2 + wp.big * 0.36, it.preco, w * 0.36, CR_C.laranja, wp.big).replace(' data-campo="precoPor"', '') : '');
  }).join('');
}
function crDesenhar(sp, comp, i){
  const a = crArea(sp.formato); a.p = {};
  const est = [], faltas = [], W = a.W, H = a.H;
  const fundo = sp.marca !== 'much' && comp.fundo === '#FF9000' ? '#FF9000' : '#F85400';
  const tem = crConteudoBlocos(sp), n = v => Math.round(+v || 0);
  const campo = sp.objetivo === 'oferta' ? 'produto' : 'titulo';
  const pecas = [], decor = [], vistos = new Set();
  // Zonas: placas e faixas de cor por trás dos blocos (não são blocos: podem sangrar). O tom de cada
  // bloco sai da zona debaixo do centro dele — texto nunca fica branco numa placa branca.
  const zonas = (Array.isArray(comp.zonas) ? comp.zonas : []).map(z => Object.assign({}, z, { cor: _CR_ZONA_COR[z.cor] || String(z.cor || CR_C.branco).toUpperCase() }));
  const zonaSvg = zonas.map(z => '<rect data-zona="1" x="' + n(z.x) + '" y="' + n(z.y) + '" width="' + n(z.w) + '" height="' + n(z.h) + '" rx="' + n(z.rx) + '" fill="' + z.cor + '"'
    + (z.rot ? ' transform="rotate(' + z.rot + ' ' + _r(z.x + z.w / 2) + ' ' + _r(z.y + z.h / 2) + ')"' : '') + (z.sombra ? ' filter="url(#sh)"' : '') + '/>').join('\n');
  const tomEm = (cx, cy) => { let c = fundo; zonas.forEach(z => { if(cx >= z.x && cx <= z.x + z.w && cy >= z.y && cy <= z.y + z.h) c = z.cor; }); return _crTom(c, fundo); };
  (Array.isArray(comp.grafismos) ? comp.grafismos : []).slice(0, 5).forEach(g => {
    const d = _crDoInv(g && g.asset, sp) && CR_DECOR[g.asset]; if(!d) return;
    const w = Math.max(20, Math.min(d.max, n(g.w) || d.w)), h = Math.round(w * d.h / d.w), x = n(g.x), y = n(g.y), rot = Math.max(-45, Math.min(45, n(g.rot)));
    decor.push(crBloco('decor', '<image href="asset:inv/' + g.asset + '.png" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"'
      + (rot ? ' transform="rotate(' + rot + ' ' + _r(x + w / 2) + ' ' + _r(y + h / 2) + ')"' : '') + '/>'));
  });
  // blocos que não são conteúdo, só moldura da composição (slot do logo da loja, mockup do inventário)
  const EXTRA = { logoLoja: 1, mockup: 1 };
  (Array.isArray(comp.blocos) ? comp.blocos : []).forEach(b => {
    const t = b && b.bloco;
    if((!tem[t] && !EXTRA[t]) || vistos.has(t)) return;
    vistos.add(t);
    const x = n(b.x), y = n(b.y), w = Math.max(40, n(b.w)), h = Math.max(20, n(b.h));
    const al = b.alinhar === 'centro' || b.alinhar === 'dir' ? b.alinhar : 'esq';
    const ax = al === 'centro' ? x + w / 2 : al === 'dir' ? x + w : x, anc = al === 'centro' ? ' text-anchor="middle"' : al === 'dir' ? ' text-anchor="end"' : '';
    const lg = ' data-larg="' + w + '"', tom = b.tom ? _crTom(_CR_ZONA_COR[b.tom] || b.tom, fundo) : tomEm(x + w / 2, y + h / 2);
    const gira = s => b.rot ? '<g transform="rotate(' + n(b.rot) + ' ' + _r(x + w / 2) + ' ' + _r(y + h / 2) + ')">' + s + '</g>' : s;
    if(t === 'logo'){
      const lw = Math.min(b.max || 300, w, h * 4.97), lh = lw / 4.97, lx = al === 'centro' ? x + (w - lw) / 2 : al === 'dir' ? x + w - lw : x;
      pecas.push(crBloco('logo', '<image href="asset:logos/' + tom.logo + '.png" x="' + _r(lx) + '" y="' + y + '" width="' + _r(lw) + '" height="' + _r(lh) + '"/>'));
    }else if(t === 'titulo'){
      // a composição pode pedir o lockup (corpo máximo, linhas, igualar larguras) e o adesivo (contorno + giro)
      const fill = b.contorno ? CR_C.laranja : (b.cor || tom.heroi), cont = b.contorno ? ' stroke="' + CR_C.branco + '" stroke-width="' + _r((b.max || 120) * 0.22) + '" stroke-linejoin="round" paint-order="stroke fill"' : '';
      if(b.max){
        const q = crLockup(tem.titulo, { larg: w, alt: h, max: b.max, min: a.heroiMin, linhas: b.linhas || 3, iguala: !!b.iguala, varia: b.varia || 1.35 });
        if(q.zMin < a.heroiMin) est.push(tem.titulo);
        const zs = q.zs.some(z => z !== q.zs[0]) ? q.zs : null, y0 = y + Math.max(0, (b.valinhar === 'base' ? h - q.h : b.valinhar === 'centro' ? (h - q.h) / 2 : 0));
        pecas.push(crBloco('titulo', gira('<g id="produto">' + crHeroi(ax, q.ys.map(v => y0 + v), q.size, fill, q.linhas, anc + cont + ' data-campo="' + campo + '"', zs) + '</g>')));
      }else{
        const q = _crHeroiCaixa(tem.titulo, w, h, a.deitado ? a.heroiMax : 560);
        if(q.size < a.heroiMin) est.push(tem.titulo);
        pecas.push(crBloco('titulo', gira('<g id="produto">' + crHeroi(ax, q.linhas.map((l, k) => y + _crAlt(q.linhas, q.size).ys[k]), q.size, fill, q.linhas, anc + cont + ' data-campo="' + campo + '"') + '</g>')));
      }
    }else if(t === 'tag'){
      const z = b.max || 40, tw = Math.max(b.max ? 0 : 330, _r(crMede(sp.topo, 'hero', z) + z * 1.6)), th = _r(z * 1.75), tx = al === 'centro' ? x + (w - tw) / 2 : al === 'dir' ? x + w - tw : x;
      pecas.push(crBloco('tag', gira('<rect x="' + _r(tx) + '" y="' + y + '" width="' + tw + '" height="' + th + '" rx="' + _r(th / 2) + '" fill="' + tom.tagFundo + '"/>' + crTexto(tx + tw / 2, y + th / 2 + z * 0.36, 'hero', z, tom.tagTexto, sp.topo, ' text-anchor="middle"'))));
    }else if(t === 'apoio'){
      // 1 linha no corpo que a caixa pede; 2 linhas sem órfã quando ficam ≥ 10% maiores E cabem na caixa
      const z0 = crCabe(sp.apoio, 'body', Math.min(b.max || 56, h / 0.92), w, 0), z1 = Math.max(z0, a.piso), q2 = crTextoLinhas(sp.apoio, 'body', Math.min(b.max || 48, h / 2.17), w, Math.max(28, a.piso), null);
      const q = q2.linhas.length > 1 && q2.z > z1 * 1.1 && q2.h <= h + 6 ? q2 : { linhas: [sp.apoio], z: z1, ys: _crAlt([sp.apoio], z1, 'body').ys };
      if(q !== q2 && z0 < a.piso) est.push(sp.apoio);
      pecas.push(crBloco('apoio', crTextoMulti(ax, y, 'body', q, b.cor || tom.texto, anc + lg)));
    }else if(t === 'chamada'){
      const ls = sp.chamada, zc = Math.floor(Math.min(b.max || 84, h / (0.95 + (ls.length - 1) * 1.3), ...ls.map(l => w * 80 / Math.max(1, crMedeMista(l, 80)))));
      if(zc < a.piso) est.push(ls.join(' '));
      pecas.push(crBloco('chamada', ls.map((l, k) => crMista(ax, y + zc * 0.75 + k * zc * 1.3, zc, tom.texto, l, al === 'centro' ? 'middle' : al === 'dir' ? 'end' : '')).join('')));
    }else if(t === 'preco'){
      // placa branca (b.placa): o preço vira o card da marca — POR em grafite, número em laranja
      const placa = b.placa === 'branco', pad = placa ? 44 : 0, iw = w - 2 * pad, de = sp.precoDe ? 61 : 0;
      const pm = crPrecoMede(sp.precoPor, iw, Math.min(b.max || 280, (h - 2 * pad - de - 44) / 0.73));
      const ti = placa ? _crTom(CR_C.branco) : tom, x0 = al === 'centro' ? x + (w - pm.w) / 2 : al === 'dir' ? x + w - pad - pm.w : x + pad, top = y + pad + de + 44;
      const hx = al === 'centro' ? x + w / 2 : al === 'dir' ? x + w - pad : x + pad;
      let s = placa ? '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + _r(2 * pad + de + 44 + pm.big * 0.73 + 8) + '" rx="40" fill="' + CR_C.branco + '" filter="url(#sh)"/>' : '';
      s += '<g id="preco">';
      if(sp.precoDe) s += crTexto(hx, y + pad + 29, 'body', 40, ti.texto, 'DE R$ ' + sp.precoDe, ' text-decoration="line-through" data-campo="precoDe"' + anc);
      const pre = b.prefixo != null ? b.prefixo : 'POR';
      s += (pre ? crTexto(x0 + 2, top - 18, 'sup', 36, ti.texto, pre) : '') + crPreco(x0, top + pm.big * 0.73, sp.precoPor, iw, placa ? CR_C.laranja : tom.heroi, pm.big) + '</g>';
      // b.sobre: o card de preço pode prender na borda da foto (a lista fechada da §2.2)
      pecas.push(crBloco('preco', gira(b.sobre ? '<g data-sobrepoe="foto">' + s + '</g>' : s)));
    }else if(t === 'valor'){
      // receita C: R$ a 36% alinhado ao topo · número · coluna OFF / NO SEU / PEDIDO na linha de base
      const pct = /%$/.test(sp.cupomValor), num = sp.cupomValor, cv = tom.heroi;
      let zn = Math.min(b.max || 560, h / 0.73);
      const larg = z => (pct ? 0 : crMede('R$', 'hero', z * 0.36) + z * 0.06) + crMede(num, 'hero', z) + z * 0.1 + Math.max(crMede('OFF', 'forte', z * 0.417), crMede('PEDIDO', 'forte', z * 0.156));
      if(larg(zn) > w) zn = Math.floor(zn * w / larg(zn));
      const B = y + zn * 0.73, tw = larg(zn), x0 = al === 'centro' ? x + (w - tw) / 2 : al === 'dir' ? x + w - tw : x;
      const xn = x0 + (pct ? 0 : crMede('R$', 'hero', zn * 0.36) + zn * 0.06), xo = xn + crMede(num, 'hero', zn) + zn * 0.1;
      pecas.push(crBloco('valor', '<g id="produto">' + (pct ? '' : crTexto(x0, B - zn * 0.458, 'hero', zn * 0.36, cv, 'R$'))
        + crTexto(xn, B, 'hero', zn, cv, num, ' data-campo="desconto_valor"') + crTexto(xo, B - zn * 0.422, 'forte', zn * 0.417, cv, 'OFF')
        + crTexto(xo, B - zn * 0.18, 'forte', zn * 0.156, cv, 'NO SEU') + crTexto(xo, B, 'forte', zn * 0.156, cv, 'PEDIDO') + '</g>'));
    }else if(t === 'cupom'){
      const k = Math.min(b.max || 1.1, w / 880, h / 324), tx = al === 'centro' ? x + (w - 880 * k) / 2 : al === 'dir' ? x + w - 880 * k : x, cx = tx + 222 * k, cl = 568 * k;
      pecas.push(crBloco('cupom', gira(crTicket(tx, y, k) + '<g id="detalhes">' + crTexto(cx, y + 82 * k, 'sup', Math.max(a.piso, 34 * k), '#434343', sp.cupomRotulo)
        + crTexto(cx, y + 194 * k, 'hero', crCabe(sp.cupomCodigo, 'hero', 116 * k, cl, 48, est), '#F85400', sp.cupomCodigo, ' data-campo="codigo_cupom" data-larg="' + _r(cl) + '"')
        + '<line x1="' + _r(cx) + '" y1="' + _r(y + 222 * k) + '" x2="' + _r(cx + cl) + '" y2="' + _r(y + 222 * k) + '" stroke="#FFB900" stroke-width="3" stroke-linecap="round"/></g>')));
    }else if(t === 'selo'){
      const l = sp.selo.slice(0, 2);
      if(b.estilo === 'data'){
        // data tipográfica: o número em Realce gigante e o mês em Roboto Black embaixo (sem círculo)
        const z1 = crCabe(l[0], 'hero', Math.min(b.max || 300, h * 0.62 / 0.73), w, 0), z2 = l[1] ? crCabe(l[1], 'forte', Math.max(a.piso, Math.min(z1 * 0.32, 90)), w, a.piso, est) : 0;
        const B1 = y + z1 * 0.73, B2 = B1 + (z2 ? z2 * 1.15 : 0);
        pecas.push(crBloco('selo', crTexto(ax, B1, 'hero', z1, b.cor || tom.heroi, l[0], anc) + (z2 ? crTexto(ax, B2, 'forte', z2, tom.texto, l[1], anc) : '')));
      }else{
        const r = Math.max(70, Math.min(b.max || 170, Math.min(w, h) / 2)), cx = al === 'centro' ? x + w / 2 : al === 'dir' ? x + w - r : x + r;
        pecas.push(crBloco('selo', crSelo(cx, y + h / 2, r, l, tom.seloFundo, tom.seloTexto)));
      }
    }else if(t === 'horario'){
      const q = crLockup(sp.horario, { larg: w, alt: h, max: b.max || 160, min: a.heroiMin * 0.7, linhas: 2 });
      pecas.push(crBloco('horario', crHeroi(ax, q.ys.map(v => y + v), q.size, b.cor || tom.heroi, q.linhas, anc + ' data-campo="horario"')));
    }else if(t === 'loja'){
      const z = crCabe(sp.loja, 'forte', Math.min(b.max || 64, h / 0.75), w, a.piso, est);
      pecas.push(crBloco('loja', crTexto(ax, y + z * 0.74, 'forte', z, tom.texto, sp.loja, anc + ' data-campo="loja"')));
    }else if(t === 'cta'){
      if(a.fmt === 'inapp') return;                    // o botão do inapp é o largo da base (crMontar)
      const est2 = b.estilo === 'contorno' && tom.escuro ? 'contorno' : tom.botao;
      pecas.push(crBloco('botao', crBotao(ax, y, sp.cta, est2, al === 'centro' ? 'centro' : al === 'dir' ? 'dir' : '').svg));
    }else if(t === 'legal'){
      const pl = Math.max(22, a.piso), z0 = crCabe(sp.legal, 'legal', 28, w, 0), z1 = Math.max(z0, pl), q2 = crTextoLinhas(sp.legal, 'legal', 28, w, pl, null);
      const q = q2.linhas.length > 1 && q2.z > z1 * 1.08 && q2.h <= h + 6 ? q2 : { linhas: [sp.legal], z: z1, ys: _crAlt([sp.legal], z1, 'legal').ys };
      if(q !== q2 && z0 < pl) est.push(sp.legal);
      pecas.push(crBloco('legal', crTextoMulti(ax, y, 'legal', q, tom.texto, anc)));
    }else if(t === 'itens'){
      // b.placa: a lista mora num card branco que é do bloco (move junto no editor), 40 px de respiro em volta
      const pc = b.placa ? _CR_ZONA_COR[b.placa] || CR_C.branco : '', pl = pc ? '<rect x="' + (x - 40) + '" y="' + (y - 40) + '" width="' + (w + 80) + '" height="' + (h + 80) + '" rx="40" fill="' + pc + '" filter="url(#sh)"/>' : '';
      pecas.push(crBloco('itens', pl + crLista(x, y, w, h, sp.itens, b.estilo, pc ? _crTom(pc) : tom, est, a.piso)));
    }else if(t === 'foto'){
      const sangra = x <= 0 || y <= 0 || x + w >= W || y + h >= H;
      pecas.unshift(crBloco('foto', crFoto(x, y, w, h, b.rx != null ? b.rx : sangra ? 0 : 56, '', sp.foto)));
    }else if(t === 'logoLoja'){
      const d = Math.min(w, h), lx = al === 'centro' ? x + (w - d) / 2 : al === 'dir' ? x + w - d : x;
      pecas.push(crBloco('logoLoja', crLogoLoja(lx, y, d)));
    }else if(t === 'mockup'){
      const id = b.asset || 'celular-app', dd = _crDoInv(id, sp) && CR_DECOR[id];
      if(!dd) return;
      const mw = Math.min(w, h * dd.w / dd.h, dd.max), mh = mw * dd.h / dd.w, mx = al === 'centro' ? x + (w - mw) / 2 : al === 'dir' ? x + w - mw : x;
      pecas.push(crBloco('mockup', gira('<image href="asset:inv/' + id + '.png" x="' + _r(mx) + '" y="' + _r(y) + '" width="' + _r(mw) + '" height="' + _r(mh) + '"/>')));
    }
  });
  // todo bloco com conteúdo tem de entrar (o logo e a foto também)
  // (no inapp o botão é o largo do formato; no banner do app a peça inteira é o toque; capa de pasta e cabeçalho de email não têm botão)
  // (o banner mora na home do próprio app: como nas receitas de banner, o logo não é obrigatório)
  Object.keys(tem).forEach(k => { if(!vistos.has(k) && !(k === 'cta' && ['inapp', 'banner', 'capa', 'emailTopo'].indexOf(a.fmt) >= 0) && !(k === 'logo' && a.fmt === 'banner')) faltas.push(k); });
  if(a.fmt === 'inapp') pecas.push(crBotaoLargo(sp, fundo));
  let svg = '<svg xmlns="http://www.w3.org/2000/svg" data-luma="1" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">'
    + crDefs() + (a.card ? '<rect data-fundo="1" x="' + a.card[0] + '" y="' + a.card[1] + '" width="' + a.card[2] + '" height="' + a.card[3] + '" rx="' + a.card[4] + '" fill="' + fundo + '"/>'
      : '<rect data-fundo="1" width="' + W + '" height="' + H + '" fill="' + fundo + '"/>') + '\n' + (zonaSvg ? zonaSvg + '\n' : '') + decor.concat(pecas).join('\n') + '\n</svg>';
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
  const j = (typeof gAiParseJson === 'function') ? gAiParseJson(await _crAsk('arte.compor', crPromptDesenho(sp, lista.length, [], consertar, { regua: regua.length, ref: 0 }), { json: true, cache: false, parts })) : null;
  const comps = j && Array.isArray(j.composicoes) ? j.composicoes : [];
  return lista.map((x, i) => {
    if(!comps[i]) return x.r;
    const novo = crDesenhar(sp, comps[i], 10 + i); novo.avaliacao = crAvaliar(novo);
    if(novo.avaliacao.erros.length) return x.r;
    novo.nota = crNota(novo, novo.avaliacao); novo.refeito = x.critica; crMetricas.refeitas++;
    return novo;
  });
}
// Por que a IA não entregou: o motor segue, mas a tela diz o motivo (conta própria mostra o erro do provedor) em vez de fingir que "não há IA"
function _crPorqueSemIA(pedidas0, o){
  if(pedidas0 != null && crMetricas.pedidas > pedidas0) return 'a IA respondeu, mas nenhuma composição passou nas regras da marca — sigo com o motor';
  const why = crState.provRun && typeof gProvUltimoErro === 'string' && gProvUltimoErro ? gProvUltimoErro : (_crIaPronta() ? 'a IA devolveu uma resposta que não consegui ler' : 'sem IA conectada');
  return why + (o === 'revisar' ? ' — ordem pela nota do motor' : ' — sigo com o motor');
}
// A IA compõe n opções; as que reprovam voltam 1 vez com os erros. → [r aprovadas, com nota]
// Métricas do designer (por sessão, e no gTrackEvent): quantas pedidas, aprovadas de 1ª, salvas na correção, refeitas pelo juiz
const crMetricas = { pedidas: 0, primeira: 0, corrigidas: 0, refeitas: 0 };
async function crDesenhos(sp, n, evitar, refPessoa){
  if(CR_FORMATOS[sp.formato].fixo || typeof gAskAI !== 'function' || !_crIaPronta()) return [];
  // O designer VÊ: a régua do formato (linguagem, escala, acabamento) e a referência que a pessoa mandou
  const regua = await crRegua(sp).catch(() => []), m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(refPessoa || ''), ref = m ? [m[2]] : [];
  const parts = regua.map(d => ({ mimeType: 'image/jpeg', data: d })).concat(m ? [{ mimeType: m[1], data: m[2] }] : []);
  const pede = async (qtd, consertar) => {
    let txt = await _crAsk('arte.compor', crPromptDesenho(sp, qtd, evitar, consertar, { regua: regua.length, ref: ref.length }), { json: true, cache: false, parts });
    // Modelo/provedor que não lê imagem (ou recusou o anexo): refaz uma vez só com o texto, em vez de largar a IA
    if(txt == null && parts.length) txt = await _crAsk('arte.compor', crPromptDesenho(sp, qtd, evitar, consertar, { regua: 0, ref: 0 }), { json: true, cache: false, parts: [] });
    const j = (typeof gAiParseJson === 'function') ? gAiParseJson(txt) : null;
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
function crEditorial(sp, v, p){
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
  // apoio e letra miúda com a altura de verdade (1 ou 2 linhas, crTextoLinhas)
  const hApoio = tem.apoio ? Math.ceil(crTextoLinhas(sp.apoio, 'body', 44, L, 32).h) + 4 : 0, hLegal = tem.legal ? Math.ceil(crTextoLinhas(sp.legal, 'legal', 28, L, 24).h) + 4 : 0;
  if(tem.apoio && focal !== 'titulo') intro.push(box('apoio', L, hApoio));
  if(intro.length) G.push(intro);
  // o ponto focal, em escala dramática (encolhe se faltar altura)
  const focalBox = k => {
    if(focal === 'preco'){ const big = Math.round((a.story ? 280 : 230) * k), w = tem.selo ? L - 320 : L; return [box('preco', w, Math.ceil((sp.precoDe ? 61 : 0) + 44 + 0.73 * big), dir ? { x: M + L - w, alinhar: 'dir' } : null)].concat(tem.selo ? [box('selo', 290, 290, { x: dir ? M : M + L - 290, lado: true })] : []); }
    if(focal === 'valor') return [box('valor', L, Math.ceil(0.73 * Math.round((a.story ? 440 : 360) * k)), dir ? { alinhar: 'dir' } : null)];
    const tb = [box('titulo', L, hTit(tem.titulo, L, Math.round((a.story ? 230 : 190) * k)), dir ? { alinhar: 'dir' } : null)];
    return tem.apoio ? tb.concat([box('apoio', L, hApoio, dir ? { alinhar: 'dir' } : null)]) : tb;
  };
  const sup = [];
  if(tem.valor && focal !== 'valor') sup.push(box('valor', L, Math.ceil(0.73 * (a.story ? 220 : 180))));
  if(tem.cupom) sup.push(box('cupom', 880, 324));
  if(tem.selo && focal !== 'preco') sup.push(box('selo', 300, 300, { x: dir ? M : M + L - 300 }));
  if(tem.foto) sup.push(box('foto', L, 0, { flex: true }));
  const acao = [];
  if(tem.cta && a.fmt !== 'inapp') acao.push(box('cta', 360, 96));
  if(tem.legal) acao.push(box('legal', L, hLegal));
  // ordem dos grupos por variação; mede e distribui pela faixa inteira
  // o foco cresce até encher a faixa (com no mínimo 110 de respiro entre grupos); o que sobrar vira respiro
  // tenta com 110 de respiro entre grupos; se o conteúdo não couber, aceita 80 (piso da §4.2)
  // a busca pode limitar a escala do foco (p.kfoco) e escolher o respiro mínimo entre grupos (p.vmin)
  const ks = [1.8, 1.6, 1.45, 1.3, 1.15, 1, 0.9, 0.8, 0.7, 0.62].filter(k => !p || !p.kfoco || k <= p.kfoco + 1e-9);
  for(const vmin of (p && p.vmin ? [p.vmin] : [110, 80])) for(const k of ks){
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
  if(!tres.length || typeof gAskAI !== 'function' || !_crIaPronta()) return null;
  const sp = tres[0].spec, refs = await crRegua(sp);
  const ops = await Promise.all(tres.map(crArteJpeg));
  const parts = refs.concat(ops).map(d => ({ mimeType: 'image/jpeg', data: d }));
  const j = (typeof gAiParseJson === 'function') ? gAiParseJson(await _crAsk('arte.criticar', crPromptJuiz(sp, refs.length, tres.length), { json: true, cache: false, parts })) : null;
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
// Palavras que o franqueado digita sem acento → como vão na arte (palavra inteira; "esta", "pais" e "e" ficam
// de fora: são ambíguas)
const CR_ACENTO = { gastronomico: 'gastronômico', gastronomica: 'gastronômica', gastronomicos: 'gastronômicos', musica: 'música', musicas: 'músicas',
  cafe: 'café', acai: 'açaí', pao: 'pão', paes: 'pães', feijao: 'feijão', promocao: 'promoção', promocoes: 'promoções', cardapio: 'cardápio',
  inauguracao: 'inauguração', joao: 'joão', sao: 'são', maes: 'mães', mae: 'mãe', aniversario: 'aniversário', almoco: 'almoço', lancamento: 'lançamento',
  hamburguer: 'hambúrguer', hamburgueres: 'hambúrgueres', refeicao: 'refeição', sabado: 'sábado', pascoa: 'páscoa', exposicao: 'exposição',
  atracao: 'atração', atracoes: 'atrações', horario: 'horário', horarios: 'horários', voce: 'você', voces: 'vocês', ja: 'já', tambem: 'também',
  ate: 'até', amanha: 'amanhã', ferias: 'férias', ultima: 'última', ultimo: 'último', ultimos: 'últimos', ultimas: 'últimas', unico: 'único',
  unica: 'única', proximo: 'próximo', proxima: 'próxima', mes: 'mês', nao: 'não', sera: 'será', tera: 'terá', ze: 'zé', praca: 'praça',
  comemoracao: 'comemoração', degustacao: 'degustação', edicao: 'edição', programacao: 'programação', culinaria: 'culinária', familia: 'família',
  crianca: 'criança', criancas: 'crianças', reveillon: 'réveillon', arraia: 'arraiá', quentao: 'quentão', porcao: 'porção', porcoes: 'porções',
  gratis: 'grátis', servico: 'serviço', atencao: 'atenção', regiao: 'região', delicia: 'delícia', delicias: 'delícias', tematico: 'temático',
  tematica: 'temática', agua: 'água', japones: 'japonês', frances: 'francês', acougue: 'açougue', so: 'só', ta: 'tá', to: 'tô', vespera: 'véspera' };
function _crAcentua(s){
  return String(s || '').replace(/[A-Za-zÀ-ÿ]+/g, w => {
    const r = CR_ACENTO[w.toLowerCase()];
    if(!r) return w;
    return w.length > 1 && w === w.toUpperCase() ? r.toUpperCase() : w[0] === w[0].toUpperCase() ? r[0].toUpperCase() + r.slice(1) : r;
  });
}
// INTENÇÃO — o pedido é a FALA da pessoa ("vai ter um evento… e preciso de um post pra avisar"), não o texto da
// arte. A moldura da conversa sai (pedir a peça, "pra avisar", "vai ter", "na minha cidade", "a gente") e fica o
// ASSUNTO, com o que a moldura dizia: futuro ("vai ter" → "VEM AÍ") e cidade. Os números continuam sendo lidos do
// texto inteiro — a moldura nunca tem dado.
const _CR_PEDE = '(?:(?:eu|a gente|nos)\\s+)?(?:(?:to|tou|estou|ta|esta)\\s+)?(?:preciso|precisando|precisava|quero|queria|gostaria|faz|faca|fazer|cria|crie|criar|monta|monte|manda|mande|gera|gere|gerar|me\\s+(?:ajuda|ve|faz|manda|arruma)|ajuda|bora|vamos|pode|podia|consegue|da\\s+pra|tem\\s+como|elabora)';
const _CR_PECA = '(?:post(?:zinho|agem)?|arte(?:zinha)?|story|stories|storie|banner|imagem|card|flyer|panfleto|criativo|anuncio|propaganda|divulgacao|publicacao|material)';
const _CR_PRA = '(?:avisar|avisando|divulgar|divulgando|anunciar|anunciando|chamar|chamando|lembrar|lembrando|comunicar|falar|mostrar|postar|convidar|convidando|informar|informando|promover|celebrar|comemorar|homenagear)';
const _CR_GENTE = '(?:\\s+(?:a galera|o pessoal|os clientes|o povo|todo mundo|geral|a cidade))?';
const _CR_LIGA = '(?:\\s+(?:que|sobre|do|da|dos|das|de|o|a|os|as|pro|pra|para|com|em|no|na))*';
const CR_MOLDURA = [
  // "preciso de um post pra avisar", "faz uma arte de", ", me ajuda com uma arte"
  new RegExp('(?:^|[,.;!?]\\s*|\\s+e\\s+)' + _CR_PEDE + '\\b[^,.;!?]{0,40}?\\b' + _CR_PECA + '\\b(?:\\s+(?:bonit[ao]|legal|caprichad[ao]|simples|rapid[ao]))?'
    + '(?:\\s+(?:no|na|pro|pra|para o|para a)\\s+(?:meu\\s+|minha\\s+)?(?:feed|story|stories|insta(?:gram)?|whats(?:app)?|face(?:book)?|status|perfil))?'
    + '(?:\\s+(?:pra|para|p\\/))?(?:\\s+' + _CR_PRA + ')?' + _CR_GENTE + _CR_LIGA + '(?=\\s|$)', 'g'),
  // "arte pra divulgar o show", "post pro dia das mães" — a peça no começo, sem verbo
  new RegExp('^(?:um|uma)?\\s*' + _CR_PECA + '\\b(?:\\s+(?:bonit[ao]|legal|caprichad[ao]))?(?:\\s+(?:pra|para|p\\/))?(?:\\s+' + _CR_PRA + ')?' + _CR_GENTE + _CR_LIGA + '(?=\\s|$|:)'),
  // "quero avisar que", "preciso divulgar"
  new RegExp('(?:^|[,.;!?]\\s*|\\s+e\\s+)(?:(?:eu|a gente)\\s+)?(?:preciso|quero|queria|gostaria|vamos|bora|me\\s+ajuda\\s+a|ajuda\\s+a)\\s+(?:de\\s+)?' + _CR_PRA + _CR_GENTE + _CR_LIGA + '(?=\\s|$)', 'g'),
  // ", avisa a galera"
  /[,.;!?]?\s*(?:avisa|avise|chama|chame|divulga|divulgue|conta|fala)\s+(?:(?:pra|para)\s+)?(?:a galera|o pessoal|os clientes|o povo|todo mundo|geral)\b.*$/
];
const CR_FUTURO = /^(?:(?:a gente|nos)\s+)?(?:vai ter|vai rolar|vai acontecer|teremos|vamos ter|tera|havera|esta chegando|ta chegando|chegando|vem ai|ja ja tem)\s+(?:(?:um|uma|o|a|os|as|nosso|nossa)\s+)?/;
const CR_EXISTE = /^(?:tem|temos|ta tendo|esta tendo|rola|acontece)\s+(?:(?:um|uma|o|a|os|as)\s+)?/;
const CR_LUGAR = /\s+(?:aqui\s+)?(?:na|em)\s+(?:minha|nossa|sua)\s+cidade\b|\s+aqui\s+na\s+cidade\b|\s+(?:aqui|na cidade)(?=\s*$)/g;
const CR_ARTIGO = /^(?:o|a|os|as|um|uma|nosso|nossa|nossos|nossas|meu|minha|meus|minhas)\s+/;
function _crIntencao(texto){
  let t = String(texto || '').replace(/\s+/g, ' ').trim();
  const sem = x => x.split('').map(c => c.normalize('NFD')[0] || c).join('').toLowerCase();   // 1:1 com o original: o corte vale nos dois
  const tira = re => {
    const n = sem(t); let r = '', i = 0, achou = false;
    n.replace(re, (m, ...a) => { const k = a[a.length - 2]; if(m.length){ r += t.slice(i, k) + ' '; i = k + m.length; achou = true; } return m; });
    if(achou) t = (r + t.slice(i)).replace(/\s+/g, ' ').replace(/^[\s,;:.!?–—-]+|[\s,;:–—-]+$/g, '').trim();
    return achou;
  };
  const fala = CR_MOLDURA.map(tira).some(Boolean);
  const futuro = tira(CR_FUTURO);
  if(!futuro) tira(CR_EXISTE);
  const cidade = tira(CR_LUGAR);
  tira(CR_ARTIGO);
  return { assunto: _crAcentua(t), fala, futuro, cidade };
}
// Nome digitado todo em minúscula vira nome próprio ("pizzaria do joão" → "Pizzaria do João")
const _crNomeProprio = x => x === x.toLowerCase() ? x.replace(/[^\s]+/g, (w, i) => i && /^(de|do|da|dos|das|e)$/.test(w) ? w : w.charAt(0).toLocaleUpperCase('pt-BR') + w.slice(1)) : x;
const _crInicial = x => x ? x.charAt(0).toLocaleUpperCase('pt-BR') + x.slice(1) : '';
// Corta a fala em título + resto: o título é a 1ª oração; o resto ("por causa do feriado", "as entregas podem
// atrasar") vira o apoio. " e " só corta quando abre outra oração ("e as entregas…"), nunca "sábado e domingo".
function _crOracao(x){
  const m = /\s+(?=(?:por causa|porque|pois|que)\s)|\s+e\s+(?=(?:o|a|os|as|a gente|nos|vamos|estamos|tem|vai|v[aã]o|pode|podem|ganhe|aproveite|pe[çc]a)\s)|\s*[.!?;—–]\s*/i.exec(x);
  if(!m) return [x.trim(), ''];
  return [x.slice(0, m.index).trim(), x.slice(m.index + m[0].length).replace(/^e\s+/i, '').trim()];
}
const CR_EVENTO_NOME = /\b(festival|feira|festa|semana|show|rod[ií]zio|evento|encontro|exposi[çc][ãa]o|mostra|circuito|rota|noite|quermesse|arrai[áa]|concurso|corrida|campeonato|torneio)(\s+(?!(?:d[aeo]s?|n[aeo]s?|em|dia|pra|para|com|que|e|hoje|amanh[ãa]|s[áa]bado|domingo|nesse|neste|dessa|desse|aqui|l[áa])\b)[a-zà-ú]{3,})?(\s+d[aeo]s?\s+(?!\d)(?!dia\b)[a-zà-ú][a-zà-ú-]*)?/i;
const CR_DATA_COMEMORATIVA = /\bdia\s+d(?:as?|os?|e)\s+[a-zà-ú]+|\bnatal\b|\bp[áa]scoa\b|\bcarnaval\b|\br[ée]veillon\b|\bano novo\b|\bblack friday\b|\bhalloween\b|\bs[ãa]o jo[ãa]o\b/i;
const CR_MESES = 'janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro';
// Evento ligado ao app (comida, pedido) tem botão; evento da cidade (show, feira, data) não pede ação no app
const CR_DO_APP = /\b(app|pedir|pede|peca|pedido|delivery|entrega|pizza|hamburguer|burger|lanche|acai|sushi|doce|sobremesa|rodizio|happy|chopp|cerveja|combo|prato|marmita|porcao|pastel|sorvete|bebida|drink|janta|almoco|padaria|pizzaria|restaurante)/;
// Apoio de evento pelo assunto (copy, nunca dado)
const CR_APOIO_EVENTO = [
  [/gastronom|culinari|comida|sabor|food|degusta/, 'Os sabores da cidade num só lugar'], [/show|musica|banda|cantor|sertanej|pagode|samba|rock|forro/, 'Música boa pra curtir'],
  [/feira|artesanat|exposic|mostra/, 'Programa bom pra toda a família'], [/junin|arrai|quermesse|sao joao/, 'Comida típica e muita festa'],
  [/maes|pais|namorad|criancas|natal|pascoa|ano novo|reveillon/, 'Celebre com quem você ama'], [/corrida|maratona|campeonato|torneio|\bjogo\b|copa/, 'Bora torcer junto']
];
function crLerPedido(texto, fmt){
  const t = String(texto || ''), norm = x => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''), n = norm(t);
  // a leitura da intenção: o assunto (sem a moldura da conversa) decide o objetivo e o título
  const it = _crIntencao(t), a = it.assunto || t, na = norm(a);
  const sp = { formato: _crFormatoDito(t) || fmt || 'feed', marca: _crMarcaDita(t) ? 'much' : 'dm' };
  sp.objetivo = /anivers/.test(na) && !/cidade/.test(na) ? 'aniversario'
    : /seja (parceiro|entregador)|entregador|baix[ae]r? o app|baixe|pec[ao] no app|obrigad|agradec|cadastre sua loja|vender (no|pelo|com o) app|(restaurantes?|lojas?|lojistas|estabelecimentos) pra vender/.test(na) ? 'prospeccao'
    : /\baviso|feriado|horario (especial|de|do)|pausa|estamos entregando|entregando normal|fechad|comunicado|nao (vai|vamos|vou|vai mais) abrir|sem expediente|atras(o|ar|ad[ao]s?)\b|demor/.test(na) ? 'aviso'
    : /novo parceiro|lojista|inaugur|mais vendid|mais pedid|chegou no app|loja da semana|varias lojas|das lojas|entrou (no|pro|para o) app|(agora|ja) (esta|ta) no app/.test(na) ? 'parceiro'
    : /cupom|codigo/.test(na) ? 'cupom'
    : /(entrega|frete)\s+gratis|gratis|cashback/.test(na) ? 'beneficio'
    : /evento|festival|feira|festa|show|semana d|rodizio|chuv|chove|domingo|madrugada|fim de semana|dia d[ao]s|natal|pascoa|carnaval|reveillon|junin|arrai|quermesse|exposic|encontro|\bjogo\b|copa|cidade/.test(na) ? 'evento' : 'oferta';
  // preço: "R$ 22,90", "15 reais" e "por 39,90" (número com centavos depois de por/de/só — numa lista de itens, não)
  const reais = [...t.matchAll(/R\$\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*(?:reais|real|conto|pila)\b|\b(?:por|de|s[óo]|apenas|a partir de|valor|pre[çc]o)\s+(\d{1,4},\d{2})(?![\d%])/gi)].map(m => (m[1] || m[2] || m[3]).replace('.', ','))
    .filter((v, i, l) => l.indexOf(v) === i);
  const fmtR = v => /,/.test(v) ? v.replace(/,(\d)$/, ',$10') : v + ',00';
  const minimo = /(?:m[ií]nimo|acima)\s+(?:de\s+)?R\$\s*(\d+)/i.exec(t);
  const semMin = reais.filter(v => !minimo || v.split(',')[0] !== minimo[1]);
  const pct = /(\d{1,2})\s*%/.exec(t);
  const codigo = (t.match(/\b(?=[A-Z0-9]*[A-Z])[A-Z0-9]{5,14}\b/g) || []).find(c => !/^(OFERTA|CUPOM|STORY|FEED)$/.test(c))
    || ((/\bc[óo]digo\s+([a-z0-9]{4,14})\b/i.exec(t) || [])[1] || '').toUpperCase();
  const anos = /(\d{1,2})\s*anos?\b/i.exec(t);
  if(minimo) sp.legal = 'Válido para pedidos acima de R$ ' + minimo[1] + '. Consulte as regras no app.';
  if(sp.objetivo === 'oferta'){
    if(semMin.length >= 2){ const v = semMin.slice(0, 2).sort((x, y) => parseFloat(y.replace(',', '.')) - parseFloat(x.replace(',', '.'))); sp.precoDe = fmtR(v[0]); sp.precoPor = fmtR(v[1]); }
    else if(semMin.length) sp.precoPor = fmtR(semMin[0]);
    if(pct) sp.selo = [pct[1] + '%', 'OFF'];
    // o nome do produto, sem as palavras do formato ("banner do app", "cabeçalho de email"…) nem o "R" de "R$"
    const FMT = 'arte|post|feed|story|stories|banner|super ?banner|in-?app|pop-?up|cabe[çc]alho|rodap[ée]|e-?mail|capa|pasta|deskfy|slide|apresenta[çc][ãa]o|app';
    // "Story: pizza…" — o formato no começo sai junto com os dois-pontos
    let limpo = a.replace(new RegExp('^((' + FMT + ')(?=[\\s:]|$)[:\\s]*((de|do|da|para|no|na)\\s+)?)+', 'i'), '');
    // "prato do dia", "oferta do dia"… é a tag do alto (o que o pedido disse), não parte do nome
    const tagDia = /\b(prato|oferta|promo(?:ção|cao)?|almo[çc]o|sugest[ãa]o) do dia\b/i.exec(limpo);
    if(tagDia){ sp.topo = sp.topo || tagDia[0].toLocaleUpperCase('pt-BR'); limpo = limpo.replace(tagDia[0], ' ').replace(/^[\s:]+/, ''); }
    const prod = /(?:oferta|promo(?:ção|cao)?|arte|post)?\s*(?:de|do|da)?\s*([^:,.\d$]{3,40})/i.exec(limpo);
    // "de/do/da/por" só saem das pontas: "pizza de calabresa" fica inteira
    if(prod) sp.titulo = prod[1].split(/\s+(?:para|pra|pro|no|na|neste|nesse|nessa|hoje|amanh[ãa]|esse|este|essa|desta|dessa|com|s[óo])\b/i)[0]
      .replace(new RegExp('(^|\\s)(oferta|promo(ção|cao)?|' + FMT + ')(?=\\s|$)', 'gi'), ' ').replace(/\s+R$/i, '')
      .replace(/^\s*((de|do|da|por)\s+)+/i, '').replace(/(\s+(de|do|da|por))+\s*$/i, '').replace(/\s{2,}/g, ' ').trim();
    // "açaí 2 por 1" — a mecânica colada no nome é parte dele ("chopp 2x1" depois de "Happy hour:" não é)
    const dobro = sp.titulo && new RegExp('(?:^|\\s)' + sp.titulo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+(\\d\\s*(?:por|x)\\s*\\d)\\b', 'i').exec(limpo);
    if(dobro && sp.titulo.length <= 16) sp.titulo += ' ' + dobro[1].toLocaleUpperCase('pt-BR');
    // "… com chopp em dobro", "… com sobremesa": o que a pessoa disse do produto vira o apoio
    const com = /\bcom\s+([^,.;:\d$]{3,30}?)(?=\s+(?:das?|de|por|até|a partir|hoje|s[óo])\b|[,.;:]|\s*$|\s+\d)/i.exec(limpo);
    if(com && !sp.apoio && limpo.indexOf(':') < 0) sp.apoio = _crInicial('com ' + com[1].trim());
    if(/\bso hoje\b/.test(na)) sp.topo = sp.topo || 'SÓ HOJE';
  }
  if(sp.objetivo === 'cupom' || sp.objetivo === 'aniversario'){
    if(pct) sp.cupomValor = pct[1] + '%'; else if(semMin.length) sp.cupomValor = semMin[0].split(',')[0];
    if(codigo) sp.cupomCodigo = codigo;
  }
  if(anos && sp.objetivo === 'aniversario') sp.anos = anos[1];
  // Lista no pedido (linhas, "•", "-" ou ";") vira os itens da lâmina do meio do carrossel
  const itens = (t.indexOf(':') > 0 ? t.slice(t.indexOf(':') + 1) : t).split(/\n|;|•|\s-\s/).map(x => x.replace(/^[\s\-–*\d.)]+/, '').trim()).filter(x => x.length > 2 && x.length <= 60);
  if(itens.length >= 2) sp.itens = itens.slice(0, 4);
  if(sp.objetivo === 'beneficio' && /frete/.test(na)) sp.palavra = 'frete';
  // Horário que o pedido deu ("das 11h às 22h") — vira o bloco de horário, nunca é inventado
  const hr = /(\d{1,2})\s*h(\d{2})?\s*(?:às|as|até|ate|a|-)\s*(\d{1,2})\s*h(\d{2})?/i.exec(t);
  if(hr) sp.horario = hr[1] + 'H' + (hr[2] || '') + ' ÀS ' + hr[3] + 'H' + (hr[4] || '');
  // "Rótulo: o resto" — nos usos de texto (aviso, parceiro, prospecção, evento) o rótulo é o herói
  const dois = a.indexOf(':') > 0 ? [a.slice(0, a.indexOf(':')).trim(), a.slice(a.indexOf(':') + 1).trim()] : null;
  const FMTW = /^(story|stories|feed|post|arte|banner|inapp|pop-?up|capa|slide|carross?el|e-?mail|cabe[çc]alho)$/i;
  const generico = dois && /^(aviso|agradecimento|comunicado|recado|novidade)$/i.test(dois[0]);
  const rotulo = dois && !FMTW.test(dois[0]) && !generico ? dois[0] : '';
  const resto = dois && !generico && !FMTW.test(dois[0]) ? dois[1] : '';
  const evNome = sp.objetivo === 'evento' ? CR_EVENTO_NOME.exec(a) || CR_DATA_COMEMORATIVA.exec(a) : null;
  if(sp.objetivo === 'aviso' || sp.objetivo === 'prospeccao' || (sp.objetivo === 'evento' && !rotulo && !evNome) || (sp.objetivo === 'evento' && rotulo)){
    const [cab, cauda] = _crOracao(dois && generico ? dois[1] : rotulo || a);
    sp.titulo = cab.replace(/[,.]\s*$/, '');
    const extra = resto || cauda;
    if(extra && !/R\$/.test(extra)) sp.apoio = _crInicial(extra.replace(/[.,]\s*$/, ''));
  }
  if(sp.objetivo === 'prospeccao' && !/^(seja|baix|venha|vem|cadastr|trabalh|fa[cç]a|pe[cç]a|obrigad|valeu)/.test(norm(sp.titulo || ''))){
    // "chamar entregador", "restaurantes pra vender no app": a chamada da prospecção é um convite
    const conv = /entregador|motoboy/.test(na) ? ['SEJA ENTREGADOR', 'Faça parte do nosso time'] : /parceiro|loja|restaurante|vender|estabelecimento|lojista/.test(na) ? ['SEJA PARCEIRO', 'Venda mais pelo app da cidade'] : /baix|instal/.test(na) ? ['BAIXE O APP', ''] : null;
    if(conv){ sp.titulo = conv[0]; if(conv[1] && !sp.apoio) sp.apoio = conv[1]; }
  }
  if(sp.objetivo === 'parceiro'){
    const rot = dois ? dois[0] : '';
    if(/parceiro|lojista|inaugur|destaque|semana/i.test(rot)) sp.topo = rot.replace(/:$/, '');
    if(dois && /mais vendid|mais pedid|ofertas/i.test(rot)){ sp.titulo = rot; }
    else {
      const base = dois ? dois[1] : a.replace(/^.*?\b(inaugura[çc][ãa]o|novo parceiro)\s+(d[aoe]s?\s+)?/i, '');
      const loja = base.split(/,|\s+(?:chegou|entrou|já|agora|no app|na cidade|dia|t[áa] no|est[áa] no)\b/i)[0].replace(/^(d[aoe]s?|[ao]s?)\s+/i, '').trim();
      if(loja && loja.length <= 28){ sp.loja = _crNomeProprio(loja); sp.titulo = sp.loja; }
      if(/inaugur/i.test(t)) sp.topo = 'INAUGURAÇÃO';
      else if(!sp.topo && /chegou|entrou|novo/.test(na)) sp.topo = 'NOVO PARCEIRO';
    }
    if(dois && /mais vendid|mais pedid|ofertas/i.test(rot)) sp.itens = dois[1].split(/,|;|\n|\s+e\s+/).map(x => x.trim()).filter(x => x.length > 2).slice(0, 4);
  }
  if(sp.objetivo === 'evento' || sp.objetivo === 'aviso' || sp.objetivo === 'parceiro'){
    const data = new RegExp('(\\d{1,2})\\s*(?:a|até)\\s*(\\d{1,2})\\s*de\\s*(' + CR_MESES + ')', 'i').exec(t), d1 = new RegExp('\\b(?:dia\\s+)?(\\d{1,2})\\s+de\\s+(' + CR_MESES + ')', 'i').exec(t);
    if(data) sp.selo = [data[1] + ' A ' + data[2], data[3]];
    else if(d1) sp.selo = [d1[1], d1[2]];
  }
  if(sp.objetivo === 'evento'){
    if(evNome && !rotulo){
      sp.titulo = evNome[0].trim();
      // o que vem depois do nome é dado da pessoa (lugar, dia): vira o apoio, sem a data (que já está no selo)
      const depois = a.slice(evNome.index + evNome[0].length).replace(new RegExp('\\s*(?:dia\\s+|de\\s+)?\\d{1,2}(?:\\s*(?:a|até|e)\\s*\\d{1,2})?\\s*(?:de\\s+)?(?:' + CR_MESES + ')\\b', 'gi'), ' ')
        .replace(/^[\s,;:–—-]*(?:(?:de|do|da|dia)\s+)*/i, '').replace(/[\s,;:.–—-]+$/, '').replace(/\s{2,}/g, ' ');
      if(depois.length >= 4 && depois.length <= 38 && !/\d/.test(depois)) sp.apoio = _crInicial(depois);
    }
    if(it.futuro && !sp.topo) sp.topo = 'VEM AÍ';
    const app = CR_DO_APP.test(na);
    if(!sp.apoio){ const ap = CR_APOIO_EVENTO.find(([re]) => re.test(na)); sp.apoio = ap ? ap[1] : app ? '' : 'Programa certo na cidade'; }
    if(!app) sp.semCta = true;   // evento da cidade não pede ação no app: sem botão
  }
  if(sp.objetivo === 'prospeccao') sp.cta = /entregador|motoboy/i.test(na) ? 'CADASTRAR' : /parceiro|loja|restaurante|vender|lojista/i.test(na) ? 'QUERO VENDER' : /baix/i.test(na) ? 'BAIXAR' : '';
  if(sp.titulo) sp.titulo = _crAcentua(sp.titulo);
  sp.resumo = 'Entendi: ' + CR_OBJETIVOS[sp.objetivo].toLowerCase() + (sp.titulo ? ' — "' + sp.titulo.toLocaleLowerCase('pt-BR') + '"' : '') + (sp.selo && sp.selo.length ? ', ' + sp.selo.join(' ').toLocaleLowerCase('pt-BR') : '') + '.';
  return sp;
}

/* ══════════════════════════════════════════════════════════════
   BRIEFING — antes de compor, pergunta só o que muda a arte (como o Claude Code faz)
══════════════════════════════════════════════════════════════ */
const CR_COM_FOTO = { oferta: true, evento: true, beneficio: true, parceiro: true };
// Como a trava de dado conta o que tirou
const CR_CAMPO_DITO = { precoDe: 'preço', precoPor: 'preço', cupomValor: 'desconto', cupomCodigo: 'código', anos: 'anos', horario: 'horário', selo: 'data/selo', titulo: 'título', apoio: 'apoio', topo: 'tag', legal: 'letra miúda', cta: 'botão', palavra: 'palavra', chamada: 'chamada', itens: 'itens' };
const _crReal = v => /,/.test(v) ? v.replace(/,(\d)$/, ',$10') : v + ',00';
const _crAspas = s => String(s || '').replace(/"""/g, '"');

// O formato é sempre perguntado pelo Luma (opções = o cadastro CR_FORMATOS), salvo se o pedido já diz
function _crPerguntaFormato(fio){
  if(_crFormatoDito(fio.pedido) || fio.fmtMenu) return null;   // formato dito no texto OU já escolhido no menu: não pergunta de novo
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
  const tm = crTema(fio.pedido);
  if(c === 'aviso' && !sp.horario && (tm.indexOf('horario') >= 0 || tm.indexOf('feriado') >= 0)) q.push({ titulo: 'Horário', pergunta: 'Qual o horário de funcionamento?', campo: 'horario', dica: 'Ex.: das 11h às 22h', opcoes: [{ rotulo: 'Sem horário na arte', valor: '' }] });
  if(c === 'aviso' && !(sp.selo && sp.selo.length) && tm.indexOf('feriado') >= 0) q.push({ titulo: 'Data', pergunta: 'Qual a data do feriado?', campo: 'data', dica: 'Ex.: 15 de novembro', opcoes: [{ rotulo: 'Sem data na arte', valor: '' }] });
  if(c === 'parceiro' && !sp.loja && !(sp.itens && sp.itens.length)) q.push({ titulo: 'Loja', pergunta: 'Qual o nome da loja parceira?', campo: 'loja', dica: 'Ex.: Pizzaria Nonna', opcoes: [{ rotulo: 'Deixar para o franqueado preencher', valor: '' }] });
  return { resumo: sp.resumo, objetivo: c, perguntas: q.slice(0, 3) };
}
function crPromptBriefing(fio){
  return [
    'Você é o diretor de arte da Delivery Much (app de delivery de cidades do interior do Brasil). A gestão pediu uma arte (post, inapp, banner do app, email, capa ou slide).',
    'ANTES de compor, faça o briefing: entenda o pedido e pergunte SÓ o que muda a arte e o pedido não responde.',
    '', 'PEDIDO: """' + _crAspas(fio.pedido).slice(0, 1200) + '"""',
    'FORMATO MARCADO NA TELA: ' + fio.fmt + '. FOTO ENVIADA: ' + (fio.foto ? 'sim' : 'não') + '.',
    '', 'OBJETIVOS: oferta (produto + preço), cupom (valor + código), evento (data especial na cidade), beneficio (benefício curto, ex. entrega grátis), aniversario (anos da franquia + presente), aviso (horário especial, feriado, pausa, "estamos entregando"), parceiro (loja nova, lojista da semana, mais vendidos, inauguração), prospeccao (seja parceiro, seja entregador, baixe o app, agradecimento).',
    '', 'REGRAS DAS PERGUNTAS:',
    '- No máximo 3. Se o pedido já basta, "perguntas": [].',
    '- Bons alvos: dado que vai impresso na arte e faltou (preço, valor e código do cupom, data do evento, anos da franquia, pedido mínimo, horário do aviso, nome da loja parceira), o foco da peça, o tom da chamada.',
    '- NUNCA pergunte o que o pedido já diz. NUNCA pergunte de cor, fonte ou layout (é regra da marca). NÃO pergunte de foto nem de formato (o Luma pergunta à parte).',
    '- titulo: até 12 caracteres ("Preço", "Formato"). pergunta: frase curta terminada em "?". opcoes: 2 a 4 respostas prováveis e curtas (até 40 caracteres); a pessoa também pode digitar outra.',
    '- NUNCA invente dado como opção (preço, código, data): para esses, ofereça só saídas como "Sem preço na arte" ou "Deixar para o franqueado preencher" — a pessoa digita o valor.',
    '- resumo: 1 frase do que você entendeu (tipo de arte, ponto focal, ação).',
    '', 'Responda SÓ o JSON:',
    '{"resumo":"","objetivo":"oferta|cupom|evento|beneficio|aniversario|aviso|parceiro|prospeccao","perguntas":[{"titulo":"","pergunta":"","opcoes":["",""]}]}'
  ].join('\n');
}
async function crPedirBriefing(fio){
  if(typeof gAskAI !== 'function' || !_crIaPronta()) return null;
  const j = (typeof gAiParseJson === 'function') ? gAiParseJson(await _crAsk('arte.compor', crPromptBriefing(fio), { json: true, cache: false })) : null;
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
      pergunta: br.objetivo === 'evento' ? 'Tem uma foto do local ou do evento?' : br.objetivo === 'parceiro' ? 'Tem uma foto da loja ou de um prato dela?' : 'Tem a foto do produto?',
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
    else if(r.campo === 'horario'){ const m = /(\d{1,2})\s*h?(\d{2})?\s*(?:às|as|até|ate|a|-)\s*(\d{1,2})\s*h?(\d{2})?/i.exec(v); o.horario = m ? m[1] + 'H' + (m[2] || '') + ' ÀS ' + m[3] + 'H' + (m[4] || '') : ''; }
    else if(r.campo === 'loja'){ o.loja = v.slice(0, 28); if(v && (!o.titulo || /NOVIDADE NO APP/i.test(o.titulo))) o.titulo = v; }
    else if(r.campo === 'data'){
      const d = /(\d{1,2})\s*(?:a|até)\s*(\d{1,2})\s*de\s*([a-zç]+)/i.exec(v), d1 = /(\d{1,2})\s*de\s*([a-zç]+)/i.exec(v);
      o.selo = d ? [d[1] + ' A ' + d[2], d[3]] : d1 ? [d1[1], d1[2]] : v ? v.split(/\s+/).slice(0, 2) : [];
    }
  });
  return o;
}
// TRAVA DE DADO — preço, desconto, código, anos, horário, data, dia da semana e "só hoje" só vão na arte se a
// pessoa disse (no pedido ou no briefing). Vale para a copy da IA (que pode inventar ou copiar o exemplo do prompt)
// e para a leitura local. % calculado de DE/POR que a pessoa deu é conta, não invenção. → { sp, tirou: [campos] }
function crSoDado(sp, fonte){
  const o = Object.assign({}, sp), tirou = [];
  const norm = v => String(v == null ? '' : v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const f = norm(fonte), nums = new Set();
  (f.match(/\d+(?:[.,]\d+)?/g) || []).forEach(x => { const v = x.replace('.', ','); nums.add(v); nums.add(v.split(',')[0]); if(/,\d$/.test(v)) nums.add(v + '0'); });
  const temNum = v => { const x = String(v).replace('.', ','); if(nums.has(x)) return true; const [i, c] = x.split(','); return nums.has(i) && (!c || /^0+$/.test(c)); };
  const numsDe = v => String(v == null ? '' : v).match(/\d+(?:[.,]\d+)?/g) || [];
  const DITO = /\b(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|segunda|terca|quarta|quinta|sexta|sabado|domingo|hoje|amanha|ultim[oa]s?|fim de semana)\b/g;
  const ok = v => numsDe(v).every(temNum) && (norm(v).match(DITO) || []).every(m => f.indexOf(m) >= 0);
  const limpa = (k, vazio) => { tirou.push(k); o[k] = vazio; };
  ['precoDe', 'precoPor', 'cupomValor', 'anos'].forEach(k => { if(o[k] && !numsDe(o[k]).every(temNum)) limpa(k, ''); });
  if(o.cupomCodigo && f.indexOf(norm(o.cupomCodigo)) < 0) limpa('cupomCodigo', '');
  if(o.horario && !ok(o.horario)) limpa('horario', '');
  const de = parseFloat(String(o.precoDe || '').replace(',', '.')), por = parseFloat(String(o.precoPor || '').replace(',', '.')), conta = de > por && por > 0 ? Math.round((de - por) / de * 100) : NaN;
  if(Array.isArray(o.selo) && o.selo.length && !o.selo.every(x => ok(x) || (/%/.test(x) && Math.abs(parseInt(x, 10) - conta) <= 1) || /^off$/i.test(x))) limpa('selo', []);
  ['titulo', 'apoio', 'topo', 'legal', 'cta', 'palavra'].forEach(k => { if(o[k] && !ok(o[k])) limpa(k, ''); });
  if(Array.isArray(o.chamada) && o.chamada.some(x => !ok(x))) limpa('chamada', []);
  if(Array.isArray(o.itens) && o.itens.some(x => !ok(x))){ o.itens = o.itens.filter(ok); tirou.push('itens'); }
  return { sp: o, tirou };
}
// A IA às vezes devolve a própria fala como título ("VAI TER UM EVENTO GASTRONOMICO"): isso não é manchete
function _crPareceFala(tit, pedido){
  const norm = v => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  const x = norm(tit);
  return !!x && (/\b(preciso|quero|queria|post|arte|story|faz|fazer|vai ter|minha|nossa cidade|pra avisar|pra divulgar|me ajuda)\b/.test(x) || (x.split(' ').length >= 4 && norm(pedido).indexOf(x) >= 0));
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
    'Você NÃO desenha nem escolhe layout: entende a mensagem e escreve a copy. O motor do Luma diagrama com os blocos oficiais e mostra ' + CR_OPCOES + ' opções.',
    '', 'PEDIDO: """' + _crAspas(fio.pedido).slice(0, 1200) + '"""',
    br ? 'BRIEFING (respostas da pessoa — valem mais que o pedido):\n' + _crAspas(br).slice(0, 800) : '',
    'FORMATO: ' + (CR_FORMATOS[fio.fmt] || CR_FORMATOS.feed).nome + ' (' + (CR_FORMATOS[fio.fmt] || CR_FORMATOS.feed).desc + ')'
      + (CR_FORMATOS[fio.fmt] && CR_FORMATOS[fio.fmt].deitado ? ' — peça deitada e pequena: titulo de até 3 palavras, apoio curto ou vazio, sem legal.' : '') + '. ' + (fio.foto === 'slot' ? 'Vai ter foto (o espaço fica reservado para o franqueado).' : fio.foto ? 'Há foto do produto/local.' : 'Sem foto: a arte é só tipografia — a copy precisa segurar a peça sozinha.'),
    '', 'OBJETIVOS (escolha 1 em "objetivo"): oferta (produto com preço), cupom (valor + código), evento (data especial, festival, data comemorativa), beneficio (benefício curto: entrega grátis, frete, cashback), aniversario (anos da franquia), aviso (horário especial, feriado, pausa, estamos entregando), parceiro (loja nova, lojista da semana, mais vendidos, inauguração), prospeccao (seja parceiro, seja entregador, baixe o app, peça no app, agradecimento).',
    '', 'LEIA A INTENÇÃO: o PEDIDO é a fala da pessoa, não o texto da arte. Separe a conversa ("preciso de um post", "faz uma arte", "pra avisar", "vai ter", "na minha cidade", "a gente") do que a peça precisa comunicar, e escreva a copy de quem entendeu o recado. NUNCA use a frase do pedido como título: escreva uma manchete. Acento certo mesmo se o pedido veio sem.',
    'Exemplos de leitura (o raciocínio, não as palavras):',
    '- "vai ter um evento gastronomico na minha cidade e preciso de um post pra avisar" → evento; topo "VEM AÍ"; titulo "EVENTO GASTRONÔMICO"; apoio sobre o que o evento oferece; selo [] (a data não foi dita); cta "" (o evento não acontece no app).',
    '- "a pizzaria do joão entrou no app, faz um post" → parceiro; topo "NOVO PARCEIRO"; titulo e loja "Pizzaria do João"; cta "PEDIR AGORA".',
    '- "quero avisar que amanhã não vamos abrir por causa do feriado" → aviso; titulo "AMANHÃ NÃO ABRIMOS"; apoio "Por causa do feriado"; cta "".',
    '', 'REGRAS DA COPY (skill luma-creative):',
    '- PT-BR, tom próximo e direto da Delivery Much. Sem emoji, sem hashtag, sem aspas.',
    '- NUNCA invente preço, desconto, código, data ou número de anos que o pedido e o briefing não deram: campo sem informação = "".',
    '- titulo: a manchete, até 4 palavras e 22 caracteres, sem ponto final (oferta = nome do produto; evento = nome do evento ou da data; aviso = o recado; beneficio = a palavra vazada, ex. "GRÁTIS"). Ordem que quebra bem em 2 linhas por sentido.',
    '- palavra: só no beneficio, 1 palavra minúscula (ex. "entrega").',
    '- chamada (cupom/aniversário): 2 linhas curtas (até 22 caracteres), frase leve com 1 palavra forte entre *asteriscos*: "pega este *cupom*", "pra você *economizar!*".',
    '- apoio: 1 frase de até 38 caracteres, em caixa normal.',
    '- selo: 1 ou 2 palavras curtas, SÓ com o que o pedido ou o briefing disseram (desconto, data, "só hoje"); [] se não disseram. Formato, não conteúdo: ["<N>%","OFF"], ["<DIA> A <DIA>","<MÊS>"]. O % do selo bate com (DE − POR) ÷ DE.',
    '- cta: imperativo curto em maiúsculas, até 12 caracteres (PEDIR, PEDIR AGORA, VER NO APP); "" quando a peça não pede ação no app (evento da cidade, data comemorativa, aviso).',
    '- legal: 1 linha de letra miúda quando houver condição (pedido mínimo, validade); senão "".',
    '- precoDe/precoPor: número com vírgula ("28,00"). cupomValor: só o número ("15") ou com % ("20%"). anos: só o número.',
    '- topo: tag curta (até 24 caracteres): aniversário ("BORA COMEMORAR!"), parceiro ("NOVO PARCEIRO", "LOJISTA DA SEMANA"), oferta ("PRATO DO DIA", "A PARTIR DE"); "" se não fizer falta.',
    '- loja: SÓ no parceiro, o nome da loja exatamente como o pedido escreveu; NUNCA invente nome de loja ("" se o pedido não deu).',
    '- horario: o horário que o pedido deu, no formato "11H ÀS 22H"; NUNCA invente ("" se não houver).',
    '- itens: 3 ou 4 frases curtas (até 40 caracteres): no carrossel, o conteúdo da lâmina do meio; no slide, os tópicos; numa LISTA de ofertas ("Burger clássico R$ 24,90"), de lojas ou de mais vendidos, os itens da lista — só com o que o pedido deu; senão [].',
    '- resumo: 1 frase para a gestão: a mensagem, o ponto focal e a ação.',
    '', 'Responda SÓ o JSON:',
    '{"resumo":"","objetivo":"","topo":"","chamada":["",""],"titulo":"","palavra":"","apoio":"","selo":[],"precoDe":"","precoPor":"","cupomValor":"","cupomCodigo":"","cupomRotulo":"","anos":"","cta":"","legal":"","itens":[],"loja":"","horario":""}'
  ].filter(l => l !== '').join('\n');
}
async function crPedirComposicao(fio){
  if(typeof gAskAI !== 'function' || !_crIaPronta()) return null;
  const txt = await _crAsk('arte.compor', crPrompt(fio), { json: true, cache: false });
  const j = (typeof gAiParseJson === 'function') ? gAiParseJson(txt) : null;
  if(!j || typeof j !== 'object') return null;
  j.objetivo = CR_LEGADO[j.objetivo] || j.objetivo;
  return CR_OBJETIVOS[j.objetivo] ? j : null;
}
// Legenda do post: o motor do chat do franqueado (regras de preço, hashtag e SEO já moram lá)
function crLegenda(sp){
  const cap = t => t ? t.charAt(0).toLocaleUpperCase('pt-BR') + t.slice(1).toLocaleLowerCase('pt-BR') : '';
  if(sp.objetivo === 'aviso' || sp.objetivo === 'parceiro' || sp.objetivo === 'prospeccao'){
    // legenda local e curta, só com o que a arte diz (nenhum dado novo)
    const tags = { aviso: '#deliverymuch #aviso', parceiro: '#deliverymuch #novidadenoapp', prospeccao: '#deliverymuch' }[sp.objetivo];
    const corpo = sp.objetivo === 'parceiro' ? 'Tem novidade no app: ' + (sp.loja || cap(sp.titulo)) + '!' : cap(sp.titulo) + '.';
    const extra = [sp.apoio, sp.horario ? 'Horário: ' + sp.horario.toLocaleLowerCase('pt-BR') + '.' : ''].filter(Boolean).join(' ');
    const fim = sp.objetivo === 'aviso' ? 'Qualquer dúvida, fale com a gente pelo app.' : 'É só pedir pelo app da Delivery Much.';
    return Promise.resolve([{ text: [corpo, extra, fim, tags].filter(Boolean).join('\n\n') }]);
  }
  // Com IA, a legenda nasce do BRANDING BOOK (copy.js); sem IA ou se falhar, segue o gerador do Franqueado
  const doFranq = () => typeof fFetchAICaptionSuggestions === 'function' ? fFetchAICaptionSuggestions(dadosFranq, { name: nomeFranq }, { id: sp.formato }).catch(() => []) : [];
  const valor = sp.cupomValor ? (/%$/.test(sp.cupomValor) ? sp.cupomValor + ' OFF' : 'R$ ' + sp.cupomValor + ' OFF') : '';
  const dados = {
    produto: (sp.objetivo === 'oferta' || sp.objetivo === 'evento') ? sp.titulo : '',
    precoDe: sp.precoDe ? 'R$ ' + sp.precoDe : '', precoPor: sp.precoPor ? 'R$ ' + sp.precoPor : '',
    desconto: sp.objetivo === 'cupom' || sp.objetivo === 'aniversario' ? valor
      : sp.objetivo === 'beneficio' ? sp.palavra + ' ' + sp.titulo.toLocaleLowerCase('pt-BR') : sp.selo.join(' '),
    cupom: sp.objetivo === 'cupom' || sp.objetivo === 'aniversario' ? sp.cupomCodigo : ''
  };
  const nome = sp.objetivo === 'aniversario' ? 'Aniversário de ' + sp.anos + ' anos da franquia' : 'Delivery Much';
  var dadosFranq = dados, nomeFranq = nome;
  if(typeof crLegendaMarca === 'function' && _crIaPronta()) return crLegendaMarca(sp).then(r => (r && r.length) ? r : doFranq()).catch(() => doFranq());
  return doFranq();
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
  plug: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4"/></svg>',
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
  _crRotuloModelo(); crUsoCarrega(); crSessIndice(); crConexoesRetorno(); _crLatInit();
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
// Pergunta nova: o fundo dela fica à vista, mas o TOPO nunca passa para baixo da barra (a de formato tem 9 opções)
function _crRolaPergunta(box){
  const p = _crEl('cr-palco'); if(!p || !box) return;
  requestAnimationFrame(() => {
    const barra = (_crEl('view-creative') && parseFloat(getComputedStyle(_crEl('view-creative')).getPropertyValue('--cr-barra-h'))) || 48;
    const topo = box.getBoundingClientRect().top - p.getBoundingClientRect().top - barra - 12;
    const alvo = Math.min(p.scrollHeight - p.clientHeight, p.scrollTop + topo);
    p.scrollTo({ top: Math.max(0, alvo), behavior: _crReduz() ? 'auto' : 'smooth' });
  });
}
function _crRola(forca){
  const p = _crEl('cr-palco'); if(!p || p.querySelector('.cr-esq')) return;   // com o esqueleto na tela o progresso fica à vista; quem rola é o fim da geração
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
  const giro = _crReduz() ? 0 : setInterval(() => { g.textContent = CR_GLIFOS[f++ % CR_GLIFOS.length]; }, 120);   // movimento reduzido: glifo parado
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
    li, ativo: () => li.classList.contains('cr-agora'),
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
    const resp = []; let i = 0, sel = 0, encerrou = false, tDesenha = 0;
    const fecha = val => {
      if(encerrou) return; encerrou = true; run.cancelar = null; crState.aoFoto = null; crState.aoTexto = null; _crPlaceholder();
      box.classList.add('cr-some'); setTimeout(() => { box.remove(); _crFocaCampo(); }, 240); resolve(val);
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
      crState.perguntaLivre = q.livre !== false;
      crState.aoTexto = v => {   // o campo grande também responde: texto livre vira a resposta; senão procura a opção pelo começo do rótulo
        if(q.livre !== false){ responde({ resposta: v, valor: v }); return true; }
        const k = q.opcoes.findIndex(o => String(o.rotulo).toLowerCase().startsWith(v.toLowerCase()));
        if(k >= 0){ marca(k); escolhe(k); return true; }
        box.focus(); box.classList.remove('cr-q-nao'); void box.offsetWidth; box.classList.add('cr-q-nao');   // não entendi: balança, devolve o foco às opções e NÃO apaga o que a pessoa escreveu
        gToast('Escolha uma das opções acima, ou clique em Pular');
        return false;
      };
      let ops = '', n = 0;
      if(q.tipo === 'foto') ops += op('upload', '', '<span class="cr-q-l">' + CR_ICO.foto + 'Enviar a foto</span>', 'arraste aqui, cole ou escolha o arquivo', ++n);
      q.opcoes.forEach((o, k) => { ops += op('opcao', k, gEsc(o.rotulo), o.desc, ++n); });
      if(q.livre !== false) ops += '<li class="cr-q-op" role="option" data-tipo="outro"><span class="cr-q-seta" aria-hidden="true">❯</span><span class="cr-q-n">' + (++n) + '.</span><input type="text" maxlength="80" placeholder="' + gEsc(q.dica || 'Outra resposta…') + '" aria-label="Outra resposta"></li>';
      box.innerHTML = '<div class="cr-q-topo"><span class="cr-q-chip">' + gEsc(q.titulo) + '</span>' + (perguntas.length > 1 ? '<span class="cr-q-prog" aria-label="Pergunta ' + (i + 1) + ' de ' + perguntas.length + '">' + perguntas.map((_, k) => '<i class="' + (k < i ? 'feita' : k === i ? 'agora' : '') + '"></i>').join('') + '</span>' : '') + '</div>'
        + '<p class="cr-q-txt">' + gEsc(q.pergunta) + '</p><ol class="cr-q-ops' + (q.opcoes.length > 5 ? ' cr-q-2' : '') + '" role="listbox" aria-label="' + gEsc(q.pergunta) + '">' + ops + '</ol>'
        + '<div class="cr-q-rodape"><span><kbd>↑</kbd><kbd>↓</kbd> navega <kbd>↵</kbd> escolhe ' + (q.livre === false ? '<kbd>1</kbd>–<kbd>' + n + '</kbd> atalho ' : '· digite para responder ') + '<kbd>esc</kbd> interrompe</span><button type="button" class="cr-q-pular">Pular</button></div>';
      tDesenha = Date.now(); _crPlaceholder();
      box.classList.toggle('cr-q-foto', q.tipo === 'foto');
      box.classList.remove('cr-q-troca'); void box.offsetWidth; box.classList.add('cr-q-troca');
      marca(0); _crRolaPergunta(box);
    }
    box.addEventListener('keydown', e => {
      if(encerrou) return;
      const emInput = e.target.tagName === 'INPUT';
      if(e.key === 'ArrowDown'){ e.preventDefault(); marca(sel + 1); }
      else if(e.key === 'ArrowUp'){ e.preventDefault(); marca(sel - 1); }
      else if(e.key === 'Enter'){ e.preventDefault(); escolhe(sel); }
      else if(!emInput && perguntas[i].livre !== false && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey){
        // pergunta de dado (preço, cupom…): digitar vai para o campo livre — "22,90" nunca vira atalho da opção 2
        const k = itens().findIndex(li => li.dataset.tipo === 'outro'); if(k >= 0) marca(k);
      }
      else if(!emInput && /^[1-9]$/.test(e.key) && +e.key <= itens().length && Date.now() - tDesenha > 500){ e.preventDefault(); marca(+e.key - 1); escolhe(+e.key - 1); }   // quem ainda digitava a resposta anterior não escolhe a nova sem querer
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
// Com pergunta aberta, o campo grande responde (texto livre = resposta); devolve true se respondeu
// Esc/erro removem o que tinha o foco: devolve ao campo para a pessoa seguir digitando
function _crFocaCampo(){ const t = _crEl('cr-pedido'); if(t && (document.activeElement === document.body || !document.activeElement.isConnected)) t.focus({ preventScroll: true }); }
function _crResponde(){
  const i = _crEl('cr-pedido'), v = i && i.value.trim();
  if(!v || !crState.aoTexto) return false;
  if(crState.aoTexto(v) === false) return true;   // não aceita: o texto continua no campo
  i.value = ''; crAutoAltura(i); return true;
}
function _crPlaceholder(){
  const ta = _crEl('cr-pedido'); if(!ta) return;
  ta.placeholder = crState.aoTexto ? (crState.perguntaLivre ? 'Responda aqui ou escolha acima…' : 'Escolha acima (↑↓ e Enter), anexe a foto ou clique em Pular') : _crSemTudo() ? 'Limite de hoje atingido — renova à meia-noite' : 'Descreva a arte: o que é, preço, cupom, data…';
}
function crTecla(e){
  if(e.key === 'Enter' && !e.shiftKey && !e.isComposing){
    e.preventDefault();
    if(!crState.rodando) return crEnviar();
    _crResponde();
  }
}
// O botão de enviar só acende quando há o que enviar (ou quando é "parar")
function _crPodeEnviar(){
  const i = _crEl('cr-pedido'), b = document.querySelector('#view-creative .cr-enviar');
  if(b){
    const tem = !!(i && i.value.trim()), resp = !!crState.rodando && !!crState.aoTexto && tem, ok = tem && !crUsoSemSaldo() && !crState.rodando;
    b.classList.toggle('cr-pronto', ok || resp); b.classList.toggle('cr-resp', resp);
    b.setAttribute('aria-label', resp ? 'Responder' : crState.rodando ? 'Interromper' : 'Gerar arte');
    b.setAttribute('aria-disabled', String(!ok && !resp && !crState.rodando));
  }
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
// Menus do compositor (formato e modelo): abrem para cima, setas/Enter/Esc, um aberto por vez
function _crMenu(m, b, abrir, atual){
  if(!m || !b) return;
  if(abrir === undefined) abrir = m.hidden;
  if(abrir){
    document.querySelectorAll('#view-creative .cr-menu.aberto').forEach(o => { if(o !== m) _crMenu(o, _crEl(o.id.replace('-menu', '-btn')), false); });
    [...m.children].forEach(li => li.setAttribute('aria-selected', String(li.dataset.v === atual)));
    m.hidden = false; void m.offsetWidth; m.classList.add('aberto');
    const li = m.querySelector('[aria-selected="true"]') || m.firstElementChild; if(li) li.focus({ preventScroll: true });
  }else{
    m.classList.remove('aberto');
    setTimeout(() => { if(!m.classList.contains('aberto')) m.hidden = true; }, _crReduz() ? 0 : 160);
  }
  b.setAttribute('aria-expanded', String(abrir));
}
function _crMenuFmt(abrir){
  const m = _crEl('cr-fmt-menu'); if(!m) return;
  if(!m.children.length){
    m.innerHTML = [['', 'Automático', 'Eu leio o formato do seu pedido']].concat(Object.keys(CR_FORMATOS).map(k => [k, CR_FORMATOS[k].nome, CR_FORMATOS[k].desc]))
      .map((o, i) => '<li role="option" tabindex="-1" data-v="' + o[0] + '" style="--i:' + i + '"><b>' + gEsc(o[1]) + '</b><small>' + gEsc(o[2]) + '</small></li>').join('');
  }
  _crMenu(m, _crEl('cr-fmt-btn'), abrir, crState.fmt || '');
}
function _crMenuModelo(abrir){
  const m = _crEl('cr-modelo-menu'); if(!m) return;
  const at = typeof gProvAtivo === 'function' ? gProvAtivo() : null, itens = [];
  if(at) itens.push({ v: '__prov', rot: at.nome, extra: 'sua conta', desc: at.modelo + ' · não gasta do seu limite' });
  crModelosOferta().forEach(o => itens.push({ v: o.id, rot: o.rot, extra: 'gasta ' + o.custo, desc: o.desc }));
  itens.push({ v: '__conectar', rot: 'Minhas contas de IA…', extra: '', desc: 'OpenRouter, Google AI Studio, 9router, OpenCode', sep: true });
  m.innerHTML = itens.map((o, i) => '<li role="option" tabindex="-1" data-v="' + gEsc(o.v) + '" style="--i:' + i + '"' + (o.sep ? ' class="cr-menu-sep"' : '') + '><b>' + gEsc(o.rot) + (o.extra ? ' <em>' + gEsc(o.extra) + '</em>' : '') + '</b><small>' + gEsc(o.desc) + '</small></li>').join('');
  _crMenu(m, _crEl('cr-modelo-btn'), abrir, at ? '__prov' : crModelo());
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
  crState.fmt = CR_FORMATOS[btn.dataset.fmt] ? btn.dataset.fmt : null;
  _crRotuloFmt(); crLigaMuch(btn.dataset.marca === 'much');
  crAutoAltura(i); i.focus(); i.select();
}
document.addEventListener('click', e => {
  if(!_crNoCreative()) return;
  const ideia = e.target.closest('.cr-ideia'); if(ideia) return crIdeia(ideia);
  if(e.target.closest('#cr-fmt-btn')) return _crMenuFmt();
  if(e.target.closest('#cr-modelo-btn')) return _crMenuModelo();
  const f = e.target.closest('#cr-fmt-menu [data-v]'); if(f) return crEscolheFormato(f.dataset.v);
  const md = e.target.closest('#cr-modelo-menu [data-v]'); if(md) return crEscolheModelo(md.dataset.v);
  if(e.target.closest('#cr-much')) return crLigaMuch();
  if(e.target.closest('#cr-uso')) return crUsoPop();
  const del = e.target.closest('.cr-sess-del'); if(del) return crSessApaga(del.dataset.del);
  const ab = e.target.closest('.cr-sess'); if(ab) return crSessAbre(ab.dataset.id);
  if(!e.target.closest('.cr-menu-host')){ _crMenuFmt(false); _crMenuModelo(false); }
  if(!e.target.closest('.cr-uso-host')) crUsoPop(false);
});
document.addEventListener('keydown', e => {
  if(!_crNoCreative()) return;
  if((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && String(e.key).toLowerCase() === 'b'){ e.preventDefault(); return crGaveta(); }
  if(e.key === 'Escape'){
    const cx = _crEl('cr-conex');
    if(cx && !cx.hidden){ e.stopPropagation(); return crConexoes(false); }
    const g = _crEl('cr-gaveta');
    if(g && g.classList.contains('aberta') && !_crDock()){ e.stopPropagation(); return crGaveta(false); }
    const pop = _crEl('cr-uso-pop');
    if(pop && !pop.hidden){ e.stopPropagation(); return crUsoPop(false); }
  }
  if(e.key === 'Tab'){   // modal e gaveta prendem o foco (aria-modal sem isso deixa o Tab fugir para a barra global)
    const cx = _crEl('cr-conex'), g = _crEl('cr-gaveta'), ed = document.querySelector('#view-creative .cr-ed.aberto');
    const po = document.querySelector('#f-posted-modal.cr-postado.open .posted-box');
    const cont = po || (cx && !cx.hidden ? cx : (g && g.classList.contains('aberta') && !_crDock() ? g : ed));
    if(cont){
      const f = [...cont.querySelectorAll('button:not([disabled]),input:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(x => x.offsetParent !== null);
      if(f.length){
        const i = f.indexOf(document.activeElement), fim = e.shiftKey ? 0 : f.length - 1;
        if(i === -1 || i === fim){ e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
      }
      return;
    }
  }
  const m = document.querySelector('#view-creative .cr-menu.aberto'); if(!m) return;
  const li = [...m.children], k = li.indexOf(document.activeElement);
  const escolhe = v => m.id === 'cr-fmt-menu' ? crEscolheFormato(v) : crEscolheModelo(v);
  if(e.key === 'ArrowDown'){ e.preventDefault(); li[(k + 1) % li.length].focus(); }
  else if(e.key === 'ArrowUp'){ e.preventDefault(); li[(k - 1 + li.length) % li.length].focus(); }
  else if(e.key === 'Enter' || e.key === ' '){ if(k >= 0){ e.preventDefault(); escolhe(li[k].dataset.v); } }
  else if(e.key === 'Escape' || e.key === 'Tab'){
    const b = _crEl(m.id.replace('-menu', '-btn'));
    _crMenu(m, b, false);
    if(e.key === 'Escape'){ e.stopPropagation(); if(b) b.focus({ preventScroll: true }); }
  }
}, true);
// Barra do topo ganha a linha (e o vidro) só quando há conteúdo passando por baixo dela
(function(){
  const p = _crEl('cr-palco'); if(!p) return;
  p.addEventListener('scroll', () => { const v = _crEl('view-creative'); if(v) v.classList.toggle('cr-rolou', p.scrollTop > 8); }, { passive: true });
})();

/* ══════════════════════════════════════════════════════════════
   USO DO DIA, MODELO E SESSÕES
   · Limite diário por franqueado + contador: a regra e o teto assumido moram na migration
     20261014200000 e no changelog do backend. Aqui é a ponta do front: consome ANTES de gerar,
     estorna o que não chegou à entrega e, enquanto a migration não estiver aplicada, conta
     LOCALMENTE (por aparelho) — o popover do contador avisa qual dos dois está valendo.
   · Modelo: "Rápido" gasta 1 arte; os demais gastam 2. O franqueado vê Rápido/Capaz; a equipe vê a lista toda.
   · Sessões: cada conversa é guardada no IndexedDB (uma chave por usuário) e reabre com opções,
     legenda e edições.
══════════════════════════════════════════════════════════════ */
const CR_MODELO_RAPIDO = 'gemini-3.1-flash-lite', CR_MODELO_CAPAZ = 'gemini-3.6-flash';
const CR_LIMITE_PADRAO = 20, CR_SESS_MAX = 20;
const _crUid = () => { try{ const u = gCurrentUser(); return (u && u.id) || 'anon'; }catch(e){ return 'anon'; } };
const _crAdmin = () => typeof gIsAdmin === 'function' && gIsAdmin();
const crCusto = id => id === CR_MODELO_RAPIDO ? 1 : 2;
const _crNomeModelo = id => id === CR_MODELO_RAPIDO ? 'Rápido' : id === CR_MODELO_CAPAZ ? 'Capaz' : String(id).replace(/^gemini-/, '').replace('-flash', ' Flash').replace('-lite', '-Lite');
function crModelosOferta(){
  const todos = typeof G_AI_MODELOS !== 'undefined' ? G_AI_MODELOS : [];
  const ids = _crAdmin() && todos.length ? todos.map(m => m.id) : [CR_MODELO_RAPIDO, CR_MODELO_CAPAZ];
  const desc = { [CR_MODELO_RAPIDO]: 'O mais veloz e barato — bom para a maioria das artes', [CR_MODELO_CAPAZ]: 'Pensa mais antes de diagramar; um pouco mais lento' };
  return ids.map(id => ({ id, rot: _crNomeModelo(id), custo: crCusto(id), desc: desc[id] || (todos.find(m => m.id === id) || {}).desc || '' }));
}
function crModelo(){
  let id = ''; try{ id = localStorage.getItem('luma_creative_modelo:' + _crUid()) || ''; }catch(e){}
  return crModelosOferta().some(m => m.id === id) ? id : CR_MODELO_RAPIDO;
}
// Toda chamada de IA do Creative usa o modelo FIXADO no início da geração (mexer no menu no meio não muda o custo)
const _crAsk = (task, prompt, opts) => gAskAI(task, prompt, Object.assign({}, opts, crState.provRun ? { provedor: true } : { model: crState.modeloRun || crModelo() }));
const _crIaPronta = () => !!(typeof gProvAtivo === 'function' && gProvAtivo()) || (typeof gAiReady === 'function' && gAiReady());
function _crRotuloModelo(){
  const at = typeof gProvAtivo === 'function' ? gProvAtivo() : null;
  const id = crModelo(), r = _crEl('cr-modelo-rot'), c = _crEl('cr-modelo-custo'), b = _crEl('cr-modelo-btn');
  if(r) r.textContent = at ? at.def.nome.split(' ')[0] + ' · ' + String(at.modelo).split('/').pop().slice(0, 22) : _crNomeModelo(id);
  if(c) c.textContent = at ? 'sua conta' : '−' + crCusto(id);
  if(b){ b.classList.toggle('cr-pill-on', !!at || crCusto(id) > 1); b.classList.toggle('cr-propria', !!at); }
}
function crEscolheModelo(id){
  if(id === '__conectar'){ _crMenuModelo(false); return crConexoes(true); }
  if(id === '__prov'){ _crMenuModelo(false); return; }   // já é a conta em uso
  if(!crModelosOferta().some(m => m.id === id)) return;
  if(typeof gProvUsa === 'function') gProvUsa(null);      // escolher um modelo do Luma desliga a conta própria
  try{ localStorage.setItem('luma_creative_modelo:' + _crUid(), id); }catch(e){}
  _crRotuloModelo(); _crMenuModelo(false); crUsoPinta();
  const b = _crEl('cr-modelo-btn'); if(b) b.focus({ preventScroll: true });
}

/* ── Contador ── */
const crUso = { usado: 0, limite: null, ilimitado: true, origem: 'local', pendente: 0 };
const _crDia = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const _crUsoChave = () => 'luma_creative_uso:' + _crUid() + ':' + _crDia();
function _crUsoLocalLe(){ try{ return +(JSON.parse(localStorage.getItem(_crUsoChave()) || '{}').usado) || 0; }catch(e){ return 0; } }
function _crUsoLocalGrava(n){ try{ localStorage.setItem(_crUsoChave(), JSON.stringify({ usado: Math.max(0, n) })); }catch(e){} }
async function _crRpc(nome, args){
  const sb = typeof gSupabase === 'function' ? gSupabase() : window.sb;
  if(!sb || typeof sb.rpc !== 'function') return null;
  try{ const r = await sb.rpc(nome, args); return r && !r.error ? r.data : null; }catch(e){ return null; }
}
async function crUsoCarrega(){
  const d = await _crRpc('luma_creative_uso');
  if(d && d.ok) Object.assign(crUso, { usado: d.usado, limite: d.limite, ilimitado: !!d.ilimitado, origem: 'servidor' });
  else{ const adm = _crAdmin(); Object.assign(crUso, { usado: _crUsoLocalLe(), ilimitado: adm, limite: adm ? null : CR_LIMITE_PADRAO, origem: 'local' }); }
  crUsoPinta();
}
// Consome ANTES de gastar IA. Devolve {ok} (ou {ok:false} quando o limite do dia não deixa)
async function crUsoConsome(modelo){
  const custo = crCusto(modelo), d = await _crRpc('luma_creative_consumir', { p_modelo: modelo });
  if(d && typeof d.ok === 'boolean'){
    Object.assign(crUso, { usado: d.usado, limite: d.limite, ilimitado: d.limite == null, origem: 'servidor' });
    if(d.ok) crUso.pendente = custo;
    crUsoPinta(); return { ok: d.ok };
  }
  const usado = _crUsoLocalLe();
  if(!crUso.ilimitado && crUso.limite != null && usado + custo > crUso.limite){ crUso.usado = usado; crUsoPinta(); return { ok: false }; }
  _crUsoLocalGrava(usado + custo); Object.assign(crUso, { usado: usado + custo, pendente: custo, origem: 'local' }); crUsoPinta();
  return { ok: true };
}
async function crUsoEstorna(){
  const c = crUso.pendente; if(!c) return;
  crUso.pendente = 0;
  const d = crUso.origem === 'servidor' ? await _crRpc('luma_creative_estornar') : null;
  if(d && d.ok) crUso.usado = d.usado;
  else{ crUso.usado = Math.max(0, crUso.usado - c); if(crUso.origem === 'local') _crUsoLocalGrava(crUso.usado); }
  crUsoPinta();
}
function crUsoConfirma(){ if(crUso.pendente && crUso.origem === 'servidor') _crRpc('luma_creative_confirmar'); crUso.pendente = 0; }
const _crUsoResta = () => (crUso.ilimitado || crUso.limite == null) ? Infinity : crUso.limite - crUso.usado;
const _crPropria = () => !!(typeof gProvAtivo === 'function' && gProvAtivo());
const _crSemTudo = () => !_crPropria() && crUso.limite != null && !crUso.ilimitado && _crUsoResta() < crCusto(CR_MODELO_RAPIDO);   // nem o Rápido cabe
const crUsoSemSaldo = () => !_crPropria() && _crUsoResta() < crCusto(crModelo());
// O aviso do dia, uma verdade só (banner acima do campo, toast ao tentar enviar e recusa dentro da geração)
function crUsoMsg(modelo){
  if(_crPropria() || crUso.ilimitado || crUso.limite == null) return '';
  const resta = _crUsoResta(), id = modelo || crModelo();
  if(resta < crCusto(CR_MODELO_RAPIDO)) return 'Você usou as ' + crUso.limite + ' artes de hoje. O limite renova à meia-noite.';
  if(resta < crCusto(id)) return (resta > 1 ? 'Restam ' + resta + ' artes' : 'Resta 1 arte') + ' hoje — o modelo ' + _crNomeModelo(id) + ' gasta ' + crCusto(id) + '. Troque para o Rápido.';
  if(resta <= 3) return resta === 1 ? 'Resta 1 arte hoje.' : 'Restam ' + resta + ' artes hoje.';
  return '';
}
function crUsoPinta(){
  const n = _crEl('cr-uso-n'), b = _crEl('cr-uso'); if(!n || !b) return;
  const lim = (crUso.ilimitado || crUso.limite == null) ? null : crUso.limite, u = crUso.usado, resta = _crUsoResta();
  n.textContent = lim == null ? u + ' hoje' : u + '/' + lim;
  const f = lim == null ? Math.min(1, u / 40) : Math.min(1, u / lim);   // sem limite o anel só mostra movimento
  b.style.setProperty('--u', f.toFixed(3));
  b.classList.toggle('perto', lim != null && f >= 0.8 && !crUsoSemSaldo());
  b.classList.toggle('cheio', _crSemTudo());
  b.setAttribute('aria-label', lim == null ? 'Uso de hoje: ' + u + (u === 1 ? ' arte' : ' artes') : 'Uso de hoje: ' + u + ' de ' + lim + ' artes');
  const av = _crEl('cr-limite'), msg = crUsoMsg();
  if(av){
    av.hidden = !msg; av.textContent = msg; av.classList.toggle('cheio', _crSemTudo());
    if(msg && crUsoSemSaldo()){   // aviso sem saída é beco: oferece o que destrava
      const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'cr-limite-ac';
      bt.textContent = _crSemTudo() ? 'Usar minha conta de IA' : 'Usar o Rápido';
      bt.onclick = () => _crSemTudo() ? crConexoes(true) : crEscolheModelo(CR_MODELO_RAPIDO);
      av.appendChild(bt);
    }
  }
  const pop = _crEl('cr-uso-pop'); if(pop && !pop.hidden) pop.innerHTML = crUsoPopHtml();
  const su = _crEl('cr-side-uso'); if(su) su.textContent = lim == null ? u + (u === 1 ? ' arte hoje' : ' artes hoje') : u + ' de ' + lim + ' artes hoje';
  _crPlaceholder(); _crPodeEnviar();
}
function crUsoPopHtml(){
  const lim = (crUso.ilimitado || crUso.limite == null) ? null : crUso.limite, u = crUso.usado, resta = _crUsoResta();
  return '<b class="cr-uso-tit">Uso de hoje</b>'
    + '<div class="cr-uso-num"><span>' + u + '</span>' + (lim != null ? ' de ' + lim + ' artes' : ' ' + (u === 1 ? 'arte gerada' : 'artes geradas')) + '</div>'
    + (lim != null ? '<div class="cr-uso-barra' + (resta <= 0 ? ' cheia' : '') + '" style="--u:' + Math.min(1, u / lim).toFixed(3) + '"><i></i></div><p>' + (resta > 0 ? 'Restam ' + resta + '.' : 'Limite de hoje atingido. Renova à meia-noite (Brasília); as artes de hoje seguem em Sessões.') + '</p>' : '<p>Sem limite para a sua conta.</p>')
    + '<p class="cr-uso-reg">O modelo Rápido gasta 1 arte; os outros gastam 2. “Outras opções” conta como uma arte nova.' + (lim != null && resta <= 0 ? '' : ' O dia renova à meia-noite (Brasília).') + '</p>'
    + '';
}
function crUsoPop(abrir){
  const pop = _crEl('cr-uso-pop'), b = _crEl('cr-uso'); if(!pop || !b) return;
  if(abrir === undefined) abrir = pop.hidden;
  if(abrir){ pop.innerHTML = crUsoPopHtml(); pop.hidden = false; void pop.offsetWidth; pop.classList.add('aberto'); }
  else{ pop.classList.remove('aberto'); setTimeout(() => { if(!pop.classList.contains('aberto')) pop.hidden = true; }, _crReduz() ? 0 : 160); }
  b.setAttribute('aria-expanded', String(abrir));
}

/* ── Sessões ── */
const crSess = { id: null, criada: 0, indice: [] };
const _crSessChave = id => 'cr:' + _crUid() + ':s:' + id, _crIdxChave = () => 'cr:' + _crUid() + ':idx';
async function _crIdxLe(){ try{ const raw = await gIdbGet(_crIdxChave()); const v = raw ? JSON.parse(raw) : []; return Array.isArray(v) ? v : []; }catch(e){ return []; } }
async function crSessIndice(){ crSess.indice = (await _crIdxLe()).sort((a, b) => b.atualizada - a.atualizada); crSessPinta(); _crLatAuto(); return crSess.indice; }
const _crSerOp = o => {
  let spec = {}; try{ spec = JSON.parse(JSON.stringify(o.spec, (k, v) => (typeof v === 'string' && v.length > 2000) ? '' : v)); }catch(e){}
  return { receita: o.receita, nomeReceita: o.nomeReceita, w: o.w, h: o.h, svgFinal: o.svgFinal, juiz: o.juiz || null, editada: !!o.editada, desenho: !!o.desenho, spec };
};
const _crSerFio = f => ({ pedido: f.pedido, fmt: f.fmt, marca: f.marca, foto: f.foto, ref: f.ref, briefing: f.briefing, conteudo: f.conteudo, legenda: f.legenda,
  mostradas: f.mostradas, assinaturas: f.assinaturas, ideias: f.ideias, rodada: f.rodada, viaIA: f.viaIA, entregas: (f.entregas || []).map(e => e.map(_crSerOp)) });
function _crThumb(op){
  return new Promise(res => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(120 / op.w, 150 / op.h), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(op.w * k)); c.height = Math.max(1, Math.round(op.h * k));
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.72));
    };
    im.onerror = () => res(''); im.src = op.url;
  });
}
let _crSessTimer = 0;
// Salva depois de uma pausa (várias edições seguidas viram uma gravação só); `ja` grava na hora
function crSessSalva(ja){
  clearTimeout(_crSessTimer);
  if(!crSess.id || !crState.fios.some(f => f.entregas && f.entregas.length)) return Promise.resolve(false);
  return new Promise(res => { _crSessTimer = setTimeout(async () => res(await _crSessGrava()), ja ? 0 : 600); });
}
async function _crSessGrava(){
  try{
    const fios = crState.fios.filter(f => f.entregas && f.entregas.length);
    if(!fios.length || !crSess.id) return false;
    const rec = { id: crSess.id, criada: crSess.criada, fios: fios.map(_crSerFio), fmtMenu: crState.fmt, much: crState.much };
    const ult = fios[fios.length - 1], op = ult.entregas[ult.entregas.length - 1][0];
    const meta = { id: crSess.id, titulo: String(fios[0].pedido).slice(0, 60), criada: crSess.criada, atualizada: Date.now(),
      n: fios.reduce((a, f) => a + f.entregas.length, 0), fmt: ult.fmt, much: ult.marca === 'much', thumb: await _crThumb(op) };
    if(!(await gIdbPut(_crSessChave(rec.id), JSON.stringify(rec)))) return false;
    const idx = (await _crIdxLe()).filter(x => x.id !== meta.id); idx.push(meta); idx.sort((a, b) => b.atualizada - a.atualizada);
    idx.splice(CR_SESS_MAX).forEach(velho => gIdbDel(_crSessChave(velho.id)));
    await gIdbPut(_crIdxChave(), JSON.stringify(idx));
    crSess.indice = idx; crSessPinta(); _crLatAuto(); return true;
  }catch(e){ console.warn('[creative] a sessão não foi salva', e); return false; }
}
function _crQuando(t){
  const m = Math.round((Date.now() - t) / 60000);
  if(m < 1) return 'agora';
  if(m < 60) return 'há ' + m + ' min';
  if(m < 60 * 24 && _crDia() === new Date(t).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })) return 'há ' + Math.round(m / 60) + ' h';
  if(m < 60 * 48) return 'ontem';
  return new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
function crSessPinta(){
  const lista = _crEl('cr-gaveta-lista'), n = _crEl('cr-sess-n'), sub = _crEl('cr-gaveta-sub'), ret = _crEl('cr-retomar');
  const idx = crSess.indice;
  if(n){ n.textContent = idx.length; n.hidden = !idx.length; }
  if(sub) sub.textContent = idx.length ? idx.length + (idx.length > 1 ? ' sessões guardadas neste aparelho' : ' sessão guardada neste aparelho') : 'suas artes ficam guardadas aqui';
  const busca = _crEl('cr-sess-busca'); if(busca) busca.hidden = idx.length < 6;
  const dia = t => new Date(t).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }), hj = _crDia(), ont = dia(Date.now() - 864e5);
  const grupo = x => { const d = dia(x.atualizada); return d === hj ? 'Hoje' : d === ont ? 'Ontem' : 'Anteriores'; };
  const item = x => '<li class="cr-sess-li' + (x.id === crSess.id ? ' on' : '') + '"><button type="button" class="cr-sess" data-id="' + gEsc(x.id) + '">'
      + (x.thumb ? '<img src="' + gEsc(x.thumb) + '" alt="">' : '<span class="cr-sess-sem"></span>')
      + '<span class="cr-sess-txt"><b>' + gEsc(x.titulo) + '</b><small>' + gEsc((CR_FORMATOS[x.fmt] || { nome: 'Arte' }).nome) + (x.much ? ' · Much+' : '') + ' · ' + x.n + (x.n > 1 ? ' artes' : ' arte') + ' · ' + _crQuando(x.atualizada) + '</small></span></button>'
      + '<button type="button" class="cr-sess-del" data-del="' + gEsc(x.id) + '" aria-label="Apagar a sessão ' + gEsc(x.titulo) + '" title="Apagar">' + CR_ICO.lixo + '</button></li>';
  if(lista){
    const gs = ['Hoje', 'Ontem', 'Anteriores'].map(g => [g, idx.filter(x => grupo(x) === g)]).filter(([, l]) => l.length);
    lista.innerHTML = idx.length ? gs.map(([g, l]) => '<h5 class="cr-sess-grp">' + g + '</h5><ul>' + l.map(item).join('') + '</ul>').join('')
    : '<p class="cr-gaveta-vazio">Nada por aqui ainda. Cada conversa que entregar uma arte fica guardada para você retomar, comparar e baixar de novo.</p>';
    _crSessFiltra();
  }
  if(ret){
    const x = idx.find(y => y.id !== crSess.id);
    ret.hidden = !x;
    if(x) ret.querySelector('span').textContent = 'Retomar “' + (x.titulo.length > 38 ? x.titulo.slice(0, 37) + '…' : x.titulo) + '” · ' + _crQuando(x.atualizada);
  }
}
// Painel lateral: em tela larga (>=1000px) é uma coluna FIXA e recolhível (a escolha fica guardada, Ctrl+B alterna);
// abaixo disso é a gaveta de antes, por cima da conversa, com véu.
const _crDock = () => window.matchMedia('(min-width:1000px)').matches;
const _crNovaHab = on => document.querySelectorAll('#view-creative .cr-nova-b, #cr-nova').forEach(b => { b.disabled = !on; });
function crGaveta(abrir, semGuardar){
  const g = _crEl('cr-gaveta'), v = _crEl('cr-veu'), view = _crEl('view-creative'); if(!g) return;
  if(abrir === undefined) abrir = !g.classList.contains('aberta');
  const dock = _crDock(), btn = _crEl(dock ? 'cr-lat-btn' : 'cr-sess-btn');
  if(abrir) crSessIndice();
  g.classList.toggle('aberta', abrir); g.setAttribute('aria-hidden', String(!abrir)); g.toggleAttribute('inert', !abrir);
  if(view) view.classList.toggle('cr-lat-on', abrir);
  document.querySelectorAll('#cr-sess-btn, #cr-lat-btn').forEach(b => b.setAttribute('aria-expanded', String(abrir)));
  if(dock){
    if(!semGuardar) try{ localStorage.setItem('cr:lat', abrir ? '1' : '0'); }catch(e){}
  }else if(v){ v.hidden = false; void v.offsetWidth; v.classList.toggle('aberto', abrir); if(!abrir) setTimeout(() => { if(!v.classList.contains('aberto')) v.hidden = true; }, _crReduz() ? 0 : 260); }
  if(abrir && !dock){ const p = g.querySelector('.cr-sess, .cr-ed-ico'); if(p) setTimeout(() => p.focus({ preventScroll: true }), 60); }
  else if(!abrir && btn && document.activeElement && g.contains(document.activeElement)) btn.focus({ preventScroll: true });
}
// Entrar na aba / cruzar o breakpoint: em tela larga o painel abre como a pessoa deixou (padrão: aberto)
// Sem escolha guardada o painel nasce RECOLHIDO e abre sozinho quando existe a primeira sessão (_crLatAuto)
const _crLatPref = () => { try{ return localStorage.getItem('cr:lat'); }catch(e){ return null; } };
function _crLatInit(){
  crGaveta(_crDock() && _crLatPref() === '1', true);
  _crLatAuto();
}
function _crLatAuto(){
  const g = _crEl('cr-gaveta');
  if(g && _crDock() && _crLatPref() === null && crSess.indice.length && !g.classList.contains('aberta')) crGaveta(true, true);
}
window.matchMedia('(min-width:1000px)').addEventListener('change', () => { if(_crNoCreative()) _crLatInit(); });
function _crSessFiltra(){
  const q = ((_crEl('cr-sess-busca') || {}).value || '').trim().toLowerCase(), l = _crEl('cr-gaveta-lista'); if(!l) return;
  l.querySelectorAll('.cr-sess-li').forEach(li => { li.hidden = !!q && !li.textContent.toLowerCase().includes(q); });
  l.querySelectorAll('.cr-sess-grp').forEach(h => { const ul = h.nextElementSibling; h.hidden = !ul || !ul.querySelector('.cr-sess-li:not([hidden])'); });
}
document.addEventListener('input', e => { if(e.target.id === 'cr-sess-busca') _crSessFiltra(); });
async function _crLimpaConversa(){
  const conv = _crEl('cr-conversa'); if(!conv) return;
  conv.classList.add('cr-saindo'); await _crEsp(220);
  conv.innerHTML = ''; conv.classList.remove('cr-saindo');
}
function _crBolhaEu(fio){
  const m = document.createElement('div');
  m.className = 'cr-msg cr-eu cr-entra';
  m.innerHTML = '<div class="cr-corpo">' + (/^data:/.test(fio.foto || '') || fio.ref ? '<img class="cr-bolha-foto" alt="' + (fio.ref ? 'Referência enviada' : 'Foto enviada') + '" src="' + (fio.foto || fio.ref) + '">' : '')
    + '<div class="cr-bolha">' + gEsc(fio.pedido) + '</div></div>';
  return m;
}
const _crFalaPronta = ops => 'Separei ' + ops.length + (ops.length > 1 ? ' opções' : ' opção') + ' em ' + CR_FORMATOS[ops[0].spec.formato].nome.toLowerCase() + ': escolha uma, ajuste no editor se quiser e baixe.';
const _crFechaOverlay = () => { if(!_crDock()) crGaveta(false); };   // o painel fixo não fecha ao abrir uma sessão
async function crSessAbre(id){
  if(crState.rodando) return gToast('Interrompa a geração atual antes de trocar de sessão');
  if(id === crSess.id) return _crFechaOverlay();
  await crSessSalva(true);
  let rec = null; try{ rec = JSON.parse(await gIdbGet(_crSessChave(id))); }catch(e){}
  if(!rec || !Array.isArray(rec.fios)) return gToast('Não consegui abrir essa sessão', 'error');
  _crFechaOverlay();
  await _crLimpaConversa();
  crSess.id = rec.id; crSess.criada = rec.criada || Date.now();
  crState.fios = rec.fios.map(f => {
    f.mostradas = f.mostradas || [];
    f.entregas = (f.entregas || []).map(e => e.map(o => { o.url = URL.createObjectURL(new Blob([o.svgFinal], { type: 'image/svg+xml' })); return o; }));
    return f;
  });
  const conv = _crEl('cr-conversa');
  crState.fios.forEach(f => {
    const eu = _crBolhaEu(f); eu.classList.remove('cr-entra'); conv.appendChild(eu);
    f.entregas.forEach((ops, k) => {
      const m = _crMsgIA(conv); m.classList.remove('cr-entra');
      m.querySelector('.cr-bolha').textContent = k ? 'Mais caminhos para este pedido.' : _crFalaPronta(ops);
      const ent = _crEntrega(f, ops); conv.appendChild(ent); _crMostra(ent, false);
    });
  });
  crState.fmt = CR_FORMATOS[rec.fmtMenu] ? rec.fmtMenu : null; _crRotuloFmt(); crLigaMuch(!!rec.much);
  const v = _crEl('view-creative'); if(v) v.classList.add('cr-conversando');
  _crNovaHab(true);
  crSessPinta(); crFaixaPinta();
  const pl = _crEl('cr-palco'); if(pl) pl.scrollTo({ top: pl.scrollHeight });
}
async function crSessApaga(id){
  const x = crSess.indice.find(y => y.id === id); if(!x) return;
  if(!(await gConfirm('Apagar a sessão “' + x.titulo + '”? As opções e a legenda dela saem deste aparelho.', { title: 'Apagar sessão', okLabel: 'Apagar', cancelLabel: 'Manter', danger: true }))) return;
  await gIdbDel(_crSessChave(id));
  await gIdbPut(_crIdxChave(), JSON.stringify((await _crIdxLe()).filter(y => y.id !== id)));
  if(id === crSess.id){ crSess.id = null; crSess.criada = 0; }   // a conversa na tela segue; só deixa de ser guardada
  await crSessIndice();
}
function crRetomaUltima(){ const x = crSess.indice.find(y => y.id !== crSess.id); if(x) crSessAbre(x.id); }

/* ── "Desta sessão": uma miniatura por arte entregue (a opção escolhida), clique leva até ela ── */
function crFaixaPinta(){
  const f = _crEl('cr-faixa'), l = _crEl('cr-faixa-lista'), conv = _crEl('cr-conversa'); if(!f || !l || !conv) return;
  const ents = [...conv.querySelectorAll('.cr-entrega:not(.cr-esq)')], antes = l.children.length;
  f.hidden = !ents.length; l.innerHTML = '';
  ents.forEach((e, i) => {
    const im0 = e.querySelector('.cr-op.on img') || e.querySelector('.cr-op img'); if(!im0) return;
    const b = document.createElement('button'), im = document.createElement('img');
    b.type = 'button'; b.className = 'cr-faixa-it' + (i >= antes ? ' novo' : '');
    b.title = e.dataset.pedido || 'Arte ' + (i + 1); b.setAttribute('aria-label', 'Ir para a arte ' + (i + 1) + ': ' + b.title);
    im.alt = ''; im.src = im0.src; b.appendChild(im);
    b.onclick = () => {
      e.scrollIntoView({ block: 'start', behavior: _crReduz() ? 'auto' : 'smooth' });
      e.classList.remove('cr-acha'); void e.offsetWidth; e.classList.add('cr-acha');
    };
    l.appendChild(b);
  });
  l.style.scrollBehavior = 'auto'; l.scrollLeft = l.scrollWidth; l.style.scrollBehavior = '';   // o smooth do CSS cancelava a atribuição
}

document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden') crSessSalva(true); });
/* ══════════════════════════════════════════════════════════════
   MINHAS CONTAS DE IA — modal. A pessoa liga a conta dela (OpenRouter, Google AI Studio, 9router,
   OpenCode Zen) e as gerações passam a sair por ali: o custo é dela e não conta no limite do dia.
   O motor (chamada, chave, OAuth) mora em core/ai/ai-provedores.js; aqui é só a tela.
   Antigravity aparece como "não suportado" de propósito: o Google proíbe esse login em apps de terceiros.
══════════════════════════════════════════════════════════════ */
const crConex = { form: null, estado: {}, modelos: {} };
const _crCxLetra = id => ({ openrouter: 'OR', google: 'G', '9router': '9R', opencode: 'OC', codex: 'CX', antigravity: 'AG' }[id] || id.slice(0, 2).toUpperCase());
function _crCxCard(id){
  const d = G_PROVEDORES[id], on = gProvConectado(id), cfg = gProvConfig(id) || {}, est = gProvEstado(), ativo = est.ativo === id && !!gProvAtivo(), st = crConex.estado[id] || {};
  const badge = ativo ? '<span class="cr-cx-badge em-uso">Em uso</span>' : on ? '<span class="cr-cx-badge">Conectado</span>' : d.risco ? '<span class="cr-cx-badge risco">Por sua conta e risco</span>' : '<span class="cr-cx-badge off">Não conectado</span>';
  let corpo = '<p class="cr-cx-desc">' + gEsc(d.desc) + '</p>';
  // Provedor "por sua conta e risco" (Codex, Antigravity): o aviso fica à vista antes de conectar e depois
  if(d.risco) corpo += '<div class="cr-cx-risco" role="note"><b>Risco para a sua conta</b><p>' + gEsc(d.aviso) + '</p>'
    + (on ? '' : '<ol><li>Instale e abra o 9router: <code>npm install -g 9router</code> e depois <code>9router</code> (abre em localhost:20128).</li><li>No painel dele, em <b>Providers</b>, conecte ' + gEsc(d.nome.split(' (')[0]) + ' — o login acontece lá, não no Luma.</li><li>Volte aqui, aceite o risco e conecte.</li></ol>') + '</div>';
  if(on){
    corpo += '<div class="cr-cx-campo"><label for="cx-mod-' + id + '">Modelo</label><input id="cx-mod-' + id + '" data-cx-modelo="' + id + '" list="cx-dl-' + id + '" value="' + gEsc(cfg.modelo || '') + '" placeholder="Escolha ou digite o id do modelo" autocomplete="off" spellcheck="false"><datalist id="cx-dl-' + id + '"></datalist></div>'
      + '<p class="cr-cx-mini">' + (cfg.key ? 'Chave ' + gEsc(gProvMascara(cfg.key)) + ' · ' : '') + gEsc((cfg.base || d.base).replace(/^https?:\/\//, '')) + '</p>'
      + '<div class="cr-cx-acoes">' + (ativo ? '<button type="button" class="cr-btn cr-btn-mini" data-cx="naousar" data-id="' + id + '">Parar de usar</button>'
          : '<button type="button" class="cr-btn cr-btn-mini cr-prim" data-cx="usar" data-id="' + id + '"' + (cfg.modelo ? '' : ' disabled title="Escolha um modelo primeiro"') + '>Usar esta conta</button>')
      + '<button type="button" class="cr-btn cr-btn-mini" data-cx="testar" data-id="' + id + '">Testar conexão</button>'
      + '<button type="button" class="cr-btn cr-btn-mini cr-btn-leve" data-cx="desconectar" data-id="' + id + '">Desconectar</button></div>';
  }else if(crConex.form === id){
    corpo += '<div class="cr-cx-form">'
      + (d.baseEditavel ? '<div class="cr-cx-campo"><label for="cx-base-' + id + '">Endereço</label><input id="cx-base-' + id + '" value="' + gEsc(d.base) + '" autocomplete="off" spellcheck="false"></div>' : '')
      + '<div class="cr-cx-campo"><label for="cx-key-' + id + '">Chave' + (d.chaveOpcional ? ' <small>(opcional' + (d.via ? ' — só se o 9router exigir' : '') + ')</small>' : '') + '</label><input id="cx-key-' + id + '" type="password" autocomplete="off" spellcheck="false" placeholder="Cole a chave aqui"></div>'
      + (d.risco ? '<label class="cr-cx-ciente"><input type="checkbox" id="cx-ciente-' + id + '"> <span>Entendo o risco para a minha conta e quero usar mesmo assim.</span></label>' : '')
      + '<div class="cr-cx-acoes"><button type="button" class="cr-btn cr-btn-mini cr-prim" data-cx="conectar" data-id="' + id + '">' + CR_ICO.plug + 'Conectar e testar</button>'
      + '<button type="button" class="cr-btn cr-btn-mini cr-btn-leve" data-cx="cancelar">Cancelar</button>'
      + (d.chaveUrl ? '<a class="cr-cx-link" href="' + gEsc(d.chaveUrl) + '" target="_blank" rel="noopener noreferrer">Criar uma chave</a>' : '') + '</div></div>';
  }else{
    corpo += '<div class="cr-cx-acoes">' + (d.oauth ? '<button type="button" class="cr-btn cr-btn-mini cr-prim" data-cx="oauth" data-id="' + id + '">Entrar com ' + gEsc(d.nome) + '</button>' : '')
      + '<button type="button" class="cr-btn cr-btn-mini' + (d.oauth ? '' : ' cr-prim') + '" data-cx="form" data-id="' + id + '">' + (d.oauth ? 'Colar uma chave' : 'Conectar') + '</button></div>';
  }
  if(st.msg) corpo += '<p class="cr-cx-msg ' + (st.tipo || '') + '" role="status">' + gEsc(st.msg) + '</p>';
  return '<section class="cr-cx-card' + (ativo ? ' ativo' : '') + '" id="cx-card-' + id + '"><header><span class="cr-cx-tile">' + _crCxLetra(id) + '</span><b>' + gEsc(d.nome) + '</b>' + badge + '</header>' + corpo + '</section>';
}
function crConexoesPinta(){
  const el = _crEl('cr-conex-corpo'); if(!el) return;
  const nao = Object.keys(G_PROV_NAO_SUPORTADOS).map(id => {
    const n = G_PROV_NAO_SUPORTADOS[id];
    return '<section class="cr-cx-card nao"><header><span class="cr-cx-tile">AG</span><b>' + gEsc(n.nome) + '</b><span class="cr-cx-badge off">Não suportado</span></header><p class="cr-cx-desc">' + gEsc(n.motivo) + '</p>'
      + '<div class="cr-cx-acoes"><button type="button" class="cr-btn cr-btn-mini" data-cx="form" data-id="' + n.alternativa + '">Usar a chave do Google AI Studio</button></div></section>';
  }).join('');
  const tinha = el.contains(document.activeElement);
  el.innerHTML = Object.keys(G_PROVEDORES).map(_crCxCard).join('') + nao;
  if(tinha){ const p = el.querySelector('input,button:not([disabled])'); if(p) p.focus({ preventScroll: true }); }   // re-render não derruba o foco no body
  Object.keys(G_PROVEDORES).forEach(id => { if(gProvConectado(id)) _crCxModelosLista(id); });
}
// Lista de modelos do provedor entra no datalist sem redesenhar o cartão (não perde o que a pessoa digita)
async function _crCxModelosLista(id){
  if(!crConex.modelos[id]) crConex.modelos[id] = await gProvModelos(id) || [];
  const dl = _crEl('cx-dl-' + id); if(!dl) return;
  dl.innerHTML = crConex.modelos[id].slice(0, 400).map(m => '<option value="' + gEsc(m.id) + '"></option>').join('');
}
function crConexoes(abrir){
  const m = _crEl('cr-conex'); if(!m) return;
  if(abrir === undefined) abrir = m.hidden;
  if(abrir){
    crConex.form = null; crConex.estado = {}; crConexoesPinta();
    m.hidden = false; void m.offsetWidth; m.classList.add('aberto');
    setTimeout(() => { const p = m.querySelector('button:not([disabled]), input'); if(p) p.focus({ preventScroll: true }); }, 80);
  }else{
    m.classList.remove('aberto'); setTimeout(() => { if(!m.classList.contains('aberto')) m.hidden = true; }, _crReduz() ? 0 : 220);
    _crRotuloModelo(); crUsoPinta();
    const b = _crEl('cr-modelo-btn'); if(b) b.focus({ preventScroll: true });
  }
}
// Depois de mexer em conta, a pílula e o contador refletem o que está valendo
const _crCxAtualiza = () => { crConexoesPinta(); _crRotuloModelo(); crUsoPinta(); };
async function _crCxAcao(a, id, btn){
  if(a === 'oauth') return gProvOpenRouterEntrar();
  if(a === 'form'){ crConex.form = id; crConex.estado[id] = {}; crConexoesPinta(); const c = _crEl('cx-card-' + id); if(c){ c.scrollIntoView({ block: 'nearest', behavior: _crReduz() ? 'auto' : 'smooth' }); const i = c.querySelector('input'); if(i) i.focus({ preventScroll: true }); } return; }
  if(a === 'cancelar'){ crConex.form = null; return crConexoesPinta(); }
  if(a === 'usar'){ gProvUsa(id); return _crCxAtualiza(); }
  if(a === 'naousar'){ gProvUsa(null); return _crCxAtualiza(); }
  if(a === 'desconectar'){
    if(!(await gConfirm('Remover a conta ' + G_PROVEDORES[id].nome + ' deste navegador? A chave é apagada daqui; no provedor ela continua existindo.', { title: 'Desconectar', okLabel: 'Desconectar', cancelLabel: 'Manter', danger: true }))) return;
    gProvDesconecta(id); delete crConex.modelos[id]; crConex.estado[id] = {}; return _crCxAtualiza();
  }
  if(a === 'testar' || a === 'conectar'){
    const novo = a === 'conectar', key = novo ? ((_crEl('cx-key-' + id) || {}).value || '').trim() : undefined, base = novo ? ((_crEl('cx-base-' + id) || {}).value || '').trim() : undefined;
    if(novo && !key && !G_PROVEDORES[id].chaveOpcional){ crConex.estado[id] = { msg: 'Cole a chave para conectar.', tipo: 'erro' }; return crConexoesPinta(); }
    if(novo && G_PROVEDORES[id].risco && !(_crEl('cx-ciente-' + id) || {}).checked){ crConex.estado[id] = { msg: 'Marque que você entende o risco para a sua conta antes de conectar.', tipo: 'erro' }; return crConexoesPinta(); }
    if(btn){ btn.disabled = true; btn.classList.add('cr-carrega'); }
    const cfg = novo ? { key, ciente: !!G_PROVEDORES[id].risco, base: G_PROVEDORES[id].baseEditavel && base ? base.replace(/\/+$/, '') : G_PROVEDORES[id].base } : gProvConfig(id);
    const r = await gProvTesta(id, cfg);
    if(!r.ok){ crConex.estado[id] = { msg: r.motivo, tipo: 'erro' }; return crConexoesPinta(); }
    crConex.modelos[id] = r.modelos;
    if(novo){
      // Modelo de partida: um "flash"/"lite" (barato e rápido); senão o primeiro da lista. A pessoa troca no cartão.
      const ids = r.modelos.map(m => m.id), padrao = ids.find(x => /gemini.*flash/i.test(x)) || ids.find(x => /flash|lite|mini|haiku/i.test(x)) || ids[0] || '';
      gProvConecta(id, Object.assign({}, cfg, { modelo: padrao }), true); crConex.form = null;
      crConex.estado[id] = { msg: 'Conectado. ' + r.modelos.length + ' modelos disponíveis — confira o modelo escolhido.', tipo: 'ok' };
    }else crConex.estado[id] = { msg: 'Conexão ok · ' + r.modelos.length + ' modelos.', tipo: 'ok' };
    return _crCxAtualiza();
  }
}
document.addEventListener('click', e => {
  if(!_crNoCreative()) return;
  const b = e.target.closest('[data-cx]'); if(b){ e.preventDefault(); return _crCxAcao(b.dataset.cx, b.dataset.id, b); }
  if(e.target.id === 'cr-conex') crConexoes(false);   // clique no véu (fora do cartão)
});
document.addEventListener('change', e => {
  const i = e.target.closest && e.target.closest('[data-cx-modelo]'); if(!i) return;
  const v = i.value.trim(); if(!v) return;
  gProvConecta(i.dataset.cxModelo, { modelo: v }); _crRotuloModelo();
  const c = _crEl('cx-card-' + i.dataset.cxModelo); if(c){ const u = c.querySelector('[data-cx="usar"]'); if(u) u.disabled = false; }
});
// Voltou do "Entrar com OpenRouter"? A troca do código acontece no boot (gProvRetorno); aqui abre a tela
function crConexoesRetorno(){
  Promise.resolve(typeof gProvRetorno !== 'undefined' ? gProvRetorno : false).then(() => {
    let abrir = '', erro = '';
    try{ abrir = sessionStorage.getItem('luma_abrir_conexoes') || ''; erro = sessionStorage.getItem('luma_or_erro') || ''; sessionStorage.removeItem('luma_abrir_conexoes'); sessionStorage.removeItem('luma_or_erro'); }catch(e){}
    if(erro) gToast('A entrada pelo OpenRouter não completou. Tente de novo ou cole uma chave.', 'error');
    if(abrir){
      gProvEstado();   // adota a chave que veio do OpenRouter para este usuário
      crConexoes(true);
      if(gProvConectado('openrouter') && !(gProvConfig('openrouter') || {}).modelo) _crCxPadraoOpenRouter();
    }
  });
}
async function _crCxPadraoOpenRouter(){
  const r = await gProvTesta('openrouter');
  if(!r.ok){ crConex.estado.openrouter = { msg: r.motivo, tipo: 'erro' }; return crConexoesPinta(); }
  crConex.modelos.openrouter = r.modelos;
  const ids = r.modelos.map(m => m.id), padrao = ids.find(x => /gemini.*flash/i.test(x)) || ids.find(x => /flash|mini|haiku/i.test(x)) || ids[0] || '';
  gProvConecta('openrouter', { modelo: padrao }, true);
  crConex.estado.openrouter = { msg: 'Conectado pelo OpenRouter. Confira o modelo escolhido.', tipo: 'ok' };
  _crCxAtualiza();
}

function crEnviar(e){
  if(e && e.preventDefault) e.preventDefault();
  // o botão vira "parar" durante a geração; Enter nunca chega aqui nesse estado (crTecla)
  if(crState.rodando){ if(e && e.type === 'submit' && !_crResponde()) crParar(); return; }
  const inp = _crEl('cr-pedido'), conv = _crEl('cr-conversa');
  const pedido = String((inp && inp.value) || '').trim();
  if(!pedido || !conv) return;
  _crMenuFmt(false); _crMenuModelo(false);
  if(crUsoSemSaldo()){ const av = _crEl('cr-limite'); if(av){ av.classList.remove('bate'); void av.offsetWidth; av.classList.add('bate'); } return; }   // o aviso já está na tela: pulsa em vez de repetir em toast
  // Imagem anexada com "referência / nessa pegada / parecido" é REFERÊNCIA para o designer, não a foto da arte
  const ehRef = !!crState.anexo && /refer[eê]ncia|pegada|parecid|inspira|nesse estilo|nesse jeito/i.test(pedido);
  // O que a pessoa ESCREVEU vence o compositor: "story" no texto ganha do formato marcado no menu
  const fio = { pedido, fmt: _crFormatoDito(pedido) || crState.fmt || 'feed', fmtMenu: crState.fmt, marca: _crMarcaDita(pedido) || crState.much ? 'much' : 'dm', foto: ehRef ? null : crState.anexo, ref: ehRef ? crState.anexo : null, briefing: null, conteudo: null, legenda: null, mostradas: [], viaIA: false };
  crState.fios.push(fio);
  if(!crSess.id){ crSess.id = gUuid(); crSess.criada = Date.now(); }
  inp.value = ''; crAutoAltura(inp); crTirarAnexo();
  // A tela de boas-vindas recolhe (altura real, não some de repente) e "Nova arte" acende
  const v = _crEl('view-creative'); if(v) v.classList.add('cr-conversando');
  _crNovaHab(true);
  conv.appendChild(_crBolhaEu(fio));
  _crRola(true);
  // Pedido de TEXTO (copy, legenda, roteiro…) vai para o copywriter (js/creative/copy.js), não para o diagramador
  if(typeof crEhCopy === 'function' && crEhCopy(pedido)){ fio.copy = {}; return crCopy(fio, conv); }
  // Do 2º pedido em diante o harness lê o contexto do chat e decide: modificar a arte de cima, nova, texto ou conversa (harness.js)
  if(typeof crDespachar === 'function') return crDespachar(fio, conv);
  crGerar(fio, conv);
}
// Recomeça do zero: a conversa atual já fica guardada como sessão (dá para reabrir em "Sessões"), então não precisa confirmar
async function crNova(){
  const conv = _crEl('cr-conversa'); if(!conv || !crState.fios.length) return;
  crParar();
  crState.rodando = null; _crOcupado(false);
  const guardou = await crSessSalva(true);
  await _crLimpaConversa();
  crState.fios = []; crState.fmt = null; crSess.id = null; crSess.criada = 0; crTirarAnexo(); crLigaMuch(false); _crRotuloFmt();
  const v = _crEl('view-creative'); if(v) v.classList.remove('cr-conversando', 'cr-rolou');
  _crNovaHab(false);
  const p = _crEl('cr-palco'); if(p) p.scrollTo({ top: 0 });
  const i = _crEl('cr-pedido'); if(i) i.focus({ preventScroll: true });
  crFaixaPinta(); crSessPinta();
  if(guardou) gToast('Sessão guardada');
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
  let esq = null, p = null;   // p = passo em andamento (se o erro estourar, ele vira vermelho)
  // esqueleto das opções: ocupa o lugar exato da entrega enquanto o motor diagrama
  let consumiu = false, entregou = false;
  const lista = document.createElement('ul'); lista.className = 'cr-passos';
  corpo.appendChild(lista);
  let status = _crStatus(corpo);
  // acao: botão de saída ("Editar pedido" devolve o texto ao campo; "Tentar de novo" roda o mesmo pedido) — aviso sem saída é beco
  const aviso = (txt, acao, erro) => {
    const b = document.createElement('div'); b.className = 'cr-bolha cr-interrompido' + (erro ? ' cr-erro' : ''); b.textContent = txt;
    if(acao){ const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'cr-btn cr-btn-mini cr-aviso-ac'; bt.textContent = acao.rotulo; bt.onclick = () => { bt.disabled = true; if(erro) b.remove(); acao.fn(); }; b.appendChild(bt); }
    corpo.appendChild(b); _crRola();
  };
  const editarPedido = { rotulo: 'Editar pedido', fn: () => { const i = _crEl('cr-pedido'); if(i && !i.value.trim()){ i.value = fio.pedido; crAutoAltura(i); _crPodeEnviar(); } if(i) i.focus(); } };
  const parou = () => {
    if(!run.parado) return false;
    status.parar(); aviso('Interrompido.', editarPedido); _crFocaCampo();
    return true;
  };
  try{
    // Uso do dia: conta ANTES de gastar IA; o que não chegar à entrega é estornado no finally
    const prov = typeof gProvAtivo === 'function' ? gProvAtivo() : null;   // conta própria: o custo é dela, não conta no limite
    const modelo = prov ? 'conta:' + prov.id + ':' + prov.modelo : crModelo(), uso = (prov || fio._pago) ? { ok: true } : await crUsoConsome(modelo);   // _pago: o roteador do chat já abriu a janela e gastou
    fio._pago = false;
    if(!uso.ok){
      status.parar();
      aviso(crUsoMsg(modelo) || 'Não foi possível contar esta arte agora. Tente de novo.');
      return;
    }
    consumiu = !prov; crState.modeloRun = prov ? null : modelo; crState.provRun = prov;
    if(parou()) return;
    const modifica = fio.modo === 'modificar';   // harness: altera a arte de cima — conteúdo já pronto, sem briefing nem copy
    if(modifica){ fio.legenda = null; fio.legProm = CR_FORMATOS[fio.fmt].social === false ? Promise.resolve([]) : crLegenda(Object.assign(crNormaliza(fio.conteudo), { pedido: fio.pedido })); }
    if(!outras && !modifica){
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
        if(!resp || run.parado){ fio.briefing = null; aviso('Interrompido.', editarPedido); return; }
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
      if(fio.viaIA){
        // a IA leu a fala como título, ou deixou o botão vazio num evento da cidade: vale a leitura local da intenção
        const loc = crLerPedido(fio.pedido, fio.fmt);
        if(_crPareceFala(bruto.titulo, fio.pedido) && loc.titulo) bruto.titulo = loc.titulo;
        if(bruto.objetivo === 'evento' && !bruto.cta && loc.semCta) bruto.semCta = true;
      }
      // nada de dado que a pessoa não deu (data, preço, código, "só hoje"…), venha da IA ou de onde vier
      const trava = crSoDado(bruto, [fio.pedido].concat((fio.briefing || []).filter(r => !r.pulou).map(r => (r.resposta || '') + ' ' + (r.valor || ''))).join(' '));
      bruto = trava.sp; fio.tirou = trava.tirou;
      bruto.formato = fio.fmt;
      bruto.marca = fio.marca;
      bruto.foto = fio.foto || '';
      if(parou()) return;
      fio.conteudo = bruto;
      const sp0 = crNormaliza(bruto);
      p.feito([sp0.palavra, sp0.titulo].filter(Boolean).join(' ') + (sp0.precoPor ? ' · R$ ' + sp0.precoPor : '') + (fio.tirou && fio.tirou.length ? ' · tirei o que o pedido não disse (' + fio.tirou.map(k => CR_CAMPO_DITO[k] || k).join(', ') + ')' : '') + (fio.viaIA ? ' · IA' : ' · motor local' + (prov && typeof gProvUltimoErro === 'string' && gProvUltimoErro ? ' — ' + gProvUltimoErro : '')));
      // a legenda corre em paralelo e chega junto — só para post (inapp, banner, email, capa e slide não têm)
      fio.legProm = CR_FORMATOS[sp0.formato].social === false ? Promise.resolve([]) : crLegenda(Object.assign(sp0, { pedido: fio.pedido }));
    }

    // 3) Diagramação: a busca (frente 2) percorre as famílias que servem e os parâmetros de cada
    // uma, em fatias (a tela não congela), e fica com o que tem a melhor nota de design
    p = _crPasso(lista, modifica ? 'Aplicando a mudança na arte' : outras ? 'Buscando outros caminhos' : 'Buscando a melhor composição');
    esq = _crEsqueleto(fio.fmt); msg.after(esq);
    // enquanto a arte carrega, as opções do esqueleto já viram pranchetas: o making-of começa aqui
    if(typeof crMakingOfPrancheta === 'function') esq._mk = [...esq.querySelectorAll('.cr-op-arte')].map(a => crMakingOfPrancheta(a, _crMkOpcoes(fio.fmt, (fio.conteudo && fio.conteudo.marca) || fio.marca)));
    msg.scrollIntoView({ block: 'start', behavior: _crReduz() ? 'auto' : 'smooth' });   // o esqueleto é alto: o que fica à vista é o progresso (msg), não o fim da página
    await crFontesProntas();
    // Cada rodada de "Outras opções" muda a semente e exclui as assinaturas já mostradas
    fio.rodada = (fio.rodada || 0) + (outras ? 1 : 0);
    const busca = await crBuscar(fio.conteudo, { rodada: fio.rodada, parar: () => run.parado });
    if(parou()) return;
    const cands = busca.cands;
    p.feito(busca.avaliacoes + ' composições avaliadas em ' + busca.ms + ' ms · ' + cands.filter(c => !c.avaliacao.erros.length).length + ' aprovadas nas regras da marca');
    // A IA compõe como designer (skill §4.2): CR_OPCOES composições próprias; o motor completa o que faltar
    let ia = [];
    // Modificar: se a opção de base era composição da IA, o MESMO desenho é redesenhado com o conteúdo novo (mesma composição, outro tema/texto)
    if(modifica && fio.base && fio.base.desenho && typeof fio.base.desenho === 'object'){
      try{ const r = crDesenhar(crNormaliza(fio.conteudo), fio.base.desenho, 0); r.avaliacao = crAvaliar(r); if(!r.avaliacao.erros.length){ r.nota = crNota(r, r.avaliacao); ia = [r]; } }catch(err){ ia = []; }
    }
    if(!modifica && !CR_FORMATOS[fio.fmt].fixo && _crIaPronta()){
      p = _crPasso(lista, 'Compondo como designer');
      const pedidas0 = crMetricas.pedidas;
      try{ ia = await crDesenhos(crNormaliza(fio.conteudo), CR_OPCOES, fio.ideias || [], fio.ref); }catch(err){ ia = []; }
      if(parou()) return;
      fio.ideias = (fio.ideias || []).concat(ia.map(r => r.nomeReceita));
      p.feito(ia.length ? ia.map(r => r.nomeReceita).join(' · ') : _crPorqueSemIA(pedidas0, 'compor'), !ia.length);
    }
    // Modificar: a 1ª opção mantém a composição (família) da que estava escolhida; as outras variam
    const baseRec = modifica && fio.base ? fio.base.receita : null;
    const igual = modifica && !ia.length && baseRec ? cands.find(c => c.receita === baseRec && !c.avaliacao.erros.length) : null;
    const fixas = ia.concat(igual ? [igual] : []);
    let tres = fixas.concat(crEscolher3(cands, fio.mostradas.concat(fio.assinaturas || [])).filter(c => !fixas.includes(c) && c.receita !== baseRec)).slice(0, CR_OPCOES);
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
    }else p.feito(_crPorqueSemIA(null, 'revisar'));
    fio.mostradas.push(...tres.map(r => r.receita));
    fio.assinaturas = (fio.assinaturas || []).concat(tres.map(r => r.design && r.design.sinais ? r.design.sinais.txt : '').filter(Boolean));
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
    if(parou()) return;
    await _crDigita(fala, modifica ? 'Ajustei a arte de cima (' + (fio.resumoMud || 'mudança pedida') + '). A primeira opção mantém a composição que você tinha escolhido; ' + (opcoes.length > 2 ? 'as outras são variações.' : 'a outra é uma variação.') : (outras && fio.entregas && fio.entregas.length) ? 'Mais ' + opcoes.length + (opcoes.length > 1 ? ' caminhos, de famílias diferentes' : ' caminho, de família diferente') + ' das anteriores.'
      : ((fio.viaIA && opcoes[0].spec.resumo) ? opcoes[0].spec.resumo + ' ' : '') + 'Separei ' + opcoes.length + (opcoes.length > 1 ? ' opções' : ' opção') + ' em ' + f.nome.toLowerCase() + ': escolha uma, ajuste no editor se quiser e baixe.');
    // (Esc aqui não descarta mais: a arte já existe e o saldo já foi gasto — entrega)
    const ent = _crEntrega(fio, opcoes);
    // a pessoa estava no fim? então a entrega (o destino) sobe até o topo da tela dela
    const seguia = (() => { const pl = _crEl('cr-palco'); return !pl || pl.scrollHeight - pl.scrollTop - pl.clientHeight < 200; })();
    const de = esq && esq._mk ? esq._mk.map(h => h.estado()) : true;   // onde a prancheta de cada opção parou
    if(esq && esq._mk) esq._mk.forEach(h => h.parar());
    if(esq && esq.isConnected) esq.replaceWith(ent); else conv.appendChild(ent);
    esq = null;
    (fio.entregas = fio.entregas || []).push(opcoes);
    entregou = true; crUsoConfirma();
    _crMostra(ent, de);
    _crResumo(corpo, lista, t0);
    crFaixaPinta(); crSessSalva();
    if(seguia) requestAnimationFrame(() => {
      // Entrega alta (story em notebook): começa nas ARTES — o cabeçalho "Sua arte" cede o espaço, para o nome da opção e as ações caberem no primeiro quadro
      const p = _crEl('cr-palco'), ops = ent.querySelector('.cr-ops'), ac = ent.querySelector('.cr-acoes');
      const cabe = p && ops && ac && ops.getBoundingClientRect().bottom + 20 + ac.offsetHeight - ent.getBoundingClientRect().top + 24 <= p.clientHeight - 48;   // (as ações são sticky: o bottom delas mente, mede-se pelo fim das artes)
      (cabe || !ops ? ent : ops).scrollIntoView({ block: 'start', behavior: _crReduz() ? 'auto' : 'smooth' });
    });
    if(typeof gTrackEvent === 'function') try{ gTrackEvent('creative_arte', { objetivo: opcoes[0].spec.objetivo, formato: opcoes[0].spec.formato, marca: opcoes[0].spec.marca, ia: fio.viaIA, juiz: !!juiz, foto: !!fio.foto, ref: !!fio.ref, modelo: prov ? 'conta:' + prov.id : modelo, custo: prov ? 0 : crCusto(modelo),
      receitas: opcoes.map(o => o.receita).join(','), designer: Object.assign({}, crMetricas), notas: juiz ? opcoes.map(o => o.juiz ? +o.juiz.nota.toFixed(1) : null).join(',') : '' }); }catch(err){}
  }catch(err){
    console.error('[creative]', err);
    status.parar();
    if(p && p.ativo && p.ativo()){ p.feito('falhou aqui', true); p.li.classList.add('cr-falhou'); }
    _crFocaCampo();
    const marca = /regras da marca/i.test((err && err.message) || '');
    aviso(marca ? 'Esse pedido não encaixou nas regras da marca. Mude o formato ou o texto e tente de novo.' : 'Não consegui compor a arte agora.',
      marca ? editarPedido : { rotulo: 'Tentar de novo', fn: () => { if(!crState.rodando) crGerar(fio, conv, outras || !!fio.conteudo); } }, true);   // com a copy pronta não pergunta tudo de novo
  }finally{
    if(consumiu && !entregou) crUsoEstorna();
    crState.modeloRun = null; crState.provRun = null;
    if(esq){ (esq._mk || []).forEach(h => h.parar()); esq.remove(); }
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
    + '<div class="cr-ops' + (w > h * 1.2 ? ' cr-ops-deitadas' : '') + '" style="--ar:' + (w / h).toFixed(4) + '">'
    + Array.from({ length: CR_OPCOES }, (_, i) => '<div class="cr-op" style="--i:' + i + '"><span class="cr-op-arte cr-esq-arte" style="aspect-ratio:' + w + '/' + h + '"></span><span class="cr-esq-l" style="width:' + (96 + i * 18) + 'px"></span></div>').join('') + '</div>';
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
   ENTREGA — as CR_OPCOES opções lado a lado, a escolhida em destaque, uma legenda diagramada e as ações.
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
  el.dataset.pedido = String(fio.pedido || '').slice(0, 80);
  const f = CR_FORMATOS[ops[0].spec.formato];
  let sel = 0;
  const rotulo = (o, i) => '<span class="cr-op-rot"><b>' + (i + 1) + '</b><span title="' + gEsc(o.nomeReceita) + '">' + gEsc(o.nomeReceita) + '</span>' + (o.editada ? '<em>editada</em>' : '') + _crMedidor(o) + '</span>';
  const postavel = typeof fOpenPosted === 'function' && CR_FORMATOS[ops[0].spec.formato].social !== false && !!fPostedContextForFormat({ material: { w: ops[0].w, h: ops[0].h } });
  el.innerHTML = '<header class="cr-ent-cab"><div><h3>Sua arte</h3><p>' + ops.length + (ops.length > 1 ? ' opções' : ' opção') + ' · ' + gEsc(f.nome) + ' ' + gEsc(f.desc.split(',')[0]) + '</p></div>'
    + '<span class="cr-ent-selo"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>' + (ops[0].juiz ? 'Revisada pela IA' : 'Conferida nas regras da marca') + '</span></header>'
    + '<div class="cr-ops' + (ops[0].w > ops[0].h * 1.2 ? ' cr-ops-deitadas' : '') + '" style="--ar:' + (ops[0].w / ops[0].h).toFixed(4) + '" role="radiogroup" aria-label="Opções de arte">'
    + ops.map((o, i) => '<button type="button" class="cr-op' + (i ? '' : ' on') + '" role="radio" aria-checked="' + (i ? 'false' : 'true') + '" data-i="' + i + '">'
      + '<span class="cr-op-arte"' + (CR_FORMATOS[o.spec.formato].laminas ? ' data-laminas="' + CR_FORMATOS[o.spec.formato].laminas + '"' : '') + ' style="aspect-ratio:' + o.w + '/' + o.h + '"><img alt="Opção ' + (i + 1) + ': ' + gEsc(o.nomeReceita) + '" src="' + o.url + '">' + _crDetalheNota(o) + '<span class="cr-op-ok" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span></span>'
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
    sel = i; fio.escolha = i;   // o harness do chat (harness.js) lê qual opção está escolhida
    botoes().forEach((b, j) => { b.classList.toggle('on', j === i); b.setAttribute('aria-checked', j === i ? 'true' : 'false'); });
    if(el.isConnected) crFaixaPinta();
  };
  botoes().forEach((b, i) => {
    const img = b.querySelector('img');
    // a arte aparece ao carregar — a não ser que o making-of esteja desenhando por cima (ele a mostra no fim)
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
      crFaixaPinta(); crSessSalva();
    });
  };
  // O making-of (js/creative/making-of.js) faz TODAS as opções ao mesmo tempo, cada uma por cima da sua
  // <img>, continuando a prancheta que o esqueleto começou (de[i]); a <img> só reaparece no fim — o arquivo
  // baixado é sempre ela. Não é player: sem botão; clicar numa arte ou Esc pulam todas.
  let mk = null;
  const pula = () => { if(mk) mk.forEach(h => h.pular()); };
  const faz = de => {
    if(typeof crMakingOf !== 'function' || _crReduz()) return false;
    const tocam = botoes().map((b, i) => {
      const arte = b.querySelector('.cr-op-arte');
      if(!arte || !ops[i].svgFinal) return null;
      const h = crMakingOf(arte, ops[i].svgFinal, Object.assign(_crMkOpcoes(ops[i].spec.formato, ops[i].spec.marca), { de: de && de[i], semente: 20261015 + i }));
      if(!h.ativo) return null;
      b.dataset.mont = '1'; b.classList.remove('cr-nitida');
      h.pronto.then(() => { delete b.dataset.mont; b.classList.add('cr-nitida'); });
      return h;
    }).filter(Boolean);
    if(!tocam.length) return false;
    const eu = mk = tocam, esc = e => { if(e.key === 'Escape') pula(); };
    document.addEventListener('keydown', esc);
    Promise.all(tocam.map(h => h.pronto)).then(() => { document.removeEventListener('keydown', esc); if(mk === eu) mk = null; });
    return true;
  };
  el.addEventListener('keydown', e => { if(/^[1-3]$/.test(e.key) && e.target.closest('.cr-ops')) escolhe(Math.min(ops.length, +e.key) - 1); });
  el.addEventListener('click', ev => {
    const b = ev.target.closest('button'); if(!b) return;
    if(b.classList.contains('cr-op')) return mk ? pula() : escolhe(+b.dataset.i);
    if(b.dataset.acao === 'png'){ crAprende(ops[sel], 'baixou'); return crBaixarPNG(ops[sel], b); }
    if(b.dataset.acao === 'editar') return abre(sel);
    if(b.dataset.acao === 'postado') return crVerPostado(ops[sel], fio);
    if(b.dataset.acao === 'outras') return crOutrasOpcoes(fio);
    if(b.dataset.acao === 'copiar') return crCopiar(fio.legenda, b);
  });
  el._ops = ops; el._faz = faz;
  return el;
}

// ── Nota do juiz como medidor: anel que enche até a nota (de 5) e, no hover, o boletim das 5 réguas
const CR_REGUAS = { foco: 'Foco', hierarquia: 'Hierarquia', respiro: 'Respiro', contraste: 'Contraste', acabamento: 'Acabamento' };
const _crNota = n => n.toFixed(1).replace('.', ',');
function _crMedidor(o){
  if(!o.juiz || o.editada) return '';   // editou: a nota era da diagramação original
  const n = o.juiz.nota;
  return '<span class="cr-medidor ' + (n >= 4 ? 'alta' : n >= 3 ? 'media' : 'baixa') + '" role="img" aria-label="Nota da revisão: ' + _crNota(n) + ' de 5" style="--n:' + (n / 5).toFixed(3) + '" data-nota="' + n + '">'
    + '<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="cr-med-fundo" cx="12" cy="12" r="9.5"/><circle class="cr-med-arco" cx="12" cy="12" r="9.5" pathLength="100"/></svg><span class="cr-med-n">' + _crNota(0) + '</span><span class="cr-med-de" aria-hidden="true">/5</span></span>';
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

/* ── A entrega aparece: em toda geração ao vivo as opções se fazem sozinhas, todas ao mesmo tempo, continuando a
   prancheta que o esqueleto começou enquanto a arte carregava (de = o estado de cada uma). Sessão reaberta:
   tudo pronto, sem making-of (a <img> aparece ao carregar). As notas contam nos dois casos. ── */
// As fontes do app dentro do shadow root do making-of (o @font-face embutido no SVG não vale lá dentro)
const CR_MONT_CSS = 'svg .hero{font-family:"LC Realce","Realce",sans-serif}svg .sup,svg .body,svg .legal,svg .leve,svg .forte{font-family:"LC Roboto","Roboto",sans-serif}';
// Blocos que entram pela Biblioteca mesmo tendo texto dentro (o rótulo da foto, o @ das redes…)
const CR_MK_IMAGENS = ['logo', 'logoLoja', 'foto', 'mockup', 'decor', 'redes'];
// O que o making-of precisa saber do formato e da marca: a cor do fundo e as margens (as guias da prancheta)
function _crMkOpcoes(fmt, marca){
  const a = crArea(fmt);
  return { css: CR_MONT_CSS, nomes: CR_NOME_BLOCO, autor: 'Luma', imagens: CR_MK_IMAGENS, fundo: marca === 'much' ? CR_C.rosa : CR_C.laranja,
    guias: { x: [a.M / a.W, 1 - a.M / a.W], y: [(a.top || a.seguroTopo || a.M) / a.H, (a.base || a.seguroBase || a.H - a.M) / a.H] } };
}
function _crMostra(el, de){
  if(de && el._faz && el._faz(Array.isArray(de) ? de : null)) el.classList.add('cr-segue');
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
  const origem = document.activeElement;
  modal.classList.add('open', 'cr-postado'); modal.setAttribute('aria-hidden', 'false');
  _fPostedPaint();
  setTimeout(() => { const x = modal.querySelector('.posted-close'); if(x) x.focus({ preventScroll: true }); }, 60);
  document.addEventListener('keydown', _fPostedKey, true);
  const olha = new MutationObserver(() => {
    if(modal.getAttribute('aria-hidden') !== 'true') return;
    olha.disconnect(); fState.material = antes; _crLegendaVer = ''; modal.classList.remove('cr-postado');
    if(origem && origem.focus) origem.focus({ preventScroll: true });
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
  const origem = document.activeElement;   // o foco volta para quem abriu o editor
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
  /* Barra flutuante sobre o bloco selecionado (como no Figma): as ações que mais se repetem sem
     ir ao painel. Os botões são os mesmos do painel (data-ed → acao()), então nada se duplica. */
  const mesa = ed.querySelector('.cr-ed-mesa'), flut = document.createElement('div');
  flut.className = 'cr-ed-flut'; flut.hidden = true; flut.setAttribute('role', 'toolbar'); flut.setAttribute('aria-label', 'Ações do bloco');
  flut.innerHTML = bt('alEsq', CR_ICO.alEsq, 'Na margem esquerda') + bt('alCentro', CR_ICO.alCentro, 'No centro') + bt('alDir', CR_ICO.alDir, 'Na margem direita')
    + '<i aria-hidden="true"></i>' + bt('menos', CR_ICO.menos, 'Diminuir o bloco') + bt('mais', CR_ICO.mais, 'Aumentar o bloco')
    + '<i aria-hidden="true"></i>' + bt('frente', CR_ICO.frente, 'Trazer para a frente') + bt('tras', CR_ICO.tras, 'Enviar para trás')
    + '<i aria-hidden="true"></i>' + bt('ocultar', CR_ICO.olho, 'Ocultar') + bt('remover', CR_ICO.lixo, 'Remover (Delete)');
  mesa.appendChild(flut);
  const W = op.w, H = op.h, M = crArea(op.spec.formato).M, hist = [], fut = [];
  let atual = null, enquadrar = false, mexeu = false, descarta = false;
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
    flutua();
  }
  // Acima do bloco (centrada, presa à mesa); sem espaço em cima, desce para baixo dele
  function flutua(){
    if(!atual || caixa.hidden){ flut.hidden = true; return; }
    const sr = caixa.getBoundingClientRect(), mr = mesa.getBoundingClientRect();
    flut.hidden = false;
    const w = flut.offsetWidth, h = flut.offsetHeight;
    let x = sr.left + sr.width / 2 - w / 2 - mr.left, y = sr.top - mr.top - h - 32;   // 32: passa por cima da etiqueta com o nome do bloco
    if(y < 8) y = sr.bottom - mr.top + 12;
    x = Math.max(8, Math.min(mr.width - w - 8, x)); y = Math.max(8, Math.min(mr.height - h - 8, y));
    flut.style.translate = Math.round(x) + 'px ' + Math.round(y) + 'px';
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
    requestAnimationFrame(() => {
      props.querySelectorAll('textarea').forEach(t => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; });   // texto longo não nasce cortado
      if(document.activeElement === document.body && ed.isConnected) host.focus({ preventScroll: true });
    });   // redesenhar o painel não pode derrubar o foco (Esc deixaria de funcionar)
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
      if(!andou){ try{ host.setPointerCapture(e.pointerId); }catch(err){} ed.classList.add('cr-mexendo'); }
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
      guiaV.hidden = guiaH.hidden = true; ed.classList.remove('cr-mexendo');
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
    if(e.key === 'Escape' && !atual){ e.stopPropagation(); return acao('cancelar'); }
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
    if(a === 'cancelar'){
      if(mexeu && !descarta){
        descarta = true;
        const bt = b || ed.querySelector('[data-ed="cancelar"]'); const txt = bt && bt.textContent;
        if(bt) bt.textContent = 'Descartar alterações?';
        setTimeout(() => { descarta = false; if(bt && txt) bt.textContent = txt; }, 4000); return;
      }
      return fechar(null);
    }
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
    if(a === 'menos' || a === 'mais'){
      guarda();
      const e = estado(g); e.s = Math.max(0.4, Math.min(2.5, e.s + (a === 'mais' ? 0.08 : -0.08)));
      aplica(g, e); return painel();
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
    if(b && !b.disabled){
      acao(b.dataset.ed, b);
      if(b.closest('.cr-ed-flut')) host.focus({ preventScroll: true });   // Delete/setas seguem valendo no bloco
    }
  });
  const reposiciona = () => marca();
  window.addEventListener('resize', reposiciona, { passive: true });
  function fechar(nova){
    window.removeEventListener('resize', reposiciona);
    ed.classList.remove('aberto');
    setTimeout(() => ed.remove(), _crReduz() ? 0 : 220);
    if(origem && origem.isConnected && origem.focus) origem.focus({ preventScroll: true });
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
      a.download = 'luma-creative-' + v.spec.objetivo + '-' + String(v.nomeReceita || v.receita).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + '-' + v.spec.formato + '.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      _crOk(btn, 'Baixado'); gToast('PNG baixado', 'success');
    }, 'image/png');
  };
  im.onerror = () => { if(btn) btn.disabled = false; gToast('Não foi possível gerar o PNG', 'error'); };
  im.src = v.url;
}
