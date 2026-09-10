/**
 * js/core/layout.js
 *
 * 5.2 — SMART RESIZE MULTI-FORMATO (motor de layout relativo).
 * Converte layers entre formatos sem distorcer: tamanho escala por UM fator
 * (s = minDim destino / minDim origem) e a POSIÇÃO re-ancora por eixo
 * (left/center/right × top/middle/bottom/stretch), inferida da posição original.
 *
 * Usado por: designer (dSetFormat reflow), png-generator (gerar outro formato),
 * preview (ver/baixar outros formatos). Overrides manuais: l.overrides={feed:{...}}.
 * Depende de: nada (puro). Carregar antes de franqueado/ e designer/.
 */

// Infere a âncora de um layer a partir da posição no canvas de origem.
// Retorna {h:'left'|'center'|'right'|'stretch', v:'top'|'middle'|'bottom'|'stretch'}
function gInferAnchor(l, W, H){
  // Normaliza geometria: shape/import degenerado (w/h/x/y undefined) gerava NaN nas
  // comparações e âncora errada silenciosa. +val||0 garante número.
  const _lx=+l.x||0, _ly=+l.y||0, _lw=+l.w||0, _lh=+l.h||0;
  l={x:_lx,y:_ly,w:_lw,h:_lh};
  // Heurística "menor margem vence": o lado em que o elemento está mais perto da
  // borda é a âncora; margens parecidas (dentro de ~14% do eixo) → centro. Cobertura
  // ≥94% do eixo → stretch (fundos, faixas). Funciona bem p/ títulos encostados, selos
  // de canto, faixas full-width, etc.
  const axis = (pos, size, total) => {
    if(size >= total*0.94 && pos <= total*0.04) return 'stretch';
    const before = pos;                  // margem antes (esq/topo)
    const after  = total - (pos + size); // margem depois (dir/base)
    if(Math.abs(before - after) <= total*0.14) return 'center';
    return before < after ? 'start' : 'end';
  };
  const hx = axis(l.x, l.w, W), vy = axis(l.y, l.h, H);
  return {
    h: hx==='start'?'left' : hx==='end'?'right' : hx,    // left|center|right|stretch
    v: vy==='start'?'top'  : vy==='end'?'bottom': vy,    // top|middle|bottom|stretch
  };
}

// Garante que cada layer tenha l.anchor (migração de templates salvos em px absoluto).
// Idempotente — só infere quando falta. Muta os layers recebidos.
function gEnsureAnchors(layers, W, H){
  (layers||[]).forEach(l=>{ if(!l.anchor) l.anchor = gInferAnchor(l, W, H); });
  return layers;
}

// Reposiciona UM eixo: dado origem (pos,size,total) e destino (size1,total1) + âncora.
function _gAxis(anchor, pos, size, total0, size1, total1, s){
  if(anchor === 'stretch') return { pos: Math.round(pos/total0*total1), size: Math.round(size/total0*total1) };
  if(anchor === 'left' || anchor === 'top') return { pos: Math.round(pos*s), size: size1 };
  if(anchor === 'right' || anchor === 'bottom'){
    const margin = total0 - (pos + size);            // distância até a borda final
    return { pos: Math.round(total1 - margin*s - size1), size: size1 };
  }
  // center/middle: mantém o centro proporcional
  const relC = (pos + size/2) / total0;
  return { pos: Math.round(relC*total1 - size1/2), size: size1 };
}

/**
 * gReflowLayers(layers, from{w,h}, to{w,h}, opts) → NOVO array de layers adaptados.
 * - Tamanhos escalam por s = min(to)/min(from) (sem distorção de proporção).
 * - Posições re-ancoram por eixo conforme l.anchor (inferida se ausente).
 * - TODA medida em px escala por s (a lista é _G_REFLOW_PX, abaixo).
 * - opts.fmtKey: aplica l.overrides[fmtKey] por cima (ajustes manuais por formato).
 * Não muta os layers de entrada.
 */
/* AS MEDIDAS EM PX QUE ACOMPANHAM A ESCALA — a lista existe porque a omissão dela era um bug.
   Até 10/09/2026 só `fontSize`, `radius` e `strokeW` escalavam. Tudo o mais que o importador
   de PSD grava em PIXEL ficava com o valor absoluto do documento original: o tracking, os
   cantos por-canto, e todas as medidas de sombra/brilho/relevo. O resultado media-se assim:
   um PSD 1080×1350 importado como Wide (1200×628) tem fator s=0,58 (628/1080), então a
   geometria encolhe 42% e o tracking e a sombra ficavam em 100% — o texto reflui, o respiro
   entre letras não, e a sombra sai ~1,7× maior do que o designer desenhou.
   Que `strokeW` e `radius` JÁ escalassem é a prova de que isto era lacuna e não decisão:
   contorno e canto são exatamente da mesma natureza que os vizinhos que ficaram de fora.
   ⚠ NÃO entram aqui, de propósito: `lineHeight` (é fator, não px), ângulos
   (`shadowAngle`/`bevelAngle`, em graus), cores, `opacity`, `inkBox` e `vectorPath`
   (normalizados 0..1) e `mask` (dataURL esticado para a caixa no render). */
const _G_REFLOW_PX = ['fontSize','letterSpacing','radius','strokeW',
  'shadowBlur','shadowDist','shadowSpread','glowSize','glowSpread',
  'innerShadowBlur','innerShadowDist','innerShadowSpread','innerGlowSize','bevelSize'];
// Medidas em px dentro da PILHA de efeitos (l.layerEffects[]), por chave.
const _G_REFLOW_PX_FX = ['blur','distance','spread','width'];
function gReflowLayers(layers, from, to, opts){
  opts = opts || {};
  // Exige os 4 lados: from.h===0 fazia _gAxis stretch dividir por zero → NaN → layer sumia.
  if(!from || !to || !from.w || !from.h || !to.w || !to.h) return layers;
  if(from.w === to.w && from.h === to.h) return layers; // mesmo formato → nada a fazer
  const s = Math.min(to.w, to.h) / Math.min(from.w, from.h);
  // Piso 1 para o que precisa continuar visível ao encolher (um contorno de 1px não vira 0);
  // as demais medidas podem chegar a 0 — uma sombra de 1px reduzida a nada é o certo.
  const _px = (v, piso) => { const n = Math.round((+v||0)*s); return piso ? Math.max(piso, n) : n; };
  return (layers||[]).map(src=>{
    const l = JSON.parse(JSON.stringify(src));
    const a = l.anchor || gInferAnchor(l, from.w, from.h);
    const w1 = Math.max(1, Math.round(l.w*s));
    const h1 = Math.max(1, Math.round(l.h*s));
    const X = _gAxis(a.h, l.x, l.w, from.w, w1, to.w, s);
    const Y = _gAxis(a.v, l.y, l.h, from.h, h1, to.h, s);
    l.x = X.pos; l.w = X.size;
    l.y = Y.pos; l.h = Y.size;
    _G_REFLOW_PX.forEach(k=>{
      if(l[k] == null || !isFinite(+l[k]) || +l[k] === 0) return;
      // radius 999 é o sentinela de "círculo" do editor — escalar transformaria num raio real.
      if(k === 'radius' && l.radius >= 999) return;
      // fontSize e strokeW mantêm os pisos históricos (8px e 1px); o resto pode ir a zero.
      l[k] = _px(l[k], k === 'fontSize' ? 8 : (k === 'strokeW' ? 1 : 0));
    });
    // Cantos por-canto: mesma natureza do `radius` uniforme, um valor por vértice.
    if(l.radii) ['tl','tr','br','bl'].forEach(c=>{ if(l.radii[c]) l.radii[c] = _px(l.radii[c]); });
    // Tracejado: o array é uma sequência de medidas em px (traço, vão, traço…).
    if(Array.isArray(l.strokeDash)) l.strokeDash = l.strokeDash.map(d=>_px(d));
    // Pilha de efeitos do Photoshop: mesmas medidas, uma vez por instância.
    if(Array.isArray(l.layerEffects)) l.layerEffects.forEach(e=>{
      if(!e) return;
      _G_REFLOW_PX_FX.forEach(k=>{ if(e[k] != null && isFinite(+e[k]) && +e[k] !== 0) e[k] = _px(e[k], k === 'width' ? 1 : 0); });
    });
    /* Recorte do PSD: `clipBaseSnapshot` é a geometria da camada-base NO MOMENTO DA IMPORTAÇÃO,
       e o motor a usa como prova de "a base não mudou → posso usar o alpha que o Photoshop
       gravou, mais preciso na borda". Depois do reflow ela mudou por definição, então o
       snapshot é uma comparação que nunca mais bate: apagá-lo diz isso explicitamente e o
       render passa ao vínculo VIVO (`clipBaseId`), que reflui junto e continua correto.
       Escalá-lo seria pior — daria um "não mudou" falso sobre um alpha da resolução antiga. */
    if(l.clipBaseSnapshot) delete l.clipBaseSnapshot;
    l.anchor = a; // persiste a âncora usada
    // Overrides manuais por formato têm a palavra final
    if(opts.fmtKey && src.overrides && src.overrides[opts.fmtKey]){
      Object.assign(l, src.overrides[opts.fmtKey]);
    }
    return l;
  });
}

// Normaliza chave de formato ('post' → 'wide') para overrides/lookup.
function gFmtKey(id){ return id === 'post' ? 'wide' : id; }
