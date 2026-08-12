/**
 * js/franqueado/catalog.js
 *
 * Catalogo de campanhas: fRenderCatalogs, fFilterCamps, fSelectCamp,
 * fSwitchTab, fSetHistFilter, fRenderHist, fEditFromHist, fDuplicateInOtherFmt.
 * Depende de: 00-config.js, 01-state.js
 */

/* ── TABS ESQUERDA ── */
function fSwitchTab(tab,btn){
  // Controle do produto: aba desativada devolve para a outra. Se as duas
  // estiverem desligadas, o módulo Franqueado inteiro é que devia estar — e
  // setMode já teria redirecionado antes de chegar aqui.
  const _tk={ catalogo:'franqueado.catalogo', historico:'franqueado.historico' }[tab];
  if(_tk && typeof gFeatureCan==='function' && !gFeatureCan(_tk,'access')){
    if(typeof gFeatureBlockedFeedback==='function') gFeatureBlockedFeedback(_tk);
    const alt = tab==='catalogo' ? 'historico' : 'catalogo';
    if(!gFeatureCan(_tk==='franqueado.catalogo'?'franqueado.historico':'franqueado.catalogo','access')) return;
    tab=alt;
    btn=document.querySelector('.f-tab[data-feature="franqueado.'+alt+'"]')||null;
  }
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
/* ══════════════════════════════════════════════════════════════
   VALIDADE NA "MINHAS ARTES" — 01_BUSINESS §96/§226: nada fora da validade chega ao
   franqueado. O catálogo já obedecia (fIsMaterialValid esconde material vencido), mas o
   histórico era uma porta lateral: a arte de uma campanha que já venceu continuava
   baixável daqui — material fora do ar circulando na rua.

   A checagem é feita na LEITURA (todo render e todo clique consultam o publishMeta.validade
   que o sync do catálogo trouxe naquele carregamento), nunca num flag gravado no histórico:
   assim, se a gestão estender a validade no Estúdio, a arte volta a liberar sozinha — sem
   migração e sem histórico mentindo.

   ⚠ Falha ABERTA: material não encontrado (catálogo ainda sincronizando, template apagado)
   não bloqueia nada. Travar arte válida por falta de dado seria pior que o problema. */
function _fHistMaterial(h){
  if(!h || !h.materialId || typeof dFolders==='undefined' || !dFolders) return null;
  for(const folder of dFolders){
    const t=(folder.templates||[]).find(x=>x.id===h.materialId);
    if(t) return t;
  }
  return null;
}
function _fHistVencida(h){
  const m=_fHistMaterial(h);
  return !!(m && typeof fIsMaterialValid==='function' && !fIsMaterialValid(m));
}
// Data da validade em pt-BR pra dizer QUANDO venceu (aviso vago não ajuda ninguém).
function _fHistVencimento(h){
  const m=_fHistMaterial(h);
  const v=m&&m.publishMeta&&m.publishMeta.validade;
  if(!v) return '';
  const d=new Date(v+'T23:59:59');
  return isNaN(d.getTime())?'':d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
}
// Porteiro único das três ações do card (baixar, duplicar, editar) — todas terminam em PNG.
function _fHistBloqueiaVencida(h){
  if(!_fHistVencida(h)) return false;
  const quando=_fHistVencimento(h);
  gToast('Esse material saiu do ar'+(quando?' em '+quando:'')+' — não é possível gerar essa arte de novo.','error');
  return true;
}
/* Porteiro do "Limpar": a única confirmação da biblioteca. Usa o gConfirm da casa (danger),
   diz QUANTAS artes somem e ONDE (aqui e no servidor), separa o que NÃO se perde (os
   materiais das campanhas continuam no catálogo) e avisa que não desfaz — sem isso a
   pessoa clica achando que é só um filtro. O botão OK carrega o número: quem lê "Apagar as
   12" não confunde com "limpar a busca". A demolição em si é o fClearHist (history.js). */
async function fAskClearHist(){
  const n=fGetHist().length;
  if(!n){ if(typeof gToast==='function') gToast('Sua biblioteca já está vazia.'); return; }
  if(typeof gConfirm!=='function'){ gToast('Não consegui abrir a confirmação. Recarregue a página.','error'); return; }
  const ok=await gConfirm(
    `Isso apaga ${n===1?'a sua única arte':'as suas '+n+' artes'} desta biblioteca — aqui e no servidor. Os materiais das campanhas continuam no catálogo: o que sai é só o seu histórico. Não dá pra desfazer.`,
    { title:'Limpar minhas artes?', okLabel:(n===1?'Apagar a arte':'Apagar as '+n), cancelLabel:'Manter', danger:true }
  );
  if(!ok) return;
  const feito=(typeof fClearHist==='function') ? await fClearHist() : false;
  if(feito && typeof gToast==='function') gToast('Biblioteca limpa.');
}
/* Biblioteca vazia: a MARCA do Luma (a mesma varinha do favicon, mesma geometria) se
   recompõe numa carinha triste — a estrela de baixo sobe pra fazer par com a de cima
   (os olhos) e a varinha se curva na boca. É a única ilustração da tela, então ela pode
   contar a história: "ainda não tem nada aqui" dito pela marca, não por um clipart.
   Roda UMA vez, na entrada (o empty state só é pintado quando não há nenhuma arte).
   Movimento e geometria: o SVG só declara as formas; tempos, curvas e posições finais
   moram no CSS (.luma-sad em franqueado.css), com prefers-reduced-motion caindo direto
   no rosto pronto — regra do motion.md: nada de ms nem cubic-bezier no JS. */
function _fHistEmptyArtSVG(){
  return `<svg class="luma-sad" viewBox="0 0 32 32" role="img" aria-label="A varinha do Luma faz uma carinha triste: você ainda não tem artes">
    <g class="ls-face" fill="none" stroke="currentColor">
      <path class="ls-star ls-star-a" d="M12 5.5 Q12 9 15.5 9 Q12 9 12 12.5 Q12 9 8.5 9 Q12 9 12 5.5 Z" fill="currentColor" stroke="none"/>
      <path class="ls-star ls-star-b" d="M20 19.5 Q20 23 23.5 23 Q20 23 20 26.5 Q20 23 16.5 23 Q20 23 20 19.5 Z" fill="currentColor" stroke="none"/>
      <path class="ls-spark" d="M24 15 Q24 17 26 17 Q24 17 24 19 Q24 17 22 17 Q24 17 24 15 Z" fill="currentColor" stroke="none"/>
      <g class="ls-rays" stroke-width="1.5" stroke-linecap="round">
        <line x1="25.5" y1="6.5" x2="27.5" y2="4.5"/>
        <line x1="23.5" y1="5.5" x2="23.5" y2="3"/>
        <line x1="26" y1="8.5" x2="28.5" y2="8.5"/>
      </g>
      <g class="ls-wand" stroke-width="3" stroke-linecap="round">
        <path d="M8 24 L15.5 16.5"/>
        <path d="M17.5 14.5 L23 9"/>
      </g>
      <path class="ls-mouth" d="M9.7 21.5 Q15.5 16.8 21.3 21.5" stroke-width="2.6" stroke-linecap="round"/>
    </g>
  </svg>`;
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
  // Limpar a biblioteca vive na barra da LISTA (não no cabeçalho, junto de "Nova arte"):
  // é ação sobre o conjunto, e a hierarquia da página não deve pôr destruir ao lado de criar.
  // Só existe quando há algo pra limpar.
  const clearBtn = all.length ? `<button class="hist-clear-btn" type="button" onclick="fAskClearHist()" title="Apagar todas as artes da sua biblioteca"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>Limpar</button>` : '';
  const toolbar=all.length?`<div class="f-history-toolbar">${searchBar}${filterBar}${clearBtn}</div>`:'';
  if(!all.length){
    el.innerHTML = `<div class="f-history-shell">${pageHead}<div class="empty-state f-history-empty">
      <div class="empty-icon">${_fHistEmptyArtSVG()}</div>
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
    // Material vencido: as três ações terminam em PNG, então as três desabilitam. Botão
    // morto sem explicação é pior que botão ausente — o motivo vai no lugar da linha de meta.
    const vencida = _fHistVencida(h);
    const quando = vencida ? _fHistVencimento(h) : '';
    const dis = vencida ? ' disabled aria-disabled="true"' : '';
    return `<article class="hist-card${vencida?' is-vencida':''}" data-status="${h.status||'rascunho'}">
      <div class="hist-thumb" style="background:${gEsc(h.campColor||'var(--dm-orange)')}">
        <span class="hist-thumb-camp">${gEsc(h.campName||'Luma')}</span>
        <strong>${gEsc(h.prod||h.campName||'Sua arte')}</strong>
        ${h.por?`<span class="hist-thumb-offer">${gEsc(h.por)}</span>`:''}
        <span class="hist-thumb-fmt">${gEsc(h.fmtName||'Material')}</span>
      </div>
      <div class="hist-info">
        <div class="hist-card-top">${statusBadge}${vencida?'<span class="hist-badge-st vencida">fora da validade</span>':''}<time>${dateStr}</time></div>
        <div class="hist-name">${gEsc(artName)}</div>
        ${vencida
          ? `<div class="hist-meta hist-meta-vencida">Material saiu do ar${quando?' em '+gEsc(quando):''} — não dá pra gerar de novo</div>`
          : `<div class="hist-meta"><span>${gEsc(h.campName)}</span><span class="hist-meta-sep">·</span><span>${gEsc(h.fmtName)}</span></div>`}
        <div class="hist-actions">
          <button class="hist-act-btn hist-act-main"${dis} onclick="fEditFromHist(${h.id},this)" title="Abrir e editar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>${isRascunho?'Continuar':'Editar'}</button>
          <button class="hist-act-btn"${dis} onclick="fDuplicateInOtherFmt(${h.id})" title="Gerar em outro formato"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Duplicar</button>
          <button class="hist-act-btn hist-act-download"${dis} onclick="fDownloadHist(${h.id})" title="${vencida?'Material fora da validade':'Baixar PNG'}" aria-label="Baixar ${gEsc(artName)}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><polyline points="7 10 12 15 17 10"/><path d="M5 21h14"/></svg></button>
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
  // Guarda no CLIQUE (e não só no botão desabilitado): o card pode ter sido pintado antes
  // do catálogo sincronizar, e a validade pode ter vencido com a aba aberta.
  if(_fHistBloqueiaVencida(h)){ fRenderHist(); return; }
  const {ativas:_ca,outras:_co}=fGetCampaigns(); const all=[..._ca,..._co];
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
  // Honestidade: se os layers do material não desceram (sem rede), o fGenPNG cairia no
  // renderer GENÉRICO e entregava arte errada com toast de sucesso. Avisa e para.
  if(fState.material && fState.material._needsLayersFetch){
    fState.material = prevMaterial;
    gToast('⚠ Não consegui carregar o material original. Verifique a conexão e tente de novo.','error');
    return;
  }
  try {
    await fGenPNG(h.dados,c,f);
  } catch(e) {
    gToast('Não consegui baixar a arte. Tente de novo.','error');
    return; // não marca "baixada" nem toast de sucesso se o PNG não saiu
  } finally {
    fState.material = prevMaterial; // restaura sempre, mesmo se fGenPNG lançar
  }
  fMarkHistBaixada(id);
  fRenderHist();
  if(typeof gTrackEvent==='function') gTrackEvent('arte_baixada',{camp_id:h.campId,fmt_id:h.fmtId,tipo:'png',origem:'historico'});
  gToast('Arte baixada!');
}

// F-04: retomar uma entrada do histórico no chat, com dados pré-preenchidos
async function fEditFromHist(id, btn){
  const h = fGetHist().find(x=>x.id===id);
  if(!h) return;
  // Editar também termina em PNG: liberar a edição de material vencido seria só um caminho
  // mais longo pro mesmo download proibido.
  if(_fHistBloqueiaVencida(h)){ fRenderHist(); return; }
  const {ativas:_ca2,outras:_co2}=fGetCampaigns(); const all=[..._ca2,..._co2];
  const c = all.find(x=>x.id===h.campId);
  if(!c){ gToast('Não achei a campanha original dessa arte.'); return; }
  const f = FMTS.find(x=>x.id===h.fmtId) || FMTS[0];
  // Retomar do histórico entra na campanha SEM passar por fOpenMaterialCatalog —
  // sem esta linha, voltar numa arte Much+ deixava o app vestido de Luma.
  if(typeof fApplyCampTheme==='function') fApplyCampTheme(c);
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
  const {ativas:_cra,outras:_cro}=fGetCampaigns(); fRenderCatalogs(_cra,_cro);
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
  if(_fHistBloqueiaVencida(h)){ fRenderHist(); return; }
  const {ativas:_ca3,outras:_co3}=fGetCampaigns(); const all=[..._ca3,..._co3];
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
  if(_fHistBloqueiaVencida(h)){ fRenderHist(); return; }
  const {ativas:_ca4,outras:_co4}=fGetCampaigns(); const all=[..._ca4,..._co4];
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
    gToast('Não consegui duplicar a arte. Tente de novo.','error');
    return;
  } finally {
    fState.material = prevMaterial; // restaura sempre, mesmo se fGenPNG lançar
  }
  fRenderHist();
  gToast(`Duplicada em ${f.name}!`);
}

/* ── CATÁLOGO ── */
// Acha a pasta (dFolders) ligada a uma campanha — por campId ou nome
/* 3-pontos da vitrine (só DM staff): abre o MESMO editor de pasta do Estúdio.
   Reuso total — dEditFolder popula/abre o #d-folder-modal e dConfirmFolder já
   re-renderiza a vitrine/home e faz o push pro backend ao salvar. */
function fEditCampFolder(folderId){
  if(typeof gIsAdmin!=='function' || !gIsAdmin()) return;   // gate de UX; RLS é a fronteira real
  if(typeof dEditFolder==='function') dEditFolder(folderId);
  else if(typeof gToast==='function') gToast('Não consegui abrir o editor. Recarregue a página.','error');
}
const _ICO_STATS='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V10M10 20V5M16 20v-7M22 20V3"/></svg>';
const _ICO_EDIT='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
const _ICO_ARCHIVE='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/></svg>';
// Menu do 3-pontos (só DM staff): Editar / Arquivar. Menu flutuante fixo posicionado no botão.
function fCampAdminMenu(ev, folderId){
  try{ ev.stopPropagation(); ev.preventDefault(); }catch(e){}
  fCloseCampAdminMenu();
  const btn = (ev.currentTarget) || (ev.target && ev.target.closest('.camp-admin-btn'));
  const menu = document.createElement('div');
  menu.className = 'camp-admin-menu';
  menu.innerHTML =
    `<button type="button" onclick="fCloseCampAdminMenu();fCampAnalyticsOpen('${folderId}')">${_ICO_STATS}<span>Analisar campanha</span></button>`+
    `<button type="button" onclick="fCloseCampAdminMenu();fEditCampFolder('${folderId}')">${_ICO_EDIT}<span>Editar campanha</span></button>`+
    `<button type="button" onclick="fCloseCampAdminMenu();fArchiveFolder('${folderId}')">${_ICO_ARCHIVE}<span>Arquivar campanha</span></button>`;
  document.body.appendChild(menu);
  if(btn){
    const r = btn.getBoundingClientRect();
    menu.style.top = (r.bottom + 4) + 'px';
    menu.style.left = Math.max(8, Math.min(r.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - 8)) + 'px';
  }
  // Fecha ao clicar fora / Esc. Timeout: não capturar o próprio clique que abriu.
  setTimeout(()=>{ document.addEventListener('click', fCloseCampAdminMenu, {once:true}); document.addEventListener('keydown', _fCampMenuEsc); }, 0);
}
/* ══ ANALISAR CAMPANHA (3-pontos, só DM staff) ══
   Painel flutuante com o que se sabe de uma campanha. Duas metades, com origens diferentes
   e rótulos diferentes — misturar as duas seria mentir:

   1. A CAMPANHA (sempre exata): vem de dFolders, que é o dado real do catálogo — materiais,
      quantos publicados, validade, formatos, última publicação.
   2. USO: tenta `luma.artes` no backend (o designer pode ter policy de leitura ampla) e,
      quando não vem nada, cai no histórico LOCAL — que é só deste dispositivo/usuário.
      O painel diz qual das duas está mostrando. As views `analytics.vw_*` não servem aqui:
      não têm grant pra `authenticated`, são de extração por SQL (LUMA-BACKEND-CHANGELOG).   */
function _fCampAnaFolder(folderId){
  return (typeof dFolders!=='undefined'&&dFolders)?dFolders.find(f=>f.id===folderId):null;
}
// Métricas estruturais — contadas na hora, sem cache que possa envelhecer.
function _fCampAnaEstrutura(f){
  const tpls=(f&&f.templates)||[];
  const pub=tpls.filter(t=>t&&t.publishMeta&&t.publishMeta.publicado);
  const validos=pub.filter(t=>(typeof fIsMaterialValid!=='function')||fIsMaterialValid(t));
  const fmts={};
  pub.forEach(t=>{ const k=t.fmt||'orig'; fmts[k]=(fmts[k]||0)+1; });
  const ultPub=pub.reduce((mx,t)=>Math.max(mx,(t.publishMeta&&t.publishMeta.publicadoEm)||0),0);
  // "Próxima validade" = a mais próxima AINDA NO FUTURO. Ordenar todas devolvia a validade
  // de um material já expirado (ex.: 2020-01-01), anunciando como "próxima" uma data vencida.
  const hoje=new Date().toISOString().slice(0,10);
  const validades=pub.map(t=>t.publishMeta&&t.publishMeta.validade).filter(v=>v&&v>=hoje).sort();
  return { total:tpls.length, publicados:pub.length, validos:validos.length,
    expirados:pub.length-validos.length, fmts, ultPub, proxValidade:validades[0]||null };
}
// Uso a partir do histórico local. `escopo` diz de quem são os números — o painel mostra isso.
function _fCampAnaUsoLocal(f){
  let hist=[];
  try{ hist=(typeof fGetHist==='function')?fGetHist():[]; }catch(e){}
  const ids=new Set([f.id, f.campId].filter(Boolean));
  const nome=(f.name||'').toLowerCase().trim();
  const meus=hist.filter(h=>h && (ids.has(h.campId) || (h.campName||'').toLowerCase().trim()===nome));
  const baixadas=meus.filter(h=>h.status==='baixada');
  // Material mais baixado: conta por materialId e resolve o nome no catálogo da pasta.
  const porMat={};
  baixadas.forEach(h=>{ const k=h.materialId||'(sem material)'; porMat[k]=(porMat[k]||0)+1; });
  const top=Object.keys(porMat).sort((a,b)=>porMat[b]-porMat[a]).slice(0,3).map(id=>{
    const t=((f.templates)||[]).find(x=>x&&x.id===id);
    return { nome:(t&&t.name)||'Material removido', n:porMat[id] };
  });
  const porFmt={};
  baixadas.forEach(h=>{ const k=h.fmtName||h.fmtId||'?'; porFmt[k]=(porFmt[k]||0)+1; });
  const ultima=meus.reduce((mx,h)=>Math.max(mx,h.tsBaixada||h.ts||0),0);
  const primeira=meus.reduce((mn,h)=>{ const t=h.ts||0; return (t&&(!mn||t<mn))?t:mn; },0);
  return { escopo:'local', geradas:meus.length, baixadas:baixadas.length, top, porFmt, ultima, primeira };
}
// Tenta o agregado real no backend. Devolve null quando não há sessão, não é admin, a RLS
// não deixa ver nada ou a campanha ainda não tem arte — e aí quem chama usa o local.
async function _fCampAnaUsoBackend(f){
  try{
    const sb=(typeof gSupabase==='function')?gSupabase():window.sb;
    if(!sb || typeof gIsAdmin!=='function' || !gIsAdmin()) return null;
    // Os UUIDs dos templates desta pasta — é por template_id que `artes` liga na campanha.
    const ids=((f.templates)||[]).map(t=>t&&t.remoteId).filter(Boolean);
    if(!ids.length) return null;
    const { data, error }=await sb.schema('luma').from('artes')
      .select('template_id,status,baixada_em,created_at,user_id').in('template_id', ids).limit(5000);
    if(error || !data || !data.length) return null;
    const baixadas=data.filter(r=>r.status==='baixada');
    const porMat={};
    baixadas.forEach(r=>{ porMat[r.template_id]=(porMat[r.template_id]||0)+1; });
    const top=Object.keys(porMat).sort((a,b)=>porMat[b]-porMat[a]).slice(0,3).map(rid=>{
      const t=((f.templates)||[]).find(x=>x&&x.remoteId===rid);
      return { nome:(t&&t.name)||'Material removido', n:porMat[rid] };
    });
    const ts=v=>v?new Date(v).getTime():0;
    return { escopo:'backend', geradas:data.length, baixadas:baixadas.length, top, porFmt:null,
      lojas:new Set(data.map(r=>r.user_id).filter(Boolean)).size,
      ultima:data.reduce((mx,r)=>Math.max(mx,ts(r.baixada_em),ts(r.created_at)),0),
      primeira:data.reduce((mn,r)=>{ const t=ts(r.created_at); return (t&&(!mn||t<mn))?t:mn; },0) };
  }catch(e){ return null; }
}
function _fCampAnaData(t){
  if(!t) return '—';
  try{ return new Date(t).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}); }catch(e){ return '—'; }
}
function fCampAnalyticsClose(){
  const el=document.getElementById('f-camp-ana');
  if(el) el.remove();
  document.removeEventListener('keydown', _fCampAnaEsc);
}
function _fCampAnaEsc(e){ if(e.key==='Escape'){ e.preventDefault(); fCampAnalyticsClose(); } }
async function fCampAnalyticsOpen(folderId){
  if(typeof gIsAdmin!=='function' || !gIsAdmin()) return;  // gate de UX; RLS é a fronteira real
  const f=_fCampAnaFolder(folderId);
  if(!f){ if(typeof gToast==='function') gToast('Não achei essa campanha.','error'); return; }
  fCampAnalyticsClose();
  const e=_fCampAnaEstrutura(f);
  const box=document.createElement('div');
  box.id='f-camp-ana'; box.className='camp-ana-overlay';
  box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true');
  box.setAttribute('aria-label','Análise da campanha '+(f.name||''));
  box.onclick=(ev)=>{ if(ev.target===box) fCampAnalyticsClose(); };
  const fmtLista=Object.keys(e.fmts).map(k=>`<span class="camp-ana-chip">${gEsc(k)} · ${e.fmts[k]}</span>`).join('')
    || '<span class="camp-ana-empty">nenhum material publicado</span>';
  box.innerHTML=`<div class="camp-ana-box">
    <div class="camp-ana-head">
      <span class="camp-ana-dot" style="background:${gEsc(f.color||'#FF9000')}"></span>
      <div class="camp-ana-title"><span>Análise da campanha</span><strong>${gEsc(f.name||'Campanha')}</strong></div>
      <button type="button" class="camp-ana-x" onclick="fCampAnalyticsClose()" aria-label="Fechar análise">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
    </div>
    <div class="camp-ana-body">
      <div class="camp-ana-sec">
        <span class="camp-ana-sec-t">A campanha</span>
        <div class="camp-ana-grid">
          <div class="camp-ana-kpi"><strong>${e.publicados}</strong><small>publicados</small></div>
          <div class="camp-ana-kpi"><strong>${e.validos}</strong><small>no ar agora</small></div>
          <div class="camp-ana-kpi${e.expirados?' is-warn':''}"><strong>${e.expirados}</strong><small>expirados</small></div>
          <div class="camp-ana-kpi"><strong>${e.total}</strong><small>no total</small></div>
        </div>
        <div class="camp-ana-rows">
          <div><span>Formatos</span><div class="camp-ana-chips">${fmtLista}</div></div>
          <div><span>Última publicação</span><strong>${_fCampAnaData(e.ultPub)}</strong></div>
          ${e.proxValidade?`<div><span>Próxima validade</span><strong>${gEsc(e.proxValidade)}</strong></div>`:''}
          <div><span>Situação</span><strong>${f.ativa===false?'Arquivada':'Ativa'}</strong></div>
        </div>
      </div>
      <div class="camp-ana-sec" id="f-camp-ana-uso">
        <span class="camp-ana-sec-t">Uso</span>
        <div class="camp-ana-loading">Consultando…</div>
      </div>
    </div>
  </div>`;
  document.body.appendChild(box);
  document.addEventListener('keydown', _fCampAnaEsc);
  // Uso vem depois: a consulta ao backend é assíncrona e o painel não deve esperar por ela.
  const uso=(await _fCampAnaUsoBackend(f)) || _fCampAnaUsoLocal(f);
  const alvo=document.getElementById('f-camp-ana-uso');
  if(!alvo) return; // fechou antes da resposta
  const topLista=uso.top.length
    ? uso.top.map((t,i)=>`<div class="camp-ana-top"><span class="camp-ana-rank">${i+1}</span><span class="camp-ana-top-n">${gEsc(t.nome)}</span><strong>${t.n}</strong></div>`).join('')
    : '<span class="camp-ana-empty">nenhuma arte baixada ainda</span>';
  const taxa=uso.geradas?Math.round(uso.baixadas/uso.geradas*100):0;
  const fmtUso=(uso.porFmt&&Object.keys(uso.porFmt).length)
    ? Object.keys(uso.porFmt).sort((a,b)=>uso.porFmt[b]-uso.porFmt[a])
        .map(k=>`<span class="camp-ana-chip">${gEsc(k)} · ${uso.porFmt[k]}</span>`).join('')
    : '';
  // Rótulo honesto da origem: o número local é de UM dispositivo e não representa a rede.
  const origem=uso.escopo==='backend'
    ? `<div class="camp-ana-src">Dados de todas as lojas${uso.lojas?' · '+uso.lojas+' loja'+(uso.lojas===1?'':'s'):''}</div>`
    : `<div class="camp-ana-src is-local">Só deste dispositivo — o total da rede sai por extração SQL (o Luma não guarda esse agregado no app)</div>`;
  alvo.innerHTML=`<span class="camp-ana-sec-t">Uso</span>
    <div class="camp-ana-grid">
      <div class="camp-ana-kpi"><strong>${uso.geradas}</strong><small>artes geradas</small></div>
      <div class="camp-ana-kpi"><strong>${uso.baixadas}</strong><small>baixadas</small></div>
      <div class="camp-ana-kpi"><strong>${taxa}%</strong><small>taxa de download</small></div>
    </div>
    <div class="camp-ana-rows">
      <div><span>Mais baixados</span><div class="camp-ana-tops">${topLista}</div></div>
      ${fmtUso?`<div><span>Por formato</span><div class="camp-ana-chips">${fmtUso}</div></div>`:''}
      <div><span>Primeira arte</span><strong>${_fCampAnaData(uso.primeira)}</strong></div>
      <div><span>Última atividade</span><strong>${_fCampAnaData(uso.ultima)}</strong></div>
    </div>
    ${origem}`;
}

function _fCampMenuEsc(e){ if(e.key==='Escape') fCloseCampAdminMenu(); }
function fCloseCampAdminMenu(){
  document.querySelectorAll('.camp-admin-menu').forEach(m=>m.remove());
  document.removeEventListener('keydown', _fCampMenuEsc);
}
// Arquivar/desarquivar = flag na pasta + dPersistFolders (local + push pro backend, gated gIsAdmin
// lá dentro — mesmo caminho de save do editor). ativa:!arquivada some/volta pra vitrine de todos.
function fArchiveFolder(folderId){
  if(typeof gIsAdmin!=='function' || !gIsAdmin()) return;
  const f = (typeof dFolders!=='undefined' && dFolders) ? dFolders.find(x=>x.id===folderId) : null;
  if(!f){ if(typeof gToast==='function') gToast('Não achei essa campanha.','error'); return; }
  f.arquivada = true;
  if(typeof dPersistFolders==='function') dPersistFolders();
  fRestoreCatalog();
  if(document.body.classList.contains('f-home-mode') && typeof fRenderHome==='function') fRenderHome({silent:true});
  if(typeof gToast==='function') gToast(`Campanha "${f.name}" arquivada.`);
}
function fUnarchiveFolder(folderId){
  if(typeof gIsAdmin!=='function' || !gIsAdmin()) return;
  const f = (typeof dFolders!=='undefined' && dFolders) ? dFolders.find(x=>x.id===folderId) : null;
  if(!f) return;
  f.arquivada = false;
  if(typeof dPersistFolders==='function') dPersistFolders();
  fRenderArchivedPanel();   // atualiza a lista do painel (item saiu)
  fRestoreCatalog();        // volta pra vitrine por trás
  if(typeof gToast==='function') gToast(`Campanha "${f.name}" desarquivada.`);
}

/* ── PAINEL DE CAMPANHAS ARQUIVADAS (só DM staff) ── */
function fOpenArchivedPanel(){
  if(typeof gIsAdmin!=='function' || !gIsAdmin()) return;
  let host=document.getElementById('f-archived-panel');
  if(!host){
    host=document.createElement('div'); host.id='f-archived-panel';
    host.addEventListener('click',(e)=>{ if(e.target===host) fCloseArchivedPanel(); });
    document.body.appendChild(host);
  }
  document.addEventListener('keydown', _fArchEsc);
  fRenderArchivedPanel();
}
function _fArchEsc(e){ if(e.key==='Escape') fCloseArchivedPanel(); }
function fCloseArchivedPanel(){
  const host=document.getElementById('f-archived-panel'); if(host) host.remove();
  document.removeEventListener('keydown', _fArchEsc);
}
function fRenderArchivedPanel(){
  const host=document.getElementById('f-archived-panel'); if(!host) return;
  const arq=(typeof fGetArchivedCamps==='function')?fGetArchivedCamps():[];
  const _icoClose='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  const cards = arq.length
    ? `<div class="f-arch-grid">${arq.map(c=>{
        const coverSafe=gEsc(c.cover||'').replace(/'/g,'%27');
        const style=c.cover?`background-image:url('${coverSafe}');background-size:cover;background-position:center`:`background:${gEsc(c.color||'var(--dm-orange)')}`;
        return `<div class="f-arch-card">
          <div class="f-arch-thumb" style="${style}">${c.badge?`<span class="f-arch-badge">${gEsc(c.badge)}</span>`:''}</div>
          <div class="f-arch-info"><div class="f-arch-name">${gEsc(c.name||'Campanha')}</div>
            <button type="button" class="f-arch-unbtn" onclick="fUnarchiveFolder('${c._folderId}')">Desarquivar</button>
          </div>
        </div>`;
      }).join('')}</div>`
    : `<p class="f-arch-empty">Nenhuma campanha arquivada. Ao arquivar uma campanha pelos 3-pontos, ela aparece aqui.</p>`;
  host.innerHTML=`<div class="f-arch-box" role="dialog" aria-modal="true" aria-label="Campanhas arquivadas">
    <div class="f-arch-head">
      <h2>Campanhas arquivadas${arq.length?` · ${arq.length}`:''}</h2>
      <button type="button" class="f-arch-close" onclick="fCloseArchivedPanel()" aria-label="Fechar">${_icoClose}</button>
    </div>
    <div class="f-arch-body">${cards}</div>
  </div>`;
}
function fFolderForCamp(c){
  if(typeof dFolders==='undefined'||!dFolders||!c)return null;
  // Duas pastas podem casar com a MESMA campanha (a semente do CAMPS_* e uma pasta real
  // do banco com o mesmo nome). Entre as que casam, a SINCRONIZADA manda: é ela que o
  // designer edita e a que sobrevive ao próximo pull. Sem isso a vitrine lia a semente e
  // a capa nova "não pegava" — trocar a foto do banner não surtia efeito nenhum.
  const _preferSync = arr => arr.find(f=>f&&f.remoteId) || arr[0] || null;
  const porCamp = dFolders.filter(f=>f&&f.campId===c.id);
  if(porCamp.length) return _preferSync(porCamp);
  const porNome = dFolders.filter(f=>f&&f.name===c.name);
  if(porNome.length) return _preferSync(porNome);
  // 3º match: campanha dinâmica (criada no Estúdio) usa o id da própria pasta como camp.id
  return dFolders.find(f=>f&&(f.remoteId===c.id||f.id===c.id)) || null;
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

function fCampEl(c,isRec,ghost){
  // F-06: thumb mostra prévia real com produto e preço
  const previewProd = c.previewProd || c.name;
  const previewPor = c.previewPor || '';
  const previewDe = c.previewDe || '';
  // Capa: SÓ a capa da própria pasta (fCampCover) > cor da marca. Nunca o material de
  // dentro: a miniatura renderizada mostrava a arte com os campos VAZIOS (retângulo em
  // branco, o "card invisível" no boot) e trocava a identidade da campanha pelo conteúdo.
  const cover = fCampCover(c);
  // Degradação graciosa: a cor da campanha fica POR BAIXO da imagem — se a capa faltar (404),
  // o card mostra a cor da marca em vez de um retângulo branco.
  // Scrim (gradiente topo+base) por cima da capa → badges legíveis mesmo em fotos claras.
  const coverSafe = cover && gEsc(cover).replace(/'/g,'%27'); // %27: neutraliza o ' que fecharia o url('…') — mesmo padrão das outras 2 ocorrências
  const thumbStyle = cover
    ? `background-color:${c.color};background-image:url('${coverSafe}');background-size:cover;background-position:center`
    : `background:${c.color}`;
  // Conta só materiais VÁLIDOS (fIsMaterialValid) — expirados saíam da tela de dentro
  // mas continuavam no contador do card ("4 materiais" com 3 vencidos = vitrine mentindo).
  const mats = (typeof fGetMaterialsForCamp==='function')
    ? fGetMaterialsForCamp(c.id).filter(m=>(typeof fIsMaterialValid!=='function')||fIsMaterialValid(m)) : [];
  const countLabel = ghost ? 'Materiais em breve' : (mats.length ? `${mats.length} ${mats.length!==1?'materiais':'material'}` : 'Sem materiais');
  const _icoClock='<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1px;margin-right:3px"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  // F: favorito (fixar no topo) + badge "novo" (material publicado depois da última visita).
  const _isFav = !ghost && typeof fIsFav==='function' && fIsFav(c.id);
  const favBtn = ghost ? '' : `<button class="camp-fav${_isFav?' is-fav':''}" onclick="fToggleFav('${c.id}',event)" aria-pressed="${_isFav}" aria-label="${_isFav?'Remover das favoritas':'Fixar nas favoritas'}" title="${_isFav?'Remover das favoritas':'Fixar nas favoritas'}"><svg width="14" height="14" viewBox="0 0 24 24" fill="${_isFav?'currentColor':'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></button>`;
  const _hasNew = !ghost && typeof fCampHasNew==='function' && fCampHasNew(c);
  // 3-pontos "editar campanha" — só DM staff (gIsAdmin) E campanha com PASTA real (dFolders).
  // Campanha hardcoded do config não tem pasta → não é editável (é código). Gate de UX; a
  // segurança real é a RLS is_designer() no backend.
  const _campFolder = (!ghost && typeof gIsAdmin==='function' && gIsAdmin() && typeof fFolderForCamp==='function') ? fFolderForCamp(c) : null;
  const adminBtn = _campFolder ? `<button class="camp-admin-btn" onclick="fCampAdminMenu(event,'${_campFolder.id}')" aria-label="Ações da campanha" title="Ações da campanha"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg></button>` : '';
  // Campanha com tema (Much+): o card carrega o atributo e o CSS faz o convite
  // (badge magenta + shine 1x + aura no hover) ANTES do clique. Slug já sai sanitizado.
  const _tema=(typeof _fCampThemeOf==='function')?_fCampThemeOf(c):'';
  return `<div class="camp-card ${!ghost&&fState.camp&&c.id===fState.camp.id?'selected':''} ${isRec?'recommended':''}${ghost?' ghost':''}"${_tema?` data-camp-theme="${_tema}"`:''}${ghost?' aria-disabled="true"':` role="button" tabindex="0" aria-label="Abrir campanha ${gEsc(c.name)}" onclick="fSelectCamp('${c.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();fSelectCamp('${c.id}')}"`}>
    ${favBtn}
    ${adminBtn}
    ${ghost?'':`<div class="camp-prev-btn" onclick="event.stopPropagation();fOpenPreview(event,'${c.id}')">PRÉVIA</div>`}
    <div class="camp-thumb ${cover?'has-cover':''}" style="${thumbStyle}">
      ${c.badge?`<div class="camp-badge">${gEsc(c.badge)}</div>`:''}
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
/* ── SEAM DAS CAMPANHAS (Fase 2 — migração do hardcode) ──
   TODA leitura de campanha do franqueado passa por aqui (fGetCampaigns/fResolveCamp) —
   nunca por CAMPS_* direto. Hoje devolve as constantes (comportamento idêntico ao legado);
   o flip pra luma.pastas (dFolders) muda SÓ este ponto, com CAMPS_* virando seed. */
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
        if(!f || f.id==='f-modelo' || f.id==='f-rascunhos') return; // exemplo/rascunhos não são campanha
        if(f.campId && ids.has(f.campId)) return;        // já listada via config
        if(nomes.has(f.name)) return;                    // mesma campanha (match por nome)
        ativas.push({
          // remoteId (estável pós-sync) > id local; histórico/artes gravam este id
          id:f.campId||f.remoteId||f.id, name:f.name, color:f.color||'#FF9000',
          cover:'', count:(f.templates||[]).length, badge:f.badge||'',
          theme:f.theme||'', // pasta pode carregar tema próprio (ex.: Much+) — ver fApplyCampTheme
          expiraDias:f.expiraDias, popular:!!f.popular,
          previewProd:f.previewProd||'', previewDe:f.previewDe||'', previewPor:f.previewPor||'',
          perguntas:Array.isArray(f.perguntas)?f.perguntas:[]
        });
      });
    }
  }catch(e){}
  // Campanha ARQUIVADA (pasta com arquivada=true) some da vitrine — vale tanto pra campanha
  // dinâmica (id=pasta) quanto pra config cuja pasta foi arquivada. fResolveCamp/fFolderForCamp
  // continuam achando a arquivada por id, então o painel de arquivadas ainda a resolve.
  const _naoArq = (c)=>{ const ff=(typeof fFolderForCamp==='function')?fFolderForCamp(c):null; return !(ff && ff.arquivada); };
  return {ativas:ativas.filter(_naoArq), outras:CAMPS_OUTRAS.filter(_naoArq), impl:(typeof CAMPS_IMPLEMENTACAO!=='undefined')?CAMPS_IMPLEMENTACAO:[]};
}
// Só as pastas arquivadas (pro painel admin). Resolve nome/capa pela própria pasta.
function fGetArchivedCamps(){
  if(typeof dFolders==='undefined' || !dFolders) return [];
  return dFolders.filter(f=>f && f.arquivada && f.id!=='f-modelo').map(f=>({
    id:f.campId||f.remoteId||f.id, name:f.name, color:f.color||'#FF9000', cover:f.cover||'',
    badge:f.badge||'', _folderId:f.id
  }));
}
// Pool padrão (ativas+outras) — a forma mais consumida no app inteiro.
function fAllCampaigns(){ const {ativas,outras}=fGetCampaigns(); return [...ativas,...outras]; }
function fResolveCamp(id){
  const {ativas,outras,impl}=fGetCampaigns();
  const pool=[...ativas,...outras];
  return pool.find(x=>x.id===id)
      || pool.find(x=>x.campId===id)
      || [...pool,...impl].find(x=>x.id===id)
      || null;
}

/* ── CATEGORIAS (CAMPANHAS / IMPLEMENTAÇÃO) ── */
const _ICO_BACK=`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`;
const _ICO_CHEV=`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

// Chooser Campanhas/Implementação removido (redundante com a lista de Campanhas que
// já abre em seguida). Implementação vira módulo próprio no futuro — por ora, o
// catálogo abre direto em Campanhas. fSelectCategoria/fRenderImplementacao continuam
// aqui pra quem entra numa campanha de implementação direto pela home (fSelectCamp).
function fRenderCategorias(){
  fSelectCategoria('campanhas');
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
  fSelectCategoria('campanhas');
}
function fRenderImplementacao(){
  const cat=document.getElementById('f-catalog'); if(!cat)return;
  cat.innerHTML=`
    <div class="cat-back-row">
      <button class="cat-back-btn" onclick="fVoltarCategoria()">${_ICO_BACK} Campanhas</button>
      <span class="cat-back-label">Implementação</span>
    </div>
    <div class="sec-title">Etapas de lançamento</div>
    <div class="camp-grid">${fGetCampaigns().impl.map(c=>fCampEl(c,false)).join('')}</div>`;
}
function fRestoreCatalog(){
  // ⚠ NÃO remover o tema de campanha aqui: isto é re-render do RAIL e roda com o
  // franqueado dentro da campanha (favoritar chamava isto e derrubava o tema Much+
  // no meio do fluxo). Saída de verdade: fGoHome / fCloseMaterialCatalog.
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
  // Entrada do painel de arquivadas — só DM staff e só quando há campanha arquivada.
  const _arqN = (typeof gIsAdmin==='function' && gIsAdmin() && typeof fGetArchivedCamps==='function') ? fGetArchivedCamps().length : 0;
  const archBtn = _arqN ? `<button class="cat-arch-btn" onclick="fOpenArchivedPanel()" title="Ver campanhas arquivadas"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/></svg>Arquivadas · ${_arqN}</button>` : '';
  // Campanhas é a tela inicial agora (chooser removido) — sem "voltar", só o atalho de arquivadas quando existe.
  const backRow=archBtn?`<div class="cat-back-row">${archBtn}</div>`:'';
  // Sem nenhuma campanha → empty state (nunca títulos sobre grid vazio)
  if(!a.length && !o.length){ cat.innerHTML=backRow+_fCampEmptyState(searching?opts.search:null); return; }
  // "Recomendada agora" só fora da busca (senão fica um título órfão)
  const rec=searching?null:(a.find(c=>c.popular)||null);
  cat.innerHTML=backRow+`
    ${rec?`<div class="sec-title">A campanha do momento</div>
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
    // Reabrir a MESMA campanha (pasta ou chat ainda abertos atrás da home): o
    // fGoHome despiu o tema — reveste em TODOS os caminhos daqui pra baixo
    // (early-return dos materiais E o fluxo de chat com dados, que segue pro
    // fAskCampSwitch sem passar pelo fOpenMaterialCatalog).
    if(typeof fApplyCampTheme==='function') fApplyCampTheme(c);
    if(fState.materialView) return;
  }
  // Abrir outra pasta NÃO pergunta nada. A confirmação "Trocar pra X? Você vai perder o
  // progresso" travava o gesto mais banal do catálogo (voltar pra home → abrir outra pasta)
  // e a perda que ela anunciava nem era real: o rascunho é salvo por campanha+material
  // (luma_chat_draft) e volta a ser oferecido quando a pessoa reabre aquele material.
  // O reset do estado, porém, é obrigatório: sem ele as respostas da campanha anterior
  // vazam pré-preenchidas nos passos da nova (fNextStep rehidrata de fState.dados).
  if(fState.camp && fState.camp.id!==c.id){
    fState.stepIdx=-1; fState.dados={}; fState.done=false; fState.material=null;
  }
  fState.camp=c;
  try{ localStorage.setItem('__luma_camp', c.id); }catch(e){} // F5 reabre esta campanha (gRestoreFranqueado)
  // Vindo da home (categoria ainda null): abre o rail na lista certa, não nos cards de categoria
  if(!fState.categoria){
    const isImpl=fGetCampaigns().impl.some(x=>x.id===c.id);
    fState.categoria=isImpl?'implementacao':'campanhas';
  }
  fRestoreCatalog();
  fUpdateCtx();
  // Funil campanha → material → arte (contrato do schema: camp_id/camp_name)
  if(typeof gTrackEvent==='function') gTrackEvent('campanha_aberta',{camp_id:c.id, camp_name:c.name||''});
  fOpenMaterialCatalog(c);
}

/* ══════════════════════════════════════════════════════════════
   HOME DO FRANQUEADO — estado inicial em tela cheia (vitrine).
   fGoHome/fExitHome ligam/desligam o modo via body.f-home-mode;
   os fluxos existentes (materiais → chat → prévia) ficam intactos.
══════════════════════════════════════════════════════════════ */
function fGoHome(opts){
  // Voltar ao menu renderiza SILENT (sem .fh-anim). A cascata animada dependia do reveal
  // pôr .in nos cards, e no retorno os cards ficavam presos em opacity:0 (CSS gPopIn
  // backwards) — o menu "não carregava". Silent = cards visíveis na hora. Boot já é silent.
  opts=opts||{silent:true};
  // Home = nenhuma campanha aberta → o F5 não deve reabrir nada. (Boot lê __luma_camp ANTES
  // deste clear, em gOnLoginSuccess, então o fGoHome do próprio boot não apaga o restore.)
  if(!opts.boot){ try{ localStorage.removeItem('__luma_camp'); }catch(e){} }
  if(typeof fRemoveCampTheme==='function') fRemoveCampTheme();
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
    // Nome completo a partir do nome real OU do prefixo do email: tira o domínio (@),
    // quebra em espaço/ponto/_/- e capitaliza cada palavra. "ryan.motta" → "Ryan Motta".
    n=dn.trim().split('@')[0].split(/[\s._-]+/).filter(Boolean)
        .map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
  }catch(e){}
  return g+(n?', '+gEsc(n):'');
}

// Card de rascunho da fila "Continuar de onde parou" (dados vêm do usuário → escapar)
function _fHomeDraftEl(hEntry){
  const name=gEsc(hEntry.prod||hEntry.campName||'Arte');
  const fmt=gEsc(hEntry.fmtName||'');
  const when=(typeof fFormatHistDate==='function')?fFormatHistDate(hEntry.ts):'';
  const camp=(typeof fResolveCamp==='function')?fResolveCamp(hEntry.campId):null;
  const cover=camp?fCampCover(camp):'';   // capa da pasta, nunca a arte de dentro
  const coverSafe=gEsc(cover).replace(/'/g,'%27');
  const colorSafe=gEsc(hEntry.campColor||(camp&&camp.color)||'var(--dm-orange)');
  const thumbStyle=cover
    ?`background-color:${colorSafe};background-image:url('${coverSafe}');background-size:cover;background-position:center`
    :`background-color:${colorSafe}`;
  let pct=0, summaryVal='';
  if(hEntry.dados && camp && camp.perguntas && camp.perguntas.length){
    const filled=camp.perguntas.filter(p=>hEntry.dados[p.id]!=null && hEntry.dados[p.id]!=='').length;
    pct=Math.round((filled/camp.perguntas.length)*100);
    const firstKey=Object.keys(hEntry.dados).find(k=>hEntry.dados[k] && typeof hEntry.dados[k]==='string' && !hEntry.dados[k].startsWith('data:image'));
    if(firstKey) summaryVal=hEntry.dados[firstKey];
  }
  return `<button class="fh-draft" type="button" onclick="fHomeResume(${hEntry.id})" aria-label="Continuar ${name}${fmt?', formato '+fmt:''}">
    <div class="fh-draft-th" style="${thumbStyle}" aria-hidden="true">
      <span>${fmt||'Arte'}</span>
    </div>
    <div class="fh-draft-info">
      <div class="fh-draft-status"><span></span> Em andamento${pct?` · ${pct}%`:''}</div>
      <div class="fh-draft-name">${name}</div>
      <div class="fh-draft-meta">${summaryVal?gEsc(summaryVal)+' · ':''}${gEsc(hEntry.campName||'Campanha')}${fmt?' · '+fmt:''}</div>
      <div class="fh-draft-foot"><time>${when}</time><span class="fh-draft-progress" aria-hidden="true" title="${pct}% concluído"><i style="width:${pct||50}%"></i></span></div>
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
  const cover=fCampCover(rec);   // capa da pasta, nunca a arte de dentro
  // Mesma régua do card: só materiais válidos (expirado não conta no hero)
  const mats=(typeof fGetMaterialsForCamp==='function')
    ?fGetMaterialsForCamp(rec.id).filter(m=>(typeof fIsMaterialValid!=='function')||fIsMaterialValid(m)):[];
  const matLabel=mats.length?`${mats.length} ${mats.length!==1?'materiais':'material'}`:'Materiais em breve';
  const coverSafe=gEsc(cover).replace(/'/g,'%27');   // %27: neutraliza o ' que fecharia o url('…')
  const colorSafe=gEsc(rec.color||'var(--dm-orange)');
  const coverStyle=cover
    ?`background-color:${colorSafe};background-image:url('${coverSafe}');background-size:cover;background-position:center`
    :`background-color:${colorSafe}`;
  const fmtNames=[...new Set(mats.map(m=>({story:'Story 9:16',feed:'Feed 1:1',wide:'Post wide',post:'Post wide'}[m.fmt]||'Material')))];
  const _star='<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:-1.5px"><polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9"/></svg>';
  const _temaHero=(typeof _fCampThemeOf==='function')?_fCampThemeOf(rec):''; // mesmo convite do card, no hero
  // 3-pontos do hero (só DM staff + campanha com pasta real): mesmo menu do card, mesma
  // função. Faltava justo AQUI — trocar a capa do banner exigia caçar a pasta no Estúdio,
  // porque o card tinha o atalho e o banner não. Fica FORA do <button class="fh-hero">:
  // botão dentro de botão é HTML inválido e o clique não chega.
  const _heroFolder=(typeof gIsAdmin==='function'&&gIsAdmin()&&typeof fFolderForCamp==='function')?fFolderForCamp(rec):null;
  const heroAdmin=_heroFolder
    ? `<button class="camp-admin-btn fh-hero-admin" onclick="fCampAdminMenu(event,'${_heroFolder.id}')" aria-label="Ações da campanha em destaque" title="Editar campanha, capa e mais"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg></button>`
    : '';
  return `<section class="fh-featured" aria-label="Campanha recomendada">
  ${heroAdmin}
  <button class="fh-hero" type="button"${_temaHero?` data-camp-theme="${_temaHero}"`:''} onclick="fSelectCamp('${rec.id}')" aria-label="Abrir campanha ${gEsc(rec.name)}">
    <div class="fh-hero-cover" style="${coverStyle}">
      ${rec.badge?`<span class="fh-hero-badge">${gEsc(rec.badge)}</span>`:''}
      ${cover?'':`<div class="fh-hero-prod">${gEsc(rec.previewProd||rec.name)}</div>`}
      <span class="fh-hero-cover-note">Campanha em destaque</span>
    </div>
    <div class="fh-hero-body">
      <span class="fh-hero-eyebrow">${_star} EM DESTAQUE NESTA SEMANA</span>
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

// Filtro de status da vitrine (independente do texto buscado). Reseta ao recarregar —
// não é preferência de conta, é só o estado momentâneo da navegação.
let _fhFilter='todas';
const _FH_FILTERS=[
  {id:'todas',label:'Todas'},
  {id:'prontas',label:'Prontas para usar'},
  {id:'favoritas',label:'Favoritas'}
];
function _fhEmptyState(title,sub){
  return `<div class="fh-empty"><span class="fh-empty-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg></span><strong>${title}</strong><span>${sub}</span></div>`;
}
function _fhFilterPanelHTML(){
  return _FH_FILTERS.map(f=>`<button type="button" class="fh-filter-opt${_fhFilter===f.id?' is-current':''}" role="menuitemradio" aria-checked="${_fhFilter===f.id}" onclick="fHomeSetFilter('${f.id}')">${gEsc(f.label)}${_fhFilter===f.id?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>':''}</button>`).join('');
}
// Painel de filtro: abre/fecha como o menu do 3-pontos (fCampAdminMenu) — fora do
// clique/Esc fecha; listener em {once:true} porque reabre a cada toggle.
function fHomeToggleFilter(btn,ev){
  try{ ev.stopPropagation(); }catch(e){}
  const panel=document.getElementById('fh-filter-panel'); if(!panel)return;
  const willOpen=!panel.classList.contains('open');
  panel.classList.toggle('open',willOpen);
  btn.setAttribute('aria-expanded',willOpen?'true':'false');
  if(willOpen){
    setTimeout(()=>{ document.addEventListener('click',fHomeCloseFilterPanel,{once:true}); document.addEventListener('keydown',_fhFilterEsc); },0);
  }
}
function fHomeCloseFilterPanel(){
  const panel=document.getElementById('fh-filter-panel'); if(!panel)return;
  panel.classList.remove('open');
  const btn=document.querySelector('.fh-filter-btn'); if(btn) btn.setAttribute('aria-expanded','false');
  document.removeEventListener('keydown',_fhFilterEsc);
}
function _fhFilterEsc(e){ if(e.key==='Escape') fHomeCloseFilterPanel(); }
function fHomeSetFilter(id){
  _fhFilter=id;
  fHomeCloseFilterPanel();
  const wrap=document.querySelector('.fh-filter-wrap');
  if(wrap){
    const panel=wrap.querySelector('.fh-filter-panel'); if(panel) panel.innerHTML=_fhFilterPanelHTML();
    const btn=wrap.querySelector('.fh-filter-btn');
    if(btn){
      btn.classList.toggle('is-active',id!=='todas');
      let dot=btn.querySelector('.fh-filter-dot');
      if(id!=='todas'&&!dot) btn.insertAdjacentHTML('beforeend','<span class="fh-filter-dot" aria-hidden="true"></span>');
      else if(id==='todas'&&dot) dot.remove();
    }
  }
  const s=document.getElementById('fh-search');
  fHomeFilter(s?s.value:'');
}

// Corpo da home (seções). query preenchida = modo busca (lista achatada de resultados).
// _fhFilter aplica por cima: tanto na busca quanto na vitrine parada.
function _fHomeBodyHTML(query){
  const q=(query||'').trim().toLowerCase();
  const {ativas,outras}=fGetCampaigns();
  const impl=fGetCampaigns().impl;
  let favIds=[]; try{ favIds=fGetFavs(); }catch(e){}
  const passStatus=c=>{
    if(_fhFilter==='favoritas') return favIds.includes(c.id);
    if(_fhFilter==='prontas') return _fCampHasMats(c);
    if(_fhFilter==='embreve') return !_fCampHasMats(c);
    return true;
  };
  if(q){
    const match=[...ativas,...outras,...impl].filter(c=>c.name.toLowerCase().includes(q)&&passStatus(c));
    if(!match.length) return _fhEmptyState('Nenhuma campanha encontrada',`Não encontramos resultados para “${gEsc(query)}”. Tente outro termo${_fhFilter!=='todas'?' ou remova o filtro':''}.`);
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
  // Filtro de status ativo (≠ todas): vitrine vira lista única e enxuta, sem hero/rascunhos.
  if(_fhFilter==='prontas'){
    if(!prontas.length) return _fhEmptyState('Nenhuma campanha pronta agora','Todas as campanhas do catálogo já estão prontas para usar.');
    return `<section class="fh-section fh-results"><div class="fh-sec"><span>Prontas para usar</span><em>${prontas.length} campanha${prontas.length!==1?'s':''}</em></div>
      <div class="camp-grid fh-grid">${prontas.map(c=>fCampEl(c,false)).join('')}</div></section>`;
  }
  if(_fhFilter==='favoritas'){
    const favs=favIds.map(id=>pool.find(c=>c.id===id)).filter(Boolean);
    if(!favs.length) return _fhEmptyState('Nenhuma favorita ainda','Fixe uma campanha para encontrá-la rápido por aqui.');
    return `<section class="fh-section fh-results"><div class="fh-sec"><span>Favoritas</span><em>${favs.length} fixada${favs.length!==1?'s':''}</em></div>
      <div class="camp-grid fh-grid">${favs.map(c=>fCampEl(c,false,!_fCampHasMats(c))).join('')}</div></section>`;
  }
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
    ${drafts.length?`<section class="fh-section fh-continue"><div class="fh-sec"><span>Continue de onde parou</span><em>Seus rascunhos mais recentes</em></div>
    <div class="fh-cont">${drafts.map(_fHomeDraftEl).join('')}</div></section>`:''}
    ${favs.length?`<section class="fh-section"><div class="fh-sec"><span>Favoritas</span><em>${favs.length} fixada${favs.length!==1?'s':''}</em></div>
    <div class="camp-grid fh-grid">${favs.map(c=>fCampEl(c,false,!_fCampHasMats(c))).join('')}</div></section>`:''}
    ${rec?_fHomeHeroEl(rec):''}
    ${gridProntas.length?`<section class="fh-section"><div class="fh-sec"><span>Prontas para usar</span><em>${gridProntas.length} campanha${gridProntas.length!==1?'s':''} disponíveis</em></div>
    <div class="camp-grid fh-grid">${gridProntas.map(c=>fCampEl(c,false)).join('')}</div></section>`:''}`;
}

/* ── Revelação por rolagem ─────────────────────────────────────
   Cada bloco do corpo da home (#fh-body>*) entra quando aparece no viewport
   (IntersectionObserver com root no próprio #f-home). --bi = índice dentro do
   lote revelado junto (stagger); os cards herdam via --ci. Sem .fh-anim
   (refresh silencioso, busca) ou com reduced-motion, tudo fica visível na hora. */
let _fhRevealIO=null;
let _fhRevealGen=0;
function _fhSetupReveal(){
  const home=document.getElementById('f-home'); if(!home)return;
  const gen=++_fhRevealGen;
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
  // Rede de segurança: revela quem o observer não pegou. Sem gen-guard — adicionar .in é
  // idempotente, e o guard fazia um render que corria com o sync (fHomeRefreshIfIdle)
  // abortar a revelação, deixando os cards invisíveis pra sempre.
  setTimeout(()=>{
    const h=document.getElementById('f-home'); if(!h)return;
    h.querySelectorAll('#fh-body>*:not(.in)').forEach(b=>b.classList.add('in'));
  },700);
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
        <div class="fh-kicker">Luma Franqueado</div>
        <h1 class="fh-greet">${fHomeGreeting()}</h1>
        <p class="fh-sub">Qual arte vamos criar hoje?</p>
      </div>
      <div class="fh-head-actions">
        <button class="fh-help" type="button" onclick="gOpenHelp(this)" data-help-trigger aria-controls="g-help-modal" aria-expanded="false"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.3 2.3 0 1 1 3.6 1.9c-.9.6-1.4 1.1-1.4 2.1"/><path d="M12 17h.01"/></svg><span>Ajuda</span></button>
        <button class="fh-mine" type="button" onclick="fHomeOpenHist()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 4v5"/></svg><span>Minhas artes</span>${nHist?` <span class="fh-mine-badge">${nHist}</span>`:''}</button>
      </div>
    </div>
    <div class="fh-search-row" role="search">
      <span class="fh-search-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></span>
      <div class="fh-search-field"><label for="fh-search">Encontre sua próxima campanha</label><input id="fh-search" type="search" autocomplete="off" placeholder="Buscar por tema, prato ou ocasião (ex: Sushi, Almoço)..." oninput="fHomeFilter(this.value)"/></div>
      <div class="fh-search-tools">
        <div class="fh-filter-wrap">
          <button class="fh-filter-btn${_fhFilter!=='todas'?' is-active':''}" type="button" onclick="fHomeToggleFilter(this,event)" aria-haspopup="true" aria-expanded="false" aria-controls="fh-filter-panel">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16"/><path d="M7 12h10"/><path d="M10 18h4"/></svg>
            <span>Filtrar</span>${_fhFilter!=='todas'?'<span class="fh-filter-dot" aria-hidden="true"></span>':''}
          </button>
          <div class="fh-filter-panel" id="fh-filter-panel" role="menu">${_fhFilterPanelHTML()}</div>
        </div>
      </div>
    </div>
    <div id="fh-body">${_fHomeBodyHTML('')}</div>
  </div>`;
  // Tudo que roda depois do innerHTML é envolvido: um throw aqui deixava os cards em
  // opacity:0 pra sempre (CSS #fh-body>* sob .fh-anim) — a home "não carregava" ao voltar.
  try{ _fhApplyStagger(el); }catch(e){}
  try{ _fhSetupReveal(); }catch(e){ el.querySelectorAll('#fh-body>*').forEach(b=>b.classList.add('in')); }
  try{ _fhBindSticky(); }catch(e){}
}
function fHomeFilter(q){
  const body=document.getElementById('fh-body'); if(!body)return;
  // Busca é digitação: resultados instantâneos, sem re-rodar a cascata a cada tecla
  const home=document.getElementById('f-home');
  if(home) home.classList.remove('fh-anim');
  body.innerHTML=_fHomeBodyHTML(q);
  try{ _fhSetupReveal(); }catch(e){ body.querySelectorAll(':scope>*').forEach(b=>b.classList.add('in')); }
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
