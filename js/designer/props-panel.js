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
    if (meta) meta.textContent = Math.round(layer.w || 0) + ' \u00d7 ' + Math.round(layer.h || 0) + ' px' + (layer.locked ? '  /  Bloqueada' : '');
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
    if (kicker) kicker.textContent = 'Documento';
    if (name) name.textContent = ab && ab.name ? ab.name : 'Prancheta';
    if (meta) meta.textContent = ab ? Math.round(ab.w || 0) + ' \u00d7 ' + Math.round(ab.h || 0) + ' px' : 'Configura\u00e7\u00f5es da prancheta';
    if (contentLabel) contentLabel.textContent = 'Conte\u00fado';
  }

  dPropEnhanceDado(layer);
  dPropSyncImageSource();
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
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Camadas da prancheta');
    list.setAttribute('aria-multiselectable', 'true');
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
        rows[target].focus();
        rows[target].click();
        return;
      }
      if ((event.key === 'Enter' || event.key === ' ') && current >= 0) {
        event.preventDefault();
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

function dPropDataCategoryKey(label) {
  const normalized = String(label || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (normalized.indexOf('produto') !== -1) return 'produto';
  if (normalized.indexOf('preco') !== -1) return 'preco';
  if (normalized.indexOf('campanha') !== -1) return 'campanha';
  if (normalized.indexOf('midia') !== -1) return 'midia';
  return 'outros';
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
      '<span>Campos edit\u00e1veis</span>' +
      '<strong>Conte\u00fado do template</strong>' +
      '<small id="dpi-data-summary" aria-live="polite">Organize o que o franqueado pode atualizar.</small>' +
    '</span>' +
    '<span class="dpi-data-total" id="dpi-data-total" aria-label="0 campos">0</span>';
  panel.insertBefore(intro, toolbar);

  toolbar.setAttribute('role', 'search');
  toolbar.setAttribute('aria-label', 'Buscar ou criar campo');
  const search = toolbar.querySelector('#d-fields-search');
  if (search) {
    search.placeholder = 'Buscar por nome, tipo ou categoria';
    search.setAttribute('aria-label', 'Buscar por nome, tipo ou categoria');
  }
  const create = toolbar.querySelector('.dados-new-btn');
  if (create) {
    create.setAttribute('aria-label', 'Criar novo campo');
    if (!create.querySelector('.dpi-new-label')) {
      Array.from(create.childNodes).forEach(function(node) {
        if (node.nodeType === Node.TEXT_NODE) node.nodeValue = '';
      });
      const label = document.createElement('span');
      label.className = 'dpi-new-label';
      label.textContent = 'Novo campo';
      create.appendChild(label);
    }
  }
  const chips = panel.querySelector('.dados-chipbar');
  if (chips) chips.setAttribute('role', 'group');
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
  const free = totalFields - used;
  total.textContent = String(totalFields);
  total.setAttribute('aria-label', totalFields + (totalFields === 1 ? ' campo' : ' campos'));
  if (!totalFields) {
    summary.textContent = 'Crie os campos que o franqueado poder\u00e1 atualizar.';
  } else if (!used) {
    summary.textContent = totalFields + ' campos criados. Escolha um e conecte a uma camada.';
  } else {
    summary.textContent = used + ' em uso e ' + free + (free === 1 ? ' pronto para conectar.' : ' prontos para conectar.');
  }
}

function dPropEnhanceDataRows() {
  const list = document.getElementById('d-fields-list');
  if (!list) return;

  const emptyIcon = list.querySelector('.field-empty-icon');
  if (emptyIcon && !emptyIcon.querySelector('svg')) {
    emptyIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H10l2 2h5.5A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z"/><path d="M9 12h6M12 9v6"/></svg>';
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

  list.querySelectorAll('.field-row').forEach(function(row) {
    const item = row.closest('.field-item');
    const name = row.querySelector('.field-row-name .nm');
    const meta = row.querySelector('.field-row-meta');
    const end = row.querySelector('.field-row-end');
    const used = !!row.querySelector('.field-sdot.used');
    const label = name ? name.textContent.trim() : 'Campo';
    row.setAttribute('role', 'group');
    row.tabIndex = 0;
    row.setAttribute('aria-expanded', String(!!(item && item.classList.contains('open'))));
    row.setAttribute('aria-label', label + (used ? ', em uso. Abrir detalhes.' : ', livre para conectar. Abrir detalhes.'));
    if (!row.dataset.dpiKeyboard) {
      row.dataset.dpiKeyboard = 'true';
      row.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          row.click();
        }
      });
    }
    if (meta) {
      Array.from(meta.childNodes).forEach(function(node) {
        if (node.nodeType === Node.TEXT_NODE && node.nodeValue.indexOf('N\u00e3o usada') !== -1) {
          node.nodeValue = node.nodeValue.replace('N\u00e3o usada', 'Livre para conectar');
        }
      });
    }
    if (end && !end.querySelector('.dpi-field-status')) {
      const status = document.createElement('span');
      status.className = 'dpi-field-status ' + (used ? 'is-used' : 'is-free');
      status.textContent = used ? 'Em uso' : 'Livre';
      const menu = end.querySelector('.field-card-menu');
      if (menu) end.insertBefore(status, menu);
      else end.appendChild(status);
    }
    const menu = row.querySelector('.field-card-menu');
    if (menu && !menu.dataset.dpiIcon) {
      menu.dataset.dpiIcon = 'true';
      menu.setAttribute('aria-label', 'Mais a\u00e7\u00f5es para ' + label);
      menu.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>';
    }
  });
  dPropSyncDataIntro();
}

function dPropInitDataPanel() {
  const panel = document.getElementById('d-panel-dados');
  const list = document.getElementById('d-fields-list');
  if (!panel || !list) return;
  panel.setAttribute('aria-label', 'Centro de campos do template');
  dPropBuildDataIntro();
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
  dPropInitLayersDock();
  dPropInitDataPanel();
  dPropInitFieldWizard();
  dPropSyncInspectorFromState();

  const form = document.getElementById('d-props-form');
  if (form) {
    new MutationObserver(function() {
      dPropSyncInspectorFromState();
    }).observe(form, { attributes: true, attributeFilter: ['style'] });
  }
});
