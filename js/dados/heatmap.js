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
      ${pHeatSumario()}
      ${pHeatLegenda()}
      ${pHeatPainel()}
    </div>
  </div>`;
}

/* ── grid SVG: 7 colunas (seg→dom) × 24 linhas (00h→23h) ── */
function pHeatGrid(){
  var cellW = 36, cellH = 18, gap = 2;
  var hourLabelW = 34;                 // faixa à esquerda p/ "00h"
  var dayLabelH = 22;                  // faixa no topo p/ "Seg"
  var nCols = P_DIAS.length;           // 7
  var nRows = 24;
  var gridW = nCols * cellW + (nCols - 1) * gap;
  var gridH = nRows * cellH + (nRows - 1) * gap;
  var W = hourLabelW + gridW;
  var H = dayLabelH + gridH;

  // labels de dia (topo) — sáb/dom levemente mais claros (var(--p-text-2))
  var dayLabels = '';
  P_DIAS.forEach(function(d, ci){
    var cx = hourLabelW + ci * (cellW + gap) + cellW / 2;
    var fim = (d === 'sab' || d === 'dom');
    dayLabels += `<text class="p-heat-day ${fim ? 'fim' : ''}" x="${cx.toFixed(1)}" y="${(dayLabelH - 7).toFixed(1)}" text-anchor="middle">${pEsc(P_DIAS_LBL[d])}</text>`;
  });

  // labels de hora (esquerda) a cada 3h
  var hourLabels = '';
  for(var h = 0; h < nRows; h += 3){
    var cy = dayLabelH + h * (cellH + gap) + cellH / 2;
    var hl = ('0' + h).slice(-2) + 'h';
    hourLabels += `<text class="p-heat-hour" x="${(hourLabelW - 8).toFixed(1)}" y="${(cy + 3.5).toFixed(1)}" text-anchor="end">${hl}</text>`;
  }

  // células
  var cells = '';
  P_DIAS.forEach(function(d, ci){
    for(var hh = 0; hh < nRows; hh++){
      var v = pHeatGet(d, hh);
      var x = hourLabelW + ci * (cellW + gap);
      var y = dayLabelH + hh * (cellH + gap);
      var sel = (pState.heatSel === d + '-' + hh);
      var tip = pEsc(P_DIAS_FULL[d]) + ' ' + (('0' + hh).slice(-2)) + 'h · <b>' + v + '</b> arte' + (v === 1 ? '' : 's');
      cells += `<rect class="p-heat-cell ${sel ? 'sel' : ''}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cellW}" height="${cellH}" rx="3"
        style="fill:${pHeatCor(v)}"
        data-tip="${tip}" onmousemove="pChartTip(event)"
        onclick="pHeatSelect('${d}',${hh})"></rect>`;
    }
  });

  return `<div class="p-heat-grid-card">
    <svg class="p-heat-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMin meet" role="img" aria-label="Mapa de calor de horários">
      ${dayLabels}${hourLabels}${cells}
    </svg>
  </div>`;
}

/* ── legenda da escala (5 swatches) ── */
function pHeatLegenda(){
  var nivs = [
    { c: pHeatCor(0),  lbl: 'Nenhuma' },
    { c: pHeatCor(1),  lbl: 'Pouca'   },
    { c: pHeatCor(3),  lbl: 'Média'   },
    { c: pHeatCor(6),  lbl: 'Alta'    },
    { c: pHeatCor(10), lbl: 'Muito'   },
  ];
  var sw = nivs.map(function(n){
    return `<span class="p-heat-leg-item"><span class="p-heat-swatch" style="background:${n.c}"></span>${pEsc(n.lbl)}</span>`;
  }).join('');
  return `<div class="p-heat-legenda"><span class="p-heat-leg-cap">Volume de artes</span>${sw}</div>`;
}

/* ── linha de sumário (pico / dia mais ativo / hora mais ativa) ── */
function pHeatSumario(){
  var r = pHeatResumo();
  var picoDia = P_DIAS_FULL[r.pico.d] || r.pico.d;
  var diaTop  = P_DIAS_FULL[r.diaTop] || r.diaTop;
  return `<div class="p-heat-sumario">
    <span class="p-heat-sum-item"><span class="p-heat-sum-lbl">Pico</span> <b>${pEsc(picoDia)}</b> às ${('0' + r.pico.h).slice(-2)}h <span class="p-heat-sum-mut">(${r.pico.v} artes)</span></span>
    <span class="p-heat-sum-sep">·</span>
    <span class="p-heat-sum-item"><span class="p-heat-sum-lbl">Dia mais ativo</span> <b>${pEsc(diaTop)}</b></span>
    <span class="p-heat-sum-sep">·</span>
    <span class="p-heat-sum-item"><span class="p-heat-sum-lbl">Hora mais ativa</span> <b>${('0' + r.horaTop).slice(-2)}h</b></span>
  </div>`;
}

/* ── painel de detalhe (só quando há célula selecionada) ── */
function pHeatPainel(){
  if(!pState.heatSel) return `<div class="p-heat-painel p-heat-hint">
    <div class="p-heat-hint-ico">👆</div>
    <div class="p-heat-painel-empty">Clique numa célula do mapa para ver as campanhas e franqueados daquele horário.</div>
  </div>`;
  var parts = pState.heatSel.split('-');
  var d = parts[0], h = +parts[1];
  var det = pHeatDetalhe(d, h);
  var diaFull = P_DIAS_FULL[d] || d;

  if(!det.total){
    return `<div class="p-heat-painel">
      <div class="p-heat-painel-head">
        <div class="p-heat-painel-title">${pEsc(diaFull)} às ${('0' + h).slice(-2)}h · 0 artes</div>
        <button class="p-heat-close" onclick="pHeatSelect('${d}',${h})">Fechar ✕</button>
      </div>
      <div class="p-heat-painel-empty">Nenhuma arte gerada neste horário.</div>
    </div>`;
  }

  var maxC = Math.max.apply(null, det.camps.map(function(c){ return c.n; }).concat([1]));
  var maxF = Math.max.apply(null, det.franqs.map(function(f){ return f.n; }).concat([1]));

  var camps = det.camps.map(function(c){
    var w = Math.round(c.n / maxC * 100);
    return `<div class="p-heat-row">
      <span class="p-heat-row-name">${pEsc(c.nome)}</span>
      <span class="p-heat-row-bar"><span class="p-heat-row-fill" data-grow="${w}%" style="width:0"></span></span>
      <span class="p-heat-row-n">${c.n}</span>
    </div>`;
  }).join('');

  var franqs = det.franqs.map(function(f){
    var w = Math.round(f.n / maxF * 100);
    return `<div class="p-heat-row">
      <span class="p-heat-row-name">${pEsc(f.nome)}</span>
      <span class="p-heat-row-bar"><span class="p-heat-row-fill" data-grow="${w}%" style="width:0"></span></span>
      <span class="p-heat-row-n">${f.n}</span>
    </div>`;
  }).join('');

  return `<div class="p-heat-painel">
    <div class="p-heat-painel-head">
      <div class="p-heat-painel-title">${pEsc(diaFull)} às ${('0' + h).slice(-2)}h · ${det.total} arte${det.total === 1 ? '' : 's'}</div>
      <button class="p-heat-close" onclick="pHeatSelect('${d}',${h})">Fechar ✕</button>
    </div>
    <div class="p-heat-painel-cols">
      <div class="p-heat-painel-col">
        <div class="p-heat-col-cap">Campanhas</div>
        ${camps}
      </div>
      <div class="p-heat-painel-col">
        <div class="p-heat-col-cap">Franqueados</div>
        ${franqs}
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
