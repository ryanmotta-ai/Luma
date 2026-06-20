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
  if(!l||l.type!=='text'){gToast('Só funciona em camadas de texto');return;}
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
    gToast('O conta-gotas funciona em texto e forma');
    return;
  }
  if(!color){gToast('⚠ Camada sem cor');return;}
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
      gToast('Cor aplicada: '+color+' → '+target.name);
      return;
    }
  }
  gToast('Cor coletada: '+color+' (selecione uma camada e clique aqui)');
}
let dEyedropLastColor='#FF9000';


/* ══ CORES GLOBAIS (Foreground / Background) ══ */
let dColorFG = '#FF9000';
let dColorBG = '#FFFFFF';

function dUpdateBgColor(hex) {
  dColorBG = hex;
  const bgSw = document.getElementById('dtool-color-bg');
  if (bgSw) bgSw.style.backgroundColor = hex;
}

function dSwapColors() {
  const fgPick = document.getElementById('d-color-fg-pick');
  const bgPick = document.getElementById('d-color-bg-pick');
  if(!fgPick || !bgPick) return;
  
  const tempFG = fgPick.value;
  const tempBG = bgPick.value;
  
  // Atualiza input e dispara dBrushUpdate para atualizar todo o sistema do Brush
  fgPick.value = tempBG;
  if(typeof dBrushUpdate === 'function') dBrushUpdate('color', tempBG);
  
  // Atualiza BG
  bgPick.value = tempFG;
  dUpdateBgColor(tempFG);
}

function dResetColors() {
  const fgPick = document.getElementById('d-color-fg-pick');
  const bgPick = document.getElementById('d-color-bg-pick');
  
  if(fgPick) {
    fgPick.value = '#FF9000'; // Default Luma Primary
    if(typeof dBrushUpdate === 'function') dBrushUpdate('color', '#FF9000');
  }
  if(bgPick) {
    bgPick.value = '#FFFFFF'; // Default BG
    dUpdateBgColor('#FFFFFF');
  }
}

/* ══ BUCKET FILL ══ */
// Balde: preenche a COR do objeto clicado (texto/shape) — não é flood fill de pixels.
function dBucketFillLayer(targetLayer){
  if(targetLayer.locked){gToast('🔒 Camada bloqueada');return;}
  const _pk=document.getElementById('d-brush-color-pick'); // guard: pode não existir
  const color = dEyedropLastColor || (_pk && _pk.value) || '#FF9000';
  if(targetLayer.type!=='text' && targetLayer.type!=='shape'){ gToast('⚠ Balde preenche a cor de texto/forma — clique num desses'); return; }
  dHistoryPush();
  if(targetLayer.type==='text')targetLayer.color=color;
  else targetLayer.fill=color;
  dRenderCanvas();dMarkUnsaved();dUpdateCtxBar();
  gToast('🪣 Cor preenchida: '+color);
}

/* ══ TOOLBAR COLUMNS (Photoshop style) ══ */
function dToggleToolbarCols() {
  const tb = document.getElementById('d-vtoolbar');
  if(!tb) return;
  if(tb.classList.contains('cols-2')) {
    tb.classList.remove('cols-2');
    tb.classList.add('cols-1');
    localStorage.setItem('luma_tb_cols', '1');
  } else {
    tb.classList.remove('cols-1');
    tb.classList.add('cols-2');
    localStorage.setItem('luma_tb_cols', '2');
  }
}

function dToggleAllTools(forceState) {
  const panel = document.getElementById('d-all-tools-panel');
  if(!panel) return;
  if(typeof forceState === 'boolean') {
    if(forceState) panel.classList.add('open');
    else panel.classList.remove('open');
  } else {
    panel.classList.toggle('open');
  }
}

// Fechar All Tools ao clicar fora
document.addEventListener('mousedown', (e) => {
  const panel = document.getElementById('d-all-tools-panel');
  const btn = document.getElementById('dtool-all-tools');
  if(panel && panel.classList.contains('open')) {
    if(!panel.contains(e.target) && (!btn || !btn.contains(e.target))) {
      panel.classList.remove('open');
    }
  }
});

// Auto-detectar e aplicar ao iniciar (telas baixinhas usam 2 colunas para caber, telas altas podem usar 1.
// Ou apenas respeita a preferência do usuário).
document.addEventListener('DOMContentLoaded', () => {
  const tb = document.getElementById('d-vtoolbar');
  if(tb) {
    const pref = localStorage.getItem('luma_tb_cols');
    if(pref === '1') {
      tb.classList.remove('cols-2');
      tb.classList.add('cols-1');
    } else if (pref === '2') {
      tb.classList.remove('cols-1');
      tb.classList.add('cols-2');
    } else {
      // Default: se a tela for menor que 800px, 2 colunas para poupar altura. Se for grande, também 2 colunas porque o usuário gostou.
      tb.classList.add('cols-2');
    }
  }
});
