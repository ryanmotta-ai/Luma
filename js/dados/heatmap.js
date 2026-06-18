/**
 * js/dados/heatmap.js
 *
 * Módulo 3 — Seção 3 · Mapa de calor de horários (7 dias × 24 horas).
 * Grid SVG inline puro: cor da célula por volume de artes geradas. Clicável →
 * painel de detalhe (campanhas + franqueados daquele horário). SVG inline puro.
 * Funciona nos temas claro e escuro (tokens CSS do escopo #view-dados).
 */

/* nome completo do dia (p/ tooltip e título do detalhe) */
var P_DIAS_FULL = { seg:'Segunda', ter:'Terça', qua:'Quarta', qui:'Quinta', sex:'Sexta', sab:'Sábado', dom:'Domingo' };

/* cor de uma célula conforme o volume v */
function pHeatCor(v){
  if(v <= 0) return 'var(--p-track)';
  if(v <= 2) return 'rgba(255,144,0,.15)';
  if(v <= 5) return 'rgba(255,144,0,.35)';
  if(v <= 9) return 'rgba(255,144,0,.65)';
  return 'var(--p-accent)';
}

function pRenderHeatmap(){
  pBuildHeatmap();

  var head = `
    <div class="p-head">
      <div>
        <div class="p-head-title">Quando os franqueados geram artes</div>
        <div class="p-head-sub">Horário local · últimos 30 dias</div>
      </div>
    </div>`;

  return head + `<div class="p-heat-wrap" onmouseleave="pHideTip()">
    ${pHeatGrid()}
    <div class="p-heat-side">
      ${pHeatBanner()}
      ${pHeatSumario()}
      ${pHeatLegenda()}
      ${pHeatPainel()}
    </div>
  </div>`;
}

/* crosshair hover logic */
function pHeatHover(d, h){
  var elD = document.getElementById('heat-day-' + d);
  var elH = document.getElementById('heat-hour-' + (h - (h%2)));
  if(elD) elD.classList.add('hl');
  if(elH) elH.classList.add('hl');
}
function pHeatOut(d, h){
  var elD = document.getElementById('heat-day-' + d);
  var elH = document.getElementById('heat-hour-' + (h - (h%2)));
  if(elD) elD.classList.remove('hl');
  if(elH) elH.classList.remove('hl');
}

/* ── grid SVG: 7 colunas (seg→dom) × 24 linhas (00h→23h) ── */
function pHeatGrid(){
  var cellW = 22, cellH = 22, gap = 4;
  var hourLabelW = 34;
  var dayLabelH = 26;
  var nCols = P_DIAS.length;
  var nRows = 24;
  var gridW = nCols * cellW + (nCols - 1) * gap;
  var gridH = nRows * cellH + (nRows - 1) * gap;
  var W = hourLabelW + gridW;
  var H = dayLabelH + gridH;

  var resumo = pHeatResumo();
  var picoD = resumo.pico.d;
  var picoH = resumo.pico.h;

  // labels de dia (topo) — sáb/dom levemente mais claros (var(--p-text-2))
  var dayLabels = '';
  P_DIAS.forEach(function(d, ci){
    var cx = hourLabelW + ci * (cellW + gap) + cellW / 2;
    var fim = (d === 'sab' || d === 'dom');
    dayLabels += `<text id="heat-day-${d}" class="p-heat-day ${fim ? 'fim' : ''}" x="${cx.toFixed(1)}" y="${(dayLabelH - 7).toFixed(1)}" text-anchor="middle">${pEsc(P_DIAS_LBL[d])}</text>`;
  });

  // labels de hora (esquerda) a cada 2h
  var hourLabels = '';
  for(var h = 0; h < nRows; h += 2){
    var cy = dayLabelH + h * (cellH + gap) + cellH / 2;
    var hl = ('0' + h).slice(-2) + 'h';
    hourLabels += `<text id="heat-hour-${h}" class="p-heat-hour" x="${(hourLabelW - 8).toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="end">${hl}</text>`;
  }

  // células
  var cells = '';
  P_DIAS.forEach(function(d, ci){
    for(var hh = 0; hh < nRows; hh++){
      var v = pHeatGet(d, hh);
      var x = hourLabelW + ci * (cellW + gap);
      var y = dayLabelH + hh * (cellH + gap);
      var sel = (pState.heatSel === d + '-' + hh);
      var isHotspot = (d === picoD && hh === picoH && v > 0);
      var det = pHeatDetalhe(d, hh);
      var topC = det.camps.length ? det.camps[0].nome : '-';
      var topF = det.franqs.length ? det.franqs[0].nome : '-';
      
      var tip = `<div class="p-tt-rich-head"><span class="p-tt-rich-title">${pEsc(P_DIAS_FULL[d])} ${('0'+hh).slice(-2)}h</span><span class="p-tt-rich-val">${v} artes</span></div>`;
      if(v > 0) {
        tip += `<div class="p-tt-rich-row"><span class="p-tt-rich-lbl">Top Campanha</span><span class="p-tt-rich-txt">${pEsc(topC)}</span></div>`;
        tip += `<div class="p-tt-rich-row"><span class="p-tt-rich-lbl">Top Franqueado</span><span class="p-tt-rich-txt">${pEsc(topF)}</span></div>`;
      }
      
      var delay = (ci * 0.04) + (hh * 0.015);
      
      cells += `<rect class="p-heat-cell p-anim ${sel ? 'sel' : ''} ${isHotspot ? 'hotspot' : ''}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cellW}" height="${cellH}" rx="4"
        style="fill:${pHeatCor(v)}; animation: gFadeInScale 0.4s var(--p-ease) ${delay}s both;"
        data-tip="${tip.replace(/"/g, '&quot;')}" onmousemove="pChartTip(event)" onmouseenter="pHeatHover('${d}', ${hh})" onmouseleave="pHeatOut('${d}', ${hh})"
        onclick="pHeatSelect('${d}',${hh})"></rect>`;
    }
  });

  return `<div class="p-heat-grid-card">
    <svg class="p-heat-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMin meet" role="img" aria-label="Mapa de calor de horários">
      ${dayLabels}${hourLabels}${cells}
    </svg>
  </div>`;
}

/* ── legenda contínua e banner inteligente ── */
function pHeatLegenda(){
  return `<div class="p-heat-legenda">
    <span class="p-heat-leg-cap">Volume de artes</span>
    <div class="p-heat-grad-wrap">
      <span class="p-heat-grad-lbl">0</span>
      <div class="p-heat-grad-bar"></div>
      <span class="p-heat-grad-lbl">Max</span>
    </div>
  </div>`;
}

function pHeatBanner(){
  var r = pHeatResumo();
  var picoD = r.pico.d;
  var picoH = r.pico.h;
  var isOffHours = (picoD === 'sab' || picoD === 'dom' || picoH < 9 || picoH >= 18);
  
  if(isOffHours && r.pico.v > 0) {
    return `<div class="p-heat-insight-banner">
      <div class="p-heat-banner-ico">💡</div>
      <div class="p-heat-banner-txt">
        Detectamos que o pico absoluto de atividade (<b>${r.pico.v} artes</b> no <b>${P_DIAS_FULL[picoD]} às ${('0'+picoH).slice(-2)}h</b>) 
        ocorre fora do horário comercial (9h-18h). Considere alocar plantão nestes horários.
      </div>
    </div>`;
  }
  return '';
}

/* ── linha de sumário (pico / dia mais ativo / hora mais ativa) ── */
function pHeatSumario(){
  var r = pHeatResumo();
  var picoDia = P_DIAS_FULL[r.pico.d] || r.pico.d;
  var diaTop  = P_DIAS_FULL[r.diaTop] || r.diaTop;
  return `<div class="p-heat-sumario">
    <span class="p-heat-sum-item">
      <span class="p-heat-sum-lbl">Pico</span>
      <div><b>${pEsc(picoDia)}</b> às ${('0' + r.pico.h).slice(-2)}h <span class="p-heat-sum-mut">(${r.pico.v} artes)</span></div>
    </span>
    <span class="p-heat-sum-sep">·</span>
    <span class="p-heat-sum-item">
      <span class="p-heat-sum-lbl">Dia mais ativo</span>
      <div><b>${pEsc(diaTop)}</b></div>
    </span>
    <span class="p-heat-sum-sep">·</span>
    <span class="p-heat-sum-item">
      <span class="p-heat-sum-lbl">Hora mais ativa</span>
      <div><b>${('0' + r.horaTop).slice(-2)}h</b></div>
    </span>
  </div>`;
}

/* ── painel de detalhe (estatísticas gerais ou detalhe da célula) ── */
function pHeatPainel(){
  let title = '';
  let showClose = false;
  let det = null;
  let subtitle = '';
  let d = '', h = 0;

  if(!pState.heatSel){
    title = 'Visão Geral · Últimos 30 dias';
    subtitle = '* Clique em qualquer célula do mapa para filtrar por horário';
    det = pHeatOverallDetail();
  } else {
    var parts = pState.heatSel.split('-');
    d = parts[0]; h = +parts[1];
    det = pHeatDetalhe(d, h);
    var diaFull = P_DIAS_FULL[d] || d;
    title = diaFull + ' às ' + ('0' + h).slice(-2) + 'h · ' + det.total + ' arte' + (det.total === 1 ? '' : 's');
    showClose = true;
  }

  if(!det.total){
    return `<div class="p-heat-painel">
      <div class="p-heat-painel-head">
        <div>
          <div class="p-heat-painel-title">${pEsc(title)}</div>
          ${subtitle ? `<div class="p-heat-painel-sub">${pEsc(subtitle)}</div>` : ''}
        </div>
        ${showClose ? `<button class="p-heat-close" onclick="pHeatSelect('${d}',${h})">Fechar ✕</button>` : ''}
      </div>
      <div class="p-heat-painel-empty">Nenhuma arte gerada neste período.</div>
    </div>`;
  }

  var maxC = Math.max.apply(null, det.camps.map(function(c){ return c.n; }).concat([1]));
  var maxF = Math.max.apply(null, det.franqs.map(function(f){ return f.n; }).concat([1]));

  var camps = det.camps.map(function(c){
    var w = Math.round(c.n / maxC * 100);
    var pct = Math.round(c.n / det.total * 100);
    return `<div class="p-heat-row">
      <span class="p-heat-row-name">${pEsc(c.nome)}</span>
      <span class="p-heat-row-bar"><span class="p-heat-row-fill" data-grow="${w}%" style="width:0"></span></span>
      <span class="p-heat-row-n" style="font-weight:700; width:60px; text-align:right;">${c.n} <span style="font-weight:500;color:var(--p-text-mut);font-size:10.5px;">(${pct}%)</span></span>
    </div>`;
  }).join('');

  var franqs = det.franqs.map(function(f){
    var w = Math.round(f.n / maxF * 100);
    var pct = Math.round(f.n / det.total * 100);
    var inicial = String(f.nome || '?').charAt(0).toUpperCase();
    return `<div class="p-heat-row" style="align-items:center;">
      <span class="p-fr-avatar" style="background:var(--dm-orange); width:20px; height:20px; font-size:10px; margin-right:4px;">${inicial}</span>
      <span class="p-heat-row-name">${pEsc(f.nome)}</span>
      <span class="p-heat-row-bar"><span class="p-heat-row-fill" data-grow="${w}%" style="width:0"></span></span>
      <span class="p-heat-row-n" style="font-weight:700; width:60px; text-align:right;">${f.n} <span style="font-weight:500;color:var(--p-text-mut);font-size:10.5px;">(${pct}%)</span></span>
    </div>`;
  }).join('');

  return `<div class="p-heat-painel">
    <div class="p-heat-painel-head">
      <div>
        <div class="p-heat-painel-title">${pEsc(title)}</div>
        ${subtitle ? `<div class="p-heat-painel-sub">${pEsc(subtitle)}</div>` : ''}
      </div>
      ${showClose ? `<button class="p-heat-close" onclick="pHeatSelect('${d}',${h})">Fechar ✕</button>` : ''}
    </div>
    <div class="p-heat-painel-cols">
      <div class="p-heat-painel-col">
        <div class="p-heat-col-cap">Campanhas</div>
        <div class="p-heat-list-scroll">
          ${camps}
        </div>
      </div>
      <div class="p-heat-painel-col">
        <div class="p-heat-col-cap">Franqueados</div>
        <div class="p-heat-list-scroll">
          ${franqs}
        </div>
      </div>
    </div>
  </div>`;
}

/* clique numa célula: alterna seleção 'd-h' ↔ null e re-renderiza */
function pHeatSelect(d, h){
  var key = d + '-' + h;
  pState.heatSel = (pState.heatSel === key) ? null : key;
  pRender();
}
