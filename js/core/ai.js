/**
 * js/core/ai.js
 *
 * MOTOR ÚNICO de IA do front. Todo recurso de IA do Luma (legenda, encurtar
 * texto, ajuda, leitura de cardápio, casar fotos) fala com o modelo POR AQUI —
 * ninguém mais monta fetch pro Gemini na mão. Um caminho = um lugar pra trocar
 * de modelo, pôr timeout, cachear e tratar falha.
 *
 * Caminho preferido: Edge Function `ai` (supabase/functions/ai) — a chave mora
 * no servidor. Caminho de TRANSIÇÃO: chamada direta com a chave do front
 * (js/00-config.js), que é como o Luma funciona hoje. ⚠ Essa chave é pública
 * pra qualquer browser: ela deve ser ROTACIONADA e apagada do config assim que
 * a function estiver publicada. Ver docs/LUMA-BACKEND-CHANGELOG.md.
 *
 * Contrato: gAskAI NUNCA lança e NUNCA trava a UI (timeout). Devolve string ou
 * null; quem chama decide o fallback (motor local, esconder o botão, avisar).
 *
 * Depende de: core/supabase.js (gSupabase), core/img-store.js (gImgHash).
 */

const G_AI_TIMEOUT_MS = 30000;     // teto por chamada — cardápio em PDF é o caso lento
let _gAiEdgeOk = null;             // null = não testado; false = function ausente/erra
const _gAiCache = new Map();       // hash(task|prompt) → texto (só chamadas SEM anexo)

// Há algum caminho pra IA? A UI usa isto pra decidir se MOSTRA o recurso — então não
// pode ser otimismo cego: botão que aparece e falha é pior que botão que não existe.
// Sem chamar rede, dá pra saber que NÃO há caminho: ou existe sessão no Supabase (a
// function pode responder), ou existe chave de transição no front. Nenhum dos dois =
// modo local puro → o recurso simplesmente não aparece.
function gAiReady(){
  if(_gAiEdgeOk===false) return !!_gAiKeyLocal();   // function ausente/quebrada → só com chave
  if(_gAiEdgeOk===true) return true;                // já respondeu antes nesta sessão
  const sb=(typeof gSupabase==='function')?gSupabase():window.sb;
  const logado=(typeof gCurrentUser==='function') ? !!gCurrentUser() : false;
  return (!!sb && logado) || !!_gAiKeyLocal();
}
function _gAiKeyLocal(){
  try{
    return window.LUMA_GEMINI_API_KEY
      || (typeof LUMA_CONFIG!=='undefined' && LUMA_CONFIG.geminiApiKey)
      || localStorage.getItem('luma_gemini_api_key') || '';
  }catch(e){ return ''; }
}
function gAiModel(){
  try{ return window.LUMA_GEMINI_MODEL || localStorage.getItem('luma_gemini_model') || 'gemini-flash-latest'; }
  catch(e){ return 'gemini-flash-latest'; }
}

/**
 * Pergunta ao modelo.
 * @param {string} task   'legenda'|'encurtar'|'ajuda'|'cardapio'|'casar-fotos' (a function só aceita estas)
 * @param {string} prompt prompt completo, montado por quem chama
 * @param {object} opts   {parts:[{mimeType,data}], json:true, cache:true}
 * @returns {Promise<string|null>} texto da resposta, ou null se a IA não respondeu
 */
async function gAskAI(task, prompt, opts){
  opts = opts || {};
  const parts = Array.isArray(opts.parts) ? opts.parts : [];
  const querJson = opts.json!==false;
  // Cache só faz sentido sem anexo (mesmo produto/limite pedido de novo é comum).
  const podeCachear = opts.cache!==false && !parts.length && typeof gImgHash==='function';
  const chaveCache = podeCachear ? gImgHash(task+'|'+gAiModel()+'|'+prompt) : '';
  if(chaveCache && _gAiCache.has(chaveCache)) return _gAiCache.get(chaveCache);

  let texto = await _gAiViaEdge(task, prompt, parts, querJson);
  if(texto==null) texto = await _gAiViaChaveLocal(prompt, parts, querJson);
  if(texto!=null && chaveCache){
    if(_gAiCache.size>200) _gAiCache.clear(); // teto bobo, suficiente pra uma sessão
    _gAiCache.set(chaveCache, texto);
  }
  return texto;
}

// Caminho 1 — Edge Function (chave no servidor). fetch cru em vez de
// functions.invoke pra ter AbortController (invoke não aceita signal).
async function _gAiViaEdge(task, prompt, parts, querJson){
  if(_gAiEdgeOk===false) return null;
  const sb=(typeof gSupabase==='function')?gSupabase():window.sb;
  const cfg=window.LUMA_SUPABASE||{};
  if(!sb || !cfg.url || !cfg.anonKey) return null;
  let token='';
  try{ const {data}=await sb.auth.getSession(); token=(data&&data.session&&data.session.access_token)||''; }catch(e){}
  if(!token) return null;   // sem sessão a function recusa (401) — nem tenta
  const ctrl=new AbortController();
  const t=setTimeout(()=>ctrl.abort(), G_AI_TIMEOUT_MS);
  try{
    const res=await fetch(cfg.url.replace(/\/+$/,'')+'/functions/v1/ai',{
      method:'POST', signal:ctrl.signal,
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,'apikey':cfg.anonKey},
      body:JSON.stringify({task,prompt,parts,model:gAiModel(),json:querJson})
    });
    if(res.status===404){ _gAiEdgeOk=false; console.warn('[ai] Edge Function `ai` não publicada — usando a chave do front (transição)'); return null; }
    const data=await res.json().catch(()=>null);
    if(!res.ok || !data || !data.ok){
      // 429/503 são respostas legítimas da function: não desliga o caminho, só falha esta chamada.
      console.warn('[ai] function respondeu '+res.status+': '+((data&&data.error)||''));
      return null;
    }
    _gAiEdgeOk=true;
    return data.text||'';
  }catch(e){
    console.warn('[ai] chamada à function falhou:', (e&&e.name==='AbortError')?'timeout':e);
    return null;
  }finally{ clearTimeout(t); }
}

// Caminho 2 — TRANSIÇÃO: chave no front. Sai de cena quando a function subir.
async function _gAiViaChaveLocal(prompt, parts, querJson){
  const chave=_gAiKeyLocal();
  if(!chave) return null;
  const ctrl=new AbortController();
  const t=setTimeout(()=>ctrl.abort(), G_AI_TIMEOUT_MS);
  try{
    const corpo={contents:[{parts:[{text:prompt}].concat(parts.map(p=>({inlineData:{mimeType:p.mimeType,data:p.data}})))}]};
    if(querJson) corpo.generationConfig={responseMimeType:'application/json'};
    const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+gAiModel()+':generateContent?key='+chave,{
      method:'POST', signal:ctrl.signal,
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(corpo)
    });
    if(!res.ok){ console.warn('[ai] Gemini direto respondeu '+res.status); return null; }
    const data=await res.json();
    const txt=data&&data.candidates&&data.candidates[0]&&data.candidates[0].content&&data.candidates[0].content.parts&&data.candidates[0].content.parts[0]&&data.candidates[0].content.parts[0].text;
    return txt||null;
  }catch(e){
    console.warn('[ai] Gemini direto falhou:', (e&&e.name==='AbortError')?'timeout':e);
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
