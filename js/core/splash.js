/**
 * js/core/splash.js
 *
 * Controla a splash screen de entrada do Luma.
 * Exibe a animação completa uma vez por dia e usa uma passagem curta nos demais
 * acessos. O boot acontece por baixo: a splash só cobre trabalho real e nunca o cria.
 *
 * Depende de: nada (roda antes de qualquer módulo).
 * Exporta (globalmente): spDismiss — chamável manualmente de qualquer lugar.
 */
(function () {
  var overlay = document.getElementById('sp-overlay');
  var DAY_KEY = '__luma_splash_day';
  var now = new Date();
  var today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  var isReturning = false;
  try {
    isReturning = localStorage.getItem(DAY_KEY) === today;
    localStorage.setItem(DAY_KEY, today);
  } catch (e) {}
  if (overlay && isReturning) overlay.classList.add('sp-quick');

  // Remove o overlay como uma cortina laranja que revela a tela já montada.
  function spDismiss() {
    try {
      if (!overlay || overlay.classList.contains('sp-done')) return;
      overlay.classList.add('sp-done');
      setTimeout(function () {
        if (overlay) overlay.style.display = 'none';
      }, isReturning ? 220 : 520);
    } catch (e) { /* nunca bloquear o app */ }
  }
  // Disponibiliza globalmente (chamável de qualquer módulo no futuro)
  window.spDismiss = spDismiss;

  // Permite pular o carregamento com clique duplo no overlay ou ao apertar Esc
  try {
    window.addEventListener('DOMContentLoaded', function() {
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
    // Marca completa no primeiro acesso do dia; retorno não cobra uma intro repetida.
    var SP_MIN = isReturning ? 160 : 980;
    // Teto duro: em rede lenta / boot travado o splash NUNCA fica preso — revela de qualquer jeito.
    var SP_MAX = 8000;
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
        // No mínimo: revela SÓ se o boot já estiver pronto; senão espera o spBootReady.
        setTimeout(function () { if (spReady) spDismiss(); }, Math.max(0, SP_MIN - elapsed));
        // Texto é feedback de lentidão, não parte obrigatória da coreografia.
        setTimeout(function () {
          if (spReady || !overlay || overlay.classList.contains('sp-done')) return;
          overlay.classList.add('sp-slow');
        }, Math.max(0, 1500 - elapsed));
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
