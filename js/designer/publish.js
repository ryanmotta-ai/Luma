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
  if(typeof dSyncLayersToAB==='function') dSyncLayersToAB();
  const _ab=dGetActiveAB();
  if(!dLayers||!dLayers.length){gToast('Adicione camadas antes de publicar.');return;}
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
    ?`<span class="pub-pill pub-pill-on">● Publicado anteriormente</span>`
    :`<span class="pub-pill pub-pill-off">○ Não publicado</span>`;

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

  // Atualiza o resumo no rodapé da aba Checklist
  const summaryEl = document.getElementById('d-pub-linter-summary');
  if (summaryEl) {
    if (linterStats.errorsCount > 0) {
      summaryEl.innerHTML = `<span style="color:#ef4444;font-weight:700">🔴 ${linterStats.errorsCount} erro(s) crítico(s) detectado(s).</span>`
        + `<span style="font-size:11px;color:#aaa">Corrija os erros listados para liberar a publicação.</span>`;
    } else if (linterStats.warningsCount > 0) {
      summaryEl.innerHTML = `<span style="color:#f59e0b;font-weight:700">🟡 ${linterStats.warningsCount} alerta(s) de Safe Zone / respiro pendente(s).</span>`
        + `<span style="font-size:11px;color:#aaa">Publicação liberada com ressalvas.</span>`;
    } else {
      summaryEl.innerHTML = `<span style="color:#10b981;font-weight:700">🟢 Pronto: Nenhuma inconformidade de layout encontrada.</span>`
        + `<span style="font-size:11px;color:#aaa">Campanha validada com sucesso.</span>`;
    }
  }

  // Desabilita/Habilita botão de publicação final
  const confirmBtn = document.querySelector('.pub-btn-confirm');
  if (confirmBtn) {
    if (linterStats.errorsCount > 0) {
      confirmBtn.disabled = true;
      confirmBtn.style.opacity = '0.5';
      confirmBtn.style.cursor = 'not-allowed';
      confirmBtn.title = 'Corrija os erros críticos no Checklist para liberar a publicação.';
    } else {
      confirmBtn.disabled = false;
      confirmBtn.style.opacity = '1';
      confirmBtn.style.cursor = 'pointer';
      confirmBtn.title = '';
    }
  }

  // Abre na aba de checklist inicialmente
  const firstBtn=document.querySelector('.pub-tab');
  if(firstBtn) dPublishSwitchTab('linter', firstBtn);
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
}

/* ── PRESETS DE PERMISSÃO + APLICAR À CAMPANHA INTEIRA ──
   Governança: define o trilho de permissão uma vez e replica em todos os materiais da
   pasta (consistência de marca) sem refazer campo a campo. Presets ficam no localStorage. */
function _dPermPresets(){
  try{ const r=localStorage.getItem('_luma_perm_presets'); const s=r?JSON.parse(r):null; return (s&&Array.isArray(s.entries))?s.entries:[]; }catch(e){ return []; }
}
function _dPermBar(){
  const opts=_dPermPresets().map(p=>`<option value="${gEsc(p.id)}">${gEsc(p.name)}</option>`).join('');
  return `<div class="pub-perm-presets" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--d-border2,rgba(255,255,255,.12))">
    <select onchange="dPermPresetLoad(this.value)" style="font-size:12px;padding:6px 8px;border:1px solid var(--d-border2,rgba(255,255,255,.14));border-radius:6px;background:var(--d-surf,#222);color:var(--d-text,#eee);outline:none;cursor:pointer"><option value="">Aplicar preset…</option>${opts}</select>
    <button type="button" class="d-btn-sec" onclick="dPermPresetSave()">Salvar preset</button>
    <button type="button" class="d-btn-sec" onclick="dPermApplyToFolder()" title="Copia estas permissões para todos os materiais desta campanha">Aplicar a toda a campanha</button>
  </div>`;
}
function dPermPresetSave(){
  const name=prompt('Nome do preset de permissões (ex.: "Preços travados, produto livre"):');
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
  gToast('✓ Preset aplicado a este material');
}
function dPermApplyToFolder(){
  const info=(typeof _dPubFindTmpl==='function')?_dPubFindTmpl():null;
  const folder=info&&info.folder;
  if(!folder||!Array.isArray(folder.templates)||folder.templates.length<2){ gToast('Esta campanha não tem outros materiais pra aplicar.'); return; }
  if(!confirm(`Aplicar estas permissões a TODOS os ${folder.templates.length} materiais desta campanha?`)) return;
  const perms=JSON.parse(JSON.stringify(dPubPermissoes));
  folder.templates.forEach(t=>{
    if(!t.publishMeta) t.publishMeta={};
    // merge: preserva o que o material já tinha, o preset sobrescreve/adiciona.
    t.publishMeta.permissoes=Object.assign({}, t.publishMeta.permissoes||{}, JSON.parse(JSON.stringify(perms)));
    t._syncPending=true;
  });
  if(typeof dPersistFolders==='function') dPersistFolders();
  gToast('✓ Permissões aplicadas a '+folder.templates.length+' materiais da campanha');
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
      gToast(''+count+' prancheta'+(count!==1?'s':'')+' publicada'+(count!==1?'s':'')+' com sucesso!');
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
  - Ctrl+V / Cmd+V          : Colar Camada(s) (bloqueado em campos de texto)

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
    if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) { e.preventDefault(); dPaste(e.altKey || e.shiftKey); return; } // Alt/Shift = colar no mesmo lugar
    if (e.ctrlKey || e.metaKey || e.altKey) return; // outros combos com modificador NÃO disparam atalhos de ferramenta

    if (e.key === 'Escape') { dCloseVarModal(); dSetTool('select'); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && dTool !== 'brush' && dTool !== 'eraser') dDeleteLayer();
    if (e.key === 'Delete' && (dTool === 'brush' || dTool === 'eraser')) dClearPaint();
    if (e.key === 'Escape') { dStampSource = null; if(typeof dStampUpdateStatus==='function') dStampUpdateStatus(); } // Esc limpa stamp source
    // [ e ] ajustam o tamanho do pincel (Shift = passo 10) quando ferramenta de pintura ativa
    if ((e.key === '[' || e.key === ']') && ['brush','eraser','smudge','blur','sharpen'].includes(dTool) && typeof dBrushNudgeSize === 'function') {
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

    // F2 - Renomeação
    if (e.key === 'F2') {
      e.preventDefault();
      if (dSelId !== null) {
        if (typeof dRenameLayer === 'function') dRenameLayer(dSelId, e);
      } else if (typeof dActiveABId !== 'undefined' && dActiveABId) {
        if (typeof dRenameAB === 'function') dRenameAB(dActiveABId);
      }
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
        const order = ['text-h', 'text-v', 'mask-text-h', 'mask-text-v'];
        let idx = order.indexOf(dTool);
        if (idx === -1) idx = 0;
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
      if (e.key === 'ArrowUp') l.y -= step;
      if (e.key === 'ArrowDown') l.y += step;
      if (e.key === 'ArrowLeft') l.x -= step;
      if (e.key === 'ArrowRight') l.x += step;
      dRenderCanvas();
      if (document.getElementById('dp-x')) { document.getElementById('dp-x').value = l.x; document.getElementById('dp-y').value = l.y; }
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



/* -- TOOLBAR COLOR WIDGET (FG/BG) -- */
function dSwapColors() {
  const fgInp = document.getElementById('vt-color-fg-input');
  const bgInp = document.getElementById('vt-color-bg-input');
  if(!fgInp || !bgInp) return;
  const temp = fgInp.value;
  fgInp.value = bgInp.value;
  bgInp.value = temp;
  document.getElementById('vt-color-fg-ui').style.background = fgInp.value;
  document.getElementById('vt-color-bg-ui').style.background = bgInp.value;
  if(typeof dOnFgColorChange === 'function') dOnFgColorChange(fgInp.value);
}
function dDefaultColors() {
  const fgInp = document.getElementById('vt-color-fg-input');
  const bgInp = document.getElementById('vt-color-bg-input');
  if(!fgInp || !bgInp) return;
  fgInp.value = '#000000';
  bgInp.value = '#ffffff';
  document.getElementById('vt-color-fg-ui').style.background = '#000000';
  document.getElementById('vt-color-bg-ui').style.background = '#ffffff';
  if(typeof dOnFgColorChange === 'function') dOnFgColorChange('#000000');
}
// Sync tools that use color (like brush) when FG changes
function dOnFgColorChange(color) {
  // If brush tool is active and it has a color, maybe update it?
  // We removed d-brush-color-pick from brush opts since we use global FG color now.
  // We'll just define global variables if needed.
  window.dGlobalFgColor = color;
}
function dOnBgColorChange(color) {
  window.dGlobalBgColor = color;
}
