/**
 * js/main.js
 *
 * Bootstrap: setMode (troca entre franqueado/designer) e chamadas de inicializacao.
 * Deve ser carregado por ULTIMO (apos todos os modulos).
 */

/* ══════════════════════════════════════════════════════════════
   MODO SWITCH
══════════════════════════════════════════════════════════════ */
function dUpdateTabPill() {
  const pill = document.getElementById('mode-tab-pill');
  const activeTab = document.querySelector('.mode-tab.active');
  if (pill && activeTab) {
    pill.style.width = activeTab.offsetWidth + 'px';
    pill.style.transform = `translateX(${activeTab.offsetLeft}px)`;
  }
}

function setMode(m){
  // Troca só a classe de modo, preservando as demais (theme-light, rulers-on, simulating...)
  document.body.classList.remove('mode-franqueado','mode-designer','mode-dados');
  document.body.classList.add('mode-'+m);
  document.getElementById('tab-fran').classList.toggle('active', m==='franqueado');
  document.getElementById('tab-design').classList.toggle('active', m==='designer');
  const tabDados=document.getElementById('tab-dados');
  if(tabDados) tabDados.classList.toggle('active', m==='dados');
  
  dUpdateTabPill();

  document.getElementById('topbar-right-fran').style.display = m==='franqueado'?'':'none';
  document.getElementById('topbar-right-design').style.display = m==='designer'?'':'none';
  if(m==='designer') dInit();
  if(m==='dados' && typeof pInit==='function') pInit();
}

/* ══ INIT Lógica de Inicialização Global e Auth Gate ══ */

// Função chamada após um login bem-sucedido ou quando a sessão já está ativa
function gOnLoginSuccess() {
  document.getElementById('g-login-screen').style.display = 'none';
  dUpdateTabPill();
  
  // INIT FRANQUEADO
  fRenderCatalogs(CAMPS_ATIVAS,CAMPS_OUTRAS);
  fRenderFmts();
  fUpdateHistBadge();
  if (typeof fStartChat === 'function') fStartChat();
}

// Inicializa a aba no startup e checa a autenticação
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(dUpdateTabPill, 100);
  
  if (!gCurrentUser()) {
    // Não tem sessão ativa, bloqueia a UI
    document.getElementById('g-login-screen').style.display = 'flex';
  } else {
    // Usuário logado, init normal
    gOnLoginSuccess();
  }
});
