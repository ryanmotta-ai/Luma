/* ══════════════════════════════════════════════════════════════
   LUMA CREATIVE — modo COPY (15/10/2026)

   Quando o pedido é um TEXTO ("quero uma copy", "uma legenda", "um roteiro", "mensagem de whatsapp"…)
   e não uma arte, o chat vira o de um copywriter: faz o briefing (canal, objetivo, tom — só o que o
   pedido não diz), escreve 3 versões com ângulos diferentes e deixa ajustar (outras / mais curta /
   mais leve). Reaproveita o mesmo chat do Creative: passos, perguntas, limite diário e modelo.

   Só com IA conectada (o motor local não escreve texto). Não inventa preço, cupom, prazo nem loja.
   Depende de creative.js (carregado antes): _crMsgIA, _crStatus, _crPasso, _crPerguntar, _crAsk…
══════════════════════════════════════════════════════════════ */

const CR_COPY_GATILHO = /\b(copy|copys|copywriting|copywriter|texto|textos|legenda|legendas|caption|roteiro|slogan|headline|mensagem|disparo|bio|descri[cç][aã]o|escreva|escreve|redija|redige)\b/i;
const CR_COPY_ARTE = /\b(arte|artes|banner|story|stories|feed|capa|slide|carrossel|inapp|imagem|cartaz|template)\b/i;
// "/copy …" força; senão: pede texto E não fala de peça visual
const crEhCopy = pedido => /^\s*(\/copy\b|copy\s*:)/i.test(pedido) || (CR_COPY_GATILHO.test(pedido) && !CR_COPY_ARTE.test(pedido));

// O BRANDING BOOK inteiro (js/creative/branding.js) vai no prompt como a skill de marca; estas são só as regras de OFÍCIO que o livro não cobre
const CR_COPY_OFICIO = [
  'REGRAS DE OFÍCIO (valem junto do guia de marca):',
  '- O guia de marca fala sobretudo com LEADS DE FRANQUIA (Paulo e Lucas). Se o público do briefing for cliente final ou lojista parceiro, mantenha a mesma voz (simples, amigável, direta, "a gente"), os 3 valores e a persona Cássio, mas NÃO use as abordagens de Paulo/Lucas, que são só para lead de franquia.',
  '- NÃO invente preço, desconto, cupom, prazo, faturamento, endereço, telefone nem nome de loja que o pedido não trouxe. Se faltar o dado, escreva sem ele ou deixe [entre colchetes] para a pessoa preencher.',
  '- Emoji: no máximo 1–2, só em post social e WhatsApp; nenhum em e-mail formal. Hashtags só em Instagram (até 5, com #deliverymuch).',
  '- Termine com chamada clara para agir (ex.: "Pede no app da Delivery Much" / "Fale com a gente").',
  '- Antes de responder, confira mentalmente o CHECKLIST do guia; só entregue o que passa.'
].join('\n');

const CR_COPY_AJUSTES = {
  mais: 'Escreva 3 versões NOVAS, com ângulos diferentes das anteriores.',
  curto: 'Reescreva as 3 versões bem mais CURTAS (metade do tamanho), mantendo a ideia e a chamada.',
  leve: 'Reescreva as 3 versões num tom mais LEVE e bem-humorado, sem perder a clareza nem a chamada.'
};

function crPromptCopyBriefing(pedido){
  return [
    'Você é copywriter sênior da Delivery Much (app de delivery de cidades do interior). A gestão pediu um TEXTO. Antes de escrever, faça o briefing: pergunte SÓ o que muda o texto e o pedido não responde.', '', '=== BRANDING BOOK DA DELIVERY MUCH ===', CR_BRANDING, '=== FIM DO BRANDING BOOK ===',
    '', 'PEDIDO: """' + _crAspas(pedido).slice(0, 1200) + '"""',
    '', 'Regras: no máximo 3 perguntas, curtas, cada uma com 3 ou 4 opções de resposta (até 48 caracteres). Típicas: canal (Instagram, WhatsApp, e-mail, anúncio, roteiro de vídeo), PÚBLICO (cliente final, lojista parceiro, lead de franquia — Paulo ou Lucas), objetivo (vender, avisar, engajar, recrutar). O tom é o da marca (guia abaixo), não pergunte tom. Se o pedido já diz o canal/objetivo/tom, NÃO pergunte.',
    'Responda SÓ o JSON: {"resumo":"1 frase do que entendi","perguntas":[{"titulo":"até 14 caracteres","pergunta":"...","opcoes":["...","..."]}]}'
  ].join('\n');
}
function crPromptCopyTexto(fio, ajuste){
  const brief = (fio.copy.brief || []).filter(r => !r.pulou).map(r => '- ' + r.titulo + ': ' + r.resposta).join('\n');
  return [
    'Você é copywriter sênior da Delivery Much. Escreva o texto pedido SEGUINDO O BRANDING BOOK abaixo (é a skill de marca: voz, persona Cássio, valores, checklist).', '', '=== BRANDING BOOK DA DELIVERY MUCH ===', CR_BRANDING, '=== FIM DO BRANDING BOOK ===', '', CR_COPY_OFICIO,
    '', 'PEDIDO: """' + _crAspas(fio.pedido).slice(0, 1200) + '"""',
    brief ? '\nBRIEFING (respostas da gestão):\n' + brief : '',
    fio.copy.versoes && fio.copy.versoes.length ? '\nVERSÕES ANTERIORES (não repita):\n' + fio.copy.versoes.map(v => '"' + v.texto.slice(0, 220) + '"').join('\n') : '',
    '', ajuste && CR_COPY_AJUSTES[ajuste] ? CR_COPY_AJUSTES[ajuste] : 'Escreva 3 versões com ÂNGULOS diferentes (ex.: direta, divertida, emocional). Cada uma completa e pronta para usar no canal do briefing.',
    'Responda SÓ o JSON: {"versoes":[{"angulo":"1–2 palavras","texto":"o texto pronto, com quebras de linha como \\n"}],"dica":"1 frase de dica de uso (horário, imagem, o que testar)"}'
  ].filter(l => l !== '').join('\n');
}

async function crCopy(fio, conv, ajuste){
  const run = { parado: false, cancelar: null };
  crState.rodando = run; _crOcupado(true);
  const msg = _crMsgIA(conv), corpo = msg.querySelector('.cr-corpo'), t0 = Date.now();
  msg.querySelector('.cr-bolha').remove(); msg.classList.add('cr-pensando');
  const lista = document.createElement('ul'); lista.className = 'cr-passos'; corpo.appendChild(lista);
  let status = _crStatus(corpo), p = null, consumiu = false, entregou = false;
  const aviso = (txt, acao, erro) => {
    const b = document.createElement('div'); b.className = 'cr-bolha cr-interrompido' + (erro ? ' cr-erro' : ''); b.textContent = txt;
    if(acao){ const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'cr-btn cr-btn-mini cr-aviso-ac'; bt.textContent = acao.rotulo; bt.onclick = () => { bt.disabled = true; acao.fn(); }; b.appendChild(bt); }
    corpo.appendChild(b); _crRola();
  };
  const parou = () => { if(!run.parado) return false; status.parar(); aviso('Interrompido.'); _crFocaCampo(); return true; };
  try{
    if(!_crIaPronta()){
      status.parar();
      return aviso('Para escrever textos eu preciso de IA conectada: o motor local só diagrama artes. Conecte a sua conta de IA ou use um modelo do Luma.', { rotulo: 'Minhas contas de IA', fn: () => crConexoes(true) });
    }
    const prov = typeof gProvAtivo === 'function' ? gProvAtivo() : null;
    const modelo = prov ? 'conta:' + prov.id + ':' + prov.modelo : crModelo(), uso = prov ? { ok: true } : await crUsoConsome(modelo);
    if(!uso.ok){ status.parar(); return aviso(crUsoMsg(modelo) || 'Não foi possível contar este texto agora. Tente de novo.'); }
    consumiu = !prov; crState.modeloRun = prov ? null : modelo; crState.provRun = prov;
    if(parou()) return;
    const t = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

    // 1) Briefing (só na primeira vez; os ajustes reaproveitam as respostas)
    if(!fio.copy.brief){
      p = _crPasso(lista, 'Entendendo o pedido');
      let j = null;
      try{ j = gAiParseJson(await _crAsk('arte.compor', crPromptCopyBriefing(fio.pedido), { json: true, cache: false })); }catch(err){ j = null; }
      if(parou()) return;
      const perguntas = ((j && Array.isArray(j.perguntas)) ? j.perguntas : []).map(q => ({
        titulo: t(q && q.titulo, 14) || 'Pergunta', pergunta: t(q && q.pergunta, 140),
        opcoes: (Array.isArray(q && q.opcoes) ? q.opcoes : []).map(o => t(o, 48)).filter(Boolean).slice(0, 4).map(o => ({ rotulo: o }))
      })).filter(q => q.pergunta).slice(0, 3);
      p.feito((j && t(j.resumo, 200)) || 'texto pedido');
      fio.copy.brief = [];
      if(perguntas.length){
        status.parar();
        const resp = await _crPerguntar(corpo, perguntas, run);
        if(!resp || run.parado){ fio.copy.brief = null; parou(); if(!run.parado) aviso('Interrompido.'); return; }
        fio.copy.brief = resp;
        const ditas = resp.filter(r => !r.pulou).map(r => r.titulo + ': ' + r.resposta);
        _crPasso(lista, 'Briefing').feito(ditas.length ? ditas.join(' · ') : 'sem respostas — escrevo pelo pedido');
        status = _crStatus(corpo);
      }
    }

    // 2) Texto
    p = _crPasso(lista, ajuste ? 'Reescrevendo' : 'Escrevendo as versões');
    let j = null;
    try{ j = gAiParseJson(await _crAsk('arte.compor', crPromptCopyTexto(fio, ajuste), { json: true, cache: false })); }catch(err){ j = null; }
    if(parou()) return;
    const versoes = ((j && Array.isArray(j.versoes)) ? j.versoes : []).map(v => ({ angulo: t(v && v.angulo, 24) || 'Versão', texto: t(v && v.texto, 2500) })).filter(v => v.texto).slice(0, 3);
    if(!versoes.length){
      p.feito(typeof gProvUltimoErro === 'string' && prov && gProvUltimoErro ? gProvUltimoErro : 'a IA devolveu uma resposta que não consegui ler', true);
      status.parar();
      return aviso('Não consegui escrever o texto agora.', { rotulo: 'Tentar de novo', fn: () => { if(!crState.rodando) crCopy(fio, conv, ajuste); } }, true);
    }
    fio.copy.versoes = versoes;
    p.feito(versoes.length + ' versões');
    status.parar();

    // 3) Entrega: um cartão por versão, com copiar; ajustes embaixo
    const fala = document.createElement('div'); fala.className = 'cr-bolha'; corpo.appendChild(fala);
    await _crDigita(fala, ajuste ? 'Reescrevi. Quer outro ajuste?' : 'Aqui vão ' + versoes.length + ' versões, cada uma com um ângulo. Copie a que combinar ou peça um ajuste.');
    const box = document.createElement('section'); box.className = 'cr-copy cr-entra'; box.setAttribute('aria-label', 'Versões do texto');
    box.innerHTML = versoes.map((v, i) => '<article class="cr-copy-card"><header><b>' + (i + 1) + '. ' + gEsc(v.angulo) + '</b>'
        + '<button type="button" class="cr-btn cr-btn-mini" data-cp="' + i + '">' + CR_ICO.copiar + 'Copiar</button></header>'
        + '<p class="cr-copy-txt">' + gEsc(v.texto) + '</p></article>').join('')
      + (j && t(j.dica, 200) ? '<p class="cr-copy-dica">' + gEsc(t(j.dica, 200)) + '</p>' : '')
      + '<div class="cr-acoes"><button type="button" class="cr-btn" data-cpa="mais">' + CR_ICO.refazer + 'Outras versões</button>'
      + '<button type="button" class="cr-btn cr-btn-leve" data-cpa="curto">Mais curto</button><button type="button" class="cr-btn cr-btn-leve" data-cpa="leve">Mais leve</button></div>';
    box._fio = fio;
    corpo.appendChild(box);
    entregou = true; crUsoConfirma();
    _crResumo(corpo, lista, t0);
    _crRola();
    if(typeof gTrackEvent === 'function') try{ gTrackEvent('creative_copy', { ia: true, ajuste: ajuste || '', perguntas: (fio.copy.brief || []).length }); }catch(err){}
  }catch(err){
    console.error('[creative/copy]', err);
    status.parar();
    if(p && p.ativo && p.ativo()) p.feito('falhou aqui', true);
    aviso('Não consegui escrever o texto agora.', { rotulo: 'Tentar de novo', fn: () => { if(!crState.rodando) crCopy(fio, conv, ajuste); } }, true);
  }finally{
    if(consumiu && !entregou) crUsoEstorna();
    crState.modeloRun = null; crState.provRun = null;
    msg.classList.remove('cr-pensando');
    if(crState.rodando === run){ crState.rodando = null; _crOcupado(false); }
  }
}

document.addEventListener('click', e => {
  if(typeof _crNoCreative === 'function' && !_crNoCreative()) return;
  const cp = e.target.closest('[data-cp]');
  if(cp){
    const box = cp.closest('.cr-copy'), v = box && box._fio && box._fio.copy.versoes && box._fio.copy.versoes[+cp.dataset.cp]; if(!v) return;
    const ok = () => { const o = cp.innerHTML; cp.textContent = 'Copiado'; setTimeout(() => { cp.innerHTML = o; }, 1600); };
    return (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(v.texto).then(ok) : Promise.reject()).catch(() => gToast('Não consegui copiar. Selecione o texto e copie.', 'error'));
  }
  const ac = e.target.closest('[data-cpa]');
  if(ac){
    const box = ac.closest('.cr-copy'); if(!box || !box._fio || crState.rodando) return;
    crCopy(box._fio, document.getElementById('cr-conversa'), ac.dataset.cpa);
  }
});

/* Legenda do post da arte (crLegenda, em creative.js): uma legenda no tom do branding book, só com o que a ARTE diz.
   Devolve [{ text }] com _ia=true; null/[] faz o crLegenda cair no gerador do Franqueado. */
async function crLegendaMarca(sp){
  const dados = [
    ['Pedido da gestão (contexto)', sp.pedido && String(sp.pedido).slice(0, 300)], ['Resumo', sp.resumo], ['Tema da arte', sp.marca === 'much' ? 'Much+ (programa de cashback da marca, cor magenta)' : 'Delivery Much (laranja)'], ['Formato', sp.formato],
    ['Tipo de peça', (typeof CR_OBJETIVOS !== 'undefined' && CR_OBJETIVOS[sp.objetivo]) || sp.objetivo], ['Título da arte', [sp.palavra, sp.titulo].filter(Boolean).join(' ')], ['Apoio', sp.apoio],
    ['Preço DE', sp.precoDe && 'R$ ' + sp.precoDe], ['Preço POR', sp.precoPor && 'R$ ' + sp.precoPor],
    ['Desconto do cupom', sp.cupomValor && (/%$/.test(sp.cupomValor) ? sp.cupomValor + ' OFF' : 'R$ ' + sp.cupomValor + ' OFF')], ['Código do cupom', sp.cupomCodigo],
    ['Anos da franquia', sp.anos], ['Loja', sp.loja], ['Horário', sp.horario], ['Selos', (sp.selo || []).join(' · ')]
  ].filter(([, v]) => v).map(([k, v]) => '- ' + k + ': ' + v).join('\n');
  const prompt = [
    'Você é copywriter sênior da Delivery Much. Escreva a LEGENDA do post (Instagram/WhatsApp) que acompanha esta arte, SEGUINDO O BRANDING BOOK abaixo.',
    '', '=== BRANDING BOOK DA DELIVERY MUCH ===', CR_BRANDING, '=== FIM DO BRANDING BOOK ===', '', CR_COPY_OFICIO,
    '', 'O QUE A ARTE DIZ (use SÓ isto; nenhum dado novo — os nomes à esquerda são rótulos, não os copie para o texto):', dados,
    '', 'Público: quem segue o perfil da franquia na cidade (cliente final), a menos que a peça seja sobre a franquia. Legenda curta (3 a 6 linhas): primeira linha que prende, o benefício para quem pede, uma chamada para agir, até 5 hashtags com #deliverymuch. Fale do que a arte mostra, com frases naturais; releia: nenhuma frase pode terminar solta ou sem sentido.',
    'Responda SÓ o JSON: {"legenda":"o texto pronto, com quebras de linha como \\n"}'
  ].join('\n');
  const j = gAiParseJson(await _crAsk('arte.compor', prompt, { json: true, cache: false }));
  const t = j && typeof j.legenda === 'string' ? j.legenda.trim().slice(0, 2200) : '';
  if(!t) return null;
  const r = [{ text: t }]; r._ia = true; return r;
}
