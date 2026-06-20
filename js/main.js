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

  const ctxFran = document.getElementById('topbar-context-fran');
  const ctxDesign = document.getElementById('topbar-context-design');
  if(ctxFran) ctxFran.style.display = m==='franqueado'?'':'none';
  if(ctxDesign) ctxDesign.style.display = m==='designer'?'':'none';
  if(m==='designer') dInit();
  if(m==='dados' && typeof pInit==='function') pInit();
}

/* ══ INIT Lógica de Inicialização Global e Auth Gate ══ */

// Função chamada após um login bem-sucedido ou quando a sessão já está ativa
function gOnLoginSuccess() {
  document.getElementById('g-login-screen').style.display = 'none';
  dUpdateTabPill();
  
  if(typeof gUpdateUserTopbar === 'function') gUpdateUserTopbar();
  
  // INIT FRANQUEADO
  fRenderCategorias();
  fRenderFmts();
  fUpdateHistBadge();
  if (typeof fStartChat === 'function') fStartChat();

  // Sincroniza o catálogo de variáveis com o Supabase (offline-first).
  if (typeof dSyncVarsFromBackend === 'function') dSyncVarsFromBackend();
}

// Inicializa a aba no startup e checa a autenticação
window.addEventListener('DOMContentLoaded', async () => {
  if (typeof gInitHelpChat === 'function') gInitHelpChat();
  setTimeout(dUpdateTabPill, 100);

  // Checa a sessão REAL do Supabase (assíncrono) antes de decidir login vs app.
  if (typeof gLoadProfile === 'function') { try { await gLoadProfile(); } catch(e){} }

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║  🚨🚨🚨  BYPASS DE LOGIN — DEV LOCAL APENAS — REMOVER ANTES DE COMMITAR  🚨🚨🚨  ║
  // ║  Injeta usuário fake em localhost/file:// quando não há sessão real do       ║
  // ║  Supabase. Só destrava a UI p/ dev de frontend (backend NÃO funciona).       ║
  // ║  ❌ NÃO COMMITAR. Apague TUDO entre os marcadores 🚨 antes do commit.         ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝
  const _DEV_isLocal = ['localhost','127.0.0.1','[::1]','::1',''].includes(location.hostname)
                    || location.protocol === 'file:';
  if (!gCurrentUser() && _DEV_isLocal) {
    console.warn('🚨 [DEV] Bypass de login ATIVO — usuário fake injetado. REMOVER antes de commitar (js/main.js).');
    gAuthState = { user: { id:'dev-local', email:'ryan.motta@deliverymuch.com.br',
      role:'gestao', displayName:'Ryan Motta (DEV)', departamento:null } };
  }
  // ╚═══ 🚨 FIM DO BYPASS DE LOGIN — REMOVER ATÉ AQUI ANTES DE COMMITAR 🚨 ═══╝

  if (!gCurrentUser()) {
    // Não tem sessão ativa, bloqueia a UI
    document.getElementById('g-login-screen').style.display = 'flex';
  } else {
    // Usuário logado, init normal
    gOnLoginSuccess();
  }
});
