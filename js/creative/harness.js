/* ══════════════════════════════════════════════════════════════
   LUMA CREATIVE — HARNESS DO CHAT (15/10/2026)

   Antes, toda mensagem virava um pedido novo de arte: "agora no tema Much+" gerava OUTRA arte do zero.
   Agora, a partir da 2ª mensagem, um passo único lê o CONTEXTO do chat e decide o que a mensagem quer:

     modificar  → altera a arte já entregue (tema Much+, formato, texto, preço, cupom…); pula briefing e
                  copy, reaproveita o conteúdo e mantém a composição da opção que estava escolhida
     nova       → peça diferente, ou "do zero"
     copy       → quer texto/legenda (vai para copy.js)
     conversa   → pergunta ou comentário: responde em texto, sem gerar arte e sem gastar arte
     perguntar  → ambíguo de verdade: pergunta na hora (2 opções)

   O estado que a IA enxerga é um RESUMO (crContexto): últimos pedidos, o que foi entregue (formato,
   título, preço, marca, opção escolhida) e o que está em andamento — nunca o chat inteiro.
   Sem IA, um roteador local cobre o essencial (tema Much+, formato, preço). Na dúvida com arte entregue,
   assume "modificar" — "Nova arte" ou a palavra "outra" resolvem o contrário.
   Depende de creative.js (carregado antes).
══════════════════════════════════════════════════════════════ */

// O que a mensagem pode mudar na arte (chaves do conteúdo — as mesmas que crNormaliza lê)
const CR_MUDA_CHAVES = ['marca', 'formato', 'titulo', 'palavra', 'apoio', 'topo', 'precoDe', 'precoPor', 'cupomValor', 'cupomCodigo', 'anos', 'cta', 'legal', 'loja', 'horario'];

// Última entrega do chat (sem contar o fio que acabou de chegar)
function crUltimaEntrega(excluir){
  for(let i = crState.fios.length - 1; i >= 0; i--){
    const f = crState.fios[i];
    if(f !== excluir && f.entregas && f.entregas.length && f.conteudo) return { fio: f, ops: f.entregas[f.entregas.length - 1] };
  }
  return null;
}

// O resumo que a IA lê. Objeto + texto (o texto vai no prompt).
function crContexto(excluir){
  const fios = crState.fios.filter(f => f !== excluir), ent = crUltimaEntrega(excluir);
  const ultimos = fios.slice(-5).map(f => '"' + String(f.pedido).slice(0, 140) + '"');
  const linhas = [];
  linhas.push('Últimos pedidos (do mais antigo ao mais recente): ' + (ultimos.length ? ultimos.join(' → ') : 'nenhum'));
  if(ent){
    const sp = crNormaliza(ent.fio.conteudo), esc = Math.min(ent.fio.escolha || 0, ent.ops.length - 1), op = ent.ops[esc];
    const campos = [['peça', CR_OBJETIVOS[sp.objetivo]], ['formato', CR_FORMATOS[sp.formato].nome], ['título', [sp.palavra, sp.titulo].filter(Boolean).join(' ')], ['apoio', sp.apoio],
      ['preço DE', sp.precoDe && 'R$ ' + sp.precoDe], ['preço POR', sp.precoPor && 'R$ ' + sp.precoPor], ['cupom', sp.cupomValor && sp.cupomValor + (/%$/.test(sp.cupomValor) ? '' : ' (valor)')],
      ['código do cupom', sp.cupomCodigo], ['anos', sp.anos], ['loja', sp.loja], ['horário', sp.horario],
      ['tema', sp.marca === 'much' ? 'Much+ (magenta)' : 'Delivery Much (laranja)'], ['foto', sp.foto ? (sp.foto === 'slot' ? 'espaço reservado' : 'enviada') : 'sem']];
    linhas.push('ARTE ENTREGUE MAIS RECENTE (a que a pessoa está vendo): ' + campos.filter(([, v]) => v).map(([k, v]) => k + ': ' + v).join(' · '));
    linhas.push('Opções mostradas: ' + ent.ops.map((o, i) => (i + 1) + '. ' + o.nomeReceita).join(' | ') + ' — escolhida: ' + (esc + 1) + (op ? ' (' + op.nomeReceita + ')' : ''));
    linhas.push('Legenda do post: ' + (ent.fio.legenda ? 'já escrita' : 'não há') + ' · Rodadas de "outras opções": ' + (ent.fio.rodada || 0));
  }else linhas.push('Nenhuma arte entregue ainda.');
  linhas.push('Em andamento agora: ' + (crState.rodando ? 'uma geração' : 'nada'));
  return { ent, texto: linhas.join('\n') };
}

function crPromptRoteador(ctx, mensagem){
  return [
    'Você é o ROTEADOR do chat do Luma Creative (gerador de artes da Delivery Much). Leia o estado do chat e a nova mensagem e decida o que a pessoa quer. Pense como alguém que viu a conversa toda.',
    '', 'ESTADO DO CHAT:', ctx.texto,
    '', 'NOVA MENSAGEM: """' + _crAspas(mensagem).slice(0, 800) + '"""',
    '', 'AÇÕES:',
    '- "modificar": quer ALTERAR a arte que está na tela, mesmo conteúdo — trocar o tema/marca ("agora no tema Much+"), o formato ("faz em story"), um texto, o preço, o cupom, o código. Se a mensagem só descreve um ajuste, é modificar.',
    '- "nova": uma peça DIFERENTE (outro produto/assunto/objetivo) ou pede explicitamente do zero / "outra arte".',
    '- "copy": quer um texto, legenda, roteiro ou mensagem (não uma arte).',
    '- "conversa": pergunta ou comentário que não pede geração ("por que escolheu essa?", "o que é Much+?", "valeu"). Responda em "resposta" (2–3 frases, em PT-BR, usando o estado do chat).',
    '- "perguntar": ambíguo de verdade (poderia ser modificar ou nova) — escreva a pergunta em "pergunta".',
    'REGRA: havendo arte entregue, na dúvida entre modificar e nova prefira "modificar" se a mensagem não traz assunto novo. Sem arte entregue, é "nova".',
    '', 'Em "mudancas" (só em modificar; apenas o que a mensagem pede) use estas chaves: marca ("dm" laranja | "much" magenta/Much+), formato (' + Object.keys(CR_FORMATOS).join('|') + '), titulo, palavra, apoio, topo, precoDe, precoPor, cupomValor, cupomCodigo, anos, cta, legal, loja, horario. Valores como estariam impressos na arte (ex.: precoPor "19,90").',
    'Responda SÓ o JSON: {"acao":"modificar|nova|copy|conversa|perguntar","mudancas":{},"resposta":"","pergunta":"","resumo":"1 frase curta do que vou fazer"}'
  ].join('\n');
}

// Roteador local (sem IA): só o que dá para entender com certeza
function crRotearLocal(msg, ent){
  if(!ent) return { acao: 'nova' };
  const m = String(msg).toLowerCase();
  if(/\b(nova arte|outra arte|do zero|do começo|novo pedido|nova peça|começar de novo)\b/.test(m)) return { acao: 'nova' };
  const mud = {}, sp = crNormaliza(ent.fio.conteudo);
  if(/much\s*\+|much\s*mais|muchplus|tema\s+much/.test(m) && !/\b(tira|sem|remove|volta)\b/.test(m)) mud.marca = 'much';
  else if(/\b(tira|sem|remove|volta)\b.*(much|tema)|\btema\s+(padr[aã]o|laranja|normal)\b/.test(m)) mud.marca = 'dm';
  const f = typeof _crFormatoDito === 'function' ? _crFormatoDito(msg) : null;
  if(f && f !== sp.formato && m.length <= 120) mud.formato = f;
  const pr = /(?:pre[cç]o|por|valor)\s*(?:para|pra|de|:)?\s*r?\$?\s*(\d{1,4}(?:[.,]\d{1,2})?)/.exec(m);
  if(pr && sp.precoPor && m.length <= 120) mud.precoPor = pr[1].replace('.', ',');
  if(Object.keys(mud).length) return { acao: 'modificar', mudancas: mud };
  if(m.length <= 100 && /\b(agora|muda|mude|troca|troque|coloca|põe|poe|tira|remove|aumenta|diminui|mais|menos|em vez|ao invés|deixa|deixe)\b/.test(m))
    return { acao: 'conversa', resposta: 'Entendi que é um ajuste na arte de cima, mas sem IA conectada eu só sei aplicar: tema Much+ (ou voltar ao padrão), trocar o formato e o preço. Para pedidos livres, conecte a sua conta de IA em "Minhas contas de IA".' };
  return { acao: 'nova' };
}

// Valida e limpa o que o roteador pediu para mudar
function crLimpaMudancas(m){
  const out = {};
  if(!m || typeof m !== 'object') return out;
  CR_MUDA_CHAVES.forEach(k => {
    if(m[k] == null || m[k] === '') return;
    let v = String(m[k]).trim().slice(0, 90);
    if(k === 'marca'){ if(v === 'much' || v === 'dm') out.marca = v; return; }
    if(k === 'formato'){ if(CR_FORMATOS[v]) out.formato = v; return; }
    if(k === 'anos') v = v.replace(/\D/g, '').slice(0, 2);
    if(v) out[k] = v;
  });
  return out;
}

const _crMudaTxt = mud => Object.keys(mud).map(k => k === 'marca' ? (mud[k] === 'much' ? 'tema Much+' : 'tema Delivery Much') : k === 'formato' ? 'formato ' + CR_FORMATOS[mud[k]].nome : k + ' ' + mud[k]).join(', ');

// O ponto de entrada: crEnviar chama isto no lugar de crGerar
async function crDespachar(fio, conv){
  const ctx = crContexto(fio), ent = ctx.ent;
  if(!ent) return crGerar(fio, conv);                         // 1ª mensagem: nada para ler, é arte nova

  // Mensagem que só pode ser local, sem gastar chamada
  let rota = null, pago = false;
  const run = { parado: false, cancelar: null };
  crState.rodando = run; _crOcupado(true);
  const msg = _crMsgIA(conv), corpo = msg.querySelector('.cr-corpo');
  msg.querySelector('.cr-bolha').remove(); msg.classList.add('cr-pensando');
  const lista = document.createElement('ul'); lista.className = 'cr-passos'; corpo.appendChild(lista);
  let status = _crStatus(corpo);
  const p = _crPasso(lista, 'Lendo o contexto');
  const fim = () => { msg.classList.remove('cr-pensando'); if(crState.rodando === run){ crState.rodando = null; _crOcupado(false); } };
  const aviso = txt => { const b = document.createElement('div'); b.className = 'cr-bolha'; b.textContent = txt; corpo.appendChild(b); _crRola(); };
  const prov = typeof gProvAtivo === 'function' ? gProvAtivo() : null;
  let consumiu = false;
  try{
    if(_crIaPronta()){
      const modelo = prov ? 'conta:' + prov.id + ':' + prov.modelo : crModelo(), uso = prov ? { ok: true } : await crUsoConsome(modelo);
      if(!uso.ok){ p.feito('sem saldo', true); status.parar(); aviso(crUsoMsg(modelo) || 'Não foi possível contar esta mensagem agora. Tente de novo.'); return fim(); }
      consumiu = !prov; pago = true; crState.modeloRun = prov ? null : modelo; crState.provRun = prov;
      let j = null;
      try{ j = gAiParseJson(await _crAsk('arte.compor', crPromptRoteador(ctx, fio.pedido), { json: true, cache: false })); }catch(err){ j = null; }
      crState.modeloRun = null; crState.provRun = null;
      if(run.parado){ if(consumiu) crUsoEstorna(); p.feito('interrompido', true); status.parar(); aviso('Interrompido.'); _crFocaCampo(); return fim(); }
      if(j && ['modificar', 'nova', 'copy', 'conversa', 'perguntar'].includes(j.acao)) rota = j;
    }
    if(!rota) rota = crRotearLocal(fio.pedido, ent);
    rota.mudancas = crLimpaMudancas(rota.mudancas);
    // modificar sem mudança que eu saiba aplicar não é modificar: é conversa/pergunta
    if(rota.acao === 'modificar' && !Object.keys(rota.mudancas).length) rota = { acao: 'perguntar', pergunta: 'Entendi que é um ajuste na arte de cima, mas não sei o que mudar. Quer descrever com mais detalhe, ou criar uma arte nova?' };

    const resumo = String(rota.resumo || '').slice(0, 140);
    if(rota.acao === 'conversa'){
      p.feito('só conversa — não gasta arte');
      status.parar();
      if(consumiu) crUsoEstorna();                           // conversa não conta como arte
      aviso(String(rota.resposta || 'Posso ajudar com a arte de cima, criar outra ou escrever um texto.').slice(0, 600));
      return fim();
    }
    if(rota.acao === 'perguntar'){
      p.feito('preciso confirmar');
      status.parar();
      const r = await _crPerguntar(corpo, [{ titulo: 'Entendi certo?', pergunta: String(rota.pergunta || 'Quer mudar a arte de cima ou criar uma nova do zero?').slice(0, 160), livre: false,
        opcoes: [{ rotulo: 'Mudar a arte de cima', valor: 'modificar' }, { rotulo: 'Criar uma nova do zero', valor: 'nova' }] }], run);
      const v = r && r[0] && !r[0].pulou ? r[0].valor : null;
      if(!v || run.parado){ if(consumiu) crUsoEstorna(); aviso('Interrompido.'); _crFocaCampo(); return fim(); }
      rota.acao = v;
      if(v === 'modificar' && !Object.keys(rota.mudancas).length){
        if(consumiu) crUsoEstorna();
        aviso('Certo. Me diga o que mudar na arte de cima (tema, formato, texto, preço…).'); _crFocaCampo(); return fim();
      }
    }
    if(rota.acao === 'copy'){
      p.feito('pedido de texto');
      if(consumiu) crUsoEstorna();
      fim(); fio.copy = {}; return crCopy(fio, conv);
    }
    if(rota.acao === 'modificar'){
      p.feito('vou alterar a arte de cima: ' + (resumo || _crMudaTxt(rota.mudancas)));
      status.parar();
      fio.modo = 'modificar'; fio.resumoMud = resumo || _crMudaTxt(rota.mudancas);
      const base = ent.fio, esc = Math.min(base.escolha || 0, ent.ops.length - 1);
      fio.base = ent.ops[esc] || null;
      fio.conteudo = Object.assign({}, base.conteudo, rota.mudancas);
      fio.briefing = base.briefing; fio.foto = base.foto; fio.ref = base.ref; fio.viaIA = base.viaIA;
      fio.fmt = rota.mudancas.formato || base.fmt;
      fio.marca = rota.mudancas.marca || (base.conteudo && base.conteudo.marca) || base.marca;
      fio.conteudo.marca = fio.marca; fio.conteudo.formato = fio.fmt;
      crLigaMuch(fio.marca === 'much');
      fio._pago = pago && consumiu;                          // a chamada do roteador já abriu a janela e gastou: crGerar não conta de novo
    }else{
      p.feito('arte nova' + (resumo ? ': ' + resumo : ''));
      status.parar();
      fio._pago = pago && consumiu;
    }
    fim();
    return crGerar(fio, conv);
  }catch(err){
    console.error('[creative/harness]', err);
    if(consumiu) crUsoEstorna();
    crState.modeloRun = null; crState.provRun = null;
    status.parar(); fim();
    return crGerar(fio, conv);                                // o roteador nunca derruba o chat: cai no comportamento de sempre
  }
}
