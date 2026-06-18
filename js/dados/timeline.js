/**
 * js/dados/timeline.js
 *
 * Módulo 3 — Seção 5 · Timeline de publicações.
 * Linha do tempo vertical (cronológico reverso) com filtro por campanha e
 * paginação "Ver mais". Dados de pBuildPubs()/pPubsFiltradas() [state.js].
 * HTML/SVG puro, sem dependências. Tema claro+escuro via tokens (#view-dados).
 *
 * Funções globais (prefixo p*, viram window.pX p/ o roteador):
 *   pRenderTimeline()      — render principal (retorna HTML).
 *   pSetTimelineCamp(v)    — handler do filtro de campanha (muta pState → pRender).
 *   pTimelineMore()        — handler "Ver mais" (+1 página de 10 itens → pRender).
 *   pTlRgba(hex, a)        — tint rgba(...) a partir do hex da campanha.
 *   pTlHora(ts)            — "HH:MM" derivado de new Date(ts).
 *   pTlItem(p)             — markup de um item da linha do tempo.
 */

function pRenderTimeline(){
  var camp = pState.timelineCamp || 'all';

  var campOpts = '<option value="all"' + (camp === 'all' ? ' selected' : '') + '>Todas as campanhas</option>' +
    P_CAMPANHAS.map(function(c){
      return '<option value="' + c.id + '"' + (camp === c.id ? ' selected' : '') + '>' + pEsc(c.nome) + '</option>';
    }).join('');

  var head = `
    <div class="p-head">
      <div>
        <div class="p-head-title">Timeline de publicações</div>
        <div class="p-head-sub">Histórico de artes publicadas · mais recentes primeiro</div>
      </div>
    </div>
    <div class="p-tl-filters">
      <span class="p-filter-lbl">Campanha</span>
      <select class="p-select" onchange="pSetTimelineCamp(this.value)">${campOpts}</select>
    </div>`;

  var todas = pPubsFiltradas(camp);

  if(!todas.length){
    return head + pEmpty('<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"></path><path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z"></path></svg>', 'Sem publicações', 'Nenhuma publicação para esse filtro.', null);
  }

  var pagina = Math.max(1, pState.timelinePagina || 1);
  var limite = 10 * pagina;
  var visiveis = todas.slice(0, limite);
  var restantes = todas.length - visiveis.length;

  var batchGroups = {};
  visiveis.forEach(function(p) {
    if(p.batchId) {
      if(!batchGroups[p.batchId]) batchGroups[p.batchId] = [];
      batchGroups[p.batchId].push(p);
    }
  });

  var renderedBatches = new Set();
  var itens = visiveis.map(function(p) {
    if(p.batchId) {
      if(renderedBatches.has(p.batchId)) return '';
      renderedBatches.add(p.batchId);
      var group = batchGroups[p.batchId];
      var hora = pTlHora(p.ts);
      var cor = P_CAMP_COLOR[p.campId] || 'var(--p-accent)';
      
      var itemsListHTML = group.map(function(item) {
        return `<div class="p-tl-batch-item" style="margin-top:6px;">
          <span>📄 ${pEsc(item.templateNome)} (${P_FMT_LABEL[item.fmt] || item.fmt})</span>
          <span class="p-tl-batch-item-meta" style="color:var(--p-text-mut);">Gerações: <b style="color:var(--p-text);">${pFmtNum(item.usosDesde)}</b></span>
        </div>`;
      }).join('');
      
      var campPill = `<span class="p-tl-camp" style="background:${pTlRgba(cor, 0.16)}; color:${cor}; border-color:${pTlRgba(cor, 0.40)}">${pEsc(p.campNome)}</span>`;

      return `<div class="p-tl-item p-tl-batch" style="border-left-color:${cor};">
        <span class="p-tl-dot" style="background:${cor}"></span>
        <div class="p-tl-batch-header">
          <span class="p-tl-batch-title" style="font-weight:700;">Lote de Geração em Massa (Planilha CSV)</span>
          <span class="p-tl-batch-badge" style="background:${pTlRgba(cor, 0.12)};color:${cor};">Lote #${p.batchId.split('-')[1]}</span>
        </div>
        <div class="p-tl-when" style="margin-bottom:8px;font-size:11px;color:var(--p-text-mut);">
          <span class="p-tl-rel" style="color:var(--p-text-2);font-weight:600;">${pEsc(pHaTempo(p.ts))}</span>
          <span class="p-tl-sep">·</span>
          <span class="p-tl-hora">${hora}</span>
          <span class="p-tl-date" style="margin-left:4px;">${pEsc(pFmtDM(p.ts))}</span>
        </div>
        <div class="p-tl-batch-list" style="border-left:1px dashed var(--p-border);padding-left:10px;margin-bottom:8px;">
          ${itemsListHTML}
        </div>
        <div class="p-tl-meta" style="font-size:11px;color:var(--p-text-mut);">
          ${campPill}
          <span class="p-tl-by" style="margin-left:8px;">Publicado por <b>${pEsc(p.autor)}</b></span>
        </div>
      </div>`;
    } else {
      return pTlItem(p);
    }
  }).join('');

  var verMais = restantes > 0
    ? `<div class="p-tl-more-wrap">
        <button class="p-tl-more" onclick="pTimelineMore()">Ver mais <span class="p-tl-more-n">(${pFmtNum(restantes)})</span></button>
      </div>`
    : '';

  return head + `
    <div class="p-tl" onmouseleave="pHideTip()">
      <div class="p-tl-line" aria-hidden="true"></div>
      ${itens}
    </div>
    <div class="p-tl-foot">${pFmtNum(visiveis.length)} de ${pFmtNum(todas.length)} publicaç${todas.length === 1 ? 'ão' : 'ões'}</div>
    ${verMais}`;
}

/* ── um item da linha do tempo ── */
function pTlItem(p){
  var hora = pTlHora(p.ts);
  var cor = P_CAMP_COLOR[p.campId] || 'var(--p-accent)';
  var fmtLbl = P_FMT_LABEL[p.fmt] || p.fmt;

  // pill de campanha: fundo tint da cor + texto na cor, borda sutil
  var campPill = `<span class="p-tl-camp" style="background:${pTlRgba(cor, 0.16)}; color:${cor}; border-color:${pTlRgba(cor, 0.40)}">${pEsc(p.campNome)}</span>`;

  // validade: amarelo (expira em N) / vermelho (expirado) / nada
  var validade = '';
  if(p.expiraTs != null){
    var diasRest = Math.ceil((p.expiraTs - pNow()) / P_DAY);
    if(diasRest > 0){
      validade = `<span class="p-tl-val expira"><span class="p-tl-val-ico">⏳</span>Expira em ${pFmtNum(diasRest)} dia${diasRest === 1 ? '' : 's'}</span>`;
    } else {
      validade = `<span class="p-tl-val expirado"><span class="p-tl-val-ico">⛔</span>Expirado</span>`;
    }
  }

  var tip = pEsc(p.templateNome) + ' · <b>' + pFmtNum(p.usosDesde) + '</b> uso' + (p.usosDesde === 1 ? '' : 's') +
            "<br><span class='p-tt-date'>" + pEsc(pFmtDM(p.ts)) + ' · ' + hora + '</span>';

  return `<div class="p-tl-item" data-tip="${tip}" onmousemove="pChartTip(event)">
    <span class="p-tl-dot" style="background:${cor}"></span>
    <div class="p-tl-card">
      <div class="p-tl-when">
        <span class="p-tl-rel">${pEsc(pHaTempo(p.ts))}</span>
        <span class="p-tl-sep">·</span>
        <span class="p-tl-hora">${hora}</span>
        <span class="p-tl-date">${pEsc(pFmtDM(p.ts))}</span>
      </div>
      <div class="p-tl-title-row">
        <span class="p-badge ${p.fmt}">${pEsc(fmtLbl)}</span>
        <span class="p-tl-tmpl">${pEsc(p.templateNome)}</span>
      </div>
      <div class="p-tl-meta">
        ${campPill}
        <span class="p-tl-by">Publicado por <b>${pEsc(p.autor)}</b></span>
      </div>
      <div class="p-tl-stats">
        <span class="p-tl-usos"><span class="p-tl-arrow">→</span> <b>${pFmtNum(p.usosDesde)}</b> uso${p.usosDesde === 1 ? '' : 's'} desde então</span>
        ${validade}
      </div>
    </div>
  </div>`;
}

/* ── helpers ── */

/* "HH:MM" a partir de um timestamp */
function pTlHora(ts){
  var d = new Date(ts);
  return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

/* rgba(...) a partir de um hex (#RGB ou #RRGGBB); cor não-hex → fallback laranja */
function pTlRgba(hex, a){
  if(typeof hex !== 'string' || hex.charAt(0) !== '#') return 'rgba(255,144,0,' + a + ')';
  var h = hex.slice(1);
  if(h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
  var r = parseInt(h.slice(0, 2), 16);
  var g = parseInt(h.slice(2, 4), 16);
  var b = parseInt(h.slice(4, 6), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

/* ── handlers ── */
function pSetTimelineCamp(v){
  pState.timelineCamp = v;
  pState.timelinePagina = 1;
  pRender();
}
function pTimelineMore(){
  pState.timelinePagina = (pState.timelinePagina || 1) + 1;
  pRender();
}
