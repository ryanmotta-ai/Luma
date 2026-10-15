/**
 * js/creative/making-of.js
 *
 * MAKING-OF da arte (frente 6, 15/10/2026; microações em 15/10, pedido do Ryan) — a arte se fazendo
 * na frente da pessoa como num editor de verdade, em duas fases que continuam uma na outra:
 *
 *  1. crMakingOfPrancheta(container, opcoes) — começa ENQUANTO a arte carrega (só o formato e a marca
 *     são conhecidos): o cursor desenha a prancheta, puxa as guias das margens a partir das réguas e
 *     pinta o fundo da marca; depois fica "pensando" (cursor calmo, etiqueta com reticências) até a arte
 *     chegar. estado() diz o que já foi feito e onde o cursor está; parar() desmonta.
 *  2. crMakingOf(container, svgFinal, opcoes) — com a arte pronta, continua de onde a fase 1 parou
 *     (opcoes.de) e monta cada peça com microações: repinta o fundo se a cor final for outra; desenha as
 *     placas com a ferramenta Forma; tira as imagens (logo, foto, grafismo, mockup, cupom) da Biblioteca
 *     ao lado e arrasta para a prancheta; desenha a forma do botão/tag/selo; cria a caixa de texto e
 *     digita o conteúdo real letra a letra; redimensiona o título pela alça. A barra de ferramentas
 *     mostra a ferramenta ativa a cada troca. No fim: Mover, clica fora, guias e painéis somem.
 *
 * O movimento é calmo, sem tremor (Bézier discreta + easeInOutSine) e de semente fixa: a mesma arte se
 * faz sempre do mesmo jeito. Só transform e opacity se animam, tudo pré-calculado em Web Animations; a
 * digitação não mexe no texto (o kerning fica intacto): um clipPath por linha abre em degraus.
 * A camada fica POR CIMA do container e sai no fim: o que a pessoa baixa continua sendo o arquivo (a
 * <img> de quem chama) — o making-of nunca toca nele. Movimento reduzido: não há making-of. Não é um
 * player: não tem botão de rever; pular() existe para quem chama (clique, Esc).
 * Independente do Creative (não lê nada cr*): o Franqueado pode usar do mesmo jeito.
 *
 *   opcoes (as duas fases): css (regras extras para o shadow root — as fontes do app) · autor (etiqueta
 *     do cursor) · fundo (cor da marca para a fase 1) · guias ({ x: [frações], y: [frações] } — as
 *     margens do formato) · semente
 *   só a fase 2: de (o estado() da fase 1) · nomes ({ bloco: 'Rótulo' }) · imagens (nomes de bloco que
 *     nunca são digitados, mesmo com texto dentro: entram pela Biblioteca) · redimensiona ('titulo')
 *   crMakingOf → { ativo, pronto: Promise<'fim'|'pulou'|'direto'>, pular() }; 'direto' = não houve
 *   making-of (movimento reduzido, SVG inválido, sem blocos, container sem tamanho).
 */

const CR_MK_NS = 'http://www.w3.org/2000/svg';
const CR_MK_CSS = ':host{position:absolute;inset:0;z-index:2;overflow:hidden;pointer-events:none;contain:layout paint;--s:1}'
  + '.mk-papel,.mk-tinta{position:absolute;inset:0;transform-origin:0 0;opacity:0}.mk-papel{background:var(--white)}'
  + '.mk-arte{position:absolute;inset:0;display:block;width:100%;height:100%}'
  + '.mk-arte > *{transform-box:fill-box;transform-origin:center}'
  + '.mk-camada{position:absolute;inset:0}'
  + '.mk-regua{position:absolute;left:0;top:0;opacity:0;background-color:var(--gray-light);background-repeat:repeat-x;box-shadow:0 0 0 .5px rgba(0,0,0,.12)}'
  + '.mk-regua.mk-h{width:100%;height:calc(var(--s)*9px);background-image:repeating-linear-gradient(90deg,rgba(0,0,0,.32) 0 1px,transparent 1px calc(var(--s)*9px));background-size:100% 45%;background-position:0 100%}'
  + '.mk-regua.mk-v{height:100%;width:calc(var(--s)*9px);background-image:repeating-linear-gradient(180deg,rgba(0,0,0,.32) 0 1px,transparent 1px calc(var(--s)*9px));background-size:45% 100%;background-position:100% 0;background-repeat:repeat-y}'
  + '.mk-guia{position:absolute;left:0;top:0;background:var(--d-sel);opacity:0}.mk-guia.mk-h{width:100%;height:1px}.mk-guia.mk-v{width:1px;height:100%}'
  + '.mk-sel{position:absolute;box-sizing:border-box;border:1.5px solid var(--d-sel);border-radius:2px;transform-origin:0 0;opacity:0}'
  + '.mk-sel i{position:absolute;width:6px;height:6px;box-sizing:border-box;background:var(--white);border:1.5px solid var(--d-sel)}'
  + '.mk-sel i:nth-child(1){left:-4px;top:-4px}.mk-sel i:nth-child(2){right:-4px;top:-4px}.mk-sel i:nth-child(3){left:-4px;bottom:-4px}.mk-sel i:nth-child(4){right:-4px;bottom:-4px}'
  + '.mk-sel b{position:absolute;left:-1.5px;bottom:100%;margin-bottom:4px;padding:1px 5px;border-radius:3px;background:var(--d-sel);color:var(--white);font:600 10px/1.4 system-ui,sans-serif;white-space:nowrap}'
  + '.mk-sel.mk-rente b{bottom:auto;top:3px;left:3px;margin:0}'
  + '.mk-painel{position:absolute;box-sizing:border-box;border-radius:calc(var(--s)*9px);background:var(--white);box-shadow:0 4px 16px rgba(0,0,0,.2),0 0 0 .5px rgba(0,0,0,.08);opacity:0}'
  + '.mk-painel b{position:absolute;left:calc(var(--s)*7px);top:calc(var(--s)*5px);font:600 calc(var(--s)*8.5px)/1.3 system-ui,sans-serif;color:var(--text-3)}'
  + '.mk-tile{position:absolute;border-radius:calc(var(--s)*6px);background:var(--gray-light)}'
  + '.mk-clone{position:absolute;overflow:visible;opacity:0;filter:drop-shadow(0 4px 10px rgba(0,0,0,.25))}'
  + '.mk-barra{position:absolute;box-sizing:border-box;border-radius:calc(var(--s)*10px);background:var(--white);box-shadow:0 4px 16px rgba(0,0,0,.2),0 0 0 .5px rgba(0,0,0,.08);opacity:0}'
  + '.mk-ativo{position:absolute;border-radius:calc(var(--s)*7px);background:var(--d-sel-fill);box-shadow:inset 0 0 0 1.5px var(--d-sel)}'
  + '.mk-ferr{position:absolute;display:flex;align-items:center;justify-content:center;color:var(--text)}'
  + '.mk-ferr svg{width:calc(var(--s)*13px);height:calc(var(--s)*13px)}'
  + '.mk-car{position:absolute;left:0;top:0;width:2px;height:100px;margin-left:-1px;background:var(--d-sel);transform-origin:0 0;opacity:0}'
  + '.mk-cur{position:absolute;left:0;top:0;will-change:transform}'
  + '.mk-cur svg{display:block;transform-origin:2px 2px;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.35))}'
  + '.mk-cur > span{position:absolute;left:15px;top:17px;display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:999px;background:var(--d-sel);color:var(--white);font:600 10px/1.4 system-ui,sans-serif;white-space:nowrap}'
  + '.mk-cur u{display:inline-flex;gap:2px}.mk-cur u i{width:3px;height:3px;border-radius:50%;background:currentColor;opacity:.3}';

// A barra de ferramentas (ícones SVG, nunca emoji): a ordem é a da barra
const CR_MK_FERR = [
  ['mover', '<path d="M6 3.5v15l4.2-4 2.8 6.3 2.6-1.2-2.8-6.2H18.5z"/>'],
  ['prancheta', '<path d="M8 3v18M16 3v18M3 8h18M3 16h18"/>'],
  ['forma', '<rect x="4" y="4" width="16" height="16" rx="2.5"/>'],
  ['texto', '<path d="M5 7V4.5h14V7M12 4.5v15M9 19.5h6"/>'],
  ['imagem', '<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/>'],
  ['cor', '<path d="M12 3.5s6 6.4 6 10.8a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5z"/>']
];

// Gerador com semente (mulberry32): o caminho do cursor é sempre o mesmo para a mesma semente
function _crMkSorte(s){
  let a = s >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const _crMkSuave = u => (1 - Math.cos(Math.PI * u)) / 2;   // easeInOutSine: arranca e assenta sem tranco (pico de velocidade 1,57× a média)
const _crMkBez = (p0, c1, c2, p1, u) => { const v = 1 - u; return v * v * v * p0 + 3 * v * v * u * c1 + 3 * v * u * u * c2 + u * u * u * p1; };
// Token de motion lido do CSS (nunca número solto — motion.md §1)
const _crMkTok = (t, pad) => { const v = getComputedStyle(document.documentElement).getPropertyValue(t).trim(); return v ? (/ms$|^\d/.test(v) ? parseFloat(v) || pad : v) : pad; };
const _crMkLim = (v, a, b) => Math.max(a, Math.min(b, v));

/* ── A cena: papel, tinta, (arte), réguas, guias, seleções, Biblioteca, clones, barra, cursor de texto, cursor ── */
function _crMkCena(container, op, svg, pensa){
  if(!container || !Element.prototype.animate) return null;
  if(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  const W = container.clientWidth, H = container.clientHeight;
  if(!W || !H) return null;
  const s = _crMkLim(W / 340, 0.55, 1.3), px = v => (+v).toFixed(1) + 'px';
  const host = document.createElement('span'), raiz = host.attachShadow({ mode: 'open' }), st = document.createElement('style');
  host.style.setProperty('--s', s.toFixed(3));
  st.textContent = CR_MK_CSS + (op.css || '');
  raiz.appendChild(st);
  const novo = (tag, cls, css, pai) => { const e = document.createElement(tag); if(cls) e.className = cls; if(css) e.style.cssText = css; (pai || raiz).appendChild(e); return e; };
  const c = { host, raiz, W, H, s, px, novo };
  c.papel = novo('span', 'mk-papel'); c.tinta = novo('span', 'mk-tinta');
  if(svg){ svg.classList.add('mk-arte'); svg.setAttribute('aria-hidden', 'true'); raiz.appendChild(svg); }
  c.reguaH = novo('span', 'mk-regua mk-h'); c.reguaV = novo('span', 'mk-regua mk-v');
  const g = op.guias || {};
  c.guias = (g.y || []).map(f => ({ h: true, f, el: novo('span', 'mk-guia mk-h') })).concat((g.x || []).map(f => ({ h: false, f, el: novo('span', 'mk-guia mk-v') })));
  c.sels = novo('span', 'mk-camada');
  // Biblioteca à direita: o lugar de onde as imagens saem
  const pw = 58 * s, tile = pw - 14 * s, tg = 6 * s, topo = 20 * s, n = _crMkLim(Math.floor((H - 40 * s - topo) / (tile + tg)), 1, 3), ph = topo + n * (tile + tg);
  c.painelPos = { x: W - pw - 8 * s, y: Math.max(14 * s, (H - ph) * 0.3), w: pw, h: ph };
  c.painel = novo('span', 'mk-painel', 'left:' + px(c.painelPos.x) + ';top:' + px(c.painelPos.y) + ';width:' + px(pw) + ';height:' + px(ph));
  novo('b', '', '', c.painel).textContent = 'Biblioteca';
  for(let i = 0; i < n; i++) novo('span', 'mk-tile', 'left:' + px(7 * s) + ';top:' + px(topo + i * (tile + tg)) + ';width:' + px(tile) + ';height:' + px(tile), c.painel);
  c.tile0 = { x: c.painelPos.x + 7 * s + tile / 2, y: c.painelPos.y + topo + tile / 2, lado: tile };
  c.clones = novo('span', 'mk-camada');
  // Barra de ferramentas no rodapé, ao centro
  const bt = 22 * s, gap = 2 * s, pad = 3 * s, bw = CR_MK_FERR.length * bt + (CR_MK_FERR.length - 1) * gap + 2 * pad, bh = bt + 2 * pad;
  const bx = (W - bw) / 2, by = H - bh - 8 * s;
  c.barra = novo('span', 'mk-barra', 'left:' + px(bx) + ';top:' + px(by) + ';width:' + px(bw) + ';height:' + px(bh));
  c.ativo = novo('span', 'mk-ativo', 'left:' + px(pad) + ';top:' + px(pad) + ';width:' + px(bt) + ';height:' + px(bt), c.barra);
  CR_MK_FERR.forEach(([, icone], i) => {
    novo('span', 'mk-ferr', 'left:' + px(pad + i * (bt + gap)) + ';top:' + px(pad) + ';width:' + px(bt) + ';height:' + px(bt), c.barra)
      .innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + icone + '</svg>';
  });
  const iF = nome => Math.max(0, CR_MK_FERR.findIndex(f => f[0] === nome));
  c.ferrEm = nome => ({ x: bx + pad + iF(nome) * (bt + gap) + bt / 2, y: by + bh / 2 });
  c.ativoEm = nome => 'translateX(' + px(iF(nome) * (bt + gap)) + ')';
  c.barraFora = 'translateY(' + px(bh + 12 * s) + ')';
  c.painelFora = 'translateX(' + px(pw + 14 * s) + ')';
  c.car = novo('span', 'mk-car');
  c.cur = novo('span', 'mk-cur');
  c.cur.innerHTML = '<svg width="18" height="21" viewBox="0 0 18 21"><path d="M2 2v15.6l4.2-4 2.7 6.2 2.9-1.2-2.7-6.1H15z" fill="#0A0A0A" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  if(op.autor){ const et = novo('span', '', '', c.cur); et.textContent = String(op.autor); if(pensa){ c.reticencias = novo('u', '', '', et); [0, 1, 2].forEach(() => novo('i', '', '', c.reticencias)); } }
  [...raiz.children].forEach(e => { if(e !== st && e !== svg) e.setAttribute('aria-hidden', 'true'); });
  container.appendChild(host);
  return c;
}

/* ── A linha do tempo: o cursor anda por trechos de Bézier; cada elemento ganha "trilhas" (propriedade →
   pontos no tempo) que viram um Web Animation só no fim. Planejar não cria elemento: dá para planejar de
   novo noutra velocidade (V) e só então tocar. ── */
function _crMkLinha(c, op, V, cp){
  const sorte = _crMkSorte(op.semente == null ? 20261015 : op.semente);
  const L = { t: 0, cp, V, sorte, trechos: [], apertos: [], trilhas: new Map(), ferr: 'mover', hist: [[0, 'mover']] };
  L.d = ms => ms * V;
  L.ini = (el, prop, v0, e) => { let m = L.trilhas.get(el); if(!m) L.trilhas.set(el, m = {}); m[prop] = [[0, v0, e]]; };
  // segura o valor até t e anda até v em d ms (e = easing do trecho; trilha em degraus continua em degraus)
  L.vai = (el, prop, t, d, v, e) => { const tr = L.trilhas.get(el)[prop], ult = tr[tr.length - 1], dg = /steps/.test(ult[2] || ''); tr.push([t, ult[1], e || ult[2]], [t + Math.max(1, d), v, dg ? ult[2] : undefined]); };
  L.ponto = (el, prop, t, v, e) => L.trilhas.get(el)[prop].push([t, v, e]);
  // Um trecho por movimento: Bézier cúbica com uma curva leve, sempre para o mesmo lado (curvo 0 = reto)
  L.anda = (p, dur, curvo) => {
    const p0 = L.cp, dx = p.x - p0.x, dy = p.y - p0.y, D = Math.hypot(dx, dy) || 1, nx = -dy / D, ny = dx / D;
    const k = D * (0.05 + 0.07 * sorte()) * (curvo == null ? 1 : curvo);
    L.trechos.push({ p0, p1: p, t0: L.t, dur, c1: { x: p0.x + dx * 0.25 + nx * k, y: p0.y + dy * 0.25 + ny * k }, c2: { x: p0.x + dx * 0.78 + nx * k * 0.45, y: p0.y + dy * 0.78 + ny * k * 0.45 } });
    L.t += dur; L.cp = p;
  };
  L.onde = tt => {
    let p = L.trechos.length ? L.trechos[0].p0 : L.cp;
    for(const tr of L.trechos){
      if(tt < tr.t0) break;
      const v = _crMkSuave(Math.min(1, (tt - tr.t0) / tr.dur));
      p = { x: _crMkBez(tr.p0.x, tr.c1.x, tr.c2.x, tr.p1.x, v), y: _crMkBez(tr.p0.y, tr.c1.y, tr.c2.y, tr.p1.y, v) };
    }
    return p;
  };
  // Fitts: longe demora mais, mas não na proporção
  L.viaja = p => { const D = Math.hypot(p.x - L.cp.x, p.y - L.cp.y); L.anda(p, L.d(300 + 150 * Math.log2(1 + D / (30 * c.s))), 1); };
  L.clique = () => { L.apertos.push([L.t, L.t + 110]); L.t += L.d(190); };
  L.espera = ms => { L.t += L.d(ms); };
  L.arrasta = (p, ms, curvo) => { const a = [L.t, 0]; L.apertos.push(a); L.espera(60); const t0 = L.t; L.anda(p, L.d(ms), curvo); a[1] = L.t; const t1 = L.t; L.espera(90); return [t0, t1]; };
  // amostra uma propriedade a 60 por segundo enquanto o cursor arrasta
  L.amostra = (el, prop, t0, t1, fn) => { const n = Math.max(2, Math.ceil((t1 - t0) / (1000 / 60))); for(let i = 0; i <= n; i++){ const tt = t0 + (t1 - t0) * i / n; L.ponto(el, prop, tt, fn(tt, i / n)); } };
  L.ferramenta = nome => {
    if(L.ferr === nome) return;
    L.viaja(c.ferrEm(nome)); L.clique();
    L.vai(c.ativo, 'transform', L.t - L.d(150), L.d(140), c.ativoEm(nome), 'ease-out');
    L.ferr = nome; L.hist.push([L.t, nome]);
  };
  L.ini(c.ativo, 'transform', c.ativoEm('mover'));
  return L;
}

// O estado inicial da cena (o que a fase 1 já deixou na tela vale desde o quadro 0)
function _crMkComeca(c, L, feitos, ferr){
  const f = n => feitos.indexOf(n) >= 0;
  L.ini(c.papel, 'opacity', f('prancheta') ? 1 : 0); L.ini(c.papel, 'transform', f('prancheta') ? 'scale(1,1)' : 'scale(0.02,0.02)');
  L.ini(c.tinta, 'opacity', f('fundo') ? 1 : 0);
  L.ini(c.reguaH, 'opacity', f('reguas') ? 1 : 0); L.ini(c.reguaV, 'opacity', f('reguas') ? 1 : 0);
  c.guias.forEach((g, i) => {
    const fim = g.h ? 'translate(0px,' + c.px(g.f * c.H) + ')' : 'translate(' + c.px(g.f * c.W) + ',0px)';
    L.ini(g.el, 'opacity', f('guia' + i) ? 1 : 0); L.ini(g.el, 'transform', f('guia' + i) ? fim : 'translate(0px,0px)');
  });
  L.ini(c.barra, 'opacity', f('barra') ? 1 : 0); L.ini(c.barra, 'transform', f('barra') ? 'translateY(0px)' : c.barraFora);
  L.ini(c.painel, 'opacity', 0); L.ini(c.painel, 'transform', c.painelFora);
  L.ini(c.car, 'opacity', 0, 'steps(1,end)'); L.ini(c.car, 'transform', 'translate(-9px,0px)', 'steps(1,end)');
  if(ferr && ferr !== 'mover'){ L.ferr = ferr; L.ini(c.ativo, 'transform', c.ativoEm(ferr)); L.hist = [[0, ferr]]; }
}

/* ── O preparo (fase 1, ou o que faltar dele na fase 2): barra, prancheta, réguas e guias, fundo ── */
function _crMkPreparo(c, L, op, feitos, eOut){
  const f = n => feitos.indexOf(n) >= 0, passos = [], s = c.s, W = c.W, H = c.H;
  if(!f('barra')){ L.vai(c.barra, 'opacity', L.t, L.d(220), 1, eOut); L.vai(c.barra, 'transform', L.t, L.d(320), 'translateY(0px)', eOut); L.espera(200); passos.push(['barra', L.t]); }
  if(!f('prancheta')){
    // ferramenta Prancheta: arrasta do canto de cima ao de baixo e o papel cresce junto
    L.ferramenta('prancheta');
    L.viaja({ x: 3 * s, y: 3 * s });
    const [t0, t1] = L.arrasta({ x: W - 3 * s, y: H - 3 * s }, 750, 0.12);
    L.vai(c.papel, 'opacity', t0, L.d(60), 1);
    L.amostra(c.papel, 'transform', t0, t1, tt => { const p = L.onde(tt); return 'scale(' + _crMkLim(p.x / W, 0.02, 1).toFixed(4) + ',' + _crMkLim(p.y / H, 0.02, 1).toFixed(4) + ')'; });
    L.ponto(c.papel, 'transform', t1, 'scale(1,1)');
    passos.push(['prancheta', L.t]);
  }
  c.guias.forEach((g, i) => {
    if(f('guia' + i)) return;
    const par = c.guias.findIndex(o => o.h === g.h);
    if(par !== i){
      // a margem do outro lado: guia simétrica, aparece sozinha logo depois da primeira
      const fim = g.h ? 'translate(0px,' + c.px(g.f * H) + ')' : 'translate(' + c.px(g.f * W) + ',0px)';
      L.ponto(g.el, 'transform', L.t, fim); L.vai(g.el, 'opacity', L.t - L.d(60), L.d(260), 1, eOut);
      passos.push(['guia' + i, L.t + L.d(200)]);
      return;
    }
    if(!f('reguas') && !passos.some(p => p[0] === 'reguas')){
      L.ferramenta('mover');
      L.vai(c.reguaH, 'opacity', L.t, L.d(220), 1, eOut); L.vai(c.reguaV, 'opacity', L.t, L.d(220), 1, eOut);
      passos.push(['reguas', L.t + L.d(220)]);
    }
    // puxa a guia da régua até a margem do formato
    const r = 0.3 + 0.4 * L.sorte(), a = g.h ? { x: r * W, y: 4.5 * s } : { x: 4.5 * s, y: r * H };
    L.viaja(a);
    const alvo = g.h ? { x: a.x + (L.sorte() - 0.5) * 0.08 * W, y: g.f * H } : { x: g.f * W, y: a.y + (L.sorte() - 0.5) * 0.08 * H };
    const [t0, t1] = L.arrasta(alvo, 560, 0.08);
    L.vai(g.el, 'opacity', t0, L.d(60), 1);
    L.amostra(g.el, 'transform', t0, t1, tt => { const p = L.onde(tt); return g.h ? 'translate(0px,' + c.px(p.y) + ')' : 'translate(' + c.px(p.x) + ',0px)'; });
    L.ponto(g.el, 'transform', t1, g.h ? 'translate(0px,' + c.px(g.f * H) + ')' : 'translate(' + c.px(g.f * W) + ',0px)');
    passos.push(['guia' + i, L.t]);
  });
  if(!f('fundo') && op.fundo){
    // balde de tinta: a cor da marca enche a prancheta
    L.ferramenta('cor');
    L.viaja({ x: W * (0.42 + 0.16 * L.sorte()), y: H * (0.38 + 0.16 * L.sorte()) });
    L.clique();
    L.vai(c.tinta, 'opacity', L.t - L.d(120), L.d(420), 1, eOut);
    passos.push(['fundo', L.t + L.d(300)]);
  }
  return passos;
}

/* ── Toca: cada trilha vira um Web Animation (offsets crescentes em [0,1]); o cursor é amostrado a 60/s ── */
function _crMkToca(c, L, T){
  const anims = [];
  const quadros = (pts, prop) => {
    const ord = pts.map((p, i) => [p, i]).sort((a, b) => a[0][0] - b[0][0] || a[1] - b[1]).map(x => x[0]);
    if(ord[ord.length - 1][0] < T) ord.push([T, ord[ord.length - 1][1]]);
    let o = 0;
    return ord.map(([t, v, e]) => { o = Math.max(o, _crMkLim(t / T, 0, 1)); const q = { offset: o }; q[prop] = v; if(e) q.easing = e; return q; });
  };
  L.trilhas.forEach((m, el) => Object.keys(m).forEach(prop => anims.push(el.animate(quadros(m[prop], prop), { duration: T, fill: 'both' }))));
  const cur = [];
  for(let tt = 0; tt <= T; tt += 1000 / 60){ const p = L.onde(tt); cur.push({ offset: tt / T, transform: 'translate(' + p.x.toFixed(2) + 'px,' + p.y.toFixed(2) + 'px)' }); }
  cur[cur.length - 1].offset = 1;
  const relogio = c.cur.animate(cur, { duration: T, easing: 'linear', fill: 'both' });
  const ap = [[0, 1]];
  L.apertos.forEach(([a, z]) => ap.push([a - 30, 1], [a + 50, 0.84], [z, 0.84], [z + 120, 1]));
  let o = 0;
  anims.push(relogio, c.cur.firstChild.animate(ap.concat([[T, 1]]).map(([t, v]) => { o = Math.max(o, _crMkLim(t / T, 0, 1)); return { offset: o, scale: v }; }), { duration: T, fill: 'both' }));
  return { anims, relogio };
}

/* ══ Fase 1 — a prancheta enquanto a arte carrega ══ */
function crMakingOfPrancheta(container, opcoes){
  const op = opcoes || {}, nada = { ativo: false, estado: () => null, parar(){} };
  const c = _crMkCena(container, op, null, true);
  if(!c) return nada;
  c.tinta.style.background = op.fundo || 'transparent';
  const eOut = _crMkTok('--ease-out', 'ease-out');
  const L = _crMkLinha(c, op, 1, { x: c.W * 1.08, y: c.H * 0.92 });
  _crMkComeca(c, L, [], 'mover');
  const passos = _crMkPreparo(c, L, op, [], eOut);
  L.ferramenta('mover');
  L.espera(200);
  const T = L.t, { anims } = _crMkToca(c, L, T);
  // Pensando: o cursor passeia devagar entre as guias até a arte chegar (laço sem fim, sem tranco na emenda)
  const P = L.cp, g = op.guias || {}, gx = g.x && g.x.length ? g.x : [0.1, 0.9], gy = g.y && g.y.length ? g.y : [0.1, 0.9];
  const Lp = _crMkLinha(c, op, 1, P);
  [{ x: c.W * (gx[0] + 0.12), y: c.H * (gy[0] + 0.1) }, { x: c.W * 0.55, y: c.H * 0.46 }, { x: c.W * (gx[gx.length - 1] - 0.18), y: c.H * (gy[gy.length - 1] - 0.16) }, P]
    .forEach(p => { Lp.anda(p, 1700, 1); Lp.espera(900); });
  const Tp = Lp.t, laco = [];
  for(let tt = 0; tt <= Tp; tt += 1000 / 60){ const p = Lp.onde(tt); laco.push({ offset: tt / Tp, transform: 'translate(' + p.x.toFixed(2) + 'px,' + p.y.toFixed(2) + 'px)' }); }
  laco[laco.length - 1].offset = 1;
  anims.push(c.cur.animate(laco, { duration: Tp, delay: T, iterations: Infinity }));
  if(c.reticencias) [...c.reticencias.children].forEach((i, k) => anims.push(i.animate([{ opacity: 0.3 }, { opacity: 1 }, { opacity: 0.3 }], { duration: 1100, delay: T + k * 180, iterations: Infinity })));
  const t0 = performance.now();
  return {
    ativo: true,
    // o que já está na tela e onde o cursor está — a fase 2 continua daqui
    estado(){
      const el = performance.now() - t0, m = new DOMMatrixReadOnly(getComputedStyle(c.cur).transform);
      const ferr = L.hist.filter(h => h[0] <= el).pop();
      return { fx: m.m41 / c.W, fy: m.m42 / c.H, feitos: passos.filter(p => p[1] <= el).map(p => p[0]), ferramenta: ferr ? ferr[1] : 'mover', fundo: op.fundo };
    },
    parar(){ anims.forEach(a => { try{ a.cancel(); }catch(e){} }); c.host.remove(); }
  };
}

/* ══ Fase 2 — a arte pronta, peça por peça ══ */
function crMakingOf(container, svgFinal, opcoes){
  const op = opcoes || {};
  const nada = { ativo: false, pronto: Promise.resolve('direto'), pular(){} };
  if(!container || !svgFinal) return nada;
  let svg;
  try{
    const doc = new DOMParser().parseFromString(svgFinal, 'image/svg+xml');
    if(doc.querySelector('parsererror') || doc.documentElement.nodeName !== 'svg') return nada;
    svg = document.importNode(doc.documentElement, true);
  }catch(e){ return nada; }
  if(!svg.querySelector(':scope > [data-bloco]')) return nada;
  const de = op.de || null, feitos = de ? de.feitos || [] : [];
  // a cor da tinta: a que a fase 1 pintou; sem fase 1, a do próprio fundo da arte
  const vb = svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width ? svg.viewBox.baseVal : null;
  const VW = vb ? vb.width : +svg.getAttribute('width') || 1080, VH = vb ? vb.height : +svg.getAttribute('height') || 1350;
  const fundos = [...svg.children].filter(e => !e.hasAttribute('data-bloco') && !e.hasAttribute('data-zona') && !/^(defs|style|title|desc|metadata)$/i.test(e.nodeName));
  const chapa = fundos.find(e => e.nodeName === 'rect' && +e.getAttribute('width') >= VW && +e.getAttribute('height') >= VH);
  const corFinal = (chapa && chapa.getAttribute('fill')) || '';
  const opC = Object.assign({}, op, { fundo: (de && de.fundo) || op.fundo || corFinal });
  const c = _crMkCena(container, opC, svg);
  if(!c) return nada;
  c.tinta.style.background = opC.fundo || 'transparent';
  const W = c.W, H = c.H, s = c.s;

  /* ── 1. Medidas, todas antes da 1ª animação (k absorve a escala de ancestral animado) ── */
  const hr = c.host.getBoundingClientRect(), k = W / (hr.width || W);
  const ctm = svg.getScreenCTM(), uPx = ctm ? Math.hypot(ctm.a, ctm.b) * k : W / VW;   // px por unidade do SVG
  const emPx = (el, x, y) => { const m = el.getScreenCTM(); return { x: (m.a * x + m.c * y + m.e - hr.left) * k, y: (m.b * x + m.d * y + m.f - hr.top) * k }; };
  const caixa = r => ({ x0: (r.left - hr.left) * k, y0: (r.top - hr.top) * k, x1: (r.right - hr.left) * k, y1: (r.bottom - hr.top) * k });
  const K0 = 0.84, redim = op.redimensiona === undefined ? 'titulo' : op.redimensiona, imagens = op.imagens || [];
  const zonas = [...svg.querySelectorAll(':scope > [data-zona]')].map(z => ({ el: z, r: caixa(z.getBoundingClientRect()), gira: !!z.getAttribute('transform') })).filter(z => z.r.x1 - z.r.x0 > 1);
  const blocos = [];
  svg.querySelectorAll(':scope > [data-bloco]').forEach(g => {
    const r = caixa(g.getBoundingClientRect()), x0 = Math.max(0, r.x0), y0 = Math.max(0, r.y0), w = Math.min(W, r.x1) - x0, h = Math.min(H, r.y1) - y0;
    if(w <= 1 || h <= 1) return;
    const b = { g, nome: g.dataset.bloco || '', r, x0, y0, w, h, textos: [], nc: 0, movel: !g.getAttribute('transform') };
    g.querySelectorAll('text').forEach(tx => {
      if(tx.closest('defs,clipPath,mask,pattern,symbol,marker') || tx.getAttribute('clip-path') || tx.style.clipPath) return;
      try{
        const n = tx.getNumberOfChars(); if(!n) return;
        const cs = []; for(let i = 0; i < n; i++) cs.push(tx.getExtentOfChar(i));
        b.textos.push({ tx, cs }); b.nc += n;
      }catch(e){ /* texto sem layout: entra junto com o bloco */ }
    });
    // o que não é texto: forma simples (botão, tag, selo) se desenha; peça (ticket, ícone, imagem) vem da Biblioteca
    const outros = [...g.querySelectorAll('*')].filter(e => !e.closest('text,defs,clipPath,mask,pattern,symbol,marker') && /^(rect|circle|ellipse|line|polyline|polygon|path|image|use)$/i.test(e.nodeName));
    const digita = b.textos.length && b.nc <= 160 && imagens.indexOf(b.nome) < 0;
    b.tipo = !digita ? 'imagem' : !outros.length ? 'texto' : outros.every(e => /^(rect|circle|ellipse|line|polyline|polygon)$/i.test(e.nodeName)) ? 'forma' : 'peca';
    if(!digita) b.textos = [];
    blocos.push(b);
  });
  if(!blocos.length){ c.host.remove(); return nada; }
  // O título nasce a K0 do tamanho, preso no canto de cima à esquerda, e a alça do canto o leva ao tamanho final
  const tit = blocos.find(b => b.tipo === 'texto' && b.nome === redim && b.movel);
  if(tit) try{
    const bb = tit.g.getBBox(), O = emPx(tit.g, bb.x, bb.y), C = emPx(tit.g, bb.x + bb.width, bb.y + bb.height);
    Object.assign(tit, { redim: true, O, canto: C, cantoK: { x: O.x + (C.x - O.x) * K0, y: O.y + (C.y - O.y) * K0 } });
  }catch(e){ /* sem bbox: o título só é digitado */ }
  const esc = (b, p) => b.redim ? { x: b.O.x + (p.x - b.O.x) * K0, y: b.O.y + (p.y - b.O.y) * K0 } : p;

  /* ── 2. As peças de cena de cada bloco: seleção, clone na Biblioteca, faixas de digitação e cursor de texto ── */
  let defs = svg.querySelector(':scope > defs'), nClip = 0;
  if(!defs){ defs = document.createElementNS(CR_MK_NS, 'defs'); svg.insertBefore(defs, svg.firstChild); }
  blocos.forEach(b => {
    b.sel = c.novo('span', 'mk-sel' + (b.y0 < 18 ? ' mk-rente' : ''), 'left:' + c.px(b.x0) + ';top:' + c.px(b.y0) + ';width:' + c.px(b.w) + ';height:' + c.px(b.h), c.sels);
    b.sel.innerHTML = '<i></i><i></i><i></i><i></i><b></b>';
    b.sel.querySelector('b').textContent = (op.nomes && op.nomes[b.nome]) || (b.nome.charAt(0).toUpperCase() + b.nome.slice(1));
    if(b.redim) b.sel.style.transformOrigin = c.px(b.O.x - b.x0) + ' ' + c.px(b.O.y - b.y0);
    if(b.tipo === 'imagem' || b.tipo === 'peca'){
      // o clone que mora na Biblioteca e é arrastado (a peça sem o texto, que é digitado depois)
      const cl = document.createElementNS(CR_MK_NS, 'svg'), bw = b.r.x1 - b.r.x0, bh = b.r.y1 - b.r.y0;
      cl.setAttribute('class', 'mk-clone'); cl.setAttribute('overflow', 'visible');
      cl.setAttribute('viewBox', [(vb ? vb.x : 0) + b.r.x0 / uPx, (vb ? vb.y : 0) + b.r.y0 / uPx, bw / uPx, bh / uPx].map(v => v.toFixed(2)).join(' '));
      cl.style.cssText = 'left:' + c.px(b.r.x0) + ';top:' + c.px(b.r.y0) + ';width:' + c.px(bw) + ';height:' + c.px(bh);
      const g2 = b.g.cloneNode(true);
      if(b.tipo === 'peca') g2.querySelectorAll('text').forEach(t => t.remove());
      cl.appendChild(g2); c.clones.appendChild(cl);
      b.clone = cl; b.centro = { x: b.r.x0 + bw / 2, y: b.r.y0 + bh / 2 }; b.kMin = Math.min(1, c.tile0.lado * 0.82 / Math.max(bw, bh));
    }
    b.textos.forEach(x => {
      const ls = []; let Ln = null;
      x.cs.forEach((e, i) => {
        const cy = e.y + e.height / 2;
        if(!Ln || Math.abs(cy - Ln.cy) > 0.5 * Math.max(e.height, 1)){ Ln = { cy, top: e.y, bot: e.y + e.height, x0: e.x, x1: e.x + e.width, cs: [] }; ls.push(Ln); }
        Ln.cs.push(i); Ln.top = Math.min(Ln.top, e.y); Ln.bot = Math.max(Ln.bot, e.y + e.height); Ln.x0 = Math.min(Ln.x0, e.x); Ln.x1 = Math.max(Ln.x1, e.x + e.width);
      });
      const pad = 0.3 * Math.max(...ls.map(l => l.bot - l.top), 1);
      x.bx0 = Math.min(...ls.map(l => l.x0)) - pad; x.bw = Math.max(...ls.map(l => l.x1)) + pad - x.bx0;
      ls.forEach((l, j) => {
        l.y0 = j ? (ls[j - 1].cy + l.cy) / 2 : l.top - 2 * pad;
        l.y1 = j < ls.length - 1 ? (l.cy + ls[j + 1].cy) / 2 : l.bot + 2 * pad;
        if(l.y1 <= l.y0){ l.y0 = l.top - pad; l.y1 = l.bot + pad; }
      });
      x.ls = ls;
      const cl = document.createElementNS(CR_MK_NS, 'clipPath');
      cl.id = 'mk-dig-' + (nClip++); cl.setAttribute('clipPathUnits', 'userSpaceOnUse');
      ls.forEach(l => {
        l.rect = document.createElementNS(CR_MK_NS, 'rect');
        l.rect.setAttribute('x', x.bx0); l.rect.setAttribute('y', l.y0); l.rect.setAttribute('width', x.bw); l.rect.setAttribute('height', l.y1 - l.y0);
        cl.appendChild(l.rect);
      });
      defs.appendChild(cl); x.tx.setAttribute('clip-path', 'url(#' + cl.id + ')');
      const barra = (xx, e) => { const a = esc(b, emPx(x.tx, xx, e.y)), z = esc(b, emPx(x.tx, xx, e.y + e.height)); return 'translate(' + a.x.toFixed(2) + 'px,' + a.y.toFixed(2) + 'px) rotate(' + (Math.atan2(z.y - a.y, z.x - a.x) * 57.2958 - 90).toFixed(2) + 'deg) scaleY(' + (Math.hypot(z.x - a.x, z.y - a.y) / 100).toFixed(4) + ')'; };
      x.car0 = barra(x.cs[0].x, x.cs[0]);
      x.car = x.cs.map(e => barra(e.x + e.width, e));
      x.clique = esc(b, emPx(x.tx, x.cs[0].x + x.cs[0].width * 0.15, x.cs[0].y + x.cs[0].height * 0.55));
    });
  });

  /* ── 3. O plano: o preparo que faltar, fundo, placas, blocos na ordem do SVG, e o fim ── */
  const dSel = _crMkTok('--dur-fast', 180), dSai = _crMkTok('--dur-base', 260), eOut = _crMkTok('--ease-out', 'ease-out'), eIn = _crMkTok('--ease-in', 'ease-in');
  const passo = 'steps(1,end)', dentro = p => ({ x: _crMkLim(p.x, 5 * s, W - 5 * s), y: _crMkLim(p.y, 5 * s, H - 5 * s) });
  const faixa = (x, f) => 'translate(' + x.bx0.toFixed(2) + 'px,0px) scaleX(' + f + ') translate(' + (-x.bx0).toFixed(2) + 'px,0px)';
  const plano = V => {
    const L = _crMkLinha(c, op, V, de ? { x: de.fx * W, y: de.fy * H } : { x: W * 1.08, y: H * 0.92 });
    _crMkComeca(c, L, feitos, de && de.ferramenta);
    fundos.forEach(e => L.ini(e, 'opacity', 0));
    zonas.forEach(z => { L.ini(z.el, 'opacity', 0); if(!z.gira){ z.el.style.transformOrigin = '0 0'; L.ini(z.el, 'scale', '1 1'); } });
    blocos.forEach(b => {
      L.ini(b.g, 'opacity', 0); L.ini(b.sel, 'opacity', 0);
      L.ini(b.sel, 'transform', b.redim ? 'scale(' + K0 + ',' + K0 + ')' : 'scale(1,1)');
      if(b.clone){ L.ini(b.clone, 'opacity', 0); L.ini(b.clone, 'transform', 'translate(' + c.px(c.tile0.x - b.centro.x) + ',' + c.px(c.tile0.y - b.centro.y) + ') scale(' + b.kMin.toFixed(4) + ')'); }
      if(b.tipo === 'forma' && b.movel){ b.g.style.transformOrigin = '0 0'; L.ini(b.g, 'scale', '1 1'); }
      if(b.redim){ b.g.style.transformOrigin = '0 0'; L.ini(b.g, 'scale', String(K0)); }
      b.textos.forEach(x => x.ls.forEach(l => L.ini(l.rect, 'transform', faixa(x, 0.0001), passo)));
    });
    _crMkPreparo(c, L, opC, feitos, eOut);
    // o fundo da arte: se a tinta já é a cor final, ele assenta sem gesto; senão o balde repinta
    const igual = String(opC.fundo || '').toLowerCase() === corFinal.toLowerCase();
    if(!igual){ L.ferramenta('cor'); L.viaja({ x: W * (0.4 + 0.2 * L.sorte()), y: H * (0.3 + 0.2 * L.sorte()) }); L.clique(); }
    fundos.forEach(e => L.vai(e, 'opacity', L.t - L.d(igual ? 0 : 120), L.d(igual ? 200 : 420), 1, eOut));
    // placas: ferramenta Forma, do canto de cima ao de baixo
    zonas.forEach(z => {
      L.ferramenta('forma');
      L.viaja(dentro({ x: z.r.x0, y: z.r.y0 }));
      const [t0, t1] = L.arrasta(dentro({ x: z.r.x1, y: z.r.y1 }), 600, 0.1);
      L.vai(z.el, 'opacity', t0, L.d(60), 1);
      if(!z.gira){
        const zw = z.r.x1 - z.r.x0, zh = z.r.y1 - z.r.y0;
        L.amostra(z.el, 'scale', t0, t1, tt => { const p = L.onde(tt); return _crMkLim((p.x - z.r.x0) / zw, 0.02, 1).toFixed(4) + ' ' + _crMkLim((p.y - z.r.y0) / zh, 0.02, 1).toFixed(4); });
        L.ponto(z.el, 'scale', t1, '1 1');
      }
    });
    let selAtual = null, painelAberto = false;
    const seleciona = (b, t) => { if(selAtual && selAtual !== b.sel) L.vai(selAtual, 'opacity', t, L.d(140), 0); L.vai(b.sel, 'opacity', t, L.d(dSel), 1, eOut); selAtual = b.sel; };
    const ultImagem = blocos.map(b => !!b.clone).lastIndexOf(true);
    const digita = (b, d0, d1) => {
      const ws = []; b.textos.forEach(x => x.cs.forEach(() => ws.push(0.6 + 0.8 * L.sorte())));
      const tot = ws.reduce((a, v) => a + v, 0);
      let acc = 0, ix = 0;
      L.ponto(c.car, 'opacity', d0 - L.d(60), 1, passo);
      b.textos.forEach((x, xi) => {
        const ts = x.cs.map(() => { acc += ws[ix++]; return d0 + (d1 - d0) * acc / tot; });
        L.ponto(c.car, 'transform', xi ? ts[0] - 1 : d0 - L.d(60), x.car0, passo);
        x.cs.forEach((e, ci) => L.ponto(c.car, 'transform', ts[ci], x.car[ci], passo));
        x.ls.forEach(l => l.cs.forEach((ci, j) => { const e = x.cs[ci]; L.ponto(l.rect, 'transform', ts[ci], faixa(x, j === l.cs.length - 1 ? 1 : _crMkLim((e.x + e.width - x.bx0) / x.bw, 0.0001, 1).toFixed(4)), passo); }));
      });
      L.ponto(c.car, 'opacity', d1 + L.d(240), 0, passo);
    };
    blocos.forEach((b, i) => {
      if(b.clone){
        // tira da Biblioteca e arrasta até o lugar; a peça cresce do tamanho da miniatura até o real
        if(!painelAberto){ L.vai(c.painel, 'opacity', L.t, L.d(220), 1, eOut); L.vai(c.painel, 'transform', L.t, L.d(340), 'translateX(0px)', eOut); painelAberto = true; }
        L.vai(b.clone, 'opacity', L.t, L.d(200), 1, eOut);
        L.viaja({ x: c.tile0.x, y: c.tile0.y });
        const alvo = dentro(b.centro), [t0, t1] = L.arrasta(alvo, 780, 0.3);
        L.amostra(b.clone, 'transform', t0, t1, (tt, u) => {
          const p = L.onde(tt), cx = p.x + (b.centro.x - alvo.x) * u, cy = p.y + (b.centro.y - alvo.y) * u;
          return 'translate(' + c.px(cx - b.centro.x) + ',' + c.px(cy - b.centro.y) + ') scale(' + (b.kMin + (1 - b.kMin) * _crMkSuave(u)).toFixed(4) + ')';
        });
        L.ponto(b.clone, 'transform', t1, 'translate(0px,0px) scale(1)');
        L.vai(b.clone, 'opacity', t1, 1, 0); L.vai(b.g, 'opacity', t1, 1, 1);
        seleciona(b, t1);
        if(i === ultImagem){ L.vai(c.painel, 'opacity', L.t, L.d(240), 0, eIn); L.vai(c.painel, 'transform', L.t, L.d(320), c.painelFora, eIn); painelAberto = false; }
        if(b.tipo === 'imagem') return;
      }
      if(b.tipo === 'forma'){
        // a forma do botão/tag/selo: ferramenta Forma, arrasta do canto ao canto
        L.ferramenta('forma');
        L.viaja(dentro({ x: b.r.x0, y: b.r.y0 }));
        const [t0, t1] = L.arrasta(dentro({ x: b.r.x1, y: b.r.y1 }), 560, 0.1);
        L.vai(b.g, 'opacity', t0, L.d(60), 1); seleciona(b, t0);
        if(b.movel){
          const bw = b.r.x1 - b.r.x0, bh = b.r.y1 - b.r.y0, fr = tt => { const p = L.onde(tt); return [_crMkLim((p.x - b.r.x0) / bw, 0.03, 1).toFixed(4), _crMkLim((p.y - b.r.y0) / bh, 0.03, 1).toFixed(4)]; };
          L.amostra(b.g, 'scale', t0, t1, tt => fr(tt).join(' ')); L.ponto(b.g, 'scale', t1, '1 1');
          L.amostra(b.sel, 'transform', t0, t1, tt => 'scale(' + fr(tt).join(',') + ')'); L.ponto(b.sel, 'transform', t1, 'scale(1,1)');
        }
      }
      L.ferramenta('texto');
      if(b.tipo === 'texto'){
        // ferramenta Texto: arrasta a caixa e só então digita dentro
        const a = b.redim ? b.O : { x: b.r.x0, y: b.r.y0 }, z = b.redim ? b.cantoK : { x: b.r.x1, y: b.r.y1 };
        L.viaja(dentro(a));
        const [t0, t1] = L.arrasta(dentro(z), 520, 0.08), bw = (b.redim ? b.canto.x : b.r.x1) - a.x, bh = (b.redim ? b.canto.y : b.r.y1) - a.y;
        seleciona(b, t0);
        L.amostra(b.sel, 'transform', t0, t1, tt => { const p = L.onde(tt); return 'scale(' + _crMkLim((p.x - a.x) / bw, 0.03, 1).toFixed(4) + ',' + _crMkLim((p.y - a.y) / bh, 0.03, 1).toFixed(4) + ')'; });
        L.ponto(b.sel, 'transform', t1, b.redim ? 'scale(' + K0 + ',' + K0 + ')' : 'scale(1,1)');
        L.vai(b.g, 'opacity', t1, 1, 1);
      }
      // botão, tag, selo, cupom: clica dentro da peça; caixa de texto: clica no começo dela — e digita
      L.viaja(dentro(b.textos[0].clique)); L.clique();
      const d0 = L.t, dd = L.d(Math.min(1700, b.nc * Math.min(70, Math.max(32, 1700 / b.nc))));
      digita(b, d0, d0 + dd); L.t += dd + L.d(220);
      if(b.redim){
        // a alça do canto: o título cresce junto com o cursor (mesmo trecho reto, mesmo easing)
        L.viaja(b.cantoK);
        const [z0, z1] = L.arrasta(b.canto, 620, 0), sc = tt => (K0 + (1 - K0) * _crMkSuave(_crMkLim((tt - z0) / (z1 - z0), 0, 1))).toFixed(4);
        L.amostra(b.g, 'scale', z0, z1, tt => sc(tt)); L.ponto(b.g, 'scale', z1, '1');
        L.amostra(b.sel, 'transform', z0, z1, tt => 'scale(' + sc(tt) + ',' + sc(tt) + ')'); L.ponto(b.sel, 'transform', z1, 'scale(1,1)');
      }
    });
    // o fim, com charme: Mover, clica fora (desmarca), guias e painéis saem, o cursor vai embora
    L.ferramenta('mover');
    L.viaja({ x: W * (0.2 + 0.6 * L.sorte()), y: H * 0.03 + 10 * s }); L.clique();
    if(selAtual) L.vai(selAtual, 'opacity', L.t - L.d(120), L.d(160), 0);
    const tf = L.t;
    [c.reguaH, c.reguaV].concat(c.guias.map(g => g.el)).forEach(e => L.vai(e, 'opacity', tf, L.d(320), 0, eIn));
    L.vai(c.barra, 'opacity', tf + L.d(120), L.d(260), 0, eIn); L.vai(c.barra, 'transform', tf + L.d(120), L.d(320), c.barraFora, eIn);
    L.anda({ x: W * 1.1, y: H * 1.06 }, L.d(700), 1);
    L.espera(250);
    return L;
  };
  // ritmo: 8 a 14 s — fora disso o plano é refeito noutra velocidade
  let L = plano(1);
  const V = L.t > 14000 ? 14000 / L.t : L.t < 8000 ? Math.min(1.35, 8000 / L.t) : 1;
  if(V !== 1) L = plano(V);
  const T = L.t, { anims, relogio } = _crMkToca(c, L, T);
  if(!de) anims.push(c.host.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dSel, easing: eOut }));

  let estado = 'fim', acabou = false;
  const pular = () => { if(acabou) return; estado = 'pulou'; anims.forEach(a => { try{ a.finish(); }catch(e){} }); };
  // Pronto quando o último quadro passa (ou no pular): quem chama mostra a arte de verdade e, um
  // instante depois, a camada some por cima dela — a troca é invisível (é o mesmo desenho).
  const pronto = new Promise(res => {
    const acaba = () => {
      if(acabou) return; acabou = true; res(estado);
      setTimeout(() => {
        const a = c.host.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dSel, easing: eIn, fill: 'forwards' });
        a.finished.then(() => c.host.remove(), () => c.host.remove());
      }, dSai);
    };
    relogio.finished.then(acaba, acaba);
  });
  return { ativo: true, pronto, pular };
}
