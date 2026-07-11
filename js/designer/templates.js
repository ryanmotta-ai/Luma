/**
 * js/designer/templates.js
 *
 * Estado e CRUD de templates/pastas: dFolders, dInit, dRenderFolders,
 * dLoadTemplateById, dBuildLayers, dLoadTemplate, dOpenNewFolder, dConfirmTemplate.
 * Depende de: 00-config.js
 */

/* ══════════════════════════════════════════════════════════════
   DESIGNER — estado
══════════════════════════════════════════════════════════════ */
// DFORMATS removido — usar DFMT_SIZES
let dFmt='story',dZoomLevel=100,dLayers=[],dSelId=null,dTool='select';
let dDrag=null,dDragSX,dDragSY,dLyrSX,dLyrSY,dDragGroup=[],dDragGroupStart=[],dDragMulti=[];
let dResize=null,dResizeSX,dResizeSY,dResizeW,dResizeH;
let dVars=[],dAssets=[],dLyrCnt=100,dActiveTab='campaigns';
let dFolders=[],dActiveTmplId=null,dFolderOpen={};
let dArtboards=[],dActiveABId=null,dUseArtboards=true;

// Garante que o contador de ids nunca fique atrás dos ids 'l-N' já existentes
// (layers restaurados do localStorage / carregados de template) — senão ++dLyrCnt
// gera id duplicado e find(x=>x.id===…) passa a acertar sempre a primeira camada.
function dSyncLyrCnt(layers){
  (layers||[]).forEach(l=>{
    const m=/^l-(\d+)$/.exec(l&&l.id||'');
    if(m) dLyrCnt=Math.max(dLyrCnt, parseInt(m[1],10));
  });
}

function dDefaultFolders(){
  const camps=[...CAMPS_ATIVAS,...CAMPS_OUTRAS];
  // Pastas das campanhas começam VAZIAS — o designer cria os materiais de cada uma.
  // Inclui metadados de cada campanha: perguntas, preview, badge, etc.
  dFolders=camps.map((c,i)=>({
    id:'f'+i,name:c.name,color:c.color,campId:c.id,cover:c.cover||'',grupos:['Todos os usuários'],agendamento:null,
    badge:c.badge||'',expiraDias:c.expiraDias||7,popular:c.popular||false,
    previewProd:c.previewProd||'',previewDe:c.previewDe||'',previewPor:c.previewPor||'',
    perguntas:c.perguntas||[],
    templates:[]
  }));
  // ÚNICA exceção: uma pasta de exemplo com UM template-modelo pronto, que demonstra
  // as ferramentas da plataforma (texto+variáveis, formas, moldura de foto, badge, etc.).
  const exMeta=dDefaultPublishMeta();
  exMeta.publicado=true;
  exMeta.publicadoEm=Date.now();
  exMeta.instrucoes='Template de exemplo — use como ponto de partida pra aprender as ferramentas. Edite à vontade.';
  exMeta.permissoes={
    produto:{edit:true,maxLen:32}, precoPor:{edit:true,maxLen:14}, precoDe:{edit:true,maxLen:14},
    detalhes:{edit:true,maxLen:40}, validade:{edit:false,maxLen:40},
    foto_produto:{edit:true,maxLen:0}, logo_loja:{edit:true,maxLen:0},
  };
  dFolders.push({
    id:'f-modelo',name:'⭐ Modelo de exemplo',color:'#C8102E',campId:'',cover:'',
    grupos:['Todos os usuários'],agendamento:null,
    templates:[
      {id:'t-modelo-story',name:'Modelo — Story',fmt:'story',layers:dBuildShowcaseLayers('story'),publishMeta:JSON.parse(JSON.stringify(exMeta))},
    ]
  });
}
// Template-modelo polido (showcase): demonstra formas, moldura, texto com variáveis,
// contorno pra legibilidade, badge de preço e selo. Usado na pasta "Modelo de exemplo"
// e pelo botão "Abrir modelo de exemplo" da aba Tutorial.
function dBuildShowcaseLayers(fmt){
  const f=DFMT_SIZES[fmt]||DFMT_SIZES.story;
  const W=f.w,H=f.h, U=Math.min(W,H);
  const cx=Math.round(W/2);
  return [
    // Fundo + faixa inferior (formas)
    {id:'l-bg',name:'Fundo',type:'shape',x:0,y:0,w:W,h:H,fill:'#C8102E',opacity:100,radius:0,visible:true},
    {id:'l-band',name:'Faixa laranja',type:'shape',x:0,y:Math.round(H*.70),w:W,h:H-Math.round(H*.70),fill:'#FF9000',opacity:100,radius:0,visible:true},
    // Moldura da foto (variável de imagem foto_produto)
    {id:'l-frame',name:'Foto do produto',type:'frame',x:Math.round(W*.06),y:Math.round(H*.06),w:Math.round(W*.88),h:Math.round(H*.42),imgUrl:'',imgVar:'foto_produto',objectFit:'cover',frameShape:'rounded',radius:24,visible:true},
    // Selo (forma estrela) — demonstra formas avançadas
    {id:'l-selo',name:'Selo (estrela)',type:'shape',shapeKind:'star',points:12,inner:0.74,x:W-Math.round(U*.30),y:Math.round(H*.40),w:Math.round(U*.26),h:Math.round(U*.26),fill:'#FFB900',opacity:100,radius:0,visible:true},
    {id:'l-selo-txt',name:'Texto do selo',type:'text',x:W-Math.round(U*.30),y:Math.round(H*.40)+Math.round(U*.085),w:Math.round(U*.26),h:Math.round(U*.09),content:'OFERTA',font:"'Roboto Black'",fontSize:Math.round(U*.045),color:'#C8102E',textAlign:'center',visible:true},
    // Título (variável de texto) com contorno pra legibilidade
    {id:'l-title',name:'Título (produto)',type:'text',x:Math.round(W*.06),y:Math.round(H*.50),w:Math.round(W*.62),h:Math.round(U*.16),content:'{{produto}}',font:"'Roboto Black'",fontSize:Math.round(U*.105),color:'#FFFFFF',textAlign:'left',strokeW:3,strokeColor:'#7A0C1E',isVar:true,visible:true},
    {id:'l-detail',name:'Detalhes',type:'text',x:Math.round(W*.06),y:Math.round(H*.50)+Math.round(U*.16),w:Math.round(W*.62),h:Math.round(U*.07),content:'{{detalhes}}',font:"'Roboto'",fontSize:Math.round(U*.042),color:'rgba(255,255,255,.9)',textAlign:'left',isVar:true,visible:true},
    // Linha decorativa (ferramenta linha)
    {id:'l-line',name:'Linha',type:'shape',x:Math.round(W*.06),y:Math.round(H*.685),w:Math.round(W*.88),h:4,fill:'#FFFFFF',opacity:90,radius:2,visible:true},
    // Badge de preço (forma círculo) + preços (de/por)
    {id:'l-badge',name:'Badge preço',type:'shape',shapeKind:'circle',x:W-Math.round(U*.40),y:Math.round(H*.72),w:Math.round(U*.34),h:Math.round(U*.34),fill:'#FFFFFF',opacity:100,radius:999,visible:true},
    {id:'l-de',name:'Preço de',type:'text',x:W-Math.round(U*.40),y:Math.round(H*.745),w:Math.round(U*.34),h:Math.round(U*.06),content:'DE {{precoDe}}',font:"'Roboto'",fontSize:Math.round(U*.04),color:'#C8102E',textAlign:'center',strikethrough:true,visible:true},
    {id:'l-por',name:'Preço por',type:'text',x:W-Math.round(U*.40),y:Math.round(H*.775),w:Math.round(U*.34),h:Math.round(U*.16),content:'R$\n{{precoPor}}',font:"'Roboto Black'",fontSize:Math.round(U*.1),color:'#C8102E',textAlign:'center',isVar:true,visible:true},
    // Texto principal da faixa
    {id:'l-chamada',name:'Chamada',type:'text',x:Math.round(W*.06),y:Math.round(H*.74),w:Math.round(W*.52),h:Math.round(U*.10),content:'APROVEITE\nHOJE',font:"'Roboto Black'",fontSize:Math.round(U*.075),color:'#FFFFFF',textAlign:'left',visible:true},
    // Validade (variável com valor padrão) + logo + rodapé
    {id:'l-validade',name:'Validade',type:'text',x:Math.round(W*.06),y:Math.round(H*.74)+Math.round(U*.11),w:Math.round(W*.52),h:Math.round(U*.05),content:'{{validade}}',font:"'Roboto'",fontSize:Math.round(U*.032),color:'rgba(255,255,255,.85)',textAlign:'left',isVar:true,visible:true},
    {id:'l-logo',name:'Logo da loja',type:'frame',x:W-Math.round(W*.18),y:H-Math.round(H*.07),w:Math.round(W*.12),h:Math.round(W*.10),imgUrl:'',imgVar:'logo_loja',objectFit:'contain',frameShape:'rect',visible:true},
    {id:'l-rodape',name:'Rodapé',type:'text',x:0,y:H-28,w:W,h:22,content:'consulte disponibilidade no app',font:"'Roboto'",fontSize:Math.max(11,Math.round(U*.02)),color:'rgba(255,255,255,.6)',textAlign:'center',visible:true},
  ];
}
// Pré-carrega pastas no boot pra o franqueado já poder ver materiais sem entrar no designer
function dPreloadFolders(){
  // Garante dVars defaults pra o franqueado conseguir identificar variáveis tipo image.
  // Restaura o catálogo salvo (3.3/3.4: defaultValue, ordem e tipos custom sobrevivem ao reload).
  if(!dVars || !dVars.length){
    if(typeof dRestoreVars!=='function' || !dRestoreVars()){
      dVars=[
        {name:'produto',label:'Produto',type:'text',required:true},
        {name:'precoPor',label:'Preço Promo',type:'number',required:true},
        {name:'precoDe',label:'Preço Original',type:'number',required:false},
        {name:'validade',label:'Validade',type:'text',required:false,defaultValue:'Promoção por tempo limitado'},
        {name:'foto_produto',label:'Foto do produto',type:'image',required:false},
        {name:'logo_loja',label:'Logo da loja',type:'image',required:false},
      ];
    }
  }
  if(typeof dFieldsEnsureMeta==='function') dFieldsEnsureMeta();
  // Restaura/registra fontes enviadas (também no boot, pra o PNG do franqueado usá-las)
  if(typeof dFontsRestore==='function') dFontsRestore();
  if(dFolders && dFolders.length) return; // já carregado
  dDefaultFolders();
  try{
    const saved=localStorage.getItem('yngs_folders_v1');
    if(saved){
      const parsed=JSON.parse(saved);
      if(parsed&&parsed.length) dFolders=parsed;
    }
  }catch(e){}
  // Merge com CAMPS pra preencher campos faltantes (perguntas, badge, etc)
  const campsMap={};
  [...CAMPS_ATIVAS,...CAMPS_OUTRAS].forEach(c=>{campsMap[c.id]=c;});
  dFolders.forEach(f=>{
    if(f.campId && campsMap[f.campId]){
      const c=campsMap[f.campId];
      // Capa oficial da campanha (constantes) preenche pastas que ainda não têm capa própria
      if(!f.cover && c.cover) f.cover=c.cover;
      if(!f.perguntas) f.perguntas=c.perguntas||[];
      if(!f.badge) f.badge=c.badge||'';
      if(!f.expiraDias) f.expiraDias=c.expiraDias||7;
      if(f.popular===undefined) f.popular=c.popular||false;
      if(!f.previewProd) f.previewProd=c.previewProd||'';
      if(!f.previewDe) f.previewDe=c.previewDe||'';
      if(!f.previewPor) f.previewPor=c.previewPor||'';
    }
  });
  // Migração: garante que templates antigos tenham permissões pra fotos
  dFolders.forEach(f=>{
    if(!Array.isArray(f.templates)) f.templates=[]; // pasta legada/corrompida sem 'templates' não derruba o boot
    f.templates.forEach(t=>{
      if(!t.publishMeta) t.publishMeta = dDefaultPublishMeta();
      if(!t.publishMeta.permissoes) t.publishMeta.permissoes = {};
      // Se o template usa foto_produto ou logo_loja nos layers, garante permissão pra editar
      const vars = dExtractTemplateVars(t.layers||[]);
      vars.forEach(v=>{
        if((v==='foto_produto' || v==='logo_loja') && !t.publishMeta.permissoes[v]){
          t.publishMeta.permissoes[v] = {edit:true, maxLen:0};
        }
      });
      // 5.2 — migração absoluto→relativo: infere a âncora de cada layer a partir do
      // formato nativo do template; o template passa a poder gerar todos os formatos.
      // Template 1:1 do PSD (fmt sem preset) usa o w/h real guardado no template.
      if(typeof gEnsureAnchors==='function'){
        const sz=DFMT_SIZES[t.fmt]||((t.w>0&&t.h>0)?{w:t.w,h:t.h}:DFMT_SIZES.story);
        gEnsureAnchors(t.layers||[], sz.w, sz.h);
      }
      if(!t.formats) t.formats=['story','feed','wide']; // smart resize cobre os 3
    });
  });
  // Re-hidrata imagens grandes (fundos PSD) guardadas no IndexedDB como 'idb://...' → dataURL real,
  // depois re-renderiza pra mostrar os fundos (some o reload sem fundo). Fire-and-forget.
  if(typeof gHydrateFolders==='function'){
    gHydrateFolders(dFolders).then(changed=>{
      if(!changed) return;
      if(typeof dRenderFolders==='function') dRenderFolders();
      if(typeof fUpdateLivePreview==='function') try{ fUpdateLivePreview(); }catch(e){}
    });
  }
}
function dDefaultPublishMeta(){
  // Validade default = +30 dias do hoje
  const now=new Date();
  const v=new Date(now.getTime()+30*24*60*60*1000);
  const validade=v.getFullYear()+'-'+String(v.getMonth()+1).padStart(2,'0')+'-'+String(v.getDate()).padStart(2,'0');
  return {
    publicado:false,           // false = só rascunho do designer, true = visível pro franqueado
    publicadoEm:null,           // timestamp da última publicação
    validade,                   // ISO date
    instrucoes:'',              // texto livre que aparece pro franqueado
    permissoes:{}               // {varName: {edit:bool, maxLen:int}}
  };
}
// Extrai nomes de variáveis usadas em um conjunto de layers ({{nome}} no content / imgVar)
function dExtractTemplateVars(layers){
  const vars=new Set();
  (layers||[]).forEach(l=>{
    if(l.content){ const re=gVarRegex(); let m; while((m=re.exec(l.content))) vars.add(m[1].trim()); }
    if(l.imgVar) vars.add(l.imgVar.trim());
  });
  return Array.from(vars);
}
function dBuildLayers(fmt,title,accent){
  const f=DFMT_SIZES[fmt]||DFMT_SIZES.story;
  const mid=Math.round(f.h*.5);
  return [
    {id:'l-bg',name:'Fundo',type:'shape',x:0,y:0,w:f.w,h:f.h,fill:accent,opacity:100,radius:0,visible:true},
    {id:'l-stripe',name:'Stripe laranja',type:'shape',x:0,y:Math.round(f.h*.72),w:f.w,h:Math.round(f.h*.32),fill:'#FF9000',opacity:100,radius:0,visible:true},
    {id:'l-frame',name:'Moldura da foto',type:'frame',x:Math.round(f.w*.05),y:Math.round(f.h*.04),w:Math.round(f.w*.9),h:Math.round(f.h*.44),imgUrl:'',imgVar:'foto_produto',objectFit:'cover',frameShape:'rect',visible:true},
    {id:'l-title',name:'PRODUTO',type:'text',x:16,y:Math.round(f.h*.72)+8,w:f.w-32,h:Math.round(f.w*.14),content:'{{produto}}',font:"'Roboto Black'",fontSize:Math.round(f.w*.11),color:'#FFFFFF',textAlign:'left',isVar:true,visible:true},
    {id:'l-detail',name:'DETALHES',type:'text',x:16,y:Math.round(f.h*.72)+Math.round(f.w*.14)+10,w:f.w-32,h:Math.round(f.w*.07),content:'{{detalhes}}',font:"'Roboto'",fontSize:Math.round(f.w*.042),color:'rgba(255,255,255,0.85)',textAlign:'left',isVar:true,visible:true},
    {id:'l-price-badge',name:'Badge preço',type:'shape',x:f.w-Math.round(f.w*.38)-8,y:Math.round(f.h*.56),w:Math.round(f.w*.38),h:Math.round(f.w*.38),fill:'#FFB900',opacity:100,radius:999,visible:true},
    {id:'l-price-de',name:'Preço De',type:'text',x:f.w-Math.round(f.w*.36)-8,y:Math.round(f.h*.58),w:Math.round(f.w*.34),h:Math.round(f.w*.07),content:'DE {{precoDe}}',font:"'Roboto'",fontSize:Math.round(f.w*.038),color:'#C81818',textAlign:'center',strikethrough:true,visible:true},
    {id:'l-price-por',name:'Preço Por',type:'text',x:f.w-Math.round(f.w*.36)-8,y:Math.round(f.h*.6),w:Math.round(f.w*.34),h:Math.round(f.w*.14),content:'R$\n{{precoPor}}',font:"'Roboto Black'",fontSize:Math.round(f.w*.1),color:'#C81818',textAlign:'center',isVar:true,visible:true},
    {id:'l-logo',name:'Logo loja',type:'frame',x:f.w-80,y:f.h-70,w:60,h:50,imgUrl:'',imgVar:'logo_loja',objectFit:'contain',frameShape:'rect',visible:true},
    {id:'l-rodape',name:'Validade',type:'text',x:0,y:f.h-28,w:f.w,h:22,content:'consulte disponibilidade no app',font:"'Roboto'",fontSize:11,color:'rgba(255,255,255,0.6)',textAlign:'center',visible:true},
  ];
}

// Prancheta em branco: só um fundo neutro (cinza claro) que o designer customiza do zero
function dBuildBlankLayers(fmt){
  const f=DFMT_SIZES[fmt]||DFMT_SIZES.story;
  return [{id:'l-bg-'+Date.now(),name:'Fundo',type:'shape',x:0,y:0,w:f.w,h:f.h,fill:'#F5F5F5',opacity:100,radius:0,visible:true,locked:false}];
}
// Versão com dimensões explícitas (para prancheta desenhada pela ferramenta)
function dBuildBlankLayersWH(w,h){
  return [{id:'l-bg-'+Date.now(),name:'Fundo',type:'shape',x:0,y:0,w,h,fill:'#F5F5F5',opacity:100,radius:0,visible:true,locked:false}];
}


/* ══════════════════════════════════════════════════════════════
   CANVAS ÚNICO — substituiu múltiplas pranchetas
   dArtboards é mantido como array de 1 elemento para retrocompatibilidade.
══════════════════════════════════════════════════════════════ */
let dCanvasBg='',dCustomFmt=null; // dCustomFmt={w,h} para dimensões ad-hoc

function dGetActiveAB(){
  // Tamanho: override ad-hoc (dCustomFmt) > preset do formato. Para formatos SEM preset
  // ('orig' = PSD/custom 1:1), preserva o w/h real já gravado no artboard em vez de
  // colapsar pra 'story' — senão templates importados perdem as dimensões nativas.
  const preset=DFMT_SIZES[dFmt];
  let f=dCustomFmt||preset;
  if(!f) f=(dArtboards.length && dArtboards[0].w>0) ? {w:dArtboards[0].w,h:dArtboards[0].h} : DFMT_SIZES.story;
  if(dArtboards.length){
    dArtboards[0].w=f.w;dArtboards[0].h=f.h;dArtboards[0].fmt=dFmt;
    dArtboards[0].bg=dCanvasBg;dArtboards[0].layers=dLayers;
    return dArtboards[0];
  }
  return {id:'ab-single',name:'Prancheta',x:80,y:60,w:f.w,h:f.h,fmt:dFmt,bg:dCanvasBg,layers:dLayers};
}

function dSyncLayersToAB(){
  if(dArtboards.length) dArtboards[0].layers=dLayers;
}

function dSetActiveAB(){}  // no-op — canvas único

function dNewArtboard(fmt){
  fmt=fmt||dFmt||'story';
  dFmt=fmt;dCustomFmt=null;
  dLayers=dBuildBlankLayers(fmt);
  dSelId=null;if(typeof dMultiSel!=='undefined')dMultiSel=[];
  dHistoryReset();
  const f=DFMT_SIZES[fmt]||DFMT_SIZES.story;
  dArtboards=[{id:'ab-single',name:'Prancheta',x:80,y:60,w:f.w,h:f.h,fmt,bg:dCanvasBg,layers:dLayers}];
  dActiveABId='ab-single';
  if(typeof dRenderWorkspace==='function')dRenderWorkspace();
  dApplyFormat();dRenderCanvas();dRenderLayersList();
  return dArtboards[0];
}

function dDeleteAB(){}    // no-op
function dDuplicateAB(){gToast('⚠ Modo canvas único: operação não disponível');}
function dRenameAB(){}    // no-op
function dRenderABList(){} // no-op — sem lista de pranchetas
function dArrangeGrid(){}  // no-op

function dRenderABProps(){
  const ab=dGetActiveAB();if(!ab)return;
  const wi=document.getElementById('d-ab-w-inp');if(wi)wi.value=ab.w;
  const hi=document.getElementById('d-ab-h-inp');if(hi)hi.value=ab.h;
  const bg=ab.bg||'transparent';
  const isCustom=bg!=='transparent'&&bg!=='white';
  const tBtn=document.getElementById('d-ab-bg-transparent');
  const wBtn=document.getElementById('d-ab-bg-white');
  const cBtn=document.getElementById('d-ab-bg-custom');
  if(tBtn)tBtn.classList.toggle('active',bg==='transparent');
  if(wBtn)wBtn.classList.toggle('active',bg==='white');
  if(cBtn){cBtn.classList.toggle('active',isCustom);cBtn.style.background=isCustom?bg:'';}
  const picker=document.getElementById('d-ab-bg-picker');
  if(picker&&isCustom)picker.value=bg;
  const hexEl=document.getElementById('d-ab-bg-hex');
  if(hexEl)hexEl.textContent=isCustom?bg.toUpperCase():'';
  const isPortrait=ab.h>=ab.w;
  const pBtn=document.getElementById('d-ab-orient-port');
  const lBtn=document.getElementById('d-ab-orient-land');
  if(pBtn)pBtn.classList.toggle('active',isPortrait);
  if(lBtn)lBtn.classList.toggle('active',!isPortrait);
}

function dSetABBg(bg){
  dCanvasBg=bg;
  if(typeof dApplyBg==='function')dApplyBg(dGetActiveAB());
  dRenderABProps();
  if(typeof dPersistArtboards==='function')dPersistArtboards();
  if(typeof dMarkUnsaved==='function')dMarkUnsaved();
}

function dToggleOrientation(){
  const ab=dGetActiveAB();
  const hasContent=dLayers.length>1;
  if(hasContent&&!confirm('Girar a prancheta? As camadas serão adaptadas (smart-resize).'))return;
  if(typeof dHistoryPush==='function')dHistoryPush();
  const oldW=ab.w,oldH=ab.h;
  const newW=oldH,newH=oldW;
  if(hasContent&&typeof gReflowLayers==='function'){
    dLayers=gReflowLayers(dLayers,{w:oldW,h:oldH},{w:newW,h:newH});
  }
  dCustomFmt={w:newW,h:newH};
  dApplyFormat();dRenderCanvas();dRenderLayersList();
  dRenderABProps();
  if(typeof dPersistArtboards==='function')dPersistArtboards();
  if(typeof dMarkUnsaved==='function')dMarkUnsaved();
  gToast('Prancheta: '+newW+'×'+newH+'px');
}

function dSetOrientation(orient){
  const ab=dGetActiveAB();
  if(orient==='portrait'&&ab.w>ab.h)dToggleOrientation();
  else if(orient==='landscape'&&ab.h>ab.w)dToggleOrientation();
}

function dABNameUpdate(){}  // no-op
function dABPosUpdate(){}   // no-op

function dABDimUpdate(){
  const wEl=document.getElementById('d-ab-w-inp');
  const hEl=document.getElementById('d-ab-h-inp');
  if(!wEl||!hEl)return;
  const w=parseInt(wEl.value,10),h=parseInt(hEl.value,10);
  if(!w||!h||w<80||h<80||w>8000||h>8000)return;
  const ab=dGetActiveAB();if(ab.w===w&&ab.h===h)return;
  const oldW=ab.w,oldH=ab.h;
  if(dLayers.length>1&&typeof gReflowLayers==='function'){
    if(confirm('Adaptar camadas ao novo tamanho? (smart-resize)')){
      if(typeof dHistoryPush==='function')dHistoryPush();
      dLayers=gReflowLayers(dLayers,{w:oldW,h:oldH},{w,h});
    }
  }
  dCustomFmt={w,h};
  dApplyFormat();dRenderCanvas();
  dRenderABProps();
  if(typeof dMarkUnsaved==='function')dMarkUnsaved();
  if(typeof dPersistArtboards==='function')dPersistArtboards();
}

function dPersistArtboards(){
  let droppedImg=false;
  try{
    const saveable=dLayers.map(l=>{
      const packed=gPackImgUrl(l.imgUrl);
      if(packed.dropped)droppedImg=true;
      const out={...l,imgUrl:packed.url};
      if(l.mask){ const pm=gPackMask(l.mask); if(pm.dropped){ delete out.mask; droppedImg=true; } else out.mask=pm.url; }
      return out;
    });
    localStorage.setItem('yngs_layers_v1',JSON.stringify(saveable));
    localStorage.setItem('yngs_fmt_v1',dFmt);
    localStorage.setItem('yngs_bg_v1',dCanvasBg||'');
    // Tamanho real da prancheta ativa — preserva dimensões custom (PSD 1:1) no reload.
    const _ab=(typeof dGetActiveAB==='function')?dGetActiveAB():null;
    if(_ab&&_ab.w>0&&_ab.h>0) localStorage.setItem('yngs_wh_v1', _ab.w+'x'+_ab.h);
    if(droppedImg&&typeof gWarnImagesNotPersisted==='function')gWarnImagesNotPersisted();
    return true;
  }catch(e){
    if(e&&(e.name==='QuotaExceededError'||e.code===22))
      gToast('⚠ Não foi possível salvar: armazenamento cheio.','error');
    else gToast('⚠ Não foi possível salvar a prancheta — tente de novo.','error');
    return false;
  }
}

let dInited=false;
function dInit(){
  if(dInited)return;
  dInited=true;
  // Só recarrega dFolders se ainda não foram inicializadas (dPreloadFolders cuida no boot)
  if(!dFolders || !dFolders.length){
    dDefaultFolders();
    // Tentar restaurar pastas salvas
    try{
      const saved=localStorage.getItem('yngs_folders_v1');
      if(saved){const parsed=JSON.parse(saved);if(parsed&&parsed.length)dFolders=parsed;}
    }catch(e){}
  }
  // Inicializa dVars se ainda não foi (idempotente — dPreloadFolders também faz isso)
  if(!dVars || !dVars.length){
    if(typeof dRestoreVars!=='function' || !dRestoreVars()){
      dVars=[
        {name:'produto',label:'Produto',type:'text',required:true},
        {name:'precoPor',label:'Preço Promo',type:'number',required:true},
        {name:'precoDe',label:'Preço Original',type:'number',required:false},
        {name:'validade',label:'Validade',type:'text',required:false,defaultValue:'Promoção por tempo limitado'},
        {name:'foto_produto',label:'Foto do produto',type:'image',required:false},
        {name:'logo_loja',label:'Logo da loja',type:'image',required:false},
      ];
    }
  }
  if(typeof dFieldsEnsureMeta==='function') dFieldsEnsureMeta();
  if(!dAssets || !dAssets.length){
    dAssets=[{name:'logo-dm.png',url:'',emoji:'◆'},{name:'bg-laranja.jpg',url:'',emoji:'◇'}];
  }
  dHistory=[];dHistoryIdx=-1;
  dRenderFolders();
  dVarsRender();dAssetsRender();
  if(typeof dLoadSnippets==='function'){dLoadSnippets();dRenderSnippets();}
  if(typeof dFontsRestore==='function'){dFontsRestore();dFontsRenderList();}
  // Canvas único: restaurar layers/formato ou começar em branco
  let loaded=false;
  try{
    const savedLayers=localStorage.getItem('yngs_layers_v1');
    if(savedLayers){
      const parsed=JSON.parse(savedLayers);
      if(parsed&&Array.isArray(parsed)&&parsed.length){
        dLayers=parsed;
        dFmt=localStorage.getItem('yngs_fmt_v1')||'story';
        dCanvasBg=localStorage.getItem('yngs_bg_v1')||'';
        loaded=true;
      }
    }
  }catch(e){}
  // Migração do formato legado yngs_artboards_v1
  if(!loaded){
    try{
      const savedABs=localStorage.getItem('yngs_artboards_v1');
      if(savedABs){
        const parsed=JSON.parse(savedABs);
        if(parsed&&parsed.length){
          const ab=parsed[0];
          dLayers=JSON.parse(JSON.stringify(ab.layers||[]));
          dFmt=ab.fmt||'story';dCanvasBg=ab.bg||'';
          loaded=true;
          dPersistArtboards();
          localStorage.removeItem('yngs_artboards_v1');
        }
      }
    }catch(e){}
  }
  dSyncLyrCnt(dLayers); // sem isso, dLyrCnt=100 recria ids 'l-101'… que já existem nos layers restaurados
  let _initF=DFMT_SIZES[dFmt]||DFMT_SIZES.story;
  // Tamanho custom (PSD 1:1, fmt sem preset) salvo em yngs_wh_v1 → restaura as dimensões reais.
  if(!DFMT_SIZES[dFmt]){
    try{ const _wh=localStorage.getItem('yngs_wh_v1'); if(_wh){ const p=_wh.split('x'); const cw=+p[0],ch=+p[1]; if(cw>0&&ch>0) _initF={w:cw,h:ch}; } }catch(e){}
  }
  dCustomFmt=null; // limpa override ad-hoc de uma sessão anterior; o tamanho real ('orig') fica em dArtboards[0].w/h
  dArtboards=[{id:'ab-single',name:'Prancheta',x:80,y:60,w:_initF.w,h:_initF.h,fmt:dFmt,bg:dCanvasBg,layers:dLayers}];
  dActiveABId='ab-single';
  // Re-hidrata fundos grandes (idb://) da prancheta ativa e das pastas; re-renderiza quando prontos.
  if(typeof gHydrateLayers==='function'){
    gHydrateLayers(dLayers).then(changed=>{ if(changed && typeof dRenderCanvas==='function') dRenderCanvas(); });
  }
  if(typeof gHydrateFolders==='function'){
    gHydrateFolders(dFolders).then(changed=>{ if(changed && typeof dRenderFolders==='function') dRenderFolders(); });
  }
  dHistoryReset();
  if(!loaded){dLayers=dBuildBlankLayers(dFmt);}
  if(typeof dRenderWorkspace==='function')dRenderWorkspace();
  dApplyFormat();dRenderCanvas();dRenderLayersList();
  setTimeout(() => { if (typeof dSetZoom === 'function') dSetZoom(28); else dFitToScreen(); }, 100);
  setTimeout(dEnsurePaintCanvas,100);
  // Campanhas/Biblioteca agora são abas do painel direito (#d-right); a aba Campanhas já abre por padrão
}

/* ── PASTAS (árvore de campanhas: card com capa + menu, expande templates inline) ── */
let dCampaignQuery='';            // filtro de busca de campanhas
let dImportTargetFolderId=null;   // pasta-alvo de um import disparado pelo card

// Logos reais do Adobe (em assets/adobe-logos)
const D_LOGO_PS='assets/adobe-logos/Adobe_Photoshop_CC_2026_icon.svg.png';
const D_LOGO_AI='assets/adobe-logos/novo-logo-adobe-ai-2020.jpg';

// Ícones reutilizáveis (chevron / kebab) — desenhados, nada de emoji que renderiza torto no Windows
const _DC_CHEV=`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>`;
const _DC_KEBAB=`<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>`;

// Busca: filtra campanhas pelo nome e re-renderiza
function dFilterCampaigns(q){
  dCampaignQuery=(q||'').trim().toLowerCase();
  dRenderFolders();
}

// Dispara importação já mirando uma campanha específica
function dImportToFolder(folderId, kind){
  dImportTargetFolderId=folderId;
  if(kind==='psd'){ const inp=document.getElementById('d-psd-input'); if(inp) inp.click(); }
  else { dSvgImport(); }
}

function dRenderFolders(){
  const el=document.getElementById('d-folder-list');
  if(!el) return;
  el.className='d-campaign-tree';
  const q=dCampaignQuery;
  const list=q ? dFolders.filter(f=>(f.name||'').toLowerCase().includes(q)) : dFolders;

  // Empty states
  if(!dFolders.length){
    el.innerHTML=`<div class="dc-empty">
      <div class="dc-empty-ico"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg></div>
      <div class="dc-empty-title">Nenhuma campanha ainda</div>
      <div class="dc-empty-text">Crie sua primeira campanha para organizar os materiais.</div>
      <button class="dc-empty-cta" onclick="dOpenNewFolder()">+ Nova campanha</button>
    </div>`;
    return;
  }
  if(!list.length){
    el.innerHTML=`<div class="dc-empty">
      <div class="dc-empty-ico"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
      <div class="dc-empty-title">Nada encontrado</div>
      <div class="dc-empty-text">Nenhuma campanha com “${gEsc(q)}”.</div>
    </div>`;
    return;
  }

  el.innerHTML=list.map(f=>{
    const open=dFolderOpen[f.id];
    const cover=(f.cover&&f.cover!=='__local__')?f.cover:'';
    const total=f.templates.length;
    const pub=f.templates.filter(t=>t.publishMeta&&t.publishMeta.publicado).length;
    const thumbStyle=cover
      ? `background-image:url('${cover}')`
      : `background:linear-gradient(135deg, ${f.color||'#FF9000'}, ${(f.color||'#FF9000')}99)`;
    const thumbInner=cover ? '' : `<span class="dc-thumb-letter">${gEsc(((f.name||'?').trim()[0]||'?')).toUpperCase()}</span>`;
    const metaTxt = total ? `${total} material${total!==1?'is':''}${pub?` · ${pub} no ar`:''}` : 'Vazia';

    const header=`
      <div class="dc-camp ${open?'open':''} ${f.id===dActiveTmplFolderId?'active':''}" id="fi-${f.id}" onclick="dToggleFolder('${f.id}')" title="${gEsc(f.name)}">
        <span class="dc-chev">${_DC_CHEV}</span>
        <div class="dc-thumb" style="${thumbStyle}">${thumbInner}</div>
        <div class="dc-camp-info">
          <span class="dc-camp-name">${gEsc(f.name)}</span>
          <span class="dc-camp-meta">${metaTxt}</span>
        </div>
        <button class="dc-menu" onclick="event.stopPropagation();dFolderMenu(event,'${f.id}')" title="Opções da campanha" aria-label="Opções da campanha">${_DC_KEBAB}</button>
      </div>`;

    const body = open ? `
      <div class="dc-body">
        <div class="dc-import-row">
          <button class="dc-import" onclick="dImportToFolder('${f.id}','psd')" title="Importar PSD nesta campanha">
            <img src="${D_LOGO_PS}" alt="" class="dc-import-logo"> Importar PSD
          </button>
          <button class="dc-import" onclick="dImportToFolder('${f.id}','svg')" title="Importar SVG/AI nesta campanha">
            <img src="${D_LOGO_AI}" alt="" class="dc-import-logo"> Importar SVG
          </button>
        </div>
        ${total?f.templates.map(t=>{
          const isPub=t.publishMeta&&t.publishMeta.publicado;
          return `<div class="dc-tmpl ${t.id===dActiveTmplId?'active':''}">
            <button class="dc-tmpl-main" onclick="dLoadTemplateById('${f.id}','${t.id}')">
              <span class="dc-tmpl-dot ${isPub?'pub':'draft'}" title="${isPub?'Publicado':'Rascunho'}"></span>
              <span class="dc-tmpl-name" title="${gEsc(t.name)}">${gEsc(t.name)}</span>
              <span class="dc-tmpl-fmt">${gEsc(t.fmt)}</span>
            </button>
            <button class="dc-tmpl-menu" onclick="event.stopPropagation();dTemplateMenuOpen(event,'${f.id}','${t.id}')" aria-label="Mais opções">${_DC_KEBAB}</button>
          </div>`;
        }).join(''):`<div class="dc-tmpl-empty">Sem materiais — importe um PSD/SVG acima.</div>`}
      </div>` : '';

    return `<div class="dc-item">${header}${body}</div>`;
  }).join('');

  dFolders.forEach(f=>{ const node=document.getElementById('fi-'+f.id); if(node) node.__folder=f; });
}
let dActiveTmplFolderId=null;
function dLoadTemplateById(folderId, tmplId){
  const f = dFolders.find(x=>x.id===folderId);
  if(!f) return;
  const t = f.templates.find(x=>x.id===tmplId);
  if(t) dLoadTemplate(t, f);
}
// Menu de ações rápidas do template
function dTemplateMenuOpen(ev, folderId, tmplId){
  ev.preventDefault();
  // Fecha qualquer menu aberto
  document.querySelectorAll('.tmpl-context-menu').forEach(m=>m.remove());
  const f = dFolders.find(x=>x.id===folderId); if(!f) return;
  const t = f.templates.find(x=>x.id===tmplId); if(!t) return;
  const isPublished = t.publishMeta?.publicado;
  const menu = document.createElement('div');
  menu.className = 'tmpl-context-menu';
  menu.innerHTML = `
    <button class="tmpl-ctx-item" onclick="dQuickEditValidade('${folderId}','${tmplId}')">
      <span class="tmpl-ctx-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>Editar validade
    </button>
    <button class="tmpl-ctx-item" onclick="dQuickEditPerms('${folderId}','${tmplId}')">
      <span class="tmpl-ctx-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>Editar permissões
    </button>
    ${isPublished
      ? `<button class="tmpl-ctx-item" onclick="dToggleTemplatePublish('${folderId}','${tmplId}',false)"><span class="tmpl-ctx-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></span>Despublicar</button>`
      : `<button class="tmpl-ctx-item" onclick="dToggleTemplatePublish('${folderId}','${tmplId}',true)"><span class="tmpl-ctx-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M4.5 16.5c-1.5 1.25-2.5 3.5-2.5 3.5s2.25-1 3.5-2.5L18.5 4.5 19.5 5.5zm11-11l-3 3M9 12l-3 3"/></svg></span>Publicar agora</button>`
    }
    <div class="tmpl-ctx-sep"></div>
    <button class="tmpl-ctx-item tmpl-ctx-danger" onclick="dDeleteTemplate('${folderId}','${tmplId}')">
      <span class="tmpl-ctx-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></span>Excluir
    </button>
  `;
  document.body.appendChild(menu);
  // Posiciona próximo ao botão
  const rect = ev.target.getBoundingClientRect();
  menu.style.left = Math.min(rect.left, window.innerWidth - 220) + 'px';
  menu.style.top = (rect.bottom + 4) + 'px';
  // Fecha ao clicar fora
  setTimeout(()=>{
    // Fecha em qualquer clique seguinte (o onclick do item já disparou no bubble antes daqui),
    // garantindo que o menu suma também ao clicar num item — não só ao clicar fora.
    const closeOnOut = ()=>{
      menu.remove();
      document.removeEventListener('click', closeOnOut);
    };
    document.addEventListener('click', closeOnOut);
  }, 0);
}
function dToggleTemplatePublish(folderId, tmplId, publicar){
  const f=dFolders.find(x=>x.id===folderId); if(!f) return;
  const t=f.templates.find(x=>x.id===tmplId); if(!t) return;
  if(!t.publishMeta) t.publishMeta = dDefaultPublishMeta();
  t.publishMeta.publicado = publicar;
  if(publicar) t.publishMeta.publicadoEm = Date.now();
  dPersistFolders();
  dRenderFolders();
  document.querySelectorAll('.tmpl-context-menu').forEach(m=>m.remove());
  gToast(publicar ? 'Material publicado!' : 'Material despublicado.');
}
/* ── Deleção no Supabase (fire-and-forget, mesmo padrão de fonts.js) ── */
function _dSbTmpl(){ return (typeof gSupabase==='function')?gSupabase():window.sb; }
async function dDeleteTemplateFromBackend(remoteId){
  const sb=_dSbTmpl();
  if(!sb || !remoteId || typeof gIsAdmin!=='function' || !gIsAdmin()) return;
  try{ await sb.schema('luma').from('templates').delete().eq('id', remoteId); }catch(e){}
}
async function dDeleteFolderFromBackend(remoteId){
  const sb=_dSbTmpl();
  if(!sb || !remoteId || typeof gIsAdmin!=='function' || !gIsAdmin()) return;
  try{
    await sb.schema('luma').from('templates').delete().eq('pasta_id', remoteId);
    await sb.schema('luma').from('pastas').delete().eq('id', remoteId);
  }catch(e){}
}
function dDeleteTemplate(folderId, tmplId){
  if(!confirm('Excluir este template? Ação não pode ser desfeita.')) return;
  const f=dFolders.find(x=>x.id===folderId); if(!f) return;
  const tmpl=f.templates.find(t=>t.id===tmplId);
  if(tmpl&&tmpl.remoteId) dDeleteTemplateFromBackend(tmpl.remoteId);
  f.templates = f.templates.filter(t=>t.id!==tmplId);
  if(dActiveTmplId === tmplId){
    dActiveTmplId = f.templates[0]?.id || null;
    if(f.templates[0]) dLoadTemplate(f.templates[0], f);
  }
  dPersistFolders();
  dRenderFolders();
  document.querySelectorAll('.tmpl-context-menu').forEach(m=>m.remove());
  gToast('Template excluído.');
}
// Atalho rápido: edita só validade num modalzinho menor
function dQuickEditValidade(folderId, tmplId){
  document.querySelectorAll('.tmpl-context-menu').forEach(m=>m.remove());
  const f=dFolders.find(x=>x.id===folderId); if(!f) return;
  const t=f.templates.find(x=>x.id===tmplId); if(!t) return;
  if(!t.publishMeta) t.publishMeta = dDefaultPublishMeta();
  const novaData = prompt('Nova data de validade (YYYY-MM-DD):', t.publishMeta.validade||'');
  if(!novaData) return;
  // Valida formato simples
  if(!/^\d{4}-\d{2}-\d{2}$/.test(novaData)){
    gToast('Data inválida. Use YYYY-MM-DD (ex: 2026-12-31).');
    return;
  }
  t.publishMeta.validade = novaData;
  dPersistFolders();
  gToast('✓ Validade atualizada!');
}
// Atalho rápido: abre o modal principal já na aba permissões
function dQuickEditPerms(folderId, tmplId){
  document.querySelectorAll('.tmpl-context-menu').forEach(m=>m.remove());
  const f=dFolders.find(x=>x.id===folderId); if(!f) return;
  const t=f.templates.find(x=>x.id===tmplId); if(!t) return;
  // Carrega o template e abre modal de publicação na aba permissões
  dLoadTemplate(t, f);
  setTimeout(()=>{
    dPublishOpen();
    setTimeout(()=>{
      const tab3 = document.querySelector('.pub-tab[onclick*="permissoes"]') || document.querySelectorAll('.pub-tab')[3];
      if(tab3) dPublishSwitchTab('permissoes', tab3);
    }, 100);
  }, 100);
}
function dToggleFolder(id){
  const willOpen=!dFolderOpen[id];
  // Comportamento acordeão: ao abrir uma campanha, fecha as outras (painel estreito fica limpo)
  if(willOpen) Object.keys(dFolderOpen).forEach(k=>{dFolderOpen[k]=false;});
  dFolderOpen[id]=willOpen;
  dRenderFolders();
}

async function dLoadTemplate(tmpl,folder){
  if(!tmpl)return;

  // -- LAZY LOAD DOS LAYERS --
  if(tmpl._needsLayersFetch && tmpl.remoteId){
    const sb = (typeof gSupabase==='function') ? gSupabase() : window.sb;
    if(sb){
      gToast('Baixando material...');
      try {
        const {data, error} = await sb.schema('luma').from('templates').select('layers').eq('id', tmpl.remoteId).single();
        if(!error && data){
          tmpl.layers = Array.isArray(data.layers) ? data.layers : [];
          tmpl._needsLayersFetch = false;
          if(typeof dPersistFolders === 'function') dPersistFolders();
        }
      } catch(e) {}
    }
  }

  dActiveTmplId=tmpl.id;
  if(folder)dActiveTmplFolderId=folder.id; // destaca a pasta da arte ativa na grade
  else dActiveTmplFolderId=null;
  dFmt=tmpl.fmt;
  dSyncLyrCnt(tmpl.layers); // ids 'l-N' do template não podem colidir com os próximos ++dLyrCnt
  // Carrega no artboard ativo (substitui layers e formato).
  // Template 1:1 do PSD guarda w/h reais (fmt 'orig' não tem DFMT_SIZES) → usa o tamanho real.
  const f=DFMT_SIZES[tmpl.fmt]||DFMT_SIZES.story;
  const _w=(tmpl.w>0)?tmpl.w:f.w, _h=(tmpl.h>0)?tmpl.h:f.h;
  dCustomFmt=null; // limpa override ad-hoc de um "Novo arquivo" anterior; o tamanho real vem de ab.w/h abaixo
  const ab=dGetActiveAB();
  if(ab){ab.layers=JSON.parse(JSON.stringify(tmpl.layers||[]));ab.fmt=tmpl.fmt;ab.name=tmpl.name;ab.w=_w;ab.h=_h;}
  dLayers=JSON.parse(JSON.stringify(tmpl.layers||[]));
  // Re-hidrata fundos grandes (idb://) → dataURL real, e re-renderiza quando prontos.
  if(typeof gHydrateLayers==='function'){
    gHydrateLayers(dLayers).then(changed=>{
      if(!changed) return;
      const _ab=dGetActiveAB(); if(_ab) _ab.layers=JSON.parse(JSON.stringify(dLayers));
      if(typeof dRenderCanvas==='function') dRenderCanvas();
    });
  }
  dSelId=null;dMultiSel=[];
  dHistoryReset();
  dRenderFolders();
  if(typeof dRenderWorkspace==='function')dRenderWorkspace();
  dApplyFormat();
  setTimeout(dFitToScreen,50);
  dRenderCanvas();dRenderLayersList();dStats();dMarkUnsaved();dRenderABList();
  const projNameEl = document.getElementById('dt-project-name');
  if(projNameEl && tmpl) projNameEl.textContent = tmpl.name;
  document.querySelectorAll('.dt-fmt').forEach(b=>b.classList.toggle('active',b.dataset.fmt===dFmt));
  dRenderPagesTray();
  gToast('Template "'+tmpl.name+'" carregado na prancheta ativa');
}

/* ══ RENOMEAR O DOCUMENTO/ARTE ATIVA (rótulo da topbar) ══
   Canvas único: o nome do projeto = nome da arte. É o que vai pro card de
   publicação e pro catálogo do franqueado. Edição inline no próprio rótulo. */
function dProjectRename(){
  const span=document.getElementById('dt-project-name');
  if(!span||span.dataset.editing==='1')return;
  const wrap=span.closest('.dt-project-wrap');if(!wrap)return;
  span.dataset.editing='1';
  const cur=(span.textContent||'').trim();
  const inp=document.createElement('input');
  inp.type='text';inp.value=cur;inp.className='dt-project-name-input';
  inp.maxLength=60;inp.setAttribute('aria-label','Nome do projeto');
  span.style.display='none';
  wrap.insertBefore(inp,span);
  inp.focus();inp.select();
  let done=false;
  const finish=(save)=>{
    if(done)return;done=true;
    const val=inp.value.trim();
    if(save&&val){
      span.textContent=val;
      const ab=(typeof dGetActiveAB==='function')?dGetActiveAB():null;
      if(ab) ab.name=val;
      if(typeof dArtboards!=='undefined'&&dArtboards.length) dArtboards[0].name=val;
      if(typeof dMarkUnsaved==='function') dMarkUnsaved();
      if(typeof dPersistArtboards==='function') dPersistArtboards();
    }
    inp.remove();span.style.display='';delete span.dataset.editing;
  };
  inp.addEventListener('keydown',e=>{
    e.stopPropagation(); // não dispara os atalhos de ferramenta do designer
    if(e.key==='Enter'){e.preventDefault();finish(true);}
    else if(e.key==='Escape'){e.preventDefault();finish(false);}
  });
  inp.addEventListener('click',e=>e.stopPropagation());
  inp.addEventListener('blur',()=>finish(true));
}

/* ══ MODAL "EDITANDO PASTA" (capa, campanha, grupos, agendamento) ══ */
const FOLDER_GROUPS=['Todos os usuários','Franquias SP','Franquias RJ','Novas unidades','Região Sul'];
let dEditingFolderId=null;     // null = criação; id = edição
let dFolderDraftCover=null;    // capa em edição (commit só no Salvar)

// Popula o select de campanhas no modal
function dPopFolderCampaignSelect(sel){
  const el=document.getElementById('df-campaign');if(!el)return;
  const camps=[...CAMPS_ATIVAS,...CAMPS_OUTRAS];
  el.innerHTML='<option value="">Sem campanha vinculada</option>'+
    camps.map(c=>`<option value="${c.id}" ${c.id===sel?'selected':''}>${c.name}</option>`).join('');
}
// Renderiza os checkboxes de grupos
function dFolderRenderGroups(selected){
  const wrap=document.getElementById('df-groups');if(!wrap)return;
  const sel=selected&&selected.length?selected:['Todos os usuários'];
  wrap.innerHTML=FOLDER_GROUPS.map(g=>`
    <label class="df-group-chip">
      <input type="checkbox" value="${g}" ${sel.includes(g)?'checked':''} onchange="dFolderGroupChange(this)">${g}
    </label>`).join('');
}
// "Todos os usuários" é exclusivo: marca-lo desmarca os outros e vice-versa
function dFolderGroupChange(cb){
  const all=document.querySelectorAll('#df-groups input[type=checkbox]');
  if(cb.value==='Todos os usuários'&&cb.checked){ all.forEach(x=>{if(x.value!=='Todos os usuários')x.checked=false;}); }
  else if(cb.value!=='Todos os usuários'&&cb.checked){ all.forEach(x=>{if(x.value==='Todos os usuários')x.checked=false;}); }
}
function dFolderToggleAdv(){
  const body=document.getElementById('df-adv-body');
  const chev=document.querySelector('#df-adv-toggle .df-adv-chevron');
  const open=body.style.display==='none';
  body.style.display=open?'block':'none';
  if(chev)chev.style.transform=open?'rotate(90deg)':'';
}
function dFolderToggleSchedule(){
  const t=document.getElementById('df-schedule-toggle');
  document.getElementById('df-schedule-date').style.display=t.checked?'':'none';
}
// Atualiza a miniatura de capa no modal
function dFolderUpdateCoverPreview(){
  const thumb=document.getElementById('df-cover-thumb');
  const rm=document.getElementById('df-cover-remove');
  const color=document.getElementById('df-color').value||'#FF9000';
  if(dFolderDraftCover){
    thumb.style.backgroundImage=`url('${dFolderDraftCover}')`;
    thumb.style.backgroundColor='';thumb.textContent='';
    if(rm)rm.style.display='';
  }else{
    thumb.style.backgroundImage='';
    thumb.style.backgroundColor=color;thumb.textContent='';
    if(rm)rm.style.display='none';
  }
}
// Upload da capa: comprime (JPEG ~750×400) pra não estourar a quota do localStorage
function dFolderCoverUpload(input){
  const file=input.files&&input.files[0];if(!file)return;
  if(!file.type.startsWith('image/')){gToast('⚠ Selecione uma imagem','error');return;}
  const r=new FileReader();
  r.onload=e=>{ dCompressCover(e.target.result, 750, 400, 0.78, (out)=>{ dFolderDraftCover=out; dFolderUpdateCoverPreview(); }); };
  r.readAsDataURL(file);
  input.value='';
}
function dFolderClearCover(){ dFolderDraftCover=null; dFolderUpdateCoverPreview(); }
// Redimensiona/comprime uma imagem (cover) num canvas → dataURL JPEG
function dCompressCover(dataUrl, maxW, maxH, quality, cb){
  const img=new Image();
  img.onload=()=>{
    let w=img.width,h=img.height;
    const ratio=Math.min(maxW/w, maxH/h, 1);
    w=Math.round(w*ratio); h=Math.round(h*ratio);
    const cv=document.createElement('canvas');cv.width=w;cv.height=h;
    const ctx=cv.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,w,h);
    try{ cb(cv.toDataURL('image/jpeg', quality)); }catch(e){ cb(dataUrl); }
  };
  img.onerror=()=>cb(dataUrl);
  img.src=dataUrl;
}

// Fecha o modal de pasta limpando o estado de edição (evita estado sujo entre aberturas)
function dCloseFolderModal(){
  dEditingFolderId=null; dFolderDraftCover=null;
  document.getElementById('d-folder-modal').classList.remove('open');
}
function dOpenNewFolder(){
  dEditingFolderId=null; dFolderDraftCover=null;
  document.getElementById('df-modal-title').textContent='Nova Pasta';
  document.getElementById('df-save-btn').textContent='Criar pasta';
  document.getElementById('df-name').value='';
  document.getElementById('df-color').value='#FF9000';
  dPopFolderCampaignSelect('');
  dFolderRenderGroups(['Todos os usuários']);
  document.getElementById('df-schedule-toggle').checked=false;
  document.getElementById('df-schedule-date').value='';
  document.getElementById('df-schedule-date').style.display='none';
  document.getElementById('df-adv-body').style.display='none';
  const chev=document.querySelector('#df-adv-toggle .df-adv-chevron');if(chev)chev.style.transform='';
  dFolderUpdateCoverPreview();
  document.getElementById('d-folder-modal').classList.add('open');
  setTimeout(()=>document.getElementById('df-name').focus(),100);
}
function dEditFolder(id){
  document.querySelectorAll('.tmpl-context-menu,.folder-ctx-menu').forEach(m=>m.remove());
  const f=dFolders.find(x=>x.id===id);if(!f)return;
  dEditingFolderId=id;
  dFolderDraftCover=(f.cover&&f.cover!=='__local__')?f.cover:null;
  document.getElementById('df-modal-title').textContent='Editando pasta';
  document.getElementById('df-save-btn').textContent='Salvar';
  document.getElementById('df-name').value=f.name||'';
  document.getElementById('df-color').value=(f.color&&f.color[0]==='#')?f.color:'#FF9000';
  dPopFolderCampaignSelect(f.campId||'');
  dFolderRenderGroups(f.grupos||['Todos os usuários']);
  const hasSched=!!(f.agendamento);
  document.getElementById('df-schedule-toggle').checked=hasSched;
  document.getElementById('df-schedule-date').value=f.agendamento||'';
  document.getElementById('df-schedule-date').style.display=hasSched?'':'none';
  document.getElementById('df-adv-body').style.display=(hasSched||(f.grupos&&!f.grupos.includes('Todos os usuários')))?'block':'none';
  const chev=document.querySelector('#df-adv-toggle .df-adv-chevron');if(chev)chev.style.transform=(hasSched)?'rotate(90deg)':'';
  dFolderUpdateCoverPreview();
  document.getElementById('d-folder-modal').classList.add('open');
  setTimeout(()=>document.getElementById('df-name').focus(),100);
}
function dConfirmFolder(){
  const name=document.getElementById('df-name').value.trim();
  const color=document.getElementById('df-color').value;
  const campId=document.getElementById('df-campaign').value||'';
  const grupos=Array.from(document.querySelectorAll('#df-groups input:checked')).map(x=>x.value);
  const schedOn=document.getElementById('df-schedule-toggle').checked;
  const agendamento=schedOn?(document.getElementById('df-schedule-date').value||null):null;
  if(!name){gToast('⚠ Digite um nome para a pasta');return;}
  if(dEditingFolderId){
    const f=dFolders.find(x=>x.id===dEditingFolderId);
    if(f){ f.name=name;f.color=color;f.campId=campId;f.grupos=grupos.length?grupos:['Todos os usuários'];f.agendamento=agendamento;f.cover=dFolderDraftCover||''; }
    if(!dPersistFolders()){dRenderFolders();return;} // persiste antes de fechar; se falhar, mantém modal aberto
    dRenderFolders();
    dCloseFolderModal();
    if(typeof fGetCampaigns==='function'&&typeof fRenderCatalogs==='function')try{const{ativas,outras}=fGetCampaigns();fRenderCatalogs(ativas,outras);}catch(e){}
    gToast('✓ Pasta "'+name+'" atualizada');
    return;
  }
  const id='f'+Date.now();
  dFolders.push({id,name,color,campId,cover:dFolderDraftCover||'',grupos:grupos.length?grupos:['Todos os usuários'],agendamento,templates:[]});
  dFolderOpen[id]=true;
  dRenderFolders();
  dPersistFolders();
  dCloseFolderModal();
  if(typeof fGetCampaigns==='function'&&typeof fRenderCatalogs==='function')try{const{ativas,outras}=fGetCampaigns();fRenderCatalogs(ativas,outras);}catch(e){}
  gToast('✓ Pasta "'+name+'" criada');
}
// Renomear rápido (sem abrir o modal todo)
function dRenameFolder(id){
  document.querySelectorAll('.folder-ctx-menu').forEach(m=>m.remove());
  const f=dFolders.find(x=>x.id===id);if(!f)return;
  const n=prompt('Novo nome da pasta:',f.name);
  if(!n||!n.trim())return;
  f.name=n.trim();
  dRenderFolders();dPersistFolders();
  if(typeof fGetCampaigns==='function'&&typeof fRenderCatalogs==='function')try{const{ativas,outras}=fGetCampaigns();fRenderCatalogs(ativas,outras);}catch(e){}
  gToast('✓ Pasta renomeada');
}
function dClearFolder(id){
  document.querySelectorAll('.folder-ctx-menu').forEach(m=>m.remove());
  const f=dFolders.find(x=>x.id===id);if(!f)return;
  const n=(f.templates||[]).length;
  if(n===0){ gToast('A pasta já está vazia'); return; }
  if(!confirm(`Excluir TODOS os ${n} template(s) da pasta "${f.name}"? A pasta será mantida, mas as artes serão excluídas permanentemente.`))return;
  (f.templates||[]).forEach(t=>{ if(t.remoteId) dDeleteTemplateFromBackend(t.remoteId); });
  f.templates=[];
  dRenderFolders();dPersistFolders();
  if(typeof fGetCampaigns==='function'&&typeof fRenderCatalogs==='function')try{const{ativas,outras}=fGetCampaigns();fRenderCatalogs(ativas,outras);}catch(e){}
  gToast(`✓ ${n} template(s) excluído(s) da pasta "${f.name}"`);
}
function dDeleteFolder(id){
  document.querySelectorAll('.folder-ctx-menu').forEach(m=>m.remove());
  const f=dFolders.find(x=>x.id===id);if(!f)return;
  const n=(f.templates||[]).length;
  if(!confirm(`Excluir a pasta "${f.name}"${n?` e seus ${n} template(s)`:''}? Esta ação não pode ser desfeita.`))return;
  if(f.remoteId) dDeleteFolderFromBackend(f.remoteId);
  dFolders=dFolders.filter(x=>x.id!==id);
  dRenderFolders();dPersistFolders();
  if(typeof fGetCampaigns==='function'&&typeof fRenderCatalogs==='function')try{const{ativas,outras}=fGetCampaigns();fRenderCatalogs(ativas,outras);}catch(e){}
  gToast('Pasta "'+f.name+'" excluída');
}
// Menu "..." de cada card de pasta na grade
function dFolderMenu(ev,id){
  ev.preventDefault();ev.stopPropagation();
  document.querySelectorAll('.folder-ctx-menu,.tmpl-context-menu').forEach(m=>m.remove());
  const menu=document.createElement('div');
  menu.className='folder-ctx-menu tmpl-context-menu';
  menu.innerHTML=`
    <button class="tmpl-ctx-item" onclick="dEditFolder('${id}')"><span class="tmpl-ctx-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></span>Editar pasta</button>
    <button class="tmpl-ctx-item" onclick="dRenameFolder('${id}')"><span class="tmpl-ctx-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></span>Renomear</button>
    <div class="tmpl-ctx-sep"></div>
    <button class="tmpl-ctx-item tmpl-ctx-danger" onclick="dClearFolder('${id}')"><span class="tmpl-ctx-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></span>Esvaziar pasta</button>
    <button class="tmpl-ctx-item tmpl-ctx-danger" onclick="dDeleteFolder('${id}')"><span class="tmpl-ctx-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></span>Excluir pasta</button>`;
  document.body.appendChild(menu);
  const rect=ev.target.getBoundingClientRect();
  menu.style.left=Math.min(rect.left,window.innerWidth-220)+'px';
  menu.style.top=(rect.bottom+4)+'px';
  setTimeout(()=>{
    const close=()=>{ menu.remove(); document.removeEventListener('click',close); };
    document.addEventListener('click',close);
  },0);
}
function dOpenNewTemplate(){
  // populate folder select
  const sel=document.getElementById('dt-folder');
  sel.innerHTML=dFolders.map(f=>`<option value="${gEsc(f.id)}">${gEsc(f.name)}</option>`).join('');
  document.getElementById('dt-name').value='';
  document.getElementById('d-tmpl-modal').classList.add('open');
  setTimeout(()=>document.getElementById('dt-name').focus(),100);
}
function dConfirmTemplate(){
  const name=document.getElementById('dt-name').value.trim();
  const folderId=document.getElementById('dt-folder').value;
  const fmt=document.getElementById('dt-fmt').value;
  if(!name){gToast('⚠ Digite um nome para o template');return;}
  const folder=dFolders.find(f=>f.id===folderId);
  if(!folder){gToast('⚠ Selecione uma pasta');return;}
  const id='t'+Date.now();
  // Template novo nasce em branco — só com fundo neutro pra começar do zero
  const newTmpl={id,name,fmt,layers:dBuildBlankLayers(fmt),publishMeta:dDefaultPublishMeta()};
  folder.templates.push(newTmpl);
  dFolderOpen[folderId]=true;
  dRenderFolders();
  dLoadTemplate(newTmpl,folder);
  dPersistFolders();
  document.getElementById('d-tmpl-modal').classList.remove('open');
  gToast('✓ Template "'+name+'" criado em "'+folder.name+'" — comece adicionando elementos pelas ferramentas (T, R, F, M)');
}

/* ══════════════════════════════════════════════════════════════
   NOVO ARQUIVO (estilo "New Document") — prancheta com tamanho/DPI custom.
   Reaproveita o motor de pranchetas: dApplyFormat/dFitToScreen/dPaintTargetSize
   já honram ab.w/ab.h, então dimensões arbitrárias funcionam sem mexer no render.
══════════════════════════════════════════════════════════════ */
// Cria uma prancheta nova com dimensões explícitas (px), fundo e DPI escolhidos.
function dNewArtboardCustom(w,h,bg,dpi,fmt){
  dSyncLayersToAB();
  w=Math.max(16,Math.min(8000,Math.round(w)||1080));
  h=Math.max(16,Math.min(8000,Math.round(h)||1080));
  // fmt é só metadado (âncoras/reflow/tag): infere o preset mais próximo pela proporção
  fmt=fmt||((typeof dPsdDetectFmt==='function')?dPsdDetectFmt(w,h):'story');
  const id='ab-'+Date.now();
  const n=dArtboards.length;
  let x,y;
  if(n===0){x=80;y=60;}
  else{const last=dArtboards[n-1];x=last.x+last.w+140;y=last.y;}
  // Fundo: 'transparent' → sem layer de fundo; 'white' → branco; senão a cor hex escolhida
  const layers=(bg==='transparent')?[]:
    [{id:'l-bg-'+Date.now(),name:'Fundo',type:'shape',x:0,y:0,w,h,fill:(bg==='white'?'#FFFFFF':bg),opacity:100,radius:0,visible:true,locked:false}];
  const ab={id,name:'Prancheta '+(n+1),x,y,w,h,fmt,dpi:dpi||72,layers};
  dArtboards.push(ab);
  dActiveABId=id;
  dLayers=JSON.parse(JSON.stringify(ab.layers));
  dFmt=fmt;dCustomFmt={w,h};dSelId=null;dMultiSel=[]; // tamanho ad-hoc explícito (fmt é só metadado ratio-snap)
  dHistoryReset();
  if(typeof dRenderWorkspace==='function')dRenderWorkspace();
  dApplyFormat();dRenderCanvas();dRenderLayersList();dRenderABList();
  const projNameEl=document.getElementById('dt-project-name');
  if(projNameEl) projNameEl.textContent=ab.name;
  setTimeout(dFitToScreen,60);
  return ab;
}
const DNEWDOC_PRESETS = {
  social: [
    { id: 'story', name: 'Story', w: 1080, h: 1920, unit: 'px', dpi: 72 },
    { id: 'feed', name: 'Feed', w: 1080, h: 1350, unit: 'px', dpi: 72 },
    { id: 'reels', name: 'Reels', w: 1080, h: 1920, unit: 'px', dpi: 72 },
    { id: 'post', name: 'Post', w: 1200, h: 628, unit: 'px', dpi: 72 }
  ],
  web: [
    { id: 'fhd', name: 'Full HD', w: 1920, h: 1080, unit: 'px', dpi: 72 },
    { id: 'hd', name: 'HD', w: 1366, h: 768, unit: 'px', dpi: 72 }
  ],
  mobile: [
    { id: 'iphone', name: 'iPhone', w: 1170, h: 2532, unit: 'px', dpi: 72 },
    { id: 'android', name: 'Android', w: 1080, h: 2400, unit: 'px', dpi: 72 }
  ],
  print: [
    { id: 'a4', name: 'A4', w: 210, h: 297, unit: 'mm', dpi: 300 },
    { id: 'a5', name: 'A5', w: 148, h: 210, unit: 'mm', dpi: 300 }
  ],
  custom: []
};

function dNewDocOpen(){
  document.getElementById('nd-unit').value='px';
  document.getElementById('nd-dpi').value=72;
  document.getElementById('nd-bg').value='white';
  document.getElementById('nd-bg-color').style.display='none';
  if (document.getElementById('nd-use-artboards')) {
    document.getElementById('nd-use-artboards').checked = dUseArtboards;
  }
  
  const firstTab = document.querySelector('.newdoc-tab');
  dNewDocSelectTab('social', firstTab);
  
  document.getElementById('d-newdoc-modal').classList.add('open');
}

function dNewDocSelectTab(category, tabEl){
  document.querySelectorAll('.newdoc-tab').forEach(btn => btn.classList.remove('active'));
  if(tabEl) tabEl.classList.add('active');

  const container = document.getElementById('nd-presets-container');
  if(!container) return;

  const presets = DNEWDOC_PRESETS[category] || [];
  if(presets.length === 0){
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; color: var(--d-text3); font-size: 13px; padding: 40px 0;">
        Defina dimensões customizadas no painel ao lado.
      </div>
    `;
    return;
  }

  container.innerHTML = presets.map(p => {
    // Calcular proporção para a caixinha visual
    const maxDim = Math.max(p.w, p.h);
    const boxW = Math.max((p.w / maxDim) * 44, 8);
    const boxH = Math.max((p.h / maxDim) * 44, 8);
    
    return `
      <button type="button" class="newdoc-preset-btn" data-preset-id="${p.id}" onclick="dNewDocApplyPreset('${category}', '${p.id}', this)" style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;padding:16px 8px;">
        <div style="height: 50px; display:flex; align-items:center; justify-content:center; width:100%;">
          <div style="width: ${boxW}px; height: ${boxH}px; background: #fff; border: 1px solid #ccc; box-shadow: 2px 2px 5px rgba(0,0,0,0.08); border-radius:1px;"></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:3px;">
          <span style="font-weight: bold; font-size: 13px; line-height:1.2;">${p.name}</span>
          <span style="font-size: 11px; opacity: 0.7; line-height:1.2;">${p.w} × ${p.h} ${p.unit}</span>
          <span style="font-size: 10px; opacity: 0.5; line-height:1.2;">${p.dpi} ppi</span>
        </div>
      </button>
    `;
  }).join('');

  // Auto-selecionar o primeiro preset
  const firstPresetBtn = container.querySelector('.newdoc-preset-btn');
  if(firstPresetBtn){
    dNewDocApplyPreset(category, presets[0].id, firstPresetBtn);
  }
}

function dNewDocApplyPreset(category, id, btnEl){
  const presets = DNEWDOC_PRESETS[category] || [];
  const p = presets.find(x => x.id === id);
  if(!p) return;

  document.querySelectorAll('.newdoc-preset-btn').forEach(btn => btn.classList.remove('active'));
  if(btnEl) btnEl.classList.add('active');

  document.getElementById('nd-unit').value = p.unit;
  document.getElementById('nd-dpi').value = p.dpi;
  document.getElementById('nd-w').value = p.w;
  document.getElementById('nd-h').value = p.h;

  dNewDocUpdate();
}

// Converte os campos do modal para pixels usando a unidade + DPI
function _dNewDocPx(){
  const unit=document.getElementById('nd-unit').value;
  const dpi=Math.max(1,parseFloat(document.getElementById('nd-dpi').value)||72);
  const wv=parseFloat(document.getElementById('nd-w').value)||0;
  const hv=parseFloat(document.getElementById('nd-h').value)||0;
  const toPx=v=>unit==='in'?Math.round(v*dpi):unit==='cm'?Math.round(v/2.54*dpi):unit==='mm'?Math.round((v/10)/2.54*dpi):Math.round(v);
  return {w:toPx(wv),h:toPx(hv),dpi};
}

function dNewDocUpdate(){
  const {w,h}=_dNewDocPx();
  const el=document.getElementById('nd-px-preview');
  if(el)el.textContent=(w||'—')+' × '+(h||'—')+' px';
}

function dNewDocSwapOrientation(){
  const w=document.getElementById('nd-w'),h=document.getElementById('nd-h');
  const t=w.value;w.value=h.value;h.value=t;
  dNewDocUpdate();
}

function dNewDocBgChange(){
  const v=document.getElementById('nd-bg').value;
  document.getElementById('nd-bg-color').style.display=(v==='color')?'inline-block':'none';
}

function dNewDocConfirm(){
  const {w,h,dpi}=_dNewDocPx();
  if(w<16||h<16){gToast('⚠ Dimensões muito pequenas (mín. 16px)','error');return;}
  if(w>8000||h>8000){gToast('⚠ Dimensões muito grandes (máx. 8000px)','error');return;}
  const bgSel=document.getElementById('nd-bg').value;
  const bg=(bgSel==='color')?document.getElementById('nd-bg-color').value:bgSel;
  
  if (document.getElementById('nd-use-artboards')) {
    dUseArtboards = document.getElementById('nd-use-artboards').checked;
  }
  
  dArtboards = [];
  dActiveABId = null;
  
  dNewArtboardCustom(w,h,bg,dpi);
  document.getElementById('d-newdoc-modal').classList.remove('open');
  
  const msg = dUseArtboards 
    ? '✓ Novo workspace multi-prancheta criado com prancheta de ' + w + '×' + h + 'px'
    : '✓ Novo documento único de ' + w + '×' + h + 'px criado';
  gToast(msg);
}

/* ── FORMATO / CANVAS ── */
const DFMT_SIZES={story:{w:1080,h:1920},feed:{w:1080,h:1350},wide:{w:1200,h:628},horizontal:{w:1920,h:1080}};

/* ══════════════════════════════════════════════════════════════
   NOVO MOTOR DE IMPORTAÇÃO DE SVG (ILLUSTRATOR COMPATIBLE)
   Suporta: Matrizes de Transformação, viewBox Deslocado,
   Classes CSS em <style>, TSPANS Multilinha e Custom Fonts.
   ══════════════════════════════════════════════════════════════ */

// Multiplica duas matrizes afins 2D representadas como arrays [a, b, c, d, e, f]
function _dSvgMultiplyMatrices(m1, m2) {
  const a = m1[0] * m2[0] + m1[2] * m2[1];
  const b = m1[1] * m2[0] + m1[3] * m2[1];
  const c = m1[0] * m2[2] + m1[2] * m2[3];
  const d = m1[1] * m2[2] + m1[3] * m2[3];
  const e = m1[0] * m2[4] + m1[2] * m2[5] + m1[4];
  const f = m1[1] * m2[4] + m1[3] * m2[5] + m1[5];
  return [a, b, c, d, e, f];
}

// Analisa a string de transformações do SVG e constrói a matriz consolidada
function _dSvgParseTransform(transformStr) {
  let matrix = [1, 0, 0, 1, 0, 0]; // Matriz identidade
  if (!transformStr) return matrix;

  const transformRegex = /(\w+)\(([^)]+)\)/g;
  let match;
  while ((match = transformRegex.exec(transformStr)) !== null) {
    const type = match[1].toLowerCase();
    const args = match[2].split(/[\s,]+/).map(parseFloat).filter(n => !isNaN(n));
    let m = [1, 0, 0, 1, 0, 0];

    if (type === 'matrix' && args.length === 6) {
      m = args;
    } else if (type === 'translate') {
      const tx = args[0] || 0;
      const ty = args[1] !== undefined ? args[1] : 0;
      m = [1, 0, 0, 1, tx, ty];
    } else if (type === 'scale') {
      const sx = args[0] !== undefined ? args[0] : 1;
      const sy = args[1] !== undefined ? args[1] : sx;
      m = [sx, 0, 0, sy, 0, 0];
    } else if (type === 'rotate') {
      const angle = (args[0] || 0) * Math.PI / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      if (args.length === 3) {
        const cx = args[1];
        const cy = args[2];
        m = [
          cos, sin, -sin, cos,
          -cx * cos + cy * sin + cx,
          -cx * sin - cy * cos + cy
        ];
      } else {
        m = [cos, sin, -sin, cos, 0, 0];
      }
    }
    matrix = _dSvgMultiplyMatrices(matrix, m);
  }
  return matrix;
}

// Transforma os 4 cantos de uma caixa limitadora e retorna a caixa alinhada resultante (AABB)
function _dSvgApplyMatrixToBBox(x, y, w, h, m) {
  const pts = [
    { x: x, y: y },
    { x: x + w, y: y },
    { x: x, y: y + h },
    { x: x + w, y: y + h }
  ];
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  pts.forEach(p => {
    const tx = m[0] * p.x + m[2] * p.y + m[4];
    const ty = m[1] * p.x + m[3] * p.y + m[5];
    if (tx < minX) minX = tx;
    if (tx > maxX) maxX = tx;
    if (ty < minY) minY = ty;
    if (ty > maxY) maxY = ty;
  });

  return {
    x: Math.round(minX),
    y: Math.round(minY),
    w: Math.max(1, Math.round(maxX - minX)),
    h: Math.max(1, Math.round(maxY - minY))
  };
}

// Extrai e mapeia seletores de classe CSS dos blocos <style> do SVG
function _dSvgParseStyles(doc) {
  const styles = {};
  doc.querySelectorAll('style').forEach(styleEl => {
    const cssText = styleEl.textContent;
    const ruleRegex = /\.([a-zA-Z0-9_-]+)\s*\{([^}]+)\}/g;
    let match;
    while ((match = ruleRegex.exec(cssText)) !== null) {
      const className = match[1].trim();
      const propertiesStr = match[2];
      styles[className] = styles[className] || {};
      const propRegex = /([\w-]+)\s*:\s*([^;]+)/g;
      let propMatch;
      while ((propMatch = propRegex.exec(propertiesStr)) !== null) {
        styles[className][propMatch[1].trim()] = propMatch[2].trim();
      }
    }
  });
  return styles;
}

// Resoluções de propriedades com prioridade (Inline > CSS Class > Atributo > Herança do Pai)
function _dSvgProp(el, name, cssStyles) {
  if (!el) return null;

  // 1. Estilo inline (el.style)
  if (el.style) {
    try {
      const val = el.style.getPropertyValue(name);
      if (val) return val.trim();
    } catch (e) {}
  }

  // 2. Classes de folha de estilo externa/interna (<style>)
  const classAttr = el.getAttribute && el.getAttribute('class');
  if (classAttr) {
    const classes = classAttr.trim().split(/\s+/);
    for (const cls of classes) {
      if (cssStyles && cssStyles[cls] && cssStyles[cls][name] !== undefined) {
        return cssStyles[cls][name];
      }
    }
  }

  // 3. Atributo direto do elemento
  if (el.getAttribute) {
    const val = el.getAttribute(name);
    if (val !== null && val !== '') return val;
  }

  // 4. Herança de nós superiores (para propriedades aplicáveis)
  const inheritableProps = ['fill', 'font-family', 'font-size', 'font-weight', 'opacity', 'text-anchor', 'stroke', 'stroke-width'];
  if (inheritableProps.includes(name) && el.parentElement && el.parentElement.tagName.toLowerCase() !== 'svg') {
    return _dSvgProp(el.parentElement, name, cssStyles);
  }

  return null;
}

// Mapeia fontes do Illustrator usando dicionário estático e base de fontes customizadas do Luma
function dSvgMapFont(fontFamily) {
  if (!fontFamily) return "'Roboto'";
  const cleanFamily = fontFamily.replace(/['"]/g, '').split(',')[0].trim();
  const lowerFamily = cleanFamily.toLowerCase();

  // 1. Verifica no banco de fontes registradas do Luma (dCustomFonts)
  if (typeof dCustomFonts !== 'undefined' && Array.isArray(dCustomFonts)) {
    const matched = dCustomFonts.find(cf => cf.family.toLowerCase() === lowerFamily || cf.name.toLowerCase() === lowerFamily);
    if (matched) return `'${matched.family}'`;
  }

  // 2. Fallbacks e mapeamento para fontes padrões
  if (lowerFamily === 'roboto' || lowerFamily === 'sans-serif') return "'Roboto'";
  if (lowerFamily === 'roboto black' || lowerFamily === 'roboto-black') return "'Roboto Black'";
  if (/black|heavy|display|900/.test(lowerFamily)) return "'Roboto Black'";
  if (/bold|700/.test(lowerFamily)) return "'Roboto',bold";

  // 3. Permite preservar fontes conhecidas da web para o navegador resolver
  const commonWebFonts = ['montserrat', 'lato', 'poppins', 'open sans', 'inter', 'helvetica', 'arial', 'times new roman', 'georgia'];
  if (commonWebFonts.some(f => lowerFamily.includes(f))) {
    const suffix = /bold|700/.test(lowerFamily) ? ',bold' : '';
    return `'${cleanFamily}'${suffix}`;
  }

  return "'Roboto'";
}

// Lê o arquivo selecionado e inicia a importação
function dSvgImport(){
  const inp=document.createElement('input');
  inp.type='file'; inp.accept='.svg,.ai';
  inp.onchange=e=>{
    const file=e.target.files && e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>dSvgHandleFile(ev.target.result, file.name);
    reader.onerror=()=>gToast('⚠ Não foi possível ler o arquivo — verifique se é um .psd válido','error');
    reader.readAsText(file);
  };
  inp.click();
}

// Processa o arquivo SVG cru
function dSvgHandleFile(svgText, fileName){
  try{
    const doc=new DOMParser().parseFromString(svgText,'image/svg+xml');
    if(doc.querySelector('parsererror')){ gToast('⚠ Erro ao ler o SVG — verifique o arquivo','error'); return; }
    const svgEl=doc.querySelector('svg');
    if(!svgEl){ gToast('⚠ Arquivo SVG inválido — verifique o arquivo','error'); return; }

    const cssStyles = _dSvgParseStyles(doc);

    // Dimensões nativas do documento (viewBox prioritário)
    let docW, docH;
    const vb=svgEl.getAttribute('viewBox');
    if(vb){
      const p=vb.trim().split(/[\s,]+/);
      docW=parseFloat(p[2]); docH=parseFloat(p[3]);
    }
    if(!docW||!docH){
      // width/height percentuais ("100%") não são dimensões: parseFloat('100%')→100
      // encolheria o documento — ignora e usa o fallback.
      const _wA=svgEl.getAttribute('width')||'', _hA=svgEl.getAttribute('height')||'';
      docW=(_wA.indexOf('%')<0?parseFloat(_wA):0)||1080;
      docH=(_hA.indexOf('%')<0?parseFloat(_hA):0)||1920;
    }

    const elements=dSvgExtractElements(svgEl, docW, docH, cssStyles);
    if(!elements.length){ gToast('⚠ Nenhum elemento reconhecido no SVG','error'); return; }
    const fmt=(typeof dPsdDetectFmt==='function')?dPsdDetectFmt(docW,docH):'story';
    dSvgShowReviewModal(elements, {w:docW, h:docH, fmt, fileName});
  }catch(e){ console.error('[svg] erro ao parsear:',e); gToast('⚠ Não foi possível processar o SVG','error'); }
}

// Extrai recursivamente os elementos do SVG aplicando a pilha de transformações afins (DFS)
function dSvgExtractElements(svgEl, docW, docH, cssStyles){
  const elements=[];
  let idCounter=0;
  const RECOG=['rect','circle','ellipse','text','image','path'];

  // Determinar matriz de transformação inicial para o viewBox (corrige deslocamento de origem)
  let viewBoxMatrix = [1, 0, 0, 1, 0, 0];
  const vbAttr = svgEl.getAttribute('viewBox');
  // width/height percentuais ("100%") → viewport = viewBox (senão parseFloat('100%')=100
  // criaria escala 100/1080 e as camadas sairiam ~10× menores).
  const _vwA = svgEl.getAttribute('width')||'', _vhA = svgEl.getAttribute('height')||'';
  const vpW = (_vwA.indexOf('%')<0 ? parseFloat(_vwA) : 0) || docW;
  const vpH = (_vhA.indexOf('%')<0 ? parseFloat(_vhA) : 0) || docH;
  if (vbAttr) {
    const p = vbAttr.trim().split(/[\s,]+/);
    if (p.length === 4) {
      const vbX = parseFloat(p[0]);
      const vbY = parseFloat(p[1]);
      const vbW = parseFloat(p[2]);
      const vbH = parseFloat(p[3]);
      if (vbW > 0 && vbH > 0) {
        const sx = vpW / vbW;
        const sy = vpH / vbH;
        viewBoxMatrix = [sx, 0, 0, sy, -vbX * sx, -vbY * sy];
      }
    }
  }

  // Travessia profunda recursiva (DFS)
  function traverse(node, accumulatedMatrix, groupPath) {
    const tag = node.tagName ? node.tagName.toLowerCase() : '';
    if (!tag) return;

    // Concatena matriz local
    const localTransformStr = node.getAttribute ? node.getAttribute('transform') : null;
    const localMatrix = _dSvgParseTransform(localTransformStr);
    const newMatrix = _dSvgMultiplyMatrices(accumulatedMatrix, localMatrix);

    if (tag === 'g') {
      const gName = dSvgGetName(node) || ('grupo_' + (++idCounter));
      const newPath = groupPath ? groupPath + '/' + gName : gName;
      Array.from(node.children).forEach(child => {
        traverse(child, newMatrix, newPath);
      });
    } else if (RECOG.includes(tag)) {
      const name = dSvgGetName(node) || (tag + '_' + (++idCounter));
      const el = dSvgParseElement(node, name, docW, docH, newMatrix, cssStyles);
      if (el) {
        el.groupName = groupPath || '';
        elements.push(el);
      }
    }
  }

  // Disparar travessia a partir do nível raiz do SVG
  Array.from(svgEl.children).forEach(child => {
    traverse(child, viewBoxMatrix, '');
  });

  return elements;
}

function dSvgGetName(el){
  return el.getAttribute('inkscape:label') || el.getAttribute('data-name') || el.getAttribute('id') || null;
}

// Direciona o parser de acordo com o elemento
function dSvgParseElement(el, name, docW, docH, matrix, cssStyles){
  const tag=el.tagName.toLowerCase();
  if(tag==='text'||tag==='tspan') return dSvgParseText(el, name, docW, docH, matrix, cssStyles);
  if(tag==='rect') return dSvgParseRect(el, name, docW, docH, matrix, cssStyles);
  if(tag==='circle'||tag==='ellipse') return dSvgParseCircle(el, name, docW, docH, matrix, cssStyles);
  if(tag==='image') return dSvgParseImage(el, name, docW, docH, matrix, cssStyles);
  if(tag==='path') return dSvgParsePath(el, name, docW, docH, matrix, cssStyles);
  return null;
}

// Analisa elementos de texto, concatenando <tspan> e calculando tamanho/baseline transformados
function dSvgParseText(el, name, docW, docH, matrix, cssStyles){
  const tspans = el.querySelectorAll('tspan');
  let content = '';
  
  if (tspans.length > 0) {
    const lines = [];
    let currentLine = '';
    let lastY = null;
    tspans.forEach(tspan => {
      const txt = tspan.textContent.trim();
      if (!txt) return;
      // Distingue quebra de linha se a variação no Y for maior que 5 pixels
      const ty = parseFloat(tspan.getAttribute('y') || _dSvgProp(tspan, 'y', cssStyles) || 0);
      if (lastY !== null && Math.abs(ty - lastY) > 5) {
        lines.push(currentLine);
        currentLine = txt;
      } else {
        currentLine = currentLine ? currentLine + ' ' + txt : txt;
      }
      lastY = ty;
    });
    if (currentLine) lines.push(currentLine);
    content = lines.join('\n');
  } else {
    content = (el.textContent || '').trim();
  }

  const tx = parseFloat(_dSvgProp(el, 'x', cssStyles) || 0);
  const ty = parseFloat(_dSvgProp(el, 'y', cssStyles) || 0);
  const fontSize = parseFloat(_dSvgProp(el, 'font-size', cssStyles) || 48) || 48;
  const fontFamily = _dSvgProp(el, 'font-family', cssStyles) || 'Roboto';
  const fill = _dSvgProp(el, 'fill', cssStyles) || '#000000';
  const textAnchor = _dSvgProp(el, 'text-anchor', cssStyles) || 'start';
  const alignMap = { start: 'left', middle: 'center', end: 'right' };

  // Extrai o fator de escala vertical e horizontal da matriz afim
  const scaleX = Math.sqrt(matrix[0] * matrix[0] + matrix[1] * matrix[1]);
  const scaleY = Math.sqrt(matrix[2] * matrix[2] + matrix[3] * matrix[3]);
  const finalFontSize = Math.round(fontSize * scaleY);

  // Estimar dimensões da caixa de texto no espaço local
  const longestLine = content.split('\n').reduce((max, line) => Math.max(max, line.length), 0);
  const estimatedW = Math.max(40, longestLine * fontSize * 0.55);
  const estimatedH = fontSize * 1.35 * (content.split('\n').length || 1);

  // Ajuste do ponto de ancoragem horizontal (text-anchor)
  let localXOffset = 0;
  if (textAnchor === 'middle') localXOffset = -estimatedW / 2;
  else if (textAnchor === 'end') localXOffset = -estimatedW;

  const localX = tx + localXOffset;
  const localY = ty - fontSize; // Sobem o y do baseline para o topo do bloco de texto

  const bbox = _dSvgApplyMatrixToBBox(localX, localY, estimatedW, estimatedH, matrix);
  const isVarHint = /^\{\{.+\}\}$/.test(content) || /^[A-ZÀ-Ý0-9\s$.,!?-]{2,}$/.test(content);

  return {
    _id: 'svg-' + Math.random().toString(36).slice(2),
    name, svgTag: 'text', detectedType: 'text',
    mode: isVarHint ? 'variable' : 'text',
    varName: dSvgSuggestVarName(content, name),
    content,
    x: bbox.x,
    y: bbox.y,
    w: bbox.w,
    h: bbox.h,
    fontSize: finalFontSize,
    font: dSvgMapFont(fontFamily),
    color: fill,
    textAlign: alignMap[textAnchor] || 'left',
    opacity: Math.round((parseFloat(_dSvgProp(el, 'opacity', cssStyles) || 1) || 1) * 100),
  };
}

// Analisa retângulos
function dSvgParseRect(el, name, docW, docH, matrix, cssStyles){
  const rx = parseFloat(_dSvgProp(el, 'x', cssStyles) || 0);
  const ry = parseFloat(_dSvgProp(el, 'y', cssStyles) || 0);
  const rw = parseFloat(_dSvgProp(el, 'width', cssStyles) || 100);
  const rh = parseFloat(_dSvgProp(el, 'height', cssStyles) || 100);

  const bbox = _dSvgApplyMatrixToBBox(rx, ry, rw, rh, matrix);

  let rxVal = parseFloat(_dSvgProp(el, 'rx', cssStyles) || 0);
  const scaleX = Math.sqrt(matrix[0] * matrix[0] + matrix[1] * matrix[1]);
  rxVal = Math.round(rxVal * scaleX);

  return {
    _id: 'svg-' + Math.random().toString(36).slice(2),
    name, svgTag: 'rect', detectedType: 'shape', mode: 'shape',
    x: bbox.x,
    y: bbox.y,
    w: bbox.w,
    h: bbox.h,
    fill: _dSvgProp(el, 'fill', cssStyles) || '#FF9000',
    radius: rxVal,
    opacity: Math.round((parseFloat(_dSvgProp(el, 'opacity', cssStyles) || 1) || 1) * 100),
  };
}

// Analisa círculos e elipses preservando as propriedades nativas
function dSvgParseCircle(el, name, docW, docH, matrix, cssStyles){
  const tag = el.tagName.toLowerCase();
  const cx = parseFloat(_dSvgProp(el, 'cx', cssStyles) || 0);
  const cy = parseFloat(_dSvgProp(el, 'cy', cssStyles) || 0);
  const r = parseFloat(_dSvgProp(el, 'r', cssStyles) || _dSvgProp(el, 'rx', cssStyles) || 50) || 50;

  const rx = parseFloat(_dSvgProp(el, 'rx', cssStyles) || r);
  const ry = parseFloat(_dSvgProp(el, 'ry', cssStyles) || r);

  const bbox = _dSvgApplyMatrixToBBox(cx - rx, cy - ry, rx * 2, ry * 2, matrix);

  return {
    _id: 'svg-' + Math.random().toString(36).slice(2),
    name, svgTag: tag, detectedType: 'shape', mode: 'shape',
    x: bbox.x,
    y: bbox.y,
    w: bbox.w,
    h: bbox.h,
    fill: _dSvgProp(el, 'fill', cssStyles) || '#FF9000',
    radius: tag === 'circle' ? 999 : 0,
    opacity: Math.round((parseFloat(_dSvgProp(el, 'opacity', cssStyles) || 1) || 1) * 100),
  };
}

// Analisa imagens fixas ou embutidas em base64
function dSvgParseImage(el, name, docW, docH, matrix, cssStyles){
  const href = el.getAttribute('href') || el.getAttribute('xlink:href') || '';
  const isBase64 = href.startsWith('data:image');

  const ix = parseFloat(_dSvgProp(el, 'x', cssStyles) || 0);
  const iy = parseFloat(_dSvgProp(el, 'y', cssStyles) || 0);
  const iw = parseFloat(_dSvgProp(el, 'width', cssStyles) || 300);
  const ih = parseFloat(_dSvgProp(el, 'height', cssStyles) || 300);

  const bbox = _dSvgApplyMatrixToBBox(ix, iy, iw, ih, matrix);

  return {
    _id: 'svg-' + Math.random().toString(36).slice(2),
    name, svgTag: 'image', detectedType: 'image', mode: 'frame',
    x: bbox.x,
    y: bbox.y,
    w: bbox.w,
    h: bbox.h,
    imgUrl: isBase64 ? href : '',
    imgVar: dSvgSuggestImgVar(name),
    opacity: Math.round((parseFloat(_dSvgProp(el, 'opacity', cssStyles) || 1) || 1) * 100),
  };
}

// Helper para bounding box aproximado de caminhos complexos
function _dSvgPathBBox(d){
  const nums=(String(d||'').match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)||[]).map(parseFloat).filter(n=>isFinite(n));
  if(nums.length<2) return null;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(let i=0;i+1<nums.length;i+=2){
    const x=nums[i], y=nums[i+1];
    if(x<minX)minX=x; if(x>maxX)maxX=x;
    if(y<minY)minY=y; if(y>maxY)maxY=y;
  }
  if(!isFinite(minX)||!isFinite(minY)) return null;
  return {x:minX, y:minY, w:Math.max(1,maxX-minX), h:Math.max(1,maxY-minY)};
}

// Analisa caminhos vetoriais fechados ou abertos
function dSvgParsePath(el, name, docW, docH, matrix, cssStyles){
  const d = el.getAttribute('d') || '';
  let x = 0, y = 0, w = 100, h = 100;
  const bb = _dSvgPathBBox(d);
  if (bb) { x = bb.x; y = bb.y; w = bb.w; h = bb.h; }

  const bbox = _dSvgApplyMatrixToBBox(x, y, w, h, matrix);
  const fill = _dSvgProp(el, 'fill', cssStyles);
  const isComplex = d.split(/[Mm]/).length > 3;

  return {
    _id: 'svg-' + Math.random().toString(36).slice(2),
    name, svgTag: 'path',
    detectedType: isComplex ? 'path-complex' : 'shape',
    mode: isComplex ? 'ignore' : 'shape',
    x: bbox.x,
    y: bbox.y,
    w: bbox.w,
    h: bbox.h,
    fill: fill || '#000000',
    radius: 0,
    opacity: Math.round((parseFloat(_dSvgProp(el, 'opacity', cssStyles) || 1) || 1) * 100),
    _warning: isComplex ? 'Path vetorial complexo — fidelidade parcial como shape' : null,
  };
}

function dSvgSuggestVarName(content, name){
  const lower=((content||'')+' '+(name||'')).toLowerCase();
  if(/preco|preço|price|por|r\$/.test(lower)) return 'precoPor';
  if(/\bde\b|from|original/.test(lower)) return 'precoDe';
  if(/produto|product|nome/.test(lower)) return 'produto';
  if(/validade|valid|data/.test(lower)) return 'validade';
  if(/detalhe|descri/.test(lower)) return 'detalhes';
  return (name||'').toLowerCase().replace(/[^a-z0-9]/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'') || 'variavel';
}

function dSvgSuggestImgVar(name){
  const lower=(name||'').toLowerCase();
  if(/foto|photo|produto|product/.test(lower)) return 'foto_produto';
  if(/logo|marca|brand/.test(lower)) return 'logo_loja';
  return 'imagem';
}

/* ── UI / Tela de revisão de SVG ── */
function _dSvgEsc(s){ return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function dSvgShowReviewModal(elements, meta){
  const overlay=document.getElementById('d-svg-review-overlay');
  if(!overlay){ console.error('[svg] overlay d-svg-review-overlay não encontrado'); return; }
  overlay.innerHTML=dSvgBuildReviewHTML(elements, meta);
  overlay.style.display='flex';
  overlay._svgData={ elements, meta };
}

function dSvgBuildReviewHTML(elements, meta){
  const fmtOpts=['story','feed','wide'].map(f=>
    `<option value="${f}" ${meta.fmt===f?'selected':''}>${f.charAt(0).toUpperCase()+f.slice(1)}</option>`).join('');
  const rows=elements.map((el,i)=>{
    const modeOpts=dSvgModesForType(el.detectedType).map(m=>
      `<option value="${m.value}" ${el.mode===m.value?'selected':''}>${m.label}</option>`).join('');
    const warning=el._warning?`<div class="svg-rev-warn" style="display:inline-flex;align-items:center;gap:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>${_dSvgEsc(el._warning)}</div>`:'';
    const typeIcon={text:'T',shape:'□',image:'⊞','path-complex':'~'}[el.detectedType]||'?';
    const previewTxt=el.detectedType==='text'
      ? `<span class="svg-rev-preview-text">"${_dSvgEsc((el.content||'').substring(0,30))}"</span>` : '';
    const groupTag=el.groupName?`<span class="svg-rev-group" style="display:inline-flex;align-items:center;gap:3px"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>${_dSvgEsc(el.groupName)}</span>`:'';
    return `
      <div class="svg-rev-row" id="svg-rev-row-${i}">
        <div class="svg-rev-type-badge">${typeIcon}</div>
        <div class="svg-rev-info">
          <span class="svg-rev-name" title="${_dSvgEsc(el.name)}">${_dSvgEsc(el.name)}</span>
          ${groupTag}
          ${previewTxt}
          ${warning}
        </div>
        <select class="svg-rev-mode" onchange="dSvgRevSetMode(${i}, this.value)">${modeOpts}</select>
        <div class="svg-rev-var-wrap" id="svg-rev-var-${i}" style="display:${el.mode==='variable'?'flex':'none'}">
          <span class="svg-rev-var-prefix">{{</span>
          <input class="svg-rev-var-inp" value="${_dSvgEsc(el.varName||'')}" placeholder="nome_da_var" oninput="dSvgRevSetVar(${i}, this.value)">
          <span class="svg-rev-var-suffix">}}</span>
        </div>
      </div>`;
  }).join('');
  return `
    <div class="svg-rev-modal">
      <div class="svg-rev-header">
        <div>
          <span class="svg-rev-title">Revisar SVG</span>
          <span class="svg-rev-file">${_dSvgEsc(meta.fileName)}</span>
        </div>
        <div class="svg-rev-fmt-wrap">
          <span class="svg-rev-fmt-label">Formato</span>
          <select class="svg-rev-fmt-sel" id="svg-rev-fmt">${fmtOpts}</select>
          <span class="svg-rev-dim">${Math.round(meta.w)} × ${Math.round(meta.h)}</span>
        </div>
      </div>
      <div class="svg-rev-list">${rows}</div>
      <div class="svg-rev-footer">
        <button class="svg-rev-btn cancel" onclick="dSvgRevCancel()">Cancelar</button>
        <button class="svg-rev-btn confirm" onclick="dSvgRevConfirm()">Criar template <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-left:4px"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button>
      </div>
    </div>`;
}

// Modos disponíveis por tipo detectado
function dSvgModesForType(type){
  if(type==='text') return [
    {value:'text',label:'Texto editável'},
    {value:'variable',label:'Variável {{}}'},
    {value:'ignore',label:'Ignorar'},
  ];
  if(type==='image') return [
    {value:'frame',label:'Moldura (foto)'},
    {value:'image',label:'Imagem fixa'},
    {value:'ignore',label:'Ignorar'},
  ];
  if(type==='path-complex') return [
    {value:'ignore',label:'Ignorar'},
    {value:'shape',label:'Shape (parcial)'},
  ];
  return [
    {value:'shape',label:'Shape'},
    {value:'ignore',label:'Ignorar'},
  ];
}

function dSvgRevSetMode(index, mode){
  const o=document.getElementById('d-svg-review-overlay');
  if(o&&o._svgData&&o._svgData.elements[index]) o._svgData.elements[index].mode=mode;
  const varWrap=document.getElementById('svg-rev-var-'+index);
  if(varWrap) varWrap.style.display=(mode==='variable')?'flex':'none';
}

function dSvgRevSetVar(index, value){
  const o=document.getElementById('d-svg-review-overlay');
  if(o&&o._svgData&&o._svgData.elements[index]) o._svgData.elements[index].varName=value;
}

function dSvgRevCancel(){
  const o=document.getElementById('d-svg-review-overlay');
  if(o){ o.style.display='none'; o.innerHTML=''; o._svgData=null; }
}

function dSvgRevConfirm(){
  const overlay=document.getElementById('d-svg-review-overlay');
  if(!overlay||!overlay._svgData) return;
  const { elements, meta }=overlay._svgData;
  const sel=document.getElementById('svg-rev-fmt');
  const fmt=(sel&&sel.value)||meta.fmt;
  overlay.style.display='none'; overlay.innerHTML=''; overlay._svgData=null;
  dSvgCreateTemplate(elements, meta, fmt);
}

// Cria os layers finais no Luma com escalonamento de tela inteligente
function dSvgCreateTemplate(elements, meta, fmt){
  const layers=[];
  const targetSize = DFMT_SIZES[fmt] || { w: 1080, h: 1920 };

  // Escalonamento uniforme para preservar o aspecto original centralizando a composição no canvas final
  const uScale = Math.min(targetSize.w / meta.w, targetSize.h / meta.h);
  const dx = Math.round((targetSize.w - meta.w * uScale) / 2);
  const dy = Math.round((targetSize.h - meta.h * uScale) / 2);

  elements.forEach(el=>{
    if(el.mode==='ignore') return;

    const scaledX = Math.round(el.x * uScale + dx);
    const scaledY = Math.round(el.y * uScale + dy);
    const scaledW = Math.max(1, Math.round(el.w * uScale));
    const scaledH = Math.max(1, Math.round(el.h * uScale));

    const base={
      id:'d-lyr-'+Date.now()+'-'+Math.random().toString(36).slice(2),
      name:el.name, visible:true, locked:false, opacity:el.opacity||100,
    };

    if(el.mode==='text' || el.mode==='variable'){
      const isVar=el.mode==='variable';
      const varName=el.varName||'variavel';
      const scaledFontSize = Math.max(10, Math.round((el.fontSize || 48) * uScale));

      layers.push(Object.assign(base,{
        type:'text', x:scaledX, y:scaledY, w:scaledW, h:scaledH,
        content:isVar?('{{'+varName+'}}'):el.content,
        font:el.font||"'Roboto'", fontSize:scaledFontSize,
        color:el.color||'#000000', textAlign:el.textAlign||'left', isVar:isVar,
      }));
    }else if(el.mode==='shape'){
      // Corrige bug de perda do shapeKind (círculos viravam retângulos)
      const shapeKind = (el.svgTag === 'circle' || el.svgTag === 'ellipse') ? el.svgTag : 'rect';
      const scaledRadius = el.radius === 999 ? 999 : Math.round((el.radius || 0) * uScale);

      layers.push(Object.assign(base,{
        type:'shape', shapeKind:shapeKind, x:scaledX, y:scaledY, w:scaledW, h:scaledH,
        fill:el.fill||'#FF9000', radius:scaledRadius
      }));
    }else if(el.mode==='frame'){
      layers.push(Object.assign(base,{
        type:'frame', x:scaledX, y:scaledY, w:scaledW, h:scaledH,
        imgUrl:el.imgUrl||'', imgVar:el.imgVar||'foto_produto', objectFit:'cover', frameShape:'rect'
      }));
    }else if(el.mode==='image'){
      layers.push(Object.assign(base,{
        type:'image', x:scaledX, y:scaledY, w:scaledW, h:scaledH, imgUrl:el.imgUrl||''
      }));
    }
  });

  if(!layers.length){ gToast('Nenhum elemento selecionado para importar'); return; }
  const folder=(typeof dFolders!=='undefined'&&dFolders)
    ? (dFolders.find(x=>x.id===dImportTargetFolderId)||dFolders[0]) : null;
  if(!folder){ gToast('⚠ Crie uma pasta antes de importar','error'); return; }
  // Registra variáveis no catálogo (mesma lógica do import de PSD).
  if(typeof dSyncVarsFromContent==='function')
    layers.forEach(l=>{ if(l.type==='text'&&l.isVar) dSyncVarsFromContent(l.content); });
  const tmpl={
    id:'d-tmpl-'+Date.now(),
    name:(meta.fileName||'').replace(/\.(svg|ai)$/i,'') || 'SVG importado',
    fmt,
    layers,
    publishMeta:(typeof dDefaultPublishMeta==='function')?dDefaultPublishMeta():{publicado:false,permissoes:{}},
  };
  folder.templates.push(tmpl);
  if(typeof dFolderOpen!=='undefined') dFolderOpen[folder.id]=true;
  dRenderFolders();
  dLoadTemplate(tmpl, folder);
  dPersistFolders();
  gToast('✓ '+layers.length+' camada(s) importada(s) de '+(meta.fileName||'SVG'));
}

function dToggleCampaignsDrawer(open) {
  if (open === false) {
    if (typeof dActivatePanel === 'function') dActivatePanel('camadas');
  } else {
    if (typeof dActivatePanel === 'function') dActivatePanel('campaigns');
  }
}

/* ══════════════════════════════════════════════════════════════
   PAGES TRAY (Bandeja de Páginas estilo Canva)
══════════════════════════════════════════════════════════════ */

let dPagesTrayCollapsed = false;

function dTogglePagesTray() {
  dPagesTrayCollapsed = !dPagesTrayCollapsed;
  const tray = document.getElementById('d-pages-tray');
  if(tray) tray.classList.toggle('collapsed', dPagesTrayCollapsed);
}

function dRenderTemplateToDOM(container, tmpl) {
  if (!container || !tmpl) return;
  container.innerHTML = '';

  const layers = tmpl.layers || [];
  
  // Define background
  const bg = tmpl.bg || 'transparent';
  if (bg && bg !== 'transparent') {
    container.style.background = bg === 'white' ? '#ffffff' : bg;
  } else {
    container.style.background = document.body.classList.contains('theme-light') ? '#E8E8E8' : '#1A1A1F';
  }

  // Render layers
  layers.filter(l => l.visible !== false && l.type !== 'group').forEach(l => {
    const el = document.createElement('div');
    el.className = 'canvas-layer';
    el.style.cssText = `left:${l.x}px;top:${l.y}px;width:${l.w}px;height:${l.h}px;position:absolute;pointer-events:none;`;
    
    // Mask / blend mode
    if (l.mask) {
      const mu = `url("${l.mask}")`;
      el.style.webkitMaskImage = mu; el.style.maskImage = mu;
      el.style.webkitMaskSize = el.style.maskSize = '100% 100%';
      el.style.webkitMaskRepeat = el.style.maskRepeat = 'no-repeat';
    }
    if (l.blendMode) {
      el.style.mixBlendMode = l.blendMode.replace(/([A-Z])/g, c => '-' + c.toLowerCase());
    }

    if (l.type === 'shape') {
      el.style.opacity = (l.opacity || 100) / 100;
      const kind = l.shapeKind || 'rect';
      const pts = (kind !== 'circle' && kind !== 'ellipse' && typeof dShapePoints === 'function') ? dShapePoints(l) : null;
      if (pts) {
        const inner = document.createElement('div');
        inner.style.cssText = 'position:absolute;inset:0;';
        const abs = pts.map(p => [p[0] * l.w, p[1] * l.h]);
        const d = gRoundPolyD(abs, l.radius || 0);
        const _st = (l.strokeW > 0) ? ' stroke="' + (l.strokeColor || '#000') + '" stroke-width="' + l.strokeW + '"' : '';
        inner.innerHTML = '<svg width="100%" height="100%" viewBox="0 0 ' + l.w + ' ' + l.h + '" preserveAspectRatio="none" style="display:block;overflow:visible"><path d="' + d + '" fill="' + (l.fill || '#FF9000') + '"' + _st + '/></svg>';
        el.appendChild(inner);
      } else {
        el.style.background = dFxShapeBg(l);
        if (kind === 'circle' || kind === 'ellipse') {
          el.style.borderRadius = '50%';
        } else {
          const _cr = dCornerRadii(l);
          el.style.borderRadius = _cr.tl + 'px ' + _cr.tr + 'px ' + _cr.br + 'px ' + _cr.bl + 'px';
        }
        if (l.strokeW > 0 && l.strokeDash) {
          el.style.border = l.strokeW + 'px dashed ' + (l.strokeColor || '#000');
          el.style.boxSizing = 'border-box';
        }
        const _bs = dFxStrokeParts(l).concat(dFxShadowParts(l));
        if (_bs.length) el.style.boxShadow = _bs.join(', ');
      }
    } else if (l.type === 'text') {
      el.style.color = (l.overlay && l.overlayColor) ? gFxRgba(l.overlayColor, l.overlayOpacity != null ? l.overlayOpacity : 1) : (l.color || '#fff');
      const _fp = dTextFontParts(l.font);
      el.style.fontFamily = _fp.family;
      el.style.fontWeight = l.fontWeightOverride || _fp.weight;
      el.style.fontStyle = l.italic ? 'italic' : '';
      if (l.textTransform) el.style.textTransform = l.textTransform;
      
      // Tamanho SEMPRE 1:1 do PSD — sem auto-encolhimento (preserva a hierarquia dos textos).
      let _renderFs = l.fontSize || 24;
      el.style.fontSize = _renderFs + 'px';
      el.style.textAlign = l.textAlign || 'left';
      el.style.lineHeight = (l.lineHeight ? String(l.lineHeight) : '1.2');
      el.style.overflow = 'visible';
      // Point text não quebra automático (só \n); só parágrafo quebra por largura.
      el.style.whiteSpace = (l.textBox === 'box') ? 'pre-wrap' : 'pre';
      el.style.letterSpacing = (l.letterSpacing ? l.letterSpacing + 'px' : '');
      if (l.vertical) el.style.writingMode = 'vertical-rl';
      
      const textNode = document.createElement('div');
      // vAlign 'top' (PSD): topo da tinta no topo da caixa (1:1). Demais: centralização vertical.
      if (l.vAlign === 'top') {
        textNode.style.cssText = 'width:100%;overflow:visible;';
        const _gap = (typeof dTextInkTopGap === 'function') ? dTextInkTopGap(l.font, _renderFs, (l.lineHeight || 1.2)) : 0;
        if (_gap) textNode.style.transform = 'translateY(' + (-_gap).toFixed(2) + 'px)';
      } else {
        textNode.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;overflow:visible;';
      }
      if (l.runs && l.runs.length) {
        textNode.innerHTML = l.runs.map(r => `<span style="color:${r.color || 'inherit'};font-size:${r.fontSize || _renderFs}px;font-family:${dTextFontParts(r.font).family};font-weight:${dTextFontParts(r.font).weight};${r.letterSpacing ? 'letter-spacing:' + r.letterSpacing + 'px;' : ''}">${gEsc(r.text || '').replace(/\n/g, '<br>')}</span>`).join('');
      } else {
        textNode.innerHTML = gEsc(l.content || '').replace(gVarRegex(), (m, n) => {
          const varName = n.trim();
          const v = (typeof dVars !== 'undefined') && dVars.find(x => x.name === varName);
          return v ? (v.label || varName) : varName;
        });
      }
      if (l.gradient && l.gradient.stops && l.gradient.stops.length && !(l.runs && l.runs.length)) {
        textNode.style.backgroundImage = gGradientCss(l.gradient);
        textNode.style.webkitBackgroundClip = 'text'; textNode.style.backgroundClip = 'text';
        textNode.style.webkitTextFillColor = 'transparent';
      }
      if (l.strikethrough) textNode.style.textDecoration = 'line-through';
      const _fs = _renderFs;
      if (l.bg) {
        textNode.style.background = l.bgColor || '#000';
        textNode.style.borderRadius = Math.round(_fs * 0.2) + 'px';
      }
      if (l.strokeW > 0) {
        const sv = l.strokeW + 'px ' + (l.strokeColor || '#000');
        textNode.style.webkitTextStroke = sv; textNode.style.textStroke = sv;
      }
      {
        const _ts = [];
        if (l.shadow) {
          if (l.shadowBlur != null || l.shadowDist != null) {
            const o = gFxOffset(l.shadowDist != null ? l.shadowDist : _fs * 0.07, l.shadowAngle);
            _ts.push(`${o.x}px ${o.y}px ${(l.shadowBlur != null ? l.shadowBlur : _fs * 0.12)}px ${l.shadowColor || 'rgba(0,0,0,.5)'}`);
          } else {
            const sb = Math.max(1, _fs * 0.12), so = _fs * 0.05;
            _ts.push(`${so}px ${so}px ${sb}px ${l.shadowColor || 'rgba(0,0,0,.5)'}`);
          }
        }
        if (l.glow) {
          _ts.push(`0 0 ${(l.glowSize != null ? l.glowSize : _fs * 0.3)}px ${l.glowColor || 'rgba(255,255,255,.7)'}`);
        }
        if (_ts.length) textNode.style.textShadow = _ts.join(', ');
      }
      el.appendChild(textNode);
    } else if (l.type === 'frame') {
      el.style.position = 'relative';
      el.style.overflow = 'visible';
      const borderR = (l.frameShape === 'circle' ? '50%' : (l.radius || 8) + 'px');
      const inner = document.createElement('div');
      inner.style.cssText = `position:absolute;inset:0;overflow:hidden;border-radius:${borderR};`;
      if (l.imgUrl) {
        const img = document.createElement('img');
        img.src = l.imgUrl;
        const posX = (0.5 + (l.imgOffsetX || 0)) * 100, posY = (0.5 + (l.imgOffsetY || 0)) * 100;
        img.style.cssText = `width:100%;height:100%;object-fit:${l.objectFit || 'cover'};object-position:${posX}% ${posY}%;display:block;border-radius:${borderR};`;
        if (l.imgScale && l.imgScale !== 1) {
          img.style.transform = `scale(${l.imgScale})`;
          img.style.transformOrigin = 'center';
        }
        inner.appendChild(img);
      } else {
        inner.style.cssText += `background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;`;
        inner.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`;
      }
      el.appendChild(inner);
    } else if (l.type === 'image') {
      el.style.overflow = 'hidden';
      if (l.imgUrl) {
        const img = document.createElement('img');
        img.src = l.imgUrl;
        img.style.cssText = `width:100%;height:100%;object-fit:${l.objectFit || 'cover'};`;
        el.appendChild(img);
      } else {
        el.style.cssText += `background:rgba(255,255,255,.06);border:1px dashed rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;`;
        el.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`;
      }
    }
    
    container.appendChild(el);
  });
}

function dRenderPagesTray() {
  const tray = document.getElementById('d-pages-tray');
  if (!tray) return;

  // Se não tem pasta ativa (ex: tá na prancheta default avulsa)
  if (!dActiveTmplFolderId) {
    tray.classList.add('hidden');
    return;
  }

  const folder = dFolders.find(f => f.id === dActiveTmplFolderId);
  if (!folder || !folder.templates || folder.templates.length === 0) {
    tray.classList.add('hidden');
    return;
  }

  tray.classList.remove('hidden');
  const list = document.getElementById('ptray-list');
  if (!list) return;

  list.innerHTML = folder.templates.map((t, idx) => {
    const isActive = t.id === dActiveTmplId;
    
    // Calcula proporções do canvas para caber no box de 84x84
    const sizes = { story: [9, 16], feed: [4, 5], wide: [16, 9], post: [16, 9] };
    const [aspectW, aspectH] = sizes[t.fmt] || [9, 16];
    
    let cw = 84;
    let ch = 84;
    if (aspectW > aspectH) {
      ch = Math.round(84 * aspectH / aspectW);
    } else if (aspectW < aspectH) {
      cw = Math.round(84 * aspectW / aspectH);
    }

    // Dimensões do template original
    const tmplSizes = { story: [1080, 1920], feed: [1080, 1350], wide: [1200, 628], post: [1200, 628] };
    const [tw, th] = tmplSizes[t.fmt] || [1080, 1920];
    const scale = cw / tw;

    return `
      <div class="ptray-item ${isActive ? 'active' : ''}" onclick="dSwitchPage('${t.id}')">
        <div class="ptray-preview-container">
          <span class="ptray-item-num">${idx + 1}</span>
          
          <div class="ptray-dom-wrapper" style="width:${cw}px; height:${ch}px;">
            <div class="ptray-dom-canvas" data-tmpl-id="${t.id}" style="width:${tw}px; height:${th}px; transform: scale(${scale}); transform-origin: top left;">
              <!-- Elementos de layer inseridos dinamicamente -->
            </div>
          </div>
          
          <div class="ptray-item-actions">
            <button class="ptray-act-btn" onclick="dDuplicatePageInTray(event, '${t.id}')" title="Duplicar">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button class="ptray-act-btn danger" onclick="dDeletePageInTray(event, '${t.id}')" title="Excluir">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
        <div class="ptray-item-label" title="${gEsc(t.name)}">${gEsc(t.name)}</div>
      </div>
    `;
  }).join('');

  // Renderiza cada template no seu respectivo contêiner DOM
  folder.templates.forEach(t => {
    const container = list.querySelector(`.ptray-dom-canvas[data-tmpl-id="${t.id}"]`);
    if (container) {
      dRenderTemplateToDOM(container, t);
    }
  });
}

function dSwitchPage(tmplId) {
  if (tmplId === dActiveTmplId) return; // Já está na página
  
  // Salva a página atual automaticamente antes de trocar
  if (typeof dSave === 'function') dSave();
  
  // Carrega a nova
  dLoadTemplateById(dActiveTmplFolderId, tmplId);
}

function dAddPageToCurrentFolder() {
  if (!dActiveTmplFolderId) return;
  const folder = dFolders.find(f => f.id === dActiveTmplFolderId);
  if (!folder) return;

  // Salva a atual
  if (typeof dSave === 'function') dSave();

  const id = 't' + Date.now();
  const n = folder.templates.length + 1;
  const name = 'Página ' + n;
  
  // Copia o formato/tamanho da prancheta ativa se existir, senão usa 'story'
  const ab = dGetActiveAB && dGetActiveAB();
  const fmt = ab ? (ab.fmt || 'story') : 'story';
  // Prancheta de tamanho custom (fmt sem preset DFMT, ex.: PSD 1:1) → herda w/h reais.
  const isCustom = !!(ab && !DFMT_SIZES[fmt] && ab.w>0 && ab.h>0);

  const newTmpl = {
    id,
    name,
    fmt,
    layers: isCustom ? dBuildBlankLayersWH(ab.w, ab.h) : dBuildBlankLayers(fmt),
    publishMeta: dDefaultPublishMeta()
  };
  // dLoadTemplate lê tmpl.w/h quando presente → novas páginas mantêm o tamanho custom 1:1.
  if(isCustom){ newTmpl.w=ab.w; newTmpl.h=ab.h; }

  folder.templates.push(newTmpl);
  dPersistFolders();
  dLoadTemplate(newTmpl, folder);
  dRenderPagesTray();
  gToast('Nova página adicionada!');
}

function dDuplicatePageInTray(ev, tmplId) {
  ev.stopPropagation();
  const folder = dFolders.find(f => f.id === dActiveTmplFolderId);
  if (!folder) return;
  
  const orig = folder.templates.find(t => t.id === tmplId);
  if (!orig) return;

  // Garante salvar estado se estivermos duplicando a página ATUAL
  if (tmplId === dActiveTmplId && typeof dSave === 'function') dSave();

  const id = 't' + Date.now();
  const clone = JSON.parse(JSON.stringify(orig));
  clone.id = id;
  clone.name = clone.name + ' cópia';
  // Reset metadados de publicação para a cópia (não sai publicada de cara)
  clone.publishMeta = dDefaultPublishMeta();

  // Insere logo após o original
  const idx = folder.templates.indexOf(orig);
  folder.templates.splice(idx + 1, 0, clone);

  dPersistFolders();
  
  // Troca direto pra duplicata
  dLoadTemplate(clone, folder);
  dRenderPagesTray();
  gToast('Página duplicada!');
}

function dDeletePageInTray(ev, tmplId) {
  ev.stopPropagation();
  const folder = dFolders.find(f => f.id === dActiveTmplFolderId);
  if (!folder) return;

  if (!confirm('Excluir esta página?')) return;

  const idx = folder.templates.findIndex(t => t.id === tmplId);
  if (idx === -1) return;
  const _dtmpl=folder.templates[idx];
  if(_dtmpl&&_dtmpl.remoteId) dDeleteTemplateFromBackend(_dtmpl.remoteId);
  folder.templates.splice(idx, 1);
  dPersistFolders();

  if (folder.templates.length === 0) {
    // Apagou a última página da pasta. 
    // Vamos criar uma página em branco pra pasta não ficar vazia (ou fechar a pasta).
    dAddPageToCurrentFolder(); 
  } else if (tmplId === dActiveTmplId) {
    // Apagou a que tava ativa, carrega a anterior ou a próxima
    const nextIdx = Math.min(idx, folder.templates.length - 1);
    dLoadTemplate(folder.templates[nextIdx], folder);
  } else {
    dRenderPagesTray();
  }
  dRenderFolders(); // atualiza a contagem na lista lateral
}
