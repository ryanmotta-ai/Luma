/**
 * js/academia/agente.js
 *
 * ACADEMIA — AGENTE EDUCACIONAL. A coluna direita do ambiente de aula: um tutor
 * que ajuda o franqueado a ENTENDER a aula atual, com método socrático.
 *
 * ONDE MORA O PROMPT: no SERVIDOR (supabase/functions/ai, task 'aula'). Este
 * arquivo monta apenas o CONTEXTO (curso/módulo/aula/transcrição/materiais/
 * progresso) e a pergunta. As outras tarefas de IA do Luma montam o prompt no
 * front por um motivo específico (existe modo de transição com chave local e
 * duplicar o builder seria pior) — a task 'aula' NASCE sem esse legado, então
 * pode manter regra pedagógica e limites fora do alcance do DevTools.
 * Consequência aceita: sem a Edge Function publicada, o agente não funciona (e
 * a UI diz isso em vez de fingir).
 *
 * Reutiliza o motor único gAskAI (js/core/ai.js) — não há segundo caminho de IA.
 *
 * O que o agente NÃO recebe: nome/e-mail/telefone do franqueado, dados de outros
 * franqueados, anotações privadas, gabarito de atividade avaliativa.
 */

let acMsgs = {};                 // aula_id → [{papel,texto,_erro?}]
let _acAgentePensando = false;
let _acAgenteCarregou = {};      // aula_id → true (histórico já veio do banco)

const AC_HISTORICO_MAX = 8;      // últimas mensagens enviadas de contexto (teto de custo)
const AC_TRANSCRICAO_MAX = 6000; // caracteres de transcrição por chamada

/* ══════════════════════════════════════════════════════════════
   RENDER DO PAINEL
══════════════════════════════════════════════════════════════ */
function acRenderAgente(aula){
  const el = document.getElementById('ac-agente'); if(!el || !aula) return;
  // gAiEdgeReady (não gAiReady): o prompt do tutor vive na Edge Function, então a
  // chave de transição do front não serve. Com gAiReady o painel aparecia pronto
  // e TODA pergunta falhava — pior que não oferecer.
  const pronto = (typeof gAiEdgeReady==='function') ? gAiEdgeReady() : false;
  const msgs = acMsgs[aula.id] || [];

  el.innerHTML = `
    <div class="ac-ag-cab">
      <button type="button" class="ac-ag-recolher" onclick="acRecolherAgente()"
              aria-label="Recolher o painel do agente" title="Recolher painel">
        ${acIco('chev','ac-i-chev')}
      </button>
      <div class="ac-ag-id">
        <span class="ac-ag-av" aria-hidden="true">${acIco('bot')}</span>
        <div class="ac-ag-txt">
          <strong>Tutor da Academia</strong>
          <small>sobre: ${gEsc(aula.titulo)}</small>
        </div>
      </div>
      <button type="button" class="ac-ag-fechar" onclick="acFecharPaineis()" aria-label="Fechar o agente">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
      ${msgs.length?`<button type="button" class="ac-ag-limpar ac-link" onclick="acAgenteReiniciar()">Reiniciar conversa</button>`:''}
    </div>

    <button type="button" class="ac-ag-voltar" id="ac-ag-voltar" onclick="acAgenteIrParaUltima()">
      ${acIco('seta','ac-i-sm')} <span>Ir para a última mensagem</span>
    </button>
    <div class="ac-ag-corpo" id="ac-ag-corpo" aria-live="polite" aria-atomic="false" onscroll="acAgenteMostrarVoltar(!acAgenteNoFim())">
      ${!pronto ? acAgenteIndisponivel()
        : (msgs.length ? msgs.map(acAgenteBolha).join('') : acAgenteBoasVindas(aula))}
      ${_acAgentePensando?`<div class="ac-ag-msg is-agente is-pensando" id="ac-ag-pensando"><span class="ac-ag-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="ac-sr">O tutor está escrevendo…</span></div>`:''}
    </div>

    ${pronto?`
    <div class="ac-ag-acoes" id="ac-ag-acoes">
      ${acAgenteAtalhos(aula).map(a=>`<button type="button" class="ac-ag-chip"
        onclick="acAgentePerguntar(${JSON.stringify(a).replace(/"/g,'&quot;')})">${gEsc(a)}</button>`).join('')}
    </div>
    <form class="ac-ag-form" onsubmit="event.preventDefault();acAgenteEnviar()">
      <label class="ac-sr" for="ac-agente-input">Sua dúvida sobre esta aula</label>
      <textarea id="ac-agente-input" class="ac-ag-input" rows="1"
        placeholder="Pergunte algo sobre esta aula…"
        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();acAgenteEnviar()}"
        oninput="acAgenteAutoAltura(this)"></textarea>
      <button type="submit" class="ac-ag-enviar" aria-label="Enviar pergunta" ${_acAgentePensando?'disabled':''}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4 20-7z"/></svg>
      </button>
    </form>
    <p class="ac-ag-nota">As respostas usam o conteúdo oficial desta aula. Decisões da rede precisam de confirmação da equipe Delivery Much.</p>
    `:''}`;

  acAgenteCarregarHistorico(aula.id);
  acAgenteRolar();
}

function acAgenteIndisponivel(){
  return `<div class="ac-ag-off">
    ${acIco('alerta')}
    <strong>Tutor temporariamente indisponível</strong>
    <span>Você segue com o vídeo, os materiais e as anotações. Se precisar de ajuda humana, fale com a equipe Delivery Much.</span>
  </div>`;
}

function acAgenteBoasVindas(aula){
  return `<div class="ac-ag-msg is-agente ac-ag-boasvindas">
    <p>Posso ajudar você a entender <strong>${gEsc(aula.titulo)}</strong>. Me diga sua dúvida — ou escolha um atalho abaixo.</p>
  </div>`;
}

// Bolha de mensagem. TUDO escapado: a resposta do modelo entra em innerHTML.
// Convertemos só o que é seguro: quebra de linha e marcação de tempo "04:32"
// citada pelo próprio agente (vira botão que navega o vídeo).
function acAgenteBolha(m){
  const cls = m.papel==='usuario' ? 'is-usuario' : 'is-agente';
  if(m._erro){
    return `<div class="ac-ag-msg is-agente is-erro">${acIco('alerta')}
      <p>${gEsc(m.texto)}</p>
      <button type="button" class="ac-link" onclick="acAgenteTentarDeNovo()">Tentar de novo</button></div>`;
  }
  return `<div class="ac-ag-msg ${cls}">${acAgenteTexto(m.texto)}</div>`;
}
function acAgenteTexto(txt){
  const seguro = gEsc(String(txt||''));
  // Timestamp mm:ss → botão de navegação. Só faz sentido se houver vídeo.
  const temVideo = !!(acAula(acState.aulaId)||{}).video_url || !!(acAula(acState.aulaId)||{}).video_path;
  const comTempo = temVideo
    ? seguro.replace(/\b(\d{1,2}):([0-5]\d)\b/g, (m,mm,ss)=>{
        const seg = Number(mm)*60 + Number(ss);
        return `<button type="button" class="ac-ag-t" onclick="acIrPara(${seg})" title="Ir para ${m} do vídeo">${m}</button>`;
      })
    : seguro;
  return comTempo.split(/\n{2,}/).map(par=>`<p>${par.replace(/\n/g,'<br>')}</p>`).join('');
}

// Atalhos CONTEXTUAIS: mudam com a aula e com o momento do estudo.
function acAgenteAtalhos(aula){
  const p = acProg(aula.id);
  const temTrans = Array.isArray(aula.transcricao) && aula.transcricao.length>0;
  const temAtiv = !!(aula.atividade && (aula.atividade.itens||[]).length);
  const base = ['O que eu preciso entender desta aula?'];
  if(p.concluida) base.push('Resuma o essencial para eu revisar');
  else base.push('Explique de outro jeito');
  if(temTrans) base.push('Onde isso aparece no vídeo?');
  base.push('Crie um exemplo da minha operação');
  if(temAtiv) base.push('Me dê uma pista');
  base.push('Teste meu entendimento');
  return base.slice(0,5);
}

function acAgenteAutoAltura(t){
  if(!t) return;
  t.style.height = 'auto';
  t.style.height = Math.min(120, t.scrollHeight) + 'px';
}
// A pessoa está no fim da conversa? (48px de folga: rolagem raramente para exata)
function acAgenteNoFim(){
  const c = document.getElementById('ac-ag-corpo'); if(!c) return true;
  return (c.scrollHeight - c.scrollTop - c.clientHeight) < 48;
}
/**
 * Rola pro fim SÓ quando faz sentido.
 * Antes isto era incondicional: chegava uma resposta e o histórico pulava pro
 * fim mesmo com a pessoa lendo uma mensagem de dez minutos atrás.
 * @param {boolean} forcar ignora a posição atual (clique no botão "última")
 */
function acAgenteRolar(forcar){
  const c = document.getElementById('ac-ag-corpo'); if(!c) return;
  if(!forcar && !acAgenteNoFim()){ acAgenteMostrarVoltar(true); return; }
  if(typeof acMotionReduzido==='function' && !acMotionReduzido() && c.scrollTo){
    try{ c.scrollTo({top:c.scrollHeight, behavior:'smooth'}); }catch(e){ c.scrollTop=c.scrollHeight; }
  }else c.scrollTop = c.scrollHeight;
  acAgenteMostrarVoltar(false);
}
function acAgenteMostrarVoltar(mostrar){
  const el = document.getElementById('ac-ag-voltar');
  if(el) el.classList.toggle('is-visivel', !!mostrar);
}
function acAgenteIrParaUltima(){ acAgenteRolar(true); }

/* ══════════════════════════════════════════════════════════════
   HISTÓRICO (persistido por usuário+aula; privado por RLS)
══════════════════════════════════════════════════════════════ */
async function acAgenteCarregarHistorico(aulaId){
  if(_acAgenteCarregou[aulaId]) return;
  _acAgenteCarregou[aulaId] = true;
  const lu=_acLuma(), uid=_acUid();
  if(!lu || !uid || !acState.curso || acState.curso._demo) return;
  try{
    const { data, error } = await lu.from('aula_mensagens').select('papel,texto,created_at')
      .eq('aula_id',aulaId).eq('user_id',uid).order('created_at').limit(60);
    if(error) throw error;
    if(data && data.length){
      acMsgs[aulaId] = data.map(m=>({papel:m.papel==='usuario'?'usuario':'agente', texto:m.texto}));
      const aula = acAula(aulaId);
      if(aula && acState.aulaId===aulaId && acState.rota==='aula') acRenderAgente(aula);
    }
  }catch(e){ console.warn('[academia] conversa não carregou:', e&&e.message||e); }
}
async function _acGravarMsg(aulaId, papel, texto){
  const lu=_acLuma(), uid=_acUid();
  if(!lu || !uid || !acState.curso || acState.curso._demo) return;
  try{
    await lu.from('aula_mensagens').insert({ user_id:uid, aula_id:aulaId, papel, texto });
  }catch(e){ console.warn('[academia] mensagem não gravou:', e&&e.message||e); }
}

async function acAgenteReiniciar(){
  const aulaId = acState.aulaId;
  const ok = await gConfirm('Reiniciar a conversa desta aula? O histórico é apagado.',
                            {title:'Reiniciar conversa', okLabel:'Reiniciar', danger:true});
  if(!ok) return;
  acMsgs[aulaId] = [];
  const lu=_acLuma(), uid=_acUid();
  if(lu && uid && acState.curso && !acState.curso._demo){
    try{ await lu.from('aula_mensagens').delete().eq('aula_id',aulaId).eq('user_id',uid); }
    catch(e){ console.warn('[academia] conversa não apagou:', e&&e.message||e); }
  }
  const aula = acAula(aulaId); if(aula) acRenderAgente(aula);
}

/* ══════════════════════════════════════════════════════════════
   ENVIO
══════════════════════════════════════════════════════════════ */
function acAgenteEnviar(){
  const t = document.getElementById('ac-agente-input');
  const txt = t ? String(t.value||'').trim() : '';
  if(!txt) return;
  if(t){ t.value=''; acAgenteAutoAltura(t); }
  acAgentePerguntar(txt);
}
let _acUltimaPergunta = '';
function acAgenteTentarDeNovo(){
  const aulaId = acState.aulaId;
  acMsgs[aulaId] = (acMsgs[aulaId]||[]).filter(m=>!m._erro);
  if(_acUltimaPergunta) acAgentePerguntar(_acUltimaPergunta);
}

async function acAgentePerguntar(pergunta){
  pergunta = String(pergunta||'').trim();
  if(!pergunta || _acAgentePensando) return;
  const aula = acAula(acState.aulaId); if(!aula) return;
  const aulaId = aula.id;
  _acUltimaPergunta = pergunta;

  acMsgs[aulaId] = (acMsgs[aulaId]||[]).filter(m=>!m._erro);
  const msgUsuario = { papel:'usuario', texto:pergunta };
  acMsgs[aulaId].push(msgUsuario);
  _acAgentePensando = true;
  // Anexa só o que é novo. Re-renderizar o painel fazia TODO o histórico
  // re-animar a cada pergunta e a rolagem saltava pro fim sem pedir licença.
  acAgenteAnexar(msgUsuario, {rolar:true});
  acAgentePensandoUI(true);
  _acGravarMsg(aulaId, 'usuario', pergunta);
  // Telemetria: só o FATO da pergunta. O texto é dado educacional privado e
  // não vira evento analítico (regra do produto).
  if(typeof gTrackEvent==='function') gTrackEvent('agente_pergunta',{aula_id:aulaId, curso_id:acState.curso&&acState.curso.id});

  let resposta = null;
  try{
    resposta = await gAskAI('aula', pergunta, { json:false, cache:false, contexto: acAgenteContexto(aula) });
  }catch(e){ resposta = null; }

  _acAgentePensando = false;
  const msg = resposta
    ? { papel:'agente', texto:resposta }
    : { papel:'agente', _erro:true,
        texto:'Não consegui responder agora. Tente de novo em instantes — ou fale com a equipe Delivery Much se for urgente.' };
  acMsgs[aulaId].push(msg);
  if(resposta) _acGravarMsg(aulaId, 'agente', resposta);

  // Só toca no DOM se a pessoa ainda está NESTA aula — trocar de aula durante a
  // espera não pode fazer a resposta antiga aparecer na aula nova.
  const atual = acAula(acState.aulaId);
  if(atual && atual.id===aulaId && acState.rota==='aula'){
    acAgentePensandoUI(false);
    acAgenteAnexar(msg);
    acAgenteAtualizarAtalhos(atual);
  }
}

/** Insere uma bolha no fim do histórico, com entrada própria. */
function acAgenteAnexar(msg, opts){
  opts = opts||{};
  const corpo = document.getElementById('ac-ag-corpo'); if(!corpo) return;
  const bemVindo = corpo.querySelector('.ac-ag-boasvindas');
  if(bemVindo) bemVindo.remove();          // a conversa começou: o convite sai
  const estavaNoFim = acAgenteNoFim();
  corpo.insertAdjacentHTML('beforeend', acAgenteBolha(msg));
  const nova = corpo.lastElementChild;
  if(nova && typeof acMotionReduzido==='function' && !acMotionReduzido()) nova.classList.add('ac-ag-nova');
  // Mensagem do próprio usuário sempre acompanha (ele acabou de enviar);
  // resposta do tutor só se ele já estava acompanhando o fim.
  if(opts.rolar || estavaNoFim) acAgenteRolar(!!opts.rolar);
  else acAgenteMostrarVoltar(true);
  // O cabeçalho ganha "Reiniciar conversa" na primeira mensagem.
  const cab = document.querySelector('.ac-ag-cab');
  if(cab && !cab.querySelector('.ac-ag-limpar')){
    cab.insertAdjacentHTML('beforeend',
      '<button type="button" class="ac-ag-limpar ac-link" onclick="acAgenteReiniciar()">Reiniciar conversa</button>');
  }
}

/** Liga/desliga os três pontinhos sem redesenhar o painel. */
function acAgentePensandoUI(pensando){
  const corpo = document.getElementById('ac-ag-corpo'); if(!corpo) return;
  const antigo = document.getElementById('ac-ag-pensando');
  if(!pensando){ if(antigo) antigo.remove(); }
  else if(!antigo){
    corpo.insertAdjacentHTML('beforeend',
      `<div class="ac-ag-msg is-agente is-pensando ac-ag-nova" id="ac-ag-pensando">
        <span class="ac-ag-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="ac-sr">O tutor está escrevendo…</span></div>`);
    acAgenteRolar(true);
  }
  const enviar = document.querySelector('.ac-ag-enviar');
  if(enviar) enviar.disabled = !!pensando;
}

/** Atalhos deixam de ser decoração: mudam quando o contexto muda. */
function acAgenteAtualizarAtalhos(aula){
  const box = document.getElementById('ac-ag-acoes');
  if(!box || !aula) return;
  box.innerHTML = acAgenteAtalhos(aula).map(a=>`<button type="button" class="ac-ag-chip"
    onclick="acAgentePerguntar(${JSON.stringify(a).replace(/"/g,'&quot;')})">${gEsc(a)}</button>`).join('');
}

/**
 * Contexto enviado ao servidor. Só o necessário: nada de nome, e-mail, telefone,
 * nem dado de outro franqueado. O gabarito da atividade fica de fora de
 * propósito — o agente ajuda a raciocinar, não entrega resposta de avaliação.
 */
function acAgenteContexto(aula){
  const mod = aula._modulo || acModulo(aula.modulo_id);
  const p = acProg(aula.id);
  const r = acResumo();

  // Transcrição com marcação de tempo (é o que permite citar o minuto sem inventar).
  let transcricao = '';
  if(Array.isArray(aula.transcricao) && aula.transcricao.length){
    transcricao = aula.transcricao
      .map(t=>(t.t!=null?`[${acFmtTempo(t.t)}] `:'')+String(t.texto||''))
      .join('\n')
      .slice(0, AC_TRANSCRICAO_MAX);
  }
  const materiais = (aula.materiais||[])
    .filter(m=>m && m.tipo!=='legenda')
    .map(m=>({ titulo:String(m.titulo||''), tipo:String(m.tipo||'') }));

  // Só os TÍTULOS das perguntas da atividade — nunca a alternativa correta.
  const atividade = (aula.atividade && (aula.atividade.itens||[]).length)
    ? { titulo:String(aula.atividade.titulo||''),
        enunciados:(aula.atividade.itens||[]).map(i=>String(i.enunciado||'')) }
    : null;

  const historico = (acMsgs[aula.id]||[])
    .filter(m=>!m._erro)
    .slice(-AC_HISTORICO_MAX - 1, -1)   // exclui a pergunta que acabou de entrar
    .map(m=>({ papel:m.papel, texto:String(m.texto||'').slice(0,1200) }));

  return {
    curso: String((acState.curso&&acState.curso.nome)||''),
    modulo: String((mod&&mod.nome)||''),
    aula: String(aula.titulo||''),
    objetivo: String(aula.objetivo||''),
    resumo: String(aula.resumo||''),
    descricao: String(aula.descricao||''),
    transcricao,
    tem_video: !!(aula.video_url||aula.video_path),
    materiais,
    atividade,
    progresso: {
      aula_concluida: !!p.concluida,
      pct_formacao: r.pct,
      formacao_concluida: acConcluiu()
    },
    historico
  };
}
