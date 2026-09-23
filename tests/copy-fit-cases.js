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

  /* "ITEM NÃO SOME", provado palavra a palavra (ciclo 3). Cada palavra de conteúdo do original
     tem que estar no candidato DEPOIS DE NORMALIZAR as abreviações que o motor pode fazer
     (refrigerante ≡ refri, litros ≡ L, grande ≡ G, segunda-feira ≡ seg…). Antes a lista
     deixava "refrigerante" SUMIR sem cobrar que o "refri" aparecesse — um corte passava.
     Só as palavras de ligação abaixo podem sumir de qualquer lugar; "com/e/apenas/enfeite"
     só na posição certa (saiAqui). */
  const PODE_SUMIR = /^(por|de|a|à|os|tamanho|taxa|para|pedidos)$/iu;
  const CANON = [
    [/^refrigerantes?$/, 'refri'], [/^refris$/, 'refri'], [/^hamb[uú]rgu?er(e?s)?$/, 'burger'], [/^burgers$/, 'burger'],
    [/^promo[cç](ão|ao|ões|oes)$/, 'promo'], [/^promos$/, 'promo'],
    [/^(litros?|lts?|l)$/, 'l'], [/^mililitros?$/, 'ml'], [/^gramas?$/, 'g'], [/^quilos?$/, 'kg'], [/^unidades?$/, 'un'],
    [/^grandes?$/, 'g'], [/^m[eé]di[oa]s?$/, 'm'], [/^pequen[oa]s?$/, 'p'],
    [/^(seg|segundas?)(-feiras?)?$/, 'seg'], [/^(ter|ter[cç]as?)(-feiras?)?$/, 'ter'], [/^(qua|quartas?)(-feiras?)?$/, 'qua'],
    [/^(qui|quintas?)(-feiras?)?$/, 'qui'], [/^(sex|sextas?)(-feiras?)?$/, 'sex'], [/^(s[aá]b|s[aá]bados?)$/, 'sab'], [/^(dom|domingos?)$/, 'dom'],
    [/^todos$/, 'todo'], [/^dias$/, 'dia'], [/^desconto$/, 'off'], [/^reais$/, 'r']
  ];
  const canon = w => { for(const [re, c] of CANON) if(re.test(w)) return c; return w; };
  /* "2L" / "500ml" / "2x": o número some da conta (a guarda cuida dele), a unidade fica. */
  const semNum = w => w.replace(/^[\d.,/]+(?=\p{L})/u, '');
  /* Estar na lista não basta: "com", "apenas" e o enfeite só podem sair NA POSIÇÃO certa. Sem
     isso a suíte aprovava "Café + leite", "Frete grátis para o centro" e "Pizza" (de "Pizza
     Especial"). Estas regras são a especificação, escritas à parte do motor. */
  const ITEM = /^(refris?|refrigerantes?|batatas?|fritas|sucos?|burgers?|hamb[uú]rgueres|hamb[uú]rgu?ers?|pizzas?|por[cç](?:[aã]o|[oõ]es)|sobremesas?|bebidas?|guaran[aá]s?|coca-cola|cocas?|milk-?shakes?|a[cç]a[ií]s?|sorvetes?|past[eé]is|pastel|esfihas?|coxinhas?|x-\p{L}+)$/iu;
  const ENFEITE = /^(super|mega|delicios[oa]s?|incr[ií]ve(?:l|is)|gourmet|maravilhos[oa]s?|exclusiv[oa]s?|imperd[ií]ve(?:l|is)|irresist[ií]ve(?:l|is)|famos[oa]s?|saboros[oa]s?)$/iu;
  const LIGA = /^(o|a|os|as|um|uma|uns|umas|de|do|da|dos|das|no|na|nos|nas|e|em|com|para|pra|seu|sua|seus|suas|\+)$/iu;
  const nu = w => String(w || '').toLowerCase().replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, '');
  // A quebra de linha é palavra própria: o enfeite que ABRE uma linha está anteposto.
  const brutas = s => String(s).replace(/\n/g, ' \n ').split(/[^\S\n]+/).filter(Boolean);
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
    const chave = raw => { const w = nu(raw); return /^[\d.,/]*$/.test(w) ? '' : canon(semNum(w)); };
    brutas(cand).forEach(raw => { const w = chave(raw); if(w) resta[w] = (resta[w] || 0) + 1; });
    const sumiu = [], podia = {};
    b.forEach((raw, i) => {
      const w = chave(raw);
      if(!w) return;                                  // número puro: é da guarda
      const ctx = saiAqui(b, i);
      if(ctx !== null){ podia[w] = (podia[w] || 0) + (ctx ? 1 : 0); podia['#' + w] = (podia['#' + w] || 0) + 1; return; }
      if(PODE_SUMIR.test(nu(raw))) return;
      if(resta[w]) resta[w]--; else sumiu.push(nu(raw));
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

  /* Fuzz determinístico (seed fixa). Ciclo 3: além de item/adjetivo/preço, entram dia, unidade,
     desconto, nome que parece gatilho, placeholder, tag, emoji, quebra de linha e as 3 caixas —
     e cada candidato é encurtado DE NOVO (idempotência: o 2º passe também não corta item nem
     mexe em número, e nunca devolve o próprio texto). */
  const FUZZ = (() => {
    const itens = ['Burger', 'Hambúrguer Duplo', 'Pizza Grande', 'Batata Média', 'Refrigerante 2 litros', 'Açaí 300 ml',
      'Pastel de Queijo', 'Coxinha', 'Suco Natural', 'Sorvete Pequeno', 'X-Salada', 'X-Tudo Especial', 'Burger Artesanal',
      'Pizza de Calabresa Tradicional', 'Refri Zero', 'Pastel da Feira', 'Pizza Grande São Paulo', 'Café com leite',
      'Esfiha Média', 'Porção de fritas grande', 'Hot Roll 10 unidades', '{{produto}}', '<b>Combo</b>', 'Burger Top',
      'Pizza Super Grande', 'Coca-Cola 2 lts', 'Refrigerantes (lata)', 'Promoção de Hambúrguer',
      'Hamburger de Picanha', 'Refri de 2 litros', 'Açaí de 700 ml', 'Marmita grande', 'Yakisoba tamanho médio'];
    const abre = ['', 'Super ', 'Combo ', 'Delicioso ', 'Promoção ', 'MEGA ', 'Top ', 'Famosa ', 'Especial ', 'Artesanal ', '🔥 ', 'Oferta! Deliciosa ', 'Leve um incrível '];
    const liga = [' com ', ' e ', ' + ', ', ', '\n'];
    const fim = ['', ' de segunda a sexta', ' todos os dias', ' com 50% de desconto', '. Taxa de entrega grátis', ' 500 gramas',
      ' para pedidos acima de R$ 50', ' válido somente hoje', ' 👨‍👩‍👧', ' de terça-feira a domingo',
      ' acima de 40 reais', ' e ganhe 20 reais de desconto', ' a partir de 500g'];
    let seed = 7; const rnd = n => { seed = (seed * 9301 + 49297) % 233280; return Math.floor(seed / 233280 * n); };
    const out = [];
    for(let i = 0; i < 2000; i++){
      const n = 1 + rnd(3), partes = [];
      for(let k = 0; k < n; k++) partes.push(itens[rnd(itens.length)]);
      const preco = [' por apenas R$ ', ' por R$ ', ' R$', ' somente ', ' 3 por R$ '][rnd(5)] + (10 + rnd(90)) + ',90';
      let f = abre[rnd(abre.length)] + partes.join(liga[rnd(liga.length)]) + (rnd(3) ? '' : preco) + fim[rnd(fim.length)];
      const caixa = rnd(6);
      if(caixa === 0) f = f.toUpperCase(); else if(caixa === 1) f = f.toLowerCase();
      out.push(f);
    }
    return out;
  })();
  const blindados = s => (String(s).match(/\{\{[\s\S]*?\}\}|<[^<>]*>|&[#\w]+;/g) || []).join('|');

  test('11 · fuzz: 2.000 combos — guarda, item não some, placeholder/tag intactos, 2º passe', () => {
    FUZZ.forEach(f => gCopyFitCandidatos(f).forEach(c => {
      assert(gCopyFitGuarda(f, c.text), 'guarda: ' + f + ' → ' + c.text);
      assert(blindados(f) === blindados(c.text), 'mexeu em {{}}/tag: ' + f + ' → ' + c.text);
      const sumiu = itensIntactos(f, c.text);
      assert(!sumiu.length, 'sumiu ' + sumiu + ': ' + f + ' → ' + c.text);
      assert((f.match(/\n/g) || []).length === (c.text.match(/\n/g) || []).length, 'quebra de linha sumiu: ' + JSON.stringify(c.text));
      // Caixa: MAIÚSCULA segue maiúscula; minúscula só ganha as letras-padrão (G/M/P, OFF, L, o R de "R$").
      if(f === f.toUpperCase()) assert(c.text === c.text.toUpperCase(), 'caixa alta quebrou: ' + f + ' → ' + c.text);
      if(f === f.toLowerCase()){
        const t = c.text.replace(/(^|[^\p{L}])(G|M|P|OFF|L|R)(?=$|[^\p{L}])/gu, '$1');
        assert(t === t.toLowerCase(), 'minúscula ganhou maiúscula: ' + f + ' → ' + c.text);
      }
    }));
    // 2º passe só no 1º candidato (o que a UI oferece primeiro): o fuzz fica < 1s.
    FUZZ.forEach(f => {
      const c1 = gCopyFitCandidatos(f)[0]; if(!c1) return;
      gCopyFitCandidatos(c1.text).forEach(c2 => {
        assert(c2.text !== c1.text && gCopyFitGuarda(c1.text, c2.text), '2º passe: ' + c1.text + ' → ' + c2.text);
        const sumiu = itensIntactos(f, c2.text);
        assert(!sumiu.length, '2º passe sumiu ' + sumiu + ': ' + f + ' → ' + c1.text + ' → ' + c2.text);
      });
    });
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

  /* 23–27: ciclo 3 (23/09) — red team. Cada caso aqui QUEBRAVA antes (ou é a trava do que
     foi confirmado ok): entrada → o que saía está no comentário. */
  test('23 · {{campo}}, tag e entidade passam intactos (e a guarda cobra)', () => {
    // antes: "{{produto}}" → "{{Produto}}", "{{refrigerante}}" → "{{refri}}", "{{promoção}}" → "{{promo}}"
    assert(textos('{{produto}} com refrigerante').includes('{{produto}} + refri'), 'placeholder deveria ficar e o resto encurtar');
    semMexer(['Delicioso {{produto}} por apenas {{preco}}', '{{refrigerante}} com batata', '{{promoção}} todos os dias',
      '{{ Hambúrguer }} com refri', '<span class="promocao">Refrigerante</span> todos os dias', 'Pizza&nbsp;grande com refrigerante',
      '<b>Super</b> Combo com refrigerante'], (f, t) => blindados(f) === blindados(t), 'mexeu dentro do {{}}/tag/entidade');
    assert(textos('{{promoção}} todos os dias').includes('{{promoção}} todo dia'), 'fora do placeholder ainda encurta');
    assert(textos('<span class="promocao">Refrigerante</span> todos os dias').includes('<span class="promocao">Refri</span> todo dia'), 'texto entre tags encurta');
    assert(!gCopyFitGuarda('{{promoção}} hoje', '{{promo}} hoje'), 'a guarda deveria recusar placeholder alterado');
    // texto que já usa a área privada (fonte de ícone): não sugere nada, e não quebra
    assert(!textos(String.fromCharCode(0xE000) + ' promoção todos os dias').length, 'área privada não é blindável');
  });

  test('24 · quebra de linha e NBSP ficam; enfeite que abre frase passa a maiúscula', () => {
    // antes: "Pizza\nGrande\ncom refrigerante" → "Pizza Grande com refri" (a quebra do franqueado sumia)
    semMexer(['Pizza\nGrande\ncom refrigerante', 'Super Combo\ncom refrigerante\nde segunda a sexta'],
      (f, t) => f.split('\n').length === t.split('\n').length, 'quebra de linha sumiu');
    assert(textos('Pizza grande\nDeliciosa coxinha com refri').includes('Pizza G\nCoxinha + refri'), 'linha abre com maiúscula');
    // antes: "Oferta! Deliciosa coxinha" → "Oferta! coxinha"
    assert(textos('Oferta! Deliciosa coxinha').includes('Oferta! Coxinha'), 'frase nova herda a maiúscula');
    const nb = String.fromCharCode(160), f = 'Pizza' + nb + 'Grande com refrigerante';
    assert(textos(f).length && textos(f).every(t => t.includes(nb)), 'o NBSP virou espaço comum: ' + JSON.stringify(textos(f)));
  });

  test('25 · nome que parece gatilho fica como está', () => {
    // antes: "Pizza Grande São Paulo" → "Pizza G São Paulo"; "Top Lanches" → "Lanches"
    semMexer(['Pizza Grande São Paulo', 'Super Mercado', 'Mega Store', 'Top Lanches', 'Casa do Especial', 'Pastel da Feira',
      'Burger King', 'Top 10 pizzas', 'Grande Família', 'Refri Zero', 'Médio Oriente', 'Por do Sol', 'Com Amor Doces',
      'Famosa da Vila', 'Esfiha Média Oriente', 'Pizza Grande Família', 'Top Burger',
      'Casa do Pastel Grande', 'Pastel Grande da Feira', 'CASA DA PIZZA GRANDE'], () => false, 'mexeu num nome');
    semMexer(['Top Lanches com refrigerante', 'Pizza Grande São Paulo com refri', 'Mega Store: combo com refrigerante',
      'Refri Zero com batata', 'Com Amor Doces com brigadeiro'],
      (f, t) => t.startsWith(f.split(/ com | com$|:/)[0]), 'o nome da loja/produto mudou');
  });

  test('26 · preço colado, quantidade e formatos de número', () => {
    // antes: "Pizza R$39,90 por R$29,90" → "Pizza R$39,90 R$29,90" (de/por virava dois preços soltos)
    semMexer(['Pizza R$39,90 por R$29,90', 'Pizza x2 por R$ 30', 'De R$59,90 por R$39,90'], (f, t) => / por /.test(t), 'tirou o "por" do de/por');
    const espera = [['2º burger com 50% de desconto', '2º burger com 50% OFF'], ['Ligue (11) 99999-9999 promoção', 'Ligue (11) 99999-9999 promo'],
      ['Cupom DELIVERY10 promoção', 'Cupom DELIVERY10 promo'], ['Das 18h às 23h de segunda a sexta', 'Das 18h às 23h seg a sex'],
      ['De Segunda A Sexta', 'Seg A Sex'], ['Açaí 1/2 litro', 'Açaí 1/2L'], ['Pizza por R$39,90', 'Pizza R$39,90']];
    espera.forEach(([f, t]) => assert(textos(f).includes(t), '"' + f + '" deveria ter "' + t + '": ' + textos(f).join(' | ')));
    ['Pizza 1.299,00', 'Combo #2 com refri', 'CEP 01234-567', '3/4 de pizza', '24h', 'Pizza 39.90 com refri']
      .forEach(f => gCopyFitCandidatos(f).forEach(c => assert(gCopyFitGuarda(f, c.text), 'número mudou: ' + f + ' → ' + c.text)));
  });

  test('27 · desempenho: 300 letras < 2ms (mediana), 2.000 letras não explode', () => {
    const base = 'Super Combo Família com 2 Hambúrgueres + Batata Grande e Refrigerante 2 litros por apenas R$ 49,90 de segunda a sexta. ' +
      'Delicioso X-Tudo com refrigerante e batata média! Taxa de entrega grátis todos os dias. ';
    const s300 = (base + base).slice(0, 300), ts = [];
    for(let i = 0; i < 5; i++) gCopyFitCandidatos(s300 + i);       // aquece o JIT
    for(let i = 0; i < 21; i++){ const t0 = performance.now(); gCopyFitCandidatos(s300.slice(0, 296) + i); ts.push(performance.now() - t0); }
    ts.sort((a, b) => a - b);
    assert(ts[10] < 2, '300 letras levou ' + ts[10].toFixed(2) + 'ms (mediana)');
    const t0 = performance.now(), c = gCopyFitCandidatos(base.repeat(12).slice(0, 2000)), dt = performance.now() - t0;
    assert(dt < 50 && c.length <= 12, '2.000 letras: ' + dt.toFixed(1) + 'ms, ' + c.length + ' candidatos');
  });

  /* 28–31: ciclo 4 (23/09) — ALCANCE em pixel. A bancada (14 caixas reais × 177 copies, Local
     Fit real) resgatava 163 de 784 bloqueios (20,8%); com as regras abaixo, 176 (22,4%), sem
     perder nenhum dos 163. Cada regra vem de copy do corpus que ficava a uma palavra de caber. */
  test('28 · regras do ciclo 4: vírgula decimal, Hamburger, "de" da medida, reais, tamanho, limpeza', () => {
    const espera = [
      // antes: a vírgula do "39,90" contava como lista e travava o "+" do trecho inteiro
      ['X-Tudo com batata e refrigerante 2 litros por apenas R$ 39,90', 'X-Tudo + batata + refri 2L R$ 39,90'],
      ['X-Salada com Refrigerante Lata por apenas R$ 19,90', 'X-Salada + Refri Lata R$ 19,90'],
      ['Hamburger de picanha 200g', 'Burger de picanha 200g'], ['HAMBURGERS', 'BURGERS'],
      ['Refrigerante de 2 litros', 'Refrigerante 2L'], ['Burger com 2 refrigerantes de 600 ml', 'Burger com 2 refris 600ml'],
      ['Na compra de 2 açaís de 500ml ganhe 1 de 300ml', 'Na compra de 2 açaís 500ml ganhe 1 de 300ml'],
      ['Ganhe R$ 20 de desconto', 'Ganhe R$ 20 OFF'],
      ['Pizza de Frango e Milho tamanho grande', 'Pizza de Frango e Milho tamanho G'],
      ['Marmita grande com salada', 'Marmita G com salada'], ['Marmitex tamanho médio', 'Marmitex M'],
      ['Só hoje: entrega grátis!!!', 'Só hoje: entrega grátis!']
    ];
    espera.forEach(([f, t]) => assert(textos(f).includes(t), '"' + f + '" deveria ter "' + t + '": ' + textos(f).join(' | ')));
    // vírgula de LISTA continua travando; o "de" sem item antes fica; tamanho segue todos-ou-nenhum
    semMexer(['Combo com refri, batata e sobremesa R$ 29,90', 'Açaí com granola, banana e morango R$ 19,90'],
      (f, t) => !t.includes('+'), 'virou "+" numa lista com vírgula');
    // "reais" → "R$" é decisão de negócio pendente: o motor não troca
    semMexer(['Pedidos acima de 40 reais', 'Ganhe 20 reais de desconto'], (f, t) => /reais/.test(t), 'trocou "reais" por R$');
    semMexer(['Porções a partir de 500g', 'Frete grátis acima de 2L', 'Ganhe 1 de 300ml', 'Copo de 500ml'],
      (f, t) => / de /.test(t), 'tirou o "de" que não liga item à medida');
    semMexer(['Marmita pequena R$ 14, média R$ 17 e grande R$ 20'], (f, t) => !/\b[GMP]\b/.test(t), 'abreviou só parte dos tamanhos');
    // só a limpeza já é candidato, e o mais barato
    const c = gCopyFitCandidatos('Só hoje: entrega grátis!!!')[0];
    assert(c && c.custo === 0 && c.degraus.join() === 'limpeza', 'a limpeza sozinha deveria ser o 1º candidato');
  });

  test('29 · nenhuma coube → `maisPerto` é o mais curto, com o que o `cabe` informou', () => {
    const f = 'Super Combo com Refrigerante';
    const r = gCopyFitSugestoes(f, t => ({ ok:false, fontSize:40, falta: t.length - 10 }), 3);
    const curto = gCopyFitCandidatos(f).pop();
    assert(r.nenhuma && !r.sugestoes.length, 'inventou sugestão');
    assert(r.maisPerto && r.maisPerto.text === curto.text, 'maisPerto não é o mais curto: ' + JSON.stringify(r.maisPerto));
    assert(r.maisPerto.falta === curto.text.length - 10 && r.maisPerto.fontSize === 40 && !('ok' in r.maisPerto), 'não repassou o que o cabe disse');
    assert(r.maisPerto.removidas.includes('Super'), 'maisPerto sem o que mudou');
    assert(gCopyFitSugestoes('Pizza', () => ({ ok:false })).maisPerto === null, 'sem candidato, maisPerto é null');
    assert(!('maisPerto' in gCopyFitSugestoes(f, () => ({ ok:true, fontSize:50 }))), 'coube: não há maisPerto');
  });

  test('30 · pixel, Story: o "+" com preço (vírgula decimal) é o que faz caber', () => {
    const l = { id:'p', type:'text', content:'{{p}}', isVar:true, x:130, y:1220, w:363, h:72, font:'Arial',
      fontSize:95, lineHeight:1.2, textBox:'point', vAlign:'top', textTransform:'uppercase', visible:true, opacity:100,
      layoutRefText:'PRODUTO' };
    const d = { id:'d', type:'text', content:'Com batata', x:126, y:1387, w:188, h:58, font:'Arial', fontSize:48,
      textBox:'point', vAlign:'top', visible:true, opacity:100 };
    const cabe = t => { const r = gFitTextToAuthoredBox(l, t, { layers:[l, d], canvas:{ w:1080, h:1920 } }); return { ok:r.status === 'fits', fontSize:r.fontSize }; };
    const f = 'X-Salada com Refrigerante Lata por apenas R$ 19,90';
    assert(!cabe(f).ok, 'o cenário precisa começar bloqueado');
    const { sugestoes } = gCopyFitSugestoes(f, cabe, 3);
    assert(sugestoes.length, 'deveria haver uma versão que cabe');
    sugestoes.forEach(s => assert(cabe(s.text).ok, 'sugeriu o que não cabe: ' + s.text));
    // sem o "+" nenhum candidato cabe — é a regra nova que resgata
    assert(gCopyFitCandidatos(f).filter(c => !c.text.includes('+')).every(c => !cabe(c.text).ok), 'caberia sem a lista: o caso não prova a regra');
  });

  test('31 · pixel, arte do corpus (promo-preco-circulo): "refri de 2L" → "refri 2L" faz caber', () => {
    const fx = (window.LUMA_CORPUS || []).find(x => x.nome === 'promo-preco-circulo');
    assert(fx, 'fixture do corpus não carregou');
    const dvAntes = window.dVars;
    try{
      const dados = {}; fx.campos.forEach(c => { dados[c.name] = c.example; });
      window.dVars = fx.campos.map(c => Object.assign({ type:'text' }, c));
      const base = gApplyRelativeAnchors(JSON.parse(JSON.stringify(fx.layers)), dados, {}, { canvas:fx.canvas, scope:'franqueado' });
      const medir = gLocalFitMedidor(base, { fieldId:'produto' }, 'produto', dados, { canvas:fx.canvas, defaults:{} });
      const cabe = t => { const r = medir(t); return { ok: !!r && r.status === 'fits', fontSize: r ? r.fontSize : 0 }; };
      const f = 'Na compra de 2 pizzas grandes ganhe 1 refrigerante de 2 litros grátis';
      assert(!cabe(f).ok, 'o cenário precisa começar bloqueado');
      const { sugestoes } = gCopyFitSugestoes(f, cabe, 3);
      assert(sugestoes.length, 'deveria haver uma versão que cabe');
      sugestoes.forEach(s => assert(cabe(s.text).ok, 'sugeriu o que não cabe: ' + s.text));
      assert(/refri 2L/.test(sugestoes[0].text), 'a 1ª deveria usar "refri 2L": ' + sugestoes[0].text);
    } finally { window.dVars = dvAntes; }
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
