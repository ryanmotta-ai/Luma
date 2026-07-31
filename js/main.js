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
  if(m!=='franqueado' && m!=='designer' && m!=='academia') m='franqueado';
  // Gate por role: franqueado NÃO acessa o Estúdio (trava no clique e via DOM/console).
  // A Academia é das TRÊS personas (o franqueado estuda; a equipe administra) — sem gate.
  if(m==='designer' && (typeof gIsAdmin!=='function' || !gIsAdmin())) m='franqueado';
  // Tema de campanha (Much+) veste só o Franqueado. Sair para o Estúdio sem despir
  // deixava o body com camp-theme-* → tokens/fonte magenta vazavam pro Estúdio inteiro.
  // Vale igual para a Academia: o magenta do Much+ não é a cor da formação.
  if(m!=='franqueado' && typeof fRemoveCampTheme==='function') fRemoveCampTheme();
  // Sair da Academia fecha os drawers de aula (senão o painel fixo do agente/estrutura
  // fica pairando por cima do Franqueado, que não tem como fechá-lo).
  if(m!=='academia' && typeof acFecharPaineis==='function') acFecharPaineis();
  // Troca só a classe de modo, preservando as demais (theme-light, rulers-on, simulating...)
  document.body.classList.remove('mode-franqueado','mode-designer','mode-academia');
  document.body.classList.add('mode-'+m);
  document.getElementById('tab-fran').classList.toggle('active', m==='franqueado');
  document.getElementById('tab-design').classList.toggle('active', m==='designer');
  const tabAcad = document.getElementById('tab-academia');
  if(tabAcad) tabAcad.classList.toggle('active', m==='academia');

  dUpdateTabPill();

  const ctxFran = document.getElementById('topbar-context-fran');
  const ctxDesign = document.getElementById('topbar-context-design');
  if(ctxFran) ctxFran.style.display = m==='franqueado'?'':'none';
  if(ctxDesign) ctxDesign.style.display = m==='designer'?'':'none';
  // Academia carrega lazy, como o Estúdio: só na primeira entrada paga o sync.
  if(m==='academia' && typeof acInit==='function') acInit();
  if(m==='designer'){
    dInit();
    // Entrar no Estúdio sempre cai na CASA (aba Campanhas), nunca no painel de Camadas —
    // que é o contexto de quem já está editando. Ir e voltar do Franqueado devolvia o
    // designer direto na arte que ele tinha aberto, sem passar pelo catálogo.
    // A arte NÃO é fechada: dLayers/dActiveTmplId seguem intactos (fechar aqui arriscaria
    // trabalho não salvo). Só o foco do painel volta pra casa.
    if(typeof dActivatePanel==='function') dActivatePanel('campaigns');
  }
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
  // Saída do login. Se o login estava VISÍVEL (usuário clicou Entrar), toca a tela
  // de transição de marca; o app monta por baixo enquanto o laranja cobre. No boot
  // com sessão ativa o login nunca apareceu → saída seca (sem transição fantasma).
  const _login = document.getElementById('g-login-screen');
  const _loginVisivel = _login && getComputedStyle(_login).display !== 'none';
  const _hideLogin = () => { if (_login) { _login.style.display = 'none'; _login.classList.remove('gl-out'); } };
  if (_loginVisivel && typeof gPlayLoginTransition === 'function') {
    gPlayLoginTransition(_hideLogin);
  } else if (_login) {
    _login.classList.add('gl-out');
    setTimeout(_hideLogin, 320);
  }
  dUpdateTabPill();

  if(typeof gUpdateUserTopbar === 'function') gUpdateUserTopbar();
  // pagina_aberta = todo carregamento (F5 conta); sessao_iniciada = 1x por sessão real do
  // navegador (sessionStorage sobrevive a F5, zera ao fechar a aba). Antes: sessao_iniciada
  // disparava a cada reload (inflava "sessões") e pagina_aberta, previsto no schema, nunca saía.
  if(typeof gTrackEvent === 'function'){
    gTrackEvent('pagina_aberta', {rota:'app'});
    let _novaSessao=true;
    try{ if(sessionStorage.getItem('__luma_sess')){ _novaSessao=false; } else { sessionStorage.setItem('__luma_sess','1'); } }catch(e){}
    if(_novaSessao) gTrackEvent('sessao_iniciada', {rota:'app'});
  }

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
  // silent no boot: a home entra já assentada (sem a cascata que deixava o corpo em
  // opacity:0), então ao sair do login/splash cai direto na vitrine cheia — sem flash vazio.
  if (typeof fGoHome === 'function') fGoHome({silent:true});

  // Sincroniza variáveis e catálogo (pastas/templates) com o Supabase (offline-first).
  // Pastas (capas/materiais) e artes (rascunhos) refrescam a home quando chegam.
  const _fhRefresh = () => { if (typeof fHomeRefreshIfIdle === 'function') fHomeRefreshIfIdle(); };
  // Deleções que falharam em sessões anteriores re-tentam ANTES dos pulls (anti-ressurreição)
  if (typeof gFlushPendingDeletes === 'function') { try { gFlushPendingDeletes(); } catch(e){} }
  if (typeof dSyncVarsFromBackend === 'function') dSyncVarsFromBackend();
  if (typeof dSyncFoldersFromBackend === 'function') Promise.resolve(dSyncFoldersFromBackend()).then(_fhRefresh).catch(()=>{});
  if (typeof dSyncFontsFromBackend === 'function') dSyncFontsFromBackend();
  if (typeof dSyncSnippetsFromBackend === 'function') dSyncSnippetsFromBackend();
  if (typeof dSyncLibFromBackend === 'function') dSyncLibFromBackend();
  if (typeof fSyncArtesFromBackend === 'function') Promise.resolve(fSyncArtesFromBackend()).then(_fhRefresh).catch(()=>{});
}

// Inicializa a aba no startup e checa a autenticação
window.addEventListener('DOMContentLoaded', async () => {
  // Tema salvo no perfil volta a valer após reload (antes: sempre resetava pro padrão)
  try {
    const _theme = localStorage.getItem('__luma_theme');
    if (_theme && typeof gProfileApplyTheme === 'function') gProfileApplyTheme(_theme);
  } catch(e) {}
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
  // Boot decidido (login exibido ou home renderizada) → libera o splash pra sair. Em rede lenta,
  // o splash segura até aqui (mín. 2.8s / teto 9s) em vez de revelar o app meio-carregado.
  if (typeof spBootReady === 'function') spBootReady();
});
