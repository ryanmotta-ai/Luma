/**
 * js/creative/composicoes.js
 *
 * As composições do dia a dia do franqueado (frente 4, 15/10/2026) — desenhadas uma a uma, cada
 * uma especialista de UM formato (nada de "serve a todos" com adaptação). O motor continua sem IA:
 * a composição é uma gramática determinística que devolve as CAIXAS dos blocos (+ zonas de cor e
 * grafismos do inventário CR_DECOR); quem desenha é o crDesenhar (o mesmo renderizador da IA
 * designer), quem confere é o crAvaliar, quem mede é a nota de design e quem acha os melhores
 * parâmetros é a busca (frente 2). Carregado depois de creative.js.
 *
 * Registro: crComposicao({ id, nome, uso, grupo (A–G), formato, objetivos, foto (true/false/null),
 *   aceita (blocos de conteúdo que ela sabe pôr), textos (limite de caracteres por campo — acima
 *   disso ela recusa e outra composição cobre), tema (só serve quando o pedido é daquele uso),
 *   busca (parâmetros e limites), casos (pedidos do banco tests/creative-banco.js que a ilustram),
 *   comp(sp, a, p) → { ideia, zonas, blocos, grafismos } ou null quando não cabe }.
 * Catálogo: docs/CATALOGO-COMPOSICOES.md (gerado por scripts/catalogo-composicoes.js).
 * Galeria: tests/_galeria-composicoes.html (ferramenta, fora do portão).
 */

/* ── Medidas na MESMA régua do crDesenhar: a caixa que a composição pede é a caixa que ele preenche ── */
// Título: o lockup que o crDesenhar vai desenhar com { max, linhas, iguala } nesta largura
function _ccTitulo(sp, a, w, max, o){
  const t = crConteudoBlocos(sp).titulo;
  if(!t) return null;
  const op = Object.assign({ larg: w, max, min: a.heroiMin, linhas: 3 }, o || {}), q = crLockup(t, op);
  if(q.zMin < a.heroiMin) return null;   // não cabe nesta coluna sem ficar abaixo do piso: outra composição cobre
  return { bloco: 'titulo', w, h: Math.ceil(q.h) + 2, max, linhas: op.linhas, iguala: !!op.iguala, size: q.size, q };
}
const _ccApoio = (sp, w, max) => sp.apoio ? { bloco: 'apoio', w, h: Math.ceil(crTextoLinhas(sp.apoio, 'body', max || 44, w, 32).h) + 6, max: max || 44 } : null;
const _ccLegal = (sp, w) => sp.legal ? { bloco: 'legal', w, h: Math.ceil(crTextoLinhas(sp.legal, 'legal', 28, w, 22).h) + 6 } : null;
const _ccTag = (sp, z) => sp.topo ? { bloco: 'tag', w: Math.max((z || 40) * 1.6 + crMede(sp.topo, 'hero', z || 40), 0), h: Math.round((z || 40) * 1.75), max: z || 40 } : null;
const _ccCta = (sp, a) => sp.cta && a.fmt !== 'inapp' ? { bloco: 'cta', w: crBotaoMede(sp.cta), h: 96 } : null;
const _ccLogo = a => ({ bloco: 'logo', w: a.story ? 300 : 260, h: a.story ? 60 : 52 });
// Preço: altura para um corpo pedido (big) e largura; com placa (card branco) soma o respiro do card
function _ccPreco(sp, w, big, placa){
  if(!sp.precoPor) return null;
  const pad = placa ? 44 : 0, pm = crPrecoMede(sp.precoPor, w - 2 * pad, big);
  return { bloco: 'preco', w, h: Math.ceil(2 * pad + (sp.precoDe ? 61 : 0) + 44 + pm.big * 0.73 + (placa ? 8 : 2)), max: pm.big, placa: placa ? 'branco' : '', larg: pm.w + 2 * pad };
}
const _ccSelo = (sp, r) => sp.selo.length && sp.objetivo !== 'cupom' ? { bloco: 'selo', w: 2 * r, h: 2 * r, max: r } : null;

/* Empilha caixas numa coluna (x, w) de y0 a y1. Cada item: { b (a caixa), vao (antes dele), grupo }.
   dist: 'topo' (sobra embaixo) · 'centro' · 'base' · 'espalha' (sobra dividida nos vãos ENTRE grupos)
   · 'ancora' (a sobra fica antes do item marcado `ancora` — a ação desce até a base). null se não cabe. */
function _ccPilha(itens, x, y0, y1, dist, al){
  const xs = itens.filter(i => i && i.b);
  if(!xs.length) return [];
  xs[0].vao = 0;
  const tot = xs.reduce((s, i) => s + i.b.h + (i.vao || 0), 0);
  let sobra = (y1 - y0) - tot;
  if(sobra < -1) return null;
  sobra = Math.max(0, sobra);
  let y = y0;
  if(dist === 'centro') y += sobra / 2;
  else if(dist === 'base') y += sobra;
  const entre = xs.filter((i, k) => k && i.grupo !== xs[k - 1].grupo), alvo = xs.find(i => i.ancora);
  return xs.map((i, k) => {
    if(k){
      y += i.vao || 0;
      if(dist === 'espalha' && entre.indexOf(i) >= 0) y += sobra / entre.length;
      if(dist === 'ancora' && i === alvo) y += sobra;
    }
    const w = i.b.w, bx = al === 'centro' ? x - w / 2 : al === 'dir' ? x - w : x;
    const out = Object.assign({}, i.b, { x: Math.round(bx), y: Math.round(y), alinhar: al || 'esq' });
    y += i.b.h;
    return out;
  });
}
// Limpa as caixas para o crDesenhar (tira o que é só medida)
const _ccBlocos = bs => bs.filter(Boolean).map(b => { const o = Object.assign({}, b); delete o.q; delete o.size; delete o.larg; return o; });

// Grafismo num canto livre (td, te, bd, be), sangrando: diminui até não encostar em nenhum bloco —
// grafismo nunca passa atrás de texto (§3.1). null = o canto não tem espaço (a peça fica sem ele).
function _ccCanto(bs, a, sp, asset, canto, w0, rot){
  const d = CR_DECOR[asset];
  if(!d || !_crDoInv(asset, sp)) return null;
  const folga = 18 + Math.abs(rot || 0) * 2;
  for(let w = Math.min(w0, d.max); w >= 110; w = Math.round(w * 0.88)){
    const h = w * d.h / d.w, x = canto[1] === 'd' ? a.W - w * 0.66 : -w * 0.34, y = canto[0] === 't' ? -h * 0.34 : a.H - h * 0.66;
    const bate = bs.some(b => b && b.bloco !== 'foto' && x - folga < b.x + b.w && x + w + folga > b.x && y - folga < b.y + b.h && y + h + folga > b.y);
    if(!bate) return { asset, x: Math.round(x), y: Math.round(y), w, rot: rot || 0 };
  }
  return null;
}

/* ── Registro ── */
const CR_COMPOSICOES = [];
function crComposicao(def){
  const lim = def.textos || {}, aceita = new Set(['logo'].concat(def.aceita || []));
  const rec = Object.assign({}, def, {
    formatos: [def.formato], comp: def.comp,
    // serve: o conteúdo cabe nos limites da composição, ela sabe pôr todos os blocos, e o tema bate
    serve: sp => {
      if(def.tema && !def.tema.some(t => (sp.tema || []).indexOf(t) >= 0)) return false;
      if(Object.keys(lim).some(k => String(sp[k] || '').length > lim[k])) return false;
      const tem = crConteudoBlocos(def.lista ? Object.assign({}, sp, { listar: true }) : sp);
      if(Object.keys(tem).some(k => !aceita.has(k) && !(k === 'cta' && def.formato === 'inapp'))) return false;
      return !def.serve || def.serve(sp);
    }
  });
  CR_COMPOSICOES.push(rec);
  CR_RECEITAS.push(rec);
  if(!CR_FORMATOS[def.formato].deitado) def.objetivos.forEach(o => { (CR_SERVE[o] = CR_SERVE[o] || []).push(def.id); });
  return rec;
}

/* ══════════════════════════════════════════════════════════════
   LOTE 1 — A · prato e oferta do dia
══════════════════════════════════════════════════════════════ */

// F1 · Feed · a foto sangra pela direita da peça inteira; o texto mora numa coluna à esquerda, com o
// preço num card branco preso na borda da foto (ou na coluna). A foto faz o peso, o preço faz o foco.
crComposicao({ id: 'pratoDoDiaLado', nome: 'Foto sangrando à direita', grupo: 'A', formato: 'feed', objetivos: ['oferta', 'evento'], foto: true,
  uso: 'Prato do dia, executivo ou combo com foto: nome e preço numa coluna, a foto ocupando a lateral.',
  aceita: ['tag', 'titulo', 'apoio', 'preco', 'selo', 'cta', 'legal', 'foto'], textos: { titulo: 32, apoio: 48, legal: 90 }, casos: ['a01', 'a02', 'x01'],
  busca: { fx: [560, 690], kh: [0.9, 1.4], placa: [true, false], lockup: [false, true], dist: ['espalha', 'topo'] },
  comp(sp, a, p){
    const fx = Math.round(p.fx), cw = fx - a.M - 56, L = _ccLegal(sp, a.W - 2 * a.M);
    const yLeg = L ? a.fim - L.h : a.fim, fotoFim = L ? yLeg - 44 : a.H + 40;
    const T = _ccTitulo(sp, a, cw, Math.round(150 * p.kh), { linhas: 4, iguala: p.lockup });
    if(!T) return null;
    const placa = p.placa && sp.precoPor, P = placa ? _ccPreco(sp, 430, 150, true) : _ccPreco(sp, cw, 150, false);
    const yPlaca = placa ? fotoFim - P.h - (L ? 30 : 140) : 0;
    const col = _ccPilha([{ b: _ccLogo(a), grupo: 'marca' }, { b: _ccTag(sp, 36), vao: 64, grupo: 'msg' }, { b: T, vao: 28, grupo: 'msg' },
      { b: _ccApoio(sp, cw, 38), vao: 24, grupo: 'msg' }, placa ? null : { b: P, vao: 64, grupo: 'oferta' },
      { b: _ccCta(sp, a), vao: placa ? 64 : 44, grupo: 'acao', ancora: true }], a.M, a.top, placa ? yPlaca - 40 : Math.min(fotoFim, a.fim), p.dist === 'topo' ? 'ancora' : 'espalha');
    if(!col) return null;
    const bs = col.concat([{ bloco: 'foto', x: fx, y: -40, w: a.W - fx + 40, h: fotoFim + 40 }]);
    if(placa) bs.push(Object.assign({}, P, { x: Math.max(a.M, fx - 170), y: Math.round(yPlaca), sobre: true }));
    const S = _ccSelo(sp, 100); if(S) bs.push(Object.assign(S, { x: a.W - a.M - 200, y: a.top + 40 }));
    if(L) bs.push(Object.assign(L, { x: a.M, y: yLeg }));
    return { ideia: 'Foto sangrando à direita, preço preso na borda', blocos: _ccBlocos(bs) };
  } });

// F2 · Feed · sem foto: o título grande no alto e uma FAIXA AMARELA de ponta a ponta com o preço em
// laranja (o par de display da marca) e o selo laranja. A faixa é o ponto focal; a ação embaixo.
crComposicao({ id: 'faixaPreco', nome: 'Faixa amarela do preço', grupo: 'A', formato: 'feed', objetivos: ['oferta'], foto: false,
  uso: 'Almoço executivo, marmita ou prato sem foto: o preço numa faixa amarela atravessando a peça.',
  aceita: ['tag', 'titulo', 'apoio', 'preco', 'selo', 'cta', 'legal'], textos: { titulo: 32, apoio: 48, legal: 90 }, casos: ['a02', 'a06', 'a05'],
  serve: sp => !!sp.precoPor,
  busca: { kh: [0.85, 1.25], kp: [190, 270], alto: [false, true], lockup: [false, true] },
  comp(sp, a, p){
    const W = a.W - 2 * a.M, S = _ccSelo(sp, 120), pw = S ? W - 260 : W;
    const T = _ccTitulo(sp, a, W, Math.round(160 * p.kh), { linhas: 3, iguala: p.lockup });
    if(!T) return null;
    const P = _ccPreco(sp, pw, Math.round(p.kp), false), C = _ccCta(sp, a), L = _ccLegal(sp, W);
    const bandaH = Math.max(P.h, S ? S.h : 0) + 110;
    const topo = _ccPilha([{ b: _ccLogo(a), grupo: 'marca' }, { b: _ccTag(sp, 36), vao: 56, grupo: 'msg' }, { b: T, vao: 28, grupo: 'msg' }, { b: _ccApoio(sp, W, 40), vao: 24, grupo: 'msg' }], a.M, a.top, a.fim, 'topo');
    if(!topo) return null;
    const fimTopo = topo[topo.length - 1].y + topo[topo.length - 1].h;
    const base = _ccPilha([{ b: C, grupo: 'acao' }, { b: L, vao: 36, grupo: 'acao' }], a.M, a.top, a.fim, 'base');
    const iniBase = base.length ? base[0].y : a.fim;
    const livre = iniBase - fimTopo - bandaH;
    if(livre < 120) return null;
    const bandaY = Math.round(fimTopo + livre * (p.alto ? 0.35 : 0.5));
    const bs = topo.concat(base);
    bs.push(Object.assign({}, P, { x: a.M, y: bandaY + Math.round((bandaH - P.h) / 2) }));
    if(S) bs.push(Object.assign(S, { x: a.W - a.M - S.w, y: bandaY + Math.round((bandaH - S.h) / 2) }));
    return { ideia: 'Preço numa faixa amarela atravessando a peça', zonas: [{ x: -20, y: bandaY, w: a.W + 40, h: bandaH, cor: 'amarelo' }], blocos: _ccBlocos(bs) };
  } });

// F3 · Feed · o título largo no alto; embaixo, a foto quadrada sangrando pela esquerda e, ao lado
// dela, o preço e a ação empilhados. Leitura em Z: título → foto → preço.
crComposicao({ id: 'fotoQuadradaPreco', nome: 'Foto quadrada e preço ao lado', grupo: 'A', formato: 'feed', objetivos: ['oferta'], foto: true,
  uso: 'Combo ou produto com foto e preço: a foto quadrada sangrando no canto e o preço na margem, ao lado dela.',
  aceita: ['tag', 'titulo', 'apoio', 'preco', 'selo', 'cta', 'legal', 'foto'], textos: { titulo: 32, apoio: 48, legal: 90 }, casos: ['a03', 'a05', 'x01'],
  serve: sp => !!sp.precoPor,
  busca: { fw: [440, 560], kh: [0.9, 1.5], lockup: [true, false] },
  comp(sp, a, p){
    const W = a.W - 2 * a.M, fw = Math.round(p.fw), L = _ccLegal(sp, W), yLeg = L ? a.fim - L.h : a.fim;
    // título curto cresce (é a hierarquia da peça); o longo para em ~1/3 da zona para a foto não encolher
    const T = _ccTitulo(sp, a, W, Math.round(170 * p.kh), { linhas: 3, iguala: p.lockup, alt: Math.round((a.fim - a.top) * 0.34) });
    if(!T) return null;
    const topo = _ccPilha([{ b: _ccLogo(a), grupo: 'marca' }, { b: _ccTag(sp, 36), vao: 52, grupo: 'msg' }, { b: T, vao: 28, grupo: 'msg' }, { b: _ccApoio(sp, W, 40), vao: 22, grupo: 'msg' }], a.M, a.top, a.fim, 'topo');
    if(!topo) return null;
    const fimTopo = topo[topo.length - 1].y + topo[topo.length - 1].h, fotoTopo = fimTopo + 64, fotoFim = L ? yLeg - 48 : a.H + 40;
    if(fotoFim - fotoTopo < 380) return null;
    // a foto sangra pela DIREITA; o preço e a ação ficam na margem esquerda — o mesmo eixo do título
    const fx = a.W - fw, cw = fx - a.M - 52, P = _ccPreco(sp, cw, 150, false);
    const lado = _ccPilha([{ b: P, grupo: 'oferta' }, { b: _ccCta(sp, a), vao: 44, grupo: 'acao' }], a.M, fotoTopo + 20, (L ? yLeg - 48 : a.fim), 'base');
    if(!lado) return null;
    const bs = topo.concat(lado, [{ bloco: 'foto', x: fx, y: fotoTopo, w: fw + 40, h: fotoFim - fotoTopo, rx: 0 }]);
    const S = _ccSelo(sp, 96); if(S) bs.push(Object.assign(S, { x: fx - 40, y: fotoTopo - 40 }));
    if(L) bs.push(Object.assign(L, { x: a.M, y: yLeg }));
    return { ideia: 'Foto quadrada no canto, preço na margem', blocos: _ccBlocos(bs) };
  } });

// F4 · Feed · "a partir de": o preço é o herói, gigante, encostado na margem; o nome do produto vem
// antes, menor. O "R$" inflado do inventário fecha o canto livre (ou o selo, quando há desconto).
crComposicao({ id: 'precoGigante', nome: 'Preço gigante', grupo: 'A', formato: 'feed', objetivos: ['oferta'], foto: false,
  uso: '"A partir de" e preço em destaque, sem foto: o número é o herói da peça.',
  aceita: ['tag', 'titulo', 'apoio', 'preco', 'selo', 'cta', 'legal'], textos: { titulo: 32, apoio: 48, legal: 90 }, casos: ['a06', 'a05', 'b04'],
  serve: sp => !!sp.precoPor,
  busca: { kp: [260, 380], kh: [0.8, 1.15], dist: ['espalha', 'ancora'] },
  comp(sp, a, p){
    const W = a.W - 2 * a.M, S = _ccSelo(sp, 110), canto = S ? 0 : 230;
    const T = _ccTitulo(sp, a, W - (S ? 0 : canto), Math.round(120 * p.kh), { linhas: 3 });
    if(!T) return null;
    const aPartir = /PARTIR/.test(sp.topo), P = Object.assign(_ccPreco(sp, W, Math.round(p.kp), false), { prefixo: aPartir ? '' : 'POR' });
    const col = _ccPilha([{ b: _ccLogo(a), grupo: 'marca' }, { b: _ccTag(sp, 36), vao: 56, grupo: 'msg' }, { b: T, vao: 28, grupo: 'msg' }, { b: P, vao: 56, grupo: 'oferta' },
      { b: _ccApoio(sp, W, 40), vao: 28, grupo: 'oferta' }, { b: _ccCta(sp, a), vao: 64, grupo: 'acao', ancora: true }, { b: _ccLegal(sp, W), vao: 36, grupo: 'acao' }], a.M, a.top, a.fim, p.dist);
    if(!col) return null;
    const bs = col.slice(), gr = [];
    if(S){ const tp = col.find(b => b.bloco === 'preco'); bs.push(Object.assign(S, { x: a.W - a.M - S.w, y: Math.max(a.top, tp.y - S.h - 20) })); }
    else gr.push({ asset: 'sticker-real', x: a.W - 250, y: a.top + 10, w: 190, rot: 10 });
    return { ideia: 'Preço gigante na margem, o produto antes dele', blocos: _ccBlocos(bs), grafismos: gr };
  } });

// F5 · Feed · lista de 2 a 4 ofertas em cards brancos (número, nome, preço em laranja), o título no
// alto e a ação na base. A lista é o conteúdo; o título só abre.
crComposicao({ id: 'listaOfertas', nome: 'Lista de ofertas', grupo: 'A', formato: 'feed', objetivos: ['oferta', 'parceiro'], foto: false, lista: true,
  uso: 'Ofertas do dia ou combos lado a lado: de 2 a 4 itens com o preço de cada um.',
  aceita: ['tag', 'titulo', 'apoio', 'itens', 'cta', 'legal', 'selo'], textos: { titulo: 32, apoio: 48 }, casos: ['a07', 'd05', 'd03'],
  serve: sp => sp.itens.length >= 2,
  busca: { kh: [0.85, 1.2], ch: [130, 175], dist: ['espalha', 'centro'] },
  comp(sp, a, p){
    const W = a.W - 2 * a.M, S = _ccSelo(sp, 90);
    const T = _ccTitulo(sp, a, S ? W - 210 : W, Math.round(130 * p.kh), { linhas: 2 });
    if(!T) return null;
    const n = sp.itens.length, comPreco = sp.itens.some(t => _crItemPreco(t).preco), lh = Math.round(p.ch) * n + 24 * (n - 1);
    const col = _ccPilha([{ b: _ccLogo(a), grupo: 'marca' }, { b: _ccTag(sp, 36), vao: 52, grupo: 'msg' }, { b: T, vao: 28, grupo: 'msg' }, { b: _ccApoio(sp, W, 38), vao: 22, grupo: 'msg' },
      { b: { bloco: 'itens', w: W, h: lh, estilo: 'precos' }, vao: 56, grupo: 'lista' },
      { b: _ccCta(sp, a), vao: 56, grupo: 'acao' }, { b: _ccLegal(sp, W), vao: 32, grupo: 'acao' }], a.M, a.top, a.fim, p.dist);
    if(!col) return null;
    const bs = col.slice();
    if(S){ const t = col.find(b => b.bloco === 'titulo'); bs.push(Object.assign(S, { x: a.W - a.M - S.w, y: t.y })); }
    return { ideia: 'Lista de ofertas em cards, título no alto', blocos: _ccBlocos(bs) };
  } });

// F6 · Feed · uma ideia só: o título em bloco centralizado, linhas igualadas na largura (o lockup),
// grande o bastante para ser a peça. Grafismos sangrando nos dois cantos opostos abrem o centro.
crComposicao({ id: 'blocoCentral', nome: 'Título em bloco centralizado', grupo: 'A', formato: 'feed', objetivos: ['oferta', 'evento', 'beneficio', 'aviso'], foto: false,
  uso: 'Mensagem curta que é a peça inteira ("2 por 1", "Sextou", "Feriado"): o título em bloco, centralizado.',
  aceita: ['tag', 'titulo', 'apoio', 'preco', 'selo', 'cta', 'legal'], textos: { titulo: 26, apoio: 48, legal: 90 }, casos: ['a04', 'b02', 'f01'],
  serve: sp => _crPalavras(crConteudoBlocos(sp).titulo || '').length <= 4,
  busca: { kh: [0.85, 1.3], cantos: ['explosao', 'sorriso'], dist: ['centro', 'espalha'] },
  comp(sp, a, p){
    const W = a.W - 2 * a.M, X = a.W / 2;
    // o bloco ocupa no máximo ~45% da zona útil: o resto é respiro e o que acompanha
    const S0 = _ccSelo(sp, 110), P0 = _ccPreco(sp, W - (S0 ? 260 : 0), 170, false);
    const T = _ccTitulo(sp, a, W, Math.round(250 * p.kh), { linhas: 3, iguala: true, alt: Math.round((a.fim - a.top) * (P0 || S0 ? 0.36 : 0.45)) });
    if(!T) return null;
    // preço e selo numa linha só, centralizada: o selo à direita do preço (o par vira um grupo)
    const lin = P0 && S0 ? { bloco: '_linha', w: P0.larg + 40 + S0.w, h: Math.max(P0.h, S0.h) } : P0 || S0;
    const col = _ccPilha([{ b: _ccLogo(a), grupo: 'marca' }, { b: _ccTag(sp, 36), vao: 56, grupo: 'msg' }, { b: T, vao: 32, grupo: 'msg' }, { b: _ccApoio(sp, W, 40), vao: 28, grupo: 'msg' },
      { b: lin, vao: 56, grupo: 'oferta' }, { b: _ccCta(sp, a), vao: 64, grupo: 'acao' }, { b: _ccLegal(sp, W), vao: 32, grupo: 'acao' }], X, a.top, a.fim, p.dist, 'centro');
    if(!col) return null;
    const li = col.findIndex(b => b.bloco === '_linha');
    if(li >= 0){ const l = col[li]; col.splice(li, 1, Object.assign({}, P0, { x: l.x, y: l.y + Math.round((l.h - P0.h) / 2), w: P0.larg, alinhar: 'esq' }), Object.assign({}, S0, { x: l.x + P0.larg + 40, y: l.y + Math.round((l.h - S0.h) / 2), alinhar: 'esq' })); }
    // apoio e letra miúda centralizados na largura toda (o crDesenhar centraliza dentro da caixa)
    col.forEach(b => { if((b.bloco === 'preco' && li < 0) || b.bloco === 'apoio' || b.bloco === 'legal'){ b.x = a.M; b.w = W; } });
    const much = sp.marca === 'much', ex = p.cantos === 'explosao';
    const gr = [_ccCanto(col, a, sp, much ? 'mais-amarelo' : ex ? 'explosao' : 'sorriso-arco', 'td', ex ? 340 : 440, ex ? 8 : 14),
      _ccCanto(col, a, sp, much ? 'estrela-amarela' : ex ? 'sorriso-arco' : 'explosao', 'be', much ? 200 : ex ? 440 : 320, ex ? -8 : 0)].filter(Boolean);
    return { ideia: 'Título em bloco centralizado, grafismos nos cantos', blocos: _ccBlocos(col), grafismos: gr };
  } });

// S1 · Story · a foto sangra no alto (capa de revista) e o card branco do preço prende na borda de
// baixo dela — ou desce para a base do texto e o selo é que prende na borda; o nome vem grande e a
// assinatura fecha o rodapé: botão à esquerda, logo à direita.
crComposicao({ id: 'fotoCapaStory', nome: 'Foto de capa e card de preço', grupo: 'A', formato: 'story', objetivos: ['oferta', 'evento'], foto: true,
  uso: 'Prato ou combo com foto bonita no story: a foto é a capa e o preço prende na borda dela.',
  aceita: ['tag', 'titulo', 'apoio', 'preco', 'selo', 'cta', 'legal', 'foto'], textos: { titulo: 32, apoio: 48, legal: 90 }, casos: ['a01', 'a03', 'x01'],
  busca: { fh: [480, 680], kh: [1, 1.5], lado: ['esq', 'dir'], lockup: [false, true], card: ['borda', 'base'] },
  comp(sp, a, p){
    const W = a.W - 2 * a.M, fh = Math.round(p.fh), dir = p.lado === 'dir', base = p.card === 'base';
    // card do preço e título no corpo do story: o bloco de baixo precisa pesar tanto quanto a foto
    const P = _ccPreco(sp, 560, 200, true), S = _ccSelo(sp, 120), L = _ccLegal(sp, W);
    const naBorda = P && !base, yP = naBorda ? fh - Math.round(P.h * 0.55) : fh, ini = (naBorda ? yP + P.h : fh) + 64;
    const yRod = a.fim - (L ? L.h + 32 : 0) - 96, G = _ccTag(sp, 36), A = _ccApoio(sp, W, 42);
    const livre = yRod - 64 - ini - (G ? G.h + 24 : 0) - (A ? A.h + 24 : 0) - (P && base ? P.h + 56 : 0);
    const T = _ccTitulo(sp, a, W, Math.round(260 * p.kh), { linhas: 3, iguala: p.lockup, alt: livre });
    if(!T) return null;
    const PC = P && base ? Object.assign({}, P, { w: 560 }) : null;
    const col = _ccPilha([{ b: G, grupo: 'msg' }, { b: T, vao: 24, grupo: 'msg' }, { b: A, vao: 24, grupo: 'msg' }, { b: PC, vao: 56, grupo: 'oferta' }],
      a.M, ini, yRod - 64, base ? 'espalha' : 'centro');
    if(!col) return null;
    const bs = col.concat([{ bloco: 'foto', x: -40, y: -40, w: a.W + 80, h: fh + 40 }]);
    if(naBorda) bs.push(Object.assign({}, P, { x: dir ? a.W - a.M - 560 : a.M, y: yP, w: 560, sobre: true }));
    // o selo: no alto da foto (com o card na borda) ou ele mesmo preso na borda (com o card na base)
    if(S) bs.push(Object.assign(S, { x: dir ? a.M : a.W - a.M - S.w, y: base ? fh - Math.round(S.h * 0.5) : a.top + 30 }));
    const C = _ccCta(sp, a); if(C) bs.push(Object.assign(C, { x: a.M, y: yRod }));
    bs.push(Object.assign(_ccLogo(a), { x: a.W - a.M - 300, y: yRod + 18, alinhar: 'dir' }));
    if(L) bs.push(Object.assign(L, { x: a.M, y: a.fim - L.h }));
    return { ideia: base ? 'Foto de capa no alto, selo na borda, preço na base' : 'Foto de capa no alto, card de preço preso na borda', blocos: _ccBlocos(bs) };
  } });

// S2 · Story · tudo num eixo central: logo, título em bloco, a foto arredondada no meio (com o selo
// na quina) e o preço logo abaixo dela. Simetria de vitrine.
crComposicao({ id: 'vitrineCentral', nome: 'Vitrine central', grupo: 'A', formato: 'story', objetivos: ['oferta', 'evento', 'beneficio'], foto: true,
  uso: 'Produto com foto no story, em vitrine simétrica: título, foto e preço num eixo só.',
  aceita: ['tag', 'titulo', 'apoio', 'preco', 'selo', 'cta', 'legal', 'foto'], textos: { titulo: 28, apoio: 48, legal: 90 }, casos: ['a02', 'x01', 'b02'],
  busca: { fh: [480, 700], kh: [0.9, 1.25] },
  comp(sp, a, p){
    const W = a.W - 2 * a.M, X = a.W / 2;
    const T = _ccTitulo(sp, a, W, Math.round(160 * p.kh), { linhas: 3, iguala: true, alt: Math.round((a.fim - a.top) * 0.22) });
    if(!T) return null;
    const P = _ccPreco(sp, W, 140, false), A = _ccApoio(sp, W, 42), C = _ccCta(sp, a), L = _ccLegal(sp, W), G = _ccTag(sp, 36);
    // a foto é o bloco elástico: fica com o que sobrar (até p.fh), nunca menos que 360
    const fixo = 60 + (G ? G.h + 48 : 0) + T.h + 28 + (A ? A.h + 24 : 0) + 56 + (P ? P.h + 48 : 0) + (C ? C.h + 48 : 0) + (L ? L.h + 32 : 0) + 40;
    const fh = Math.min(Math.round(p.fh), a.fim - a.top - fixo);
    if(fh < 320) return null;
    const F = { bloco: 'foto', w: W, h: fh };
    const col = _ccPilha([{ b: _ccLogo(a), grupo: 'marca' }, { b: _ccTag(sp, 36), vao: 48, grupo: 'msg' }, { b: T, vao: 28, grupo: 'msg' }, { b: A, vao: 24, grupo: 'msg' },
      { b: F, vao: 56, grupo: 'imagem' }, { b: P, vao: 48, grupo: 'oferta' }, { b: C, vao: 48, grupo: 'acao' }, { b: L, vao: 32, grupo: 'acao' }], X, a.top, a.fim, 'espalha', 'centro');
    if(!col) return null;
    col.forEach(b => { if(b.bloco === 'preco' || b.bloco === 'apoio' || b.bloco === 'legal' || b.bloco === 'foto'){ b.x = a.M; b.w = W; } });
    const f = col.find(b => b.bloco === 'foto'), S = _ccSelo(sp, 105), bs = col.slice();
    if(S) bs.push(Object.assign(S, { x: a.W - a.M - S.w, y: f.y - 50 }));
    return { ideia: 'Vitrine central: título, foto e preço num eixo', blocos: _ccBlocos(bs) };
  } });

// S3 · Story · sem foto, o preço vira a arte: gigante, no terço do meio, com o produto em cima e a
// ação ancorada na base. O sorriso sangra no canto de baixo e equilibra o peso.
crComposicao({ id: 'precoVertical', nome: 'Preço gigante no story', grupo: 'A', formato: 'story', objetivos: ['oferta'], foto: false,
  uso: 'Oferta sem foto no story: o preço ocupa a tela, o nome em cima, o botão embaixo.',
  aceita: ['tag', 'titulo', 'apoio', 'preco', 'selo', 'cta', 'legal'], textos: { titulo: 32, apoio: 48, legal: 90 }, casos: ['a05', 'b04', 'a06'],
  serve: sp => !!sp.precoPor,
  busca: { kp: [300, 420], kh: [0.85, 1.2], eixo: ['esq', 'centro'] },
  comp(sp, a, p){
    const W = a.W - 2 * a.M, c = p.eixo === 'centro', X = c ? a.W / 2 : a.M;
    const T = _ccTitulo(sp, a, W, Math.round(150 * p.kh), { linhas: 3, iguala: c });
    if(!T) return null;
    const aPartir = /PARTIR/.test(sp.topo), P = Object.assign(_ccPreco(sp, W, Math.round(p.kp), false), { prefixo: aPartir ? '' : 'POR' }), S = _ccSelo(sp, 115);
    const col = _ccPilha([{ b: _ccLogo(a), grupo: 'marca' }, { b: _ccTag(sp, 40), vao: 72, grupo: 'msg' }, { b: T, vao: 32, grupo: 'msg' }, { b: _ccApoio(sp, W, 44), vao: 28, grupo: 'msg' },
      { b: P, vao: 90, grupo: 'oferta' }, { b: S, vao: 40, grupo: 'oferta' }, { b: _ccCta(sp, a), vao: 90, grupo: 'acao', ancora: true }, { b: _ccLegal(sp, W), vao: 36, grupo: 'acao' }], X, a.top, a.fim, 'ancora', c ? 'centro' : 'esq');
    if(!col) return null;
    if(c) col.forEach(b => { if(b.bloco === 'preco' || b.bloco === 'apoio' || b.bloco === 'legal'){ b.x = a.M; b.w = W; } });
    const much = sp.marca === 'much', gr = [_ccCanto(col, a, sp, much ? 'mais-amarelo' : 'sorriso-arco', c ? 'be' : 'bd', much ? 380 : 560, c ? -12 : 12)].filter(Boolean);
    return { ideia: 'Preço gigante no terço do meio, ação na base', blocos: _ccBlocos(col), grafismos: gr };
  } });

// S4 · Story · a lista de ofertas do story: cards altos e generosos, o título em cima com uma estrela
// marcando o "do dia", a ação na base.
crComposicao({ id: 'listaStory', nome: 'Lista de ofertas no story', grupo: 'A', formato: 'story', objetivos: ['oferta', 'parceiro'], foto: false, lista: true,
  uso: 'Ofertas do dia (ou de várias lojas) no story: 2 a 4 itens grandes, fáceis de ler no celular.',
  aceita: ['tag', 'titulo', 'apoio', 'itens', 'cta', 'legal', 'selo'], textos: { titulo: 32, apoio: 48 }, casos: ['a07', 'd05', 'd03'],
  serve: sp => sp.itens.length >= 2,
  busca: { kh: [0.85, 1.2], ch: [170, 230] },
  comp(sp, a, p){
    const W = a.W - 2 * a.M, S = _ccSelo(sp, 100);
    const T = _ccTitulo(sp, a, W - 230, Math.round(150 * p.kh), { linhas: 3 });   // o canto direito é do selo (ou da estrela)
    if(!T) return null;
    const n = sp.itens.length, comPreco = sp.itens.some(t => _crItemPreco(t).preco), lh = Math.round(p.ch) * n + 24 * (n - 1);
    const col = _ccPilha([{ b: _ccLogo(a), grupo: 'marca' }, { b: _ccTag(sp, 40), vao: 64, grupo: 'msg' }, { b: T, vao: 28, grupo: 'msg' }, { b: _ccApoio(sp, W, 42), vao: 24, grupo: 'msg' },
      { b: { bloco: 'itens', w: W, h: lh, estilo: 'precos' }, vao: 80, grupo: 'lista' },
      { b: _ccCta(sp, a), vao: 80, grupo: 'acao', ancora: true }, { b: _ccLegal(sp, W), vao: 32, grupo: 'acao' }], a.M, a.top, a.fim, 'espalha');
    if(!col) return null;
    const bs = col.slice(), t = col.find(b => b.bloco === 'titulo');
    if(S) bs.push(Object.assign(S, { x: a.W - a.M - S.w, y: t.y }));
    const gr = S ? [] : [{ asset: 'estrela-amarela', x: a.W - a.M - 140, y: t.y, w: 140, rot: 0 }];
    return { ideia: 'Lista de ofertas em cards altos', blocos: _ccBlocos(bs), grafismos: gr };
  } });
