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
       CONSAGRADA no delivery, compactar lista ("com"/"e" → "+"), abreviar tamanho EM CONTEXTO
       (depois de pizza/batata/refri…) e tirar ENFEITE de uma lista fechada. Se isso não
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
   entram — são sabor/descrição e mudariam o que se vende. */
const G_CF_ENFEITES = ['super', 'mega', 'delicios[oa]s?', 'incr[ií]ve(?:l|is)', 'especia(?:l|is)',
  'gourmet', 'maravilhos[oa]s?', 'exclusiv[oa]s?', 'imperd[ií]ve(?:l|is)', 'irresist[ií]ve(?:l|is)',
  'famos[oa]s?', 'saboros[oa]s?', 'top'];
/* Tamanho só vira letra DEPOIS de algo que tem tamanho — "Grande São Paulo" fica como está. */
const G_CF_TEM_TAMANHO = 'pizzas?|batatas?|fritas|refris?|refrigerantes?|a[cç]a[ií]s?|copos?|por[cç](?:[aã]o|[oõ]es)|milk-?shakes?|sucos?|combos?|lanches?|past[eé]is|pastel|esfihas?|sorvetes?';
const G_CF_TAMANHOS = [['grandes?', 'G'], ['m[eé]di[oa]s?', 'M'], ['pequen[oa]s?', 'P']];

function _gCfLimpa(s){
  return String(s || '').replace(/\s+/g, ' ').replace(/\s+([,.!?;:])/g, '$1')
    .replace(/([!?.])\1+/g, '$1').replace(/(\+\s*){2,}/g, '+ ').replace(/^\s*\+\s*|\s*\+\s*$/g, '')
    .replace(/\s+/g, ' ').trim();
}

/* Os degraus. Cada um recebe {text, trocas, removidas} e devolve o mesmo formato. */
const _G_CF_DEGRAUS = [
  { id:'limpeza', fn:(s, r) => {
    let t = s.replace(_gCfRe('por apenas|apenas|somente'), (m, pre, w) => { r.removidas.push(w); return pre; });
    return _gCfLimpa(t);
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
    // Só vira "+" quando há um COMBO: "A com B (e C)". Frase sem "com" não é lista.
    if(!_gCfRe('com').test(s)) return s;
    // "Com batata" (abrindo a frase) não é lista: sem o item antes, o "+" viraria corte.
    let t = s.replace(_gCfRe('com'), (m, pre) => pre === '' ? m : pre + '+').replace(/(\S)\+/g, '$1 +');
    if(t === s) return s;
    t = t.replace(/\s+e\s+/giu, ' + ');
    r.trocas.push(['com', '+']);
    return _gCfLimpa(t);
  }},
  { id:'tamanho', fn:(s, r) => {
    let t = s;
    G_CF_TAMANHOS.forEach(([p, letra]) => {
      t = t.replace(new RegExp('(' + G_CF_TEM_TAMANHO + ')(\\s+)(?:tamanho\\s+)?(' + p + ')(?=$|' + _G_CF_L + ')', 'giu'),
        (m, item, esp, w) => { r.trocas.push([w, letra]); return item + esp + letra; });
    });
    return t;
  }},
  { id:'enfeite', fn:(s, r) => {
    const palavras = s.split(' ');
    const re = new RegExp('^(' + G_CF_ENFEITES.join('|') + ')([,.!]?)$', 'iu');
    const out = palavras.filter((w, i) => {
      const m = w.match(re);
      if(!m) return true;
      const base = m[1].toLowerCase();
      // "Especial" abrindo a frase costuma ser o NOME do sabor ("Especial da Casa", "Especial
      // Frango"); os outros enfeites abrindo a frase são só enfeite ("Delicioso X-Tudo").
      if(i === 0 && /^especia/.test(base)) return true;
      const prox = (palavras[i + 1] || '').toLowerCase();
      if(prox === 'da' || prox === 'do') return true;              // "especial da casa"
      r.removidas.push(w.replace(/[,.!]$/, ''));
      return false;
    });
    return _gCfLimpa(out.join(' '));
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
