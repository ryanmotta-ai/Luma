/**
 * js/core/splash.js
 *
 * Controla a splash screen de entrada do Luma.
 * Exibe a animação completa uma vez por dia e usa uma passagem curta nos demais
 * acessos. O boot acontece por baixo: a splash só cobre trabalho real e nunca o cria.
 *
 * A barra de progresso é REAL: quem empurra a largura é o boot (spStep), e ela nunca
 * chega a 100% antes do spBootReady. Antes ela enchia em 700ms fixos por CSS — barra
 * cheia com o app ainda carregando era o que convidava o clique impaciente que revelava
 * a tela meio-montada. Por isso também não há mais como pular a splash na mão.
 *
 * Depende de: nada (roda antes de qualquer módulo).
 * Exporta (globalmente): spDismiss, spStep, spBootReady.
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

  // ⛔ NÃO devolva aqui o "pular com Esc / clique duplo". Ele existia e era o furo: a única
  // forma de o app aparecer meio-montado era a splash sair antes do boot terminar, e as duas
  // saídas manuais faziam exatamente isso a pedido de quem estava impaciente. O escape de boot
  // travado continua existindo, mas é o teto de tempo (SP_MAX) — que deixa `g-boot` no body.

  // ── Progresso REAL ────────────────────────────────────────────────────────────────────
  // Teto de 90% enquanto o boot corre: a barra só fecha em spBootReady. Chegar a 100% com
  // trabalho em voo é justamente a mentira que esta mudança veio desfazer.
  var spReady = false;          // boot decidiu (login exibido OU home renderizada)
  var barra = overlay ? overlay.querySelector('.sp-bar') : null;
  var status = overlay ? overlay.querySelector('.sp-status') : null;
  var SP_ETAPAS = 3;            // acesso verificado · catálogo baixado · tela montada
  var spPasso = 0;
  function spPinta(pct) { try { if (barra) barra.style.width = pct + '%'; } catch (e) {} }
  // Etapa do boot concluída: avança a barra e nomeia o que está acontecendo. Depois que o
  // boot decidiu (spReady), vira no-op — sync atrasado não faz a barra andar para trás.
  function spStep(rotulo) {
    try {
      if (spReady) return;
      spPasso = Math.min(SP_ETAPAS, spPasso + 1);
      spPinta(Math.round((spPasso / SP_ETAPAS) * 90));
      if (rotulo && status) status.textContent = rotulo;
    } catch (e) { /* progresso nunca derruba o boot */ }
  }
  window.spStep = spStep;

  // `g-boot` no body marca "o boot ainda está correndo" para quem quiser reagir. Sai em
  // spBootReady, NÃO em spDismiss: se o teto de tempo revelar o app com trabalho em voo, a
  // marca precisa continuar de pé — é exatamente esse o caso que ela existe para cobrir.
  try { if (document.body) document.body.classList.add('g-boot'); } catch (e) {}

  try {
    // Marca completa no primeiro acesso do dia; retorno não cobra uma intro repetida.
    var SP_MIN = isReturning ? 160 : 980;
    // Teto duro: em rede lenta / boot travado o splash NUNCA fica preso — revela de qualquer jeito.
    var SP_MAX = 8000;
    var spStart = Date.now();   // marcado no parse (script é o 1º do <body>)

    // Sinal do boot (main.js chama quando o app está pronto pra aparecer). Assim o splash cobre a
    // checagem de sessão e o 1º render — em rede lenta não revela mais uma tela vazia/meio-carregada.
    window.spBootReady = function () {
      spPinta(100);             // só aqui a barra fecha — o boot terminou de verdade
      spReady = true;
      try { if (document.body) document.body.classList.remove('g-boot'); } catch (e) {}
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
        // Boot que lança nunca chega no spBootReady. Sem esta rede, `g-boot` ficaria preso no
        // body para sempre e o app nasceria inerte — pior do que a tela meio-montada.
        setTimeout(function () {
          try { if (document.body) document.body.classList.remove('g-boot'); } catch (e) {}
        }, Math.max(SP_MIN, SP_MAX - elapsed) + 400);
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
