/**
 * js/dados/templates.js
 *
 * Módulo 3 — Performance de Templates: tabela densa ORDENÁVEL (sort real por
 * coluna), filtros (campanha + formato + período) e expand de histórico por linha.
 */

const P_COLS = [
  { key:'nome',     label:'Template',  num:false },
  { key:'campNome', label:'Campanha',  num:false },
  { key:'usos',     label:'Usos',      num:true  },
  { key:'downloads',label:'Downloads', num:true  },
  { key:'_conc',    label:'Conclusão', num:true  },
  { key:'_trend',   label:'Tendência', num:true  },
  { key:'_score',   label:'Score',     num:true  },
];
const P_TREND_RANK = { up:2, flat:1, down:0 };

function pRenderTemplates(){
  const rows = pTemplatesFiltrados();
  const head = `
    <div class="p-head">
      <div>
        <div class="p-head-title">Performance de Templates</div>
        <div class="p-head-sub">Ranking por score · ${rows.length} template(s)</div>
      </div>
      <div class="p-pills">${pPeriodPills()}</div>
    </div>`;

  const filtros = pTemplatesFiltros();

  if(!rows.length){
    return head + filtros + pEmpty('<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34"></path><path d="M12 2a6 6 0 0 1 6 6c0 3.27-2 6-6 6S6 11.27 6 8a6 6 0 0 1 6-6z"></path></svg>', 'Nenum template',
      'Nenhum template bate os filtros selecionados. Ajuste a campanha ou o formato.', null);
  }

  pSortRows(rows);

  const unused = P_TEMPLATES.filter(t => t.usos === 0);
  let unusedHTML = '';
  if(unused.length > 0){
    unusedHTML = `
      <div class="p-unused-templates-section">
        <div class="p-unused-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          <span>Desperdício Criativo (Templates sem uso nos últimos 30 dias)</span>
        </div>
        <div class="p-unused-grid">
          ${unused.map(t => `
            <div class="p-unused-item">
              <span class="p-unused-name">${pEsc(t.nome)}</span>
              <span class="p-unused-meta" style="color:var(--p-text-mut);">${pEsc(t.campNome)} · ${pEsc(P_FMT_LABEL[t.fmt] || t.fmt)}</span>
            </div>
          `).join('')}
        </div>
      </div>`;
  }

  return head + filtros + `<div class="p-table-wrap"><table class="p-table">
    <thead><tr>${P_COLS.map(pColHeader).join('')}</tr></thead>
    <tbody>${rows.map(pTemplateRow).join('')}</tbody>
  </table></div>` + unusedHTML;
}

/* ── filtros ── */
function pTemplatesFiltros(){
  const campOpts = `<option value="all">Todas as campanhas</option>` +
    P_CAMPANHAS.map(c => `<option value="${c.id}" ${pState.campFiltro === c.id ? 'selected' : ''}>${pEsc(c.nome)}</option>`).join('');
  const fmtPills = ['all','story','feed','wide'].map(f =>
    `<button class="p-pill ${pState.fmtFiltro === f ? 'active' : ''}" onclick="pSetFmtFiltro('${f}')">${f === 'all' ? 'Todos' : P_FMT_LABEL[f]}</button>`
  ).join('');
  return `<div class="p-filters">
    <span class="p-filter-lbl">Campanha</span>
    <select class="p-select" onchange="pSetCampFiltro(this.value)">${campOpts}</select>
    <span class="p-filter-lbl">Formato</span>
    <div class="p-pills">${fmtPills}</div>
  </div>`;
}
function pSetCampFiltro(v){ pState.campFiltro = v; pState.tabelaExpandida = null; pRender(); }
function pSetFmtFiltro(v){ pState.fmtFiltro = v; pState.tabelaExpandida = null; pRender(); }

/* ── ordenação ── */
function pColHeader(c){
  const active = pState.tabelaSort.col === c.key;
  const arrow = active ? (pState.tabelaSort.dir === 'asc' ? '▲' : '▼') : '';
  return `<th class="${c.num ? 'num' : ''} ${active ? 'active-sort' : ''}" onclick="pSortTabela('${c.key}')">${pEsc(c.label)}<span class="p-sort-arrow">${arrow}</span></th>`;
}
function pSortTabela(col){
  const s = pState.tabelaSort;
  if(s.col === col){ s.dir = s.dir === 'asc' ? 'desc' : 'asc'; }
  else { s.col = col; const c = P_COLS.find(x => x.key === col); s.dir = c && c.num ? 'desc' : 'asc'; }
  pRender();
}
function pSortRows(rows){
  const { col, dir } = pState.tabelaSort;
  const mul = dir === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    let va = a[col], vb = b[col];
    if(col === '_trend'){ va = P_TREND_RANK[a._trend]; vb = P_TREND_RANK[b._trend]; }
    if(typeof va === 'string'){ return va.localeCompare(vb, 'pt-BR') * mul; }
    return ((va || 0) - (vb || 0)) * mul;
  });
}

/* ── linha ── */
function pTemplateRow(t){
  const conc = Math.round(t._conc * 100);
  const concClass = conc < 40 ? 'low' : conc < 70 ? 'mid' : '';
  const scoreClass = t._score >= 70 ? 'hi' : t._score >= 40 ? 'mid' : 'lo';
  const trendIco = t._trend === 'up' ? '↑' : t._trend === 'down' ? '↓' : '→';
  const expanded = pState.tabelaExpandida === t.id;

  let html = `<tr class="p-row ${expanded ? 'expanded' : ''}" onclick="pToggleExpand('${t.id}')">
    <td>
      <div class="p-tmpl-name">
        <span class="p-badge ${t.fmt}">${P_FMT_LABEL[t.fmt]}</span>
        <span class="p-tmpl-name-txt">${pEsc(t.nome)}</span>
      </div>
    </td>
    <td class="p-camp-cell">${pEsc(t.campNome)}</td>
    <td class="num">${t.usos}</td>
    <td class="num">${t.downloads}</td>
    <td>
      <div class="p-conc">
        <div class="p-conc-track"><div class="p-conc-fill ${concClass}" data-grow="${conc}%"></div></div>
        <span class="p-conc-pct">${conc}%</span>
      </div>
    </td>
    <td class="num"><span class="p-trend ${t._trend}">${trendIco}</span></td>
    <td class="num"><span class="p-score ${scoreClass}">${t._score}</span></td>
  </tr>`;

  html += `<tr class="p-expand-row" style="${expanded ? 'display:table-row;' : 'display:none;'}" id="p-exp-row-${t.id}">
    <td class="p-expand-cell" colspan="${P_COLS.length}">
      <div class="p-expand-wrapper ${expanded ? 'p-expand-wrapper-open' : ''}" id="p-exp-wrap-${t.id}">
        <div class="p-expand-panel-anim">
          ${pExpandPanel(t)}
        </div>
      </div>
    </td>
  </tr>`;
  return html;
}

function pToggleExpand(id){
  const row = document.querySelector(`.p-row[onclick*="${id}"]`);
  const expRow = document.getElementById(`p-exp-row-${id}`);
  const expWrap = document.getElementById(`p-exp-wrap-${id}`);
  if(!row || !expRow || !expWrap) return;

  const isOpening = !row.classList.contains('expanded');

  // Fecha qualquer linha expandida anteriormente
  const prevExpRow = document.querySelector('.p-row.expanded');
  if(prevExpRow && prevExpRow !== row){
    const clickAttr = prevExpRow.getAttribute('onclick') || '';
    const match = clickAttr.match(/'([^']+)'/);
    if(match && match[1]) {
      const prevId = match[1];
      const prevExp = document.getElementById(`p-exp-row-${prevId}`);
      const prevWrap = document.getElementById(`p-exp-wrap-${prevId}`);
      prevExpRow.classList.remove('expanded');
      if(prevWrap) prevWrap.classList.remove('p-expand-wrapper-open');
      setTimeout(() => {
        if(prevExp && !prevExpRow.classList.contains('expanded')) {
          prevExp.style.display = 'none';
        }
      }, 300);
    }
  }

  if(isOpening){
    row.classList.add('expanded');
    expRow.style.display = 'table-row';
    void expWrap.offsetWidth; // force reflow
    expWrap.classList.add('p-expand-wrapper-open');
    pState.tabelaExpandida = id;
  } else {
    row.classList.remove('expanded');
    expWrap.classList.remove('p-expand-wrapper-open');
    pState.tabelaExpandida = null;
    setTimeout(() => {
      if(!row.classList.contains('expanded')) {
        expRow.style.display = 'none';
      }
    }, 300);
  }
}

/* ── painel de histórico (expand) ── */
function pExpandPanel(t){
  const usos = t.historico || [];
  const ratio = pConclusao(t);
  // downloads por dia derivado do uso diário × taxa de conclusão (coerente com o agregado)
  const dls = usos.map(v => Math.round(v * ratio));
  return `<div class="p-expand-panel" onmouseleave="pHideTip()">
    <div class="p-expand-chart">
      <div class="p-chart-title">Usos por dia · 30 dias</div>
      ${pMiniLineSVG(usos, '', 'uso')}
    </div>
    <div class="p-expand-chart">
      <div class="p-chart-title">Downloads por dia · 30 dias</div>
      ${pMiniLineSVG(dls, 'dl', 'download')}
    </div>
    <button class="p-expand-close" onclick="event.stopPropagation();pToggleExpand('${t.id}')">Fechar ✕</button>
  </div>`;
}

/* mini gráfico de linha (sem eixos) com tooltip por ponto */
function pMiniLineSVG(vals, cls, unidade){
  const W = 280, H = 70, pad = 6;
  if(!vals || !vals.length) return pEmpty('<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>', 'Sem histórico', 'Sem dados diários.', null);
  const n = vals.length;
  const max = Math.max(1, ...vals);
  const step = n > 1 ? (W - 2 * pad) / (n - 1) : (W - 2 * pad);
  const X = i => pad + (n > 1 ? i * step : (W - 2 * pad) / 2);
  const Y = v => H - pad - (v / max) * (H - 2 * pad);
  const pts = vals.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1));
  const line = 'M' + pts.join(' L');
  // dia 0 = 29 dias atrás
  let caps = '';
  vals.forEach((v, i) => {
    const diasAtras = (n - 1) - i;
    const ds = pDayStart(pNow()) - diasAtras * P_DAY;
    const cx = X(i) - step / 2;
    caps += `<rect class="p-hover-cap" x="${Math.max(0, cx).toFixed(1)}" y="0" width="${step.toFixed(1)}" height="${H}" data-tip="<span class='p-tt-date'>${pFmtDM(ds)}</span><br><b>${v}</b> ${unidade}(s)" onmousemove="pChartTip(event)"></rect>`;
  });
  return `<svg class="p-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Histórico">
    <path class="p-spark-line ${cls}" d="${line}"/>
    ${caps}
  </svg>`;
}
