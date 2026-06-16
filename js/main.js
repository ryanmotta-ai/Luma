/**
 * js/main.js
 *
 * Bootstrap: setMode (troca entre franqueado/designer) e chamadas de inicializacao.
 * Deve ser carregado por ULTIMO (apos todos os modulos).
 */

/* ══════════════════════════════════════════════════════════════
   MODO SWITCH
══════════════════════════════════════════════════════════════ */
function setMode(m){
  // Troca só a classe de modo, preservando as demais (theme-light, rulers-on, simulating...)
  document.body.classList.remove('mode-franqueado','mode-designer','mode-dados');
  document.body.classList.add('mode-'+m);
  document.getElementById('tab-fran').classList.toggle('active', m==='franqueado');
  document.getElementById('tab-design').classList.toggle('active', m==='designer');
  const tabDados=document.getElementById('tab-dados');
  if(tabDados) tabDados.classList.toggle('active', m==='dados');
  document.getElementById('topbar-right-fran').style.display = m==='franqueado'?'':'none';
  document.getElementById('topbar-right-design').style.display = m==='designer'?'':'none';
  if(m==='designer') dInit();
  if(m==='dados' && typeof pInit==='function') pInit();
}


/* ══ INIT FRANQUEADO ══ */
fRenderCatalogs(CAMPS_ATIVAS,CAMPS_OUTRAS);
fRenderFmts();
fUpdateHistBadge();
fStartChat();
