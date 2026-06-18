/**
 * js/dados/geo.js
 *
 * Módulo 3 — Seção 8 · Distribuição geográfica (5 regiões + ranking de estados).
 * Duas colunas: mapa ABSTRATO das regiões do Brasil em SVG inline (formas
 * arredondadas posicionadas como o país, coloridas por intensidade de volume) e
 * tabela com o ranking dos top 10 estados. Filtro por região (pills) cabeado em
 * pSetGeoRegiao. Sem período (mock fixo da rede DM). SVG/HTML puro, sem deps.
 * Funciona nos temas claro e escuro (tokens CSS do escopo #view-dados).
 *
 * Globais de domínio em state.js: P_REGIOES, P_UF_NOME, P_MOCK_GEO,
 * pGeoUFRegiao(uf), pGeoTotal(regiao), pGeoRanking(regiao), pGeoPorRegiao().
 *
 * Funções globais (prefixo p*, viram window.pX p/ o roteador/handlers):
 *   pRenderGeo() — render principal (retorna HTML).
 *   pSetGeoRegiao(r) — handler dos pills/mapa (muta pState.geoRegiao → pRender).
 */

/* ordem de exibição das regiões (pills) */
var P_GEO_ORDEM = ['Sul', 'Sudeste', 'Centro-Oeste', 'Nordeste', 'Norte'];

/* formas abstratas (retângulos arredondados) posicionadas como o Brasil.
   viewBox 0 0 300 320. Norte (maior) topo-esquerda; Nordeste topo-direita;
   Centro-Oeste centro; Sudeste embaixo-direita; Sul na base. */
var P_GEO_FORMAS = {
  'Norte':        { x: 18,  y: 24,  w: 150, h: 108, lx: 93,  ly: 78  },
  'Nordeste':     { x: 178, y: 30,  w: 104, h: 124, lx: 230, ly: 92  },
  'Centro-Oeste': { x: 78,  y: 142, w: 116, h: 84,  lx: 136, ly: 184 },
  'Sudeste':      { x: 168, y: 168, w: 110, h: 78,  lx: 223, ly: 207 },
  'Sul':          { x: 96,  y: 236, w: 104, h: 64,  lx: 148, ly: 268 },
};

/* cor de uma região conforme intensidade relativa ao máximo (escala laranja).
   sem dado → trilha; 0–.30→.18; .30–.55→.4; .55–.80→.7; topo→accent sólido. */
function pGeoCor(n, max){
  if(!n || n <= 0) return 'var(--p-track)';
  var r = max ? n / max : 0;
  if(r >= 0.92) return 'var(--p-accent)';
  if(r >= 0.55) return 'rgba(255,144,0,.7)';
  if(r >= 0.30) return 'rgba(255,144,0,.4)';
  return 'rgba(255,144,0,.18)';
}

function pRenderGeo(){
  var regiao = pState.geoRegiao || 'all';
  if(regiao !== 'all' && !P_REGIOES[regiao]) regiao = 'all';

  var head = `
    <div class="p-head">
      <div>
        <div class="p-head-title">Distribuição geográfica</div>
        <div class="p-head-sub">Onde a rede gera artes · ${pFmtNum(pGeoTotal('all'))} artes em ${Object.keys(P_MOCK_GEO).length} estados</div>
      </div>
    </div>`;

  var ranking = pGeoRanking(regiao);
  if(!ranking.length){
    return head + pGeoFiltros(regiao) + pEmpty('<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon><line x1="9" y1="3" x2="9" y2="18"></line><line x1="15" y1="6" x2="15" y2="21"></line></svg>', 'Sem dados na região',
      'Nenhuma arte registrada nos estados desta região. Selecione "Todas" acima.');
  }

  return head + pGeoFiltros(regiao) + `
    <div class="p-geo-cols">
      ${pGeoMapa(regiao)}
      ${pGeoTabela(regiao, ranking)}
    </div>`;
}

/* ── pills de região: "Todas" + 5 regiões ── */
function pGeoFiltros(regiao){
  var porReg = pGeoPorRegiao();
  var todas = `<button class="p-geo-pill ${regiao === 'all' ? 'active' : ''}" onclick="pSetGeoRegiao('all')">Todas</button>`;
  var pills = P_GEO_ORDEM.map(function(r){
    var n = porReg[r] || 0;
    return `<button class="p-geo-pill ${regiao === r ? 'active' : ''}" onclick="pSetGeoRegiao('${r}')">` +
      `${pEsc(r)}<span class="p-geo-pill-n">${pFmtNum(n)}</span></button>`;
  }).join('');
  return `<div class="p-geo-filtros">${todas}${pills}</div>`;
}

/* ── ESQUERDA: mapa abstrato em SVG (5 regiões coloridas por volume) ── */
function pGeoMapa(regiao){
  var porReg = pGeoPorRegiao();
  var max = Object.keys(porReg).reduce(function(mx, r){ return Math.max(mx, porReg[r]); }, 0);

  var formas = Object.keys(P_GEO_FORMAS).map(function(r){
    var f = P_GEO_FORMAS[r];
    var n = porReg[r] || 0;
    var sel = (regiao === r);
    var cor = pGeoCor(n, max);
    var alta = (n && max && n / max >= 0.55);                 // texto escuro sobre fill forte
    var tip = pEsc(r) + ' · <b>' + pFmtNum(n) + '</b> arte' + (n === 1 ? '' : 's');
    return `<g class="p-geo-shape ${sel ? 'sel' : ''}" onclick="pSetGeoRegiao('${r}')"
        data-tip="${tip}" onmousemove="pChartTip(event)">
      <rect class="p-geo-rect" x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="14" style="fill:${cor}"></rect>
      <text class="p-geo-rlbl ${alta ? 'on' : ''}" x="${f.lx}" y="${f.ly}" text-anchor="middle">${pEsc(r)}</text>
      <text class="p-geo-rn ${alta ? 'on' : ''}" x="${f.lx}" y="${f.ly + 17}" text-anchor="middle">${pFmtNum(n)}</text>
    </g>`;
  }).join('');

  return `<div class="p-geo-mapa-card" onmouseleave="pHideTip()">
    <div class="p-geo-mapa-cap">Volume por região</div>
    <svg class="p-geo-svg" viewBox="0 0 300 320" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Mapa abstrato das regiões do Brasil por volume de artes">
      ${formas}
    </svg>
    <div class="p-geo-escala">
      <span class="p-geo-esc-cap">Menos</span>
      <span class="p-geo-esc-sw" style="background:var(--p-track)"></span>
      <span class="p-geo-esc-sw" style="background:rgba(255,144,0,.18)"></span>
      <span class="p-geo-esc-sw" style="background:rgba(255,144,0,.4)"></span>
      <span class="p-geo-esc-sw" style="background:rgba(255,144,0,.7)"></span>
      <span class="p-geo-esc-sw" style="background:var(--p-accent)"></span>
      <span class="p-geo-esc-cap">Mais</span>
    </div>
  </div>`;
}

/* ── DIREITA: tabela ranking dos top 10 estados da região ── */
function pGeoTabela(regiao, ranking){
  pState.geoSearch = pState.geoSearch || '';
  var totalGeral = pGeoTotal('all') || 1;
  var cap = regiao === 'all' ? 'Top 10 estados' : 'Estados · ' + pEsc(regiao);
  
  // Controls bar
  var controlsHtml = `
    <div class="p-franq-controls" style="margin-bottom: 12px; padding: 6px 10px;">
      <div class="p-search-wrap" style="max-width: 100%;">
        <svg class="p-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" class="p-input-search" placeholder="Buscar estado por nome ou UF..." value="${pEsc(pState.geoSearch)}" oninput="pSearchGeo(this.value)">
      </div>
    </div>`;

  // Lógica de Pódio (layout horizontal compacto)
  var mostrarPodio = !pState.geoSearch && ranking.filter(e => e.n > 0).length >= 3;
  var podiumHtml = '';
  if(mostrarPodio){
    var f1 = ranking[0], f2 = ranking[1], f3 = ranking[2];
    podiumHtml = `
    <div class="p-podium-row p-geo-podium" style="margin-bottom:14px">
      <!-- 2º Lugar -->
      <div class="p-podium-card silver" data-tip="${pEsc(f2.nome)} · ${pEsc(f2.regiao)}<br><b>${f2.n}</b> artes" onmousemove="pChartTip(event)">
        <div class="p-podium-badge">2º</div>
        <div class="p-podium-avatar-wrap">
          <span class="p-podium-avatar" style="background:#475569">${pEsc(f2.uf)}</span>
        </div>
        <div class="p-podium-info">
          <div class="p-podium-name">${pEsc(f2.nome)}</div>
          <div class="p-podium-artes"><b>${f2.n}</b> artes</div>
          <div class="p-podium-camps">${pEsc(f2.regiao)}</div>
        </div>
      </div>
      
      <!-- 1º Lugar -->
      <div class="p-podium-card gold" data-tip="${pEsc(f1.nome)} · ${pEsc(f1.regiao)}<br><b>${f1.n}</b> artes" onmousemove="pChartTip(event)">
        <div class="p-podium-crown">👑</div>
        <div class="p-podium-badge">1º</div>
        <div class="p-podium-avatar-wrap">
          <span class="p-podium-avatar" style="background:var(--p-accent)">${pEsc(f1.uf)}</span>
        </div>
        <div class="p-podium-info">
          <div class="p-podium-name">${pEsc(f1.nome)}</div>
          <div class="p-podium-artes"><b>${f1.n}</b> artes</div>
          <div class="p-podium-camps">${pEsc(f1.regiao)}</div>
        </div>
      </div>
      
      <!-- 3º Lugar -->
      <div class="p-podium-card bronze" data-tip="${pEsc(f3.nome)} · ${pEsc(f3.regiao)}<br><b>${f3.n}</b> artes" onmousemove="pChartTip(event)">
        <div class="p-podium-badge">3º</div>
        <div class="p-podium-avatar-wrap">
          <span class="p-podium-avatar" style="background:#9A3412">${pEsc(f3.uf)}</span>
        </div>
        <div class="p-podium-info">
          <div class="p-podium-name">${pEsc(f3.nome)}</div>
          <div class="p-podium-artes"><b>${f3.n}</b> artes</div>
          <div class="p-podium-camps">${pEsc(f3.regiao)}</div>
        </div>
      </div>
    </div>`;
  }

  // Filtragem local
  var filtered = ranking;
  if(pState.geoSearch){
    var q = pState.geoSearch.toLowerCase().trim();
    filtered = filtered.filter(function(e){
      return e.nome.toLowerCase().includes(q) || e.uf.toLowerCase().includes(q);
    });
  }

  // Se busca der vazia
  if(!filtered.length){
    return `<div class="p-geo-tab-card">
      <div class="p-geo-tab-cap">${cap}</div>
      ${controlsHtml}
      <div class="p-empty" style="margin-top:14px">
        <div class="p-empty-ico">
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </div>
        <div class="p-empty-title">Nenhum resultado</div>
        <div class="p-empty-text">Não encontramos estados correspondentes à sua busca.</div>
        <button class="p-empty-cta" onclick="pClearGeoSearch()">Limpar busca</button>
      </div>
    </div>`;
  }

  var top = filtered.slice(0, 10);
  var rows = top.map(function(e, i){
    var meta = P_GEO_METAS[e.uf] || 0.5;
    // Calculation relative to regional campaign meta
    var adocao = Math.min(100, Math.round((e.n / (totalGeral * meta * 0.22 || 1)) * 100));
    var w = adocao;
    var isSC = (e.uf === 'SC');
    var pin = isSC ? `<span class="p-geo-sc-pin" title="Sede DM · Florianópolis"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-left:4px;color:var(--p-accent);"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></span>` : '';

    // Metal medals or simple numbers aligned centered
    var posHtml = '';
    if (i === 0 && !pState.geoSearch) posHtml = `<span class="p-fr-badge-medal gold">1º</span>`;
    else if (i === 1 && !pState.geoSearch) posHtml = `<span class="p-fr-badge-medal silver">2º</span>`;
    else if (i === 2 && !pState.geoSearch) posHtml = `<span class="p-fr-badge-medal bronze">3º</span>`;
    else posHtml = `<span class="p-geo-pos">${i + 1}</span>`;

    // Dynamic performance-based colors for progress bar fills
    var fillCol = 'var(--p-accent)';
    if (adocao >= 80) fillCol = '#22C55E';
    else if (adocao >= 50) fillCol = '#F59E0B';
    else fillCol = '#EF4444';

    return `<tr class="p-row ${isSC ? 'p-geo-sc' : ''}">
      <td style="text-align:center;">${posHtml}</td>
      <td>
        <div class="p-geo-state-row">
          <span class="p-geo-uf-badge">${pEsc(e.uf)}</span>
          <div class="p-geo-state-names">
            <span class="p-geo-state-name">${pEsc(e.nome)}${pin}</span>
            <span class="p-geo-state-reg">${pEsc(e.regiao)}</span>
          </div>
        </div>
      </td>
      <td class="num" style="font-weight:700; color:var(--p-text);">${pFmtNum(e.n)} <span style="font-size:10.5px;font-weight:500;color:var(--p-text-mut)">(${Math.round(e.n/totalGeral*100)}%)</span></td>
      <td>
        <span class="p-geo-barwrap">
          <span class="p-geo-bartrack"><span class="p-geo-barfill" style="width:0; background:${fillCol}" data-grow="${w}%"></span></span>
          <span class="p-geo-pct">${adocao}% da meta</span>
        </span>
      </td>
    </tr>`;
  }).join('');

  var totReg = pGeoTotal(regiao);
  var foot = regiao === 'all'
    ? `${pFmtNum(ranking.length)} estados com atividade`
    : `${pEsc(regiao)} · ${pFmtNum(totReg)} arte${totReg === 1 ? '' : 's'} (${Math.round(totReg / totalGeral * 100)}% do total)`;

  return `<div class="p-geo-tab-card">
    <div class="p-geo-tab-cap">${cap}</div>
    ${controlsHtml}
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
    <div class="p-geo-foot">${foot}</div>
  </div>`;
}

/* clique numa região (pill ou forma do mapa): alterna 'r' ↔ 'all' e re-renderiza */
function pSetGeoRegiao(r){
  if(r !== 'all' && !P_REGIOES[r]) r = 'all';
  pState.geoRegiao = (pState.geoRegiao === r) ? 'all' : r;
  pRender();
}

// Manipuladores globais
function pSearchGeo(val){
  pState.geoSearch = val;
  pRender();
}
function pClearGeoSearch(){
  pState.geoSearch = '';
  pRender();
}
window.pSearchGeo = pSearchGeo;
window.pClearGeoSearch = pClearGeoSearch;
window.pSetGeoRegiao = pSetGeoRegiao;
