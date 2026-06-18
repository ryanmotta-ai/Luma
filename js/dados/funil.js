/**
 * js/dados/funil.js
 *
 * Módulo 3 — Seção 7 · Funil de conversão do chat.
 * Barras horizontais decrescentes (uma por etapa do funil), com taxa de avanço
 * entre etapas + badge de alto abandono, donut SVG (baixadas vs. rascunhos) e
 * insight automático (maior queda) calculado via pFunilInsight() [state.js].
 * HTML/SVG inline puro, sem dependências. Tema claro+escuro via tokens CSS.
 *
 * Funções globais (prefixo p*, viram window.pX p/ o roteador):
 *   pRenderFunil() — render principal (retorna HTML).
 *   pFnBars()      — as barras decrescentes + taxas entre etapas.
 *   pFnDonut()     — donut baixadas vs. rascunhos (SVG).
 *   pFnInsightBox()— faixa de insight automático.
 *   pFnEtapa(et)   — n absoluto de uma etapa pelo rótulo.
 */

function pRenderFunil(){
  var head = `
    <div class="p-head">
      <div>
        <div class="p-head-title">Funil de conversão do chat</div>
        <div class="p-head-sub">Da seleção da campanha ao download</div>
      </div>
    </div>`;

  if(!P_MOCK_FUNIL || !P_MOCK_FUNIL.length || !P_MOCK_FUNIL[0].n){
    return head + pEmpty('<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>', 'Sem dados de funil',
      'Nenhuma interação registrada no chat. Gere artes pelo módulo Franqueado para popular o funil.',
      'Ir para Franqueado', 'franqueado');
  }

  return head + `
    <div class="p-fn-grid" onmouseleave="pHideTip()">
      <div class="p-chart-card p-fn-funnel">
        <div class="p-chart-title">Etapas do chat</div>
        <div class="p-chart-note">Cada barra = quantas pessoas chegaram à etapa · % relativo ao topo</div>
        ${pFnBars()}
      </div>
      <div class="p-chart-card p-fn-side">
        <div class="p-chart-title">Geradas vs. baixadas</div>
        <div class="p-chart-note">Quem gerou a arte e quem chegou a baixar</div>
        ${pFnDonut()}
      </div>
    </div>
    ${pFnInsightBox()}`;
}

/* n absoluto de uma etapa pelo rótulo (tolerante a ausência) */
function pFnEtapa(rotulo){
  for(var i = 0; i < P_MOCK_FUNIL.length; i++){
    if(P_MOCK_FUNIL[i].etapa === rotulo) return P_MOCK_FUNIL[i].n;
  }
  return 0;
}

/* interpola laranja (--p-accent) → vermelho (--p-neg) conforme a posição (0..1) */
function pFnFaixa(pos){
  // pos 0 = topo (mais "saudável"); pos 1 = fundo (mais perda acumulada)
  if(pos < 0.34) return 'a';        // laranja cheio
  if(pos < 0.67) return 'b';        // laranja-âmbar
  return 'c';                        // tende ao vermelho
}

function pFnBars(){
  var topo = P_MOCK_FUNIL[0].n || 1;
  var ultimo = P_MOCK_FUNIL.length - 1;
  var html = '';

  P_MOCK_FUNIL.forEach(function(e, i){
    var pctTopo = e.n / topo * 100;                       // % relativo ao topo
    var pctTopoTxt = (Math.round(pctTopo * 10) / 10).toString().replace('.', ',') + '%';
    var faixa = pFnFaixa(i / Math.max(1, ultimo));
    var tempoTip = e.tempo ? `<br>Tempo médio: <b>${e.tempo}s</b>` : '';
    var tip = `<span class='p-tt-date'>${pEsc(e.etapa)}</span><br><b>${pFmtNum(e.n)}</b> pessoas · ${pctTopoTxt} do topo${tempoTip}`;

    html += `<div class="p-fn-row" style="margin-bottom:8px;">
      <div class="p-fn-row-head">
        <span class="p-fn-etapa">${pEsc(e.etapa)}</span>
        <span class="p-fn-nums"><span class="p-fn-abs">${pFmtNum(e.n)}</span><span class="p-fn-pct">${pctTopoTxt} do topo</span></span>
      </div>
      <div class="p-fn-track" data-tip="${tip}" onmousemove="pChartTip(event)">
        <div class="p-fn-fill ${faixa}" style="width:0" data-grow="${pctTopo.toFixed(2)}%"></div>
      </div>
      ${e.tempo ? `<div class="p-fn-friction-txt">Tempo médio na etapa: <b style="color:${e.tempo > 120 ? 'var(--p-neg)' : 'var(--p-text-mut)'};">${e.tempo} segundos</b></div>` : ''}
    </div>`;

    // conector entre esta etapa e a próxima (taxa de avanço + badge se queda > 20%)
    if(i < ultimo){
      var prox = P_MOCK_FUNIL[i + 1];
      var avanco = e.n ? prox.n / e.n : 0;                // fração que avançou
      var queda = 1 - avanco;
      var avancoTxt = (Math.round(avanco * 1000) / 10).toString().replace('.', ',') + '%';
      var alto = queda > 0.20;
      html += `<div class="p-fn-conn${alto ? ' alto' : ''}">
        <span class="p-fn-conn-arrow">→</span>
        <span class="p-fn-conn-rate">${avancoTxt} avançaram</span>
        ${alto ? `<span class="p-fn-badge"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>Alto abandono</span>` : ''}
      </div>`;
    }
  });

  return `<div class="p-fn-bars">${html}</div>`;
}

/* donut SVG: baixadas (Arte baixada) vs. rascunhos (geradas − baixadas) */
function pFnDonut(){
  var geradas  = pFnEtapa('Arte gerada');
  var baixadas = pFnEtapa('Arte baixada');
  if(baixadas > geradas) baixadas = geradas;              // guarda contra dados inconsistentes
  var rascunhos = Math.max(0, geradas - baixadas);

  var data = [
    { k:'baixadas',  label:'Baixadas',  n:baixadas,  cls:'baix' },
    { k:'rascunhos', label:'Rascunhos', n:rascunhos, cls:'rasc' },
  ];
  var total = geradas;

  if(!total){
    return pEmpty('<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>', 'Sem artes geradas', 'Nenhuma arte foi gerada ainda no período.', null);
  }

  var cx = 60, cy = 60, rMid = 42, sw = 20;
  var C = 2 * Math.PI * rMid;
  var acc = 0, segs = '';
  data.forEach(function(d){
    if(!d.n) return;
    var frac = d.n / total;
    var dash = frac * C;
    var pct = Math.round(frac * 1000) / 10;
    segs += `<circle class="p-fn-seg ${d.cls}" cx="${cx}" cy="${cy}" r="${rMid}" fill="none" stroke-width="${sw}"
      stroke-dasharray="${dash.toFixed(2)} ${(C - dash).toFixed(2)}"
      stroke-dashoffset="${(-acc * C).toFixed(2)}"
      data-tip="${d.label}<br><b>${pFmtNum(d.n)}</b> (${pct.toString().replace('.', ',')}%)"
      onmousemove="pChartTip(event)"></circle>`;
    acc += frac;
  });

  var legend = data.map(function(d){
    var pct = total ? Math.round(d.n / total * 1000) / 10 : 0;
    return `<div class="p-fn-leg-item">
      <span class="p-fn-leg-dot ${d.cls}"></span>
      <span class="p-fn-leg-name">${pEsc(d.label)}</span>
      <span class="p-fn-leg-val">${pFmtNum(d.n)}<span class="p-fn-leg-pct">${pct.toString().replace('.', ',')}%</span></span>
    </div>`;
  }).join('');

  return `<div class="p-fn-donut-wrap">
    <svg class="p-fn-donut" width="120" height="120" viewBox="0 0 120 120" role="img" aria-label="Geradas vs. baixadas" style="flex-shrink:0">
      <g transform="rotate(-90 ${cx} ${cy})">${segs}</g>
      <text class="p-fn-donut-num" x="${cx}" y="${cy - 1}" text-anchor="middle" dominant-baseline="middle">${pFmtNum(total)}</text>
      <text class="p-fn-donut-lbl" x="${cx}" y="${cy + 13}" text-anchor="middle">GERADAS</text>
    </svg>
    <div class="p-fn-legend">${legend}</div>
  </div>`;
}

/* faixa de insight automático — maior queda relativa entre etapas (pFunilInsight) */
function pFnInsightBox(){
  var ins = pFunilInsight();
  if(!ins || ins.drop == null || ins.drop < 0) return '';
  var pctTxt = Math.round(ins.pct) + '%';
  var pessoas = pFmtNum(ins.perdidos) + (ins.perdidos === 1 ? ' pessoa' : ' pessoas');
  return `<div class="p-fn-insight">
    <span class="p-fn-insight-ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px;"><path d="M9 18h6m-5 4h4m1.3-17.7a7.5 7.5 0 1 0-8.6 0c1.7 1.3 2.7 3.3 2.7 5.5h4c0-2.2 1-4.2 2.7-5.5z"></path></svg></span>
    <span class="p-fn-insight-txt">A maior queda está entre <b>${pEsc(ins.de)}</b> e <b>${pEsc(ins.para)}</b> — <b class="p-fn-insight-hl">${pctTxt}</b> de perda (${pessoas}).</span>
  </div>`;
}
