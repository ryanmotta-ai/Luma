/* ══════════════════════════════════════════════════════════════════════════════════════════
   AUTO-LAYOUT — a camada de JULGAMENTO
   ------------------------------------------------------------------------------------------
   O solver de composição mora em `00-config.js` (`gApplyRelativeAnchors`): ele mede, infere
   correntes, abre corredores e sobe a escada quebrar → empurrar → apertar entrelinha →
   encolher. Ele é um bom GUARDIÃO DE COLISÃO: garante que nada se atropela.

   Este arquivo é o que faltava para ele virar um AVALIADOR DE COMPOSIÇÃO — capaz de gerar
   algumas soluções e escolher a que preserva a intenção visual de quem desenhou:

     1. BASELINE AUTORADO   — o contrato do desenho original em TODO vínculo (não só no PSD),
                              com migração para material antigo.
     2. FONTE DETERMINÍSTICA— a mesma arte decide igual com a fonte carregada, ausente ou
                              substituída; a diferença de métrica vira calibragem, não veredito.
     3. COMPILADOR SEMÂNTICO— `layoutRole` (título/produto/preço/apoio/legal/CTA/fundo/
                              decoração/protegida) compilado sozinho, sem trabalho pro designer.
     4. SAFE ZONES DE IMAGEM— rosto, produto e logo protegidos DENTRO da foto.
     5. QUEBRA SEMÂNTICA    — `R$ 29,90`, `50%`, `500 ml`, preposição órfã e CTA não se partem.
     6. PONTUAÇÃO ESTÉTICA  — hierarquia, respiro, densidade, linhas, órfãs, alinhamento,
                              alteração mínima e equilíbrio — não apenas "não colidiu".
     7. ALTERNATIVAS        — 3 políticas concorrentes + a padrão; ganha a de maior nota.
     8. DIAGNÓSTICO         — qual campo travou e o maior conteúdo seguro, em PT-BR sem jargão.
     9. TELEMETRIA          — original/adapted/unsafe, culpado, estratégia, tempo e template.

   ⚠ TUDO AQUI É ADITIVO. Nenhuma função deste arquivo pode mudar a geometria de uma arte que
   já cabia: quando o solver resolve no primeiro degrau, as alternativas nem são geradas e a
   nota nem é calculada. O caminho feliz continua byte a byte o de antes.
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

/* Tira do clone os carimbos temporários da cascata. Medir uma referência com o teto de fonte
   da volta anterior já produziu baseline que "encolhia sozinho" a cada iteração. */
function gLayoutLimpaCarimbos(l){
  const c = Object.assign({}, l);
  delete c._layoutW; delete c._layoutDx; delete c._layoutMaxLines; delete c._tetoFonte;
  delete c._entrelinha; delete c._fit; delete c._vTopAuto; delete c._foraDaArte;
  delete c._layoutInvalido; delete c._layoutBase;
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

const G_LAYOUT_ROLES = ['titulo','produto','preco','apoio','legal','cta','fundo','decoracao','protegida'];

function gLayoutRoleOf(l){
  if(!l) return 'apoio';
  return l.layoutRoleManual || l.layoutRole || 'apoio';
}

function gLayoutSemanticRole(l, ctx){
  if(!l) return 'apoio';
  if(l.layoutRoleManual) return l.layoutRoleManual;
  const cv = (ctx && ctx.canvas) || null;
  const nome = String(l.name || '').trim().toLowerCase();
  const texto = String(l.content || '').trim();
  const alvo = (nome + ' ' + texto).toLowerCase();

  // FUNDO — a mesma régua que a cascata já usa, para não existirem duas verdades.
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
       · `layoutRole` é o CONTRATO ANTIGO do runtime, com duas palavras que a cascata e o
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

/* ── PREÇO SÓ CEDE POR CAUSA DO PRÓPRIO PREÇO (regra de 19/08) ───────
   O preço é o argumento da peça: o franqueado promete "R$ 9,99" no corpo que o designer
   desenhou, e reduzir esse corpo porque o TÍTULO ficou longo troca a promessa por um detalhe
   (medido: um preço curto saía 36% menor por causa de um título gigante). Então a escada só
   aperta campo de preço quando ELE mesmo cresceu/estourou a própria caixa — aí encolher é o que
   faz o "R$ 129,90" caber no selo desenhado pra ele. Motivo alheio (colisão de terceiros, escala
   proporcional do componente) não toca no preço; cede o resto da arte.

   O que continua valendo, de propósito:
   · a corrente ainda EMPURRA o preço — congelar a posição fazia o título crescido passar por
     cima dele (o corpus mede isso em `de-por-lateral`);
   · ele continua obstáculo dos outros e a placa/selo atrás dele continua crescendo;
   · a validação de segurança não mudou.

   ⚠ Conflito assumido com a nota de hierarquia (`gScoreComposition`): como o preço para de
   descer quando a caixa dele cabe, uma camada autorada MAIOR pode terminar menor que o preço.
   A regra do preço vence — nas artes da marca o preço costuma ser o maior elemento. A inversão
   continua pesando na nota, só deixou de reprovar no corpus.

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
     cascata. Reprojeta pela razão entre os dois para a proteção acompanhar a foto. */
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
      if(casaConector && !casaPar) break;     // conector cola UMA palavra, não a frase inteira
    }
    out.push(unidade);
  }
  return out;
}

/* Penalidade editorial de um conjunto de linhas — usada pela pontuação estética. Mede o que um
   designer olharia: última linha com uma palavra curta, linha terminando em preposição e
   unidade semântica partida no meio. */
function gLayoutPenalidadeEditorial(linhas){
  if(!Array.isArray(linhas) || linhas.length < 2) return 0;
  let p = 0;
  for(let i = 0; i < linhas.length; i++){
    const palavras = String(linhas[i]||'').trim().split(/\s+/).filter(Boolean);
    if(!palavras.length) continue;
    const ultima = palavras[palavras.length - 1];
    if(i < linhas.length - 1 && gLayoutColaConector(ultima)) p += 6;
    if(i === linhas.length - 1 && palavras.length === 1 && ultima.length < 4) p += 10;
    // Moeda/valor partido entre esta linha e a próxima.
    if(i < linhas.length - 1){
      const prox = String(linhas[i+1]||'').trim().split(/\s+/).filter(Boolean)[0] || '';
      if(G_LAYOUT_UNIDADES.some(r => r.antes.test(ultima) && r.depois.test(prox))) p += 14;
    }
  }
  return p;
}

/* ════════════════════════════════════════════════════════════════════
   6. PONTUAÇÃO ESTÉTICA — comparar composições, não só aprovar
   ════════════════════════════════════════════════════════════════════
   "Não colidiu" é o piso, não a meta. Duas soluções podem ser igualmente válidas e uma delas
   ser visivelmente pior: título achatado até virar subtítulo, respiro comido, texto empurrado
   para longe do bloco a que pertence, quatro linhas onde cabiam duas.

   A nota é PENALIDADE somada (menor = melhor) e cada item responde a uma pergunta de designer.
   Os pesos são constantes nomeadas de propósito: são o que se calibra quando um caso real do
   corpus mostrar que a escolha saiu errada. */

const G_SCORE_PESOS = {
  invalido:      1000,  // composição que o solver não conseguiu salvar domina qualquer estética
  inversao:        90,  // título ficou menor que o preço: destrói a leitura da peça
  hierarquia:      30,  // por unidade de log2 de desvio na razão entre dois degraus
  reducao:         55,  // por 100% de corpo perdido (linear: 20% de redução = 11 pts)
  /* Entrelinha fechada custa quase o mesmo que corpo perdido, e é PROPORCIONAL ao que o
     desenho tinha. Estava a 13 (metade do deslocamento) e a conta saía invertida: fechar o
     respiro de um bloco arejado de 1.9 para 1.05 — que descaracteriza a peça inteira — pontuava
     6, enquanto reduzir 20% da fonte pontuava 11. A nota PREFERIA destruir a entrelinha.
     Medido no corpus: com o peso antigo, a política que preserva o respiro não vencia nem no
     fixture criado justamente para ela (`bloco-arejado`). */
  entrelinha:      48,
  deslocamento:    26,  // por 100% do lado curto de movimento acumulado
  linhaExtra:       9,  // por linha além do que o designer publicou (×peso do papel)
  editorial:        1,  // órfãs/conector/valor partido (a penalidade já vem em escala própria)
  respiro:         34,  // por 100% de respiro perdido em relação ao desenho
  densidade:       28,  // por 100% de desvio de área de tinta
  alinhamento:      7,  // por aresta que era alinhada no desenho e deixou de ser
  equilibrio:      18   // por 100% do lado curto de desvio do centro de massa
};
const G_SCORE_PESO_PAPEL = { titulo:1.6, preco:1.5, cta:1.4, produto:1.3, apoio:1, legal:0.6, decoracao:0.4 };

function _gScoreRect(l){
  if(typeof gInkRect === 'function') return gInkRect(l, l && l._fit);
  return { x:l&&l.x||0, y:l&&l.y||0, w:l&&l.w||0, h:l&&l.h||0 };
}
/* DUAS REFERÊNCIAS, para DUAS perguntas diferentes — e confundi-las foi o que fez a nota medir
   a coisa errada:
   · `_gScoreBase` = a composição AUTORADA. Responde "este texto cresceu além do que o designer
     desenhou?" — é a pergunta do CULPADO.
   · `_gScoreSemAjuste` = a mesma arte com o conteúdo real e a geometria publicada, antes de
     qualquer degrau da escada. Responde "quanto a ADAPTAÇÃO custou?" — é a pergunta da NOTA.
   Pontuar contra a autorada cobrava do motor o tamanho do texto que o franqueado digitou: os
   itens geométricos disparavam em 100% dos cenários, inclusive nos que saíram intocados. */
function _gScoreBase(l){
  return (l && l._layoutBase) || { x:l&&l.x||0, y:l&&l.y||0, w:l&&l.w||0, h:l&&l.h||0 };
}
function _gScoreSemAjuste(l){
  return (l && l._layoutSemAjuste) || _gScoreBase(l);
}
function _gScoreFonte(l){ return (l && l._tetoFonte != null) ? l._tetoFonte : ((l && l.fontSize) || 24); }

/**
 * Nota de uma composição resolvida. Recebe os clones que o solver devolveu (já com `_fit`,
 * `_layoutBase`, `_tetoFonte`, `_entrelinha` e os carimbos de falha).
 * @returns {{penal:number, total:number, itens:object}}
 */
function gScoreComposition(layers, opts){
  const cv = (opts && opts.canvas) || { w:1080, h:1080 };
  const curto = Math.max(1, Math.min(cv.w || 1080, cv.h || 1080));
  const area = Math.max(1, (cv.w||1080) * (cv.h||1080));
  const vis = (layers||[]).filter(l => l && (typeof _gLayoutVisivel !== 'function' || _gLayoutVisivel(l)));
  const textos = vis.filter(l => l.type === 'text' && l._fit);
  const itens = { invalido:0, hierarquia:0, reducao:0, deslocamento:0, linhas:0, editorial:0,
                  respiro:0, densidade:0, alinhamento:0, equilibrio:0 };

  // ── VALIDADE (domina) ──
  vis.forEach(l => { if(l._layoutInvalido || l._foraDaArte) itens.invalido += G_SCORE_PESOS.invalido; });

  // ── HIERARQUIA PROPORCIONAL ──
  // A ordem dos degraus é a declaração de importância do designer. Inverter é o pior estrago
  // que uma automação de layout pode fazer; desviar a proporção é o estrago sutil.
  const ordenados = textos.slice().sort((a,b) => (b.fontSize||24) - (a.fontSize||24)).slice(0, 40);
  for(let i = 0; i < ordenados.length; i++){
    for(let j = i + 1; j < ordenados.length; j++){
      const a = ordenados[i], b = ordenados[j];
      const baseA = a.fontSize||24, baseB = b.fontSize||24;
      if(baseA <= baseB) continue;
      const fa = _gScoreFonte(a), fb = _gScoreFonte(b);
      if(fa < fb - 0.5){ itens.hierarquia += G_SCORE_PESOS.inversao; continue; }
      const rBase = baseA / Math.max(1, baseB), rFim = fa / Math.max(1, fb);
      const desvio = Math.abs(Math.log2(Math.max(0.01, rFim / rBase)));
      itens.hierarquia += desvio * G_SCORE_PESOS.hierarquia;
    }
  }

  // ── ALTERAÇÃO MÍNIMA (corpo perdido + deslocamento) ──
  textos.forEach(l => {
    const peso = G_SCORE_PESO_PAPEL[gLayoutRoleOf(l)] != null ? G_SCORE_PESO_PAPEL[gLayoutRoleOf(l)] : 1;
    const perda = Math.max(0, 1 - _gScoreFonte(l) / Math.max(1, l.fontSize || 24));
    itens.reducao += perda * G_SCORE_PESOS.reducao * peso;
    const r = _gScoreRect(l), b = _gScoreSemAjuste(l);
    const d = (Math.abs(r.x - b.x) + Math.abs(r.y - b.y)) / curto;
    itens.deslocamento += d * G_SCORE_PESOS.deslocamento * peso;
    /* Entrelinha fechada entra junto com o corpo perdido: as duas respondem "quanto da
       tipografia autorada sobrou?". O que importa é a FRAÇÃO do respiro original que se perdeu —
       de 1.2 para 1.05 é um ajuste; de 1.9 para 1.05 é outra peça. */
    if(l._entrelinha != null){
      const lhBase = (l.layoutRef && l.layoutRef.lineHeight) || l.lineHeight || 1.2;
      itens.reducao += Math.max(0, (lhBase - l._entrelinha) / Math.max(0.01, lhBase))
                       * G_SCORE_PESOS.entrelinha * peso;
    }
  });

  // ── LINHAS E EDITORIAL ──
  textos.forEach(l => {
    const peso = G_SCORE_PESO_PAPEL[gLayoutRoleOf(l)] != null ? G_SCORE_PESO_PAPEL[gLayoutRoleOf(l)] : 1;
    const linhas = (l._fit.lines && l._fit.lines.length) || 1;
    // Linhas que o texto do franqueado já usaria SEM adaptação: cobrar dele o comprimento do
    // que a pessoa digitou não é avaliar o motor.
    const refLinhas = (l._layoutSemAjuste && l._layoutSemAjuste.linhas)
      || (l.layoutRef && l.layoutRef.linhas) || 1;
    if(linhas > refLinhas) itens.linhas += (linhas - refLinhas) * G_SCORE_PESOS.linhaExtra * peso;
    const teto = gLayoutRoleMaxLines(gLayoutRoleOf(l));
    if(linhas > teto) itens.linhas += (linhas - teto) * G_SCORE_PESOS.linhaExtra * peso * 2;
    itens.editorial += gLayoutPenalidadeEditorial(l._fit.lines || []) * G_SCORE_PESOS.editorial * peso;
  });

  // ── RESPIRO ── quanto do vão original entre blocos sobreviveu.
  // Só entre pares que NÃO se tocavam no desenho: onde já havia sobreposição intencional
  // (texto sobre placa) não existe respiro a perder.
  const caixas = vis.map(l => ({ l, r: _gScoreRect(l), b: _gScoreSemAjuste(l) }))
                    .filter(o => o.r.w > 0 && o.r.h > 0).slice(0, 40);
  let perdaRespiro = 0, paresRespiro = 0;
  for(let i = 0; i < caixas.length; i++){
    for(let j = i + 1; j < caixas.length; j++){
      const A = caixas[i], B = caixas[j];
      if(A.l.type !== 'text' && B.l.type !== 'text') continue;
      const gapBase = _gGapEntre(A.b, B.b);
      if(gapBase <= 0 || gapBase > curto * 0.35) continue;   // sobrepostos no desenho ou longe demais
      const gapFim = _gGapEntre(A.r, B.r);
      paresRespiro++;
      if(gapFim < gapBase) perdaRespiro += (gapBase - gapFim) / Math.max(1, gapBase);
    }
  }
  if(paresRespiro) itens.respiro = (perdaRespiro / paresRespiro) * G_SCORE_PESOS.respiro;

  /* ── DENSIDADE ── quanto a ADAPTAÇÃO mexeu na mancha de tinta.
     ⚠ A referência aqui é `_layoutSemAjuste` (a arte com o conteúdo real e a geometria
     publicada), NÃO a referência autorada. Comparar com a autorada media o quanto o texto do
     franqueado é maior que o do designer — que não é trabalho do motor e é igual para todos os
     candidatos. Com a referência certa, arte não adaptada pontua zero. */
  let inkFim = 0, inkSem = 0;
  textos.forEach(l => {
    const r = _gScoreRect(l), s = _gScoreSemAjuste(l);
    inkFim += Math.max(0, r.w) * Math.max(0, r.h);
    inkSem += Math.max(0, s.w) * Math.max(0, s.h);
  });
  if(inkSem > 0) itens.densidade = Math.abs(inkFim - inkSem) / inkSem * G_SCORE_PESOS.densidade;
  const inkBase = inkSem;

  // ── ALINHAMENTO ── arestas que compartilhavam a mesma coluna e se soltaram.
  const arestas = (o) => {
    const t = o.l.textAlign || 'left';
    return { base: t === 'right' ? o.b.x + o.b.w : t === 'center' ? o.b.x + o.b.w/2 : o.b.x,
             fim:  t === 'right' ? o.r.x + o.r.w : t === 'center' ? o.r.x + o.r.w/2 : o.r.x };
  };
  const soTexto = caixas.filter(o => o.l.type === 'text');
  for(let i = 0; i < soTexto.length; i++){
    for(let j = i + 1; j < soTexto.length; j++){
      const a = arestas(soTexto[i]), b = arestas(soTexto[j]);
      if(Math.abs(a.base - b.base) <= 2 && Math.abs(a.fim - b.fim) > 2) itens.alinhamento += G_SCORE_PESOS.alinhamento;
    }
  }

  // ── EQUILÍBRIO VISUAL ── o centro de massa da tinta saiu do lugar?
  const centro = (sel) => {
    let mx = 0, my = 0, m = 0;
    caixas.forEach(o => {
      const r = sel(o); const peso = Math.max(0, r.w) * Math.max(0, r.h);
      if(!peso) return;
      mx += (r.x + r.w/2) * peso; my += (r.y + r.h/2) * peso; m += peso;
    });
    return m ? { x: mx/m, y: my/m } : null;
  };
  // Mesma correção da densidade: o desvio que interessa é o causado pela adaptação.
  const cFim = centro(o => o.r), cSem = centro(o => _gScoreSemAjuste(o.l));
  if(cFim && cSem){
    itens.equilibrio = (Math.abs(cFim.x - cSem.x) + Math.abs(cFim.y - cSem.y)) / curto * G_SCORE_PESOS.equilibrio;
  }

  const penal = Object.keys(itens).reduce((s,k) => s + (itens[k] || 0), 0);
  // `total` existe para leitura humana (telemetria/log): 100 é a composição intocada.
  return { penal: Math.round(penal * 100) / 100, total: Math.round(Math.max(0, 100 - penal) * 100) / 100,
           itens, area, densidade: inkBase ? inkFim / area : 0 };
}

// Distância entre dois retângulos (0 quando se tocam ou sobrepõem).
function _gGapEntre(a, b){
  if(!a || !b) return 0;
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));
  if(dx === 0 && dy === 0) return 0;
  if(dx === 0) return dy;
  if(dy === 0) return dx;
  return Math.sqrt(dx*dx + dy*dy);
}

/* ════════════════════════════════════════════════════════════════════
   7. ALTERNATIVAS — gerar algumas soluções e escolher por nota
   ════════════════════════════════════════════════════════════════════
   A escada do solver é boa, mas é UM caminho: quebrar → empurrar → apertar entrelinha →
   encolher o menor degrau → escalar o componente. Em muita arte real outro caminho chega mais
   perto do que o designer teria feito.

   ⚠ A geração é DETERMINÍSTICA e CONDICIONAL, por dois motivos que não são negociáveis aqui:
   · prévia e exportação chamam o mesmo motor — se a escolha dependesse de tempo/carga, a
     prévia mentiria sobre o arquivo final, que é o defeito que este projeto mais evita;
   · a arte que resolve no primeiro degrau (quebra/empurrão) já é a de alteração mínima; gerar
     alternativas ali seria pagar 3 solves para reeleger o vencedor.
   Empate: vence a PADRÃO. Ela é a que o corpus de regressão conhece. */

/* `tracking-autoral` (2026-08-19): a política que NÃO devolve o tracking que o motor adicionou
   (degrau 3.7 da escada, em `00-config.js`). Existe porque devolver tracking muda a QUEBRA, e
   medindo com a tipografia display da marca em 18 cenários ela ajudou em 3 (preço +10%, título
   +11%) e atrapalhou em 1 (manchete 78→71, porque a linha reflowou pior). Em vez de escolher no
   escuro, o motor gera as duas e a NOTA decide — que é exatamente para isso que as políticas
   existem. */
const G_LAYOUT_POLITICAS = ['sem-entrelinha', 'entrelinha-livre', 'proporcional', 'tracking-autoral'];

function gLayoutPrecisaAlternativas(cloned){
  return (cloned||[]).some(l => l && (l._tetoFonte != null || l._entrelinha != null
                                      || l._layoutInvalido || l._foraDaArte));
}

function gLayoutEscolherAlternativa(layers, dados, defaults, opts, padrao){
  if(typeof gApplyRelativeAnchors !== 'function') return padrao;
  const cvOpts = { canvas: (opts && opts.canvas) || null };
  const cands = [{ politica: 'padrao', out: padrao, score: gScoreComposition(padrao, cvOpts) }];
  G_LAYOUT_POLITICAS.forEach(politica => {
    let out = null;
    try{ out = gApplyRelativeAnchors(layers, dados, defaults, Object.assign({}, opts, { _politica: politica })); }
    catch(e){ out = null; }                                  // política que estourar não derruba o render
    if(!out || !out.length) return;
    cands.push({ politica, out, score: gScoreComposition(out, cvOpts) });
  });
  /* MARGEM MÍNIMA PARA TROCAR. Medido na bancada: em metade das trocas o ganho era de ~1 ponto
     numa penalidade de 150–390 — meio por cento, que move um CTA 14px por ruído de arredondamento
     e faz a arte mudar entre versões sem ninguém ter pedido. A padrão é a composição que o corpus
     conhece e a de alteração mínima; para destroná-la, a alternativa tem que ganhar de forma
     VISÍVEL: 3 pontos absolutos ou 2% da penalidade, o que for maior. */
  const _margem = Math.max(3, cands[0].score.penal * 0.02);
  let melhor = cands[0];
  cands.forEach(c => {
    if(c === cands[0]) return;
    if(c.score.penal < melhor.score.penal - (melhor === cands[0] ? _margem : 0.001)) melhor = c;
  });
  const msTotal = cands.reduce((s,c) => s + ((c.out._layoutMeta && c.out._layoutMeta.ms) || 0), 0);
  melhor.out._layoutMeta = Object.assign({}, melhor.out._layoutMeta || {}, {
    politica: melhor.politica, ms: Math.round(msTotal * 100) / 100,
    nota: melhor.score.total, penal: melhor.score.penal, itens: melhor.score.itens,
    candidatos: cands.map(c => ({ politica: c.politica, penal: c.score.penal }))
  });
  return melhor.out;
}

/* ════════════════════════════════════════════════════════════════════
   8. DIAGNÓSTICO ACIONÁVEL — quem travou e até onde dá
   ════════════════════════════════════════════════════════════════════
   Bloquear a exportação com "não tem espaço seguro" deixa o franqueado sem saída: ele não sabe
   QUAL texto encurtar nem para quanto. Aqui a resposta é construída: o campo culpado sai do
   próprio resultado do solver, e o maior conteúdo seguro sai de uma busca binária que re-roda o
   MESMO motor — nada de estimativa por caractere, que erraria com fonte proporcional.

   Custo: até 8 solves. Roda só no caminho de FALHA (export bloqueado), nunca na digitação. */

function gLayoutCamposDe(l){
  const out = [];
  const re = (typeof gVarRegex === 'function') ? gVarRegex()
           : /\{\{\s*([a-zA-Z0-9_]+)(?::[a-zA-Z0-9_]+)?\s*\}\}/g;
  re.lastIndex = 0;
  let m;
  while((m = re.exec(String((l && l.content) || ''))) !== null) if(out.indexOf(m[1]) < 0) out.push(m[1]);
  return out;
}

function gLayoutRotuloCampo(nome){
  if(typeof dVars !== 'undefined' && Array.isArray(dVars)){
    const v = dVars.find(x => x && x.name === nome);
    if(v && (v.label || v.name)) return v.label || v.name;
  }
  return nome;
}

/* O campo culpado: entre as camadas marcadas, a que mais cresceu em relação ao próprio desenho.
   "Mais cresceu" e não "primeira da lista" porque a vítima de uma colisão também é marcada. */
function gLayoutCulpado(solved){
  const lista = solved || [];
  const reprovada = (l) => typeof gLayoutCamadaReprovada === 'function'
    ? gLayoutCamadaReprovada(l) : !!(l && (l._layoutInvalido || l._foraDaArte));
  const marcadas = lista.filter(reprovada);
  const cresceu = (l) => {
    const r = _gScoreRect(l), b = _gScoreBase(l);
    return Math.max(0, (r.w * r.h) - (b.w * b.h)) + Math.max(0, r.h - b.h) * 100;
  };
  const comCampo = (l) => !!(l && l.type === 'text' && gLayoutCamposDe(l).length);

  // 1) O caso direto: a própria camada reprovada carrega o campo.
  let alvo = null, pior = -1;
  marcadas.forEach(l => { const c = comCampo(l) ? cresceu(l) : -1; if(c > pior){ pior = c; alvo = comCampo(l) ? l : alvo; } });
  if(alvo) return alvo;

  /* 2) A camada reprovada é VÍTIMA, não causa: um CTA fixo empurrado para fora da prancheta, o
     rodapé legal atropelado, a placa que acompanhou o texto. Quem responde é o ANCESTRAL da
     corrente — sobe pela âncora (manual ou inferida) até achar quem tem campo.
     Sem este ramo, 11 dos 12 bloqueios do fuzzing saíam SEM diagnóstico e o franqueado levava a
     frase genérica: "não cabe", sem dizer o que encurtar. Medido, não suposto. */
  const porId = new Map(lista.filter(Boolean).map(l => [l.id, l]));
  for(const m of marcadas){
    let atual = m, guarda = 0;
    while(atual && guarda++ < 16){
      if(comCampo(atual)) return atual;
      const a = atual.relativeAnchor || atual._anchorAuto;
      atual = (a && a.layerId) ? porId.get(a.layerId)
            : (atual._placa ? porId.get(atual._placa.alvo) : null);
    }
  }

  /* 3) Último recurso: ninguém aponta para um campo, mas alguma coisa cresceu. O campo que mais
     passou da própria referência é a resposta mais útil disponível — e é melhor que nenhuma. */
  pior = 0;
  lista.forEach(l => { if(!comCampo(l)) return; const c = cresceu(l); if(c > pior){ pior = c; alvo = l; } });
  return alvo;
}

function _gLayoutInseguro(out){
  // A MESMA régua do veredito (`gLayoutCamadaReprovada`, em `00-config.js`). Usar uma régua mais
  // curta aqui fazia a busca binária aprovar um estado que a exportação bloquearia — e prometer
  // ao franqueado um limite de caracteres que não cabe é pior que não prometer nada.
  return (out||[]).some(l => typeof gLayoutCamadaReprovada === 'function'
    ? gLayoutCamadaReprovada(l) : (l && (l._layoutInvalido || l._foraDaArte)));
}

/**
 * Diagnóstico do bloqueio. Devolve `null` quando não há campo identificável (arte impossível
 * por desenho, não por conteúdo) — aí a mensagem genérica continua valendo.
 * @returns {{campo,rotulo,atual,limite,mensagem}|null}
 */
function gLayoutDiagnosis(layers, dados, defaults, opts, solved){
  try{
    if(typeof gApplyRelativeAnchors !== 'function') return null;
    const alvo = gLayoutCulpado(solved || []);
    if(!alvo) return null;
    const campos = gLayoutCamposDe(alvo);
    if(!campos.length) return null;
    // Com mais de um campo na mesma camada, o culpado é o de valor mais longo.
    const campo = campos.slice().sort((a,b) =>
      String((dados&&dados[b])||'').length - String((dados&&dados[a])||'').length)[0];
    const valor = String((dados && dados[campo]) != null ? dados[campo] : '');
    const rotulo = gLayoutRotuloCampo(campo);
    if(valor.length < 3) return { campo, rotulo, atual: valor.length, limite: 0,
      mensagem: 'A arte não tem espaço seguro para “' + rotulo + '” neste material. Escolha outro material para este conteúdo.' };

    const testa = (n) => {
      const d = Object.assign({}, dados);
      d[campo] = gLayoutCorta(valor, n);
      const out = gApplyRelativeAnchors(layers, d, defaults,
        Object.assign({}, opts, { _politica: undefined, _semAlternativas: true }));
      return !_gLayoutInseguro(out);
    };
    let baixo = 1, alto = valor.length, limite = 0, voltas = 0;
    if(testa(alto)) limite = alto;                                  // o campo não era o culpado
    while(baixo <= alto && voltas++ < 8 && !limite){
      const meio = Math.floor((baixo + alto) / 2);
      if(testa(meio)){ limite = meio; baixo = meio + 1; } else alto = meio - 1;
    }
    // Refina para cima enquanto sobrar orçamento de voltas: o meio da busca costuma ser
    // conservador e prometer menos caracteres do que a arte realmente aceita.
    while(limite && voltas++ < 12 && limite < valor.length && testa(limite + 1)) limite++;
    return { campo, rotulo, atual: valor.length, limite,
             mensagem: gLayoutMensagem(rotulo, valor.length, limite) };
  }catch(e){ return null; }
}

/* Corta na PALAVRA, não no caractere: um limite que parte a última palavra no meio parece bug
   para quem lê, e o número que o franqueado vê tem que ser o número que ele consegue digitar. */
function gLayoutCorta(s, n){
  const t = String(s || '');
  if(n >= t.length) return t;
  const bruto = t.slice(0, Math.max(0, n));
  const corte = bruto.lastIndexOf(' ');
  return (corte > n * 0.6 ? bruto.slice(0, corte) : bruto).trim();
}

function gLayoutMensagem(rotulo, atual, limite){
  if(!limite) return 'O texto de “' + rotulo + '” não cabe nesta arte. Escolha outro material para este conteúdo.';
  return 'O texto de “' + rotulo + '” é longo demais para esta arte. Cabem até ' + limite
       + ' caracteres aqui — hoje tem ' + atual + '.';
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
      estrategia: (result.meta && result.meta.politica) || 'padrao',
      nota: (result.meta && result.meta.nota) != null ? result.meta.nota : null,
      tentativas: (result.meta && result.meta.tentativas) || 0,
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
