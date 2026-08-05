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
// lhFactor: multiplicador de line-height (default 1.2). Passe l.lineHeight (leading do PSD)
// para a altura medida bater com o que o render realmente usa.
// letterSpacing: tracking em px (l.letterSpacing). Sem ele a medida ficava mais estreita que
// o render, e a caixa modular (dTextFitBox) cortava a última letra de texto com tracking.
function dMeasureText(text, font, fontSize, maxWidth, lhFactor, letterSpacing){
  // Cria canvas escondido para medir
  if(!dMeasureCanvas){
    dMeasureCanvas=document.createElement('canvas');
    dMeasureCtx=dMeasureCanvas.getContext('2d');
  }
  const _fp=(typeof dTextFontParts==='function')?dTextFontParts(font):{family:"'Roboto', sans-serif",weight:900};
  dMeasureCtx.font = `${_fp.weight} ${fontSize}px ${_fp.family}`;
  // Sempre atribuir (mesmo 0px): o ctx é reaproveitado entre chamadas e o tracking de uma
  // medida vazaria para a próxima (overflow/auto-fit mediriam largura errada).
  if('letterSpacing' in dMeasureCtx) dMeasureCtx.letterSpacing = (letterSpacing||0)+'px';
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
    // (este loop calcula maxW; a contagem de linhas é feita no loop abaixo)
  });
  // calcular altura total
  const lineHeight = fontSize * (lhFactor || 1.2);
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

// Métricas de glifo da fonte (substituída) no tamanho dado, via canvas measureText.
// { inkAscent, inkDescent, fontAscent, fontDescent } em px, ou null se indisponível.
// Usado para alinhar o TOPO DA TINTA ao topo da caixa (baseline 1:1 do PSD).
function dTextGlyphMetrics(font, fontSize, sample){
  try{
    if(!dMeasureCanvas){ dMeasureCanvas=document.createElement('canvas'); dMeasureCtx=dMeasureCanvas.getContext('2d'); }
    const fp=(typeof dTextFontParts==='function')?dTextFontParts(font):{family:"'Roboto', sans-serif",weight:900};
    dMeasureCtx.font=`${fp.weight} ${fontSize}px ${fp.family}`;
    const m=dMeasureCtx.measureText(sample||'Hg');
    const ia=m.actualBoundingBoxAscent, id=m.actualBoundingBoxDescent;
    if(ia==null||!isFinite(ia)) return null;
    return {
      inkAscent:ia, inkDescent:(id!=null?id:0),
      fontAscent:(m.fontBoundingBoxAscent!=null?m.fontBoundingBoxAscent:ia),
      fontDescent:(m.fontBoundingBoxDescent!=null?m.fontBoundingBoxDescent:(id||0))
    };
  }catch(e){ return null; }
}
// Deslocamento (px) do topo da line-box CSS até o TOPO DA TINTA, dado line-height. Ao subtrair
// esse gap, o topo dos glifos encosta no topo da caixa (== node.top do PSD). 0 se indisponível.
function dTextInkTopGap(font, fontSize, lineHeightFactor, sample){
  const gm=dTextGlyphMetrics(font, fontSize, sample); if(!gm) return 0;
  const lh=(lineHeightFactor||1.2)*fontSize;
  const halfLeading=(lh-(gm.fontAscent+gm.fontDescent))/2;
  return halfLeading + (gm.fontAscent-gm.inkAscent);
}

/* ══ CAIXA MODULAR DE TEXTO (comportamento do Photoshop) ══
   No Photoshop, texto de PONTO não tem caixa própria: o retângulo que aparece É o extent
   dos glifos e acompanha o que se digita. Aqui a caixa era um w/h solto que ninguém
   atualizava depois — daí três sintomas que pareciam bugs diferentes e eram o mesmo:
   a seleção ficava descolada do texto, o clique pegava área vazia (roubando o clique das
   camadas de baixo) e arrastar a alça não mudava nada na tela.
   ⛔ Texto de PARÁGRAFO (textBox==='box') NÃO entra aqui: caixa fixa é o contrato dele —
   o conteúdo quebra dentro dela e o selo de overflow avisa quando estoura (igual ao
   Photoshop, onde só a alça muda a caixa de parágrafo). */

// Texto COMO APARECE no canvas: {{campo}} vira o valor da simulação (quando ligada) ou o
// valor de exemplo do campo, e textTransform é aplicado. Medir o token cru daria uma caixa
// que não bate com o que se vê na tela.
// opts.raw: NÃO expande {{campo}} — é o caso da edição inline, onde o usuário vê e digita
// o token cru; ali expandir daria uma largura de caixa que não bate com o que está na tela.
function dTextDisplayString(l, opts){
  let s=l.content||'';
  if(opts && opts.raw){ /* mantém os tokens como estão */ }
  else if(typeof dSimActive!=='undefined' && dSimActive && typeof dInterpolate==='function'){
    s=dInterpolate(s);
  }else if(typeof gVarRegex==='function'){
    s=s.replace(gVarRegex(),(m,n)=>{
      const v=(typeof dVars!=='undefined')&&dVars.find(x=>x.name===n);
      return (typeof gFieldSampleValue==='function')?gFieldSampleValue(v||{name:n}):((v&&(v.label||n))||n);
    });
  }
  const tt=l.textTransform;
  if(tt==='uppercase') s=s.toUpperCase();
  else if(tt==='lowercase') s=s.toLowerCase();
  else if(tt==='capitalize') s=s.replace(/(^|\s)(\S)/g,(m,a,b)=>a+b.toUpperCase());
  return s;
}

// Re-mede a caixa do texto de ponto e RE-ANCORA. Retorna true se mudou algo.
// A re-ancoragem é obrigatória: o render (e o png-generator) posicionam o texto DENTRO da
// caixa via textAlign/vAlign — encolher w/h sem compensar x/y arrastaria o texto
// centralizado/à direita para outro lugar.
function dTextFitBox(l){
  if(!l || l.type!=='text') return false;
  if(l.textBox==='box') return false;        // parágrafo: caixa é fixa por definição
  if(l.vertical) return false;               // writing-mode vertical inverte w/h — fora do escopo
  if(l.runs && l.runs.length) return false;  // rich text (tamanho por trecho): a medida base mentiria
  const fs=l.fontSize||24, lh=l.lineHeight||1.2;
  // Infinity: point text não quebra por largura (render usa white-space:'pre') — mede a linha inteira.
  const m=dMeasureText(dTextDisplayString(l), l.font||"'Roboto Black'", fs, Infinity, lh, l.letterSpacing);
  const nw=Math.max(24, Math.ceil(m.width));   // 24px de piso: texto vazio não vira sliver inclicável
  const nh=Math.max(Math.ceil(fs*lh), Math.ceil(m.height));
  if(nw===l.w && nh===l.h) return false;
  const al=l.textAlign||'left';
  if(al==='center') l.x=Math.round(l.x+(l.w-nw)/2);
  else if(al==='right') l.x=Math.round(l.x+(l.w-nw));
  if(l.vAlign!=='top') l.y=Math.round(l.y+(l.h-nh)/2); // 'top' ancora pelo topo: y não muda
  l.w=nw; l.h=nh;
  return true;
}

function dCheckTextOverflow(layer){
  if(layer.type!=='text')return false;
  // Point text (sem caixa) NUNCA transborda — no Photoshop cresce sozinho a partir de uma âncora.
  // Só texto de PARÁGRAFO (textBox==='box') tem caixa fixa que o conteúdo pode estourar.
  if(layer.textBox!=='box') return false;
  const fs=layer.fontSize||24, lh=layer.lineHeight||1.2;
  const m = dMeasureText(layer.content||'', layer.font||"'Roboto Black'", fs, layer.w, lh);
  // Comparação por LINHAS, não por pixel: o bbox de glifos do PSD é justo (~1× fontSize),
  // mas a line-box CSS é ~1.2×. Comparar pixel marcava overflow em quase tudo (falso positivo).
  // Aqui: transborda só se o texto precisa de MAIS linhas do que a caixa comporta.
  const available = Math.max(1, Math.round(layer.h / (fs * lh)));
  return m.lines > available;
}

function dAutoFitText(layerId){
  const l = dLayers.find(x=>x.id===layerId);
  if(!l||l.type!=='text'){gToast('Só funciona em camadas de texto');return;}
  // Encolher fontSize até caber
  const originalSize = l.fontSize||24;
  let size = originalSize;
  const min = 8;
  const _lh = l.lineHeight||1.2; // mesmo leading do render/overflow — sem ele o fit convergia errado
  while(size > min){
    const m = dMeasureText(l.content||'', l.font||"'Roboto Black'", size, l.w, _lh);
    if(m.height <= l.h)break;
    size--;
  }
  if(size === originalSize){
    // Tentar aumentar até quase encostar
    while(size < 200){
      const m = dMeasureText(l.content||'', l.font||"'Roboto Black'", size+1, l.w, _lh);
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
// Aplica a cor coletada: swatch do pincel + camada selecionada (se texto/forma).
// sourceId evita "aplicar" a cor da própria camada de origem em cima dela mesma.
function _dEyedropApply(color, sourceId){
  dEyedropLastColor = color;
  const sw=document.getElementById('d-brush-color-sw');
  const pk=document.getElementById('d-brush-color-pick');
  if(sw)sw.style.background=color;
  if(pk)pk.value=color;
  if(dSelId&&dSelId!==sourceId){
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

// Leitura direta (exata) da cor declarada — caminho de texto/forma e fallback.
function dEyedropFromLayer(sourceLayer){
  let color=null;
  if(sourceLayer.type==='text')color=sourceLayer.color;
  else if(sourceLayer.type==='shape')color=sourceLayer.fill;
  else{
    gToast('Não deu para ler a cor deste ponto');
    return;
  }
  if(!color){gToast('⚠ Camada sem cor');return;}
  _dEyedropApply(color, sourceLayer.id);
}

// Amostra o PIXEL composto (imagens, molduras, pintura do pincel) via dEyedropPixel.
// fallbackLayer: leitura direta se o pixel falhar (fora do canvas, transparente, CORS).
async function dEyedropAt(x, y, fallbackLayer){
  let px=null;
  try{ px=await dEyedropPixel(x, y); }catch(e){ px=null; }
  if(px&&px.a>0){ _dEyedropApply(_dRgbaToHex(px.r, px.g, px.b), fallbackLayer&&fallbackLayer.id); return; }
  if(fallbackLayer){ dEyedropFromLayer(fallbackLayer); return; }
  gToast('Nada para amostrar aqui');
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
  // Cor ATUAL do seletor primeiro — dEyedropLastColor é sempre truthy (nasce laranja),
  // então na ordem antiga a cor escolhida no picker nunca era usada pelo balde.
  const color = (_pk && _pk.value) || dEyedropLastColor || '#FF9000';
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
