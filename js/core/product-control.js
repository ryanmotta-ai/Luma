/**
 * js/core/product-control.js
 *
 * CONTROLE DO PRODUTO — a tela da Gestão, dentro do painel da conta.
 *
 * Só a interface: ler, buscar, filtrar, confirmar e mandar salvar. Toda a
 * regra (resolução, cascata, cache, sync) vive em core/feature-flags.js — este
 * arquivo não conhece o Supabase e não decide nada sozinho.
 *
 * Mora no MESMO painel de perfil que já existe (#g-profile-modal), como 5ª aba,
 * seguindo o molde de gProfileRenderEquipe: pane vazia no HTML + render por JS.
 * O gate visual é gIsSuperAdmin(); quem autoriza de verdade é a RLS.
 *
 * Depende de: core/feature-flags.js, core/toast.js (gToast/gEsc), core/auth.js.
 */

/* Estado da tela. let global + re-render manual — o padrão da casa. */
let _gProdQuery = '';
let _gProdFiltro = 'todos';
let _gProdFechados = {};     // { chave: true } — nós colapsados pelo usuário
let _gProdConfirmKey = null; // chave com painel de confirmação aberto
let _gProdSalvando = {};     // { chave: true } — trava o switch durante o save

/* ── Ícones (SVG inline, currentColor — nunca emoji) ── */
const _PROD_ICO_SLIDERS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>';
const _PROD_ICO_SEARCH  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>';
const _PROD_ICO_REFRESH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>';
const _PROD_ICO_HISTORY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/><path d="M12 8v5l3 2"/></svg>';
const _PROD_ICO_SHIELD  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v6c0 4.4-3 8.3-7 9-4-.7-7-4.6-7-9V6Z"/></svg>';
const _PROD_ICO_CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
const _PROD_ICO_LINK    = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>';
const _PROD_ICO_EMPTY   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M8.5 11h5"/></svg>';
const _PROD_ICO_OFFLINE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 2l20 20"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5 12.9a10 10 0 0 1 3.4-2.3M2 8.8A15 15 0 0 1 6 6.4M22 8.8a15 15 0 0 0-9.9-2.7"/><path d="M12 20h.01"/></svg>';

const _PROD_FILTROS = [
  { id:'todos',        label:'Todos' },
  { id:'ativos',       label:'Ativos' },
  { id:'desativados',  label:'Desativados' },
  { id:'manutencao',   label:'Em manutenção' },
  { id:'modulos',      label:'Módulos' },
  { id:'ferramentas',  label:'Ferramentas' },
  { id:'chats',        label:'Chats' },
  { id:'importacao',   label:'Importação' },
  { id:'exportacao',   label:'Exportação' }
];

const _PROD_COMPORTAMENTOS = {
  hide:        { label:'Ocultar',                 desc:'Some da interface. Ninguém encontra o caminho.' },
  disabled:    { label:'Mostrar como indisponível', desc:'Continua visível, mas não responde. O clique explica.' },
  readonly:    { label:'Somente leitura',         desc:'Dá para ver o que existe; criar e alterar ficam bloqueados.' },
  maintenance: { label:'Em manutenção',           desc:'Fica reconhecível, com aviso de manutenção e o motivo.' }
};

/* ══════════════════════════════════════════════════════════════
   RENDER PRINCIPAL
══════════════════════════════════════════════════════════════ */

function gProdRender(){
  const pane = document.getElementById('prof-pane-produto');
  if (!pane) return;

  // Gate visual. A RLS é quem recusa a escrita de verdade; isto evita que a
  // tela apareça para quem não tem o que fazer nela.
  if (typeof gIsSuperAdmin === 'function' && !gIsSuperAdmin()) {
    pane.innerHTML = `<div class="gprod-denied">${_PROD_ICO_SHIELD}
      <strong>Área exclusiva da gestão</strong>
      <p>O Controle do produto define o que fica disponível no Luma para toda a rede.</p></div>`;
    return;
  }

  pane.innerHTML = `
    ${_gProdSummaryHTML()}
    <div class="gprod-tools">
      <div class="gprod-search-wrap">
        <span class="gprod-search-ico">${_PROD_ICO_SEARCH}</span>
        <input type="search" class="gprod-search" id="gprod-search" value="${gEsc(_gProdQuery)}"
          placeholder="Buscar por nome, descrição, chave técnica ou tag"
          aria-label="Buscar recursos" aria-describedby="gprod-result-count"
          autocomplete="off" oninput="gProdFilter(this.value)">
      </div>
      <div class="gprod-filters" role="group" aria-label="Filtrar recursos">
        ${_PROD_FILTROS.map(f => `<button type="button" class="gprod-filter${f.id===_gProdFiltro?' is-active':''}"
          data-filter="${f.id}" aria-pressed="${f.id===_gProdFiltro?'true':'false'}"
          onclick="gProdSetFilter('${f.id}')">${f.label}</button>`).join('')}
      </div>
    </div>
    <div id="gprod-tree" class="gprod-tree"></div>
    <p class="gprod-protected">${_PROD_ICO_SHIELD}
      <span><strong>Sempre disponíveis.</strong> ${gEsc(G_FEATURE_PROTEGIDOS.join(' · '))} não podem ser desativados —
      é o que garante que a gestão nunca perde o caminho de volta.</span></p>`;

  gProdRenderTree();

  // Reabrir a tela reconcilia com o servidor (alguém da gestão pode ter mudado
  // algo de outra máquina). Sem polling: só aqui, ao voltar para a aba e após salvar.
  if (typeof gFeatureSyncFromBackend === 'function') {
    gFeatureSyncFromBackend().then(r => {
      if (!document.getElementById('gprod-tree')) return;  // fechou o painel no meio
      _gProdRefreshSummary();
      if (r && r.ok) gProdRenderTree();
    });
  }
}

function _gProdSummaryHTML(){
  const t = gFeatureResolveTree();
  const info = gFeatureSyncInfo();

  // Laranja é reservado a PROBLEMA (offline, erro). Cache e defaults são
  // informação de contexto, não alerta — em laranja competiam com a árvore,
  // que é o conteúdo real da tela.
  let statusCls = 'is-ok', statusTxt;
  if (!info.temBackend) { statusCls = 'is-warn'; statusTxt = 'Sem conexão com o servidor — mostrando a última configuração conhecida'; }
  else if (info.erro)   { statusCls = 'is-warn'; statusTxt = 'Não foi possível sincronizar: ' + info.erro; }
  else if (info.origem === 'backend') statusTxt = 'Sincronizado com o servidor' + (info.syncedAt ? ' ' + _gProdQuando(info.syncedAt) : '');
  else if (info.origem === 'cache')   { statusCls = 'is-info'; statusTxt = 'Configuração local' + (info.syncedAt ? ', sincronizada ' + _gProdQuando(info.syncedAt) : '') + ' — ainda não confirmada nesta sessão'; }
  else { statusCls = 'is-info'; statusTxt = 'Usando a configuração padrão do Luma — nada foi carregado do servidor ainda'; }

  return `
    <section class="gprod-overview">
      <div class="gprod-overview-copy">
        <span class="gprod-overview-icon">${_PROD_ICO_SLIDERS}</span>
        <div>
          <span class="gprod-kicker">Disponibilidade</span>
          <h4>O que está no ar agora</h4>
          <p>Ligue e desligue recursos sem alterar código nem publicar uma nova versão.</p>
        </div>
      </div>
      <div class="gprod-overview-actions">
        <button type="button" class="gprod-btn-ghost" onclick="gProdRefresh(this)">${_PROD_ICO_REFRESH}<span>Atualizar</span></button>
        <button type="button" class="gprod-btn-ghost" onclick="gProdOpenHistory()">${_PROD_ICO_HISTORY}<span>Histórico</span></button>
      </div>
    </section>

    <div class="gprod-metrics" id="gprod-metrics" aria-label="Resumo dos recursos">
      <div class="gprod-metric"><span class="gprod-dot is-on"></span><span><strong>${t.ativos}</strong><small>Ativos</small></span></div>
      <div class="gprod-metric"><span class="gprod-dot is-off"></span><span><strong>${t.desativados}</strong><small>Desativados</small></span></div>
      <div class="gprod-metric"><span class="gprod-dot is-maint"></span><span><strong>${t.manutencao}</strong><small>Em manutenção</small></span></div>
      <div class="gprod-metric"><span class="gprod-dot is-dep"></span><span><strong>${t.porDependencia}</strong><small>Por dependência</small></span></div>
    </div>

    <p class="gprod-sync ${statusCls}" id="gprod-sync" role="status" aria-live="polite">
      ${!info.temBackend || info.erro ? _PROD_ICO_OFFLINE : ''}${gEsc(statusTxt)}
    </p>
    <div id="gprod-history" hidden></div>`;
}

function _gProdRefreshSummary(){
  const pane = document.getElementById('prof-pane-produto');
  if (!pane) return;
  const metrics = document.getElementById('gprod-metrics');
  const sync = document.getElementById('gprod-sync');
  if (!metrics || !sync) return;
  // Substitui só o bloco de números e o status — reconstruir a section inteira
  // roubaria o foco de quem está no campo de busca.
  const tmp = document.createElement('div');
  tmp.innerHTML = _gProdSummaryHTML();
  const novoMetrics = tmp.querySelector('#gprod-metrics');
  const novoSync = tmp.querySelector('#gprod-sync');
  if (novoMetrics) metrics.innerHTML = novoMetrics.innerHTML;
  if (novoSync) { sync.className = novoSync.className; sync.innerHTML = novoSync.innerHTML; }
}

function _gProdQuando(iso){
  try {
    const dif = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (dif < 1) return 'agora';
    if (dif < 60) return 'há ' + dif + ' min';
    const h = Math.floor(dif / 60);
    if (h < 24) return 'há ' + h + 'h';
    return 'em ' + new Date(iso).toLocaleDateString('pt-BR');
  } catch(e) { return ''; }
}

/* ══════════════════════════════════════════════════════════════
   ÁRVORE
══════════════════════════════════════════════════════════════ */

function _gProdCasa(meta){
  const st = gFeatureState(meta.key);
  if (_gProdFiltro === 'ativos' && !st.efetivo) return false;
  if (_gProdFiltro === 'desativados' && (st.efetivo || st.comportamento === 'maintenance')) return false;
  if (_gProdFiltro === 'manutencao' && (st.efetivo || st.comportamento !== 'maintenance')) return false;
  if (['modulos','ferramentas','chats','importacao','exportacao'].indexOf(_gProdFiltro) >= 0
      && meta.categoria !== _gProdFiltro) return false;
  if (!_gProdQuery) return true;
  const alvo = [meta.label, meta.desc, meta.key, meta.categoria, (meta.tags||[]).join(' ')].join(' ').toLowerCase();
  return alvo.indexOf(_gProdQuery) >= 0;
}

function gProdRenderTree(){
  const host = document.getElementById('gprod-tree');
  if (!host) return;

  // Um nó entra se ele casa OU se algum descendente casa (senão o filho
  // encontrado na busca apareceria solto, sem o pai que explica a hierarquia).
  const visiveis = {};
  G_FEATURE_REGISTRY.forEach(f => {
    if (!_gProdCasa(f)) return;
    visiveis[f.key] = true;
    let p = f.parent;
    let guard = 0;
    while (p && guard++ < 12) { visiveis[p] = true; const m = G_FEATURE_REGISTRY.find(x => x.key === p); p = m ? m.parent : null; }
  });

  const total = Object.keys(visiveis).length;
  if (!total) {
    host.innerHTML = `<div class="gprod-empty">${_PROD_ICO_EMPTY}
      <strong>Nenhum recurso encontrado</strong>
      <p>Ajuste a busca ou volte para "Todos".</p>
      <button type="button" class="gprod-btn-ghost" onclick="gProdClearFilters()">Limpar filtros</button></div>`;
    _gProdSetCount(0);
    return;
  }

  const html = G_FEATURE_MODULOS.map(mod => {
    const raiz = G_FEATURE_REGISTRY.filter(f => f.module === mod.id && !f.parent && visiveis[f.key]);
    const orfaos = G_FEATURE_REGISTRY.filter(f => f.module === mod.id && f.parent
      && !G_FEATURE_REGISTRY.some(p => p.key === f.parent) && visiveis[f.key]);
    const nos = raiz.concat(orfaos);
    if (!nos.length) return '';
    const n = G_FEATURE_REGISTRY.filter(f => f.module === mod.id && visiveis[f.key]).length;
    return `<section class="gprod-mod">
      <header class="gprod-mod-head">
        <h5>${gEsc(mod.label)}</h5>
        <span class="gprod-mod-count">${n} recurso${n !== 1 ? 's' : ''}</span>
      </header>
      <ul class="gprod-list">${nos.map(f => _gProdNoHTML(f, 0, visiveis)).join('')}</ul>
    </section>`;
  }).join('');

  host.innerHTML = html;
  _gProdSetCount(total);
  // Reabre a confirmação se o render aconteceu com ela na tela (ex.: busca).
  if (_gProdConfirmKey) _gProdMountConfirm(_gProdConfirmKey);
}

function _gProdSetCount(n){
  const el = document.getElementById('gprod-result-count');
  if (el) el.textContent = n + ' recurso' + (n !== 1 ? 's' : '');
}

function _gProdNoHTML(meta, nivel, visiveis){
  const st = gFeatureState(meta.key);
  const filhos = G_FEATURE_REGISTRY.filter(f => f.parent === meta.key && visiveis[f.key]);
  const fechado = !!_gProdFechados[meta.key];
  const salvando = !!_gProdSalvando[meta.key];

  // Status: nunca só por cor — ponto + rótulo textual, sempre juntos.
  let statusCls = 'is-on', statusTxt = 'Ativo';
  if (st.bloqueadoPor) { statusCls = 'is-dep'; statusTxt = 'Indisponível'; }
  else if (!st.efetivo && st.comportamento === 'maintenance') { statusCls = 'is-maint'; statusTxt = 'Em manutenção'; }
  else if (!st.efetivo) { statusCls = 'is-off'; statusTxt = 'Desativado'; }

  const paiMeta = st.bloqueadoPor ? G_FEATURE_REGISTRY.find(x => x.key === st.bloqueadoPor) : null;

  // Nota contextual: só aparece quando há algo real a explicar.
  let nota = '';
  if (st.bloqueadoPor) {
    nota = `<p class="gprod-note is-dep">${_PROD_ICO_LINK}
      <span>Configurado como <strong>${st.configurado ? 'ativo' : 'desativado'}</strong> ·
      indisponível porque <strong>${gEsc((paiMeta && paiMeta.label) || st.bloqueadoPor)}</strong> está desativado</span>
      <button type="button" class="gprod-note-link" data-key="${gEsc(st.bloqueadoPor)}"
        onclick="gProdFocusKey(this.dataset.key)">Ver recurso</button></p>`;
  } else if (!st.efetivo) {
    // Rótulo explícito: "Ocultar · Grupo em revisão" solto parecia um link e não
    // dizia o que era cada metade. Agora nomeia comportamento e motivo.
    const comp = _PROD_COMPORTAMENTOS[st.comportamento];
    nota = `<p class="gprod-note is-off"><span>Comportamento: <strong>${gEsc(comp ? comp.label : st.comportamento)}</strong>${
      st.motivo ? ' · Motivo: <strong>' + gEsc(st.motivo) + '</strong>' : ''}</span></p>`;
  }

  const overrides = ['franqueado','equipe_dm','gestao']
    .filter(r => typeof st.overrides[r] === 'boolean')
    .map(r => _gProdRoleLabel(r) + ': ' + (st.overrides[r] ? 'ativo' : 'desativado'));
  const ovHTML = overrides.length
    ? `<p class="gprod-note is-ov"><span>Ajuste por permissão — ${gEsc(overrides.join(' · '))}</span></p>` : '';

  const toggleAttrs = st.bloqueadoPor || salvando ? 'aria-disabled="true" tabindex="-1"' : '';
  const descId = 'gprod-d-' + meta.key.replace(/\./g, '-');

  return `<li class="gprod-item lvl-${Math.min(nivel,3)}${!st.efetivo ? ' is-off' : ''}" data-key="${gEsc(meta.key)}">
    <div class="gprod-row">
      ${filhos.length
        ? `<button type="button" class="gprod-caret${fechado ? '' : ' is-open'}" aria-expanded="${fechado ? 'false' : 'true'}"
             aria-label="${fechado ? 'Expandir' : 'Recolher'} ${gEsc(meta.label)}"
             onclick="gProdToggleGroup('${gEsc(meta.key)}')">${_PROD_ICO_CHEVRON}</button>`
        : '<span class="gprod-caret-spacer" aria-hidden="true"></span>'}
      <div class="gprod-copy">
        <span class="gprod-name">${gEsc(meta.label)}</span>
        <span class="gprod-desc" id="${descId}">${gEsc(meta.desc)}</span>
      </div>
      <span class="gprod-status ${statusCls}"><i aria-hidden="true"></i>${statusTxt}</span>
      <button type="button" role="switch" class="gprod-switch${salvando ? ' is-saving' : ''}${st.bloqueadoPor ? ' is-inherited' : ''}"
        aria-checked="${st.configurado ? 'true' : 'false'}" aria-describedby="${descId}"
        aria-label="${gEsc(meta.label)}: ${st.configurado ? 'ativo' : 'desativado'}"
        data-key="${gEsc(meta.key)}" ${toggleAttrs}
        onclick="gProdAskToggle(this.dataset.key)"><i aria-hidden="true"></i></button>
    </div>
    ${nota}${ovHTML}
    <div class="gprod-confirm-slot" id="gprod-slot-${gEsc(meta.key).replace(/\./g,'-')}"></div>
    ${filhos.length && !fechado
      ? `<ul class="gprod-list">${filhos.map(f => _gProdNoHTML(f, nivel + 1, visiveis)).join('')}</ul>` : ''}
  </li>`;
}

function _gProdRoleLabel(r){
  return r === 'gestao' ? 'Gestão' : (r === 'equipe_dm' ? 'Equipe DM' : 'Franqueado');
}

/* ══════════════════════════════════════════════════════════════
   INTERAÇÕES
══════════════════════════════════════════════════════════════ */

function gProdFilter(q){
  _gProdQuery = String(q || '').trim().toLowerCase();
  gProdRenderTree();
}

function gProdSetFilter(f){
  _gProdFiltro = f;
  document.querySelectorAll('.gprod-filter').forEach(b => {
    const on = b.dataset.filter === f;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  gProdRenderTree();
}

function gProdClearFilters(){
  _gProdQuery = '';
  _gProdFiltro = 'todos';
  const s = document.getElementById('gprod-search');
  if (s) s.value = '';
  gProdSetFilter('todos');
}

function gProdToggleGroup(key){
  _gProdFechados[key] = !_gProdFechados[key];
  gProdRenderTree();
}

// Leva o olho até o recurso que está bloqueando (o pai da cascata).
function gProdFocusKey(key){
  gProdClearFilters();
  setTimeout(() => {
    const el = document.querySelector('.gprod-item[data-key="' + key.replace(/"/g,'') + '"]');
    if (!el) return;
    el.scrollIntoView({ block:'center', behavior:'smooth' });
    el.classList.add('is-flash');
    setTimeout(() => el.classList.remove('is-flash'), 1400);
  }, 40);
}

async function gProdRefresh(btn){
  const restore = (typeof gBtnLoading === 'function') ? gBtnLoading(btn, 'Atualizando') : (() => {});
  const r = await gFeatureSyncFromBackend();
  restore();
  _gProdRefreshSummary();
  gProdRenderTree();
  if (typeof gToast === 'function') {
    if (r && r.ok) gToast('Configuração atualizada');
    else gToast('Não foi possível atualizar — ' + ((r && r.error) || 'servidor indisponível'), 'error');
  }
}

/* ── Confirmação: o switch NUNCA grava no clique ─────────────
   Desligar um recurso muda o produto para a rede inteira. O painel diz o que
   acontece, o que continua funcionando e pede um motivo antes de gravar. */
function gProdAskToggle(key){
  const st = gFeatureState(key);
  if (st.bloqueadoPor || _gProdSalvando[key]) return;
  if (_gProdConfirmKey === key) { gProdCancelToggle(); return; }
  _gProdConfirmKey = key;
  document.querySelectorAll('.gprod-confirm-slot').forEach(s => { s.innerHTML = ''; });
  _gProdMountConfirm(key);
}

function _gProdMountConfirm(key){
  const slot = document.getElementById('gprod-slot-' + key.replace(/\./g,'-'));
  if (!slot) return;
  const meta = G_FEATURE_REGISTRY.find(f => f.key === key);
  const st = gFeatureState(key);
  if (!meta) return;

  // Religar é ação segura e reversível: confirma direto, sem formulário.
  if (!st.configurado) {
    slot.innerHTML = `<div class="gprod-confirm" role="group" aria-label="Reativar ${gEsc(meta.label)}">
      <h6>Reativar ${gEsc(meta.label)}?</h6>
      <p>O recurso volta a aparecer e a funcionar normalmente para quem tem acesso.</p>
      ${_gProdFilhosAviso(key, true)}
      <div class="gprod-confirm-actions">
        <button type="button" class="gprod-btn-ghost" onclick="gProdCancelToggle()">Cancelar</button>
        <button type="button" class="gprod-btn-primary" data-key="${gEsc(key)}" onclick="gProdConfirmToggle(this.dataset.key,true)">Reativar recurso</button>
      </div></div>`;
    _gProdFocusConfirm(slot);
    return;
  }

  const behaviors = meta.behaviors || ['hide'];
  const atual = st.comportamento;
  const nomeId = key.replace(/\./g,'-');

  slot.innerHTML = `<div class="gprod-confirm" role="group" aria-label="Desativar ${gEsc(meta.label)}">
    <h6>Desativar ${gEsc(meta.label)}?</h6>
    <ul class="gprod-impact">
      <li class="is-block">O acesso e a criação por qualquer caminho ficam bloqueados — botão, atalho e menu.</li>
      ${(meta.preserva || []).indexOf('render') >= 0
        ? '<li class="is-keep">O conteúdo já criado continua aparecendo, sendo editado e exportado.</li>' : ''}
      <li class="is-keep">Nenhum template é alterado. Nenhum dado é apagado.</li>
    </ul>
    ${_gProdFilhosAviso(key, false)}

    <fieldset class="gprod-fieldset">
      <legend>Comportamento</legend>
      ${behaviors.map((b,i) => {
        const c = _PROD_COMPORTAMENTOS[b] || { label:b, desc:'' };
        const on = (atual === b) || (behaviors.indexOf(atual) < 0 && i === 0);
        return `<label class="gprod-radio">
          <input type="radio" name="gprod-comp-${nomeId}" value="${b}"${on ? ' checked' : ''}>
          <span><strong>${gEsc(c.label)}</strong><small>${gEsc(c.desc)}</small></span></label>`;
      }).join('')}
    </fieldset>

    <div class="gprod-field">
      <label class="gprod-label" for="gprod-motivo-${nomeId}">Motivo <small>(aparece no histórico e para quem tentar usar)</small></label>
      <input class="gprod-input" id="gprod-motivo-${nomeId}" maxlength="120"
        placeholder="Ex.: Em melhorias" value="${gEsc(st.motivo || '')}">
    </div>

    <details class="gprod-advanced">
      <summary>Ajustes por permissão</summary>
      <p class="gprod-advanced-hint">Deixe em "Herdar" para seguir o estado geral. Um ajuste aqui vale só para aquela permissão.</p>
      <div class="gprod-roles">
        ${['franqueado','equipe_dm','gestao'].map(r => `
          <div class="gprod-role">
            <label class="gprod-label" for="gprod-ov-${nomeId}-${r}">${_gProdRoleLabel(r)}</label>
            <select class="gprod-input" id="gprod-ov-${nomeId}-${r}">
              <option value=""${typeof st.overrides[r] !== 'boolean' ? ' selected' : ''}>Herdar</option>
              <option value="true"${st.overrides[r] === true ? ' selected' : ''}>Ativo</option>
              <option value="false"${st.overrides[r] === false ? ' selected' : ''}>Desativado</option>
            </select>
          </div>`).join('')}
      </div>
    </details>

    <div class="gprod-confirm-actions">
      <button type="button" class="gprod-btn-ghost" onclick="gProdCancelToggle()">Cancelar</button>
      <button type="button" class="gprod-btn-danger" data-key="${gEsc(key)}" onclick="gProdConfirmToggle(this.dataset.key,false)">Desativar recurso</button>
    </div></div>`;
  _gProdFocusConfirm(slot);
}

function _gProdFocusConfirm(slot){
  const box = slot.querySelector('.gprod-confirm');
  if (!box) return;
  box.scrollIntoView({ block:'nearest', behavior:'smooth' });
  const first = box.querySelector('input, select, button');
  if (first) setTimeout(() => { try { first.focus(); } catch(e){} }, 60);
}

// Ao desligar um pai, dizer QUANTOS recursos ficam indisponíveis junto — e que
// o estado configurado de cada um é preservado.
function _gProdFilhosAviso(key, reativando){
  const desc = [];
  (function walk(k){
    G_FEATURE_REGISTRY.filter(f => f.parent === k).forEach(f => { desc.push(f); walk(f.key); });
  })(key);
  if (!desc.length) return '';
  const nomes = desc.slice(0, 4).map(f => f.label).join(', ') + (desc.length > 4 ? ` e mais ${desc.length - 4}` : '');
  return reativando
    ? `<p class="gprod-cascade">${desc.length} recurso${desc.length !== 1 ? 's' : ''} dentro dele volta${desc.length !== 1 ? 'm' : ''}
        ao próprio estado anterior: ${gEsc(nomes)}.</p>`
    : `<p class="gprod-cascade">${desc.length} recurso${desc.length !== 1 ? 's' : ''} dentro dele fica${desc.length !== 1 ? 'm' : ''}
        indisponível${desc.length !== 1 ? 'eis' : ''} junto: ${gEsc(nomes)}. A configuração de cada um é preservada e volta ao reativar.</p>`;
}

function gProdCancelToggle(){
  _gProdConfirmKey = null;
  document.querySelectorAll('.gprod-confirm-slot').forEach(s => { s.innerHTML = ''; });
}

async function gProdConfirmToggle(key, ligar){
  const nomeId = key.replace(/\./g,'-');
  const patch = { enabled: !!ligar };

  if (!ligar) {
    const sel = document.querySelector('input[name="gprod-comp-' + nomeId + '"]:checked');
    if (sel) patch.comportamento = sel.value;
    const mot = document.getElementById('gprod-motivo-' + nomeId);
    if (mot) patch.motivo = mot.value.trim();
    const ov = {};
    ['franqueado','equipe_dm','gestao'].forEach(r => {
      const el = document.getElementById('gprod-ov-' + nomeId + '-' + r);
      if (!el) return;
      ov[r] = el.value === '' ? null : (el.value === 'true');
    });
    patch.overrides = ov;
  }

  gProdCancelToggle();
  _gProdSalvando[key] = true;
  gProdRenderTree();

  const r = await gFeatureSave(key, patch);

  delete _gProdSalvando[key];
  // Erro do backend → o estado visual volta sozinho, porque a árvore sempre
  // desenha o estado REAL. Nada de otimismo: "salvo" só aparece se salvou.
  gProdRenderTree();
  _gProdRefreshSummary();

  const meta = G_FEATURE_REGISTRY.find(f => f.key === key);
  const nome = (meta && meta.label) || 'Recurso';
  if (typeof gToast === 'function') {
    if (r.ok) gToast(nome + (ligar ? ' reativado' : ' desativado'));
    else gToast('' + nome + ' não foi alterado — ' + r.error, 'error');
  }
  // Pulso na própria linha: o toast some do canto e o olho está na árvore.
  // Reusa o keyframe do "Ver recurso" — um efeito, dois usos.
  if (r.ok) {
    const linha = document.querySelector('.gprod-item[data-key="' + key.replace(/"/g,'') + '"]');
    if (linha) { linha.classList.add('is-flash'); setTimeout(() => linha.classList.remove('is-flash'), 1400); }
  }
}

/* ── Histórico ─────────────────────────────────────────────── */
async function gProdOpenHistory(){
  const box = document.getElementById('gprod-history');
  if (!box) return;
  if (!box.hidden) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  box.innerHTML = `<div class="gprod-hist"><div class="gprod-hist-loading" role="status">Carregando histórico…</div></div>`;

  const r = await gFeatureHistory(40);
  if (!r.ok) {
    box.innerHTML = `<div class="gprod-hist"><p class="gprod-hist-erro">${_PROD_ICO_OFFLINE}
      Não foi possível carregar o histórico — ${gEsc(r.error || 'servidor indisponível')}.</p></div>`;
    return;
  }
  if (!r.rows.length) {
    box.innerHTML = `<div class="gprod-hist"><p class="gprod-hist-vazio">Nenhuma alteração registrada ainda.</p></div>`;
    return;
  }

  const linhas = r.rows.map(h => {
    const meta = G_FEATURE_REGISTRY.find(f => f.key === h.feature_key);
    const antes = h.valor_anterior || {};
    const depois = h.valor_novo || {};
    let acao;
    if (h.operacao === 'DELETE') acao = 'removeu a configuração';
    else if (h.operacao === 'INSERT') acao = depois.enabled === false ? 'criou desativado' : 'criou ativo';
    else if (antes.enabled !== depois.enabled) acao = depois.enabled ? 'reativou' : 'desativou';
    else acao = 'ajustou';
    const quando = h.created_at ? new Date(h.created_at).toLocaleString('pt-BR') : '';
    return `<li class="gprod-hist-item">
      <span class="gprod-hist-dot ${depois.enabled === false ? 'is-off' : 'is-on'}" aria-hidden="true"></span>
      <div><strong>${gEsc((meta && meta.label) || h.feature_key)}</strong> — ${gEsc(acao)}
        ${h.motivo ? '<em>· ' + gEsc(h.motivo) + '</em>' : ''}
        <small>${gEsc(quando)}</small></div></li>`;
  }).join('');

  box.innerHTML = `<div class="gprod-hist">
    <div class="gprod-hist-head"><h5>Últimas alterações</h5>
      <button type="button" class="gprod-btn-ghost" onclick="gProdOpenHistory()">Fechar</button></div>
    <ul class="gprod-hist-list">${linhas}</ul>
    <p class="gprod-hist-foot">${_PROD_ICO_SHIELD} O histórico é gravado pelo servidor e não pode ser editado.</p>
  </div>`;
}
