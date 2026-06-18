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
let dPrevToolForSpace = null;      // ferramenta anterior ao pressionar Espaço

function dGetActiveTemplate(){
  for(const f of dFolders){
    const t=f.templates.find(x=>x.id===dActiveTmplId);
    if(t) return {template:t, folder:f};
  }
  return null;
}

/* ── PAINEL PUBLICAR (sidebar) — resumo + gatilho do modal completo (fluxo híbrido) ── */
function dPublishPanelRender(){
  const el=document.getElementById('d-pub-panel-summary'); if(!el)return;
  const nAb=(typeof dLayers!=='undefined'&&dLayers&&dLayers.length)?1:0;
  const nVars=(typeof dVars!=='undefined'&&dVars)?dVars.length:0;
  if(!nAb){ el.innerHTML='<div style="font-size:11.5px;color:var(--d-text3)">Adicione layers para publicar.</div>'; return; }
  const meta=(typeof dDefaultPublishMeta==='function')?dDefaultPublishMeta():{};
  const val=meta&&meta.validade?('até '+meta.validade):'sem validade definida';
  const row=(k,v)=>`<div style="display:flex;justify-content:space-between;gap:8px;font-size:11.5px;padding:5px 0;border-bottom:1px solid var(--d-border)"><span style="color:var(--d-text3)">${k}</span><span style="color:var(--d-text);font-weight:600;text-align:right">${v}</span></div>`;
  el.innerHTML = row('Pranchetas', nAb) + row('Variáveis', nVars) + row('Validade padrão', val);
}

/* ── ABRIR MODAL ── */
function dPublishOpen(){
  if(typeof dSyncLayersToAB==='function') dSyncLayersToAB();
  const _ab=dGetActiveAB();
  if(!dLayers||!dLayers.length){gToast('Adicione layers antes de publicar.');return;}
  dPubSelectedABs=new Set([_ab.id]);
  dPubPermissoes={};
  dPublishRender();
  document.getElementById('d-publish-modal').classList.add('open');
}
function dPublishClose(){
  const modal = document.getElementById('d-publish-modal');
  if (modal) {
    modal.classList.remove('open');
    const box = modal.querySelector('.pub-box');
    if (box && box._originalHTML) {
      setTimeout(() => {
        box.innerHTML = box._originalHTML;
        delete box._originalHTML;
      }, 300);
    }
  }
}
function dPublishSwitchTab(tab, btn){
  document.querySelectorAll('.pub-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.pub-panel').forEach(p=>p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('pub-panel-'+tab).classList.add('active');
}

/* ── RENDER DO MODAL ── */
function dPublishRender(){
  dPublishRenderArtboards();

  // Aba Pasta & Nome
  const folderSel=document.getElementById('pub-folder');
  folderSel.innerHTML=dFolders.map(f=>`<option value="${f.id}">${f.name}</option>`).join('');
  const fmtEl=document.getElementById('pub-fmt-display');
  if(fmtEl) fmtEl.textContent=(dFmt||'custom').toUpperCase();

  // Aba Validade
  const meta=dDefaultPublishMeta();
  document.getElementById('pub-validade').value=meta.validade||'';

  // Aba Permissões (variáveis de TODAS as pranchetas selecionadas)
  dPublishRenderPerms();

  // Aba Instruções
  document.getElementById('pub-instrucoes').value='';

  // Estado
  const stateEl=document.getElementById('pub-current-state');
  const anyPublished=dArtboards.some(ab=>{
    const tid='tmpl-ab-'+ab.id;
    for(const f of dFolders){const t=f.templates.find(x=>x.id===tid);if(t&&t.publishMeta&&t.publishMeta.publicado)return true;}
    return false;
  });
  stateEl.innerHTML=anyPublished
    ?`<span class="pub-pill pub-pill-on">● Publicado anteriormente</span>`
    :`<span class="pub-pill pub-pill-off">○ Não publicado</span>`;

  // Abre na aba de pranchetas
  const firstBtn=document.querySelector('.pub-tab');
  if(firstBtn) dPublishSwitchTab('artboards', firstBtn);
}

/* ── GRID DE PRANCHETAS ── */
function dPublishRenderArtboards(){
  const grid=document.getElementById('pub-ab-grid');if(!grid)return;
  const ab=dGetActiveAB();
  if(!ab||!dLayers.length){
    grid.innerHTML='<div class="pub-empty">Adicione layers antes de publicar.</div>';return;
  }
  dPubHidePreview();
  const checked=dPubSelectedABs.has(ab.id);
  const bgLyr=dLayers.find(l=>l.type==='shape'&&l.x===0&&l.y===0);
  const bgColor=bgLyr?bgLyr.fill:'#e8e8e8';
  const isLight=dPubIsLight(bgColor);
  const txtColor=isLight?'rgba(0,0,0,.6)':'rgba(255,255,255,.85)';
  const ratio=ab.w&&ab.h?Math.min(1,ab.h/ab.w):1.78;
  const fmtLabel=(ab.fmt||'custom').toUpperCase();
  const tid='tmpl-ab-'+ab.id;
  let existingName=ab.name;
  for(const f of dFolders){const t=f.templates.find(x=>x.id===tid);if(t){existingName=t.name;break;}}
  grid.innerHTML=`<div class="pub-ab-card ${checked?'selected':''}" id="pub-ab-card-${ab.id}" onclick="dPubToggleAB('${ab.id}')">
    <div class="pub-ab-check-wrap">
      <input type="checkbox" class="pub-ab-chk" id="pub-ab-chk-${ab.id}" ${checked?'checked':''} onclick="event.stopPropagation();dPubToggleAB('${ab.id}')">
    </div>
    <div class="pub-ab-thumb" style="background:${bgColor};padding-top:${Math.min(ratio,2)*100}%">
      <div class="pub-ab-thumb-inner" style="color:${txtColor}">
        <span class="pub-ab-thumb-fmt">${fmtLabel}</span>
        <span class="pub-ab-thumb-dim">${ab.w}×${ab.h}</span>
      </div>
    </div>
    <div class="pub-ab-info">
      <input class="pub-ab-name-inp" id="pub-ab-name-${ab.id}" value="${existingName.replace(/"/g,'&quot;')}" placeholder="Nome do material" onclick="event.stopPropagation()" title="Nome que aparecerá no catálogo do franqueado">
    </div>
  </div>`;
  setTimeout(()=>{
    const card=document.getElementById('pub-ab-card-'+ab.id);
    if(card){
      card.addEventListener('mouseenter',()=>dPubRenderPreview(ab,card));
      card.addEventListener('mouseleave',dPubHidePreview);
    }
  },0);
}
// Determina se cor hex é clara (para contraste de texto)
function dPubIsLight(hex){
  try{
    const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    return (r*299+g*587+b*114)/1000>160;
  }catch(e){return true;}
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

  // Renderiza layers
  inner.innerHTML='';
  inner.style.width=ab.w+'px';
  inner.style.height=ab.h+'px';
  inner.style.transform=`scale(${scale})`;
  inner.style.transformOrigin='top left';
  // (não sobrescrever height com previewH: o inner mantém a altura lógica ab.h e o
  //  transform:scale já reduz para previewH — senão a altura escalava duas vezes)

  ab.layers.filter(l=>l.visible).forEach(l=>{
    const el=document.createElement('div');
    el.style.position='absolute';
    el.style.left=l.x+'px';el.style.top=l.y+'px';
    el.style.width=l.w+'px';el.style.height=l.h+'px';
    if(l.type==='shape'){
      el.style.background=l.fill||'#FF9000';
      el.style.opacity=(l.opacity||100)/100;
      el.style.borderRadius=(l.radius||0)+'px';
    }else if(l.type==='text'){
      el.style.color=l.color||'#fff';
      const _fp=dTextFontParts(l.font);el.style.fontFamily=_fp.family;el.style.fontWeight=_fp.weight;
      el.style.fontSize=(l.fontSize||24)+'px';
      el.style.textAlign=l.textAlign||'left';
      el.style.lineHeight='1.2';el.style.whiteSpace='pre-wrap';
      el.style.overflow='hidden';el.style.display='flex';el.style.alignItems='center';
      if(l.strikethrough)el.style.textDecoration='line-through';
      const txt=document.createElement('div');
      txt.style.width='100%';
      // Mostra cada variável como [Rótulo] usando a regex/interpolador únicos (3.1)
      const labelMap={};
      (l.content||'').replace(gVarRegex(),(_,v)=>{const vd=(dVars||[]).find(x=>x.name===v);labelMap[v]='['+(vd?vd.label:v)+']';return _;});
      txt.textContent=gInterpolate(l.content, labelMap, {onEmpty:'keep'});
      el.appendChild(txt);
    }else if(l.type==='frame'||l.type==='image'){
      const borderR=l.type==='frame'?(l.frameShape==='circle'?'50%':(l.radius||8)+'px'):'0';
      el.style.overflow='hidden';el.style.borderRadius=borderR;
      if(l.imgUrl&&l.imgUrl!=='__local__'){
        const img=document.createElement('img');
        img.src=l.imgUrl;img.style.cssText=`width:100%;height:100%;object-fit:${l.objectFit||'cover'};display:block;`;
        el.appendChild(img);
      }else{
        el.style.background='rgba(255,255,255,.08)';
        el.style.border='1px dashed rgba(255,144,0,.4)';
        el.style.display='flex';el.style.alignItems='center';el.style.justifyContent='center';
        el.style.fontSize='10px';el.style.color='rgba(255,144,0,.7)';
        el.style.fontFamily='Roboto,sans-serif';
        el.textContent=l.imgVar||'foto';
      }
    }
    inner.appendChild(el);
  });

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
  dExtractTemplateVars(dLayers).forEach(v=>allVars.add(v));
  const vars=[...allVars];
  if(!vars.length){
    permList.innerHTML='<div class="pub-empty">As pranchetas selecionadas não têm variáveis editáveis ({{nome}}).</div>';return;
  }
  permList.innerHTML=vars.map(v=>{
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
}

/* ── CONFIRMAR PUBLICAÇÃO ── */
function dPublishConfirm(){
  const selected=[...dPubSelectedABs];
  if(!selected.length){gToast('⚠ Selecione a prancheta para publicar');return;}
  dGetActiveAB();
  if(typeof dSyncLayersToAB==='function') dSyncLayersToAB();
  const folderId=document.getElementById('pub-folder').value;
  const validade=document.getElementById('pub-validade').value;
  const instrucoes=document.getElementById('pub-instrucoes').value;
  const folder=dFolders.find(f=>f.id===folderId);
  if(!folder){gToast('⚠ Selecione uma pasta válida');return;}
  let count=0;
  selected.forEach(abId=>{
    const ab=dArtboards.find(a=>a.id===abId);if(!ab)return;
    // Nome pode ter sido editado no card
    const nameInp=document.getElementById('pub-ab-name-'+abId);
    const tmplName=(nameInp?nameInp.value.trim():'')||ab.name;
    const tmplId='tmpl-ab-'+abId;
    // Procura template existente (em qualquer pasta) para reutilizar publishMeta
    let tmpl=null;
    let tmplFolder=null;
    for(const f of dFolders){const t=f.templates.find(x=>x.id===tmplId);if(t){tmpl=t;tmplFolder=f;break;}}
    if(tmpl){
      // Atualiza template existente, move de pasta se necessário
      tmpl.name=tmplName;
      tmpl.fmt=ab.fmt||'story';
      tmpl.layers=JSON.parse(JSON.stringify(ab.layers));
      if(tmplFolder&&tmplFolder.id!==folderId){
        tmplFolder.templates=tmplFolder.templates.filter(t=>t.id!==tmplId);
        folder.templates.unshift(tmpl);
      }
    }else{
      // Cria template novo
      tmpl={id:tmplId,name:tmplName,fmt:ab.fmt||'story',
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
    count++;
  });
  dFolderOpen[folderId]=true;
  const hadImgWarn=gImgPersistWarned;
  const ok=dPersistFolders();
  dRenderFolders();
  if(!ok)return; // quota cheia: erro já exibido, mantém o modal aberto para o usuário ajustar
  dDirty=false; // publicar persistiu tudo
  document.getElementById('d-save-indicator').innerHTML='<span style="color:rgba(34,197,94,.95);font-weight:600;display:inline-flex;align-items:center;gap:4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><polyline points="20 6 9 17 4 12"/></svg>Publicado</span>';
  
  // Exibe a tela celebratória de sucesso com animação de checkmark em SVG
  const box = document.querySelector('#d-publish-modal .pub-box');
  if (box) {
    box._originalHTML = box.innerHTML;
    box.innerHTML = `
      <div class="pub-success-state">
        <div class="pub-success-icon-wrap">
          <svg class="checkmark-svg" viewBox="0 0 52 52">
            <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
            <path class="checkmark-check" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
          </svg>
        </div>
        <h3 style="font-size:18px;color:var(--d-text);font-weight:700;margin:0 0 8px;font-family:'Roboto',sans-serif;">Publicado com sucesso!</h3>
        <p style="font-size:12.5px;color:var(--d-text2);margin:0 0 24px;line-height:1.5;font-family:'Roboto',sans-serif;">
          ${count} prancheta${count !== 1 ? 's' : ''} publicada${count !== 1 ? 's' : ''} e disponível${count !== 1 ? 's' : ''} no Franqueado.
        </p>
        <button class="pub-btn pub-btn-confirm" onclick="dPublishClose()" style="padding: 8px 24px; font-size:12.5px;">Entendido</button>
      </div>
    `;
  } else {
    if(!(gImgPersistWarned&&!hadImgWarn))
      gToast('🚀 '+count+' prancheta'+(count!==1?'s':'')+' publicada'+(count!==1?'s':'')+' com sucesso!');
    dPublishClose();
  }
}
/* ── M2.2 — Safety net: estado de gravação + proteção contra fecho acidental ── */
let dDirty=false;
// state: 'saved' | 'saving' | 'unsaved'
function dSetSaveState(state){
  const ind=document.getElementById('d-save-indicator');
  const s2=document.getElementById('d-save-indicator2');
  let html;
  if(state==='saving'){
    html='<span style="color:var(--d-text3);display:inline-flex;align-items:center;gap:6px"><svg class="spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;animation:spin 1s linear infinite"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>Salvando...</span>';
  }else if(state==='unsaved'){
    dDirty=true;
    html='<span style="color:var(--dm-orange);display:inline-flex;align-items:center;gap:6px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Não salvo</span>';
  }else{ // saved
    dDirty=false;
    html='<span style="color:#22c55e;display:inline-flex;align-items:center;gap:6px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Salvo</span>';
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
  const ids = dMultiSel.length ? dMultiSel : [dSelId];
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
  dClipboard.layers.forEach(orig=>{
    const nl=JSON.parse(JSON.stringify(orig));
    nl.id='l-'+(++dLyrCnt); // mesma convenção de id do resto do designer (string)
    nl.name=orig.name+' cópia';
    if(!samePlace){nl.x=(orig.x||0)+10;nl.y=(orig.y||0)+10;}
    dLayers.push(nl);
    newIds.push(nl.id);
  });
  dSelId=newIds[0];
  dMultiSel = newIds.length>1 ? newIds : [];
  dRenderCanvas();dRenderLayersList();dStats();dMarkUnsaved();
  const l=dLayers.find(x=>x.id===dSelId);
  if(l){dShowProps(l);if(typeof dUpdateCtxBar==='function')dUpdateCtxBar();}
  const n=newIds.length;
  gToast(n+' layer'+(n>1?'s':'')+' colado'+(n>1?'s':'')+(samePlace?' (no lugar)':''));
}

/* ── KEYBOARD SHORTCUTS (estilo Photoshop) ── */
document.addEventListener('keydown',e=>{
  const inField = e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT'||e.target.isContentEditable;
  if(document.body.classList.contains('mode-designer')){
    // Atalhos CTRL/CMD funcionam sempre (mesmo em inputs) — exceto Ctrl+A em input que faria selectAll
    if(e.ctrlKey||e.metaKey){
      if(e.shiftKey&&(e.key==='z'||e.key==='Z')){e.preventDefault();dRedo();return;}
      if(e.key==='z'||e.key==='Z'){e.preventDefault();dUndo();return;}
      if(e.key==='y'||e.key==='Y'){e.preventDefault();dRedo();return;}
      if(e.key==='s'||e.key==='S'){if(!e.shiftKey){e.preventDefault();dSave();return;}}
      if(e.key==='0'){e.preventDefault();dFitToScreen();return;}
      if(e.key==='1'){e.preventDefault();dSetZoom(100);return;}
      if(e.key==='='||e.key==='+'){e.preventDefault();dZoom(1);return;}
      if(e.key==='-'||e.key==='_'){e.preventDefault();dZoom(-1);return;}
      if(e.key==='d'||e.key==='D'){e.preventDefault();dDuplicateLayer();return;}
      if(!e.shiftKey&&(e.key==='g'||e.key==='G')){e.preventDefault();dGroupSelected();return;}
      if(e.shiftKey&&(e.key==='g'||e.key==='G')){e.preventDefault();dUngroupSelected();return;}
    }
    if(inField)return; // resto bloqueia se em input
    // Ctrl+C / Ctrl+V — copiar/colar layers (só no canvas, nunca dentro de campos de texto)
    if((e.ctrlKey||e.metaKey)&&(e.key==='c'||e.key==='C')){e.preventDefault();dCopy();return;}
    if((e.ctrlKey||e.metaKey)&&(e.key==='v'||e.key==='V')){e.preventDefault();dPaste(e.altKey||e.shiftKey);return;} // Alt/Shift = colar no mesmo lugar
    if(e.ctrlKey||e.metaKey||e.altKey)return; // outros combos com modificador NÃO disparam atalhos de ferramenta (evita Ctrl+R/T/P/M... trocarem a tool)
    if(e.key==='Escape'){dCloseVarModal();dSetTool('select');}
    if((e.key==='Delete'||e.key==='Backspace')&&dTool!=='brush'&&dTool!=='eraser')dDeleteLayer();
    if(e.key==='Delete'&&(dTool==='brush'||dTool==='eraser'))dClearPaint();
    if(e.key==='Escape')dStampSource=null; // Esc limpa stamp source
    if(e.key==='v'||e.key==='V'){
      if(e.shiftKey){
        dSetTool(dTool==='artboard'?'select':'artboard');
      } else {
        dSetTool('select');
      }
    }
    if(e.key==='F2'){
      if(typeof dActiveABId!=='undefined'&&dActiveABId&&dSelId===null&&(!dMultiSel||dMultiSel.length===0)){
        e.preventDefault();
        if(typeof dRenameAB==='function')dRenameAB(dActiveABId);
        return;
      }
    }
    if(e.key===' '){
      if(dTool!=='hand'){
        dPrevToolForSpace = dTool;
        dSetTool('hand');
      }
      e.preventDefault();
      return;
    }
    if(e.key==='h'||e.key==='H')dSetTool('hand');     // H = Hand/Mão
    if(e.key==='o'||e.key==='O')dSetTool('ellipse');  // O = Elipse
    if(e.key==='x'||e.key==='X'){
      if (typeof dDataActivate === 'function') dDataActivate(); else dSetTool('var-data');
    }
    if(e.key==='q'||e.key==='Q')dSetTool('qr-code');  // Q = QR Code
    if(e.key==='l'||e.key==='L'){
      if (typeof dToggleResources === 'function') dToggleResources();
    }
    if(e.key==='t'||e.key==='T'){ if(typeof dTextActivate==='function') dTextActivate(); else dSetTool('text'); }     // T = Texto
    if(e.key==='r'||e.key==='R')dSetTool('rect');     // R = Retângulo
    if(e.key==='f'||e.key==='F')dSetTool('frame');    // F = Moldura
    if(e.key==='m'||e.key==='M')dSetTool('img');      // M = Imagem
    if(e.key==='b'||e.key==='B')dSetTool('brush');    // B = Pincel
    if(e.key==='i'||e.key==='I')dSetTool('eyedrop');  // I = Eyedropper
    if(e.key==='g'&&!e.ctrlKey)dSetTool('bucket');    // G = Bucket (paint bucket)
    if(e.key==='e'||e.key==='E')dSetTool('eraser');   // E = Borracha
    if(e.key==='s'||e.key==='S'){
      // Se já tem layer selecionado, capturar como source ANTES de ativar a tool
      if(dSelId){
        const l=dLayers.find(x=>x.id===dSelId);
        if(l){dStampSource=l;gToast('Source: "'+l.name+'" — agora clique em outro layer para clonar');}
      }
      dSetTool('stamp');
    }
    if(e.key==='p'||e.key==='P')dPreviewOpen();
    if(e.key==='?'||(e.shiftKey&&e.key==='/')){e.preventDefault();dOpenCheat();}
    // (dClearPaint já tratado acima)
    // Mover layer com setas
    if(dSelId&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
      e.preventDefault();
      const l=dLayers.find(x=>x.id===dSelId);if(!l)return;
      const step=e.shiftKey?10:1;
      if(e.key==='ArrowUp')l.y-=step;
      if(e.key==='ArrowDown')l.y+=step;
      if(e.key==='ArrowLeft')l.x-=step;
      if(e.key==='ArrowRight')l.x+=step;
      dRenderCanvas();
      if(document.getElementById('dp-x')){document.getElementById('dp-x').value=l.x;document.getElementById('dp-y').value=l.y;}
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


