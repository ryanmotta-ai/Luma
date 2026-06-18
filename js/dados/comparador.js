/**
 * js/dados/comparador.js
 *
 * Módulo 3 — Seção 6 · Comparador de períodos.
 * Compara a janela atual com a janela imediatamente anterior (mesmo tamanho).
 * Gráfico de linha SVG com DOIS traços alinhados por índice de dia + 4 cards de
 * delta (artes, downloads, franqueados ativos, campanhas ativas). SVG inline puro.
 * Funciona nos temas claro e escuro (tokens CSS do escopo #view-dados).
 *
 * Funções globais (prefixo p*, viram window.pX p/ o roteador/handlers):
 *   pRenderComparador() — render principal (retorna HTML).
 *   pSetComparador(modo) — handler dos pills de modo (muta pState → pRender).
 */

/* mapa modo → período (reusa pArtesNoPeriodo/pArtesPeriodoAnterior) */
var P_CMP_MODO_PERIODO = { semana: '7d', mes: '30d', '90d': '90d', campanha: 'camp' };
var P_CMP_MODOS = [
  { id: 'semana', label: 'Semana' },
  { id: 'mes',    label: 'Mês' },
  { id: '90d',    label: '90 dias' },
  { id: 'campanha', label: 'Lançamento de Campanhas' },
];

function pRenderComparador(){
  var modo = pState.comparadorModo || 'mes';
  if(!P_CMP_MODO_PERIODO[modo]) modo = 'mes';
  var periodo = P_CMP_MODO_PERIODO[modo];

  var days, cur, prev, serieCur, seriePrev, subText;
  
  if(modo === 'campanha') {
    days = 14;
    subText = `Lançamento de Campanhas · primeiros 14 dias`;
    cur = P_MOCK_ARTES.filter(a => a.campId === 'novo-app');
    prev = P_MOCK_ARTES.filter(a => a.campId === 'promo-turbinada');
    
    serieCur = [];
    seriePrev = [];
    const rnd = pRng(12345);
    for(var i = 0; i < 14; i++) {
      var cVal = Math.round(10 + rnd() * 22);
      var pVal = Math.round(8 + rnd() * 18);
      serieCur.push({ ts: i, label: 'Dia ' + (i + 1), count: cVal });
      seriePrev.push({ ts: i, label: 'Dia ' + (i + 1), count: pVal });
    }
  } else {
    days = pComparadorDias(modo);
    subText = `Janela atual vs. anterior · últimos ${days} dias`;
    cur  = pArtesNoPeriodo(periodo);
    prev = pArtesPeriodoAnterior(periodo);
    serieCur  = pSerieDiaria(cur, days);
    seriePrev = pSerieDiaria(prev, days, pDayStart(pNow()) - days * P_DAY);
  }

  var head = `
    <div class="p-head">
      <div>
        <div class="p-head-title">Comparador de períodos</div>
        <div class="p-head-sub">${subText}</div>
      </div>
      <div class="p-pills">${pCmpPills(modo)}</div>
    </div>`;

  if(!cur.length && !prev.length){
    return head + pEmpty('<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>', 'Sem dados para comparar',
      'Nenhuma arte foi gerada nas duas janelas analisadas. Experimente um período maior ou gere artes no módulo Franqueado.',
      'Ir para Franqueado', 'franqueado');
  }

  var legendHTML = modo === 'campanha' 
    ? `<div class="p-cmp-legend">
         <span class="p-cmp-leg-item"><span class="p-cmp-leg-mark cur" style="color:var(--p-accent);">●</span>Lançamento Novo App</span>
         <span class="p-cmp-leg-item"><span class="p-cmp-leg-mark prev" style="color:var(--p-text-mut);">○</span>Promo Turbinada</span>
       </div>`
    : `<div class="p-cmp-legend">
         <span class="p-cmp-leg-item"><span class="p-cmp-leg-mark cur" style="color:var(--p-accent);">●</span>Período atual</span>
         <span class="p-cmp-leg-item"><span class="p-cmp-leg-mark prev" style="color:var(--p-text-mut);">○</span>Período anterior</span>
       </div>`;

  return head + `
    <div class="p-chart-card p-cmp-chart" onmouseleave="pHideTip(); pCmpLeave()">
      <div class="p-cmp-chart-top">
        <div>
          <div class="p-chart-title">Artes por dia</div>
          <div class="p-chart-note">Volume diário · comparação alinhada de lançamento</div>
        </div>
        ${legendHTML}
      </div>
      ${pCmpLineSVG(serieCur, seriePrev)}
    </div>
    ${pCmpDeltas(cur, prev)}`;
}

/* pills de MODO (não período) — reusa .p-pill/.active, cabeados em pSetComparador */
function pCmpPills(modo){
  return P_CMP_MODOS.map(function(m){
    return `<button class="p-pill ${modo === m.id ? 'active' : ''}" onclick="pSetComparador('${m.id}')">${pEsc(m.label)}</button>`;
  }).join('');
}

/* ── gráfico de linha com DOIS traços (atual sólido / anterior tracejado) ── */
function pCmpLineSVG(serieCur, seriePrev){
  var W = 720, H = 230, padL = 32, padR = 14, padT = 16, padB = 28;
  var innerW = W - padL - padR, innerH = H - padT - padB;
  var n = Math.max(serieCur.length, seriePrev.length, 1);

  // escala Y comum aos dois traços
  var max = 1;
  serieCur.forEach(function(s){ if(s.count > max) max = s.count; });
  seriePrev.forEach(function(s){ if(s.count > max) max = s.count; });

  var step = n > 1 ? innerW / (n - 1) : innerW;
  var X = function(i){ return padL + (n > 1 ? i * step : innerW / 2); };
  var Y = function(v){ return padT + innerH - (v / max) * innerH; };

  // grid horizontal + labels Y (5 níveis)
  var grid = '', yLabels = '';
  for(var k = 0; k <= 4; k++){
    var v = Math.round(max * k / 4);
    var gy = Y(v);
    grid += `<line class="p-grid-line" x1="${padL}" y1="${gy.toFixed(1)}" x2="${(W - padR).toFixed(1)}" y2="${gy.toFixed(1)}"/>`;
    yLabels += `<text class="p-axis-label" x="${(padL - 6).toFixed(1)}" y="${(gy + 3).toFixed(1)}" text-anchor="end">${v}</text>`;
  }

  // paths (anterior atrás, atual na frente)
  var ptsCur = [], ptsPrev = [];
  for(var i = 0; i < n; i++){
    var cc = serieCur[i] ? serieCur[i].count : 0;
    var pc = seriePrev[i] ? seriePrev[i].count : 0;
    ptsCur.push(X(i).toFixed(1) + ',' + Y(cc).toFixed(1));
    ptsPrev.push(X(i).toFixed(1) + ',' + Y(pc).toFixed(1));
  }
  var lineCur  = 'M' + ptsCur.join(' L');
  var linePrev = 'M' + ptsPrev.join(' L');

  // labels X a cada ~5 dias (+ último)
  var xLabels = '';
  var baseSerie = serieCur.length ? serieCur : seriePrev;
  baseSerie.forEach(function(s, ix){
    if(ix % 5 === 0 || ix === n - 1){
      xLabels += `<text class="p-axis-label" x="${X(ix).toFixed(1)}" y="${(H - 9).toFixed(1)}" text-anchor="middle">${pEsc(s.label)}</text>`;
    }
  });

  // dots dos dois traços
  var dots = '';
  for(var j = 0; j < n; j++){
    var dc = serieCur[j] ? serieCur[j].count : 0;
    var dp = seriePrev[j] ? seriePrev[j].count : 0;
    dots += `<circle class="p-cmp-dot prev" cx="${X(j).toFixed(1)}" cy="${Y(dp).toFixed(1)}" r="2.2"/>`;
    dots += `<circle class="p-cmp-dot cur" cx="${X(j).toFixed(1)}" cy="${Y(dc).toFixed(1)}" r="2.6"/>`;
  }

  // faixas de hover por dia (cobrem a coluna inteira) — tooltip com os dois valores
  var caps = '';
  for(var c = 0; c < n; c++){
    var sc = serieCur[c] ? serieCur[c] : null;
    var sp = seriePrev[c] ? seriePrev[c] : null;
    var lbl = sc ? sc.label : (sp ? sp.label : ('dia ' + (c + 1)));
    var vc = sc ? sc.count : 0, vp = sp ? sp.count : 0;
    var cx = X(c);
    var cyCur = Y(vc);
    var cyPrev = Y(vp);
    var tip = `<span class='p-tt-date'>${pEsc(lbl)}</span><br>atual <b>${vc}</b> / anterior <b>${vp}</b>`;
    caps += `<rect class="p-cmp-cap" x="${Math.max(0, cx - step/2).toFixed(1)}" y="${padT}" width="${step.toFixed(1)}" height="${innerH.toFixed(1)}" data-tip="${tip}" onmousemove="pCmpHover(event, ${cx.toFixed(1)}, ${cyCur.toFixed(1)}, ${cyPrev.toFixed(1)})"></rect>`;
  }

  var hoverElements = `
    <line id="p-cmp-crosshair" x1="0" y1="${padT}" x2="0" y2="${(padT + innerH).toFixed(1)}"/>
    <circle id="p-cmp-dot-cur" class="p-hover-dot-cmp cur" cx="0" cy="0" r="5"/>
    <circle id="p-cmp-dot-prev" class="p-hover-dot-cmp prev" cx="0" cy="0" r="4.5"/>
  `;

  return `<svg class="p-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Artes por dia — período atual vs. anterior">
    ${grid}${yLabels}
    <path class="p-cmp-line prev" d="${linePrev}"/>
    <path class="p-cmp-line cur" d="${lineCur}"/>
    ${dots}${xLabels}${hoverElements}${caps}
  </svg>`;
}

/* ── Handlers do Cursor Dinâmico (Hover) ── */
function pCmpHover(ev, x, yCur, yPrev){
  if(typeof pChartTip === 'function') pChartTip(ev);
  var ch = document.getElementById('p-cmp-crosshair');
  var dotCur = document.getElementById('p-cmp-dot-cur');
  var dotPrev = document.getElementById('p-cmp-dot-prev');
  
  if(ch){ ch.setAttribute('x1', x); ch.setAttribute('x2', x); ch.classList.add('visible'); }
  if(dotCur){ dotCur.setAttribute('cx', x); dotCur.setAttribute('cy', yCur); dotCur.classList.add('visible'); }
  if(dotPrev){ dotPrev.setAttribute('cx', x); dotPrev.setAttribute('cy', yPrev); dotPrev.classList.add('visible'); }
}

function pCmpLeave(){
  var ch = document.getElementById('p-cmp-crosshair');
  var dotCur = document.getElementById('p-cmp-dot-cur');
  var dotPrev = document.getElementById('p-cmp-dot-prev');
  if(ch) ch.classList.remove('visible');
  if(dotCur) dotCur.classList.remove('visible');
  if(dotPrev) dotPrev.classList.remove('visible');
}

/* ── 4 cards de delta ── */
function pCmpDeltas(cur, prev){
  var baix = function(arr){ return arr.filter(function(a){ return a.status === 'baixada'; }).length; };
  var distinct = function(arr, key){ return new Set(arr.map(function(a){ return a[key]; })).size; };

  var cards = [
    { label: 'Artes geradas',     cur: cur.length,                  prev: prev.length },
    { label: 'Downloads',         cur: baix(cur),                   prev: baix(prev) },
    { label: 'Franqueados ativos',cur: distinct(cur, 'franqueadoId'),prev: distinct(prev, 'franqueadoId') },
    { label: 'Campanhas ativas',  cur: distinct(cur, 'campId'),     prev: distinct(prev, 'campId') },
  ];

  return `<div class="p-cmp-grid">${cards.map(pCmpDeltaCard).join('')}</div>`;
}

function pCmpDeltaCard(d){
  var delta = pDelta(d.cur, d.prev);                 // {pct, dir}
  var arrow = delta.dir === 'up' ? '▲' : delta.dir === 'down' ? '▼' : '▬';
  var pctTxt = (Math.round(delta.pct * 10) / 10).toString().replace('.', ',') + '%';
  return `<div class="p-cmp-delta">
    <div class="p-cmp-delta-label">${pEsc(d.label)}</div>
    <div class="p-cmp-delta-nums">
      <span class="p-cmp-delta-cur">${pFmtNum(d.cur)}</span>
      <span class="p-cmp-delta-vs">vs ${pFmtNum(d.prev)}</span>
    </div>
    <div class="p-cmp-delta-var ${delta.dir}"><span class="p-cmp-delta-arrow">${arrow}</span>${pctTxt}</div>
  </div>`;
}

/* handler dos pills de modo */
function pSetComparador(modo){
  if(!P_CMP_MODO_PERIODO[modo]) return;
  if(pState.comparadorModo === modo) return;
  pState.comparadorModo = modo;
  pRender();
}
