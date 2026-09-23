/* ══════════════════════════════════════════════════════════════════════════════════════════
   COPY FIT — regressão das GARANTIAS do motor de encurtar (js/franqueado/copy-fit.js).
   `node scripts/run-browser-tests.js copy-fit`.

   O que se cobra é o que torna seguro aplicar a sugestão com um toque:
     · número nenhum muda (preço, quantidade, volume) · nunca fica mais longo;
     · ITEM nenhum some — só limpeza, unidade, forma curta consagrada, lista, tamanho em
       contexto e enfeite de lista fechada;
     · a caixa (MAIÚSCULA) do que foi digitado é preservada · mesma entrada, mesma saída;
     · "cabe" vem de quem mede (aqui um `cabe` falso; na prévia, o Local Fit), e a 1ª
       sugestão é a que MENOS mexeu.
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
  const PODE_SUMIR = /^(por|apenas|somente|com|e|litros?|lts?|mililitros?|gramas?|quilos?|unidades?|refrigerantes?|hamb[uú]rgueres|hamb[uú]rguer|promo[cç](?:[aã]o|[oõ]es)|de|desconto|segunda|sexta|s[aá]bado|a|segunda-feira|ter[cç]a-feira|quarta-feira|quinta-feira|sexta-feira|grandes?|m[eé]di[oa]s?|pequen[oa]s?|tamanho|super|mega|delicios[oa]s?|incr[ií]ve(?:l|is)|especia(?:l|is)|gourmet|maravilhos[oa]s?|exclusiv[oa]s?|imperd[ií]ve(?:l|is)|irresist[ií]ve(?:l|is)|famos[oa]s?|saboros[oa]s?|top)$/iu;
  const palavras = s => String(s).toLowerCase().split(/[^\p{L}\d-]+/u).filter(Boolean);
  const itensIntactos = (orig, cand) => {
    const tem = new Set(palavras(cand));
    return palavras(orig).filter(w => !/^\d/.test(w) && !PODE_SUMIR.test(w) && !tem.has(w));
  };

  const FRASES = [
    'Super Combo Família com 2 Burgers Artesanais + Batata Grande e Refrigerante',
    'SUPER COMBO FAMÍLIA COM 2 HAMBÚRGUERES + BATATA GRANDE E REFRIGERANTE 2 LITROS',
    'Pizza de Calabresa com Borda de Catupiry por apenas R$ 49,90',
    'Promoção de segunda a sexta: 50% de desconto no almoço',
    'Açaí 500 mililitros com granola e leite condensado',
    'Delicioso X-Tudo Especial com bacon', 'Especial da Casa com Batata Frita',
    'Leve 3 pague 2 em pizzas médias', 'Refrigerante 2 litros grátis na compra acima de R$ 60',
    'Combo Tradicional com Pastel de Carne e Caldo de Cana 300 ml'
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
