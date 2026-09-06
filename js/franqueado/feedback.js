/**
 * Feedback contextual e pedidos de conteúdo. Depende de gEsc/gUuid/gCurrentUser.
 * Guarda apenas IDs e metadados da ação; nunca retém o snapshot vivo do editor.
 * O banco confirma o envio e emite os eventos, sem um segundo coletor no cliente.
 */
const F_FEEDBACK_REASONS = {
  missing_format: 'Faltou um formato',
  no_suitable_art: 'Não encontrei uma arte adequada',
  editing_difficulty: 'Tive dificuldade para editar',
  confusing_information: 'As informações ficaram confusas',
  generation_download_issue: 'Tive um problema ao gerar ou baixar',
  other: 'Outro motivo'
};
const _fFeedbackViews = new Map();
const _fFeedbackMemory = new Map();
const _fFeedbackSending = new Map();

function _fFeedbackUid(){
  const user = typeof gCurrentUser === 'function' ? gCurrentUser() : null;
  return user && user.id ? String(user.id) : '';
}
function _fFeedbackRead(uid){
  let saved;
  try { saved = JSON.parse(localStorage.getItem('luma_feedback_v1:' + uid) || 'null'); } catch(e){}
  const memory = _fFeedbackMemory.get(uid);
  // A memória preserva o envio quando a quota ou o modo privado impede a escrita.
  const source = memory || saved || {};
  return {
    pending: Array.isArray(source.pending) ? source.pending.filter(r => r && r.user_id === uid).slice(0,30) : [],
    receipts: Array.isArray(source.receipts) ? source.receipts.filter(r => r && r.action_id).slice(-120) : []
  };
}
function _fFeedbackWrite(uid, data){
  _fFeedbackMemory.set(uid, data);
  try { localStorage.setItem('luma_feedback_v1:' + uid, JSON.stringify(data)); return true; } catch(e){ return false; }
}
function _fFeedbackReceipt(uid, action){
  return _fFeedbackRead(uid).receipts.find(r => r.action_id === action);
}
function _fFeedbackPending(uid, action){
  return _fFeedbackRead(uid).pending.find(r => r.action_id === action);
}
function _fFeedbackView(id){
  const view = _fFeedbackViews.get(id);
  return view && view.uid === _fFeedbackUid() && document.getElementById(id) ? view : null;
}
function _fFeedbackRepaint(uid, action){
  _fFeedbackViews.forEach((view, id) => {
    if (!document.getElementById(id)) { _fFeedbackViews.delete(id); return; }
    if (view.uid === uid && view.action === action && uid === _fFeedbackUid()) _fFeedbackRender(id);
  });
}

async function _fFeedbackSend(uid, action){
  if (!uid || uid !== _fFeedbackUid()) return false;
  const key = uid + ':' + action;
  if (_fFeedbackSending.has(key)) return _fFeedbackSending.get(key);
  const job = (async () => {
    const row = _fFeedbackPending(uid, action);
    if (!row) return !!_fFeedbackReceipt(uid, action);
    try {
      const sb = typeof gSupabase === 'function' ? gSupabase() : window.sb;
      if (!sb || !navigator.onLine) return false;
      // getSession waits for pending token refresh before the final ownership check.
      const sessionResult = await sb.auth.getSession();
      const session = sessionResult.data && sessionResult.data.session;
      if (sessionResult.error || !session || session.user.id !== uid || _fFeedbackUid() !== uid) return false;
      const {data, error} = await sb.schema('luma').rpc('submit_feedback', {p_feedback: row}).abortSignal(AbortSignal.timeout(15000));
      if (error || typeof data !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(data)) return false;
      const current = _fFeedbackRead(uid);
      current.pending = current.pending.filter(r => r.action_id !== action);
      current.receipts = current.receipts.filter(r => r.action_id !== action);
      current.receipts.push({action_id: action, id: data});
      current.receipts = current.receipts.slice(-120);
      _fFeedbackWrite(uid, current);
      // Uma sessão nova não recebe toast ou conteúdo da sessão anterior.
      if (_fFeedbackUid() === uid) gToast(row.type === 'content_request' ? 'Sugestão enviada à equipe' : 'Obrigado pelo seu feedback', 'success');
      return true;
    } catch(e){ return false; }
  })();
  _fFeedbackSending.set(key, job);
  _fFeedbackRepaint(uid, action);
  try { return await job; }
  finally { _fFeedbackSending.delete(key); _fFeedbackRepaint(uid, action); }
}

async function fFeedbackFlush(){
  const uid = _fFeedbackUid();
  if (!uid) return;
  for (const row of _fFeedbackRead(uid).pending){
    if (_fFeedbackUid() !== uid) break;
    if (!await _fFeedbackSend(uid, row.action_id)) break;
  }
}

function _fFeedbackRender(id){
  const view = _fFeedbackView(id);
  if (!view) return;
  const host = document.getElementById(id);
  const request = view.type === 'content_request';
  if (_fFeedbackReceipt(view.uid, view.action)){
    host.innerHTML = '<p class="f-feedback-confirmed" role="status">' + (request ? 'Sugestão enviada à equipe. Obrigado!' : 'Feedback enviado. Obrigado por ajudar a melhorar os materiais!') + '</p>';
    return;
  }
  const pending = _fFeedbackPending(view.uid, view.action);
  const sending = _fFeedbackSending.has(view.uid + ':' + view.action);
  const detail = request || view.negative || (pending && pending.rating === 'negative');
  const values = pending || view;
  const disabled = pending ? ' disabled' : '';
  host.innerHTML = '<h3 class="f-feedback-title">' + (request ? 'Que tipo de conteúdo você estava procurando?' : 'Tudo certo com essa campanha?') + '</h3>' +
    (request ? '<p class="f-feedback-help">Conte à equipe o que faltou no catálogo.</p>' : '') +
    (!detail ? '<div class="f-feedback-actions"><button type="button" data-feedback="positive"' + disabled + '>Sim</button><button type="button" data-feedback="negative"' + disabled + '>Tive dificuldade</button></div>' : '') +
    (detail ? '<form class="f-feedback-form"><fieldset' + disabled + '>' +
      (request ? '<label for="' + id + '-query">Conteúdo ou formato</label><input id="' + id + '-query" name="query" maxlength="240" required value="' + gEsc(values.query || '') + '" placeholder="Ex.: combo de hambúrguer para Story">' :
        '<fieldset class="f-feedback-reasons"><legend>O que aconteceu?</legend>' + Object.keys(F_FEEDBACK_REASONS).map((key,i) => '<label><input '+(i===0?'id="'+id+'-reason" ':'')+'type="radio" name="reason" required value="' + key + '"' + (values.reason === key ? ' checked' : '') + '>' + F_FEEDBACK_REASONS[key] + '</label>').join('') + '</fieldset>') +
      '<label for="' + id + '-comment">Quer contar mais? <span>(opcional)</span></label><textarea id="' + id + '-comment" name="comment" maxlength="1000" rows="3" placeholder="Se quiser, conte um pouco mais">' + gEsc(values.comment || '') + '</textarea></fieldset>' +
      (!pending ? '<div class="f-feedback-actions"><button type="submit" class="f-feedback-submit">' + (request ? 'Enviar sugestão' : 'Enviar feedback') + '</button><button type="button" data-feedback="cancel">' + (request ? 'Cancelar' : 'Voltar') + '</button></div>' : '') + '</form>' : '') +
    (pending ? '<p class="f-feedback-help" role="status">' + (sending ? 'Enviando…' : 'Envio pendente. Sua resposta continua aqui; tentaremos novamente quando a conexão voltar.') + '</p>' + (!sending ? '<div class="f-feedback-actions"><button type="button" data-feedback="retry">Tentar novamente</button></div>' : '') : '');
  host.setAttribute('aria-busy', sending ? 'true' : 'false');
  host.querySelectorAll('[data-feedback]').forEach(button => button.addEventListener('click', () => {
    const current = _fFeedbackView(id);
    if (!current) return;
    const action = button.dataset.feedback;
    if (action === 'positive') _fFeedbackSubmit(id, 'positive');
    if (action === 'negative') { current.negative = true; _fFeedbackRender(id); document.getElementById(id + '-reason').focus(); }
    if (action === 'retry') _fFeedbackSend(current.uid, current.action);
    if (action === 'cancel') {
      if (request) { host.remove(); _fFeedbackViews.delete(id); }
      else { current.negative = false; _fFeedbackRender(id); host.querySelector('button').focus(); }
    }
  }));
  const form = host.querySelector('form');
  if (form){
    form.addEventListener('input', () => {
      const current = _fFeedbackView(id); if (!current) return;
      const fields = new FormData(form);
      current.comment = String(fields.get('comment') || '');
      current.reason = String(fields.get('reason') || '');
      if (request) current.query = String(fields.get('query') || '');
    });
    form.addEventListener('submit', event => { event.preventDefault(); if (form.reportValidity()) _fFeedbackSubmit(id, request ? null : 'negative'); });
  }
}

async function _fFeedbackSubmit(id, rating){
  const view = _fFeedbackView(id); if (!view) return;
  const request = view.type === 'content_request';
  const query = String(view.query || '').trim().slice(0,240);
  if (request && !query) { gToast('Descreva o conteúdo que você precisa', 'error'); return; }
  if (rating === 'negative' && !Object.hasOwn(F_FEEDBACK_REASONS, view.reason || '')) { gToast('Escolha um motivo para o feedback', 'error'); return; }
  if (request) view.action = 'request:' + gNormBusca(query).replace(/\s+/g, ' ').trim();
  if (_fFeedbackReceipt(view.uid, view.action)) { _fFeedbackRender(id); return; }
  const store = _fFeedbackRead(view.uid);
  if (!_fFeedbackPending(view.uid, view.action)){
    if (store.pending.length >= 30){ gToast('Há respostas pendentes. Tente novamente quando a conexão voltar', 'error'); return; }
    store.pending.push(Object.assign({}, view.context, {
      id: gUuid(), user_id: view.uid, type: view.type, action_id: view.action,
      rating: rating, reason: rating === 'negative' ? view.reason : null,
      comment: String(view.comment || '').trim().slice(0,1000) || null,
      query: request ? query : null, source: view.source, client_created_at: new Date().toISOString()
    }));
    if (!_fFeedbackWrite(view.uid, store)) gToast('O navegador não conseguiu guardar esta resposta. Mantenha a página aberta até o envio', 'error');
  }
  await _fFeedbackSend(view.uid, view.action);
}

function _fFeedbackCreate(host, view){
  if (typeof host === 'string') host = document.getElementById(host);
  if (!host || !view.uid) return null;
  for (const [id, previous] of _fFeedbackViews){
    const element = document.getElementById(id);
    if (!element) { _fFeedbackViews.delete(id); continue; }
    if (previous.uid === view.uid && previous.action === view.action && host.contains(element)) return element;
  }
  const section = document.createElement('section');
  section.id = 'f-feedback-' + gUuid();
  section.className = 'f-feedback';
  section.setAttribute('aria-label', view.type === 'content_request' ? 'Sugestão de conteúdo' : 'Avaliar material');
  host.appendChild(section);
  _fFeedbackViews.set(section.id, view);
  _fFeedbackRender(section.id);
  return section;
}

function fFeedbackMount(snap, host, snapId, source){
  try {
    if (!snap || (!snap.histId && !snapId)) return null;
    const camp = snap.camp || {}, material = snap.material || {}, fmt = snap.fmt || {};
    if(_fFeedbackReceipt(_fFeedbackUid(),'art:'+String(snap.histId||snapId)))return null;
    return _fFeedbackCreate(host, {
      uid: _fFeedbackUid(), action: 'art:' + String(snap.histId || snapId), type: 'campaign_feedback',
      source: source === 'download' ? 'download' : 'generation',
      context: {
        camp_id: camp.id == null ? null : String(camp.id), camp_name: camp.name || null,
        template_id: material.remoteId || (material.id == null ? null : String(material.id)), template_name: material.name || null,
        fmt_id: typeof fmt === 'string' ? fmt : fmt.id || null, franchise_id: null
      }
    });
  } catch(e){ return null; }
}

function fFeedbackAfterDownload(snap, btn, snapId, tipo){
  // Jamais transformar um download concluído em erro por uma falha secundária de UI.
  try {
    const host = btn && btn.closest('.art-wrap');
    if (!host) return;
    const section = fFeedbackMount(snap, host, snapId, 'download');
    if (!section) return;
    const view = _fFeedbackViews.get(section.id);
    if (view && !_fFeedbackPending(view.uid, view.action)) view.source = 'download';
  } catch(e){}
}

function fFeedbackRequest(query, host){
  try {
    const uid = _fFeedbackUid();
    if (!uid) { gToast('Entre na sua conta para sugerir conteúdo', 'error'); return null; }
    query = String(query || '').trim().slice(0,240);
    const section = _fFeedbackCreate(host, {
      uid: uid, type: 'content_request', action: 'request:' + gNormBusca(query).replace(/\s+/g,' ').trim(),
      query: query, source: 'search', context: {camp_id:null, camp_name:null, template_id:null, template_name:null, fmt_id:null, franchise_id:null}
    });
    if (section) { const input = section.querySelector('input'); if (input) input.focus(); }
    return section;
  } catch(e){ return null; }
}

window.addEventListener('online', () => { fFeedbackFlush().catch(() => {}); });
// A sessão muda sem recarregar a página: não deixar comentários antigos no DOM.
if(typeof gSupabase==='function'&&gSupabase()?.auth?.onAuthStateChange){
  gSupabase().auth.onAuthStateChange((event,session)=>{
    _fFeedbackViews.forEach((view,id)=>{
      if(event==='SIGNED_OUT'||!session||session.user.id!==view.uid){document.getElementById(id)?.remove();_fFeedbackViews.delete(id);}
    });
  });
}
