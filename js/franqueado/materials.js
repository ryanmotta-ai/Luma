/**
 * js/franqueado/materials.js
 *
 * Catalogo de materiais do franqueado: fOpenMaterialCatalog,
 * fRenderMaterialCatalog, fRenderMaterialCard, fCloseMaterialCatalog, fSelectMaterial.
 * Depende de: 00-config.js, 01-state.js, franqueado/chat.js
 */

function fGetMaterialsForCamp(campId){
  if(typeof dFolders === 'undefined' || !dFolders) return [];
  // Casa pela campId direta OU pelo nome da campanha como fallback
  const all=[...CAMPS_ATIVAS,...CAMPS_OUTRAS];
  const c=all.find(x=>x.id===campId);
  const folder = dFolders.find(f=>{
    if(f.campId===campId) return true;
    if(c && f.name===c.name) return true;
    return false;
  });
  if(!folder) return [];
  return folder.templates.filter(t=>t.publishMeta && t.publishMeta.publicado);
}
function fIsMaterialValid(material){
  if(!material.publishMeta || !material.publishMeta.validade) return true;
  const v=new Date(material.publishMeta.validade+'T23:59:59');
  return v.getTime() >= Date.now();
}

/* ── KIT DA CAMPANHA: preencher uma vez → gerar todos os materiais ──
   Reusa os dados já respondidos (fState.dados) e renderiza cada material publicado da
   campanha com o motor final, empacotando num ZIP. Pula materiais que não aproveitam
   nenhum dado preenchido (não gera arte vazia). Reusa fRenderMaterialToDataURL + JSZip. */
function _fKitBtnHtml(){
  try{
    const c=fState.camp; if(!c) return '';
    const mm=fGetMaterialsForCamp(c.id).filter(fIsMaterialValid);
    if(mm.length<2) return '';
    return `<button class="confirm-bulk" onclick="fGenerateCampaignKit()" title="Gerar todos os materiais desta campanha com os mesmos dados"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>Gerar kit da campanha (${mm.length})</button>`;
  }catch(e){ return ''; }
}
async function fGenerateCampaignKit(){
  const c=fState.camp; if(!c){ gToast('Selecione uma campanha primeiro'); return; }
  if(typeof JSZip==='undefined'){ gToast('Não consegui preparar o ZIP.','error'); return; }
  const mats=fGetMaterialsForCamp(c.id).filter(fIsMaterialValid);
  if(mats.length<2){ gToast('Esta campanha só tem um material.'); return; }
  const dados=fState.dados||{};
  const fmtMap={story:'story',feed:'feed',wide:'post',post:'post'};
  const zip=new JSZip();
  const prevMat=fState.material, prevFmt=fState.fmt;
  let ok=0, pulados=0;
  const usedNames=new Set();   // evita que 2 materiais de mesmo nome se sobrescrevam no ZIP
  const restoreBtn=(typeof gBtnLoading==='function') ? gBtnLoading(document.querySelector('[onclick="fGenerateCampaignKit()"]'),'Gerando…') : ()=>{};
  const progress=document.getElementById('f-kit-progress');
  const progressText=document.getElementById('f-kit-progress-text');
  const progressPct=document.getElementById('f-kit-progress-pct');
  const progressBar=document.getElementById('f-kit-progress-bar');
  const updateProgress=(done)=>{
    const pct=Math.round(done/mats.length*100);
    if(progressText) progressText.textContent=`Material ${done}/${mats.length}`;
    if(progressPct) progressPct.textContent=pct+'%';
    if(progressBar) progressBar.style.width=pct+'%';
  };
  if(progress){ progress.style.display='block'; updateProgress(0); }
  gToast('Gerando o kit da campanha…');
  for(let i=0;i<mats.length;i++){
    const m=mats[i];
    try{
      if(typeof fEnsureMaterialLayers==='function') await fEnsureMaterialLayers(m);
      if(!m.layers||!m.layers.length){ pulados++; continue; }
      // Pula material que não usa NENHUM dado já preenchido (sairia vazio → não vale a pena).
      const mvars=(typeof dExtractTemplateVars==='function')?dExtractTemplateVars(m.layers):[];
      if(mvars.length && !mvars.some(v=>dados[v]!=null && dados[v]!=='')){ pulados++; continue; }
      const fmt=FMTS.find(f=>f.id===(fmtMap[m.fmt]||m.fmt))||fState.fmt||FMTS[0];
      fState.material=m; fState.fmt=fmt;
      const dataUrl=await fRenderMaterialToDataURL(dados, c, fmt);
      const b64=dataUrl.split(',')[1];
      if(b64){
        let base=fSanitizeNamePart(m.name)||('Material_'+(ok+1)), name=base, n=2;
        while(usedNames.has(name.toLowerCase())){ name=base+'_'+(n++); } // nome único → nada some no ZIP
        usedNames.add(name.toLowerCase());
        zip.file(name+'.png', b64, {base64:true}); ok++;
      }
      else pulados++;
    }catch(e){ console.warn('[kit] material falhou:', e); pulados++; }
    finally{ updateProgress(i+1); }
  }
  fState.material=prevMat; fState.fmt=prevFmt;
  if(!ok){ restoreBtn(); if(progress) progress.style.display='none'; gToast('Não consegui gerar o kit — preencha ao menos um campo em comum aos materiais.','error'); return; }
  try{
    const blob=await zip.generateAsync({type:'blob'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='Kit_'+(fSanitizeNamePart(c.name)||'Campanha')+'.zip';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),5000);
  }catch(e){ console.error(e); restoreBtn(); if(progress) progress.style.display='none'; gToast('Erro ao gerar o ZIP do kit.','error'); return; }
  restoreBtn();
  if(progress) progress.style.display='none';
  gToast(`✓ Kit gerado: ${ok} materiais`+(pulados?` (${pulados} pulados — precisam de dados próprios)`:'')+'.');
  if(typeof fClearImgCache==='function') fClearImgCache();
}
// Abre a "pasta" da campanha mostrando os materiais publicados
function fOpenMaterialCatalog(camp){
  fState.materialView=true;
  fState.material=null;
  // Mobile: o catálogo de materiais vive no #fran-right (escondido por padrão no
  // celular). Sem trazer o painel pra frente, tocar numa campanha caía numa tela
  // vazia. O "voltar" (fCloseMaterialCatalog) remove a classe e devolve o catálogo.
  try{ document.body.classList.add('f-mobile-chat'); }catch(e){}
  const chatCol=document.getElementById('f-chat-col');
  let matView=document.getElementById('f-material-view');
  if(!matView){
    matView=document.createElement('div');
    matView.id='f-material-view';
    chatCol.parentNode.insertBefore(matView, chatCol);
  }
  
  chatCol.classList.add('fade-exit');
  
  setTimeout(() => {
    chatCol.style.display='none';
    chatCol.classList.remove('fade-exit');

    matView.style.display='flex';
    matView.classList.add('fade-enter');
    
    fRenderMaterialCatalog(camp, matView);

    matView.getBoundingClientRect(); // force reflow
    matView.classList.remove('fade-enter');
    matView.classList.add('fade-enter-active');

    setTimeout(() => {
      matView.classList.remove('fade-enter-active');
    }, 250);
  }, 200);
}
function fRenderMaterialCatalog(camp, container){
  const materials = fGetMaterialsForCamp(camp.id);
  const validMat = materials.filter(m=>fIsMaterialValid(m));
  const expired = materials.length - validMat.length;
  if(!validMat.length){
    container.innerHTML=`
      <div class="f-mat-head">
        <button class="f-mat-back" onclick="fCloseMaterialCatalog()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg></button>
        <div class="f-mat-head-title">
          <div class="f-mat-camp-name">${gEsc(camp.name)}</div>
          <div class="f-mat-camp-sub">Materiais disponíveis</div>
        </div>
      </div>
      <div class="f-mat-empty">
        <div class="f-mat-empty-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 2h14M5 22h14M19 2v6.34a2 2 0 0 1-.586 1.414L13.828 14.4a2 2 0 0 0 0 2.828l4.586 4.586a2 2 0 0 1 .586 1.414V22M5 2v6.34a2 2 0 0 0 .586 1.414L10.172 14.4a2 2 0 0 1 0 2.828l-4.586 4.586A2 2 0 0 0 5 23.23V22"/></svg></div>
        <div class="f-mat-empty-title">Nosso time está trabalhando!</div>
        <div class="f-mat-empty-text">${expired ? 'Os materiais desta campanha expiraram. ' : ''}Em breve haverá novos materiais disponíveis para <strong>${gEsc(camp.name)}</strong>. Volte em alguns instantes ou escolha outra campanha.</div>
      </div>`;
    if(typeof fMarkCampSeen==='function') fMarkCampSeen(camp.id);
    return;
  }
  container.innerHTML=`
    <div class="f-mat-head">
      <button class="f-mat-back" onclick="fCloseMaterialCatalog()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg></button>
      <div class="f-mat-head-title">
        <div class="f-mat-camp-name">${gEsc(camp.name)}</div>
        <div class="f-mat-camp-sub">${validMat.length} material${validMat.length>1?'is':''} disponível${validMat.length>1?'is':''}</div>
      </div>
    </div>
    <div class="f-mat-grid">
      ${validMat.map(m=>fRenderMaterialCard(m, camp)).join('')}
    </div>
    <div class="f-mat-foot">Selecione um material acima para começar a personalizar.</div>
  `;
  // Thumbs FIÉIS: renderiza a arte real de cada material (mesmo motor do PNG) por cima
  // do placeholder colorido — que permanece como fallback se o render falhar.
  if(typeof fRenderPreviewToCanvas==='function'){
    validMat.forEach(m=>{
      if(!(m.layers&&m.layers.length)) return;
      const cv=document.getElementById('f-mat-cv-'+m.id);
      if(cv) fRenderPreviewToCanvas(cv, m, {maxPx:520, camp:{color:camp.color||'#FF9000'}});
    });
  }
  // Só marca a campanha como "vista" DEPOIS de renderar os cards (fRenderMaterialCard lê o
  // seen anterior p/ decidir a tag "novo"); assim o badge some só na próxima abertura.
  if(typeof fMarkCampSeen==='function') fMarkCampSeen(camp.id);
}
function fRenderMaterialCard(material, camp){
  const validade = material.publishMeta.validade;
  let validadeLabel='';
  if(validade){
    const v=new Date(validade+'T23:59:59');
    const diff=Math.ceil((v.getTime()-Date.now())/(24*60*60*1000));
    if(diff<=3) validadeLabel=`<span class="f-mat-urgency" style="display:inline-flex;align-items:center;gap:4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${diff}d restantes</span>`;
    else validadeLabel=`<span class="f-mat-validade">válido até ${v.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}</span>`;
  }
  // Mini-prévia: usa fmt do template
  const fmtName = {story:'Story 9:16',feed:'Feed 1:1',wide:'Post wide',post:'Post wide'}[material.fmt] || 'Story';
  const isNew = (typeof fMaterialIsNew==='function') && fMaterialIsNew(material, camp.id);
  return `<div class="f-mat-card" onclick="fSelectMaterial('${material.id}')">
    <div class="f-mat-thumb f-mat-thumb-${material.fmt||'story'}" style="background:${camp.color}">
      ${isNew?`<div class="f-mat-new">novo</div>`:''}
      <div class="f-mat-thumb-prod">${gEsc(camp.previewProd||camp.name)}</div>
      ${camp.previewPor?`<div class="f-mat-thumb-por">${gEsc(camp.previewPor)}</div>`:''}
      <div class="f-mat-thumb-logo" role="img" aria-label="DM"></div>
      <canvas class="f-mat-cv" id="f-mat-cv-${material.id}" aria-hidden="true"></canvas>
      <div class="f-mat-thumb-tag">${material.fmt==='feed'?'FEED':material.fmt==='wide'||material.fmt==='post'?'POST':'STORY'}</div>
    </div>
    <div class="f-mat-info">
      <div class="f-mat-name">${gEsc(material.name)}</div>
      <div class="f-mat-meta">
        <span class="f-mat-fmt">${fmtName}</span>
        ${validadeLabel}
      </div>
    </div>
  </div>`;
}
function fCloseMaterialCatalog(){
  fState.materialView=false;
  fState.camp={id:'',name:'',color:'#FF9000',perguntas:[]};
  const chatCol=document.getElementById('f-chat-col');
  const matView=document.getElementById('f-material-view');
  if(matView) {
    matView.classList.add('fade-exit');
  }

  setTimeout(() => {
    if(matView) {
      matView.style.display='none';
      matView.classList.remove('fade-exit');
    }

    chatCol.style.display='';
    chatCol.classList.add('fade-enter');

    fRestoreCatalog();
    fUpdateCtx();
    // Voltar dos materiais → HOME (vitrine). O chat por trás fica no estado
    // de boas-vindas (fallback caso o modo home seja desligado).
    if(typeof fShowWelcome==='function') fShowWelcome();
    else { document.getElementById('f-messages').innerHTML=''; fAddBot('Escolha uma campanha no painel à esquerda pra começar.',[]); }
    if(typeof fGoHome==='function') fGoHome();

    chatCol.getBoundingClientRect(); // force reflow
    chatCol.classList.remove('fade-enter');
    chatCol.classList.add('fade-enter-active');

    setTimeout(() => {
      chatCol.classList.remove('fade-enter-active');
    }, 250);
  }, 200);
}
// Conjunto de variáveis usadas como IMAGEM num template (layers frame/image com imgVar).
// Helper único usado por fSelectMaterial e fEditFromHist para detecção consistente (M14).
function fMaterialImageVars(layers){
  const set=new Set();
  (layers||[]).forEach(l=>{ if(l.imgVar && (l.type==='frame'||l.type==='image')) set.add(l.imgVar); });
  return set;
}
// Garante as layers de um template sincronizado do backend (o sync de pastas não traz
// layers — lazy). O designer já faz isso em dLoadTemplate; sem o mesmo fetch AQUI,
// cross-device o chat nascia sem perguntas e a prévia mostrava um snapshot velho/vazio.
// Dedup: fetches concorrentes do mesmo template compartilham a mesma Promise
// (fila de thumbs da home + clique do usuário não baixam o mesmo JSON duas vezes).
const _fLayersFetch={}; // remoteId → Promise em andamento
async function fEnsureMaterialLayers(t){
  if(!t || !t._needsLayersFetch || !t.remoteId) return t;
  const sb=(typeof gSupabase==='function')?gSupabase():window.sb;
  if(!sb) return t;
  if(!_fLayersFetch[t.remoteId]){
    _fLayersFetch[t.remoteId]=(async()=>{
      try{
        const {data}=await sb.schema('luma').from('templates').select('layers').eq('id',t.remoteId).single();
        if(data){ t.layers=Array.isArray(data.layers)?data.layers:[]; t._needsLayersFetch=false; }
      }catch(e){ console.warn('[material] fetch de layers falhou:', e); }
      finally{ delete _fLayersFetch[t.remoteId]; }
    })();
  }
  await _fLayersFetch[t.remoteId];
  return t;
}
// Usuário clicou num material — entra no chat com perguntas geradas das variáveis do template
async function fSelectMaterial(materialId){
  // Acha o material em qualquer pasta
  let found=null, folderFound=null;
  if(typeof dFolders !== 'undefined' && dFolders){
    for(const f of dFolders){
      const t=f.templates.find(x=>x.id===materialId);
      if(t){ found=t; folderFound=f; break; }
    }
  }
  if(!found){ gToast('Material não encontrado.'); return; }
  // Catálogo leve: baixa os layers deste template agora (1ª vez neste aparelho)
  await fEnsureMaterialLayers(found);
  if(found._needsLayersFetch){ // fetch falhou (sem rede?) — não entra no chat com material vazio
    gToast('Não consegui carregar este material. Verifique sua conexão e tente de novo.','error');
    return;
  }
  // Sincroniza formato com o do template (story/feed/wide → mapeia pra FMTS)
  const fmtMap = {story:'story', feed:'feed', wide:'post', post:'post'};
  const targetFmtId = fmtMap[found.fmt] || 'story';
  const targetFmt = FMTS.find(f=>f.id===targetFmtId);
  if(targetFmt) fState.fmt = targetFmt;
  fState.material=found;
  if (typeof gTriggerOnboardingStep === 'function') {
    gTriggerOnboardingStep('choseMaterial');
  }
  fState.materialView=false;
  // Constrói perguntas a partir das variáveis do template + permissões definidas pelo designer
  const vars = dExtractTemplateVars(found.layers);
  // V7: respeita a ordem do catálogo dVars (designer reordena → muda a ordem das perguntas).
  // Vars sem entrada no catálogo vão para o fim, preservando a ordem original.
  if(typeof dVars!=='undefined' && dVars && dVars.length){
    const ord=n=>{const i=dVars.findIndex(v=>v.name===n);return i<0?Infinity:i;};
    vars.sort((a,b)=>{const da=ord(a),db=ord(b);return da===db?0:da-db;});
  }
  const permissoes = found.publishMeta?.permissoes || {};
  // Detecção robusta de variáveis tipo imagem: usa dVars OU verifica se a var é usada em layer frame/image
  const imageVarsByLayer = fMaterialImageVars(found.layers);
  const perguntas=[];
  vars.forEach(v=>{
    const perm = permissoes[v];
    // Se editável foi marcado como false, pula
    if(perm && perm.edit === false) return;
    const vDef = (typeof dVars !== 'undefined' && dVars) ? dVars.find(x=>x.name===v) : null;
    const label = vDef ? vDef.label : v.replace(/_/g,' ');
    const isImage = (vDef ? vDef.type==='image' : false) || imageVarsByLayer.has(v);
    if(isImage){
      // Pergunta especial de upload de imagem
      perguntas.push({
        id: v,
        texto: `Envie a <strong>${gEsc(label.toLowerCase())}</strong>`,
        sugestoes: [],
        isImage: true,
        label: label,
        maxLen: 0
      });
    } else {
      // Tipos ricos (4.1): select/boolean/color viram Quick Replies prontas
      let sugestoes;
      if(vDef && vDef.type==='select' && vDef.options && vDef.options.length) sugestoes=vDef.options.slice();
      else if(vDef && vDef.type==='boolean') sugestoes=['Sim','Não'];
      else if(vDef && vDef.type==='color' && vDef.palette && vDef.palette.length) sugestoes=vDef.palette.slice();
      else sugestoes=fGetSuggestionsForVar(v, fState.camp);
      perguntas.push({
        id: v,
        texto: `Qual é o <strong>${gEsc(label.toLowerCase())}</strong> que você quer usar?`,
        sugestoes,
        maxLen: perm?.maxLen || 32,
        label: label
      });
    }
  });
  // Se o template não tem nenhuma variável editável, mostra direto a confirmação
  if(!perguntas.length){
    perguntas.push({id:'_dummy', texto:'Este material não tem campos editáveis. Posso gerar do jeito que está?', sugestoes:['Sim, gerar agora'], maxLen:60, label:'confirmar'});
  }
  // Aplica perguntas customizadas à campanha atual
  fState.camp = {...fState.camp, perguntas, materialName: found.name};
  // Switch para a view de chat
  const chatCol=document.getElementById('f-chat-col');
  const matView=document.getElementById('f-material-view');
  if(matView) matView.style.display='none';
  chatCol.style.display='';
  fUpdateCtx();
  // Limpa estado anterior
  fState.dados={};
  fState.done=false;
  fState.stepIdx=-1;
  // Inicia chat com mensagem específica deste material
  fStartChatComMaterial(found);
}
