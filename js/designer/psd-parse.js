/**
 * js/designer/psd-parse.js
 *
 * LEITURA e FIDELIDADE do .psd — a metade do importador que não toca a tela.
 * Carrega o ag-psd, roda o parse em Web Worker (com rebuild fatiado no main thread),
 * e converte cada camada do Photoshop no item intermediário do Luma: texto, forma,
 * gradiente, máscara composta, efeitos, e a decisão de quando rasterizar fiel.
 * Termina em dItemToLayer (item → camada do Luma).
 *
 * A UI de revisão (abas de prancheta, lista de camadas, prévia, relatório de fidelidade)
 * mora em `psd-import.js`, que carrega DEPOIS deste arquivo.
 * Split feito porque o arquivo único passou de 2.400 linhas — parse e UI mudam por
 * motivos diferentes e quase nunca no mesmo commit.
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
// ag-psd devolve o blend mode como chave separada por ESPAÇO ('color burn', 'soft light',
// 'linear dodge'…). O motor de blend (blending.js) e o CSS usam camelCase ('colorBurn'). Sem
// normalizar, modos de 2+ palavras não eram aplicados (nem na arte final nem no preview) —
// dBlendToComposite('color burn') caía em undefined. DBLEND_PSD_MAP faz a ponte.
function _dPsdBlendMode(bm){
  if(!bm || bm==='normal' || bm==='passThrough') return undefined;
  if(typeof DBLEND_PSD_MAP==='undefined') return undefined;
  if(DBLEND_PSD_MAP[bm]) return DBLEND_PSD_MAP[bm];           // nome com espaço ("color burn") → camelCase
  // ag-psd já em camelCase: aceita SÓ se for um modo conhecido. Um modo sem render (ex.: "dissolve")
  // vira Normal explícito — senão o badge "Mesclagem · dissolve" mentia (renderizava normal).
  return (Object.values(DBLEND_PSD_MAP).indexOf(bm)>=0) ? bm : undefined;
}
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
// Estilo de PARÁGRAFO efetivo (paragraphStyle ou o 1º run) — a fonte do alinhamento e do
// fator de auto-entrelinha. Um só leitor para os dois (não duplicar a mesma navegação).
function _dPsdParaStyle(t){
  return (t&&t.paragraphStyle)||(t&&t.paragraphStyleRuns&&t.paragraphStyleRuns[0]&&t.paragraphStyleRuns[0].style)||{};
}
// Alinhamento. ag-psd devolve 7 valores: left|right|center|justify-left|justify-right|
// justify-center|justify-all. Os quatro "justify-*" já carregam o alinhamento da ÚLTIMA linha —
// é esse que usamos, porque NENHUM dos renderizadores do Luma distribui palavras na largura da
// caixa. Devolve `justified` junto para a revisão avisar (perda calada é pior que perda avisada).
function _dPsdAlign(t){
  const p=_dPsdParaStyle(t);
  const j=String(p.justification||p.align||'left').toLowerCase();
  const justified=j.indexOf('justify')>=0;
  const justifyAll=(j==='justify-all'); // estica TODAS as linhas, inclusive a última
  if(j.includes('center')||j.includes('middle')) return {align:'center', justified, justifyAll};
  if(j.includes('right')) return {align:'right', justified, justifyAll};
  return {align:'left', justified, justifyAll};
}
// Escala vertical do transform de texto. Robusta a rotação/cisalhamento: usa a magnitude do
// vetor-y da matriz (c,d) em vez de só |d|. Fallback 1.
function _dPsdFontScale(tr){
  if(!tr || tr.length<4) return 1;
  const c=+tr[2]||0, d=+tr[3]||0, s=Math.sqrt(c*c+d*d);
  return (isFinite(s)&&s>0)?s : (Math.abs(d)||1);
}
// #4b — fontSize robusto e DETERMINÍSTICO: fontSize(pt) × escala(transform) × DPI(res/72),
// aplicado de forma CONSISTENTE para box e point (antes divergiam). Só cai na caixa quando o
// tamanho real é ausente/implausível — preservando o tamanho 1:1 do Photoshop.
function _dPsdFontSize(t,h,content,res){
  const s=_dPsdTextStyle(t);
  const _tScale=_dPsdFontScale(t&&t.transform);
  let fs=(s.fontSize||s.size||0)*_tScale;
  // DPI: o fontSize vem em pontos; em doc hi-res (res≠72) escala p/ px. Só dobra quando o TRANSFORM
  // ainda não trouxe a escala (tScale≈1) — senão dobraria. Antes o teto absoluto fs<200 deixava
  // títulos grandes (ex.: 220pt a 300dpi) sem escalar, saindo 4× menores que o desenhado.
  if(res>90 && fs>0 && _tScale<1.5) fs*=(res/72);
  // PARÁGRAFO (box): a caixa é fixa/alta → confia sempre no tamanho real do designer.
  if(t && t.shapeType==='box' && fs>=6 && fs<=2000) return Math.round(Math.max(8,Math.min(fs,2000)));
  // POINT: confia no tamanho real; só ancora na caixa (bbox de glifos) se o valor for implausível.
  const nLines=Math.max(1, String(content||'').split('\n').filter(x=>x.trim()).length);
  const boxFs=Math.min(h/(nLines*1.25), 180); // cap 180px evita caixas altas gerarem fs gigante
  if(fs>=4 && fs<=4000){
    if(fs < boxFs*0.4 || fs > boxFs*2.5) fs=boxFs; // real incoerente vs bbox → usa a caixa
    return Math.round(Math.max(8,fs));
  }
  if(h < 12) return 12; // caixa muito pequena → mínimo razoável
  return Math.round(Math.max(8,boxFs));
}
// Caixa de PARÁGRAFO (box text): deriva {x,y,w,h} em px ABSOLUTOS do doc — a caixa 1:1 que o
// designer desenhou no Photoshop, para NÃO reencaixar/encolher o texto na importação.
// ag-psd expõe a caixa em text-space por duas vias (boxBounds via EngineData e bounds via
// descriptor TySh), mais o transform afim. O espaço de cada uma varia entre versões/arquivos,
// então geramos TODOS os candidatos (cada fonte × {transform, cru}) e escolhemos por SCORE
// (o quão bem a caixa "abraça" o bbox de glifos do layer) em vez de aceitar/rejeitar no grito.
// Isso recupera a caixa real mesmo quando ela é maior que os glifos (caso comum) — o antigo
// teste de contenção estrita rejeitava e caía no bbox apertado, quebrando a hierarquia textual.
function _dPsdParagraphBox(node){
  try{
    const t=node.text; if(!t) return null;
    const tr=(t.transform&&t.transform.length>=6)?t.transform:[1,0,0,1,0,0];
    const a=tr[0],b=tr[1],c=tr[2],d=tr[3],e=tr[4],f=tr[5];
    const gx0=node.left||0, gy0=node.top||0, gx1=node.right||0, gy1=node.bottom||0;
    const gw=Math.max(1,gx1-gx0), gh=Math.max(1,gy1-gy0), gArea=gw*gh;
    // Normaliza as fontes de caixa em {left,top,right,bottom}
    const norm=bb=>{
      if(!bb) return null;
      if(Array.isArray(bb)) bb={left:bb[0],top:bb[1],right:bb[2],bottom:bb[3]};
      if(bb.left==null||bb.right==null||bb.top==null||bb.bottom==null) return null;
      return bb;
    };
    const sources=[norm(t.boxBounds), norm(t.bounds)].filter(Boolean);
    if(!sources.length) return null;
    const corners=(bb,map)=>{
      const p=[map(bb.left,bb.top),map(bb.right,bb.top),map(bb.right,bb.bottom),map(bb.left,bb.bottom)];
      let mnX=Infinity,mnY=Infinity,mxX=-Infinity,mxY=-Infinity;
      p.forEach(q=>{ if(q[0]<mnX)mnX=q[0]; if(q[0]>mxX)mxX=q[0]; if(q[1]<mnY)mnY=q[1]; if(q[1]>mxY)mxY=q[1]; });
      return {x:mnX,y:mnY,w:mxX-mnX,h:mxY-mnY};
    };
    const cands=[];
    sources.forEach(bb=>{
      cands.push(Object.assign(corners(bb,(x,y)=>[a*x+c*y+e, b*x+d*y+f]), {isTransformed:true})); // text-space → doc (transform)
      cands.push(Object.assign(corners(bb,(x,y)=>[x,y]), {isTransformed:false})); // já em px de doc (cru)
    });
    const maxW=Math.max(gw*8,6000), maxH=Math.max(gh*8,6000);
    // Score: exige dimensão sã e que a caixa contenha ao menos metade do bbox de glifos.
    // Prefere caixa transformada (com escala) se cobrir a mesma área que a crua,
    // desempata priorizando o canto superior-esquerdo, ignorando a penalidade pura de área.
    const score=box=>{
      if(!box||!isFinite(box.w)||!isFinite(box.h)||box.w<=1||box.h<=1) return -Infinity;
      if(box.w>maxW||box.h>maxH) return -Infinity;
      const ix=Math.max(0, Math.min(box.x+box.w,gx1)-Math.max(box.x,gx0));
      const iy=Math.max(0, Math.min(box.y+box.h,gy1)-Math.max(box.y,gy0));
      const cover=(ix*iy)/gArea;             // 1.0 = contém todo o bbox de glifos
      if(cover<0.5) return -Infinity;        // caixa longe/torta dos glifos → descarta
      const dCorner=Math.abs(box.x-gx0)+Math.abs(box.y-gy0);
      return cover*1000 - dCorner*0.01 + (box.isTransformed ? 50 : 0);
    };
    let best=null,bestScore=-Infinity;
    cands.forEach(box=>{ const s=score(box); if(s>bestScore){ bestScore=s; best=box; } });
    if(!best || bestScore===-Infinity) return null;
    return {x:Math.round(best.x),y:Math.round(best.y),w:Math.round(best.w),h:Math.round(best.h)};
  }catch(e){ return null; }
}
// Ângulo da LUZ GLOBAL do documento (psd.imageResources.globalAngle). No Photoshop "Usar luz
// global" vem LIGADO por padrão: nesse caso o ângulo que vale é este, não o gravado no efeito
// (que fica defasado). Sem isto, as sombras importavam apontando pro lado errado.
let _dPsdGlobalLight=null;
function _dPsdReadGlobalLight(psd){
  try{
    const g=(psd&&psd.imageResources&&psd.imageResources.globalAngle);
    const v=(g!=null)?g:(psd&&psd.globalAngle);
    return (v!=null && isFinite(+v)) ? +v : null;
  }catch(e){ return null; }
}
// #2 — efeitos de camada (layer.effects) → props da Luma. Lê sombra projetada, sombra interna,
// brilho externo, sobreposição de cor e contorno (com alinhamento). _u: parseUnits → {value} ou número.
function _dPsdEffects(node){
  const fx=node.effects||{}; const out={};
  const _u=v=>{ if(v==null) return 0; return (v.value!=null)?+v.value:+v; };
  // Ângulo efetivo do efeito: luz global vence quando o efeito pede por ela.
  const _ang=e=>{
    if(e.useGlobalLight && _dPsdGlobalLight!=null) return Math.round(_dPsdGlobalLight);
    return (e.angle!=null)?Math.round(e.angle):null;
  };
  // Pega o 1º efeito de um array e marca _fxOverflow quando há vários do mesmo tipo (PS CC permite
  // 2+ sombras/traços; o modelo Luma só representa um). _fxOverflow é consumido no fim do parse →
  // a camada rasteriza fiel (senão o 2º+ efeito sumiria em silêncio).
  const _first=x=>{ if(Array.isArray(x)){ const on=x.filter(e=>e&&e.enabled!==false); if(on.length>1) out._fxOverflow=true; return on[0]||x[0]; } return x; };
  // Sombra projetada
  let ds=_first(fx.dropShadow);
  if(ds && ds.enabled!==false){
    out.shadow=true;
    out.shadowColor=gFxRgba(_dPsdHex(ds.color)||'#000000', ds.opacity!=null?ds.opacity:.5);
    out.shadowBlur=Math.round(_u(ds.size));
    out.shadowDist=Math.round(_u(ds.distance));
    const _a=_ang(ds); if(_a!=null) out.shadowAngle=_a;
    // choke = "propagação" do PS: dilata a silhueta ANTES do desfoque. Sem ela, sombra
    // dura/marcada importava difusa demais.
    if(_u(ds.choke)>0) out.shadowSpread=Math.round(_u(ds.choke));
  }
  // Sombra interna
  let is=_first(fx.innerShadow);
  if(is && is.enabled!==false){
    out.innerShadow=true;
    out.innerShadowColor=gFxRgba(_dPsdHex(is.color)||'#000000', is.opacity!=null?is.opacity:.5);
    out.innerShadowBlur=Math.round(_u(is.size));
    out.innerShadowDist=Math.round(_u(is.distance));
    const _ai=_ang(is); if(_ai!=null) out.innerShadowAngle=_ai;
    if(_u(is.choke)>0) out.innerShadowSpread=Math.round(_u(is.choke));
  }
  // Brilho externo
  let og=_first(fx.outerGlow);
  if(og && og.enabled!==false){
    out.glow=true;
    out.glowColor=gFxRgba(_dPsdHex(og.color)||'#ffffff', og.opacity!=null?og.opacity:.6);
    out.glowSize=Math.max(1,Math.round(_u(og.size)));
    if(_u(og.choke)>0) out.glowSpread=Math.round(_u(og.choke));
  }
  // Brilho interno (inner glow)
  let ig=_first(fx.innerGlow);
  if(ig && ig.enabled!==false){
    out.innerGlow=true;
    out.innerGlowColor=gFxRgba(_dPsdHex(ig.color)||'#ffffff', ig.opacity!=null?ig.opacity:.6);
    out.innerGlowSize=Math.max(1,Math.round(_u(ig.size)));
  }
  // Chanfro/relevo (bevel & emboss) → aprox.: realce + sombra internos
  let bv=_first(fx.bevel);
  if(bv && bv.enabled!==false){
    out.bevel=true;
    out.bevelSize=Math.max(1,Math.round(_u(bv.size)));
    if(bv.angle!=null) out.bevelAngle=Math.round(bv.angle);
    out.bevelHighlight=gFxRgba(_dPsdHex(bv.highlightColor)||'#ffffff', bv.highlightOpacity!=null?bv.highlightOpacity:.75);
    out.bevelShadow=gFxRgba(_dPsdHex(bv.shadowColor)||'#000000', bv.shadowOpacity!=null?bv.shadowOpacity:.75);
  }
  // Sobreposição de cor (color overlay / solidFill)
  let so=_first(fx.solidFill);
  if(so && so.enabled!==false && so.color){
    out.overlay=true;
    out.overlayColor=_dPsdHex(so.color)||'#000000';
    out.overlayOpacity=(so.opacity!=null?+so.opacity:1);
    // blendMode do efeito (multiply/screen/etc). O overlay simples (substituição de cor) falsearia →
    // overlayBlend é consumido no fim do parse e força rasterização fiel da camada.
    if(so.blendMode && so.blendMode!=='normal') out.overlayBlend=so.blendMode;
  }
  // Sobreposição de gradiente (gradient overlay)
  let go2=_first(fx.gradientOverlay);
  if(go2 && go2.enabled!==false && go2.gradient && go2.gradient.colorStops){
    const src=go2.gradient;
    let goStops=src.colorStops.map(s=>({color:_dPsdHex(s.color)||'#000000', pos:Math.max(0,Math.min(1,s.location||0)), opacity:_dPsdOpacityAt(src.opacityStops, s.location||0)}));
    if(src.reverse){ goStops=goStops.map(s=>({...s,pos:1-s.pos})).reverse(); }
    const _gs=_dPsdGradStyle(go2.type||src.style, goStops);
    out.gradientOverlay={
      type:_gs.type,
      angle:Math.round(-(go2.angle!=null?go2.angle:90)), // PS anti-horário → Luma horário
      opacity:(go2.opacity!=null?+go2.opacity:1),
      stops:_gs.stops
    };
    // Efeito ≠ preenchimento: o pixel do node.canvas NÃO traz a sobreposição, então rasterizar
    // não salvaria o cônico/losango. Só resta avisar.
    if(_gs.unsupported) out.gradientOverlayApprox=_gs.unsupported;
    if(go2.blendMode && go2.blendMode!=='normal') out.gradientOverlay.blendMode=go2.blendMode;
  }
  // Contorno (frame FX) + alinhamento
  let st=_first(fx.stroke);
  if(st && st.enabled!==false){
    // +_sv||2: size pode vir {value:0}/unidade estranha — sem o guard, Math.round(objeto)=NaN
    const _sv=(st.size&&st.size.value!=null)?st.size.value:st.size;
    out.strokeW=Math.max(1,Math.round(+_sv||2));
    // Traço com GRADIENTE/PADRÃO: o modelo só tem cor sólida e st.color vem vazio — o traço
    // virava PRETO, que é pior que qualquer aproximação. Usa o 1º stop do gradiente e avisa.
    let _stHex=_dPsdHex((st.color&&(st.color.color||st.color)));
    if(!_stHex && st.gradient && st.gradient.colorStops && st.gradient.colorStops.length){
      _stHex=_dPsdHex(st.gradient.colorStops[0].color); out.strokeApprox=true;
    }
    if(!_stHex && st.fillType && st.fillType!=='color') out.strokeApprox=true; // padrão: sem cor amostrável
    out.strokeColor=_stHex||'#000000';
    if(st.position) out.strokeAlign=({inside:'inside',insetFrame:'inside',center:'center',centeredFrame:'center',outside:'outside',outsetFrame:'outside'}[st.position])||'outside';
  }
  // Efeitos que o Luma NÃO representa. Rasterizar não adianta: efeito de camada é vetorial no PS
  // e NÃO está no node.canvas — a imagem sairia sem ele do mesmo jeito. Então a saída honesta é
  // registrar e avisar na revisão, em vez de sumir calado.
  const _sat=_first(fx.satin);
  if(_sat && _sat.enabled!==false) out.fxSatin=true;                       // Cetim: sem equivalente
  // Atenção à unidade: sem unidade o ag-psd devolve FRAÇÃO (1 = 100%, o padrão). Ler isso como
  // porcentagem fazia todo PSD com efeito acusar "escala a 1%".
  const _sclRaw=(fx.scale&&fx.scale.value!=null)?+fx.scale.value:+fx.scale;
  if(isFinite(_sclRaw) && _sclRaw>0){
    const _pct=(fx.scale&&fx.scale.units==='Percent')?_sclRaw:_sclRaw*100;
    if(Math.round(_pct)!==100) out.fxScale=Math.round(_pct);
  }
  // Contorno customizado muda o PERFIL do fade (curva !== linear padrão).
  const _hasCont=e=>!!(e && e.enabled!==false && e.contour && ((e.contour.curve && e.contour.curve.length>2) || (e.contour.name&&!/^linear$/i.test(e.contour.name))));
  if(_hasCont(ds)||_hasCont(is)||_hasCont(og)||_hasCont(ig)) out.fxContour=true;
  return out;
}
// Cor sólida EXATA de uma camada de forma/preenchimento (vectorFill type='color').
// É a cor que o designer definiu — fiel 1:1, sem o erro de amostrar pixels (anti-aliasing,
// opacidade, blend). Retorna hex ou null (aí cai na amostragem de pixels como fallback).
function _dPsdVectorSolidColor(node){
  try{ const vf=node&&node.vectorFill; if(vf && vf.type==='color' && vf.color) return _dPsdHex(vf.color); }catch(e){}
  return null;
}
// Tipo de forma EXATO via vectorOrigination.keyOriginType (1=retângulo, 2=retângulo arredondado,
// 4=elipse). Mais fiel que inferir por pixels. Retorna {kind,radius} ou null (cai no heurístico).
function _dPsdVectorShapeKind(node, w, h){
  try{
    const list=node&&node.vectorOrigination&&node.vectorOrigination.keyDescriptorList;
    if(!list||!list.length) return null;
    let ot=null; for(let i=0;i<list.length;i++){ if(list[i]&&list[i].keyOriginType!=null){ ot=list[i].keyOriginType; break; } }
    if(ot==null) return null;
    if(ot===4){ const r=w/h; return {kind:(r>0.85&&r<1.18)?'circle':'ellipse', radius:0}; } // elipse/círculo
    if(ot===1||ot===2) return {kind:'rect', radius:0}; // retângulo (raio por-canto vem de _dPsdCornerRadii)
    return null; // linha/custom → deixa o heurístico de pixel decidir
  }catch(e){ return null; }
}
// Caixa do CAMINHO vetorial, diferente de node.left/top/right/bottom (que inclui a expansão do
// stroke). Usar o bounds do layer como path deslocava um contorno de 5px ~4px para fora.
function _dPsdVectorShapeBox(node, ox, oy){
  try{
    const list=node&&node.vectorOrigination&&node.vectorOrigination.keyDescriptorList;
    if(!list)return null;
    for(const d of list){
      const b=d&&d.keyOriginShapeBoundingBox; if(!b)continue;
      const v=x=>(x&&x.value!=null)?+x.value:+x;
      const l=v(b.left),t=v(b.top),r=v(b.right),bt=v(b.bottom);
      if([l,t,r,bt].every(Number.isFinite)&&r>l&&bt>t)return{x:Math.round(l-(ox||0)),y:Math.round(t-(oy||0)),w:Math.max(1,Math.round(r-l)),h:Math.max(1,Math.round(bt-t))};
    }
  }catch(e){}
  return null;
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
// opts opcional {maxPx, q}: camadas que SÓ existem como raster fiel (warp, smart object, padrão)
// pedem mais resolução/qualidade. Default 1600/0.82 mantém as chamadas existentes intactas.
// O peso extra é absorvido pelo IndexedDB (idb://), então não estoura o localStorage.
function _dPsdRasterURL(canvas, opts){
  try{
    opts=opts||{};
    const MAX=opts.maxPx||1600, q=(opts.q!=null?opts.q:0.82), w=canvas.width, h=canvas.height;
    const scale=Math.min(1, MAX/Math.max(w,h));
    const hasAlpha=_dPsdHasAlpha(canvas);
    let src=canvas;
    if(scale<1){
      const tw=Math.max(1,Math.round(w*scale)), th=Math.max(1,Math.round(h*scale));
      const c=document.createElement('canvas'); c.width=tw; c.height=th;
      const cx=c.getContext('2d'); cx.imageSmoothingQuality='high'; cx.drawImage(canvas,0,0,tw,th); src=c;
    }
    return hasAlpha ? src.toDataURL('image/png') : src.toDataURL('image/jpeg',q);
  }catch(e){ try{ return canvas.toDataURL('image/png'); }catch(_){ return null; } }
}
// Dimensões/origem da caixa de um node
function _dPsdBox(node){ return { x:Math.round(node.left||0), y:Math.round(node.top||0),
  w:Math.max(1,Math.round((node.right||0)-(node.left||0))), h:Math.max(1,Math.round((node.bottom||0)-(node.top||0))) }; }
// Máscara de CAMADA (raster) do PSD → canvas alpha do tamanho do layer (luminância→alpha)
// Projeta uma máscara do PSD (que vive em coords do DOC) na caixa de QUALQUER camada →
// canvas alpha do tamanho da caixa. Genérico de propósito: a mesma máscara de um grupo
// precisa ser reprojetada na caixa de cada filho (o Luma não tem grupo).
function _dPsdMaskToBox(mk, b){
  if(!mk || mk.disabled || !mk.canvas || !b || b.w<1 || b.h<1) return null;
  const def=(mk.defaultColor!=null?mk.defaultColor:0);
  const mx=Math.round((mk.left||0)-b.x), my=Math.round((mk.top||0)-b.y);
  const tmp=document.createElement('canvas'); tmp.width=b.w; tmp.height=b.h;
  const tctx=tmp.getContext('2d');
  tctx.fillStyle='rgb('+def+','+def+','+def+')'; tctx.fillRect(0,0,b.w,b.h);
  tctx.drawImage(mk.canvas, mx, my);
  const id=tctx.getImageData(0,0,b.w,b.h), d=id.data;
  for(let i=0;i<d.length;i+=4){ const lum=d[i]*.299+d[i+1]*.587+d[i+2]*.114; d[i]=0;d[i+1]=0;d[i+2]=0;d[i+3]=lum; }
  tctx.putImageData(id,0,0); return tmp;
}
function _dPsdLayerMaskCanvas(node){ return _dPsdMaskToBox(node.mask, _dPsdBox(node)); }
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
// Downscale de um canvas (mantém proporção) → dataURL PNG. Usado p/ máscaras: elas são
// esticadas pro box no render (maskSize 100% 100% / preserveAspectRatio none), então perder
// resolução é seguro e evita máscaras gigantes furando a quota do localStorage.
function _dPsdDownscaleMaskURL(canvas, max){
  try{
    const w=canvas.width, h=canvas.height, scale=Math.min(1, max/Math.max(w,h));
    if(scale>=1) return canvas.toDataURL('image/png');
    const tw=Math.max(1,Math.round(w*scale)), th=Math.max(1,Math.round(h*scale));
    const c=document.createElement('canvas'); c.width=tw; c.height=th;
    const cx=c.getContext('2d'); cx.imageSmoothingQuality='high'; cx.drawImage(canvas,0,0,tw,th);
    return c.toDataURL('image/png');
  }catch(e){ try{ return canvas.toDataURL('image/png'); }catch(_){ return null; } }
}
// Compõe TODAS as máscaras que incidem sobre a camada (multiplicando alphas) → dataURL alpha.
// Fontes: máscara da própria camada, clipping, recorte vetorial e as máscaras dos GRUPOS-pai.
// extra = {groupMasks:[mk…], vecCanvas}. Antes só sabia combinar camada+clipping, e a vetorial
// era exclusiva — quem tivesse as duas perdia uma delas.
function _dPsdComputeMask(node, base, extra){
  try{
    extra=extra||{};
    const b=_dPsdBox(node);
    const parts=[];
    const lm=_dPsdLayerMaskCanvas(node); if(lm) parts.push(lm);
    if(node.clipping){ const cm=_dPsdClipMaskCanvas(node, base); if(cm) parts.push(cm); }
    if(extra.vecCanvas) parts.push(extra.vecCanvas);
    // Máscara de grupo reprojetada na caixa desta camada (uma por grupo-pai mascarado).
    (extra.groupMasks||[]).forEach(mk=>{ const gm=_dPsdMaskToBox(mk, b); if(gm) parts.push(gm); });
    if(!parts.length) return null;
    const out=document.createElement('canvas'); out.width=b.w; out.height=b.h;
    const octx=out.getContext('2d');
    octx.drawImage(parts[0],0,0);
    if(parts.length>1){
      const acc=octx.getImageData(0,0,b.w,b.h), ad=acc.data;
      for(let p=1;p<parts.length;p++){
        const pd=parts[p].getContext('2d').getImageData(0,0,b.w,b.h).data;
        for(let i=3;i<ad.length;i+=4) ad[i]=Math.round(ad[i]*pd[i]/255);
      }
      for(let i=0;i<ad.length;i+=4){ ad[i]=0;ad[i+1]=0;ad[i+2]=0; } // só o alpha importa
      octx.putImageData(acc,0,0);
    }
    // Resolução ADAPTATIVA: a máscara é esticada de volta pro tamanho da caixa no render, então
    // 700px basta numa caixa pequena/média — mas num fundo de 1080²+ ela era ampliada ~1,5× e a
    // borda do recorte serrilhava. Acompanha o lado maior da caixa, teto 1400 (acima disso o
    // ganho não se enxerga e o PNG dobra de peso). Nunca AMPLIA: _dPsdDownscaleMaskURL só reduz.
    return _dPsdDownscaleMaskURL(out, Math.max(700, Math.min(1400, Math.max(b.w, b.h))));
  }catch(e){ return null; }
}
// Máscara VETORIAL (node.vectorMask): rasteriza os paths bézier num canvas alpha do tamanho
// do layer (opaco dentro do recorte). Ex.: fundo com mordida/onda nas bordas. Devolve o CANVAS
// (não dataURL) para poder ser multiplicado com as outras máscaras em _dPsdComputeMask.
// Os knots vêm em pixels ABSOLUTOS do documento (ag-psd multiplica por width/height do PSD),
// então deslocamos pela origem da caixa do layer. Retorna null em qualquer falha (fallback seguro).
function _dPsdVectorMaskCanvas(node){
  try{
    const vm=node.vectorMask;
    if(!vm || vm.disable || !vm.paths || !vm.paths.length || typeof Path2D==='undefined') return null;
    const b=_dPsdBox(node);
    const p2d=new Path2D(); let drew=false; let rule='nonzero';
    vm.paths.forEach(path=>{
      const k=path&&path.knots; if(!k||k.length<2) return;
      if(path.fillRule==='even-odd') rule='evenodd';
      const px=(i,o)=>k[i].points[o]-b.x, py=(i,o)=>k[i].points[o+1]-b.y; // o=0 in-handle, 2 âncora, 4 out-handle
      p2d.moveTo(px(0,2), py(0,2));
      const last=path.open?k.length-1:k.length;
      for(let i=0;i<last;i++){
        const j=(i+1)%k.length;
        p2d.bezierCurveTo(px(i,4),py(i,4), px(j,0),py(j,0), px(j,2),py(j,2));
      }
      if(!path.open) p2d.closePath();
      drew=true;
    });
    if(!drew) return null;
    const c=document.createElement('canvas'); c.width=b.w; c.height=b.h;
    const ctx=c.getContext('2d'); ctx.fillStyle='#000';
    if(vm.invert){ // inverte: tudo opaco, depois fura o recorte (path vira transparente)
      ctx.fillRect(0,0,b.w,b.h);
      ctx.globalCompositeOperation='destination-out'; ctx.fill(p2d, rule);
      ctx.globalCompositeOperation='source-over';
    } else {       // padrão: dentro do path → alpha 255 (visível), fora → transparente
      ctx.fill(p2d, rule);
    }
    return c;
  }catch(e){ return null; }
}
// Traçado vetorial (node.vectorStroke) → {strokeW, strokeColor} ou {} (sem traçado).
function _dPsdShapeStroke(node){
  const vs=node.vectorStroke; const out={};
  try{
    if(vs && vs.strokeEnabled!==false){
      const lwRaw=vs.lineWidth; const lw=(lwRaw&&lwRaw.value!=null)?lwRaw.value:lwRaw;
      if(lw>0){
        out.strokeW=Math.max(1,Math.round(lw));
        const c=vs.content&&(vs.content.color||vs.content);
        out.strokeColor=_dPsdHex(c)||'#000000';
        if(vs.lineAlignment) out.strokeAlign=({inside:'inside',center:'center',outside:'outside'}[vs.lineAlignment])||'center';
        if(vs.lineCapType) out.strokeCap=({butt:'butt',round:'round',square:'square'}[vs.lineCapType])||'butt';
        if(vs.lineJoinType) out.strokeJoin=({miter:'miter',round:'round',bevel:'bevel'}[vs.lineJoinType])||'miter';
        if(Array.isArray(vs.lineDashSet)&&vs.lineDashSet.length){ // dash em múltiplos da espessura → px
          const dash=vs.lineDashSet.map(d=>Math.max(0,Math.round(((d&&d.value!=null)?d.value:d)*(out.strokeW||1))));
          if(dash.some(x=>x>0)) out.strokeDash=dash;
        }
      }
    }
  }catch(e){}
  return out;
}
// Raios por canto (node.vectorOrigination.keyOriginRRectRadii) → {tl,tr,br,bl} ou null.
// Valores vêm em px; clampamos a min(w,h)/2. Se todos forem 0, retorna null (usa raio uniforme).
function _dPsdCornerRadii(node, w, h){
  try{
    const vo=node.vectorOrigination; const list=vo&&vo.keyDescriptorList; if(!list||!list.length) return null;
    let rr=null; for(let i=0;i<list.length;i++){ if(list[i]&&list[i].keyOriginRRectRadii){ rr=list[i].keyOriginRRectRadii; break; } }
    if(!rr) return null;
    const m=Math.max(0,Math.min(w,h)/2);
    const v=u=>{ const n=(u&&u.value!=null)?u.value:u; return Math.min(m, Math.max(0, Math.round(+n||0))); };
    const out={ tl:v(rr.topLeft), tr:v(rr.topRight), br:v(rr.bottomRight), bl:v(rr.bottomLeft) };
    if(!(out.tl||out.tr||out.br||out.bl)) return null;
    return out;
  }catch(e){ return null; }
}
// Estilo de gradiente do PS (GrdT: linear|radial|angle|reflected|diamond) → primitiva do Luma.
// Antes TODOS que não fossem 'radial' viravam linear em silêncio — um cônico ou um losango
// importava como uma faixa reta, sem aviso nenhum.
//  • reflected → LINEAR com os stops espelhados no centro. É equivalente exato e não exige
//    primitiva nova em nenhum dos três renderizadores.
//  • angle (cônico) / diamond → sem equivalente; devolve `unsupported` e quem chama decide
//    (num PREENCHIMENTO o pixel do PS é fiel → rasteriza; num EFEITO, só dá pra avisar).
function _dPsdGradStyle(style, stops){
  const s=String(style||'linear').toLowerCase();
  if(s==='reflected'){
    const half=stops.map(t=>Object.assign({},t,{pos:0.5+t.pos/2}));
    const mirror=stops.map(t=>Object.assign({},t,{pos:0.5-t.pos/2})).reverse();
    const merged=mirror.concat(half);
    // O centro sai duplicado quando o 1º stop está em 0 (o caso comum). Descarta vizinho
    // idêntico em vez de fatiar às cegas — com o 1º stop deslocado não há duplicata a remover.
    return {type:'linear', stops:merged.filter((t,i)=>i===0||t.pos!==merged[i-1].pos||t.color!==merged[i-1].color)};
  }
  if(s==='radial') return {type:'radial', stops};
  if(s==='angle'||s==='diamond') return {type:'linear', stops, unsupported:s};
  return {type:'linear', stops};
}
// Gradiente do PSD (vectorFill de GdFl, ou effects.gradientOverlay) → modelo Luma l.gradient.
// Opacidade de um gradiente na posição loc (0..1), INTERPOLADA linearmente entre os dois
// opacityStops vizinhos (antes pegava o vizinho mais próximo, o que serrilhava a transição).
function _dPsdOpacityAt(opacityStops, loc){
  const os=opacityStops||[];
  if(!os.length) return 1;
  const sorted=os.slice().sort((a,b)=>(a.location||0)-(b.location||0));
  const op=s=>s.opacity!=null?s.opacity:1;
  if(loc<=(sorted[0].location||0)) return op(sorted[0]);
  const last=sorted[sorted.length-1];
  if(loc>=(last.location||0)) return op(last);
  for(let i=0;i<sorted.length-1;i++){
    const a=sorted[i], b=sorted[i+1], la=a.location||0, lb=b.location||0;
    if(loc>=la && loc<=lb){ if(lb===la) return op(a); return op(a)+(op(b)-op(a))*((loc-la)/(lb-la)); }
  }
  return 1;
}
function _dPsdGradient(node){
  try{
    let src=null;
    if(node.vectorFill && node.vectorFill.colorStops) src=node.vectorFill;            // camada de gradiente (GdFl)
    else { let go=node.effects&&node.effects.gradientOverlay; if(Array.isArray(go)) go=go[0];
      if(go && go.enabled!==false && go.gradient && go.gradient.colorStops){ src=go.gradient; src.angle=go.angle; src.style=go.type||src.style; } }
    if(!src||!src.colorStops||!src.colorStops.length) return null;
    let stops=src.colorStops.map(s=>({ color:_dPsdHex(s.color)||'#000000', pos:Math.max(0,Math.min(1,s.location||0)), opacity:_dPsdOpacityAt(src.opacityStops, s.location||0) }));
    if(src.reverse){ stops=stops.map(s=>({...s,pos:1-s.pos})).reverse(); } // PS "Reverse" → espelha os stops
    const _st=_dPsdGradStyle(src.style, stops);
    // Convenção de ângulo: o Photoshop mede o ângulo do gradiente no sentido ANTI-horário; o
    // renderizador do Luma (gGradientCanvas/Css) progride em (cos θ, sin θ) = sentido HORÁRIO.
    // Negar o ângulo do PS converte para a convenção do Luma (θ=0 e horizontais ficam iguais).
    const g={ type:_st.type, angle: Math.round(-(src.angle!=null?src.angle:90)), stops:_st.stops };
    if(_st.unsupported) g.psStyle=_st.unsupported; // consumido no walk → rasteriza a camada
    return g;
  }catch(e){ return null; }
}
// Rich text: styleRuns do PSD → l.runs[{text,color,fontSize,font,letterSpacing}]. Só quando há >1 estilo.
function _dPsdRichRuns(t, res, h){
  try{
    const runs=Array.isArray(t.styleRuns)?t.styleRuns:null; if(!runs||runs.length<2) return null;
    // Fatia o texto CRU: r.length conta os caracteres do EngineData, onde a quebra de linha é
    // '\r'. Normalizar ANTES encurtava a string em cada '\r\n' e todos os runs seguintes saíam
    // deslocados (trecho com a cor/tamanho do vizinho). Normaliza depois, por trecho.
    const full=String(t.text||'');
    // Cor do estilo DOMINANTE como fallback: um run que só muda o tamanho costuma herdar a cor
    // (sem fillColor no EngineData) — cair em #000 fixo apagava trecho branco sobre fundo escuro.
    const _domStyle=(typeof _dPsdDominantStyle==='function'&&_dPsdDominantStyle(t))||null;
    const _domColor=(_domStyle&&_domStyle.style&&_dPsdHex(_domStyle.style.fillColor||_domStyle.style.color))||'#000000';
    const out=[]; let pos=0;
    for(const r of runs){
      const len=r.length||0; const seg=full.substr(pos,len).replace(/\r\n?/g,'\n'); pos+=len; if(!seg) continue;
      const st=r.style||{};
      const fname=(st.font&&st.font.name)||'';
      const remap=_dPsdRemapFont(fname);
      // shapeType vai junto: sem ele um run de caixa de PARÁGRAFO caía no caminho "point" e podia
      // ter o tamanho real trocado pelo estimado da caixa — enquanto o tamanho da própria camada
      // (calculado com shapeType) era respeitado 1:1. Os dois lados agora usam a mesma regra.
      const _rfs=_dPsdFontSize({style:st,transform:t.transform,shapeType:t.shapeType}, h, seg, res);
      out.push({
        text:seg,
        color:_dPsdHex(st.fillColor||st.color)||_domColor,
        fontSize:_rfs,
        font: remap||_dPsdRobotoFont(fname),
        _fontName:fname, // nome original — permite remap posterior (upload de fonte na revisão)
        letterSpacing: st.tracking? Math.round((st.tracking/1000)*(_rfs||12)) : 0 // tracking sobre o tamanho final do trecho
      });
    }
    return out.length>1?out:null;
  }catch(e){ return null; }
}
// Função auxiliar de singularização para heurísticas de auto-sugestão de variáveis do PSD.
// Reduz variações de plurais comuns em português e inglês para melhorar a correspondência semântica.
function _dSingularize(word){
  if(!word) return '';
  if(word.endsWith('oes')) return word.slice(0, -3) + 'ao'; // condicoes -> condicao
  if(word.endsWith('ns')) return word.slice(0, -2) + 'm';   // cupons -> cupom
  if(word.endsWith('ies')) return word.slice(0, -3) + 'y';   // validities -> validity
  if(word.endsWith('es')){
    if(word.endsWith('res')) return word.slice(0, -2); // valores -> valor
    if(word.endsWith('hes')) return word.slice(0, -2); // detalhes -> detalhe
    return word.slice(0, -1);
  }
  if(word.endsWith('s') && word.length > 2){
    return word.slice(0, -1); // produtos -> produto, prices -> price
  }
  return word;
}

// Casa o nome normalizado de uma camada com um campo QUE JÁ EXISTE no catálogo (`dVars`).
// Compara pela mesma normalização dos dois lados (sem acento, sem caixa, sem separador), o
// que resolve "Preço Por" → `precoPor` e "chamada promo" → `chamada_promo`. Aceita também o
// rótulo do campo, porque o designer costuma nomear a camada como o rótulo, não como a chave.
// Só igualdade exata: casamento por prefixo aqui ligaria "preco_antigo" no campo "preco".
function _dPsdCatalogMatch(clean, sing){
  try{
    if(typeof dVars==='undefined' || !Array.isArray(dVars) || !dVars.length) return null;
    const norm=s=>String(s||'').trim().toLowerCase().normalize('NFD')
      .replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
    for(const v of dVars){
      if(!v||!v.name) continue;
      const n=norm(v.name), l=norm(v.label);
      if(n===clean||n===sing||(l&&(l===clean||l===sing))) return v.name;
      if(_dSingularize(n)===clean||_dSingularize(n)===sing) return v.name;
    }
  }catch(e){}
  return null;
}
// #1 — sugere variável pelo nome ({{x}}) ou heurística de negócios Luma (auto:true ativa modo var por padrão)
function _dPsdSuggestVar(name, content){
  const raw=String(name||'');
  const m=raw.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/);
  if(m) return {name:m[1], auto:true};
  
  let clean=raw.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
  const sing=_dSingularize(clean);
  
  // Mapeamento específico de variáveis Luma comuns, incluindo suporte multilíngue
  const map={
    preco:'precoPor',
    precopor:'precoPor',
    precode:'precoDe',
    preco_de:'precoDe',
    preco_por:'precoPor',
    valor:'precoPor',
    promocao:'precoPor',
    de:'precoDe',
    por:'precoPor',
    
    // Inglês e sinônimos adicionais
    price:'precoPor',
    value:'precoPor',
    sale:'precoPor',
    promo:'precoPor',
    from:'precoDe',
    to:'precoPor',
    price_to:'precoPor',
    priceto:'precoPor',
    price_from:'precoDe',
    pricefrom:'precoDe',
    old_price:'precoDe',
    oldprice:'precoDe',
    price_old:'precoDe',
    new_price:'precoPor',
    newprice:'precoPor',
    price_new:'precoPor',
    sale_price:'precoPor',
    saleprice:'precoPor',
    
    product:'produto',
    validity:'validade',
    valid:'validade',
    detail:'detalhes',
    discount:'desconto',
    off:'desconto',
    coupon:'cupom',
    code:'codigo',
    gift:'brinde',
    freebie:'brinde',
    condition:'condicao',
    min_order:'pedidoMin',
    minorder:'pedidoMin',
    neighborhood:'bairros',
    area:'bairros',
    offer:'oferta',
    category:'categoria'
  };
  
  // Chaves ambíguas: palavras curtas/genéricas que também aparecem em texto fixo (conectivos,
  // rótulos). Elas SUGEREM a variável, mas NÃO ativam o modo var automático — senão uma camada
  // chamada "de"/"por"/"off"/"area" teria seu conteúdo fixo substituído por {{var}} (perda silenciosa).
  const AMBIGUOUS=new Set(['de','por','to','from','off','area','value','sale','promo','valor','promocao']);

  // ── O CATÁLOGO REAL vem antes do mapa fixo ──
  // Este mapa é um chute genérico sobre o vocabulário do delivery; `dVars` é o vocabulário que
  // ESTE designer montou neste template. Uma camada "chamada_promo" não casava com o campo
  // `chamada_promo` que já existia, e o designer religava tudo à mão na revisão. O catálogo
  // ganha porque é a verdade do projeto — o mapa fixo continua como rede de segurança.
  const _cat=_dPsdCatalogMatch(clean, sing);
  if(_cat) return {name:_cat, auto: !(AMBIGUOUS.has(clean)||AMBIGUOUS.has(sing))};

  const matchedKey = map[clean] || map[sing];
  if(matchedKey) return {name:matchedKey, auto: !(AMBIGUOUS.has(clean)||AMBIGUOUS.has(sing))};

  const known=[
    'produto', 'precoPor', 'precoDe', 'validade', 'detalhes', 'desconto', 'cupom', 'codigo',
    'brinde', 'condicao', 'pedidoMin', 'bairros', 'oferta', 'categoria'
  ];
  const hit=known.find(k=>{
    const lower=k.toLowerCase();
    return lower===clean || lower===sing;
  });
  if(hit) return {name:hit, auto:true};
  
  // Heurística de preço no CONTEÚDO: só SUGERE a variável (auto:false). Antes, qualquer texto com
  // "R$ …" virava {{precoPor}} substituindo o conteúdo inteiro — destruía rodapés/disclaimers que
  // por acaso citam um valor. O usuário promove a variável conscientemente na tela de revisão.
  if(content && /(?:r\$|\$)\s*\d/i.test(content)){
    if(/(?:de|from)/i.test(clean) || /(?:de|from)/i.test(sing)) return {name:'precoDe', auto:false};
    return {name:'precoPor', auto:false};
  }
  
  return {name:clean||'variavel', auto:false};
}

// Sugere variável e modo moldura para camadas de imagem baseando-se no nome
function _dPsdSuggestImgVar(name){
  const clean=String(name||'').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
  const sing=_dSingularize(clean);
  
  // Campo de IMAGEM já existente no catálogo vence o nome genérico — mesma razão do texto:
  // é o vocabulário deste template, não um chute. Filtra por type:'image' pra não ligar uma
  // moldura de foto num campo de texto que por acaso tem o mesmo nome.
  try{
    if(typeof dVars!=='undefined' && Array.isArray(dVars)){
      const imgs=dVars.filter(v=>v&&v.type==='image');
      if(imgs.length){
        const norm=s=>String(s||'').trim().toLowerCase().normalize('NFD')
          .replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
        const hit=imgs.find(v=>{ const n=norm(v.name), l=norm(v.label);
          return n===clean||n===sing||(l&&(l===clean||l===sing)); });
        if(hit) return {name:hit.name, mode:'frame'};
      }
    }
  }catch(e){}
  if(/logo|logomarca|marca|brand|logotipo/i.test(clean) || /logo|logomarca|marca|brand|logotipo/i.test(sing)){
    return {name:'logo_loja', mode:'frame'};
  }
  // ⛔ "fundo"/"background"/"bg" ficaram FORA de propósito: o fundo é a arte, não um espaço de
  // foto. Ligá-lo em `foto_produto` fazia a foto do produto cobrir o fundo do designer (e, numa
  // forma de cor sólida, a cor sumia de vez). O designer marca "Moldura de foto" na revisão se
  // quiser — o que não pode é o padrão destruir o fundo.
  const _fotoRe=/foto|imagem|img|photo|picture|pic|product|prod|banner|campanha/i;
  if(_fotoRe.test(clean) || _fotoRe.test(sing)){
    return {name:'foto_produto', mode:'frame'};
  }
  return null;
}

/* Teto de tamanho do arquivo. O gargalo real não é o disco: é a MEMÓRIA. Um .psd de X MB
   vira, no pico, várias vezes X — o ArrayBuffer, a cópia transferida pro worker, e o
   ImageData descomprimido de cada camada (que é o que pesa de verdade: 4 bytes por pixel,
   por camada). 500MB de arquivo já pede alguns GB de RAM no parse.
   _DPSD_NO_COPY_MB: acima disto o buffer vai pro worker SEM duplicar — ver _dPsdReadPsd. */
const _DPSD_MAX_MB=500;
const _DPSD_NO_COPY_MB=150;

/* FONTE ÚNICA dos campos do nó do ag-psd que o parse consome.
   Antes esta lista existia DUAS vezes — escrita à mão dentro da string do worker (`strip`) e
   de novo em `_dPsdRebuildNode`. Elas divergiram de verdade: `smartObject` faltava no worker,
   então o mesmo PSD dava resultado diferente com e sem worker. Agora a lista viaja por
   postMessage e os dois lados leem daqui.
   `clippingLayer` fica fora: é derivado (`clippingLayer || clipping`), não copiado. */
const _DPSD_NODE_FIELDS=['name','left','top','right','bottom','hidden','opacity','fillOpacity',
  'blendMode','text','effects','artboard','clipping','vectorMask','vectorStroke',
  'vectorOrigination','vectorFill','adjustment','placedLayer','smartObject'];

/* ── #4e — parse: Web Worker (offload) com fallback main-thread ── */
const _DPSD_WORKER_SRC = ""
  + "self.onmessage=function(e){try{"
  + "try{importScripts(e.data.lib);}catch(_){importScripts(e.data.cdn);}"
  // Sem isto o worker SEMPRE morria em "Canvas not initialized" (não há document aqui) e todo
  // PSD caía no main thread — o offload nunca acontecia de fato e a UI travava no parse.
  // OffscreenCanvas é o document.createElement do worker; sem ele, cai no fallback como antes.
  + "if(typeof OffscreenCanvas!=='undefined')self.agPsd.initializeCanvas(function(w,h){return new OffscreenCanvas(w,h);});"
  + "var psd=self.agPsd.readPsd(e.data.buffer,{useImageData:true,skipLayerImaging:false});"
  // Leitura terminou (a parte lenta): avisa a main thread quantas camadas vêm. Serve de
  // sinal de vida — lá o prazo do timeout é renovado a cada progresso.
  + "var nL=0;(function cnt(a){(a||[]).forEach(function(x){nL++;if(x.children)cnt(x.children);});})(psd.children);"
  + "self.postMessage({progress:true,layers:nL});"
  + "var transfers=[];"
  // strip() é a LISTA BRANCA do que atravessa o worker. A lista vem de _DPSD_NODE_FIELDS via
  // postMessage (e.data.fields) — não é mais escrita à mão aqui, que era a origem da divergência.
  + "var FIELDS=e.data.fields||[];"
  + "function strip(n){var o={},i;for(i=0;i<FIELDS.length;i++){o[FIELDS[i]]=n[FIELDS[i]];}"
  + "o.clippingLayer=n.clippingLayer||n.clipping;"
  + "if(n.imageData&&n.imageData.data){o._img={w:n.imageData.width,h:n.imageData.height,buf:n.imageData.data.buffer};transfers.push(n.imageData.data.buffer);}"
  + "if(n.mask&&n.mask.imageData&&n.mask.imageData.data){o._mask={w:n.mask.imageData.width,h:n.mask.imageData.height,buf:n.mask.imageData.data.buffer,left:n.mask.left,top:n.mask.top,defaultColor:n.mask.defaultColor,disabled:n.mask.disabled};transfers.push(n.mask.imageData.data.buffer);}"
  + "if(n.children)o.children=n.children.map(strip);return o;}"
  + "var res=(psd.imageResources&&psd.imageResources.resolutionInfo&&psd.imageResources.resolutionInfo.horizontalResolution)||72;"
  + "if(res&&res.value)res=res.value;"
  + "var ga=(psd.imageResources&&psd.imageResources.globalAngle);"
  + "var out={width:psd.width,height:psd.height,res:res,globalAngle:(ga==null?null:ga),children:(psd.children||[]).map(strip)};"
  // Composto do documento: só é usado quando não sobra camada utilizável (PSD achatado).
  + "if(psd.imageData&&psd.imageData.data){out._img={w:psd.imageData.width,h:psd.imageData.height,buf:psd.imageData.data.buffer};transfers.push(psd.imageData.data.buffer);}"
  + "self.postMessage({ok:true,tree:out},transfers);"
  + "}catch(err){self.postMessage({ok:false,error:String(err)});}};";

function _dPsdRebuildNode(node){
  // Mesma lista do strip() do worker, lida da MESMA constante — não há mais duas cópias.
  const n={};
  for(const f of _DPSD_NODE_FIELDS) n[f]=node[f];
  n.clippingLayer=node.clippingLayer||node.clipping;
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
/* Rebuild FATIADO da árvore que o worker devolveu.
   O worker resolve a parte lenta do parse, mas remontar os canvases é main-thread por
   natureza (não existe `document` no worker): um canvas + putImageData POR CAMADA. Numa arte
   de 200 camadas isso congelava a aba justo no fim, e o texto do overlay parava de mudar —
   parecia travado. Aqui o trabalho cede o controle ao navegador a cada _DPSD_REBUILD_LOTE
   camadas, o que mantém a UI viva e permite mostrar progresso e atender o Cancelar.
   `onProgress(feitas,total)` é chamado entre lotes; devolve null se o usuário cancelou. */
const _DPSD_FATIA_MS=16;   // ~1 frame de trabalho antes de devolver a vez ao navegador
function _dPsdCountNodes(nodes){
  let n=0; (function c(a){ (a||[]).forEach(x=>{ n++; if(x.children) c(x.children); }); })(nodes);
  return n;
}
/* Cede o controle via MessageChannel, não setTimeout: em aba sem foco o navegador limita
   setTimeout a ~1s, então um rebuild de 240 camadas gastaria ~20s só ESPERANDO — medido.
   MessageChannel entrega no próximo macrotask sem esse teto. */
let _dPsdYieldChan=null;
function _dPsdYield(){
  return new Promise(res=>{
    try{
      if(!_dPsdYieldChan) _dPsdYieldChan=new MessageChannel();
      const ch=_dPsdYieldChan;
      ch.port1.onmessage=()=>{ ch.port1.onmessage=null; res(); };
      ch.port2.postMessage(0);
    }catch(e){ setTimeout(res,0); }
  });
}
async function _dPsdRebuildTree(nodes, onProgress, isCancelled){
  const total=_dPsdCountNodes(nodes);
  let feitas=0, inicioFatia=performance.now();
  const passo=async(lista)=>{
    const out=[];
    for(const node of lista||[]){
      if(isCancelled&&isCancelled()) return null;
      const n=_dPsdRebuildNode(Object.assign({}, node, {children:null}));
      feitas++;
      if(node.children && node.children.length){
        const filhos=await passo(node.children);
        if(filhos===null) return null;
        n.children=filhos;
      }
      out.push(n);
      // Fatia por TEMPO, não por contagem: o custo de uma camada varia com a área dela
      // (putImageData de 4000×4000 é ordens de grandeza mais caro que de 60×60), então
      // "a cada 12 camadas" tanto travava em arte grande quanto pausava demais em arte pequena.
      if(performance.now()-inicioFatia>=_DPSD_FATIA_MS){
        if(onProgress) onProgress(feitas,total);
        await _dPsdYield();
        inicioFatia=performance.now();
      }
    }
    return out;
  };
  const arvore=await passo(nodes);
  if(arvore && onProgress) onProgress(total,total);
  return arvore;
}
function _dPsdResolution(psd){
  let r=(psd.imageResources&&psd.imageResources.resolutionInfo&&psd.imageResources.resolutionInfo.horizontalResolution)||psd.res||72;
  if(r&&r.value) r=r.value;
  return (+r)||72;
}
/* Cancelamento. Um PSD de 400MB pode levar minutos; sem isto, quem abriu o arquivo errado
   ficava preso olhando o overlay, sem botão e sem como interromper o worker.
   _dPsdCancelled é lido pelo rebuild fatiado entre lotes; _dPsdActiveWorker permite matar o
   worker na hora (terminate é o único jeito de parar um parse já em andamento). */
let _dPsdCancelled=false;
let _dPsdActiveWorker=null;
function dPsdCancelLoad(){
  _dPsdCancelled=true;
  if(_dPsdActiveWorker){ try{ _dPsdActiveWorker.terminate(); }catch(e){} _dPsdActiveWorker=null; }
  _dPsdBusyUpdate('Cancelando…');
}
// resolve { psd } com canvases prontos; tenta worker, cai pro main thread
function _dPsdReadPsd(buffer, agPsd){
  return new Promise((resolve)=>{
    let done=false;
    // Ligado quando o buffer foi TRANSFERIDO pro worker (arquivo grande): o ArrayBuffer local
    // fica detached (byteLength 0) e tentar ler dele daria um erro sem sentido pro usuário.
    let noFallback=false;
    const mainParse=()=>{ if(done)return; done=true;
      if(_dPsdCancelled){ resolve({cancelled:true}); return; }
      // O parse no main thread é um bloco só e não dá pra interromper — então nem começa se
      // o usuário já pediu pra cancelar.
      if(noFallback || !buffer.byteLength){
        resolve({error:new Error('worker falhou e o buffer já foi transferido (arquivo grande)')});
        return;
      }
      try{ const psd=agPsd.readPsd(buffer,{useImageData:false,skipLayerImaging:false}); resolve({psd:psd, res:_dPsdResolution(psd), worker:false}); }
      catch(e){ resolve({error:e}); } };
    let worker, to, workerUrl;
    try{
      const blob=new Blob([_DPSD_WORKER_SRC],{type:'application/javascript'});
      workerUrl = URL.createObjectURL(blob);
      worker=new Worker(workerUrl);
      _dPsdActiveWorker=worker; // dPsdCancelLoad precisa alcançá-lo pra dar terminate
      const cleanup = () => { if(workerUrl){URL.revokeObjectURL(workerUrl);workerUrl=null;} try{worker.terminate();}catch(e){} if(_dPsdActiveWorker===worker) _dPsdActiveWorker=null; };
      // Prazo proporcional ao arquivo: 25s fixos derrubavam PSDs grandes pro main thread — que
      // trava a UI e refaz TODO o trabalho — mesmo com o worker progredindo bem. ~1s/MB.
      // Teto 10min (era 3min): com o limite em 500MB, um arquivo de 400MB pedia ~7min e o
      // teto antigo o cortava no meio do caminho — justamente o caso que o worker existe pra
      // atender. O prazo é renovado a cada sinal de progresso, então travado de verdade ele
      // ainda cai fora; o teto só evita desistir de quem está trabalhando.
      const _mb=(buffer.byteLength||0)/(1024*1024);
      const _limit=Math.min(600000, Math.max(25000, Math.round(25000+_mb*1000)));
      // Arquivo grande: transfere o ORIGINAL, sem duplicar. Duplicar 400MB é meio giga a mais
      // no pico, e o fallback que a cópia protegia (parse no main thread) travaria a aba por
      // minutos nesse tamanho — não é um plano B utilizável, é um segundo problema.
      const _semCopia=_mb>=_DPSD_NO_COPY_MB;
      to=setTimeout(()=>{ cleanup(); mainParse(); }, _limit);
      worker.onmessage=(ev)=>{
        const d=ev.data||{};
        // Sinal de vida: leitura concluída, N camadas à vista. Renova o prazo e informa o usuário.
        if(d.progress){
          clearTimeout(to); to=setTimeout(()=>{ cleanup(); mainParse(); }, _limit);
          if(d.layers) _dPsdBusyUpdate('Preparando '+d.layers+' camada'+(d.layers===1?'':'s')+'…');
          return;
        }
        clearTimeout(to); cleanup();
        if(done) return;
        if(d.ok&&d.tree){ done=true;
          const tree=d.tree;
          // Rebuild fatiado: mantém a UI viva, mostra progresso e escuta o Cancelar.
          _dPsdRebuildTree(tree.children, (f,t)=>{
            _dPsdBusyUpdate('Montando camadas… '+f+' de '+t);
          }, ()=>_dPsdCancelled).then(children=>{
            if(children===null){ resolve({cancelled:true}); return; }
            const root={width:tree.width,height:tree.height,children:children};
            // Reusa o mesmo rebuild de canvas das camadas para o composto do doc.
            if(tree._img&&tree._img.buf){ const rc=_dPsdRebuildNode({_img:tree._img}); if(rc.canvas) root.canvas=rc.canvas; }
            if(tree.globalAngle!=null) root.imageResources={globalAngle:tree.globalAngle}; // luz global p/ as sombras
            resolve({psd:root, res:(+tree.res)||72, worker:true});
          }).catch(e=>resolve({error:e}));
        } else mainParse();
      };
      worker.onerror=()=>{ clearTimeout(to); cleanup(); mainParse(); };
      // Pequeno/médio: cópia (o original fica pro fallback). Grande: o próprio buffer.
      const enviar=_semCopia?buffer:buffer.slice(0);
      if(_semCopia) noFallback=true; // buffer transferido: mainParse não tem mais o que ler
      worker.postMessage({buffer:enviar, fields:_DPSD_NODE_FIELDS, lib:new URL('assets/vendor/ag-psd.js',location.href).href, cdn:'https://cdn.jsdelivr.net/npm/ag-psd/dist/bundle.js'}, [enviar]);
    }catch(e){ if(to)clearTimeout(to); mainParse(); }
  });
}

/* ── detecção de formato pela proporção da prancheta ── */
function dPsdDetectFmt(w, h){
  // Match exato (±2px) tem prioridade sobre proporção — distingue wide de horizontal etc.
  const _tol=2;
  const exact=Object.keys(DFMT_SIZES).find(k=>Math.abs(DFMT_SIZES[k].w-w)<=_tol&&Math.abs(DFMT_SIZES[k].h-h)<=_tol);
  if(exact) return exact;
  const ratio=w/h;
  if(ratio<0.7) return 'story';
  if(ratio>1.4) return 'wide';
  return 'feed';
}
// Formato APENAS por match exato (±2px) → senão 'orig' (preserva o tamanho REAL do PSD, 1:1).
// Diferente de dPsdDetectFmt (que faz snap por proporção, usado em prancheta custom/SVG):
// aqui não queremos forçar uma prancheta 1080×1350 a virar 'feed' (1080×1080).
function _dPsdExactFmt(w, h){
  const _tol=2;
  return Object.keys(DFMT_SIZES).find(k=>Math.abs(DFMT_SIZES[k].w-w)<=_tol&&Math.abs(DFMT_SIZES[k].h-h)<=_tol)||'orig';
}

// Tenta mapear um nome de fonte do PSD para fontes bundled (dBuiltinFonts) ou enviadas
// (dCustomFonts). Normaliza ambos (lowercase, só alfanum) e aceita correspondência
// exata ou por prefixo. Retorna 'custom:Family' ou null se não encontrar.
function _dPsdRemapFont(fontName){
  if(!fontName) return null;
  const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const t=norm(fontName); if(!t) return null;
  // Fontes bundled (dBuiltinFonts) têm prioridade pois não requerem upload do usuário
  const builtin=(typeof dBuiltinFonts!=='undefined'&&dBuiltinFonts)||[];
  const custom=(typeof dCustomFonts!=='undefined'&&dCustomFonts)||[];
  const all=[
    ...builtin.map(f=>({name:f.family,family:f.family})),
    ...custom
  ];
  if(!all.length) return null;
  const exact=all.find(f=>norm(f.name)===t||norm(f.family)===t);
  if(exact) return 'custom:'+exact.family;
  // correspondência por prefixo (ex: "ObviouslyWideBold" bate "Obviously Wide")
  const partial=all.find(f=>{ const fn=norm(f.name),ff=norm(f.family);
    return t.startsWith(fn)||fn.startsWith(t)||t.startsWith(ff)||ff.startsWith(t); });
  return partial?'custom:'+partial.family:null;
}

// Preserva as variantes da família Roboto já empacotadas no Luma. O fallback antigo
// distinguia apenas Bold/Black e transformava Light/Thin/Medium em Regular.
function _dPsdRobotoFont(fontName){
  const s=String(fontName||'').toLowerCase();
  if(/black|heavy|900/.test(s)) return "'Roboto Black'";
  if(/bold|700/.test(s)) return "'Roboto',bold";
  if(/medium|500/.test(s)) return "'Roboto',500";
  if(/light|300/.test(s)) return "'Roboto',300";
  if(/thin|100/.test(s)) return "'Roboto',100";
  return "'Roboto'";
}

// Extrai o estilo DOMINANTE de um nó de texto considerando todos os styleRuns.
// Run dominante = maior comprimento de texto. isMultiStyle=true quando há cores ou
// tamanhos distintos entre runs (indica ao usuário que o layer era estilo misto).
function _dPsdDominantStyle(t){
  if(!t) return {style:{}, isMultiStyle:false};
  const runs=Array.isArray(t.styleRuns)&&t.styleRuns.length?t.styleRuns:null;
  if(!runs) return {style:_dPsdTextStyle(t), isMultiStyle:false};
  const dominant=runs.reduce((best,r)=>(r.length||0)>(best.length||0)?r:best, runs[0]);
  const colors=new Set(runs.map(r=>{const c=r.style&&(r.style.fillColor||r.style.color);
    return c?Math.round(c.r||0)+','+Math.round(c.g||0)+','+Math.round(c.b||0):null;}));
  const sizes=new Set(runs.map(r=>Math.round((r.style&&(r.style.fontSize||r.style.size))||0)));
  return {style:dominant.style||{}, isMultiStyle:colors.size>1||sizes.size>1};
}
// Detecta o tipo de shape a partir do canvas rasterizado.
// Se os cantos forem transparentes e o centro opaco → é circular/elíptico.
function _dPsdDetectShapeKind(canvas){
  try{
    const w=canvas.width, h=canvas.height; if(w<8||h<8) return {kind:'rect',radius:0};
    const ctx=canvas.getContext('2d');
    if(ctx.getImageData(Math.floor(w/2),Math.floor(h/2),1,1).data[3]<200) return {kind:'rect',radius:0};
    const data=ctx.getImageData(0,0,w,h).data;
    let d=0;
    const limit=Math.min(w,h);
    for(let i=0;i<limit;i++){
      if(data[(i*w+i)*4+3]>=128){
        d=i;
        break;
      }
    }
    const ratio=w/h;
    if(d>=limit*0.12){
      const kind=(ratio>0.85&&ratio<1.18)?'circle':'ellipse';
      return {kind,radius:0};
    }else{
      return {kind:'rect',radius:Math.round(d*3.4)};
    }
  }catch(e){ return {kind:'rect',radius:0}; }
}

// Detecta ROTAÇÃO significativa da camada. O modelo do Luma não tem rotação, então uma camada
// rotacionada, se importada como texto/shape editável, viria eixo-alinhada (torta/errada). Detectar
// aqui permite rasterizar o pixel já rotacionado (1:1). Texto: ângulo do transform (a,b). Forma:
// cantos da caixa de origem (keyOriginBoxCorners) fora do eixo. Threshold ~1.5° evita falso positivo.
function _dPsdIsRotatedLayer(node){
  try{
    const tt=node.text&&node.text.transform;
    if(tt&&tt.length>=2 && Math.abs(Math.atan2(+tt[1]||0, +tt[0]||1))>0.0262) return true; // texto rotacionado
    const list=node.vectorOrigination&&node.vectorOrigination.keyDescriptorList;
    if(list) for(let i=0;i<list.length;i++){
      const c=list[i]&&list[i].keyOriginBoxCorners;
      if(c&&c.length===4){
        const dyTop=Math.abs((c[0].y||0)-(c[1].y||0));   // aresta superior deveria ser horizontal
        const dxLeft=Math.abs((c[0].x||0)-(c[3].x||0));  // aresta esquerda deveria ser vertical
        const wRef=Math.abs((c[1].x||0)-(c[0].x||0))||1, hRef=Math.abs((c[3].y||0)-(c[0].y||0))||1;
        if(dyTop>Math.max(2,wRef*0.02) || dxLeft>Math.max(2,hRef*0.02)) return true; // caixa girada
      }
    }
  }catch(e){}
  return false;
}
// Texto em CURVA (type on path). O Photoshop guarda o caminho da baseline na MÁSCARA VETORIAL
// da própria camada de texto (ag-psd não expõe isso de outro jeito: shapeType só distingue
// point/box). Detectar é duplamente necessário: além de o Luma não ter texto em curva, o caminho
// aberto era tratado como RECORTE por _dPsdVectorMaskCanvas e comia o texto na importação.
function _dPsdTextOnPath(node){
  const vm=node&&node.text&&node.vectorMask;
  return !!(vm && !vm.disable && vm.paths && vm.paths.length);
}
// Camada ESPELHADA (flip horizontal/vertical) ou girada 180°. O modelo do Luma não tem espelho
// nem rotação, então importar editável devolveria a camada desvirada — silenciosamente errada.
//  • Texto: determinante negativo do transform (a·d − b·c) = a matriz inverte a orientação.
//  • Forma: na caixa de origem, o canto superior-DIREITO à esquerda do superior-esquerdo
//    (flip H) ou o inferior-ESQUERDO acima do superior-esquerdo (flip V).
// Complementa _dPsdIsRotatedLayer, que não pega 180° (as arestas continuam alinhadas ao eixo).
function _dPsdIsFlippedLayer(node){
  try{
    const tt=node.text&&node.text.transform;
    if(tt&&tt.length>=4){
      const det=(+tt[0]||0)*(+tt[3]||0)-(+tt[1]||0)*(+tt[2]||0);
      if(det<0) return true;
    }
    const list=node.vectorOrigination&&node.vectorOrigination.keyDescriptorList;
    if(list) for(let i=0;i<list.length;i++){
      const c=list[i]&&list[i].keyOriginBoxCorners;
      if(c&&c.length===4){
        if(((c[1].x||0)-(c[0].x||0))<0) return true; // espelhada na horizontal
        if(((c[3].y||0)-(c[0].y||0))<0) return true; // espelhada na vertical
      }
    }
  }catch(e){}
  return false;
}
// P3 — decisão CENTRAL de fidelidade: a camada NÃO é representável de forma editável no Luma
// e deve virar uma IMAGEM pixel-perfeita (do node.canvas que o ag-psd já compõe), mantendo o
// visual 1:1 mesmo sem ser editável. Gatilhos determinísticos (passo 1):
//  • smart object (placedLayer): ag-psd só entrega o composto achatado → raster fiel evita
//    a mis-detecção como "shape sólida" e preserva o pixel.
//  • preenchimento/sobreposição por PADRÃO (vectorFill pattern, effects.patternOverlay): não há
//    modelo de padrão no Luma → raster do tile já renderizado.
//  • camada de ajuste (adjustment): não tem pixels próprios; retorna true para sinalizar, mas só
//    rasteriza se houver node.canvas (a fidelidade de COR via composite do doc é o passo 5).
// Só força raster quando há node.canvas utilizável; senão devolve false e o fluxo normal segue.
function _dPsdNeedsRaster(node){
  if(!node) return false;
  if(node.placedLayer || node.smartObject) return true;                 // smart object
  if(node.adjustment) return true;                                      // camada de ajuste
  if(node.vectorFill && node.vectorFill.type==='pattern') return true;  // preenchimento por padrão (PtFl)
  let po=node.effects && node.effects.patternOverlay; if(Array.isArray(po)) po=po[0];
  if(po && po.enabled!==false) return true;                             // sobreposição de padrão
  if(_dPsdIsRotatedLayer(node)) return true;                            // camada rotacionada → raster fiel (1:1)
  if(_dPsdIsFlippedLayer(node)) return true;                            // espelhada / girada 180°
  if(_dPsdTextOnPath(node)) return true;                                // texto em curva (type on path)
  // texto com WARP (arco/onda/bandeira/etc): a deformação faz parte dos PIXELS do node.canvas,
  // não dá pra reproduzir como texto editável → raster preserva o visual deformado 1:1.
  if(node.text && node.text.warp){
    const ws=node.text.warp.style;                       // ag-psd DECODIFICA: sem warp = 'none' (não 'warpNone')
    const bent=(node.text.warp.value||0)!==0 || (node.text.warp.perspective||0)!==0; // bend 0% = sem deformação visível
    if(ws && ws!=='none' && ws!=='warpNone' && bent) return true;
  }
  return false;
}

// Ajustes que o motor Canvas canônico consegue recalcular sobre a composição abaixo. Eles
// continuam como CAMADAS (não viram pixels congelados), então editar foto/texto por baixo
// preserva o tratamento de cor do PSD. Tipos fora desta lista entram visíveis na revisão,
// mas marcados como não suportados em vez de desaparecerem silenciosamente.
const _DPSD_ADJUST_SUPPORTED=new Set([
  'brightness/contrast','levels','curves','exposure','vibrance','hue/saturation',
  'invert','posterize','threshold'
]);
function _dPsdAdjustmentInfo(adj){
  if(!adj||!adj.type)return null;
  const data=JSON.parse(JSON.stringify(adj));
  const type=String(data.type).toLowerCase();
  // Estes algoritmos são dinâmicos e editáveis, mas o Photoshop usa curvas internas que não
  // publica para Brilho moderno/Vibração e spline própria em Curvas. Marcamos a aproximação na
  // revisão; melhor uma capacidade explícita do que vender "1:1" onde a matemática não é aberta.
  let approximate=(type==='brightness/contrast'&&!data.useLegacy)||type==='vibrance'||(type==='curves'&&['rgb','red','green','blue'].some(k=>(data[k]||[]).length>2));
  // O master de Hue/Saturation é reproduzido; faixas seletivas (reds/yellows/…) ainda não.
  if(type==='hue/saturation'){
    const ranged=['reds','yellows','greens','cyans','blues','magentas'];
    approximate=ranged.some(k=>{const c=data[k]||{};return !!(+c.hue||+c.saturation||+c.lightness);});
  }
  return {data,type,supported:_DPSD_ADJUST_SUPPORTED.has(type),approximate};
}

// Assinatura curta de um raster para o dedupe. O comprimento do dataURL sozinho não serve:
// duas fotos DIFERENTES que por acaso comprimem para o mesmo tamanho eram vistas como
// duplicata e a segunda desaparecia sem aviso.
// Três blocos CONTÍGUOS (início, meio, fim) em vez de amostragem espaçada: com passo
// uniforme, um byte diferente que caia entre duas amostras passa batido — foi o que um
// teste com duas strings de mesmo tamanho mostrou. Bloco contíguo pega qualquer diferença
// dentro dele, e o custo segue constante (3KB lidos, não o dataURL inteiro).
function _dPsdImgSig(url){
  if(!url) return '';
  const L=url.length, B=1024;
  let h=5381;
  const bloco=(ini)=>{ const fim=Math.min(L, ini+B);
    for(let i=Math.max(0,ini);i<fim;i++) h=((h<<5)+h+url.charCodeAt(i))|0; };
  bloco(0); bloco((L>>1)-(B>>1)); bloco(L-B);
  return L+':'+(h>>>0).toString(36);
}

/* ── PSD → itens intermediários (modo escolhível na revisão) ──
   dPsdItems/dPsdMeta/_dPsdAdjustCount vivem só em psd-import.js (estado real da revisão,
   30+ leituras/escritas lá); aqui eram declaração órfã, nunca lida — só colidia o `let`. */
// Nº de camadas que EXPLODIRAM no parse do último arquivo (viram aviso na revisão).
let _dPsdErrorCount=0;
// Uma camada com efeito malformado, path inválido ou texto corrompido NÃO pode derrubar o
// arquivo inteiro (antes: exceção → catch genérico do dImportPSD → "não foi possível
// interpretar as camadas", e o designer perdia 100% por causa de 1 camada). Aqui salvamos o
// pixel que o Photoshop já compôs e marcamos pra revisão; sem canvas, pula só ela.
function _dPsdParseFail(node, items, n, ox, oy, err, parentName, inh){
  _dPsdErrorCount++;
  console.warn('[psd] camada não parseável:', (node&&node.name)||'?', err);
  try{
    if(!node || !node.canvas || !node.canvas.width || !node.canvas.height) return;
    const url=_dPsdRasterURL(node.canvas,{maxPx:2400,q:0.92});
    if(!url) return;
    const it={ n, name:String(node.name||('Camada '+n)).slice(0,48),
      x:Math.round((node.left||0)-(ox||0)), y:Math.round((node.top||0)-(oy||0)),
      w:Math.max(1,Math.round((node.right||0)-(node.left||0))),
      h:Math.max(1,Math.round((node.bottom||0)-(node.top||0))),
      visible:!node.hidden, opacity:Math.round((node.opacity!=null?node.opacity:1)*100),
      include:!node.hidden, mask:null, group:parentName||'', kind:'raster', mode:'raster',
      imgUrl:url, parseError:true, _psdNode:node };
    // A camada falhou, mas o RECORTE do grupo continua valendo — sem isto ela reaparece
    // por fora da máscara do grupo, que é pior que a falha original.
    if(inh && inh.masks && inh.masks.length) it._groupMasks=inh.masks;
    if(inh && inh.blend) it.blendMode=inh.blend;
    items.push(it);
  }catch(e){}
}
// PSD achatado (sem camadas) ou com todas as camadas inutilizáveis: em vez de recusar o
// arquivo, importa o COMPOSTO que o Photoshop já renderizou como imagem única. O designer
// perde a edição por camada, mas recebe a arte fiel e pode trabalhar em cima dela.
// w/h opcionais: numa prancheta única, a arte precisa caber na caixa da prancheta, não do doc.
function _dPsdFlatItem(psd, w, h){
  try{
    if(!psd || !psd.canvas || !psd.canvas.width || !psd.canvas.height) return null;
    const url=_dPsdRasterURL(psd.canvas,{maxPx:2400,q:0.92});
    if(!url) return null;
    return { n:1, name:'Arte (PSD achatado)', x:0, y:0,
      w:Math.max(1, w||psd.width||psd.canvas.width),
      h:Math.max(1, h||psd.height||psd.canvas.height),
      visible:true, opacity:100, include:true, mask:null, group:'',
      kind:'raster', mode:'raster', imgUrl:url, flattened:true, _defaultMode:'raster' };
  }catch(e){ return null; }
}
// ox/oy: offset de origem (usado em artboards p/ normalizar coords pra (0,0) da prancheta).
function dPsdParseItems(psd, res, ox, oy){
  ox=ox||0; oy=oy||0;
  _dPsdAdjustCount=0; _dPsdErrorCount=0;
  // Só sobrescreve quando o objeto recebido carrega o ângulo: no fluxo multi-prancheta o psd
  // aqui é sintético ({children:[…]}) e perderíamos a luz global lida do documento real.
  const _gl=_dPsdReadGlobalLight(psd); if(_gl!=null) _dPsdGlobalLight=_gl;
  const items=[]; let n=0, gseq=0;
  // Teto de raster ADAPTATIVO à prancheta. O PNG final renderiza a 2× o tamanho da prancheta,
  // então uma imagem grande precisa de até 2×maxDim px pra não sair mole no export — o teto fixo
  // de 1600 borrava herói de PSD grande. Piso 1600 (comportamento antigo p/ prancheta pequena,
  // sem regressão), teto 3200 (protege o IndexedDB de PSD gigante). psd.width/height vem dos
  // chamadores (incluído no objeto passado ao parse); sem eles cai no piso.
  const _artMax=Math.max((psd&&psd.width)||0, (psd&&psd.height)||0);
  const _rasterCap=Math.min(3200, Math.max(1600, 2*_artMax));
  // Camadas que SÓ existem como raster (warp, smart object, padrão, camada recuperada) não têm
  // segunda chance: o piso é o 2400 de antes, mas acompanham a prancheta quando ela pede mais.
  const _fidCap=Math.max(2400, _rasterCap);
  // Grupos do PSD viram os grupos que o Luma JÁ possui (`parentId`). Além de organização, agora
  // eles carregam composição (isolamento/opacidade/máscara/blend) no motor Canvas canônico.
  (function walk(nodes, parentOp, parentHidden, parentName, inh){
    inh=inh||{groups:[], masks:[], blend:null, blendApprox:false};
    // try//catch por CAMADA: uma camada quebrada vira imagem fiel (ou é pulada) em vez de
    // derrubar o PSD inteiro. O corpo abaixo mantém a indentação original de propósito —
    // re-indentar 150 linhas esconderia as mudanças reais no diff.
    (nodes||[]).forEach(node=>{
      try{
      if(node.adjustment) _dPsdAdjustCount++; // camada de ajuste (dropada; afeta cor → aviso na revisão)
      const nodeOp=node.opacity!=null?node.opacity:1;
      const accOp=parentOp*nodeOp;
      const accHidden=parentHidden||(node.hidden?true:false);
      if(node.children && node.children.length){
        if(node.artboard){ walk(node.children,accOp,accHidden,'',inh); return; }
        const parentGroup=inh.groups.length?inh.groups[inh.groups.length-1]:null;
        const rawGroupBlend=String(node.blendMode||'').toLowerCase();
        const gd={id:'g-psd-'+(++gseq),type:'group',name:String(node.name||('Grupo '+gseq)).slice(0,48),visible:!accHidden,locked:false,collapsed:false,
          opacity:Math.round(nodeOp*(node.fillOpacity!=null?node.fillOpacity:1)*100),isolation:!!rawGroupBlend&&rawGroupBlend!=='pass through'&&rawGroupBlend!=='passthrough'};
        if(parentGroup)gd.parentId=parentGroup.id;
        const gb=_dPsdBlendMode(node.blendMode); if(gb)gd.blendMode=gb;
        Object.assign(gd,_dPsdEffects(node));
        const start=items.length;
        const gInh={groups:inh.groups.concat([gd]),masks:[],blend:null,blendApprox:false};
        walk(node.children,1,accHidden,node.name||parentName||'',gInh);
        const kids=items.slice(start);
        if(kids.length){
          const x0=Math.min.apply(null,kids.map(k=>k.x)), y0=Math.min.apply(null,kids.map(k=>k.y));
          const x1=Math.max.apply(null,kids.map(k=>k.x+k.w)), y1=Math.max.apply(null,kids.map(k=>k.y+k.h));
          gd.x=x0;gd.y=y0;gd.w=Math.max(1,x1-x0);gd.h=Math.max(1,y1-y0);
          if(node.mask&&!node.mask.disabled&&node.mask.canvas){
            const gm=_dPsdMaskToBox(node.mask,{x:x0+ox,y:y0+oy,w:gd.w,h:gd.h});
            if(gm)gd.mask=_dPsdDownscaleMaskURL(gm,Math.max(700,Math.min(1400,Math.max(gd.w,gd.h))));
          }
        }
        return;
      }
      if(node.adjustment){
        const ai=_dPsdAdjustmentInfo(node.adjustment); if(!ai)return;
        // Camada de ajuste não possui caixa de pixels própria no PSD: ela atua sobre toda a
        // composição do contexto (prancheta ou grupo). Uma caixa integral também permite que a
        // máscara de camada seja reprojetada pelo mesmo pipeline das demais camadas.
        const aw=Math.max(1,(psd&&psd.width)||1), ah=Math.max(1,(psd&&psd.height)||1);
        const an=Object.assign({},node,{left:ox,top:oy,right:ox+aw,bottom:oy+ah});
        const ait={n:++n,name:(node.name||ai.type).toString().slice(0,48),x:0,y:0,w:aw,h:ah,
          visible:!accHidden,opacity:Math.round(accOp*100),include:true,kind:'adjustment',mode:'adjustment',
          adjustment:ai.data,adjustmentType:ai.type,adjustmentSupported:ai.supported,
          adjustmentApprox:ai.approximate,clippingLayer:node.clippingLayer||node.clipping,
          blendMode:_dPsdBlendMode(node.blendMode),group:parentName||'',_psdNode:an};
        if(inh.groups&&inh.groups.length)ait._groupChain=inh.groups.slice();
        items.push(ait); return;
      }
      const x=Math.round((node.left||0)-ox), y=Math.round((node.top||0)-oy);
      const w=Math.max(1,Math.round((node.right||0)-(node.left||0)));
      const h=Math.max(1,Math.round((node.bottom||0)-(node.top||0)));
      const it={ n:++n, name:(node.name||('Camada '+n)).toString().slice(0,48),
        x,y,w,h, visible:!accHidden, opacity:Math.round(accOp*100),
        include:!accHidden, mask:null, // resolvido no pós-processamento 
        clippingLayer: node.clippingLayer || node.clipping,
        blendMode:_dPsdBlendMode(node.blendMode),
        group:parentName||'', _psdNode:node }; // guarda p/ recorte correto
      if(inh.groups&&inh.groups.length)it._groupChain=inh.groups.slice();
      // Herança dos grupos-pai: máscaras entram na composição do pós-processamento; mesclagem
      // só se aplica quando a própria camada não define a dela (a de baixo é mais específica).
      if(inh.masks.length) it._groupMasks=inh.masks;
      if(!it.blendMode && inh.blend){ it.blendMode=inh.blend; if(inh.blendApprox) it.groupBlendApprox=true; }
      // fillOpacity (preenchimento) ≠ opacity: PS atenua só o fill, não os efeitos. Guardado p/
      // dobrar na opacity quando não há efeitos (dItemToLayer); com efeitos, P3 rasteriza fiel.
      if(node.fillOpacity!=null && node.fillOpacity<1) it.fillOpacity=node.fillOpacity;
      // Recorte vetorial (vectorMask) — ex.: fundo com mordida/onda. Guardado como CANVAS e
      // multiplicado com as demais máscaras no pós-processamento: antes ele era exclusivo
      // ("só quando não há máscara raster/clipping") e uma das duas era perdida.
      if(node.vectorMask && !node.vectorMask.disable){
        const vmc=_dPsdVectorMaskCanvas(node);
        if(vmc) it._vecMaskCanvas=vmc;
        else { it.vectorMaskFailed=true; console.warn('[psd] vectorMask não rasterizável, importando shape simplificado:', it.name); }
      }
      // P3: recurso não-representável editavelmente (smart object / padrão / ajuste / texto warp) →
      // vira imagem pixel-perfeita do que o PS compôs, preservando o visual 1:1 (evita drop/mis-detecção).
      if(_dPsdNeedsRaster(node) && node.canvas && node.canvas.width>0 && node.canvas.height>0){
        it.kind='raster'; it.mode='raster';
        // Motivo do raster que o designer NÃO adivinha olhando a lista (um texto que virou
        // imagem parece bug). Rotação/warp/smart object já se explicam pelo próprio visual.
        if(_dPsdTextOnPath(node)) it.textOnPath=true;
        else if(_dPsdIsFlippedLayer(node)) it.flipped=true;
        it.imgUrl=_dPsdRasterURL(node.canvas,{maxPx:_fidCap,q:0.92}); // única fonte de fidelidade → alta qualidade
        if(it.imgUrl){
          // node.canvas NÃO traz os efeitos de camada (são vetoriais no PS) → re-aplica os simples
          // (sombra/glow/contorno/overlay — 1º de cada) sobre o pixel, p/ a sombra do smart object etc.
          Object.assign(it,_dPsdEffects(node));
          items.push(it); return;
        }
        // sem raster utilizável → segue o fluxo normal (pode virar texto/shape ou ser dropado)
      }
      if(node.text && node.text.text!=null && String(node.text.text).trim()!==''){
        const t=node.text, sv=_dPsdSuggestVar(node.name, t.text);
        const {style:st, isMultiStyle}=_dPsdDominantStyle(t);
        it.kind='text';
        it.content=String(t.text).replace(/\r\n?/g,'\n');
        it.multiStyle=isMultiStyle;
        // Ancoragem vertical pelo TOPO (origem do texto no Photoshop): o topo da tinta encosta no
        // node.top. Substitui a centralização genérica do editor → posição vertical 1:1 com o PS.
        it.vAlign='top';
        it.fontName=(st.font&&st.font.name)||'';
        const _fRemap=_dPsdRemapFont(it.fontName);
        it.font=_fRemap||_dPsdRobotoFont(it.fontName);
        it.fontRemapped=!!_fRemap;
        // fontCaps: 0=normal, 1=small-caps, 2=all-caps (PS "All Caps" character style)
        if(st.fontCaps===2) it.textTransform='uppercase';
        else if(st.fontCaps===1) it.textTransform='uppercase'; // small-caps (versaletes) ≈ maiúsculas; NUNCA lowercase (invertia a caixa)
        // fauxBold: PS "Faux Bold" — eleva o peso quando a fonte não tem variante bold
        if(st.fauxBold) it.fontWeightOverride=/black|heavy|900/i.test(it.fontName)?900:700;
        // Itálico: faux italic do PS ou variante itálica/oblíqua no nome da fonte → font-style:italic
        if(st.fauxItalic || /italic|oblique|it[aá]lico/i.test(it.fontName)) it.italic=true;
        it.fontSize=_dPsdFontSize(t,h,it.content,res);
        it.color=_dPsdHex(st.fillColor||st.color)||'#000000';
        it.strikethrough=st.strikethrough===true; // tachado (DE: R$..) — render já suportado
        it.underline=st.underline===true;          // sublinhado — render espelha o strikethrough
        const _al=_dPsdAlign(t);
        // O motor agora justifica de verdade (_fJustifySegs em png-generator). 'justify-all'
        // não tem equivalente (justificaria até a última linha) — cai no justificado normal,
        // e é o único caso que segue merecendo aviso.
        it.textAlign=_al.justified ? 'justify' : _al.align;
        if(_al.justifyAll) it.textJustifyAll=true;
        // `0` também é informação: impede o respiro automático usado pelos títulos nativos do
        // Luma. Sem gravá-lo, todo Roboto Black do PSD ganhava tracking extra e ficava mais largo.
        it.letterSpacing=Math.round(((+st.tracking||0)/1000)*(it.fontSize||12)); // tracking (1/1000 em) → px, sobre o tamanho final
        // Entrelinha. Com "Auto" ligado (st.autoLeading, o PADRÃO do Photoshop) o valor gravado em
        // st.leading é LIXO — sobra de um estado anterior do arquivo — e lê-lo trazia entrelinhas
        // absurdas. Auto = fator do parágrafo (paragraphStyle.autoLeading, 1.2 no PS) × o corpo.
        if(st.autoLeading===true || !st.leading){
          const _autoF=+_dPsdParaStyle(t).autoLeading;
          it.lineHeight=(isFinite(_autoF)&&_autoF>0.5&&_autoF<5)?+_autoF.toFixed(3):1.2;
        } else {
          const fPts = st.fontSize;
          if(fPts){ it.lineHeight=+(st.leading/fPts).toFixed(3); } // pts / pts
          else {
            const lPx = (res>90 && st.leading<200) ? st.leading*(res/72) : st.leading;
            it.lineHeight=+(lPx/(it.fontSize||12)).toFixed(3); // px / px
          }
        }
        const _runs=_dPsdRichRuns(t,res,h);
        if(_runs){
          it.runs=_runs;
          // Os runs PRESERVAM cada trecho com seu estilo — então o aviso "Estilos mistos"
          // (que diz "o estilo dominante será preservado", ou seja, avisa de PERDA) mente
          // aqui: não houve perda. Só continua marcado quando o rich text não resolveu.
          it.multiStyle=false;
        }
        const _tg=_dPsdGradient(node); if(_tg) it.gradient=_tg;        // preenchimento por gradiente no texto
        Object.assign(it,_dPsdEffects(node));
        it.varName=sv.name;
        it.mode=sv.auto?'var':'text';
        // Tipo de caixa. Campo real do ag-psd: text.shapeType ('box'|'point'). Só PARAGRAPH (box)
        // substitui x/y/w/h pela caixa do designer; POINT mantém o bbox de glifos 1:1 (posição real).
        it.textBox=(t.shapeType==='box')?'box':'point';
        if(it.textBox==='box'){
          // Caixa 1:1 do Photoshop → NÃO reencaixa/encolhe o texto na importação.
          const pb=_dPsdParagraphBox(node);
          if(pb){ it.x=Math.round(pb.x-ox); it.y=Math.round(pb.y-oy); it.w=Math.max(1,pb.w); it.h=Math.max(1,pb.h); }
          else { it.textBoxApprox=true; console.warn('[psd] caixa de parágrafo não derivável — usando bbox de glifos:', it.name); }
        }
        if(node.canvas && node.canvas.width>0){ it.imgUrl=_dPsdRasterURL(node.canvas,{maxPx:_rasterCap}); } // p/ "imagem fiel"
      } else if(node.canvas && node.canvas.width>0 && node.canvas.height>0){
        // Camada de GRADIENTE (GdFl: tem vectorFill com colorStops) → shape com gradiente editável,
        // mesmo não sendo cor sólida (senão cairia em raster).
        const grad=(node.vectorFill && node.vectorFill.colorStops)?_dPsdGradient(node):null;
        // Cor: preferir a EXATA do vetor (vectorFill), cair na amostragem de pixels só se faltar.
        // Photoshop permite forma só-contorno: vectorFill ainda pode carregar a última cor,
        // mas `vectorStroke.fillEnabled:false` manda NÃO pintá-la. Ignorar a flag inventava um
        // retângulo sólido por cima do fundo/textura (caso dos cards laranja deste PSD real).
        const fillDisabled=!!(node.vectorStroke&&node.vectorStroke.fillEnabled===false);
        const solid=fillDisabled?null:(_dPsdVectorSolidColor(node)||_dPsdSolidColor(node.canvas));
        // Contorno vetorial (vectorStroke) — inclui formas SÓ-CONTORNO (sem preenchimento): molduras
        // vazadas, divisores e linhas TRACEJADAS. Antes, sem fill/gradiente, essas caíam no raster e o
        // tracejado virava imagem chapada (o dash lido em _dPsdShapeStroke nem era alcançado). Agora um
        // traçado real (lineWidth>0) também qualifica a camada como FORMA editável.
        const stroke=_dPsdShapeStroke(node);
        const hasStroke=stroke.strokeW>0;
        if(grad || solid || hasStroke){
          // Forma: preferir o tipo EXATO do vetor (keyOriginType), cair no heurístico de pixel.
          const vectorShape=_dPsdVectorShapeKind(node,w,h);
          const shapeInfo=vectorShape||_dPsdDetectShapeKind(node.canvas);
          it.kind='shape';
          const vectorBox=vectorShape&&_dPsdVectorShapeBox(node,ox,oy);
          if(vectorBox)Object.assign(it,vectorBox);
          // Retângulo/elipse já são a própria primitiva vetorial do Luma. Reaplicar a mesma
          // vectorMask como bitmap cortava o meio externo do stroke (formas só-contorno sumiam).
          if(vectorShape&&fillDisabled)delete it._vecMaskCanvas;
          // Só-contorno (sem fill sólido/gradiente) → fundo TRANSPARENTE, não a cor padrão laranja.
          it.fill=solid || (grad && grad.stops[0] && grad.stops[0].color) || (hasStroke ? 'transparent' : '#FF9000');
          if(grad) it.gradient=grad;
          it.shapeKind=shapeInfo.kind;
          it.radius=shapeInfo.radius;
          Object.assign(it,_dPsdEffects(node));        // sombra/glow/overlay/contorno-fx
          Object.assign(it,stroke);                    // traçado do shape (vectorStroke, incl. tracejado)
          const _rr=_dPsdCornerRadii(node,w,h); if(_rr) it.radii=_rr; // cantos por canto
          // Linha/divisor fino SÓ-CONTORNO: um retângulo de altura ~traço viraria uma MOLDURA de 4
          // lados no lugar de um traço único. Converte em barra sólida fina (= a linha do PSD).
          if(hasStroke && !solid && !grad && Math.min(w,h) <= Math.max(stroke.strokeW*1.5, 4)){
            it.fill=stroke.strokeColor||'#000000'; it.shapeKind='rect';
            it.strokeW=0; delete it.strokeDash; delete it.strokeCap; delete it.strokeJoin; delete it.strokeAlign; delete it.radii;
          }

          // Heurística de auto-frame para shapes (se o nome da camada contiver imagem/foto)
          const imgSug = _dPsdSuggestImgVar(it.name);
          if (imgSug) {
            it.mode = imgSug.mode;
            it.varName = imgSug.name;
          } else {
            it.mode = 'shape';
          }
        }
        else {
          it.kind='raster';
          it.imgUrl=_dPsdRasterURL(node.canvas,{maxPx:_rasterCap});
          if(!it.imgUrl) return;
          
          // Heurística de auto-frame para imagens raster
          const imgSug = _dPsdSuggestImgVar(it.name);
          if (imgSug) {
            it.mode = imgSug.mode;
            it.varName = imgSug.name;
          } else {
            it.mode = 'raster';
          }
        }
      } else { return; }
      // Fidelidade: combinações que o modelo EDITÁVEL não representa → rasteriza fiel (há pixels no
      // node.canvas). Mesma filosofia de warp/rotação/smart-object. Sem isto, esses efeitos sumiam
      // silenciosamente (o dado era gravado mas nenhum renderizador o consumia).
      // Gradiente cônico/losango: o motor não tem a primitiva, MAS aqui é preenchimento — o
      // pixel que o PS compôs está no node.canvas, então rasterizar sai 1:1 (bem melhor que
      // fingir que é uma faixa linear, que era o comportamento antigo e mudo).
      if(it.gradient && it.gradient.psStyle){ it.gradientUnsupported=it.gradient.psStyle; delete it.gradient.psStyle; }
      const _pn=it._psdNode;
      if(_pn && _pn.canvas && _pn.canvas.width>0){
        const _fxUnsup = it._fxOverflow                                   // 2+ efeitos do mesmo tipo (só o 1º era aplicado)
          || it.gradientUnsupported                                      // gradiente sem primitiva (cônico/losango)
          || it.overlayBlend                                             // color overlay em multiply/screen/etc.
          || (it.gradientOverlay && it.gradientOverlay.blendMode)        // gradient overlay com blend
          || (it.kind==='text' && (it.innerShadow||it.innerGlow||it.bevel||it.gradientOverlay)) // efeitos que o texto não renderiza
          || (it.fillOpacity!=null && it.fillOpacity<1 && (it.shadow||it.innerShadow||it.glow||it.innerGlow||it.bevel||it.overlay||it.gradientOverlay||it.strokeW)); // fill-opacity + efeitos
        if(_fxUnsup){ it.needsRaster=true; if(!it.imgUrl) it.imgUrl=_dPsdRasterURL(_pn.canvas,{maxPx:_fidCap,q:0.92}); }
      }
      items.push(it);
      }catch(err){ _dPsdParseFail(node, items, ++n, ox, oy, err, parentName, inh); }
    });
  })(psd.children, 1, false, '', null);
  // Dedupe defensivo (NÃO altera grupos): 1 layer no Photoshop deve virar 1 item.
  // Assinatura exata (tipo+nome+caixa+conteúdo) repetida → duplicata de parsing: descarta + avisa.
  const _seen=new Set(); const out=[];
  items.forEach(it=>{
    // Inclui cor e tamanho do raster: sem isso, dois retângulos "Faixa" de mesma caixa mas cores
    // diferentes (ou duas fotos no mesmo frame) eram vistos como duplicata e o 2º sumia.
    const sig=it.kind+'|'+it.name+'|'+it.x+'|'+it.y+'|'+it.w+'|'+it.h+'|'+(it.content||'')+'|'+(it.fill||'')+'|'+(it.adjustment?JSON.stringify(it.adjustment):'')+'|'+_dPsdImgSig(it.imgUrl);
    if(_seen.has(sig)){ console.warn('[psd] layer duplicada descartada (assinatura idêntica):', it.name); return; }
    _seen.add(sig); out.push(it);
  });
  // Aviso (NÃO remove): textos com mesmo nome+conteúdo em caixas diferentes — pode ser sombra/contorno
  // manual do designer (2 layers reais) ou duplicação inesperada. Mantém ambas para decisão na revisão.
  const _soft={};
  out.forEach(it=>{ if(it.kind==='text'&&it.content){ const k=it.name+'|'+it.content; _soft[k]=(_soft[k]||0)+1; } });
  Object.keys(_soft).forEach(k=>{ if(_soft[k]>1) console.warn('[psd] possível layer de texto duplicada mantida (nome+conteúdo iguais, caixas diferentes):', k.split('|')[0]); });

  // ag-psd entrega os filhos BASE-PRIMEIRO. Num clipping stack do Photoshop a base vem antes
  // e as camadas recortadas vêm logo depois; portanto a busca é para TRÁS, limitada ao mesmo
  // grupo. A busca antiga para frente usava a próxima camada solta como máscara e fazia a foto
  // desaparecer (sobrava só o retângulo-base branco).
  const _clipBaseIndex=(idx)=>{
    const group=out[idx]&&out[idx].group;
    let j=idx-1;
    while(j>=0 && out[j].clippingLayer && out[j].group===group) j--;
    return (j>=0 && out[j].group===group) ? j : -1;
  };

  // Resolve TODAS as máscaras de uma vez (camada + clipping + vetorial + grupos-pai), com a
  // base de clipping correta. _dPsdComputeMask multiplica os alphas, então elas se somam em
  // vez de uma sobrescrever a outra. Atribuição condicional: null não apaga o que já existe.
  for(let i=0; i<out.length; i++){
    const _extra={ groupMasks: out[i]._groupMasks, vecCanvas: out[i]._vecMaskCanvas };
    let _m=null;
    if(out[i].clippingLayer){
      const baseIdx=_clipBaseIndex(i);
      if(baseIdx>=0){
        const base=out[baseIdx];
        // `mask` fica como snapshot de compatibilidade para o DOM do editor; o Canvas final usa
        // clipBaseId e redesenha o alpha da base a cada render. Máscaras próprias ficam separadas.
        out[i].clipBaseId='l-psd-'+base.n+'-'+(base.x+base.y);
        out[i].clipBaseSnapshot={x:base.x,y:base.y,w:base.w,h:base.h,shapeKind:base.shapeKind||'rect',radius:base.radius||0,radii:base.radii||null,points:base.points||null,sides:base.sides||null,inner:base.inner||null,maskSize:base.mask?base.mask.length:0};
        out[i].clipOwnMask=_dPsdComputeMask(out[i]._psdNode, null, _extra);
        _m = _dPsdComputeMask(out[i]._psdNode, base._psdNode, _extra);
      }
    } else {
      _m = _dPsdComputeMask(out[i]._psdNode, null, _extra);
    }
    if(_m) out[i].mask = _m;
    delete out[i]._groupMasks; delete out[i]._vecMaskCanvas;
    // _psdNode NÃO é apagado aqui: o laço de clipping abaixo ainda precisa do canvas da
    // camada-base. Apagar antes matava esse caminho (base raster caía sempre em maskFallback).
  }

  // Fallback do clipping: reconstrói o alpha da base quando a composição acima não conseguiu.
  // A base continua visível — no Photoshop ela participa da pilha, não é uma máscara descartável.
  for(let i=0; i<out.length; i++) {
    if(out[i].clippingLayer) {
      const baseIdx=_clipBaseIndex(i);
      if(baseIdx>=0) {
        const base = out[baseIdx];
        const b = out[i];
        if(!b.mask) { // Se o Luma não gerou máscara via layerMaskCanvas
          const c = document.createElement('canvas');
          c.width = Math.max(1, b.w); c.height = Math.max(1, b.h);
          const ctx = c.getContext('2d');
          ctx.fillStyle = base.fill || '#000000';
          const ox = base.x - b.x, oy = base.y - b.y;
          let success = false;
          if (base.kind === 'shape' && (base.shapeKind === 'ellipse' || base.shapeKind === 'circle')) {
            ctx.beginPath();
            ctx.ellipse(ox + base.w/2, oy + base.h/2, base.w/2, base.h/2, 0, 0, 2*Math.PI);
            ctx.fill();
            success = true;
          } else if (base.kind === 'shape') {
            // Honra cantos arredondados (radius uniforme ou radii por-canto) — antes o fillRect reto
            // recortava com quebra de canto sobre uma base arredondada.
            const _rr=base.radii||{}, tl=+_rr.tl||base.radius||0, tr=+_rr.tr||base.radius||0, br=+_rr.br||base.radius||0, bl=+_rr.bl||base.radius||0;
            if(tl||tr||br||bl){
              ctx.beginPath();
              ctx.moveTo(ox+tl,oy);
              ctx.lineTo(ox+base.w-tr,oy); ctx.arcTo(ox+base.w,oy,ox+base.w,oy+tr,tr);
              ctx.lineTo(ox+base.w,oy+base.h-br); ctx.arcTo(ox+base.w,oy+base.h,ox+base.w-br,oy+base.h,br);
              ctx.lineTo(ox+bl,oy+base.h); ctx.arcTo(ox,oy+base.h,ox,oy+base.h-bl,bl);
              ctx.lineTo(ox,oy+tl); ctx.arcTo(ox,oy,ox+tl,oy,tl);
              ctx.closePath(); ctx.fill();
            } else { ctx.fillRect(ox, oy, base.w, base.h); }
            success = true;
          } else if (base._psdNode && base._psdNode.canvas && base._psdNode.canvas.width>0) {
            // Base RASTER (foto/forma complexa): usa o ALPHA dos pixels da base como recorte, em vez
            // de desistir (antes o clipping era totalmente ignorado e a camada importava cheia).
            ctx.drawImage(base._psdNode.canvas, ox, oy, base.w, base.h);
            success = true;
          }
          if(success) {
            try { b.mask = c.toDataURL('image/png'); }
            catch(e) { b.maskFallback = true; }
          } else {
            b.maskFallback = true;
          }
        }
      }
    }
  }

  // Nó cru do ag-psd cumpriu o papel (máscaras + recorte); solta a referência antes de devolver.
  out.forEach(it=>{ delete it._psdNode; });

  // Photoshop = Top-Down; Luma = Bottom-Up
  out.reverse();

  // Modo PADRÃO do parser (antes da memória/usuário) — referência p/ _dPsdMemSave
  // distinguir decisão real de default e só persistir o que o usuário mudou.
  out.forEach(it=>{ it._defaultMode=it.mode; });

  return out;
}

// Copia efeitos do item intermediário → layer (sombra/inner/glow/overlay/contorno+align).
// Só grava o que existe, p/ não inflar o layer nem mudar camadas sem efeito.
function _dPsdApplyFx(L, it){
  if(it.shadow){ L.shadow=true; L.shadowColor=it.shadowColor;
    if(it.shadowBlur!=null) L.shadowBlur=it.shadowBlur; if(it.shadowDist!=null) L.shadowDist=it.shadowDist; if(it.shadowAngle!=null) L.shadowAngle=it.shadowAngle;
    if(it.shadowSpread) L.shadowSpread=it.shadowSpread; }
  if(it.innerShadow){ L.innerShadow=true; L.innerShadowColor=it.innerShadowColor;
    if(it.innerShadowBlur!=null) L.innerShadowBlur=it.innerShadowBlur; if(it.innerShadowDist!=null) L.innerShadowDist=it.innerShadowDist; if(it.innerShadowAngle!=null) L.innerShadowAngle=it.innerShadowAngle;
    if(it.innerShadowSpread) L.innerShadowSpread=it.innerShadowSpread; }
  if(it.glow){ L.glow=true; L.glowColor=it.glowColor; if(it.glowSize!=null) L.glowSize=it.glowSize;
    if(it.glowSpread) L.glowSpread=it.glowSpread; }
  if(it.overlay){ L.overlay=true; L.overlayColor=it.overlayColor; if(it.overlayOpacity!=null) L.overlayOpacity=it.overlayOpacity; }
  if(it.innerGlow){ L.innerGlow=true; L.innerGlowColor=it.innerGlowColor; if(it.innerGlowSize!=null) L.innerGlowSize=it.innerGlowSize; }
  if(it.bevel){ L.bevel=true; L.bevelSize=it.bevelSize; L.bevelHighlight=it.bevelHighlight; L.bevelShadow=it.bevelShadow; if(it.bevelAngle!=null) L.bevelAngle=it.bevelAngle; }
  if(it.gradientOverlay){ L.gradientOverlay=it.gradientOverlay; }
  if(it.strokeW){ L.strokeW=it.strokeW; L.strokeColor=it.strokeColor||'#000000'; if(it.strokeAlign) L.strokeAlign=it.strokeAlign;
    if(it.strokeDash) L.strokeDash=it.strokeDash; if(it.strokeCap) L.strokeCap=it.strokeCap; if(it.strokeJoin) L.strokeJoin=it.strokeJoin; }
  return L;
}
function dItemToLayer(it){
  const base={ id:'l-psd-'+it.n+'-'+(it.x+it.y), name:it.name, x:it.x,y:it.y,w:it.w,h:it.h, visible:it.visible, opacity:it.opacity };
  if(it._groupChain&&it._groupChain.length)base.parentId=it._groupChain[it._groupChain.length-1].id;
  // fillOpacity sem efeitos ≡ opacity; com efeitos, só o fill deveria atenuar (não os efeitos) →
  // não é representável no modelo atual, marca p/ P3 rasterizar fiel.
  if(it.fillOpacity!=null && it.fillOpacity<1){
    const _hasFx=it.shadow||it.innerShadow||it.glow||it.innerGlow||it.bevel||it.overlay||it.gradientOverlay||it.strokeW;
    if(!_hasFx) base.opacity=Math.round((it.opacity!=null?it.opacity:100)*it.fillOpacity);
    else it.needsRaster=true;
  }
  if(it.mask) base.mask=it.mask;
  if(it.clipBaseId){ base.clipBaseId=it.clipBaseId; if(it.clipBaseSnapshot)base.clipBaseSnapshot=it.clipBaseSnapshot; if(it.clipOwnMask)base.clipOwnMask=it.clipOwnMask; }
  if(it.blendMode) base.blendMode=it.blendMode;
  if(it.kind==='adjustment'){
    return Object.assign(base,{type:'adjustment',adjustment:JSON.parse(JSON.stringify(it.adjustment||{})),adjustmentSupported:it.adjustmentSupported!==false,adjustmentApprox:!!it.adjustmentApprox});
  }
  // Modo MOLDURA DE FOTO (escolhido na revisão): a camada — forma ou imagem — vira um frame que o
  // franqueado preenche com foto. Preserva x/y/w/h; formato do frame herdado da forma original.
  if(it.mode==='frame'){
    // imgUrl da própria camada como conteúdo PADRÃO da moldura: o renderizador do franqueado e o
    // do editor caem em l.imgUrl quando não há foto no campo (png-generator.js:708, canvas.js:1212),
    // então a arte do PSD continua aparecendo e a foto do franqueado só a SUBSTITUI. Antes a
    // moldura nascia vazia e virar moldura APAGAVA a imagem importada — perda silenciosa.
    const F=Object.assign(base,{type:'frame', imgUrl:it.imgUrl||'', imgVar:it.varName||'foto_produto', objectFit:'cover', shapeKind:it.shapeKind||'rect'});
    if(it.radius) F.radius=it.radius;
    if(it.radii) F.radii=it.radii;
    if(it.points) F.points=it.points;
    if(it.sides) F.sides=it.sides;
    if(it.inner) F.inner=it.inner;
    return _dPsdApplyFx(F, it);
  }
  if(it.needsRaster && it.imgUrl){
    return _dPsdApplyFx(Object.assign(base,{type:'image',imgUrl:it.imgUrl,imgVar:'',objectFit:'cover',frameShape:'rect'}), it);
  }
  if(it.kind==='text'){
    if(it.mode==='raster' && it.imgUrl) return _dPsdApplyFx(Object.assign(base,{type:'image',imgUrl:it.imgUrl,imgVar:'',objectFit:'cover',frameShape:'rect'}), it);
    const isVar=it.mode==='var';
    const L=Object.assign(base,{ type:'text',
      content: isVar ? '{{'+(it.varName||'variavel')+'}}' : it.content,
      font:it.font, fontSize:it.fontSize, color:it.color, textAlign:it.textAlign, isVar:isVar });
    _dPsdApplyFx(L, it);
    if(it.strikethrough){ L.strikethrough=true; }
    if(it.underline){ L.underline=true; }
    if(it.textTransform) L.textTransform=it.textTransform;
    if(it.fontWeightOverride) L.fontWeightOverride=it.fontWeightOverride;
    if(it.textBox==='box'){ L.textBox='box'; } // paragraph → editor encaixa na caixa
    if(it.vAlign) L.vAlign=it.vAlign;           // ancoragem vertical (top) importada do PSD
    if(it.italic) L.italic=true;                // font-style itálico
    if(it.letterSpacing!=null) L.letterSpacing=it.letterSpacing;
    if(it.lineHeight) L.lineHeight=it.lineHeight;
    if(it.runs && !isVar) L.runs=it.runs;       // texto multi-estilo (não p/ variável)
    if(it.gradient) L.gradient=it.gradient;     // preenchimento por gradiente no texto
    return L;
  }
  if(it.kind==='shape' && it.mode==='shape'){
    const S=Object.assign(base,{type:'shape',fill:it.fill||'#FF9000',radius:it.radius||0,shapeKind:it.shapeKind||'rect'});
    if(it.radii) S.radii=it.radii;                                  // cantos por canto
    if(it.gradient) S.gradient=it.gradient;                         // gradiente
    _dPsdApplyFx(S, it);                                            // traçado(+align)/sombra/glow/overlay
    return S;
  }
  return _dPsdApplyFx(Object.assign(base,{type:'image',imgUrl:it.imgUrl,imgVar:'',objectFit:'cover',frameShape:'rect'}), it);
}

// Converte folhas + árvore estrutural numa lista plana compatível com `dLayers`. O marcador do
// grupo entra logo após seu último descendente (mesma convenção de dGroupSelected), preservando
// z-order e permitindo grupos aninhados sem expô-los como falsas "imagens" na revisão do PSD.
function dPsdItemsToLayers(items, previewOriginalText){
  const src=items||[], leaves=[], groups=new Map();
  src.forEach((it,idx)=>{
    const use=(previewOriginalText&&it.kind==='text'&&it.mode==='var')?Object.assign({},it,{mode:'text'}):it;
    const layer=dItemToLayer(use); if(!layer)return;
    leaves.push({layer,item:it,idx});
    (it._groupChain||[]).forEach((g,depth)=>{
      let rec=groups.get(g.id);
      if(!rec){rec={g,depth,last:-1};groups.set(g.id,rec);}
      rec.last=leaves.length-1;
    });
  });
  const ends={}; groups.forEach(rec=>{(ends[rec.last]||(ends[rec.last]=[])).push(rec);});
  const out=[];
  leaves.forEach((rec,i)=>{
    out.push(rec.layer);
    const close=ends[i]; if(!close)return;
    close.sort((a,b)=>b.depth-a.depth).forEach(({g})=>out.push(JSON.parse(JSON.stringify(g))));
  });
  return out;
}
