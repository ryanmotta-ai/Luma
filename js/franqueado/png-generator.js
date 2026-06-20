/**
 * js/franqueado/png-generator.js
 *
 * Geracao de PNG a partir dos templates: fGenPNG, fRenderTemplateLayers,
 * fBaixar, fOutroFormato. Sistema de nomenclatura padronizado para downloads.
 * Depende de: 00-config.js, 01-state.js, designer/canvas.js (dRenderCanvas)
 */

/* ── PNG DOWNLOAD ── */
// Cache da imagem de logo (carregada uma vez)
let _fLogoBrancaImg = null;
function fLoadLogoBranca(){
  return new Promise((resolve)=>{
    if(_fLogoBrancaImg && _fLogoBrancaImg.complete){ resolve(_fLogoBrancaImg); return; }
    const cssVal = getComputedStyle(document.documentElement).getPropertyValue('--logo-h-branca').trim();
    // cssVal vem como `url("data:image/png;base64,...")` — extrai o data URL
    const m = cssVal.match(/url\(["']?([^"')]+)["']?\)/);
    if(!m){ resolve(null); return; }
    const img = new Image();
    img.onload = ()=>{ _fLogoBrancaImg = img; resolve(img); };
    img.onerror = ()=>resolve(null);
    img.src = m[1];
  });
}
async function fRenderCanvasHelper(d,c,fmt){
  const fmtMap={story:[1080,1920],feed:[1080,1080],post:[1200,628],wide:[1200,628]};
  const [w,h]=fmtMap[fmt.id]||[1080,1920];

  // ─── CAMINHO NOVO: renderiza layers do template publicado pelo designer ───
  if(fState.material && fState.material.layers && fState.material.layers.length){
    // Super-sampling: renderiza em 2x e downscale pra ganhar nitidez
    const SCALE = 2;
    const renderCv = document.createElement('canvas');
    renderCv.width = w * SCALE;
    renderCv.height = h * SCALE;
    const renderCtx = renderCv.getContext('2d');
    renderCtx.scale(SCALE, SCALE);
    await fRenderTemplateLayers(renderCtx, fState.material.layers, w, h, d, c);
    await fDrawDMLogo(renderCtx, w, h);
    // Downscale com alta qualidade pro canvas final
    const finalCv = document.createElement('canvas');
    finalCv.width = w; finalCv.height = h;
    const finalCtx = finalCv.getContext('2d');
    finalCtx.imageSmoothingEnabled = true;
    finalCtx.imageSmoothingQuality = 'high';
    finalCtx.drawImage(renderCv, 0, 0, w, h);
    return finalCv;
  }

  // ─── FALLBACK: renderer programático antigo (quando não há material) ───
  const cv=document.createElement('canvas');cv.width=w;cv.height=h;
  const ctx=cv.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle=c.color;ctx.fillRect(0,0,w,h);
  ctx.fillStyle='rgba(255,255,255,.07)';
  ctx.beginPath();ctx.arc(w*.85,h*.15,w*.4,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(w*.1,h*.85,w*.25,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(255,185,0,.3)';ctx.lineWidth=w*.024;
  ctx.beginPath();ctx.arc(w*.5,h*.07,w*.38,0,Math.PI);ctx.stroke();
  const cx=w/2;
  const U=Math.min(w,h);

  const fotoProduto = d.foto_produto;
  let topOffset = 0.22;
  if(fotoProduto && fotoProduto.startsWith && fotoProduto.startsWith('data:image')){
    try {
      const fotoImg = await fLoadImageDataUrl(fotoProduto);
      if(fotoImg && fotoImg.width){
        const fW = w * 0.78, fH = h * 0.32;
        const fX = (w - fW) / 2, fY = h * 0.05;
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        roundedRect(ctx, fX-8, fY-8, fW+16, fH+16, 18);
        ctx.fill();
        ctx.save();
        roundedRect(ctx, fX, fY, fW, fH, 14);
        ctx.clip();
        const imgAR = fotoImg.width / fotoImg.height, frameAR = fW / fH;
        let drawW, drawH, drawX, drawY;
        if(imgAR > frameAR){ drawH = fH; drawW = fH * imgAR; drawX = fX - (drawW - fW)/2; drawY = fY; }
        else { drawW = fW; drawH = fW / imgAR; drawX = fX; drawY = fY - (drawH - fH)/2; }
        ctx.drawImage(fotoImg, drawX, drawY, drawW, drawH);
        ctx.restore();
        topOffset = 0.43;
      }
    } catch(e) { console.warn('Erro foto:', e); }
  }

  ctx.fillStyle='rgba(255,255,255,.6)';ctx.font=`700 ${Math.round(U*.026)}px sans-serif`;ctx.textAlign='center';
  ctx.fillText(c.name.toUpperCase()+' · '+fmt.name.toUpperCase(),cx,h*topOffset);
  const prod=(d.produto||d.categoria||d.brinde||d.oferta||c.name).toUpperCase();
  ctx.fillStyle='#FFF';ctx.font=`900 ${Math.round(U*.1)}px sans-serif`;ctx.fillText(prod,cx,h*(topOffset+0.08));
  if(d.precoDe){
    ctx.fillStyle='rgba(255,255,255,.55)';ctx.font=`400 ${Math.round(U*.044)}px sans-serif`;
    const dy=h*(topOffset+0.18);ctx.fillText('De '+d.precoDe,cx,dy);
    const tw=ctx.measureText('De '+d.precoDe).width;
    ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(cx-tw/2,dy-5);ctx.lineTo(cx+tw/2,dy-5);ctx.stroke();
  }
  const por=d.precoPor||d.desconto||'';
  if(por){ctx.fillStyle='#FFB900';ctx.font=`900 ${Math.round(U*.13)}px sans-serif`;ctx.fillText(por,cx,h*(topOffset+(d.precoDe?.32:.25)));}
  if(d.validade){ctx.fillStyle='rgba(255,255,255,.45)';ctx.font=`300 ${Math.round(U*.024)}px sans-serif`;ctx.fillText('*'+d.validade+'. Consulte a loja.',cx,h*.83);}

  const logoLoja = d.logo_loja;
  if(logoLoja && logoLoja.startsWith && logoLoja.startsWith('data:image')){
    try {
      const logoLojaImg = await fLoadImageDataUrl(logoLoja);
      if(logoLojaImg && logoLojaImg.width){
        const lW = w * 0.14, lH = lW * (logoLojaImg.height / logoLojaImg.width);
        const lX = w - lW - w*0.04, lY = h*0.04;
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        roundedRect(ctx, lX-8, lY-8, lW+16, lH+16, 8);
        ctx.fill();
        ctx.drawImage(logoLojaImg, lX, lY, lW, lH);
      }
    } catch(e){}
  }

  await fDrawDMLogo(ctx, w, h);
  return cv;
}

async function fGenPNG(d,c,fmt){
  const canvas = await fRenderCanvasHelper(d,c,fmt);
  const a=document.createElement('a');
  a.download=fBuildFilename(c,fmt,d);
  a.href=canvas.toDataURL('image/png');
  a.click();
}

async function fGenPDF(d,c,fmt){
  if(!window.PDFLib) {
    throw new Error('Biblioteca pdf-lib não está disponível.');
  }
  const canvas = await fRenderCanvasHelper(d,c,fmt);
  const pngDataUrl = canvas.toDataURL('image/png');
  
  // Cria documento PDF
  const pdfDoc = await PDFLib.PDFDocument.create();
  
  // Adiciona página com tamanho exato do canvas em pontos (pixels mapeados 1:1 para pontos PDF)
  const page = pdfDoc.addPage([canvas.width, canvas.height]);
  
  // Embutir a imagem PNG gerada
  const pngImage = await pdfDoc.embedPng(pngDataUrl);
  
  // Desenhar a imagem na página
  page.drawImage(pngImage, {
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height
  });
  
  // Salva o PDF
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  
  // Download
  const a = document.createElement('a');
  a.download = fBuildFilename(c,fmt,d).replace(/\.png$/i, '') + '.pdf';
  a.href = URL.createObjectURL(blob);
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}

// Renderiza a logo Luma branca no rodapé (compartilhado entre os dois caminhos)
async function fDrawDMLogo(ctx, w, h){
  const logoImg = await fLoadLogoBranca();
  const cx = w/2;
  if(logoImg && logoImg.width){
    const logoW = w * 0.22;
    const logoH = logoW / 3.065; // proporção da logo Luma (540.65 / 176.37)
    ctx.globalAlpha = 0.9;
    ctx.drawImage(logoImg, cx - logoW/2, h*.93 - logoH/2, logoW, logoH);
    ctx.globalAlpha = 1.0;
  }
}

// Renderiza os layers do template, substituindo {{var}} pelos dados reais do franqueado
async function fRenderTemplateLayers(ctx, layers, W, H, dados, camp){
  // Garante que as fontes (Roboto + enviadas pelo usuário) estejam carregadas antes
  // de desenhar texto no canvas — senão a primeira geração sai com fonte fallback.
  if(document.fonts && document.fonts.ready){ try{ await document.fonts.ready; }catch(e){} }
  // Quality flags pra anti-aliasing e renderização nítida
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // Fundo da prancheta/campanha
  const _matBg=typeof fState!=='undefined'&&fState.material&&fState.material.bg&&fState.material.bg!=='transparent'?fState.material.bg:null;
  if(_matBg){
    ctx.fillStyle=_matBg==='white'?'#ffffff':_matBg;
    ctx.fillRect(0,0,W,H);
  }else{
    const hasBackground=layers.some(l=>l.type==='shape'&&l.x===0&&l.y===0&&l.w>=W*0.9&&l.h>=H*0.9);
    if(!hasBackground){ctx.fillStyle=camp.color||'#FF9000';ctx.fillRect(0,0,W,H);}
  }
  // Os layers do designer foram criados num canvas com tamanho fixo (fmt do template).
  // 5.2: formato diferente → SMART RESIZE (gReflowLayers re-ancora sem distorcer),
  // em vez do antigo scaleX/scaleY que esticava shapes e textos.
  const fmtSizes = {story:[1080,1920], feed:[1080,1080], wide:[1200,628], post:[1200,628]};
  const tmplFmt = fState.material?.fmt || 'story';
  const [tw, th] = fmtSizes[tmplFmt] || [1080,1920];
  let geomLayers = layers;
  if((tw !== W || th !== H) && typeof gReflowLayers === 'function'){
    const fmtKey = Object.keys(fmtSizes).find(k => fmtSizes[k][0]===W && fmtSizes[k][1]===H);
    geomLayers = gReflowLayers(layers, {w:tw,h:th}, {w:W,h:H}, {fmtKey: fmtKey ? gFmtKey(fmtKey) : null});
  }
  // Aplica bindings (4.1) e regras condicionais (4.2) ANTES de filtrar visibilidade.
  const _defaults = (typeof gVarDefaults==='function') ? gVarDefaults() : null;
  const effective = geomLayers.map(l=>{
    let eff = (typeof gApplyBindings==='function') ? gApplyBindings(l, dados, {defaults:_defaults}) : l;
    if(typeof gApplyRules==='function') eff = gApplyRules(eff, dados, {defaults:_defaults});
    return eff;
  });
  // Renderiza só layers visíveis (geometria já está no formato alvo → escala 1:1)
  const visible = effective.filter(l => l.visible !== false);
  for(const l of visible){
    const _bm=l.blendMode&&l.blendMode!=='normal'?l.blendMode:'normal';
    const _native=(typeof dBlendToComposite==='function')?dBlendToComposite(_bm):null;
    // Modos sem equivalente nativo no Canvas 2D → fallback pixel-a-pixel via dBlendImageData
    const _needsSw=_bm!=='normal'&&_native===null&&typeof dBlendImageData==='function';
    if(l.mask||_needsSw){
      // Ambos os casos precisam de offscreen: máscara e/ou blend software
      const oc=document.createElement('canvas'); oc.width=W; oc.height=H;
      const octx=oc.getContext('2d');
      try{ octx.setTransform(ctx.getTransform()); }catch(e){}
      octx.imageSmoothingEnabled=true; octx.imageSmoothingQuality='high';
      // Renderiza no offscreen sem blend (source-over) — blend aplicado abaixo
      const _lNoBm=_needsSw?Object.assign({},l,{blendMode:'normal'}):l;
      await fRenderOneLayer(octx, _lNoBm, dados, 1, 1);
      if(l.mask){
        try{
          const mimg=await fLoadImageDataUrl(l.mask);
          if(mimg){ octx.save(); octx.globalCompositeOperation='destination-in'; octx.drawImage(mimg,l.x,l.y,l.w,l.h); octx.restore(); }
        }catch(e){}
      }
      if(_needsSw){
        // Blend pixel-a-pixel restrito à bbox do layer
        const bx=Math.max(0,Math.round(l.x)), by=Math.max(0,Math.round(l.y));
        const bw=Math.min(W-bx,Math.max(1,Math.round(l.w)));
        const bh=Math.min(H-by,Math.max(1,Math.round(l.h)));
        if(bw>0&&bh>0){
          const topData=octx.getImageData(bx,by,bw,bh);
          const botData=ctx.getImageData(bx,by,bw,bh);
          dBlendImageData(_bm,topData,botData);
          ctx.putImageData(botData,bx,by);
        }
      }else{
        ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.drawImage(oc,0,0); ctx.restore();
      }
    }else{
      await fRenderOneLayer(ctx, l, dados, 1, 1);
    }
  }
}

// Renderiza um único layer aplicando dados do franqueado
async function fRenderOneLayer(ctx, l, dados, scaleX, scaleY){
  ctx.save();
  ctx.globalAlpha = (l.opacity != null ? l.opacity : 100) / 100;
  var _bmComp=(l.blendMode&&l.blendMode!=='normal'&&typeof dBlendToComposite==='function')
    ?dBlendToComposite(l.blendMode):null;
  ctx.globalCompositeOperation=_bmComp||'source-over';
  const x = Math.round(l.x * scaleX);
  const y = Math.round(l.y * scaleY);
  const w = Math.round(l.w * scaleX);
  const h = Math.round(l.h * scaleY);

  if(l.type === 'shape'){
    const _fill = l.fill || '#FF9000';
    const kind = l.shapeKind || 'rect';
    const _sc=Math.min(scaleX,scaleY);
    // gradiente (l.gradient) → CanvasGradient na caixa; senão cor sólida
    const _fillStyle = (l.gradient&&l.gradient.stops&&l.gradient.stops.length&&typeof gGradientCanvas==='function') ? gGradientCanvas(ctx,l.gradient,x,y,w,h) : _fill;
    // cantos por canto (l.radii sobrescreve l.radius uniforme) — inline p/ não depender do designer
    const _ru=l.radius||0, _rr=l.radii;
    const _ctl=(_rr?(+_rr.tl||0):_ru)*scaleX, _ctr=(_rr?(+_rr.tr||0):_ru)*scaleX,
          _cbr=(_rr?(+_rr.br||0):_ru)*scaleX, _cbl=(_rr?(+_rr.bl||0):_ru)*scaleX;
    const _pts = (kind!=='circle'&&kind!=='ellipse'&&typeof dShapePoints==='function') ? dShapePoints(l) : null;
    // traça a forma no path atual (reutilizável p/ sombras/overlay/traçado)
    const _trace = ()=>{
      if(kind==='circle'||kind==='ellipse'){ ctx.beginPath(); ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2); }
      else if(_pts){ const abs=_pts.map(p=>[x+p[0]*w,y+p[1]*h]); const r=Math.min((l.radius||0)*scaleX,w/2,h/2);
        if(r>0 && typeof gRoundPolyPath2D==='function'){ gRoundPolyPath2D(ctx,abs,r); }
        else { ctx.beginPath(); abs.forEach((p,i)=>{ i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]); }); ctx.closePath(); } }
      else { roundedRectPath(ctx,x,y,w,h,_ctl,_ctr,_cbr,_cbl); }
    };
    const _overlay = (l.overlay&&l.overlayColor) ? gFxRgba(l.overlayColor, l.overlayOpacity!=null?l.overlayOpacity:1) : null;
    // 1) sombra projetada + brilho externo (atrás do fill)
    if(l.shadow){ ctx.save(); _trace(); const o=gFxOffset(l.shadowDist!=null?l.shadowDist:4,l.shadowAngle);
      ctx.shadowColor=l.shadowColor||'rgba(0,0,0,.5)'; ctx.shadowBlur=(l.shadowBlur!=null?l.shadowBlur:6)*_sc; ctx.shadowOffsetX=o.x*_sc; ctx.shadowOffsetY=o.y*_sc;
      ctx.fillStyle=_fill; ctx.fill(); ctx.restore(); }
    if(l.glow){ ctx.save(); _trace(); ctx.shadowColor=l.glowColor||'rgba(255,255,255,.7)'; ctx.shadowBlur=(l.glowSize!=null?l.glowSize:8)*_sc; ctx.fillStyle=_fill; ctx.fill(); ctx.restore(); }
    // 2) fill principal (gradiente/sólido) (+ overlays por cima)
    _trace(); ctx.fillStyle=_fillStyle; ctx.fill();
    if(l.gradientOverlay && l.gradientOverlay.stops && l.gradientOverlay.stops.length && typeof gGradientCanvas==='function'){ // gradient overlay
      _trace(); ctx.save(); ctx.globalAlpha=(l.gradientOverlay.opacity!=null?l.gradientOverlay.opacity:1); ctx.fillStyle=gGradientCanvas(ctx,l.gradientOverlay,x,y,w,h); ctx.fill(); ctx.restore(); }
    if(_overlay){ _trace(); ctx.fillStyle=_overlay; ctx.fill(); }
    // 3) sombra interna / brilho interno (aprox.: traço borrado recortado p/ dentro)
    const _innerStroke=(color,blur,o)=>{ ctx.save(); _trace(); ctx.clip(); _trace();
      ctx.shadowColor=color; ctx.shadowBlur=blur*_sc; ctx.shadowOffsetX=(o?o.x:0)*_sc; ctx.shadowOffsetY=(o?o.y:0)*_sc;
      ctx.lineWidth=Math.max(2,blur*_sc); ctx.strokeStyle=color; ctx.stroke(); ctx.restore(); };
    if(l.innerShadow) _innerStroke(l.innerShadowColor||'rgba(0,0,0,.5)', (l.innerShadowBlur!=null?l.innerShadowBlur:6), gFxOffset(l.innerShadowDist!=null?l.innerShadowDist:4,l.innerShadowAngle));
    if(l.innerGlow) _innerStroke(l.innerGlowColor||'rgba(255,255,255,.7)', (l.innerGlowSize!=null?l.innerGlowSize:8), null);
    if(l.bevel){ const o=gFxOffset(l.bevelSize!=null?l.bevelSize:4,l.bevelAngle), b=l.bevelSize!=null?l.bevelSize:4;
      _innerStroke(l.bevelHighlight||'rgba(255,255,255,.7)', b, o); _innerStroke(l.bevelShadow||'rgba(0,0,0,.5)', b, {x:-o.x,y:-o.y}); }
    // 4) traçado com alinhamento (inside/center/outside) + dash/cap/join
    if(l.strokeW>0){ const a=l.strokeAlign||'inside'; _trace();
      ctx.lineWidth=Math.max(1,l.strokeW*_sc)*(a==='center'?1:2); ctx.strokeStyle=l.strokeColor||'#000';
      ctx.lineJoin=l.strokeJoin||'round'; ctx.lineCap=l.strokeCap||'butt';
      if(l.strokeDash && l.strokeDash.length) ctx.setLineDash(l.strokeDash.map(d=>d*_sc)); else ctx.setLineDash([]);
      if(a==='inside'){ ctx.save(); ctx.clip(); ctx.stroke(); ctx.restore(); }
      else if(a==='outside'){ ctx.stroke(); ctx.setLineDash([]); _trace(); ctx.fillStyle=_overlay||_fillStyle; ctx.fill(); }
      else { ctx.stroke(); }
      ctx.setLineDash([]);
    }

  } else if(l.type === 'text'){
    // defaultValue por variável (3.3): campos não preenchidos / edit:false caem no default da var.
    const _defaults = (typeof gVarDefaults==='function') ? gVarDefaults() : null;
    // Política de var vazia (3.3): se o content só tem token(s) e TODOS ficaram vazios,
    // não renderiza o layer — evita rótulo órfão tipo "R$" sozinho.
    if(/\{\{/.test(l.content||'') && typeof gAllVarsEmpty==='function' && gAllVarsEmpty(l.content, dados, _defaults)){
      ctx.restore(); return;
    }
    // Substitui {{var}} pelo valor real do franqueado (interpolador único — 3.1)
    let raw = gInterpolate(l.content, dados, {onEmpty:'remove', defaults:_defaults});
    const lines = raw.split('\n').filter(line => line.trim() !== '');
    if(lines.length === 0){ ctx.restore(); return; }

    const _fp = (typeof dTextFontParts==='function') ? dTextFontParts(l.font)
              : {family:"'Roboto', sans-serif", weight:/black|realce/i.test(l.font||'')?900:/bold/i.test(l.font||'')?700:900};
    const ff = _fp.family;
    const fwt = String(_fp.weight);
    const isDisplayFont = _fp.weight >= 900; // peso black ganha um leve respiro entre letras

    let fontSize = Math.round((l.fontSize || 24) * Math.min(scaleX, scaleY));
    const minFontSize = Math.max(8, Math.round(fontSize * 0.5));
    const _scTxt = Math.min(scaleX, scaleY);
    // color overlay → cor efetiva do texto; senão l.color
    const _txtColor = (l.overlay&&l.overlayColor) ? gFxRgba(l.overlayColor, l.overlayOpacity!=null?l.overlayOpacity:1) : (l.color || '#fff');
    // parâmetros de sombra projetada (configurável; sem blur/dist → mantém default fs-based antigo)
    const _shUsesCfg = (l.shadowBlur!=null || l.shadowDist!=null || l.shadowAngle!=null);
    const _shOff = l.shadow ? (_shUsesCfg ? gFxOffset((l.shadowDist!=null?l.shadowDist:fontSize*0.07/_scTxt)*_scTxt, l.shadowAngle) : {x:fontSize*0.05, y:fontSize*0.05}) : {x:0,y:0};
    const _shBlur = l.shadow ? (l.shadowBlur!=null ? l.shadowBlur*_scTxt : Math.max(1,fontSize*0.12)) : 0;
    // gradiente no texto (preenchimento) → CanvasGradient; senão a cor efetiva
    const _txtFill = (l.gradient&&l.gradient.stops&&l.gradient.stops.length&&typeof gGradientCanvas==='function') ? gGradientCanvas(ctx,l.gradient,x,y,w,h) : _txtColor;
    const _lsTxt = (l.letterSpacing!=null) ? (l.letterSpacing*_scTxt)+'px' : null; // tracking

    // ── RICH TEXT (multi-estilo) — render horizontal de linha única (trechos sequenciais) ──
    if(l.runs && l.runs.length && !l.vertical){
      let total=0; const segs=l.runs.map(r=>{ const fp=(typeof dTextFontParts==='function')?dTextFontParts(r.font):{family:"'Roboto',sans-serif",weight:700};
        const fs=Math.round((r.fontSize||l.fontSize||24)*_scTxt); ctx.font=`${fp.weight} ${fs}px ${fp.family}`;
        const ww=ctx.measureText(r.text||'').width; total+=ww; return {r,fp,fs,ww}; });
      let tx = l.textAlign==='center'? x+w/2-total/2 : l.textAlign==='right'? x+w-total : x;
      const ty = y+h/2; ctx.textAlign='left'; ctx.textBaseline='middle';
      segs.forEach(s=>{ ctx.font=`${s.fp.weight} ${s.fs}px ${s.fp.family}`; ctx.fillStyle=s.r.color||_txtColor;
        if(l.shadow){ ctx.shadowColor=l.shadowColor||'rgba(0,0,0,.5)'; ctx.shadowBlur=_shBlur; ctx.shadowOffsetX=_shOff.x; ctx.shadowOffsetY=_shOff.y; }
        ctx.fillText(s.r.text||'', tx, ty);
        if(l.shadow){ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;}
        if(l.strokeW>0){ ctx.lineWidth=Math.max(1,l.strokeW*_scTxt); ctx.strokeStyle=l.strokeColor||'#000'; ctx.lineJoin='round'; ctx.strokeText(s.r.text||'', tx, ty); }
        tx+=s.ww; });
      ctx.restore(); return;
    }

    if (l.vertical) {
      // Auto-fit vertical
      let maxColChars = 0;
      lines.forEach(ln => { const chars = [...ln]; if(chars.length > maxColChars) maxColChars = chars.length; });
      
      let charStep = fontSize * 1.1;
      let colStep = fontSize * 1.2;
      let maxColH = maxColChars * charStep;
      let totalW = lines.length * colStep;

      // Se estourar a caixa da camada (w, h), encolhe
      if (maxColH > h || totalW > w) {
        const ratioH = h / Math.max(1, maxColH);
        const ratioW = w / Math.max(1, totalW);
        const shrinkRatio = Math.min(ratioH, ratioW);
        fontSize = Math.max(minFontSize, Math.floor(fontSize * shrinkRatio));
      }

      charStep = fontSize * 1.1;
      colStep = fontSize * 1.2;
      maxColH = maxColChars * charStep;
      totalW = lines.length * colStep;

      ctx.font = `${fwt} ${fontSize}px ${ff}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Realce: caixa atrás do texto
      if(l.bg){
        ctx.save();
        ctx.fillStyle = l.bgColor || '#000';
        const br = Math.min(Math.round(fontSize*0.2), w/2, h/2);
        roundedRect(ctx, x, y, w, h, br); ctx.fill();
        ctx.restore();
      }

      const startX = x + w/2 + totalW/2 - colStep/2;
      ctx.fillStyle = _txtFill; // gradiente/overlay/cor (vertical)

      lines.forEach((line, i) => {
        const tx = startX - i * colStep;
        const chars = [...line];
        const numChars = chars.length;
        const colH = numChars * charStep;
        
        let ty;
        if(l.textAlign === 'center') {
          ty = y + h/2 - colH/2 + charStep/2;
        } else if(l.textAlign === 'right') {
          ty = y + h - colH + charStep/2;
        } else {
          ty = y + charStep/2;
        }

        chars.forEach((char, j) => {
          const cy = ty + j * charStep;
          if(isDisplayFont){
            ctx.letterSpacing = `${Math.max(0.5, fontSize * 0.02)}px`;
          } else {
            ctx.letterSpacing = '0px';
          }
          if(l.shadow){
            ctx.shadowColor=l.shadowColor||'rgba(0,0,0,.5)';
            ctx.shadowBlur=_shBlur; ctx.shadowOffsetX=_shOff.x; ctx.shadowOffsetY=_shOff.y;
          }
          ctx.fillText(char, tx, cy);
          if(l.shadow){ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;}
          if(l.strokeW>0){
            ctx.lineWidth=Math.max(1, l.strokeW*Math.min(scaleX,scaleY));
            ctx.strokeStyle=l.strokeColor||'#000';
            ctx.lineJoin='round';
            ctx.strokeText(char, tx, cy);
          }
        });

        if(l.strikethrough){
          ctx.strokeStyle = l.color || '#fff';
          ctx.lineWidth = Math.max(2, fontSize * 0.05);
          ctx.beginPath();
          ctx.moveTo(tx, ty - charStep/2);
          ctx.lineTo(tx, ty + colH - charStep/2);
          ctx.stroke();
        }
      });

      ctx.letterSpacing = '0px';
    } else {
      // Auto-fit horizontal: começa com fontSize do designer e reduz se texto exceder l.w
      ctx.font = `${fwt} ${fontSize}px ${ff}`;
      ctx.letterSpacing = _lsTxt || (isDisplayFont ? `${Math.max(0.5, fontSize * 0.02)}px` : '0px'); // tracking do PSD tem prioridade
      let maxLineW = 0;
      for(const line of lines){
        const lw = ctx.measureText(line).width;
        if(lw > maxLineW) maxLineW = lw;
      }
      const innerPad = Math.round(fontSize * 0.08);
      const availableW = Math.max(10, w - innerPad * 2);
      if(maxLineW > availableW){
        const shrinkRatio = availableW / maxLineW;
        fontSize = Math.max(minFontSize, Math.floor(fontSize * shrinkRatio));
        ctx.font = `${fwt} ${fontSize}px ${ff}`;
      }

      const lineHeight = fontSize * (l.lineHeight||1.2);
      const totalTextH = lineHeight * lines.length;

      ctx.fillStyle = _txtFill; // gradiente/overlay/cor (horizontal)
      ctx.textAlign = l.textAlign || 'left';
      ctx.textBaseline = 'middle';

      const blockStartY = y + h/2 - totalTextH/2 + lineHeight/2;

      if(l.bg){
        ctx.save();
        ctx.fillStyle = l.bgColor || '#000';
        const br = Math.min(Math.round(fontSize*0.2), w/2, h/2);
        roundedRect(ctx, x, y, w, h, br); ctx.fill();
        ctx.restore();
      }

      lines.forEach((line, i) => {
        const tx = l.textAlign === 'center' ? x + w/2
                 : l.textAlign === 'right' ? x + w - innerPad
                 : x + innerPad;
        const ty = blockStartY + i * lineHeight;

        if(isDisplayFont){
          ctx.letterSpacing = `${Math.max(0.5, fontSize * 0.02)}px`;
        } else {
          ctx.letterSpacing = '0px';
        }

        if(l.shadow){
          ctx.shadowColor=l.shadowColor||'rgba(0,0,0,.5)';
          ctx.shadowBlur=_shBlur; ctx.shadowOffsetX=_shOff.x; ctx.shadowOffsetY=_shOff.y;
        }
        ctx.fillText(line, tx, ty);
        if(l.shadow){ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;}
        if(l.strokeW>0){
          ctx.lineWidth=Math.max(1, l.strokeW*Math.min(scaleX,scaleY));
          ctx.strokeStyle=l.strokeColor||'#000';
          ctx.lineJoin='round';
          ctx.strokeText(line, tx, ty);
        }

        if(l.strikethrough){
          const textW = ctx.measureText(line).width;
          const lx = l.textAlign === 'center' ? tx - textW/2
                   : l.textAlign === 'right' ? tx - textW
                   : tx;
          ctx.strokeStyle = l.color || '#fff';
          ctx.lineWidth = Math.max(2, fontSize * 0.05);
          ctx.beginPath();
          ctx.moveTo(lx, ty);
          ctx.lineTo(lx + textW, ty);
          ctx.stroke();
        }
      });
      ctx.letterSpacing = '0px';
    }

  } else if(l.type === 'frame' || l.type === 'image'){
    // Se tem imgVar e o franqueado enviou foto, usa essa foto
    let imgSource = null;
    const varVal = l.imgVar ? dados[l.imgVar] : null;
    // Aceita data URL (upload do franqueado) OU URL http(s) pública (4.3 — bulk CSV)
    if(varVal && typeof varVal === 'string' && (varVal.startsWith('data:image') || /^https?:\/\//.test(varVal))){
      imgSource = varVal;
    } else if(l.imgUrl && l.imgUrl !== '__local__' && l.imgUrl.length > 0){
      imgSource = l.imgUrl;
    }
    const r = l.frameShape === 'circle' ? Math.min(w, h)/2 : Math.round((l.radius||0) * scaleX);
    if(imgSource){
      try {
        const img = await fLoadImageDataUrl(imgSource);
        if(img && img.width){
          ctx.save();
          ctx.beginPath();
          if(l.frameShape === 'circle'){
            ctx.arc(x + w/2, y + h/2, Math.min(w, h)/2, 0, Math.PI*2);
          } else {
            roundedRect(ctx, x, y, w, h, r);
          }
          ctx.clip();
          const imgAR = img.width / img.height, frameAR = w / h;
          let baseW, baseH;
          if(l.objectFit === 'contain'){
            if(imgAR > frameAR){ baseW = w; baseH = w/imgAR; } else { baseH = h; baseW = h*imgAR; }
          } else { // cover
            if(imgAR > frameAR){ baseH = h; baseW = h*imgAR; } else { baseW = w; baseH = w/imgAR; }
          }
          // Zoom + reposição da foto dentro da moldura (mesma semântica do object-position do designer)
          const sc = l.imgScale || 1;
          const drawW = baseW*sc, drawH = baseH*sc;
          const posX = Math.max(0, Math.min(1, 0.5 + (l.imgOffsetX||0)));
          const posY = Math.max(0, Math.min(1, 0.5 + (l.imgOffsetY||0)));
          const drawX = x + (w - drawW)*posX;
          const drawY = y + (h - drawH)*posY;
          ctx.drawImage(img, drawX, drawY, drawW, drawH);
          ctx.restore();
        }
      } catch(e){
        console.warn('Erro renderizando layer image:', e);
      }
    } else {
      // Placeholder visual leve (não chamativo no PNG final)
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      roundedRect(ctx, x, y, w, h, r);
      ctx.fill();
    }
  }
  ctx.restore();
}

// Helper: desenha retângulo arredondado no canvas
function roundedRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r);
  ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r);
  ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}
// Helper: retângulo com raio POR CANTO (tl,tr,br,bl). Clampa cada raio a min(w,h)/2.
function roundedRectPath(ctx, x, y, w, h, tl, tr, br, bl){
  const m=Math.min(w,h)/2;
  tl=Math.max(0,Math.min(tl,m)); tr=Math.max(0,Math.min(tr,m));
  br=Math.max(0,Math.min(br,m)); bl=Math.max(0,Math.min(bl,m));
  ctx.beginPath();
  ctx.moveTo(x+tl, y);
  ctx.lineTo(x+w-tr, y);            ctx.quadraticCurveTo(x+w, y, x+w, y+tr);
  ctx.lineTo(x+w, y+h-br);          ctx.quadraticCurveTo(x+w, y+h, x+w-br, y+h);
  ctx.lineTo(x+bl, y+h);            ctx.quadraticCurveTo(x, y+h, x, y+h-bl);
  ctx.lineTo(x, y+tl);              ctx.quadraticCurveTo(x, y, x+tl, y);
  ctx.closePath();
}
// Cache de imagens já decodificadas. Evita re-decodificar o mesmo base64
// ao gerar múltiplos formatos ou ao ter a mesma imagem em vários layers.
const _fImgCache = new Map();

function fLoadImageDataUrl(dataUrl){
  if(_fImgCache.has(dataUrl)) return Promise.resolve(_fImgCache.get(dataUrl));
  return new Promise((resolve)=>{
    const img=new Image();
    // URLs http(s) (bulk CSV): tenta CORS pra não "tingir" o canvas ao exportar
    if(/^https?:\/\//.test(dataUrl)) img.crossOrigin='anonymous';
    img.onload=()=>{ _fImgCache.set(dataUrl, img); resolve(img); };
    img.onerror=()=>resolve(null);
    img.src=dataUrl;
  });
}

// Limpa o cache ao reiniciar o fluxo (chamada por fResetFlow em chat.js)
function fClearImgCache(){ _fImgCache.clear(); }

/* ══════════════════════════════════════════════════════════════
   4.3 — GERAÇÃO EM LOTE (CSV)
   1 linha = 1 produto; colunas = nomes das variáveis. Renderiza em FILA
   com yield (await + setTimeout) pra não travar a aba. Imagens só por URL.
══════════════════════════════════════════════════════════════ */
let fBulkRows=[];

// Renderiza o material atual num canvas e devolve o dataURL — SEM disparar download.
// Reaproveita o mesmo caminho de super-sampling 2× do fGenPNG.
async function fRenderMaterialToDataURL(dados, camp, fmt){
  const fmtMap={story:[1080,1920],feed:[1080,1080],post:[1200,628],wide:[1200,628]};
  const [w,h]=fmtMap[fmt.id]||[1080,1920];
  const SCALE=2;
  const renderCv=document.createElement('canvas');
  renderCv.width=w*SCALE;renderCv.height=h*SCALE;
  const rctx=renderCv.getContext('2d');
  rctx.scale(SCALE,SCALE);
  await fRenderTemplateLayers(rctx, fState.material.layers, w, h, dados, camp);
  await fDrawDMLogo(rctx, w, h);
  const finalCv=document.createElement('canvas');
  finalCv.width=w;finalCv.height=h;
  const fctx=finalCv.getContext('2d');
  fctx.imageSmoothingEnabled=true;fctx.imageSmoothingQuality='high';
  fctx.drawImage(renderCv,0,0,w,h);
  return finalCv.toDataURL('image/png');
}

function fBulkOpen(){
  if(!fState.material||!fState.material.layers){gToast('Selecione um material primeiro');return;}
  fBulkRows=[];
  document.getElementById('f-bulk-status').textContent='';
  fBulkRenderPreview();
  // Reseta o bloco de IA pro estado colapsado a cada abertura (evita prompt de material antigo)
  const aiBody=document.getElementById('f-ai-prompt-body');
  if(aiBody)aiBody.style.display='none';
  const aiBtn=document.querySelector('.f-ai-prompt-toggle');
  if(aiBtn){aiBtn.setAttribute('aria-expanded','false');const c=aiBtn.querySelector('.f-ai-prompt-chevron');if(c)c.textContent='›';}
  document.getElementById('f-bulk-modal').classList.add('open');
}
function fBulkClose(){document.getElementById('f-bulk-modal').classList.remove('open');}

/* ── Sugestão de prompt de IA para gerar a planilha (ChatGPT) ── */
function fBuildAIPrompt(material){
  if(!material||!material.layers)return '';
  const vars=fBulkVars(); // mesmas colunas/variáveis do modelo CSV
  const varList=vars.map(v=>`- ${v}: [preencha aqui]`).join('\n');
  const csvHeader=vars.join(',');
  const csvExample=vars.map(v=>`"valor do ${v}"`).join(',');
  return `Preciso que você me ajude a criar uma planilha CSV para gerar artes de marketing.

O CSV deve ter as seguintes colunas:
${csvHeader}

Regras:
- Cada linha é uma arte diferente
- Preencha com produtos reais do meu cardápio
${varList}

Me retorne APENAS o CSV pronto para eu baixar, sem explicações.
Formato: primeira linha com os headers, demais linhas com os dados.
Exemplo de linha: ${csvExample}

Vou te passar agora os produtos que quero incluir:`;
}
function fToggleAIPrompt(){
  const body=document.getElementById('f-ai-prompt-body');
  const btn=document.querySelector('.f-ai-prompt-toggle');
  if(!body||!btn)return;
  const isOpen=body.style.display!=='none';
  body.style.display=isOpen?'none':'';
  btn.setAttribute('aria-expanded',String(!isOpen));
  const chev=btn.querySelector('.f-ai-prompt-chevron');if(chev)chev.textContent=isOpen?'›':'‹';
  if(!isOpen){
    const pre=document.getElementById('f-ai-prompt-text');
    if(pre)pre.textContent=fBuildAIPrompt(fState.material);
  }
}
function fCopyAIPrompt(){
  const text=document.getElementById('f-ai-prompt-text')?.textContent;
  if(!text)return;
  const ok=()=>gToast('✓ Prompt copiado — cole no ChatGPT');
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(ok).catch(()=>fCopyAIPromptFallback(text,ok));
  }else fCopyAIPromptFallback(text,ok);
}
function fCopyAIPromptFallback(text,ok){
  const ta=document.createElement('textarea');
  ta.value=text;ta.style.position='fixed';ta.style.opacity='0';
  document.body.appendChild(ta);ta.select();
  try{document.execCommand('copy');ok();}catch(e){gToast('Não consegui copiar automaticamente — selecione o texto e copie','error');}
  document.body.removeChild(ta);
}

// Ordena variáveis pela ordem do catálogo dVars (igual ao fluxo normal)
function fBulkVars(){
  const vars=dExtractTemplateVars(fState.material.layers);
  if(typeof dVars!=='undefined'&&dVars&&dVars.length){
    const ord=n=>{const i=dVars.findIndex(v=>v.name===n);return i<0?Infinity:i;};
    vars.sort((a,b)=>ord(a)-ord(b));
  }
  return vars;
}
// Bancos de exemplos realistas (contexto Delivery Much) — pra o modelo CSV vir
// preenchido e o franqueado só editar, em vez de partir de uma planilha vazia.
const F_BULK_SAMPLES={
  produto:  ['X-Bacon Duplo','Pizza Calabresa G','Açaí 500ml turbinado','Combo Família','Marmita Executiva'],
  categoria:['Lanches','Pizzas','Sobremesas','Combos','Pratos do dia'],
  brinde:   ['Refri 350ml grátis','Batata média','Brownie de brinde','2 cookies','Molho extra'],
  oferta:   ['Leve 2, pague 1','Combo a partir de R$ 29,90','Frete grátis hoje','2 por R$ 25','Dobro de recheio'],
  validade: ['Válido só hoje','Promoção até domingo','Oferta da semana','Enquanto durar o estoque','Válido até 30/06'],
  bairros:  ['Centro e Centro-Sul','Toda a cidade','Zona Norte e Leste','Bairros selecionados','Região central'],
  condicao: ['Somente no app','Pedidos acima de R$ 30','Pagamento pelo app','Retirada ou entrega','Não acumulativo'],
};
const F_BULK_PRICE_DE =['R$ 39,90','R$ 59,90','R$ 24,90','R$ 89,90','R$ 34,90'];
const F_BULK_PRICE_POR=['R$ 29,90','R$ 44,90','R$ 18,90','R$ 69,90','R$ 27,90'];
const F_BULK_MIN      =['R$ 20,00','R$ 30,00','R$ 25,00','R$ 40,00','R$ 15,00'];
const F_BULK_DISCOUNT =['30%','25%','20%','50%','15%'];
const F_BULK_CODES    =['DM10','BACON15','PIZZA20','ACAI5','FAMILIA30'];

// Escapa uma célula CSV (aspas/vírgula/quebra de linha)
function fBulkCsvCell(v){
  v=(v==null)?'':String(v);
  return /[",\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v;
}
// Devolve um exemplo plausível pra uma variável — por nome conhecido, depois por tipo.
function fBulkSampleValue(varName,i){
  const cfg=(typeof fGetFieldType==='function')?fGetFieldType(varName):{type:'text',maxLen:60};
  const pick=arr=>arr[i%arr.length];
  if(F_BULK_SAMPLES[varName]) return pick(F_BULK_SAMPLES[varName]);
  if(varName==='precoDe')   return pick(F_BULK_PRICE_DE);
  if(varName==='precoPor')  return pick(F_BULK_PRICE_POR);
  if(varName==='pedidoMin') return pick(F_BULK_MIN);
  if(varName==='desconto')  return pick(F_BULK_DISCOUNT);
  if(varName==='codigo')    return pick(F_BULK_CODES);
  switch(cfg.type){
    case 'image':   return 'https://site.com/foto'+(i+1)+'.jpg';
    case 'price':   return pick(F_BULK_PRICE_POR);
    case 'discount':return pick(F_BULK_DISCOUNT);
    case 'code':    return pick(F_BULK_CODES);
    case 'select':  return (cfg.options&&cfg.options.length)?cfg.options[i%cfg.options.length]:('Opção '+(i+1));
    case 'boolean': return (i%2===0)?'sim':'não';
    case 'color':   return pick(['#FF9000','#C8102E','#1A1A1A','#22C55E','#7C6EFF']);
    case 'date':    return pick(['30/06/2026','15/07/2026','01/08/2026','20/06/2026','10/07/2026']);
    default:        return cfg.label?('Ex: '+cfg.label):('Exemplo '+(i+1));
  }
}
function fBulkTemplateCSV(){
  const vars=fBulkVars();
  if(!vars.length){gToast('Este material não tem variáveis pra preencher');return;}
  const N=5; // linhas de exemplo
  const lines=[vars.map(fBulkCsvCell).join(',')]; // cabeçalho = nomes das variáveis
  for(let i=0;i<N;i++){
    lines.push(vars.map(v=>{
      const cfg=(typeof fGetFieldType==='function')?fGetFieldType(v):{maxLen:60};
      let val=fBulkSampleValue(v,i);
      const max=cfg.maxLen||60;
      if(cfg.type!=='image' && val.length>max) val=val.slice(0,max); // respeita o limite do campo
      return fBulkCsvCell(val);
    }).join(','));
  }
  // BOM (﻿) faz o Excel abrir o UTF-8 com acentos corretos
  const csv='﻿'+lines.join('\n')+'\n';
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='modelo_'+(fSanitizeNamePart(fState.material.name)||'material')+'.csv';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  gToast('✓ Modelo CSV com '+N+' exemplos baixado — edite e reenvie');
}
// Parser CSV simples com suporte a aspas e vírgula escapada
function fBulkParseCSV(text){
  if(window.Papa){
    const res = Papa.parse(text, {
      header: true,
      skipEmptyLines: 'greedy'
    });
    return res.data;
  }
  // Fallback case
  const src=String(text).replace(/^﻿/,'').replace(/\r\n?/g,'\n');
  const lines=src.split('\n');
  if(!lines.length) return [];
  const header=lines[0].split(',').map(h=>h.trim());
  const out=[];
  for(let i=1;i<lines.length;i++){
    const line=lines[i].trim();
    if(!line)continue;
    const cells=line.split(',');
    const obj={};
    header.forEach((h,j)=>obj[h]=String(cells[j]||'').trim());
    out.push(obj);
  }
  return out;
}
function fBulkHandleCSV(input){
  const file=input.files[0];if(!file)return;
  const r=new FileReader();
  r.onload=e=>{
    let raw;
    try{ raw=fBulkParseCSV(e.target.result); }catch(err){ gToast('⚠ CSV inválido','error'); return; }
    if(!raw.length){ gToast('⚠ CSV vazio ou sem linhas de dados','error'); return; }
    // Reusa fApplyMask/fValidate por célula
    fBulkRows=raw.map(row=>{
      const dados={},erros=[];
      Object.keys(row).forEach(k=>{
        const cfg=fGetFieldType(k);
        let v=(cfg.type==='image')?row[k]:fApplyMask(k,row[k]);
        dados[k]=v;
        const err=fValidate(k,v);
        if(err)erros.push(err);
      });
      return {dados,erros};
    });
    document.getElementById('f-bulk-status').textContent=`${fBulkRows.length} linha(s) carregada(s)`;
    fBulkRenderPreview();
  };
  r.readAsText(file);
}
let _fBulkRenderToken=0;
function fBulkRenderPreview(){
  const wrap=document.getElementById('f-bulk-preview');if(!wrap)return;
  // Atualiza o texto do botão "Baixar todos" com a contagem atual
  const dlBtn=document.getElementById('f-bulk-dl-btn');
  if(dlBtn)dlBtn.textContent='Baixar todos'+(fBulkRows.length?` (${fBulkRows.length})`:'');
  if(!fBulkRows.length){wrap.innerHTML='<div class="f-bulk-empty">Nenhum CSV carregado ainda. Baixe o modelo, preencha e reenvie.</div>';return;}
  // Proporção do thumbnail conforme o formato do material
  const fmtMap={story:[1080,1920],feed:[1080,1080],post:[1200,628],wide:[1200,628]};
  const [nw,nh]=fmtMap[(fState.fmt&&fState.fmt.id)||'story']||[1080,1920];
  const cw=96, ch=Math.max(40,Math.round(cw*nh/nw));
  wrap.innerHTML=fBulkRows.map((r,i)=>{
    const titulo=r.dados.produto||r.dados.categoria||r.dados.brinde||Object.values(r.dados)[0]||('Linha '+(i+1));
    const campos=Object.keys(r.dados).slice(0,2).map(k=>`<div class="f-bulk-field"><span>${_dEsc?_dEsc(k):k}:</span> ${(_dEsc?_dEsc(r.dados[k]):r.dados[k])||'—'}</div>`).join('');
    return `<div class="f-bulk-card ${r.erros.length?'has-err':''}" id="f-bulk-card-${i}">`
      +`<button class="f-bulk-remove" onclick="fBulkRemoveCard(${i})" title="Remover do lote">×</button>`
      +`<div class="f-bulk-card-num">${i+1}</div>`
      +`<canvas class="f-bulk-canvas" id="f-bulk-cv-${i}" width="${cw}" height="${ch}"></canvas>`
      +`<div class="f-bulk-card-title" title="${_dEsc?_dEsc(titulo):titulo}">${_dEsc?_dEsc(titulo):titulo}</div>`
      +`<div class="f-bulk-card-info">${campos}</div>`
      +`<div class="f-bulk-card-status"><span class="f-bulk-badge loading" id="f-bulk-badge-${i}">⏳</span></div>`
      +`</div>`;
  }).join('');
  fBulkRenderThumbs();
}
// Renderiza os thumbnails em fila (cede o thread entre cada um). Um token cancela
// loops antigos quando a lista é re-renderizada (ex.: após remover um card).
async function fBulkRenderThumbs(){
  const token=++_fBulkRenderToken;
  for(let i=0;i<fBulkRows.length;i++){
    if(token!==_fBulkRenderToken)return; // novo render começou → aborta o antigo
    await fBulkRenderCardPreview(fBulkRows[i], i);
    await new Promise(res=>(window.requestIdleCallback||setTimeout)(res,30));
  }
}
async function fBulkRenderCardPreview(row, index){
  const cv=document.getElementById('f-bulk-cv-'+index);
  const badge=document.getElementById('f-bulk-badge-'+index);
  if(!cv)return;
  try{
    const fmtMap={story:[1080,1920],feed:[1080,1080],post:[1200,628],wide:[1200,628]};
    const [w,h]=fmtMap[(fState.fmt&&fState.fmt.id)||'story']||[1080,1920];
    // Render no tamanho nativo (sem super-sampling — é thumbnail) e desenha reduzido.
    const off=document.createElement('canvas');off.width=w;off.height=h;
    await fRenderTemplateLayers(off.getContext('2d'), fState.material.layers, w, h, row.dados, fState.camp);
    const ctx=cv.getContext('2d');
    ctx.clearRect(0,0,cv.width,cv.height);
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.drawImage(off,0,0,w,h,0,0,cv.width,cv.height);
    if(badge){
      badge.className='f-bulk-badge '+(row.erros.length?'warning':'ok');
      badge.textContent=row.erros.length?('⚠ '+(row.erros.length>1?row.erros.length+' campos':'1 campo')):'✓ OK';
    }
  }catch(e){
    if(badge){badge.className='f-bulk-badge error';badge.textContent='✕ erro';}
    console.warn('[bulk] preview '+index+' falhou:',e);
  }
}
// Remove uma arte do lote e re-renderiza (re-indexa os cards).
function fBulkRemoveCard(index){
  if(index<0||index>=fBulkRows.length)return;
  fBulkRows.splice(index,1);
  const st=document.getElementById('f-bulk-status');
  if(st)st.textContent=fBulkRows.length?`${fBulkRows.length} linha(s) carregada(s)`:'';
  fBulkRenderPreview();
  gToast('Arte removida do lote');
}
async function fBulkDownloadAll(){
  if(!fBulkRows.length){gToast('Envie um CSV primeiro');return;}
  const c=fState.camp, fmt=fState.fmt, btn=document.getElementById('f-bulk-dl-btn');
  if(btn){btn.disabled=true;}
  const valid=fBulkRows.filter(r=>!r.erros.length);
  if(!valid.length){gToast('⚠ Nenhuma linha válida — corrija os erros do CSV','error');if(btn)btn.disabled=false;return;}
  let ok=0;
  for(let i=0;i<valid.length;i++){
    const row=valid[i];
    if(btn)btn.textContent=`Baixando ${i+1}/${valid.length}...`;
    try{
      const dataUrl=await fRenderMaterialToDataURL(row.dados,c,fmt);
      const a=document.createElement('a');
      a.download=fBuildFilename(c,fmt,row.dados);
      a.href=dataUrl;a.click();
      ok++;
    }catch(err){ console.warn('Bulk linha '+(i+1)+' falhou',err); }
    // yield: cede o thread pra UI respirar entre PNGs pesados (2× super-sampling)
    await new Promise(res=>(window.requestIdleCallback||setTimeout)(res, 120));
  }
  if(btn){btn.textContent='Baixar todos';btn.disabled=false;}
  const _fail=valid.length-ok;
  if(_fail>0) gToast(`${ok}/${valid.length} geradas — ${_fail} falhou(ram). Imagens por URL precisam ser públicas (com CORS).`,'error');
  else gToast('✓ '+ok+' de '+valid.length+' artes geradas');
}

/* Sistema de nomenclatura padronizado para downloads
   Formato: DM_<Campanha>_<Produto>_<Formato>_<YYYY-MM-DD>.png */
function fSanitizeNamePart(s){
  if(!s) return '';
  return String(s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')  // remove acentos
    .replace(/[^a-zA-Z0-9\s]/g,'')                     // remove especiais
    .split(/\s+/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('')                                          // PascalCase
    .slice(0, 28);
}
function fBuildFilename(c, fmt, d){
  const camp = fSanitizeNamePart(c.name) || 'Campanha';
  const prodRaw = d.produto || d.categoria || d.brinde || d.oferta || c.name || 'Arte';
  const prod = fSanitizeNamePart(prodRaw) || 'Arte';
  const fmtName = fSanitizeNamePart(fmt.name) || 'Story';
  const now = new Date();
  const date = now.getFullYear() + '-' +
               String(now.getMonth()+1).padStart(2,'0') + '-' +
               String(now.getDate()).padStart(2,'0');
  return `DM_${camp}_${prod}_${fmtName}_${date}.png`;
}

