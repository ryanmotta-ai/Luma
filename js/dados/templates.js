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
    return head + filtros + pEmpty('🏆', 'Nenhum template',
      'Nenhum template bate os filtros selecionados. Ajuste a campanha ou o formato.', null);
  }

  pSortRows(rows);

  return head + filtros + `<div class="p-table-wrap"><table class="p-table">
    <thead><tr>${P_COLS.map(pColHeader).join('')}</tr></thead>
    <tbody>${rows.map(pTemplateRow).join('')}</tbody>
  </table></div>`;
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

  if(expanded) html += `<tr><td class="p-expand-cell" colspan="${P_COLS.length}">${pExpandPanel(t)}</td></tr>`;
  return html;
}

function pToggleExpand(id){
  pState.tabelaExpandida = pState.tabelaExpandida === id ? null : id;
  pRender();
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
  if(!vals || !vals.length) return pEmpty('📈', 'Sem histórico', 'Sem dados diários.', null);
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
