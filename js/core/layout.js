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
 * - fontSize/radius/strokeW escalam por s (radius 999 = círculo, preservado).
 * - opts.fmtKey: aplica l.overrides[fmtKey] por cima (ajustes manuais por formato).
 * Não muta os layers de entrada.
 */
function gReflowLayers(layers, from, to, opts){
  opts = opts || {};
  // Exige os 4 lados: from.h===0 fazia _gAxis stretch dividir por zero → NaN → layer sumia.
  if(!from || !to || !from.w || !from.h || !to.w || !to.h) return layers;
  if(from.w === to.w && from.h === to.h) return layers; // mesmo formato → nada a fazer
  const s = Math.min(to.w, to.h) / Math.min(from.w, from.h);
  return (layers||[]).map(src=>{
    const l = JSON.parse(JSON.stringify(src));
    const a = l.anchor || gInferAnchor(l, from.w, from.h);
    const w1 = Math.max(1, Math.round(l.w*s));
    const h1 = Math.max(1, Math.round(l.h*s));
    const X = _gAxis(a.h, l.x, l.w, from.w, w1, to.w, s);
    const Y = _gAxis(a.v, l.y, l.h, from.h, h1, to.h, s);
    l.x = X.pos; l.w = X.size;
    l.y = Y.pos; l.h = Y.size;
    if(l.fontSize) l.fontSize = Math.max(8, Math.round(l.fontSize*s));
    if(l.radius && l.radius < 999) l.radius = Math.round(l.radius*s);
    if(l.strokeW) l.strokeW = Math.max(1, Math.round(l.strokeW*s));
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
