/**
 * js/core/ai/ai-provedores.js
 *
 * CONTAS DE IA PRÓPRIAS — a pessoa liga a conta dela e as chamadas vão DIRETO do navegador ao
 * provedor. O Luma não guarda a chave no servidor, não passa pela Edge Function `ai` e não gasta a
 * cota diária do Creative (o custo é da conta dela). Hoje só o Creative pede isso (`gAskAI(…,
 * {provedor:true})` → `gProvChama`); o resto do Luma segue pela function.
 *
 * ⛔ ANTIGRAVITY NÃO É PROVEDOR AQUI (decisão de 15/10/2026, depois de pesquisar). O Google proíbe usar
 * o login do Antigravity/Gemini CLI em software de terceiros (OpenCode, OpenClaw, Claude Code…) e
 * há contas suspensas por isso nos fóruns oficiais — fazer o Luma pedir esse login seria expor a
 * pessoa a perder a conta dela. O caminho oficial para Gemini é a chave do Google AI Studio
 * (provedor `google`). `G_PROV_NAO_SUPORTADOS` existe para a tela explicar isso, não para esconder.
 *
 * Provedores (todos chamados do navegador, então precisam de CORS):
 *   · openrouter — "Entrar com OpenRouter" (OAuth PKCE oficial: devolve uma chave da própria pessoa) ou chave colada.
 *   · google     — chave do Google AI Studio (API nativa do Gemini).
 *   · 9router    — roteador local (http://localhost:20128/v1) ou o seu em um servidor; URL editável.
 *   · opencode   — OpenCode Zen. ⚠ Em 10/2026 o preflight (OPTIONS) deles devolve 404 e o navegador
 *                  bloqueia; o teste de conexão (`gProvTesta`) mostra isso em vez de fingir que funciona.
 *
 * A chave mora no localStorage DESTE navegador (uma entrada por usuário). É a mesma superfície de
 * qualquer dado do app: o que protege é o escape de tudo que vai a innerHTML (gEsc). A tela avisa.
 * ⛔ Nunca logar a chave, nunca pôr em telemetria, nunca em URL.
 *
 * Contrato: gProvChama NUNCA lança. Devolve o texto ou null (e deixa o motivo em gProvUltimoErro).
 * Depende de: core/auth.js (gCurrentUser), core/toast.js (gToast).
 */

const G_PROVEDORES = {
  openrouter: { nome: 'OpenRouter', tipo: 'openai', base: 'https://openrouter.ai/api/v1', oauth: true, chaveUrl: 'https://openrouter.ai/keys',
    desc: 'Centenas de modelos com uma conta só. A entrada é pelo site do OpenRouter — o Luma nunca vê a sua senha.' },
  google: { nome: 'Google AI Studio (Gemini)', tipo: 'gemini', base: 'https://generativelanguage.googleapis.com/v1beta', chaveUrl: 'https://aistudio.google.com/apikey',
    desc: 'O caminho oficial do Google para usar o Gemini. Crie uma chave grátis no AI Studio e cole aqui.' },
  '9router': { nome: '9router', tipo: 'openai', base: 'http://localhost:20128/v1', baseEditavel: true, chaveOpcional: true,
    desc: 'Seu roteador de IA. Local (porta 20128) ou em um servidor seu — informe o endereço. Tem que estar ligado e liberar o navegador (CORS).' },
  opencode: { nome: 'OpenCode Zen', tipo: 'openai', base: 'https://opencode.ai/zen/v1', baseEditavel: true, chaveUrl: 'https://opencode.ai/zen',
    desc: 'Modelos do OpenCode Zen com a sua chave. Atenção: o serviço pode bloquear chamadas direto do navegador — o teste de conexão diz.' }
};
const G_PROV_NAO_SUPORTADOS = {
  antigravity: { nome: 'Antigravity (Google)', motivo: 'O Google não permite usar o login do Antigravity em apps de terceiros, e contas já foram suspensas por isso. Use a chave do Google AI Studio, que é o caminho oficial.', alternativa: 'google' }
};
// Mesmos tetos da Edge Function (supabase/functions/ai POLITICA) para as tarefas do Creative; o teto de saída
// é folgado porque nos modelos que "pensam" ele inclui o raciocínio.
const G_PROV_POLITICA = { 'arte.compor': { max: 6000, temp: 0.8 }, 'arte.criticar': { max: 6000, temp: 0.3 } };
const G_PROV_TIMEOUT_MS = 60000;
let gProvUltimoErro = '';

const _gProvUid = () => { try{ const u = gCurrentUser(); return (u && u.id) || ''; }catch(e){ return ''; } };
const _gProvChave = () => 'luma_ia_prov:' + _gProvUid();

function gProvEstado(){
  _gProvAdotaPendente();
  const vazio = { ativo: null, p: {} };
  if(!_gProvUid()) return vazio;
  try{
    const v = JSON.parse(localStorage.getItem(_gProvChave()) || 'null');
    return v && typeof v === 'object' && v.p && typeof v.p === 'object' ? v : vazio;
  }catch(e){ return vazio; }
}
function _gProvSalva(est){ try{ localStorage.setItem(_gProvChave(), JSON.stringify(est)); return true; }catch(e){ return false; } }

// O provedor em uso: só vale com tudo que a chamada precisa (chave — salvo 9router, que pode não ter — e modelo).
function gProvAtivo(){
  const est = gProvEstado(), id = est.ativo, def = id && G_PROVEDORES[id], cfg = id && est.p[id];
  if(!def || !cfg || !cfg.modelo || (!cfg.key && !def.chaveOpcional)) return null;
  return { id, nome: def.nome, modelo: cfg.modelo, def, cfg };
}
function gProvConfig(id){ return gProvEstado().p[id] || null; }
function gProvConectado(id){ const c = gProvConfig(id), d = G_PROVEDORES[id]; return !!(c && d && (c.key || d.chaveOpcional) && (c.base || d.base)); }
// Conecta (ou atualiza) um provedor. `usa` o torna o ativo.
function gProvConecta(id, cfg, usa){
  const def = G_PROVEDORES[id]; if(!def || !_gProvUid()) return false;
  const est = gProvEstado(), ant = est.p[id] || {};
  est.p[id] = { key: String(cfg.key != null ? cfg.key : ant.key || '').trim(), base: String((def.baseEditavel && cfg.base) || ant.base || def.base).trim().replace(/\/+$/, ''), modelo: String(cfg.modelo != null ? cfg.modelo : ant.modelo || '').trim() };
  if(usa) est.ativo = id;
  return _gProvSalva(est);
}
function gProvDesconecta(id){
  const est = gProvEstado(); delete est.p[id]; if(est.ativo === id) est.ativo = null; return _gProvSalva(est);
}
function gProvUsa(id){ const est = gProvEstado(); est.ativo = (id && est.p[id]) ? id : null; return _gProvSalva(est); }
const gProvMascara = k => { k = String(k || ''); return k.length > 10 ? k.slice(0, 5) + '…' + k.slice(-4) : (k ? '••••' : ''); };

function _gProvErro(status, corpo){
  const msg = (() => { try{ const j = JSON.parse(corpo); return (j.error && (j.error.message || j.error)) || j.message || ''; }catch(e){ return ''; } })();
  if(status === 401 || status === 403) return 'O provedor recusou a chave (' + status + '). Confira se ela está certa e ativa.';
  if(status === 402) return 'Sem créditos nesse provedor (402).';
  if(status === 404) return 'Modelo ou endereço não encontrado (404): confira o modelo escolhido.';
  if(status === 429) return 'O provedor limitou as chamadas (429). Espere um pouco.';
  return 'O provedor respondeu ' + status + (msg ? ': ' + String(msg).slice(0, 120) : '.');
}
async function _gProvFetch(url, init, ms){
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), ms || G_PROV_TIMEOUT_MS);
  try{ return await fetch(url, Object.assign({}, init, { signal: ctrl.signal })); }
  finally{ clearTimeout(t); }
}
const _gProvRedeMsg = (def, e) => (e && e.name === 'AbortError') ? 'O provedor demorou demais para responder.'
  : 'Não consegui falar com ' + def.nome + '. Ele pode estar fora do ar ou bloqueando chamadas direto do navegador (CORS)' + (def.base.indexOf('localhost') >= 0 ? '; confira se está ligado' : '') + '.';
function _gProvHeaders(def, cfg){
  const h = { 'Content-Type': 'application/json' };
  if(def.tipo === 'gemini'){ if(cfg.key) h['x-goog-api-key'] = cfg.key; }
  else{ if(cfg.key) h.Authorization = 'Bearer ' + cfg.key; if(def.oauth) { h['HTTP-Referer'] = location.origin; h['X-Title'] = 'Luma'; } }
  return h;
}

/* Lista de modelos do provedor, para a pessoa escolher. [{id}] ou null (motivo em gProvUltimoErro). */
async function gProvModelos(id, cfgTeste){
  const def = G_PROVEDORES[id], cfg = cfgTeste || gProvConfig(id); gProvUltimoErro = '';
  if(!def || !cfg) return null;
  const base = (cfg.base || def.base).replace(/\/+$/, '');
  try{
    const r = await _gProvFetch(base + '/models', { headers: _gProvHeaders(def, cfg) }, 20000);
    if(!r.ok){ gProvUltimoErro = _gProvErro(r.status, await r.text().catch(() => '')); return null; }
    const j = await r.json();
    if(def.tipo === 'gemini') return (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => ({ id: String(m.name).replace(/^models\//, '') }));
    return (j.data || j.models || []).map(m => ({ id: String(m.id || m.name || '') })).filter(m => m.id);
  }catch(e){ gProvUltimoErro = _gProvRedeMsg(def, e); return null; }
}
/* Teste de conexão = conseguir listar os modelos. Devolve {ok, modelos, motivo}. */
async function gProvTesta(id, cfgTeste){
  const m = await gProvModelos(id, cfgTeste);
  return m ? { ok: true, modelos: m } : { ok: false, modelos: [], motivo: gProvUltimoErro || 'Falha na conexão.' };
}

/* A chamada. Mesmo contrato do gAskAI: texto ou null; nunca lança. */
async function gProvChama(task, prompt, opts){
  opts = opts || {}; gProvUltimoErro = '';
  const at = gProvAtivo();
  if(!at){ gProvUltimoErro = 'Nenhuma conta de IA ativa.'; return null; }
  const { def, cfg } = at, pol = G_PROV_POLITICA[task] || { max: 2048, temp: 0.6 };
  const parts = Array.isArray(opts.parts) ? opts.parts.filter(p => p && p.data) : [], base = (cfg.base || def.base).replace(/\/+$/, '');
  const querJson = opts.json !== false;
  let url, body;
  if(def.tipo === 'gemini'){
    url = base + '/models/' + encodeURIComponent(cfg.modelo) + ':generateContent';
    body = { contents: [{ role: 'user', parts: [{ text: prompt }].concat(parts.map(p => ({ inlineData: { mimeType: p.mimeType || 'image/jpeg', data: p.data } }))) }],
      generationConfig: Object.assign({ temperature: pol.temp, maxOutputTokens: pol.max }, querJson ? { responseMimeType: 'application/json' } : {}) };
  }else{
    url = base + '/chat/completions';
    const content = parts.length ? [{ type: 'text', text: prompt }].concat(parts.map(p => ({ type: 'image_url', image_url: { url: 'data:' + (p.mimeType || 'image/jpeg') + ';base64,' + p.data } }))) : prompt;
    body = { model: cfg.modelo, messages: [{ role: 'user', content }], temperature: pol.temp, max_tokens: pol.max, stream: false };
    if(querJson) body.response_format = { type: 'json_object' };
  }
  const envia = () => _gProvFetch(url, { method: 'POST', headers: _gProvHeaders(def, cfg), body: JSON.stringify(body) });
  try{
    let r = await envia();
    // Nem todo modelo aceita response_format: repete UMA vez sem ele (o parser do Creative tolera JSON embrulhado)
    if(r.status === 400 && body.response_format){ delete body.response_format; r = await envia(); }
    if(!r.ok){ gProvUltimoErro = _gProvErro(r.status, await r.text().catch(() => '')); return null; }
    const j = await r.json();
    const txt = def.tipo === 'gemini'
      ? ((j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || []).map(p => p.text || '').join('')
      : ((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '');
    const out = Array.isArray(txt) ? txt.map(x => x.text || '').join('') : String(txt || '');
    if(!out.trim()){ gProvUltimoErro = 'O modelo respondeu vazio. Tente outro modelo.'; return null; }
    return out;
  }catch(e){ gProvUltimoErro = _gProvRedeMsg(def, e); return null; }
}

/* ── OpenRouter: "Entrar com OpenRouter" (OAuth PKCE oficial). Sem segredo do app: o verifier nasce aqui
   e só quem o tem troca o código por uma chave. A volta é uma recarga da página (`?code=`): a troca
   acontece no boot, ainda sem saber quem está logado, então a chave espera no sessionStorage e é adotada
   quando o usuário aparece (_gProvAdotaPendente). ── */
const _gB64u = buf => btoa(String.fromCharCode.apply(null, new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function gProvOpenRouterEntrar(){
  try{
    const ver = _gB64u(crypto.getRandomValues(new Uint8Array(32)));
    const desafio = _gB64u(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ver)));
    sessionStorage.setItem('luma_or_ver', ver);
    const volta = location.origin + location.pathname;
    location.href = 'https://openrouter.ai/auth?callback_url=' + encodeURIComponent(volta) + '&code_challenge=' + desafio + '&code_challenge_method=S256';
  }catch(e){ if(typeof gToast === 'function') gToast('Não consegui iniciar a entrada pelo OpenRouter', 'error'); }
}
async function gProvRetornoOAuth(){
  let code = '', ver = '';
  try{ code = new URLSearchParams(location.search).get('code') || ''; ver = sessionStorage.getItem('luma_or_ver') || ''; }catch(e){}
  if(!code || !ver) return false;   // sem verifier nosso, o `code` é de outra coisa: não toca
  try{
    const u = new URL(location.href); u.searchParams.delete('code');
    history.replaceState(null, '', u.pathname + u.search + u.hash);   // o código não fica na barra
    sessionStorage.removeItem('luma_or_ver');
    const r = await _gProvFetch('https://openrouter.ai/api/v1/auth/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, code_verifier: ver, code_challenge_method: 'S256' }) }, 20000);
    const j = r.ok ? await r.json() : null;
    if(!j || !j.key) throw new Error('sem chave');
    sessionStorage.setItem('luma_or_pendente', j.key);
    sessionStorage.setItem('luma_abrir_conexoes', '1');
    return true;
  }catch(e){ try{ sessionStorage.setItem('luma_or_erro', '1'); }catch(x){} return false; }
}
function _gProvAdotaPendente(){
  let k = ''; try{ k = sessionStorage.getItem('luma_or_pendente') || ''; }catch(e){}
  if(!k || !_gProvUid()) return;
  try{ sessionStorage.removeItem('luma_or_pendente'); }catch(e){}
  const est = (() => { try{ const v = JSON.parse(localStorage.getItem(_gProvChave()) || 'null'); return v && v.p ? v : { ativo: null, p: {} }; }catch(e){ return { ativo: null, p: {} }; } })();
  est.p.openrouter = Object.assign({ base: G_PROVEDORES.openrouter.base, modelo: '' }, est.p.openrouter, { key: k });
  _gProvSalva(est);
}
// Roda no carregamento do script: a troca do código por chave não depende de quem está logado
const gProvRetorno = gProvRetornoOAuth();
