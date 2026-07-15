/**
 * js/designer/canvas.js
 *
 * Render do canvas, zoom, pan, formato, réguas, barra contextual,
 * smart guides, simulacao de dados e interacoes de mouse.
 * Depende de: designer/templates.js, designer/layers.js
 */

function dSetFormat(fmt,btn){
  const prevFmt=dFmt;
  // Captura o tamanho ATUAL (antes de trocar fmt/dCustomFmt) — é a origem do smart-resize.
  // Tem que vir antes, senão dGetActiveAB já reescreve ab.w/h pro tamanho novo e from===to.
  const _abFrom=dGetActiveAB&&dGetActiveAB();
  const from=_abFrom?{w:_abFrom.w,h:_abFrom.h}:(DFMT_SIZES[prevFmt]||DFMT_SIZES.story);
  dFmt=fmt;
  dCustomFmt=null; // troca pra um preset nomeado → descarta qualquer override ad-hoc de tamanho
  document.querySelectorAll('.dt-fmt').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  // Atualiza dimensões do artboard ativo
  const ab=dGetActiveAB&&dGetActiveAB();
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
  if(typeof _dSyncAllPositions==='function')_dSyncAllPositions();
  if(typeof dApplyBg==='function')dApplyBg(ab);
  document.getElementById('d-dim-label').textContent=f.w+' × '+f.h+'  '+Math.round(dZoomLevel)+'%';
  // Atualiza label do artboard ativo
  const abl=document.getElementById('d-ab-active-label');
  if(abl&&ab)abl.textContent=ab.name;
}
function dFitToScreen(){
  const wrapper=document.getElementById('d-canvas-wrapper');
  const pw=wrapper.clientWidth-80,ph=wrapper.clientHeight-80;
  if(!pw||!ph)return;
  const ab=dGetActiveAB&&dGetActiveAB();
  const f=ab?{w:ab.w,h:ab.h}:(DFMT_SIZES[dFmt]||DFMT_SIZES.story);
  const s=Math.min(pw/f.w,ph/f.h,1)*100;
  dZoomLevel=Math.max(10,Math.round(s));
  document.getElementById('d-zoom-val').textContent=dZoomLevel+'%';
  dApplyFormat(true);
  const container=document.getElementById('d-canvas-container');
  if(container){
    wrapper.scrollLeft=Math.max(0,container.offsetLeft-(wrapper.clientWidth-container.offsetWidth)/2);
    wrapper.scrollTop=Math.max(0,container.offsetTop-(wrapper.clientHeight-container.offsetHeight)/2);
  }
}
function dPositionArtboard(){
  if(typeof _dSyncAllPositions==='function')_dSyncAllPositions();
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
  
  let ax=null,ay=null,fx=0.5,fy=0.5;
  const refEl=container;
  if(wrapper){
    const wr=wrapper.getBoundingClientRect();
    ax=(clientX!=null)?clientX:wr.left+wrapper.clientWidth/2;
    ay=(clientY!=null)?clientY:wr.top+wrapper.clientHeight/2;
    if(refEl){
      const cr=refEl.getBoundingClientRect();
      fx=cr.width?(ax-cr.left)/cr.width:0.5;
      fy=cr.height?(ay-cr.top)/cr.height:0.5;
    }
  }

  dZoomLevel=Math.min(400,Math.max(10,Math.round(z)));
  document.getElementById('d-zoom-val').textContent=dZoomLevel+'%';

  if(container)container.style.transition='width 0.2s cubic-bezier(0.25,0.46,0.45,0.94),height 0.2s';
  if(frame)frame.style.transition='width 0.2s cubic-bezier(0.25,0.46,0.45,0.94),height 0.2s,transform 0.2s';

  dApplyFormat();

  setTimeout(()=>{
    if(container)container.style.transition='none';
    if(frame)frame.style.transition='none';
  },220);

  if(wrapper&&refEl){
    const wr=wrapper.getBoundingClientRect();
    // Tamanho ALVO calculado analiticamente (mesma conta do dApplyFormat): ler
    // offsetWidth/offsetHeight aqui retorna o valor ANTIGO — a transição CSS de
    // width/height acabou de começar — e o ponto sob o cursor derivava a cada zoom.
    const _ab=(typeof dGetActiveAB==='function')?dGetActiveAB():null;
    const _f=_ab?{w:_ab.w,h:_ab.h}:(DFMT_SIZES[dFmt]||DFMT_SIZES.story);
    const _tw=Math.round(_f.w*dZoomLevel/100), _th=Math.round(_f.h*dZoomLevel/100);
    wrapper.scrollTo({
      left:Math.max(0,refEl.offsetLeft+fx*_tw-(ax-wr.left)),
      top:Math.max(0,refEl.offsetTop+fy*_th-(ay-wr.top)),
      behavior:'smooth'
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

/* ── helpers de tamanho e posicionamento — canvas único ── */
function _dSyncAllPositions(){
  const scale=dZoomLevel/100;
  const container=document.getElementById('d-canvas-container');
  const ws=document.getElementById('d-workspace');
  const wrapper=document.getElementById('d-canvas-wrapper');
  if(!container||!ws)return;
  const ab=dGetActiveAB&&dGetActiveAB();
  const f=ab?{w:ab.w,h:ab.h}:(DFMT_SIZES[dFmt]||DFMT_SIZES.story);
  const cw=Math.round(f.w*scale);
  const ch=Math.round(f.h*scale);
  const vw=wrapper?wrapper.clientWidth:1200;
  const vh=wrapper?wrapper.clientHeight:800;
  const margin=200;
  const wsW=Math.max(vw,cw+2*margin);
  const wsH=Math.max(vh,ch+2*margin);
  ws.style.width=wsW+'px';
  ws.style.height=wsH+'px';
  if(container.parentElement===ws){
    container.style.left=Math.round((wsW-cw)/2)+'px';
    container.style.top=Math.round((wsH-ch)/2)+'px';
  }
}
function _dSizeWorkspace(){ _dSyncAllPositions(); }
function _dRenderPreview(frame,ab){
  frame.innerHTML='';
  const bg=ab&&ab.bg;
  frame.style.background=(bg&&bg!=='transparent')?(bg==='white'?'#ffffff':bg):'';
  const layers=ab.layers||[];
  layers.filter(l=>l.visible!==false&&l.type!=='group').forEach(l=>{
    const el=document.createElement('div');
    el.style.cssText='position:absolute;left:'+l.x+'px;top:'+l.y+'px;width:'+l.w+'px;height:'+l.h+'px;overflow:hidden;';
    el.style.opacity=(typeof l.opacity==='number'?l.opacity:100)/100;
    if(l.blendMode)el.style.mixBlendMode=l.blendMode.replace(/([A-Z])/g,c=>'-'+c.toLowerCase());
    if(l.type==='shape'){
      const kind=l.shapeKind||'rect';
      el.style.background=(typeof dFxShapeBg==='function')?dFxShapeBg(l):(l.fill||'#FF9000');
      if(kind==='circle'||kind==='ellipse'){el.style.borderRadius='50%';}
      else{ const _cr=(typeof dCornerRadii==='function')?dCornerRadii(l):{tl:l.radius||0,tr:l.radius||0,br:l.radius||0,bl:l.radius||0}; el.style.borderRadius=_cr.tl+'px '+_cr.tr+'px '+_cr.br+'px '+_cr.bl+'px'; }
      const _bs=(typeof dFxStrokeParts==='function')?dFxStrokeParts(l).concat(dFxShadowParts(l)):[];
      if(_bs.length) el.style.boxShadow=_bs.join(', ');
    } else if(l.type==='text'){
      el.style.color=l.color||'#fff';
      el.style.fontSize=(l.fontSize||24)+'px';
      el.style.fontFamily="'Roboto',sans-serif";
      el.style.fontWeight=l.fontWeight||'400';
      el.style.textAlign=l.textAlign||'left';
      el.style.lineHeight='1.2';
      el.style.whiteSpace='pre-wrap';
      el.textContent=l.content||'';
    } else if(l.type==='image'||l.type==='frame'){
      if(l.imgUrl){
        const img=document.createElement('img');
        img.src=l.imgUrl;
        img.style.cssText='width:100%;height:100%;object-fit:cover;display:block;';
        el.appendChild(img);
      }
    }
    frame.appendChild(el);
  });
}

function dRenderWorkspace(){
  const ws=document.getElementById('d-workspace');if(!ws)return;
  const container=document.getElementById('d-canvas-container');
  ws.querySelectorAll('.ab-wrap,.ab-ghost').forEach(el=>el.remove());
  if(container&&container.parentElement!==ws) ws.appendChild(container);
  _dSyncAllPositions();
  if(typeof dAttachMarquee==='function')dAttachMarquee();
}

// Stubs para compatibilidade com código que chama estas funções
function dABAddResizeHandles(){}
function dABToolAttach(){}

/* ── TOOL ── */
// Cursores customizados por ferramenta (SVG inline, estilo Photoshop). brush/eraser
// usam cursor dinâmico (dUpdateBrushCursor) que segue o tamanho do pincel + zoom.
const dToolCursors = {
  select: 'default',
  hand: 'grab',
  'var-data': `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23FFB900' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'/><path d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'/></svg>") 4 4, crosshair`,
  'qr-code': 'crosshair',
  'magic-eraser': 'crosshair',
  artboard: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%230A0A0A' stroke-width='2' stroke-linecap='round'><rect x='5' y='5' width='14' height='14' rx='1'/><line x1='2' y1='5' x2='5' y2='5'/><line x1='5' y1='2' x2='5' y2='5'/><line x1='19' y1='2' x2='19' y2='5'/><line x1='19' y1='5' x2='22' y2='5'/><line x1='2' y1='19' x2='5' y2='19'/><line x1='5' y1='19' x2='5' y2='22'/><line x1='19' y1='19' x2='19' y2='22'/><line x1='19' y1='19' x2='22' y2='19'/></svg>") 5 5, cell`,

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
// Inclui blur/smudge/sharpen: dSetTool delega o cursor deles pra cá (senão fica o cursor stale).
function dUpdateBrushCursor(){
  if(!['brush','eraser','blur','smudge','sharpen','bg-eraser'].includes(dTool))return;
  const sizeEl=document.getElementById('d-brush-size');
  const size=parseInt((sizeEl&&sizeEl.value)||'8',10);
  const scale=dZoomLevel/100;
  const displaySize=Math.max(8,Math.round(size*scale));
  const half=Math.round(displaySize/2);
  const color=(dTool==='eraser'||dTool==='bg-eraser')?'%23aaaaaa':'%23FF9000';
  const cursor=`url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='${displaySize}' height='${displaySize}' viewBox='0 0 ${displaySize} ${displaySize}'><circle cx='${half}' cy='${half}' r='${half-1}' fill='none' stroke='${color}' stroke-width='1.5' opacity='0.85'/><circle cx='${half}' cy='${half}' r='1' fill='${color}'/></svg>") ${half} ${half}, crosshair`;
  const frame=document.getElementById('d-canvas-frame');
  if(frame)frame.style.cursor=cursor;
}

function dSetTool(t){
  dTool=t;
  window.dPainting = false; // Reset seguro para pincéis
  // Registra as tools possíveis no dSetTool loop de active toggle
  ['select','obj-select','quick-select','magic-wand','hand','text','rect','ellipse','triangle','polygon','star','line','frame','img','var-data','qr-code','brush','eraser','stamp','bg-eraser','magic-eraser','bucket','gradient','blur','sharpen','smudge','eyedrop','color-sampler','ruler','note','count','text-h','text-v','mask-text-h','mask-text-v'].forEach(x=>{
    const b=document.getElementById('dtool-'+x);
    if(b){b.classList.toggle('active',x===t);}
  });

  // Helper para atualizar proxies
  const groups = [
    { name: 'select', proxy: 'dtool-select-proxy', iconId: 'dtool-select-icon', tools: ['select', 'hand', 'obj-select', 'quick-select', 'magic-wand'], lastVar: 'dSelectLast', iconMap: '_dSelectIcons' },
    { name: 'text', proxy: 'dtool-text-proxy', iconId: 'dtool-text-icon', tools: ['text', 'text-h', 'text-v', 'mask-text-h', 'mask-text-v'], lastVar: 'dTextLast', iconMap: '_dTextIcons' },
    { name: 'forma', proxy: 'dtool-forma-proxy', iconId: 'dtool-forma-icon', tools: ['rect', 'ellipse', 'triangle', 'polygon', 'star', 'line'], lastVar: 'dFormaLast', iconMap: '_dFormaIcons' },
    { name: 'frame', proxy: 'dtool-frame-proxy', iconId: 'dtool-frame-icon', tools: ['frame', 'img'], lastVar: 'dFrameLast', iconMap: '_dFrameIcons' },
    { name: 'data', proxy: 'dtool-data-proxy', iconId: 'dtool-data-icon', tools: ['var-data', 'qr-code'], lastVar: 'dDataLast', iconMap: '_dDataIcons' },
    { name: 'brush', proxy: 'dtool-brush-proxy', iconId: 'dtool-brush-icon', tools: ['brush', 'eraser', 'stamp', 'bg-eraser', 'magic-eraser'], lastVar: 'dBrushLast', iconMap: '_dBrushIcons' },
    { name: 'fill', proxy: 'dtool-fill-proxy', iconId: 'dtool-fill-icon', tools: ['bucket', 'gradient'], lastVar: 'dFillLast', iconMap: '_dFillIcons' },
    { name: 'nitidez', proxy: 'dtool-nitidez-proxy', iconId: 'dtool-nitidez-icon', tools: ['blur', 'sharpen', 'smudge'], lastVar: 'dNitidezLast', iconMap: '_dNitidezIcons' },
    { name: 'eyedrop', proxy: 'dtool-eyedrop-proxy', iconId: 'dtool-eyedrop-icon', tools: ['eyedrop', 'color-sampler', 'ruler', 'note', 'count'], lastVar: 'dEyedropLast', iconMap: '_dEyedropIcons' }
  ];

  groups.forEach(g => {
    const proxyEl = document.getElementById(g.proxy);
    const isActive = g.tools.includes(t);
    if(proxyEl) proxyEl.classList.toggle('active', isActive);
    
    if(isActive) {
      // Atualiza a variável que guarda o último item usado no grupo
      window[g.lastVar] = t;
      
      // Atualiza o ícone do proxy
      const iconEl = document.getElementById(g.iconId);
      if(iconEl && window[g.iconMap]) {
        iconEl.innerHTML = window[g.iconMap][t] || '';
      }
    }
  });

  const frame=document.getElementById('d-canvas-frame');
  const ws=document.getElementById('d-workspace');
  const brushOpts=document.getElementById('d-brush-opts');
  if(ws)ws.style.cursor='';
  
  // Hand/Pan tool class toggles
  document.body.classList.toggle('tool-hand-active', t === 'hand');
  if (t !== 'hand') {
    document.body.classList.remove('tool-hand-dragging');
  }

  if(frame){
    if(['brush','eraser','blur','smudge','sharpen','bg-eraser'].includes(t))dUpdateBrushCursor(); // cursor circular dinâmico (bg-eraser tem raio)
    else frame.style.cursor=dToolCursors[t]||'default';
  }
  if(brushOpts){brushOpts.style.display=['brush','eraser','blur','smudge','sharpen','bg-eraser'].includes(t)?'flex':'none';brushOpts.style.flexDirection='column';}
  const wandOpts=document.getElementById('d-wand-opts');
  if(wandOpts) wandOpts.style.display=(t==='magic-wand')?'flex':'none';
  dShowBrushBar(t);
  dEnsurePaintCanvas();
  dSyncPaintPointer();
  // A régua promete persistir "até Esc ou troca de ferramenta" — cumpre a segunda parte
  // (dRulerClear é no-op sem medição ativa).
  if(t!=='ruler' && typeof dRulerClear==='function') dRulerClear();
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
  if(['rect','ellipse','triangle','polygon','star','text','text-h','text-v','img','frame'].includes(dTool)){
    dStartDrawShape(e);
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
      if(typeof dRenderABProps==='function')dRenderABProps();
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

let dDrawShapeState = null;

function dStartDrawShape(e) {
  const frame=document.getElementById('d-canvas-frame');
  if(!frame)return;
  e.preventDefault();
  const rect=frame.getBoundingClientRect();
  const scale=dZoomLevel/100;
  const x=(e.clientX-rect.left)/scale;
  const y=(e.clientY-rect.top)/scale;
  dDrawShapeState = {startX:x, startY:y, tool: dTool};
  const el = dEnsureMarqueeEl();
  if(el){
    el.style.left=x+'px';el.style.top=y+'px';
    el.style.width='0px';el.style.height='0px';
    el.style.display='block';
    el.style.borderStyle='solid';
    el.style.borderColor='var(--dm-orange)';
  }
  document.addEventListener('mousemove', dUpdateDrawShape);
  document.addEventListener('mouseup', dEndDrawShape);
}

function dUpdateDrawShape(e) {
  if(!dDrawShapeState)return;
  const frame=document.getElementById('d-canvas-frame');
  if(!frame)return;
  const rect=frame.getBoundingClientRect();
  const scale=dZoomLevel/100;
  const x=(e.clientX-rect.left)/scale;
  const y=(e.clientY-rect.top)/scale;
  
  let w = Math.abs(x - dDrawShapeState.startX);
  let h = Math.abs(y - dDrawShapeState.startY);
  let left = Math.min(dDrawShapeState.startX, x);
  let top = Math.min(dDrawShapeState.startY, y);
  
  if (e.shiftKey) { // Proportional drawing
    const max = Math.max(w, h);
    w = max; h = max;
    left = dDrawShapeState.startX < x ? dDrawShapeState.startX : dDrawShapeState.startX - w;
    top = dDrawShapeState.startY < y ? dDrawShapeState.startY : dDrawShapeState.startY - h;
  }

  const el=document.getElementById('d-marquee');
  if(el){el.style.left=left+'px';el.style.top=top+'px';el.style.width=w+'px';el.style.height=h+'px';}
}

function dEndDrawShape(e) {
  document.removeEventListener('mousemove', dUpdateDrawShape);
  document.removeEventListener('mouseup', dEndDrawShape);
  if(!dDrawShapeState)return;
  
  const frame=document.getElementById('d-canvas-frame');
  const rect=frame.getBoundingClientRect();
  const scale=dZoomLevel/100;
  const x=(e.clientX-rect.left)/scale;
  const y=(e.clientY-rect.top)/scale;
  
  let w = Math.abs(x - dDrawShapeState.startX);
  let h = Math.abs(y - dDrawShapeState.startY);
  let left = Math.min(dDrawShapeState.startX, x);
  let top = Math.min(dDrawShapeState.startY, y);

  if (e.shiftKey) {
    const max = Math.max(w, h);
    w = max; h = max;
    left = dDrawShapeState.startX < x ? dDrawShapeState.startX : dDrawShapeState.startX - w;
    top = dDrawShapeState.startY < y ? dDrawShapeState.startY : dDrawShapeState.startY - h;
  }
  
  const tool = dDrawShapeState.tool;
  const startX = dDrawShapeState.startX, startY = dDrawShapeState.startY; // capturar ANTES de anular
  dDrawShapeState = null;
  const el=document.getElementById('d-marquee');
  if(el) { el.style.display='none'; el.style.borderStyle=''; el.style.borderColor=''; }

  if (w < 10 || h < 10) {
    // Clique simples (sem arrasto): cria no ponto do clique com tamanho default
    w = null; h = null;
    left = startX; top = startY;
  }
  
  if (tool === 'rect') {
    if(typeof dAddShapeAt === 'function') dAddShapeAt(left, top, w, h);
  } else if (['circle','ellipse','triangle','polygon','star'].includes(tool)) {
    if(typeof dAddShapeKind === 'function') dAddShapeKind(tool, left, top, w, h);
  } else if (tool === 'img') {
    if(typeof dAddImageAt === 'function') dAddImageAt(left, top, w, h);
  } else if (tool === 'frame') {
    if(typeof dAddFrameAt === 'function') dAddFrameAt(left, top, w, h);
  } else if (tool.startsWith('text')) {
    const isVert = tool === 'text-v';
    if(typeof dAddTextAt === 'function') dAddTextAt(left, top, isVert, w, h);
  }
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
      gToast('⚠ Nenhuma camada correspondente');
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
    const bf=(typeof dBuiltinFonts!=='undefined'&&dBuiltinFonts)?dBuiltinFonts.find(f=>f.family===fam):null;
    const w=(cf&&cf.weight)||(bf&&bf.weight)||400;
    return {family:`'${fam}', 'Roboto', sans-serif`, weight:w, custom:true, familyName:fam};
  }
  const s=raw.toLowerCase();
  // Roboto com peso explícito (ex: "'Roboto',300")
  const explicit=raw.match(/,\s*(\d{3})$/);
  if(explicit) return {family:"'Roboto', sans-serif", weight:parseInt(explicit[1],10)};
  const weight=(s.includes('black')||s.includes('realce'))?900:(s.includes('bold')?700:400);
  return {family:"'Roboto', sans-serif", weight};
}

function dApplyBg(ab){
  const bgEl=document.getElementById('d-canvas-bg');
  if(!bgEl)return;
  const bg=ab&&ab.bg;
  bgEl.style.background=(bg&&bg!=='transparent')?(bg==='white'?'#ffffff':bg):'';
}

/* ── Efeitos de camada (sombra projetada/interna, glow) → partes de box-shadow ──
   Compartilhado pelo render do canvas e pelo thumbnail. Sem efeito → []. */
function dFxShadowParts(l){
  const parts=[];
  if(l.shadow){ const o=gFxOffset(l.shadowDist!=null?l.shadowDist:4, l.shadowAngle); const b=l.shadowBlur!=null?l.shadowBlur:6;
    parts.push(o.x+'px '+o.y+'px '+b+'px '+(l.shadowColor||'rgba(0,0,0,.5)')); }
  if(l.glow){ parts.push('0 0 '+(l.glowSize!=null?l.glowSize:8)+'px '+(l.glowColor||'rgba(255,255,255,.7)')); }
  if(l.innerShadow){ const o=gFxOffset(l.innerShadowDist!=null?l.innerShadowDist:4, l.innerShadowAngle); const b=l.innerShadowBlur!=null?l.innerShadowBlur:6;
    parts.push('inset '+o.x+'px '+o.y+'px '+b+'px '+(l.innerShadowColor||'rgba(0,0,0,.5)')); }
  if(l.innerGlow){ parts.push('inset 0 0 '+(l.innerGlowSize!=null?l.innerGlowSize:8)+'px '+(l.innerGlowColor||'rgba(255,255,255,.7)')); }
  if(l.bevel){ const o=gFxOffset(l.bevelSize!=null?l.bevelSize:4, l.bevelAngle), b=l.bevelSize!=null?l.bevelSize:4; // realce (luz) + sombra opostos, internos
    parts.push('inset '+o.x+'px '+o.y+'px '+b+'px '+(l.bevelHighlight||'rgba(255,255,255,.7)'));
    parts.push('inset '+(-o.x)+'px '+(-o.y)+'px '+b+'px '+(l.bevelShadow||'rgba(0,0,0,.5)')); }
  return parts;
}
// Traçado de shape como box-shadow, respeitando o alinhamento (inside/center/outside).
function dFxStrokeParts(l){
  if(!(l.strokeW>0) || l.strokeDash) return []; // dash é tratado via border no editor
  const w=l.strokeW, c=l.strokeColor||'#000', a=l.strokeAlign||'inside';
  if(a==='outside') return ['0 0 0 '+w+'px '+c];
  if(a==='center')  return ['0 0 0 '+(w/2)+'px '+c, 'inset 0 0 0 '+(w/2)+'px '+c];
  return ['inset 0 0 0 '+w+'px '+c];
}
// Fundo do shape: gradiente (l.gradient) ou cor sólida, com color overlay por cima.
function dFxShapeBg(l){
  const base = (l.gradient && l.gradient.stops && l.gradient.stops.length) ? gGradientCss(l.gradient) : (l.fill||'#FF9000');
  const layers=[];
  if(l.gradientOverlay && l.gradientOverlay.stops && l.gradientOverlay.stops.length){ // gradient overlay (efeito)
    const g=Object.assign({}, l.gradientOverlay);
    if(g.opacity!=null && g.opacity<1) g.stops=g.stops.map(s=>({color:s.color,pos:s.pos,opacity:(s.opacity!=null?s.opacity:1)*g.opacity}));
    layers.push(gGradientCss(g));
  }
  if(l.overlay && l.overlayColor){ const o=gFxRgba(l.overlayColor, l.overlayOpacity!=null?l.overlayOpacity:1); layers.push('linear-gradient('+o+','+o+')'); }
  return layers.length? layers.join(',')+','+base : base;
}
function dRenderCanvas(){
  const ab=typeof dGetActiveAB==='function'?dGetActiveAB():null;
  dApplyBg(ab);
  const frame=document.getElementById('d-canvas-frame');
  // Detach paint canvas ANTES do innerHTML='' para preservar pixels sem toDataURL.
  // Canvas retém seu backing buffer enquanto a referência DOM existir — reinsere após render.
  const existingPaint=document.getElementById('d-paint-canvas');
  const f=(typeof dPaintTargetSize==='function')?dPaintTargetSize():(DFMT_SIZES[dFmt]||{w:1080,h:1920});
  const paintOk=existingPaint&&existingPaint.width===f.w&&existingPaint.height===f.h;
  if(paintOk) frame.removeChild(existingPaint);
  // Sessão de máscara ativa: preserva view/cap (mesmo padrão do paint canvas).
  // innerHTML='' os destruiria — toolbar ficava órfã e a pintura da máscara morria
  // em qualquer re-render (undo, clique na lista, fonte async carregando).
  const _maskEls=(typeof _dMaskState!=='undefined'&&_dMaskState)?[_dMaskState.view,_dMaskState.cap].filter(n=>n&&n.parentNode===frame):[];
  _maskEls.forEach(n=>frame.removeChild(n));
  frame.innerHTML='';
  // Inicializa o tracker de regras disparadas para o debugger
  window._dActiveRules = [];
  
  // Na simulação, aplica bindings (4.1) e regras (4.2) com os valores simulados — espelha o PNG.
  const _simDefs=dSimActive?gVarDefaults():null;
  let _renderLayers=dLayers.map(l=>{
    if(!dSimActive)return l;
    let eff=(typeof gApplyBindings==='function')?gApplyBindings(l,dSimValues,{defaults:_simDefs}):l;
    if(typeof gApplyRules==='function')eff=gApplyRules(eff,dSimValues,{defaults:_simDefs});
    return eff;
  });
  // Aplica Alinhamento Magnético Relativo (Auto-spacing)
  if(typeof gApplyRelativeAnchors==='function'){
    _renderLayers = gApplyRelativeAnchors(_renderLayers, dSimActive ? dSimValues : null, dSimActive ? _simDefs : gVarDefaults());
  }
  _renderLayers.filter(l=>l.visible && l.type !== 'group').forEach(l=>{
    // Na simulação, 'l' pode ser um CLONE efetivo (gApplyBindings/gApplyRules retornam
    // cópia). Handlers que MUTAM estado precisam do original em dLayers — senão a
    // mudança (drag, foto, cor) é perdida no próximo render. Render usa 'l'; mutação usa 'lReal'.
    const lReal=dLayers.find(x=>x.id===l.id)||l;
    const el=document.createElement('div');
    el.className='canvas-layer'+(l.id===dSelId?' selected':'')+(l.locked?' layer-locked':'')+(dMultiSel.includes(l.id)?' multi-sel':'');
    el.dataset.id=l.id;
    el.style.cssText=`left:${l.x}px;top:${l.y}px;width:${l.w}px;height:${l.h}px;position:absolute;`;
    // Máscara de camada (alpha) — espelha o PSD; aplica via CSS mask no elemento
    if(l.mask){ const mu='url("'+l.mask+'")'; el.style.webkitMaskImage=mu; el.style.maskImage=mu; el.style.webkitMaskSize=el.style.maskSize='100% 100%'; el.style.webkitMaskRepeat=el.style.maskRepeat='no-repeat'; }
    // Blend mode → CSS mix-blend-mode. Usa o mapa oficial (DBLEND_TO_CSS); modos sem equivalente
    // CSS (linearBurn/vividLight/…) ficam como normal no canvas do designer (o gerador/preview
    // aplicam via software). Fallback: camelCase → kebab.
    if(l.blendMode){
      const _css=(typeof DBLEND_TO_CSS!=='undefined')?DBLEND_TO_CSS[l.blendMode]:null;
      el.style.mixBlendMode=_css||l.blendMode.replace(/([A-Z])/g,c=>'-'+c.toLowerCase());
    }
    // M2.1 — hover no canvas destaca a linha na lista de layers (e vice-versa)
    if(typeof dHoverLayer==='function'){
      el.addEventListener('mouseenter',()=>dHoverLayer(l.id,true));
      el.addEventListener('mouseleave',()=>dHoverLayer(l.id,false));
    }
    if(l.type==='shape'){
      el.style.opacity=(l.opacity!=null?l.opacity:100)/100; // opacity:0 é válido (||100 transformava 0 em 100)
      const kind=l.shapeKind||'rect';
      const pts=(kind!=='circle'&&kind!=='ellipse'&&typeof dShapePoints==='function')?dShapePoints(l):null;
      if(pts){
        // SVG path inline → suporta CANTOS ARREDONDADOS (clip-path:polygon não arredonda).
        // Fica num inner pra não clipar os handles de seleção (que ficam em el).
        const inner=document.createElement('div');
        inner.style.cssText='position:absolute;inset:0;';
        const abs=pts.map(p=>[p[0]*l.w, p[1]*l.h]);
        const d=gRoundPolyD(abs, l.radius||0);
        const _st=(l.strokeW>0)?' stroke="'+(l.strokeColor||'#000')+'" stroke-width="'+l.strokeW+'"':''; // traçado no polígono
        inner.innerHTML='<svg width="100%" height="100%" viewBox="0 0 '+l.w+' '+l.h+'" preserveAspectRatio="none" style="display:block;overflow:visible"><path d="'+d+'" fill="'+(l.fill||'#FF9000')+'"'+_st+'/></svg>';
        el.appendChild(inner);
      }else{
        el.style.background=dFxShapeBg(l); // fill + color overlay
        if(kind==='circle'||kind==='ellipse'){ el.style.borderRadius='50%'; }
        else { const _cr=dCornerRadii(l); el.style.borderRadius=_cr.tl+'px '+_cr.tr+'px '+_cr.br+'px '+_cr.bl+'px'; } // cantos por canto
        if(l.strokeW>0 && l.strokeDash){ el.style.border=l.strokeW+'px dashed '+(l.strokeColor||'#000'); el.style.boxSizing='border-box'; } // traçado tracejado
        const _bs=dFxStrokeParts(l).concat(dFxShadowParts(l)); // traçado(+align) + sombra/glow/inner/bevel
        if(_bs.length) el.style.boxShadow=_bs.join(', ');
      }
    }else if(l.type==='text'){
      // Política de var vazia (3.3): na simulação, layer cujos tokens ficaram todos vazios
      // some — espelha o png-generator (evita "R$" órfão na prévia do designer também).
      if(dSimActive && /\{\{/.test(l.content||'') && gAllVarsEmpty(l.content, dSimValues, gVarDefaults())){
        el.style.display='none';
      }
      el.style.color=(l.overlay&&l.overlayColor)?gFxRgba(l.overlayColor,l.overlayOpacity!=null?l.overlayOpacity:1):(l.color||'#fff'); // color overlay
      const _fp=dTextFontParts(l.font);
      el.style.fontFamily=_fp.family;
      el.style.fontWeight=l.fontWeightOverride||_fp.weight;
      el.style.fontStyle=l.italic?'italic':'';
      if(l.textTransform) el.style.textTransform=l.textTransform;
      // Tamanho SEMPRE 1:1 do PSD (l.fontSize). NÃO auto-encolhe para caber na caixa: encolher
      // cada texto por um fator diferente destruía a hierarquia (título/subtítulo/corpo). Se o
      // texto não couber, o indicador de overflow (por linhas) avisa — sem redimensionar.
      let _renderFs=l.fontSize||24;
      el.style.fontSize=_renderFs+'px';
      el.style.textAlign=l.textAlign||'left';
      el.style.lineHeight=(l.lineHeight?String(l.lineHeight):'1.2');el.style.overflow='visible';el.style.pointerEvents='auto';
      // Point text (sem caixa no PSD) NÃO quebra automaticamente — só em \n explícito ('pre').
      // Quebrar dentro do bbox justo (fonte trocada p/ Roboto, mais larga) empilhava/sobrepunha o
      // texto. Só PARÁGRAFO (textBox==='box') quebra por largura ('pre-wrap').
      el.style.whiteSpace=(l.textBox==='box')?'pre-wrap':'pre';
      el.style.letterSpacing=(l.letterSpacing?l.letterSpacing+'px':''); // tracking
      if(l.vertical){
        el.style.writingMode='vertical-rl';
      } else {
        el.style.writingMode='';
      }
      // Se é campo variável, mostrar label acima + borda. Cor de DADO = amarelo (--var-color),
      // coerente com o controle "Dado" e o selo na lista de camadas (antes era roxo solto).
      if(l.isVar){
        el.style.border='1.5px dashed rgba(255,185,0,0.75)';
        el.style.padding='2px 4px';
        // el já é position:absolute (contexto de posicionamento para o label abaixo).
        // NÃO trocar para relative: reinsere no fluxo e desloca outros layers relativos.
        const lbl=document.createElement('div');
        lbl.style.cssText='position:absolute;top:-18px;left:0;font-size:9px;font-weight:800;letter-spacing:.06em;color:#241a00;background:#FFB900;padding:1px 7px;border-radius:4px;font-family:Roboto,sans-serif;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.25);';
        lbl.textContent='◆ '+l.name;
        el.appendChild(lbl);
      }
      const textNode=document.createElement('div');
      // vAlign 'top' (texto importado do PSD): ancora pelo TOPO com o topo da tinta encostando no
      // topo da caixa (== node.top do PSD) → posição vertical 1:1. Demais textos: centralização
      // vertical (comportamento antigo do editor).
      const isBox = l.textBox === 'box';
      const wrapStyle = isBox ? 'white-space:pre-wrap;word-break:break-word;' : 'white-space:nowrap;';
      if(l.vAlign==='top'){
        textNode.style.cssText=`width:100%;overflow:visible;${wrapStyle}`;
        const _gap=(typeof dTextInkTopGap==='function')?dTextInkTopGap(l.font, _renderFs, (l.lineHeight||1.2)):0;
        if(_gap) textNode.style.transform='translateY('+(-_gap).toFixed(2)+'px)';
      } else {
        textNode.style.cssText=`width:100%;height:100%;display:flex;align-items:center;overflow:visible;${wrapStyle}`;
      }
      // Se a camada contiver split-tokens de preço, gera runs virtuais e processa como HTML rico
      const virtualRuns = (typeof gBuildVirtualRuns === 'function') ? gBuildVirtualRuns(l, dSimActive ? dSimValues : null, 1, gVarDefaults()) : null;
      if (virtualRuns) {
        textNode.innerHTML = virtualRuns.map(r => {
          const dy = r.yOffset ? `display:inline-block;transform:translateY(${Math.round(r.yOffset * (_renderFs / (l.fontSize || 24)))}px);` : '';
          const fs = Math.round((r.fontSize || l.fontSize || 24) * (_renderFs / (l.fontSize || 24)));
          return `<span style="color:${r.color||'inherit'};font-size:${fs}px;font-family:${dTextFontParts(r.font).family};font-weight:${dTextFontParts(r.font).weight};${r.letterSpacing?'letter-spacing:'+r.letterSpacing+'px;':''}${dy}">${gEsc(r.text||'').replace(/\n/g,'<br>')}</span>`;
        }).join('');
      } else if(dSimActive){
        let rawSim = dInterpolate(l.content||'');
        if(isBox && typeof gSmartWrapText === 'function'){
          rawSim = gSmartWrapText(rawSim, l.w, l, dSimValues, gVarDefaults());
        }
        textNode.textContent=rawSim;
      }
      else if(l.runs && l.runs.length && !l.isVar){ // texto multi-estilo (rich text)
        textNode.innerHTML=l.runs.map(r=>`<span style="color:${r.color||'inherit'};font-size:${r.fontSize||_renderFs}px;font-family:${dTextFontParts(r.font).family};font-weight:${dTextFontParts(r.font).weight};${r.letterSpacing?'letter-spacing:'+r.letterSpacing+'px;':''}">${gEsc(r.text||'').replace(/\n/g,'<br>')}</span>`).join(''); }
      else {
        let rawEdit = l.content || '';
        rawEdit = rawEdit.replace(gVarRegex(), (m, n) => {
          const v = (typeof dVars !== 'undefined') && dVars.find(x => x.name === n);
          const sample = (typeof gFieldSampleValue === 'function') ? gFieldSampleValue(v || {name: n}) : ((v && (v.label || n)) || n);
          return `__VAR_START_${n}__${sample}__VAR_END__`;
        });
        if(isBox && typeof gSmartWrapText === 'function'){
          rawEdit = gSmartWrapText(rawEdit, l.w, l, null, gVarDefaults());
        }
        let escaped = gEsc(rawEdit);
        escaped = escaped.replace(/__VAR_START_([a-zA-Z0-9_]+)__(.*?)__VAR_END__/g, (m, name, label) => {
          return `<span class="field-fill" data-var="${name}">${label}</span>`;
        });
        textNode.innerHTML = escaped.replace(/\n/g, '<br>');
      }
      // Preenchimento por gradiente no texto (clip) — não para rich text (que tem cor por trecho)
      if(l.gradient && l.gradient.stops && l.gradient.stops.length && !(l.runs&&l.runs.length)){
        textNode.style.backgroundImage=gGradientCss(l.gradient);
        textNode.style.webkitBackgroundClip='text'; textNode.style.backgroundClip='text';
        textNode.style.webkitTextFillColor='transparent';
      }
      if(l.strikethrough||l.underline){ const _dec=[]; if(l.underline)_dec.push('underline'); if(l.strikethrough)_dec.push('line-through'); textNode.style.textDecoration=_dec.join(' '); }
      // Efeitos de legibilidade (espelham o png-generator) — usam o tamanho EXIBIDO (_renderFs)
      const _fs=_renderFs;
      if(l.bg){textNode.style.background=l.bgColor||'#000';textNode.style.borderRadius=Math.round(_fs*0.2)+'px';}
      if(l.strokeW>0){const sv=l.strokeW+'px '+(l.strokeColor||'#000');textNode.style.webkitTextStroke=sv;textNode.style.textStroke=sv;}
      // Sombra projetada + glow (texto). Sem blur/dist explícitos → mantém o default antigo (fs-based).
      {
        const _ts=[];
        if(l.shadow){
          if(l.shadowBlur!=null||l.shadowDist!=null){ const o=gFxOffset(l.shadowDist!=null?l.shadowDist:_fs*0.07, l.shadowAngle); _ts.push(`${o.x}px ${o.y}px ${(l.shadowBlur!=null?l.shadowBlur:_fs*0.12)}px ${l.shadowColor||'rgba(0,0,0,.5)'}`); }
          else { const sb=Math.max(1,_fs*0.12),so=_fs*0.05; _ts.push(`${so}px ${so}px ${sb}px ${l.shadowColor||'rgba(0,0,0,.5)'}`); }
        }
        if(l.glow){ _ts.push(`0 0 ${(l.glowSize!=null?l.glowSize:_fs*0.3)}px ${l.glowColor||'rgba(255,255,255,.7)'}`); }
        if(_ts.length) textNode.style.textShadow=_ts.join(', ');
      }
      el.appendChild(textNode);
      // Indicador de overflow — mede com o tamanho EXIBIDO (_renderFs) e o TEXTO exibido:
      // simulação usa o valor real; edição usa o mesmo valor de exemplo que aparece no canvas
      // (gFieldSampleValue), não os tokens {{}} crus — senão o selo discorda do que se vê.
      let _ovContent;
      if(dSimActive){ _ovContent=dInterpolate(l.content||''); }
      else { _ovContent=(l.content||'').replace(gVarRegex(),(m,n)=>{
        const v=(typeof dVars!=='undefined')&&dVars.find(x=>x.name===n);
        return (typeof gFieldSampleValue==='function')?gFieldSampleValue(v||{name:n}):((v&&(v.label||n))||n);
      }); }
      if(dCheckTextOverflow({...l,content:_ovContent,fontSize:_renderFs})){
        el.classList.add('text-overflow');
      }
    }else if(l.type==='frame'){
      // Moldura de foto — estilo Deskfy com suporte avançado a SVG clip-path.
      // NÃO forçar position:relative: o layer já é absolute (fora do fluxo). Trocar
      // para relative o reinsere no fluxo normal e empilha com outros layers relativos
      // (outras molduras / textos-variável), deslocando tudo. Absolute já é contexto de
      // posicionamento para os decorativos (+FOTO, X, label) abaixo.
      el.style.overflow='visible';
      
      const kind = l.shapeKind || l.frameShape || 'rect';
      let clipCss = '';
      let dashSvg = '';
      
      const pts = (kind !== 'circle' && kind !== 'ellipse' && typeof dShapePoints === 'function') ? dShapePoints(l) : null;
      if (pts) {
        const abs = pts.map(p => [p[0] * l.w, p[1] * l.h]);
        const d = (typeof gRoundPolyD === 'function') ? gRoundPolyD(abs, l.radius || 0) : '';
        clipCss = `clip-path: path('${d}'); -webkit-clip-path: path('${d}');`;
        dashSvg = `<svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"><path d="${d}" fill="none" stroke="rgba(255,144,0,.6)" stroke-width="2" stroke-dasharray="4,4" vector-effect="non-scaling-stroke"/></svg>`;
      } else if (kind === 'circle' || kind === 'ellipse') {
        clipCss = `border-radius: 50%;`;
      } else {
        const _cr = typeof dCornerRadii === 'function' ? dCornerRadii(l) : {tl: l.radius||0, tr: l.radius||0, br: l.radius||0, bl: l.radius||0};
        clipCss = `border-radius: ${_cr.tl}px ${_cr.tr}px ${_cr.br}px ${_cr.bl}px;`;
      }
      
      // inner: clip real da imagem
      const inner=document.createElement('div');
      const isCropMode = (typeof dCropState !== 'undefined' && dCropState && dCropState.id === l.id);
      inner.style.cssText=`position:absolute;inset:0;overflow:${isCropMode ? 'visible' : 'hidden'};${clipCss}`;
      if (isCropMode) {
        // Se estiver em modo recorte, diminui a opacidade e adiciona um outline para destacar a moldura
        inner.style.outline = '2px solid var(--dm-orange)';
        inner.style.zIndex = '9999';
      }
      
      const simImg=dSimActive&&l.imgVar&&dSimValues[l.imgVar];
      const testSrc=(!simImg&&!l.imgUrl&&dPhTestAR&&typeof dSampleImg==='function')?dSampleImg(dPhTestAR):null;
      const src=simImg||l.imgUrl||testSrc;
      
      if(src){
        if(simImg)l._simImgUrl=simImg;
        const img=document.createElement('img');
        img.src=src;
        const posX=(0.5+(l.imgOffsetX||0))*100, posY=(0.5+(l.imgOffsetY||0))*100;
        img.style.cssText=`width:100%;height:100%;object-fit:${l.objectFit||'cover'};object-position:${posX}% ${posY}%;display:block;`;
        
        // Aplica filtros de imagem (Apetite Adjustments)
        let filterStr = '';
        if (l.filterBrightness != null && l.filterBrightness !== 0) filterStr += ` brightness(${1 + (l.filterBrightness / 100)})`;
        if (l.filterContrast != null && l.filterContrast !== 0) filterStr += ` contrast(${1 + (l.filterContrast / 100)})`;
        if (l.filterSaturate != null && l.filterSaturate !== 0) filterStr += ` saturate(${1 + (l.filterSaturate / 100)})`;
        if (filterStr) img.style.filter = filterStr.trim();
        
        if (isCropMode) {
          img.style.opacity = '0.5';
          img.style.cursor = 'move';
        }
        if(l.imgScale&&l.imgScale!==1){img.style.transform=`scale(${l.imgScale})`;img.style.transformOrigin='center';}
        if(testSrc){
          if(!isCropMode) img.style.opacity='.75';
          if(dashSvg) inner.innerHTML = dashSvg;
          else inner.style.border = '2px dashed rgba(255,144,0,.6)';
        }
        inner.appendChild(img);
        // Em modo de crop, para facilitar a visualização, desenhamos a imagem DUAS vezes:
        // A primeira (vazando, opacity 0.5) e a segunda (dentro do frame, clipada, full opacity).
        if (isCropMode) {
          const imgSolid=document.createElement('img');
          imgSolid.src=src;
          imgSolid.style.cssText=`position:absolute;top:0;left:0;width:100%;height:100%;object-fit:${l.objectFit||'cover'};object-position:${posX}% ${posY}%;display:block;pointer-events:none;`;
          if (filterStr) imgSolid.style.filter = filterStr.trim();
          if(l.imgScale&&l.imgScale!==1){imgSolid.style.transform=`scale(${l.imgScale})`;imgSolid.style.transformOrigin='center';}
          const solidWrap=document.createElement('div');
          solidWrap.style.cssText=`position:absolute;inset:0;overflow:hidden;${clipCss};pointer-events:none;`;
          solidWrap.appendChild(imgSolid);
          inner.appendChild(solidWrap);
        }
      }else{
        inner.style.cssText+=`background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;`;
        if(dashSvg) inner.innerHTML = dashSvg;
        else inner.style.border = '2px dashed rgba(255,144,0,0.6)';
        
        const ph=document.createElement('div');
        ph.style.cssText='display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;z-index:2;';
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
          r.onload=re=>{lReal.imgUrl=re.result;dRenderCanvas();dMarkUnsaved();gToast('✓ Foto aplicada na moldura!');};
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
        clrBtn.addEventListener('click',e=>{e.stopPropagation();lReal.imgUrl='';dRenderCanvas();dMarkUnsaved();});
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
        
        // Aplica filtros de imagem (Apetite Adjustments)
        let filterStr = '';
        if (l.filterBrightness != null && l.filterBrightness !== 0) filterStr += ` brightness(${1 + (l.filterBrightness / 100)})`;
        if (l.filterContrast != null && l.filterContrast !== 0) filterStr += ` contrast(${1 + (l.filterContrast / 100)})`;
        if (l.filterSaturate != null && l.filterSaturate !== 0) filterStr += ` saturate(${1 + (l.filterSaturate / 100)})`;
        if (filterStr) img.style.filter = filterStr.trim();
        
        el.appendChild(img);
      }else{
        el.style.cssText+=`background:rgba(255,255,255,.06);border:1px dashed rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:11px;color:rgba(255,255,255,.3);flex-direction:column;gap:4px;`;
        el.innerHTML=`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg><span>${l.imgVar||'imagem'}</span>`;
      }
    }
    if(l.id===dSelId){
      ['br','bl','tr','tl'].forEach(pos=>{
        const h=document.createElement('div');h.className='layer-handle handle-'+pos;
        if(l.locked){h.style.opacity='0.3';h.style.cursor='not-allowed';h.addEventListener('mousedown',e=>{e.stopPropagation();gToast('🔒 Camada bloqueada');});}
        else h.addEventListener('mousedown',e=>{e.stopPropagation();dStartResize(e,lReal,pos);});
        el.appendChild(h);
      });
    }
    el.addEventListener('mousedown',e=>{
      if(e.button && e.button!==0) return; // botão direito/meio → deixa o contextmenu agir, sem iniciar drag
      if(dTool==='hand')return; // deixa borbulhar pro pan do wrapper — senão a Mão não move quando o arrasto começa sobre uma camada (ex.: Fundo)
      e.stopPropagation();
      if(dTool==='obj-select'){const _oFr=document.getElementById('d-canvas-frame');if(_oFr&&typeof dObjSelectStart==='function')dObjSelectStart(e,_oFr);return;}
      if(dTool==='quick-select'||dTool==='magic-wand'){_dAdvSelFromEvent(e);return;}
      if(dTool==='eyedrop'){
        // Texto/forma: leitura direta (cor exata). Imagem/moldura: amostra o pixel
        // composto (antes só avisava "funciona em texto e forma" e não coletava nada).
        if((lReal.type==='image'||lReal.type==='frame')&&typeof dEyedropAt==='function'){
          const _fr=document.getElementById('d-canvas-frame');
          const _r=_fr.getBoundingClientRect(),_s=dZoomLevel/100;
          dEyedropAt(Math.round((e.clientX-_r.left)/_s),Math.round((e.clientY-_r.top)/_s),lReal);
        }else dEyedropFromLayer(lReal);
        return;
      }
      if(dTool==='bucket'){dBucketFillLayer(lReal);return;}
      if(dTool==='var-data'){ // Vincular campo: clicou no elemento → abre o seletor ancorado nele
        if(typeof dLayerIsBindable==='function' && !dLayerIsBindable(l)){ gToast('Essa camada não recebe Dado (só texto/imagem)'); return; }
        const _rect=el.getBoundingClientRect();           // captura ANTES do re-render (el fica órfão depois)
        dSelLayer(l.id);
        if(typeof dFieldBindPickerOpen==='function'){
          const _anchor={getBoundingClientRect:()=>_rect};
          setTimeout(()=>dFieldBindPickerOpen({currentTarget:_anchor, stopPropagation:function(){}}), 0);
        }
        return;
      }
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
          dStartDrag(e,lReal);
        } else gToast('🔒 Camada bloqueada. Clique no 🔓 para desbloquear.');
      }
      // Carimbo: NÃO tratar aqui — o mousedown apenas deixa o evento morrer e o 'click'
      // do frame (que enxerga cliques sobre camadas, stamp é creationTool) chama dStampAt.
      // Tratar nos dois caminhos carimbava DUAS vezes por clique.
    });
    // Botão direito → menu de contexto da camada (vincular dado, converter forma⇄moldura, etc.)
    el.addEventListener('contextmenu',e=>{ if(typeof dLayerContextMenu==='function') dLayerContextMenu(e,l.id); });
    // Double click = edição inline de texto ou crop inline de imagem
    if(l.type==='text'){
      el.addEventListener('dblclick',e=>{
        e.stopPropagation();
        dStartInlineEdit(lReal,el); // lReal: na simulação 'l' pode ser clone (bindings/rules)
      });
    } else if(l.type==='image'||l.type==='frame') {
      el.addEventListener('dblclick',e=>{
        e.stopPropagation();
        if(typeof dStartCrop==='function') dStartCrop(lReal);
      });
    }
    frame.appendChild(el);
  });
  // Recolocar paint canvas: se já existia com tamanho certo, reinserir a mesma referência
  // (pixels intactos, sem nenhuma serialização). Senão, criar via dEnsurePaintCanvas.
  if(paintOk) frame.appendChild(existingPaint);
  else dEnsurePaintCanvas();
  _maskEls.forEach(n=>frame.appendChild(n)); // devolve a sessão de máscara por cima
  dSyncPaintPointer();
  dAttachMarquee(); // garante o listener de marquee no frame (guarda interna evita duplicar)
  if(typeof dABAddResizeHandles==='function') dABAddResizeHandles();
  
  // Atualiza painel de regras em tempo real se o debugger detectou mudanças
  if (dSelId) {
    const lReal = dLayers.find(x => x.id === dSelId);
    if (lReal && lReal.rules && typeof dRenderRules === 'function') {
      dRenderRules(lReal);
    }
  }
}


/* ── PAINT CANVAS (pincel/borracha) ── */
let dPainting=false,dPaintLast={x:0,y:0};

/* ══ BARRA CONTEXTUAL DINÂMICA ══ */
function dUpdateCtxBar(){
  const noSelEl = document.getElementById('dt-no-selection');
  const layerSelEl = document.getElementById('dt-layer-selection');
  
  const l = dLayers.find(x => x.id === dSelId);
  
  if (!l) {
    if (noSelEl) { noSelEl.style.display=''; noSelEl.classList.add('active'); }
    if (layerSelEl) { layerSelEl.style.display=''; layerSelEl.classList.remove('active'); }
    return;
  }
  
  if (noSelEl) { noSelEl.style.display=''; noSelEl.classList.remove('active'); }
  if (layerSelEl) {
    layerSelEl.style.display='';
    layerSelEl.classList.add('active');
    
    const inpX = document.getElementById('d-top-x');
    const inpY = document.getElementById('d-top-y');
    const inpW = document.getElementById('d-top-w');
    const inpH = document.getElementById('d-top-h');
    const lockBtn = document.getElementById('d-top-lock');
    
    if (inpX && document.activeElement !== inpX) inpX.value = Math.round(l.x);
    if (inpY && document.activeElement !== inpY) inpY.value = Math.round(l.y);
    if (inpW && document.activeElement !== inpW) inpW.value = Math.round(l.w);
    if (inpH && document.activeElement !== inpH) inpH.value = Math.round(l.h);
    if (lockBtn) lockBtn.classList.toggle('active', !!l.lockRatio);
  }
}

function dToggleLockRatio() {
  const l = dLayers.find(x => x.id === dSelId);
  if (!l) return;
  dHistoryPush();
  l.lockRatio = !l.lockRatio;
  const lockBtn = document.getElementById('d-top-lock');
  if (lockBtn) lockBtn.classList.toggle('active', !!l.lockRatio);
  dMarkUnsaved();
}



/* ══ SMART GUIDES & SNAP ══ */
const SNAP_THRESHOLD = 6; // pixels do canvas
function dCalculateSnap(movingLayer, newX, newY){
  if(!dSnapEnabled)return {x:newX, y:newY, guides:[]};
  const _abS=(typeof dGetActiveAB==='function')?dGetActiveAB():null;
  const f=_abS?{w:_abS.w,h:_abS.h}:(DFMT_SIZES[dFmt]||DFMT_SIZES.story);
  const guides=[];
  const movEdges={
    x:[newX, newX+movingLayer.w/2, newX+movingLayer.w],
    y:[newY, newY+movingLayer.h/2, newY+movingLayer.h]
  };
  const canvasEdges={x:[0, f.w/2, f.w], y:[0, f.h/2, f.h]};
  const layerEdges={x:[], y:[]};
  const others = dLayers.filter(l => l.id !== movingLayer.id && l.visible);

  others.forEach(l=>{
    layerEdges.x.push(l.x, l.x+l.w/2, l.x+l.w);
    layerEdges.y.push(l.y, l.y+l.h/2, l.y+l.h);
  });

  // SMART GAPS: Encontrar distâncias (gaps) repetidas
  const gapSnapX = []; // possíveis posições de newX
  const gapSnapY = []; // possíveis posições de newY
  for (let i = 0; i < others.length; i++) {
    for (let j = i + 1; j < others.length; j++) {
      const a = others[i], b = others[j];
      if (Math.max(a.y, b.y) < Math.min(a.y + a.h, b.y + b.h)) {
        let gapX = Math.round(Math.abs(a.x > b.x ? a.x - (b.x + b.w) : b.x - (a.x + a.w)));
        if (gapX > 0 && gapX < 300) {
          gapSnapX.push({ x: a.x + a.w + gapX, gap: gapX, refLayer: a });
          gapSnapX.push({ x: a.x - gapX - movingLayer.w, gap: gapX, refLayer: a });
          gapSnapX.push({ x: b.x + b.w + gapX, gap: gapX, refLayer: b });
          gapSnapX.push({ x: b.x - gapX - movingLayer.w, gap: gapX, refLayer: b });
        }
      }
      if (Math.max(a.x, b.x) < Math.min(a.x + a.w, b.x + b.w)) {
        let gapY = Math.round(Math.abs(a.y > b.y ? a.y - (b.y + b.h) : b.y - (a.y + a.h)));
        if (gapY > 0 && gapY < 300) {
          gapSnapY.push({ y: a.y + a.h + gapY, gap: gapY, refLayer: a });
          gapSnapY.push({ y: a.y - gapY - movingLayer.h, gap: gapY, refLayer: a });
          gapSnapY.push({ y: b.y + b.h + gapY, gap: gapY, refLayer: b });
          gapSnapY.push({ y: b.y - gapY - movingLayer.h, gap: gapY, refLayer: b });
        }
      }
    }
  }

  // Smart Snapping de Gaps Comuns Figma-Style (8px, 12px, 16px, 24px)
  const commonGaps = [8, 12, 16, 24];
  others.forEach(l => {
    // Alinha horizontalmente se houver sobreposição vertical sutil ou próxima
    if (Math.max(movingLayer.y, l.y) < Math.min(movingLayer.y + movingLayer.h, l.y + l.h) || others.length <= 4) {
      commonGaps.forEach(gap => {
        gapSnapX.push({ x: l.x + l.w + gap, gap: gap, refLayer: l });
        gapSnapX.push({ x: l.x - gap - movingLayer.w, gap: gap, refLayer: l });
      });
    }
    // Alinha verticalmente se houver sobreposição horizontal sutil ou próxima
    if (Math.max(movingLayer.x, l.x) < Math.min(movingLayer.x + movingLayer.w, l.x + l.w) || others.length <= 4) {
      commonGaps.forEach(gap => {
        gapSnapY.push({ y: l.y + l.h + gap, gap: gap, refLayer: l });
        gapSnapY.push({ y: l.y - gap - movingLayer.h, gap: gap, refLayer: l });
      });
    }
  });

  let bestDx=0, bestDxAbs=SNAP_THRESHOLD+1;
  let gapMatchedX = null;
  movEdges.x.forEach((mx,mi)=>{
    [...canvasEdges.x, ...layerEdges.x].forEach(ox=>{
      const d=ox-mx;
      if(Math.abs(d)<bestDxAbs){ bestDxAbs=Math.abs(d); bestDx=d; gapMatchedX=null; }
    });
  });
  // Tentar snap por gap se for mais forte ou igual
  gapSnapX.forEach(g => {
    const d = g.x - newX;
    if (Math.abs(d) <= bestDxAbs && Math.abs(d) <= SNAP_THRESHOLD) {
      bestDxAbs = Math.abs(d); bestDx = d; gapMatchedX = g;
    }
  });

  let bestDy=0, bestDyAbs=SNAP_THRESHOLD+1;
  let gapMatchedY = null;
  movEdges.y.forEach((my,mi)=>{
    [...canvasEdges.y, ...layerEdges.y].forEach(oy=>{
      const d=oy-my;
      if(Math.abs(d)<bestDyAbs){ bestDyAbs=Math.abs(d); bestDy=d; gapMatchedY=null; }
    });
  });
  gapSnapY.forEach(g => {
    const d = g.y - newY;
    if (Math.abs(d) <= bestDyAbs && Math.abs(d) <= SNAP_THRESHOLD) {
      bestDyAbs = Math.abs(d); bestDy = d; gapMatchedY = g;
    }
  });

  const finalX=bestDxAbs<=SNAP_THRESHOLD?newX+bestDx:newX;
  const finalY=bestDyAbs<=SNAP_THRESHOLD?newY+bestDy:newY;

  if(bestDxAbs<=SNAP_THRESHOLD){
    if (gapMatchedX) {
      guides.push({type:'gap-x', pos: gapMatchedX.x, gap: gapMatchedX.gap, ref: gapMatchedX.refLayer, movW: movingLayer.w });
    } else {
      const snappedX=finalX;
      const matchEdges=[snappedX, snappedX+movingLayer.w/2, snappedX+movingLayer.w];
      [...canvasEdges.x, ...layerEdges.x].forEach(ox=>{
        if(matchEdges.some(me=>Math.abs(me-ox)<0.5)) guides.push({type:'v', pos:ox});
      });
    }
  }
  if(bestDyAbs<=SNAP_THRESHOLD){
    if (gapMatchedY) {
      guides.push({type:'gap-y', pos: gapMatchedY.y, gap: gapMatchedY.gap, ref: gapMatchedY.refLayer, movH: movingLayer.h });
    } else {
      const snappedY=finalY;
      const matchEdges=[snappedY, snappedY+movingLayer.h/2, snappedY+movingLayer.h];
      [...canvasEdges.y, ...layerEdges.y].forEach(oy=>{
        if(matchEdges.some(me=>Math.abs(me-oy)<0.5)) guides.push({type:'h', pos:oy});
      });
    }
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
  const _abG=(typeof dGetActiveAB==='function')?dGetActiveAB():null;
  const f=_abG?{w:_abG.w,h:_abG.h}:(DFMT_SIZES[dFmt]||DFMT_SIZES.story);
  guides.forEach(g=>{
    if (g.type === 'gap-x') {
      // Cria guia de espaçamento horizontal (rosa com setas)
      const el=document.createElement('div');
      el.className='smart-guide gap-x yng-guide';
      const gapMidX = (g.pos > g.ref.x) ? g.pos - g.gap/2 : g.pos + g.movW + g.gap/2;
      el.style.cssText=`left:${gapMidX}px; top:0; height:${f.h}px; border-left: 1px dashed var(--dm-orange);`;
      frame.appendChild(el);
      const tag=document.createElement('div');
      tag.className='snap-tag yng-guide';
      tag.textContent=`↕ ${g.gap}px`; // Símbolo de gap
      tag.style.cssText=`left:${gapMidX+4}px; top:50%; background:var(--dm-orange); transform:translateY(-50%);`;
      frame.appendChild(tag);
    } else if (g.type === 'gap-y') {
      // Cria guia de espaçamento vertical
      const el=document.createElement('div');
      el.className='smart-guide gap-y yng-guide';
      const gapMidY = (g.pos > g.ref.y) ? g.pos - g.gap/2 : g.pos + g.movH + g.gap/2;
      el.style.cssText=`top:${gapMidY}px; left:0; width:${f.w}px; border-top: 1px dashed var(--dm-orange);`;
      frame.appendChild(el);
      const tag=document.createElement('div');
      tag.className='snap-tag yng-guide';
      tag.textContent=`↔ ${g.gap}px`; 
      tag.style.cssText=`top:${gapMidY+4}px; left:50%; background:var(--dm-orange); transform:translateX(-50%);`;
      frame.appendChild(tag);
    } else {
      const el=document.createElement('div');
      el.className='smart-guide '+g.type+' yng-guide';
      if(g.type==='v'){el.style.cssText=`left:${g.pos}px;top:0;height:${f.h}px;`;}
      else{el.style.cssText=`top:${g.pos}px;left:0;width:${f.w}px;`;}
      frame.appendChild(el);
      const tag=document.createElement('div');
      tag.className='snap-tag yng-guide';
      tag.textContent=Math.round(g.pos)+' px';
      if(g.type==='v'){tag.style.cssText=`left:${g.pos+4}px;top:8px;`;}
      else{tag.style.cssText=`top:${g.pos+4}px;left:8px;`;}
      frame.appendChild(tag);
    }
  });
}
function dClearGuides(){
  document.querySelectorAll('.yng-guide').forEach(g=>g.remove());
}



/* ══ SIMULAR DADOS REAIS ══ */
let dSimValues = {};  // {nomeVar: valor}
let dSimActive = false;
let dSimDraftValues = {};
let dSimFmt = 'original';
let dSimRenderTimer = null;
let dSimRenderSeq = 0;
let dSimLastTrigger = null;

function dSimUsedVars(){
  const used=new Set();
  dLayers.forEach(l=>{
    if(l.type==='text'&&l.content){
      for(const m of l.content.matchAll(gVarRegex()))used.add(m[1]);
    }
    if((l.type==='frame'||l.type==='image')&&l.imgVar)used.add(l.imgVar);
  });
  return [...used];
}

function dSimSourceSize(){
  const ab=(typeof dGetActiveAB==='function')?dGetActiveAB():null;
  const fallback=DFMT_SIZES[dFmt]||DFMT_SIZES.story;
  return {w:(ab&&ab.w)||fallback.w,h:(ab&&ab.h)||fallback.h,fmt:(ab&&ab.fmt)||dFmt};
}

function dSimTargetSize(){
  const src=dSimSourceSize();
  if(dSimFmt==='original')return src;
  const target=DFMT_SIZES[dSimFmt]||src;
  return {w:target.w,h:target.h,fmt:dSimFmt};
}

function dSimLayersForFmt(){
  const src=dSimSourceSize(),target=dSimTargetSize();
  if(src.w===target.w&&src.h===target.h)return dLayers;
  return typeof gReflowLayers==='function'
    ?gReflowLayers(dLayers,src,target,{fmtKey:typeof gFmtKey==='function'?gFmtKey(target.fmt):target.fmt})
    :dLayers;
}

function dSimFormatButtons(){
  const src=dSimSourceSize();
  const formats=[
    {id:'original',label:'Original',w:src.w,h:src.h},
    {id:'story',label:'Story',...DFMT_SIZES.story},
    {id:'feed',label:'Feed',...DFMT_SIZES.feed},
    {id:'wide',label:'Wide',...DFMT_SIZES.wide},
    {id:'horizontal',label:'Horizontal',...DFMT_SIZES.horizontal},
  ];
  return formats.map(fmt=>`<button type="button" class="sim-fmt-chip ${dSimFmt===fmt.id?'active':''}" aria-pressed="${dSimFmt===fmt.id}" onclick="dSimSetFmt('${fmt.id}')"><span>${fmt.label}</span><small>${fmt.w}×${fmt.h}</small></button>`).join('');
}

function dSimFieldMarkup(vn){
  const v=dVars.find(x=>x.name===vn);
  const label=v?(v.label||vn):vn;
  const type=v?(v.type||'text'):'text';
  const cur=dSimDraftValues[vn]||'';
  const maxLen=(v&&v.maxLen)?v.maxLen:0;
  const meta=`<span class="sim-count" id="sim-count-${vn}"></span><span class="sim-overflow" id="sim-ovf-${vn}" hidden>Revisar encaixe</span>`;
  const fieldId='sim-input-'+vn;
  if(type==='image'){
    return `<div class="sim-row"><div class="sim-label-row"><label for="${fieldId}">${gEsc(label)}</label><span class="sim-field-type">Imagem</span></div><input id="${fieldId}" type="text" inputmode="url" placeholder="Cole uma URL ou imagem em base64" value="${gEsc(cur)}" oninput="dSimVarInput('${vn}',this.value,${maxLen})"></div>`;
  }
  const longText=type==='textarea'||label.toLowerCase().includes('descri')||label.toLowerCase().includes('texto');
  const control=longText
    ?`<textarea id="${fieldId}" rows="3" placeholder="Digite um valor real" oninput="dSimVarInput('${vn}',this.value,${maxLen})">${gEsc(cur)}</textarea>`
    :`<input id="${fieldId}" type="text" placeholder="Digite um valor real" value="${gEsc(cur)}" oninput="dSimVarInput('${vn}',this.value,${maxLen})">`;
  return `<div class="sim-row"><div class="sim-label-row"><label for="${fieldId}">${gEsc(label)}</label><span class="sim-field-key">{{${gEsc(vn)}}}</span></div>${control}<div class="sim-field-meta">${meta}</div></div>`;
}

function dOpenSimModal(){
  const modal=document.getElementById('d-sim-modal');
  const box=modal?.querySelector('.sim-box');
  if(!modal||!box)return;
  dSimLastTrigger=document.activeElement instanceof HTMLElement?document.activeElement:null;
  dSimDraftValues=JSON.parse(JSON.stringify(dSimValues));
  const varsArr=dSimUsedVars();
  box.innerHTML=`<header class="sim-head">
      <div><span class="sim-eyebrow">Teste antes de publicar</span><h3 id="d-sim-title">Simular dados reais</h3><p>Confira conteúdo, encaixe e adaptação sem alterar o template.</p></div>
      <button type="button" class="sim-close" onclick="dCloseSimModal()" aria-label="Fechar simulação"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    </header>
    <div class="sim-workspace">
      <section class="sim-preview-panel" aria-labelledby="sim-preview-title">
        <div class="sim-section-head"><div><span id="sim-preview-title">Pré-visualização</span><small id="sim-preview-dim">—</small></div><span class="sim-live-badge"><span></span>Atualização ao vivo</span></div>
        <div class="sim-format-scroll" aria-label="Formatos suportados">${dSimFormatButtons()}</div>
        <div class="sim-stage">
          <div class="sim-stage-grid"></div><canvas id="d-sim-preview-canvas" aria-label="Arte com os dados simulados"></canvas>
          <div class="sim-render-state" id="d-sim-render-state" role="status" aria-live="polite"><span class="sim-spinner"></span><span>Preparando simulação…</span></div>
        </div>
        <div class="sim-preview-foot"><span id="sim-preview-format">Formato original</span><span id="sim-preview-status">Aguardando renderização</span></div>
      </section>
      <aside class="sim-controls-panel" aria-labelledby="sim-controls-title">
        <div class="sim-controls-head"><div><span id="sim-controls-title">Dados de teste</span><small>${varsArr.length} campo${varsArr.length!==1?'s':''} encontrado${varsArr.length!==1?'s':''}</small></div></div>
        ${varsArr.length?`<div class="sim-scenarios" aria-label="Cenários rápidos">
          <button type="button" onclick="dSimStressTest('sample')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M3 12h18"/></svg><span>Exemplo</span></button>
          <button type="button" onclick="dSimStressTest('max')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 15 4-4 3 3 7-8"/><path d="M14 6h5v5"/></svg><span>Limite</span></button>
          <button type="button" onclick="dSimStressTest('min')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/></svg><span>Mínimo</span></button>
          <button type="button" onclick="dSimStressTest('empty')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><path d="m7 7 10 10"/></svg><span>Vazio</span></button>
        </div><div class="sim-fields" id="d-sim-body">${varsArr.map(dSimFieldMarkup).join('')}</div>`:
        `<div class="sim-empty"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/></svg><strong>Nenhum campo para simular</strong><p>Adicione variáveis como {{produto}} ou uma imagem vinculada para testar dados reais.</p></div>`}
      </aside>
    </div>
    <footer class="sim-foot"><div class="sim-foot-status" id="d-sim-foot-status" aria-live="polite">As alterações ainda não afetam o editor</div><button type="button" class="sim-btn secondary" onclick="dSimClearDraft()">Limpar</button><button type="button" class="sim-btn secondary" onclick="dCloseSimModal()">Cancelar</button><button type="button" class="sim-btn primary" ${varsArr.length?'':'disabled'} onclick="dApplySim()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m8 5 11 7-11 7V5Z"/></svg><span>Aplicar simulação</span></button></footer>`;
  modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','d-sim-title');
  if(!modal._simBackdropBound){modal.addEventListener('mousedown',e=>{if(e.target===modal)dCloseSimModal();});modal._simBackdropBound=true;}
  varsArr.forEach(vn=>{const v=dVars.find(x=>x.name===vn);dSimVarUpdateMeta(vn,dSimDraftValues[vn]||'',(v&&v.maxLen)?v.maxLen:0);});
  modal.classList.add('open');
  dSimUpdatePreviewMeta();
  dSimScheduleRender(true);
  setTimeout(()=>box.querySelector('.sim-close')?.focus(),0);
}

function dSimVarInput(vn,value,maxLen){
  dSimDraftValues[vn]=value;
  dSimVarUpdateMeta(vn,value,maxLen||0);
  dSimScheduleRender();
}
function dSimVarUpdateMeta(vn,value,maxLen){
  const cEl=document.getElementById('sim-count-'+vn);
  if(cEl){
    const len=(value||'').length;
    cEl.textContent = maxLen ? `${len}/${maxLen}` : (len?`${len} car.`:'');
    cEl.style.color = (maxLen && len>maxLen) ? 'var(--dm-red)' : '';
  }
  const oEl=document.getElementById('sim-ovf-'+vn);
  if(oEl)oEl.hidden=!dSimVarOverflow(vn,value);
}
// Testa se o texto simulado caberia nos layers que usam a variável (usa dCheckTextOverflow)
function dSimVarOverflow(vn,value){
  if(typeof dCheckTextOverflow!=='function')return false;
  const reTok=new RegExp('\\{\\{\\s*'+vn+'\\s*\\}\\}');
  const sim={...dSimDraftValues,[vn]:value};
  return dSimLayersForFmt().some(l=>{
    if(l.type!=='text'||!l.content||!reTok.test(l.content))return false;
    const interp=gInterpolate(l.content,sim,{onEmpty:'remove',defaults:gVarDefaults()});
    return dCheckTextOverflow({...l,content:interp});
  });
}

function dSimSetFmt(fmt){
  if(fmt!=='original'&&!DFMT_SIZES[fmt])return;
  dSimFmt=fmt;
  document.querySelectorAll('#d-sim-modal .sim-fmt-chip').forEach(btn=>{
    const active=btn.getAttribute('onclick')?.includes(`'${fmt}'`);
    btn.classList.toggle('active',!!active);btn.setAttribute('aria-pressed',active?'true':'false');
  });
  dSimUpdatePreviewMeta();
  dSimUsedVars().forEach(vn=>{const v=dVars.find(x=>x.name===vn);dSimVarUpdateMeta(vn,dSimDraftValues[vn]||'',(v&&v.maxLen)?v.maxLen:0);});
  dSimScheduleRender(true);
}

function dSimUpdatePreviewMeta(){
  const target=dSimTargetSize();
  const labels={original:'Original',story:'Story',feed:'Feed',wide:'Wide',horizontal:'Horizontal'};
  const dim=document.getElementById('sim-preview-dim');if(dim)dim.textContent=target.w+'×'+target.h+' px';
  const fmt=document.getElementById('sim-preview-format');if(fmt)fmt.textContent=(labels[dSimFmt]||'Original')+' · '+target.w+'×'+target.h;
}

function dSimScheduleRender(immediate){
  clearTimeout(dSimRenderTimer);
  dSimRenderTimer=setTimeout(dSimRenderPreview,immediate?0:120);
  const status=document.getElementById('sim-preview-status');if(status)status.textContent='Atualizando…';
}

async function dSimRenderPreview(){
  const canvas=document.getElementById('d-sim-preview-canvas');
  const state=document.getElementById('d-sim-render-state');
  const status=document.getElementById('sim-preview-status');
  if(!canvas)return;
  const seq=++dSimRenderSeq;
  if(state){state.className='sim-render-state loading';state.innerHTML='<span class="sim-spinner"></span><span>Renderizando dados reais…</span>';}
  if(typeof fRenderPreviewToCanvas!=='function'){
    if(state){state.className='sim-render-state error';state.innerHTML='<span>Pré-visualização indisponível</span><small>Feche e abra novamente. Se continuar, recarregue o Luma.</small>';}
    if(status)status.textContent='Falha no renderizador';
    return;
  }
  const src=dSimSourceSize(),target=dSimTargetSize();
  const tmpl={layers:dSimLayersForFmt(),w:target.w,h:target.h,fmt:target.fmt,bg:(typeof dGetActiveAB==='function'&&dGetActiveAB())?.bg};
  let ok=false;
  try{ok=await fRenderPreviewToCanvas(canvas,tmpl,{maxPx:1200,dados:JSON.parse(JSON.stringify(dSimDraftValues))});}catch(e){ok=false;}
  if(seq!==dSimRenderSeq)return;
  if(ok===false){
    if(state){state.className='sim-render-state error';state.innerHTML='<span>Não foi possível renderizar</span><small>Revise imagens e dados inseridos e tente novamente.</small>';}
    if(status)status.textContent='Erro de renderização';
    return;
  }
  if(state){state.className='sim-render-state';state.innerHTML='';}
  if(status)status.textContent=(src.w===target.w&&src.h===target.h)?'Layout original':'Smart resize aplicado';
}

function dSimStressTest(mode) {
  const varsArr=dSimUsedVars();
  if(!varsArr.length)return;
  dSimDraftValues={};
  
  varsArr.forEach(vn => {
    const v = dVars.find(x => x.name === vn);
    const type = v ? v.type : 'text';
    const isRequired = v ? v.required : false;
    
    if (mode === 'empty') {
      dSimDraftValues[vn] = isRequired ? (type === 'price' ? 'R$ 9,90' : 'Texto') : '';
    } else if (mode === 'min') {
      if (type === 'price') dSimDraftValues[vn] = 'R$ 9';
      else if (type === 'discount') dSimDraftValues[vn] = '5%';
      else if (type === 'image') dSimDraftValues[vn] = (typeof fState!=='undefined'&&fState.camp&&fState.camp.cover) || '';
      else if (type === 'boolean') dSimDraftValues[vn] = 'Não';
      else dSimDraftValues[vn] = 'Açaí';
    } else if (mode === 'max') {
      if (type === 'price') dSimDraftValues[vn] = 'R$ 1.249,00';
      else if (type === 'discount') dSimDraftValues[vn] = '99% OFF + Frete Grátis';
      else if (type === 'image') dSimDraftValues[vn] = (typeof fState!=='undefined'&&fState.camp&&fState.camp.cover) || '';
      else if (type === 'boolean') dSimDraftValues[vn] = 'Sim';
      else {
        const nameLower = vn.toLowerCase();
        if (nameLower.includes('prod')) {
          dSimDraftValues[vn] = 'Super Combo Duplo Mega Burger Artesanal com Batata Frita e Molho Especial da Casa';
        } else if (nameLower.includes('desc') || nameLower.includes('detalhe')) {
          dSimDraftValues[vn] = 'Delicioso blend de carne bovina grelhada no fogo com muito queijo cheddar derretido, alface crespa, tomate fresco colhido no dia e molho secreto.';
        } else if (nameLower.includes('valid') || nameLower.includes('data')) {
          dSimDraftValues[vn] = 'Válido de segunda a quinta-feira exceto feriados e vésperas';
        } else {
          dSimDraftValues[vn] = 'Edição especial limitada até durarem os estoques de hoje';
        }
      }
    } else {
      dSimDraftValues[vn]=(type==='image')?'':((typeof gFieldSampleValue==='function')?gFieldSampleValue(v||{name:vn}):(v&&v.label)||vn);
    }
  });

  varsArr.forEach(vn=>{
    const v=dVars.find(x=>x.name===vn),input=document.getElementById('sim-input-'+vn);
    if(input)input.value=dSimDraftValues[vn]||'';
    dSimVarUpdateMeta(vn,dSimDraftValues[vn]||'',(v&&v.maxLen)?v.maxLen:0);
  });
  const labels={sample:'Exemplo aplicado',max:'Teste de limite aplicado',min:'Valores mínimos aplicados',empty:'Campos opcionais esvaziados'};
  const status=document.getElementById('d-sim-foot-status');if(status)status.textContent=labels[mode]||'Cenário aplicado';
  dSimScheduleRender(true);
}

function dCloseSimModal(){
  const modal=document.getElementById('d-sim-modal');if(!modal)return;
  clearTimeout(dSimRenderTimer);dSimRenderSeq++;
  modal.classList.remove('open');
  const trigger=dSimLastTrigger;setTimeout(()=>{if(trigger&&document.contains(trigger))trigger.focus();},0);
}
function dSimClearDraft(){
  dSimDraftValues={};
  dSimUsedVars().forEach(vn=>{
    const v=dVars.find(x=>x.name===vn),input=document.getElementById('sim-input-'+vn);
    if(input)input.value='';
    dSimVarUpdateMeta(vn,'',(v&&v.maxLen)?v.maxLen:0);
  });
  const status=document.getElementById('d-sim-foot-status');if(status)status.textContent='Campos limpos; o editor continua inalterado';
  dSimScheduleRender(true);
}
function dApplySim(){
  dSimValues=JSON.parse(JSON.stringify(dSimDraftValues));
  dSimActive=true;
  document.body.classList.add('simulating');
  dRenderCanvas();
  dCloseSimModal();
  const cnt=Object.keys(dSimValues).filter(k=>dSimValues[k]).length;
  gToast('Simulação ativa com '+cnt+' campo'+(cnt!==1?'s':'')+' preenchido'+(cnt!==1?'s':''));
  dSimUpdateTopbar();
}
function dResetSim(){
  const hadSimulation=dSimActive||Object.keys(dSimValues).length>0;
  dSimValues={};
  dSimDraftValues={};
  dSimActive=false;
  document.body.classList.remove('simulating');
  dRenderCanvas();
  dSimUsedVars().forEach(vn=>{
    const v=dVars.find(x=>x.name===vn),input=document.getElementById('sim-input-'+vn);
    if(input)input.value='';dSimVarUpdateMeta(vn,'',(v&&v.maxLen)?v.maxLen:0);
  });
  const status=document.getElementById('d-sim-foot-status');if(status)status.textContent='Campos limpos; o template original está preservado';
  dSimUpdateTopbar();
  if(document.getElementById('d-sim-modal')?.classList.contains('open'))dSimScheduleRender(true);
  if(hadSimulation)gToast('Simulação desativada');
}

function dSimUpdateTopbar(){
  const trigger=document.querySelector('[onclick="dOpenSimModal()"]');
  const ind=document.getElementById('d-sim-indicator');
  if(trigger){trigger.classList.toggle('is-active',dSimActive);trigger.setAttribute('aria-pressed',dSimActive?'true':'false');trigger.title=dSimActive?'Editar dados simulados':'Testar layout com dados reais';}
  if(ind){ind.style.display=dSimActive?'flex':'none';ind.setAttribute('role','button');ind.tabIndex=dSimActive?0:-1;ind.setAttribute('aria-label','Encerrar simulação');ind.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();dResetSim();}};}
}

document.addEventListener('keydown',e=>{
  const modal=document.getElementById('d-sim-modal');if(!modal?.classList.contains('open'))return;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();dCloseSimModal();return;}
  if(e.key!=='Tab')return;
  const focusable=[...modal.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled])')].filter(el=>el.offsetParent!==null);
  if(!focusable.length)return;
  const first=focusable[0],last=focusable[focusable.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
},true);

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
  if(dRulersOn){dRenderRulers();_dRulersTick();}
  gToast(dRulersOn?'✓ Réguas ativas':'Réguas ocultas');
}
// Watcher (só com réguas ativas): re-renderiza quando o FRAME muda de posição na tela —
// cobre scroll, pan, zoom e relayout (barra do pincel abrindo, painel redimensionando).
// Um listener de scroll não basta: relayout move a arte sem disparar scroll.
let _dRulersLastPos='';
function _dRulersTick(){
  if(!dRulersOn)return;
  const f=document.getElementById('d-canvas-frame');
  if(f){
    const r=f.getBoundingClientRect();
    const key=Math.round(r.left)+','+Math.round(r.top)+','+Math.round(r.width);
    if(key!==_dRulersLastPos){_dRulersLastPos=key;dRenderRulers();}
  }
  requestAnimationFrame(_dRulersTick);
}
function dRenderRulers(){
  if(!dRulersOn)return;
  const _abR=(typeof dGetActiveAB==='function')?dGetActiveAB():null;
  const f=_abR?{w:_abR.w,h:_abR.h}:(DFMT_SIZES[dFmt]||DFMT_SIZES.story); // tamanho real (custom/'orig')
  const scale=dZoomLevel/100;
  const step= f.w>1500 ? 100 : (f.w>800 ? 50 : 25);
  const rh=document.getElementById('d-ruler-h');
  const rv=document.getElementById('d-ruler-v');
  const frame=document.getElementById('d-canvas-frame');
  if(!rh||!rv||!frame)return;
  // Âncora: o "0" da régua é o canto do ARTBOARD na tela (compensa a centralização
  // do workspace e o scroll do wrapper — antes as marcas partiam do canto do painel).
  const fr=frame.getBoundingClientRect();
  const offX=fr.left-rh.getBoundingClientRect().left;
  const offY=fr.top-rv.getBoundingClientRect().top;
  const maxW=rh.clientWidth, maxH=rv.clientHeight;
  // Limpar
  rh.innerHTML='';rv.innerHTML='';
  // Marks horizontais — em coordenadas de tela, ancoradas no frame
  for(let x=0;x<=f.w;x+=step){
    const sx=offX+x*scale;
    if(sx<-40||sx>maxW+40)continue; // fora da régua visível
    const mark=document.createElement('div');
    mark.className='ruler-mark h'+(x%(step*2)===0?' lg':'');
    mark.style.left=sx+'px';
    rh.appendChild(mark);
    if(x%(step*2)===0){
      const lbl=document.createElement('div');
      lbl.className='ruler-mark-label h';
      lbl.style.left=sx+'px';
      lbl.textContent=x;
      rh.appendChild(lbl);
    }
  }
  // Marks verticais
  for(let y=0;y<=f.h;y+=step){
    const sy=offY+y*scale;
    if(sy<-40||sy>maxH+40)continue;
    const mark=document.createElement('div');
    mark.className='ruler-mark v'+(y%(step*2)===0?' lg':'');
    mark.style.top=sy+'px';
    rv.appendChild(mark);
    if(y%(step*2)===0){
      const lbl=document.createElement('div');
      lbl.className='ruler-mark-label v';
      lbl.style.top=sy+'px';
      lbl.textContent=y;
      rv.appendChild(lbl);
    }
  }
}

// Eventos de Panning (ferramenta Mão) no wrapper
document.addEventListener('DOMContentLoaded', () => {
  const wrapper = document.getElementById('d-canvas-wrapper');
  if (wrapper) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let scrollLeft = 0;
    let scrollTop = 0;

    wrapper.addEventListener('mousedown', (e) => {
      // Panning só ativa se a tool for 'hand'
      if (typeof dTool !== 'undefined' && dTool === 'hand') {
        isDragging = true;
        document.body.classList.add('tool-hand-dragging');
        startX = e.clientX;
        startY = e.clientY;
        scrollLeft = wrapper.scrollLeft;
        scrollTop = wrapper.scrollTop;
        e.preventDefault();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        wrapper.scrollLeft = scrollLeft - dx;
        wrapper.scrollTop = scrollTop - dy;
      }
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        document.body.classList.remove('tool-hand-dragging');
      }
    });
    
    wrapper.addEventListener('mouseleave', () => {
      if (isDragging) {
        isDragging = false;
        document.body.classList.remove('tool-hand-dragging');
      }
    });
  }
});

