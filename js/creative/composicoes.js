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
    // (caixa girada conta com a tinta girada)
    const bate = bs.some(b => { if(!b || b.bloco === 'foto') return false; const r = Math.abs(b.rot || 0) * Math.PI / 180, gv = b.w * Math.sin(r) / 2, gh = b.h * Math.sin(r) / 2;
      return x - folga < b.x + b.w + gh && x + w + folga > b.x - gh && y - folga < b.y + b.h + gv && y + h + folga > b.y - gv; });
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

/* ══════════════════════════════════════════════════════════════
   LOTE 2 — A (story, carrossel, inapp) · B · horário e ocasião
══════════════════════════════════════════════════════════════ */
// Faixa útil vertical do formato (os deitados, como o carrossel, não têm top/fim: vale a zona segura)
const _ccFaixa = a => [a.top != null ? a.top : a.seguroTopo + 30, a.fim != null ? a.fim : a.seguroBase - 30];
// Grafismo solto (estrela, seta) numa posição pensada: entra só se não encostar em nenhum bloco
function _ccSolta(bs, sp, asset, x, y, w, rot){
  const d = CR_DECOR[asset];
  if(!d || !_crDoInv(asset, sp)) return null;
  const h = w * d.h / d.w, f = 18;
  return bs.some(b => b && b.bloco !== 'foto' && x - f < b.x + b.w && x + w + f > b.x && y - f < b.y + b.h && y + h + f > b.y) ? null : { asset, x: Math.round(x), y: Math.round(y), w, rot: rot || 0 };
}
const _ccFim = bs => Math.max(...bs.map(b => b.y + b.h));

// S5 · Story · a foto atravessa a tela no meio e a faixa amarela do preço sai colada embaixo dela:
// título em cima, foto + faixa como um bloco só, ação na base.
crComposicao({ id: 'comboStory', nome: 'Foto no meio e faixa do preço', grupo: 'A', formato: 'story', objetivos: ['oferta'], foto: true,
  uso: 'Combo ou prato com foto no story: a foto atravessa a tela no meio e o preço vem numa faixa amarela logo abaixo.',
  aceita: ['tag', 'titulo', 'apoio', 'preco', 'selo', 'cta', 'legal', 'foto'], textos: { titulo: 32, apoio: 48, legal: 90 }, casos: ['a03', 'x01', 'a01'],
  serve: sp => !!sp.precoPor,
  busca: { fh: [440, 700], kh: [0.9, 1.35], lockup: [true, false] },
  comp(sp, a, p){
    const W = a.W - 2 * a.M, S = _ccSelo(sp, 110), P = _ccPreco(sp, S ? W - 280 : W, 170, false);
    const T = _ccTitulo(sp, a, W, Math.round(180 * p.kh), { linhas: 3, iguala: p.lockup, alt: Math.round((a.fim - a.top) * 0.2) });
    if(!T) return null;
    // a zona segura do story é curta: o logo desce para o rodapé, na linha do botão
    const topo = _ccPilha([{ b: _ccTag(sp, 40), grupo: 'msg' }, { b: T, vao: 28, grupo: 'msg' }, { b: _ccApoio(sp, W, 42), vao: 24, grupo: 'msg' }], a.M, a.top, a.fim, 'topo');
    const LG = _ccLegal(sp, W), yRod = a.fim - (LG ? LG.h + 32 : 0) - 96;
    if(!topo) return null;
    const ini = _ccFim(topo) + 56, fimL = yRod - 56, bandaH = Math.max(P.h, S ? S.h : 0) + 60;
    const fh = Math.min(Math.round(p.fh), fimL - ini - bandaH);
    if(fh < 360) return null;
    const yF = ini + Math.round((fimL - ini - fh - bandaH) / 2), yB = yF + fh, C = _ccCta(sp, a);
    const bs = topo.concat([{ bloco: 'foto', x: -40, y: yF, w: a.W + 80, h: fh }, Object.assign({}, P, { x: a.M, y: yB + Math.round((bandaH - P.h) / 2) }),
      Object.assign(_ccLogo(a), { x: a.W - a.M - 300, y: yRod + 18, alinhar: 'dir' })]);
    if(C) bs.push(Object.assign(C, { x: a.M, y: yRod }));
    if(LG) bs.push(Object.assign(LG, { x: a.M, y: a.fim - LG.h }));
    if(S) bs.push(Object.assign(S, { x: a.W - a.M - S.w, y: yB + Math.round((bandaH - S.h) / 2) }));
    return { ideia: 'Foto atravessando o meio, faixa amarela do preço colada nela', zonas: [{ x: -20, y: yB, w: a.W + 40, h: bandaH, cor: 'amarelo' }], blocos: _ccBlocos(bs) };
  } });

// C1 · Carrossel · capa com o título gigante e a seta chamando para o lado; a lâmina do meio é a lista
// de ofertas em cards; a última fecha com o celular do app e o botão.
crComposicao({ id: 'ofertasCarrossel', nome: 'Carrossel de ofertas', grupo: 'A', formato: 'carrossel', objetivos: ['oferta', 'parceiro', 'evento'], foto: false, lista: true,
  uso: 'Ofertas do dia em carrossel: capa, a lista com o preço de cada item e o convite para pedir no app.',
  aceita: ['tag', 'titulo', 'apoio', 'itens', 'cta', 'legal', 'selo'], textos: { titulo: 32, apoio: 48, legal: 90 }, casos: ['a07', 'd05', 'e03'],
  serve: sp => sp.itens.length >= 2,
  busca: { kh: [0.85, 1.3], ch: [170, 230], cel: [440, 520] },
  comp(sp, a, p){
    const L = 1080, M = a.M, W = L - 2 * M, [top, fim] = _ccFaixa(a), S = _ccSelo(sp, 120);
    const T = _ccTitulo(sp, a, W, Math.round(240 * p.kh), { linhas: 3, iguala: true, alt: Math.round((fim - top) * 0.5) });
    if(!T) return null;
    const capa = _ccPilha([{ b: _ccLogo(a), grupo: 'marca' }, { b: _ccTag(sp, 40), vao: 80, grupo: 'msg' }, { b: T, vao: 32, grupo: 'msg' }, { b: _ccApoio(sp, W, 44), vao: 28, grupo: 'msg' }], M, top, fim - 160, 'topo');
    if(!capa) return null;
    // lâmina 2: a lista ocupa a altura útil, centralizada
    const n = sp.itens.length, lh = Math.min(fim - top - 40, Math.round(p.ch) * n + 28 * (n - 1));
    const lista = { bloco: 'itens', x: L + M, y: Math.round(top + (fim - top - lh) / 2), w: W, h: lh, estilo: 'precos' };
    // lâmina 3: o celular do app, o botão e a letra miúda
    const cw = Math.round(p.cel), C = _ccCta(sp, a), LG = _ccLegal(sp, W);
    const ult = _ccPilha([{ b: { bloco: 'mockup', w: cw, h: Math.round(cw * 700 / 390) }, grupo: 'img' }, { b: S, vao: 40, grupo: 'oferta' }, { b: C, vao: 56, grupo: 'acao' }, { b: LG, vao: 32, grupo: 'acao' }], 2 * L + L / 2, top, fim, 'centro', 'centro');
    if(!ult) return null;
    ult.forEach(b => { if(b.bloco === 'legal'){ b.x = 2 * L + M; b.w = W; } });
    const bs = capa.concat([lista], ult), gr = [_ccSolta(bs, sp, 'seta-rabisco', L - M - 300, fim - 120, 300, -6)].filter(Boolean);
    return { ideia: 'Capa, lista de ofertas em cards e o app na última lâmina', blocos: _ccBlocos(bs), grafismos: gr };
  } });

// C5 · Carrossel · leitura em Z: o título gigante na largura toda da capa, o preço gigante na largura
// toda da 2ª lâmina e, embaixo, a foto atravessando a divisa entre as duas (o arrastar continua a
// imagem); a 3ª fecha com o botão e o celular do app.
crComposicao({ id: 'produtoCarrossel', nome: 'Carrossel com a foto na divisa', grupo: 'A', formato: 'carrossel', objetivos: ['oferta'], foto: true,
  uso: 'Produto com foto e preço em carrossel: título na capa, preço na 2ª e a foto atravessando as duas; a 3ª chama para o app.',
  aceita: ['tag', 'titulo', 'apoio', 'preco', 'selo', 'cta', 'legal', 'foto'], textos: { titulo: 32, apoio: 60, legal: 90 }, casos: ['x01', 'a03', 'a01'],
  serve: sp => !!sp.precoPor,
  busca: { kh: [1, 1.45], fy: [640, 760], fx: [520, 620], cel: [440, 520], kp: [230, 320] },
  comp(sp, a, p){
    const L = 1080, M = a.M, W = L - 2 * M, [top, fim] = _ccFaixa(a), fy = Math.round(p.fy), fx = Math.round(p.fx), fw = L + 40;
    // capa: logo, tag e o título na largura toda, acima da foto; o apoio no canto de baixo, ao lado dela
    const G = _ccTag(sp, 40), T = _ccTitulo(sp, a, W, Math.round(300 * p.kh), { linhas: 3, iguala: true, alt: fy - 60 - top - 52 - 56 - (G ? G.h + 28 : 0) });
    if(!T) return null;
    const capa = _ccPilha([{ b: _ccLogo(a), grupo: 'marca' }, { b: G, vao: 56, grupo: 'msg' }, { b: T, vao: G ? 28 : 56, grupo: 'msg' }], M, top, fy - 60, 'topo');
    if(!capa) return null;
    const A = _ccApoio(sp, fx - M - 48, 40);
    if(A) capa.push(Object.assign(A, { x: M, y: fy + 40 }));
    // 2ª lâmina: o preço gigante acima da foto; o selo no canto de baixo, depois dela
    const S = _ccSelo(sp, 120), P = _ccPreco(sp, W, Math.round(p.kp), false);
    const meio = _ccPilha([{ b: P, grupo: 'oferta' }], L + M, top, fy - 60, 'centro');
    if(!meio) return null;
    const xs = fx + fw + 48;
    if(S){ if(2 * L - M - xs < S.w) return null; meio.push(Object.assign(S, { x: 2 * L - M - S.w, y: fy + 40 })); }
    // 3ª lâmina: o botão no alto, a letra miúda embaixo e o celular assentado na base, à direita
    const x3 = 2 * L + M, cw = Math.round(p.cel), C = _ccCta(sp, a), LG = _ccLegal(sp, W - cw - 48), ch = Math.round(cw * 700 / 390), ych = a.seguroBase - 10 - ch;
    if(ych < top + 40 + (C ? 96 : 0) + 50) return null;
    const ult = [];
    if(C) ult.push(Object.assign(C, { x: x3, y: top + 40 }));
    if(LG) ult.push(Object.assign(LG, { x: x3, y: fim - LG.h }));
    ult.push({ bloco: 'mockup', x: 3 * L - M - cw, y: ych, w: cw, h: ch });
    const bs = capa.concat(meio, ult, [{ bloco: 'foto', x: fx, y: fy, w: fw, h: a.H - fy + 40, rx: 0 }]);
    const gr = [_ccSolta(bs, sp, 'seta-rabisco', x3, ych + 140, 300, -8)].filter(Boolean);
    return { ideia: 'Título na capa, preço na 2ª, a foto atravessando a divisa; o app na última', blocos: _ccBlocos(bs), grafismos: gr };
  } });

// I1 · Inapp · o pop-up da oferta: a foto em cima, o selo preso na borda dela, o nome e o preço
// centralizados; o botão largo do inapp fecha embaixo (fixo do formato).
crComposicao({ id: 'comboInapp', nome: 'Pop-up da oferta', grupo: 'A', formato: 'inapp', objetivos: ['oferta'], foto: true,
  uso: 'Oferta com foto no pop-up do app: foto, nome e preço num eixo, o botão largo embaixo.',
  aceita: ['tag', 'titulo', 'apoio', 'preco', 'selo', 'legal', 'foto'], textos: { titulo: 28, apoio: 48, legal: 90 }, casos: ['a03', 'x01', 'b02'],
  serve: sp => !!sp.precoPor,
  busca: { fh: [600, 860], kh: [1, 1.45], kp: [200, 270] },
  comp(sp, a, p){
    const W = a.W - 2 * a.M, X = a.W / 2, fh = Math.round(p.fh);
    const T = _ccTitulo(sp, a, W, Math.round(200 * p.kh), { linhas: 3, iguala: true, alt: 380 });
    if(!T) return null;
    const col = _ccPilha([{ b: _ccLogo(a), grupo: 'marca' }, { b: _ccTag(sp, 40), vao: 48, grupo: 'msg' }, { b: T, vao: 28, grupo: 'msg' }, { b: _ccApoio(sp, W, 42), vao: 24, grupo: 'msg' },
      { b: _ccPreco(sp, W, Math.round(p.kp), false), vao: 56, grupo: 'oferta' }, { b: _ccLegal(sp, W), vao: 40, grupo: 'acao' }], X, fh + 70, a.fim, 'espalha', 'centro');
    if(!col) return null;
    col.forEach(b => { if(b.bloco === 'preco' || b.bloco === 'apoio' || b.bloco === 'legal'){ b.x = a.M; b.w = W; } });
    const bs = col.concat([{ bloco: 'foto', x: -40, y: -40, w: a.W + 80, h: fh + 40 }]);
    const S = _ccSelo(sp, 120); if(S) bs.push(Object.assign(S, { x: a.W - a.M - S.w, y: fh - Math.round(S.h / 2) }));
    return { ideia: 'Pop-up: foto em cima, selo na borda, nome e preço no eixo', blocos: _ccBlocos(bs) };
  } });

// F7 · Feed · happy hour: a peça se divide em dois tons — o texto na coluna laranja e, numa coluna
// solar sangrando à direita, o selo grande da oferta (2X1) e o horário. Lê-se: o quê → quanto → quando.
crComposicao({ id: 'happyHour', nome: 'Dois tons com selo grande', grupo: 'B', formato: 'feed', objetivos: ['oferta', 'evento'], foto: false, tema: ['happy', 'sextou', 'fds', 'janta', 'madrugada'],
  uso: 'Happy hour, sextou ou fim de semana sem foto: o texto de um lado e o selo da oferta (e o horário) na coluna do outro tom.',
  aceita: ['tag', 'titulo', 'apoio', 'selo', 'horario', 'cta', 'legal', 'preco'], textos: { titulo: 28, apoio: 48, legal: 90 }, casos: ['b01', 'b02'],
  serve: sp => sp.selo.length > 0 || !!sp.horario,   // a coluna do outro tom é do selo ou do horário
  busca: { col: [380, 450], kh: [0.95, 1.45], dist: ['espalha', 'centro'] },
  comp(sp, a, p){
    const cw = Math.round(p.col), cx = a.W - cw, W = cx - a.M - 56, much = sp.marca === 'much';
    const T = _ccTitulo(sp, a, W, Math.round(160 * p.kh), { linhas: 4, iguala: true, alt: Math.round((a.fim - a.top) * 0.42) });
    if(!T) return null;
    const P = sp.precoPor ? _ccPreco(sp, W, 150, false) : null;
    const col = _ccPilha([{ b: _ccLogo(a), grupo: 'marca' }, { b: _ccTag(sp, 36), vao: 64, grupo: 'msg' }, { b: T, vao: 28, grupo: 'msg' }, { b: _ccApoio(sp, W, 40), vao: 24, grupo: 'msg' },
      { b: P, vao: 56, grupo: 'oferta' }, { b: _ccCta(sp, a), vao: 64, grupo: 'acao', ancora: true }, { b: _ccLegal(sp, W), vao: 32, grupo: 'acao' }], a.M, a.top, a.fim, p.dist);
    if(!col) return null;
    // a coluna do outro tom: selo grande e horário, centralizados nela
    const x0 = cx + 50, x1 = a.W - a.M, d = Math.min(320, x1 - x0);
    const S = sp.selo.length ? { bloco: 'selo', w: d, h: d, max: Math.round(d / 2) } : null;
    const H = sp.horario ? { bloco: 'horario', w: x1 - x0, h: 200, max: 110 } : null;
    const lado = _ccPilha([{ b: S, grupo: 'oferta' }, { b: H, vao: 48, grupo: 'oferta' }], (x0 + x1) / 2, a.top, a.fim, 'centro', 'centro');
    if(!lado || !lado.length) return null;
    return { ideia: 'Dois tons: o texto na coluna laranja, o selo e o horário na outra', zonas: [{ x: cx, y: -20, w: cw + 20, h: a.H + 40, cor: much ? 'branco' : 'solar' }], blocos: _ccBlocos(col.concat(lado)) };
  } });

// F8 · Feed · leitura na diagonal: o título vira adesivo (contorno branco, girado) no alto à esquerda,
// o selo grande no meio à direita e o preço e o botão fecham embaixo à esquerda.
crComposicao({ id: 'sextouSticker', nome: 'Adesivo na diagonal', grupo: 'B', formato: 'feed', objetivos: ['oferta', 'evento'], foto: false, tema: ['sextou', 'fds', 'happy', 'jogo'],
  uso: 'Sextou, fim de semana ou dia de jogo: o título como adesivo girado e o selo grande, numa leitura em diagonal.',
  aceita: ['tag', 'titulo', 'apoio', 'preco', 'selo', 'cta', 'legal'], textos: { titulo: 24, apoio: 48, legal: 90 }, casos: ['b02', 'b01'],
  serve: sp => sp.selo.length > 0,   // a diagonal precisa do selo do outro lado
  busca: { kh: [0.9, 1.3], rot: [-8, -5], sr: [130, 165] },
  comp(sp, a, p){
    const W = a.W - 2 * a.M, rot = Math.round(p.rot), S = _ccSelo(sp, Math.round(p.sr));
    const T = _ccTitulo(sp, a, W - 60, Math.round(190 * p.kh), { linhas: 3, iguala: true, alt: Math.round((a.fim - a.top) * 0.36) });
    if(!T) return null;
    // o giro tira o texto da caixa: a caixa ganha folga para a tinta girada não sair da margem
    const fol = Math.ceil(Math.abs(Math.sin(rot * Math.PI / 180)) * (W - 60) / 2) + 10;
    const Tg = Object.assign({}, T, { rot, contorno: true, h: T.h, w: W - 60 });
    const G = _ccTag(sp, 36), topo = _ccPilha([{ b: _ccLogo(a), grupo: 'marca' }, { b: G, vao: 56, grupo: 'msg' }, { b: Tg, vao: (G ? 28 : 56) + fol, grupo: 'msg' }], a.M, a.top, a.fim, 'topo');
    if(!topo) return null;
    const t = topo.find(b => b.bloco === 'titulo'); t.x += 30;
    const P = sp.precoPor ? _ccPreco(sp, S ? W - S.w - 60 : W, 170, false) : null;
    const base = _ccPilha([{ b: _ccApoio(sp, S ? W - S.w - 60 : W, 40), grupo: 'msg' }, { b: P, vao: 40, grupo: 'oferta' }, { b: _ccCta(sp, a), vao: 56, grupo: 'acao' }, { b: _ccLegal(sp, W), vao: 32, grupo: 'acao' }], a.M, _ccFim(topo) + fol + 40, a.fim, 'base');
    if(!base) return null;
    const bs = topo.concat(base);
    if(S){ const y0 = _ccFim(topo) + fol + 30, y1 = (base.find(b => b.bloco === 'legal') || { y: a.fim }).y - 30; if(y1 - y0 < S.h) return null; bs.push(Object.assign(S, { x: a.W - a.M - S.w, y: Math.round(y0 + (y1 - y0 - S.h) * 0.35) })); }
    // o grafismo confere contra a tinta GIRADA do título (a caixa cresce com o giro)
    const inch = bs.map(b => b === t ? Object.assign({}, b, { x: b.x - 30, w: b.w + 60, y: b.y - fol, h: b.h + 2 * fol }) : b);
    const much = sp.marca === 'much', gr = [_ccCanto(inch, a, sp, much ? 'estrela-amarela' : 'explosao', 'td', much ? 180 : 300, 10)].filter(Boolean);
    return { ideia: 'Título adesivo girado e selo grande na diagonal', blocos: _ccBlocos(bs), grafismos: gr };
  } });

// F9 · Feed · tipográfica alinhada à DIREITA: o título em bloco igualado encostado na margem direita,
// o apoio e o botão no mesmo eixo; a textura de arcos sangra no canto oposto.
crComposicao({ id: 'chuvaTipografica', nome: 'Tipográfica à direita', grupo: 'B', formato: 'feed', objetivos: ['evento', 'aviso', 'oferta', 'prospeccao'], foto: false, tema: ['chuva', 'madrugada', 'janta', 'domingo', 'jogo', 'entregando', 'pecaApp'],
  uso: 'Frase de ocasião sem foto ("Chove, a gente leva", "Bateu a fome?"): o título em bloco alinhado à direita, com respiro.',
  aceita: ['tag', 'titulo', 'apoio', 'cta', 'legal', 'selo', 'preco', 'horario'], textos: { titulo: 32, apoio: 60, legal: 90 }, casos: ['b06', 'b05', 'b04'],
  busca: { kh: [0.9, 1.35], dist: ['espalha', 'ancora'], larg: [0.8, 1] },
  comp(sp, a, p){
    const W = a.W - 2 * a.M, X = a.W - a.M, wt = Math.round(W * p.larg);
    const T = _ccTitulo(sp, a, wt, Math.round(200 * p.kh), { linhas: 4, iguala: true, alt: Math.round((a.fim - a.top) * 0.46) });
    if(!T) return null;
    const P = sp.precoPor ? _ccPreco(sp, W * 0.8, 150, false) : null, S = _ccSelo(sp, 100), H = sp.horario ? { bloco: 'horario', w: wt, h: 130, max: 96 } : null;
    const col = _ccPilha([{ b: _ccLogo(a), grupo: 'marca' }, { b: _ccTag(sp, 36), vao: 56, grupo: 'msg' }, { b: T, vao: 32, grupo: 'msg' }, { b: H, vao: 28, grupo: 'msg' }, { b: _ccApoio(sp, wt, 42), vao: 24, grupo: 'msg' },
      { b: P, vao: 56, grupo: 'oferta' }, { b: _ccCta(sp, a), vao: 64, grupo: 'acao', ancora: true }, { b: _ccLegal(sp, W), vao: 32, grupo: 'acao' }], X, a.top, a.fim, p.dist, 'dir');
    if(!col) return null;
    col.forEach(b => { if(b.bloco === 'preco'){ b.x = X - b.larg; b.w = b.larg; } });
    const bs = col.slice();
    if(S){ const t = col.find(b => b.bloco === 'titulo'); bs.push(Object.assign(S, { x: a.M, y: t.y })); if(bs.some(b => b !== S && b.bloco !== 'selo' && b.x < S.x + S.w + 20 && b.y < S.y + S.h && b.y + b.h > S.y)) bs.pop(); }
    const much = sp.marca === 'much', gr = [_ccCanto(bs, a, sp, much ? 'mais-amarelo' : 'pattern-macarrao', 'be', much ? 360 : 560, 0)].filter(Boolean);
    return { ideia: 'Título em bloco alinhado à direita, textura no canto oposto', blocos: _ccBlocos(bs), grafismos: gr };
  } });

// S6 · Story · uma placa amarela girada atravessa o meio da tela com o título em laranja (o par de
// display da marca); o resto respira em volta: logo em cima, oferta e botão embaixo.
crComposicao({ id: 'sextouStory', nome: 'Placa amarela girada', grupo: 'B', formato: 'story', objetivos: ['oferta', 'evento'], foto: false, tema: ['sextou', 'fds', 'happy', 'jogo', 'janta'],
  uso: 'Sextou, fim de semana, happy hour ou jogo no story: o título numa placa amarela girada no meio da tela.',
  aceita: ['tag', 'titulo', 'apoio', 'preco', 'selo', 'cta', 'legal', 'horario'], textos: { titulo: 28, apoio: 48, legal: 90 }, casos: ['b02', 'b01', 'e04'],
  busca: { kh: [0.95, 1.4], rot: [-6, -3], pad: [56, 96] },
  comp(sp, a, p){
    const W = a.W - 2 * a.M, X = a.W / 2, rot = Math.round(p.rot);
    // a placa cresce com o título (o respiro dentro dela é parâmetro da busca)
    const T = _ccTitulo(sp, a, W - 80, Math.round(210 * p.kh), { linhas: 3, iguala: true, alt: Math.round((a.fim - a.top) * 0.34) });
    if(!T) return null;
    const ph = T.h + 2 * Math.round(p.pad);
    const P = sp.precoPor ? _ccPreco(sp, W, 170, false) : null, S = _ccSelo(sp, 110);
    const lin = P && S ? { bloco: '_linha', w: P.larg + 40 + S.w, h: Math.max(P.h, S.h) } : P || S;
    const H = sp.horario ? { bloco: 'horario', w: W, h: 130, max: 96 } : null;
    const col = _ccPilha([{ b: _ccLogo(a), grupo: 'marca' }, { b: _ccTag(sp, 40), vao: 80, grupo: 'msg' }, { b: { bloco: '_placa', w: W + 60, h: ph }, vao: 60, grupo: 'msg' },
      { b: H, vao: 60, grupo: 'oferta' }, { b: _ccApoio(sp, W, 44), vao: 40, grupo: 'oferta' }, { b: lin, vao: 48, grupo: 'oferta' }, { b: _ccCta(sp, a), vao: 72, grupo: 'acao' }, { b: _ccLegal(sp, W), vao: 32, grupo: 'acao' }], X, a.top, a.fim, 'espalha', 'centro');
    if(!col) return null;
    const pi = col.findIndex(b => b.bloco === '_placa'), pl = col[pi];
    col.splice(pi, 1, Object.assign({}, T, { x: a.M + 40, y: pl.y + Math.round((ph - T.h) / 2), w: W - 80, rot, alinhar: 'centro' }));
    const li = col.findIndex(b => b.bloco === '_linha');
    if(li >= 0){ const l = col[li]; col.splice(li, 1, Object.assign({}, P, { x: l.x, y: l.y + Math.round((l.h - P.h) / 2), w: P.larg, alinhar: 'esq' }), Object.assign({}, S, { x: l.x + P.larg + 40, y: l.y + Math.round((l.h - S.h) / 2), alinhar: 'esq' })); }
    col.forEach(b => { if((b.bloco === 'preco' && li < 0) || b.bloco === 'apoio' || b.bloco === 'legal' || b.bloco === 'horario'){ b.x = a.M; b.w = W; } });
    const much = sp.marca === 'much', gr = [_ccCanto(col, a, sp, much ? 'mais-amarelo' : 'explosao', 'td', much ? 300 : 340, 10), _ccCanto(col, a, sp, 'estrela-amarela', 'be', 190, 0)].filter(Boolean);
    return { ideia: 'Título numa placa amarela girada no meio da tela', zonas: [{ x: a.M - 30, y: pl.y, w: W + 60, h: ph, cor: 'amarelo', rx: 44, rot }], blocos: _ccBlocos(col), grafismos: gr };
  } });

// S7 · Story · a noite: o título grande alinhado à esquerda, o texto distribuído na altura e o céu
// nos vãos — uma ou duas estrelas amarelas grandes e brancas pequenas, sempre longe do texto.
crComposicao({ id: 'madrugadaStory', nome: 'Céu de estrelas', grupo: 'B', formato: 'story', objetivos: ['evento', 'oferta'], foto: false, tema: ['madrugada', 'janta', 'natal'],
  uso: 'Madrugada, janta ou noite especial no story: o título grande e estrelas espalhadas nos vãos, como um céu.',
  aceita: ['tag', 'titulo', 'apoio', 'preco', 'selo', 'cta', 'legal', 'horario'], textos: { titulo: 36, apoio: 60, legal: 90 }, casos: ['b05', 'b04', 'e07'],
  busca: { kh: [1, 1.5], dist: ['espalha', 'centro'] },
  comp(sp, a, p){
    const W = a.W - 2 * a.M;
    const P = sp.precoPor ? _ccPreco(sp, W, 170, false) : null, H = sp.horario ? { bloco: 'horario', w: W, h: 130, max: 100 } : null, S = _ccSelo(sp, 120);
    const T = _ccTitulo(sp, a, W, Math.round(220 * p.kh), { linhas: 4, iguala: true, alt: Math.round((a.fim - a.top) * (P ? 0.3 : 0.4)) });
    if(!T) return null;
    const col = _ccPilha([{ b: _ccLogo(a), grupo: 'marca' }, { b: _ccTag(sp, 40), vao: 72, grupo: 'msg' }, { b: T, vao: 28, grupo: 'msg' }, { b: H, vao: 32, grupo: 'msg' }, { b: _ccApoio(sp, W, 44), vao: 28, grupo: 'msg' },
      { b: P, vao: 64, grupo: 'oferta' }, { b: _ccCta(sp, a), vao: 72, grupo: 'acao' }, { b: _ccLegal(sp, W), vao: 32, grupo: 'acao' }], a.M, a.top, a.fim, p.dist);
    if(!col) return null;
    const bs = col.slice();
    // o selo: no canto de cima, na linha do logo (é a data/o destaque da noite); sem lugar, a composição não serve
    if(S){ bs.push(Object.assign(S, { x: a.W - a.M - S.w, y: a.top })); if(bs.some(b => b !== S && b.y < S.y + S.h + 20 && b.y + b.h > S.y && b.x + b.w > S.x - 20)) return null; }
    // o céu: candidatas fixas (frações da tela); entram as que não encostam em nada, até 2 amarelas e 4 brancas
    const gr = [], cands = [['estrela-amarela', 0.62, 0.17, 190], ['estrela-amarela', 0.74, 0.52, 150], ['estrela-amarela', 0.1, 0.62, 120], ['estrela-amarela', 0.66, 0.74, 160],
      ['estrela-branca', 0.22, 0.2, 70], ['estrela-branca', 0.86, 0.3, 60], ['estrela-branca', 0.42, 0.33, 48], ['estrela-branca', 0.86, 0.62, 56], ['estrela-branca', 0.16, 0.8, 60], ['estrela-branca', 0.5, 0.85, 48]];
    cands.forEach(([id, fx, fy, w]) => {
      if(gr.filter(g => g.asset === id).length >= (id === 'estrela-amarela' ? 2 : 4)) return;
      const g = _ccSolta(bs.concat(gr.map(x => ({ bloco: 'decor', x: x.x - 30, y: x.y - 30, w: x.w + 60, h: x.w + 60 }))), sp, id, a.W * fx, a.H * fy, w, 0);
      if(g) gr.push(g);
    });
    if(!gr.some(g => g.asset === 'estrela-amarela')) return null;   // sem céu não é esta composição
    return { ideia: 'Título grande e estrelas nos vãos, como um céu', blocos: _ccBlocos(bs), grafismos: gr };
  } });

// S8 · Story · um cartão branco no meio da tela (o cardápio do dia) com o título em laranja, o apoio
// em grafite e o preço; com foto, ela abre o cartão. O botão fica fora, embaixo; o sorriso sangra.
crComposicao({ id: 'domingoDoce', nome: 'Cartão branco', grupo: 'B', formato: 'story', objetivos: ['evento', 'oferta'], foto: true, tema: ['domingo', 'fds', 'maes', 'namorados', 'natal', 'janta'],
  uso: 'Domingo, data especial ou janta com foto no story: a foto e o texto num cartão branco no meio da tela, como um cardápio.',
  aceita: ['tag', 'titulo', 'apoio', 'preco', 'selo', 'cta', 'legal', 'foto'], textos: { titulo: 32, apoio: 60, legal: 90 }, casos: ['b03', 'e01', 'b04'],
  busca: { kh: [0.85, 1.25], fh: [320, 500] },
  comp(sp, a, p){
    const pad = 56, cw = a.W - 2 * a.M + 40, cx = a.M - 20, W = cw - 2 * pad, X = a.W / 2;
    const T = _ccTitulo(sp, a, W, Math.round(170 * p.kh), { linhas: 3, iguala: true, alt: 300 });
    if(!T) return null;
    const F = sp.foto ? { bloco: 'foto', w: cw - 48, h: Math.round(p.fh), rx: 32 } : null;   // a foto abre o cartão, com a borda dele
    const dentro = [{ b: _ccTag(sp, 36), grupo: 'msg' }, { b: T, vao: 28, grupo: 'msg' }, { b: _ccApoio(sp, W, 42), vao: 24, grupo: 'msg' }, { b: _ccPreco(sp, W, 140, false), vao: 40, grupo: 'oferta' }];
    const hDentro = dentro.filter(i => i.b).reduce((s, i, k) => s + i.b.h + (k ? i.vao || 0 : 0), 0), ch = hDentro + 2 * pad + (F ? F.h + 24 - pad / 2 : 0);
    const C = _ccCta(sp, a), LG = _ccLegal(sp, a.W - 2 * a.M);
    const col = _ccPilha([{ b: _ccLogo(a), grupo: 'marca' }, { b: { bloco: '_cartao', w: cw, h: ch }, vao: 56, grupo: 'card' }, { b: C, vao: 56, grupo: 'acao' }, { b: LG, vao: 32, grupo: 'acao' }], X, a.top, a.fim, 'espalha', 'centro');
    if(!col) return null;
    const ci = col.findIndex(b => b.bloco === '_cartao'), card = col[ci];
    const y0 = card.y + (F ? F.h + 24 + pad / 2 : pad), mio = _ccPilha(dentro, X, y0, y0 + hDentro, 'topo', 'centro');
    if(!mio) return null;
    mio.forEach(b => { if(b.bloco === 'preco' || b.bloco === 'apoio'){ b.x = cx + pad; b.w = W; } });
    col.splice(ci, 1);
    col.forEach(b => { if(b.bloco === 'legal'){ b.x = a.M; b.w = a.W - 2 * a.M; } });
    const bs = col.concat(mio, F ? [Object.assign(F, { x: cx + 24, y: card.y + 24 })] : []), S = _ccSelo(sp, 105);
    if(S) bs.push(Object.assign(S, { x: a.W - a.M - S.w, y: card.y - Math.round(S.h * 0.45) }));
    const much = sp.marca === 'much', gr = [_ccCanto(bs, a, sp, much ? 'mais-amarelo' : 'sorriso-arco', 'bd', much ? 340 : 560, 0)].filter(Boolean);
    return { ideia: 'Tudo num cartão branco no meio da tela', zonas: [{ x: cx, y: card.y, w: cw, h: ch, cor: 'branco', rx: 48, sombra: true }], blocos: _ccBlocos(bs), grafismos: gr };
  } });

