/* ══════════════════════════════════════════════════════════════════════════════════════════
   COPY FIT — regressão das GARANTIAS do motor de encurtar (js/core/copy-fit.js).
   `node scripts/run-browser-tests.js copy-fit`.

   O que se cobra é o que torna seguro aplicar a sugestão com um toque:
     · número nenhum muda (preço, quantidade, volume) · nunca fica mais longo;
     · ITEM nenhum some — só limpeza, unidade, forma curta consagrada, lista, tamanho em
       contexto e enfeite de lista fechada;
     · a caixa (MAIÚSCULA) do que foi digitado é preservada · mesma entrada, mesma saída;
     · "cabe" vem de quem mede (aqui um `cabe` falso; na prévia, o Local Fit), e a 1ª
       sugestão é a de menor CUSTO perceptível — combinação de degraus, não escada fixa.
   ══════════════════════════════════════════════════════════════════════════════════════════ */
(async function(){
  const results = document.getElementById('results');
  const summary = document.getElementById('summary');
  const cases = [], falhas = [];
  const test = (name, fn) => cases.push({ name, fn });
  const assert = (c, m) => { if(!c) throw new Error(m || 'asserção falhou'); };
  const textos = s => gCopyFitCandidatos(s).map(c => c.text);

  /* Tudo o que o motor PODE fazer sumir. Qualquer outra palavra do original tem que estar
     no candidato — é assim que se prova que item nenhum foi cortado. */
  const PODE_SUMIR = /^(por|apenas|somente|com|e|litros?|lts?|mililitros?|ml|gramas?|quilos?|unidades?|refrigerantes?|hamb[uú]rgueres|hamb[uú]rguer|promo[cç](?:[aã]o|[oõ]es)|de|desconto|segunda|sexta|s[aá]bado|a|segunda-feira|ter[cç]a-feira|quarta-feira|quinta-feira|sexta-feira|grandes?|m[eé]di[oa]s?|pequen[oa]s?|tamanho|super|mega|delicios[oa]s?|incr[ií]ve(?:l|is)|gourmet|maravilhos[oa]s?|exclusiv[oa]s?|imperd[ií]ve(?:l|is)|irresist[ií]ve(?:l|is)|famos[oa]s?|saboros[oa]s?|top)$/iu;
  /* Estar na lista não basta: "com", "apenas" e o enfeite só podem sair NA POSIÇÃO certa. Sem
     isso a suíte aprovava "Café + leite", "Frete grátis para o centro" e "Pizza" (de "Pizza
     Especial"). Estas regras são a especificação, escritas à parte do motor. */
  const ITEM = /^(refris?|refrigerantes?|batatas?|fritas|sucos?|burgers?|hamb[uú]rgueres|hamb[uú]rguer|pizzas?|por[cç](?:[aã]o|[oõ]es)|sobremesas?|bebidas?|guaran[aá]s?|coca-cola|cocas?|milk-?shakes?|a[cç]a[ií]s?|sorvetes?|past[eé]is|pastel|esfihas?|coxinhas?|x-\p{L}+)$/iu;
  const ENFEITE = /^(super|mega|delicios[oa]s?|incr[ií]ve(?:l|is)|gourmet|maravilhos[oa]s?|exclusiv[oa]s?|imperd[ií]ve(?:l|is)|irresist[ií]ve(?:l|is)|famos[oa]s?|saboros[oa]s?|top)$/iu;
  const LIGA = /^(o|a|os|as|um|uma|uns|umas|de|do|da|dos|das|no|na|nos|nas|e|em|com|para|pra|seu|sua|seus|suas|\+)$/iu;
  const nu = w => String(w || '').toLowerCase().replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, '');
  const brutas = s => String(s).split(/\s+/).filter(Boolean);
  const preco = w => /^r\$/i.test(w || '') || /^\d+,\d{2}/.test(w || '');
  const saiAqui = (b, i) => {                       // a palavra b[i] do original PODE sair aqui?
    const w = nu(b[i]), ant = b[i - 1], prox = nu(b[i + 1]);
    if(w === 'com' || w === 'e') return !!ant && !/^\d+$/.test(nu(ant)) && ITEM.test(prox);
    if(w === 'apenas' || w === 'somente') return preco(b[i + 1]);
    if(w === 'por' && /^(apenas|somente)$/.test(prox)) return preco(b[i + 2]);
    if(ENFEITE.test(w)){
      const anteposto = i === 0 || /[:!?.,;]$/.test(ant) || !/[\p{L}\d]/u.test(ant) || LIGA.test(ant);
      return anteposto && /^\p{L}/u.test(prox) && !/^(grandes?|gigantes?|fam[ií]lia|g|m|p|mercados?)$/.test(prox);
    }
    return null;                                    // não depende de posição
  };
  const itensIntactos = (orig, cand) => {
    const b = brutas(orig), resta = {};
    brutas(cand).forEach(w => { w = nu(w); resta[w] = (resta[w] || 0) + 1; });
    const sumiu = [], podia = {};
    b.forEach((raw, i) => {
      const w = nu(raw);
      if(!w || /^\d/.test(w)) return;
      const ctx = saiAqui(b, i);
      if(ctx !== null){ podia[w] = (podia[w] || 0) + (ctx ? 1 : 0); podia['#' + w] = (podia['#' + w] || 0) + 1; return; }
      if(PODE_SUMIR.test(w)) return;
      if(resta[w]) resta[w]--; else sumiu.push(w);
    });
    // Palavra de posição: quantas saíram ≤ quantas estavam num lugar em que podiam sair.
    Object.keys(podia).filter(k => k[0] !== '#').forEach(w => {
      if(podia['#' + w] - (resta[w] || 0) > podia[w]) sumiu.push(w + ' (fora de posição)');
    });
    return sumiu;
  };

  const FRASES = [
    'Super Combo Família com 2 Burgers Artesanais + Batata Grande e Refrigerante',
    'SUPER COMBO FAMÍLIA COM 2 HAMBÚRGUERES + BATATA GRANDE E REFRIGERANTE 2 LITROS',
    'Pizza de Calabresa com Borda de Catupiry por apenas R$ 49,90',
    'Promoção de segunda a sexta: 50% de desconto no almoço',
    'Açaí 500 mililitros com granola e leite condensado',
    'Delicioso X-Tudo Especial com bacon', 'Especial da Casa com Batata Frita',
    'Leve 3 pague 2 em pizzas médias', 'Refrigerante 2 litros grátis na compra acima de R$ 60',
    'Combo Tradicional com Pastel de Carne e Caldo de Cana 300 ml',
    // os que já saíram dizendo OUTRA COISA (22/09): a regra de posição do teste 2 cobra
    'Café com leite e pão na chapa', 'Burger com molho especial e refri', 'Pizza Especial com Refrigerante',
    'Frete grátis apenas para o centro por R$ 5,00', 'Famosa coxinha da Dona Maria', 'X-Tudo mega com fritas'
  ];

  test('1 · número nenhum muda, e nada fica mais longo — em todo degrau', () => {
    FRASES.forEach(f => gCopyFitCandidatos(f).forEach(c => {
      assert(gCopyFitGuarda(f, c.text), 'mudou número/comprimento: "' + f + '" → "' + c.text + '"');
      assert(c.text.length < f.length, 'não encurtou: ' + c.text);
    }));
  });

  test('2 · item nenhum some: só sai o que está na lista do que pode sair', () => {
    FRASES.forEach(f => gCopyFitCandidatos(f).forEach(c => {
      const sumiu = itensIntactos(f, c.text);
      assert(!sumiu.length, 'sumiu "' + sumiu.join(', ') + '" de "' + f + '" → "' + c.text + '"');
    }));
  });

  test('3 · MAIÚSCULA continua maiúscula; Título continua Título', () => {
    const up = textos('COMBO COM REFRIGERANTE E HAMBÚRGUER');
    assert(up.every(t => t === t.toUpperCase()), 'caixa alta quebrou: ' + up.join(' | '));
    assert(textos('Combo com Refrigerante').some(t => /Refri\b/.test(t)), 'Refrigerante deveria virar Refri');
  });

  test('4 · tamanho só vira letra depois de algo que TEM tamanho', () => {
    assert(!textos('Grande São Paulo').length, '"Grande São Paulo" não podia mudar');
    assert(textos('Batata Grande').includes('Batata G'), 'Batata Grande deveria virar Batata G');
  });

  test('5 · "Especial" abrindo a frase é NOME; "Delicioso" abrindo é enfeite', () => {
    assert(textos('Especial da Casa com Batata').every(t => /^Especial/.test(t)), 'tirou o nome do sabor');
    assert(textos('Delicioso Burger de Costela').includes('Burger de Costela'), 'enfeite de abertura deveria sair');
  });

  test('6 · "Com borda" abrindo a frase não vira "+ borda" nem "borda"', () => {
    assert(!textos('Com borda recheada').length, 'mexeu num texto que não é lista');
  });

  test('7 · o que saiu vem declarado (a UI mostra "tirei: …")', () => {
    const c = gCopyFitCandidatos('Super Combo com Refrigerante').pop();
    assert(c.removidas.includes('Super'), 'não declarou o enfeite tirado: ' + JSON.stringify(c.removidas));
  });

  test('8 · a 1ª sugestão é a que MENOS mexeu; as seguintes só se deixam a letra maior', () => {
    const f = 'Super Combo Família com Batata Grande e Refrigerante';
    const cabe = t => ({ ok: t.length <= 60, fontSize: t.length <= 40 ? 60 : 50 });
    const { sugestoes } = gCopyFitSugestoes(f, cabe, 3);
    const todos = gCopyFitCandidatos(f);
    assert(sugestoes.length >= 1, 'deveria haver sugestão');
    assert(sugestoes[0].text === todos.find(c => c.text.length <= 60).text, 'a 1ª não é a mínima');
    sugestoes.slice(1).forEach(s => assert(s.fontSize >= sugestoes[0].fontSize + 2, 'sugestão repetida sem ganho'));
  });

  test('9 · nada cabe → nenhuma (e o balão diz isso, não corta produto)', () => {
    const r = gCopyFitSugestoes('Super Combo com Refrigerante', () => ({ ok:false, fontSize:0 }), 3);
    assert(r.nenhuma && !r.sugestoes.length, 'inventou sugestão que não cabe');
  });

  test('10 · determinístico: mesma entrada, mesma saída', () => {
    FRASES.forEach(f => assert(JSON.stringify(gCopyFitCandidatos(f)) === JSON.stringify(gCopyFitCandidatos(f)), f));
  });

  test('11 · fuzz: 2.000 combos montados — garantias valem em todos', () => {
    const itens = ['Burger', 'Hambúrguer Duplo', 'Pizza Grande', 'Batata Média', 'Refrigerante 2 litros',
      'Açaí 300 ml', 'Pastel de Queijo', 'Coxinha', 'Suco Natural', 'Sorvete Pequeno', 'X-Salada'];
    const abre = ['', 'Super ', 'Combo ', 'Delicioso ', 'Promoção ', 'MEGA '];
    let seed = 7; const rnd = n => { seed = (seed * 9301 + 49297) % 233280; return Math.floor(seed / 233280 * n); };
    for(let i = 0; i < 2000; i++){
      const n = 1 + rnd(3), partes = [];
      for(let k = 0; k < n; k++) partes.push(itens[rnd(itens.length)]);
      let f = abre[rnd(abre.length)] + partes.join(rnd(2) ? ' com ' : ' e ') + (rnd(3) ? '' : ' por apenas R$ ' + (10 + rnd(90)) + ',90');
      if(rnd(4) === 0) f = f.toUpperCase();
      gCopyFitCandidatos(f).forEach(c => {
        assert(gCopyFitGuarda(f, c.text), 'guarda: ' + f + ' → ' + c.text);
        const sumiu = itensIntactos(f, c.text);
        assert(!sumiu.length, 'sumiu ' + sumiu + ': ' + f + ' → ' + c.text);
      });
    }
  });

  test('12 · com o Local Fit de verdade: a sugestão aplicada CABE na caixa', () => {
    const l = { id:'p', type:'text', content:'{{p}}', isVar:true, x:130, y:1220, w:363, h:72, font:'Arial',
      fontSize:95, lineHeight:1.2, textBox:'point', vAlign:'top', textTransform:'uppercase', visible:true, opacity:100,
      layoutRefText:'PRODUTO' };
    const d = { id:'d', type:'text', content:'Com batata', x:126, y:1387, w:188, h:58, font:'Arial', fontSize:48,
      textBox:'point', vAlign:'top', visible:true, opacity:100 };
    const canvas = { w:1080, h:1920 };
    const cabe = t => { const r = gFitTextToAuthoredBox(l, t, { layers:[l, d], canvas }); return { ok:r.status === 'fits', fontSize:r.fontSize }; };
    const f = 'Delicioso Hambúrguer de Costela';
    assert(!cabe(f).ok, 'o cenário precisa começar bloqueado');
    const { sugestoes } = gCopyFitSugestoes(f, cabe, 3);
    assert(sugestoes.length, 'deveria haver uma versão que cabe');
    sugestoes.forEach(s => assert(cabe(s.text).ok, 'sugeriu o que não cabe: ' + s.text));
  });

  /* 13–18: a arte sugerida não pode DIZER OUTRA COISA (diagnóstico de 22/09). */
  const semMexer = (lista, cobra, msg) => lista.forEach(f => textos(f).forEach(t =>
    assert(cobra(f, t), msg + ': "' + f + '" → "' + t + '"')));

  test('13 · "com" só vira "+" antes de ITEM de pedido (não em composição, número, regra da oferta)', () => {
    semMexer(['Café com leite e pão na chapa', 'Combinado de 30 peças com salmão', 'Pizza com 50% de desconto',
      'Leve 2 pague 1 com refri', 'Pizza doce de chocolate com morango', 'Kit semanal com 5 marmitas',
      'Brigadeiro caixa com 12 un', 'Burger com molho especial', 'Açaí com granola, leite condensado, banana e morango',
      'Combo com refri, batata e sobremesa'], (f, t) => !t.includes('+'), 'virou "+" sem ser combo');
    assert(textos('Burger com refri e batata').includes('Burger + refri + batata'), 'combo de itens deveria virar "+"');
    assert(textos('Combo com batata e salada').includes('Combo + batata e salada'), '" e " só vira "+" antes de item');
  });

  test('14 · enfeite DEPOIS do substantivo é nome; "especial" nunca sai', () => {
    semMexer(['Pizza Especial', 'Combo Especial', 'Burger com molho especial', 'Burger Top', 'X-Tudo mega com fritas',
      'Brigadeiro Gourmet', 'Pizza Especial Grande com Refrigerante', 'Especial de Frango com Refri'],
      (f, t) => ['especial', 'top', 'mega', 'gourmet'].every(w => !new RegExp(w, 'i').test(f) || new RegExp(w, 'i').test(t)),
      'tirou o nome do produto');
    assert(textos('Mega Pizza Especial de Calabresa').includes('Pizza Especial de Calabresa'), 'enfeite anteposto sai, o nome fica');
    assert(textos('Leve um delicioso X-Tudo').includes('Leve um X-Tudo'), 'enfeite depois de artigo ainda é anteposto');
  });

  test('15 · super/mega antes de TAMANHO ou em nome composto fica', () => {
    semMexer(['Pizza Super Grande', 'Super Grande Pizza', 'Super Mercado Bom Preço', 'Mega Família com refri'],
      (f, t) => /super|mega/i.test(t), 'tirou o super/mega que diz o tamanho/nome');
  });

  test('16 · "apenas/somente" só sai antes de PREÇO; restrição fica', () => {
    semMexer(['Frete grátis apenas para o centro', 'Válido somente hoje', 'Promoção válida apenas para retirada'],
      (f, t) => /apenas|somente/i.test(t), 'tirou a restrição da oferta');
    assert(textos('Pizza por apenas R$ 30').includes('Pizza R$ 30'), '"por apenas R$" deveria sair');
    assert(textos('Combo somente 9,90').includes('Combo 9,90'), '"somente 9,90" deveria sair');
  });

  test('17 · tirar a 1ª palavra não deixa a frase abrindo em minúscula', () => {
    assert(textos('Famosa coxinha da Dona Maria').includes('Coxinha da Dona Maria'), 'deveria herdar a maiúscula');
    assert(textos('FAMOSA COXINHA DE FRANGO').includes('COXINHA DE FRANGO'), 'caixa alta segue caixa alta');
    assert(textos('famosa coxinha de frango').includes('coxinha de frango'), 'minúscula digitada fica minúscula');
  });

  test('18 · tamanho: todos da frase viram letra, ou nenhum', () => {
    semMexer(['Pizzas médias a R$ 29,90 e grandes a R$ 39,90', 'Batata grande ou média', 'Compre 1 pizza grande e leve outra média'],
      (f, t) => !/\b[GMP]\b/.test(t), 'abreviou só parte dos tamanhos');
    assert(textos('Pizza grande e batata média').includes('Pizza G e batata M'), 'todos com item deveriam abreviar');
  });

  /* 19–22: ciclo 2 (23/09) — ranking por custo perceptível e formas curtas que faltavam. */
  test('19 · ranking: só tirar "Delicioso" é candidato, e vence quando basta', () => {
    const f = 'Delicioso Hambúrguer de Costela com Cebola Caramelizada e Molho Especial';
    const soEnfeite = 'Hambúrguer de Costela com Cebola Caramelizada e Molho Especial';
    assert(textos(f).includes(soEnfeite), 'faltou o candidato só sem o enfeite: ' + textos(f).join(' | '));
    // Cabe o sem-"Delicioso" (62) mas não o só-"Burger" (68): a antiga escada levava junto o
    // "Hambúrguer → Burger" sem precisar.
    const s = gCopyFitSugestoes(f, t => ({ ok: t.length <= soEnfeite.length, fontSize: 50 }), 1).sugestoes;
    assert(s.length && s[0].text === soEnfeite, 'a 1ª deveria ser só sem "Delicioso": ' + (s[0] && s[0].text));
    // Se a troca barata já basta, ela vem antes do enfeite.
    const s2 = gCopyFitSugestoes(f, t => ({ ok: t.length <= 68, fontSize: 50 }), 1).sugestoes;
    assert(s2.length && /^Delicioso Burger/.test(s2[0].text), 'a troca mais barata deveria vir 1ª: ' + (s2[0] && s2[0].text));
  });

  test('20 · ranking: custo nunca desce, sem repetido, enxuto, e o mais curto sempre fica', () => {
    FRASES.concat(['SUPER PROMOÇÃO!!!!! PIZZA GRANDE R$ 39,90!!!!!', 'Mega Combo com X-Bacon, X-Salada, Batata Grande e Refrigerante 2 Litros'])
      .forEach(f => {
        const c = gCopyFitCandidatos(f);
        assert(c.length <= 12, 'lista longa demais (' + c.length + '): ' + f);
        assert(new Set(c.map(x => x.text)).size === c.length, 'candidato repetido: ' + f);
        c.forEach((x, i) => {
          if(!i) return;
          assert(x.custo >= c[i - 1].custo, 'custo desceu: ' + f);
          // mais caro e não mais curto nunca seria a melhor resposta — só gastaria uma medição
          assert(x.text.length < c[i - 1].text.length, 'candidato dominado: "' + x.text + '"');
        });
        if(c.length) assert(c[c.length - 1].degraus.length === Math.max(...c.map(x => x.degraus.length)), 'sumiu o mais agressivo: ' + f);
      });
  });

  test('21 · formas curtas seguras: "por R$", ml, dias, "todo dia", entrega, parêntese', () => {
    const espera = [
      ['Pizza por R$ 39,90', 'Pizza R$ 39,90'], ['Açaí 500 ml', 'Açaí 500ml'],
      ['Todas as quartas-feiras', 'Todas as quartas'], ['Entrega de segunda a domingo', 'Entrega seg a dom'],
      ['Aberto de terça a domingo', 'Aberto ter a dom'], ['Válida de segunda-feira a quinta-feira', 'Válida seg a qui'],
      ['DE SEGUNDA A SÁBADO: PIZZA', 'SEG A SÁB: PIZZA'], ['De segunda a sábado, almoço', 'Seg a sáb, almoço'],
      ['Aberto todos os dias', 'Aberto todo dia'], ['Taxa de entrega grátis hoje', 'Entrega grátis hoje'],
      ['Frete grátis para pedidos acima de R$ 50', 'Frete grátis acima de R$ 50'], ['Refri (lata) R$ 5', 'Refri lata R$ 5']
    ];
    espera.forEach(([f, t]) => assert(textos(f).includes(t), '"' + f + '" deveria ter "' + t + '": ' + textos(f).join(' | ')));
    // "por" que amarra preço à QUANTIDADE fica; "2 por 1" não é preço
    semMexer(['3 por R$ 20', 'Leve 2 por R$ 30', 'Pizza duas por R$ 60', 'De R$ 59,90 por R$ 39,90', '2 por 1 em lanches', 'Tudo por R$ 10'],
      (f, t) => /\bpor\b/i.test(t), 'tirou o "por" da quantidade');
    semMexer(['Todos os dias úteis', 'Pizza (8 fatias)', 'Coca 2 L'], (f, t) => false, 'não devia mexer');
  });

  test('22 · tamanho "tudo ou nada" vale por TRECHO, não pela frase inteira', () => {
    const t = textos('Pizza grande com refri. Batata grande ou média');
    assert(t.includes('Pizza G com refri. Batata grande ou média'), 'o 1º trecho deveria abreviar sozinho: ' + t.join(' | '));
    assert(t.every(x => /Batata grande ou média/.test(x)), 'o 2º trecho (um tamanho sem item) não pode abreviar pela metade');
  });

  let passed = 0;
  for(const item of cases){
    const li = document.createElement('li'); li.className = 'case';
    try{
      await item.fn(); passed++; li.classList.add('pass');
      li.innerHTML = '<strong>✓ ' + item.name + '</strong>';
    }catch(error){
      li.classList.add('fail');
      li.innerHTML = '<strong>✕ ' + item.name + '</strong><small>' + String(error && error.message || error) + '</small>';
      console.error('[copy-fit]', item.name, error);
      falhas.push({ name:item.name, error:String(error && error.message || error) });
    }
    results.appendChild(li);
  }
  const failed = cases.length - passed;
  summary.textContent = passed + '/' + cases.length + ' casos passaram' + (failed ? ' · ' + failed + ' falharam' : '');
  document.title = (failed ? 'FALHOU' : 'OK') + ' — Copy Fit (' + passed + '/' + cases.length + ')';
  window.__lumaTest = { passed:passed, total:cases.length, failures:falhas };
})();
