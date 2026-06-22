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
  btn.classList.add('active');
  const cat=document.getElementById('f-catalog'),hist=document.getElementById('f-hist-tab');
  const fmt=document.getElementById('f-fmt-wrap'),sr=document.getElementById('f-search-row');
  if(tab==='historico'){cat.style.display='none';hist.style.display='flex';fmt.style.display='none';sr.style.display='none';fRenderHist();}
  else{cat.style.display='block';hist.style.display='none';fmt.style.display='';sr.style.display='';}
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
}
function fRenderHist(){
  const all = fGetHist();
  const el = document.getElementById('f-hist-tab');
  const filtered = fHistFilter === 'todos' ? all : all.filter(h => (h.status||'rascunho') === fHistFilter);
  const counts = {
    todos: all.length,
    rascunho: all.filter(h=>(h.status||'rascunho')==='rascunho').length,
    baixada: all.filter(h=>h.status==='baixada').length,
  };
  const filterBar = `<div class="hist-filter-bar">
    <button class="hist-filter-btn ${fHistFilter==='todos'?'active':''}" onclick="fSetHistFilter('todos',this)">Todas <span class="hist-filter-count">${counts.todos}</span></button>
    <button class="hist-filter-btn ${fHistFilter==='rascunho'?'active':''}" onclick="fSetHistFilter('rascunho',this)">Rascunhos <span class="hist-filter-count">${counts.rascunho}</span></button>
    <button class="hist-filter-btn ${fHistFilter==='baixada'?'active':''}" onclick="fSetHistFilter('baixada',this)">Baixadas <span class="hist-filter-count">${counts.baixada}</span></button>
  </div>`;
  if(!all.length){
    // M1.3 — empty state empático com ícone + CTA de volta ao fluxo
    el.innerHTML = filterBar + `<div class="empty-state">
      <div class="empty-icon">
        <img src="assets/illustrations/empty_arts.png" style="width: 180px; height: auto;" alt="Empty Canvas">
      </div>
      <div class="empty-title">Ainda não tens artes geradas</div>
      <div class="empty-text">Escolhe uma campanha, responde umas perguntinhas e a tua primeira arte aparece aqui.</div>
      <button class="empty-cta" onclick="fGoToCampaigns()">Ver campanhas sugeridas →</button>
    </div>`;
    return;
  }
  if(!filtered.length){
    el.innerHTML = filterBar + `<div class="empty-state empty-state-sm">
      <div class="empty-icon">
        <img src="assets/illustrations/empty_filtered.png" style="width: 140px; height: auto;" alt="Empty Results">
      </div>
      <div class="empty-title">Nenhuma arte ${fHistFilter==='rascunho'?'em rascunho':'baixada ainda'}</div>
      <div class="empty-text">${fHistFilter==='rascunho'?'Os rascunhos que começares aparecem aqui.':'Baixa uma arte e ela fica registada aqui.'}</div>
      <button class="empty-cta ghost" onclick="fSetHistFilter('todos',document.querySelector('.hist-filter-btn'))">Ver todas</button>
    </div>`;
    return;
  }
  el.innerHTML = filterBar + filtered.map(h=>{
    const isRascunho = (h.status||'rascunho') === 'rascunho';
    const statusBadge = isRascunho
      ? `<span class="hist-badge-st rascunho">rascunho</span>`
      : `<span class="hist-badge-st baixada">baixada</span>`;
    const dateStr = fFormatHistDate(h.ts);
    return `<div class="hist-card" data-status="${h.status||'rascunho'}">
      <div class="hist-thumb" style="background:${h.campColor}">${gEsc((h.campName||'').toUpperCase().slice(0,8))}</div>
      <div class="hist-info">
        <div class="hist-name">${h.materialName ? gEsc(h.materialName) : (gEsc(h.prod) + ' · ' + gEsc(h.fmtName))}</div>
        <div class="hist-meta">${statusBadge}<span class="hist-meta-sep">·</span>${gEsc(h.campName)}<span class="hist-meta-sep">·</span>${gEsc(h.fmtName)}<span class="hist-meta-sep">·</span>${dateStr}</div>
        <div class="hist-actions">
          <button class="hist-act-btn" onclick="fEditFromHist(${h.id})" title="Abrir e editar">✎ Editar</button>
          <button class="hist-act-btn" onclick="fDuplicateInOtherFmt(${h.id})" title="Gerar em outro formato">⎘ Duplicar</button>
          <button class="hist-act-btn pri" onclick="fDownloadHist(${h.id})" title="Baixar PNG">↓ Baixar</button>
        </div>
      </div>
    </div>`;
  }).join('');
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
  try {
    await fGenPNG(h.dados,c,f);
  } finally {
    fState.material = prevMaterial; // restaura sempre, mesmo se fGenPNG lançar
  }
  fMarkHistBaixada(id);
  fRenderHist();
  gToast('Arte baixada!');
}

// F-04: retomar uma entrada do histórico no chat, com dados pré-preenchidos
function fEditFromHist(id){
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
        perguntas.push({id:v, texto:`Envie a <strong>${label.toLowerCase()}</strong>`, sugestoes:[], isImage:true, label, maxLen:0});
      } else {
        perguntas.push({id:v, texto:`Qual é o <strong>${label.toLowerCase()}</strong>?`, sugestoes:fGetSuggestionsForVar(v, c), maxLen:perm?.maxLen||32, label});
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
      if(isImg) return {id:k, texto:`Envie a <strong>${label.toLowerCase()}</strong>`, sugestoes:[], isImage:true, label, maxLen:0};
      return {id:k, texto:`Qual é o <strong>${label.toLowerCase()}</strong>?`, sugestoes:fGetSuggestionsForVar(k, c), maxLen:32, label};
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
    bar.innerHTML = `<span>Duplicar em qual formato?</span>` +
      FMTS.filter(f=>f.id !== h.fmtId).map(f=>
        `<button class="hist-dup-btn" onclick="fConfirmDuplicate(${id},'${f.id}')">${f.name}</button>`
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
  try {
    await fGenPNG(h.dados, c, f);
    fAddHist(h.dados, c, f, 'baixada'); // só registra se o PNG saiu (material ainda carregado aqui)
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
  return dFolders.find(f=>f.campId===c.id) || dFolders.find(f=>f.name===c.name) || null;
}
// Capa da pasta (se o designer enviou uma) — usada como fundo do card
// Prioridade: dFolders.cover (designer upload) > c.cover (estático no config)
function fCampCover(c){
  const f=fFolderForCamp(c);
  const cv=f&&f.cover;
  if(cv&&typeof cv==='string'&&cv!=='__local__'&&cv.length) return cv;
  return (c&&c.cover&&typeof c.cover==='string'&&c.cover.length)?c.cover:'';
}
function fCampEl(c,isRec){
  // F-06: thumb mostra prévia real com produto e preço
  const previewProd = c.previewProd || c.name;
  const previewPor = c.previewPor || '';
  const previewDe = c.previewDe || '';
  const cover = fCampCover(c);
  const thumbStyle = cover
    ? `background-image:url('${cover}');background-size:cover;background-position:center`
    : `background:${c.color}`;
  const mats = (typeof fGetMaterialsForCamp==='function') ? fGetMaterialsForCamp(c.id) : [];
  const countLabel = mats.length ? `${mats.length} material${mats.length!==1?'is':''}` : 'Sem materiais';
  return `<div class="camp-card ${c.id===fState.camp.id?'selected':''} ${isRec?'recommended':''}" onclick="fSelectCamp('${c.id}')">
    <div class="camp-prev-btn" onclick="event.stopPropagation();fOpenPreview(event,'${c.id}')">PRÉVIA</div>
    <div class="camp-thumb ${cover?'has-cover':''}" style="${thumbStyle}">
      ${c.badge?`<div class="camp-badge">${c.badge}</div>`:''}
      ${c.popular?`<div class="camp-popular">🔥 Popular</div>`:''}
      ${c.expiraDias<=3?`<div class="camp-urgency">⏰ ${c.expiraDias}d restantes</div>`:''}
      ${cover?'':`<div class="camp-thumb-prod">${previewProd}</div>
      ${previewDe?`<div class="camp-thumb-de">${previewDe}</div>`:''}
      ${previewPor?`<div class="camp-thumb-por">${previewPor}</div>`:''}
      <div class="camp-thumb-logo" role="img" aria-label="Luma"></div>`}
    </div>
    <div class="camp-body"><div class="camp-name">${c.name}</div><div class="camp-sub">${countLabel}</div></div>
  </div>`;
}
function fGetCampaigns(){
  // As constantes CAMPS_* são sempre a fonte da lista — dFolders só serve
  // para capa e templates publicados (consultado por fCampCover / fFolderForCamp).
  return {ativas:CAMPS_ATIVAS,outras:CAMPS_OUTRAS};
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

function fRenderCatalogs(a,o){
  a=a||[];o=o||[];
  const cat=document.getElementById('f-catalog'); if(!cat)return;
  const rec=a.find(c=>c.popular)||null;
  cat.innerHTML=`
    <div class="cat-back-row">
      <button class="cat-back-btn" onclick="fVoltarCategoria()">${_ICO_BACK} Todas as categorias</button>
      <span class="cat-back-label">Campanhas</span>
    </div>
    ${rec?`<div class="sec-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:middle;margin-right:4px"><polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9"/></svg>Recomendada agora</div>
    <div class="camp-grid" id="camp-rec"></div>`:''}
    <div class="sec-title">Ativas agora</div>
    <div class="camp-grid" id="camp-main"></div>
    ${o.length?`<div class="sec-title">Outras campanhas</div><div class="camp-grid" id="camp-other"></div>`:''}`;
  if(rec) document.getElementById('camp-rec')?.insertAdjacentHTML('beforeend',fCampEl(rec,true));
  document.getElementById('camp-main').innerHTML=a.filter(c=>!rec||c.id!==rec.id).map(c=>fCampEl(c,false)).join('');
  if(o.length) document.getElementById('camp-other')?.insertAdjacentHTML('beforeend',o.map(c=>fCampEl(c,false)).join(''));
}
function fFilterCamps(q){
  if(fState.categoria!=='campanhas') return;
  const {ativas,outras}=fGetCampaigns();
  const f1=q?ativas.filter(c=>c.name.toLowerCase().includes(q.toLowerCase())):ativas;
  const f2=q?outras.filter(c=>c.name.toLowerCase().includes(q.toLowerCase())):outras;
  fRenderCatalogs(f1.length?f1:ativas,f2);
  if(q) document.getElementById('camp-rec')?.style && (document.getElementById('camp-rec').style.display='none');
}
function fSelectCamp(id){
  const c=fResolveCamp(id);if(!c)return;
  if(fState.camp && fState.camp.id===c.id) {
    if(fState.materialView) return;
  }
  const temDados = Object.keys(fState.dados).length > 0 && !fState.materialView;
  if(temDados && !fState.done){
    fAskCampSwitch(c);
    return;
  }
  fState.camp=c;
  fRestoreCatalog();
  fUpdateCtx();
  fOpenMaterialCatalog(c);
}
