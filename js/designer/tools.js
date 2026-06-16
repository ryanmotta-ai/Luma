/**
 * js/designer/tools.js
 *
 * Ferramentas do designer: eyedropper, auto-fit de texto, bucket fill,
 * dStartInlineEdit, dEndInlineEdit, dHexSync, dHexInput, dToggleLock.
 * Depende de: designer/canvas.js, designer/layers.js
 */

// (Eyedropper "de painel" removido — era código morto: dStartEyedrop nunca era
//  chamado e dEyedropActive nunca virava true. O conta-gotas da toolbar — tecla I,
//  dEyedropFromLayer / dTool==='eyedrop' — continua funcionando normalmente.)

/* ══ AUTO-FIT DE TEXTO ══ */
function dMeasureText(text, font, fontSize, maxWidth){
  // Cria canvas escondido para medir
  if(!dMeasureCanvas){
    dMeasureCanvas=document.createElement('canvas');
    dMeasureCtx=dMeasureCanvas.getContext('2d');
  }
  const _fp=(typeof dTextFontParts==='function')?dTextFontParts(font):{family:"'Roboto', sans-serif",weight:900};
  dMeasureCtx.font = `${_fp.weight} ${fontSize}px ${_fp.family}`;
  const lines = (text||'').split('\n');
  let maxW = 0;
  lines.forEach(line=>{
    // Quebrar em palavras se passar do maxWidth
    const words = line.split(' ');
    let cur = '';
    let visual = [];
    words.forEach(w=>{
      const test = cur ? cur+' '+w : w;
      if(dMeasureCtx.measureText(test).width > maxWidth && cur){
        visual.push(cur);cur = w;
      }else{
        cur = test;
      }
    });
    if(cur)visual.push(cur);
    visual.forEach(v=>{
      const lw = dMeasureCtx.measureText(v).width;
      if(lw>maxW)maxW=lw;
    });
    if(!visual.length)visual=[''];
    return visual;
  });
  // calcular altura total
  const lineHeight = fontSize * 1.2;
  let totalLines = 0;
  lines.forEach(line=>{
    const words = line.split(' ');
    let cur = '';
    let count = 0;
    words.forEach(w=>{
      const test = cur ? cur+' '+w : w;
      if(dMeasureCtx.measureText(test).width > maxWidth && cur){
        count++;cur = w;
      }else{
        cur = test;
      }
    });
    if(cur)count++;
    totalLines += Math.max(1,count);
  });
  return { width: maxW, height: totalLines * lineHeight, lines: totalLines };
}
let dMeasureCanvas=null, dMeasureCtx=null;

function dCheckTextOverflow(layer){
  if(layer.type!=='text')return false;
  const m = dMeasureText(layer.content||'', layer.font||"'Roboto Black'", layer.fontSize||24, layer.w);
  return m.height > layer.h + 2; // tolerância
}

function dAutoFitText(layerId){
  const l = dLayers.find(x=>x.id===layerId);
  if(!l||l.type!=='text'){gToast('Só funciona em layers de texto');return;}
  // Encolher fontSize até caber
  const originalSize = l.fontSize||24;
  let size = originalSize;
  const min = 8;
  while(size > min){
    const m = dMeasureText(l.content||'', l.font||"'Roboto Black'", size, l.w);
    if(m.height <= l.h)break;
    size--;
  }
  if(size === originalSize){
    // Tentar aumentar até quase encostar
    while(size < 200){
      const m = dMeasureText(l.content||'', l.font||"'Roboto Black'", size+1, l.w);
      if(m.height > l.h)break;
      size++;
    }
  }
  if(size !== originalSize){
    dHistoryPush();
    l.fontSize = size;
    dRenderCanvas();dMarkUnsaved();dUpdateCtxBar();
    gToast(`✓ Auto-fit: ${originalSize}px → ${size}px`);
  }else{
    gToast('Texto já está ajustado');
  }
}


/* ══ EYEDROPPER COMO FERRAMENTA (tool=eyedrop, atalho I) ══ */
function dEyedropFromLayer(sourceLayer){
  let color=null;
  if(sourceLayer.type==='text')color=sourceLayer.color;
  else if(sourceLayer.type==='shape')color=sourceLayer.fill;
  else if(sourceLayer.type==='frame'){
    gToast('⚠ Eyedrop não funciona em moldura — escolha texto ou shape');
    return;
  }
  if(!color){gToast('⚠ Layer sem cor');return;}
  // Atualiza a cor do PINCEL e exibe num seletor
  dEyedropLastColor = color;
  // Atualizar swatch do pincel
  const sw=document.getElementById('d-brush-color-sw');
  const pk=document.getElementById('d-brush-color-pick');
  if(sw)sw.style.background=color;
  if(pk)pk.value=color;
  // Se há layer selecionado de texto/shape, aplicar nele
  if(dSelId&&dSelId!==sourceLayer.id){
    const target=dLayers.find(x=>x.id===dSelId);
    if(target&&(target.type==='text'||target.type==='shape')){
      dHistoryPush();
      if(target.type==='text')target.color=color;
      else if(target.type==='shape')target.fill=color;
      dRenderCanvas();dMarkUnsaved();dUpdateCtxBar();
      gToast('🎯 Cor aplicada: '+color+' → '+target.name);
      return;
    }
  }
  gToast('🎯 Cor coletada: '+color+' (selecione um layer e clique aqui para aplicar)');
}
let dEyedropLastColor='#FF9000';


/* ══ BUCKET FILL ══ */
function dBucketFillLayer(targetLayer){
  if(targetLayer.locked){gToast('🔒 Layer bloqueado');return;}
  const color = dEyedropLastColor || document.getElementById('d-brush-color-pick').value || '#FF9000';
  dHistoryPush();
  if(targetLayer.type==='text')targetLayer.color=color;
  else if(targetLayer.type==='shape')targetLayer.fill=color;
  else{gToast('⚠ Bucket só funciona em texto e shape');return;}
  dRenderCanvas();dMarkUnsaved();dUpdateCtxBar();
  gToast('🪣 Preenchido com '+color);
}

