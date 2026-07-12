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
  
  if (type === 'error') {
    const helpBtn = document.createElement('button');
    helpBtn.className = 'g-toast-help-btn';
    helpBtn.type = 'button';
    helpBtn.textContent = 'Como resolver? ❓';
    helpBtn.onclick = function(e) {
      e.stopPropagation();
      if (typeof gToggleHelpChat === 'function') {
        const win = document.getElementById('g-chat-window');
        if (win && !win.classList.contains('open')) {
          gToggleHelpChat();
        }
        if (typeof gSelectCommand === 'function') {
          gSelectCommand('fran_cors', 'Minhas fotos não carregam');
        }
      }
    };
    item.appendChild(helpBtn);
  }
  
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

/* ── HANDLER GLOBAL DE ERRO (H.3) ──
   Erro assíncrono não tratado morria em silêncio: o usuário clicava e "nada acontecia".
   Agora todo throw/rejeição não capturados viram UM toast honesto (+ console p/ debug).
   Throttle de 8s: um loop de erros não vira metralhadora de toasts.                  */
let _gLastErrToast=0;
function _gGlobalErrToast(){
  const now=Date.now();
  if(now-_gLastErrToast<8000) return;
  _gLastErrToast=now;
  try{ gToast('⚠ Algo deu errado — tente de novo. Se persistir, recarregue a página.','error'); }catch(e){}
}
window.addEventListener('error',(e)=>{
  // Erros de carregamento de recurso (img/script) não são falha de fluxo → só console
  if(e && e.target && e.target!==window && (e.target.tagName==='IMG'||e.target.tagName==='SCRIPT'||e.target.tagName==='LINK')){
    console.warn('[recurso falhou]', e.target.src||e.target.href||''); return;
  }
  console.error('[erro global]', (e&&e.error)||(e&&e.message)||e);
  _gGlobalErrToast();
}, true);
window.addEventListener('unhandledrejection',(e)=>{
  console.error('[rejeição não tratada]', e&&e.reason);
  _gGlobalErrToast();
});

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

/* ── DIÁLOGOS PRÓPRIOS DO LUMA (substituem confirm()/prompt() nativos) ──
   Promessa: gConfirm→bool, gPrompt→string|null (null = cancelado). Self-contained:
   injeta o próprio overlay com tokens do tema. Enter confirma, Esc/clique-fora cancela.
   Reutilizável em todo o app (migração gradual dos confirm/prompt nativos legados). */
function _gDialog(opts){
  return new Promise(resolve=>{
    const prev=document.activeElement;
    const isPrompt=!!opts.prompt;
    const ov=document.createElement('div');
    ov.className='g-dialog-ov';
    ov.style.cssText='position:fixed;inset:0;z-index:11000;display:flex;align-items:center;justify-content:center;background:rgba(10,10,10,.5);padding:20px';
    ov.innerHTML=`<div class="g-dialog" role="dialog" aria-modal="true" style="background:var(--white,#fff);color:var(--text,#0A0A0A);border:1px solid var(--gray-mid,rgba(0,0,0,.14));border-radius:12px;padding:20px;width:100%;max-width:400px;box-shadow:0 20px 50px rgba(0,0,0,.35);font-family:'Roboto',sans-serif">
      ${opts.title?`<div style="font-size:15px;font-weight:700;margin-bottom:8px">${gEsc(opts.title)}</div>`:''}
      ${opts.message?`<div style="font-size:13px;line-height:1.5;color:var(--text-2,#3A3A3A);margin-bottom:${isPrompt?'10px':'18px'}">${gEsc(opts.message)}</div>`:''}
      ${isPrompt?`<input class="g-dialog-input" type="text" value="${gEsc(opts.default||'')}" placeholder="${gEsc(opts.placeholder||'')}" style="width:100%;font-size:13px;padding:9px 11px;border:1px solid var(--gray-mid,rgba(0,0,0,.2));border-radius:7px;background:var(--white,#fff);color:var(--text,#0A0A0A);outline:none;margin-bottom:18px">`:''}
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="g-dialog-cancel" type="button" style="font-size:12px;font-weight:600;padding:8px 14px;border-radius:7px;border:1px solid var(--gray-mid,rgba(0,0,0,.2));background:transparent;color:var(--text-2,#3A3A3A);cursor:pointer">${gEsc(opts.cancelLabel||'Cancelar')}</button>
        <button class="g-dialog-ok" type="button" style="font-size:12px;font-weight:700;padding:8px 16px;border-radius:7px;border:1px solid ${opts.danger?'#C81818':'var(--dm-orange,#FF9000)'};background:${opts.danger?'#C81818':'var(--dm-orange,#FF9000)'};color:#fff;cursor:pointer">${gEsc(opts.okLabel||'Confirmar')}</button>
      </div>
    </div>`;
    document.body.appendChild(ov);
    const input=ov.querySelector('.g-dialog-input');
    const done=(val)=>{ ov.remove(); document.removeEventListener('keydown',onKey,true); if(prev&&prev.focus){try{prev.focus();}catch(e){}} resolve(val); };
    const onOk=()=>done(isPrompt?(input?input.value:''):true);
    const onCancel=()=>done(isPrompt?null:false);
    ov.querySelector('.g-dialog-ok').onclick=onOk;
    ov.querySelector('.g-dialog-cancel').onclick=onCancel;
    ov.addEventListener('mousedown',e=>{ if(e.target===ov) onCancel(); });
    function onKey(e){
      if(e.key==='Escape'){ e.preventDefault(); onCancel(); }
      else if(e.key==='Enter'){ e.preventDefault(); onOk(); }
    }
    document.addEventListener('keydown',onKey,true);
    setTimeout(()=>{ if(input){input.focus();input.select();} else { const ok=ov.querySelector('.g-dialog-ok'); if(ok)ok.focus(); } },30);
  });
}
function gConfirm(message, opts){ opts=opts||{}; return _gDialog({prompt:false, message, title:opts.title, okLabel:opts.okLabel, cancelLabel:opts.cancelLabel, danger:opts.danger}); }
function gPrompt(message, defaultVal, opts){ opts=opts||{}; return _gDialog({prompt:true, message, default:defaultVal||'', placeholder:opts.placeholder, title:opts.title, okLabel:opts.okLabel||'OK', cancelLabel:opts.cancelLabel}); }

// C6: aviso (uma vez por sessão) de que imagens enviadas não são persistidas.
// TODO(Fase 5): mover blobs para IndexedDB/Storage e remover este aviso.
let gImgPersistWarned=false;
function gWarnImagesNotPersisted(){
  if(gImgPersistWarned)return;
  gImgPersistWarned=true;
  gToast('⚠ As imagens enviadas não são salvas nesta versão — ao recarregar elas viram placeholder.', 'error');
}
