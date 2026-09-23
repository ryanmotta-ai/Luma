/* ══════════════════════════════════════════════════════════════════════════════════════════
   COPY FIT — encurtar a copy do franqueado SEM mudar o que se vende (22/09/2026)
   ------------------------------------------------------------------------------------------
   Quando o Local Fit bloqueia, o franqueado precisa de uma SAÍDA, não de um aviso. Este motor
   gera versões mais curtas do texto dele, testa cada uma NA ARTE (quem responde "cabe" é o
   `cabe(texto)` do chamador — o Local Fit, em pixel; nunca contagem de letras) e devolve até
   três que cabem. Determinístico: mesmo texto, mesma resposta, <1ms, sem rede e sem IA.

   ⛔ AS GARANTIAS (e a suíte `tests/copy-fit.html` cobra cada uma):
     · todo NÚMERO continua, na mesma ordem (2, 350, 2L, 49,90) — preço/quantidade é o que
       não pode mudar numa peça de oferta;
     · nenhum ITEM some. O motor só pode: limpar, abreviar unidade, trocar por forma curta
       CONSAGRADA no delivery, compactar lista ("com"/"e" → "+" só antes de ITEM de pedido),
       abreviar tamanho EM CONTEXTO (depois de pizza/batata/refri…, e todos ou nenhum) e tirar
       ENFEITE de uma lista fechada, só ANTEPOSTO ("Delicioso X-Tudo"; "Burger Top" é nome). Se isso não
       basta, a resposta honesta é "não coube" — nunca cortar produto;
     · nunca fica mais longo, e preserva a CAIXA do que foi digitado (MAIÚSCULA segue maiúscula).

   Os candidatos são COMBINAÇÕES dos degraus (não só a escada cumulativa), ordenadas por CUSTO
   PERCEPTÍVEL (`_G_CF_PESO`): a 1ª sugestão que cabe é a que menos mexeu. Cada candidato leva
   a lista do que mudou (`trocas`, `removidas`) — a UI mostra o que saiu, a pessoa confere antes
   de aceitar.

   ALCANCE (ciclo 4, bancada em pixel: 14 caixas reais × 177 copies do corpus, Local Fit real):
   de 784 bloqueios, o motor resgatava 163 (20,8%); com as regras do ciclo 4, 176 (22,4%). Dos que
   sobram, ~90% passam de 15% de falta — ali só cortar produto resolveria, e isso ele não faz.

   API: gCopyFitCandidatos(texto) · gCopyFitSugestoes(texto, cabe, max) · gCopyFitGuarda(a, b)
   ══════════════════════════════════════════════════════════════════════════════════════════ */

/* Fronteira de palavra que entende acento (o `\b` do JS não entende: "promoção" quebraria). */
const _G_CF_L = '[^\\p{L}\\d]';
/* Regex compilada UMA vez: os degraus rodam até 63× por texto (32 combinações) e recompilar
   ~25 padrões com \p{L} a cada chamada era metade do custo (ciclo 3: 300 letras passavam de
   2ms). Seguro com a flag g porque só se usa em replace/match, que zeram o lastIndex. */
const _G_CF_RX = {};
function _gCfRx(src, fl){ const k = fl + '/' + src; return _G_CF_RX[k] || (_G_CF_RX[k] = new RegExp(src, fl)); }
function _gCfRe(padrao){ return _gCfRx('(^|' + _G_CF_L + ')(' + padrao + ')(?=$|' + _G_CF_L + ')', 'giu'); }

/* A troca herda a CAIXA de quem foi trocado: "REFRIGERANTE" → "REFRI", "Refrigerante" →
   "Refri". A arte do franqueado em caixa alta não pode ganhar um "Refri" no meio. */
function _gCfCaixa(orig, novo){
  if(!novo) return novo;
  const letras = orig.replace(/[^\p{L}]/gu, '');
  if(letras.length > 1 && letras === letras.toUpperCase()) return novo.toUpperCase();
  if(/^\p{Lu}/u.test(orig)) return novo.charAt(0).toUpperCase() + novo.slice(1);
  return novo;
}

/* Formas curtas CONSAGRADAS no delivery — a lista é fechada de propósito. Cada entrada entra
   só se é o que o próprio cliente escreveria no pedido. */
const G_CF_CURTAS = [
  ['refrigerantes', 'refris'], ['refrigerante', 'refri'],
  // "Hamburger" (grafia inglesa, corpus do ciclo 4: "Hamburger de picanha 200g…") é a MESMA
  // palavra — ficava de fora e o texto voltava sem nenhuma versão.
  ['hamb[uú]rgueres', 'burgers'], ['hamb[uú]rgu?ers', 'burgers'], ['hamb[uú]rgu?er', 'burger'],
  ['promo[cç][oõ]es', 'promos'], ['promo[cç][aã]o', 'promo'],
  // "dias úteis" fica: "todo dia úteis" seria erro de português.
  ['todos os dias(?!\\s+[úu]teis)', 'todo dia'], ['para pedidos acima de', 'acima de']
];
/* Dia da semana fica fora da lista: são 7×7 intervalos ("de segunda a domingo", "de terça-feira
   a quinta-feira") mais o plural ("quartas-feiras") — lista fechada ali teria buraco. */
const _G_CF_DIA = 'segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo';
const _G_CF_DIA3 = { seg:'seg', ter:'ter', qua:'qua', qui:'qui', sex:'sex', sab:'sáb', 'sáb':'sáb', dom:'dom' };
/* Enfeite: adjetivo que não diz O QUE é o produto. "Tradicional", "artesanal", "caseiro" NÃO
   entram — são sabor/descrição e mudariam o que se vende. "Especial" também não: "Pizza
   Especial", "molho especial", "Especial da Casa" — é quase sempre o NOME do sabor. */
/* "Top" saiu da lista (ciclo 3): em PT ele não é adjetivo anteposto — "Top Lanches", "Top
   Pizza", "Top Burger" são NOME de loja; e depois do substantivo já era nome ("Burger Top"). */
const G_CF_ENFEITES = ['super', 'mega', 'delicios[oa]s?', 'incr[ií]ve(?:l|is)',
  'gourmet', 'maravilhos[oa]s?', 'exclusiv[oa]s?', 'imperd[ií]ve(?:l|is)', 'irresist[ií]ve(?:l|is)',
  'famos[oa]s?', 'saboros[oa]s?'];
/* Tamanho só vira letra DEPOIS de algo que tem tamanho — "Grande São Paulo" fica como está.
   E nem depois do item, se o que vem a seguir faz do tamanho um NOME: "Pizza Grande São Paulo"
   (pizzaria), "Esfiha Média Oriente", "Pizza Grande Família". Lista fechada de inícios de nome. */
const _G_CF_TAM_NOME = '\\s+(?:s[aã]o|sant[oa]s?|rio|porto|belo|campos?|vila|fam[ií]lia|oriente)(?=$|' + _G_CF_L + ')';
const G_CF_TEM_TAMANHO = 'pizzas?|batatas?\\s+fritas?|batatas?|fritas|refris?|refrigerantes?|a[cç]a[ií]s?|copos?|por[cç](?:[aã]o|[oõ]es)|milk-?shakes?|sucos?|combos?|lanches?|past[eé]is|pastel|esfihas?|sorvetes?|marmitas?|marmitex|yakisobas?';
const G_CF_TAMANHOS = [['grandes?', 'G'], ['m[eé]di[oa]s?', 'M'], ['pequen[oa]s?', 'P']];
/* Item de PEDIDO — só antes dele o "com" vira "+". "Café com leite", "Combinado com salmão",
   "Pizza doce com morango": ali o "com" é composição, e o "+" venderia duas coisas. */
const G_CF_ITENS = 'refris?|refrigerantes?|batatas?|fritas|sucos?|burgers?|hamb[uú]rgueres|hamb[uú]rgu?ers?|pizzas?|por[cç](?:[aã]o|[oõ]es)|sobremesas?|bebidas?|guaran[aá]s?|coca-cola|cocas?|milk-?shakes?|a[cç]a[ií]s?|sorvetes?|past[eé]is|pastel|esfihas?|coxinhas?|x-\\p{L}+';
/* Palavra de ligação: o enfeite depois dela ainda está ANTEPOSTO ("Leve um delicioso X-Tudo"). */
const _G_CF_LIGA = /^(?:o|a|os|as|um|uma|uns|umas|de|do|da|dos|das|no|na|nos|nas|e|em|com|para|pra|seu|sua|seus|suas|\+)$/iu;
const _gCfNu = w => String(w || '').replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, '');

/* Tirar a 1ª palavra não pode deixar a frase abrindo em minúscula: "Famosa coxinha" →
   "Coxinha". Só quando o original abria em maiúscula (caixa alta toda já vem do texto). */
function _gCfAbre(orig, novo){
  // Para no trecho blindado (\uE000…): "{{produto}} por…" não vira "{{Produto}}" nem "Por".
  if(/^[^\p{L}\uE000-\uF8FF]*\p{Lu}/u.test(orig) && /^[^\p{L}\uE000-\uF8FF]*\p{Ll}/u.test(novo)) return novo.replace(/\p{Ll}/u, c => c.toUpperCase());
  return novo;
}

/* Limpeza de espaço. A QUEBRA DE LINHA fica (ciclo 3): "Pizza\nGrande" é o franqueado
   escolhendo onde a arte quebra — virar "Pizza Grande" mudava o layout sem ninguém pedir.
   O NBSP (\u00A0) também fica: "R$\u00A039,90" é justamente para não separar. */
function _gCfLimpa(s){
  s = String(s || '');
  // Atalho: se nenhuma das trocas abaixo acharia o que trocar, o texto já está limpo. Uma
  // passada em vez de oito — roda depois de todo degrau, e quase sempre não há nada (ciclo 3).
  if(!/[^\S\n\u00A0 ]| {2}| \n|\n | [,.!?;:]|([!?.])\1|\+ *\+|^\s*\+|\+\s*$|^\s|\s$/.test(s)) return s;
  return s.replace(/[^\S\n\u00A0]+/g, ' ').replace(/ *\n */g, '\n').replace(/ +([,.!?;:])/g, '$1')
    .replace(/([!?.])\1+/g, '$1').replace(/(\+ *){2,}/g, '+ ').replace(/^\s*\+ *| *\+\s*$/g, '')
    .replace(/ {2,}/g, ' ').trim();
}

/* BLINDAGEM: placeholder {{x}}, tag HTML e entidade (&amp;) não são prosa. Antes deles o motor
   fazia "{{produto}}" → "{{Produto}}" e "{{refrigerante}}" → "{{refri}}" — campo que não
   interpola mais. Cada trecho vira um marcador da área de uso privado (\uE000 + \uE100+i):
   não é letra nem dígito, então nenhuma regra casa dentro dele, e volta intacto no fim. */
const _G_CF_BLINDA = /\{\{[\s\S]*?\}\}|<[^<>]*>|&(?:#\d+|#x[\da-f]+|[a-z]+\d*);/giu;
const _gCfBlindados = s => (String(s || '').match(_G_CF_BLINDA) || []).join('\u0001');

/* Os degraus. Cada um recebe {text, trocas, removidas} e devolve o mesmo formato. */
const _G_CF_DEGRAUS = [
  { id:'limpeza', fn:(s, r) => {
    // Só ANTES DE PREÇO ("por apenas R$", "somente 9,90"). "Frete grátis apenas para o centro",
    // "Válido somente hoje": ali é RESTRIÇÃO — tirar muda a oferta.
    const re = _gCfRx('(^|' + _G_CF_L + ')(por apenas|por somente|apenas|somente)(?=\\s+(?:R\\$|\\d+,\\d{2}))', 'giu');
    let t = s.replace(re, (m, pre, w) => { r.removidas.push(w); return pre; });
    // "por R$ 39,90" → "R$ 39,90": o preço sozinho já diz. Mas "3 por R$ 20", "duas por R$ 60",
    // "De R$ 59,90 por R$ 39,90": ali o "por" amarra o preço à QUANTIDADE (ou ao de/por) —
    // sem ele "3 R$ 20" não se lê. Por isso só sai quando a palavra antes não é número — nem
    // quantificador: "Tudo por R$ 10" é o nome da promoção, "cada" amarra o preço à unidade.
    // Número COM unidade ("500ml por R$ 12", "1kg por R$ 39") é volume, não quantidade: sai.
    // Palavra antes terminando em DÍGITO também amarra: "R$39,90 por R$29,90" (de/por colado ao
    // R$) virava "R$39,90 R$29,90" — dois preços soltos. "x2 por R$ 30" é quantidade.
    const qtd = /^(?:\d+(?:[.,]\d+)?x?|.*\d|x\d+|tudo|tod[oa]s|qualquer|cada|um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|doze|d[uú]zias?|meia)$/iu;
    t = t.replace(_gCfRx('(^|' + _G_CF_L + ')(por)(?=\\s+R\\$)', 'giu'), (m, pre, w, off, str) => {
      const ant = _gCfNu(str.slice(0, off + pre.length).trim().split(/\s+/).pop());
      if(ant && qtd.test(ant)) return m;
      r.removidas.push(w); return pre;
    });
    // "(lata)" → "lata": parêntese em volta de UMA palavra é só pontuação. Com mais de uma
    // ("(8 fatias)", "(2 burgers + batata)") o parêntese agrupa — fica.
    t = t.replace(/\((\p{L}+)\)/gu, (m, w) => { r.trocas.push([m, w]); return w; });
    return _gCfAbre(s, _gCfLimpa(t));
  }},
  { id:'unidades', fn:(s, r) => {
    const un = [['litros?|lts?', 'L', ''], ['mililitros?', 'ml', ''], ['gramas?', 'g', ''],
                ['quilos?', 'kg', ''], ['unidades?', 'un', ' ']];
    let t = s;
    un.forEach(([p, abrev, sep]) => {
      // A abreviação herda a caixa (ciclo 3: "500 GRAMAS" virava "500g" numa arte em caixa alta,
      // "10 UNIDADES" → "10 un"). O L já é maiúsculo. Grama em caixa alta NÃO abrevia: "500G" se lê
      // como tamanho G — fica "500 GRAMAS".
      t = t.replace(_gCfRx('(\\d)\\s*(' + p + ')(?=$|' + _G_CF_L + ')', 'giu'), (m, d, w) => {
        // Só a caixa ALTA conta: "Gramas" em Título continua "g" (unidade não vira "G"/"Un").
        const n = w.length > 1 && w === w.toUpperCase() ? abrev.toUpperCase() : abrev;
        if(n === 'G') return m;
        r.trocas.push([w, n]); return d + sep + n;
      });
    });
    // "500 ml" → "500ml": a unidade já é abreviada, só cola no número (como "2L" acima). Só ml,
    // o caso confirmado no corpus; "2 L" solto fica como o franqueado escreveu.
    t = t.replace(_gCfRx('(\\d)\\s+(ml)(?=$|' + _G_CF_L + ')', 'giu'), (m, d, w) => {
      r.trocas.push([d + ' ' + w, d + w]); return d + w;
    });
    // "Refri de 2L" → "Refri 2L", "Açaí de 700ml" → "Açaí 700ml" (ciclo 4, corpus: "refris de
    // 600ml", "refri de 2L grátis", "Milkshake de 500 ml"). Só com ITEM de pedido colado antes e
    // volume/peso depois: o "de" ali só liga o produto à medida. "a partir de 500g", "acima de
    // 2L", "ganhe 1 de 300ml" ficam — antes do "de" não há item.
    t = t.replace(_gCfRx('(^|' + _G_CF_L + ')(' + G_CF_ITENS + ')(\\s+)(de)\\s+(?=\\d+(?:[.,]\\d+)?\\s*(?:ml|l|g|kg)(?=$|' + _G_CF_L + '))', 'giu'),
      (m, pre, item, esp, de) => { r.removidas.push(de); return pre + item + esp; });
    return t;
  }},
  { id:'curtas', fn:(s, r) => {
    // "40 reais" FICA: trocar por "R$ 40" muda o tom que o franqueado escolheu — decisão do Ryan,
    // pendente. Não reintroduzir sem ela.
    // "de desconto" → "OFF" depois de % ou de um valor em R$ ("R$ 20 de desconto" → "R$ 20 OFF").
    let t = s.replace(/(\d\s*%|R\$\s*\d+(?:[.,]\d+)?)\s*de\s+desconto/giu, (m, v) => { r.trocas.push(['de desconto', 'OFF']); return v.replace(/\s*%$/, '%') + ' OFF'; });
    // "de segunda a domingo" → "seg a dom". Cada abreviação herda a caixa do SEU dia; o "de" que
    // sai passa a maiúscula de abertura para a 1ª ("De segunda a sábado," → "Seg a sáb,").
    const dia = '(' + _G_CF_DIA + ')(?:-feira)?';
    t = t.replace(_gCfRe('de\\s+' + dia + '\\s+([aàAÀ])\\s+' + dia), (m, pre, w, d1, a, d2) => {
      const ab = d => _gCfCaixa(d, _G_CF_DIA3[d.slice(0, 3).toLowerCase()] || d);
      // o "a" herda a caixa digitada: "De Segunda A Sexta" → "Seg A Sex" (não "Seg a Sex")
      let n = ab(d1) + (/[AÀ]/.test(a) ? ' A ' : ' a ') + ab(d2);
      if(/^\p{Lu}/u.test(w)) n = n.charAt(0).toUpperCase() + n.slice(1);
      r.trocas.push([w, n]); return pre + n;
    });
    // "quarta-feira" → "quarta", "quartas-feiras" → "quartas" (o plural fica: "toda quarta" e
    // "todas as quartas" dizem a mesma coisa, mas trocar a concordância não é papel daqui).
    t = t.replace(_gCfRe('(segunda|ter[cç]a|quarta|quinta|sexta)(s?)-feiras?'), (m, pre, w, d, pl) => {
      r.trocas.push([w, d + pl]); return pre + d + pl;
    });
    // "Taxa de entrega grátis" → "Entrega grátis": a taxa que é grátis É a entrega grátis. O resto
    // mantém a caixa digitada; só a abertura herda a maiúscula do "Taxa".
    t = t.replace(_gCfRe('taxa\\s+de\\s+(entrega\\s+gr[aá]tis)'), (m, pre, w, resto) => {
      const n = _gCfCaixa(w.slice(0, 4), resto.charAt(0)) + resto.slice(1);
      r.trocas.push([w, n]); return pre + n;
    });
    G_CF_CURTAS.forEach(([p, curta]) => {
      t = t.replace(_gCfRe(p), (m, pre, w) => { const n = _gCfCaixa(w, curta); r.trocas.push([w, n]); return pre + n; });
    });
    return t;
  }},
  { id:'lista', fn:(s, r) => {
    // "A com B" → "A + B" só quando B é ITEM de pedido, decidido "com" a "com". Nunca:
    //  · abrindo o trecho ("Com batata": sem o item antes, o "+" viraria corte);
    //  · antes de número/%/leite/molho (não estão na lista): "Pizza com 50%", "Kit com 5";
    //  · depois de leve/pague/caixa/kit ou de um número: "Leve 2 pague 1 com refri" é a regra
    //    da oferta, não um combo;
    //  · se o trecho segue com vírgula: "A + B, C e D" mistura dois jeitos de listar.
    // O " e " → " + " não economiza letra; só existe para não sair "A + B e C" — por isso só
    // depois de um "com" que virou "+" no MESMO trecho, e só antes de outro item.
    const item = _gCfRx('^(?:' + G_CF_ITENS + ')$', 'iu');
    let mudou = false;
    // A quebra de linha também fecha o trecho: "Pizza\ncom refri" é "Com refri" abrindo a linha.
    const t = s.split(/([:;.!?()\n])/).map((p, k) => {
      if(k % 2) return p;
      const w = p.split(' ');
      let ativo = false;
      for(let i = 0; i < w.length; i++){
        const b = w[i].toLowerCase(), prox = _gCfNu(w[i + 1]);
        if(b === 'com'){
          ativo = false;
          const ant = w.slice(0, i).filter(Boolean).slice(-2);
          if(!ant.length || /,$/.test(ant[ant.length - 1]) || !item.test(prox)) continue;
          if(/^\d+$/.test(ant[ant.length - 1]) || ant.some(a => /^(?:leve|pague|caixa|kit)$/iu.test(_gCfNu(a)))) continue;
          // Vírgula DECIMAL não é lista (ciclo 4): "X-Tudo com batata e refri 2L R$ 39,90" ficava
          // sem o "+" só por causa do preço — era a vírgula do 39,90 travando o trecho inteiro.
          if(/(^|\D),|,(?!\d)/.test(w.slice(i + 1).join(' '))) continue;
          w[i] = '+'; ativo = mudou = true;
        } else if(b === 'e' && ativo && item.test(prox)){
          w[i] = '+';
        }
      }
      return w.join(' ');
    }).join('');
    if(!mudou) return s;
    r.trocas.push(['com', '+']);
    return _gCfLimpa(t);
  }},
  { id:'tamanho', fn:(s, r) => {
    // TODOS OU NENHUM: "Pizzas M a R$ 29,90 e grandes a R$ 39,90" parece erro de digitação.
    // Se algum tamanho do TRECHO não tem item antes (não dá para abreviar), nenhum dele abrevia.
    // O trecho vai até . ! ? ; | — "Pizza G com refri. Batata grande ou média" é outra frase,
    // e o leitor não compara as duas; valer para o texto inteiro travava ganho à toa.
    const sub = parte => {
      const todos = (parte.match(_gCfRe(G_CF_TAMANHOS.map(x => x[0]).join('|'))) || []).length;
      const trocas = [];
      let t = parte;
      // "tamanho grande" sem item colado ("Milho tamanho grande", "Yakisoba de carne tamanho
      // grande"): a própria palavra TAMANHO diz o que a letra é — vira "tamanho G", e ela fica.
      // NOME DE LOJA não é tamanho: "Casa do Pastel Grande", "Pastel Grande da Feira" — antes
      // viravam "Pastel G". Trava pelo que vem antes (casa/cantinho… do) e depois (da feira/vila…).
      const loja = '|\\s+d[aoe]s?\\s+(?:feira|vila|pra[cç]a|esquina|centro|bairro|casa|cidade|fam[ií]lia)(?=$|' + _G_CF_L + ')';
      G_CF_TAMANHOS.forEach(([p, letra]) => {
        t = t.replace(_gCfRx('((?<!(?:casa|cantinho|recanto|point|rei|mundo|espa[cç]o|toca)\\s+d[aoe]s?\\s+)(?:' + G_CF_TEM_TAMANHO + '|tamanho))(\\s+)(?:tamanho\\s+)?(' + p + ')(?=$|' + _G_CF_L + ')(?!' + _G_CF_TAM_NOME + loja + ')', 'giu'),
          (m, item, esp, w) => { trocas.push([w, letra]); return item + esp + letra; });
      });
      if(trocas.length !== todos) return parte;
      trocas.forEach(x => r.trocas.push(x));
      return t;
    };
    return s.split(/([.!?;|\n])/).map((p, k) => k % 2 ? p : sub(p)).join('');
  }},
  { id:'enfeite', fn:(s, r) => {
    // A quebra de linha vira palavra própria: "Pizza\nDeliciosa coxinha" — o enfeite que abre a
    // linha é anteposto (antes de uma "palavra" sem letra), e a quebra volta no _gCfLimpa.
    const palavras = s.replace(/\n/g, ' \n ').split(' ');
    const re = _gCfRx('^(' + G_CF_ENFEITES.join('|') + ')$', 'iu');
    // Super/mega antes de TAMANHO ou em nome composto é o que se vende: "Pizza Super Grande",
    // "Super Família", "Super Mercado".
    const preso = /^(?:grandes?|gigantes?|fam[ií]lia|gg?|m|p|mercados?|market|store|star|her[oó]is?)$/iu;
    const out = [];
    palavras.forEach((w, i) => {
      const m = w.match(re);
      if(!m){ out.push(w); return; }
      // Só ANTEPOSTO sai: "Delicioso X-Tudo", "Leve um super combo". Depois do substantivo
      // é NOME ("Burger Top", "X-Tudo mega", "Brigadeiro Gourmet") — sai o produto junto.
      // Trecho blindado ({{x}}, tag) conta como palavra: "{{produto}} Super Mercado" não é abertura.
      const ant = palavras[i - 1];
      const anteposto = i === 0 || /[:!?.,;]$/.test(ant) || !/[\p{L}\d\uE000-\uF8FF]/u.test(ant) || _G_CF_LIGA.test(ant);
      const prox = _gCfNu(palavras[i + 1]);
      if(!anteposto || !/^\p{L}/u.test(prox)) { out.push(w); return; }
      if(/^(?:da|do|de)$/iu.test(prox)) { out.push(w); return; }   // "Famosa da Vila"
      if(/^(?:super|mega)$/iu.test(m[1]) && preso.test(prox)) { out.push(w); return; }
      r.removidas.push(w);
      // Abria FRASE no meio do texto ("Oferta! Deliciosa coxinha", ou abrindo uma linha): a
      // maiúscula passa para a próxima — senão sai "Oferta! coxinha". A abertura do texto
      // inteiro é o _gCfAbre abaixo.
      if(i > 0 && /^\p{Lu}/u.test(w) && (/[.!?]$/.test(ant) || ant === '\n'))
        palavras[i + 1] = palavras[i + 1].replace(/^([^\p{L}]*)(\p{Ll})/u, (x, a, c) => a + c.toUpperCase());
    });
    return _gCfAbre(s, _gCfLimpa(out.join(' ')));
  }}
];

/* O que NÃO pode mudar: os números, na mesma ordem; os trechos blindados ({{x}}, tag,
   entidade), idênticos e na mesma ordem; e nunca ficar mais longo. */
function gCopyFitGuarda(original, candidato){
  const nums = s => (String(s || '').match(/\d+(?:[.,]\d+)?/g) || []).join('|');
  return nums(original) === nums(candidato) && _gCfBlindados(original) === _gCfBlindados(candidato)
    && String(candidato).length <= String(original).length;
}

/* CUSTO PERCEPTÍVEL de cada degrau — quanto o franqueado estranha ao ler a versão sugerida.
   A escada cumulativa de antes era ordem fixa: para tirar "Delicioso" era preciso aceitar também
   "Hambúrguer → Burger", mesmo quando só o enfeite já bastava. Agora cada COMBINAÇÃO de degraus
   vira candidato, e a lista sai ordenada por:
     1. soma dos pesos dos degraus que MUDARAM o texto (degrau que não achou nada não custa);
     2. menos trocas + removidas (duas mexidas pesam mais que uma do mesmo degrau);
     3. texto mais longo (menos cortado) · 4. o próprio texto — só para ser determinístico.
   Os pesos: limpeza 0 (espaço, "por apenas", parêntese de uma palavra: ninguém sente falta);
   unidade 1 ("500ml" é como se escreve); forma curta 2 (consagrada, mas a palavra muda);
   tamanho e lista 3 (a letra/o "+" mudam a cara da frase); enfeite 5 (sai uma palavra dita). */
const _G_CF_PESO = { limpeza:0, unidades:1, curtas:2, tamanho:3, lista:3, enfeite:5 };
const _G_CF_MAX = 12;

/**
 * Os candidatos, do MENOR ao maior custo perceptível. Sem medir nada.
 * @returns {Array<{text, degrau, degraus:[string], custo:number, trocas:[[de,para]], removidas:[string]}>}
 *   `degrau` = o último degrau que mudou (compatível com a escada antiga).
 */
function gCopyFitCandidatos(texto){
  const limpo = _gCfLimpa(texto);
  // Texto que já traz o marcador (fonte de ícone mora na área privada) não é blindável com
  // segurança: a resposta honesta é não sugerir nada.
  if(!limpo || limpo.indexOf('\uE000') >= 0) return [];
  const blindados = [];
  const original = limpo.replace(_G_CF_BLINDA, m => '\uE000' + String.fromCharCode(0xE100 + blindados.push(m) - 1));
  if(blindados.length > 0x1700) return [];
  const solta = s => s.replace(/\uE000([\uE100-\uF7FF])/g, (m, c) => blindados[c.charCodeAt(0) - 0xE100]);
  // Um degrau só vale se passa na guarda; o que ele anotou em trocas/removidas só entra junto.
  // O resultado de um degrau só depende do texto de entrada — as 32 combinações repetem muito
  // prefixo, então memoiza por (degrau, estado). A chave é o próprio OBJETO do estado (degrau
  // que não muda nada devolve o mesmo objeto): chavear pelo texto concatenado custava hash de
  // string longa a cada passo — era o maior gasto do motor (ciclo 3).
  const numsOrig = (original.match(/\d+(?:[.,]\d+)?/g) || []).join('|');
  const passo = (d, est) => {
    const memo = est.prox || (est.prox = {});
    if(memo[d.id]) return memo[d.id];
    const r = { trocas: [], removidas: [] };
    let t;
    try{ t = _gCfLimpa(d.fn(est.text, r)); }catch(e){ t = est.text; }
    // = gCopyFitGuarda(original, t) sem recontar o original (aqui o texto está blindado)
    const ok = t !== est.text && t.length <= original.length && (t.match(/\d+(?:[.,]\d+)?/g) || []).join('|') === numsOrig;
    return memo[d.id] = !ok ? est : { text: t, trocas: est.trocas.concat(r.trocas), removidas: est.removidas.concat(r.removidas),
      degraus: est.degraus.concat(d.id) };
  };
  // A limpeza é a base de todos (custo 0); os outros 5 degraus entram em todas as 2^5 = 32
  // combinações, sempre na ordem da escada (lista depende de curtas: "refrigerante" → "refri").
  const [limpeza, ...resto] = _G_CF_DEGRAUS;
  const base = passo(limpeza, { text: original, trocas: [], removidas: [], degraus: [] });
  const antes = (a, b) =>
    (a.custo - b.custo) || ((a.trocas.length + a.removidas.length) - (b.trocas.length + b.removidas.length))
    || (b.text.length - a.text.length) || (a.text < b.text ? -1 : a.text > b.text ? 1 : 0);
  const porTexto = {};
  for(let mask = 0; mask < (1 << resto.length); mask++){
    let est = base;
    resto.forEach((d, i) => { if(mask & (1 << i)) est = passo(d, est); });
    if(est.text === original) continue;
    const c = { text: est.text, degrau: est.degraus[est.degraus.length - 1], degraus: est.degraus,
      custo: est.degraus.reduce((a, id) => a + _G_CF_PESO[id], 0), trocas: est.trocas, removidas: est.removidas };
    const ja = porTexto[c.text];
    if(!ja || antes(c, ja) < 0) porTexto[c.text] = c;     // mesmo texto: fica o caminho mais barato
  }
  // Solta a blindagem (texto, trocas, removidas) e confere a guarda de novo no texto REAL —
  // o marcador tem 2 caracteres e o {{x}} tem mais, então o comprimento só se prova aqui.
  const todos = Object.keys(porTexto).map(k => {
    const c = porTexto[k];
    if(!blindados.length) return c;
    return Object.assign(c, { text: solta(c.text), trocas: c.trocas.map(p => p.map(solta)), removidas: c.removidas.map(solta) });
  }).filter(c => !blindados.length || gCopyFitGuarda(limpo, c.text));
  // A LIMPEZA SOZINHA também é resposta (ciclo 4): "pedidos!!!" → "pedidos!", espaço duplo. Ela
  // roda antes de tudo e virava a BASE — se só ela bastava, o motor dizia "não coube" com a
  // versão que cabia na mão. Custo 0: ninguém sente falta do "!!" a mais.
  if(limpo !== String(texto) && gCopyFitGuarda(texto, limpo))
    todos.push({ text: limpo, degrau: 'limpeza', degraus: ['limpeza'], custo: 0, trocas: [], removidas: [] });
  todos.sort(antes);
  // Dominado sai: se um candidato mais BARATO já é tão curto quanto este, este nunca seria a
  // melhor resposta — e cada candidato custa uma medição em pixel no chamador.
  const out = [];
  todos.forEach(c => { if(!out.length || c.text.length < out[out.length - 1].text.length) out.push(c); });
  // Teto: os mais baratos + sempre o mais curto, para o "não coube" continuar honesto.
  return out.length > _G_CF_MAX ? out.slice(0, _G_CF_MAX - 1).concat(out[out.length - 1]) : out;
}

/**
 * Até `max` sugestões que CABEM, validadas por quem desenha.
 * @param {string}   texto
 * @param {function} cabe  (texto) → {ok:boolean, fontSize:number, ...}  — o Local Fit do campo.
 *   Campos a mais são OPCIONAIS e só repassados no `maisPerto` (ex.: `falta` em letras,
 *   `overflowX`/`overflowY` em px). O `_fLpBalaoCabe` de hoje devolve só {ok, fontSize}.
 * @returns {{sugestoes:Array, nenhuma:boolean, maisPerto?:object|null}}
 *   A 1ª é a que MENOS mexeu e coube; as seguintes só entram se deixam a letra maior (≥2px):
 *   três versões que dão a mesma arte seriam três perguntas para uma resposta só.
 *   `maisPerto` só vem com `nenhuma:true`: o candidato MAIS CURTO (o que chegou mais perto),
 *   {text, fontSize, degraus, trocas, removidas, ...o que o `cabe` informou além de `ok`} — para
 *   a UI poder dizer "faltam N letras". `null` quando o motor não achou candidato nenhum.
 */
function gCopyFitSugestoes(texto, cabe, max){
  max = max || 3;
  const candidatos = gCopyFitCandidatos(texto);
  const sugestoes = [];
  let melhorFs = -1, ultimo = null;
  for(const c of candidatos){
    let v = null;
    try{ v = cabe(c.text); }catch(e){ v = null; }
    ultimo = { c, v };
    if(!v || !v.ok) continue;
    const fs = Number(v.fontSize) || 0;
    if(sugestoes.length && fs < melhorFs + 2) continue;
    sugestoes.push(Object.assign({}, c, { fontSize: fs, maior: sugestoes.length > 0 }));
    melhorFs = Math.max(melhorFs, fs);
    if(sugestoes.length >= max) break;
  }
  if(sugestoes.length) return { sugestoes, nenhuma: false };
  // Nenhuma coube: o laço mediu todos, então o último medido é o mais curto (a lista termina nele).
  let maisPerto = null;
  if(ultimo){
    const extra = Object.assign({}, (ultimo.v && typeof ultimo.v === 'object') ? ultimo.v : {});
    delete extra.ok;
    const c = ultimo.c;
    maisPerto = Object.assign(extra, { text: c.text, fontSize: Number(extra.fontSize) || 0,
      degraus: c.degraus, trocas: c.trocas, removidas: c.removidas });
  }
  return { sugestoes, nenhuma: true, maisPerto };
}
