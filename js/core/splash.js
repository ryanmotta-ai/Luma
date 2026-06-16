/**
 * js/core/splash.js
 *
 * Controla a splash screen de entrada do Luma.
 * Exibe o overlay animado e o remove após o carregamento (mín. ~2.8s, alinhado
 * com o fim da barra de progresso). Nunca pode bloquear o app — tudo em try/catch.
 *
 * Depende de: nada (roda antes de qualquer módulo).
 * Exporta (globalmente): spDismiss — chamável manualmente de qualquer lugar.
 */
(function () {
  // Remove o overlay (fade-out via .sp-done e depois display:none).
  function spDismiss() {
    try {
      var overlay = document.getElementById('sp-overlay');
      if (!overlay || overlay.classList.contains('sp-done')) return;
      overlay.classList.add('sp-done');
      setTimeout(function () {
        if (overlay) overlay.style.display = 'none';
      }, 450);
    } catch (e) { /* nunca bloquear o app */ }
  }
  // Disponibiliza globalmente (chamável de qualquer módulo no futuro)
  window.spDismiss = spDismiss;

  try {
    // 2.8s = fim da barra (1s de delay + 1.8s de preenchimento); a animação refinada
    // toca por completo antes da saída com fade+zoom.
    var SP_MIN = 2800;
    var spStart = Date.now();   // marcado no parse (script é o 1º do <body>)

    document.addEventListener('DOMContentLoaded', function () {
      try {
        var elapsed = Date.now() - spStart;
        var remaining = Math.max(0, SP_MIN - elapsed);
        setTimeout(spDismiss, remaining);
      } catch (e) {
        spDismiss(); // qualquer falha → não deixa o overlay preso
      }
    });
  } catch (e) {
    // Falha catastrófica: garante que o app apareça mesmo assim
    try {
      var o = document.getElementById('sp-overlay');
      if (o) o.style.display = 'none';
    } catch (_) {}
  }
})();
