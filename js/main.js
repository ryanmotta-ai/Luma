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
  if(m!=='franqueado' && m!=='designer') m='franqueado';
  // Gate por role: franqueado NÃO acessa o Estúdio (trava no clique e via DOM/console).
  if(m==='designer' && (typeof gIsAdmin!=='function' || !gIsAdmin())) m='franqueado';
  // Troca só a classe de modo, preservando as demais (theme-light, rulers-on, simulating...)
  document.body.classList.remove('mode-franqueado','mode-designer');
  document.body.classList.add('mode-'+m);
  document.getElementById('tab-fran').classList.toggle('active', m==='franqueado');
  document.getElementById('tab-design').classList.toggle('active', m==='designer');
  
  dUpdateTabPill();

  const ctxFran = document.getElementById('topbar-context-fran');
  const ctxDesign = document.getElementById('topbar-context-design');
  if(ctxFran) ctxFran.style.display = m==='franqueado'?'':'none';
  if(ctxDesign) ctxDesign.style.display = m==='designer'?'':'none';
  if(m==='designer') dInit();
}

// Mostra a aba Designer só pra persona Designer (equipe_dm/gestao).
// Franqueado fica restrito à própria área. A RLS já protege o conteúdo no backend;
// isto é o gate de navegação no front.
function gApplyModeAccess(){
  const isAdmin = (typeof gIsAdmin==='function') && gIsAdmin();
  const tabDesign = document.getElementById('tab-design');
  if(tabDesign) tabDesign.style.display = isAdmin ? '' : 'none';
  if(!isAdmin) setMode('franqueado'); // garante que o franqueado fica na própria área
  dUpdateTabPill();
}

/* ══ INIT Lógica de Inicialização Global e Auth Gate ══ */

// Função chamada após um login bem-sucedido ou quando a sessão já está ativa
function gOnLoginSuccess() {
  // Saída suave do login (fade+zoom) em vez de corte seco, encadeando com a entrada da view.
  const _login = document.getElementById('g-login-screen');
  if (_login) {
    _login.classList.add('gl-out');
    setTimeout(() => { _login.style.display = 'none'; _login.classList.remove('gl-out'); }, 320);
  }
  dUpdateTabPill();

  if(typeof gUpdateUserTopbar === 'function') gUpdateUserTopbar();
  if(typeof gTrackEvent === 'function') gTrackEvent('sessao_iniciada', {rota:'app'});

  // Gate de navegação por role: franqueado só vê a própria área (esconde o Estúdio).
  gApplyModeAccess();

  // INIT FRANQUEADO
  fRenderCategorias();
  fRenderFmts();
  fUpdateHistBadge();
  // Boot honesto: recebe com boas-vindas em vez de interrogar sobre uma campanha não escolhida.
  if (typeof fShowWelcome === 'function') fShowWelcome();
  else if (typeof fStartChat === 'function') fStartChat();
  // Estado inicial = HOME em tela cheia (vitrine de campanhas). O welcome acima
  // fica como fallback por trás; escolher uma campanha sai do modo home sozinho.
  if (typeof fGoHome === 'function') fGoHome();

  // Sincroniza variáveis e catálogo (pastas/templates) com o Supabase (offline-first).
  // Pastas (capas/materiais) e artes (rascunhos) refrescam a home quando chegam.
  const _fhRefresh = () => { if (typeof fHomeRefreshIfIdle === 'function') fHomeRefreshIfIdle(); };
  if (typeof dSyncVarsFromBackend === 'function') dSyncVarsFromBackend();
  if (typeof dSyncFoldersFromBackend === 'function') Promise.resolve(dSyncFoldersFromBackend()).then(_fhRefresh).catch(()=>{});
  if (typeof dSyncFontsFromBackend === 'function') dSyncFontsFromBackend();
  if (typeof dSyncSnippetsFromBackend === 'function') dSyncSnippetsFromBackend();
  if (typeof dSyncLibFromBackend === 'function') dSyncLibFromBackend();
  if (typeof fSyncArtesFromBackend === 'function') Promise.resolve(fSyncArtesFromBackend()).then(_fhRefresh).catch(()=>{});
}

// Inicializa a aba no startup e checa a autenticação
window.addEventListener('DOMContentLoaded', async () => {
  if (typeof gInitHelpChat === 'function') gInitHelpChat();
  setTimeout(dUpdateTabPill, 100);

  // Checa a sessão REAL do Supabase (assíncrono) antes de decidir login vs app.
  if (typeof gLoadProfile === 'function') { try { await gLoadProfile(); } catch(e){} }

  if (!gCurrentUser()) {
    // Não tem sessão ativa, bloqueia a UI
    document.getElementById('g-login-screen').style.display = 'flex';
  } else {
    // Usuário logado, init normal
    gOnLoginSuccess();
  }
});
