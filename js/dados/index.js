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
  const body = document.body;
  const v = document.getElementById('view-dados');
  
  // Aplica classe no body para alcançar tooltips órfãos
  if(body) body.classList.toggle('p-light-theme', t === 'light');
  if(v) v.classList.toggle('p-light', t === 'light');
  pSyncThemeBtn();
}
function pToggleTheme(){
  const v = document.getElementById('view-dados');
  if(!v) return;
  const light = v.classList.toggle('p-light');
  document.body.classList.toggle('p-light-theme', light);
  try { localStorage.setItem(P_THEME_KEY, light ? 'light' : 'dark'); } catch(e){}
  pSyncThemeBtn();
}
function pSyncThemeBtn(){
  const v = document.getElementById('view-dados');
  const light = !!(v && v.classList.contains('p-light'));
  const ico = document.getElementById('p-theme-ico');
  const lbl = document.getElementById('p-theme-lbl');
  if(ico) ico.innerHTML = light ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>` : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
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
  { id:'overview',    label:'Visão Geral', ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>', fn:'pRenderOverview' },
  { id:'templates',   label:'Templates',   ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34"></path><path d="M12 2a6 6 0 0 1 6 6c0 3.27-2 6-6 6S6 11.27 6 8a6 6 0 0 1 6-6z"></path></svg>', fn:'pRenderTemplates' },
  { id:'franqueados', label:'Franqueados', ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>', fn:'pRenderFranqueados', grupo:'Análises' },
  { id:'timeline',    label:'Publicações', ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"></path><path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z"></path></svg>', fn:'pRenderTimeline' },
  { id:'comparador',  label:'Comparar',    ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>', fn:'pRenderComparador' },
  { id:'funil',       label:'Funil',       ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>', fn:'pRenderFunil' },
  { id:'geo',         label:'Regiões',     ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>', fn:'pRenderGeo' },
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
      if(typeof pAnimateHealth === 'function') pAnimateHealth();
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
