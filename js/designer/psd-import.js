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
  const nLines=Math.max(1, String(content||'').split('\n').filter(x=>x.trim()).length);
  const boxFs=h/(nLines*1.25); // estimativa pela caixa (independe de DPI)
  if(fs>=4 && fs<=4000){
    if(res>90 && fs < boxFs*0.55) fs=fs*(res/72);      // style em pontos + doc hi-res → escala
    if(fs < boxFs*0.4 || fs > boxFs*2.5) fs=boxFs;       // ainda incoerente → usa a caixa
    return Math.round(Math.max(6,fs));
  }
  return Math.round(Math.max(6,boxFs));
}
// #2 — sombra + contorno a partir de layer.effects
function _dPsdEffects(node){
  const fx=node.effects||{}; const out={};
  let ds=fx.dropShadow; if(Array.isArray(ds)) ds=ds[0];
  if(ds && ds.enabled!==false){
    const hex=_dPsdHex(ds.color)||'#000000';
    const op=ds.opacity!=null?ds.opacity:.5;
    out.shadow=true;
    out.shadowColor='rgba('+parseInt(hex.slice(1,3),16)+','+parseInt(hex.slice(3,5),16)+','+parseInt(hex.slice(5,7),16)+','+(+op).toFixed(2)+')';
  }
  let st=fx.stroke; if(Array.isArray(st)) st=st[0];
  if(st && st.enabled!==false){
    out.strokeW=Math.max(1,Math.round((st.size&&st.size.value)||st.size||2));
    out.strokeColor=_dPsdHex((st.color&&(st.color.color||st.color)))||'#000000';
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
    return out.toDataURL('image/png');
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
  + "function strip(n){var o={name:n.name,left:n.left,top:n.top,right:n.right,bottom:n.bottom,hidden:n.hidden,opacity:n.opacity,text:n.text,effects:n.effects,artboard:n.artboard,clipping:n.clipping};"
  + "if(n.imageData&&n.imageData.data){o._img={w:n.imageData.width,h:n.imageData.height,buf:n.imageData.data.buffer};transfers.push(n.imageData.data.buffer);}"
  + "if(n.mask&&n.mask.imageData&&n.mask.imageData.data){o._mask={w:n.mask.imageData.width,h:n.mask.imageData.height,buf:n.mask.imageData.data.buffer,left:n.mask.left,top:n.mask.top,defaultColor:n.mask.defaultColor,disabled:n.mask.disabled};transfers.push(n.mask.imageData.data.buffer);}"
  + "if(n.children)o.children=n.children.map(strip);return o;}"
  + "var res=(psd.imageResources&&psd.imageResources.resolutionInfo&&psd.imageResources.resolutionInfo.horizontalResolution)||72;"
  + "if(res&&res.value)res=res.value;"
  + "self.postMessage({ok:true,tree:{width:psd.width,height:psd.height,res:res,children:(psd.children||[]).map(strip)}},transfers);"
  + "}catch(err){self.postMessage({ok:false,error:String(err)});}};";

function _dPsdRebuildNode(node){
  const n={name:node.name,left:node.left,top:node.top,right:node.right,bottom:node.bottom,hidden:node.hidden,opacity:node.opacity,text:node.text,effects:node.effects,artboard:node.artboard,clipping:node.clipping};
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
      try{ const psd=agPsd.readPsd(buffer,{useImageData:false,skipLayerImaging:false}); resolve({psd:psd, res:_dPsdResolution(psd)}); }
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
          resolve({psd:{width:tree.width,height:tree.height,children:(tree.children||[]).map(_dPsdRebuildNode)}, res:(+tree.res)||72});
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

/* ── PSD → itens intermediários (modo escolhível na revisão) ── */
let dPsdItems=[]; let dPsdMeta=null;
// Callback opcional da revisão (fluxo multi-prancheta). Quando setado, dPsdConfirmImport
// encaminha as layers pra ele em vez de criar uma prancheta solta no editor.
let _dPsdReviewOnConfirm=null;
// ox/oy: offset de origem (usado em artboards p/ normalizar coords pra (0,0) da prancheta).
function dPsdParseItems(psd, res, ox, oy){
  ox=ox||0; oy=oy||0;
  const items=[]; let n=0; let prevLeaf=null;
  (function walk(nodes){
    (nodes||[]).forEach(node=>{
      if(node.children && node.children.length){ walk(node.children); return; }
      const x=Math.round((node.left||0)-ox), y=Math.round((node.top||0)-oy);
      const w=Math.max(1,Math.round((node.right||0)-(node.left||0)));
      const h=Math.max(1,Math.round((node.bottom||0)-(node.top||0)));
      const it={ n:++n, name:(node.name||('Camada '+n)).toString().slice(0,48),
        x,y,w,h, visible:node.hidden?false:true, opacity:Math.round((node.opacity!=null?node.opacity:1)*100),
        include:node.hidden?false:true, mask:_dPsdComputeMask(node, prevLeaf) }; // máscara + clipping
      prevLeaf=node; // base p/ a próxima camada com clipping
      if(node.text && node.text.text!=null && String(node.text.text).trim()!==''){
        const t=node.text, st=_dPsdTextStyle(t), sv=_dPsdSuggestVar(node.name, t.text);
        it.kind='text';
        it.content=String(t.text).replace(/\r\n?/g,'\n');
        it.font=/black|900|heavy/i.test(st.font&&st.font.name||'')?"'Roboto Black'":/bold|700/i.test(st.font&&st.font.name||'')?"'Roboto',bold":"'Roboto'";
        it.fontName=(st.font&&st.font.name)||'';
        it.fontSize=_dPsdFontSize(t,h,it.content,res);
        it.color=_dPsdHex(st.fillColor||st.color)||'#000000';
        it.textAlign=_dPsdAlign(t);
        Object.assign(it,_dPsdEffects(node));
        it.varName=sv.name;
        it.mode=sv.auto?'var':'text';
        if(node.canvas && node.canvas.width>0){ it.imgUrl=_dPsdRasterURL(node.canvas); } // p/ "imagem fiel"
      } else if(node.canvas && node.canvas.width>0 && node.canvas.height>0){
        const solid=_dPsdSolidColor(node.canvas);
        if(solid){ it.kind='shape'; it.fill=solid; it.mode='shape'; }
        else { it.kind='raster'; it.mode='raster'; it.imgUrl=_dPsdRasterURL(node.canvas); if(!it.imgUrl) return; }
      } else { return; }
      items.push(it);
    });
  })(psd.children);
  return items;
}

function dItemToLayer(it){
  const base={ id:'l-psd-'+it.n+'-'+(it.x+it.y), name:it.name, x:it.x,y:it.y,w:it.w,h:it.h, visible:it.visible, opacity:it.opacity };
  if(it.mask) base.mask=it.mask;   // máscara de camada (alpha) trazida do PSD
  if(it.kind==='text'){
    if(it.mode==='raster' && it.imgUrl) return Object.assign(base,{type:'image',imgUrl:it.imgUrl,imgVar:'',objectFit:'cover',frameShape:'rect'});
    const isVar=it.mode==='var';
    const L=Object.assign(base,{ type:'text',
      content: isVar ? '{{'+(it.varName||'variavel')+'}}' : it.content,
      font:it.font, fontSize:it.fontSize, color:it.color, textAlign:it.textAlign, isVar:isVar });
    if(it.shadow){ L.shadow=true; L.shadowColor=it.shadowColor; }
    if(it.strokeW){ L.strokeW=it.strokeW; L.strokeColor=it.strokeColor; }
    return L;
  }
  if(it.kind==='shape' && it.mode==='shape') return Object.assign(base,{type:'shape',fill:it.fill||'#FF9000',radius:0});
  return Object.assign(base,{type:'image',imgUrl:it.imgUrl,imgVar:'',objectFit:'cover',frameShape:'rect'});
}

/* ── tela de revisão ── */
function dPsdOpenReview(){
  const modal=document.getElementById('d-psd-modal'); if(!modal) return;
  document.getElementById('d-psd-meta').textContent=(dPsdMeta.name||'PSD')+' · '+dPsdMeta.w+'×'+dPsdMeta.h+' · '+dPsdItems.length+' camadas'+(dPsdMeta.worker?' · worker':'');
  const fmt=Object.keys(DFMT_SIZES).find(k=>DFMT_SIZES[k].w===dPsdMeta.w&&DFMT_SIZES[k].h===dPsdMeta.h)||'orig';
  const sel=document.getElementById('d-psd-fmt'); if(sel) sel.value=fmt;
  const inv=document.getElementById('d-psd-invert'); if(inv) inv.checked=false;
  dPsdRenderRows();
  modal.classList.add('open');
}
function dPsdRenderRows(){
  const wrap=document.getElementById('d-psd-rows'); if(!wrap) return;
  const ico={text:'T',shape:'■',raster:'▣'};
  wrap.innerHTML=dPsdItems.map((it,i)=>{
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
    const swatch=it.kind==='shape'?`<span class="psd-swatch" style="background:${it.fill}"></span>`:'';
    const varIn=`<input class="psd-var-input" value="${it.varName||''}" placeholder="nome_da_var" oninput="dPsdSetVar(${i},this.value)" style="display:${it.kind==='text'&&it.mode==='var'?'inline-block':'none'}">`;
    const fontWarn=(it.kind==='text'&&it.fontName&&!/roboto/i.test(it.fontName))?`<span class="psd-fontwarn" title="Fonte '${it.fontName}' não disponível — usando Roboto. Envie a fonte na aba Assets.">⚠ ${it.fontName}</span>`:'';
    return `<div class="psd-row ${it.include?'':'psd-row-off'}">
      <input type="checkbox" ${it.include?'checked':''} onchange="dPsdSetInclude(${i},this.checked)">
      <span class="psd-row-ico">${swatch||ico[it.kind]||'▣'}</span>
      <span class="psd-row-name" title="${it.name}">${it.name}${fontWarn}</span>
      ${modeSel}${varIn}</div>`;
  }).join('');
  dPsdUpdateCount();
}
function dPsdSetMode(i,v){ if(dPsdItems[i]){ dPsdItems[i].mode=v; dPsdRenderRows(); } }
function dPsdSetVar(i,v){ if(dPsdItems[i]) dPsdItems[i].varName=v.trim().replace(/[^a-zA-Z0-9_]/g,''); }
function dPsdSetInclude(i,on){ if(dPsdItems[i]){ dPsdItems[i].include=on; dPsdRenderRows(); } }
function dPsdUpdateCount(){ const c=document.getElementById('d-psd-count'); if(c) c.textContent='('+dPsdItems.filter(it=>it.include).length+')'; }
function dPsdCancel(){
  const m=document.getElementById('d-psd-modal'); if(m)m.classList.remove('open');
  const wasSeq=!!_dPsdReviewOnConfirm; // cancelar no meio da sequência aborta tudo
  dPsdItems=[]; dPsdMeta=null; _dPsdReviewOnConfirm=null;
  if(wasSeq) gToast('Importação de pranchetas cancelada');
}
function dPsdConfirmImport(){
  const chosen=dPsdItems.filter(it=>it.include);
  if(!chosen.length){ gToast('Selecione ao menos uma camada','error'); return; }
  let layers=chosen.map(dItemToLayer).filter(Boolean);
  // #4a — inverter z-order se a ordem do PSD vier trocada
  const inv=document.getElementById('d-psd-invert'); if(inv&&inv.checked) layers=layers.reverse();
  if(typeof dSyncVarsFromContent==='function') layers.forEach(l=>{ if(l.type==='text'&&l.isVar) dSyncVarsFromContent(l.content); });
  const fmtChoice=(document.getElementById('d-psd-fmt')||{}).value||'orig';
  document.getElementById('d-psd-modal').classList.remove('open');
  // Fluxo multi-prancheta: encaminha as layers pro callback (cria template) e não cria prancheta.
  if(_dPsdReviewOnConfirm){
    const cb=_dPsdReviewOnConfirm; _dPsdReviewOnConfirm=null;
    const w=dPsdMeta.w, h=dPsdMeta.h;
    dPsdItems=[]; dPsdMeta=null;
    cb(layers, fmtChoice, w, h);
    return;
  }
  dImportLayersAsArtboard(dPsdMeta.w, dPsdMeta.h, layers, dPsdMeta.name, fmtChoice);
  const nVar=layers.filter(l=>l.isVar).length, nTxt=layers.filter(l=>l.type==='text').length;
  gToast('✓ PSD importado: '+layers.length+' camadas · '+nTxt+' texto · '+nVar+' variável(is)');
  dPsdItems=[]; dPsdMeta=null;
}

/* ── cria a prancheta (com reflow opcional pro formato — 5.2) ── */
function dImportLayersAsArtboard(w,h,layers,name,fmtChoice){
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
  const ab={id,name:(name||'PSD').slice(0,30),x,y,w:outW,h:outH,fmt,layers:JSON.parse(JSON.stringify(clone))};
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
  const folderOptions=folders.map(f=>`<option value="${_dPsdEsc(f.id)}">${_dPsdEsc(f.name)}</option>`).join('');
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
    dPsdMeta={w:result.psd.width, h:result.psd.height, name:baseName};
    _dPsdBusy(false);
    if(!dPsdItems.length){ gToast('⚠ Não encontrei camadas utilizáveis nesse PSD','error'); return; }
    dPsdOpenReview();
  }catch(e){ _dPsdBusy(false); console.error('PSD parse:',e); gToast('⚠ Falha ao interpretar as camadas do PSD','error'); }
}
