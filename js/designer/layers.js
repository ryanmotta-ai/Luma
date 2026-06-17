/**
 * js/designer/layers.js
 *
 * CRUD de layers, painel lateral, props, multi-select, rename:
 * dSelLayer, dDeselect, dRenderLayersList, dShowProps, dAddText,
 * dAddShape, dToggleMultiSel, dRenameLayer, dAddIcon, dAddLine.
 * Depende de: designer/canvas.js
 */

function dSelLayer(id){
  dSelId=id;
  const l=dLayers.find(x=>x.id===id);
  if(l){
    if (l.type !== 'group') {
      dMultiSel = [];
    } else if (l.type === 'group') {
      const children = dLayers.filter(x => x.parentId === l.id);
      dMultiSel = children.map(x => x.id);
    }
  }
  dRenderCanvas();
  dRenderLayersList();
  if(l){
    try{
      dShowProps(l);
    }catch(err){
      console.warn('[dSelLayer] erro em dShowProps — seleção preservada:',err);
    }
    dUpdateCtxBar();
  }
}

// M2.1 — espelha hover entre a lista de layers e o elemento no canvas (e vice-versa)
function dHoverLayer(id,on){
  const cv=document.querySelector(`.canvas-layer[data-id="${id}"]`);
  if(cv)cv.classList.toggle('layer-hover',!!on);
  const row=document.querySelector(`.layer-row[data-lid="${id}"]`);
  if(row)row.classList.toggle('row-hover',!!on);
}

// Versão sem render — apenas atualiza dSelId e o painel de props.
// Usar nos dAdd* para evitar double-render (o chamador já fez dRenderCanvas).
function dSelLayerState(id){dSelId=id;const l=dLayers.find(x=>x.id===id);if(l){dShowProps(l);dUpdateCtxBar();}}
function dDeselect(e){
  const ws=document.getElementById('d-workspace');
  const wr=document.getElementById('d-canvas-wrapper');
  if(e.target===wr||e.target===ws){
    if(dTool==='select'){dSelId=null;dRenderCanvas();dRenderLayersList();document.getElementById('d-no-sel').style.display='';document.getElementById('d-props-form').style.display='none';dUpdateCtxBar();}
  }
}

/* ── DRAG ── */
// Cache de elementos DOM para o drag atual — populado em dStartDrag,
// evita querySelector repetido a cada frame de mousemove.
let dDragEls = {};
// Isolamento adiado da multi-seleção: clicar num membro arrasta o grupo; se NÃO arrastar,
// o clique isola aquele layer no mouseup. dPendingIsolate = id alvo; dDragMoved = houve arrasto.
let dPendingIsolate = null;
let dDragMoved = false;

function dStartDrag(e,l){
  e.preventDefault();dDrag=l;dDragSX=e.clientX;dDragSY=e.clientY;dLyrSX=l.x;dLyrSY=l.y;
  dDragMoved=false;
  // Salvar posição inicial dos siblings do grupo
  dDragGroup=dGetGroupSiblings(l).filter(x=>x.id!==l.id);
  dDragGroupStart=dDragGroup.map(s=>({id:s.id,x:s.x,y:s.y}));
  // Salvar posição inicial dos multi-sel (evitando duplicar os que já estão no grupo)
  const siblingIds = dDragGroup.map(x => x.id);
  dDragMulti=dMultiSel.filter(id=>id!==l.id && !siblingIds.includes(id)).map(id=>{const sl=dLayers.find(x=>x.id===id);return sl?{id,x:sl.x,y:sl.y,layer:sl}:null;}).filter(Boolean);
  // Cachear referências DOM de todos os layers envolvidos — evita querySelector no hot path
  dDragEls = {};
  const involved = [l.id, ...dDragGroupStart.map(s=>s.id), ...dDragMulti.map(s=>s.id)];
  involved.forEach(id=>{
    const el = document.querySelector(`[data-id="${id}"]`);
    if(el) dDragEls[id] = el;
  });
  document.addEventListener('mousemove',dOnDrag);document.addEventListener('mouseup',dStopDrag);
}
function dOnDrag(e){
  if(!dDrag)return;
  if(Math.abs(e.clientX-dDragSX)+Math.abs(e.clientY-dDragSY) > 3) dDragMoved=true;
  const scale=dZoomLevel/100;
  const rawX=Math.round(dLyrSX+(e.clientX-dDragSX)/scale);
  const rawY=Math.round(dLyrSY+(e.clientY-dDragSY)/scale);
  // Aplicar snap
  const snap=dCalculateSnap(dDrag, rawX, rawY);
  const dx=snap.x-dLyrSX, dy=snap.y-dLyrSY;
  dDrag.x=snap.x;dDrag.y=snap.y;
  if(snap.guides.length)dShowGuides(snap.guides);else dClearGuides();
  const el=dDragEls[dDrag.id];
  if(el){el.style.left=dDrag.x+'px';el.style.top=dDrag.y+'px';}
  // Mover siblings do grupo
  if(dDragGroupStart&&dDragGroupStart.length){
    dDragGroupStart.forEach(s=>{
      const sl=dLayers.find(x=>x.id===s.id);
      if(!sl||sl.locked)return;
      sl.x=s.x+dx;sl.y=s.y+dy;
      const sEl=dDragEls[s.id];
      if(sEl){sEl.style.left=sl.x+'px';sEl.style.top=sl.y+'px';}
    });
  }
  // Mover multi-sel
  if(dDragMulti&&dDragMulti.length){
    dDragMulti.forEach(s=>{
      if(!s.layer||s.layer.locked)return;
      s.layer.x=s.x+dx;s.layer.y=s.y+dy;
      const mEl=dDragEls[s.id];
      if(mEl){mEl.style.left=s.layer.x+'px';mEl.style.top=s.layer.y+'px';}
    });
  }
  if(document.getElementById('dp-x')){document.getElementById('dp-x').value=dDrag.x;document.getElementById('dp-y').value=dDrag.y;}
}
function dStopDrag(){
  if(dDrag){dHistoryPush();dMarkUnsaved();}
  dDrag=null;dDragEls={};dClearGuides();
  document.removeEventListener('mousemove',dOnDrag);document.removeEventListener('mouseup',dStopDrag);
  // Clique simples (sem arrasto) num membro da multi-seleção → isola aquele layer (M21).
  if(dPendingIsolate!=null && !dDragMoved && dMultiSel.length>1){
    dClearMultiSel();
    dSelLayer(dPendingIsolate);
  }
  dPendingIsolate=null;
}

/* ── RESIZE ── */
// Elemento DOM cacheado para o resize atual
let dResizeEl = null;
let dResizePos = null;
let dResizeLyrX = 0;
let dResizeLyrY = 0;

function dStartResize(e,l,pos){
  e.preventDefault();
  dResize=l;
  dResizeSX=e.clientX;
  dResizeSY=e.clientY;
  dResizeW=l.w;
  dResizeH=l.h;
  dResizePos=pos;
  dResizeLyrX=l.x;
  dResizeLyrY=l.y;
  dResizeEl = document.querySelector(`[data-id="${l.id}"]`);
  document.addEventListener('mousemove',dOnResize);
  document.addEventListener('mouseup',dStopResize);
}
function dOnResize(e){
  if(!dResize)return;
  const scale=dZoomLevel/100;
  const dx=(e.clientX-dResizeSX)/scale,dy=(e.clientY-dResizeSY)/scale;

  let factor_x = 1;
  let factor_y = 1;
  if (dResizePos === 'tl') {
    factor_x = -1;
    factor_y = -1;
  } else if (dResizePos === 'tr') {
    factor_x = 1;
    factor_y = -1;
  } else if (dResizePos === 'bl') {
    factor_x = -1;
    factor_y = 1;
  } else if (dResizePos === 'br') {
    factor_x = 1;
    factor_y = 1;
  }

  const isShift = e.shiftKey;
  const isAlt = e.altKey;
  const altMultiplier = isAlt ? 2 : 1;

  let w, h;
  if (isShift) {
    const distSq = dResizeW * dResizeW + dResizeH * dResizeH;
    let s = 1;
    if (distSq > 0) {
      const proj = (dx * factor_x * dResizeW + dy * factor_y * dResizeH) / distSq;
      s = 1 + proj * altMultiplier;
    }
    const sMin = Math.max(20 / dResizeW, 10 / dResizeH);
    if (s < sMin) s = sMin;
    w = Math.round(dResizeW * s);
    h = Math.round(dResizeH * s);
  } else {
    w = dResizeW + dx * factor_x * altMultiplier;
    h = dResizeH + dy * factor_y * altMultiplier;
    w = Math.max(20, Math.round(w));
    h = Math.max(10, Math.round(h));
  }

  dResize.w = w;
  dResize.h = h;

  if (isAlt) {
    const cx = dResizeLyrX + dResizeW / 2;
    const cy = dResizeLyrY + dResizeH / 2;
    dResize.x = Math.round(cx - w / 2);
    dResize.y = Math.round(cy - h / 2);
  } else {
    if (dResizePos === 'br') {
      dResize.x = dResizeLyrX;
      dResize.y = dResizeLyrY;
    } else if (dResizePos === 'tl') {
      dResize.x = Math.round(dResizeLyrX + dResizeW - w);
      dResize.y = Math.round(dResizeLyrY + dResizeH - h);
    } else if (dResizePos === 'tr') {
      dResize.x = dResizeLyrX;
      dResize.y = Math.round(dResizeLyrY + dResizeH - h);
    } else if (dResizePos === 'bl') {
      dResize.x = Math.round(dResizeLyrX + dResizeW - w);
      dResize.y = dResizeLyrY;
    }
  }

  if (dResizeEl) {
    dResizeEl.style.width=dResize.w+'px';
    dResizeEl.style.height=dResize.h+'px';
    dResizeEl.style.left=dResize.x+'px';
    dResizeEl.style.top=dResize.y+'px';
  }
  if(document.getElementById('dp-w')){document.getElementById('dp-w').value=dResize.w;document.getElementById('dp-h').value=dResize.h;}
  if(document.getElementById('dp-x')){document.getElementById('dp-x').value=dResize.x;}
  if(document.getElementById('dp-y')){document.getElementById('dp-y').value=dResize.y;}
}
function dStopResize(){
  if(dResize){
    dHistoryPush();
    dMarkUnsaved();
    if(typeof dRenderCanvas==='function')dRenderCanvas();
  }
  dResize=null;
  dResizeEl=null;
  document.removeEventListener('mousemove',dOnResize);
  document.removeEventListener('mouseup',dStopResize);
}

/* ── ADD LAYERS ── */
// Tamanho da prancheta ATIVA (não o preset do formato): evita posicionar layers em
// 1080x1920 quando a prancheta tem outro tamanho (ex.: PSD importado) e evita TypeError
// quando dFmt não está em DFMT_SIZES (ex.: 'orig'). Mesmo padrão de canvas.js/brush.js.
function dCanvasSize(){ const ab=(typeof dGetActiveAB==='function')&&dGetActiveAB(); return ab?{w:ab.w,h:ab.h}:(DFMT_SIZES[dFmt]||DFMT_SIZES.story); }
function dAddText(){const f=dCanvasSize();dAddTextAt(20,Math.round(f.h/2));}
function dAddShape(){const f=dCanvasSize();dAddShapeAt(40,40);}
function dAddImage(){const f=dCanvasSize();dAddImageAt(40,100);}
function dAddTextAt(x,y){  dHistoryPush();
  const id='l-'+(++dLyrCnt);
  dLayers.push({id,name:'Texto '+dLyrCnt,type:'text',x,y,w:200,h:50,content:'Novo texto {{variavel}}',font:"'Roboto Black'",fontSize:32,color:'#FFFFFF',textAlign:'left',visible:true});
  dSelLayerState(id);dRenderCanvas();dRenderLayersList();dStats();dMarkUnsaved();dSetTool('select');gToast('Layer de texto adicionado');
  setTimeout(()=>dFlashLayer(id),30);
}
function dAddShapeAt(x,y){  dHistoryPush();
  const id='l-'+(++dLyrCnt);
  dLayers.push({id,name:'Shape '+dLyrCnt,type:'shape',x,y,w:200,h:80,fill:'#FF9000',opacity:100,radius:0,visible:true});
  dSelLayerState(id);dRenderCanvas();dRenderLayersList();dStats();dMarkUnsaved();dSetTool('select');gToast('Shape adicionado');
  setTimeout(()=>dFlashLayer(id),30);
}
function dAddImageAt(x,y){  dHistoryPush();
  const id='l-'+(++dLyrCnt);
  dLayers.push({id,name:'Imagem '+dLyrCnt,type:'image',x,y,w:120,h:120,imgUrl:'',imgVar:'',objectFit:'cover',visible:true});
  dSelLayerState(id);dRenderCanvas();dRenderLayersList();dStats();dMarkUnsaved();dSetTool('select');gToast('Layer de imagem adicionado');
  setTimeout(()=>dFlashLayer(id),30);
}
function dAddFrame(){const f=dCanvasSize();dAddFrameAt(Math.round(f.w*.05),Math.round(f.h*.04));}
function dAddFrameAt(x,y){  dHistoryPush();
  const f=dCanvasSize();
  const id='l-'+(++dLyrCnt);
  dLayers.push({id,name:'Moldura '+dLyrCnt,type:'frame',x,y,w:Math.round(f.w*.6),h:Math.round(f.h*.35),imgUrl:'',imgVar:'foto_produto',objectFit:'cover',frameShape:'rect',visible:true});
  dSelLayerState(id);dRenderCanvas();dRenderLayersList();dStats();dMarkUnsaved();dSetTool('select');gToast('Moldura adicionada — clique em + FOTO para inserir imagem');
  setTimeout(()=>dFlashLayer(id),30);
}

/* ── DELETE / REORDER / ALIGN ── */
function dDeleteLayer(){
  if(!dSelId)return;
  const l=dLayers.find(x=>x.id===dSelId);
  dHistoryPush();
  if (l && l.type === 'group') {
    const deleteChildren = confirm('Deseja excluir também todos os layers deste grupo?');
    if (deleteChildren) {
      dLayers = dLayers.filter(x => x.id !== dSelId && x.parentId !== dSelId);
    } else {
      dLayers.forEach(x => {
        if (x.parentId === dSelId) {
          delete x.parentId;
        }
      });
      dLayers = dLayers.filter(x => x.id !== dSelId);
    }
  } else {
    dLayers = dLayers.filter(x => x.id !== dSelId);
  }
  dSelId=null;
  dRenderCanvas();dRenderLayersList();dStats();dMarkUnsaved();
  document.getElementById('d-no-sel').style.display='';document.getElementById('d-props-form').style.display='none';
  gToast('Removido');
}
function dReorder(dir){
  if(!dSelId)return;
  const i=dLayers.findIndex(x=>x.id===dSelId);if(i<0)return; // dSelId obsoleto → não mexe
  const ni=i-dir;if(ni<0||ni>=dLayers.length)return;
  dHistoryPush();
  [dLayers[i],dLayers[ni]]=[dLayers[ni],dLayers[i]];
  dRenderCanvas();dRenderLayersList();dMarkUnsaved();
}
function dAlign(dir){
  // 2+ selecionados → alinha ENTRE SI (bounding box do conjunto)
  const sel = dMultiSel.length>=2 ? dMultiSel.map(id=>dLayers.find(x=>x.id===id)).filter(Boolean) : null;
  if(sel && sel.length>=2){
    dHistoryPush();
    const minX=Math.min(...sel.map(l=>l.x)), maxX=Math.max(...sel.map(l=>l.x+l.w));
    const minY=Math.min(...sel.map(l=>l.y)), maxY=Math.max(...sel.map(l=>l.y+l.h));
    const cx=(minX+maxX)/2, cy=(minY+maxY)/2;
    sel.forEach(l=>{
      if(l.locked)return;
      if(dir==='left')l.x=minX;
      else if(dir==='right')l.x=Math.round(maxX-l.w);
      else if(dir==='center')l.x=Math.round(cx-l.w/2);
      else if(dir==='top')l.y=minY;
      else if(dir==='bottom')l.y=Math.round(maxY-l.h);
      else if(dir==='vmid')l.y=Math.round(cy-l.h/2);
    });
    dRenderCanvas();dRenderLayersList();dMarkUnsaved();
    return;
  }
  // 1 layer → alinha ao canvas (comportamento original)
  const l=dLayers.find(x=>x.id===dSelId);if(!l)return;
  dHistoryPush();
  const f=dCanvasSize();
  if(dir==='left')l.x=0;
  else if(dir==='center')l.x=Math.round((f.w-l.w)/2);
  else if(dir==='right')l.x=f.w-l.w;
  else if(dir==='top')l.y=0;
  else if(dir==='vmid')l.y=Math.round((f.h-l.h)/2);
  else if(dir==='bottom')l.y=f.h-l.h;
  dRenderCanvas();
  const dpx=document.getElementById('dp-x'),dpy=document.getElementById('dp-y');
  if(dpx){dpx.value=l.x;dpy.value=l.y;}
  dMarkUnsaved();
}
// Distribui 3+ layers selecionados com espaçamento (gap) igual entre eles
function dDistribute(axis){
  const sel=dMultiSel.map(id=>dLayers.find(x=>x.id===id)).filter(Boolean);
  if(sel.length<3){gToast('Selecione 3 ou mais layers para distribuir');return;}
  dHistoryPush();
  if(axis==='h'){
    sel.sort((a,b)=>a.x-b.x);
    const span=(sel[sel.length-1].x+sel[sel.length-1].w)-sel[0].x;
    const totalW=sel.reduce((s,l)=>s+l.w,0);
    const gap=(span-totalW)/(sel.length-1);
    let cur=sel[0].x+sel[0].w;
    for(let i=1;i<sel.length-1;i++){ sel[i].x=Math.round(cur+gap); cur=sel[i].x+sel[i].w; }
  }else{
    sel.sort((a,b)=>a.y-b.y);
    const span=(sel[sel.length-1].y+sel[sel.length-1].h)-sel[0].y;
    const totalH=sel.reduce((s,l)=>s+l.h,0);
    const gap=(span-totalH)/(sel.length-1);
    let cur=sel[0].y+sel[0].h;
    for(let i=1;i<sel.length-1;i++){ sel[i].y=Math.round(cur+gap); cur=sel[i].y+sel[i].h; }
  }
  dRenderCanvas();dRenderLayersList();dMarkUnsaved();
}

/* ── LAYERS LIST ── */
function dToggleGroupCollapse(e, id) {
  if (e) e.stopPropagation();
  const l = dLayers.find(x => x.id === id);
  if (l && l.type === 'group') {
    dHistoryPush();
    l.collapsed = !l.collapsed;
    dRenderLayersList();
    dMarkUnsaved();
  }
}

function dRenderLayersList(){
  const el=document.getElementById('d-layers-list');
  el.innerHTML=[...dLayers].reverse().map(l=>{
    // Check if any ancestor is collapsed
    let parentId = l.parentId;
    let isHidden = false;
    while (parentId) {
      const parent = dLayers.find(x => x.id === parentId);
      if (parent) {
        if (parent.collapsed) {
          isHidden = true;
          break;
        }
        parentId = parent.parentId;
      } else {
        break;
      }
    }
    if (isHidden) return '';

    if (l.type === 'group') {
      const toggleIcon = l.collapsed
        ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:middle"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
        : `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:middle"><polygon points="3 5 21 5 12 19 3 5"/></svg>`;
      const locked = l.locked ? `<span style="margin-left:4px;display:inline-flex;align-items:center;color:var(--d-text3);vertical-align:middle"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>` : '';
      return `<div class="layer-row group-row ${l.id === dSelId ? 'active' : ''}"
        data-lid="${l.id}"
        draggable="true"
        onclick="event.shiftKey?dToggleMultiSel('${l.id}'):dSelLayer('${l.id}')"
        ondragstart="dLyrDragStart(event,'${l.id}')"
        ondragover="dLyrDragOver(event)"
        ondragleave="dLyrDragLeave(event)"
        ondragend="dLyrDragEnd(event)"
        ondrop="dLyrDrop(event,'${l.id}')">
        <span class="layer-drag-handle" title="Arrastar para reordenar">⠿</span>
        <span class="group-collapse-toggle" onclick="dToggleGroupCollapse(event, '${l.id}')">${toggleIcon}</span>
        <span class="layer-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><path d="M2 10h20"/></svg></span>
        <span class="layer-label group-label" style="opacity:${l.visible?1:.4}" ondblclick="dRenameLayer('${l.id}',event)" title="Duplo clique para renomear">${gEsc(l.name)}</span>
        ${locked}
        <button class="layer-lock ${l.locked?'locked':''}" onclick="dToggleLock(event,'${l.id}')" title="${l.locked?'Desbloquear':'Bloquear grupo'}">${l.locked?'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>':'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>'}</button>
        <button class="layer-vis" onclick="dToggleVis(event,'${l.id}')">${l.visible?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'}</button>
      </div>`;
    }

    const isChild = !!l.parentId;
    const indentStyle = isChild ? 'style="padding-left: 28px;"' : '';
    const childClass = isChild ? 'child-row' : '';

    const icon=l.type==='text'?'T':l.type==='image'?'▣':l.type==='frame'?'⬜':'■';
    const hasVar=l.type==='text'&&/\{\{/.test(l.content||'');
    const locked = l.locked ? `<span style="margin-left:4px;display:inline-flex;align-items:center;color:var(--d-text3);vertical-align:middle"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>` : '';
    return `<div class="layer-row ${childClass} ${l.id===dSelId||dMultiSel.includes(l.id)?'active':''}"
      ${indentStyle}
      data-lid="${l.id}"
      draggable="true"
      onmouseenter="dHoverLayer('${l.id}',true)"
      onmouseleave="dHoverLayer('${l.id}',false)"
      onclick="event.shiftKey?dToggleMultiSel('${l.id}'):dSelLayer('${l.id}')"
      ondragstart="dLyrDragStart(event,'${l.id}')"
      ondragover="dLyrDragOver(event)"
      ondragleave="dLyrDragLeave(event)"
      ondragend="dLyrDragEnd(event)"
      ondrop="dLyrDrop(event,'${l.id}')">
      <span class="layer-drag-handle" title="Arrastar para reordenar">⠿</span>
      <span class="layer-icon">${icon}</span>
      <span class="layer-label" style="opacity:${l.visible?1:.4}" ondblclick="dRenameLayer('${l.id}',event)" title="Duplo clique para renomear">${gEsc(l.name)}</span>
      ${hasVar?'<span class="lyr-badge lyr-var">var</span>':''}
      ${l.type==='image'?'<span class="lyr-badge lyr-img">img</span>':''}
      ${l.type==='frame'?'<span class="lyr-badge lyr-img">frame</span>':''}
      ${l.type==='shape'?'<span class="lyr-badge lyr-shp">shape</span>':''}
      ${l.mask?`<span class="lyr-badge lyr-mask" title="Máscara aplicada — clique para remover" onclick="event.stopPropagation();dRemoveMask('${l.id}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:2px"><rect x="2" y="7" width="20" height="10" rx="5"/><circle cx="7" cy="12" r="1.5"/><circle cx="17" cy="12" r="1.5"/><path d="M12 10v4"/></svg></span>`:''}
      ${locked}
      <button class="layer-lock ${l.locked?'locked':''}" onclick="dToggleLock(event,'${l.id}')" title="${l.locked?'Desbloquear':'Bloquear layer'}">${l.locked?'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>':'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>'}</button>
      <button class="layer-vis" onclick="dToggleVis(event,'${l.id}')">${l.visible?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'}</button>
    </div>`;
  }).join('');
}

/* DnD layers */
let dLyrDragId=null;
function dLyrDragStart(e,id){
  dLyrDragId=id;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed='move';
}
function dLyrDragOver(e){
  e.preventDefault();e.dataTransfer.dropEffect='move';
  e.currentTarget.classList.add('drag-over');
}
function dLyrDragLeave(e){e.currentTarget.classList.remove('drag-over');}
function dLyrDragEnd(e){
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.layer-row').forEach(row => row.classList.remove('drag-over', 'dragging'));
  dLyrDragId=null;
}
function dLyrDrop(e,targetId){
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over','dragging');
  if(!dLyrDragId||dLyrDragId===targetId)return;

  const dragLayer=dLayers.find(x=>x.id===dLyrDragId);
  const targetLayer=dLayers.find(x=>x.id===targetId);
  if(!dragLayer||!targetLayer)return;

  dHistoryPush();

  const movingIds = [];
  if (dragLayer.type === 'group') {
    movingIds.push(dragLayer.id);
    dLayers.forEach(l => {
      if (l.parentId === dragLayer.id) {
        movingIds.push(l.id);
      }
    });
  } else {
    movingIds.push(dragLayer.id);
  }

  const movingLayers = dLayers.filter(l => movingIds.includes(l.id));
  dLayers = dLayers.filter(l => !movingIds.includes(l.id));

  let insertIdx = dLayers.findIndex(l => l.id === targetId);
  if (insertIdx < 0) {
    insertIdx = dLayers.length;
  }

  if (dragLayer.type !== 'group') {
    if (targetLayer.type === 'group') {
      dragLayer.parentId = targetLayer.id;
    } else if (targetLayer.parentId) {
      dragLayer.parentId = targetLayer.parentId;
    } else {
      delete dragLayer.parentId;
    }
  }

  dLayers.splice(insertIdx, 0, ...movingLayers);

  dLyrDragId = null;
  dRenderCanvas();dRenderLayersList();dMarkUnsaved();
}
function dToggleVis(e,id){
  e.stopPropagation();
  const l=dLayers.find(x=>x.id===id);
  if(l){
    dHistoryPush();
    l.visible=!l.visible;
    if (l.type === 'group') {
      dLayers.forEach(x => {
        if (x.parentId === l.id) {
          x.visible = l.visible;
        }
      });
    }
    dRenderCanvas();dRenderLayersList();dMarkUnsaved();
  }
}

function dToggleLock(e,id){
  e.stopPropagation();
  const l=dLayers.find(x=>x.id===id);
  if(l){
    dHistoryPush();
    l.locked=!l.locked;
    if(l.type==='group'){
      dLayers.forEach(x=>{ if(x.parentId===l.id) x.locked=l.locked; });
    }
    dRenderCanvas();dRenderLayersList();dMarkUnsaved();
  }
}

/* ── PROPS ── */
function dShowProps(l){
  document.getElementById('d-no-sel').style.display='none';
  const pf=document.getElementById('d-props-form');pf.style.display='flex';
  if (l.type === 'group') {
    if(document.getElementById('dp-x')) document.getElementById('dp-x').value = '';
    if(document.getElementById('dp-y')) document.getElementById('dp-y').value = '';
    if(document.getElementById('dp-w')) document.getElementById('dp-w').value = '';
    if(document.getElementById('dp-h')) document.getElementById('dp-h').value = '';
    document.getElementById('d-text-props').style.display = 'none';
    document.getElementById('d-shape-props').style.display = 'none';
    document.getElementById('d-image-props').style.display = 'none';
    const ctx=document.getElementById('d-props-ctx');
    if(ctx){
      ctx.style.display='flex';
      const iconEl=document.getElementById('d-props-ctx-icon');
      if(iconEl){iconEl.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><path d="M2 10h20"/></svg>';iconEl.style.background='var(--d-text3)';}
      const nameEl=document.getElementById('d-props-ctx-name');
      if(nameEl)nameEl.textContent=l.name;
      const typeEl=document.getElementById('d-props-ctx-type');
      if(typeEl)typeEl.textContent='grupo';
    }
    return;
  }
  // Atualizar header de contexto
  const ctx=document.getElementById('d-props-ctx');
  if(ctx){
    ctx.style.display='flex';
    const icons={text:'T',shape:'■',frame:'⬜',image:'▣'};
    const typeLabels={text:'texto',shape:'shape',frame:'moldura',image:'imagem'};
    const iconEl=document.getElementById('d-props-ctx-icon');
    if(iconEl){iconEl.textContent=icons[l.type]||'?';iconEl.style.background=l.type==='text'?'var(--var-color)':l.type==='frame'?'var(--dm-orange)':l.type==='shape'?'var(--dm-red)':'var(--green)';}
    const nameEl=document.getElementById('d-props-ctx-name');
    if(nameEl)nameEl.textContent=l.name;
    const typeEl=document.getElementById('d-props-ctx-type');
    if(typeEl)typeEl.textContent=typeLabels[l.type]||l.type;
  }
  document.getElementById('dp-x').value=l.x;document.getElementById('dp-y').value=l.y;
  document.getElementById('dp-w').value=l.w;document.getElementById('dp-h').value=l.h;
  const isText=l.type==='text',isImg=l.type==='image'||l.type==='frame',isShp=l.type==='shape';
  document.getElementById('d-text-props').style.display=isText?'':'none';
  document.getElementById('d-shape-props').style.display=isShp?'':'none';
  document.getElementById('d-image-props').style.display=isImg?'':'none';
  if(typeof dPopBindingSelects==='function')dPopBindingSelects(l); // 4.1 — vínculos de propriedade
  if(typeof dRenderRules==='function')dRenderRules(l); // 4.2 — regras condicionais
  if(typeof dMaskRenderProps==='function')dMaskRenderProps(l); // máscaras de camada
  if(isText){
    document.getElementById('dp-content').value=l.content||'';
    dAttachVarAutocomplete(document.getElementById('dp-content'), v=>dUpdateProp('content',v)); // V1/V2
    if(typeof dPopFontSelects==='function')dPopFontSelects(); // inclui fontes enviadas (#dp-font)
    document.getElementById('dp-font').value=l.font||"'Roboto Black'";
    document.getElementById('dp-fsize').value=l.fontSize||24;
    document.getElementById('dp-align').value=l.textAlign||'left';
    const col=l.color||'#ffffff';
    document.getElementById('dp-color-sw').style.background=col;
    const safeCol=col.startsWith('rgba')?'#ffffff':col;
    document.getElementById('dp-color-pick').value=safeCol;
    const hexC=document.getElementById('dp-color-hex');if(hexC)hexC.value=safeCol.toUpperCase();
    dPopVarSel();
  }
  if(isShp){
    const fill=l.fill||'#FF9000';
    document.getElementById('dp-fill-sw').style.background=fill;
    document.getElementById('dp-fill-pick').value=fill;
    const hexF=document.getElementById('dp-fill-hex');if(hexF)hexF.value=fill.toUpperCase();
    document.getElementById('dp-opacity').value=l.opacity||100;
    document.getElementById('dp-radius').value=l.radius||0;
    dSyncRadiusUI(l.radius||0); // sincroniza slider + preview do widget de radius
  }
  if(isImg){
    document.getElementById('dp-imgurl').value=l.imgUrl||'';
    document.getElementById('dp-imgfit').value=l.objectFit||'cover';
    const imgSel=document.getElementById('dp-imgvar');
    const imgVars=dVars.filter(v=>v.type==='image');
    imgSel.innerHTML='<option value="">URL fixa</option>'+imgVars.map(v=>`<option value="${v.name}" ${v.name===l.imgVar?'selected':''}>${v.label}</option>`).join('');
    // Para frames: mostrar opção de shape e radius
    const fsRow=document.getElementById('dp-frame-shape-row');
    const frRow=document.getElementById('dp-frame-radius-row');
    const isFrame=l.type==='frame';
    if(fsRow)fsRow.style.display=isFrame?'flex':'none';
    if(frRow)frRow.style.display=isFrame?'flex':'none';
    if(isFrame){
      const fsEl=document.getElementById('dp-frame-shape');
      if(fsEl)fsEl.value=l.frameShape||'rect';
      const frEl=document.getElementById('dp-frame-radius');
      if(frEl)frEl.value=l.radius||8;
    }
    // Botão de upload direto no painel
    const upPanelBtn=document.getElementById('dp-frame-upload');
    if(upPanelBtn){
      upPanelBtn.style.display=l.type==='frame'?'block':'none';
      upPanelBtn.onclick=()=>{
        const inp=document.createElement('input');inp.type='file';inp.accept='image/*';
        inp.onchange=ev=>{const file=ev.target.files[0];if(!file)return;const r=new FileReader();r.onload=re=>{l.imgUrl=re.result;dRenderCanvas();dMarkUnsaved();document.getElementById('dp-imgurl').value='[arquivo local]';gToast('✓ Foto carregada!');};r.readAsDataURL(file);};
        inp.click();
      };
    }
  }
}
function dPopVarSel(){
  const sel=document.getElementById('d-var-insert');
  sel.innerHTML='<option value="">— inserir var —</option>'+dVars.map(v=>`<option value="${v.name}">${v.label} ({{${v.name}}})</option>`).join('');
}
/* ── BINDINGS de propriedade (4.1) ── */
function dBindOptions(filterFn, current){
  return '<option value="">— nenhuma —</option>'+dVars.filter(filterFn).map(v=>`<option value="${v.name}" ${v.name===current?'selected':''}>${v.label} ({{${v.name}}})</option>`).join('');
}
function dPopBindingSelects(l){
  const b=l.bindings||{};
  const colorVars=v=>v.type==='color'||v.type==='select';
  const boolVars=v=>v.type==='boolean';
  if(l.type==='shape'){
    const fillSel=document.getElementById('dp-bind-fill');
    if(fillSel)fillSel.innerHTML=dBindOptions(colorVars,b.fill);
    const visSel=document.getElementById('dp-bind-visible-shape');
    if(visSel)visSel.innerHTML=dBindOptions(boolVars,b.visible);
  }else if(l.type==='text'){
    const visSel=document.getElementById('dp-bind-visible-text');
    if(visSel)visSel.innerHTML=dBindOptions(boolVars,b.visible);
  }else if(l.type==='image'||l.type==='frame'){
    const visSel=document.getElementById('dp-bind-visible-image');
    if(visSel)visSel.innerHTML=dBindOptions(boolVars,b.visible);
  }
}
function dSetBinding(prop,varName){
  const l=dLayers.find(x=>x.id===dSelId); if(!l)return;
  dHistoryPush();
  if(!l.bindings)l.bindings={};
  if(varName)l.bindings[prop]=varName;
  else{ delete l.bindings[prop]; if(!Object.keys(l.bindings).length)delete l.bindings; }
  dMarkUnsaved();dRenderCanvas();
}

/* ── RULE BUILDER (4.2) ── */
function dRenderRules(l){
  const wrap=document.getElementById('d-rules-list'); if(!wrap)return;
  const rules=l.rules||[];
  const varOpts=(cur)=>'<option value="">var…</option>'+dVars.map(v=>`<option value="${v.name}" ${v.name===cur?'selected':''}>${v.name}</option>`).join('');
  const whenOpts=(cur)=>['empty','filled','maxLen'].map(w=>{const lbl={empty:'vazio',filled:'preenchido',maxLen:'passar de'}[w];return `<option value="${w}" ${w===cur?'selected':''}>${lbl}</option>`;}).join('');
  const thenOpts=(cur)=>['hide','show','shrinkFont'].map(t=>{const lbl={hide:'ocultar',show:'mostrar',shrinkFont:'reduzir fonte'}[t];return `<option value="${t}" ${t===cur?'selected':''}>${lbl}</option>`;}).join('');
  wrap.innerHTML=rules.map((r,i)=>`
    <div class="rule-row">
      <span style="font-size:10px;color:var(--d-text3)">Quando</span>
      <select onchange="dUpdateRule(${i},'var',this.value)">${varOpts(r.var)}</select>
      <span style="font-size:10px;color:var(--d-text3)">estiver</span>
      <select onchange="dUpdateRule(${i},'when',this.value)">${whenOpts(r.when)}</select>
      ${r.when==='maxLen'?`<input type="number" min="1" value="${r.value||20}" onchange="dUpdateRule(${i},'value',this.value)" title="limite de caracteres">`:''}
      <span style="font-size:10px;color:var(--d-text3)">→</span>
      <select onchange="dUpdateRule(${i},'then',this.value)">${thenOpts(r.then)}</select>
      <button class="rule-del" onclick="dRemoveRule(${i})" title="Remover regra">×</button>
    </div>`).join('')||'<div style="font-size:11px;color:var(--d-text3);padding:2px 0">Nenhuma regra.</div>';
}
function dAddRule(){
  const l=dLayers.find(x=>x.id===dSelId); if(!l){gToast('Selecione um layer');return;}
  dHistoryPush();
  if(!l.rules)l.rules=[];
  l.rules.push({when:'empty',var:(dVars[0]?dVars[0].name:''),then:'hide'});
  dRenderRules(l);dMarkUnsaved();
}
function dUpdateRule(i,key,val){
  const l=dLayers.find(x=>x.id===dSelId); if(!l||!l.rules||!l.rules[i])return;
  dHistoryPush();
  l.rules[i][key]=val;
  dRenderRules(l);dMarkUnsaved();dRenderCanvas();
}
function dRemoveRule(i){
  const l=dLayers.find(x=>x.id===dSelId); if(!l||!l.rules)return;
  dHistoryPush();
  l.rules.splice(i,1);
  if(!l.rules.length)delete l.rules;
  dRenderRules(l);dMarkUnsaved();dRenderCanvas();
}
function dInsertVar(){
  const sel=document.getElementById('d-var-insert');const vn=sel.value;if(!vn)return;
  const inp=document.getElementById('dp-content');
  const pos=(inp.selectionStart!=null)?inp.selectionStart:inp.value.length; // 0 é posição válida (não cair no fim)
  inp.value=inp.value.substring(0,pos)+'{{'+vn+'}}'+inp.value.substring(pos);
  dUpdateProp('content',inp.value);sel.value='';
}
/* ── Widget de radius (props de shape): slider + input + preview SVG + botão círculo ── */
function dRadiusPreviewSVG(num){
  // mapeia 0..200 → rx 0..18 num quadrado 34×34 (o SVG já clampa rx a metade do lado)
  const rx=Math.min((parseInt(num)||0)/200*18,18);
  return '<svg width="34" height="34" viewBox="0 0 40 40" aria-hidden="true">'
       +   '<rect x="3" y="3" width="34" height="34" rx="'+rx+'" fill="none" stroke="var(--dm-orange)" stroke-width="2"/>'
       + '</svg>';
}
// Reflete um valor de radius no slider + preview (NÃO toca no input numérico, p/ não atrapalhar a digitação)
function dSyncRadiusUI(val){
  const num=Math.max(0,parseInt(val)||0);
  const sl=document.getElementById('dp-radius-slider'); if(sl)sl.value=Math.min(num,200);
  const pv=document.getElementById('dp-radius-preview'); if(pv)pv.innerHTML=dRadiusPreviewSVG(num);
}
// Vindo do slider: espelha no input numérico, atualiza preview e aplica
function dUpdatePropFromRadius(val){
  const num=Math.max(0,parseInt(val)||0);
  const numEl=document.getElementById('dp-radius'); if(numEl)numEl.value=num;
  const pv=document.getElementById('dp-radius-preview'); if(pv)pv.innerHTML=dRadiusPreviewSVG(num);
  dUpdateProp('radius',num);
}
// Botão "○ Círculo": cantos totalmente arredondados
function dSetRadiusCircle(){
  const numEl=document.getElementById('dp-radius'); if(numEl)numEl.value=999;
  dSyncRadiusUI(999);
  dUpdateProp('radius',999);
}
function dUpdateProp(prop,val){
  const l=dLayers.find(x=>x.id===dSelId);if(!l)return;
  if(['x','y','w','h','fontSize','opacity','radius','sides','points','strokeW'].includes(prop))val=parseFloat(val)||0;
  // Props editadas via oninput contínuo usam debounce — evita serializar dLayers a cada tecla.
  // Props de seleção discreta (font, textAlign, frameShape, etc.) usam push imediato.
  const _continuousProps=['fontSize','opacity','radius','color','fill','content','sides','points','strokeW','strokeColor','shadowColor','bgColor','imgScale','imgOffsetX','imgOffsetY'];
  if(!['x','y','w','h'].includes(prop)){
    if(_continuousProps.includes(prop)) dHistoryPushDebounced();
    else dHistoryPush();
  }
  l[prop]=val;
  if(prop==='content')dSyncVarsFromContent(val); // auto-cria variáveis digitadas (3.1)
  // frameShape → radius automático
  if(prop==='frameShape'){
    if(val==='circle')l.radius=999;
    else if(val==='rounded')l.radius=16;
    else l.radius=0;
  }
  dRenderCanvas();
  setTimeout(dUpdateCtxBar,0);
  if(prop==='color'){document.getElementById('dp-color-sw').style.background=val;dHexSync('dp-color-hex',val.startsWith('#')?val:'#ffffff');}
  if(prop==='fill'){document.getElementById('dp-fill-sw').style.background=val;dHexSync('dp-fill-hex',val.startsWith('#')?val:'#FF9000');}
  dMarkUnsaved();
}

/* ── TABS RIGHT PANEL ── */
/* ── Painel direito contextual — 3 painéis: conteudo · camada · publicar ──
 * Conteúdo  = campanhas/templates
 * Camada    = propriedades da peça + catálogo de variáveis do template
 * Publicar  = resumo + gatilho do modal completo (fluxo híbrido)
 * Biblioteca/Assets/Tutorial deixaram de ser abas fixas (drawer/Ajuda). */
let dActivePanel='conteudo';
function dActivatePanel(name){
  dActivePanel=name; dActiveTab=name; // dActiveTab mantido sincronizado p/ compat
  document.querySelectorAll('.d-rp-tab').forEach(t=>t.classList.toggle('active',t.dataset.panel===name));
  const conteudo=document.getElementById('dtab-campaigns');
  const camada=document.getElementById('d-panel-camada');
  const publicar=document.getElementById('d-panel-publicar');
  if(conteudo)conteudo.classList.toggle('hidden',name!=='conteudo');
  if(camada)camada.classList.toggle('hidden',name!=='camada');
  if(publicar)publicar.classList.toggle('hidden',name!=='publicar');
  // Tutorial não é mais aba (acessado via Ajuda). Biblioteca/Assets migram para o drawer de Recursos.
  const tut=document.getElementById('dtab-tutorial');if(tut)tut.classList.add('hidden');
  if(name==='publicar'&&typeof dPublishPanelRender==='function')dPublishPanelRender();
}
function dSwitchPanelToLayer(){dActivatePanel('camada');}
function dSwitchPanelToConteudo(){dActivatePanel('conteudo');}

// Acordeão leve do painel Camada: clicar no cabeçalho colapsa/expande a seção.
function dToggleSection(head){
  const sec=head&&head.closest('.d-acc-sec');
  if(sec)sec.classList.toggle('collapsed');
}

// Compat: mapeia as antigas abas (chamadas internas) para os 3 painéis novos.
function dSwitchTab(tab,btn){
  if(tab==='campaigns'||tab==='conteudo')return dActivatePanel('conteudo');
  if(tab==='props'||tab==='vars'||tab==='camada')return dActivatePanel('camada');
  if(tab==='publish'||tab==='publicar')return dActivatePanel('publicar');
  // library/assets/tutorial agora vivem em drawer/Ajuda — só renderiza sob demanda
  if(tab==='library'){if(typeof dLibRenderCats==='function')dLibRenderCats();if(typeof dLibRender==='function')dLibRender();}
  if(tab==='assets'&&typeof dRenderSnippets==='function')dRenderSnippets();
  if(tab==='tutorial'&&typeof dRenderTutorialPanel==='function')dRenderTutorialPanel();
}

/* ── VARS ── */
let dEditingVarName=null; // nome da var em edição no modal (null = criação)

// Persistência do catálogo de variáveis (sobrevive ao reload — sem isso defaultValue/
// ordem/tipo de vars custom se perderiam, já que dVars era recriado dos defaults).
function dPersistVars(){
  try{ localStorage.setItem('yngs_vars_v1', JSON.stringify(dVars)); return true; }
  catch(e){
    if(e&&(e.name==='QuotaExceededError'||e.code===22))
      gToast('⚠ Não foi possível salvar as variáveis: armazenamento cheio.','error');
    return false;
  }
}
function dRestoreVars(){
  try{
    const saved=localStorage.getItem('yngs_vars_v1');
    if(saved){const parsed=JSON.parse(saved);if(Array.isArray(parsed)&&parsed.length){dVars=parsed;return true;}}
  }catch(e){}
  return false;
}

// Layers que usam a variável (token {{name}} no content OU imgVar). (V3)
function dVarUsage(name){
  const ids=[];
  dLayers.forEach(l=>{
    let used=false;
    if(l.content){const re=gVarRegex();let m;while((m=re.exec(l.content))){if(m[1]===name){used=true;break;}}}
    if(l.imgVar===name)used=true;
    if(used)ids.push(l.id);
  });
  return ids;
}
// Destaca (flash) os layers que usam a variável clicada na aba. (V3)
function dHighlightVarLayers(name){
  const ids=dVarUsage(name);
  if(!ids.length){gToast('Variável {{'+name+'}} não está em uso');return;}
  ids.forEach(id=>{
    const el=document.querySelector(`.canvas-layer[data-id="${id}"]`);
    if(el){el.classList.remove('var-flash');void el.offsetWidth;el.classList.add('var-flash');setTimeout(()=>el.classList.remove('var-flash'),900);}
  });
  gToast('Destacando '+ids.length+' layer(s) que usam {{'+name+'}}');
}

function dVarsRender(){
  const el=document.getElementById('d-vars-list');
  el.innerHTML=dVars.map((v,i)=>{
    const usage=dVarUsage(v.name).length;
    const usageBadge=usage>0
      ? `<span class="var-usage" onclick="event.stopPropagation();dHighlightVarLayers('${v.name}')" title="Usada em ${usage} layer(s) — clique para destacar">${usage}×</span>`
      : `<span class="var-usage var-unused" title="Não usada em nenhum layer">0×</span>`;
    const hasDefault=(v.defaultValue!=null&&v.defaultValue!=='');
    const defBadge=hasDefault?`<span class="var-default" title="Valor padrão: ${_dEsc(v.defaultValue)}">padrão</span>`:'';
    return `<div class="var-item" title="{{${v.name}}}">
      <span class="var-name">{{${v.name}}}</span>
      <span class="var-type">${v.type}</span>
      <span class="${v.required?'tag-required':'tag-optional'} tag-pill">${v.required?'obrig.':'opt.'}</span>
      ${defBadge}
      ${usageBadge}
      <span class="var-actions">
        <button onclick="dMoveVar(${i},-1)" title="Mover pra cima" ${i===0?'disabled':''}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:block"><polyline points="18 15 12 9 6 15"/></svg></button>
        <button onclick="dMoveVar(${i},1)" title="Mover pra baixo" ${i===dVars.length-1?'disabled':''}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:block"><polyline points="6 9 12 15 18 9"/></svg></button>
        <button onclick="dEditVar(${i})" title="Editar variável"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
        <button onclick="dRenameVar(${i})" title="Renomear (atualiza os layers)"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button>
        <button onclick="dRemoveVar(${i})" title="Remover variável"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:block"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </span>
    </div>`;
  }).join('')||'<div style="font-size:12px;color:var(--d-text3);text-align:center;padding:10px">Nenhuma variável</div>';
  document.getElementById('d-stat-vars').textContent=dVars.length;
  dPopVarSel();
}
// Mostra/oculta os campos de opções (select) e paleta (color) conforme o tipo escolhido (4.1)
function dVarTypeFields(){
  const t=document.getElementById('dv-type').value;
  const of=document.getElementById('dv-options-field');
  const pf=document.getElementById('dv-palette-field');
  if(of)of.style.display=(t==='select')?'':'none';
  if(pf)pf.style.display=(t==='color')?'':'none';
}
function dOpenVarModal(){
  dEditingVarName=null;
  const m=document.getElementById('d-var-modal');
  m.querySelector('.modal-title').textContent='Nova Variável';
  document.getElementById('dv-name').value='';
  document.getElementById('dv-name').disabled=false;
  document.getElementById('dv-type').value='text';
  document.getElementById('dv-label').value='';
  document.getElementById('dv-default').value='';
  document.getElementById('dv-req').checked=false;
  document.getElementById('dv-options').value='';
  document.getElementById('dv-palette').value='';
  dVarTypeFields();
  m.querySelector('.d-btn-pri').textContent='Adicionar';
  m.classList.add('open');
  setTimeout(()=>document.getElementById('dv-name').focus(),100);
}
function dEditVar(i){
  const v=dVars[i];if(!v)return;
  dEditingVarName=v.name;
  const m=document.getElementById('d-var-modal');
  m.querySelector('.modal-title').textContent='Editar Variável';
  const nameInp=document.getElementById('dv-name');
  nameInp.value=v.name;
  nameInp.disabled=true; // nome muda só via renomear (find/replace nos layers)
  document.getElementById('dv-type').value=v.type||'text';
  document.getElementById('dv-label').value=v.label||'';
  document.getElementById('dv-default').value=v.defaultValue||'';
  document.getElementById('dv-req').checked=!!v.required;
  document.getElementById('dv-options').value=(v.options||[]).join('\n');
  document.getElementById('dv-palette').value=(v.palette||[]).join(', ');
  dVarTypeFields();
  m.querySelector('.d-btn-pri').textContent='Salvar';
  m.classList.add('open');
  setTimeout(()=>document.getElementById('dv-label').focus(),100);
}
function dCloseVarModal(){dEditingVarName=null;document.getElementById('dv-name').disabled=false;document.getElementById('d-var-modal').classList.remove('open');}
// Lê opções (select) e paleta (color) dos campos do modal
function dReadVarOptions(){
  return document.getElementById('dv-options').value.split('\n').map(s=>s.trim()).filter(Boolean);
}
function dReadVarPalette(){
  return document.getElementById('dv-palette').value.split(/[,\n]/).map(s=>s.trim()).filter(Boolean);
}
function dConfirmVar(){
  const type=document.getElementById('dv-type').value;
  const label=document.getElementById('dv-label').value.trim();
  const def=document.getElementById('dv-default').value;
  const req=document.getElementById('dv-req').checked;
  const options=dReadVarOptions();
  const palette=dReadVarPalette();
  // Edição: nome travado, atualiza só os atributos
  if(dEditingVarName){
    const v=dVars.find(x=>x.name===dEditingVarName);
    if(v){
      v.type=type;v.label=label||v.name;v.required=req;
      if(def!=='')v.defaultValue=def;else delete v.defaultValue;
      if(type==='select')v.options=options;else delete v.options;
      if(type==='color')v.palette=palette;else delete v.palette;
    }
    dCloseVarModal();dVarsRender();dPersistVars();dRenderCanvas();
    gToast('✓ Variável {{'+(v?v.name:'')+'}} atualizada');
    return;
  }
  // Criação
  const name=document.getElementById('dv-name').value.trim();
  if(!name){gToast('⚠ Digite um nome');return;}
  if(!gValidVarName(name)){gToast('⚠ Use só letras, números e _ (sem espaço/acento)');return;}
  if(dVars.find(v=>v.name.toLowerCase()===name.toLowerCase())){gToast('⚠ Variável já existe');return;}
  const nv={name,type,label:label||name,required:req};
  if(def!=='')nv.defaultValue=def;
  if(type==='select')nv.options=options;
  if(type==='color')nv.palette=palette;
  dVars.push(nv);
  dCloseVarModal();dVarsRender();dPersistVars();gToast('✓ Variável {{'+name+'}} criada');
}
function dRemoveVar(i){
  const v=dVars[i];if(!v)return;
  // V3: avisa/bloqueia remoção de var em uso
  const usage=dVarUsage(v.name);
  if(usage.length && !confirm(`A variável {{${v.name}}} está em uso em ${usage.length} layer(s). Remover do catálogo mesmo assim? (os tokens {{${v.name}}} continuam nos layers como texto)`))return;
  dVars.splice(i,1);dVarsRender();dPersistVars();gToast('Variável {{'+v.name+'}} removida');
}
// Reordena a variável — reflete na ordem das perguntas do franqueado (V7)
function dMoveVar(i,dir){
  const ni=i+dir;if(ni<0||ni>=dVars.length)return;
  [dVars[i],dVars[ni]]=[dVars[ni],dVars[i]];
  dVarsRender();dPersistVars();
}
// Renomeia a variável com find/replace nos contents e imgVar dos layers (V3)
function dRenameVar(i){
  const v=dVars[i];if(!v)return;
  const novo=(prompt(`Novo nome para {{${v.name}}} (só letras, números e _):`,v.name)||'').trim();
  if(!novo||novo===v.name)return;
  if(!gValidVarName(novo)){gToast('⚠ Nome inválido — use só letras, números e _');return;}
  if(dVars.some(x=>x.name.toLowerCase()===novo.toLowerCase())){gToast('⚠ Já existe uma variável com esse nome');return;}
  const old=v.name;
  // find/replace nos layers (tokens {{old}} → {{novo}} e imgVar)
  const reTok=new RegExp('\\{\\{\\s*'+old.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*\\}\\}','g');
  dLayers.forEach(l=>{
    if(l.content)l.content=l.content.replace(reTok,'{{'+novo+'}}');
    if(l.imgVar===old)l.imgVar=novo;
  });
  v.name=novo;
  dVarsRender();dRenderCanvas();dMarkUnsaved();dPersistVars();
  gToast('✓ Renomeada para {{'+novo+'}} (layers atualizados)');
}

// Remove a máscara de uma camada (importada do PSD)
function dRemoveMask(id){
  const l=dLayers.find(x=>x.id===(id||dSelId)); if(!l||!l.mask)return;
  dHistoryPush();
  delete l.mask;
  dRenderCanvas(); dRenderLayersList(); dMarkUnsaved();
  gToast('Máscara removida');
}

// Sincroniza o catálogo dVars com os tokens {{}} de um content: auto-cria as faltantes (3.1)
function dSyncVarsFromContent(content){
  if(typeof dVars==='undefined'||!content)return;
  const re=gVarRegex(); let m, changed=false;
  while((m=re.exec(content))){
    const name=m[1];
    if(!dVars.some(v=>v.name.toLowerCase()===name.toLowerCase())){
      dVars.push({name, label:name.replace(/_/g,' '), type:'text', required:false});
      changed=true;
    }
  }
  if(changed){ if(typeof dVarsRender==='function')dVarsRender(); dPersistVars(); }
}

/* ── AUTOCOMPLETE de {{var}} (V1/V2) ──
   Ao digitar "{{" num textarea de conteúdo (painel de props ou edição inline),
   mostra dropdown das variáveis do catálogo (nome + label + tipo) e oferece criar
   uma nova com mini-popover de tipo. */
let _vacEl=null, _vacOnCommit=null, _vacStart=-1, _vacItems=[], _vacActive=0;

function dAttachVarAutocomplete(el, onCommit){
  if(!el || el._vacAttached) return;
  el._vacAttached=true;
  el.addEventListener('input', ()=>dVarAcOnInput(el, onCommit));
  el.addEventListener('keydown', dVarAcOnKey, true);
  el.addEventListener('blur', ()=>setTimeout(dVarAcHide, 150)); // delay p/ permitir clique no item
}
function dVarAcBox(){
  let b=document.getElementById('d-var-ac');
  if(!b){ b=document.createElement('div'); b.id='d-var-ac'; b.className='var-ac'; b.style.display='none'; document.body.appendChild(b); }
  return b;
}
function dVarAcHide(){ const b=document.getElementById('d-var-ac'); if(b)b.style.display='none'; _vacEl=null; }
function dVarAcOnInput(el, onCommit){
  const caret=el.selectionStart||0;
  const before=el.value.slice(0,caret);
  const m=before.match(/\{\{\s*([a-zA-Z0-9_]*)$/);
  if(!m){ dVarAcHide(); return; }
  _vacEl=el; _vacOnCommit=onCommit; _vacStart=m.index;
  const partial=(m[1]||'').toLowerCase();
  const matches=(dVars||[]).filter(v=>v.name.toLowerCase().includes(partial)||(v.label||'').toLowerCase().includes(partial));
  _vacItems=matches.map(v=>({name:v.name,label:v.label,type:v.type,create:false}));
  if(partial && gValidVarName(partial) && !dVars.some(v=>v.name.toLowerCase()===partial)){
    _vacItems.push({name:partial,label:'criar variável',type:'novo',create:true});
  }
  if(!_vacItems.length){ dVarAcHide(); return; }
  _vacActive=0; dVarAcRender(el);
}
function dVarAcRender(el){
  const b=dVarAcBox();
  b.innerHTML=_vacItems.map((it,i)=>it.create
    ? `<div class="var-ac-item ac-create ${i===_vacActive?'active':''}" data-i="${i}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> criar <span class="ac-name">{{${it.name}}}</span></div>`
    : `<div class="var-ac-item ${i===_vacActive?'active':''}" data-i="${i}"><span class="ac-name">{{${it.name}}}</span><span>${_dEsc(it.label||'')}</span><span class="ac-type">${it.type}</span></div>`
  ).join('');
  b.querySelectorAll('.var-ac-item').forEach(node=>{
    node.addEventListener('mousedown', e=>{ e.preventDefault(); dVarAcPick(parseInt(node.dataset.i,10)); });
  });
  const r=el.getBoundingClientRect();
  b.style.left=Math.min(r.left, window.innerWidth-220)+'px';
  b.style.top=(r.bottom+4)+'px';
  b.style.display='block';
}
function dVarAcOnKey(e){
  const b=document.getElementById('d-var-ac');
  if(!_vacEl || !b || b.style.display==='none') return;
  if(e.key==='ArrowDown'){e.preventDefault();_vacActive=(_vacActive+1)%_vacItems.length;dVarAcRender(_vacEl);}
  else if(e.key==='ArrowUp'){e.preventDefault();_vacActive=(_vacActive-1+_vacItems.length)%_vacItems.length;dVarAcRender(_vacEl);}
  else if(e.key==='Enter'||e.key==='Tab'){e.preventDefault();dVarAcPick(_vacActive);}
  else if(e.key==='Escape'){e.preventDefault();dVarAcHide();}
}
function dVarAcPick(i){
  const it=_vacItems[i]; const el=_vacEl; if(!it||!el)return;
  const caret=el.selectionStart||0;
  const newBefore=el.value.slice(0,_vacStart)+'{{'+it.name+'}}';
  el.value=newBefore+el.value.slice(caret);
  const pos=newBefore.length; el.setSelectionRange(pos,pos);
  dVarAcHide();
  if(typeof _vacOnCommit==='function')_vacOnCommit(el.value);
  if(it.create && !dVars.some(v=>v.name.toLowerCase()===it.name.toLowerCase())){
    dVars.push({name:it.name,label:it.name.replace(/_/g,' '),type:'text',required:false});
    dVarsRender();dPersistVars();dVarTypePopover(it.name, el);
  }
  el.focus();
}
// Mini-popover pra escolher o tipo de uma var recém-criada (V1)
function dVarTypePopover(name, anchorEl){
  const old=document.getElementById('d-var-typepop'); if(old)old.remove();
  const pop=document.createElement('div');
  pop.id='d-var-typepop'; pop.className='var-ac';
  pop.innerHTML=`<div style="padding:4px 8px;font-size:11px;color:var(--d-text3)">Tipo de {{${name}}}</div>
    <select id="d-var-typepop-sel" style="width:100%;padding:5px;font-size:12px">
      <option value="text">Texto livre</option><option value="number">Número</option>
      <option value="image">Imagem (URL)</option><option value="select">Seleção fixa</option><option value="date">Data</option>
    </select>`;
  document.body.appendChild(pop);
  const r=anchorEl.getBoundingClientRect();
  pop.style.left=Math.min(r.left,window.innerWidth-200)+'px';
  pop.style.top=(r.bottom+4)+'px'; pop.style.display='block';
  const sel=document.getElementById('d-var-typepop-sel'); sel.focus();
  sel.addEventListener('change',()=>{const v=dVars.find(x=>x.name===name);if(v){v.type=sel.value;dVarsRender();dPersistVars();dRenderCanvas();}pop.remove();});
  sel.addEventListener('blur',()=>setTimeout(()=>{const p=document.getElementById('d-var-typepop');if(p)p.remove();},200));
}

/* ── ASSETS ── */
function dAssetsRender(){
  document.getElementById('d-assets-grid').innerHTML=dAssets.map((a,i)=>`
    <div class="asset-thumb" onclick="dUseAsset(${i})" title="${a.name}">
      ${a.url?`<img src="${a.url}" alt="${a.name}">`:`<span style="font-size:26px">${a.emoji}</span>`}
      <span class="asset-name">${a.name}</span>
    </div>`).join('');
}
function dHandleUpload(inp){ dLibUpload(inp); }
function dUseAsset(i){
  const a=dAssets[i];if(!a.url){gToast('Asset sem URL');return;}
  const l=dLayers.find(x=>x.id===dSelId&&(x.type==='image'||x.type==='frame'));
  if(!l){gToast('Selecione um layer de imagem ou moldura primeiro');return;}
  l.imgUrl=a.url;dRenderCanvas();
  const urlInp=document.getElementById('dp-imgurl');if(urlInp)urlInp.value=a.url;
  gToast('✓ "'+a.name+'" aplicado');
}

/* ── SAVE / PREVIEW ── */
function dSave(){
  // Sincronizar layers editados de volta pro artboard ativo antes de salvar
  if(typeof dSyncLayersToAB==='function')dSyncLayersToAB();
  if(dActiveTmplId){
    dFolders.forEach(f=>f.templates.forEach(t=>{if(t.id===dActiveTmplId)t.layers=JSON.parse(JSON.stringify(dLayers));}));
  }
  const hadImgWarn=gImgPersistWarned;
  if(typeof dSetSaveState==='function')dSetSaveState('saving'); // M2.2
  const okF=dPersistFolders();
  const okA=(typeof dPersistArtboards==='function')?dPersistArtboards():true;
  if(!(okF&&okA)){ if(typeof dSetSaveState==='function')dSetSaveState('unsaved'); return; } // erro já exibido
  const saveBtn=document.querySelector('.d-btn-pri[onclick="dSave()"]');
  if(saveBtn){saveBtn.classList.add('save-success');setTimeout(()=>saveBtn.classList.remove('save-success'),2000);}
  if(typeof dSetSaveState==='function')dSetSaveState('saved'); // limpa dDirty + mostra "Guardado"
  // Não sobrescreve o aviso de imagens se ele acabou de aparecer neste save
  if(!(gImgPersistWarned&&!hadImgWarn))gToast('✓ Rascunho salvo!');
}
function dPersistFolders(){
  let droppedImg=false;
  try{
    const saveable=dFolders.map(f=>({...f,templates:f.templates.map(t=>({...t,layers:t.layers.map(l=>{
      // Mantém imagens pequenas (sobrevivem ao reload); descarta grandes p/ não estourar quota.
      // TODO(Fase 5): mover blobs grandes para IndexedDB/Storage.
      const packed=gPackImgUrl(l.imgUrl);
      if(packed.dropped)droppedImg=true;
      const out={...l,imgUrl:packed.url};
      // Máscara (alpha) também conta pra quota — empacota; se não couber, sai sem máscara.
      if(l.mask){ const pm=gPackMask(l.mask); if(pm.dropped){ delete out.mask; droppedImg=true; } else out.mask=pm.url; }
      return out;
    })}))}));
    localStorage.setItem('yngs_folders_v1',JSON.stringify(saveable));
    if(droppedImg)gWarnImagesNotPersisted();
    return true;
  }catch(e){
    if(e&&(e.name==='QuotaExceededError'||e.code===22))
      gToast('⚠ Não foi possível salvar: armazenamento cheio. Remova templates ou imagens e tente de novo.','error');
    else gToast('⚠ Erro ao salvar o template.','error');
    return false;
  }
}


/* ══ MULTI-SELECT & GROUPS ══ */
let dMultiSel = []; // array de layer IDs

function dToggleMultiSel(id){
  // dMultiSel é o conjunto COMPLETO da seleção. O layer primário (dSelId) precisa estar
  // dentro dele — senão ao arrastar o grupo ele ficaria pra trás. Por isso, ao iniciar uma
  // multi-seleção via Shift, o primário atual entra no conjunto antes de alternar.
  if(dSelId!=null && dSelId!==id && !dMultiSel.includes(dSelId)) dMultiSel.push(dSelId);
  const i=dMultiSel.indexOf(id);
  if(i>-1){
    dMultiSel.splice(i,1);                                   // Shift+click num já-selecionado → remove
    if(dSelId===id) dSelId = dMultiSel.length ? dMultiSel[dMultiSel.length-1] : null;
  } else {
    dMultiSel.push(id);
    dSelId=id;                                               // novo membro vira o primário
  }
  // Sobrou 0 ou 1 → não é mais multi-seleção: colapsa pro modelo de seleção simples.
  if(dMultiSel.length<=1){
    if(dMultiSel.length===1) dSelId=dMultiSel[0];
    dMultiSel=[];
  }
  dRenderCanvas();dRenderLayersList();
  const sl=dLayers.find(x=>x.id===dSelId);
  if(sl && typeof dShowProps==='function') dShowProps(sl);
  if(typeof dUpdateCtxBar==='function') dUpdateCtxBar();
}
function dClearMultiSel(){
  if(dMultiSel.length){dMultiSel=[];dRenderCanvas();dRenderLayersList();}
}
function dGroupSelected(){
  const ids=dSelId?[dSelId,...dMultiSel.filter(x=>x!==dSelId)]:dMultiSel;
  if(ids.length<2){gToast('⚠ Selecione 2+ layers (Shift+click) pra agrupar');return;}
  
  const childIds = ids.filter(id => {
    const l = dLayers.find(x => x.id === id);
    return l && l.type !== 'group';
  });
  if(childIds.length < 2) {
    gToast('⚠ Selecione 2+ layers normais para agrupar');
    return;
  }

  const groupId='g-'+Date.now();
  dHistoryPush();

  childIds.forEach(id=>{
    const l=dLayers.find(x=>x.id===id);
    if(l) {
      l.parentId=groupId;
      delete l.groupId;
    }
  });

  const groupLayer = {
    id: groupId,
    type: 'group',
    name: 'Grupo ' + (++dLyrCnt),
    visible: true,
    locked: false,
    collapsed: false
  };

  const groupedLayers = dLayers.filter(l => childIds.includes(l.id));
  const indices = childIds.map(id => dLayers.findIndex(l => l.id === id)).filter(idx => idx !== -1);
  const maxIndex = Math.max(...indices);

  const otherLayersBefore = [];
  const otherLayersAfter = [];
  dLayers.forEach((l, idx) => {
    if (!childIds.includes(l.id)) {
      if (idx < maxIndex) {
        otherLayersBefore.push(l);
      } else {
        otherLayersAfter.push(l);
      }
    }
  });

  dLayers = [
    ...otherLayersBefore,
    ...groupedLayers,
    groupLayer,
    ...otherLayersAfter
  ];

  gToast('✓ '+childIds.length+' layers agrupados');
  dSelId = groupId;
  dMultiSel = childIds;
  dRenderCanvas();dRenderLayersList();dMarkUnsaved();
}
function dUngroupSelected(){
  let gid = null;
  const l = dLayers.find(x => x.id === dSelId);
  if (l) {
    if (l.type === 'group') {
      gid = l.id;
    } else if (l.parentId) {
      gid = l.parentId;
    }
  }
  if (!gid) {
    gToast('⚠ Selecione um grupo ou um layer dentro de um grupo para desmembrar');
    return;
  }
  dHistoryPush();
  dLayers.forEach(x => {
    if (x.parentId === gid) {
      delete x.parentId;
    }
  });
  dLayers = dLayers.filter(x => x.id !== gid);
  if (dSelId === gid) {
    dSelId = null;
    dMultiSel = [];
  }
  gToast('✓ Grupo desfeito');
  dRenderCanvas();dRenderLayersList();dMarkUnsaved();
}
function dGetGroupSiblings(layer){
  if(!layer)return [];
  if(layer.type==='group'){
    return dLayers.filter(x=>x.parentId===layer.id);
  }
  if(layer.parentId){
    return dLayers.filter(x=>x.parentId===layer.parentId);
  }
  if(layer.groupId){
    return dLayers.filter(x=>x.groupId===layer.groupId);
  }
  return [layer];
}



/* ══ RENOMEAR LAYER ══ */
function dRenameLayer(id, e){
  if(e)e.stopPropagation();
  const l=dLayers.find(x=>x.id===id);if(!l)return;
  const row=document.querySelector(`.layer-row[data-lid="${id}"]`);
  if(!row)return;
  const label=row.querySelector('.layer-label');
  if(!label)return;
  const oldText=l.name;
  const inp=document.createElement('input');
  inp.type='text';inp.value=oldText;
  inp.style.cssText='background:var(--d-surf);border:1px solid var(--dm-orange);color:var(--d-text);font-size:11px;padding:2px 4px;border-radius:3px;width:100%;outline:none;font-family:inherit;';
  inp.addEventListener('click',e=>e.stopPropagation());
  inp.addEventListener('mousedown',e=>e.stopPropagation());
  label.style.display='none';
  label.parentNode.insertBefore(inp,label.nextSibling);
  setTimeout(()=>{inp.focus();inp.select();},10);
  function finish(save){
    if(save&&inp.value.trim()&&inp.value.trim()!==oldText){
      dHistoryPush();
      l.name=inp.value.trim();
      dMarkUnsaved();
    }
    inp.remove();label.style.display='';
    dRenderLayersList();
  }
  inp.addEventListener('blur',()=>finish(true));
  inp.addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();finish(true);}
    if(e.key==='Escape'){e.preventDefault();finish(false);}
  });
}


function dOpenCheat(){document.getElementById('d-cheat-modal').classList.add('open');}
function dCloseCheat(){document.getElementById('d-cheat-modal').classList.remove('open');}



/* ══ NOVOS TIPOS DE LAYER ══ */
function dAddIcon(){
  const f=dCanvasSize();
  const id='l-'+(++dLyrCnt);
  // Ícone padrão: estrela (SVG inline como dataURL)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23EE7218"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  dHistoryPush();
  dLayers.push({id,name:'Ícone '+dLyrCnt,type:'image',x:Math.round(f.w/2-40),y:Math.round(f.h/2-40),w:80,h:80,imgUrl:'data:image/svg+xml;utf8,'+svg,imgVar:'',objectFit:'contain',visible:true});
  dSelLayerState(id);dRenderCanvas();dRenderLayersList();dStats();dMarkUnsaved();dSetTool('select');
  setTimeout(()=>dFlashLayer(id),30);
  gToast('Ícone adicionado — você pode trocar pela biblioteca');
}
function dAddLine(){
  const f=dCanvasSize();
  const id='l-'+(++dLyrCnt);
  dHistoryPush();
  dLayers.push({id,name:'Linha '+dLyrCnt,type:'shape',x:Math.round(f.w*.1),y:Math.round(f.h/2),w:Math.round(f.w*.8),h:3,fill:'#FFFFFF',opacity:100,radius:2,visible:true});
  dSelLayerState(id);dRenderCanvas();dRenderLayersList();dStats();dMarkUnsaved();dSetTool('select');
  setTimeout(()=>dFlashLayer(id),30);
  gToast('Linha adicionada');
}

// Geometria de formas não-retangulares como pontos em fração [0..1] do bounding box.
// Usado tanto no designer (clip-path CSS) quanto no png-generator (path do canvas).
// Retorna null para rect/circle/ellipse (que usam border-radius / ellipse).
function dShapePoints(l){
  const kind=(l&&l.shapeKind)||'rect';
  if(kind==='triangle')return [[0.5,0],[1,1],[0,1]];
  if(kind==='polygon'){
    const n=Math.max(3,Math.round(l.sides||6)),pts=[];
    for(let i=0;i<n;i++){const a=-Math.PI/2+i*2*Math.PI/n;pts.push([0.5+0.5*Math.cos(a),0.5+0.5*Math.sin(a)]);}
    return pts;
  }
  if(kind==='star'){
    const n=Math.max(3,Math.round(l.points||5)),inner=(l.inner!=null?l.inner:0.5),pts=[];
    for(let i=0;i<n*2;i++){const r=(i%2===0)?0.5:0.5*inner;const a=-Math.PI/2+i*Math.PI/n;pts.push([0.5+r*Math.cos(a),0.5+r*Math.sin(a)]);}
    return pts;
  }
  return null;
}
// Cria uma forma nativa editável (círculo/elipse/triângulo/polígono/estrela)
function dAddShapeKind(kind){
  const f=dCanvasSize();const id='l-'+(++dLyrCnt);
  const names={circle:'Círculo',ellipse:'Elipse',triangle:'Triângulo',polygon:'Polígono',star:'Estrela'};
  dHistoryPush();
  const sz=Math.round(Math.min(f.w,f.h)*.22);
  const base={id,name:(names[kind]||'Forma')+' '+dLyrCnt,type:'shape',shapeKind:kind,
    x:Math.round(f.w/2-sz/2),y:Math.round(f.h/2-sz/2),w:sz,h:sz,fill:'#FF9000',opacity:100,radius:0,visible:true};
  if(kind==='polygon')base.sides=6;
  if(kind==='star'){base.points=5;base.inner=0.5;}
  dLayers.push(base);
  dSelLayerState(id);dRenderCanvas();dRenderLayersList();dStats();dMarkUnsaved();dSetTool('select');
  setTimeout(()=>dFlashLayer(id),30);
  gToast((names[kind]||'Forma')+' adicionada');
}
