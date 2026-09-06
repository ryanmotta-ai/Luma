/**
 * js/designer/preview.js
 *
 * Preview engine do designer: pvRender, pvRenderLayers, pvRenderLayer,
 * dPreviewOpen, dPreviewClose, dPreviewSetFmt, dPreviewDownload.
 * Depende de: designer/canvas.js, designer/layers.js
 */


/* ══════════════════════════════════════════════════════════════
   PREVIEW ENGINE
══════════════════════════════════════════════════════════════ */
let pvFmt=null, pvDevice='none', pvRendering=false, pvRenderQueued=false;
// Opções de exportação (2.6)
let pvExportScale=2, pvExportType='image/png', pvExportQuality=0.92;
function dPreviewSetScale(v){ pvExportScale=parseInt(v,10)||1; }
function dPreviewSetType(v){ pvExportType=v||'image/png'; }

/* Abre o modal e renderiza */
function dPreviewOpen(){
  pvFmt=dFmt;
  document.getElementById('d-preview-overlay').classList.add('open');
  // Sincronizar aba de formato ativa
  document.querySelectorAll('.pv-fmt-tab').forEach(b=>{
    b.classList.toggle('active',b.dataset.fmt===pvFmt);
  });
  // Atualizar título
  const folder=dFolders.find(f=>f.templates.some(t=>t.id===dActiveTmplId));
  const tmpl=folder&&folder.templates.find(t=>t.id===dActiveTmplId);
  document.getElementById('d-pv-title').textContent=(tmpl?tmpl.name:'TEMPLATE')+' · PREVIEW';
  pvRender();
  pvUpdateSidebar();
}

function dPreviewClose(e){
  if(e&&e.target!==document.getElementById('d-preview-overlay')&&e.target!==undefined)return;
  document.getElementById('d-preview-overlay').classList.remove('open');
}

function dPreviewSetFmt(fmt,btn){
  pvFmt=fmt;
  document.querySelectorAll('.pv-fmt-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  pvRender();
  pvUpdateSidebar();
}

function dPreviewSetDevice(dev,btn){
  pvDevice=dev;
  document.querySelectorAll('.pv-device-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  pvApplyDevice();
}

/* ── Renderização principal via canvas ── */
function pvRender(){
  // Render em andamento → enfileira UM re-render (descartar deixava o canvas
  // mostrando o formato anterior quando o usuário trocava de aba no meio do render)
  if(pvRendering){pvRenderQueued=true;return;}
  pvRendering=true;
  const note=document.getElementById('pv-render-note');
  if(note)note.textContent='Renderizando...';

  const fmtKey=pvFmt||dFmt;
  const fmtSizes=DFMT_SIZES[fmtKey]||DFMT_SIZES.story;
  const W=fmtSizes.w, H=fmtSizes.h;

  const canvas=document.getElementById('pv-canvas-el');
  canvas.width=W; canvas.height=H;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);

  // Calcular escala de exibição para caber no stage
  const stage=document.getElementById('d-preview-stage');
  const maxW=stage.clientWidth-80;
  const maxH=stage.clientHeight-80;
  const scale=Math.min(maxW/W, maxH/H, 1);
  canvas.style.width=Math.round(W*scale)+'px';
  canvas.style.height=Math.round(H*scale)+'px';

  const wrap=document.getElementById('pv-canvas-wrap');
  wrap.style.width=Math.round(W*scale)+'px';
  wrap.style.height=Math.round(H*scale)+'px';

  // Renderizar layers em ordem (fundo → topo).
  // 5.2: formato do preview ≠ formato da prancheta → smart resize (sem distorcer)
  const _ab=(typeof dGetActiveAB==='function')?dGetActiveAB():null;
  const _cur=_ab?{w:_ab.w,h:_ab.h}:(DFMT_SIZES[dFmt]||DFMT_SIZES.story);
  let _src=dLayers;
  if((_cur.w!==W||_cur.h!==H)&&typeof gReflowLayers==='function')
    _src=gReflowLayers(dLayers,_cur,{w:W,h:H},{fmtKey:gFmtKey(fmtKey)});
  const renderQueue=_src.filter(l=>l.visible);
  pvRenderViaMotor(ctx, renderQueue, W, H, 'preview', ()=>{
    // Sobrepor paint canvas se existir
    const paintCv=document.getElementById('d-paint-canvas');
    if(paintCv&&paintCv.width>0){
      ctx.drawImage(paintCv,0,0,W,H);
    }
    pvRendering=false;
    if(note)note.textContent=`${W}×${H}px · escala ${Math.round(scale*100)}%`;
    pvApplyDevice();
    if(pvRenderQueued){pvRenderQueued=false;pvRender();}
  });
}

/* ── PONTE PARA O MOTOR ÚNICO (ticket 5 do estudo de fidelidade, §5.4) ────────────────────
   A prévia e o PNG do Estúdio passavam por `pvRenderLayers`, um SEGUNDO renderizador: sem
   pipeline de ajuste de cor (ignorava a camada inteira) e com opacidade de grupo aplicada
   filho a filho em vez de no composto. O que o designer aprovava não era o que o franqueado
   baixava. Medido em tests/_paridade-render.js: 100% dos pixels divergiam num ajuste de cor,
   22,7% num grupo com opacidade. Agora os dois lados desenham pelo mesmo
   `fRenderTemplateLayers` — o motor do arquivo final.

   Três cuidados que o motor exige e o pv* não pedia:
   • `camp.color` vira 'transparent' — o motor pinta um fundo de campanha quando não encontra
     camada de fundo, e a prancheta do Estúdio pode ser transparente de propósito;
   • o material declara w/h iguais aos do alvo: o reflow de formato já foi feito por quem
     chama, e o motor reflowaria de novo por cima;
   • campo sem valor de simulação continua saindo como `[Rótulo]`, que é o que o Estúdio
     mostrava antes — o motor sozinho deixaria o texto vazio.

   `pvRenderLayers` fica como rede: se `png-generator.js` não tiver carregado, a prévia
   desenha pelo caminho antigo em vez de sumir. */
function pvRenderViaMotor(ctx, layers, W, H, purpose, done){
  if(typeof fRenderTemplateLayers!=='function'){ pvRenderLayers(ctx,layers,W,H,0,done); return; }
  const material={layers:layers, w:W, h:H, fmt:'orig', bg:'transparent'};
  Promise.resolve(fRenderTemplateLayers(ctx, layers, W, H, pvSimDados(layers),
      {color:'transparent'}, material, {scope:'designer', purpose:purpose}))
    .catch(e=>{ console.error('[preview] motor único falhou:', e); })
    .then(()=>done());
}
// Valores da simulação com a MESMA queda do editor: campo sem valor mostra [Rótulo].
function pvSimDados(layers){
  const out={};
  const nomes=(typeof dExtractTemplateVars==='function')?dExtractTemplateVars(layers):[];
  const sim=(typeof dSimValues!=='undefined'&&dSimValues)?dSimValues:{};
  nomes.forEach(n=>{
    const v=(typeof dVars!=='undefined'&&dVars)?dVars.find(x=>x.name===n):null;
    const val=sim[n];
    out[n]=(val!=null&&val!=='')?val:('['+((v&&v.label)||n)+']');
  });
  return out;
}

function pvRenderLayers(ctx, layers, W, H, idx, done){
  if(idx>=layers.length){done();return;}
  const l=layers[idx];
  const cont=()=>pvRenderLayers(ctx,layers,W,H,idx+1,done);
  const _bm=l.blendMode&&l.blendMode!=='normal'?l.blendMode:'normal';
  const _native=(typeof dBlendToComposite==='function')?dBlendToComposite(_bm):null;
  const _needsSw=_bm!=='normal'&&_native===null&&typeof dBlendImageData==='function';
  if(l.mask||_needsSw){
    // offscreen necessário para: máscara e/ou blend software
    const oc=document.createElement('canvas'); oc.width=ctx.canvas.width; oc.height=ctx.canvas.height;
    const octx=oc.getContext('2d'); try{octx.setTransform(ctx.getTransform());}catch(e){}
    const _lNoBm=_needsSw?Object.assign({},l,{blendMode:'normal'}):l;
    pvRenderLayer(octx,_lNoBm,W,H,()=>{
      const doBlend=()=>{
        if(_needsSw){
          const bx=Math.max(0,Math.round(l.x)), by=Math.max(0,Math.round(l.y));
          const bw=Math.min(ctx.canvas.width-bx,Math.max(1,Math.round(l.w)));
          const bh=Math.min(ctx.canvas.height-by,Math.max(1,Math.round(l.h)));
          if(bw>0&&bh>0){
            const topData=octx.getImageData(bx,by,bw,bh);
            const botData=ctx.getImageData(bx,by,bw,bh);
            dBlendImageData(_bm,topData,botData);
            ctx.putImageData(botData,bx,by);
          }
          cont();
        }else{
          ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.drawImage(oc,0,0); ctx.restore(); cont();
        }
      };
      if(l.mask){
        const m=new Image();
        m.onload=()=>{ octx.save(); octx.globalCompositeOperation='destination-in'; octx.drawImage(m,l.x,l.y,l.w,l.h); octx.restore(); doBlend(); };
        m.onerror=doBlend;
        m.src=l.mask;
      }else doBlend();
    });
  } else pvRenderLayer(ctx,l,W,H,cont);
}

function pvRenderLayer(ctx, l, W, H, next){
  ctx.save();
  ctx.globalAlpha=(l.opacity!=null?l.opacity:100)/100;
  if(l.blendMode&&l.blendMode!=='normal'&&typeof dBlendToComposite==='function'){
    var _pvComp=dBlendToComposite(l.blendMode);
    if(_pvComp) ctx.globalCompositeOperation=_pvComp;
  }

  if(l.type==='shape'){
    ctx.fillStyle=l.fill||'#FF9000';
    const kind=l.shapeKind||'rect';
    if(kind==='line'){
      ctx.save();
      ctx.translate(l.x,l.y+l.h/2);
      ctx.rotate((l.rotation||0)*Math.PI/180);
      ctx.fillRect(0,-l.h/2,l.w,l.h);
      ctx.restore();
    } else {
      const vector=(kind==='path'&&typeof gVectorPathValid==='function'&&gVectorPathValid(l.vectorPath))?l.vectorPath:null;
      if(vector){
        gTraceVectorPath(ctx,vector,l.x,l.y,l.w,l.h); ctx.fill(gVectorPathFillRule(vector));
      } else if(kind==='circle'||kind==='ellipse'){
        ctx.beginPath(); ctx.ellipse(l.x+l.w/2,l.y+l.h/2,l.w/2,l.h/2,0,0,Math.PI*2); ctx.fill();
      } else {
        const pts=(typeof dShapePoints==='function')?dShapePoints(l):null;
        if(pts){
          const abs=pts.map(p=>[l.x+p[0]*l.w, l.y+p[1]*l.h]);
          const r=Math.min(l.radius||0, l.w/2, l.h/2);
          if(r>0 && typeof gRoundPolyPath2D==='function'){ gRoundPolyPath2D(ctx,abs,r); }
          else { ctx.beginPath(); abs.forEach((p,i)=>{ i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]); }); ctx.closePath(); }
          ctx.fill();
        } else {
          const r=Math.min(l.radius||0, l.w/2, l.h/2);
          pvRoundRect(ctx,l.x,l.y,l.w,l.h,r); ctx.fill();
        }
      }
    }
    ctx.restore();next();

  }else if(l.type==='text'){
    // Substituir {{var}} por [Rótulo] usando a regex/interpolador únicos (3.1)
    const _lbl={};
    (l.content||'').replace(gVarRegex(),(_,vn)=>{const v=(dVars||[]).find(x=>x.name===vn);_lbl[vn]='['+(v?v.label:vn)+']';return _;});
    const raw=gInterpolate(l.content,_lbl,{onEmpty:'keep'});
    const lines=raw.split('\n');
    const _fp=(typeof dTextFontParts==='function')?dTextFontParts(l.font):{family:"'Roboto', sans-serif",weight:900};
    const _ital=l.italic?'italic ':'';
    ctx.font=`${_ital}${_fp.weight} ${l.fontSize||24}px ${_fp.family}`;
    ctx.fillStyle=l.color||'#fff';

    if(l.vertical){
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      const fontSize = l.fontSize||24;
      const charStep = fontSize * 1.1;
      const colStep = fontSize * 1.2;
      const numCols = lines.length;
      const totalTextW = numCols * colStep;
      const startX = l.x + l.w / 2 + totalTextW / 2 - colStep / 2;

      lines.forEach((line, i) => {
        const tx = startX - i * colStep;
        const chars = [...line];
        const numChars = chars.length;
        const colH = numChars * charStep;
        
        let ty;
        if(l.textAlign === 'center') {
          ty = l.y + l.h / 2 - colH / 2 + charStep / 2;
        } else if(l.textAlign === 'right') {
          ty = l.y + l.h - colH + charStep / 2;
        } else {
          ty = l.y + charStep / 2;
        }

        chars.forEach((char, j) => {
          const cy = ty + j * charStep;
          ctx.fillText(char, tx, cy);
        });

        if(l.strikethrough){
          ctx.strokeStyle=l.color||'#fff';ctx.lineWidth=2;
          ctx.beginPath();
          ctx.moveTo(tx, ty - charStep/2);
          ctx.lineTo(tx, ty + colH - charStep/2);
          ctx.stroke();
        }
      });
    } else {
      ctx.textAlign=l.textAlign||'left';
      const _fs=l.fontSize||24, _lh=_fs*(l.lineHeight||1.25);
      // vAlign 'top' (PSD): baseline alfabético com o TOPO DA TINTA em l.y (1:1). Senão: topo do em.
      let _useAlpha=(l.vAlign==='top'), _ia=_fs*0.8;
      if(_useAlpha){ ctx.textBaseline='alphabetic';
        try{ const _m=ctx.measureText(lines[0]||'H'); if(_m.actualBoundingBoxAscent) _ia=_m.actualBoundingBoxAscent; }catch(e){}
      } else { ctx.textBaseline='top'; }
      lines.forEach((line,i)=>{
        const tx=l.textAlign==='center'?l.x+l.w/2:l.textAlign==='right'?l.x+l.w:l.x;
        const ty=_useAlpha ? (l.y+_ia+i*_lh) : (l.y+i*_lh);
        ctx.fillText(line,tx,ty);
        if(l.strikethrough){
          const tw=ctx.measureText(line).width;
          const lx=l.textAlign==='center'?tx-tw/2:l.textAlign==='right'?tx-tw:tx;
          const sy=_useAlpha ? (ty-_fs*0.30) : (ty+_fs*0.55);
          ctx.strokeStyle=l.color||'#fff';ctx.lineWidth=2;
          ctx.beginPath();ctx.moveTo(lx,sy);ctx.lineTo(lx+tw,sy);ctx.stroke();
        }
      });
    }
    ctx.restore();next();

  }else if(l.type==='frame'||l.type==='image'){
    const r=l.frameShape==='circle'?Math.min(l.w,l.h)/2:(l.radius||0);
    if(l.imgUrl&&l.imgUrl!=='__local__'){
      // Carregar imagem real
      const img=new Image();
      img.crossOrigin='anonymous';
      img.onload=()=>{
        ctx.save();
        // clip path
        ctx.beginPath();
        if(l.frameShape==='circle'){
          ctx.arc(l.x+l.w/2,l.y+l.h/2,Math.min(l.w,l.h)/2,0,Math.PI*2);
        }else{
          pvRoundRect(ctx,l.x,l.y,l.w,l.h,r);
        }
        ctx.clip();
        // object-fit cover
        const ir=img.width/img.height, fr=l.w/l.h;
        let sx,sy,sw,sh;
        if(l.objectFit==='contain'){
          if(ir>fr){sw=l.w;sh=l.w/ir;sx=l.x;sy=l.y+(l.h-sh)/2;}
          else{sh=l.h;sw=l.h*ir;sy=l.y;sx=l.x+(l.w-sw)/2;}
        }else{
          if(ir>fr){sh=l.h;sw=l.h*ir;sy=l.y;sx=l.x-(sw-l.w)/2;}
          else{sw=l.w;sh=l.w/ir;sx=l.x;sy=l.y-(sh-l.h)/2;}
        }
        try{
          ctx.drawImage(img,sx,sy,sw,sh);
        }catch(e){
          console.warn('Erro ao desenhar imagem:', e);
        }finally{
          ctx.restore();
          next();
        }
      };
      img.onerror=()=>{pvRenderFramePlaceholder(ctx,l,r);ctx.restore();next();};
      img.src=l.imgUrl;
    }else{
      // Placeholder visual
      pvRenderFramePlaceholder(ctx,l,r);
      ctx.restore();next();
    }

  }else{
    ctx.restore();next();
  }
}

function pvRenderFramePlaceholder(ctx,l,r){
  // Fundo do placeholder
  ctx.save();
  ctx.beginPath();
  if(l.frameShape==='circle'){
    ctx.arc(l.x+l.w/2,l.y+l.h/2,Math.min(l.w,l.h)/2,0,Math.PI*2);
  }else{
    pvRoundRect(ctx,l.x,l.y,l.w,l.h,r);
  }
  ctx.fillStyle='rgba(255,255,255,0.06)';
  ctx.fill();
  // Borda tracejada
  ctx.setLineDash([6,4]);
  ctx.strokeStyle='rgba(255,144,0,0.5)';
  ctx.lineWidth=2;
  ctx.stroke();
  ctx.setLineDash([]);
  // Ícone centralizado
  const cx=l.x+l.w/2, cy=l.y+l.h/2;
  const sz=Math.min(l.w,l.h)*0.18;
  ctx.strokeStyle='rgba(255,255,255,0.25)';ctx.lineWidth=sz*0.12;
  // desenhar ícone de foto simplificado
  ctx.beginPath();
  pvRoundRect(ctx,cx-sz,cy-sz*0.75,sz*2,sz*1.5,sz*0.15);
  ctx.stroke();
  ctx.beginPath();ctx.arc(cx,cy-sz*0.1,sz*0.35,0,Math.PI*2);ctx.stroke();
  // Label
  if(l.imgVar){
    ctx.fillStyle='rgba(255,255,255,0.3)';
    ctx.font=`400 ${Math.max(10,sz*0.35)}px Roboto,sans-serif`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('['+l.imgVar+']',cx,cy+sz*0.85);
  }
  ctx.restore();
}

function pvRoundRect(ctx,x,y,w,h,r){
  // beginPath OBRIGATÓRIO também no canto reto. Sem ele o `rect` só ANEXAVA ao caminho que
  // ainda estava aberto, e o `fill()` da camada seguinte repintava todas as caixas anteriores
  // com a opacidade e a mesclagem DELA: um retângulo em multiply escurecia a prancheta inteira
  // na prévia e no PNG do Estúdio, enquanto o motor do franqueado escurecia só a área da forma.
  // Medido na bancada de paridade (tests/_paridade-render.js): 80% dos pixels divergiam.
  // Os dois outros chamadores já fazem beginPath antes — repetir aqui não muda nada para eles.
  if(r<=0){ctx.beginPath();ctx.rect(x,y,w,h);return;}
  r=Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);
  ctx.closePath();
}

/* ── Device shell ── */
function pvApplyDevice(){
  const stage=document.getElementById('d-preview-stage');
  const shell=document.getElementById('pv-device-shell');
  const wrap=document.getElementById('pv-canvas-wrap');
  // Remover classes device anteriores
  stage.className=stage.className.replace(/pv-device-\S+/g,'').trim();
  stage.classList.add('pv-device-'+pvDevice);
  shell.innerHTML='';shell.style.cssText='';

  const cw=parseInt(wrap.style.width)||300;
  const ch=parseInt(wrap.style.height)||500;

  if(pvDevice==='phone'){
    const pad=14;
    shell.style.cssText=`width:${cw+pad*2}px;height:${ch+pad*2+60}px;top:${-pad-30}px;left:${-pad}px;`;
    shell.innerHTML=`<div class="pv-phone-shell" style="width:100%;height:100%;position:relative;border-radius:36px;">
      <div class="pv-phone-notch"></div>
      <div style="position:absolute;bottom:10px;left:50%;transform:translateX(-50%);width:40px;height:4px;background:#333;border-radius:2px;"></div>
    </div>`;
  }else if(pvDevice==='desktop'){
    const topBar=36;const pad=12;
    shell.style.cssText=`width:${cw+pad*2}px;height:${ch+topBar+pad}px;top:${-topBar}px;left:${-pad}px;`;
    shell.innerHTML=`<div class="pv-desktop-shell" style="width:100%;height:100%;">
      <div class="pv-desktop-bar">
        <div class="pv-dot" style="background:#FF5F56"></div>
        <div class="pv-dot" style="background:#FFBD2E"></div>
        <div class="pv-dot" style="background:#27C93F"></div>
        <div style="flex:1;height:16px;background:#333;border-radius:4px;margin-left:8px;"></div>
      </div>
    </div>`;
  }
}

/* ── Sidebar ── */
function pvUpdateSidebar(){
  const fmtKey=pvFmt||dFmt;
  const sz=DFMT_SIZES[fmtKey]||DFMT_SIZES.story;
  const frames=dLayers.filter(l=>l.type==='frame');
  const varsInUse=[...new Set(dLayers.filter(l=>l.type==='text').flatMap(l=>[...(l.content||'').matchAll(gVarRegex())].map(m=>m[1])))];
  const emptyFrames=frames.filter(l=>!l.imgUrl||l.imgUrl==='__local__');

  document.getElementById('pv-info-fmt').textContent=fmtKey.toUpperCase();
  document.getElementById('pv-info-dim').textContent=sz.w+'×'+sz.h+'px';
  document.getElementById('pv-info-layers').textContent=dLayers.filter(l=>l.visible).length+' visíveis / '+dLayers.length+' total';
  document.getElementById('pv-info-vars').textContent=varsInUse.length+' em uso';
  const framesEl=document.getElementById('pv-info-frames');
  framesEl.textContent=frames.length+(emptyFrames.length?' ('+emptyFrames.length+' sem foto)':'');
  framesEl.className='pv-info-val'+(emptyFrames.length?' warn':' ok');

  // Lista de layers
  const lyrEl=document.getElementById('pv-layers-list');
  lyrEl.innerHTML=dLayers.slice().reverse().map(l=>{
    const typeClass={text:'pv-type-text',frame:'pv-type-frame',shape:'pv-type-shape',image:'pv-type-image'}[l.type]||'pv-type-shape';
    const icon={text:'T',frame:'⬜',shape:'■',image:'▣'}[l.type]||'■';
    const hasVar=l.type==='text'&&/\{\{/.test(l.content||'');
    return `<div class="pv-layer-preview" style="opacity:${l.visible?1:.35}">
      <span class="pv-layer-icon">${icon}</span>
      <span class="pv-layer-name">${gEsc(l.name)}</span>
      ${hasVar?'<span class="pv-layer-type pv-type-text">var</span>':''}
      <span class="pv-layer-type ${typeClass}">${l.type}</span>
    </div>`;
  }).join('');

  // Checklist
  const checks=[];
  if(dLayers.length===0)checks.push({ok:false,msg:'Nenhuma camada criada'});
  else checks.push({ok:true,msg:dLayers.length+' camada(s) no material'});
  if(emptyFrames.length)checks.push({ok:false,msg:emptyFrames.length+' moldura(s) sem foto'});
  else if(frames.length)checks.push({ok:true,msg:'Todas as molduras com foto'});
  if(varsInUse.length)checks.push({ok:true,msg:varsInUse.length+' variável(is) configurada(s)'});
  else checks.push({ok:false,msg:'Nenhuma variável em uso'});
  const bgLayer=dLayers.find(l=>l.type==='shape'&&l.x===0&&l.y===0&&l.w>=sz.w*0.9&&l.h>=sz.h*0.9);
  if(bgLayer)checks.push({ok:true,msg:'Fundo de tela configurado'});
  else checks.push({ok:false,msg:'Sem layer de fundo (opcional)'});

  // Icone = SVG inline com currentColor (nunca glifo/emoji: o ✓ e o ⚠ mudavam de forma e de
  // peso conforme a fonte do sistema, e o ⚠ vinha colorido em alguns aparelhos). Cor por token.
  const _icoOk='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
  const _icoWarn='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';
  document.getElementById('pv-checklist').innerHTML=checks.map(ch=>`
    <div style="display:flex;align-items:center;gap:7px;padding:4px 0;font-size:11px;color:${ch.ok?'var(--green)':'var(--dm-yellow)'}">
      <span style="display:inline-flex">${ch.ok?_icoOk:_icoWarn}</span>
      <span>${ch.msg}</span>
    </div>`).join('');
}

/* ── Downloads ── */
function dBuildTemplateFilename(fmtKey){
  const tmpl = dFolders.flatMap(f=>f.templates).find(t=>t.id===dActiveTmplId);
  const tmplName = tmpl ? fSanitizeNamePart(tmpl.name) || 'Template' : 'Template';
  const fmtMap = {story:'Story', feed:'Feed', wide:'PostWide', post:'PostWide'};
  const fmtName = fmtMap[fmtKey] || fSanitizeNamePart(fmtKey) || 'Story';
  const now = new Date();
  const date = now.getFullYear() + '-' +
               String(now.getMonth()+1).padStart(2,'0') + '-' +
               String(now.getDate()).padStart(2,'0');
  return `DM_Template_${tmplName}_${fmtName}_${date}.png`;
}
// Nome de arquivo com extensão conforme o formato escolhido
function dExportFilename(fmtKey){
  return dBuildTemplateFilename(fmtKey).replace(/\.png$/i, pvExportType==='image/jpeg'?'.jpg':'.png');
}
function dPreviewDownload(btn){
  const fmtKey=pvFmt||dFmt;
  const restore=(typeof gBtnLoading==='function')?gBtnLoading(btn,'Gerando…'):()=>{};
  pvRenderToBlob(fmtKey, blob=>{
    restore();
    if(!blob){gToast('Não foi possível gerar o arquivo — tente novamente','error');return;}
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=dExportFilename(fmtKey);
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1500); // M10: libera memória
    gToast('Baixado: '+fmtKey.toUpperCase()+' '+pvExportScale+'×');
  });
}

function dPreviewDownloadAll(){
  const fmts=['story','feed','wide'];
  let i=0;
  function next(){
    if(i>=fmts.length)return;
    const fmt=fmts[i++];
    pvRenderToBlob(fmt, blob=>{
      if(blob){
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a');
        a.href=url;a.download=dExportFilename(fmt);
        a.click();
        setTimeout(()=>URL.revokeObjectURL(url),1500);
      }
      setTimeout(next,300);
    });
  }
  next();
  gToast('Baixando todos os formatos...');
}

function pvRenderToBlob(fmt, cb){
  // Espera as fontes (Roboto + custom) antes de rasterizar — sem isso o primeiro
  // export sai com a fonte fallback do sistema, silenciosamente (o SVG já esperava).
  if(document.fonts&&document.fonts.ready&&document.fonts.status!=='loaded'){
    document.fonts.ready.then(()=>_pvRenderToBlobNow(fmt,cb),()=>_pvRenderToBlobNow(fmt,cb));
    return;
  }
  _pvRenderToBlobNow(fmt,cb);
}
function _pvRenderToBlobNow(fmt, cb){
  const sz=DFMT_SIZES[fmt]||DFMT_SIZES.story;
  const scale=pvExportScale||1;
  const offscreen=document.createElement('canvas');
  offscreen.width=Math.round(sz.w*scale);offscreen.height=Math.round(sz.h*scale);
  const ctx=offscreen.getContext('2d');
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.scale(scale,scale); // desenha no layout original num canvas maior → nitidez
  // 5.2: exportar num formato ≠ prancheta atual → smart resize
  const _ab2=(typeof dGetActiveAB==='function')?dGetActiveAB():null;
  const _cur2=_ab2?{w:_ab2.w,h:_ab2.h}:(DFMT_SIZES[dFmt]||DFMT_SIZES.story);
  let _src2=dLayers;
  if((_cur2.w!==sz.w||_cur2.h!==sz.h)&&typeof gReflowLayers==='function')
    _src2=gReflowLayers(dLayers,_cur2,{w:sz.w,h:sz.h},{fmtKey:gFmtKey(fmt)});
  const visible=_src2.filter(l=>l.visible);
  pvRenderViaMotor(ctx,visible,sz.w,sz.h,'export',()=>{
    const paintCv=document.getElementById('d-paint-canvas');
    if(paintCv&&paintCv.width>0)ctx.drawImage(paintCv,0,0,sz.w,sz.h);
    // JPG não tem transparência → fundo branco atrás de tudo
    if(pvExportType==='image/jpeg'){
      ctx.globalCompositeOperation='destination-over';
      ctx.fillStyle='#FFFFFF';ctx.fillRect(0,0,sz.w,sz.h);
      ctx.globalCompositeOperation='source-over';
    }
    offscreen.toBlob(blob=>cb(blob), pvExportType, pvExportQuality);
  });
}

/* ══════════════════════════════════════════════════════════════
   4.4 — EXPORTAÇÃO SVG (client-side, sem libs)
   dExportSVG({fmt, dados, fillVars, includeFont, includePaint})
   Limitações documentadas: pintura e fotos saem como raster embarcado;
   texto sai com fontSize pré-calculado (auto-fit fixo); fonte é subset latin.
   NÃO use SVG pra rasterizar — o PNG 2× continua melhor pra isso.
══════════════════════════════════════════════════════════════ */
function dExportSVGTemplate(){ dExportSVG({fmt:dFmt, fillVars:false}); }
function dExportSVGFilled(){ dExportSVG({fmt:dFmt, dados:(typeof dSimValues!=='undefined'?dSimValues:{}), fillVars:true}); }

// rgba(...) → {fill:'#rrggbb', op:0..1}; hex/nome → {fill, op:1}
function dSvgColor(c){
  if(!c) return {fill:'#000000', op:1};
  const m=String(c).match(/rgba?\(([^)]+)\)/i);
  if(m){
    const p=m[1].split(',').map(s=>s.trim());
    const r=+p[0]||0,g=+p[1]||0,b=+p[2]||0,a=(p[3]!=null?+p[3]:1);
    const hex='#'+[r,g,b].map(n=>('0'+(n&255).toString(16)).slice(-2)).join('');
    return {fill:hex, op:isNaN(a)?1:a};
  }
  return {fill:String(c), op:1};
}
// Extrai cor sólida e opacidade de um rgba()/hex p/ flood-color + flood-opacity do SVG.
function _svgFloodColor(c){ if(!c) return '#000'; const m=String(c).match(/rgba?\(([^)]+)\)/i); if(m){ const p=m[1].split(','); return 'rgb('+(+p[0])+','+(+p[1])+','+(+p[2])+')'; } return c; }
function _svgFloodOp(c){ const m=String(c||'').match(/rgba\(([^)]+)\)/i); return (m&&m[1].split(',')[3]!=null)?(+m[1].split(',')[3]).toFixed(2):'1'; }
// Filtro SVG de efeitos: sombra projetada + brilho externo + sombra interna. {defs, attr}.
function dSvgFx(l, id){
  if(!(l.shadow||l.glow||l.innerShadow||l.innerGlow||l.bevel)) return {defs:'', attr:''};
  const prims=[]; const merges=[]; let inner='';
  if(l.glow){ const g=(l.glowSize!=null?l.glowSize:8)/2;
    if(l.glowSpread>0) prims.push(`<feMorphology in="SourceAlpha" operator="dilate" radius="${l.glowSpread}" result="gd${id}"/>`);
    prims.push(`<feGaussianBlur in="${l.glowSpread>0?`gd${id}`:'SourceAlpha'}" stdDeviation="${g}" result="gb${id}"/>`
      +`<feFlood flood-color="${_svgFloodColor(l.glowColor||'rgba(255,255,255,.7)')}" flood-opacity="${_svgFloodOp(l.glowColor)}"/>`
      +`<feComposite in2="gb${id}" operator="in" result="gl${id}"/>`);
    merges.push(`<feMergeNode in="gl${id}"/>`); }
  if(l.shadow){ const o=gFxOffset(l.shadowDist!=null?l.shadowDist:4,l.shadowAngle); const b=(l.shadowBlur!=null?l.shadowBlur:6)/2;
    // "propagação" do PS = dilatar a silhueta antes do desfoque → feMorphology é exatamente isso.
    if(l.shadowSpread>0) prims.push(`<feMorphology in="SourceAlpha" operator="dilate" radius="${l.shadowSpread}" result="sd${id}"/>`);
    const _src=(l.shadowSpread>0)?`sd${id}`:'SourceAlpha';
    prims.push(`<feGaussianBlur in="${_src}" stdDeviation="${b}" result="sb${id}"/>`
      +`<feOffset in="sb${id}" dx="${o.x}" dy="${o.y}" result="so${id}"/>`
      +`<feFlood flood-color="${_svgFloodColor(l.shadowColor)}" flood-opacity="${_svgFloodOp(l.shadowColor)}"/>`
      +`<feComposite in2="so${id}" operator="in" result="ds${id}"/>`);
    merges.push(`<feMergeNode in="ds${id}"/>`); }
  merges.push(`<feMergeNode in="SourceGraphic"/>`);
  // Efeitos INTERNOS (recortados na forma): sombra interna, brilho interno, chanfro (realce+sombra).
  let _ic=0;
  const innerPrim=(color, blur, o)=>{ const k=id+'i'+(_ic++); const b=(blur||6)/2;
    inner+=`<feComponentTransfer in="SourceAlpha" result="ia${k}"><feFuncA type="table" tableValues="1 0"/></feComponentTransfer>`
      +`<feGaussianBlur in="ia${k}" stdDeviation="${b}" result="ib${k}"/>`
      +`<feOffset in="ib${k}" dx="${o?o.x:0}" dy="${o?o.y:0}" result="io${k}"/>`
      +`<feFlood flood-color="${_svgFloodColor(color)}" flood-opacity="${_svgFloodOp(color)}"/>`
      +`<feComposite in2="io${k}" operator="in" result="ish${k}"/>`
      +`<feComposite in="ish${k}" in2="SourceGraphic" operator="in" result="isc${k}"/>`;
    merges.push(`<feMergeNode in="isc${k}"/>`); };
  if(l.innerShadow) innerPrim(l.innerShadowColor, l.innerShadowBlur!=null?l.innerShadowBlur:6, gFxOffset(l.innerShadowDist!=null?l.innerShadowDist:4,l.innerShadowAngle));
  if(l.innerGlow) innerPrim(l.innerGlowColor||'rgba(255,255,255,.7)', l.innerGlowSize!=null?l.innerGlowSize:8, null);
  if(l.bevel){ const o=gFxOffset(l.bevelSize!=null?l.bevelSize:4,l.bevelAngle), b=l.bevelSize!=null?l.bevelSize:4;
    innerPrim(l.bevelHighlight||'rgba(255,255,255,.7)', b, o); innerPrim(l.bevelShadow||'rgba(0,0,0,.5)', b, {x:-o.x,y:-o.y}); }
  const defs=`<filter id="fx${id}" x="-50%" y="-50%" width="200%" height="200%">${prims.join('')}${inner}<feMerge>${merges.join('')}</feMerge></filter>`;
  return {defs, attr:` filter="url(#fx${id})"`};
}
// Path SVG de retângulo com raio POR CANTO. Raio 0 → o arco vira linha reta (spec SVG).
function _dSvgRoundRectPath(x,y,w,h,tl,tr,br,bl){
  const m=Math.min(w,h)/2;
  tl=Math.max(0,Math.min(tl,m)); tr=Math.max(0,Math.min(tr,m));
  br=Math.max(0,Math.min(br,m)); bl=Math.max(0,Math.min(bl,m));
  return `M${x+tl},${y} H${x+w-tr} A${tr},${tr} 0 0 1 ${x+w},${y+tr} V${y+h-br} A${br},${br} 0 0 1 ${x+w-br},${y+h} H${x+bl} A${bl},${bl} 0 0 1 ${x},${y+h-bl} V${y+tl} A${tl},${tl} 0 0 1 ${x+tl},${y} Z`;
}
function dSvgShape(l){
  const layerOp=(l.opacity!=null?l.opacity:100)/100;
  const _c=dSvgColor(l.fill||'#FF9000');
  let fill=_c.fill; let totalOp=(layerOp*_c.op).toFixed(3);
  if(l.overlay&&l.overlayColor){ fill=dSvgColor(l.overlayColor).fill; totalOp=(layerOp*(l.overlayOpacity!=null?l.overlayOpacity:1)).toFixed(3); } // color overlay
  // gradiente (prevalece sobre fill sólido) — def embutido + fill=url(#id)
  let gradDef='';
  if(l.gradient&&l.gradient.stops&&l.gradient.stops.length&&typeof gGradientSvg==='function'){
    const gid='grd-'+String(l.id||'x').replace(/[^a-z0-9]/gi,'')+'-'+Math.round(l.x)+'-'+Math.round(l.y);
    gradDef=gGradientSvg(l.gradient, gid); fill='url(#'+gid+')'; totalOp=layerOp.toFixed(3);
  } else if(l.gradientOverlay&&l.gradientOverlay.stops&&l.gradientOverlay.stops.length&&typeof gGradientSvg==='function'){ // gradient overlay (aprox.: vira o fill no preview)
    const gid='grdo-'+String(l.id||'x').replace(/[^a-z0-9]/gi,'')+'-'+Math.round(l.x)+'-'+Math.round(l.y);
    gradDef=gGradientSvg(l.gradientOverlay, gid); fill='url(#'+gid+')'; totalOp=(layerOp*(l.gradientOverlay.opacity!=null?l.gradientOverlay.opacity:1)).toFixed(3);
  }
  const kind=l.shapeKind||'rect';
  // Geometria da forma como elemento SVG, aceitando atributos extras (fill/stroke/clip).
  // Um único gerador reusado pelo fill, pelo traço e pelo clipPath — sem duplicar a forma.
  const pts=(typeof dShapePoints==='function')?dShapePoints(l):null;
  const geom=(extra)=>{
    if(kind==='line'){
      const cy=l.y+l.h/2;
      return `<rect x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" transform="rotate(${l.rotation||0} ${l.x} ${cy})" ${extra}/>`;
    }
    if(kind==='path'&&typeof gVectorPathD==='function'){
      const d=gVectorPathD(l.vectorPath,l.x,l.y,l.w,l.h), rule=typeof gVectorPathFillRule==='function'?gVectorPathFillRule(l.vectorPath):'nonzero';
      if(d)return `<path d="${d}" fill-rule="${rule}" clip-rule="${rule}" ${extra}/>`;
    }
    if(kind==='circle'||kind==='ellipse') return `<ellipse cx="${l.x+l.w/2}" cy="${l.y+l.h/2}" rx="${l.w/2}" ry="${l.h/2}" ${extra}/>`;
    if(pts){
      const abs=pts.map(p=>[l.x+p[0]*l.w, l.y+p[1]*l.h]);
      const r=Math.min(l.radius||0, l.w/2, l.h/2);
      if(r>0 && typeof gRoundPolyD==='function') return `<path d="${gRoundPolyD(abs,r)}" ${extra}/>`;
      return `<polygon points="${abs.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')}" ${extra}/>`;
    }
    if(l.radii){
      const d=_dSvgRoundRectPath(l.x,l.y,l.w,l.h, +l.radii.tl||0, +l.radii.tr||0, +l.radii.br||0, +l.radii.bl||0);
      return `<path d="${d}" ${extra}/>`;
    }
    const r=Math.min(l.radius||0, l.w/2, l.h/2);
    return `<rect x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" rx="${r}" ry="${r}" ${extra}/>`;
  };
  const fillAttr=`fill="${fill}" fill-opacity="${totalOp}"`;
  // Decoração do traço (dash/cap/join) — comum a todos os alinhamentos.
  let strokeDeco='';
  if(l.strokeDash&&l.strokeDash.length) strokeDeco+=` stroke-dasharray="${l.strokeDash.join(' ')}"`;
  if(l.strokeCap) strokeDeco+=` stroke-linecap="${l.strokeCap}"`;
  if(l.strokeJoin) strokeDeco+=` stroke-linejoin="${l.strokeJoin}"`;
  const align=l.strokeW>0?(l.strokeAlign||'center'):null;
  // inside/outside: o SVG só desenha o traço CENTRADO no path. Espelhando o PNG (largura×2 + clip
  // interno / re-fill), dobramos a espessura e recortamos (inside) ou pintamos o fill por cima
  // (outside) — senão a borda saía meio pra fora e mais fina que na arte final.
  if(align==='inside' || align==='outside'){
    const scol=dSvgColor(l.strokeColor||'#000').fill;
    const strokeEl=geom(`fill="none" stroke="${scol}" stroke-width="${l.strokeW*2}"${strokeDeco}`);
    const fillEl=geom(fillAttr);
    if(align==='inside'){
      const cid='clp-'+String(l.id||'x').replace(/[^a-z0-9]/gi,'')+'-'+Math.round(l.x)+'-'+Math.round(l.y);
      return gradDef+`<clipPath id="${cid}">${geom('')}</clipPath>`+fillEl+`<g clip-path="url(#${cid})">${strokeEl}</g>`;
    }
    return gradDef+strokeEl+fillEl; // outside: traço atrás, fill por cima cobre a metade interna
  }
  // centro (ou sem traço): elemento único com traço centrado
  const strokeAttr=(l.strokeW>0)?` stroke="${dSvgColor(l.strokeColor||'#000').fill}" stroke-width="${l.strokeW}"${strokeDeco}`:'';
  return gradDef+geom(`${fillAttr}${strokeAttr}`);
}
function dSvgText(l, mctx, fillVars, dados, defaults){
  let content = fillVars ? gInterpolate(l.content, dados, {onEmpty:'remove', defaults}) : (l.content||'');
  // Mesmo wrapper do PNG/live preview: sem isso SVG encolhia 1 linha enquanto PNG quebrava.
  if(l.textBox==='box'&&typeof gSmartWrapText==='function') content=gSmartWrapText(content,l.w,l,dados,defaults);
  const lines = content.split('\n').filter(s=>s.trim()!=='');
  if(!lines.length) return '';
  const fp=(typeof dTextFontParts==='function')?dTextFontParts(l.font):{family:"'Roboto',sans-serif",weight:900};
  const weight=fp.weight;
  const _itAttr=l.italic?' font-style="italic"':''; // itálico no SVG
  // família para o atributo SVG (custom usa o nome da fonte enviada; senão Roboto)
  const svgFamily = fp.familyName ? `'${fp.familyName}', 'Roboto', sans-serif` : 'Roboto, sans-serif';
  // Auto-fit: mesmo algoritmo do png-generator (mede em canvas off-screen e encolhe)
  let fontSize=l.fontSize||24;
  mctx.font=`${weight} ${fontSize}px ${fp.family}`;
  let maxW=0; lines.forEach(ln=>{const w=mctx.measureText(ln).width;if(w>maxW)maxW=w;});
  const innerPad=Math.round(fontSize*0.08);

  const _tc=dSvgColor(l.color||'#ffffff');
  let fill=_tc.fill, op=_tc.op;
  if(l.overlay&&l.overlayColor){ fill=dSvgColor(l.overlayColor).fill; op=(l.overlayOpacity!=null?+l.overlayOpacity:1); } // color overlay
  // gradiente no texto: def embutido + fill=url(#id)
  let gradDef='';
  if(l.gradient&&l.gradient.stops&&l.gradient.stops.length&&typeof gGradientSvg==='function'){
    const gid='grdt-'+String(l.id||'x').replace(/[^a-z0-9]/gi,'')+'-'+Math.round(l.x)+'-'+Math.round(l.y);
    gradDef=gGradientSvg(l.gradient, gid); fill='url(#'+gid+')'; op=1;
  }
  const lsAttr=(l.letterSpacing!=null)?` letter-spacing="${l.letterSpacing}"`:''; // tracking
  const stroke=(l.strokeW>0)?` stroke="${dSvgColor(l.strokeColor||'#000').fill}" stroke-width="${l.strokeW}" paint-order="stroke"`:'';
  
  // Realce (caixa de fundo) — espelha o png-generator
  let bgRect='';
  if(l.bg){ const bg=dSvgColor(l.bgColor||'#000'); const br=Math.min(Math.round(fontSize*0.2), l.w/2, l.h/2); bgRect=`<rect x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" rx="${br}" ry="${br}" fill="${bg.fill}" fill-opacity="${bg.op.toFixed(3)}"/>`; }

  if (l.vertical) {
    let maxColChars = 0;
    lines.forEach(ln => { const chars = [...ln]; if(chars.length > maxColChars) maxColChars = chars.length; });
    
    let charStep = fontSize * 1.1;
    let colStep = fontSize * 1.2;
    let maxColH = maxColChars * charStep;
    let totalW = lines.length * colStep;

    if (maxColH > l.h || totalW > l.w) {
      const ratioH = l.h / Math.max(1, maxColH);
      const ratioW = l.w / Math.max(1, totalW);
      const shrinkRatio = Math.min(ratioH, ratioW);
      fontSize = Math.max(8, Math.floor(fontSize * shrinkRatio));
    }

    charStep = fontSize * 1.1;
    colStep = fontSize * 1.2;
    maxColH = maxColChars * charStep;
    totalW = lines.length * colStep;

    const startX = l.x + l.w/2 + totalW/2 - colStep/2;
    const tspans = [];

    lines.forEach((line, i) => {
      const tx = startX - i * colStep;
      const chars = [...line];
      const numChars = chars.length;
      const colH = numChars * charStep;
      
      let ty;
      if(l.textAlign === 'center') {
        ty = l.y + l.h / 2 - colH / 2 + charStep / 2;
      } else if(l.textAlign === 'right') {
        ty = l.y + l.h - colH + charStep / 2;
      } else {
        ty = l.y + charStep / 2;
      }

      chars.forEach((char, j) => {
        const cy = ty + j * charStep;
        tspans.push(`<tspan x="${tx.toFixed(1)}" y="${cy.toFixed(1)}">${gXmlEsc(char)}</tspan>`);
      });
    });

    let linesSvg = '';
    if (l.strikethrough) {
      lines.forEach((line, i) => {
        const tx = startX - i * colStep;
        const chars = [...line];
        const numChars = chars.length;
        const colH = numChars * charStep;
        let ty;
        if(l.textAlign === 'center') {
          ty = l.y + l.h / 2 - colH / 2 + charStep / 2;
        } else if(l.textAlign === 'right') {
          ty = l.y + l.h - colH + charStep / 2;
        } else {
          ty = l.y + charStep / 2;
        }
        linesSvg += `<line x1="${tx.toFixed(1)}" y1="${(ty - charStep/2).toFixed(1)}" x2="${tx.toFixed(1)}" y2="${(ty + colH - charStep/2).toFixed(1)}" stroke="${fill}" stroke-width="${Math.max(2, fontSize * 0.05)}" />`;
      });
    }

    return gradDef + bgRect + `<text font-family="${gXmlEsc(svgFamily)}" font-weight="${weight}"${_itAttr} font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle" fill="${fill}" fill-opacity="${op.toFixed(3)}"${lsAttr}${stroke}>${tspans.join('')}</text>` + linesSvg;
  } else {
    const availW=Math.max(10, l.w-innerPad*2);
    // Auto-fit horizontal só p/ parágrafo — point text (sem caixa no PSD) não encolhe (1:1).
    if(l.textBox==='box' && maxW>availW){ fontSize=Math.max(8, Math.floor(fontSize*(availW/maxW))); }
    const lineHeight=fontSize*(l.lineHeight||1.2);
    const totalH=lineHeight*lines.length;
    // vAlign 'top' (PSD): ancora o topo do texto em l.y; senão centraliza no bloco.
    const _vTop=(l.vAlign==='top');
    const _domBase=_vTop?'text-before-edge':'middle';
    const blockStartY=_vTop ? l.y : (l.y + l.h/2 - totalH/2 + lineHeight/2);
    const align=l.textAlign||'left';
    const anchor=align==='center'?'middle':align==='right'?'end':'start';
    const tx=align==='center'?l.x+l.w/2:align==='right'?l.x+l.w-innerPad:l.x+innerPad;
    const deco=l.strikethrough?' text-decoration="line-through"':'';
    const tspans=lines.map((ln,i)=>`<tspan x="${tx.toFixed(1)}" y="${(blockStartY+i*lineHeight).toFixed(1)}">${gXmlEsc(ln)}</tspan>`).join('');
    return gradDef+bgRect+`<text font-family="${gXmlEsc(svgFamily)}" font-weight="${weight}"${_itAttr} font-size="${fontSize}" text-anchor="${anchor}" dominant-baseline="${_domBase}" fill="${fill}" fill-opacity="${op.toFixed(3)}"${lsAttr}${deco}${stroke}>${tspans}</text>`;
  }
}
function dSvgImage(l, dados, cid){
  let src=null;
  const vv=l.imgVar?dados[l.imgVar]:null;
  if(vv && typeof vv==='string' && (vv.startsWith('data:image')||/^https?:\/\//.test(vv))) src=vv;
  else if(l.imgUrl && l.imgUrl!=='__local__' && l.imgUrl.length) src=l.imgUrl;
  const clip='clip'+cid;
  let clipShape;
  const kind=l.shapeKind||l.frameShape||'rect';
  const vectorD=(kind==='path'&&typeof gVectorPathD==='function')?gVectorPathD(l.vectorPath,l.x,l.y,l.w,l.h):'';
  if(vectorD){ const rule=gVectorPathFillRule(l.vectorPath); clipShape=`<path d="${vectorD}" fill-rule="${rule}" clip-rule="${rule}"/>`; }
  else if(kind==='circle'||kind==='ellipse') clipShape=`<ellipse cx="${l.x+l.w/2}" cy="${l.y+l.h/2}" rx="${l.w/2}" ry="${l.h/2}"/>`;
  else { const r=Math.min(l.radius||0, l.w/2, l.h/2); clipShape=`<rect x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" rx="${r}" ry="${r}"/>`; }
  const defs=`<clipPath id="${clip}">${clipShape}</clipPath>`;
  if(!src) return {defs, body:`<rect x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" fill="#ffffff" fill-opacity="0.06" clip-path="url(#${clip})"/>`};
  const par=(l.objectFit==='contain')?'xMidYMid meet':'xMidYMid slice';
  return {defs, body:`<image x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" preserveAspectRatio="${par}" href="${gXmlEsc(src)}" clip-path="url(#${clip})"/>`};
}
// Embute a fonte Roboto (subset latin, pesos 400/700/900) como @font-face base64. Cacheado.
const _dSvgFontCache={};
function _dB64(buf){ let bin='';const b=new Uint8Array(buf),chunk=0x8000; for(let i=0;i<b.length;i+=chunk)bin+=String.fromCharCode.apply(null,b.subarray(i,i+chunk)); return btoa(bin); }
async function dSvgFontFace(){
  if(_dSvgFontCache.css!==undefined) return _dSvgFontCache.css;
  try{
    const cssTxt=await (await fetch('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700;900')).text();
    const blockRe=/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g;
    let out='', m;
    while((m=blockRe.exec(cssTxt))){
      if(m[1]!=='latin') continue; // só latin pra não explodir o tamanho
      const face=m[2];
      const urlM=face.match(/url\((https:[^)]+\.woff2)\)/);
      const wM=face.match(/font-weight:\s*(\d+)/);
      if(!urlM) continue;
      const buf=await (await fetch(urlM[1])).arrayBuffer();
      out+=`@font-face{font-family:'Roboto';font-style:normal;font-weight:${wM?wM[1]:'400'};src:url(data:font/woff2;base64,${_dB64(buf)}) format('woff2');}\n`;
    }
    _dSvgFontCache.css=out; return out;
  }catch(e){ _dSvgFontCache.css=''; return ''; }
}
// @font-face das fontes custom usadas pelos layers (4.4 + upload de fontes)
function dSvgCustomFontFaces(layers){
  if(typeof dCustomFonts==='undefined'||!dCustomFonts.length) return '';
  const used=new Set();
  (layers||[]).forEach(l=>{ const fp=dTextFontParts(l.font); if(fp.familyName) used.add(fp.familyName); });
  let css='';
  used.forEach(fam=>{
    const f=dCustomFonts.find(x=>x.family===fam);
    if(f&&f.dataUrl) css+=`@font-face{font-family:'${fam}';font-style:normal;font-weight:${f.weight||400};src:url(${f.dataUrl});}\n`;
  });
  return css;
}
async function dExportSVG(opts){
  opts=opts||{};
  const fmt=opts.fmt||dFmt;
  const dados=opts.dados||{};
  const fillVars=!!opts.fillVars;
  const includeFont=opts.includeFont!==false;
  const includePaint=opts.includePaint!==false;
  // Tamanho real da prancheta (fmt sem preset, ex. PSD 1:1 'orig', caía em story
  // 1080×1920 com as camadas posicionadas pro tamanho real → arte deslocada/cortada)
  const _ab=(typeof dGetActiveAB==='function')?dGetActiveAB():null;
  const _cur=_ab?{w:_ab.w,h:_ab.h}:(DFMT_SIZES[dFmt]||DFMT_SIZES.story);
  const f=DFMT_SIZES[fmt]||_cur;
  const W=f.w, H=f.h;
  gToast('Gerando SVG…');
  if(document.fonts&&document.fonts.ready){ try{ await document.fonts.ready; }catch(e){} }
  const defaults=(typeof gVarDefaults==='function')?gVarDefaults():null;
  const mctx=document.createElement('canvas').getContext('2d');
  // Export num formato ≠ prancheta atual → smart resize (igual ao PNG em pvRenderToBlob)
  let _srcLayers=dLayers;
  if((_cur.w!==W||_cur.h!==H)&&typeof gReflowLayers==='function')
    _srcLayers=gReflowLayers(dLayers,_cur,{w:W,h:H},{fmtKey:(typeof gFmtKey==='function')?gFmtKey(fmt):null});
  // bindings (4.1) + regras (4.2) com os dados (vazio no modo template)
  let layers=_srcLayers.map(l=>{
    let e=(typeof gApplyBindings==='function')?gApplyBindings(l,dados,{defaults}):l;
    e=(typeof gApplyRules==='function')?gApplyRules(e,dados,{defaults}):e;
    return e;
  });
  if(typeof gApplyRelativeAnchors==='function'){
    // Sem `fitText`: o layout vivo é do lado do franqueado (ver gLayoutVivoAtivo). Esta prévia
    // é do designer e mostra a geometria desenhada.
    layers=gApplyRelativeAnchors(layers,dados,defaults);
  }
  layers=layers.filter(l=>l.visible!==false);
  let defs='', body='', cid=0;
  for(const l of layers){
    if(fillVars&&l.type==='text'&&typeof gAllVarsEmpty==='function'&&gAllVarsEmpty(l.content,dados,defaults)) continue;
    let frag='';
    if(l.type==='shape') frag=dSvgShape(l);
    else if(l.type==='text') frag=dSvgText(l, mctx, fillVars, dados, defaults);
    else if(l.type==='frame'||l.type==='image'){ const r=dSvgImage(l, dados, ++cid); defs+=r.defs; frag=r.body; }
    // Efeitos (sombra projetada/interna, brilho ext/int, chanfro) via <filter>
    if(frag && (l.shadow||l.glow||l.innerShadow||l.innerGlow||l.bevel)){ const fx=dSvgFx(l, ++cid); if(fx.attr){ defs+=fx.defs; frag=`<g${fx.attr}>${frag}</g>`; } }
    // máscara de camada → <mask type alpha> envolvendo o fragmento
    if(l.mask && frag){
      const mid='mk'+(++cid);
      defs+=`<mask id="${mid}" maskUnits="userSpaceOnUse" style="mask-type:alpha"><image x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" preserveAspectRatio="none" href="${l.mask}"/></mask>`;
      frag=`<g mask="url(#${mid})">${frag}</g>`;
    }
    // Blend mode: usa mix-blend-mode quando há equivalente CSS (DBLEND_TO_CSS).
    // Modos sem CSS (linearBurn, vividLight, linearLight, pinLight, hardMix,
    // subtract, divide, darkerColor, lighterColor, linearDodge) são exportados
    // sem blend no SVG — limitação do formato; use PNG para esses modos.
    if(frag&&l.blendMode&&l.blendMode!=='normal'&&typeof DBLEND_TO_CSS!=='undefined'){
      const _svgBlend=DBLEND_TO_CSS[l.blendMode];
      if(_svgBlend) frag=`<g style="mix-blend-mode:${_svgBlend}">${frag}</g>`;
    }
    body+=frag;
  }
  if(includePaint){
    const paint=document.getElementById('d-paint-canvas');
    if(paint&&paint.width>0){ try{ body+=`<image x="0" y="0" width="${W}" height="${H}" href="${paint.toDataURL('image/png')}"/>`; }catch(e){} }
  }
  let fontCss='';
  if(includeFont) fontCss=await dSvgFontFace();
  // Embute também as fontes enviadas pelo usuário que aparecem nos layers (base64 já pronto)
  fontCss += dSvgCustomFontFaces(layers);
  const styleBlock=fontCss?`<style type="text/css"><![CDATA[\n${fontCss}]]></style>`:'';
  const defsBlock=(styleBlock||defs)?`<defs>${styleBlock}${defs}</defs>`:'';
  const svg=`<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defsBlock}${body}</svg>`;
  const blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  const base=((typeof dBuildTemplateFilename==='function')?dBuildTemplateFilename(fmt):'arte').replace(/\.png$/i,'');
  a.download=base+(fillVars?'_preenchido':'_template')+'.svg';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  gToast('SVG exportado'+(fillVars?'':' (com {{variáveis}})'));
}

/* Atalho P para abrir preview */

// --- NOVA MODAL DE EXPORTAÇÃO EM LOTE ---

let dExportSelectedFmt = 'image/png';

function dOpenExportModal() {
  const modal = document.getElementById('d-export-modal');
  if(!modal) return;
  modal.classList.add('open');
  dRenderExportArtboardsList();
}

function dSetExportFmt(fmt, btn) {
  dExportSelectedFmt = fmt;
  document.querySelectorAll('.d-export-fmt-btn').forEach(b => b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  
  // Se for SVG, desabilitar escala
  const scaleSelect = document.getElementById('d-export-scale');
  if(scaleSelect) {
    if(fmt === 'svg') {
      scaleSelect.disabled = true;
      scaleSelect.style.opacity = '0.5';
    } else {
      scaleSelect.disabled = false;
      scaleSelect.style.opacity = '1';
    }
  }
}

function dRenderExportArtboardsList() {
  const container = document.getElementById('d-export-artboards-list');
  if(!container) return;
  container.innerHTML = '';
  
  if(typeof dArtboards === 'undefined' || !dArtboards || dArtboards.length === 0) {
    document.getElementById('d-export-count').textContent = 'Nenhuma prancheta';
    return;
  }
  
  document.getElementById('d-export-count').textContent = dArtboards.length + (dArtboards.length === 1 ? ' prancheta' : ' pranchetas');
  
  dArtboards.forEach((ab, idx) => {
    const div = document.createElement('div');
    div.style.cssText = 'background:#2A2A2A; border:1px solid #444; border-radius:8px; padding:10px; display:flex; align-items:center; gap:10px; cursor:pointer;';
    div.onclick = function(e) {
      if(e.target.tagName !== 'INPUT') {
        const cb = this.querySelector('input[type="checkbox"]');
        if(cb) {
          cb.checked = !cb.checked;
          dUpdateExportSelectAllState();
        }
      }
    };
    
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'd-export-ab-cb';
    cb.value = ab.id;
    cb.checked = true;
    cb.style.accentColor = '#FF9000';
    cb.style.width = '16px';
    cb.style.height = '16px';
    cb.style.cursor = 'pointer';
    cb.onchange = dUpdateExportSelectAllState;
    
    const label = document.createElement('span');
    label.textContent = ab.name || ('Prancheta ' + (idx+1));
    label.style.color = '#fff';
    label.style.fontSize = '13px';
    label.style.whiteSpace = 'nowrap';
    label.style.overflow = 'hidden';
    label.style.textOverflow = 'ellipsis';
    
    div.appendChild(cb);
    div.appendChild(label);
    container.appendChild(div);
  });
  
  const checkAll = document.getElementById('d-export-check-all');
  if(checkAll) checkAll.checked = true;
}

function dToggleAllExportArtboards(checkbox) {
  const cbs = document.querySelectorAll('.d-export-ab-cb');
  cbs.forEach(cb => cb.checked = checkbox.checked);
}

function dUpdateExportSelectAllState() {
  const cbs = document.querySelectorAll('.d-export-ab-cb');
  const allChecked = Array.from(cbs).every(cb => cb.checked);
  const checkAll = document.getElementById('d-export-check-all');
  if(checkAll) checkAll.checked = allChecked;
}

async function dConfirmExport() {
  const cbs = document.querySelectorAll('.d-export-ab-cb:checked');
  if(cbs.length === 0) {
    if(typeof gToast === 'function') gToast('Selecione pelo menos uma prancheta.');
    return;
  }
  
  const scaleSelect = document.getElementById('d-export-scale');
  const scale = scaleSelect ? (parseInt(scaleSelect.value, 10) || 2) : 2;
  const fmt = dExportSelectedFmt;
  
  const modal = document.getElementById('d-export-modal');
  if(modal) modal.classList.remove('open');
  
  if(typeof gToast === 'function') gToast(`Iniciando exportação de ${cbs.length} prancheta(s)...`);
  
  // Salva estado atual se estiver em modo pranchetas
  if (typeof dSyncLayersToAB === 'function') dSyncLayersToAB();
  const originalAbId = typeof dActiveABId !== 'undefined' ? dActiveABId : null;
  
  for(let i = 0; i < cbs.length; i++) {
    const abId = cbs[i].value;
    
    // Troca para a prancheta atual se dArtboards e variáveis relacionadas existirem
    if (typeof dArtboards !== 'undefined' && dArtboards) {
       const ab = dArtboards.find(a => a.id === abId);
       if(ab && dActiveABId !== abId) {
          dActiveABId = ab.id;
          dLayers = JSON.parse(JSON.stringify(ab.layers || []));
          if(typeof dFmt !== 'undefined') dFmt = ab.fmt || dFmt;
          if(typeof dApplyFormat === 'function') dApplyFormat();
          if(typeof dRenderCanvas === 'function') dRenderCanvas();
          await new Promise(r => setTimeout(r, 200)); // dar tempo de renderizar / carregar imgs
       }
    }
    
    // Configura formato e escala para a preview/SVG
    if(fmt === 'svg') {
      if(typeof dExportSVGFilled === 'function') {
         dExportSVGFilled(); 
      }
    } else {
      if(typeof dPreviewSetScale === 'function') dPreviewSetScale(scale);
      if(typeof dPreviewSetType === 'function') dPreviewSetType(fmt);
      if(typeof dPreviewDownload === 'function') {
         dPreviewDownload(null);
      }
    }
    await new Promise(r => setTimeout(r, 600)); // Tempo razoável para download e processamento
  }

/* O botão "PSD (Photoshop)" saiu em 05/09 (estudo de fidelidade §5.9, ticket 6). Ele não
   escrevia PSD nenhum: rodava uma barra de progresso encenada ("Empacotando estrutura .PSD…"),
   chamava o MESMO `dExportSVGFilled()` do botão SVG ao lado e avisava "Arquivo do Photoshop
   (.PSD) exportado com sucesso". Entregava um .svg anunciando .psd — a interface tem que
   prometer o que entrega. Escrever PSD de verdade é outra iniciativa, não um rótulo. */

  // Restaura a prancheta original
  if (typeof dArtboards !== 'undefined' && originalAbId && originalAbId !== dActiveABId) {
       const ab = dArtboards.find(a => a.id === originalAbId);
       if(ab) {
          dActiveABId = ab.id;
          dLayers = JSON.parse(JSON.stringify(ab.layers || []));
          if(typeof dFmt !== 'undefined') dFmt = ab.fmt || dFmt;
          if(typeof dApplyFormat === 'function') dApplyFormat();
          if(typeof dRenderCanvas === 'function') dRenderCanvas();
       }
  }
  
  if(typeof gToast === 'function') gToast('Exportação concluída!');
}
