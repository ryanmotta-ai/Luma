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
// Tamanho de renderização do material. Templates importados 1:1 do PSD guardam w/h reais
// → renderiza no tamanho EXATO da prancheta. Templates legados (sem w/h) caem no preset por
// formato. fmt = formato escolhido no franqueado ({id,...}); ignorado quando há w/h reais.
function fMaterialSize(material, fmt){
  const fmtMap={story:[1080,1920],feed:[1080,1350],wide:[1200,628],post:[1200,628],horizontal:[1920,1080]};
  if(material && material.w>0 && material.h>0) return [material.w, material.h];
  const id=(fmt&&fmt.id)||(material&&material.fmt)||'story';
  return fmtMap[id]||[1080,1920];
}
async function fRenderCanvasHelper(d,c,fmt){
  const [w,h]=fMaterialSize(fState.material, fmt);

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
  if(fotoProduto && fotoProduto.startsWith && (fotoProduto.startsWith('data:image') || fotoProduto.startsWith('blob:') || /^https?:\/\//.test(fotoProduto))){
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
  if(logoLoja && logoLoja.startsWith && (logoLoja.startsWith('data:image') || logoLoja.startsWith('blob:') || /^https?:\/\//.test(logoLoja))){
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

// Rodapé de marca da ferramenta (Luma) — DESATIVADO: a arte gerada é da loja do
// franqueado, então a marca do Luma não deve ser queimada no PNG/PDF final. Mantido
// como no-op pra não quebrar os pontos de chamada (download, resultado, fallback).
async function fDrawDMLogo(ctx, w, h){
  return; // não desenha nenhuma logo de marca no resultado final
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
  const fmtSizes = {story:[1080,1920], feed:[1080,1350], wide:[1200,628], post:[1200,628]};
  // Espaço nativo das coords do template: w/h reais (1:1 do PSD) ou o preset do formato (legado).
  // Quando o material tem w/h reais e está sendo renderizado no próprio tamanho, tw/th==W/H → sem reflow.
  const [tw, th] = fMaterialSize(fState.material);
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
      // Ambos os casos precisam de offscreen: máscara e/ou blend software.
      // ATENÇÃO: o ctx pai pode estar com super-sampling (scale 2×) no download. O
      // offscreen precisa ter a resolução de DISPOSITIVO (W*sx × H*sy) e a mesma
      // transform — senão o conteúdo sai em meia escala no canto (bug: prévia 1× ok,
      // download 2× quebrado).
      const _tf=(typeof ctx.getTransform==='function')?ctx.getTransform():{a:1,d:1};
      const _sx=_tf.a||1, _sy=_tf.d||1;
      const oc=document.createElement('canvas');
      oc.width=Math.max(1,Math.round(W*_sx)); oc.height=Math.max(1,Math.round(H*_sy));
      const octx=oc.getContext('2d');
      try{ octx.setTransform(_tf); }catch(e){}
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
        // Blend pixel-a-pixel restrito à bbox do layer, em coords de DISPOSITIVO
        // (getImageData/putImageData ignoram a transform → multiplica pela escala).
        const bx=Math.max(0,Math.round(l.x*_sx)), by=Math.max(0,Math.round(l.y*_sy));
        const bw=Math.min(oc.width-bx,Math.max(1,Math.round(l.w*_sx)));
        const bh=Math.min(oc.height-by,Math.max(1,Math.round(l.h*_sy)));
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
    // text-transform importado do PSD (All Caps, etc.) — aplicado no conteúdo pois o
    // canvas 2D API não tem textTransform nativo
    if(l.textTransform==='uppercase') raw=raw.toUpperCase();
    else if(l.textTransform==='lowercase') raw=raw.toLowerCase();
    const lines = raw.split('\n').filter(line => line.trim() !== '');
    if(lines.length === 0){ ctx.restore(); return; }

    const _fp = (typeof dTextFontParts==='function') ? dTextFontParts(l.font)
              : {family:"'Roboto', sans-serif", weight:/black|realce/i.test(l.font||'')?900:/bold/i.test(l.font||'')?700:900};
    const ff = _fp.family;
    // fontWeightOverride (faux bold do PSD) tem prioridade — o editor aplica (canvas.js);
    // sem espelhar aqui, o texto saía negrito no editor e regular na arte final.
    const fwt = String(l.fontWeightOverride||_fp.weight);
    const _ital = l.italic ? 'italic ' : ''; // font-style itálico (prefixo do shorthand de fonte do canvas)
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

    // ── RICH TEXT (multi-estilo) — MULTILINHA, fiel ao editor (spans + <br> no DOM):
    // divide os trechos pelas quebras '\n' do PSD, mede cada linha, aplica textTransform,
    // ancora pelo topo (vAlign) ou centraliza o bloco. O render antigo desenhava tudo
    // numa linha única no meio da caixa — a arte final divergia do editor.
    if(l.runs && l.runs.length && !l.vertical){
      const _xf=t=>l.textTransform==='uppercase'?t.toUpperCase():l.textTransform==='lowercase'?t.toLowerCase():t;
      // Trechos → linhas (preserva segmentos vazios de linhas em branco)
      const linesRuns=[[]];
      l.runs.forEach(r=>{
        String(r.text||'').split('\n').forEach((part,pi)=>{
          if(pi>0) linesRuns.push([]);
          if(part!=='') linesRuns[linesRuns.length-1].push(Object.assign({},r,{text:part}));
        });
      });
      // Mede cada linha (fonte/tracking por trecho)
      const fallbackFs=Math.round((l.fontSize||24)*_scTxt);
      const measured=linesRuns.map(segs=>{
        let wsum=0, maxFs=segs.length?0:fallbackFs;
        const ms=segs.map(r=>{
          const fp=(typeof dTextFontParts==='function')?dTextFontParts(r.font):{family:"'Roboto',sans-serif",weight:700};
          const fs=Math.round((r.fontSize||l.fontSize||24)*_scTxt);
          ctx.font=`${_ital}${fp.weight} ${fs}px ${fp.family}`;
          ctx.letterSpacing=r.letterSpacing?(r.letterSpacing*_scTxt)+'px':'0px';
          const t=_xf(r.text||'');
          const ww=ctx.measureText(t).width;
          wsum+=ww; if(fs>maxFs)maxFs=fs;
          return {t,fp,fs,ww,ls:r.letterSpacing||0,color:r.color};
        });
        return {ms,wsum,maxFs};
      });
      const _lhF=(l.lineHeight||1.2);
      const lineHs=measured.map(li=>li.maxFs*_lhF);
      const totalH=lineHs.reduce((a,b)=>a+b,0);
      ctx.textAlign='left'; ctx.textBaseline='alphabetic';
      // vAlign 'top' → bloco encosta no topo da caixa; senão centraliza (espelha o editor)
      let cy=(l.vAlign==='top')? y : y+(h-totalH)/2;
      measured.forEach((li,idx)=>{
        const lineH=lineHs[idx];
        const baseline=cy + li.maxFs*0.8 + (lineH-li.maxFs)/2; // baseline ≈ line-box CSS (half-leading)
        let tx = l.textAlign==='center'? x+w/2-li.wsum/2 : l.textAlign==='right'? x+w-li.wsum : x;
        li.ms.forEach(s=>{
          ctx.font=`${_ital}${s.fp.weight} ${s.fs}px ${s.fp.family}`;
          ctx.letterSpacing=s.ls?(s.ls*_scTxt)+'px':'0px';
          ctx.fillStyle=s.color||_txtColor;
          if(l.shadow){ ctx.shadowColor=l.shadowColor||'rgba(0,0,0,.5)'; ctx.shadowBlur=_shBlur; ctx.shadowOffsetX=_shOff.x; ctx.shadowOffsetY=_shOff.y; }
          ctx.fillText(s.t, tx, baseline);
          if(l.shadow){ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;}
          if(l.strokeW>0){ ctx.lineWidth=Math.max(1,l.strokeW*_scTxt); ctx.strokeStyle=l.strokeColor||'#000'; ctx.lineJoin='round'; ctx.strokeText(s.t, tx, baseline); }
          tx+=s.ww;
        });
        cy+=lineH;
      });
      ctx.letterSpacing='0px';
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

      ctx.font = `${_ital}${fwt} ${fontSize}px ${ff}`;
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
      ctx.font = `${_ital}${fwt} ${fontSize}px ${ff}`;
      ctx.letterSpacing = _lsTxt || (isDisplayFont ? `${Math.max(0.5, fontSize * 0.02)}px` : '0px'); // tracking do PSD tem prioridade
      let maxLineW = 0;
      for(const line of lines){
        const lw = ctx.measureText(line).width;
        if(lw > maxLineW) maxLineW = lw;
      }
      const innerPad = Math.round(fontSize * 0.08);
      const availableW = Math.max(10, w - innerPad * 2);
      // Auto-fit horizontal SÓ p/ texto de PARÁGRAFO (tem caixa de largura). Point text não tem
      // caixa no PSD: encolher pela largura do bbox justo (fonte trocada p/ Roboto) quebrava a
      // hierarquia 1:1 — deixa transbordar em vez de reduzir a fonte.
      if(l.textBox==='box' && maxLineW > availableW){
        const shrinkRatio = availableW / maxLineW;
        fontSize = Math.max(minFontSize, Math.floor(fontSize * shrinkRatio));
        ctx.font = `${_ital}${fwt} ${fontSize}px ${ff}`;
      }

      const lineHeight = fontSize * (l.lineHeight||1.2);
      const totalTextH = lineHeight * lines.length;

      ctx.fillStyle = _txtFill; // gradiente/overlay/cor (horizontal)
      ctx.textAlign = l.textAlign || 'left';
      // Ancoragem vertical: 'top' (PSD) → topo da tinta encosta no topo da caixa (baseline 1:1 com
      // o node.top do Photoshop). Demais → centralização vertical (comportamento antigo).
      const _vTop = (l.vAlign==='top');
      let blockStartY;
      if(_vTop){
        ctx.textBaseline='alphabetic';
        let _ia=fontSize*0.8; // fallback (~ascent de caixa-alta) se measureText não trouxer métricas
        try{ const _m0=ctx.measureText(lines[0]||'H'); if(_m0.actualBoundingBoxAscent) _ia=_m0.actualBoundingBoxAscent; }catch(e){}
        blockStartY = y + _ia; // baseline da 1ª linha
      } else {
        ctx.textBaseline='middle';
        blockStartY = y + h/2 - totalTextH/2 + lineHeight/2;
      }

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

        // Tracking do designer (l.letterSpacing) tem prioridade — era medido no auto-fit
        // mas descartado aqui no desenho, divergindo do editor.
        ctx.letterSpacing = _lsTxt || (isDisplayFont ? `${Math.max(0.5, fontSize * 0.02)}px` : '0px');

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

        if(l.strikethrough || l.underline){
          const textW = ctx.measureText(line).width;
          const lx = l.textAlign === 'center' ? tx - textW/2
                   : l.textAlign === 'right' ? tx - textW
                   : tx;
          ctx.strokeStyle = l.color || '#fff';
          ctx.lineWidth = Math.max(2, fontSize * 0.05);
          // Posições relativas ao baseline em uso: 'top' → alphabetic (ty=baseline); senão middle (ty=centro).
          const _strikeY = _vTop ? (ty - fontSize*0.30) : ty;
          const _underY  = _vTop ? (ty + fontSize*0.10) : (ty + fontSize*0.42);
          if(l.strikethrough){ ctx.beginPath(); ctx.moveTo(lx, _strikeY); ctx.lineTo(lx + textW, _strikeY); ctx.stroke(); }
          if(l.underline){ ctx.beginPath(); ctx.moveTo(lx, _underY); ctx.lineTo(lx + textW, _underY); ctx.stroke(); }
        }
      });
      ctx.letterSpacing = '0px';
    }

  } else if(l.type === 'frame' || l.type === 'image'){
    // Se tem imgVar e o franqueado enviou foto, usa essa foto
    let imgSource = null;
    const varVal = l.imgVar ? dados[l.imgVar] : null;
    // Aceita data URL (upload do franqueado) OU URL http(s) pública (4.3 — bulk CSV)
    if(varVal && typeof varVal === 'string' && (varVal.startsWith('data:image') || varVal.startsWith('blob:') || /^https?:\/\//.test(varVal))){
      imgSource = varVal;
    } else if(l.imgUrl && l.imgUrl !== '__local__' && l.imgUrl.length > 0){
      imgSource = l.imgUrl;
    }
    if(imgSource){
      try {
        const img = await fLoadImageDataUrl(imgSource);
        if(img && img.width){
          ctx.save();
          ctx.beginPath();
          const kind = l.shapeKind || l.frameShape || 'rect';
          const _pts = (kind !== 'circle' && kind !== 'ellipse' && typeof dShapePoints === 'function') ? dShapePoints(l) : null;
          if(kind === 'circle' || kind === 'ellipse'){
            ctx.ellipse(x + w/2, y + h/2, w/2, h/2, 0, 0, Math.PI*2);
          } else if(_pts){
            const abs = _pts.map(p => [x + p[0]*w, y + p[1]*h]);
            const pathRadius = Math.min((l.radius||0)*scaleX, w/2, h/2);
            if(pathRadius > 0 && typeof gRoundPolyPath2D === 'function'){
              gRoundPolyPath2D(ctx, abs, pathRadius);
            } else {
              abs.forEach((p, i) => { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
              ctx.closePath();
            }
          } else {
            const _ru = l.radius || 0, _rr = l.radii;
            const _ctl = (_rr ? (+_rr.tl||0) : _ru) * scaleX, _ctr = (_rr ? (+_rr.tr||0) : _ru) * scaleX,
                  _cbr = (_rr ? (+_rr.br||0) : _ru) * scaleX, _cbl = (_rr ? (+_rr.bl||0) : _ru) * scaleX;
            roundedRectPath(ctx, x, y, w, h, _ctl, _ctr, _cbr, _cbl);
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
      ctx.beginPath();
      const kind = l.shapeKind || l.frameShape || 'rect';
      const _pts = (kind !== 'circle' && kind !== 'ellipse' && typeof dShapePoints === 'function') ? dShapePoints(l) : null;
      if(kind === 'circle' || kind === 'ellipse'){
        ctx.ellipse(x + w/2, y + h/2, w/2, h/2, 0, 0, Math.PI*2);
      } else if(_pts){
        const abs = _pts.map(p => [x + p[0]*w, y + p[1]*h]);
        const pathRadius = Math.min((l.radius||0)*scaleX, w/2, h/2);
        if(pathRadius > 0 && typeof gRoundPolyPath2D === 'function'){
          gRoundPolyPath2D(ctx, abs, pathRadius);
        } else {
          abs.forEach((p, i) => { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
          ctx.closePath();
        }
      } else {
        const _ru = l.radius || 0, _rr = l.radii;
        const _ctl = (_rr ? (+_rr.tl||0) : _ru) * scaleX, _ctr = (_rr ? (+_rr.tr||0) : _ru) * scaleX,
              _cbr = (_rr ? (+_rr.br||0) : _ru) * scaleX, _cbl = (_rr ? (+_rr.bl||0) : _ru) * scaleX;
        roundedRectPath(ctx, x, y, w, h, _ctl, _ctr, _cbr, _cbl);
      }
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
  // Referência 'idb://' (imagem grande no IndexedDB) → resolve pro dataURL real antes de carregar.
  if(typeof dataUrl==='string' && dataUrl.indexOf('idb://')===0 && typeof gResolveImgUrl==='function'){
    const _ref=dataUrl;
    return gResolveImgUrl(_ref).then(real=>{
      if(!real) return null;
      return new Promise((resolve)=>{
        const img=new Image();
        img.crossOrigin = 'anonymous';
        img.onload=()=>{ _fImgCache.set(_ref, img); resolve(img); };
        img.onerror=()=>resolve(null);
        img.src=real;
      });
    });
  }
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
  const [w,h]=fMaterialSize(fState.material, fmt);
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

let _fLastMaterialId = null;

function fBulkCreateEmptyRow() {
  const vars = fBulkVars();
  const dados = {};
  const erros = [];
  vars.forEach(v => {
    dados[v] = '';
    const err = typeof fValidate === 'function' ? fValidate(v, '') : null;
    if (err) erros.push(err);
  });
  return { dados, erros };
}

function fBulkAddEmptyRow() {
  fBulkCollectCurrentInputs();
  fBulkRows.push(fBulkCreateEmptyRow());
  const st = document.getElementById('f-bulk-status');
  if(st) st.textContent = `${fBulkRows.length} linha(s) carregada(s)`;
  fBulkRenderPreview();
}

function fBulkClearAll() {
  fBulkRows = [];
  fBulkRenderPreview();
  const st = document.getElementById('f-bulk-status');
  if(st) st.textContent = '';
  gToast('Planilha limpa com sucesso');
}

function fBulkOpen(){
  if(!fState.material||!fState.material.layers){gToast('Selecione um material primeiro');return;}
  
  if (_fLastMaterialId !== fState.material.id) {
    fBulkRows = [];
    _fLastMaterialId = fState.material.id;
  }
  
  if(!fBulkRows || fBulkRows.length === 0) {
    fBulkRows = [];
    for(let i=0; i<3; i++) {
      fBulkRows.push(fBulkCreateEmptyRow());
    }
    _fBulkTableView = true; // default para tabela ao começar do zero
  }
  
  const cityInput = document.getElementById('f-bulk-city');
  if (cityInput) {
    try {
      cityInput.value = localStorage.getItem('luma_bulk_city') || '';
    } catch (e) {
      console.warn('Error reading city from localStorage', e);
    }
  }

  document.getElementById('f-bulk-status').textContent=`${fBulkRows.length} linha(s) carregada(s)`;
  fBulkRenderPreview();
  // Reseta o bloco de IA pro estado colapsado a cada abertura (evita prompt de material antigo)
  const aiBody=document.getElementById('f-ai-prompt-body');
  if(aiBody)aiBody.style.display='none';
  const aiBtn=document.querySelector('.f-ai-prompt-toggle');
  if(aiBtn){aiBtn.setAttribute('aria-expanded','false');const c=aiBtn.querySelector('.f-ai-prompt-chevron');if(c)c.textContent='›';}
  
  const fmtWrap = document.getElementById('f-bulk-fmts-wrap');
  const fmtList = document.getElementById('f-bulk-fmts-list');
  if(fmtWrap && fmtList && typeof FMTS !== 'undefined') {
    fmtWrap.style.display = 'block';
    fmtList.innerHTML = FMTS.map(f => {
      const checked = fState.fmt && fState.fmt.id === f.id ? 'checked' : '';
      return `<label class="f-bulk-fmt-chip">
        <input type="checkbox" value="${f.id}" class="f-bulk-fmt-cb" ${checked} style="margin:0;accent-color:var(--dm-orange,#FF9000)">
        <span style="font-weight:600">${f.name}</span>
      </label>`;
    }).join('');
  }
  
  fBulkUpdateSavedTemplatesList();
  document.getElementById('f-bulk-modal').classList.add('open');
}
function fBulkClose(){document.getElementById('f-bulk-modal').classList.remove('open');}

/* ── DÚVIDAS FREQUENTES (FAQ) do Luma Sheets ── */
const F_BULK_FAQ = [
  { q:'O que é o Luma Sheets?', a:'É a geração de artes em lote: você preenche uma planilha (cada linha = uma arte) e o Luma gera todas de uma vez, prontas pra baixar num ZIP.' },
  { q:'Como preencho a planilha?', a:'Três jeitos: (1) digite direto na tabela; (2) baixe o “CSV Modelo”, preencha no Excel e reenvie; (3) copie do Excel/Planilhas e cole pelo botão “Excel”.' },
  { q:'Posso ditar por voz?', a:'Sim — clique no microfone ao lado de “Preencher Tabela” e fale suas ofertas (ex.: “hambúrguer por 25, pizza de 50 por 39”). O assistente separa produto e preço. Precisa de Chrome/Edge e do site em https ou localhost (não funciona abrindo o arquivo direto).' },
  { q:'Como coloco fotos nos produtos?', a:'Na visualização em tabela, cada campo de imagem tem o botão “Foto” (envia do computador) ou um campo pra colar um link. Fotos abaixo de 600px avisam que podem sair pixeladas.' },
  { q:'Dá pra exportar vários formatos?', a:'Sim — marque os formatos (Story, Feed, Wide…) em “Formatos para Exportar” e o ZIP vem com uma pasta por formato.' },
  { q:'O que são as Ações em Massa?', a:'Na tabela você preenche uma coluna inteira de uma vez, aplica desconto em % ou arredonda os preços pra final “,90” — tudo em todas as linhas ao mesmo tempo.' },
  { q:'“Começar com exemplos” lê meu cardápio real?', a:'Não. É uma demonstração que gera exemplos por tipo (pizza, sushi, burger) só como ponto de partida. Edite com seus produtos e preços reais antes de gerar.' },
  { q:'Uma arte saiu em branco ou errada. Por quê?', a:'Confira se a linha não tem campos com erro (badge ⚠ no card) e se o material selecionado tem as variáveis certas. Corrija a linha e gere de novo.' },
  { q:'O ZIP vem com as legendas?', a:'Sim — junto das imagens vem um arquivo "legendas_posts.txt" com 3 opções de copy por produto. Escolha entre formato Feed (completo com hashtags) ou Stories (curto) pelo seletor "Copy: Feed/Stories" na toolbar. As copys seguem o tom de voz Delivery Much e nunca repetem.' },
];
function fBulkToggleFaq(){
  const panel = document.getElementById('f-bulk-faq');
  if(!panel) return;
  if(panel.classList.contains('open')){ panel.classList.remove('open'); return; }
  const body = document.getElementById('f-bulk-faq-body');
  if(body && !body.dataset.built){
    body.innerHTML = F_BULK_FAQ.map(it =>
      `<details class="f-bulk-faq-item"><summary>${gEsc(it.q)}</summary><div class="f-bulk-faq-a">${gEsc(it.a)}</div></details>`
    ).join('');
    body.dataset.built = '1';
  }
  panel.classList.add('open');
}

/* ── Title Case inteligente (respeita hífens e preposições pt-BR) ── */
function fSmartTitleCase(str) {
  if (!str) return '';
  const preposicoes = new Set(['de','da','do','das','dos','e','em','com','por','para','a','o','ao','à','no','na','nos','nas','um','uma']);
  return str.split(/\s+/).map((word, idx) => {
    // Palavras com hífen: capitalizar cada parte (x-bacon → X-Bacon)
    if (word.includes('-')) {
      return word.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('-');
    }
    // Preposições ficam minúsculas (exceto se for a primeira palavra)
    if (idx > 0 && preposicoes.has(word.toLowerCase())) return word.toLowerCase();
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

function fBulkParseHeuristicText(text) {
  // Splitter melhorado: separa por pontos, ponto-e-vírgula, quebras de linha e também por vírgula seguida de nome de produto
  const sentences = text.split(/[.;\n\r]+|,\s*(?=[A-ZÁÉÍÓÚÀÂÊÔÃÕÇ])/)
    .map(s => s.trim()).filter(Boolean);
  const vars = fBulkVars();
  
  return sentences.map(sentence => {
    let name = sentence;
    
    // 1. Extração de validade
    const dateMatch = name.match(/(\b(?:hoje|amanhã|amanha|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo|fim de semana|fds|esta semana|este mês|este mes|válido|valido)\b)/i);
    let validade = '';
    if (dateMatch) {
      validade = dateMatch[1];
      name = name.replace(dateMatch[0], '');
    }
    
    // 2. Extração de desconto percentual
    let desconto = '';
    const pctMatch = name.match(/(\d+)\s*%\s*(?:off|de?\s*desconto|desc)/i);
    if (pctMatch) {
      desconto = pctMatch[1] + '%';
      name = name.replace(pctMatch[0], '');
    }
    
    // 3. Extração de preços (de X por Y / era X agora Y)
    let precoDe = '';
    let precoPor = '';
    const dePorMatch = name.match(/(?:de\s+)?(?:r\$\s*)?(\d+(?:[.,]\d+)?)\s*(?:por\s+)(?:r\$\s*)?(\d+(?:[.,]\d+)?)/i)
      || name.match(/(?:era\s+)(?:r\$\s*)?(\d+(?:[.,]\d+)?)\s*(?:e\s+)?(?:agora|hoje)\s*(?:(?:tá|ta|está)\s+)?(?:r\$\s*)?(\d+(?:[.,]\d+)?)/i);
    if (dePorMatch) {
      precoDe = dePorMatch[1];
      precoPor = dePorMatch[2];
      name = name.replace(dePorMatch[0], '');
    } else {
      // Preço único (fix: reais duplicado removido, adicionado "conto")
      const singlePriceMatch = name.match(/(?:por|apenas|r\$\s*)\s*(\d+(?:[.,]\d+)?)/i) || name.match(/(\d+(?:[.,]\d+)?)\s*(?:reais|conto)/i);
      if (singlePriceMatch) {
        precoPor = singlePriceMatch[1];
        name = name.replace(singlePriceMatch[0], '');
      }
    }
    
    // 4. Limpeza do nome do produto
    name = name.replace(/\s+/g, ' ')
               .replace(/^[e\s,]+|[e\s,]+$/gi, '')
               .replace(/\b(?:tem|compre|leve|promoção de|oferta de|promoção|promo|oferta)\b/gi, '')
               .replace(/(?:\bpor\b|\bde\b|\ba\b)$/gi, '')
               .trim();
    
    // Title Case inteligente
    if (name.length > 2) {
      name = fSmartTitleCase(name);
    }
    
    // 5. Mapeamento dinâmico para as variáveis do material
    const dados = {};
    vars.forEach(v => dados[v] = '');
    
    const nameKey = vars.find(v => /produto|titulo|nome/i.test(v)) || vars[0];
    if (nameKey) dados[nameKey] = name;
    
    const deKey = vars.find(v => /de|antigo/i.test(v));
    if (deKey) dados[deKey] = precoDe ? fApplyMask(deKey, precoDe) : '';
    
    const porKey = vars.find(v => /por|preco|preço|atual|valor/i.test(v));
    if (porKey) dados[porKey] = precoPor ? fApplyMask(porKey, precoPor) : '';
    
    const valKey = vars.find(v => /validade|data|condicao|condição/i.test(v));
    if (valKey) dados[valKey] = validade;
    
    const descKey = vars.find(v => /desconto|selo|off/i.test(v));
    if (descKey && desconto) dados[descKey] = desconto;
    
    // Auto-categorizar se houver campo de categoria
    const catKey = vars.find(v => /categor|tipo|segmento/i.test(v));
    if (catKey && !dados[catKey]) {
      dados[catKey] = fBulkAutoCategorize(name);
    }
    
    // Validação
    const erros = [];
    vars.forEach(v => {
      const err = typeof fValidate === 'function' ? fValidate(v, dados[v]) : null;
      if (err) erros.push(err);
    });
    
    return { dados, erros };
  });
}

function fBulkFillWithAI() {
  const ta = document.getElementById('f-bulk-ai-raw-text');
  if(!ta) return;
  const text = ta.value.trim();
  if(!text) { gToast('Digite ou cole algum texto com ofertas primeiro', 'error'); return; }
  
  const parsedRows = fBulkParseHeuristicText(text);
  if(!parsedRows || parsedRows.length === 0) {
    gToast('Não consegui identificar nenhum produto ou preço no texto', 'error');
    return;
  }
  
  fBulkRows = parsedRows;
  document.getElementById('f-bulk-status').textContent=`${fBulkRows.length} linha(s) carregada(s)`;
  fBulkRenderPreview();
  gToast('Tabela preenchida com ' + fBulkRows.length + ' oferta(s) extraida(s)');
  ta.value = '';
}

let _fSpeechActive = false;
let _fSpeechStarting = false;
let _fSpeechInstance = null;

// Estado visual do botão de voz via classe (sem cor hardcoded — o CSS usa tokens).
function fStopSpeechUI(btn){
  if(btn){ btn.classList.remove('is-recording'); btn.setAttribute('aria-pressed','false'); }
}

// Ditar por voz (Web Speech API). Robusto: exige contexto seguro (o mic é bloqueado
// em file://), transcreve contínuo com resultados parciais ao vivo e é toggle (clicar
// de novo para). Acumula no texto existente em vez de sobrescrever.
function fStartSpeech(event, inputId){
  if(event) event.preventDefault();

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ gToast('Reconhecimento de voz só funciona no Chrome ou Edge', 'error'); return; }
  // Secure context: em file:// o navegador bloqueia o microfone — avisa ANTES de tentar.
  if(typeof window.isSecureContext!=='undefined' && !window.isSecureContext){
    gToast('O microfone só funciona em site seguro (https) ou localhost — não abrindo o arquivo direto (file://).', 'error');
    return;
  }

  const btn = (event && event.currentTarget) ? event.currentTarget : document.getElementById('f-bulk-mic-btn');
  const input = document.getElementById(inputId);
  if(!input) return;

  // Toggle: se já está gravando (ou iniciando), para.
  if(_fSpeechActive || _fSpeechStarting){ if(_fSpeechInstance){ try{ _fSpeechInstance.stop(); }catch(e){} } return; }

  const rec = new SR();
  _fSpeechInstance = rec;
  _fSpeechStarting = true;
  rec.lang = 'pt-BR';
  rec.continuous = true;      // não corta na primeira pausa (dita a lista inteira)
  rec.interimResults = true;  // mostra as palavras ao vivo

  const baseText = input.value ? (input.value.replace(/\s*$/,'') + ' ') : '';
  let finalText = '';

  if(btn){ btn.classList.add('is-recording'); btn.setAttribute('aria-pressed','true'); }

  rec.onstart = () => { _fSpeechActive = true; _fSpeechStarting = false; gToast('🎙️ Ouvindo… fale as ofertas. Clique de novo para parar.'); };
  rec.onresult = (e) => {
    let interim = '';
    for(let i=e.resultIndex; i<e.results.length; i++){
      const t = e.results[i][0].transcript;
      if(e.results[i].isFinal) finalText += t + ' '; else interim += t;
    }
    input.value = baseText + finalText + interim;
    if(input.tagName === 'INPUT') input.dispatchEvent(new Event('input', {bubbles:true}));
  };
  rec.onerror = (e) => {
    console.error('Speech error:', e.error);
    if(e.error === 'not-allowed' || e.error === 'service-not-allowed') gToast('Microfone bloqueado — permita o acesso ao microfone nas configurações do navegador.', 'error');
    else if(e.error === 'no-speech') gToast('Nenhuma fala detectada. Fale mais perto do microfone.', 'error');
    else if(e.error !== 'aborted') gToast('Falha no áudio: ' + e.error, 'error');
  };
  rec.onend = () => {
    fStopSpeechUI(btn);
    _fSpeechActive = false; _fSpeechStarting = false; _fSpeechInstance = null;
    if(finalText.trim()) gToast('✓ Transcrição adicionada');
  };

  try{ rec.start(); }
  catch(e){ _fSpeechStarting = false; fStopSpeechUI(btn); gToast('Não consegui iniciar o microfone — tente de novo.', 'error'); }
}

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
function fBulkProcessRawData(raw) {
  if(!raw || !raw.length){ gToast('⚠ Dados vazios ou sem linhas','error'); return; }
  
  // Detecção Inteligente de Mapeamento de Colunas
  const vars = fBulkVars();
  const rawKeys = Object.keys(raw[0]);
  const hasMatches = vars.some(v => rawKeys.includes(v));
  
  if (!hasMatches && rawKeys.length > 0) {
    fBulkShowMapper(raw, rawKeys, vars);
    return;
  }
  
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
  const wrap = document.getElementById('f-bulk-paste-wrap');
  if(wrap) wrap.style.display = 'none';
}

let _fBulkRawToMap = null;

function fBulkShowMapper(raw, rawKeys, vars) {
  _fBulkRawToMap = raw;
  const wrap = document.getElementById('f-bulk-mapper-wrap');
  const fieldsDiv = document.getElementById('f-bulk-mapper-fields');
  const previewDiv = document.getElementById('f-bulk-preview');
  
  if(!wrap || !fieldsDiv) return;
  
  if(previewDiv) previewDiv.style.display = 'none';
  wrap.style.display = 'block';
  
  fieldsDiv.innerHTML = vars.map(v => {
    const label = typeof _dEsc !== 'undefined' ? _dEsc(v) : v;
    
    // Tenta adivinhar qual campo bate
    let bestGuess = '';
    const cleanV = v.toLowerCase().replace(/[^a-z0-9]/g, '');
    for(let rk of rawKeys) {
      const cleanRk = rk.toLowerCase().replace(/[^a-z0-9]/g, '');
      if(cleanRk.includes(cleanV) || cleanV.includes(cleanRk)) {
        bestGuess = rk;
        break;
      }
    }
    
    const options = [`<option value="">-- Ignorar --</option>`]
      .concat(rawKeys.map(rk => {
        const selected = rk === bestGuess ? 'selected' : '';
        const safeRk = typeof _dEsc !== 'undefined' ? _dEsc(rk) : rk;
        return `<option value="${safeRk}" ${selected}>${safeRk}</option>`;
      })).join('');
      
    return `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px">
      <span style="font-size:11px;font-weight:bold;color:var(--text)">${label}:</span>
      <select id="f-bulk-map-select-${v}" style="font-size:11px;padding:6px;border:1px solid var(--gray-mid);border-radius:4px;background:var(--white);color:var(--text);width:60%;outline:none">
        ${options}
      </select>
    </div>`;
  }).join('');
}

function fBulkConfirmMapping() {
  if(!_fBulkRawToMap) return;
  const vars = fBulkVars();
  const mapping = {};
  
  vars.forEach(v => {
    const select = document.getElementById(`f-bulk-map-select-${v}`);
    if(select) mapping[v] = select.value;
  });
  
  const mappedRaw = _fBulkRawToMap.map(row => {
    const newRow = {};
    vars.forEach(v => {
      const csvCol = mapping[v];
      newRow[v] = csvCol ? row[csvCol] : '';
    });
    return newRow;
  });
  
  fBulkCancelMapping();
  fBulkProcessRawData(mappedRaw);
}

function fBulkCancelMapping() {
  _fBulkRawToMap = null;
  const wrap = document.getElementById('f-bulk-mapper-wrap');
  const previewDiv = document.getElementById('f-bulk-preview');
  if(wrap) wrap.style.display = 'none';
  if(previewDiv) previewDiv.style.display = 'block';
}

function fBulkTogglePaste() {
  const wrap = document.getElementById('f-bulk-paste-wrap');
  if(wrap) wrap.style.display = wrap.style.display==='none' ? 'block' : 'none';
}

function fBulkHandlePaste() {
  const ta = document.getElementById('f-bulk-paste-ta');
  if(!ta) return;
  const text = ta.value.trim();
  if(!text) { gToast('Cole os dados copiados do Excel primeiro','error'); return; }
  
  let raw;
  try{
    const delim = text.includes('\t') ? '\t' : ',';
    if(window.Papa) {
      const res = Papa.parse(text, { header: true, skipEmptyLines: 'greedy', delimiter: delim });
      raw = res.data;
    } else {
      raw = fBulkParseCSV(text);
    }
  }catch(err){ gToast('⚠ Dados inválidos','error'); return; }
  
  fBulkProcessRawData(raw);
  ta.value = '';
}

function fBulkHandleCSV(input){
  const file=input.files[0];if(!file)return;
  const r=new FileReader();
  r.onload=e=>{
    let raw;
    try{ raw=fBulkParseCSV(e.target.result); }catch(err){ gToast('⚠ CSV inválido','error'); return; }
    fBulkProcessRawData(raw);
  };
  r.readAsText(file);
}
let _fBulkRenderToken=0;
let _fBulkTableView=false;

function fBulkToggleTableView() {
  fBulkCollectCurrentInputs();
  _fBulkTableView = !_fBulkTableView;
  fBulkRenderPreview();
}

function fBulkRenderPreview(){
  const wrap=document.getElementById('f-bulk-preview');if(!wrap)return;
  // Atualiza o texto do botão "Baixar todos" com a contagem atual
  const dlBtn=document.getElementById('f-bulk-dl-btn');
  if(dlBtn)dlBtn.textContent='Baixar todos'+(fBulkRows.length?` (${fBulkRows.length})`:'');
  if(!fBulkRows.length){wrap.innerHTML='<div class="f-bulk-empty">Nenhum CSV carregado ainda. Baixe o modelo, preencha e reenvie.</div>';return;}
  
  if (_fBulkTableView) {
    const keys = fBulkVars();
    const ths = keys.map(k => `<th style="padding:10px 8px;border-bottom:2px solid var(--gray-mid, #D4D4D4);text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-2,#3A3A3A);font-weight:600;white-space:nowrap">${typeof _dEsc !== 'undefined'?_dEsc(k):k}</th>`).join('');
    
    const query = document.getElementById('f-bulk-search')?.value.trim().toLowerCase() || '';
    let trs = fBulkRows.map((r,i) => {
      if (query) {
        const match = Object.values(r.dados).some(v => String(v).toLowerCase().includes(query));
        if (!match) return '';
      }
      const tds = keys.map(k => {
        const val = r.dados[k] || '';
        const isFieldErr = r.erros.find(e => e.includes(k));
        const safeV = typeof _dEsc !== 'undefined' ? _dEsc(val).replace(/"/g, '&quot;') : val.replace(/"/g, '&quot;');
        
        if (fIsImageVar(k)) {
          return `<td style="padding:6px 4px;border-bottom:1px solid var(--gray-light, #F2F2F2)">
            <div style="display:flex;align-items:center;gap:8px;min-width:160px">
              ${val ? `
                <div style="position:relative;width:28px;height:28px;border-radius:4px;border:1px solid var(--gray-mid,#D4D4D4);overflow:hidden;background:#eee;flex-shrink:0" title="Prévia da foto">
                  <img src="${safeV}" style="width:100%;height:100%;object-fit:cover" onerror="this.src='';this.parentElement.style.borderColor='var(--dm-red,#C81818)';gToast('Link de imagem inválido ou quebrado!','error')" onload="if(this.naturalWidth && (this.naturalWidth < 600 || this.naturalHeight < 600)){ this.parentElement.style.borderColor='#FF9000'; this.parentElement.title='Aviso: Resolução baixa ('+this.naturalWidth+'x'+this.naturalHeight+'px)'; } else { this.parentElement.style.borderColor='var(--gray-mid,#D4D4D4)'; }">
                </div>
                <button class="d-btn-sec" style="padding:2px 6px;font-size:10px;color:var(--dm-red,#C81818);border-color:var(--gray-mid,#D4D4D4);cursor:pointer;border-radius:4px;background:#fff;font-weight:600" onclick="fBulkClearImage(${i}, '${k}')">Excluir</button>
              ` : `
                <label class="d-btn-sec" style="padding:4px 8px;font-size:11px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;border-radius:4px;border:1px solid var(--gray-mid,#D4D4D4);background:#fff;font-weight:600">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Foto
                  <input type="file" accept="image/*" style="display:none" onchange="fBulkUploadCellImage(this, ${i}, '${k}')">
                </label>
                <input type="text" placeholder="Cole link..." value="" id="f-bulk-edit-${i}-${k}" onblur="fBulkSaveRow(${i}, true)" style="font-size:11px;padding:4px 6px;border:1px solid var(--gray-mid,#D4D4D4);border-radius:4px;width:75px;background:var(--white,#FFFFFF);color:var(--text,#0A0A0A);outline:none">
              `}
            </div>
          </td>`;
        }
        
        ret      return `<tr>
        <td style="padding:6px 4px;border-bottom:1px solid var(--gray-light, #F2F2F2);text-align:center;display:flex;align-items:center;justify-content:center;gap:4px">
          <button class="d-btn-sec" style="padding:0;width:20px;height:20px;border-radius:50%;color:var(--text-3,#6B6B6B);background:transparent;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s" onmouseover="this.style.color='var(--dm-orange,#FF9000)';this.style.background='var(--dm-orange-bg,rgba(255,144,0,.1))'" onmouseout="this.style.color='';this.style.background=''" onclick="fBulkShowCopyModal(${i})" title="Ver legendas geradas"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>
          <button class="d-btn-sec" style="padding:0;width:20px;height:20px;border-radius:50%;color:var(--text-3,#6B6B6B);background:transparent;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s" onmouseover="this.style.color='var(--dm-orange,#FF9000)';this.style.background='var(--dm-orange-bg,rgba(255,144,0,.1))'" onmouseout="this.style.color='';this.style.background=''" onclick="fBulkCloneRow(${i})" title="Duplicar linha"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
          <button class="d-btn-sec" style="padding:0;width:20px;height:20px;border-radius:50%;color:var(--text-3,#6B6B6B);background:transparent;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s" onmouseover="this.style.color='var(--dm-red,#C81818)';this.style.background='rgba(200,24,24,0.1)'" onmouseout="this.style.color='';this.style.background=''" onclick="fBulkRemoveCard(${i})" title="Remover linha"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </td>/></svg></button>
          <button class="d-btn-sec" style="padding:0;width:20px;height:20px;border-radius:50%;color:var(--text-3,#6B6B6B);background:transparent;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s" onmouseover="this.style.color='var(--dm-red,#C81818)';this.style.background='rgba(200,24,24,0.1)'" onmouseout="this.style.color='';this.style.background=''" onclick="fBulkRemoveCard(${i})" title="Remover linha"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </td>
        <td style="padding:6px 4px;border-bottom:1px solid var(--gray-light, #F2F2F2);text-align:center;cursor:help" onmouseenter="fBulkShowHoverPreview(event, ${i})" onmouseleave="fBulkHideHoverPreview()"><span class="f-bulk-num-chip">${i+1}</span></td>
        ${tds}
      </tr>`;
    }).join('');
    
    const optionsHtml = keys.map(k => `<option value="${k}">${typeof _dEsc !== 'undefined'?_dEsc(k):k}</option>`).join('');
    wrap.innerHTML = `<div style="grid-column: 1 / -1; width:100%; display:flex; flex-direction:column; gap:12px">
      <!-- Barra de Ações em Massa -->
      <div class="f-bulk-actions-bar" style="display:flex;gap:10px;align-items:center;padding:8px 12px;border-radius:8px;font-size:11px;color:var(--text-2,#3A3A3A);flex-wrap:wrap">
        <span style="display:inline-flex;align-items:center;gap:4px;font-weight:bold"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Ações em Massa:</span>
        <span>Coluna:</span>
        <select id="f-bulk-action-col" style="font-size:11px;padding:4px;border:1px solid var(--gray-mid,#D4D4D4);border-radius:4px;background:var(--white,#FFFFFF);color:var(--text,#0A0A0A);outline:none">
          ${optionsHtml}
        </select>
        <input type="text" id="f-bulk-action-val" placeholder="Texto para preencher..." style="font-size:11px;padding:4px 8px;border:1px solid var(--gray-mid,#D4D4D4);border-radius:4px;background:var(--white,#FFFFFF);color:var(--text,#0A0A0A);width:130px;outline:none">
        <button class="d-btn-sec" style="font-size:11px;padding:4px 10px;cursor:pointer;border-radius:4px;border:1px solid var(--gray-mid,#D4D4D4);background:var(--white,#FFFFFF);font-weight:600" onclick="fBulkApplyFill()">Preencher Tudo</button>
        <span style="color:var(--gray-mid,#D4D4D4)">|</span>
        <button class="d-btn-sec" style="font-size:11px;padding:4px 10px;cursor:pointer;border-radius:4px;border:1px solid var(--gray-mid,#D4D4D4);background:var(--white,#FFFFFF);font-weight:600" onclick="fBulkApplyDiscountPrompt()" title="Aplicar desconto em % a uma coluna de preços">Aplicar Desconto %</button>
        <button class="d-btn-sec" style="font-size:11px;padding:4px 10px;cursor:pointer;border-radius:4px;border:1px solid var(--gray-mid,#D4D4D4);background:var(--white,#FFFFFF);font-weight:600" onclick="fBulkApplyRounding()" title="Arredondar preços da coluna para finais em ,90">Arredondar (.90)</button>
      </div>
      <div style="overflow-x:auto;width:100%;max-height:50vh;border:1px solid var(--gray-mid, #D4D4D4);border-radius:8px;background:var(--white,#FFFFFF)">
        <table class="f-bulk-table" style="width:100%;border-collapse:collapse;margin:0">
          <thead style="position:sticky;top:0;z-index:10">
            <tr>
              <th style="padding:10px 8px;border-bottom:2px solid var(--gray-mid, #D4D4D4);width:30px"></th>
              <th style="padding:10px 8px;border-bottom:2px solid var(--gray-mid, #D4D4D4);width:30px;color:var(--text-2,#3A3A3A)">#</th>
              ${ths}
            </tr>
          </thead>
          <tbody>${trs}</tbody>
        </table>
      </div>
      <div style="display:flex;gap:10px">
        <button class="d-btn-sec" style="width:100%;border:1px dashed var(--gray-mid, #D4D4D4);padding:8px 16px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:12px;background:transparent;cursor:pointer;border-radius:6px;color:var(--text-2,#3A3A3A);font-weight:600;transition:all 0.15s ease" onmouseover="this.style.background='var(--gray-light, #F2F2F2)';this.style.color='var(--text)'" onmouseout="this.style.background='transparent';this.style.color=''" onclick="fBulkAddEmptyRow()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Adicionar Nova Linha
        </button>
        <button class="d-btn-sec" style="border:1px solid var(--gray-mid, #D4D4D4);padding:8px 16px;color:var(--dm-red,#C81818);background:transparent;font-size:12px;cursor:pointer;border-radius:6px;font-weight:600;transition:all 0.15s ease" onmouseover="this.style.background='rgba(255,45,85,0.1)'" onmouseout="this.style.background='transparent'" onclick="fBulkClearAll()">
          Limpar Tudo
        </button>
      </div>
    </div>`;
    return;
  }
  
  // Proporção do thumbnail conforme o tamanho real do material (ou o preset, p/ legados)
  const [nw,nh]=fMaterialSize(fState.material, fState.fmt);
  const cw=96, ch=Math.max(40,Math.round(cw*nh/nw));
  const query = document.getElementById('f-bulk-search')?.value.trim().toLowerCase() || '';
  wrap.innerHTML=fBulkRows.map((r,i)=>{
    if (query) {
      const match = Object.values(r.dados).some(v => String(v).toLowerCase().includes(query));
      if (!match) return '';
    }
    const titulo=r.dados.produto||r.dados.categoria||r.dados.brinde||Object.values(r.dados)[0]||('Linha '+(i+1));
    const campos=Object.keys(r.dados).slice(0,2).map(k=>`<div class="f-bulk-field"><span>${_dEsc?_dEsc(k):k}:</span> ${(_dEsc?_dEsc(r.dados[k]):r.dados[k])||'—'}</div>`).join('');
    const isErr = r.erros.length > 0;
    const actionsHtml = isErr 
      ? `<button class="d-btn-sec" style="padding:2px 6px;font-size:9px;margin-top:4px;width:100%" onclick="fBulkEditRow(${i})">Corrigir linha</button>` 
      : `<button class="d-btn-sec" style="padding:2px 6px;font-size:9px;margin-top:4px;width:100%;display:inline-flex;align-items:center;justify-content:center;gap:4px" onclick="fBulkShowCopyModal(${i})"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Legendas</button>`;
    return `<div class="f-bulk-card ${isErr?'has-err':''}" id="f-bulk-card-${i}">`
      +`<button class="f-bulk-remove" onclick="fBulkRemoveCard(${i})" title="Remover do lote">×</button>`
      +`<div class="f-bulk-card-num">${i+1}</div>`
      +`<canvas class="f-bulk-canvas" id="f-bulk-cv-${i}" width="${cw}" height="${ch}"></canvas>`
      +`<div class="f-bulk-card-title" title="${_dEsc?_dEsc(titulo):titulo}">${_dEsc?_dEsc(titulo):titulo}</div>`
      +`<div class="f-bulk-card-info" id="f-bulk-info-${i}">${campos}${actionsHtml}</div>`
      +`<div class="f-bulk-card-status"><span class="f-bulk-badge loading" id="f-bulk-badge-${i}">⏳</span></div>`
      +`</div>`;
  }).join('');
  fBulkRenderThumbs();
}

function fBulkEditRow(i) {
  const infoDiv = document.getElementById('f-bulk-info-'+i);
  if(!infoDiv) return;
  const row = fBulkRows[i];
  
  const formHtml = Object.keys(row.dados).map(k => {
    // verifica se o nome do campo aparece em algum erro
    const isErr = row.erros.find(e => e.includes(k));
    const val = row.dados[k] || '';
    const safeK = typeof _dEsc !== 'undefined' ? _dEsc(k) : k;
    const safeV = typeof _dEsc !== 'undefined' ? _dEsc(val).replace(/"/g, '&quot;') : val.replace(/"/g, '&quot;');
    const cfg = typeof fGetFieldType === 'function' ? fGetFieldType(k) : {type:'text'};
    
    if (cfg.type === 'image') {
      const isBase64 = val.startsWith('data:');
      const previewHtml = val ? `<div class="f-bulk-local-prev" style="margin-top:4px;width:100%;height:30px;background:url('${_fCssUrlSafe(val)}') center/contain no-repeat;border:1px solid ${isErr?'var(--dm-red,#C81818)':'var(--gray-mid,#D4D4D4)'}"></div>` : '';
      return `<div style="margin-bottom:4px">
        <label style="display:block;font-size:9px;color:var(--text-2,#3A3A3A);margin-bottom:2px">${safeK} (Imagem local ou URL)</label>
        <input type="file" id="f-bulk-edit-${i}-${k}-file" accept="image/*" style="width:100%;font-size:10px;color:var(--text-2,#3A3A3A)" onchange="fBulkHandleLocalImage(this, ${i}, '${k}')">
        <input type="hidden" id="f-bulk-edit-${i}-${k}" value="${safeV}">
        ${previewHtml}
      </div>`;
    }

    return `<div style="margin-bottom:4px">
      <label style="display:block;font-size:9px;color:var(--text-2,#3A3A3A);margin-bottom:2px">${safeK}</label>
      <input type="text" id="f-bulk-edit-${i}-${k}" value="${safeV}" style="width:100%;font-size:10px;padding:2px 4px;border:1px solid ${isErr?'var(--dm-red,#C81818)':'var(--gray-mid,#D4D4D4)'};border-radius:2px;background:var(--white,#FFFFFF)">
    </div>`;
  }).join('');
  
  infoDiv.innerHTML = formHtml + `<button class="d-btn-pri" style="width:100%;padding:4px;font-size:10px;margin-top:4px" onclick="fBulkSaveRow(${i})">Salvar</button>`;
}

// Sanitiza um valor pra uso dentro de url('...') no CSS (tira aspas/parênteses/quebras).
function _fCssUrlSafe(v){ return String(v==null?'':v).replace(/["'()\\\r\n]/g,''); }

function fBulkHandleLocalImage(input, idx, key) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const hidden = document.getElementById(`f-bulk-edit-${idx}-${key}`);
    if (hidden) hidden.value = e.target.result;
    // Preview robusto: acha (ou cria) a div de prévia no mesmo wrapper, em vez de
    // navegar por nextElementSibling — que quebrava (TypeError) quando o campo estava
    // vazio e a div de preview ainda não existia.
    const wrap = input.closest('div');
    if (wrap) {
      let prev = wrap.querySelector('.f-bulk-local-prev');
      if (!prev) {
        prev = document.createElement('div');
        prev.className = 'f-bulk-local-prev';
        prev.style.cssText = 'margin-top:4px;width:100%;height:30px;background-position:center;background-repeat:no-repeat;background-size:contain;border:1px solid var(--gray-mid,#D4D4D4)';
        wrap.appendChild(prev);
      }
      prev.style.backgroundImage = `url('${_fCssUrlSafe(e.target.result)}')`;
      prev.style.borderColor = 'var(--gray-mid,#D4D4D4)';
    }
  };
  reader.readAsDataURL(file);
}

function fBulkSaveRow(i, isSilent=false) {
  const row = fBulkRows[i];
  const keys = fBulkVars();
  
  // Verifica se a linha é completamente vazia
  const isEmpty = keys.every(k => {
    const input = document.getElementById(`f-bulk-edit-${i}-${k}`);
    const val = input ? input.value : (row.dados[k] || '');
    return !val || !val.trim();
  });
  
  const dados = {}, erros = [];
  
  keys.forEach(k => {
    const input = document.getElementById(`f-bulk-edit-${i}-${k}`);
    if(input) {
      const cfg = typeof fGetFieldType === 'function' ? fGetFieldType(k) : {type:'text'};
      let v = (cfg.type==='image' && input.type !== 'file') ? input.value : fApplyMask(k, input.value);
      dados[k] = v;
      
      // Só valida se a linha não for totalmente vazia
      // (err no escopo do forEach: antes era const dentro do if → ReferenceError no blur)
      let err = null;
      if (!isEmpty) {
        err = fValidate(k, v);
        if(err) erros.push(err);
      }

      if(isSilent) {
        input.style.borderColor = err ? 'var(--dm-red,#C81818)' : 'var(--gray-mid,#D4D4D4)';
      }
    } else {
      dados[k] = row.dados[k];
    }
  });
  
  // Auto-Categorizador Rodada 2:
  if (keys.includes('categoria') && keys.includes('produto')) {
    const prodVal = dados['produto'] || '';
    const catVal = dados['categoria'] || '';
    if (prodVal && !catVal) {
      const autoCat = fBulkAutoCategorize(prodVal);
      if (autoCat) {
        dados['categoria'] = autoCat;
        const catInput = document.getElementById(`f-bulk-edit-${i}-categoria`);
        if (catInput) {
          catInput.value = autoCat;
          catInput.style.borderColor = 'var(--gray-mid,#D4D4D4)';
        }
        const catErrIdx = erros.findIndex(e => e.includes('categoria'));
        if (catErrIdx !== -1) erros.splice(catErrIdx, 1);
      }
    }
  }
  
  fBulkRows[i] = {dados, erros};
  
  if(!isSilent) {
    fBulkRenderPreview();
  }
}

function fBulkSaveAllRows(isSilent=true) {
  if (!_fBulkTableView) return;
  fBulkRows.forEach((r, i) => {
    fBulkSaveRow(i, isSilent);
  });
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
    const [w,h]=fMaterialSize(fState.material, fState.fmt);
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
  fBulkCollectCurrentInputs();
  fBulkRows.splice(index,1);
  const st=document.getElementById('f-bulk-status');
  if(st)st.textContent=fBulkRows.length?`${fBulkRows.length} linha(s) carregada(s)`:'';
  fBulkRenderPreview();
  gToast('Arte removida do lote');
}
// Duplica a linha logo abaixo dela (o botão 📋 da tabela chamava esta função, que não existia).
function fBulkCloneRow(index){
  if(index<0||index>=fBulkRows.length)return;
  fBulkCollectCurrentInputs();
  const src=fBulkRows[index]||{dados:{},erros:[]};
  fBulkRows.splice(index+1,0,{ dados:{...src.dados}, erros:[...(src.erros||[])] });
  const st=document.getElementById('f-bulk-status');
  if(st)st.textContent=`${fBulkRows.length} linha(s) carregada(s)`;
  fBulkRenderPreview();
  gToast('✓ Linha duplicada');
}
async function fBulkDownloadAll(){
  if(!fBulkRows.length){gToast('Envie um CSV primeiro');return;}
  if(typeof JSZip === 'undefined'){gToast('JSZip não carregado','error');return;}
  
  // Salva e valida todas as linhas da tabela antes do download
  fBulkSaveAllRows(true);
  
  const keys = fBulkVars();
  const checkboxes = document.querySelectorAll('.f-bulk-fmt-cb:checked');
  let selectedFmts = [];
  if(checkboxes.length > 0 && typeof FMTS !== 'undefined') {
    checkboxes.forEach(cb => {
      const f = FMTS.find(x => x.id === cb.value);
      if(f) selectedFmts.push(f);
    });
  } else {
    selectedFmts = [fState.fmt];
  }
  
  // Filtra linhas válidas que não tenham erro e que NÃO estejam completamente vazias
  const valid = fBulkRows.filter(r => {
    if (r.erros.length > 0) return false;
    const isEmpty = keys.every(k => !r.dados[k] || !r.dados[k].trim());
    return !isEmpty;
  });
  if(!valid.length){gToast('⚠ Nenhuma linha válida preenchida','error');return;}
  
  const wrap = document.getElementById('f-bulk-progress-wrap');
  const txt = document.getElementById('f-bulk-progress-text');
  const pct = document.getElementById('f-bulk-progress-pct');
  const bar = document.getElementById('f-bulk-progress-bar');
  const actions = document.getElementById('f-bulk-actions');
  
  if(actions) actions.style.display = 'none';
  if(wrap) wrap.style.display = 'block';
  
  let ok=0;
  const zip = new JSZip();
  const c=fState.camp;
  const totalRenders = valid.length * selectedFmts.length;
  let currentRender = 0;
  
  for(let fi=0; fi<selectedFmts.length; fi++) {
    const fmt = selectedFmts[fi];
    const folderPrefix = selectedFmts.length > 1 ? `${fmt.name}/` : '';
    const oldFmt = fState.fmt;
    fState.fmt = fmt;
    
    for(let i=0;i<valid.length;i++){
      const row=valid[i];
      currentRender++;
      const pctVal = Math.round((currentRender / totalRenders) * 100);
      
      if(txt) txt.textContent = `Arte ${currentRender}/${totalRenders} (${fmt.name})...`;
      if(pct) pct.textContent = `${pctVal}%`;
      if(bar) bar.style.width = `${pctVal}%`;
      
      try{
        const dataUrl=await fRenderMaterialToDataURL(row.dados,c,fmt);
        const filename=fBuildFilename(c,fmt,row.dados);
        const b64 = dataUrl.split(',')[1];
        if(b64) zip.file(folderPrefix + filename, b64, {base64: true});
        ok++;
      }catch(err){ console.warn('Bulk linha '+(i+1)+' falhou',err); }
      
      await new Promise(res=>setTimeout(res, 50));
    }
    
    fState.fmt = oldFmt;
  }
  
  // Gerador de Legendas v2 — Motor Combinatório com tom DM
  const copyFormat = (document.getElementById('f-bulk-copy-format') || {}).value || 'feed';
  
  let captionsText = `========================================================\n`;
  captionsText += `   LEGENDAS PARA POSTS — GERADAS PELO LUMA SHEETS\n`;
  captionsText += `   Formato: ${copyFormat === 'stories' ? 'Stories (curto)' : 'Feed (completo)'}\n`;
  captionsText += `========================================================\n\n`;
  
  valid.forEach((row, idx) => {
    const vars = Object.keys(row.dados);
    const nameKey = vars.find(v => /produto|titulo|nome/i.test(v)) || vars[0] || '';
    const deKey = vars.find(v => /de|antigo/i.test(v)) || '';
    const porKey = vars.find(v => /por|preco|preço|atual|valor/i.test(v)) || '';
    const valKey = vars.find(v => /validade|data|condicao|condição/i.test(v)) || '';
    const descKey = vars.find(v => /desconto|selo|off/i.test(v)) || '';
    
    const prod = row.dados[nameKey] || ('Produto ' + (idx + 1));
    const de = deKey ? (row.dados[deKey] || '') : '';
    const por = porKey ? (row.dados[porKey] || '') : '';
    const val = valKey ? (row.dados[valKey] || '') : '';
    const desc = descKey ? (row.dados[descKey] || '') : '';
    
    captionsText += `--------------------------------------------------------\n`;
    captionsText += `ITEM #${idx+1}: ${prod}\n`;
    captionsText += `--------------------------------------------------------\n\n`;
    
    const copys = fBuildCopy(prod, de, por, val, desc, copyFormat);
    
    captionsText += `Opcao 1:\n${copys.op1}\n\n`;
    captionsText += `Opcao 2:\n${copys.op2}\n\n`;
    captionsText += `Opcao 3:\n${copys.op3}\n\n\n`;
  });
  
  zip.file("legendas_posts.txt", captionsText);

  try {
    const zipBlob = await zip.generateAsync({type: "blob"});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(zipBlob);
    a.download = `Luma_Artes_${fSanitizeNamePart(fState.material.name)||'Lote'}.zip`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
  } catch(err) {
    console.error(err);
    gToast('Erro ao gerar o arquivo ZIP', 'error');
  }
  
  if(actions) actions.style.display = 'flex';
  if(wrap) wrap.style.display = 'none';
  
  const _fail=totalRenders-ok;
  if(_fail>0) gToast(`${ok}/${totalRenders} geradas — ${_fail} falhou(ram).`,'error');
  else gToast('✓ '+ok+' artes geradas e baixadas no ZIP!');
  
  if(typeof fClearImgCache === 'function') fClearImgCache();
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


/* ══════════════════════════════════════════════════════════════
   PREVIEW FIEL — fonte única de verdade visual dos thumbnails.
   Renderiza um template/prancheta num canvas usando o MESMO motor
   da arte final (fRenderTemplateLayers): máscaras, cantos por canto,
   gradientes, efeitos, blend modes, texto rico — tudo igual ao PNG.
   Substitui os renderizadores DOM próprios (e infiéis) dos previews
   de publicação e dos cards de material.
══════════════════════════════════════════════════════════════ */
// Fila serializada: o motor lê fState.material (fundo + espaço nativo) DEPOIS de um
// await interno (document.fonts.ready) — dois renders concorrentes trocariam o shim
// um do outro no meio. Um por vez elimina a corrida (e o burst de CPU em grids).
let _fpvQueue=Promise.resolve();
function fRenderPreviewToCanvas(canvas, tmpl, opts){
  const job=_fpvQueue.then(()=>_fpvRun(canvas, tmpl, opts));
  _fpvQueue=job.catch(()=>{}); // falha de um render não trava a fila
  return job;
}
async function _fpvRun(canvas, tmpl, opts){
  if(!canvas || !tmpl || !tmpl.layers || !tmpl.layers.length) return false;
  opts=opts||{};
  const [W,H]=fMaterialSize(tmpl, null);
  const maxPx=opts.maxPx||900; // resolução do backing — suficiente p/ thumbs nítidos
  const scale=Math.min(1, maxPx/Math.max(W,H));
  const bw=Math.max(1,Math.round(W*scale)), bh=Math.max(1,Math.round(H*scale));
  // Guard de concorrência POR CANVAS: hover repetido re-renderiza; só o mais novo desenha.
  const renderId=(canvas._fpvId=(canvas._fpvId||0)+1);
  const off=document.createElement('canvas'); off.width=bw; off.height=bh;
  const octx=off.getContext('2d');
  octx.scale(scale,scale);
  const dados=opts.dados||fSampleDadosForLayers(tmpl.layers);
  const camp=opts.camp||{color:'#e8e8e8'};
  // Shim do material: o motor lê fState.material p/ fundo e espaço nativo das coords.
  const prevMat=(typeof fState!=='undefined')?fState.material:null;
  try{
    if(typeof fState!=='undefined') fState.material={layers:tmpl.layers, w:W, h:H, bg:tmpl.bg, fmt:tmpl.fmt};
    await fRenderTemplateLayers(octx, tmpl.layers, W, H, dados, camp);
  }catch(e){ console.warn('[preview] render falhou:', e); return false; }
  finally{ if(typeof fState!=='undefined') fState.material=prevMat; }
  if(canvas._fpvId!==renderId) return false; // um render mais novo assumiu este canvas
  canvas.width=bw; canvas.height=bh;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,bw,bh);
  ctx.drawImage(off,0,0);
  return true;
}
// Dados de amostra p/ preview: exemplo → valor padrão → [Rótulo], por campo do catálogo.
// Campos de imagem ficam vazios → o motor desenha o placeholder de moldura (igual à arte real).
function fSampleDadosForLayers(layers){
  const out={};
  const names=(typeof dExtractTemplateVars==='function')?dExtractTemplateVars(layers):[];
  names.forEach(n=>{
    const v=(typeof dVars!=='undefined'&&dVars)?dVars.find(x=>x.name===n):null;
    if(v&&v.type==='image') return;
    out[n]=(typeof gFieldSampleValue==='function')?gFieldSampleValue(v||{name:n}):((v&&(v.label||n))||n);
  });
  return out;
}

/* ── LUMA SHEETS BULK ACTIONS (IDEIA 1) ── */
function fBulkCollectCurrentInputs() {
  if (!_fBulkTableView) return;
  const keys = fBulkVars();
  fBulkRows.forEach((r, i) => {
    keys.forEach(k => {
      const el = document.getElementById(`f-bulk-edit-${i}-${k}`);
      if (el) {
        r.dados[k] = el.value;
      }
    });
  });
}

function fParsePriceNumber(str) {
  if (!str) return 0;
  let s = String(str).replace(/[^0-9.,]/g, ''); // mantém só dígitos, ponto e vírgula
  if (!s) return 0;
  if (s.includes(',')) {
    // Formato BR: vírgula é decimal, ponto é milhar → "1.234,56" vira "1234.56"
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes('.')) {
    // Só ponto: é milhar se o último grupo tem 3 dígitos ("1.234"); senão é decimal ("9.90")
    if (s.split('.').pop().length === 3) s = s.replace(/\./g, '');
  }
  const val = parseFloat(s);
  return isNaN(val) ? 0 : val;
}

function fFormatPriceNumber(val) {
  return 'R$ ' + val.toFixed(2).replace('.', ',');
}

function fBulkApplyFill() {
  fBulkCollectCurrentInputs();
  const col = document.getElementById('f-bulk-action-col')?.value;
  const val = document.getElementById('f-bulk-action-val')?.value;
  if (!col) return;
  if (val === undefined || val === '') {
    gToast('Digite um valor para preencher todas as linhas', 'warning');
    return;
  }
  
  // Aplica a máscara do campo (ex.: preço → "R$ 10,00") em vez de gravar cru, e revalida.
  const masked = (typeof fApplyMask === 'function') ? fApplyMask(col, val) : val;
  fBulkRows.forEach(r => {
    r.dados[col] = masked;
    _fBulkRevalidateCol(r, col);
  });

  gToast(`✓ Coluna "${col}" preenchida em todas as linhas`);
  fBulkRenderPreview();
}

// Revalida UMA coluna de uma linha após uma transformação em massa: em vez de só
// apagar o erro antigo (que deixava dado inválido "verde"), reexecuta fValidate.
function _fBulkRevalidateCol(r, col){
  r.erros = (r.erros||[]).filter(e => !e.includes(col));
  const err = (typeof fValidate==='function') ? fValidate(col, r.dados[col]) : null;
  if (err) r.erros.push(err);
}

async function fBulkApplyDiscountPrompt() {
  fBulkCollectCurrentInputs();
  const col = document.getElementById('f-bulk-action-col')?.value;
  if (!col) return;

  const isPrice = /preco|valor|min|taxa|de|por/i.test(col);
  if (!isPrice && !(await gConfirm(`A coluna "${col}" não parece ser de preço. Aplicar mesmo assim?`, {okLabel:'Aplicar'}))) return;

  const pctStr = await gPrompt('Percentual de desconto a aplicar:', '', {placeholder:'Ex.: 10 (para 10%)', title:'Aplicar desconto'});
  if (pctStr === null) return;
  const pct = parseFloat(String(pctStr).replace(',', '.'));
  if (isNaN(pct) || pct < 0 || pct > 100) {
    gToast('⚠ Percentual inválido (deve ser entre 0 e 100)', 'error');
    return;
  }

  fBulkRows.forEach(r => {
    const num = fParsePriceNumber(r.dados[col] || '');
    if (num > 0) {
      r.dados[col] = fFormatPriceNumber(num * (1 - pct / 100));
      _fBulkRevalidateCol(r, col);
    }
  });

  gToast(`✓ Desconto de ${pct}% aplicado à coluna "${col}"`);
  fBulkRenderPreview();
}

async function fBulkApplyRounding() {
  fBulkCollectCurrentInputs();
  const col = document.getElementById('f-bulk-action-col')?.value;
  if (!col) return;

  const isPrice = /preco|valor|min|taxa|de|por/i.test(col);
  if (!isPrice && !(await gConfirm(`A coluna "${col}" não parece ser de preço. Arredondar mesmo assim?`, {okLabel:'Arredondar'}))) return;

  fBulkRows.forEach(r => {
    const num = fParsePriceNumber(r.dados[col] || '');
    if (num > 0) {
      r.dados[col] = fFormatPriceNumber(Math.floor(num) + 0.90);
      _fBulkRevalidateCol(r, col);
    }
  });

  gToast(`✓ Valores da coluna "${col}" arredondados para final ,90`);
  fBulkRenderPreview();
}

// DEMONSTRAÇÃO: NÃO lê cardápio real (o navegador nem conseguiria, por CORS).
// Gera uma planilha de EXEMPLO conforme o tipo (pizza/sushi/burger…) como ponto de
// partida editável. A UI deixa isso explícito ("Demonstração") — sem fingir que
// baixou os produtos reais do franqueado.
async function fBulkImportFromLink() {
  const urlEl = document.getElementById('f-bulk-import-url');
  const url = urlEl ? urlEl.value.trim() : '';
  if (!url) {
    gToast('Digite um tipo (pizza, sushi, burger…) ou cole um link primeiro', 'warning');
    return;
  }

  const btn = document.querySelector('[onclick="fBulkImportFromLink()"]');
  const restore = gBtnLoading(btn, 'Gerando…');

  gToast('Gerando planilha de exemplo (demonstração)…');
  await new Promise(r => setTimeout(r, 500));

  // Escolhe o conjunto de exemplos pela palavra-chave (funciona com tipo OU link).
  let items = [];
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('pizza') || lowerUrl.includes('pizzaria')) {
    items = [
      { produto: 'Pizza Margherita G', precoDe: 'R$ 54,90', precoPor: 'R$ 44,90', validade: 'Válido até domingo', categoria: 'Pizzas' },
      { produto: 'Pizza Calabresa G', precoDe: 'R$ 49,90', precoPor: 'R$ 39,90', validade: 'Válido até domingo', categoria: 'Pizzas' },
      { produto: 'Pizza Quatro Queijos G', precoDe: 'R$ 59,90', precoPor: 'R$ 49,90', validade: 'Válido até domingo', categoria: 'Pizzas' },
      { produto: 'Borda Recheada de Catupiry', precoDe: 'R$ 15,00', precoPor: 'R$ 10,00', validade: 'Válido até domingo', categoria: 'Adicionais' },
      { produto: 'Coca-Cola 2 Litros', precoDe: 'R$ 12,00', precoPor: 'R$ 9,90', validade: 'Válido até domingo', categoria: 'Bebidas' }
    ];
  } else if (lowerUrl.includes('sushi') || lowerUrl.includes('japa') || lowerUrl.includes('japanese')) {
    items = [
      { produto: 'Combo Premium 30 Peças', precoDe: 'R$ 89,90', precoPor: 'R$ 69,90', validade: 'Só hoje', categoria: 'Combos' },
      { produto: 'Temaki Filadélfia Dobrado', precoDe: 'R$ 38,00', precoPor: 'R$ 29,90', validade: 'Só hoje', categoria: 'Temakis' },
      { produto: 'Hot Roll 10 unidades', precoDe: 'R$ 24,90', precoPor: 'R$ 19,90', validade: 'Só hoje', categoria: 'Entradas' },
      { produto: 'Combo Executivo Japa', precoDe: 'R$ 49,90', precoPor: 'R$ 39,90', validade: 'Só hoje', categoria: 'Combos' }
    ];
  } else if (lowerUrl.includes('burger') || lowerUrl.includes('burguer') || lowerUrl.includes('lanche')) {
    items = [
      { produto: 'X-Bacon Cheddar Duplo', precoDe: 'R$ 36,90', precoPor: 'R$ 29,90', validade: 'Promoção da semana', categoria: 'Lanches' },
      { produto: 'Monster Burger Crispy', precoDe: 'R$ 42,90', precoPor: 'R$ 34,90', validade: 'Promoção da semana', categoria: 'Lanches' },
      { produto: 'Batata Frita Turbinada G', precoDe: 'R$ 22,00', precoPor: 'R$ 17,90', validade: 'Promoção da semana', categoria: 'Acompanhamentos' },
      { produto: 'Combo Hamburguer + Batata + Refri', precoDe: 'R$ 49,90', precoPor: 'R$ 39,90', validade: 'Promoção da semana', categoria: 'Combos' }
    ];
  } else {
    // Genérico / Padrão
    items = [
      { produto: 'Prato Feito Executivo', precoDe: 'R$ 28,00', precoPor: 'R$ 22,90', validade: 'Almoço de segunda a sexta', categoria: 'Pratos Quentes' },
      { produto: 'Suco Natural de Laranja 500ml', precoDe: 'R$ 10,00', precoPor: 'R$ 7,90', validade: 'Almoço de segunda a sexta', categoria: 'Bebidas' },
      { produto: 'Marmita Econômica M', precoDe: 'R$ 22,00', precoPor: 'R$ 17,90', validade: 'Almoço de segunda a sexta', categoria: 'Pratos Quentes' },
      { produto: 'Sobremesa Pudim de Leite', precoDe: 'R$ 8,00', precoPor: 'R$ 5,90', validade: 'Almoço de segunda a sexta', categoria: 'Sobremesas' }
    ];
  }
  
  // Agora vamos injetar na planilha
  const keys = fBulkVars();
  fBulkRows = items.map(item => {
    const dados = {};
    keys.forEach(k => {
      // MAPEIA variáveis
      if (k === 'produto') dados[k] = item.produto;
      else if (k === 'precoDe') dados[k] = item.precoDe;
      else if (k === 'precoPor') dados[k] = item.precoPor;
      else if (k === 'validade') dados[k] = item.validade;
      else if (k === 'categoria') dados[k] = item.categoria;
      else {
        dados[k] = F_BULK_SAMPLES[k] ? F_BULK_SAMPLES[k][Math.floor(Math.random() * F_BULK_SAMPLES[k].length)] : '';
      }
    });
    return { dados, erros: [] };
  });
  
  restore();
  if (urlEl) urlEl.value = '';
  document.getElementById('f-bulk-status').textContent = `${fBulkRows.length} linha(s) carregada(s)`;
  gToast(`✓ ${fBulkRows.length} exemplos de demonstração — edite com os seus produtos reais`);

  _fBulkTableView = true;
  fBulkRenderPreview();
}

/* ── LUMA SHEETS MODELOS SALVOS (IDEIA 3) ── */
function fBulkUpdateSavedTemplatesList() {
  const wrap = document.getElementById('f-bulk-saved-wrap');
  const select = document.getElementById('f-bulk-saved-select');
  if(!wrap || !select) return;
  
  if(!fState.material) {
    wrap.style.display = 'none';
    return;
  }
  
  let store = { entries: [] };
  try {
    const raw = localStorage.getItem('_luma_saved_sheets');
    if(raw) store = JSON.parse(raw);
  } catch(e) {}
  if (!store || !Array.isArray(store.entries)) store = { entries: [] };
  
  const currentMatId = fState.material.id;
  const filtered = store.entries.filter(e => e.materialId === currentMatId);
  
  if(filtered.length === 0) {
    wrap.style.display = 'none';
    return;
  }
  
  wrap.style.display = 'inline-flex';
  select.innerHTML = `<option value="">-- Modelos Salvos (${filtered.length}) --</option>` +
    filtered.map(e => `<option value="${e.id}">${_dEsc ? _dEsc(e.name) : e.name}</option>`).join('');
}

async function fBulkSaveTemplate() {
  fBulkCollectCurrentInputs();
  if (!fBulkRows || fBulkRows.length === 0) {
    gToast('A planilha está vazia. Adicione algumas linhas antes de salvar', 'warning');
    return;
  }

  const name = await gPrompt('Nome deste modelo:', '', {placeholder:'Ex.: Ofertas de Quarta-Feira', title:'Salvar modelo'});
  if (name === null) return;
  const trimmed = name.trim();
  if (!trimmed) {
    gToast('⚠ Nome inválido', 'error');
    return;
  }

  let store = { entries: [] };
  try {
    const raw = localStorage.getItem('_luma_saved_sheets');
    if (raw) store = JSON.parse(raw);
  } catch (e) {}
  if (!store || !Array.isArray(store.entries)) store = { entries: [] };

  // NÃO persiste imagens base64 (data:) — inflam o localStorage (MB por linha) e estouram
  // a quota (mesmo princípio do "push nunca grava base64"). Guarda só texto/URLs; imagens
  // locais são reenviadas na hora de gerar o lote.
  let stripped = 0;
  const rows = fBulkRows.map(r => {
    const dados = {};
    Object.keys(r.dados).forEach(k => {
      const v = r.dados[k];
      if (typeof v === 'string' && v.startsWith('data:')) { dados[k] = ''; stripped++; }
      else dados[k] = v;
    });
    return { dados, erros: [] };
  });

  store.entries.push({ id: 't-' + Date.now(), name: trimmed, materialId: fState.material.id, rows });
  try {
    localStorage.setItem('_luma_saved_sheets', JSON.stringify(store));
  } catch (e) {
    gToast('⚠ Não foi possível salvar — armazenamento local cheio. Apague modelos antigos e tente de novo.', 'error');
    return;
  }

  gToast(stripped
    ? `✓ Modelo "${trimmed}" salvo (${stripped} imagem(ns) local(is) não ficam guardadas — reenvie ao gerar)`
    : `✓ Modelo "${trimmed}" salvo com sucesso!`);
  fBulkUpdateSavedTemplatesList();
}

async function fBulkLoadTemplate() {
  const select = document.getElementById('f-bulk-saved-select');
  if (!select) return;
  const id = select.value;
  if (!id) return;
  
  let store = { entries: [] };
  try {
    const raw = localStorage.getItem('_luma_saved_sheets');
    if (raw) store = JSON.parse(raw);
  } catch (e) {}
  if (!store || !Array.isArray(store.entries)) store = { entries: [] };
  
  const entry = store.entries.find(e => e.id === id);
  if (!entry) {
    gToast('⚠ Modelo não encontrado', 'error');
    return;
  }
  
  if (fBulkRows.length > 0) {
    if (!(await gConfirm('Isto vai substituir os dados atuais da planilha. Continuar?', {okLabel:'Substituir'}))) {
      select.value = '';
      return;
    }
  }

  fBulkRows = entry.rows.map(r => ({ dados: { ...r.dados }, erros: [] }));
  document.getElementById('f-bulk-status').textContent = `${fBulkRows.length} linha(s) carregada(s)`;
  gToast(`✓ Modelo "${entry.name}" carregado!`);
  
  _fBulkTableView = true;
  fBulkRenderPreview();
  select.value = '';
}

async function fBulkDeleteTemplate() {
  const select = document.getElementById('f-bulk-saved-select');
  if (!select) return;
  const id = select.value;
  if (!id) {
    gToast('Selecione o modelo que deseja excluir no seletor ao lado', 'warning');
    return;
  }

  let store = { entries: [] };
  try {
    const raw = localStorage.getItem('_luma_saved_sheets');
    if (raw) store = JSON.parse(raw);
  } catch (e) {}
  if (!store || !Array.isArray(store.entries)) store = { entries: [] };

  const entry = store.entries.find(e => e.id === id);
  if (!entry) return;

  if (!(await gConfirm(`Excluir permanentemente o modelo "${entry.name}"?`, {okLabel:'Excluir', danger:true}))) return;

  store.entries = store.entries.filter(e => e.id !== id);
  try {
    localStorage.setItem('_luma_saved_sheets', JSON.stringify(store));
  } catch (e) {}

  gToast(`✓ Modelo "${entry.name}" excluído`);
  fBulkUpdateSavedTemplatesList();
}

function fIsImageVar(varName) {
  if (!fState.material || !fState.material.layers) return false;
  const layer = fState.material.layers.find(l => l.varName === varName);
  if (layer && layer.type === 'image') return true;
  if (typeof dVars !== 'undefined' && dVars) {
    const v = dVars.find(x => x.name === varName);
    if (v && v.type === 'image') return true;
  }
  return /foto|imagem|img|logo/i.test(varName);
}

function fBulkUploadCellImage(input, i, k) {
  const file = input.files[0];
  if (!file) return;
  
  fBulkCollectCurrentInputs();
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const base64 = e.target.result;
    fBulkRows[i].dados[k] = base64;
    fBulkRows[i].erros = fBulkRows[i].erros.filter(err => !err.includes(k));
    const img = new Image();
    img.onload = function() {
      if (img.width < 600 || img.height < 600) {
        gToast(`⚠ Aviso: Imagem com resolução baixa (${img.width}x${img.height}px). Pode ficar pixelada no post final.`, 'warning');
      }
      fBulkRenderPreview();
    };
    img.onerror = function() {
      gToast('Erro ao carregar a imagem. Verifique se o arquivo está íntegro.', 'error');
    };
    img.src = base64;
    gToast('✓ Imagem carregada');
    fBulkRenderPreview();
  };
  reader.readAsDataURL(file);
}

function fBulkClearImage(i, k) {
  fBulkRows[i].dados[k] = '';
  fBulkRenderPreview();
}

/* ── LUMA SHEETS RODADA 2 FEATURES ── */
function fBulkAutoCategorize(prodName) {
  if (!prodName) return '';
  const low = prodName.toLowerCase();
  
  if (/coca|cola|pepsi|guarana|fanta|sprite|suco|cerveja|chopp|agua|água|refri|bebida|tônica|redbull/i.test(low)) {
    return 'Bebidas';
  }
  if (/pizza|pizzaria|borda|calabresa|marguerita|mussarela|queijo/i.test(low)) {
    return 'Pizzas';
  }
  if (/burger|burguer|hamburguer|hambúrguer|blend|lanche|x-bacon|x-salada|cheddar/i.test(low)) {
    return 'Lanches';
  }
  if (/sushi|temaki|hot roll|sashimi|yakisoba|japa|niguiri|sunomono/i.test(low)) {
    return 'Comida Japonesa';
  }
  if (/doce|sobremesa|pudim|bolo|sorvete|petit|mousse|brownie|nutella/i.test(low)) {
    return 'Sobremesas';
  }
  if (/marmita|marmitex|prato feito|executivo|almoço|jantar|lasanha|parmegiana|strogonoff/i.test(low)) {
    return 'Refeições';
  }
  if (/porção|porcao|batata frita|anéis de cebola|polenta|frito|entrada|fritas/i.test(low)) {
    return 'Porções / Entradas';
  }
  return '';
}

function fBulkRemoveDuplicates() {
  fBulkCollectCurrentInputs();
  const before = fBulkRows.length;
  
  const seen = new Set();
  fBulkRows = fBulkRows.filter(r => {
    // Cria uma assinatura limpa baseada apenas nos dados
    const signature = JSON.stringify(r.dados);
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
  
  const removed = before - fBulkRows.length;
  if (removed > 0) {
    document.getElementById('f-bulk-status').textContent = `${fBulkRows.length} linha(s) carregada(s)`;
    gToast(`✓ ${removed} linha(s) duplicada(s) removida(s)`);
    fBulkRenderPreview();
  } else {
    gToast('Nenhuma linha duplicada encontrada', 'info');
  }
}

function fBulkSortTable(type) {
  fBulkCollectCurrentInputs();
  if (!type) return;
  
  if (type === 'price') {
    fBulkRows.sort((a, b) => {
      const key = Object.keys(a.dados).find(k => /preco|valor|por/i.test(k)) || 'precoPor';
      const valA = fParsePriceNumber(a.dados[key] || '');
      const valB = fParsePriceNumber(b.dados[key] || '');
      return valA - valB;
    });
  } else if (type === 'name') {
    fBulkRows.sort((a, b) => {
      const key = Object.keys(a.dados).find(k => /produto|nome|titulo|desc/i.test(k)) || Object.keys(a.dados)[0] || '';
      const nameA = String(a.dados[key] || '').toLowerCase();
      const nameB = String(b.dados[key] || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }
  
  gToast(`✓ Tabela ordenada com sucesso`);
  fBulkRenderPreview();
  
  const sortSelect = document.getElementById('f-bulk-sort-select');
  if (sortSelect) sortSelect.value = '';
}
/* ══════════════════════════════════════════════════════════════════
   MOTOR DE COPY COMBINATÓRIO v2 — Tom de Voz Delivery Much
   Simples, amigável, direto. Zero emojis. Linguagem do cotidiano.
   ══════════════════════════════════════════════════════════════════ */

const _COPY_BLOCKS = {
  // ─── GANCHOS: espelham a realidade do cliente antes de vender ───
  hooks: {
    universal: [
      'Aquele dia que ninguem quer cozinhar.',
      'Fim de expediente, geladeira vazia, zero vontade de sair de casa.',
      'Quando bate a fome e voce nao quer pensar muito.',
      'Ninguem deveria ter que cozinhar depois de um dia desses.',
      'A preguica bateu. E ta tudo bem.',
      'Cozinhar hoje? Nem pensar.',
      'Tem dias que o jantar tem que ser facil.',
      'A fome chegou e a gente resolve.',
    ],
    pizzas: [
      'Noite de pizza e noite de pizza. Sem discussao.',
      'O combinado de sempre ou um sabor novo pra testar?',
      'A pizza chega quente e o problema do jantar ta resolvido.',
      'Pizza nao precisa de motivo. Mas se precisasse, hoje tem.',
    ],
    lanches: [
      'Aquele burger que resolve qualquer dia ruim.',
      'Blend na chapa, queijo derretendo, pao selado. Simples assim.',
      'Lanche bom nao precisa de apresentacao.',
      'O hamburguer do jeito que tem que ser.',
    ],
    japonesa: [
      'Japa hoje? A gente entrega fresco na sua porta.',
      'Hot roll, temaki, combinado — escolhe o teu.',
      'Comida japonesa fresquinha sem sair de casa.',
      'Aquele japa que voce merece.',
    ],
    bebidas: [
      'Pediu a comida e esqueceu da bebida? A gente resolve.',
      'Geladinha, do jeito que tem que ser.',
      'Nao tem refeicao completa sem uma bebida gelada.',
    ],
    sobremesas: [
      'Depois do jantar, aquele doce que faz o dia valer a pena.',
      'A sobremesa e a parte que ninguem pula.',
      'Pra fechar a refeicao com chave de ouro.',
    ],
    refeicoes: [
      'Almoco pronto, na sua mesa, sem estresse.',
      'Refeicao feita com cuidado, entregue no seu tempo.',
      'O prato do dia chegou. E veio caprichado.',
      'Comida de verdade, do jeito que voce gosta.',
    ],
    porcoes: [
      'Porcao pra dividir — ou nao, a gente nao julga.',
      'A entrada que vira prato principal.',
      'Pra beliscar enquanto o papo rola.',
    ],
    acai: [
      'Acai no capricho, do jeito que voce gosta.',
      'Calor la fora, acai gelado aqui dentro.',
      'O acai de todo dia, sempre do mesmo jeito bom.',
    ],
  },

  // ─── CORPO: apresenta produto + preco, concreto e direto ───
  bodies: {
    comDesconto: [
      '{prod} saindo de {de} por {por}.',
      '{prod} — de {de} por {por}. Valido {val}.',
      'Hoje o {prod} ta de {de} por {por}.',
      '{prod} por {por} (era {de}). Valido {val}.',
      'De {de} por {por} — {prod}.',
      '{prod}: antes {de}, agora {por}.',
      '{prod} saindo de {de} por {por}. **Voce economiza {economiaReais}!**',
      '{prod} de {de} por {por}. **Um desconto de {economiaPct} no seu jantar.**',
    ],
    semDesconto: [
      '{prod} por {por}.',
      '{prod} — {por}. Simples e bom.',
      'Hoje tem {prod} a {por}.',
      '{prod} saindo a {por}. Valido {val}.',
      '{prod} a {por}. Sem complicacao.',
      '{por} no {prod}. Direto ao ponto.',
    ],
    comPercentual: [
      '{prod} com {desconto} de desconto: sai a {por}.',
      '{desconto} OFF no {prod}. Preco final: {por}.',
      '{prod} por {por} — {desconto} a menos que o normal.',
      'Desconto de {desconto} no {prod}. Fica {por}.',
    ],
  },

  // ─── CTA: uma acao clara, sem pressao ───
  ctas: {
    delivery: [
      'Pede pelo app.',
      'Abre o app e faz teu pedido.',
      'Chama no delivery.',
      'Faz teu pedido agora.',
      'Pede pelo link na bio.',
      'Manda mensagem e a gente entrega.',
      'Ta no app, e so pedir.',
    ],
    engajamento: [
      'Marca aqui quem sempre pede isso com voce.',
      'Salva pra pedir depois.',
      'Manda pra quem ta com fome agora.',
      'Comenta qual e o teu pedido de sempre.',
      'Marca quem precisa ver isso.',
      'Manda pro grupo da galera.',
    ],
  },

  // ─── HASHTAGS por segmento ───
  hashtags: {
    universal: ['#delivery', '#pecaagora', '#comida', '#deliverymuch', '#pediu'],
    pizzas: ['#pizza', '#noitedepizza', '#pizzadelivery', '#pizzalovers'],
    lanches: ['#burger', '#hamburguer', '#lanche', '#smashburger', '#burgerlovers'],
    japonesa: ['#sushi', '#comidajaponesa', '#temaki', '#japa', '#sushilovers'],
    bebidas: ['#bebida', '#drinks', '#gelada', '#refrescante'],
    sobremesas: ['#sobremesa', '#doce', '#sweet', '#doceria'],
    refeicoes: ['#almoco', '#marmita', '#pratofeito', '#refeicao', '#comidacaseira'],
    porcoes: ['#porcao', '#entrada', '#petisco', '#aperitivo'],
    acai: ['#acai', '#acaibowl', '#acailovers', '#gelado'],
  },
};

/* Mapeia resultado de fBulkAutoCategorize para chave do COPY_BLOCKS */
function _fCopySegment(prod) {
  const cat = fBulkAutoCategorize(String(prod || ''));
  const map = {
    'Bebidas': 'bebidas', 'Pizzas': 'pizzas', 'Lanches': 'lanches',
    'Comida Japonesa': 'japonesa', 'Sobremesas': 'sobremesas',
    'Refeições': 'refeicoes', 'Porções / Entradas': 'porcoes',
  };
  // Açaí: detectar separadamente pois fBulkAutoCategorize não cobre
  if (/açaí|acai|açai/i.test(String(prod || '').toLowerCase())) return 'acai';
  return map[cat] || 'universal';
}

/* Sorteia N itens unicos de um array */
function _fPickRandom(arr, n) {
  if (!arr || arr.length === 0) return [];
  const shuffled = arr.slice().sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

/* Sorteia 1 item de um array */
function _fPick1(arr) {
  if (!arr || arr.length === 0) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

/* Interpola placeholders {prod}, {por}, {de}, {val}, {desconto}, {economiaReais}, {economiaPct} */
function _fInterpolate(template, data) {
  return template
    .replace(/\{prod\}/g, data.prod || '')
    .replace(/\{por\}/g, data.por || '')
    .replace(/\{de\}/g, data.de || '')
    .replace(/\{val\}/g, data.val || '')
    .replace(/\{desconto\}/g, data.desconto || '')
    .replace(/\{economiaReais\}/g, data.economiaReais || '')
    .replace(/\{economiaPct\}/g, data.economiaPct || '');
}

/* Monta UMA copy completa (feed ou stories) */
function _fAssembleCopy(prod, de, por, val, desc, format, segment, usedHooks, forceShort = false) {
  const B = _COPY_BLOCKS;
  
  // Escolher body baseado nos dados disponíveis + economia calculada
  let bodyPool;
  const numDe = fParsePriceNumber(de);
  const numPor = fParsePriceNumber(por);
  const hasSavings = numDe > 0 && numPor > 0 && numDe > numPor;
  
  if (desc && /\d+%/.test(desc)) {
    bodyPool = B.bodies.comPercentual;
  } else if (de && de !== '—' && de.trim()) {
    bodyPool = B.bodies.comDesconto;
    if (!hasSavings) {
      bodyPool = bodyPool.filter(tpl => !tpl.includes('{economiaReais}') && !tpl.includes('{economiaPct}'));
    }
  } else {
    bodyPool = B.bodies.semDesconto;
  }
  
  const formattedVal = _fFormatValidity(val);
  const diff = numDe - numPor;
  const economiaReais = hasSavings ? fFormatPriceNumber(diff) : '';
  const pct = hasSavings ? Math.round((diff / numDe) * 100) : 0;
  const economiaPct = hasSavings ? (pct + '%') : '';

  const data = { 
    prod: prod, 
    de: de, 
    por: por, 
    val: formattedVal, 
    desconto: desc,
    economiaReais: economiaReais,
    economiaPct: economiaPct
  };
  
  // Escolher pool de hooks: mistura segmento-específico + universal
  const segHooks = B.hooks[segment] || [];
  const allHooks = segHooks.concat(B.hooks.universal);
  const availHooks = allHooks.filter(h => !usedHooks.has(h));
  const hooksToUse = availHooks.length > 0 ? availHooks : allHooks;
  
  let hook = '';
  let body = '';
  
  if (forceShort) {
    // Busca a combinação (hook + body) <= 120 caracteres
    const validPairs = [];
    const allPairs = [];
    
    for (let h of hooksToUse) {
      for (let bTpl of bodyPool) {
        const bText = _fInterpolate(bTpl, data);
        const totalLen = h.length + 2 + bText.length;
        const pair = { hook: h, body: bText, len: totalLen };
        allPairs.push(pair);
        if (totalLen <= 120) {
          validPairs.push(pair);
        }
      }
    }
    
    let chosenPair;
    if (validPairs.length > 0) {
      chosenPair = _fPick1(validPairs);
    } else {
      // Fallback para a mais curta possível
      allPairs.sort((x, y) => x.len - y.len);
      chosenPair = allPairs[0];
    }
    
    hook = chosenPair.hook;
    body = chosenPair.body;
  } else {
    hook = _fPick1(hooksToUse);
    body = _fInterpolate(_fPick1(bodyPool), data);
  }
  
  usedHooks.add(hook);
  
  // Stories: formato curto (2-3 linhas, sem hashtag)
  if (format === 'stories') {
    const cta = _fPick1(B.ctas.delivery);
    return [hook, body, cta].join('\n');
  }
  
  // Feed: formato completo
  const ctaType = Math.random() > 0.5 ? 'delivery' : 'engajamento';
  const cta = _fPick1(B.ctas[ctaType]);
  
  // Validade como linha separada (evita duplicar se já estiver no corpo)
  const valLine = (formattedVal && !body.includes(formattedVal)) ? ('Valido ' + formattedVal + '.') : '';
  
  // Hashtags: 2 universais + 2-3 do segmento + hashtags locais (cidade)
  const cityInput = document.getElementById('f-bulk-city');
  const city = cityInput ? cityInput.value.trim() : '';
  
  const segTags = B.hashtags[segment] || [];
  const uniTags = _fPickRandom(B.hashtags.universal, 2);
  const specTags = _fPickRandom(segTags, 3);
  let allTagsList = uniTags.concat(specTags);
  
  if (city) {
    const cleanCity = _fSanitizeHashtagPart(city);
    if (cleanCity) {
      const localTags = [
        `#deliverymuch${cleanCity}`,
        `#${cleanCity}`,
        `#delivery${cleanCity}`
      ];
      allTagsList = allTagsList.concat(localTags);
    }
  }
  
  const uniqueTags = [...new Set(allTagsList)];
  const tags = uniqueTags.join(' ');
  
  // Montar
  const lines = [hook, '', body];
  if (valLine) lines.push(valLine);
  lines.push('', cta);
  if (tags) lines.push('', tags);
  
  return lines.join('\n');
}

/* Gera 3 opções de copy (substitui fGetSegmentedCaptions) */
function fBuildCopy(prod, de, por, val, desc, format) {
  const segment = _fCopySegment(prod);
  const usedHooks = new Set();
  
  return {
    op1: _fAssembleCopy(prod, de, por, val, desc, format || 'feed', segment, usedHooks, true),
    op2: _fAssembleCopy(prod, de, por, val, desc, format || 'feed', segment, usedHooks, false),
    op3: _fAssembleCopy(prod, de, por, val, desc, format || 'feed', segment, usedHooks, false),
  };
}

/* Retrocompatibilidade: mantém assinatura antiga caso algo externo chame */
function fGetSegmentedCaptions(prod, de, por, val, desc) {
  return fBuildCopy(prod, de, por, val, desc, 'feed');
}

let _fBulkHoverTimeout = null;

async function fBulkShowHoverPreview(event, i) {
  fBulkCollectCurrentInputs();
  const row = fBulkRows[i];
  if (!row) return;
  
  const popover = document.getElementById('f-bulk-hover-preview');
  const cv = document.getElementById('f-bulk-hover-preview-canvas');
  if (!popover || !cv) return;
  
  if (_fBulkHoverTimeout) clearTimeout(_fBulkHoverTimeout);
  
  const rect = event.currentTarget.getBoundingClientRect();
  popover.style.left = (rect.right + window.scrollX + 12) + 'px';
  popover.style.top = (rect.top + window.scrollY - 30) + 'px';
  popover.style.display = 'block';
  
  try {
    const [w,h] = fMaterialSize(fState.material, fState.fmt);
    const cw = 160;
    const ch = Math.round(cw * h / w);
    cv.width = cw;
    cv.height = ch;
    
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    
    await fRenderTemplateLayers(off.getContext('2d'), fState.material.layers, w, h, row.dados, fState.camp);
    
    const ctx = cv.getContext('2d');
    ctx.clearRect(0,0,cw,ch);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(off, 0, 0, w, h, 0, 0, cw, ch);
  } catch(e) {
    console.warn('[hover preview] falhou:', e);
  }
}

function fBulkHideHoverPreview() {
  if (_fBulkHoverTimeout) clearTimeout(_fBulkHoverTimeout);
  _fBulkHoverTimeout = setTimeout(() => {
    const popover = document.getElementById('f-bulk-hover-preview');
    if (popover) popover.style.display = 'none';
  }, 120);
}

function fBulkCloneRow(index) {
  fBulkCollectCurrentInputs();
  if (index < 0 || index >= fBulkRows.length) return;
  
  const original = fBulkRows[index];
  const cloned = {
    dados: { ...original.dados },
    erros: [ ...original.erros ]
  };
  
  fBulkRows.splice(index + 1, 0, cloned);
  
  document.getElementById('f-bulk-status').textContent = `${fBulkRows.length} linha(s) carregada(s)`;
  gToast('✓ Linha duplicada');
  fBulkRenderPreview();
}

/* ─── HELPERS E INTEGRAÇÃO DE COPYS (LUMA SHEETS) ─── */

function _fSanitizeHashtagPart(str) {
  if (!str) return '';
  return str
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function _fGetDayOfWeekName(dayIndex) {
  const days = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  return days[dayIndex];
}

function _fFormatValidity(val) {
  const day = new Date().getDay();
  let computedVal = val ? String(val).trim() : '';
  
  if (!computedVal) {
    if (day === 5 || day === 6 || day === 0) {
      return 'neste fim de semana';
    } else {
      return 'por tempo limitado';
    }
  }
  
  const dateRegex = /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/;
  const match = computedVal.match(dateRegex);
  if (match) {
    const dayStr = match[1];
    const monthStr = match[2];
    const yearStr = match[3];
    const fullMatch = match[0];
    
    const dayNum = parseInt(dayStr, 10);
    const monthNum = parseInt(monthStr, 10);
    let yearNum = yearStr ? parseInt(yearStr, 10) : new Date().getFullYear();
    if (yearStr && yearStr.length === 2) {
      yearNum += 2000;
    }
    
    const testDate = new Date(yearNum, monthNum - 1, dayNum);
    if (!isNaN(testDate.getTime()) && testDate.getDate() === dayNum && (testDate.getMonth() + 1) === monthNum) {
      const dayName = _fGetDayOfWeekName(testDate.getDay());
      const cleanVal = computedVal.toLowerCase().replace(/até\s+/g, '').trim();
      const cleanMatch = fullMatch.toLowerCase().trim();
      if (cleanVal === cleanMatch) {
        return `até ${dayName} (${fullMatch})`;
      }
    }
  }
  
  return computedVal;
}

function fBulkShowCopyModal(i) {
  fBulkCollectCurrentInputs();
  const row = fBulkRows[i];
  if (!row) return;
  
  const keys = fBulkVars();
  const nameKey = keys.find(v => /produto|titulo|nome/i.test(v)) || keys[0] || '';
  const deKey = keys.find(v => /de|antigo/i.test(v)) || '';
  const porKey = keys.find(v => /por|preco|preço|atual|valor/i.test(v)) || '';
  const valKey = keys.find(v => /validade|data|condicao|condição/i.test(v)) || '';
  const descKey = keys.find(v => /desconto|selo|off/i.test(v)) || '';
  
  const prod = row.dados[nameKey] || ('Produto ' + (i + 1));
  const de = deKey ? (row.dados[deKey] || '') : '';
  const por = porKey ? (row.dados[porKey] || '') : '';
  const val = valKey ? (row.dados[valKey] || '') : '';
  const desc = descKey ? (row.dados[descKey] || '') : '';
  
  const copyFormat = (document.getElementById('f-bulk-copy-format') || {}).value || 'feed';
  const copys = fBuildCopy(prod, de, por, val, desc, copyFormat);
  
  const productInfoDiv = document.getElementById('f-copy-modal-product-info');
  if (productInfoDiv) {
    productInfoDiv.textContent = `Gerando sugestões para: ${prod} ${por ? `(${por})` : ''}`;
  }
  
  const optionsDiv = document.getElementById('f-copy-modal-options');
  if (optionsDiv) {
    optionsDiv.innerHTML = '';
    
    [copys.op1, copys.op2, copys.op3].forEach((text, index) => {
      const optionContainer = document.createElement('div');
      optionContainer.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--gray-mid,#D4D4D4);border-radius:8px;background:var(--white,#FFFFFF)';
      
      const headerDiv = document.createElement('div');
      headerDiv.style.cssText = 'display:flex;justify-content:space-between;align-items:center';
      
      const titleSpan = document.createElement('span');
      titleSpan.style.cssText = 'font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--dm-orange,#FF9000)';
      titleSpan.textContent = `Opção ${index + 1} ${index === 0 ? '(Direta - Sob limite)' : ''}`;
      
      const copyBtn = document.createElement('button');
      copyBtn.className = 'd-btn-sec';
      copyBtn.style.cssText = 'font-size:11px;padding:4px 8px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;border-radius:4px;font-weight:600';
      copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiar`;
      
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(text).then(() => {
          gToast('Legenda copiada!');
          copyBtn.style.color = 'var(--green-text,#15803d)';
          copyBtn.style.borderColor = 'var(--green-text,#15803d)';
          setTimeout(() => {
            copyBtn.style.color = '';
            copyBtn.style.borderColor = '';
          }, 2000);
        }).catch(err => {
          console.error('Failed to copy text: ', err);
          gToast('Erro ao copiar legenda', 'error');
        });
      };
      
      headerDiv.appendChild(titleSpan);
      headerDiv.appendChild(copyBtn);
      
      const textPre = document.createElement('pre');
      textPre.style.cssText = 'margin:0;font-family:inherit;font-size:12px;color:var(--text,#0A0A0A);white-space:pre-wrap;word-break:break-word;line-height:1.5';
      textPre.textContent = text;
      
      optionContainer.appendChild(headerDiv);
      optionContainer.appendChild(textPre);
      optionsDiv.appendChild(optionContainer);
    });
  }
  
  document.getElementById('f-copy-modal').classList.add('open');
}

function fCloseCopyModal() {
  document.getElementById('f-copy-modal').classList.remove('open');
}
