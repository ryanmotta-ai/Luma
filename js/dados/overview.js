/**
 * js/dados/overview.js
 *
 * Módulo 3 — Visão Geral: 4 KPIs (com sparkline), gráfico de linha (30d),
 * barras horizontais (top campanhas) e donut (formatos). SVG inline puro.
 */

function pRenderOverview(){
  const periodo = pState.periodo;
  const artes = pArtesNoPeriodo(periodo);
  const prev  = pArtesPeriodoAnterior(periodo);

  const head = `
    <div class="p-head">
      <div>
        <div class="p-head-title">Visão Geral</div>
        <div class="p-head-sub">Artes geradas pelos franqueados · últimos ${pPeriodDays(periodo)} dias</div>
      </div>
      <div class="p-pills">${pPeriodPills()}</div>
    </div>`;

  if(!artes.length){
    return head + pEmpty('<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"></path><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>', 'Sem artes no período',
      'Nenhuma arte foi gerada nesta janela de tempo. Experimente um período maior ou gere artes no módulo Franqueado.',
      'Ir para Franqueado', 'franqueado');
  }

  // 1) Insights Feed
  const insights = pGetInsightsFeed(periodo);
  const insightsHTML = `
    <div class="p-overview-insights-row">
      <div class="p-overview-insights-title">Insights de Performance</div>
      <div class="p-insight-feed">
        ${insights.map(ins => {
          let ico = '';
          if(ins.type === 'success') ico = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><polyline points="20 6 9 17 4 12"></polyline></svg>';
          else if(ins.type === 'warning') ico = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
          else ico = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--p-accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M9 18h6m-5 4h4m1.3-17.7a7.5 7.5 0 1 0-8.6 0c1.7 1.3 2.7 3.3 2.7 5.5h4c0-2.2 1-4.2 2.7-5.5z"></path></svg>';
          return `<div class="p-insight-card ${ins.type}">
            <div class="p-insight-card-ico">${ico}</div>
            <div class="p-insight-card-txt">${pEsc(ins.text)}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;

  // 2) Health Score Gauge + KPIs Grid
  const healthVal = pGetHealthScore(periodo);
  const strokeOffset = 339.292 - (339.292 * healthVal / 100);
  
  const healthHTML = `
    <div class="p-chart-card p-health-card">
      <div class="p-chart-title">Saúde Geral da Rede</div>
      <div class="p-chart-note" style="margin-bottom:8px">Adoção e Consistência de Marca</div>
      <div class="p-health-gauge-wrap">
        <svg class="p-health-gauge-svg" viewBox="0 0 120 120">
          <circle class="p-health-gauge-bg" cx="60" cy="60" r="54" stroke-width="10" />
          <circle class="p-health-gauge-fill" cx="60" cy="60" r="54" stroke-width="10" stroke-dashoffset="${strokeOffset.toFixed(2)}" transform="rotate(-90 60 60)" />
        </svg>
        <div class="p-health-gauge-center">
          <span class="p-health-val">${healthVal}%</span>
          <span class="p-health-lbl">Saudável</span>
        </div>
      </div>
      <div style="font-size:11px;color:var(--p-text-mut);line-height:1.45;margin-top:6px;text-align:center;">
        Tempo Médio de Criação: <b style="color:var(--p-text)">${pGetTempoMedioCriacao(periodo)}s</b><br>
        Latência de Geração: <b style="color:var(--p-text)">${pGetLatenciaFila()}s</b>
      </div>
    </div>`;

  const kpiGridHTML = pOverviewKPIs(artes, prev);
  
  const mainGridHTML = `
    <div class="p-overview-main-grid">
      ${healthHTML}
      <div style="display:flex; flex-direction:column; gap:14px; justify-content:center;">
        ${kpiGridHTML}
      </div>
    </div>`;

  return head + insightsHTML + mainGridHTML + pOverviewCharts(artes);
}

/* ══ KPIs ══ */
function pOverviewKPIs(artes, prev){
  const g7 = pLast7Groups();

  // 1) Artes geradas
  const cur1 = artes.length, prev1 = prev.length;
  const d1 = pDelta(cur1, prev1);
  const spark1 = g7.map(g => g.artes.length);

  // 2) Franqueados ativos
  const cur2 = pFranqueadosAtivos(artes), prev2 = pFranqueadosAtivos(prev);
  const d2 = pDelta(cur2, prev2);
  const spark2 = g7.map(g => new Set(g.artes.map(a => a.franqueadoId)).size);

  // 3) Campanha top
  const topNome = pCampanhaTop(artes);
  const curTop = artes.filter(a => a.campNome === topNome).length;
  const prevTop = prev.filter(a => a.campNome === topNome).length;
  const d3 = pDelta(curTop, prevTop);
  const spark3 = g7.map(g => g.artes.filter(a => a.campNome === topNome).length);

  // 4) Taxa de download
  const cur4 = pTaxaDownload(artes), prev4 = pTaxaDownload(prev);
  const diff4 = cur4 - prev4;
  const d4 = { pct: Math.abs(diff4), dir: diff4 > 0.5 ? 'up' : diff4 < -0.5 ? 'down' : 'flat' };
  const spark4 = g7.map(g => g.artes.length ? g.artes.filter(a => a.status === 'baixada').length / g.artes.length * 100 : 0);

  return `<div class="p-kpi-grid" style="grid-template-columns: repeat(2, 1fr); margin-bottom: 0;">
    ${pKpiCard('Artes geradas', pFmtNum(cur1), d1, 'vs. período anterior', spark1, true, false, { raw: cur1, mode: 'num' })}
    ${pKpiCard('Franqueados ativos', pFmtNum(cur2), d2, cur2 + ' de ' + P_FRANQUEADOS.length + ' geraram artes', spark2, false, false, { raw: cur2, mode: 'num' })}
    ${pKpiCardText('Campanha top', topNome, d3, curTop + ' artes no período', spark3)}
    ${pKpiCard('Taxa de download', pFmtPct(cur4), d4, 'baixadas vs. abandonadas', spark4, false, true, { raw: cur4, mode: 'pct' })}
  </div>`;
}

function pDeltaHTML(d, suffix){
  const arrow = d.dir === 'up' ? '▲' : d.dir === 'down' ? '▼' : '▬';
  const val = (suffix === 'pp') ? (Math.round(d.pct * 10) / 10).toString().replace('.', ',') + ' pp'
                                : (Math.round(d.pct * 10) / 10).toString().replace('.', ',') + '%';
  return `<span class="p-kpi-delta ${d.dir}">${arrow} ${val}</span>`;
}
function pKpiCard(label, value, delta, sub, spark, accent, pp, counter){
  // counter (opcional): {raw:Number, mode:'num'|'pct'} → contador animado de 0 ao valor.
  const cAttr = counter ? ` data-p-counter="${counter.raw}" data-p-mode="${counter.mode}"` : '';
  return `<div class="p-kpi-card">
    <div class="p-kpi-label">${pEsc(label)}</div>
    <div class="p-kpi-value ${accent ? 'p-accent' : ''}"${cAttr}>${pEsc(value)}</div>
    <div class="p-kpi-foot">${pDeltaHTML(delta, pp ? 'pp' : '')}${pSparkSVG(spark)}</div>
    <div class="p-kpi-sub">${pEsc(sub)}</div>
  </div>`;
}
function pKpiCardText(label, value, delta, sub, spark){
  return `<div class="p-kpi-card">
    <div class="p-kpi-label">${pEsc(label)}</div>
    <div class="p-kpi-value" style="font-size:18px;margin-top:9px;line-height:1.25">${pEsc(value)}</div>
    <div class="p-kpi-foot">${pDeltaHTML(delta, '')}${pSparkSVG(spark)}</div>
    <div class="p-kpi-sub">${pEsc(sub)}</div>
  </div>`;
}

/* ══ GRÁFICOS ══ */
function pOverviewCharts(artes){
  const serie = pSerieDiaria(artes, pPeriodDays(pState.periodo));
  const camps = pPorCampanha(artes).slice(0, 6);
  const fmts = pPorFormato(artes);

  return `<div class="p-charts-grid">
    <div class="p-chart-card p-span-2" onmouseleave="pHideTip()">
      <div class="p-chart-title">Artes por dia</div>
      <div class="p-chart-note">Volume diário no período selecionado</div>
      ${pLineSVG(serie)}
    </div>
  </div>
  <div class="p-charts-grid">
    <div class="p-chart-card" onmouseleave="pHideTip()">
      <div class="p-chart-title">Artes por campanha</div>
      <div class="p-chart-note">Top ${camps.length} campanhas do período</div>
      ${pBarsSVG(camps)}
    </div>
    <div class="p-chart-card" onmouseleave="pHideTip()">
      <div class="p-chart-title">Distribuição por formato</div>
      <div class="p-chart-note">Story · Feed · Wide</div>
      ${pDonutSVG(fmts)}
    </div>
  </div>`;
}

/* sparkline 7 pontos */
function pSparkSVG(vals){
  const w = 84, h = 26, pad = 2;
  if(!vals || !vals.length) vals = [0];
  const max = Math.max.apply(null, vals), min = Math.min.apply(null, vals);
  const rng = Math.max(1, max - min);
  const n = vals.length;
  const pts = vals.map((v, i) => {
    const x = pad + (n === 1 ? (w - 2 * pad) / 2 : i * ((w - 2 * pad) / (n - 1)));
    const y = h - pad - ((v - min) / rng) * (h - 2 * pad);
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  const last = vals[n - 1] >= vals[0];
  const col = last ? '#22C55E' : '#FF5A5A';
  return `<svg class="p-kpi-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

/* linha + área com tooltip por dia */
function pLineSVG(serie){
  const W = 720, H = 220, padL = 30, padR = 12, padT = 14, padB = 26;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const n = serie.length;
  const max = Math.max(1, ...serie.map(s => s.count));
  const step = n > 1 ? innerW / (n - 1) : innerW;
  const X = i => padL + (n > 1 ? i * step : innerW / 2);
  const Y = v => padT + innerH - (v / max) * innerH;

  // grid + labels Y (4 níveis)
  let grid = '', yLabels = '';
  for(let k = 0; k <= 4; k++){
    const v = Math.round(max * k / 4);
    const y = Y(v);
    grid += `<line class="p-grid-line" x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}"/>`;
    yLabels += `<text class="p-axis-label" x="${padL - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end">${v}</text>`;
  }
  // pontos
  const pts = serie.map((s, i) => X(i).toFixed(1) + ',' + Y(s.count).toFixed(1));
  const line = 'M' + pts.join(' L');
  const area = 'M' + X(0).toFixed(1) + ',' + (padT + innerH) + ' L' + pts.join(' L') + ' L' + X(n - 1).toFixed(1) + ',' + (padT + innerH) + ' Z';
  // labels X a cada 5 dias (+ último)
  let xLabels = '';
  serie.forEach((s, i) => {
    if(i % 5 === 0 || i === n - 1){
      xLabels += `<text class="p-axis-label" x="${X(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${s.label}</text>`;
    }
  });
  // dots + áreas de hover (cap chama pLineHover c/ x,y do ponto → crosshair + ponto "grudam" no dia)
  let dots = '', caps = '';
  serie.forEach((s, i) => {
    dots += `<circle class="p-dot" cx="${X(i).toFixed(1)}" cy="${Y(s.count).toFixed(1)}" r="2.6"/>`;
    const cx = X(i) - step / 2, cw = step;
    caps += `<rect class="p-hover-cap" x="${Math.max(0, cx).toFixed(1)}" y="${padT}" width="${cw.toFixed(1)}" height="${innerH}" data-tip="<span class='p-tt-date'>${s.label}</span><br><b>${s.count}</b> arte(s)" onmousemove="pLineHover(event,${X(i).toFixed(1)},${Y(s.count).toFixed(1)})"></rect>`;
  });
  // crosshair vertical + ponto destacado (ocultos via CSS até o hover; r inline p/ não depender de geometria CSS)
  const hover = `<line id="p-crosshair" class="p-crosshair" x1="0" y1="${padT}" x2="0" y2="${(padT + innerH).toFixed(1)}"/>
    <circle id="p-hover-dot" class="p-hover-dot" cx="0" cy="0" r="4.5"/>`;

  return `<svg class="p-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Artes por dia">
    <defs><linearGradient id="pLineGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FF9000" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="#FF9000" stop-opacity="0"/>
    </linearGradient></defs>
    ${grid}${yLabels}
    <path class="p-line-area" d="${area}"/>
    <path class="p-line-stroke" d="${line}"/>
    ${dots}${hover}${xLabels}${caps}
  </svg>`;
}

/* barras horizontais */
function pBarsSVG(camps){
  if(!camps.length) return pEmpty('<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>', 'Sem dados', 'Nenhuma campanha no período.', null);
  const max = Math.max(1, ...camps.map(c => c.count));
  let html = `<div class="p-hbar-list">`;
  camps.forEach(c => {
    const pct = (c.count / max) * 100;
    const color = P_CAMP_COLOR[c.id] || 'var(--p-accent)';
    html += `
    <div class="p-hbar-row-html" data-tip="${pEsc(c.nome)}<br><b>${c.count}</b> arte(s)" onmousemove="pChartTip(event)">
      <div class="p-hbar-info">
        <span class="p-hbar-name-html">${pEsc(c.nome)}</span>
        <span class="p-hbar-val-html">${c.count}</span>
      </div>
      <div class="p-hbar-track-html">
        <div class="p-hbar-fill-html" style="width:0; background:${color}" data-grow="${pct.toFixed(1)}%"></div>
      </div>
    </div>`;
  });
  html += `</div>`;
  return html;
}

/* donut de formatos */
function pDonutSVG(fmts){
  const order = ['story','feed','wide'];
  const data = order.map(k => ({ k, label: P_FMT_LABEL[k], color: P_FMT_COLOR[k], count: fmts[k] || 0 }));
  const total = data.reduce((s, d) => s + d.count, 0);
  if(!total) return pEmpty('<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>', 'Sem dados', 'Nenhuma arte no período.', null);

  const cx = 75, cy = 75, rMid = 52, sw = 14;
  const C = 2 * Math.PI * rMid;
  let acc = 0, segs = '';
  data.forEach(d => {
    if(!d.count) return;
    const frac = d.count / total;
    const dash = frac * C;
    const pct = Math.round(frac * 1000) / 10;
    segs += `<circle class="p-donut-seg" cx="${cx}" cy="${cy}" r="${rMid}" fill="none"
      stroke="${d.color}" stroke-width="${sw}"
      stroke-dasharray="${dash.toFixed(2)} ${(C - dash).toFixed(2)}"
      stroke-dashoffset="${(-acc * C).toFixed(2)}"
      data-p-dash="${dash.toFixed(2)}" data-p-c="${C.toFixed(2)}"
      data-tip="${d.label}<br><b>${d.count}</b> (${pct.toString().replace('.', ',')}%)"
      onmousemove="pChartTip(event)"></circle>`;
    acc += frac;
  });

  const track = `<circle cx="${cx}" cy="${cy}" r="${rMid}" fill="none" stroke="var(--p-track)" stroke-width="${sw}"></circle>`;

  const legend = data.map(d => {
    const pct = total ? Math.round(d.count / total * 1000) / 10 : 0;
    return `<div class="p-legend-card ${d.k}">
      <div class="p-legend-card-header">
        <span class="p-legend-dot" style="background:${d.color}"></span>
        <span class="p-legend-name">${d.label}</span>
      </div>
      <div class="p-legend-card-body">
        <span class="p-legend-val">${d.count}</span>
        <span class="p-legend-pct">${pct.toString().replace('.', ',')}%</span>
      </div>
    </div>`;
  }).join('');

  return `<div class="p-donut-wrap" onmouseleave="pHideTip()">
    <div class="p-donut-chart-container">
      <svg width="150" height="150" viewBox="0 0 150 150" role="img" aria-label="Distribuição por formato" style="flex-shrink:0">
        <g transform="rotate(-90 ${cx} ${cy})">
          ${track}
          ${segs}
        </g>
        <text class="p-donut-center-num" x="${cx}" y="${cy - 2}" text-anchor="middle" dominant-baseline="middle">${total}</text>
        <text class="p-donut-center-lbl" x="${cx}" y="${cy + 15}" text-anchor="middle">ARTES</text>
      </svg>
    </div>
    <div class="p-legend-grid">${legend}</div>
  </div>`;
}

/* grupos das últimas 7 datas (para sparklines) */
function pLast7Groups(){
  const today = pDayStart(pNow());
  const groups = [];
  for(let i = 6; i >= 0; i--){
    const ds = today - i * P_DAY;
    groups.push({ ds, artes: P_MOCK_ARTES.filter(a => pDayStart(a.ts) === ds) });
  }
  return groups;
}

/* ══ ANIMAÇÕES DE ENTRADA (presentation only — chamadas pelo pRender) ══ */

// contador de placar: 0 → valor final, ease-out cubic, formatação pt-BR.
function pAnimateCounters(){
  const root = document.getElementById('p-main');
  if(!root) return;
  root.querySelectorAll('.p-kpi-value[data-p-counter]').forEach(el => {
    const target = parseFloat(el.getAttribute('data-p-counter'));
    if(!isFinite(target)) return;
    const mode = el.getAttribute('data-p-mode') || 'num';
    const finalText = el.textContent;                 // valor já formatado no markup
    const fmt = v => mode === 'pct'
      ? (Math.round(v * 10) / 10).toFixed(1).replace('.', ',') + '%'
      : Math.round(v).toLocaleString('pt-BR');
    if(typeof pReduceMotion === 'function' && pReduceMotion()){ el.textContent = finalText; return; }
    const dur = 850, start = performance.now();
    el.textContent = fmt(0);
    function tick(now){
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      if(p < 1){ el.textContent = fmt(target * eased); requestAnimationFrame(tick); }
      else { el.textContent = finalText; }            // snap exato (evita erro de arredondamento)
    }
    requestAnimationFrame(tick);
  });
}

// desenha o traço da linha da esquerda p/ direita (stroke-dashoffset)
function pAnimateLineChart(){
  const path = document.querySelector('#p-main .p-line-stroke');
  if(!path || typeof path.getTotalLength !== 'function') return;
  let len;
  try { len = path.getTotalLength(); } catch(e){ return; }
  if(!isFinite(len) || len === 0) return;
  if(typeof pReduceMotion === 'function' && pReduceMotion()){
    path.style.strokeDasharray = ''; path.style.strokeDashoffset = ''; return;
  }
  path.style.transition = 'none';
  path.style.strokeDasharray = len;
  path.style.strokeDashoffset = len;
  void path.getBoundingClientRect();                  // commit do estado inicial sem transição
  path.style.transition = 'stroke-dashoffset 1.15s cubic-bezier(.16,1,.3,1) .1s';
  path.style.strokeDashoffset = '0';
}

// preenche cada segmento do donut em arco (dasharray 0→final), com delay escalonado
function pAnimateDonut(){
  const segs = document.querySelectorAll('#p-main .p-donut-seg');
  if(!segs.length) return;
  const reduce = (typeof pReduceMotion === 'function' && pReduceMotion());
  segs.forEach((seg, i) => {
    const dash = parseFloat(seg.getAttribute('data-p-dash'));
    const C = parseFloat(seg.getAttribute('data-p-c'));
    if(!isFinite(dash) || !isFinite(C)) return;
    const finalDA = `${dash} ${C - dash}`;
    if(reduce){ seg.style.strokeDasharray = finalDA; return; }
    seg.style.transition = 'none';
    seg.style.strokeDasharray = `0 ${C}`;             // começa vazio
    void seg.getBoundingClientRect();                 // commit
    seg.style.transition = `stroke-dasharray .8s cubic-bezier(.16,1,.3,1) ${(i * 0.12 + 0.25).toFixed(2)}s`;
    seg.style.strokeDasharray = finalDA;              // anima até o arco final
  });
}

// hover do gráfico de linha: tooltip (segue cursor) + crosshair + ponto no dia
function pLineHover(ev, x, y){
  if(typeof pChartTip === 'function') pChartTip(ev);
  const ch = document.getElementById('p-crosshair');
  if(ch){ ch.setAttribute('x1', x); ch.setAttribute('x2', x); ch.classList.add('visible'); }
  const dot = document.getElementById('p-hover-dot');
  if(dot){ dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.classList.add('visible'); }
}

function pAnimateHealth(){
  const circle = document.querySelector('#p-main .p-health-gauge-fill');
  if(!circle) return;
  const targetOffset = parseFloat(circle.getAttribute('stroke-dashoffset'));
  const fullLength = 339.292; // 2 * PI * 54
  if(typeof pReduceMotion === 'function' && pReduceMotion()){
    circle.style.strokeDashoffset = targetOffset;
    return;
  }
  circle.style.transition = 'none';
  circle.style.strokeDashoffset = fullLength; // start empty
  void circle.getBoundingClientRect(); // reflow
  circle.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(0.16, 1, 0.3, 1) 0.1s';
  circle.style.strokeDashoffset = targetOffset; // animate to target
}
