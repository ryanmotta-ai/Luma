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
let dArtboards=[],dActiveABId=null;

function dDefaultFolders(){
  const camps=[...CAMPS_ATIVAS,...CAMPS_OUTRAS];
  // Pastas das campanhas começam VAZIAS — o designer cria os materiais de cada uma.
  dFolders=camps.map((c,i)=>({
    id:'f'+i,name:c.name,color:c.color,campId:c.id,cover:'',grupos:['Todos os usuários'],agendamento:null,
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
      if(typeof gEnsureAnchors==='function'){
        const sz=DFMT_SIZES[t.fmt]||DFMT_SIZES.story;
        gEnsureAnchors(t.layers||[], sz.w, sz.h);
      }
      if(!t.formats) t.formats=['story','feed','wide']; // smart resize cobre os 3
    });
  });
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
    if(l.content){ const re=gVarRegex(); let m; while((m=re.exec(l.content))) vars.add(m[1]); }
    if(l.imgVar) vars.add(l.imgVar);
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
   ARTBOARDS (PRANCHETAS)
══════════════════════════════════════════════════════════════ */
function dGetActiveAB(){return dArtboards.find(ab=>ab.id===dActiveABId);}

function dSyncLayersToAB(){
  const ab=dGetActiveAB();
  if(ab)ab.layers=JSON.parse(JSON.stringify(dLayers));
}

function dNewArtboard(fmt,posX,posY){
  dSyncLayersToAB();
  fmt=fmt||dFmt||'story';
  const f=DFMT_SIZES[fmt]||DFMT_SIZES.story;
  const id='ab-'+Date.now();
  const n=dArtboards.length;
  let x=posX,y=posY;
  if(x===undefined){
    if(n===0){x=80;y=60;}
    else{const last=dArtboards[n-1];x=last.x+last.w+140;y=last.y;}
  }
  const ab={id,name:'Prancheta '+(n+1),x,y,w:f.w,h:f.h,fmt,layers:dBuildBlankLayers(fmt)};
  dArtboards.push(ab);
  dActiveABId=id;
  dLayers=JSON.parse(JSON.stringify(ab.layers));
  dFmt=fmt;dSelId=null;dMultiSel=[];
  dHistoryReset();
  if(typeof dRenderWorkspace==='function')dRenderWorkspace();
  dApplyFormat();dRenderCanvas();dRenderLayersList();dRenderABList();
  setTimeout(dFitToScreen,60);
  return ab;
}

function dSetActiveAB(id){
  if(id===dActiveABId)return;
  dSyncLayersToAB();
  dActiveABId=id;
  const ab=dGetActiveAB();if(!ab)return;
  dLayers=JSON.parse(JSON.stringify(ab.layers));
  dFmt=ab.fmt;dSelId=null;dMultiSel=[];
  dHistoryReset();
  if(typeof dRenderWorkspace==='function')dRenderWorkspace();
  dApplyFormat();dRenderCanvas();dRenderLayersList();dRenderABList();
  gToast('"'+ab.name+'" ativa');
}

function dDeleteAB(id){
  if(dArtboards.length<=1){gToast('⚠ Mantenha pelo menos uma prancheta');return;}
  if(!confirm('Excluir esta prancheta e todos os seus layers?'))return;
  dArtboards=dArtboards.filter(ab=>ab.id!==id);
  if(dActiveABId===id){
    const ab=dArtboards[0];
    dActiveABId=ab.id;
    dLayers=JSON.parse(JSON.stringify(ab.layers));
    dFmt=ab.fmt;dSelId=null;dMultiSel=[];
    if(typeof dHistoryReset==='function')dHistoryReset(); // senão Ctrl+Z aplica layers da prancheta excluída na ativa
  }
  if(typeof dRenderWorkspace==='function')dRenderWorkspace();
  dApplyFormat();dRenderCanvas();dRenderLayersList();dRenderABList();
}

function dRenameAB(id,evt){
  if(evt)evt.stopPropagation();
  const ab=dArtboards.find(x=>x.id===id);if(!ab)return;
  const n=prompt('Nome da prancheta:',ab.name);
  if(!n||!n.trim())return;
  ab.name=n.trim();
  if(typeof dRenderWorkspace==='function')dRenderWorkspace();
  dRenderABList();
}

function dDuplicateAB(id){
  const src=dArtboards.find(ab=>ab.id===id);if(!src)return;
  dSyncLayersToAB();
  const newId='ab-'+Date.now();
  const ab={...JSON.parse(JSON.stringify(src)),id:newId,name:src.name+' (cópia)',x:src.x+src.w+140,y:src.y};
  dArtboards.push(ab);
  dActiveABId=newId;
  dLayers=JSON.parse(JSON.stringify(ab.layers));
  dFmt=ab.fmt;dSelId=null;dMultiSel=[];
  dHistoryReset();
  if(typeof dRenderWorkspace==='function')dRenderWorkspace();
  dApplyFormat();dRenderCanvas();dRenderLayersList();dRenderABList();
  gToast('✓ Prancheta duplicada');
}

function dRenderABList(){
  const el=document.getElementById('d-ab-list');if(!el)return;
  el.innerHTML=dArtboards.map(ab=>`
    <div class="ab-item ${ab.id===dActiveABId?'active':''}" onclick="dSetActiveAB('${ab.id}')">
      <span class="ab-dot"></span>
      <span class="ab-name" ondblclick="dRenameAB('${ab.id}',event)" title="Duplo clique para renomear">${ab.name}</span>
      <span class="ab-fmt-tag">${ab.fmt}</span>
      <button class="ab-dup" onclick="event.stopPropagation();dDuplicateAB('${ab.id}')" title="Duplicar prancheta">⎘</button>
      <button class="ab-del" onclick="event.stopPropagation();dDeleteAB('${ab.id}')" title="Excluir prancheta">×</button>
    </div>`).join('');
}

function dPersistArtboards(){
  let droppedImg=false;
  try{
    const saveable=dArtboards.map(ab=>({...ab,layers:ab.layers.map(l=>{
      // Mantém imagens pequenas (sobrevivem ao reload); descarta grandes p/ não estourar quota.
      // TODO(Fase 5): mover blobs grandes para IndexedDB/Storage.
      const packed=gPackImgUrl(l.imgUrl);
      if(packed.dropped)droppedImg=true;
      const out={...l,imgUrl:packed.url};
      // Máscara (alpha) também conta pra quota — empacota; se não couber, sai sem máscara.
      if(l.mask){ const pm=gPackMask(l.mask); if(pm.dropped){ delete out.mask; droppedImg=true; } else out.mask=pm.url; }
      return out;
    })}));
    localStorage.setItem('yngs_artboards_v1',JSON.stringify(saveable));
    if(droppedImg&&typeof gWarnImagesNotPersisted==='function')gWarnImagesNotPersisted();
    return true;
  }catch(e){
    if(e&&(e.name==='QuotaExceededError'||e.code===22))
      gToast('⚠ Não foi possível salvar: armazenamento cheio.','error');
    else gToast('⚠ Erro ao salvar a prancheta.','error');
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
  if(!dAssets || !dAssets.length){
    dAssets=[{name:'logo-dm.png',url:'',emoji:'◆'},{name:'bg-laranja.jpg',url:'',emoji:'◇'}];
  }
  dHistory=[];dHistoryIdx=-1;
  dRenderFolders();
  dVarsRender();dAssetsRender();
  if(typeof dLoadSnippets==='function'){dLoadSnippets();dRenderSnippets();}
  if(typeof dFontsRestore==='function'){dFontsRestore();dFontsRenderList();}
  // Restaurar pranchetas salvas ou começar com uma em branco
  let loaded=false;
  try{
    const saved=localStorage.getItem('yngs_artboards_v1');
    if(saved){
      const parsed=JSON.parse(saved);
      if(parsed&&parsed.length){
        dArtboards=parsed;dActiveABId=parsed[0].id;
        dLayers=JSON.parse(JSON.stringify(parsed[0].layers));
        dFmt=parsed[0].fmt;dSelId=null;dMultiSel=[];
        dHistoryReset();
        loaded=true;
      }
    }
  }catch(e){}
  if(!loaded){dArtboards=[];dActiveABId=null;dNewArtboard('story');}
  else{
    if(typeof dRenderWorkspace==='function')dRenderWorkspace();
    dApplyFormat();dRenderCanvas();dRenderLayersList();dRenderABList();
    setTimeout(dFitToScreen,100);
  }
  setTimeout(dEnsurePaintCanvas,100);
  // Campanhas/Biblioteca agora são abas do painel direito (#d-right); a aba Campanhas já abre por padrão
}

/* ── PASTAS (grade estilo Deskfy: card com capa + menu, expande templates inline) ── */
function dRenderFolders(){
  const el=document.getElementById('d-folder-list');
  el.classList.add('folder-grid');
  el.innerHTML=dFolders.map(f=>{
    const open=dFolderOpen[f.id];
    const cover=(f.cover&&f.cover!=='__local__')?f.cover:'';
    const coverStyle=cover
      ? `background-image:url('${cover}');background-size:cover;background-position:center`
      : `background:linear-gradient(135deg, ${f.color||'#FF9000'}, ${f.color||'#FF9000'}cc)`;
    const sched=f.agendamento?`<span class="folder-card-sched" title="Agendada para ${gEsc(f.agendamento)}">📅</span>`:'';
    const restrita=(f.grupos&&f.grupos.length&&!f.grupos.includes('Todos os usuários'))?`<span class="folder-card-lock" title="Restrita a: ${gEsc(f.grupos.join(', '))}">🔒</span>`:'';
    const card=`
      <div class="folder-card ${open?'open':''} ${f.id===dActiveTmplFolderId?'active':''}" id="fi-${f.id}">
        <div class="folder-card-cover" style="${coverStyle}" onclick="dToggleFolder('${f.id}')">
          ${!cover?`<span class="folder-card-coverlabel">${gEsc(f.name)}</span>`:''}
          <span class="folder-card-count">${f.templates.length}</span>
          <div class="folder-card-badges">${sched}${restrita}</div>
          <button class="folder-card-menu" onclick="event.stopPropagation();dFolderMenu(event,'${f.id}')" aria-label="Opções da pasta">⋯</button>
        </div>
        <div class="folder-card-foot" onclick="dToggleFolder('${f.id}')">
          <span class="folder-card-ico">📁</span>
          <span class="folder-card-name" ondblclick="event.stopPropagation();dRenameFolder('${f.id}')" title="${gEsc(f.name)}">${gEsc(f.name)}</span>
          <span class="folder-card-chev">${open?'▾':'▸'}</span>
        </div>
      </div>`;
    // Bloco de templates expandido (ocupa a linha inteira da grade)
    const expanded=open?`
      <div class="folder-templates-row" id="ft-${f.id}">
        ${f.templates.length?f.templates.map(t=>{
          const meta=t.publishMeta||{};
          const pubStatus=meta.publicado
            ?`<span class="tmpl-status pub" title="Publicado">●</span>`
            :`<span class="tmpl-status draft" title="Rascunho">○</span>`;
          return `<div class="template-item ${t.id===dActiveTmplId?'active':''}">
            <div class="template-row" onclick="dLoadTemplateById('${f.id}','${t.id}')">
              ${pubStatus}
              <div class="template-name">${gEsc(t.name)}</div>
              <div class="template-fmt">${t.fmt}</div>
            </div>
            <button class="tmpl-menu-btn" onclick="event.stopPropagation();dTemplateMenuOpen(event,'${f.id}','${t.id}')" aria-label="Mais opções">⋯</button>
          </div>`;
        }).join(''):'<div class="folder-templates-empty">Nenhum material nesta pasta ainda.</div>'}
      </div>`:'';
    return card+expanded;
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
      <span class="tmpl-ctx-icon">📅</span>Editar validade
    </button>
    <button class="tmpl-ctx-item" onclick="dQuickEditPerms('${folderId}','${tmplId}')">
      <span class="tmpl-ctx-icon">🔒</span>Editar permissões
    </button>
    ${isPublished
      ? `<button class="tmpl-ctx-item" onclick="dToggleTemplatePublish('${folderId}','${tmplId}',false)"><span class="tmpl-ctx-icon">🚫</span>Despublicar</button>`
      : `<button class="tmpl-ctx-item" onclick="dToggleTemplatePublish('${folderId}','${tmplId}',true)"><span class="tmpl-ctx-icon">🚀</span>Publicar agora</button>`
    }
    <div class="tmpl-ctx-sep"></div>
    <button class="tmpl-ctx-item tmpl-ctx-danger" onclick="dDeleteTemplate('${folderId}','${tmplId}')">
      <span class="tmpl-ctx-icon">🗑</span>Excluir
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
  gToast(publicar ? '🚀 Material publicado!' : 'Material despublicado.');
}
function dDeleteTemplate(folderId, tmplId){
  if(!confirm('Excluir este template? Ação não pode ser desfeita.')) return;
  const f=dFolders.find(x=>x.id===folderId); if(!f) return;
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
function dToggleFolder(id){dFolderOpen[id]=!dFolderOpen[id];dRenderFolders();}

function dLoadTemplate(tmpl,folder){
  if(!tmpl)return;
  dActiveTmplId=tmpl.id;
  if(folder)dActiveTmplFolderId=folder.id; // destaca a pasta da arte ativa na grade
  dFmt=tmpl.fmt;
  // Carrega no artboard ativo (substitui layers e formato)
  const f=DFMT_SIZES[tmpl.fmt]||DFMT_SIZES.story;
  const ab=dGetActiveAB();
  if(ab){ab.layers=JSON.parse(JSON.stringify(tmpl.layers||[]));ab.fmt=tmpl.fmt;ab.name=tmpl.name;ab.w=f.w;ab.h=f.h;}
  dLayers=JSON.parse(JSON.stringify(tmpl.layers||[]));
  dSelId=null;dMultiSel=[];
  dHistoryReset();
  dRenderFolders();
  if(typeof dRenderWorkspace==='function')dRenderWorkspace();
  dApplyFormat();
  setTimeout(dFitToScreen,50);
  dRenderCanvas();dRenderLayersList();dStats();dMarkUnsaved();dRenderABList();
  document.querySelectorAll('.dt-fmt').forEach(b=>b.classList.toggle('active',b.dataset.fmt===dFmt));
  gToast('Template "'+tmpl.name+'" carregado na prancheta ativa');
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
    if(typeof fRenderCatalogs==='function')try{fRenderCatalogs(CAMPS_ATIVAS,CAMPS_OUTRAS);}catch(e){}
    gToast('✓ Pasta "'+name+'" atualizada');
    return;
  }
  const id='f'+Date.now();
  dFolders.push({id,name,color,campId,cover:dFolderDraftCover||'',grupos:grupos.length?grupos:['Todos os usuários'],agendamento,templates:[]});
  dFolderOpen[id]=true;
  dRenderFolders();
  dPersistFolders();
  dCloseFolderModal();
  if(typeof fRenderCatalogs==='function')try{fRenderCatalogs(CAMPS_ATIVAS,CAMPS_OUTRAS);}catch(e){}
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
  if(typeof fRenderCatalogs==='function')try{fRenderCatalogs(CAMPS_ATIVAS,CAMPS_OUTRAS);}catch(e){}
  gToast('✓ Pasta renomeada');
}
function dDeleteFolder(id){
  document.querySelectorAll('.folder-ctx-menu').forEach(m=>m.remove());
  const f=dFolders.find(x=>x.id===id);if(!f)return;
  const n=(f.templates||[]).length;
  if(!confirm(`Excluir a pasta "${f.name}"${n?` e seus ${n} template(s)`:''}? Esta ação não pode ser desfeita.`))return;
  dFolders=dFolders.filter(x=>x.id!==id);
  dRenderFolders();dPersistFolders();
  if(typeof fRenderCatalogs==='function')try{fRenderCatalogs(CAMPS_ATIVAS,CAMPS_OUTRAS);}catch(e){}
  gToast('Pasta "'+f.name+'" excluída');
}
// Menu "..." de cada card de pasta na grade
function dFolderMenu(ev,id){
  ev.preventDefault();ev.stopPropagation();
  document.querySelectorAll('.folder-ctx-menu,.tmpl-context-menu').forEach(m=>m.remove());
  const menu=document.createElement('div');
  menu.className='folder-ctx-menu tmpl-context-menu';
  menu.innerHTML=`
    <button class="tmpl-ctx-item" onclick="dEditFolder('${id}')"><span class="tmpl-ctx-icon">✎</span>Editar pasta</button>
    <button class="tmpl-ctx-item" onclick="dRenameFolder('${id}')"><span class="tmpl-ctx-icon">↻</span>Renomear</button>
    <div class="tmpl-ctx-sep"></div>
    <button class="tmpl-ctx-item tmpl-ctx-danger" onclick="dDeleteFolder('${id}')"><span class="tmpl-ctx-icon">🗑</span>Excluir pasta</button>`;
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
  sel.innerHTML=dFolders.map(f=>`<option value="${f.id}">${f.name}</option>`).join('');
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

/* ── FORMATO / CANVAS ── */
const DFMT_SIZES={story:{w:1080,h:1920},feed:{w:1080,h:1080},wide:{w:1200,h:628}};

/* ══════════════════════════════════════════════════════════════
   IMPORT DE SVG (Illustrator) — mesma filosofia do PSD: revisa por
   elemento e cria layers reais. SVG é XML puro → DOMParser, sem libs.
   Reusa dPsdDetectFmt / dDefaultPublishMeta / dRenderFolders /
   dPersistFolders / dLoadTemplate (globais já existentes).
══════════════════════════════════════════════════════════════ */

// Lê uma propriedade de apresentação: atributo OU style="" inline.
// O Illustrator frequentemente exporta estilo inline (fill, font-size...) em vez
// de atributos — sem isso, cores/fontes sairiam erradas. (Classes <style> não cobertas.)
function _dSvgProp(el, name){
  const a = el.getAttribute && el.getAttribute(name);
  if(a!=null && a!=='') return a;
  try{ const s = el.style && el.style.getPropertyValue(name); if(s) return s.trim(); }catch(e){}
  return null;
}

// Entry point — chamado pelo botão "↑ Importar SVG"
function dSvgImport(){
  const inp=document.createElement('input');
  inp.type='file'; inp.accept='.svg,.ai';
  inp.onchange=e=>{
    const file=e.target.files && e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>dSvgHandleFile(ev.target.result, file.name);
    reader.onerror=()=>gToast('⚠ Não consegui ler o arquivo','error');
    reader.readAsText(file);
  };
  inp.click();
}

// Parseia o texto SVG e abre a tela de revisão
function dSvgHandleFile(svgText, fileName){
  try{
    const doc=new DOMParser().parseFromString(svgText,'image/svg+xml');
    if(doc.querySelector('parsererror')){ gToast('⚠ Erro ao ler o SVG — verifique o arquivo','error'); return; }
    const svgEl=doc.querySelector('svg');
    if(!svgEl){ gToast('⚠ Arquivo SVG inválido','error'); return; }
    // Dimensões do documento (viewBox tem prioridade; senão width/height)
    let docW, docH;
    const vb=svgEl.getAttribute('viewBox');
    if(vb){ const p=vb.trim().split(/[\s,]+/); docW=parseFloat(p[2]); docH=parseFloat(p[3]); }
    if(!docW||!docH){ docW=parseFloat(svgEl.getAttribute('width'))||1080; docH=parseFloat(svgEl.getAttribute('height'))||1920; }
    const elements=dSvgExtractElements(svgEl, docW, docH);
    if(!elements.length){ gToast('⚠ Nenhum elemento reconhecido no SVG','error'); return; }
    const fmt=(typeof dPsdDetectFmt==='function')?dPsdDetectFmt(docW,docH):'story';
    dSvgShowReviewModal(elements, {w:docW, h:docH, fmt, fileName});
  }catch(e){ console.error('[svg] erro ao parsear:',e); gToast('⚠ Erro ao processar o SVG','error'); }
}

// Extrai elementos do SVG (achata grupos 1 nível, como layers do Illustrator)
function dSvgExtractElements(svgEl, docW, docH){
  const elements=[]; let idCounter=0;
  const RECOG=['rect','circle','ellipse','text','image','path'];
  Array.from(svgEl.children).forEach(node=>{
    const tag=node.tagName.toLowerCase();
    const name=dSvgGetName(node) || (tag+'_'+(++idCounter));
    if(tag==='g'){
      const children=Array.from(node.children).filter(c=>RECOG.includes(c.tagName.toLowerCase()));
      if(!children.length) return;            // grupo vazio (ou só com sub-grupos)
      if(children.length===1){
        const el=dSvgParseElement(children[0], name, docW, docH);
        if(el) elements.push(el);
      }else{
        children.forEach((child,i)=>{
          const childName=dSvgGetName(child) || (name+'_'+(i+1));
          const el=dSvgParseElement(child, childName, docW, docH);
          if(el){ el.groupName=name; elements.push(el); }
        });
      }
    }else if(RECOG.includes(tag)){
      const el=dSvgParseElement(node, name, docW, docH);
      if(el) elements.push(el);
    }
  });
  return elements;
}

function dSvgGetName(el){
  return el.getAttribute('inkscape:label') || el.getAttribute('data-name') || el.getAttribute('id') || null;
}

function dSvgParseElement(el, name, docW, docH){
  const tag=el.tagName.toLowerCase();
  if(tag==='text'||tag==='tspan') return dSvgParseText(el, name, docW, docH);
  if(tag==='rect') return dSvgParseRect(el, name, docW, docH);
  if(tag==='circle'||tag==='ellipse') return dSvgParseCircle(el, name, docW, docH);
  if(tag==='image') return dSvgParseImage(el, name, docW, docH);
  if(tag==='path') return dSvgParsePath(el, name, docW, docH);
  return null;
}

function dSvgParseText(el, name, docW, docH){
  const content=(el.textContent||'').trim();
  const x=parseFloat(_dSvgProp(el,'x')||0);
  const y=parseFloat(_dSvgProp(el,'y')||0);
  const fontSize=parseFloat(_dSvgProp(el,'font-size')||48)||48;
  const fontFamily=_dSvgProp(el,'font-family')||'Roboto';
  const fill=_dSvgProp(el,'fill')||'#000000';
  const textAnchor=_dSvgProp(el,'text-anchor')||'start';
  const alignMap={start:'left',middle:'center',end:'right'};
  const isVarHint=/^\{\{.+\}\}$/.test(content) || /^[A-ZÀ-Ý0-9\s$.,!?-]{2,}$/.test(content);
  return {
    _id:'svg-'+Math.random().toString(36).slice(2),
    name, svgTag:'text', detectedType:'text',
    mode:isVarHint?'variable':'text',
    varName:dSvgSuggestVarName(content, name),
    content,
    x:Math.round(x),
    y:Math.round(y-fontSize),                       // SVG text y é baseline → topo
    w:Math.max(40, Math.min(Math.round(docW*0.8), Math.round(docW-x))),
    h:Math.round(fontSize*1.4),
    fontSize:Math.round(fontSize),
    font:dSvgMapFont(fontFamily),
    color:fill,
    textAlign:alignMap[textAnchor]||'left',
    opacity:Math.round((parseFloat(_dSvgProp(el,'opacity')||1)||1)*100),
  };
}

function dSvgParseRect(el, name, docW, docH){
  return {
    _id:'svg-'+Math.random().toString(36).slice(2),
    name, svgTag:'rect', detectedType:'shape', mode:'shape',
    x:Math.round(parseFloat(_dSvgProp(el,'x')||0)),
    y:Math.round(parseFloat(_dSvgProp(el,'y')||0)),
    w:Math.round(parseFloat(_dSvgProp(el,'width')||100)),
    h:Math.round(parseFloat(_dSvgProp(el,'height')||100)),
    fill:_dSvgProp(el,'fill')||'#FF9000',
    radius:Math.round(parseFloat(_dSvgProp(el,'rx')||0)),
    opacity:Math.round((parseFloat(_dSvgProp(el,'opacity')||1)||1)*100),
  };
}

function dSvgParseCircle(el, name, docW, docH){
  const tag=el.tagName.toLowerCase();
  const cx=parseFloat(_dSvgProp(el,'cx')||0);
  const cy=parseFloat(_dSvgProp(el,'cy')||0);
  const r=parseFloat(_dSvgProp(el,'r')||_dSvgProp(el,'rx')||50)||50;
  return {
    _id:'svg-'+Math.random().toString(36).slice(2),
    name, svgTag:tag, detectedType:'shape', mode:'shape',
    x:Math.round(cx-r), y:Math.round(cy-r), w:Math.round(r*2), h:Math.round(r*2),
    fill:_dSvgProp(el,'fill')||'#FF9000',
    radius:999,                                     // círculo
    opacity:Math.round((parseFloat(_dSvgProp(el,'opacity')||1)||1)*100),
  };
}

function dSvgParseImage(el, name, docW, docH){
  const href=el.getAttribute('href')||el.getAttribute('xlink:href')||'';
  const isBase64=href.startsWith('data:image');
  return {
    _id:'svg-'+Math.random().toString(36).slice(2),
    name, svgTag:'image', detectedType:'image', mode:'frame',
    x:Math.round(parseFloat(_dSvgProp(el,'x')||0)),
    y:Math.round(parseFloat(_dSvgProp(el,'y')||0)),
    w:Math.round(parseFloat(_dSvgProp(el,'width')||300)),
    h:Math.round(parseFloat(_dSvgProp(el,'height')||300)),
    imgUrl:isBase64?href:'',
    imgVar:dSvgSuggestImgVar(name),
    opacity:Math.round((parseFloat(_dSvgProp(el,'opacity')||1)||1)*100),
  };
}

// Estima bounding box de um path pelos números do atributo `d` (getBBox não funciona
// em DOM destacado do DOMParser). Aproximado: trata os números como pares x,y.
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

function dSvgParsePath(el, name, docW, docH){
  const d=el.getAttribute('d')||'';
  let x=0,y=0,w=100,h=100;
  const bb=_dSvgPathBBox(d);
  if(bb){ x=bb.x; y=bb.y; w=bb.w; h=bb.h; }
  const fill=_dSvgProp(el,'fill');
  const isComplex=d.split(/[Mm]/).length>3;          // múltiplos sub-paths → complexo
  return {
    _id:'svg-'+Math.random().toString(36).slice(2),
    name, svgTag:'path',
    detectedType:isComplex?'path-complex':'shape',
    mode:isComplex?'ignore':'shape',
    x:Math.round(x), y:Math.round(y),
    w:Math.round(w)||100, h:Math.round(h)||100,
    fill:fill||'#000000', radius:0, opacity:100,
    _warning:isComplex?'Path vetorial complexo — fidelidade parcial como shape':null,
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

// Mapeia fonte do Illustrator p/ um preset reconhecido pelo Luma (dTextFontParts)
function dSvgMapFont(fontFamily){
  const f=(fontFamily||'').toLowerCase();
  if(/realce|black|heavy|display|900/.test(f)) return "'Roboto Black'";
  if(/bold|700/.test(f)) return "'Roboto',bold";
  return "'Roboto'";
}

/* ── tela de revisão do SVG ── */
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
    const warning=el._warning?`<div class="svg-rev-warn">⚠ ${_dSvgEsc(el._warning)}</div>`:'';
    const typeIcon={text:'T',shape:'□',image:'⊞','path-complex':'~'}[el.detectedType]||'?';
    const previewTxt=el.detectedType==='text'
      ? `<span class="svg-rev-preview-text">"${_dSvgEsc((el.content||'').substring(0,30))}"</span>` : '';
    const groupTag=el.groupName?`<span class="svg-rev-group">← ${_dSvgEsc(el.groupName)}</span>`:'';
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
        <button class="svg-rev-btn confirm" onclick="dSvgRevConfirm()">Criar template →</button>
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

// Cria os layers a partir dos elementos revisados e abre como template novo (rascunho).
function dSvgCreateTemplate(elements, meta, fmt){
  const layers=[];
  elements.forEach(el=>{
    if(el.mode==='ignore') return;
    const base={
      id:'d-lyr-'+Date.now()+'-'+Math.random().toString(36).slice(2),
      name:el.name, visible:true, locked:false, opacity:el.opacity||100,
    };
    if(el.mode==='text' || el.mode==='variable'){
      const isVar=el.mode==='variable';
      const varName=el.varName||'variavel';
      layers.push(Object.assign(base,{
        type:'text', x:el.x, y:el.y, w:el.w, h:el.h,
        content:isVar?('{{'+varName+'}}'):el.content,
        font:el.font||"'Roboto'", fontSize:el.fontSize||48,
        color:el.color||'#000000', textAlign:el.textAlign||'left', isVar:isVar,
      }));
    }else if(el.mode==='shape'){
      layers.push(Object.assign(base,{ type:'shape', x:el.x, y:el.y, w:el.w, h:el.h,
        fill:el.fill||'#FF9000', radius:el.radius||0 }));
    }else if(el.mode==='frame'){
      layers.push(Object.assign(base,{ type:'frame', x:el.x, y:el.y, w:el.w, h:el.h,
        imgUrl:el.imgUrl||'', imgVar:el.imgVar||'foto_produto', objectFit:'cover', frameShape:'rect' }));
    }else if(el.mode==='image'){
      layers.push(Object.assign(base,{ type:'image', x:el.x, y:el.y, w:el.w, h:el.h, imgUrl:el.imgUrl||'' }));
    }
  });
  if(!layers.length){ gToast('Nenhum elemento selecionado para importar'); return; }
  const folder=(typeof dFolders!=='undefined'&&dFolders)?dFolders[0]:null;
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
  gToast('✓ '+layers.length+' layer(s) importado(s) de '+(meta.fileName||'SVG'));
}
