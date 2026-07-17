/**
 * js/core/pwa-install.js — dica de instalação do Luma como app (PWA)
 *
 * Mostra UMA dica discreta e dispensável para deixar o Luma na tela de início
 * (celular) ou no Dock (Mac). Só aparece no NAVEGADOR — some quando o Luma já
 * roda instalado (standalone) — e é lembrada em localStorage. Três caminhos:
 *   · Chromium (Android / Chrome / Edge): botão "Instalar" via beforeinstallprompt.
 *   · iPhone / iPad (Safari): Compartilhar → Adicionar à Tela de Início.
 *   · Mac (Safari): Arquivo → Adicionar ao Dock.
 * Sem dependência nova; cor/raio/motion via token; ícone = SVG. localStorage
 * sempre em try/catch. Escape não é necessário: toda a copy é estática.
 */
(function () {
  var KEY = 'luma_pwa_hint_v1';

  // Já instalado (tela de início / Dock)? Não incomoda.
  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
           window.navigator.standalone === true;
  }
  function isDismissed() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function remember()    { try { localStorage.setItem(KEY, '1'); } catch (e) {} }

  var ua = navigator.userAgent || '';
  // iPad no iPadOS se disfarça de "Macintosh" — o toque desempata.
  var isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var isMacSafari = /Macintosh/.test(ua) && !(navigator.maxTouchPoints > 1) &&
                    /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(ua);

  var deferredPrompt = null;   // guardado do beforeinstallprompt p/ disparar no clique

  // Ícone do compartilhar do iOS (quadrado com seta pra cima) — pra instrução casar
  // com o que o usuário vê na barra do Safari.
  var SHARE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v13"/><path d="M8 7l4-4 4 4"/><path d="M6 12H5a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2h-1"/></svg>';

  function copyFor(kind) {
    if (kind === 'ios') return {
      title: 'Instale o Luma no seu iPhone',
      body: 'Toque em ' + SHARE_SVG + ' e escolha <b>“Adicionar à Tela de Início”</b>.',
      button: null
    };
    if (kind === 'mac') return {
      title: 'Deixe o Luma no seu Dock',
      body: 'No Safari: <b>Arquivo → Adicionar ao Dock</b>. O Luma abre como app, sem barra do navegador.',
      button: null
    };
    return { // chromium
      title: 'Instale o Luma como app',
      body: 'Acesso direto na área de trabalho, em tela cheia.',
      button: 'Instalar'
    };
  }

  function close() {
    var el = document.getElementById('luma-pwa-hint');
    if (el) { el.classList.add('leaving'); setTimeout(function () { if (el.parentNode) el.remove(); }, 220); }
  }
  function dismiss() { remember(); close(); }

  function show(kind) {
    if (isStandalone() || isDismissed()) return;
    if (document.getElementById('luma-pwa-hint')) return;

    var c = copyFor(kind);
    var el = document.createElement('div');
    el.id = 'luma-pwa-hint';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Instalar o Luma');
    el.innerHTML =
      '<div class="pwah-icon" aria-hidden="true"></div>' +
      '<div class="pwah-text"><div class="pwah-title">' + c.title + '</div>' +
        '<div class="pwah-body">' + c.body + '</div></div>' +
      (c.button ? '<button type="button" class="pwah-cta">' + c.button + '</button>' : '') +
      '<button type="button" class="pwah-close" aria-label="Dispensar">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>' +
      '</button>';
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('in'); });

    el.querySelector('.pwah-close').onclick = dismiss;
    var cta = el.querySelector('.pwah-cta');
    if (cta) cta.onclick = function () {
      if (!deferredPrompt) { close(); return; }
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () { deferredPrompt = null; remember(); close(); });
    };
  }

  // Chromium: o navegador avisa que dá pra instalar → guardamos e mostramos o botão.
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    show('chromium');
  });
  window.addEventListener('appinstalled', function () { remember(); close(); });

  // Safari (iOS/Mac) não emite beforeinstallprompt — mostramos a instrução manual,
  // com folga pro splash sair e não competir com o boot.
  window.addEventListener('DOMContentLoaded', function () {
    if (isStandalone() || isDismissed()) return;
    if (isIOS || isMacSafari) setTimeout(function () { show(isIOS ? 'ios' : 'mac'); }, 3500);
  });
})();
