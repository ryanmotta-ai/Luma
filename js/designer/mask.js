/**
 * js/designer/mask.js
 *
 * Máscaras de camada no editor: adicionar, pintar (esconder/revelar), inverter, remover.
 * Modelo unificado: l.mask = dataURL de ALPHA mask (opaco=visível, transparente=escondido)
 * — o mesmo usado no canvas (CSS mask), no PNG e no SVG, e importado do PSD.
 * Depende de: designer/canvas.js (dRenderCanvas, dFmt), designer/layers.js (dLayers, dSelId), core/toast.js.
 */

let _dMaskState=null; // { id, work(canvas alpha), view(canvas red), cap(canvas overlay), orig, mode, size, painting }

function _dMaskLayer(){ return dLayers.find(x=>x.id===dSelId); }

// Cria canvas alpha NxN totalmente visível (branco opaco)
function _dMaskBlank(w,h){
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,w,h); return c;
}
// Carrega l.mask (dataURL alpha) num canvas; callback(canvas)
function _dMaskLoad(url,w,h,cb){
  const c=document.createElement('canvas'); c.width=w; c.height=h; const x=c.getContext('2d');
  if(!url){ x.fillStyle='#fff'; x.fillRect(0,0,w,h); cb(c); return; }
  const img=new Image(); img.onload=()=>{ x.drawImage(img,0,0,w,h); cb(c); }; img.onerror=()=>{ x.fillStyle='#fff'; x.fillRect(0,0,w,h); cb(c); }; img.src=url;
}
// Deriva a "view" vermelha (vermelho onde está escondido = alpha baixa) a partir do work
function _dMaskRenderView(){
  const s=_dMaskState; if(!s) return;
  const w=s.work.width,h=s.work.height;
  const wd=s.work.getContext('2d').getImageData(0,0,w,h).data;
  const vctx=s.view.getContext('2d'); const vi=vctx.createImageData(w,h); const vd=vi.data;
  for(let i=0;i<wd.length;i+=4){ const hidden=255-wd[i+3]; vd[i]=255;vd[i+1]=40;vd[i+2]=40;vd[i+3]=Math.round(hidden*0.55); }
  vctx.putImageData(vi,0,0);
}

/* ── ações de painel ── */
function dMaskAdd(){
  const l=_dMaskLayer(); if(!l){ gToast('Selecione uma camada'); return; }
  if(!l.mask){ dHistoryPush(); l.mask=_dMaskBlank(l.w,l.h).toDataURL('image/png'); dMarkUnsaved(); }
  dMaskPaintStart();
}
function dMaskInvert(){
  const l=_dMaskLayer(); if(!l||!l.mask){ gToast('Esta camada não tem máscara'); return; }
  // Sessão de pintura ativa nesta camada: inverte o work atual (preserva os traços ainda
  // não salvos) sem recarregar l.mask — senão os traços da sessão somem ao inverter.
  if(_dMaskState && _dMaskState.id===l.id){
    const c=_dMaskState.work; const x=c.getContext('2d');
    const id=x.getImageData(0,0,c.width,c.height),d=id.data;
    for(let i=3;i<d.length;i+=4) d[i]=255-d[i];
    x.putImageData(id,0,0);
    _dMaskRenderView();
    return;
  }
  _dMaskLoad(l.mask,l.w,l.h,(c)=>{
    const x=c.getContext('2d'); const id=x.getImageData(0,0,c.width,c.height),d=id.data;
    for(let i=3;i<d.length;i+=4) d[i]=255-d[i];
    x.putImageData(id,0,0);
    dHistoryPush(); l.mask=c.toDataURL('image/png'); dMarkUnsaved();
    dRenderCanvas(); if(typeof dRenderLayersList==='function')dRenderLayersList(); if(typeof dShowProps==='function')dShowProps(l);
  });
}

/* ── modo pintura ── */
function dMaskPaintStart(){
  const l=_dMaskLayer(); if(!l) return;
  dMaskExit(false); // fecha sessão anterior
  const frame=document.getElementById('d-canvas-frame'); if(!frame) return;
  _dMaskLoad(l.mask,l.w,l.h,(work)=>{
    const view=document.createElement('canvas'); view.width=l.w; view.height=l.h;
    view.className='d-mask-view'; view.style.cssText=`position:absolute;left:${l.x}px;top:${l.y}px;width:${l.w}px;height:${l.h}px;z-index:300;pointer-events:none`;
    const cap=document.createElement('canvas'); cap.width=l.w; cap.height=l.h;
    cap.className='d-mask-cap'; cap.style.cssText=`position:absolute;left:${l.x}px;top:${l.y}px;width:${l.w}px;height:${l.h}px;z-index:301;cursor:crosshair`;
    frame.appendChild(view); frame.appendChild(cap);
    _dMaskState={ id:l.id, work, view, cap, orig:l.mask, mode:'hide', size:Math.max(20,Math.round(Math.min(l.w,l.h)*0.12)), painting:false };
    _dMaskRenderView();
    const pos=(e)=>{ const r=cap.getBoundingClientRect(); return { x:(e.clientX-r.left)/r.width*cap.width, y:(e.clientY-r.top)/r.height*cap.height }; };
    const dab=(p)=>{
      const wx=_dMaskState.work.getContext('2d');
      wx.save();
      wx.globalCompositeOperation = _dMaskState.mode==='hide' ? 'destination-out' : 'source-over';
      wx.fillStyle='#fff'; wx.beginPath(); wx.arc(p.x,p.y,_dMaskState.size/2,0,Math.PI*2); wx.fill();
      wx.restore();
      _dMaskRenderView();
    };
    cap.addEventListener('pointerdown',(e)=>{ e.preventDefault(); _dMaskState.painting=true; cap.setPointerCapture(e.pointerId); dab(pos(e)); });
    cap.addEventListener('pointermove',(e)=>{ if(_dMaskState&&_dMaskState.painting) dab(pos(e)); });
    cap.addEventListener('pointerup',()=>{ if(_dMaskState)_dMaskState.painting=false; });
    cap.addEventListener('pointerleave',()=>{ if(_dMaskState)_dMaskState.painting=false; });
    dMaskShowToolbar();
  });
}
function dMaskSetMode(m){ if(_dMaskState){ _dMaskState.mode=m; dMaskShowToolbar(); } }
function dMaskSetSize(v){ if(_dMaskState) _dMaskState.size=parseInt(v,10)||40; }
function dMaskExit(save){
  const s=_dMaskState; if(!s){ const tb=document.getElementById('d-mask-toolbar'); if(tb)tb.remove(); return; }
  const l=dLayers.find(x=>x.id===s.id);
  if(save && l){ dHistoryPush(); l.mask=s.work.toDataURL('image/png'); dMarkUnsaved(); }
  else if(l){ l.mask=s.orig; } // cancela → restaura
  if(s.view&&s.view.parentNode) s.view.remove();
  if(s.cap&&s.cap.parentNode) s.cap.remove();
  const tb=document.getElementById('d-mask-toolbar'); if(tb)tb.remove();
  _dMaskState=null;
  dRenderCanvas(); if(typeof dRenderLayersList==='function')dRenderLayersList();
  if(l&&typeof dShowProps==='function')dShowProps(l);
}
// barra flutuante do modo máscara
function dMaskShowToolbar(){
  let tb=document.getElementById('d-mask-toolbar');
  if(!tb){ tb=document.createElement('div'); tb.id='d-mask-toolbar'; document.body.appendChild(tb); }
  const s=_dMaskState; if(!s) return;
  tb.innerHTML=`
    <span class="d-mask-tb-title">🎭 Máscara</span>
    <button class="d-mask-tb-btn ${s.mode==='hide'?'active':''}" onclick="dMaskSetMode('hide')" title="Pintar pra esconder">Esconder</button>
    <button class="d-mask-tb-btn ${s.mode==='reveal'?'active':''}" onclick="dMaskSetMode('reveal')" title="Pintar pra revelar">Revelar</button>
    <label class="d-mask-tb-size">Pincel <input type="range" min="6" max="400" value="${s.size}" oninput="dMaskSetSize(this.value)"></label>
    <button class="d-mask-tb-btn" onclick="dMaskInvert()">Inverter</button>
    <button class="d-mask-tb-btn cancel" onclick="dMaskExit(false)">Cancelar</button>
    <button class="d-mask-tb-btn ok" onclick="dMaskExit(true)">Concluir</button>`;
}

/* ── seção no painel de Propriedades ── */
function dMaskRenderProps(l){
  const box=document.getElementById('d-mask-actions'); const sec=document.getElementById('d-mask-section');
  if(!box||!sec) return;
  if(!l || l.type==='paint'){ sec.style.display='none'; return; }
  sec.style.display='';
  if(l.mask){
    box.innerHTML=`<button class="d-btn-sec" onclick="dMaskPaintStart()">✎ Pintar</button>
      <button class="d-btn-sec" onclick="dMaskInvert()">⇄ Inverter</button>
      <button class="d-btn-sec" onclick="dRemoveMask()">✕ Remover</button>`;
  } else {
    box.innerHTML=`<button class="d-btn-sec" onclick="dMaskAdd()">+ Adicionar máscara</button>`;
  }
}
