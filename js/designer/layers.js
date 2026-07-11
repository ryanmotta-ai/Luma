/**
 * js/designer/layers.js
 *
 * CRUD de layers, painel lateral, props, multi-select, rename:
 * dSelLayer, dDeselect, dRenderLayersList, dShowProps, dAddText,
 * dAddShape, dToggleMultiSel, dRenameLayer, dAddIcon, dAddLine.
 * Depende de: designer/canvas.js
 */

function dSelLayer(id){
  // Se mudarmos de seleção, saímos do modo recorte (se ativo)
  if (typeof dCropState !== 'undefined' && dCropState && dCropState.id !== id) {
    if (typeof dStopCrop === 'function') dStopCrop();
  }

  // Se clicamos num item da sub-árvore de um GRUPO fechado, selecionamos o grupo root
  const l = dLayers.find(x => x.id === id);
  if (l && l.parentId) {
    let topId = l.parentId;
    let curr = dLayers.find(x => x.id === topId);
    let forceSelectChild = false;
    // Se o grupo ou o root group estiver _aberto_, permite selecionar o filho
    while (curr) {
      if (curr._open) { forceSelectChild = true; break; }
      if (curr.parentId) {
        topId = curr.parentId;
        curr = dLayers.find(x => x.id === topId);
      } else {
        break;
      }
    }
    if (!forceSelectChild && topId) {
      id = topId;
    }
  }

  dSelId=id;
  const l2=dLayers.find(x=>x.id===id);
  if(l2){
    if (l2.type !== 'group') {
      dMultiSel = [];
    } else if (l2.type === 'group') {
      const children = dLayers.filter(x => x.parentId === l2.id);
      dMultiSel = children.map(x => x.id);
    }
  }
  dRenderCanvas();
  dRenderLayersList();
  if(l){
    try{
      dShowProps(l);
      // Auto-switch: ao selecionar um layer, traz o painel de Propriedades (camada) à frente.
      // Sem isso, dShowProps preenche o #d-props-form mas ele fica escondido sob a aba Conteúdo.
      if(typeof dActivatePanel==='function') dActivatePanel('camada');
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
function dSelLayerState(id){dSelId=id;const l=dLayers.find(x=>x.id===id);if(l){dShowProps(l);if(typeof dActivatePanel==='function')dActivatePanel('camada');dUpdateCtxBar();}}
function dDeselect(e){
  const ws=document.getElementById('d-workspace');
  const wr=document.getElementById('d-canvas-wrapper');
  if(e.target===wr||e.target===ws){
    if(dTool==='select'){dSelId=null;dRenderCanvas();dRenderLayersList();document.getElementById('d-no-sel').style.display='';document.getElementById('d-props-form').style.display='none';if(typeof dRenderABProps==='function')dRenderABProps();dUpdateCtxBar();}
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

/* ── CROP TOOL (IN-LINE) ── */
let dCropState = null;
let dDragCrop = null;
function dStartCrop(l) {
  if (l.type !== 'image' && l.type !== 'frame') return;
  dCropState = { id: l.id };
  dRenderCanvas();
  gToast('Modo recorte ativo. Arraste a imagem para reposicionar. Esc para sair.');
}
function dStopCrop() {
  dCropState = null;
  dRenderCanvas();
}
function dOnCropDrag(e) {
  if (!dDragCrop) return;
  const scale = dZoomLevel / 100;
  // offsetX/Y vão de -0.5 a 0.5 (relativo ao tamanho da moldura/imagem)
  // O movimento do mouse altera esses valores proporcionalmente
  const dx = (e.clientX - dDragSX) / scale;
  const dy = (e.clientY - dDragSY) / scale;
  // A taxa de conversão depende do tamanho da moldura:
  dDragCrop.imgOffsetX = dLyrSX - (dx / dDragCrop.w);
  dDragCrop.imgOffsetY = dLyrSY - (dy / dDragCrop.h);
  // Re-renderizar o canvas para mostrar a imagem movendo (apenas styles no img seria mais rápido, mas dRenderCanvas garante sync com props panel)
  dRenderCanvas();
}
function dStopCropDrag() {
  if (dDragCrop) { dHistoryPush(); dMarkUnsaved(); }
  dDragCrop = null;
  document.removeEventListener('mousemove', dOnCropDrag);
  document.removeEventListener('mouseup', dStopCropDrag);
}

function dStartDrag(e,l){
  if (l.locked || l.lockPosition) return;
  if (typeof dCropState !== 'undefined' && dCropState && dCropState.id === l.id) {
    e.preventDefault();
    dDragCrop = l;
    dDragSX = e.clientX; dDragSY = e.clientY;
    dLyrSX = l.imgOffsetX || 0; dLyrSY = l.imgOffsetY || 0;
    document.addEventListener('mousemove', dOnCropDrag);
    document.addEventListener('mouseup', dStopCropDrag);
    return;
  }
  // Alt+Drag = clonagem imediata: duplica a camada e arrasta o clone,
  // deixando o original intacto na posição de origem (UX Figma/Illustrator).
  if(e.altKey){
    dHistoryPush();
    const clone=JSON.parse(JSON.stringify(l));
    clone.id='l-'+(++dLyrCnt);
    clone.name=l.name+' cópia';
    dLayers.push(clone);
    dSelId=clone.id;
    dMultiSel=[];
    l=clone; // a partir daqui, arrasta o clone
    dRenderCanvas();dRenderLayersList();dMarkUnsaved();
  }
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
  // Mover siblings do grupo (lockPosition também trava aqui, não só na camada agarrada)
  if(dDragGroupStart&&dDragGroupStart.length){
    dDragGroupStart.forEach(s=>{
      const sl=dLayers.find(x=>x.id===s.id);
      if(!sl||sl.locked||sl.lockPosition)return;
      sl.x=s.x+dx;sl.y=s.y+dy;
      const sEl=dDragEls[s.id];
      if(sEl){sEl.style.left=sl.x+'px';sEl.style.top=sl.y+'px';}
    });
  }
  // Mover multi-sel
  if(dDragMulti&&dDragMulti.length){
    dDragMulti.forEach(s=>{
      if(!s.layer||s.layer.locked||s.layer.lockPosition)return;
      s.layer.x=s.x+dx;s.layer.y=s.y+dy;
      const mEl=dDragEls[s.id];
      if(mEl){mEl.style.left=s.layer.x+'px';mEl.style.top=s.layer.y+'px';}
    });
  }
  if(document.getElementById('dp-x')){document.getElementById('dp-x').value=dDrag.x;document.getElementById('dp-y').value=dDrag.y;}
  const topX = document.getElementById('d-top-x');
  const topY = document.getElementById('d-top-y');
  if(topX) topX.value = Math.round(dDrag.x);
  if(topY) topY.value = Math.round(dDrag.y);
}
function dStopDrag(){
  // Só registra no histórico se HOUVE arrasto real — clique simples não polui o undo.
  if(dDrag && dDragMoved){dHistoryPush();dMarkUnsaved();}
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
  if (l.locked || l.lockPosition) return;
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
  const topX = document.getElementById('d-top-x');
  const topY = document.getElementById('d-top-y');
  const topW = document.getElementById('d-top-w');
  const topH = document.getElementById('d-top-h');
  if(topW) topW.value = Math.round(dResize.w);
  if(topH) topH.value = Math.round(dResize.h);
  if(topX) topX.value = Math.round(dResize.x);
  if(topY) topY.value = Math.round(dResize.y);
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
function dAddShape(){dAddShapeAt(40,40);}
function dAddImage(){dAddImageAt(40,100);}
function dAddTextAt(x,y,vertical,w,h){  if (typeof dHistoryPush === 'function') dHistoryPush();
  const id='l-'+(++dLyrCnt);
  const isVert = !!vertical;
  const layer = {
    id,
    name: (isVert ? 'Texto V ' : 'Texto ') + dLyrCnt,
    type: 'text',
    x,
    y,
    w: w || (isVert ? 50 : 200),
    h: h || (isVert ? 200 : 50),
    content: 'Novo texto {{variavel}}',
    font: "'Roboto Black'",
    fontSize: 32,
    color: '#FFFFFF',
    textAlign: 'left',
    visible: true
  };
  if (isVert) {
    layer.vertical = true;
  }
  if (typeof dLayers !== 'undefined') dLayers.push(layer);
  if (typeof dSelLayerState === 'function') dSelLayerState(id);
  if (typeof dRenderCanvas === 'function') dRenderCanvas();
  if (typeof dRenderLayersList === 'function') dRenderLayersList();
  if (typeof dStats === 'function') dStats();
  if (typeof dMarkUnsaved === 'function') dMarkUnsaved();
  if (typeof dSetTool === 'function') dSetTool('select');
  if (typeof gToast === 'function') gToast(isVert ? 'Camada de texto vertical adicionada' : 'Camada de texto adicionada');
  if (typeof dFlashLayer === 'function') setTimeout(()=>dFlashLayer(id),30);
}
function dAddShapeAt(x,y,w,h){  dHistoryPush();
  const id='l-'+(++dLyrCnt);
  dLayers.push({id,name:'Shape '+dLyrCnt,type:'shape',shapeKind:'rect',x,y,w:w||200,h:h||80,fill:'#FF9000',opacity:100,radius:0,visible:true});
  dSelLayerState(id);dRenderCanvas();dRenderLayersList();dStats();dMarkUnsaved();dSetTool('select');gToast('Forma adicionada');
  setTimeout(()=>dFlashLayer(id),30);
}
function dAddImageAt(x,y,w,h){  dHistoryPush();
  const id='l-'+(++dLyrCnt);
  dLayers.push({id,name:'Imagem '+dLyrCnt,type:'image',x,y,w:w||120,h:h||120,imgUrl:'',imgVar:'',objectFit:'cover',visible:true});
  dSelLayerState(id);dRenderCanvas();dRenderLayersList();dStats();dMarkUnsaved();dSetTool('select');gToast('Camada de imagem adicionada');
  setTimeout(()=>dFlashLayer(id),30);
}
function dAddFrame(){const f=dCanvasSize();dAddFrameAt(Math.round(f.w*.05),Math.round(f.h*.04));}
function dAddFrameAt(x,y,w,h){  dHistoryPush();
  const f=dCanvasSize();
  const id='l-'+(++dLyrCnt);
  dLayers.push({id,name:'Moldura '+dLyrCnt,type:'frame',x,y,w:w||Math.round(f.w*.6),h:h||Math.round(f.h*.35),imgUrl:'',imgVar:'foto_produto',objectFit:'cover',frameShape:'rect',visible:true});
  dSelLayerState(id);dRenderCanvas();dRenderLayersList();dStats();dMarkUnsaved();dSetTool('select');gToast('Moldura adicionada — clique em + FOTO para inserir imagem');
  setTimeout(()=>dFlashLayer(id),30);
}

/* ── Conversão FORMA ⇄ MOLDURA DE FOTO (e imagem → moldura) ──
   Uma moldura é um espaço de foto que o franqueado preenche. Preserva posição/tamanho e herda
   o formato (retângulo/arredondado/círculo) da forma de origem. ── */
function dConvertLayerToFrame(id){
  const l=dLayers.find(x=>x.id===id); if(!l) return;
  if(l.type==='frame') return; // já é
  if(l.type!=='shape' && l.type!=='image'){ gToast('Só formas ou imagens viram moldura de foto'); return; }
  if(typeof dHistoryPush==='function') dHistoryPush();
  const fs=(l.shapeKind==='circle'||l.shapeKind==='ellipse')?'circle':((l.radius||l.radii)?'rounded':'rect');
  l.type='frame';
  l.frameShape=fs;
  if(l.imgVar==null||l.imgVar==='') l.imgVar='foto_produto';
  l.objectFit=l.objectFit||'cover';
  if(l.imgUrl==null) l.imgUrl='';
  // props exclusivas de forma não fazem sentido na moldura
  delete l.fill; delete l.shapeKind; delete l.gradient; delete l.radii; delete l.sides; delete l.points; delete l.inner;
  dRenderCanvas(); if(typeof dRenderLayersList==='function') dRenderLayersList(); dShowProps(l); dMarkUnsaved();
  gToast('✓ Virou moldura de foto — o franqueado preenche com a imagem');
}
function dConvertLayerToShape(id){
  const l=dLayers.find(x=>x.id===id); if(!l||l.type!=='frame') return;
  if(typeof dHistoryPush==='function') dHistoryPush();
  l.type='shape';
  l.shapeKind=(l.frameShape==='circle')?'circle':'rect';
  if(l.fill==null) l.fill='#FF9000';
  if(l.frameShape==='rect') l.radius=l.radius||0;
  delete l.imgUrl; delete l.imgVar; delete l.objectFit; delete l.frameShape;
  dRenderCanvas(); if(typeof dRenderLayersList==='function') dRenderLayersList(); dShowProps(l); dMarkUnsaved();
  gToast('✓ Virou forma');
}

/* ── Menu de botão-direito na camada (canvas ou lista) ──
   Ações contextuais por tipo: vincular dado, converter forma⇄moldura, duplicar, excluir.
   Reusa o estilo .tmpl-context-menu. ── */
const _DLYR_ICO={
  link:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  frame:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
  shape:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>',
  dup:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  del:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
};
function dLayerContextMenu(e, layerId){
  if(e){ e.preventDefault(); e.stopPropagation(); }
  document.querySelectorAll('.tmpl-context-menu,.layer-ctx-menu,.folder-ctx-menu').forEach(m=>m.remove());
  const l=dLayers.find(x=>x.id===layerId); if(!l) return;
  dSelLayer(layerId); // seleciona → as ações operam nela
  const cx=(e&&e.clientX)||120, cy=(e&&e.clientY)||120;
  const items=[];
  if(typeof dLayerIsBindable==='function' && dLayerIsBindable(l)){
    items.push({label:'Vincular dado…', ico:_DLYR_ICO.link, fn:()=>{ const anchor={getBoundingClientRect:()=>({bottom:cy,left:cx,right:cx,top:cy,width:0,height:0})}; if(typeof dFieldBindPickerOpen==='function') dFieldBindPickerOpen({currentTarget:anchor, stopPropagation:function(){}}); }});
  }
  if(l.type==='shape'||l.type==='image'){
    items.push({label:'Transformar em moldura de foto', ico:_DLYR_ICO.frame, fn:()=>dConvertLayerToFrame(layerId)});
  } else if(l.type==='frame'){
    items.push({label:'Transformar em forma', ico:_DLYR_ICO.shape, fn:()=>dConvertLayerToShape(layerId)});
  }
  items.push({sep:true});
  if(typeof dDuplicateLayer==='function') items.push({label:'Duplicar', ico:_DLYR_ICO.dup, fn:()=>dDuplicateLayer()});
  if(typeof dDeleteLayer==='function') items.push({label:'Excluir', ico:_DLYR_ICO.del, danger:true, fn:()=>dDeleteLayer()});

  const menu=document.createElement('div');
  menu.className='tmpl-context-menu layer-ctx-menu';
  menu.innerHTML=items.map((it,idx)=> it.sep
    ? '<div class="tmpl-ctx-sep"></div>'
    : `<button class="tmpl-ctx-item ${it.danger?'tmpl-ctx-danger':''}" data-idx="${idx}"><span class="tmpl-ctx-icon">${it.ico||''}</span>${it.label}</button>`).join('');
  document.body.appendChild(menu);
  const mw=Math.max(200, menu.offsetWidth), mh=menu.offsetHeight||220;
  menu.style.left=Math.min(cx, window.innerWidth-mw-8)+'px';
  menu.style.top=Math.min(cy, window.innerHeight-mh-8)+'px';
  menu.querySelectorAll('.tmpl-ctx-item').forEach(btn=>{
    const it=items[+btn.dataset.idx];
    btn.addEventListener('click',(ev)=>{ ev.stopPropagation(); menu.remove(); document.removeEventListener('mousedown',_closeC); if(it&&it.fn) setTimeout(it.fn,0); });
  });
  function _closeC(ev){ if(!menu.contains(ev.target)){ menu.remove(); document.removeEventListener('mousedown',_closeC); } }
  setTimeout(()=>document.addEventListener('mousedown',_closeC),0);
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
  if(sel.length<3){gToast('Selecione 3 ou mais camadas para distribuir');return;}
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

let dLayersSearchQuery = '';
let dLayersFilterType = '';

function dLayersSearchFilter(query) {
  dLayersSearchQuery = (query || '').toLowerCase();
  dRenderLayersList();
}

function dToggleLayersFilterMenu(e) {
  e.stopPropagation();
  let menu = document.getElementById('d-layers-filter-menu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'd-layers-filter-menu';
    menu.className = 'd-filter-menu-popover';
    menu.innerHTML = `
      <div class="d-filter-menu-item" onclick="dSetLayersFilterType('')">Mostrar todos</div>
      <div class="d-filter-menu-item" onclick="dSetLayersFilterType('text')">Apenas Texto (T)</div>
      <div class="d-filter-menu-item" onclick="dSetLayersFilterType('image')">Apenas Imagens (▣)</div>
      <div class="d-filter-menu-item" onclick="dSetLayersFilterType('shape')">Apenas Formas (■)</div>
    `;
    document.body.appendChild(menu);
  }
  
  const rect = e.currentTarget.getBoundingClientRect();
  menu.style.top = (rect.bottom + window.scrollY + 4) + 'px';
  menu.style.left = (rect.left + window.scrollX - 80) + 'px';
  
  const isOpen = menu.classList.contains('open');
  document.querySelectorAll('.d-filter-menu-popover').forEach(m => m.classList.remove('open'));
  
  if (!isOpen) {
    menu.classList.add('open');
    const closeMenu = (evt) => {
      if (!menu.contains(evt.target) && evt.target !== e.currentTarget) {
        menu.classList.remove('open');
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }
}

function dSetLayersFilterType(type) {
  dLayersFilterType = type;
  const btn = document.querySelector('.d-layers-filter-btn');
  if (btn) {
    btn.classList.toggle('active', !!type);
  }
  dRenderLayersList();
  const menu = document.getElementById('d-layers-filter-menu');
  if (menu) menu.classList.remove('open');
}

function dToggleABCollapse(){}  // no-op — canvas único
function dToggleABLock(){}       // no-op — canvas único

function dToggleLayerLock(e, abId, layerId) {
  e.stopPropagation();
  const l = dLayers.find(x => x.id === layerId);
  if (l) {
    dHistoryPush();
    l.locked = !l.locked;
    if (l.type === 'group') {
      dLayers.forEach(x => { if (x.parentId === l.id) x.locked = l.locked; });
    }
    dRenderCanvas();
    dRenderLayersList();
    dMarkUnsaved();
  }
}

function dToggleLayerVis(e, abId, layerId) {
  e.stopPropagation();
  const l = dLayers.find(x => x.id === layerId);
  if (l) {
    dHistoryPush();
    l.visible = !l.visible;
    dRenderCanvas();
    dRenderLayersList();
    dMarkUnsaved();
  }
}

function dSelectInactiveLayer(abId, layerId) {
  dSelLayer(layerId);
}

function dDeleteSelectedLayer() {
  if (dMultiSel.length) {
    dHistoryPush();
    dLayers = dLayers.filter(x => !dMultiSel.includes(x.id) && x.id !== dSelId);
    dMultiSel = [];
    dSelId = null;
    dRenderCanvas(); dRenderLayersList(); dStats(); dMarkUnsaved();
    document.getElementById('d-no-sel').style.display=''; document.getElementById('d-props-form').style.display='none';
    gToast('Camadas removidas');
  } else {
    dDeleteLayer();
  }
}

function dDuplicateSelectedLayer() {
  dDuplicateLayer();
}

function dAddEffect() {
  const modal = document.getElementById('d-fx-modal');
  if (modal) {
    modal.classList.add('open');
    dSelectFxTab('shadow'); // default tab
  }
}

function dCloseFxModal() {
  const modal = document.getElementById('d-fx-modal');
  if (modal) modal.classList.remove('open');
}

function dSelectFxTab(tab) {
  // Update sidebar tabs
  const tabs = document.querySelectorAll('.fx-tab-item');
  tabs.forEach(t => t.classList.remove('active'));
  tabs.forEach(t => {
    if (t.getAttribute('onclick') && t.getAttribute('onclick').includes(tab)) t.classList.add('active');
  });

  // Update content panels
  const panels = document.querySelectorAll('.fx-panel');
  panels.forEach(p => p.style.display = 'none');
  const activePanel = document.getElementById('fx-panel-' + tab);
  if (activePanel) activePanel.style.display = 'flex';

  // Update title
  const titles = {
    'shadow': 'Sombra Projetada',
    'inner': 'Sombra Interna',
    'glow': 'Brilho Externo',
    'overlay': 'Sobreposição de Cor'
  };
  const titleEl = document.getElementById('fx-modal-title');
  if (titleEl && titles[tab]) titleEl.innerText = titles[tab];
}

// ── Angle dial interaction ─────────────────────────────────
function dFxDialStart(e, propName, inputId, dialId) {
  e.preventDefault();
  const input = document.getElementById(inputId);
  const dial  = document.getElementById(dialId);
  const needle = dial ? dial.querySelector('.fx-dial-needle') : null;
  if (!dial) return;

  const rect = dial.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  function onMove(ev) {
    const dx = ev.clientX - cx;
    const dy = ev.clientY - cy;
    let angle = Math.round(Math.atan2(dy, dx) * 180 / Math.PI);
    if (angle < 0) angle += 360;
    if (input) input.value = angle;
    if (needle) needle.style.transform = 'rotate(' + angle + 'deg)';
    dUpdateProp(propName, angle);
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.body.style.cursor = '';
  }
  document.body.style.cursor = 'crosshair';
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// ── Reset all effects ──────────────────────────────────────
function dFxReset() {
  ['shadow','innerShadow','glow','overlay'].forEach(key => dUpdateProp(key, false));
  ['dp-fx-shadow','dp-fx-inner','dp-fx-glow','dp-fx-overlay'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });
  gToast('Efeitos removidos');
}

// <input type=color> só aceita #rrggbb; converte rgba()→hex (descarta alpha) p/ exibir no picker.
function _dFxHex(c){
  if(!c) return null;
  const m=String(c).match(/rgba?\(([^)]+)\)/i);
  if(m){ const p=m[1].split(','); const h=n=>('0'+Math.max(0,Math.min(255,Math.round(+n))).toString(16)).slice(-2); return '#'+h(p[0])+h(p[1])+h(p[2]); }
  return c;
}
// Popula os campos de efeitos (sombra/inner/glow/overlay) a partir do layer selecionado.
function dFxPopulate(l){
  const set=(id,v)=>{ const e=document.getElementById(id); if(e) e.value=v; };
  const chk=(id,v)=>{ const e=document.getElementById(id); if(e) e.checked=!!v; };
  chk('dp-fx-shadow', l.shadow);
  set('dp-fx-shadow-color', _dFxHex(l.shadowColor)||'#000000');
  set('dp-fx-shadow-blur', l.shadowBlur!=null?l.shadowBlur:''); set('dp-fx-shadow-dist', l.shadowDist!=null?l.shadowDist:''); set('dp-fx-shadow-angle', l.shadowAngle!=null?l.shadowAngle:'');
  chk('dp-fx-inner', l.innerShadow);
  set('dp-fx-inner-color', _dFxHex(l.innerShadowColor)||'#000000');
  set('dp-fx-inner-blur', l.innerShadowBlur!=null?l.innerShadowBlur:''); set('dp-fx-inner-dist', l.innerShadowDist!=null?l.innerShadowDist:''); set('dp-fx-inner-angle', l.innerShadowAngle!=null?l.innerShadowAngle:'');
  chk('dp-fx-glow', l.glow);
  set('dp-fx-glow-color', _dFxHex(l.glowColor)||'#ffffff');
  set('dp-fx-glow-size', l.glowSize!=null?l.glowSize:'');
  chk('dp-fx-overlay', l.overlay);
  set('dp-fx-overlay-color', _dFxHex(l.overlayColor)||'#000000');
  set('dp-fx-overlay-op', l.overlayOpacity!=null?Math.round(l.overlayOpacity*100):'');
}

// Miniatura da camada (estilo Photoshop): imagem real, swatch da forma, "T" do texto ou pasta.
function _dLayerThumb(l){
  if(l.type==='group') return '<span class="lyr-th-ico"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></span>';
  if(l.type==='image'||l.type==='frame'){
    const u=l.imgUrl;
    if(u && /^(data:|https?:|blob:)/.test(u)) return '<img src="'+u+'" alt="" loading="lazy">';
    return '<span class="lyr-th-ico"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></span>';
  }
  if(l.type==='shape'){
    const bg=(l.gradient&&l.gradient.stops&&l.gradient.stops.length&&typeof gGradientCss==='function')?gGradientCss(l.gradient):(l.fill||'#FF9000');
    const rad=(l.shapeKind==='circle'||l.shapeKind==='ellipse')?'50%':'3px';
    return '<span class="lyr-th-fill" style="background:'+bg+';border-radius:'+rad+'"></span>';
  }
  if(l.type==='text') return '<span class="lyr-th-text" style="color:'+(l.color||'#fff')+'">T</span>';
  return '';
}
// Indicador "fx" quando a camada tem qualquer efeito aplicado.
function _dLayerHasFx(l){ return !!(l.shadow||l.innerShadow||l.glow||l.bevel||l.overlay||l.strokeW||l.gradient); }
function dRenderLayersList(){
  const el=document.getElementById('d-layers-list');
  if(!el) return;

  let html = '';
  const reversedLayers = [...dLayers].reverse();

  reversedLayers.forEach(l => {
    if (dLayersSearchQuery) {
      const nameMatch = l.name && l.name.toLowerCase().includes(dLayersSearchQuery);
      const contentMatch = l.content && l.content.toLowerCase().includes(dLayersSearchQuery);
      if (!nameMatch && !contentMatch) return;
    }

    if (dLayersFilterType) {
      if (dLayersFilterType === 'text' && l.type !== 'text') return;
      if (dLayersFilterType === 'image' && (l.type !== 'image' && l.type !== 'frame')) return;
      if (dLayersFilterType === 'shape' && l.type !== 'shape') return;
    }

    let parentId = l.parentId;
    let isHiddenByParent = false;
    while (parentId) {
      const parent = dLayers.find(x => x.id === parentId);
      if (parent) {
        if (parent.collapsed) { isHiddenByParent = true; break; }
        parentId = parent.parentId;
      } else { break; }
    }
    if (isHiddenByParent) return;

    let depth = 0;
    let currP = l.parentId;
    while(currP) {
      const p = dLayers.find(x => x.id === currP);
      if (p) {
        depth++;
        currP = p.parentId;
      } else {
        currP = null;
      }
    }
    const indent = 6 + (depth * 14);
    const indentStyle = `style="padding-left: ${indent}px;"`;
    const childClass = depth > 0 ? 'child-row' : '';
    const isSelected = (l.id === dSelId || dMultiSel.includes(l.id));

    const visIcon = l.visible
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

    const lockIcon = l.locked
      ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
      : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`;

    // Estado do Dado: camada inteira ligada a 1 campo → selo com o RÓTULO ("◆ Preço");
    // texto com campo embutido numa frase → só o ícone de corrente.
    const _boundFn = (typeof dLayerBoundField==='function') ? dLayerBoundField(l) : null;
    const _boundV = _boundFn ? dVars.find(v=>v.name===_boundFn) : null;
    const hasVarEmbedded = l.type === 'text' && /\{\{/.test(l.content || '');
    const varBadge = _boundV
      ? `<span class="lyr-badge lyr-var lyr-dado" title="Dado: ${gEsc(_boundV.label||_boundV.name)}">◆ ${gEsc(_boundV.label||_boundV.name)}</span>`
      : (hasVarEmbedded ? `<span class="lyr-badge lyr-var" title="Contém um campo"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;color:var(--var-color, #a855f7)"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></span>` : '');

    let typeIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="10" height="10" rx="1"/><circle cx="16" cy="16" r="5"/></svg>`; // shape default
    if (l.type === 'text') typeIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`;
    else if (l.type === 'image') typeIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
    else if (l.type === 'frame') typeIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>`;
    else if (l.type === 'group') typeIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;

    const dndAttrs = `draggable="true"
      ondragstart="dLyrDragStart(event,'${l.id}')"
      ondragover="dLyrDragOver(event)"
      ondragleave="dLyrDragLeave(event)"
      ondragend="dLyrDragEnd(event)"
      ondrop="dLyrDrop(event,'${l.id}')"`;

    let groupToggleHtml = '';
    if (l.type === 'group') {
      const gIcon = l.collapsed
        ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:middle"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
        : `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:middle"><polygon points="3 5 21 5 12 19 3 5"/></svg>`;
      groupToggleHtml = `<span class="group-collapse-toggle" onclick="event.stopPropagation(); dToggleGroupCollapse(event, '${l.id}')">${gIcon}</span>`;
    }

    html += `
      <div class="layer-row ${childClass} ${isSelected ? 'active' : ''} ${l.type === 'group' ? 'group-row' : ''} ${!l.visible ? 'layer-hidden' : ''}"
           ${indentStyle}
           data-lid="${l.id}"
           ${dndAttrs}
           onmouseenter="dHoverLayer('${l.id}',true)"
           onmouseleave="dHoverLayer('${l.id}',false)"
           oncontextmenu="dLayerContextMenu(event,'${l.id}')"
           onclick="event.shiftKey ? dToggleMultiSel('${l.id}') : dSelLayer('${l.id}')">
        <span class="layer-drag-handle" title="Arrastar para reordenar">⠿</span>
        ${groupToggleHtml}
        <span class="layer-icon">${typeIcon}</span>
        <span class="layer-label ${l.type === 'group' ? 'group-label' : ''}" ondblclick="dRenameLayer('${l.id}',event)" title="Duplo clique para renomear">${gEsc(l.name)}</span>
        ${varBadge}
        ${(l.blendMode && l.blendMode !== 'normal' && typeof dBlendModeLabel === 'function') ? `<span class="lyr-badge lyr-blend" title="Mesclagem: ${dBlendModeLabel(l.blendMode)}">${dBlendModeLabel(l.blendMode)}</span>` : ''}
        ${_dLayerHasFx(l) ? `<span class="lyr-badge lyr-fx" title="Efeitos ativos: ${[l.shadow?'Sombra':'',l.innerShadow?'S.Interna':'',l.glow?'Brilho':'',l.overlay?'Sobreposição':''].filter(Boolean).join(', ')}">fx</span>` : ''}
        ${l.mask ? `<span class="lyr-badge lyr-mask" title="Máscara aplicada — clique para remover" onclick="event.stopPropagation();dRemoveMask('${l.id}')"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="display:inline-block;vertical-align:middle"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="12" r="5"/></svg></span>` : ''}
        <button class="layer-vis ${l.locked ? 'layer-is-hidden' : ''}" onclick="dToggleLayerLock(event, 'ab-single', '${l.id}')" title="${l.locked ? 'Desbloquear' : 'Bloquear'}">${lockIcon}</button>
        <button class="layer-vis ${!l.visible ? 'layer-is-hidden' : ''}" onclick="dToggleLayerVis(event, 'ab-single', '${l.id}')" title="Visibilidade">${visIcon}</button>
      </div>
    `;
  });

  el.innerHTML = html;
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
    const _dd=document.getElementById('dp-dado'); if(_dd)_dd.style.display='none'; // grupo não recebe Dado
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
  
  // Atualizar breadcrumb
  const bcEl=document.getElementById('dp-breadcrumb');
  if(bcEl){
    let path = [];
    let curr = l;
    while(curr){
      path.unshift({id: curr.id, name: curr.name});
      if(curr.parentId){
        curr = dLayers.find(x => x.id === curr.parentId);
      } else {
        // Encontrar artboard se não for filho de ninguem
        const ab = dArtboards.find(x => x.id === curr.abId);
        if (ab && curr.type !== 'frame') {
            path.unshift({id: null, name: ab.name || 'Artboard'});
        }
        break;
      }
    }
    bcEl.innerHTML = path.map((p, i) => {
      const isLast = i === path.length - 1;
      return `<span class="dp-bc-item" ${!isLast && p.id ? `onclick="dSelLayer('${p.id}')"` : ''}>${gEsc(p.name)}</span>`;
    }).join('<span class="dp-bc-sep">›</span>');
  }

  // Atualizar header de contexto
  document.getElementById('dp-x').value=l.x;document.getElementById('dp-y').value=l.y;
  document.getElementById('dp-w').value=l.w;document.getElementById('dp-h').value=l.h;
  const isText=l.type==='text',isImg=l.type==='image'||l.type==='frame',isShp=l.type==='shape';
  if(typeof dRenderDadoControl==='function') dRenderDadoControl(l); // controle "Dado" (topo)
  document.getElementById('d-text-props').style.display=isText?'':'none';
  var _shpEl=document.getElementById('d-shape-props');if(_shpEl)_shpEl.style.display=isShp?'':'none';
  document.getElementById('d-image-props').style.display=isImg?'flex':'none';
  if(typeof dPropShowSections==='function')dPropShowSections(l.type);
  if(typeof dPopBindingSelects==='function')dPopBindingSelects(l); // 4.1 — vínculos de propriedade
  if(typeof dRenderRules==='function')dRenderRules(l); // 4.2 — regras condicionais
  if(typeof dMaskRenderProps==='function')dMaskRenderProps(l); // máscaras de camada
  if(typeof dFxPopulate==='function')dFxPopulate(l); // efeitos (sombra/inner/glow/overlay) — universal
  // Blend mode — universal para todos os tipos de layer
  var _blendSel=document.getElementById('dp-blend');
  if(_blendSel){
    if(!_blendSel.options.length&&typeof DBLEND_GROUPS!=='undefined'&&typeof dBlendModeLabel==='function'){
      DBLEND_GROUPS.forEach(function(g){
        var og=document.createElement('optgroup');og.label=g.label;
        g.modes.forEach(function(m){var o=document.createElement('option');o.value=m;o.textContent=dBlendModeLabel(m);og.appendChild(o);});
        _blendSel.appendChild(og);
      });
    }
    _blendSel.value=l.blendMode||'normal';
    _blendSel.onchange=function(){
      var _lid=l.id;
      var _lay=dLayers.find(function(x){return x.id===_lid;});
      if(!_lay)return;
      _lay.blendMode=this.value==='normal'?undefined:this.value;
      dRenderCanvas();dMarkUnsaved();
    };
  }
  if(isText){
    const ce=document.getElementById('dp-content');
    if(ce) ce.innerHTML=dFieldTokensToChips(l.content||''); // Fase 3: tokens → chips [Campo]
    if(typeof dPopFontSelects==='function')dPopFontSelects(); // inclui fontes enviadas (#dp-font)
    document.getElementById('dp-font').value=l.font||"'Roboto Black'";
    document.getElementById('dp-fsize').value=l.fontSize||24;
    document.getElementById('dp-align').value=l.textAlign||'left';
    if(typeof dPropSyncAlign==='function')dPropSyncAlign(l.textAlign||'left');
    const col=l.color||'#ffffff';
    document.getElementById('dp-color-sw').style.background=col;
    const safeCol=col.startsWith('rgba')?'#ffffff':col;
    document.getElementById('dp-color-pick').value=safeCol;
    const hexC=document.getElementById('dp-color-hex');if(hexC)hexC.value=safeCol.toUpperCase();
    const curveEl=document.getElementById('dp-text-curve');if(curveEl)curveEl.value=l.textCurve||0;
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
    // Cantos por canto + traçado (reaplicado)
    const _cr=dCornerRadii(l);
    ['tl','tr','br','bl'].forEach(k=>{ const el=document.getElementById('dp-corner-'+k); if(el)el.value=_cr[k]; });
    dCornerLinked=!l.radii; const _lk=document.getElementById('dp-corner-link'); if(_lk){ _lk.classList.toggle('active',dCornerLinked); _lk.textContent=dCornerLinked?'🔗':'🔓'; }
    const _swEl=document.getElementById('dp-shape-strokeW'); if(_swEl)_swEl.value=l.strokeW||0;
    const _scHex=document.getElementById('dp-shape-strokeColor'); if(_scHex)_scHex.value=(l.strokeColor||'#000000').toUpperCase();
    const _scSw=document.getElementById('dp-shape-stroke-sw'); if(_scSw)_scSw.style.background=l.strokeColor||'#000000';
    const _scPick=document.getElementById('dp-shape-stroke-pick'); if(_scPick)_scPick.value=l.strokeColor||'#000000';
    const _saEl=document.getElementById('dp-shape-strokeAlign'); if(_saEl)_saEl.value=l.strokeAlign||'inside';
    // Geometria (lados/pontas/raio interno) — só polígono/estrela
    const _geo=document.getElementById('dp-shape-geo');
    if(_geo){
      const isPoly=l.shapeKind==='polygon', isStar=l.shapeKind==='star';
      _geo.style.display=(isPoly||isStar)?'':'none';
      const sEl=document.getElementById('dp-shape-sides'); if(sEl){ sEl.style.display=isPoly?'':'none'; sEl.value=l.sides||6; }
      const pEl=document.getElementById('dp-shape-points'); if(pEl){ pEl.style.display=isStar?'':'none'; pEl.value=l.points||5; }
      const iEl=document.getElementById('dp-shape-inner'); if(iEl){ iEl.style.display=isStar?'':'none'; iEl.value=Math.round((l.inner!=null?l.inner:0.5)*100); }
    }
  }
  if(isImg){
    document.getElementById('dp-imgurl').value=l.imgUrl||'';
    document.getElementById('dp-imgfit').value=l.objectFit||'cover';
    const imgSel=document.getElementById('dp-imgvar');
    const imgVars=dVars.filter(v=>v.type==='image');
    imgSel.innerHTML='<option value="">URL fixa</option>'+imgVars.map(v=>`<option value="${gEsc(v.name)}" ${v.name===l.imgVar?'selected':''}>${gEsc(v.label)}</option>`).join('');
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
    // Botão de conversão: frame → forma; imagem → moldura de foto.
    const cvBtn=document.getElementById('dp-convert-frame-btn');
    if(cvBtn){
      cvBtn.style.display='';
      if(l.type==='frame'){
        cvBtn.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg> Transformar em forma';
        cvBtn.onclick=()=>dConvertLayerToShape(l.id);
      } else {
        cvBtn.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg> Transformar em moldura de foto';
        cvBtn.onclick=()=>dConvertLayerToFrame(l.id);
      }
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
  
  // Universal opacity, fill opacity and locks sync for any active layer properties
  const opacEl = document.getElementById('dp-opacity');
  if (opacEl) opacEl.value = l.opacity !== undefined ? l.opacity : 100;
  
  const fillOpacEl = document.getElementById('dp-fill-opacity');
  if (fillOpacEl) fillOpacEl.value = l.fillOpacity !== undefined ? l.fillOpacity : 100;
  
  dUpdateQuickLocksUI(l);
}

function dUpdateQuickLocksUI(l) {
  const btnTrans = document.getElementById('lock-transparency');
  const btnEdit = document.getElementById('lock-edit');
  const btnPos = document.getElementById('lock-position');
  const btnAll = document.getElementById('lock-all');
  
  if(btnTrans) btnTrans.classList.toggle('active', !!l.lockTransparency);
  if(btnEdit) btnEdit.classList.toggle('active', !!l.lockEdit);
  if(btnPos) btnPos.classList.toggle('active', !!l.lockPosition);
  if(btnAll) btnAll.classList.toggle('active', !!l.locked);
}

function dToggleQuickLock(lockType) {
  const l = dLayers.find(x => x.id === dSelId);
  if (!l) return;
  dHistoryPush();
  if (lockType === 'all') {
    l.locked = !l.locked;
    if (l.type === 'group') {
      dLayers.forEach(x => { if (x.parentId === l.id) x.locked = l.locked; });
    }
  } else if (lockType === 'transparency') {
    l.lockTransparency = !l.lockTransparency;
  } else if (lockType === 'edit') {
    l.lockEdit = !l.lockEdit;
  } else if (lockType === 'position') {
    l.lockPosition = !l.lockPosition;
  }
  dRenderCanvas();
  dRenderLayersList();
  dUpdateQuickLocksUI(l);
  dMarkUnsaved();
}
function dPopVarSel(){
  const sel=document.getElementById('d-var-insert');
  if(!sel) return;
  sel.innerHTML='<option value="">+ inserir campo…</option>'+dVars.map(v=>`<option value="${v.name}">${_dEsc(v.label||v.name)}</option>`).join('');
}
/* ── BINDINGS de propriedade (4.1) ── */
function dBindOptions(filterFn, current){
  return '<option value="">— nenhuma —</option>'+dVars.filter(filterFn).map(v=>`<option value="${gEsc(v.name)}" ${v.name===current?'selected':''}>${gEsc(v.label)} ({{${gEsc(v.name)}}})</option>`).join('');
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
  const l=dLayers.find(x=>x.id===dSelId); if(!l){gToast('Selecione uma camada');return;}
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
  inp.focus(); // garante caret válido e deixa o token inserido visível
  const pos=(inp.selectionStart!=null)?inp.selectionStart:inp.value.length; // 0 é posição válida (não cair no fim)
  const token='{{'+vn+'}}';
  inp.value=inp.value.substring(0,pos)+token+inp.value.substring(pos);
  const caret=pos+token.length; try{inp.setSelectionRange(caret,caret);}catch(e){}
  dUpdateProp('content',inp.value);sel.value='';
}

/* ══════════════════════════════════════════════════════════════
   FASE 3 — Editor de conteúdo com chips [Campo]
   O dado em l.content continua sendo a string "{{nome}}"; o usuário
   nunca vê a sintaxe — só o chip com o rótulo amigável.
══════════════════════════════════════════════════════════════ */
// string "{{nome}}" → HTML do contentEditable (chips atômicos, contenteditable=false).
function dFieldTokensToChips(str){
  return _dEsc(String(str==null?'':str)).replace(gVarRegex(),(m,n)=>{
    const v=(typeof dVars!=='undefined')&&dVars.find(x=>x.name===n);
    const lab=v?(v.label||n):n;
    return `<span class="field-chip" contenteditable="false" data-var="${n}">${_dEsc(lab)}</span>`;
  });
}
// contentEditable → string com "{{nome}}" (chips viram tokens; <br>/<div> viram \n).
function dFieldReadContent(el){
  let out='';
  el.childNodes.forEach(node=>{
    if(node.nodeType===3){ out+=node.nodeValue; }
    else if(node.nodeType===1){
      if(node.classList && node.classList.contains('field-chip')){ out+='{{'+(node.dataset.var||'')+'}}'; }
      else if(node.tagName==='BR'){ out+='\n'; }
      else if(node.tagName==='DIV'||node.tagName==='P'){ if(out&&!out.endsWith('\n'))out+='\n'; out+=dFieldReadContent(node); }
      else { out+=node.textContent||''; }
    }
  });
  return out;
}
// oninput do editor: lê chips→tokens e aplica em l.content.
function dFieldContentSync(el){
  if(!el) return;
  dUpdateProp('content', dFieldReadContent(el).replace(/ /g,' '));
}
// paste como texto puro (evita HTML colado quebrando o editor).
function dFieldContentPaste(e){
  e.preventDefault();
  const text=((e.clipboardData||window.clipboardData)||{}).getData ? (e.clipboardData||window.clipboardData).getData('text/plain') : '';
  try{ document.execCommand('insertText', false, text); }catch(_){ }
}

// Insere um chip do campo na posição do caret (ou no fim) do #dp-content.
let _dFieldSavedRange=null;
function dFieldInsertChipAtCaret(name){
  const host=document.getElementById('dp-content'); if(!host) return;
  const v=(typeof dVars!=='undefined')&&dVars.find(x=>x.name===name);
  const lab=v?(v.label||name):name;
  const chip=document.createElement('span');
  chip.className='field-chip'; chip.setAttribute('contenteditable','false');
  chip.dataset.var=name; chip.textContent=lab;
  host.focus();
  const sel=window.getSelection();
  let range=null;
  if(_dFieldSavedRange && host.contains(_dFieldSavedRange.startContainer)){ range=_dFieldSavedRange; }
  else if(sel && sel.rangeCount && host.contains(sel.anchorNode)){ range=sel.getRangeAt(0); }
  if(!range){ range=document.createRange(); range.selectNodeContents(host); range.collapse(false); }
  range.deleteContents();
  range.insertNode(chip);
  const sp=document.createTextNode(' '); chip.after(sp);
  const after=document.createRange(); after.setStartAfter(sp); after.collapse(true);
  sel.removeAllRanges(); sel.addRange(after);
  _dFieldSavedRange=null;
  dFieldContentSync(host);
}

// Escapa o texto e destaca (bold+underline) o trecho que casa com a busca.
// Seguro: escapa CADA fatia crua separadamente (nunca parte uma entidade &amp;).
function _dHiMatch(text, q){
  text=text||''; q=(q||'').trim();
  if(!q) return _dEsc(text);
  const i=text.toLowerCase().indexOf(q.toLowerCase());
  if(i<0) return _dEsc(text);
  return _dEsc(text.slice(0,i))+'<span class="fp-hi">'+_dEsc(text.slice(i,i+q.length))+'</span>'+_dEsc(text.slice(i+q.length));
}

/* ══ PICKER UNIFICADO DE CAMPOS ══
   Um só motor pros dois fluxos (inserir chip no texto / vincular a camada inteira).
   Antes eram duas funções quase idênticas → toda melhoria tinha que ser feita 2×.
   Recursos: ícone SVG (não emoji), navegação por teclado (↑↓/Enter/Esc), destaque do
   trecho buscado, contador de uso por campo, criar-com-o-texto-digitado.
   opts: { mode, anchor, current, filter(v)?, emptyMsg?, onPick(name), onNew(query) } */
function _dFieldPickerOpen(opts){
  document.querySelectorAll('.field-pick-pop').forEach(p=>p.remove());
  const filter=opts.filter||(()=>true);
  const pop=document.createElement('div'); pop.className='field-pick-pop';
  pop.innerHTML=`<input class="field-pick-search" placeholder="Buscar campo...">
    <div class="field-pick-list"></div>
    <button class="field-pick-new" type="button">+ Criar um campo novo</button>`;
  document.body.appendChild(pop);
  const listEl=pop.querySelector('.field-pick-list');
  const searchEl=pop.querySelector('.field-pick-search');
  const newBtn=pop.querySelector('.field-pick-new');
  let items=[], activeIdx=-1, curQuery='';

  function close(){ pop.remove(); document.removeEventListener('mousedown',closeP); }
  function closeP(e){ if(!pop.contains(e.target)) close(); }
  function pick(name){ close(); opts.onPick(name); }
  function doNew(){ close(); opts.onNew(curQuery); }
  function setActive(i){
    if(!items.length){ activeIdx=-1; return; }
    activeIdx=(i+items.length)%items.length;
    items.forEach((b,k)=>b.classList.toggle('active',k===activeIdx));
    if(items[activeIdx]) items[activeIdx].scrollIntoView({block:'nearest'});
  }
  function renderList(q){
    curQuery=(q||'').trim();
    const ql=curQuery.toLowerCase();
    let html='';
    DFIELD_CATS.forEach(cat=>{
      const group=dVars.filter(v=>filter(v) && (v.category||'outros')===cat.id
        && (!ql||(v.label||'').toLowerCase().includes(ql)||(v.name||'').toLowerCase().includes(ql)));
      if(!group.length) return;
      html+=`<div class="field-pick-cat">${_dEsc(cat.label)}</div>`;
      html+=group.map(v=>{
        const tm=gFieldTypeMeta(v.type);
        const sm=(v.type==='image')?'foto':_dEsc(gFieldSampleValue(v));
        const use=(typeof dVarUsage==='function')?dVarUsage(v.name).length:0;
        const cnt=use?`<span class="field-pick-count" title="Em uso em ${use} camada(s)">${use}</span>`:'';
        return `<button type="button" class="field-pick-item cat-${cat.id}${v.name===opts.current?' cur':''}" data-var="${_dEsc(v.name)}">`
          +`<span class="field-pick-ico">${tm.svg||tm.icon}</span>`
          +`<span class="field-pick-name">${_dHiMatch(v.label||v.name, curQuery)}</span>`
          +cnt+`<span class="field-pick-sample">${sm}</span></button>`;
      }).join('');
    });
    if(!html){
      const hasAny=dVars.some(filter);
      const msg = curQuery ? 'Nenhum campo encontrado'
                : (!hasAny && opts.emptyMsg) ? opts.emptyMsg : 'Nenhum campo';
      listEl.innerHTML=`<div class="field-pick-empty">${_dEsc(msg)}</div>`;
      items=[]; activeIdx=-1;
    } else {
      listEl.innerHTML=html;
      items=Array.from(listEl.querySelectorAll('.field-pick-item'));
      items.forEach(b=>{
        b.onmousedown=(e)=>{ e.preventDefault(); pick(b.dataset.var); };
        b.onmouseenter=()=>{ setActive(items.indexOf(b)); };
      });
      const curEl=items.find(b=>b.classList.contains('cur'));
      if(curEl) setActive(items.indexOf(curEl));
      else if(curQuery) setActive(0);
      else activeIdx=-1;
    }
    // O botão criar reflete a busca → cria já com o texto digitado como rótulo.
    newBtn.textContent = curQuery ? ('+ Criar “'+curQuery+'”') : '+ Criar um campo novo';
  }
  renderList('');
  searchEl.oninput=()=>renderList(searchEl.value);
  searchEl.onkeydown=(e)=>{
    if(e.key==='ArrowDown'){ e.preventDefault(); setActive(activeIdx+1); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); setActive(activeIdx-1); }
    else if(e.key==='Enter'){ e.preventDefault(); if(activeIdx>=0&&items[activeIdx]) pick(items[activeIdx].dataset.var); else doNew(); }
    else if(e.key==='Escape'){ e.preventDefault(); close(); }
  };
  newBtn.onmousedown=(e)=>{ e.preventDefault(); doNew(); };
  const a=opts.anchor;
  const r=(a&&a.getBoundingClientRect)?a.getBoundingClientRect():{bottom:120,left:window.innerWidth-280};
  pop.style.top=(r.bottom+4)+'px';
  pop.style.left=Math.min(r.left, window.innerWidth-260)+'px';
  setTimeout(()=>{ document.addEventListener('mousedown',closeP); searchEl.focus(); },0);
}

// Picker amigável de inserção de chip no texto (substitui o antigo <select>).
function dFieldInsertPickerOpen(ev){
  if(!dVars.length){ gToast('Crie um campo primeiro na aba Dados.'); return; }
  // captura o caret atual do editor antes de abrir (o foco vai pro popover).
  const host=document.getElementById('dp-content');
  const s=window.getSelection();
  _dFieldSavedRange=(s && s.rangeCount && host && host.contains(s.anchorNode)) ? s.getRangeAt(0).cloneRange() : null;
  _dFieldPickerOpen({
    mode:'insert',
    anchor:(ev&&ev.currentTarget)?ev.currentTarget:null,
    current:null,
    onPick:(n)=>dFieldInsertChipAtCaret(n),
    onNew:(q)=>dOpenVarModal(q?{label:q}:{})
  });
}

/* ══════════════════════════════════════════════════════════════
   VINCULAR DADO (camada inteira → 1 campo) — o fluxo principal.
   Uma camada "tem um Dado": texto vira o token único + isVar; imagem vira imgVar.
   O canvas já renderiza {{}} com o valor de EXEMPLO (gFieldSampleValue), então o
   template nasce bonito no preview do franqueado. Chip-no-texto (dFieldInsertPicker)
   segue existindo só pro caso de FRASE com campo embutido.
══════════════════════════════════════════════════════════════ */
// Campo que a camada mostra HOJE quando ela inteira = 1 campo (senão null).
function dLayerBoundField(l){
  if(!l) return null;
  if(l.type==='image'||l.type==='frame') return l.imgVar||null;
  if(l.type==='text'){ const m=(l.content||'').match(/^\s*\{\{\s*([a-zA-Z0-9_]+)\s*\}\}\s*$/); return m?m[1]:null; }
  return null;
}
function dLayerIsBindable(l){ return !!(l && (l.type==='text'||l.type==='image'||l.type==='frame')); }
// Campos EMBUTIDOS num texto misto ("DE R$ {{precoDe}} POR {{precoPor}}") — únicos, em ordem.
// Diferente de dLayerBoundField (camada INTEIRA ligada a 1 campo), aqui o texto mistura
// conteúdo fixo com 1+ dados. O controle "Dado" precisa reconhecer esse estado.
function dLayerEmbeddedFields(l){
  if(!l||l.type!=='text'||!l.content) return [];
  const out=[]; const re=gVarRegex(); let m;
  while((m=re.exec(l.content))){ if(out.indexOf(m[1])<0) out.push(m[1]); }
  return out;
}
// Liga a camada inteira ao campo.
function dLayerBindField(layerId, fieldName){
  const l=dLayers.find(x=>x.id===layerId); if(!l||!fieldName) return;
  const v=dVars.find(x=>x.name===fieldName); if(!v){ gToast('Campo não encontrado'); return; }
  if(typeof dHistoryPush==='function') dHistoryPush();
  if(l.type==='image'||l.type==='frame'){ l.imgVar=fieldName; }
  else if(l.type==='text'){ l.content='{{'+fieldName+'}}'; l.isVar=true; }
  else { gToast('Essa camada não recebe Dado'); return; }
  dRenderCanvas(); if(typeof dRenderLayersList==='function') dRenderLayersList();
  dShowProps(l); dMarkUnsaved();
  gToast('✓ '+(l.name||'Camada')+' agora mostra “'+(v.label||v.name)+'”');
}
// Desvincula: texto volta a ser fixo (usa o rótulo do campo como exemplo); imagem limpa imgVar.
function dLayerUnbindField(layerId){
  const l=dLayers.find(x=>x.id===layerId); if(!l) return;
  if(typeof dHistoryPush==='function') dHistoryPush();
  if(l.type==='image'||l.type==='frame'){ l.imgVar=''; }
  else if(l.type==='text'){
    l.isVar=false;
    const m=(l.content||'').match(/^\s*\{\{\s*([a-zA-Z0-9_]+)\s*\}\}\s*$/);
    if(m){ const v=dVars.find(x=>x.name===m[1]); l.content=v?(v.label||v.name):(l.content||''); }
  }
  dRenderCanvas(); if(typeof dRenderLayersList==='function') dRenderLayersList();
  dShowProps(l); dMarkUnsaved();
}
// Define o valor de EXEMPLO do campo (variável) a partir do controle "Dado". Atualiza o preview
// ao vivo e persiste no campo — NÃO chama dShowProps (pra não recriar o input e perder o foco).
function dDadoSetExample(varName, value){
  const v=dVars.find(x=>x.name===varName); if(!v) return;
  const val=String(value==null?'':value);
  if(val.trim()!=='') v.example=val; else delete v.example;
  if(typeof dPersistVars==='function') dPersistVars();
  if(typeof dRenderCanvas==='function') dRenderCanvas();
}
// Controle "Dado" no topo das propriedades — injetado 1× e atualizado a cada seleção.
function dRenderDadoControl(l){
  const pf=document.getElementById('d-props-form'); if(!pf) return;
  let box=document.getElementById('dp-dado');
  if(!dLayerIsBindable(l)){ if(box) box.style.display='none'; return; }
  if(!box){
    box=document.createElement('div'); box.id='dp-dado'; box.className='dp-dado';
    // IMPORTANTE: inserir como filho DIRETO do #d-props-form (topo). #d-text-props é NETO
    // (fica dentro de .dp-sec-body), então insertBefore com ele lançava DOMException e
    // quebrava dShowProps → o auto-switch (dActivatePanel) na sequência não rodava.
    pf.insertBefore(box, pf.firstChild);
  }
  box.style.display='';
  const fn=dLayerBoundField(l); const v=fn?dVars.find(x=>x.name===fn):null;
  // Texto MISTO (fixo + {{dados}}): não é "nenhum" nem bind de camada inteira — estado próprio.
  const emb=(!v)?dLayerEmbeddedFields(l):[];
  box.classList.toggle('bound', !!v||emb.length>0);
  if(!v && emb.length){
    let h='<div class="dp-dado-lbl"><span class="hl">◆ '+(emb.length===1?'Dado neste texto':emb.length+' dados neste texto')+'</span></div>';
    let warnRS=false;
    emb.forEach(name=>{
      const ev=dVars.find(x=>x.name===name);
      const tm=gFieldTypeMeta(ev?ev.type:'text');
      const ph=_dEsc(gFieldSampleValue({type:ev?ev.type:'text'})||'ex.: valor');
      h+='<div class="dp-dado-ex-row">'
        +'<span class="dp-dado-mixchip" title="{{'+_dEsc(name)+'}}"><span class="dp-dado-ico">'+tm.icon+'</span>'+_dEsc(ev?(ev.label||name):name)+'</span>'
        +(ev
          ?'<input type="text" class="dp-dado-ex" value="'+_dEsc(ev.example||'')+'" placeholder="'+ph+'" oninput="dDadoSetExample(\''+name+'\', this.value)">'
          :'<span class="dp-dado-none" style="font-size:10.5px">campo novo — salve o texto pra criar</span>')
        +'</div>';
      // Lint: campo de preço já formata com "R$" — "R$ {{precoPor}}" sairia "R$ R$ 9,90"
      if(ev&&ev.type==='currency'&&new RegExp('R\\$\\s*\\{\\{\\s*'+name+'\\s*\\}\\}','i').test(l.content||'')) warnRS=true;
    });
    if(warnRS) h+='<div class="dp-dado-warn">⚠ Campo de preço já sai formatado com “R$” — apague o “R$” escrito no texto para não sair “R$ R$ 9,90”.</div>';
    h+='<div class="dp-dado-ex-hint">Este texto mistura conteúdo fixo com dados. O exemplo de cada campo aparece no lugar do dado — aqui e no chat do franqueado.</div>';
    box.innerHTML=h;
    return;
  }
  let h='<div class="dp-dado-lbl">'+(v?'<span class="hl">◆ Dado ligado</span>':'Dado')+'</div>';
  h+='<button type="button" class="dp-dado-pick" id="dp-dado-pick" onclick="dFieldBindPickerOpen(event)">';
  if(v){ const tm=gFieldTypeMeta(v.type); h+='<span class="dp-dado-chip"><span class="dp-dado-ico">'+tm.icon+'</span>'+_dEsc(v.label||v.name)+'</span>'; }
  else { h+='<span class="dp-dado-none">— nenhum (conteúdo fixo)</span>'; }
  h+='<span class="dp-dado-car">▾</span></button>';
  if(v){
    if(v.type==='image'){
      h+='<div class="dp-dado-sample">Exemplo: <b>imagem enviada pelo franqueado</b><button type="button" class="dp-dado-clear" onclick="dLayerUnbindField(dSelId)">desvincular</button></div>';
    } else {
      // Exemplo EDITÁVEL: o que aparece no preview e como placeholder pro franqueado. Fica no
      // CAMPO (variável), então vale onde ele for usado. Placeholder = fallback genérico por tipo.
      const ph=_dEsc(gFieldSampleValue({type:v.type})||'ex.: valor');
      h+='<div class="dp-dado-ex-row">'
        +'<span class="dp-dado-ex-lbl">Exemplo</span>'
        +'<input type="text" class="dp-dado-ex" value="'+_dEsc(v.example||'')+'" placeholder="'+ph+'" oninput="dDadoSetExample(\''+fn+'\', this.value)">'
        +'<button type="button" class="dp-dado-clear" onclick="dLayerUnbindField(dSelId)" title="Desvincular">✕</button>'
        +'</div>'
        +'<div class="dp-dado-ex-hint">Vale para o campo “'+_dEsc(v.label||v.name)+'” em todo lugar (inclusive o chat do franqueado).</div>';
    }
  }
  box.innerHTML=h;
}
// Seletor de bind (camada inteira). Mesmo motor do picker de inserção, mas LIGA a camada
// e filtra por compatibilidade (imagem só aceita campo de imagem, e vice-versa).
function dFieldBindPickerOpen(ev){
  if(ev){ ev.stopPropagation(); }
  const l=dLayers.find(x=>x.id===dSelId); if(!dLayerIsBindable(l)){ gToast('Selecione uma camada de texto ou imagem'); return; }
  const isImg=(l.type==='image'||l.type==='frame');
  const cur=dLayerBoundField(l);
  // Sem nenhum campo no catálogo: nada de beco sem saída — abre direto o wizard
  // de criação já apontando pra esta camada (cria e vincula em um passo).
  if(!dVars.length){ if(typeof dOpenVarModal==='function') dOpenVarModal({forLayer:dSelId}); return; }
  _dFieldPickerOpen({
    mode:'bind',
    anchor:(ev&&ev.currentTarget&&ev.currentTarget.getBoundingClientRect)?ev.currentTarget:document.getElementById('dp-dado-pick'),
    current:cur,
    filter:(v)=> isImg ? (v.type==='image') : (v.type!=='image'),
    emptyMsg: isImg ? 'Nenhum campo de imagem — crie um' : 'Nenhum campo de texto — crie um',
    onPick:(n)=>dLayerBindField(dSelId, n),
    onNew:(q)=>dOpenVarModal(q?{forLayer:dSelId,label:q}:{forLayer:dSelId})
  });
}
// Ponto de entrada da ferramenta/atalho "Vincular campo" (X) e do menu de contexto.
function dOpenBindForSelected(){
  const l=dLayers.find(x=>x.id===dSelId);
  if(!l){ gToast('Selecione uma camada e clique em Vincular campo'); return; }
  if(!dLayerIsBindable(l)){ gToast('Essa camada não recebe Dado (só texto/imagem)'); return; }
  if(typeof dActivatePanel==='function') dActivatePanel('camada');
  setTimeout(()=>{ const btn=document.getElementById('dp-dado-pick'); if(btn) btn.click(); }, 90);
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
/* ── Cantos arredondados por canto ── l.radii={tl,tr,br,bl} sobrescreve l.radius (uniforme/legado). */
function dCornerRadii(l){
  if(l && l.radii && typeof l.radii==='object'){
    return { tl:+l.radii.tl||0, tr:+l.radii.tr||0, br:+l.radii.br||0, bl:+l.radii.bl||0 };
  }
  const u=Math.max(0,(l&&+l.radius)||0);
  return { tl:u, tr:u, br:u, bl:u };
}
let dCornerLinked=true; // cadeado: edição replica nos 4 cantos (= raio uniforme)
function dToggleCornerLink(){
  dCornerLinked=!dCornerLinked;
  const b=document.getElementById('dp-corner-link');
  if(b){ b.classList.toggle('active',dCornerLinked); b.textContent=dCornerLinked?'🔗':'🔓'; }
}
function dSetCorner(which,val){
  const l=dLayers.find(x=>x.id===dSelId); if(!l)return;
  const num=Math.max(0,parseInt(val)||0);
  dHistoryPushDebounced();
  if(dCornerLinked){
    l.radius=num; delete l.radii;
    ['tl','tr','br','bl'].forEach(k=>{ const el=document.getElementById('dp-corner-'+k); if(el)el.value=num; });
    dSyncRadiusUI(num); const rEl=document.getElementById('dp-radius'); if(rEl)rEl.value=num;
  } else {
    if(!l.radii) l.radii=dCornerRadii(l);
    l.radii[which]=num;
  }
  dMarkUnsaved(); dRenderCanvas();
}
function dUpdateProp(prop,val){
  const l=dLayers.find(x=>x.id===dSelId);if(!l)return;
  if(['x','y','w','h','fontSize','opacity','fillOpacity','radius','sides','points','strokeW','shadowBlur','shadowDist','shadowAngle','innerShadowBlur','innerShadowDist','innerShadowAngle','glowSize','textCurve'].includes(prop)){
    // oninput dispara a cada tecla: campo momentaneamente vazio NÃO pode virar 0
    // (w=0/fontSize=0 fazia a camada sumir na hora e o 0 persistia no histórico)
    const _n=parseFloat(val);
    if(isNaN(_n)) return;
    val=_n;
  }
  // Props editadas via oninput contínuo usam debounce — evita serializar dLayers a cada tecla.
  // Props de seleção discreta (font, textAlign, frameShape, etc.) usam push imediato.
  const _continuousProps=['fontSize','opacity','fillOpacity','radius','color','fill','content','sides','points','strokeW','strokeColor','shadowColor','bgColor','imgScale','imgOffsetX','imgOffsetY','shadowBlur','shadowDist','shadowAngle','innerShadowColor','innerShadowBlur','innerShadowDist','innerShadowAngle','glowColor','glowSize','overlayColor','overlayOpacity','textCurve'];
  if(!['x','y','w','h'].includes(prop)){
    if(_continuousProps.includes(prop)) dHistoryPushDebounced();
    else dHistoryPush();
  }
  l[prop]=val;
  if(prop==='radius') delete l.radii; // raio uniforme manda → limpa cantos por canto
  if(prop==='sides') l.sides=Math.max(3,Math.min(20,Math.round(val)));   // polígono
  if(prop==='points') l.points=Math.max(3,Math.min(20,Math.round(val))); // estrela
  if(prop==='inner') l.inner=Math.max(0.05,Math.min(0.95,parseFloat(val)||0.5)); // raio interno estrela
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
let dActivePanel='camadas';
function dActivatePanel(name){
  // Map old panel names to our simplified set
  if(name==='conteudo' || name==='campaigns') name='campaigns';
  if(name==='camada' || name==='propriedades') name='camadas';
  if(name==='vars' || name==='variaveis') name='dados';

  dActivePanel=name; dActiveTab=name; // dActiveTab mantido sincronizado p/ compat

  document.querySelectorAll('.d-rp-tab').forEach(t=>{
    const p = t.dataset.panel;
    t.classList.toggle('active', p===name);
  });

  const rightEl=document.getElementById('d-right');
  const layersSection=document.getElementById('d-layers-section');
  const blendSection=document.getElementById('d-blend-section');
  const propsPanel=document.getElementById('d-panel-camada');
  const campaignsPanel=document.getElementById('d-panel-campaigns');
  const dadosPanel=document.getElementById('d-panel-dados');
  const publicar=document.getElementById('d-panel-publicar');

  if(name==='camadas'){
    if(rightEl){
      rightEl.classList.add('show-layers');
      rightEl.classList.remove('show-campaigns');
    }
    if(layersSection) layersSection.style.display='flex';
    if(blendSection) blendSection.style.display='block';
    if(propsPanel) propsPanel.classList.remove('hidden');
    if(campaignsPanel) campaignsPanel.classList.add('hidden');
    if(dadosPanel) dadosPanel.classList.add('hidden');
    if(publicar) publicar.classList.add('hidden');
  } else if(name==='dados'){
    if(rightEl){
      rightEl.classList.remove('show-layers', 'show-campaigns');
    }
    if(layersSection) layersSection.style.display='none';
    if(blendSection) blendSection.style.display='none';
    if(propsPanel) propsPanel.classList.add('hidden');
    if(campaignsPanel) campaignsPanel.classList.add('hidden');
    if(dadosPanel) dadosPanel.classList.remove('hidden');
    if(publicar) publicar.classList.add('hidden');
    if(typeof dFieldsRender==='function') dFieldsRender();
  } else if(name==='campaigns'){
    if(rightEl){
      rightEl.classList.add('show-campaigns');
      rightEl.classList.remove('show-layers');
    }
    if(layersSection) layersSection.style.display='none';
    if(blendSection) blendSection.style.display='none';
    if(propsPanel) propsPanel.classList.add('hidden');
    if(campaignsPanel) campaignsPanel.classList.remove('hidden');
    if(dadosPanel) dadosPanel.classList.add('hidden');
    if(publicar) publicar.classList.add('hidden');

    if(typeof dRenderFolders==='function') dRenderFolders();
  } else if(name==='publicar'){
    if(rightEl){
      rightEl.classList.remove('show-layers', 'show-campaigns');
    }
    if(layersSection) layersSection.style.display='none';
    if(blendSection) blendSection.style.display='none';
    if(propsPanel) propsPanel.classList.add('hidden');
    if(campaignsPanel) campaignsPanel.classList.add('hidden');
    if(dadosPanel) dadosPanel.classList.add('hidden');
    if(publicar) publicar.classList.remove('hidden');
  }

  // Tutorial não é mais aba (acessado via Ajuda). Biblioteca/Assets migram para o drawer de Recursos.
  const tut=document.getElementById('dtab-tutorial');if(tut)tut.classList.add('hidden');
  if(name==='publicar'&&typeof dPublishPanelRender==='function')dPublishPanelRender();
}
function dSwitchPanelToLayer(){dActivatePanel('camadas');}
function dSwitchPanelToConteudo(){dActivatePanel('campaigns');}

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
  let ok=true;
  try{ localStorage.setItem('yngs_vars_v1', JSON.stringify(dVars)); }
  catch(e){
    ok=false;
    if(e&&(e.name==='QuotaExceededError'||e.code===22))
      gToast('⚠ Não foi possível salvar as variáveis: armazenamento cheio.','error');
  }
  // Sincroniza com o Supabase em background (só designer; não bloqueia a UI).
  if(typeof dPushVarsToBackend==='function') dPushVarsToBackend();
  return ok;
}

/* ── Sync do catálogo de variáveis com o Supabase (luma.variaveis) ──
   Offline-first: localStorage é cache (boot rápido); o Supabase é a fonte
   compartilhada. dVars (memória) luma.variaveis (banco). */
function _dVarToRow(v, i){
  return {
    name: v.name,
    label: v.label || null,
    type: v.type || 'text',
    default_value: (v.defaultValue!=null && v.defaultValue!=='') ? String(v.defaultValue) : null,
    required: !!v.required,
    options: (v.type==='select' && Array.isArray(v.options)) ? v.options : null,
    palette: (v.type==='color' && Array.isArray(v.palette)) ? v.palette : null,
    max_len: (v.maxLen!=null) ? v.maxLen : null,
    category: v.category || null,
    ordem: i,
  };
}
function _dRowToVar(r){
  const v={ name:r.name, label:r.label||r.name, type:r.type||'text', required:!!r.required };
  if(r.default_value!=null && r.default_value!=='') v.defaultValue=r.default_value;
  if(Array.isArray(r.options)) v.options=r.options;
  if(Array.isArray(r.palette)) v.palette=r.palette;
  if(r.max_len!=null) v.maxLen=r.max_len;
  if(r.category) v.category=r.category;
  return v;
}
// Empurra dVars pro Supabase (upsert por name + remove as que sumiram). Só designer.
async function dPushVarsToBackend(){
  const sb = (typeof gSupabase==='function') ? gSupabase() : window.sb;
  if(!sb || typeof gIsAdmin!=='function' || !gIsAdmin()) return;
  try{
    const rows=(dVars||[]).map(_dVarToRow);
    if(!rows.length) return;
    // NÃO-DESTRUTIVO: só adiciona/atualiza. A remoção do banco é EXPLÍCITA
    // (dDeleteVarFromBackend) — assim um designer não apaga variáveis criadas por outro.
    await sb.schema('luma').from('variaveis').upsert(rows, { onConflict:'name' });
  }catch(e){ /* silencioso: o cache local já guardou */ }
}

// Remove UMA variável do Supabase (chamado na remoção/renomeação explícita). Só designer.
async function dDeleteVarFromBackend(name){
  const sb = (typeof gSupabase==='function') ? gSupabase() : window.sb;
  if(!sb || !name || typeof gIsAdmin!=='function' || !gIsAdmin()) return;
  try{ await sb.schema('luma').from('variaveis').delete().eq('name', name); }catch(e){}
}
// Carrega o catálogo do Supabase pro dVars (boot). Banco vazio + designer + catálogo
// local → faz a migração inicial (push).
async function dSyncVarsFromBackend(){
  const sb = (typeof gSupabase==='function') ? gSupabase() : window.sb;
  if(!sb) return;
  try{
    const { data, error }=await sb.schema('luma').from('variaveis').select('*').order('ordem',{ascending:true});
    if(error) return;
    if(Array.isArray(data) && data.length){
      // merge: o banco é a fonte, mas preserva (e sobe) vars locais ainda não sincronizadas
      const remote=data.map(_dRowToVar);
      const rnames=new Set(remote.map(v=>v.name));
      const extras=(dVars||[]).filter(v=>v&&v.name&&!rnames.has(v.name));
      dVars=[...remote, ...extras];
      if(typeof dFieldsEnsureMeta==='function') dFieldsEnsureMeta();
      try{ localStorage.setItem('yngs_vars_v1', JSON.stringify(dVars)); }catch(e){}
      if(extras.length && typeof gIsAdmin==='function' && gIsAdmin()) dPushVarsToBackend();
      if(typeof dVarsRender==='function') dVarsRender();
      if(typeof dRenderCanvas==='function' && document.body.classList.contains('mode-designer')) dRenderCanvas();
    } else if(typeof gIsAdmin==='function' && gIsAdmin() && Array.isArray(dVars) && dVars.length){
      await dPushVarsToBackend();
    }
  }catch(e){}
}
function dRestoreVars(){
  try{
    const saved=localStorage.getItem('yngs_vars_v1');
    if(saved){const parsed=JSON.parse(saved);if(Array.isArray(parsed)&&parsed.length){dVars=parsed;return true;}}
  }catch(e){}
  return false;
}
// Redesign "Dados": garante que todo campo tenha `category` (inferida). Idempotente.
// `example` fica opcional (ausente = "—"). Cobre seeds e catálogo restaurado.
function dFieldsEnsureMeta(){
  if(typeof dVars==='undefined'||!Array.isArray(dVars))return false;
  let changed=false;
  dVars.forEach(v=>{
    if(!v.category){ v.category=gFieldGuessCategory(v.name,v.type); changed=true; }
  });
  return changed;
}

// Layers que usam a variável: token {{name}} no content, imgVar, bindings ou regras. (V3)
// Sem bindings/rules na conta, "Remover" excluía sem aviso um campo que ainda
// controlava visibilidade/cor de camadas.
function dVarUsage(name){
  const ids=[];
  dLayers.forEach(l=>{
    let used=false;
    if(l.content){const re=gVarRegex();let m;while((m=re.exec(l.content))){if(m[1]===name){used=true;break;}}}
    if(l.imgVar===name)used=true;
    if(!used&&l.bindings&&Object.values(l.bindings).includes(name))used=true;
    if(!used&&Array.isArray(l.rules)&&l.rules.some(r=>r&&r.var===name))used=true;
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
  gToast('Destacando '+ids.length+' camada(s) que usam {{'+name+'}}');
}

/* ══════════════════════════════════════════════════════════════
   DADOS · Centro de Campos (redesign de variáveis — Fase 1)
   Lê dVars e renderiza cartões agrupados por categoria em #d-fields-list.
   Nada de {{name}} cru na tela: só rótulo, ícone e tipo amigável.
══════════════════════════════════════════════════════════════ */
let _dFieldsQuery='';
let _dFieldsCatCollapsed={}; // {catId:true} = categoria recolhida
let _dFieldsStatusFilter='all'; // 'all' | 'used' | 'free'
let _dFieldsOpen=null;          // name do campo com detalhe expandido (acordeão)
let _dFieldsDup={};             // name → rótulo do outro campo (possível duplicata)

function dFieldsFilter(q){ _dFieldsQuery=(q||'').trim().toLowerCase(); dFieldsRender(); }
function dFieldToggleCat(catId){ _dFieldsCatCollapsed[catId]=!_dFieldsCatCollapsed[catId]; dFieldsRender(); }
function dFieldSetStatusFilter(f){ _dFieldsStatusFilter=f; dFieldsRender(); }
function dFieldToggleOpen(name){ _dFieldsOpen=(_dFieldsOpen===name)?null:name; dFieldsRender(); }

// Nomes amigáveis dos layers que usam o campo (regra 4: "onde é usada").
function dFieldUsageNames(name){
  return dVarUsage(name).map(id=>{const l=dLayers.find(x=>x.id===id);return l?(l.name||gFieldTypeMeta(l.type).label):null;}).filter(Boolean);
}
// Versão com id: alimenta os chips de uso (clique → pisca a camada no canvas).
function dFieldUsageLayers(name){
  return dVarUsage(name).map(id=>{const l=dLayers.find(x=>x.id===id);return l?{id:id,name:(l.name||gFieldTypeMeta(l.type).label)}:null;}).filter(Boolean);
}
// Pisca UMA camada no canvas (chip de uso do detalhe).
function dFieldFlashLayer(id){
  const el=document.querySelector(`.canvas-layer[data-id="${id}"]`);
  if(!el){gToast('Camada não está visível no canvas');return;}
  el.classList.remove('var-flash');void el.offsetWidth;el.classList.add('var-flash');
  setTimeout(()=>el.classList.remove('var-flash'),900);
}
// Higiene: campos cujos rótulos colidem ignorando caixa/acentos ("produto" × "Produto").
function _dFieldNorm(s){return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/gi,'').toLowerCase();}
function _dFieldsBuildDup(){
  _dFieldsDup={};
  const map={};
  (dVars||[]).forEach(v=>{const k=_dFieldNorm(v.label||v.name);if(!k)return;(map[k]=map[k]||[]).push(v);});
  Object.keys(map).forEach(k=>{
    const g=map[k]; if(g.length<2)return;
    g.forEach(v=>{const other=g.find(x=>x!==v);if(other)_dFieldsDup[v.name]=other.label||other.name;});
  });
}

const _D_FIELD_WARN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';

// Linha compacta (fechada: nome + tipo + status) + detalhe sob demanda
// (aberto: exemplo, chips de uso clicáveis e ações). Acordeão de 1 aberto.
function dFieldCardHTML(v,i){
  const tm=gFieldTypeMeta(v.type);
  const usage=dFieldUsageLayers(v.name);
  const used=usage.length>0;
  const open=_dFieldsOpen===v.name;
  const dupOf=_dFieldsDup[v.name];
  const metaParts=[_dEsc(tm.label)];
  if(v.required)metaParts.push('<b>Obrigatório</b>');
  metaParts.push(used?`<b>${usage.length} uso${usage.length>1?'s':''}</b>`:'Não usada');
  const warn=dupOf?`<span class="field-row-warn" title="Possível duplicata de “${_dEsc(dupOf)}”">${_D_FIELD_WARN}</span>`:'';
  let det='';
  if(open){
    const exVal=(v.example!=null&&v.example!=='')?v.example:((v.defaultValue!=null&&v.defaultValue!=='')?v.defaultValue:'');
    const dupNote=dupOf?`<div class="field-dup-note">${_D_FIELD_WARN}<span>Possível duplicata de <b>“${_dEsc(dupOf)}”</b> — considere excluir este campo ou usar o outro.</span></div>`:'';
    const exLine=exVal?`<div class="field-det-ex">Ex.: <b>${_dEsc(exVal)}</b></div>`:'';
    const usoBlock=used
      ?`<div class="field-det-lbl">Usada em</div><div class="field-det-chips">${usage.map(u=>`<button class="field-uchip" onclick="event.stopPropagation();dFieldFlashLayer('${u.id}')" title="Destacar no canvas">${_dEsc(u.name)}</button>`).join('')}</div>`
      :`<div class="field-det-free">Ainda não aparece em nenhuma camada deste template.</div>`;
    const insLbl=(v.type==='image')?'＋ Usar em moldura':'＋ Inserir no texto';
    det=`<div class="field-det">
      ${dupNote}${exLine}${usoBlock}
      <div class="field-det-acts">
        <button class="field-act pri" onclick="event.stopPropagation();dFieldUse(${i})">${insLbl}</button>
        <button class="field-act" onclick="event.stopPropagation();dEditVar(${i})">Editar</button>
        <button class="field-act danger" onclick="event.stopPropagation();dRemoveVar(${i})">Excluir</button>
      </div>
    </div>`;
  }
  return `<div class="field-item${open?' open':''}" data-field="${v.name}">
    <div class="field-row" onclick="dFieldToggleOpen('${v.name}')" title="${open?'Fechar detalhes':'Ver detalhes'}">
      <span class="field-tico ft-${v.type||'text'}">${tm.svg||tm.icon}</span>
      <span class="field-row-mid">
        <span class="field-row-name"><span class="nm">${_dEsc(v.label||v.name)}</span>${warn}</span>
        <span class="field-row-meta">${metaParts.join(' · ')}</span>
      </span>
      <span class="field-row-end">
        <span class="field-sdot ${used?'used':'free'}"></span>
        <button class="field-card-menu" onclick="event.stopPropagation();dFieldMenu(event,${i})" title="Mais ações">⋯</button>
      </span>
    </div>
    ${det}
  </div>`;
}

function dFieldsEmptyHTML(){
  return `<div class="field-empty">
    <div class="field-empty-icon">🪄</div>
    <div class="field-empty-title">Campos trocam a informação sem mexer no layout.</div>
    <div class="field-empty-exs">
      <div class="field-empty-ex"><span>Produto</span><span class="field-empty-arrow">→</span><b>Nike Air Max</b></div>
      <div class="field-empty-ex"><span>Preço</span><span class="field-empty-arrow">→</span><b>R$ 399</b></div>
    </div>
    <button class="d-btn-pri" onclick="dOpenVarModal()" style="justify-content:center">+ Criar meu primeiro campo</button>
  </div>`;
}

// Chips de status (Todos / Em uso / Livres) — a pergunta pré-publicação.
function _dFieldsRenderChipbar(counts){
  const cb=document.getElementById('d-fields-chipbar');
  if(!cb) return;
  if(!counts){ cb.innerHTML=''; return; }
  const chip=(f,lbl,n)=>`<button class="field-chip${_dFieldsStatusFilter===f?' on':''}" onclick="dFieldSetStatusFilter('${f}')">${lbl} <span>${n}</span></button>`;
  cb.innerHTML=chip('all','Todos',counts.total)+chip('used','Em uso',counts.used)+chip('free','Livres',counts.free);
}
// Rodapé de inventário: o pulso do catálogo sem contar cartão.
function _dFieldsRenderInventory(counts){
  const inv=document.getElementById('d-fields-inventory');
  if(!inv) return;
  if(!counts){ inv.innerHTML=''; inv.style.display='none'; return; }
  inv.style.display='';
  inv.innerHTML=`<b>${counts.total} campo${counts.total!==1?'s':''}</b> · <span class="inv-dot used"></span> <b>${counts.used} em uso</b> · <span class="inv-dot free"></span> ${counts.free} livre${counts.free!==1?'s':''}`;
}

function dFieldsRender(){
  const el=document.getElementById('d-fields-list');
  if(!el){ dPopVarSel(); return; }
  dFieldsEnsureMeta();
  _dFieldsBuildDup();
  if(!dVars.length){
    el.innerHTML=dFieldsEmptyHTML();
    _dFieldsRenderChipbar(null); _dFieldsRenderInventory(null);
    dPopVarSel(); return;
  }

  const usedNames=new Set(dVars.filter(v=>dVarUsage(v.name).length>0).map(v=>v.name));
  const counts={total:dVars.length, used:usedNames.size, free:dVars.length-usedNames.size};
  _dFieldsRenderChipbar(counts);
  _dFieldsRenderInventory(counts);

  const q=_dFieldsQuery;
  const items=dVars.map((v,i)=>({v,i})).filter(({v})=>{
    if(_dFieldsStatusFilter==='used'&&!usedNames.has(v.name)) return false;
    if(_dFieldsStatusFilter==='free'&&usedNames.has(v.name)) return false;
    if(!q) return true;
    return (v.label||'').toLowerCase().includes(q)
      || (v.name||'').toLowerCase().includes(q)
      || (gFieldCatMeta(v.category).label||'').toLowerCase().includes(q)
      || (gFieldTypeMeta(v.type).label||'').toLowerCase().includes(q);
  });
  if(!items.length){
    let msg;
    if(q) msg=`Nenhum campo encontrado.<br><button class="field-create-q" onclick="dFieldCreateFromQuery()">Criar “${_dEsc(_dFieldsQuery)}”</button>`;
    else if(_dFieldsStatusFilter==='used') msg='Nenhum campo em uso neste template ainda.';
    else msg='Nenhum campo livre — todos estão em uso.';
    el.innerHTML=`<div class="field-noresult">${msg}</div>`;
    dPopVarSel(); return;
  }
  let html='';
  DFIELD_CATS.forEach(cat=>{
    const group=items.filter(({v})=>(v.category||'outros')===cat.id);
    if(!group.length) return;
    const collapsed=!!_dFieldsCatCollapsed[cat.id];
    html+=`<div class="field-cat">
      <div class="field-cat-head" onclick="dFieldToggleCat('${cat.id}')">
        <span class="field-cat-label">${cat.label.toUpperCase()}</span>
        <span class="field-cat-count">${group.length}</span>
        <svg class="field-cat-chev${collapsed?' collapsed':''}" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="field-cat-body"${collapsed?' style="display:none"':''}>
        ${group.map(({v,i})=>dFieldCardHTML(v,i)).join('')}
      </div>
    </div>`;
  });
  el.innerHTML=html;
  dPopVarSel();
}

// Compat: vários fluxos chamam dVarsRender() ao criar/editar/remover campos.
// Agora ela alimenta o centro de campos (cartões) + o select de inserção.
function dVarsRender(){ dFieldsRender(); }

// Ação primária do detalhe: insere o campo no texto selecionado — ou, para
// campos de imagem, aplica como imgVar da moldura/imagem selecionada.
function dFieldUse(i){
  const v=dVars[i]; if(!v) return;
  const l=dLayers.find(x=>x.id===dSelId);
  if(v.type==='image'){
    if(l && (l.type==='frame' || l.type==='image')){
      if(typeof dHistoryPush==='function') dHistoryPush();
      l.imgVar=v.name;
      dActivatePanel('camadas');
      dSelLayer(l.id);
      dRenderCanvas(); dMarkUnsaved();
      gToast('✓ Campo “'+(v.label||v.name)+'” aplicado na moldura');
    } else {
      gToast('Selecione uma moldura ou imagem na aba Camadas e tente de novo.');
    }
    return;
  }
  if(l && l.type==='text'){
    if(typeof dHistoryPush==='function') dHistoryPush();
    l.content=((l.content||'')+' {{'+v.name+'}}').replace(/^\s+/,'');
    dActivatePanel('camadas');
    dSelLayer(l.id);
    dRenderCanvas(); dMarkUnsaved();
    gToast('✓ Campo “'+(v.label||v.name)+'” inserido no texto');
  } else {
    gToast('Selecione um texto na aba Camadas e tente de novo.');
  }
}

// Abre o modal de novo campo já preenchido com o termo buscado.
function dFieldCreateFromQuery(){
  const q=_dFieldsQuery;
  dOpenVarModal();
  if(q){
    const lab=document.getElementById('dv-label'); if(lab) lab.value=q.charAt(0).toUpperCase()+q.slice(1);
    const nm=document.getElementById('dv-name'); if(nm) nm.value=gFieldSlugify(q, dVars.map(v=>v.name));
  }
}

// Onboarding (regra 6): após criar o 1º campo, ensina a usá-lo (1×, persistido).
function dFieldOnboardMaybe(){
  try{
    if(localStorage.getItem('yngs_fields_onboard_v1')) return;
    localStorage.setItem('yngs_fields_onboard_v1','1');
    setTimeout(()=>gToast('Agora selecione um texto na aba Camadas e clique em “usar” para inserir o campo.'),900);
  }catch(e){}
}

// Menu "⋯" do cartão: editar / renomear / onde é usada / remover.
function dFieldMenu(ev,i){
  const v=dVars[i]; if(!v) return;
  document.querySelectorAll('.field-menu-pop').forEach(p=>p.remove());
  const pop=document.createElement('div'); pop.className='field-menu-pop';
  const mk=(label,fn,cls)=>{const b=document.createElement('button');b.textContent=label;if(cls)b.className=cls;b.onmousedown=(e)=>{e.preventDefault();e.stopPropagation();pop.remove();document.removeEventListener('mousedown',close);fn();};return b;};
  pop.appendChild(mk('Editar',()=>dEditVar(i)));
  pop.appendChild(mk('Renomear',()=>dRenameVar(i)));
  pop.appendChild(mk('Onde é usada',()=>dHighlightVarLayers(v.name)));
  pop.appendChild(mk('Remover',()=>dRemoveVar(i),'field-menu-del'));
  document.body.appendChild(pop);
  const r=ev.currentTarget.getBoundingClientRect();
  pop.style.top=(r.bottom+4)+'px';
  pop.style.left=Math.min(r.left, window.innerWidth-pop.offsetWidth-8)+'px';
  function close(e){ if(!pop.contains(e.target)){ pop.remove(); document.removeEventListener('mousedown',close); } }
  setTimeout(()=>document.addEventListener('mousedown',close),0);
}
// Mostra/oculta os campos de opções (select) e paleta (color) conforme o tipo escolhido (4.1)
function dVarTypeFields(){
  const t=document.getElementById('dv-type').value;
  const of=document.getElementById('dv-options-field');
  const pf=document.getElementById('dv-palette-field');
  if(of)of.style.display=(t==='select')?'':'none';
  if(pf)pf.style.display=(t==='color')?'':'none';
}
/* ── Wizard de campo (Fase 2): 2 passos conversacionais ── */
// Grade de tipos com ícone + rótulo humano (data-driven de DFIELD_TYPES).
function dFieldRenderTypeGrid(activeType){
  const grid=document.getElementById('dv-type-grid'); if(!grid) return;
  grid.innerHTML=Object.keys(DFIELD_TYPES).map(t=>{
    const m=DFIELD_TYPES[t];
    return `<button type="button" class="field-type-card${t===activeType?' active':''}" data-type="${t}" onclick="dFieldPickType('${t}',this)">
      <span class="field-type-ico">${m.icon}</span>
      <span class="field-type-lbl">${_dEsc(m.label)}</span>
    </button>`;
  }).join('');
}
function dFieldPickType(type, el){
  const hid=document.getElementById('dv-type'); if(hid) hid.value=type;
  document.querySelectorAll('#dv-type-grid .field-type-card').forEach(c=>c.classList.toggle('active', c===el));
  dVarTypeFields(); // revela opções (lista) / paleta (cor)
}
function dFieldWizardGoStep(n){
  const s1=document.getElementById('dv-step-1'), s2=document.getElementById('dv-step-2');
  if(s1) s1.style.display=(n===1)?'':'none';
  if(s2) s2.style.display=(n===2)?'':'none';
}
function dFieldWizardNext(){
  const labEl=document.getElementById('dv-label');
  const label=(labEl.value||'').trim();
  if(!label){ gToast('⚠ Dê um nome ao campo'); labEl.focus(); return; }
  const q2=document.getElementById('dv-q2'); if(q2) q2.textContent='Que tipo de informação é “'+label+'”?';
  dFieldWizardGoStep(2);
}
function dFieldWizardBack(){
  dFieldWizardGoStep(1);
  setTimeout(()=>{const el=document.getElementById('dv-label'); if(el){el.focus();el.select();}},60);
}
function dFieldToggleDetails(){
  const d=document.getElementById('dv-details'), t=document.getElementById('dv-details-toggle');
  if(!d) return;
  const open=(d.style.display==='none');
  d.style.display=open?'':'none';
  if(t) t.classList.toggle('open', open);
}
// Tipo provável a partir do texto de exemplo da camada ("R$ 19,90" → preço, "99" → número)
function _dGuessTypeFromText(s){
  s=String(s||'').trim();
  if(/^r\$\s*[\d.,]+$/i.test(s)||/^\d{1,4},\d{2}$/.test(s)) return 'currency';
  if(/^\d+$/.test(s)) return 'number';
  return 'text';
}
// opts.forLayer: fluxo "criar E vincular" — o wizard nasce pré-preenchido com o texto
// da camada (rótulo/tipo/exemplo) e, ao confirmar, liga o campo novo à camada.
// É o modelo mental do designer: escreve o exemplo na arte → marca como editável.
let dVarBindAfterCreate=null;
function dOpenVarModal(opts){
  opts=opts||{};
  dEditingVarName=null;
  dVarBindAfterCreate=opts.forLayer||null;
  // Pré-preenchimento a partir da camada apontada
  let preLabel='', preExample='', preType='text';
  if(opts.forLayer){
    const l=dLayers.find(x=>x.id===opts.forLayer);
    if(l&&l.type==='text'){
      const txt=(l.content||'').trim();
      if(txt && !gVarRegex().test(txt)){ // texto puro (sem tokens) vira exemplo + rótulo
        preExample=txt.replace(/\s+/g,' ').slice(0,60);
        preLabel=txt.split('\n')[0].trim().slice(0,28);
        preType=_dGuessTypeFromText(txt);
      }
    } else if(l&&(l.type==='image'||l.type==='frame')){ preType='image'; }
  }
  // Texto digitado na busca do picker vira o rótulo inicial (vence o derivado da camada).
  if(opts.label) preLabel=String(opts.label).slice(0,28);
  const m=document.getElementById('d-var-modal');
  document.getElementById('dv-title').textContent='Novo campo';
  document.getElementById('dv-name').value='';
  document.getElementById('dv-name').disabled=false;
  document.getElementById('dv-type').value=preType;
  document.getElementById('dv-label').value=preLabel;
  document.getElementById('dv-default').value='';
  document.getElementById('dv-req').checked=false;
  document.getElementById('dv-options').value='';
  document.getElementById('dv-palette').value='';
  const catEl=document.getElementById('dv-cat'); if(catEl)catEl.value='';
  const exEl=document.getElementById('dv-example'); if(exEl)exEl.value=preExample;
  dFieldRenderTypeGrid(preType);
  dVarTypeFields();
  // Com exemplo pré-preenchido, mostra os "Detalhes" — o designer vê o que veio da camada
  const hasPre=preExample!=='';
  const det=document.getElementById('dv-details'); if(det) det.style.display=hasPre?'':'none';
  const dt=document.getElementById('dv-details-toggle'); if(dt) dt.classList.toggle('open',hasPre);
  document.getElementById('dv-confirm-btn').textContent=dVarBindAfterCreate?'Criar e ligar à camada':'Criar campo';
  dFieldWizardGoStep(1);
  m.classList.add('open');
  setTimeout(()=>{const el=document.getElementById('dv-label');if(el){el.focus();el.select();}},100);
}
function dEditVar(i){
  const v=dVars[i];if(!v)return;
  dEditingVarName=v.name;
  const m=document.getElementById('d-var-modal');
  document.getElementById('dv-title').textContent='Editar campo';
  const nameInp=document.getElementById('dv-name');
  nameInp.value=v.name;
  nameInp.disabled=true; // nome muda só via renomear (find/replace nos layers)
  document.getElementById('dv-type').value=v.type||'text';
  document.getElementById('dv-label').value=v.label||'';
  document.getElementById('dv-default').value=v.defaultValue||'';
  document.getElementById('dv-req').checked=!!v.required;
  document.getElementById('dv-options').value=(v.options||[]).join('\n');
  document.getElementById('dv-palette').value=(v.palette||[]).join(', ');
  const catEl=document.getElementById('dv-cat'); if(catEl)catEl.value=v.category||'';
  const exEl=document.getElementById('dv-example'); if(exEl)exEl.value=v.example||'';
  dFieldRenderTypeGrid(v.type||'text');
  dVarTypeFields();
  // Abre os "Detalhes" só se já houver algo preenchido lá.
  const hasDetails=(!!v.example&&v.example!=='')||(!!v.defaultValue&&v.defaultValue!=='')||!!v.required;
  const det=document.getElementById('dv-details'); if(det) det.style.display=hasDetails?'':'none';
  const dt=document.getElementById('dv-details-toggle'); if(dt) dt.classList.toggle('open', hasDetails);
  const q2=document.getElementById('dv-q2'); if(q2) q2.textContent='Que tipo de informação é “'+(v.label||v.name)+'”?';
  document.getElementById('dv-confirm-btn').textContent='Salvar';
  dFieldWizardGoStep(2); // edição entra direto no tipo; "Voltar" permite ajustar o rótulo
  m.classList.add('open');
  setTimeout(()=>{const el=document.getElementById('dv-example'); if(el) el.focus();},100);
}
function dCloseVarModal(){dEditingVarName=null;dVarBindAfterCreate=null;document.getElementById('dv-name').disabled=false;document.getElementById('d-var-modal').classList.remove('open');}
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
  const catSel=(document.getElementById('dv-cat')||{}).value||'';
  const example=((document.getElementById('dv-example')||{}).value||'').trim();
  // Edição: nome travado, atualiza só os atributos
  if(dEditingVarName){
    const v=dVars.find(x=>x.name===dEditingVarName);
    if(v){
      v.type=type;v.label=label||v.name;v.required=req;
      v.category=catSel||gFieldGuessCategory(v.name,type);
      if(example!=='')v.example=example;else delete v.example;
      if(def!=='')v.defaultValue=def;else delete v.defaultValue;
      if(type==='select')v.options=options;else delete v.options;
      if(type==='color')v.palette=palette;else delete v.palette;
    }
    dCloseVarModal();dVarsRender();dPersistVars();dRenderCanvas();
    gToast('✓ Campo “'+(v?(v.label||v.name):'')+'” atualizado');
    return;
  }
  // Criação — o nome técnico (slug) é derivado do rótulo se não for informado.
  let name=document.getElementById('dv-name').value.trim();
  if(!name && label) name=gFieldSlugify(label, dVars.map(v=>v.name));
  if(!name){gToast('⚠ Dê um nome ao campo');return;}
  if(!gValidVarName(name)){gToast('⚠ Use só letras, números e _ (sem espaço/acento)');return;}
  if(dVars.find(v=>v.name.toLowerCase()===name.toLowerCase())){gToast('⚠ Já existe um campo com esse nome');return;}
  const nv={name,type,label:label||name,required:req,category:catSel||gFieldGuessCategory(name,type)};
  if(example!=='')nv.example=example;
  if(def!=='')nv.defaultValue=def;
  if(type==='select')nv.options=options;
  if(type==='color')nv.palette=palette;
  dVars.push(nv);
  const bindTo=dVarBindAfterCreate; // captura antes do close (que zera o stash)
  dCloseVarModal();dVarsRender();dPersistVars();
  if(bindTo&&typeof dLayerBindField==='function'){
    dLayerBindField(bindTo,name); // já dá o toast "camada agora mostra X"
  } else {
    gToast('✓ Campo “'+(label||name)+'” criado');
  }
  dFieldOnboardMaybe();
}
function dRemoveVar(i){
  const v=dVars[i];if(!v)return;
  // V3: avisa/bloqueia remoção de var em uso
  const usage=dVarUsage(v.name);
  if(usage.length && !confirm(`A variável {{${v.name}}} está em uso em ${usage.length} layer(s). Remover do catálogo mesmo assim? (os tokens {{${v.name}}} continuam nos layers como texto)`))return;
  if(typeof dDeleteVarFromBackend==='function') dDeleteVarFromBackend(v.name);
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
  // find/replace nos layers (tokens {{old}} → {{novo}}, imgVar, bindings e regras —
  // sem bindings/rules, renomear deixava vínculos apontando pra um nome morto)
  const reTok=new RegExp('\\{\\{\\s*'+old.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*\\}\\}','g');
  dLayers.forEach(l=>{
    if(l.content)l.content=l.content.replace(reTok,'{{'+novo+'}}');
    if(l.imgVar===old)l.imgVar=novo;
    if(l.bindings)Object.keys(l.bindings).forEach(k=>{if(l.bindings[k]===old)l.bindings[k]=novo;});
    if(Array.isArray(l.rules))l.rules.forEach(r=>{if(r&&r.var===old)r.var=novo;});
  });
  v.name=novo;
  dVarsRender();dRenderCanvas();dMarkUnsaved();dPersistVars();
  if(typeof dDeleteVarFromBackend==='function') dDeleteVarFromBackend(old); // remove o nome antigo do banco
  gToast('✓ Renomeada para {{'+novo+'}} (camadas atualizadas)');
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
  // nome/url vêm do usuário (e do sync) → escape obrigatório; url restrita a
  // protocolos de imagem seguros (nada de javascript: em src)
  const _safeUrl=u=>(typeof u==='string'&&/^(data:image\/|blob:|https?:\/\/|assets\/)/i.test(u))?u:'';
  document.getElementById('d-assets-grid').innerHTML=dAssets.map((a,i)=>`
    <div class="asset-thumb" onclick="dUseAsset(${i})" title="${_dEsc(a.name||'')}">
      ${_safeUrl(a.url)?`<img src="${_dEsc(_safeUrl(a.url))}" alt="${_dEsc(a.name||'')}">`:`<span style="font-size:26px">${_dEsc(a.emoji||'')}</span>`}
      <span class="asset-name">${_dEsc(a.name||'')}</span>
    </div>`).join('');
}
function dHandleUpload(inp){ dLibUpload(inp); }
function dUseAsset(i){
  const a=dAssets[i];if(!a.url){gToast('Asset sem URL');return;}
  const l=dLayers.find(x=>x.id===dSelId&&(x.type==='image'||x.type==='frame'));
  if(!l){gToast('Selecione uma camada de imagem ou moldura primeiro');return;}
  l.imgUrl=a.url;dRenderCanvas();
  const urlInp=document.getElementById('dp-imgurl');if(urlInp)urlInp.value=a.url;
  gToast('✓ "'+a.name+'" aplicado');
}

/* ── SAVE / PREVIEW ── */
function dSave(){
  // Sincronizar layers editados de volta pro artboard ativo antes de salvar
  if(typeof dSyncLayersToAB==='function')dSyncLayersToAB();
  if(dActiveTmplId){
    // Sincroniza w/h/fmt SÓ p/ pranchetas de tamanho custom (1:1 do PSD, fmt sem preset DFMT),
    // pra não mexer no dimensionamento de templates padrão (preserva comportamento legado).
    const _ab=(typeof dGetActiveAB==='function')?dGetActiveAB():null;
    const _custom=!!(_ab && typeof DFMT_SIZES!=='undefined' && !DFMT_SIZES[_ab.fmt] && _ab.w>0 && _ab.h>0);
    dFolders.forEach(f=>f.templates.forEach(t=>{if(t.id===dActiveTmplId){
      t.layers=JSON.parse(JSON.stringify(dLayers));
      // Fundo do canvas acompanha o save — mudar o bg no editor não chegava na arte
      // final (o franqueado renderiza t.bg) até uma republicação.
      if(_ab && _ab.bg!==undefined) t.bg=_ab.bg;
      if(_custom){ t.fmt=_ab.fmt; t.w=_ab.w; t.h=_ab.h; }
    }}));
  }
  const hadImgWarn=gImgPersistWarned;
  if(typeof dSetSaveState==='function')dSetSaveState('saving'); // M2.2
  const okF=dPersistFolders();
  const okA=(typeof dPersistArtboards==='function')?dPersistArtboards():true;
  if(!(okF&&okA)){ if(typeof dSetSaveState==='function')dSetSaveState('unsaved'); return; } // erro já exibido
  const saveBtn=document.querySelector('.d-btn-pri[onclick="dSave()"]');
  if(saveBtn){saveBtn.classList.add('save-success');setTimeout(()=>saveBtn.classList.remove('save-success'),2000);}
  if(typeof dSetSaveState==='function')dSetSaveState('saved'); // limpa dDirty + mostra "Guardado"
  if(typeof dRenderPagesTray==='function')dRenderPagesTray();
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
    // Sincroniza pastas/templates + imagens com o Supabase em background (só designer).
    if(typeof dPushFoldersToBackend==='function') dPushFoldersToBackend();
    return true;
  }catch(e){
    if(e&&(e.name==='QuotaExceededError'||e.code===22))
      gToast('⚠ Não foi possível salvar: armazenamento cheio. Remova templates ou imagens e tente de novo.','error');
    else gToast('⚠ Erro ao salvar o template.','error');
    return false;
  }
}

/* ── Sync de pastas/templates com o Supabase (luma.pastas + luma.templates) ──
   Offline-first: localStorage é cache; o Supabase é a fonte. Imagens (capa + layers)
   sobem pro Storage e viram URL no JSON. Cada pasta/template ganha um `remoteId` (UUID)
   usado como PK no banco — sem mexer no `id` interno nem nas referências do app. */
let _dFoldersPushTimer=null;
function dPushFoldersToBackend(){
  // debounce: agrupa saves rápidos num único sync
  if(_dFoldersPushTimer) clearTimeout(_dFoldersPushTimer);
  _dFoldersPushTimer=setTimeout(()=>{ _dFoldersPushTimer=null; _dPushFoldersNow(); }, 1200);
}
// Sobe um data:URL pro Storage e devolve a URL pública (ou null em falha).
async function _dUploadDataUrl(bucket, path, dataUrl){
  const sb=(typeof gSupabase==='function')?gSupabase():window.sb;
  if(!sb || typeof dataUrl!=='string' || !dataUrl.startsWith('data:')) return null;
  try{
    const blob=await (await fetch(dataUrl)).blob();
    const ext=((blob.type.split('/')[1]||'png').split('+')[0]).replace(/[^a-z0-9]/gi,'')||'png';
    const full=path+'.'+ext;
    const { error }=await sb.storage.from(bucket).upload(full, blob, {upsert:true, contentType:blob.type||'image/png'});
    if(error) return null;
    return sb.storage.from(bucket).getPublicUrl(full).data.publicUrl;
  }catch(e){ return null; }
}
// Sobe as imagens base64 dos layers pro Storage, trocando por URL no próprio objeto.
async function _dUploadLayerImages(layers, tid){
  if(!Array.isArray(layers)) return layers||[];
  for(const l of layers){
    if(!l) continue;
    
    // 1. Upload imgUrl (se existir)
    if(typeof l.imgUrl==='string'){
      let dataUrl=null;
      if(l.imgUrl.startsWith('data:')) dataUrl=l.imgUrl;
      else if(l.imgUrl.indexOf('idb://')===0 && typeof gResolveImgUrl==='function'){
        const real=await gResolveImgUrl(l.imgUrl);
        if(real && typeof real==='string' && real.startsWith('data:')) dataUrl=real;
      }
      if(dataUrl){
        const url=await _dUploadDataUrl('luma-template-assets', tid+'/'+(l.id!=null?l.id:Math.random().toString(36).slice(2)), dataUrl);
        if(url) l.imgUrl=url; // sucesso → URL pública (leve, cross-device); falha → mantém idb:///data: original
      }
    }

    // 2. Upload mask (se existir)
    if(typeof l.mask==='string' && l.mask.startsWith('data:')){
      const url=await _dUploadDataUrl('luma-template-assets', tid+'/mask_'+(l.id!=null?l.id:Math.random().toString(36).slice(2)), l.mask);
      if(url) l.mask=url; // substitui a pesada string Base64 pela URL levinha da nuvem
    }
  }
  return layers;
}
function _dUuid(p){ return (crypto&&crypto.randomUUID)?crypto.randomUUID():(p+'-'+Date.now()+Math.random().toString(36).slice(2)); }
async function _dPushFoldersNow(){
  const sb=(typeof gSupabase==='function')?gSupabase():window.sb;
  if(!sb || typeof gIsAdmin!=='function' || !gIsAdmin()) return;
  try{
    for(const f of (dFolders||[])){
      if(!f.remoteId) f.remoteId=_dUuid('p');
      if(typeof f.cover==='string' && f.cover.startsWith('data:')){
        const cu=await _dUploadDataUrl('luma-covers', f.remoteId+'/cover', f.cover);
        if(cu) f.cover=cu;
      }
      const coverUrl=(typeof f.cover==='string' && !f.cover.startsWith('data:') && f.cover!=='__local__') ? f.cover : null;
      await sb.schema('luma').from('pastas').upsert({
        id:f.remoteId, nome:f.name||'(sem nome)', cor:f.color||null, camp_id:f.campId||null,
        cover_url:coverUrl, badge:f.badge||'', expira_dias:f.expiraDias||7, popular:!!f.popular,
        preview_prod:f.previewProd||'', preview_de:f.previewDe||'', preview_por:f.previewPor||'',
        perguntas:f.perguntas||[], grupos:f.grupos||['Todos os usuários'], ativa:true
      }, {onConflict:'id'});
      for(const t of (f.templates||[])){
        // Catálogo leve: template sem layers baixados (cache de sessão franqueado) —
        // upsert aqui gravaria layers:[] no banco e DESTRUIRIA o template. Nunca subir.
        if(t._needsLayersFetch) continue;
        if(!t.remoteId) t.remoteId=_dUuid('t');
        await _dUploadLayerImages(t.layers, t.remoteId);
        // Se alguma imagem/máscara AINDA está local (upload falhou: bucket/RLS/sem rede),
        // NÃO grava no banco — base64 vira MB por linha e todo mundo re-baixa. O template
        // fica marcado pendente (badge na topbar) e re-tenta no próximo save ou clique.
        const localBin=(t.layers||[]).some(l=>l&&(
          (typeof l.imgUrl==='string'&&(l.imgUrl.startsWith('data:')||l.imgUrl.indexOf('idb://')===0))||
          (typeof l.mask==='string'&&l.mask.startsWith('data:'))
        ));
        if(localBin){ t._syncPending=true; continue; }
        const pm=t.publishMeta||{};
        const { error }=await sb.schema('luma').from('templates').upsert({
          id:t.remoteId, pasta_id:f.remoteId, nome:t.name||'(sem nome)', fmt:t.fmt||'story',
          formats:t.formats||['story','feed','wide'], layers:t.layers||[],
          // Tamanho real do template (essencial p/ PSD 'orig', que não tem preset em DFMT_SIZES):
          w:(t.w>0?t.w:null), h:(t.h>0?t.h:null), bg:t.bg||null,
          publicado:!!pm.publicado, publicado_em:pm.publicadoEm?new Date(pm.publicadoEm).toISOString():null,
          validade:pm.validade||null, instrucoes:pm.instrucoes||'', permissoes:pm.permissoes||{}
        }, {onConflict:'id'});
        t._syncPending=!!error; // erro de rede/RLS no upsert também conta como pendente
      }
    }
    // re-salva o cache local com os remoteId/URLs recém-atribuídos (imagens já são URLs → leve)
    try{ localStorage.setItem('yngs_folders_v1', JSON.stringify(dFolders)); }catch(e){}
  }catch(e){ /* silencioso: o cache local já guardou */ }
  finally{ if(typeof gSyncBadgeUpdate==='function') gSyncBadgeUpdate(); }
}

/* ── Badge "não sincronizado" (topbar do designer) ──
   Conta templates com _syncPending (imagem não subiu pro Storage ou upsert falhou).
   O trabalho existe SÓ neste navegador até sincronizar — sem este aviso, o designer
   descobria semanas depois (ou nunca). Clique = tentar de novo na hora. */
let _dLastPendCount=0;
function gSyncBadgeUpdate(){
  const n=(typeof dFolders!=='undefined'&&dFolders||[]).reduce((a,f)=>a+((f.templates||[]).filter(t=>t&&t._syncPending).length),0);
  let el=document.getElementById('g-sync-pending');
  if(!el){
    if(!n){ _dLastPendCount=0; return; }
    const anchor=document.getElementById('d-save-indicator');
    if(!anchor||!anchor.parentNode) return;
    el=document.createElement('button');
    el.id='g-sync-pending';
    el.type='button';
    el.title='Estes materiais ainda NÃO subiram para o servidor — existem só neste navegador e os franqueados não os veem. Clique para tentar sincronizar de novo.';
    el.style.cssText='margin-left:8px;padding:2px 10px;border-radius:999px;border:1px solid rgba(245,158,11,.55);background:rgba(245,158,11,.14);color:#b45309;font-size:11px;font-weight:700;cursor:pointer;vertical-align:middle';
    el.onclick=()=>{ gToast('Tentando sincronizar de novo…'); _dPushFoldersNow(); };
    anchor.parentNode.insertBefore(el, anchor.nextSibling);
  }
  el.style.display=n?'':'none';
  if(n) el.textContent='⟳ '+n+' não sincronizado'+(n>1?'s':'');
  // Avisa em voz alta quando ALGO NOVO deixou de subir (não repete a cada save)
  if(n>_dLastPendCount) gToast('⚠ '+n+' material(is) não subiram pro servidor — os franqueados não os veem. Veja o aviso laranja na barra.','error');
  _dLastPendCount=n;
}

/* ── LEITURA: carrega o catálogo (pastas + templates) do Supabase no boot ──
   Banco é a fonte; preserva pastas locais ainda não sincronizadas (merge). */
function _dRowToTemplate(t){
  return {
    id:t.id, remoteId:t.id, name:t.nome||'(sem nome)', fmt:t.fmt||'story',
    formats:Array.isArray(t.formats)?t.formats:['story','feed','wide'],
    // Tamanho real vem do banco (sync leve). Templates antigos têm NULL → dLoadTemplate
    // cai no preset do fmt (comportamento atual); republicar grava o tamanho correto.
    w:(typeof t.w==='number'&&t.w>0)?t.w:undefined,
    h:(typeof t.h==='number'&&t.h>0)?t.h:undefined,
    bg:t.bg||undefined,
    layers:Array.isArray(t.layers)?t.layers:[],
    _needsLayersFetch: t.layers===undefined, // lazy: a coluna não veio no sync — fetch sob demanda
    publishMeta:{
      publicado:!!t.publicado,
      publicadoEm:t.publicado_em?new Date(t.publicado_em).getTime():null,
      validade:t.validade||'',
      instrucoes:t.instrucoes||'',
      permissoes:(t.permissoes&&typeof t.permissoes==='object')?t.permissoes:{}
    }
  };
}
function _dRowToFolder(p, templates){
  return {
    id:p.id, remoteId:p.id, name:p.nome||'(sem nome)', color:p.cor||'', campId:p.camp_id||'',
    cover:p.cover_url||'', badge:p.badge||'', expiraDias:p.expira_dias||7, popular:!!p.popular,
    previewProd:p.preview_prod||'', previewDe:p.preview_de||'', previewPor:p.preview_por||'',
    perguntas:Array.isArray(p.perguntas)?p.perguntas:[],
    grupos:Array.isArray(p.grupos)?p.grupos:['Todos os usuários'],
    agendamento:null, templates:templates||[]
  };
}
async function dSyncFoldersFromBackend(){
  const sb=(typeof gSupabase==='function')?gSupabase():window.sb;
  if(!sb) return;
  try{
    const { data:rp, error:e1 }=await sb.schema('luma').from('pastas').select('*').order('ordem',{ascending:true});
    if(e1 || !Array.isArray(rp) || !rp.length) return; // banco vazio → mantém local (push migra)
    // Lazy Load: exclui propositalmente a coluna `layers` pesada do download em lote no boot.
    // Os layers descem sob demanda: dLoadTemplate (designer) / fEnsureMaterialLayers (franqueado).
    const { data:rt }=await sb.schema('luma').from('templates').select('id, pasta_id, nome, fmt, formats, w, h, bg, publicado, publicado_em, validade, instrucoes, permissoes');
    const byPasta={};
    (rt||[]).forEach(t=>{ (byPasta[t.pasta_id]=byPasta[t.pasta_id]||[]).push(_dRowToTemplate(t)); });
    const remote=rp.map(p=>_dRowToFolder(p, byPasta[p.id]||[]));
    // merge: banco manda; preserva pastas locais sem correspondente (por remoteId ou campId)
    const rIds=new Set(remote.map(f=>f.remoteId));
    const rCamps=new Set(remote.map(f=>f.campId).filter(Boolean));
    const extras=(dFolders||[]).filter(f=>{
      if(f.remoteId && rIds.has(f.remoteId)) return false;
      if(f.campId && rCamps.has(f.campId)) return false;
      return true;
    });
    // Trabalho local ainda NÃO sincronizado (_syncPending) não pode ser engolido pelo
    // "banco manda": sem isto, um reload descartaria o template que falhou em subir.
    (dFolders||[]).forEach(lf=>{
      const pend=(lf.templates||[]).filter(t=>t&&t._syncPending);
      if(!pend.length) return;
      const rf=remote.find(f=>f.remoteId===lf.remoteId)||remote.find(f=>f.campId&&f.campId===lf.campId);
      if(!rf) return; // pasta local-only já sobrevive via extras
      pend.forEach(pt=>{
        const i=rf.templates.findIndex(x=>x&&(x.id===pt.id||(pt.remoteId&&x.remoteId===pt.remoteId)));
        if(i>=0) rf.templates[i]=pt; else rf.templates.push(pt);
      });
    });
    dFolders=[...remote, ...extras];
    try{ localStorage.setItem('yngs_folders_v1', JSON.stringify(dFolders)); }catch(e){}
    if(typeof dRenderFolders==='function') dRenderFolders();
    if(typeof fGetCampaigns==='function' && typeof fRenderCatalogs==='function'){
      try{ const{ativas,outras}=fGetCampaigns(); fRenderCatalogs(ativas,outras); }catch(e){}
    }
    if(typeof gHydrateFolders==='function') gHydrateFolders(dFolders); // re-hidrata idb:// (cache local)
    if(typeof gSyncBadgeUpdate==='function') gSyncBadgeUpdate(); // pendências persistidas reaparecem no boot
  }catch(e){}
}


/* ══ MULTI-SELECT & GROUPS ══ */
let dMultiSel = []; // array de layer IDs

function dToggleMultiSel(id){
  // dMultiSel é o conjunto COMPLETO da seleção. O layer primário (dSelId) precisa estar
  // dentro dele — senão ao arrastar o grupo ele ficaria pra trás. Por isso, ao iniciar uma
  // multi-seleção via Shift, o primário atual entra no conjunto antes de alternar.
  if(dSelId!=null && dSelId!==id && !dMultiSel.includes(dSelId)) dMultiSel.push(dSelId);
  const i=dMultiSel.indexOf(id);
  const l=dLayers.find(x=>x.id===id);
  if(i>-1){
    dMultiSel.splice(i,1);                                   // Shift+click num já-selecionado → remove
    if(l && l.type==='group'){
      dLayers.forEach(x=>{if(x.parentId===id){ const ci=dMultiSel.indexOf(x.id); if(ci>-1)dMultiSel.splice(ci,1); }});
    }
    if(dSelId===id) dSelId = dMultiSel.length ? dMultiSel[dMultiSel.length-1] : null;
  } else {
    dMultiSel.push(id);
    if(l && l.type==='group'){
      dLayers.forEach(x=>{if(x.parentId===id && !dMultiSel.includes(x.id)) dMultiSel.push(x.id);});
    }
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
  if(ids.length<2){gToast('⚠ Selecione 2 ou mais camadas para agrupar');return;}
  
  const childIds = ids.filter(id => {
    const l = dLayers.find(x => x.id === id);
    return l && l.type !== 'group';
  });
  if(childIds.length < 2) {
    gToast('⚠ Selecione 2 ou mais camadas para agrupar');
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

  // Grupos antigos cujos filhos migraram pro grupo novo ficam vazios → remove
  // (senão o "Grupo N" órfão sobrevive na lista e no save)
  dLayers = dLayers.filter(g => g.type!=='group' || g.id===groupId || dLayers.some(c=>c.parentId===g.id));

  gToast('✓ '+childIds.length+' camadas agrupadas');
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
    gToast('⚠ Selecione um grupo ou uma camada dentro de um grupo para desagrupar');
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
    const n=Math.max(3,Math.min(20,Math.round(l.sides||6))),pts=[];
    for(let i=0;i<n;i++){const a=-Math.PI/2+i*2*Math.PI/n;pts.push([0.5+0.5*Math.cos(a),0.5+0.5*Math.sin(a)]);}
    return pts;
  }
  if(kind==='star'){
    const n=Math.max(3,Math.min(20,Math.round(l.points||5))),inner=Math.max(0.05,Math.min(0.95,(l.inner!=null?l.inner:0.5))),pts=[];
    for(let i=0;i<n*2;i++){const r=(i%2===0)?0.5:0.5*inner;const a=-Math.PI/2+i*Math.PI/n;pts.push([0.5+r*Math.cos(a),0.5+r*Math.sin(a)]);}
    return pts;
  }
  return null;
}
// Cria uma forma nativa editável (círculo/elipse/triângulo/polígono/estrela)
function dAddShapeKind(kind, x, y, customW, customH){
  const f=dCanvasSize();const id='l-'+(++dLyrCnt);
  const names={circle:'Círculo',ellipse:'Elipse',triangle:'Triângulo',polygon:'Polígono',star:'Estrela'};
  dHistoryPush();
  const sz=Math.round(Math.min(f.w,f.h)*.22);
  const w=(customW!=null)?customW:((kind==='ellipse')?Math.round(sz*1.5):sz);
  const h=(customH!=null)?customH:sz;
  const cx = (x!=null)?x:Math.round(f.w/2-w/2);
  const cy = (y!=null)?y:Math.round(f.h/2-h/2);
  const base={id,name:(names[kind]||'Forma')+' '+dLyrCnt,type:'shape',shapeKind:kind,
    x:cx,y:cy,w,h,fill:'#FF9000',opacity:100,radius:0,visible:true};
  if(kind==='polygon')base.sides=6;
  if(kind==='star'){base.points=5;base.inner=0.5;}
  dLayers.push(base);
  dSelLayerState(id);dRenderCanvas();dRenderLayersList();dStats();dMarkUnsaved();dSetTool('select');
  setTimeout(()=>dFlashLayer(id),30);
  gToast((names[kind]||'Forma')+' adicionada');
}

/* ── Resize handle: arrasta para ajustar altura do painel de camadas ── */
(function(){
  const KEY='dp-lyr-h';
  const MIN_H=80,MAX_RATIO=0.72;

  function _applyH(h){
    const r=document.getElementById('d-right');
    if(r) r.style.setProperty('--d-lyr-h',h+'px');
  }

  document.addEventListener('DOMContentLoaded',function(){
    const saved=parseInt(sessionStorage.getItem(KEY)||'0',10);
    if(saved>=MIN_H) _applyH(saved);

    const handle=document.getElementById('d-layers-resize-handle');
    if(!handle)return;
    let drag=false,startY=0,startH=0;

    handle.addEventListener('mousedown',function(e){
      e.preventDefault();
      const sec=document.getElementById('d-layers-section');
      if(!sec)return;
      drag=true; startY=e.clientY; startH=sec.offsetHeight;
      document.body.style.cursor='ns-resize';
      document.body.style.userSelect='none';
    });
    document.addEventListener('mousemove',function(e){
      if(!drag)return;
      const r=document.getElementById('d-right');
      const maxH=r?Math.round(r.offsetHeight*MAX_RATIO):500;
      // Painel de camadas agora está embaixo, então descer o mouse (e.clientY > startY) diminui a altura
      _applyH(Math.min(maxH,Math.max(MIN_H,startH-(e.clientY-startY))));
    });
    document.addEventListener('mouseup',function(){
      if(!drag)return;
      drag=false;
      document.body.style.cursor='';
      document.body.style.userSelect='';
      const sec=document.getElementById('d-layers-section');
      if(sec) sessionStorage.setItem(KEY,sec.offsetHeight);
    });
  });
})();

/* ══ COPIAR / COLAR ESTILO (Ctrl+Alt+C / Ctrl+Alt+V) ══
   Copia as propriedades visuais de uma camada (cor, fonte, sombra, borda,
   opacidade, gradiente, blend mode) e cola em outra — sem alterar conteúdo,
   posição ou tamanho. Atalhos registrados em publish.js. */
let dStyleClipboard = null;

// Props visuais que fazem sentido copiar entre camadas do mesmo tipo
const _DSTYLE_COMMON = ['opacity','blendMode','shadow','shadowColor','shadowBlur','shadowDist','shadowAngle','glow','glowColor','glowSize','innerShadow','innerShadowColor','innerShadowBlur','innerShadowDist','innerShadowAngle','bevel','bevelSize','bevelAngle','bevelHighlight','bevelShadow','innerGlow','innerGlowColor','innerGlowSize','overlay','overlayColor','overlayOpacity','strokeW','strokeColor','strokeAlign','strokeDash'];
const _DSTYLE_TEXT = ['color','font','fontSize','fontWeightOverride','italic','textTransform','letterSpacing','lineHeight','textAlign','underline','strikethrough','bg','bgColor','gradient','vAlign','textCurve'];
const _DSTYLE_SHAPE = ['fill','gradient','radius','radii'];

function dCopyStyle(){
  const l=dLayers.find(x=>x.id===dSelId);
  if(!l){gToast('⚠ Selecione uma camada para copiar o estilo');return;}
  const clip={type:l.type};
  _DSTYLE_COMMON.forEach(k=>{ if(l[k]!=null) clip[k]=JSON.parse(JSON.stringify(l[k])); });
  if(l.type==='text') _DSTYLE_TEXT.forEach(k=>{ if(l[k]!=null) clip[k]=JSON.parse(JSON.stringify(l[k])); });
  if(l.type==='shape') _DSTYLE_SHAPE.forEach(k=>{ if(l[k]!=null) clip[k]=JSON.parse(JSON.stringify(l[k])); });
  dStyleClipboard=clip;
  gToast('✓ Estilo copiado de "'+gEsc(l.name)+'"');
}

function dPasteStyle(){
  if(!dStyleClipboard){gToast('⚠ Copie um estilo primeiro (Ctrl+Alt+C)');return;}
  const l=dLayers.find(x=>x.id===dSelId);
  if(!l){gToast('⚠ Selecione a camada destino');return;}
  dHistoryPush();
  // Aplica props comuns sempre
  _DSTYLE_COMMON.forEach(k=>{ if(dStyleClipboard[k]!=null) l[k]=JSON.parse(JSON.stringify(dStyleClipboard[k])); });
  // Aplica props de tipo quando compatível
  if(l.type==='text' && dStyleClipboard.type==='text')
    _DSTYLE_TEXT.forEach(k=>{ if(dStyleClipboard[k]!=null) l[k]=JSON.parse(JSON.stringify(dStyleClipboard[k])); });
  if(l.type==='shape' && dStyleClipboard.type==='shape')
    _DSTYLE_SHAPE.forEach(k=>{ if(dStyleClipboard[k]!=null) l[k]=JSON.parse(JSON.stringify(dStyleClipboard[k])); });
  dRenderCanvas();dRenderLayersList();dShowProps(l);dMarkUnsaved();
  gToast('✓ Estilo colado em "'+gEsc(l.name)+'"');
}
