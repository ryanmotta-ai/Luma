/* ══════════════════════════════════════════════════════════════════════════════════════════
   AUTO-LAYOUT — as primitivas de LEITURA da arte
   ------------------------------------------------------------------------------------------
   ⚠ O QUE ESTE ARQUIVO DEIXOU DE SER (09/2026). Ele foi, por um tempo, um AUTOMATIC DESIGNER:
   grammar, composition graph, layout components, elasticidade, impact zones, operational
   capability, designer moves, candidate search (beam), scoring lexicográfico, adaptive scale
   groups, confiança e rollout — ~6.400 linhas. A decisão de produto mudou: o Luma não recompõe
   mais a arte de ninguém. Tudo isso foi REMOVIDO, junto com a escada de recomposição que vivia
   no `gApplyRelativeAnchors`. O histórico está no Git; o repositório não carrega o cadáver.

   O QUE RESOLVE CONTEÚDO NOVO HOJE: `js/core/local-fit.js` (`gLocalFitArte`). O texto tenta
   caber na PRÓPRIA caixa autorada — corpo original → quebra → encolhimento progressivo → piso
   de legibilidade — e, se não couber, BLOQUEIA. Nada se move. Ninguém é empurrado.

   O QUE SOBROU AQUI são as primitivas de leitura que o Local Fit, o render, o importador de PSD
   e o Estúdio continuam usando. Elas descrevem a arte; nenhuma delas decide composição:

     1. BASELINE AUTORADO   — o contrato do desenho original em TODO vínculo (não só no PSD),
                              com migração para material antigo. É a referência de "o que o
                              designer desenhou" que o Local Fit lê para não medir um clone já
                              adaptado.
     2. FONTE DETERMINÍSTICA— a mesma arte decide igual com a fonte carregada, ausente ou
                              substituída; a diferença de métrica vira calibragem, não veredito.
     3. COMPILADOR SEMÂNTICO— `layoutRole` (título/produto/preço/apoio/legal/CTA/fundo/
                              decoração/protegida) compilado sozinho, sem trabalho pro designer.
                              Alimenta o teto de linhas e o piso de hierarquia.
     4. SAFE ZONES DE IMAGEM— rosto, produto e logo protegidos DENTRO da foto.
     5. QUEBRA SEMÂNTICA    — `R$ 29,90`, `50%`, `500 ml`, preposição órfã e CTA não se partem.
     6. CAMPOS DE UMA CAMADA— os `{{campos}}` que ela usa, pelo nome.
     7. TELEMETRIA          — status, campo culpado e tempo, para saber onde o Local Fit trava
                              em escala.

   ⚠ NENHUMA FUNÇÃO DAQUI ESCREVE GEOMETRIA. Quem escreve é o Local Fit, e só `_tetoFonte` (o
   corpo escolhido) e a placa ligada ao próprio texto.
   ══════════════════════════════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════════
   1. BASELINE AUTORADO — o contrato do desenho
   ════════════════════════════════════════════════════════════════════
   `layoutRefText` nasceu no import de PSD (`psd-parse.js`) e é o texto que o designer tinha na
   tela quando compôs. É a régua que separa "este texto cresceu" de "esta fonte mede diferente".
   O buraco: camada ligada à mão pelo painel Campos NÃO guardava nada, e template antigo também
   não tem. Sem referência, o solver comparava o valor do franqueado com a CAIXA desenhada — que
   quase sempre é maior que o texto — e só reagia tarde demais.

   Aqui a referência vira universal por dois caminhos:
   · na hora do vínculo (`gStampLayoutBaseline`), gravada no template;
   · em runtime (`gEnsureLayoutBaseline`), reconstruída para o que já está publicado.
   A reconstrução usa o EXEMPLO do campo — que é exatamente o texto que estava na camada quando
   alguém ligou o Dado (ver `dLayerBindField`) — e nunca o rótulo do campo, que é nome técnico
   travestido de conteúdo e mediria qualquer coisa. */

const G_LAYOUT_BASELINE_V = 1;
/* Sonda de métrica: dígitos, caixa alta, caixa baixa, acento e cifrão. Larga o bastante para
   que 1% de diferença de fonte apareça, e fixa para que a medida seja comparável entre
   aparelhos. Medida SEMPRE a 100px — assim o número independe do corpo da camada. */
const G_LAYOUT_PROBE = 'Wg08 Preço Mn R$ 1.249,00';
const G_LAYOUT_PROBE_PX = 100;

function gLayoutFontProbe(l, ctxAux){
  try{
    const cv = ctxAux ? ctxAux.canvas : document.createElement('canvas');
    const ctx = ctxAux || cv.getContext('2d');
    const fp = (typeof dTextFontParts === 'function') ? dTextFontParts(l && l.font)
             : { family:"'Roboto', sans-serif", weight:700 };
    const peso = String((l && l.fontWeightOverride) || fp.weight);
    const antes = ctx.font, antesLs = ctx.letterSpacing;
    ctx.font = peso + ' ' + G_LAYOUT_PROBE_PX + 'px ' + fp.family;
    ctx.letterSpacing = '0px';
    const w = ctx.measureText(G_LAYOUT_PROBE).width;
    ctx.font = antes; if(antesLs != null) ctx.letterSpacing = antesLs;
    return Math.round(w * 100) / 100;
  }catch(e){ return 0; }
}

/* Grava o baseline de UMA camada. `texto` é o que o designer via; sem ele não há baseline
   (medir o rótulo do campo produziria uma referência mentirosa). */
function gStampLayoutBaseline(l, texto, ctxAux){
  if(!l || l.type !== 'text') return null;
  const t = String(texto == null ? '' : texto).trim();
  if(!t) return null;
  if(typeof gVarRegex === 'function' && gVarRegex().test(t)) return null;   // '{{campo}}' não é texto autorado
  const cv = ctxAux ? ctxAux.canvas : document.createElement('canvas');
  const ctx = ctxAux || cv.getContext('2d');
  let ink = { w:l.w||0, h:l.h||0 }, linhas = 1;
  if(typeof gFitTextLayer === 'function'){
    const limpo = gLayoutLimpaCarimbos(l);
    const f = gFitTextLayer(limpo, t, ctx, {encolher:false});
    ink = { w: Math.round(f.larguraMax||0), h: Math.round(f.altura||0) };
    linhas = (f.lines && f.lines.length) || 1;
  }
  l.layoutRefText = t;
  l.layoutRef = {
    v: G_LAYOUT_BASELINE_V,
    x: Math.round(l.x||0), y: Math.round(l.y||0), w: Math.round(l.w||0), h: Math.round(l.h||0),
    fontSize: Math.round(l.fontSize||24),
    lineHeight: (typeof gLineHeightDe === 'function') ? gLineHeightDe(l) : (l.lineHeight||1.2),
    letterSpacing: (l.letterSpacing != null) ? l.letterSpacing : null,
    textAlign: l.textAlign || 'left', textBox: l.textBox || 'point',
    font: l.font || '', linhas: linhas, ink: ink,
    probe: gLayoutFontProbe(l, ctx)
  };
  return l.layoutRef;
}

/* Tira do clone os carimbos temporários do encaixe. Medir uma referência com o teto de fonte
   da volta anterior já produziu baseline que "encolhia sozinho" a cada iteração. */
function gLayoutLimpaCarimbos(l){
  const c = Object.assign({}, l);
  delete c._layoutW; delete c._layoutDx; delete c._layoutMaxLines; delete c._tetoFonte;
  delete c._entrelinha; delete c._fit; delete c._vTopAuto; delete c._foraDaArte;
  delete c._layoutInvalido; delete c._layoutBase; delete c._layoutH;
  return c;
}

/* Texto autorado provável de uma camada que NÃO tem baseline (template antigo).
   Ordem de confiança: baseline gravado > exemplo do campo (é o texto original de quem ligou o
   Dado) > valor padrão do campo. Rótulo do campo NUNCA entra. */
function gLayoutTextoAutorado(l){
  if(!l || l.type !== 'text') return '';
  if(l.layoutRefText) return String(l.layoutRefText);
  const conteudo = String(l.content || '');
  const temCampo = /\{\{/.test(conteudo);
  if(!temCampo) return conteudo.trim();
  if(typeof dVars === 'undefined' || !Array.isArray(dVars)) return '';
  const re = (typeof gVarRegex === 'function') ? gVarRegex()
           : /\{\{\s*([a-zA-Z0-9_]+)(?::[a-zA-Z0-9_]+)?\s*\}\}/g;
  let out = conteudo, m, achou = false;
  re.lastIndex = 0;
  const trocas = [];
  while((m = re.exec(conteudo)) !== null){
    const v = dVars.find(x => x && x.name === m[1]);
    const exemplo = v && v.example != null && String(v.example).trim() !== '' ? String(v.example)
                  : (v && v.defaultValue != null && String(v.defaultValue).trim() !== '' ? String(v.defaultValue) : null);
    if(!exemplo) return '';           // sem exemplo confiável, melhor não ter baseline do que ter um falso
    trocas.push([m[0], exemplo]); achou = true;
  }
  if(!achou) return '';
  trocas.forEach(([de, para]) => { out = out.split(de).join(para); });
  return out.trim();
}

/* MIGRAÇÃO EM RUNTIME — roda no começo de cada solve. Material publicado antes deste trabalho
   ganha a referência sem precisar de deploy, migration ou o designer reabrir o template.
   Carimba no CLONE (o solver já trabalha em clones), então nada é reescrito sem querer. */
function gEnsureLayoutBaseline(layers, ctxAux){
  if(!Array.isArray(layers)) return layers;
  layers.forEach(l => {
    if(!l || l.type !== 'text') return;
    if(l.layoutRef && l.layoutRef.v === G_LAYOUT_BASELINE_V && l.layoutRefText) return;
    const t = gLayoutTextoAutorado(l);
    if(!t) return;
    gStampLayoutBaseline(l, t, ctxAux);
  });
  return layers;
}

/* ════════════════════════════════════════════════════════════════════
   2. DETERMINISMO DE FONTE
   ════════════════════════════════════════════════════════════════════
   O mesmo template abre no Chrome do designer, no Safari do iPhone e no Android do franqueado.
   Se a fonte da marca não carregou num deles, o navegador substitui — e o MESMO texto mede
   diferente. Sem calibragem, a arte "quebra" só num aparelho: o solver enxerga crescimento onde
   houve apenas troca de métrica, encolhe a fonte e entrega uma composição diferente da prévia.

   A régua: o baseline guarda a largura de uma SONDA medida no momento da autoria. Em runtime,
   a mesma sonda é medida de novo. A razão entre as duas é o desvio da fonte — e o baseline é
   corrigido por ele. Assim o veredito ("cresceu" / "não cresceu") é o mesmo em toda plataforma,
   mesmo quando os glifos não são.
   ⚠ Isto NÃO promete pixel igual entre navegadores (rasterizadores diferentes desenham
   diferente). Promete DECISÃO igual — que é o que faz a prévia bater com o arquivo final. */

function gLayoutFontDrift(l, ctxAux){
  const ref = l && l.layoutRef && l.layoutRef.probe;
  if(!ref || ref <= 0) return 1;
  const agora = gLayoutFontProbe(l, ctxAux);
  if(!agora || agora <= 0) return 1;
  const d = agora / ref;
  // Fora de 0,5×–2× não é substituição de fonte, é baseline de outro template/erro de medida.
  if(!isFinite(d) || d < 0.5 || d > 2) return 1;
  return d;
}

function gLayoutFontStatus(l, ctxAux){
  if(!l || !l.layoutRef || !l.layoutRef.probe) return 'desconhecida';
  const d = gLayoutFontDrift(l, ctxAux);
  if(Math.abs(d - 1) <= 0.005) return 'ok';          // 0,5% é ruído de subpixel, não substituição
  return 'substituida';
}

/* A referência do baseline já calibrada pela fonte REAL desta sessão. É o número que o solver
   deve comparar com a tinta atual. */
function gLayoutRefInk(l, ctxAux){
  if(!l || !l.layoutRef || !l.layoutRef.ink) return null;
  const d = gLayoutFontDrift(l, ctxAux);
  return { w: (l.layoutRef.ink.w||0) * d, h: (l.layoutRef.ink.h||0) * d, drift: d,
           linhas: l.layoutRef.linhas || 1 };
}

/* ════════════════════════════════════════════════════════════════════
   3. COMPILADOR SEMÂNTICO — `layoutRole` sem trabalho pro designer
   ════════════════════════════════════════════════════════════════════
   `layoutRole` era lido em 6 pontos e escrito em NENHUM (roadmap §6). A escolha aqui é
   COMPILAR, não pedir: importação, vínculo e publicação classificam sozinhas, e o designer
   segue sem um formulário a mais. Quando ele quiser mandar, manda — `layoutRoleManual` vence
   sempre, e é o que uma futura UI vai escrever.

   O papel sai de quatro sinais, nesta ordem de confiança:
     · o NOME da camada (o designer nomeia por função: "Preço", "CTA", "Legal");
     · o CONTEÚDO (R$, %, "peça agora", "consulte o regulamento");
     · a POSIÇÃO/ÁREA (fundo cobre a prancheta; rodapé mora nos últimos 12%);
     · o DEGRAU TIPOGRÁFICO (o maior corpo da arte é o título, o menor é o legal).
   Precisão acima de recall: na dúvida devolve 'apoio' (o papel neutro), nunca inventa
   'protegida' — carimbar proteção errada congela uma camada que deveria acompanhar o texto. */

function gLayoutSemanticRole(l, ctx){
  if(!l) return 'apoio';
  if(l.layoutRoleManual) return l.layoutRoleManual;
  const cv = (ctx && ctx.canvas) || null;
  const nome = String(l.name || '').trim().toLowerCase();
  const texto = String(l.content || '').trim();
  const alvo = (nome + ' ' + texto).toLowerCase();

  // FUNDO — a mesma régua que o resto do motor usa, para não existirem duas verdades.
  if(typeof _gLayoutEhFundoExplicito === 'function' && _gLayoutEhFundoExplicito(l, cv)) return 'fundo';

  if(l.type === 'group') return 'decoracao';

  // PROTEGIDA — o que a marca não deixa mexer. Travada pelo designer é declaração explícita.
  if(l.locked || l.lockPosition) return 'protegida';
  if(/(^|[\s_\-])(logo(tipo)?|marca|assinatura|selo|carimbo|qr[\s_\-]?code)([\s_\-]|$)/.test(nome)) return 'protegida';

  if(l.type === 'image' || l.type === 'frame'){
    if(/(fundo|background|bg|textura|texture)/.test(nome)) return 'fundo';
    if(/(produto|prato|combo|item|foto|pack|embalagem)/.test(nome)) return 'produto';
    return 'decoracao';
  }
  if(l.type === 'shape'){
    if(/(placa|card|caixa|box|fundo|faixa|tarja|pill|badge)/.test(nome)) return 'decoracao';
    return 'decoracao';
  }
  if(l.type !== 'text') return 'decoracao';

  // ── TEXTO ──
  // CTA primeiro: é curto e usa vocabulário fechado, então quase não gera falso positivo.
  if(/(^|[\s_\-])(cta|bot[aã]o|button)([\s_\-]|$)/.test(nome)) return 'cta';
  if(/^(pe[cç]a|compre|baixe|aproveite|garanta|corra|clique|acesse|chame|fa[cç]a|venha|confira|saiba)\b/i.test(texto)
     && texto.replace(/\{\{[^}]*\}\}/g,'').split(/\s+/).filter(Boolean).length <= 5) return 'cta';

  // LEGAL — regulamento/disclaimer. Vem antes de "preço" porque um disclaimer costuma citar R$.
  if(/(regulamento|disclaimer|termos|legal|obrigat[oó]ri|consulte|imagens?\s+ilustrativ|rodap[eé]|validade|v[aá]lido)/.test(alvo)) return 'legal';

  // PREÇO — nome dedicado ou conteúdo com moeda/percentual dominante.
  if(/(^|[\s_\-])(pre[cç]o|valor|de\s*por|desconto|off|cupom|c[oó]digo)([\s_\-]|$)/.test(nome)) return 'preco';
  if(/(R\$|US\$|€)\s*\d|^\s*\d{1,3}\s*%/.test(texto)) return 'preco';

  if(/(descri[cç][aã]o|ingrediente|observa[cç][aã]o|detalhe|subt[ií]tulo|apoio|complemento)/.test(nome)) return 'apoio';
  if(/(produto|sabor|item|combo|prato|brinde)/.test(nome)) return 'produto';
  if(/(t[ií]tulo|headline|chamada|oferta|manchete)/.test(nome)) return 'titulo';

  /* Sem sinal no nome, decide o DEGRAU: o maior corpo da arte é o título, o menor é apoio.
     `ctx.degraus` chega ordenado do maior para o menor por `gCompileLayoutRoles`. */
  const degraus = (ctx && ctx.degraus) || [];
  const s = Math.round(l.fontSize || 24);
  if(degraus.length >= 2){
    if(s >= degraus[0]) return 'titulo';
    if(s <= degraus[degraus.length - 1] && degraus.length >= 3) return 'legal';
  }
  // Rodapé geográfico: os últimos 12% da arte são onde mora o texto obrigatório.
  if(cv && cv.h && (l.y || 0) >= cv.h * 0.88) return 'legal';
  return 'apoio';
}

/* Compila o papel de TODAS as camadas. Idempotente e barato: uma passada + uma ordenação.
   Chamado na importação de PSD, no vínculo de campo, na publicação e (para material antigo)
   no próprio solver. */
function gCompileLayoutRoles(layers, canvas){
  if(!Array.isArray(layers)) return layers;
  const degraus = [...new Set(layers
    .filter(l => l && l.type === 'text' && (typeof _gLayoutVisivel !== 'function' || _gLayoutVisivel(l)))
    .map(l => Math.round(l.fontSize || 24)))].sort((a,b) => b - a);
  const ctx = { canvas: canvas || null, degraus };
  layers.forEach(l => {
    if(!l) return;
    const papel = gLayoutSemanticRole(l, ctx);
    l.layoutSemantic = papel;
    /* ⚠ DOIS VOCABULÁRIOS, DE PROPÓSITO — e é isto que fecha o item aberto do roadmap
       ("`layoutRole` é lido e nunca escrito"):
       · `layoutSemantic` é a classificação rica (título/produto/preço/apoio/legal/CTA/…), lida
         pela pontuação, pelo teto de linhas e pela quebra. Vocabulário novo, ninguém depende.
       · `layoutRole` é o CONTRATO ANTIGO do runtime, com duas palavras que o encaixe e o
         `core/layout.js` já leem há tempos: 'background' e 'protected'. Escrever qualquer outra
         coisa nele seria inventar valor que nenhum leitor entende.
       Campo dinâmico nunca é carimbado: 'protected'/'background' IMOBILIZAM a camada, e
       imobilizar um campo desligaria o Auto-layout exatamente onde ele precisa agir. */
    const temCampo = (typeof _gLayoutTemCampo === 'function') && _gLayoutTemCampo(l);
    if(temCampo) return;
    if(papel === 'fundo') l.layoutRole = 'background';
    else if(papel === 'protegida') l.layoutRole = 'protected';
  });
  return layers;
}

/* Teto de linhas por PAPEL — a versão semântica do `_gLayoutMaxLinhas`, que só sabia ler nome.
   Título vira duas linhas e para; regulamento pode correr. */
function gLayoutRoleMaxLines(role){
  switch(role){
    case 'cta':    return 2;
    case 'preco':  return 2;
    case 'titulo': return 3;
    case 'produto':return 3;
    case 'legal':  return 8;
    case 'apoio':  return 4;
    default:       return 4;
  }
}

/* ── QUEM É PREÇO ────────────────────────────────────────────────────
   O preço é o argumento da peça: o franqueado promete "R$ 9,99" no corpo que o designer
   desenhou. A regra de 19/08 existia para impedir que a escada de recomposição encolhesse o
   preço por causa de um TÍTULO longo (medido: 36% menor por motivo alheio). Com o Local Fit ela
   virou consequência da arquitetura, não uma exceção: cada texto encaixa SOZINHO, na própria
   caixa, então nenhum campo cede por causa de outro — o preço menos ainda.

   O que a resposta ainda governa: o teto de linhas do preço (2) e o reconhecimento do par
   de preço no corpus e no importador de PSD.

   ⚠ Consequência assumida: como cada campo encolhe isolado, uma camada autorada MAIOR pode
   terminar menor que o preço. Nas artes da marca o preço costuma ser o maior elemento, então a
   inversão é tolerada no corpus em vez de reprovar a arte.

   Quem é preço: o metadado do campo manda (`dVars[].category`/`type`, decisão de quem criou o
   campo); no runtime do franqueado, onde `dVars` não existe, vale a MESMA heurística de nome
   que a auto-criação já usa (`gFieldGuessType`) — não há segunda régua. */
function gLayoutCampoEhPreco(nome){
  if(!nome) return false;
  if(typeof dVars !== 'undefined' && Array.isArray(dVars)){
    const v = dVars.find(x => x && x.name === nome);
    if(v && v.category) return v.category === 'preco';
    if(v && v.type) return v.type === 'currency';
  }
  return (typeof gFieldGuessType === 'function') && gFieldGuessType(nome) === 'currency';
}

// Camada de TEXTO que carrega pelo menos um campo de preço. Texto de preço fixo (sem campo)
// não entra: sem campo dinâmico, nada nele cresce por causa do franqueado.
function gLayoutEhPrecoDinamico(l){
  if(!l || l.type !== 'text') return false;
  return gLayoutCamposDe(l).some(gLayoutCampoEhPreco);
}

/* ════════════════════════════════════════════════════════════════════
   4. SAFE ZONES DE IMAGEM — proteger o assunto, não a moldura
   ════════════════════════════════════════════════════════════════════
   A caixa da foto podia estar "segura" enquanto o texto cobria justamente o rosto do modelo ou
   o produto. E o inverso também acontecia: um PNG recortado tem metade da caixa transparente, e
   tratar a caixa inteira como obstáculo roubava espaço que existia de fato.

   Duas fontes, nesta ordem:
   · `safeZones` autorado (retângulos normalizados 0..1 dentro da camada) — quando existir UI;
   · `inkBox` — a caixa do que é opaco na imagem, calculada no import de PSD, onde os pixels já
     estão na memória. É o assunto real da foto.
   Sem nenhum dos dois, a caixa inteira continua sendo a zona segura: o comportamento de hoje. */

function gLayoutSafeZones(l){
  if(!l) return [];
  const bx = l.x || 0, by = l.y || 0, bw = l.w || 0, bh = l.h || 0;
  const out = [];
  if(Array.isArray(l.safeZones)){
    l.safeZones.forEach(z => {
      if(!z) return;
      out.push({ x: bx + (Number(z.x)||0) * bw, y: by + (Number(z.y)||0) * bh,
                 w: Math.max(0, (Number(z.w)||0) * bw), h: Math.max(0, (Number(z.h)||0) * bh),
                 kind: z.kind || 'autoral', peso: 1 });
    });
  }
  if(!out.length && l.inkBox && (l.type === 'image' || l.type === 'frame')){
    const z = l.inkBox;
    out.push({ x: bx + (Number(z.x)||0) * bw, y: by + (Number(z.y)||0) * bh,
               w: Math.max(0, (Number(z.w)||0) * bw), h: Math.max(0, (Number(z.h)||0) * bh),
               kind: 'assunto', peso: 1 });
  }
  return out;
}

/* O retângulo que o obstáculo REALMENTE protege. Sem zona segura devolve o que o solver já
   usava — é assim que nada muda para quem não tem a informação. */
function gLayoutObstacleRect(o, rect){
  const base = rect || { x:o&&o.x||0, y:o&&o.y||0, w:o&&o.w||0, h:o&&o.h||0 };
  if(!o || (o.type !== 'image' && o.type !== 'frame')) return base;
  const zonas = gLayoutSafeZones(o);
  if(!zonas.length) return base;
  /* A zona vem em coordenadas da camada AUTORADA; o `rect` pode ter sido movido/escalado pela
     render. Reprojeta pela razão entre os dois para a proteção acompanhar a foto. */
  const ew = (o.w || 0) || 1, eh = (o.h || 0) || 1;
  const sx = (base.w || 0) / ew, sy = (base.h || 0) / eh;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  zonas.forEach(z => {
    const zx = base.x + (z.x - (o.x||0)) * sx, zy = base.y + (z.y - (o.y||0)) * sy;
    x1 = Math.min(x1, zx); y1 = Math.min(y1, zy);
    x2 = Math.max(x2, zx + z.w * sx); y2 = Math.max(y2, zy + z.h * sy);
  });
  if(!isFinite(x1) || x2 <= x1 || y2 <= y1) return base;
  return { x:x1, y:y1, w:x2-x1, h:y2-y1 };
}

/* ════════════════════════════════════════════════════════════════════
   5. QUEBRA SEMÂNTICA — o que nunca se parte
   ════════════════════════════════════════════════════════════════════
   `gSmartWrapText` já pontuava desequilíbrio, conector no fim de linha e órfã curta. Faltava o
   principal: certas sequências não são "duas palavras", são UMA informação. Partir `R$ 29,90`
   entre linhas é o erro mais visível de uma peça de promo — e o mais fácil de evitar.

   A cola é CONDICIONAL: só gruda se a unidade colada ainda couber na largura disponível. Sem
   essa guarda, uma unidade maior que a caixa cairia na quebra dura por grafema (`pushToken`) e
   partiria a palavra no meio — trocaria um defeito bonito por um feio. */

const G_LAYOUT_UNIDADES = [
  // moeda + valor: R$ 29,90 · US$ 10 · € 5,00
  { antes: /^(R\$|RS\$|US\$|U\$|€|£)$/i,                        depois: /^[\d]/ },
  // valor + percentual solto: 50 % → uma unidade
  { antes: /^\d{1,3}([.,]\d+)?$/,                               depois: /^%$/ },
  // quantidade + unidade de medida: 500 ml · 2 un · 1 kg · 3 litros
  { antes: /^\d{1,4}([.,]\d+)?$/,                               depois: /^(ml|l|litros?|kg|g|gr|un|und|unidades?|pe[cç]as?|cm|mm)$/i },
  // numeral por extenso da promoção: 2 por · leve 3
  { antes: /^\d{1,3}$/,                                         depois: /^(por|x)$/i }
];

/* Conector no fim da linha é feio; conector SOZINHO no fim da frase é pior. Grudar a preposição
   na palavra seguinte resolve os dois de uma vez e é o que um designer faz na mão. */
function gLayoutColaConector(palavra){
  if(typeof G_CONNECTORS === 'undefined') return false;
  const limpa = String(palavra||'').toLowerCase().replace(/[.,!?;:]/g,'');
  return G_CONNECTORS.has(limpa);
}

/**
 * Agrupa palavras em UNIDADES semânticas. `medir` e `disponivel` são obrigatórios: a cola só
 * vale quando o resultado continua cabendo.
 * @returns {string[]} unidades (cada uma pode conter espaço interno)
 */
function gSemanticUnits(words, medir, disponivel){
  if(!Array.isArray(words) || words.length < 2) return (words||[]).slice();
  const cabe = (s) => { try{ return medir(s) <= disponivel; }catch(e){ return false; } };
  const out = [];
  for(let i = 0; i < words.length; i++){
    let unidade = words[i];
    while(i + 1 < words.length){
      const a = unidade.split(' ').pop(), b = words[i+1];
      const casaPar = G_LAYOUT_UNIDADES.some(r => r.antes.test(a) && r.depois.test(b));
      const casaConector = gLayoutColaConector(a);
      if(!casaPar && !casaConector) break;
      const junto = unidade + ' ' + b;
      if(!cabe(junto)) break;                 // não cabe colado → melhor separado que partido
      unidade = junto; i++;
      if(casaConector && !casaPar){           // conector cola UMA palavra, não a frase inteira —
        const prox = words[i+1];              // exceto quando ela abre um par: "por R$" + "999,90"
        if(!(prox && G_LAYOUT_UNIDADES.some(r => r.antes.test(b) && r.depois.test(prox)))) break;
      }
    }
    out.push(unidade);
  }
  return out;
}

/* Os `{{campos}}` que uma camada usa. Régua única de "esta camada reage ao franqueado?" para
   quem precisa dos NOMES (o `_gLayoutTemCampo` do 00-config só responde sim/não). */
function gLayoutCamposDe(l){
  const out = [];
  const re = (typeof gVarRegex === 'function') ? gVarRegex()
           : /\{\{\s*([a-zA-Z0-9_]+)(?::[a-zA-Z0-9_]+)?\s*\}\}/g;
  re.lastIndex = 0;
  let m;
  while((m = re.exec(String((l && l.content) || ''))) !== null) if(out.indexOf(m[1]) < 0) out.push(m[1]);
  return out;
}

/* ════════════════════════════════════════════════════════════════════
   9. TELEMETRIA — onde ele falha em escala
   ════════════════════════════════════════════════════════════════════
   Sem número, "o Auto-layout está bom" é opinião. O evento registra o que responde às
   perguntas de operação: quantas artes saem originais, quantas adaptadas, quantas bloqueadas,
   qual campo trava, qual estratégia venceu, quanto tempo custou e em qual template.
   ⚠ Nunca vai CONTEÚDO do franqueado — só o NOME do campo, o tamanho e o veredito. O evento é
   fire-and-forget (`gTrackEvent` já é), então analytics jamais derruba a geração da arte. */

const _G_LAYOUT_TELE_VISTOS = new Map();
let _gLayoutTempos = [];

function gLayoutRegistraTempo(ms){
  if(!isFinite(ms)) return;
  _gLayoutTempos.push(ms);
  if(_gLayoutTempos.length > 200) _gLayoutTempos = _gLayoutTempos.slice(-200);
}

/* Orçamento de desempenho: p50/p95 dos últimos solves. Lido pelo corpus de regressão e pelo
   console do time — é o número que diz se o motor cabe num celular fraco. */
function gLayoutPerfStats(){
  if(!_gLayoutTempos.length) return { n:0, p50:0, p95:0, max:0 };
  const s = _gLayoutTempos.slice().sort((a,b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];
  return { n:s.length, p50:Math.round(q(0.5)*100)/100, p95:Math.round(q(0.95)*100)/100,
           max:Math.round(s[s.length-1]*100)/100 };
}

function gLayoutTelemetry(result, meta){
  try{
    if(!result || typeof gTrackEvent !== 'function') return;
    meta = meta || {};
    const chave = [meta.template||'', meta.formato||'', result.status||'', (result.diagnostico&&result.diagnostico.campo)||''].join('|');
    /* A prévia re-renderiza a cada tecla. Sem esta trava, uma sessão de digitação viraria
       centenas de linhas idênticas em `fct_eventos`. Exportação sempre registra: é o momento em
       que a arte vira arquivo, e é dele que a operação precisa contar. */
    if(meta.purpose !== 'export'){
      if(_G_LAYOUT_TELE_VISTOS.has(chave)) return;
      if(_G_LAYOUT_TELE_VISTOS.size > 50) _G_LAYOUT_TELE_VISTOS.clear();
      _G_LAYOUT_TELE_VISTOS.set(chave, 1);
    }
    gTrackEvent('layout_resolvido', {
      status: result.status || 'original',
      origem: meta.purpose || 'preview',
      template: meta.template || null,
      material: meta.material || null,
      formato: meta.formato || null,
      ms: (result.meta && result.meta.ms) != null ? result.meta.ms : null,
      camadas_alteradas: (result.changes || []).length,
      camadas_invalidas: (result.invalidIds || []).length,
      campo: (result.diagnostico && result.diagnostico.campo) || null,
      limite_seguro: (result.diagnostico && result.diagnostico.limite) != null ? result.diagnostico.limite : null,
      fonte: (result.meta && result.meta.fonte) || 'desconhecida'
    });
  }catch(e){ /* analytics nunca quebra o fluxo do usuário */ }
}

/* Estado das fontes da arte inteira — entra na telemetria e explica divergência entre
   aparelhos sem precisar do aparelho na mão. */
function gLayoutFonteStatusArte(layers, ctxAux){
  let comBase = 0, subst = 0;
  (layers||[]).forEach(l => {
    if(!l || l.type !== 'text' || !l.layoutRef || !l.layoutRef.probe) return;
    comBase++;
    if(gLayoutFontStatus(l, ctxAux) === 'substituida') subst++;
  });
  if(!comBase) return 'desconhecida';
  if(!subst) return 'ok';
  return subst === comBase ? 'substituida' : 'parcial';
}
