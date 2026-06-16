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
    return head + pEmpty('📰', 'Sem publicações', 'Nenhuma publicação para esse filtro.', null);
  }

  var pagina = Math.max(1, pState.timelinePagina || 1);
  var limite = 10 * pagina;
  var visiveis = todas.slice(0, limite);
  var restantes = todas.length - visiveis.length;

  var itens = visiveis.map(pTlItem).join('');

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
