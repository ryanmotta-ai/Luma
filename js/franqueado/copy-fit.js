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

   Os degraus vão do menos ao mais perceptível, CUMULATIVOS: a 1ª sugestão que cabe é a que
   menos mexeu. Cada candidato leva a lista do que mudou (`trocas`, `removidas`) — a UI mostra
   o que saiu, a pessoa confere antes de aceitar.

   API: gCopyFitCandidatos(texto) · gCopyFitSugestoes(texto, cabe, max) · gCopyFitGuarda(a, b)
   ══════════════════════════════════════════════════════════════════════════════════════════ */

/* Fronteira de palavra que entende acento (o `\b` do JS não entende: "promoção" quebraria). */
const _G_CF_L = '[^\\p{L}\\d]';
function _gCfRe(padrao){ return new RegExp('(^|' + _G_CF_L + ')(' + padrao + ')(?=$|' + _G_CF_L + ')', 'giu'); }

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
  ['hamb[uú]rgueres', 'burgers'], ['hamb[uú]rguer', 'burger'],
  ['promo[cç][oõ]es', 'promos'], ['promo[cç][aã]o', 'promo'],
  ['de segunda a sexta', 'seg a sex'], ['de segunda a s[aá]bado', 'seg a sáb'],
  ['segunda-feira', 'segunda'], ['ter[cç]a-feira', 'terça'], ['quarta-feira', 'quarta'],
  ['quinta-feira', 'quinta'], ['sexta-feira', 'sexta']
];
/* Enfeite: adjetivo que não diz O QUE é o produto. "Tradicional", "artesanal", "caseiro" NÃO
   entram — são sabor/descrição e mudariam o que se vende. "Especial" também não: "Pizza
   Especial", "molho especial", "Especial da Casa" — é quase sempre o NOME do sabor. */
const G_CF_ENFEITES = ['super', 'mega', 'delicios[oa]s?', 'incr[ií]ve(?:l|is)',
  'gourmet', 'maravilhos[oa]s?', 'exclusiv[oa]s?', 'imperd[ií]ve(?:l|is)', 'irresist[ií]ve(?:l|is)',
  'famos[oa]s?', 'saboros[oa]s?', 'top'];
/* Tamanho só vira letra DEPOIS de algo que tem tamanho — "Grande São Paulo" fica como está. */
const G_CF_TEM_TAMANHO = 'pizzas?|batatas?\\s+fritas?|batatas?|fritas|refris?|refrigerantes?|a[cç]a[ií]s?|copos?|por[cç](?:[aã]o|[oõ]es)|milk-?shakes?|sucos?|combos?|lanches?|past[eé]is|pastel|esfihas?|sorvetes?';
const G_CF_TAMANHOS = [['grandes?', 'G'], ['m[eé]di[oa]s?', 'M'], ['pequen[oa]s?', 'P']];
/* Item de PEDIDO — só antes dele o "com" vira "+". "Café com leite", "Combinado com salmão",
   "Pizza doce com morango": ali o "com" é composição, e o "+" venderia duas coisas. */
const G_CF_ITENS = 'refris?|refrigerantes?|batatas?|fritas|sucos?|burgers?|hamb[uú]rgueres|hamb[uú]rguer|pizzas?|por[cç](?:[aã]o|[oõ]es)|sobremesas?|bebidas?|guaran[aá]s?|coca-cola|cocas?|milk-?shakes?|a[cç]a[ií]s?|sorvetes?|past[eé]is|pastel|esfihas?|coxinhas?|x-\\p{L}+';
/* Palavra de ligação: o enfeite depois dela ainda está ANTEPOSTO ("Leve um delicioso X-Tudo"). */
const _G_CF_LIGA = /^(?:o|a|os|as|um|uma|uns|umas|de|do|da|dos|das|no|na|nos|nas|e|em|com|para|pra|seu|sua|seus|suas|\+)$/iu;
const _gCfNu = w => String(w || '').replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, '');

/* Tirar a 1ª palavra não pode deixar a frase abrindo em minúscula: "Famosa coxinha" →
   "Coxinha". Só quando o original abria em maiúscula (caixa alta toda já vem do texto). */
function _gCfAbre(orig, novo){
  if(/^[^\p{L}]*\p{Lu}/u.test(orig) && /^[^\p{L}]*\p{Ll}/u.test(novo)) return novo.replace(/\p{Ll}/u, c => c.toUpperCase());
  return novo;
}

function _gCfLimpa(s){
  return String(s || '').replace(/\s+/g, ' ').replace(/\s+([,.!?;:])/g, '$1')
    .replace(/([!?.])\1+/g, '$1').replace(/(\+\s*){2,}/g, '+ ').replace(/^\s*\+\s*|\s*\+\s*$/g, '')
    .replace(/\s+/g, ' ').trim();
}

/* Os degraus. Cada um recebe {text, trocas, removidas} e devolve o mesmo formato. */
const _G_CF_DEGRAUS = [
  { id:'limpeza', fn:(s, r) => {
    // Só ANTES DE PREÇO ("por apenas R$", "somente 9,90"). "Frete grátis apenas para o centro",
    // "Válido somente hoje": ali é RESTRIÇÃO — tirar muda a oferta.
    const re = new RegExp('(^|' + _G_CF_L + ')(por apenas|por somente|apenas|somente)(?=\\s+(?:R\\$|\\d+,\\d{2}))', 'giu');
    let t = s.replace(re, (m, pre, w) => { r.removidas.push(w); return pre; });
    return _gCfAbre(s, _gCfLimpa(t));
  }},
  { id:'unidades', fn:(s, r) => {
    const un = [['litros?|lts?', 'L', ''], ['mililitros?', 'ml', ''], ['gramas?', 'g', ''],
                ['quilos?', 'kg', ''], ['unidades?', 'un', ' ']];
    let t = s;
    un.forEach(([p, abrev, sep]) => {
      t = t.replace(new RegExp('(\\d)\\s*(' + p + ')(?=$|' + _G_CF_L + ')', 'giu'), (m, d, w) => {
        r.trocas.push([w, abrev]); return d + sep + abrev;
      });
    });
    return t;
  }},
  { id:'curtas', fn:(s, r) => {
    let t = s.replace(/(\d)\s*%\s*de\s+desconto/giu, (m, d) => { r.trocas.push(['de desconto', 'OFF']); return d + '% OFF'; });
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
    const item = new RegExp('^(?:' + G_CF_ITENS + ')$', 'iu');
    let mudou = false;
    const t = s.split(/([:;.!?()])/).map((p, k) => {
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
          if(w.slice(i + 1).join(' ').includes(',')) continue;
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
    // Se algum tamanho da frase não tem item antes (não dá para abreviar), nenhum abrevia.
    const todos = (s.match(_gCfRe(G_CF_TAMANHOS.map(x => x[0]).join('|'))) || []).length;
    const trocas = [];
    let t = s;
    G_CF_TAMANHOS.forEach(([p, letra]) => {
      t = t.replace(new RegExp('(' + G_CF_TEM_TAMANHO + ')(\\s+)(?:tamanho\\s+)?(' + p + ')(?=$|' + _G_CF_L + ')', 'giu'),
        (m, item, esp, w) => { trocas.push([w, letra]); return item + esp + letra; });
    });
    if(trocas.length !== todos) return s;
    trocas.forEach(x => r.trocas.push(x));
    return t;
  }},
  { id:'enfeite', fn:(s, r) => {
    const palavras = s.split(' ');
    const re = new RegExp('^(' + G_CF_ENFEITES.join('|') + ')$', 'iu');
    // Super/mega antes de TAMANHO ou em nome composto é o que se vende: "Pizza Super Grande",
    // "Super Família", "Super Mercado".
    const preso = /^(?:grandes?|gigantes?|fam[ií]lia|gg?|m|p|mercados?|market|store|star|her[oó]is?)$/iu;
    const out = palavras.filter((w, i) => {
      const m = w.match(re);
      if(!m) return true;
      // Só ANTEPOSTO sai: "Delicioso X-Tudo", "Leve um super combo". Depois do substantivo
      // é NOME ("Burger Top", "X-Tudo mega", "Brigadeiro Gourmet") — sai o produto junto.
      const ant = palavras[i - 1];
      const anteposto = i === 0 || /[:!?.,;]$/.test(ant) || !/[\p{L}\d]/u.test(ant) || _G_CF_LIGA.test(ant);
      const prox = _gCfNu(palavras[i + 1]);
      if(!anteposto || !/^\p{L}/u.test(prox)) return true;
      if(/^(?:da|do|de)$/iu.test(prox)) return true;               // "Famosa da Vila"
      if(/^(?:super|mega)$/iu.test(m[1]) && preso.test(prox)) return true;
      r.removidas.push(w);
      return false;
    });
    return _gCfAbre(s, _gCfLimpa(out.join(' ')));
  }}
];

/* O que NÃO pode mudar: os números, na mesma ordem; e nunca ficar mais longo. */
function gCopyFitGuarda(original, candidato){
  const nums = s => (String(s || '').match(/\d+(?:[.,]\d+)?/g) || []).join('|');
  return nums(original) === nums(candidato) && String(candidato).length <= String(original).length;
}

/**
 * Os candidatos CUMULATIVOS, do menos ao mais perceptível. Sem medir nada.
 * @returns {Array<{text, degrau, trocas:[[de,para]], removidas:[string]}>}
 */
function gCopyFitCandidatos(texto){
  const original = _gCfLimpa(texto);
  if(!original) return [];
  const out = [];
  const r = { trocas: [], removidas: [] };
  let atual = original;
  _G_CF_DEGRAUS.forEach(d => {
    const antes = atual;
    try{ atual = _gCfLimpa(d.fn(atual, r)); }catch(e){ atual = antes; }
    if(!gCopyFitGuarda(original, atual)){ atual = antes; return; }
    if(atual !== antes && atual !== original && !out.some(c => c.text === atual))
      out.push({ text: atual, degrau: d.id, trocas: r.trocas.slice(), removidas: r.removidas.slice() });
  });
  return out;
}

/**
 * Até `max` sugestões que CABEM, validadas por quem desenha.
 * @param {string}   texto
 * @param {function} cabe  (texto) → {ok:boolean, fontSize:number}  — o Local Fit do campo
 * @returns {{sugestoes:Array, nenhuma:boolean}}
 *   A 1ª é a que MENOS mexeu e coube; as seguintes só entram se deixam a letra maior (≥2px):
 *   três versões que dão a mesma arte seriam três perguntas para uma resposta só.
 */
function gCopyFitSugestoes(texto, cabe, max){
  max = max || 3;
  const candidatos = gCopyFitCandidatos(texto);
  const sugestoes = [];
  let melhorFs = -1;
  for(const c of candidatos){
    let v = null;
    try{ v = cabe(c.text); }catch(e){ v = null; }
    if(!v || !v.ok) continue;
    const fs = Number(v.fontSize) || 0;
    if(sugestoes.length && fs < melhorFs + 2) continue;
    sugestoes.push(Object.assign({}, c, { fontSize: fs, maior: sugestoes.length > 0 }));
    melhorFs = Math.max(melhorFs, fs);
    if(sugestoes.length >= max) break;
  }
  return { sugestoes, nenhuma: !sugestoes.length };
}
