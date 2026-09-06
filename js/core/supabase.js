/**
 * js/core/supabase.js
 *
 * Cria o client Supabase global `window.sb`, usado pela auth e pela camada
 * de persistência (fase 5.1). Carrega DEPOIS de assets/vendor/supabase.js
 * (que expõe window.supabase) e de supabase-config.js.
 *
 * DEFENSIVO: se as credenciais ainda não foram preenchidas (ou o SDK não
 * carregou), `window.sb` fica null e o app segue normalmente em modo local
 * (localStorage). Nada de quebrar o boot — a migração é incremental.
 *
 * Use sempre via gSupabase() / gHasBackend() em vez de tocar window.sb direto.
 */
(function () {
  function looksUnset(v) {
    return !v || typeof v !== 'string' || v.indexOf('COLE_') === 0;
  }

  var cfg = window.LUMA_SUPABASE || {};
  var configured = !looksUnset(cfg.url) && !looksUnset(cfg.anonKey);

  if (!configured) {
    window.sb = null;
    console.warn('[supabase] credenciais não configuradas em supabase-config.js — rodando em modo local (localStorage).');
    return;
  }
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    window.sb = null;
    console.warn('[supabase] supabase-js (assets/vendor/supabase.js) não carregou antes deste script.');
    return;
  }

  try {
    window.sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  } catch (e) {
    window.sb = null;
    console.warn('[supabase] falha ao criar o client:', e);
  }
})();

// Helpers globais (prefixo g*, padrão do projeto).
function gSupabase() { return window.sb; }
function gHasBackend() { return !!window.sb; }

/* Analytics mantém o motor existente. A RPC expõe só a escrita: o schema analytics
   continua fechado à API. UUID estável + fila por usuário sobrevivem a retry/reload
   sem transformar uma resposta de rede perdida em dois eventos. */
var gTrackEvent = (function(){
  const memory=new Map(), running=new Map(), confirmed=new Set();
  const prefix='luma_events_v1:', limit=200;
  function currentId(){
    return (typeof gAuthState!=='undefined' && gAuthState.user && gAuthState.user.id)||null;
  }
  function read(uid){
    let rows=memory.get(uid)||[];
    try{
      const saved=JSON.parse(localStorage.getItem(prefix+uid)||'[]');
      if(Array.isArray(saved)){
        const merged=new Map(saved.filter(x=>x&&x.user_id===uid&&x.id&&x.evento).map(x=>[x.id,x]));
        rows.forEach(x=>merged.set(x.id,x));
        rows=Array.from(merged.values()).slice(-limit);
      }
    }catch(e){}
    memory.set(uid,rows);
    return rows;
  }
  function write(uid,rows){
    memory.set(uid,rows);
    try{ localStorage.setItem(prefix+uid,JSON.stringify(rows)); }catch(e){}
  }
  async function bounded(request,controller){
    let timer;
    try{
      return await Promise.race([request,new Promise((resolve,reject)=>{
        timer=setTimeout(()=>{
          if(controller) controller.abort();
          reject(new Error('Tempo de envio excedido'));
        },12000);
      })]);
    }finally{ clearTimeout(timer); }
  }
  async function flush(uid){
    uid=uid||currentId();
    if(!uid || uid!==currentId()) return false;
    if(running.has(uid)) return running.get(uid);
    const work=(async()=>{
      const sb=gSupabase();
      if(!sb) return false;
      while(uid===currentId()){
        const row=read(uid)[0]; if(!row) return true;
        try{
          // O espelho do perfil pode estar atrasado durante a troca de conta.
          // Confira também a sessão que o SDK usará para assinar a requisição.
          const session=await bounded(sb.auth.getSession());
          if(session.error || session.data?.session?.user?.id!==uid || currentId()!==uid) return false;
          const controller=new AbortController();
          const {data,error}=await bounded(sb.schema('luma').rpc('registrar_evento',{
            p_id:row.id,p_evento:row.evento,p_payload:row.payload
          }).abortSignal(controller.signal),controller);
          if(error || data!==true) return false;
          confirmed.add(uid+':'+row.id);
          if(confirmed.size>1000) confirmed.delete(confirmed.values().next().value);
          write(uid,read(uid).filter(x=>x.id!==row.id));
        }catch(e){ return false; }
      }
      return false;
    })();
    running.set(uid,work);
    try{ return await work; }finally{ running.delete(uid); }
  }
  async function track(evento,payload,eventId){
    try{
      const uid=currentId(); if(!uid) return false;
      const name=String(evento||'').trim().slice(0,64); if(!name) return false;
      const id=eventId||gUuid();
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return false;
      if(confirmed.has(uid+':'+id)) return true;
      const rows=read(uid);
      if(!rows.some(x=>x.id===id)){
        const body=Object.assign({},payload||{});
        body.user_id=uid;
        body.client_created_at=body.client_created_at||new Date().toISOString();
        const serialized=JSON.stringify(body);
        // Deixa margem para o overhead JSONB do teto de 8192 bytes no banco.
        if(new TextEncoder().encode(serialized).length>7000) return false;
        if(rows.length>=limit) return false;
        rows.push({id,user_id:uid,evento:name,payload:JSON.parse(serialized)});
        write(uid,rows);
      }
      await flush(uid);
      return confirmed.has(uid+':'+id);
    }catch(e){ return false; }
  }
  track.flush=()=>flush();
  window.addEventListener('online',()=>{ flush(); });
  const sb=gSupabase();
  if(sb?.auth?.onAuthStateChange){
    sb.auth.onAuthStateChange(()=>{ setTimeout(()=>{ flush(); },0); });
  }
  return track;
})();

/* ── Fila de DELEÇÕES pendentes (anti-ressurreição) ──
   As deleções remotas eram fire-and-forget: se a rede/RLS falhasse, a linha ficava no banco
   e o item "ressuscitava" no pull seguinte. Agora: tenta na hora; falhou → entra na fila
   (localStorage) e re-tenta no boot. O pull do catálogo também filtra ids na fila, fechando
   a janela de ressurreição mesmo antes do retry vingar. */
const G_PENDING_DELETES_KEY='yngs_pending_deletes_v1';
function gPendingDeletes(){ try{ return JSON.parse(localStorage.getItem(G_PENDING_DELETES_KEY)||'[]'); }catch(e){ return []; } }
function _gSavePendingDeletes(q){ try{ localStorage.setItem(G_PENDING_DELETES_KEY, JSON.stringify(q.slice(-200))); }catch(e){} }
// Deleta table.col=val no schema luma. Falhou/offline → fila. Retorna true se deletou agora.
async function gRemoteDelete(table, col, val){
  const sb=gSupabase();
  if(sb){
    try{ const { error }=await sb.schema('luma').from(table).delete().eq(col, val); if(!error) return true; }catch(e){}
  }
  const q=gPendingDeletes();
  if(!q.some(x=>x.table===table&&x.col===col&&x.val===val)) q.push({table, col, val});
  _gSavePendingDeletes(q);
  return false;
}
// true se este id/valor está aguardando deleção (o pull usa pra não ressuscitar o item)
function gIsPendingDelete(table, val){ return gPendingDeletes().some(x=>x.table===table&&x.val===val); }
// Re-tenta a fila inteira (chamado no boot, antes dos syncs)
async function gFlushPendingDeletes(){
  const sb=gSupabase(); if(!sb) return;
  const q=gPendingDeletes(); if(!q.length) return;
  const left=[];
  for(const it of q){
    try{ const { error }=await sb.schema('luma').from(it.table).delete().eq(it.col, it.val); if(error) left.push(it); }
    catch(e){ left.push(it); }
  }
  _gSavePendingDeletes(left);
}
