/**
 * js/designer/undo-redo.js
 *
 * Historico de acoes do designer: dHistoryPush, dUndo, dRedo,
 * dUpdateUndoButtons, dFlashLayer, dDuplicateLayer.
 * Depende de: designer/canvas.js
 */

// Modelo coalescido: dHistoryPush() agenda um commit para o FIM do turno do
// event-loop (microtask). Como as mutações de dLayers num handler são síncronas,
// o snapshot capturado é sempre o estado FINAL da ação — não importa se o
// chamador chamou push antes ou depois de mutar. Isso conserta o redo (C4) e
// torna a cobertura (reorder/align/visibility/stamp) order-independent.
// Cada entrada = {layers, paint}: estado dos layers + snapshot PNG do paint canvas.
// A pintura à mão (#d-paint-canvas) agora ENTRA no histórico (A4). Para não re-encodar
// um PNG a cada ação de layer, só recapturamos a pintura quando dPaintDirty (setado em
// dPaintEnd/dApplyGradient/dClearPaint); senão reusamos a string do topo (sem custo).
let _dHistPending=false;
let _dHistDebounce=null;
let dPaintDirty=false;     // pintura mudou desde o último snapshot?
let _dLastPaintURL=null;   // última pintura capturada (reuso entre snapshots)
function dHistoryPush(){
  if(_dHistPending)return;
  _dHistPending=true;
  clearTimeout(_dHistDebounce);
  Promise.resolve().then(dHistoryCommit);
}
// Versão com debounce de 400ms — para props editadas via oninput contínuo.
function dHistoryPushDebounced(){
  _dHistPending=false;
  clearTimeout(_dHistDebounce);
  _dHistDebounce=setTimeout(dHistoryCommit,400);
}
function dCapturePaint(){
  const cv=document.getElementById('d-paint-canvas');
  if(!cv)return null;
  try{ return cv.toDataURL('image/png'); }catch(e){ return null; }
}
function dHistorySnapshot(){
  const layers=JSON.parse(JSON.stringify(dLayers));
  let paint;
  if(dPaintDirty){ paint=dCapturePaint(); _dLastPaintURL=paint; dPaintDirty=false; }
  else { paint=(dHistoryIdx>=0&&dHistory[dHistoryIdx])?dHistory[dHistoryIdx].paint:_dLastPaintURL; }
  return {layers, paint};
}
function dHistoryCommit(){
  _dHistPending=false;
  clearTimeout(_dHistDebounce);
  const snap=dHistorySnapshot();
  const top=dHistoryIdx>=0?dHistory[dHistoryIdx]:null;
  // Não duplica se layers E pintura idênticos ao topo
  if(top && top.paint===snap.paint && JSON.stringify(top.layers)===JSON.stringify(snap.layers)){
    dUpdateUndoButtons();return;
  }
  dHistory=dHistory.slice(0,dHistoryIdx+1);
  dHistory.push(snap);
  if(dHistory.length>30)dHistory.shift();
  dHistoryIdx=dHistory.length-1;
  dUpdateUndoButtons();
}
// Reseta o histórico com o estado atual como baseline (layers + pintura)
function dHistoryReset(){
  dPaintDirty=true;            // captura a pintura atual como baseline
  dHistory=[dHistorySnapshot()];
  dHistoryIdx=0;
  _dHistPending=false;
  if(typeof dUpdateUndoButtons==='function')dUpdateUndoButtons();
}
// Redesenha o paint canvas a partir de um dataURL (ou limpa se null)
function dApplyPaintSnapshot(dataUrl){
  const cv=document.getElementById('d-paint-canvas');
  if(!cv)return;
  const ctx=cv.getContext('2d');
  ctx.clearRect(0,0,cv.width,cv.height);
  if(dataUrl){
    const img=new Image();
    img.onload=()=>{ try{ ctx.clearRect(0,0,cv.width,cv.height); ctx.drawImage(img,0,0,cv.width,cv.height); }catch(e){} };
    img.src=dataUrl;
  }
}
// Preserva a seleção através de undo/redo quando o layer ainda existe
function dRestoreSelection(){
  if(dSelId && !dLayers.some(l=>l.id===dSelId))dSelId=null;
  if(typeof dMultiSel!=='undefined')dMultiSel=dMultiSel.filter(id=>dLayers.some(l=>l.id===id));
}
function dApplyHistoryEntry(entry){
  dLayers=JSON.parse(JSON.stringify(entry.layers));
  dRestoreSelection();
  dApplyPaintSnapshot(entry.paint);
  _dLastPaintURL=entry.paint; dPaintDirty=false;
}
function dUndo(){
  if(dHistoryIdx<=0){gToast('Nada para desfazer');return;}
  dHistoryIdx--;
  dApplyHistoryEntry(dHistory[dHistoryIdx]);
  dRenderCanvas();dRenderLayersList();dStats();dMarkUnsaved();
  dUpdateUndoButtons();
  gToast('Desfeito');
}
function dRedo(){
  if(dHistoryIdx>=dHistory.length-1){gToast('Nada para refazer');return;}
  dHistoryIdx++;
  dApplyHistoryEntry(dHistory[dHistoryIdx]);
  dRenderCanvas();dRenderLayersList();dStats();dMarkUnsaved();
  dUpdateUndoButtons();
  gToast('Refeito');
}
function dUpdateUndoButtons(){
  const u=document.getElementById('dbtn-undo'),r=document.getElementById('dbtn-redo');
  if(u)u.style.opacity=dHistoryIdx>0?'1':'0.35';
  if(r)r.style.opacity=dHistoryIdx<dHistory.length-1?'1':'0.35';
}

function dFlashLayer(id){
  const el=document.querySelector('[data-id="'+id+'"]');
  if(!el)return;
  el.classList.add('flash');
  setTimeout(()=>el.classList.remove('flash'),350);
}
