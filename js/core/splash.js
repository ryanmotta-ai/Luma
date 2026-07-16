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

  // Permite pular o carregamento com clique duplo no overlay ou ao apertar Esc
  try {
    window.addEventListener('DOMContentLoaded', function() {
      var overlay = document.getElementById('sp-overlay');
      if (overlay) {
        overlay.addEventListener('dblclick', spDismiss);
        overlay.style.cursor = 'pointer';
        overlay.title = 'Clique duplo para pular';
      }
      document.addEventListener('keydown', function(ev) {
        if (ev.key === 'Escape') spDismiss();
      });
    });
  } catch (e) {}

  try {
    // 2.8s = fim da barra (1s de delay + 1.8s de preenchimento); a animação refinada
    // toca por completo antes da saída com fade+zoom.
    var SP_MIN = 2800;
    // Teto duro: em rede lenta / boot travado o splash NUNCA fica preso — revela de qualquer jeito.
    var SP_MAX = 9000;
    var spStart = Date.now();   // marcado no parse (script é o 1º do <body>)
    var spReady = false;        // boot decidiu (login exibido OU home renderizada)

    // Sinal do boot (main.js chama quando o app está pronto pra aparecer). Assim o splash cobre a
    // checagem de sessão e o 1º render — em rede lenta não revela mais uma tela vazia/meio-carregada.
    window.spBootReady = function () {
      spReady = true;
      if (Date.now() - spStart >= SP_MIN) spDismiss(); // já passou o mínimo → revela agora
    };

    document.addEventListener('DOMContentLoaded', function () {
      try {
        var elapsed = Date.now() - spStart;
        // No mínimo (2.8s): revela SÓ se o boot já estiver pronto; senão espera o spBootReady.
        setTimeout(function () { if (spReady) spDismiss(); }, Math.max(0, SP_MIN - elapsed));
        // Failsafe: revela no teto mesmo sem sinal do boot (rede lenta não prende o splash).
        setTimeout(spDismiss, Math.max(SP_MIN, SP_MAX - elapsed));
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
