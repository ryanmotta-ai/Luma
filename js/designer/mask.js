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
  const sz = s.size;
  const previewSize = Math.max(8, Math.min(sz, 46));
  tb.innerHTML=`
    <span class="d-mask-tb-title">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="12" r="5"/></svg>
      Máscara
    </span>
    <span class="d-mask-tb-divider"></span>
    <button class="d-mask-tb-btn ${s.mode==='hide'?'active':''}" onclick="dMaskSetMode('hide')" title="Pintar para esconder (H)">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
      Esconder
    </button>
    <button class="d-mask-tb-btn ${s.mode==='reveal'?'active':''}" onclick="dMaskSetMode('reveal')" title="Pintar para revelar (R)">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      Revelar
    </button>
    <span class="d-mask-tb-divider"></span>
    <label class="d-mask-tb-size">
      <div class="d-mask-tb-preview" id="d-mask-preview" style="width:${previewSize}px;height:${previewSize}px"></div>
      <input type="range" min="6" max="300" value="${sz}" oninput="dMaskSetSize(this.value);const p=document.getElementById('d-mask-preview');if(p){const s=Math.max(8,Math.min(parseInt(this.value),46));p.style.width=s+'px';p.style.height=s+'px';}">
    </label>
    <span class="d-mask-tb-divider"></span>
    <button class="d-mask-tb-btn" onclick="dMaskInvert()" title="Inverter máscara">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h18M12 3v18"/></svg>
      Inverter
    </button>
    <button class="d-mask-tb-btn cancel" onclick="dMaskExit(false)" title="Cancelar">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      Cancelar
    </button>
    <button class="d-mask-tb-btn ok" onclick="dMaskExit(true)" title="Confirmar">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      OK
    </button>`;
}

/* ── seção no painel de Propriedades ── */
function dMaskRenderProps(l){
  const box=document.getElementById('d-mask-actions');
  const sec=document.getElementById('d-mask-section');
  const card=document.getElementById('d-mask-status-card');
  const lbl=document.getElementById('d-mask-status-label');
  const hint=document.getElementById('d-mask-status-hint');
  if(!box||!sec) return;
  if(!l || l.type==='paint'){ sec.style.display='none'; return; }
  sec.style.display='';

  if(l.mask){
    // Status: máscara ativa
    if(card) card.classList.add('has-mask');
    if(lbl) lbl.textContent = 'Máscara ativa';
    if(hint) hint.textContent = 'Clique em Pintar para editar a máscara';

    box.innerHTML=`
      <button class="d-btn-sec" onclick="dMaskPaintStart()">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        Pintar
      </button>
      <button class="d-btn-sec" onclick="dMaskInvert()">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h18M12 3v18"/></svg>
        Inverter
      </button>
      <button class="d-btn-sec" onclick="dRemoveMask()" style="color:var(--dm-red,#e03)">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        Remover
      </button>`;
  } else {
    // Status: sem máscara
    if(card) card.classList.remove('has-mask');
    if(lbl) lbl.textContent = 'Sem máscara';
    if(hint) hint.textContent = 'Adicione uma para recortar a camada';

    box.innerHTML=`
      <button class="d-btn-sec" onclick="dMaskAdd()" style="width:100%;justify-content:center;gap:6px">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="12" r="5"/><line x1="12" y1="9" x2="12" y2="15"/><line x1="9" y1="12" x2="15" y2="12"/></svg>
        Adicionar máscara
      </button>`;
  }
}

