/**
 * js/franqueado/panel-dock.js
 *
 * Drag & drop das 3 colunas do workspace do franqueado (só desktop largo).
 * Depende de: index.html (grips + #fran-main), css/modules/panel-dock.css,
 *             live-preview.js (fUpdateLivePreview/fLpRefit — re-encaixe do canvas).
 *
 * MODELO — 3 SLOTS fixos por POSIÇÃO, não por painel:
 *   slot 0 (esquerda, ~328px) · slot 1 (centro, flex:1 = HERÓI) · slot 2 (direita, ~380px)
 * 3 PAINÉIS com identidade: 'left'=#fran-left · 'chat'=#f-chat-col · 'preview'=#f-live-preview.
 * Reordenar = trocar o data-panel-slot dos painéis. O CSS (panel-dock.css) põe
 * display:contents nos wrappers #fran-right/#f-right-body → os 3 viram irmãos flex
 * de #fran-main, e as regras [data-panel-slot] dão order+largura por posição.
 *
 * ⚠ NENHUM nó é movido no DOM — mobile, tema (camp-theme-*), fGoHome e
 * fRestoreCatalog continuam batendo nos mesmos elementos. O estado é só CSS +
 * um data-attr, então sobrevive a navegação/tema sem re-aplicar.
 */

const PANEL_ORDER_KEY = 'luma_panel_layout_order_v1';
const PANEL_KEYS = ['left', 'chat', 'preview'];
const PANEL_EL  = { left: 'fran-left', chat: 'f-chat-col', preview: 'f-live-preview' };
const PANEL_DOCK_MINW = 1024;                 // abaixo disto o layout de 3 colunas colapsa → drag off
/* Ordem esquerda→direita. PADRÃO trocado em 03/09 a pedido do Ryan: a prévia ao vivo
   vai para o MEIO e o chat para a direita. Motivo de produto: a arte é o herói da tela
   (design-process §3), então ela fica no centro do olhar, e o chat — que é uma coluna de
   conversa estreita — encosta na borda como um painel de conversa costuma ficar.
   ⚠ Quem já arrastou as colunas antes disto NÃO é afetado: o `fLoadPanelOrder()` (ordem
   salva) vence este padrão, e é assim que deve ser — preferência de gente > padrão novo. */
let _panelOrder = ['left', 'preview', 'chat'];
let _panelDrag  = null;

// key ('left'/'chat'/'preview') a partir do elemento do painel
function _fPanelKeyFromEl(el) {
  if (!el) return null;
  if (el.id === 'fran-left') return 'left';
  if (el.id === 'f-chat-col') return 'chat';
  if (el.id === 'f-live-preview') return 'preview';
  return null;
}

// Dock ativo só em desktop largo e fora do home (a vitrine é tela cheia).
function _fPanelDockEnabled() {
  return !!(window.matchMedia && window.matchMedia('(min-width:' + PANEL_DOCK_MINW + 'px)').matches)
      && !document.body.classList.contains('f-home-mode');
}

/* ── PERSISTÊNCIA (localStorage) ── */
function fLoadPanelOrder() {
  try {
    const raw = localStorage.getItem(PANEL_ORDER_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    // valida: exatamente as 3 chaves conhecidas, sem lixo (senão ignora e usa default)
    if (Array.isArray(arr) && arr.length === 3 && PANEL_KEYS.every(k => arr.includes(k))) return arr;
  } catch (e) {}
  return null;
}
function fSavePanelOrder() {
  try { localStorage.setItem(PANEL_ORDER_KEY, JSON.stringify(_panelOrder)); } catch (e) {}
}

/* ── APLICAR ORDEM ── escreve data-panel-slot (0/1/2) em cada painel; o CSS faz o resto. */
function fSetPanelOrder(order, opts) {
  if (!Array.isArray(order) || order.length !== 3) return;
  if (!PANEL_KEYS.every(k => order.includes(k))) return;
  _panelOrder = order.slice();
  order.forEach((key, slot) => {
    const el = document.getElementById(PANEL_EL[key]);
    if (el) el.dataset.panelSlot = String(slot);
  });
  document.body.dataset.panelOrder = order.join(',');
  if (!opts || opts.save !== false) fSavePanelOrder();
  // Preview mudou de espaço (esp. entrando/saindo do centro) → re-encaixa o canvas.
  // Reusa o motor único da prévia; rAF pra medir DEPOIS do layout assentar.
  requestAnimationFrame(() => {
    try { if (typeof fUpdateLivePreview === 'function') fUpdateLivePreview(); } catch (e) {}
    try { if (typeof fLpRefit === 'function') fLpRefit(); } catch (e) {}
  });
}

/* ── DRAG (PointerEvents — mouse/caneta/toque) ── */
function _fPanelPointerDown(e) {
  if (e.button && e.button !== 0) return;      // só botão primário
  if (!_fPanelDockEnabled()) return;
  const grip = e.currentTarget;
  const key = grip.getAttribute('data-panel-grip');
  const el = document.getElementById(PANEL_EL[key]);
  if (!el) return;
  e.preventDefault();
  _panelDrag = { key, el, startX: e.clientX, startY: e.clientY, target: null };
  el.classList.add('is-panel-dragging');
  document.body.classList.add('panel-dock-dragging');
  try { grip.setPointerCapture(e.pointerId); } catch (_) {}
  grip.addEventListener('pointermove', _fPanelPointerMove);
  grip.addEventListener('pointerup', _fPanelPointerUp);
  grip.addEventListener('pointercancel', _fPanelPointerUp);
}

function _fPanelPointerMove(e) {
  if (!_panelDrag) return;
  const d = _panelDrag;
  d.el.style.transform = 'translate(' + (e.clientX - d.startX) + 'px,' + (e.clientY - d.startY) + 'px)';
  // Hitscan: painel sob o ponteiro. Apaga o painel arrastado do hit-test (pointer-events:none)
  // pra enxergar o que está ATRÁS dele.
  d.el.style.pointerEvents = 'none';
  const under = document.elementFromPoint(e.clientX, e.clientY);
  d.el.style.pointerEvents = '';
  const tgtEl = under && under.closest('#fran-left,#f-chat-col,#f-live-preview');
  const tgtKey = tgtEl ? _fPanelKeyFromEl(tgtEl) : null;
  const curKey = d.target && d.target.key;
  if (tgtKey !== curKey) {
    if (d.target) d.target.el.classList.remove('panel-drop-zone-active');
    if (tgtKey && tgtKey !== d.key) {
      tgtEl.classList.add('panel-drop-zone-active');
      d.target = { key: tgtKey, el: tgtEl };
    } else {
      d.target = null;
    }
  }
}

function _fPanelPointerUp(e) {
  if (!_panelDrag) return;
  const d = _panelDrag;
  const grip = e.currentTarget;
  grip.removeEventListener('pointermove', _fPanelPointerMove);
  grip.removeEventListener('pointerup', _fPanelPointerUp);
  grip.removeEventListener('pointercancel', _fPanelPointerUp);
  try { grip.releasePointerCapture(e.pointerId); } catch (_) {}
  d.el.style.transform = '';
  d.el.style.pointerEvents = '';
  d.el.classList.remove('is-panel-dragging');
  document.body.classList.remove('panel-dock-dragging');
  if (d.target) d.target.el.classList.remove('panel-drop-zone-active');
  // Soltou sobre outro painel → TROCA as posições dos dois (swap é sempre válido com 3 itens).
  if (d.target && d.target.key !== d.key) {
    const a = _panelOrder.indexOf(d.key);
    const b = _panelOrder.indexOf(d.target.key);
    if (a >= 0 && b >= 0) {
      const next = _panelOrder.slice();
      next[a] = d.target.key; next[b] = d.key;
      fSetPanelOrder(next);
    }
  }
  _panelDrag = null;
}

/* ── INIT ── liga o dock em desktop, reaplica a ordem salva, arma os grips. */
function fInitPanelDock() {
  const main = document.getElementById('fran-main');
  if (!main) return;
  // panel-dock-active liga por LARGURA (grips visíveis + larguras de slot). O
  // display:contents e o gate de home ficam no CSS (:not(.f-home-mode)); o drag em si
  // revalida em _fPanelDockEnabled no pointerdown.
  const applyActive = () => {
    const wide = !!(window.matchMedia && window.matchMedia('(min-width:' + PANEL_DOCK_MINW + 'px)').matches);
    document.body.classList.toggle('panel-dock-active', wide);
  };
  applyActive();
  window.addEventListener('resize', applyActive);
  // ordem: salva > default. save:false pra não regravar o que acabou de ler.
  fSetPanelOrder(fLoadPanelOrder() || _panelOrder, { save: false });
  document.querySelectorAll('[data-panel-grip]').forEach(grip => {
    grip.style.touchAction = 'none';           // toque não rola a tela enquanto arrasta
    grip.addEventListener('pointerdown', _fPanelPointerDown);
  });
}
window.addEventListener('DOMContentLoaded', fInitPanelDock);
