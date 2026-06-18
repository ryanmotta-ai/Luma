/**
 * js/dados/geo.js
 *
 * Section 8 - geographic distribution.
 * Compact executive view: region pills, top-3 summary cards, podium strip and
 * top-10 table. No map.
 */

var P_GEO_ORDEM = ['Sul', 'Sudeste', 'Centro-Oeste', 'Nordeste', 'Norte'];

function pGeoTopRegions(){
  var porReg = pGeoPorRegiao();
  return P_GEO_ORDEM.slice().sort(function(a, b){
    return (porReg[b] || 0) - (porReg[a] || 0);
  });
}

function pGeoCard(label, value, sub, width, delay, action){
  return `<button class="p-geo-summary-card" type="button" style="animation-delay:${delay}ms" data-tip="${sub}" onmousemove="pChartTip(event)"${action ? ` onclick="${action}"` : ''}>
    <span class="p-geo-summary-label">${label}</span>
    <span class="p-geo-summary-value">${value}</span>
    <span class="p-geo-summary-sub">${sub}</span>
    <span class="p-geo-summary-bar"><span style="width:${width}%"></span></span>
  </button>`;
}

function pRenderGeo(){
  var regiao = pState.geoRegiao || 'all';
  if(regiao !== 'all' && !P_REGIOES[regiao]) regiao = 'all';
  pState.geoSearch = pState.geoSearch || '';

  var head = `
    <div class="p-head">
      <div>
        <div class="p-head-title">Distribuicao geografica</div>
        <div class="p-head-sub">Onde a rede gera artes · ${pFmtNum(pGeoTotal('all'))} artes em ${Object.keys(P_MOCK_GEO).length} estados</div>
      </div>
    </div>`;

  var ranking = pGeoRanking(regiao);
  if(!ranking.length){
    return head + pGeoFiltros(regiao) + pEmpty(
      '<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon><line x1="9" y1="3" x2="9" y2="18"></line><line x1="15" y1="6" x2="15" y2="21"></line></svg>',
      'Sem dados na regiao',
      'Nenhuma arte registrada nos estados desta regiao. Selecione "Todas" acima.'
    );
  }

  return head + pGeoFiltros(regiao) + `
    <div class="p-geo-stack">
      ${pGeoTabela(regiao, ranking)}
    </div>`;
}

function pGeoFiltros(regiao){
  var porReg = pGeoPorRegiao();
  var todas = `<button class="p-geo-pill ${regiao === 'all' ? 'active' : ''}" onclick="pSetGeoRegiao('all')">Todas</button>`;
  var pills = P_GEO_ORDEM.map(function(r){
    var n = porReg[r] || 0;
    return `<button class="p-geo-pill ${regiao === r ? 'active' : ''}" onclick="pSetGeoRegiao('${r}')">${pEsc(r)}<span class="p-geo-pill-n">${pFmtNum(n)}</span></button>`;
  }).join('');
  return `<div class="p-geo-filtros">${todas}${pills}</div>`;
}

function pGeoTabela(regiao, ranking){
  var totalAll = pGeoTotal('all') || 1;
  var totalReg = pGeoTotal(regiao);
  var currentCount = ranking.length;
  var porReg = pGeoPorRegiao();
  var topRegioes = pGeoTopRegions().slice(0, 3);
  var topState = ranking[0];
  var topRegion = topRegioes[0];
  var topRegionTotal = porReg[topRegion] || 0;

  var summaryHtml;
  if(regiao === 'all'){
    var stateVal = topState ? `<span style="display:inline-flex; align-items:center; gap:8px;"><img src="https://assets.codante.io/codante-apis/bandeiras-dos-estados/${topState.uf.toLowerCase()}-rounded.svg" alt="${pEsc(topState.uf)}" style="width:28px; height:18px; object-fit:cover; border-radius:4px; border:1px solid var(--p-border-2);" /> ${pEsc(topState.uf)}</span>` : '—';
    summaryHtml = [
      pGeoCard('Artes no Brasil', pFmtNum(totalAll), 'Volume total da rede', 100, 0),
      pGeoCard('Regiao lider', pEsc(topRegion), `${pFmtNum(topRegionTotal)} artes`, Math.round((topRegionTotal / totalAll) * 100), 60, `pSetGeoRegiao('${topRegion}')`),
      pGeoCard('Estado lider', stateVal, topState ? `${pEsc(topState.nome)} · ${pFmtNum(topState.n)} artes` : 'Sem ranking', Math.round(((topState && topState.n) || 0) / totalAll * 100), 120, topState ? `pSetGeoRegiao('${topState.regiao}')` : '')
    ].join('');
  }else{
    var stateVal = topState ? `<span style="display:inline-flex; align-items:center; gap:8px;"><img src="https://assets.codante.io/codante-apis/bandeiras-dos-estados/${topState.uf.toLowerCase()}-rounded.svg" alt="${pEsc(topState.uf)}" style="width:28px; height:18px; object-fit:cover; border-radius:4px; border:1px solid var(--p-border-2);" /> ${pEsc(topState.uf)}</span>` : '—';
    summaryHtml = [
      pGeoCard('Artes da regiao', pFmtNum(totalReg), `${Math.round(totalReg / totalAll * 100)}% do total nacional`, 100, 0),
      pGeoCard('Estados ativos', pFmtNum(currentCount), regiao, Math.round((currentCount / 10) * 100), 60),
      pGeoCard('Estado lider', stateVal, topState ? `${pEsc(topState.nome)} · ${pFmtNum(topState.n)} artes` : 'Sem ranking', Math.round(((topState && topState.n) || 0) / (totalReg || 1) * 100), 120)
    ].join('');
  }

  var controlsHtml = `
    <div class="p-geo-toolbar">
      <div class="p-search-wrap p-geo-search">
        <svg class="p-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" class="p-input-search" placeholder="Buscar estado por nome ou UF..." value="${pEsc(pState.geoSearch)}" oninput="pSearchGeo(this.value)" aria-label="Buscar estado">
        ${pState.geoSearch ? `<button class="p-geo-clear-btn" type="button" onclick="pClearGeoSearch()" aria-label="Limpar busca">×</button>` : ''}
      </div>
    </div>`;

  var showPodium = !pState.geoSearch && ranking.filter(function(e){ return e.n > 0; }).length >= 3;
  var podiumHtml = '';
  if(showPodium){
    var f1 = ranking[0], f2 = ranking[1], f3 = ranking[2];
    podiumHtml = `
      <div class="p-geo-podium-strip">
        <button class="p-geo-mini-card silver" type="button" style="animation-delay:160ms" data-tip="${pEsc(f2.nome)} · ${pEsc(f2.regiao)}<br><b>${f2.n}</b> artes" onmousemove="pChartTip(event)" onclick="pSetGeoRegiao('${f2.regiao}')">
          <span class="p-geo-mini-rank">2º</span>
          <span class="p-geo-mini-avatar" style="position:relative; overflow:hidden; border:1px solid rgba(255,255,255,0.1);">
            <img src="https://assets.codante.io/codante-apis/bandeiras-dos-estados/${f2.uf.toLowerCase()}-square-rounded.svg" alt="${pEsc(f2.uf)}" style="width:100%; height:100%; object-fit:cover;" />
          </span>
          <span class="p-geo-mini-meta">
            <span class="p-geo-mini-name">${pEsc(f2.nome)}</span>
            <span class="p-geo-mini-sub"><b>${pFmtNum(f2.n)}</b> artes</span>
          </span>
        </button>
        <button class="p-geo-mini-card gold" type="button" style="animation-delay:220ms" data-tip="${pEsc(f1.nome)} · ${pEsc(f1.regiao)}<br><b>${f1.n}</b> artes" onmousemove="pChartTip(event)" onclick="pSetGeoRegiao('${f1.regiao}')">
          <span class="p-geo-mini-rank">1º</span>
          <span class="p-geo-mini-avatar gold" style="position:relative; overflow:hidden; border:1.5px solid var(--p-accent);">
            <img src="https://assets.codante.io/codante-apis/bandeiras-dos-estados/${f1.uf.toLowerCase()}-square-rounded.svg" alt="${pEsc(f1.uf)}" style="width:100%; height:100%; object-fit:cover;" />
          </span>
          <span class="p-geo-mini-meta">
            <span class="p-geo-mini-name">${pEsc(f1.nome)}</span>
            <span class="p-geo-mini-sub"><b>${pFmtNum(f1.n)}</b> artes</span>
          </span>
        </button>
        <button class="p-geo-mini-card bronze" type="button" style="animation-delay:280ms" data-tip="${pEsc(f3.nome)} · ${pEsc(f3.regiao)}<br><b>${f3.n}</b> artes" onmousemove="pChartTip(event)" onclick="pSetGeoRegiao('${f3.regiao}')">
          <span class="p-geo-mini-rank">3º</span>
          <span class="p-geo-mini-avatar bronze" style="position:relative; overflow:hidden; border:1px solid #9A3412;">
            <img src="https://assets.codante.io/codante-apis/bandeiras-dos-estados/${f3.uf.toLowerCase()}-square-rounded.svg" alt="${pEsc(f3.uf)}" style="width:100%; height:100%; object-fit:cover;" />
          </span>
          <span class="p-geo-mini-meta">
            <span class="p-geo-mini-name">${pEsc(f3.nome)}</span>
            <span class="p-geo-mini-sub"><b>${pFmtNum(f3.n)}</b> artes</span>
          </span>
        </button>
      </div>`
  }

  var filtered = ranking;
  if(pState.geoSearch){
    var q = pState.geoSearch.toLowerCase().trim();
    filtered = filtered.filter(function(e){
      return e.nome.toLowerCase().includes(q) || e.uf.toLowerCase().includes(q);
    });
  }

  if(!filtered.length){
    var emptyDisclaimer = regiao === 'all'
      ? `Top 10 estados · ${pFmtNum(ranking.length)} estados com atividade`
      : `Estados · ${pEsc(regiao)} · ${pFmtNum(totalReg)} arte${totalReg === 1 ? '' : 's'} (${Math.round(totalReg / totalAll * 100)}% do total)`;

    return `${controlsHtml}
    <div class="p-geo-tab-card">
      <div class="p-geo-summary-grid">${summaryHtml}</div>
      <div class="p-empty" style="margin-top:14px">
        <div class="p-empty-ico">
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </div>
        <div class="p-empty-title">Nenhum resultado</div>
        <div class="p-empty-text">Nao encontramos estados correspondentes a sua busca.</div>
        <button class="p-empty-cta" onclick="pClearGeoSearch()">Limpar busca</button>
      </div>
    </div>
    <div class="p-geo-disclaimer">${emptyDisclaimer}</div>`;
  }

  var totalRows = filtered.slice(0, 10);
  var rows = totalRows.map(function(e, i){
    var meta = P_GEO_METAS[e.uf] || 0.5;
    var adocao = Math.min(100, Math.round((e.n / (totalAll * meta * 0.22 || 1)) * 100));
    var fillCol = 'var(--p-accent)';
    if(adocao >= 80) fillCol = '#22C55E';
    else if(adocao >= 50) fillCol = '#F59E0B';
    else fillCol = '#EF4444';
    var isSC = e.uf === 'SC';
    var pin = isSC ? `<span class="p-geo-sc-pin" title="Sede DM · Florianopolis"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-left:4px;color:var(--p-accent);"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></span>` : '';
    var posHtml = '';
    if(i === 0 && !pState.geoSearch) posHtml = `<span class="p-fr-badge-medal gold">1º</span>`;
    else if(i === 1 && !pState.geoSearch) posHtml = `<span class="p-fr-badge-medal silver">2º</span>`;
    else if(i === 2 && !pState.geoSearch) posHtml = `<span class="p-fr-badge-medal bronze">3º</span>`;
    else posHtml = `<span class="p-geo-pos">${i + 1}</span>`;

    return `<tr class="p-row ${isSC ? 'p-geo-sc' : ''}" style="animation-delay:${120 + (i * 28)}ms" data-tip="${pEsc(e.nome)} · ${pEsc(e.uf)}<br><b>${pFmtNum(e.n)}</b> artes · ${adocao}% da meta" onmousemove="pChartTip(event)">
      <td style="text-align:center;">${posHtml}</td>
      <td>
        <div class="p-geo-state-row">
          <img src="https://assets.codante.io/codante-apis/bandeiras-dos-estados/${e.uf.toLowerCase()}-rounded.svg" alt="${pEsc(e.uf)}" style="width:24px; height:16px; object-fit:cover; border-radius:4px; border:1px solid var(--p-border-2); flex-shrink:0;" />
          <span class="p-geo-uf-badge">${pEsc(e.uf)}</span>
          <div class="p-geo-state-names">
            <span class="p-geo-state-name">${pEsc(e.nome)}${pin}</span>
            <span class="p-geo-state-reg">${pEsc(e.regiao)}</span>
          </div>
        </div>
      </td>
      <td class="num" style="font-weight:700; color:var(--p-text);">${pFmtNum(e.n)} <span style="font-size:10.5px;font-weight:500;color:var(--p-text-mut)">(${Math.round(e.n / totalAll * 100)}%)</span></td>
      <td>
        <span class="p-geo-barwrap">
          <span class="p-geo-bartrack"><span class="p-geo-barfill" style="width:0; background:${fillCol}" data-grow="${adocao}%"></span></span>
          <span class="p-geo-pct">${adocao}% da meta</span>
        </span>
      </td>
    </tr>`;
  }).join('');

  var foot = regiao === 'all'
    ? `Top 10 estados · ${pFmtNum(ranking.length)} estados com atividade`
    : `Estados · ${pEsc(regiao)} · ${pFmtNum(totalReg)} arte${totalReg === 1 ? '' : 's'} (${Math.round(totalReg / totalAll * 100)}% do total)`;

  return `${controlsHtml}
  <div class="p-geo-tab-card">
    <div class="p-geo-summary-grid">${summaryHtml}</div>
    ${podiumHtml}
    <div class="p-table-wrap p-geo-tab-wrap">
      <table class="p-table">
        <thead><tr>
          <th style="text-align:center; width:60px;">#</th>
          <th>Estado</th>
          <th class="num">Artes (%)</th>
          <th>Adoção da Campanha</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>
  <div class="p-geo-disclaimer">${foot}</div>`;
}

function pSetGeoRegiao(r){
  if(r !== 'all' && !P_REGIOES[r]) r = 'all';
  pState.geoRegiao = (pState.geoRegiao === r) ? 'all' : r;
  pRender();
}

function pSearchGeo(val){
  pState.geoSearch = val;
  pRender();
}

function pClearGeoSearch(){
  pState.geoSearch = '';
  pRender();
}

function pGeoNoteSearchShortcut(ev){
  var tag = (ev.target && ev.target.tagName) ? ev.target.tagName.toLowerCase() : '';
  if(tag === 'input' || tag === 'textarea' || (ev.target && ev.target.isContentEditable)) return;
  if((ev.key === '/' || ev.key === 'k') && !ev.metaKey && !ev.ctrlKey && !ev.altKey){
    var input = document.querySelector('#view-dados .p-geo-search input');
    if(input){
      ev.preventDefault();
      input.focus();
      input.select();
    }
  }
}

window.pSearchGeo = pSearchGeo;
window.pClearGeoSearch = pClearGeoSearch;
window.pSetGeoRegiao = pSetGeoRegiao;

if(typeof window !== 'undefined'){
  window.addEventListener('keydown', function(ev){
    if(pState && pState.visao === 'geo') pGeoNoteSearchShortcut(ev);
  });
}
