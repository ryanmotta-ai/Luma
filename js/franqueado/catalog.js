/**
 * js/franqueado/catalog.js
 *
 * Catalogo de campanhas: fRenderCatalogs, fFilterCamps, fSelectCamp,
 * fSwitchTab, fSetHistFilter, fRenderHist, fEditFromHist, fDuplicateInOtherFmt.
 * Depende de: 00-config.js, 01-state.js
 */

/* ── TABS ESQUERDA ── */
function fSwitchTab(tab,btn){
  fState.tab=tab;
  document.querySelectorAll('.f-tab').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  document.body.classList.toggle('f-history-mode',tab==='historico');
  const cat=document.getElementById('f-catalog'),hist=document.getElementById('f-hist-tab');
  const sr=document.getElementById('f-search-row'); // #f-fmt-wrap removido (seletor de formato aposentado)
  if(tab==='historico'){cat.style.display='none';hist.style.display='flex';sr.style.display='none';fRenderHist();}
  else{cat.style.display='block';hist.style.display='none';sr.style.display='';}
}

// F-08: filtro por status dentro do histórico
let fHistFilter = 'todos'; // 'todos' | 'rascunho' | 'baixada'
function fSetHistFilter(f, btn){
  fHistFilter = f;
  document.querySelectorAll('.hist-filter-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  fRenderHist();
}

// M1.3 — CTA do empty state: leva o franqueado de volta ao catálogo de campanhas
function fGoToCampaigns(){
  const catBtn=document.querySelector('.f-tab');
  fSwitchTab('catalogo', catBtn);
  fGoHome();
}
// Busca textual: casa o termo contra produto, campanha, formato, material e a data amigável.
function _fHistMatch(h, q){
  if(!q) return true;
  const hay=[h.prod,h.campName,h.fmtName,h.materialName,h.de,h.por,(typeof fFormatHistDate==='function'?fFormatHistDate(h.ts):'')]
    .filter(Boolean).join(' ').toLowerCase();
  return hay.includes(q);
}
function fRenderHist(){
  const all = fGetHist();
  const el = document.getElementById('f-hist-tab');
  const q = (fHistSearch||'').trim().toLowerCase();
  const byStatus = fHistFilter === 'todos' ? all : all.filter(h => (h.status||'rascunho') === fHistFilter);
  const filtered = q ? byStatus.filter(h=>_fHistMatch(h,q)) : byStatus;
  const counts = {
    todos: all.length,
    rascunho: all.filter(h=>(h.status||'rascunho')==='rascunho').length,
    baixada: all.filter(h=>h.status==='baixada').length,
  };
  const pageHead=`<header class="f-history-head">
    <div class="f-history-head-copy">
      <div class="f-history-kicker">Sua biblioteca criativa</div>
      <h1>Minhas artes <span>${all.length}</span></h1>
      <p>Continue um rascunho, reutilize uma criação ou baixe novamente.</p>
    </div>
    <div class="f-history-head-actions">
      <button class="f-history-help" type="button" onclick="gOpenHelp(this)" data-help-trigger aria-controls="g-help-modal" aria-expanded="false" aria-label="Abrir Central de Ajuda"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.3 2.3 0 1 1 3.6 1.9c-.9.6-1.4 1.1-1.4 2.1"/><path d="M12 17h.01"/></svg>Ajuda</button>
      <button class="f-history-home" type="button" onclick="fGoHome()" aria-label="Voltar ao início"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>Início</button>
      <button class="f-history-new" type="button" onclick="fGoToCampaigns()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Nova arte</button>
    </div>
  </header>`;
  const filterBar = `<div class="hist-filter-bar" aria-label="Filtrar artes por status">
    <button class="hist-filter-btn ${fHistFilter==='todos'?'active':''}" onclick="fSetHistFilter('todos',this)">Todas <span class="hist-filter-count">${counts.todos}</span></button>
    <button class="hist-filter-btn ${fHistFilter==='rascunho'?'active':''}" onclick="fSetHistFilter('rascunho',this)">Rascunhos <span class="hist-filter-count">${counts.rascunho}</span></button>
    <button class="hist-filter-btn ${fHistFilter==='baixada'?'active':''}" onclick="fSetHistFilter('baixada',this)">Baixadas <span class="hist-filter-count">${counts.baixada}</span></button>
  </div>`;
  // Busca só aparece quando há histórico (não polui o empty state). Reidrata o valor
  // digitado e mantém o foco no fim, já que re-renderizamos o container inteiro a cada tecla.
  const searchBar = all.length ? `<div class="hist-search-row">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
    <input id="f-hist-search" type="search" aria-label="Buscar nas minhas artes" placeholder="Buscar por produto, campanha, data…" value="${gEsc(fHistSearch||'')}" oninput="fSetHistSearch(this.value)"/>
  </div>` : '';
  const toolbar=all.length?`<div class="f-history-toolbar">${searchBar}${filterBar}</div>`:'';
  if(!all.length){
    el.innerHTML = `<div class="f-history-shell">${pageHead}<div class="empty-state f-history-empty">
      <div class="empty-icon">
        <img src="assets/illustrations/empty_arts.png" alt="Uma tela pronta para receber sua primeira arte">
      </div>
      <div class="empty-title">Sua primeira criação começa por uma campanha</div>
      <div class="empty-text">Escolha um material, personalize com a ajuda da Luma e encontre o resultado sempre aqui.</div>
      <button class="empty-cta" onclick="fGoToCampaigns()">Explorar campanhas</button>
    </div></div>`;
    return;
  }
  if(!filtered.length){
    const emptyBody = q
      ? `<div class="empty-title">Nada encontrado para “${gEsc(fHistSearch.trim())}”</div>
         <div class="empty-text">Tente outro produto, campanha ou data.</div>
         <button class="empty-cta ghost" onclick="fSetHistSearch('')">Limpar busca</button>`
      : `<div class="empty-title">Nenhuma arte ${fHistFilter==='rascunho'?'em rascunho':'baixada ainda'}</div>
         <div class="empty-text">${fHistFilter==='rascunho'?'Os rascunhos que você começar aparecem aqui.':'Baixe uma arte e ela fica registrada aqui.'}</div>
         <button class="empty-cta ghost" onclick="fSetHistFilter('todos',document.querySelector('.hist-filter-btn'))">Ver todas</button>`;
    el.innerHTML = `<div class="f-history-shell">${pageHead}${toolbar}<div class="empty-state empty-state-sm f-history-empty">
      <div class="empty-icon">
        <img src="assets/illustrations/empty_filtered.png" alt="Nenhuma arte encontrada com os filtros atuais">
      </div>
      ${emptyBody}
    </div></div>`;
    _fHistRestoreSearchFocus();
    return;
  }
  const cards=filtered.map(h=>{
    const isRascunho = (h.status||'rascunho') === 'rascunho';
    const statusBadge = isRascunho
      ? `<span class="hist-badge-st rascunho">rascunho</span>`
      : `<span class="hist-badge-st baixada">baixada</span>`;
    const dateStr = fFormatHistDate(h.ts);
    const artName=h.materialName ? h.materialName : ((h.prod||'Arte')+' · '+(h.fmtName||''));
    return `<article class="hist-card" data-status="${h.status||'rascunho'}">
      <div class="hist-thumb" style="background:${gEsc(h.campColor||'var(--dm-orange)')}">
        <span class="hist-thumb-camp">${gEsc(h.campName||'Luma')}</span>
        <strong>${gEsc(h.prod||h.campName||'Sua arte')}</strong>
        ${h.por?`<span class="hist-thumb-offer">${gEsc(h.por)}</span>`:''}
        <span class="hist-thumb-fmt">${gEsc(h.fmtName||'Material')}</span>
      </div>
      <div class="hist-info">
        <div class="hist-card-top">${statusBadge}<time>${dateStr}</time></div>
        <div class="hist-name">${gEsc(artName)}</div>
        <div class="hist-meta"><span>${gEsc(h.campName)}</span><span class="hist-meta-sep">·</span><span>${gEsc(h.fmtName)}</span></div>
        <div class="hist-actions">
          <button class="hist-act-btn hist-act-main" onclick="fEditFromHist(${h.id},this)" title="Abrir e editar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>${isRascunho?'Continuar':'Editar'}</button>
          <button class="hist-act-btn" onclick="fDuplicateInOtherFmt(${h.id})" title="Gerar em outro formato"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Duplicar</button>
          <button class="hist-act-btn hist-act-download" onclick="fDownloadHist(${h.id})" title="Baixar PNG" aria-label="Baixar ${gEsc(artName)}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><polyline points="7 10 12 15 17 10"/><path d="M5 21h14"/></svg></button>
        </div>
      </div>
    </article>`;
  }).join('');
  el.innerHTML=`<div class="f-history-shell">${pageHead}${toolbar}<div class="f-history-results"><div class="f-history-results-head"><span>${filtered.length} ${filtered.length===1?'arte':'artes'}</span><span>Mais recentes primeiro</span></div><div class="f-history-grid">${cards}</div></div></div>`;
  _fHistRestoreSearchFocus();
}
// Re-renderizamos o container inteiro a cada tecla → o input perde o foco/cursor.
// Devolvemos o foco ao fim do texto só quando há busca ativa (não rouba foco à toa).
function _fHistRestoreSearchFocus(){
  if(!fHistSearch) return;
  const inp=document.getElementById('f-hist-search');
  if(inp && document.activeElement!==inp){ inp.focus(); const n=inp.value.length; try{ inp.setSelectionRange(n,n); }catch(e){} }
}

async function fDownloadHist(id){
  const h=fGetHist().find(x=>x.id===id);if(!h)return;
  const all=[...CAMPS_ATIVAS,...CAMPS_OUTRAS];
  const c=all.find(x=>x.id===h.campId)||{id:h.campId,name:h.campName,color:h.campColor,perguntas:[]};
  const f=FMTS.find(x=>x.id===h.fmtId)||FMTS[0];
  // Carrega material original se ainda existir (pra renderer usar layers reais)
  const prevMaterial = fState.material;
  if(h.materialId && typeof dFolders !== 'undefined' && dFolders){
    for(const folder of dFolders){
      const t = folder.templates.find(x=>x.id===h.materialId);
      if(t){ fState.material = t; break; }
    }
  }
  if(fState.material && typeof fEnsureMaterialLayers==='function') await fEnsureMaterialLayers(fState.material);
  try {
    await fGenPNG(h.dados,c,f);
  } catch(e) {
    gToast('⚠ Não foi possível baixar a arte. Tente de novo','error');
    return; // não marca "baixada" nem toast de sucesso se o PNG não saiu
  } finally {
    fState.material = prevMaterial; // restaura sempre, mesmo se fGenPNG lançar
  }
  fMarkHistBaixada(id);
  fRenderHist();
  if(typeof gTrackEvent==='function') gTrackEvent('arte_baixada',{camp_id:h.campId,fmt:h.fmtId,tipo:'png',origem:'historico'});
  gToast('Arte baixada!');
}

// F-04: retomar uma entrada do histórico no chat, com dados pré-preenchidos
async function fEditFromHist(id, btn){
  const h = fGetHist().find(x=>x.id===id);
  if(!h) return;
  const all = [...CAMPS_ATIVAS, ...CAMPS_OUTRAS];
  const c = all.find(x=>x.id===h.campId);
  if(!c){ gToast('Campanha original não encontrada.'); return; }
  const f = FMTS.find(x=>x.id===h.fmtId) || FMTS[0];
  // Volta pra aba de catálogo pra mostrar o chat
  const catTabBtn = document.querySelector('.f-tab');
  if(catTabBtn) fSwitchTab('catalogo', catTabBtn);

  // Se o histórico tem materialId, tenta carregar o material original
  let material = null;
  if(h.materialId && typeof dFolders !== 'undefined' && dFolders){
    for(const folder of dFolders){
      const t = folder.templates.find(x=>x.id===h.materialId);
      if(t){ material = t; break; }
    }
  }
  // Template sincronizado do backend pode estar sem layers (lazy) — baixa antes de montar as perguntas
  if(material && typeof fEnsureMaterialLayers==='function'){
    const restoreBtn=(material._needsLayersFetch && typeof gBtnLoading==='function') ? gBtnLoading(btn,'Abrindo…') : ()=>{};
    try{ await fEnsureMaterialLayers(material); }
    finally{ restoreBtn(); }
    if(material._needsLayersFetch) material = null; // fetch falhou → segue pro fallback (estrutura padrão)
  }

  if(material){
    // Carrega via fluxo de material (reconstrói perguntas das vars + permissões)
    fState.camp = c;
    fState.material = material;
    fState.materialView = false;
    fState.fmt = f;
    fState.editIdx = null;
    fState.done = false;
    // Reconstrói perguntas via mesma lógica do fSelectMaterial
    const vars = dExtractTemplateVars(material.layers);
    const permissoes = material.publishMeta?.permissoes || {};
    const imgVars = fMaterialImageVars(material.layers); // mesma detecção do fSelectMaterial (M14)
    const perguntas=[];
    vars.forEach(v=>{
      const perm = permissoes[v];
      if(perm && perm.edit === false) return;
      const vDef = (typeof dVars !== 'undefined' && dVars) ? dVars.find(x=>x.name===v) : null;
      const label = vDef ? vDef.label : v.replace(/_/g,' ');
      const isImage = (vDef ? vDef.type==='image' : false) || imgVars.has(v);
      if(isImage){
        perguntas.push({id:v, texto:`Envie a <strong>${gEsc(label.toLowerCase())}</strong>`, sugestoes:[], isImage:true, label, maxLen:0});
      } else {
        perguntas.push({id:v, texto:`Qual é o <strong>${gEsc(label.toLowerCase())}</strong>?`, sugestoes:fGetSuggestionsForVar(v, c), maxLen:perm?.maxLen||32, label});
      }
    });
    fState.camp = {...c, perguntas, materialName: material.name};
    fState.dados = {...h.dados};
    fState.stepIdx = perguntas.length;
    fRenderCategorias();
    fRenderFmts();
    fUpdateCtx();
    document.getElementById('f-messages').innerHTML='';
    fUpdateProg();
    try { fUpdateLivePreview(); } catch(e){}
    try { fAttachInputGuard(); } catch(e){}
    fAddBot(`Reabri sua arte de <strong>${gEsc(material.name)}</strong> (${gEsc(f.name)}). Os campos editáveis foram restaurados.`, []);
    setTimeout(()=>fMostrarConfirm(), 700);
    return;
  }

  // Fallback: material não encontrado (despublicado/excluído). Reconstrói as perguntas
  // a partir das CHAVES de h.dados (M13) — c.perguntas pode ter ids diferentes dos dados salvos.
  fState.material = null;
  fState.materialView = false;
  fState.fmt = f;
  fState.done = false;
  fState.editIdx = null;
  const fbLabels={produto:'Produto',precoDe:'Preço original',precoPor:'Preço promo',validade:'Validade',desconto:'Desconto',pedidoMin:'Pedido mínimo',bairros:'Cobertura',codigo:'Código',condicao:'Condição',brinde:'Brinde',categoria:'Categoria',oferta:'Oferta'};
  const dadosKeys = Object.keys(h.dados||{});
  let fbPerguntas;
  if(dadosKeys.length){
    fbPerguntas = dadosKeys.map(k=>{
      const val = h.dados[k];
      const isImg = typeof val==='string' && val.startsWith('data:image');
      const vDef = (typeof dVars!=='undefined' && dVars) ? dVars.find(x=>x.name===k) : null;
      const label = (vDef && vDef.label) || fbLabels[k] || k.replace(/_/g,' ');
      if(isImg) return {id:k, texto:`Envie a <strong>${gEsc(label.toLowerCase())}</strong>`, sugestoes:[], isImage:true, label, maxLen:0};
      return {id:k, texto:`Qual é o <strong>${gEsc(label.toLowerCase())}</strong>?`, sugestoes:fGetSuggestionsForVar(k, c), maxLen:32, label};
    });
  } else {
    fbPerguntas = c.perguntas; // sem dados salvos → usa as perguntas da campanha
  }
  fState.camp = {...c, perguntas: fbPerguntas};
  fState.dados = {...h.dados};
  fState.stepIdx = fbPerguntas.length;
  fRenderCatalogs(CAMPS_ATIVAS, CAMPS_OUTRAS);
  fRenderFmts();
  fUpdateCtx();
  document.getElementById('f-messages').innerHTML='';
  fUpdateProg();
  try { fUpdateLivePreview(); } catch(e){}
  try { fAttachInputGuard(); } catch(e){}
  const msg = h.materialName
    ? `Reabri sua arte (material original "${gEsc(h.materialName)}" não está mais disponível, usando estrutura padrão).`
    : `Reabri sua arte de <strong>${gEsc(c.name)}</strong> (${gEsc(f.name)}). Você pode editar qualquer campo ou gerar de novo direto.`;
  fAddBot(msg, []);
  setTimeout(()=>fMostrarConfirm(), 700);
}

// F-04: duplicar a arte em outro formato sem refazer perguntas
function fDuplicateInOtherFmt(id){
  const h = fGetHist().find(x=>x.id===id);
  if(!h) return;
  const all = [...CAMPS_ATIVAS, ...CAMPS_OUTRAS];
  const c = all.find(x=>x.id===h.campId) || {id:h.campId,name:h.campName,color:h.campColor,perguntas:[]};
  // Sugere o próximo formato (rotaciona)
  const idx = FMTS.findIndex(f=>f.id===h.fmtId);
  const next = FMTS[(idx + 1) % FMTS.length];
  // Confirmação inline na aba do histórico
  const card = document.querySelector(`.hist-card [onclick*="fDuplicateInOtherFmt(${id})"]`)?.closest('.hist-card');
  if(card && !card.querySelector('.hist-dup-bar')){
    const bar = document.createElement('div');
    bar.className = 'hist-dup-bar';
    const fmtAtual=FMTS.find(f=>f.id===h.fmtId);
    bar.innerHTML = `<span>Gerar de novo em:</span>` +
      // Mesmo formato = regerar a arte como está (útil após editar preço/validade pelo "Editar").
      (fmtAtual?`<button class="hist-dup-btn" onclick="fConfirmDuplicate(${id},'${fmtAtual.id}')">${gEsc(fmtAtual.name)} (mesmo)</button>`:'') +
      FMTS.filter(f=>f.id !== h.fmtId).map(f=>
        `<button class="hist-dup-btn" onclick="fConfirmDuplicate(${id},'${f.id}')">${gEsc(f.name)}</button>`
      ).join('') +
      `<button class="hist-dup-cancel" onclick="this.parentElement.remove()">cancelar</button>`;
    card.appendChild(bar);
  }
}
async function fConfirmDuplicate(id, fmtId){
  const h = fGetHist().find(x=>x.id===id);
  if(!h) return;
  const all = [...CAMPS_ATIVAS, ...CAMPS_OUTRAS];
  const c = all.find(x=>x.id===h.campId) || {id:h.campId,name:h.campName,color:h.campColor,perguntas:[]};
  const f = FMTS.find(x=>x.id===fmtId) || FMTS[0];
  // Carrega material original se ainda existir
  const prevMaterial = fState.material;
  if(h.materialId && typeof dFolders !== 'undefined' && dFolders){
    for(const folder of dFolders){
      const t = folder.templates.find(x=>x.id===h.materialId);
      if(t){ fState.material = t; break; }
    }
  }
  if(fState.material && typeof fEnsureMaterialLayers==='function') await fEnsureMaterialLayers(fState.material);
  try {
    await fGenPNG(h.dados, c, f);
    fAddHist(h.dados, c, f, 'baixada'); // só registra se o PNG saiu (material ainda carregado aqui)
  } catch(e) {
    gToast('⚠ Não foi possível duplicar a arte. Tente de novo','error');
    return;
  } finally {
    fState.material = prevMaterial; // restaura sempre, mesmo se fGenPNG lançar
  }
  fRenderHist();
  gToast(`Duplicada em ${f.name}!`);
}

/* ── CATÁLOGO ── */
// Acha a pasta (dFolders) ligada a uma campanha — por campId ou nome
function fFolderForCamp(c){
  if(typeof dFolders==='undefined'||!dFolders||!c)return null;
  // 3º match: campanha dinâmica (criada no Estúdio) usa o id da própria pasta como camp.id
  return dFolders.find(f=>f.campId===c.id) || dFolders.find(f=>f.name===c.name)
      || dFolders.find(f=>f.remoteId===c.id||f.id===c.id) || null;
}
// Capa da pasta — usada como fundo do card.
// Pasta EXISTENTE no catálogo manda (gerida pelo MKT no Estúdio/banco): cover vazio
// significa "sem capa de propósito" (remoção) → cor da marca/thumb, NUNCA o hardcode.
// O c.cover estático do config é só semente para campanha ainda sem pasta (1ª carga).
function fCampCover(c){
  const f=fFolderForCamp(c);
  if(f){
    const cv=f.cover;
    return (cv&&typeof cv==='string'&&cv!=='__local__'&&cv.length)?cv:'';
  }
  return (c&&c.cover&&typeof c.cover==='string'&&c.cover.length)?c.cover:'';
}
/* ── MINIATURAS REAIS DOS MATERIAIS ──────────────────────────────
   O card da campanha mostra o material publicado de verdade: o 1º material
   válido é renderizado em miniatura pelo MESMO motor do PNG final
   (fRenderTemplateLayers) e cacheado por campanha. O HTML sai na hora com a
   cor da marca; a fila assíncrona pinta a capa real quando o render termina.
   Prioridade de capa: upload do designer > miniatura renderizada > cor. */
let _fCampThumbs={};      // campId → {mid: chave do material renderizado, url: dataURL}
let _fCampThumbBusy=false;
let _fCampThumbsLoaded=false; // cache persistido (IndexedDB) já carregado?

function _fCampThumbMaterial(c){
  if(typeof fGetMaterialsForCamp!=='function'||!c)return null;
  // Agora permite templates que ainda não fizeram fetch das layers (_needsLayersFetch)
  const mats=fGetMaterialsForCamp(c.id).filter(t=>fIsMaterialValid(t)&&(t._needsLayersFetch || (t.layers&&t.layers.length)));
  return mats[0]||null;
}
function _fCampThumbURL(id){
  const e=_fCampThumbs[id];
  return (e&&e.url&&e.url!=='__fail__')?e.url:'';
}
// Chave de frescor do thumb: id + data de publicação. Republicar o material muda a
// chave → thumb re-renderiza. Permite persistir o cache entre sessões sem servir capa velha.
function _fCampThumbMid(t){
  return t.id+':'+((t.publishMeta&&t.publishMeta.publicadoEm)||0);
}
// Precisa renderizar? (sem cache, ou o material publicado mudou desde o cache)
function _fCampThumbNeeded(c){
  const t=_fCampThumbMaterial(c); if(!t)return false;
  const e=_fCampThumbs[c.id];
  return !e||e.mid!==_fCampThumbMid(t);
}
// Persiste no IndexedDB só os thumbs que renderizaram ('__fail__' fica de fora — re-tenta
// na próxima sessão). Sem isso, cada abertura do app re-baixaria os layers pros thumbs.
function _fCampThumbsPersist(){
  if(typeof gIdbPut!=='function')return;
  try{
    const ok={};
    for(const k in _fCampThumbs){ const e=_fCampThumbs[k]; if(e&&e.url&&e.url!=='__fail__') ok[k]=e; }
    gIdbPut('__f_camp_thumbs__', ok);
  }catch(e){}
}
async function _fRenderCampThumb(c,t){
  // Lazy Load discreto se o template for virgem de layers (mesmo helper do clique, com dedup)
  if(typeof fEnsureMaterialLayers==='function') await fEnsureMaterialLayers(t);

  const [tw,th]=fMaterialSize(t);
  const s=Math.min(1,360/tw); // miniatura ~360px de largura — nítida no card, leve na memória
  const cv=document.createElement('canvas');
  cv.width=Math.max(1,Math.round(tw*s));cv.height=Math.max(1,Math.round(th*s));
  const ctx=cv.getContext('2d');
  ctx.scale(s,s);
  ctx.fillStyle=c.color||'#FF9000';ctx.fillRect(0,0,tw,th); // JPEG não tem alpha — nunca fundo preto
  const prev=fState.material;
  fState.material=t; // o motor lê bg/tamanho do fState (mesmo padrão do fDownloadHist)
  try{ await fRenderTemplateLayers(ctx,t.layers||[],tw,th,{},c); }
  finally{ if(fState.material===t)fState.material=prev; } // não sobrescreve escolha feita no meio
  return cv.toDataURL('image/jpeg',.85);
}
// Fila: pinta as capas pendentes uma a uma (só enquanto a home está aberta)
async function fHomeFillThumbs(){
  if(_fCampThumbBusy)return;
  _fCampThumbBusy=true;
  try{
    // 1º uso na sessão: recupera thumbs renderizados em sessões anteriores (IndexedDB)
    if(!_fCampThumbsLoaded){
      _fCampThumbsLoaded=true;
      if(typeof gIdbGet==='function'){
        try{ const saved=await gIdbGet('__f_camp_thumbs__'); if(saved&&typeof saved==='object') _fCampThumbs={...saved,..._fCampThumbs}; }catch(e){}
      }
    }
    let node, rendered=false;
    while((node=document.querySelector('#f-home [data-thumb-camp]'))){
      if(!document.body.classList.contains('f-home-mode'))break;
      const id=node.getAttribute('data-thumb-camp');
      const c=fResolveCamp(id);
      const t=c&&_fCampThumbMaterial(c);
      if(t&&_fCampThumbNeeded(c)){
        let url='__fail__';
        try{
          if(typeof fEnsureMaterialLayers==='function') await fEnsureMaterialLayers(t); // catálogo leve
          if(t.layers&&t.layers.length) url=await _fRenderCampThumb(c,t);
        }catch(e){}
        _fCampThumbs[id]={mid:_fCampThumbMid(t),url};
        if(url!=='__fail__')rendered=true;
        await new Promise(r=>setTimeout(r,40)); // respiro entre renders — não trava a aba
      }
      document.querySelectorAll(`#f-home [data-thumb-camp="${id}"]`).forEach(n=>_fPaintCampThumb(n,id));
    }
    if(rendered)_fCampThumbsPersist();
  } finally { _fCampThumbBusy=false; }
}
function _fPaintCampThumb(node,id){
  node.removeAttribute('data-thumb-camp'); // sempre limpa — a fila não pode girar em falso
  const url=_fCampThumbURL(id);
  if(!url)return;
  if(node.classList.contains('fh-hero-cover')){
    node.style.backgroundImage=`url('${url}')`;
  }else{
    node.style.backgroundImage=`url('${url}')`;
  }
  node.style.backgroundSize='cover';
  node.style.backgroundPosition='center';
  node.classList.add('has-cover','thumb-real');
}

function fCampEl(c,isRec,ghost){
  // F-06: thumb mostra prévia real com produto e preço
  const previewProd = c.previewProd || c.name;
  const previewPor = c.previewPor || '';
  const previewDe = c.previewDe || '';
  // Capa: upload do designer > miniatura renderizada em cache > cor da marca
  const cover = fCampCover(c) || _fCampThumbURL(c.id);
  // Degradação graciosa: a cor da campanha fica POR BAIXO da imagem — se a capa faltar (404),
  // o card mostra a cor da marca em vez de um retângulo branco.
  // Scrim (gradiente topo+base) por cima da capa → badges legíveis mesmo em fotos claras.
  const thumbStyle = cover
    ? `background-color:${c.color};background-image:url('${gEsc(cover)}');background-size:cover;background-position:center`
    : `background:${c.color}`;
  const mats = (typeof fGetMaterialsForCamp==='function') ? fGetMaterialsForCamp(c.id) : [];
  const countLabel = ghost ? 'Materiais em breve' : (mats.length ? `${mats.length} ${mats.length!==1?'materiais':'material'}` : 'Sem materiais');
  const thumbAttr = (!cover && !ghost && _fCampThumbNeeded(c)) ? ` data-thumb-camp="${c.id}"` : '';
  const _icoFlame='<svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:-1px;margin-right:3px"><path d="M12 2s5 4 5 9a5 5 0 0 1-10 0c0-1 .3-2 .8-2.8C8 10 9 12 10 12c0-3 2-7 2-10z"/></svg>';
  const _icoClock='<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1px;margin-right:3px"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  // F: favorito (fixar no topo) + badge "novo" (material publicado depois da última visita).
  // "novo" cede espaço pra "Popular" (mesmo canto) — não empilha dois selos no topo-esq.
  const _isFav = !ghost && typeof fIsFav==='function' && fIsFav(c.id);
  const favBtn = ghost ? '' : `<button class="camp-fav${_isFav?' is-fav':''}" onclick="fToggleFav('${c.id}',event)" aria-pressed="${_isFav}" aria-label="${_isFav?'Remover das favoritas':'Fixar nas favoritas'}" title="${_isFav?'Remover das favoritas':'Fixar nas favoritas'}"><svg width="14" height="14" viewBox="0 0 24 24" fill="${_isFav?'currentColor':'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></button>`;
  const _hasNew = !ghost && !c.popular && typeof fCampHasNew==='function' && fCampHasNew(c);
  return `<div class="camp-card ${!ghost&&fState.camp&&c.id===fState.camp.id?'selected':''} ${isRec?'recommended':''}${ghost?' ghost':''}"${ghost?' aria-disabled="true"':` role="button" tabindex="0" aria-label="Abrir campanha ${gEsc(c.name)}" onclick="fSelectCamp('${c.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();fSelectCamp('${c.id}')}"`}>
    ${favBtn}
    ${ghost?'':`<div class="camp-prev-btn" onclick="event.stopPropagation();fOpenPreview(event,'${c.id}')">PRÉVIA</div>`}
    <div class="camp-thumb ${cover?'has-cover':''}"${thumbAttr} style="${thumbStyle}">
      ${c.badge?`<div class="camp-badge">${gEsc(c.badge)}</div>`:''}
      ${!ghost&&c.popular?`<div class="camp-popular">${_icoFlame}Popular</div>`:''}
      ${_hasNew?`<div class="camp-new">novo</div>`:''}
      ${!ghost&&c.expiraDias<=3?`<div class="camp-urgency">${_icoClock}${c.expiraDias}d</div>`:''}
      ${cover?'':`<div class="camp-thumb-prod">${gEsc(previewProd)}</div>
      ${previewDe?`<div class="camp-thumb-de">${gEsc(previewDe)}</div>`:''}
      ${previewPor?`<div class="camp-thumb-por">${gEsc(previewPor)}</div>`:''}
      <div class="camp-thumb-logo" role="img" aria-label="Luma"></div>`}
    </div>
    <div class="camp-body"><div class="camp-name">${gEsc(c.name)}</div><div class="camp-sub">${countLabel}</div></div>
  </div>`;
}
function fGetCampaigns(){
  // Config (CAMPS_*) é a BASE; pastas do banco sem campanha correspondente viram
  // campanhas dinâmicas na vitrine — o MKT cria a pasta no Estúdio e ela aparece
  // pro franqueado sem mexer em código. (Antes: só as hardcoded eram listadas, e
  // "criar campanha" no Estúdio não refletia em lugar nenhum do franqueado.)
  const ativas=[...CAMPS_ATIVAS];
  try{
    if(typeof dFolders!=='undefined' && dFolders){
      const conhecidas=[...CAMPS_ATIVAS,...CAMPS_OUTRAS];
      const ids=new Set(conhecidas.map(c=>c.id));
      const nomes=new Set(conhecidas.map(c=>c.name));
      dFolders.forEach(f=>{
        if(!f || f.id==='f-modelo') return;              // pasta de exemplo não é campanha
        if(f.campId && ids.has(f.campId)) return;        // já listada via config
        if(nomes.has(f.name)) return;                    // mesma campanha (match por nome)
        ativas.push({
          // remoteId (estável pós-sync) > id local; histórico/artes gravam este id
          id:f.campId||f.remoteId||f.id, name:f.name, color:f.color||'#FF9000',
          cover:'', count:(f.templates||[]).length, badge:f.badge||'',
          expiraDias:f.expiraDias, popular:!!f.popular,
          previewProd:f.previewProd||'', previewDe:f.previewDe||'', previewPor:f.previewPor||'',
          perguntas:Array.isArray(f.perguntas)?f.perguntas:[]
        });
      });
    }
  }catch(e){}
  return {ativas, outras:CAMPS_OUTRAS};
}
function fResolveCamp(id){
  const {ativas,outras}=fGetCampaigns();
  const pool=[...ativas,...outras];
  const allConst=[...CAMPS_ATIVAS,...CAMPS_OUTRAS,...CAMPS_IMPLEMENTACAO];
  return pool.find(x=>x.id===id)
      || pool.find(x=>x.campId===id)
      || allConst.find(x=>x.id===id)
      || null;
}

/* ── CATEGORIAS (CAMPANHAS / IMPLEMENTAÇÃO) ── */
const _ICO_BACK=`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`;
const _ICO_CHEV=`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

function fRenderCategorias(){
  const cat=document.getElementById('f-catalog'); if(!cat)return;
  fState.categoria=null;
  const nCamps=CAMPS_ATIVAS.length+CAMPS_OUTRAS.length;
  const nImpl=CAMPS_IMPLEMENTACAO.length;
  cat.innerHTML=`<div class="cat-grid">
    <div class="cat-card" onclick="fSelectCategoria('campanhas')">
      <div class="cat-card-thumb" style="background:linear-gradient(135deg,#FF9000,#C84B00)">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color:#fff"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>
      </div>
      <div class="cat-card-body">
        <div class="cat-card-title">Campanhas</div>
        <div class="cat-card-sub">${nCamps} campanhas disponíveis</div>
      </div>
      <div class="cat-card-chevron">${_ICO_CHEV}</div>
    </div>
    <div class="cat-card" onclick="fSelectCategoria('implementacao')">
      <div class="cat-card-thumb" style="background:linear-gradient(135deg,#2563eb,#1565C0)">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color:#fff"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>
      </div>
      <div class="cat-card-body">
        <div class="cat-card-title">Implementação</div>
        <div class="cat-card-sub">Para novos franqueados · ${nImpl} materiais</div>
      </div>
      <div class="cat-card-chevron">${_ICO_CHEV}</div>
    </div>
  </div>`;
}
function fSelectCategoria(cat){
  fState.categoria=cat;
  if(cat==='campanhas'){
    const {ativas,outras}=fGetCampaigns();
    fRenderCatalogs(ativas,outras);
  } else {
    fRenderImplementacao();
  }
}
function fVoltarCategoria(){
  fRenderCategorias();
}
function fRenderImplementacao(){
  const cat=document.getElementById('f-catalog'); if(!cat)return;
  cat.innerHTML=`
    <div class="cat-back-row">
      <button class="cat-back-btn" onclick="fVoltarCategoria()">${_ICO_BACK} Todas as categorias</button>
      <span class="cat-back-label">Implementação</span>
    </div>
    <div class="sec-title">Etapas de lançamento</div>
    <div class="camp-grid">${CAMPS_IMPLEMENTACAO.map(c=>fCampEl(c,false)).join('')}</div>`;
}
function fRestoreCatalog(){
  if(fState.categoria==='campanhas'){
    const {ativas,outras}=fGetCampaigns();
    fRenderCatalogs(ativas,outras);
  } else if(fState.categoria==='implementacao'){
    fRenderImplementacao();
  } else {
    fRenderCategorias();
  }
}

// Empty state do catálogo (busca sem resultado ou nenhuma campanha ativa). Reusa .empty-state.
function _fCampEmptyState(query){
  const ico='<div class="empty-icon"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></div>';
  if(query){
    return `<div class="empty-state empty-state-sm">${ico}
      <div class="empty-title">Nenhuma campanha encontrada</div>
      <div class="empty-text">Não achamos nada para “${gEsc(query)}”. Tente outro termo.</div>
      <button class="empty-cta ghost" onclick="var s=document.getElementById('f-search');if(s)s.value='';fFilterCamps('')">Limpar busca</button>
    </div>`;
  }
  return `<div class="empty-state empty-state-sm">${ico}
    <div class="empty-title">Nenhuma campanha ativa no momento</div>
    <div class="empty-text">Assim que houver campanhas disponíveis, elas aparecem aqui.</div>
  </div>`;
}
// Campanha AGENDADA pra data futura (designer definiu go-live) → ainda não aparece pro
// franqueado. A expiração (validade) já é tratada em materials.js; isto fecha a entrada.
function _fCampAgendadaFuturo(c){
  const f=(typeof fFolderForCamp==='function')?fFolderForCamp(c):null;
  const ag=f&&f.agendamento;
  if(!ag) return false;
  const d=new Date(String(ag)+'T00:00:00');
  if(isNaN(d.getTime())) return false;
  const hoje=new Date(); hoje.setHours(0,0,0,0);
  return d.getTime()>hoje.getTime();
}
function fRenderCatalogs(a,o,opts){
  a=(a||[]).filter(c=>!_fCampAgendadaFuturo(c));
  o=(o||[]).filter(c=>!_fCampAgendadaFuturo(c));
  opts=opts||{};
  const cat=document.getElementById('f-catalog'); if(!cat)return;
  const searching=!!opts.search;
  const backRow=`<div class="cat-back-row">
      <button class="cat-back-btn" onclick="fVoltarCategoria()">${_ICO_BACK} Todas as categorias</button>
      <span class="cat-back-label">Campanhas</span>
    </div>`;
  // Sem nenhuma campanha → empty state (nunca títulos sobre grid vazio)
  if(!a.length && !o.length){ cat.innerHTML=backRow+_fCampEmptyState(searching?opts.search:null); return; }
  // "Recomendada agora" só fora da busca (senão fica um título órfão)
  const rec=searching?null:(a.find(c=>c.popular)||null);
  cat.innerHTML=backRow+`
    ${rec?`<div class="sec-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:middle;margin-right:4px"><polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9"/></svg>Recomendada agora</div>
    <div class="camp-grid" id="camp-rec"></div>`:''}
    ${a.length?`<div class="sec-title">${searching?'Resultados':'Ativas agora'}</div><div class="camp-grid" id="camp-main"></div>`:''}
    ${o.length?`<div class="sec-title">${searching?'Outros resultados':'Outras campanhas'}</div><div class="camp-grid" id="camp-other"></div>`:''}`;
  if(rec) document.getElementById('camp-rec')?.insertAdjacentHTML('beforeend',fCampEl(rec,true));
  const main=document.getElementById('camp-main'); if(main) main.innerHTML=a.filter(c=>!rec||c.id!==rec.id).map(c=>fCampEl(c,false)).join('');
  if(o.length) document.getElementById('camp-other')?.insertAdjacentHTML('beforeend',o.map(c=>fCampEl(c,false)).join(''));
}
function fFilterCamps(q){
  if(fState.categoria!=='campanhas') return;
  const {ativas,outras}=fGetCampaigns();
  const qq=(q||'').trim().toLowerCase();
  if(!qq){ fRenderCatalogs(ativas,outras); return; }
  const f1=ativas.filter(c=>c.name.toLowerCase().includes(qq));
  const f2=outras.filter(c=>c.name.toLowerCase().includes(qq));
  // NÃO cai de volta em "ativas" quando não há match — mostra empty state honesto.
  fRenderCatalogs(f1,f2,{search:q});
}
function fSelectCamp(id){
  const c=fResolveCamp(id);if(!c)return;
  fExitHome(); // vindo da home → devolve o layout de 3 colunas antes de seguir o fluxo normal
  if(fState.camp && fState.camp.id===c.id) {
    if(fState.materialView) return;
  }
  const temDados = Object.keys(fState.dados).length > 0 && !fState.materialView;
  if(temDados && !fState.done){
    fAskCampSwitch(c);
    return;
  }
  fState.camp=c;
  // Vindo da home (categoria ainda null): abre o rail na lista certa, não nos cards de categoria
  if(!fState.categoria){
    const isImpl=(typeof CAMPS_IMPLEMENTACAO!=='undefined')&&CAMPS_IMPLEMENTACAO.some(x=>x.id===c.id);
    fState.categoria=isImpl?'implementacao':'campanhas';
  }
  fRestoreCatalog();
  fUpdateCtx();
  // Evento previsto na migration de analytics e nunca emitido (funil: campanha → material → arte)
  if(typeof gTrackEvent==='function') gTrackEvent('campanha_aberta',{camp_id:c.id, camp:c.name||''});
  fOpenMaterialCatalog(c);
}

/* ══════════════════════════════════════════════════════════════
   HOME DO FRANQUEADO — estado inicial em tela cheia (vitrine).
   fGoHome/fExitHome ligam/desligam o modo via body.f-home-mode;
   os fluxos existentes (materiais → chat → prévia) ficam intactos.
══════════════════════════════════════════════════════════════ */
function fGoHome(opts){
  document.body.classList.add('f-home-mode');
  document.body.classList.remove('f-mobile-chat','f-history-mode','f-material-browser');
  // Saindo do HISTÓRICO pela home: reseta a aba do rail. fGoHome removia só a classe, mas o
  // fSwitchTab tinha deixado displays inline (catálogo none, histórico flex) — ao entrar numa
  // campanha depois, o rail voltava com o histórico ESPREMIDO e sem catálogo (bug da foto).
  if(fState.tab==='historico' && typeof fSwitchTab==='function'){
    fSwitchTab('catalogo', document.querySelector('.f-tab'));
  }
  // opts.silent (usado no boot pós-login): renderiza a home já ASSENTADA, sem a cascata de
  // entrada — evita o flash de "franqueado vazio" enquanto o corpo estava em opacity:0. A cascata
  // segue nas navegações internas (fGoHome() sem opts).
  fRenderHome(opts);
}
function fExitHome(){
  // Ao sair da home, as colunas entram com direção (rail desliza da esquerda,
  // conteúdo funde) — classe one-shot removida após a animação.
  const was=document.body.classList.contains('f-home-mode');
  document.body.classList.remove('f-home-mode');
  if(was){
    document.body.classList.add('f-cols-enter');
    setTimeout(()=>document.body.classList.remove('f-cols-enter'),560);
  }
}

// Índices de stagger da cascata: --fi por bloco estrutural (herdado pelos cards
// via custom property), --ci por card dentro do bloco. Caps evitam cauda longa.
function _fhApplyStagger(root){
  let fi=0;
  root.querySelectorAll('.fh-head,.fh-search-row,#fh-body>*').forEach(n=>{
    n.style.setProperty('--fi',Math.min(fi++,10));
  });
  root.querySelectorAll('.fh-grid,.fh-cont').forEach(g=>{
    Array.prototype.forEach.call(g.children,(c,ci)=>c.style.setProperty('--ci',Math.min(ci,8)));
  });
}

// Saudação por hora do dia + primeiro nome do perfil (escapado — vem do backend)
function fHomeGreeting(){
  const h=new Date().getHours();
  const g=(h>=5&&h<12)?'Bom dia':(h>=12&&h<18)?'Boa tarde':'Boa noite';
  let n='';
  try{
    const dn=(typeof gAuthState!=='undefined'&&gAuthState.user&&gAuthState.user.displayName)||'';
    n=dn.trim().split(/\s+/)[0]||'';
  }catch(e){}
  return g+(n?', '+gEsc(n):'');
}

// Card de rascunho da fila "Continuar de onde parou" (dados vêm do usuário → escapar)
function _fHomeDraftEl(hEntry){
  const name=gEsc(hEntry.prod||hEntry.campName||'Arte');
  const fmt=gEsc(hEntry.fmtName||'');
  const when=(typeof fFormatHistDate==='function')?fFormatHistDate(hEntry.ts):'';
  const camp=(typeof fResolveCamp==='function')?fResolveCamp(hEntry.campId):null;
  const cover=camp?(fCampCover(camp)||_fCampThumbURL(camp.id)):'';
  const coverSafe=gEsc(cover).replace(/'/g,'%27');
  const colorSafe=gEsc(hEntry.campColor||(camp&&camp.color)||'var(--dm-orange)');
  const thumbStyle=cover
    ?`background-color:${colorSafe};background-image:url('${coverSafe}');background-size:cover;background-position:center`
    :`background-color:${colorSafe}`;
  const thumbAttr=(!cover&&camp&&_fCampThumbNeeded(camp))?` data-thumb-camp="${camp.id}"`:'';
  return `<button class="fh-draft" type="button" onclick="fHomeResume(${hEntry.id})" aria-label="Continuar ${name}${fmt?', formato '+fmt:''}">
    <div class="fh-draft-th"${thumbAttr} style="${thumbStyle}" aria-hidden="true">
      <span>${fmt||'Arte'}</span>
    </div>
    <div class="fh-draft-info">
      <div class="fh-draft-status"><span></span> Rascunho</div>
      <div class="fh-draft-name">${name}</div>
      <div class="fh-draft-meta">${gEsc(hEntry.campName||'Campanha')}${fmt?' · '+fmt:''}</div>
      <div class="fh-draft-foot"><time>${when}</time><span class="fh-draft-progress" aria-hidden="true"><i></i></span></div>
    </div>
    <span class="fh-draft-go" aria-hidden="true"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg></span>
  </button>`;
}
function fHomeResume(id){
  fExitHome();
  fEditFromHist(id);
}
function fHomeOpenHist(){
  fExitHome();
  const tabs=document.querySelectorAll('.f-tab');
  if(tabs.length>1) fSwitchTab('historico', tabs[1]);
}

// Hero da campanha recomendada (a "popular" entre as que têm material pronto)
function _fHomeHeroEl(rec){
  const cover=fCampCover(rec)||_fCampThumbURL(rec.id);
  const mats=(typeof fGetMaterialsForCamp==='function')?fGetMaterialsForCamp(rec.id):[];
  const matLabel=mats.length?`${mats.length} ${mats.length!==1?'materiais':'material'}`:'Materiais em breve';
  const coverSafe=gEsc(cover).replace(/'/g,'%27');   // %27: neutraliza o ' que fecharia o url('…')
  const colorSafe=gEsc(rec.color||'var(--dm-orange)');
  const coverStyle=cover
    ?`background-color:${colorSafe};background-image:url('${coverSafe}');background-size:cover;background-position:center`
    :`background-color:${colorSafe}`;
  const heroThumbAttr=(!cover&&_fCampThumbNeeded(rec))?` data-thumb-camp="${rec.id}"`:'';
  const fmtNames=[...new Set(mats.map(m=>({story:'Story 9:16',feed:'Feed 1:1',wide:'Post wide',post:'Post wide'}[m.fmt]||'Material')))];
  const _flame='<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:-1px"><path d="M12 2s5 4 5 9a5 5 0 0 1-10 0c0-1 .3-2 .8-2.8C8 10 9 12 10 12c0-3 2-7 2-10z"/></svg>';
  const _star='<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:-1.5px"><polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9"/></svg>';
  return `<section class="fh-featured" aria-label="Campanha recomendada">
  <button class="fh-hero" type="button" onclick="fSelectCamp('${rec.id}')" aria-label="Abrir campanha ${gEsc(rec.name)}">
    <div class="fh-hero-cover"${heroThumbAttr} style="${coverStyle}">
      ${rec.badge?`<span class="fh-hero-badge">${gEsc(rec.badge)}</span>`:''}
      ${rec.popular?`<span class="fh-hero-pop">${_flame} Popular</span>`:''}
      ${cover?'':`<div class="fh-hero-prod">${gEsc(rec.previewProd||rec.name)}</div>`}
      <span class="fh-hero-cover-note">Campanha em destaque</span>
    </div>
    <div class="fh-hero-body">
      <span class="fh-hero-eyebrow">${_star} RECOMENDADA AGORA</span>
      <span class="fh-hero-name">${gEsc(rec.name)}</span>
      <span class="fh-hero-meta">${matLabel}${rec.expiraDias?` · disponível por ${rec.expiraDias} dias`:''}</span>
      ${fmtNames.length?`<span class="fh-hero-formats">${fmtNames.slice(0,3).map(fmt=>`<span>${gEsc(fmt)}</span>`).join('')}</span>`:''}
      <span class="fh-hero-cta">Criar arte agora <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg></span>
    </div>
  </button>
  </section>`;
}

// Campanha tem material publicado e válido? (vitrine honesta: prontas vs em breve)
function _fCampHasMats(c){
  try{ return fGetMaterialsForCamp(c.id).filter(fIsMaterialValid).length>0; }catch(e){ return false; }
}

// Corpo da home (seções). query preenchida = modo busca (lista achatada de resultados).
function _fHomeBodyHTML(query){
  const q=(query||'').trim().toLowerCase();
  const {ativas,outras}=fGetCampaigns();
  const impl=(typeof CAMPS_IMPLEMENTACAO!=='undefined')?CAMPS_IMPLEMENTACAO:[];
  if(q){
    const match=[...ativas,...outras,...impl].filter(c=>c.name.toLowerCase().includes(q));
    if(!match.length) return `<div class="fh-empty"><span class="fh-empty-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg></span><strong>Nenhuma campanha encontrada</strong><span>Não encontramos resultados para “${gEsc(query)}”. Tente outro termo.</span></div>`;
    const isImpl=c=>impl.some(x=>x.id===c.id);
    return `<section class="fh-section fh-results"><div class="fh-sec"><span>Resultados</span><em>${match.length} campanha${match.length!==1?'s':''}</em></div>
      <div class="camp-grid fh-grid">${match.map(c=>fCampEl(c,false,!isImpl(c)&&!_fCampHasMats(c))).join('')}</div></section>`;
  }
  // Vitrine honesta: só entra em "Prontas pra usar" quem tem material publicado
  // e válido; o resto vai pra "Em breve" (cards menores, sem clique). A recomendada
  // NUNCA é uma campanha vazia.
  const pool=[...ativas,...outras];
  const prontas=pool.filter(_fCampHasMats);
  const embreve=pool.filter(c=>!_fCampHasMats(c));
  const rec=prontas.find(c=>c.popular)||prontas[0]||null;
  const gridProntas=prontas.filter(c=>!rec||c.id!==rec.id);
  // Rascunhos mais recentes (máx 3) — atalho de retomada
  let drafts=[];
  try{ drafts=fGetHist().filter(x=>x.status==='rascunho').slice(0,3); }catch(e){}
  // Favoritas: campanhas que o franqueado fixou, na ordem em que favoritou. Só as que
  // existem no pool atual (uma campanha removida do catálogo não aparece "fantasma").
  let favs=[];
  try{ const favIds=fGetFavs(); favs=favIds.map(id=>pool.find(c=>c.id===id)).filter(Boolean); }catch(e){}
  return `
    ${drafts.length?`<section class="fh-section fh-continue"><div class="fh-sec"><span>Continue criando</span><em>Seus rascunhos mais recentes</em></div>
    <div class="fh-cont">${drafts.map(_fHomeDraftEl).join('')}</div></section>`:''}
    ${favs.length?`<section class="fh-section"><div class="fh-sec"><span>Favoritas</span><em>${favs.length} fixada${favs.length!==1?'s':''}</em></div>
    <div class="camp-grid fh-grid">${favs.map(c=>fCampEl(c,false,!_fCampHasMats(c))).join('')}</div></section>`:''}
    ${rec?_fHomeHeroEl(rec):''}
    ${gridProntas.length?`<section class="fh-section"><div class="fh-sec"><span>Prontas para usar</span><em>${gridProntas.length} campanha${gridProntas.length!==1?'s':''} disponíveis</em></div>
    <div class="camp-grid fh-grid">${gridProntas.map(c=>fCampEl(c,false)).join('')}</div></section>`:''}
    ${impl.length?`<section class="fh-section"><div class="fh-sec"><span>Jornada de implementação</span><em>Materiais para o lançamento da sua unidade</em></div>
    <div class="camp-grid fh-grid">${impl.map(c=>fCampEl(c,false)).join('')}</div></section>`:''}
    ${embreve.length?`<section class="fh-section fh-coming"><div class="fh-sec"><span>Em breve</span><em>Materiais em preparação</em></div>
    <div class="camp-grid fh-grid fh-grid-ghost">${embreve.map(c=>fCampEl(c,false,true)).join('')}</div></section>`:''}`;
}

/* ── Revelação por rolagem ─────────────────────────────────────
   Cada bloco do corpo da home (#fh-body>*) entra quando aparece no viewport
   (IntersectionObserver com root no próprio #f-home). --bi = índice dentro do
   lote revelado junto (stagger); os cards herdam via --ci. Sem .fh-anim
   (refresh silencioso, busca) ou com reduced-motion, tudo fica visível na hora. */
let _fhRevealIO=null;
function _fhSetupReveal(){
  const home=document.getElementById('f-home'); if(!home)return;
  if(_fhRevealIO){_fhRevealIO.disconnect();_fhRevealIO=null;}
  const blocks=home.querySelectorAll('#fh-body>*');
  const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!home.classList.contains('fh-anim')||reduce||!('IntersectionObserver' in window)){
    blocks.forEach(b=>b.classList.add('in'));
    return;
  }
  _fhRevealIO=new IntersectionObserver(entries=>{
    let bi=0;
    entries.forEach(en=>{
      if(!en.isIntersecting)return;
      en.target.style.setProperty('--bi',Math.min(bi++,6));
      en.target.classList.add('in');
      _fhRevealIO.unobserve(en.target);
    });
  },{root:home,rootMargin:'0px 0px -60px 0px',threshold:0});
  blocks.forEach(b=>_fhRevealIO.observe(b));
}

// Busca gruda no topo ao rolar e ganha vidro (.is-stuck) — bind único no #f-home
let _fhStickyBound=false;
function _fhBindSticky(){
  if(_fhStickyBound)return;
  const home=document.getElementById('f-home'); if(!home)return;
  _fhStickyBound=true;
  home.addEventListener('scroll',()=>{
    const s=home.querySelector('.fh-search-row'); if(!s)return;
    const stuck=s.getBoundingClientRect().top<=home.getBoundingClientRect().top+12;
    s.classList.toggle('is-stuck',stuck);
  },{passive:true});
}

function fRenderHome(opts){
  opts=opts||{};
  const el=document.getElementById('f-home'); if(!el)return;
  // silent=true (refresh do sync): atualiza o conteúdo sem re-rodar a cascata
  el.classList.toggle('fh-anim', !opts.silent);
  const nHist=(function(){try{return fGetHist().length;}catch(e){return 0;}})();
  el.innerHTML=`<div class="fh-inner">
    <div class="fh-head">
      <div class="fh-head-copy">
        <div class="fh-kicker"><span class="fh-kicker-mark" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 1.8 4.7L19 9.5l-4.1 3.2 1.3 5.3-4.2-2.8L7.8 18l1.3-5.3L5 9.5l5.2-1.8L12 3Z"/></svg></span>Seu espaço criativo</div>
        <h1 class="fh-greet">${fHomeGreeting()}</h1>
        <p class="fh-sub">Escolha uma campanha. A Luma guia o restante e sua arte fica pronta em cerca de um minuto.</p>
      </div>
      <div class="fh-head-actions">
        <button class="fh-help" type="button" onclick="gOpenHelp(this)" data-help-trigger aria-controls="g-help-modal" aria-expanded="false"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.3 2.3 0 1 1 3.6 1.9c-.9.6-1.4 1.1-1.4 2.1"/><path d="M12 17h.01"/></svg><span>Ajuda</span></button>
        <button class="fh-mine" type="button" onclick="fHomeOpenHist()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 4v5"/></svg><span>Minhas artes</span>${nHist?` <span class="fh-mine-badge">${nHist}</span>`:''}</button>
      </div>
    </div>
    <div class="fh-search-row" role="search">
      <span class="fh-search-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></span>
      <div class="fh-search-field"><label for="fh-search">Encontre sua próxima campanha</label><input id="fh-search" type="search" autocomplete="off" placeholder="Busque por tema ou ocasião" oninput="fHomeFilter(this.value)"/></div>
      <span class="fh-search-hint" aria-hidden="true">Campanhas e formatos</span>
    </div>
    <div id="fh-body">${_fHomeBodyHTML('')}</div>
  </div>`;
  _fhApplyStagger(el);
  // Se o observer falhar por qualquer motivo, ninguém pode ficar invisível
  try{ _fhSetupReveal(); }catch(e){ el.querySelectorAll('#fh-body>*').forEach(b=>b.classList.add('in')); }
  _fhBindSticky();
  setTimeout(fHomeFillThumbs,0); // capas reais pintam em background
}
function fHomeFilter(q){
  const body=document.getElementById('fh-body'); if(!body)return;
  // Busca é digitação: resultados instantâneos, sem re-rodar a cascata a cada tecla
  const home=document.getElementById('f-home');
  if(home) home.classList.remove('fh-anim');
  body.innerHTML=_fHomeBodyHTML(q);
  try{ _fhSetupReveal(); }catch(e){ body.querySelectorAll(':scope>*').forEach(b=>b.classList.add('in')); }
  setTimeout(fHomeFillThumbs,0);
}
// Re-renderiza a home quando o sync do backend traz capas/artes novas —
// só se ela está visível e o usuário não está no meio de uma busca.
// silent: atualização de dados não deve piscar/re-animar a tela.
function fHomeRefreshIfIdle(){
  if(!document.body.classList.contains('f-home-mode'))return;
  const s=document.getElementById('fh-search');
  if(s&&s.value)return;
  fRenderHome({silent:true});
}
