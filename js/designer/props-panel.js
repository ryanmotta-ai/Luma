/**
 * js/designer/props-panel.js
 * Accordion, sub-nav scroll, alignment button group para o painel de props.
 */

const DP_SECS_KEY = 'dp-secs';

function dPropToggleSection(btn) {
  const sec = btn.closest('.dp-section');
  if (!sec) return;
  const body = sec.querySelector('.dp-sec-body');
  if (!body) return;
  const isOpen = sec.classList.contains('dp-section-open');
  if (isOpen) {
    body.style.height = body.scrollHeight + 'px';
    requestAnimationFrame(function() { body.style.height = '0'; });
    sec.classList.remove('dp-section-open');
  } else {
    body.style.height = body.scrollHeight + 'px';
    body.addEventListener('transitionend', function h() {
      body.removeEventListener('transitionend', h);
      if (sec.classList.contains('dp-section-open')) body.style.height = 'auto';
    });
    sec.classList.add('dp-section-open');
  }
  btn.setAttribute('aria-expanded', String(!isOpen));
  dPropSaveSections();
}

function dPropSaveSections() {
  try {
    var state = {};
    document.querySelectorAll('#d-props-form .dp-section[id]').forEach(function(s) {
      state[s.id] = s.classList.contains('dp-section-open');
    });
    sessionStorage.setItem(DP_SECS_KEY, JSON.stringify(state));
  } catch(e) {}
}

function dPropRestoreSections() {
  try {
    var raw = sessionStorage.getItem(DP_SECS_KEY);
    if (!raw) return;
    var state = JSON.parse(raw);
    document.querySelectorAll('#d-props-form .dp-section[id]').forEach(function(s) {
      var body = s.querySelector('.dp-sec-body');
      if (!body) return;
      var open = state[s.id] !== undefined ? state[s.id] : s.classList.contains('dp-section-open');
      if (open) {
        s.classList.add('dp-section-open');
        body.style.height = 'auto';
      } else {
        s.classList.remove('dp-section-open');
        body.style.height = '0';
      }
      var head = s.querySelector('.dp-sec-head');
      if (head) head.setAttribute('aria-expanded', String(open));
    });
  } catch(e) {}
}

function dPropScrollTo(sectionId) {
  var sec = document.getElementById(sectionId);
  if (!sec) return;
  if (!sec.classList.contains('dp-section-open')) {
    var btn = sec.querySelector('.dp-sec-head');
    if (btn) dPropToggleSection(btn);
  }
  var form = document.getElementById('d-props-form');
  if (form) form.scrollTo({ top: sec.offsetTop - 4, behavior: 'smooth' });

  // ── Mark active nav button ──────────────────────────────
  var subnav = document.querySelector('.dp-subnav');
  if (subnav) {
    subnav.querySelectorAll('.dp-nav-btn').forEach(function(b) {
      var onclick = b.getAttribute('onclick') || '';
      b.classList.toggle('dp-nav-active', onclick.includes(sectionId));
    });
  }
}

function dPropSetAlign(val, btn) {
  document.getElementById('dp-align').value = val;
  var grp = document.getElementById('dp-align-group');
  if (grp) grp.querySelectorAll('.dp-btn-icon').forEach(function(b) {
    b.classList.toggle('dp-active', b.dataset.val === val);
  });
  dUpdateProp('textAlign', val);
}

function dPropSyncAlign(val) {
  var grp = document.getElementById('dp-align-group');
  if (!grp) return;
  grp.querySelectorAll('.dp-btn-icon').forEach(function(b) {
    b.classList.toggle('dp-active', b.dataset.val === val);
  });
}

function dPropShowSections(layerType) {
  var isText  = layerType === 'text';
  var isImg   = layerType === 'image' || layerType === 'frame';
  var isShp   = layerType === 'shape';

  var secContent = document.getElementById('dp-sec-content');
  var secText    = document.getElementById('dp-sec-text');
  var secAppear  = document.getElementById('dp-sec-appear');
  var secAnchor  = document.getElementById('dp-sec-anchor');
  var secRules   = document.getElementById('dp-sec-rules');

  var hasLayer = isText || isImg || isShp;

  if (secContent) secContent.style.display = (isText || isImg) ? '' : 'none';
  if (secText)    secText.style.display    = isText ? '' : 'none';
  if (secAppear)  secAppear.style.display  = isShp  ? '' : 'none';
  if (secAnchor)  secAnchor.style.display  = hasLayer ? '' : 'none';
  if (secRules)   secRules.style.display   = hasLayer ? '' : 'none';

  // Auto-expand the primary section for the layer type
  var targetOpen = isText ? secText : (isShp ? secAppear : secContent);
  if (targetOpen && !targetOpen.classList.contains('dp-section-open')) {
    var btn = targetOpen.querySelector('.dp-sec-head');
    if (btn) dPropToggleSection(btn);
  }
}

/* --------------------------------------------------------------------------
   Contextual inspector shell
   Keeps the editing engine untouched: this layer only presents existing state.
   -------------------------------------------------------------------------- */

const DP_LAYERS_COLLAPSED_KEY = 'dp-layers-collapsed';
const DP_COMPOSITION_OPEN_KEY = 'dp-composition-open';
const DP_WORKSPACE_MODE_KEY = 'dp-workspace-mode';

const DP_ESSENTIAL_TOOL_LABELS = {
  'vt-text-wrap': 'Texto',
  'vt-frame-wrap': 'Imagens',
  'vt-forma-wrap': 'Formas',
  'vt-data-wrap': 'Campos',
  'dtool-resources': 'Elementos'
};

const DP_ESSENTIAL_TOOL_FLYOUTS = {
  'vt-text-wrap': 'dTextFlyout',
  'vt-frame-wrap': 'dFrameFlyout',
  'vt-forma-wrap': 'dFormaFlyout',
  'vt-data-wrap': 'dDataFlyout'
};

const DP_ESSENTIAL_TOOL_VALUES = [
  'select', 'hand',
  'text', 'text-h', 'text-v',
  'rect', 'ellipse', 'triangle', 'polygon', 'star', 'line',
  'frame', 'img', 'var-data'
];

function dPropWorkspaceMode() {
  return document.body.classList.contains('d-studio-advanced') ? 'advanced' : 'essential';
}

function dPropReadWorkspaceMode() {
  try {
    return localStorage.getItem(DP_WORKSPACE_MODE_KEY) === 'advanced' ? 'advanced' : 'essential';
  } catch(e) {
    return 'essential';
  }
}

function dPropSetWorkspaceMode(mode, options) {
  const advanced = mode === 'advanced';
  const persist = !!(options && options.persist);
  const announce = !!(options && options.announce);
  const toggle = document.getElementById('dpi-studio-mode-switch');
  const label = document.getElementById('dpi-studio-mode-label');
  const live = document.getElementById('dpi-studio-mode-live');

  document.body.classList.toggle('d-studio-essential', !advanced);
  document.body.classList.toggle('d-studio-advanced', advanced);

  if (toggle) {
    toggle.setAttribute('aria-pressed', String(advanced));
    toggle.setAttribute('aria-label', advanced ? 'Voltar às ferramentas principais' : 'Abrir mais ferramentas');
    toggle.title = advanced ? 'Voltar às ferramentas principais' : 'Abrir mais ferramentas';
  }
  if (label) label.textContent = advanced ? 'Simplificar' : 'Mais ferramentas';

  if (!advanced) {
    document.querySelectorAll('#d-vtoolbar .vt-flyout.open').forEach(function(flyout) {
      flyout.classList.remove('open');
    });
    if (typeof dToggleAllTools === 'function') dToggleAllTools(false);
    // Cada grupo lembra a última subferramenta usada. Ao voltar ao modo essencial,
    // não deixa um botão visível reativar silenciosamente uma opção agora escondida.
    if (typeof dSelectLast !== 'undefined' && ['select', 'hand'].indexOf(dSelectLast) === -1) dSelectLast = 'select';
    if (typeof dTextLast !== 'undefined' && ['text-h', 'text-v'].indexOf(dTextLast) === -1) dTextLast = 'text-h';
    if (typeof dDataLast !== 'undefined' && dDataLast !== 'var-data') dDataLast = 'var-data';
    if (typeof dTool !== 'undefined' && DP_ESSENTIAL_TOOL_VALUES.indexOf(dTool) === -1 && typeof dSetTool === 'function') {
      dSetTool('select');
    }
  }

  if (persist) {
    try { localStorage.setItem(DP_WORKSPACE_MODE_KEY, advanced ? 'advanced' : 'essential'); } catch(e) {}
  }
  if (announce && live) {
    live.textContent = advanced
      ? 'Todas as ferramentas profissionais estão visíveis.'
      : 'As ferramentas principais estão visíveis. Use Mais ferramentas para abrir as opções profissionais.';
  }
  if (typeof dPropSyncInspectorFromState === 'function') dPropSyncInspectorFromState();
}

function dPropToggleWorkspaceMode() {
  dPropSetWorkspaceMode(dPropWorkspaceMode() === 'advanced' ? 'essential' : 'advanced', {
    persist: true,
    announce: true
  });
}

function dPropBuildWorkspaceMode() {
  const toolbar = document.getElementById('d-vtoolbar');
  const grid = toolbar ? toolbar.querySelector('.vt-tools-grid') : null;
  if (!toolbar || !grid || document.getElementById('dpi-studio-mode-switch')) return;

  const head = document.createElement('div');
  head.className = 'dpi-studio-rail-head';
  head.innerHTML = '<strong>Adicionar</strong>';
  toolbar.insertBefore(head, toolbar.firstChild);

  const modeSwitch = document.createElement('button');
  modeSwitch.type = 'button';
  modeSwitch.id = 'dpi-studio-mode-switch';
  modeSwitch.className = 'dpi-studio-mode-switch';
  modeSwitch.setAttribute('aria-pressed', 'false');
  modeSwitch.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>' +
    '</svg>' +
    '<span id="dpi-studio-mode-label">Mais ferramentas</span>';
  modeSwitch.addEventListener('click', dPropToggleWorkspaceMode);
  toolbar.insertBefore(modeSwitch, grid.nextSibling);

  const live = document.createElement('span');
  live.id = 'dpi-studio-mode-live';
  live.className = 'sr-only';
  live.setAttribute('aria-live', 'polite');
  toolbar.appendChild(live);

  toolbar.querySelectorAll('.vt-group-wrap, .vt-group > .vt-btn, .vt-tools-grid > .vt-btn').forEach(function(tool) {
    tool.classList.add('d-studio-tool');
  });

  Object.keys(DP_ESSENTIAL_TOOL_LABELS).forEach(function(id) {
    const tool = document.getElementById(id);
    if (!tool) return;
    const button = tool.matches('button') ? tool : tool.querySelector(':scope > .vt-btn');
    if (!button) return;
    tool.classList.add('d-studio-tool-essential');
    button.classList.add('d-studio-tool-essential-button');
    button.setAttribute('aria-label', DP_ESSENTIAL_TOOL_LABELS[id]);
    if (!button.querySelector('.dpi-essential-tool-label')) {
      const toolLabel = document.createElement('span');
      toolLabel.className = 'dpi-essential-tool-label';
      toolLabel.textContent = DP_ESSENTIAL_TOOL_LABELS[id];
      button.appendChild(toolLabel);
    }
    if (DP_ESSENTIAL_TOOL_FLYOUTS[id] && !tool.querySelector('.dpi-essential-tool-options')) {
      const options = document.createElement('button');
      options.type = 'button';
      options.className = 'dpi-essential-tool-options';
      options.setAttribute('aria-label', 'Mais opções de ' + DP_ESSENTIAL_TOOL_LABELS[id].toLowerCase());
      options.title = 'Mais opções';
      options.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
      options.addEventListener('click', function(event) {
        const openFlyout = window[DP_ESSENTIAL_TOOL_FLYOUTS[id]];
        if (typeof openFlyout === 'function') openFlyout(event);
      });
      const flyout = tool.querySelector(':scope > .vt-flyout');
      tool.insertBefore(options, flyout || null);
    }
  });

  ['dtool-obj-select', 'dtool-quick-select', 'dtool-magic-wand', 'dtool-mask-text-h', 'dtool-mask-text-v', 'dtool-qr-code'].forEach(function(id) {
    const item = document.getElementById(id);
    if (item) item.classList.add('d-studio-flyout-advanced');
  });

  toolbar.querySelectorAll('.vt-colors, .vt-color-sep, .vt-color-picker').forEach(function(control) {
    control.classList.add('d-studio-tool-advanced');
  });

  dPropSetWorkspaceMode(dPropReadWorkspaceMode(), { persist: false, announce: false });
}

function dPropBuildEssentialChrome() {
  const topbar = document.getElementById('d-topbar');
  const left = topbar ? topbar.querySelector('.dt-left-cluster') : null;
  const docActions = topbar ? topbar.querySelector('.dt-doc-actions') : null;
  if (!topbar || !left || !docActions) return;

  topbar.classList.add('dpi-studio-topbar');

  const duplicateSave = document.getElementById('dpi-save-now');
  if (duplicateSave) duplicateSave.remove();

  if (!document.getElementById('dpi-studio-back')) {
    const back = document.createElement('button');
    back.type = 'button';
    back.id = 'dpi-studio-back';
    back.className = 'dt-btn-action dpi-studio-back';
    back.setAttribute('aria-label', 'Voltar ao início do Estúdio');
    back.title = 'Voltar ao início do Estúdio';
    back.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>' +
      '<span>Voltar</span>';
    back.addEventListener('click', function() {
      if (typeof dStudioHomeOpen === 'function') dStudioHomeOpen();
    });
    left.insertBefore(back, left.firstChild);
  }

  const newProject = topbar.querySelector('.dt-new-project');
  if (newProject) {
    newProject.setAttribute('aria-label', 'Criar novo projeto');
    newProject.title = 'Criar novo projeto';
    const label = newProject.querySelector('span');
    if (label) label.textContent = 'Novo';
  }

  const saveAsButton = docActions.querySelector('.dt-btn-action:not([data-export-action])');
  if (saveAsButton) {
    saveAsButton.classList.add('dpi-save-as-action');
    saveAsButton.setAttribute('aria-label', 'Salvar uma cópia do material');
    saveAsButton.title = 'Salvar uma cópia do material';
  }

  const exportButton = topbar.querySelector('[data-export-action]') ||
    topbar.querySelector('[onclick*="dOpenExportModal"]');
  if (exportButton) {
    exportButton.classList.add('dpi-export-action');
    exportButton.setAttribute('aria-label', 'Exportar material');
    exportButton.title = 'Exportar material';
    const label = exportButton.querySelector('span');
    if (label) label.textContent = 'Exportar';
  }

  const previewButton = topbar.querySelector('[onclick*="dOpenSimModal"]');
  if (previewButton) {
    previewButton.setAttribute('aria-label', 'Visualizar com dados de exemplo');
    previewButton.title = 'Visualizar com dados de exemplo';
    const label = previewButton.querySelector('span');
    if (label) label.textContent = 'Visualizar';
  }

  const saveIndicator = document.getElementById('d-save-indicator');
  if (saveIndicator) {
    saveIndicator.setAttribute('role', 'status');
    saveIndicator.setAttribute('aria-live', 'polite');
    saveIndicator.setAttribute('aria-atomic', 'true');
  }

  const reviewTab = document.querySelector('.d-rp-tab[data-panel="linter"]');
  if (reviewTab) {
    reviewTab.title = 'Revisão de qualidade';
    if (!reviewTab.querySelector('.dpi-tab-label')) reviewTab.textContent = 'Revisão';
  }

  const staleGuide = document.getElementById('dpi-empty-guide');
  if (staleGuide) staleGuide.remove();

  const artboardSize = document.querySelector('#dp-sec-ab-size .dp-sec-label');
  const artboardWidthInput = document.getElementById('d-ab-w-inp');
  const artboardHeightInput = document.getElementById('d-ab-h-inp');
  const artboardWidth = artboardWidthInput ? artboardWidthInput.closest('.dp-xywh-field') : null;
  const artboardHeight = artboardHeightInput ? artboardHeightInput.closest('.dp-xywh-field') : null;
  if (artboardSize) artboardSize.textContent = 'Tamanho da arte';
  if (artboardWidth) {
    const label = artboardWidth.querySelector('label');
    if (label) label.textContent = 'Largura';
    artboardWidthInput.setAttribute('aria-label', 'Largura da arte em pixels');
  }
  if (artboardHeight) {
    const label = artboardHeight.querySelector('label');
    if (label) label.textContent = 'Altura';
    artboardHeightInput.setAttribute('aria-label', 'Altura da arte em pixels');
  }
}

const DP_PANEL_ICONS = {
  camadas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z"/><path d="m4 12 8 4.5 8-4.5"/><path d="m4 16.5 8 4.5 8-4.5"/></svg>',
  dados: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="5" rx="7.5" ry="3"/><path d="M4.5 5v7c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V5"/><path d="M4.5 12v7c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-7"/></svg>',
  campaigns: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H10l2 2h5.5A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-11Z"/></svg>',
  linter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4h6M9 2h6v4H9z"/><path d="M7 4H5.5A1.5 1.5 0 0 0 4 5.5v15A1.5 1.5 0 0 0 5.5 22h13a1.5 1.5 0 0 0 1.5-1.5v-15A1.5 1.5 0 0 0 18.5 4H17"/><path d="m8 13 2.2 2.2L16 9.5"/></svg>'
};

const DP_SECTION_ICONS = {
  'dp-sec-ab-size': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M3 9h18"/></svg>',
  'dp-sec-ab-bg': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 3 7 7-7 11-7-11 7-7Z"/><path d="M5 10h14"/></svg>',
  'dp-sec-ab-orient': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="7" y="3" width="10" height="18" rx="2"/><path d="M10 6h4"/></svg>',
  'dp-sec-content': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
  'dp-sec-text': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 5V3h14v2M9 21h6M12 3v18"/></svg>',
  'dp-sec-pos': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M22 12l-3-3M22 12l-3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3"/></svg>',
  'dp-sec-appear': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 3 7 7-7 11-7-11 7-7Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  'dp-sec-anchor': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M4 17h16M8 3v8M16 13v8"/></svg>',
  'dp-sec-rules': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3v12M6 9h8a4 4 0 0 1 4 4v8"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="5" r="3"/></svg>'
};

const DP_PANEL_VIEW_META = {
  edit: {
    label: 'Editar',
    panel: 'camadas',
    controls: 'd-panel-camada',
    icon: DP_SECTION_ICONS['dp-sec-appear']
  },
  organize: {
    label: 'Organizar',
    panel: 'camadas',
    controls: 'd-layers-section',
    icon: DP_PANEL_ICONS.camadas
  },
  dados: {
    label: 'Campos',
    panel: 'dados',
    controls: 'd-panel-dados',
    icon: DP_PANEL_ICONS.dados
  }
};

function dPropBuildPanelNav() {
  const right = document.getElementById('d-right');
  const tabs = right ? right.querySelector('.d-rp-tabs') : null;
  if (!right || !tabs || document.getElementById('dpi-panel-nav')) return;

  const nav = document.createElement('div');
  nav.id = 'dpi-panel-nav';
  nav.className = 'dpi-panel-nav';
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', 'O que você quer fazer');

  Object.keys(DP_PANEL_VIEW_META).forEach(function(view) {
    const meta = DP_PANEL_VIEW_META[view];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dpi-panel-nav-button';
    button.dataset.view = view;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', meta.controls);
    button.setAttribute('aria-selected', 'false');
    button.tabIndex = -1;
    button.innerHTML =
      '<span class="dpi-panel-nav-icon" aria-hidden="true">' + meta.icon + '</span>' +
      '<span>' + meta.label + '</span>';
    button.addEventListener('click', function() {
      dPropOpenPanelView(view);
    });
    nav.appendChild(button);
  });

  nav.addEventListener('keydown', function(event) {
    const buttons = Array.from(nav.querySelectorAll('.dpi-panel-nav-button'));
    const current = buttons.indexOf(document.activeElement);
    let next = null;
    if (event.key === 'ArrowRight') next = (Math.max(current, 0) + 1) % buttons.length;
    if (event.key === 'ArrowLeft') next = (current <= 0 ? buttons.length : current) - 1;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = buttons.length - 1;
    if (next === null) return;
    event.preventDefault();
    buttons[next].focus();
    buttons[next].click();
  });

  right.insertBefore(nav, tabs);
  dPropSyncPanelNav('edit');
}

function dPropSyncPanelNav(view) {
  const right = document.getElementById('d-right');
  const nav = document.getElementById('dpi-panel-nav');
  if (!right) return;
  const normalized = DP_PANEL_VIEW_META[view] ? view : String(view || '');
  right.dataset.dpiView = normalized;
  right.classList.toggle('dpi-organize-open', normalized === 'organize');
  if (!nav) return;

  nav.querySelectorAll('.dpi-panel-nav-button').forEach(function(button) {
    const active = button.dataset.view === normalized;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  });
}

function dPropOpenPanelView(view) {
  const meta = DP_PANEL_VIEW_META[view];
  if (!meta || typeof dPropBaseActivatePanel !== 'function') return;
  dPropBaseActivatePanel(meta.panel);
  dPropSyncTabs(meta.panel);
  dPropSyncPanelNav(view);

  if (view === 'organize') {
    const section = document.getElementById('d-layers-section');
    const collapse = document.getElementById('dpi-layers-collapse');
    if (section && collapse && section.classList.contains('dpi-layers-collapsed')) collapse.click();
    const search = document.getElementById('d-layers-search');
    if (search) window.setTimeout(function() { search.focus(); }, 0);
  }
}

function dPropLayerIcon(type) {
  if (type === 'text') return DP_SECTION_ICONS['dp-sec-text'];
  if (type === 'image' || type === 'frame') return DP_SECTION_ICONS['dp-sec-content'];
  if (type === 'group') return DP_PANEL_ICONS.campaigns;
  return DP_SECTION_ICONS['dp-sec-appear'];
}

function dPropLayerTypeLabel(type) {
  const labels = {
    text: 'Texto',
    image: 'Imagem',
    frame: 'Moldura de foto',
    shape: 'Forma',
    group: 'Grupo'
  };
  return labels[type] || 'Camada';
}

function dPropActiveArtboard() {
  if (typeof dArtboards === 'undefined' || !Array.isArray(dArtboards)) return null;
  const activeId = typeof dActiveABId !== 'undefined' ? dActiveABId : null;
  return dArtboards.find(function(ab) { return ab.id === activeId; }) || dArtboards[0] || null;
}

function dPropBuildInspectorHeader() {
  const panel = document.getElementById('d-panel-camada');
  const props = document.getElementById('dtab-props');
  if (!panel || !props || document.getElementById('dpi-context')) return;

  const header = document.createElement('div');
  header.id = 'dpi-context';
  header.className = 'dpi-context';
  header.innerHTML =
    '<div class="dpi-context-main">' +
      '<span class="dpi-context-icon" id="dpi-context-icon" aria-hidden="true"></span>' +
      '<span class="dpi-context-copy">' +
        '<span class="dpi-context-kicker" id="dpi-context-kicker">Documento</span>' +
        '<strong class="dpi-context-name" id="dpi-context-name">Prancheta</strong>' +
        '<span class="dpi-context-meta" id="dpi-context-meta"></span>' +
      '</span>' +
    '</div>' +
    '<div class="dpi-context-actions" aria-label="A\u00e7\u00f5es da camada">' +
      '<button type="button" class="dpi-context-action dpi-selection-action" id="dpi-context-visible" onclick="dPropContextAction(\'visible\',event)" aria-label="Ocultar camada" title="Ocultar camada">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>' +
      '</button>' +
      '<button type="button" class="dpi-context-action dpi-selection-action" id="dpi-context-lock" onclick="dPropContextAction(\'lock\',event)" aria-label="Bloquear camada" title="Bloquear camada">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>' +
      '</button>' +
      '<button type="button" class="dpi-context-action dpi-selection-action" onclick="dPropContextAction(\'duplicate\',event)" aria-label="Duplicar camada" title="Duplicar camada">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>' +
      '</button>' +
      '<span class="dpi-context-divider" aria-hidden="true"></span>' +
      '<button type="button" class="dpi-context-action" onclick="if(typeof gOpenHelp===\'function\')gOpenHelp(this)" aria-label="Abrir ajuda do Est\u00fadio" title="Ajuda do Est\u00fadio">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.5 2.15c-.85.45-1.3.95-1.3 1.85"/><path d="M12 17h.01"/></svg>' +
      '</button>' +
    '</div>';

  panel.insertBefore(header, props);
}

function dPropContextAction(action, ev) {
  if (ev) ev.stopPropagation();
  const id = typeof dSelId !== 'undefined' ? dSelId : null;
  if (!id) return;
  if (action === 'visible' && typeof dToggleVis === 'function') dToggleVis(ev, id);
  if (action === 'lock' && typeof dToggleLock === 'function') dToggleLock(ev, id);
  if (action === 'duplicate' && typeof dDuplicateSelectedLayer === 'function') dDuplicateSelectedLayer();
  window.setTimeout(dPropSyncInspectorFromState, 0);
}

function dPropSyncInspectorFromState() {
  const layer = (typeof dLayers !== 'undefined' && typeof dSelId !== 'undefined')
    ? dLayers.find(function(item) { return item.id === dSelId; })
    : null;
  dPropSyncInspectorContext(layer || null);
}

function dPropSyncInspectorContext(layer) {
  const right = document.getElementById('d-right');
  const context = document.getElementById('dpi-context');
  if (!right || !context) return;

  const icon = document.getElementById('dpi-context-icon');
  const kicker = document.getElementById('dpi-context-kicker');
  const name = document.getElementById('dpi-context-name');
  const meta = document.getElementById('dpi-context-meta');
  const visible = document.getElementById('dpi-context-visible');
  const lock = document.getElementById('dpi-context-lock');
  const composition = document.getElementById('dpi-composition-toggle');
  const contentLabel = document.querySelector('#dp-sec-content .dp-sec-label');

  right.classList.toggle('dpi-has-selection', !!layer);
  context.classList.toggle('has-selection', !!layer);
  if (composition) composition.disabled = !layer;

  if (layer) {
    const typeLabel = dPropLayerTypeLabel(layer.type);
    if (icon) icon.innerHTML = dPropLayerIcon(layer.type);
    if (kicker) kicker.textContent = typeLabel;
    if (name) name.textContent = layer.name || layer.content || 'Camada sem nome';
    if (meta) {
      meta.textContent = dPropWorkspaceMode() === 'essential'
        ? (layer.locked ? 'Posi\u00e7\u00e3o bloqueada' : 'Pronto para editar')
        : Math.round(layer.w || 0) + ' \u00d7 ' + Math.round(layer.h || 0) + ' px' + (layer.locked ? '  /  Bloqueada' : '');
    }
    if (visible) {
      visible.classList.toggle('is-active', layer.visible === false);
      visible.setAttribute('aria-pressed', String(layer.visible === false));
      visible.setAttribute('aria-label', layer.visible === false ? 'Mostrar camada' : 'Ocultar camada');
      visible.title = layer.visible === false ? 'Mostrar camada' : 'Ocultar camada';
    }
    if (lock) {
      lock.classList.toggle('is-active', !!layer.locked);
      lock.setAttribute('aria-pressed', String(!!layer.locked));
      lock.setAttribute('aria-label', layer.locked ? 'Desbloquear camada' : 'Bloquear camada');
      lock.title = layer.locked ? 'Desbloquear camada' : 'Bloquear camada';
    }
    if (contentLabel) contentLabel.textContent = (layer.type === 'image' || layer.type === 'frame') ? 'Imagem' : 'Conte\u00fado';
  } else {
    const ab = dPropActiveArtboard();
    if (icon) icon.innerHTML = DP_SECTION_ICONS['dp-sec-ab-size'];
    if (kicker) kicker.textContent = 'Arte';
    if (name) name.textContent = ab && ab.name ? ab.name : 'Arte';
    if (meta) {
      meta.textContent = dPropWorkspaceMode() === 'essential'
        ? 'Ajustes gerais do material'
        : (ab ? Math.round(ab.w || 0) + ' \u00d7 ' + Math.round(ab.h || 0) + ' px' : 'Configura\u00e7\u00f5es da arte');
    }
    if (contentLabel) contentLabel.textContent = 'Conte\u00fado';
  }

  dPropEnhanceDado(layer);
  dPropSyncDataContext(layer || null);
  dPropSyncImageSource();
  dPropSyncCanvasEmpty();
}

function dPropEnhanceDado(layer) {
  const box = document.getElementById('dp-dado');
  if (!box || !layer || box.style.display === 'none') return;
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', 'Conte\u00fado din\u00e2mico');

  const label = box.querySelector('.dp-dado-lbl');
  const highlight = label ? label.querySelector('.hl') : null;
  if (highlight) {
    const current = highlight.textContent || '';
    if (current.indexOf('Dado ligado') !== -1) highlight.textContent = 'Conte\u00fado conectado';
    else if (current.indexOf('Dado neste texto') !== -1) highlight.textContent = '1 campo din\u00e2mico';
    else if (current.indexOf('dados neste texto') !== -1) highlight.textContent = current.replace(/^.*?(\d+)\s+dados neste texto.*$/i, '$1 campos din\u00e2micos');
  } else if (label) {
    label.textContent = 'Conte\u00fado din\u00e2mico';
  }

  const none = box.querySelector('.dp-dado-none');
  if (none && none.textContent.indexOf('nenhum') !== -1) none.textContent = 'Conte\u00fado fixo';

  const picker = box.querySelector('.dp-dado-pick');
  if (picker) {
    picker.setAttribute('aria-label', box.classList.contains('bound') ? 'Alterar campo conectado' : 'Conectar a um campo din\u00e2mico');
    if (!picker.querySelector('.dpi-dado-icon')) {
      const dadoIcon = document.createElement('span');
      dadoIcon.className = 'dpi-dado-icon';
      dadoIcon.setAttribute('aria-hidden', 'true');
      dadoIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2"/></svg>';
      picker.insertBefore(dadoIcon, picker.firstChild);
    }
    const caret = picker.querySelector('.dp-dado-car');
    if (caret) caret.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>';
  }

  if (!box.classList.contains('bound') && !box.querySelector('.dpi-dado-hint')) {
    const hint = document.createElement('p');
    hint.className = 'dpi-dado-hint';
    hint.textContent = 'Conecte esta camada a um campo preenchido pelo franqueado.';
    box.appendChild(hint);
  }
}

function dPropBuildImageControls() {
  const imageProps = document.getElementById('d-image-props');
  const urlInput = document.getElementById('dp-imgurl');
  const fitSelect = document.getElementById('dp-imgfit');
  if (!imageProps || !urlInput || !fitSelect || document.getElementById('dpi-image-source')) return;

  const source = document.createElement('div');
  source.id = 'dpi-image-source';
  source.className = 'dpi-image-source';
  source.innerHTML =
    '<span class="dpi-field-label">Origem</span>' +
    '<div class="dpi-source-summary">' +
      '<span class="dpi-source-icon" aria-hidden="true">' + DP_SECTION_ICONS['dp-sec-content'] + '</span>' +
      '<span class="dpi-source-copy"><strong id="dpi-source-name">Imagem</strong><small id="dpi-source-meta"></small></span>' +
      '<button type="button" class="dpi-source-toggle" aria-expanded="false" aria-controls="dpi-source-raw">Ver origem</button>' +
    '</div>' +
    '<div class="dpi-source-raw" id="dpi-source-raw"></div>';
  imageProps.insertBefore(source, urlInput);
  source.querySelector('.dpi-source-raw').appendChild(urlInput);
  urlInput.setAttribute('aria-label', 'URL ou origem da imagem');

  const sourceToggle = source.querySelector('.dpi-source-toggle');
  sourceToggle.addEventListener('click', function() {
    const expanded = source.classList.toggle('is-expanded');
    sourceToggle.setAttribute('aria-expanded', String(expanded));
    sourceToggle.textContent = expanded ? 'Ocultar' : 'Ver origem';
    if (expanded) urlInput.focus();
  });
  urlInput.addEventListener('input', dPropSyncImageSource);

  const fitField = document.createElement('label');
  fitField.className = 'dpi-fit-field';
  fitField.innerHTML = '<span class="dpi-field-label">Ajuste no quadro</span>';
  imageProps.insertBefore(fitField, fitSelect);
  fitField.appendChild(fitSelect);
  fitSelect.setAttribute('aria-label', 'Ajuste da imagem no quadro');
  Array.from(fitSelect.options).forEach(function(option) {
    if (option.value === 'cover') option.textContent = 'Preencher quadro';
    if (option.value === 'contain') option.textContent = 'Ajustar imagem';
    if (option.value === 'fill') option.textContent = 'Esticar para preencher';
  });

  ['dp-img-brightness', 'dp-img-contrast', 'dp-img-saturate'].forEach(function(id) {
    const range = document.getElementById(id);
    if (!range || !range.parentElement) return;
    const row = range.parentElement;
    row.classList.add('dpi-range-row');
    const label = row.querySelector('span');
    if (label) label.classList.add('dpi-range-label');
    range.setAttribute('aria-label', label ? label.textContent.trim() : 'Ajuste da imagem');

    const output = document.createElement('output');
    output.className = 'dpi-range-value';
    output.htmlFor = id;
    row.appendChild(output);

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'dpi-range-reset';
    reset.title = 'Restaurar para zero';
    reset.setAttribute('aria-label', 'Restaurar ' + (label ? label.textContent.trim() : 'ajuste') + ' para zero');
    reset.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6"/><path d="M4 4v4.6h4.6"/></svg>';
    row.appendChild(reset);

    function syncValue() {
      const value = parseInt(range.value || '0', 10);
      output.value = value > 0 ? '+' + value : String(value);
      reset.disabled = value === 0;
    }
    range.addEventListener('input', syncValue);
    reset.addEventListener('click', function() {
      range.value = '0';
      range.dispatchEvent(new Event('input', { bubbles: true }));
    });
    syncValue();
  });
}

function dPropSyncImageSource() {
  const source = document.getElementById('dpi-image-source');
  const input = document.getElementById('dp-imgurl');
  const name = document.getElementById('dpi-source-name');
  const meta = document.getElementById('dpi-source-meta');
  if (!source || !input || !name || !meta) return;
  const value = String(input.value || '').trim();
  source.classList.toggle('is-empty', !value);

  if (!value) {
    name.textContent = 'Nenhuma imagem';
    meta.textContent = 'Adicione uma URL ou carregue um arquivo';
    return;
  }
  if (value.indexOf('data:') === 0) {
    const mime = (value.match(/^data:image\/([^;,]+)/i) || [])[1];
    name.textContent = 'Imagem incorporada';
    meta.textContent = mime ? mime.toUpperCase() + ' salvo no projeto' : 'Arquivo salvo no projeto';
    return;
  }
  if (value.indexOf('blob:') === 0 || value === '[arquivo local]') {
    name.textContent = 'Arquivo local';
    meta.textContent = 'Imagem carregada neste dispositivo';
    return;
  }
  try {
    const parsed = new URL(value);
    name.textContent = 'Imagem por URL';
    meta.textContent = parsed.hostname || 'Origem externa';
  } catch(e) {
    name.textContent = 'Origem personalizada';
    meta.textContent = 'Revise o endere\u00e7o informado';
  }
}

function dPropInitSectionsA11y() {
  document.querySelectorAll('#d-props-form .dp-section[id], #d-no-sel .dp-section[id]').forEach(function(section) {
    const head = section.querySelector('.dp-sec-head');
    const body = section.querySelector('.dp-sec-body');
    if (!head || !body) return;
    if (!body.id) body.id = section.id + '-body';
    head.setAttribute('aria-controls', body.id);
    head.setAttribute('aria-expanded', String(section.classList.contains('dp-section-open')));
    if (!head.querySelector('.dpi-sec-icon')) {
      const secIcon = document.createElement('span');
      secIcon.className = 'dpi-sec-icon';
      secIcon.setAttribute('aria-hidden', 'true');
      secIcon.innerHTML = DP_SECTION_ICONS[section.id] || DP_SECTION_ICONS['dp-sec-rules'];
      head.insertBefore(secIcon, head.firstChild);
    }
  });
}

function dPropSyncTabs(activeName) {
  const aliases = { camada: 'camadas', propriedades: 'camadas', conteudo: 'campaigns', variaveis: 'dados', vars: 'dados' };
  const active = aliases[activeName] || activeName || 'camadas';
  document.querySelectorAll('.d-rp-tab').forEach(function(tab) {
    const selected = tab.dataset.panel === active;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
}

function dPropInitTabs() {
  const tabs = document.querySelector('.d-rp-tabs');
  if (!tabs) return;
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Pain\u00e9is do Est\u00fadio');

  const panelIds = {
    camadas: 'd-panel-camada',
    dados: 'd-panel-dados',
    campaigns: 'd-panel-campaigns',
    linter: 'd-panel-linter'
  };

  const buttons = Array.from(tabs.querySelectorAll('.d-rp-tab'));
  buttons.forEach(function(tab) {
    const panelName = tab.dataset.panel;
    const label = tab.textContent.trim();
    tab.removeAttribute('style');
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panelIds[panelName] || 'd-panel-camada');
    if (!tab.querySelector('.dpi-tab-label')) {
      tab.textContent = '';
      const icon = document.createElement('span');
      icon.className = 'dpi-tab-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = DP_PANEL_ICONS[panelName] || DP_PANEL_ICONS.camadas;
      const text = document.createElement('span');
      text.className = 'dpi-tab-label';
      text.textContent = label;
      tab.appendChild(icon);
      tab.appendChild(text);
    }
    tab.addEventListener('keydown', function(event) {
      const current = buttons.indexOf(tab);
      let next = null;
      if (event.key === 'ArrowRight') next = (current + 1) % buttons.length;
      if (event.key === 'ArrowLeft') next = (current - 1 + buttons.length) % buttons.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = buttons.length - 1;
      if (next === null) return;
      event.preventDefault();
      buttons[next].focus();
      buttons[next].click();
    });
  });

  Object.keys(panelIds).forEach(function(name) {
    const panel = document.getElementById(panelIds[name]);
    const tab = document.querySelector('.d-rp-tab[data-panel="' + name + '"]');
    if (panel && tab) {
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tab.id);
    }
  });
  dPropSyncTabs(typeof dActivePanel !== 'undefined' ? dActivePanel : 'camadas');
}

function dPropUpdateLayersCount() {
  const count = document.getElementById('dpi-layers-count');
  const list = document.getElementById('d-layers-list');
  if (!count || !list) return;
  const rows = Array.from(list.querySelectorAll('.layer-row'));
  const visible = rows.length;
  const total = (typeof dLayers !== 'undefined' && Array.isArray(dLayers)) ? dLayers.length : visible;
  count.textContent = visible === total ? String(total) : visible + ' de ' + total;
  count.setAttribute('aria-label', total + (total === 1 ? ' camada' : ' camadas'));
  rows.forEach(function(row) {
    const selected = row.classList.contains('active');
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', String(selected));
    row.tabIndex = selected ? 0 : -1;
  });
}

function dPropInitLayersDock() {
  const section = document.getElementById('d-layers-section');
  const search = section ? section.querySelector('.d-layers-search-row') : null;
  if (!section || !search || document.getElementById('dpi-layers-head')) return;

  section.setAttribute('role', 'region');
  section.setAttribute('aria-labelledby', 'dpi-layers-title');
  const header = document.createElement('div');
  header.id = 'dpi-layers-head';
  header.className = 'dpi-layers-head';
  header.innerHTML =
    '<div class="dpi-layers-heading">' +
      '<span class="dpi-layers-kicker">Estrutura</span>' +
      '<span class="dpi-layers-title-row"><strong id="dpi-layers-title">Camadas</strong><span id="dpi-layers-count" class="dpi-layers-count">0</span></span>' +
    '</div>' +
    '<div class="dpi-layers-actions">' +
      '<button type="button" class="dpi-layers-action" id="dpi-composition-toggle" aria-expanded="false" aria-controls="d-blend-section" title="Mesclagem, opacidade e bloqueios">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>' +
      '</button>' +
      '<button type="button" class="dpi-layers-action" id="dpi-layers-collapse" aria-expanded="true" aria-controls="d-layers-tree-wrapper" title="Recolher camadas">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 14 5-5 5 5"/></svg>' +
      '</button>' +
    '</div>';
  section.insertBefore(header, search);

  const right = document.getElementById('d-right');
  const collapse = document.getElementById('dpi-layers-collapse');
  const composition = document.getElementById('dpi-composition-toggle');

  function setCollapsed(collapsed, persist) {
    section.classList.toggle('dpi-layers-collapsed', collapsed);
    if (right) right.classList.toggle('dpi-layers-is-collapsed', collapsed);
    collapse.setAttribute('aria-expanded', String(!collapsed));
    collapse.title = collapsed ? 'Expandir camadas' : 'Recolher camadas';
    if (persist) {
      try { sessionStorage.setItem(DP_LAYERS_COLLAPSED_KEY, collapsed ? '1' : '0'); } catch(e) {}
    }
  }

  function setComposition(open, persist) {
    section.classList.toggle('dpi-composition-open', open);
    composition.classList.toggle('is-active', open);
    composition.setAttribute('aria-expanded', String(open));
    if (persist) {
      try { sessionStorage.setItem(DP_COMPOSITION_OPEN_KEY, open ? '1' : '0'); } catch(e) {}
    }
  }

  collapse.addEventListener('click', function() {
    setCollapsed(!section.classList.contains('dpi-layers-collapsed'), true);
  });
  composition.addEventListener('click', function() {
    if (composition.disabled) return;
    setComposition(!section.classList.contains('dpi-composition-open'), true);
  });

  try {
    setCollapsed(sessionStorage.getItem(DP_LAYERS_COLLAPSED_KEY) === '1', false);
    setComposition(sessionStorage.getItem(DP_COMPOSITION_OPEN_KEY) === '1', false);
  } catch(e) {
    setCollapsed(false, false);
    setComposition(false, false);
  }

  search.querySelector('input').setAttribute('aria-label', 'Buscar camadas');
  const filter = search.querySelector('.d-layers-filter-btn');
  if (filter) filter.setAttribute('aria-label', 'Filtrar camadas');
  section.querySelectorAll('.d-lyr-tb-btn').forEach(function(button) {
    if (!button.getAttribute('aria-label')) button.setAttribute('aria-label', button.title || 'A\u00e7\u00e3o de camada');
  });

  const list = document.getElementById('d-layers-list');
  if (list) {
    function keepOrganizeView() {
      const rightPanel = document.getElementById('d-right');
      if (!rightPanel || rightPanel.dataset.dpiView !== 'organize') return;
      rightPanel.dataset.dpiKeepOrganize = '1';
      window.setTimeout(function() {
        delete rightPanel.dataset.dpiKeepOrganize;
      }, 0);
    }

    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Camadas da prancheta');
    list.setAttribute('aria-multiselectable', 'true');
    list.addEventListener('pointerdown', function(event) {
      if (event.target.closest('.layer-row')) keepOrganizeView();
    }, true);
    list.addEventListener('keydown', function(event) {
      const rows = Array.from(list.querySelectorAll('.layer-row'));
      if (!rows.length) return;
      const current = rows.indexOf(document.activeElement);
      let target = null;
      if (event.key === 'ArrowDown') target = Math.min(rows.length - 1, current < 0 ? 0 : current + 1);
      if (event.key === 'ArrowUp') target = Math.max(0, current < 0 ? rows.length - 1 : current - 1);
      if (event.key === 'Home') target = 0;
      if (event.key === 'End') target = rows.length - 1;
      if (target !== null) {
        event.preventDefault();
        keepOrganizeView();
        rows[target].focus();
        rows[target].click();
        return;
      }
      if ((event.key === 'Enter' || event.key === ' ') && current >= 0) {
        event.preventDefault();
        keepOrganizeView();
        rows[current].click();
      }
    });
    list.addEventListener('click', function(event) {
      const row = event.target.closest('.layer-row');
      const layerId = row ? row.dataset.lid : null;
      if (layerId) window.setTimeout(function() {
        const nextRow = Array.from(list.querySelectorAll('.layer-row')).find(function(item) {
          return item.dataset.lid === layerId;
        });
        if (nextRow) nextRow.focus();
      }, 0);
    });
    new MutationObserver(function() {
      dPropUpdateLayersCount();
      dPropSyncInspectorFromState();
    }).observe(list, { childList: true });
  }
  dPropUpdateLayersCount();
}

/* --------------------------------------------------------------------------
   Data hub enhancements
   The field renderer stays in layers.js; this layer only improves orientation
   and keyboard access after each render so the field engine remains single.
   -------------------------------------------------------------------------- */

const DP_DATA_CATEGORY_ICONS = {
  produto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z"/><path d="m4 12 8 4.5 8-4.5"/><path d="m4 16.5 8 4.5 8-4.5"/></svg>',
  preco: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13.5 13.5 20a2.1 2.1 0 0 1-3 0L4 13.5V4h9.5L20 10.5a2.1 2.1 0 0 1 0 3Z"/><circle cx="8.5" cy="8.5" r="1"/></svg>',
  campanha: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>',
  midia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></svg>',
  outros: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8h.01M12 12v4"/></svg>'
};

let dPropDataProblemsOnly = false;

const DP_DATA_STARTER_FIELDS = [
  { name: 'produto', label: 'Produto', type: 'text', required: true, category: 'produto' },
  { name: 'foto_produto', label: 'Foto do produto', type: 'image', required: false, category: 'midia' },
  { name: 'precoPor', label: 'Pre\u00e7o da oferta', type: 'currency', required: true, category: 'preco' },
  { name: 'precoDe', label: 'Pre\u00e7o original', type: 'currency', required: false, category: 'preco' },
  { name: 'validade', label: 'Validade', type: 'text', required: false, category: 'campanha' }
];

const DP_DATA_ALIASES = [
  ['produto', 'item', 'lanche', 'combo', 'prato', 'nome'],
  ['foto', 'imagem', 'produto', 'photo', 'picture'],
  ['preco', 'valor', 'oferta', 'promo', 'promocao', 'por'],
  ['original', 'antes', 'de', 'preco antigo'],
  ['desconto', 'off', 'economia'],
  ['validade', 'data', 'periodo', 'ate'],
  ['cupom', 'codigo', 'voucher'],
  ['logo', 'marca', 'logomarca'],
  ['chamada', 'titulo', 'headline', 'destaque'],
  ['descricao', 'detalhes', 'texto', 'observacao']
];

function dPropDataNormalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\{\{|\}\}/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function dPropDataAliasGroup(value) {
  const normalized = dPropDataNormalize(value);
  if (!normalized) return -1;
  return DP_DATA_ALIASES.findIndex(function(group) {
    return group.some(function(alias) {
      const cleanAlias = dPropDataNormalize(alias);
      return normalized === cleanAlias ||
        (cleanAlias.length > 3 && normalized.indexOf(cleanAlias) !== -1);
    });
  });
}

function dPropDataBoundNames(layer) {
  if (!layer) return [];
  if (typeof dLayerBoundField === 'function') {
    const bound = dLayerBoundField(layer);
    if (bound) return [bound];
  }
  if (typeof dLayerEmbeddedFields === 'function') return dLayerEmbeddedFields(layer);
  return [];
}

function dPropDataSuggestedField(layer) {
  if (!layer || typeof dVars === 'undefined' || !Array.isArray(dVars)) return null;
  const compatible = dVars.filter(function(field) { return dPropDataFieldFitsLayer(field, layer); });
  if (!compatible.length) return null;

  const source = [layer.name || '', layer.type === 'text' ? layer.content || '' : ''].join(' ');
  const sourceNorm = dPropDataNormalize(source);
  const sourceCompact = sourceNorm.replace(/\s+/g, '');
  const sourceWords = sourceNorm.split(/\s+/).filter(function(word) { return word.length > 2; });
  let parserHint = '';
  try {
    if (layer.type === 'text' && typeof _dPsdSuggestVar === 'function') {
      parserHint = (_dPsdSuggestVar(layer.name || '', layer.content || '') || {}).name || '';
    } else if ((layer.type === 'image' || layer.type === 'frame') && typeof _dPsdSuggestImgVar === 'function') {
      parserHint = (_dPsdSuggestImgVar(layer.name || '') || {}).name || '';
    }
  } catch (error) {
    parserHint = '';
  }

  let best = null;
  let bestScore = 0;
  compatible.forEach(function(field) {
    const fieldNorm = dPropDataNormalize((field.label || '') + ' ' + (field.name || ''));
    const fieldCompact = fieldNorm.replace(/\s+/g, '');
    const fieldWords = fieldNorm.split(/\s+/).filter(function(word) { return word.length > 2; });
    let score = 0;

    if (parserHint && field.name === parserHint) score += 120;
    if (sourceCompact && fieldCompact && (sourceCompact === fieldCompact || sourceCompact === dPropDataNormalize(field.name).replace(/\s+/g, ''))) {
      score += 100;
    }
    if (sourceNorm && fieldNorm && (
      (fieldCompact.length > 3 && sourceCompact.indexOf(fieldCompact) !== -1) ||
      (sourceCompact.length > 3 && fieldCompact.indexOf(sourceCompact) !== -1)
    )) score += 65;

    const overlap = fieldWords.filter(function(word) { return sourceWords.indexOf(word) !== -1; }).length;
    score += overlap * 22;

    const sourceAlias = dPropDataAliasGroup(source);
    const fieldAlias = dPropDataAliasGroup((field.label || '') + ' ' + (field.name || ''));
    if (sourceAlias >= 0 && sourceAlias === fieldAlias) score += 58;
    if (field.type === 'image' && /foto|imagem|logo|marca|photo|picture/.test(sourceNorm)) score += 24;

    if (score > bestScore) {
      best = field;
      bestScore = score;
    }
  });
  return bestScore >= 40 ? best : null;
}

function dPropDataSelectedLayer() {
  if (typeof dLayers === 'undefined' || !Array.isArray(dLayers) || typeof dSelId === 'undefined') return null;
  return dLayers.find(function(layer) { return layer.id === dSelId; }) || null;
}

function dPropDataFieldIndex(name) {
  if (typeof dVars === 'undefined' || !Array.isArray(dVars)) return -1;
  return dVars.findIndex(function(field) { return field.name === name; });
}

function dPropDataFieldFitsLayer(field, layer) {
  if (!field || !layer) return false;
  if (field.type === 'image') return layer.type === 'image' || layer.type === 'frame';
  return layer.type === 'text';
}

function dPropDataProblemCount() {
  if (typeof _dFieldsDup === 'undefined' || !_dFieldsDup) return 0;
  return Object.keys(_dFieldsDup).length;
}

function dPropLocateField(name) {
  if (typeof dFieldUsageLayers !== 'function') return;
  const usage = dFieldUsageLayers(name);
  if (!usage.length) return;
  usage.forEach(function(layer) {
    if (typeof dFieldFlashLayer === 'function') dFieldFlashLayer(layer.id);
  });
  if (typeof gToast === 'function') {
    gToast(usage.length === 1 ? 'Campo destacado na arte' : usage.length + ' elementos destacados na arte');
  }
}

function dPropCompareField(name) {
  const index = dPropDataFieldIndex(name);
  const field = index >= 0 && typeof dVars !== 'undefined' ? dVars[index] : null;
  if (!field || typeof dFieldsFilter !== 'function') return;
  const query = field.label || field.name;
  const search = document.getElementById('d-fields-search');
  if (search) search.value = query;
  dPropDataProblemsOnly = true;
  if (typeof dFieldSetStatusFilter === 'function') dFieldSetStatusFilter('all');
  dFieldsFilter(query);
  if (typeof gToast === 'function') gToast('Mostrando campos com o mesmo nome');
}

function dPropSetDataProblemsFilter(active) {
  dPropDataProblemsOnly = !!active;
  if (active && typeof dFieldSetStatusFilter === 'function') {
    dFieldSetStatusFilter('all');
    return;
  }
  if (typeof dFieldsRender === 'function') dFieldsRender();
}

function dPropDataCategoryKey(label) {
  const normalized = String(label || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (normalized.indexOf('produto') !== -1) return 'produto';
  if (normalized.indexOf('preco') !== -1) return 'preco';
  if (normalized.indexOf('campanha') !== -1) return 'campanha';
  if (normalized.indexOf('midia') !== -1) return 'midia';
  return 'outros';
}

function dPropDataUseSuggestion(fieldName) {
  const layer = dPropDataSelectedLayer();
  const index = dPropDataFieldIndex(fieldName);
  const field = index >= 0 && typeof dVars !== 'undefined' ? dVars[index] : null;
  if (!layer || !field || !dPropDataFieldFitsLayer(field, layer)) return;
  if (typeof dLayerBindField === 'function') dLayerBindField(layer.id, field.name);
  dPropSyncDataContext(layer);
}

function dPropDataCreateForSelection() {
  const layer = dPropDataSelectedLayer();
  if (!layer || !dPropDataFieldFitsLayer({ type: layer.type === 'text' ? 'text' : 'image' }, layer)) {
    if (typeof gToast === 'function') gToast('Selecione um texto ou uma imagem primeiro');
    return;
  }
  const genericNames = /^(texto|imagem|moldura|frame|layer|camada)(\s+\d+)?$/i;
  const layerName = String(layer.name || '').trim();
  const opts = { forLayer: layer.id };
  if (layerName && !genericNames.test(layerName)) opts.label = layerName;
  if (typeof dOpenVarModal === 'function') dOpenVarModal(opts);
}

function dPropDataChooseExisting() {
  const search = document.getElementById('d-fields-search');
  if (!search) return;
  search.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  window.setTimeout(function() {
    search.focus();
    search.select();
  }, 180);
}

function dPropDataLocateSelection() {
  const layer = dPropDataSelectedLayer();
  if (layer && typeof dFieldFlashLayer === 'function') dFieldFlashLayer(layer.id);
}

function dPropDataSetContextActions(actions) {
  const container = document.getElementById('dpi-data-context-actions');
  if (!container) return;
  container.innerHTML = '';
  actions.forEach(function(action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = action.primary ? 'dpi-data-context-action is-primary' : 'dpi-data-context-action';
    button.textContent = action.label;
    button.setAttribute('aria-label', action.ariaLabel || action.label);
    button.addEventListener('click', action.onClick);
    container.appendChild(button);
  });
}

function dPropDataAddStarterFields() {
  if (typeof dVars === 'undefined' || !Array.isArray(dVars)) return;
  const existingNames = dVars.map(function(field) { return dPropDataNormalize(field.name); });
  const existingLabels = dVars.map(function(field) { return dPropDataNormalize(field.label); });
  const added = [];

  DP_DATA_STARTER_FIELDS.forEach(function(field) {
    if (existingNames.indexOf(dPropDataNormalize(field.name)) !== -1 ||
        existingLabels.indexOf(dPropDataNormalize(field.label)) !== -1) return;
    const next = {
      name: field.name,
      label: field.label,
      type: field.type,
      required: field.required,
      category: field.category
    };
    dVars.push(next);
    existingNames.push(dPropDataNormalize(next.name));
    existingLabels.push(dPropDataNormalize(next.label));
    added.push(next);
  });

  if (!added.length) {
    if (typeof gToast === 'function') gToast('Os campos essenciais j\u00e1 est\u00e3o nesta arte');
    return;
  }
  if (typeof dVarsRender === 'function') dVarsRender();
  if (typeof dPersistVars === 'function') dPersistVars();
  if (typeof dMarkUnsaved === 'function') dMarkUnsaved();
  dPropSyncDataIntro();
  if (typeof gToast === 'function') {
    gToast(added.length + (added.length === 1 ? ' campo essencial adicionado' : ' campos essenciais adicionados'));
  }
}

function dPropDataOpenSimulation(mode) {
  const used = typeof dSimUsedVars === 'function' ? dSimUsedVars() : [];
  if (!used.length) {
    if (typeof gToast === 'function') gToast('Conecte pelo menos um conte\u00fado antes de testar');
    return;
  }
  if (typeof dOpenSimModal !== 'function') return;
  dOpenSimModal();
  if (mode && typeof dSimStressTest === 'function') {
    window.setTimeout(function() { dSimStressTest(mode); }, 80);
  }
}

function dPropDataHighlightAll() {
  if (typeof dVars === 'undefined' || !Array.isArray(dVars) || typeof dVarUsage !== 'function') return;
  const ids = [];
  dVars.forEach(function(field) {
    dVarUsage(field.name).forEach(function(id) {
      if (ids.indexOf(id) === -1) ids.push(id);
    });
  });
  if (!ids.length) {
    if (typeof gToast === 'function') gToast('Nenhum conte\u00fado conectado ainda');
    return;
  }
  ids.forEach(function(id) {
    const element = document.querySelector('.canvas-layer[data-id="' + id + '"]');
    if (!element) return;
    element.classList.remove('var-flash');
    void element.offsetWidth;
    element.classList.add('var-flash');
    window.setTimeout(function() { element.classList.remove('var-flash'); }, 1400);
  });
  if (typeof gToast === 'function') {
    gToast(ids.length === 1 ? 'Conte\u00fado edit\u00e1vel destacado' : ids.length + ' conte\u00fados edit\u00e1veis destacados');
  }
}

function dPropBuildDataTools() {
  const panel = document.getElementById('d-panel-dados');
  const list = document.getElementById('d-fields-list');
  if (!panel || !list || document.getElementById('dpi-data-tools')) return;
  const tools = document.createElement('details');
  tools.id = 'dpi-data-tools';
  tools.className = 'dpi-data-tools';
  tools.innerHTML =
    '<summary>' +
      '<span class="dpi-data-tools-icon" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m8 12 2.5 2.5L16 9"/><circle cx="12" cy="12" r="9"/></svg>' +
      '</span>' +
      '<span><strong>Conferir a experi\u00eancia</strong><small id="dpi-data-tools-status">Veja o que o franqueado vai editar.</small></span>' +
      '<svg class="dpi-data-tools-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>' +
    '</summary>' +
    '<div class="dpi-data-tools-body">' +
      '<button type="button" data-data-tool="preview">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>' +
        '<span><strong>Ver como franqueado</strong><small>Preencha uma c\u00f3pia sem alterar a arte.</small></span>' +
      '</button>' +
      '<button type="button" data-data-tool="stress">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M4 5h16M8 5v14M5 19h6M14 14l3-3 3 3"/></svg>' +
        '<span><strong>Testar textos longos</strong><small>Encontre estouros antes de publicar.</small></span>' +
      '</button>' +
      '<button type="button" data-data-tool="highlight">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><circle cx="12" cy="12" r="3"/></svg>' +
        '<span><strong>Mostrar na arte</strong><small>Destaque tudo que poder\u00e1 mudar.</small></span>' +
      '</button>' +
    '</div>';
  tools.addEventListener('click', function(event) {
    const button = event.target.closest('[data-data-tool]');
    if (!button) return;
    const action = button.dataset.dataTool;
    if (action === 'preview') dPropDataOpenSimulation();
    if (action === 'stress') dPropDataOpenSimulation('max');
    if (action === 'highlight') dPropDataHighlightAll();
  });
  panel.insertBefore(tools, list);
}

function dPropSyncDataTools() {
  const status = document.getElementById('dpi-data-tools-status');
  if (!status || typeof dVars === 'undefined' || !Array.isArray(dVars)) return;
  const used = typeof dVarUsage === 'function'
    ? dVars.filter(function(field) { return dVarUsage(field.name).length > 0; }).length
    : 0;
  const free = Math.max(0, dVars.length - used);
  if (!dVars.length) status.textContent = 'Comece com um conjunto pronto ou crie um campo.';
  else if (!free) status.textContent = 'Tudo conectado. Fa\u00e7a um teste antes de publicar.';
  else status.textContent = used + ' conectado' + (used === 1 ? '' : 's') + ' e ' + free + ' ' + (free === 1 ? 'dispon\u00edvel' : 'dispon\u00edveis') + '.';
}

function dPropBuildDataIntro() {
  const panel = document.getElementById('d-panel-dados');
  const toolbar = panel ? panel.querySelector('.dados-toolbar') : null;
  if (!panel || !toolbar || document.getElementById('dpi-data-intro')) return;

  const intro = document.createElement('div');
  intro.id = 'dpi-data-intro';
  intro.className = 'dpi-data-intro';
  intro.innerHTML =
    '<span class="dpi-data-intro-icon" aria-hidden="true">' + DP_PANEL_ICONS.dados + '</span>' +
    '<span class="dpi-data-intro-copy">' +
      '<strong>Campos da arte</strong>' +
      '<small id="dpi-data-summary" aria-live="polite">Defina o que o franqueado poder\u00e1 alterar.</small>' +
    '</span>' +
    '<span class="dpi-data-total" id="dpi-data-total" aria-label="0 campos">0</span>';
  panel.insertBefore(intro, toolbar);

  const context = document.createElement('div');
  context.id = 'dpi-data-context';
  context.className = 'dpi-data-context';
  context.setAttribute('role', 'group');
  context.setAttribute('aria-label', 'Pr\u00f3ximo passo');
  context.innerHTML =
    '<span class="dpi-data-context-icon" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m4 3 7 17 2.2-6.8L20 11 4 3Z"/></svg>' +
    '</span>' +
    '<span class="dpi-data-context-copy" aria-live="polite">' +
      '<strong id="dpi-data-context-title">Selecione um texto ou uma imagem</strong>' +
      '<small id="dpi-data-context-detail">Depois escolha o campo que deseja usar.</small>' +
    '</span>' +
    '<span class="dpi-data-context-actions" id="dpi-data-context-actions"></span>';
  panel.insertBefore(context, toolbar);

  toolbar.setAttribute('role', 'search');
  toolbar.setAttribute('aria-label', 'Buscar ou criar campo');
  const search = toolbar.querySelector('#d-fields-search');
  if (search) {
    search.placeholder = 'Buscar campos';
    search.setAttribute('aria-label', 'Buscar campos por nome, tipo ou categoria');
  }
  const create = toolbar.querySelector('.dados-new-btn');
  if (create) {
    create.setAttribute('aria-label', 'Criar novo campo');
    create.title = 'Criar novo campo';
    if (!create.querySelector('.dpi-new-label')) {
      Array.from(create.childNodes).forEach(function(node) {
        if (node.nodeType === Node.TEXT_NODE) node.nodeValue = '';
      });
      const label = document.createElement('span');
      label.className = 'dpi-new-label';
      label.textContent = 'Novo';
      create.appendChild(label);
    }
  }
  const chips = panel.querySelector('.dados-chipbar');
  if (chips) {
    chips.setAttribute('role', 'group');
    chips.setAttribute('aria-label', 'Filtrar campos');
  }
}

function dPropSyncDataIntro() {
  const total = document.getElementById('dpi-data-total');
  const summary = document.getElementById('dpi-data-summary');
  if (!total || !summary) return;
  const fields = (typeof dVars !== 'undefined' && Array.isArray(dVars)) ? dVars : [];
  const totalFields = fields.length;
  const used = (typeof dVarUsage === 'function')
    ? fields.filter(function(field) { return dVarUsage(field.name).length > 0; }).length
    : 0;
  total.textContent = totalFields ? used + '/' + totalFields : '0';
  total.setAttribute('aria-label', used + ' de ' + totalFields + (totalFields === 1 ? ' campo na arte' : ' campos na arte'));
  if (!totalFields) {
    summary.textContent = 'Crie o primeiro campo que poder\u00e1 ser alterado.';
  } else {
    summary.textContent = 'Defina o que o franqueado poder\u00e1 alterar.';
  }
  dPropSyncDataTools();
}

function dPropSyncDataContext(layer) {
  const context = document.getElementById('dpi-data-context');
  const title = document.getElementById('dpi-data-context-title');
  const detail = document.getElementById('dpi-data-context-detail');
  if (!context || !title || !detail) return;

  const compatible = !!(layer && (layer.type === 'text' || layer.type === 'image' || layer.type === 'frame'));
  context.classList.toggle('is-ready', compatible);
  context.classList.remove('is-suggested', 'is-connected');
  if (!compatible) {
    title.textContent = 'Selecione um texto ou uma imagem';
    detail.textContent = 'O Luma indicar\u00e1 o pr\u00f3ximo passo.';
    dPropDataSetContextActions([]);
  } else {
    const boundNames = dPropDataBoundNames(layer);
    const boundField = boundNames.length === 1 && typeof dVars !== 'undefined'
      ? dVars.find(function(field) { return field.name === boundNames[0]; })
      : null;
    const suggestion = !boundNames.length ? dPropDataSuggestedField(layer) : null;
    if (boundNames.length) {
      context.classList.add('is-connected');
      title.textContent = 'Pronto para ser personalizado';
      if (boundNames.length === 1) {
        detail.textContent = 'O franqueado editar\u00e1 \u201c' + ((boundField && (boundField.label || boundField.name)) || boundNames[0]) + '\u201d sem mexer no layout.';
      } else {
        detail.textContent = boundNames.length + ' informa\u00e7\u00f5es deste texto poder\u00e3o ser alteradas.';
      }
      dPropDataSetContextActions([
        { label: 'Mostrar', ariaLabel: 'Destacar este conte\u00fado na arte', onClick: dPropDataLocateSelection },
        { label: 'Trocar', ariaLabel: 'Escolher outro conte\u00fado edit\u00e1vel', onClick: dPropDataChooseExisting }
      ]);
    } else if (suggestion) {
      context.classList.add('is-suggested');
      title.textContent = 'Sugest\u00e3o: ' + (suggestion.label || suggestion.name);
      detail.textContent = 'Conecte com um clique ou escolha outra op\u00e7\u00e3o.';
      dPropDataSetContextActions([
        {
          label: 'Usar sugest\u00e3o',
          ariaLabel: 'Usar ' + (suggestion.label || suggestion.name) + ' neste conte\u00fado',
          primary: true,
          onClick: function() { dPropDataUseSuggestion(suggestion.name); }
        },
        { label: 'Outra op\u00e7\u00e3o', onClick: dPropDataChooseExisting }
      ]);
    } else {
      const kind = layer.type === 'text' ? 'texto' : 'imagem';
      title.textContent = 'O que poder\u00e1 mudar aqui?';
      detail.textContent = 'Transforme este ' + kind + ' em um conte\u00fado edit\u00e1vel.';
      dPropDataSetContextActions([
        { label: 'Tornar edit\u00e1vel', primary: true, onClick: dPropDataCreateForSelection },
        { label: 'Usar existente', onClick: dPropDataChooseExisting }
      ]);
    }
  }
  dPropRefreshDataActions(layer || null);
}

function dPropRefreshDataActions(layer) {
  const list = document.getElementById('d-fields-list');
  if (!list || typeof dVars === 'undefined' || !Array.isArray(dVars)) return;

  list.querySelectorAll('.field-item[data-field]').forEach(function(item) {
    const index = dPropDataFieldIndex(item.dataset.field);
    const field = index >= 0 ? dVars[index] : null;
    const action = item.querySelector('.dpi-field-primary-action');
    if (!field || !action) return;

    const usage = typeof dFieldUsageLayers === 'function' ? dFieldUsageLayers(field.name) : [];
    const usedHere = !!(layer && usage.some(function(place) { return place.id === layer.id; }));
    const fits = dPropDataFieldFitsLayer(field, layer);

    item.classList.toggle('is-compatible', fits && !usedHere);
    action.classList.toggle('is-locate', !fits && usage.length > 0);
    action.classList.toggle('is-current', usedHere);
    action.disabled = usedHere || (!fits && !usage.length);
    if (usedHere) {
      if (action.textContent !== 'Conectado') action.textContent = 'Conectado';
      action.setAttribute('aria-label', (field.label || field.name) + ' j\u00e1 est\u00e1 conectado a este elemento');
    } else if (fits) {
      if (action.textContent !== 'Usar') action.textContent = 'Usar';
      action.setAttribute('aria-label', 'Usar o campo ' + (field.label || field.name) + ' neste elemento');
    } else if (usage.length) {
      if (action.textContent !== 'Ver na arte') action.textContent = 'Ver na arte';
      action.setAttribute('aria-label', 'Localizar o campo ' + (field.label || field.name) + ' na arte');
    } else {
      if (action.textContent !== 'Usar') action.textContent = 'Usar';
      action.setAttribute('aria-label', 'Selecione um elemento compat\u00edvel antes de usar ' + (field.label || field.name));
    }
  });

  list.querySelectorAll('.field-cat').forEach(function(category) {
    category.classList.toggle('has-compatible-fields', !!category.querySelector('.field-item.is-compatible:not([hidden])'));
  });
}

function dPropEnhanceDataFilters(list) {
  const chipbar = document.getElementById('d-fields-chipbar');
  if (!chipbar || !list) return;

  const labels = ['Todos', 'Na arte', 'Dispon\u00edveis'];
  Array.from(chipbar.querySelectorAll('.field-chip:not(.dpi-problems-chip)')).forEach(function(chip, index) {
    const count = chip.querySelector('span');
    if (labels[index]) {
      Array.from(chip.childNodes).forEach(function(node) {
        if (node.nodeType === Node.TEXT_NODE) node.nodeValue = labels[index] + ' ';
      });
    }
    chip.setAttribute('aria-pressed', String(chip.classList.contains('on') && !dPropDataProblemsOnly));
    if (!chip.dataset.dpiProblemsReset) {
      chip.dataset.dpiProblemsReset = 'true';
      chip.addEventListener('click', function() { dPropDataProblemsOnly = false; }, true);
    }
    if (count) count.setAttribute('aria-hidden', 'true');
  });

  const problems = dPropDataProblemCount();
  let problemsChip = chipbar.querySelector('.dpi-problems-chip');
  if (problems && !problemsChip) {
    problemsChip = document.createElement('button');
    problemsChip.type = 'button';
    problemsChip.className = 'field-chip dpi-problems-chip';
    problemsChip.addEventListener('click', function() {
      dPropSetDataProblemsFilter(!dPropDataProblemsOnly);
    });
    chipbar.appendChild(problemsChip);
  }
  if (problemsChip) {
    problemsChip.hidden = !problems;
    problemsChip.classList.toggle('on', dPropDataProblemsOnly);
    problemsChip.setAttribute('aria-pressed', String(dPropDataProblemsOnly));
    problemsChip.setAttribute('aria-label', problems + (problems === 1 ? ' campo com problema' : ' campos com problemas'));
    const problemsMarkup = 'Problemas <span aria-hidden="true">' + problems + '</span>';
    if (problemsChip.innerHTML !== problemsMarkup) problemsChip.innerHTML = problemsMarkup;
  }

  let visibleProblems = 0;
  list.querySelectorAll('.field-item[data-field]').forEach(function(item) {
    const hasProblem = !!item.querySelector('.field-row-warn');
    item.hidden = dPropDataProblemsOnly && !hasProblem;
    if (hasProblem) visibleProblems += 1;
  });

  list.querySelectorAll('.field-cat').forEach(function(category) {
    const visible = Array.from(category.querySelectorAll('.field-item[data-field]')).filter(function(item) { return !item.hidden; });
    category.hidden = dPropDataProblemsOnly && !visible.length;
    const count = category.querySelector('.field-cat-count');
    if (count && dPropDataProblemsOnly && count.textContent !== String(visible.length)) count.textContent = String(visible.length);
  });

  let empty = list.querySelector('.dpi-data-problems-empty');
  if (dPropDataProblemsOnly && !visibleProblems && !empty) {
    empty = document.createElement('div');
    empty.className = 'dpi-data-problems-empty';
    empty.innerHTML =
      '<span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="m5 12 4 4L19 6"/></svg></span>' +
      '<strong>Nenhum problema encontrado</strong>';
    list.appendChild(empty);
  }
  if (empty) empty.hidden = !dPropDataProblemsOnly || !!visibleProblems;
}

function dPropEnhanceDataRows() {
  const list = document.getElementById('d-fields-list');
  if (!list) return;

  const emptyIcon = list.querySelector('.field-empty-icon');
  if (emptyIcon && !emptyIcon.querySelector('svg')) {
    emptyIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H10l2 2h5.5A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z"/><path d="M9 12h6M12 9v6"/></svg>';
  }
  const empty = list.querySelector('.field-empty');
  if (empty && !empty.querySelector('.dpi-data-starter')) {
    const examples = empty.querySelector('.field-empty-exs');
    if (examples) examples.remove();
    const title = empty.querySelector('.field-empty-title');
    if (title) title.textContent = 'Escolha o que o franqueado poder\u00e1 trocar sem mexer no layout.';
    const starter = document.createElement('div');
    starter.className = 'dpi-data-starter';
    starter.innerHTML =
      '<button type="button" class="dpi-data-starter-primary">Adicionar campos essenciais</button>' +
      '<small>Produto, foto, pre\u00e7os e validade.</small>';
    starter.querySelector('button').addEventListener('click', dPropDataAddStarterFields);
    const createFirst = empty.querySelector('.d-btn-pri');
    if (createFirst) {
      createFirst.textContent = 'Criar um por vez';
      createFirst.classList.add('dpi-data-starter-secondary');
      empty.insertBefore(starter, createFirst);
    } else {
      empty.appendChild(starter);
    }
  }

  list.querySelectorAll('.field-cat').forEach(function(category, index) {
    const head = category.querySelector('.field-cat-head');
    const body = category.querySelector('.field-cat-body');
    const label = category.querySelector('.field-cat-label');
    if (!head || !body || !label) return;
    const key = dPropDataCategoryKey(label.textContent);
    category.dataset.category = key;
    if (!body.id) body.id = 'dpi-field-category-' + index;
    head.setAttribute('role', 'button');
    head.tabIndex = 0;
    head.setAttribute('aria-controls', body.id);
    head.setAttribute('aria-expanded', String(body.style.display !== 'none'));
    if (!head.querySelector('.dpi-data-category-icon')) {
      const icon = document.createElement('span');
      icon.className = 'dpi-data-category-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = DP_DATA_CATEGORY_ICONS[key];
      head.insertBefore(icon, label);
      head.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          head.click();
        }
      });
    }
  });

  const selectedLayer = dPropDataSelectedLayer();
  list.querySelectorAll('.field-row').forEach(function(row) {
    const item = row.closest('.field-item');
    const fieldName = item ? item.dataset.field : '';
    const fieldIndex = dPropDataFieldIndex(fieldName);
    const field = fieldIndex >= 0 && typeof dVars !== 'undefined' ? dVars[fieldIndex] : null;
    const name = row.querySelector('.field-row-name .nm');
    const meta = row.querySelector('.field-row-meta');
    const end = row.querySelector('.field-row-end');
    const used = !!row.querySelector('.field-sdot.used');
    const label = name ? name.textContent.trim() : 'Campo';
    const warning = row.querySelector('.field-row-warn');
    if (warning) {
      warning.setAttribute('aria-hidden', 'true');
      warning.removeAttribute('title');
    }
    row.setAttribute('role', 'group');
    row.removeAttribute('tabindex');
    row.setAttribute('aria-label', label + (used ? ', na arte.' : ', dispon\u00edvel.') + (warning ? ' Poss\u00edvel duplicata.' : ''));

    let toggle = row.querySelector('.dpi-field-toggle');
    const currentMid = row.querySelector('.field-row-mid');
    if (!toggle && currentMid) {
      toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'field-row-mid dpi-field-toggle';
      while (currentMid.firstChild) toggle.appendChild(currentMid.firstChild);
      currentMid.replaceWith(toggle);
      toggle.addEventListener('click', function(event) {
        event.stopPropagation();
        if (typeof dFieldToggleOpen === 'function') dFieldToggleOpen(fieldName);
      });
    }
    if (toggle) {
      toggle.setAttribute('aria-expanded', String(!!(item && item.classList.contains('open'))));
      toggle.setAttribute('aria-label', (item && item.classList.contains('open') ? 'Fechar detalhes de ' : 'Abrir detalhes de ') + label + (warning ? '. Poss\u00edvel duplicata.' : '.'));
    }

    if (meta) {
      Array.from(meta.childNodes).forEach(function(node) {
        if (node.nodeType === Node.TEXT_NODE && node.nodeValue.indexOf('N\u00e3o usada') !== -1) {
          node.nodeValue = node.nodeValue.replace('N\u00e3o usada', 'Dispon\u00edvel');
        }
      });
    }

    const staleStatus = end ? end.querySelector('.dpi-field-status') : null;
    if (staleStatus) staleStatus.remove();
    if (end && field && !end.querySelector('.dpi-field-primary-action')) {
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'dpi-field-primary-action';
      action.addEventListener('click', function(event) {
        event.stopPropagation();
        const currentIndex = dPropDataFieldIndex(fieldName);
        const currentField = currentIndex >= 0 && typeof dVars !== 'undefined' ? dVars[currentIndex] : null;
        const currentLayer = dPropDataSelectedLayer();
        const usage = currentField && typeof dFieldUsageLayers === 'function' ? dFieldUsageLayers(currentField.name) : [];
        const usedHere = !!(currentLayer && usage.some(function(place) { return place.id === currentLayer.id; }));
        if (currentField && currentLayer && dPropDataFieldFitsLayer(currentField, currentLayer) && !usedHere) {
          if (typeof dFieldUse === 'function') dFieldUse(currentIndex);
          return;
        }
        if (usage.length) dPropLocateField(fieldName);
      });
      const menu = end.querySelector('.field-card-menu');
      if (menu) end.insertBefore(action, menu);
      else end.appendChild(action);
    }

    const menu = row.querySelector('.field-card-menu');
    if (menu && !menu.dataset.dpiIcon) {
      menu.dataset.dpiIcon = 'true';
      menu.setAttribute('aria-label', 'Mais a\u00e7\u00f5es para ' + label);
      menu.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>';
    }

    const duplicateNote = item ? item.querySelector('.field-dup-note') : null;
    if (duplicateNote && !duplicateNote.querySelector('.dpi-field-compare')) {
      const compare = document.createElement('button');
      compare.type = 'button';
      compare.className = 'dpi-field-compare';
      compare.textContent = 'Comparar';
      compare.setAttribute('aria-label', 'Comparar campos com o mesmo nome de ' + label);
      compare.addEventListener('click', function(event) {
        event.stopPropagation();
        dPropCompareField(fieldName);
      });
      duplicateNote.appendChild(compare);
    }
  });
  dPropSyncDataIntro();
  dPropEnhanceDataFilters(list);
  dPropSyncDataContext(selectedLayer);
  dPropSyncDataTools();
}

function dPropInitDataPanel() {
  const panel = document.getElementById('d-panel-dados');
  const list = document.getElementById('d-fields-list');
  if (!panel || !list) return;
  panel.setAttribute('aria-label', 'Campos da arte');
  dPropBuildDataIntro();
  dPropBuildDataTools();
  dPropEnhanceDataRows();
  new MutationObserver(function() {
    dPropEnhanceDataRows();
  }).observe(list, { childList: true, subtree: true });
}

/* --------------------------------------------------------------------------
   Field wizard refinement
   The field engine owns creation and persistence in layers.js. This layer only
   gives each existing choice enough context for a designer to decide safely.
   -------------------------------------------------------------------------- */
const DP_FIELD_TYPE_HELP = {
  text: 'Nomes, chamadas e descri\u00e7\u00f5es curtas.',
  number: 'Quantidades, por\u00e7\u00f5es e medidas.',
  currency: 'Valores que o Luma formata como pre\u00e7o.',
  date: 'Datas de validade, eventos ou agendas.',
  image: 'Foto ou logo que entra na arte.',
  select: 'Uma escolha entre op\u00e7\u00f5es definidas.',
  color: 'Uma cor dentro da paleta sugerida.',
  boolean: 'Uma decis\u00e3o simples de sim ou n\u00e3o.'
};

function dPropFindExistingField(label) {
  if (typeof dVars === 'undefined' || !Array.isArray(dVars)) return null;
  const normalized = dPropDataNormalize(label);
  const compact = normalized.replace(/\s+/g, '');
  if (compact.length < 3) return null;

  let similar = null;
  for (let i = 0; i < dVars.length; i += 1) {
    const field = dVars[i];
    const fieldLabel = dPropDataNormalize(field.label || '').replace(/\s+/g, '');
    const fieldName = dPropDataNormalize(field.name || '').replace(/\s+/g, '');
    if (compact === fieldLabel || compact === fieldName) return { field: field, exact: true };
    if (!similar && compact.length > 3 && (
      (fieldLabel.length > 3 && (fieldLabel.indexOf(compact) !== -1 || compact.indexOf(fieldLabel) !== -1)) ||
      (fieldName.length > 3 && (fieldName.indexOf(compact) !== -1 || compact.indexOf(fieldName) !== -1))
    )) similar = { field: field, exact: false };
  }
  return similar;
}

function dPropUseExistingFromWizard(fieldName) {
  const bindTo = typeof dVarBindAfterCreate !== 'undefined' ? dVarBindAfterCreate : null;
  const fieldIndex = dPropDataFieldIndex(fieldName);
  const field = fieldIndex >= 0 && typeof dVars !== 'undefined' ? dVars[fieldIndex] : null;
  const layer = bindTo && typeof dLayers !== 'undefined'
    ? dLayers.find(function(item) { return item.id === bindTo; })
    : null;
  if (typeof dCloseVarModal === 'function') dCloseVarModal();
  if (field && layer && dPropDataFieldFitsLayer(field, layer) && typeof dLayerBindField === 'function') {
    dLayerBindField(layer.id, field.name);
    return;
  }
  if (typeof dActivatePanel === 'function') dActivatePanel('dados');
  const search = document.getElementById('d-fields-search');
  if (search) search.value = (field && (field.label || field.name)) || fieldName;
  if (typeof dFieldsFilter === 'function') dFieldsFilter((field && (field.label || field.name)) || fieldName);
  window.setTimeout(dPropDataChooseExisting, 80);
}

function dPropSyncFieldExistingMatch() {
  const modal = document.getElementById('d-var-modal');
  const label = document.getElementById('dv-label');
  const matchBox = document.getElementById('dpi-field-existing-match');
  if (!modal || !label || !matchBox) return;
  const editing = typeof dEditingVarName !== 'undefined' && !!dEditingVarName;
  const match = !editing ? dPropFindExistingField(label.value) : null;
  matchBox.hidden = !match;
  if (!match) {
    matchBox.removeAttribute('data-field');
    return;
  }
  matchBox.dataset.field = match.field.name;
  const copy = matchBox.querySelector('span');
  const button = matchBox.querySelector('button');
  if (copy) {
    copy.textContent = match.exact
      ? '\u201c' + (match.field.label || match.field.name) + '\u201d j\u00e1 existe.'
      : 'Talvez voc\u00ea queira usar \u201c' + (match.field.label || match.field.name) + '\u201d.';
  }
  if (button) {
    button.textContent = 'Usar existente';
    button.setAttribute('aria-label', 'Usar o campo existente ' + (match.field.label || match.field.name));
  }
}

function dPropBuildFieldWizard() {
  const modal = document.getElementById('d-var-modal');
  const wizard = modal ? modal.querySelector('.field-wizard') : null;
  const title = document.getElementById('dv-title');
  if (!modal || !wizard || !title || document.getElementById('dpi-field-wizard-head')) return;

  wizard.classList.add('dpi-field-wizard');
  wizard.setAttribute('role', 'dialog');
  wizard.setAttribute('aria-modal', 'true');
  wizard.setAttribute('aria-labelledby', 'dv-title');

  const head = document.createElement('div');
  head.id = 'dpi-field-wizard-head';
  head.className = 'dpi-field-wizard-head';
  head.innerHTML =
    '<div class="dpi-field-wizard-progress" aria-label="Etapa do campo">' +
      '<span class="dpi-field-step-dot is-active" data-step="1">1</span>' +
      '<span class="dpi-field-step-line" aria-hidden="true"></span>' +
      '<span class="dpi-field-step-dot" data-step="2">2</span>' +
      '<span class="dpi-field-step-label" id="dpi-field-step-label">Defini\u00e7\u00e3o</span>' +
    '</div>' +
    '<button type="button" class="dpi-field-close" aria-label="Fechar editor de campo">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>' +
    '</button>';
  wizard.insertBefore(head, title);
  head.querySelector('.dpi-field-close').addEventListener('click', dCloseVarModal);

  const q2 = document.getElementById('dv-q2');
  if (q2) {
    const context = document.createElement('p');
    context.id = 'dpi-field-type-context';
    context.className = 'dpi-field-type-context';
    context.setAttribute('aria-live', 'polite');
    q2.insertAdjacentElement('afterend', context);
  }
  const details = document.getElementById('dv-details-toggle');
  if (details) {
    details.setAttribute('aria-controls', 'dv-details');
    details.addEventListener('click', function() {
      requestAnimationFrame(dPropSyncFieldWizard);
    });
  }
  const label = document.getElementById('dv-label');
  const hint = document.querySelector('#dv-step-1 .field-q-hint');
  if (label && hint && !document.getElementById('dpi-field-existing-match')) {
    const match = document.createElement('div');
    match.id = 'dpi-field-existing-match';
    match.className = 'dpi-field-existing-match';
    match.hidden = true;
    match.setAttribute('role', 'status');
    match.innerHTML = '<span></span><button type="button">Usar existente</button>';
    match.querySelector('button').addEventListener('click', function() {
      const fieldName = match.dataset.field;
      if (fieldName) dPropUseExistingFromWizard(fieldName);
    });
    hint.insertAdjacentElement('afterend', match);
    label.addEventListener('input', dPropSyncFieldExistingMatch);
  }
}

function dPropSyncFieldWizard() {
  const modal = document.getElementById('d-var-modal');
  if (!modal) return;
  dPropBuildFieldWizard();
  const stepOne = document.getElementById('dv-step-1');
  const isFirstStep = stepOne && stepOne.style.display !== 'none';
  const activeType = document.getElementById('dv-type');
  const type = activeType ? activeType.value : 'text';
  const editing = typeof dEditingVarName !== 'undefined' && !!dEditingVarName;
  const title = document.getElementById('dv-title');
  const label = document.getElementById('dv-label');
  const stepLabel = document.getElementById('dpi-field-step-label');
  const dots = document.querySelectorAll('#dpi-field-wizard-head .dpi-field-step-dot');
  const typeContext = document.getElementById('dpi-field-type-context');
  const detailsToggle = document.getElementById('dv-details-toggle');
  const details = document.getElementById('dv-details');

  modal.classList.toggle('dpi-field-editing', editing);
  if (title) title.textContent = editing ? 'Editar campo' : 'Novo campo';
  if (stepLabel) stepLabel.textContent = isFirstStep ? 'Nome do campo' : 'Formato e orienta\u00e7\u00f5es';
  dots.forEach(function(dot) {
    dot.classList.toggle('is-active', Number(dot.dataset.step) === (isFirstStep ? 1 : 2));
    dot.classList.toggle('is-done', Number(dot.dataset.step) < (isFirstStep ? 1 : 2));
  });
  if (label) {
    label.setAttribute('aria-describedby', 'dpi-field-label-hint');
  }
  const hint = document.querySelector('#dv-step-1 .field-q-hint');
  if (hint) hint.id = 'dpi-field-label-hint';

  document.querySelectorAll('#dv-type-grid .field-type-card').forEach(function(card) {
    const cardType = card.dataset.type || 'text';
    const meta = typeof gFieldTypeMeta === 'function' ? gFieldTypeMeta(cardType) : null;
    const icon = card.querySelector('.field-type-ico');
    if (icon && meta && meta.svg) icon.innerHTML = meta.svg;
    let help = card.querySelector('.dpi-field-type-help');
    if (!help) {
      help = document.createElement('span');
      help.className = 'dpi-field-type-help';
      card.appendChild(help);
    }
    help.textContent = DP_FIELD_TYPE_HELP[cardType] || 'Formato do conte\u00fado.';
    card.setAttribute('aria-pressed', String(cardType === type));
    card.setAttribute('aria-label', (meta ? meta.label : cardType) + '. ' + help.textContent);
  });
  if (typeContext) {
    const meta = typeof gFieldTypeMeta === 'function' ? gFieldTypeMeta(type) : null;
    typeContext.textContent = (meta ? meta.label : 'Texto') + ': ' + (DP_FIELD_TYPE_HELP[type] || 'Formato do conte\u00fado.');
  }
  if (detailsToggle && details) {
    const open = details.style.display !== 'none';
    detailsToggle.setAttribute('aria-expanded', String(open));
    detailsToggle.classList.toggle('open', open);
  }
  dPropSyncFieldExistingMatch();
}

function dPropInitFieldWizard() {
  dPropBuildFieldWizard();
  const modal = document.getElementById('d-var-modal');
  if (modal) {
    new MutationObserver(function() {
      if (modal.classList.contains('open')) dPropSyncFieldWizard();
    }).observe(modal, { attributes: true, attributeFilter: ['class'] });
  }
}

/* --------------------------------------------------------------------------
   Blank canvas and page navigation
   These helpers present the existing creation/import/page functions with a
   calmer first-use path. They do not create a second document engine.
   -------------------------------------------------------------------------- */

function dPropStartFromImport(kind) {
  if (typeof dActiveTmplFolderId !== 'undefined' && dActiveTmplFolderId &&
      typeof dImportToFolder === 'function') {
    dImportToFolder(dActiveTmplFolderId, kind);
    return;
  }
  if (typeof dStudioHomeOpen === 'function') dStudioHomeOpen();
}

function dPropBuildCanvasEmpty() {
  const wrapper = document.getElementById('d-canvas-wrapper');
  if (!wrapper || document.getElementById('dpi-canvas-empty')) return;

  const empty = document.createElement('section');
  empty.id = 'dpi-canvas-empty';
  empty.className = 'dpi-canvas-empty';
  empty.setAttribute('aria-label', 'Começar uma arte');
  empty.innerHTML =
    '<span class="dpi-canvas-empty-icon" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 9h6M12 6v6"/><path d="M8 16h8"/></svg>' +
    '</span>' +
    '<div class="dpi-canvas-empty-copy">' +
      '<strong>Comece sua arte</strong>' +
      '<p>Importe um arquivo pronto ou adicione o primeiro conteúdo.</p>' +
    '</div>' +
    '<div class="dpi-canvas-empty-imports" aria-label="Importar arquivo">' +
      '<button type="button" class="dpi-empty-primary" data-empty-action="psd">' +
        '<span class="dpi-empty-file-mark" aria-hidden="true">Ps</span><span>Importar PSD</span>' +
      '</button>' +
      '<button type="button" class="dpi-empty-secondary" data-empty-action="svg">' +
        '<span class="dpi-empty-file-mark" aria-hidden="true">Ai</span><span>SVG / Illustrator</span>' +
      '</button>' +
    '</div>' +
    '<div class="dpi-canvas-empty-divider"><span>ou crie do zero</span></div>' +
    '<div class="dpi-canvas-empty-create" aria-label="Adicionar conteúdo">' +
      '<button type="button" data-empty-action="text">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M5 5V3h14v2M9 21h6M12 3v18"/></svg><span>Texto</span>' +
      '</button>' +
      '<button type="button" data-empty-action="image">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></svg><span>Imagem</span>' +
      '</button>' +
    '</div>';

  empty.addEventListener('click', function(event) {
    event.stopPropagation();
    const button = event.target.closest('[data-empty-action]');
    if (!button) return;
    const action = button.dataset.emptyAction;
    if (action === 'psd' || action === 'svg') dPropStartFromImport(action);
    if (action === 'text' && typeof dAddText === 'function') dAddText();
    if (action === 'image' && typeof dAddFrame === 'function') dAddFrame();
  });
  wrapper.appendChild(empty);
}

function dPropSyncCanvasEmpty() {
  if (typeof dLayers === 'undefined' || !Array.isArray(dLayers)) return;
  const empty = typeof dStudioHasMeaningfulLayers === 'function'
    ? !dStudioHasMeaningfulLayers(dLayers)
    : dLayers.filter(Boolean).length <= 1;
  document.body.classList.toggle('dpi-empty-canvas', empty);
}

function dPropInitCanvasEmpty() {
  dPropBuildCanvasEmpty();
  dPropSyncCanvasEmpty();
  const frame = document.getElementById('d-canvas-frame');
  if (!frame || frame.dataset.dpiEmptyObserved === '1') return;
  frame.dataset.dpiEmptyObserved = '1';
  let scheduled = false;
  new MutationObserver(function() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function() {
      scheduled = false;
      dPropSyncCanvasEmpty();
    });
  }).observe(frame, { childList: true });
}

function dPropSyncPagesTray() {
  const tray = document.getElementById('d-pages-tray');
  const list = document.getElementById('ptray-list');
  const toggle = tray ? tray.querySelector('.ptray-toggle') : null;
  if (!tray || !list || !toggle) return;

  const items = Array.from(list.querySelectorAll('.ptray-item'));
  const count = items.length;
  if (count && tray.dataset.dpiDefaultCollapsed !== '1') {
    tray.dataset.dpiDefaultCollapsed = '1';
    tray.classList.add('collapsed');
    if (typeof dPagesTrayCollapsed !== 'undefined') dPagesTrayCollapsed = true;
  }

  tray.classList.toggle('dpi-pages-single', count <= 1);
  let label = toggle.querySelector('.dpi-pages-toggle-label');
  if (!label) {
    label = document.createElement('span');
    label.className = 'dpi-pages-toggle-label';
    toggle.appendChild(label);
  }
  label.textContent = count + (count === 1 ? ' página' : ' páginas');
  const expanded = !tray.classList.contains('collapsed');
  toggle.setAttribute('aria-expanded', String(expanded));
  toggle.setAttribute('aria-controls', 'ptray-list');
  toggle.setAttribute('aria-label', (expanded ? 'Recolher ' : 'Mostrar ') + label.textContent);
  toggle.title = expanded ? 'Recolher páginas' : 'Mostrar páginas';

  list.setAttribute('role', 'list');
  list.setAttribute('aria-label', 'Páginas do material');
  items.forEach(function(item, index) {
    const active = item.classList.contains('active');
    item.setAttribute('role', 'button');
    item.setAttribute('aria-current', active ? 'page' : 'false');
    item.setAttribute('aria-label', 'Abrir página ' + (index + 1) + ': ' +
      ((item.querySelector('.ptray-item-label') || {}).textContent || 'Sem nome'));
    item.tabIndex = active || (!items.some(function(row) { return row.classList.contains('active'); }) && index === 0) ? 0 : -1;
  });

  const add = tray.querySelector('.ptray-add');
  if (add) add.setAttribute('aria-label', 'Adicionar nova página');
}

function dPropInitPagesTray() {
  const tray = document.getElementById('d-pages-tray');
  const list = document.getElementById('ptray-list');
  const toggle = tray ? tray.querySelector('.ptray-toggle') : null;
  if (!tray || !list || !toggle || tray.dataset.dpiReady === '1') return;
  tray.dataset.dpiReady = '1';

  toggle.addEventListener('click', function() {
    requestAnimationFrame(dPropSyncPagesTray);
  });
  list.addEventListener('keydown', function(event) {
    const item = event.target.closest('.ptray-item');
    if (!item || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    item.click();
  });
  new MutationObserver(dPropSyncPagesTray).observe(list, { childList: true });
  dPropSyncPagesTray();
}

const dPropBaseShowProps = typeof dShowProps === 'function' ? dShowProps : null;
if (dPropBaseShowProps) {
  dShowProps = function(layer) {
    const result = dPropBaseShowProps(layer);
    dPropSyncInspectorContext(layer);
    return result;
  };
}

const dPropBaseActivatePanel = typeof dActivatePanel === 'function' ? dActivatePanel : null;
if (dPropBaseActivatePanel) {
  dActivatePanel = function(name) {
    const result = dPropBaseActivatePanel(name);
    dPropSyncTabs(typeof dActivePanel !== 'undefined' ? dActivePanel : name);
    const aliases = {
      camada: 'edit',
      camadas: 'edit',
      propriedades: 'edit',
      dados: 'dados',
      vars: 'dados',
      variaveis: 'dados',
      linter: 'linter',
      campaigns: 'campaigns',
      conteudo: 'campaigns'
    };
    const rightPanel = document.getElementById('d-right');
    const keepOrganize = rightPanel && rightPanel.dataset.dpiKeepOrganize === '1' &&
      (name === 'camada' || name === 'camadas' || name === 'propriedades');
    dPropSyncPanelNav(keepOrganize ? 'organize' : (aliases[name] || name));
    return result;
  };
}

const dPropBaseOpenVarModal = typeof dOpenVarModal === 'function' ? dOpenVarModal : null;
if (dPropBaseOpenVarModal) {
  dOpenVarModal = function(opts) {
    const result = dPropBaseOpenVarModal(opts);
    dPropSyncFieldWizard();
    return result;
  };
}

const dPropBaseEditVar = typeof dEditVar === 'function' ? dEditVar : null;
if (dPropBaseEditVar) {
  dEditVar = function(index) {
    const result = dPropBaseEditVar(index);
    dPropSyncFieldWizard();
    return result;
  };
}

const dPropBaseFieldPickType = typeof dFieldPickType === 'function' ? dFieldPickType : null;
if (dPropBaseFieldPickType) {
  dFieldPickType = function(type, element) {
    const result = dPropBaseFieldPickType(type, element);
    dPropSyncFieldWizard();
    return result;
  };
}

const dPropBaseFieldWizardNext = typeof dFieldWizardNext === 'function' ? dFieldWizardNext : null;
if (dPropBaseFieldWizardNext) {
  dFieldWizardNext = function() {
    const result = dPropBaseFieldWizardNext();
    dPropSyncFieldWizard();
    return result;
  };
}

const dPropBaseFieldWizardBack = typeof dFieldWizardBack === 'function' ? dFieldWizardBack : null;
if (dPropBaseFieldWizardBack) {
  dFieldWizardBack = function() {
    const result = dPropBaseFieldWizardBack();
    dPropSyncFieldWizard();
    return result;
  };
}

document.addEventListener('DOMContentLoaded', function() {
  dPropBuildWorkspaceMode();
  dPropBuildEssentialChrome();
  dPropRestoreSections();
  document.querySelectorAll('#d-props-form .dp-section[id]').forEach(function(s) {
    var body = s.querySelector('.dp-sec-body');
    if (!body) return;
    if (s.classList.contains('dp-section-open')) {
      body.style.height = 'auto';
    } else {
      body.style.height = '0';
    }
  });
  dPropBuildInspectorHeader();
  dPropBuildImageControls();
  dPropInitSectionsA11y();
  dPropInitTabs();
  dPropBuildPanelNav();
  dPropInitLayersDock();
  dPropInitDataPanel();
  dPropInitFieldWizard();
  dPropInitCanvasEmpty();
  dPropInitPagesTray();
  dPropSyncInspectorFromState();

  const form = document.getElementById('d-props-form');
  if (form) {
    new MutationObserver(function() {
      dPropSyncInspectorFromState();
    }).observe(form, { attributes: true, attributeFilter: ['style'] });
  }
});
