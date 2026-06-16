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

  const head = `
    <div class="p-head">
      <div>
        <div class="p-head-title">Ranking de franqueados</div>
        <div class="p-head-sub">Quem mais gera artes · últimos ${pPeriodDays(periodo)} dias</div>
      </div>
      <div class="p-pills">${pPeriodPills()}</div>
    </div>`;

  const stats = pFranqStats(periodo);
  const ativos = stats.filter(s => s.artes > 0);

  if(!ativos.length){
    return head + pEmpty('👥', 'Sem franqueados',
      'Nenhuma arte no período.', 'Ir para Franqueado', 'franqueado');
  }

  const ordenado = pFranqOrdenar(stats);
  const sort = pState.franqSort || { col:'artes', dir:'desc' };

  const totalArtes = stats.reduce((s, x) => s + x.artes, 0);
  const media = ativos.length ? Math.round(totalArtes / ativos.length * 10) / 10 : 0;
  const mediaTxt = media.toString().replace('.', ',');

  const rows = ordenado.map(pFranqRow).join('');

  return head + `
    <div class="p-table-wrap">
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
    <div class="p-fr-foot">${pFmtNum(ativos.length)} franqueado${ativos.length === 1 ? '' : 's'} · Média de ${mediaTxt} artes por franqueado</div>`;
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

  const badge = pFranqBadge(s.status);

  return `<tr class="p-row">
    <td class="num"><span class="p-fr-pos">${s.pos}</span>${delta}</td>
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
        <span class="p-fr-taxa-track"><span class="p-fr-taxa-fill" data-grow="${taxa}%" style="width:0"></span></span>
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
    top:    { cls:'top',    ico:'🔥', txt:'Top' },
    ativo:  { cls:'ativo',  ico:'✓',  txt:'Ativo' },
    inativo:{ cls:'inativo',ico:'⚠',  txt:'Inativo' },
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
