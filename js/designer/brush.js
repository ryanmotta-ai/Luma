/**
 * js/designer/brush.js
 *
 * Sistema de pincel/borracha/carimbo: dPaintStart, dPaintMove, dPaintEnd,
 * dDoStamp, dBrushUpdate, dBrushSetPreset, dShowBrushBar.
 * Depende de: designer/canvas.js
 */

// Tamanho lógico do paint canvas = tamanho do ARTBOARD ATIVO (igual ao frame em
// dApplyFormat). Usar DFMT_SIZES[dFmt] dava resolução errada em pranchetas
// redimensionadas → pincel desalinhado e pintura apagada a cada render.
function dPaintTargetSize(){
  const ab=(typeof dGetActiveAB==='function')?dGetActiveAB():null;
  return ab?{w:ab.w,h:ab.h}:(DFMT_SIZES[dFmt]||{w:1080,h:1920});
}
function dEnsurePaintCanvas(){
  const frame=document.getElementById('d-canvas-frame');
  const f=dPaintTargetSize();
  let cv=document.getElementById('d-paint-canvas');
  // Se já existe com tamanho correto, não recriar
  if(cv&&cv.width===f.w&&cv.height===f.h)return;
  // Remover antigo se existir
  if(cv)cv.remove();
  cv=document.createElement('canvas');
  cv.id='d-paint-canvas';cv.width=f.w;cv.height=f.h;
  cv.style.cssText='position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:50;';
  frame.appendChild(cv);
  dAttachPaintListeners();
}
function dSyncPaintPointer(){
  const cv=document.getElementById('d-paint-canvas');
  if(!cv)return;
  cv.style.pointerEvents=['brush','eraser','smudge','blur','gradient'].includes(dTool)?'auto':'none';
}
function dGetPaintCtx(){
  const cv=document.getElementById('d-paint-canvas');
  return cv?cv.getContext('2d'):null;
}
function dPaintStart(e){
  if(!['brush','eraser','smudge','blur','gradient'].includes(dTool))return;
  e.preventDefault();
  dPainting=true;
  const pos=dCanvasPos(e);dPaintLast=pos;
  // Smudge/Blur/Gradiente operam sobre os pixels existentes — não pintam cor no clique
  if(dTool==='gradient'){dGradStart=pos;return;}
  if(dTool==='smudge'||dTool==='blur')return;
  const ctx=dGetPaintCtx();if(!ctx)return;
  const bs=dGetBrushStyle();
  ctx.globalAlpha = bs.alpha;
  if(dTool==='eraser'){
    ctx.globalCompositeOperation='destination-out';
    ctx.fillStyle='rgba(0,0,0,1)';
  }else{
    ctx.globalCompositeOperation = bs.composite;
    ctx.fillStyle = bs.color;
  }
  // Aplicar preset
  if(bs.preset === 'dotted'){
    ctx.beginPath();ctx.arc(pos.x,pos.y,bs.size/2,0,Math.PI*2);ctx.fill();
  }else if(bs.preset === 'square'){
    ctx.fillRect(pos.x-bs.size/2, pos.y-bs.size/2, bs.size, bs.size);
  }else if(bs.preset === 'soft'){
    // Soft = gradiente radial; hardness controla onde começa o fade (clampado p/ sempre suavizar)
    const hard = Math.min(0.99, Math.max(0.01, bs.hardness));
    const transp = /^#([0-9a-f]{6})$/i.test(bs.color) ? bs.color+'00' : 'rgba(0,0,0,0)';
    const g = ctx.createRadialGradient(pos.x,pos.y,0,pos.x,pos.y,bs.size/2);
    g.addColorStop(0, bs.color);
    g.addColorStop(hard, bs.color);
    g.addColorStop(1, transp);
    ctx.fillStyle = g;
    ctx.beginPath();ctx.arc(pos.x,pos.y,bs.size/2,0,Math.PI*2);ctx.fill();
  }else{
    ctx.beginPath();ctx.arc(pos.x,pos.y,bs.size/2,0,Math.PI*2);ctx.fill();
  }
  ctx.filter='none';
  ctx.globalAlpha=1;
}
function dPaintMove(e){
  if(!dPainting||!['brush','eraser','smudge','blur','gradient'].includes(dTool))return;
  const pos=dCanvasPos(e);
  const ctx=dGetPaintCtx();if(!ctx)return;
  const bs=dGetBrushStyle();
  const sz=bs.size;
  // Ferramentas que operam sobre os pixels já pintados
  if(dTool==='gradient'){dPaintLast=pos;return;}                       // aplicado no mouseup
  if(dTool==='smudge'){dSmudgeStep(ctx,dPaintLast,pos,sz,bs);dPaintLast=pos;return;}
  if(dTool==='blur'){dBlurRegion(ctx,pos,sz);dPaintLast=pos;return;}
  // Pontilhado: skipa frames
  if(bs.preset==='dotted'){
    const dx=pos.x-dPaintLast.x, dy=pos.y-dPaintLast.y;
    const dist=Math.sqrt(dx*dx+dy*dy);
    if(dist < sz*1.2){return;}
    ctx.globalAlpha=bs.alpha*bs.flow;
    ctx.fillStyle=bs.color;
    ctx.beginPath();ctx.arc(pos.x,pos.y,sz/2,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
    dPaintLast=pos;return;
  }
  ctx.lineWidth=sz;ctx.lineCap=bs.preset==='square'||bs.preset==='calligraphy'?'square':'round';
  ctx.lineJoin='round';
  ctx.globalAlpha=bs.alpha*bs.flow;
  if(dTool==='eraser'){
    ctx.globalCompositeOperation='destination-out';
    ctx.strokeStyle='rgba(0,0,0,1)';
  }else{
    ctx.globalCompositeOperation=bs.composite;
    ctx.strokeStyle=bs.color;
  }
  ctx.beginPath();ctx.moveTo(dPaintLast.x,dPaintLast.y);ctx.lineTo(pos.x,pos.y);ctx.stroke();
  ctx.filter='none';
  ctx.globalAlpha=1;
  dPaintLast=pos;
}
function dPaintEnd(){
  const wasPainting=dPainting;
  if(dTool==='gradient'&&dPainting&&dGradStart)dApplyGradient(dGradStart,dPaintLast);
  dPainting=false;dGradStart=null;
  if(wasPainting && ['brush','eraser','smudge','blur','gradient'].includes(dTool)){
    dMarkUnsaved();
    dPaintDirty=true;   // marca a pintura como alterada → próximo commit captura o PNG
    dHistoryPush();     // pintura entra no histórico de undo/redo (A4)
  }
}

// Blur real: desfoca os pixels já pintados na região (canvas temporário + ctx.filter)
function dBlurRegion(ctx,pos,sz){
  const cv=ctx.canvas;
  const r=Math.max(4,sz);
  const sx=Math.max(0,Math.round(pos.x-r)), sy=Math.max(0,Math.round(pos.y-r));
  const w=Math.min(r*2,cv.width-sx), h=Math.min(r*2,cv.height-sy);
  if(w<=0||h<=0)return;
  const tmp=document.createElement('canvas');tmp.width=w;tmp.height=h;
  tmp.getContext('2d').drawImage(cv,sx,sy,w,h,0,0,w,h);
  ctx.save();
  ctx.filter='blur('+Math.max(1,Math.round(sz/6))+'px)';
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  ctx.drawImage(tmp,sx,sy,w,h);
  ctx.restore();
}

// Smudge: arrasta os pixels existentes da posição anterior p/ a nova com alpha parcial
function dSmudgeStep(ctx,from,to,sz,bs){
  const cv=ctx.canvas;
  const r=Math.max(4,sz);
  const sx=Math.max(0,Math.round(from.x-r)), sy=Math.max(0,Math.round(from.y-r));
  const w=Math.min(r*2,cv.width-sx), h=Math.min(r*2,cv.height-sy);
  if(w<=0||h<=0)return;
  const tmp=document.createElement('canvas');tmp.width=w;tmp.height=h;
  tmp.getContext('2d').drawImage(cv,sx,sy,w,h,0,0,w,h);
  ctx.save();
  ctx.filter='none';
  ctx.globalAlpha=Math.min(0.5,(bs.alpha||1)*0.5);
  ctx.globalCompositeOperation='source-over';
  ctx.drawImage(tmp,Math.round(to.x-r),Math.round(to.y-r));
  ctx.restore();
}

// Gradiente: preenche o paint canvas com gradiente linear na direção arrastada (cor → transparente)
function dApplyGradient(p0,p1){
  const ctx=dGetPaintCtx();if(!ctx)return;
  const cv=ctx.canvas;const bs=dGetBrushStyle();
  let x1=p1.x,y1=p1.y;
  if(p0.x===x1&&p0.y===y1)y1=y1+1; // evita gradiente degenerado (mesmo ponto)
  const transp=/^#([0-9a-f]{6})$/i.test(bs.color)?bs.color+'00':'rgba(0,0,0,0)';
  const g=ctx.createLinearGradient(p0.x,p0.y,x1,y1);
  g.addColorStop(0,bs.color);g.addColorStop(1,transp);
  ctx.save();
  ctx.filter='none';ctx.globalAlpha=bs.alpha;ctx.globalCompositeOperation='source-over';
  ctx.fillStyle=g;ctx.fillRect(0,0,cv.width,cv.height);
  ctx.restore();
  gToast('Gradiente aplicado');
}
function dCanvasPos(e){
  const frame=document.getElementById('d-canvas-frame');
  const rect=frame.getBoundingClientRect();
  const scale=dZoomLevel/100;
  return{x:Math.round((e.clientX-rect.left)/scale),y:Math.round((e.clientY-rect.top)/scale)};
}
function dClearPaint(){
  const ctx=dGetPaintCtx();if(!ctx)return;
  const cv=document.getElementById('d-paint-canvas');
  ctx.clearRect(0,0,cv.width,cv.height);gToast('Pintura limpa');
  dPaintDirty=true;dHistoryPush();dMarkUnsaved(); // limpar pintura é desfazível (A4)
}

/* ── CARIMBO (stamp/clone) ── */
let dStampSource=null;
let dGradStart=null; // ponto inicial do arraste da ferramenta Gradiente
function dDoStamp(targetLayer){
  if(!dStampSource)return;
  dHistoryPush();
  const clone=JSON.parse(JSON.stringify(dStampSource));
  clone.id='l-'+(++dLyrCnt);
  clone.name=dStampSource.name+' (cópia)';
  clone.x=targetLayer.x+20;clone.y=targetLayer.y+20;
  dLayers.push(clone);
  dRenderCanvas();dRenderLayersList();dStats();dMarkUnsaved();
  gToast('Layer clonado: '+clone.name);
  dStampSource=null;dSetTool('select');
}

/* ── CLICK ON CANVAS (add layer) ── */
document.getElementById('d-canvas-frame').addEventListener('click',function(e){
  // Ferramentas de criação precisam funcionar mesmo quando o clique cai sobre um layer.
  // Ex.: o layer "Fundo" cobre o canvas inteiro e interceptaria todos os cliques, fazendo
  // texto/forma/moldura/imagem não dispararem quando esse layer existe.
  const creationTool=(dTool==='text'||dTool==='rect'||dTool==='frame'||dTool==='img'||dTool==='stamp');
  const onFrame=(e.target===this||e.target.id==='d-canvas-frame'||e.target.id==='d-paint-canvas');
  if(!creationTool){
    // Demais ferramentas (select etc.) só reagem ao clique direto no frame/paint canvas.
    if(!onFrame)return;
  }else if(!onFrame){
    // Criação sobre um layer é OK, mas nunca ao clicar em controles de UI sobrepostos
    // (botões, inputs, selects, handles de resize) — isso quebraria a interação deles.
    if(e.target.closest('button,input,select,textarea,.layer-handle'))return;
  }
  const f=DFMT_SIZES[dFmt];
  const rect=this.getBoundingClientRect();const scale=dZoomLevel/100;
  const x=Math.round((e.clientX-rect.left)/scale);const y=Math.round((e.clientY-rect.top)/scale);
  if(dTool==='text')dAddTextAt(x,y);
  else if(dTool==='rect')dAddShapeAt(x,y);
  else if(dTool==='frame')dAddFrameAt(x,y);
  else if(dTool==='img')dAddImageAt(x,y);
  else if(dTool==='stamp'){
    if(!dStampSource){gToast('Primeiro selecione um layer e pressione S para marcar o source');}
    else{
      // Clonar na posição do clique
      dHistoryPush();
      const clone=JSON.parse(JSON.stringify(dStampSource));
      clone.id='l-'+(++dLyrCnt);
      clone.name=dStampSource.name+' (cópia)';
      clone.x=x-Math.round(clone.w/2);
      clone.y=y-Math.round(clone.h/2);
      dLayers.push(clone);
      dRenderCanvas();dRenderLayersList();dStats();dMarkUnsaved();
      gToast('✓ "'+clone.name+'" carimbado!');
      // manter source para múltiplos carimbos, Esc limpa
    }
  }
});
// Paint listeners no paint canvas diretamente (não canvas-frame)
// O paint canvas fica sobre tudo e recebe eventos quando brush/eraser ativo
function dAttachPaintListeners(){
  const cv=document.getElementById('d-paint-canvas');
  if(!cv||cv.__paintBound)return;
  cv.__paintBound=true;
  cv.addEventListener('mousedown',dPaintStart);
  cv.addEventListener('mousemove',dPaintMove);
  cv.addEventListener('mouseup',dPaintEnd);
  cv.addEventListener('mouseleave',dPaintEnd);
}


/* ── SEL / DESEL ── */


/* ══ BRUSH BAR (Photoshop-style options) ══ */
let dBrush = {
  size: 8,
  hardness: 100,
  opacity: 100,
  flow: 100,
  mode: 'source-over',
  color: '#FF9000',
  preset: 'round',
};

function dShowBrushBar(toolName){
  const bar = document.getElementById('d-brush-bar');
  if(!bar)return;
  const isPaint = ['brush','eraser','smudge','blur','gradient'].includes(toolName);
  bar.classList.toggle('visible', isPaint);
  if(isPaint){
    const label = document.getElementById('bb-tool-label');
    if(label)label.textContent = {brush:'Pincel',eraser:'Borracha',smudge:'Borrar',blur:'Desfocar',gradient:'Gradiente'}[toolName] || 'Pincel';
    setTimeout(dRenderBrushPreview, 10);
  }
}

function dBrushUpdate(prop, val){
  if(['size','hardness','opacity','flow'].includes(prop)){
    dBrush[prop] = parseInt(val);
    const num = document.getElementById('bb-'+prop+'-num');
    if(num)num.textContent = val;
  }else{
    dBrush[prop] = val;
  }
  if(prop === 'color'){
    const sw = document.getElementById('bb-color-sw');
    if(sw)sw.style.background = val;
    // Sync com o swatch antigo
    const swOld = document.getElementById('d-brush-color-sw');
    if(swOld)swOld.style.background = val;
    const pkOld = document.getElementById('d-brush-color-pick');
    if(pkOld)pkOld.value = val;
  }
  if(prop === 'size'){
    // Sync com slider antigo
    const sizeOld = document.getElementById('d-brush-size');
    if(sizeOld)sizeOld.value = val;
    const sizeNum = document.getElementById('d-brush-val');
    if(sizeNum)sizeNum.textContent = val;
  }
  dRenderBrushPreview();
}

function dBrushSetPreset(preset){
  dBrush.preset = preset;
  document.querySelectorAll('.bb-preset[data-preset]').forEach(b=>{
    b.classList.toggle('active', b.dataset.preset === preset);
  });
  // Mapear preset para hardness/spacing default
  if(preset === 'soft'){dBrush.hardness = 30; document.getElementById('bb-hardness').value = 30; document.getElementById('bb-hardness-num').textContent = 30;}
  else if(preset === 'round'){dBrush.hardness = 100; document.getElementById('bb-hardness').value = 100; document.getElementById('bb-hardness-num').textContent = 100;}
  else if(preset === 'calligraphy'){dBrush.hardness = 100;}
  else if(preset === 'dotted'){/* spacing maior tratado no draw */}
  dRenderBrushPreview();
}

/* Atualizar dPaintStart, dPaintMove para usar dBrush */
function dGetBrushStyle(){
  return {
    size: dBrush.size,
    color: dBrush.color,
    alpha: dBrush.opacity / 100,
    flow: dBrush.flow / 100,
    composite: dBrush.mode,
    preset: dBrush.preset,
    hardness: dBrush.hardness / 100,
  };
}

function dRenderBrushPreview() {
  const canvas = document.getElementById('bb-brush-preview');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const bs = dGetBrushStyle();
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  
  // Normaliza o tamanho do preview (limita o raio visual para caber no box de 24px)
  const maxRadius = 10;
  const scale = bs.size > 0 ? Math.min(1, maxRadius / (bs.size / 2)) : 1;
  const visualRadius = Math.max(1.5, (bs.size / 2) * scale);

  ctx.save();
  ctx.globalAlpha = bs.alpha;

  if (bs.preset === 'soft') {
    // Gradiente radial para simular dureza (hardness)
    const hard = Math.min(0.99, Math.max(0.01, bs.hardness));
    const transp = bs.color.startsWith('#') ? bs.color + '00' : 'rgba(0,0,0,0)';
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, visualRadius);
    g.addColorStop(0, bs.color);
    g.addColorStop(hard, bs.color);
    g.addColorStop(1, transp);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, visualRadius, 0, Math.PI * 2);
    ctx.fill();
  } else if (bs.preset === 'square') {
    ctx.fillStyle = bs.color;
    ctx.fillRect(cx - visualRadius, cy - visualRadius, visualRadius * 2, visualRadius * 2);
  } else if (bs.preset === 'calligraphy') {
    ctx.fillStyle = bs.color;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(15 * Math.PI / 180);
    ctx.fillRect(-visualRadius, -visualRadius / 3, visualRadius * 2, visualRadius * 2 / 3);
    ctx.restore();
  } else if (bs.preset === 'dotted') {
    ctx.strokeStyle = bs.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, visualRadius, 0, Math.PI * 2);
    ctx.stroke();
    // Ponto central
    ctx.fillStyle = bs.color;
    ctx.beginPath();
    ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Normal / Hard round
    ctx.fillStyle = bs.color;
    ctx.beginPath();
    ctx.arc(cx, cy, visualRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

