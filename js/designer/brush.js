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
  const old=cv; // prancheta mudou de tamanho → preserva os pixels pintados
  cv=document.createElement('canvas');
  cv.id='d-paint-canvas';cv.width=f.w;cv.height=f.h;
  cv.style.cssText='position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:50;';
  if(old){
    // Copia a pintura antiga (ancorada no topo-esquerdo, sem esticar) e marca dirty —
    // descartar sem capturar fazia a pintura sumir E o histórico reciclar o dataURL
    // antigo, ressuscitando pintura esticada num undo posterior.
    try{ cv.getContext('2d').drawImage(old,0,0); }catch(e){}
    if(typeof dPaintDirty!=='undefined') dPaintDirty=true;
    old.remove();
  }
  frame.appendChild(cv);
  dAttachPaintListeners();
}
function dSyncPaintPointer(){
  const cv=document.getElementById('d-paint-canvas');
  if(!cv)return;
  cv.style.pointerEvents=['brush','eraser','smudge','blur','sharpen','gradient','bg-eraser','magic-eraser'].includes(dTool)?'auto':'none';
}
function dGetPaintCtx(){
  const cv=document.getElementById('d-paint-canvas');
  return cv?cv.getContext('2d'):null;
}
function dPaintStart(e){
  if(!['brush','eraser','smudge','blur','sharpen','gradient','bg-eraser','magic-eraser'].includes(dTool))return;
  e.preventDefault();
  dPainting=true;
  const pos=dCanvasPos(e);dPaintLast=pos;
  // Borrachas avançadas sobre os pixels do paint canvas: mágica = flood-fill num clique;
  // fundo = apaga por cor ao arrastar (raio = tamanho do pincel). Tolerância fixa (v1).
  if(dTool==='magic-eraser'){ const c=dGetPaintCtx(); if(c&&typeof dMagicEraseAt==='function') dMagicEraseAt(c,Math.round(pos.x),Math.round(pos.y),30); return; }
  if(dTool==='bg-eraser'){ const c=dGetPaintCtx(); if(c&&typeof dBgEraseAt==='function') dBgEraseAt(c,Math.round(pos.x),Math.round(pos.y),Math.max(1,dGetBrushStyle().size/2),30); return; }
  // Smudge/Blur/Gradiente operam sobre os pixels existentes — não pintam cor no clique
  if(dTool==='gradient'){dGradStart=pos;return;}
  if(dTool==='smudge'||dTool==='blur'||dTool==='sharpen')return;
  const ctx=dGetPaintCtx();if(!ctx)return;
  const bs=dGetBrushStyle();
  ctx.globalAlpha = bs.alpha;
  const col = (dTool==='eraser') ? '#000000' : bs.color;
  if(dTool==='eraser'){ ctx.globalCompositeOperation='destination-out'; }
  else{ ctx.globalCompositeOperation = bs.composite; }
  if(bs.preset==='calligraphy'){ ctx.fillStyle=col; ctx.save(); ctx.translate(pos.x,pos.y); ctx.rotate(15*Math.PI/180); ctx.fillRect(-bs.size/2,-bs.size/6,bs.size,bs.size/3); ctx.restore(); }
  else { _dBrushDab(ctx, pos.x, pos.y, bs, col); } // round/soft/square/dotted (dureza honrada)
  ctx.filter='none';
  ctx.globalAlpha=1;
}
function dPaintMove(e){
  if(!dPainting||!['brush','eraser','smudge','blur','sharpen','gradient','bg-eraser','magic-eraser'].includes(dTool))return;
  const pos=dCanvasPos(e);
  const ctx=dGetPaintCtx();if(!ctx)return;
  const bs=dGetBrushStyle();
  const sz=bs.size;
  // Ferramentas que operam sobre os pixels já pintados
  if(dTool==='gradient'){dPaintLast=pos;return;}                       // aplicado no mouseup
  if(dTool==='smudge'){dSmudgeStep(ctx,dPaintLast,pos,sz,bs);dPaintLast=pos;return;}
  if(dTool==='blur'){dBlurRegion(ctx,pos,sz);dPaintLast=pos;return;}
  if(dTool==='sharpen'){dSharpenRegion(ctx,pos,sz);dPaintLast=pos;return;}
  if(dTool==='bg-eraser'){ if(typeof dBgEraseAt==='function') dBgEraseAt(ctx,Math.round(pos.x),Math.round(pos.y),Math.max(1,sz/2),30); dPaintLast=pos; return; }
  if(dTool==='magic-eraser'){ return; } // flood-fill só no clique (dPaintStart), não no arrasto
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
  const col=(dTool==='eraser')?'#000000':bs.color;
  ctx.globalAlpha=bs.alpha*bs.flow;
  ctx.globalCompositeOperation=(dTool==='eraser')?'destination-out':bs.composite;
  // Pincel SUAVE (soft, ou redonda com dureza<100): carimba dabs interpolados ao longo do traço
  // (linha sólida não tem borda macia). Dureza agora vale para a redonda também.
  const isSoft = bs.preset==='soft' || (bs.preset==='round' && bs.hardness<0.99);
  if(isSoft){
    const dx=pos.x-dPaintLast.x, dy=pos.y-dPaintLast.y, dist=Math.sqrt(dx*dx+dy*dy);
    const step=Math.max(1, sz*0.2), n=Math.max(1, Math.ceil(dist/step));
    for(let i=1;i<=n;i++){ _dBrushDab(ctx, dPaintLast.x+dx*i/n, dPaintLast.y+dy*i/n, bs, col); }
    ctx.filter='none'; ctx.globalAlpha=1; dPaintLast=pos; return;
  }
  // Redonda dura / quadrada / caligráfica: traço sólido (rápido e contínuo)
  ctx.lineWidth=sz; ctx.lineCap=(bs.preset==='square'||bs.preset==='calligraphy')?'square':'round'; ctx.lineJoin='round';
  ctx.strokeStyle=col;
  ctx.beginPath();ctx.moveTo(dPaintLast.x,dPaintLast.y);ctx.lineTo(pos.x,pos.y);ctx.stroke();
  ctx.filter='none';
  ctx.globalAlpha=1;
  dPaintLast=pos;
}
function dPaintEnd(){
  const wasPainting=dPainting;
  if(dTool==='gradient'&&dPainting&&dGradStart)dApplyGradient(dGradStart,dPaintLast);
  dPainting=false;dGradStart=null;
  if(wasPainting && ['brush','eraser','smudge','blur','sharpen','gradient','bg-eraser','magic-eraser'].includes(dTool)){
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
  ctx.filter='blur('+Math.max(1,Math.round((sz/6)*(dBrush.strength/50)))+'px)'; // Força controla intensidade
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
  ctx.globalAlpha=Math.min(0.95, (dBrush.strength/100)); // Força = quanto arrasta
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
  const dx=x1-p0.x, dy=y1-p0.y, len=Math.max(1,Math.sqrt(dx*dx+dy*dy));
  const g=(bs.gradType==='radial')
    ? ctx.createRadialGradient(p0.x,p0.y,0, p0.x,p0.y,len)
    : ctx.createLinearGradient(p0.x,p0.y,x1,y1);
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
  // Escala REAL do DOM (rect reflete a transform corrente): durante os ~220ms da
  // transição de zoom, dZoomLevel já é o valor final mas o frame ainda está numa
  // escala intermediária — traços logo após o zoom caíam deslocados do cursor.
  const scale=(rect.width&&frame.offsetWidth)?(rect.width/frame.offsetWidth):(dZoomLevel/100);
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
let dStampOffset=null; // offset fixo entre cliques quando "Alinhado" está ligado
let dGradStart=null; // ponto inicial do arraste da ferramenta Gradiente
function dDoStamp(targetLayer){
  if(!dStampSource)return;
  // Re-resolve a origem pelo id: undo/redo troca dLayers por clones e a referência
  // guardada vira um objeto morto (carimbava estado antigo; deletar a origem não invalidava)
  const src=dLayers.find(x=>x.id===dStampSource.id);
  if(!src){
    dStampSource=null;
    if(typeof dStampUpdateStatus==='function')dStampUpdateStatus();
    gToast('A origem do carimbo não existe mais — marque outra com S');
    return;
  }
  dHistoryPush();
  const clone=JSON.parse(JSON.stringify(src));
  clone.id='l-'+(++dLyrCnt);
  clone.name=src.name+' (cópia)';
  clone.x=targetLayer.x+20;clone.y=targetLayer.y+20;
  dLayers.push(clone);
  dRenderCanvas();dRenderLayersList();dStats();dMarkUnsaved();
  gToast('Camada duplicada: '+clone.name);
  dStampSource=null;dSetTool('select');
}

/* ── CLICK ON CANVAS (add layer) ── */
document.getElementById('d-canvas-frame').addEventListener('click',function(e){
  // Ferramentas de criação precisam funcionar mesmo quando o clique cai sobre um layer.
  // Ex.: o layer "Fundo" cobre o canvas inteiro e interceptaria todos os cliques, fazendo
  // texto/forma/moldura/imagem não dispararem quando esse layer existe.
  const isTextTool=(dTool==='text'||dTool==='text-h'||dTool==='text-v'||dTool==='mask-text-h'||dTool==='mask-text-v');
  const isMeasureTool=(dTool==='color-sampler'||dTool==='note'||dTool==='count');
  const creationTool=(isTextTool||isMeasureTool||dTool==='rect'||dTool==='frame'||dTool==='img'||dTool==='stamp');
  const onFrame=(e.target===this||e.target.id==='d-canvas-frame'||e.target.id==='d-paint-canvas'||e.target.id==='d-measure-overlay'||e.target.closest('#d-measure-overlay'));
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
  if(dTool==='text'||dTool==='text-h')dAddTextAt(x,y,false);
  else if(dTool==='text-v')dAddTextAt(x,y,true);
  else if(dTool==='mask-text-h')dAddTextMaskAt(x,y,false);
  else if(dTool==='mask-text-v')dAddTextMaskAt(x,y,true);
  else if(dTool==='color-sampler'){
    if(typeof dColorSamplerAdd==='function') dColorSamplerAdd(x,y);
  }
  else if(dTool==='note'){
    if(typeof dNoteAdd==='function') dNoteAdd(x,y);
  }
  else if(dTool==='count'){
    if(typeof dCountAdd==='function') dCountAdd(x,y);
  }
  else if(dTool==='rect')dAddShapeAt(x,y);
  else if(dTool==='frame')dAddFrameAt(x,y);
  else if(dTool==='img')dAddImageAt(x,y);
  else if(dTool==='stamp'){
    if(!dStampSource){gToast('Marque uma fonte primeiro (botão "Marcar fonte" ou tecla S)');}
    else{
      dHistoryPush();
      const clone=JSON.parse(JSON.stringify(dStampSource));
      clone.id='l-'+(++dLyrCnt);
      clone.name=dStampSource.name+' (cópia)';
      if(dStampAligned){
        // Alinhado: mantém o mesmo deslocamento relativo à fonte entre cliques
        if(!dStampOffset) dStampOffset={dx:x-dStampSource.x, dy:y-dStampSource.y};
        clone.x=x-dStampOffset.dx; clone.y=y-dStampOffset.dy;
      } else {
        clone.x=x-Math.round(clone.w/2); clone.y=y-Math.round(clone.h/2);
      }
      dLayers.push(clone);
      dRenderCanvas();dRenderLayersList();dStats();dMarkUnsaved();
      gToast('✓ "'+clone.name+'" carimbado!');
      // mantém a fonte p/ múltiplos carimbos; "Limpar"/Esc reseta
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
  strength: 50,      // dedo/desfoque/nitidez
  mode: 'source-over',
  gradType: 'linear', // gradiente: linear|radial
  color: '#FF9000',
  preset: 'round',
};

// Um "carimbo" (dab) do pincel honrando preset + dureza. col = cor efetiva (eraser usa preto).
// Suave = gradiente radial (dureza controla onde começa o fade). Quadrada = retângulo.
function _dBrushDab(ctx, x, y, bs, col){
  const r = bs.size/2;
  if(bs.preset==='square'){ ctx.fillStyle=col; ctx.fillRect(x-r, y-r, bs.size, bs.size); return; }
  const soft = bs.preset==='soft' || (bs.preset==='round' && bs.hardness < 0.99);
  if(soft){
    const hard = Math.min(0.99, Math.max(0.01, bs.hardness));
    const transp = /^#([0-9a-f]{6})$/i.test(col) ? col+'00' : 'rgba(0,0,0,0)';
    const g = ctx.createRadialGradient(x,y,0, x,y,r);
    g.addColorStop(0, col); g.addColorStop(hard, col); g.addColorStop(1, transp);
    ctx.fillStyle = g;
  } else { ctx.fillStyle = col; }
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
}

function dShowBrushBar(toolName){
  const bar = document.getElementById('d-brush-bar');
  if(!bar)return;
  // bg-eraser usa o tamanho do pincel (raio) → mostra a barra; magic-eraser é clique (sem barra).
  const isPaint = ['brush','eraser','smudge','blur','sharpen','gradient','bg-eraser'].includes(toolName);
  const show = isPaint || toolName==='stamp';
  bar.classList.toggle('visible', show);
  if(!show) return;
  // Mostra só os grupos relevantes para a ferramenta atual (contextual)
  bar.querySelectorAll('[data-tools]').forEach(el=>{
    el.style.display = el.dataset.tools.split(' ').includes(toolName) ? '' : 'none';
  });
  const label = document.getElementById('bb-tool-label');
  if(label)label.textContent = {brush:'Pincel',eraser:'Borracha',smudge:'Dedo',blur:'Desfoque',sharpen:'Nitidez',gradient:'Gradiente',stamp:'Carimbo','bg-eraser':'Borracha de fundo','magic-eraser':'Borracha mágica'}[toolName] || 'Pincel';
  
  // Força atualização visual inicial de todos os sliders ativos
  ['size','hardness','opacity','flow','strength'].forEach(prop => {
    if(dBrush[prop] !== undefined) dBrushUpdate(prop, dBrush[prop]);
  });

  if(toolName==='stamp'){ dStampUpdateStatus(); }
  else { setTimeout(dRenderBrushPreview, 10); }
}

function dBrushUpdate(prop, val){
  if(['size','hardness','opacity','flow','strength'].includes(prop)){
    dBrush[prop] = parseInt(val);
    const num = document.getElementById('bb-'+prop+'-num');
    if(num)num.value = val;
    const slider = document.getElementById('bb-'+prop);
    if(slider){
      const min = slider.min || 0;
      const max = slider.max || 100;
      const pct = ((val - min) / (max - min)) * 100;
      slider.style.background = `linear-gradient(to right, var(--dm-orange) ${pct}%, rgba(255,255,255,0.15) ${pct}%)`;
    }
  }else{
    dBrush[prop] = val;
  }
  if(prop === 'color'){
    const sw = document.getElementById('bb-color-sw');
    if(sw)sw.style.background = val;
    // Sync com o swatch antigo e com o global FG
    const swOld = document.getElementById('d-brush-color-sw');
    if(swOld)swOld.style.background = val;
    const pkOld = document.getElementById('d-brush-color-pick');
    if(pkOld)pkOld.value = val;
    
    // Sync Foreground Tool
    const swFg = document.getElementById('dtool-color-fg');
    if(swFg)swFg.style.backgroundColor = val;
    const pkFg = document.getElementById('d-color-fg-pick');
    if(pkFg && pkFg.value !== val) pkFg.value = val;
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
  // Mapear preset para dureza default
  const _setHard=v=>{ const sl=document.getElementById('bb-hardness'); if(sl)sl.value=v; dBrushUpdate('hardness', v); };
  if(preset === 'soft'){ _setHard(30); }
  else if(preset === 'round'){ _setHard(100); }
  else if(preset === 'calligraphy'){ _setHard(100); }
  dRenderBrushPreview();
}
// Input numérico digitado → estado + slider (clampa ao range)
function dBrushNumInput(prop, val){
  const max = (prop==='size') ? 200 : 100;
  let n = Math.max(prop==='hardness'?0:1, Math.min(max, parseInt(val)||0));
  const sl = document.getElementById('bb-'+prop); if(sl) sl.value = n;
  dBrushUpdate(prop, n);
}
// Ajuste de tamanho por teclado ([ diminui, ] aumenta)
function dBrushNudgeSize(delta){
  const n = Math.max(1, Math.min(200, dBrush.size + delta));
  const sl=document.getElementById('bb-size'); if(sl)sl.value=n;
  dBrushUpdate('size', n);
}

/* ── CARIMBO: estado + opções da barra ── */
let dStampAligned = false;
function dStampUpdateStatus(){
  const s=document.getElementById('bb-stamp-status');
  if(s){ s.textContent = dStampSource ? (dStampSource.name||'camada') : 'nenhuma'; s.classList.toggle('on', !!dStampSource); }
  const a=document.getElementById('bb-stamp-aligned');
  if(a){ a.textContent = 'Alinhado: '+(dStampAligned?'sim':'não'); a.classList.toggle('active', dStampAligned); }
}
function dStampMarkSource(){
  const l = (typeof dLayers!=='undefined') ? dLayers.find(x=>x.id===dSelId) : null;
  if(!l){ gToast('Selecione uma camada para marcar como fonte'); return; }
  dStampSource = l; dStampOffset = null;
  gToast('✓ Origem do carimbo: '+(l.name||'camada'));
  dStampUpdateStatus();
}
function dStampToggleAligned(){ dStampAligned=!dStampAligned; dStampOffset=null; dStampUpdateStatus(); }
function dStampClearSource(){ dStampSource=null; dStampOffset=null; dStampUpdateStatus(); gToast('Origem do carimbo limpa'); }

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
    strength: dBrush.strength / 100,
    gradType: dBrush.gradType,
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

// ── Nitidez (Unsharp Mask): amplifica bordas subtraindo versão desfocada ──
let _dSharpenC1, _dSharpenC2;
function dSharpenRegion(ctx, pos, sz) {
  const cv = ctx.canvas;
  const r = Math.max(4, sz);
  const sx = Math.max(0, Math.round(pos.x - r));
  const sy = Math.max(0, Math.round(pos.y - r));
  const w  = Math.min(r * 2, cv.width  - sx);
  const h  = Math.min(r * 2, cv.height - sy);
  if(w <= 0 || h <= 0) return;

  const orig = ctx.getImageData(sx, sy, w, h);

  if(!_dSharpenC1) { _dSharpenC1 = document.createElement('canvas'); _dSharpenC2 = document.createElement('canvas'); }
  _dSharpenC1.width = w; _dSharpenC1.height = h;
  _dSharpenC2.width = w; _dSharpenC2.height = h;

  _dSharpenC1.getContext('2d').putImageData(orig, 0, 0);
  const tctx2 = _dSharpenC2.getContext('2d');
  tctx2.filter = 'blur(1.5px)';
  tctx2.drawImage(_dSharpenC1, 0, 0);
  const blurred = tctx2.getImageData(0, 0, w, h);

  // result = orig + (orig - blurred) * amount  →  realça bordas
  const result = ctx.createImageData(w, h);
  const amount = Math.max(0.2, (dBrush.strength/100)*3); // Força = intensidade da nitidez
  for(let i = 0; i < orig.data.length; i += 4){
    for(let c = 0; c < 3; c++){
      result.data[i+c] = Math.min(255, Math.max(0,
        orig.data[i+c] + (orig.data[i+c] - blurred.data[i+c]) * amount
      ));
    }
    result.data[i+3] = orig.data[i+3];
  }
  ctx.putImageData(result, sx, sy);
}

/* ══ GRUPO NITIDEZ — flyout Photoshop-style ══ */
let dNitidezLast = 'blur';

const _dNitidezIcons = {
  blur:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3" fill="currentColor" opacity=".3"/><circle cx="12" cy="12" r="6" opacity=".5"/><circle cx="12" cy="12" r="9" opacity=".7"/></svg>`,
  sharpen: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 22 12 12 22 2 12"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
  smudge:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11h.01M7 6h.01M11 3h.01M15 3h.01M19 6h.01M21 11h.01M19 16c-2 3-7 3-9-1-1-2-3-2-4-1-1 1-1 3 0 4 2 2 7 0 13-2Z"/></svg>`,
};

function dNitidezActivate() { dSetTool(dNitidezLast); }

function dNitidezFlyout(e) {
  e.preventDefault(); e.stopPropagation();
  const flyout = document.getElementById('vt-nitidez-flyout');
  if(!flyout) return;
  const isOpen = flyout.classList.contains('open');
  document.querySelectorAll('.vt-flyout').forEach(f => f.classList.remove('open'));
  if(!isOpen){
    flyout.classList.add('open');
    setTimeout(() => {
      document.addEventListener('click', function _closeFlyout(){
        document.querySelectorAll('.vt-flyout').forEach(f => f.classList.remove('open'));
        document.removeEventListener('click', _closeFlyout);
      });
    }, 0);
  }
}

function dNitidezPick(tool, e) {
  if(e) e.stopPropagation();
  dNitidezLast = tool;
  document.querySelectorAll('.vt-flyout').forEach(f => f.classList.remove('open'));
  const icon = document.getElementById('dtool-nitidez-icon');
  if(icon) icon.innerHTML = _dNitidezIcons[tool] || '';
  dSetTool(tool);
}

/* ══ GRUPO FORMA — flyout Photoshop-style ══ */
let dFormaLast = 'rect';

const _dFormaIcons = {
  rect:     `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`,
  ellipse:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="12" rx="10" ry="7"/></svg>`,
  triangle: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 3 22 21 2 21"/></svg>`,
  polygon:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 20.7 7 20.7 17 12 22 3.3 17 3.3 7"/></svg>`,
  line:     `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="20" x2="20" y2="4"/></svg>`,
  star:     `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
};

// Despacho único de forma: line → dAddLine, rect → ferramenta de clique, demais → inserir
function _dFormaDispatch(kind){
  if(kind==='line') { dAddLine(); return; }
  // TODAS as formas entram no modo clique-e-desenha (não só o retângulo) — consistente
  // e sem "forma morta no centro". O gate de desenho (canvas.js:405) e dEndDrawShape já
  // criam ellipse/triangle/polygon/star por coordenada; dSetTool trata todas no grupo 'forma'.
  dSetTool(kind);
}
function dFormaActivate() { _dFormaDispatch(dFormaLast); }

function dFormaFlyout(e) {
  e.preventDefault(); e.stopPropagation();
  const flyout = document.getElementById('vt-forma-flyout');
  if(!flyout) return;
  const isOpen = flyout.classList.contains('open');
  document.querySelectorAll('.vt-flyout').forEach(f => f.classList.remove('open'));
  if(!isOpen){
    flyout.classList.add('open');
    setTimeout(() => {
      document.addEventListener('click', function _closeFlyout(){
        document.querySelectorAll('.vt-flyout').forEach(f => f.classList.remove('open'));
        document.removeEventListener('click', _closeFlyout);
      });
    }, 0);
  }
}

function dFormaPick(kind, e) {
  if(e) e.stopPropagation();
  dFormaLast = kind;
  document.querySelectorAll('.vt-flyout').forEach(f => f.classList.remove('open'));
  const icon = document.getElementById('dtool-forma-icon');
  if(icon) icon.innerHTML = _dFormaIcons[kind] || '';
  _dFormaDispatch(kind);
}

/* ══ GRUPO TEXTO — flyout Photoshop-style ══ */
let dTextLast = 'text-h';

const _dTextIcons = {
  'text-h': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>`,
  'text-v': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 4v16M5 4h8M17 6l2 2 2-2M19 8v10M17 16l2 2 2-2"/></svg>`,
  'mask-text-h': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="2 2"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>`,
  'mask-text-v': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="2 2"><path d="M9 4v16M5 4h8M17 6l2 2 2-2M19 8v10M17 16l2 2 2-2"/></svg>`,
};

function dTextActivate() {
  if (typeof dSetTool === 'function') {
    dSetTool(dTextLast);
  }
}

function dTextFlyout(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  const flyout = document.getElementById('vt-text-flyout');
  if(!flyout) return;
  const isOpen = flyout.classList.contains('open');
  document.querySelectorAll('.vt-flyout').forEach(f => f.classList.remove('open'));
  if(!isOpen){
    flyout.classList.add('open');
    setTimeout(() => {
      document.addEventListener('click', function _closeFlyout(){
        document.querySelectorAll('.vt-flyout').forEach(f => f.classList.remove('open'));
        document.removeEventListener('click', _closeFlyout);
      });
    }, 0);
  }
}

function dTextPick(tool, e) {
  if(e) e.stopPropagation();
  dTextLast = tool;
  document.querySelectorAll('.vt-flyout').forEach(f => f.classList.remove('open'));
  const icon = document.getElementById('dtool-text-icon');
  if(icon && typeof _dTextIcons !== 'undefined') {
    icon.innerHTML = _dTextIcons[tool] || '';
  }
  if (typeof dSetTool === 'function') {
    dSetTool(tool);
  }
}

function dAddTextMaskAt(x, y, vertical) {
  if (typeof dLayers === 'undefined' || typeof dSelId === 'undefined') return;
  const targetLayer = dLayers.find(lyr => lyr.id === dSelId);
  if (!targetLayer) {
    if (typeof gToast === 'function') gToast('Selecione uma camada primeiro para aplicar a máscara de texto');
    return;
  }
  
  const tempId = 'l-temp-mask-text';
  // Garante remoção de temporário antigo
  dLayers = dLayers.filter(lyr => lyr.id !== tempId);

  const isVert = !!vertical;
  const tempLayer = {
    id: tempId,
    name: 'Temp Mask Text',
    type: 'text',
    x, y,
    w: isVert ? 60 : 250,
    h: isVert ? 250 : 60,
    content: 'Texto Máscara',
    font: targetLayer.font || "'Roboto Black'",
    fontSize: targetLayer.fontSize || 32,
    color: '#FFFFFF',
    textAlign: 'center',
    visible: true,
    vertical: isVert,
    isTempMaskText: true,
    targetMaskLayerId: targetLayer.id
  };

  dLayers.push(tempLayer);
  if (typeof dSelLayerState === 'function') dSelLayerState(tempId);
  if (typeof dRenderCanvas === 'function') dRenderCanvas();
  if (typeof dRenderLayersList === 'function') dRenderLayersList();

  const frame = document.getElementById('d-canvas-frame');
  if (frame) {
    const tempEl = frame.querySelector(`[data-id="${tempId}"]`);
    if (tempEl && typeof dStartInlineEdit === 'function') {
      dStartInlineEdit(tempLayer, tempEl);
    }
  }
}

/* ══ GRUPO MEDIÇÃO — flyout Photoshop-style ══ */
let dEyedropLast = 'eyedrop';

const _dEyedropIcons = {
  'eyedrop': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/></svg>`,
  'color-sampler': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>`,
  'ruler': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="5" x2="19" y2="19"/><circle cx="5" cy="5" r="1.5"/><circle cx="19" cy="19" r="1.5"/><path d="M9 5l2 2M13 9l2 2"/></svg>`,
  'note': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  'count': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>`,
};

function dEyedropActivate() {
  if (typeof dSetTool === 'function') {
    dSetTool(dEyedropLast);
  }
}

function dEyedropFlyout(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  const flyout = document.getElementById('vt-eyedrop-flyout');
  if(!flyout) return;
  const isOpen = flyout.classList.contains('open');
  document.querySelectorAll('.vt-flyout').forEach(f => f.classList.remove('open'));
  if(!isOpen){
    flyout.classList.add('open');
    setTimeout(() => {
      document.addEventListener('click', function _closeFlyout(){
        document.querySelectorAll('.vt-flyout').forEach(f => f.classList.remove('open'));
        document.removeEventListener('click', _closeFlyout);
      });
    }, 0);
  }
}

function dEyedropPick(tool, e) {
  if(e) e.stopPropagation();
  dEyedropLast = tool;
  document.querySelectorAll('.vt-flyout').forEach(f => f.classList.remove('open'));
  const icon = document.getElementById('dtool-eyedrop-icon');
  if(icon && typeof _dEyedropIcons !== 'undefined') {
    icon.innerHTML = _dEyedropIcons[tool] || '';
  }
  if (typeof dSetTool === 'function') {
    dSetTool(tool);
  }
}

/* ══ GRUPO SELEÇÃO — flyout Photoshop-style ══ */
let dSelectLast = 'select';

const _dSelectIcons = {
  'select':       `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3l14 9-7 1-4 7z"/></svg>`,
  'hand':         `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v11a4 4 0 0 0 4 4h3a5 5 0 0 0 5-5v-6M8 11V8.5a1.5 1.5 0 0 1 3 0V11"/></svg>`,
  'obj-select':   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="4 2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>`,
  'quick-select': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3l14 9-7 1-4 7z"/><path d="M18 14v6M15 17h6"/></svg>`,
  'magic-wand':   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21l10-10M13 3l1.5 3 3 1.5-3 1.5L13 12l-1.5-3-3-1.5 3-1.5zM19 9l2-2M15 5l2-2"/></svg>`,
  'artboard':     `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="5" width="14" height="14" rx="1"/><line x1="2" y1="5" x2="5" y2="5"/><line x1="5" y1="2" x2="5" y2="5"/><line x1="19" y1="2" x2="19" y2="5"/><line x1="19" y1="5" x2="22" y2="5"/><line x1="2" y1="19" x2="5" y2="19"/><line x1="5" y1="19" x2="5" y2="22"/><line x1="19" y1="19" x2="19" y2="22"/><line x1="19" y1="19" x2="22" y2="19"/></svg>`,
};

function dSelectActivate() { dSetTool(dSelectLast); }

function dSelectFlyout(e) {
  e.preventDefault(); e.stopPropagation();
  const flyout = document.getElementById('vt-select-flyout');
  if(!flyout) return;
  const isOpen = flyout.classList.contains('open');
  document.querySelectorAll('.vt-flyout').forEach(function(f) { f.classList.remove('open'); });
  if(!isOpen) {
    flyout.classList.add('open');
    setTimeout(function() {
      document.addEventListener('click', function _closeFlyout(){
        document.querySelectorAll('.vt-flyout').forEach(function(f) { f.classList.remove('open'); });
        document.removeEventListener('click', _closeFlyout);
      });
    }, 0);
  }
}

function dSelectPick(tool, e) {
  if(e) e.stopPropagation();
  dSelectLast = tool;
  document.querySelectorAll('.vt-flyout').forEach(function(f) { f.classList.remove('open'); });
  const icon = document.getElementById('dtool-select-icon');
  if(icon && typeof _dSelectIcons !== 'undefined') icon.innerHTML = _dSelectIcons[tool] || '';
  dSetTool(tool);
}

/* ══ GRUPO MÍDIA — flyout Photoshop-style ══ */
let dFrameLast = 'frame';

const _dFrameIcons = {
  'frame': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`,
  'img': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`
};

function dFrameActivate() {
  if (typeof dSetTool === 'function') {
    dSetTool(dFrameLast);
  }
}

function dFrameFlyout(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  const flyout = document.getElementById('vt-frame-flyout');
  if(!flyout) return;
  const isOpen = flyout.classList.contains('open');
  document.querySelectorAll('.vt-flyout').forEach(f => f.classList.remove('open'));
  if(!isOpen){
    flyout.classList.add('open');
    setTimeout(() => {
      document.addEventListener('click', function _closeFlyout(){
        document.querySelectorAll('.vt-flyout').forEach(f => f.classList.remove('open'));
        document.removeEventListener('click', _closeFlyout);
      });
    }, 0);
  }
}

function dFramePick(tool, e) {
  if(e) e.stopPropagation();
  dFrameLast = tool;
  document.querySelectorAll('.vt-flyout').forEach(f => f.classList.remove('open'));
  const icon = document.getElementById('dtool-frame-icon');
  if(icon && typeof _dFrameIcons !== 'undefined') {
    icon.innerHTML = _dFrameIcons[tool] || '';
  }
  if (typeof dSetTool === 'function') {
    dSetTool(tool);
  }
}

/* ══ GRUPO DADOS — flyout Photoshop-style ══ */
let dDataLast = 'var-data';

const _dDataIcons = {
  'var-data': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7" stroke-width="3"/></svg>`,
  'qr-code': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M7 17h.01M17 17h.01M17 7h.01M7 7h.01"/></svg>`
};

// Despacho único do grupo Dados. var-data entra no MODO VINCULAR (ferramenta ativa):
// o usuário clica num elemento da arte → o seletor abre ali e liga o Dado (ver canvas.js).
// (Antes só abria o painel e não fazia nada — o "engodo".) qr-code sem lib.
function _dDataDispatch(tool){
  if (tool === 'qr-code') { gToast('Gerador de QR Code em breve'); return; }
  if (tool === 'var-data') {
    if (typeof dSetTool === 'function') dSetTool('var-data');
    if (typeof dActivatePanel === 'function') dActivatePanel('camada');
    gToast('Clique num texto ou imagem para vincular um dado');
    return;
  }
  if (typeof dSetTool === 'function') dSetTool(tool);
}
function dDataActivate() { _dDataDispatch(dDataLast); }

function dDataFlyout(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  const flyout = document.getElementById('vt-data-flyout');
  if(!flyout) return;
  const isOpen = flyout.classList.contains('open');
  document.querySelectorAll('.vt-flyout').forEach(f => f.classList.remove('open'));
  if(!isOpen){
    flyout.classList.add('open');
    setTimeout(() => {
      document.addEventListener('click', function _closeFlyout(){
        document.querySelectorAll('.vt-flyout').forEach(f => f.classList.remove('open'));
        document.removeEventListener('click', _closeFlyout);
      });
    }, 0);
  }
}

function dDataPick(tool, e) {
  if(e) e.stopPropagation();
  dDataLast = tool;
  document.querySelectorAll('.vt-flyout').forEach(f => f.classList.remove('open'));
  const icon = document.getElementById('dtool-data-icon');
  if(icon && typeof _dDataIcons !== 'undefined') {
    icon.innerHTML = _dDataIcons[tool] || '';
  }
  _dDataDispatch(tool);
}

/* ══ GRUPO PINCEL — flyout Photoshop-style ══ */
let dBrushLast = 'brush';

const _dBrushIcons = {
  'brush': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l4-4 4 4-4 4-4-4z"/><path d="M7 13l9-9 4 4-9 9"/></svg>`,
  'eraser': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H7L3 16l12-12 5 5-4.5 4.5"/><line x1="6" y1="20" x2="20" y2="20"/></svg>`,
  'stamp': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="8" rx="2"/><path d="M4 22h16M12 10v12"/></svg>`,
  'bg-eraser': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H7L3 16l12-12 5 5-4.5 4.5"/><line x1="6" y1="20" x2="20" y2="20"/><circle cx="17" cy="7" r="1.6" fill="currentColor" stroke="none"/></svg>`,
  'magic-eraser': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H7L3 16l12-12 5 5-4.5 4.5"/><line x1="6" y1="20" x2="20" y2="20"/><path d="M18 2l.7 1.8L20.5 4.5l-1.8.7L18 7l-.7-1.8L15.5 4.5l1.8-.7z" fill="currentColor" stroke="none"/></svg>`
};

function dBrushActivate() {
  if (typeof dSetTool === 'function') {
    dSetTool(dBrushLast);
  }
}

// Para manter compatibilidade com antigos clicks diretos em eraser e stamp
if (typeof window !== 'undefined') {
  window.dEraserActivate = function() { dSetTool('eraser'); };
  window.dStampActivate = function() { dSetTool('stamp'); };
}

function dBrushFlyout(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  const flyout = document.getElementById('vt-brush-flyout');
  if(!flyout) return;
  const isOpen = flyout.classList.contains('open');
  document.querySelectorAll('.vt-flyout').forEach(f => f.classList.remove('open'));
  if(!isOpen){
    flyout.classList.add('open');
    setTimeout(() => {
      document.addEventListener('click', function _closeFlyout(){
        document.querySelectorAll('.vt-flyout').forEach(f => f.classList.remove('open'));
        document.removeEventListener('click', _closeFlyout);
      });
    }, 0);
  }
}

function dBrushPick(tool, e) {
  if(e) e.stopPropagation();
  dBrushLast = tool;
  document.querySelectorAll('.vt-flyout').forEach(f => f.classList.remove('open'));
  const icon = document.getElementById('dtool-brush-icon');
  if(icon && typeof _dBrushIcons !== 'undefined') {
    icon.innerHTML = _dBrushIcons[tool] || '';
  }
  if (typeof dSetTool === 'function') {
    dSetTool(tool);
  }
}

/* ══ GRUPO PREENCHIMENTO — flyout Photoshop-style ══ */
let dFillLast = 'bucket';

const _dFillIcons = {
  'bucket': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><path d="m5 2 5 5M2 13h15M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/></svg>`,
  'gradient': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="12" x2="21" y2="12"/></svg>`
};

function dFillActivate() {
  if (typeof dSetTool === 'function') {
    dSetTool(dFillLast === 'bucket' ? 'bucket' : 'gradient');
  }
}

function dFillFlyout(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  const flyout = document.getElementById('vt-fill-flyout');
  if(!flyout) return;
  const isOpen = flyout.classList.contains('open');
  document.querySelectorAll('.vt-flyout').forEach(f => f.classList.remove('open'));
  if(!isOpen){
    flyout.classList.add('open');
    setTimeout(() => {
      document.addEventListener('click', function _closeFlyout(){
        document.querySelectorAll('.vt-flyout').forEach(f => f.classList.remove('open'));
        document.removeEventListener('click', _closeFlyout);
      });
    }, 0);
  }
}

function dFillPick(tool, e) {
  if(e) e.stopPropagation();
  dFillLast = tool;
  document.querySelectorAll('.vt-flyout').forEach(f => f.classList.remove('open'));
  const icon = document.getElementById('dtool-fill-icon');
  if(icon && typeof _dFillIcons !== 'undefined') {
    icon.innerHTML = _dFillIcons[tool] || '';
  }
  if (typeof dSetTool === 'function') {
    dSetTool(tool === 'bucket' ? 'bucket' : 'gradient');
  }
}

// Expondo os mapas de ícones globais no objeto window para o dSetTool
if (typeof window !== 'undefined') {
  window._dSelectIcons = _dSelectIcons;
  window._dTextIcons = _dTextIcons;
  window._dFormaIcons = _dFormaIcons;
  window._dFrameIcons = _dFrameIcons;
  window._dDataIcons = _dDataIcons;
  window._dBrushIcons = _dBrushIcons;
  window._dFillIcons = _dFillIcons;
  window._dNitidezIcons = _dNitidezIcons;
  window._dEyedropIcons = _dEyedropIcons;
}

