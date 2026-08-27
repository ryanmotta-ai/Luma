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
    // Exporta em 2× a resolução nativa. Antes renderizava 2× e fazia downscale de
    // volta pro nativo — o dobro de pixel era jogado fora, servindo só de anti-serrilhado.
    // Manter o 2× = PNG bem mais nítido pra tela/zoom/impressão. Custo zero de storage:
    // o PNG só existe no clique de baixar, não fica salvo. w/h nativos seguem sendo a base.
    const SCALE = 2;
    const renderCv = document.createElement('canvas');
    renderCv.width = w * SCALE;
    renderCv.height = h * SCALE;
    const renderCtx = renderCv.getContext('2d');
    renderCtx.imageSmoothingEnabled = true;
    renderCtx.imageSmoothingQuality = 'high';
    renderCtx.scale(SCALE, SCALE);
    await fRenderTemplateLayers(renderCtx, fState.material.layers, w, h, d, c, null,
      {scope:'franqueado',purpose:'export'});
    await fDrawDMLogo(renderCtx, w, h);
    return renderCv;
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
  if(typeof window.gPlayExportSuccessSound==='function') window.gPlayExportSuccessSound();
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
  if(typeof window.gPlayExportSuccessSound==='function') window.gPlayExportSuccessSound();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}

// Compartilha a arte (imagem + legenda) via Web Share API — atalho pra WhatsApp/Instagram
// sem "baixar → abrir app → anexar". O Luma continua só ENTREGANDO o arquivo (não posta).
// Sem suporte a compartilhar arquivos (ex.: desktop), cai em baixar + copiar legenda.
async function fCompartilhar(btn, snapId){
  const snap=(snapId && typeof _fArtSnapshots!=='undefined' && _fArtSnapshots[snapId])
    || {dados:fState.dados,camp:fState.camp,fmt:fState.fmt,histId:fState._lastHistId,material:fState.material};
  const cap=(typeof _fActiveCaptionText==='function') ? _fActiveCaptionText(snapId) : '';
  const prevMat=fState.material;
  if(snap.material) fState.material=snap.material; // renderiza com o material DESTA arte
  try{
    const canvas=await fRenderCanvasHelper(snap.dados,snap.camp,snap.fmt);
    const fname=fBuildFilename(snap.camp,snap.fmt,snap.dados);
    const blob=await new Promise(res=>canvas.toBlob(res,'image/png'));
    const file=blob ? new File([blob],fname,{type:'image/png'}) : null;
    const canShareFiles = file && navigator.canShare && navigator.canShare({files:[file]});
    if(canShareFiles){
      await navigator.share({files:[file], text:cap||undefined, title:'Delivery Much'});
      if(snap.histId){ fMarkHistBaixada(snap.histId); } else { fAddHist(snap.dados,snap.camp,snap.fmt,'baixada'); }
      if(typeof gTrackEvent==='function') gTrackEvent('arte_baixada',{camp_id:snap.camp.id,fmt_id:snap.fmt.id,tipo:'png',via:'share'});
    } else {
      // Fallback (desktop / sem Web Share de arquivos): baixa a imagem e copia a legenda.
      const a=document.createElement('a'); a.download=fname; a.href=canvas.toDataURL('image/png'); a.click();
      if(cap && typeof _fCopyText==='function') _fCopyText(cap);
      if(snap.histId){ fMarkHistBaixada(snap.histId); } else { fAddHist(snap.dados,snap.camp,snap.fmt,'baixada'); }
      gToast(cap ? 'Compartilhamento não disponível aqui — baixei a imagem e copiei a legenda.' : 'Compartilhamento não disponível aqui — baixei a imagem.');
    }
  }catch(e){
    if(e && e.name==='AbortError') return; // usuário cancelou o share nativo — silencioso
    console.warn('Falha ao compartilhar:',e);
    if(typeof gHandleLayoutUnsafeError==='function'&&gHandleLayoutUnsafeError(e))return;
    gToast('Não consegui compartilhar. Tente o botão Baixar.','error');
  }finally{ fState.material=prevMat; }
}

// Rodapé de marca da ferramenta (Luma) — DESATIVADO: a arte gerada é da loja do
// franqueado, então a marca do Luma não deve ser queimada no PNG/PDF final. Mantido
// como no-op pra não quebrar os pontos de chamada (download, resultado, fallback).
async function fDrawDMLogo(ctx, w, h){
  return; // não desenha nenhuma logo de marca no resultado final
}

// ── Camadas de ajuste importadas do Photoshop ────────────────────────────────
// Opera em ImageData para que o mesmo resultado sirva preview, PNG e mockup. A função é
// propositalmente pública: o QA consegue testar a matemática sem montar uma tela inteira.
function fAdjustImageData(id, adj){
  if(!id||!id.data||!adj||!adj.type)return id;
  const d=id.data, type=String(adj.type).toLowerCase();
  const clamp=(v,a=0,b=255)=>Math.max(a,Math.min(b,v));
  const curveLut=(nodes)=>{
    const ns=(nodes&&nodes.length?nodes:[{input:0,output:0},{input:255,output:255}]).slice().sort((a,b)=>(+a.input||0)-(+b.input||0)),lut=new Uint8ClampedArray(256);
    for(let v=0,n=1;v<256;v++){
      while(n<ns.length&&v>ns[n].input)n++;
      if(v<=ns[0].input)lut[v]=clamp(+ns[0].output||0);
      else if(n>=ns.length)lut[v]=clamp(+ns[ns.length-1].output||0);
      else{const p=ns[n-1],q=ns[n],den=(q.input-p.input)||1,t=(v-p.input)/den;lut[v]=clamp(p.output+(q.output-p.output)*t);}
    }
    return lut;
  };
  const level=(v,c)=>{if(!c)return v;const lo=+c.shadowInput||0,hi=c.highlightInput!=null?+c.highlightInput:255,den=Math.max(1,hi-lo);let n=clamp((v-lo)/den,0,1);const g=Math.max(.01,+c.midtoneInput||1);n=Math.pow(n,1/g);const a=+c.shadowOutput||0,b=c.highlightOutput!=null?+c.highlightOutput:255;return clamp(a+n*(b-a));};
  const rgbToHsl=(r,g,b)=>{
    r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2;if(mx===mn)return[0,0,l];const x=mx-mn,s=l>.5?x/(2-mx-mn):x/(mx+mn);let h=mx===r?((g-b)/x+(g<b?6:0)):mx===g?((b-r)/x+2):((r-g)/x+4);return[h/6,s,l];
  };
  const hue=(p,q,t)=>{if(t<0)t++;if(t>1)t--;return t<1/6?p+(q-p)*6*t:t<1/2?q:t<2/3?p+(q-p)*(2/3-t)*6:p;};
  const hslToRgb=(h,s,l)=>{if(!s){const v=l*255;return[v,v,v];}const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;return[hue(p,q,h+1/3)*255,hue(p,q,h)*255,hue(p,q,h-1/3)*255];};
  const makeLut=fn=>{const out=new Uint8ClampedArray(256);for(let v=0;v<256;v++)out[v]=clamp(fn(v));return out;};
  let lutR=null,lutG=null,lutB=null;
  if(type==='brightness/contrast'){
    const br=clamp(+adj.brightness||0,-100,100)/100,ct=clamp(+adj.contrast||0,-99,99)/100;
    const lut=makeLut(v=>{v=br<0?v*(1+br):v+(255-v)*br;return(v-127.5)*((1+ct)/(1-ct))+127.5;});lutR=lutG=lutB=lut;
  }else if(type==='levels'){
    lutR=makeLut(v=>level(level(v,adj.rgb),adj.red));lutG=makeLut(v=>level(level(v,adj.rgb),adj.green));lutB=makeLut(v=>level(level(v,adj.rgb),adj.blue));
  }else if(type==='curves'){
    const all=curveLut(adj.rgb),r=curveLut(adj.red),g=curveLut(adj.green),b=curveLut(adj.blue);
    lutR=makeLut(v=>r[all[v]]);lutG=makeLut(v=>g[all[v]]);lutB=makeLut(v=>b[all[v]]);
  }else if(type==='exposure'){
    const mul=Math.pow(2,+adj.exposure||0),off=(+adj.offset||0)*255,ga=Math.max(.01,+adj.gamma||1),lut=makeLut(v=>Math.pow(clamp((v*mul+off)/255,0,1),1/ga)*255);lutR=lutG=lutB=lut;
  }else if(type==='invert'){
    const lut=makeLut(v=>255-v);lutR=lutG=lutB=lut;
  }else if(type==='posterize'){
    const n=Math.max(2,Math.round(+adj.levels||4)),q=255/(n-1),lut=makeLut(v=>Math.round(v/q)*q);lutR=lutG=lutB=lut;
  }
  for(let i=0;i<d.length;i+=4){
    if(!d[i+3])continue;
    let r=d[i],g=d[i+1],b=d[i+2];
    if(lutR){r=lutR[r];g=lutG[g];b=lutB[b];
    }else if(type==='hue/saturation'||type==='vibrance'){
      let hsl=rgbToHsl(r,g,b),dh=0,ds=0,dl=0;
      if(type==='hue/saturation'){const m=adj.master||{};dh=(+m.hue||0)/360;ds=(+m.saturation||0)/100;dl=(+m.lightness||0)/100;}
      else {const sat=(+adj.saturation||0)/100,vib=(+adj.vibrance||0)/100;ds=sat+vib*(1-hsl[1]);}
      hsl[0]=(hsl[0]+dh+1)%1;hsl[1]=clamp(hsl[1]+(ds>=0?(1-hsl[1])*ds:hsl[1]*ds),0,1);hsl[2]=clamp(hsl[2]+(dl>=0?(1-hsl[2])*dl:hsl[2]*dl),0,1);[r,g,b]=hslToRgb(hsl[0],hsl[1],hsl[2]);
    }else if(type==='threshold'){const y=.299*r+.587*g+.114*b,v=y>=(adj.level!=null?+adj.level:128)?255:0;r=g=b=v;
    }else continue;
    d[i]=Math.round(clamp(r));d[i+1]=Math.round(clamp(g));d[i+2]=Math.round(clamp(b));
  }
  return id;
}

// Renderiza os layers do template, substituindo {{var}} pelos dados reais do franqueado
async function fRenderTemplateLayers(ctx, layers, W, H, dados, camp, materialOverride, renderOpts){
  renderOpts=renderOpts||{};
  // Fail-safe: chamadas sem escopo são tratadas como autoria. Só um consumidor que se declara
  // `franqueado` pode executar o Auto-layout temporário.
  const _renderScope=renderOpts.scope||'designer';
  // Garante que as fontes (Roboto + enviadas pelo usuário) estejam carregadas antes
  // de desenhar texto no canvas — senão a primeira geração sai com fonte fallback.
  if(document.fonts && document.fonts.ready){ try{ await document.fonts.ready; }catch(e){} }
  // Quality flags pra anti-aliasing e renderização nítida
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // Fundo da prancheta/campanha
  const _renderMaterial=materialOverride||(typeof fState!=='undefined'?fState.material:null)||{layers,w:W,h:H,fmt:'orig'};
  const _matBg=_renderMaterial.bg&&_renderMaterial.bg!=='transparent'?_renderMaterial.bg:null;
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
  const fmtSizes = {story:[1080,1920], feed:[1080,1350], wide:[1200,628], post:[1200,628], horizontal:[1920,1080]};
  // Espaço nativo das coords do template: w/h reais (1:1 do PSD) ou o preset do formato (legado).
  // Quando o material tem w/h reais e está sendo renderizado no próprio tamanho, tw/th==W/H → sem reflow.
  const [tw, th] = fMaterialSize(_renderMaterial);
  let geomLayers = layers;
  if((tw !== W || th !== H) && typeof gReflowLayers === 'function'){
    const fmtKey = Object.keys(fmtSizes).find(k => fmtSizes[k][0]===W && fmtSizes[k][1]===H);
    geomLayers = gReflowLayers(layers, {w:tw,h:th}, {w:W,h:H}, {fmtKey: fmtKey ? gFmtKey(fmtKey) : null});
  }
  // Aplica bindings (4.1) e regras condicionais (4.2) ANTES de filtrar visibilidade.
  const _defaults = (typeof gVarDefaults==='function') ? gVarDefaults() : null;
  let effective = geomLayers.map(l=>{
    let eff = (typeof gApplyBindings==='function') ? gApplyBindings(l, dados, {defaults:_defaults}) : l;
    if(typeof gApplyRules==='function') eff = gApplyRules(eff, dados, {defaults:_defaults});
    return eff;
  });
  // Âncoras manuais existem nos dois lados; Auto-layout inferido só existe no runtime do
  // franqueado. Calculamos original e acomodado em CLONES independentes — o template publicado
  // nunca recebe x/y/fonte temporários.
  if(typeof gApplyRelativeAnchors==='function'){
    const original=gApplyRelativeAnchors(effective,dados,_defaults,{fitText:false,canvas:{w:W,h:H},scope:_renderScope});
    const disponivel=_renderScope==='franqueado'
      &&((typeof gLayoutVivoDisponivel==='function')?gLayoutVivoDisponivel():true);
    if(disponivel){
      // A ENTRADA do solver, guardada antes de `effective` virar o resultado: o diagnóstico
      // re-roda o motor com valores encurtados e precisa partir do mesmo ponto de partida.
      const entradaLayout=effective;
      const solved=gApplyRelativeAnchors(effective,dados,_defaults,{fitText:true,canvas:{w:W,h:H},scope:'franqueado'});
      const result=(typeof gDescribeFranchiseeLayout==='function')
        ?gDescribeFranchiseeLayout(original,solved)
        :{status:'adapted',adapted:true,invalid:false,requiresAdaptation:true,forced:false,changes:[],invalidIds:[]};
      const prefereOriginal=(typeof gLayoutVivoOff!=='undefined')&&gLayoutVivoOff;
      result.forced=!!(prefereOriginal&&result.requiresAdaptation);
      effective=(prefereOriginal&&!result.requiresAdaptation)?original:solved;
      effective._layoutResult=result;
      window.gLastFranchiseeLayoutResult=result;
      /* DIAGNÓSTICO ACIONÁVEL. Só quando a composição REPROVOU: a busca binária re-roda o solver
         algumas vezes, e isso não pode entrar no laço da digitação. Aqui já é o caminho de
         falha, onde o custo se paga em o franqueado saber o que fazer. */
      if(result.invalid&&typeof gLayoutDiagnosis==='function'){
        result.diagnostico=gLayoutDiagnosis(entradaLayout,dados,_defaults,
          {fitText:true,canvas:{w:W,h:H},scope:'franqueado'},solved);
      }
      if(typeof gLayoutTelemetry==='function'){
        if(result.meta&&typeof gLayoutFonteStatusArte==='function')
          result.meta.fonte=gLayoutFonteStatusArte(solved);
        gLayoutTelemetry(result,{purpose:renderOpts.purpose||'preview',
          template:(_renderMaterial&&(_renderMaterial.templateId||_renderMaterial.template_id))||null,
          material:(_renderMaterial&&(_renderMaterial.id||_renderMaterial.nome))||null,
          formato:W+'x'+H});
      }
      if(result.invalid&&renderOpts.purpose==='export'){
        const err=new Error((result.diagnostico&&result.diagnostico.mensagem)
          ||'A arte não tem espaço seguro para estes dados. Encurte o texto ou escolha outro material.');
        err.code='LUMA_LAYOUT_UNSAFE';err.layoutResult=result;throw err;
      }
    }else{
      effective=original;
      effective._layoutResult={status:'original',adapted:false,invalid:false,
        requiresAdaptation:false,forced:false,changes:[],invalidIds:[]};
    }
  }
  // O renderer continua único: prévia e exportação recebem exatamente o mesmo clone resolvido.
  // Renderiza só layers visíveis (geometria já está no formato alvo → escala 1:1)
  const visible = effective.filter(l => l.visible !== false);
  // PRÉ-CARGA PARALELA: o loop abaixo espera imagem por imagem (await em série) — com os
  // rasters de PSD por URL (pós-Storage), o 1º render custava a SOMA dos downloads.
  // Dispara tudo junto; o loop acha no _fImgCache e o tempo vira o da imagem mais lenta.
  try{
    const _urls=[];
    for(const l of visible){
      if(typeof l.imgUrl==='string' && l.imgUrl) _urls.push(l.imgUrl);
      if(typeof l.mask==='string' && l.mask) _urls.push(l.mask);
      // Máscaras da composição de grupo/clipping (PSD): sem elas aqui, cada recorte volta a ser
      // um download EM SÉRIE dentro do loop — exatamente o custo que esta pré-carga existe para
      // matar. A do grupo entra pelo próprio `l.mask` acima (grupo é camada); falta a do
      // clipping editável, que mora num campo separado.
      if(typeof l.clipOwnMask==='string' && l.clipOwnMask) _urls.push(l.clipOwnMask);
      if(l.imgVar && dados && typeof dados[l.imgVar]==='string' && dados[l.imgVar]) _urls.push(dados[l.imgVar]);
    }
    await Promise.all(_urls.map(u=>fLoadImageDataUrl(u)));
  }catch(e){}
  const _layerById=new Map(effective.filter(l=>l&&l.id).map(l=>[l.id,l]));
  const _groupById=new Map(effective.filter(l=>l&&l.type==='group'&&l.id).map(l=>[l.id,l]));

  // Desenha uma folha da árvore. `clipBaseId` é a clipping mask EDITÁVEL: o alpha vem da
  // camada-base no estado atual, não do PNG congelado no momento da importação do PSD.
  async function _fRenderLeaf(target,l){
    const _bm=l.blendMode&&l.blendMode!=='normal'?l.blendMode:'normal';
    const _native=(typeof dBlendToComposite==='function')?dBlendToComposite(_bm):null;
    // Modos sem equivalente nativo no Canvas 2D → fallback pixel-a-pixel via dBlendImageData
    const _needsSw=_bm!=='normal'&&_native===null&&typeof dBlendImageData==='function';
    const _clipLink=l.clipBaseId&&_layerById.get(l.clipBaseId);
    // Enquanto a base não foi editada, o alpha salvo pelo próprio Photoshop é mais fiel nas
    // bordas antialias. Ao mudar geometria/formato/máscara, troca automaticamente para o vínculo
    // vivo — precisão no primeiro render e editabilidade depois, sem botão nem estado manual.
    const _clipNow=_clipLink&&{x:_clipLink.x,y:_clipLink.y,w:_clipLink.w,h:_clipLink.h,shapeKind:_clipLink.shapeKind||'rect',radius:_clipLink.radius||0,radii:_clipLink.radii||null,points:_clipLink.points||null,sides:_clipLink.sides||null,inner:_clipLink.inner||null,vectorPath:_clipLink.vectorPath||null,maskSize:_clipLink.mask?_clipLink.mask.length:0};
    const _clipBase=_clipLink&&(!l.clipBaseSnapshot||JSON.stringify(_clipNow)!==JSON.stringify(l.clipBaseSnapshot))?_clipLink:null;
    if(l.mask||_clipBase||_needsSw){
      // Ambos os casos precisam de offscreen: máscara e/ou blend software.
      // ATENÇÃO: o ctx pai pode estar com super-sampling (scale 2×) no download. O
      // offscreen precisa ter a resolução de DISPOSITIVO (W*sx × H*sy) e a mesma
      // transform — senão o conteúdo sai em meia escala no canto (bug: prévia 1× ok,
      // download 2× quebrado).
      const _tf=(typeof target.getTransform==='function')?target.getTransform():{a:1,d:1};
      const _sx=_tf.a||1, _sy=_tf.d||1;
      const oc=document.createElement('canvas');
      oc.width=Math.max(1,Math.round(W*_sx)); oc.height=Math.max(1,Math.round(H*_sy));
      const octx=oc.getContext('2d');
      try{ octx.setTransform(_tf); }catch(e){}
      octx.imageSmoothingEnabled=true; octx.imageSmoothingQuality='high';
      // Renderiza no offscreen sem blend (source-over) — blend aplicado abaixo
      const _lNoBm=_needsSw?Object.assign({},l,{blendMode:'normal'}):l;
      await fRenderOneLayer(octx, _lNoBm, dados, 1, 1);
      // Com clipping dinâmico, `mask` continua como fallback do DOM legado; no Canvas usamos
      // apenas a máscara própria (layer/vector/group) para não multiplicar a borda duas vezes.
      const _ownMask=_clipBase?l.clipOwnMask:l.mask;
      if(_ownMask){
        try{
          const mimg=await fLoadImageDataUrl(_ownMask);
          if(mimg){ octx.save(); octx.globalCompositeOperation='destination-in'; octx.drawImage(mimg,l.x,l.y,l.w,l.h); octx.restore(); }
        }catch(e){}
      }
      if(_clipBase){
        // O Photoshop usa a transparência do CONTEÚDO da base, sem sombra/glow/contorno de
        // efeito. Renderizar a primitiva outra vez mantém o vínculo vivo quando ela é editada.
        const mc=document.createElement('canvas'); mc.width=oc.width; mc.height=oc.height;
        const mctx=mc.getContext('2d'); try{ mctx.setTransform(_tf); }catch(e){}
        const clean=Object.assign({},_clipBase,{opacity:100,blendMode:'normal',shadow:false,glow:false,innerShadow:false,innerGlow:false,bevel:false,overlay:false,gradientOverlay:null,strokeW:0});
        await fRenderOneLayer(mctx,clean,dados,1,1);
        if(_clipBase.mask){
          try{ const bm=await fLoadImageDataUrl(_clipBase.mask); if(bm){mctx.save();mctx.globalCompositeOperation='destination-in';mctx.drawImage(bm,_clipBase.x,_clipBase.y,_clipBase.w,_clipBase.h);mctx.restore();} }catch(e){}
        }
        octx.save(); octx.setTransform(1,0,0,1,0,0); octx.globalCompositeOperation='destination-in'; octx.drawImage(mc,0,0); octx.restore();
      }
      if(_needsSw){
        // Blend pixel-a-pixel restrito à bbox do layer, em coords de DISPOSITIVO
        // (getImageData/putImageData ignoram a transform → multiplica pela escala).
        const bx=Math.max(0,Math.round(l.x*_sx)), by=Math.max(0,Math.round(l.y*_sy));
        const bw=Math.min(oc.width-bx,Math.max(1,Math.round(l.w*_sx)));
        const bh=Math.min(oc.height-by,Math.max(1,Math.round(l.h*_sy)));
        if(bw>0&&bh>0){
          const topData=octx.getImageData(bx,by,bw,bh);
          const botData=target.getImageData(bx,by,bw,bh);
          dBlendImageData(_bm,topData,botData);
          target.putImageData(botData,bx,by);
        }
      }else{
        // Camada mascarada com blend NATIVO: aplica o composite na composição final contra o
        // fundo. Antes caía em source-over → o multiply/screen/etc. sumia no PNG (editor mostrava).
        target.save(); target.setTransform(1,0,0,1,0,0);
        if(_bm!=='normal' && _native) target.globalCompositeOperation=_native;
        target.drawImage(oc,0,0); target.restore();
      }
    }else{
      await fRenderOneLayer(target, l, dados, 1, 1);
    }
  }

  // Ajuste não desenha um objeto: transforma a composição que já existe abaixo dele. Máscara,
  // clipping, opacidade e blend continuam incidindo como em qualquer camada do Photoshop.
  async function _fRenderAdjustment(target,l){
    if(!l.adjustment||l.adjustmentSupported===false)return;
    const tf=(typeof target.getTransform==='function')?target.getTransform():{a:1,d:1};
    const sx=tf.a||1,sy=tf.d||1,dw=Math.max(1,Math.round(W*sx)),dh=Math.max(1,Math.round(H*sy));
    const original=target.getImageData(0,0,dw,dh), adjusted=target.createImageData(dw,dh);
    adjusted.data.set(original.data); fAdjustImageData(adjusted,l.adjustment);
    let maskData=null;
    if(l.mask||l.clipBaseId){
      const mc=document.createElement('canvas');mc.width=dw;mc.height=dh;const mx=mc.getContext('2d');try{mx.setTransform(tf);}catch(e){}
      mx.fillStyle='#fff';mx.fillRect(0,0,W,H);
      if(l.mask){try{const mi=await fLoadImageDataUrl(l.mask);if(mi){mx.globalCompositeOperation='destination-in';mx.drawImage(mi,l.x||0,l.y||0,l.w||W,l.h||H);mx.globalCompositeOperation='source-over';}}catch(e){}}
      const base=l.clipBaseId&&_layerById.get(l.clipBaseId);
      if(base){
        const bc=document.createElement('canvas');bc.width=dw;bc.height=dh;const bx=bc.getContext('2d');try{bx.setTransform(tf);}catch(e){}
        const clean=Object.assign({},base,{opacity:100,blendMode:'normal',shadow:false,glow:false,innerShadow:false,innerGlow:false,bevel:false,overlay:false,gradientOverlay:null,strokeW:0});
        await fRenderOneLayer(bx,clean,dados,1,1);
        if(base.mask){try{const bi=await fLoadImageDataUrl(base.mask);if(bi){bx.globalCompositeOperation='destination-in';bx.drawImage(bi,base.x,base.y,base.w,base.h);}}catch(e){}}
        mx.save();mx.setTransform(1,0,0,1,0,0);mx.globalCompositeOperation='destination-in';mx.drawImage(bc,0,0);mx.restore();
      }
      maskData=mx.getImageData(0,0,dw,dh).data;
    }
    const opacity=(l.opacity!=null?l.opacity:100)/100,bm=l.blendMode&&l.blendMode!=='normal'?l.blendMode:'normal';
    if(bm!=='normal'&&typeof dBlendImageData==='function'){
      for(let i=3;i<adjusted.data.length;i+=4)adjusted.data[i]=Math.round(original.data[i]*opacity*(maskData?maskData[i]/255:1));
      dBlendImageData(bm,adjusted,original);
    }else{
      // O ajuste muda o RGB existente sem mudar seu alpha. Multiplicar de novo pelo alpha do
      // backdrop deixava pixels semitransparentes com só metade do ajuste.
      for(let i=0;i<original.data.length;i+=4){const a=opacity*(maskData?maskData[i+3]/255:1);if(!a||!original.data[i+3])continue;original.data[i]=Math.round(original.data[i]+(adjusted.data[i]-original.data[i])*a);original.data[i+1]=Math.round(original.data[i+1]+(adjusted.data[i+1]-original.data[i+1])*a);original.data[i+2]=Math.round(original.data[i+2]+(adjusted.data[i+2]-original.data[i+2])*a);}
    }
    target.putImageData(original,0,0);
  }

  // Grupo de COMPOSIÇÃO. Grupos antigos continuam pass-through e custam zero offscreen; PSDs
  // podem pedir isolamento/opacidade/máscara/blend, que são aplicados uma vez ao composto.
  async function _fRenderGroup(target,g){
    const styled=g.isolation===true || g.mask || (g.opacity!=null&&g.opacity<100)
      || (g.blendMode&&g.blendMode!=='normal') || g.shadow || g.glow;
    if(!styled){ await _fRenderChildren(target,g.id); return; }
    const tf=(typeof target.getTransform==='function')?target.getTransform():{a:1,d:1};
    const sx=tf.a||1, sy=tf.d||1;
    const oc=document.createElement('canvas'); oc.width=Math.max(1,Math.round(W*sx)); oc.height=Math.max(1,Math.round(H*sy));
    const octx=oc.getContext('2d'); try{octx.setTransform(tf);}catch(e){}
    octx.imageSmoothingEnabled=true; octx.imageSmoothingQuality='high';
    await _fRenderChildren(octx,g.id);
    if(g.mask){
      try{ const gm=await fLoadImageDataUrl(g.mask); if(gm){octx.save();octx.globalCompositeOperation='destination-in';octx.drawImage(gm,g.x||0,g.y||0,g.w||W,g.h||H);octx.restore();} }catch(e){}
    }
    const bm=g.blendMode&&g.blendMode!=='normal'?g.blendMode:'normal';
    const native=(typeof dBlendToComposite==='function')?dBlendToComposite(bm):null;
    const sw=bm!=='normal'&&native===null&&typeof dBlendImageData==='function';
    if(sw){
      const top=octx.getImageData(0,0,oc.width,oc.height), bot=target.getImageData(0,0,oc.width,oc.height);
      if(g.opacity!=null&&g.opacity<100){const a=g.opacity/100;for(let i=3;i<top.data.length;i+=4)top.data[i]=Math.round(top.data[i]*a);}
      dBlendImageData(bm,top,bot); target.putImageData(bot,0,0);
    }else{
      target.save(); target.setTransform(1,0,0,1,0,0);
      target.globalAlpha=(g.opacity!=null?g.opacity:100)/100;
      if(native)target.globalCompositeOperation=native;
      if(g.shadow||g.glow){target.shadowColor=g.shadow?(g.shadowColor||'rgba(0,0,0,.5)'):(g.glowColor||'rgba(255,255,255,.7)');target.shadowBlur=(g.shadow?(g.shadowBlur||6):(g.glowSize||8))*Math.min(sx,sy);const o=g.shadow?gFxOffset(g.shadowDist||4,g.shadowAngle):{x:0,y:0};target.shadowOffsetX=o.x*sx;target.shadowOffsetY=o.y*sy;}
      target.drawImage(oc,0,0); target.restore();
    }
  }
  async function _fRenderChildren(target,parentId){
    for(const l of visible){
      const actualParent=(l.parentId&&_groupById.has(l.parentId))?l.parentId:null;
      if(actualParent!==parentId)continue;
      if(l.type==='group')await _fRenderGroup(target,l);
      else if(l.type==='adjustment')await _fRenderAdjustment(target,l);
      else await _fRenderLeaf(target,l);
    }
  }
  await _fRenderChildren(ctx,null);
  /* Preview, hit-test e destaque precisam da MESMA geometria efetiva (reflow + regras +
     layout vivo). Retornar o clone resolvido evita uma segunda implementação de coordenadas. */
  return effective;
}

// Renderiza um único layer aplicando dados do franqueado
async function fRenderOneLayer(ctx, l, dados, scaleX, scaleY){
  ctx.save();
  ctx.globalAlpha = (l.opacity != null ? l.opacity : 100) / 100;
  var _bmComp=(l.blendMode&&l.blendMode!=='normal'&&typeof dBlendToComposite==='function')
    ?dBlendToComposite(l.blendMode):null;
  ctx.globalCompositeOperation=_bmComp||'source-over';
  const _layoutText=l.type==='text';
  const _layoutDx=_layoutText?(l._layoutDx||0):0;
  const _layoutW=_layoutText&&l._layoutW!=null?l._layoutW:l.w;
  const x = Math.round(((l.x||0)+_layoutDx) * scaleX);
  const y = Math.round(l.y * scaleY);
  const w = Math.round((_layoutW||0) * scaleX);
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
    const _vector=(kind==='path'&&typeof gVectorPathValid==='function'&&gVectorPathValid(l.vectorPath))?l.vectorPath:null;
    const _fillRule=_vector&&typeof gVectorPathFillRule==='function'?gVectorPathFillRule(_vector):'nonzero';
    const _fxStack=Array.isArray(l.layerEffects)?l.layerEffects:[];
    const _fxOf=t=>_fxStack.filter(e=>e&&e.type===t);
    // traça a forma no path atual (reutilizável p/ sombras/overlay/traçado)
    const _trace = ()=>{
      if(_vector){ gTraceVectorPath(ctx,_vector,x,y,w,h); }
      else if(kind==='circle'||kind==='ellipse'){ ctx.beginPath(); ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2); }
      else if(_pts){ const abs=_pts.map(p=>[x+p[0]*w,y+p[1]*h]); const r=Math.min((l.radius||0)*scaleX,w/2,h/2);
        if(r>0 && typeof gRoundPolyPath2D==='function'){ gRoundPolyPath2D(ctx,abs,r); }
        else { ctx.beginPath(); abs.forEach((p,i)=>{ i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]); }); ctx.closePath(); } }
      else { roundedRectPath(ctx,x,y,w,h,_ctl,_ctr,_cbr,_cbl); }
    };
    const _overlay = (l.overlay&&l.overlayColor) ? gFxRgba(l.overlayColor, l.overlayOpacity!=null?l.overlayOpacity:1) : null;
    // 1) sombra projetada + brilho externo (atrás do fill)
    // _spread(): canvas 2D não tem spread nativo. Traçar a MESMA forma com espessura 2×spread
    // engorda a silhueta que projeta a sombra — que é o que a "propagação" do PS faz.
    const _spread=(v)=>{ if(!(v>0))return; ctx.lineWidth=v*2*_sc; ctx.strokeStyle=_fill; ctx.stroke(); };
    const _dropFx=_fxOf('dropShadow');
    if(_dropFx.length)_dropFx.forEach(e=>{ctx.save();_trace();const o=gFxOffset(e.distance!=null?e.distance:4,e.angle);ctx.shadowColor=e.color||'rgba(0,0,0,.5)';ctx.shadowBlur=(e.blur!=null?e.blur:6)*_sc;ctx.shadowOffsetX=o.x*_sc;ctx.shadowOffsetY=o.y*_sc;const co=e.blendMode&&typeof dBlendToComposite==='function'?dBlendToComposite(e.blendMode):null;if(co)ctx.globalCompositeOperation=co;ctx.fillStyle=_fill;ctx.fill(_fillRule);_spread(e.spread);ctx.restore();});
    else if(l.shadow){ ctx.save(); _trace(); const o=gFxOffset(l.shadowDist!=null?l.shadowDist:4,l.shadowAngle);
      ctx.shadowColor=l.shadowColor||'rgba(0,0,0,.5)'; ctx.shadowBlur=(l.shadowBlur!=null?l.shadowBlur:6)*_sc; ctx.shadowOffsetX=o.x*_sc; ctx.shadowOffsetY=o.y*_sc;
      ctx.fillStyle=_fill; ctx.fill(_fillRule); _spread(l.shadowSpread); ctx.restore(); }
    if(l.glow){ ctx.save(); _trace(); ctx.shadowColor=l.glowColor||'rgba(255,255,255,.7)'; ctx.shadowBlur=(l.glowSize!=null?l.glowSize:8)*_sc; ctx.fillStyle=_fill; ctx.fill(_fillRule); _spread(l.glowSpread); ctx.restore(); }
    // 2) fill principal (gradiente/sólido) (+ overlays por cima). Closure p/ reusar no re-fill do
    // traçado 'outside' (senão o re-fill simples apagava o gradientOverlay/overlay).
    const _paintFill=()=>{
      _trace(); ctx.fillStyle=_fillStyle; ctx.fill(_fillRule);
      const gos=_fxOf('gradientOverlay'),cos=_fxOf('colorOverlay');
      if(gos.length&&typeof gGradientCanvas==='function')gos.forEach(e=>{const g=e.gradient;if(!g||!g.stops||!g.stops.length)return;_trace();ctx.save();ctx.globalAlpha*=g.opacity!=null?g.opacity:1;const co=e.blendMode&&typeof dBlendToComposite==='function'?dBlendToComposite(e.blendMode):null;if(co)ctx.globalCompositeOperation=co;ctx.fillStyle=gGradientCanvas(ctx,g,x,y,w,h);ctx.fill(_fillRule);ctx.restore();});
      else if(l.gradientOverlay && l.gradientOverlay.stops && l.gradientOverlay.stops.length && typeof gGradientCanvas==='function'){ // gradient overlay
        _trace(); ctx.save(); ctx.globalAlpha*=(l.gradientOverlay.opacity!=null?l.gradientOverlay.opacity:1); ctx.fillStyle=gGradientCanvas(ctx,l.gradientOverlay,x,y,w,h); ctx.fill(_fillRule); ctx.restore(); }
      if(cos.length)cos.forEach(e=>{_trace();ctx.save();ctx.globalAlpha*=e.opacity!=null?e.opacity:1;const co=e.blendMode&&typeof dBlendToComposite==='function'?dBlendToComposite(e.blendMode):null;if(co)ctx.globalCompositeOperation=co;ctx.fillStyle=e.color||'#000';ctx.fill(_fillRule);ctx.restore();});
      else if(_overlay){ _trace(); ctx.fillStyle=_overlay; ctx.fill(_fillRule); }
    };
    _paintFill();
    // 3) sombra interna / brilho interno (aprox.: traço borrado recortado p/ dentro)
    const _innerStroke=(color,blur,o,bm,spread)=>{ ctx.save(); _trace(); ctx.clip(_fillRule); _trace();
      const co=bm&&typeof dBlendToComposite==='function'?dBlendToComposite(bm):null;if(co)ctx.globalCompositeOperation=co;
      ctx.shadowColor=color; ctx.shadowBlur=blur*_sc; ctx.shadowOffsetX=(o?o.x:0)*_sc; ctx.shadowOffsetY=(o?o.y:0)*_sc;
      ctx.lineWidth=Math.max(2,(blur+(spread||0)*2)*_sc); ctx.strokeStyle=color; ctx.stroke(); ctx.restore(); };
    const _innerFx=_fxOf('innerShadow');
    if(_innerFx.length)_innerFx.forEach(e=>_innerStroke(e.color||'rgba(0,0,0,.5)',e.blur!=null?e.blur:6,gFxOffset(e.distance!=null?e.distance:4,e.angle),e.blendMode,e.spread));
    else if(l.innerShadow) _innerStroke(l.innerShadowColor||'rgba(0,0,0,.5)', (l.innerShadowBlur!=null?l.innerShadowBlur:6), gFxOffset(l.innerShadowDist!=null?l.innerShadowDist:4,l.innerShadowAngle));
    if(l.innerGlow) _innerStroke(l.innerGlowColor||'rgba(255,255,255,.7)', (l.innerGlowSize!=null?l.innerGlowSize:8), null);
    if(l.bevel){ const o=gFxOffset(l.bevelSize!=null?l.bevelSize:4,l.bevelAngle), b=l.bevelSize!=null?l.bevelSize:4;
      _innerStroke(l.bevelHighlight||'rgba(255,255,255,.7)', b, o); _innerStroke(l.bevelShadow||'rgba(0,0,0,.5)', b, {x:-o.x,y:-o.y}); }
    // 4) traçado com alinhamento (inside/center/outside) + dash/cap/join
    const _strokeOne=(sw,col,a,op,bm)=>{_trace();ctx.save();ctx.globalAlpha*=op!=null?op:1;const co=bm&&typeof dBlendToComposite==='function'?dBlendToComposite(bm):null;if(co)ctx.globalCompositeOperation=co;ctx.lineWidth=Math.max(1,sw*_sc)*(a==='center'?1:2);ctx.strokeStyle=col||'#000';ctx.lineJoin=l.strokeJoin||'round';ctx.lineCap=l.strokeCap||'butt';if(l.strokeDash&&l.strokeDash.length)ctx.setLineDash(l.strokeDash.map(d=>d*_sc));else ctx.setLineDash([]);if(a==='inside'){ctx.clip(_fillRule);ctx.stroke();}else ctx.stroke();ctx.restore();return a==='outside';};
    const _strokeFx=_fxOf('stroke');
    let _refill=false;
    if(_strokeFx.length){
      // Os traços externos precisam ficar atrás do fill e dos traços internos. Desenha do mais
      // largo para o mais estreito, recompõe o conteúdo uma vez e só então pinta center/inside.
      // Sem essa separação, o re-fill do último traço externo apagava um contorno interno anterior.
      const outside=_strokeFx.filter(e=>(e.align||'outside')==='outside').slice().sort((a,b)=>(b.width||1)-(a.width||1));
      const front=_strokeFx.filter(e=>(e.align||'outside')!=='outside');
      outside.forEach(e=>{_strokeOne(e.width||1,e.color,'outside',e.opacity,e.blendMode);});
      if(outside.length)_paintFill();
      front.forEach(e=>{_strokeOne(e.width||1,e.color,e.align||'inside',e.opacity,e.blendMode);});
    }
    else if(l.strokeW>0)_refill=_strokeOne(l.strokeW,l.strokeColor||'#000',l.strokeAlign||'inside',1,null);
    if(_refill)_paintFill();

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
    // Split de preço precisa entrar na MEDIDA antes de entrar no desenho: inteiro, símbolo e
    // centavos usam tamanhos diferentes. A mesma lista é reaproveitada no ramo rich text.
    const _vRuns = ((typeof gBuildVirtualRuns === 'function') ? gBuildVirtualRuns(l, dados, 1, _defaults) : null)
      || (!/\{\{/.test(l.content||'') ? l.runs : null) || null;
    /* ENCAIXE: quebra inteligente, caixa-alta, medida e o encolhimento vêm de gFitTextLayer
       (00-config.js) — a MESMA função que a cascata de ancoragem relativa usa para saber a
       altura. Antes cada lado tinha sua conta e elas divergiam: a cascata media 1 linha e o
       render desenhava 3, então o bloco de baixo colidia. Uma regra, dois consumidores.
       O encolhimento só é APLICADO mais abaixo (no ramo horizontal), porque sombra, brilho e
       traço são dimensionados pelo tamanho DESENHADO — aplicar antes mudaria os efeitos. */
    const _fit = (typeof gFitTextLayer==='function')
      ? gFitTextLayer(l, raw, null, {escala:Math.min(scaleX,scaleY), encolher:true, runs:_vRuns})
      : null;
    if(_fit) raw = _fit.text;
    else {
      if(l.textBox === 'box' && typeof gSmartWrapText === 'function') raw = gSmartWrapText(raw, l.w, l, dados, _defaults);
      if(l.textTransform==='uppercase') raw=raw.toUpperCase();
      else if(l.textTransform==='lowercase') raw=raw.toLowerCase();
    }
    const lines = _fit ? _fit.lines : raw.split('\n').filter(line => line.trim() !== '');
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
    const _scTxt = Math.min(scaleX, scaleY);
    // color overlay → cor efetiva do texto; senão l.color
    const _txtColor = (l.overlay&&l.overlayColor) ? gFxRgba(l.overlayColor, l.overlayOpacity!=null?l.overlayOpacity:1) : (l.color || '#fff');
    // parâmetros de sombra projetada (configurável; sem blur/dist → mantém default fs-based antigo)
    const _shUsesCfg = (l.shadowBlur!=null || l.shadowDist!=null || l.shadowAngle!=null);
    const _shOff = l.shadow ? (_shUsesCfg ? gFxOffset((l.shadowDist!=null?l.shadowDist:fontSize*0.07/_scTxt)*_scTxt, l.shadowAngle) : {x:fontSize*0.05, y:fontSize*0.05}) : {x:0,y:0};
    const _shBlur = l.shadow ? (l.shadowBlur!=null ? l.shadowBlur*_scTxt : Math.max(1,fontSize*0.12)) : 0;
    // gradiente no texto (preenchimento) → CanvasGradient; senão a cor efetiva
    const _txtFill = (l.gradient&&l.gradient.stops&&l.gradient.stops.length&&typeof gGradientCanvas==='function') ? gGradientCanvas(ctx,l.gradient,x,y,w,h) : _txtColor;
    let _lsTxt = (l.letterSpacing!=null) ? (l.letterSpacing*_scTxt)+'px' : null; // tracking (reescala se o auto-fit encolher)
    // Brilho externo (outer glow) do texto — halo atrás dos glifos. Antes só shape tinha glow no PNG.
    const _glowColor = l.glow ? (l.glowColor||'rgba(255,255,255,.7)') : null;
    const _glowBlur  = l.glow ? (l.glowSize!=null?l.glowSize:Math.max(2,(l.fontSize||24)*0.25))*_scTxt : 0;

    // Runs estáticos só valem para texto fixo. Se uma camada rica antiga foi vinculada depois
    // a um campo, o valor do franqueado vence os trechos do PSD que ficaram salvos nela.
    const runsToUse = _vRuns;

    // ── RICH TEXT (multi-estilo) — MULTILINHA, fiel ao editor (spans + <br> no DOM):
    // divide os trechos pelas quebras '\n' do PSD, mede cada linha, aplica textTransform,
    // ancora pelo topo (vAlign) ou centraliza o bloco. O render antigo desenhava tudo
    // numa linha única no meio da caixa — a arte final divergia do editor.
    if(runsToUse && runsToUse.length && !l.vertical){
      const _xf=t=>l.textTransform==='uppercase'?t.toUpperCase():l.textTransform==='lowercase'?t.toLowerCase():t;
      // Trechos → linhas (preserva segmentos vazios de linhas em branco)
      const linesRuns=[[]];
      runsToUse.forEach(r=>{
        String(r.text||'').split('\n').forEach((part,pi)=>{
          if(pi>0) linesRuns.push([]);
          if(part!=='') linesRuns[linesRuns.length-1].push(Object.assign({},r,{text:part}));
        });
      });
      // Mede cada linha (fonte/tracking por trecho)
      const fallbackFs=Math.round((l.fontSize||24)*_scTxt);
      /* A escada pode reduzir `_tetoFonte`. Antes o fit dizia 32px e os runs continuavam em
         64/35px: preço rico e texto comum obedeciam motores diferentes. Mantém a proporção
         entre os runs, mas aplica a decisão única do encaixe. */
      const fitRatio=_fit?(_fit.fontSize/Math.max(1,fallbackFs)):1;
      const measured=linesRuns.map(segs=>{
        let wsum=0, maxFs=segs.length?0:fallbackFs*fitRatio;
        const ms=segs.map(r=>{
          const fp=(typeof dTextFontParts==='function')?dTextFontParts(r.font):{family:"'Roboto',sans-serif",weight:700};
          const fs=Math.round((r.fontSize||l.fontSize||24)*_scTxt*fitRatio);
          ctx.font=`${_ital}${fp.weight} ${fs}px ${fp.family}`;
          ctx.letterSpacing=r.letterSpacing?(r.letterSpacing*_scTxt*fitRatio)+'px':'0px';
          const t=_xf(r.text||'');
          const ww=ctx.measureText(t).width;
          wsum+=ww; if(fs>maxFs)maxFs=fs;
          return {t,fp,fs,ww,ls:(r.letterSpacing||0)*fitRatio,color:r.color,
            yOffset:(r.yOffset||0)*fitRatio};
        });
        return {ms,wsum,maxFs};
      });
      // `gLineHeightDe`: régua única de entrelinha — honra o aperto que a escada carimbou.
      const _lhF=(typeof gLineHeightDe==='function')?gLineHeightDe(l):(l.lineHeight||1.2);
      const lineHs=measured.map(li=>li.maxFs*_lhF);
      const totalH=lineHs.reduce((a,b)=>a+b,0);
      ctx.textAlign='left'; ctx.textBaseline='alphabetic';
      // vAlign 'top' → bloco encosta no topo da caixa; senão centraliza (espelha o editor)
      let cy=(l.vAlign==='top')? y : y+(h-totalH)/2;
      measured.forEach((li,idx)=>{
        const lineH=lineHs[idx];
        const baseline=cy + li.maxFs*0.8 + (lineH-li.maxFs)/2; // baseline ≈ line-box CSS (half-leading)
        let tx = l.textAlign==='center'? x+w/2-li.wsum/2 : l.textAlign==='right'? x+w-li.wsum : x;
        const _lineX0=tx; // início da linha (p/ sublinhado/tachado)
        li.ms.forEach(s=>{
          ctx.font=`${_ital}${s.fp.weight} ${s.fs}px ${s.fp.family}`;
          ctx.letterSpacing=s.ls?(s.ls*_scTxt)+'px':'0px';
          ctx.fillStyle=s.color||_txtColor;
          const baselineOffset = (s.yOffset || 0) * _scTxt;
          if(_glowColor){ ctx.save(); ctx.shadowColor=_glowColor; ctx.shadowBlur=_glowBlur; ctx.shadowOffsetX=0; ctx.shadowOffsetY=0; ctx.fillText(s.t, tx, baseline + baselineOffset); ctx.restore(); }
          if(l.shadow){ ctx.shadowColor=l.shadowColor||'rgba(0,0,0,.5)'; ctx.shadowBlur=_shBlur; ctx.shadowOffsetX=_shOff.x; ctx.shadowOffsetY=_shOff.y; }
          ctx.fillText(s.t, tx, baseline + baselineOffset);
          if(l.shadow){ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;}
          if(l.strokeW>0){ ctx.lineWidth=Math.max(1,l.strokeW*_scTxt); ctx.strokeStyle=l.strokeColor||'#000'; ctx.lineJoin='round'; ctx.strokeText(s.t, tx, baseline + baselineOffset); }
          tx+=s.ww;
        });
        // Sublinhado/tachado no rich text (o caminho single-style já fazia; aqui sumia).
        if(l.underline || l.strikethrough){
          ctx.save();
          ctx.strokeStyle=l.color||_txtColor; ctx.lineWidth=Math.max(2, li.maxFs*0.05);
          if(l.strikethrough){ const sy=baseline-li.maxFs*0.30; ctx.beginPath(); ctx.moveTo(_lineX0,sy); ctx.lineTo(_lineX0+li.wsum,sy); ctx.stroke(); }
          if(l.underline){ const uy=baseline+li.maxFs*0.12; ctx.beginPath(); ctx.moveTo(_lineX0,uy); ctx.lineTo(_lineX0+li.wsum,uy); ctx.stroke(); }
          ctx.restore();
        }
        cy+=lineH;
      });
      ctx.letterSpacing='0px';
      ctx.restore(); return;
    }

    if (l.vertical) {
      // Auto-fit vertical — a decisão vem da mesma régua usada pelo solver.
      if(_fit&&_fit.fontSize!==fontSize)fontSize=_fit.fontSize;
      let maxColChars = 0;
      lines.forEach(ln => { const chars = [...ln]; if(chars.length > maxColChars) maxColChars = chars.length; });
      
      let charStep = fontSize * 1.1;
      let colStep = fontSize * 1.2;
      let maxColH = maxColChars * charStep;
      let totalW = lines.length * colStep;

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
          if(_glowColor){ ctx.save(); ctx.shadowColor=_glowColor; ctx.shadowBlur=_glowBlur; ctx.shadowOffsetX=0; ctx.shadowOffsetY=0; ctx.fillText(char, tx, cy); ctx.restore(); }
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
      // Auto-fit horizontal SÓ p/ texto de PARÁGRAFO (tem caixa de largura). Point text não tem
      // caixa no PSD: encolher pela largura do bbox justo (fonte trocada p/ Roboto) quebrava a
      // hierarquia 1:1 — deixa transbordar em vez de reduzir a fonte.
      // A DECISÃO de encolher (e o quanto) vem do gFitTextLayer, calculado no topo desta função;
      // aqui ela só é APLICADA, depois de sombra/brilho já terem pegado o tamanho desenhado.
      // O tracking encolhe junto — senão fica exagerado proporcionalmente e diverge do editor.
      // Respiro interno da caixa (alinhamento e justificado, logo abaixo). Calculado com o
      // fontSize AINDA NÃO encolhido — é a ordem original, e mudá-la deslocaria o texto
      // alinhado à direita/justificado nas artes que encolhem.
      const innerPad = Math.round(fontSize * 0.08);
      if(_fit && _fit.fontSize !== fontSize){
        fontSize = _fit.fontSize;
        ctx.font = `${_ital}${fwt} ${fontSize}px ${ff}`;
        if(_lsTxt!=null && _fit.letterSpacing) _lsTxt = _fit.letterSpacing;
      }
      if(_fit && _fit.letterSpacing && _lsTxt!=null) ctx.letterSpacing = _lsTxt;

      // Mesma régua da medida (`gFitTextLayer`): sem isso a escada apertaria a entrelinha só
      // no cálculo e o desenho continuaria folgado — a divergência que originou este trabalho.
      const lineHeight = fontSize * ((typeof gLineHeightDe==='function')?gLineHeightDe(l):(l.lineHeight||1.2));
      const totalTextH = lineHeight * lines.length;

      // Coletor de OVERFLOW (opt-in): só a Prévia ao Vivo seta window._fOverflowSink.
      // Sinaliza estouro vertical (texto mais alto que a caixa) e horizontal em point-text
      // (que não encolhe). Não afeta o PNG final/lote (sink ausente). Aditivo e barato.
      if(typeof window!=='undefined' && window._fOverflowSink && l.id){
        const _vOver = totalTextH > h + Math.max(2, fontSize*0.18);
        // maxLineW não existia (ReferenceError) — derrubava a prévia INTEIRA em qualquer
        // template com point-text. Mede aqui: ctx.font já está no tamanho final (pós-fit).
        let _hOver = false;
        if(l.textBox!=='box'){
          let _mw = 0;
          for(const _li of lines){ const _w = ctx.measureText(_li).width; if(_w > _mw) _mw = _w; }
          _hOver = _mw > w + Math.max(2, w*0.02);
        }
        if(_vOver || _hOver) window._fOverflowSink.add(l.id);
      }

      ctx.fillStyle = _txtFill; // gradiente/overlay/cor (horizontal)
      // JUSTIFICADO: o canvas não tem textAlign:'justify' — a distribuição é feita palavra a
      // palavra mais abaixo (_fJustifySegs). Aqui o alinhamento base é 'left', que é também o
      // que a ÚLTIMA linha de um parágrafo justificado usa.
      const _just = (l.textAlign === 'justify');
      ctx.textAlign = _just ? 'left' : (l.textAlign || 'left');
      // Ancoragem vertical: 'top' (PSD) → topo da tinta encosta no topo da caixa (baseline 1:1 com
      // o node.top do Photoshop). Demais → centralização vertical (comportamento antigo).
      // `_vTopAuto`: carimbo do layout vivo para o texto que passou da própria caixa — cresce
      // só para baixo em vez de subir por cima da margem do topo. Ausente sem o layout vivo,
      // então o desenho de hoje continua idêntico.
      const _vTop = (l.vAlign==='top') || l._vTopAuto === true;
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

        // Justificado: a última linha NÃO estica (é a regra tipográfica; esticar a última
        // linha de um parágrafo é o erro clássico que denuncia justificação mal feita).
        const _segs = _just ? _fJustifySegs(ctx, line, tx, w - innerPad*2, i === lines.length-1) : null;
        // Uma passada de pintura, reaproveitada pelo texto inteiro ou por palavra.
        const pintar = (txt, px) => {
          if(_glowColor){ ctx.save(); ctx.shadowColor=_glowColor; ctx.shadowBlur=_glowBlur; ctx.shadowOffsetX=0; ctx.shadowOffsetY=0; ctx.fillText(txt, px, ty); ctx.restore(); }
          if(l.shadow){
            ctx.shadowColor=l.shadowColor||'rgba(0,0,0,.5)';
            ctx.shadowBlur=_shBlur; ctx.shadowOffsetX=_shOff.x; ctx.shadowOffsetY=_shOff.y;
          }
          ctx.fillText(txt, px, ty);
          if(l.shadow){ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;}
          if(l.strokeW>0){
            ctx.lineWidth=Math.max(1, l.strokeW*Math.min(scaleX,scaleY));
            ctx.strokeStyle=l.strokeColor||'#000';
            ctx.lineJoin='round';
            ctx.strokeText(txt, px, ty);
          }
        };
        if(_segs) _segs.forEach(s=>pintar(s.txt, s.x));
        else pintar(line, tx);

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
          const _vector=(kind==='path'&&typeof gVectorPathValid==='function'&&gVectorPathValid(l.vectorPath))?l.vectorPath:null;
          if(_vector){
            gTraceVectorPath(ctx,_vector,x,y,w,h);
          } else if(kind === 'circle' || kind === 'ellipse'){
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
          ctx.clip(_vector?gVectorPathFillRule(_vector):'nonzero');
          const imgAR = img.width / img.height, frameAR = w / h;
          let baseW, baseH;
          if(l.objectFit === 'contain'){
            if(imgAR > frameAR){ baseW = w; baseH = w/imgAR; } else { baseH = h; baseW = h*imgAR; }
          } else { // cover
            if(imgAR > frameAR){ baseH = h; baseW = h*imgAR; } else { baseW = w; baseH = w/imgAR; }
          }
          // Zoom + reposição da foto dentro da moldura. Override por-arte do franqueado
          // (dados['__fit__'+var]) VENCE o do template — sem mutar a camada compartilhada
          // (a Prévia ao Vivo deixa o franqueado enquadrar a própria foto). Retrocompatível:
          // sem override, usa o enquadramento do designer, exatamente como antes.
          const _fit = (dados && l.imgVar) ? dados['__fit__'+l.imgVar] : null;
          const sc = (_fit && _fit.scale>0) ? _fit.scale : (l.imgScale || 1);
          const drawW = baseW*sc, drawH = baseH*sc;
          const _ox = (_fit && _fit.offX!=null) ? _fit.offX : (l.imgOffsetX||0);
          const _oy = (_fit && _fit.offY!=null) ? _fit.offY : (l.imgOffsetY||0);
          const posX = Math.max(0, Math.min(1, 0.5 + _ox));
          const posY = Math.max(0, Math.min(1, 0.5 + _oy));
          const drawX = x + (w - drawW)*posX;
          const drawY = y + (h - drawH)*posY;
          
          // Aplica filtros de imagem (Apetite Adjustments)
          let filterStr = '';
          if (l.filterBrightness != null && l.filterBrightness !== 0) filterStr += ` brightness(${1 + (l.filterBrightness / 100)})`;
          if (l.filterContrast != null && l.filterContrast !== 0) filterStr += ` contrast(${1 + (l.filterContrast / 100)})`;
          if (l.filterSaturate != null && l.filterSaturate !== 0) filterStr += ` saturate(${1 + (l.filterSaturate / 100)})`;
          if (filterStr) ctx.filter = filterStr.trim();
          
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
      const _vector=(kind==='path'&&typeof gVectorPathValid==='function'&&gVectorPathValid(l.vectorPath))?l.vectorPath:null;
      if(_vector){
        gTraceVectorPath(ctx,_vector,x,y,w,h);
      } else if(kind === 'circle' || kind === 'ellipse'){
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
      ctx.fill(_vector?gVectorPathFillRule(_vector):'nonzero');
    }
  }
  ctx.restore();
}

// Helper: desenha retângulo arredondado no canvas
/* Justificação de uma linha: devolve [{txt,x}] com as palavras espalhadas para encostar nas
   duas margens, ou null quando não se deve (ou não se pode) justificar.
   O canvas não tem textAlign:'justify', então é isto ou não existe justificado no Luma — e o
   importador de PSD já detectava a propriedade sem ter como honrá-la.
   Devolve null quando: é a última linha (regra tipográfica — última linha não estica), há uma
   palavra só (nada a distribuir), ou o texto já passa da largura (esticar pra trás juntaria
   as palavras). Nesses casos o desenho segue alinhado à esquerda, como antes. */
function _fJustifySegs(ctx, line, xLeft, width, isLast){
  if(isLast) return null;
  const palavras=String(line||'').split(/\s+/).filter(Boolean);
  if(palavras.length<2) return null;
  const larguras=palavras.map(p=>ctx.measureText(p).width);
  const soma=larguras.reduce((a,b)=>a+b,0);
  const folga=width-soma;
  if(!(folga>0)) return null;
  const gap=folga/(palavras.length-1);
  const out=[]; let cx=xLeft;
  palavras.forEach((p,i)=>{ out.push({txt:p, x:cx}); cx+=larguras[i]+gap; });
  return out;
}
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
    // Watchdog: imagem que nunca dispara load/error (request estagnado) segurava o
    // await do render PRA SEMPRE — "Montando a prévia…" infinito. 20s e desiste
    // (mesma degradação do 404: layer sai sem a imagem), com a URL no console.
    let done=false;
    const fim=(v,motivo)=>{ if(done)return; done=true;
      if(motivo) console.warn('[render] imagem desistiu ('+motivo+'):', String(dataUrl).slice(0,120));
      // CACHE NEGATIVO: sem isto, cada re-render (a prévia roda a cada tecla!) re-pagava os
      // 20s POR imagem morta — o "travada e demorada". Falha fica cacheada na sessão;
      // ponytail: fClearImgCache (refazer/trocar material) já é o caminho de retry.
      if(v===null) _fImgCache.set(dataUrl, null);
      resolve(v); };
    setTimeout(()=>fim(null,'timeout 20s'), 20000);
    // URLs http(s) (bulk CSV): tenta CORS pra não "tingir" o canvas ao exportar
    if(/^https?:\/\//.test(dataUrl)) img.crossOrigin='anonymous';
    img.onload=()=>{ _fImgCache.set(dataUrl, img); fim(img); };
    img.onerror=()=>fim(null,'erro de carregamento');
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
let _fBulkAudit=[];
let _fBulkAsyncAudit=[];
let _fBulkAuditFingerprint='';
let _fBulkImageAudit=new Map();
let _fBulkAutosaveTimer=null;
let _fBulkAutosaveSeq=0;
let _fBulkGenerationState=null;
let _fBulkPreflightRunning=false;

function _fBulkStorageScope(){
  const user=(typeof gAuthState!=='undefined'&&gAuthState&&gAuthState.user)||null;
  const uid=user&&user.id?user.id:'local';
  const mid=fState&&fState.material&&fState.material.id?fState.material.id:'material';
  return `${String(uid).replace(/[^a-zA-Z0-9_-]/g,'_')}:${String(mid).replace(/[^a-zA-Z0-9_-]/g,'_')}`;
}
function _fBulkDraftKey(){ return `luma-sheets-draft-v1:${_fBulkStorageScope()}`; }
function _fBulkGenerationKey(){ return `luma-sheets-generation-v1:${_fBulkStorageScope()}`; }

function _fBulkRowsFingerprint(){
  const compact=(fBulkRows||[]).map(r=>{
    const out={};
    Object.keys((r&&r.dados)||{}).sort().forEach(k=>{
      const v=r.dados[k];
      out[k]=(typeof v==='string'&&v.length>800)
        ? `@${v.length}:${typeof gImgHash==='function'?gImgHash(v):v.slice(0,64)}`
        : v;
    });
    return out;
  });
  const raw=JSON.stringify(compact);
  return typeof gImgHash==='function'?gImgHash(raw):String(raw.length);
}

function _fBulkRevalidateRows(rows){
  const keys=fBulkVars();
  return (rows||[]).map(r=>{
    const dados={};
    keys.forEach(k=>{ dados[k]=r&&r.dados&&r.dados[k]!=null?String(r.dados[k]):''; });
    const isEmpty=keys.every(k=>!dados[k].trim());
    const erros=[];
    if(!isEmpty) keys.forEach(k=>{
      const err=typeof fValidate==='function'?fValidate(k,dados[k]):null;
      if(err) erros.push(err);
    });
    return {dados,erros};
  });
}

async function _fBulkDraftRows(){
  const rows=[];
  for(const row of fBulkRows||[]){
    const dados={};
    for(const k of Object.keys((row&&row.dados)||{})){
      const v=row.dados[k];
      if(typeof v==='string'&&v.startsWith('data:')){
        if(typeof gIdbPut==='function'&&typeof gImgHash==='function'){
          const key=`sheets-draft-${gImgHash(v)}`;
          dados[k]=(await gIdbPut(key,v))?`idb://${key}`:'';
        }else dados[k]='';
      }else if(typeof v==='string'&&v.startsWith('blob:')) dados[k]='';
      else dados[k]=v;
    }
    rows.push({dados});
  }
  return rows;
}

function _fBulkDraftMeta(rows){
  return {
    version:1,
    materialId:fState.material&&fState.material.id,
    updatedAt:new Date().toISOString(),
    rows,
    copyFormat:(document.getElementById('f-bulk-copy-format')||{}).value||'feed',
    city:(document.getElementById('f-bulk-city')||{}).value||'',
    tableView:_fBulkTableView
  };
}

function _fBulkHasContent(){
  const keys=fBulkVars();
  return (fBulkRows||[]).some(r=>keys.some(k=>String((r.dados||{})[k]||'').trim()));
}

function _fBulkSetSaveStatus(text,state){
  const el=document.getElementById('f-bulk-save-status');
  if(!el)return;
  el.textContent=text;
  el.dataset.state=state||'';
}

async function fBulkSaveDraft(){
  if(!fState.material)return;
  const seq=++_fBulkAutosaveSeq;
  _fBulkSetSaveStatus('Salvando…','saving');
  try{
    if(!_fBulkHasContent()&&!_fBulkGenerationState){
      localStorage.removeItem(_fBulkDraftKey());
      if(seq===_fBulkAutosaveSeq)_fBulkSetSaveStatus('Pronto para salvar','');
      return;
    }
    const rows=await _fBulkDraftRows();
    if(seq!==_fBulkAutosaveSeq)return;
    localStorage.setItem(_fBulkDraftKey(),JSON.stringify(_fBulkDraftMeta(rows)));
    _fBulkSetSaveStatus('Salvo agora','saved');
  }catch(e){
    console.warn('[sheets autosave] falhou:',e);
    _fBulkSetSaveStatus('Não foi possível salvar','error');
  }
}

// No fechamento inesperado não dá tempo de esperar o IndexedDB. Texto e links ainda são
// preservados; fotos locais já salvas pelo autosave continuam referenciadas no rascunho anterior.
function _fBulkSaveDraftSync(){
  if(!fState.material||!_fBulkHasContent())return;
  try{
    const rows=(fBulkRows||[]).map(r=>{
      const dados={};
      Object.keys((r&&r.dados)||{}).forEach(k=>{
        const v=r.dados[k];
        dados[k]=(typeof v==='string'&&(v.startsWith('data:')||v.startsWith('blob:')))?'':v;
      });
      return {dados};
    });
    localStorage.setItem(_fBulkDraftKey(),JSON.stringify(_fBulkDraftMeta(rows)));
  }catch(e){}
}

function fBulkScheduleAutosave(){
  if(_fBulkAutosaveTimer)clearTimeout(_fBulkAutosaveTimer);
  _fBulkSetSaveStatus('Alterações pendentes','pending');
  _fBulkAutosaveTimer=setTimeout(()=>{ _fBulkAutosaveTimer=null; fBulkSaveDraft(); },650);
}

async function fBulkRestoreDraft(){
  let draft=null;
  try{
    const raw=localStorage.getItem(_fBulkDraftKey());
    if(raw)draft=JSON.parse(raw);
  }catch(e){}
  if(!draft||draft.version!==1||draft.materialId!==fState.material.id||!Array.isArray(draft.rows)||!draft.rows.length)return false;

  const rows=[];
  for(const r of draft.rows){
    const dados={...(r.dados||{})};
    for(const k of Object.keys(dados)){
      if(typeof dados[k]==='string'&&dados[k].startsWith('idb://')&&typeof gResolveImgUrl==='function'){
        dados[k]=(await gResolveImgUrl(dados[k]))||'';
      }
    }
    rows.push({dados});
  }
  fBulkRows=_fBulkRevalidateRows(rows);
  _fBulkTableView=draft.tableView!==false;
  const copy=document.getElementById('f-bulk-copy-format');
  const city=document.getElementById('f-bulk-city');
  if(copy&&draft.copyFormat)copy.value=draft.copyFormat;
  if(city&&draft.city!=null)city.value=draft.city;
  _fBulkSetSaveStatus('Produção recuperada','saved');
  return true;
}

function fBulkSaveGenerationState(){
  try{
    if(_fBulkGenerationState)localStorage.setItem(_fBulkGenerationKey(),JSON.stringify(_fBulkGenerationState));
    else localStorage.removeItem(_fBulkGenerationKey());
  }catch(e){ console.warn('[sheets retomada] falhou:',e); }
}

function fBulkRestoreGenerationState(){
  try{
    const raw=localStorage.getItem(_fBulkGenerationKey());
    _fBulkGenerationState=raw?JSON.parse(raw):null;
  }catch(e){ _fBulkGenerationState=null; }
  if(_fBulkGenerationState&&_fBulkGenerationState.fingerprint!==_fBulkRowsFingerprint())_fBulkGenerationState=null;
}

function fBulkResumeCount(){
  if(!_fBulkGenerationState||_fBulkGenerationState.fingerprint!==_fBulkRowsFingerprint()||!Array.isArray(_fBulkGenerationState.jobs))return 0;
  return _fBulkGenerationState.jobs.filter(j=>j.status!=='done').length;
}

// Renderiza o material atual num canvas e devolve o dataURL — SEM disparar download.
// Reaproveita o mesmo caminho de super-sampling 2× do fGenPNG.
async function fRenderMaterialToDataURL(dados, camp, fmt){
  const [w,h]=fMaterialSize(fState.material, fmt);
  const SCALE=2;
  const renderCv=document.createElement('canvas');
  renderCv.width=w*SCALE;renderCv.height=h*SCALE;
  const rctx=renderCv.getContext('2d');
  rctx.scale(SCALE,SCALE);
  await fRenderTemplateLayers(rctx, fState.material.layers, w, h, dados, camp, null,
    {scope:'franqueado',purpose:'export'});
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
  fBulkScheduleAutosave();
}

function fBulkClearAll() {
  fBulkRows = [];
  _fBulkAudit=[];
  _fBulkAsyncAudit=[];
  _fBulkGenerationState=null;
  try{
    localStorage.removeItem(_fBulkDraftKey());
    localStorage.removeItem(_fBulkGenerationKey());
  }catch(e){}
  fBulkRenderPreview();
  const st = document.getElementById('f-bulk-status');
  if(st) st.textContent = '';
  gToast('Planilha limpa.');
}

async function fBulkOpenFromArt() {
  if (!fState.material || !fState.material.layers) {
    gToast('Escolha um material primeiro.');
    return;
  }
  
  // Pré-carrega a Linha 1 do Luma Sheets com os dados atuais preenchidos na arte
  if (fState.dados && Object.keys(fState.dados).length > 0) {
    const vars = fBulkVars();
    const rowData = {};
    vars.forEach(v => {
      rowData[v] = fState.dados[v] !== undefined ? fState.dados[v] : '';
    });
    
    const currentArtRow = { dados: rowData, status: 'idle' };
    
    if (!fBulkRows || fBulkRows.length === 0) {
      fBulkRows = [currentArtRow, fBulkCreateEmptyRow(), fBulkCreateEmptyRow()];
    } else {
      fBulkRows[0] = currentArtRow;
    }
  }

  await fBulkOpen();
  gToast('Luma Sheets aberto com os dados desta arte!');
}

async function fBulkOpen(){
  // Controle do produto — funil único do Luma Sheets (fBulkOpenFromArt chega aqui).
  if(typeof gFeatureCan==='function' && !gFeatureCan('franqueado.sheets','access')){
    if(typeof gFeatureBlockedFeedback==='function') gFeatureBlockedFeedback('franqueado.sheets');
    return;
  }
  if(!fState.material||!fState.material.layers){gToast('Escolha um material primeiro.');return;}
  
  if (_fLastMaterialId !== fState.material.id) {
    fBulkRows = [];
    _fLastMaterialId = fState.material.id;
    _fBulkAudit=[];
    _fBulkAsyncAudit=[];
    _fBulkGenerationState=null;
  }
  
  const restored=(!fBulkRows||fBulkRows.length===0)?await fBulkRestoreDraft():false;
  if(!restored&&(!fBulkRows || fBulkRows.length === 0)) {
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
  
  /* Os chips de formato saíram do rodapé (13/08, pedido do dono): o franqueado já escolheu o
     formato ao abrir o material, e repetir a escolha aqui era uma decisão a mais para chegar no
     mesmo lugar. O `fBulkDownloadAll` sempre teve o fallback `selectedFmts=[fState.fmt]`, então
     o ZIP sai no formato do material — que é o que a prévia ao lado mostra o tempo todo. */
  fBulkRestoreGenerationState();
  const copy=document.getElementById('f-bulk-copy-format');
  const city=document.getElementById('f-bulk-city');
  if(copy&&!copy.dataset.autosaveBound){ copy.addEventListener('change',fBulkScheduleAutosave); copy.dataset.autosaveBound='1'; }
  if(city&&!city.dataset.autosaveBound){ city.addEventListener('input',fBulkScheduleAutosave); city.dataset.autosaveBound='1'; }
  if(!window._fBulkBeforeUnloadBound){
    window.addEventListener('beforeunload',_fBulkSaveDraftSync);
    window._fBulkBeforeUnloadBound=true;
  }
  fBulkUpdateReadiness();
  
  fBulkUpdateSavedTemplatesList();
  document.getElementById('f-bulk-modal').classList.add('open');
  // Sem passos: a tela já está inteira na frente. O painel de preencher começa FECHADO mesmo
  // com a planilha vazia — quem chega vê a tabela, que é onde se digita; os seis caminhos de
  // importação ficam a um clique, sem tomar a coluna de quem não vai usá-los.
  fBulkToggleImport(false);
  fBulkSetActive(0);
  if(restored)gToast('Sua produção foi recuperada automaticamente');
}
function fBulkClose(){
  fBulkCollectCurrentInputs();
  fBulkSaveDraft();
  // Solta o observador da fita: fechar sem desligar deixava um IntersectionObserver por
  // abertura, cada um segurando os nós da fita anterior.
  if(_fBulkStripObserver){ _fBulkStripObserver.disconnect(); _fBulkStripObserver = null; }
  document.getElementById('f-bulk-modal').classList.remove('open');
}

/* ── Assistente de 3 passos ──
   Antes as três etapas ficavam abertas ao mesmo tempo em duas colunas: a numeração
   prometia uma ordem que o layout não cumpria, e ~15 controles disputavam a atenção
   logo na abertura. Agora aparece UMA pergunta por vez; o resto continua existindo,
   só não estorva. Nada de estado novo além do passo atual — as funções, os ids e o
   fluxo de dados são exatamente os mesmos de antes. */
/* ══════════════════════════════════════════════════════════════
   UMA TELA SÓ — a arte ao vivo ao lado da planilha.
   A máquina de 3 passos (fBulkStep/StepNext/StepBack) saiu: o passo 1 era um MENU de
   importação e o passo 3, três controles. Nenhum dos dois é fase de trabalho, e virar tela
   escondia a planilha — que é onde o trabalho acontece — atrás de dois cliques.
   O que sobrou é o vínculo entre as duas colunas: a LINHA ATIVA. Ela é o que a prévia
   grande mostra, o que a fita destaca e o que a tabela acende.
══════════════════════════════════════════════════════════════ */
let _fBulkActive = 0;        // posição da linha ativa (só o fallback — ver _fBulkActiveIdx)
let _fBulkActiveRid = null;  // IDENTIDADE da linha ativa: é ela que manda
let _fBulkHeroToken = 0;     // aborta render antigo quando a linha troca no meio
let _fBulkRidSeq = 0;

/* Identidade estável da linha. O índice sozinho NÃO serve: ordenar reescreve o array e a
   prévia passava a mostrar outro produto sem avisar — medido, eu estava vendo "Zebra", ordenei
   por nome e a arte virou "Abacaxi" calada. É a regra da casa (03_ENGINEERING §3: resolva por
   ID, nunca por posição), e vale para toda linha, venha ela de onde vier — planilha nova, CSV,
   IA, clone ou rascunho restaurado —, por isso o carimbo é preguiçoso. */
function _fBulkRid(row){
  if(row && !row._rid) row._rid = 'r' + (++_fBulkRidSeq);
  return row ? row._rid : null;
}
// Resolve o índice ativo contra o estado ATUAL do lote: primeiro pela identidade (sobrevive a
// ordenar, remover, duplicar e filtrar), e só então pela posição — que é o que sobra quando a
// linha ativa deixou de existir de verdade.
function _fBulkActiveIdx(){
  if(!fBulkRows.length) return -1;
  fBulkRows.forEach(_fBulkRid);
  if(_fBulkActiveRid){
    const i = fBulkRows.findIndex(r => r && r._rid === _fBulkActiveRid);
    if(i >= 0) return i;
  }
  return Math.max(0, Math.min(_fBulkActive, fBulkRows.length-1));
}
function fBulkSetActive(i, opts){
  const n = fBulkRows.length;
  if(!n) return;
  const novo = Math.max(0, Math.min(i|0, n-1));
  const ridNovo = _fBulkRid(fBulkRows[novo]);
  const mudou = ridNovo !== _fBulkActiveRid;
  _fBulkActive = novo;
  _fBulkActiveRid = ridNovo;
  // Acende a linha na tabela sem re-renderizar nada: re-render roubaria o foco de quem
  // está digitando, que é exatamente quem dispara isto.
  /* `[data-row]` e não `tr[data-row]`: no celular a mesma linha é um `<button>` da lista,
     não um `<tr>`. O seletor amplo acende as duas vistas com a mesma regra — só elementos
     que carregam `data-row` são tocados, e só a classe `is-active` muda. */
  const tb = document.getElementById('f-bulk-preview');
  if(tb) tb.querySelectorAll('[data-row]').forEach(el=>{
    el.classList.toggle('is-active', +el.dataset.row === novo);
  });
  const strip = document.getElementById('f-bulk-strip');
  document.querySelectorAll('.f-bulk-strip-item').forEach(b=>{
    const on = +b.dataset.row === novo;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
    /* ⚠ NÃO usar scrollIntoView aqui: ele rola o ancestral rolável mais próximo — e rola
       mesmo um container com `overflow:hidden`, via scrollTop. O resultado media 53px de
       corte no topo das DUAS colunas (a arte aparecia sem o começo). Aqui só a fita rola,
       na horizontal, que é o único movimento que esta seleção justifica. */
    if(on && mudou && strip && !(opts&&opts.semRolar)){
      strip.scrollLeft = b.offsetLeft - (strip.clientWidth - b.offsetWidth)/2;
    }
  });
  _fBulkSyncLiveHead();
  _fBulkRenderHero(mudou);
}
function fBulkStepRow(delta){
  if(!fBulkRows.length) return;
  const n = fBulkRows.length;
  fBulkSetActive((_fBulkActiveIdx() + delta + n) % n);
}
// Rótulo, contador, setas e o selo de "pronta / faltando" — tudo o que descreve a arte
// que está em cena, num lugar só.
function _fBulkSyncLiveHead(){
  const i = _fBulkActiveIdx(), n = fBulkRows.length;
  const lab = document.getElementById('f-bulk-live-label');
  const cnt = document.getElementById('f-bulk-live-count');
  const chip = document.getElementById('f-bulk-live-chip');
  if(lab) lab.textContent = n ? `A arte da linha ${i+1}` : 'Nenhuma linha ainda';
  if(cnt) cnt.textContent = n ? `linha ${i+1} de ${n}` : '—';
  document.querySelectorAll('.f-bulk-live-arrow').forEach(b=>{ b.disabled = n < 2; });
  if(chip){
    const r = fBulkRows[i];
    const faltando = r ? (r.erros||[]).length : 0;
    const vazia = r ? !Object.values(r.dados||{}).some(v=>String(v||'').trim()) : true;
    chip.textContent = vazia ? 'vazia' : (faltando ? `${faltando} campo(s) a preencher` : 'pronta');
    chip.className = 'f-bulk-live-chip ' + (vazia||faltando ? 'is-wait' : 'is-ok');
  }
  /* As setas do carrossel entram por aqui (fBulkStepRow → fBulkSetActive → este ponto),
     então repintar os campos da folha aqui faz a navegação funcionar sem que `fBulkStepRow`
     saiba que a folha existe. A função sai sozinha quando não é celular ou a folha está fechada. */
  try{ _fBulkRenderFolhaCampos(); }catch(e){}
}
/* A prévia grande sai do MESMO motor do PNG final (fRenderTemplateLayers) — é a régua única
   da casa, e é o que garante que esta tela não minta sobre o arquivo que vai baixar.
   `trocou` liga o crossfade: sem ele, substituir o pixel de uma arte pela outra pisca. */
async function _fBulkRenderHero(trocou){
  const cv = document.getElementById('f-bulk-hero-cv');
  const frame = document.getElementById('f-bulk-live-frame');
  if(!cv || !fState.material || !fState.material.layers) return;
  const i = _fBulkActiveIdx();
  const row = fBulkRows[i];
  const token = ++_fBulkHeroToken;
  const [w,h] = fMaterialSize(fState.material, fState.fmt);
  if(frame){
    frame.style.setProperty('--f-bulk-ar', w+'/'+h);
    if(trocou) frame.classList.add('is-swapping');
  }
  // Resolução da prévia: o dobro do que a coluna mostra, com teto — renderizar no tamanho
  // nativo de um story (1080×1920) a cada tecla custaria caro e ninguém veria a diferença.
  const alvo = Math.min(w, 760);
  cv.width = alvo; cv.height = Math.max(1, Math.round(alvo*h/w));
  try{
    const off = document.createElement('canvas'); off.width=w; off.height=h;
    await fRenderTemplateLayers(off.getContext('2d'), fState.material.layers, w, h, (row&&row.dados)||{}, fState.camp);
    if(token !== _fBulkHeroToken) return;   // a linha trocou no meio: este desenho é velho
    const ctx = cv.getContext('2d');
    ctx.clearRect(0,0,cv.width,cv.height);
    ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
    ctx.drawImage(off,0,0,w,h,0,0,cv.width,cv.height);
  }catch(e){
    console.warn('[bulk] prévia grande falhou:', e);
  }finally{
    if(frame && token === _fBulkHeroToken) frame.classList.remove('is-swapping');
  }
}
/* A fita reusa os ids `f-bulk-cv-<i>` das antigas miniaturas de cartão — por isso
   `fBulkRenderThumbs`/`fBulkRenderCardPreview` continuam valendo sem uma linha de mudança. */
function _fBulkRenderStrip(){
  const strip = document.getElementById('f-bulk-strip');
  if(!strip || !fState.material || !fState.material.layers) return;
  const [nw,nh] = fMaterialSize(fState.material, fState.fmt);
  const cw = 34, ch = Math.max(20, Math.round(cw*nh/nw));
  const ativo = _fBulkActiveIdx();
  /* A fita obedece à MESMA busca da tabela. Sem isto ela oferecia miniaturas de linhas que o
     filtro tinha escondido: clicar levava a uma arte que não dava para editar do lado. */
  const query = (document.getElementById('f-bulk-search')?.value || '').trim().toLowerCase();
  const visiveis = fBulkRows.map((r,i)=>({r,i}))
    .filter(({r})=>!query || Object.values(r.dados).some(v=>String(v).toLowerCase().includes(query)));
  strip.innerHTML = visiveis.map(({r,i},pos)=>
    `<button type="button" class="f-bulk-strip-item${i===ativo?' is-active':''}" data-row="${i}"
       role="tab" aria-selected="${i===ativo}" title="Ver a arte da linha ${i+1}"
       style="animation-delay:${Math.min(pos,8)*30}ms" onclick="fBulkSetActive(${i},{semRolar:true})">
       <span class="f-bulk-strip-n">${i+1}</span>
       <canvas id="f-bulk-cv-${i}" width="${cw}" height="${ch}"></canvas>
     </button>`).join('');
  fBulkRenderThumbs();
}
/* O painel de importação (o antigo passo 1). Abre sozinho com a planilha vazia — é o estado
   de quem chega — e fecha quando já há ofertas, porque aí a tabela é o assunto. */
function fBulkToggleImport(forcar){
  const p = document.getElementById('f-bulk-import');
  const b = document.getElementById('f-bulk-import-toggle');
  if(!p) return;
  const abrir = (typeof forcar==='boolean') ? forcar : !p.classList.contains('is-open');
  p.classList.toggle('is-open', abrir);
  if(b) b.setAttribute('aria-expanded', abrir ? 'true' : 'false');
}
/* A arte grande acompanha a digitação — é o ponto inteiro desta tela.
   Debounce curto porque cada volta redesenha o material pelo motor do PNG: disparar por tecla
   travaria a digitação numa arte pesada (o mesmo motivo do debounce da prévia ao vivo do chat).
   `fBulkSaveRow(i,true,true)` é silencioso E não recalcula prontidão — re-render aqui roubaria
   o foco do campo que está sendo digitado. */
let _fBulkLiveT = null;
function fBulkLiveEdit(i){
  fBulkSetActive(i, {semRolar:true});
  clearTimeout(_fBulkLiveT);
  _fBulkLiveT = setTimeout(()=>{
    fBulkSaveRow(i, true, true);
    _fBulkSyncLiveHead();
    _fBulkRenderHero(false);
    if(typeof fBulkRenderCardPreview==='function') fBulkRenderCardPreview(fBulkRows[i], i);
    if(typeof fBulkScheduleAutosave==='function') fBulkScheduleAutosave();
  }, 160);
}
// Importou ofertas com sucesso → fecha o painel e leva o olho pra planilha, que é o resultado.
function _fBulkGoReview(){
  fBulkToggleImport(false);
  const tb = document.getElementById('f-bulk-preview');
  if(tb) try{ tb.scrollIntoView({block:'nearest',behavior:'smooth'}); }catch(e){}
}

/* ── DÚVIDAS FREQUENTES (FAQ) do Luma Sheets ── */
const F_BULK_FAQ = [
  { cat:'Começar', q:'O que é o Luma Sheets?', a:'É a geração de artes em lote numa tela só: você preenche a planilha (cada linha = uma arte), vê cada uma na prévia ao lado enquanto digita, e o Luma gera todas de uma vez, prontas pra baixar num ZIP.' },
  { cat:'Começar', q:'Como preencho a planilha?', a:'Três jeitos: (1) digite direto na tabela; (2) baixe o “CSV Modelo”, preencha no Excel e reenvie; (3) copie do Excel/Planilhas e cole pelo botão “Excel”.' },
  { cat:'Começar', q:'“Começar com exemplos” lê meu cardápio real?', a:'Não. É uma demonstração que gera exemplos por tipo (pizza, sushi, burger) só como ponto de partida. Edite com seus produtos e preços reais antes de gerar.' },
  { cat:'Recursos', q:'Posso ditar por voz?', a:'Sim — clique em “Falar” no painel de preencher e fale suas ofertas (ex.: “hambúrguer por 25, pizza de 50 por 39”). O assistente separa produto e preço. Precisa de Chrome/Edge e do site em https ou localhost (não funciona abrindo o arquivo direto).' },
  { cat:'Recursos', q:'Como coloco fotos nos produtos?', a:'Na planilha, cada campo de imagem tem o botão “Foto” (envia do computador) ou um campo pra colar um link. Fotos abaixo de 600px avisam que podem sair pixeladas.' },
  { cat:'Recursos', q:'Em qual formato as artes saem?', a:'No formato do material que você abriu — o mesmo que a prévia mostra ao lado da planilha. Para o mesmo lote em outro formato (Story, Feed, Post wide…), abra o material naquele formato e rode o lote de novo.' },
  { cat:'Recursos', q:'O que são as Ações em Massa?', a:'Em “Mudar tudo de uma vez” você preenche uma coluna inteira de uma só vez, aplica desconto em % ou arredonda os preços pra final “,90” — tudo em todas as linhas ao mesmo tempo.' },
  { cat:'Recursos', q:'O ZIP vem com as legendas?', a:'Sim — junto das imagens vem um arquivo “legendas_posts.txt” com 3 opções de copy por produto. Escolha entre formato Feed (completo, com hashtags) ou Stories (curto) pelo seletor “Copy” na toolbar. As copys seguem o tom de voz Delivery Much e não se repetem.' },
  { cat:'Problemas', q:'Uma arte saiu em branco ou errada. Por quê?', a:'Confira se a linha não tem campos com erro (o card mostra um aviso laranja) e se o material selecionado tem as variáveis certas. Corrija a linha e gere de novo.' },
];
let _fFaqKeyHandler = null;
function fBulkToggleFaq(){
  const panel = document.getElementById('f-bulk-faq');
  if(!panel) return;
  if(panel.classList.contains('open')){ _fCloseFaq(panel); return; }
  const body = document.getElementById('f-bulk-faq-body');
  if(body && !body.dataset.built){
    let html='', lastCat=null;
    F_BULK_FAQ.forEach(it=>{
      if(it.cat!==lastCat){ html+=`<div class="f-bulk-faq-cat">${gEsc(it.cat)}</div>`; lastCat=it.cat; }
      html+=`<details class="f-bulk-faq-item"><summary>${gEsc(it.q)}</summary><div class="f-bulk-faq-a">${gEsc(it.a)}</div></details>`;
    });
    body.innerHTML = html;
    body.dataset.built = '1';
  }
  panel.classList.add('open');
  // Foco entra no painel (botão fechar) e Esc fecha — o painel cobre o gatilho, então
  // sem isso o único jeito de sair era o "X" (e teclado ficava perdido atrás do overlay).
  const closeBtn = panel.querySelector('.f-bulk-faq-close');
  if(closeBtn) setTimeout(()=>{ try{ closeBtn.focus(); }catch(e){} }, 30);
  _fFaqKeyHandler = (e)=>{ if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); _fCloseFaq(panel); } };
  document.addEventListener('keydown', _fFaqKeyHandler, true);
}
function _fCloseFaq(panel){
  panel.classList.remove('open');
  if(_fFaqKeyHandler){ document.removeEventListener('keydown', _fFaqKeyHandler, true); _fFaqKeyHandler=null; }
  const trigger = document.querySelector('.f-bulk-faq-btn'); // devolve o foco a quem abriu
  if(trigger && trigger.focus) try{ trigger.focus(); }catch(e){}
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
    
    return _fBulkRowFromCampos({nome:name, precoDe, precoPor, validade, desconto});
  });
}

/* Monta UMA linha da grade a partir de campos canônicos. É a única tradução
   "produto/de/por/validade/desconto" → vocabulário do material (as vars do template),
   com máscara e validação. Usada pelo parser heurístico de texto E pela leitura de
   cardápio por IA — duas entradas, um mapeamento (duplicar aqui já foi bug antes). */
function _fBulkRowFromCampos(c){
  const vars = fBulkVars();
  const dados = {};
  vars.forEach(v => dados[v] = '');

  // Só campos de TEXTO recebem o texto parseado — senão o nome caía em "foto_produto"
  // (casa com /produto/i) e o campo "produto" ficava vazio (bug do mapeamento por regex).
  const textVars = vars.filter(v => (typeof fIsImageVar==='function') ? !fIsImageVar(v) : !/foto|logo|imagem|img|avatar/i.test(v));
  // Nome: prefere o campo EXATO "produto"/"titulo"/"nome" antes do casamento por substring.
  const nameKey = textVars.find(v => /^(produto|titulo|nome)$/i.test(v)) || textVars.find(v => /produto|titulo|nome/i.test(v)) || textVars[0];
  if (nameKey) dados[nameKey] = c.nome || '';

  const deKey = textVars.find(v => /^(precode|de)$/i.test(v)) || textVars.find(v => /de|antigo/i.test(v));
  if (deKey) dados[deKey] = c.precoDe ? fApplyMask(deKey, c.precoDe) : '';

  const porKey = textVars.find(v => /^(precopor|por|preco|preço|valor)$/i.test(v)) || textVars.find(v => /por|preco|preço|atual|valor/i.test(v));
  if (porKey) dados[porKey] = c.precoPor ? fApplyMask(porKey, c.precoPor) : '';

  const valKey = textVars.find(v => /validade|data|condicao|condição/i.test(v));
  if (valKey) dados[valKey] = c.validade || '';

  const descKey = textVars.find(v => /desconto|selo|off/i.test(v));
  if (descKey && c.desconto) dados[descKey] = c.desconto;

  // Auto-categorizar se houver campo de categoria
  const catKey = textVars.find(v => /categor|tipo|segmento/i.test(v));
  if (catKey && !dados[catKey]) {
    dados[catKey] = fBulkAutoCategorize(c.nome || '');
  }

  // Validação
  const erros = [];
  vars.forEach(v => {
    const err = typeof fValidate === 'function' ? fValidate(v, dados[v]) : null;
    if (err) erros.push(err);
  });

  return { dados, erros };
}

// Valor que é só número/preço/percentual (não serve como nome de produto).
const _F_SO_NUMERO=/^r?\$?\s*[\d.,%]+\s*(?:reais|off)?$/i;
// Chip "IA" da linha — vale nas DUAS visões da grade (tabela é a padrão; cartões é opção).
// Linha lida de cardápio ou com foto casada por visão pede conferência: preço e foto
// errados só se pegam com o olho do franqueado.
function _fBulkIaChip(r){
  if(!r || (!r._ia && !r._iaFoto)) return '';
  const motivo = r._ia ? 'Nome e preço lidos do cardápio pela IA' : 'Foto casada pela IA';
  return `<span class="f-bulk-ia-chip" title="${motivo} — confira antes de gerar">IA</span>`;
}
function _fBulkRowTemNome(r){
  return Object.values(r&&r.dados||{}).some(v=>{ const s=String(v||'').trim(); return s && !_F_SO_NUMERO.test(s) && !s.startsWith('data:'); });
}
function _fBulkRowTemPreco(r){
  return Object.values(r&&r.dados||{}).some(v=>_F_SO_NUMERO.test(String(v||'').trim()));
}
// Linha aproveitável = tem nome. Linha sem nome vira arte vazia, então é descartada.
function _fBulkRowsUteis(rows){ return (rows||[]).filter(_fBulkRowTemNome); }
// O parser heurístico nunca "falha" — em cardápio colado do WhatsApp ele devolve LIXO
// arrumadinho: uma linha com o título da seção ("LANCHES") e outras só com preço solto.
// Sinal de fracasso: o texto TEM número, mas nenhuma linha saiu com nome E preço juntos.
// (Texto sem número nenhum — só uma lista de nomes — é caso legítimo do parser local.)
function _fBulkHeuristicaFalhou(texto, rows){
  if((rows||[]).some(r=>_fBulkRowTemNome(r) && _fBulkRowTemPreco(r))) return false;
  return /\d/.test(String(texto||''));
}

async function fBulkFillWithAI() {
  const ta = document.getElementById('f-bulk-ai-raw-text');
  if(!ta) return;
  const text = ta.value.trim();
  if(!text) { gToast('Digite ou cole um texto com as ofertas primeiro.', 'error'); return; }

  // Escada: o parser local resolve o caso comum ("burger por 25, pizza de 50 por 39") de
  // graça e na hora. A IA entra só quando ele não achou produto nenhum — texto de cardápio
  // colado do WhatsApp, com seção, emoji e quebra torta.
  let parsedRows = fBulkParseHeuristicText(text);
  let veioDaIA = false;
  if(_fBulkHeuristicaFalhou(text, parsedRows) && typeof gAskAI==='function' && gAiReady()){
    _fBulkSetBusy(true, 'Entendendo suas ofertas…');
    const daIA = await _fBulkItensPorIA('texto', text, null);
    _fBulkSetBusy(false);
    if(daIA && daIA.length){ parsedRows = daIA; veioDaIA = true; }
  }

  parsedRows = _fBulkRowsUteis(parsedRows);
  if(!parsedRows.length) {
    gToast('Não achei nenhum produto ou preço nesse texto.', 'error');
    return;
  }

  fBulkRows = parsedRows;
  _fBulkAfterImport(veioDaIA ? 'texto lido pela IA' : '');
  ta.value = '';
}

/* ══════════════════════════════════════════════════════════════
   LER CARDÁPIO (foto/PDF) — o gargalo real do Sheets não é preencher (voz e ações em
   massa já cobrem), é DIGITAR o cardápio que o lojista mandou por WhatsApp em foto ou
   PDF. Aqui o arquivo vai pro modelo e volta como linhas da grade.
   ⚠ Preço errado é dano real (peça publicada com valor que a loja não honra), então:
   a linha entra MARCADA como lida por IA, passa pela mesma validação das outras e o
   franqueado revisa na grade antes de gerar — nunca vai direto pro ZIP.
══════════════════════════════════════════════════════════════ */
async function fBulkReadMenu(input){
  const files = input && input.files ? Array.from(input.files).slice(0,4) : [];
  if(input) input.value = '';
  if(!files.length) return;
  if(typeof gAskAI!=='function' || !gAiReady()){
    gToast('A leitura de cardápio precisa do assistente de IA, que está indisponível agora.','error');
    return;
  }
  const grandes = files.filter(f=>f.size > 8*1024*1024);
  if(grandes.length){ gToast('Arquivo muito grande (máx. 8 MB por cardápio).','error'); return; }

  _fBulkSetBusy(true, 'Lendo o cardápio…');
  const partes = [];
  for(const f of files){
    const p = await gAiFileToPart(f);
    if(p) partes.push(p);
  }
  if(!partes.length){ _fBulkSetBusy(false); gToast('Não consegui ler esse arquivo.','error'); return; }

  const itens = await _fBulkItensPorIA('arquivo', '', partes);
  _fBulkSetBusy(false);
  if(!itens || !itens.length){
    gToast('Não achei produtos com preço nesse cardápio. Tente uma foto mais nítida ou digite as ofertas.','error');
    return;
  }
  fBulkRows = itens;
  _fBulkAfterImport('cardápio lido pela IA');
}

// Núcleo compartilhado: pede itens ao modelo (de texto OU de anexo) e devolve linhas
// prontas da grade. Um prompt, duas entradas.
async function _fBulkItensPorIA(origem, texto, partes){
  const prompt = `Você extrai itens de cardápio para uma planilha de artes de promoção (Delivery Much, delivery no interior do Brasil).

${origem==='arquivo' ? 'O anexo é um cardápio (foto ou PDF) de um restaurante.' : 'O texto abaixo foi escrito ou colado pelo franqueado:\n"""\n'+texto+'\n"""'}

TAREFA: liste os itens que dá pra anunciar, com preço.

REGRAS:
1. NÃO invente item nem preço. Se o preço não aparece, deixe "" — não estime.
2. Preço como está no original, só número com vírgula decimal (ex.: "25,90"). Sem "R$".
3. Se houver preço normal E promocional, o normal vai em "precoDe" e o promocional em "precoPor". Só um preço: vai em "precoPor".
4. Ignore título de seção ("Lanches", "Bebidas"), endereço, telefone e horário.
5. Nome do produto curto e limpo, sem descrição longa de ingredientes.
6. No máximo 40 itens, na ordem em que aparecem.

Responda APENAS JSON: {"itens":[{"produto":"...","precoDe":"","precoPor":"25,90"}]}`;

  const resp = await gAskAI('cardapio', prompt, {parts:partes||[], json:true, cache:!partes});
  const parsed = resp && (typeof gAiParseJson==='function' ? gAiParseJson(resp) : null);
  const brutos = parsed && Array.isArray(parsed.itens) ? parsed.itens : [];
  const limpaPreco = v => String(v==null?'':v).replace(/r\$\s*/i,'').replace(/[^\d.,]/g,'').trim();
  return brutos.slice(0,40).map(it=>{
    const nome = String(it&&it.produto||'').replace(/\s+/g,' ').trim().slice(0,60);
    if(!nome) return null;
    const row = _fBulkRowFromCampos({
      nome: (typeof fSmartTitleCase==='function') ? fSmartTitleCase(nome) : nome,
      precoDe: limpaPreco(it.precoDe), precoPor: limpaPreco(it.precoPor),
      validade:'', desconto:''
    });
    row._ia = true;   // chip na grade: revisar preço antes de gerar
    return row;
  }).filter(Boolean);
}

// Estado de "trabalhando" do painel de preencher (a leitura de cardápio leva alguns segundos).
// O alvo passou a ser o painel de escrever/falar (#f-bulk-ai-wrap) — o antigo cartão
// #f-ai-prompt-block saiu da tela, e mirar num id morto deixava os botões clicáveis durante a
// leitura, com o segundo clique atropelando o primeiro.
function _fBulkSetBusy(on, texto){
  const card = document.getElementById('f-bulk-ai-wrap');
  if(card) card.classList.toggle('is-busy', !!on);
  document.querySelectorAll('#f-bulk-ai-wrap button, #f-bulk-menu-input').forEach(b=>{ b.disabled = !!on; });
  const st = document.getElementById('f-bulk-menu-status');
  if(st) st.textContent = on ? (texto||'Lendo…') : '';
}

// Fim de importação: status, grade e ida pra revisão — o mesmo desfecho pros 3 caminhos.
function _fBulkAfterImport(fonte){
  const st = document.getElementById('f-bulk-status');
  if(st) st.textContent = `${fBulkRows.length} linha(s) carregada(s)`;
  fBulkRenderPreview();
  _fBulkGoReview();
  const nIA = fBulkRows.filter(r=>r&&r._ia).length;
  if(nIA) gToast(`${nIA} linha(s) do ${fonte} — confira os preços antes de gerar.`);
  else gToast('Tabela preenchida com ' + fBulkRows.length + ' oferta(s).');
  try{ fBulkScheduleAutosave(); }catch(e){}
}

/* ══════════════════════════════════════════════════════════════
   FOTOS EM LOTE — 30 produtos = 30 cliques em "Foto". Aqui o franqueado solta a pasta
   inteira e cada imagem acha sua linha.
   Escada: primeiro o casamento por NOME DE ARQUIVO, que é local, instantâneo e acerta a
   maioria ("x-burger-duplo.jpg" → "X-Burger Duplo"). A IA entra só nas sobras, numa
   única chamada com as fotos restantes. Foto que ninguém casou fica de fora — melhor
   linha sem foto que foto no produto errado.
══════════════════════════════════════════════════════════════ */
function _fBulkImgKey(){
  const vars = fBulkVars();
  return vars.find(v => (typeof fIsImageVar==='function') ? fIsImageVar(v) : /foto|imagem|img/i.test(v)) || '';
}
function _fBulkNormNome(s){
  return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/\.(jpe?g|png|webp|gif)$/i,'').replace(/[^a-z0-9]+/g,' ').trim();
}
// Pontuação de casamento: palavras do nome do produto presentes no nome do arquivo.
function _fBulkScoreNome(produto, arquivo){
  const p=_fBulkNormNome(produto).split(' ').filter(w=>w.length>2);
  const a=_fBulkNormNome(arquivo);
  if(!p.length || !a) return 0;
  const acertos=p.filter(w=>a.indexOf(w)>=0).length;
  return acertos/p.length;
}
async function fBulkMatchPhotos(input){
  const files = input && input.files ? Array.from(input.files).filter(f=>/^image\//.test(f.type)).slice(0,40) : [];
  if(input) input.value='';
  if(!files.length) return;
  const imgKey = _fBulkImgKey();
  if(!imgKey){ gToast('Este material não usa foto de produto.','error'); return; }
  if(!fBulkRows.length){ gToast('Carregue as ofertas primeiro — as fotos vão nas linhas.','error'); return; }

  const nomeKey = Object.keys(fBulkRows[0].dados).find(k=>/^(produto|titulo|nome)$/i.test(k))
    || Object.keys(fBulkRows[0].dados).find(k=>/produto|titulo|nome/i.test(k) && k!==imgKey);
  const pendentes = fBulkRows.map((r,i)=>({i, nome:String((r.dados||{})[nomeKey]||'').trim()}))
                             .filter(x=>x.nome && !String((fBulkRows[x.i].dados||{})[imgKey]||'').trim());
  if(!pendentes.length){ gToast('Todas as linhas já têm foto.','error'); return; }

  _fBulkSetBusy(true,'Casando fotos…');
  const usados=new Set(); const casados=[];
  // 1) nome do arquivo (local, sem IA)
  pendentes.forEach(p=>{
    let melhor=null, melhorScore=0;
    files.forEach((f,fi)=>{
      if(usados.has(fi)) return;
      const s=_fBulkScoreNome(p.nome, f.name);
      if(s>melhorScore){ melhorScore=s; melhor=fi; }
    });
    if(melhor!=null && melhorScore>=0.6){ usados.add(melhor); casados.push({linha:p.i, file:files[melhor], via:'nome'}); }
  });

  // 2) sobras → uma única chamada de visão
  const sobraFotos = files.map((f,i)=>({f,i})).filter(x=>!usados.has(x.i)).slice(0,8);
  const sobraLinhas = pendentes.filter(p=>!casados.some(c=>c.linha===p.i));
  if(sobraFotos.length && sobraLinhas.length && typeof gAskAI==='function' && gAiReady()){
    const partes=[];
    for(const s of sobraFotos){ const p=await gAiFileToPart(s.f); if(p) partes.push(p); }
    if(partes.length){
      const lista=sobraLinhas.map((p,idx)=>`${idx}: ${p.nome}`).join('\n');
      const prompt=`Você casa fotos de comida com itens de um cardápio.

Recebi ${partes.length} imagem(ns), na ordem em que aparecem (imagem 0, imagem 1, ...).

ITENS SEM FOTO:
${lista}

TAREFA: para cada imagem, diga o índice do item que ela mostra.

REGRAS:
1. Só case quando a imagem MOSTRA claramente aquele item. Na dúvida, use null.
2. Um item por imagem, sem repetir item.
3. Responda com um array do tamanho do número de imagens.

Responda APENAS JSON: {"casos":[{"imagem":0,"item":2},{"imagem":1,"item":null}]}`;
      const resp=await gAskAI('casar-fotos', prompt, {parts:partes, json:true, cache:false});
      const parsed=resp && (typeof gAiParseJson==='function'?gAiParseJson(resp):null);
      const casos=parsed&&Array.isArray(parsed.casos)?parsed.casos:[];
      const itemUsado=new Set();
      casos.forEach(c=>{
        const im=Number(c&&c.imagem), it=(c&&c.item);
        if(!Number.isInteger(im) || im<0 || im>=sobraFotos.length) return;
        if(it==null || !Number.isInteger(Number(it))) return;
        const alvo=sobraLinhas[Number(it)];
        if(!alvo || itemUsado.has(alvo.i)) return;
        itemUsado.add(alvo.i);
        casados.push({linha:alvo.i, file:sobraFotos[im].f, via:'ia'});
      });
    }
  }

  // 3) grava (dataURL no mesmo campo que o upload manual usa)
  for(const c of casados){
    const part=await gAiFileToPart(c.file);
    if(!part) continue;
    fBulkRows[c.linha].dados[imgKey]='data:'+part.mimeType+';base64,'+part.data;
    if(c.via==='ia') fBulkRows[c.linha]._iaFoto=true;   // casada por visão: vale conferir
  }
  try{ if(typeof _fBulkRevalidateRows==='function') _fBulkRevalidateRows(fBulkRows); }catch(e){}
  _fBulkSetBusy(false);
  fBulkRenderPreview();
  try{ fBulkScheduleAutosave(); }catch(e){}

  const porNome=casados.filter(c=>c.via==='nome').length, porIA=casados.filter(c=>c.via==='ia').length;
  const sobrando=pendentes.length-casados.length;
  if(!casados.length) gToast('Não consegui casar nenhuma foto com as linhas — envie pelo nome do produto no arquivo.','error');
  else gToast(`${casados.length} foto(s) posicionada(s)${porIA?` (${porNome} pelo nome, ${porIA} pela IA)`:''}${sobrando?` · ${sobrando} linha(s) ainda sem foto`:''}.`);
}

let _fSpeechActive = false;
let _fSpeechStarting = false;
let _fSpeechInstance = null;
let _fSpeechWanted = false;
let _fSpeechButton = null;
let _fSpeechInput = null;
let _fSpeechBase = '';
let _fSpeechCommitted = '';
let _fSpeechCycleFinal = '';
let _fSpeechFatal = false;
let _fAudioStream = null;
let _fMediaRecorder = null;
let _fAudioChunks = [];

// Estado visual do botão de voz via classe (sem cor hardcoded — o CSS usa tokens).
function fSpeechButtonUI(btn, state){
  if(!btn) return;
  const label = btn.querySelector('.f-mic-label');
  const isRecording = state === 'recording';
  const isProcessing = state === 'processing';
  btn.classList.toggle('is-recording', isRecording);
  btn.classList.toggle('is-processing', isProcessing);
  btn.setAttribute('aria-pressed', isRecording ? 'true' : 'false');
  btn.disabled = isProcessing;
  const text = isRecording ? 'Parar' : (isProcessing ? 'Transcrevendo' : 'Falar');
  if(label) label.textContent = text;
  btn.setAttribute('aria-label', isRecording ? 'Parar gravação' : (isProcessing ? 'Transcrevendo áudio' : 'Ditar por voz'));
  btn.title = isRecording ? 'Parar e usar o texto' : (isProcessing ? 'Transcrevendo áudio…' : 'Falar em vez de digitar');
}
function fStopSpeechUI(btn){
  fSpeechButtonUI(btn, 'idle');
}
function fSpeechWrite(value){
  if(!_fSpeechInput) return;
  _fSpeechInput.value = value;
  _fSpeechInput.dispatchEvent(new Event('input', {bubbles:true}));
}
function fSpeechReset(){
  if(_fAudioStream){ _fAudioStream.getTracks().forEach(t=>t.stop()); }
  _fAudioStream = null; _fMediaRecorder = null; _fAudioChunks = [];
  _fSpeechActive = false; _fSpeechStarting = false; _fSpeechInstance = null;
  _fSpeechWanted = false; _fSpeechFatal = false;
  fStopSpeechUI(_fSpeechButton);
  _fSpeechButton = null; _fSpeechInput = null;
}

function fSpeechRecognitionStart(SR){
  const rec = new SR();
  _fSpeechInstance = rec;
  _fSpeechStarting = true;
  rec.lang = 'pt-BR';
  // Safari/iOS encerra ou lança erro com continuous=true. Reiniciamos sessões curtas
  // enquanto o usuário não tocar em Parar; Chrome/Edge usam a sessão contínua nativa.
  const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  rec.continuous = !isAppleMobile;
  rec.interimResults = true;
  _fSpeechCycleFinal = '';
  fSpeechButtonUI(_fSpeechButton, 'recording');
  rec.onstart = () => { _fSpeechActive = true; _fSpeechStarting = false; gToast('Ouvindo… fale as ofertas. Clique de novo para parar.'); };
  rec.onresult = (e) => {
    let cycleFinal = '', interim = '';
    for(let i=0; i<e.results.length; i++){
      const t = String(e.results[i][0].transcript || '').trim();
      if(!t) continue;
      if(e.results[i].isFinal) cycleFinal += t + ' '; else interim += t;
    }
    _fSpeechCycleFinal = cycleFinal;
    fSpeechWrite(_fSpeechBase + _fSpeechCommitted + cycleFinal + interim);
  };
  rec.onerror = (e) => {
    console.error('Speech error:', e.error);
    if(e.error === 'not-allowed' || e.error === 'service-not-allowed'){
      _fSpeechFatal = true; _fSpeechWanted = false;
      gToast('Microfone bloqueado — permita o acesso ao microfone nas configurações do navegador.', 'error');
    }
    else if(e.error === 'no-speech') gToast('Nenhuma fala detectada. Fale mais perto do microfone.', 'error');
    else if(e.error === 'audio-capture') { _fSpeechFatal = true; _fSpeechWanted = false; gToast('Nenhum microfone disponível neste dispositivo.', 'error'); }
    else if(e.error !== 'aborted' && e.error !== 'network') gToast('Falha no áudio. Tente de novo.', 'error');
  };
  rec.onend = () => {
    _fSpeechCommitted += _fSpeechCycleFinal;
    _fSpeechCycleFinal = '';
    _fSpeechActive = false; _fSpeechStarting = false; _fSpeechInstance = null;
    if(_fSpeechWanted && !_fSpeechFatal){
      setTimeout(()=>{ if(_fSpeechWanted) fSpeechRecognitionStart(SR); }, 180);
      return;
    }
    const added = _fSpeechCommitted.trim();
    fSpeechReset();
    if(added) gToast('Transcrição adicionada.');
  };
  try{ rec.start(); }
  catch(e){ fSpeechReset(); gToast('Não consegui iniciar o microfone — tente de novo.', 'error'); }
}

async function fRecordedSpeechStart(){
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder){
    gToast('Este navegador não oferece gravação de voz. Atualize-o e tente novamente.', 'error'); fSpeechReset(); return;
  }
  if(typeof gAiReady!=='function' || !gAiReady()){
    gToast('A transcrição de áudio está indisponível agora. Você ainda pode digitar normalmente.', 'error'); fSpeechReset(); return;
  }
  try{
    _fAudioStream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
    const preferred = ['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(t=>MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t));
    _fMediaRecorder = preferred ? new MediaRecorder(_fAudioStream,{mimeType:preferred}) : new MediaRecorder(_fAudioStream);
    _fAudioChunks = [];
    _fMediaRecorder.ondataavailable = e=>{ if(e.data && e.data.size) _fAudioChunks.push(e.data); };
    _fMediaRecorder.onstop = async()=>{
      const btn = _fSpeechButton, input = _fSpeechInput;
      _fAudioStream.getTracks().forEach(t=>t.stop()); _fAudioStream = null;
      if(!_fAudioChunks.length){ fSpeechReset(); gToast('Nenhum áudio foi capturado.', 'error'); return; }
      fSpeechButtonUI(btn,'processing');
      try{
        const type = _fMediaRecorder.mimeType || _fAudioChunks[0].type || 'audio/webm';
        const file = new File([new Blob(_fAudioChunks,{type})], 'fala.'+(type.includes('mp4')?'m4a':'webm'), {type});
        const part = await gAiFileToPart(file);
        const text = part && await gAskAI('transcrever-audio','Transcreva este áudio em português do Brasil. Retorne somente o texto falado, sem aspas, título ou explicação.',{parts:[part],cache:false});
        if(text && input){ input.value = _fSpeechBase + String(text).trim(); input.dispatchEvent(new Event('input',{bubbles:true})); gToast('Transcrição adicionada.'); }
        else gToast('Não consegui entender o áudio. Tente falar mais perto do microfone.', 'error');
      }catch(e){ console.error('Audio transcription error:',e); gToast('Não consegui transcrever o áudio. Tente novamente.', 'error'); }
      finally{ fSpeechReset(); }
    };
    _fMediaRecorder.start(); _fSpeechActive = true; _fSpeechStarting = false;
    fSpeechButtonUI(_fSpeechButton,'recording'); gToast('Gravando… clique novamente para transcrever.');
  }catch(e){
    fSpeechReset();
    if(e && (e.name==='NotAllowedError'||e.name==='SecurityError')) gToast('Microfone bloqueado — permita o acesso nas configurações do navegador.', 'error');
    else gToast('Não consegui acessar o microfone deste dispositivo.', 'error');
  }
}

// Ditar por voz em todas as superfícies do franqueado. Usa reconhecimento ao vivo
// quando existe e cai para gravação + transcrição nos navegadores sem Web Speech.
function fStartSpeech(event, inputId){
  if(event) event.preventDefault();
  if(typeof window.isSecureContext!=='undefined' && !window.isSecureContext){
    gToast('O microfone precisa do Luma aberto pelo endereço do site. Recarregue por lá e tente de novo.', 'error'); return;
  }
  if(_fSpeechActive || _fSpeechStarting){
    _fSpeechWanted = false;
    if(_fMediaRecorder && _fMediaRecorder.state!=='inactive'){ _fMediaRecorder.stop(); return; }
    if(_fSpeechInstance){ try{ _fSpeechInstance.stop(); }catch(e){ fSpeechReset(); } }
    return;
  }
  _fSpeechButton = event && event.currentTarget ? event.currentTarget : document.getElementById('f-bulk-mic-btn');
  _fSpeechInput = document.getElementById(inputId);
  if(!_fSpeechInput) return;
  _fSpeechBase = _fSpeechInput.value ? (_fSpeechInput.value.replace(/\s*$/,'')+' ') : '';
  _fSpeechCommitted = ''; _fSpeechCycleFinal = ''; _fSpeechFatal = false; _fSpeechWanted = true; _fSpeechStarting = true;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(SR) fSpeechRecognitionStart(SR); else fRecordedSpeechStart();
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
  const ok=()=>gToast('Prompt copiado — cole no ChatGPT.');
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(ok).catch(()=>fCopyAIPromptFallback(text,ok));
  }else fCopyAIPromptFallback(text,ok);
}
function fCopyAIPromptFallback(text,ok){
  const ta=document.createElement('textarea');
  ta.value=text;ta.style.position='fixed';ta.style.opacity='0';
  document.body.appendChild(ta);ta.select();
  try{document.execCommand('copy');ok();}catch(e){gToast('Não consegui copiar sozinha — selecione o texto e copie.','error');}
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
  if(!vars.length){gToast('Este material não tem campos pra preencher.');return;}
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
  gToast('Modelo de planilha com '+N+' exemplos baixado — edite e reenvie.');
  if (typeof gTriggerOnboardingStep === 'function') {
    gTriggerOnboardingStep('triedCsv');
  }
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
  if(!raw || !raw.length){ gToast('A planilha está vazia.','error'); return; }
  
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
    const label = gEsc(v);
    
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
        const safeRk = gEsc(rk);
        return `<option value="${safeRk}" ${selected}>${safeRk}</option>`;
      })).join('');
      
    const idV = String(v).replace(/[^a-zA-Z0-9_-]/g,'_'); // nome de campo vem de cabeçalho CSV do usuário → sanitiza p/ atributo id
    return `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px">
      <span style="font-size:11px;font-weight:bold;color:var(--text)">${label}:</span>
      <select id="f-bulk-map-select-${idV}" style="font-size:11px;padding:6px;border:1px solid var(--gray-mid);border-radius:4px;background:var(--white);color:var(--text);width:60%;outline:none">
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
    const idV = String(v).replace(/[^a-zA-Z0-9_-]/g,'_'); // mesmo slug do id gerado em fRenderBulkMapper
    const select = document.getElementById(`f-bulk-map-select-${idV}`);
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
/* Escrever/falar as ofertas. Era um cartão sempre aberto ocupando meia coluna do painel; virou
   um caminho sob demanda como os outros cinco. O textarea, o microfone e o `fBulkFillWithAI`
   são os MESMOS — só mudaram de lugar. Abre já com o cursor dentro: quem clicou aqui veio
   escrever, e um campo que aparece sem foco cobra um clique a mais por nada. */
function fBulkToggleAiText(){
  const wrap = document.getElementById('f-bulk-ai-wrap');
  if(!wrap) return;
  const abrir = wrap.style.display === 'none';
  wrap.style.display = abrir ? 'block' : 'none';
  if(abrir){ const ta = document.getElementById('f-bulk-ai-raw-text'); if(ta) try{ ta.focus(); }catch(e){} }
}

// Detecta se o texto colado é tabular (Excel/CSV) ou texto livre de cardápio. Tabular =
// tem tabs, OU toda linha não-vazia tem o mesmo nº de vírgulas (>=1). Senão é cardápio.
function _fBulkLooksTabular(text){
  if(text.includes('\t')) return true;
  const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(lines.length<2) return false;
  const commas=lines.map(l=>(l.match(/,/g)||[]).length);
  return commas[0]>=1 && commas.every(n=>n===commas[0]);
}
function fBulkHandlePaste() {
  const ta = document.getElementById('f-bulk-paste-ta');
  if(!ta) return;
  const text = ta.value.trim();
  if(!text) { gToast('Cole a planilha ou o texto do cardápio primeiro','error'); return; }

  // Texto de cardápio (sem colunas) → parser heurístico (extrai produto/preço/validade).
  if(!_fBulkLooksTabular(text)){
    if(typeof fBulkParseHeuristicText!=='function'){ gToast('Não consegui ler esse texto.','error'); return; }
    const rows=fBulkParseHeuristicText(text).filter(r=>Object.values(r.dados).some(v=>v&&String(v).trim()));
    if(!rows.length){ gToast('Não achei produtos nesse texto. Tente uma linha por item (ex.: "Pizza Calabresa de 40 por 30").','warning'); return; }
    fBulkRows=rows;
    _fBulkTableView=true;
    const st=document.getElementById('f-bulk-status'); if(st) st.textContent=`${rows.length} linha(s) carregada(s)`;
    fBulkRenderPreview();
    _fBulkGoReview();
    ta.value='';
    gToast(`${rows.length} item(ns) do cardápio — confira preço/validade e gere.`);
    return;
  }

  let raw;
  try{
    const delim = text.includes('\t') ? '\t' : ',';
    if(window.Papa) {
      const res = Papa.parse(text, { header: true, skipEmptyLines: 'greedy', delimiter: delim });
      raw = res.data;
    } else {
      raw = fBulkParseCSV(text);
    }
  }catch(err){ gToast('Dados inválidos.','error'); return; }

  fBulkProcessRawData(raw);
  ta.value = '';
}

function fBulkHandleCSV(input){
  const file=input.files[0];if(!file)return;
  const r=new FileReader();
  r.onload=e=>{
    let raw;
    try{ raw=fBulkParseCSV(e.target.result); }catch(err){ gToast('Planilha inválida.','error'); return; }
    fBulkProcessRawData(raw);
    if (typeof gTriggerOnboardingStep === 'function') {
      gTriggerOnboardingStep('triedCsv');
    }
  };
  r.readAsText(file);
}
let _fBulkRenderToken=0;
/* Só existe a grade. A "vista em cartões" era a única forma de ver as artes do lote, e a
   coluna da esquerda passou a fazer isso melhor — grande, ao vivo e sem trocar de modo. A
   variável fica porque o rascunho salvo guarda `tableView` e não vale invalidar rascunho de
   quem está no meio de uma produção; o toggle é que saiu. */
let _fBulkTableView=true;

// Uma leitura única mantém cabeçalho, rodapé e pré-voo falando a mesma verdade.
// Linha totalmente vazia não é "erro": é um espaço de trabalho ainda não usado.
function fBulkGetReadiness(keys=fBulkVars(), formatCount=null) {
  const readyRows = [];
  const errorRows = [];
  const emptyRows = [];
  fBulkRows.forEach((row, index) => {
    const isEmpty = keys.every(k => !String((row.dados || {})[k] || '').trim());
    if (isEmpty) {
      emptyRows.push({row, index});
    } else if (row.erros && row.erros.length) {
      errorRows.push({row, index});
    } else {
      readyRows.push({row, index});
    }
  });

  // Um formato por oferta: o do material aberto. Antes isto contava os chips do rodapé, que
  // saíram — e consultar um seletor morto para sempre cair no fallback é o tipo de linha que
  // sobrevive a um refactor fingindo que ainda decide algo.
  if (formatCount === null) formatCount = 1;

  return {
    readyRows,
    errorRows,
    emptyRows,
    formatCount,
    artCount: readyRows.length * formatCount
  };
}

function fBulkUpdateReadiness(readiness=fBulkGetReadiness()) {
  const ready = readiness.readyRows.length;
  const errors = readiness.errorRows.length;
  const empty = readiness.emptyRows.length;
  const total = fBulkRows.length;
  const status = document.getElementById('f-bulk-status');
  const dot = document.querySelector('.f-bulk-live-dot');
  const footer = document.querySelector('.f-bulk-footer-note span');
  const dlBtn = document.getElementById('f-bulk-dl-btn');

  if (status) {
    if (!total) status.textContent = 'Planilha vazia';
    else if (!ready && !errors) status.textContent = `${total} linha(s) disponível(is) · preencha uma oferta`;
    else if (errors) status.textContent = `${ready} pronta(s) · ${errors} para revisar`;
    else status.textContent = `${ready} pronta(s) para gerar`;
  }

  if (dot) {
    const color = ready ? (errors ? 'var(--dm-yellow)' : 'var(--green)') : (errors ? 'var(--dm-red)' : 'var(--gray-mid)');
    dot.style.background = color;
    dot.style.boxShadow = `0 0 0 3px color-mix(in srgb,${color} 14%,transparent)`;
  }

  if (footer) {
    if (!ready && errors) {
      footer.textContent = `Revise ${errors} linha(s) destacada(s) antes de gerar.`;
    } else if (!ready) {
      footer.textContent = 'Preencha pelo menos uma oferta para gerar as artes.';
    } else {
      // Sem seletor de formato, cada oferta pronta é UMA arte — a multiplicação sumiu junto
      // com os chips, e anunciar "× 1 formato" seria explicar uma conta que não existe mais.
      let text = `${ready} arte(s) no ZIP, no formato do material`;
      if (errors) text += ` · ${errors} linha(s) com erro serão puladas`;
      else if (empty) text += ` · ${empty} linha(s) vazia(s) serão ignoradas`;
      footer.textContent = text;
    }
  }

  if (dlBtn) {
    const label = ready ? `Gerar ${readiness.artCount} arte${readiness.artCount === 1 ? '' : 's'}` : (errors ? 'Revise para gerar' : 'Preencha uma oferta');
    dlBtn.disabled = ready === 0;
    dlBtn.setAttribute('aria-disabled', ready === 0 ? 'true' : 'false');
    dlBtn.title = ready ? `${readiness.artCount} arte(s) pronta(s) para gerar` : 'Preencha e revise a planilha antes de gerar';
    dlBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></svg><span id="f-bulk-dl-label">${label}</span>`;
  }
  // O selo da prévia ("pronta" / "N campos a preencher") vem da mesma apuração — sem isto ele
  // mentiria enquanto o resto da tela já sabia a verdade.
  if(typeof _fBulkSyncLiveHead==='function') _fBulkSyncLiveHead();
}

/* ══════════════════════════════════════════════════════════════════════════════
   O SHEETS NO CELULAR — lista + folha de edição
   ══════════════════════════════════════════════════════════════════════════════
   A grade linha × coluna é uma metáfora de MESA: precisa de largura para existir.
   Num telefone de 390px ela virava 260px de planilha só alcançáveis rolando na
   horizontal. Aqui a mesma verdade muda de instrumento, sem perder função:

     · a TABELA vira LISTA vertical — nome, detalhe e o estado de cada oferta;
     · a COLUNA DE PRÉVIA vira FOLHA que sobe por cima (só CSS, ver chat.css).

   ⚠ Quase nada disto é motor novo, e é de propósito:
     `fBulkGetReadiness` já separava pronta / falta algo / vazia — a lista só desenha
     o que ela calcula. As setas “anterior/próxima” da folha são os botões que já
     existiam na coluna de prévia chamando `fBulkStepRow(±1)`. A arte é o mesmo
     `_fBulkRenderHero` do desktop, no mesmo `#f-bulk-hero-cv`.
   ⚠ Os inputs da folha usam os MESMOS ids `f-bulk-edit-{i}-{k}` da tabela. É isso que
     deixa `fBulkSaveRow` e `fBulkCollectCurrentInputs` valerem sem uma linha de mudança:
     os dois leem por id e caem em `row.dados` quando o input não está na tela — e na
     folha só a linha ativa está. */

function _fBulkEhCelular(){
  return !!(window.matchMedia && matchMedia('(max-width:680px)').matches);
}
let _fBulkFiltro = 'todas';   // 'todas' | 'falta' | 'prontas'

/* Mesma régua do `fBulkGetReadiness`, por linha. Repetida aqui em vez de chamada porque
   aquela varre o lote inteiro e devolve três arrays — pedir isso por linha seria O(n²). */
function _fBulkEstadoLinha(r, keys){
  if(!r) return 'vazia';
  const vazia = keys.every(k => !String((r.dados||{})[k] || '').trim());
  if(vazia) return 'vazia';
  return (r.erros && r.erros.length) ? 'falta' : 'pronta';
}

/* Título e detalhe da linha na lista. Heurística honesta: o primeiro campo de texto é o
   nome e o segundo é o detalhe — é como todo material de promo do Luma é montado
   (produto + preço). Campo de imagem nunca vira título: viraria uma URL gigante. */
function _fBulkResumoLinha(r, keys){
  const txt = keys.filter(k => !fIsImageVar(k));
  const val = k => String(((r&&r.dados)||{})[k] || '').trim();
  return { titulo: val(txt[0]), detalhe: val(txt[1]) };
}

function _fBulkRenderLista(){
  const wrap = document.getElementById('f-bulk-preview');
  if(!wrap) return;
  const keys = fBulkVars();
  const ativa = _fBulkActiveIdx();
  const busca = (document.getElementById('f-bulk-search')?.value || '').trim().toLowerCase();

  const estados = fBulkRows.map(r => _fBulkEstadoLinha(r, keys));
  const nFalta = estados.filter(e => e !== 'pronta').length;
  const nPronta = estados.filter(e => e === 'pronta').length;

  const chip = (id, rot, n) => `<button type="button" class="f-bulk-lchip${_fBulkFiltro===id?' is-on':''}"
    aria-pressed="${_fBulkFiltro===id?'true':'false'}" onclick="fBulkFiltrarLista('${id}')">${gEsc(rot)}${n!=null?` · ${n}`:''}</button>`;

  const itens = fBulkRows.map((r, i) => {
    const est = estados[i];
    if(_fBulkFiltro==='falta' && est==='pronta') return '';
    if(_fBulkFiltro==='prontas' && est!=='pronta') return '';
    if(busca && !Object.values(r.dados||{}).some(v => String(v).toLowerCase().includes(busca))) return '';
    const {titulo, detalhe} = _fBulkResumoLinha(r, keys);
    const selo = est==='pronta' ? '<span class="f-bulk-lpill is-ok">pronta</span>'
      : est==='vazia' ? '<span class="f-bulk-lpill is-mut">vazia</span>'
      : `<span class="f-bulk-lpill is-gap">${(r.erros||[]).length} a preencher</span>`;
    /* O nome cai para "Oferta N" quando ainda não há texto — mostrar uma linha em branco
       na lista é pior que assumir o rótulo: a pessoa não sabe onde tocar. */
    return `<button type="button" class="f-bulk-litem${i===ativa?' is-active':''}" data-row="${i}"
      onclick="fBulkAbrirFolha(${i})" aria-label="Abrir a oferta ${i+1}">
      <span class="f-bulk-lnum">${i+1}</span>
      <span class="f-bulk-ltx">
        <span class="f-bulk-lnome">${gEsc(titulo) || `<i>Oferta ${i+1}</i>`}</span>
        <span class="f-bulk-lmeta">${detalhe?gEsc(detalhe)+' · ':''}${selo}</span>
      </span>
      <span class="f-bulk-lgo" aria-hidden="true">›</span>
    </button>`;
  }).join('');

  wrap.innerHTML = `<div class="f-bulk-lista">
    <div class="f-bulk-lfiltros" role="group" aria-label="Filtrar ofertas">
      ${chip('falta','Falta algo',nFalta)}${chip('todas','Todas',fBulkRows.length)}${chip('prontas','Prontas',nPronta)}
    </div>
    ${itens || '<p class="f-bulk-lvazio">Nenhuma oferta neste filtro.</p>'}
  </div>`;

  _fBulkRenderStrip();
  fBulkSetActive(ativa, {semRolar:true});
}

function fBulkFiltrarLista(f){
  _fBulkFiltro = f;
  _fBulkRenderLista();
}

/* Abre a folha na oferta `i`. `fBulkSetActive` é quem manda a arte e o cabeçalho
   acompanharem — aqui só entra o estado de "folha aberta" e os campos da linha. */
function fBulkAbrirFolha(i){
  fBulkCollectCurrentInputs();          // não perde o que estava digitado na folha anterior
  document.body.classList.add('f-bulk-folha');
  fBulkSetActive(i);
  _fBulkRenderFolhaCampos(true);        // forçado: reabrir a MESMA linha tem que repintar
}
function fBulkFecharFolha(){
  const i = _fBulkActiveIdx();
  if(i >= 0) fBulkSaveRow(i, true);     // sair sem salvar seria perder o que a pessoa digitou
  document.body.classList.remove('f-bulk-folha');
  _fBulkRenderLista();
}

/* Os campos da linha ativa dentro da folha. Chamado por `_fBulkSyncLiveHead`, então as
   setas do carrossel repintam os campos de graça — sem que elas precisem saber da folha. */
let _fBulkFolhaRid = null;
function _fBulkRenderFolhaCampos(forcar){
  const alvo = document.getElementById('f-bulk-folha-campos');
  if(!alvo) return;
  if(!_fBulkEhCelular() || !document.body.classList.contains('f-bulk-folha')){
    alvo.innerHTML=''; _fBulkFolhaRid = null; return;
  }
  const i = _fBulkActiveIdx();
  const r = fBulkRows[i];
  if(i < 0 || !r){ alvo.innerHTML=''; _fBulkFolhaRid = null; return; }
  /* ⚠ SÓ REPINTA QUANDO A LINHA MUDA. Cada tecla chama `fBulkLiveEdit` → `fBulkSetActive` →
     `_fBulkSyncLiveHead` → aqui; repintar nessa hora reconstrói os inputs a partir de
     `r.dados`, que só é gravado 160ms depois — ou seja, apaga a letra recém-digitada.
     Medido: digitar na folha e fechar deixava o campo VAZIO. É a mesma armadilha que a
     tabela já evitava ("re-render roubaria o foco de quem está digitando"). */
  const rid = _fBulkRid(r);
  if(!forcar && rid === _fBulkFolhaRid) return;
  _fBulkFolhaRid = rid;
  const rotuloDe = k => (typeof _fLpLabel === 'function' ? _fLpLabel(k) : k);

  alvo.innerHTML = fBulkVars().map(k => {
    const rot = gEsc(rotuloDe(k)).replace(/"/g,'&quot;');
    const val = gEsc(r.dados[k] || '').replace(/"/g,'&quot;');
    const erro = (r.erros||[]).some(e => e.includes(k));
    if(fIsImageVar(k)){
      return `<label class="f-bulk-fcampo">
        <span class="f-bulk-flabel">${rot}</span>
        <button type="button" class="f-bulk-ffoto${val?' tem':''}" onclick="fBulkUploadCellImage(${i},'${gEsc(k)}')">
          ${val ? 'Trocar a foto' : 'Enviar a foto'}
        </button>
      </label>`;
    }
    /* `type="text"` e não `number`: preço no Brasil é "29,90" e o campo numérico do celular
       recusa a vírgula em boa parte dos aparelhos. `inputmode="decimal"` traz o teclado de
       números sem impor o formato — o `fValidate` continua sendo quem julga o valor. */
    const numerico = /pre[çc]o|valor|de_|por_/i.test(k);
    return `<label class="f-bulk-fcampo">
      <span class="f-bulk-flabel">${rot}</span>
      <input type="text" id="f-bulk-edit-${i}-${k}" class="f-bulk-fin${erro?' tem-erro':''}" value="${val}"
        ${numerico?'inputmode="decimal" ':''}placeholder="${rot}" aria-label="${rot}"
        oninput="fBulkLiveEdit(${i})" onblur="fBulkSaveRow(${i}, true)">
    </label>`;
  }).join('');
}

function fBulkRenderPreview(){
  const wrap=document.getElementById('f-bulk-preview');if(!wrap)return;
  fBulkUpdateReadiness();
  if(!fBulkRows.length){
    wrap.innerHTML='<div class="f-bulk-empty">Nenhuma linha na planilha. Adicione uma linha ou preencha com IA, cardápio ou Excel.</div>';
    /* ⚠ Esvaziar a planilha TEM que apagar a coluna da esquerda junto. Sem isto a arte grande
       e a fita continuavam mostrando as linhas que acabaram de ser excluídas — a tela dizia
       "Nenhuma linha ainda" no rótulo e exibia três miniaturas de artes inexistentes ao lado.
       Medido: linhas=0 e miniaturas=3, com a arte da última linha ainda pintada. */
    _fBulkActiveRid = null; _fBulkActive = 0;
    const _strip = document.getElementById('f-bulk-strip');
    if(_strip) _strip.innerHTML = '';
    const _hero = document.getElementById('f-bulk-hero-cv');
    if(_hero){ try{ _hero.getContext('2d').clearRect(0,0,_hero.width,_hero.height); }catch(e){} }
    _fBulkSyncLiveHead();
    return;
  }

  // No celular a grade dá lugar à lista. O desvio fica DEPOIS da guarda de lote vazio para
  // que "planilha sem linhas" continue com a mesma mensagem e a mesma limpeza nos dois casos.
  if (_fBulkEhCelular()) { _fBulkRenderLista(); return; }

  if (_fBulkTableView) {
    const keys = fBulkVars();
    const labelFor = k => (typeof _fLpLabel === 'function' ? _fLpLabel(k) : k);
    const ths = keys.map(k => `<th style="padding:10px 8px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-2,#3A3A3A);font-weight:700;white-space:nowrap">${gEsc(labelFor(k))}</th>`).join('');
    
    const query = document.getElementById('f-bulk-search')?.value.trim().toLowerCase() || '';
    let trs = fBulkRows.map((r,i) => {
      if (query) {
        const match = Object.values(r.dados).some(v => String(v).toLowerCase().includes(query));
        if (!match) return '';
      }
      const tds = keys.map(k => {
        const val = r.dados[k] || '';
        const isFieldErr = r.erros.find(e => e.includes(k));
        const safeV = gEsc(val).replace(/"/g, '&quot;');
        
        if (fIsImageVar(k)) {
          return `<td style="padding:6px 4px;border-bottom:1px solid var(--gray-light, #F2F2F2)">
            <div style="display:flex;align-items:center;gap:8px;min-width:170px">
              ${val ? `
                <div style="position:relative;width:28px;height:28px;border-radius:var(--r-sm);border:1px solid var(--gray-mid,#D4D4D4);overflow:hidden;background:var(--gray-light);flex-shrink:0" title="Prévia da foto">
                  <img src="${safeV}" style="width:100%;height:100%;object-fit:cover" onerror="this.src='';this.parentElement.style.borderColor='var(--dm-red,#C81818)';gToast('Link de imagem inválido ou quebrado!','error')" onload="if(this.naturalWidth && (this.naturalWidth < 600 || this.naturalHeight < 600)){ this.parentElement.style.borderColor='var(--dm-yellow,#FFB900)'; this.parentElement.title='Aviso: Resolução baixa ('+this.naturalWidth+'x'+this.naturalHeight+'px)'; } else { this.parentElement.style.borderColor='var(--gray-mid,#D4D4D4)'; }">
                </div>
                <button class="d-btn-sec" style="padding:4px 8px;font-size:11px;color:var(--dm-red,#C81818);border-color:var(--gray-mid,#D4D4D4);border-radius:var(--r-sm);background:var(--white);font-weight:600;cursor:pointer" onclick="fBulkClearImage(${i}, '${k}')">Excluir</button>
              ` : `
                <label class="d-btn-sec" style="padding:5px 9px;font-size:11px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;border-radius:var(--r-sm);border:1px solid var(--gray-mid,#D4D4D4);background:var(--white);font-weight:600">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Foto
                  <input type="file" accept="image/*" style="display:none" onchange="fBulkUploadCellImage(this, ${i}, '${k}')">
                </label>
                <input type="text" placeholder="Cole link..." value="" id="f-bulk-edit-${i}-${k}" onblur="fBulkSaveRow(${i}, true)" style="font-size:12px;padding:5px 8px;border:1px solid var(--gray-mid,#D4D4D4);border-radius:var(--r-sm);width:80px;background:var(--white,#FFFFFF);color:var(--text,#0A0A0A);outline:none">
              `}
            </div>
          </td>`;
        }

        // onfocus acende a linha na prévia; oninput mantém a arte grande acompanhando o que
        // está sendo digitado (com folga — ver fBulkLiveEdit).
        /* `aria-label` porque o vínculo com o `<th>` não chega ao leitor de tela numa célula
           montada assim — sem ele a pessoa ouve "editar texto" 30 vezes sem saber a coluna.
           A dica (`placeholder`) só na PRIMEIRA linha: em 20 linhas vazias, repetir "Nome do
           produto" em cada célula vira ruído; na primeira ela é a pista de onde digitar. */
        const rotulo=labelFor(k);
        const dica=(i===0)?` placeholder="${gEsc(rotulo).replace(/"/g,'&quot;')}"`:'';
        return `<td style="padding:6px 4px;border-bottom:1px solid var(--gray-light, #F2F2F2)">
          <input type="text" id="f-bulk-edit-${i}-${k}" class="f-bulk-cell${isFieldErr?' f-bulk-cell-err':''}" value="${safeV}"${dica} aria-label="${gEsc(rotulo).replace(/"/g,'&quot;')}, linha ${i+1}" style="width:100%;min-width:120px;font-size:12px;padding:6px 8px;border:1px solid var(--gray-mid, #D4D4D4);border-radius:var(--r-sm);background:var(--white,#FFFFFF);color:var(--text,#0A0A0A);outline:none;transition:all var(--dur-micro) var(--ease-standard)" oninput="fBulkLiveEdit(${i})" onfocus="fBulkSetActive(${i})" onblur="fBulkSaveRow(${i}, true)">
        </td>`;
      }).join('');

      return `<tr data-row="${i}"${i===_fBulkActiveIdx()?' class="is-active"':''} onmousedown="fBulkSetActive(${i},{semRolar:true})">
        <td style="padding:6px 4px;border-bottom:1px solid var(--gray-light, #F2F2F2);text-align:center;display:flex;align-items:center;justify-content:center;gap:4px">
          <button class="d-btn-sec" style="padding:0;width:22px;height:22px;border-radius:50%;color:var(--text-3,#6B6B6B);background:transparent;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all var(--dur-micro) var(--ease-standard)" onmouseover="this.style.color='var(--dm-orange-d,#F85400)';this.style.background='var(--dm-orange-bg,rgba(255,144,0,.12))'" onmouseout="this.style.color='';this.style.background=''" onclick="fBulkShowCopyModal(${i})" title="Ver legendas geradas"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>
          <button class="d-btn-sec" style="padding:0;width:22px;height:22px;border-radius:50%;color:var(--text-3,#6B6B6B);background:transparent;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all var(--dur-micro) var(--ease-standard)" onmouseover="this.style.color='var(--dm-orange-d,#F85400)';this.style.background='var(--dm-orange-bg,rgba(255,144,0,.12))'" onmouseout="this.style.color='';this.style.background=''" onclick="fBulkCloneRow(${i})" title="Duplicar linha"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
          <button class="d-btn-sec" style="padding:0;width:22px;height:22px;border-radius:50%;color:var(--text-3,#6B6B6B);background:transparent;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all var(--dur-micro) var(--ease-standard)" onmouseover="this.style.color='var(--dm-red,#C81818)';this.style.background='rgba(200,24,24,0.08)'" onmouseout="this.style.color='';this.style.background=''" onclick="fBulkRemoveCard(${i})" title="Remover linha"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </td>
        <td style="padding:6px 4px;border-bottom:1px solid var(--gray-light, #F2F2F2);text-align:center;cursor:help;white-space:nowrap" onmouseenter="fBulkShowHoverPreview(event, ${i})" onmouseleave="fBulkHideHoverPreview()"><span class="f-bulk-num-chip">${i+1}</span>${_fBulkIaChip(r)}</td>
        ${tds}
      </tr>`;
    }).join('');
    
    const optionsHtml = keys.map(k => `<option value="${k}">${gEsc(labelFor(k))}</option>`).join('');
    wrap.innerHTML = `<div class="f-bulk-sheet-block">
      <!-- Mudanças em massa: poderosas, mas jargão de planilha. Ficam FECHADAS — abertas,
           eram a primeira coisa que a franqueada via, antes até da própria tabela. -->
      <details class="f-bulk-massbar">
        <summary>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          <span><strong>Mudar tudo de uma vez</strong><small>o mesmo preço, validade ou logo em todas as linhas</small></span>
          <svg class="f-bulk-disclosure-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
        </summary>
        <div class="f-bulk-massbar-body">
          <div class="f-bulk-massbar-row">
            <label for="f-bulk-action-col">Qual informação</label>
            <select id="f-bulk-action-col">${optionsHtml}</select>
            <input type="text" id="f-bulk-action-val" placeholder="O que escrever em todas">
            <button class="d-btn-pri" onclick="fBulkApplyFill()">Aplicar a todas</button>
          </div>
          <div class="f-bulk-massbar-row">
            <button class="d-btn-sec" onclick="fBulkApplyDiscountPrompt()" title="Baixa um percentual de todos os preços">Dar desconto em tudo</button>
            <button class="d-btn-sec" onclick="fBulkApplyRounding()" title="Deixa todos os preços com final ,90">Arredondar para ,90</button>
            <button class="d-btn-sec" onclick="fBulkApplyValidade()" title="A mesma data de validade em todas as linhas">Mesma validade</button>
            <button class="d-btn-sec" onclick="fBulkApplyLoja()" title="O logo de uma loja salva em todas as linhas">Mesmo logo</button>
          </div>
        </div>
      </details>
      <div class="f-bulk-table-scroll">
        <table class="f-bulk-table" style="width:100%;border-collapse:collapse;margin:0">
          <thead style="position:sticky;top:0;z-index:10">
            <tr>
              <th style="padding:10px 8px;width:30px"></th>
              <th style="padding:10px 8px;width:30px;color:var(--text-2,#3A3A3A)">#</th>
              ${ths}
            </tr>
          </thead>
          <tbody>${trs}</tbody>
        </table>
      </div>
      <!-- "Limpar planilha" NAO mora mais aqui: ficava a 12px de "Adicionar linha" (medido) e a
           Lei de Fitts do ux-principles manda o contrario - acao irreversivel longe da primaria.
           Foi para dentro de "Mais opcoes da planilha", com o resto do ferramental. -->
      <button class="d-btn-sec f-bulk-add-row" onclick="fBulkAddEmptyRow()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Adicionar linha
      </button>
    </div>`;
    // A fita e a prévia grande se refazem junto com a tabela — são a mesma verdade em três
    // tamanhos. (A antiga "vista em cartões" saiu: a coluna da esquerda faz o mesmo trabalho,
    // maior e sem um clique a mais.)
    _fBulkRenderStrip();
    fBulkSetActive(_fBulkActiveIdx(), {semRolar:true});
    return;
  }
}

function fBulkEditRow(i) {
  const infoDiv = document.getElementById('f-bulk-info-'+i);
  if(!infoDiv) return;
  const row = fBulkRows[i];
  
  const formHtml = Object.keys(row.dados).map(k => {
    // verifica se o nome do campo aparece em algum erro
    const isErr = row.erros.find(e => e.includes(k));
    const val = row.dados[k] || '';
    const safeK = gEsc(k);
    const safeV = gEsc(val).replace(/"/g, '&quot;');
    const cfg = typeof fGetFieldType === 'function' ? fGetFieldType(k) : {type:'text'};
    
    if (cfg.type === 'image') {
      const isBase64 = val.startsWith('data:');
      const previewHtml = val ? `<div class="f-bulk-local-prev" style="margin-top:6px;width:100%;height:32px;background:url('${_fCssUrlSafe(val)}') center/contain no-repeat;border:1px solid ${isErr?'var(--dm-red,#C81818)':'var(--gray-mid,#D4D4D4)'};border-radius:var(--r-sm)"></div>` : '';
      return `<div style="margin-bottom:8px">
        <label style="display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-3,#6B6B6B);margin-bottom:3px">${safeK} (Imagem local ou URL)</label>
        <input type="file" id="f-bulk-edit-${i}-${k}-file" accept="image/*" style="width:100%;font-size:11px;color:var(--text-2,#3A3A3A)" onchange="fBulkHandleLocalImage(this, ${i}, '${k}')">
        <input type="hidden" id="f-bulk-edit-${i}-${k}" value="${safeV}">
        ${previewHtml}
      </div>`;
    }

    return `<div style="margin-bottom:8px">
      <label style="display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-3,#6B6B6B);margin-bottom:3px">${safeK}</label>
      <input type="text" id="f-bulk-edit-${i}-${k}" value="${safeV}" style="width:100%;font-size:12px;padding:6px 8px;border:1px solid ${isErr?'var(--dm-red,#C81818)':'var(--gray-mid,#D4D4D4)'};border-radius:var(--r-sm);background:var(--white,#FFFFFF);color:var(--text,#0A0A0A);outline:none">
    </div>`;
  }).join('');
  
  infoDiv.innerHTML = formHtml + `<button class="d-btn-pri" style="width:100%;padding:6px 12px;font-size:12px;font-weight:600;margin-top:6px;border-radius:var(--r-sm)" onclick="fBulkSaveRow(${i})">Salvar</button>`;
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

function fBulkSaveRow(i, isSilent=false, skipReadiness=false) {
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

      /* ⚠ Antes isto escrevia `borderColor` inline e o CSS casava com
         `input[style*="--dm-red"]` — um seletor que depende do TEXTO do atributo style e some
         em silêncio se alguém trocar o `var()` por hex. Agora é classe. */
      if(isSilent) input.classList.toggle('f-bulk-cell-err', !!err);
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
  
  // Preserva a IDENTIDADE ao trocar o objeto: sem isto, salvar uma linha zerava o vínculo com a
  // prévia e a próxima ordenação voltaria a mostrar a arte errada.
  fBulkRows[i] = {dados, erros, _rid: (row && row._rid) || ('r' + (++_fBulkRidSeq))};

  if(!isSilent) {
    fBulkRenderPreview();
  } else if(!skipReadiness) {
    fBulkUpdateReadiness();
  }
}

function fBulkSaveAllRows(isSilent=true) {
  if (!_fBulkTableView) return;
  fBulkRows.forEach((r, i) => {
    fBulkSaveRow(i, isSilent, true);
  });
  fBulkUpdateReadiness();
}

// Renderiza os thumbnails em fila (cede o thread entre cada um). Um token cancela
// loops antigos quando a lista é re-renderizada (ex.: após remover um card).
/* As miniaturas da fita são desenhadas SÓ quando entram em cena.
   Antes o laço percorria o lote inteiro: cada miniatura é um `fRenderTemplateLayers` completo,
   e a fita mostra ~10 por vez. Medido com 120 linhas: 4,2s de trabalho contínuo e ainda assim
   só 91 das 120 pintadas — numa planilha de verdade (o Sheets existe para lotes grandes) isso
   é a máquina do franqueado ocupada desenhando arte que ninguém está olhando, enquanto ele
   tenta digitar ao lado.
   O padrão é o mesmo já usado nas prévias do histórico (`_fHistRenderPreviews`): observa,
   desenha na entrada e para de observar. `rootMargin` adianta o vizinho para a rolagem não
   mostrar buraco. Sem IntersectionObserver, cai no laço antigo — nada fica sem imagem. */
let _fBulkStripObserver = null;
function _fBulkDesenharFitaVisivel(){
  if(_fBulkStripObserver){ _fBulkStripObserver.disconnect(); _fBulkStripObserver = null; }
  const strip = document.getElementById('f-bulk-strip');
  if(!strip) return;
  if(!('IntersectionObserver' in window)) return _fBulkRenderThumbsSeq();
  _fBulkStripObserver = new IntersectionObserver((entradas, obs)=>{
    entradas.forEach(e=>{
      if(!e.isIntersecting) return;
      obs.unobserve(e.target);
      const i = +e.target.dataset.row;
      if(fBulkRows[i]) fBulkRenderCardPreview(fBulkRows[i], i);
    });
  }, { root: strip, rootMargin: '220px' });
  strip.querySelectorAll('.f-bulk-strip-item').forEach(n=>_fBulkStripObserver.observe(n));
}
// Fallback sequencial (navegador sem IntersectionObserver).
async function _fBulkRenderThumbsSeq(){
  const token=++_fBulkRenderToken;
  for(let i=0;i<fBulkRows.length;i++){
    if(token!==_fBulkRenderToken)return; // novo render começou → aborta o antigo
    await fBulkRenderCardPreview(fBulkRows[i], i);
    // requestIdleCallback e setTimeout têm assinaturas DIFERENTES no 2º argumento:
    // {timeout:30} vs 30. Passar o número pros dois fazia o Chrome lançar TypeError
    // ("The provided value is not of type 'IdleRequestOptions'") já na 1ª volta — a
    // promessa rejeitava, o laço morria e só a primeira miniatura era desenhada.
    await new Promise(res=> window.requestIdleCallback
      ? window.requestIdleCallback(res,{timeout:30})
      : setTimeout(res,30));
  }
}
// Nome preservado: é o que o render da fita chama, e prefixo aqui é sagrado.
function fBulkRenderThumbs(){ _fBulkDesenharFitaVisivel(); }
async function fBulkRenderCardPreview(row, index){
  const cv=document.getElementById('f-bulk-cv-'+index);
  const badge=document.getElementById('f-bulk-badge-'+index);
  if(!cv)return;
  try{
    const [w,h]=fMaterialSize(fState.material, fState.fmt);
    // Render no tamanho nativo (sem super-sampling — é thumbnail) e desenha reduzido.
    const off=document.createElement('canvas');off.width=w;off.height=h;
    await fRenderTemplateLayers(off.getContext('2d'), fState.material.layers, w, h, row.dados, fState.camp, null,
      {scope:'franqueado',purpose:'preview'});
    const ctx=cv.getContext('2d');
    ctx.clearRect(0,0,cv.width,cv.height);
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.drawImage(off,0,0,w,h,0,0,cv.width,cv.height);
    if(badge){
      badge.className='f-bulk-badge '+(row.erros.length?'warning':'ok');
      badge.textContent=row.erros.length?(''+(row.erros.length>1?row.erros.length+' campos':'1 campo')):'OK';
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
// (fBulkCloneRow definido mais abaixo — versão única mantida para evitar duplicata)
// Cancelamento cooperativo do lote: o botão seta a flag; o loop de geração checa entre artes
// e para, empacotando no ZIP só o que já ficou pronto (ZIP parcial, não perde o trabalho feito).
let _fBulkCancel = false;
function fBulkCancelGen(){
  _fBulkCancel = true;
  const b = document.getElementById('f-bulk-cancel-btn');
  if(b){ b.disabled = true; b.textContent = 'Cancelando…'; }
}
async function fBulkDownloadAll(){
  if(typeof gFeatureCan==='function' && !gFeatureCan('franqueado.export.zip','execute')){
    if(typeof gFeatureBlockedFeedback==='function') gFeatureBlockedFeedback('franqueado.export.zip');
    return;
  }
  if(!fBulkRows.length){gToast('Envie uma planilha primeiro.');return;}
  if(typeof JSZip === 'undefined'){gToast('Não consegui preparar o pacote. Recarregue a página e tente de novo.','error');return;}

  // Salva e valida todas as linhas da tabela antes do download
  fBulkSaveAllRows(true);
  
  const keys = fBulkVars();
  // O ZIP sai no formato do material aberto — o mesmo que a prévia ao lado mostra o tempo todo.
  // A escolha múltipla de formatos vivia em chips no rodapé e saiu: era repetir uma decisão que
  // o franqueado já tomou ao abrir o material. A estrutura de lista fica porque o laço de
  // geração e as pastas do ZIP são por formato.
  const selectedFmts = [fState.fmt];
  
  // Filtra linhas válidas que não tenham erro e que NÃO estejam completamente vazias
  const valid = fBulkRows.filter(r => {
    if (r.erros.length > 0) return false;
    const isEmpty = keys.every(k => !r.dados[k] || !r.dados[k].trim());
    return !isEmpty;
  });
  if(!valid.length){gToast('Nenhuma linha preenchida ainda.','error');return;}

  // ── Pré-voo: resume o que VAI e o que NÃO vai sair, e confirma antes de gastar tempo.
  // Linhas com erro/vazias são puladas — o franqueado sabe ANTES, não ao abrir o ZIP.
  const _pulados = fBulkRows.filter(r => !valid.includes(r));
  const _nErro = _pulados.filter(r => r.erros && r.erros.length).length;
  const _nVazias = _pulados.length - _nErro;
  const _totalArtes = valid.length * selectedFmts.length;
  let _resumo = `Vou gerar ${valid.length} arte(s)`;
  if (selectedFmts.length > 1) _resumo += ` × ${selectedFmts.length} formatos = ${_totalArtes} imagens`;
  _resumo += '.';
  if (_nErro) _resumo += `\n• ${_nErro} linha(s) com erro serão puladas (vão pro erros.txt).`;
  if (_nVazias) _resumo += `\n• ${_nVazias} linha(s) vazia(s) ignorada(s).`;
  if (_totalArtes > 80) _resumo += `\n\nÉ bastante coisa — pode demorar e pesar no navegador do celular.`;
  if (typeof gConfirm === 'function' && !(await gConfirm(_resumo + '\n\nGerar agora?', {okLabel:`Gerar ${_totalArtes}`}))) return;
  _fBulkCancel = false;
  const _falhas = []; // renders que lançaram (vão pro erros.txt)

  const wrap = document.getElementById('f-bulk-progress-wrap');
  const txt = document.getElementById('f-bulk-progress-text');
  const pct = document.getElementById('f-bulk-progress-pct');
  const bar = document.getElementById('f-bulk-progress-bar');
  const actions = document.getElementById('f-bulk-actions');
  
  if(actions) actions.style.display = 'none';
  if(wrap) wrap.style.display = 'block';
  const cancelBtn = document.getElementById('f-bulk-cancel-btn');
  if(cancelBtn){ cancelBtn.disabled = false; cancelBtn.textContent = 'Cancelar'; }

  let ok=0;
  const zip = new JSZip();
  const c=fState.camp;
  const totalRenders = valid.length * selectedFmts.length;
  let currentRender = 0;
  const usedNames = new Set(); // nomes já usados no ZIP (evita sobrescrita → "só 1 arte")
  
  for(let fi=0; fi<selectedFmts.length; fi++) {
    if(_fBulkCancel) break;
    const fmt = selectedFmts[fi];
    const folderPrefix = selectedFmts.length > 1 ? `${fmt.name}/` : '';
    const oldFmt = fState.fmt;
    fState.fmt = fmt;

    for(let i=0;i<valid.length;i++){
      if(_fBulkCancel){ fState.fmt = oldFmt; break; } // sai limpo, restaurando o formato
      const row=valid[i];
      currentRender++;
      const pctVal = Math.round((currentRender / totalRenders) * 100);
      
      if(txt) txt.textContent = `Arte ${currentRender}/${totalRenders} (${fmt.name})...`;
      if(pct) pct.textContent = `${pctVal}%`;
      if(bar) bar.style.width = `${pctVal}%`;
      
      try{
        const dataUrl=await fRenderMaterialToDataURL(row.dados,c,fmt);
        const b64 = dataUrl.split(',')[1];
        // Naming do lote: pasta por formato (só quando há +de 1) + "NN_Produto.png".
        // O NN (01, 02…) ordena e já garante unicidade; o Set é backstop p/ produtos
        // repetidos. Era a colisão de nomes que fazia o ZIP guardar só 1 arte.
        const seq = String(i+1).padStart(2,'0');
        const prodPart = fSanitizeNamePart(_fRowProductName(row.dados)) || 'Arte';
        const folder = selectedFmts.length>1 ? (fSanitizeNamePart(fmt.name)||fmt.id||'Formato')+'/' : '';
        let entry = folder + seq + '_' + prodPart + '.png';
        if(usedNames.has(entry)){
          const base = entry.replace(/\.png$/i,'');
          let n=2; while(usedNames.has(base+'_'+n+'.png')) n++;
          entry = base+'_'+n+'.png';
        }
        usedNames.add(entry);
        if(b64) zip.file(entry, b64, {base64: true});
        ok++;
      }catch(err){
        console.warn('Bulk linha '+(i+1)+' falhou',err);
        _falhas.push({ prod: _fRowProductName(row.dados) || ('Linha '+(i+1)), motivo: (err&&err.message)||'erro ao renderizar', fmt: fmt.name });
      }

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
  
  const cleanStr = s => (typeof s === 'string' && !s.startsWith('data:') && s.length < 500) ? s : '';

  valid.forEach((row, idx) => {
    const vars = Object.keys(row.dados).filter(v => !/foto|logo|imagem|img|avatar/i.test(v));
    const nameKey = vars.find(v => /produto|titulo|nome/i.test(v)) || vars[0] || '';
    const deKey = vars.find(v => /de|antigo/i.test(v)) || '';
    const porKey = vars.find(v => /por|preco|preço|atual|valor/i.test(v)) || '';
    const valKey = vars.find(v => /validade|data|condicao|condição/i.test(v)) || '';
    const descKey = vars.find(v => /desconto|selo|off/i.test(v)) || '';
    
    const prod = cleanStr(row.dados[nameKey]) || ('Produto ' + (idx + 1));
    const de = deKey ? cleanStr(row.dados[deKey]) : '';
    const por = porKey ? cleanStr(row.dados[porKey]) : '';
    const val = valKey ? cleanStr(row.dados[valKey]) : '';
    const desc = descKey ? cleanStr(row.dados[descKey]) : '';
    
    captionsText += `--------------------------------------------------------\n`;
    captionsText += `ITEM #${idx+1}: ${prod}\n`;
    captionsText += `--------------------------------------------------------\n\n`;
    
    const copys = fBuildCopy(prod, de, por, val, desc, copyFormat);
    
    captionsText += `Opcao 1:\n${copys.op1}\n\n`;
    captionsText += `Opcao 2:\n${copys.op2}\n\n`;
    captionsText += `Opcao 3:\n${copys.op3}\n\n\n`;
  });
  
  zip.file("legendas_posts.txt", captionsText);

  // erros.txt: por que uma arte não saiu (linha pulada por erro/vazia, falha de render ou
  // cancelamento). Sem isso, o franqueado baixava o ZIP e não sabia o que faltou.
  if(_pulados.length || _falhas.length || _fBulkCancel){
    let et = 'RELATORIO DO LOTE — LUMA SHEETS\n========================================\n\n';
    if(_pulados.length){
      et += `LINHAS NAO GERADAS (${_pulados.length}):\n`;
      _pulados.forEach(r=>{
        const p=_fRowProductName(r.dados)||'(sem nome)';
        const motivo=(r.erros&&r.erros.length)?r.erros.join('; '):'linha vazia';
        et += ` - ${p}: ${motivo}\n`;
      });
      et += '\n';
    }
    if(_falhas.length){
      et += `FALHAS AO GERAR (${_falhas.length}):\n`;
      _falhas.forEach(f=>{ et += ` - ${f.prod} (${f.fmt}): ${f.motivo}\n`; });
      et += '\n';
    }
    if(_fBulkCancel) et += 'GERACAO CANCELADA — o ZIP tem so as artes prontas ate o cancelamento.\n';
    zip.file('erros.txt', et);
  }

  try {
    const zipBlob = await zip.generateAsync({type: "blob"});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(zipBlob);
    a.download = `Luma_Artes_${fSanitizeNamePart(fState.material.name)||'Lote'}.zip`;
    a.click();
    if(typeof window.gPlayBatchCompleteSound==='function') window.gPlayBatchCompleteSound();
    setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
  } catch(err) {
    console.error(err);
    gToast('Não consegui montar o pacote. Tente de novo.', 'error');
  }
  
  if(actions) actions.style.display = 'flex';
  if(wrap) wrap.style.display = 'none';
  
  const _fail=totalRenders-ok;
  if(_fBulkCancel) gToast(`Cancelado — ${ok} arte(s) prontas no pacote.`);
  else if(_fail>0) gToast(`${ok}/${totalRenders} geradas — ${_fail} falhou(ram). O arquivo "erros.txt" no pacote diz o que deu errado.`,'error');
  else gToast(ok+' artes geradas e baixadas no pacote!');
  _fBulkCancel = false;
  
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
// Nome cru do produto de uma linha: chaves conhecidas → heurística por nome da variável
// → 1ª coluna preenchida. Vazio se não achar nada. (Sem isso, materiais com variável
// "titulo"/"sabor" caíam todos no nome da campanha e geravam nomes idênticos.)
function _fRowProductName(d){
  if(!d) return '';
  // Ignora chaves internas (ex.: '__fit__var' = enquadramento por-arte, que é objeto).
  const ok = k => k.indexOf('__')!==0 && d[k] && typeof d[k]==='string' && String(d[k]).trim();
  let p = (typeof d.produto==='string'&&d.produto) || d.categoria || d.brinde || d.oferta;
  if(!p){
    const k = Object.keys(d).find(k=>/produto|titulo|título|nome|item|sabor/i.test(k) && ok(k));
    if(k) p = d[k];
    else { const f = Object.keys(d).find(ok); if(f) p = d[f]; }
  }
  return p || '';
}
function fBuildFilename(c, fmt, d){
  const camp = fSanitizeNamePart(c.name) || 'Campanha';
  const prod = fSanitizeNamePart(_fRowProductName(d) || c.name) || 'Arte';
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
    await fRenderTemplateLayers(octx, tmpl.layers, W, H, dados, camp, tmpl,
      {scope:opts.scope||'designer',purpose:'preview'});
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

  gToast(`Coluna "${col}" preenchida em todas as linhas`);
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
    gToast('Percentual inválido — use um número entre 0 e 100.', 'error');
    return;
  }

  fBulkRows.forEach(r => {
    const num = fParsePriceNumber(r.dados[col] || '');
    if (num > 0) {
      r.dados[col] = fFormatPriceNumber(num * (1 - pct / 100));
      _fBulkRevalidateCol(r, col);
    }
  });

  gToast(`Desconto de ${pct}% aplicado à coluna "${col}"`);
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

  gToast(`Valores da coluna "${col}" arredondados para final ,90`);
  fBulkRenderPreview();
}

// Aplica a MESMA validade a todas as linhas. Reusa fValidadeSuggestions (datas reais) como
// sugestão editável e a máscara/validação de campo — irmão de "Aplicar Desconto/Arredondar".
async function fBulkApplyValidade() {
  fBulkCollectCurrentInputs();
  const keys = fBulkVars();
  const col = keys.find(k => /validade|data/i.test(k));
  if (!col) { gToast('Este material não tem campo de validade.', 'warning'); return; }
  const sugg = (typeof fValidadeSuggestions === 'function') ? fValidadeSuggestions() : ['Válido até o fim do mês'];
  const val = await gPrompt(`Validade para todas as linhas:\n(sugestões: ${sugg.join(' · ')})`, sugg[sugg.length-1], {placeholder:'Ex.: Válido até o fim do mês', title:'Aplicar validade'});
  if (val === null) return;
  const masked = (typeof fApplyMask === 'function') ? fApplyMask(col, val) : val;
  fBulkRows.forEach(r => { r.dados[col] = masked; _fBulkRevalidateCol(r, col); });
  gToast(`Validade aplicada em todas as linhas`);
  fBulkRenderPreview();
}

// Preenche o logo de uma loja salva (perfil de loja) em todas as linhas — franqueado que
// monta o cardápio inteiro de um parceiro não reenvia o mesmo logo 20 vezes. Reusa fGetLojas.
async function fBulkApplyLoja() {
  fBulkCollectCurrentInputs();
  const keys = fBulkVars();
  const col = keys.find(k => /logo/i.test(k));
  if (!col) { gToast('Este material não tem campo de logo.', 'warning'); return; }
  const lojas = (typeof fGetLojas === 'function') ? fGetLojas() : [];
  if (!lojas.length) { gToast('Nenhuma loja salva ainda — salve uma no chat ao enviar um logo.', 'warning'); return; }
  let loja = lojas[0];
  if (lojas.length > 1) {
    const nomes = lojas.map((l,i)=>`${i+1}) ${l.nome||'Loja '+(i+1)}`).join('  ');
    const pick = await gPrompt(`Qual loja aplicar?\n${nomes}`, '1', {placeholder:'Número da loja', title:'Logo da loja'});
    if (pick === null) return;
    const idx = parseInt(String(pick).trim(), 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= lojas.length) { gToast('Número inválido.', 'error'); return; }
    loja = lojas[idx];
  }
  if (!loja.logo) { gToast('Essa loja não tem logo salvo.', 'error'); return; }
  fBulkRows.forEach(r => { r.dados[col] = loja.logo; _fBulkRevalidateCol(r, col); });
  gToast(`Logo de ${loja.nome||'sua loja'} aplicado em todas as linhas`);
  fBulkRenderPreview();
}

function fGenerateDemoItems(type) {
  const items = [];
  const randElement = arr => arr[Math.floor(Math.random() * arr.length)];
  const randRange = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const fmtPrice = val => `R$ ${val.toFixed(2).replace('.', ',')}`;

  const validadePool = {
    pizza: ['Válido até domingo', 'Só neste final de semana', 'Terça a quinta-feira', 'Promoção por tempo limitado'],
    sushi: ['Hoje no jantar', 'Válido de terça a quinta', 'Exclusivo no delivery', 'Só hoje'],
    burger: ['Promoção da semana', 'Válido hoje', 'Exclusivo no aplicativo', 'Happy Hour DM'],
    universal: ['Almoço de segunda a sexta', 'Válido hoje', 'Por tempo limitado', 'Exclusivo no app']
  }[type] || ['Por tempo limitado'];

  if (type === 'pizza') {
    const sabores = ['Margherita', 'Calabresa', 'Quatro Queijos', 'Pepperoni', 'Portuguesa', 'Frango com Catupiry', 'Lombo com Cream Cheese', 'Frango com Cheddar', 'Rúcula com Tomate Seco'];
    const adicionais = ['Borda Recheada de Catupiry', 'Borda de Chocolate', 'Coca-Cola 2 Litros', 'Guaraná 2 Litros', 'Batata Rústica Assada', 'Suco Del Valle Uva 1L'];
    const validade = randElement(validadePool);
    
    // Embaralha e pega 3 sabores
    const selectedSabores = sabores.sort(() => 0.5 - Math.random()).slice(0, 3);
    selectedSabores.forEach(s => {
      const precoDeVal = randRange(48, 68);
      const precoPorVal = precoDeVal - randRange(8, 15);
      items.push({
        produto: `Pizza ${s} G`,
        precoDe: fmtPrice(precoDeVal),
        precoPor: fmtPrice(precoPorVal),
        validade: validade,
        categoria: 'Pizzas'
      });
    });
    
    // Pega 2 adicionais
    const selectedAdic = adicionais.sort(() => 0.5 - Math.random()).slice(0, 2);
    selectedAdic.forEach(a => {
      const precoDeVal = randRange(12, 18);
      const precoPorVal = precoDeVal - randRange(3, 5);
      items.push({
        produto: a,
        precoDe: fmtPrice(precoDeVal),
        precoPor: fmtPrice(precoPorVal),
        validade: validade,
        categoria: a.includes('Coca') || a.includes('Guaraná') || a.includes('Suco') ? 'Bebidas' : 'Adicionais'
      });
    });
  } else if (type === 'sushi') {
    const pecas = [
      { name: 'Combo Premium 30 Peças', cat: 'Combos', basePrice: [75, 95] },
      { name: 'Temaki Filadélfia Dobrado', cat: 'Temakis', basePrice: [35, 45] },
      { name: 'Hot Roll 10 unidades', cat: 'Entradas', basePrice: [22, 28] },
      { name: 'Yakisoba Misto Especial', cat: 'Pratos Quentes', basePrice: [38, 48] },
      { name: 'Combinado Chef 40 Peças', cat: 'Combos', basePrice: [89, 110] },
      { name: 'Sunomono Especial', cat: 'Entradas', basePrice: [15, 22] },
      { name: 'Uramaki Salmão 8 un', cat: 'Sushis', basePrice: [22, 28] },
      { name: 'Hossomaki Filadélfia 8 un', cat: 'Sushis', basePrice: [18, 24] }
    ];
    const validade = randElement(validadePool);
    const selected = pecas.sort(() => 0.5 - Math.random()).slice(0, 5);
    
    selected.forEach(p => {
      const precoDeVal = randRange(p.basePrice[0], p.basePrice[1]);
      const precoPorVal = precoDeVal - randRange(5, Math.floor(precoDeVal * 0.25));
      items.push({
        produto: p.name,
        precoDe: fmtPrice(precoDeVal),
        precoPor: fmtPrice(precoPorVal),
        validade: validade,
        categoria: p.cat
      });
    });
  } else if (type === 'burger') {
    const burgers = ['X-Bacon Cheddar Duplo', 'Monster Burger Crispy', 'Smash Burger Clássico', 'Chicken Burger Mayo', 'Veggie Burger Especial', 'Double Smash Cheddar', 'Cheddar Melt Onion'];
    const acompanhamentos = ['Batata Frita Turbinada G', 'Anéis de Cebola Crocantes', 'Nuggets com Molho Barbecue', 'Milkshake de Ovomaltine 400ml', 'Refrigerante Lata', 'Batata Canoa com Cheddar'];
    const validade = randElement(validadePool);

    const selectedBurgers = burgers.sort(() => 0.5 - Math.random()).slice(0, 3);
    selectedBurgers.forEach(b => {
      const precoDeVal = randRange(28, 45);
      const precoPorVal = precoDeVal - randRange(6, 11);
      items.push({
        produto: b,
        precoDe: fmtPrice(precoDeVal),
        precoPor: fmtPrice(precoPorVal),
        validade: validade,
        categoria: 'Lanches'
      });
    });

    const selectedAcomp = acompanhamentos.sort(() => 0.5 - Math.random()).slice(0, 2);
    selectedAcomp.forEach(a => {
      const precoDeVal = randRange(12, 24);
      const precoPorVal = precoDeVal - randRange(3, 6);
      items.push({
        produto: a,
        precoDe: fmtPrice(precoDeVal),
        precoPor: fmtPrice(precoPorVal),
        validade: validade,
        categoria: a.includes('Refrigerante') || a.includes('Milkshake') ? 'Bebidas' : 'Acompanhamentos'
      });
    });
  } else {
    // Universal
    const pratos = [
      { name: 'Prato Feito Executivo', cat: 'Pratos Quentes', basePrice: [24, 30] },
      { name: 'Marmita Econômica M', cat: 'Pratos Quentes', basePrice: [18, 24] },
      { name: 'Salada Caesar com Grelhado', cat: 'Saladas', basePrice: [22, 28] },
      { name: 'Açaí 500ml Turbinado', cat: 'Sobremesas', basePrice: [18, 24] },
      { name: 'Suco de Laranja Natural 500ml', cat: 'Bebidas', basePrice: [8, 12] },
      { name: 'Pudim de Leite Condensado', cat: 'Sobremesas', basePrice: [7, 10] },
      { name: 'Strogonoff de Frango G', cat: 'Pratos Quentes', basePrice: [26, 32] }
    ];
    const validade = randElement(validadePool);
    const selected = pratos.sort(() => 0.5 - Math.random()).slice(0, 5);

    selected.forEach(p => {
      const precoDeVal = randRange(p.basePrice[0], p.basePrice[1]);
      const precoPorVal = precoDeVal - randRange(2, Math.floor(precoDeVal * 0.20));
      items.push({
        produto: p.name,
        precoDe: fmtPrice(precoDeVal),
        precoPor: fmtPrice(precoPorVal),
        validade: validade,
        categoria: p.cat
      });
    });
  }
  return items;
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
    items = fGenerateDemoItems('pizza');
  } else if (lowerUrl.includes('sushi') || lowerUrl.includes('japa') || lowerUrl.includes('japanese')) {
    items = fGenerateDemoItems('sushi');
  } else if (lowerUrl.includes('burger') || lowerUrl.includes('burguer') || lowerUrl.includes('lanche')) {
    items = fGenerateDemoItems('burger');
  } else {
    items = fGenerateDemoItems('universal');
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
  gToast(`${fBulkRows.length} exemplos de demonstração — edite com os seus produtos reais`);

  _fBulkTableView = true;
  fBulkRenderPreview();
  _fBulkGoReview();
}

// Puxa produtos já usados do histórico do franqueado como linhas do lote — zero digitação
// pra quem repete o cardápio. Dedup por nome de produto; APPEND (não apaga o que já está).
function fBulkFromHistorico(){
  if(!fState.material){ gToast('Abra um material primeiro.'); return; }
  let hist=[];
  try{ hist=(typeof fGetHist==='function')?fGetHist():[]; }catch(e){}
  if(!hist.length){ gToast('Você ainda não gerou nenhuma arte.','warning'); return; }
  const keys=fBulkVars();
  const nameKey=keys.find(v=>/produto|titulo|nome/i.test(v))||keys[0];
  // Já considera os produtos que estão na planilha p/ não duplicar ao adicionar.
  fBulkCollectCurrentInputs();
  const seen=new Set(fBulkRows.map(r=>String(r.dados[nameKey]||'').trim().toLowerCase()).filter(Boolean));
  const novos=[];
  hist.forEach(h=>{
    const src=h.dados||{};
    const dados={};
    keys.forEach(k=>{
      let v=src[k];
      if(v==null||v===''){ // fallback pros campos "achatados" do histórico
        if(/produto|titulo|nome/i.test(k)) v=h.prod;
        else if(/^de$|antigo/i.test(k)) v=h.de;
        else if(/por|preco|preço|valor/i.test(k)) v=h.por;
      }
      if(typeof v==='string' && v.startsWith('data:')) v=''; // não traz foto base64 pesada
      dados[k]=v||'';
    });
    const nome=String(dados[nameKey]||'').trim().toLowerCase();
    if(!nome || seen.has(nome)) return;
    seen.add(nome);
    const erros=[];
    keys.forEach(k=>{ const e=(typeof fValidate==='function')?fValidate(k,dados[k]):null; if(e) erros.push(e); });
    novos.push({dados, erros});
  });
  if(!novos.length){ gToast('Nada novo no histórico pra adicionar.','warning'); return; }
  fBulkRows = fBulkRows.concat(novos);
  _fBulkTableView=true;
  const st=document.getElementById('f-bulk-status'); if(st) st.textContent=`${fBulkRows.length} linha(s) carregada(s)`;
  fBulkRenderPreview();
  _fBulkGoReview();
  gToast(`${novos.length} produto(s) do histórico — ajuste preço/validade e gere.`);
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
    filtered.map(e => `<option value="${e.id}">${gEsc(e.name)}</option>`).join('');
}

async function fBulkSaveTemplate() {
  fBulkCollectCurrentInputs();
  if (!fBulkRows || fBulkRows.length === 0) {
    gToast('A planilha está vazia. Adicione algumas linhas antes de salvar.', 'warning');
    return;
  }

  const name = await gPrompt('Nome deste modelo:', '', {placeholder:'Ex.: Ofertas de Quarta-Feira', title:'Salvar modelo'});
  if (name === null) return;
  const trimmed = name.trim();
  if (!trimmed) {
    gToast('Nome inválido.', 'error');
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
    gToast('Não consegui salvar — a memória do navegador encheu. Apague modelos antigos e tente de novo.', 'error');
    return;
  }

  gToast(stripped
    ? `Modelo "${trimmed}" salvo (${stripped} imagem(ns) local(is) não ficam guardadas — reenvie ao gerar)`
    : `Modelo "${trimmed}" salvo!`);
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
    gToast('Não achei esse modelo.', 'error');
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
  gToast(`Modelo "${entry.name}" carregado!`);
  
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

  gToast(`Modelo "${entry.name}" excluído`);
  fBulkUpdateSavedTemplatesList();
}

function fIsImageVar(varName) {
  if (!fState.material || !fState.material.layers) return false;
  // Camadas de imagem/moldura guardam o campo em `imgVar` (não `varName`) — testar varName
  // nunca casava, e uma var de imagem com nome fora do padrão (ex.: "destaque") virava texto.
  const layer = fState.material.layers.find(l => l.imgVar === varName);
  if (layer && (layer.type === 'image' || layer.type === 'frame')) return true;
  if (typeof dVars !== 'undefined' && dVars) {
    const v = dVars.find(x => x.name === varName);
    if (v && v.type === 'image') return true;
  }
  return /foto|imagem|img|logo/i.test(varName);
}

function fBulkUploadCellImage(input, i, k) {
  const file = input.files[0];
  if (!file) return;
  
  if (!file.type.startsWith('image/')) {
    gToast('Esse arquivo não é uma imagem.', 'error');
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    gToast('Imagem muito grande — o limite é 20MB.', 'error');
    return;
  }

  fBulkCollectCurrentInputs();
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const base64 = e.target.result;
    if (typeof fResizeImageIfNeeded === 'function') {
      fResizeImageIfNeeded(base64, 1500, (resizedUrl) => {
        fBulkRows[i].dados[k] = resizedUrl;
        fBulkRows[i].erros = fBulkRows[i].erros.filter(err => !err.includes(k));
        const img = new Image();
        img.onload = function() {
          if (img.width < 600 || img.height < 600) {
            gToast(`Foto de baixa resolução (${img.width}x${img.height}px) — pode sair pixelada na arte.`, 'warning');
          }
          fBulkRenderPreview();
        };
        img.onerror = function() {
          gToast('Não consegui carregar a imagem. Verifique se o arquivo está íntegro e tente de novo.', 'error');
        };
        img.src = resizedUrl;
        gToast('Foto carregada.');
        fBulkRenderPreview();
      });
    } else {
      fBulkRows[i].dados[k] = base64;
      fBulkRows[i].erros = fBulkRows[i].erros.filter(err => !err.includes(k));
      const img = new Image();
      img.onload = function() {
        if (img.width < 600 || img.height < 600) {
          gToast(`Foto de baixa resolução (${img.width}x${img.height}px) — pode sair pixelada na arte.`, 'warning');
        }
        fBulkRenderPreview();
      };
      img.onerror = function() {
        gToast('Não consegui carregar a imagem. Verifique se o arquivo está íntegro e tente de novo.', 'error');
      };
      img.src = base64;
      gToast('Foto carregada.');
      fBulkRenderPreview();
    }
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
    gToast(`${removed} linha(s) duplicada(s) removida(s)`);
    fBulkRenderPreview();
  } else {
    gToast('Nenhuma linha duplicada.', 'info');
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
  
  gToast('Tabela ordenada.');
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
      'Aquele dia que ninguém quer cozinhar.',
      'Fim de expediente, geladeira vazia, zero vontade de sair de casa.',
      'Quando bate a fome e você não quer pensar muito.',
      'Ninguém deveria ter que cozinhar depois de um dia desses.',
      'A preguiça bateu. E tá tudo bem.',
      'Cozinhar hoje? Nem pensar.',
      'Tem dias que o jantar tem que ser fácil.',
      'A fome chegou e a gente resolve.',
      'Sem fila, sem louça pra lavar, sem estresse.',
      'Você pede, a gente cuida do resto.',
      'O jantar de hoje já tem endereço: o seu.',
      'Menos decisão, mais sabor.',
    ],
    pizzas: [
      'Noite de pizza é noite de pizza. Sem discussão.',
      'O combinado de sempre ou um sabor novo pra testar?',
      'A pizza chega quente e o problema do jantar tá resolvido.',
      'Pizza não precisa de motivo. Mas se precisasse, hoje tem.',
      'Massa fresca, borda no ponto, recheio caprichado.',
      'A rodada de pizza que junta todo mundo na mesa.',
    ],
    lanches: [
      'Aquele burger que resolve qualquer dia ruim.',
      'Blend na chapa, queijo derretendo, pão selado. Simples assim.',
      'Lanche bom não precisa de apresentação.',
      'O hambúrguer do jeito que tem que ser.',
      'Vontade de lanche não avisa — mas a gente entrega.',
      'Suculento, no ponto, do primeiro ao último bocado.',
    ],
    japonesa: [
      'Japa hoje? A gente entrega fresco na sua porta.',
      'Hot roll, temaki, combinado — escolhe o teu.',
      'Comida japonesa fresquinha sem sair de casa.',
      'Aquele japa que você merece.',
      'Peça na medida certa pra dividir (ou não).',
      'Frescor de restaurante, conforto de casa.',
    ],
    bebidas: [
      'Pediu a comida e esqueceu da bebida? A gente resolve.',
      'Geladinha, do jeito que tem que ser.',
      'Não tem refeição completa sem uma bebida gelada.',
      'Aquela gelada que combina com tudo.',
      'Pra acompanhar o pedido e refrescar o dia.',
    ],
    sobremesas: [
      'Depois do jantar, aquele doce que faz o dia valer a pena.',
      'A sobremesa é a parte que ninguém pula.',
      'Pra fechar a refeição com chave de ouro.',
      'Sempre tem espaço pra sobremesa.',
      'O docinho que transforma o dia comum.',
    ],
    refeicoes: [
      'Almoço pronto, na sua mesa, sem estresse.',
      'Refeição feita com cuidado, entregue no seu tempo.',
      'O prato do dia chegou. E veio caprichado.',
      'Comida de verdade, do jeito que você gosta.',
      'Do fogão pra sua casa, quentinho.',
      'Aquele almoço que mata a saudade da comida caseira.',
    ],
    porcoes: [
      'Porção pra dividir — ou não, a gente não julga.',
      'A entrada que vira prato principal.',
      'Pra beliscar enquanto o papo rola.',
      'A porção certa pra acompanhar a rodada.',
      'Crocante por fora, do jeito que a mesa pede.',
    ],
    acai: [
      'Açaí no capricho, do jeito que você gosta.',
      'Calor lá fora, açaí gelado aqui dentro.',
      'O açaí de todo dia, sempre do mesmo jeito bom.',
      'Monta do seu jeito, com tudo que você ama.',
      'Energia gelada pra qualquer hora do dia.',
    ],
    saudavel: [
      'Comer bem sem abrir mão do sabor? Dá sim.',
      'Leve, fresco e do jeito que o corpo agradece.',
      'Aquela refeição que cuida de você sem pesar.',
      'Saudável não é sinônimo de sem graça.',
      'Fresco, colorido e cheio de sabor.',
    ],
    cafe: [
      'O dia começa melhor com um café da manhã de verdade.',
      'Pão quentinho, café passado na hora. Dá pra começar melhor?',
      'Aquele lanche da tarde que você merece.',
      'Fresquinho da padaria, direto pra sua mesa.',
      'Pra adoçar a pausa do meio do dia.',
    ],
    mexicana: [
      'Aquele toque picante que anima o dia.',
      'Taco, nachos, guacamole — a festa mexicana chegou.',
      'Sabor intenso, do jeito que o México ensinou.',
      'Pra quem gosta de comer com as mãos e sorrir depois.',
    ],
    massas: [
      'Massa fresca é conforto em forma de prato.',
      'Molho encorpado, massa no ponto certo.',
      'Aquele prato de massa que abraça no fim do dia.',
      'Simples, italiano e reconfortante.',
    ],
    churrasco: [
      'O cheiro de churrasco chegou na sua casa.',
      'Carne no ponto, do jeito que você pediu.',
      'Fim de semana pede churrasco. A gente entrega.',
      'Suculenta, na brasa, sem você acender a churrasqueira.',
    ],
  },

  // ─── CORPO: apresenta produto + preço, concreto e direto ───
  bodies: {
    comDesconto: [
      '{prod} saindo de {de} por {por}.',
      '{prod} — de {de} por {por}. Válido {val}.',
      'Hoje o {prod} tá de {de} por {por}.',
      '{prod} por {por} (era {de}). Válido {val}.',
      'De {de} por {por} — {prod}.',
      '{prod}: antes {de}, agora {por}.',
      '{prod} saindo de {de} por {por}. Você economiza {economiaReais}!',
      '{prod} de {de} por {por} — {economiaPct} de desconto no seu pedido.',
      'Baixou o preço: {prod} de {de} por {por}.',
      'O {prod} tá {por} hoje (de {de}). Aproveita.',
    ],
    semDesconto: [
      '{prod} por {por}.',
      '{prod} — {por}. Simples e bom.',
      'Hoje tem {prod} a {por}.',
      '{prod} saindo a {por}. Válido {val}.',
      '{prod} a {por}. Sem complicação.',
      '{por} no {prod}. Direto ao ponto.',
      '{prod} por {por}, quentinho na sua porta.',
      'É {prod}? É {por}. Pedido feito.',
      'Peça o {prod} por {por} e mate a vontade.',
    ],
    comPercentual: [
      '{prod} com {desconto} de desconto: sai a {por}.',
      '{desconto} OFF no {prod}. Preço final: {por}.',
      '{prod} por {por} — {desconto} a menos que o normal.',
      'Desconto de {desconto} no {prod}. Fica {por}.',
      '{desconto} de desconto no {prod}, só hoje: {por}.',
      'Aproveita: {prod} com {desconto} OFF, agora {por}.',
      // Sem preço final informado — o desconto ainda aparece (antes caía no pool sem preço e sumia)
      '{desconto} OFF no {prod}. Aproveita enquanto dura.',
      '{prod} com {desconto} de desconto. Corre que acaba.',
    ],
    // Sem preço definido: apresenta o produto sem prometer valor (o preço fica no app).
    semPreco: [
      '{prod} fresquinho, esperando por você.',
      'Hoje tem {prod}. Confere o preço no app.',
      '{prod} do jeito que você gosta. Válido {val}.',
      'Bateu a vontade de {prod}? A gente entrega.',
      '{prod} pronto pra sair. É só chamar.',
      'O {prod} de hoje tá te esperando no app.',
    ],
  },

  // ─── CTA: uma ação clara, sem pressão ───
  ctas: {
    delivery: [
      'Peça pelo app.',
      'Abre o app e faz teu pedido.',
      'Chama no delivery.',
      'Faz teu pedido agora.',
      'Peça pelo link na bio.',
      'Manda mensagem e a gente entrega.',
      'Tá no app, é só pedir.',
      'Pediu, chegou. É no app.',
      'Deixa com a gente: peça pelo delivery.',
    ],
    engajamento: [
      'Marca aqui quem sempre pede isso com você.',
      'Salva pra pedir depois.',
      'Manda pra quem tá com fome agora.',
      'Comenta qual é o teu pedido de sempre.',
      'Marca quem precisa ver isso.',
      'Manda pro grupo da galera.',
      'Compartilha com quem ia amar.',
      'Conta aqui: com o que você pede isso?',
    ],
    // CTA de MENSAGEM (WhatsApp/status): pede resposta ali mesmo, não clique em bio.
    whatsapp: [
      'Responde essa mensagem e a gente já anota teu pedido.',
      'Chama a gente aqui e garante o teu.',
      'Manda um "quero" que a gente cuida do resto.',
      'É só responder aqui pra pedir.',
      'Peça pelo app ou responde essa mensagem.',
    ],
  },

  // ─── HASHTAGS por segmento ───
  hashtags: {
    universal: ['#delivery', '#pecaagora', '#comida', '#deliverymuch', '#pediu', '#matoufome'],
    pizzas: ['#pizza', '#noitedepizza', '#pizzadelivery', '#pizzalovers', '#pizzaria'],
    lanches: ['#burger', '#hamburguer', '#lanche', '#smashburger', '#burgerlovers'],
    japonesa: ['#sushi', '#comidajaponesa', '#temaki', '#japa', '#sushilovers'],
    bebidas: ['#bebida', '#drinks', '#gelada', '#refrescante'],
    sobremesas: ['#sobremesa', '#doce', '#sweet', '#doceria'],
    refeicoes: ['#almoco', '#marmita', '#pratofeito', '#refeicao', '#comidacaseira'],
    porcoes: ['#porcao', '#entrada', '#petisco', '#aperitivo'],
    acai: ['#acai', '#acaibowl', '#acailovers', '#gelado'],
    saudavel: ['#saudavel', '#comidasaudavel', '#fit', '#lowcarb', '#eatclean'],
    cafe: ['#cafedamanha', '#padaria', '#cafe', '#brunch', '#lanchedatarde'],
    mexicana: ['#comidamexicana', '#tacos', '#nachos', '#mexican', '#guacamole'],
    massas: ['#massa', '#macarrao', '#pasta', '#comidaitaliana', '#massafresca'],
    churrasco: ['#churrasco', '#carne', '#barbecue', '#espetinho', '#brasa'],
  },
};

/* Mapeia resultado de fBulkAutoCategorize para chave do COPY_BLOCKS */
function _fCopySegment(prod) {
  const low = String(prod || '').toLowerCase();
  // Segmentos que fBulkAutoCategorize não cobre — detecção própria da copy (não mexe no bulk).
  // Precedem o mapa: pra "salada", "taco", "café" etc. saírem de 'universal' pro tom certo.
  if (/açaí|acai|açai/.test(low)) return 'acai';
  if (/salada|fit\b|saud[aá]vel|natural|light|vegano|vegetariano|\bbowl\b|low.?carb|proteico|integral/.test(low)) return 'saudavel';
  if (/caf[eé]|padaria|p[aã]o\b|croissant|brunch|tapioca|misto quente|torrada|cuscuz/.test(low)) return 'cafe';
  if (/taco|burrito|nachos|guacamole|quesadilla|mexican|chili|nacho/.test(low)) return 'mexicana';
  if (/massa|macarr[aã]o|espaguete|nhoque|talharim|fettuccine|penne|ravioli|carbonara/.test(low)) return 'massas';
  if (/churrasco|espetinho|espeto|picanha|costela|parrilla|barbecue|churras|maminha|fraldinha/.test(low)) return 'churrasco';
  const cat = fBulkAutoCategorize(String(prod || ''));
  const map = {
    'Bebidas': 'bebidas', 'Pizzas': 'pizzas', 'Lanches': 'lanches',
    'Comida Japonesa': 'japonesa', 'Sobremesas': 'sobremesas',
    'Refeições': 'refeicoes', 'Porções / Entradas': 'porcoes',
  };
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

/* Monta UMA copy completa. mode: 'promo' | 'engajar' | 'whatsapp' */
function _fAssembleCopy(prod, de, por, val, desc, mode, segment, used, forceShort = false) {
  const B = _COPY_BLOCKS;
  const isWpp = mode === 'whatsapp';

  // Escolher body baseado nos dados disponíveis + economia calculada
  let bodyPool;
  const numDe = fParsePriceNumber(de);
  const numPor = fParsePriceNumber(por);
  const hasPrice = /\d/.test(String(por || ''));   // vazio/sem dígito → sem preço real
  const hasSavings = hasPrice && numDe > 0 && numPor > 0 && numDe > numPor;

  if (desc && /\d+\s*%/.test(desc)) {
    bodyPool = B.bodies.comPercentual;
    // Sem preço final, os templates que citam {por} gerariam "Preço final: ." — só os que não citam.
    if (!hasPrice) bodyPool = bodyPool.filter(tpl => !tpl.includes('{por}'));
    if (!bodyPool.length) bodyPool = B.bodies.semPreco;
  } else if (!hasPrice) {
    bodyPool = B.bodies.semPreco;                  // sem preço → não promete valor (fica no app)
  } else if (de && de !== '—' && de.trim() && numDe > 0) {
    bodyPool = B.bodies.comDesconto;
    if (!hasSavings) {
      bodyPool = bodyPool.filter(tpl => !tpl.includes('{economiaReais}') && !tpl.includes('{economiaPct}'));
    }
  } else {
    bodyPool = B.bodies.semDesconto;
  }
  // Dedup de CORPO entre as 3 opções (cai no pool cheio se esgotar)
  const _availBodies = bodyPool.filter(t => !used.bodies.has(t));
  bodyPool = _availBodies.length ? _availBodies : bodyPool;
  
  // Validade entra no MEIO da frase ("Válido {val}.") → tira um "válido" que o franqueado já
  // digitou (senão saía "Válido válido só hoje") e baixa a 1ª letra quando é palavra
  // ("Esta semana" → "esta semana"; datas/números ficam como estão).
  let formattedVal = _fFormatValidity(val);
  formattedVal = String(formattedVal || '').replace(/^v[áa]lid[oa]\s+/i, '');
  if (formattedVal && /^[A-ZÀ-Ü]/.test(formattedVal)) formattedVal = formattedVal.charAt(0).toLowerCase() + formattedVal.slice(1);
  const diff = numDe - numPor;
  const economiaReais = hasSavings ? fFormatPriceNumber(diff) : '';
  const pct = hasSavings ? Math.round((diff / numDe) * 100) : 0;
  const economiaPct = hasSavings ? (pct + '%') : '';

  // Desconto sem o "off" digitado — os templates já trazem "OFF"/"de desconto"
  // (senão saía "20% off OFF"). Mesma família do "Válido válido".
  const descClean = String(desc || '').trim().replace(/\s*off\.?\s*$/i, '');

  // WhatsApp: *negrito* REAL do app nos valores que vendem (produto, preços, desconto).
  const _b = isWpp ? (s => s ? '*' + s + '*' : s) : (s => s);
  const data = {
    prod: _b(prod),
    de: _b(de),
    por: _b(por),
    val: formattedVal,
    desconto: _b(descClean),
    economiaReais: _b(economiaReais),
    economiaPct: _b(economiaPct)
  };
  
  // Escolher pool de hooks: mistura segmento-específico + universal
  const segHooks = B.hooks[segment] || [];
  const allHooks = segHooks.concat(B.hooks.universal);
  const availHooks = allHooks.filter(h => !used.hooks.has(h));
  const hooksToUse = availHooks.length > 0 ? availHooks : allHooks;

  let hook = '';
  let body = '';
  let bodyTpl = '';

  if (forceShort) {
    // Busca a combinação (hook + body) <= 120 caracteres
    const validPairs = [];
    const allPairs = [];

    for (let h of hooksToUse) {
      for (let bTpl of bodyPool) {
        const bText = _fInterpolate(bTpl, data);
        const totalLen = h.length + 2 + bText.length;
        const pair = { hook: h, tpl: bTpl, body: bText, len: totalLen };
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
    bodyTpl = chosenPair.tpl;
  } else {
    hook = _fPick1(hooksToUse);
    bodyTpl = _fPick1(bodyPool);
    body = _fInterpolate(bodyTpl, data);
  }

  used.hooks.add(hook);
  used.bodies.add(bodyTpl);
  
  // CTA sem repetir entre as opções
  const _pickCta = (type) => {
    const pool = B.ctas[type] || [];
    const avail = pool.filter(c => !used.ctas.has(c));
    const c = _fPick1(avail.length ? avail : pool);
    used.ctas.add(c);
    return c;
  };

  // Validade como linha separada (evita duplicar se já estiver no corpo)
  const valLine = (formattedVal && !body.includes(formattedVal)) ? ('Válido ' + formattedVal + '.') : '';

  // WHATSAPP: mensagem, não legenda — sem hashtags (ruído no app), CTA de resposta direta.
  // Diagramação de mensagem: gancho / corpo (+validade) / CTA, blocos separados por linha vazia.
  if (isWpp) {
    const wLines = [hook, '', body];
    if (valLine) wLines.push(valLine);
    wLines.push('', _pickCta('whatsapp'));
    return wLines.join('\n');
  }

  // FEED: CTA coerente com a aba — "Promo" vende (pedido), "Engajar" conversa (marca/salva/comenta).
  const cta = _pickCta(mode === 'engajar' ? 'engajamento' : 'delivery');
  
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
function fBuildCopy(prod, de, por, val, desc, format, ctxName) {
  // Segmento considera também o nome da campanha (ctx): "Combo 20 peças" sozinho é universal,
  // mas dentro de "Bora De Sushi Na Promo" é japonesa — tom certo com mais frequência.
  const segment = _fCopySegment(String(prod||'') + ' ' + String(ctxName||''));
  // Dedup COMPARTILHADO entre as 3 opções: gancho, corpo e CTA não repetem → 3 legendas distintas.
  const used = { hooks: new Set(), bodies: new Set(), ctas: new Set() };
  // Cada aba tem PROPÓSITO e formato próprios (antes as 3 eram iguais e o CTA era sorteado —
  // a aba "Engajar" podia sair com CTA de delivery):
  //   promo    → legenda de feed vendedora, par gancho+corpo curto, CTA de pedido, hashtags
  //   engajar  → legenda de feed com CTA de engajamento garantido (marca/comenta/salva), hashtags
  //   whatsapp → MENSAGEM: *negrito* real do WhatsApp, sem hashtags, CTA de resposta direta
  return {
    op1: _fAssembleCopy(prod, de, por, val, desc, 'promo', segment, used, true),
    op2: _fAssembleCopy(prod, de, por, val, desc, 'engajar', segment, used, false),
    op3: _fAssembleCopy(prod, de, por, val, desc, 'whatsapp', segment, used, false),
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
    
    await fRenderTemplateLayers(off.getContext('2d'), fState.material.layers, w, h, row.dados, fState.camp, null,
      {scope:'franqueado',purpose:'preview'});
    
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
  gToast('Linha duplicada.');
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
          gToast('Não consegui copiar a legenda — selecione e copie na mão.', 'error');
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
