/**
 * js/dados/franqueados.js
 *
 * Módulo 3 — Seção 4: Ranking de franqueados.
 * Tabela ordenável (reusa .p-table do módulo p/ tema claro+escuro) derivada de
 * pFranqStats(periodo) [definido em state.js]. SVG/HTML puro, sem dependências.
 *
 * Funções globais (prefixo p*, viram window.pX p/ o roteador):
 *   pRenderFranqueados() — render principal (retorna HTML).
 *   pSortFranqueados(col) — handler de ordenação (muta pState.franqSort → pRender).
 *   pFranqAvatar(nome) — {cor, iniciais} determinístico p/ o avatar circular.
 */

function pRenderFranqueados(){
  const periodo = pState.periodo;
  
  // Garantir estados locais de busca e filtro
  pState.franqSearch = pState.franqSearch || '';
  pState.franqFiltroStatus = pState.franqFiltroStatus || 'all';

  const head = `
    <div class="p-head">
      <div>
        <div class="p-head-title">Ranking de franqueados</div>
        <div class="p-head-sub">Quem mais gera artes · últimos ${pPeriodDays(periodo)} dias</div>
      </div>
      <div class="p-pills">${pPeriodPills()}</div>
    </div>`;

  const stats = pFranqStats(periodo);
  
  // Lista de franqueados ativos no período geral
  const ativosGerais = stats.filter(s => s.artes > 0);
  const topOverall = stats.slice().sort((a, b) => a.pos - b.pos).filter(s => s.artes > 0);

  // Lógica de Pódio
  const mostrarPodio = !pState.franqSearch && pState.franqFiltroStatus !== 'inativo' && topOverall.length >= 3;
  let podiumHtml = '';
  if(mostrarPodio){
    const f1 = topOverall[0], f2 = topOverall[1], f3 = topOverall[2];
    const av1 = pFranqAvatar(f1.nome), av2 = pFranqAvatar(f2.nome), av3 = pFranqAvatar(f3.nome);
    podiumHtml = `
    <div class="p-podium-row">
      <!-- 2º Lugar -->
      <div class="p-podium-card silver" data-tip="${pEsc(f2.nome)}<br><b>${f2.artes}</b> artes · ${f2.camps} campanhas" onmousemove="pChartTip(event)">
        <div class="p-podium-badge">2º</div>
        <div class="p-podium-avatar-wrap">
          <span class="p-podium-avatar" style="background:${av2.cor}; border-color:#94A3B8">${pEsc(av2.iniciais)}</span>
        </div>
        <div class="p-podium-name">${pEsc(f2.nome)}</div>
        <div class="p-podium-artes"><b>${f2.artes}</b> artes</div>
        <div class="p-podium-camps">${f2.camps} campanhas</div>
      </div>
      
      <!-- 1º Lugar -->
      <div class="p-podium-card gold" data-tip="${pEsc(f1.nome)}<br><b>${f1.artes}</b> artes · ${f1.camps} campanhas" onmousemove="pChartTip(event)">
        <div class="p-podium-crown">👑</div>
        <div class="p-podium-badge">1º</div>
        <div class="p-podium-avatar-wrap">
          <span class="p-podium-avatar" style="background:${av1.cor}; border-color:#F59E0B">${pEsc(av1.iniciais)}</span>
        </div>
        <div class="p-podium-name">${pEsc(f1.nome)}</div>
        <div class="p-podium-artes"><b>${f1.artes}</b> artes</div>
        <div class="p-podium-camps">${f1.camps} campanhas</div>
      </div>
      
      <!-- 3º Lugar -->
      <div class="p-podium-card bronze" data-tip="${pEsc(f3.nome)}<br><b>${f3.artes}</b> artes · ${f3.camps} campanhas" onmousemove="pChartTip(event)">
        <div class="p-podium-badge">3º</div>
        <div class="p-podium-avatar-wrap">
          <span class="p-podium-avatar" style="background:${av3.cor}; border-color:#B45309">${pEsc(av3.iniciais)}</span>
        </div>
        <div class="p-podium-name">${pEsc(f3.nome)}</div>
        <div class="p-podium-artes"><b>${f3.artes}</b> artes</div>
        <div class="p-podium-camps">${f3.camps} campanhas</div>
      </div>
    </div>`;
  }

  // Filtragem local
  let filtered = stats.slice();
  if(pState.franqSearch){
    const q = pState.franqSearch.toLowerCase().trim();
    filtered = filtered.filter(s => s.nome.toLowerCase().includes(q));
  }
  if(pState.franqFiltroStatus !== 'all'){
    filtered = filtered.filter(s => s.status === pState.franqFiltroStatus);
  }

  // Se não sobrar ninguém após os filtros
  if(!filtered.length){
    const controlsHtml = pRenderControls();
    const customEmpty = `
      <div class="p-empty">
        <div class="p-empty-ico">
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </div>
        <div class="p-empty-title">Nenhum resultado</div>
        <div class="p-empty-text">Não encontramos franqueados correspondentes à busca ou ao filtro selecionado.</div>
        <button class="p-empty-cta" onclick="pClearFranqFilters()">Limpar filtros</button>
      </div>`;
    return head + controlsHtml + customEmpty;
  }

  const ordenado = pFranqOrdenar(filtered);
  const sort = pState.franqSort || { col:'artes', dir:'desc' };

  const totalArtes = stats.reduce((s, x) => s + x.artes, 0);
  const media = ativosGerais.length ? Math.round(totalArtes / ativosGerais.length * 10) / 10 : 0;
  const mediaTxt = media.toString().replace('.', ',');

  const rows = ordenado.map(pFranqRow).join('');
  const controlsHtml = pRenderControls();

  return head + controlsHtml + podiumHtml + `
    <div class="p-table-wrap" style="margin-top:14px">
      <table class="p-table">
        <thead><tr>
          ${pFranqTH('pos',   'Posição',         sort, 'num')}
          ${pFranqTH('nome',  'Franqueado',      sort, '')}
          ${pFranqTH('artes', 'Artes',           sort, 'num')}
          ${pFranqTH('camps', 'Campanhas',       sort, 'num')}
          ${pFranqTH('taxa',  'Taxa download',   sort, '')}
          ${pFranqTH('lastTs','Último acesso',   sort, '')}
          ${pFranqTH('status','Status',          sort, '')}
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="p-fr-foot">${pFmtNum(ativosGerais.length)} franqueado${ativosGerais.length === 1 ? '' : 's'} ativos · Média de ${mediaTxt} artes por franqueado</div>`;
}

function pRenderControls() {
  return `
    <div class="p-franq-controls">
      <div class="p-search-wrap">
        <svg class="p-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" class="p-input-search" placeholder="Buscar franqueado por nome..." value="${pEsc(pState.franqSearch)}" oninput="pSearchFranq(this.value)">
      </div>
      <div class="p-status-filters">
        <button class="p-pill ${pState.franqFiltroStatus === 'all' ? 'active' : ''}" onclick="pSetFranqFiltro('all')">Todos</button>
        <button class="p-pill ${pState.franqFiltroStatus === 'top' ? 'active' : ''}" onclick="pSetFranqFiltro('top')">Top</button>
        <button class="p-pill ${pState.franqFiltroStatus === 'ativo' ? 'active' : ''}" onclick="pSetFranqFiltro('ativo')">Ativos</button>
        <button class="p-pill ${pState.franqFiltroStatus === 'inativo' ? 'active' : ''}" onclick="pSetFranqFiltro('inativo')">Inativos</button>
      </div>
    </div>`;
}

/* cabeçalho de coluna ordenável (reusa .p-table thead / .p-sort-arrow / .active-sort) */
function pFranqTH(col, label, sort, extra){
  const active = sort.col === col;
  const arrow = active ? (sort.dir === 'asc' ? '▲' : '▼') : '';
  const cls = (extra ? extra + ' ' : '') + (active ? 'active-sort' : '');
  return `<th class="${cls.trim()}" onclick="pSortFranqueados('${col}')">${pEsc(label)}<span class="p-sort-arrow">${arrow}</span></th>`;
}

/* linha da tabela */
function pFranqRow(s){
  const av = pFranqAvatar(s.nome);
  const taxa = Math.round(s.taxa);
  const taxaTxt = pFmtPct(s.taxa);

  // delta de posição: ↑N (subiu, verde) / ↓N (caiu, vermelho) / — (neutro)
  let delta;
  if(s.posDelta > 0)      delta = `<span class="p-fr-delta up">↑${s.posDelta}</span>`;
  else if(s.posDelta < 0) delta = `<span class="p-fr-delta down">↓${Math.abs(s.posDelta)}</span>`;
  else                    delta = `<span class="p-fr-delta flat">—</span>`;

  // Medalha ou Posição simples
  let posHtml = '';
  if (s.pos === 1) posHtml = `<span class="p-fr-badge-medal gold">1º</span>`;
  else if (s.pos === 2) posHtml = `<span class="p-fr-badge-medal silver">2º</span>`;
  else if (s.pos === 3) posHtml = `<span class="p-fr-badge-medal bronze">3º</span>`;
  else posHtml = `<span class="p-fr-pos">${s.pos}</span>`;

  // Cor de performance da taxa de download
  let fillCol = 'var(--p-accent)';
  if (s.taxa >= 80) fillCol = '#22C55E';
  else if (s.taxa >= 50) fillCol = '#F59E0B';
  else fillCol = '#EF4444';

  const badge = pFranqBadge(s.status);

  return `<tr class="p-row">
    <td class="num">${posHtml}${delta}</td>
    <td>
      <span class="p-fr-who">
        <span class="p-fr-avatar" style="background:${av.cor}">${pEsc(av.iniciais)}</span>
        <span class="p-fr-name">${pEsc(s.nome)}</span>
      </span>
    </td>
    <td class="num">${pFmtNum(s.artes)}</td>
    <td class="num">${pFmtNum(s.camps)}</td>
    <td>
      <span class="p-fr-taxa">
        <span class="p-fr-taxa-track"><span class="p-fr-taxa-fill" style="width:0; background:${fillCol}" data-grow="${taxa}%"></span></span>
        <span class="p-fr-taxa-pct">${taxaTxt}</span>
      </span>
    </td>
    <td><span class="p-fr-last">${pEsc(pHaTempo(s.lastTs))}</span></td>
    <td>${badge}</td>
  </tr>`;
}

/* badge de status: 🔥 Top / ✓ Ativo / ⚠ Inativo */
function pFranqBadge(status){
  const map = {
    top:    { cls:'top',    ico:'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>', txt:'Top' },
    ativo:  { cls:'ativo',  ico:'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="20 6 9 17 4 12"></polyline></svg>',  txt:'Ativo' },
    inativo:{ cls:'inativo',ico:'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',  txt:'Inativo' },
  };
  const b = map[status] || map.ativo;
  return `<span class="p-fr-status ${b.cls}"><span class="p-fr-status-ico">${b.ico}</span>${b.txt}</span>`;
}

/* avatar determinístico (cor por inicial + iniciais do nome) */
function pFranqAvatar(nome){
  const cores = ['#FF9000','#22C55E','#3B82F6','#8B5CF6','#EC4899','#F59E0B'];
  const idx = nome.charCodeAt(0) % cores.length;
  const iniciais = nome.split(' ').slice(0, 2).map(p => p[0]).join('');
  return { cor: cores[idx], iniciais };
}

/* ordenação: aplica pState.franqSort sobre os stats */
function pFranqOrdenar(stats){
  const sort = pState.franqSort || { col:'artes', dir:'desc' };
  const col = sort.col, dir = sort.dir === 'asc' ? 1 : -1;
  const arr = stats.slice();
  arr.sort((a, b) => {
    let va, vb;
    if(col === 'nome'){ va = a.nome.toLowerCase(); vb = b.nome.toLowerCase(); }
    else if(col === 'status'){
      const ordem = { top:3, ativo:2, inativo:1 };
      va = ordem[a.status] || 0; vb = ordem[b.status] || 0;
    } else {
      va = a[col]; vb = b[col];
    }
    if(va < vb) return -1 * dir;
    if(va > vb) return 1 * dir;
    return a.pos - b.pos;             // desempate estável pela posição do ranking
  });
  return arr;
}

/* handler de clique no cabeçalho: alterna dir se mesma coluna; senão default por tipo */
function pSortFranqueados(col){
  const cur = pState.franqSort || { col:'artes', dir:'desc' };
  if(cur.col === col){
    pState.franqSort = { col, dir: cur.dir === 'asc' ? 'desc' : 'asc' };
  } else {
    pState.franqSort = { col, dir: col === 'nome' ? 'asc' : 'desc' };
  }
  pRender();
}

// Eventos de Busca e Filtro
function pSearchFranq(val){
  pState.franqSearch = val;
  pRender();
}
function pSetFranqFiltro(status){
  pState.franqFiltroStatus = status;
  pRender();
}
function pClearFranqFilters(){
  pState.franqSearch = '';
  pState.franqFiltroStatus = 'all';
  pRender();
}

// Registrando globais no window
window.pSearchFranq = pSearchFranq;
window.pSetFranqFiltro = pSetFranqFiltro;
window.pClearFranqFilters = pClearFranqFilters;
