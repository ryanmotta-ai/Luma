/**
 * js/designer/publish.js
 *
 * Modal de publicacao de templates (4 abas): dPublishOpen, dPublishClose,
 * dPublishSwitchTab, dPublishRender, dPublishConfirm.
 * Depende de: designer/templates.js
 */

/* ══ ESTADO DA PUBLICAÇÃO ══ */
let dPubSelectedABs = new Set();   // IDs das pranchetas selecionadas
let dPubPermissoes  = {};          // permissões compartilhadas
let dPubObservers   = [];          // cleanup de observers
let dPrevToolForSpace = null;      // ferramenta anterior ao pressionar Espaço
let dPubWizardStep = 0;
let dPubLinterStats = { errorsCount:0, warningsCount:0, infosCount:0 };
let dPubLastTrigger = null;
let dPubDraftTimer = null;
let dPubPublished = false;

const D_PUB_STEPS=[
  {label:'Qualidade', panels:['linter','artboards']},
  {label:'Configuração', panels:['pasta','validade','permissoes','instrucoes']},
  {label:'Revisão', panels:['review']},
];

function dPublishDraftKey(){
  const ab=(typeof dGetActiveAB==='function')?dGetActiveAB():null;
  const id=(typeof dActiveTmplId!=='undefined'&&dActiveTmplId)||((ab&&ab.id)?ab.id+':'+(ab.name||'material'):'novo');
  return '_luma_publish_draft:'+id;
}

function dPublishCollectDraft(){
  const names={};
  dPubSelectedABs.forEach(id=>{
    const input=document.getElementById('pub-ab-name-'+id);
    if(input)names[id]=input.value;
  });
  return {
    folderId:document.getElementById('pub-folder')?.value||'',
    validade:document.getElementById('pub-validade')?.value||'',
    instrucoes:document.getElementById('pub-instrucoes')?.value||'',
    permissoes:JSON.parse(JSON.stringify(dPubPermissoes)),
    selected:[...dPubSelectedABs],names,step:dPubWizardStep,savedAt:Date.now()
  };
}

function dPublishPersistDraft(showFeedback){
  try{
    localStorage.setItem(dPublishDraftKey(),JSON.stringify(dPublishCollectDraft()));
    const status=document.getElementById('pub-draft-status');
    if(status)status.textContent='Rascunho salvo agora';
    if(showFeedback)gToast('Rascunho da publicação salvo');
    return true;
  }catch(e){
    if(showFeedback)gToast('Não foi possível salvar o rascunho da publicação','error');
    return false;
  }
}

function dPublishQueueDraft(){
  if(dPubPublished)return;
  clearTimeout(dPubDraftTimer);
  dPubDraftTimer=setTimeout(()=>dPublishPersistDraft(false),300);
  const status=document.getElementById('pub-draft-status');
  if(status)status.textContent='Salvando rascunho…';
}

function dPublishLoadDraft(){
  let draft=null;
  try{draft=JSON.parse(localStorage.getItem(dPublishDraftKey())||'null');}catch(e){}
  if(!draft)return;
  const folder=document.getElementById('pub-folder');
  if(folder&&draft.folderId&&[...folder.options].some(o=>o.value===draft.folderId))folder.value=draft.folderId;
  const validade=document.getElementById('pub-validade');
  const instrucoes=document.getElementById('pub-instrucoes');
  if(validade&&typeof draft.validade==='string')validade.value=draft.validade;
  if(instrucoes&&typeof draft.instrucoes==='string')instrucoes.value=draft.instrucoes;
  if(draft.permissoes&&typeof draft.permissoes==='object')dPubPermissoes=JSON.parse(JSON.stringify(draft.permissoes));
  if(Array.isArray(draft.selected)){
    const validIds=new Set((typeof dArtboards!=='undefined'&&dArtboards?dArtboards:[]).map(ab=>ab.id));
    const restored=draft.selected.filter(id=>validIds.has(id));
    if(restored.length)dPubSelectedABs=new Set(restored);
  }
  dPublishRenderArtboards();
  dPublishRenderPerms();
  Object.entries(draft.names||{}).forEach(([id,name])=>{
    const input=document.getElementById('pub-ab-name-'+id);
    if(input)input.value=name;
  });
  const status=document.getElementById('pub-draft-status');
  if(status)status.textContent='Rascunho recuperado';
}

function dPublishClearDraft(key){
  clearTimeout(dPubDraftTimer);
  try{localStorage.removeItem(key||dPublishDraftKey());}catch(e){}
}

function dPublishSaveDraft(){
  const saved=dPublishPersistDraft(false);
  if(typeof dSave==='function')dSave();
  else if(saved)gToast('Rascunho da publicação salvo');
}

function dGetActiveTemplate(){
  for(const f of dFolders){
    const t=f.templates.find(x=>x.id===dActiveTmplId);
    if(t) return {template:t, folder:f};
  }
  return null;
}

function dPublishSetupWizard(){
  const modal=document.getElementById('d-publish-modal');
  const box=modal?.querySelector('.pub-box');
  const body=modal?.querySelector('.pub-body');
  const tabsWrap=modal?.querySelector('.pub-tabs');
  const tabs=modal?.querySelectorAll('.pub-tab');
  if(!modal||!box||!body||!tabs?.length)return;

  modal.setAttribute('role','dialog');
  modal.setAttribute('aria-modal','true');
  modal.setAttribute('aria-labelledby','d-publish-title');
  tabsWrap?.setAttribute('aria-label','Etapas da publicação');
  box.classList.remove('pub-success-mode');
  modal.querySelector('#pub-success-panel')?.remove();
  const title=modal.querySelector('.pub-head-title span');
  if(title){title.id='d-publish-title';title.tabIndex=-1;title.textContent='Publicar template';}

  const icons=[
    '<path d="m9 11 2 2 4-4"/><circle cx="12" cy="12" r="9"/>',
    '<path d="M4 6h16M4 12h16M4 18h10"/>',
    '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>'
  ];
  tabs.forEach((tab,index)=>{
    if(index<3){
      tab.hidden=false;
      tab.removeAttribute('style');
      tab.removeAttribute('role');
      tab.setAttribute('onclick',`dPublishGoStep(${index})`);
      tab.innerHTML=`<span class="pub-step-num">${index+1}</span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[index]}</svg><span>${D_PUB_STEPS[index].label}</span>`;
    }else tab.hidden=true;
  });

  if(!document.getElementById('pub-panel-review')){
    const review=document.createElement('div');
    review.id='pub-panel-review';
    review.className='pub-panel';
    body.appendChild(review);
  }
  if(!document.getElementById('pub-wizard-error')){
    const error=document.createElement('div');
    error.id='pub-wizard-error';
    error.className='pub-wizard-error';
    error.setAttribute('role','alert');
    error.hidden=true;
    body.prepend(error);
  }

  const sections={
    artboards:['Material','Escolha o que será publicado e confirme o nome exibido no catálogo.'],
    pasta:['Destino','Defina em qual campanha o material ficará disponível.'],
    validade:['Disponibilidade','Escolha por quanto tempo o material poderá ser usado.'],
    permissoes:['Campos editáveis','Controle o que o franqueado pode alterar sem sair da marca.'],
    instrucoes:['Orientação','Explique quando e como este material deve ser usado.']
  };
  Object.entries(sections).forEach(([id,copy])=>{
    const panel=document.getElementById('pub-panel-'+id);
    if(panel&&!panel.querySelector('.pub-wizard-section-head')){
      panel.insertAdjacentHTML('afterbegin',`<div class="pub-wizard-section-head"><span>${copy[0]}</span><p>${copy[1]}</p></div>`);
    }
  });

  const foot=modal.querySelector('.pub-foot');
  const cancel=foot?.querySelector('.pub-btn-cancel');
  const primary=foot?.querySelector('.pub-btn-confirm');
  if(foot&&!document.getElementById('pub-save-draft')){
    const draft=document.createElement('button');
    draft.id='pub-save-draft';
    draft.type='button';
    draft.className='pub-btn pub-btn-draft';
    draft.setAttribute('onclick','dPublishSaveDraft()');
    draft.innerHTML='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg><span>Salvar rascunho</span>';
    foot.insertBefore(draft,cancel);
    const status=document.createElement('span');
    status.id='pub-draft-status';
    status.className='pub-draft-status';
    status.setAttribute('aria-live','polite');
    foot.insertBefore(status,draft);
  }
  if(cancel){cancel.hidden=false;cancel.setAttribute('onclick','dPublishSecondaryAction()');}
  if(primary){primary.disabled=false;primary.classList.remove('loading');primary.setAttribute('onclick','dPublishPrimaryAction()');}

  if(!modal._pubDraftBound){
    const queue=e=>{if(e.target.matches('input,select,textarea'))dPublishQueueDraft();};
    modal.addEventListener('input',queue);
    modal.addEventListener('change',queue);
    modal._pubDraftBound=true;
  }
  dPublishLoadDraft();
  dPublishShowStep(0,true);
  setTimeout(()=>title?.focus(),0);
}

function dPublishShowError(message,step,focusEl){
  if(Number.isInteger(step)&&step!==dPubWizardStep)dPublishShowStep(step,true);
  const error=document.getElementById('pub-wizard-error');
  if(error){
    error.hidden=false;
    error.innerHTML='<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 17h.01"/></svg><span>'+gEsc(message)+'</span>';
  }
  if(focusEl)setTimeout(()=>focusEl.focus(),0);
  return false;
}

function dPublishClearError(){
  const error=document.getElementById('pub-wizard-error');
  if(error){error.hidden=true;error.textContent='';}
  document.querySelectorAll('#d-publish-modal .is-invalid').forEach(el=>el.classList.remove('is-invalid'));
}

function dPublishValidateStep(step){
  dPublishClearError();
  if(step===0){
    if(dPubLinterStats.errorsCount>0)return dPublishShowError('Corrija os erros críticos do checklist antes de continuar.',0,document.getElementById('d-pub-linter-issues'));
    if(!dPubSelectedABs.size)return dPublishShowError('Selecione pelo menos um material para publicar.',0,document.getElementById('pub-ab-grid'));
    for(const id of dPubSelectedABs){
      const input=document.getElementById('pub-ab-name-'+id);
      if(!input?.value.trim()){
        input?.classList.add('is-invalid');
        return dPublishShowError('Dê um nome ao material antes de continuar.',0,input);
      }
    }
  }
  if(step===1){
    const folder=document.getElementById('pub-folder');
    if(!folder?.value){folder?.classList.add('is-invalid');return dPublishShowError('Selecione a campanha de destino.',1,folder);}
    const validade=document.getElementById('pub-validade');
    const today=new Date();
    const localToday=new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10);
    if(validade?.value&&validade.value<localToday){
      validade.classList.add('is-invalid');
      return dPublishShowError('A validade não pode estar no passado.',1,validade);
    }
    for(const [name,perm] of Object.entries(dPubPermissoes)){
      if(perm.edit&&perm.maxLen!==0&&(!Number.isFinite(Number(perm.maxLen))||Number(perm.maxLen)<1||Number(perm.maxLen)>200)){
        const input=[...document.querySelectorAll('.pub-perm-len input')].find(el=>el.closest('.pub-perm-row')?.querySelector('.pub-perm-key')?.textContent.includes(name));
        input?.classList.add('is-invalid');
        return dPublishShowError('Use limites entre 1 e 200 caracteres.',1,input);
      }
    }
  }
  return true;
}

function dPublishGoStep(index,force){
  index=Math.max(0,Math.min(D_PUB_STEPS.length-1,Number(index)||0));
  if(!force&&index>dPubWizardStep){
    for(let step=dPubWizardStep;step<index;step++)if(!dPublishValidateStep(step))return;
  }
  dPublishShowStep(index,false);
}

function dPublishShowStep(index,skipDraft){
  dPubWizardStep=index;
  document.querySelectorAll('#d-publish-modal .pub-panel').forEach(panel=>panel.classList.remove('active'));
  D_PUB_STEPS[index].panels.forEach(id=>document.getElementById('pub-panel-'+id)?.classList.add('active'));
  document.querySelectorAll('#d-publish-modal .pub-tab').forEach((tab,i)=>{
    if(i>2)return;
    tab.classList.toggle('active',i===index);
    tab.classList.toggle('complete',i<index);
    if(i===index)tab.setAttribute('aria-current','step');
    else tab.removeAttribute('aria-current');
    tab.tabIndex=i===index?0:-1;
  });
  if(index===2)dPublishRenderReview();
  dPublishUpdateFooter();
  dPublishClearError();
  if(!skipDraft)dPublishQueueDraft();
  const active=document.querySelectorAll('#d-publish-modal .pub-tab')[index];
  setTimeout(()=>active?.focus(),0);
}

function dPublishUpdateFooter(){
  const modal=document.getElementById('d-publish-modal');
  const cancel=modal?.querySelector('.pub-btn-cancel');
  const primary=modal?.querySelector('.pub-btn-confirm');
  const draft=document.getElementById('pub-save-draft');
  if(cancel)cancel.textContent=dPubWizardStep===0?'Fechar':'Voltar';
  if(draft)draft.hidden=false;
  if(primary){
    primary.disabled=dPubWizardStep===0&&dPubLinterStats.errorsCount>0;
    primary.innerHTML=dPubWizardStep===2
      ?'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/></svg><span>Publicar material</span>'
      :'<span>Continuar</span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
  }
}

function dPublishSecondaryAction(){
  if(dPubWizardStep>0)dPublishGoStep(dPubWizardStep-1,true);
  else dPublishClose();
}

function dPublishPrimaryAction(){
  if(dPubWizardStep<2){dPublishGoStep(dPubWizardStep+1);return;}
  dPublishRequestConfirm();
}

function dPublishRenderReview(){
  const panel=document.getElementById('pub-panel-review');if(!panel)return;
  const ab=(typeof dArtboards!=='undefined'&&dArtboards)?dArtboards.find(item=>dPubSelectedABs.has(item.id)):null;
  const folder=document.getElementById('pub-folder');
  const folderName=folder?.selectedOptions?.[0]?.textContent||'Campanha não definida';
  const nameInput=ab?document.getElementById('pub-ab-name-'+ab.id):null;
  const name=(nameInput?.value||ab?.name||'Material').trim();
  const validade=document.getElementById('pub-validade')?.value;
  const instrucoes=document.getElementById('pub-instrucoes')?.value.trim();
  const editable=Object.values(dPubPermissoes).filter(p=>p.edit).length;
  const total=Object.keys(dPubPermissoes).length;
  panel.innerHTML=`<div class="pub-review-grid">
    <section class="pub-review-preview" aria-labelledby="pub-review-preview-title">
      <div class="pub-wizard-section-head"><span id="pub-review-preview-title">Pré-visualização</span><p>Esta é a versão que ficará disponível para o franqueado.</p></div>
      <div class="pub-review-canvas-wrap"><canvas id="pub-review-canvas"></canvas></div>
      <div class="pub-review-dim">${ab?`${ab.w} × ${ab.h} · ${(ab.fmt||'custom').toUpperCase()}`:'Material indisponível'}</div>
    </section>
    <section class="pub-review-summary" aria-labelledby="pub-review-summary-title">
      <div class="pub-wizard-section-head"><span id="pub-review-summary-title">Resumo da publicação</span><p>Confira os detalhes antes de disponibilizar.</p></div>
      <dl class="pub-review-list">
        <div><dt>Material</dt><dd>${gEsc(name)}</dd></div>
        <div><dt>Campanha</dt><dd>${gEsc(folderName)}</dd></div>
        <div><dt>Validade</dt><dd>${validade?gEsc(validade.split('-').reverse().join('/')):'Sem data de expiração'}</dd></div>
        <div><dt>Campos editáveis</dt><dd>${editable} de ${total}</dd></div>
        <div><dt>Instruções</dt><dd>${instrucoes?gEsc(instrucoes):'Nenhuma instrução adicional'}</dd></div>
      </dl>
      <div class="pub-review-notice"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg><span>Ao publicar, este material ficará visível no catálogo enquanto estiver dentro da validade.</span></div>
    </section>
  </div>`;
  setTimeout(()=>{
    const canvas=document.getElementById('pub-review-canvas');
    if(canvas&&ab&&typeof fRenderPreviewToCanvas==='function')fRenderPreviewToCanvas(canvas,ab,{maxPx:900});
  },0);
}

async function dPublishRequestConfirm(){
  if(!dPublishValidateStep(0)||!dPublishValidateStep(1))return;
  const info=_dPubFindTmpl();
  const republish=!!(info?.tmpl?.publishMeta?.publicado);
  const ok=typeof gConfirm==='function'
    ?await gConfirm(republish?'Publicar esta revisão e substituir a versão disponível no catálogo?':'Disponibilizar este material no catálogo do franqueado?',{title:republish?'Confirmar republicação':'Confirmar publicação',okLabel:republish?'Republicar':'Publicar',cancelLabel:'Revisar'})
    :true;
  if(ok)dPublishConfirm();
}

function dPublishFocusable(){
  const modal=document.getElementById('d-publish-modal');
  if(!modal)return[];
  return [...modal.querySelectorAll('button:not([disabled]):not([hidden]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el=>el.offsetParent!==null);
}

document.addEventListener('keydown',e=>{
  const modal=document.getElementById('d-publish-modal');
  if(!modal?.classList.contains('open'))return;
  // O dialogo de confirmacao tem seu proprio ciclo de teclado e foco.
  if(document.querySelector('.g-dialog-ov'))return;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();dPublishClose();return;}
  if(e.key!=='Tab')return;
  const focusable=dPublishFocusable();if(!focusable.length)return;
  const first=focusable[0],last=focusable[focusable.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
},true);

/* ── PAINEL PUBLICAR (sidebar) — resumo + gatilho do modal completo (fluxo híbrido) ── */
function dPublishPanelRender(){
  const el=document.getElementById('d-pub-panel-summary'); if(!el)return;
  const nAb=(typeof dLayers!=='undefined'&&dLayers&&dLayers.length)?1:0;
  const nVars=(typeof dVars!=='undefined'&&dVars)?dVars.length:0;
  if(!nAb){ el.innerHTML='<div style="font-size:11.5px;color:var(--d-text3)">Adicione camadas para publicar.</div>'; return; }
  const meta=(typeof dDefaultPublishMeta==='function')?dDefaultPublishMeta():{};
  const val=meta&&meta.validade?('até '+meta.validade):'sem validade definida';
  const row=(k,v)=>`<div style="display:flex;justify-content:space-between;gap:8px;font-size:11.5px;padding:5px 0;border-bottom:1px solid var(--d-border)"><span style="color:var(--d-text3)">${k}</span><span style="color:var(--d-text);font-weight:600;text-align:right">${v}</span></div>`;
  el.innerHTML = row('Pranchetas', nAb) + row('Variáveis', nVars) + row('Validade padrão', val);
}

/* ── ABRIR MODAL ── */
/* ── M2.0 — TOPBAR DROPDOWN MENU ── */
function dToggleMainMenu(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  const menu = document.getElementById('dt-main-menu');
  if (menu) {
    menu.style.display = (menu.style.display === 'none' || menu.style.display === '') ? 'flex' : 'none';
  }
}
document.addEventListener('click', (e) => {
  const menu = document.getElementById('dt-main-menu');
  const btn = document.getElementById('dt-main-menu-btn');
  if (menu && btn && e.target !== btn && !btn.contains(e.target) && e.target !== menu && !menu.contains(e.target)) {
    menu.style.display = 'none';
  }
});

// Template-alvo da publicação da arte atual: o template CARREGADO (dActiveTmplId),
// com fallback pro id legado 'tmpl-ab-'+abId (artes publicadas antes do fix de
// colisão — abId é sempre 'ab-single', então aquele id era compartilhado por tudo).
function _dPubFindTmpl(){
  const ids=[];
  if(typeof dActiveTmplId!=='undefined'&&dActiveTmplId) ids.push(dActiveTmplId);
  const _ab=(typeof dGetActiveAB==='function')?dGetActiveAB():null;
  if(_ab) ids.push('tmpl-ab-'+_ab.id);
  for(const id of ids){
    for(const f of dFolders){ const t=f.templates.find(x=>x.id===id); if(t) return {tmpl:t, folder:f}; }
  }
  return null;
}

function dPublishOpen(){
  if(typeof gFeatureCan==='function' && !gFeatureCan('designer.publish','execute')){
    if(typeof gFeatureBlockedFeedback==='function') gFeatureBlockedFeedback('designer.publish');
    return;
  }
  if(typeof dSyncLayersToAB==='function') dSyncLayersToAB();
  const _ab=dGetActiveAB();
  if(!dLayers||!dLayers.length){gToast('Adicione camadas antes de publicar.');return;}
  dPubLastTrigger=document.activeElement instanceof HTMLElement?document.activeElement:null;
  dPubPublished=false;
  dPubWizardStep=0;
  dPubSelectedABs=new Set([_ab.id]);
  dPubPermissoes={};
  dPublishRender();
  document.getElementById('d-publish-modal').classList.add('open');
  dPublishSetupWizard();
}
function dPublishClose(){
  const modal = document.getElementById('d-publish-modal');
  if (modal) {
    modal.classList.remove('open');
    dPubHidePreview();
    const trigger=dPubLastTrigger;
    setTimeout(()=>{if(trigger&&document.contains(trigger))trigger.focus();},0);
  }
}
function dPublishSwitchTab(tab, btn){
  if(document.getElementById('pub-panel-review')){
    const oldMap={linter:0,artboards:0,pasta:1,validade:1,permissoes:1,instrucoes:1,review:2};
    if(Object.prototype.hasOwnProperty.call(oldMap,tab)){dPublishGoStep(oldMap[tab],true);return;}
  }
  document.querySelectorAll('.pub-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.pub-panel').forEach(p=>p.classList.remove('active'));
  const targetBtn = btn || document.querySelector(`.pub-tab[onclick*="'${tab}'"]`);
  if(targetBtn) targetBtn.classList.add('active');
  const panel = document.getElementById('pub-panel-'+tab);
  if(panel) panel.classList.add('active');
}

/* ── RENDER DO MODAL ── */
function dPublishRender(){
  dPublishRenderArtboards();

  // REPUBLICAÇÃO: pré-carrega a configuração já salva do template (permissões,
  // validade, instruções, pasta) — antes, republicar resetava tudo pro default
  // silenciosamente (permissão travada voltava a editável, instruções sumiam).
  const _t=_dPubFindTmpl();
  const _meta=(_t&&_t.tmpl.publishMeta)||null;
  if(_meta&&_meta.permissoes) dPubPermissoes=JSON.parse(JSON.stringify(_meta.permissoes));

  // Aba Pasta & Nome
  const folderSel=document.getElementById('pub-folder');
  folderSel.innerHTML=dFolders.map(f=>`<option value="${gEsc(f.id)}">${gEsc(f.name)}</option>`).join('');
  if(_t&&_t.folder) folderSel.value=_t.folder.id;
  const fmtEl=document.getElementById('pub-fmt-display');
  if(fmtEl) fmtEl.textContent=(dFmt||'custom').toUpperCase();

  // Aba Validade
  const meta=dDefaultPublishMeta();
  document.getElementById('pub-validade').value=(_meta&&_meta.validade)||meta.validade||'';

  // Aba Permissões (variáveis de TODAS as pranchetas selecionadas)
  dPublishRenderPerms();

  // Aba Instruções
  document.getElementById('pub-instrucoes').value=(_meta&&_meta.instrucoes)||'';

  // Estado
  const stateEl=document.getElementById('pub-current-state');
  const anyPublished=!!(_meta&&_meta.publicado);
  stateEl.innerHTML=anyPublished
    ?`<span class="pub-pill pub-pill-on"><span class="pub-status-dot"></span>Publicado anteriormente</span>`
    :`<span class="pub-pill pub-pill-off"><span class="pub-status-dot"></span>Rascunho</span>`;

  // Executa o linter na aba checklist de publicação
  let linterStats = { errorsCount: 0, warningsCount: 0, infosCount: 0 };
  if (typeof dRunLinter === 'function') {
    const issuesContainer = document.getElementById('d-pub-linter-issues');
    if (issuesContainer) {
      // Temporariamente redireciona d-linter-issues para d-pub-linter-issues
      const tempDiv = document.createElement('div');
      tempDiv.id = 'd-linter-issues';
      issuesContainer.parentNode.replaceChild(tempDiv, issuesContainer);
      
      dRunLinter();
      
      // Restaura a ID correta
      tempDiv.id = 'd-pub-linter-issues';
      
      // Coleta as contagens da prancheta
      const ab = (typeof dGetActiveAB === 'function') ? dGetActiveAB() : null;
      const isStory = ab ? (ab.w === 1080 && ab.h === 1920) : (dFmt === 'story');
      
      dLayers.forEach(l => {
        if (!l.visible) return;
        const hasPrecoDe = l.id === 'precoDe' || (l.content && l.content.includes('{{precoDe}}'));
        if (hasPrecoDe) {
          const hasCondition = dLayers.some(other => 
            other.rules && other.rules.some(r => r && r.var === 'precoDe' && r.when === 'empty' && r.then === 'hide')
          );
          if (!hasCondition) linterStats.errorsCount++;
        }
        if (l.type === 'text' && l.content) {
          const currencyMatches = l.content.matchAll(/R\$\s*\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g);
          for (const m of currencyMatches) {
            const varName = m[1];
            const v = dVars.find(x => x.name === varName);
            if (v && (v.type === 'currency' || v.type === 'number')) linterStats.errorsCount++;
          }
        }
        if (isStory && l.type !== 'group' && l.name.toLowerCase() !== 'background' && l.name.toLowerCase() !== 'bg') {
          const isCriticalElement = l.type === 'text' || l.id === 'logo' || l.name.toLowerCase().includes('logo') || l.name.toLowerCase().includes('marca');
          if (isCriticalElement) {
            if (l.y < 250) linterStats.warningsCount++;
            if ((l.y + l.h) > 1920 - 250) linterStats.warningsCount++;
          }
        }
        if (l.type === 'text' && l.textBox === 'box') {
          const boundField = dLayerBoundField(l);
          const v = boundField ? dVars.find(x => x.name === boundField) : null;
          if (v) {
            const isCriticalField = ['produto', 'categoria', 'oferta', 'brinde', 'validade'].some(c => v.name.toLowerCase().includes(c));
            const recommendedLimit = gCalculateRecommendedCharLimit(l);
            if (isCriticalField && recommendedLimit < 35) linterStats.warningsCount++;
          }
        }
      });
    }
  }

  dPubLinterStats=linterStats;

  // Atualiza o resumo no rodapé da aba Checklist
  const summaryEl = document.getElementById('d-pub-linter-summary');
  if (summaryEl) {
    if (linterStats.errorsCount > 0) {
      summaryEl.className='pub-linter-summary error';
      summaryEl.innerHTML = `<span class="pub-linter-main"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 17h.01"/></svg>${linterStats.errorsCount} erro(s) crítico(s)</span><span>Corrija os itens listados para continuar.</span>`;
    } else if (linterStats.warningsCount > 0) {
      summaryEl.className='pub-linter-summary warning';
      summaryEl.innerHTML = `<span class="pub-linter-main"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v4M12 17h.01"/></svg>${linterStats.warningsCount} alerta(s)</span><span>Você pode continuar, mas vale revisar o respiro e a área segura.</span>`;
    } else {
      summaryEl.className='pub-linter-summary success';
      summaryEl.innerHTML = `<span class="pub-linter-main"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></svg>Pronto para continuar</span><span>Nenhuma inconformidade crítica foi encontrada.</span>`;
    }
  }

  // Desabilita/Habilita botão de publicação final
  const confirmBtn = document.querySelector('.pub-btn-confirm');
  if (confirmBtn) {
    if (linterStats.errorsCount > 0) {
      confirmBtn.disabled = true;
      confirmBtn.title = 'Corrija os erros críticos no Checklist para liberar a publicação.';
    } else {
      confirmBtn.disabled = false;
      confirmBtn.title = '';
    }
  }
}

/* ── GRID DE PRANCHETAS ── */
function dPublishRenderArtboards(){
  dPubObservers.forEach(obs=>obs.disconnect());
  dPubObservers=[];
  const grid=document.getElementById('pub-ab-grid');if(!grid)return;
  const ab=dGetActiveAB();
  if(!ab||!dLayers.length){
    grid.innerHTML='<div class="pub-empty">Adicione camadas antes de publicar.</div>';return;
  }
  dPubHidePreview();
  const checked=dPubSelectedABs.has(ab.id);
  const bgLyr=dLayers.find(l=>l.type==='shape'&&l.x===0&&l.y===0);
  const bgColor=bgLyr?bgLyr.fill:'#e8e8e8';
  // Proporção real da prancheta (cap 2.2 p/ não gerar cards absurdamente altos)
  const ratio=ab.w&&ab.h?Math.min(2.2,ab.h/ab.w):1.78;
  const _tEx=_dPubFindTmpl();
  const existingName=(_tEx&&_tEx.tmpl.name)||ab.name;
  grid.innerHTML=`<div class="pub-ab-card ${checked?'selected':''}" id="pub-ab-card-${ab.id}" onclick="dPubToggleAB('${ab.id}')">
    <div class="pub-ab-check-wrap">
      <input type="checkbox" class="pub-ab-chk" id="pub-ab-chk-${ab.id}" ${checked?'checked':''} onclick="event.stopPropagation();dPubToggleAB('${ab.id}')">
    </div>
    <div class="pub-ab-thumb" style="background:${gEsc(bgColor)};padding-top:${ratio*100}%">
      <div class="pub-ab-thumb-render" id="pub-ab-render-${ab.id}"></div>
    </div>
    <div class="pub-ab-info">
      <input class="pub-ab-name-inp" id="pub-ab-name-${ab.id}" value="${gEsc(existingName)}" placeholder="Nome do material" onclick="event.stopPropagation()" title="Nome que aparecerá no catálogo do franqueado">
    </div>
  </div>`;
  setTimeout(()=>{
    const card=document.getElementById('pub-ab-card-'+ab.id);
    // Miniatura FIEL: mesmo motor da arte final (máscaras, cantos por canto, gradientes,
    // efeitos, blend). O renderizador DOM antigo divergia do PNG — canto arredondado
    // virava retângulo, máscara sumia, etc.
    const renderBox=document.getElementById('pub-ab-render-'+ab.id);
    if(renderBox){
      const cv=document.createElement('canvas');
      cv.className='pub-ab-thumb-cv';
      renderBox.appendChild(cv);
      if(typeof fRenderPreviewToCanvas==='function') fRenderPreviewToCanvas(cv, ab, {maxPx:720});
    }
    if(card){
      card.addEventListener('mouseenter',()=>dPubRenderPreview(ab,card));
      card.addEventListener('mouseleave',dPubHidePreview);
    }
  },0);
}

/* ── PREVIEW POPUP ── */
const PUB_PREVIEW_W = 220; // largura fixa da prévia em px

function dPubRenderPreview(ab, cardEl){
  const popup=document.getElementById('pub-ab-preview-popup');
  const inner=document.getElementById('pub-preview-inner');
  const footer=document.getElementById('pub-preview-footer');
  if(!popup||!inner)return;

  const scale=PUB_PREVIEW_W/ab.w;
  const previewH=Math.round(ab.h*scale);

  // Redimensiona o container do popup
  popup.style.width=PUB_PREVIEW_W+'px';
  popup.style.height=(previewH+32)+'px'; // +32 para o footer

  // Preview FIEL via motor da arte final (o DOM antigo perdia máscara/cantos/gradiente)
  inner.innerHTML='';
  inner.style.width='100%';
  inner.style.height=previewH+'px';
  inner.style.transform='none';
  const cv=document.createElement('canvas');
  cv.style.cssText='display:block;width:100%;height:100%';
  inner.appendChild(cv);
  if(typeof fRenderPreviewToCanvas==='function') fRenderPreviewToCanvas(cv, ab, {maxPx:720});

  // Footer com info da prancheta
  if(footer){
    footer.textContent=ab.name+' · '+ab.w+'×'+ab.h+' · '+(ab.fmt||'custom').toUpperCase();
  }

  // Posiciona com position:fixed acima do card
  const rect=cardEl.getBoundingClientRect();
  let top=rect.top-previewH-44;
  if(top<8) top=rect.bottom+8; // abaixo se não couber acima
  let left=rect.left+(rect.width/2)-(PUB_PREVIEW_W/2);
  left=Math.max(8,Math.min(left,window.innerWidth-PUB_PREVIEW_W-8));

  popup.style.top=top+'px';
  popup.style.left=left+'px';
  popup.style.display='block';
}

function dPubHidePreview(){
  const popup=document.getElementById('pub-ab-preview-popup');
  if(popup) popup.style.display='none';
}

function dPubToggleAB(id){
  if(dPubSelectedABs.has(id)) dPubSelectedABs.delete(id);
  else dPubSelectedABs.add(id);
  const card=document.getElementById('pub-ab-card-'+id);
  const chk=document.getElementById('pub-ab-chk-'+id);
  if(card) card.classList.toggle('selected', dPubSelectedABs.has(id));
  if(chk)  chk.checked=dPubSelectedABs.has(id);
  dPublishRenderPerms();
  dPublishQueueDraft();
}
function dPubSelectAllAB(sel){
  const _ab=dGetActiveAB();
  if(sel) dPubSelectedABs.add(_ab.id); else dPubSelectedABs.delete(_ab.id);
  dPublishRenderArtboards();
  dPublishRenderPerms();
}

/* ── PERMISSÕES ── */
function dPublishRenderPerms(){
  const permList=document.getElementById('pub-perm-list');if(!permList)return;
  const allVars=new Set();
  if (typeof dArtboards !== 'undefined' && dArtboards && dArtboards.length) {
    dArtboards.forEach(ab => {
      if(dPubSelectedABs.has(ab.id)) {
        dExtractTemplateVars(ab.layers).forEach(v=>allVars.add(v));
      }
    });
  } else {
    dExtractTemplateVars(dLayers).forEach(v=>allVars.add(v));
  }
  const vars=[...allVars];
  if(!vars.length){
    permList.innerHTML='<div class="pub-empty">As pranchetas selecionadas não têm variáveis editáveis ({{nome}}).</div>';return;
  }
  permList.innerHTML=_dPermBar()+vars.map(v=>{
    const vDef=(dVars||[]).find(x=>x.name===v);
    const isImage=vDef?vDef.type==='image':false;
    if(!dPubPermissoes[v]) dPubPermissoes[v]={edit:true,maxLen:isImage?0:32}; // imagem não usa maxLen de texto
    const perm=dPubPermissoes[v];
    const label=vDef?vDef.label:v;
    return `<div class="pub-perm-row">
      <div class="pub-perm-info">
        <div class="pub-perm-name">${gEsc(label)}</div>
        <div class="pub-perm-key">{{${gEsc(v)}}}</div>
      </div>
      <label class="pub-perm-toggle">
        <input type="checkbox" ${perm.edit?'checked':''} onchange="dPublishUpdatePerm('${v}','edit',this.checked)">
        <span>Editável</span>
      </label>
      ${isImage?'':`<div class="pub-perm-len">
        <label>Máx</label>
        <input type="number" min="1" max="200" value="${perm.maxLen||32}" onchange="dPublishUpdatePerm('${v}','maxLen',parseInt(this.value)||32)" ${!perm.edit?'disabled':''}>
        <span>chars</span>
      </div>`}
    </div>`;
  }).join('');
}
function dPublishUpdatePerm(varName, key, value){
  if(!dPubPermissoes[varName]) dPubPermissoes[varName]={edit:true,maxLen:32};
  dPubPermissoes[varName][key]=value;
  if(key==='edit') dPublishRenderPerms();
  dPublishQueueDraft();
}

/* ── PRESETS DE PERMISSÃO + APLICAR À CAMPANHA INTEIRA ──
   Governança: define o trilho de permissão uma vez e replica em todos os materiais da
   pasta (consistência de marca) sem refazer campo a campo. Presets ficam no localStorage. */
function _dPermPresets(){
  try{ const r=localStorage.getItem('_luma_perm_presets'); const s=r?JSON.parse(r):null; return (s&&Array.isArray(s.entries))?s.entries:[]; }catch(e){ return []; }
}
function _dPermBar(){
  const opts=_dPermPresets().map(p=>`<option value="${gEsc(p.id)}">${gEsc(p.name)}</option>`).join('');
  return `<div class="pub-perm-presets">
    <select class="pub-perm-preset-select" onchange="dPermPresetLoad(this.value)"><option value="">Aplicar preset…</option>${opts}</select>
    <button type="button" class="d-btn-sec" onclick="dPermPresetSave()">Salvar preset</button>
    <button type="button" class="d-btn-sec" onclick="dPermApplyToFolder()" title="Copia estas permissões para todos os materiais desta campanha">Aplicar a toda a campanha</button>
  </div>`;
}
async function dPermPresetSave(){
  const name=typeof gPrompt==='function'
    ?await gPrompt('Dê um nome que ajude o time a reconhecer esta configuração.','',{title:'Salvar preset de permissões',placeholder:'Ex.: Preços travados, produto livre',okLabel:'Salvar preset'})
    :null;
  if(name===null) return;
  const nm=name.trim(); if(!nm){ gToast('Nome inválido','error'); return; }
  let store={entries:[]}; try{const r=localStorage.getItem('_luma_perm_presets'); if(r)store=JSON.parse(r);}catch(e){}
  if(!store||!Array.isArray(store.entries)) store={entries:[]};
  store.entries.push({ id:'pp-'+Date.now(), name:nm, perms:JSON.parse(JSON.stringify(dPubPermissoes)) });
  try{ localStorage.setItem('_luma_perm_presets', JSON.stringify(store)); }catch(e){ gToast('Não consegui salvar o preset (armazenamento cheio?)','error'); return; }
  gToast('✓ Preset "'+nm+'" salvo');
  dPublishRenderPerms();
}
function dPermPresetLoad(id){
  if(!id) return;
  const p=_dPermPresets().find(e=>e.id===id); if(!p||!p.perms) return;
  // aplica só aos campos que ESTE material tem (não injeta campos alheios na tela)
  Object.keys(dPubPermissoes).forEach(v=>{ if(p.perms[v]) dPubPermissoes[v]=JSON.parse(JSON.stringify(p.perms[v])); });
  dPublishRenderPerms();
  gToast('Preset aplicado a este material');
}
async function dPermApplyToFolder(){
  const info=(typeof _dPubFindTmpl==='function')?_dPubFindTmpl():null;
  const folder=info&&info.folder;
  if(!folder||!Array.isArray(folder.templates)||folder.templates.length<2){ gToast('Esta campanha não tem outros materiais pra aplicar.'); return; }
  const confirmed=typeof gConfirm==='function'
    ?await gConfirm(`Aplicar estas permissões aos ${folder.templates.length} materiais da campanha?`,{title:'Aplicar à campanha inteira',okLabel:'Aplicar permissões',cancelLabel:'Cancelar'})
    :false;
  if(!confirmed)return;
  const perms=JSON.parse(JSON.stringify(dPubPermissoes));
  folder.templates.forEach(t=>{
    if(!t.publishMeta) t.publishMeta={};
    // merge: preserva o que o material já tinha, o preset sobrescreve/adiciona.
    t.publishMeta.permissoes=Object.assign({}, t.publishMeta.permissoes||{}, JSON.parse(JSON.stringify(perms)));
    t._syncPending=true;
  });
  if(typeof dPersistFolders==='function') dPersistFolders();
  gToast('Permissões aplicadas a '+folder.templates.length+' materiais da campanha');
}

function dPublishShowSuccess(count,folderName){
  const modal=document.getElementById('d-publish-modal');
  const box=modal?.querySelector('.pub-box');
  const body=modal?.querySelector('.pub-body');
  if(!modal||!box||!body){dPublishClose();return;}
  dPubPublished=true;
  box.classList.add('pub-success-mode');
  document.querySelectorAll('#d-publish-modal .pub-panel').forEach(panel=>panel.classList.remove('active'));
  let success=document.getElementById('pub-success-panel');
  if(!success){
    success=document.createElement('section');
    success.id='pub-success-panel';
    success.className='pub-success-state';
    body.appendChild(success);
  }
  success.innerHTML=`<div class="pub-success-icon-wrap">
      <svg class="checkmark-svg" viewBox="0 0 52 52" aria-hidden="true"><circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"/><path class="checkmark-check" d="M14.1 27.2l7.1 7.2 16.7-16.8"/></svg>
    </div>
    <span class="pub-success-eyebrow">Publicação concluída</span>
    <h3>Material disponível no catálogo</h3>
    <p>${count} material${count!==1?'is':''} publicado${count!==1?'s':''} em <strong>${gEsc(folderName)}</strong>.</p>
    <div class="pub-success-note"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7 9 18l-5-5"/></svg><span>O franqueado já pode encontrar o material enquanto ele estiver dentro da validade.</span></div>`;
  const title=modal.querySelector('.pub-head-title span');
  if(title)title.textContent='Publicado com sucesso';
  const draft=document.getElementById('pub-save-draft');
  const status=document.getElementById('pub-draft-status');
  const cancel=modal.querySelector('.pub-btn-cancel');
  const primary=modal.querySelector('.pub-btn-confirm');
  if(draft)draft.hidden=true;
  if(status)status.textContent='';
  if(cancel)cancel.hidden=true;
  if(primary){
    primary.disabled=false;
    primary.classList.remove('loading');
    primary.setAttribute('onclick','dPublishClose()');
    primary.innerHTML='<span>Voltar ao editor</span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
  }
  setTimeout(()=>success.querySelector('h3')?.setAttribute('tabindex','-1'),0);
  setTimeout(()=>success.querySelector('h3')?.focus(),10);
}

/* ── CONFIRMAR PUBLICAÇÃO ── */
function dPublishConfirm(){
  if(!dPublishValidateStep(0)||!dPublishValidateStep(1))return;
  const draftKey=dPublishDraftKey();
  const confirmBtn=document.querySelector('#d-publish-modal .pub-btn-confirm');
  if(confirmBtn){
    confirmBtn.disabled=true;
    confirmBtn.classList.add('loading');
    confirmBtn.innerHTML='<span class="pub-btn-spinner" aria-hidden="true"></span><span>Publicando…</span>';
  }
  const selected=[...dPubSelectedABs];
  if(!selected.length){gToast('Selecione a prancheta para publicar','error');return;}
  dGetActiveAB();
  if(typeof dSyncLayersToAB==='function') dSyncLayersToAB();
  const folderId=document.getElementById('pub-folder').value;
  const validade=document.getElementById('pub-validade').value;
  const instrucoes=document.getElementById('pub-instrucoes').value;
  const folder=dFolders.find(f=>f.id===folderId);
  if(!folder){
    if(confirmBtn){confirmBtn.disabled=false;confirmBtn.classList.remove('loading');}
    dPublishShowError('Selecione uma campanha válida.',1,document.getElementById('pub-folder'));
    return;
  }
  let count=0;
  selected.forEach(abId=>{
    const ab=dArtboards.find(a=>a.id===abId);if(!ab)return;
    // Nome pode ter sido editado no card
    const nameInp=document.getElementById('pub-ab-name-'+abId);
    const tmplName=(nameInp?nameInp.value.trim():'')||ab.name;
    // ID do template: o template CARREGADO quando existe; senão um id ÚNICO por arte.
    // O antigo 'tmpl-ab-'+abId colidia (abId é sempre 'ab-single'): publicar a arte B
    // sobrescrevia silenciosamente a arte A publicada antes.
    const _target=_dPubFindTmpl();
    const tmplId=_target?_target.tmpl.id:('tmpl-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7));
    // Procura template existente (em qualquer pasta) para reutilizar publishMeta
    let tmpl=null;
    let tmplFolder=null;
    for(const f of dFolders){const t=f.templates.find(x=>x.id===tmplId);if(t){tmpl=t;tmplFolder=f;break;}}
    if(tmpl){
      // Atualiza template existente, move de pasta se necessário
      tmpl.name=tmplName;
      tmpl.fmt=ab.fmt||'story';
      tmpl.w=ab.w; tmpl.h=ab.h; tmpl.bg=ab.bg; // tamanho/fundo nativos → franqueado renderiza 1:1
      tmpl.layers=JSON.parse(JSON.stringify(ab.layers));
      if(tmplFolder&&tmplFolder.id!==folderId){
        tmplFolder.templates=tmplFolder.templates.filter(t=>t.id!==tmplId);
        folder.templates.unshift(tmpl);
      }
    }else{
      // Cria template novo
      tmpl={id:tmplId,name:tmplName,fmt:ab.fmt||'story',
        w:ab.w,h:ab.h,bg:ab.bg, // tamanho/fundo nativos → franqueado renderiza 1:1
        layers:JSON.parse(JSON.stringify(ab.layers)),publishMeta:dDefaultPublishMeta()};
      folder.templates.unshift(tmpl);
    }
    // Aplica configurações compartilhadas
    if(!tmpl.publishMeta) tmpl.publishMeta=dDefaultPublishMeta();
    tmpl.publishMeta.publicado=true;
    tmpl.publishMeta.publicadoEm=Date.now();
    tmpl.publishMeta.validade=validade;
    tmpl.publishMeta.instrucoes=instrucoes;
    tmpl.publishMeta.permissoes=JSON.parse(JSON.stringify(dPubPermissoes));
    // Vincula a arte aberta ao template publicado: republicar atualiza ESTE template.
    if(typeof dActiveTmplId!=='undefined') dActiveTmplId=tmpl.id;
    // Contrato do schema: {template_id, template_name, fmt_id, camp_id, camp_name}
    if(typeof gTrackEvent==='function') gTrackEvent('template_publicado',{
      template_id:tmpl.remoteId||tmpl.id||null, template_name:tmpl.name||'', fmt_id:tmpl.fmt||'',
      camp_id:folder.campId||folder.remoteId||folder.id||null, camp_name:folder.name||''});
    count++;
  });
  dFolderOpen[folderId]=true;
  const hadImgWarn=gImgPersistWarned;
  const ok=dPersistFolders();
  dRenderFolders();
  if(!ok){
    if(confirmBtn){confirmBtn.disabled=false;confirmBtn.classList.remove('loading');dPublishUpdateFooter();}
    dPublishShowError('Não foi possível salvar a publicação. Revise o espaço disponível e tente novamente.',2,confirmBtn);
    return;
  }
  dDirty=false; // publicar persistiu tudo
  const saveIndicator=document.getElementById('d-save-indicator');
  if(saveIndicator)saveIndicator.innerHTML='<span class="d-save-published"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>Publicado</span>';
  dPublishClearDraft(draftKey);
  dPublishShowSuccess(count,folder.name);
  if(typeof window.gPlayPublishSuccessSound === 'function') window.gPlayPublishSuccessSound();
}
/* ── M2.2 — Safety net: estado de gravação + proteção contra fecho acidental ── */
let dDirty=false;
// state: 'saved' | 'saving' | 'unsaved'
function dSetSaveState(state){
  const ind=document.getElementById('d-save-indicator');
  const s2=document.getElementById('d-save-indicator2');
  let html;
  if(state==='saving'){
    html='<svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation:gSpin 1s linear infinite"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg><span>Salvando...</span>';
  }else if(state==='unsaved'){
    dDirty=true;
    html='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--dm-orange)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span style="color:var(--dm-orange)">Não salvo</span>';
  }else{ // saved
    dDirty=false;
    // Sem backend, "na nuvem" é mentira — o trabalho está só neste aparelho. (O caso
    // "com backend mas o push ainda não confirmou" é tratado pelo badge de pendência.)
    const hasBk=(typeof gHasBackend==='function') && gHasBackend();
    const savedTxt=hasBk?'Salvo na nuvem':'Salvo neste aparelho';
    html='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/><polyline points="9 15 12 18 16 13"/></svg><span>'+savedTxt+'</span>';
  }
  if(ind)ind.innerHTML=html;
  if(s2)s2.innerHTML=html;
}
function dMarkUnsaved(){ dSetSaveState('unsaved'); }
// Previne fechar/recarregar a aba com trabalho não guardado (back-end real → medo de perder)
window.addEventListener('beforeunload', (e)=>{
  if(dDirty){ e.preventDefault(); e.returnValue=''; return ''; }
});
function dPreview(){dPreviewOpen();}
function dStats(){}

/* ── COPIAR / COLAR layers (clipboard interno, estilo Photoshop) ── */
let dClipboard=null; // null | { layers:[...] }
function dCopy(){
  if(!dSelId && !dMultiSel.length)return;
  const ids = dMultiSel.length ? [...dMultiSel] : [dSelId];
  // Grupo copiado leva os filhos junto — antes copiava só o contêiner (colava grupo vazio).
  ids.slice().forEach(id=>{
    const g=dLayers.find(x=>x.id===id);
    if(g&&g.type==='group')dLayers.forEach(ch=>{if(ch.parentId===id&&!ids.includes(ch.id))ids.push(ch.id);});
  });
  const layers = ids.map(id=>{const l=dLayers.find(x=>x.id===id);return l?JSON.parse(JSON.stringify(l)):null;}).filter(Boolean);
  if(!layers.length)return;
  dClipboard={layers};
  const n=layers.length;
  gToast(n+' layer'+(n>1?'s':'')+' copiado'+(n>1?'s':'')+'  (Ctrl+C)');
}
function dPaste(samePlace){
  if(!dClipboard || !dClipboard.layers.length)return;
  dHistoryPush();
  const newIds=[];
  const idMap={}; // id original → id do clone (p/ religar filhos ao grupo CLONADO)
  const clones=[];
  dClipboard.layers.forEach(orig=>{
    const nl=JSON.parse(JSON.stringify(orig));
    nl.id='l-'+(++dLyrCnt); // mesma convenção de id do resto do designer (string)
    nl.name=orig.name+' cópia';
    if(!samePlace){nl.x=(orig.x||0)+10;nl.y=(orig.y||0)+10;}
    idMap[orig.id]=nl.id;
    clones.push(nl);
    dLayers.push(nl);
    newIds.push(nl.id);
  });
  // Se o grupo veio junto na cópia, os filhos clonados apontam pro grupo novo;
  // se só os filhos foram copiados, mantêm o parentId original (colam no mesmo grupo).
  clones.forEach(nl=>{ if(nl.parentId && idMap[nl.parentId]) nl.parentId=idMap[nl.parentId]; });
  dSelId=newIds[0];
  dMultiSel = newIds.length>1 ? newIds : [];
  dRenderCanvas();dRenderLayersList();dStats();dMarkUnsaved();
  const l=dLayers.find(x=>x.id===dSelId);
  if(l){dShowProps(l);if(typeof dUpdateCtxBar==='function')dUpdateCtxBar();}
  const n=newIds.length;
  gToast(n+' layer'+(n>1?'s':'')+' colado'+(n>1?'s':'')+(samePlace?' (no lugar)':''));
}

/* ── Ctrl+V: COLAR IMAGEM DO CLIPBOARD (print, cópia do navegador/Figma) ──
   Um Ctrl+V só, que faz a coisa certa — é assim no Photoshop e é o que a pessoa espera.
   Precisa ser no evento `paste` (e não no keydown): só ele traz o conteúdo do clipboard do
   sistema. Por isso o keydown do Ctrl+V deixou de dar preventDefault; ver o comentário lá.

   Prioridade: IMAGEM do sistema ganha do clipboard interno de camadas. Motivo — copiar um
   print é ato deliberado e imediato, enquanto o dClipboard fica preenchido a sessão toda
   depois de um Ctrl+C e roubaria todo Ctrl+V seguinte. Duplicar camada tem Ctrl+D, que é
   igualmente rápido, e um colar errado morre com um Ctrl+Z.

   O Shift vem do keydown (dColarNoLugar): eventos de clipboard não carregam modificador.
   dPasteAssumido avisa o fallback do keydown que este handler tomou conta do gesto. */
let dColarNoLugar=false;
let dPasteAssumido=false;
document.addEventListener('paste', e=>{
  // Fora do Estúdio o Ctrl+V não é nosso (o chat do franqueado cola texto).
  if(!document.body.classList.contains('mode-designer')) return;
  const t=e.target;
  // Campo de texto (conteúdo da camada, edição inline, busca) cola TEXTO: sequestrar o
  // Ctrl+V de quem está digitando seria pior que não ter o recurso. Sem marcar assumido:
  // o keydown nem agenda fallback quando o foco está num campo (guard `inField`).
  if(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName||''))) return;
  const cb=e.clipboardData; if(!cb) return;
  dPasteAssumido=true;   // daqui pra baixo o gesto é deste handler; o fallback desiste
  const imgs=Array.prototype.slice.call(cb.items||[])
    .filter(i=>i.kind==='file' && /^image\//.test(i.type||''))
    .map(i=>i.getAsFile()).filter(Boolean);
  if(imgs.length){
    e.preventDefault();
    const f=(typeof dCanvasSize==='function')?dCanvasSize():{w:1080,h:1920};
    // Centro da prancheta: colar não tem ponteiro, e é onde o olho já está.
    imgs.forEach((a,k)=>dAddImageFromFile(a, f.w/2+k*24, f.h/2+k*24, imgs.length>1?null:'Imagem colada'));
    return;
  }
  // Sem imagem no clipboard → o Ctrl+V volta a ser o colar de CAMADAS de sempre.
  if(dClipboard && dClipboard.layers && dClipboard.layers.length){
    e.preventDefault();
    dPaste(dColarNoLugar);
  }
});

/*
  TABELA DE ATALHOS DE TECLADO — Luma Designer
  ===========================================
  [Atalhos com modificadores (funcionam sempre, exceto Ctrl+A em input)]
  - Ctrl+Z / Cmd+Z          : Desfazer (Undo)
  - Ctrl+Shift+Z / Cmd+Sh+Z : Refazer (Redo)
  - Ctrl+Y / Cmd+Y          : Refazer (Redo)
  - Ctrl+S / Cmd+S          : Salvar Documento
  - Ctrl+D / Cmd+D          : Duplicar Camada(s)
  - Ctrl+G / Cmd+G          : Agrupar Camada(s)
  - Ctrl+Shift+G / Cmd+Sh+G : Desagrupar Camada(s)
  - Ctrl+0 / Cmd+0          : Ajustar à Tela
  - Ctrl+1 / Cmd+1          : Zoom 100%
  - Ctrl+"+" / Ctrl+"="     : Ampliar Zoom
  - Ctrl+"-"                : Reduzir Zoom
  - Ctrl+C / Cmd+C          : Copiar Camada(s) (bloqueado em campos de texto)
  - Ctrl+V / Cmd+V          : Colar — IMAGEM do clipboard (print/Figma) se houver uma;
                              senão, Camada(s) copiada(s). Bloqueado em campos de texto.

  [Atalhos de Ferramenta (bloqueados em campos de texto/inputs)]
  - Esc                     : Selecionar e fechar modais / Limpar origem de carimbo
  - Del / Backspace         : Deletar camada selecionada (ou limpar pintura se Pincel/Borracha ativo)
  - V                       : Ferramenta Mover / Seleção (dSelectActivate)
  - Shift+V                 : Alternar ferramentas de seleção (Select, Hand, Obj-Select, Quick-Select, Magic-Wand)
  - H                       : Ferramenta Mão (Pan)
  - T                       : Ferramenta Texto (dTextActivate)
  - Shift+T                 : Alternar ferramentas de texto (Text-H, Text-V, Mask-Text-H, Mask-Text-V)
  - U                       : Ferramenta Forma (dFormaActivate)
  - Shift+U                 : Alternar ferramentas de forma (Rect, Ellipse, Triangle, Polygon, Line, Star)
  - R                       : Forma Retângulo direto
  - O                       : Forma Elipse direto
  - F                       : Ferramenta Moldura (dFrameActivate)
  - Shift+F                 : Alternar imagem/moldura (Frame, Img)
  - M                       : Adicionar Imagem direto
  - B                       : Ferramenta Pincel (dBrushActivate)
  - Shift+B                 : Alternar pincel/borracha/carimbo (Brush, Eraser, Stamp)
  - E                       : Borracha direto
  - S                       : Carimbo (Stamp) direto / Define origem se houver layer selecionado
  - G                       : Ferramenta Preenchimento (dFillActivate)
  - Shift+G                 : Alternar preenchimento (Bucket, Gradient)
  - I                       : Ferramenta Conta-gotas (dEyedropActivate)
  - Shift+I                 : Alternar conta-gotas (Eyedrop, Color-Sampler, Ruler, Note, Count)
  - N                       : Ferramenta Nitidez / Blur / Smudge (dNitidezActivate)
  - Shift+N                 : Alternar nitidez (Blur, Sharpen, Smudge)
  - K                       : Modo Máscara de Camada (dMaskPaintStart/dMaskAdd se inativo; alterna Hide/Reveal se ativo)
  - Q                       : QR Code direto
  - X                       : Vincular campo / Dados (dDataActivate)
  - Shift+X                 : Alternar dados (Var-Data, QR-Code)
  - L                       : Abrir Recursos / Assets
  - P                       : Abrir Prévia de Impressão/Publicação
  - ? / Shift+/             : Abrir Guia de Atalhos
  - Setas (Up/Down/L/R)     : Mover camada selecionada (1px, ou 10px com Shift)

  [No Modo de Máscara Ativo]
  - Esc                     : Cancelar e sair sem salvar
  - Enter                   : Concluir e aplicar máscara
*/

/* ── KEYBOARD SHORTCUTS (estilo Photoshop) ── */
let _dAvisoTravada = 0;   // freio do aviso de página bloqueada (ver guard abaixo)
document.addEventListener('keydown', e => {
  const inField = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable;
  
  if (document.body.classList.contains('mode-designer')) {
    // Se o modo máscara estiver ativo, interceptar Enter/Escape antes de qualquer coisa
    if (typeof _dMaskState !== 'undefined' && _dMaskState) {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (typeof dMaskExit === 'function') dMaskExit(false);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (typeof dMaskExit === 'function') dMaskExit(true);
        return;
      }
    }

    // PÁGINA BLOQUEADA (cadeado na barra da prancheta): o CSS já mata o ponteiro no
    // canvas, nos painéis e na régua, mas o teclado entra por fora deles — Ctrl+V
    // colava camada, Delete apagava, Ctrl+Z desfazia até antes do bloqueio. Aqui só
    // passa o que OLHA: Esc, zoom e o guia de atalhos. Dentro de um campo de texto o
    // guard não vale (o campo é do painel, que já está desligado quando travado).
    if (!inField && typeof dPageLocked === 'function' && dPageLocked()) {
      const _zoom = (e.ctrlKey || e.metaKey) && ['0','1','=','+','-','_'].includes(e.key);
      const _navega = ['Escape','?','Tab','Shift','Control','Meta','Alt','PageUp','PageDown','Home','End'].includes(e.key);
      if (!_navega && !_zoom) {
        // Um aviso por vez: sem o freio, segurar Delete enfileirava dezenas de toasts.
        const agora = e.timeStamp || 0;
        if (agora - _dAvisoTravada > 1600) {
          _dAvisoTravada = agora;
          gToast('🔒 Página bloqueada — destrave no cadeado acima da prancheta.');
        }
        return;
      }
    }

    // Esc sai do modo recorte inline (o toast promete isso; sem esta saída ficava preso)
    if (typeof dCropState !== 'undefined' && dCropState && e.key === 'Escape') {
      e.preventDefault();
      if (typeof dStopCrop === 'function') dStopCrop();
      return;
    }

    // Atalhos CTRL/CMD. Salvar e zoom funcionam sempre (mesmo em inputs). Já os que agem
    // sobre CAMADA (undo/redo/duplicar/agrupar) NÃO disparam dentro de um campo de texto —
    // ali Ctrl+Z tem de ser o desfazer NATIVO do texto, não desfazer a última ação de camada.
    if (e.ctrlKey || e.metaKey) {
      if (!inField && e.shiftKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); dRedo(); return; }
      if (!inField && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); dUndo(); return; }
      if (!inField && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); dRedo(); return; }
      if (e.key === 's' || e.key === 'S') { if (!e.shiftKey) { e.preventDefault(); dSave(); return; } }
      if (e.key === '0') { e.preventDefault(); dFitToScreen(); return; }
      if (e.key === '1') { e.preventDefault(); dSetZoom(100); return; }
      if (e.key === '=' || e.key === '+') { e.preventDefault(); dZoom(1); return; }
      if (e.key === '-' || e.key === '_') { e.preventDefault(); dZoom(-1); return; }
      if (!inField && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); dDuplicateLayer(); return; }
      if (!inField && !e.shiftKey && (e.key === 'g' || e.key === 'G')) { e.preventDefault(); dGroupSelected(); return; }
      if (!inField && e.shiftKey && (e.key === 'g' || e.key === 'G')) { e.preventDefault(); dUngroupSelected(); return; }
    }

    if (inField) return; // resto bloqueia se em input

    // Com um MODAL do designer aberto, atalhos de tecla única não podem vazar pro
    // canvas (Delete apagava camada atrás do modal, Espaço trocava de ferramenta em
    // vez de acionar o botão focado, P abria o preview por cima). Esc passa — fecha
    // o contexto. Ctrl/Cmd (undo/save/zoom) continuam acima deste guard.
    const _modalIds=['d-publish-modal','d-preview-overlay','d-var-modal','d-folder-modal','d-tmpl-modal','d-newdoc-modal','d-psd-modal','d-sim-modal','d-cheat-modal','d-svg-review-overlay'];
    if (e.key!=='Escape' && _modalIds.some(id=>{const m=document.getElementById(id);return m&&m.classList.contains('open');})) return;

    // Ctrl+Alt+C / Ctrl+Alt+V — copiar/colar ESTILO (propriedades visuais, não o layer)
    if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); if(typeof dCopyStyle==='function') dCopyStyle(); return; }
    if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'v' || e.key === 'V')) { e.preventDefault(); if(typeof dPasteStyle==='function') dPasteStyle(); return; }

    // Ctrl+C / Ctrl+V — copiar/colar layers (só no canvas, nunca dentro de campos de texto)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); dCopy(); return; }
    /* Ctrl+V — ⛔ NÃO dá preventDefault de propósito. O preventDefault no keydown cancela a
       ação de colar do navegador e com ela o evento `paste`, que é o ÚNICO caminho pro
       conteúdo do clipboard do sistema (print, cópia do Figma). Era por isso que colar
       imagem não tinha como funcionar.
       O colar de CAMADAS virou fallback com prazo, e isso NÃO é preciosismo: quando o
       clipboard do sistema está vazio o navegador não dispara `paste` nenhum (verificado no
       Chrome) — sem o fallback, copiar camada com Ctrl+C e colar deixaria de funcionar.
       Se o `paste` chegar, ele assume e o fallback desiste. Ele chega junto do gesto, na
       casa de 1ms; os 120ms são folga. No pior caso os dois rodam: colava camada e entrava
       a imagem — visível na hora e um Ctrl+Z resolve, não corrompe nada.
       O Shift viaja em dColarNoLugar porque eventos de clipboard não carregam modificador. */
    if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) { // Shift = colar no mesmo lugar (Alt é colar ESTILO, interceptado acima)
      dColarNoLugar = e.shiftKey;
      dPasteAssumido = false;
      setTimeout(()=>{ if(!dPasteAssumido) dPaste(dColarNoLugar); }, 120);
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return; // outros combos com modificador NÃO disparam atalhos de ferramenta

    if (e.key === 'Escape') { dCloseVarModal(); dSetTool('select'); }
    // Del respeita a multi-seleção (antes só a camada primária caía) e, com QUALQUER
    // ferramenta de pintura ativa, limpa a pintura em vez de apagar a camada selecionada.
    const _paintTools = ['brush', 'eraser', 'smudge', 'blur', 'sharpen', 'bg-eraser'];
    if ((e.key === 'Delete' || e.key === 'Backspace') && !_paintTools.includes(dTool)) {
      if (typeof dDeleteSelectedLayer === 'function') dDeleteSelectedLayer(); else dDeleteLayer();
    }
    if (e.key === 'Delete' && _paintTools.includes(dTool)) dClearPaint();
    if (e.key === 'Escape') { dStampSource = null; if(typeof dStampUpdateStatus==='function') dStampUpdateStatus(); } // Esc limpa stamp source
    // [ e ] ajustam o tamanho do pincel (Shift = passo 10) quando ferramenta de pintura ativa
    if ((e.key === '[' || e.key === ']') && ['brush','eraser','smudge','blur','sharpen','bg-eraser'].includes(dTool) && typeof dBrushNudgeSize === 'function') {
      e.preventDefault(); dBrushNudgeSize(e.key === ']' ? (e.shiftKey?10:1) : (e.shiftKey?-10:-1)); return;
    }

    // V - Seleção / Mover (com alternância Shift+V)
    if (e.key === 'v' || e.key === 'V') {
      if (e.shiftKey) {
        const order = ['select', 'hand', 'obj-select', 'quick-select', 'magic-wand'];
        let idx = order.indexOf(dTool);
        if (idx === -1) idx = 0;
        let nIdx = (idx + 1) % order.length;
        if (typeof dSelectPick === 'function') dSelectPick(order[nIdx]);
      } else {
        if (typeof dSelectActivate === 'function') dSelectActivate(); else dSetTool('select');
      }
    }

    // F2 - Renomeia a camada selecionada. (Sem seleção não faz nada: no modo canvas
    // único não há prancheta nomeável — o caminho dRenameAB era um no-op morto.)
    if (e.key === 'F2') {
      e.preventDefault();
      if (dSelId !== null && typeof dRenameLayer === 'function') dRenameLayer(dSelId, e);
      return;
    }

    // Barra de Espaço - Hand
    if (e.key === ' ') {
      if (dTool !== 'hand') {
        dPrevToolForSpace = dTool;
        dSetTool('hand');
      }
      e.preventDefault();
      return;
    }

    // H - Hand
    if (e.key === 'h' || e.key === 'H') {
      dSetTool('hand');
    }

    // T - Texto (com alternância Shift+T)
    if (e.key === 't' || e.key === 'T') {
      if (e.shiftKey) {
        // Controle do produto: o ciclo PULA a ferramenta indisponível em vez de
        // parar nela. dSetTool bloquearia de qualquer jeito, mas o Shift+T
        // travaria numa ferramenta desligada e só emitiria toast — aqui ele
        // segue direto para a próxima disponível.
        let order = ['text-h', 'text-v', 'mask-text-h', 'mask-text-v'];
        if (typeof gFeatureToolBlocked === 'function') {
          const livres = order.filter(t => !gFeatureToolBlocked(t));
          if (livres.length) order = livres;
        }
        let idx = order.indexOf(dTool);
        if (idx === -1) idx = -1;   // ferramenta atual fora da lista → começa do primeiro
        let nIdx = (idx + 1) % order.length;
        if (typeof dTextPick === 'function') dTextPick(order[nIdx]);
      } else {
        if (typeof dTextActivate === 'function') dTextActivate(); else dSetTool('text');
      }
    }

    // U - Forma (com alternância Shift+U)
    if (e.key === 'u' || e.key === 'U') {
      if (e.shiftKey) {
        const order = ['rect', 'ellipse', 'triangle', 'polygon', 'line', 'star'];
        let idx = order.indexOf(dFormaLast);
        if (idx === -1) idx = 0;
        let nIdx = (idx + 1) % order.length;
        if (typeof dFormaPick === 'function') dFormaPick(order[nIdx]);
      } else {
        if (typeof dFormaActivate === 'function') dFormaActivate(); else dSetTool('rect');
      }
    }

    // R - Retângulo direto
    if (e.key === 'r' || e.key === 'R') {
      if (typeof dFormaPick === 'function') dFormaPick('rect'); else dSetTool('rect');
    }

    // O - Elipse direto
    if (e.key === 'o' || e.key === 'O') {
      if (typeof dFormaPick === 'function') dFormaPick('ellipse'); else dSetTool('ellipse');
    }

    // F - Moldura (com alternância Shift+F)
    if (e.key === 'f' || e.key === 'F') {
      if (e.shiftKey) {
        const order = ['frame', 'img'];
        let idx = order.indexOf(dTool);
        if (idx === -1) idx = 0;
        let nIdx = (idx + 1) % order.length;
        if (typeof dFramePick === 'function') dFramePick(order[nIdx]);
      } else {
        if (typeof dFrameActivate === 'function') dFrameActivate(); else dSetTool('frame');
      }
    }

    // M - Imagem URL direto
    if (e.key === 'm' || e.key === 'M') {
      if (typeof dFramePick === 'function') dFramePick('img'); else dSetTool('img');
    }

    // B - Pincel (com alternância Shift+B)
    if (e.key === 'b' || e.key === 'B') {
      if (e.shiftKey) {
        const order = ['brush', 'eraser', 'stamp'];
        let idx = order.indexOf(dTool);
        if (idx === -1) idx = 0;
        let nIdx = (idx + 1) % order.length;
        if (typeof dBrushPick === 'function') dBrushPick(order[nIdx]);
      } else {
        if (typeof dBrushActivate === 'function') dBrushActivate(); else dSetTool('brush');
      }
    }

    // E - Borracha direto
    if (e.key === 'e' || e.key === 'E') {
      if (typeof dBrushPick === 'function') dBrushPick('eraser'); else dSetTool('eraser');
    }

    // S - Carimbo direto
    if (e.key === 's' || e.key === 'S') {
      if (dSelId) {
        const l = dLayers.find(x => x.id === dSelId);
        if (l) { dStampSource = l; if(typeof dStampOffset!=='undefined') dStampOffset=null; gToast('Origem do carimbo: "' + l.name + '" — clique no canvas para clonar'); }
      }
      if (typeof dBrushPick === 'function') dBrushPick('stamp'); else dSetTool('stamp');
      if (typeof dStampUpdateStatus === 'function') dStampUpdateStatus();
    }

    // G - Balde de Tinta / Gradiente (com alternância Shift+G)
    if (e.key === 'g' || e.key === 'G') {
      if (e.shiftKey) {
        const order = ['bucket', 'gradient'];
        let idx = order.indexOf(dTool);
        if (idx === -1) idx = 0;
        let nIdx = (idx + 1) % order.length;
        if (typeof dFillPick === 'function') dFillPick(order[nIdx]);
      } else {
        if (typeof dFillActivate === 'function') dFillActivate(); else dSetTool('bucket');
      }
    }

    // I - Conta-gotas (com alternância Shift+I)
    if (e.key === 'i' || e.key === 'I') {
      if (e.shiftKey) {
        const order = ['eyedrop', 'color-sampler', 'ruler', 'note', 'count'];
        let idx = order.indexOf(dTool);
        if (idx === -1) idx = 0;
        let nIdx = (idx + 1) % order.length;
        if (typeof dEyedropPick === 'function') dEyedropPick(order[nIdx]);
      } else {
        if (typeof dEyedropActivate === 'function') dEyedropActivate(); else dSetTool('eyedrop');
      }
    }

    // N - Nitidez / Blur / Smudge (com alternância Shift+N)
    if (e.key === 'n' || e.key === 'N') {
      if (e.shiftKey) {
        const order = ['blur', 'sharpen', 'smudge'];
        let idx = order.indexOf(dNitidezLast);
        if (idx === -1) idx = 0;
        let nIdx = (idx + 1) % order.length;
        if (typeof dNitidezPick === 'function') dNitidezPick(order[nIdx]);
      } else {
        if (typeof dNitidezActivate === 'function') dNitidezActivate(); else dSetTool('blur');
      }
    }

    // K - Máscara (adicionar/pintar ou alternar esconder/revelar)
    if (e.key === 'k' || e.key === 'K') {
      if (typeof _dMaskState !== 'undefined' && _dMaskState) {
        if (typeof dMaskSetMode === 'function') dMaskSetMode(_dMaskState.mode === 'hide' ? 'reveal' : 'hide');
      } else {
        const l = dLayers.find(x => x.id === dSelId);
        if (l) {
          if (l.mask) {
            if (typeof dMaskPaintStart === 'function') dMaskPaintStart();
          } else {
            if (typeof dMaskAdd === 'function') dMaskAdd();
          }
        } else {
          gToast('Selecione uma camada primeiro');
        }
      }
    }

    // Q - QR Code direto
    if (e.key === 'q' || e.key === 'Q') {
      if (typeof dDataPick === 'function') dDataPick('qr-code'); else dSetTool('qr-code');
    }

    // X - Dados / Vínculo (com alternância Shift+X)
    if (e.key === 'x' || e.key === 'X') {
      if (e.shiftKey) {
        const order = ['var-data', 'qr-code'];
        let idx = order.indexOf(dTool);
        if (idx === -1) idx = 0;
        let nIdx = (idx + 1) % order.length;
        if (typeof dDataPick === 'function') dDataPick(order[nIdx]);
      } else {
        if (typeof dDataActivate === 'function') dDataActivate(); else dSetTool('var-data');
      }
    }

    // L - Recursos/Assets
    if (e.key === 'l' || e.key === 'L') {
      if (typeof dToggleResources === 'function') dToggleResources();
    }

    // P - Prévia
    if (e.key === 'p' || e.key === 'P') {
      dPreviewOpen();
    }

    // ? - Ajuda / Atalhos Cheat Sheet
    if (e.key === '?' || (e.shiftKey && e.key === '/')) {
      e.preventDefault();
      dOpenCheat();
    }

    // Mover layer com as setas
    if (dSelId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      const l = dLayers.find(x => x.id === dSelId); if (!l) return;
      // Entra no histórico (antes não entrava → Ctrl+Z não desfazia o movimento por setas).
      // Debounced: segurar/repetir a seta coalesce num único passo de desfazer.
      if (typeof dHistoryPushDebounced === 'function') dHistoryPushDebounced();
      else if (typeof dHistoryPush === 'function') dHistoryPush();
      const step = e.shiftKey ? 10 : 1;
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
      // Grupo move pelos filhos (o contêiner não tem x/y — antes virava NaN e nada andava);
      // multi-seleção anda junta, igual ao arrasto com o mouse.
      let targets;
      if (l.type === 'group') targets = dLayers.filter(x => x.parentId === l.id);
      else if (dMultiSel.length > 1 && dMultiSel.includes(l.id)) targets = dLayers.filter(x => dMultiSel.includes(x.id));
      else targets = [l];
      targets.forEach(t => { if (typeof t.x === 'number') { t.x += dx; t.y += dy; } });
      dRenderCanvas();
      if (typeof l.x === 'number' && document.getElementById('dp-x')) { document.getElementById('dp-x').value = l.x; document.getElementById('dp-y').value = l.y; }
      dMarkUnsaved();
    }
  }
});

// Listener keyup para restaurar a ferramenta anterior após soltar a Barra de Espaço
document.addEventListener('keyup', e => {
  if (document.body.classList.contains('mode-designer')) {
    if (e.key === ' ') {
      if (dTool === 'hand' && dPrevToolForSpace !== null) {
        dSetTool(dPrevToolForSpace);
        dPrevToolForSpace = null;
      }
    }
  }
});



/* O widget de cor FG/BG que vivia aqui (dSwapColors/dDefaultColors/dOnFgColorChange)
   foi REMOVIDO: mirava um DOM "vt-color-*" que nunca existiu no index e, pior, colidia
   com o dSwapColors REAL de tools.js — como publish.js carrega antes, funcionava por
   sorte de ordem; se a ordem mudasse, o botão de alternar cores quebraria em silêncio.
   O motor único do widget de cor é o de js/designer/tools.js. */
