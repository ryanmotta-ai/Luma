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

function gLayoutBounds(l){
  return {x:Number(l.x)||0,y:Number(l.y)||0,w:Math.max(0,Number(l.w)||0),h:Math.max(0,Number(l.h)||0)};
}

function gLayoutIntersects(a,b,gap){
  gap=Math.max(0,Number(gap)||0);
  return a.x < b.x+b.w+gap && a.x+a.w+gap > b.x && a.y < b.y+b.h+gap && a.y+a.h+gap > b.y;
}

function gLayoutInside(bounds,canvas,insets){
  insets=insets||{};
  const left=Math.max(0,Number(insets.left)||0), top=Math.max(0,Number(insets.top)||0);
  const right=Math.max(0,Number(insets.right)||0), bottom=Math.max(0,Number(insets.bottom)||0);
  return bounds.x>=left && bounds.y>=top && bounds.x+bounds.w<=canvas.w-right && bounds.y+bounds.h<=canvas.h-bottom;
}

function _gLayoutPriority(l,priorities){
  const value=priorities&&priorities[l.id]!=null?priorities[l.id]:l.layoutPriority;
  return Number.isFinite(Number(value))?Number(value):0;
}

function _gLayoutMovable(l,movableIds){
  if(!l||l.type==='group'||l.visible===false||l.locked||l.lockPosition)return false;
  if(l.layoutRole==='background'||l.layoutRole==='protected')return false;
  return !movableIds||movableIds.has(l.id);
}

function _gLayoutCandidate(bounds,step,direction,distance){
  const next={x:bounds.x,y:bounds.y,w:bounds.w,h:bounds.h};
  if(direction===0)next.y-=step*distance;
  else if(direction===1)next.x+=step*distance;
  else if(direction===2)next.y+=step*distance;
  else next.x-=step*distance;
  return next;
}

function gIntelligentLayoutContext(layers,W,H){
  const isStory=W===1080&&H===1920;
  const safeInsets=isStory
    ?{top:250,right:54,bottom:250,left:54}
    :{top:Math.round(H*.05),right:Math.round(W*.05),bottom:Math.round(H*.05),left:Math.round(W*.05)};
  const protectedAreas=[];
  const movableIds=[];
  const ignoredIds=[];
  const priorities={};
  const usableW=W-safeInsets.left-safeInsets.right;
  const usableH=H-safeInsets.top-safeInsets.bottom;
  (layers||[]).forEach((l,index)=>{
    if(!l)return;
    const name=String(l.name||'').toLowerCase();
    const isBackground=l.layoutRole==='background'||name==='background'||name==='bg'||(l.type==='shape'&&l.x===0&&l.y===0&&l.w>=W*.9&&l.h>=H*.9);
    if(isBackground)ignoredIds.push(l.id);
    if(l.visible!==false&&l.layoutRole==='protected')protectedAreas.push({id:l.id,x:l.x,y:l.y,w:l.w,h:l.h});
    // Não move: grupo, invisível, travado, protegido, fundo, filho de grupo (segue o grupo),
    // camada com relativeAnchor (segue o auto-spacing) ou camada que não cabe na área segura
    // (não é erro dela — empurrá-la só bloquearia as outras).
    const tooBig=(Number(l.w)||0)>usableW||(Number(l.h)||0)>usableH;
    const movable=l.type!=='group'&&l.visible!==false&&!l.locked&&!l.lockPosition
      &&l.layoutRole!=='protected'&&!isBackground&&!l.parentId&&!l.relativeAnchor&&!tooBig;
    if(movable)movableIds.push(l.id);
    priorities[l.id]=l.layoutPriority!=null?Number(l.layoutPriority):(l.type==='text'||l.id==='logo'||name.includes('logo')||name.includes('marca')?100:0);
  });
  return {canvas:{w:W,h:H},safeInsets,protectedAreas,priorities,movableIds,ignoredIds,resolveCollisions:false,gap:16,step:8,maxIterations:Math.ceil(Math.max(W,H)/8)};
}

function gResolveIntelligentLayout(layers,context){
  context=context||{};
  const canvas=context.canvas||{};
  const W=Number(canvas.w)||0,H=Number(canvas.h)||0;
  const source=layers||[];
  const cloned=source.map(l=>JSON.parse(JSON.stringify(l)));
  if(!W||!H)return {layers:cloned,diagnostics:[{type:'invalid-canvas'}],moves:[]};

  const gap=Math.max(0,Number(context.gap)||0);
  const resolveCollisions=context.resolveCollisions!==false;
  const step=Math.max(1,Number(context.step)||gap||8);
  const maxIterations=Math.max(0,Math.floor(Number(context.maxIterations)||32));
  const movableIds=Array.isArray(context.movableIds)?new Set(context.movableIds):null;
  const ignoredIds=new Set(Array.isArray(context.ignoredIds)?context.ignoredIds:[]);
  const priorities=context.priorities||{};
  const protectedAreas=(context.protectedAreas||[]).map((area,index)=>({
    id:area.id||('protected-'+index),
    bounds:gLayoutBounds(area)
  }));
  const indexed=cloned.map((layer,index)=>({layer,index,priority:_gLayoutPriority(layer,priorities)}));
  const movable=indexed.filter(item=>_gLayoutMovable(item.layer,movableIds)).sort((a,b)=>
    b.priority-a.priority||b.index-a.index||String(a.layer.id).localeCompare(String(b.layer.id))
  );
  const movableSet=new Set(movable.map(item=>item.layer.id));
  const occupied=protectedAreas.map(area=>({id:area.id,bounds:area.bounds,protected:true}));
  indexed.forEach(item=>{
    if(!movableSet.has(item.layer.id)&&!ignoredIds.has(item.layer.id)&&item.layer.visible!==false&&item.layer.type!=='group'){
      occupied.push({id:item.layer.id,bounds:gLayoutBounds(item.layer)});
    }
  });

  const diagnostics=[];
  const moves=[];
  movable.forEach(item=>{
    const layer=item.layer;
    const original=gLayoutBounds(layer);
    const insets=context.safeInsets||{};
    const left=Math.max(0,Number(insets.left)||0),top=Math.max(0,Number(insets.top)||0);
    const right=Math.max(0,Number(insets.right)||0),bottom=Math.max(0,Number(insets.bottom)||0);
    const base={
      x:Math.min(Math.max(original.x,left),W-right-original.w),
      y:Math.min(Math.max(original.y,top),H-bottom-original.h),
      w:original.w,h:original.h
    };
    let chosen=null;
    for(let distance=0;distance<=maxIterations&&!chosen;distance++){
      const directions=distance===0?[0]:[0,1,2,3];
      for(const direction of directions){
        const candidate=distance===0?base:_gLayoutCandidate(base,step,direction,distance);
        if(!gLayoutInside(candidate,{w:W,h:H},context.safeInsets))continue;
        if(occupied.some(entry=>entry.protected&&gLayoutIntersects(candidate,entry.bounds,gap)))continue;
        if(resolveCollisions&&occupied.some(entry=>gLayoutIntersects(candidate,entry.bounds,gap)))continue;
        chosen=candidate;
        break;
      }
    }
    if(!chosen){
      diagnostics.push({type:'unresolved',layerIds:[layer.id],bounds:original});
      occupied.push({id:layer.id,bounds:original});
      return;
    }
    const collisions=occupied.filter(entry=>!entry.protected&&gLayoutIntersects(chosen,entry.bounds,gap));
    if(!resolveCollisions&&collisions.length){
      diagnostics.push({type:'collision',layerIds:[layer.id].concat(collisions.map(entry=>entry.id)),bounds:chosen});
    }
    if(chosen.x!==original.x||chosen.y!==original.y){
      layer.x=chosen.x;layer.y=chosen.y;
      moves.push({id:layer.id,from:{x:original.x,y:original.y},to:{x:chosen.x,y:chosen.y},reason:'safe-area'});
    }
    occupied.push({id:layer.id,bounds:chosen});
  });

  return {layers:cloned,diagnostics,moves};
}

function gLayoutSelfCheck(){
  const input=[
    {id:'fixed',type:'shape',x:40,y:40,w:30,h:30,visible:true,locked:true},
    {id:'move',type:'text',x:40,y:40,w:30,h:30,visible:true}
  ];
  const options={canvas:{w:200,h:200},safeInsets:{top:10,right:10,bottom:10,left:10},gap:10,step:10,maxIterations:10};
  const first=gResolveIntelligentLayout(input,options);
  const second=gResolveIntelligentLayout(input,options);
  console.assert(JSON.stringify(first)===JSON.stringify(second),'Layout deve ser determinístico');
  console.assert(input[1].x===40&&input[1].y===40,'Layout não deve mutar a entrada');
  console.assert(first.moves.length===1&&!gLayoutIntersects(gLayoutBounds(first.layers[0]),gLayoutBounds(first.layers[1]),10),'Layout deve resolver colisão');
  const diagnosticOnly=gResolveIntelligentLayout(input,Object.assign({},options,{resolveCollisions:false}));
  console.assert(diagnosticOnly.moves.length===0&&diagnosticOnly.diagnostics.some(item=>item.type==='collision'),'Colisão comum deve aceitar modo somente diagnóstico');
  const blocked=gResolveIntelligentLayout([{id:'x',type:'text',x:0,y:0,w:100,h:100,visible:true}],{canvas:{w:100,h:100},safeInsets:{top:10,right:10,bottom:10,left:10}});
  console.assert(blocked.diagnostics.length===1&&blocked.moves.length===0,'Layout deve reportar ausência de solução');
  const withBackground=gResolveIntelligentLayout([
    {id:'bg',type:'shape',x:0,y:0,w:200,h:200,visible:true},
    {id:'content',type:'text',x:0,y:0,w:20,h:20,visible:true}
  ],{canvas:{w:200,h:200},safeInsets:{top:10,right:10,bottom:10,left:10},movableIds:['content'],ignoredIds:['bg']});
  console.assert(withBackground.moves.length===1&&withBackground.diagnostics.length===0,'Fundo ignorado não deve bloquear o layout');
  return first;
}
