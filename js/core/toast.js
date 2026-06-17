/**
 * js/core/toast.js
 *
 * gToast(msg) — exibe notificacao flutuante de 2.8s.
 * Depende de: nada (usa apenas o DOM).
 */

function gToast(msg, type){
  const container = document.getElementById('g-toast-container');
  if (!container) return;
  
  const item = document.createElement('div');
  item.className = 'g-toast-item';
  if (type === 'error') item.classList.add('g-toast-error');
  
  // Acessibilidade (a11y)
  item.setAttribute('role', type === 'error' ? 'alert' : 'status');
  item.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  
  item.textContent = msg;
  container.appendChild(item);
  
  const duration = type === 'error' ? 4200 : 2800;
  
  // Configura a remoção com transição de fade-out
  setTimeout(() => {
    item.classList.add('hide');
    setTimeout(() => {
      item.remove();
    }, 300); // tempo correspondente ao transition no CSS
  }, duration);
}

// gEsc(s) — escapa HTML. Use SEMPRE que dado do usuário (resposta do chat, nome de
// produto, célula de CSV, nome de template) for interpolado em innerHTML — evita XSS (H.1).
function gEsc(s){
  return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// M1.2 — estado de loading num botão de ação assíncrona: troca o conteúdo por um
// spinner minimalista, deixa opacity 0.7 e bloqueia cliques. Retorna função de restore.
function gBtnLoading(btn, label){
  if(!btn) return ()=>{};
  if(btn._loadingRestore) return btn._loadingRestore; // já em loading
  const prevHTML=btn.innerHTML;
  const prevPE=btn.style.pointerEvents;
  const prevOp=btn.style.opacity;
  btn.classList.add('is-loading');
  btn.style.pointerEvents='none';
  btn.style.opacity='0.7';
  btn.innerHTML=`<span class="mini-spinner" aria-hidden="true"></span>${label?`<span style="margin-left:6px">${label}</span>`:''}`;
  const restore=()=>{
    btn.innerHTML=prevHTML;
    btn.style.pointerEvents=prevPE;
    btn.style.opacity=prevOp;
    btn.classList.remove('is-loading');
    btn._loadingRestore=null;
  };
  btn._loadingRestore=restore;
  return restore;
}

// C6: aviso (uma vez por sessão) de que imagens enviadas não são persistidas.
// TODO(Fase 5): mover blobs para IndexedDB/Storage e remover este aviso.
let gImgPersistWarned=false;
function gWarnImagesNotPersisted(){
  if(gImgPersistWarned)return;
  gImgPersistWarned=true;
  gToast('⚠ As imagens enviadas não são salvas nesta versão — ao recarregar elas viram placeholder.', 'error');
}
