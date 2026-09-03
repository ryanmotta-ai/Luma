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

/* ── CONTROLE DO PRODUTO: gate de módulo ─────────────────────────
   A chave de cada aba da topbar. O Controle do produto pode desligar um módulo
   inteiro sem deploy; aqui é onde isso vira navegação bloqueada. */
const G_MODE_FEATURE = { franqueado:'module.franqueado', designer:'module.designer', academia:'module.academia' };

// Um modo só abre se a role permite E a flag permite.
function gModeAllowed(m){
  // Estúdio e Vídeo são ferramentas da equipe. O Vídeo por um motivo extra: é
  // desktop-only e exporta em tempo real — o celular do franqueado não dá conta.
  if((m==='designer' || m==='video') && (typeof gIsAdmin!=='function' || !gIsAdmin())) return false;
  if(typeof gFeatureCan!=='function') return true;   // sem o motor, nada muda
  return gFeatureCan(G_MODE_FEATURE[m]||'', 'access');
}

// Primeiro modo que esta pessoa pode abrir agora. null = nenhum.
function gFirstAllowedMode(){
  return ['franqueado','academia','designer','video'].find(gModeAllowed) || null;
}

/* Todos os módulos desligados: em vez de deixar o app numa tela em branco (que
   parece defeito), diz o que houve. A gestão continua com o painel da conta na
   topbar — é de lá que ela religa. Criado por JS, com tokens inline no padrão de
   _gDialog (toast.js): é uma view de emergência, não merece HTML/CSS versionado. */
function _gShowNoModuleView(){
  if(document.getElementById('g-no-module')) return;
  const box=document.createElement('div');
  box.id='g-no-module';
  box.setAttribute('role','status');
  box.style.cssText='position:fixed;inset:52px 0 0 0;z-index:400;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:32px;text-align:center;background:var(--off-white);color:var(--text-3);font-family:\'Roboto\',sans-serif';
  box.innerHTML='<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v6c0 4.4-3 8.3-7 9-4-.7-7-4.6-7-9V6Z"/><path d="M12 9v4M12 16h.01"/></svg>'
    +'<strong style="color:var(--text);font-size:16px;font-weight:900">O Luma está em manutenção</strong>'
    +'<p style="max-width:380px;margin:0;font-size:13px;line-height:1.55">As áreas do produto estão temporariamente indisponíveis. Fale com a gestão da Delivery Much.</p>';
  document.body.appendChild(box);
}
function _gHideNoModuleView(){
  const el=document.getElementById('g-no-module');
  if(el) el.remove();
}

// Clique na logo do topbar: sempre volta pra home do app (Franqueado > Catálogo),
// saindo de qualquer aba/estado em que a pessoa esteja.
function gGoHome(){
  setMode('franqueado');
  if(typeof fState!=='undefined') fState.materialView = false;
  const matView = document.getElementById('f-material-view');
  if(matView) matView.style.display = 'none';
  const chatCol = document.getElementById('f-chat-col');
  if(chatCol) chatCol.style.display = '';
  if(typeof fGoHome==='function') fGoHome({silent:true});
  const btnCatalogo = document.querySelector('.f-tab[data-feature="franqueado.catalogo"]');
  if(typeof fSwitchTab==='function') fSwitchTab('catalogo', btnCatalogo);
  if(typeof fMobileBackToCatalog==='function') fMobileBackToCatalog();
}

function setMode(m){
  if(m!=='franqueado' && m!=='designer' && m!=='academia' && m!=='video') m='franqueado';
  // Gate por role: franqueado NÃO acessa o Estúdio (trava no clique e via DOM/console).
  // A Academia é das TRÊS personas (o franqueado estuda; a equipe administra) — sem gate.
  if((m==='designer' || m==='video') && (typeof gIsAdmin!=='function' || !gIsAdmin())) m='franqueado';
  // Gate por flag. Vem DEPOIS do gate de role e cobre todo caminho de entrada:
  // clique na aba, chamada pelo console e estado restaurado de sessão anterior.
  if(!gModeAllowed(m)){
    const alvo=gFirstAllowedMode();
    if(!alvo){ _gShowNoModuleView(); return; }
    if(typeof gFeatureBlockedFeedback==='function') gFeatureBlockedFeedback(G_MODE_FEATURE[m]);
    m=alvo;
  }
  _gHideNoModuleView();
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
  // Lembra o modo p/ o F5 voltar onde estava (restaurado no boot por gRestoreMode).
  try{ localStorage.setItem('__luma_mode', m); }catch(e){}
}
// Restaura o modo salvo no boot. Só troca se NÃO for franqueado (que é o default do boot)
// e se o role/flag permitirem — setMode já reforça os dois gates, então é seguro chamar.
function gRestoreMode(){
  let m=null; try{ m=localStorage.getItem('__luma_mode'); }catch(e){}
  if(!m || m==='franqueado' || typeof setMode!=='function') return;
  // fGoHome (boot) deixou body.f-home-mode — a vitrine em tela cheia. setMode troca a
  // classe de modo mas NÃO tira f-home-mode, então a home cobria o Estúdio ("voltou pra
  // home"). fExitHome remove a classe antes de restaurar.
  if(typeof fExitHome==='function') fExitHome();
  setMode(m);
  // Fora da home o splash (boas-vindas de marca) é ruído a cada F5 no Estúdio/Academia:
  // dispensa na hora (spDismiss ignora o mínimo de 2.8s).
  if(typeof spDismiss==='function') spDismiss();
}

// Mostra a aba Designer só pra persona Designer (equipe_dm/gestao).
// Franqueado fica restrito à própria área. A RLS já protege o conteúdo no backend;
// isto é o gate de navegação no front.
function gApplyModeAccess(){
  const isAdmin = (typeof gIsAdmin==='function') && gIsAdmin();
  const tabDesign = document.getElementById('tab-design');
  if(tabDesign) tabDesign.style.display = isAdmin ? '' : 'none';
  // Módulo desativado some da topbar junto com a rota (setMode já bloqueia o
  // acesso; aqui é o CTA que também precisa sumir, senão o clique só frustra).
  [['tab-fran','franqueado'],['tab-academia','academia'],['tab-design','designer']].forEach(([id,modo])=>{
    const tab=document.getElementById(id);
    if(tab && !gModeAllowed(modo)) tab.style.display='none';
  });
  // Estáticos com data-feature (toolbar do Estúdio, abas, downloads).
  if(typeof gFeatureApplyToDOM==='function') gFeatureApplyToDOM();

  const atual = document.body.classList.contains('mode-designer') ? 'designer'
              : (document.body.classList.contains('mode-academia') ? 'academia' : 'franqueado');
  if(!gModeAllowed(atual)){
    const alvo=gFirstAllowedMode();
    if(alvo) setMode(alvo); else _gShowNoModuleView();
  }
  dUpdateTabPill();
}

// A gestão mudou uma flag (nesta aba ou em outra máquina) → a navegação se
// reconstrói na hora. Re-render localizado, nunca reload da página.
window.addEventListener('luma:feature-flags-changed', ()=>{
  if(typeof gCurrentUser==='function' && !gCurrentUser()) return;
  gApplyModeAccess();
  // Ferramenta desligada COM ELA EM USO: cai na seleção em vez de continuar
  // ativa com o botão já escondido (o clique seguinte criaria a camada que a
  // gestão acabou de proibir). dSetTool trata a queda; aqui é só o gatilho.
  if(typeof dTool!=='undefined' && typeof gFeatureToolBlocked==='function'
     && gFeatureToolBlocked(dTool) && typeof dSetTool==='function'){
    dSetTool('select');
  }
});

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

  // Estado remoto das flags: só agora, porque a RLS exige sessão. Assíncrono de
  // propósito — o boot já montou com o cache e não espera a rede. Ao chegar,
  // dispara luma:feature-flags-changed e a navegação se reconstrói sozinha.
  if (typeof gFeatureSyncFromBackend === 'function') { gFeatureSyncFromBackend(); }

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
  // Campanha aberta antes do F5 (lida ANTES do fGoHome, que só limpa em clique real de home).
  let _bootCamp=null; try{ _bootCamp=localStorage.getItem('__luma_camp'); }catch(e){}
  if (typeof fGoHome === 'function') fGoHome({silent:true, boot:true});
  // F5 volta pro modo onde o usuário estava (Estúdio/Academia), não sempre pra home.
  // Depois do fGoHome de propósito: a home do franqueado fica montada por trás.
  gRestoreMode();

  // Sincroniza variáveis e catálogo (pastas/templates) com o Supabase (offline-first).
  // Pastas (capas/materiais) e artes (rascunhos) refrescam a home quando chegam.
  const _fhRefresh = () => { if (typeof fHomeRefreshIfIdle === 'function') fHomeRefreshIfIdle(); };
  // F5 dentro de uma campanha reabre ela — só depois das pastas descerem (materiais dependem
  // do catálogo). Só no Franqueado (Estúdio/Academia já foram restaurados por gRestoreMode).
  const _restoreCamp = () => {
    if(!_bootCamp || document.body.classList.contains('mode-designer') || document.body.classList.contains('mode-academia')) return;
    if(typeof fResolveCamp==='function' && typeof fSelectCamp==='function' && fResolveCamp(_bootCamp)){
      fSelectCamp(_bootCamp); _bootCamp=null; // uma vez só
    }
  };
  // Deleções que falharam em sessões anteriores re-tentam ANTES dos pulls (anti-ressurreição)
  if (typeof gFlushPendingDeletes === 'function') { try { gFlushPendingDeletes(); } catch(e){} }
  if (typeof dSyncVarsFromBackend === 'function') dSyncVarsFromBackend();
  if (typeof dSyncFoldersFromBackend === 'function') Promise.resolve(dSyncFoldersFromBackend()).then(()=>{ _fhRefresh(); _restoreCamp(); }).catch(()=>{});
  else _restoreCamp(); // sem sync (offline): tenta com o catálogo local
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

  // Controle do produto ANTES do gLoadProfile: é síncrono (registro + cache local)
  // e precisa estar aplicado antes de qualquer módulo montar. Sem isto acontece o
  // flash "ferramenta aparece → flags carregam → ferramenta some".
  if (typeof gFeatureInit === 'function') { try { gFeatureInit(); } catch(e){} }

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
