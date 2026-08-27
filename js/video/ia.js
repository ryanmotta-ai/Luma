/**
 * js/video/ia.js
 *
 * O DIRETOR DE EDIÇÃO — a única parte do módulo que fala com o modelo.
 *
 * Encanamento: motor único `gAskAI` (core/ai.js). Nada de fetch próprio aqui.
 *
 * O que entra: folhas de contato (video/ingest.js) + transcrição + as pausas
 * MEDIDAS. O que sai: um EditPlan que passa pelo MESMO `vdAplicarPlano` que o
 * corte de silêncio usa — um caminho de aplicação, um histórico, um validador.
 *
 * ⚠ O prompt vive AQUI, no cliente, e isso é transitório. O estado final é a
 * Edge Function `ai` (como a task 'aula' da Academia, cujo prompt pedagógico mora
 * no servidor porque regra de produto não pode ser reescrita por DevTools). Enquanto
 * a function não tiver a task `video-plano`, `gAskAI` cai no caminho de transição e
 * o prompt precisa estar do lado de cá — é assim que TODAS as outras tasks do Luma
 * funcionam hoje. Ver docs/LUMA-VIDEO.md §7.2.
 *
 * Versione o prompt ao mudar comportamento: sem isso, não há como comparar
 * resultado antes/depois sem adivinhação.
 */

const VD_PROMPT_V = '2026-08-19.1';

const VD_PROMPT_DIRETOR = `Você é o diretor de edição do Luma, o editor de vídeo da Delivery Much.
Sua função é transformar o material recebido em um PLANO DE EDIÇÃO em JSON. Você não edita, não renderiza, não escreve texto para o usuário.

O QUE VOCÊ RECEBE
- Folhas de contato: frames do vídeo em grade, cada célula com o tempo queimado no canto (formato m:ss.d). A amostragem é de cerca de 1 frame por segundo — movimento rápido pode não aparecer.
- As pausas de áudio já MEDIDAS pelo sistema, em segundos. São a verdade: não recalcule silêncio olhando os frames.
- A transcrição da fala com tempos, quando existir.
- O alvo: duração, formato e ritmo.

LIMITES (não negociáveis)
- Só existem DUAS ações, e o editor descarta qualquer outra: "segmentos" (o que MANTER) e "reframe" (aproximação e enquadramento).
- Não proponha vinheta, overlay, música, efeito sonoro, legenda, transição nem asset: nada disso está disponível nesta versão, e o sistema descarta na cara do usuário.
- Devolva o que MANTER, nunca o que remover.
- Corte em PAUSA ou em fronteira de frase, usando as pausas medidas. Cortar no meio de uma palavra é o defeito mais visível que existe.
- Todo item precisa de "motivo": uma frase curta em português, ancorada no que você recebeu (um tempo, uma pausa medida, algo visível num frame). Ação sem motivo é descartada pelo sistema.
- Nunca invente o que não pode ver: se não souber quando algo acontece, não afirme.
- Menos ações bem justificadas vale mais que muitas. Não aplique aproximação só porque ela existe.

PRIORIDADES, nesta ordem
1. Clareza da mensagem  2. Retenção nos 3 primeiros segundos  3. Ritmo  4. O produto aparecer  5. CTA no fim

RESPOSTA — somente JSON válido, sem markdown e sem texto fora do JSON:
{"acoes":[
  {"tipo":"segmentos","manter":[{"de":0,"ate":4.8},{"de":7.2,"ate":15.6}],"motivo":"remove a pausa medida de 4,8 a 7,2"},
  {"tipo":"reframe","de":7.2,"ate":15.6,"zoom":1.08,"foco":0.35,"motivo":"o produto está à esquerda do quadro"}
]}
Regras do formato: tempos em segundos com uma decimal; "manter" em ordem crescente e sem sobrepor; "zoom" entre 1 e 1.6; "foco" entre 0 e 1 (0 = borda inicial, 0.5 = centro, 1 = borda final); "reframe" é opcional e pode trazer só o foco.`;

/**
 * O contexto que acompanha as folhas de contato. FUNÇÃO PURA — dá para inspecionar
 * o que o modelo vai ler sem gastar chamada.
 * @param {object} medicao  saída de vdMedirAudio()
 * @returns {string}
 */
function vdMontarContexto(medicao){
  const p = [];
  const dur = (vdProj && vdProj.fonte.dur) || 0;
  const orient = (vdProj.fonte.w > vdProj.fonte.h) ? 'horizontal' : 'vertical';
  p.push('MATERIAL');
  p.push('duração: ' + dur.toFixed(1) + 's · ' + vdProj.fonte.w + 'x' + vdProj.fonte.h + ' (' + orient + ')');
  p.push('');
  p.push('ALVO');
  p.push('duração alvo: ' + (vdProj.alvo_seg || 30) + 's · formato de saída: ' + vdProj.formato);
  if(orient === 'horizontal' && vdProj.formato === '9:16'){
    p.push('atenção: material horizontal em saída vertical — o corte joga fora as laterais, então use "foco" para manter o assunto no quadro.');
  }
  p.push('');
  p.push('PAUSAS MEDIDAS PELO SISTEMA (em segundos, são a verdade)');
  if(medicao && medicao.ok && medicao.silencios.length){
    medicao.silencios.forEach(s => p.push('  ' + s.de.toFixed(1) + ' a ' + s.ate.toFixed(1) + '  (' + (s.ate - s.de).toFixed(1) + 's)'));
  }else{
    p.push('  nenhuma pausa longa detectada' + (medicao && !medicao.ok ? ' (não consegui ler o áudio: ' + medicao.erro + ')' : ''));
  }
  p.push('');
  const cards = (vdProj.legendas && vdProj.legendas.cards) || [];
  p.push('TRANSCRIÇÃO');
  if(cards.length){
    cards.slice(0, 80).forEach(c => p.push('  [' + c.de.toFixed(1) + '–' + c.ate.toFixed(1) + '] ' + c.texto));
  }else{
    p.push('  não disponível — decida pelos frames e pelas pausas.');
  }
  p.push('');
  p.push('ASSETS DISPONÍVEIS: nenhum nesta versão.');
  return p.join('\n');
}

/**
 * Auto Edit: amostra, pergunta, valida e aplica.
 *
 * @param {function(number,string):void} [aoProgresso] (0..1, etapa)
 * @returns {Promise<{ok:boolean, erro?:string, acoes?:Array, descartes?:Array, antes?:number, depois?:number}>}
 */
async function vdAutoEdit(aoProgresso){
  const passo = (v, txt) => { if(aoProgresso) aoProgresso(v, txt); };
  if(!vdProj) return { ok:false, erro:'nenhum vídeo carregado' };
  if(typeof gAskAI !== 'function' || typeof gAiReady !== 'function' || !gAiReady()){
    return { ok:false, erro:'a IA não está disponível nesta sessão' };
  }

  passo(0.05, 'ouvindo o áudio');
  const medicao = await vdMedirAudio();          // cacheado por arquivo

  passo(0.15, 'olhando o vídeo');
  const folhas = await vdFolhasDeContato(f => passo(0.15 + f * 0.45, 'olhando o vídeo'));
  if(!folhas.ok) return { ok:false, erro:folhas.erro };

  passo(0.62, 'decidindo os cortes');
  const contexto = vdMontarContexto(medicao);
  const bruto = await gAskAI('video-plano', VD_PROMPT_DIRETOR + '\n\n' + contexto, {
    parts: folhas.partes, json: true, cache: false
  });
  if(bruto == null) return { ok:false, erro:'a IA não respondeu' };

  const plano = (typeof gAiParseJson === 'function') ? gAiParseJson(bruto) : null;
  if(!plano || !Array.isArray(plano.acoes)) return { ok:false, erro:'a resposta não veio no formato de plano' };

  passo(0.9, 'aplicando');
  const antes = vdDuracaoFinal();
  const r = vdAplicarPlano(plano);               // valida E aplica, com um snapshot só
  if(!r.ok){
    return { ok:false, erro:'o plano não passou na validação', descartes:r.descartes };
  }
  // Guarda o que a IA disse para a interface poder MOSTRAR o porquê de cada corte.
  // Sem isso, o usuário recebe uma edição sem saber o que aconteceu.
  vdProj.iaLog = plano.acoes
    .filter(a => a && a.motivo)
    .map(a => ({ tipo:String(a.tipo || '?'), motivo:String(a.motivo).slice(0, 200) }));
  vdProj.iaPrompt = VD_PROMPT_V;
  // O log entra no MESMO ponto do histórico que a edição — senão desfazer/refazer
  // devolvia os cortes sem o porquê deles (ver vdReRegistrar em projeto.js).
  if(typeof vdReRegistrar === 'function') vdReRegistrar();
  passo(1, 'pronto');
  return { ok:true, acoes:vdProj.iaLog, descartes:r.descartes, antes, depois:vdDuracaoFinal(),
           quadros:folhas.quadros, kb:folhas.kb };
}
