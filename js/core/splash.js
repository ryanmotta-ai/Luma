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
  // ── Frase do loading: o Luma reconhece a hora em que a pessoa entrou ──
  // Uma linha curta, no tom da casa (simples, próxima, sem vender nada). O
  // recorte é por HORA e por DIA porque a rotina do franqueado é essa: pico no
  // almoço e no jantar, fim de semana trabalhando, sexta pensando na próxima.
  // Ordem importa: a madrugada vence o dia da semana (3h de sábado é madrugada,
  // não fim de semana). Nada de dado do usuário aqui — só texto fixo.
  var SP_FRASES = {
    madrugada:  ['Madrugada e você criando. A gente tá junto.',
                 'A essa hora é só você e a arte.',
                 'Boa madrugada. O café fica por sua conta.'],
    fimDeSemana:['Fim de semana e você trabalhando. Vamos ser rápidos.',
                 'O movimento não tira folga, a gente também não.',
                 'Fim de semana é quando mais vende. Bora?'],
    sexta:      ['Sexta. Bora deixar o fim de semana engatilhado?',
                 'Sexta-feira: o dia mais movimentado da semana.',
                 'Antes de fechar a semana, uma arte nova.'],
    cedo:       ['Antes de todo mundo. Bom dia.',
                 'Cedo assim o dia rende mais.',
                 'Bom dia. O dia ainda tá em branco.'],
    manha:      ['Bom dia. Bora preparar a arte de hoje?',
                 'Bom dia. A gente já deixou tudo separado.',
                 'Manhã boa pra adiantar a semana.'],
    almoco:     ['Pico do almoço. Vai ser rapidinho.',
                 'Hora do almoço — a sua e a dos seus clientes.',
                 'Meio-dia. A arte fica pronta antes do café.'],
    tarde:      ['Boa tarde. Bora adiantar o post de hoje?',
                 'Boa tarde. Qual campanha entra agora?',
                 'Tarde boa pra deixar a semana pronta.'],
    noite:      ['Hora do pico. Deixa a arte com a gente.',
                 'Boa noite. Rapidinho e você volta pro movimento.',
                 'Começou o jantar. A gente é rápido.'],
    tardeNoite: ['Depois do expediente. A gente também tá aqui.',
                 'Boa noite. Últimos ajustes do dia?',
                 'Tarde da noite. Prometo ser breve.']
  };

  function spFrase() {
    var agora = new Date(), h = agora.getHours(), dia = agora.getDay(); // 0 = domingo
    var lista;
    if (h < 5)                       lista = SP_FRASES.madrugada;
    else if (dia === 0 || dia === 6) lista = SP_FRASES.fimDeSemana;
    else if (dia === 5 && h >= 17)   lista = SP_FRASES.sexta;
    else if (h < 8)                  lista = SP_FRASES.cedo;
    else if (h < 12)                 lista = SP_FRASES.manha;
    else if (h < 14)                 lista = SP_FRASES.almoco;
    else if (h < 18)                 lista = SP_FRASES.tarde;
    else if (h < 22)                 lista = SP_FRASES.noite;
    else                             lista = SP_FRASES.tardeNoite;
    return lista[Math.floor(Math.random() * lista.length)];
  }

  // Injeta a frase agora (o script roda logo depois do markup do overlay, então
  // .sp-content já existe — sem esperar DOMContentLoaded não há flash).
  // aria-hidden: o overlay já anuncia "Carregando Luma"; a frase é tempero visual
  // e ler a piada no leitor de tela só atrapalharia.
  try {
    var conteudo = document.querySelector('#sp-overlay .sp-content');
    if (conteudo) {
      var frase = document.createElement('p');
      frase.className = 'sp-frase';
      frase.setAttribute('aria-hidden', 'true');
      frase.textContent = spFrase();
      conteudo.appendChild(frase);
    }
  } catch (e) { /* frase é enfeite: nunca pode derrubar o boot */ }

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
