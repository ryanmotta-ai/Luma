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
let pvFmt=null, pvDevice='none', pvRendering=false;
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
  if(pvRendering)return;
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
  pvRenderLayers(ctx, renderQueue, W, H, 0, ()=>{
    // Sobrepor paint canvas se existir
    const paintCv=document.getElementById('d-paint-canvas');
    if(paintCv&&paintCv.width>0){
      ctx.drawImage(paintCv,0,0,W,H);
    }
    pvRendering=false;
    if(note)note.textContent=`${W}×${H}px · escala ${Math.round(scale*100)}%`;
    pvApplyDevice();
  });
}

function pvRenderLayers(ctx, layers, W, H, idx, done){
  if(idx>=layers.length){done();return;}
  const l=layers[idx];
  const cont=()=>pvRenderLayers(ctx,layers,W,H,idx+1,done);
  if(l.mask){
    // máscara: renderiza isolado, aplica alpha (destination-in) e composita
    const oc=document.createElement('canvas'); oc.width=ctx.canvas.width; oc.height=ctx.canvas.height;
    const octx=oc.getContext('2d'); try{octx.setTransform(ctx.getTransform());}catch(e){}
    pvRenderLayer(octx,l,W,H,()=>{
      const m=new Image();
      const composite=()=>{ ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.drawImage(oc,0,0); ctx.restore(); cont(); };
      m.onload=()=>{ octx.save(); octx.globalCompositeOperation='destination-in'; octx.drawImage(m,l.x,l.y,l.w,l.h); octx.restore(); composite(); };
      m.onerror=composite;
      m.src=l.mask;
    });
  } else pvRenderLayer(ctx,l,W,H,cont);
}

function pvRenderLayer(ctx, l, W, H, next){
  ctx.save();
  ctx.globalAlpha=(l.opacity!=null?l.opacity:100)/100;

  if(l.type==='shape'){
    ctx.fillStyle=l.fill||'#FF9000';
    const kind=l.shapeKind||'rect';
    if(kind==='circle'||kind==='ellipse'){
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
    ctx.restore();next();

  }else if(l.type==='text'){
    // Substituir {{var}} por [Rótulo] usando a regex/interpolador únicos (3.1)
    const _lbl={};
    (l.content||'').replace(gVarRegex(),(_,vn)=>{const v=(dVars||[]).find(x=>x.name===vn);_lbl[vn]='['+(v?v.label:vn)+']';return _;});
    const raw=gInterpolate(l.content,_lbl,{onEmpty:'keep'});
    const lines=raw.split('\n');
    const _fp=(typeof dTextFontParts==='function')?dTextFontParts(l.font):{family:"'Roboto', sans-serif",weight:900};
    ctx.font=`${_fp.weight} ${l.fontSize||24}px ${_fp.family}`;
    ctx.fillStyle=l.color||'#fff';
    ctx.textAlign=l.textAlign||'left';
    ctx.textBaseline='top';
    if(l.strikethrough){
      // desenhar texto + linha
      lines.forEach((line,i)=>{
        const tx=l.textAlign==='center'?l.x+l.w/2:l.textAlign==='right'?l.x+l.w:l.x;
        const ty=l.y+i*(l.fontSize||24)*1.25;
        ctx.fillText(line,tx,ty);
        const tw=ctx.measureText(line).width;
        const lx=l.textAlign==='center'?tx-tw/2:l.textAlign==='right'?tx-tw:tx;
        ctx.strokeStyle=l.color||'#fff';ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(lx,ty+(l.fontSize||24)*0.55);ctx.lineTo(lx+tw,ty+(l.fontSize||24)*0.55);ctx.stroke();
      });
    }else{
      lines.forEach((line,i)=>{
        const tx=l.textAlign==='center'?l.x+l.w/2:l.textAlign==='right'?l.x+l.w:l.x;
        const ty=l.y+i*(l.fontSize||24)*1.25;
        ctx.fillText(line,tx,ty);
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
        ctx.drawImage(img,sx,sy,sw,sh);
        ctx.restore();
        next();
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
  if(r<=0){ctx.rect(x,y,w,h);return;}
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
  if(dLayers.length===0)checks.push({ok:false,msg:'Nenhum layer criado'});
  else checks.push({ok:true,msg:dLayers.length+' layers no template'});
  if(emptyFrames.length)checks.push({ok:false,msg:emptyFrames.length+' moldura(s) sem foto'});
  else if(frames.length)checks.push({ok:true,msg:'Todas as molduras com foto'});
  if(varsInUse.length)checks.push({ok:true,msg:varsInUse.length+' variável(is) configurada(s)'});
  else checks.push({ok:false,msg:'Nenhuma variável em uso'});
  const bgLayer=dLayers.find(l=>l.type==='shape'&&l.x===0&&l.y===0&&l.w>=sz.w*0.9&&l.h>=sz.h*0.9);
  if(bgLayer)checks.push({ok:true,msg:'Fundo de tela configurado'});
  else checks.push({ok:false,msg:'Sem layer de fundo (opcional)'});

  document.getElementById('pv-checklist').innerHTML=checks.map(ch=>`
    <div style="display:flex;align-items:center;gap:7px;padding:4px 0;font-size:11px;color:${ch.ok?'#22C55E':'#FFB900'}">
      <span style="font-size:13px">${ch.ok?'✓':'⚠'}</span>
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
    if(!blob){gToast('⚠ Falha ao gerar o arquivo','error');return;}
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=dExportFilename(fmtKey);
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1500); // M10: libera memória
    gToast('✓ Baixado: '+fmtKey.toUpperCase()+' '+pvExportScale+'×');
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
  pvRenderLayers(ctx,visible,sz.w,sz.h,0,()=>{
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
function dSvgShape(l){
  const layerOp=(l.opacity!=null?l.opacity:100)/100;
  const {fill,op}=dSvgColor(l.fill||'#FF9000');
  const totalOp=(layerOp*op).toFixed(3);
  const kind=l.shapeKind||'rect';
  if(kind==='circle'||kind==='ellipse')
    return `<ellipse cx="${l.x+l.w/2}" cy="${l.y+l.h/2}" rx="${l.w/2}" ry="${l.h/2}" fill="${fill}" fill-opacity="${totalOp}"/>`;
  const pts=(typeof dShapePoints==='function')?dShapePoints(l):null;
  if(pts){
    const abs=pts.map(p=>[l.x+p[0]*l.w, l.y+p[1]*l.h]);
    const r=Math.min(l.radius||0, l.w/2, l.h/2);
    if(r>0 && typeof gRoundPolyD==='function'){
      return `<path d="${gRoundPolyD(abs,r)}" fill="${fill}" fill-opacity="${totalOp}"/>`;
    }
    return `<polygon points="${abs.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')}" fill="${fill}" fill-opacity="${totalOp}"/>`;
  }
  const r=Math.min(l.radius||0, l.w/2, l.h/2);
  return `<rect x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" rx="${r}" ry="${r}" fill="${fill}" fill-opacity="${totalOp}"/>`;
}
function dSvgText(l, mctx, fillVars, dados, defaults){
  const content = fillVars ? gInterpolate(l.content, dados, {onEmpty:'remove', defaults}) : (l.content||'');
  const lines = content.split('\n').filter(s=>s.trim()!=='');
  if(!lines.length) return '';
  const fp=(typeof dTextFontParts==='function')?dTextFontParts(l.font):{family:"'Roboto',sans-serif",weight:900};
  const weight=fp.weight;
  // família para o atributo SVG (custom usa o nome da fonte enviada; senão Roboto)
  const svgFamily = fp.familyName ? `'${fp.familyName}', 'Roboto', sans-serif` : 'Roboto, sans-serif';
  // Auto-fit: mesmo algoritmo do png-generator (mede em canvas off-screen e encolhe)
  let fontSize=l.fontSize||24;
  mctx.font=`${weight} ${fontSize}px ${fp.family}`;
  let maxW=0; lines.forEach(ln=>{const w=mctx.measureText(ln).width;if(w>maxW)maxW=w;});
  const innerPad=Math.round(fontSize*0.08);
  const availW=Math.max(10, l.w-innerPad*2);
  if(maxW>availW){ fontSize=Math.max(8, Math.floor(fontSize*(availW/maxW))); }
  const lineHeight=fontSize*1.2;
  const totalH=lineHeight*lines.length;
  const blockStartY=l.y + l.h/2 - totalH/2 + lineHeight/2;
  const align=l.textAlign||'left';
  const anchor=align==='center'?'middle':align==='right'?'end':'start';
  const tx=align==='center'?l.x+l.w/2:align==='right'?l.x+l.w-innerPad:l.x+innerPad;
  const {fill,op}=dSvgColor(l.color||'#ffffff');
  const deco=l.strikethrough?' text-decoration="line-through"':'';
  const stroke=(l.strokeW>0)?` stroke="${dSvgColor(l.strokeColor||'#000').fill}" stroke-width="${l.strokeW}" paint-order="stroke"`:'';
  // Realce (caixa de fundo) — espelha o png-generator
  let bgRect='';
  if(l.bg){ const bg=dSvgColor(l.bgColor||'#000'); const br=Math.min(Math.round(fontSize*0.2), l.w/2, l.h/2); bgRect=`<rect x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" rx="${br}" ry="${br}" fill="${bg.fill}" fill-opacity="${bg.op.toFixed(3)}"/>`; }
  const tspans=lines.map((ln,i)=>`<tspan x="${tx.toFixed(1)}" y="${(blockStartY+i*lineHeight).toFixed(1)}">${gXmlEsc(ln)}</tspan>`).join('');
  return bgRect+`<text font-family="${gXmlEsc(svgFamily)}" font-weight="${weight}" font-size="${fontSize}" text-anchor="${anchor}" dominant-baseline="middle" fill="${fill}" fill-opacity="${op.toFixed(3)}"${deco}${stroke}>${tspans}</text>`;
}
function dSvgImage(l, dados, cid){
  let src=null;
  const vv=l.imgVar?dados[l.imgVar]:null;
  if(vv && typeof vv==='string' && (vv.startsWith('data:image')||/^https?:\/\//.test(vv))) src=vv;
  else if(l.imgUrl && l.imgUrl!=='__local__' && l.imgUrl.length) src=l.imgUrl;
  const clip='clip'+cid;
  let clipShape;
  if(l.frameShape==='circle') clipShape=`<circle cx="${l.x+l.w/2}" cy="${l.y+l.h/2}" r="${Math.min(l.w,l.h)/2}"/>`;
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
  const f=DFMT_SIZES[fmt]||DFMT_SIZES.story;
  const W=f.w, H=f.h;
  gToast('Gerando SVG…');
  if(document.fonts&&document.fonts.ready){ try{ await document.fonts.ready; }catch(e){} }
  const defaults=(typeof gVarDefaults==='function')?gVarDefaults():null;
  const mctx=document.createElement('canvas').getContext('2d');
  // bindings (4.1) + regras (4.2) com os dados (vazio no modo template)
  const layers=dLayers.map(l=>{
    let e=(typeof gApplyBindings==='function')?gApplyBindings(l,dados,{defaults}):l;
    e=(typeof gApplyRules==='function')?gApplyRules(e,dados,{defaults}):e;
    return e;
  }).filter(l=>l.visible!==false);
  let defs='', body='', cid=0;
  for(const l of layers){
    let frag='';
    if(l.type==='shape') frag=dSvgShape(l);
    else if(l.type==='text') frag=dSvgText(l, mctx, fillVars, dados, defaults);
    else if(l.type==='frame'||l.type==='image'){ const r=dSvgImage(l, dados, ++cid); defs+=r.defs; frag=r.body; }
    // máscara de camada → <mask type alpha> envolvendo o fragmento
    if(l.mask && frag){
      const mid='mk'+(++cid);
      defs+=`<mask id="${mid}" maskUnits="userSpaceOnUse" style="mask-type:alpha"><image x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" preserveAspectRatio="none" href="${l.mask}"/></mask>`;
      frag=`<g mask="url(#${mid})">${frag}</g>`;
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
  const base=(typeof dBuildTemplateFilename==='function')?dBuildTemplateFilename(fmt):'arte';
  a.download=base+(fillVars?'_preenchido':'_template')+'.svg';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  gToast('✓ SVG exportado'+(fillVars?'':' (com {{variáveis}})'));
}

/* Atalho P para abrir preview */

