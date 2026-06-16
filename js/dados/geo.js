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
    return head + pGeoFiltros(regiao) + pEmpty('🗺️', 'Sem dados na região',
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
  var totalGeral = pGeoTotal('all') || 1;
  var top = ranking.slice(0, 10);
  var maxN = top.length ? top[0].n : 1;

  var rows = top.map(function(e, i){
    var pct = e.n / totalGeral * 100;
    var w = Math.round(e.n / maxN * 100);
    var isSC = (e.uf === 'SC');
    var pin = isSC ? `<span class="p-geo-sc-pin" title="Sede DM · Florianópolis">📍</span>` : '';
    return `<tr class="p-row ${isSC ? 'p-geo-sc' : ''}">
      <td class="num"><span class="p-geo-pos">${i + 1}</span></td>
      <td>
        <span class="p-geo-uf-cell">
          <span class="p-geo-uf">${pEsc(e.uf)}</span>
          <span class="p-geo-uf-nome">${pEsc(e.nome)}${pin}</span>
          <span class="p-geo-uf-reg">${pEsc(e.regiao)}</span>
        </span>
      </td>
      <td class="num">${pFmtNum(e.n)}</td>
      <td>
        <span class="p-geo-barwrap">
          <span class="p-geo-bartrack"><span class="p-geo-barfill" data-grow="${w}%" style="width:0"></span></span>
          <span class="p-geo-pct">${pFmtPct(pct)}</span>
        </span>
      </td>
    </tr>`;
  }).join('');

  var cap = regiao === 'all' ? 'Top 10 estados' : 'Estados · ' + pEsc(regiao);
  var totReg = pGeoTotal(regiao);
  var foot = regiao === 'all'
    ? `${pFmtNum(ranking.length)} estados com atividade`
    : `${pEsc(regiao)} · ${pFmtNum(totReg)} arte${totReg === 1 ? '' : 's'} (${pFmtPct(totReg / totalGeral * 100)} do total)`;

  return `<div class="p-geo-tab-card">
    <div class="p-geo-tab-cap">${cap}</div>
    <div class="p-table-wrap p-geo-tab-wrap">
      <table class="p-table">
        <thead><tr>
          <th class="num">#</th>
          <th>Estado</th>
          <th class="num">Artes</th>
          <th>% do total</th>
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
