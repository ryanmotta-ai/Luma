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

/* ── ANALYTICS (backlog 5.1): eventos de uso em analytics.fct_eventos ──
   Fire-and-forget e à prova de falha: analytics NUNCA quebra o fluxo do usuário.
   RLS exige user_id = auth.uid() (anti-spoofing) → só emite logado.
   ATENÇÃO (Pedro): requer o schema `analytics` em Settings › API › Exposed schemas;
   se não estiver exposto, o insert falha em silêncio (console.warn) — decisão de
   dashboard, não de código. Nomes de evento: objeto_acao_passada (snake_case). */
function gTrackEvent(evento, payload){
  try{
    const sb=gSupabase(); if(!sb) return;
    const user=(typeof gAuthState!=='undefined'&&gAuthState&&gAuthState.user)||null;
    if(!user||!user.id) return;
    sb.schema('analytics').from('fct_eventos').insert({
      evento:String(evento||'').slice(0,64),
      user_id:user.id,
      role:user.role||null,
      payload:payload||null,
    }).then(({error})=>{ if(error) console.warn('[analytics]', evento, error.message||error); });
  }catch(e){ console.warn('[analytics]', e); }
}

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
