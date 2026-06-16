/**
 * js/dados/index.js
 *
 * Módulo 3 — bootstrap + roteamento entre as visões + tooltip compartilhado.
 * Padrão do projeto: muta pState → chama render explicitamente (sem reatividade).
 */

function pInit(){
  pBuildMocks();
  const main = document.getElementById('p-main');
  if(!main) return;
  pState._built = true;
  pApplyTheme();                // aplica o tema salvo (claro/escuro) + sincroniza o botão
  pBuildNav();                  // gera os botões do rail a partir de P_SECOES (1x)
  pSyncNav();
  pRender();
  pPlayEntry();                 // montagem escalonada ao ativar o módulo
}

/* ── tema claro/escuro — só do módulo Dados, persistido em localStorage ── */
const P_THEME_KEY = 'luma.dados.tema';
function pApplyTheme(){
  let t = 'dark';
  try { t = localStorage.getItem(P_THEME_KEY) || 'dark'; } catch(e){}
  const v = document.getElementById('view-dados');
  if(v) v.classList.toggle('p-light', t === 'light');
  pSyncThemeBtn();
}
function pToggleTheme(){
  const v = document.getElementById('view-dados');
  if(!v) return;
  const light = v.classList.toggle('p-light');
  try { localStorage.setItem(P_THEME_KEY, light ? 'light' : 'dark'); } catch(e){}
  pSyncThemeBtn();
}
function pSyncThemeBtn(){
  const v = document.getElementById('view-dados');
  const light = !!(v && v.classList.contains('p-light'));
  const ico = document.getElementById('p-theme-ico');
  const lbl = document.getElementById('p-theme-lbl');
  if(ico) ico.textContent = light ? '☀️' : '🌙';
  if(lbl) lbl.textContent = light ? 'Tema claro' : 'Tema escuro';
}

// Troca de visão (overview / templates) com fade
function pSetVisao(visao){
  if(pState.visao === visao) return;
  pState.visao = visao;
  pState.tabelaExpandida = null;
  pSyncNav();
  pRender();
  pPlayEntry();                 // re-escalona ao trocar de visão
}

// Período (7d/30d/90d) → fade out dos dados → re-render → fade in (sem re-escalonar)
function pSetPeriodo(periodo){
  if(pState.periodo === periodo) return;
  pState.periodo = periodo;
  const v = document.getElementById('view-dados');
  if(v && !pReduceMotion()){
    v.classList.add('p-updating');
    setTimeout(() => { pRender(); v.classList.remove('p-updating'); }, 190);
  } else {
    pRender();
  }
}

/* ── registry de seções (sub-nav data-driven; escala p/ as 8 seções) ── */
const P_SECOES = [
  { id:'overview',    label:'Visão Geral', ico:'📊', fn:'pRenderOverview' },
  { id:'templates',   label:'Templates',   ico:'🏆', fn:'pRenderTemplates' },
  { id:'heatmap',     label:'Horários',    ico:'🕒', fn:'pRenderHeatmap',    grupo:'Análises' },
  { id:'franqueados', label:'Franqueados', ico:'👥', fn:'pRenderFranqueados' },
  { id:'timeline',    label:'Publicações', ico:'📰', fn:'pRenderTimeline' },
  { id:'comparador',  label:'Comparar',    ico:'📈', fn:'pRenderComparador' },
  { id:'funil',       label:'Funil',       ico:'🔻', fn:'pRenderFunil' },
  { id:'geo',         label:'Regiões',     ico:'📍', fn:'pRenderGeo' },
];
// gera os botões do rail uma única vez (separador "Análises" antes das seções novas)
function pBuildNav(){
  const list = document.getElementById('p-nav-list');
  if(!list || list.dataset.built) return;
  list.innerHTML = P_SECOES.map(s =>
    (s.grupo ? `<div class="p-nav-sep"><span class="p-nav-sep-lbl">${pEsc(s.grupo)}</span></div>` : '') +
    `<button class="p-nav-btn" id="p-nav-${s.id}" onclick="pSetVisao('${s.id}')" title="${pEsc(s.label)}">` +
    `<span class="p-nav-ico">${s.ico}</span><span class="p-nav-label">${pEsc(s.label)}</span></button>`
  ).join('');
  list.dataset.built = '1';
}
function pSyncNav(){
  P_SECOES.forEach(s => {
    const b = document.getElementById('p-nav-' + s.id);
    if(b) b.classList.toggle('active', pState.visao === s.id);
  });
}

function pRender(){
  const main = document.getElementById('p-main');
  if(!main) return;
  pHideTip();
  const sec = P_SECOES.find(s => s.id === pState.visao);
  const fn = sec && typeof window[sec.fn] === 'function' ? window[sec.fn] : pRenderOverview;
  main.innerHTML = fn();
  main.classList.remove('p-fade'); void main.offsetWidth; main.classList.add('p-fade');
  // pós-render: dispara animações de barras (largura 0 → final).
  // HTML (conclusão, '%') → style.width; SVG <rect> (barras, 'px') → atributo width.
  requestAnimationFrame(() => {
    main.querySelectorAll('[data-grow]').forEach(el => {
      const g = el.getAttribute('data-grow');
      if(el.namespaceURI === 'http://www.w3.org/2000/svg') el.setAttribute('width', parseFloat(g));
      else el.style.width = g;
    });
    // animações específicas da Visão Geral (contadores, desenho da linha, arco do donut)
    if(pState.visao === 'overview'){
      if(typeof pAnimateCounters === 'function') pAnimateCounters();
      if(typeof pAnimateLineChart === 'function') pAnimateLineChart();
      if(typeof pAnimateDonut === 'function') pAnimateDonut();
    }
    // hook pós-render opcional por seção (ex.: desenho de linha do comparador)
    if(sec && sec.after && typeof window[sec.after] === 'function') window[sec.after]();
  });
}

/* respeita usuários sensíveis a movimento */
function pReduceMotion(){
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/* (re)dispara a animação de montagem escalonada da view (.p-entering) */
let _pEntryTimer = null;
function pPlayEntry(){
  const v = document.getElementById('view-dados');
  if(!v) return;
  v.classList.remove('p-entering');
  void v.offsetWidth;                       // reflow → reinicia as animações de entrada
  v.classList.add('p-entering');
  if(_pEntryTimer) clearTimeout(_pEntryTimer);
  // remove depois de montar, p/ trocas de período/filtro não re-escalonarem tudo
  _pEntryTimer = setTimeout(() => v.classList.remove('p-entering'), 1500);
}

/* ── tooltip compartilhado dos gráficos ── */
function pTipEl(){
  let el = document.getElementById('p-tooltip');
  if(!el){ el = document.createElement('div'); el.id = 'p-tooltip'; el.className = 'p-tooltip'; document.body.appendChild(el); }
  return el;
}
// chamado por onmousemove em elementos com data-tip (HTML) — posiciona no cursor
function pChartTip(ev){
  const host = ev.currentTarget;
  const html = host.getAttribute('data-tip');
  if(!html) return;
  const el = pTipEl();
  el.innerHTML = html;
  el.classList.add('show');
  const pad = 14;
  let x = ev.clientX + pad, y = ev.clientY + pad;
  const r = el.getBoundingClientRect();
  if(x + r.width > window.innerWidth - 8) x = ev.clientX - r.width - pad;
  if(y + r.height > window.innerHeight - 8) y = ev.clientY - r.height - pad;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
}
function pHideTip(){
  const el = document.getElementById('p-tooltip'); if(el) el.classList.remove('show');
  const ch = document.getElementById('p-crosshair'); if(ch) ch.classList.remove('visible');
  const dot = document.getElementById('p-hover-dot'); if(dot) dot.classList.remove('visible');
}

/* ── helpers de markup ── */
function pEsc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }
function pPeriodPills(){
  return ['7d','30d','90d'].map(p =>
    `<button class="p-pill ${pState.periodo === p ? 'active' : ''}" onclick="pSetPeriodo('${p}')">${p}</button>`
  ).join('');
}
function pEmpty(ico, title, text, ctaLabel, ctaMode){
  const cta = ctaLabel ? `<button class="p-empty-cta" onclick="setMode('${ctaMode || 'franqueado'}')">${pEsc(ctaLabel)}</button>` : '';
  return `<div class="p-empty"><div class="p-empty-ico">${ico}</div><div class="p-empty-title">${pEsc(title)}</div><div class="p-empty-text">${pEsc(text)}</div>${cta}</div>`;
}
