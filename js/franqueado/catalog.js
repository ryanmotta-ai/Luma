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
      <div class="empty-title">Você ainda não gerou nenhuma arte</div>
      <div class="empty-text">Escolha uma campanha, responda umas perguntinhas e sua primeira arte aparece aqui.</div>
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
      <div class="empty-text">${fHistFilter==='rascunho'?'Os rascunhos que você começar aparecem aqui.':'Baixe uma arte e ela fica registrada aqui.'}</div>
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
      <div class="hist-thumb" style="background:${h.campColor||'var(--dm-orange)'}">${gEsc((h.campName||'').toUpperCase().slice(0,8))}</div>
      <div class="hist-info">
        <div class="hist-name">${h.materialName ? gEsc(h.materialName) : (gEsc(h.prod) + ' · ' + gEsc(h.fmtName))}</div>
        <div class="hist-meta">${statusBadge}<span class="hist-meta-sep">·</span>${gEsc(h.campName)}<span class="hist-meta-sep">·</span>${gEsc(h.fmtName)}<span class="hist-meta-sep">·</span>${dateStr}</div>
        <div class="hist-actions">
          <button class="hist-act-btn" onclick="fEditFromHist(${h.id})" title="Abrir e editar"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>Editar</button>
          <button class="hist-act-btn" onclick="fDuplicateInOtherFmt(${h.id})" title="Gerar em outro formato"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Duplicar</button>
          <button class="hist-act-btn pri" onclick="fDownloadHist(${h.id})" title="Baixar PNG"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px"><path d="M12 3v12"/><polyline points="7 10 12 15 17 10"/><path d="M5 21h14"/></svg>Baixar</button>
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
  if(fState.material && typeof fEnsureMaterialLayers==='function') await fEnsureMaterialLayers(fState.material);
  try {
    await fGenPNG(h.dados,c,f);
  } finally {
    fState.material = prevMaterial; // restaura sempre, mesmo se fGenPNG lançar
  }
  fMarkHistBaixada(id);
  fRenderHist();
  if(typeof gTrackEvent==='function') gTrackEvent('arte_baixada',{camp_id:h.campId,fmt:h.fmtId,tipo:'png',origem:'historico'});
  gToast('Arte baixada!');
}

// F-04: retomar uma entrada do histórico no chat, com dados pré-preenchidos
async function fEditFromHist(id){
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
    await fEnsureMaterialLayers(material);
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
  if(fState.material && typeof fEnsureMaterialLayers==='function') await fEnsureMaterialLayers(fState.material);
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
    // preserva o scrim do hero (badges legíveis sobre a arte)
    node.style.backgroundImage=`linear-gradient(180deg,rgba(0,0,0,.30),rgba(0,0,0,0) 35%,rgba(0,0,0,0) 65%,rgba(0,0,0,.38)),url('${url}')`;
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
  const countLabel = ghost ? 'Materiais em breve' : (mats.length ? `${mats.length} material${mats.length!==1?'is':''}` : 'Sem materiais');
  const thumbAttr = (!cover && !ghost && _fCampThumbNeeded(c)) ? ` data-thumb-camp="${c.id}"` : '';
  const _icoFlame='<svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:-1px;margin-right:3px"><path d="M12 2s5 4 5 9a5 5 0 0 1-10 0c0-1 .3-2 .8-2.8C8 10 9 12 10 12c0-3 2-7 2-10z"/></svg>';
  const _icoClock='<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1px;margin-right:3px"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  return `<div class="camp-card ${!ghost&&fState.camp&&c.id===fState.camp.id?'selected':''} ${isRec?'recommended':''}${ghost?' ghost':''}"${ghost?' aria-disabled="true"':` onclick="fSelectCamp('${c.id}')"`}>
    ${ghost?'':`<div class="camp-prev-btn" onclick="event.stopPropagation();fOpenPreview(event,'${c.id}')">PRÉVIA</div>`}
    <div class="camp-thumb ${cover?'has-cover':''}"${thumbAttr} style="${thumbStyle}">
      ${c.badge?`<div class="camp-badge">${gEsc(c.badge)}</div>`:''}
      ${!ghost&&c.popular?`<div class="camp-popular">${_icoFlame}Popular</div>`:''}
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
function fRenderCatalogs(a,o,opts){
  a=a||[];o=o||[];opts=opts||{};
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
  fOpenMaterialCatalog(c);
}

/* ══════════════════════════════════════════════════════════════
   HOME DO FRANQUEADO — estado inicial em tela cheia (vitrine).
   fGoHome/fExitHome ligam/desligam o modo via body.f-home-mode;
   os fluxos existentes (materiais → chat → prévia) ficam intactos.
══════════════════════════════════════════════════════════════ */
function fGoHome(){
  document.body.classList.add('f-home-mode');
  document.body.classList.remove('f-mobile-chat');
  fRenderHome(); // com coreografia de entrada
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
  return g+(n?', '+gEsc(n):'')+' 👋';
}

// Card de rascunho da fila "Continuar de onde parou" (dados vêm do usuário → escapar)
function _fHomeDraftEl(hEntry){
  const name=gEsc(hEntry.prod||hEntry.campName||'Arte');
  const fmt=gEsc(hEntry.fmtName||'');
  const when=(typeof fFormatHistDate==='function')?fFormatHistDate(hEntry.ts):'';
  return `<button class="fh-draft" onclick="fHomeResume(${hEntry.id})">
    <div class="fh-draft-th" style="background:linear-gradient(155deg,${gEsc(hEntry.campColor||'#FF9000')},rgba(0,0,0,.35)),${gEsc(hEntry.campColor||'#FF9000')}"></div>
    <div class="fh-draft-info">
      <div class="fh-draft-name">${name}${fmt?' — '+fmt:''}</div>
      <div class="fh-draft-meta">Rascunho · ${when}</div>
    </div>
    <span class="fh-draft-go">Retomar →</span>
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
  const matLabel=mats.length?`${mats.length} material${mats.length!==1?'is':''}`:'Materiais em breve';
  const coverStyle=cover
    ?`background-color:${rec.color};background-image:linear-gradient(180deg,rgba(0,0,0,.30),rgba(0,0,0,0) 35%,rgba(0,0,0,0) 65%,rgba(0,0,0,.38)),url('${cover}');background-size:cover;background-position:center`
    :`background:linear-gradient(155deg,${rec.color},rgba(0,0,0,.45)),${rec.color}`;
  const heroThumbAttr=(!cover&&_fCampThumbNeeded(rec))?` data-thumb-camp="${rec.id}"`:'';
  const _flame='<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:-1px"><path d="M12 2s5 4 5 9a5 5 0 0 1-10 0c0-1 .3-2 .8-2.8C8 10 9 12 10 12c0-3 2-7 2-10z"/></svg>';
  const _star='<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:-1.5px"><polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9"/></svg>';
  return `<div class="fh-hero" onclick="fSelectCamp('${rec.id}')">
    <div class="fh-hero-cover"${heroThumbAttr} style="${coverStyle}">
      ${rec.badge?`<span class="fh-hero-badge">${gEsc(rec.badge)}</span>`:''}
      ${rec.popular?`<span class="fh-hero-pop">${_flame} Popular</span>`:''}
      ${cover?'':`<div class="fh-hero-prod">${gEsc(rec.previewProd||rec.name)}</div>`}
    </div>
    <div class="fh-hero-body">
      <span class="fh-hero-eyebrow">${_star} RECOMENDADA AGORA</span>
      <span class="fh-hero-name">${gEsc(rec.name)}</span>
      <span class="fh-hero-meta">${matLabel}${rec.expiraDias?` · válida por ${rec.expiraDias} dias`:''}</span>
      <span class="fh-hero-cta">Criar arte agora →</span>
    </div>
  </div>`;
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
    if(!match.length) return `<div class="fh-empty">Nenhuma campanha encontrada para “${gEsc(query)}”. Tente outro termo.</div>`;
    const isImpl=c=>impl.some(x=>x.id===c.id);
    return `<div class="fh-sec">Resultados <em>· ${match.length}</em></div>
      <div class="camp-grid fh-grid">${match.map(c=>fCampEl(c,false,!isImpl(c)&&!_fCampHasMats(c))).join('')}</div>`;
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
  return `
    ${drafts.length?`<div class="fh-sec">Continuar de onde parou</div>
    <div class="fh-cont">${drafts.map(_fHomeDraftEl).join('')}</div>`:''}
    ${rec?_fHomeHeroEl(rec):''}
    ${gridProntas.length?`<div class="fh-sec">Prontas pra usar <em>· ${gridProntas.length} campanha${gridProntas.length!==1?'s':''}</em></div>
    <div class="camp-grid fh-grid">${gridProntas.map(c=>fCampEl(c,false)).join('')}</div>`:''}
    ${impl.length?`<div class="fh-sec">Implementação <em>· para o lançamento da sua unidade</em></div>
    <div class="camp-grid fh-grid">${impl.map(c=>fCampEl(c,false)).join('')}</div>`:''}
    ${embreve.length?`<div class="fh-sec">Em breve <em>· materiais em preparação</em></div>
    <div class="camp-grid fh-grid fh-grid-ghost">${embreve.map(c=>fCampEl(c,false,true)).join('')}</div>`:''}`;
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
      <div>
        <h1 class="fh-greet">${fHomeGreeting()}</h1>
        <p class="fh-sub">Escolha uma campanha e eu monto a arte com você — leva ~1 minuto.</p>
      </div>
      <button class="fh-mine" onclick="fHomeOpenHist()">Minhas artes${nHist?` <span class="fh-mine-badge">${nHist}</span>`:''}</button>
    </div>
    <div class="fh-search-row">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input id="fh-search" type="search" aria-label="Buscar campanha" placeholder="Buscar campanha…" oninput="fHomeFilter(this.value)"/>
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
