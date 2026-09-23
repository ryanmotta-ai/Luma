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
/* FOTO DO HASH — tirada ANTES do createClient, de propósito.
   O link de e-mail (recuperação/convite) chega com a sessão no `#`, e o supabase-js
   (detectSessionInUrl) a materializa e APAGA o hash num tick assíncrono que roda antes
   de `auth.js`. Esta é a única janela em que o hash ainda existe. Aqui só se guarda a
   string crua; quem a interpreta é `gAuthLinkPendente()` no auth.js — o conhecimento de
   autenticação continua morando lá. */
var G_AUTH_LINK_HASH = (function () {
  try { return String((window.location && window.location.hash) || ''); } catch (e) { return ''; }
})();

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
  /* SESSÃO = ABA. O id mora no sessionStorage (sobrevive ao F5, zera na aba nova) e vai em todo
     evento como `_ctx.sid` — é por ele que o painel junta os eventos de uma visita. Sem
     sessionStorage (aba privada restrita), vale para esta página. */
  const sessao={id:null,t:Date.now()};
  try{ sessao.id=sessionStorage.getItem('luma_sid'); sessao.t=+sessionStorage.getItem('luma_sid_t')||sessao.t; }catch(e){}
  if(!sessao.id){
    sessao.id=gUuid();
    try{ sessionStorage.setItem('luma_sid',sessao.id); sessionStorage.setItem('luma_sid_t',String(sessao.t)); }catch(e){}
  }
  // `?v=` do próprio script: diz de qual deploy veio o evento. `currentScript` só existe
  // agora, na carga; o seletor é a rede (o vendor também se chama supabase.js, daí o `core/`).
  const versao=(function(){
    try{
      const s=(document.currentScript&&document.currentScript.src)
        ||(document.querySelector('script[src*="core/supabase.js"]')||{}).src||'';
      const m=s.match(/[?&]v=(\d+)/); return m?+m[1]:null;
    }catch(e){ return null; }
  })();
  function contexto(){
    try{
      const w=window.innerWidth||0, ua=navigator.userAgent||'';
      // Ordem importa: Samsung e Edge também dizem "Chrome/"; Chrome também diz "Safari/".
      const nav=/SamsungBrowser/.test(ua)?'samsung':/\bEdg(e|A|iOS)?\//.test(ua)?'edge'
        :/Firefox\/|FxiOS/.test(ua)?'firefox':/Chrome\/|CriOS/.test(ua)?'chrome'
        :/Safari\//.test(ua)?'safari':'outro';
      const c={sid:sessao.id, disp:w<680?'mobile':w<1024?'tablet':'desktop',
        vw:w, vh:window.innerHeight||0, nav, v:versao};
      // Área = a classe de modo do body (setMode, main.js): franqueado/designer/academia/calendario.
      const area=((document.body&&String(document.body.className||''))||'').match(/\bmode-(\w+)/);
      if(area) c.area=area[1];
      return c;
    }catch(e){ return null; }
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
  // Conta a falha NA LINHA, não numa variável solta: a fila sobrevive a reload e o contador
  // precisa sobreviver junto, senão a pílula volta zerada a cada abertura do app.
  function _marcarTentativa(uid,id){
    const rows=read(uid);
    const alvo=rows.find(x=>x&&x.id===id);
    if(!alvo) return;
    alvo._tent=(alvo._tent||0)+1;
    write(uid,rows);
  }
  async function flush(uid){
    uid=uid||currentId();
    if(!uid || uid!==currentId()) return false;
    if(running.has(uid)) return running.get(uid);
    const work=(async()=>{
      const sb=gSupabase();
      if(!sb) return false;
      while(uid===currentId()){
        // O `sessao_encerrada` DESTA aba fica na fila até ela acabar (ver `encerra`).
        const row=read(uid).find(x=>x.id!==sessao.id); if(!row) return true;
        /* PÍLULA ENVENENADA: um evento que o RPC rejeita SEMPRE (payload que o schema recusa)
           ficava eternamente na cabeça da fila. A fila enchia até o teto e, a partir dali,
           `track` recusava TODO evento novo — a telemetria morria inteira por causa de um. */
        if((row._tent||0)>=3){
          console.warn('[telemetria] evento descartado após 3 tentativas:', row.evento);
          write(uid,read(uid).filter(x=>x.id!==row.id));
          continue;
        }
        try{
          // O espelho do perfil pode estar atrasado durante a troca de conta.
          // Confira também a sessão que o SDK usará para assinar a requisição.
          const session=await bounded(sb.auth.getSession());
          if(session.error || session.data?.session?.user?.id!==uid || currentId()!==uid) return false;
          const controller=new AbortController();
          const {data,error}=await bounded(sb.schema('luma').rpc('registrar_evento',{
            p_id:row.id,p_evento:row.evento,p_payload:row.payload
          }).abortSignal(controller.signal),controller);
          if(error || data!==true){ _marcarTentativa(uid,row.id); return false; }
          confirmed.add(uid+':'+row.id);
          if(confirmed.size>1000) confirmed.delete(confirmed.values().next().value);
          write(uid,read(uid).filter(x=>x.id!==row.id));
        }catch(e){ _marcarTentativa(uid,row.id); return false; }
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
        if(body._ctx==null){ const c=contexto(); if(c) body._ctx=c; }
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
  /* sessao_encerrada: UMA linha por sessão, com a duração FINAL. Cada saída da aba (trocar de
     aba, minimizar, fechar) regrava a MESMA linha da fila (id = sid) sem tocar a rede — o unload
     nunca espera. O flush desta aba a segura; ela sobe no primeiro flush da PRÓXIMA sessão.
     Enviar já na primeira saída cravaria no banco (on conflict do nothing) a duração até a
     primeira troca de aba. `pagehide` só conta se a aba ainda estava visível: fechar uma aba
     esquecida em segundo plano não pode somar as horas em que ninguém olhava. */
  function encerra(){
    try{
      const uid=currentId(); if(!uid) return;
      const rows=read(uid).filter(x=>x.id!==sessao.id);
      if(rows.length>=limit) return;
      const payload={dur_s:Math.max(0,Math.round((Date.now()-sessao.t)/1000)), user_id:uid,
        client_created_at:new Date().toISOString()};
      const c=contexto(); if(c) payload._ctx=c;
      rows.push({id:sessao.id,user_id:uid,evento:'sessao_encerrada',payload});
      write(uid,rows);
    }catch(e){}
  }
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden') encerra(); });
  window.addEventListener('pagehide',()=>{ if(document.visibilityState!=='hidden') encerra(); });
  /* erro_app: o erro que o franqueado vive como "travou" e nunca reporta. Teto de 5 por sessão e
     um por mensagem — um laço de erro não pode virar enxurrada. Só o que é DO Luma: script de
     outra origem (extensão) e o ruído benigno do ResizeObserver ficam de fora. */
  const errVistos=(function(){ try{ return JSON.parse(sessionStorage.getItem('luma_err')||'[]'); }catch(e){ return []; } })();
  function erroApp(msg,url,linha,tipo){
    try{
      msg=String(msg||'').slice(0,160);
      if(!msg||/ResizeObserver loop|^Script error\.?$/i.test(msg)) return;
      if(url){ try{ if(new URL(url,location.href).origin!==location.origin) return; }catch(e){ return; } }
      if(!currentId()||errVistos.length>=5||errVistos.includes(msg)) return;
      errVistos.push(msg);
      try{ sessionStorage.setItem('luma_err',JSON.stringify(errVistos)); }catch(e){}
      track('erro_app',{msg, src:url?String(url).split(/[?#]/)[0].split('/').slice(-2).join('/'):null,
        linha:linha||null, tipo});
    }catch(e){}
  }
  window.addEventListener('error',e=>{ if(e&&e.message!=null) erroApp(e.message,e.filename,e.lineno,'erro'); });
  window.addEventListener('unhandledrejection',e=>{
    try{
      const r=e&&e.reason, st=String((r&&r.stack)||'');
      if(/-extension:\/\//.test(st)) return;
      const m=st.match(/(https?:\/\/[^\s()]+?|file:\/\/[^\s()]+?):(\d+):\d+/);
      erroApp((r&&r.message)||r, m&&m[1], m&&+m[2], 'promessa');
    }catch(_){}
  });
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
