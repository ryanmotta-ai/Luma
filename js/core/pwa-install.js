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
    if (el) { el.classList.add('leaving'); setTimeout(function () { if (el.parentNode) el.remove(); }, 280); }
  }
  function dismiss() { remember(); close(); }

  var LUMA_FAVICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" style="width:100%;height:100%;display:block;border-radius:10px;"><rect width="32" height="32" rx="7" fill="#FF9000"/><g transform="translate(16, 16) scale(0.68) translate(-16, -16)"><path d="M8 24 L15.5 16.5" stroke="white" stroke-width="3" stroke-linecap="round"/><path d="M17.5 14.5 L23 9" stroke="white" stroke-width="3" stroke-linecap="round"/><path d="M12 5.5 Q12 9 15.5 9 Q12 9 12 12.5 Q12 9 8.5 9 Q12 9 12 5.5 Z" fill="white"/><path d="M20 19.5 Q20 23 23.5 23 Q20 23 20 26.5 Q20 23 16.5 23 Q20 23 20 19.5 Z" fill="white"/><path d="M24 15 Q24 17 26 17 Q24 17 24 15 Z" fill="white"/><line x1="25.5" y1="6.5" x2="27.5" y2="4.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/><line x1="23.5" y1="5.5" x2="23.5" y2="3" stroke="white" stroke-width="1.5" stroke-linecap="round"/><line x1="26" y1="8.5" x2="28.5" y2="8.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/></g></svg>';

  function isSplashOrLoginVisible() {
    // 'sp-overlay' é o id real do splash (js/core/splash.js). Enquanto isto procurava um
    // 'g-splash' que não existe, a checagem do splash nunca era verdadeira.
    var splash = document.getElementById('sp-overlay');
    if (splash && splash.style.display !== 'none' && window.getComputedStyle(splash).display !== 'none') return true;
    var login = document.getElementById('g-login-screen');
    if (login && login.style.display !== 'none' && window.getComputedStyle(login).display !== 'none') return true;
    return false;
  }

  function show(kind) {
    if (isStandalone() || isDismissed()) return;
    if (isSplashOrLoginVisible()) return;
    if (!document.body.classList.contains('mode-franqueado')) return;
    if (document.getElementById('luma-pwa-hint')) return;

    var c = copyFor(kind);
    var el = document.createElement('div');
    el.id = 'luma-pwa-hint';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Instalar o Luma');
    el.innerHTML =
      '<div class="pwah-icon" aria-hidden="true" style="background:#FF9000 !important;box-shadow:0 4px 14px -2px rgba(255,144,0,.45);">' + LUMA_FAVICON_SVG + '</div>' +
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

  // Chromium: o navegador avisa que dá pra instalar → guardamos a indicação
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
  });
  window.addEventListener('appinstalled', function () { remember(); close(); });

  function tryShowOnScroll(e) {
    if (isStandalone() || isDismissed()) return;
    if (isSplashOrLoginVisible()) return;
    if (!document.body.classList.contains('mode-franqueado')) return;

    // Quem rolou é o alvo do evento — não sempre o #f-home. O franqueado tem mais de um
    // container com overflow (a vitrine, "Minhas artes", o painel de materiais); lendo só o
    // #f-home, rolar qualquer outra tela devolvia scrollTop 0 e a dica nunca aparecia.
    var alvo = e && e.target;
    var st = (alvo && alvo.scrollTop) || window.scrollY || document.documentElement.scrollTop || 0;
    if (st > 30) {
      var kind = isIOS ? 'ios' : (isMacSafari ? 'mac' : 'chromium');
      show(kind);
    }
  }

  // Escuta rolagem no painel do franqueado (#f-home ou janela)
  document.addEventListener('scroll', tryShowOnScroll, { passive: true, capture: true });
  window.addEventListener('scroll', tryShowOnScroll, { passive: true });
})();
