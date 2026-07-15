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
// ag-psd devolve o blend mode como chave separada por ESPAÇO ('color burn', 'soft light',
// 'linear dodge'…). O motor de blend (blending.js) e o CSS usam camelCase ('colorBurn'). Sem
// normalizar, modos de 2+ palavras não eram aplicados (nem na arte final nem no preview) —
// dBlendToComposite('color burn') caía em undefined. DBLEND_PSD_MAP faz a ponte.
function _dPsdBlendMode(bm){
  if(!bm || bm==='normal' || bm==='passThrough') return undefined;
  if(typeof DBLEND_PSD_MAP!=='undefined' && DBLEND_PSD_MAP[bm]) return DBLEND_PSD_MAP[bm];
  return bm; // já camelCase ou modo de uma palavra conhecido
}
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
// Escala vertical do transform de texto. Robusta a rotação/cisalhamento: usa a magnitude do
// vetor-y da matriz (c,d) em vez de só |d|. Fallback 1.
function _dPsdFontScale(tr){
  if(!tr || tr.length<4) return 1;
  const c=+tr[2]||0, d=+tr[3]||0, s=Math.sqrt(c*c+d*d);
  return (isFinite(s)&&s>0)?s : (Math.abs(d)||1);
}
// #4b — fontSize robusto e DETERMINÍSTICO: fontSize(pt) × escala(transform) × DPI(res/72),
// aplicado de forma CONSISTENTE para box e point (antes divergiam). Só cai na caixa quando o
// tamanho real é ausente/implausível — preservando o tamanho 1:1 do Photoshop.
function _dPsdFontSize(t,h,content,res){
  const s=_dPsdTextStyle(t);
  let fs=(s.fontSize||s.size||0)*_dPsdFontScale(t&&t.transform);
  // DPI: o fontSize vem em pontos; em doc hi-res (res≠72) escala p/ px. Guard fs<200: se o
  // transform já trouxe um valor grande em px, não dobra. Mesmo critério p/ box e point.
  if(res>90 && fs>0 && fs<200) fs*=(res/72);
  // PARÁGRAFO (box): a caixa é fixa/alta → confia sempre no tamanho real do designer.
  if(t && t.shapeType==='box' && fs>=6 && fs<=2000) return Math.round(Math.max(8,Math.min(fs,2000)));
  // POINT: confia no tamanho real; só ancora na caixa (bbox de glifos) se o valor for implausível.
  const nLines=Math.max(1, String(content||'').split('\n').filter(x=>x.trim()).length);
  const boxFs=Math.min(h/(nLines*1.25), 180); // cap 180px evita caixas altas gerarem fs gigante
  if(fs>=4 && fs<=4000){
    if(fs < boxFs*0.4 || fs > boxFs*2.5) fs=boxFs; // real incoerente vs bbox → usa a caixa
    return Math.round(Math.max(8,fs));
  }
  if(h < 12) return 12; // caixa muito pequena → mínimo razoável
  return Math.round(Math.max(8,boxFs));
}
// Caixa de PARÁGRAFO (box text): deriva {x,y,w,h} em px ABSOLUTOS do doc — a caixa 1:1 que o
// designer desenhou no Photoshop, para NÃO reencaixar/encolher o texto na importação.
// ag-psd expõe a caixa em text-space por duas vias (boxBounds via EngineData e bounds via
// descriptor TySh), mais o transform afim. O espaço de cada uma varia entre versões/arquivos,
// então geramos TODOS os candidatos (cada fonte × {transform, cru}) e escolhemos por SCORE
// (o quão bem a caixa "abraça" o bbox de glifos do layer) em vez de aceitar/rejeitar no grito.
// Isso recupera a caixa real mesmo quando ela é maior que os glifos (caso comum) — o antigo
// teste de contenção estrita rejeitava e caía no bbox apertado, quebrando a hierarquia textual.
function _dPsdParagraphBox(node){
  try{
    const t=node.text; if(!t) return null;
    const tr=(t.transform&&t.transform.length>=6)?t.transform:[1,0,0,1,0,0];
    const a=tr[0],b=tr[1],c=tr[2],d=tr[3],e=tr[4],f=tr[5];
    const gx0=node.left||0, gy0=node.top||0, gx1=node.right||0, gy1=node.bottom||0;
    const gw=Math.max(1,gx1-gx0), gh=Math.max(1,gy1-gy0), gArea=gw*gh;
    // Normaliza as fontes de caixa em {left,top,right,bottom}
    const norm=bb=>{
      if(!bb) return null;
      if(Array.isArray(bb)) bb={left:bb[0],top:bb[1],right:bb[2],bottom:bb[3]};
      if(bb.left==null||bb.right==null||bb.top==null||bb.bottom==null) return null;
      return bb;
    };
    const sources=[norm(t.boxBounds), norm(t.bounds)].filter(Boolean);
    if(!sources.length) return null;
    const corners=(bb,map)=>{
      const p=[map(bb.left,bb.top),map(bb.right,bb.top),map(bb.right,bb.bottom),map(bb.left,bb.bottom)];
      let mnX=Infinity,mnY=Infinity,mxX=-Infinity,mxY=-Infinity;
      p.forEach(q=>{ if(q[0]<mnX)mnX=q[0]; if(q[0]>mxX)mxX=q[0]; if(q[1]<mnY)mnY=q[1]; if(q[1]>mxY)mxY=q[1]; });
      return {x:mnX,y:mnY,w:mxX-mnX,h:mxY-mnY};
    };
    const cands=[];
    sources.forEach(bb=>{
      cands.push(Object.assign(corners(bb,(x,y)=>[a*x+c*y+e, b*x+d*y+f]), {isTransformed:true})); // text-space → doc (transform)
      cands.push(Object.assign(corners(bb,(x,y)=>[x,y]), {isTransformed:false})); // já em px de doc (cru)
    });
    const maxW=Math.max(gw*8,6000), maxH=Math.max(gh*8,6000);
    // Score: exige dimensão sã e que a caixa contenha ao menos metade do bbox de glifos.
    // Prefere caixa transformada (com escala) se cobrir a mesma área que a crua,
    // desempata priorizando o canto superior-esquerdo, ignorando a penalidade pura de área.
    const score=box=>{
      if(!box||!isFinite(box.w)||!isFinite(box.h)||box.w<=1||box.h<=1) return -Infinity;
      if(box.w>maxW||box.h>maxH) return -Infinity;
      const ix=Math.max(0, Math.min(box.x+box.w,gx1)-Math.max(box.x,gx0));
      const iy=Math.max(0, Math.min(box.y+box.h,gy1)-Math.max(box.y,gy0));
      const cover=(ix*iy)/gArea;             // 1.0 = contém todo o bbox de glifos
      if(cover<0.5) return -Infinity;        // caixa longe/torta dos glifos → descarta
      const dCorner=Math.abs(box.x-gx0)+Math.abs(box.y-gy0);
      return cover*1000 - dCorner*0.01 + (box.isTransformed ? 50 : 0);
    };
    let best=null,bestScore=-Infinity;
    cands.forEach(box=>{ const s=score(box); if(s>bestScore){ bestScore=s; best=box; } });
    if(!best || bestScore===-Infinity) return null;
    return {x:Math.round(best.x),y:Math.round(best.y),w:Math.round(best.w),h:Math.round(best.h)};
  }catch(e){ return null; }
}
// #2 — efeitos de camada (layer.effects) → props da Luma. Lê sombra projetada, sombra interna,
// brilho externo, sobreposição de cor e contorno (com alinhamento). _u: parseUnits → {value} ou número.
function _dPsdEffects(node){
  const fx=node.effects||{}; const out={};
  const _u=v=>{ if(v==null) return 0; return (v.value!=null)?+v.value:+v; };
  // Pega o 1º efeito de um array e marca _fxOverflow quando há vários do mesmo tipo
  // (PS CC permite 2+ sombras/traços; o modelo Luma só representa um → P3 rasteriza o resto fiel).
  const _first=x=>{ if(Array.isArray(x)){ if(x.length>1) out._fxOverflow=true; return x[0]; } return x; };
  // Sombra projetada
  let ds=_first(fx.dropShadow);
  if(ds && ds.enabled!==false){
    out.shadow=true;
    out.shadowColor=gFxRgba(_dPsdHex(ds.color)||'#000000', ds.opacity!=null?ds.opacity:.5);
    out.shadowBlur=Math.round(_u(ds.size));
    out.shadowDist=Math.round(_u(ds.distance));
    if(ds.angle!=null) out.shadowAngle=Math.round(ds.angle);
  }
  // Sombra interna
  let is=_first(fx.innerShadow);
  if(is && is.enabled!==false){
    out.innerShadow=true;
    out.innerShadowColor=gFxRgba(_dPsdHex(is.color)||'#000000', is.opacity!=null?is.opacity:.5);
    out.innerShadowBlur=Math.round(_u(is.size));
    out.innerShadowDist=Math.round(_u(is.distance));
    if(is.angle!=null) out.innerShadowAngle=Math.round(is.angle);
  }
  // Brilho externo
  let og=_first(fx.outerGlow);
  if(og && og.enabled!==false){
    out.glow=true;
    out.glowColor=gFxRgba(_dPsdHex(og.color)||'#ffffff', og.opacity!=null?og.opacity:.6);
    out.glowSize=Math.max(1,Math.round(_u(og.size)));
  }
  // Brilho interno (inner glow)
  let ig=_first(fx.innerGlow);
  if(ig && ig.enabled!==false){
    out.innerGlow=true;
    out.innerGlowColor=gFxRgba(_dPsdHex(ig.color)||'#ffffff', ig.opacity!=null?ig.opacity:.6);
    out.innerGlowSize=Math.max(1,Math.round(_u(ig.size)));
  }
  // Chanfro/relevo (bevel & emboss) → aprox.: realce + sombra internos
  let bv=_first(fx.bevel);
  if(bv && bv.enabled!==false){
    out.bevel=true;
    out.bevelSize=Math.max(1,Math.round(_u(bv.size)));
    if(bv.angle!=null) out.bevelAngle=Math.round(bv.angle);
    out.bevelHighlight=gFxRgba(_dPsdHex(bv.highlightColor)||'#ffffff', bv.highlightOpacity!=null?bv.highlightOpacity:.75);
    out.bevelShadow=gFxRgba(_dPsdHex(bv.shadowColor)||'#000000', bv.shadowOpacity!=null?bv.shadowOpacity:.75);
  }
  // Sobreposição de cor (color overlay / solidFill)
  let so=_first(fx.solidFill);
  if(so && so.enabled!==false && so.color){
    out.overlay=true;
    out.overlayColor=_dPsdHex(so.color)||'#000000';
    out.overlayOpacity=(so.opacity!=null?+so.opacity:1);
    // blendMode do efeito (multiply/screen/etc). O renderer ainda não aplica → guarda p/ P3
    // decidir rasterizar quando for um modo que o overlay simples (substituição de cor) falsearia.
    if(so.blendMode && so.blendMode!=='normal') out.overlayBlend=so.blendMode;
  }
  // Sobreposição de gradiente (gradient overlay)
  let go2=_first(fx.gradientOverlay);
  if(go2 && go2.enabled!==false && go2.gradient && go2.gradient.colorStops){
    const src=go2.gradient;
    let goStops=src.colorStops.map(s=>({color:_dPsdHex(s.color)||'#000000', pos:Math.max(0,Math.min(1,s.location||0)), opacity:_dPsdOpacityAt(src.opacityStops, s.location||0)}));
    if(src.reverse){ goStops=goStops.map(s=>({...s,pos:1-s.pos})).reverse(); }
    out.gradientOverlay={
      type:String(go2.type||src.style||'linear').toLowerCase().includes('radial')?'radial':'linear',
      angle:Math.round(-(go2.angle!=null?go2.angle:90)), // PS anti-horário → Luma horário
      opacity:(go2.opacity!=null?+go2.opacity:1),
      stops:goStops
    };
    if(go2.blendMode && go2.blendMode!=='normal') out.gradientOverlay.blendMode=go2.blendMode;
  }
  // Contorno (frame FX) + alinhamento
  let st=_first(fx.stroke);
  if(st && st.enabled!==false){
    // +_sv||2: size pode vir {value:0}/unidade estranha — sem o guard, Math.round(objeto)=NaN
    const _sv=(st.size&&st.size.value!=null)?st.size.value:st.size;
    out.strokeW=Math.max(1,Math.round(+_sv||2));
    out.strokeColor=_dPsdHex((st.color&&(st.color.color||st.color)))||'#000000';
    if(st.position) out.strokeAlign=({inside:'inside',insetFrame:'inside',center:'center',centeredFrame:'center',outside:'outside',outsetFrame:'outside'}[st.position])||'outside';
  }
  return out;
}
// Cor sólida EXATA de uma camada de forma/preenchimento (vectorFill type='color').
// É a cor que o designer definiu — fiel 1:1, sem o erro de amostrar pixels (anti-aliasing,
// opacidade, blend). Retorna hex ou null (aí cai na amostragem de pixels como fallback).
function _dPsdVectorSolidColor(node){
  try{ const vf=node&&node.vectorFill; if(vf && vf.type==='color' && vf.color) return _dPsdHex(vf.color); }catch(e){}
  return null;
}
// Tipo de forma EXATO via vectorOrigination.keyOriginType (1=retângulo, 2=retângulo arredondado,
// 4=elipse). Mais fiel que inferir por pixels. Retorna {kind,radius} ou null (cai no heurístico).
function _dPsdVectorShapeKind(node, w, h){
  try{
    const list=node&&node.vectorOrigination&&node.vectorOrigination.keyDescriptorList;
    if(!list||!list.length) return null;
    let ot=null; for(let i=0;i<list.length;i++){ if(list[i]&&list[i].keyOriginType!=null){ ot=list[i].keyOriginType; break; } }
    if(ot==null) return null;
    if(ot===4){ const r=w/h; return {kind:(r>0.85&&r<1.18)?'circle':'ellipse', radius:0}; } // elipse/círculo
    if(ot===1||ot===2) return {kind:'rect', radius:0}; // retângulo (raio por-canto vem de _dPsdCornerRadii)
    return null; // linha/custom → deixa o heurístico de pixel decidir
  }catch(e){ return null; }
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
// opts opcional {maxPx, q}: camadas que SÓ existem como raster fiel (warp, smart object, padrão)
// pedem mais resolução/qualidade. Default 1600/0.82 mantém as chamadas existentes intactas.
// O peso extra é absorvido pelo IndexedDB (idb://), então não estoura o localStorage.
function _dPsdRasterURL(canvas, opts){
  try{
    opts=opts||{};
    const MAX=opts.maxPx||1600, q=(opts.q!=null?opts.q:0.82), w=canvas.width, h=canvas.height;
    const scale=Math.min(1, MAX/Math.max(w,h));
    const hasAlpha=_dPsdHasAlpha(canvas);
    let src=canvas;
    if(scale<1){
      const tw=Math.max(1,Math.round(w*scale)), th=Math.max(1,Math.round(h*scale));
      const c=document.createElement('canvas'); c.width=tw; c.height=th;
      const cx=c.getContext('2d'); cx.imageSmoothingQuality='high'; cx.drawImage(canvas,0,0,tw,th); src=c;
    }
    return hasAlpha ? src.toDataURL('image/png') : src.toDataURL('image/jpeg',q);
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
// Opacidade de um gradiente na posição loc (0..1), INTERPOLADA linearmente entre os dois
// opacityStops vizinhos (antes pegava o vizinho mais próximo, o que serrilhava a transição).
function _dPsdOpacityAt(opacityStops, loc){
  const os=opacityStops||[];
  if(!os.length) return 1;
  const sorted=os.slice().sort((a,b)=>(a.location||0)-(b.location||0));
  const op=s=>s.opacity!=null?s.opacity:1;
  if(loc<=(sorted[0].location||0)) return op(sorted[0]);
  const last=sorted[sorted.length-1];
  if(loc>=(last.location||0)) return op(last);
  for(let i=0;i<sorted.length-1;i++){
    const a=sorted[i], b=sorted[i+1], la=a.location||0, lb=b.location||0;
    if(loc>=la && loc<=lb){ if(lb===la) return op(a); return op(a)+(op(b)-op(a))*((loc-la)/(lb-la)); }
  }
  return 1;
}
function _dPsdGradient(node){
  try{
    let src=null;
    if(node.vectorFill && node.vectorFill.colorStops) src=node.vectorFill;            // camada de gradiente (GdFl)
    else { let go=node.effects&&node.effects.gradientOverlay; if(Array.isArray(go)) go=go[0];
      if(go && go.enabled!==false && go.gradient && go.gradient.colorStops){ src=go.gradient; src.angle=go.angle; src.style=go.type||src.style; } }
    if(!src||!src.colorStops||!src.colorStops.length) return null;
    const style=String(src.style||'linear').toLowerCase();
    let stops=src.colorStops.map(s=>({ color:_dPsdHex(s.color)||'#000000', pos:Math.max(0,Math.min(1,s.location||0)), opacity:_dPsdOpacityAt(src.opacityStops, s.location||0) }));
    if(src.reverse){ stops=stops.map(s=>({...s,pos:1-s.pos})).reverse(); } // PS "Reverse" → espelha os stops
    // Convenção de ângulo: o Photoshop mede o ângulo do gradiente no sentido ANTI-horário; o
    // renderizador do Luma (gGradientCanvas/Css) progride em (cos θ, sin θ) = sentido HORÁRIO.
    // Negar o ângulo do PS converte para a convenção do Luma (θ=0 e horizontais ficam iguais).
    return { type: style.includes('radial')?'radial':'linear', angle: Math.round(-(src.angle!=null?src.angle:90)), stops };
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
      const _rfs=_dPsdFontSize({style:st,transform:t.transform}, h, seg, res);
      out.push({
        text:seg,
        color:_dPsdHex(st.fillColor||st.color)||'#000000',
        fontSize:_rfs,
        font: remap||(/black|900|heavy/i.test(fname)?"'Roboto Black'":/bold|700/i.test(fname)?"'Roboto',bold":"'Roboto'"),
        _fontName:fname, // nome original — permite remap posterior (upload de fonte na revisão)
        letterSpacing: st.tracking? Math.round((st.tracking/1000)*(_rfs||12)) : 0 // tracking sobre o tamanho final do trecho
      });
    }
    return out.length>1?out:null;
  }catch(e){ return null; }
}
// Função auxiliar de singularização para heurísticas de auto-sugestão de variáveis do PSD.
// Reduz variações de plurais comuns em português e inglês para melhorar a correspondência semântica.
function _dSingularize(word){
  if(!word) return '';
  if(word.endsWith('oes')) return word.slice(0, -3) + 'ao'; // condicoes -> condicao
  if(word.endsWith('ns')) return word.slice(0, -2) + 'm';   // cupons -> cupom
  if(word.endsWith('ies')) return word.slice(0, -3) + 'y';   // validities -> validity
  if(word.endsWith('es')){
    if(word.endsWith('res')) return word.slice(0, -2); // valores -> valor
    if(word.endsWith('hes')) return word.slice(0, -2); // detalhes -> detalhe
    return word.slice(0, -1);
  }
  if(word.endsWith('s') && word.length > 2){
    return word.slice(0, -1); // produtos -> produto, prices -> price
  }
  return word;
}

// #1 — sugere variável pelo nome ({{x}}) ou heurística de negócios Luma (auto:true ativa modo var por padrão)
function _dPsdSuggestVar(name, content){
  const raw=String(name||'');
  const m=raw.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/);
  if(m) return {name:m[1], auto:true};
  
  let clean=raw.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
  const sing=_dSingularize(clean);
  
  // Mapeamento específico de variáveis Luma comuns, incluindo suporte multilíngue
  const map={
    preco:'precoPor',
    precopor:'precoPor',
    precode:'precoDe',
    preco_de:'precoDe',
    preco_por:'precoPor',
    valor:'precoPor',
    promocao:'precoPor',
    de:'precoDe',
    por:'precoPor',
    
    // Inglês e sinônimos adicionais
    price:'precoPor',
    value:'precoPor',
    sale:'precoPor',
    promo:'precoPor',
    from:'precoDe',
    to:'precoPor',
    price_to:'precoPor',
    priceto:'precoPor',
    price_from:'precoDe',
    pricefrom:'precoDe',
    old_price:'precoDe',
    oldprice:'precoDe',
    price_old:'precoDe',
    new_price:'precoPor',
    newprice:'precoPor',
    price_new:'precoPor',
    sale_price:'precoPor',
    saleprice:'precoPor',
    
    product:'produto',
    validity:'validade',
    valid:'validade',
    detail:'detalhes',
    discount:'desconto',
    off:'desconto',
    coupon:'cupom',
    code:'codigo',
    gift:'brinde',
    freebie:'brinde',
    condition:'condicao',
    min_order:'pedidoMin',
    minorder:'pedidoMin',
    neighborhood:'bairros',
    area:'bairros',
    offer:'oferta',
    category:'categoria'
  };
  
  const matchedKey = map[clean] || map[sing];
  if(matchedKey) return {name:matchedKey, auto:true};
  
  const known=[
    'produto', 'precoPor', 'precoDe', 'validade', 'detalhes', 'desconto', 'cupom', 'codigo',
    'brinde', 'condicao', 'pedidoMin', 'bairros', 'oferta', 'categoria'
  ];
  const hit=known.find(k=>{
    const lower=k.toLowerCase();
    return lower===clean || lower===sing;
  });
  if(hit) return {name:hit, auto:true};
  
  // Heurística de preço no conteúdo
  if(content && /(?:r\$|\$)\s*\d/i.test(content)){
    if(/(?:de|from)/i.test(clean) || /(?:de|from)/i.test(sing)) return {name:'precoDe', auto:true};
    return {name:'precoPor', auto:true};
  }
  
  return {name:clean||'variavel', auto:false};
}

// Sugere variável e modo moldura para camadas de imagem baseando-se no nome
function _dPsdSuggestImgVar(name){
  const clean=String(name||'').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
  const sing=_dSingularize(clean);
  
  if(/logo|logomarca|marca|brand|logotipo/i.test(clean) || /logo|logomarca|marca|brand|logotipo/i.test(sing)){
    return {name:'logo_loja', mode:'frame'};
  }
  if(/foto|imagem|img|photo|picture|pic|product|prod|banner|campanha|fundo|background|bg/i.test(clean) || /foto|imagem|img|photo|picture|pic|product|prod|banner|campanha|fundo|background|bg/i.test(sing)){
    return {name:'foto_produto', mode:'frame'};
  }
  return null;
}

/* ── #4e — parse: Web Worker (offload) com fallback main-thread ── */
const _DPSD_WORKER_SRC = ""
  + "self.onmessage=function(e){try{"
  + "try{importScripts(e.data.lib);}catch(_){importScripts(e.data.cdn);}"
  + "var psd=self.agPsd.readPsd(e.data.buffer,{useImageData:true,skipLayerImaging:false});"
  + "var transfers=[];"
  + "function strip(n){var o={name:n.name,left:n.left,top:n.top,right:n.right,bottom:n.bottom,hidden:n.hidden,opacity:n.opacity,fillOpacity:n.fillOpacity,blendMode:n.blendMode,text:n.text,effects:n.effects,artboard:n.artboard,clipping:n.clipping,clippingLayer:n.clippingLayer||n.clipping,vectorMask:n.vectorMask,vectorStroke:n.vectorStroke,vectorOrigination:n.vectorOrigination,vectorFill:n.vectorFill,adjustment:n.adjustment,placedLayer:n.placedLayer};"
  + "if(n.imageData&&n.imageData.data){o._img={w:n.imageData.width,h:n.imageData.height,buf:n.imageData.data.buffer};transfers.push(n.imageData.data.buffer);}"
  + "if(n.mask&&n.mask.imageData&&n.mask.imageData.data){o._mask={w:n.mask.imageData.width,h:n.mask.imageData.height,buf:n.mask.imageData.data.buffer,left:n.mask.left,top:n.mask.top,defaultColor:n.mask.defaultColor,disabled:n.mask.disabled};transfers.push(n.mask.imageData.data.buffer);}"
  + "if(n.children)o.children=n.children.map(strip);return o;}"
  + "var res=(psd.imageResources&&psd.imageResources.resolutionInfo&&psd.imageResources.resolutionInfo.horizontalResolution)||72;"
  + "if(res&&res.value)res=res.value;"
  + "self.postMessage({ok:true,tree:{width:psd.width,height:psd.height,res:res,children:(psd.children||[]).map(strip)}},transfers);"
  + "}catch(err){self.postMessage({ok:false,error:String(err)});}};";

function _dPsdRebuildNode(node){
  const n={name:node.name,left:node.left,top:node.top,right:node.right,bottom:node.bottom,hidden:node.hidden,opacity:node.opacity,fillOpacity:node.fillOpacity,blendMode:node.blendMode,text:node.text,effects:node.effects,artboard:node.artboard,clipping:node.clipping,clippingLayer:node.clippingLayer||node.clipping,vectorMask:node.vectorMask,vectorStroke:node.vectorStroke,vectorOrigination:node.vectorOrigination,vectorFill:node.vectorFill,adjustment:node.adjustment,placedLayer:node.placedLayer};
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
    let worker, to, workerUrl;
    try{
      const blob=new Blob([_DPSD_WORKER_SRC],{type:'application/javascript'});
      workerUrl = URL.createObjectURL(blob);
      worker=new Worker(workerUrl);
      const cleanup = () => { if(workerUrl){URL.revokeObjectURL(workerUrl);workerUrl=null;} try{worker.terminate();}catch(e){} };
      to=setTimeout(()=>{ cleanup(); mainParse(); }, 25000);
      worker.onmessage=(ev)=>{ clearTimeout(to); cleanup();
        if(done) return;
        if(ev.data&&ev.data.ok&&ev.data.tree){ done=true;
          const tree=ev.data.tree;
          resolve({psd:{width:tree.width,height:tree.height,children:(tree.children||[]).map(_dPsdRebuildNode)}, res:(+tree.res)||72, worker:true});
        } else mainParse();
      };
      worker.onerror=()=>{ clearTimeout(to); cleanup(); mainParse(); };
      const copy=buffer.slice(0); // transfere a CÓPIA; original fica pro fallback
      worker.postMessage({buffer:copy, lib:new URL('assets/vendor/ag-psd.js',location.href).href, cdn:'https://cdn.jsdelivr.net/npm/ag-psd/dist/bundle.js'}, [copy]);
    }catch(e){ if(to)clearTimeout(to); mainParse(); }
  });
}

/* ── detecção de formato pela proporção da prancheta ── */
function dPsdDetectFmt(w, h){
  // Match exato (±2px) tem prioridade sobre proporção — distingue wide de horizontal etc.
  const _tol=2;
  const exact=Object.keys(DFMT_SIZES).find(k=>Math.abs(DFMT_SIZES[k].w-w)<=_tol&&Math.abs(DFMT_SIZES[k].h-h)<=_tol);
  if(exact) return exact;
  const ratio=w/h;
  if(ratio<0.7) return 'story';
  if(ratio>1.4) return 'wide';
  return 'feed';
}
// Formato APENAS por match exato (±2px) → senão 'orig' (preserva o tamanho REAL do PSD, 1:1).
// Diferente de dPsdDetectFmt (que faz snap por proporção, usado em prancheta custom/SVG):
// aqui não queremos forçar uma prancheta 1080×1350 a virar 'feed' (1080×1080).
function _dPsdExactFmt(w, h){
  const _tol=2;
  return Object.keys(DFMT_SIZES).find(k=>Math.abs(DFMT_SIZES[k].w-w)<=_tol&&Math.abs(DFMT_SIZES[k].h-h)<=_tol)||'orig';
}

// Tenta mapear um nome de fonte do PSD para fontes bundled (dBuiltinFonts) ou enviadas
// (dCustomFonts). Normaliza ambos (lowercase, só alfanum) e aceita correspondência
// exata ou por prefixo. Retorna 'custom:Family' ou null se não encontrar.
function _dPsdRemapFont(fontName){
  if(!fontName) return null;
  const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const t=norm(fontName); if(!t) return null;
  // Fontes bundled (dBuiltinFonts) têm prioridade pois não requerem upload do usuário
  const builtin=(typeof dBuiltinFonts!=='undefined'&&dBuiltinFonts)||[];
  const custom=(typeof dCustomFonts!=='undefined'&&dCustomFonts)||[];
  const all=[
    ...builtin.map(f=>({name:f.family,family:f.family})),
    ...custom
  ];
  if(!all.length) return null;
  const exact=all.find(f=>norm(f.name)===t||norm(f.family)===t);
  if(exact) return 'custom:'+exact.family;
  // correspondência por prefixo (ex: "ObviouslyWideBold" bate "Obviously Wide")
  const partial=all.find(f=>{ const fn=norm(f.name),ff=norm(f.family);
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

// Detecta ROTAÇÃO significativa da camada. O modelo do Luma não tem rotação, então uma camada
// rotacionada, se importada como texto/shape editável, viria eixo-alinhada (torta/errada). Detectar
// aqui permite rasterizar o pixel já rotacionado (1:1). Texto: ângulo do transform (a,b). Forma:
// cantos da caixa de origem (keyOriginBoxCorners) fora do eixo. Threshold ~1.5° evita falso positivo.
function _dPsdIsRotatedLayer(node){
  try{
    const tt=node.text&&node.text.transform;
    if(tt&&tt.length>=2 && Math.abs(Math.atan2(+tt[1]||0, +tt[0]||1))>0.0262) return true; // texto rotacionado
    const list=node.vectorOrigination&&node.vectorOrigination.keyDescriptorList;
    if(list) for(let i=0;i<list.length;i++){
      const c=list[i]&&list[i].keyOriginBoxCorners;
      if(c&&c.length===4){
        const dyTop=Math.abs((c[0].y||0)-(c[1].y||0));   // aresta superior deveria ser horizontal
        const dxLeft=Math.abs((c[0].x||0)-(c[3].x||0));  // aresta esquerda deveria ser vertical
        const wRef=Math.abs((c[1].x||0)-(c[0].x||0))||1, hRef=Math.abs((c[3].y||0)-(c[0].y||0))||1;
        if(dyTop>Math.max(2,wRef*0.02) || dxLeft>Math.max(2,hRef*0.02)) return true; // caixa girada
      }
    }
  }catch(e){}
  return false;
}
// P3 — decisão CENTRAL de fidelidade: a camada NÃO é representável de forma editável no Luma
// e deve virar uma IMAGEM pixel-perfeita (do node.canvas que o ag-psd já compõe), mantendo o
// visual 1:1 mesmo sem ser editável. Gatilhos determinísticos (passo 1):
//  • smart object (placedLayer): ag-psd só entrega o composto achatado → raster fiel evita
//    a mis-detecção como "shape sólida" e preserva o pixel.
//  • preenchimento/sobreposição por PADRÃO (vectorFill pattern, effects.patternOverlay): não há
//    modelo de padrão no Luma → raster do tile já renderizado.
//  • camada de ajuste (adjustment): não tem pixels próprios; retorna true para sinalizar, mas só
//    rasteriza se houver node.canvas (a fidelidade de COR via composite do doc é o passo 5).
// Só força raster quando há node.canvas utilizável; senão devolve false e o fluxo normal segue.
function _dPsdNeedsRaster(node){
  if(!node) return false;
  if(node.placedLayer || node.smartObject) return true;                 // smart object
  if(node.adjustment) return true;                                      // camada de ajuste
  if(node.vectorFill && node.vectorFill.type==='pattern') return true;  // preenchimento por padrão (PtFl)
  let po=node.effects && node.effects.patternOverlay; if(Array.isArray(po)) po=po[0];
  if(po && po.enabled!==false) return true;                             // sobreposição de padrão
  if(_dPsdIsRotatedLayer(node)) return true;                            // camada rotacionada → raster fiel (1:1)
  // texto com WARP (arco/onda/bandeira/etc): a deformação faz parte dos PIXELS do node.canvas,
  // não dá pra reproduzir como texto editável → raster preserva o visual deformado 1:1.
  if(node.text && node.text.warp){
    const ws=node.text.warp.style;                       // ag-psd DECODIFICA: sem warp = 'none' (não 'warpNone')
    const bent=(node.text.warp.value||0)!==0 || (node.text.warp.perspective||0)!==0; // bend 0% = sem deformação visível
    if(ws && ws!=='none' && ws!=='warpNone' && bent) return true;
  }
  return false;
}

/* ── PSD → itens intermediários (modo escolhível na revisão) ── */
let dPsdItems=[]; let dPsdMeta=null;
// Nº de camadas de ajuste (Levels/Curves/Hue…) vistas no último parse. O Luma não tem pipeline
// de ajuste, então elas são dropadas e as cores podem diferir do PSD → vira aviso na revisão.
let _dPsdAdjustCount=0;
// Callback opcional da revisão (fluxo multi-prancheta). Quando setado, dPsdConfirmImport
// encaminha as layers pra ele em vez de criar uma prancheta solta no editor.
let _dPsdReviewOnConfirm=null;
// ox/oy: offset de origem (usado em artboards p/ normalizar coords pra (0,0) da prancheta).
function dPsdParseItems(psd, res, ox, oy){
  ox=ox||0; oy=oy||0;
  _dPsdAdjustCount=0;
  const items=[]; let n=0;
  // parentOp: opacidade acumulada dos grupos-pai (0–1); parentHidden: grupo-pai oculto.
  (function walk(nodes, parentOp, parentHidden, parentName){
    (nodes||[]).forEach(node=>{
      if(node.adjustment) _dPsdAdjustCount++; // camada de ajuste (dropada; afeta cor → aviso na revisão)
      const nodeOp=node.opacity!=null?node.opacity:1;
      const accOp=parentOp*nodeOp;
      const accHidden=parentHidden||(node.hidden?true:false);
      if(node.children && node.children.length){
        // Artboards não propagam nome como grupo (são a raiz); grupos regulares sim.
        walk(node.children, accOp, accHidden, node.artboard?'':node.name||parentName||'');
        return;
      }
      const x=Math.round((node.left||0)-ox), y=Math.round((node.top||0)-oy);
      const w=Math.max(1,Math.round((node.right||0)-(node.left||0)));
      const h=Math.max(1,Math.round((node.bottom||0)-(node.top||0)));
      const it={ n:++n, name:(node.name||('Camada '+n)).toString().slice(0,48),
        x,y,w,h, visible:!accHidden, opacity:Math.round(accOp*100),
        include:!accHidden, mask:null, // resolvido no pós-processamento 
        clippingLayer: node.clippingLayer || node.clipping,
        blendMode:_dPsdBlendMode(node.blendMode),
        group:parentName||'', _psdNode:node }; // guarda p/ recorte correto
      // fillOpacity (preenchimento) ≠ opacity: PS atenua só o fill, não os efeitos. Guardado p/
      // dobrar na opacity quando não há efeitos (dItemToLayer); com efeitos, P3 rasteriza fiel.
      if(node.fillOpacity!=null && node.fillOpacity<1) it.fillOpacity=node.fillOpacity;
      // Recorte vetorial (vectorMask) — ex.: fundo com mordida/onda. Só quando NÃO há máscara
      // raster/clipping (preserva _dPsdComputeMask intacto). l.fill segue com a cor original.
      if(!it.mask && node.vectorMask && !node.vectorMask.disable){
        const vmURL=_dPsdVectorMaskURL(node);
        if(vmURL) it.mask=vmURL;
        else { it.vectorMaskFailed=true; console.warn('[psd] vectorMask não rasterizável, importando shape simplificado:', it.name); }
      }
      // P3: recurso não-representável editavelmente (smart object / padrão / ajuste / texto warp) →
      // vira imagem pixel-perfeita do que o PS compôs, preservando o visual 1:1 (evita drop/mis-detecção).
      if(_dPsdNeedsRaster(node) && node.canvas && node.canvas.width>0 && node.canvas.height>0){
        it.kind='raster'; it.mode='raster';
        it.imgUrl=_dPsdRasterURL(node.canvas,{maxPx:2400,q:0.92}); // única fonte de fidelidade → alta qualidade
        if(it.imgUrl){
          // node.canvas NÃO traz os efeitos de camada (são vetoriais no PS) → re-aplica os simples
          // (sombra/glow/contorno/overlay — 1º de cada) sobre o pixel, p/ a sombra do smart object etc.
          Object.assign(it,_dPsdEffects(node));
          items.push(it); return;
        }
        // sem raster utilizável → segue o fluxo normal (pode virar texto/shape ou ser dropado)
      }
      if(node.text && node.text.text!=null && String(node.text.text).trim()!==''){
        const t=node.text, sv=_dPsdSuggestVar(node.name, t.text);
        const {style:st, isMultiStyle}=_dPsdDominantStyle(t);
        it.kind='text';
        it.content=String(t.text).replace(/\r\n?/g,'\n');
        it.multiStyle=isMultiStyle;
        // Ancoragem vertical pelo TOPO (origem do texto no Photoshop): o topo da tinta encosta no
        // node.top. Substitui a centralização genérica do editor → posição vertical 1:1 com o PS.
        it.vAlign='top';
        it.fontName=(st.font&&st.font.name)||'';
        const _fRemap=_dPsdRemapFont(it.fontName);
        it.font=_fRemap||(/black|900|heavy/i.test(it.fontName)?"'Roboto Black'":/bold|700/i.test(it.fontName)?"'Roboto',bold":"'Roboto'");
        it.fontRemapped=!!_fRemap;
        // fontCaps: 0=normal, 1=small-caps, 2=all-caps (PS "All Caps" character style)
        if(st.fontCaps===2) it.textTransform='uppercase';
        else if(st.fontCaps===1) it.textTransform='lowercase'; // small-caps → aproximação
        // fauxBold: PS "Faux Bold" — eleva o peso quando a fonte não tem variante bold
        if(st.fauxBold || /bold|black|heavy|700|900/i.test(it.fontName)) it.fontWeightOverride=700;
        // Itálico: faux italic do PS ou variante itálica/oblíqua no nome da fonte → font-style:italic
        if(st.fauxItalic || /italic|oblique|it[aá]lico/i.test(it.fontName)) it.italic=true;
        it.fontSize=_dPsdFontSize(t,h,it.content,res);
        it.color=_dPsdHex(st.fillColor||st.color)||'#000000';
        it.strikethrough=st.strikethrough===true; // tachado (DE: R$..) — render já suportado
        it.underline=st.underline===true;          // sublinhado — render espelha o strikethrough
        it.textAlign=_dPsdAlign(t);
        if(st.tracking) it.letterSpacing=Math.round((st.tracking/1000)*(it.fontSize||12)); // tracking (1/1000 em) → px, sobre o tamanho final
        if(st.leading) {
          const fPts = st.fontSize;
          if(fPts){ it.lineHeight=+(st.leading/fPts).toFixed(3); } // pts / pts
          else {
            const lPx = (res>90 && st.leading<200) ? st.leading*(res/72) : st.leading;
            it.lineHeight=+(lPx/(it.fontSize||12)).toFixed(3); // px / px
          }
        }
        const _runs=_dPsdRichRuns(t,res,h); if(_runs) it.runs=_runs;   // texto multi-estilo
        const _tg=_dPsdGradient(node); if(_tg) it.gradient=_tg;        // preenchimento por gradiente no texto
        Object.assign(it,_dPsdEffects(node));
        it.varName=sv.name;
        it.mode=sv.auto?'var':'text';
        // Tipo de caixa. Campo real do ag-psd: text.shapeType ('box'|'point'). Só PARAGRAPH (box)
        // substitui x/y/w/h pela caixa do designer; POINT mantém o bbox de glifos 1:1 (posição real).
        it.textBox=(t.shapeType==='box')?'box':'point';
        if(it.textBox==='box'){
          // Caixa 1:1 do Photoshop → NÃO reencaixa/encolhe o texto na importação.
          const pb=_dPsdParagraphBox(node);
          if(pb){ it.x=Math.round(pb.x-ox); it.y=Math.round(pb.y-oy); it.w=Math.max(1,pb.w); it.h=Math.max(1,pb.h); }
          else { it.textBoxApprox=true; console.warn('[psd] caixa de parágrafo não derivável — usando bbox de glifos:', it.name); }
        }
        if(node.canvas && node.canvas.width>0){ it.imgUrl=_dPsdRasterURL(node.canvas); } // p/ "imagem fiel"
      } else if(node.canvas && node.canvas.width>0 && node.canvas.height>0){
        // Camada de GRADIENTE (GdFl: tem vectorFill com colorStops) → shape com gradiente editável,
        // mesmo não sendo cor sólida (senão cairia em raster).
        const grad=(node.vectorFill && node.vectorFill.colorStops)?_dPsdGradient(node):null;
        // Cor: preferir a EXATA do vetor (vectorFill), cair na amostragem de pixels só se faltar.
        const solid=_dPsdVectorSolidColor(node)||_dPsdSolidColor(node.canvas);
        // Contorno vetorial (vectorStroke) — inclui formas SÓ-CONTORNO (sem preenchimento): molduras
        // vazadas, divisores e linhas TRACEJADAS. Antes, sem fill/gradiente, essas caíam no raster e o
        // tracejado virava imagem chapada (o dash lido em _dPsdShapeStroke nem era alcançado). Agora um
        // traçado real (lineWidth>0) também qualifica a camada como FORMA editável.
        const stroke=_dPsdShapeStroke(node);
        const hasStroke=stroke.strokeW>0;
        if(grad || solid || hasStroke){
          // Forma: preferir o tipo EXATO do vetor (keyOriginType), cair no heurístico de pixel.
          const shapeInfo=_dPsdVectorShapeKind(node,w,h)||_dPsdDetectShapeKind(node.canvas);
          it.kind='shape';
          // Só-contorno (sem fill sólido/gradiente) → fundo TRANSPARENTE, não a cor padrão laranja.
          it.fill=solid || (grad && grad.stops[0] && grad.stops[0].color) || (hasStroke ? 'transparent' : '#FF9000');
          if(grad) it.gradient=grad;
          it.shapeKind=shapeInfo.kind;
          it.radius=shapeInfo.radius;
          Object.assign(it,_dPsdEffects(node));        // sombra/glow/overlay/contorno-fx
          Object.assign(it,stroke);                    // traçado do shape (vectorStroke, incl. tracejado)
          const _rr=_dPsdCornerRadii(node,w,h); if(_rr) it.radii=_rr; // cantos por canto
          
          // Heurística de auto-frame para shapes (se o nome da camada contiver imagem/foto)
          const imgSug = _dPsdSuggestImgVar(it.name);
          if (imgSug) {
            it.mode = imgSug.mode;
            it.varName = imgSug.name;
          } else {
            it.mode = 'shape';
          }
        }
        else {
          it.kind='raster';
          it.imgUrl=_dPsdRasterURL(node.canvas);
          if(!it.imgUrl) return;
          
          // Heurística de auto-frame para imagens raster
          const imgSug = _dPsdSuggestImgVar(it.name);
          if (imgSug) {
            it.mode = imgSug.mode;
            it.varName = imgSug.name;
          } else {
            it.mode = 'raster';
          }
        }
      } else { return; }
      items.push(it);
    });
  })(psd.children, 1, false, '');
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

  // Resolve clipping masks garantindo a base correta. Atribuição CONDICIONAL:
  // sobrescrever com null apagava a máscara VETORIAL já gravada no walk
  // (vectorMask rasterizada) — camadas com recorte vetorial importavam cheias.
  for(let i=0; i<out.length; i++){
    let _m=null;
    if(out[i].clippingLayer){
      let baseIdx = i + 1;
      while(baseIdx < out.length && out[baseIdx].clippingLayer) baseIdx++;
      if(baseIdx < out.length) _m = _dPsdComputeMask(out[i]._psdNode, out[baseIdx]._psdNode);
    } else {
      _m = _dPsdComputeMask(out[i]._psdNode, null);
    }
    if(_m) out[i].mask = _m;
    delete out[i]._psdNode;
  }

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

  // Photoshop = Top-Down; Luma = Bottom-Up
  out.reverse();

  // Modo PADRÃO do parser (antes da memória/usuário) — referência p/ _dPsdMemSave
  // distinguir decisão real de default e só persistir o que o usuário mudou.
  out.forEach(it=>{ it._defaultMode=it.mode; });

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
  // fillOpacity sem efeitos ≡ opacity; com efeitos, só o fill deveria atenuar (não os efeitos) →
  // não é representável no modelo atual, marca p/ P3 rasterizar fiel.
  if(it.fillOpacity!=null && it.fillOpacity<1){
    const _hasFx=it.shadow||it.innerShadow||it.glow||it.innerGlow||it.bevel||it.overlay||it.gradientOverlay||it.strokeW;
    if(!_hasFx) base.opacity=Math.round((it.opacity!=null?it.opacity:100)*it.fillOpacity);
    else it.needsRaster=true;
  }
  if(it.mask) base.mask=it.mask;
  if(it.blendMode) base.blendMode=it.blendMode;
  // Modo MOLDURA DE FOTO (escolhido na revisão): a camada — forma ou imagem — vira um frame que o
  // franqueado preenche com foto. Preserva x/y/w/h; formato do frame herdado da forma original.
  if(it.mode==='frame'){
    const F=Object.assign(base,{type:'frame', imgUrl:'', imgVar:it.varName||'foto_produto', objectFit:'cover', shapeKind:it.shapeKind||'rect'});
    if(it.radius) F.radius=it.radius;
    if(it.radii) F.radii=it.radii;
    if(it.points) F.points=it.points;
    if(it.sides) F.sides=it.sides;
    if(it.inner) F.inner=it.inner;
    return _dPsdApplyFx(F, it);
  }
  if(it.needsRaster && it.imgUrl){
    return _dPsdApplyFx(Object.assign(base,{type:'image',imgUrl:it.imgUrl,imgVar:'',objectFit:'cover',frameShape:'rect'}), it);
  }
  if(it.kind==='text'){
    if(it.mode==='raster' && it.imgUrl) return _dPsdApplyFx(Object.assign(base,{type:'image',imgUrl:it.imgUrl,imgVar:'',objectFit:'cover',frameShape:'rect'}), it);
    const isVar=it.mode==='var';
    const L=Object.assign(base,{ type:'text',
      content: isVar ? '{{'+(it.varName||'variavel')+'}}' : it.content,
      font:it.font, fontSize:it.fontSize, color:it.color, textAlign:it.textAlign, isVar:isVar });
    _dPsdApplyFx(L, it);
    if(it.strikethrough){ L.strikethrough=true; }
    if(it.underline){ L.underline=true; }
    if(it.textTransform) L.textTransform=it.textTransform;
    if(it.fontWeightOverride) L.fontWeightOverride=it.fontWeightOverride;
    if(it.textBox==='box'){ L.textBox='box'; } // paragraph → editor encaixa na caixa
    if(it.vAlign) L.vAlign=it.vAlign;           // ancoragem vertical (top) importada do PSD
    if(it.italic) L.italic=true;                // font-style itálico
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
   REGRAS (a v1 salvava o modo de TODAS as camadas e contaminava PSDs diferentes):
   • só guarda DECISÃO real do usuário (modo ≠ padrão do parser);
   • nomes genéricos do Photoshop ("Retângulo 2", "Camada 5"…) nunca entram nem
     são aplicados — o "Retângulo 2" de um PSD não é o de outro;
   • reverter pro padrão APAGA a memória daquele nome.
   Chave v2 = começa limpa (a v1 estava poluída por defaults).                    ── */
const _PSD_MEM_KEY='yngs_psd_mem_v2';
// Nome default/genérico do Photoshop (pt/en) — não identifica a camada entre arquivos.
function _dPsdMemIsGeneric(key){
  return !key || /^(camada|layer|ret[âa]ngulo|rectangle|elipse|ellipse|oval|forma|shape|pol[íi]gono|polygon|linha|line|grupo|group|texto|text|imagem|image|smart\s?object|objeto\s?inteligente|frame|fundo|background)?\s*\d*(\s+c[óo]pia(\s*\d+)?|\s+copy(\s*\d+)?)?$/i.test(key);
}
function _dPsdMemLoad(){ try{ return JSON.parse(localStorage.getItem(_PSD_MEM_KEY)||'{}'); }catch(e){ return {}; } }
function _dPsdMemApply(items){
  const mem=_dPsdMemLoad(); if(!Object.keys(mem).length) return;
  items.forEach(it=>{
    const key=it.name.toLowerCase().trim().slice(0,48);
    if(_dPsdMemIsGeneric(key)) return;
    const s=mem[key]; if(!s) return;
    const validText=['text','var','raster'], validShape=['shape','raster','frame'], validRaster=['raster','frame'];
    if(s.mode&&(
      (it.kind==='text'&&validText.includes(s.mode))||
      (it.kind==='shape'&&validShape.includes(s.mode))||
      (it.kind==='raster'&&validRaster.includes(s.mode))
    )) it.mode=s.mode;
    if(s.varName&&it.kind==='text') it.varName=s.varName;
  });
}
function _dPsdMemSave(items){
  const mem=_dPsdMemLoad();
  items.forEach(it=>{
    const key=it.name.toLowerCase().trim().slice(0,48);
    if(_dPsdMemIsGeneric(key)) return;
    const isDecision=(it._defaultMode!=null && it.mode!==it._defaultMode);
    const hasVar=(it.kind==='text' && it.mode==='var' && it.varName);
    if(isDecision||hasVar){
      mem[key]={mode:it.mode};
      if(hasVar) mem[key].varName=it.varName;
    } else if(mem[key]){
      delete mem[key]; // voltou pro padrão → esquece a decisão antiga
    }
  });
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
  const _warnIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3 2.8 19h18.4L12 3Z"/><path d="M12 9v4M12 16h.01"/></svg>';
  // Badge DPI: aviso visual quando o doc não é 72dpi (fontes em pontos serão escaladas)
  const _hiDpi=dPsdMeta.res&&dPsdMeta.res>90;
  const _dpiHtml=_hiDpi
    ?`<span class="psd-dpi-warn" title="Fontes em pontos serão escaladas automaticamente (${Math.round(dPsdMeta.res)}dpi para 72dpi)">${_warnIcon}${Math.round(dPsdMeta.res)} dpi</span>`
    :(dPsdMeta.res&&dPsdMeta.res!==72?`<span class="psd-meta-chip">${Math.round(dPsdMeta.res)} dpi</span>`:'');
  // Aviso de camadas de ajuste: o Luma não aplica ajustes de cor/tom (Levels/Curves/Hue…),
  // então as cores podem diferir levemente do PSD. (Fidelidade total exigiria achatar — futuro.)
  const _adjHtml=(_dPsdAdjustCount>0)
    ?`<span class="psd-dpi-warn" title="O Photoshop tem ${_dPsdAdjustCount} camada(s) de ajuste que o Luma não reproduz; as cores podem variar.">${_warnIcon}${_dPsdAdjustCount} ajuste(s) de cor</span>`
    :'';
  const _metaEl=document.getElementById('d-psd-meta');
  if(_metaEl) _metaEl.innerHTML=`<strong class="psd-meta-name">${_dPsdEsc(dPsdMeta.name||'PSD')}</strong><span class="psd-meta-chip">${dPsdMeta.w} × ${dPsdMeta.h}px</span><span class="psd-meta-chip">${_nT} texto${_nT===1?'':'s'}</span><span class="psd-meta-chip">${_nS} forma${_nS===1?'':'s'}</span><span class="psd-meta-chip">${_nI} imagem${_nI===1?'':'ens'}</span>${_dpiHtml}${_adjHtml}`;
  // Detecção de formato com tolerância ±2px (PSDs com 1079×1921 ainda mapeiam para 'story').
  // Sem match exato → 'orig': preserva o tamanho real do PSD (1:1) em vez de forçar um preset.
  const fmt=_dPsdExactFmt(dPsdMeta.w, dPsdMeta.h);
  const sel=document.getElementById('d-psd-fmt'); if(sel) sel.value=fmt;
  const inv=document.getElementById('d-psd-invert');
  if(inv){ inv.checked=_dPsdShouldInvert(dPsdItems, dPsdMeta.w, dPsdMeta.h); inv.onchange=()=>dPsdRenderPreview(); }
  // Campo de busca (injetado dinamicamente, acima de #d-psd-rows)
  const rowsEl=document.getElementById('d-psd-rows');
  if(rowsEl&&!document.getElementById('d-psd-search')){
    const si=document.createElement('input'); si.id='d-psd-search'; si.type='search';
    si.placeholder='Buscar por nome, conteúdo, fonte ou tipo de camada'; si.className='psd-search-input';
    si.setAttribute('aria-label','Buscar camadas do PSD');
    si.oninput=()=>dPsdRenderRows(si.value.trim().toLowerCase());
    rowsEl.parentNode.insertBefore(si,rowsEl);
  }
  // Botões Todas / Nenhuma (injetados uma vez; ficam acima da lista)
  if(rowsEl&&!document.getElementById('d-psd-sel-btns')){
    const tb=document.createElement('div'); tb.id='d-psd-sel-btns'; tb.className='psd-sel-btns';
    tb.innerHTML='<button type="button" class="psd-sel-btn" onclick="dPsdSelectAll()">Selecionar todas</button><button type="button" class="psd-sel-btn" onclick="dPsdSelectNone()">Limpar seleção</button><span id="d-psd-sel-info" class="psd-sel-info" aria-live="polite"></span>';
    rowsEl.parentNode.insertBefore(tb,rowsEl);
  }
  const sf=document.getElementById('d-psd-search'); if(sf) sf.value='';
  // Canvas hover: hover sobre preview canvas → destaca camada + scroll na lista
  const _pCv=document.getElementById('d-psd-preview-canvas');
  if(_pCv&&!_pCv._psdHoverBound){
    _pCv._psdHoverBound=true;
    _pCv.addEventListener('mousemove',_dPsdCanvasHover);
    _pCv.addEventListener('mouseleave',()=>{ _dPsdLastHoverIdx=-1; dPsdHoverLayer(-1); });
  }
  _dPsdLastHoverIdx=-1;
  // Aplica memória de mapeamentos anteriores
  _dPsdMemApply(dPsdItems);
  dPsdRenderRows();
  modal.classList.add('open');
}
// Converte blend mode do ag-psd (camelCase) → CSS (kebab-case); 'normal'→'' (sem propriedade)
function _dPsdBlendModeCSS(bm){ return bm?bm.replace(/([A-Z])/g,c=>'-'+c.toLowerCase()):''; }
function dPsdRenderRows(filter){
  const wrap=document.getElementById('d-psd-rows'); if(!wrap) return;
  const ico={
    text:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 6V4h14v2M12 4v16M8 20h8"/></svg>',
    shape:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>',
    raster:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m4 17 4-4 3 3 3-3 6 5"/></svg>'
  };
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
      modeSel=`<select class="psd-mode" aria-label="Como importar a camada ${_dPsdEsc(it.name)}" onchange="dPsdSetMode(${i},this.value)">
        <option value="text" ${it.mode==='text'?'selected':''}>Texto editável</option>
        <option value="var" ${it.mode==='var'?'selected':''}>Variável {{ }}</option>
        <option value="raster" ${it.mode==='raster'?'selected':''}>Imagem fiel</option></select>`;
    } else if(it.kind==='shape'){
      modeSel=`<select class="psd-mode" aria-label="Como importar a camada ${_dPsdEsc(it.name)}" onchange="dPsdSetMode(${i},this.value)">
        <option value="shape" ${it.mode==='shape'?'selected':''}>Cor (editável)</option>
        <option value="frame" ${it.mode==='frame'?'selected':''}>Moldura de foto</option>
        <option value="raster" ${it.mode==='raster'?'selected':''}>Imagem</option></select>`;
    } else { // raster/imagem: pode virar Imagem fiel OU moldura de foto (o franqueado preenche)
      modeSel=`<select class="psd-mode" aria-label="Como importar a camada ${_dPsdEsc(it.name)}" onchange="dPsdSetMode(${i},this.value)">
        <option value="raster" ${it.mode!=='frame'?'selected':''}>Imagem</option>
        <option value="frame" ${it.mode==='frame'?'selected':''}>Moldura de foto</option></select>`;
    }
    const swatchRadius=it.shapeKind==='circle'||it.shapeKind==='ellipse'?'50%':'3px';
    const swatch=it.kind==='shape'?`<span class="psd-swatch" style="background:${it.fill};border-radius:${swatchRadius}"></span>`:'';
    const isVarVisible = (it.kind==='text'&&it.mode==='var')||(it.mode==='frame');
    const varIn=`<input class="psd-var-input ${isVarVisible?'visible':''}" value="${_dPsdEsc(it.varName||'')}" placeholder="nome_do_campo" aria-label="Nome do campo editável da camada ${_dPsdEsc(it.name)}" oninput="dPsdSetVar(${i},this.value,this)">`;
    const multiStyleBadge=(it.kind==='text'&&it.multiStyle)?`<span class="psd-multistyle" title="O estilo dominante será preservado">Estilos mistos</span>`:'';
    const blendBadge=it.blendMode?`<span class="psd-blend" title="Modo de mesclagem: ${_dPsdEsc(it.blendMode)}">Mesclagem · ${_dPsdEsc(_dPsdBlendModeCSS(it.blendMode))}</span>`:'';
    let fontWarn='';
    if(it.kind==='text'&&it.fontName&&!/roboto/i.test(it.fontName)){
      const fn=_dPsdEsc(it.fontName);
      if(it.fontRemapped) fontWarn=`<span class="psd-fontok" title="Fonte '${fn}' vinculada">Fonte vinculada · ${fn}</span>`;
      else fontWarn=`<span class="psd-fontwarn">Fonte ausente · ${fn} <label class="psd-font-upload-btn" title="Enviar '${fn}' agora">Enviar<input type="file" accept=".ttf,.otf,.woff,.woff2" style="display:none" onchange="dPsdUploadFont(${i},this)"></label></span>`;
    }
    const opacityBadge=it.opacity<95?`<span class="psd-opacity-badge">Opacidade ${it.opacity}%</span>`:'';
    const vecWarn=it.vectorMaskFailed?`<span class="psd-fontwarn" title="O recorte vetorial não pôde ser rasterizado">Máscara simplificada</span>`:'';
    const clipWarn=it.maskFallback?`<span class="psd-fontwarn" title="A forma complexa de base não pôde ser rasterizada">Recorte simplificado</span>`:'';
    const textInfoBadge=it.kind==='text'?`<span class="psd-textinfo">${it.fontSize}px · ${it.textAlign}</span>`:'';
    const thumb=it.kind==='raster'&&it.imgUrl?`<img class="psd-thumb" src="${it.imgUrl}" alt="" loading="lazy">`:'';
    const textPrev=it.kind==='text'&&it.content
      ?`<span class="psd-text-prev" style="color:${it.color||'#aaa'}">${_dPsdEsc(it.content.replace(/\n/g,' ').slice(0,60))}</span>`:'';
    const groupCrumb=it.group?`<span class="psd-group-crumb" title="Grupo: ${_dPsdEsc(it.group)}">${_dPsdEsc(it.group.slice(0,28))}</span>`:'';
    return header+`<div class="psd-row ${it.include?'':'psd-row-off'}" data-psd-idx="${i}" onmouseenter="typeof dPsdHoverLayer==='function'&&dPsdHoverLayer(${i})" onmouseleave="typeof dPsdHoverLayer==='function'&&dPsdHoverLayer(-1)">
      <input type="checkbox" aria-label="Importar camada ${_dPsdEsc(it.name)}" ${it.include?'checked':''} onchange="dPsdSetInclude(${i},this.checked)">
      <span class="psd-row-ico psd-row-ico-${it.kind}">${swatch||ico[it.kind]||ico.raster}</span>
      ${thumb}
      <span class="psd-row-name" title="${_dPsdEsc(it.name)}">
        <span class="psd-row-name-top">${_dPsdEsc(it.name)}${multiStyleBadge}${blendBadge}${fontWarn}${opacityBadge}${vecWarn}${clipWarn}${textInfoBadge}</span>
        ${groupCrumb}${textPrev}
      </span>
      ${modeSel}${varIn}</div>`;
  }).join('');
  dPsdUpdateCount();
  if(typeof dPsdRenderPreview === 'function') dPsdRenderPreview();
}
function dPsdSetMode(i,v){
  if(dPsdItems[i]){
    dPsdItems[i].mode=v;
    const row=document.querySelector(`#d-psd-rows [data-psd-idx="${i}"]`);
    if(row){
      const varIn=row.querySelector('.psd-var-input');
      if(varIn){
        const isVarVisible=(dPsdItems[i].kind==='text'&&v==='var')||(v==='frame');
        if(isVarVisible){
          varIn.classList.add('visible');
        } else {
          varIn.classList.remove('visible');
        }
      }
    }
    dPsdUpdateCount();
    if(typeof dPsdRenderPreview === 'function') dPsdRenderPreview();
  }
}
function dPsdSetVar(i,v,el){ if(dPsdItems[i]){ const clean=v.trim().replace(/[^a-zA-Z0-9_]/g,''); dPsdItems[i].varName=clean; if(el&&el.value!==clean) el.value=clean; } } // reescreve o input p/ refletir o valor sanitizado
function dPsdSetInclude(i,on){ if(dPsdItems[i]){ dPsdItems[i].include=on; const f=document.getElementById('d-psd-search'); dPsdRenderRows(f&&f.value.trim().toLowerCase()||''); } }
function dPsdSelectAll(){ dPsdItems.forEach(it=>{ if(!it.isMaskBase) it.include=true; }); const f=document.getElementById('d-psd-search'); dPsdRenderRows(f&&f.value.trim().toLowerCase()||''); }
function dPsdSelectNone(){ dPsdItems.forEach(it=>{ it.include=false; }); const f=document.getElementById('d-psd-search'); dPsdRenderRows(f&&f.value.trim().toLowerCase()||''); }
// Hover interativo sobre o canvas de preview: destaca a camada sob o cursor e rola a lista até ela.
let _dPsdLastHoverIdx=-1;
function _dPsdCanvasHover(e){
  const canvas=document.getElementById('d-psd-preview-canvas');
  if(!canvas||!dPsdMeta) return;
  const rect=canvas.getBoundingClientRect();
  const sx=dPsdMeta.w/Math.max(1,rect.width), sy=dPsdMeta.h/Math.max(1,rect.height);
  const cx=(e.clientX-rect.left)*sx, cy=(e.clientY-rect.top)*sy;
  let found=-1;
  for(let i=dPsdItems.length-1;i>=0;i--){
    const it=dPsdItems[i]; if(!it.include||it.isMaskBase) continue;
    if(cx>=it.x&&cx<=it.x+it.w&&cy>=it.y&&cy<=it.y+it.h){ found=i; break; }
  }
  if(found===_dPsdLastHoverIdx) return;
  _dPsdLastHoverIdx=found;
  dPsdHoverLayer(found);
  if(found>=0){
    const row=document.querySelector('#d-psd-rows [data-psd-idx="'+found+'"]');
    if(row) row.scrollIntoView({block:'nearest',behavior:'smooth'});
  }
}
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
    // Peso inferido do nome do arquivo — registrar "Obviously-Black.woff2" como 400
    // fazia o navegador sintetizar o peso errado no render.
    const weight=/black|heavy|900/i.test(base)?900:/extra\s?bold|800/i.test(base)?800:/bold|700/i.test(base)?700:/medium|500/i.test(base)?500:/light|300/i.test(base)?300:400;
    const f={name:base,family,dataUrl:e.target.result,weight};
    if(typeof dCustomFonts!=='undefined') dCustomFonts.push(f);
    if(typeof dFontRegister==='function') dFontRegister(f);
    if(typeof dFontsPersist==='function') dFontsPersist();
    if(typeof dFontsRenderList==='function') dFontsRenderList();
    if(typeof dPopFontSelects==='function') dPopFontSelects();
    const mapped='custom:'+family;
    const fname=(dPsdItems[layerIdx]||{}).fontName||'';
    dPsdItems.forEach(it=>{
      if(it.kind!=='text') return;
      if(it.fontName===fname){ it.font=mapped; it.fontRemapped=true; }
      // Texto rico: remapeia também os trechos (runs) que usam a mesma fonte
      if(Array.isArray(it.runs)) it.runs.forEach(run=>{ if(run._fontName===fname) run.font=mapped; });
    });
    dPsdRenderRows();
    gToast('✓ Fonte "'+base+'" enviada e aplicada às camadas');
  };
  r.readAsDataURL(file);
}
function dPsdUpdateCount(){
  // n e total no MESMO universo (sem mask-bases, que são ocultas da lista) —
  // senão o contador podia mostrar "13/12 selecionadas".
  const n=dPsdItems.filter(it=>it.include&&!it.isMaskBase).length, total=dPsdItems.filter(it=>!it.isMaskBase).length;
  const vars=dPsdItems.filter(it=>it.include&&!it.isMaskBase&&(it.mode==='var'||it.mode==='frame')).length;
  const pendingFonts=dPsdItems.filter(it=>it.include&&it.kind==='text'&&it.fontName&&!/roboto/i.test(it.fontName)&&!it.fontRemapped).length;
  const c=document.getElementById('d-psd-count'); if(c) c.textContent=n+' camada'+(n===1?'':'s');
  const info=document.getElementById('d-psd-sel-info'); if(info) info.textContent=n+' de '+total+' selecionadas';
  const summary=document.getElementById('d-psd-footer-summary');
  if(summary){
    let txt=n+' de '+total+' camadas · '+vars+' campo'+(vars===1?' editável':'s editáveis');
    if(pendingFonts) txt+=' · '+pendingFonts+' fonte'+(pendingFonts===1?' pendente':'s pendentes');
    summary.textContent=txt;
  }
  const actionLabel=document.getElementById('d-psd-action-label');
  if(actionLabel){
    const seq=dPsdMeta&&dPsdMeta.sequence;
    actionLabel.textContent=seq?(seq.current<seq.total?'Revisar e continuar':'Concluir importação'):'Importar';
  }
  const cta=document.querySelector('#d-psd-modal .psd-import-cta');
  if(cta){ cta.disabled=n===0; cta.setAttribute('aria-disabled',n===0?'true':'false'); }
}
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
  let varsChanged = false;
  // Auto-cria no catálogo TODAS as vars dos textos — inclusive tokens {{}} digitados no
  // conteúdo do PSD (texto misto), não só as camadas inteiramente ligadas (isVar).
  if(typeof dSyncVarsFromContent==='function') {
    layers.forEach(l=>{
      if(l.type==='text'&&l.content&&gVarRegex().test(l.content)) {
        if(dSyncVarsFromContent(l.content, true)) {
          varsChanged = true;
        }
      }
    });
  }
  // Auto-cria no catálogo as variáveis das molduras de foto importadas (tipo image)
  layers.forEach(l=>{
    if(l.type==='frame'&&l.imgVar){
      if(typeof dVars!=='undefined'&&dVars){
        const name=l.imgVar;
        if(!dVars.some(v=>v.name.toLowerCase()===name.toLowerCase())){
          dVars.push({name, label:name.replace(/_/g,' '), type:'image', required:false});
          varsChanged = true;
        }
      }
    }
  });
  if(varsChanged) {
    if(typeof dVarsRender==='function') dVarsRender();
    if(typeof dPersistVars === 'function') dPersistVars();
  }
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
  let outW=w, outH=h, fmt=Object.keys(DFMT_SIZES).find(k=>DFMT_SIZES[k].w===w&&DFMT_SIZES[k].h===h)||fmtChoice||'orig';
  let clone=JSON.parse(JSON.stringify(layers));
  if(typeof gEnsureAnchors==='function') gEnsureAnchors(clone,w,h);
  if(fmtChoice && fmtChoice!=='orig' && DFMT_SIZES[fmtChoice] && (DFMT_SIZES[fmtChoice].w!==w||DFMT_SIZES[fmtChoice].h!==h)){
    const to=DFMT_SIZES[fmtChoice];
    if(typeof gReflowLayers==='function') clone=gReflowLayers(clone,{w,h},to,{fmtKey:gFmtKey(fmtChoice)});
    outW=to.w; outH=to.h; fmt=fmtChoice;
  }
  const id='ab-'+Date.now();
  const ab={id,name:(name||'PSD').slice(0,30),x:80,y:60,w:outW,h:outH,fmt,dpi:dpi||72,layers:JSON.parse(JSON.stringify(clone))};
  // CANVAS ÚNICO: substitui a prancheta (como dNewArtboardCustom) — push acumulava
  // pranchetas órfãs e dGetActiveAB (que só usa dArtboards[0]) mantinha o TAMANHO antigo.
  dArtboards=[ab]; dActiveABId=id;
  // dCustomFmt: fonte da verdade do tamanho em dGetActiveAB. Sem isso, um dCustomFmt
  // velho (de um "Novo documento" anterior) vencia o formato do PSD importado; e um
  // PSD 'orig' caía nas dimensões da prancheta antiga.
  const _preset=DFMT_SIZES[fmt];
  dCustomFmt=(_preset && _preset.w===outW && _preset.h===outH) ? null : {w:outW,h:outH};
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
// Itens do PSD → layers Luma pra PREVIEW: mesma conversão do import (dItemToLayer —
// máscaras, radii, gradientes, efeitos, blend), exceto que texto marcado como
// variável mostra o TEXTO ORIGINAL do PSD (não o token {{}}), fiel ao arquivo fonte.
function _dPsdItemsToPreviewLayers(items){
  return items.map(it=>{
    const src=(it.kind==='text'&&it.mode==='var')?Object.assign({},it,{mode:'text'}):it;
    try{ return dItemToLayer(src); }catch(e){ return null; }
  }).filter(Boolean);
}
// Fallback simplificado (caixas/cores/1ª linha) — só quando o motor fiel não está disponível.
async function _dPsdDrawItemsBasic(canvas, items, w, h){
  const renderId=++canvas._renderId || (canvas._renderId=1);
  canvas.width=w; canvas.height=h;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,w,h);
  for(const it of items){
    if(canvas._renderId!==renderId) return; // abortado por render mais recente
    ctx.save();
    ctx.globalAlpha=(it.opacity!=null?it.opacity:100)/100;
    if(it.imgUrl){
      await new Promise(resolve=>{
        const img=new Image();
        img.onload=()=>{ try{ctx.drawImage(img, it.x, it.y, it.w, it.h);}catch(e){} resolve(); };
        img.onerror=resolve;
        img.src=it.imgUrl;
      });
    } else if(it.kind==='shape' && it.fill){
      ctx.fillStyle=it.fill;
      if(it.shapeKind==='circle' || it.shapeKind==='ellipse'){
        ctx.beginPath(); ctx.ellipse(it.x+it.w/2, it.y+it.h/2, it.w/2, it.h/2, 0, 0, Math.PI*2); ctx.fill();
      } else if(it.radius && ctx.roundRect){
        ctx.beginPath(); ctx.roundRect(it.x, it.y, it.w, it.h, it.radius); ctx.fill();
      } else { ctx.fillRect(it.x, it.y, it.w, it.h); }
    } else if(it.kind==='text'){
      ctx.fillStyle=it.color||'#000000';
      ctx.font=`${it.fontSize||20}px sans-serif`;
      ctx.textBaseline='top';
      ctx.textAlign=it.textAlign==='center'?'center':(it.textAlign==='right'?'right':'left');
      const tx=it.textAlign==='center'?it.x+it.w/2:(it.textAlign==='right'?it.x+it.w:it.x);
      _dPsdFillTextLines(ctx, it, tx);
    }
    ctx.restore();
  }
}
async function dPsdRenderPreview(){
  const canvas=document.getElementById('d-psd-preview-canvas');
  if(!canvas || !dPsdMeta) return;
  const inv=document.getElementById('d-psd-invert');
  // Mesmo universo do import: sem mask-bases (a máscara já está composta nos itens)
  let items=dPsdItems.filter(it=>it.include && !it.isMaskBase);
  if(inv && inv.checked) items=items.slice().reverse();
  // Caminho FIEL: converte pra layers Luma e renderiza com o motor da arte final —
  // o preview mostra exatamente o que o import vai produzir.
  if(typeof fRenderPreviewToCanvas==='function'){
    const layers=_dPsdItemsToPreviewLayers(items);
    if(layers.length){
      const ok=await fRenderPreviewToCanvas(canvas, {layers, w:dPsdMeta.w, h:dPsdMeta.h}, {maxPx:1100});
      if(ok!==false) return;
    }
  }
  await _dPsdDrawItemsBasic(canvas, items, dPsdMeta.w, dPsdMeta.h);
}
// Texto multilinha nos previews: canvas fillText ignora '\n' (glifos colados numa linha).
// Desenha linha a linha com o lineHeight do item (fallback 1.2).
function _dPsdFillTextLines(ctx, it, tx){
  const lines=String(it.content||'').split('\n');
  const lh=(it.fontSize||20)*(it.lineHeight||1.2);
  lines.forEach((ln,li)=>ctx.fillText(ln, tx, it.y+li*lh));
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
// Delega ao _dEsc global (library.js) — UM escape só (03_ENGINEERING). Mantém o
// guard de null (_dEsc faz String(null)→"null"; aqui null/undefined vira "").
function _dPsdEsc(s){ return (typeof _dEsc==='function') ? _dEsc(s==null?'':s) : String(s==null?'':s); }

function dPsdShowArtboardSelector(psd, artboards, res, baseName){
  const items=artboards.map((ab,i)=>{
    const r=ab.artboard.rect||{};
    const w=Math.max(1,Math.round((r.right||0)-(r.left||0)));
    const h=Math.max(1,Math.round((r.bottom||0)-(r.top||0)));
    return { index:i, name:(ab.name||('Prancheta '+(i+1))).toString().slice(0,48),
      w, h, left:Math.round(r.left||0), top:Math.round(r.top||0),
      fmt:_dPsdExactFmt(w,h), selected:true, layer:ab };
  });
  const overlay=document.getElementById('d-psd-ab-overlay');
  if(!overlay){ console.error('[psd] overlay d-psd-ab-overlay não encontrado'); return; }
  overlay.innerHTML=dPsdBuildArtboardSelectorHTML(items);
  overlay.style.display='flex';
  overlay._psdData={ psd, items, res:res||72, baseName:baseName||'PSD' };
  _dPsdAbUpdateCount();
  // Preview da primeira prancheta na abertura (timeout dá tempo ao DOM renderizar)
  setTimeout(()=>dPsdAbSelectPreview(0), 80);
}

function dPsdBuildArtboardSelectorHTML(items){
  const folders=(typeof dFolders!=='undefined'&&dFolders)?dFolders:[];
  const _tgt=(typeof dImportTargetFolderId!=='undefined')?dImportTargetFolderId:null;
  const folderOptions=folders.map(f=>`<option value="${_dPsdEsc(f.id)}" ${f.id===_tgt?'selected':''}>${_dPsdEsc(f.name)}</option>`).join('');
  // Opções de formato geradas dinamicamente a partir de DFMT_SIZES + 'orig'
  const _fmtKeys=typeof DFMT_SIZES!=='undefined'?Object.keys(DFMT_SIZES):['story','feed','wide','horizontal'];
  const _fmtLabel={story:'Story',feed:'Feed',wide:'Wide',horizontal:'Horizontal',orig:'Original'};
  const rows=items.map((item,i)=>{
    const fmtOpts=_fmtKeys.map(k=>`<option value="${k}" ${item.fmt===k?'selected':''}>${_fmtLabel[k]||k}</option>`).join('')
      +`<option value="orig" ${item.fmt==='orig'?'selected':''}>Original</option>`;
    return `<div class="psd-ab-row" id="psd-ab-row-${i}" onclick="dPsdAbSelectPreview(${i})">
      <label class="psd-ab-check" onclick="event.stopPropagation()">
        <input type="checkbox" aria-label="Importar prancheta ${_dPsdEsc(item.name)}" ${item.selected?'checked':''} onchange="dPsdAbToggle(${i}, this.checked)">
      </label>
      <div class="psd-ab-info">
        <span class="psd-ab-name" title="${_dPsdEsc(item.name)}">${_dPsdEsc(item.name)}</span>
        <span class="psd-ab-dim">${item.w} × ${item.h}px</span>
      </div>
      <select class="psd-ab-fmt" id="psd-ab-fmt-${i}" aria-label="Formato da prancheta ${_dPsdEsc(item.name)}" onclick="event.stopPropagation()" onchange="dPsdAbSetFmt(${i}, this.value)">${fmtOpts}</select>
    </div>`;
  }).join('');
  const dest = folders.length
    ? `<div class="psd-ab-dest"><label for="psd-ab-folder-sel"><span>Destino</span><strong>Importar para a pasta</strong></label>
        <select id="psd-ab-folder-sel" class="psd-ab-fmt">${folderOptions}</select></div>`
    : `<div class="psd-ab-dest psd-ab-dest-error"><span>Nenhuma pasta encontrada.</span><strong>Crie uma pasta antes de continuar.</strong></div>`;
  return `
    <div class="psd-ab-modal">
      <div class="psd-ab-header">
        <span class="psd-product-mark" aria-hidden="true">Ps</span>
        <div class="psd-ab-header-copy"><span class="psd-eyebrow">Importador inteligente</span><span class="psd-ab-title">Escolha as pranchetas</span><span class="psd-ab-subtitle">${items.length} prancheta${items.length===1?'':'s'} encontrada${items.length===1?'':'s'} no arquivo</span></div>
        <span class="psd-ab-step">Etapa 1 de 2</span>
        <button type="button" class="psd-close-btn" onclick="dPsdAbCancel()" aria-label="Fechar seleção de pranchetas"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </div>
      <div class="psd-ab-body">
        <div class="psd-ab-left">
          <div class="psd-ab-list">${rows}</div>
          ${dest}
        </div>
        <div class="psd-ab-right">
          <div class="psd-panel-heading"><div><span class="psd-panel-kicker">Prévia</span><strong class="psd-ab-prev-label" id="d-psd-ab-preview-label">Selecione uma prancheta</strong></div><span class="psd-fidelity-badge"><span></span>Visualização fiel</span></div>
          <div class="psd-ab-prev-wrap">
            <canvas id="d-psd-ab-preview-canvas" aria-label="Pré-visualização da prancheta selecionada"></canvas>
          </div>
        </div>
      </div>
      <div class="psd-ab-footer">
        <span class="psd-ab-footer-summary" id="d-psd-ab-summary" aria-live="polite"></span>
        <button type="button" class="psd-ab-btn cancel" onclick="dPsdAbCancel()">Cancelar</button>
        <button type="button" class="psd-ab-btn confirm" id="d-psd-ab-confirm" onclick="dPsdAbConfirm()">Revisar selecionadas</button>
      </div>
    </div>`;
}

// Preview de prancheta no seletor de artboards.
// Acionado por CLICK (não hover) para evitar renders espásticos.
// Usa dPsdParseItems lazy (parseado na 1ª seleção, cacheado em item._parsedItems)
// para cobrir shapes, texto e imagens — render em tamanho nativo, igual ao dPsdRenderPreview.
async function dPsdAbSelectPreview(itemIdx){
  const canvas=document.getElementById('d-psd-ab-preview-canvas');
  const overlay=document.getElementById('d-psd-ab-overlay');
  if(!canvas||!overlay||!overlay._psdData) return;
  const {items,res}=overlay._psdData;
  const item=items[itemIdx]; if(!item) return;

  // Highlight row ativa
  document.querySelectorAll('.psd-ab-row').forEach((r,i)=>r.classList.toggle('active',i===itemIdx));
  const lbl=document.getElementById('d-psd-ab-preview-label');
  if(lbl) lbl.textContent=item.name+' · '+item.w+'×'+item.h+'px';

  // Parse lazy: só na primeira seleção desta prancheta
  if(!item._parsedItems){
    item._parsedItems=dPsdParseItems(
      {children:(item.layer&&item.layer.children)||[]},
      res||72, item.left, item.top
    );
  }
  const parsed=item._parsedItems;

  if(!parsed.length){ canvas.width=item.w; canvas.height=item.h; canvas.getContext('2d').clearRect(0,0,item.w,item.h); return; }
  // Z-order: dPsdParseItems devolve topo-primeiro, mas nem sempre (depende do PSD). Em vez de
  // reverter de forma fixa (quebrava desenhando o fundo por último → bloco sólido), usa a MESMA
  // heurística do preview principal (_dPsdShouldInvert): só inverte quando o fundo está no final.
  const toRender=_dPsdShouldInvert(parsed, item.w, item.h) ? [...parsed].reverse() : parsed;
  const usable=toRender.filter(it=>!it.isMaskBase); // máscara já composta nos itens
  // Caminho FIEL: motor da arte final (máscaras, radii, gradientes, efeitos, blend) —
  // o preview da prancheta fica idêntico ao que o import produz.
  if(typeof fRenderPreviewToCanvas==='function'){
    const layers=_dPsdItemsToPreviewLayers(usable);
    if(layers.length){
      const ok=await fRenderPreviewToCanvas(canvas, {layers, w:item.w, h:item.h}, {maxPx:1100});
      if(ok!==false) return;
    }
  }
  await _dPsdDrawItemsBasic(canvas, usable, item.w, item.h);
}
function _dPsdAbUpdateCount(){
  const o=document.getElementById('d-psd-ab-overlay');
  if(!o||!o._psdData) return;
  const total=o._psdData.items.length;
  const selected=o._psdData.items.filter(it=>it.selected).length;
  const summary=document.getElementById('d-psd-ab-summary');
  if(summary) summary.textContent=selected+' de '+total+' prancheta'+(total===1?'':'s')+' selecionada'+(selected===1?'':'s');
  const btn=document.getElementById('d-psd-ab-confirm');
  if(btn){ btn.textContent=selected?'Revisar '+selected+' selecionada'+(selected===1?'':'s'):'Selecione uma prancheta'; btn.disabled=selected===0; }
}
function dPsdAbToggle(index, checked){
  const o=document.getElementById('d-psd-ab-overlay');
  if(o&&o._psdData&&o._psdData.items[index]){
    o._psdData.items[index].selected=checked;
    const row=document.getElementById('psd-ab-row-'+index); if(row) row.classList.toggle('is-unselected',!checked);
    _dPsdAbUpdateCount();
  }
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
  dPsdMeta={w:item.w, h:item.h, name:item.name, res:res||72, sequence:{current:idx+1,total:items.length}}; // res → badge de DPI na revisão
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
  if(!folder){ gToast('⚠ Pasta não encontrada — selecione outra campanha','error'); return; }
  // Pranchetas com o MESMO nome viram templates indistinguíveis — o designer edita um
  // variante achando que é o outro. Sufixa o formato só quando o nome colide.
  const _nameCount={};
  results.forEach(r=>{ const k=(r.name||'').toLowerCase().trim(); _nameCount[k]=(_nameCount[k]||0)+1; });
  const _fmtSuffix={story:'Story',feed:'Feed',wide:'Wide',horizontal:'Horizontal',orig:'Original'};
  results.forEach((r,i)=>{
    // 'orig' (sem match exato) preserva o tamanho REAL do PSD — 1:1. Era forçado a 'story'.
    const fmt=DFMT_SIZES[r.fmt]?r.fmt:'orig';
    // _dPsdReflowToFmt só reflua quando DFMT_SIZES[fmt] existe; p/ 'orig' mantém coords nativas.
    const layers=_dPsdReflowToFmt(r.layers, r.nativeW, r.nativeH, fmt);
    // Tamanho do espaço de coordenadas das layers = onde elas vivem (preset reflua, ou nativo p/ orig).
    const sz=DFMT_SIZES[fmt]||{w:r.nativeW, h:r.nativeH};
    let _tname=(r.name||baseName||'Prancheta').toString();
    if(_nameCount[(_tname||'').toLowerCase().trim()]>1) _tname+=' — '+(_fmtSuffix[fmt]||fmt);
    const tmpl={
      id:'tmpl-psd-'+Date.now()+'-'+i+'-'+Math.random().toString(36).slice(2,7),
      name:_tname.slice(0,30),
      fmt:fmt,
      w:sz.w, h:sz.h, // tamanho real do template — o gerador do franqueado renderiza 1:1 quando presente
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

/* ── estado de leitura e análise do arquivo ── */
function _dPsdBusy(on,file){
  let el=document.getElementById('d-psd-busy');
  if(on){
    if(!el){ el=document.createElement('div'); el.id='d-psd-busy';
      el.setAttribute('role','status'); el.setAttribute('aria-live','polite');
      el.innerHTML='<div class="d-psd-busy-box"><div class="d-psd-busy-head"><span class="psd-product-mark" aria-hidden="true">Ps</span><div class="d-psd-busy-copy"><strong>Preparando seu arquivo</strong><span id="d-psd-busy-file">PSD</span></div></div><div class="d-psd-busy-progress" aria-hidden="true"><span></span></div><div class="d-psd-busy-stage"><strong id="d-psd-busy-stage">Verificando o arquivo…</strong><span>Isso pode levar alguns segundos</span></div></div>';
      document.body.appendChild(el); }
    const fileEl=document.getElementById('d-psd-busy-file');
    if(fileEl&&file){
      const mb=file.size/(1024*1024);
      fileEl.textContent=file.name+' · '+(mb>=1?mb.toFixed(1)+' MB':Math.max(1,Math.round(file.size/1024))+' KB');
    }
    _dPsdBusyUpdate('Verificando o arquivo…');
    el.style.display='flex';
  } else if(el){ el.style.display='none'; }
}
function _dPsdBusyUpdate(message){
  const stage=document.getElementById('d-psd-busy-stage'); if(stage) stage.textContent=message;
}

/* ── handler do input ── */
async function dImportPSD(input){
  const file=input.files && input.files[0];
  input.value='';
  if(!file) return;
  if(!/\.psd$/i.test(file.name)){ gToast('Selecione um arquivo .psd','error'); return; }
  if(file.size > 200*1024*1024){ gToast('⚠ PSD muito grande (máx ~200MB)','error'); return; }
  _dPsdBusy(true,file);
  let agPsd;
  try{ agPsd=await dLoadAgPsd(); }catch(e){ _dPsdBusy(false); console.error('PSD lib:',e); gToast('⚠ Não foi possível carregar o leitor de PSD — recarregue a página','error'); return; }
  _dPsdBusyUpdate('Lendo estrutura, imagens e fontes…');
  let buf;
  try{ buf=await file.arrayBuffer(); }catch(e){ _dPsdBusy(false); gToast('⚠ Não foi possível ler o arquivo — verifique se é um .psd válido','error'); return; }
  let result;
  try{ result=await _dPsdReadPsd(buf, agPsd); }
  catch(e){ result={error:e}; }
  if(!result || result.error || !result.psd || !result.psd.width){
    _dPsdBusy(false); console.error('PSD:',result&&result.error); gToast('⚠ Não foi possível ler este PSD (formato não suportado)','error'); return;
  }
  try{
    _dPsdBusyUpdate('Preparando camadas editáveis…');
    const baseName=file.name.replace(/\.psd$/i,'');
    // PSD com múltiplas pranchetas (artboards) → tela de seleção antes da revisão.
    const artboards=(result.psd.children||[]).filter(c=>c && c.artboard && c.artboard.rect);
    if(artboards.length>1){
      _dPsdBusy(false);
      dPsdShowArtboardSelector(result.psd, artboards, result.res||72, baseName);
      return;
    }
    if(artboards.length===1){
      // Prancheta única: usa rect da artboard como dimensões e offset.
      // Sem isso, PSDs exportados de docs multi-artboard herdariam o tamanho do doc inteiro.
      const abNode=artboards[0], r=abNode.artboard.rect;
      const abL=Math.round(r.left||0), abT=Math.round(r.top||0);
      const abW=Math.max(1,Math.round((r.right||0)-(r.left||0)));
      const abH=Math.max(1,Math.round((r.bottom||0)-(r.top||0)));
      dPsdItems=dPsdParseItems(result.psd, result.res||72, abL, abT);
      dPsdMeta={w:abW, h:abH, name:baseName, res:result.res||72, worker:result.worker===true};
    } else {
      // PSD simples sem artboards.
      dPsdItems=dPsdParseItems(result.psd, result.res||72);
      dPsdMeta={w:result.psd.width, h:result.psd.height, name:baseName, res:result.res||72, worker:result.worker===true};
    }
    _dPsdBusy(false);
    if(!dPsdItems.length){ gToast('⚠ Nenhuma camada utilizável neste PSD','error'); return; }
    dPsdOpenReview();
  }catch(e){ _dPsdBusy(false); console.error('PSD parse:',e); gToast('⚠ Não foi possível interpretar as camadas do PSD','error'); }
}
