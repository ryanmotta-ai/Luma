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
// Abre a "pasta" da campanha mostrando os materiais publicados
function fOpenMaterialCatalog(camp){
  fState.materialView=true;
  fState.material=null;
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
}
function fRenderMaterialCard(material, camp){
  const validade = material.publishMeta.validade;
  let validadeLabel='';
  if(validade){
    const v=new Date(validade+'T23:59:59');
    const diff=Math.ceil((v.getTime()-Date.now())/(24*60*60*1000));
    if(diff<=3) validadeLabel=`<span class="f-mat-urgency" style="display:inline-flex;align-items:center;gap:4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${diff}d restantes</span>`;
    else validadeLabel=`<span class="f-mat-validade">válido até ${new Date(validade).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}</span>`;
  }
  // Mini-prévia: usa fmt do template
  const fmtName = {story:'Story 9:16',feed:'Feed 1:1',wide:'Post wide',post:'Post wide'}[material.fmt] || 'Story';
  return `<div class="f-mat-card" onclick="fSelectMaterial('${material.id}')">
    <div class="f-mat-thumb f-mat-thumb-${material.fmt||'story'}" style="background:${camp.color}">
      <div class="f-mat-thumb-tag">${material.fmt==='feed'?'FEED':material.fmt==='wide'||material.fmt==='post'?'POST':'STORY'}</div>
      <div class="f-mat-thumb-prod">${gEsc(camp.previewProd||camp.name)}</div>
      ${camp.previewPor?`<div class="f-mat-thumb-por">${gEsc(camp.previewPor)}</div>`:''}
      <div class="f-mat-thumb-logo" role="img" aria-label="DM"></div>
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
    document.getElementById('f-messages').innerHTML='';
    fAddBot('Escolha uma campanha no painel à esquerda pra começar.',[]);

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
// Usuário clicou num material — entra no chat com perguntas geradas das variáveis do template
function fSelectMaterial(materialId){
  // Acha o material em qualquer pasta
  let found=null, folderFound=null;
  if(typeof dFolders !== 'undefined' && dFolders){
    for(const f of dFolders){
      const t=f.templates.find(x=>x.id===materialId);
      if(t){ found=t; folderFound=f; break; }
    }
  }
  if(!found){ gToast('Material não encontrado.'); return; }
  // Sincroniza formato com o do template (story/feed/wide → mapeia pra FMTS)
  const fmtMap = {story:'story', feed:'feed', wide:'post', post:'post'};
  const targetFmtId = fmtMap[found.fmt] || 'story';
  const targetFmt = FMTS.find(f=>f.id===targetFmtId);
  if(targetFmt) fState.fmt = targetFmt;
  fState.material=found;
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
