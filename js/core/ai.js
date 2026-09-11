/**
 * js/core/ai.js
 *
 * MOTOR ÚNICO de IA do front. Todo recurso de IA do Luma (legenda, encurtar
 * texto, ajuda, leitura de cardápio, casar fotos, mapear camadas do PSD) fala com o modelo POR AQUI —
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

const G_AI_TIMEOUT_MS = 45000;     // teto por chamada — cold start do Gemini 3.6 / cardápio em PDF
let _gAiEdgeOk = false;            // operando 100% pelo front (sem secret na Edge Function do Supabase)
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
// Há o caminho SERVIDOR (Edge Function)? Recurso cujo prompt vive na function —
// hoje o tutor da Academia (task 'aula') — não funciona com a chave do front, então
// perguntar por gAiReady() daria "disponível" e a resposta falharia sempre.
// Este é o gate certo para esses recursos.
function gAiEdgeReady(){
  if(_gAiEdgeOk===true) return true;
  if(_gAiKeyLocal()) return true; // operando pelo front: chave local atende todas as tasks
  const sb=(typeof gSupabase==='function')?gSupabase():window.sb;
  const cfg=window.LUMA_SUPABASE||{};
  const logado=(typeof gCurrentUser==='function') ? !!gCurrentUser() : false;
  return !!(sb && cfg.url && cfg.anonKey && logado);  // sem sessão a function responde 401
}
function _gAiKeyLocal(){
  try{
    return window.LUMA_GEMINI_API_KEY
      || (typeof LUMA_CONFIG!=='undefined' && LUMA_CONFIG.geminiApiKey)
      || localStorage.getItem('luma_gemini_api_key') || '';
  }catch(e){ return ''; }
}
// A escolha do time (console: comando `modelo`) vence o padrão do config. A ordem
// importa: 00-config.js SEMPRE define window.LUMA_GEMINI_MODEL no boot, então com o
// window na frente a troca não sobrevivia ao recarregar — voltava calada pro padrão.
function gAiModel(){
  try{
    const escolhido = localStorage.getItem('luma_gemini_model');
    if(escolhido && !['gemini-1.5-flash','gemini-2.0-flash','gemini-flash-latest'].includes(escolhido)) return escolhido;
  }catch(e){}
  return window.LUMA_GEMINI_MODEL || 'gemini-3.6-flash';
}

const _G_AI_AULA_SISTEMA = `Você é o tutor da Academia Delivery Much, o agente educacional da Formação do Franqueado.
Seu papel é ajudar o estudante — um franqueado que está implantando a Delivery Much na cidade dele — a COMPREENDER e APLICAR o conteúdo oficial da aula atual.

MÉTODO
- Prefira perguntas orientadoras, pistas, exemplos e verificações de entendimento a respostas mastigadas.
- Quando fizer sentido: confirme a dúvida, descubra o que a pessoa já entendeu, aponte o trecho/conceito relevante, dê uma pista e faça UMA pergunta de checagem.
- Faça no máximo uma pergunta por resposta. Não transforme a conversa em interrogatório.
- Responda direto, sem rodeio socrático, quando: a dúvida for operacional e objetiva; a pessoa só quer localizar um material ou recurso; houver risco de executar um processo errado; ou perguntar de volta só atrasaria.

LIMITES (não negociáveis)
- Use apenas o CONTEXTO OFICIAL fornecido abaixo. Não invente política, processo, prazo, valor, meta ou regra da rede.
- Se a informação não estiver no contexto, diga isso com clareza e indique o caminho: o material da aula, outra aula da formação, ou a equipe Delivery Much.
- Nunca entregue a resposta de uma atividade avaliativa. Você recebe apenas os enunciados, nunca o gabarito: conduza o raciocínio, dê pistas, não conclua por ela.
- Se a dúvida envolver risco operacional, financeiro, jurídico, de segurança ou uma decisão oficial da rede, diga explicitamente que a confirmação humana da equipe Delivery Much é necessária.
- Não fale de outros franqueados nem de dados de gestão. Você não executa ações no sistema.
- Só cite minutagem do vídeo (formato mm:ss) se ela aparecer na transcrição do contexto. Sem transcrição, não invente tempo.

TOM
- Português do Brasil, claro e breve (em geral 2 a 5 frases). Profissional e próximo, sem infantilizar e sem bajular.
- Fale de operação real de franquia, não de teoria abstrata. Trate a pessoa como adulta responsável pelo próprio negócio.
- Texto corrido ou lista curta. Nada de markdown pesado, título nem emoji.`;

function _gAiMontaPromptAula(c, pergunta){
  c = c || {};
  const mats = Array.isArray(c.materiais) ? c.materiais : [];
  const ativ = c.atividade || null;
  const hist = Array.isArray(c.historico) ? c.historico : [];
  const prog = c.progresso || {};

  const partes = [];
  partes.push("CONTEXTO OFICIAL DA AULA");
  partes.push(`Formação: ${String(c.curso||'').slice(0,200)}`);
  partes.push(`Módulo: ${String(c.modulo||'').slice(0,200)}`);
  partes.push(`Aula: ${String(c.aula||'').slice(0,200)}`);
  if (c.objetivo) partes.push(`Objetivo da aula: ${String(c.objetivo).slice(0,800)}`);
  if (c.resumo) partes.push(`Resumo: ${String(c.resumo).slice(0,2500)}`);
  if (c.descricao) partes.push(`Descrição: ${String(c.descricao).slice(0,2500)}`);
  if (mats.length) {
    partes.push("Materiais desta aula: " + mats.map(m => `${String(m.titulo||'').slice(0,120)} (${String(m.tipo||'').slice(0,30)})`).join("; "));
  }
  if (ativ) {
    partes.push(`Atividade da aula (SEM gabarito — não responda por ela): ${String(ativ.titulo||'').slice(0,120)}`);
    const ens = Array.isArray(ativ.enunciados) ? ativ.enunciados : [];
    ens.slice(0, 12).forEach((e, i) => partes.push(`  ${i + 1}. ${String(e||'').slice(0,400)}`));
  }
  if (c.transcricao) {
    partes.push("Transcrição (use os tempos [mm:ss] para citar momentos):");
    partes.push(String(c.transcricao).slice(0,12000));
  } else if (c.tem_video) {
    partes.push("Esta aula tem vídeo, mas SEM transcrição disponível — não cite minutagem.");
  } else {
    partes.push("Esta aula não tem vídeo (é de leitura).");
  }
  partes.push(`Situação do estudante: ${prog.aula_concluida ? "já concluiu esta aula" : "ainda não concluiu esta aula"}; ${Number(prog.pct_formacao) || 0}% da formação concluída${prog.formacao_concluida ? "; já formado (está revisando)" : ""}.`);

  if (hist.length) {
    partes.push("CONVERSA RECENTE NESTA AULA");
    hist.slice(-8).forEach(m => {
      const quem = String(m.papel) === "usuario" ? "Estudante" : "Tutor";
      partes.push(`${quem}: ${String(m.texto||'').slice(0,900)}`);
    });
  }

  partes.push("PERGUNTA DO ESTUDANTE");
  partes.push(pergunta);
  partes.push("Responda seguindo o método, os limites e o tom definidos acima.");

  return `${_G_AI_AULA_SISTEMA}\n\n${partes.join('\n')}`;
}

/**
 * Pergunta ao modelo.
 * @param {string} task   'legenda'|'encurtar'|'ajuda'|'cardapio'|'casar-fotos'|'aula'|'mapear-psd' (a function só aceita estas)
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

  let texto = await _gAiViaEdge(task, prompt, parts, querJson, contexto);
  // Caminho 100% front / transição: se a function falhar ou não tiver secret, chave local responde tudo
  if(texto==null){
    let promptFinal = prompt;
    if(contexto && typeof _gAiMontaPromptAula==='function'){
      promptFinal = _gAiMontaPromptAula(contexto, prompt);
    }
    texto = await _gAiViaChaveLocal(promptFinal, parts, querJson);
  }
  if(texto!=null && chaveCache){
    if(typeof gCachePodar==='function') gCachePodar(_gAiCache, 200); else if(_gAiCache.size>200) _gAiCache.clear();   // teto de sessão, descarte parcial
    _gAiCache.set(chaveCache, texto);
  }
  return texto;
}

// Caminho 1 — Edge Function (chave no servidor). fetch cru em vez de
// functions.invoke pra ter AbortController (invoke não aceita signal).
async function _gAiViaEdge(task, prompt, parts, querJson, contexto){
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
      body:JSON.stringify(contexto
        ? {task,prompt,parts,model:gAiModel(),json:querJson,contexto}
        : {task,prompt,parts,model:gAiModel(),json:querJson})
    });
    if(res.status===404 || res.status===503){
      _gAiEdgeOk=false;
      console.warn('[ai] Edge Function `ai` indisponível no Supabase (status '+res.status+') — operando pelo front');
      return null;
    }
    const data=await res.json().catch(()=>null);
    if(!res.ok || !data || !data.ok){
      if(data && data.error && String(data.error).includes('secret')){
        _gAiEdgeOk=false;
        console.warn('[ai] Edge Function `ai` sem secret no Supabase — operando 100% pelo front');
      } else {
        console.warn('[ai] function respondeu '+res.status+': '+((data&&data.error)||''));
      }
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
    const textoPrompt = (typeof prompt==='string') ? prompt : (prompt ? JSON.stringify(prompt) : '');
    const corpo={contents:[{parts:[{text:textoPrompt}].concat(parts.map(p=>({inlineData:{mimeType:p.mimeType,data:p.data}})))}]};
    if(querJson) corpo.generationConfig={responseMimeType:'application/json'};
    const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+gAiModel()+':generateContent?key='+chave,{
      method:'POST', signal:ctrl.signal,
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(corpo)
    });
    if(!res.ok){
      const errTxt = await res.text().catch(()=>'');
      console.warn('[ai] Gemini direto respondeu '+res.status+': '+errTxt);
      return null;
    }
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
