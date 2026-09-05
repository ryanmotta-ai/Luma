/**
 * js/core/toast.js
 *
 * gToast(msg) — exibe notificacao flutuante de 2.8s.
 * Depende de: nada (usa apenas o DOM).
 */

/* ⛔ DECISÃO DE PRODUTO (2026-08-12, pedido do dono): o Luma NÃO alarma. Nenhum toast
   vermelho, em nenhum módulo, mesmo quando algo falha. O corte é aqui, no motor único —
   as 171 chamadas gToast(msg,'error') espalhadas pelo app continuam existindo e não
   precisaram ser tocadas; elas simplesmente não pintam mais nada.

   ⚠ CORREÇÃO 2026-08-13 — o corte era um `return`, e isso ia LONGE demais: a falha ficava
   MUDA. Boa parte dessas chamadas não é alarme, é INSTRUÇÃO ("converta o vídeo para MP4",
   "selecione ao menos uma camada", "sua sessão expirou"). Sem a mensagem, a pessoa clicava,
   nada acontecia e não havia caminho de saída — o oposto de "erro sempre diz o que fazer"
   (03_ENGINEERING §5). Agora o tipo 'error' perde a COR, o role=alert e o botão de orientação,
   mas a MENSAGEM aparece como toast NEUTRO, que é o que a decisão pedia. O console segue
   recebendo o registro para depuração. Reverter o não-alarmar = apagar este bloco. */
function gToast(msg, type, helpTopic){
  if (type === 'error') { try{ console.warn('[Luma]', msg); }catch(e){} }
  const container = document.getElementById('g-toast-container');
  if (!container) return;

  // Daqui pra baixo só existe toast NEUTRO — não há mais ramo de erro, e com ele foram embora
  // o botão "Ver orientação" e o role=alert, que só valiam pro toast vermelho. A assinatura
  // mantém `helpTopic` porque há chamadas passando o 3º argumento.
  const item = document.createElement('div');
  item.className = 'g-toast-item';
  item.setAttribute('role', 'status');
  item.setAttribute('aria-live', 'polite');
  item.textContent = msg;

  container.appendChild(item);

  const duration = 2800;

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

// gSafeColor(v, fb) — cor vinda do banco/localStorage (cor da campanha) entrava crua em
// style="background:…". gEsc não resolve aqui: o vetor não é a aspa, é o ";" — um valor
// como "#fff;display:none" injeta CSS e some com o card. Whitelist das formas que o Luma
// realmente usa; qualquer outra coisa cai no fallback (laranja da marca).
function gSafeColor(v, fb){
  const s = String(v==null?'':v).trim();
  if(/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;              // hex 3/4/6/8
  if(/^rgba?\(\s*[0-9.,%\s/]+\)$/.test(s)) return s;       // rgb() / rgba()
  if(/^var\(--[a-zA-Z0-9-]+\)$/.test(s)) return s;         // token do design system
  if(/^[a-zA-Z]{3,20}$/.test(s)) return s;                 // nome CSS (white, transparent…)
  return fb || 'var(--dm-orange)';
}

/* ── HANDLER GLOBAL DE ERRO (H.3) ──
   Erro assíncrono não tratado ia pra um toast único com throttle de 8s. Com a decisão de
   não alarmar (ver gToast acima), o toast — e todo o aparato de throttle/guarda de splash
   que existia só pra ele — saiu: o registro agora é só console. Os listeners ficam porque
   o console é o ÚNICO lugar em que essas falhas aparecem daqui pra frente.            */
window.addEventListener('error',(e)=>{
  // Erros de carregamento de recurso (img/script) não são falha de fluxo → só console
  if(e && e.target && e.target!==window && (e.target.tagName==='IMG'||e.target.tagName==='SCRIPT'||e.target.tagName==='LINK')){
    console.warn('[recurso falhou]', e.target.src||e.target.href||''); return;
  }
  console.error('[erro global]', (e&&e.error)||(e&&e.message)||e);
}, true);
window.addEventListener('unhandledrejection',(e)=>{
  console.error('[rejeição não tratada]', e&&e.reason);
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
    // Estilo em css/modules/toolbar.css (.g-dialog*). Era tudo inline com hex cru aqui — o único
    // componente da casa que não acompanhava o design system.
    ov.innerHTML=`<div class="g-dialog${isPrompt?' has-input':''}" role="dialog" aria-modal="true">
      ${opts.title?`<div class="g-dialog-title">${gEsc(opts.title)}</div>`:''}
      ${opts.message?`<div class="g-dialog-msg">${gEsc(opts.message)}</div>`:''}
      ${isPrompt?`<input class="g-dialog-input" type="text" value="${gEsc(opts.default||'')}" placeholder="${gEsc(opts.placeholder||'')}">`:''}
      <div class="g-dialog-acts">
        <button class="g-dialog-cancel" type="button">${gEsc(opts.cancelLabel||'Cancelar')}</button>
        <button class="g-dialog-ok${opts.danger?' danger':''}" type="button">${gEsc(opts.okLabel||'Confirmar')}</button>
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
  gToast('As imagens enviadas não são salvas nesta versão — ao recarregar elas viram placeholder.', 'error');
}
