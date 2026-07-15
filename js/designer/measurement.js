/**
 * js/designer/measurement.js
 *
 * Ferramentas de medição e amostragem do designer Luma, inspiradas no Photoshop.
 * 1. Pixel Eyedropper — amostra cor real do pixel renderizado
 * 2. Color Sampler    — pinos de amostragem de cor (até 4)
 * 3. Ruler            — régua de medição (distância, ângulo, ΔX/ΔY)
 * 4. Note             — anotações não-impressas no canvas
 * 5. Count            — marcadores numerados sequenciais
 *
 * Depende de: designer/canvas.js, designer/layers.js, designer/tools.js,
 *             designer/templates.js (DFMT_SIZES, dGetActiveAB), core/toast.js (gToast).
 */


/* ══════════════════════════════════════════════════════════════════════════════
   UTILITÁRIOS INTERNOS
   ══════════════════════════════════════════════════════════════════════════════ */

// Obtém tamanho do canvas (artboard ativo ou formato padrão)
function _dMeasureCanvasSize(){
  const ab=(typeof dGetActiveAB==='function')&&dGetActiveAB();
  return ab?{w:ab.w,h:ab.h}:(DFMT_SIZES[dFmt]||{w:1080,h:1920});
}

// Converte coordenadas de tela (relativas ao frame) para coordenadas do canvas, compensando zoom
function _dScreenToCanvas(screenX, screenY, frame){
  const rect=frame.getBoundingClientRect();
  // Escala REAL do DOM (mesma razão do dCanvasPos do pincel): durante os ~220ms da
  // transição de zoom, dZoomLevel já é o valor final mas o frame ainda está numa escala
  // intermediária — pinos/notas/régua caíam deslocados do cursor logo após o zoom.
  const scale=(rect.width&&frame.offsetWidth)?(rect.width/frame.offsetWidth):((typeof dZoomLevel!=='undefined'?dZoomLevel:100)/100);
  return {
    x:Math.round((screenX-rect.left)/scale),
    y:Math.round((screenY-rect.top)/scale)
  };
}

// Gera ID único simples para notas e marcadores
function _dMeasureId(){
  return 'm-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);
}


/* ══════════════════════════════════════════════════════════════════════════════
   FERRAMENTA 1: PIXEL EYEDROPPER
   Renderiza todas as camadas visíveis num canvas offscreen e amostra o pixel.
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * Renderiza todas as camadas visíveis num canvas offscreen e retorna o pixel RGBA em (x,y).
 * Diferente do dEyedropFromLayer (que lê l.color/l.fill), este lê pixels reais compostos.
 * @param {number} x — coordenada X no espaço do canvas (sem zoom)
 * @param {number} y — coordenada Y no espaço do canvas (sem zoom)
 * @returns {{r:number, g:number, b:number, a:number}|null}
 */
async function dEyedropPixel(x, y){
  var sz=_dMeasureCanvasSize();
  // Clampar coordenadas dentro dos limites do canvas
  if(x<0||y<0||x>=sz.w||y>=sz.h) return null;

  var offscreen=document.createElement('canvas');
  offscreen.width=sz.w;
  offscreen.height=sz.h;
  var ctx=offscreen.getContext('2d');

  var promises = [];
  var layers=(typeof dLayers!=='undefined')?dLayers:[];
  layers.filter(function(l){return l.visible&&l.type!=='group';}).forEach(function(l){
    if(l.type==='image'||l.type==='frame'){
      if(l._imgCache&&l._imgCache.complete){
        // ok — imagem pronta no cache
      }else if(l._imgCache){
        // cache existe mas AINDA está carregando → espera (antes caía num limbo:
        // nem promise nem cache pronto, e o 1º clique lia a cor sem a imagem)
        var pend=l._imgCache;
        promises.push(new Promise(function(res){
          pend.addEventListener('load',function(){res();},{once:true});
          pend.addEventListener('error',function(){res();},{once:true});
          if(pend.complete) res();
        }));
      }else if(l.imgUrl){
        var img=new Image();
        img.crossOrigin = 'anonymous';
        l._imgCache=img; // grava JÁ — o onload sozinho perdia a corrida com img.complete
        promises.push(new Promise(function(res){
          img.onload = function(){ res(); };
          img.onerror = function(){ res(); };
          img.src=l.imgUrl; // src DEPOIS dos handlers (cache síncrono dispara onload imediato)
          if (img.complete) res();
        }));
      }
    }
  });

  await Promise.all(promises);

  layers.filter(function(l){return l.visible&&l.type!=='group';}).forEach(function(l){
    ctx.save();
    ctx.globalAlpha=(l.opacity||100)/100;

    if(l.type==='shape'){
      // Shapes: retângulo preenchido (ou elipse)
      var kind=l.shapeKind||'rect';
      ctx.fillStyle=l.fill||'#FF9000';
      if(kind==='circle'||kind==='ellipse'){
        ctx.beginPath();
        ctx.ellipse(l.x+l.w/2, l.y+l.h/2, l.w/2, l.h/2, 0, 0, Math.PI*2);
        ctx.fill();
      }else{
        var r=l.radius||0;
        if(r>0){
          _dFillRoundRect(ctx, l.x, l.y, l.w, l.h, r);
        }else{
          ctx.fillRect(l.x, l.y, l.w, l.h);
        }
      }
    }else if(l.type==='text'){
      // Texto
      var _fp=(typeof dTextFontParts==='function')?dTextFontParts(l.font):{family:"'Roboto', sans-serif",weight:900};
      var fontSize=l.fontSize||24;
      ctx.font=_fp.weight+' '+fontSize+'px '+_fp.family;
      ctx.fillStyle=l.color||'#fff';
      ctx.textAlign=l.textAlign||'left';
      ctx.textBaseline='top';
      var lines=(l.content||'').split('\n');
      var lineH=fontSize*1.2;
      var textX=l.x;
      if(l.textAlign==='center') textX=l.x+l.w/2;
      else if(l.textAlign==='right') textX=l.x+l.w;
      lines.forEach(function(line, i){
        ctx.fillText(line, textX, l.y+i*lineH);
      });
    }else if(l.type==='image'||l.type==='frame'){
      if(l._imgCache&&l._imgCache.complete){
        ctx.drawImage(l._imgCache, l.x, l.y, l.w, l.h);
      }
    }
    ctx.restore();
  });

  // A pintura do pincel vive num overlay ACIMA das camadas — compõe por último,
  // senão o conta-gotas ignora os traços pintados.
  var paintCv=document.getElementById('d-paint-canvas');
  if(paintCv&&paintCv.width){ try{ ctx.drawImage(paintCv,0,0); }catch(e){} }

  // Amostrar o pixel. getImageData lança se uma imagem sem CORS contaminou o canvas —
  // devolve null e o chamador cai no fallback de leitura direta da camada.
  try{
    var data=ctx.getImageData(x, y, 1, 1).data;
    return {r:data[0], g:data[1], b:data[2], a:data[3]};
  }catch(e){ return null; }
}

// Auxiliar: retângulo arredondado no canvas 2D
function _dFillRoundRect(ctx, x, y, w, h, r){
  r=Math.min(r, w/2, h/2);
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
  ctx.fill();
}

/**
 * Converte valores R, G, B (0-255) para string hex #RRGGBB.
 * @returns {string}
 */
function _dRgbaToHex(r, g, b){
  return '#'+[r,g,b].map(function(c){
    var h=c.toString(16);
    return h.length<2?'0'+h:h;
  }).join('').toUpperCase();
}

// Elemento de preview flutuante (reutilizado)
var _dEyedropPreviewEl=null;

/**
 * Mostra/atualiza preview de cor sob o cursor.
 * Cria um div flutuante com swatch de cor e valor hex.
 * @param {number} screenX — posição X na tela (clientX)
 * @param {number} screenY — posição Y na tela (clientY)
 * @param {{r:number,g:number,b:number,a:number}} color — cor RGBA
 */
function dEyedropPreview(screenX, screenY, color){
  if(!_dEyedropPreviewEl){
    _dEyedropPreviewEl=document.createElement('div');
    _dEyedropPreviewEl.id='d-eyedrop-preview';
    _dEyedropPreviewEl.style.cssText=[
      'position:fixed','z-index:99999','pointer-events:none',
      'background:#1A1A1A','border:2px solid #333','border-radius:8px',
      'padding:8px 10px','display:flex','align-items:center','gap:8px',
      'font-family:Roboto,monospace,sans-serif','font-size:11px','color:#eee',
      'box-shadow:0 4px 16px rgba(0,0,0,.5)','white-space:nowrap'
    ].join(';')+';';
    document.body.appendChild(_dEyedropPreviewEl);
  }
  var hex=_dRgbaToHex(color.r, color.g, color.b);
  _dEyedropPreviewEl.innerHTML=
    '<div style="width:28px;height:28px;border-radius:4px;border:1px solid #555;background:'+hex+'"></div>'+
    '<div><div style="font-weight:700;font-size:12px">'+hex+'</div>'+
    '<div style="font-size:9px;color:#999">R:'+color.r+' G:'+color.g+' B:'+color.b+' A:'+color.a+'</div></div>';
  // Posicionar com offset do cursor
  _dEyedropPreviewEl.style.left=(screenX+18)+'px';
  _dEyedropPreviewEl.style.top=(screenY+18)+'px';
  _dEyedropPreviewEl.style.display='flex';
}

/**
 * Esconde o preview do eyedropper.
 */
function dEyedropHidePreview(){
  if(_dEyedropPreviewEl){
    _dEyedropPreviewEl.style.display='none';
  }
}


/* ══════════════════════════════════════════════════════════════════════════════
   FERRAMENTA 2: COLOR SAMPLER
   Pinos de amostragem de cor no canvas (máximo 4).
   ══════════════════════════════════════════════════════════════════════════════ */

var dColorSamplers=[]; // [{x, y, color:{r,g,b,a}, el:HTMLElement}] — máximo 4

/**
 * Adiciona um pino de amostragem na posição (x,y) do canvas.
 * Se já existem 4 pinos, remove o mais antigo.
 * @param {number} x — coordenada X no espaço do canvas
 * @param {number} y — coordenada Y no espaço do canvas
 */
async function dColorSamplerAdd(x, y){
  if(dColorSamplers.length>=4){
    // Remove o primeiro (mais antigo)
    dColorSamplerRemove(0);
  }
  var color=await dEyedropPixel(x, y);
  if(!color){
    gToast('⚠ Posição fora do canvas');
    return;
  }
  dColorSamplers.push({x:x, y:y, color:color, el:null});
  dColorSamplerRender();
  if(typeof dHistoryPush==='function')dHistoryPush();
  if(typeof dMarkUnsaved==='function')dMarkUnsaved();
  var hex=_dRgbaToHex(color.r, color.g, color.b);
  gToast('Sampler #'+dColorSamplers.length+': '+hex);
}

/**
 * Remove o pino no índice especificado (0-based).
 * @param {number} idx
 */
function dColorSamplerRemove(idx){
  if(idx<0||idx>=dColorSamplers.length) return;
  var s=dColorSamplers[idx];
  if(s.el&&s.el.parentNode) s.el.parentNode.removeChild(s.el);
  dColorSamplers.splice(idx, 1);
  dColorSamplerRender(); // re-renderiza para atualizar números
  if(typeof dHistoryPush==='function')dHistoryPush();
  if(typeof dMarkUnsaved==='function')dMarkUnsaved();
}

/**
 * Renderiza todos os pinos de amostragem no canvas frame.
 * Cada pino é um crosshair com número (1-4) e tooltip com valores RGBA.
 */
function dColorSamplerRender(){
  var frame=document.getElementById('d-measure-overlay')||document.getElementById('d-canvas-frame');
  if(!frame) return;
  var scale=(typeof dZoomLevel!=='undefined'?dZoomLevel:100)/100;

  // Remover pinos antigos do DOM
  dColorSamplers.forEach(function(s){
    if(s.el&&s.el.parentNode) s.el.parentNode.removeChild(s.el);
  });

  dColorSamplers.forEach(function(s, i){
    var el=document.createElement('div');
    el.className='d-color-sampler-pin';
    el.dataset.samplerIdx=i;
    el.style.cssText=[
      'position:absolute','z-index:900','pointer-events:auto','cursor:pointer',
      'width:0','height:0'
    ].join(';')+';';
    // Coords cruas: o overlay vive DENTRO do #d-canvas-frame (transform:scale) — o frame já escala.
    el.style.left=s.x+'px';
    el.style.top=s.y+'px';

    var hex=_dRgbaToHex(s.color.r, s.color.g, s.color.b);

    // Crosshair SVG + número
    el.innerHTML=
      '<div style="position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;pointer-events:auto">'+
        '<svg width="20" height="20" viewBox="0 0 20 20" style="overflow:visible">'+
          '<line x1="10" y1="0" x2="10" y2="8" stroke="#FF00FF" stroke-width="1.5"/>'+
          '<line x1="10" y1="12" x2="10" y2="20" stroke="#FF00FF" stroke-width="1.5"/>'+
          '<line x1="0" y1="10" x2="8" y2="10" stroke="#FF00FF" stroke-width="1.5"/>'+
          '<line x1="12" y1="10" x2="20" y2="10" stroke="#FF00FF" stroke-width="1.5"/>'+
          '<circle cx="10" cy="10" r="3" fill="none" stroke="#FF00FF" stroke-width="1"/>'+
        '</svg>'+
        '<div style="position:absolute;top:-18px;left:14px;background:#FF00FF;color:#fff;font-size:9px;font-weight:700;'+
          'width:14px;height:14px;border-radius:50%;display:flex;align-items:center;justify-content:center;'+
          'font-family:Roboto,sans-serif">'+(i+1)+'</div>'+
        '<div class="d-sampler-tooltip" style="position:absolute;top:22px;left:50%;transform:translateX(-50%);'+
          'background:#1A1A1A;border:1px solid #444;border-radius:6px;padding:6px 8px;white-space:nowrap;'+
          'font-family:Roboto,monospace,sans-serif;font-size:10px;color:#eee;display:none;z-index:950;'+
          'box-shadow:0 2px 8px rgba(0,0,0,.4)">'+
          '<div style="font-weight:700;margin-bottom:2px">'+hex+'</div>'+
          '<div style="color:#999">R:'+s.color.r+' G:'+s.color.g+' B:'+s.color.b+' A:'+s.color.a+'</div>'+
        '</div>'+
      '</div>';

    // Toggle tooltip ao hover
    el.addEventListener('mouseenter', function(){
      var tip=el.querySelector('.d-sampler-tooltip');
      if(tip) tip.style.display='block';
    });
    el.addEventListener('mouseleave', function(){
      var tip=el.querySelector('.d-sampler-tooltip');
      if(tip) tip.style.display='none';
    });

    // Clique direito para remover
    el.addEventListener('contextmenu', function(e){
      e.preventDefault();
      e.stopPropagation();
      dColorSamplerRemove(i);
      gToast('Sampler #'+(i+1)+' removido');
    });

    frame.appendChild(el);
    s.el=el;
  });
}

/**
 * Remove todos os pinos de amostragem.
 */
function dColorSamplerClear(){
  dColorSamplers.forEach(function(s){
    if(s.el&&s.el.parentNode) s.el.parentNode.removeChild(s.el);
  });
  dColorSamplers=[];
  gToast('Todos os samplers removidos');
}


/* ══════════════════════════════════════════════════════════════════════════════
   FERRAMENTA 3: RULER (RÉGUA)
   Arrastar no canvas para medir distância entre dois pontos.
   ══════════════════════════════════════════════════════════════════════════════ */

var dRulerState=null; // {startX, startY, endX, endY, lineEl, labelEl}

/**
 * Inicia medição ao pressionar o mouse.
 * @param {MouseEvent} e
 * @param {HTMLElement} frame — o d-canvas-frame
 */
function dRulerStart(e, frame){
  if(!frame) frame=document.getElementById('d-measure-overlay')||document.getElementById('d-canvas-frame');
  var pos=_dScreenToCanvas(e.clientX, e.clientY, frame);
  // Limpar régua anterior
  dRulerClear();

  var scale=(typeof dZoomLevel!=='undefined'?dZoomLevel:100)/100;

  // Criar elementos da linha e label
  var lineEl=document.createElement('div');
  lineEl.id='d-ruler-line';
  lineEl.style.cssText=[
    'position:absolute','z-index:800','pointer-events:none',
    'transform-origin:0 0','height:0','border-top:2px dashed #FF00FF',
    'left:'+pos.x+'px','top:'+pos.y+'px','width:0'
  ].join(';')+';';

  var labelEl=document.createElement('div');
  labelEl.id='d-ruler-label';
  labelEl.style.cssText=[
    'position:absolute','z-index:810','pointer-events:none',
    'background:#1A1A1A','border:1px solid #FF00FF','border-radius:6px',
    'padding:4px 8px','font-family:Roboto,monospace,sans-serif','font-size:10px',
    'color:#FF00FF','white-space:nowrap','box-shadow:0 2px 8px rgba(0,0,0,.4)',
    'display:none'
  ].join(';')+';';

  frame.appendChild(lineEl);
  frame.appendChild(labelEl);

  dRulerState={
    startX:pos.x, startY:pos.y,
    endX:pos.x, endY:pos.y,
    lineEl:lineEl, labelEl:labelEl,
    frame:frame
  };

  // Listeners globais para move/end
  document.addEventListener('mousemove', dRulerMove);
  document.addEventListener('mouseup', dRulerEnd);
}

/**
 * Atualiza a régua enquanto arrasta.
 * @param {MouseEvent} e
 */
function dRulerMove(e){
  if(!dRulerState) return;
  var frame=dRulerState.frame||document.getElementById('d-measure-overlay')||document.getElementById('d-canvas-frame');
  var pos=_dScreenToCanvas(e.clientX, e.clientY, frame);
  var scale=(typeof dZoomLevel!=='undefined'?dZoomLevel:100)/100;

  dRulerState.endX=pos.x;
  dRulerState.endY=pos.y;

  if (dRulerState._af) cancelAnimationFrame(dRulerState._af);
  dRulerState._af = requestAnimationFrame(() => {
    var dx=dRulerState.endX-dRulerState.startX;
    var dy=dRulerState.endY-dRulerState.startY;
    var dist=Math.sqrt(dx*dx+dy*dy);
    var angle=Math.atan2(dy, dx)*(180/Math.PI);

  // Atualizar linha: usar CSS transform para rotacionar
  var line=dRulerState.lineEl;
    // Atualizar linha: usar CSS transform para rotacionar
    var line=dRulerState.lineEl;
    if(line){
      line.style.width=dist+'px'; // coords cruas (frame já escala)
      line.style.transform='rotate('+angle+'deg)';
    }

    var label=dRulerState.labelEl;
    if(label){
      label.style.display='block';
      var midX=(dRulerState.startX+dRulerState.endX)/2;
      var midY=(dRulerState.startY+dRulerState.endY)/2;
      label.style.left=(midX+10)+'px';
      label.style.top=(midY-30)+'px';
      label.textContent = Math.round(dist) + ' px | Ângulo: ' + angle.toFixed(1) + '° | ΔX: ' + Math.round(dx) + ' ΔY: ' + Math.round(dy);
    }
  });
}

/**
 * Finaliza a medição ao soltar o mouse.
 * A régua persiste até Escape ou troca de ferramenta.
 * @param {MouseEvent} e
 */
function dRulerEnd(e){
  document.removeEventListener('mousemove', dRulerMove);
  document.removeEventListener('mouseup', dRulerEnd);

  if(!dRulerState) return;

  var dx=dRulerState.endX-dRulerState.startX;
  var dy=dRulerState.endY-dRulerState.startY;
  var dist=Math.sqrt(dx*dx+dy*dy);

  if(dist<2){
    // Clique sem arrastar — limpar
    dRulerClear();
    return;
  }

  if(typeof dHistoryPush==='function')dHistoryPush();
  if(typeof dMarkUnsaved==='function')dMarkUnsaved();
  gToast(''+Math.round(dist)+' px (ΔX:'+Math.round(dx)+' ΔY:'+Math.round(dy)+')');
}

/**
 * Remove a régua do canvas e limpa o estado.
 */
function dRulerClear(){
  if(dRulerState){
    const hadRuler = dRulerState.startX !== null;
    if(dRulerState.lineEl&&dRulerState.lineEl.parentNode)
      dRulerState.lineEl.parentNode.removeChild(dRulerState.lineEl);
    if(dRulerState.labelEl&&dRulerState.labelEl.parentNode)
      dRulerState.labelEl.parentNode.removeChild(dRulerState.labelEl);
    dRulerState=null;
    if(hadRuler){
      if(typeof dHistoryPush==='function')dHistoryPush();
      if(typeof dMarkUnsaved==='function')dMarkUnsaved();
    }
  }
  document.removeEventListener('mousemove', dRulerMove);
  document.removeEventListener('mouseup', dRulerEnd);
}

// Limpar régua ao pressionar Escape
document.addEventListener('keydown', function(e){
  if(e.key==='Escape'&&dRulerState){
    dRulerClear();
  }
});


/* ══════════════════════════════════════════════════════════════════════════════
   FERRAMENTA 4: NOTE (ANOTAÇÕES)
   Anotações não-impressas no canvas. Ícone de nota adesiva amarela.
   ══════════════════════════════════════════════════════════════════════════════ */

var dNotes=[]; // [{id, x, y, text, collapsed}]

// SVG inline do ícone de nota adesiva
var _dNoteSvg='<svg width="20" height="20" viewBox="0 0 24 24" fill="#FFD600" stroke="#B8960F" stroke-width="1.5">'+
  '<path d="M4 4h12l4 4v12H4z"/>'+
  '<path d="M16 4v4h4" fill="#FFC107" stroke="#B8960F" stroke-width="1.5"/>'+
  '<line x1="8" y1="10" x2="16" y2="10" stroke="#8D6E00" stroke-width="1"/>'+
  '<line x1="8" y1="13" x2="14" y2="13" stroke="#8D6E00" stroke-width="1"/>'+
  '<line x1="8" y1="16" x2="12" y2="16" stroke="#8D6E00" stroke-width="1"/>'+
  '</svg>';

/**
 * Adiciona uma nota na posição (x,y) do canvas.
 * @param {number} x — coordenada X no espaço do canvas
 * @param {number} y — coordenada Y no espaço do canvas
 */
function dNoteAdd(x, y){
  var text=prompt('Texto da nota:');
  if(!text||!text.trim()) return;
  dNotes.push({
    id:_dMeasureId(),
    x:x,
    y:y,
    text:text.trim(),
    collapsed:true
  });
  dNoteRender();
  if(typeof dHistoryPush==='function')dHistoryPush();
  if(typeof dMarkUnsaved==='function')dMarkUnsaved();
  gToast('Nota adicionada');
}

/**
 * Renderiza todas as notas como ícones no canvas frame.
 * Notas não aparecem em exportação (são overlays DOM).
 */
function dNoteRender(){
  var frame=document.getElementById('d-measure-overlay')||document.getElementById('d-canvas-frame');
  if(!frame) return;
  var scale=(typeof dZoomLevel!=='undefined'?dZoomLevel:100)/100;

  // Remover notas antigas do DOM
  var existing=frame.querySelectorAll('.d-note-marker');
  existing.forEach(function(el){el.parentNode.removeChild(el);});

  dNotes.forEach(function(note){
    var el=document.createElement('div');
    el.className='d-note-marker';
    el.dataset.noteId=note.id;
    el.style.cssText=[
      'position:absolute','z-index:850','pointer-events:auto','cursor:pointer',
      'left:'+note.x+'px','top:'+note.y+'px',
      'transform:translate(-10px,-10px)'
    ].join(';')+';';

    // Ícone
    var iconWrap=document.createElement('div');
    iconWrap.style.cssText='position:relative;display:inline-block;';
    iconWrap.innerHTML=_dNoteSvg;
    el.appendChild(iconWrap);

    // Tooltip ao hover (mostra texto completo)
    el.title=note.text;

    // Painel expandido (mostrado ao clicar)
    var panel=document.createElement('div');
    panel.className='d-note-panel';
    panel.style.cssText=[
      'position:absolute','top:24px','left:0','min-width:140px','max-width:220px',
      'background:#FFF9C4','border:1px solid #E0C200','border-radius:6px',
      'padding:8px 10px','font-family:Roboto,sans-serif','font-size:11px',
      'color:#333','box-shadow:0 2px 10px rgba(0,0,0,.25)','word-wrap:break-word',
      'display:'+(note.collapsed?'none':'block'),'z-index:860'
    ].join(';')+';';
    panel.textContent=note.text;

    // Botões de ação dentro do painel
    var actions=document.createElement('div');
    actions.style.cssText='margin-top:6px;display:flex;gap:6px;justify-content:flex-end;';

    var editBtn=document.createElement('button');
    editBtn.textContent='✏️';
    editBtn.title='Editar nota';
    editBtn.style.cssText='background:none;border:1px solid #ccc;border-radius:3px;cursor:pointer;font-size:10px;padding:1px 4px;';
    editBtn.addEventListener('click', function(ev){
      ev.stopPropagation();
      dNoteEdit(note.id);
    });

    var delBtn=document.createElement('button');
    delBtn.textContent='🗑️';
    delBtn.title='Remover nota';
    delBtn.style.cssText='background:none;border:1px solid #ccc;border-radius:3px;cursor:pointer;font-size:10px;padding:1px 4px;';
    delBtn.addEventListener('click', function(ev){
      ev.stopPropagation();
      dNoteRemove(note.id);
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    panel.appendChild(actions);
    el.appendChild(panel);

    // Clicar no ícone: toggle expandido/colapsado
    el.addEventListener('click', function(ev){
      ev.stopPropagation();
      note.collapsed=!note.collapsed;
      panel.style.display=note.collapsed?'none':'block';
    });

    frame.appendChild(el);
  });
}

/**
 * Remove uma nota pelo ID.
 * @param {string} id
 */
function dNoteRemove(id){
  dNotes=dNotes.filter(function(n){return n.id!==id;});
  dNoteRender();
  if(typeof dHistoryPush==='function')dHistoryPush();
  if(typeof dMarkUnsaved==='function')dMarkUnsaved();
  gToast('Nota removida');
}

/**
 * Edita o texto de uma nota existente.
 * @param {string} id
 */
function dNoteEdit(id){
  var note=dNotes.find(function(n){return n.id===id;});
  if(!note) return;
  var newText=prompt('✏️ Editar nota:', note.text);
  if(newText===null) return; // Cancelou
  if(!newText.trim()){
    // Texto vazio → remover nota
    dNoteRemove(id);
    return;
  }
  note.text=newText.trim();
  dNoteRender();
  if(typeof dHistoryPush==='function')dHistoryPush();
  if(typeof dMarkUnsaved==='function')dMarkUnsaved();
  gToast('Nota atualizada');
}


/* ══════════════════════════════════════════════════════════════════════════════
   FERRAMENTA 5: COUNT (MARCADORES NUMERADOS)
   Marcadores numerados sequenciais no canvas.
   ══════════════════════════════════════════════════════════════════════════════ */

var dCountMarkers=[]; // [{id, x, y, number}]
var dCountNext=1;

/**
 * Adiciona um marcador numerado na posição (x,y) do canvas.
 * @param {number} x — coordenada X no espaço do canvas
 * @param {number} y — coordenada Y no espaço do canvas
 */
function dCountAdd(x, y){
  dCountMarkers.push({
    id:_dMeasureId(),
    x:x,
    y:y,
    number:dCountNext
  });
  dCountNext++;
  dCountRender();
  if(typeof dHistoryPush==='function')dHistoryPush();
  if(typeof dMarkUnsaved==='function')dMarkUnsaved();
  gToast('Marcador #'+(dCountNext-1)+' adicionado');
}

/**
 * Renderiza todos os marcadores numerados no canvas frame ou overlay.
 * Marcadores não aparecem em exportação (são overlays DOM).
 */
function dCountRender(){
  var frame=document.getElementById('d-measure-overlay')||document.getElementById('d-canvas-frame');
  if(!frame) return;
  var scale=(typeof dZoomLevel!=='undefined'?dZoomLevel:100)/100;

  // Remover marcadores antigos do DOM
  var existing=frame.querySelectorAll('.d-count-marker');
  existing.forEach(function(el){el.parentNode.removeChild(el);});

  dCountMarkers.forEach(function(marker, i){
    var el=document.createElement('div');
    el.className='d-count-marker';
    el.dataset.countId=marker.id;
    el.style.cssText=[
      'position:absolute','z-index:870','pointer-events:auto','cursor:pointer',
      'width:24px','height:24px','border-radius:50%',
      'background:#E91E63','border:2px solid #fff',
      'display:flex','align-items:center','justify-content:center',
      'font-family:Roboto,sans-serif','font-size:11px','font-weight:700',
      'color:#fff','box-shadow:0 2px 6px rgba(0,0,0,.35)',
      'transform:translate(-50%,-50%)',
      'left:'+marker.x+'px','top:'+marker.y+'px'
    ].join(';')+';';
    el.textContent=marker.number;

    // Clique direito para remover marcador individual
    el.addEventListener('contextmenu', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      dCountRemove(marker.id);
    });

    frame.appendChild(el);
  });
}

/**
 * Remove um marcador pelo ID.
 * @param {string} id
 */
function dCountRemove(id){
  dCountMarkers=dCountMarkers.filter(function(m){return m.id!==id;});
  dCountRender();
  if(typeof dHistoryPush==='function')dHistoryPush();
  if(typeof dMarkUnsaved==='function')dMarkUnsaved();
  gToast('Marcador removido');
}

/**
 * Remove todos os marcadores e reseta o contador.
 */
function dCountClear(){
  var frame=document.getElementById('d-measure-overlay')||document.getElementById('d-canvas-frame');
  if(frame){
    var existing=frame.querySelectorAll('.d-count-marker');
    existing.forEach(function(el){el.parentNode.removeChild(el);});
  }
  dCountMarkers=[];
  dCountNext=1;
  dCountRender();
  if(typeof dHistoryPush==='function')dHistoryPush();
  if(typeof dMarkUnsaved==='function')dMarkUnsaved();
  gToast('Todos os marcadores removidos');
}


/* ══════════════════════════════════════════════════════════════════════════════
   RE-RENDER HOOK & OVERLAY MANAGER
   Re-renderiza overlays após dRenderCanvas (pois este limpa innerHTML do frame).
   ══════════════════════════════════════════════════════════════════════════════ */

function dRenderMeasureOverlay() {
  const overlay = document.getElementById('d-measure-overlay');
  const activeTool = typeof dTool !== 'undefined' ? dTool : '';
  if (overlay) {
    const isMeasureTool = ['color-sampler', 'ruler', 'note', 'count'].includes(activeTool);
    overlay.style.pointerEvents = isMeasureTool ? 'auto' : 'none';
  }

  // Re-renderizar overlays persistentes
  try { if (typeof dColorSamplerRender === 'function') dColorSamplerRender(); } catch(e){}
  try { if (typeof dNoteRender === 'function') dNoteRender(); } catch(e){}
  try { if (typeof dCountRender === 'function') dCountRender(); } catch(e){}

  // Atualizar a linha e label da régua sob pan/zoom, se dRulerState existir
  if (typeof dRulerState !== 'undefined' && dRulerState) {
    const dx = dRulerState.endX - dRulerState.startX;
    const dy = dRulerState.endY - dRulerState.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    // Undo/redo restaura o estado SEM os elementos (e o re-render do canvas pode
    // destacá-los do DOM) — recria aqui, senão fica medição fantasma invisível.
    if (dRulerState.startX !== null && (!dRulerState.lineEl || !dRulerState.lineEl.isConnected)) {
      const host = document.getElementById('d-measure-overlay') || document.getElementById('d-canvas-frame');
      if (host) {
        const lineEl = document.createElement('div');
        lineEl.id = 'd-ruler-line';
        lineEl.style.cssText = 'position:absolute;z-index:800;pointer-events:none;transform-origin:0 0;height:0;border-top:2px dashed #FF00FF;left:' + dRulerState.startX + 'px;top:' + dRulerState.startY + 'px;width:0;';
        const labelEl = document.createElement('div');
        labelEl.id = 'd-ruler-label';
        labelEl.style.cssText = 'position:absolute;z-index:810;pointer-events:none;background:#1A1A1A;border:1px solid #FF00FF;border-radius:6px;padding:4px 8px;font-family:Roboto,monospace,sans-serif;font-size:10px;color:#FF00FF;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.4);display:none;';
        host.appendChild(lineEl); host.appendChild(labelEl);
        dRulerState.lineEl = lineEl; dRulerState.labelEl = labelEl; dRulerState.frame = host;
        if (dist >= 2) {
          labelEl.style.display = 'block';
          labelEl.textContent = Math.round(dist) + ' px | Ângulo: ' + angle.toFixed(1) + '° | ΔX: ' + Math.round(dx) + ' ΔY: ' + Math.round(dy);
        }
      }
    }
    if (dRulerState.lineEl) {
      // coords cruas: o overlay vive dentro do #d-canvas-frame escalado
      dRulerState.lineEl.style.left = dRulerState.startX + 'px';
      dRulerState.lineEl.style.top = dRulerState.startY + 'px';
      dRulerState.lineEl.style.width = dist + 'px';
      dRulerState.lineEl.style.transform = 'rotate(' + angle + 'deg)';
    }
    if (dRulerState.labelEl) {
      const midX = (dRulerState.startX + dRulerState.endX) / 2;
      const midY = (dRulerState.startY + dRulerState.endY) / 2;
      dRulerState.labelEl.style.left = (midX + 10) + 'px';
      dRulerState.labelEl.style.top = (midY - 30) + 'px';
    }
  }
}

// Patching do dRenderCanvas para re-inserir overlays que persistem.
(function(){
  var _patchApplied=false;
  function _applyPatch(){
    if(_patchApplied) return;
    if(typeof dRenderCanvas!=='function') return;
    _patchApplied=true;
    var _origRender=dRenderCanvas;
    dRenderCanvas=function(){
      _origRender.apply(this, arguments);
      try{ dRenderMeasureOverlay(); }catch(e){}
    };
  }
  if(typeof dRenderCanvas==='function'){
    _applyPatch();
  }else{
    document.addEventListener('DOMContentLoaded', function(){
      setTimeout(_applyPatch, 100);
    });
  }
})();


/* ══════════════════════════════════════════════════════════════════════════════
   SERIALIZAÇÃO — Snapshot & Restore (P1.4 Logic Layer)
   Para persistência em localStorage, PSD v2, etc.
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * Captura o estado completo de todas as 4 ferramentas de medição.
 * Retorna um objeto serializável (sem referências a DOM ou funções).
 * Útil para localStorage, export PSD v2, undo/redo, etc.
 * @returns {object}
 */
function dMeasurementSnapshot(){
  return {
    colorSamplers: dColorSamplers.map(function(s){
      return {
        x: s.x,
        y: s.y,
        color: {r: s.color.r, g: s.color.g, b: s.color.b, a: s.color.a}
      };
    }),
    ruler: (dRulerState && dRulerState.startX !== null) ? {
      startX: dRulerState.startX,
      startY: dRulerState.startY,
      endX: dRulerState.endX,
      endY: dRulerState.endY
    } : null,
    notes: dNotes.map(function(n){
      return {
        id: n.id,
        x: n.x,
        y: n.y,
        text: n.text,
        collapsed: n.collapsed
      };
    }),
    countMarkers: dCountMarkers.map(function(m){
      return {
        id: m.id,
        x: m.x,
        y: m.y,
        number: m.number
      };
    }),
    countNext: dCountNext
  };
}

/**
 * Restaura o estado de todas as 4 ferramentas a partir de um snapshot.
 * Limpa o estado anterior e carrega completamente do snapshot.
 * Não re-renderiza DOM — chame dColorSamplerRender(), dNoteRender(), dCountRender()
 * após restaurar se precisar sincronizar a tela.
 *
 * @param {object} snap  Objeto retornado por dMeasurementSnapshot()
 */
function dMeasurementRestore(snap){
  if(!snap || typeof snap !== 'object') return;

  // Restaurar Color Samplers
  if(snap.colorSamplers && Array.isArray(snap.colorSamplers)){
    dColorSamplers = snap.colorSamplers.map(function(s){
      return {
        x: s.x,
        y: s.y,
        color: {r: s.color.r, g: s.color.g, b: s.color.b, a: s.color.a},
        el: null  // re-renderizar para reconstruir DOM
      };
    });
  }else{
    dColorSamplers = [];
  }

  // Restaurar Ruler
  if(snap.ruler && typeof snap.ruler === 'object'){
    if(!dRulerState) dRulerState = {};
    dRulerState.startX = snap.ruler.startX;
    dRulerState.startY = snap.ruler.startY;
    dRulerState.endX = snap.ruler.endX;
    dRulerState.endY = snap.ruler.endY;
  }else{
    dRulerClear();
  }

  // Restaurar Notes
  if(snap.notes && Array.isArray(snap.notes)){
    dNotes = snap.notes.map(function(n){
      return {
        id: n.id,
        x: n.x,
        y: n.y,
        text: n.text,
        collapsed: n.collapsed !== false  // default true
      };
    });
  }else{
    dNotes = [];
  }

  // Restaurar Count Markers
  if(snap.countMarkers && Array.isArray(snap.countMarkers)){
    dCountMarkers = snap.countMarkers.map(function(m){
      return {
        id: m.id,
        x: m.x,
        y: m.y,
        number: m.number
      };
    });
  }else{
    dCountMarkers = [];
  }

  // Restaurar próximo número sequencial
  if(typeof snap.countNext === 'number'){
    dCountNext = snap.countNext;
  }else{
    dCountNext = (dCountMarkers.length > 0)
      ? Math.max.apply(null, dCountMarkers.map(function(m){return m.number;})) + 1
      : 1;
  }
}
