/**
 * js/designer/canvas.js
 *
 * Render do canvas, zoom, pan, formato, réguas, barra contextual,
 * smart guides, simulacao de dados e interacoes de mouse.
 * Depende de: designer/templates.js, designer/layers.js
 */

function dSetFormat(fmt,btn){
  const prevFmt=dFmt;
  dFmt=fmt;
  document.querySelectorAll('.dt-fmt').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  // Atualiza dimensões do artboard ativo
  const ab=dGetActiveAB&&dGetActiveAB();
  const from=ab?{w:ab.w,h:ab.h}:(DFMT_SIZES[prevFmt]||DFMT_SIZES.story);
  const to=DFMT_SIZES[fmt]||DFMT_SIZES.story;
  if(ab){ab.fmt=fmt;ab.w=to.w;ab.h=to.h;}
  // 5.2 — Smart resize: oferece adaptar os elementos ao novo formato (re-ancora sem distorcer)
  if((from.w!==to.w||from.h!==to.h)&&dLayers.length>1&&typeof gReflowLayers==='function'){
    if(confirm('Adaptar os elementos ao novo formato? (smart resize — posições e tamanhos re-ancoram sem distorcer)')){
      dHistoryPush();
      dLayers=gReflowLayers(dLayers,from,to,{fmtKey:gFmtKey(fmt)});
      if(typeof dSyncLayersToAB==='function')dSyncLayersToAB();
      gToast('✓ Elementos adaptados para '+fmt.toUpperCase()+' — ajuste o que precisar');
    }
  }
  dApplyFormat();dRenderCanvas();dRenderLayersList();dMarkUnsaved();
  if(typeof dRenderWorkspace==='function')dRenderWorkspace();
}
function dApplyFormat(animate){
  setTimeout(dRenderRulers,30);
  const ab=dGetActiveAB&&dGetActiveAB();
  const f=ab?{w:ab.w,h:ab.h}:(DFMT_SIZES[dFmt]||DFMT_SIZES.story);
  const frame=document.getElementById('d-canvas-frame');
  if(!frame)return;
  const scale=dZoomLevel/100;
  if(animate){frame.style.transition='transform .15s ease';}
  else{frame.style.transition='none';}
  frame.style.width=f.w+'px';frame.style.height=f.h+'px';
  frame.style.transform=`scale(${scale})`;frame.style.transformOrigin='top left';
  const container=document.getElementById('d-canvas-container');
  if(container){
    container.style.width=Math.round(f.w*scale)+'px';
    container.style.height=Math.round(f.h*scale)+'px';
  }
  dPositionArtboard(); // centraliza a prancheta no workspace
  document.getElementById('d-dim-label').textContent=f.w+' × '+f.h+'  '+Math.round(dZoomLevel)+'%';
  // Atualiza label do artboard ativo
  const abl=document.getElementById('d-ab-active-label');
  if(abl&&ab)abl.textContent=ab.name;
}
function dFitToScreen(){
  const wrapper=document.getElementById('d-canvas-wrapper');
  const ab=dGetActiveAB&&dGetActiveAB();
  const f=ab?{w:ab.w,h:ab.h}:(DFMT_SIZES[dFmt]||DFMT_SIZES.story);
  const pw=wrapper.clientWidth-80, ph=wrapper.clientHeight-80;
  if(!pw||!ph)return;
  const s=Math.min(pw/f.w, ph/f.h, 1)*100;
  dZoomLevel=Math.max(10,Math.round(s));
  document.getElementById('d-zoom-val').textContent=dZoomLevel+'%';
  dApplyFormat(true);
  if(typeof dRenderWorkspace==='function')dRenderWorkspace();
  // Scroll para centrar a prancheta na viewport
  const container=document.getElementById('d-canvas-container');
  if(container){
    wrapper.scrollLeft=Math.max(0,(container.offsetLeft+container.offsetWidth/2)-wrapper.clientWidth/2);
    wrapper.scrollTop=Math.max(0,(container.offsetTop+container.offsetHeight/2)-wrapper.clientHeight/2);
  }
}
// Centraliza a prancheta ativa no workspace e dimensiona o workspace pela viewport
// (com margem ao redor). Substitui o antigo posicionamento por coordenada (multi-prancheta).
function dPositionArtboard(){
  const ws=document.getElementById('d-workspace');
  const wrapper=document.getElementById('d-canvas-wrapper');
  const container=document.getElementById('d-canvas-container');
  const ab=dGetActiveAB&&dGetActiveAB();
  if(!ws||!container||!ab)return;
  const scale=dZoomLevel/100;
  const aw=ab.w*scale, ah=ab.h*scale, margin=120;
  const vw=wrapper?wrapper.clientWidth:aw, vh=wrapper?wrapper.clientHeight:ah;
  // Se a prancheta cabe na viewport → workspace = viewport (centraliza, sem scroll).
  // Se é maior → workspace = prancheta + margem (centraliza com respiro e scroll).
  const wW = aw<=vw ? vw : aw+margin*2;
  const wH = ah<=vh ? vh : ah+margin*2;
  ws.style.width=wW+'px';ws.style.height=wH+'px';
  container.style.left=Math.round((wW-aw)/2)+'px';
  container.style.top=Math.round((wH-ah)/2)+'px';
}
function dZoom(delta){
  // Passo multiplicativo → mesmo "feel" em qualquer nível (10%→400%)
  const factor = delta>0 ? 1.2 : 1/1.2;
  dSetZoom(dZoomLevel*factor);
}
// Define o zoom mantendo um ponto de âncora fixo na tela: o cursor (wheel) ou,
// se não informado, o centro da viewport. fx/fy = fração da prancheta sob a âncora.
function dSetZoom(z, clientX, clientY){
  const wrapper=document.getElementById('d-canvas-wrapper');
  const container=document.getElementById('d-canvas-container');
  const frame=document.getElementById('d-canvas-frame');
  
  let ax=null, ay=null, fx=0.5, fy=0.5;
  if(wrapper){
    const wr=wrapper.getBoundingClientRect();
    ax=(clientX!=null)?clientX:wr.left+wrapper.clientWidth/2;
    ay=(clientY!=null)?clientY:wr.top+wrapper.clientHeight/2;
    if(container){
      const cr=container.getBoundingClientRect();
      fx=cr.width?(ax-cr.left)/cr.width:0.5;
      fy=cr.height?(ay-cr.top)/cr.height:0.5;
    }
  }
  
  dZoomLevel=Math.min(400,Math.max(10,Math.round(z)));
  document.getElementById('d-zoom-val').textContent=dZoomLevel+'%';

  // Habilita transições suaves apenas durante a escala do zoom
  if (container) container.style.transition = 'width 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94), height 0.2s, left 0.2s, top 0.2s';
  if (frame) frame.style.transition = 'width 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94), height 0.2s, transform 0.2s';

  dApplyFormat();
  if(typeof dRenderWorkspace==='function')dRenderWorkspace();

  // Limpa as transições após a conclusão da animação para não causar atraso no drag de elementos
  setTimeout(() => {
    if (container) container.style.transition = 'none';
    if (frame) frame.style.transition = 'none';
  }, 220);

  // Reposiciona o scroll suavemente para manter o mesmo ponto da prancheta sob a âncora
  if(wrapper&&container){
    const wr=wrapper.getBoundingClientRect();
    wrapper.scrollTo({
      left: Math.max(0, container.offsetLeft + fx*container.offsetWidth - (ax-wr.left)),
      top: Math.max(0, container.offsetTop  + fy*container.offsetHeight - (ay-wr.top)),
      behavior: 'smooth'
    });
  }
}

/* ══ WORKSPACE & ARTBOARD DRAG ══ */
const WORKSPACE_W=8000,WORKSPACE_H=6000;

// ── Placeholder de teste de proporção (auxílio do editor; NÃO vai para o PNG) ──
let dPhTestAR=null; // null | 'portrait' | 'landscape' | 'square'
const _dSampleCache={};
function dSampleImg(ar){
  if(_dSampleCache[ar])return _dSampleCache[ar];
  const dims={portrait:[600,900],landscape:[900,600],square:[800,800]}[ar]||[800,800];
  const cv=document.createElement('canvas');cv.width=dims[0];cv.height=dims[1];
  const c=cv.getContext('2d');
  const g=c.createLinearGradient(0,0,dims[0],dims[1]);
  g.addColorStop(0,'#6D5BD0');g.addColorStop(1,'#E0498A');
  c.fillStyle=g;c.fillRect(0,0,dims[0],dims[1]);
  c.strokeStyle='rgba(255,255,255,.5)';c.lineWidth=6;c.strokeRect(20,20,dims[0]-40,dims[1]-40);
  c.fillStyle='rgba(255,255,255,.92)';c.textAlign='center';c.textBaseline='middle';
  c.font='bold '+Math.round(dims[0]*0.09)+'px Roboto,sans-serif';c.fillText('FOTO',dims[0]/2,dims[1]/2-dims[0]*0.04);
  c.font=Math.round(dims[0]*0.05)+'px Roboto,sans-serif';c.fillText(dims[0]+'×'+dims[1],dims[0]/2,dims[1]/2+dims[0]*0.06);
  _dSampleCache[ar]=cv.toDataURL('image/png');
  return _dSampleCache[ar];
}
function dSetPhTest(ar){ dPhTestAR=ar||null; dRenderCanvas(); }

function dRenderWorkspace(){
  const ws=document.getElementById('d-workspace');if(!ws)return;
  // UI de pranchetas removida: limpa resquícios e centraliza a prancheta ativa.
  ws.querySelectorAll('.ab-ghost').forEach(el=>el.remove());
  const container=document.getElementById('d-canvas-container');
  if(container)container.querySelectorAll('.ab-rh').forEach(h=>h.remove());
  dPositionArtboard();
}

/* ══ RESIZE DO ARTBOARD ══
   Handles nas 8 posições (N S E W NE NW SE SW) no #d-canvas-container.
   Arrastar redimensiona o artboard ativo.
══════════════════════════════════════════════════════════════ */
const AB_RESIZE_POSITIONS=['nw','n','ne','e','se','s','sw','w'];
const AB_RESIZE_CURSORS={nw:'nwse-resize',n:'ns-resize',ne:'nesw-resize',e:'ew-resize',se:'nwse-resize',s:'ns-resize',sw:'nesw-resize',w:'ew-resize'};

function dABAddResizeHandles(){
  const container=document.getElementById('d-canvas-container');if(!container)return;
  container.querySelectorAll('.ab-rh').forEach(h=>h.remove());
  AB_RESIZE_POSITIONS.forEach(pos=>{
    const h=document.createElement('div');
    h.className='ab-rh ab-rh-'+pos;
    h.style.cursor=AB_RESIZE_CURSORS[pos]||'default';
    h.title='Redimensionar prancheta';
    h.addEventListener('mousedown',e=>{e.preventDefault();e.stopPropagation();dABResizeStart(e,pos);});
    container.appendChild(h);
  });
}

let dABResizeState=null;
let dABResizeTicking=false;

function dABResizeStart(e,pos){
  const ab=dGetActiveAB();if(!ab)return;
  const scale=dZoomLevel/100;
  dABResizeState={pos,ab,scale,
    startX:e.clientX,startY:e.clientY,
    origX:ab.x,origY:ab.y,origW:ab.w,origH:ab.h};
  const container = document.getElementById('d-canvas-container');
  if (container) container.classList.add('resizing-artboard');
  document.addEventListener('mousemove',dABResizeMoveThrottled);
  document.addEventListener('mouseup',dABResizeUp);
}

function dABResizeMoveThrottled(e){
  if(!dABResizeState)return;
  if(!dABResizeTicking){
    window.requestAnimationFrame(()=>{
      dUpdateABResizeLayout(e);
      dABResizeTicking=false;
    });
    dABResizeTicking=true;
  }
}

function dUpdateABResizeLayout(e){
  if(!dABResizeState)return;
  const {pos,ab,scale,startX,startY,origX,origY,origW,origH}=dABResizeState;
  const dx=Math.round((e.clientX-startX)/scale);
  const dy=Math.round((e.clientY-startY)/scale);
  const MIN=80;
  // Lados e cantos
  if(pos.includes('e')){ab.w=Math.max(MIN,origW+dx);}
  if(pos.includes('s')){ab.h=Math.max(MIN,origH+dy);}
  if(pos.includes('w')){const nw=Math.max(MIN,origW-dx);ab.x=origX+(origW-nw);ab.w=nw;}
  if(pos.includes('n')){const nh=Math.max(MIN,origH-dy);ab.y=origY+(origH-nh);ab.h=nh;}
  // Atualiza visualmente sem re-render completo
  const frame=document.getElementById('d-canvas-frame');
  const container=document.getElementById('d-canvas-container');
  if(frame){frame.style.width=ab.w+'px';frame.style.height=ab.h+'px';}
  if(container){
    container.style.width=Math.round(ab.w*scale)+'px';
    container.style.height=Math.round(ab.h*scale)+'px';
    container.style.left=ab.x*scale+'px';
    container.style.top=ab.y*scale+'px';
  }
  // Atualiza as dimensões de fundo (Shape de Fundo) dinamicamente para evitar fundo preto exposto
  const bgLyr=dLayers.find(l=>l.type==='shape'&&l.x===0&&l.y===0&&l.name==='Fundo');
  if(bgLyr){
    bgLyr.w=ab.w;
    bgLyr.h=ab.h;
    const bgDom=document.querySelector(`.canvas-layer[data-id="${bgLyr.id}"]`);
    if(bgDom){
      bgDom.style.width=ab.w+'px';
      bgDom.style.height=ab.h+'px';
    }
  }
  if(typeof dRenderRulers==='function') dRenderRulers();
  document.getElementById('d-dim-label').textContent=ab.w+' × '+ab.h+'  '+Math.round(dZoomLevel)+'%';
}

function dABResizeUp(){
  document.removeEventListener('mousemove',dABResizeMoveThrottled);
  document.removeEventListener('mouseup',dABResizeUp);
  const container = document.getElementById('d-canvas-container');
  if (container) container.classList.remove('resizing-artboard');
  if(!dABResizeState)return;
  const {ab}=dABResizeState;dABResizeState=null;
  // Ajusta layer de fundo para cobrir o novo tamanho
  const bgLyr=dLayers.find(l=>l.type==='shape'&&l.x===0&&l.y===0&&l.name==='Fundo');
  if(bgLyr){bgLyr.w=ab.w;bgLyr.h=ab.h;}
  dApplyFormat();dRenderCanvas();dRenderWorkspace();dMarkUnsaved();
  gToast('Prancheta '+ab.w+'×'+ab.h+'px');
}

let dABDrag=null,dABDragSX=0,dABDragSY=0,dABStartX=0,dABStartY=0,dABDragEl=null;

function dABDragStart(e,ab){
  e.preventDefault();
  dABDrag=ab;dABDragSX=e.clientX;dABDragSY=e.clientY;
  dABStartX=ab.x;dABStartY=ab.y;
  if(ab.id===dActiveABId){dABDragEl=document.getElementById('d-canvas-container');}
  else{dABDragEl=document.querySelector(`.ab-ghost[data-abid="${ab.id}"]`);}
  document.addEventListener('mousemove',dABOnDrag);
  document.addEventListener('mouseup',dABStopDrag);
}
function dABOnDrag(e){
  if(!dABDrag)return;
  const scale=dZoomLevel/100;
  dABDrag.x=Math.max(40,Math.round(dABStartX+(e.clientX-dABDragSX)/scale));
  dABDrag.y=Math.max(40,Math.round(dABStartY+(e.clientY-dABDragSY)/scale));
  if(dABDragEl){dABDragEl.style.left=dABDrag.x*scale+'px';dABDragEl.style.top=dABDrag.y*scale+'px';}
}
function dABStopDrag(){
  dABDrag=null;dABDragEl=null;
  document.removeEventListener('mousemove',dABOnDrag);
  document.removeEventListener('mouseup',dABStopDrag);
}

/* ── TOOL ── */
// Cursores customizados por ferramenta (SVG inline, estilo Photoshop). brush/eraser
// usam cursor dinâmico (dUpdateBrushCursor) que segue o tamanho do pincel + zoom.
const dToolCursors = {
  select: 'default',

  text: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%230A0A0A' stroke-width='2' stroke-linecap='round'><line x1='12' y1='2' x2='12' y2='6'/><line x1='12' y1='18' x2='12' y2='22'/><line x1='8' y1='4' x2='16' y2='4'/><line x1='8' y1='20' x2='16' y2='20'/><line x1='12' y1='6' x2='12' y2='18'/></svg>") 12 12, text`,
  'text-h': `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%230A0A0A' stroke-width='2' stroke-linecap='round'><line x1='12' y1='2' x2='12' y2='6'/><line x1='12' y1='18' x2='12' y2='22'/><line x1='8' y1='4' x2='16' y2='4'/><line x1='8' y1='20' x2='16' y2='20'/><line x1='12' y1='6' x2='12' y2='18'/></svg>") 12 12, text`,
  'text-v': `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%230A0A0A' stroke-width='2' stroke-linecap='round'><line x1='2' y1='12' x2='6' y2='12'/><line x1='18' y1='12' x2='22' y2='12'/><line x1='4' y1='8' x2='4' y2='16'/><line x1='20' y1='8' x2='20' y2='16'/><line x1='6' y1='12' x2='18' y2='12'/></svg>") 12 12, vertical-text`,
  'mask-text-h': `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%230A0A0A' stroke-width='2' stroke-dasharray='2 2' stroke-linecap='round'><line x1='12' y1='2' x2='12' y2='6'/><line x1='12' y1='18' x2='12' y2='22'/><line x1='8' y1='4' x2='16' y2='4'/><line x1='8' y1='20' x2='16' y2='20'/><line x1='12' y1='6' x2='12' y2='18'/></svg>") 12 12, text`,
  'mask-text-v': `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%230A0A0A' stroke-width='2' stroke-dasharray='2 2' stroke-linecap='round'><line x1='2' y1='12' x2='6' y2='12'/><line x1='18' y1='12' x2='22' y2='12'/><line x1='4' y1='8' x2='4' y2='16'/><line x1='20' y1='8' x2='20' y2='16'/><line x1='6' y1='12' x2='18' y2='12'/></svg>") 12 12, vertical-text`,

  rect: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%230A0A0A' stroke-width='2'><line x1='12' y1='2' x2='12' y2='22'/><line x1='2' y1='12' x2='22' y2='12'/><rect x='8' y='8' width='8' height='8' rx='1' stroke='%23FF9000' stroke-width='1.5' fill='rgba(255,144,0,0.1)'/></svg>") 12 12, crosshair`,

  frame: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%230A0A0A' stroke-width='2'><line x1='12' y1='2' x2='12' y2='22'/><line x1='2' y1='12' x2='22' y2='12'/><rect x='7' y='7' width='10' height='10' rx='1' stroke='%23FF9000' stroke-width='1.5' fill='none'/><line x1='7' y1='7' x2='17' y2='17' stroke='%23FF9000' stroke-width='1' opacity='0.5'/><line x1='17' y1='7' x2='7' y2='17' stroke='%23FF9000' stroke-width='1' opacity='0.5'/></svg>") 12 12, crosshair`,

  img: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%230A0A0A' stroke-width='1.8'><line x1='12' y1='2' x2='12' y2='22'/><line x1='2' y1='12' x2='22' y2='12'/><rect x='6' y='8' width='12' height='9' rx='1' stroke='%23FF9000' stroke-width='1.5'/><circle cx='9' cy='11' r='1.5' fill='%23FF9000'/><path d='M6 17l3.5-4 2.5 3 1.5-2 3 3' stroke='%23FF9000' stroke-width='1.2' fill='none'/></svg>") 12 12, crosshair`,

  eraser: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%230A0A0A' stroke-width='2' stroke-linecap='round'><path d='M20 20H7L3 16l10-10 7 7-2.5 2.5'/><path d='M6 11L13 18' stroke='%23FF9000' stroke-width='1.5'/><line x1='3' y1='20' x2='20' y2='20'/></svg>") 4 20, cell`,

  eyedrop: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%230A0A0A' stroke-width='2' stroke-linecap='round'><path d='m2 22 1-1h3l9-9'/><path d='M3 21v-3l9-9'/><path d='m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z'/></svg>") 0 24, crosshair`,
  'color-sampler': 'crosshair',
  'ruler': 'crosshair',
  'note': 'cell',
  'count': 'cell',

  bucket: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%230A0A0A' stroke-width='2' stroke-linecap='round'><path d='M3 21.3a1 1 0 0 0 1 .7h1a1 1 0 0 0 1-.7l1-4h4l1 4a1 1 0 0 0 1 .7h1a1 1 0 0 0 1-.7L21 7.3a1 1 0 0 0-.7-1.3L4.7 3A1 1 0 0 0 3.3 4L3 21.3Z'/><path d='M19 17c0 0 2 0.5 2 2.5S19 22 19 22s-2-.5-2-2.5 2-2.5 2-2.5Z' fill='%23FF9000' stroke='%23FF9000'/></svg>") 4 20, crosshair`,

  stamp: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%230A0A0A' stroke-width='2' stroke-linecap='round'><path d='M9 12H5l-2 5h18l-2-5h-4'/><rect x='9' y='4' width='6' height='8' rx='1'/><line x1='7' y1='17' x2='17' y2='17'/></svg>") 12 20, copy`,

  smudge: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%230A0A0A' stroke-width='2' stroke-linecap='round'><path d='M3 11h.01M7 6h.01M11 3h.01M15 3h.01M19 6h.01M21 11h.01M19 16c-2 3-7 3-9-1-1-2-3-2-4-1-1 1-1 3 0 4 2 2 7 0 13-2Z'/></svg>") 12 20, grab`,

  blur: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%230A0A0A' stroke-linecap='round'><circle cx='12' cy='12' r='3' stroke-width='2.5'/><circle cx='12' cy='12' r='6' stroke-width='1.5' opacity='0.6'/><circle cx='12' cy='12' r='9' stroke-width='1' opacity='0.3'/></svg>") 12 12, cell`,

  gradient: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%230A0A0A' stroke-width='2' stroke-linecap='round'><line x1='12' y1='2' x2='12' y2='22'/><line x1='2' y1='12' x2='22' y2='12'/><line x1='5' y1='5' x2='19' y2='19' stroke='%23FF9000' stroke-width='1.5' opacity='0.6'/></svg>") 12 12, crosshair`,

  'obj-select': `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%230A0A0A' stroke-width='2'><line x1='12' y1='2' x2='12' y2='22'/><line x1='2' y1='12' x2='22' y2='12'/><rect x='7' y='7' width='10' height='10' rx='1' stroke='%23FF9000' stroke-width='1.5' fill='rgba(255,144,0,0.1)'/></svg>") 12 12, crosshair`,

  'quick-select': `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%230A0A0A' stroke-width='2'><line x1='12' y1='2' x2='12' y2='22'/><line x1='2' y1='12' x2='22' y2='12'/><line x1='18' y1='14' x2='18' y2='20' stroke='%23FF9000' stroke-width='2'/><line x1='15' y1='17' x2='21' y2='17' stroke='%23FF9000' stroke-width='2'/></svg>") 12 12, crosshair`,

  'magic-wand': `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%230A0A0A' stroke-width='2' stroke-linecap='round'><line x1='3' y1='21' x2='13' y2='11'/><path d='M13 3l1.5 3 3 1.5-3 1.5L13 12l-1.5-3-3-1.5 3-1.5z' stroke='%23FF9000'/></svg>") 3 21, crosshair`,
};

// Cursor circular dinâmico do pincel/borracha — tamanho acompanha #d-brush-size + zoom.
function dUpdateBrushCursor(){
  if(dTool!=='brush' && dTool!=='eraser')return;
  const sizeEl=document.getElementById('d-brush-size');
  const size=parseInt((sizeEl&&sizeEl.value)||'8',10);
  const scale=dZoomLevel/100;
  const displaySize=Math.max(8,Math.round(size*scale));
  const half=Math.round(displaySize/2);
  const color=dTool==='eraser'?'%23aaaaaa':'%23FF9000';
  const cursor=`url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='${displaySize}' height='${displaySize}' viewBox='0 0 ${displaySize} ${displaySize}'><circle cx='${half}' cy='${half}' r='${half-1}' fill='none' stroke='${color}' stroke-width='1.5' opacity='0.85'/><circle cx='${half}' cy='${half}' r='1' fill='${color}'/></svg>") ${half} ${half}, crosshair`;
  const frame=document.getElementById('d-canvas-frame');
  if(frame)frame.style.cursor=cursor;
}

function dSetTool(t){
  dTool=t;
  ['select','obj-select','quick-select','magic-wand','text','rect','frame','img','brush','eraser','stamp','eyedrop','smudge','blur','sharpen','bucket','gradient','text-h','text-v','mask-text-h','mask-text-v','color-sampler','ruler','note','count'].forEach(x=>{
    const b=document.getElementById('dtool-'+x);
    if(b){b.classList.toggle('active',x===t);}
  });
  // Proxy do grupo Nitidez — marca ativo e atualiza ícone
  const _nitidezGroup=['blur','sharpen','smudge'];
  const _nProxy=document.getElementById('dtool-nitidez-proxy');
  if(_nProxy) _nProxy.classList.toggle('active',_nitidezGroup.includes(t));
  if(_nitidezGroup.includes(t)){
    if(typeof dNitidezLast!=='undefined') dNitidezLast=t;
    const _nIcon=document.getElementById('dtool-nitidez-icon');
    if(_nIcon&&typeof _dNitidezIcons!=='undefined') _nIcon.innerHTML=_dNitidezIcons[t]||'';
  }
  // Proxy do grupo Forma — marca ativo quando rect está ativo e sincroniza ícone
  const _fProxy=document.getElementById('dtool-forma-proxy');
  if(_fProxy) _fProxy.classList.toggle('active', t==='rect');
  if(t==='rect'){
    if(typeof dFormaLast!=='undefined') dFormaLast='rect';
    const _fIcon=document.getElementById('dtool-forma-icon');
    if(_fIcon&&typeof _dFormaIcons!=='undefined') _fIcon.innerHTML=_dFormaIcons['rect']||'';
  }
  // Proxy do grupo Texto — marca ativo e atualiza ícone
  const _textGroup=['text','text-h','text-v','mask-text-h','mask-text-v'];
  const _tProxy=document.getElementById('dtool-text-proxy');
  if(_tProxy) _tProxy.classList.toggle('active',_textGroup.includes(t));
  if(_textGroup.includes(t)){
    if(typeof dTextLast!=='undefined') dTextLast=t;
    const _tIcon=document.getElementById('dtool-text-icon');
    if(_tIcon&&typeof _dTextIcons!=='undefined') _tIcon.innerHTML=_dTextIcons[t]||'';
  }
  // Proxy do grupo Seleção — marca ativo e sincroniza ícone
  const _selectGroup=['select','obj-select','quick-select','magic-wand'];
  const _sProxy=document.getElementById('dtool-select-proxy');
  if(_sProxy) _sProxy.classList.toggle('active',_selectGroup.includes(t));
  if(_selectGroup.includes(t)){
    if(typeof dSelectLast!=='undefined') dSelectLast=t;
    const _sIcon=document.getElementById('dtool-select-icon');
    if(_sIcon&&typeof _dSelectIcons!=='undefined') _sIcon.innerHTML=_dSelectIcons[t]||'';
  }
  // Proxy do grupo Eyedrop/Medição — marca ativo e atualiza ícone
  const _eyedropGroup=['eyedrop','color-sampler','ruler','note','count'];
  const _eProxy=document.getElementById('dtool-eyedrop-proxy');
  if(_eProxy) _eProxy.classList.toggle('active',_eyedropGroup.includes(t));
  if(_eyedropGroup.includes(t)){
    if(typeof dEyedropLast!=='undefined') dEyedropLast=t;
    const _eIcon=document.getElementById('dtool-eyedrop-icon');
    if(_eIcon&&typeof _dEyedropIcons!=='undefined') _eIcon.innerHTML=_dEyedropIcons[t]||'';
  }
  const frame=document.getElementById('d-canvas-frame');
  const ws=document.getElementById('d-workspace');
  const brushOpts=document.getElementById('d-brush-opts');
  if(ws)ws.style.cursor='';
  if(frame){
    if(['brush','eraser','blur','smudge','sharpen'].includes(t))dUpdateBrushCursor(); // cursor circular dinâmico
    else frame.style.cursor=dToolCursors[t]||'default';
  }
  if(brushOpts){brushOpts.style.display=['brush','eraser','blur','smudge','sharpen'].includes(t)?'flex':'none';brushOpts.style.flexDirection='column';}
  const wandOpts=document.getElementById('d-wand-opts');
  if(wandOpts) wandOpts.style.display=(t==='magic-wand')?'flex':'none';
  dShowBrushBar(t);
  dEnsurePaintCanvas();
  dSyncPaintPointer();
  if(typeof dRenderMeasureOverlay==='function') dRenderMeasureOverlay();
}

/* ══ MARQUEE SELECTION (rubber band) ══
   Ferramenta select: arrastar no canvas vazio cria um retângulo que seleciona todos
   os layers cuja bounding box intersecta. Shift adiciona à seleção atual. Clicar/arrastar
   sobre um layer não inicia marquee (o mousedown do layer faz stopPropagation → nem chega
   neste handler) → drag normal continua funcionando. */
let dMarquee = null; // null | { startX, startY, shiftKey }

// Garante o <div#d-marquee> dentro do frame. dRenderCanvas limpa o innerHTML do frame,
// então recriamos sob demanda (mesma estratégia do paint canvas).
function dEnsureMarqueeEl(){
  const frame=document.getElementById('d-canvas-frame');
  if(!frame)return null;
  let el=document.getElementById('d-marquee');
  if(!el || el.parentElement!==frame){
    if(el)el.remove();
    el=document.createElement('div');
    el.id='d-marquee';
    el.setAttribute('aria-hidden','true');
    frame.appendChild(el);
  }
  return el;
}

// Anexa o mousedown do marquee no frame uma única vez (o frame persiste entre renders).
function dAttachMarquee(){
  const frame=document.getElementById('d-canvas-frame');
  if(!frame || frame._marqueeBound)return;
  frame._marqueeBound=true;
  frame.addEventListener('mousedown',dStartMarquee);
  frame.addEventListener('mousedown', function(e) {
    if (typeof dTool !== 'undefined' && dTool === 'ruler') {
      e.preventDefault();
      if (typeof dRulerStart === 'function') {
        dRulerStart(e, this);
      }
    }
  });
}

function dStartMarquee(e){
  // Ferramentas de seleção avançada — roteadas antes do guard canvas-layer
  if(dTool==='obj-select'){
    const frame=document.getElementById('d-canvas-frame');
    if(frame&&typeof dObjSelectStart==='function') dObjSelectStart(e,frame);
    return;
  }
  if(dTool==='quick-select'||dTool==='magic-wand'){
    if(!e.target.classList.contains('canvas-layer')&&!e.target.classList.contains('layer-handle'))
      _dAdvSelFromEvent(e);
    return;
  }
  if(dTool!=='select')return;
  if(e.target.classList.contains('canvas-layer'))return;
  if(e.target.classList.contains('layer-handle'))return;
  const frame=document.getElementById('d-canvas-frame');
  if(!frame)return;
  e.preventDefault(); // evita seleção de texto nativa durante o arrasto
  const rect=frame.getBoundingClientRect();
  const scale=dZoomLevel/100;
  const x=(e.clientX-rect.left)/scale;
  const y=(e.clientY-rect.top)/scale;
  dMarquee={startX:x,startY:y,shiftKey:e.shiftKey};
  const el=dEnsureMarqueeEl();
  if(el){el.style.left=x+'px';el.style.top=y+'px';el.style.width='0px';el.style.height='0px';el.style.display='block';}
  document.addEventListener('mousemove',dUpdateMarquee);
  document.addEventListener('mouseup',dEndMarquee);
}

function dUpdateMarquee(e){
  if(!dMarquee)return;
  const frame=document.getElementById('d-canvas-frame');
  if(!frame)return;
  const rect=frame.getBoundingClientRect();
  const scale=dZoomLevel/100;
  const x=(e.clientX-rect.left)/scale;
  const y=(e.clientY-rect.top)/scale;
  const x1=Math.min(dMarquee.startX,x), y1=Math.min(dMarquee.startY,y);
  const x2=Math.max(dMarquee.startX,x), y2=Math.max(dMarquee.startY,y);
  const el=document.getElementById('d-marquee');
  if(el){el.style.left=x1+'px';el.style.top=y1+'px';el.style.width=(x2-x1)+'px';el.style.height=(y2-y1)+'px';}
}

function dEndMarquee(e){
  document.removeEventListener('mousemove',dUpdateMarquee);
  document.removeEventListener('mouseup',dEndMarquee);
  if(!dMarquee)return;
  const frame=document.getElementById('d-canvas-frame');
  const rect=frame.getBoundingClientRect();
  const scale=dZoomLevel/100;
  const x=(e.clientX-rect.left)/scale;
  const y=(e.clientY-rect.top)/scale;
  const x1=Math.min(dMarquee.startX,x), y1=Math.min(dMarquee.startY,y);
  const x2=Math.max(dMarquee.startX,x), y2=Math.max(dMarquee.startY,y);
  const shiftKey=dMarquee.shiftKey;
  dMarquee=null;

  const MIN_SIZE=6;
  if((x2-x1)>MIN_SIZE || (y2-y1)>MIN_SIZE){
    const hits=dLayers.filter(l=>l.visible && !l.locked && dLayerIntersects(l,x1,y1,x2,y2));
    if(hits.length){
      dHistoryPush();
      if(!shiftKey)dMultiSel=[];
      hits.forEach(l=>{ if(!dMultiSel.includes(l.id))dMultiSel.push(l.id); });
      dSelId=hits[0].id;
      dRenderCanvas();
      dRenderLayersList();
      const l=dLayers.find(z=>z.id===dSelId);
      if(l)dShowProps(l);
      dUpdateCtxBar();
      gToast(hits.length+' layer'+(hits.length>1?'s':'')+' selecionado'+(hits.length>1?'s':''));
    }else if(!shiftKey){
      // Nada interceptado → desseleciona (mesmo efeito de clicar no vazio)
      dSelId=null;dMultiSel=[];
      dRenderCanvas();dRenderLayersList();
      const ns=document.getElementById('d-no-sel'); if(ns)ns.style.display='';
      const pf=document.getElementById('d-props-form'); if(pf)pf.style.display='none';
      dUpdateCtxBar();
    }
  }else if(!shiftKey){
    // clique simples (sem arrasto) no vazio do frame → também desseleciona
    dSelId=null;dMultiSel=[];
    dRenderCanvas();dRenderLayersList();
    const ns=document.getElementById('d-no-sel'); if(ns)ns.style.display='';
    const pf=document.getElementById('d-props-form'); if(pf)pf.style.display='none';
    dUpdateCtxBar();
  }
  // Esconde/limpa o retângulo (se o dRenderCanvas não tiver removido)
  const el=document.getElementById('d-marquee');
  if(el)el.style.display='none';
}

function dLayerIntersects(l,x1,y1,x2,y2){
  return !(l.x+l.w<x1 || l.x>x2 || l.y+l.h<y1 || l.y>y2);
}

/* Helper — converte evento de mouse para coordenadas de design e despacha para a
   ferramenta de seleção avançada ativa (quick-select ou magic-wand). */
function _dAdvSelFromEvent(e){
  const frame=document.getElementById('d-canvas-frame');
  if(!frame)return;
  const rect=frame.getBoundingClientRect();
  const scale=dZoomLevel/100;
  const x=(e.clientX-rect.left)/scale;
  const y=(e.clientY-rect.top)/scale;
  if(dTool==='quick-select'){
    if(typeof dQuickSelectAt==='function') dQuickSelectAt(x,y,e.shiftKey,e.altKey);
  }else if(dTool==='magic-wand'){
    if(typeof dMagicWandSelect!=='function')return;
    const tolEl=document.getElementById('d-wand-tol-input');
    const tol=parseInt((tolEl&&tolEl.value)||'32',10);
    const ids=dMagicWandSelect(x,y,tol);
    if(ids.length){
      dSelId=ids[0];
      dMultiSel=ids.slice(1);
      dRenderCanvas();
      dRenderLayersList();
      gToast('✓ Varinha: '+ids.length+' layer'+(ids.length>1?'s':'')+' selecionado'+(ids.length>1?'s':''));
    }else{
      dSelId=null;dMultiSel=[];
      dRenderCanvas();dRenderLayersList();
      gToast('⚠ Nenhum layer correspondente');
    }
  }
}

/* ══ FERRAMENTA PRANCHETA ══
   Click+drag no workspace → nova prancheta com dimensões desenhadas
   Click em ghost existente → ativa essa prancheta
   Click sem drag significativo → cria prancheta no tamanho do formato atual
══════════════════════════════════════════════════════════════ */
let dABDraw=null;

function dABToolAttach(){
  const ws=document.getElementById('d-workspace');
  if(!ws||ws._abToolAttached)return;
  ws._abToolAttached=true;
  ws.addEventListener('mousedown',dABWorkspaceDown);
}

function dABWorkspaceDown(e){
  if(dTool!=='artboard')return;
  if(typeof dUseArtboards !== 'undefined' && !dUseArtboards){
    gToast('⚠ Não é permitido adicionar pranchetas no modo de Documento Único. Ative "Usar Pranchetas" ao criar o arquivo.', 'error');
    dSetTool('select');
    return;
  }
  // Só reagir a cliques direto no workspace ou no container (fundo), não em ghosts/layers
  const directTargets=['d-workspace','d-canvas-container','d-canvas-bg'];
  const onGhostBody=e.target.classList.contains('ab-ghost-body');
  if(onGhostBody){
    // Clique em prancheta ghost → ativa ela
    const ghost=e.target.closest('.ab-ghost');
    if(ghost&&ghost.dataset.abid){dSetActiveAB(ghost.dataset.abid);dSetTool('select');}
    return;
  }
  if(!directTargets.includes(e.target.id))return;
  e.preventDefault();e.stopPropagation();
  const scale=dZoomLevel/100;
  const wsRect=document.getElementById('d-workspace').getBoundingClientRect();
  const startX=Math.round((e.clientX-wsRect.left)/scale);
  const startY=Math.round((e.clientY-wsRect.top)/scale);
  // Preview visual do retângulo que está sendo desenhado
  const preview=document.createElement('div');
  preview.className='ab-draw-preview';
  preview.style.cssText=`left:${startX*scale}px;top:${startY*scale}px;width:4px;height:4px;`;
  document.getElementById('d-workspace').appendChild(preview);
  dABDraw={startX,startY,curX:startX,curY:startY,preview};
  document.addEventListener('mousemove',dABDrawMove);
  document.addEventListener('mouseup',dABDrawUp);
}

function dABDrawMove(e){
  if(!dABDraw)return;
  const scale=dZoomLevel/100;
  const wsRect=document.getElementById('d-workspace').getBoundingClientRect();
  dABDraw.curX=Math.round((e.clientX-wsRect.left)/scale);
  dABDraw.curY=Math.round((e.clientY-wsRect.top)/scale);
  const x=Math.min(dABDraw.startX,dABDraw.curX);
  const y=Math.min(dABDraw.startY,dABDraw.curY);
  const w=Math.abs(dABDraw.curX-dABDraw.startX);
  const h=Math.abs(dABDraw.curY-dABDraw.startY);
  dABDraw.preview.style.left=x*scale+'px';
  dABDraw.preview.style.top=y*scale+'px';
  dABDraw.preview.style.width=w*scale+'px';
  dABDraw.preview.style.height=h*scale+'px';
  dABDraw.preview.textContent=w>30&&h>30?Math.round(w)+' × '+Math.round(h)+'px':'';
}

function dABDrawUp(e){
  document.removeEventListener('mousemove',dABDrawMove);
  document.removeEventListener('mouseup',dABDrawUp);
  if(!dABDraw)return;
  const {startX,startY,curX,curY,preview}=dABDraw;
  dABDraw=null;
  if(preview)preview.remove();
  const x=Math.min(startX,curX);
  const y=Math.min(startY,curY);
  const w=Math.abs(curX-startX);
  const h=Math.abs(curY-startY);
  if(w<40||h<40){
    // Clique sem drag → cria no formato atual na posição clicada
    dNewArtboard(dFmt,Math.max(40,x),Math.max(40,y));
  }else{
    // Cria com dimensões exatas desenhadas
    dSyncLayersToAB();
    const id='ab-'+Date.now();
    const abX=Math.max(40,x),abY=Math.max(40,y);
    const fw=Math.round(w),fh=Math.round(h);
    const ab={id,name:'Prancheta '+(dArtboards.length+1),x:abX,y:abY,w:fw,h:fh,fmt:dFmt,
      layers:dBuildBlankLayersWH(fw,fh)};
    dArtboards.push(ab);
    dActiveABId=id;
    dLayers=JSON.parse(JSON.stringify(ab.layers));
    dSelId=null;dMultiSel=[];
    dHistoryReset();
    dRenderWorkspace();dApplyFormat();dRenderCanvas();dRenderLayersList();dRenderABList();
    gToast('✓ Prancheta '+fw+'×'+fh+' criada');
  }
  dSetTool('select');
}

// Resolve o valor de fonte do layer em {família, peso}. Presets = Roboto (peso pelo
// descritor); "custom:Família" = fonte enviada pelo usuário (ver designer/fonts.js).
function dTextFontParts(fv){
  const raw=String(fv||'');
  if(raw.startsWith('custom:')){
    const fam=raw.slice(7);
    const cf=(typeof dCustomFonts!=='undefined'&&dCustomFonts)?dCustomFonts.find(f=>f.family===fam):null;
    return {family:`'${fam}', 'Roboto', sans-serif`, weight:(cf&&cf.weight)?cf.weight:400, custom:true, familyName:fam};
  }
  const s=raw.toLowerCase();
  const weight=(s.includes('black')||s.includes('realce'))?900:(s.includes('bold')?700:400);
  return {family:"'Roboto', sans-serif", weight};
}

function dRenderCanvas(){
  const frame=document.getElementById('d-canvas-frame');
  // Detach paint canvas ANTES do innerHTML='' para preservar pixels sem toDataURL.
  // Canvas retém seu backing buffer enquanto a referência DOM existir — reinsere após render.
  const existingPaint=document.getElementById('d-paint-canvas');
  const f=(typeof dPaintTargetSize==='function')?dPaintTargetSize():(DFMT_SIZES[dFmt]||{w:1080,h:1920});
  const paintOk=existingPaint&&existingPaint.width===f.w&&existingPaint.height===f.h;
  if(paintOk) frame.removeChild(existingPaint);
  frame.innerHTML='';
  // Na simulação, aplica bindings (4.1) e regras (4.2) com os valores simulados — espelha o PNG.
  const _simDefs=dSimActive?gVarDefaults():null;
  const _renderLayers=dLayers.map(l=>{
    if(!dSimActive)return l;
    let eff=(typeof gApplyBindings==='function')?gApplyBindings(l,dSimValues,{defaults:_simDefs}):l;
    if(typeof gApplyRules==='function')eff=gApplyRules(eff,dSimValues,{defaults:_simDefs});
    return eff;
  });
  _renderLayers.filter(l=>l.visible && l.type !== 'group').forEach(l=>{
    const el=document.createElement('div');
    el.className='canvas-layer'+(l.id===dSelId?' selected':'')+(l.locked?' layer-locked':'')+(dMultiSel.includes(l.id)?' multi-sel':'');
    el.dataset.id=l.id;
    el.style.cssText=`left:${l.x}px;top:${l.y}px;width:${l.w}px;height:${l.h}px;position:absolute;`;
    // Máscara de camada (alpha) — espelha o PSD; aplica via CSS mask no elemento
    if(l.mask){ const mu='url("'+l.mask+'")'; el.style.webkitMaskImage=mu; el.style.maskImage=mu; el.style.webkitMaskSize=el.style.maskSize='100% 100%'; el.style.webkitMaskRepeat=el.style.maskRepeat='no-repeat'; }
    // Blend mode importado do PSD (camelCase → CSS kebab-case)
    if(l.blendMode) el.style.mixBlendMode=l.blendMode.replace(/([A-Z])/g,c=>'-'+c.toLowerCase());
    // M2.1 — hover no canvas destaca a linha na lista de layers (e vice-versa)
    if(typeof dHoverLayer==='function'){
      el.addEventListener('mouseenter',()=>dHoverLayer(l.id,true));
      el.addEventListener('mouseleave',()=>dHoverLayer(l.id,false));
    }
    if(l.type==='shape'){
      el.style.opacity=(l.opacity||100)/100;
      const kind=l.shapeKind||'rect';
      const pts=(kind!=='circle'&&kind!=='ellipse'&&typeof dShapePoints==='function')?dShapePoints(l):null;
      if(pts){
        // SVG path inline → suporta CANTOS ARREDONDADOS (clip-path:polygon não arredonda).
        // Fica num inner pra não clipar os handles de seleção (que ficam em el).
        const inner=document.createElement('div');
        inner.style.cssText='position:absolute;inset:0;';
        const abs=pts.map(p=>[p[0]*l.w, p[1]*l.h]);
        const d=gRoundPolyD(abs, l.radius||0);
        inner.innerHTML='<svg width="100%" height="100%" viewBox="0 0 '+l.w+' '+l.h+'" preserveAspectRatio="none" style="display:block;overflow:visible"><path d="'+d+'" fill="'+(l.fill||'#FF9000')+'"/></svg>';
        el.appendChild(inner);
      }else{
        el.style.background=l.fill||'#FF9000';
        el.style.borderRadius=(kind==='circle'||kind==='ellipse')?'50%':(l.radius||0)+'px';
      }
    }else if(l.type==='text'){
      // Política de var vazia (3.3): na simulação, layer cujos tokens ficaram todos vazios
      // some — espelha o png-generator (evita "R$" órfão na prévia do designer também).
      if(dSimActive && /\{\{/.test(l.content||'') && gAllVarsEmpty(l.content, dSimValues, gVarDefaults())){
        el.style.display='none';
      }
      el.style.color=l.color||'#fff';
      const _fp=dTextFontParts(l.font);el.style.fontFamily=_fp.family;el.style.fontWeight=_fp.weight;
      el.style.fontSize=(l.fontSize||24)+'px';
      el.style.textAlign=l.textAlign||'left';
      el.style.lineHeight='1.2';el.style.overflow='visible';el.style.pointerEvents='auto';el.style.whiteSpace='pre-wrap';
      if(l.vertical){
        el.style.writingMode='vertical-rl';
      } else {
        el.style.writingMode='';
      }
      // Se é campo variável, mostrar label acima + borda estilo Deskfy
      if(l.isVar){
        el.style.border='1.5px dashed rgba(124,110,255,0.6)';
        el.style.padding='2px 4px';
        el.style.position='relative'; // necessário para label absoluto funcionar
        const lbl=document.createElement('div');
        lbl.style.cssText='position:absolute;top:-18px;left:0;font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7C6EFF;background:rgba(124,110,255,.15);padding:1px 6px;border-radius:3px;font-family:Roboto,sans-serif;white-space:nowrap;';
        lbl.textContent=l.name;
        el.appendChild(lbl);
      }
      const textNode=document.createElement('div');
      textNode.style.cssText='width:100%;height:100%;display:flex;align-items:center;overflow:visible;';
      // sim: valor do usuário vai como texto puro (sem HTML → sem XSS); edição: escapa o
      // conteúdo do designer e só os tokens {{var}} viram badge.
      if(dSimActive){ textNode.textContent=dInterpolate(l.content||''); }
      else { textNode.innerHTML=gEsc(l.content||'').replace(gVarRegex(),'<span class="var-badge">{{$1}}</span>'); }
      if(l.strikethrough)textNode.style.textDecoration='line-through';
      // Efeitos de legibilidade (espelham o png-generator)
      const _fs=l.fontSize||24;
      if(l.bg){textNode.style.background=l.bgColor||'#000';textNode.style.borderRadius=Math.round(_fs*0.2)+'px';}
      if(l.strokeW>0){const sv=l.strokeW+'px '+(l.strokeColor||'#000');textNode.style.webkitTextStroke=sv;textNode.style.textStroke=sv;}
      if(l.shadow){const sb=Math.max(1,_fs*0.12),so=_fs*0.05;textNode.style.textShadow=`${so}px ${so}px ${sb}px ${l.shadowColor||'rgba(0,0,0,.5)'}`;}
      el.appendChild(textNode);
      // Indicador de overflow
      if(dCheckTextOverflow(dSimActive?{...l,content:dInterpolate(l.content||'')}:l)){ // na simulação mede o valor real, não os tokens {{}}
        el.classList.add('text-overflow');
        const ovBadge=document.createElement('div');
        ovBadge.className='text-overflow-badge';
        ovBadge.innerHTML=`<span>OVERFLOW</span><button style="background:rgba(0,0,0,.2);border:none;color:#1A1A1A;font-size:8px;padding:0 3px;border-radius:2px;cursor:pointer;font-weight:700;pointer-events:auto" onclick="event.stopPropagation();dAutoFitText('${l.id}')">⊟ Fit</button>`;
        ovBadge.style.pointerEvents='auto';
        el.appendChild(ovBadge);
      }
    }else if(l.type==='frame'){
      // Moldura de foto — estilo Deskfy
      // el raiz: position:relative, overflow:visible (para botões e labels externos)
      el.style.position='relative';
      el.style.overflow='visible';
      const borderR=(l.frameShape==='circle'?'50%':(l.radius||8)+'px');
      // inner: clip real da imagem
      const inner=document.createElement('div');
      inner.style.cssText=`position:absolute;inset:0;overflow:hidden;border-radius:${borderR};border:2px dashed rgba(255,144,0,0.6);`;
      const simImg=dSimActive&&l.imgVar&&dSimValues[l.imgVar];
      // Placeholder de teste: foto-amostra na proporção escolhida p/ ver o pior caso (só no editor)
      const testSrc=(!simImg&&!l.imgUrl&&dPhTestAR&&typeof dSampleImg==='function')?dSampleImg(dPhTestAR):null;
      const src=simImg||l.imgUrl||testSrc;
      if(src){
        if(simImg)l._simImgUrl=simImg;
        const img=document.createElement('img');
        img.src=src;
        const posX=(0.5+(l.imgOffsetX||0))*100, posY=(0.5+(l.imgOffsetY||0))*100;
        img.style.cssText=`width:100%;height:100%;object-fit:${l.objectFit||'cover'};object-position:${posX}% ${posY}%;display:block;border-radius:${borderR};`;
        if(l.imgScale&&l.imgScale!==1){img.style.transform=`scale(${l.imgScale})`;img.style.transformOrigin='center';}
        if(testSrc)img.style.opacity='.75';
        inner.style.border=testSrc?'2px dashed rgba(255,144,0,.6)':'none';
        inner.appendChild(img);
      }else{
        inner.style.cssText+=`background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;`;
        const ph=document.createElement('div');
        ph.style.cssText='display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;';
        ph.innerHTML=`<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg><span style="font-size:10px;color:rgba(255,255,255,.35);font-family:Roboto,sans-serif;letter-spacing:.04em">${l.imgVar||'foto'}</span>`;
        inner.appendChild(ph);
      }
      el.appendChild(inner);
      // Botão + FOTO (fora do inner, não é clipado)
      const upBtn=document.createElement('button');
      upBtn.style.cssText='position:absolute;top:-10px;right:-10px;background:#FF9000;border:2px solid #1A1A1A;color:#fff;font-size:9px;font-weight:700;padding:3px 8px;border-radius:20px;cursor:pointer;font-family:Roboto,sans-serif;letter-spacing:.04em;z-index:10;white-space:nowrap;';
      upBtn.textContent='+ FOTO';
      upBtn.addEventListener('mousedown',e=>e.stopPropagation());
      upBtn.addEventListener('click',e=>{
        e.stopPropagation();
        const inp=document.createElement('input');inp.type='file';inp.accept='image/*';
        inp.onchange=ev=>{
          const file=ev.target.files[0];if(!file)return;
          const r=new FileReader();
          r.onload=re=>{l.imgUrl=re.result;dRenderCanvas();dMarkUnsaved();gToast('✓ Foto aplicada na moldura!');};
          r.readAsDataURL(file);
        };
        inp.click();
      });
      el.appendChild(upBtn);
      // Botão X limpar foto (só quando tem foto)
      if(simImg||l.imgUrl){
        const clrBtn=document.createElement('button');
        clrBtn.style.cssText='position:absolute;top:-10px;left:-10px;background:#C81818;border:2px solid #1A1A1A;color:#fff;font-size:10px;font-weight:700;width:22px;height:22px;border-radius:50%;cursor:pointer;z-index:10;display:flex;align-items:center;justify-content:center;';
        clrBtn.textContent='×';
        clrBtn.addEventListener('mousedown',e=>e.stopPropagation());
        clrBtn.addEventListener('click',e=>{e.stopPropagation();l.imgUrl='';dRenderCanvas();dMarkUnsaved();});
        el.appendChild(clrBtn);
      }
      // Label do nome da moldura (fora do clip, abaixo)
      const lbl=document.createElement('div');
      lbl.style.cssText='position:absolute;bottom:-20px;left:0;right:0;font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,144,0,.8);font-family:Roboto,sans-serif;text-align:center;pointer-events:none;';
      lbl.textContent=l.name;
      el.appendChild(lbl);
    }else if(l.type==='image'){
      el.style.overflow='hidden';
      const simImg=dSimActive&&l.imgVar&&dSimValues[l.imgVar];
      if(simImg||l.imgUrl){
        if(simImg)l._simImgUrl=simImg;
        const img=document.createElement('img');
        img.src=simImg||l.imgUrl;img.style.cssText=`width:100%;height:100%;object-fit:${l.objectFit||'cover'};`;
        el.appendChild(img);
      }else{
        el.style.cssText+=`background:rgba(255,255,255,.06);border:1px dashed rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:11px;color:rgba(255,255,255,.3);flex-direction:column;gap:4px;`;
        el.innerHTML=`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg><span>${l.imgVar||'imagem'}</span>`;
      }
    }
    if(l.id===dSelId){
      ['br','bl','tr','tl'].forEach(pos=>{
        const h=document.createElement('div');h.className='layer-handle handle-'+pos;
        if(l.locked){h.style.opacity='0.3';h.style.cursor='not-allowed';h.addEventListener('mousedown',e=>{e.stopPropagation();gToast('🔒 Layer bloqueado');});}
        else h.addEventListener('mousedown',e=>{e.stopPropagation();dStartResize(e,l,pos);});
        el.appendChild(h);
      });
    }
    el.addEventListener('mousedown',e=>{
      e.stopPropagation();
      if(dTool==='obj-select'){const _oFr=document.getElementById('d-canvas-frame');if(_oFr&&typeof dObjSelectStart==='function')dObjSelectStart(e,_oFr);return;}
      if(dTool==='quick-select'||dTool==='magic-wand'){_dAdvSelFromEvent(e);return;}
      if(dTool==='eyedrop'){dEyedropFromLayer(l);return;}
      if(dTool==='bucket'){dBucketFillLayer(l);return;}
      if(dTool==='select'){
        if(e.shiftKey){dToggleMultiSel(l.id);return;}
        // Clicar FORA da multi-seleção isola já; clicar num MEMBRO mantém o grupo pra
        // poder mover todos juntos. Isolar um membro por clique simples (M21) fica adiado
        // pro mouseup — só acontece se o usuário NÃO arrastar (dStopDrag em layers.js).
        const _inMulti = dMultiSel.length>0 && dMultiSel.includes(l.id);
        if(dMultiSel.length && !_inMulti) dClearMultiSel();
        
        let shouldSelect = true;
        if (dSelId && dSelId.startsWith('g-') && l.parentId === dSelId) {
          shouldSelect = false;
        }
        if (shouldSelect) {
          dSelLayer(l.id);
        }
        
        if(!l.locked){
          dPendingIsolate = (_inMulti && dMultiSel.length>1) ? l.id : null;
          dStartDrag(e,l);
        } else gToast('🔒 Layer bloqueado. Clique no 🔓 para desbloquear.');
      }
      else if(dTool==='stamp'&&dStampSource){dDoStamp(l);}
    });
    // Double click = edição inline de texto
    if(l.type==='text'){
      el.addEventListener('dblclick',e=>{
        e.stopPropagation();
        const real=dLayers.find(x=>x.id===l.id)||l; // na simulação 'l' pode ser clone (bindings/rules) → edita o original
        dStartInlineEdit(real,el);
      });
    }
    frame.appendChild(el);
  });
  // Recolocar paint canvas: se já existia com tamanho certo, reinserir a mesma referência
  // (pixels intactos, sem nenhuma serialização). Senão, criar via dEnsurePaintCanvas.
  if(paintOk) frame.appendChild(existingPaint);
  else dEnsurePaintCanvas();
  dSyncPaintPointer();
  dAttachMarquee(); // garante o listener de marquee no frame (guarda interna evita duplicar)
}

/* ── EDIÇÃO INLINE DE TEXTO (dblclick na camada) ── */
function dStartInlineEdit(l, el) {
  if(!l || l.type !== 'text') return;
  if(el.dataset.editing === '1') return;
  el.dataset.editing = '1';

  const prev = l.content || '';
  const ta = document.createElement('textarea');
  ta.value = prev;
  // A textarea espelha o visual da camada para o usuário saber o que está editando
  ta.style.cssText = [
    'position:absolute;inset:0;z-index:200;',
    'box-sizing:border-box;width:100%;height:100%;min-height:24px;',
    'background:rgba(10,10,20,.82);',
    'border:2px solid var(--dm-orange);border-radius:3px;outline:none;',
    'resize:none;padding:2px 4px;margin:0;',
    'color:' + (l.color || '#fff') + ';',
    'font-family:' + el.style.fontFamily + ';',
    'font-weight:' + el.style.fontWeight + ';',
    'font-size:' + el.style.fontSize + ';',
    'line-height:1.2;text-align:' + (l.textAlign || 'left') + ';',
    'white-space:pre-wrap;overflow:hidden;',
    l.vertical ? 'writing-mode:vertical-rl;' : '',
  ].join('');

  el.appendChild(ta);
  ta.focus();
  ta.setSelectionRange(0, ta.value.length);

  function commit() {
    const val = ta.value;
    if(ta.parentNode === el) el.removeChild(ta);
    delete el.dataset.editing;
    
    if (l.isTempMaskText) {
      const targetLayer = (typeof dLayers !== 'undefined') && dLayers.find(x => x.id === l.targetMaskLayerId);
      if (targetLayer && val.trim() !== '') {
        const mCanvas = document.createElement('canvas');
        mCanvas.width = targetLayer.w;
        mCanvas.height = targetLayer.h;
        const mCtx = mCanvas.getContext('2d');
        mCtx.clearRect(0, 0, mCanvas.width, mCanvas.height);

        const localX = l.x - targetLayer.x;
        const localY = l.y - targetLayer.y;

        const fp = (typeof dTextFontParts === 'function') ? dTextFontParts(l.font) : {family: "'Roboto', sans-serif", weight: 900};
        mCtx.font = `${fp.weight} ${l.fontSize || 32}px ${fp.family}`;
        mCtx.fillStyle = '#FFFFFF';

        const lines = val.split('\n');
        if (l.vertical) {
          mCtx.textAlign = 'center';
          mCtx.textBaseline = 'middle';
          const fontSize = l.fontSize || 32;
          const charStep = fontSize * 1.1;
          const colStep = fontSize * 1.2;
          const numCols = lines.length;
          const totalTextW = numCols * colStep;
          const startX = localX + l.w / 2 + totalTextW / 2 - colStep / 2;

          lines.forEach((line, i) => {
            const tx = startX - i * colStep;
            const chars = [...line];
            const numChars = chars.length;
            const colH = numChars * charStep;
            
            let ty;
            if(l.textAlign === 'center') {
              ty = localY + l.h / 2 - colH / 2 + charStep / 2;
            } else if(l.textAlign === 'right') {
              ty = localY + l.h - colH + charStep / 2;
            } else {
              ty = localY + charStep / 2;
            }

            chars.forEach((char, j) => {
              const cy = ty + j * charStep;
              mCtx.fillText(char, tx, cy);
            });
          });
        } else {
          mCtx.textAlign = l.textAlign || 'left';
          mCtx.textBaseline = 'top';
          lines.forEach((line, i) => {
            const tx = l.textAlign === 'center' ? localX + l.w / 2
                     : l.textAlign === 'right' ? localX + l.w
                     : localX;
            const ty = localY + i * (l.fontSize || 32) * 1.25;
            mCtx.fillText(line, tx, ty);
          });
        }

        const maskDataUrl = mCanvas.toDataURL('image/png');
        if (typeof dHistoryPush === 'function') dHistoryPush();
        targetLayer.mask = maskDataUrl;
        if (typeof dMarkUnsaved === 'function') dMarkUnsaved();
        if (typeof gToast === 'function') gToast('✓ Máscara de texto aplicada à camada');
      }

      // Limpar camada temporária e restaurar estado
      if (typeof dLayers !== 'undefined') {
        dLayers = dLayers.filter(lyr => lyr.id !== l.id);
      }
      if (typeof dSelId !== 'undefined' && targetLayer) {
        dSelId = targetLayer.id;
      }
      if (typeof dSetTool === 'function') dSetTool('select');
      if (typeof dRenderCanvas === 'function') dRenderCanvas();
      if (typeof dRenderLayersList === 'function') dRenderLayersList();
      if (targetLayer && typeof dShowProps === 'function') dShowProps(targetLayer);
      return;
    }

    if(val !== prev) {
      l.content = val;
      if(typeof dSyncVarsFromContent === 'function') dSyncVarsFromContent(val);
      if(typeof dMarkUnsaved === 'function') dMarkUnsaved();
    }
    if (typeof dRenderCanvas === 'function') dRenderCanvas();
  }

  ta.addEventListener('blur', commit, { once: true });
  ta.addEventListener('keydown', function(e) {
    // Shift+Enter = quebra de linha; Enter sozinho = confirmar
    if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ta.blur(); }
    else if(e.key === 'Escape') { ta.value = prev; ta.blur(); }
    e.stopPropagation(); // impede atalhos do canvas durante a edição
  });
}

/* ── PAINT CANVAS (pincel/borracha) ── */
let dPainting=false,dPaintLast={x:0,y:0};

/* ══ BARRA CONTEXTUAL DINÂMICA ══ */
function dUpdateCtxBar(){
  const bar = document.getElementById('d-ctx-bar');
  if(!bar)return;
  const l = dLayers.find(x=>x.id===dSelId);
  if(!l){bar.innerHTML='<span style="font-size:11px;color:var(--d-text3)">Nenhum layer selecionado — clique no canvas para criar</span>';return;}
  if (l.type === 'group') {
    bar.innerHTML = `<span style="font-size:11px;color:var(--d-text3)">Grupo selecionado: <strong>${gEsc(l.name)}</strong></span>`;
    return;
  }
  const f = DFMT_SIZES[dFmt]||DFMT_SIZES.story;

  let html = '';
  // Posição e tamanho — sempre visíveis
  html += `<div class="ctx-group">
    <span class="ctx-label">X</span>
    <input class="ctx-input" type="number" value="${l.x}" oninput="dUpdateProp('x',this.value)" aria-label="Posição X">
    <span class="ctx-label">Y</span>
    <input class="ctx-input" type="number" value="${l.y}" oninput="dUpdateProp('y',this.value)" aria-label="Posição Y">
    <span class="ctx-label">W</span>
    <input class="ctx-input" type="number" value="${l.w}" oninput="dUpdateProp('w',this.value)" aria-label="Largura">
    <span class="ctx-label">H</span>
    <input class="ctx-input" type="number" value="${l.h}" oninput="dUpdateProp('h',this.value)" aria-label="Altura">
  </div>`;
  html += '<div class="ctx-sep"></div>';

  // Alinhamento rápido
  html += `<div class="ctx-group" title="Alinhar (1 layer = ao canvas; 2+ selecionados = entre si)">
    <button class="ctx-btn" title="Esquerda" onclick="dAlign('left')"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg></button>
    <button class="ctx-btn" title="Centro H" onclick="dAlign('center')"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg></button>
    <button class="ctx-btn" title="Direita" onclick="dAlign('right')"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg></button>
    <button class="ctx-btn" title="Topo" onclick="dAlign('top')"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="3" x2="21" y2="3"/><line x1="9" y1="3" x2="9" y2="15"/><line x1="15" y1="3" x2="15" y2="21"/></svg></button>
    <button class="ctx-btn" title="Centro V" onclick="dAlign('vmid')"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="9" y1="4" x2="9" y2="20"/><line x1="15" y1="7" x2="15" y2="17"/></svg></button>
    <button class="ctx-btn" title="Base" onclick="dAlign('bottom')"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="21" x2="21" y2="21"/><line x1="9" y1="9" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg></button>
    <button class="ctx-btn" title="Distribuir horizontal (3+ selecionados)" onclick="dDistribute('h')"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="4" x2="4" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="20" y1="4" x2="20" y2="20"/></svg></button>
    <button class="ctx-btn" title="Distribuir vertical (3+ selecionados)" onclick="dDistribute('v')"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="4" x2="20" y2="4"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="20" x2="20" y2="20"/></svg></button>
  </div>`;
  html += '<div class="ctx-sep"></div>';

  // Ordem de layer
  html += `<div class="ctx-group">
    <button class="ctx-btn" title="Para frente" onclick="dReorder(1)"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg></button>
    <button class="ctx-btn" title="Para trás" onclick="dReorder(-1)"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></button>
    <button class="ctx-btn" title="Duplicar (Ctrl+D)" onclick="dDuplicateLayer()"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>
    <button class="ctx-btn" title="Deletar (Del)" onclick="dDeleteLayer()" style="color:var(--dm-red)"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>
  </div>`;

  // Propriedades por tipo
  if(l.type==='text'){
    html += '<div class="ctx-sep"></div>';
    const safeCol=(l.color||'#ffffff').startsWith('rgba')?'#ffffff':(l.color||'#ffffff');
    html += `<div class="ctx-group">
      <select class="ctx-select" onchange="dUpdateProp('font',this.value)" aria-label="Fonte">
        ${(typeof dFontOptionsHTML==='function')?dFontOptionsHTML(l.font):`<option value="'Roboto Black'">Roboto Black</option><option value="'Roboto'">Roboto</option><option value="'Roboto',bold">Roboto Bold</option>`}
      </select>
      <input class="ctx-input" type="number" value="${l.fontSize||24}" style="width:40px" oninput="dUpdateProp('fontSize',this.value)" aria-label="Tamanho da fonte">
      <select class="ctx-select" onchange="dUpdateProp('textAlign',this.value)" aria-label="Alinhamento de texto">
        <option value="left" ${l.textAlign==='left'?'selected':''}>⬅</option>
        <option value="center" ${l.textAlign==='center'?'selected':''}>⬛</option>
        <option value="right" ${l.textAlign==='right'?'selected':''}>➡</option>
      </select>
      <div class="ctx-swatch" style="background:${safeCol}" onclick="document.getElementById('ctx-color-pick').click()" title="Cor do texto"></div>
      <input type="color" id="ctx-color-pick" value="${safeCol}" style="display:none" oninput="document.getElementById('ctx-color-sw-val').value=this.value.toUpperCase();document.querySelector('.ctx-swatch').style.background=this.value;dUpdateProp('color',this.value)">
      <input class="ctx-hex" id="ctx-color-sw-val" value="${safeCol.toUpperCase()}" maxlength="7" aria-label="Hex da cor" oninput="if(/^#[0-9A-Fa-f]{6}$/.test(this.value)){document.getElementById('ctx-color-pick').value=this.value;document.querySelector('.ctx-swatch').style.background=this.value;dUpdateProp('color',this.value);}">
    </div>`;
    // Efeitos de legibilidade: contorno, sombra e realce (caixa atrás do texto)
    html += `<div class="ctx-sep"></div>
    <div class="ctx-group">
      <span class="ctx-label">Contorno</span>
      <input class="ctx-input" type="number" min="0" max="20" value="${l.strokeW||0}" style="width:36px" oninput="dUpdateProp('strokeW',this.value)" title="Espessura do contorno (0 = off)">
      <input type="color" value="${l.strokeColor||'#000000'}" style="width:24px;height:22px;border:none;background:none;cursor:pointer" oninput="dUpdateProp('strokeColor',this.value)" title="Cor do contorno">
      <span class="ctx-label">Sombra</span>
      <button class="ctx-btn ${l.shadow?'active':''}" onclick="dUpdateProp('shadow',${l.shadow?'false':'true'})" title="Liga/desliga sombra">${l.shadow?'on':'off'}</button>
      <input type="color" value="${(l.shadowColor||'#000000').slice(0,7)}" style="width:24px;height:22px;border:none;background:none;cursor:pointer" oninput="dUpdateProp('shadowColor',this.value)" title="Cor da sombra">
      <span class="ctx-label">Realce</span>
      <button class="ctx-btn ${l.bg?'active':''}" onclick="dUpdateProp('bg',${l.bg?'false':'true'})" title="Caixa de realce atrás do texto">${l.bg?'on':'off'}</button>
      <input type="color" value="${l.bgColor||'#000000'}" style="width:24px;height:22px;border:none;background:none;cursor:pointer" oninput="dUpdateProp('bgColor',this.value)" title="Cor do realce">
    </div>`;
  }else if(l.type==='shape'){
    html += '<div class="ctx-sep"></div>';
    const kind=l.shapeKind||'rect';
    const sopt=(v,t)=>`<option value="${v}" ${kind===v?'selected':''}>${t}</option>`;
    html += `<div class="ctx-group">
      <span class="ctx-label">Forma</span>
      <select class="ctx-input" style="width:96px" onchange="dUpdateProp('shapeKind',this.value)" aria-label="Tipo de forma">
        ${sopt('rect','Retângulo')}${sopt('circle','Círculo')}${sopt('ellipse','Elipse')}${sopt('triangle','Triângulo')}${sopt('polygon','Polígono')}${sopt('star','Estrela')}
      </select>
      ${kind==='polygon'?`<span class="ctx-label">Lados</span><input class="ctx-input" type="number" min="3" max="12" value="${l.sides||6}" style="width:40px" oninput="dUpdateProp('sides',this.value)" aria-label="Lados">`:''}
      ${kind==='star'?`<span class="ctx-label">Pontas</span><input class="ctx-input" type="number" min="3" max="12" value="${l.points||5}" style="width:40px" oninput="dUpdateProp('points',this.value)" aria-label="Pontas">`:''}
    </div>`;
    const fill=l.fill||'#FF9000';
    html += `<div class="ctx-group">
      <span class="ctx-label">Fill</span>
      <div class="ctx-swatch" style="background:${fill}" onclick="document.getElementById('ctx-fill-pick').click()" title="Cor de preenchimento"></div>
      <input type="color" id="ctx-fill-pick" value="${fill}" style="display:none" oninput="document.getElementById('ctx-fill-hex').value=this.value.toUpperCase();document.querySelectorAll('.ctx-swatch')[0].style.background=this.value;dUpdateProp('fill',this.value)">
      <input class="ctx-hex" id="ctx-fill-hex" value="${fill.toUpperCase()}" maxlength="7" aria-label="Hex do fill" oninput="if(/^#[0-9A-Fa-f]{6}$/.test(this.value)){document.getElementById('ctx-fill-pick').value=this.value;dUpdateProp('fill',this.value);}">
      <span class="ctx-label">Opac.</span>
      <input class="ctx-input" type="number" value="${l.opacity||100}" min="0" max="100" style="width:40px" oninput="dUpdateProp('opacity',this.value)" aria-label="Opacidade">
      <span class="ctx-label">%</span>
      <span class="ctx-label">Rx</span>
      <input class="ctx-input" type="number" value="${l.radius||0}" min="0" style="width:40px" oninput="dUpdateProp('radius',this.value)" aria-label="Border radius">
    </div>`;
  }else if(l.type==='frame'){
    html += '<div class="ctx-sep"></div>';
    html += `<div class="ctx-group">
      <span class="ctx-label">Forma</span>
      <select class="ctx-select" onchange="dUpdateProp('frameShape',this.value)" aria-label="Forma da moldura">
        <option value="rect" ${l.frameShape==='rect'?'selected':''}>Retângulo</option>
        <option value="rounded" ${l.frameShape==='rounded'?'selected':''}>Arredondado</option>
        <option value="circle" ${l.frameShape==='circle'?'selected':''}>Círculo</option>
      </select>
      <span class="ctx-label">Rx</span>
      <input class="ctx-input" type="number" value="${l.radius||8}" min="0" max="999" style="width:40px" oninput="dUpdateProp('radius',this.value)" aria-label="Radius da moldura">
      <select class="ctx-select" onchange="dUpdateProp('objectFit',this.value)" aria-label="Modo de encaixe">
        <option value="cover" ${l.objectFit==='cover'?'selected':''}>cover</option>
        <option value="contain" ${l.objectFit==='contain'?'selected':''}>contain</option>
      </select>
      <button class="ctx-btn" title="Carregar foto" onclick="document.getElementById('ctx-frame-upload').click()" style="color:var(--dm-orange)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      </button>
      <input type="file" id="ctx-frame-upload" accept="image/*" style="display:none" onchange="(function(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=re=>{const l=dLayers.find(x=>x.id===dSelId);if(l){l.imgUrl=re.result;dRenderCanvas();dMarkUnsaved();dUpdateCtxBar();gToast('✓ Foto aplicada!');}};r.readAsDataURL(f);})(event)">
      ${l.imgUrl?`<button class="ctx-btn" title="Limpar foto" onclick="dUpdateProp('imgUrl','');dUpdateCtxBar()" style="color:var(--dm-red)">✕</button>`:''}
    </div>`;
    // Enquadramento da foto dentro da moldura + teste de proporção (pior caso)
    html += `<div class="ctx-sep"></div>
    <div class="ctx-group">
      <span class="ctx-label">Zoom</span>
      <input class="ctx-input" type="number" min="100" max="400" step="5" value="${Math.round((l.imgScale||1)*100)}" style="width:46px" oninput="dUpdateProp('imgScale',this.value/100)" title="Zoom da foto na moldura (%)">
      <span class="ctx-label">X</span>
      <input class="ctx-input" type="number" min="-50" max="50" value="${Math.round((l.imgOffsetX||0)*100)}" style="width:40px" oninput="dUpdateProp('imgOffsetX',this.value/100)" title="Deslocar foto na horizontal (%)">
      <span class="ctx-label">Y</span>
      <input class="ctx-input" type="number" min="-50" max="50" value="${Math.round((l.imgOffsetY||0)*100)}" style="width:40px" oninput="dUpdateProp('imgOffsetY',this.value/100)" title="Deslocar foto na vertical (%)">
      <span class="ctx-label">Testar foto</span>
      <select class="ctx-select" onchange="dSetPhTest(this.value)" aria-label="Testar proporção de foto">
        <option value="" ${!dPhTestAR?'selected':''}>—</option>
        <option value="portrait" ${dPhTestAR==='portrait'?'selected':''}>Retrato</option>
        <option value="landscape" ${dPhTestAR==='landscape'?'selected':''}>Paisagem</option>
        <option value="square" ${dPhTestAR==='square'?'selected':''}>Quadrado</option>
      </select>
    </div>`;
  }

  bar.innerHTML = html;
}



/* ══ SMART GUIDES & SNAP ══ */
const SNAP_THRESHOLD = 6; // pixels do canvas
function dCalculateSnap(movingLayer, newX, newY){
  if(!dSnapEnabled)return {x:newX, y:newY, guides:[]};
  const f=DFMT_SIZES[dFmt]||DFMT_SIZES.story;
  const guides=[];
  const movEdges={
    x:[newX, newX+movingLayer.w/2, newX+movingLayer.w],
    y:[newY, newY+movingLayer.h/2, newY+movingLayer.h]
  };
  // Edges do canvas
  const canvasEdges={x:[0, f.w/2, f.w], y:[0, f.h/2, f.h]};
  // Edges dos outros layers
  const layerEdges={x:[], y:[]};
  dLayers.forEach(l=>{
    if(l.id===movingLayer.id||!l.visible)return;
    layerEdges.x.push(l.x, l.x+l.w/2, l.x+l.w);
    layerEdges.y.push(l.y, l.y+l.h/2, l.y+l.h);
  });
  // Buscar snap para X
  let bestDx=0, bestDxAbs=SNAP_THRESHOLD+1;
  movEdges.x.forEach((mx,mi)=>{
    [...canvasEdges.x, ...layerEdges.x].forEach(ox=>{
      const d=ox-mx;
      if(Math.abs(d)<bestDxAbs){
        bestDxAbs=Math.abs(d);
        bestDx=d;
      }
    });
  });
  // Buscar snap para Y
  let bestDy=0, bestDyAbs=SNAP_THRESHOLD+1;
  movEdges.y.forEach((my,mi)=>{
    [...canvasEdges.y, ...layerEdges.y].forEach(oy=>{
      const d=oy-my;
      if(Math.abs(d)<bestDyAbs){
        bestDyAbs=Math.abs(d);
        bestDy=d;
      }
    });
  });
  const finalX=bestDxAbs<=SNAP_THRESHOLD?newX+bestDx:newX;
  const finalY=bestDyAbs<=SNAP_THRESHOLD?newY+bestDy:newY;
  // Gerar guias visuais para os alinhamentos detectados
  if(bestDxAbs<=SNAP_THRESHOLD){
    const snappedX=finalX;
    const matchEdges=[snappedX, snappedX+movingLayer.w/2, snappedX+movingLayer.w];
    [...canvasEdges.x, ...layerEdges.x].forEach(ox=>{
      if(matchEdges.some(me=>Math.abs(me-ox)<0.5)){
        guides.push({type:'v', pos:ox});
      }
    });
  }
  if(bestDyAbs<=SNAP_THRESHOLD){
    const snappedY=finalY;
    const matchEdges=[snappedY, snappedY+movingLayer.h/2, snappedY+movingLayer.h];
    [...canvasEdges.y, ...layerEdges.y].forEach(oy=>{
      if(matchEdges.some(me=>Math.abs(me-oy)<0.5)){
        guides.push({type:'h', pos:oy});
      }
    });
  }
  return {x:Math.round(finalX), y:Math.round(finalY), guides};
}

let dSnapEnabled = true;
function dToggleSnap(){
  dSnapEnabled=!dSnapEnabled;
  const btn=document.getElementById('dt-snap-btn');
  if(btn)btn.classList.toggle('active',dSnapEnabled);
  gToast(dSnapEnabled?'✓ Snap ativado':'Snap desativado');
  if(!dSnapEnabled)dClearGuides();
}

function dShowGuides(guides){
  dClearGuides();
  const frame=document.getElementById('d-canvas-frame');
  if(!frame)return;
  const f=DFMT_SIZES[dFmt]||DFMT_SIZES.story;
  guides.forEach(g=>{
    const el=document.createElement('div');
    el.className='smart-guide '+g.type+' yng-guide';
    if(g.type==='v'){el.style.cssText=`left:${g.pos}px;top:0;height:${f.h}px;`;}
    else{el.style.cssText=`top:${g.pos}px;left:0;width:${f.w}px;`;}
    frame.appendChild(el);
    // M2.3 — medida em px junto da guia (feedback tangível do snap)
    const tag=document.createElement('div');
    tag.className='snap-tag yng-guide';
    tag.textContent=Math.round(g.pos)+' px';
    if(g.type==='v'){tag.style.cssText=`left:${g.pos+4}px;top:8px;`;}
    else{tag.style.cssText=`top:${g.pos+4}px;left:8px;`;}
    frame.appendChild(tag);
  });
}
function dClearGuides(){
  document.querySelectorAll('.yng-guide').forEach(g=>g.remove());
}



/* ══ SIMULAR DADOS REAIS ══ */
let dSimValues = {};  // {nomeVar: valor}
let dSimActive = false;

function dOpenSimModal(){
  // Extrair todas as variáveis do template
  const usedVars = new Set();
  dLayers.forEach(l=>{
    if(l.type==='text'&&l.content){
      const matches=l.content.matchAll(gVarRegex());
      for(const m of matches)usedVars.add(m[1]);
    }
    if((l.type==='frame'||l.type==='image')&&l.imgVar)usedVars.add(l.imgVar);
  });
  if(usedVars.size===0){
    gToast('⚠ Nenhuma variável encontrada no template');
    return;
  }
  const body=document.getElementById('d-sim-body');
  const varsArr=[...usedVars];
  body.innerHTML=`<p style="color:#888;font-size:12px;margin-bottom:14px;line-height:1.5">Preencha valores reais para cada variável e clique em <strong style="color:var(--dm-orange)">Aplicar</strong> para ver como ficará a arte com dados reais.</p>`+
    varsArr.map(vn=>{
      const v=dVars.find(x=>x.name===vn);
      const label=v?v.label:vn;
      const type=v?v.type:'text';
      const cur=dSimValues[vn]||'';
      // V6: contador de caracteres (vs maxLen da var, se houver) + flag de overflow
      const maxLen=(v&&v.maxLen)?v.maxLen:0;
      const meta=`<span class="sim-count" id="sim-count-${vn}"></span><span class="sim-overflow" id="sim-ovf-${vn}" style="display:none">⚠ não cabe no layout</span>`;
      if(type==='image'){
        return `<div class="sim-row"><label>${gEsc(label)} <span style="color:#666;font-weight:400">(${vn})</span> · imagem</label><input type="text" placeholder="URL da imagem ou cole base64" value="${gEsc(cur)}" oninput="dSimVarInput('${vn}',this.value,${maxLen})"></div>`;
      }
      const longText=label.toLowerCase().includes('descri')||label.toLowerCase().includes('texto');
      if(longText){
        return `<div class="sim-row"><label>${gEsc(label)} <span style="color:#666;font-weight:400">(${vn})</span>${meta}</label><textarea rows="2" placeholder="Digite o valor..." oninput="dSimVarInput('${vn}',this.value,${maxLen})">${gEsc(cur)}</textarea></div>`;
      }
      return `<div class="sim-row"><label>${gEsc(label)} <span style="color:#666;font-weight:400">(${vn})</span>${meta}</label><input type="text" placeholder="Digite o valor..." value="${gEsc(cur)}" oninput="dSimVarInput('${vn}',this.value,${maxLen})"></div>`;
    }).join('');
  // estado inicial dos contadores/flags
  varsArr.forEach(vn=>{const v=dVars.find(x=>x.name===vn);dSimVarUpdateMeta(vn,dSimValues[vn]||'',(v&&v.maxLen)?v.maxLen:0);});
  document.getElementById('d-sim-modal').classList.add('open');
}
// V6: atualiza valor simulado + contador + flag de overflow no modal de simulação
function dSimVarInput(vn,value,maxLen){
  dSimValues[vn]=value;
  dSimVarUpdateMeta(vn,value,maxLen||0);
  if(dSimActive)dRenderCanvas(); // reflete na prévia em tempo real se a simulação está ativa
}
function dSimVarUpdateMeta(vn,value,maxLen){
  const cEl=document.getElementById('sim-count-'+vn);
  if(cEl){
    const len=(value||'').length;
    cEl.textContent = maxLen ? `${len}/${maxLen}` : (len?`${len} car.`:'');
    cEl.style.color = (maxLen && len>maxLen) ? 'var(--dm-red)' : '';
  }
  const oEl=document.getElementById('sim-ovf-'+vn);
  if(oEl) oEl.style.display = dSimVarOverflow(vn,value) ? '' : 'none';
}
// Testa se o texto simulado caberia nos layers que usam a variável (usa dCheckTextOverflow)
function dSimVarOverflow(vn,value){
  if(typeof dCheckTextOverflow!=='function')return false;
  const reTok=new RegExp('\\{\\{\\s*'+vn+'\\s*\\}\\}');
  const sim={...dSimValues,[vn]:value};
  return dLayers.some(l=>{
    if(l.type!=='text'||!l.content||!reTok.test(l.content))return false;
    const interp=gInterpolate(l.content,sim,{onEmpty:'remove',defaults:gVarDefaults()});
    return dCheckTextOverflow({...l,content:interp});
  });
}
function dCloseSimModal(){document.getElementById('d-sim-modal').classList.remove('open');}
function dApplySim(){
  dSimActive=true;
  document.body.classList.add('simulating');
  dRenderCanvas();
  dCloseSimModal();
  const cnt=Object.keys(dSimValues).filter(k=>dSimValues[k]).length;
  gToast('✓ Simulação ativa com '+cnt+' variável(is) preenchida(s) — clique em "Limpar simulação" pra voltar');
  // botão visual na topbar
  const ind=document.getElementById('d-sim-indicator');
  if(ind)ind.style.display='flex';
}
function dResetSim(){
  dSimValues={};
  dSimActive=false;
  document.body.classList.remove('simulating');
  dRenderCanvas();
  const ind=document.getElementById('d-sim-indicator');
  if(ind)ind.style.display='none';
  gToast('Simulação desativada');
}
// Helper para substituir {{var}} pelos valores simulados
function dInterpolate(text){
  if(!dSimActive)return text;
  // Mesma regra do PNG: campo vazio cai no defaultValue da var, senão '' (3.1/3.3)
  return gInterpolate(text, dSimValues, {onEmpty:'remove', defaults:gVarDefaults()});
}




/* ══ RULERS / RÉGUAS ══ */
let dRulersOn = false;
function dToggleRulers(){
  dRulersOn=!dRulersOn;
  document.body.classList.toggle('rulers-on',dRulersOn);
  ['d-ruler-h','d-ruler-v','d-ruler-corner'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.style.display=dRulersOn?'block':'none';
  });
  const btn=document.getElementById('dt-rulers-btn');
  if(btn)btn.classList.toggle('active',dRulersOn);
  if(dRulersOn)dRenderRulers();
  gToast(dRulersOn?'✓ Réguas ativas':'Réguas ocultas');
}
function dRenderRulers(){
  if(!dRulersOn)return;
  const f=DFMT_SIZES[dFmt]||DFMT_SIZES.story;
  const scale=dZoomLevel/100;
  const step= f.w>1500 ? 100 : (f.w>800 ? 50 : 25);
  const rh=document.getElementById('d-ruler-h');
  const rv=document.getElementById('d-ruler-v');
  if(!rh||!rv)return;
  // Limpar
  rh.innerHTML='';rv.innerHTML='';
  // Marks horizontais — em coordenadas de tela
  for(let x=0;x<=f.w;x+=step){
    const sx=x*scale;
    const mark=document.createElement('div');
    mark.className='ruler-mark h'+(x%(step*2)===0?' lg':'');
    mark.style.left=sx+'px';
    rh.appendChild(mark);
    if(x%(step*2)===0&&x>0){
      const lbl=document.createElement('div');
      lbl.className='ruler-mark-label h';
      lbl.style.left=sx+'px';
      lbl.textContent=x;
      rh.appendChild(lbl);
    }
  }
  // Marks verticais
  for(let y=0;y<=f.h;y+=step){
    const sy=y*scale;
    const mark=document.createElement('div');
    mark.className='ruler-mark v'+(y%(step*2)===0?' lg':'');
    mark.style.top=sy+'px';
    rv.appendChild(mark);
    if(y%(step*2)===0&&y>0){
      const lbl=document.createElement('div');
      lbl.className='ruler-mark-label v';
      lbl.style.top=sy+'px';
      lbl.textContent=y;
      rv.appendChild(lbl);
    }
  }
}

