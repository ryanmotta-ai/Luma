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

  if (secContent) secContent.style.display = (isText || isImg) ? '' : 'none';
  if (secText)    secText.style.display    = isText ? '' : 'none';
  if (secAppear)  secAppear.style.display  = isShp  ? '' : 'none';

  // Auto-expand the primary section for the layer type
  var targetOpen = isText ? secText : (isShp ? secAppear : secContent);
  if (targetOpen && !targetOpen.classList.contains('dp-section-open')) {
    var btn = targetOpen.querySelector('.dp-sec-head');
    if (btn) dPropToggleSection(btn);
  }
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
});
