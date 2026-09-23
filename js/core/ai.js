/**
 * js/core/ai.js
 *
 * MOTOR ÚNICO de IA do front. Todo recurso de IA do Luma (legenda, encurtar
 * texto, ajuda, leitura de cardápio, casar fotos, mapear camadas do PSD) fala com o modelo POR AQUI —
 * ninguém mais monta fetch pro Gemini na mão. Um caminho = um lugar pra trocar
 * de modelo, pôr timeout, cachear e tratar falha.
 *
 * Caminho ÚNICO: Edge Function `ai` (supabase/functions/ai) — a chave mora no servidor
 * (secret GEMINI_API_KEY). ⛔ Não existe mais chave no front: de 11/09 a 23/09/2026 o
 * 00-config.js levava a chave pra todo navegador e ela vazou (foi revogada). O gateway
 * gAI (ai/ai-client.js) usa a mesma porta, `gAiEdgeFetch`.
 *
 * Contrato: gAskAI NUNCA lança e NUNCA trava a UI (timeout). Devolve string ou
 * null; quem chama decide o fallback (motor local, esconder o botão, avisar).
 *
 * Depende de: core/supabase.js (gSupabase), core/img-store.js (gImgHash).
 */

const G_AI_TIMEOUT_MS = 45000;     // teto por chamada — cold start do Gemini 3.6 / cardápio em PDF
let _gAiEdgeOk = null;             // null = ainda não perguntou · true = respondeu · false = function fora (404/sem secret)
const _gAiCache = new Map();       // hash(task|prompt) → texto (só chamadas SEM anexo)

// Há caminho pra IA? A UI usa isto pra decidir se MOSTRA o recurso — então não pode ser
// otimismo cego: botão que aparece e falha é pior que botão que não existe. Sem rede, dá
// pra saber que NÃO há caminho: sem sessão a function responde 401; se ela já disse que
// está fora (404/sem secret), fica fora nesta aba.
function gAiReady(){
  if(_gAiEdgeOk===false) return false;
  if(_gAiEdgeOk===true) return true;
  const sb=(typeof gSupabase==='function')?gSupabase():window.sb;
  const cfg=window.LUMA_SUPABASE||{};
  const logado=(typeof gCurrentUser==='function') ? !!gCurrentUser() : false;
  return !!(sb && cfg.url && cfg.anonKey && logado);
}
// Mantida pelo nome: o tutor da Academia (agente.js) pergunta por ela. Com um caminho só,
// "tem servidor" e "tem IA" são a mesma pergunta.
function gAiEdgeReady(){ return gAiReady(); }
// A escolha do time (console: comando `modelo`) vence o padrão do config. A ordem
// importa: 00-config.js SEMPRE define window.LUMA_GEMINI_MODEL no boot, então com o
// window na frente a troca não sobrevivia ao recarregar — voltava calada pro padrão.
function gAiModel(){
  try{
    const escolhido = localStorage.getItem('luma_gemini_model');
    if(escolhido && !['gemini-1.5-flash','gemini-2.0-flash','gemini-flash-latest'].includes(escolhido)) return escolhido;
  }catch(e){}
  return window.LUMA_GEMINI_MODEL || 'gemini-3.1-flash-lite';
}

/**
 * Pergunta ao modelo.
 * @param {string} task   uma das tarefas da allowlist da function (TASKS em supabase/functions/ai)
 * @param {string} prompt prompt completo, montado por quem chama — EXCETO na task
 *                        'aula', em que este campo é só a pergunta do estudante e
 *                        o prompt pedagógico é montado na Edge Function (ver
 *                        js/academia/agente.js: regra do tutor não pode viver no cliente).
 * @param {object} opts   {parts:[{mimeType,data}], json:true, cache:true, contexto:{}}
 *                        contexto: payload estruturado que só a task 'aula' usa;
 *                        vai íntegro pra function, que compõe o prompt lá.
 * @returns {Promise<string|null>} texto da resposta, ou null se a IA não respondeu
 */
async function gAskAI(task, prompt, opts){
  opts = opts || {};
  const parts = Array.isArray(opts.parts) ? opts.parts : [];
  const querJson = opts.json!==false;
  const contexto = (opts.contexto && typeof opts.contexto==='object') ? opts.contexto : null;
  // Cache só faz sentido sem anexo (mesmo produto/limite pedido de novo é comum).
  // Com contexto (tutor) o cache fica FORA: a mesma pergunta em aulas/momentos
  // diferentes tem respostas diferentes — cachear devolveria a aula errada.
  const podeCachear = opts.cache!==false && !parts.length && !contexto && typeof gImgHash==='function';
  const chaveCache = podeCachear ? gImgHash(task+'|'+gAiModel()+'|'+prompt) : '';
  if(chaveCache && _gAiCache.has(chaveCache)) return _gAiCache.get(chaveCache);

  const texto = await _gAiViaEdge(task, prompt, parts, querJson, contexto);
  if(texto!=null && chaveCache){
    if(typeof gCachePodar==='function') gCachePodar(_gAiCache, 200); else if(_gAiCache.size>200) _gAiCache.clear();   // teto de sessão, descarte parcial
    _gAiCache.set(chaveCache, texto);
  }
  return texto;
}

/* A PORTA da Edge Function, para os dois clientes (gAskAI e o gateway gAI). fetch cru em vez
   de functions.invoke pra ter AbortController (invoke não aceita signal). Devolve o Response,
   ou null quando nem dá pra tentar (sem sessão, function já dada como fora). 404 e "sem
   secret" desligam a IA nesta aba — tentar de novo a cada clique só atrasaria o fallback. */
async function gAiEdgeFetch(body, signal){
  if(_gAiEdgeOk===false) return null;
  const sb=(typeof gSupabase==='function')?gSupabase():window.sb;
  const cfg=window.LUMA_SUPABASE||{};
  if(!sb || !cfg.url || !cfg.anonKey) return null;
  let token='';
  try{ const {data}=await sb.auth.getSession(); token=(data&&data.session&&data.session.access_token)||''; }catch(e){}
  if(!token) return null;   // sem sessão a function recusa (401) — nem tenta
  const t0=Date.now();
  let res;
  try{
    res=await fetch(cfg.url.replace(/\/+$/,'')+'/functions/v1/ai',{
      method:'POST', signal,
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,'apikey':cfg.anonKey},
      body:JSON.stringify(Object.assign({model:gAiModel()}, body))
    });
  }catch(e){
    _gAiTrackChamada(body, t0, 0, (e&&e.name==='AbortError')?'timeout':'rede');
    throw e;
  }
  // Com sucesso, a function diz qual modelo respondeu (pode ser a reserva): é o dado de custo.
  if(res.ok) res.clone().json().then(d=>_gAiTrackChamada(body, t0, res.status, null, d&&d.modelo))
    .catch(()=>_gAiTrackChamada(body, t0, res.status, null));
  else _gAiTrackChamada(body, t0, res.status, 'http_'+res.status);
  if(res.status===404){ _gAiEdgeOk=false; console.warn('[ai] Edge Function `ai` não existe no Supabase'); }
  else if(res.status===503){
    const txt=await res.clone().text().catch(()=>'');
    if(/secret/i.test(txt)){ _gAiEdgeOk=false; console.warn('[ai] Edge Function `ai` sem o secret GEMINI_API_KEY'); }
  }
  else if(res.ok) _gAiEdgeOk=true;
  return res;
}

/* ia_chamada: UMA linha por ida à function, dos dois clientes — é daqui que o painel tira uso
   por tarefa, taxa de erro e latência. Sem prompt nem resposta: só a tarefa, o tempo e o
   desfecho (a conta que importa é de custo e de falha, não de conteúdo). */
function _gAiTrackChamada(body, t0, status, erro, modelo){
  try{
    if(typeof gTrackEvent!=='function') return;
    const anexos=(body&&Array.isArray(body.parts))?body.parts:[];
    gTrackEvent('ia_chamada',{task:String((body&&body.task)||''), ok:!erro, status:status||null, erro:erro||null,
      ms:Date.now()-t0, anexos:anexos.length, tipo_anexo:anexos[0]?String(anexos[0].mimeType||'').split('/')[0]:null,
      gateway:!!(body&&body.responseSchema), modelo:modelo||gAiModel()});
  }catch(e){}
}

async function _gAiViaEdge(task, prompt, parts, querJson, contexto){
  const ctrl=new AbortController();
  const t=setTimeout(()=>ctrl.abort(), G_AI_TIMEOUT_MS);
  try{
    const body={task,prompt,parts,json:querJson};
    if(contexto) body.contexto=contexto;
    const res=await gAiEdgeFetch(body, ctrl.signal);
    if(!res) return null;
    const data=await res.json().catch(()=>null);
    if(!res.ok || !data || !data.ok){
      console.warn('[ai] function respondeu '+res.status+': '+((data&&data.error)||''));
      return null;
    }
    return data.text||'';
  }catch(e){
    console.warn('[ai] chamada à function falhou:', (e&&e.name==='AbortError')?'timeout':e);
    return null;
  }finally{ clearTimeout(t); }
}

// Modelo às vezes embrulha o JSON em ```json … ``` mesmo pedindo responseMimeType.
// Um único parser tolerante pra todos os recursos — nunca lança.
function gAiParseJson(texto){
  if(typeof texto!=='string' || !texto.trim()) return null;
  let s=texto.trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'').trim();
  try{ return JSON.parse(s); }catch(e){}
  const i=s.search(/[[{]/); const j=Math.max(s.lastIndexOf(']'), s.lastIndexOf('}'));
  if(i>=0 && j>i){ try{ return JSON.parse(s.slice(i,j+1)); }catch(e){} }
  return null;
}

// Arquivo → {mimeType, data(base64 sem prefixo)} pro campo inlineData. Nunca lança.
function gAiFileToPart(file){
  return new Promise(resolve=>{
    try{
      const r=new FileReader();
      r.onload=()=>{
        const s=String(r.result||'');
        const v=s.indexOf(',');
        resolve(v<0?null:{mimeType:(file.type||'image/png'), data:s.slice(v+1)});
      };
      r.onerror=()=>resolve(null);
      r.readAsDataURL(file);
    }catch(e){ resolve(null); }
  });
}
