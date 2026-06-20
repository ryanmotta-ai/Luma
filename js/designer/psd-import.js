/**
 * js/designer/psd-import.js
 *
 * Import de .psd → template editável da Luma (com tela de revisão).
 * Robustez: ag-psd vendorizado (offline-first), parse em Web Worker (com fallback),
 * fontSize corrigido por DPI+caixa, rasters comprimidos, toggle de z-order.
 * Mapeamento por camada: texto Editável / Variável {{}} / Cor (shape) / Imagem fiel.
 *  - camada nomeada {{nome}} entra já como variável (+ heurística por nome/conteúdo);
 *  - sombra/contorno (layer effects) viram l.shadow / l.strokeW;
 *  - camada de cor sólida vira shape re-colorável.
 * Depende de: designer/templates.js, core/layout.js, core/toast.js, 00-config.js (gPackImgUrl).
 */

/* ── carrega o ag-psd: vendorizado (local, offline) → fallback CDN ── */
let _agPsdPromise=null;
function dLoadAgPsd(){
  if(window.agPsd) return Promise.resolve(window.agPsd);
  if(_agPsdPromise) return _agPsdPromise;
  const sources=['assets/vendor/ag-psd.js','https://cdn.jsdelivr.net/npm/ag-psd/dist/bundle.js'];
  _agPsdPromise=new Promise((resolve,reject)=>{
    let i=0;
    (function tryNext(){
      if(i>=sources.length){ _agPsdPromise=null; reject(new Error('Não foi possível carregar a biblioteca de PSD')); return; }
      const s=document.createElement('script'); s.async=true; s.src=sources[i++];
      s.onload=()=> window.agPsd ? resolve(window.agPsd) : tryNext();
      s.onerror=tryNext;
      document.head.appendChild(s);
    })();
  });
  return _agPsdPromise;
}

/* ── helpers de leitura ── */
function _dPsdHex(c){
  if(!c||c.r==null) return null;
  const h=v=>('0'+Math.max(0,Math.min(255,Math.round(v))).toString(16)).slice(-2);
  return '#'+h(c.r)+h(c.g)+h(c.b);
}
function _dPsdTextStyle(t){
  if(!t) return {};
  if(t.style && typeof t.style==='object') return t.style;
  if(t.styleRuns && t.styleRuns[0] && t.styleRuns[0].style) return t.styleRuns[0].style;
  return {};
}
function _dPsdAlign(t){
  const p=(t&&t.paragraphStyle)||(t&&t.paragraphStyleRuns&&t.paragraphStyleRuns[0]&&t.paragraphStyleRuns[0].style)||{};
  const j=String(p.justification||p.align||'left').toLowerCase();
  if(j.includes('center')||j.includes('middle')) return 'center';
  if(j.includes('right')) return 'right';
  return 'left';
}
// #4b — fontSize robusto: parte do style (corrigido por transform e DPI) e ancora na caixa
function _dPsdFontSize(t,h,content,res){
  const s=_dPsdTextStyle(t);
  let fs=s.fontSize||s.size||0;
  if(fs && t.transform && t.transform.length>=4) fs*=Math.abs(t.transform[3]||1);
  // PARAGRAPH (box) text: o tamanho da fonte é o que o designer definiu e a caixa é fixa/alta.
  // Ancorar na caixa (abaixo) INFLAVA a fonte e estourava o texto — pois nLines só conta quebras
  // explícitas (\n), não o wrap por largura. Aqui confiamos no tamanho real. Point text segue igual.
  if(t && t.shapeType==='box' && fs>=6 && fs<=2000) return Math.round(fs);
  const nLines=Math.max(1, String(content||'').split('\n').filter(x=>x.trim()).length);
  // boxFs: quanto de altura cabe por linha; cap de 180px evita caixas muito altas gerarem fs gigante
  const boxFs=Math.min(h/(nLines*1.25), 180);
  if(fs>=4 && fs<=4000){
    if(res>90 && fs < boxFs*0.55) fs=fs*(res/72);      // style em pontos + doc hi-res → escala
    if(fs < boxFs*0.4 || fs > boxFs*2.5) fs=boxFs;     // ainda incoerente → usa a caixa
    return Math.round(Math.max(8,fs));
  }
  // Se a caixa é muito pequena (h < 12px) usa mínimo razoável
  if(h < 12) return 12;
  return Math.round(Math.max(8,boxFs));
}
// Caixa de PARÁGRAFO (box text): deriva {x,y,w,h} em px ABSOLUTOS do doc a partir de
// node.text.boxBounds/bounds. O espaço dessas coords é ambíguo entre versões do ag-psd, então
// testamos 2 hipóteses (text-space→transform e px-absoluto cru) e só aceitamos a que CONTÉM o
// bbox de glifos do layer (node.left/top/right/bottom) e não explode. Retorna null se nenhuma servir.
function _dPsdParagraphBox(node){
  try{
    const t=node.text; if(!t) return null;
    let bb=t.boxBounds||t.bounds; if(!bb) return null;
    if(Array.isArray(bb)) bb={left:bb[0],top:bb[1],right:bb[2],bottom:bb[3]};
    if(bb.left==null||bb.right==null||bb.top==null||bb.bottom==null) return null;
    const tr=(t.transform&&t.transform.length>=6)?t.transform:[1,0,0,1,0,0];
    const a=tr[0],b=tr[1],c=tr[2],d=tr[3],e=tr[4],f=tr[5];
    const gx0=node.left||0, gy0=node.top||0, gx1=node.right||0, gy1=node.bottom||0;
    const tol=Math.max(4, Math.round(Math.min(gx1-gx0,gy1-gy0)*0.3));
    const corners=(map)=>{
      const p=[map(bb.left,bb.top),map(bb.right,bb.top),map(bb.right,bb.bottom),map(bb.left,bb.bottom)];
      let mnX=Infinity,mnY=Infinity,mxX=-Infinity,mxY=-Infinity;
      p.forEach(q=>{ if(q[0]<mnX)mnX=q[0]; if(q[0]>mxX)mxX=q[0]; if(q[1]<mnY)mnY=q[1]; if(q[1]>mxY)mxY=q[1]; });
      return {x:mnX,y:mnY,w:mxX-mnX,h:mxY-mnY};
    };
    const valid=(box)=>box && isFinite(box.w) && isFinite(box.h) && box.w>1 && box.h>1
      && box.x<=gx0+tol && box.y<=gy0+tol && (box.x+box.w)>=gx1-tol && (box.y+box.h)>=gy1-tol
      && box.w<=Math.max((gx1-gx0)*6,4000) && box.h<=Math.max((gy1-gy0)*6,4000);
    const cands=[ corners((x,y)=>[a*x+c*y+e, b*x+d*y+f]), corners((x,y)=>[x,y]) ];
    for(const box of cands){ if(valid(box)) return {x:Math.round(box.x),y:Math.round(box.y),w:Math.round(box.w),h:Math.round(box.h)}; }
    return null;
  }catch(e){ return null; }
}
// #2 — efeitos de camada (layer.effects) → props da Luma. Lê sombra projetada, sombra interna,
// brilho externo, sobreposição de cor e contorno (com alinhamento). _u: parseUnits → {value} ou número.
function _dPsdEffects(node){
  const fx=node.effects||{}; const out={};
  const _u=v=>{ if(v==null) return 0; return (v.value!=null)?+v.value:+v; };
  // Sombra projetada
  let ds=fx.dropShadow; if(Array.isArray(ds)) ds=ds[0];
  if(ds && ds.enabled!==false){
    out.shadow=true;
    out.shadowColor=gFxRgba(_dPsdHex(ds.color)||'#000000', ds.opacity!=null?ds.opacity:.5);
    out.shadowBlur=Math.round(_u(ds.size));
    out.shadowDist=Math.round(_u(ds.distance));
    if(ds.angle!=null) out.shadowAngle=Math.round(ds.angle);
  }
  // Sombra interna
  let is=fx.innerShadow; if(Array.isArray(is)) is=is[0];
  if(is && is.enabled!==false){
    out.innerShadow=true;
    out.innerShadowColor=gFxRgba(_dPsdHex(is.color)||'#000000', is.opacity!=null?is.opacity:.5);
    out.innerShadowBlur=Math.round(_u(is.size));
    out.innerShadowDist=Math.round(_u(is.distance));
    if(is.angle!=null) out.innerShadowAngle=Math.round(is.angle);
  }
  // Brilho externo
  let og=fx.outerGlow; if(Array.isArray(og)) og=og[0];
  if(og && og.enabled!==false){
    out.glow=true;
    out.glowColor=gFxRgba(_dPsdHex(og.color)||'#ffffff', og.opacity!=null?og.opacity:.6);
    out.glowSize=Math.max(1,Math.round(_u(og.size)));
  }
  // Brilho interno (inner glow)
  let ig=fx.innerGlow; if(Array.isArray(ig)) ig=ig[0];
  if(ig && ig.enabled!==false){
    out.innerGlow=true;
    out.innerGlowColor=gFxRgba(_dPsdHex(ig.color)||'#ffffff', ig.opacity!=null?ig.opacity:.6);
    out.innerGlowSize=Math.max(1,Math.round(_u(ig.size)));
  }
  // Chanfro/relevo (bevel & emboss) → aprox.: realce + sombra internos
  let bv=fx.bevel; if(Array.isArray(bv)) bv=bv[0];
  if(bv && bv.enabled!==false){
    out.bevel=true;
    out.bevelSize=Math.max(1,Math.round(_u(bv.size)));
    if(bv.angle!=null) out.bevelAngle=Math.round(bv.angle);
    out.bevelHighlight=gFxRgba(_dPsdHex(bv.highlightColor)||'#ffffff', bv.highlightOpacity!=null?bv.highlightOpacity:.75);
    out.bevelShadow=gFxRgba(_dPsdHex(bv.shadowColor)||'#000000', bv.shadowOpacity!=null?bv.shadowOpacity:.75);
  }
  // Sobreposição de cor (color overlay / solidFill)
  let so=fx.solidFill; if(Array.isArray(so)) so=so[0];
  if(so && so.enabled!==false && so.color){
    out.overlay=true;
    out.overlayColor=_dPsdHex(so.color)||'#000000';
    out.overlayOpacity=(so.opacity!=null?+so.opacity:1);
  }
  // Sobreposição de gradiente (gradient overlay)
  let go2=fx.gradientOverlay; if(Array.isArray(go2)) go2=go2[0];
  if(go2 && go2.enabled!==false && go2.gradient && go2.gradient.colorStops){
    const src=go2.gradient; const opAt=loc=>{ const os=src.opacityStops||[]; if(!os.length) return 1; let b=os[0]; os.forEach(s=>{ if(Math.abs((s.location||0)-loc)<Math.abs((b.location||0)-loc)) b=s; }); return b.opacity!=null?b.opacity:1; };
    out.gradientOverlay={
      type:String(go2.type||src.style||'linear').toLowerCase().includes('radial')?'radial':'linear',
      angle:(go2.angle!=null?Math.round(go2.angle):90),
      opacity:(go2.opacity!=null?+go2.opacity:1),
      stops:src.colorStops.map(s=>({color:_dPsdHex(s.color)||'#000000', pos:Math.max(0,Math.min(1,s.location||0)), opacity:opAt(s.location||0)}))
    };
  }
  // Contorno (frame FX) + alinhamento
  let st=fx.stroke; if(Array.isArray(st)) st=st[0];
  if(st && st.enabled!==false){
    out.strokeW=Math.max(1,Math.round((st.size&&st.size.value)||st.size||2));
    out.strokeColor=_dPsdHex((st.color&&(st.color.color||st.color)))||'#000000';
    if(st.position) out.strokeAlign=({inside:'inside',insetFrame:'inside',center:'center',centeredFrame:'center',outside:'outside',outsetFrame:'outside'}[st.position])||'outside';
  }
  return out;
}
// #2 — detecta cor sólida uniforme num canvas → hex (ou null)
function _dPsdSolidColor(canvas){
  try{
    const w=canvas.width,h=canvas.height; if(w<2||h<2) return null;
    const data=canvas.getContext('2d').getImageData(0,0,w,h).data;
    const sx=Math.max(1,Math.floor(w/40)), sy=Math.max(1,Math.floor(h/40));
    let r0=-1,g0=0,b0=0,opaque=0,total=0;
    for(let y=0;y<h;y+=sy) for(let x=0;x<w;x+=sx){
      const i=(y*w+x)*4, a=data[i+3]; total++;
      if(a<200) continue; opaque++;
      if(r0<0){ r0=data[i];g0=data[i+1];b0=data[i+2]; }
      else if(Math.abs(data[i]-r0)>10||Math.abs(data[i+1]-g0)>10||Math.abs(data[i+2]-b0)>10) return null;
    }
    if(r0<0 || opaque/total<0.6) return null;
    return _dPsdHex({r:r0,g:g0,b:b0});
  }catch(e){ return null; }
}
// #4c — raster comprimido: downscale (máx 1600) + JPEG p/ opaco, PNG p/ transparência
function _dPsdHasAlpha(canvas){
  try{
    const w=canvas.width,h=canvas.height,d=canvas.getContext('2d').getImageData(0,0,w,h).data;
    const sx=Math.max(1,Math.floor(w/50)),sy=Math.max(1,Math.floor(h/50));
    for(let y=0;y<h;y+=sy) for(let x=0;x<w;x+=sx){ if(d[(y*w+x)*4+3]<250) return true; }
    return false;
  }catch(e){ return true; }
}
function _dPsdRasterURL(canvas){
  try{
    const MAX=1600, w=canvas.width, h=canvas.height;
    const scale=Math.min(1, MAX/Math.max(w,h));
    const hasAlpha=_dPsdHasAlpha(canvas);
    let src=canvas;
    if(scale<1){
      const tw=Math.max(1,Math.round(w*scale)), th=Math.max(1,Math.round(h*scale));
      const c=document.createElement('canvas'); c.width=tw; c.height=th;
      const cx=c.getContext('2d'); cx.imageSmoothingQuality='high'; cx.drawImage(canvas,0,0,tw,th); src=c;
    }
    return hasAlpha ? src.toDataURL('image/png') : src.toDataURL('image/jpeg',0.82);
  }catch(e){ try{ return canvas.toDataURL('image/png'); }catch(_){ return null; } }
}
// Dimensões/origem da caixa de um node
function _dPsdBox(node){ return { x:Math.round(node.left||0), y:Math.round(node.top||0),
  w:Math.max(1,Math.round((node.right||0)-(node.left||0))), h:Math.max(1,Math.round((node.bottom||0)-(node.top||0))) }; }
// Máscara de CAMADA (raster) do PSD → canvas alpha do tamanho do layer (luminância→alpha)
function _dPsdLayerMaskCanvas(node){
  const mk=node.mask; if(!mk || mk.disabled || !mk.canvas) return null;
  const b=_dPsdBox(node), def=(mk.defaultColor!=null?mk.defaultColor:0);
  const mx=Math.round((mk.left||0)-b.x), my=Math.round((mk.top||0)-b.y);
  const tmp=document.createElement('canvas'); tmp.width=b.w; tmp.height=b.h;
  const tctx=tmp.getContext('2d');
  tctx.fillStyle='rgb('+def+','+def+','+def+')'; tctx.fillRect(0,0,b.w,b.h);
  tctx.drawImage(mk.canvas, mx, my);
  const id=tctx.getImageData(0,0,b.w,b.h), d=id.data;
  for(let i=0;i<d.length;i+=4){ const lum=d[i]*.299+d[i+1]*.587+d[i+2]*.114; d[i]=0;d[i+1]=0;d[i+2]=0;d[i+3]=lum; }
  tctx.putImageData(id,0,0); return tmp;
}
// CLIPPING mask: a cobertura (alpha) da camada-base recortada na caixa do layer atual → canvas alpha
function _dPsdClipMaskCanvas(node, base){
  if(!base || !base.canvas) return null;
  const b=_dPsdBox(node), bb=_dPsdBox(base);
  const tmp=document.createElement('canvas'); tmp.width=b.w; tmp.height=b.h;
  const tctx=tmp.getContext('2d');
  tctx.drawImage(base.canvas, bb.x-b.x, bb.y-b.y); // base no espaço do layer
  const id=tctx.getImageData(0,0,b.w,b.h), d=id.data;
  for(let i=0;i<d.length;i+=4){ d[i]=0;d[i+1]=0;d[i+2]=0; } // mantém alpha (cobertura), zera rgb
  tctx.putImageData(id,0,0); return tmp;
}
// Downscale de um canvas (mantém proporção) → dataURL PNG. Usado p/ máscaras: elas são
// esticadas pro box no render (maskSize 100% 100% / preserveAspectRatio none), então perder
// resolução é seguro e evita máscaras gigantes furando a quota do localStorage.
function _dPsdDownscaleMaskURL(canvas, max){
  try{
    const w=canvas.width, h=canvas.height, scale=Math.min(1, max/Math.max(w,h));
    if(scale>=1) return canvas.toDataURL('image/png');
    const tw=Math.max(1,Math.round(w*scale)), th=Math.max(1,Math.round(h*scale));
    const c=document.createElement('canvas'); c.width=tw; c.height=th;
    const cx=c.getContext('2d'); cx.imageSmoothingQuality='high'; cx.drawImage(canvas,0,0,tw,th);
    return c.toDataURL('image/png');
  }catch(e){ try{ return canvas.toDataURL('image/png'); }catch(_){ return null; } }
}
// Compõe máscara de camada + clipping (multiplica alphas) → dataURL alpha (ou null)
function _dPsdComputeMask(node, base){
  try{
    const lm=_dPsdLayerMaskCanvas(node);
    const cm=(node.clipping)?_dPsdClipMaskCanvas(node, base):null;
    if(!lm && !cm) return null;
    const b=_dPsdBox(node);
    const out=document.createElement('canvas'); out.width=b.w; out.height=b.h;
    const octx=out.getContext('2d');
    if(lm && cm){
      const a=lm.getContext('2d').getImageData(0,0,b.w,b.h), c=cm.getContext('2d').getImageData(0,0,b.w,b.h);
      const ad=a.data, cd=c.data;
      for(let i=3;i<ad.length;i+=4){ ad[i]=Math.round(ad[i]*cd[i]/255); ad[i-1]=0;ad[i-2]=0;ad[i-3]=0; }
      octx.putImageData(a,0,0);
    } else { octx.drawImage((lm||cm),0,0); }
    return _dPsdDownscaleMaskURL(out, 700);
  }catch(e){ return null; }
}
// Máscara VETORIAL (node.vectorMask): rasteriza os paths bézier num canvas alpha do tamanho
// do layer → dataURL (opaco dentro do recorte). Ex.: fundo com mordida/onda nas bordas.
// Os knots vêm em pixels ABSOLUTOS do documento (ag-psd multiplica por width/height do PSD),
// então deslocamos pela origem da caixa do layer. Retorna null em qualquer falha (fallback seguro).
function _dPsdVectorMaskURL(node){
  try{
    const vm=node.vectorMask;
    if(!vm || vm.disable || !vm.paths || !vm.paths.length || typeof Path2D==='undefined') return null;
    const b=_dPsdBox(node);
    const p2d=new Path2D(); let drew=false; let rule='nonzero';
    vm.paths.forEach(path=>{
      const k=path&&path.knots; if(!k||k.length<2) return;
      if(path.fillRule==='even-odd') rule='evenodd';
      const px=(i,o)=>k[i].points[o]-b.x, py=(i,o)=>k[i].points[o+1]-b.y; // o=0 in-handle, 2 âncora, 4 out-handle
      p2d.moveTo(px(0,2), py(0,2));
      const last=path.open?k.length-1:k.length;
      for(let i=0;i<last;i++){
        const j=(i+1)%k.length;
        p2d.bezierCurveTo(px(i,4),py(i,4), px(j,0),py(j,0), px(j,2),py(j,2));
      }
      if(!path.open) p2d.closePath();
      drew=true;
    });
    if(!drew) return null;
    const c=document.createElement('canvas'); c.width=b.w; c.height=b.h;
    const ctx=c.getContext('2d'); ctx.fillStyle='#000';
    if(vm.invert){ // inverte: tudo opaco, depois fura o recorte (path vira transparente)
      ctx.fillRect(0,0,b.w,b.h);
      ctx.globalCompositeOperation='destination-out'; ctx.fill(p2d, rule);
      ctx.globalCompositeOperation='source-over';
    } else {       // padrão: dentro do path → alpha 255 (visível), fora → transparente
      ctx.fill(p2d, rule);
    }
    return _dPsdDownscaleMaskURL(c, 700);
  }catch(e){ return null; }
}
// Traçado vetorial (node.vectorStroke) → {strokeW, strokeColor} ou {} (sem traçado).
function _dPsdShapeStroke(node){
  const vs=node.vectorStroke; const out={};
  try{
    if(vs && vs.strokeEnabled!==false){
      const lwRaw=vs.lineWidth; const lw=(lwRaw&&lwRaw.value!=null)?lwRaw.value:lwRaw;
      if(lw>0){
        out.strokeW=Math.max(1,Math.round(lw));
        const c=vs.content&&(vs.content.color||vs.content);
        out.strokeColor=_dPsdHex(c)||'#000000';
        if(vs.lineAlignment) out.strokeAlign=({inside:'inside',center:'center',outside:'outside'}[vs.lineAlignment])||'center';
        if(vs.lineCapType) out.strokeCap=({butt:'butt',round:'round',square:'square'}[vs.lineCapType])||'butt';
        if(vs.lineJoinType) out.strokeJoin=({miter:'miter',round:'round',bevel:'bevel'}[vs.lineJoinType])||'miter';
        if(Array.isArray(vs.lineDashSet)&&vs.lineDashSet.length){ // dash em múltiplos da espessura → px
          const dash=vs.lineDashSet.map(d=>Math.max(0,Math.round(((d&&d.value!=null)?d.value:d)*(out.strokeW||1))));
          if(dash.some(x=>x>0)) out.strokeDash=dash;
        }
      }
    }
  }catch(e){}
  return out;
}
// Raios por canto (node.vectorOrigination.keyOriginRRectRadii) → {tl,tr,br,bl} ou null.
// Valores vêm em px; clampamos a min(w,h)/2. Se todos forem 0, retorna null (usa raio uniforme).
function _dPsdCornerRadii(node, w, h){
  try{
    const vo=node.vectorOrigination; const list=vo&&vo.keyDescriptorList; if(!list||!list.length) return null;
    let rr=null; for(let i=0;i<list.length;i++){ if(list[i]&&list[i].keyOriginRRectRadii){ rr=list[i].keyOriginRRectRadii; break; } }
    if(!rr) return null;
    const m=Math.max(0,Math.min(w,h)/2);
    const v=u=>{ const n=(u&&u.value!=null)?u.value:u; return Math.min(m, Math.max(0, Math.round(+n||0))); };
    const out={ tl:v(rr.topLeft), tr:v(rr.topRight), br:v(rr.bottomRight), bl:v(rr.bottomLeft) };
    if(!(out.tl||out.tr||out.br||out.bl)) return null;
    return out;
  }catch(e){ return null; }
}
// Gradiente do PSD (vectorFill de GdFl, ou effects.gradientOverlay) → modelo Luma l.gradient.
function _dPsdGradient(node){
  try{
    let src=null;
    if(node.vectorFill && node.vectorFill.colorStops) src=node.vectorFill;            // camada de gradiente (GdFl)
    else { let go=node.effects&&node.effects.gradientOverlay; if(Array.isArray(go)) go=go[0];
      if(go && go.enabled!==false && go.gradient && go.gradient.colorStops){ src=go.gradient; src.angle=go.angle; src.style=go.type||src.style; } }
    if(!src||!src.colorStops||!src.colorStops.length) return null;
    const style=String(src.style||'linear').toLowerCase();
    const opAt=loc=>{ const os=src.opacityStops||[]; if(!os.length) return 1;
      let best=os[0]; os.forEach(s=>{ if(Math.abs((s.location||0)-loc)<Math.abs((best.location||0)-loc)) best=s; }); return best.opacity!=null?best.opacity:1; };
    const stops=src.colorStops.map(s=>({ color:_dPsdHex(s.color)||'#000000', pos:Math.max(0,Math.min(1,s.location||0)), opacity:opAt(s.location||0) }));
    return { type: style.includes('radial')?'radial':'linear', angle: (src.angle!=null?Math.round(src.angle):90), stops };
  }catch(e){ return null; }
}
// Rich text: styleRuns do PSD → l.runs[{text,color,fontSize,font,letterSpacing}]. Só quando há >1 estilo.
function _dPsdRichRuns(t, res, h){
  try{
    const runs=Array.isArray(t.styleRuns)?t.styleRuns:null; if(!runs||runs.length<2) return null;
    const full=String(t.text||'').replace(/\r\n?/g,'\n');
    const out=[]; let pos=0;
    for(const r of runs){
      const len=r.length||0; const seg=full.substr(pos,len); pos+=len; if(!seg) continue;
      const st=r.style||{};
      const fname=(st.font&&st.font.name)||'';
      const remap=_dPsdRemapFont(fname);
      out.push({
        text:seg,
        color:_dPsdHex(st.fillColor||st.color)||'#000000',
        fontSize:_dPsdFontSize({style:st,transform:t.transform}, h, seg, res),
        font: remap||(/black|900|heavy/i.test(fname)?"'Roboto Black'":/bold|700/i.test(fname)?"'Roboto',bold":"'Roboto'"),
        letterSpacing: st.tracking? Math.round((st.tracking/1000)*((st.fontSize||12))) : 0
      });
    }
    return out.length>1?out:null;
  }catch(e){ return null; }
}
// #1 — sugere variável pelo nome ({{x}}) ou heurística
function _dPsdSuggestVar(name, content){
  const raw=String(name||'');
  const m=raw.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/);
  if(m) return {name:m[1], auto:true};
  let clean=raw.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
  const map={preco:'precoPor',precopor:'precoPor',precode:'precoDe',preco_de:'precoDe',preco_por:'precoPor',valor:'precoPor'};
  if(map[clean]) return {name:map[clean], auto:false};
  const known=['produto','precoPor','precoDe','validade','detalhes','desconto','cupom','codigo'];
  const hit=known.find(k=>k.toLowerCase()===clean);
  if(hit) return {name:hit, auto:false};
  if(content && /r\$\s*\d/i.test(content)) return {name:'precoPor', auto:false};
  return {name:clean||'variavel', auto:false};
}

/* ── #4e — parse: Web Worker (offload) com fallback main-thread ── */
const _DPSD_WORKER_SRC = ""
  + "self.onmessage=function(e){try{"
  + "try{importScripts(e.data.lib);}catch(_){importScripts(e.data.cdn);}"
  + "var psd=self.agPsd.readPsd(e.data.buffer,{useImageData:true,skipLayerImaging:false});"
  + "var transfers=[];"
  + "function strip(n){var o={name:n.name,left:n.left,top:n.top,right:n.right,bottom:n.bottom,hidden:n.hidden,opacity:n.opacity,blendMode:n.blendMode,text:n.text,effects:n.effects,artboard:n.artboard,clipping:n.clipping,clippingLayer:n.clippingLayer||n.clipping,vectorMask:n.vectorMask,vectorStroke:n.vectorStroke,vectorOrigination:n.vectorOrigination,vectorFill:n.vectorFill};"
  + "if(n.imageData&&n.imageData.data){o._img={w:n.imageData.width,h:n.imageData.height,buf:n.imageData.data.buffer};transfers.push(n.imageData.data.buffer);}"
  + "if(n.mask&&n.mask.imageData&&n.mask.imageData.data){o._mask={w:n.mask.imageData.width,h:n.mask.imageData.height,buf:n.mask.imageData.data.buffer,left:n.mask.left,top:n.mask.top,defaultColor:n.mask.defaultColor,disabled:n.mask.disabled};transfers.push(n.mask.imageData.data.buffer);}"
  + "if(n.children)o.children=n.children.map(strip);return o;}"
  + "var res=(psd.imageResources&&psd.imageResources.resolutionInfo&&psd.imageResources.resolutionInfo.horizontalResolution)||72;"
  + "if(res&&res.value)res=res.value;"
  + "self.postMessage({ok:true,tree:{width:psd.width,height:psd.height,res:res,children:(psd.children||[]).map(strip)}},transfers);"
  + "}catch(err){self.postMessage({ok:false,error:String(err)});}};";

function _dPsdRebuildNode(node){
  const n={name:node.name,left:node.left,top:node.top,right:node.right,bottom:node.bottom,hidden:node.hidden,opacity:node.opacity,blendMode:node.blendMode,text:node.text,effects:node.effects,artboard:node.artboard,clipping:node.clipping,clippingLayer:node.clippingLayer||node.clipping,vectorMask:node.vectorMask,vectorStroke:node.vectorStroke,vectorOrigination:node.vectorOrigination,vectorFill:node.vectorFill};
  if(node._img && node._img.buf){
    try{
      const c=document.createElement('canvas'); c.width=node._img.w; c.height=node._img.h;
      const id=new ImageData(new Uint8ClampedArray(node._img.buf), node._img.w, node._img.h);
      c.getContext('2d').putImageData(id,0,0); n.canvas=c;
    }catch(e){}
  }
  if(node._mask && node._mask.buf){
    try{
      const mc=document.createElement('canvas'); mc.width=node._mask.w; mc.height=node._mask.h;
      const mid=new ImageData(new Uint8ClampedArray(node._mask.buf), node._mask.w, node._mask.h);
      mc.getContext('2d').putImageData(mid,0,0);
      n.mask={canvas:mc, left:node._mask.left, top:node._mask.top, defaultColor:node._mask.defaultColor, disabled:node._mask.disabled};
    }catch(e){}
  }
  if(node.children) n.children=node.children.map(_dPsdRebuildNode);
  return n;
}
function _dPsdResolution(psd){
  let r=(psd.imageResources&&psd.imageResources.resolutionInfo&&psd.imageResources.resolutionInfo.horizontalResolution)||psd.res||72;
  if(r&&r.value) r=r.value;
  return (+r)||72;
}
// resolve { psd } com canvases prontos; tenta worker, cai pro main thread
function _dPsdReadPsd(buffer, agPsd){
  return new Promise((resolve)=>{
    let done=false;
    const mainParse=()=>{ if(done)return; done=true;
      try{ const psd=agPsd.readPsd(buffer,{useImageData:false,skipLayerImaging:false}); resolve({psd:psd, res:_dPsdResolution(psd), worker:false}); }
      catch(e){ resolve({error:e}); } };
    let worker, to;
    try{
      const blob=new Blob([_DPSD_WORKER_SRC],{type:'application/javascript'});
      worker=new Worker(URL.createObjectURL(blob));
      to=setTimeout(()=>{ try{worker.terminate();}catch(e){} mainParse(); }, 25000);
      worker.onmessage=(ev)=>{ clearTimeout(to); try{worker.terminate();}catch(e){}
        if(done) return;
        if(ev.data&&ev.data.ok&&ev.data.tree){ done=true;
          const tree=ev.data.tree;
          resolve({psd:{width:tree.width,height:tree.height,children:(tree.children||[]).map(_dPsdRebuildNode)}, res:(+tree.res)||72, worker:true});
        } else mainParse();
      };
      worker.onerror=()=>{ clearTimeout(to); try{worker.terminate();}catch(e){} mainParse(); };
      const copy=buffer.slice(0); // transfere a CÓPIA; original fica pro fallback
      worker.postMessage({buffer:copy, lib:new URL('assets/vendor/ag-psd.js',location.href).href, cdn:'https://cdn.jsdelivr.net/npm/ag-psd/dist/bundle.js'}, [copy]);
    }catch(e){ if(to)clearTimeout(to); mainParse(); }
  });
}

/* ── detecção de formato pela proporção da prancheta (story/feed/wide) ── */
function dPsdDetectFmt(w, h){
  const ratio = w / h;
  if (ratio < 0.7) return 'story'; // retrato — 9:16
  if (ratio > 1.4) return 'wide';  // paisagem — 1.9:1
  return 'feed';                    // quadrado — 1:1
}

// Tenta mapear um nome de fonte do PSD para uma fonte já enviada (dCustomFonts).
// Normaliza ambos (lowercase, só alfanum) e aceita correspondência exata ou por prefixo.
// Retorna 'custom:Family' (formato do seletor de fonte) ou null se não encontrar.
function _dPsdRemapFont(fontName){
  if(!fontName||typeof dCustomFonts==='undefined'||!dCustomFonts.length) return null;
  const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const t=norm(fontName); if(!t) return null;
  const exact=dCustomFonts.find(f=>norm(f.name)===t||norm(f.family)===t);
  if(exact) return 'custom:'+exact.family;
  // correspondência por prefixo (ex: "MontserratBold" bate "Montserrat")
  const partial=dCustomFonts.find(f=>{ const fn=norm(f.name),ff=norm(f.family);
    return t.startsWith(fn)||fn.startsWith(t)||t.startsWith(ff)||ff.startsWith(t); });
  return partial?'custom:'+partial.family:null;
}

// Extrai o estilo DOMINANTE de um nó de texto considerando todos os styleRuns.
// Run dominante = maior comprimento de texto. isMultiStyle=true quando há cores ou
// tamanhos distintos entre runs (indica ao usuário que o layer era estilo misto).
function _dPsdDominantStyle(t){
  if(!t) return {style:{}, isMultiStyle:false};
  const runs=Array.isArray(t.styleRuns)&&t.styleRuns.length?t.styleRuns:null;
  if(!runs) return {style:_dPsdTextStyle(t), isMultiStyle:false};
  const dominant=runs.reduce((best,r)=>(r.length||0)>(best.length||0)?r:best, runs[0]);
  const colors=new Set(runs.map(r=>{const c=r.style&&(r.style.fillColor||r.style.color);
    return c?Math.round(c.r||0)+','+Math.round(c.g||0)+','+Math.round(c.b||0):null;}));
  const sizes=new Set(runs.map(r=>Math.round((r.style&&(r.style.fontSize||r.style.size))||0)));
  return {style:dominant.style||{}, isMultiStyle:colors.size>1||sizes.size>1};
}
// Detecta o tipo de shape a partir do canvas rasterizado.
// Se os cantos forem transparentes e o centro opaco → é circular/elíptico.
function _dPsdDetectShapeKind(canvas){
  try{
    const w=canvas.width, h=canvas.height; if(w<8||h<8) return {kind:'rect',radius:0};
    const ctx=canvas.getContext('2d');
    if(ctx.getImageData(Math.floor(w/2),Math.floor(h/2),1,1).data[3]<200) return {kind:'rect',radius:0};
    const data=ctx.getImageData(0,0,w,h).data;
    let d=0;
    const limit=Math.min(w,h);
    for(let i=0;i<limit;i++){
      if(data[(i*w+i)*4+3]>=128){
        d=i;
        break;
      }
    }
    const ratio=w/h;
    if(d>=limit*0.12){
      const kind=(ratio>0.85&&ratio<1.18)?'circle':'ellipse';
      return {kind,radius:0};
    }else{
      return {kind:'rect',radius:Math.round(d*3.4)};
    }
  }catch(e){ return {kind:'rect',radius:0}; }
}

/* ── PSD → itens intermediários (modo escolhível na revisão) ── */
let dPsdItems=[]; let dPsdMeta=null;
// Callback opcional da revisão (fluxo multi-prancheta). Quando setado, dPsdConfirmImport
// encaminha as layers pra ele em vez de criar uma prancheta solta no editor.
let _dPsdReviewOnConfirm=null;
// ox/oy: offset de origem (usado em artboards p/ normalizar coords pra (0,0) da prancheta).
function dPsdParseItems(psd, res, ox, oy){
  ox=ox||0; oy=oy||0;
  const items=[]; let n=0; let prevLeaf=null;
  // parentOp: opacidade acumulada dos grupos-pai (0–1); parentHidden: grupo-pai oculto.
  (function walk(nodes, parentOp, parentHidden){
    (nodes||[]).forEach(node=>{
      const nodeOp=node.opacity!=null?node.opacity:1;
      const accOp=parentOp*nodeOp;
      const accHidden=parentHidden||(node.hidden?true:false);
      if(node.children && node.children.length){ walk(node.children, accOp, accHidden); return; }
      const x=Math.round((node.left||0)-ox), y=Math.round((node.top||0)-oy);
      const w=Math.max(1,Math.round((node.right||0)-(node.left||0)));
      const h=Math.max(1,Math.round((node.bottom||0)-(node.top||0)));
      const bm=node.blendMode;
      const it={ n:++n, name:(node.name||('Camada '+n)).toString().slice(0,48),
        x,y,w,h, visible:!accHidden, opacity:Math.round(accOp*100),
        include:!accHidden, mask:_dPsdComputeMask(node, prevLeaf),
        clippingLayer: node.clippingLayer || node.clipping,
        blendMode:(bm&&bm!=='normal'&&bm!=='passThrough')?bm:undefined }; // máscara + clipping
      prevLeaf=node; // base p/ a próxima camada com clipping
      // Recorte vetorial (vectorMask) — ex.: fundo com mordida/onda. Só quando NÃO há máscara
      // raster/clipping (preserva _dPsdComputeMask intacto). l.fill segue com a cor original.
      if(!it.mask && node.vectorMask && !node.vectorMask.disable){
        const vmURL=_dPsdVectorMaskURL(node);
        if(vmURL) it.mask=vmURL;
        else { it.vectorMaskFailed=true; console.warn('[psd] vectorMask não rasterizável, importando shape simplificado:', it.name); }
      }
      if(node.text && node.text.text!=null && String(node.text.text).trim()!==''){
        const t=node.text, sv=_dPsdSuggestVar(node.name, t.text);
        const {style:st, isMultiStyle}=_dPsdDominantStyle(t);
        it.kind='text';
        it.content=String(t.text).replace(/\r\n?/g,'\n');
        it.multiStyle=isMultiStyle;
        it.fontName=(st.font&&st.font.name)||'';
        const _fRemap=_dPsdRemapFont(it.fontName);
        it.font=_fRemap||(/black|900|heavy/i.test(it.fontName)?"'Roboto Black'":/bold|700/i.test(it.fontName)?"'Roboto',bold":"'Roboto'");
        it.fontRemapped=!!_fRemap;
        it.fontSize=_dPsdFontSize(t,h,it.content,res);
        it.color=_dPsdHex(st.fillColor||st.color)||'#000000';
        it.strikethrough=st.strikethrough===true; // tachado (DE: R$..) — render já suportado
        it.textAlign=_dPsdAlign(t);
        if(st.tracking) it.letterSpacing=Math.round((st.tracking/1000)*(st.fontSize||it.fontSize||12)); // tracking → px
        if(st.leading)  it.lineHeight=+(st.leading/(st.fontSize||it.fontSize||12)).toFixed(3);          // leading → multiplicador
        const _runs=_dPsdRichRuns(t,res,h); if(_runs) it.runs=_runs;   // texto multi-estilo
        const _tg=_dPsdGradient(node); if(_tg) it.gradient=_tg;        // preenchimento por gradiente no texto
        Object.assign(it,_dPsdEffects(node));
        it.varName=sv.name;
        it.mode=sv.auto?'var':'text';
        // Tipo de caixa. Campo real desta versão do ag-psd: text.shapeType ('box'|'point').
        // Ausente → POINT (retrocompatível: mantém bbox de glifos atual). Só PARAGRAPH altera x/y/w/h.
        it.textBox=(t.shapeType==='box')?'box':'point';
        if(it.textBox==='box'){
          const pb=_dPsdParagraphBox(node); // caixa do designer (já validada contra o bbox de glifos)
          if(pb){ it.x=Math.round(pb.x-ox); it.y=Math.round(pb.y-oy); it.w=Math.max(1,pb.w); it.h=Math.max(1,pb.h); }
          else { it.textBoxApprox=true; console.warn('[psd] caixa de parágrafo não derivável — usando bbox de glifos:', it.name); }
        }
        if(node.canvas && node.canvas.width>0){ it.imgUrl=_dPsdRasterURL(node.canvas); } // p/ "imagem fiel"
      } else if(node.canvas && node.canvas.width>0 && node.canvas.height>0){
        // Camada de GRADIENTE (GdFl: tem vectorFill com colorStops) → shape com gradiente editável,
        // mesmo não sendo cor sólida (senão cairia em raster).
        const grad=(node.vectorFill && node.vectorFill.colorStops)?_dPsdGradient(node):null;
        const solid=_dPsdSolidColor(node.canvas);
        if(grad || solid){
          const shapeInfo=_dPsdDetectShapeKind(node.canvas);
          it.kind='shape';
          it.fill=solid || (grad && grad.stops[0] && grad.stops[0].color) || '#FF9000';
          if(grad) it.gradient=grad;
          it.mode='shape';
          it.shapeKind=shapeInfo.kind;
          it.radius=shapeInfo.radius;
          Object.assign(it,_dPsdEffects(node));        // sombra/glow/overlay/contorno-fx
          Object.assign(it,_dPsdShapeStroke(node));    // traçado do shape (vectorStroke) — prevalece
          const _rr=_dPsdCornerRadii(node,w,h); if(_rr) it.radii=_rr; // cantos por canto
        }
        else { it.kind='raster'; it.mode='raster'; it.imgUrl=_dPsdRasterURL(node.canvas); if(!it.imgUrl) return; }
      } else { return; }
      items.push(it);
    });
  })(psd.children, 1, false);
  // Dedupe defensivo (NÃO altera grupos): 1 layer no Photoshop deve virar 1 item.
  // Assinatura exata (tipo+nome+caixa+conteúdo) repetida → duplicata de parsing: descarta + avisa.
  const _seen=new Set(); const out=[];
  items.forEach(it=>{
    const sig=it.kind+'|'+it.name+'|'+it.x+'|'+it.y+'|'+it.w+'|'+it.h+'|'+(it.content||'');
    if(_seen.has(sig)){ console.warn('[psd] layer duplicada descartada (assinatura idêntica):', it.name); return; }
    _seen.add(sig); out.push(it);
  });
  // Aviso (NÃO remove): textos com mesmo nome+conteúdo em caixas diferentes — pode ser sombra/contorno
  // manual do designer (2 layers reais) ou duplicação inesperada. Mantém ambas para decisão na revisão.
  const _soft={};
  out.forEach(it=>{ if(it.kind==='text'&&it.content){ const k=it.name+'|'+it.content; _soft[k]=(_soft[k]||0)+1; } });
  Object.keys(_soft).forEach(k=>{ if(_soft[k]>1) console.warn('[psd] possível layer de texto duplicada mantida (nome+conteúdo iguais, caixas diferentes):', k.split('|')[0]); });

  // Detecção de clipping mask e rasterização de shapes-base (MVP)
  for(let i=0; i<out.length; i++) {
    if(out[i].clippingLayer) {
      let baseIdx = i + 1;
      while(baseIdx < out.length && out[baseIdx].clippingLayer) baseIdx++; // Pula múltiplas camadas
      if(baseIdx < out.length) {
        const base = out[baseIdx];
        const b = out[i];
        if(!b.mask) { // Se o Luma não gerou máscara via layerMaskCanvas
          const c = document.createElement('canvas');
          c.width = Math.max(1, b.w); c.height = Math.max(1, b.h);
          const ctx = c.getContext('2d');
          ctx.fillStyle = base.fill || '#000000';
          const ox = base.x - b.x, oy = base.y - b.y;
          let success = false;
          if (base.kind === 'shape' && (base.shapeKind === 'ellipse' || base.shapeKind === 'circle')) {
            ctx.beginPath();
            ctx.ellipse(ox + base.w/2, oy + base.h/2, base.w/2, base.h/2, 0, 0, 2*Math.PI);
            ctx.fill();
            success = true;
          } else if (base.kind === 'shape') {
            ctx.fillRect(ox, oy, base.w, base.h);
            success = true;
          }
          if(success) {
            try { b.mask = c.toDataURL('image/png'); base.isMaskBase = true; } 
            catch(e) { b.maskFallback = true; }
          } else {
            b.maskFallback = true;
          }
        } else {
          base.isMaskBase = true; // Mesmo se já tem mask nativa de canvas (cm/lm), ocultamos o base
        }
      }
    }
  }

  return out;
}

// Copia efeitos do item intermediário → layer (sombra/inner/glow/overlay/contorno+align).
// Só grava o que existe, p/ não inflar o layer nem mudar camadas sem efeito.
function _dPsdApplyFx(L, it){
  if(it.shadow){ L.shadow=true; L.shadowColor=it.shadowColor;
    if(it.shadowBlur!=null) L.shadowBlur=it.shadowBlur; if(it.shadowDist!=null) L.shadowDist=it.shadowDist; if(it.shadowAngle!=null) L.shadowAngle=it.shadowAngle; }
  if(it.innerShadow){ L.innerShadow=true; L.innerShadowColor=it.innerShadowColor;
    if(it.innerShadowBlur!=null) L.innerShadowBlur=it.innerShadowBlur; if(it.innerShadowDist!=null) L.innerShadowDist=it.innerShadowDist; if(it.innerShadowAngle!=null) L.innerShadowAngle=it.innerShadowAngle; }
  if(it.glow){ L.glow=true; L.glowColor=it.glowColor; if(it.glowSize!=null) L.glowSize=it.glowSize; }
  if(it.overlay){ L.overlay=true; L.overlayColor=it.overlayColor; if(it.overlayOpacity!=null) L.overlayOpacity=it.overlayOpacity; }
  if(it.innerGlow){ L.innerGlow=true; L.innerGlowColor=it.innerGlowColor; if(it.innerGlowSize!=null) L.innerGlowSize=it.innerGlowSize; }
  if(it.bevel){ L.bevel=true; L.bevelSize=it.bevelSize; L.bevelHighlight=it.bevelHighlight; L.bevelShadow=it.bevelShadow; if(it.bevelAngle!=null) L.bevelAngle=it.bevelAngle; }
  if(it.gradientOverlay){ L.gradientOverlay=it.gradientOverlay; }
  if(it.strokeW){ L.strokeW=it.strokeW; L.strokeColor=it.strokeColor||'#000000'; if(it.strokeAlign) L.strokeAlign=it.strokeAlign;
    if(it.strokeDash) L.strokeDash=it.strokeDash; if(it.strokeCap) L.strokeCap=it.strokeCap; if(it.strokeJoin) L.strokeJoin=it.strokeJoin; }
  return L;
}
function dItemToLayer(it){
  const base={ id:'l-psd-'+it.n+'-'+(it.x+it.y), name:it.name, x:it.x,y:it.y,w:it.w,h:it.h, visible:it.visible, opacity:it.opacity };
  if(it.mask) base.mask=it.mask;
  if(it.blendMode) base.blendMode=it.blendMode;
  if(it.kind==='text'){
    if(it.mode==='raster' && it.imgUrl) return _dPsdApplyFx(Object.assign(base,{type:'image',imgUrl:it.imgUrl,imgVar:'',objectFit:'cover',frameShape:'rect'}), it);
    const isVar=it.mode==='var';
    const L=Object.assign(base,{ type:'text',
      content: isVar ? '{{'+(it.varName||'variavel')+'}}' : it.content,
      font:it.font, fontSize:it.fontSize, color:it.color, textAlign:it.textAlign, isVar:isVar });
    _dPsdApplyFx(L, it);
    if(it.strikethrough){ L.strikethrough=true; }
    if(it.textBox==='box'){ L.textBox='box'; } // paragraph → editor encaixa na caixa
    if(it.letterSpacing) L.letterSpacing=it.letterSpacing;
    if(it.lineHeight) L.lineHeight=it.lineHeight;
    if(it.runs && !isVar) L.runs=it.runs;       // texto multi-estilo (não p/ variável)
    if(it.gradient) L.gradient=it.gradient;     // preenchimento por gradiente no texto
    return L;
  }
  if(it.kind==='shape' && it.mode==='shape'){
    const S=Object.assign(base,{type:'shape',fill:it.fill||'#FF9000',radius:it.radius||0,shapeKind:it.shapeKind||'rect'});
    if(it.radii) S.radii=it.radii;                                  // cantos por canto
    if(it.gradient) S.gradient=it.gradient;                         // gradiente
    _dPsdApplyFx(S, it);                                            // traçado(+align)/sombra/glow/overlay
    return S;
  }
  return _dPsdApplyFx(Object.assign(base,{type:'image',imgUrl:it.imgUrl,imgVar:'',objectFit:'cover',frameShape:'rect'}), it);
}

/* ── Memória de mapeamento (Fase D) ──
   Persiste {layerName → {mode, varName}} em localStorage para reusar entre sessões.
   Limite de 500 entradas (nomes de camada) para não estourar a quota.           ── */
const _PSD_MEM_KEY='yngs_psd_mem_v1';
function _dPsdMemLoad(){ try{ return JSON.parse(localStorage.getItem(_PSD_MEM_KEY)||'{}'); }catch(e){ return {}; } }
function _dPsdMemApply(items){
  const mem=_dPsdMemLoad(); if(!Object.keys(mem).length) return;
  items.forEach(it=>{
    const key=it.name.toLowerCase().trim().slice(0,48);
    const s=mem[key]; if(!s) return;
    const validText=['text','var','raster'], validShape=['shape','raster'];
    if(s.mode&&((it.kind==='text'&&validText.includes(s.mode))||(it.kind==='shape'&&validShape.includes(s.mode)))) it.mode=s.mode;
    if(s.varName&&it.kind==='text') it.varName=s.varName;
  });
}
function _dPsdMemSave(items){
  const mem=_dPsdMemLoad();
  items.forEach(it=>{ const key=it.name.toLowerCase().trim().slice(0,48); mem[key]={mode:it.mode}; if(it.kind==='text'&&it.varName) mem[key].varName=it.varName; });
  const keys=Object.keys(mem); if(keys.length>500) keys.slice(0,keys.length-500).forEach(k=>delete mem[k]);
  try{ localStorage.setItem(_PSD_MEM_KEY,JSON.stringify(mem)); }catch(e){}
}

// Heurística de z-order: retorna true se a lista de itens precisar ser invertida.
// ag-psd devolve filhos topo-primeiro (como o painel do Photoshop), mas dLayers[0] é
// o fundo visual em Luma. Logo: se o ÚLTIMO item da lista parece um fundo (nome ou área),
// o array veio topo-primeiro e precisa ser invertido. Se o PRIMEIRO item parece fundo,
// veio em ordem inversa e está correto.
function _dPsdShouldInvert(items, w, h){
  if(!items||items.length<2) return false;
  const first=items[0], last=items[items.length-1];
  const bgRe=/^(background|fundo|bg|base|backdrop|plano[\s\-]*de[\s\-]*fundo)$/i;
  const canvasArea=Math.max(1,w*h);
  const firstCov=(first.w*first.h)/canvasArea;
  const lastCov=(last.w*last.h)/canvasArea;
  const bgKinds=new Set(['shape','raster']);
  const firstIsBg=bgRe.test((first.name||'').trim())||(firstCov>=0.7&&bgKinds.has(first.kind));
  const lastIsBg =bgRe.test((last.name||'').trim()) ||(lastCov >=0.7&&bgKinds.has(last.kind));
  if(lastIsBg &&!firstIsBg) return true;  // fundo no final → topo-primeiro → precisa inverter
  if(firstIsBg&&!lastIsBg)  return false; // fundo no início → já está na ordem certa
  return false; // sem sinal claro → mantém padrão (sem inversão)
}

/* ── tela de revisão ── */
function dPsdOpenReview(){
  const modal=document.getElementById('d-psd-modal'); if(!modal) return;
  const _nT=dPsdItems.filter(i=>i.kind==='text').length;
  const _nS=dPsdItems.filter(i=>i.kind==='shape').length;
  const _nI=dPsdItems.filter(i=>i.kind==='raster').length;
  const _dpiLabel=(dPsdMeta.res&&dPsdMeta.res!==72)?' · '+Math.round(dPsdMeta.res)+'dpi':'';
  document.getElementById('d-psd-meta').textContent=(dPsdMeta.name||'PSD')+' · '+dPsdMeta.w+'×'+dPsdMeta.h+_dpiLabel+' · '+_nT+'T '+_nS+'S '+_nI+'I'+(dPsdMeta.worker?' · worker':'');
  const fmt=Object.keys(DFMT_SIZES).find(k=>DFMT_SIZES[k].w===dPsdMeta.w&&DFMT_SIZES[k].h===dPsdMeta.h)||'orig';
  const sel=document.getElementById('d-psd-fmt'); if(sel) sel.value=fmt;
  const inv=document.getElementById('d-psd-invert');
  if(inv) inv.checked=_dPsdShouldInvert(dPsdItems, dPsdMeta.w, dPsdMeta.h);
  // Campo de busca (injetado dinamicamente, acima de #d-psd-rows)
  const rowsEl=document.getElementById('d-psd-rows');
  if(rowsEl&&!document.getElementById('d-psd-search')){
    const si=document.createElement('input'); si.id='d-psd-search'; si.type='search';
    si.placeholder='Filtrar camadas…'; si.className='psd-search-input';
    si.oninput=()=>dPsdRenderRows(si.value.trim().toLowerCase());
    rowsEl.parentNode.insertBefore(si,rowsEl);
  }
  const sf=document.getElementById('d-psd-search'); if(sf) sf.value='';
  // Aplica memória de mapeamentos anteriores
  _dPsdMemApply(dPsdItems);
  dPsdRenderRows();
  modal.classList.add('open');
}
// Converte blend mode do ag-psd (camelCase) → CSS (kebab-case); 'normal'→'' (sem propriedade)
function _dPsdBlendModeCSS(bm){ return bm?bm.replace(/([A-Z])/g,c=>'-'+c.toLowerCase()):''; }
function dPsdRenderRows(filter){
  const wrap=document.getElementById('d-psd-rows'); if(!wrap) return;
  const ico={text:'T',shape:'■',raster:'▣'};
  const kindOrder={text:0,shape:1,raster:2};
  const kindLabel={text:'Textos',shape:'Formas',raster:'Imagens'};
  // Indexar, filtrar por busca (nome, conteúdo, fontName, tipo em PT-BR) e agrupar por tipo
  const indexed=dPsdItems.map((it,i)=>({it,i})).filter(({it})=>!it.isMaskBase);
  const visible=filter?indexed.filter(({it})=>{
    return it.name.toLowerCase().includes(filter)||
      (it.content&&it.content.toLowerCase().includes(filter))||
      (it.fontName&&it.fontName.toLowerCase().includes(filter))||
      (it.kind==='shape'&&'forma'.includes(filter))||
      (it.kind==='raster'&&'imagem'.includes(filter))||
      (it.kind==='text'&&'texto'.includes(filter));
  }):indexed;
  const grouped=[...visible].sort((a,b)=>(kindOrder[a.it.kind]||0)-(kindOrder[b.it.kind]||0));
  const count={}; visible.forEach(({it})=>{ count[it.kind]=(count[it.kind]||0)+1; });
  let lastKind=null;
  wrap.innerHTML=grouped.map(({it,i})=>{
    let header='';
    if(it.kind!==lastKind){ lastKind=it.kind;
      header=`<div class="psd-group-header">${kindLabel[it.kind]||'Outros'} <span class="psd-group-count">${count[it.kind]||0}</span></div>`; }
    let modeSel='';
    if(it.kind==='text'){
      modeSel=`<select class="psd-mode" onchange="dPsdSetMode(${i},this.value)">
        <option value="text" ${it.mode==='text'?'selected':''}>Texto editável</option>
        <option value="var" ${it.mode==='var'?'selected':''}>Variável {{ }}</option>
        <option value="raster" ${it.mode==='raster'?'selected':''}>Imagem fiel</option></select>`;
    } else if(it.kind==='shape'){
      modeSel=`<select class="psd-mode" onchange="dPsdSetMode(${i},this.value)">
        <option value="shape" ${it.mode==='shape'?'selected':''}>Cor (editável)</option>
        <option value="raster" ${it.mode==='raster'?'selected':''}>Imagem</option></select>`;
    } else { modeSel=`<span class="psd-mode-fixed">Imagem</span>`; }
    const swatchRadius=it.shapeKind==='circle'||it.shapeKind==='ellipse'?'50%':'3px';
    const swatch=it.kind==='shape'?`<span class="psd-swatch" style="background:${it.fill};border-radius:${swatchRadius}"></span>`:'';
    const varIn=`<input class="psd-var-input" value="${it.varName||''}" placeholder="nome_da_var" oninput="dPsdSetVar(${i},this.value)" style="display:${it.kind==='text'&&it.mode==='var'?'inline-block':'none'}">`;
    const multiStyleBadge=(it.kind==='text'&&it.multiStyle)?`<span class="psd-multistyle" title="Texto com múltiplos estilos — importando estilo dominante">↕ misto</span>`:'';
    const blendBadge=it.blendMode?`<span class="psd-blend" title="Blend mode: ${_dPsdEsc(it.blendMode)}">⊕ ${_dPsdEsc(_dPsdBlendModeCSS(it.blendMode))}</span>`:'';
    let fontWarn='';
    if(it.kind==='text'&&it.fontName&&!/roboto/i.test(it.fontName)){
      const fn=_dPsdEsc(it.fontName);
      if(it.fontRemapped) fontWarn=`<span class="psd-fontok" title="Fonte '${fn}' mapeada para fonte enviada">✓ ${fn}</span>`;
      else fontWarn=`<span class="psd-fontwarn">⚠ ${fn} <label class="psd-font-upload-btn" title="Enviar '${fn}' agora">↑ enviar<input type="file" accept=".ttf,.otf,.woff,.woff2" style="display:none" onchange="dPsdUploadFont(${i},this)"></label></span>`;
    }
    const opacityBadge=it.opacity<95?`<span class="psd-opacity-badge">α ${it.opacity}%</span>`:'';
    const vecWarn=it.vectorMaskFailed?`<span class="psd-fontwarn" title="Recorte vetorial não pôde ser rasterizado — shape importado sem máscara">⚠ Shape vetorial simplificado</span>`:'';
    const clipWarn=it.maskFallback?`<span class="psd-fontwarn" title="Forma complexa de base não pôde ser rasterizada">⚠ Clipping mask não preservada</span>`:'';
    const textInfoBadge=it.kind==='text'?`<span class="psd-textinfo">${it.fontSize}px · ${it.textAlign}</span>`:'';
    const thumb=it.kind==='raster'&&it.imgUrl?`<img class="psd-thumb" src="${it.imgUrl}" alt="" loading="lazy">`:'';
    const textPrev=it.kind==='text'&&it.content
      ?`<span class="psd-text-prev" style="color:${it.color||'#aaa'}">${_dPsdEsc(it.content.replace(/\n/g,' ').slice(0,60))}</span>`:'';
    return header+`<div class="psd-row ${it.include?'':'psd-row-off'}" onmouseenter="typeof dPsdHoverLayer==='function'&&dPsdHoverLayer(${i})" onmouseleave="typeof dPsdHoverLayer==='function'&&dPsdHoverLayer(-1)">
      <input type="checkbox" ${it.include?'checked':''} onchange="dPsdSetInclude(${i},this.checked)">
      <span class="psd-row-ico">${swatch||ico[it.kind]||'▣'}</span>
      ${thumb}
      <span class="psd-row-name" title="${_dPsdEsc(it.name)}">
        <span class="psd-row-name-top">${_dPsdEsc(it.name)}${multiStyleBadge}${blendBadge}${fontWarn}${opacityBadge}${vecWarn}${clipWarn}${textInfoBadge}</span>
        ${textPrev}
      </span>
      ${modeSel}${varIn}</div>`;
  }).join('');
  dPsdUpdateCount();
  if(typeof dPsdRenderPreview === 'function') dPsdRenderPreview();
}
function dPsdSetMode(i,v){ if(dPsdItems[i]){ dPsdItems[i].mode=v; dPsdRenderRows(document.getElementById('d-psd-search')&&document.getElementById('d-psd-search').value.trim().toLowerCase()||''); } }
function dPsdSetVar(i,v){ if(dPsdItems[i]) dPsdItems[i].varName=v.trim().replace(/[^a-zA-Z0-9_]/g,''); }
function dPsdSetInclude(i,on){ if(dPsdItems[i]){ dPsdItems[i].include=on; const f=document.getElementById('d-psd-search'); dPsdRenderRows(f&&f.value.trim().toLowerCase()||''); } }
// Upload de fonte direto da tela de revisão: registra no sistema de fontes e remapeia
// automaticamente todas as camadas do PSD que usam o mesmo fontName.
function dPsdUploadFont(layerIdx, input){
  const file=input.files&&input.files[0]; input.value='';
  if(!file) return;
  if(!/\.(ttf|otf|woff2?|woff)$/i.test(file.name)){ gToast('⚠ Use .ttf, .otf, .woff ou .woff2','error'); return; }
  if(file.size>3*1024*1024){ gToast('⚠ Fonte muito grande (máx 3MB). Prefira .woff2.','error'); return; }
  const r=new FileReader();
  r.onload=e=>{
    const base=file.name.replace(/\.[^.]+$/,'');
    const family=(typeof dFontUniqueFamily==='function')?dFontUniqueFamily(base):base;
    const f={name:base,family,dataUrl:e.target.result,weight:400};
    if(typeof dCustomFonts!=='undefined') dCustomFonts.push(f);
    if(typeof dFontRegister==='function') dFontRegister(f);
    if(typeof dFontsPersist==='function') dFontsPersist();
    if(typeof dFontsRenderList==='function') dFontsRenderList();
    if(typeof dPopFontSelects==='function') dPopFontSelects();
    const mapped='custom:'+family;
    const fname=(dPsdItems[layerIdx]||{}).fontName||'';
    dPsdItems.forEach(it=>{ if(it.kind==='text'&&it.fontName===fname){ it.font=mapped; it.fontRemapped=true; } });
    dPsdRenderRows();
    gToast('✓ Fonte "'+base+'" enviada e aplicada às camadas');
  };
  r.readAsDataURL(file);
}
function dPsdUpdateCount(){ const c=document.getElementById('d-psd-count'); if(c) c.textContent='('+dPsdItems.filter(it=>it.include).length+')'; }
function dPsdCancel(){
  const m=document.getElementById('d-psd-modal'); if(m)m.classList.remove('open');
  const wasSeq=!!_dPsdReviewOnConfirm; // cancelar no meio da sequência aborta tudo
  dPsdItems=[]; dPsdMeta=null; _dPsdReviewOnConfirm=null;
  const cv=document.getElementById('d-psd-preview-canvas'); if(cv){ cv.width=0; cv.height=0; cv._renderId=(cv._renderId||0)+1; }
  const ov=document.getElementById('d-psd-preview-overlay'); if(ov){ ov.width=0; ov.height=0; }
  if(wasSeq) gToast('Importação de pranchetas cancelada');
}
function dPsdConfirmImport(){
  const chosen=dPsdItems.filter(it=>it.include && !it.isMaskBase);
  if(!chosen.length){ gToast('Selecione ao menos uma camada','error'); return; }
  _dPsdMemSave(dPsdItems); // persiste mapeamentos para próximas importações
  let layers=chosen.map(dItemToLayer).filter(Boolean);
  // #4a — inverter z-order se a ordem do PSD vier trocada
  const inv=document.getElementById('d-psd-invert'); if(inv&&inv.checked) layers=layers.reverse();
  if(typeof dSyncVarsFromContent==='function') layers.forEach(l=>{ if(l.type==='text'&&l.isVar) dSyncVarsFromContent(l.content); });
  const fmtChoice=(document.getElementById('d-psd-fmt')||{}).value||'orig';
  document.getElementById('d-psd-modal').classList.remove('open');
  const cv=document.getElementById('d-psd-preview-canvas'); if(cv){ cv.width=0; cv.height=0; cv._renderId=(cv._renderId||0)+1; }
  const ov=document.getElementById('d-psd-preview-overlay'); if(ov){ ov.width=0; ov.height=0; }
  // Fluxo multi-prancheta: encaminha as layers pro callback (cria template) e não cria prancheta.
  if(_dPsdReviewOnConfirm){
    const cb=_dPsdReviewOnConfirm; _dPsdReviewOnConfirm=null;
    const w=dPsdMeta.w, h=dPsdMeta.h;
    dPsdItems=[]; dPsdMeta=null;
    cb(layers, fmtChoice, w, h);
    return;
  }
  dImportLayersAsArtboard(dPsdMeta.w, dPsdMeta.h, layers, dPsdMeta.name, fmtChoice, dPsdMeta.res||72);
  const nVar=layers.filter(l=>l.isVar).length, nTxt=layers.filter(l=>l.type==='text').length;
  gToast('✓ PSD importado: '+layers.length+' camadas · '+nTxt+' texto · '+nVar+' variável(is)');
  dPsdItems=[]; dPsdMeta=null;
}

/* ── cria a prancheta (com reflow opcional pro formato — 5.2) ── */
function dImportLayersAsArtboard(w,h,layers,name,fmtChoice,dpi){
  if(typeof dSyncLayersToAB==='function') dSyncLayersToAB();
  let outW=w, outH=h, fmt=Object.keys(DFMT_SIZES).find(k=>DFMT_SIZES[k].w===w&&DFMT_SIZES[k].h===h)||'story';
  let clone=JSON.parse(JSON.stringify(layers));
  if(typeof gEnsureAnchors==='function') gEnsureAnchors(clone,w,h);
  if(fmtChoice && fmtChoice!=='orig' && DFMT_SIZES[fmtChoice] && (DFMT_SIZES[fmtChoice].w!==w||DFMT_SIZES[fmtChoice].h!==h)){
    const to=DFMT_SIZES[fmtChoice];
    if(typeof gReflowLayers==='function') clone=gReflowLayers(clone,{w,h},to,{fmtKey:gFmtKey(fmtChoice)});
    outW=to.w; outH=to.h; fmt=fmtChoice;
  }
  const id='ab-'+Date.now();
  const nAb=dArtboards.length, last=dArtboards[nAb-1];
  const x=last?last.x+last.w+140:80, y=last?last.y:60;
  const ab={id,name:(name||'PSD').slice(0,30),x,y,w:outW,h:outH,fmt,dpi:dpi||72,layers:JSON.parse(JSON.stringify(clone))};
  dArtboards.push(ab); dActiveABId=id;
  dLayers=JSON.parse(JSON.stringify(clone)); dFmt=fmt; dSelId=null;
  if(typeof dMultiSel!=='undefined') dMultiSel=[];
  if(typeof dHistoryReset==='function') dHistoryReset();
  if(typeof dRenderWorkspace==='function') dRenderWorkspace();
  dApplyFormat(); dRenderCanvas(); dRenderLayersList();
  if(typeof dRenderABList==='function') dRenderABList();
  if(typeof dStats==='function') dStats();
  if(typeof dMarkUnsaved==='function') dMarkUnsaved();
  setTimeout(()=>{ if(typeof dFitToScreen==='function') dFitToScreen(); },80);
}

/* ── Renderização do Preview no Modal (PARTE A) ── */
async function dPsdRenderPreview(){
  const canvas=document.getElementById('d-psd-preview-canvas');
  if(!canvas || !dPsdMeta) return;

  // Gerenciamento de sobreposição de renders async
  const renderId=++canvas._renderId || (canvas._renderId=1);

  canvas.width=dPsdMeta.w;
  canvas.height=dPsdMeta.h;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);

  const inv=document.getElementById('d-psd-invert');
  const shouldInvert=inv && inv.checked;
  
  let itemsToRender=dPsdItems.filter(it=>it.include);
  if(shouldInvert) itemsToRender=itemsToRender.slice().reverse();

  for(const it of itemsToRender){
    if(canvas._renderId!==renderId) return; // abortado por render mais recente

    ctx.save();
    ctx.globalAlpha=(it.opacity!=null?it.opacity:100)/100;
    
    if(it.imgUrl){
      await new Promise(resolve=>{
        const img=new Image();
        img.onload=()=>{ ctx.drawImage(img, it.x, it.y, it.w, it.h); resolve(); };
        img.onerror=resolve;
        img.src=it.imgUrl;
      });
    } else if(it.kind==='shape' && it.fill){
      ctx.fillStyle=it.fill;
      if(it.shapeKind==='circle' || it.shapeKind==='ellipse'){
        ctx.beginPath();
        ctx.ellipse(it.x+it.w/2, it.y+it.h/2, it.w/2, it.h/2, 0, 0, Math.PI*2);
        ctx.fill();
      } else {
        if(it.radius && ctx.roundRect){
          ctx.beginPath();
          ctx.roundRect(it.x, it.y, it.w, it.h, it.radius);
          ctx.fill();
        } else {
          ctx.fillRect(it.x, it.y, it.w, it.h);
        }
      }
    } else if(it.kind==='text'){
      ctx.fillStyle=it.color||'#000000';
      ctx.font=`${it.fontSize||20}px sans-serif`;
      ctx.textBaseline='top';
      ctx.textAlign=it.textAlign==='center'?'center':(it.textAlign==='right'?'right':'left');
      const tx=it.textAlign==='center'?it.x+it.w/2:(it.textAlign==='right'?it.x+it.w:it.x);
      ctx.fillText(it.content||'', tx, it.y);
    }
    ctx.restore();
  }
}

/* ── Hover Tracking no Modal (PARTE B) ── */
function dPsdHoverLayer(idx) {
  const overlay = document.getElementById('d-psd-preview-overlay');
  if (!overlay || !dPsdMeta) return;
  
  // Sincroniza dimensões nativas
  if (overlay.width !== dPsdMeta.w || overlay.height !== dPsdMeta.h) {
    overlay.width = dPsdMeta.w;
    overlay.height = dPsdMeta.h;
  }
  
  const ctx = overlay.getContext('2d');
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  
  if (idx >= 0 && dPsdItems[idx]) {
    const it = dPsdItems[idx];
    if (it.include) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 144, 0, 0.2)';
      ctx.strokeStyle = '#FF9000';
      const lw = Math.max(2, Math.min(overlay.width, overlay.height) * 0.003);
      ctx.lineWidth = lw;
      ctx.fillRect(it.x, it.y, it.w, it.h);
      ctx.strokeRect(it.x - lw/2, it.y - lw/2, it.w + lw, it.h + lw); // stroke por fora para n sobrepor as bordas diretas
      ctx.restore();
    }
  }
}

/* ══════════════════════════════════════════════════════════════
   PSD MULTI-PRANCHETA — seleção + revisão em sequência → templates
   Cada artboard selecionado vira um template (rascunho) na pasta escolhida.
══════════════════════════════════════════════════════════════ */
function _dPsdEsc(s){ return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function dPsdShowArtboardSelector(psd, artboards, res, baseName){
  const items=artboards.map((ab,i)=>{
    const r=ab.artboard.rect||{};
    const w=Math.max(1,Math.round((r.right||0)-(r.left||0)));
    const h=Math.max(1,Math.round((r.bottom||0)-(r.top||0)));
    return { index:i, name:(ab.name||('Prancheta '+(i+1))).toString().slice(0,48),
      w, h, left:Math.round(r.left||0), top:Math.round(r.top||0),
      fmt:dPsdDetectFmt(w,h), selected:true, layer:ab };
  });
  const overlay=document.getElementById('d-psd-ab-overlay');
  if(!overlay){ console.error('[psd] overlay d-psd-ab-overlay não encontrado'); return; }
  overlay.innerHTML=dPsdBuildArtboardSelectorHTML(items);
  overlay.style.display='flex';
  overlay._psdData={ psd, items, res:res||72, baseName:baseName||'PSD' };
}

function dPsdBuildArtboardSelectorHTML(items){
  const folders=(typeof dFolders!=='undefined'&&dFolders)?dFolders:[];
  const _tgt=(typeof dImportTargetFolderId!=='undefined')?dImportTargetFolderId:null;
  const folderOptions=folders.map(f=>`<option value="${_dPsdEsc(f.id)}" ${f.id===_tgt?'selected':''}>${_dPsdEsc(f.name)}</option>`).join('');
  const rows=items.map((item,i)=>`
    <div class="psd-ab-row" id="psd-ab-row-${i}">
      <label class="psd-ab-check">
        <input type="checkbox" ${item.selected?'checked':''} onchange="dPsdAbToggle(${i}, this.checked)">
      </label>
      <div class="psd-ab-info">
        <span class="psd-ab-name" title="${_dPsdEsc(item.name)}">${_dPsdEsc(item.name)}</span>
        <span class="psd-ab-dim">${item.w} × ${item.h}px</span>
      </div>
      <select class="psd-ab-fmt" id="psd-ab-fmt-${i}" onchange="dPsdAbSetFmt(${i}, this.value)">
        <option value="story" ${item.fmt==='story'?'selected':''}>Story</option>
        <option value="feed"  ${item.fmt==='feed' ?'selected':''}>Feed</option>
        <option value="wide"  ${item.fmt==='wide' ?'selected':''}>Wide</option>
      </select>
    </div>`).join('');
  const dest = folders.length
    ? `<div class="psd-ab-dest"><label>Importar para a pasta:</label>
        <select id="psd-ab-folder-sel" class="psd-ab-fmt">${folderOptions}</select></div>`
    : `<div class="psd-ab-dest" style="color:var(--dm-red)">⚠ Nenhuma pasta encontrada — crie uma pasta antes de importar.</div>`;
  return `
    <div class="psd-ab-modal">
      <div class="psd-ab-header">
        <span class="psd-ab-title">Pranchetas encontradas</span>
        <span class="psd-ab-subtitle">${items.length} prancheta(s) no arquivo PSD</span>
      </div>
      <div class="psd-ab-list">${rows}</div>
      ${dest}
      <div class="psd-ab-footer">
        <button class="psd-ab-btn cancel" onclick="dPsdAbCancel()">Cancelar</button>
        <button class="psd-ab-btn confirm" onclick="dPsdAbConfirm()">Revisar selecionadas →</button>
      </div>
    </div>`;
}

function dPsdAbToggle(index, checked){
  const o=document.getElementById('d-psd-ab-overlay');
  if(o&&o._psdData&&o._psdData.items[index]) o._psdData.items[index].selected=checked;
}
function dPsdAbSetFmt(index, fmt){
  const o=document.getElementById('d-psd-ab-overlay');
  if(o&&o._psdData&&o._psdData.items[index]) o._psdData.items[index].fmt=fmt;
}
function dPsdAbCancel(){
  const o=document.getElementById('d-psd-ab-overlay');
  if(o){ o.style.display='none'; o.innerHTML=''; o._psdData=null; }
}
function dPsdAbConfirm(){
  const overlay=document.getElementById('d-psd-ab-overlay');
  if(!overlay||!overlay._psdData) return;
  const { psd, items, res, baseName }=overlay._psdData;
  const selected=items.filter(it=>it.selected);
  if(!selected.length){ gToast('Selecione pelo menos uma prancheta'); return; }
  const folderSel=document.getElementById('psd-ab-folder-sel');
  const folderId=folderSel?folderSel.value:null;
  if(!folderId){ gToast('⚠ Crie uma pasta antes de importar','error'); return; }
  overlay.style.display='none'; overlay.innerHTML=''; overlay._psdData=null;
  // Processa cada prancheta em sequência (abre a revisão por camada, uma de cada vez).
  dPsdProcessArtboardsSequence(psd, selected, res, baseName, folderId, 0, []);
}

// Abre a revisão por camada de cada prancheta selecionada, uma por vez. Ao confirmar
// cada uma, acumula o resultado e avança; ao final, cria os templates na pasta.
function dPsdProcessArtboardsSequence(psd, items, res, baseName, folderId, idx, results){
  if(idx>=items.length){
    dPsdSaveArtboardTemplates(results, folderId, baseName);
    return;
  }
  const item=items[idx];
  // Parseia só as camadas desta prancheta, normalizando coords pra (0,0) da prancheta.
  dPsdItems=dPsdParseItems({children:(item.layer&&item.layer.children)||[]}, res, item.left, item.top);
  if(!dPsdItems.length){
    gToast('⚠ "'+item.name+'" sem camadas utilizáveis — pulando');
    dPsdProcessArtboardsSequence(psd, items, res, baseName, folderId, idx+1, results);
    return;
  }
  dPsdMeta={w:item.w, h:item.h, name:item.name};
  // Ao confirmar a revisão desta prancheta → guarda o resultado e vai pra próxima.
  _dPsdReviewOnConfirm=function(layers, fmtChoice, w, h){
    const fmt=(fmtChoice && fmtChoice!=='orig') ? fmtChoice : item.fmt;
    results.push({ name:item.name, fmt, layers, nativeW:w, nativeH:h });
    dPsdProcessArtboardsSequence(psd, items, res, baseName, folderId, idx+1, results);
  };
  gToast('Revisando: '+item.name+' ('+(idx+1)+'/'+items.length+')');
  dPsdOpenReview();
  // Pré-seleciona o formato detectado/escolhido no seletor da tela de revisão.
  const sel=document.getElementById('d-psd-fmt'); if(sel) sel.value=item.fmt;
}

// Reflow das layers (coords nativas da prancheta) pro espaço DFMT_SIZES[fmt] — o gerador
// do franqueado assume que o template vive no tamanho do seu material.fmt.
function _dPsdReflowToFmt(layers, w, h, fmt){
  let clone=JSON.parse(JSON.stringify(layers));
  if(typeof gEnsureAnchors==='function') gEnsureAnchors(clone, w, h);
  const to=DFMT_SIZES[fmt];
  if(to && (to.w!==w || to.h!==h) && typeof gReflowLayers==='function'){
    clone=gReflowLayers(clone, {w,h}, to, {fmtKey:(typeof gFmtKey==='function'?gFmtKey(fmt):fmt)});
  }
  return clone;
}

// Cria um template (rascunho) por prancheta revisada, na pasta escolhida, e persiste.
function dPsdSaveArtboardTemplates(results, folderId, baseName){
  if(!results.length){ gToast('Nenhuma prancheta importada'); return; }
  const folder=(typeof dFolders!=='undefined'&&dFolders)
    ? (dFolders.find(f=>f.id===folderId)||dFolders[0]) : null;
  if(!folder){ gToast('⚠ Pasta não encontrada','error'); return; }
  results.forEach((r,i)=>{
    const fmt=DFMT_SIZES[r.fmt]?r.fmt:'story';
    const layers=_dPsdReflowToFmt(r.layers, r.nativeW, r.nativeH, fmt);
    const tmpl={
      id:'tmpl-psd-'+Date.now()+'-'+i+'-'+Math.random().toString(36).slice(2,7),
      name:(r.name||baseName||'Prancheta').toString().slice(0,30),
      fmt:fmt,
      layers:JSON.parse(JSON.stringify(layers)),
      publishMeta:(typeof dDefaultPublishMeta==='function')?dDefaultPublishMeta():{publicado:false,permissoes:{}}
    };
    folder.templates.push(tmpl);
  });
  if(typeof dFolderOpen!=='undefined') dFolderOpen[folder.id]=true;
  const ok=(typeof dPersistFolders==='function')?dPersistFolders():true;
  if(typeof dRenderFolders==='function') dRenderFolders();
  if(ok===false) return; // quota cheia: erro já exibido por dPersistFolders
  // Abre o último template importado no editor.
  const last=folder.templates[folder.templates.length-1];
  if(last && typeof dLoadTemplate==='function') dLoadTemplate(last, folder);
  gToast('✓ '+results.length+' template(s) importado(s) → '+folder.name);
}

/* ── overlay de "lendo PSD…" ── */
function _dPsdBusy(on){
  let el=document.getElementById('d-psd-busy');
  if(on){
    if(!el){ el=document.createElement('div'); el.id='d-psd-busy';
      el.innerHTML='<div class="d-psd-busy-box"><span class="mini-spinner"></span> Lendo PSD…</div>';
      document.body.appendChild(el); }
    el.style.display='flex';
  } else if(el){ el.style.display='none'; }
}

/* ── handler do input ── */
async function dImportPSD(input){
  const file=input.files && input.files[0];
  input.value='';
  if(!file) return;
  if(!/\.psd$/i.test(file.name)){ gToast('Selecione um arquivo .psd','error'); return; }
  if(file.size > 200*1024*1024){ gToast('⚠ PSD muito grande (máx ~200MB)','error'); return; }
  _dPsdBusy(true);
  let agPsd;
  try{ agPsd=await dLoadAgPsd(); }catch(e){ _dPsdBusy(false); gToast('⚠ '+e.message,'error'); return; }
  let buf;
  try{ buf=await file.arrayBuffer(); }catch(e){ _dPsdBusy(false); gToast('⚠ Não consegui ler o arquivo','error'); return; }
  let usedWorker=true;
  let result;
  try{ result=await _dPsdReadPsd(buf, agPsd); }
  catch(e){ result={error:e}; }
  if(!result || result.error || !result.psd || !result.psd.width){
    _dPsdBusy(false); console.error('PSD:',result&&result.error); gToast('⚠ Não consegui ler esse PSD (formato/compressão não suportado)','error'); return;
  }
  try{
    const baseName=file.name.replace(/\.psd$/i,'');
    // PSD com múltiplas pranchetas (artboards) → tela de seleção antes da revisão.
    const artboards=(result.psd.children||[]).filter(c=>c && c.artboard && c.artboard.rect);
    if(artboards.length>1){
      _dPsdBusy(false);
      dPsdShowArtboardSelector(result.psd, artboards, result.res||72, baseName);
      return;
    }
    // Fluxo original — uma prancheta ou PSD simples.
    dPsdItems=dPsdParseItems(result.psd, result.res||72);
    dPsdMeta={w:result.psd.width, h:result.psd.height, name:baseName, res:result.res||72, worker:result.worker===true};
    _dPsdBusy(false);
    if(!dPsdItems.length){ gToast('⚠ Não encontrei camadas utilizáveis nesse PSD','error'); return; }
    dPsdOpenReview();
  }catch(e){ _dPsdBusy(false); console.error('PSD parse:',e); gToast('⚠ Falha ao interpretar as camadas do PSD','error'); }
}
