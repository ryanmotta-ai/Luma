/**
 * js/creative/making-of.js
 *
 * MAKING-OF da arte (frente 6, 15/10/2026) — a arte final se fazendo na frente da pessoa, como se
 * alguém a montasse no editor: um cursor simulado PEGA cada bloco na beirada e ARRASTA até o lugar,
 * CLICA no texto e DIGITA o conteúdo real (letra a letra, com o cursor de texto), e REDIMENSIONA o
 * título pela alça do canto. A mão é de gente: curvas de Bézier, easeInOutCubic, micro-tremor de 8–13
 * Hz, e o gerador tem semente fixa (a mesma arte se faz sempre do mesmo jeito). 6–8 s, botão "Pular";
 * com movimento reduzido não há making-of (a arte já está pronta embaixo).
 * Só transform e opacity se animam, tudo pré-calculado em Web Animations (sem laço de rAF). A digitação
 * não mexe no texto (o kerning fica intacto): um clipPath por linha abre em degraus, letra a letra.
 * A camada fica POR CIMA do container e sai no fim: o que a pessoa baixa continua sendo o arquivo (a
 * <img> de quem chama) — o making-of nunca toca nele. Independente do Creative (não lê nada cr*): o
 * Franqueado pode usar do mesmo jeito.
 *
 *   crMakingOf(container, svgFinal, opcoes) → { ativo, pronto: Promise<'fim'|'pulou'|'direto'>, pular() }
 *     container   elemento posicionado (relative) do tamanho da arte; a camada entra nele
 *     svgFinal    o SVG da arte, com os blocos no 1º nível como <g data-bloco="nome">
 *     opcoes      duracao (ms, 6000–8000; padrão 7000) · semente (número) · css (regras extras para o
 *                 shadow root — as fontes do app, já que @font-face não vale lá dentro) · nomes
 *                 ({ bloco: 'Rótulo' } da caixa de seleção) · autor (etiqueta do cursor) ·
 *                 redimensiona (o bloco que ganha a alça; padrão 'titulo') ·
 *                 botao (false = o "Pular" fica com quem chama, via pular())
 *     'direto'    não houve making-of (movimento reduzido, SVG inválido, sem blocos, container sem tamanho)
 */

const CR_MK_CSS = ':host{position:absolute;inset:0;z-index:2;overflow:hidden;pointer-events:none;contain:layout paint}'
  + '.mk-arte{position:absolute;inset:0;display:block;width:100%;height:100%}'
  + '.mk-arte > [data-bloco]{transform-box:fill-box;transform-origin:center}'
  + '.mk-sel{position:absolute;box-sizing:border-box;border:1.5px solid var(--d-sel);border-radius:2px;transform-origin:0 0;opacity:0}'
  + '.mk-sel i{position:absolute;width:6px;height:6px;box-sizing:border-box;background:var(--white);border:1.5px solid var(--d-sel)}'
  + '.mk-sel i:nth-child(1){left:-4px;top:-4px}.mk-sel i:nth-child(2){right:-4px;top:-4px}.mk-sel i:nth-child(3){left:-4px;bottom:-4px}.mk-sel i:nth-child(4){right:-4px;bottom:-4px}'
  + '.mk-sel b{position:absolute;left:-1.5px;bottom:100%;margin-bottom:4px;padding:1px 5px;border-radius:3px;background:var(--d-sel);color:var(--white);font:600 10px/1.4 system-ui,sans-serif;white-space:nowrap}'
  + '.mk-sel.mk-rente b{bottom:auto;top:3px;left:3px;margin:0}'
  + '.mk-car{position:absolute;left:0;top:0;width:2px;height:100px;margin-left:-1px;background:var(--d-sel);transform-origin:0 0;opacity:0}'
  + '.mk-cur{position:absolute;left:0;top:0;will-change:transform}'
  + '.mk-cur svg{display:block;transform-origin:2px 2px;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.35))}'
  + '.mk-cur span{position:absolute;left:15px;top:17px;padding:2px 7px;border-radius:999px;background:var(--d-sel);color:var(--white);font:600 10px/1.4 system-ui,sans-serif;white-space:nowrap}'
  + '.mk-pular{position:absolute;right:8px;bottom:8px;pointer-events:auto;cursor:pointer;display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 10px;'
  + 'border:0;border-radius:999px;background:rgba(10,10,10,.72);color:var(--white);font:600 11px/1 system-ui,sans-serif}'
  + '.mk-pular:focus-visible{outline:2px solid var(--dm-orange);outline-offset:2px}';

// Gerador com semente (mulberry32): o caminho do cursor é sempre o mesmo para a mesma semente
function _crMkSorte(s){
  let a = s >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const _crMkSuave = u => u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;   // easeInOutCubic: arranca e assenta como a mão
const _crMkBez = (p0, c1, c2, p1, u) => { const v = 1 - u; return v * v * v * p0 + 3 * v * v * u * c1 + 3 * v * u * u * c2 + u * u * u * p1; };
// Token de motion lido do CSS (nunca número solto — motion.md §1)
const _crMkTok = (t, pad) => { const v = getComputedStyle(document.documentElement).getPropertyValue(t).trim(); return v ? (/ms$|^\d/.test(v) ? parseFloat(v) || pad : v) : pad; };

function crMakingOf(container, svgFinal, opcoes){
  const op = opcoes || {};
  const nada = { ativo: false, pronto: Promise.resolve('direto'), pular(){} };
  if(!container || !svgFinal || !Element.prototype.animate) return nada;
  if(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return nada;
  let svg;
  try{
    const doc = new DOMParser().parseFromString(svgFinal, 'image/svg+xml');
    if(doc.querySelector('parsererror') || doc.documentElement.nodeName !== 'svg') return nada;
    svg = document.importNode(doc.documentElement, true);
  }catch(e){ return nada; }
  const W = container.clientWidth, H = container.clientHeight;
  if(!W || !H || !svg.querySelector(':scope > [data-bloco]')) return nada;

  const NS = 'http://www.w3.org/2000/svg';
  const host = document.createElement('span'), raiz = host.attachShadow({ mode: 'open' }), st = document.createElement('style');
  st.textContent = CR_MK_CSS + (op.css || '');
  svg.classList.add('mk-arte'); svg.setAttribute('aria-hidden', 'true');
  raiz.append(st, svg);
  container.appendChild(host);

  /* ── 1. Medidas, todas antes da 1ª animação. Px do container; k absorve a escala de ancestral animado. ── */
  const hr = host.getBoundingClientRect(), k = W / (hr.width || W);
  const ctm = svg.getScreenCTM(), uPx = ctm ? Math.hypot(ctm.a, ctm.b) * k : 1;   // px por unidade do SVG
  const emPx = (el, x, y) => { const m = el.getScreenCTM(); return { x: (m.a * x + m.c * y + m.e - hr.left) * k, y: (m.b * x + m.d * y + m.f - hr.top) * k }; };
  const caixa = r => ({ x0: (r.left - hr.left) * k, y0: (r.top - hr.top) * k, x1: (r.right - hr.left) * k, y1: (r.bottom - hr.top) * k });
  const lim = (v, a, b) => Math.max(a, Math.min(b, v));
  const K0 = 0.84, redim = op.redimensiona === undefined ? 'titulo' : op.redimensiona;
  const blocos = [];
  svg.querySelectorAll(':scope > [data-bloco]').forEach(g => {
    const c = caixa(g.getBoundingClientRect()), x0 = Math.max(0, c.x0), y0 = Math.max(0, c.y0), w = Math.min(W, c.x1) - x0, h = Math.min(H, c.y1) - y0;
    if(w <= 1 || h <= 1) return;
    const b = { g, nome: g.dataset.bloco || '', x0, y0, w, h, textos: [], nc: 0 };
    let tb = null;
    g.querySelectorAll('text').forEach(tx => {
      if(tx.closest('defs,clipPath,mask,pattern,symbol,marker') || tx.getAttribute('clip-path') || tx.style.clipPath) return;
      try{
        const n = tx.getNumberOfChars(); if(!n) return;
        const cs = []; for(let i = 0; i < n; i++) cs.push(tx.getExtentOfChar(i));
        const r = caixa(tx.getBoundingClientRect());
        tb = tb ? { x0: Math.min(tb.x0, r.x0), y0: Math.min(tb.y0, r.y0), x1: Math.max(tb.x1, r.x1), y1: Math.max(tb.y1, r.y1) } : r;
        b.textos.push({ tx, cs }); b.nc += n;
      }catch(e){ /* texto sem layout: entra junto com o bloco */ }
    });
    // texto que domina o bloco é digitado; o resto (foto com rótulo, grafismo) é arrastado — ou, se ocupa a arte, só assenta
    b.tipo = tb && b.nc <= 160 && (tb.x1 - tb.x0) * (tb.y1 - tb.y0) >= 0.2 * w * h ? 'texto' : w * h > 0.45 * W * H ? 'grande' : 'arrasta';
    if(b.tipo !== 'texto') b.textos = [];
    blocos.push(b);
  });
  if(!blocos.length){ host.remove(); return nada; }
  // O título nasce a K0 do tamanho, preso no canto de cima à esquerda, e a alça do canto o leva ao tamanho final
  const tit = blocos.find(b => b.tipo === 'texto' && b.nome === redim && !b.g.getAttribute('transform'));
  if(tit) try{
    const bb = tit.g.getBBox(), O = emPx(tit.g, bb.x, bb.y), C = emPx(tit.g, bb.x + bb.width, bb.y + bb.height);
    Object.assign(tit, { redim: true, O, canto: C, cantoK: { x: O.x + (C.x - O.x) * K0, y: O.y + (C.y - O.y) * K0 } });
  }catch(e){ /* sem bbox: o título só é digitado */ }
  const esc = (b, p) => b.redim ? { x: b.O.x + (p.x - b.O.x) * K0, y: b.O.y + (p.y - b.O.y) * K0 } : p;
  // Digitação: linhas de cada texto (faixas sem sobreposição) e onde o cursor de texto fica depois de cada letra
  blocos.forEach(b => b.textos.forEach(x => {
    const ls = []; let L = null;
    x.cs.forEach((e, i) => {
      const cy = e.y + e.height / 2;
      if(!L || Math.abs(cy - L.cy) > 0.5 * Math.max(e.height, 1)){ L = { cy, top: e.y, bot: e.y + e.height, x0: e.x, x1: e.x + e.width, cs: [] }; ls.push(L); }
      L.cs.push(i); L.top = Math.min(L.top, e.y); L.bot = Math.max(L.bot, e.y + e.height); L.x0 = Math.min(L.x0, e.x); L.x1 = Math.max(L.x1, e.x + e.width);
    });
    const pad = 0.3 * Math.max(...ls.map(l => l.bot - l.top), 1);
    x.bx0 = Math.min(...ls.map(l => l.x0)) - pad; x.bw = Math.max(...ls.map(l => l.x1)) + pad - x.bx0;
    ls.forEach((l, j) => {
      l.y0 = j ? (ls[j - 1].cy + l.cy) / 2 : l.top - 2 * pad;
      l.y1 = j < ls.length - 1 ? (l.cy + ls[j + 1].cy) / 2 : l.bot + 2 * pad;
      if(l.y1 <= l.y0){ l.y0 = l.top - pad; l.y1 = l.bot + pad; }
    });
    x.ls = ls;
    const barra = (xx, e) => { const a = esc(b, emPx(x.tx, xx, e.y)), z = esc(b, emPx(x.tx, xx, e.y + e.height)); return 'translate(' + a.x.toFixed(2) + 'px,' + a.y.toFixed(2) + 'px) rotate(' + (Math.atan2(z.y - a.y, z.x - a.x) * 57.2958 - 90).toFixed(2) + 'deg) scaleY(' + (Math.hypot(z.x - a.x, z.y - a.y) / 100).toFixed(4) + ')'; };
    x.car0 = barra(x.cs[0].x, x.cs[0]);
    x.car = x.cs.map(e => barra(e.x + e.width, e));
  }));

  /* ── 2. Linha do tempo: entra (4%) · cada bloco no seu compasso até 86% · sai (até 95%) · respira ── */
  const T = Math.max(6000, Math.min(8000, +op.duracao || 7000));
  const dEnt = _crMkTok('--dur-slow', 420), dSel = _crMkTok('--dur-fast', 180), dSai = _crMkTok('--dur-base', 260);
  const eOut = _crMkTok('--ease-out', 'ease-out'), eIn = _crMkTok('--ease-in', 'ease-in');
  const sorte = _crMkSorte(op.semente == null ? 20261015 : op.semente);
  const A = 0.04 * T, B = 0.86 * T;
  const pesoDig = b => 0.25 + Math.min(b.nc, 40) / 40;
  const peso = b => b.tipo === 'arrasta' ? 1 : b.tipo === 'grande' ? 0.55 : 0.45 + pesoDig(b) + (b.redim ? 0.7 : 0);
  const u = (B - A) / blocos.reduce((s, b) => s + peso(b), 0);
  const ent = { x: W * 1.08, y: H * 0.92 }, sai = { x: W * 1.1, y: H * 1.06 };
  const trechos = [], apertos = [];
  // Um trecho por movimento: Bézier cúbica com a curva da mão (controles deslocados para um lado; curvo 0 = reto)
  const trecho = (p0, p1, t0, dur, curvo) => {
    const dx = p1.x - p0.x, dy = p1.y - p0.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const curva = L * (0.08 + 0.16 * sorte()) * (sorte() < 0.78 ? 1 : -1) * curvo;
    return { p0, p1, t0, dur, c1: { x: p0.x + dx * 0.25 + nx * curva, y: p0.y + dy * 0.25 + ny * curva }, c2: { x: p0.x + dx * 0.78 + nx * curva * 0.45, y: p0.y + dy * 0.78 + ny * curva * 0.45 } };
  };
  let t = A, cp = ent;
  const anda = (p1, dur, curvo) => { trechos.push(trecho(cp, p1, t, dur, curvo)); t += dur; cp = p1; };
  blocos.forEach(b => {
    const alvo = { x: lim(b.x0 + b.w * (0.26 + 0.14 * sorte()), 6, W - 6), y: lim(b.y0 + b.h * (0.34 + 0.16 * sorte()), 6, H - 6) };
    if(b.tipo === 'arrasta'){
      // pega o bloco do lado da beirada mais perto e arrasta até o lugar
      const lado = b.x0 + b.w / 2 < W / 2 ? -1 : 1;
      const pega = { x: lim(alvo.x + lado * (0.16 * W + 0.3 * b.w), 0.04 * W, 0.96 * W), y: lim(alvo.y + (sorte() - 0.5) * 0.12 * H, 0.04 * H, 0.96 * H) };
      if(Math.abs(pega.x - alvo.x) < 0.08 * W) pega.y = lim(alvo.y + (alvo.y < H / 2 ? 1 : -1) * 0.16 * H, 0.04 * H, 0.96 * H);
      anda(pega, 0.45 * u, 1);
      b.tSel = t; b.arrasto = [t];
      anda(alvo, 0.45 * u, 0.35);
      b.arrasto.push(t); apertos.push(b.arrasto.slice());
      t += 0.1 * u;
    } else if(b.tipo === 'grande'){
      anda(alvo, 0.4 * u, 1); b.tSel = t; apertos.push([t, t + 90]); t += 0.15 * u;
    } else {
      // clica no começo do texto e digita; o título ainda ganha a alça
      const x = b.textos[0], pc = esc(b, emPx(x.tx, x.cs[0].x + x.cs[0].width * 0.2, x.cs[0].y + x.cs[0].height * 0.55));
      anda({ x: lim(pc.x, 4, W - 4), y: lim(pc.y, 4, H - 4) }, 0.4 * u, 1); b.tSel = t; apertos.push([t, t + 90]);
      const dig = pesoDig(b) * u; b.digita = [t + 90, t + dig * 0.92]; t += dig;
      if(b.redim){
        anda(b.cantoK, 0.3 * u, 1);
        b.tz = [t]; anda(b.canto, 0.4 * u, 0); b.tz.push(t); apertos.push(b.tz.slice());
      }
      t += 0.05 * u;
    }
    b.tSai = t + 0.12 * u;
  });
  anda(sai, Math.max(0.04 * T, Math.min(0.09 * T, 0.97 * T - t)), 1);
  // Micro-tremor: duas senoides de fase sorteada na faixa do tremor fisiológico (8–13 Hz), sub-pixel
  const amp = Math.max(0.35, W * 0.0018), f = [8 + 2 * sorte(), 12 + sorte(), 9 + 2 * sorte(), 13 + sorte()], fi = [0, 0, 0, 0].map(() => sorte() * 6.283);
  const ondeEsta = tt => {
    let p = ent;
    for(const tr of trechos){
      if(tt < tr.t0) break;
      const v = _crMkSuave(Math.min(1, (tt - tr.t0) / tr.dur));
      p = { x: _crMkBez(tr.p0.x, tr.c1.x, tr.c2.x, tr.p1.x, v), y: _crMkBez(tr.p0.y, tr.c1.y, tr.c2.y, tr.p1.y, v) };
    }
    const r = tt / 1000 * 6.283;
    return { x: p.x + amp * (Math.sin(f[0] * r + fi[0]) + 0.5 * Math.sin(f[1] * r + fi[1])), y: p.y + amp * (Math.sin(f[2] * r + fi[2]) + 0.5 * Math.sin(f[3] * r + fi[3])) };
  };

  /* ── 3. Animações ── */
  const anims = [], ani = (el, kf, o) => { const a = el.animate(kf, o); anims.push(a); return a; };
  // keyframes com offset crescente dentro de [0,1] (compassos curtos não podem cruzar)
  const quadrosDe = pts => { let o = 0; return pts.map(([tt, v]) => { o = Math.max(o, Math.min(1, tt / T)); return Object.assign({ offset: o }, v); }); };
  // keyframes amostrados a 60 por segundo entre t0 e t1 (interpolação linear entre eles)
  const amostra = (t0, t1, fn) => { const n = Math.max(2, Math.ceil((t1 - t0) / (1000 / 60))), q = []; for(let i = 0; i <= n; i++) q.push(Object.assign({ offset: i / n }, fn(t0 + (t1 - t0) * i / n))); return q; };
  const passo = 'steps(1,end)';
  let defs = svg.querySelector(':scope > defs'), nClip = 0;
  if(!defs){ defs = document.createElementNS(NS, 'defs'); svg.insertBefore(defs, svg.firstChild); }
  const car = document.createElement('span'), carPos = [[0, { transform: 'translate(-9px,0px)', easing: passo }]], carVis = [[0, { opacity: 0, easing: passo }]];
  car.className = 'mk-car'; car.setAttribute('aria-hidden', 'true');

  blocos.forEach(b => {
    const sel = document.createElement('span');
    sel.className = 'mk-sel' + (b.y0 < 18 ? ' mk-rente' : '');
    sel.setAttribute('aria-hidden', 'true');
    sel.style.cssText = 'left:' + b.x0.toFixed(1) + 'px;top:' + b.y0.toFixed(1) + 'px;width:' + b.w.toFixed(1) + 'px;height:' + b.h.toFixed(1) + 'px';
    sel.innerHTML = '<i></i><i></i><i></i><i></i><b></b>';
    sel.querySelector('b').textContent = (op.nomes && op.nomes[b.nome]) || (b.nome.charAt(0).toUpperCase() + b.nome.slice(1));
    raiz.appendChild(sel);
    ani(sel, quadrosDe([[0, { opacity: 0 }], [b.tSel - 20, { opacity: 0 }], [b.tSel + dSel, { opacity: 1 }], [b.tSai, { opacity: 1 }], [b.tSai + dSel, { opacity: 0 }], [T, { opacity: 0 }]]), { duration: T, fill: 'both' });

    if(b.tipo === 'arrasta'){
      // o bloco anda colado no cursor (tremor junto) e assenta exatamente no lugar quando ele solta
      const [tg, tr] = b.arrasto, fim = ondeEsta(tr), desl = tt => { const p = ondeEsta(tt); return { x: p.x - fim.x, y: p.y - fim.y }; };
      ani(b.g, [{ opacity: 0 }, { opacity: 1 }], { duration: dSel, delay: tg - 40, easing: eOut, fill: 'both' });
      ani(b.g, amostra(tg, tr, tt => { const d = desl(tt); return { translate: (d.x / uPx).toFixed(2) + 'px ' + (d.y / uPx).toFixed(2) + 'px' }; }), { duration: tr - tg, delay: tg, fill: 'both' });
      ani(sel, amostra(tg, tr, tt => { const d = desl(tt); return { transform: 'translate(' + d.x.toFixed(2) + 'px,' + d.y.toFixed(2) + 'px)' }; }), { duration: tr - tg, delay: tg, fill: 'both' });
    } else if(b.tipo === 'grande'){
      ani(b.g, [{ opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1 }], { duration: dEnt, delay: b.tSel, easing: eOut, fill: 'both' });
    } else {
      // o que não é texto (pílula, placa, botão) aparece no clique; o texto abre letra a letra
      ani(b.g, [{ opacity: 0 }, { opacity: 1 }], { duration: dSel, delay: b.tSel, easing: eOut, fill: 'both' });
      const [d0, d1] = b.digita, ws = [];
      b.textos.forEach(x => x.cs.forEach(() => ws.push(0.6 + 0.8 * sorte())));
      const tot = ws.reduce((a, c) => a + c, 0);
      let acc = 0, ix = 0;
      carVis.push([b.tSel + 60, { opacity: 1, easing: passo }], [d1 + 260, { opacity: 0, easing: passo }]);
      b.textos.forEach((x, xi) => {
        const ts = x.cs.map(() => { acc += ws[ix++]; return d0 + (d1 - d0) * acc / tot; });
        carPos.push([xi ? ts[0] - 1 : b.tSel + 60, { transform: x.car0, easing: passo }]);
        x.cs.forEach((e, ci) => carPos.push([ts[ci], { transform: x.car[ci], easing: passo }]));
        const cl = document.createElementNS(NS, 'clipPath');
        cl.id = 'mk-dig-' + (nClip++); cl.setAttribute('clipPathUnits', 'userSpaceOnUse');
        const S = s => 'translate(' + x.bx0.toFixed(2) + 'px,0px) scaleX(' + s + ') translate(' + (-x.bx0).toFixed(2) + 'px,0px)';
        x.ls.forEach(l => {
          const r = document.createElementNS(NS, 'rect');
          r.setAttribute('x', x.bx0); r.setAttribute('y', l.y0); r.setAttribute('width', x.bw); r.setAttribute('height', l.y1 - l.y0);
          cl.appendChild(r);
          const pts = [[0, { transform: S(0.0001), easing: passo }]];
          l.cs.forEach((ci, j) => { const e = x.cs[ci]; pts.push([ts[ci], { transform: S(j === l.cs.length - 1 ? 1 : lim((e.x + e.width - x.bx0) / x.bw, 0.0001, 1).toFixed(4)), easing: passo }]); });
          pts.push([T, { transform: S(1) }]);
          ani(r, quadrosDe(pts), { duration: T, fill: 'both' });
        });
        defs.appendChild(cl); x.tx.setAttribute('clip-path', 'url(#' + cl.id + ')');
      });
      if(b.redim){
        // a alça: o canto do título vai junto com o cursor (mesmo trecho reto, mesmo easing)
        const [z0, z1] = b.tz, s = tt => (K0 + (1 - K0) * _crMkSuave(lim((tt - z0) / (z1 - z0), 0, 1))).toFixed(4);
        b.g.style.transformOrigin = '0 0';
        sel.style.transformOrigin = (b.O.x - b.x0).toFixed(1) + 'px ' + (b.O.y - b.y0).toFixed(1) + 'px';
        ani(b.g, amostra(z0, z1, tt => ({ scale: s(tt) })), { duration: z1 - z0, delay: z0, fill: 'both' });
        ani(sel, amostra(z0, z1, tt => ({ transform: 'scale(' + s(tt) + ')' })), { duration: z1 - z0, delay: z0, fill: 'both' });
      }
    }
  });
  carPos.push([T, { transform: 'translate(-9px,0px)' }]); carVis.push([T, { opacity: 0 }]);
  raiz.appendChild(car);
  ani(car, quadrosDe(carPos), { duration: T, fill: 'both' });
  ani(car, quadrosDe(carVis), { duration: T, fill: 'both' });

  // O cursor: seta + etiqueta. A posição vira keyframes de transform; a seta afunda enquanto o botão está apertado
  const cur = document.createElement('span');
  cur.className = 'mk-cur'; cur.setAttribute('aria-hidden', 'true');
  cur.innerHTML = '<svg width="18" height="21" viewBox="0 0 18 21"><path d="M2 2v15.6l4.2-4 2.7 6.2 2.9-1.2-2.7-6.1H15z" fill="#0A0A0A" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  if(op.autor){ const et = document.createElement('span'); et.textContent = String(op.autor); cur.appendChild(et); }
  raiz.appendChild(cur);
  const relogio = ani(cur, amostra(0, T, tt => { const p = ondeEsta(tt); return { transform: 'translate(' + p.x.toFixed(2) + 'px,' + p.y.toFixed(2) + 'px)' }; }), { duration: T, easing: 'linear', fill: 'both' });
  const aperta = [[0, { scale: 1 }]];
  apertos.forEach(([a, z]) => aperta.push([a - 30, { scale: 1 }], [a + 50, { scale: 0.84 }], [z, { scale: 0.84 }], [z + 120, { scale: 1 }]));
  aperta.push([T, { scale: 1 }]);
  ani(cur.firstChild, quadrosDe(aperta), { duration: T, fill: 'both' });
  ani(host, [{ opacity: 0 }, { opacity: 1 }], { duration: dSel, easing: eOut });

  let estado = 'fim', acabou = false;
  const pular = () => { if(acabou) return; estado = 'pulou'; anims.forEach(a => { try{ a.finish(); }catch(e){} }); };
  if(op.botao !== false){
    const bt = document.createElement('button');
    bt.type = 'button'; bt.className = 'mk-pular';
    bt.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 5.5v13l9-6.5z"/><path d="M16 5h3v14h-3z"/></svg>Pular';
    bt.addEventListener('click', e => { e.stopPropagation(); pular(); });
    raiz.appendChild(bt);
  }
  // Pronto quando o último quadro passa (ou no Pular): quem chama mostra a arte de verdade e,
  // um instante depois, a camada some por cima dela — a troca é invisível (é o mesmo desenho).
  const pronto = new Promise(res => {
    const acaba = () => {
      if(acabou) return; acabou = true; res(estado);
      setTimeout(() => {
        const a = host.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dSel, easing: eIn, fill: 'forwards' });
        a.finished.then(() => host.remove(), () => host.remove());
      }, dSai);
    };
    relogio.finished.then(acaba, acaba);
  });
  return { ativo: true, pronto, pular };
}
