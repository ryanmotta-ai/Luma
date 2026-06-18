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
