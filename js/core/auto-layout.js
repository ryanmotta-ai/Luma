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
    10. LAYOUT GRAMMAR     — a leitura ESTRUTURAL da arte autorada (papéis, relações, grupos,
                              hierarquia, assinatura). OBSERVACIONAL: descreve, não decide.

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
  /* ── QUEM RESPONDE "QUAL É O PAPEL DESTA CAMADA" ──────────────────────────────────────────
     Por padrão, `gLayoutRoleOf` — o leitor de sempre, para que esta função continue devolvendo
     exatamente a mesma nota que devolvia. `opts.papel` existe para a AUDITORIA da Fase 6.5
     (§19) rodar a MESMA função com o papel efetivo e medir a diferença, em vez de nascer um
     segundo scorer ao lado (dois scorers = duas verdades, e nenhuma auditável). */
  const papelDe = (opts && opts.papel) || gLayoutRoleOf;
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
    const peso = G_SCORE_PESO_PAPEL[papelDe(l)] != null ? G_SCORE_PESO_PAPEL[papelDe(l)] : 1;
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
    const peso = G_SCORE_PESO_PAPEL[papelDe(l)] != null ? G_SCORE_PESO_PAPEL[papelDe(l)] : 1;
    const linhas = (l._fit.lines && l._fit.lines.length) || 1;
    // Linhas que o texto do franqueado já usaria SEM adaptação: cobrar dele o comprimento do
    // que a pessoa digitou não é avaliar o motor.
    const refLinhas = (l._layoutSemAjuste && l._layoutSemAjuste.linhas)
      || (l.layoutRef && l.layoutRef.linhas) || 1;
    if(linhas > refLinhas) itens.linhas += (linhas - refLinhas) * G_SCORE_PESOS.linhaExtra * peso;
    const teto = gLayoutRoleMaxLines(papelDe(l));
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

/* A REGRA DE TROCA, isolada porque agora tem DOIS leitores: a escolha real (`gLayoutEscolherAlternativa`)
   e a auditoria de papel da §19, que precisa perguntar "com o papel efetivo, o vencedor mudaria?".
   Duplicá-la lá dentro criaria a segunda verdade justamente no lugar onde se quer medir UMA
   diferença. O comportamento é o de sempre: `cands[0]` é a política PADRÃO. */
function _gLayoutMelhorAlternativa(cands){
  const _margem = Math.max(3, cands[0].score.penal * 0.02);
  let melhor = cands[0];
  cands.forEach(c => {
    if(c === cands[0]) return;
    if(c.score.penal < melhor.score.penal - (melhor === cands[0] ? _margem : 0.001)) melhor = c;
  });
  return melhor;
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
  const melhor = _gLayoutMelhorAlternativa(cands);
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
  // O `return nome` do fim punha o nome da variável dentro do diagnóstico que o franqueado LÊ
  // ("A arte não tem espaço seguro para 'precoPor'") — o oposto do que o próprio bloco promete.
  // Motor único de rótulo (00-config.js); `v.name` também era o cru travestido de label.
  if(typeof gFieldLabel === 'function') return gFieldLabel(nome);
  if(typeof dVars !== 'undefined' && Array.isArray(dVars)){
    const v = dVars.find(x => x && x.name === nome);
    if(v && v.label) return v.label;
  }
  return 'este campo';
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

/* ════════════════════════════════════════════════════════════════════
   10. LAYOUT GRAMMAR — a leitura da arte autorada, em estrutura
   ════════════════════════════════════════════════════════════════════
   O solver sabe ACOMODAR: mede, infere corrente, abre corredor e sobe a escada. O que ele não
   tem é uma leitura da COMPOSIÇÃO como um todo — cada inferência dele nasce e morre dentro de
   um solve, carimbada no clone (`_anchorAuto`, `_placa`, `_layoutBase`), e some junto com ele.
   Sem essa leitura, "o que o designer quis dizer" nunca é um objeto que dê para inspecionar,
   comparar entre dois estados ou testar.

   A gramática é esse objeto. Ela responde à filosofia do produto — *o designer cria a intenção;
   o Luma entende a gramática dessa intenção* — descrevendo o que a arte já diz: quem é o quê,
   quem segue quem, quem está dentro de quem, quem se alinha com quem, o que pode ceder e o que
   é intocável. COMPILADA da própria composição: nenhum formulário novo para o designer.

   ⚠ ESTA VERSÃO É OBSERVACIONAL, e isso não é provisório por preguiça — é o contrato desta
   fase. `gCompileLayoutGrammar` NÃO é chamada por `gApplyRelativeAnchors`, não escreve nada nas
   camadas e não muda um pixel de nenhuma arte. Ela só LÊ. Enquanto a leitura não estiver
   provada contra o corpus real, ligá-la no solve seria trocar um motor calibrado por uma
   hipótese.

   As quatro regras que a mantêm honesta:
   · SÓ LÊ O AUTORADO. Nunca os carimbos transitórios do solve (`_placa`, `_anchorAuto`,
     `_fit`, `_tetoFonte`). Ler o resultado do solver faria a gramática descrever a
     acomodação, não a intenção — e as duas coisas divergem exatamente quando importa.
   · NÃO DUPLICA MOTOR. A régua de vizinhança é UMA SÓ e mora em `00-config.js`
     (`gLayoutRelacaoVertical` / `gLayoutRelacaoLateral` / `gLayoutOverlapRatio` /
     `gLayoutLinhaTipografica`) — as mesmas primitivas que `_gInferirCorrentes` chama. Papel,
     visibilidade, fundo, contenção, campo e zona segura também saem das funções que já existem.
     Aqui só se COMPÕE o que já está escrito.
   · PROXIMIDADE É EVIDÊNCIA, NÃO VERDADE. Todo agrupamento inferido carrega `confianca` e
     `evidencia`. O que o designer DECLAROU (grupo, âncora manual) é `certa`; o que a
     composição demonstra com mais de um sinal é `forte`; estar perto, sozinho, é `fraca` — e
     coisa `fraca` NÃO vira componente.
   · NÃO MUTA NADA. Recebe camadas, devolve estrutura nova. IDs e escalares derivados — copiar
     a camada inteira para dentro da gramática criaria a segunda cópia viva do estado, que é
     o bug clássico desta base.

   DUAS ASSINATURAS, DUAS PERGUNTAS:
   · `structuralSignature` — "a estrutura semântica/relacional continua a mesma?". Sem
     geometria e sem conteúdo: papéis, relações, grupos. É ela que separa "o franqueado digitou
     outra coisa" de "a composição mudou".
   · `visual.visualSignature` — "quanto esta solução se afastou da LINGUAGEM VISUAL autorada?".
     Proporções tipográficas, colunas, respiros e bounds, todos normalizados. Derivada e NÃO
     usada pelo solver; existe para a fase em que houver com o que comparar. */

const G_LAYOUT_GRAMMAR_V = 2;
/* A folga é lida de `G_LAYOUT_REL` (00-config.js) DENTRO das funções, nunca copiada para uma
   const daqui: um alias no topo do arquivo seria avaliado na CARGA, e se algum dia uma página
   carregasse este arquivo antes do `00-config.js` o `ReferenceError` levaria junto as outras 45
   funções deste arquivo — em silêncio. Lendo em tempo de chamada, só a gramática quebra. */
/* GRADE DO ÍNDICE ESPACIAL. 24 divisões do maior lado da arte: numa peça 1080×1350 dá células
   de ~56px, que é a ordem de grandeza de uma linha de texto — o vizinho de um bloco cai na
   célula dele ou na de ao lado. Menos divisões e a célula vira a arte inteira (o índice não
   filtra nada); mais e uma camada comum passa a ocupar dezenas de células (o índice custa mais
   que a varredura que ele evita). */
const G_GRAMMAR_GRADE = 24;
/* Camada que cobre mais que isto de células é GRANDE: sangria, painel, moldura. Indexá-la
   célula a célula encheria a grade inteira e o índice deixaria de filtrar. Ela vai para uma
   lista à parte e é candidata de todo mundo — o custo dela é O(n × |grandes|), e `grandes` é
   pequeno por construção, porque só cabem ~12 camadas desse tamanho numa arte antes de ela
   virar outra coisa. Fundo de tela cheia nem chega aqui: `_gCorrenteEhFundo` já o tirou. */
const G_GRAMMAR_CELULAS_MAX = 48;

function _gGramVisivel(l){
  return (typeof _gLayoutVisivel === 'function') ? _gLayoutVisivel(l) : !!(l && l.visible !== false);
}
function _gGramFundo(l, cv){
  if(typeof _gCorrenteEhFundo === 'function') return _gCorrenteEhFundo(l, cv && cv.w ? cv : null);
  return (typeof _gLayoutEhFundoExplicito === 'function') ? _gLayoutEhFundoExplicito(l, cv) : false;
}
function _gGramRect(l){
  return { x: Math.round(l.x||0), y: Math.round(l.y||0), w: Math.round(l.w||0), h: Math.round(l.h||0) };
}
/* Hash determinístico (FNV-1a 32 bits) de uma forma canônica. Serve para responder "isto
   continua sendo a mesma coisa?" — e é usado duas vezes, sobre duas formas canônicas
   diferentes (a estrutural e a visual). */
function _gGramHash(s){
  let h = 0x811c9dc5;
  const t = String(s);
  for(let i = 0; i < t.length; i++){ h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return ('0000000' + h.toString(16)).slice(-8);
}
// Normaliza uma medida pelo lado de referência e trunca em 3 casas: a assinatura visual precisa
// ser estável contra ruído de subpixel e sensível a deslocamento que um designer enxergaria.
function _gGramNorm(v, base){
  return Math.round((v / Math.max(1, base)) * 1000) / 1000;
}

/* ── ÍNDICE ESPACIAL ──────────────────────────────────────────────────────────────────────
   A versão 1 desta gramática cortava a análise nas 60 primeiras camadas. Era um teto CEGO:
   medido numa arte sintética, 70, 172 e 344 camadas produziam exatamente as mesmas 864
   relações, e a camada 342 saía com zero. Para observação inicial passava; como base do
   designer automático, seria uma leitura que mente em silêncio justamente nas artes grandes
   (PSD de agência tem 300 camadas com facilidade).

   A troca é uma GRADE UNIFORME: cada camada entra nas células que o retângulo dela cobre, e a
   busca por vizinho consulta só as células da FAIXA onde o vizinho poderia estar. Uniforme, e
   não quadtree/R-tree, porque a arte é um retângulo pequeno com elementos de tamanho parecido —
   o caso em que grade ganha de árvore e cabe em 40 linhas sem dependência nenhuma.

   Determinismo: a consulta devolve os índices ORDENADOS. Sem isso a ordem de visita dependeria
   da ordem de inserção no `Set`, e um empate de desempate (dois pais com o mesmo pé) escolheria
   diferente entre execuções — que é exatamente o tipo de não-determinismo que este projeto não
   aceita, porque prévia e exportação chamam o mesmo motor. */
function _gGramIndice(itens){
  if(!itens.length) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  itens.forEach(o => { x1 = Math.min(x1, o.r.x); y1 = Math.min(y1, o.r.y);
                       x2 = Math.max(x2, o.r.x + o.r.w); y2 = Math.max(y2, o.r.y + o.r.h); });
  const celula = Math.max(16, Math.round(Math.max(1, Math.max(x2 - x1, y2 - y1)) / G_GRAMMAR_GRADE));
  const col = (x) => Math.floor((x - x1) / celula);
  const lin = (y) => Math.floor((y - y1) / celula);
  const celulas = new Map();
  const grandes = [];
  itens.forEach((o, i) => {
    const c1 = col(o.r.x), c2 = col(o.r.x + Math.max(0, o.r.w));
    const l1 = lin(o.r.y), l2 = lin(o.r.y + Math.max(0, o.r.h));
    if((c2 - c1 + 1) * (l2 - l1 + 1) > G_GRAMMAR_CELULAS_MAX){ grandes.push(i); return; }
    for(let c = c1; c <= c2; c++) for(let l = l1; l <= l2; l++){
      const k = c + ',' + l;
      if(!celulas.has(k)) celulas.set(k, []);
      celulas.get(k).push(i);
    }
  });
  return {
    celula: celula, grandes: grandes,
    /* Candidatos que PODEM tocar este retângulo. É um filtro, não uma resposta: quem chama
       ainda aplica a régua espacial de verdade. Falso positivo aqui só custa uma comparação;
       falso NEGATIVO seria a leitura mentindo — por isso a faixa consultada é sempre a maior
       que a régua consegue alcançar, nunca a justa. */
    consulta: function(rect){
      const vistos = new Set(grandes);
      const c1 = col(rect.x), c2 = col(rect.x + Math.max(0, rect.w));
      const l1 = lin(rect.y), l2 = lin(rect.y + Math.max(0, rect.h));
      for(let c = c1; c <= c2; c++) for(let l = l1; l <= l2; l++){
        const lista = celulas.get(c + ',' + l);
        if(lista) for(let k = 0; k < lista.length; k++) vistos.add(lista[k]);
      }
      return [...vistos].sort((a, b) => a - b);
    }
  };
}

/**
 * Compila a GRAMÁTICA da composição autorada. Puro e determinístico: as mesmas camadas
 * devolvem sempre a mesma estrutura, e nenhuma camada é modificada.
 *
 * @param {Array} layers  camadas do template (autoradas — não o resultado de um solve)
 * @param {{w:number,h:number}} [canvas]
 * @returns {{version:number, canvas:object, nodes:Array, relations:Array, groups:Array,
 *            hierarchy:Array, visual:object, structuralSignature:string}}
 */
function gCompileLayoutGrammar(layers, canvas){
  const lista = (layers || []).filter(l => l && l.id != null);
  const cv = { w: (canvas && canvas.w) || 0, h: (canvas && canvas.h) || 0 };

  /* HIERARQUIA TIPOGRÁFICA — a declaração de importância do designer, e a mesma receita de
     `gCompileLayoutRoles`: os corpos distintos das camadas de texto visíveis, do maior para o
     menor. O índice nessa lista é o DEGRAU (0 = o maior da arte). */
  const corpos = [...new Set(lista.filter(l => l.type === 'text' && _gGramVisivel(l))
                                  .map(l => Math.round(l.fontSize || 24)))].sort((a,b) => b - a);
  const hierarchy = corpos.map((fs, i) => ({
    degrau: i, fontSize: fs,
    ids: lista.filter(l => l.type === 'text' && _gGramVisivel(l) && Math.round(l.fontSize||24) === fs)
              .map(l => l.id)
  }));
  const ctxPapel = { canvas: cv.w ? cv : null, degraus: corpos };

  // ── NÓS ──
  const nodes = lista.map(l => {
    /* Papel já compilado vence: importação e vínculo carimbam na origem, e `layoutRoleManual`
       é a palavra do designer. Só quem não tem passa pelo compilador — que é PURO, então
       consultar aqui não escreve nada em lugar nenhum. */
    const papel = l.layoutRoleManual || l.layoutSemantic
                || ((typeof gLayoutSemanticRole === 'function') ? gLayoutSemanticRole(l, ctxPapel) : 'apoio');
    const campos = (typeof gLayoutCamposDe === 'function') ? gLayoutCamposDe(l) : [];
    const fundo = l.type !== 'group' && _gGramFundo(l, cv);
    const protegida = !!(l.locked || l.lockPosition || l.layoutRole === 'protected' || papel === 'protegida');
    /* A caixa do ASSUNTO — rosto, produto, logo dentro da foto. A contagem sozinha diz que a
       proteção existe; o retângulo diz ONDE, e é dele que sai o `bounds.seguro` de um
       componente. Sai de `gLayoutSafeZones`, o motor único — não de uma segunda leitura. */
    const zonasRects = (typeof gLayoutSafeZones === 'function') ? gLayoutSafeZones(l) : [];
    const zonas = zonasRects.length;
    let safeRect = null;
    if(zonas){
      let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;
      zonasRects.forEach(z => { a=Math.min(a,z.x); b=Math.min(b,z.y);
                                c=Math.max(c,z.x+z.w); d=Math.max(d,z.y+z.h); });
      if(isFinite(a)) safeRect = { x:Math.round(a), y:Math.round(b),
                                   w:Math.round(c-a), h:Math.round(d-b) };
    }
    const degrau = (l.type === 'text' && _gGramVisivel(l)) ? corpos.indexOf(Math.round(l.fontSize || 24)) : null;
    return {
      id: l.id, tipo: l.type || 'text', papel: papel,
      visivel: _gGramVisivel(l), paiId: l.parentId || null,
      campos: campos,
      /* FLEXIBILIDADE PROVÁVEL — o que este nó pode ceder quando o conteúdo real chegar.
         'rigida'   = não cede nem posição nem tamanho (protegida, travada, fundo);
         'dinamica' = carrega campo, então É a fonte da variação;
         'fixa'     = não varia sozinha, mas acompanha (empurrada, escalada). */
      flex: (protegida || fundo) ? 'rigida' : (campos.length ? 'dinamica' : 'fixa'),
      protegida: protegida,
      // Decorativa é o que não carrega informação nem campo: ornamento, textura, selo de fundo.
      decorativa: !campos.length && (papel === 'decoracao' || fundo),
      fundo: !!fundo,
      degrau: degrau != null && degrau >= 0 ? degrau : null,
      fontSize: l.type === 'text' ? Math.round(l.fontSize || 24) : null,
      /* Três fatos TIPOGRÁFICOS, porque três degraus da escada dependem deles e não existe
         outro lugar onde eles caibam: a entrelinha (piso 1.05), o tracking devolvido (só fonte
         display) e o tracking autorado. `display` usa a MESMA régua do `gFitTextLayer` e do
         render — inclusive o fallback por NOME quando `dTextFontParts` não carregou, que é o
         caso das páginas de teste. Uma régua paralela aqui desligaria o degrau em silêncio
         justamente onde a medida considera a fonte display. */
      lineHeight: l.type === 'text'
        ? ((typeof gLineHeightDe === 'function') ? gLineHeightDe(l) : (l.lineHeight || 1.2)) : null,
      letterSpacing: l.type === 'text' && l.letterSpacing != null ? l.letterSpacing : null,
      // A régua única (`gLayoutEhDisplay`, em 00-config.js) — esta linha reimplementava o
      // mesmo teste do solver, que é exatamente a duplicação que as fases anteriores mataram.
      display: l.type === 'text' && typeof gLayoutEhDisplay === 'function' ? gLayoutEhDisplay(l) : false,
      align: l.type === 'text' ? (l.textAlign || 'left') : null,
      zonasSeguras: zonas, safeRect: safeRect,
      rect: _gGramRect(l)
    };
  });
  const porId = new Map(nodes.map(n => [n.id, n]));
  const _n = (id) => porId.get(id) || null;

  /* Quem participa das relações espaciais: visível, não-grupo, não-fundo. A mesma poda que a
     cascata faz antes de inferir corrente — um fundo de tela cheia "termina" no rodapé e
     adotaria a arte inteira. Sem teto: é o índice espacial que segura o custo, não um corte. */
  const palco = [];
  lista.forEach((l, z) => {
    if(l.type === 'group' || !_gGramVisivel(l) || _gGramFundo(l, cv)) return;
    palco.push({ l: l, r: _gGramRect(l), z: z });
  });
  const idx = _gGramIndice(palco);
  const relations = [];

  // ── DEPENDÊNCIA AUTORADA ── a âncora que o designer marcou à mão é declaração explícita, e
  // vence qualquer leitura geométrica (é a mesma precedência do solver). `certa` por definição.
  const comAncora = new Set();
  lista.forEach(l => {
    const a = l.relativeAnchor;
    if(!a || !a.layerId || !_n(a.layerId)) return;
    comAncora.add(l.id);
    relations.push({ tipo:'ancora-autoral', de:l.id, para:a.layerId,
                     eixo:a.type || 'top-to-bottom', autorada:true, confianca:'certa' });
  });

  /* ── VIZINHANÇA PROVÁVEL ── "este bloco segue aquele". `de` é quem segue, `para` é quem
     manda — a mesma direção filho→pai da cascata, medida pela MESMA primitiva
     (`gLayoutRelacaoVertical` / `gLayoutRelacaoLateral`, em `00-config.js`).
     `confianca:'fraca'`: estar perto é evidência de que um segue o outro, não prova. */
  const maiorCorpo = corpos.length ? corpos[0] : 16;
  // Alcance máximo que a régua pode ter para ESTA camada: o vizinho pode ser o maior corpo da
  // arte, então a faixa consultada usa esse limite superior. Consultar a faixa justa produziria
  // falso negativo — o índice pode devolver demais, nunca de menos.
  const alcance = (o, eixo) => gLayoutLinhaTipografica({ fontSize: maiorCorpo }, o.l)
                             * (eixo === 'v' ? G_LAYOUT_REL.alcanceV : G_LAYOUT_REL.alcanceH)
                             + G_LAYOUT_REL.tol;
  const temPaiV = new Set();
  palco.forEach((B, iB) => {
    if(comAncora.has(B.l.id)) return;                 // dependência declarada já existe
    const alc = alcance(B, 'v');
    const faixa = { x:B.r.x, y:B.r.y - alc, w:Math.max(1, B.r.w), h:alc + G_LAYOUT_REL.tol };
    let pai = null, fundoPai = -Infinity;
    idx.consulta(faixa).forEach(iA => {
      if(iA === iB) return;
      const A = palco[iA];
      const rel = gLayoutRelacaoVertical(A.r, B.r, A.l, B.l);
      if(rel && rel.fundo > fundoPai){ fundoPai = rel.fundo; pai = A; }   // o vizinho imediato
    });
    if(!pai) return;
    temPaiV.add(B.l.id);
    relations.push({ tipo:'abaixo-de', de:B.l.id, para:pai.l.id,
                     gap: Math.round(B.r.y - fundoPai), confianca:'fraca' });
  });
  palco.forEach((B, iB) => {
    if(comAncora.has(B.l.id) || temPaiV.has(B.l.id)) return;   // um pai automático só
    const alc = alcance(B, 'h');
    const faixa = { x:B.r.x - alc, y:B.r.y, w:alc + G_LAYOUT_REL.tol, h:Math.max(1, B.r.h) };
    let pai = null, direitaPai = -Infinity;
    idx.consulta(faixa).forEach(iA => {
      if(iA === iB) return;
      const A = palco[iA];
      if(A.l.type !== 'text') return;                 // só texto cresce com o que se digita
      const rel = gLayoutRelacaoLateral(A.r, B.r, A.l, B.l);
      if(rel && rel.direita > direitaPai){ direitaPai = rel.direita; pai = A; }
    });
    if(!pai) return;
    relations.push({ tipo:'direita-de', de:B.l.id, para:pai.l.id,
                     gap: Math.round(B.r.x - direitaPai), confianca:'fraca' });
  });

  /* ── CONTENÇÃO E SOBREPOSIÇÃO ── as duas são INTENCIONAIS por definição: estão na arte que o
     designer publicou. É o que impede a fase seguinte de ler "texto sobre a placa" como
     colisão a resolver — o solver já trata assim (`_gRectContem` libera o par), e aqui a
     intenção vira registro explícito em vez de efeito colateral de um `return`. */
  const placas = new Map();   // shape → [ids de texto contidos], para reconhecer o componente
  const _contem = (a, b) => (typeof _gRectContem === 'function') ? _gRectContem(a, b, G_LAYOUT_REL.tol) : false;
  const _podeConter = (o) => o.l.type === 'shape' || o.l.type === 'image' || o.l.type === 'frame';
  palco.forEach((A, iA) => {
    idx.consulta(A.r).forEach(iB => {
      if(iB <= iA) return;                            // cada par uma vez só
      const B = palco[iB];
      // Contenção nas duas direções: o continente pode estar antes ou depois na lista, e quem
      // manda é o z-order (o fundo tem que estar ATRÁS), não a ordem em que o par foi visitado.
      let dentro = null, fora = null;
      if(_podeConter(A) && B.l.type === 'text' && A.z < B.z && _contem(A.r, B.r)){ fora = A; dentro = B; }
      else if(_podeConter(B) && A.l.type === 'text' && B.z < A.z && _contem(B.r, A.r)){ fora = B; dentro = A; }
      if(fora){
        relations.push({ tipo:'dentro-de', de:dentro.l.id, para:fora.l.id,
                         intencional:true, confianca:'forte' });
        if(!placas.has(fora.l.id)) placas.set(fora.l.id, []);
        placas.get(fora.l.id).push(dentro.l.id);
        return;
      }
      const inter = (typeof _gRectIntersecao === 'function') ? _gRectIntersecao(A.r, B.r) : 0;
      if(inter > 0) relations.push({ tipo:'sobrepoe', de:A.l.id, para:B.l.id,
                                     intencional:true, area:Math.round(inter), confianca:'forte' });
    });
  });

  /* ── ALINHAMENTO: COLUNAS, NÃO PARES ────────────────────────────────────────────────────
     A v1 emitia uma relação por PAR alinhado. Numa arte com 40 blocos na mesma margem isso são
     780 fatos dizendo a mesma coisa — e é O(n²) por natureza, não por implementação.
     Alinhamento é uma COLUNA: um fato com vários membros. Sai por ordenação + varredura, é
     linear na saída e descreve melhor o que o designer fez.
     ⚠ O agrupamento é por ENCADEAMENTO simples (arestas a 1px de distância entram na mesma
     coluna mesmo que as pontas estejam a 4px). É a diferença assumida em relação ao par a par
     da v1: uma coluna é uma corrente, e separar "quase a mesma margem" em duas colunas seria
     descrever uma intenção que ninguém teve. */
  const EIXOS = [['alinha-esquerda','esquerda'], ['alinha-direita','direita'],
                 ['alinha-centro','centro'], ['alinha-topo','topo'], ['alinha-meio','meio']];
  const aresta = (o, campo) => campo === 'esquerda' ? o.r.x
                             : campo === 'direita'  ? o.r.x + o.r.w
                             : campo === 'centro'   ? o.r.x + o.r.w / 2
                             : campo === 'meio'     ? o.r.y + o.r.h / 2
                             : o.r.y;
  EIXOS.forEach(([tipo, campo]) => {
    const ord = palco.map((o, i) => ({ v: aresta(o, campo), id: o.l.id, i }))
                     .sort((a, b) => a.v - b.v || a.i - b.i);
    let atual = [];
    const fecha = () => {
      if(atual.length >= 2) relations.push({ tipo: tipo, membros: atual.map(o => o.id),
        valor: Math.round(atual[0].v), confianca:'forte' });
      atual = [];
    };
    ord.forEach(o => {
      if(atual.length && Math.abs(o.v - atual[atual.length - 1].v) > G_LAYOUT_REL.tol) fecha();
      atual.push(o);
    });
    fecha();
  });

  /* ── DEPENDÊNCIA DINÂMICA AUTORIZADA ────────────────────────────────────────────────────
     Até aqui a gramática só sabia dizer que B está perto de A. Isso é GEOMETRIA, e continua
     valendo o que vale: `abaixo-de` segue `fraca`, e nada nesta seção a promove.

     O que entra agora é a outra pergunta, respondida pela MESMA regra que o solver usa
     (`gLayoutDependencyAuthorization`, em `00-config.js`): "o crescimento de um campo pode
     chegar até aqui por esta cadeia?". A resposta vira uma relação PRÓPRIA, separada — assim a
     leitura visual continua honesta (a vizinhança é fraca) e a dependência operacional fica
     explícita, sem a gramática ter que mentir sobre a confiança da geometria.

     ⚠ O que a gramática NÃO pode avaliar, e é correto que não avalie: o `vazio` e o
     `colapsoDeCampo`. Os dois dependem de INTERPOLAR o conteúdo do franqueado, e a gramática lê
     a arte AUTORADA, onde nenhum campo está em branco ainda. A exceção do campo opcional vazio
     é de runtime e continua vivendo só no solver — declarada aqui como `false`, não esquecida. */
  const placaAlvoDe = new Map();
  placas.forEach((textos, contId) => {
    const c = lista.find(l => l.id === contId);
    if(c && c.type === 'shape' && textos.length === 1) placaAlvoDe.set(contId, textos[0]);
  });
  const paiInferido = new Map();
  relations.forEach(r => {
    if(r.tipo !== 'abaixo-de' && r.tipo !== 'direita-de') return;
    if(!paiInferido.has(r.de)) paiInferido.set(r.de, r.para);
  });
  const fatos = lista.map(l => {
    const f = gLayoutFatoDependencia(l);
    if(!f) return null;
    // A gramática não gateia o candidato antes de criá-lo (o solver gateia, em
    // `_gCorrenteMovivel`), então a proteção é aplicada AQUI — pela mesma primitiva.
    if(placaAlvoDe.has(l.id)) f.placaAlvo = placaAlvoDe.get(l.id);
    return f;
  }).filter(Boolean);
  const fatoPorId = new Map(fatos.map(f => [f.id, f]));
  const _fatoDe = (id) => fatoPorId.get(id) || null;
  fatos.forEach(f => {
    f.elegivel = gLayoutPodeAcompanhar(f, _fatoDe);
    const l = lista.find(x => x.id === f.id);
    const manual = l && l.relativeAnchor && l.relativeAnchor.layerId;
    /* Espelha o solver ao pé da letra: a âncora MANUAL vale mesmo em camada que não pode ser
       empurrada (ela não ganha corrente, mas continua propagando autorização para os filhos);
       a inferida só vale para quem passa nas proteções. */
    f.anchor = manual ? { layerId:l.relativeAnchor.layerId, autorada:true }
             : (f.elegivel && paiInferido.has(f.id)
                ? { layerId:paiInferido.get(f.id), autorada:false } : null);
  });
  /* PUBLICA a resposta da fonte única no nó. "Esta camada pode ser empurrada?" tem UMA
     resposta (`gLayoutPodeAcompanhar`), e ela já foi calculada aqui — inclusive a subida pela
     cadeia de ancestrais, que é o que faz um filho de GRUPO TRAVADO ser imóvel mesmo sem estar
     travado ele próprio. Sem publicar, quem lê a gramática teria que refazer essa subida e
     erraria exatamente nesse caso. */
  fatos.forEach(f => { const n = porId.get(f.id); if(n) n.podeAcompanhar = f.elegivel; });
  (gram_nodes_sem_fato => gram_nodes_sem_fato.forEach(n => {
    if(n.podeAcompanhar == null) n.podeAcompanhar = false;   // grupo/oculto: não entra em corrente
  }))(nodes);
  const autorizacao = gLayoutDependencyAuthorization(fatos);
  fatos.forEach(f => {
    const r = autorizacao.get(f.id);
    if(!r || !r.autorizado || !f.anchor) return;      // raiz não depende de ninguém
    relations.push({ tipo:'dependencia-dinamica', de:f.id, para:f.anchor.layerId,
                     raiz:r.raizId, motivo:r.motivo, confianca:r.confianca,
                     autorada:f.anchor.autorada, autorizada:true });
  });

  /* ── GRUPOS: CONFIANÇA E EVIDÊNCIA ──────────────────────────────────────────────────────
     A v1 criava um `bloco` sempre que duas coisas estavam perto — e tratava isso com a mesma
     autoridade de um grupo que o designer criou à mão. Proximidade é EVIDÊNCIA: numa arte densa,
     tudo está perto de alguma coisa, e promover isso a estrutura é como o automatismo começa a
     inventar intenção que ninguém teve.

     Quatro níveis DISCRETOS, não porcentagem: não existe base quantitativa aqui para dizer
     "0,73 de confiança", e um float inventado convida a aritmética que ninguém validou.
       · `certa`    — o designer DECLAROU (grupo/pasta, âncora manual). Não é inferência.
       · `forte`    — a composição demonstra com mais de um sinal independente (contenção +
                      z-order + texto único).
       · `provavel` — proximidade MAIS um sinal semântico (papel de preço num par lateral).
       · `fraca`    — só proximidade.
     ⛔ `componente` só é preenchido em `certa`/`forte`. O que é `provavel`/`fraca` guarda o
     padrão reconhecido em `padrao` e fica como observação — nesta fase NADA é operacional, e
     quando algo for, vai ser esta linha que decide o que pode entrar. */
  const groups = [];
  const marcaDinamico = (ids) => ids.some(id => { const n = _n(id); return !!(n && n.campos.length); });
  const grupo = (o) => Object.assign({ componente:null, padrao:null }, o);

  // 1) Grupo AUTORAL: a pasta que o designer (ou o PSD) criou. Intenção declarada, não inferida.
  lista.filter(l => l.type === 'group').forEach(g => {
    const membros = lista.filter(l => l.parentId === g.id).map(l => l.id);
    if(!membros.length) return;
    groups.push(grupo({ id:'g:'+g.id, motivo:'grupo-autoral', componente:'grupo',
      membros:membros, dinamico:marcaDinamico(membros),
      confianca:'certa', evidencia:['grupo-autoral'] }));
  });

  /* 2) PLACA: a forma sólida com UM texto em cima. É o componente mais reconhecível de uma arte
     de promo e o que mais estraga quando a copy cresce (a cor sai debaixo da letra). Três sinais
     independentes — contenção, z-order e um texto só — então `forte`. Um texto só pela mesma
     razão da cascata: com dois, crescer por causa de um seria arbitrário. */
  placas.forEach((textos, shapeId) => {
    const n = _n(shapeId);
    if(!n || n.tipo !== 'shape' || textos.length !== 1) return;
    /* A MESMA régua estrutural do solver (`gLayoutFormaEhPlaca`, em 00-config.js): forma
       retangular ou pill horizontal, e no máximo 6× a área do texto. Sem ela a gramática
       reconhecia como placa um painel de seção inteira — e a §12 montava um componente
       prometendo uma relação que a cascata se recusa a executar. */
    const formaL = lista.find(l => l.id === shapeId);
    const alvoN = _n(textos[0]);
    if(typeof gLayoutFormaEhPlaca === 'function'
       && !gLayoutFormaEhPlaca(formaL, n.rect, alvoN && alvoN.rect)) return;
    const membros = [shapeId, textos[0]];
    const evid = ['contencao','z-order','texto-unico'];
    if(marcaDinamico(membros)) evid.push('campo-dinamico');
    groups.push(grupo({ id:'p:'+shapeId, motivo:'placa', componente:'placa',
      membros:membros, dinamico:marcaDinamico(membros), confianca:'forte', evidencia:evid }));
  });

  /* 3) AGLOMERADO por PROXIMIDADE: a pilha que se LÊ como uma coisa só (título → subtítulo →
     CTA). Componentes conexos das relações de vizinhança. É a observação mais útil da gramática
     e a menos confiável — por isso sai `fraca` e sem `componente`. */
  const vizinhos = new Map();
  const arestasViz = relations.filter(r => r.tipo === 'abaixo-de' || r.tipo === 'direita-de'
                                        || r.tipo === 'ancora-autoral');
  arestasViz.forEach(r => {
    if(!vizinhos.has(r.de)) vizinhos.set(r.de, []);
    if(!vizinhos.has(r.para)) vizinhos.set(r.para, []);
    vizinhos.get(r.de).push(r.para); vizinhos.get(r.para).push(r.de);
  });
  const visto = new Set();
  [...vizinhos.keys()].sort().forEach(raiz => {
    if(visto.has(raiz)) return;
    const fila = [raiz], membros = [];
    visto.add(raiz);
    while(fila.length){
      const id = fila.shift(); membros.push(id);
      (vizinhos.get(id) || []).forEach(v => { if(!visto.has(v)){ visto.add(v); fila.push(v); } });
    }
    if(membros.length < 2) return;
    membros.sort();
    const dentro = (r) => membros.indexOf(r.de) >= 0 && membros.indexOf(r.para) >= 0;
    const evid = ['proximidade'];
    let confianca = 'fraca', padrao = 'bloco', componente = null;
    /* AUTORIDADE DO DECLARADO. Se o que segura este aglomerado é uma âncora que o designer
       marcou à mão, ele deixa de ser heurística: vira estrutura declarada, como o grupo. */
    if(arestasViz.some(r => r.tipo === 'ancora-autoral' && dentro(r))){
      confianca = 'certa'; componente = 'grupo'; padrao = null; evid.push('ancora-autoral');
    }else if(membros.length === 2 && arestasViz.some(r => r.tipo === 'direita-de' && dentro(r))
             && membros.some(id => { const n = _n(id); return n && n.papel === 'preco'; })){
      /* PAR DE PREÇO ("De R$ 149,90 / por R$ 109,90"): proximidade lateral MAIS o papel de
         preço. Dois sinais, mas um deles é heurístico — `provavel`, e ainda não é componente.
         É o candidato mais forte a virar operacional na fase seguinte, porque carrega a regra
         de domínio mais dura do motor (`_gLayoutBlocoPrecoFixo`). */
      confianca = 'provavel'; padrao = 'par-de-preco'; evid.push('papel-preco');
    }
    groups.push(grupo({ id:'b:'+membros[0], motivo:'proximidade', componente:componente,
      padrao:padrao, membros:membros, dinamico:marcaDinamico(membros),
      confianca:confianca, evidencia:evid }));
  });

  /* ── ASSINATURA ESTRUTURAL ── a estrutura, sem geometria e sem conteúdo. Duas artes com a
     mesma assinatura têm a mesma gramática, ainda que o texto (e portanto o tamanho da tinta)
     seja outro. É a pergunta "a composição mudou?" isolada da pergunta "o conteúdo mudou?".
     `confianca` fica de FORA de propósito: recalibrar um nível é mudar a leitura, não a
     composição, e não pode parecer que a arte mudou. */
  const canon = [
    'v' + G_LAYOUT_GRAMMAR_V,
    nodes.map(n => [n.id, n.tipo, n.papel, n.flex, n.degrau, n.protegida?1:0, n.decorativa?1:0].join(':'))
         .sort().join('|'),
    relations.map(r => [r.tipo, r.de || '', r.para || '', (r.membros||[]).slice().sort().join('+')].join(':'))
         .sort().join('|'),
    groups.map(g => [g.motivo, g.componente||'', g.padrao||'', g.membros.slice().sort().join('+')].join(':'))
         .sort().join('|')
  ].join('#');

  /* ── REPRESENTAÇÃO VISUAL ── a LINGUAGEM do desenho, normalizada: as proporções entre os
     degraus tipográficos, onde estão as colunas, que respiros existem e que área cada
     aglomerado ocupa. Tudo relativo ao lado curto da arte, para que a mesma peça em Feed e em
     Story tenha a mesma linguagem.
     ⛔ NÃO entra conteúdo — nem texto, nem nome de campo. E ela NÃO é lida pelo solver: existe
     para a fase em que houver duas composições para comparar, e a pergunta for "quanto esta
     solução se afastou do que o designer desenhou?". Hoje ela só descreve. */
  const curto = Math.max(1, cv.w && cv.h ? Math.min(cv.w, cv.h)
    : (palco.length ? Math.max(...palco.map(o => Math.max(o.r.w, o.r.h))) : 1));
  const base = corpos.length ? corpos[0] : 1;
  const visual = {
    // Proporções tipográficas: o degrau mais alto é 1, os outros são frações dele.
    degraus: corpos.map(fs => _gGramNorm(fs, base)),
    // As colunas do desenho, com quantos blocos cada uma segura.
    colunas: relations.filter(r => r.membros && r.tipo.indexOf('alinha') === 0)
      .map(r => ({ eixo:r.tipo.slice(7), valor:_gGramNorm(r.valor, curto), n:r.membros.length }))
      .sort((a,b) => a.eixo < b.eixo ? -1 : a.eixo > b.eixo ? 1 : a.valor - b.valor),
    // Os respiros que existem entre vizinhos, normalizados e ordenados (a ordem da lista não
    // pode carregar informação — duas artes iguais em respiro têm a mesma linguagem).
    gaps: relations.filter(r => r.gap != null).map(r => _gGramNorm(r.gap, curto)).sort((a,b) => a - b),
    // A área que cada aglomerado ocupa: é o "peso" visual de cada bloco na página.
    clusters: groups.map(g => {
      let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
      g.membros.forEach(id => { const n = _n(id); if(!n) return;
        a = Math.min(a, n.rect.x); b = Math.min(b, n.rect.y);
        c = Math.max(c, n.rect.x + n.rect.w); d = Math.max(d, n.rect.y + n.rect.h); });
      if(!isFinite(a)) return null;
      return { x:_gGramNorm(a, curto), y:_gGramNorm(b, curto),
               w:_gGramNorm(c - a, curto), h:_gGramNorm(d - b, curto) };
    }).filter(Boolean).sort((p,q) => p.x - q.x || p.y - q.y || p.w - q.w || p.h - q.h)
  };
  visual.visualSignature = _gGramHash(JSON.stringify([visual.degraus, visual.colunas,
                                                      visual.gaps, visual.clusters]));

  return { version: G_LAYOUT_GRAMMAR_V, canvas: cv, nodes, relations, groups, hierarchy,
           visual: visual, structuralSignature: _gGramHash(canon) };
}

/* Consultas de conveniência — existem para que quem ler a gramática não precise refazer o
   mesmo `filter` em cinco lugares (o começo de toda duplicação nesta base). */
function gGrammarNode(gram, id){
  return (gram && gram.nodes || []).find(n => n && n.id === id) || null;
}
// `id` casa tanto com relação de par (`de`/`para`) quanto com relação de coluna (`membros`).
function gGrammarRelations(gram, tipo, id){
  return (gram && gram.relations || []).filter(r => r && (!tipo || r.tipo === tipo)
    && (!id || r.de === id || r.para === id || (r.membros && r.membros.indexOf(id) >= 0)));
}

/* ════════════════════════════════════════════════════════════════════
   11. COMPOSITION GRAPH — a gramática virando rede navegável
   ════════════════════════════════════════════════════════════════════
   A §10 responde "o que esta arte diz". Ela devolve listas: nós, relações, grupos. Isso basta
   para descrever, mas não para PERGUNTAR — "quem depende deste título?", "qual campo é a origem
   desta cadeia?", "estes dois estão no mesmo bloco?" viram varredura manual na lista, e cada
   consumidor escreveria a sua. Duas varreduras da mesma lista com regras ligeiramente
   diferentes é como nascem as duas verdades desta base.

   O Graph é a rede: os mesmos fatos, indexados por nó e por tipo, com UMA API de leitura.

   ⚠ NÃO É UMA SEGUNDA ANÁLISE. `gCompileCompositionGraph` recebe a GRAMÁTICA, não as camadas.
   Ele não remede nada, não consulta o índice espacial e não reabre um `layer` sequer — tudo o
   que ele sabe veio da §10, que já pagou por essa leitura. Por isso o custo dele é proporcional
   ao número de RELAÇÕES, não ao de camadas ao quadrado.

   A única geometria que ele calcula está no fluxo de leitura, e está justificada lá embaixo: é
   uma varredura 1D sobre os `rect` que a própria gramática publica, sem limiar novo.

   ⚠ CONTINUA OBSERVACIONAL. `gApplyRelativeAnchors` não conhece este arquivo. Nada aqui muda
   pixel, escolhe candidato, pontua ou persiste. O Graph organiza o entendimento; usá-lo para
   adaptar é a fase seguinte, e ela começa decidindo o que desta rede é forte o bastante.

   ── A ORDEM DE AUTORIDADE, EM UM LUGAR SÓ ──
   O erro que este bloco existe para evitar: cada consumidor comparar `edge.confianca === 'forte'`
   na mão, com a sua própria ideia do que isso autoriza. A força mora em `gGraphRelationStrength`
   e o corte em `gGraphIsStructural`. Quem consome pergunta; não interpreta string. */

const G_GRAPH_V = 1;
/* Os quatro níveis da §10, agora ordenáveis. `certa` é declaração do designer; `forte` é
   composição demonstrada por mais de um sinal; `provavel` é inferência com um sinal semântico;
   `fraca` é proximidade e nada mais. */
const G_GRAPH_FORCA = { certa:3, forte:2, provavel:1, fraca:0 };
// O corte do que pode MONTAR ESTRUTURA. Abaixo daqui a relação é consultável como evidência,
// mas não forma cluster, não é atravessada por busca de raiz e não responde `hasStrongRelation`.
const G_GRAPH_MIN_ESTRUTURAL = G_GRAPH_FORCA.forte;

function gGraphRelationStrength(edge){
  const f = G_GRAPH_FORCA[(edge && edge.confianca) || ''];
  return f != null ? f : 0;
}
function gGraphIsStructural(edge){
  return gGraphRelationStrength(edge) >= G_GRAPH_MIN_ESTRUTURAL;
}

/* ARESTAS DE DEPENDÊNCIA — o subconjunto que significa "este nó ACOMPANHA aquele". É por elas
   que se sobe até a raiz dinâmica e se listam ancestrais; alinhamento e sobreposição descrevem
   a arte mas não dizem quem segue quem, então ficam de fora da subida.
   `plate-of` entra porque a placa é quem acompanha o texto, não o contrário (é exatamente o que
   `_seguirPlacas` faz no solver). */
/* ⚠ SÓ DEPENDÊNCIA DE VERDADE. Até a Fase 2 esta lista carregava `below`, `right-of` e
   `inside` — geometria travestida de dependência. `below` e `right-of` são VIZINHANÇA: quem
   autoriza a propagação é `dynamic-dependency`, que a §10 só emite quando a regra única do
   solver diz sim. `inside` saiu porque contenção não faz o texto acompanhar a foto: o solver
   nunca encadeou isso, e mantê-lo aqui inventava cadeia que o motor não tem.
   O que sobra são os três elos que o solver de fato propaga: a âncora que o designer marcou, a
   placa que segue o texto (`_seguirPlacas`) e a corrente autorizada. */
const G_GRAPH_DEPENDENCIA = ['authorial-anchor','plate-of','dynamic-dependency'];

/* Tradução §10 → aresta, com a INVERSA quando ela tem nome próprio. A inversa existe para que
   navegar "quem está acima de mim" não exija varrer a lista inteira ao contrário. */
const G_GRAPH_MAPA_RELACAO = {
  'ancora-autoral':  { tipo:'authorial-anchor', inversa:null },
  /* A aresta que separa as duas perguntas. A MESMA vizinhança aparece duas vezes no grafo:
     `below` com a confiança da geometria (fraca, honesta) e `dynamic-dependency` com a
     confiança da AUTORIZAÇÃO (forte, ou certa quando a cadeia é toda declarada). Nenhuma
     relação foi promovida — são fatos diferentes sobre o mesmo par. */
  'dependencia-dinamica': { tipo:'dynamic-dependency', inversa:null },
  'abaixo-de':       { tipo:'below',            inversa:'above' },
  'direita-de':      { tipo:'right-of',         inversa:'left-of' },
  'dentro-de':       { tipo:'inside',           inversa:'contains' },
  'sobrepoe':        { tipo:'overlaps-intentionally', inversa:'overlaps-intentionally' },
  'alinha-esquerda': { tipo:'aligned-left',     inversa:'aligned-left',     cadeia:true },
  'alinha-direita':  { tipo:'aligned-right',    inversa:'aligned-right',    cadeia:true },
  'alinha-centro':   { tipo:'aligned-center-x', inversa:'aligned-center-x', cadeia:true },
  'alinha-meio':     { tipo:'aligned-center-y', inversa:'aligned-center-y', cadeia:true },
  'alinha-topo':     { tipo:'aligned-top',      inversa:'aligned-top',      cadeia:true }
};

/* ID DETERMINÍSTICO de cluster: sai do TIPO + dos membros ORDENADOS, nunca da ordem em que um
   `Map` entregou as chaves. Mesma arte → mesmo ID, em qualquer execução e em qualquer máquina.
   Sem isto, um diff estrutural acusaria "cluster trocado" só porque a iteração mudou. */
function _gGraphClusterId(tipo, membros){
  return 'c:' + _gGramHash(tipo + '|' + membros.slice().sort().join('+'));
}

/**
 * Compila o COMPOSITION GRAPH a partir de uma Layout Grammar já compilada.
 * Puro: não muta a gramática nem as camadas dela.
 *
 * @param {object} grammar saída de `gCompileLayoutGrammar`
 * @returns {object} graph com `nodes`, `edges`, `clusters`, `sugestoes`, `readingFlow`
 */
function gCompileCompositionGraph(grammar){
  const gram = grammar || { nodes:[], relations:[], groups:[], hierarchy:[] };
  const gNodes = gram.nodes || [], gRel = gram.relations || [], gGroups = gram.groups || [];

  /* ── NÓS ── projeção enxuta do nó da gramática. Só o que responde perguntas de estrutura;
     nada de geometria, nome ou conteúdo. O `rect` continua a um `gGrammarNode` de distância —
     duplicá-lo aqui criaria a segunda cópia viva da mesma informação. */
  const porGrupo = new Map();
  gGroups.forEach(g => { if(g.motivo === 'grupo-autoral')
    g.membros.forEach(id => { if(!porGrupo.has(id)) porGrupo.set(id, g.id); }); });
  const nodes = gNodes.map(n => ({
    id: n.id, papel: n.papel, tipo: n.tipo, campos: n.campos.slice(),
    flex: n.flex, protegida: n.protegida, decorativa: n.decorativa, fundo: n.fundo,
    grupoAutoral: porGrupo.get(n.id) || null,
    // A confiança de um NÓ é a do que se sabe sobre ele: papel declarado pelo designer é certo,
    // papel compilado é forte (cruza quatro sinais), e é só isso que se afirma aqui.
    confianca: n.papel === 'protegida' || porGrupo.has(n.id) ? 'certa' : 'forte'
  }));
  const idxNode = new Map(nodes.map(n => [n.id, n]));

  // ── ARESTAS ──
  const edges = [];
  const push = (tipo, de, para, r, extra) => {
    if(!idxNode.has(de) || !idxNode.has(para) || de === para) return;
    edges.push(Object.assign({ tipo:tipo, de:de, para:para,
      confianca: r.confianca || 'fraca', autorada: !!r.autorada,
      evidencia: r.evidencia ? r.evidencia.slice() : null }, extra || {}));
  };
  gRel.forEach(r => {
    const m = G_GRAPH_MAPA_RELACAO[r.tipo];
    if(!m) return;
    if(m.cadeia){
      /* COLUNA VIRA CORRENTE, não clique. A §10 guarda alinhamento como uma coluna de N
         membros; ligar todos com todos aqui seria o O(n²) que a Fase 1.5 tirou. A coluna vira
         uma cadeia entre membros CONSECUTIVOS — a coluna inteira continua sendo a componente
         conexa daquele tipo de aresta, e `gGraphAlignedWith` a percorre. */
      const ms = r.membros || [];
      for(let i = 0; i + 1 < ms.length; i++){
        push(m.tipo, ms[i], ms[i+1], r, { eixo:r.valor });
        push(m.inversa, ms[i+1], ms[i], r, { eixo:r.valor });
      }
      return;
    }
    const extra = {};
    if(r.gap != null) extra.gap = r.gap;
    if(r.area != null) extra.area = r.area;
    if(r.intencional) extra.intencional = true;
    if(r.raiz != null){ extra.raiz = r.raiz; extra.motivo = r.motivo; extra.autorizada = true; }
    push(m.tipo, r.de, r.para, r, extra);
    if(m.inversa) push(m.inversa, r.para, r.de, r, extra);
  });

  /* `plate-of` — a placa ACOMPANHA o texto. Sai do grupo `placa` da §10 (que já exigiu
     contenção + z-order + texto único), então herda a evidência dele em vez de reinventá-la.
     O membro [0] é a forma e o [1] é o texto, por construção da §10. */
  gGroups.filter(g => g.motivo === 'placa').forEach(g => {
    push('plate-of', g.membros[0], g.membros[1],
      { confianca:g.confianca, evidencia:g.evidencia });
  });

  /* `follows` — a aresta NORMALIZADA de "acompanha", para quem quer navegar a cadeia sem saber
     se ela nasceu de âncora manual, de placa ou de vizinhança. Não é um fato novo: é uma VISTA
     das arestas de dependência, e carrega a confiança da aresta que a originou. */
  edges.slice().forEach(e => {
    if(G_GRAPH_DEPENDENCIA.indexOf(e.tipo) < 0) return;
    edges.push({ tipo:'follows', de:e.de, para:e.para, confianca:e.confianca,
                 autorada:e.autorada, evidencia:e.evidencia, origem:e.tipo });
  });

  /* ── CLUSTERS ── só `certa` e `forte` FUNDEM nós. O resto vira sugestão consultável.
     A §10 já separou por evidência; aqui a separação vira estrutura: quem é cluster participa
     de `same-cluster`, de `gGraphCluster` e do diff estrutural — quem é sugestão, não. */
  const clusters = [], sugestoes = [];
  const TIPO_CLUSTER = { 'grupo-autoral':'grupo-autoral', 'placa':'placa', 'proximidade':'visual' };
  gGroups.forEach(g => {
    const membros = g.membros.slice().sort();
    const item = { id:_gGraphClusterId(g.motivo, membros), tipo:TIPO_CLUSTER[g.motivo] || g.motivo,
                   motivo:g.motivo, padrao:g.padrao || null, membros:membros,
                   dinamico:g.dinamico, confianca:g.confianca,
                   evidencia:(g.evidencia || []).slice() };
    if(gGraphRelationStrength(g) >= G_GRAPH_MIN_ESTRUTURAL) clusters.push(item);
    else sugestoes.push(item);
  });
  /* CLUSTER DE CONTENÇÃO — texto dentro de foto/moldura que não é placa. A §10 registra a
     relação (`dentro-de`, forte) mas não forma grupo, porque grupo dela é só placa. É o
     "cluster visual forte": nasce de um fato já provado, sem medir nada de novo. */
  const jaEmCluster = new Set();
  clusters.forEach(c => c.membros.forEach(id => jaEmCluster.add(id)));
  const porContinente = new Map();
  edges.filter(e => e.tipo === 'contains' && gGraphIsStructural(e)).forEach(e => {
    if(jaEmCluster.has(e.de) || jaEmCluster.has(e.para)) return;
    if(!porContinente.has(e.de)) porContinente.set(e.de, []);
    porContinente.get(e.de).push(e.para);
  });
  [...porContinente.keys()].sort().forEach(cont => {
    const membros = [cont].concat(porContinente.get(cont)).sort();
    clusters.push({ id:_gGraphClusterId('contencao', membros), tipo:'contencao',
      motivo:'contencao', padrao:null, membros:membros,
      dinamico: membros.some(id => { const n = idxNode.get(id); return !!(n && n.campos.length); }),
      confianca:'forte', evidencia:['contencao','z-order'] });
  });
  clusters.sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  sugestoes.sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  // `same-cluster` como cadeia entre membros ordenados — mesma razão da coluna: O(k), não O(k²).
  const clusterDe = new Map();
  clusters.forEach(c => {
    c.membros.forEach(id => { if(!clusterDe.has(id)) clusterDe.set(id, c.id); });
    for(let i = 0; i + 1 < c.membros.length; i++){
      push('same-cluster', c.membros[i], c.membros[i+1], c, { cluster:c.id });
      push('same-cluster', c.membros[i+1], c.membros[i], c, { cluster:c.id });
    }
  });

  // ── ÍNDICES ── é isto que faz a rede ser navegável em vez de varrida.
  const saida = new Map(), entrada = new Map();
  edges.forEach(e => {
    if(!saida.has(e.de)) saida.set(e.de, []);
    if(!entrada.has(e.para)) entrada.set(e.para, []);
    saida.get(e.de).push(e); entrada.get(e.para).push(e);
  });

  const graph = { version:G_GRAPH_V, grammar:gram, nodes:nodes, edges:edges,
                  clusters:clusters, sugestoes:sugestoes,
                  _saida:saida, _entrada:entrada, _node:idxNode, _cluster:clusterDe };

  /* ── RAIZ DINÂMICA ── o conceito que o solver já usa implicitamente (`_raizDinamica`, em
     `00-config.js`): quem colide ou é empurrado muitas vezes é VÍTIMA; quem responde é o campo
     que cresceu lá em cima. Aqui ele vira pergunta respondível.
     ⛔ SÓ ATRAVESSA ARESTA ESTRUTURAL. Subir por proximidade (`fraca`) inventaria uma origem
     que a composição não demonstra — e apontar o campo errado num diagnóstico é pior que não
     apontar nenhum. A consequência assumida está no relatório: hoje uma cadeia puramente de
     vizinhança não resolve raiz, e resolver isso é unificar a AUTORIZAÇÃO da corrente (a poda
     por campo que `_gInferirCorrentes` faz), não afrouxar este corte. */
  graph.raizes = new Map();
  const _memoRaiz = new Map();
  nodes.forEach(n => {
    const r = _gGraphRaiz(graph, n.id, _memoRaiz);
    if(r) graph.raizes.set(n.id, { id:r.id, confianca:_gGraphNomeForca(r.forca),
                                   caminho:r.caminho.slice() });
  });
  graph.raizes.forEach((r, id) => {
    edges.push({ tipo:'dynamic-root', de:id, para:r.id, confianca:r.confianca,
                 autorada:false, evidencia:null, caminho:r.caminho.slice() });
    if(!saida.has(id)) saida.set(id, []);
    if(!entrada.has(r.id)) entrada.set(r.id, []);
    const e = edges[edges.length - 1];
    saida.get(id).push(e); entrada.get(r.id).push(e);
  });

  graph.readingFlow = _gGraphReadingFlow(graph);
  return graph;
}

/* Sobe pelas arestas de dependência ESTRUTURAIS até achar um nó com campo. Guarda de ciclo por
   `Set` de visitados — o designer pode marcar A→B e B→A à mão, e a rede não pode travar por
   isso. A confiança devolvida é a do ELO MAIS FRACO do caminho: uma cadeia vale o que vale o
   seu pior degrau. */
function _gGraphRaiz(graph, id, memo){
  if(memo.has(id)) return memo.get(id);
  const vistos = new Set([id]);
  const passos = [];                       // as arestas percorridas, em ordem
  let atual = id, guarda = 0, base = null; // `base` = resposta já conhecida a partir de `atual`
  while(guarda++ < 64){
    const arestas = (graph._saida.get(atual) || [])
      .filter(e => G_GRAPH_DEPENDENCIA.indexOf(e.tipo) >= 0 && gGraphIsStructural(e)
                   && !vistos.has(e.para));
    if(!arestas.length) break;
    /* Autoridade primeiro: âncora do designer vence placa, que vence corrente autorizada.
       Empate resolve por ID, para a resposta não depender da ordem em que as arestas entraram.
       Só ordena quando há mais de um candidato — o caso raro. */
    if(arestas.length > 1) arestas.sort((a,b) => gGraphRelationStrength(b) - gGraphRelationStrength(a)
                  || (a.para < b.para ? -1 : a.para > b.para ? 1 : 0));
    const e = arestas[0];
    passos.push({ de:atual, para:e.para, forca:gGraphRelationStrength(e) });
    vistos.add(e.para); atual = e.para;
    const n = graph._node.get(atual);
    if(n && n.campos.length){ base = { id:atual, forca:G_GRAPH_FORCA.certa, caminho:[] }; break; }
    if(memo.has(atual)){ base = memo.get(atual); break; }   // aproveita o que já se sabe
  }
  /* BACKFILL — a resposta de CADA nó do caminho, do fim para o começo. Sem isto a subida é
     O(n × profundidade): numa arte de 300 camadas em colunas de 50, o Graph triplicou de custo
     quando a dependência autorizada entrou, porque cada nó refazia a cadeia inteira do zero.
     A confiança de cada trecho é o ELO MAIS FRACO dele — daí o `Math.min` acumulando de trás
     para frente. */
  let acc = base;
  for(let k = passos.length - 1; k >= 0; k--){
    const p = passos[k];
    if(!acc){ memo.set(p.de, null); continue; }
    acc = { id:acc.id, forca:Math.min(acc.forca, p.forca), caminho:[p.para].concat(acc.caminho) };
    /* ⚠ CICLO: se a subida voltou ao próprio nó (o designer consegue marcar A→B e B→A à mão),
       a resposta não é "ele depende de si mesmo" — é que não há raiz. Sem esta guarda o memo
       propagaria a auto-referência para a cadeia inteira. */
    if(acc.id === p.de || acc.caminho.indexOf(p.de) >= 0){ acc = null; memo.set(p.de, null); continue; }
    memo.set(p.de, acc);
  }
  if(!memo.has(id)) memo.set(id, null);
  return memo.get(id);
}
// O nome do nível a partir da força — o inverso de `G_GRAPH_FORCA`, num lugar só.
function _gGraphNomeForca(f){
  return Object.keys(G_GRAPH_FORCA).find(k => G_GRAPH_FORCA[k] === f) || 'fraca';
}

/* ── FLUXO DE LEITURA ──────────────────────────────────────────────────────────────────────
   A ordem em que a peça se lê. Conservador de propósito: sai de `rect` + ordem vertical, e de
   mais nada. Sem estética, sem modelo, sem "o olho vai primeiro no maior".

   GEOMETRIA ADICIONAL, JUSTIFICADA (é a única do Graph): a gramática registra alinhamento de
   ARESTA (quem compartilha a mesma margem), que não é a mesma pergunta de OCUPAÇÃO de coluna
   (quem divide a mesma faixa horizontal). Duas colunas independentes de uma peça não
   compartilham margem — elas compartilham um vão entre si.
   A varredura abaixo é 1D, O(n log n), sobre os `rect` que a própria gramática publica, e NÃO
   introduz limiar novo: um ramo termina onde existe um vão horizontal de verdade. Arte de
   coluna única cai num ramo só; arte de duas colunas cai em dois — e nunca numa ordem
   inventada que junte as duas. */
function _gGraphReadingFlow(graph){
  const gram = graph.grammar;
  const alvo = (gram.nodes || []).filter(n => n && n.visivel && !n.fundo && !n.decorativa
    && n.tipo === 'text' && graph._node.has(n.id));
  if(alvo.length < 2) return alvo.length ? [[alvo[0].id]] : [];
  const ord = alvo.map(n => ({ id:n.id, x1:n.rect.x, x2:n.rect.x + n.rect.w,
                               y:n.rect.y, x:n.rect.x }))
                  .sort((a,b) => a.x1 - b.x1 || (a.id < b.id ? -1 : 1));
  const ramos = [];
  let atual = [], limite = -Infinity;
  ord.forEach(o => {
    if(atual.length && o.x1 > limite){ ramos.push(atual); atual = []; limite = -Infinity; }
    atual.push(o); limite = Math.max(limite, o.x2);
  });
  if(atual.length) ramos.push(atual);
  // Dentro do ramo, a leitura é de cima para baixo. Desempate por x e depois por ID: a mesma
  // arte tem que produzir a mesma sequência, sempre.
  return ramos.map(r => r.slice()
    .sort((a,b) => a.y - b.y || a.x - b.x || (a.id < b.id ? -1 : 1))
    .map(o => o.id));
}

/* ════════════════════════════════════════════════════════════════════
   API DE LEITURA — uma só, pura, sem classe (o idioma da casa é função global)
   ════════════════════════════════════════════════════════════════════ */

function gGraphNode(graph, id){
  return (graph && graph._node.get(id)) || null;
}
function gGraphOutgoing(graph, id, tipo){
  return ((graph && graph._saida.get(id)) || []).filter(e => !tipo || e.tipo === tipo);
}
function gGraphIncoming(graph, id, tipo){
  return ((graph && graph._entrada.get(id)) || []).filter(e => !tipo || e.tipo === tipo);
}
// Vizinhos = quem toca este nó em qualquer direção, sem repetir. Ordenado, para ser determinístico.
function gGraphNeighbors(graph, id, tipo){
  const s = new Set();
  gGraphOutgoing(graph, id, tipo).forEach(e => s.add(e.para));
  gGraphIncoming(graph, id, tipo).forEach(e => s.add(e.de));
  s.delete(id);
  return [...s].sort();
}

/* Ancestrais = de quem este nó depende, subindo só por aresta ESTRUTURAL. Descendentes = o
   inverso (quem depende deste). Os dois são guardados contra ciclo pelo mesmo `Set`. */
function _gGraphSubir(graph, id, direcao){
  const vistos = new Set([id]), fila = [id], out = [];
  let guarda = 0;
  while(fila.length && guarda++ < 4096){
    const atual = fila.shift();
    const arestas = (direcao === 'cima' ? gGraphOutgoing(graph, atual) : gGraphIncoming(graph, atual))
      .filter(e => G_GRAPH_DEPENDENCIA.indexOf(e.tipo) >= 0 && gGraphIsStructural(e));
    arestas.forEach(e => {
      const outro = direcao === 'cima' ? e.para : e.de;
      if(vistos.has(outro)) return;                 // ciclo: para aqui, não estoura
      vistos.add(outro); out.push(outro); fila.push(outro);
    });
  }
  return out.sort();
}
function gGraphAncestors(graph, id){ return _gGraphSubir(graph, id, 'cima'); }
function gGraphDescendants(graph, id){ return _gGraphSubir(graph, id, 'baixo'); }

function gGraphCluster(graph, id){
  const cid = graph && graph._cluster.get(id);
  return cid ? (graph.clusters.find(c => c.id === cid) || null) : null;
}
/**
 * O campo dinâmico que é a ORIGEM da cadeia deste nó.
 * @returns {{id:string, confianca:string, caminho:string[]}|null} `null` quando não há cadeia
 *          estrutural até um campo — e `null` aqui é resposta, não falha.
 */
function gGraphDynamicRoot(graph, id){
  return (graph && graph.raizes.get(id)) || null;
}
function gGraphAuthorialRelations(graph, id){
  return gGraphOutgoing(graph, id).concat(gGraphIncoming(graph, id)).filter(e => e.autorada);
}
/* ── AS TRÊS PERGUNTAS, COM TRÊS NOMES ────────────────────────────────────────────────────
   `gGraphHasStrongRelation` foi REMOVIDA (não virou alias: nada em produção a chamava, e um
   alias depreciado só adia o erro). O nome dizia "forte" e o consumidor lia "depende de" — mas
   alinhamento e sobreposição são `forte` de verdade, e dois blocos na mesma margem têm relação
   forte sem um depender do outro. Isso derrubou um teste da própria Fase 2; num consumidor de
   verdade teria virado uma camada empurrada por outra que só dividia a margem. */

// "Existe relação estrutural entre os dois?" — inclui o DESCRITIVO (alinhamento, contenção,
// sobreposição). É a pergunta de quem está descrevendo a composição.
function gGraphHasStructuralRelation(graph, a, b, tipo){
  return gGraphOutgoing(graph, a, tipo).some(e => e.para === b && gGraphIsStructural(e))
      || gGraphIncoming(graph, a, tipo).some(e => e.de === b && gGraphIsStructural(e));
}
// "O crescimento de um empurra o outro?" — só arestas de DEPENDÊNCIA. É a pergunta de quem vai
// adaptar a arte, e é a única que autoriza mexer em geometria.
function gGraphHasDependency(graph, a, b){
  return G_GRAPH_DEPENDENCIA.some(t => gGraphHasStructuralRelation(graph, a, b, t));
}
// "O designer DECLAROU alguma relação entre os dois?" — autoridade máxima, sem heurística.
function gGraphHasAuthorialRelation(graph, a, b){
  return gGraphOutgoing(graph, a).concat(gGraphIncoming(graph, a))
    .some(e => e.autorada && (e.para === b || e.de === b));
}

// A coluna inteira a que este nó pertence: a componente conexa daquele tipo de alinhamento.
function gGraphAlignedWith(graph, id, tipo){
  const vistos = new Set([id]), fila = [id];
  let guarda = 0;
  while(fila.length && guarda++ < 4096){
    gGraphNeighbors(graph, fila.shift(), tipo).forEach(o => {
      if(vistos.has(o)) return;
      vistos.add(o); fila.push(o);
    });
  }
  vistos.delete(id);
  return [...vistos].sort();
}

/* ════════════════════════════════════════════════════════════════════
   DIFF ESTRUTURAL — separar "a composição mudou" de "o desenho se deslocou"
   ════════════════════════════════════════════════════════════════════
   Com duas assinaturas existe a pergunta que a Fase 1 não sabia responder: DUAS composições
   diferem em quê? Um CTA que desceu 25px e um CTA que saiu do bloco da oferta são estragos de
   ordens diferentes, e até aqui os dois eram só "mudou".

   ⚠ OBSERVACIONAL. Não escolhe candidato, não pontua e não entra em `gLayoutEscolherAlternativa`.
   Ele existe para que o scoring da fase seguinte compare estrutura com estrutura em vez de
   comparar pixels e chamar isso de intenção. */
function gCompareLayoutStructure(base, candidate){
  // Aceita Grammar ou Graph nos dois lados: o Graph é derivado, então a comparação é a mesma.
  const A = (base && base.grammar) || base || {}, B = (candidate && candidate.grammar) || candidate || {};
  const chave = (r) => [r.tipo, r.de || '', r.para || '',
                        (r.membros || []).slice().sort().join('+')].join(':');
  const mapa = (g) => new Map(((g && g.relations) || []).map(r => [chave(r), r]));
  const mA = mapa(A), mB = mapa(B);
  const relationsAdded = [], relationsRemoved = [];
  mB.forEach((r, k) => { if(!mA.has(k)) relationsAdded.push({ tipo:r.tipo, de:r.de || null,
    para:r.para || null, membros:r.membros || null, confianca:r.confianca }); });
  mA.forEach((r, k) => { if(!mB.has(k)) relationsRemoved.push({ tipo:r.tipo, de:r.de || null,
    para:r.para || null, membros:r.membros || null, confianca:r.confianca }); });
  const _ord = (x, y) => (x.tipo + (x.de||'') + (x.para||'')) < (y.tipo + (y.de||'') + (y.para||'')) ? -1 : 1;
  relationsAdded.sort(_ord); relationsRemoved.sort(_ord);

  /* Cluster é comparado por MEMBROS, não por ID: o ID já é derivado dos membros, então duas
     composições com o mesmo bloco têm o mesmo ID por construção. O que interessa é quem entrou,
     quem saiu e qual bloco deixou de existir. */
  const cl = (g) => new Map(((g && g.groups) || []).map(x => [x.motivo + ':' + x.membros.slice().sort().join('+'),
                                                              { motivo:x.motivo, membros:x.membros.slice().sort() }]));
  const cA = cl(A), cB = cl(B);
  const clustersChanged = [];
  cB.forEach((v, k) => { if(!cA.has(k)) clustersChanged.push({ motivo:v.motivo, membros:v.membros, mudanca:'adicionado' }); });
  cA.forEach((v, k) => { if(!cB.has(k)) clustersChanged.push({ motivo:v.motivo, membros:v.membros, mudanca:'removido' }); });
  clustersChanged.sort((x, y) => (x.motivo + x.membros.join('+') + x.mudanca)
                               < (y.motivo + y.membros.join('+') + y.mudanca) ? -1 : 1);

  const hier = (g) => ((g && g.hierarchy) || []).map(h => h.fontSize + '=' + h.ids.slice().sort().join('+')).join('|');
  return {
    sameStructure: A.structuralSignature === B.structuralSignature,
    relationsAdded: relationsAdded,
    relationsRemoved: relationsRemoved,
    clustersChanged: clustersChanged,
    hierarchyChanged: hier(A) !== hier(B),
    visualChanged: ((A.visual && A.visual.visualSignature) || null)
                !== ((B.visual && B.visual.visualSignature) || null)
  };
}

/* ════════════════════════════════════════════════════════════════════
   12. LAYOUT COMPONENTS — o motor parando de pensar em camada solta
   ════════════════════════════════════════════════════════════════════
   Designer nenhum pensa em `TextLayer_12` e `Rectangle_4`. Ele pensa em "o bloco de preço", "o
   CTA", "a oferta". Até aqui o motor só tinha camadas: o solver empurra `cta`, encolhe
   `titulo`, cresce `placa` — cada uma por si. É por isso que a escada consegue quebrar um
   conjunto que o olho lê como uma coisa só, e não tem como perceber.

   Esta seção reconhece essas unidades. Ela recebe o Composition Graph (§11) e NÃO relê camada,
   não refaz contenção, não reabre o índice espacial e não repete heurística geométrica — tudo
   o que ela sabe já foi provado pelas fases anteriores. Consulta a Grammar só para o que o
   Graph deliberadamente não duplica: geometria (`rect`, `safeRect`) e degrau tipográfico.

   ⛔ COMPONENT NÃO É GRUPO DO DOCUMENTO. Nada aqui toca `parentId`, z-order, grupo do Estúdio
   ou template. É estrutura DERIVADA, recompilada a cada leitura e jogada fora junto.

   ── A FILOSOFIA, QUE É UMA SÓ ──
   ERRAR POR NÃO AGRUPAR É MELHOR QUE AGRUPAR ERRADO. Um bloco que o motor não reconheceu
   continua se comportando como hoje — camada a camada, que é o comportamento que o corpus
   conhece. Um bloco reconhecido ERRADO, no dia em que isto virar operacional, move junto coisas
   que não pertencem uma à outra: o logo descendo com o preço, o CTA escalando com a foto.
   O primeiro defeito é invisível; o segundo é a arte quebrada.

   Por isso PROXIMIDADE SOZINHA NUNCA CRIA COMPONENTE. Os juntores válidos são os fatos que as
   fases anteriores provaram: grupo autoral (`certa`), `plate-of` (`forte`) e
   `dynamic-dependency` (a autorização da Fase 2.5). `below`/`right-of` crus não juntam nada, e
   `inside` menos ainda — a Fase 2.5 provou que contenção não implica dependência, e a mesma
   disciplina vale aqui.

   ⚠ OBSERVACIONAL. O solver não move, não escala e não pontua componente. Queremos validar se
   o Luma ENTENDE os blocos antes de deixá-lo mexer neles. */

const G_COMP_V = 1;
/* PRECEDÊNCIA DE NÍVEL 0 — o específico vence o genérico, e quem reivindica primeiro leva o
   membro. É o que garante a regra "um membro não pertence a dois componentes fortes do mesmo
   nível": não há arbitragem depois, há ordem antes. */
const G_COMP_PRECEDENCIA = ['price-block','cta-block','image-subject-block','text-with-plate',
                           'legal-block','generic-cluster'];
// Papéis que NUNCA entram num bloco comercial, por mais forte que seja o juntor. Logo e selo
// dentro do bloco de preço é o erro mais caro desta fase — ele escala a marca junto com a copy.
const G_COMP_FORA_DO_COMERCIAL = { protegida:1, legal:1 };

function _gCompId(tipo, membros){
  return 'k:' + _gGramHash(tipo + '|' + membros.slice().sort().join('+'));
}

/**
 * Compila os LAYOUT COMPONENTS a partir da gramática e do grafo já compilados.
 * Puro: não muta nenhum dos dois, nem as camadas.
 *
 * @param {object} grammar saída de `gCompileLayoutGrammar`
 * @param {object} graph   saída de `gCompileCompositionGraph` (derivado se faltar)
 * @returns {Array} componentes, ordenados por ID (determinístico)
 *//**
 * Compila os LAYOUT COMPONENTS a partir da gramática e do grafo já compilados.
 * Puro: não muta nenhum dos dois, nem as camadas.
 *
 * O compilador tem DUAS ETAPAS SEPARADAS, e a separação é o ponto:
 *   1. DETECTAR — cada regra propõe candidatos, sem reivindicar nada e sem olhar o que os
 *      outros propuseram. Um detector não sabe que os outros existem.
 *   2. RESOLVER — os candidatos são ordenados por `G_COMP_PRECEDENCIA` e só então reivindicam
 *      membros. Quem chega primeiro na ORDEM DECLARADA leva; quem perde, perde o membro.
 * Antes as duas etapas eram a mesma coisa: cada detector reivindicava na hora, e a precedência
 * real era a ordem física das seções neste arquivo. Mover um bloco de código para cima mudava o
 * resultado sem que `G_COMP_PRECEDENCIA` mudasse — a constante documentava uma regra que não
 * era executada. Agora ela É a regra.
 *
 * @param {object} grammar saída de `gCompileLayoutGrammar`
 * @param {object} graph   saída de `gCompileCompositionGraph` (derivado se faltar)
 * @returns {Array} componentes, ordenados por ID (determinístico)
 */
function gCompileLayoutComponents(grammar, graph){
  const gram = grammar || (graph && graph.grammar) || { nodes:[], relations:[], groups:[] };
  const G = graph || gCompileCompositionGraph(gram);
  /* Índice local dos nós. `gGrammarNode` é um `.find()` linear — correto para uso avulso,
     caro aqui: o crescimento consulta papel e proteção milhares de vezes, e era isso que fazia
     o compilador escalar pior que linear numa arte de 300 camadas. */
  const _idxG = new Map((gram.nodes || []).map(n => [n.id, n]));
  const nG = (id) => _idxG.get(id) || null;
  const nK = (id) => gGraphNode(G, id);
  const papel = (id) => { const n = nG(id); return n ? n.papel : null; };
  const protegido = (id) => { const n = nG(id); return !!(n && (n.protegida || n.fundo)); };

  /* JUNTORES — os únicos fatos que autorizam duas camadas a virarem uma unidade. Note o que
     NÃO está aqui: `below`, `right-of`, `inside`, `aligned-*`, `overlaps`. Estar perto, estar
     dentro e estar alinhado descrevem a arte; nenhum deles prova que as duas coisas são a
     mesma coisa. */
  const _juntores = (id) => {
    const out = new Set();
    ['plate-of','dynamic-dependency'].forEach(t => {
      gGraphOutgoing(G, id, t).forEach(e => out.add(e.para));
      gGraphIncoming(G, id, t).forEach(e => out.add(e.de));
    });
    const n = nK(id);
    // Grupo AUTORAL é declaração do designer — o juntor mais forte que existe.
    if(n && n.grupoAutoral) G.nodes.forEach(o => { if(o.grupoAutoral === n.grupoAutoral) out.add(o.id); });
    out.delete(id);
    return [...out].sort();
  };
  const _porQue = (id, outro) => {
    const e = ['plate-of','dynamic-dependency'].filter(t =>
      gGraphOutgoing(G, id, t).some(x => x.para === outro)
      || gGraphIncoming(G, id, t).some(x => x.de === outro));
    const a = nK(id), b = nK(outro);
    if(a && b && a.grupoAutoral && a.grupoAutoral === b.grupoAutoral) e.push('grupo-autoral');
    return e;
  };

  /* A RAIZ DINÂMICA de um nó, na leitura dos componentes: o Graph responde "quem me empurra",
     então um campo que não tem ninguém acima devolve `null` — e ele É a própria origem. */
  const _raizDinamica = (id) => {
    const r = gGraphDynamicRoot(G, id);
    if(r) return r.id;
    const n = nG(id);
    return (n && n.campos.length) ? id : null;
  };
  const posLeitura = new Map();
  (G.readingFlow || []).forEach((ramo, i) => ramo.forEach((id, k) => posLeitura.set(id, { ramo:i, pos:k })));
  const _vizinhoDeLeitura = (id) => {
    const p = posLeitura.get(id);
    if(!p) return [];
    const ramo = (G.readingFlow || [])[p.ramo] || [];
    return [ramo[p.pos - 1], ramo[p.pos + 1]].filter(Boolean);
  };
  const _clusterDe = (id) => { const c = gGraphCluster(G, id); return c ? c.id : null; };

  /* Expansão em largura a partir de uma semente, admitindo só quem passa no filtro do TIPO.
     O filtro é por papel, não por proximidade — é ele que impede o logo de entrar no preço. */
  const _cresce = (semente, admite, extra) => {
    const dentro = new Set([semente]), fila = [semente], evid = new Set();
    let guarda = 0;
    while(fila.length && guarda++ < 512){
      const atual = fila.shift();
      _juntores(atual).forEach(o => {
        if(dentro.has(o) || !admite(nG(o), nK(o))) return;
        _porQue(atual, o).forEach(x => evid.add(x));
        dentro.add(o); fila.push(o);
      });
      // Juntor adicional específico do tipo (ver o irmão de leitura, no price-block).
      if(extra) extra(atual).forEach(o => {
        if(dentro.has(o) || !admite(nG(o), nK(o))) return;
        evid.add('same-dynamic-root'); evid.add('reading-adjacent');
        dentro.add(o); fila.push(o);
      });
    }
    return { membros:[...dentro].sort(), evidencia:[...evid].sort() };
  };
  // Existe pelo menos UM juntor verdadeiro dentro deste conjunto?
  const _temJuntorInterno = (ids) =>
    ids.some(a => _juntores(a).some(b => ids.indexOf(b) >= 0));

  /* ─────────────────────────── ETAPA 1: DETECTAR ─────────────────────────────────────────
     Nenhum detector reivindica nada aqui. Eles só PROPÕEM. */
  const candidatos = [];
  const _propoe = (c) => { if(c && c.membros.length) candidatos.push(c); };
  const sementes = (filtro) => gram.nodes.filter(filtro).map(n => n.id).sort();

  // ── PRICE-BLOCK — o componente mais importante da primeira versão ───────────────────────
  /* O preço é o argumento da peça, e o motor já tem regra de domínio dura para ele
     (`_gLayoutBlocoPrecoFixo`: não é empurrado nem encolhido por motivo alheio).
     ⛔ Recusa logo, selo de marca e legal — mesmo quando o juntor é um grupo autoral, porque
     agrupar no PSD não torna a marca parte da oferta. */
  const _admitePreco = (n) => {
    if(!n || G_COMP_FORA_DO_COMERCIAL[n.papel] || n.protegida || n.fundo) return false;
    if(n.papel === 'preco') return true;
    return n.tipo === 'shape' && n.papel === 'decoracao';       // a placa/selo atrás do preço
  };
  /* O IRMÃO DE PREÇO. "De R$ 49,90 por" e "R$ 29,90" são um bloco só para qualquer olho — mas
     no grafo eles são IRMÃOS, não pai e filho: os dois penduram na mesma cadeia (o nome do
     produto acima). Sem esta regra o padrão mais comum dos PSDs da marca saía como dois
     componentes soltos.
     NÃO é proximidade. Exige QUATRO sinais estruturais, e nenhum deles é distância:
       · os dois com papel de preço;
       · a MESMA raiz dinâmica;
       · consecutivos no fluxo de leitura (o que também garante mesmo ramo e nada de outra
         função entre eles — consecutivo não tem meio);
       · CLUSTER COMPATÍVEL: dois preços em PLACAS DIFERENTES são ofertas diferentes, e é essa
         a guarda contra duas ofertas que compartilham a mesma raiz por acidente (duas placas
         de promoção penduradas no mesmo título). O sinal já existe — é o cluster do Graph —
         então não há heurística geométrica nova aqui. */
  const _irmaoDePreco = (id) => {
    const raiz = _raizDinamica(id);
    if(!raiz) return [];
    const meuCluster = _clusterDe(id);
    return _vizinhoDeLeitura(id).filter(o => {
      if(papel(o) !== 'preco' || protegido(o)) return false;
      if(_raizDinamica(o) !== raiz) return false;
      const dele = _clusterDe(o);
      // Clusters diferentes (duas placas) = duas ofertas. Um sem cluster não conflita.
      return !(meuCluster && dele && meuCluster !== dele);
    });
  };
  sementes(n => n.papel === 'preco' && n.visivel && !n.protegida).forEach(seed => {
    const r = _cresce(seed, _admitePreco, _irmaoDePreco);
    _propoe({ tipo:'price-block', nivel:0, semente:seed, membros:r.membros,
      evidencia:['semantic-price'].concat(r.evidencia), minimo:1 });
  });

  // ── CTA-BLOCK ── texto de CTA + a pill/forma atrás dele, quando houver.
  /* Shape NÃO é obrigatório: um CTA textual isolado já é uma unidade semântica clara. */
  sementes(n => n.papel === 'cta' && n.visivel && !n.protegida).forEach(seed => {
    const r = _cresce(seed, (n) => n && !G_COMP_FORA_DO_COMERCIAL[n.papel] && !n.protegida
      && !n.fundo && (n.papel === 'cta' || (n.tipo === 'shape' && n.papel === 'decoracao')));
    _propoe({ tipo:'cta-block', nivel:0, semente:seed, membros:r.membros,
      evidencia:['semantic-cta'].concat(r.evidencia), minimo:1 });
  });

  // ── IMAGE-SUBJECT-BLOCK ── a foto e o que está REALMENTE acoplado a ela.
  /* ⛔ Contenção NÃO conta. Texto por cima da foto é contenção intencional (a §10 registra), e
     a Fase 2.5 provou que contenção não implica dependência. */
  sementes(n => (n.tipo === 'image' || n.tipo === 'frame') && n.visivel && !n.fundo).forEach(seed => {
    const r = _cresce(seed, (n) => n && !n.fundo && !G_COMP_FORA_DO_COMERCIAL[n.papel]);
    if(r.membros.length < 2) return;              // imagem sem nada acoplado não é bloco
    _propoe({ tipo:'image-subject-block', nivel:0, semente:seed, membros:r.membros,
      evidencia:['image-subject'].concat(r.evidencia) });
  });

  /* ── TEXT-WITH-PLATE ── o par estrutural, quando nenhum tipo específico o cobre. Ele PROPÕE
     sempre; quem decide que `price-block` vence é a precedência, não a ordem deste bloco. */
  G.edges.filter(e => e.tipo === 'plate-of').forEach(e => {
    if(protegido(e.de) || protegido(e.para)) return;
    _propoe({ tipo:'text-with-plate', nivel:0, semente:e.para, membros:[e.de, e.para].sort(),
      evidencia:['plate-of'].concat(e.evidencia || []) });
  });

  /* ── LEGAL-BLOCK ── regulamento em várias linhas/camadas.
     Aqui a proximidade ENTRA, mas nunca sozinha: só liga camadas que já são, as duas, papel
     `legal`. Dois sinais, e mesmo assim sai como `provavel`.
     ⛔ Rodapé inteiro NÃO é legal-block: logo, assinatura, selo e CTA moram lá e não entram. */
  const _ehLegal = (id) => papel(id) === 'legal' && !protegido(id);
  sementes(n => n.papel === 'legal' && n.visivel && !n.protegida).forEach(seed => {
    const dentro = new Set([seed]), fila = [seed];
    let guarda = 0;
    while(fila.length && guarda++ < 256){
      const atual = fila.shift();
      gGraphNeighbors(G, atual).forEach(o => {
        if(dentro.has(o) || !_ehLegal(o)) return;
        const vizinho = gGraphOutgoing(G, atual, 'below').some(x => x.para === o)
                     || gGraphIncoming(G, atual, 'below').some(x => x.de === o)
                     || _juntores(atual).indexOf(o) >= 0;
        if(!vizinho) return;
        dentro.add(o); fila.push(o);
      });
    }
    _propoe({ tipo:'legal-block', nivel:0, semente:seed, membros:[...dentro].sort(),
      evidencia:['semantic-legal','proximidade'], forcarConfianca:'provavel' });
  });

  /* ── GENERIC-CLUSTER ── o que o grafo provou ser um bloco mas nenhum tipo reconheceu.
     ⛔ ENDURECIDO: só nasce quando existe pelo menos UM JUNTOR VERDADEIRO entre os membros.
     O cluster de CONTENÇÃO do Graph (texto sobre foto) é forte e verdadeiro como descrição
     VISUAL — e não prova identidade de componente. Enquanto `generic-cluster` não fazia nada,
     deixá-lo nascer dali era inofensivo; no dia em que ele alimentar elasticidade, seria a foto
     e o texto escalando juntos por cima de uma relação que a Fase 2.5 já provou não ser
     dependência. O cluster continua existindo no Graph; só não vira componente. */
  (G.clusters || []).forEach(c => {
    if(!_temJuntorInterno(c.membros)) return;
    _propoe({ tipo:'generic-cluster', nivel:0, semente:c.membros.slice().sort()[0],
      membros:c.membros.slice().sort(), evidencia:(c.evidencia || []).slice(),
      forcarConfianca:c.confianca });
  });

  /* ─────────────────────────── ETAPA 2: RESOLVER ─────────────────────────────────────────
     A ordem é a DECLARADA em `G_COMP_PRECEDENCIA`; o desempate dentro do mesmo tipo é por
     semente, para não depender da ordem em que os candidatos foram propostos. */
  const _peso = (t) => { const i = G_COMP_PRECEDENCIA.indexOf(t); return i < 0 ? 999 : i; };
  candidatos.sort((a, b) => _peso(a.tipo) - _peso(b.tipo)
                         || (a.semente < b.semente ? -1 : a.semente > b.semente ? 1 : 0));

  const reivindicado = new Map();          // nodeId → componente de nível 0
  const componentes = [];
  const _registra = (c) => {
    /* Por padrão um componente precisa de DOIS membros — senão "componente" vira sinônimo de
       "camada" e a abstração não paga o próprio custo. `price-block` e `cta-block` abrem
       exceção porque têm valor semântico claro sozinhos: é o que o franqueado nomeia na arte. */
    if(c.membros.length < (c.minimo || 2)) return null;
    c.id = _gCompId(c.tipo, c.membros);
    if(componentes.some(x => x.id === c.id)) return null;      // duplicata exata: um fato só
    delete c.minimo; delete c.semente;
    componentes.push(c);
    if(c.nivel === 0) c.membros.forEach(m => reivindicado.set(m, c));
    return c;
  };
  candidatos.forEach(c => {
    // Membro já levado por um candidato de precedência MAIOR sai deste; a semente tem que
    // sobreviver, senão o que restou não é mais o componente que foi proposto.
    const membros = c.membros.filter(m => !reivindicado.has(m));
    if(membros.indexOf(c.semente) < 0) return;
    _registra(Object.assign({}, c, { membros:membros }));
  });
  const livre = (id) => !reivindicado.has(id);

  /* ── OFFER-BLOCK (nível 1) ── a oferta como unidade: o que o franqueado muda e o que
     acompanha essa mudança.
     Roda DEPOIS da resolução de nível 0 por dependência semântica, não por ordem de código: ele
     precisa dos componentes já resolvidos para aninhá-los como filhos.
     Conservador: exige MESMA CADEIA DINÂMICA (a autorização da Fase 2.5), mesmo RAMO DE LEITURA
     e papéis compatíveis. E há o teste do MEIO: se entre dois membros, na ordem de leitura,
     existe algo de outra função (rodapé legal, logo, CTA), não é um bloco. */
  const PAPEL_OFERTA = { titulo:1, produto:1, apoio:1, preco:1, decoracao:1 };
  const ramoDe = new Map();
  posLeitura.forEach((p, id) => ramoDe.set(id, p.ramo));
  const cadeias = new Map();
  gram.nodes.forEach(n => {
    const r = gGraphDynamicRoot(G, n.id);
    if(!r) return;
    if(!cadeias.has(r.id)) cadeias.set(r.id, new Set([r.id]));
    cadeias.get(r.id).add(n.id);
  });
  [...cadeias.keys()].sort().forEach(raiz => {
    const membros = [...cadeias.get(raiz)].sort();
    if(membros.length < 2) return;
    if(membros.some(id => { const n = nG(id); return !n || !PAPEL_OFERTA[n.papel] || n.protegida || n.fundo; })) return;
    // Uma oferta tem um assunto: só preço encadeado é price-block, não offer-block.
    if(!membros.some(id => papel(id) === 'titulo' || papel(id) === 'produto')) return;
    const ramos = new Set(membros.map(id => ramoDe.has(id) ? ramoDe.get(id) : -1));
    if(ramos.size > 1) return;                       // colunas diferentes não são um bloco
    const ramo = (G.readingFlow || [])[[...ramos][0]] || [];
    const idx = membros.map(id => ramo.indexOf(id)).filter(i => i >= 0);
    if(idx.length >= 2){
      const lo = Math.min(...idx), hi = Math.max(...idx);
      for(let k = lo + 1; k < hi; k++){
        const meio = ramo[k];
        if(membros.indexOf(meio) >= 0) continue;
        const p = papel(meio);
        if(p === 'legal' || p === 'cta' || protegido(meio)) return;   // outra função no meio
      }
    }
    // Absorve os componentes de nível 0 que caem dentro da cadeia — eles viram FILHOS.
    const filhos = componentes.filter(c => c.nivel === 0 && c.membros.some(m => membros.indexOf(m) >= 0));
    const todos = [...new Set(membros.concat(...filhos.map(c => c.membros)))].sort();
    if(todos.some(id => protegido(id) || papel(id) === 'legal')) return;
    _registra({ tipo:'offer-block', nivel:1, semente:raiz, membros:todos,
      membrosDiretos: membros.filter(m => !filhos.some(c => c.membros.indexOf(m) >= 0)).sort(),
      filhos: filhos.map(c => c.id).sort(),
      evidencia:['same-dynamic-root','same-reading-branch','compatible-roles'] });
  });

  /* ── RAÍZES, CONFIANÇA, CARDINALIDADE, BOUNDS E ASSINATURA ── um passe final, para todo
     componente ter o mesmo contrato. A confiança NÃO é um sistema novo: são os mesmos quatro
     níveis de `G_GRAPH_FORCA`, e o que decide é a EVIDÊNCIA. */
  componentes.forEach(c => {
    const sinais = c.evidencia.filter(e => e !== 'proximidade');
    c.confianca = c.forcarConfianca ? c.forcarConfianca
                : c.evidencia.indexOf('grupo-autoral') >= 0 ? 'certa'
                : sinais.length >= 2 ? 'forte'
                : c.evidencia.indexOf('proximidade') >= 0 ? 'provavel' : 'forte';
    delete c.forcarConfianca;
    if(c.membrosDiretos == null){ c.membrosDiretos = c.membros.slice(); c.filhos = []; }

    /* SINGLETON — a distinção que a fase seguinte precisa e que o tipo sozinho não dá.
       "É um CTA" e "é um bloco composto que deve escalar e mover junto" são duas afirmações
       diferentes, e um `cta-block` de um membro só faz a primeira. Sem esta marca, a
       elasticidade leria `cta-block` e trataria uma camada solta como grupo. */
    c.singleton = c.membros.length === 1;

    /* ROOT: o membro que dá NOME ao componente — o maior degrau tipográfico entre os que
       carregam a semântica do tipo. Desempate por ID, para não depender da ordem da lista. */
    const _degrau = (id) => { const n = nG(id);
      return n && n.tipo === 'text' ? (n.fontSize || 0) : -1; };
    c.rootId = c.membros.slice().sort((a,b) => _degrau(b) - _degrau(a) || (a < b ? -1 : 1))[0] || null;

    /* DYNAMIC ROOT: sai do Composition Graph, não de leitura própria.
       ⚠ Raízes independentes NÃO viram uma raiz falsa: com mais de uma, `dynamicRootId` fica
       `null` e a lista fica em `dynamicRoots`. */
    const raizes = new Set();
    c.membros.forEach(id => { const r = _raizDinamica(id); if(r) raizes.add(r); });
    c.dynamicRoots = [...raizes].sort();
    c.dynamicRootId = c.dynamicRoots.length === 1 ? c.dynamicRoots[0] : null;
    c.dinamico = c.dynamicRoots.length > 0;
    c.bounds = gComponentBounds(c, gram);
  });
  /* ASSINATURA DO COMPONENTE — "esta unidade semântica continua sendo a mesma?".
     Depende de tipo, membros, hierarquia, raízes e cardinalidade. NÃO depende de conteúdo,
     coordenada, bounds nem da ordem em que os candidatos foram gerados: mover o CTA 20px não
     muda nada aqui, separar o price-block em dois muda tudo. Calculada num segundo passe
     porque a hierarquia só existe depois que os filhos têm ID. */
  const _porId = new Map(componentes.map(c => [c.id, c]));
  componentes.forEach(c => {
    const filhos = c.filhos.map(f => { const x = _porId.get(f); return x ? x.tipo + ':' + x.membros.join('+') : f; }).sort();
    c.componentSignature = _gGramHash([
      'v' + G_COMP_V, c.tipo, c.singleton ? 'single' : 'group',
      c.membros.slice().sort().join('+'),
      'root=' + (c.rootId || ''), 'dyn=' + c.dynamicRoots.join('+'),
      'filhos=' + filhos.join('|')
    ].join('#'));
  });
  componentes.sort((a,b) => a.nivel - b.nivel || (a.id < b.id ? -1 : 1));
  return componentes;
}

/* ════════════════════════════════════════════════════════════════════
   API DE LEITURA DOS COMPONENTES — funções puras, como o resto do arquivo
   ════════════════════════════════════════════════════════════════════ */

function gComponentById(components, id){
  return (components || []).find(c => c && c.id === id) || null;
}
// O componente de nível 0 de um nó; sem ele, o de nível 1 que o contém.
function gComponentOfNode(components, nodeId){
  const lista = (components || []).filter(c => c.membros.indexOf(nodeId) >= 0);
  return lista.sort((a,b) => a.nivel - b.nivel)[0] || null;
}
function gComponentsByType(components, tipo){
  return (components || []).filter(c => c && c.tipo === tipo);
}
function gComponentMembers(component){
  return component ? component.membros.slice() : [];
}
function gComponentDynamicRoot(component){
  return component ? (component.dynamicRootId || null) : null;
}
function gComponentContains(component, nodeId){
  return !!(component && component.membros.indexOf(nodeId) >= 0);
}

/**
 * Os três retângulos de um componente. Puro, e derivado da geometria que a §10 já publicou —
 * `gInkRect` continua sendo o motor único de tinta, e não é reimplementado aqui.
 *   · `autorado` — a união das CAIXAS que o designer desenhou;
 *   · `visual`   — a mesma união sem os membros decorativos (a sangria de um selo não define
 *                  a caixa visual do bloco);
 *   · `seguro`   — usa a caixa do ASSUNTO onde ela existe (`safeRect`, do import de PSD), e a
 *                  caixa desenhada onde não existe.
 * ⚠ Tudo descreve o AUTORADO. Nenhum deles lê resultado de solve — nesta fase não há
 *   componente adaptado para medir.
 */
function gComponentBounds(component, grammar){
  const ids = (component && component.membros) || [];
  const uniao = (sel) => {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    ids.forEach(id => {
      const n = gGrammarNode(grammar, id);
      const r = n && sel(n);
      if(!r) return;
      a = Math.min(a, r.x); b = Math.min(b, r.y);
      c = Math.max(c, r.x + r.w); d = Math.max(d, r.y + r.h);
    });
    return isFinite(a) ? { x:a, y:b, w:c - a, h:d - b } : null;
  };
  const autorado = uniao(n => n.rect);
  return {
    autorado: autorado,
    visual: uniao(n => n.decorativa ? null : n.rect) || autorado,
    seguro: uniao(n => n.safeRect || n.rect) || autorado
  };
}

/**
 * DIFF DE COMPONENTES — "as unidades semânticas desta arte continuam as mesmas?".
 * Observacional: não escolhe solução, não pontua. Prepara a fase em que o motor precisar saber
 * se uma adaptação DESTRUIU a composição em vez de só deslocá-la.
 *
 * O pareamento é por TIPO + RAIZ ("o bloco de preço enraizado em X"), e não por assinatura: são
 * justamente os componentes que existem dos dois lados e MUDARAM que interessam — parear por
 * assinatura os faria aparecer como um removido mais um adicionado, escondendo a mudança.
 *
 * @returns {{sameComponents, added, removed, changed, hierarchyChanged}}
 */
function gCompareLayoutComponents(base, candidate){
  const A = base || [], B = candidate || [];
  const chave = (c) => c.tipo + '@' + (c.rootId || '');
  const resumo = (c) => ({ id:c.id, tipo:c.tipo, rootId:c.rootId, membros:c.membros.slice(),
                           singleton:c.singleton, componentSignature:c.componentSignature });
  const mA = new Map(A.map(c => [chave(c), c])), mB = new Map(B.map(c => [chave(c), c]));
  const added = [], removed = [], changed = [];
  mB.forEach((c, k) => { if(!mA.has(k)) added.push(resumo(c)); });
  mA.forEach((c, k) => {
    if(!mB.has(k)){ removed.push(resumo(c)); return; }
    const o = mB.get(k);
    if(c.componentSignature !== o.componentSignature)
      changed.push({ tipo:c.tipo, rootId:c.rootId,
        de:resumo(c).membros, para:resumo(o).membros,
        deSignature:c.componentSignature, paraSignature:o.componentSignature });
  });
  const _ord = (x, y) => (x.tipo + (x.rootId || '')) < (y.tipo + (y.rootId || '')) ? -1 : 1;
  added.sort(_ord); removed.sort(_ord); changed.sort(_ord);
  // A hierarquia é o mapa "quem aninha quem", por tipo — não por ID, que carrega os membros.
  const hier = (l) => l.map(c => c.tipo + '<' + c.filhos.map(f => {
    const x = l.find(y => y.id === f); return x ? x.tipo : f; }).sort().join(',')).sort().join('|');
  return {
    sameComponents: added.length === 0 && removed.length === 0 && changed.length === 0,
    added, removed, changed,
    hierarchyChanged: hier(A) !== hier(B)
  };
}

/* ════════════════════════════════════════════════════════════════════
   13. ELASTICITY MODEL — quanta liberdade cada coisa tem
   ════════════════════════════════════════════════════════════════════
   A escada do solver sabe QUE degraus existem (quebrar → empurrar → apertar respiro →
   entrelinha → tracking → encolher → escalar). O que ela não tem é uma resposta, antes de
   agir, para "quem pode ceder O QUÊ, e até onde?". Hoje isso está espalhado em condições
   dentro do laço: `_gLayoutPrecoImune` aqui, `_pisoLegivel` ali, `gLayoutRoleMaxLines` acolá.
   Funciona, e é justamente por funcionar que precisa ser LIDO antes de ser mexido.

   Esta seção não inventa política. Ela COMPILA, num objeto, as permissões que o motor já
   aplica — e onde a regra existente e a intuição divergem, a REGRA EXISTENTE VENCE e a
   divergência fica documentada. Substituir comportamento validado por default inventado é o
   modo mais rápido de quebrar um corpus de 25 goldens.

   ⚠ DESCRITIVA. `gApplyRelativeAnchors` não conhece esta seção. Elasticidade descreve a
   LIBERDADE permitida; não descreve a ação tomada, não escolhe candidato e não move um pixel.

   ── NÍVEIS DISCRETOS, NÃO FLOAT ──
   `moveY: 0.72` seria um número que ninguém calibrou fingindo precisão que não existe. Quatro
   níveis, e a comparação mora em `gElasticityLevel` — consumidor não compara string na mão. */

const G_LAYOUT_ELASTICITY = { none:0, low:1, medium:2, high:3 };
const G_ELASTICITY_NOME = ['none','low','medium','high'];

function gElasticityLevel(v){
  const n = G_LAYOUT_ELASTICITY[v];
  return n != null ? n : 0;
}
// O mais restritivo dos dois — a operação da HERANÇA de permissão (ver §8 do modelo).
function gElasticityMin(a, b){
  return G_ELASTICITY_NOME[Math.min(gElasticityLevel(a), gElasticityLevel(b))];
}
function gElasticityMax(a, b){
  return G_ELASTICITY_NOME[Math.max(gElasticityLevel(a), gElasticityLevel(b))];
}
const _gElNivel = (n) => G_ELASTICITY_NOME[Math.max(0, Math.min(3, n))];

/* AS DIMENSÕES — dez, e cada uma corresponde a um degrau que o solver REALMENTE tem:
     moveX/moveY        → a corrente (`_gInferirCorrentes` + `_posicionar`)
     wrap               → `gSmartWrapText` limitado por `gLayoutRoleMaxLines`
     fontShrink         → o degrau de encolher, com piso em `_pisoFonte`/`_pisoLegivel`
     lineHeight         → o degrau da entrelinha calculada, piso 1.05
     tracking           → o degrau 3.7 (devolver o tracking que o motor somou)
     scale              → a escala proporcional do componente (`relaxou`)
     resizeContainer    → a placa que acompanha o texto (`_seguirPlacas`)
     redistributeSpace  → `_respiroFator` 1 → 0.5
     rigidity           → o CUSTO de descaracterizar, não uma permissão (ver abaixo)

   ⛔ `decorativeMove` e `decorativeScale` foram descartadas por REDUNDÂNCIA. Elas seriam
   `moveX/moveY` e `scale` de uma camada decorativa — e "é decorativa" já é um fato do nó
   (`decorativa`), não uma dimensão de liberdade. Ter as duas criaria dois lugares dizendo a
   mesma coisa sobre a mesma camada, que é a origem histórica dos bugs deste motor. Quem quiser
   "quanto a decoração pode mover" lê `moveX` dos nós com `decorativa:true`.
   ⛔ `hideDecorative` não entra: é emergência, e emergência é outra fase. */
const G_ELASTICITY_DIMENSOES = ['moveX','moveY','wrap','fontShrink','lineHeight','tracking',
                                'scale','resizeContainer','redistributeSpace'];

/* RIGIDEZ NÃO É O INVERSO DAS PERMISSÕES. Um preço pode ter `rigidity: high` e `moveY`
   permitido: "preserve a identidade e a hierarquia dele, mas reposicionar é aceitável".
   Rigidez é o CUSTO de descaracterizar — e o Luma já tem esse número calibrado contra o
   corpus: `G_SCORE_PESO_PAPEL`, os pesos que a nota usa para cobrar mais caro por estragar um
   título do que um rodapé. Derivar daí, em vez de inventar uma segunda tabela, é o que impede
   elasticidade e pontuação de discordarem sobre o que importa nesta arte. */
function _gElRigidez(n){
  if(!n) return 'medium';
  if(n.protegida || n.fundo) return 'high';
  const peso = (typeof G_SCORE_PESO_PAPEL !== 'undefined' && G_SCORE_PESO_PAPEL[n.papel] != null)
             ? G_SCORE_PESO_PAPEL[n.papel] : 1;
  return peso >= 1.4 ? 'high' : peso >= 1 ? 'medium' : 'low';
}

/**
 * Elasticidade de TODAS as camadas, em lote. Em lote e não uma a uma porque a resposta de cada
 * uma depende do conjunto (o grafo, os componentes) — compilar uma por vez refaria a mesma
 * leitura N vezes.
 *
 * @returns {Map<string,object>} nodeId → {moveX, moveY, wrap, …, rigidity, motivos}
 */
function gCompileLayerElasticity(grammar, graph){
  const gram = grammar || { nodes:[] };
  const G = graph || gCompileCompositionGraph(gram);
  /* As formas que são PLACA de alguém, indexadas UMA vez. Antes isto era
     `G.edges.some(e => e.tipo === 'plate-of' && e.de === n.id)` dentro do laço de nós: uma
     varredura das 4.800 arestas para CADA uma das 344 camadas — 1,7 milhão de comparações, e
     foi o que fez a elasticidade escalar 42× onde a arte cresceu 5,9×. */
  const _placas = new Set();
  (G.edges || []).forEach(e => { if(e.tipo === 'plate-of') _placas.add(e.de); });
  const out = new Map();
  (gram.nodes || []).forEach(n => {
    const m = [];                                  // por que cada trava existe
    const rigidez = _gElRigidez(n);

    /* ── MOVER ── a régua é a do solver, não uma nova: quem não pode ser empurrado não tem
       `moveY`. `gLayoutPodeAcompanhar` (a fonte única da Fase 2.5) já respondeu isso, e o
       `travada` do nó carrega o resultado. Âncora MANUAL devolve o movimento: o designer
       declarou que aquilo acompanha, e declaração vence heurística. */
    const manual = gGraphOutgoing(G, n.id, 'authorial-anchor').length > 0;
    let moveY = 'high', moveX = 'low';
    /* Do ESPECÍFICO para o genérico: todas as travas abaixo acabam em `podeAcompanhar:false`,
       mas o MOTIVO precisa ser o real — "ancestral travado" num preço mandaria quem lê procurar
       um grupo que não existe. */
    if(n.protegida || n.fundo){ moveY = 'none'; moveX = 'none'; m.push('protegida'); }
    else if(n.papel === 'preco' && n.campos.length && !manual){
      /* ⚠ AQUI A REGRA EXISTENTE VENCE A INTUIÇÃO. O bloco de preço dinâmico NÃO é empurrado
         pela corrente desde 03/09 (`_gLayoutBlocoPrecoFixo`): ele desloca os outros e não é
         deslocado. Seria natural marcá-lo `moveY: medium` — mas isso descreveria um motor que
         não existe, e a fase operacional consumiria a descrição, não o código. Com âncora
         manual ele volta a mover, porque aí é o designer mandando. */
      moveY = 'none'; moveX = 'none'; m.push('bloco-de-preco-nao-sai-do-lugar');
    }
    else if(n.podeAcompanhar === false && !manual){
      /* A régua é a FONTE ÚNICA (`gLayoutPodeAcompanhar`, publicada pela §10 em
         `podeAcompanhar`) — não `protegida`. A diferença aparece no caso que mais engana: uma
         camada solta DENTRO DE UM GRUPO TRAVADO não é protegida ela própria, mas o solver se
         recusa a encadeá-la. Olhar só o `protegida` do nó daria `moveY: high` para algo que o
         motor nunca move. */
      moveY = 'none'; moveX = 'none'; m.push('ancestral-travado');
    }
    else if(n.decorativa){ moveY = 'high'; moveX = 'high'; m.push('decorativa'); }

    /* ── QUEBRAR LINHA ── o teto por papel já existe (`gLayoutRoleMaxLines`): cta/preço param
       em 2 linhas, título/produto em 3, apoio em 4, legal corre até 8. O nível sai do teto, e
       não de uma opinião nova sobre quanto cada um "deveria" quebrar. */
    let wrap = 'none';
    if(n.tipo === 'text' && !n.protegida){
      const teto = (typeof gLayoutRoleMaxLines === 'function') ? gLayoutRoleMaxLines(n.papel) : 4;
      wrap = teto <= 1 ? 'none' : teto <= 2 ? 'low' : teto <= 4 ? 'medium' : 'high';
    }

    /* ── ENCOLHER A FONTE ── a escada encolhe o MENOR degrau primeiro e só chega no título
       quando o resto já cedeu; o preço só cede por causa dele mesmo (`_gLayoutPrecoImune`); e
       o piso de legibilidade (`_pisoLegivel`) não deixa nada virar 8px numa arte de 1080. */
    let fontShrink = 'none';
    if(n.tipo === 'text' && !n.protegida && !n.fundo){
      fontShrink = n.papel === 'preco' ? 'low'
                 : n.papel === 'titulo' ? 'medium'
                 : n.papel === 'legal' ? 'medium'      // o piso de legibilidade segura o resto
                 : n.papel === 'apoio' ? 'high' : 'medium';
      if(n.papel === 'preco') m.push('preco-so-cede-por-si');
      if(n.papel === 'legal') m.push('piso-de-legibilidade');
    }

    /* ── ENTRELINHA ── só há degrau quando existe folga acima do piso 1.05, e o ganho é
       proporcional ao que o desenho tinha. Bloco arejado cede muito; 1.2 cede pouco. */
    let lineHeight = 'none';
    if(n.tipo === 'text' && !n.protegida){
      const lh = n.lineHeight || 1.2;
      const folga = (lh - 1.05) / Math.max(0.01, lh);
      lineHeight = folga <= 0.02 ? 'none' : folga < 0.15 ? 'low' : folga < 0.3 ? 'medium' : 'high';
    }

    /* ── TRACKING ── o degrau 3.7 devolve o tracking que o RENDER somou, e ele só soma em fonte
       display (peso ≥900). Fonte de texto não tem o que devolver — `none`, não `low`. */
    let tracking = 'none';
    if(n.tipo === 'text' && !n.protegida){
      tracking = n.display ? 'medium' : (n.letterSpacing > 0 ? 'low' : 'none');
    }

    // ── ESCALA ── a emergência proporcional do componente. Preço imune não desce com ela.
    let scale = 'none';
    if(!n.protegida && !n.fundo){
      scale = n.decorativa ? 'high' : (n.papel === 'preco' && n.campos.length) ? 'low' : 'medium';
    }

    /* ── CRESCER COMO CONTÊINER ── é a placa seguindo o texto (`_seguirPlacas`), e só existe
       para a forma que a §12 reconheceu como placa de um texto com campo. */
    const resizeContainer = (_placas.has(n.id) && !n.protegida) ? 'high' : 'none';

    // ── REDISTRIBUIR RESPIRO ── o degrau `_respiroFator` 1 → 0.5. É UM degrau fixo, metade —
    // então quem participa participa igual; `medium` para todos, `none` para quem está fora.
    const redistributeSpace = (n.protegida || n.fundo) ? 'none' : 'medium';

    out.set(n.id, { moveX, moveY, wrap, fontShrink, lineHeight, tracking, scale,
                    resizeContainer, redistributeSpace, rigidity:rigidez, motivos:m.sort() });
  });
  return out;
}

/* PERFIS POR TIPO DE COMPONENTE — o que a SEMÂNTICA do bloco permite, acima do que cada membro
   permite sozinho. Não é média dos membros: a média diria que um price-block com placa
   decorativa pode escalar bastante, porque a placa pode. `null` = herda dos membros. */
const G_COMP_ELASTICIDADE = {
  'price-block':         { moveX:'low',  scale:'low',    resizeContainer:'medium',
                           preserveTogether:'high', preserveHierarchy:'high' },
  'cta-block':           { scale:'medium', preserveTogether:'high', preserveHierarchy:'medium' },
  'text-with-plate':     { resizeContainer:'high', preserveTogether:'high', preserveHierarchy:'low' },
  'image-subject-block': { preserveTogether:'high', preserveHierarchy:'low' },
  'legal-block':         { preserveTogether:'medium', preserveHierarchy:'low' },
  'offer-block':         { moveY:'high', wrap:'high', scale:'medium',
                           preserveTogether:'medium', preserveHierarchy:'high' },
  // ⛔ Genérico não ganha NADA por tipo: ele existe para não perder o fato, não para agir.
  'generic-cluster':     {}
};

/**
 * Elasticidade de um COMPONENTE. A do bloco, não a soma das partes.
 *
 * ── HERANÇA, E A EXCEÇÃO QUE IMPORTA ──
 * Para PERMISSÃO a regra é monotônica: `efetiva = min(perfil do tipo, min dos membros)`. Um
 * componente NUNCA torna um membro mais livre numa dimensão que o membro proíbe — é isso que
 * impede um `offer-block` de autorizar o movimento de um logo que caiu dentro dele.
 * Para RIGIDEZ a regra é o contrário, e de propósito: `max` dos membros. Rigidez é CUSTO, não
 * permissão — um bloco que contém o preço é caro de descaracterizar mesmo que o resto dele
 * seja apoio barato. Tratar as duas com a mesma operação é o erro clássico aqui.
 *
 * ⚠ SINGLETON NÃO GANHA COMPORTAMENTO DE GRUPO. Um `cta-block` de um membro só é uma
 * afirmação semântica ("isto é o CTA"), não um bloco composto. Ele herda a elasticidade da
 * própria camada e sai com `preserveTogether: none` — não há o que preservar junto. Sem isso a
 * fase operacional escalaria uma camada solta como se fosse um grupo.
 */
function gCompileComponentElasticity(component, grammar, graph, layerElasticity){
  const el = layerElasticity || gCompileLayerElasticity(grammar, graph);
  const membros = (component && component.membros) || [];
  const dos = membros.map(id => el.get(id)).filter(Boolean);
  if(!dos.length) return null;

  const minMembros = {};
  G_ELASTICITY_DIMENSOES.forEach(d => {
    /* ⚠ SEGUNDA EXCEÇÃO À MONOTONICIDADE: `resizeContainer` agrega por MAX, não por min.
       Ele não é uma permissão que todo membro precise conceder — é uma CAPACIDADE que só o
       membro-contêiner tem. Com `min`, um price-block de placa + texto saía com
       `resizeContainer: none`, porque o TEXTO não é contêiner: a única coisa que sabia crescer
       no bloco era justamente a que o `min` apagava. Ninguém fica mais livre por isso — a placa
       já tinha `high` sozinha, e o perfil do tipo ainda restringe logo abaixo. */
    minMembros[d] = d === 'resizeContainer'
      ? dos.reduce((acc, e) => gElasticityMax(acc, e[d]), 'none')
      : dos.reduce((acc, e) => gElasticityMin(acc, e[d]), 'high');
  });
  const rigidez = dos.reduce((acc, e) => gElasticityMax(acc, e.rigidity), 'none');

  if(component.singleton){
    /* Unitário: a elasticidade É a da camada, sem nenhum verniz de bloco. O tipo continua
       dizendo o que ele significa; a cardinalidade diz o que pode ser feito com ele. */
    return Object.assign({}, minMembros, { rigidity:rigidez, preserveTogether:'none',
      preserveHierarchy:(G_COMP_ELASTICIDADE[component.tipo] || {}).preserveHierarchy || 'low',
      singleton:true, tipo:component.tipo });
  }
  const perfil = G_COMP_ELASTICIDADE[component.tipo] || {};
  const efetiva = {};
  G_ELASTICITY_DIMENSOES.forEach(d => {
    // `min` sempre: o perfil do tipo só RESTRINGE, nunca liberta o que o membro proíbe.
    efetiva[d] = perfil[d] != null ? gElasticityMin(perfil[d], minMembros[d]) : minMembros[d];
  });
  return Object.assign(efetiva, { rigidity:rigidez,
    preserveTogether: perfil.preserveTogether || 'low',
    preserveHierarchy: perfil.preserveHierarchy || 'low',
    singleton:false, tipo:component.tipo });
}

// Elasticidade de todos os componentes de uma vez, indexada por ID.
function gCompileComponentsElasticity(components, grammar, graph, layerElasticity){
  const el = layerElasticity || gCompileLayerElasticity(grammar, graph);
  const out = new Map();
  (components || []).forEach(c => {
    const e = gCompileComponentElasticity(c, grammar, graph, el);
    if(e) out.set(c.id, e);
  });
  return out;
}

/* ════════════════════════════════════════════════════════════════════
   14. IMPACT ZONES — até onde uma mudança pode chegar
   ════════════════════════════════════════════════════════════════════
   Quando o franqueado digita um nome de produto maior, o que o motor tem permissão para
   reconsiderar? Hoje a resposta é implícita e larga: a escada mexe em quem colidir, onde quer
   que esteja. Isso resolve, e é também por isso que uma colisão local já moeu a arte inteira
   pela escala do componente (o degrau `relaxou` existe justamente para conter esse estrago).

   A zona de impacto responde antes: dado um campo, QUAIS elementos podem entrar na conversa, em
   que ordem de proximidade semântica.

   ⛔ NÃO É BFS CEGA. Seguir "todos os vizinhos a N arestas" incluiria alinhamento, contenção e
   sobreposição — e as três descrevem a arte sem transmitir impacto nenhum. A Fase 2.5 provou
   que contenção não implica dependência; a zona obedece à mesma disciplina.

   ⚠ DESCRITIVA. O solver não consulta esta seção. */

/* ARESTAS QUE TRANSMITEM IMPACTO. As mesmas que a Fase 2.5 autorizou como dependência — nada
   de `aligned-*`, `inside`, `contains`, `overlaps-intentionally`, `below`, `right-of`. */
const G_IMPACT_ARESTAS = ['dynamic-dependency','authorial-anchor','plate-of'];
const _G_IMPACT_SET = new Set(G_IMPACT_ARESTAS);

/**
 * A zona de impacto de UM campo dinâmico.
 *
 * ── DIREÇÃO ── impacto tem sentido, e os dois sentidos não são equivalentes. O título que
 * cresce empurra o CTA; o CTA que cresce NÃO autoriza recompor o título. Por isso a expansão é
 * DOWNSTREAM (quem depende de mim), seguindo as arestas ao contrário — `dynamic-dependency` vai
 * do dependente para a origem, então os dependentes são as arestas de ENTRADA.
 * `upstream` é calculado e devolvido à parte, como informação, NUNCA somado aos níveis.
 *
 * @returns {{rootId, levels:{0..4}, upstream, componentes, arestas, impactSignature}}
 */
function gCompileImpactZones(graph, components, rootId, _idsOrdenados){
  const G = graph || {};
  const comps = components || [];
  /* `_idsOrdenados` é o mesmo array para todas as zonas da arte, passado por
     `gCompileAllImpactZones`. Sem ele, cada zona reordenava as 344 camadas de novo só para
     montar o nível 4 — 75 ordenações idênticas numa arte grande. Chamada avulsa continua
     funcionando: ordena a sua. */
  const todos = _idsOrdenados || (G.nodes || []).map(n => n.id).sort();
  const usados = new Set([rootId]);
  const arestasUsadas = new Set();
  const compsEnvolvidos = new Set();

  // ── NÍVEL 0 ── só a camada do campo que mudou.
  const L0 = [rootId];

  // ── NÍVEL 1 ── o Layout Component dela. É a unidade que o designer reconheceria.
  const c0 = comps.filter(c => c.nivel === 0 && c.membros.indexOf(rootId) >= 0)
                  .sort((a,b) => a.id < b.id ? -1 : 1)[0] || null;
  const L1 = [];
  if(c0){
    compsEnvolvidos.add(c0.id);
    c0.membros.forEach(m => { if(!usados.has(m)){ usados.add(m); L1.push(m); } });
  }

  /* ── NÍVEL 2 ── os DEPENDENTES diretos e transitivos, só pelas arestas que transmitem
     impacto. Guarda de ciclo por `Set`: o designer consegue marcar A→B e B→A à mão. */
  const L2 = [];
  const fila = [rootId].concat(L1);
  const vistos = new Set(fila);
  let guarda = 0;
  /* UMA passada sobre as arestas de entrada, testando o tipo por pertencimento. Antes eram
     TRÊS `gGraphIncoming(G, atual, tipo)` por nó, e cada um filtra a lista inteira alocando um
     array novo. Medido nesta arte: 14,1 arestas de entrada por nó, travessia média de 30 nós,
     75 zonas — ~180 mil alocações só para descartar a maior parte delas. Foi o custo real das
     zonas, e não o nível 4 que eu suspeitava. */
  while(fila.length && guarda++ < 4096){
    const atual = fila.shift();
    const entradas = G._entrada ? (G._entrada.get(atual) || []) : gGraphIncoming(G, atual);
    for(let k = 0; k < entradas.length; k++){
      const e = entradas[k];                            // ENTRADA = quem depende de mim
      if(!_G_IMPACT_SET.has(e.tipo) || !gGraphIsStructural(e) || vistos.has(e.de)) continue;
      arestasUsadas.add(e.tipo);
      vistos.add(e.de); fila.push(e.de);
      if(!usados.has(e.de)){ usados.add(e.de); L2.push(e.de); }
    }
  }

  /* ── NÍVEL 3 ── a SEÇÃO semântica: o componente-pai (offer-block), os componentes de nível 0
     que já entraram por seus membros, e o grupo autoral. Ramo de leitura entra só quando um
     componente daquele ramo já está envolvido — sozinho ele é geografia, não semântica. */
  const L3 = [];
  const _entra = (id) => { if(!usados.has(id)){ usados.add(id); L3.push(id); } };
  comps.forEach(c => {
    if(!c.membros.some(m => usados.has(m))) return;
    compsEnvolvidos.add(c.id);
    if(c.nivel === 1 || c.membros.some(m => L2.indexOf(m) >= 0)) c.membros.forEach(_entra);
  });

  /* ── NÍVEL 4 ── o resto da composição. Fallback de EMERGÊNCIA — e por isso ele é LAZY.
     Materializá-lo custava "todo o resto" vezes "uma zona por campo": numa arte de 344 camadas
     com 75 campos, 26 mil ids copiados para produzir uma lista que a busca de candidatos quase
     nunca vai abrir (a adaptação normal vive em L0–L2). Medido: 9,5ms só nisso.
     A zona guarda o CONJUNTO do que já entrou e a CONTAGEM do que sobrou; quem precisar de
     verdade chama `gImpactLevelMembers(zona, 4, graph)` e paga ali. O determinismo não muda:
     a lista sai da mesma ordenação de sempre. */
  const restantes = todos.length - usados.size;

  /* ── UPSTREAM ── de quem ESTA camada depende. Devolvido à parte e nunca somado aos níveis:
     mudar o CTA não autoriza recompor o título que o empurra. */
  const upstream = [];
  const vistoUp = new Set([rootId]);
  const filaUp = [rootId];
  let g2 = 0;
  while(filaUp.length && g2++ < 4096){
    const atual = filaUp.shift();
    const saidas = G._saida ? (G._saida.get(atual) || []) : gGraphOutgoing(G, atual);
    for(let k = 0; k < saidas.length; k++){
      const e = saidas[k];
      if(!_G_IMPACT_SET.has(e.tipo) || !gGraphIsStructural(e) || vistoUp.has(e.para)) continue;
      vistoUp.add(e.para); filaUp.push(e.para); upstream.push(e.para);
    }
  }

  const zona = { rootId:rootId,
    levels: { 0:L0, 1:L1.sort(), 2:L2.sort(), 3:L3.sort() },
    // O que os níveis 0–3 já cobrem, e quantos sobraram para o nível 4.
    dentro: usados, restantes: restantes,
    upstream: upstream.sort(),
    componentes: [...compsEnvolvidos].sort(),
    arestas: [...arestasUsadas].sort() };
  /* ASSINATURA — estrutura pura: raiz, membros por nível, tipos de aresta usados e componentes
     envolvidos. Sem geometria e sem conteúdo, então mover uma camada sem mudar dependência
     nenhuma devolve a MESMA assinatura. O nível 4 entra como CONTAGEM: ele é "todo o resto", e
     listá-lo faria qualquer camada nova longe dali parecer mudança de zona. */
  zona.impactSignature = _gGramHash([
    'r=' + rootId,
    'l0=' + L0.join('+'), 'l1=' + zona.levels[1].join('+'),
    'l2=' + zona.levels[2].join('+'), 'l3=' + zona.levels[3].join('+'),
    'l4n=' + restantes,
    'e=' + zona.arestas.join('+'), 'c=' + zona.componentes.join('+')
  ].join('#'));
  return zona;
}

/**
 * Uma zona por CAMPO DINÂMICO da arte — não uma por camada. As zonas de duas raízes
 * INDEPENDENTES ficam independentes: nada as funde aqui, e só a composição (um offer-block que
 * contenha as duas) pode ligá-las num nível superior.
 * @returns {Map<string,object>} rootId → zona
 */
function gCompileAllImpactZones(graph, components){
  const G = graph || {};
  const raizes = new Set();
  (G.nodes || []).forEach(n => { if(n.campos && n.campos.length) raizes.add(n.id); });
  (components || []).forEach(c => (c.dynamicRoots || []).forEach(r => raizes.add(r)));
  const out = new Map();
  const ids = (G.nodes || []).map(n => n.id).sort();
  [...raizes].sort().forEach(r => out.set(r, gCompileImpactZones(G, components, r, ids)));
  return out;
}

/**
 * Os membros de UM nível. Os níveis 0–3 já estão prontos; o 4 é DERIVADO na hora, porque é
 * emergência e quase ninguém vai pedir. Precisa do grafo para saber o que é "todo o resto".
 * @returns {string[]} ordenado — a mesma ordem que a versão materializada produzia
 */
function gImpactLevelMembers(zona, nivel, graph){
  if(!zona) return [];
  if(nivel !== 4) return (zona.levels[nivel] || []).slice();
  if(!graph) return [];                     // sem contexto não se inventa o resto da arte
  return (graph.nodes || []).map(n => n.id).filter(id => !zona.dentro.has(id)).sort();
}

// Diagnóstico legível — para teste e console da casa, nunca para UI de usuário.
function gDescribeImpactZone(zona){
  if(!zona) return '';
  const linha = (n) => 'L' + n + ': ' + (zona.levels[n].length ? zona.levels[n].join(', ') : '—');
  return [zona.rootId, linha(0), linha(1), linha(2), linha(3),
          'L4: ' + zona.restantes + ' restantes'].join('\n');
}

/* ════════════════════════════════════════════════════════════════════
   15. OPERATIONAL CAPABILITY — o contrato de paridade com o solver
   ════════════════════════════════════════════════════════════════════
   A §13 descreve LIBERDADE: "esta camada pode, em princípio, encolher". Isso não é a mesma
   coisa que "o motor consegue encolher esta camada agora". Uma fonte de 13px num piso de
   legibilidade de 13px tem `fontShrink: medium` e ZERO espaço real.

   Se a próxima fase gerar ações só porque `elasticity.moveY === 'high'`, ela vai propor coisas
   que a escada não executa — e descobrir isso só depois de rodar o solver, por tentativa. Esta
   seção é o portão que evita isso:

       elasticidade permite  E  o motor real consegue  →  pode tentar

   ⛔ NÃO É UM SEGUNDO MOTOR. Não há aqui nenhuma reimplementação de piso, preço, corrente,
   placa, tracking, entrelinha, quebra ou limite de arte. Tudo sai das primitivas que o próprio
   solver chama: `gLayoutPisoFonte`, `gLayoutTrackingEfetivo`, `gLayoutPodeAcompanhar`,
   `gLayoutColapsoEntre`, `gLineHeightDe`, `gLayoutRoleMaxLines`. São CONSULTAS.

   ⚠ NADA AQUI EXECUTA. Não move, não encolhe, não escala, não gera candidato, não busca.
   Responde `{permitido, motivo, origem}` e para. */

/* VOCABULÁRIO FECHADO DE AÇÕES — só IDs e metadados. A implementação é da fase seguinte; o
   nome existe agora para que ela já nasça com vocabulário consistente. Cada ação aponta para a
   dimensão de elasticidade que a permite e para a capacidade que confirma que o motor executa. */
const G_LAYOUT_ACOES = {
  'wrap-text':            { dimensao:'wrap',              capacidade:'canWrap',               alvo:'layer',
                            degrau:'quebrar linha dentro do corredor disponível' },
  'compress-gap':         { dimensao:'redistributeSpace', capacidade:'canCompressSpacing',    alvo:'layer',
                            degrau:'apertar o respiro mínimo antes de mexer na tipografia' },
  'compress-line-height': { dimensao:'lineHeight',        capacidade:'canCompressLineHeight', alvo:'layer',
                            degrau:'fechar a entrelinha até o piso de 1.05' },
  'restore-tracking':     { dimensao:'tracking',          capacidade:'canRestoreTracking',    alvo:'layer',
                            degrau:'devolver o tracking que o render somou (fonte display)' },
  'push-dependent':       { dimensao:'moveY',             capacidade:'canMoveY',              alvo:'layer',
                            degrau:'empurrar o bloco de baixo pela corrente' },
  'resize-container':     { dimensao:'resizeContainer',   capacidade:'canResizeContainer',    alvo:'layer',
                            degrau:'a placa acompanha a tinta do texto' },
  'shrink-text':          { dimensao:'fontShrink',        capacidade:'canShrinkFont',         alvo:'layer',
                            degrau:'reduzir o corpo do menor degrau que ainda tem folga' },
  'scale-component':      { dimensao:'scale',             capacidade:'canScaleComponent',     alvo:'component',
                            degrau:'escala proporcional do componente (último recurso)' },
  /* `collapse-empty-gap` NÃO tem dimensão de elasticidade, e isso é a decisão: subir para fechar
     o vão de um campo em branco é semanticamente diferente de "pode mover em Y". Enfiá-la em
     `moveY` transformaria um crédito de valor exato numa liberdade geral de movimento. */
  'collapse-empty-gap':   { dimensao:null,                capacidade:'canCollapseGap',        alvo:'layer',
                            degrau:'fechar exatamente o vão que o campo vazio deixou' }
};

const _gCapOk  = (motivo, detalhe) => Object.assign({ permitido:true,  motivo:motivo, origem:'regra-do-solver' }, detalhe || {});
const _gCapNao = (motivo, detalhe) => Object.assign({ permitido:false, motivo:motivo, origem:'regra-do-solver' }, detalhe || {});

/**
 * O CONTEXTO operacional: tudo o que as consultas precisam, compilado uma vez.
 * Construir por consulta seria recompilar a arte inteira a cada pergunta — e a busca de
 * candidatos vai perguntar milhares de vezes.
 *
 * ⚠ NÃO MUTA as camadas recebidas. `gStampPisosHierarquia` escreve `_pisoFonte`/`_pisoLegivel`,
 * então ele roda sobre CLONES — os mesmos pisos que a escada usa, sem tocar no template.
 */
function gBuildOperationalContext(layers, canvas, opts){
  const o = opts || {};
  const cv = canvas || { w:0, h:0 };
  const clones = (layers || []).map(l => Object.assign({}, l));
  if(typeof gStampPisosHierarquia === 'function') gStampPisosHierarquia(clones, cv.w ? cv : null);
  const grammar = o.grammar || gCompileLayoutGrammar(layers, cv);
  const graph = o.graph || gCompileCompositionGraph(grammar);
  const components = o.components || gCompileLayoutComponents(grammar, graph);
  const elasticity = o.elasticity || gCompileLayerElasticity(grammar, graph);
  return {
    canvas: cv, grammar, graph, components, elasticity,
    componentElasticity: o.componentElasticity
      || gCompileComponentsElasticity(components, grammar, graph, elasticity),
    // Índices: a busca de candidatos consulta muito, e `.find()` linear aqui seria o gargalo.
    _camada: new Map(clones.map(l => [l.id, l])),
    _no: new Map((grammar.nodes || []).map(n => [n.id, n])),
    _placa: new Set((graph.edges || []).filter(e => e.tipo === 'plate-of').map(e => e.de)),
    /* A TINTA AUTORADA dos textos que são alvo de placa — medida com `gFitTextLayer`, o motor
       único de encaixe. Só esses: medir a arte inteira custaria o que o solver custa, e mais
       ninguém aqui precisa. */
    /* UM contexto 2D para a sessão inteira de consultas e ações. Medir é caro; criar canvas
       por chamada seria pior. Quem não tem Canvas (Node puro) recebe `null` e as funções que
       dependem de medida dizem que não sabem, em vez de chutar. */
    _ctx2d: (function(){
      try{ return (typeof document !== 'undefined') ? document.createElement('canvas').getContext('2d') : null; }
      catch(e){ return null; }
    })(),
    /* A TINTA AUTORADA de cada texto — o que o designer via na tela, medido com `gFitTextLayer`
       (o motor único de encaixe). É a referência de TODO dano objetivo: "cresceu" é a tinta de
       agora contra esta, e "colidiu" é o par de agora contra o par daqui.
       É o mesmo trabalho que `_gLayoutBaseVisual` faz dentro do solve; pagá-lo uma vez por
       contexto é o que permite ao detector responder sem rodar o solver inteiro. */
    _tinta: (function(){
      const m = new Map();
      if(typeof gFitTextLayer !== 'function' || typeof document === 'undefined') return m;
      let cx = null;
      try{ cx = document.createElement('canvas').getContext('2d'); }catch(e){ return m; }
      clones.forEach(l => {
        if(!l || l.type !== 'text' || l.vertical) return;
        const ref = l.layoutRefText || ((typeof gLayoutTextoAutorado === 'function') ? gLayoutTextoAutorado(l) : '');
        /* SEM REFERÊNCIA, A CAIXA DESENHADA É A REFERÊNCIA — exatamente o que
           `_gLayoutBaseVisual` faz no solve. Template antigo e campo sem exemplo no catálogo não
           têm texto autorado para medir, e devolver "não sei" aqui cegava o detector inteiro:
           sem base, "cresceu" e "colidiu" não têm contra o que ser medidos, e uma arte que
           estoura era reportada como saudável. */
        if(!ref){ m.set(l.id, { x:l.x||0, y:l.y||0, w:l.w||0, h:l.h||0, linhas:1, daCaixa:true }); return; }
        try{
          const f = gFitTextLayer(gLayoutLimpaCarimbos(l), String(ref), cx, { encolher:false });
          const caixa = (l.textBox === 'box');
          const w = caixa ? (l.w || 0) : (f.larguraMax || l.w || 0);
          m.set(l.id, { x:(l.x||0) + (caixa ? 0 : _gInkDx(l, w)), y:(l.y||0) + _gInkDy(l, f.altura),
                        w:w, h:f.altura || l.h || 0, linhas:(f.lines && f.lines.length) || 1 });
        }catch(e){ m.set(l.id, { x:l.x||0, y:l.y||0, w:l.w||0, h:l.h||0, linhas:1, daCaixa:true }); }
      });
      return m;
    })(),
    _compDe: new Map(),
    // Valores do franqueado, quando houver: só o colapso de campo vazio depende deles.
    dados: o.dados || null
  };
}

/**
 * Uma CAPACIDADE do motor real sobre um alvo. Não executa nada.
 * @returns {{permitido:boolean, motivo:string, origem:string, ...detalhe}}
 */
function gLayoutCapability(ctx, targetId, capacidade){
  if(!ctx) return _gCapNao('sem-contexto');
  const l = ctx._camada.get(targetId);       // o clone COM os pisos carimbados
  const n = ctx._no.get(targetId);
  if(!l || !n) return _gCapNao('alvo-inexistente');
  const texto = n.tipo === 'text';

  switch(capacidade){

    case 'canWrap': {
      if(!texto) return _gCapNao('nao-e-texto');
      if(l.vertical) return _gCapNao('texto-vertical');
      /* A MESMA exclusão de `_gInferirCorredores`: rich text e preço partido em runs têm
         métrica por trecho e não viram caixa de quebra — separar símbolo/inteiro/centavos
         destruiria o agrupamento semântico. */
      if((l.runs && l.runs.length) || /:\s*(?:inteiro|centavos)/.test(l.content || ''))
        return _gCapNao('metrica-por-run');
      const teto = (typeof gLayoutRoleMaxLines === 'function') ? gLayoutRoleMaxLines(n.papel) : 4;
      if(teto <= 1) return _gCapNao('teto-de-uma-linha', { maxLinhas:teto });
      return _gCapOk('quebra-disponivel', { maxLinhas:teto });
    }

    case 'canShrinkFont': {
      if(!texto) return _gCapNao('nao-e-texto');
      if(n.protegida || n.fundo) return _gCapNao('protegida');
      /* AQUI ESTÁ O PONTO DA FASE. A elasticidade classificou o PAPEL como flexível; a
         capacidade pergunta se existe espaço REAL entre o corpo atual e o piso — e o piso
         depende do lado curto do canvas (`_pisoLegivel`), que a elasticidade não tinha. */
      const atual = Math.round(l.fontSize || 24);
      const piso = (typeof gLayoutPisoFonte === 'function') ? gLayoutPisoFonte(l, false) : 8;
      const det = { atual, piso, folga: atual - piso };
      if(piso >= atual) return _gCapNao('no-piso', det);
      /* O preço dinâmico cede — mas só por causa dele mesmo (`_gLayoutPrecoImune`, regra de
         19/08). Não é bloqueio, é condição, e quem gerar a ação precisa saber disso. */
      if(n.papel === 'preco' && n.campos.length)
        return _gCapOk('folga-disponivel', Object.assign({ soPorSiMesmo:true }, det));
      return _gCapOk('folga-disponivel', det);
    }

    case 'canCompressLineHeight': {
      if(!texto) return _gCapNao('nao-e-texto');
      if(n.protegida) return _gCapNao('protegida');
      const lh = (typeof gLineHeightDe === 'function') ? gLineHeightDe(l) : (l.lineHeight || 1.2);
      const piso = 1.05;
      if(lh <= piso + 0.01) return _gCapNao('no-piso-da-entrelinha', { atual:lh, piso });
      /* ⚠ O degrau também exige MAIS DE UMA LINHA, e isso depende do conteúdo que o franqueado
         digitou — a capacidade estrutural não sabe. Fica declarado em vez de prometido. */
      return _gCapOk('folga-de-entrelinha', { atual:lh, piso, exigeMultiplasLinhas:true });
    }

    case 'canRestoreTracking': {
      if(!texto) return _gCapNao('nao-e-texto');
      if(l.vertical) return _gCapNao('texto-vertical');
      const t = (typeof gLayoutTrackingEfetivo === 'function') ? gLayoutTrackingEfetivo(l) : 0;
      if(!(t > 0.01)) return _gCapNao('sem-tracking-a-devolver', { efetivo:t, display:!!n.display });
      return _gCapOk('tracking-a-devolver', { efetivo:t, display:!!n.display, umaVezPorCamada:true });
    }

    case 'canMoveX':
    case 'canMoveY': {
      const manual = gGraphOutgoing(ctx.graph, targetId, 'authorial-anchor').length > 0;
      // Declaração do designer vence a heurística — é a precedência de toda a cascata.
      if(manual) return _gCapOk('ancora-autoral', { autorada:true });
      if(n.protegida || n.fundo) return _gCapNao('protegida');
      if(n.papel === 'preco' && n.campos.length)
        return _gCapNao('bloco-de-preco-nao-sai-do-lugar');
      if(n.podeAcompanhar === false) return _gCapNao('nao-pode-acompanhar-corrente');
      return _gCapOk('pode-ser-empurrada');
    }

    case 'canResizeContainer': {
      if(!ctx._placa.has(targetId)) return _gCapNao('nao-e-placa-de-ninguem');
      if(n.protegida) return _gCapNao('protegida');
      /* IDENTIDADE e REAÇÃO são perguntas diferentes. Ser placa é estrutural (a §10 já provou);
         CRESCER só faz sentido se o texto de dentro puder mudar de tamanho — `_gInferirPlacas`
         exige `_gLayoutTemCampo(t)` pelo mesmo motivo: placa de texto fixo não reage. */
      const alvo = (ctx.graph.edges || []).find(e => e.tipo === 'plate-of' && e.de === targetId);
      const texto = alvo && ctx._no.get(alvo.para);
      if(!texto || !texto.campos.length)
        return _gCapNao('texto-sem-campo-nao-faz-a-placa-crescer');
      /* ⚠ O TETO DE ÁREA SE MEDE CONTRA A TINTA, NÃO CONTRA A CAIXA — e é aqui que a paridade
         se ganha ou se perde. A gramática é geometria pura e só tem a caixa AUTORADA; o solver
         compara com a TINTA medida (`_gLayoutBaseVisual`). Numa caixa de parágrafo larga com
         pouco texto os dois discordam, e a capacidade prometeria uma placa que a cascata se
         recusa a fazer crescer.
         Então aqui se mede — com `gFitTextLayer`, o MESMO encaixe do solver e do render, nunca
         uma medida paralela. Sem ele carregado (contexto sem Canvas), cai na caixa autorada e
         DIZ que a resposta é aproximada, em vez de fingir precisão. */
      const ink = ctx._tinta.get(alvo.para);
      const ok = gLayoutFormaEhPlaca(ctx._camada.get(targetId), n.rect, ink || texto.rect);
      if(!ok) return _gCapNao('painel-nao-e-placa', { medidoNaTinta:!!ink });
      return _gCapOk('placa-acompanha-o-texto',
        { texto:alvo.para, medidoNaTinta:!!ink, aproximado:!ink });
    }

    case 'canCompressSpacing': {
      if(n.protegida || n.fundo) return _gCapNao('protegida');
      /* ⚠ DISCRETO, NÃO CONTÍNUO. O motor tem UM degrau: `_respiroFator` 1 → 0.5. Prometer
         três níveis de compressão descreveria uma escada que não existe. A elasticidade pode
         seguir usando nível para CUSTO; a capacidade informa o degrau real. */
      return _gCapOk('um-degrau-disponivel', { degraus:1, fator:0.5 });
    }

    case 'canCollapseGap': {
      /* O crédito de subida da corrente. Estrutural: existe, entre esta camada e o pai dela na
         corrente, um texto com campo que sumiu? A conta é a MESMA do solver
         (`gLayoutColapsoEntre`), não uma paralela. */
      if(!ctx.dados) return _gCapNao('sem-dados-do-franqueado');
      const vazio = (v) => {
        const campos = (typeof gLayoutCamposDe === 'function') ? gLayoutCamposDe(v) : [];
        return campos.length > 0 && campos.every(c => String(ctx.dados[c] == null ? '' : ctx.dados[c]).trim() === '');
      };
      /* SOBE ATÉ QUEM AINDA TEM TINTA. O solver tira as camadas vazias de `nós` antes de inferir
         a corrente, então o pai REAL do alvo, quando o campo opcional some, é o primeiro
         ancestral que ainda ocupa espaço. Medir a partir do pai da arte AUTORADA daria vão zero
         — o vão é justamente a camada que sumiu, e ela é o pai na arte cheia. */
      let atual = targetId, pai = null, guarda = 0;
      while(guarda++ < 16){
        const e = gGraphOutgoing(ctx.graph, atual, 'dynamic-dependency')[0]
               || gGraphOutgoing(ctx.graph, atual, 'authorial-anchor')[0];
        if(!e) break;
        const cand = ctx._no.get(e.para), camadaCand = ctx._camada.get(e.para);
        if(!cand) break;
        if(!(camadaCand && vazio(camadaCand))){ pai = cand; break; }
        atual = e.para;                                  // este sumiu: o vão é dele
      }
      if(!pai) return _gCapNao('sem-corrente');
      const camadas = [...ctx._camada.values()];
      const r = gLayoutColapsoEntre(camadas, pai.rect.y + pai.rect.h, n.rect.y,
                                    n.rect.x, n.rect.x + n.rect.w, vazio);
      if(!(r.soma > 0) || !r.temCampo) return _gCapNao('sem-vao-a-fechar', { credito:r.soma });
      return _gCapOk('vao-de-campo-vazio', { credito:r.soma });
    }

    default: return _gCapNao('capacidade-desconhecida');
  }
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
   MODO NORMAL × MODO EMERGÊNCIA — a mesma escada, dois pisos
   ══════════════════════════════════════════════════════════════════════════════════════════
   O piso de emergência NÃO é invenção desta camada: a escada já desce até ele quando ninguém
   mais tem folga normal (`relaxou` em `gApplyRelativeAnchors`). O que faltava era a busca
   saber disso — ela parava no piso normal e declarava "sem saída" onde o motor continuava.

   ⛔ EMERGÊNCIA NÃO MUDA ELASTICIDADE. `fontShrink` continua descrevendo a preferência normal
   do papel; papel que proíbe encolher continua proibindo. Emergência é uma CAPACIDADE à parte,
   com porta própria (`gLayoutCanEmergencyShrink`), e a ÚNICA coisa que ela muda é o piso.
   Protegida, fundo, zona de impacto, componente e hierarquia continuam valendo iguais.

   ⛔ E NÃO É PADRÃO. A busca roda o modo normal inteiro primeiro; emergência só começa quando
   o normal esgotou e o dano objetivo continua. Menor sacrifício primeiro. */
const G_SEARCH_MODOS = ['normal', 'emergency'];

/**
 * O PISO QUE VALE PARA ESTA CAMADA NESTE MODO — a régua única de "até onde dá para encolher".
 *
 * NORMAL: `gLayoutPisoFonte(l,false)` — metade do corpo desenhado, o piso de hierarquia autoral
 * e o de legibilidade, empilhados. É o degrau 4 da escada.
 *
 * EMERGENCY: `gLayoutPisoFonte(l,true)` (só legibilidade) MAIS o piso de hierarquia EXTERNO
 * (`gLayoutPisoHierarquiaExterno`) — a mesma trava que o motor aplica no degrau proporcional.
 * Sem ela, emergência viraria licença para o título passar por baixo do preço, que é exatamente
 * o que o solver se recusa a fazer.
 *
 * @param {Array} camadas o estado ATUAL (os corpos já reduzidos contam como piso externo)
 * @param {Set|Array} [grupo] quem desce junto — não conta como piso
 */
function gLayoutPisoDoModo(camadas, l, modo, grupo, indice){
  if(!l || typeof gLayoutPisoFonte !== 'function') return 8;
  if(modo !== 'emergency') return gLayoutPisoFonte(l, false);
  const legivel = gLayoutPisoFonte(l, true);
  const hier = (typeof gLayoutPisoHierarquiaExterno === 'function')
    ? gLayoutPisoHierarquiaExterno(camadas || [], l, grupo || [l.id], false, indice) : 0;
  return Math.max(legivel, hier);
}

/**
 * A CAPACIDADE DE EMERGÊNCIA — porta própria, nunca confundida com `canShrinkFont`.
 *
 * Responde só a uma pergunta: entre o corpo ATUAL e o piso de EMERGÊNCIA desta camada, ainda
 * existe degrau? Tudo o mais que bloqueia o encolhimento normal continua bloqueando aqui —
 * protegida, fundo, papel que não é texto. Emergência não compra imunidade, compra piso.
 *
 * @param {Array} [camadas] o estado atual; sem ele, cai no clone autorado do contexto
 * @returns {{permitido, motivo, origem, atual?, piso?, folga?, degraus?}}
 */
function gLayoutCanEmergencyShrink(ctx, targetId, camadas){
  if(!ctx) return _gCapNao('sem-contexto');
  const n = ctx._no.get(targetId);
  const autorada = ctx._camada.get(targetId);
  if(!n || !autorada) return _gCapNao('alvo-inexistente');
  if(n.tipo !== 'text') return _gCapNao('nao-e-texto');
  if(n.protegida || n.fundo) return _gCapNao('protegida');
  /* O corpo atual sai do estado do candidato; os PISOS carimbados (`_pisoLegivel`) saem do clone
     do contexto, que é onde `gStampPisosHierarquia` escreveu. Misturar os dois é de propósito:
     um é estado, o outro é o desenho. */
  const vivo = (camadas || []).find(x => x && x.id === targetId) || autorada;
  const medida = Object.assign({}, autorada, { _tetoFonte: vivo._tetoFonte });
  const atual = Math.round(gLayoutCorpoAtual(medida));
  const piso = Math.round(gLayoutPisoDoModo(camadas || [...ctx._camada.values()], medida, 'emergency'));
  const det = { atual, piso, folga: atual - piso,
                pisoNormal: Math.round(gLayoutPisoFonte(autorada, false)) };
  if(piso >= atual) return _gCapNao('no-piso-de-emergencia', det);
  /* Quantos degraus de 8% cabem daqui até o piso. É o número que a corrida monotônica precisa:
     em emergência a escada não para em quatro voltas, ela desce até o piso. */
  det.degraus = Math.max(1, Math.ceil(Math.log(piso / atual) / Math.log(0.92)));
  return _gCapOk('folga-de-emergencia', det);
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
   ADAPTIVE SCALE GROUP — quem precisa adaptar JUNTO para este conflito
   ══════════════════════════════════════════════════════════════════════════════════════════
   ⛔ NÃO É COMPONENTE, e confundir os dois foi o último buraco de cobertura.

     Component        = "quem pertence junto SEMANTICAMENTE" (bloco de preço, CTA, oferta).
                        Estável, autoral, serve a hierarquia, a `preserve-together` e ao
                        scoring que vem depois. Não muda porque a copy mudou.
     Adaptive group   = "quem precisa descer junto para resolver ESTE conflito, AGORA".
                        Nasce do estado, morre com ele, e só existe para a ação operacional.

   O solver já tinha o segundo, sem nome, dentro do degrau `relaxou`: ele semeia o conjunto com
   os culpados das colisões e expande até o ponto fixo por TRÊS relações — colisão atual, âncora
   (autoral ou inferida) e placa. É esse fecho que se reproduz aqui, pelas arestas do Graph que
   significam a mesma coisa (`G_GRAPH_DEPENDENCIA` = authorial-anchor, plate-of,
   dynamic-dependency) mais as colisões medidas no estado assentado.

   ⛔ PROXIMIDADE NÃO EXPANDE NADA. `aligned`, `near`, `inside`, `same-column` e companhia são
   relações DESCRITIVAS: dois blocos na mesma margem não descem juntos por isso. Deixá-las
   entrar transformaria "o bloco que está brigando" em "metade da arte", que é exatamente o que
   o comentário do solver diz que ele não quer fazer. */
const G_SCALE_GROUP_RELACOES = G_GRAPH_DEPENDENCIA.concat(['collision']);

/**
 * O GRUPO OPERACIONAL para um conflito, derivado do estado atual.
 *
 * @param {object} ctx      de `gBuildOperationalContext`
 * @param {object} estado   {layers, solveState} JÁ ASSENTADO — colisão se mede no que o motor julga
 * @param {object} grupoProblema um grupo de `gGroupLayoutProblems`
 * @param {Array}  [problemas] a lista completa do estado (evita redetectar)
 * @returns {{id, membros, semente, expandiuPor, signature, escalaveis}}
 */
function gBuildAdaptiveScaleGroup(ctx, estado, grupoProblema, problemas, previo){
  const st = _gEstado(estado);
  const idx = new Map(st.layers.map(l => [l.id, l]));
  const todos = problemas || gDetectLayoutProblems(st, ctx);
  /* SEMENTE = os culpados provados do conflito, MAIS o que já entrou no grupo antes neste mesmo
     ramo. A memória não é conveniência: o solver mantém o conjunto enquanto o degrau
     proporcional roda, e no `de-por-lateral` é exatamente ela que decide o caso. O "por" entra
     porque colidiu com o "produto"; a colisão é resolvida pela primeira escala; e se o grupo
     esquecer o "por" na volta seguinte ele volta a contar como PISO EXTERNO e trava o "produto"
     no mesmo 84 de onde se partiu. Fato provado uma vez neste ramo continua valendo nele.
     ⚠ Só entra quem ainda existe no estado, e a memória é do RAMO — não vaza entre candidatos
     irmãos, que é o que manteria a busca determinística e cada caminho isolado. */
  const semente = [...new Set((grupoProblema && grupoProblema.problems || []).map(p =>
    (p.detalhe && p.detalhe.culpado) || p.targetId).concat(previo || []))]
    .filter(id => idx.has(id)).sort();
  const membros = new Set(semente);
  const expandiuPor = { collision:[], 'authorial-anchor':[], 'plate-of':[], 'dynamic-dependency':[] };
  // Os pares de colisão do estado ATUAL — o mesmo `_ultimasColisoes` que o solver percorre.
  const pares = todos.filter(p => p.tipo === 'collision' && p.withId)
    .map(p => [p.targetId, p.withId]);
  /* FILA DE TRABALHO, não varredura. O fecho é o mesmo; o que muda é só visitar cada membro
     UMA vez em vez de reprocessar o conjunto inteiro a cada rodada — numa arte grande o grupo
     chega a uma centena de camadas, e refazê-lo a cada volta era o custo dominante da busca. */
  const fila = [...membros];
  let guarda = 0;
  while(fila.length && guarda++ < 4096){
    const id = fila.shift();
    /* As arestas de DEPENDÊNCIA, nos dois sentidos — âncora autoral, placa e corrente
       autorizada. São as mesmas três relações do laço do solver, e só elas. */
    G_GRAPH_DEPENDENCIA.forEach(tipo => {
      gGraphOutgoing(ctx.graph, id, tipo).concat(gGraphIncoming(ctx.graph, id, tipo))
        .filter(e => gGraphIsStructural(e))
        .forEach(e => {
          [e.de, e.para].forEach(outro => {
            if(idx.has(outro) && !membros.has(outro)){
              membros.add(outro); expandiuPor[tipo].push(outro); fila.push(outro);
            }
          });
        });
    });
    // E as colisões medidas AGORA: quem está brigando com um membro entra no grupo.
    pares.forEach(([a, b]) => {
      if(a !== id && b !== id) return;
      [a, b].forEach(outro => {
        if(idx.has(outro) && !membros.has(outro)){
          membros.add(outro); expandiuPor.collision.push(outro); fila.push(outro);
        }
      });
    });
  }
  const lista = [...membros].sort();
  /* QUEM DE FATO DESCE. A mesma regra do solver: texto visível, e o preço dinâmico que NÃO
     cedeu nada fica de fora (a escala comum é motivo alheio — `_gLayoutPrecoImune`). */
  const escalaveis = lista.filter(id => {
    const l = idx.get(id), n = ctx._no.get(id);
    if(!l || l.type !== 'text' || !n || !n.visivel) return false;
    if(n.protegida || n.fundo) return false;
    const cedeu = l._tetoFonte != null || l._entrelinha != null || l._layoutW != null;
    const imune = (typeof gLayoutEhPrecoDinamico === 'function') && gLayoutEhPrecoDinamico(l);
    return cedeu || !imune;
  });
  const signature = _gGramHash('asg1#' + lista.join('+') + '#' + escalaveis.join('+'));
  Object.keys(expandiuPor).forEach(k => { expandiuPor[k] = [...new Set(expandiuPor[k])].sort(); });
  /* `provado` = este grupo carrega membros que entraram por conflito REAL antes, neste ramo. É
     o que autoriza a escala quando o problema que sobrou não tem culpado (ver a guarda do §11
     em `gGenerateLayoutActions`). */
  return { id:'asg:' + signature, membros:lista, semente, expandiuPor, escalaveis, signature,
           provado:(previo || []).length > 0 };
}

/**
 * A CAPACIDADE DE EMERGÊNCIA DO COMPONENTE — o degrau proporcional, medido.
 *
 * É AQUI que a emergência compra alguma coisa de verdade. Encolher UMA camada sozinha esbarra no
 * piso de hierarquia externo quase sempre (quem ficou parado e era menor vira piso), e é assim
 * que o solver se comporta também. O que ele faz de diferente no degrau `relaxou` é descer o
 * COMPONENTE INTEIRO na mesma escala: aí quem era menor desce junto, sai da conta do piso, e o
 * grupo alcança a legibilidade.
 *
 * Esta função responde quantas voltas de 0,92 ainda cabem — o mesmo laço do motor, que só para
 * quando ninguém mais desce. O teto global de 0,35 da escala também é dele, não inventado aqui.
 *
 * @returns {{permitido, motivo, origem, degraus?, membros?, pisos?}}
 */
function gLayoutCanEmergencyScale(ctx, componentId, camadas, modo){
  if(!ctx) return _gCapNao('sem-contexto');
  const cap = gComponentCapability(ctx, componentId, 'canScaleComponent');
  if(!cap.permitido) return cap;                         // as guardas do componente valem iguais
  const c = gComponentById(ctx.components, componentId);
  const r = _gDegrausDeEscala(ctx, c.membros, camadas, modo);
  return r.permitido ? _gCapOk('componente-pode-descer', r.detalhe)
                     : _gCapNao('componente-no-piso', r.detalhe);
}

/**
 * A MESMA conta para o ADAPTIVE SCALE GROUP. Guardas próprias: o grupo é operacional, não
 * autoral, então `singleton` não faz sentido aqui (um conflito entre dois blocos pode render um
 * grupo de dois e é legítimo) — mas protegida, fundo e elasticidade que proíbe escala continuam
 * bloqueando membro a membro, exatamente como no componente.
 */
function gLayoutCanScaleGroup(ctx, grupo, camadas, modo){
  if(!ctx) return _gCapNao('sem-contexto');
  const membros = (grupo && grupo.escalaveis) || [];
  if(!membros.length) return _gCapNao('grupo-sem-quem-desca', { membros:0 });
  const proibem = membros.filter(id => {
    const n = ctx._no.get(id);
    if(n && (n.protegida || n.fundo)) return true;
    const e = ctx.elasticity.get(id);
    return !e || gElasticityLevel(e.scale) === 0;
  });
  if(proibem.length) return _gCapNao('membro-proibe-escala', { membros:proibem });
  /* ⚠ DOIS CONJUNTOS, E ESSA É A DIFERENÇA QUE FALTAVA. Quem DESCE é `escalaveis`; quem sai da
     conta do piso de hierarquia externo é o fecho INTEIRO (`membros`). O solver faz exatamente
     isso: `textosComponente` (quem desce) é filtrado do `ids` (o fecho), mas `_pisoHierExterno`
     recebe o `ids`. No `de-por-lateral` o "por" está no fecho e não desce — e é justamente ele
     que, contado como piso, travava o "produto" em 84. */
  const r = _gDegrausDeEscala(ctx, membros, camadas, modo, grupo.membros);
  return r.permitido ? _gCapOk('grupo-pode-descer', Object.assign({ grupo:grupo.id }, r.detalhe))
                     : _gCapNao('grupo-no-piso', Object.assign({ grupo:grupo.id }, r.detalhe));
}

/* Quantas voltas de 0,92 ainda cabem para ESTE conjunto — o mesmo laço do motor, que só para
   quando ninguém mais desce. O piso de cada membro é medido com o conjunto INTEIRO como grupo:
   quem desce junto sai da conta do piso de hierarquia externo, e é exatamente daí que o degrau
   proporcional tira a folga que o encolhimento isolado não tem. */
function _gDegrausDeEscala(ctx, membros, camadas, modo, grupoPiso){
  const vivos = camadas || [...ctx._camada.values()];
  const idx = new Map(vivos.map(l => [l.id, l]));
  const grupo = new Set(grupoPiso || membros);
  /* O índice do piso externo é do GRUPO, não do membro: todos compartilham o mesmo conjunto de
     fora. Construir um por membro era varrer a arte inteira k vezes — medido em 3,4ms por
     consulta numa peça de 344 camadas, com a busca consultando centenas de vezes. */
  const indice = (typeof gLayoutIndicePisoExterno === 'function' && modo === 'emergency')
    ? gLayoutIndicePisoExterno(vivos, grupo, false) : null;
  let degraus = 0;
  const pisos = [];
  membros.forEach(id => {
    const autorada = ctx._camada.get(id);
    const vivo = idx.get(id);
    if(!autorada || autorada.type !== 'text') return;
    const medida = Object.assign({}, autorada, { _tetoFonte: vivo && vivo._tetoFonte });
    const atual = Math.round(gLayoutCorpoAtual(medida));
    const piso = Math.round(gLayoutPisoDoModo(vivos, medida,
      modo === 'emergency' ? 'emergency' : 'normal', grupo, indice));
    pisos.push({ id, atual, piso });
    if(piso < atual) degraus = Math.max(degraus, Math.ceil(Math.log(piso / atual) / Math.log(0.92)));
  });
  /* O teto de 0,35 é o mesmo da escada (`escalaGlobal = max(0.35, escalaAtual*0.92)`): abaixo
     disso o motor não desce, e prometer degraus que ele não tem seria inventar escada. */
  const tetoGlobal = Math.ceil(Math.log(0.35) / Math.log(0.92));
  return { permitido: degraus > 0,
           detalhe: { degraus: Math.min(degraus, tetoGlobal), membros:membros.length, pisos } };
}

/**
 * A CAPACIDADE DE COMPONENTE. Separada porque o alvo é outro e as guardas são outras.
 * ⛔ `singleton` NÃO recebe escala de componente: um membro só não é bloco composto, e escalar
 * "o grupo" seria escalar uma camada solta por baixo de um nome que promete grupo.
 * ⛔ Um membro que proíbe escala BLOQUEIA o componente inteiro. Nem o perfil do tipo nem
 * nenhuma agregação por `max` pode tornar um membro individual mais livre.
 */
function gComponentCapability(ctx, componentId, capacidade){
  if(!ctx) return _gCapNao('sem-contexto');
  const c = gComponentById(ctx.components, componentId);
  if(!c) return _gCapNao('componente-inexistente');
  if(capacidade !== 'canScaleComponent') return _gCapNao('capacidade-desconhecida');
  if(c.singleton) return _gCapNao('singleton-nao-escala-como-grupo', { tipo:c.tipo });
  const protegidos = c.membros.filter(id => { const n = ctx._no.get(id); return !!(n && (n.protegida || n.fundo)); });
  if(protegidos.length) return _gCapNao('membro-protegido', { membros:protegidos });
  const proibem = c.membros.filter(id => {
    const e = ctx.elasticity.get(id);
    return !e || gElasticityLevel(e.scale) === 0;
  });
  if(proibem.length) return _gCapNao('membro-proibe-escala', { membros:proibem });
  const ce = ctx.componentElasticity.get(componentId);
  if(!ce || gElasticityLevel(ce.scale) === 0) return _gCapNao('componente-proibe-escala');
  return _gCapOk('componente-pode-escalar', { nivel:ce.scale, membros:c.membros.length });
}

/**
 * A PERMISSÃO EFETIVA — a conjunção, num lugar só.
 *
 *     efetiva = elasticidade permite  E  o motor consegue
 *
 * Existe para que a fase seguinte nunca escreva esse `&&` à mão. Espalhar a conjunção pelo
 * código seria garantir que, em algum ponto, alguém checasse só metade dela.
 * @returns {{permitido, motivo, bloqueadoPor, elasticidade, capacidade}}
 */
function gLayoutOperationalPermission(ctx, targetId, acaoId){
  const meta = G_LAYOUT_ACOES[acaoId];
  if(!meta) return { permitido:false, motivo:'acao-desconhecida', bloqueadoPor:'vocabulario' };
  if(meta.alvo === 'component'){
    const cap = gComponentCapability(ctx, targetId, meta.capacidade);
    return { permitido:cap.permitido, motivo:cap.motivo,
             bloqueadoPor: cap.permitido ? null : 'solver-capability',
             elasticidade:(ctx.componentElasticity.get(targetId) || {})[meta.dimensao] || null,
             capacidade:cap };
  }
  const el = ctx._no.has(targetId) ? ctx.elasticity.get(targetId) : null;
  if(!el) return { permitido:false, motivo:'alvo-inexistente', bloqueadoPor:'alvo' };
  const nivel = meta.dimensao ? el[meta.dimensao] : null;
  // Elasticidade primeiro: se o papel não permite, nem se pergunta ao motor.
  if(meta.dimensao && gElasticityLevel(nivel) === 0)
    return { permitido:false, motivo:'elasticidade-none', bloqueadoPor:'elasticity',
             elasticidade:nivel, capacidade:null };
  const cap = gLayoutCapability(ctx, targetId, meta.capacidade);
  return { permitido: cap.permitido, motivo: cap.permitido ? 'permitido' : cap.motivo,
           bloqueadoPor: cap.permitido ? null : 'solver-capability',
           elasticidade:nivel, capacidade:cap };
}

/**
 * O PORTÃO da Fase 5: ação + alvo + elasticidade + capacidade + zona de impacto.
 * Continua sem executar nada — responde se a tentativa seria legítima, e por que não quando não.
 *
 * @param {object} p {ctx, action, targetId, rootId, impactLevel}
 * @returns {{permitido, motivo, bloqueadoPor, acao, alvo, nivelImpacto, elasticidade, capacidade}}
 */
function gLayoutCanAttempt(p){
  const o = p || {};
  const meta = G_LAYOUT_ACOES[o.action];
  const base = { acao:o.action, alvo:o.targetId, nivelImpacto:o.impactLevel != null ? o.impactLevel : null };
  if(!meta) return Object.assign({ permitido:false, motivo:'acao-desconhecida', bloqueadoPor:'vocabulario' }, base);
  if(!o.ctx) return Object.assign({ permitido:false, motivo:'sem-contexto', bloqueadoPor:'contexto' }, base);

  /* ESCOPO DE IMPACTO — mexer numa camada fora da zona da raiz que mudou é recompor arte que
     ninguém pediu. Sem `rootId` não há escopo a verificar: a pergunta é só sobre o alvo. */
  if(o.rootId){
    const zona = gCompileImpactZones(o.ctx.graph, o.ctx.components, o.rootId);
    const teto = o.impactLevel != null ? o.impactLevel : 3;
    let dentro = false, nivelEncontrado = null;
    for(let k = 0; k <= Math.min(3, teto); k++){
      if((zona.levels[k] || []).indexOf(o.targetId) >= 0){ dentro = true; nivelEncontrado = k; break; }
    }
    // O nível 4 é emergência e é DERIVADO: só é consultado quando alguém pede explicitamente.
    if(!dentro && teto >= 4 && !zona.dentro.has(o.targetId)){ dentro = true; nivelEncontrado = 4; }
    if(!dentro) return Object.assign({ permitido:false, motivo:'fora-da-zona-de-impacto',
      bloqueadoPor:'impact-scope', raiz:o.rootId }, base);
    base.nivelImpacto = nivelEncontrado;
  }
  const perm = gLayoutOperationalPermission(o.ctx, o.targetId, o.action);
  return Object.assign({}, base, perm, { raiz:o.rootId || null });
}

/* ════════════════════════════════════════════════════════════════════
   16. DESIGNER MOVES — a primeira vez que a arquitetura nova transforma layout
   ════════════════════════════════════════════════════════════════════
   Até aqui tudo era leitura. Esta seção produz GEOMETRIA: cada ação é uma decisão pequena de
   design — quebrar uma linha, apertar um respiro, devolver o tracking, empurrar o bloco de
   baixo — aplicada sobre um clone e devolvida como resultado.

   ⚠ NÃO EXISTE CANDIDATE SEARCH. Nada aqui combina ações, pontua, escolhe vencedor ou entra em
   `gLayoutEscolherAlternativa`. `gApplyRelativeAnchors` continua sem conhecer este arquivo, e a
   arte que o franqueado baixa hoje é byte a byte a de antes. O objetivo desta fase é provar que
   cada MOVIMENTO, isolado, faz o que promete — antes de deixar alguém encadeá-los.

   ── AS TRÊS REGRAS ──
   · GERAR E APLICAR SÃO SEPARADOS. "Que movimentos posso tentar?" e "que resultado este
     movimento produz?" são perguntas diferentes, e misturá-las é como um gerador passa a
     depender do efeito colateral do outro.
   · TODA AÇÃO PASSA PELO PORTÃO. Nada é gerado sem `gLayoutCanAttempt`. Gerar candidato
     inválido para descartar depois é pagar o clone e a medida por nada — e é como uma ação
     proibida acaba escapando no dia em que alguém esquece de filtrar.
   · CLONES INDEPENDENTES. A ação B nunca é aplicada sobre o resultado de A. Combinação é a fase
     seguinte; aqui um ramo não contamina o outro, nem a base, nem o template.

   ── O QUE CADA AÇÃO É, NO MOTOR DE HOJE ──
   Cada uma corresponde a UM degrau que a escada de `gApplyRelativeAnchors` já executa. Nenhuma
   inventa comportamento novo; elas dão nome, limite e reversibilidade ao que já acontece. */

const G_ACAO_V = 1;

/* VOCABULÁRIO FECHADO DE PROBLEMAS. Danos OBJETIVOS, verificáveis na geometria — nada de
   "layout feio" ou "sem equilíbrio", que ninguém consegue testar nem reproduzir. */
const G_LAYOUT_PROBLEMAS = {
  'text-overflow':      'a tinta passou da caixa que o designer desenhou',
  'collision':          'duas coisas que não se tocavam no desenho passaram a se tocar',
  'outside-canvas':     'alguma coisa saiu da prancheta (ou piorou a sangria que já tinha)',
  'spacing-pressure':   'o respiro mínimo entre blocos deixou de caber',
  'container-mismatch': 'a placa não abraça mais a tinta do texto',
  'optional-empty':     'um campo opcional ficou em branco e deixou um vão'
};

/* PROBLEMA → AÇÕES CANDIDATAS. A geração é LOCAL: olha o alvo do problema, não a arte inteira.
   A ordem aqui é a ordem em que as ações saem, e ela é a da escada real — do movimento mais
   barato (quebrar, apertar respiro) ao mais caro (mexer na tipografia, escalar o componente). */
/* `alvo` diz QUEM sofre a ação, e a distinção é essencial numa colisão: quem precisa descer é a
   VÍTIMA (o bloco empurrado), mas quem precisa encolher é o CULPADO (o texto que cresceu).
   Mirar sempre a vítima faria a busca tentar encolher o preço porque o título ficou longo —
   exatamente o estrago que a regra de 19/08 existe para impedir. */
/* ── SEM CULPADO PROVADO, SÓ AUTO-ADAPTAÇÃO ───────────────────────────────────────────────
   Um `text-overflow` que o detector não conseguiu atribuir a ninguém não autoriza mexer em
   terceiros: empurrar o vizinho, redimensionar a placa de outro ou escalar um grupo inferido
   seria inventar a origem que a evidência não deu. A política é explícita — sem culpado, as
   ações só podem operar no PRÓPRIO alvo, e só estas quatro.
   ⛔ Isto NÃO escolhe culpado artificial. Continua não havendo causa: há um alvo que pode
   tentar se resolver sozinho, e o diagnóstico diz isso (`reason:'isolated-self'`). */
const G_ACAO_AUTO_ADAPTACAO = ['wrap-text', 'compress-line-height', 'restore-tracking', 'shrink-text',
  /* Estas três também operam no PRÓPRIO alvo e por isso continuam permitidas: apertar o respiro
     é opção de solve, a placa que redimensiona é a do problema, e o vão que fecha é o do alvo.
     O que a política barra é agir sobre TERCEIRO — e sem culpado provado o único passo que
     chega a um terceiro é a escala de grupo. */
  'compress-gap', 'resize-container', 'collapse-empty-gap', 'push-dependent'];

const G_PROBLEMA_ACOES = {
  /* ⚠ `scale-component` ENTRA AQUI, e é o último degrau. O solver põe a camada que ESTOUROU
     dentro de `culpados` (via `idsEstouro` em `_cedeu`), e é esse conjunto que semeia o degrau
     proporcional — então para ele um estouro isolado também pode virar escala de grupo. Sem
     esta linha a busca tratava "não coube" como problema sem saída assim que a camada batia no
     piso de hierarquia externo, enquanto o motor seguia descendo o bloco inteiro.
     A guarda do §11 continua valendo: sem culpado provado E sem grupo provado no ramo, a escala
     não é gerada (ver `gGenerateLayoutActions`). */
  'text-overflow':      [{a:'wrap-text',alvo:'alvo'},{a:'restore-tracking',alvo:'alvo'},
                         {a:'compress-line-height',alvo:'alvo'},{a:'shrink-text',alvo:'alvo'},
                         {a:'scale-component',alvo:'alvo'}],
  'collision':          [{a:'compress-gap',alvo:'alvo'},{a:'push-dependent',alvo:'alvo'},
                         {a:'resize-container',alvo:'alvo'},
                         {a:'wrap-text',alvo:'culpado'},{a:'compress-line-height',alvo:'culpado'},
                         {a:'shrink-text',alvo:'culpado'},{a:'scale-component',alvo:'culpado'}],
  'outside-canvas':     [{a:'wrap-text',alvo:'alvo'},{a:'compress-line-height',alvo:'alvo'},
                         {a:'shrink-text',alvo:'alvo'}],
  'spacing-pressure':   [{a:'compress-gap',alvo:'alvo'},{a:'compress-line-height',alvo:'culpado'}],
  'container-mismatch': [{a:'resize-container',alvo:'alvo'}],
  'optional-empty':     [{a:'collapse-empty-gap',alvo:'alvo'}]
};

/* ASSINATURA DA AÇÃO — a mesma decisão lógica dá a mesma assinatura, sempre. Serve para a fase
   seguinte reconhecer que dois ramos chegaram ao mesmo movimento sem comparar objeto a objeto.
   Os `params` entram ORDENADOS: a ordem das chaves de um objeto não pode virar informação. */
function gLayoutActionSignature(acao){
  if(!acao) return '';
  const p = acao.params || {};
  const chaves = Object.keys(p).sort().map(k => k + '=' + JSON.stringify(p[k])).join(',');
  return _gGramHash(['v' + G_ACAO_V, acao.id, acao.targetId || '', acao.componentId || '',
                     acao.rootId || '', chaves].join('#'));
}

function _gAcao(id, alvo, extra){
  const a = Object.assign({ id:id, targetId:alvo, rootId:null, componentId:null,
                            adaptiveGroupId:null, impactLevel:null, params:{},
                            motivo:'causal', reason:'' }, extra || {});
  a.signature = gLayoutActionSignature(a);
  return a;
}

/* Mede a tinta de um texto com o MOTOR ÚNICO de encaixe — nunca uma medida paralela.
   ⚠ MEDE O ESTADO ATUAL, COM OS CARIMBOS. `gLayoutLimpaCarimbos` serve para medir a REFERÊNCIA
   autorada (é o que o `_tinta` faz) — usá-lo aqui apagava `_tetoFonte`, `_entrelinha` e
   `_layoutW`, que são justamente o que as ações escrevem: toda ação parecia não ter efeito, o
   detector via o mesmo dano de antes e a busca podava todos os ramos na primeira volta. */
function _gAcaoFit(ctx, l, texto){
  if(!ctx || !ctx._ctx2d || typeof gFitTextLayer !== 'function') return null;
  /* RE-MEDE SÓ QUEM MUDOU — a mesma disciplina do `_remedir` do solver, que existe porque
     remedir a arte inteira a cada volta custava 116ms por tecla. Aqui a busca chama o detector
     uma vez por candidato: sem cache, 344 textos × dezenas de candidatos, e a busca passava de
     360ms numa arte grande. A chave é o que REALMENTE muda a medida — geometria de posição
     não entra, porque mover não remede. */
  /* ⚠ OS PISOS ENTRAM NA CHAVE. `gFitTextLayer` reduz o corpo internamente até `_pisoFonte`/
     `_pisoLegivel` — então duas camadas com a MESMA tipografia e pisos diferentes medem
     diferente, e é justamente aí que nasce o `estourou`. Sem eles na chave, a medida da arte
     autorada respondia por um estado assentado cujo piso de hierarquia já tinha subido, e o
     detector deixava passar um estouro que `gLayoutCamadaReprovada` enxerga. */
  const chave = l.id + '|' + [l.w, l.h, l.fontSize, l._tetoFonte, l._entrelinha, l.letterSpacing,
    l._layoutW, l._layoutMaxLines, l.textBox, l._pisoFonte, l._pisoLegivel, texto].join('\u0001');
  const cache = ctx._medida || (ctx._medida = new Map());
  if(cache.has(chave)) return cache.get(chave);
  let f = null;
  /* ⛔ MEDE COMO O `_medirFit` DO SOLVER MEDE — mesmas opções, mesmos `runs`. Aqui havia um
     `encolher:false` herdado de quando isto só servia para ler tinta: ele pula o degrau interno
     de redução do `gFitTextLayer` E, com ele, a única linha que levanta `estourou` por LARGURA
     ("chegou no piso e ainda não cabe"). O detector então não via o estouro que faz
     `gLayoutCamadaReprovada` reprovar a camada, e a busca declarava resolvida uma composição que
     o motor recusa — foi assim que `de-por-lateral` passou pelo portão. */
  try{
    const runs = (typeof gBuildVirtualRuns === 'function' && ctx.dados)
      ? gBuildVirtualRuns(l, ctx.dados, 1, {}) : null;
    f = gFitTextLayer(l, String(texto == null ? '' : texto), ctx._ctx2d,
      { runs: runs || (!_gLayoutTemCampo(l) ? l.runs : null) || null });
  }
  catch(e){ f = null; }
  if(cache.size > 4000) cache.clear();      // teto: a busca é curta, o cache não pode crescer sozinho
  cache.set(chave, f);
  return f;
}
// O texto real do alvo: o valor do franqueado quando houver, senão o autorado.
function _gAcaoTexto(ctx, l){
  const bruto = l.content || '';
  if(ctx && ctx.dados && typeof gInterpolate === 'function' && /\{\{/.test(bruto))
    return gInterpolate(bruto, ctx.dados, {});
  return bruto;
}

/**
 * GERAÇÃO — que movimentos podem ser tentados para ESTE problema.
 * Local por definição: olha o alvo e a zona dele, não a composição inteira.
 *
 * ⚠ ORIGINAL-FIRST: sem problema, devolve `[]`. Nenhum clone, nenhuma medida, nenhuma busca —
 * o caminho feliz continua custando zero, que é o contrato deste motor desde sempre.
 *
 * @param {object} ctx     de `gBuildOperationalContext`
 * @param {object} problem {tipo, targetId, rootId?, detalhe?}
 * @returns {Array} descritores, ORDENADOS (pela escada real, depois por assinatura)
 */
function gGenerateLayoutActions(ctx, problem, camadas, modo){
  if(!ctx || !problem || !G_LAYOUT_PROBLEMAS[problem.tipo]) return [];
  const emergencia = (modo === 'emergency');
  /* ── DE ONDE SAEM OS PARÂMETROS ───────────────────────────────────────────────────────────
     O PORTÃO (elasticidade, capacidade, zona) continua lendo a arte AUTORADA pelo contexto: a
     liberdade que o designer deixou não muda porque a busca já encolheu o título uma vez.
     Os PARÂMETROS, não: o degrau de 8% tem que sair do corpo ATUAL, e a entrelinha alvo da
     altura ATUAL. Enquanto os dois vinham de `ctx._camada`, repetir `shrink-text` devolvia o
     mesmo `de → para` da primeira vez, a aplicação não mudava nada e a corrida morria no
     primeiro degrau. `camadas` é o estado que o candidato realmente tem agora. */
  const _lista = camadas ? (camadas.layers || camadas) : null;
  const _atual = _lista ? new Map(_lista.map(x => [x.id, x])) : null;
  const _camada = (id) => (_atual && _atual.get(id)) || ctx._camada.get(id);
  const _estadoVivo = _lista || [...ctx._camada.values()];
  const alvo = problem.targetId;
  const n = ctx._no.get(alvo);
  const l = _camada(alvo);
  if(!n || !l) return [];
  /* ── CAUSAL × AUTO-ADAPTAÇÃO ─────────────────────────────────────────────────────────────
     Com culpado provado a geração é causal: as ações podem mirar a ORIGEM, e a zona de impacto
     nasce dela. Sem culpado provado não existe terceiro legítimo — todo passo `culpado` cai no
     próprio alvo (`culpadoId` já faz esse fallback), e o que sobra de verdadeiramente alheio é
     `scale-component`: escalar um grupo inferido sem evidência de origem. Esse fica de fora.
     ⛔ Isto NÃO inventa culpado. Continua não havendo causa; há um alvo que pode tentar se
     resolver sozinho, e o descritor diz isso em `motivo`. */
  const culpadoProvado = !!(problem.detalhe && problem.detalhe.culpado);
  const raiz = problem.rootId || null;
  const motivo = culpadoProvado ? 'causal' : 'isolated-self';
  const ordem = G_PROBLEMA_ACOES[problem.tipo] || [];
  const culpadoId = (problem.detalhe && problem.detalhe.culpado) || alvo;
  const out = [];

  ordem.forEach((passo, i) => {
    const acaoId = passo.a;
    const meta = G_LAYOUT_ACOES[acaoId];
    if(!meta) return;
    /* ⛔ A GUARDA DO GRUPO SEM EVIDÊNCIA. Sem culpado provado, escalar um conjunto seria
       inventar a origem que a medida não deu — a menos que o conjunto já tenha sido PROVADO
       neste mesmo ramo, por colisões reais que a busca mediu e tratou. Aí a evidência existe:
       ela só não está no problema que SOBROU. É a mesma distinção do solver, que carrega o
       `ids` do degrau proporcional enquanto ele roda. */
    if(!culpadoProvado && meta.alvo === 'component'
       && !(problem._adaptiveGroup && problem._adaptiveGroup.provado)) return;
    // Vítima ou culpado — ver `G_PROBLEMA_ACOES`.
    const alvoId = passo.alvo === 'culpado' ? culpadoId : alvo;
    const nAlvo = ctx._no.get(alvoId), lAlvo = _camada(alvoId);
    if(!nAlvo || !lAlvo) return;

    if(meta.alvo === 'component'){
      /* ── DOIS ESCOPOS PARA A MESMA DECISÃO ──────────────────────────────────────────────
         `scale-component` continua significando "descer um conjunto na mesma escala". O que
         muda é QUAL conjunto:
         · `component`       → o bloco semântico. Raio menor, e a primeira tentativa.
         · `collision-group` → o Adaptive Scale Group: quem está de fato brigando, que é o
           conjunto que o solver usa no degrau `relaxou`. Raio maior, vem depois.
         O escopo viaja no descritor em vez de trocar a semântica em silêncio, e o componente
         continua existindo no candidato ao lado do grupo — um serve à semântica, o outro à
         operação. */
      const c = gComponentOfNode(ctx.components, alvoId);
      const escopos = [];
      if(c){
        const portao = gLayoutCanAttempt({ ctx, action:acaoId, targetId:c.id, rootId:null });
        if(portao.permitido){
          const esc = gLayoutCanEmergencyScale(ctx, c.id, _estadoVivo, emergencia ? 'emergency' : 'normal');
          if(esc.permitido) escopos.push({ escopo:'component', componentId:c.id, grupoId:null,
                                           membros:null, degraus:esc.degraus });
        }
      }
      const asg = problem._adaptiveGroup || null;
      if(asg && asg.escalaveis.length >= 2){
        const cap = gLayoutCanScaleGroup(ctx, asg, _estadoVivo, emergencia ? 'emergency' : 'normal');
        /* Só vale a pena quando o grupo é REALMENTE outro conjunto: se ele coincide com o
           componente, gerar os dois seria duplicar a mesma ação com outro nome. */
        /* "É o mesmo conjunto?" pergunta pelos DOIS: quem desce e quem sai do piso. Um grupo
           com os mesmos descendentes mas fecho maior é outra ação — é exatamente o caso que
           destrava o `de-por-lateral`. */
        const mesmo = c && c.membros.slice().sort().join('+') === asg.escalaveis.slice().sort().join('+')
                        && c.membros.slice().sort().join('+') === asg.membros.slice().sort().join('+');
        if(cap.permitido && !mesmo)
          escopos.push({ escopo:'collision-group', componentId:c ? c.id : null, grupoId:asg.id,
                         membros:asg.escalaveis.slice(), grupoPiso:asg.membros.slice(),
                         degraus:cap.degraus });
      }
      escopos.forEach((e, k) => {
        out.push(_gAcao(acaoId, null, { componentId:e.componentId, adaptiveGroupId:e.grupoId,
          rootId:raiz, ordem:i + k * 0.5,
          params:{ fator:0.92, modo:emergencia ? 'emergency' : 'normal', degraus:e.degraus,
                   escopo:e.escopo, membros:e.membros, grupoPiso:e.grupoPiso || null },
          motivo:motivo, reason:meta.degrau }));
      });
      return;
    }

    /* ⛔ O PORTÃO. Se a capacidade operacional bloqueia, a ação NÃO EXISTE — não é gerada para
       ser descartada depois. Ele já cobre elasticidade, capacidade do motor e escopo de zona. */
    const portao = gLayoutCanAttempt({ ctx, action:acaoId, targetId:alvoId, rootId:raiz,
                                       impactLevel:problem.impactLevel });
    /* ── A ÚNICA PORTA QUE A EMERGÊNCIA ABRE ──────────────────────────────────────────────
       Encolher parou por falta de PISO (`no-piso`), e o motor continuaria descendo? Então a
       capacidade de emergência responde por este degrau — e só por ele. Bloqueio por zona,
       por elasticidade, por protegida ou por "não é texto" continua bloqueando igual: a
       emergência compra piso, não imunidade. */
    let emerg = null;
    if(!portao.permitido){
      const sopiso = emergencia && acaoId === 'shrink-text'
                  && portao.bloqueadoPor === 'solver-capability'
                  && portao.capacidade && portao.capacidade.motivo === 'no-piso';
      if(!sopiso) return;
      emerg = gLayoutCanEmergencyShrink(ctx, alvoId, _estadoVivo);
      if(!emerg.permitido) return;
    }else if(emergencia && acaoId === 'shrink-text'){
      emerg = gLayoutCanEmergencyShrink(ctx, alvoId, _estadoVivo);
      if(!emerg.permitido) return;
    }

    const params = {};
    let ok = true;
    switch(acaoId){
      case 'wrap-text': {
        /* A largura disponível: a do corredor que o problema apurou, senão a caixa desenhada.
           Quem quebra é `gSmartWrapText` — esta ação só diz ONDE cabe. */
        const larg = (problem.detalhe && problem.detalhe.largura) || lAlvo.w || 0;
        if(!(larg > 0)) { ok = false; break; }
        params.largura = Math.round(larg);
        params.maxLinhas = portao.capacidade.maxLinhas;
        break;
      }
      case 'compress-gap':
        // UM degrau, o que o motor tem: `_respiroFator` 1 → 0.5.
        params.fator = portao.capacidade.fator;
        break;
      case 'compress-line-height': {
        /* A MESMA conta do solver (`_entrelinhaAlvo`): a entrelinha que faria a tinta caber na
           caixa, com piso 1.05. Só existe com MAIS DE UMA LINHA real — e por isso se mede. */
        const f = _gAcaoFit(ctx, lAlvo, _gAcaoTexto(ctx, lAlvo));
        const linhas = (f && f.lines && f.lines.length) || 1;
        if(linhas < 2){ ok = false; break; }
        const fs = gLayoutCorpoAtual(lAlvo);
        const atual = (typeof gLineHeightDe === 'function') ? gLineHeightDe(lAlvo) : (l.lineHeight || 1.2);
        const alvoLh = Math.max(1.05, Math.min(atual, Math.round(((lAlvo.h || 0) / Math.max(1, fs * linhas)) * 1000) / 1000));
        if(!(alvoLh < atual - 0.001)){ ok = false; break; }
        params.de = atual; params.para = alvoLh; params.linhas = linhas;
        break;
      }
      case 'restore-tracking': {
        /* ⛔ SÓ O TRACKING QUE O MOTOR ADICIONOU. O solver também aperta o tracking AUTORADO até
           zero; esta ação não faz isso, de propósito — devolver o que o render somou é reverter
           uma decisão do motor, apertar o do designer é mexer no desenho dele. Divergência
           assumida e mais conservadora que a escada. */
        if(lAlvo.letterSpacing != null){ ok = false; break; }
        const corpo = gLayoutCorpoAtual(lAlvo);
        const efetivo = gLayoutTrackingEfetivo(lAlvo, corpo);
        const novo = Math.max(0, efetivo - corpo * 0.02);
        if(!(efetivo > 0.01)){ ok = false; break; }
        params.de = efetivo; params.para = novo; params.origem = 'motor';
        break;
      }
      case 'shrink-text': {
        /* UM degrau (8%), como a escada — nunca direto ao piso. Modo NORMAL, sem emergência.
           ⚠ O corpo é o que VALE AGORA (`gLayoutCorpoAtual`), não o autorado: sem isso a corrida
           monotônica regenerava o mesmo `64 → 58` a cada volta e morria no primeiro degrau. */
        const atual = Math.round(gLayoutCorpoAtual(lAlvo));
        /* O PISO SAI DO MODO, e é a única diferença entre os dois. Em emergência ele já vem
           medido pela capacidade (com o piso de hierarquia externo aplicado). */
        const piso = emerg ? emerg.piso : gLayoutPisoFonte(lAlvo, false);
        const novo = Math.max(piso, Math.floor(atual * 0.92));
        if(!(novo < atual)){ ok = false; break; }
        params.de = atual; params.para = novo; params.piso = piso;
        params.modo = emergencia ? 'emergency' : 'normal';
        if(emerg) params.degraus = emerg.degraus;
        break;
      }
      case 'push-dependent': {
        const delta = Math.round((problem.detalhe && problem.detalhe.delta) || 0);
        if(!(delta > 0)){ ok = false; break; }      // a corrente inferida SÓ empurra
        params.delta = delta;
        break;
      }
      case 'resize-container': {
        const e = (ctx.graph.edges || []).find(x => x.tipo === 'plate-of' && x.de === alvoId);
        if(!e){ ok = false; break; }
        params.texto = e.para;
        break;
      }
      case 'collapse-empty-gap': {
        const cred = portao.capacidade.credito;
        if(!(cred > 0)){ ok = false; break; }
        params.credito = Math.round(cred);
        break;
      }
      default: ok = false;
    }
    if(!ok) return;
    out.push(_gAcao(acaoId, alvoId, { rootId:raiz, impactLevel:portao.nivelImpacto, ordem:i,
      params:params, motivo:motivo, reason:meta.degrau }));
  });

  /* ORDEM EXPLÍCITA: a da escada real primeiro, assinatura como desempate. A ordem de um `Set`
     ou de `Object.keys` nunca pode virar a ordem em que o motor tenta as coisas. */
  out.sort((a, b) => a.ordem - b.ordem || (a.signature < b.signature ? -1 : 1));
  out.forEach(a => { delete a.ordem; });
  return out;
}

/**
 * APLICAÇÃO — o resultado que ESTE movimento produz, sozinho.
 *
 * ⚠ PURA E ISOLADA. Clona as camadas, aplica, devolve. A base não é tocada, e o resultado de uma
 * ação nunca é entrada de outra nesta fase.
 *
 * @returns {{layers, action, changedIds, geometryChanged, typographyChanged, opts, diagnostics}}
 */
function gApplyLayoutAction(base, action, ctx){
  /* O ESTADO de um candidato é `{layers, solveState}` — e não só as camadas. Oito das nove
     ações escrevem na camada; `compress-gap` escreve numa OPÇÃO DE SOLVE (`respiroFator`), que
     não tem onde morar numa layer. Enquanto o estado era só a lista de camadas, esse efeito
     desaparecia no passo seguinte: a ação "funcionava" no descritor e o detector media como se
     o respiro ainda fosse 1.
     Aceita array (a forma da Fase 5) ou estado completo — devolve sempre o estado completo. */
  const st = _gEstado(base);
  const camadas = st.layers.map(l => Object.assign({}, l));
  const idx = new Map(camadas.map(l => [l.id, l]));
  const r = { layers:camadas, solveState:Object.assign({}, st.solveState), action:action,
              changedIds:[], geometryChanged:false, typographyChanged:false,
              opts:null, diagnostics:{} };
  if(!action || !G_LAYOUT_ACOES[action.id]){ r.diagnostics.erro = 'acao-desconhecida'; return r; }
  const l = action.targetId ? idx.get(action.targetId) : null;
  const p = action.params || {};
  const marca = (id) => { if(r.changedIds.indexOf(id) < 0) r.changedIds.push(id); };

  switch(action.id){
    case 'wrap-text': {
      if(!l) break;
      /* O corredor transitório — exatamente o que `_gInferirCorredores` carimba. Quem quebra
         continua sendo `gSmartWrapText`, com unidades semânticas, teto de linhas e regras
         editoriais: esta ação não implementa quebra nenhuma, só abre a largura. */
      const antes = _gAcaoFit(ctx, l, _gAcaoTexto(ctx, l));
      l._layoutW = p.largura;
      l._layoutMaxLines = p.maxLinhas;
      const depois = _gAcaoFit(ctx, l, _gAcaoTexto(ctx, l));
      r.diagnostics = { linhasAntes:(antes && antes.lines && antes.lines.length) || null,
                        linhasDepois:(depois && depois.lines && depois.lines.length) || null,
                        largura:p.largura, maxLinhas:p.maxLinhas,
                        linhas:(depois && depois.lines) || null };
      r.geometryChanged = true; marca(l.id);
      break;
    }
    case 'compress-gap': {
      /* O respiro é parâmetro do SOLVE, não propriedade de camada — o motor o aplica em
         `_gLayoutRespiro` via `_respiroFator`. A ação grava no SOLVE STATE do candidato, que é
         o que o detector do próximo passo vai consumir. Fingir que isso é geometria de layer
         seria inventar um segundo caminho para um degrau que já tem o seu. */
      r.solveState.respiroFator = p.fator;
      r.opts = { _respiroFator: p.fator };
      r.diagnostics = { fator:p.fator, degraus:1 };
      break;
    }
    case 'compress-line-height': {
      if(!l) break;
      l._entrelinha = p.para;                 // o mesmo carimbo que a escada usa
      r.typographyChanged = true; marca(l.id);
      r.diagnostics = { de:p.de, para:p.para, piso:1.05, linhas:p.linhas };
      break;
    }
    case 'restore-tracking': {
      if(!l) break;
      // Escrito no `letterSpacing` do clone — a propriedade que a MEDIDA e o RENDER já leem.
      l.letterSpacing = p.para;
      l._trackApertado = true;                // uma vez por camada: o ganho não se repete
      r.typographyChanged = true; marca(l.id);
      r.diagnostics = { de:p.de, para:p.para, origem:p.origem };
      break;
    }
    case 'shrink-text': {
      if(!l) break;
      l._tetoFonte = p.para;
      r.typographyChanged = true; marca(l.id);
      r.diagnostics = { de:p.de, para:p.para, piso:p.piso, degrau:'8%' };
      break;
    }
    case 'push-dependent': {
      if(!l) break;
      l.y = (l.y || 0) + p.delta;             // só empurra, nunca puxa
      r.geometryChanged = true; marca(l.id);
      r.diagnostics = { delta:p.delta, de:(l.y - p.delta), para:l.y };
      break;
    }
    case 'resize-container': {
      if(!l) break;
      /* A MESMA conta de `_seguirPlacas`, via `gLayoutPlacaSegue`. O descritor da placa sai da
         TINTA AUTORADA (o que o `ctx._tinta` já mediu) contra a caixa desenhada — exatamente o
         que `_gInferirPlacas` grava em `_placa`. Reimplementar o reequilíbrio aqui produziria
         uma placa parecida e diferente, que é o pior resultado possível. */
      const t = idx.get(p.texto);
      const ref = ctx && ctx._tinta && ctx._tinta.get(p.texto);
      const fit = t && _gAcaoFit(ctx, t, _gAcaoTexto(ctx, t));
      if(!t || !fit || !ref){ r.diagnostics.erro = 'sem-medida'; break; }
      const caixa = (t.textBox === 'box');
      const w = caixa ? (t.w || 0) : (fit.larguraMax || t.w || 0);
      const h = fit.altura || t.h || 0;
      const tinta = { x:(t.x || 0) + (caixa ? 0 : _gInkDx(t, w)), y:(t.y || 0) + _gInkDy(t, h), w:w, h:h };
      /* O MESMO descritor do detector e do solver: `_placa` quando o estado veio assentado,
         a derivação contra a placa autorada quando não veio (aplicação isolada da Fase 5, onde
         as duas contas coincidem). Rederivar da placa já reequilibrada era o que fazia a ação
         não ser idempotente — o alvo andava junto com ela. */
      const desc = l._placa || { refW:ref.w || 0, refH:ref.h || 0,
                     padE: ref.x - (l.x || 0), padT: ref.y - (l.y || 0),
                     padD: ((l.x || 0) + (l.w || 0)) - (ref.x + (ref.w || 0)),
                     padB: ((l.y || 0) + (l.h || 0)) - (ref.y + (ref.h || 0)) };
      const g = gLayoutPlacaSegue(desc, tinta, t.fontSize);
      const antes = { x:l.x, y:l.y, w:l.w, h:l.h };
      const mexeu = Math.abs(g.x - l.x) > 0.5 || Math.abs(g.y - l.y) > 0.5
                 || Math.abs(g.w - l.w) > 0.5 || Math.abs(g.h - l.h) > 0.5;
      if(mexeu){
        l.x = g.x; l.y = g.y; l.w = g.w; l.h = g.h;
        r.geometryChanged = true; marca(l.id);
      }
      r.diagnostics = { antes, depois:{ x:l.x, y:l.y, w:l.w, h:l.h },
                        padding:{ e:g.padE, t:g.padT, d:g.padD, b:g.padB },
                        reequilibrou:g.reequilibrou, texto:p.texto, mexeu:mexeu };
      break;
    }
    case 'scale-component': {
      /* O CONJUNTO vem do escopo do descritor. `collision-group` carrega os membros medidos no
         estado em que a ação foi gerada — o grupo é derivado do estado, então congelá-lo no
         descritor é o que mantém a ação PURA e a assinatura honesta. */
      const escopo = (p.escopo === 'collision-group') ? 'collision-group' : 'component';
      const c = ctx && gComponentById(ctx.components, action.componentId);
      const membrosEsc = (escopo === 'collision-group') ? (p.membros || []) : (c ? c.membros : null);
      if(!membrosEsc || !membrosEsc.length){
        r.diagnostics.erro = (escopo === 'collision-group') ? 'grupo-vazio' : 'componente-inexistente';
        break;
      }
      /* ESCALA PROPORCIONAL — todo o componente desce na mesma escala, e a hierarquia DENTRO
         dele fica protegida por isso. O piso vem do MODO:
         · normal    → `gLayoutPisoFonte(l,false)`, metade do corpo desenhado;
         · emergency → legibilidade MAIS o piso de hierarquia EXTERNO (quem ficou de fora do
           componente e era menor não pode ser ultrapassado) — a trava que o solver aplica no
           degrau `relaxou`.
         ⚠ Antes desta fase esta ação usava o piso de emergência SEMPRE. Era emergência por
         padrão dentro do fluxo normal, e apagava justamente a separação que a Fase 5.9 mede. */
      const modoEsc = p.modo === 'emergency' ? 'emergency' : 'normal';
      /* ⚠ O GRUPO É O MESMO DOS DOIS LADOS: quem desce junto sai da conta do piso de hierarquia
         externo. É essa exclusão que dá ao degrau proporcional a folga que o encolhimento
         isolado não tem, e é exatamente o que o solver faz em `_pisoHierExterno(l)` com o `ids`
         do fecho. Passar um grupo aqui e outro no piso seria prometer uma descida que o motor
         não autoriza. */
      const grupo = new Set(p.grupoPiso || membrosEsc);
      const alvos = [];
      membrosEsc.forEach(id => {
        const m = idx.get(id);
        if(!m || m.type !== 'text') return;
        const atual = Math.round(gLayoutCorpoAtual(m));
        const piso = gLayoutPisoDoModo(camadas, m, modoEsc, grupo);
        const novo = Math.max(piso, Math.floor(atual * p.fator));
        if(novo < atual){ m._tetoFonte = novo; marca(id); alvos.push({ id, de:atual, para:novo, piso }); }
      });
      r.typographyChanged = alvos.length > 0;
      r.diagnostics = { fator:p.fator, modo:modoEsc, escopo:escopo, membros:alvos,
                        componente:c ? c.id : null, tipo:c ? c.tipo : null,
                        grupo:action.adaptiveGroupId || null };
      break;
    }
    case 'collapse-empty-gap': {
      if(!l) break;
      l.y = (l.y || 0) - p.credito;            // sobe EXATAMENTE o vão que deixou de existir
      r.geometryChanged = true; marca(l.id);
      r.diagnostics = { credito:p.credito, de:(l.y + p.credito), para:l.y };
      break;
    }
    default: r.diagnostics.erro = 'acao-sem-implementacao';
  }
  /* ── O MOVIMENTO REESCREVE A BASE AUTORADA ────────────────────────────────────────────────
     O assentamento canônico (§17) sempre parte de `_geoAutor`. Se um Designer Move mexe em
     x/y/w/h e não atualiza esse carimbo, o assentamento seguinte desfaz o movimento — e a busca
     ficaria gerando ações que não sobrevivem ao próprio passo seguinte.
     A distinção é a mesma de sempre: a corrente empurrar é CONSEQUÊNCIA (não vira base); o
     designer descer o bloco é DECISÃO (vira base). */
  const _baseIdx = new Map(st.layers.map(l => [l.id, l]));
  r.changedIds.forEach(id => {
    const novo = idx.get(id), velho = _baseIdx.get(id);
    if(!novo || !velho) return;
    if((novo.x||0) === (velho.x||0) && (novo.y||0) === (velho.y||0)
       && (novo.w||0) === (velho.w||0) && (novo.h||0) === (velho.h||0)) return;
    novo._geoAutor = { x:novo.x || 0, y:novo.y || 0, w:novo.w || 0, h:novo.h || 0 };
  });
  r.changedIds.sort();
  return r;
}

/**
 * DIFF DE MUTAÇÃO — o que este movimento mexeu, em vocabulário de design.
 * Reusa os diffs que já existem (§11 estrutural/visual, §12 componentes) em vez de reinventar
 * comparação. ⚠ Isto NÃO pontua: diz O QUE mudou, nunca se ficou melhor.
 */
function gDescribeLayoutMutation(base, candidate, canvas){
  const cv = canvas || { w:1080, h:1080 };
  const gA = gCompileLayoutGrammar(base || [], cv), gB = gCompileLayoutGrammar(candidate || [], cv);
  const estrut = gCompareLayoutStructure(gA, gB);
  const cA = gCompileLayoutComponents(gA, gCompileCompositionGraph(gA));
  const cB = gCompileLayoutComponents(gB, gCompileCompositionGraph(gB));
  const comps = gCompareLayoutComponents(cA, cB);
  const idxB = new Map((candidate || []).map(l => [l.id, l]));
  const moved = [], resized = [], tipografia = [];
  (base || []).forEach(a => {
    const b = idxB.get(a.id);
    if(!b) return;
    if((a.x || 0) !== (b.x || 0) || (a.y || 0) !== (b.y || 0)) moved.push(a.id);
    if((a.w || 0) !== (b.w || 0) || (a.h || 0) !== (b.h || 0)) resized.push(a.id);
    const fa = a._tetoFonte != null ? a._tetoFonte : a.fontSize;
    const fb = b._tetoFonte != null ? b._tetoFonte : b.fontSize;
    if(fa !== fb || (a._entrelinha || null) !== (b._entrelinha || null)
       || (a.letterSpacing == null ? null : a.letterSpacing) !== (b.letterSpacing == null ? null : b.letterSpacing))
      tipografia.push(a.id);
  });
  return {
    moved: moved.sort(), resized: resized.sort(), typographyChanged: tipografia.sort(),
    componentChanged: !comps.sameComponents,
    relationsChanged: estrut.relationsAdded.length > 0 || estrut.relationsRemoved.length > 0,
    sameStructure: estrut.sameStructure, visualChanged: estrut.visualChanged,
    estrutural: estrut, componentes: comps
  };
}

/* ════════════════════════════════════════════════════════════════════
   17. CANDIDATE SEARCH — sequências curtas de movimentos seguros
   ════════════════════════════════════════════════════════════════════
   A §16 provou que cada movimento, isolado, faz o que promete. Falta a parte que um designer faz
   sem pensar: quebrar a linha, ver que agora o CTA encostou no preço, e descer o CTA. Duas
   decisões encadeadas.

   ⛔ ISTO NÃO ESCOLHE VENCEDOR. A busca devolve TODAS as sequências que resolveram, e a pergunta
   "qual delas preserva melhor a intenção do designer?" é da Fase 6. Aqui não existe estética,
   nota, preferência ou gosto — só DANO OBJETIVO: saiu da arte, colidiu, não coube.

   ⛔ E NÃO MUDA PRODUÇÃO. `gApplyRelativeAnchors` continua sem conhecer este arquivo. A arte que
   o franqueado baixa hoje é byte a byte a de antes; o corpus e o fuzz provam isso a cada rodada.

   ── O QUE MUDA EM RELAÇÃO À FASE 5 ──
   Agora um candidato de profundidade 2 parte de um de profundidade 1. Mas cada RAMO continua
   isolado: aplicar B sobre o resultado de A é o encadeamento; aplicar B sobre o resultado de C
   por descuido é contaminação, e é ela que este código evita clonando a cada expansão.

   ── POR QUE BUSCA E NÃO REGRA ──
   A escada do solver é UM caminho fixo. Ele é bom e é por isso que continua no comando. Mas em
   arte real existe mais de uma saída honesta — encolher o título OU quebrá-lo e descer o CTA — e
   uma escada não tem como manter as duas na mesa até alguém poder compará-las. */

/* LIMITES — centralizados e testáveis. Não são números mágicos espalhados, e não sobem em
   silêncio: a expectativa é da ordem de 8–16 soluções úteis, não centenas. */
/* ⚠ `maxDepth: 8` É OBSERVACIONAL, não uma escolha calibrada. A Fase 5.5 mediu 0 candidatos
   `solved` no corpus com teto 3, enquanto a escada do solver dá até 32 voltas. Subir para 8
   serve para MEDIR quantos movimentos um caso real precisa; o valor final sai do corpus, não
   daqui. `maxCandidatos` é o freio que impede a busca mais funda de virar explosão. */
const G_SEARCH_LIMITES = { beamWidth:8, maxDepth:8, maxCandidatos:240 };

/* AÇÕES MONOTÔNICAS — repetir a ação leva sempre na mesma direção, um degrau por vez
   (`shrink-text` tira 8% a cada volta, e o solver faz exatamente isso num laço).
   Expandir uma por profundidade gastaria quatro níveis de busca com o MESMO movimento, e a
   inteligência da busca ficaria presa em repetir em vez de combinar. Aqui as repetições viram
   IRMÃS do mesmo pai — `shrink×1`, `shrink×2`, `shrink×3` nascem juntas, todas a um passo de
   distância. Cada uma continua sendo N Designer Moves auditáveis, com todos os degraus no
   histórico e nenhum piso pulado; o que encurta é a PROFUNDIDADE, não o rastro.
   ⚠ As intermediárias continuam existindo como candidatos próprios — sem isso, `wrap → shrink×1`
   deixaria de ser alcançável e a otimização mataria a diversidade de caminhos. */
const G_ACAO_MONOTONICA = { 'shrink-text':1, 'compress-line-height':1, 'push-dependent':1,
  /* A escala proporcional é o laço do motor: ele desce 8% do componente, remede, e desce de novo
     até ninguém mais ter folga. Uma volta só era a busca fingindo que a escada tem um degrau. */
  'scale-component':1 };

/* PRIORIDADE DOS PROBLEMAS — derivada da própria escada: ela trata primeiro o que INVALIDA a
   arte (sair da prancheta), depois o que a quebra (colisão), depois o que aperta (não coube), e
   por último o que é acabamento. Ordem explícita para que a ordem de um array nunca decida. */
const G_LAYOUT_PROBLEM_PRIORITY = ['outside-canvas','collision','text-overflow',
                                   'container-mismatch','spacing-pressure','optional-empty'];

/* REPETIÇÃO POR AÇÃO — quantas vezes cada movimento pode aparecer na MESMA sequência.
   Não é opinião: é quantos degraus o motor tem. `shrink-text` reduz 8% por vez e pode repetir
   até o piso; `compress-gap` tem UM degrau (1 → 0.5) e repetir seria fingir um segundo;
   `restore-tracking` o próprio solver marca `_trackApertado` para não repetir. */
const G_ACAO_REPETICAO = {
  'wrap-text':1, 'compress-gap':1, 'restore-tracking':1, 'compress-line-height':2,
  'shrink-text':4, 'push-dependent':3, 'resize-container':2, 'scale-component':2,
  'collapse-empty-gap':1
};

/* ── DETECTOR DE PROBLEMAS ────────────────────────────────────────────────────────────────
   Detector DETECTA; generator PROPÕE. Esta função nunca sugere ação — ela descreve o dano com
   dados suficientes para que a geração decida sozinha (alvo, com quem, quanto).

   A dívida que a Fase 5 deixou era o `delta` do empurrão chegar pronto de fora. Agora ele sai
   da mesma conta que a corrente usa: o quanto a TINTA do pai passou da tinta AUTORADA dele é
   exatamente o quanto o filho desce (`newY = paiInk + gap`, e `gap` é autorado). */
function gDetectLayoutProblems(state, ctx){
  if(!ctx) return [];
  const _st = _gEstado(state);
  const camadas = _st.layers;
  /* O RESPIRO EXIGIDO AGORA. Depois de `compress-gap` o candidato opera em 0.5, e medir como se
     ainda fosse 1 faria a ação parecer inútil — a busca então descartaria o único movimento que
     resolvia o caso. É o estado do candidato que manda, não o default. */
  const fatorAtual = _st.solveState.respiroFator != null ? _st.solveState.respiroFator : 1;
  const fatorApertado = fatorAtual > 0.5 ? 0.5 : fatorAtual;
  const idx = new Map(camadas.map(l => [l.id, l]));
  const cv = ctx.canvas || { w:0, h:0 };
  const out = [];
  const _fit = (l) => _gAcaoFit(ctx, l, _gAcaoTexto(ctx, l));
  const _tintaAtual = (l) => {
    if(l.type !== 'text') return { x:l.x||0, y:l.y||0, w:l.w||0, h:l.h||0 };
    const f = _fit(l);
    if(!f) return { x:l.x||0, y:l.y||0, w:l.w||0, h:l.h||0 };
    /* ⛔ CAMPO VAZIO NÃO OCUPA TINTA — a mesma regra do solver (`resolved[].vazio`, que é
       `_fit.altura === 0`). Ele é excluído dos nós e dos obstáculos justamente porque a caixa
       desenhada é do texto que NÃO veio. Sem esta linha o fallback de caixa desenhada (que
       existe para camada sem medida nenhuma) transformava o selo em branco num obstáculo
       fantasma de 56px: no `semSelo` do corpus o detector acusava colisão com o produto que
       tinha acabado de subir pelo colapso — dano que o solver não vê e que nenhuma ação
       resolvia, porque o culpado era um texto inexistente. */
    if(f.altura === 0) return null;
    const caixa = (l.textBox === 'box' && !l.vertical);
    const w = caixa ? (l.w||0) : (f.larguraMax || l.w || 0);
    const h = f.altura || l.h || 0;
    return { x:(l.x||0) + (caixa ? 0 : _gInkDx(l, w)), y:(l.y||0) + _gInkDy(l, h), w:w, h:h, fit:f };
  };
  const base = (id) => ctx._tinta.get(id) || null;
  const atual = new Map();
  camadas.forEach(l => { if(l && l.id) atual.set(l.id, _tintaAtual(l)); });

  camadas.forEach(l => {
    if(!l || !l.id) return;
    const n = ctx._no.get(l.id);
    if(!n || !n.visivel) return;
    const a = atual.get(l.id), b = base(l.id);

    /* ── TEXT-OVERFLOW ── a bandeira do encaixe, com o MESMO filtro do solver
       (`_estourosRestritos`): só conta para camada COM CAMPO e que tenha uma largura imposta —
       caixa de parágrafo, corredor ou texto vertical. Point text sem corredor não "estoura":
       ele abraça os glifos e cresce, e isso vira colisão ou saída da arte, não overflow.
       Sem esse filtro o detector acusava dano em cenário NOMINAL que o solver resolve em ZERO
       voltas — ou seja, discordava do motor sobre o que é arte saudável. */
    if(l.type === 'text' && a && a.fit && a.fit.estourou && n.campos.length
       && (l.textBox === 'box' || l._layoutW != null || l.vertical)){
      out.push({ tipo:'text-overflow', targetId:l.id,
        detalhe:{ linhas:(a.fit.lines && a.fit.lines.length) || 1, largura:l._layoutW || l.w || 0,
                  excesso: b ? Math.round(Math.max(0, a.h - b.h)) : 0 } });
    }

    // ── OUTSIDE-CANVAS ── piorou a sangria que o desenho já tinha (nunca a sangria autorada).
    if(cv.w && cv.h && a && b && gLayoutPiorouBorda(b, a, cv))
      out.push({ tipo:'outside-canvas', targetId:l.id,
        detalhe:{ excedeAbaixo: Math.round(Math.max(0, (a.y + a.h) - cv.h)),
                  excedeDireita: Math.round(Math.max(0, (a.x + a.w) - cv.w)) } });

    // ── OPTIONAL-EMPTY ── campo em branco deixou um vão que só existe com conteúdo.
    if(l.type === 'text' && ctx.dados && n.campos.length){
      const vazio = n.campos.every(c => String(ctx.dados[c] == null ? '' : ctx.dados[c]).trim() === '');
      if(vazio){
        const abaixo = camadas.filter(o => o && o.id !== l.id && (o.y || 0) > (l.y || 0)
          && gLayoutOverlapRatio(o.x||0, (o.x||0)+(o.w||0), l.x||0, (l.x||0)+(l.w||0)) >= G_LAYOUT_REL.coluna)
          .sort((p, q) => (p.y||0) - (q.y||0))[0];
        /* ⚠ O CRÉDITO É O QUE AINDA SOBROU, não a altura toda da faixa. O assentamento canônico
           já fecha o vão (`anchor.colapso`, a mesma conta do solver), então medir a altura
           autorada inteira fazia o detector pedir de novo uma subida que já tinha acontecido —
           `collapse-empty-gap` rodava, nada mudava, e o problema renascia igual. */
        const autor = abaixo && ctx._camada.get(abaixo.id);
        const jaSubiu = autor ? Math.max(0, (autor.y || 0) - (abaixo.y || 0)) : 0;
        const credito = Math.round(Math.max(0, (l.h || 0) - jaSubiu));
        if(abaixo && credito > 0) out.push({ tipo:'optional-empty', targetId:abaixo.id,
          detalhe:{ campoVazio:l.id, credito:credito } });
      }
    }

    // ── CONTAINER-MISMATCH ── a placa deixou de abraçar a tinta.
    const ePlaca = (ctx.graph.edges || []).find(e => e.tipo === 'plate-of' && e.de === l.id);
    if(ePlaca){
      const t = idx.get(ePlaca.para), ref = base(ePlaca.para), ta = atual.get(ePlaca.para);
      /* ⛔ O DESCRITOR DA PLACA É DO SOLVER, e é UM SÓ. `_gInferirPlacas` grava `_placa` uma vez,
         contra a caixa autorada, e o motor reusa em toda volta. Enquanto o detector rederivava
         os paddings da placa COMO ELA ESTÁ, o `container-mismatch` não convergia: `_seguirPlacas`
         já tinha reequilibrado os lados, rederivar dali pedia um segundo reequilíbrio, e o
         mismatch renascia a cada passo. O assentamento canônico devolve as camadas com `_placa`
         carimbado — então aqui se LÊ o descritor em vez de reinventá-lo.
         O fallback (estado não assentado) existe para a aplicação isolada da Fase 5, onde a
         placa ainda é a autorada e as duas contas coincidem. */
      if(t && ref && ta){
        const desc = l._placa || { refW:ref.w||0, refH:ref.h||0,
          padE:ref.x-(l.x||0), padT:ref.y-(l.y||0),
          padD:((l.x||0)+(l.w||0))-(ref.x+(ref.w||0)), padB:((l.y||0)+(l.h||0))-(ref.y+(ref.h||0)) };
        const g = gLayoutPlacaSegue(desc, ta, t.fontSize);
        if(g && (Math.abs(g.x-(l.x||0))>1 || Math.abs(g.y-(l.y||0))>1
              || Math.abs(g.w-(l.w||0))>1 || Math.abs(g.h-(l.h||0))>1))
          out.push({ tipo:'container-mismatch', targetId:l.id, detalhe:{ texto:ePlaca.para } });
      }
    }
  });

  /* ── COLISÃO e PRESSÃO DE RESPIRO ── o MESMO teste do solver (`gLayoutColisaoEntre`), nos dois
     patamares que ele tem: com o respiro APERTADO já colide → `collision`; só com o respiro
     IDEAL → `spacing-pressure`, que é o degrau anterior. Não são dois conceitos: é a mesma
     régua em dois níveis, que é exatamente como a escada a usa. */
  /* A lista de OBSTÁCULOS sai da composição AUTORADA e não muda de um candidato para outro —
     `_gLayoutObstaculo` faz uma varredura por camada, então recalculá-la a cada detecção era
     O(n²) por chamada. Calculada uma vez por contexto. */
  if(!ctx._obstaculos){
    const rects = _gDetRects(camadas, ctx);
    ctx._obstaculos = camadas.filter(o => o && typeof _gLayoutObstaculo === 'function'
      && _gLayoutObstaculo(o, camadas, cv, rects)).map(o => o.id);
  }
  const obst = ctx._obstaculos.map(id => idx.get(id)).filter(Boolean);
  camadas.forEach(t => {
    if(!t || t.type !== 'text') return;
    const n = ctx._no.get(t.id);
    if(!n || !n.visivel) return;
    const ta = atual.get(t.id), tb = base(t.id);
    if(!ta || !tb || !ta.w || !ta.h) return;
    // Quem não cresceu nem foi movido é VÍTIMA, não causa — a mesma guarda do solver.
    const delta = Math.max(0, ta.w-tb.w) + Math.max(0, ta.h-tb.h)
                + Math.abs(ta.x-tb.x) + Math.abs(ta.y-tb.y);
    if(delta <= 1) return;
    /* CORTE POR DISTÂNCIA — o respiro máximo que a régua pode exigir para ESTE texto. Dois
       retângulos separados por mais que isso não têm como colidir, e comparar todos contra
       todos é O(mudou × obstáculos): numa arte de 344 camadas com todos os campos alterados
       são ~100 mil pares. O corte não esconde candidato nenhum — ele só não pergunta o que a
       própria régua já responderia "não". */
    const padMax = _gLayoutRespiro(t, 0, cv, fatorAtual) + G_LAYOUT_REL.tol;
    obst.forEach(o => {
      if(o === t || !o.id) return;
      const oa = atual.get(o.id), ob = base(o.id) || { x:o.x||0, y:o.y||0, w:o.w||0, h:o.h||0 };
      if(!oa) return;
      if(ta.x - (oa.x + oa.w) > padMax || oa.x - (ta.x + ta.w) > padMax
         || ta.y - (oa.y + oa.h) > padMax || oa.y - (ta.y + ta.h) > padMax) return;
      /* DOIS PATAMARES, a partir do estado ATUAL: se colide até com o respiro mais apertado
         que ainda resta, é `collision` (apertar não salva). Se só colide no patamar atual, é
         `spacing-pressure` — e aí `compress-gap` resolve de verdade. Com o respiro já em 0.5 os
         dois patamares coincidem e não existe mais pressão a aliviar, que é o correto. */
      const apertado = gLayoutColisaoEntre(ta, tb, oa, ob, t, cv, fatorApertado);
      const ideal = gLayoutColisaoEntre(ta, tb, oa, ob, t, cv, fatorAtual);
      if(apertado.colide){
        /* QUEM É O CULPADO: quem CRESCEU, não quem está mais abaixo. Escolher por posição
           apontava a placa como culpada de uma colisão causada pelo título — e a busca então
           tentava encolher a vítima. Cada candidato é medido contra a PRÓPRIA tinta autorada;
           misturar as duas referências produzia delta inventado. */
        const _cresceu = (l, ag, bs) => (!l || !ag || !bs) ? 0
          : Math.max(0, (ag.y + ag.h) - (bs.y + bs.h)) + Math.max(0, (ag.w || 0) - (bs.w || 0));
        const obAtual = atual.get(o.id), obBase = base(o.id) || { x:o.x||0, y:o.y||0, w:o.w||0, h:o.h||0 };
        const cT = _cresceu(t, ta, tb), cO = _cresceu(o, obAtual, obBase);
        const culpado = cO > cT ? o : t;
        /* ── QUEM CRESCEU × QUEM É A ORIGEM ────────────────────────────────────────────────
           A medida acima responde quem MEXEU; ela não responde POR QUÊ. Um CTA empurrado 200px
           corrente abaixo "cresceu" mais que todo mundo, e o detector o acusava de invadir a
           foto — a busca então encolhia o CTA até o piso sem tocar no título que empurrou tudo,
           e declarava "sem saída" onde o solver resolvia em quatro voltas.
           O motor nunca fez isso: ele reporta `_raizDinamica(t)||t`, a primeira camada COM
           CAMPO subindo pela corrente. A mesma régua mora no Graph desde a Fase 2
           (`gGraphDynamicRoot`), e é ela que responde aqui.
           ⚠ O DELTA continua saindo de quem cresceu, não da raiz: o empurrão que falta é
           geometria entre estes dois retângulos, e a raiz pode estar a três blocos de distância. */
        const _raizDe = (l) => {
          const nn = ctx._no.get(l.id);
          if(nn && nn.campos.length) return l.id;
          const r = (typeof gGraphDynamicRoot === 'function') ? gGraphDynamicRoot(ctx.graph, l.id) : null;
          return (r && r.id) || l.id;
        };
        const origem = _raizDe(culpado);
        const cb = culpado === t ? tb : obBase, ca = culpado === t ? ta : obAtual;
        const vitima = culpado === t ? o : t;
        const vb = culpado === t ? obBase : tb, va = culpado === t ? obAtual : ta;
        /* O DELTA é o EMPURRÃO QUE FALTA, não o excesso total do culpado — e a diferença não é
           sutil. A corrente do solver posiciona em ABSOLUTO (`paiTinta + gap autorado`) e
           reposiciona do zero a cada volta, justamente para não acumular empurrão sobre
           empurrão. Reportar o excesso total fazia cada nova detecção pedir os mesmos 83px de
           novo: o assentamento empurrava 249px onde o solver empurra 83, e a busca partia de um
           estado que o motor jamais produz.
           `gap` é o vão AUTORADO entre as duas tintas; o alvo é o pé da tinta do culpado AGORA
           mais esse vão; o delta é a distância que falta. Converge em uma volta. */
        const gapAutorado = vb.y - (cb.y + cb.h);
        const alvoY = (ca.y + ca.h) + gapAutorado;
        out.push({ tipo:'collision', targetId:o.id, withId:t.id,
          detalhe:{ delta: Math.round(Math.max(0, alvoY - va.y)),
                    culpado:origem, cresceu:culpado.id, vitima:vitima.id, motivo:apertado.motivo } });
      }else if(ideal.colide){
        out.push({ tipo:'spacing-pressure', targetId:t.id, withId:o.id,
          detalhe:{ gapBase:Math.round(ideal.gapBase) } });
      }
    });
  });

  /* Ordem EXPLÍCITA: prioridade declarada, depois alvo, depois tipo. A ordem em que as camadas
     aparecem na lista nunca pode decidir qual problema a busca ataca primeiro. */
  out.sort((a, b) => G_LAYOUT_PROBLEM_PRIORITY.indexOf(a.tipo) - G_LAYOUT_PROBLEM_PRIORITY.indexOf(b.tipo)
    || (a.targetId < b.targetId ? -1 : a.targetId > b.targetId ? 1 : 0)
    || (a.withId || '') < (b.withId || '') ? -1 : 1);
  // Um problema por par/alvo: o mesmo dano visto dos dois lados é um dano só.
  const vistos = new Set();
  return out.filter(p => {
    const k = p.tipo + '|' + [p.targetId, p.withId || ''].sort().join('|');
    if(vistos.has(k)) return false;
    vistos.add(k); return true;
  });
}
/* A MAGNITUDE do dano — a soma dos excessos que os próprios problemas já reportam. Serve a UMA
   pergunta: este ramo progrediu? Contar problemas não basta — um degrau de 8% num título que
   estoura 448px não elimina a colisão, mas encurta o excesso, e sem isso a busca pararia na
   primeira tentativa e jamais encadearia dois encolhimentos.
   ⛔ NÃO É NOTA. É pixel de dano somado, sem peso, sem papel, sem gosto. Quem julga é a Fase 6. */
function _gDanoTotal(problemas){
  return (problemas || []).reduce((s, p) => {
    const d = p.detalhe || {};
    return s + (d.delta || 0) + (d.excesso || 0) + (d.excedeAbaixo || 0) + (d.excedeDireita || 0);
  }, 0);
}

// Retângulos autorados por ID — o que `_gLayoutObstaculo` espera receber como referência.
function _gDetRects(camadas, ctx){
  const m = {};
  (camadas || []).forEach(l => { if(l && l.id) m[l.id] = ctx._tinta.get(l.id)
    || { x:l.x||0, y:l.y||0, w:l.w||0, h:l.h||0 }; });
  return m;
}

/* ── CANDIDATO ────────────────────────────────────────────────────────────────────────────
   Serializável, sem função, sem referência a objeto vivo. */
function _gCandidato(base, opts){
  const c = Object.assign({ id:'', rootId:null, problem:null, actions:[], actionSignatures:[],
    depth:0, layers:base, solveState:{}, changedIds:[], status:'partial', diagnostics:{},
    searchMode:'normal', causeKey:null, scaleGroupIds:[],
    causasAtivas:[], causasResolvidas:[], causasReduzidas:[], causasReabertas:[], causasTocadas:[],
    signature:'' }, opts || {});
  c.signature = gLayoutCandidateSignature(c);
  c.id = 'cand:' + c.signature;
  return c;
}

/**
 * ASSINATURA DO CANDIDATO — o ESTADO, não o caminho.
 * Dois caminhos diferentes que chegaram à mesma composição efetiva têm que ser reconhecidos como
 * o mesmo candidato; deduplicar pela lista de ações deixaria os dois vivos e a Fase 6 escolheria
 * entre duas cópias da mesma coisa. Entra a geometria e a tipografia TRANSITÓRIA (o teto de
 * fonte, a entrelinha, o tracking, o corredor) — que é o que o render vai ler.
 */
/* Normaliza para `{layers, solveState}`. Aceita array puro (compatível com a Fase 5). */
function _gEstado(x){
  if(Array.isArray(x)) return { layers:x, solveState:{} };
  return { layers:(x && x.layers) || [], solveState:Object.assign({}, (x && x.solveState) || {}) };
}
// As chaves de solve que fazem parte da IDENTIDADE de um estado — ordenadas, nunca a ordem do objeto.
const G_SOLVE_STATE_CHAVES = ['respiroFator'];

function gLayoutCandidateSignature(candidate){
  const ls = (candidate && candidate.layers) || [];
  const canon = ls.map(l => [l.id, Math.round(l.x||0), Math.round(l.y||0),
      Math.round(l.w||0), Math.round(l.h||0),
      l._tetoFonte != null ? Math.round(l._tetoFonte) : '',
      l._entrelinha != null ? l._entrelinha : '',
      l.letterSpacing != null ? l.letterSpacing : '',
      l._layoutW != null ? Math.round(l._layoutW) : '',
      l._layoutMaxLines != null ? l._layoutMaxLines : ''].join(':'))
    .sort().join('|');
  /* ⚠ O SOLVE STATE ENTRA NA ASSINATURA. Dois candidatos com a geometria idêntica mas respiro
     1 e 0.5 NÃO são o mesmo estado: o segundo tem uma folga que o primeiro não tem, e tratá-los
     como iguais deduplicaria justamente o efeito de `compress-gap`. */
  const ss = (candidate && candidate.solveState) || {};
  const canonSolve = G_SOLVE_STATE_CHAVES.map(k => k + '=' + (ss[k] != null ? ss[k] : '')).join(',');
  /* ⚠ O MODO ENTRA QUANDO MUDA O ESTADO OPERACIONAL — e só aí. Um candidato de emergência com a
     mesma geometria de um normal NÃO é o mesmo candidato: ele nasceu com um piso tipográfico
     diferente autorizado, e confundir os dois esconderia justamente a distinção que esta fase
     existe para medir. O modo normal não entra na conta, para que a assinatura de tudo o que já
     existia continue idêntica — modo é exceção, não parte da identidade de todo estado. */
  const modo = (candidate && candidate.searchMode === 'emergency') ? '#emergency' : '';
  return _gGramHash('c2#' + canon + '#' + canonSolve + modo);
}

/* ── CANONICAL SETTLE — o estado normal da arte com o conteúdo real ───────────────────────
   ⛔ ASSENTAR NÃO É DESIGNER MOVE. A corrente empurrar o bloco de baixo porque o de cima
   cresceu não é uma decisão de design — é o conteúdo real ocupando o lugar dele. A placa
   acompanhar a tinta do texto também não é uma alternativa: é a placa fazendo o que a placa faz.
   Tratar isso como movimento fazia a busca gastar profundidade "resolvendo" o que já estaria
   resolvido antes de começar, e encher o histórico de decisões que ninguém decidiu.

   A Fase 5.75 tentou reproduzir `_posicionar()` com os próprios Designer Moves. Aproximação não
   serve: o `container-mismatch` não convergia porque o descritor da placa andava junto com ela,
   e o empurrão acumulava porque o delta era relativo. Agora não há aproximação — o solver ganhou
   uma saída (`_soAssentar`) que devolve exatamente o estado que ele julga antes de subir a
   escada. Paridade por CONSTRUÇÃO: é o mesmo código.

   ⚠ IDEMPOTÊNCIA vem do desenho, não de sorte: o candidato guarda a geometria AUTORADA com os
   carimbos de tipografia por cima, e o assentamento SEMPRE parte dali. Nada acumula, então
   `settle(settle(x)) === settle(x)` por construção — e há teste. */
function gSettleLayoutState(state, ctx){
  const st = _gEstado(state);
  if(typeof gApplyRelativeAnchors !== 'function')
    return { layers:st.layers, solveState:st.solveState, assentado:false, diagnostics:null };
  /* ── A BASE DO ASSENTAMENTO É SEMPRE A GEOMETRIA AUTORADA ──────────────────────────────
     `_posicionar()` lê a posição publicada de cada camada (`yPub`) como PISO da corrente, e
     `_gInferirPlacas` deriva os quatro paddings da placa contra a caixa desenhada. Assentar em
     cima de um estado já assentado move as duas referências: o piso desce mais um colapso e o
     padding vem do equilíbrio da volta anterior — que é exatamente o não-convergir da Fase 5.75.
     Por isso cada camada carrega `_geoAutor`, a geometria com que o designer publicou, e o
     assentamento SEMPRE restaura dali antes de chamar o motor.
     ⚠ É daqui que vem a idempotência: `settle(settle(x)) === settle(x)` por construção, não por
     coincidência numérica. Designer Move que mexe em geometria reescreve `_geoAutor` (§16) —
     porque aí a base mudou de verdade, por decisão, não por consequência. */
  const base = st.layers.map(l => {
    const a = l._geoAutor;
    if(a) return Object.assign({}, l, { x:a.x, y:a.y, w:a.w, h:a.h });
    return Object.assign({}, l, { _geoAutor:{ x:l.x || 0, y:l.y || 0, w:l.w || 0, h:l.h || 0 } });
  });
  let out = null;
  try{
    out = gApplyRelativeAnchors(base, (ctx && ctx.dados) || {}, {},
      { fitText:true, canvas:(ctx && ctx.canvas) || null, scope:'franqueado', _soAssentar:true });
  }catch(e){ out = null; }
  if(!out || !out.length)
    return { layers:base, solveState:st.solveState, assentado:false, diagnostics:null };
  /* O que o assentamento FEZ, para diagnóstico — fora do histórico de ações, porque não é
     decisão adaptativa. Responde "o que o motor precisou fazer para representar este conteúdo",
     que é outra pergunta. */
  const idxB = new Map(base.map(l => [l.id, l]));
  const moveu = [], cresceu = [];
  out.forEach(l => {
    const b = idxB.get(l.id);
    if(!b) return;
    if(Math.round(l.y||0) !== Math.round(b.y||0) || Math.round(l.x||0) !== Math.round(b.x||0)) moveu.push(l.id);
    if(Math.round(l.w||0) !== Math.round(b.w||0) || Math.round(l.h||0) !== Math.round(b.h||0)) cresceu.push(l.id);
  });
  return { layers:out, solveState:st.solveState, assentado:true,
           diagnostics:{ moveu:moveu.sort(), cresceu:cresceu.sort(),
                         ms:(out._layoutMeta && out._layoutMeta.ms) || 0 } };
}

/* O estado assentado de um candidato, com cache pela assinatura dele. A busca assenta muitas
   vezes; assentar é rodar o solver, e rodar o solver duas vezes para o mesmo estado é desperdício
   puro. ⚠ A API existe para que ninguém detecte problema em estado CRU por descuido. */
function gSettleCandidateState(cand, ctx){
  const chave = (cand && cand.signature) || gLayoutCandidateSignature(cand);
  const cache = ctx._settle || (ctx._settle = new Map());
  if(cache.has(chave)) return cache.get(chave);
  const r = gSettleLayoutState({ layers:cand.layers, solveState:cand.solveState }, ctx);
  r.settledSignature = gLayoutCandidateSignature({ layers:r.layers, solveState:r.solveState });
  if(cache.size > 500) cache.clear();
  cache.set(chave, r);
  return r;
}

/* ── PROBLEMAS CAUSAIS — sintoma não é causa ──────────────────────────────────────────────
   Um título que cresce colide com o preço, com o CTA e com a placa: o detector reporta TRÊS
   danos, e a Fase 5.75 mostrou a busca tentando corrigir as três vítimas uma a uma. O solver
   não faz isso — ele encolhe o culpado, e os três somem juntos.

   ⛔ CAUSA SÓ COM PROVA. O agrupamento usa exclusivamente o `culpado` que o detector já apurou
   por evidência objetiva (tinta autorada × tinta atual, quem cresceu). Papel semântico,
   proximidade e estética NÃO entram. Sintoma sem culpado identificado fica sozinho, no seu
   próprio grupo — é melhor tratar um dano isolado do que inventar uma origem comum. */
function gGroupLayoutProblems(problemas){
  const grupos = new Map();
  (problemas || []).forEach(p => {
    const culpado = (p.detalhe && p.detalhe.culpado) || null;
    // Sem culpado provado, o problema é a própria causa — e não se junta a ninguém.
    const chave = culpado ? 'c:' + culpado : 'i:' + p.tipo + ':' + p.targetId;
    /* A CHAVE é a identidade estável da causa entre um passo e o seguinte: o culpado provado.
       A assinatura do grupo inclui os sintomas, e sintoma muda a cada movimento (é o ponto de
       mexer) — então ela não serve para dizer "é a mesma causa de antes". */
    if(!grupos.has(chave)) grupos.set(chave, { key:chave, culpritId:culpado, problems:[], totalDamage:0 });
    const g = grupos.get(chave);
    g.problems.push(p);
    g.totalDamage += _gDanoTotal([p]);
  });
  const out = [...grupos.values()].map(g => {
    g.problems.sort((a, b) => G_LAYOUT_PROBLEM_PRIORITY.indexOf(a.tipo) - G_LAYOUT_PROBLEM_PRIORITY.indexOf(b.tipo)
      || (a.targetId < b.targetId ? -1 : 1));
    /* A assinatura ignora a ORDEM dos sintomas: o mesmo conjunto de danos com a mesma origem é
       o mesmo grupo, tenha ele sido detectado em que ordem for. */
    g.signature = _gGramHash('g1#' + (g.culpritId || '') + '#' +
      g.problems.map(p => p.tipo + ':' + p.targetId + ':' + (p.withId || '')).sort().join('|'));
    g.causeId = 'cause:' + g.signature;
    g.type = g.culpritId ? 'growth-pressure' : 'isolated';
    return g;
  });
  /* Ordem: mais sintomas primeiro (atacar a causa que explica mais dano rende mais), depois
     prioridade do pior sintoma, depois dano, depois assinatura. Tudo fato objetivo. */
  out.sort((a, b) => b.problems.length - a.problems.length
    || G_LAYOUT_PROBLEM_PRIORITY.indexOf(a.problems[0].tipo) - G_LAYOUT_PROBLEM_PRIORITY.indexOf(b.problems[0].tipo)
    || b.totalDamage - a.totalDamage
    || (a.signature < b.signature ? -1 : 1));
  return out;
}

/* A MESMA causa, no estado seguinte. Identidade de causa é o CULPADO provado — a assinatura do
   grupo inclui os sintomas, e sintoma muda a cada movimento (é o ponto de mexer). Grupo isolado
   (sem culpado) só é "o mesmo" pela assinatura dele, que é o que ele tem. */
function _gMesmaCausa(grupos, causa){
  if(!causa) return null;
  if(causa.culpritId) return (grupos || []).find(g => g.culpritId === causa.culpritId) || null;
  return (grupos || []).find(g => g.signature === causa.signature) || null;
}

/**
 * A BUSCA. Determinística, local e limitada.
 *
 * @param {object} p {ctx, base, problem?, limites?}
 * @returns {{original, solved, partial, invalid, diagnostics}}
 */
function gSearchLayoutCandidates(p){
  const o = p || {};
  const ctx = o.ctx;
  const lim = Object.assign({}, G_SEARCH_LIMITES, o.limites || {});
  if(!ctx) return { original:null, solved:[], partial:[], invalid:[], unsafe:[],
                    diagnostics:{ generated:0, expanded:0, deduplicated:0, pruned:0,
                                  maxDepthReached:0, acoes:{}, problemasIniciais:0 } };

  /* ── ESCALADA DE MODO ─────────────────────────────────────────────────────────────────────
     NORMAL inteiro primeiro. Emergência só começa quando o normal ESGOTOU e o dano objetivo
     continua — menor sacrifício primeiro, que é a mesma filosofia da escada do solver (ele só
     entra no degrau proporcional quando ninguém mais tem folga normal).
     ⛔ Os dois modos NÃO se misturam desde a profundidade 1: um candidato de emergência não
     compete com um normal, porque não custa a mesma coisa. */
  const normal = _gBuscarNoModo(o, ctx, lim, 'normal');
  if(normal.solved.length || o.modo === 'normal'){
    normal.diagnostics.modo = 'normal';
    normal.diagnostics.emergencia = null;
    return normal;
  }
  // Sem dano nenhum na raiz também encerra aqui: não há o que socorrer.
  if(!normal.diagnostics.problemasIniciais){
    normal.diagnostics.modo = 'normal';
    normal.diagnostics.emergencia = null;
    return normal;
  }
  const emerg = _gBuscarNoModo(o, ctx, lim, 'emergency');
  const out = {
    original: normal.original,
    solved: emerg.solved,
    partial: normal.partial.concat(emerg.partial),
    invalid: normal.invalid.concat(emerg.invalid),
    unsafe: (normal.unsafe || []).concat(emerg.unsafe || []),
    diagnostics: Object.assign({}, normal.diagnostics, {
      modo: emerg.solved.length ? 'emergency' : 'normal',
      firstSolvedDepth: emerg.diagnostics.firstSolvedDepth,
      firstSolvedMode: emerg.solved.length ? 'emergency' : null,
      generated: normal.diagnostics.generated + emerg.diagnostics.generated,
      expanded: normal.diagnostics.expanded + emerg.diagnostics.expanded,
      deduplicated: normal.diagnostics.deduplicated + emerg.diagnostics.deduplicated,
      pruned: normal.diagnostics.pruned + emerg.diagnostics.pruned,
      maxDepthReached: Math.max(normal.diagnostics.maxDepthReached, emerg.diagnostics.maxDepthReached),
      unsafeRejeitados: (normal.diagnostics.unsafeRejeitados || 0) + (emerg.diagnostics.unsafeRejeitados || 0),
      gruposAdaptativos: (normal.diagnostics.gruposAdaptativos || 0) + (emerg.diagnostics.gruposAdaptativos || 0),
      emergencia: emerg.diagnostics
    })
  };
  return out;
}

/* A BUSCA DE UM MODO. Tudo o que era `gSearchLayoutCandidates` mora aqui; a função pública
   virou o orquestrador dos dois modos. */
function _gBuscarNoModo(o, ctx, lim, modo){
  const base = o.base || [];
  const emergencia = (modo === 'emergency');
  const diag = { generated:0, expanded:0, deduplicated:0, pruned:0, maxDepthReached:0,
                 acoes:{}, problemasIniciais:0, modo:modo, firstSolvedMode:null };

  /* ── O CICLO ──────────────────────────────────────────────────────────────────────────────
     candidato (geometria AUTORADA + carimbos) → ASSENTA → detecta → agrupa por causa → escolhe
     a causa → Designer Moves → aplica → novo candidato → ASSENTA de novo.
     Assentar entra em TODA volta porque toda ação pode mudar o que a corrente precisa reacomodar:
     encolher o título muda a tinta, a placa segue a tinta, e quem está encadeado abaixo muda de
     lugar. Medir sem assentar é medir um estado que o motor nunca julga. */
  const _assentar = (cand) => {
    if(o.assentar === false)
      return { layers:cand.layers, solveState:cand.solveState, assentado:false, diagnostics:null,
               settledSignature:cand.signature };
    return gSettleCandidateState(cand, ctx);
  };
  const _preparar = (cand) => {
    const a = _assentar(cand);
    cand.settleDiagnostics = a.diagnostics;
    cand.settledSignature = a.settledSignature || null;
    return { layers:a.layers, solveState:cand.solveState };
  };

  const bruto = _gEstado(base);
  const raiz = _gCandidato(bruto.layers, { depth:0, rootId:o.rootId || null, searchMode:modo,
    solveState:bruto.solveState, actions:[], actionSignatures:[] });
  const st0 = _preparar(raiz);
  diag.assentamento = raiz.settleDiagnostics
    ? { moveu:raiz.settleDiagnostics.moveu, cresceu:raiz.settleDiagnostics.cresceu } : null;
  const problemasBase = o.problem ? [o.problem] : gDetectLayoutProblems(st0, ctx);
  const gruposBase = gGroupLayoutProblems(problemasBase);
  raiz.diagnostics = { problemas:problemasBase.length, tipos:problemasBase.map(x => x.tipo),
                       causas:gruposBase.map(g => ({ causeId:g.causeId, key:g.key,
                         culpritId:g.culpritId, type:g.type, sintomas:g.problems.length })) };
  raiz.causasAtivas = gruposBase.map(g => g.key).sort();
  raiz.causasResolvidas = []; raiz.causasReduzidas = []; raiz.causasReabertas = [];
  raiz.causasTocadas = [];
  diag.problemasIniciais = problemasBase.length;
  diag.causasIniciais = raiz.causasAtivas.length;
  diag.porDepth = [];

  /* ── ORIGINAL-FIRST ── sem dano objetivo no estado ASSENTADO não há o que buscar. */
  if(!problemasBase.length){
    /* ORIGINAL-FIRST também passa pelo portão: a arte publicada com o conteúdo real assentado
       tem que ser aprovada pelo produto, não só pelo detector. */
    const segRaiz = gLayoutCandidateSafety(raiz, ctx, problemasBase);
    if(segRaiz.seguro){
      raiz.status = 'solved';
      diag.firstSolvedDepth = 0; diag.firstSolvedMode = modo;
      return { original:raiz, solved:[raiz], partial:[], invalid:[], unsafe:[], diagnostics:diag };
    }
    raiz.status = 'unsafe';
    raiz.diagnostics.reprovadas = segRaiz.reprovadas;
    diag.unsafeRejeitados = 1;
    diag.problemasIniciais = segRaiz.reprovadas.length;
  }
  if(!problemasBase.length && raiz.status === 'unsafe'){
    /* O detector não vê dano e o produto reprova: não há o que a busca ataque (ela age sobre
       problemas). Devolve o diagnóstico em vez de fingir solução. */
    return { original:raiz, solved:[], partial:[], invalid:[], unsafe:[raiz], diagnostics:diag };
  }

  const vistos = new Set([raiz.signature]);
  const solved = [], partial = [], invalid = [], unsafe = [];
  raiz._medido = st0; raiz.diagnostics.lista = problemasBase; raiz.diagnostics.grupos = gruposBase;
  raiz._resolvidas = [];
  let fronteira = [raiz];
  diag.firstSolvedDepth = null;
  const _bloqueios = {};
  const _mapaCausa = (gs) => new Map((gs || []).map(g => [g.key, g]));

  for(let depth = 0; depth < lim.maxDepth && fronteira.length; depth++){
    const proxima = [];
    const doDepth = { depth:depth + 1, expandidos:0, gerados:0, dedup:0, podados:0, solved:0, ms:0 };
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    fronteira.forEach(pai => {
      if(diag.generated >= lim.maxCandidatos) return;
      const medidoPai = pai._medido || _preparar(pai);
      const estadoPai = { layers:pai.layers, solveState:pai.solveState };
      const problemas = pai.diagnostics.lista || gDetectLayoutProblems(medidoPai, ctx);
      if(!problemas.length) return;                       // já resolvido: não expande
      const danoPai = _gDanoTotal(problemas);
      /* ── EXPANSÃO CRUZADA ── as causas são derivadas do ESTADO ATUAL, sempre. Nada de causa
         congelada no candidato: depois que uma ação reduziu A, a próxima expansão deste ramo
         pode perfeitamente atacar B, porque o reagrupamento aconteceu de novo sobre o estado
         reassentado. */
      const grupos = pai.diagnostics.grupos || gGroupLayoutProblems(problemas);
      const mapaPai = _mapaCausa(grupos);
      /* ── UMA CAUSA POR EXPANSÃO, MAS NÃO SEMPRE A MESMA ──────────────────────────────────
         Atacar só a causa que explica mais dano era o que perdia as combinações cruzadas:
         A → B e B → A nunca nasciam juntas porque B jamais chegava a ser escolhida. Agora
         cada causa viva rende o seu próprio ramo, e a diversidade do beam (abaixo) é quem
         garante que os dois sobrevivam ao corte. */
      /* ⚠ QUANTAS CAUSAS POR NÓ. Expandir TODAS numa arte de 344 camadas com trinta causas não
         é diversidade, é varredura: o beam carrega `beamWidth` ramos, então da causa nº 9 em
         diante nada sobrevive ao corte — só custa um assentamento (que é rodar o solver) e uma
         detecção por candidato gerado. O teto é a própria largura do beam, não um número novo:
         a busca gera no máximo o que ela consegue levar adiante. */
      grupos.slice(0, lim.beamWidth).forEach(grupo => {
        if(diag.generated >= lim.maxCandidatos) return;
        const alvo = grupo.problems[0];
        const culpado = grupo.culpritId;
        diag.expanded++; doDepth.expandidos++;

        /* ── O ADAPTIVE SCALE GROUP DESTE CONFLITO ── derivado do estado assentado, agora. Ele
           viaja no problema porque é a geração que decide se `scale-component` vale a pena no
           escopo do componente, no do grupo, ou nos dois. */
        const asg = gBuildAdaptiveScaleGroup(ctx, medidoPai, grupo, problemas, pai.scaleGroupIds);
        if(asg.membros.length > (asg.semente.length))
          diag.gruposAdaptativos = (diag.gruposAdaptativos || 0) + 1;

        /* ── ESCALADA DE IMPACTO ── começa LOCAL e só abre o raio quando o nível atual NÃO
           PRODUZ MOVIMENTO NENHUM. O nível 4 (a arte inteira) fica FORA: é outra fase. */
        let acoes = [];
        for(let nivel = 0; nivel <= 3 && !acoes.length; nivel++){
          acoes = gGenerateLayoutActions(ctx, Object.assign({}, alvo,
            /* ⛔ SEM CULPADO, SEM RAIZ. Herdar a raiz do pai fazia a zona de impacto de OUTRO
               conflito barrar as ações locais de um problema isolado — era assim que
               `text-overflow` sem culpado não gerava nada. Sem origem provada a pergunta é só
               sobre o alvo, e é o que a política de auto-adaptação diz. */
            { rootId: culpado || null, impactLevel:nivel, _adaptiveGroup:asg }),
            medidoPai.layers, modo);
          /* ⛔ `scale-component` é o maior raio que existe aqui: escalar o bloco inteiro. Ela não
             compete com um wrap barato no primeiro passo. */
          if(depth === 0) acoes = acoes.filter(a => a.id !== 'scale-component');
        }
        /* CULPADO PRIMEIRO. Quando a causa está provada, mexer nela apaga os sintomas todos de
           uma vez — é o que o solver faz. Dentro de cada lado, a ordem da escada manda. */
        if(culpado && acoes.length > 1){
          const doCulpado = acoes.filter(a => a.targetId === culpado);
          if(doCulpado.length) acoes = doCulpado.concat(acoes.filter(a => a.targetId !== culpado));
        }
        if(!acoes.length){
          const k = alvo.tipo + (culpado ? '|causa' : '|isolado') + '|' + modo;
          _bloqueios[k] = (_bloqueios[k] || 0) + 1;
        }

        acoes.forEach(acao => {
          if(diag.generated >= lim.maxCandidatos) return;
          /* ⚠ O TETO É POR DECISÃO, NÃO POR NOME. `scale-component/component` e
             `scale-component/collision-group` são dois movimentos diferentes — conjuntos
             diferentes, pisos diferentes, contagens de degrau diferentes. Compartilhar o
             orçamento fazia a escala do componente (que continuava mexendo num membro com folga
             enquanto o culpado já estava no piso) gastar as voltas de que a escala do grupo
             precisava depois. Não é aumentar a busca: é parar de somar duas coisas. */
          const _chaveTeto = (a) => a.id + ((a.params && a.params.escopo) ? '/' + a.params.escopo : '');
          const chaveAcao = _chaveTeto(acao);
          const jaUsou = pai.actions.filter(x => _chaveTeto(x) === chaveAcao).length;
          /* TETO DE REPETIÇÃO — quantos degraus o motor tem para esta ação. Em emergência o
             `shrink-text` não tem quatro: tem os que couberem daqui até o piso de emergência,
             e a capacidade já contou (`degraus`). Não é aumentar a busca por força bruta — é
             parar de mentir sobre o tamanho da escada. */
          /* TETO DERIVADO quando a capacidade CONTOU os degraus: `shrink-text` em emergência e
             `scale-component` em qualquer modo sabem exatamente quantas voltas de 8% cabem até
             o piso do modo. A tabela continua sendo o piso mínimo. */
          const teto = (acao.params && acao.params.degraus)
            ? Math.max(G_ACAO_REPETICAO[acao.id] || 1, acao.params.degraus)
            : (G_ACAO_REPETICAO[acao.id] || 1);
          if(jaUsou >= teto){ diag.pruned++; doDepth.podados++; return; }

          const repeticoes = G_ACAO_MONOTONICA[acao.id] ? (teto - jaUsou) : 1;
          let estado = estadoPai, medido = medidoPai, acoesAcum = pai.actions, sigsAcum = pai.actionSignatures;
          let mudouAcum = pai.changedIds, passo = acao, probsDoPasso = problemas, mapaAnterior = mapaPai;
          let resolvidasAcum = pai._resolvidas || [];
          let tocadasAcum = pai.causasTocadas || [];
          for(let k = 0; k < repeticoes; k++){
            if(!passo || diag.generated >= lim.maxCandidatos) break;
            const r = gApplyLayoutAction(estado, passo, ctx);
            diag.generated++; doDepth.gerados++;
            diag.acoes[passo.id] = (diag.acoes[passo.id] || 0) + 1;
            if(!r.changedIds.length && r.solveState.respiroFator === estado.solveState.respiroFator){
              diag.pruned++; doDepth.podados++; break;
            }
            estado = { layers:r.layers, solveState:r.solveState };
            acoesAcum = acoesAcum.concat([passo]);
            sigsAcum = sigsAcum.concat([passo.signature]);
            mudouAcum = [...new Set(mudouAcum.concat(r.changedIds))].sort();
            tocadasAcum = [...new Set(tocadasAcum.concat([grupo.key]))].sort();

            const filho = _gCandidato(r.layers, { depth:depth + 1, solveState:r.solveState,
              rootId: pai.rootId || alvo.targetId, problem: alvo, causeId: grupo.causeId,
              causeKey: grupo.key, searchMode: modo, scaleGroupIds: asg.membros.slice(),
              actions: acoesAcum, actionSignatures: sigsAcum, changedIds: mudouAcum });

            if(vistos.has(filho.signature)){ diag.deduplicated++; doDepth.dedup++; break; }
            vistos.add(filho.signature);

            // ASSENTA DE NOVO, e só então mede.
            medido = _preparar(filho);
            const restantes = gDetectLayoutProblems(medido, ctx);
            const gruposFilho = gGroupLayoutProblems(restantes);
            const mapaFilho = _mapaCausa(gruposFilho);
            const danoFilho = _gDanoTotal(restantes);

            /* ── COBERTURA CAUSAL ── diagnóstico objetivo, não nota. Responde o que aconteceu
               com cada causa: sumiu, encolheu, ou VOLTOU depois de já ter sido resolvida neste
               mesmo caminho. Causa reaberta não é proibida (às vezes trocar um dano por outro
               é o caminho), mas fica visível — é informação que o scoring vai querer. */
            const ativas = [...mapaFilho.keys()].sort();
            const resolvidas = [...mapaAnterior.keys()].filter(k2 => !mapaFilho.has(k2)).sort();
            const reduzidas = [...mapaFilho.keys()].filter(k2 => {
              const a = mapaAnterior.get(k2), b = mapaFilho.get(k2);
              return a && b && (b.problems.length < a.problems.length || b.totalDamage < a.totalDamage);
            }).sort();
            const reabertas = ativas.filter(k2 => resolvidasAcum.indexOf(k2) >= 0);
            const novasResolvidas = [...new Set(resolvidasAcum.concat(resolvidas))]
              .filter(k2 => !mapaFilho.has(k2)).sort();
            filho.causasAtivas = ativas;
            filho.causasResolvidas = resolvidas;
            filho.causasReduzidas = reduzidas;
            filho.causasReabertas = reabertas;
            filho.causasTocadas = tocadasAcum;
            filho._resolvidas = novasResolvidas;

            filho.diagnostics = { problemasAntes:probsDoPasso.length, problemasDepois:restantes.length,
              resolvidos:probsDoPasso.length - restantes.length, lista:restantes, grupos:gruposFilho,
              danoAntes:danoPai, danoDepois:danoFilho, corrida:k + 1,
              causas:gruposFilho.length, causaAtacada:grupo.key, modo:modo,
              tipos:restantes.map(x => x.tipo) };
            filho._medido = medido;

            // PODA — violação objetiva: alguém protegido se mexeu.
            const violou = filho.changedIds.some(id => {
              const nn = ctx._no.get(id);
              return !!(nn && (nn.protegida || nn.fundo));
            });
            if(violou){ filho.status = 'invalid'; invalid.push(filho); diag.pruned++; doDepth.podados++; break; }

            /* ── PORTÃO DE SEGURANÇA — AUTORIDADE FINAL ───────────────────────────────────
               `solved` exige DUAS aprovações: o detector não achar dano objetivo E o veredito do
               produto (`gLayoutCamadaReprovada`, via `gLayoutCandidateSafety`) aprovar a
               composição. São duas implementações da mesma pergunta, e duas implementações
               divergem — foi assim que um `estouro` de largura passou pelo detector na Fase 5.9.
               ⛔ Detector em zero e produto reprovando NÃO vira `partial` em silêncio: vira
               `unsafe`, com o motivo à vista. Candidato inseguro nunca sai daqui como solução. */
            if(!restantes.length){
              const seg = gLayoutCandidateSafety(filho, ctx, restantes);
              if(seg.seguro){
                filho.status = 'solved'; solved.push(filho); doDepth.solved++;
                if(diag.firstSolvedDepth == null){ diag.firstSolvedDepth = filho.depth; diag.firstSolvedMode = modo; }
                break;
              }
              filho.status = 'unsafe';
              filho.diagnostics.reprovadas = seg.reprovadas;
              unsafe.push(filho); doDepth.inseguros = (doDepth.inseguros || 0) + 1;
              diag.unsafeRejeitados = (diag.unsafeRejeitados || 0) + 1;
              /* Reprovado pelo produto ainda é um estado melhor que o pai — segue na fronteira
                 para que a busca possa continuar a partir dele. Só não conta como solução. */
              proxima.push(filho);
              break;
            }
            filho.status = 'partial';
            partial.push(filho);
            /* ── PROGRESS GUARD CAUSAL ── o movimento foi feito contra UMA causa; é contra ela
               que se mede se progrediu. Encolher o culpado corta o dano dele e pode trazer o
               dependente de volta para cima, onde ele encosta em outra coisa: o placar global
               piora e a causa atacada encolhe. Quem impede vaivém é a assinatura de estado, o
               beam e o teto de candidatos — não este guard. */
            const causaDepois = mapaFilho.get(grupo.key);
            const progrediuCausa = !causaDepois
              || causaDepois.problems.length < grupo.problems.length
              || causaDepois.totalDamage < grupo.totalDamage;
            if(progrediuCausa || restantes.length < probsDoPasso.length || danoFilho < danoPai) proxima.push(filho);
            else { diag.pruned++; doDepth.podados++; }

            if(k + 1 < repeticoes){
              probsDoPasso = restantes; mapaAnterior = mapaFilho;
              resolvidasAcum = novasResolvidas;
              /* A corrida continua contra a MESMA causa — re-gerada sobre o estado novo já
                 assentado, para que piso, portão e capacidade sejam consultados a cada degrau.
                 Se a causa sumiu, a corrida acabou: quem continua é a expansão normal. */
              const gMesma = mapaFilho.get(grupo.key);
              if(!gMesma){ passo = null; break; }
              const asgK = gBuildAdaptiveScaleGroup(ctx, medido, gMesma, restantes, asg.membros);
              const cand = gGenerateLayoutActions(ctx, Object.assign({}, gMesma.problems[0],
                { rootId: gMesma.culpritId || null, impactLevel:3, _adaptiveGroup:asgK }),
                medido.layers, modo);
              passo = cand.find(x => x.id === acao.id && x.targetId === acao.targetId) || null;
            }
          }
        });
      });
    });
    doDepth.ms = Math.round((((typeof performance !== 'undefined' && performance.now) ? performance.now() : 0) - t0) * 100) / 100;
    diag.porDepth.push(doDepth);
    diag.maxDepthReached = Math.max(diag.maxDepthReached, depth + 1);
    if(solved.length) break;
    fronteira = _gBeamPorCausa(proxima, lim.beamWidth);
    doDepth.causasNoBeam = [...new Set(fronteira.map(c => c.diagnostics.causaAtacada))].length;
  }

  diag.bloqueios = _bloqueios;
  const _ord = (a, b) => a.depth - b.depth || a.actions.length - b.actions.length
    || (a.signature < b.signature ? -1 : 1);
  solved.sort(_ord); partial.sort(_ord); invalid.sort(_ord); unsafe.sort(_ord);
  [].concat([raiz], solved, partial, invalid, unsafe).forEach(c => {
    delete c.diagnostics.lista; delete c.diagnostics.grupos; delete c._medido; delete c._resolvidas;
  });
  return { original:raiz, solved, partial, invalid, unsafe, diagnostics:diag };
}

/* ── BEAM COM DIVERSIDADE CAUSAL ──────────────────────────────────────────────────────────
   ⛔ A LARGURA NÃO MUDA. O problema nunca foi caber pouco: era caber oito ramos da MESMA causa.
   Numa arte com três causas simultâneas, a causa que produz o maior dano no primeiro passo
   ocupava a fronteira inteira, e A → B, B → A, B → C morriam antes de nascer — não por serem
   piores, mas por não terem chegado a existir.

   Agora o corte é por RODÍZIO entre causas: cada causa atacada põe o seu melhor representante,
   depois o segundo, e assim por diante, até encher a largura. Causa que tem um candidato só não
   perde a vaga; causa que tem doze não leva todas.

   ⛔ NÃO É NOTA. Dentro de cada causa a ordem continua sendo fato objetivo: menos causas vivas,
   menos problemas, menos dano em pixels, menor profundidade, assinatura. Nada de estética,
   hierarquia ou preferência — isso é da Fase 6. */
function _gBeamPorCausa(candidatos, largura){
  const _cmp = (a, b) => a.diagnostics.causas - b.diagnostics.causas
    || a.diagnostics.problemasDepois - b.diagnostics.problemasDepois
    || a.diagnostics.danoDepois - b.diagnostics.danoDepois
    || a.depth - b.depth || (a.signature < b.signature ? -1 : 1);
  const lista = (candidatos || []).slice().sort(_cmp);
  if(lista.length <= largura) return lista;
  const baldes = new Map();
  lista.forEach(c => {
    const k = (c.diagnostics && c.diagnostics.causaAtacada) || '?';
    if(!baldes.has(k)) baldes.set(k, []);
    baldes.get(k).push(c);
  });
  /* Ordem dos baldes: o melhor representante de cada causa decide a vez. Determinístico e sem
     preferência — a causa que tem o candidato mais limpo começa. */
  const chaves = [...baldes.keys()].sort((a, b) => _cmp(baldes.get(a)[0], baldes.get(b)[0])
    || (a < b ? -1 : 1));
  const out = [];
  for(let volta = 0; out.length < largura; volta++){
    let poeAlgum = false;
    for(const k of chaves){
      if(out.length >= largura) break;
      const b = baldes.get(k);
      if(volta < b.length){ out.push(b[volta]); poeAlgum = true; }
    }
    if(!poeAlgum) break;
  }
  return out.sort(_cmp);
}

/**
 * O VEREDITO DO MOTOR sobre uma solução da busca — a checagem de segurança independente.
 *
 * "Zero dano objetivo" e "o solver aprova" deveriam ser a mesma coisa: `_layoutInvalido` sai de
 * `_colisoesInternas` (a mesma régua do `collision`) e `_foraDaArte` de `_piorouBorda` (a mesma
 * do `outside-canvas`). Mas são DUAS implementações, e duas implementações divergem — então
 * aqui a solução é conferida com a função que o produto inteiro usa para reprovar arte
 * (`gLayoutCamadaReprovada`), sobre a medida que o próprio assentamento produziu.
 *
 * ⛔ Existe para uma direção só: a busca NUNCA pode declarar resolvida uma composição que o
 * motor reprovaria. O contrário — a busca achar saída onde a escada desistiu — é cobertura a
 * mais, e é reportado como tal.
 */
function gLayoutCandidateSafety(cand, ctx, problemasJaMedidos){
  const r = gSettleCandidateState(cand, ctx);
  const estado = { layers:r.layers, solveState:cand.solveState };
  /* A busca já detectou sobre ESTE estado assentado antes de chamar aqui — redetectar era pagar
     a varredura de colisão duas vezes por candidato resolvido. A lista entra quando existe. */
  const problemas = problemasJaMedidos || gDetectLayoutProblems(estado, ctx);
  /* O `_fit` das camadas assentadas é o do MOTOR (`_soAssentar` remede com `gFitTextLayer`),
     não uma medida desta camada — é o que torna a conferência independente do detector. */
  const reprovadas = (typeof gLayoutCamadaReprovada === 'function')
    ? r.layers.filter(l => l && gLayoutCamadaReprovada(l)).map(l => l.id).sort() : [];
  return { seguro: !problemas.length && !reprovadas.length,
           problemas: problemas.length, reprovadas:reprovadas,
           tipos:[...new Set(problemas.map(x => x.tipo))].sort() };
}

/* ── SHADOW MODE ──────────────────────────────────────────────────────────────────────────
   Roda a busca AO LADO do solver, sem nenhuma autoridade sobre o resultado. A arte entregue
   continua sendo a do `gApplyRelativeAnchors`; isto só observa o que a arquitetura nova teria
   encontrado. É como se dá autoridade a um motor novo: olhando antes, não confiando antes.
   ⚠ Não persiste nada e não envia nada para lugar nenhum. */
function gShadowLayoutSearch(layers, dados, canvas, opts){
  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
  const out = { problemas:0, tipos:[], gerados:0, solved:0, partial:0, invalid:0,
                profundidade:0, firstSolvedDepth:null, acoes:{}, porDepth:[],
                solverSolved:null, cobertura:null, ms:0, erro:null };
  try{
    /* O SOLVER, primeiro e sem interferência: ele resolveu? A régua é a dele
       (`gLayoutCamadaReprovada`) — não uma segunda opinião sobre o que é arte aprovada. */
    if(typeof gApplyRelativeAnchors === 'function'){
      try{
        const solved = gApplyRelativeAnchors(layers, dados || {}, {},
          { fitText:true, canvas:canvas, scope:'franqueado' });
        out.solverSolved = !(solved || []).some(l => typeof gLayoutCamadaReprovada === 'function'
          ? gLayoutCamadaReprovada(l) : !!(l && (l._layoutInvalido || l._foraDaArte)));
        out.solverVoltas = (solved && solved._layoutMeta && solved._layoutMeta.tentativas) || 0;
      }catch(e){ out.solverSolved = null; }
    }
    const ctx = gBuildOperationalContext(layers, canvas, Object.assign({ dados:dados || {} }, opts || {}));
    /* ⚠ QUEM CONTA OS PROBLEMAS É A BUSCA, no estado ASSENTADO. Contar aqui, nas camadas cruas,
       reportava dano que deixa de existir assim que a corrente e as placas se acomodam — e o
       relatório dizia "1 problema · solved@d0", que é contraditório na mesma linha. */
    const r = gSearchLayoutCandidates({ ctx, base:layers });
    const rd = (r.original && r.original.diagnostics) || {};
    out.problemas = rd.problemas || 0;
    out.tipos = [...new Set(rd.tipos || [])].sort();
    out.causas = (rd.causas || []).map(c => (c.culpritId || '?') + '×' + c.sintomas);
    out.gerados = r.diagnostics.generated;
    out.solved = r.solved.length; out.partial = r.partial.length; out.invalid = r.invalid.length;
    out.profundidade = r.diagnostics.maxDepthReached;
    out.firstSolvedDepth = r.diagnostics.firstSolvedDepth;
    out.acoes = r.diagnostics.acoes;
    out.porDepth = r.diagnostics.porDepth;
    out.dedup = r.diagnostics.deduplicated; out.podados = r.diagnostics.pruned;
    /* ── ONDE A BUSCA FICOU SEM VOCABULÁRIO ── causa expandida que não gerou ação nenhuma. É a
       diferença entre "não achou solução" e "não tinha o que tentar", e sem isso `0 candidatos`
       não dizia nada sobre o que falta construir. */
    out.bloqueios = r.diagnostics.bloqueios || {};
    /* ── NORMAL × EMERGÊNCIA, separados no relatório ── a pergunta da fase é "resolveu" E
       "precisou descer ao piso de emergência para isso". Um número só esconderia a segunda. */
    out.modo = r.diagnostics.modo || 'normal';
    out.firstSolvedMode = r.solved.length
      ? (r.diagnostics.firstSolvedMode || r.solved[0].searchMode || 'normal') : null;
    out.emergenciaRodou = !!r.diagnostics.emergencia;
    out.emergencia = r.diagnostics.emergencia ? {
      gerados:r.diagnostics.emergencia.generated,
      profundidade:r.diagnostics.emergencia.maxDepthReached,
      bloqueios:r.diagnostics.emergencia.bloqueios || {}
    } : null;
    out.acoesNaSolucao = r.solved.length ? r.solved[0].actions.map(a => a.id) : null;
    /* A conferência de segurança de TODA solução, com o veredito do motor. */
    out.solucoesInseguras = r.solved.filter(c => !gLayoutCandidateSafety(c, ctx).seguro)
      .map(c => c.actions.map(a => a.id).join('→'));
    /* Quantos candidatos o portão de segurança BARROU — detector em zero e produto reprovando.
       É o número que diz se a régua dupla está fazendo diferença ou só ocupando espaço. */
    out.unsafeRejeitados = r.diagnostics.unsafeRejeitados || (r.unsafe || []).length || 0;
    /* E quantas soluções dependem do grupo adaptativo: sem ele, seriam `so-solver`. */
    out.dependeDoGrupo = r.solved.some(c => c.actions.some(a =>
      a.id === 'scale-component' && a.params && a.params.escopo === 'collision-group'));
    out.causasTocadas = r.solved.length ? (r.solved[0].causasTocadas || []).length
                      : (r.partial.length ? (r.partial[r.partial.length - 1].causasTocadas || []).length : 0);
    out.causasReabertas = [].concat(r.solved, r.partial)
      .filter(c => (c.causasReabertas || []).length).length;

    /* ── ESCOLHA (Fase 6) ── roda AO LADO, sem autoridade nenhuma sobre o que foi renderizado.
       A arte que o franqueado baixa continua saindo de `gApplyRelativeAnchors`; isto só observa
       qual solução o julgamento hierárquico teria escolhido, e por quê. */
    if(r.solved.length && typeof gSelectLayoutCandidate === 'function'){
      const tEsc = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
      const esc = gSelectLayoutCandidate(r, ctx, { legacySolverOutcome: out.solverSolved == null
        ? null : (out.solverSolved ? 'solved' : 'unsafe') });
      out.msEscolha = Math.round((((typeof performance !== 'undefined' && performance.now) ? performance.now() : 0) - tEsc) * 100) / 100;
      out.escolha = esc.winner ? {
        acoes: esc.winner.actions.map(a => a.id),
        modo: esc.winner.searchMode, depth: esc.winner.depth,
        wonBy: esc.explanation.wonBy, criterio: esc.explanation.criterio,
        razoes: esc.explanation.reasons,
        /* A MARGEM DE DECISÃO (§17 da Fase 6.5): a distância entre #1 e #2 DENTRO do critério
           que decidiu. Diagnóstico — não muda decisão nenhuma. */
        margem: esc.explanation.margem,
        explicacao: gExplainLayoutDecision(esc),
        originalFirst: esc.diagnostics.originalFirst,
        avaliados: esc.diagnostics.avaliados, descartados: esc.diagnostics.descartados,
        /* O TOP 3, com o vetor de cada um: é o que permite ler por que o #1 ganhou do #2 sem
           acreditar num número só (§26). */
        top: esc.ranked.slice(0, 3).map(x => ({
          acoes: x.candidate.actions.map(a => a.id).join('→') || '(original)',
          modo: x.candidate.searchMode, depth: x.candidate.depth,
          vector: x.profile ? x.profile.vector.map(v => Math.round(v * 100) / 100) : null,
          semantica: x.profile ? x.profile.semantics.violacoes.length : null,
          custo: x.profile ? x.profile.alteration.camadasAlteradas : null,
          grupo: x.profile ? x.profile.observabilidade.adaptiveGroupRatio : null
        }))
      } : { acoes:null, wonBy:null, razoes:esc.explanation.reasons,
            avaliados:esc.diagnostics.avaliados, descartados:esc.diagnostics.descartados,
            porSeguranca:esc.diagnostics.porSeguranca, porContrato:esc.diagnostics.porContrato,
            contratoViolado:[...new Set(esc.diagnostics.contratoViolado)].slice(0, 6), top:[] };
    }
    // O que sobrou no melhor ramo parcial: o retrato do que a busca não conseguiu apagar.
    const melhor = r.partial[r.partial.length - 1] || null;
    out.restante = melhor ? { tipos:[...new Set(melhor.diagnostics.tipos || [])].sort(),
                              causas:melhor.diagnostics.causas || 0,
                              acoes:melhor.actions.map(a => a.id) } : null;
    /* COBERTURA — a pergunta desta fase: a busca acha solução onde o solver acha?
       `ambos` é o caso bom; `soSolver` é a lacuna a fechar; `soBusca` é o caso que precisa ser
       ESTUDADO, não comemorado: a busca pode estar aprovando o que o solver reprova. */
    if(out.solverSolved != null)
      out.cobertura = out.solverSolved && out.solved > 0 ? 'ambos'
                    : out.solverSolved ? 'so-solver'
                    : out.solved > 0 ? 'so-busca' : 'nenhum';
  }catch(e){ out.erro = String(e && e.message || e); }
  out.ms = Math.round(((typeof performance !== 'undefined' && performance.now) ? performance.now() : 0) - t0);
  return out;
}

/* ════════════════════════════════════════════════════════════════════
   18. SCORING HIERÁRQUICO — entre soluções válidas, qual preserva a intenção
   ════════════════════════════════════════════════════════════════════
   A §17 devolve TODAS as sequências que resolveram. Esta seção responde a pergunta que faltava:
   qual delas o designer teria escolhido.

   ⛔ NÃO É UMA NOTA. Um número só, misturando segurança, semântica e beleza, permite que o
   bonito compre a violação: dois pontos de respiro pagariam um título menor que o preço. A
   decisão aqui é LEXICOGRÁFICA — camadas em ordem, e o primeiro critério que difere decide.
   Camada de baixo nunca compra violação de camada de cima.

       1. SAFETY            o produto aprova? (portão, não gosto)
       2. SEMANTICS         a função dos elementos sobreviveu?
       3. AUTHORED INTENT   a composição do designer sobreviveu?
       4. MODE              precisou do piso de emergência?
       5. AESTHETICS        o resultado está bem resolvido?
       6. ALTERATION        quanto se mexeu? (desempate)

   ⛔ E NÃO MUDA PRODUÇÃO. `gApplyRelativeAnchors` continua sem conhecer esta seção; a arte que
   o franqueado baixa sai da escada de sempre. Isto roda ao lado, em shadow, como tudo desde a
   Fase 5.5. */

/* AS CAMADAS, na ordem de autoridade. O vetor de comparação segue esta ordem, e cada posição
   é "menor é melhor" — a mesma convenção de penalidade do `gScoreComposition`. */
const G_SCORE_CAMADAS = ['safety', 'semantics', 'authored-intent', 'mode', 'aesthetics', 'alteration'];

/* ── A AUDITORIA DO `gScoreComposition`, COMO DADO ────────────────────────────────────────
   A nota que já existe mede dez coisas, e cada uma responde a uma camada diferente desta
   hierarquia. Em vez de um segundo modelo de estética (o erro clássico), a nota é calculada
   UMA vez por candidato e os itens dela são REPARTIDOS aqui. Se um peso for recalibrado lá,
   ele muda aqui junto — que é o ponto de não ter duas verdades.

   · `invalido`      → SAFETY. Já é portão em `gLayoutCandidateSafety`; aqui serve de conferência.
   · `hierarquia`    → SEMANTICS. Inversão e desvio de razão entre degraus é função, não gosto.
   · `alinhamento`   → AUTHORED INTENT. Aresta que era alinhada no desenho e deixou de ser.
   · `reducao`       → ALTERATION. O próprio motor já a agrupa sob "alteração mínima" (corpo
     perdido + entrelinha fechada): é quanto da tipografia AUTORADA sobrou.
   · `deslocamento`  → ALTERATION, pelo mesmo motivo — e porque a §8 manda estrutura valer mais
     que coordenada: quem julga composição é a camada de intenção, não pixels percorridos.
   · `linhas`, `editorial`, `respiro`, `densidade`, `equilibrio` → AESTHETICS. Descrevem o
     RESULTADO, não o caminho. */
const G_SCORE_ITENS_CAMADA = {
  invalido:     'safety',
  hierarquia:   'semantics',
  alinhamento:  'authored-intent',
  reducao:      'alteration',
  deslocamento: 'alteration',
  linhas:       'aesthetics',
  editorial:    'aesthetics',
  respiro:      'aesthetics',
  densidade:    'aesthetics',
  equilibrio:   'aesthetics'
};

/* Os PAPÉIS cuja ordem relativa é contrato de leitura. Não é gosto: é o que o `01_BUSINESS`
   chama de hierarquia da peça, e o que `gStampPisosHierarquia` já protege no motor. */
const G_SCORE_PAPEIS_ORDEM = ['titulo', 'produto', 'preco', 'cta', 'apoio', 'legal'];

/* AS RELAÇÕES DA GRAMÁTICA QUE CARREGAM INTENÇÃO AUTORAL. ⚠ São os nomes da §10 (Grammar), não
   os do §11 (Graph): `gCompareLayoutStructure` compara `grammar.relations`, e ali a âncora
   declarada é `ancora-autoral`, a corrente autorizada é `dependencia-dinamica` e a placa
   abraçando o texto é `dentro-de`. Usar os nomes do Graph aqui faria o filtro nunca casar —
   e o dano à intenção sairia sempre zero, silenciosamente. */
const G_SCORE_REL_AUTORAIS = ['ancora-autoral', 'dependencia-dinamica', 'dentro-de'];

/* O corpo que vale por PAPEL: o maior entre as camadas daquele papel. Comparar camada a camada
   faria duas linhas de apoio de tamanhos diferentes virarem "inversão"; o que a leitura enxerga
   é o degrau do bloco. */
function _gScorePorPapel(camadas, ctx, autoral){
  const m = new Map();
  (camadas || []).forEach(l => {
    if(!l || l.type !== 'text') return;
    if(typeof _gLayoutVisivel === 'function' && !_gLayoutVisivel(l)) return;
    /* ⚠ O PAPEL SAI DA API ÚNICA (§19.1). `gLayoutRoleOf` lê `layoutRole`, que só carrega
       'background'/'protected' — na arte real ele devolve 'apoio' para todo mundo, e sem par
       ordenado a checagem de inversão fica muda: o título desceria até o tamanho do preço sem
       nenhuma violação ser reportada. */
    const papel = gLayoutEffectiveRole(ctx, l);
    if(!papel) return;
    /* DUAS RÉGUAS, DUAS PERGUNTAS (§19.2): `autoral` devolve o corpo que o DESIGNER desenhou —
       a referência contra a qual a relação é medida — e o padrão devolve o corpo que vale
       AGORA. Medir as duas com a mesma régua responderia sempre 100% preservado. */
    const corpo = autoral ? ((l.fontSize || 24)) : gLayoutCorpoAtual(l);
    if(!m.has(papel) || corpo > m.get(papel)) m.set(papel, corpo);
  });
  return m;
}

/**
 * DANO SEMÂNTICO — "a solução preservou a FUNÇÃO dos elementos?"
 *
 * ⛔ Só semântica JÁ COMPILADA entra: papéis (§1), componentes (§12) e as relações do Graph
 * (§11). Nada de significado inventado aqui.
 *
 * ⚠ COMPARA RELAÇÃO, NÃO TAMANHO ABSOLUTO (§6). Encolher a peça inteira preservando a ordem
 * dos degraus é compressão — legítima, e sai em `hierarquiaComprimida`. Trocar a ordem é
 * violação. Confundir as duas faria a nota preferir arte que não coube a arte que encolheu.
 */
function gLayoutSemanticDamage(base, candidato, ctx){
  const violacoes = [];
  /* A HIERARQUIA É RELACIONAL (§19.2): a medida compara a razão entre papéis contra a razão que
     o desenho tinha, e separa INVERSÃO (violação dura, posição 1 do vetor) de COMPRESSÃO
     (diagnóstico, posição 2). A medida antiga somava fração de corpo perdido por papel — que
     mede encolhimento, não hierarquia: encolher a peça inteira em 20% preservando todas as
     razões pontuava 0,2 de "compressão de hierarquia" sem ter comprimido relação nenhuma. */
  const hier = gLayoutHierarchyRelation(base, candidato, ctx);
  hier.pares.filter(p => p.classe === 'inversao').forEach(p => violacoes.push({
    tipo: p.escopo === 'componente' ? 'inversao-no-componente' : 'inversao-de-papel',
    de:p.de, para:p.para,
    base:p.corpoAutoralDe + '>' + p.corpoAutoralPara,
    atual:p.corpoDe + '≤' + p.corpoPara }));

  /* ── COMPONENTE QUEBRADO ── o bloco semântico deixou de existir ou perdeu membro.
     `gCompareLayoutComponents` é a régua da §12; não se reimplementa comparação aqui. */
  const comps = (ctx && ctx._diffComponentes) || null;
  if(comps){
    /* ⚠ FUSÃO NÃO É PERDA (auditoria da Fase 6.5, §10). Dois blocos que se aproximam viram um
       bloco só, e o diff reporta o menor como `removed` — mas nenhum membro ficou órfão: eles
       estão todos dentro do bloco maior. Cobrar isso como "componente desfeito" reprovava, como
       violação DURA, uma solução que não perdeu função nenhuma. A pergunta certa é se algum
       membro ficou SEM bloco. */
    const cobertos = new Set();
    ((ctx && ctx._compsCandidato) || []).forEach(c =>
      (c.membros || []).forEach(id => cobertos.add(id)));
    comps.removed.forEach(c => {
      const orfaos = (c.membros || []).filter(id => !cobertos.has(id));
      if(!orfaos.length) return;                    // absorvido por outro bloco: fusão
      violacoes.push({ tipo:'componente-desfeito', componente:c.tipo, membros:orfaos });
    });
    /* ⚠ SÓ CONTA COMO QUEBRA QUANDO A MEMBRESIA DIMINUI. `componentSignature` inclui as raízes
       dinâmicas, então um bloco com exatamente os mesmos membros aparece como "alterado" só
       porque o grafo mudou em volta dele — e isso não é o bloco se desfazendo. GANHAR membro
       também não é: o bloco não perdeu ninguém. Assinatura diferente sem membro perdido é
       assunto da camada de INTENÇÃO, não de função. */
    comps.changed.forEach(c => {
      const perdidos = (c.de || []).filter(id => (c.para || []).indexOf(id) < 0);
      if(!perdidos.length) return;
      violacoes.push({ tipo:'componente-perdeu-membro', componente:c.tipo,
        de:c.de, para:c.para, perdidos:perdidos });
    });
  }
  /* ── PLACA SOLTA ── a forma deixou de acompanhar o texto dela. A relação `plate-of` é do
     Graph; se ela some, a placa virou retângulo solto. */
  const estrut = (ctx && ctx._diffEstrutura) || null;
  if(estrut){
    /* A placa abraçando o texto é `dentro-de` na Gramática. Se essa contenção some, a forma
       virou retângulo solto atrás de um texto que saiu de dentro dela.
       ⚠ SÓ QUANDO A FORMA É PLACA. `dentro-de` também descreve texto sobre FOTO, e um CTA que
       deixa de sobrepor a imagem é recomposição, não perda de função — quem responde por placa
       é `ctx._placa`, a mesma régua que o solver usa para fazer a forma acompanhar o texto. */
    estrut.relationsRemoved.filter(r => r.tipo === 'dentro-de'
      && ctx && ctx._placa && ctx._placa.has(r.para)).forEach(r =>
      violacoes.push({ tipo:'texto-saiu-da-placa', texto:r.de, placa:r.para }));
  }
  violacoes.sort((a, b) => (a.tipo + (a.de || '') + (a.componente || ''))
                         < (b.tipo + (b.de || '') + (b.componente || '')) ? -1 : 1);
  return { violacoes, hierarquiaPreservada: !violacoes.some(v => v.tipo === 'inversao-de-papel'
                                                            || v.tipo === 'inversao-no-componente'),
           hierarquiaComprimida: hier.compressao, hierarquia: hier, degraus: hier.degraus };
}

/**
 * DANO À INTENÇÃO AUTORAL — "quanto da COMPOSIÇÃO original sobreviveu?"
 *
 * ⛔ NÃO penaliza mudança por ser mudança. A pergunta da §7 é outra: mudou sem necessidade, ou
 * mudou para preservar a intenção? Por isso o que se conta é RELAÇÃO PERDIDA (o designer tinha
 * um alinhamento, uma âncora, uma corrente — e a solução a desfez), nunca pixel percorrido.
 * Relação ADICIONADA não é dano: encostar dois blocos que já eram vizinhos não rompe nada.
 */
function gLayoutAuthoredDamage(base, candidato, ctx){
  const estrut = (ctx && ctx._diffEstrutura) || { relationsRemoved:[], relationsAdded:[],
                                                  clustersChanged:[], sameStructure:true, visualChanged:false };
  const comps = (ctx && ctx._diffComponentes) || { added:[], removed:[], changed:[], hierarchyChanged:false };
  /* As relações que CARREGAM intenção autoral: âncora declarada, placa e corrente autorizada.
     Alinhamento e vizinhança entram com peso menor, em `alinhamentosPerdidos`. */
  const perdidasAutorais = estrut.relationsRemoved.filter(r =>
    G_SCORE_REL_AUTORAIS.indexOf(r.tipo) >= 0);
  const perdidasAlinhamento = estrut.relationsRemoved.filter(r =>
    G_SCORE_REL_AUTORAIS.indexOf(r.tipo) < 0);
  return {
    relacoesAutoraisPerdidas: perdidasAutorais.map(r => r.tipo + ':' + (r.de || '') + '→' + (r.para || '')),
    alinhamentosPerdidos: perdidasAlinhamento.length,
    relacoesAdicionadas: estrut.relationsAdded.length,
    clustersMudados: estrut.clustersChanged.length,
    componentesPerdidos: comps.removed.length,
    componentesAlterados: comps.changed.length,
    hierarquiaDeComponentesMudou: !!comps.hierarchyChanged,
    estruturaIgual: !!estrut.sameStructure,
    assinaturaVisualMudou: !!estrut.visualChanged
  };
}

/**
 * CUSTO DE ALTERAÇÃO — explicável, item a item. É o ÚLTIMO critério: desempate entre soluções
 * equivalentes, nunca argumento contra a melhor composição (§12).
 */
function gLayoutChangeCost(cand, camadasBase, camadasFinais){
  const idxB = new Map((camadasBase || []).map(l => [l.id, l]));
  let movidos = 0, distancia = 0, reducaoFonte = 0, reducaoEntrelinha = 0, tracking = 0;
  /* DOIS TRACKINGS, E ELES NÃO CUSTAM A MESMA COISA (§9 da Fase 6.6):
     · AUTORAL — o designer escreveu `letterSpacing` no PSD. Mexer nisso é desfazer decisão de
       quem desenhou, e por isso conta na INTENÇÃO AUTORAL.
     · DO MOTOR — o render soma 2% do corpo em fonte display (≥900), e o degrau 3.7 da escada
       devolve o que ele mesmo somou (`_trackApertado`). Devolver tracking que o motor pôs não
       desfaz intenção nenhuma: é custo de ALTERAÇÃO.
     A régua de "quem escreveu" já existe e não se reinventa aqui: `letterSpacing` presente na
     BASE sem o carimbo `_trackApertado` é do designer. */
  let trackingAutoral = 0, trackingDoMotor = 0;
  const mexidos = new Set();
  (camadasFinais || []).forEach(l => {
    const b = idxB.get(l.id);
    if(!b) return;
    const dx = Math.abs((l.x || 0) - (b.x || 0)), dy = Math.abs((l.y || 0) - (b.y || 0));
    if(dx + dy > 0.5){ movidos++; distancia += dx + dy; mexidos.add(l.id); }
    if(l.type !== 'text') return;
    const fa = gLayoutCorpoAtual(b), fb = gLayoutCorpoAtual(l);
    if(fb < fa - 0.5){ reducaoFonte += (fa - fb) / Math.max(1, fa); mexidos.add(l.id); }
    const lhA = (typeof gLineHeightDe === 'function') ? gLineHeightDe(b) : (b.lineHeight || 1.2);
    const lhB = (typeof gLineHeightDe === 'function') ? gLineHeightDe(l) : (l.lineHeight || 1.2);
    if(lhB < lhA - 0.001){ reducaoEntrelinha += (lhA - lhB) / Math.max(0.01, lhA); mexidos.add(l.id); }
    if((l.letterSpacing == null ? null : l.letterSpacing) !== (b.letterSpacing == null ? null : b.letterSpacing)){
      tracking++; mexidos.add(l.id);
      if(b.letterSpacing != null && !b._trackApertado) trackingAutoral++;
      else trackingDoMotor++;
    }
  });
  const acoes = (cand && cand.actions) || [];
  const conta = (id) => acoes.filter(a => a.id === id).length;
  return {
    camadasAlteradas: mexidos.size,
    camadasMovidas: movidos,
    distanciaMovida: Math.round(distancia),
    reducaoFonte: Math.round(reducaoFonte * 1000) / 1000,
    reducaoEntrelinha: Math.round(reducaoEntrelinha * 1000) / 1000,
    mudancasDeTracking: tracking,
    trackingAutoral: trackingAutoral,
    trackingDoMotor: trackingDoMotor,
    placasRedimensionadas: conta('resize-container'),
    componentesEscalados: conta('scale-component'),
    acoes: acoes.length,
    profundidade: (cand && cand.depth) || 0,
    acoesDeEmergencia: acoes.filter(a => a.params && a.params.modo === 'emergency').length
  };
}

/* Soma os itens do `gScoreComposition` que pertencem a UMA camada. É aqui que a auditoria da
   §11 vira número — e o único lugar onde ela vira. */
function _gScoreDaCamada(itens, camada){
  let s = 0;
  Object.keys(itens || {}).forEach(k => {
    if(G_SCORE_ITENS_CAMADA[k] === camada) s += (itens[k] || 0);
  });
  return Math.round(s * 100) / 100;
}

/* Os diffs estruturais do candidato contra o ORIGINAL ASSENTADO, memorizados pela assinatura
   assentada. Compilar Grammar + Graph + Components por candidato é o custo real desta fase;
   dois candidatos que chegaram ao mesmo estado compartilham a resposta (§27). */
function _gScoreDiffs(ctx, base, camadas, chave){
  const cache = ctx._diffScore || (ctx._diffScore = new Map());
  if(chave && cache.has(chave)) return cache.get(chave);
  const cv = ctx.canvas || { w:1080, h:1080 };
  const gA = ctx._gramBase || (ctx._gramBase = gCompileLayoutGrammar(base, cv));
  const cA = ctx._compBase || (ctx._compBase = gCompileLayoutComponents(gA, gCompileCompositionGraph(gA)));
  const gB = gCompileLayoutGrammar(camadas, cv);
  const cB = gCompileLayoutComponents(gB, gCompileCompositionGraph(gB));
  const r = { estrutura: gCompareLayoutStructure(gA, gB), componentes: gCompareLayoutComponents(cA, cB),
              /* Os componentes do CANDIDATO viajam junto: é com eles que a §10 distingue
                 "o bloco se desfez" de "o bloco foi absorvido por outro". */
              compsCandidato: cB };
  if(cache.size > 200) cache.clear();
  if(chave) cache.set(chave, r);
  return r;
}

/**
 * O PERFIL DE UM CANDIDATO — serializável, determinístico, sem função dentro.
 *
 * @param {object} cand   candidato `solved` da §17
 * @param {object} ctx    de `gBuildOperationalContext`
 * @param {object} opts   {base: camadas do ORIGINAL ASSENTADO, legacySolverOutcome?}
 * @returns {object} o perfil, com `vector` na ordem de `G_SCORE_CAMADAS`
 */
function gLayoutScoreProfile(cand, ctx, opts){
  const o = opts || {};
  const assentado = gSettleCandidateState(cand, ctx);
  return gLayoutScoreProfileState(assentado.layers, ctx,
    Object.assign({}, o, { cand:cand, safety:gLayoutCandidateSafety(cand, ctx) }));
}

/**
 * O MESMO PERFIL, sobre um ESTADO explícito. É o que o corpus de scoring (Fase 6.5) usa para
 * montar par controlado: a mutação é a variável do experimento, e passar pelo assentamento a
 * apagaria (`gSettleLayoutState` restaura `_geoAutor` e roda o motor de novo).
 *
 * @param {Array}  camadas  as camadas JÁ no estado final (com `_fit`, `_tetoFonte`, …)
 * @param {object} ctx      de `gBuildOperationalContext`
 * @param {object} opts     {base, cand?, safety?, id?, legacySolverOutcome?}
 */
function gLayoutScoreProfileState(camadas, ctx, opts){
  const o = opts || {};
  const cand = o.cand || { id:o.id || 'estado', signature:o.signature || (o.id || 'estado'),
                           depth:0, searchMode:'normal', actions:[], scaleGroupIds:[] };
  const base = o.base || camadas;
  const seg = o.safety || gLayoutStateSafety(camadas, ctx);
  /* O CONTRATO DO CANDIDATO (§20.2) — a outra camada de segurança, com nome próprio. */
  const contrato = gLayoutCandidateContract(camadas, ctx,
    { base:o.base || camadas, actions:cand.actions, searchMode:cand.searchMode });
  const nota = (typeof gScoreComposition === 'function')
    ? gScoreComposition(camadas, { canvas:ctx.canvas }) : { itens:{} };
  const diffs = _gScoreDiffs(ctx, base, camadas, cand.settledSignature || cand.signature);
  const ctxDiff = { _diffEstrutura:diffs.estrutura, _diffComponentes:diffs.componentes,
                    _compsCandidato:diffs.compsCandidato, components:ctx.components,
                    _no:ctx._no, _placa:ctx._placa };
  const sem = gLayoutSemanticDamage(base, camadas, ctxDiff);
  const aut = gLayoutAuthoredDamage(base, camadas, ctxDiff);
  const custo = gLayoutChangeCost(cand, base, camadas);

  /* ── AS MARGENS DE SEGURANÇA ── guardadas para diagnóstico FUTURO, como manda a §4. Nesta
     fase elas não decidem nada: usar folga de segurança para desempatar seria deixar a
     estética entrar pela porta do portão. */
  const cv = ctx.canvas || { w:1080, h:1080 };
  let margemBorda = Infinity, margemLegibilidade = Infinity;
  camadas.forEach(l => {
    if(!l || (typeof _gLayoutVisivel === 'function' && !_gLayoutVisivel(l))) return;
    const r = (typeof gInkRect === 'function') ? gInkRect(l, l._fit) : l;
    margemBorda = Math.min(margemBorda, r.x, r.y, (cv.w || 0) - (r.x + r.w), (cv.h || 0) - (r.y + r.h));
    if(l.type === 'text' && typeof gLayoutPisoFonte === 'function')
      margemLegibilidade = Math.min(margemLegibilidade, gLayoutCorpoAtual(l) - gLayoutPisoFonte(l, true));
  });

  const emergencia = cand.searchMode === 'emergency' ? 1 : 0;
  const perfil = {
    id: cand.id, signature: cand.signature, settledSignature: cand.settledSignature || null,
    depth: cand.depth, searchMode: cand.searchMode,
    actions: (cand.actions || []).map(a => a.id),
    /* ⚠ DUAS CAMADAS, DOIS NOMES. `safety` é o PRODUTO (`gLayoutCamadaReprovada`);
       `contract` é o que o GERADOR promete. Um candidato só compete se os dois passarem. */
    contract: { ok:contrato.ok, violacoes:contrato.violacoes },
    safety: { seguro:seg.seguro, reprovadas:seg.reprovadas, problemas:seg.problemas,
              margemBorda: isFinite(margemBorda) ? Math.round(margemBorda) : null,
              margemLegibilidade: isFinite(margemLegibilidade) ? Math.round(margemLegibilidade) : null,
              invalidoNaNota: _gScoreDaCamada(nota.itens, 'safety') },
    semantics: { violacoes:sem.violacoes, hierarquiaPreservada:sem.hierarquiaPreservada,
                 hierarquiaComprimida:sem.hierarquiaComprimida, degraus:sem.degraus,
                 hierarquia:sem.hierarquia,
                 penalDaNota:_gScoreDaCamada(nota.itens, 'semantics') },
    authoredIntent: Object.assign({ penalDaNota:_gScoreDaCamada(nota.itens, 'authored-intent'),
                                   trackingAutoralPerdido:custo.trackingAutoral || 0 }, aut),
    mode: { emergency: !!emergencia, acoesDeEmergencia:custo.acoesDeEmergencia,
            profundidade:cand.depth },
    aesthetics: { score:_gScoreDaCamada(nota.itens, 'aesthetics'), itens:nota.itens,
                  notaTotal:nota.total },
    alteration: Object.assign({ score:_gScoreDaCamada(nota.itens, 'alteration') }, custo),
    observabilidade: {
      adaptiveGroupSize: (cand.scaleGroupIds || []).length,
      adaptiveGroupRatio: camadas.length
        ? Math.round(((cand.scaleGroupIds || []).length / camadas.length) * 1000) / 1000 : 0,
      legacySolverOutcome: o.legacySolverOutcome != null ? o.legacySolverOutcome : null
    }
  };
  /* ── O VETOR ── a ordem de `G_SCORE_CAMADAS`, "menor é melhor" em toda posição. A comparação
     final lê daqui, posição a posição; nenhum somatório entre camadas existe em lugar nenhum. */
  perfil.vector = [
    seg.seguro ? 0 : 1,                                             // safety
    sem.violacoes.length,                                           // semantics — violação DURA
    sem.hierarquiaComprimida,                                       // semantics — compressão
    aut.relacoesAutoraisPerdidas.length + aut.componentesPerdidos,  // intenção — relação perdida
    /* + TRACKING AUTORAL PERDIDO (§8/§9 da Fase 6.6): `letterSpacing` que o designer escreveu
       e a solução desfez é composição autoral alterada, como um alinhamento que se soltou. */
    aut.alinhamentosPerdidos + aut.componentesAlterados + (aut.assinaturaVisualMudou ? 1 : 0)
      + (custo.trackingAutoral || 0),
    emergencia,                                                     // mode
    perfil.aesthetics.score,                                        // aesthetics
    perfil.alteration.score                                         // alteration
  ];
  /* O nome da camada de cada posição — é o que torna a decisão EXPLICÁVEL sem adivinhação. */
  perfil.vectorCamadas = ['safety', 'semantics', 'semantics', 'authored-intent',
                          'authored-intent', 'mode', 'aesthetics', 'alteration'];
  /* AS ZONAS MORTAS VIAJAM NO PERFIL porque o comparador é chamado com dois perfis e nada mais.
     Elas saem da BASE, então são idênticas para todos os candidatos da mesma decisão — o que
     é exatamente o que impede a zona morta de depender de candidato ou de ordem. */
  perfil.deadZone = gLayoutDeadZones(base, ctx);
  return perfil;
}

/* O rótulo humano de cada posição do vetor — para a explicação da decisão. */
const G_SCORE_VETOR_MOTIVO = [
  'segurança', 'violação semântica', 'compressão de hierarquia',
  'relação autoral perdida', 'composição autoral alterada',
  'modo de emergência', 'qualidade da composição', 'custo de alteração'];

/**
 * COMPARAÇÃO HIERÁRQUICA. Lexicográfica pelo vetor: o PRIMEIRO critério que difere decide, e
 * nenhuma posição posterior tem como reverter isso.
 *
 * ⛔ Não existe `totalA > totalB`. Somar as camadas devolveria exatamente o que esta fase
 * recusa: estética comprando violação semântica.
 *
 * @returns {number} <0 se `a` vence, >0 se `b` vence, 0 se equivalentes em todos os critérios
 */
function gCompareLayoutCandidates(a, b, opts){
  const va = (a && a.vector) || [], vb = (b && b.vector) || [];
  const n = Math.max(va.length, vb.length);
  /* ── ZONA MORTA PERCEPTUAL (§20, Fase 6.6) ── só nas posições contínuas, e só onde a
     resolução da métrica foi MEDIDA. Diferença abaixo dela é empate: a decisão desce de
     camada em vez de ser tirada no ruído. `opts.semDeadZone` existe para a auditoria comparar
     o antes e o depois com UM comparador só. */
  const zonas = (opts && opts.zonas) || ((opts && opts.semDeadZone) ? null : _gZonasDaComparacao(a, b));
  for(let i = 0; i < n; i++){
    const x = va[i] || 0, y = vb[i] || 0;
    const nome = G_SCORE_VETOR_ZONA[i];
    const z = (zonas && nome && zonas[nome]) || 0;
    if(Math.abs(x - y) > Math.max(1e-9, z)) return x < y ? -1 : 1;
  }
  /* ── DESEMPATE DETERMINÍSTICO (§18) ── menos alteração, menos ações, menor profundidade,
     assinatura. A ordem em que os candidatos entraram no array NUNCA decide. */
  const ca = (a && a.alteration) || {}, cb = (b && b.alteration) || {};
  if((ca.camadasAlteradas || 0) !== (cb.camadasAlteradas || 0))
    return (ca.camadasAlteradas || 0) - (cb.camadasAlteradas || 0);
  /* TRACKING DO MOTOR (§8 da Fase 6.6). Dois candidatos que só diferem no tracking que a
     ESCADA mexeu empatavam no vetor inteiro e caíam no desempate por ASSINATURA — decisão
     tirada no hash. Aqui ele é o que é: custo de alteração, sem peso inventado e sem entrar
     na nota legada. O tracking AUTORAL não passa por aqui: ele é intenção do designer e já
     conta na posição 4 do vetor, e contá-lo duas vezes seria cobrar o mesmo dano em duas
     camadas. */
  if((ca.trackingDoMotor || 0) !== (cb.trackingDoMotor || 0))
    return (ca.trackingDoMotor || 0) - (cb.trackingDoMotor || 0);
  if((ca.acoes || 0) !== (cb.acoes || 0)) return (ca.acoes || 0) - (cb.acoes || 0);
  if((a.depth || 0) !== (b.depth || 0)) return (a.depth || 0) - (b.depth || 0);
  return (a.signature || '') < (b.signature || '') ? -1 : (a.signature || '') > (b.signature || '') ? 1 : 0;
}

/* Em que posição do vetor `a` passou na frente de `b` — o "por que venceu". Sai do TRAÇO
   (§19.4), não de uma segunda varredura do vetor: a explicação tem que corresponder ao
   comparador, e duas implementações do mesmo laço é exatamente como elas se soltam. */
function _gScorePorQue(a, b, opts){
  const tr = gLayoutDecisionTrace(a, b, opts);
  const t = tr.parouEm >= 0 ? tr.tiers[tr.tiers.length - 1] : null;
  return t ? { posicao:t.posicao, camada:t.camada, criterio:t.criterio,
               vencedor:t.vencedor, perdedor:t.perdedor, trace:tr }
           : { posicao:-1, camada:'empate', criterio:'desempate determinístico',
               vencedor:null, perdedor:null, trace:tr };
}

/**
 * A ESCOLHA. Recebe o resultado da §17 e devolve o vencedor com a explicação.
 *
 * ⛔ SÓ `solved` SEGURO COMPETE (§3). `partial` não disputa com `solved`; `unsafe` nunca entra.
 * Sem nenhum candidato seguro, devolve `winner: null` — não existe "o menos quebrado".
 *
 * ⚠ ORIGINAL FIRST É ABSOLUTO (§19). Arte que já está de pé com o conteúdo real vence sem que
 * nenhum perfil seja calculado: é o contrato que este motor honra desde sempre, e gastar três
 * compilações de Grammar para reeleger a composição publicada seria pagar para não mudar nada.
 *
 * @returns {{winner, ranked, explanation, diagnostics}}
 */
function gSelectLayoutCandidate(resultado, ctx, opts){
  const o = opts || {};
  const r = resultado || {};
  const diag = { avaliados:0, descartados:0, porSeguranca:0, porContrato:0,
                 contratoViolado:[], ms:0, originalFirst:false };
  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
  const solved = (r.solved || []).filter(c => c && c.status === 'solved');
  if(!solved.length){
    diag.ms = 0;
    return { winner:null, ranked:[], diagnostics:diag,
             explanation:{ wonBy:null, reasons:['nenhum candidato resolvido: não existe vencedor'] } };
  }
  // ── ORIGINAL FIRST ── a arte publicada, de pé, sem nenhum movimento.
  const original = solved.find(c => c.depth === 0 && (!c.actions || !c.actions.length));
  if(original){
    diag.originalFirst = true; diag.avaliados = 0;
    diag.ms = Math.round((((typeof performance !== 'undefined' && performance.now) ? performance.now() : 0) - t0) * 100) / 100;
    return { winner:original, ranked:[{ candidate:original, profile:null }], diagnostics:diag,
             explanation:{ wonBy:'original-first',
               reasons:['a composição publicada resolve o conteúdo real sem adaptação nenhuma'] } };
  }

  const base = o.base || (r.original ? gSettleCandidateState(r.original, ctx).layers : null);
  const perfis = [];
  solved.forEach(c => {
    const p = gLayoutScoreProfile(c, ctx, { base:base, legacySolverOutcome:o.legacySolverOutcome });
    /* ⛔ O PORTÃO OUTRA VEZ, e de propósito. Um candidato que chegou aqui já passou pela §17,
       mas o perfil recalcula a segurança sobre o estado assentado — se divergir, ele sai da
       disputa em vez de ser ranqueado. Rede dupla no lugar onde o erro é mais caro. */
    if(!p.safety.seguro){ diag.descartados++; diag.porSeguranca++; return; }
    /* ⛔ O SEGUNDO PORTÃO (§20.2, Fase 6.6): CANDIDATE CONTRACT. `gLayoutCamadaReprovada`
       responde por arte publicada e não reprova corpo abaixo do piso nem camada travada que se
       mexeu — hoje quem impede isso é o gerador. Defesa em profundidade é conferir o que se
       assume, e o nome fica separado de propósito: isto não é o veredito do produto. */
    if(!p.contract.ok){
      diag.descartados++; diag.porContrato++;
      p.contract.violacoes.forEach(v => diag.contratoViolado.push(v.tipo + ':' + v.id));
      return;
    }
    perfis.push({ candidate:c, profile:p });
  });
  diag.avaliados = perfis.length;
  if(!perfis.length){
    diag.ms = Math.round((((typeof performance !== 'undefined' && performance.now) ? performance.now() : 0) - t0) * 100) / 100;
    return { winner:null, ranked:[], diagnostics:diag,
             explanation:{ wonBy:null, reasons:['todos os candidatos resolvidos foram reprovados pelo produto'] } };
  }
  /* `semDeadZone` existe para UMA coisa: a auditoria da Fase 6.6 comparar o antes e o depois
     com o MESMO comparador, em vez de guardar uma cópia do comparador antigo. Fora dela,
     ninguém passa esta opção. */
  const _cmpOpts = o.semDeadZone ? { semDeadZone:true } : undefined;
  perfis.sort((x, y) => gCompareLayoutCandidates(x.profile, y.profile, _cmpOpts));
  const vencedor = perfis[0], segundo = perfis[1] || null;
  const porque = segundo ? _gScorePorQue(vencedor.profile, segundo.profile, _cmpOpts) : null;
  const razoes = [];
  if(segundo){
    if(porque.posicao < 0) razoes.push('empate em todos os critérios: decidido pelo desempate determinístico');
    else razoes.push('venceu o segundo colocado em ' + porque.criterio
      + ' (' + porque.vencedor + ' contra ' + porque.perdedor + ')');
  }else razoes.push('único candidato seguro');
  const p = vencedor.profile;
  if(!p.semantics.violacoes.length) razoes.push('nenhuma violação semântica');
  else razoes.push(p.semantics.violacoes.length + ' violação(ões) semântica(s) — a menor entre os candidatos');
  if(!p.mode.emergency) razoes.push('resolveu sem o piso de emergência');
  if(p.authoredIntent.estruturaIgual) razoes.push('a estrutura autoral ficou intacta');

  diag.ms = Math.round((((typeof performance !== 'undefined' && performance.now) ? performance.now() : 0) - t0) * 100) / 100;
  return {
    winner: vencedor.candidate,
    ranked: perfis,
    diagnostics: diag,
    explanation: { wonBy: porque ? porque.camada : 'unico',
                   criterio: porque ? porque.criterio : null,
                   posicao: porque ? porque.posicao : null, reasons: razoes,
                   /* O TRAÇO INTEIRO e a MARGEM (§16/§17). A explicação não fabrica camada
                      nenhuma: ela lista os empates até o critério que decidiu e para ali. */
                   trace: porque ? porque.trace : null,
                   margem: porque ? porque.trace.margem : null }
  };
}

/* ════════════════════════════════════════════════════════════════════
   19. CALIBRAÇÃO DO JULGAMENTO (Fase 6.5) — observacional
   ════════════════════════════════════════════════════════════════════
   A §18 escolhe. Esta seção responde se ela escolhe por PRINCÍPIO ou por sorte de fixture, e
   mede o custo de um defeito conhecido: o scorer legado lê `layoutRole` (marcação manual, quase
   sempre nula) enquanto a arquitetura nova lê o papel COMPILADO.

   ⛔ NADA AQUI DECIDE. `gApplyRelativeAnchors` e `gLayoutEscolherAlternativa` continuam sem
   conhecer esta seção: ela existe para MEDIR antes de migrar, que é o oposto de migrar e ver
   no que dá. A migração é decisão de outra fase, com estes números na mesa. */

/* ── 19.1 PAPEL EFETIVO — a fonte única ───────────────────────────────────────────────────
   Hoje existem três leituras do mesmo fato, e elas discordam:
     · `gLayoutRoleOf(l)`      → `layoutRoleManual || layoutRole || 'apoio'`. `layoutRole` só
       carrega 'background'/'protected' (o contrato antigo do runtime), então na prática ele
       devolve 'apoio' para TODA camada de arte real — inclusive título, preço e CTA.
     · `ctx._no.get(id).papel` → o papel compilado, que a Gramática já resolveu.
     · `l.layoutSemantic`      → o mesmo papel compilado, carimbado no clone pelo solver.
   Os três estão no mesmo objeto. O defeito não é falta de informação: é o leitor errado.

   A prioridade, na ordem que a §7 pede:
     1. papel explícito e confiável do designer (`layoutRoleManual`);
     2. papel semântico compilado (nó da Gramática → carimbo no clone);
     3. a tradução do contrato antigo ('protected'/'background'), para camada fora da Gramática;
     4. fallback 'apoio' — o papel neutro, nunca um palpite.

   ⚠ `layoutRole` não é lido como vocabulário rico em lugar nenhum daqui pra frente. */
const G_ROLE_LEGADO = { protected:'protegida', background:'fundo' };

function _gLayoutRoleResolve(ctx, l){
  if(!l) return { papel:'apoio', fonte:'sem-camada' };
  if(l.layoutRoleManual && G_LAYOUT_ROLES.indexOf(l.layoutRoleManual) >= 0)
    return { papel:l.layoutRoleManual, fonte:'manual' };
  const n = ctx && ctx._no && ctx._no.get(l.id);
  if(n && n.papel) return { papel:n.papel, fonte:'gramatica' };
  if(l.layoutSemantic) return { papel:l.layoutSemantic, fonte:'carimbo' };
  const trad = G_ROLE_LEGADO[l.layoutRole];
  if(trad) return { papel:trad, fonte:'contrato-antigo' };
  return { papel:'apoio', fonte:'fallback' };
}

/** O PAPEL DE UMA CAMADA — a única API. `ctx` pode ser nulo (o carimbo do clone responde). */
function gLayoutEffectiveRole(ctx, l){ return _gLayoutRoleResolve(ctx, l).papel; }

/** A PROCEDÊNCIA do papel + a divergência contra o leitor legado. Só a auditoria usa. */
function gLayoutRoleTrace(ctx, l){
  const r = _gLayoutRoleResolve(ctx, l);
  const legado = (typeof gLayoutRoleOf === 'function') ? gLayoutRoleOf(l) : 'apoio';
  const pesoL = G_SCORE_PESO_PAPEL[legado] != null ? G_SCORE_PESO_PAPEL[legado] : 1;
  const pesoE = G_SCORE_PESO_PAPEL[r.papel] != null ? G_SCORE_PESO_PAPEL[r.papel] : 1;
  return { id:l && l.id, papel:r.papel, fonte:r.fonte, legado:legado,
           diverge: legado !== r.papel, pesoLegado:pesoL, pesoEfetivo:pesoE,
           pesoDiverge: Math.abs(pesoL - pesoE) > 1e-9 };
}

/* ── 19.2 HIERARQUIA RELATIVA — a medida formal de compressão ─────────────────────────────
   A posição 2 do vetor decidiu 6 dos 8 casos contestados do corpus da Fase 6, e a medida que
   ela carregava era ERRADA para a pergunta: somava a fração de corpo que cada papel perdeu.
   Isso mede ENCOLHIMENTO, não hierarquia — uma peça inteira reduzida em 20% pontuava 0,2 de
   "compressão de hierarquia" sem ter comprimido hierarquia nenhuma (todas as razões intactas).

   A pergunta certa é a da §6: QUANTO DA RELAÇÃO VISUAL QUE O DESIGNER CRIOU SOBREVIVEU? Ela
   não tem resposta universal — não existe razão título/apoio ideal —, então a referência é
   sempre a composição AUTORADA, par a par.

   Para cada par de papéis que o desenho ORDENOU (a maior que b):
     razaoAutoral  rA = corpoAutorado(a) / corpoAutorado(b)
     razaoAtual    rB = corpoAtual(a)    / corpoAtual(b)
     preservação   = log(rB) / log(rA), limitado a [0,1]

   O log é o que torna a medida uma RELAÇÃO e não uma diferença: corpo é percebido de forma
   multiplicativa, e `log` é a única forma de "72/36 virou 56/32" (rA 2,0 → rB 1,75, 81%
   preservado) e "46/44 virou 45/44" caírem na mesma régua. Diferença absoluta de fontSize
   diria que o primeiro perdeu 16px e o segundo 1px — e erraria os dois.

   AS QUATRO CLASSES QUE A §4 pede, sem misturar inversão com compressão:
     A `preservado`              preservação ≥ 85%: a leitura do designer está de pé.
     B `comprimido`              0 < preservação < 85%: a ordem sobreviveu, o contraste encolheu.
     C `empate-visual`           rB ≤ 1,05: formalmente a > b, visualmente o mesmo degrau.
     D `inversao`                a ficou ≤ b: VIOLAÇÃO DURA, vai para a posição 1 do vetor.

   E uma quinta, que é um falso positivo que precisava morrer:
       `sem-contraste-autoral`   rA ≤ 1,05 — o DESENHO já era um empate visual. Não há relação a
       preservar, então o par sai da média (mas continua valendo para inversão). Sem esta saída,
       um par autorado em 46/44 cobraria do candidato um contraste que o designer nunca criou —
       e, pior, dividir por um log(rA) quase zero amplificaria ruído de 1px em nota cheia.

   ⚠ TODOS OS LIMIARES SÃO AVALIADOS NA COMPOSIÇÃO AUTORADA, que é a MESMA para todos os
   candidatos de uma decisão. É isso que impede um limiar de virar cliff de decisão: o conjunto
   de pares medidos não muda de candidato para candidato. */
const G_SCORE_HIER_EMPATE     = 1.05;   // abaixo disto dois corpos leem como o mesmo degrau
const G_SCORE_HIER_PRESERVADO = 0.85;   // acima disto a compressão não é perceptualmente relevante

function gLayoutHierarchyRelation(base, candidato, ctx){
  const pA = _gScorePorPapel(base, ctx, true);      // a relação AUTORADA (o corpo desenhado)
  const pB = _gScorePorPapel(candidato, ctx, false); // a relação que sobreviveu
  const pares = [];
  /* A MEDIDA DE UM PAR, uma só, usada pelos dois escopos: entre PAPÉIS e DENTRO de um
     componente. Duas implementações da mesma régua divergiriam no primeiro ajuste. */
  function medirPar(de, para, aA, bA, aB, bB, escopo){
    if(aA == null || bA == null || aB == null || bB == null) return;
    if(!(aA > bA + 0.5)) return;                    // o desenho não declarou esta ordem
    const rA = aA / Math.max(1, bA), rB = aB / Math.max(1, bB);
    let classe, preservacao;
    if(rA <= G_SCORE_HIER_EMPATE){ classe = 'sem-contraste-autoral'; preservacao = null; }
    else if(aB <= bB + 0.5){ classe = 'inversao'; preservacao = 0; }
    else if(rB <= G_SCORE_HIER_EMPATE){ classe = 'empate-visual'; preservacao = 0; }
    else {
      preservacao = Math.min(1, Math.log(rB) / Math.log(rA));
      classe = preservacao >= G_SCORE_HIER_PRESERVADO ? 'preservado' : 'comprimido';
    }
    pares.push({ de:de, para:para, escopo:escopo, classe:classe,
                 corpoAutoralDe:Math.round(aA), corpoAutoralPara:Math.round(bA),
                 corpoDe:Math.round(aB), corpoPara:Math.round(bB),
                 razaoAutoral:Math.round(rA * 1000) / 1000, razaoAtual:Math.round(rB * 1000) / 1000,
                 preservacao: preservacao == null ? null : Math.round(preservacao * 1000) / 1000 });
  }

  // ── ESCOPO 1: ENTRE PAPÉIS ── o degrau do BLOCO, que é o que a leitura enxerga.
  for(let i = 0; i < G_SCORE_PAPEIS_ORDEM.length; i++)
    for(let j = i + 1; j < G_SCORE_PAPEIS_ORDEM.length; j++){
      const a = G_SCORE_PAPEIS_ORDEM[i], b = G_SCORE_PAPEIS_ORDEM[j];
      medirPar(a, b, pA.get(a), pA.get(b), pB.get(a), pB.get(b), 'papel');
    }

  /* ── ESCOPO 2: DENTRO DO COMPONENTE ──────────────────────────────────────────────────────
     O par "De: R$ 79,90" / "Por: R$ 49,90" é a hierarquia mais carregada da peça e some no
     escopo de papel: os dois são 'preco', e o papel guarda o MAIOR corpo. Medido só por papel,
     encolher o "por" até o tamanho do "de" não move um número — e a §10 chama isso, com todas
     as letras, de violação dura ("price hierarchy quebrada").
     ⚠ Só DENTRO de componente compilado (§12). Comparar duas camadas quaisquer do mesmo papel
     faria duas linhas de apoio de corpos diferentes virarem hierarquia — e não são. */
  const corpoA = new Map(), corpoB = new Map(), nome = new Map();
  const visivel = (l) => !(typeof _gLayoutVisivel === 'function') || _gLayoutVisivel(l);
  (base || []).forEach(l => { if(l && l.type === 'text' && visivel(l)){
    corpoA.set(l.id, l.fontSize || 24); nome.set(l.id, l.name || l.id); } });
  (candidato || []).forEach(l => { if(l && l.type === 'text' && visivel(l))
    corpoB.set(l.id, gLayoutCorpoAtual(l)); });
  ((ctx && ctx.components) || []).forEach(c => {
    const textos = (c.membros || []).filter(id => corpoA.has(id) && corpoB.has(id));
    for(let i = 0; i < textos.length; i++)
      for(let j = 0; j < textos.length; j++){
        if(i === j) continue;
        const x = textos[i], y = textos[j];
        if(!(corpoA.get(x) > corpoA.get(y) + 0.5)) continue;
        medirPar(c.tipo + ':' + (nome.get(x) || x), nome.get(y) || y,
                 corpoA.get(x), corpoA.get(y), corpoB.get(x), corpoB.get(y), 'componente');
      }
  });

  /* A MÉDIA É SOBRE OS PARES MEDÍVEIS — e INVERSÃO CONTA, com preservação zero.
     A versão anterior a excluía ("não cobrar o mesmo dano duas vezes"), e a varredura de
     sensibilidade (§14) mostrou o preço disso: quando o título cruza o preço, o par mais
     comprimido SAI da média e a compressão CAI de 0,140 para 0,051 — encolher mais pontuava
     melhor. Pior que a não-monotonicidade: dois candidatos com inversões em pares DIFERENTES
     tinham denominadores diferentes, e a posição 2 comparava médias de conjuntos distintos.
     Com a inversão dentro, o denominador é o conjunto de pares que o DESENHO declarou — igual
     para todos os candidatos da mesma decisão. E não há dupla cobrança de verdade: a posição 1
     já separou quem inverte de quem não inverte, então a posição 2 só é lida entre candidatos
     que empataram lá. */
  const medidos = pares.filter(p => p.preservacao != null);
  const soma = medidos.reduce((s, p) => s + p.preservacao, 0);
  const preservada = medidos.length ? soma / medidos.length : 1;
  const classes = {};
  pares.forEach(p => { classes[p.classe] = (classes[p.classe] || 0) + 1; });
  return {
    pares: pares,
    paresMedidos: medidos.length,
    preservada: Math.round(preservada * 1000) / 1000,
    compressao: Math.round((1 - preservada) * 1000) / 1000,
    classes: classes,
    inversoes: pares.filter(p => p.classe === 'inversao'),
    empatesVisuais: pares.filter(p => p.classe === 'empate-visual').length,
    degraus: pA.size,
    /* O resumo humano — é o que a explicação da §16 imprime: "preservou 82% da razão
       título/apoio que o desenho tinha". */
    resumo: medidos.map(p => p.de + '/' + p.para + ' ' + Math.round(p.preservacao * 100) + '% de '
      + p.razaoAutoral + '×').join(', ')
  };
}

/* ── 19.3 PERFIL DE UM ESTADO — o que permite o par CONTROLADO ────────────────────────────
   A §17 devolve os candidatos que a busca por acaso gerou, e calibrar com eles é calibrar com
   o que a busca já sabe fazer. O corpus de scoring precisa do contrário: dois estados em que
   exatamente UMA dimensão difere, montados à mão.

   ⚠ NÃO PASSA POR `gSettleCandidateState`. Assentar restaura `_geoAutor` e roda o motor —
   o que apagaria a mutação controlada e devolveria a composição que o solver quer, que é
   justamente a variável que se quer fixar. */
function gLayoutStateSafety(camadas, ctx){
  let problemas = [];
  try{ problemas = gDetectLayoutProblems({ layers:camadas, solveState:{} }, ctx) || []; }
  catch(e){ problemas = []; }
  const reprovadas = (typeof gLayoutCamadaReprovada === 'function')
    ? camadas.filter(l => l && gLayoutCamadaReprovada(l)).map(l => l.id).sort() : [];
  return { seguro: !problemas.length && !reprovadas.length, problemas:problemas.length,
           reprovadas:reprovadas, tipos:[...new Set(problemas.map(x => x.tipo))].sort() };
}

/* ── 19.4 A EXPLICAÇÃO — o traço camada a camada, e a margem ──────────────────────────────
   A explicação da Fase 6 dizia em que posição o #1 passou o #2. Faltava o que a §16 pede: o
   traço INTEIRO até ali, e a declaração de que a decisão PAROU — porque continuar listando
   estética depois que a semântica decidiu é fingir que ela participou.

   A margem (§17) é a distância entre #1 e #2 DENTRO do critério que decidiu. Não é confiança e
   não muda decisão nenhuma nesta fase: é o que vai permitir, depois, distinguir vencedor óbvio
   de empate quase perfeito. */
function gLayoutDecisionTrace(a, b, opts){
  const va = (a && a.vector) || [], vb = (b && b.vector) || [];
  /* AS MESMAS ZONAS QUE O COMPARADOR USA — e por isso o traço não pode calcular as suas. */
  const zonas = (opts && opts.zonas)
    || ((opts && opts.semDeadZone) ? null : _gZonasDaComparacao(a, b));
  const tiers = []; let parou = null;
  for(let i = 0; i < Math.max(va.length, vb.length); i++){
    const x = va[i] || 0, y = vb[i] || 0;
    const nome = G_SCORE_VETOR_ZONA[i];
    const z = (zonas && nome && zonas[nome]) || 0;
    const bruto = Math.abs(x - y);
    const difere = bruto > Math.max(1e-9, z);
    const t = { posicao:i, camada:(a.vectorCamadas && a.vectorCamadas[i]) || null,
                criterio:G_SCORE_VETOR_MOTIVO[i],
                vencedor:Math.round(x * 1000) / 1000, perdedor:Math.round(y * 1000) / 1000,
                /* §18: TRÊS números, e eles não são sinônimos. `rawDelta` é o que a métrica
                   mediu; `deadZone` é a resolução dela; `effectiveDelta` é o que sobrou para
                   decidir — zero quando a diferença não passa da resolução. */
                rawDelta: Math.round(bruto * 1000) / 1000,
                deadZone: Math.round(z * 1000) / 1000,
                effectiveDelta: difere ? Math.round(bruto * 1000) / 1000 : 0,
                resultado: difere ? 'decidiu'
                  : (bruto > 1e-9 && z > 0 ? 'empate-perceptual' : 'empate') };
    /* O detalhe da compressão: é o número que a §16 quer ver na explicação, e ele só existe
       nesta posição do vetor. */
    if(i === 2){
      const ha = a.semantics && a.semantics.hierarquia, hb = b.semantics && b.semantics.hierarquia;
      if(ha || hb) t.detalhe = { vencedor: ha ? ha.resumo : null, perdedor: hb ? hb.resumo : null };
    }
    tiers.push(t);
    if(difere){ parou = t; break; }
  }
  const ca = (a && a.alteration) || {}, cb = (b && b.alteration) || {};
  let desempatePor = null;
  if(!parou){
    if((ca.camadasAlteradas || 0) !== (cb.camadasAlteradas || 0)) desempatePor = 'camadas alteradas';
    else if((ca.trackingDoMotor || 0) !== (cb.trackingDoMotor || 0)) desempatePor = 'tracking do motor';
    else if((ca.acoes || 0) !== (cb.acoes || 0)) desempatePor = 'número de ações';
    else if((a.depth || 0) !== (b.depth || 0)) desempatePor = 'profundidade';
    else desempatePor = 'assinatura';
  }
  const delta = parou ? Math.abs(parou.vencedor - parou.perdedor) : 0;
  const escala = parou ? Math.max(Math.abs(parou.vencedor), Math.abs(parou.perdedor)) : 0;
  /* Quantos critérios contínuos empataram POR RESOLUÇÃO, não por igualdade: é o número que diz
     se a decisão desceu de camada porque a de cima não sabia responder. */
  const perceptuais = tiers.filter(t => t.resultado === 'empate-perceptual');
  return {
    tiers: tiers,
    parouEm: parou ? parou.posicao : -1,
    camadaDecisora: parou ? parou.camada : 'desempate',
    criterio: parou ? parou.criterio : 'desempate determinístico',
    /* A MARGEM DE DECISÃO (§17). `deltaRelativo` existe porque 0,02 de compressão e 0,02 de
       estética não são a mesma distância: uma é 2% de uma escala [0,1], a outra é ruído numa
       penalidade que chega a 400. */
    empatesPerceptuais: perceptuais.map(t => ({ criterio:t.criterio, rawDelta:t.rawDelta,
                                                deadZone:t.deadZone })),
    margem: { posicao: parou ? parou.posicao : -1, camada: parou ? parou.camada : 'desempate',
              criterio: parou ? parou.criterio : 'desempate determinístico',
              delta: Math.round(delta * 1000) / 1000,
              deltaRelativo: escala > 0 ? Math.round((delta / escala) * 1000) / 1000 : 0,
              /* §18 · os três, também aqui. `delta` continua sendo o efetivo, para não quebrar
                 quem já lia a margem da Fase 6.5. ⛔ Nada disto é confiança: é diagnóstico. */
              rawDelta: parou ? parou.rawDelta : 0,
              effectiveDelta: parou ? parou.effectiveDelta : 0,
              deadZone: parou ? parou.deadZone : 0,
              empatesAcima: tiers.filter(t => t.resultado === 'empate'
                                          || t.resultado === 'empate-perceptual').length,
              empatesPerceptuaisAcima: perceptuais.length,
              desempate: !parou, desempatePor:desempatePor }
  };
}

/** A explicação em PT-BR, linha a linha — e ela CORRESPONDE ao comparador por construção:
 *  as linhas saem do mesmo traço que `gCompareLayoutCandidates` percorre. */
function gExplainLayoutDecision(esc){
  const linhas = [];
  if(!esc || !esc.winner){
    return [(esc && esc.explanation && esc.explanation.reasons && esc.explanation.reasons[0])
            || 'sem vencedor'];
  }
  const acoes = (esc.winner.actions || []).map(a => a.id).join('→') || '(original)';
  linhas.push('Vencedor: [' + acoes + '] ' + (esc.winner.searchMode || 'normal')
              + ' d' + (esc.winner.depth || 0));
  if(esc.explanation.wonBy === 'original-first'){
    linhas.push('  ORIGINAL FIRST — a composição publicada resolve o conteúdo real');
    linhas.push('  DECISÃO PAROU AQUI: nenhum perfil foi calculado');
    return linhas;
  }
  const tr = esc.explanation.trace;
  if(!tr){ linhas.push('  único candidato seguro'); return linhas; }
  tr.tiers.forEach(t => {
    if(t.resultado === 'empate-perceptual'){
      /* §17: a explicação precisa mostrar POR QUE o comparador ignorou uma diferença que
         existe. Dizer "empate" e esconder o 0,018 seria mentir por omissão. */
      linhas.push('  ' + t.criterio + ': ' + t.vencedor + ' contra ' + t.perdedor
        + ' · delta ' + t.rawDelta + ' ≤ zona morta ' + t.deadZone + ' → EMPATE PERCEPTUAL');
    }else if(t.resultado === 'empate'){
      linhas.push('  ' + t.criterio + ': empate (' + t.vencedor + ')');
    }else{
      linhas.push('  ' + t.criterio + ': ' + t.vencedor + ' contra ' + t.perdedor + ' → DECIDIU');
      if(t.detalhe && (t.detalhe.vencedor || t.detalhe.perdedor)){
        linhas.push('      #1 preservou ' + (t.detalhe.vencedor || '—'));
        linhas.push('      #2 preservou ' + (t.detalhe.perdedor || '—'));
      }
    }
  });
  if(tr.parouEm >= 0){
    const restantes = G_SCORE_VETOR_MOTIVO.slice(tr.parouEm + 1);
    linhas.push('  DECISÃO PAROU AQUI' + (restantes.length
      ? ' — ' + restantes.join(', ') + (restantes.length > 1 ? ' não participaram' : ' não participou')
      : ''));
    linhas.push('  margem no critério decisor: ' + tr.margem.delta
      + ' (' + Math.round(tr.margem.deltaRelativo * 100) + '% da escala)'
      + (tr.margem.deadZone ? ' · zona morta ' + tr.margem.deadZone : ''));
  }else{
    linhas.push('  empate em TODOS os critérios — decidido por ' + tr.margem.desempatePor);
  }
  return linhas;
}

/* ── 19.5 AUDITORIA DO SCORER LEGADO — legacy × role-corrected ────────────────────────────
   A pergunta da §21, sem rodeio: QUANTAS DECISÕES DO SCORER LEGADO MUDARIAM se ele lesse o
   papel certo? A resposta tem que sair da MESMA função rodando duas vezes — um segundo scorer
   escrito "corrigido" mediria a diferença entre dois códigos, não o impacto do defeito.

   ⛔ Não altera nada. Roda o mesmo caminho da produção (`G_LAYOUT_POLITICAS` + a regra de
   margem de `_gLayoutMelhorAlternativa`) e devolve os dois vereditos lado a lado. */
function gAuditLegacyRoleImpact(layers, dados, canvas, opts){
  const o = opts || {};
  const out = { aplicavel:false, mudou:false, erro:null, politicaLegacy:null,
                politicaCorrigida:null, penalLegacy:null, penalCorrigido:null,
                papeis:[], divergentes:0, camadas:0 };
  try{
    const clone = () => (layers || []).map(l => JSON.parse(JSON.stringify(l)));
    const sopts = Object.assign({ fitText:true, canvas:canvas, scope:'franqueado' }, o.solveOpts || {});
    const padrao = gApplyRelativeAnchors(clone(), dados || {}, {}, sopts);
    if(!padrao || !padrao.length){ out.erro = 'o motor não devolveu composição'; return out; }
    /* O MESMO PORTÃO DA PRODUÇÃO: sem carimbo de adaptação, `gLayoutEscolherAlternativa` nem é
       chamada — a arte que coube no primeiro degrau não tem alternativa a escolher. */
    if(typeof gLayoutPrecisaAlternativas === 'function' && !gLayoutPrecisaAlternativas(padrao)){
      out.motivo = 'sem adaptação: a escolha legada não roda'; return out;
    }
    const cands = [{ politica:'padrao', out:padrao }];
    (typeof G_LAYOUT_POLITICAS !== 'undefined' ? G_LAYOUT_POLITICAS : []).forEach(politica => {
      let alt = null;
      try{ alt = gApplyRelativeAnchors(clone(), dados || {}, {},
             Object.assign({}, sopts, { _politica:politica })); }catch(e){ alt = null; }
      if(alt && alt.length) cands.push({ politica:politica, out:alt });
    });
    out.aplicavel = cands.length > 1;
    const cvOpts = { canvas:canvas };
    /* O CONTEXTO DO PAPEL EFETIVO. Sem ele o papel sai do carimbo do clone (`layoutSemantic`),
       que o próprio solver escreveu — mesma resposta, um passo mais barato. */
    const ctx = o.ctx || null;
    const papelEfetivo = (l) => gLayoutEffectiveRole(ctx, l);
    const legado = cands.map(c => ({ politica:c.politica, out:c.out,
      score: gScoreComposition(c.out, cvOpts) }));
    const corrigido = cands.map(c => ({ politica:c.politica, out:c.out,
      score: gScoreComposition(c.out, Object.assign({ papel:papelEfetivo }, cvOpts)) }));
    const vL = _gLayoutMelhorAlternativa(legado), vC = _gLayoutMelhorAlternativa(corrigido);
    out.politicaLegacy = vL.politica; out.politicaCorrigida = vC.politica;
    out.penalLegacy = vL.score.penal; out.penalCorrigido = vC.score.penal;
    out.mudou = vL.politica !== vC.politica;
    /* A NOTA DA MESMA COMPOSIÇÃO sob os dois leitores — é o delta que explica a divergência
       sem depender de qual política venceu. */
    const notaL = legado.find(x => x.politica === 'padrao').score;
    const notaC = corrigido.find(x => x.politica === 'padrao').score;
    out.deltaPenalPadrao = Math.round((notaC.penal - notaL.penal) * 100) / 100;
    out.itensLegacy = notaL.itens; out.itensCorrigido = notaC.itens;
    out.papeis = padrao.filter(l => l && l.type === 'text').map(l => gLayoutRoleTrace(ctx, l));
    out.camadas = out.papeis.length;
    out.divergentes = out.papeis.filter(p => p.diverge).length;
    out.pesoDivergentes = out.papeis.filter(p => p.pesoDiverge).length;
    out.ranking = { legacy: legado.map(x => x.politica + ':' + x.score.penal),
                    corrigido: corrigido.map(x => x.politica + ':' + x.score.penal) };
  }catch(e){ out.erro = String(e && e.message || e); }
  return out;
}

/* ════════════════════════════════════════════════════════════════════
   20. ZONAS MORTAS PERCEPTUAIS E CONTRATO DO CANDIDATO (Fase 6.6)
   ════════════════════════════════════════════════════════════════════
   A §19 mediu duas decisões REAIS do corpus escolhidas por compressão com margens de 0,012 e
   0,020, contra um ruído de quantização de até 0,302 nos conjuntos de fonte pequenos. O sistema
   é determinístico e mesmo assim escolhe por diferença que ninguém vê.

   ⛔ NÃO É SUAVIZAÇÃO. Suavizar é mudar o valor da métrica. Aqui o valor não muda: o que muda é
   o comparador reconhecer que a métrica tem RESOLUÇÃO FINITA, e que abaixo dela "A tem 0,112 e
   B tem 0,094" não é informação — é ruído com três casas decimais. Abaixo da resolução, EMPATE,
   e a decisão desce para a camada seguinte, que é comportamento definido.

   ⛔ E NÃO É HISTERESE. Nada aqui olha decisão anterior, relógio ou aleatório: a zona morta sai
   da composição AUTORADA, é a mesma para todos os candidatos da decisão e a mesma entrada
   devolve o mesmo vencedor, sempre.

   ⛔ E NÃO MUDA PRODUÇÃO. `gApplyRelativeAnchors`, `gLayoutEscolherAlternativa` e
   `gLayoutCamadaReprovada` continuam sem conhecer esta seção. */

/* ── 20.1 A ZONA MORTA DE CADA CRITÉRIO ───────────────────────────────────────────────────
   ⛔ NÃO EXISTE EPSILON GLOBAL. Cada métrica tem a sua resolução, e medir mostrou que para a
   compressão nem uma constante serve: o ruído varia 11× entre conjuntos de fonte reais
   (0,027 no display 96/84/38/20 contra 0,302 no legal 20/18/14). Uma constante que cobrisse o
   rodapé deixaria a métrica muda no título.

   A CAUSA É ARITMÉTICA, não estatística. O motor não guarda corpo fracionário —
   `Math.max(piso, Math.floor(atual * fator))` em `00-config.js:3350` e `auto-layout.js:4071`.
   A quantização erra ±1px em ABSOLUTO, logo o erro RELATIVO de um corpo é 1/corpo; e a
   preservação divide por ln(razaoAutoral). Daí a resolução de um par:

       resolução(a,b) ≈ passo · (1/a + 1/b) / |ln(rA)|

   Corpo pequeno e razão rente explodem os dois termos juntos — é por isso que 20/18 não resolve
   nada e 120/24 resolve tudo (ruído medido nesse conjunto: exatamente 0).

   O `fator` é o único número que sai de calibragem, e sai com regra declarada: o menor que
   cobre o PIOR ruído medido em todos os conjuntos da grade (8 conjuntos × 50 escalas × 3
   quantizações = 1.200 amostras, em `tests/scoring-cases.js`). Há teste que reprova se alguém
   baixá-lo sem refazer a medição. */
const G_SCORE_DEAD_ZONE = {
  'hierarchy-compression': {
    tipo:'derivada',
    passo: 1,        // a quantização do motor: 1px
    /* FATOR 0,70 — a regra, declarada: o menor múltiplo de 0,05 que cobre o PIOR ruído medido
       em toda a grade (o pior conjunto precisa de 0,65; ver o teste de calibração). Ele é
       menor que 1 por um motivo físico, não estatístico: (1/a + 1/b) é o pior caso TEÓRICO,
       com os dois corpos errando um pixel inteiro em sentidos opostos ao mesmo tempo. A grade
       mostra que isso não acontece — o observado para em 0,65 do teto teórico. Adotar o teto
       inteiro muraria mais sinal do que o necessário; adotar menos deixaria ruído decidir. */
    fator: 0.70,
    /* TETO: acima disto a métrica não resolve NADA naquela arte. Continuar com meia resolução
       seria fingir; declarar empate perceptual sempre e descer de camada é o honesto. */
    teto: 0.5
  },
  /* ESTÉTICA: ZERO, e é resultado de medição, não omissão. A sensibilidade da nota estética a
     perturbações geométricas de 1px foi medida (grade em `tests/scoring-cases.js`): o maior
     |Δ| é ~0,01, e os itens individuais ficam abaixo disso (densidade 0,008, equilíbrio 0,007,
     respiro/linhas/editorial exatamente 0 fora de mudança de quebra). As margens estéticas que
     a Fase 6.5 observou decidindo disputas são de 0,18 a 0,57 — entre 18× e 57× o ruído.
     Margem de estética é SINAL. Criar zona morta aqui seria apagar decisão boa.
     ⚠ Uma exceção fica registrada: quando 1px muda a CONTAGEM DE LINHAS, a nota pula ~9
     pontos. Isso não é ruído da medida — é a arte mudando de verdade, e a métrica acertando. */
  'aesthetics': { tipo:'constante', valor: 0 }
};

/* Que posição do vetor recebe zona morta. ⛔ As outras NÃO recebem, e a razão é a mesma em
   todas: segurança é portão, violação dura é contagem discreta de fatos, modo é booleano,
   relação perdida e composição alterada são contagens de estrutura. "Meia violação" e "meio
   componente perdido" não existem — dar tolerância a um inteiro é apagar o fato. */
const G_SCORE_VETOR_ZONA = [null, null, 'hierarchy-compression', null, null, null,
                            'aesthetics', null];

/** A RESOLUÇÃO da compressão para UMA composição autorada. Depende só do desenho — nunca do
 *  candidato, nunca da ordem, nunca do relógio. */
function gLayoutCompressionResolution(base, ctx, fatorAux){
  const cfg = G_SCORE_DEAD_ZONE['hierarchy-compression'];
  const f = (fatorAux != null) ? fatorAux : cfg.fator;
  /* A base contra ela mesma: devolve os pares que o DESENHO declarou, com as razões autorais.
     É a mesma função da §19.2 — a lista de pares medíveis não pode ter duas verdades. */
  const rel = gLayoutHierarchyRelation(base, base, ctx);
  const medidos = rel.pares.filter(p => p.preservacao != null);
  if(!medidos.length) return 0;
  let soma = 0;
  medidos.forEach(p => {
    const ln = Math.abs(Math.log(p.razaoAutoral));
    if(ln < 1e-6){ soma += 1; return; }             // razão sem contraste: não resolve nada
    soma += Math.min(1, cfg.passo * (1 / Math.max(1, p.corpoAutoralDe)
                                   + 1 / Math.max(1, p.corpoAutoralPara)) / ln);
  });
  return Math.min(cfg.teto, f * soma / medidos.length);
}

/** As zonas mortas de UMA decisão. Memorizada no contexto: a base é a mesma para todos os
 *  candidatos, então calcular por candidato seria pagar a mesma conta N vezes. */
function gLayoutDeadZones(base, ctx){
  if(ctx && ctx._deadZone) return ctx._deadZone;
  const z = { 'hierarchy-compression': gLayoutCompressionResolution(base, ctx),
              'aesthetics': G_SCORE_DEAD_ZONE.aesthetics.valor || 0 };
  if(ctx) ctx._deadZone = z;
  return z;
}

/* As zonas de uma COMPARAÇÃO. Cada perfil carrega as suas (iguais por construção — mesma base);
   o MÁXIMO entre as duas é o que mantém a comparação simétrica mesmo se alguém montar perfis
   de bases diferentes, e antissimetria é o que impede a ordenação de depender da ordem. */
function _gZonasDaComparacao(a, b){
  const za = (a && a.deadZone) || null, zb = (b && b.deadZone) || null;
  if(!za && !zb) return null;
  const out = {};
  Object.keys(G_SCORE_DEAD_ZONE).forEach(k => {
    out[k] = Math.max((za && za[k]) || 0, (zb && zb[k]) || 0);
  });
  return out;
}

/* ── 20.2 O CONTRATO DO CANDIDATO ─────────────────────────────────────────────────────────
   ⚠ SÃO DUAS CAMADAS DE SEGURANÇA, COM NOMES DIFERENTES DE PROPÓSITO:

     PRODUCT SAFETY   `gLayoutCamadaReprovada` — o veredito que o checklist e a publicação
                      usam. É o produto falando. Não se toca nele aqui.
     CANDIDATE CONTRACT  o que o GERADOR promete e que ninguém conferia: corpo acima do piso
                      operacional e camada protegida intacta. Hoje isso vale porque as ações
                      nunca produzem o contrário — é verdade, e não é um portão. Defesa em
                      profundidade quer dizer conferir o que se assume.

   A §19 provou a lacuna: um estado com título em 6px passa por `gLayoutCamadaReprovada` com
   `seguro=true` e `margemLegibilidade=-2`. O piso era medido e não decidia nada.

   ⛔ Isto NÃO é o veredito legado e não vira um. Ele responde por arte publicada; este responde
   por candidato de uma busca. Misturar os dois nomes seria dar ao produto uma regra que ele
   nunca teve. */
function gLayoutCandidateContract(camadas, ctx, opts){
  const o = opts || {};
  const base = o.base || camadas;
  const idxB = new Map((base || []).map(l => [l.id, l]));
  /* As ações do candidato dizem em quem ele tinha autorização para mexer. Camada protegida
     nunca aparece aqui — o gerador não a oferece —, e é justamente isso que o contrato confere
     em vez de assumir. */
  const autorizados = new Set();
  (o.actions || []).forEach(a => {
    if(!a) return;
    if(a.targetId) autorizados.add(a.targetId);
    const ids = (a.params && (a.params.ids || a.params.membros)) || null;
    if(Array.isArray(ids)) ids.forEach(id => autorizados.add(id));
  });
  const violacoes = [];
  (camadas || []).forEach(l => {
    if(!l) return;
    const visivel = (typeof _gLayoutVisivel !== 'function') || _gLayoutVisivel(l);
    /* ── 1. PISO DE LEGIBILIDADE ── o corpo operacional que o motor promete nunca cruzar.
       ⚠ O PISO DO CONTRATO É O DE EMERGÊNCIA (`gLayoutPisoFonte(l, true)` = max(8, legível)),
       não o normal. A primeira versão desta função usou o normal (50% do corpo autorado) e
       reprovou 7 candidatos LEGÍTIMOS do corpus real de uma vez: o degrau proporcional da
       escada desce abaixo dos 50% de propósito, e é ele que o `scale-component` executa.
       Os 50% são POLÍTICA do degrau normal — o quanto a escada se contém antes de apelar. O
       contrato responde por outra coisa: o limite que NENHUM modo cruza. Confundir política
       com contrato transforma defesa em profundidade em portão quebrado. */
    if(l.type === 'text' && visivel && typeof gLayoutPisoFonte === 'function'){
      const piso = gLayoutPisoFonte(l, true);
      const corpo = gLayoutCorpoAtual(l);
      if(corpo < piso - 0.5)
        violacoes.push({ tipo:'abaixo-do-piso-de-legibilidade', id:l.id,
                         corpo:Math.round(corpo * 10) / 10, piso:Math.round(piso * 10) / 10 });
    }
    /* ── 2. INTEGRIDADE DA PROTEGIDA ── travada pelo designer, logo imóvel.
       ⚠ SÓ A MARCA EXPLÍCITA VALE: `locked`, `lockPosition` e o contrato antigo
       `layoutRole === 'protected'` — a MESMA régua que o motor usa (`00-config.js:2677`). O
       papel `protegida` da Gramática NÃO serve aqui: ele é INFERIDO do nome (qualquer camada
       chamada "Selo", "Logo" ou "Carimbo" ganha o papel), e no corpus real isso reprovou um
       campo dinâmico chamado "Selo" que a corrente move — legitimamente. Papel inferido é bom
       para julgar composição; para dizer "isto não pode se mexer", só a declaração serve. */
    const explicitamenteProtegida = !!(l.locked || l.lockPosition || l.layoutRole === 'protected');
    if(!explicitamenteProtegida) return;
    const b = idxB.get(l.id);
    if(!b || autorizados.has(l.id)) return;
    const moveu = Math.abs((l.x || 0) - (b.x || 0)) + Math.abs((l.y || 0) - (b.y || 0)) > 0.5;
    const redim = Math.abs((l.w || 0) - (b.w || 0)) + Math.abs((l.h || 0) - (b.h || 0)) > 0.5;
    const corpo = l.type === 'text'
      && Math.abs(gLayoutCorpoAtual(l) - gLayoutCorpoAtual(b)) > 0.5;
    if(moveu || redim || corpo)
      violacoes.push({ tipo:'protegida-alterada', id:l.id, moveu:moveu, redimensionou:redim,
                       corpo:corpo });
  });
  violacoes.sort((x, y) => (x.tipo + x.id) < (y.tipo + y.id) ? -1 : 1);
  return { ok: !violacoes.length, violacoes:violacoes,
           /* O nome importa: quem lê um diagnóstico precisa saber QUAL das duas camadas falou. */
           camada:'candidate-contract' };
}

/* ════════════════════════════════════════════════════════════════════
   21. SHADOW VALIDATION (Fase 7) — observar em massa, sem dar autoridade
   ════════════════════════════════════════════════════════════════════
   As fases 5 a 6.6 construíram e calibraram. Esta não inventa arquitetura: ela OLHA. Para cada
   execução elegível, o pipeline novo roda inteiro ao lado do solver — e o que o franqueado
   baixa continua saindo do solver, byte a byte.

   ⛔ NENHUM WINNER GANHA AUTORIDADE AQUI. `gApplyRelativeAnchors` e `gLayoutEscolherAlternativa`
   seguem sem conhecer esta seção.

   ⛔ E SHADOW NUNCA PODE BLOQUEAR. Toda a seção roda dentro de `try`, o solver legado é
   executado PRIMEIRO e de forma independente, e qualquer exceção vira diagnóstico — nunca
   interrompe a criação da arte. Há teste de injeção de falha para cada etapa. */

/* Classes de tamanho, para orçamento de desempenho por porte de arte (§14). Os cortes saem do
   que o corpus real tem: peça de campanha fica na casa de 5–15 camadas, PSD importado passa de
   100 com facilidade. */
function gShadowTemplateSize(n){ return n <= 20 ? 'small' : n <= 120 ? 'medium' : 'large'; }

/* ── 21.1 EQUIVALÊNCIA — cinco níveis, não "igual/diferente" (§4) ─────────────────────────
   Duas composições podem ser geometricamente diferentes e ainda dizer a mesma coisa. Comparar
   pixel a pixel responderia "diferente" para uma solução que preserva a intenção melhor que a
   do solver — e é justamente esse caso que esta fase precisa enxergar.

   A ordem de avaliação é do mais grave para o mais benigno, e para na primeira que casar. */
const G_SHADOW_EQUIV = ['safety-different', 'semantically-different', 'visually-different',
                        'structurally-equivalent', 'exact'];

function gShadowEquivalence(legado, novo, ctx, canvas){
  if(!legado || !novo) return { nivel:'safety-different', motivo:'uma das composições não existe' };
  const cv = canvas || (ctx && ctx.canvas) || { w:1080, h:1080 };
  const reprovada = (ls) => (typeof gLayoutCamadaReprovada === 'function')
    ? ls.some(l => l && gLayoutCamadaReprovada(l)) : false;
  // ── 1. SEGURANÇA ── um entrega arte aprovada e o outro não: nada mais importa.
  if(reprovada(legado) !== reprovada(novo))
    return { nivel:'safety-different',
             motivo: reprovada(legado) ? 'o legado reprova e o novo aprova'
                                       : 'o novo reprova e o legado aprova' };
  // ── 2. SEMÂNTICA ── a função dos elementos sobreviveu igual nos dois?
  const gL = gCompileLayoutGrammar(legado, cv), gN = gCompileLayoutGrammar(novo, cv);
  const cL = gCompileLayoutComponents(gL, gCompileCompositionGraph(gL));
  const cN = gCompileLayoutComponents(gN, gCompileCompositionGraph(gN));
  const estrut = gCompareLayoutStructure(gL, gN);
  const comps = gCompareLayoutComponents(cL, cN);
  const dano = gLayoutSemanticDamage(legado, novo, { _diffEstrutura:estrut, _diffComponentes:comps,
    _compsCandidato:cN, components:cL, _no:new Map((gL.nodes || []).map(n => [n.id, n])),
    _placa:ctx && ctx._placa });
  if(dano.violacoes.length)
    return { nivel:'semantically-different', motivo:dano.violacoes.map(v => v.tipo).join(','),
             violacoes:dano.violacoes };
  // ── 3. GEOMETRIA IDÊNTICA ── o caso mais comum e o mais fácil de provar.
  const geo = (ls) => ls.filter(l => l && l.type === 'text').map(l => {
    const r = (typeof gInkRect === 'function') ? gInkRect(l, l._fit) : l;
    return l.id + ':' + Math.round(r.x) + ',' + Math.round(r.y) + ',' + Math.round(r.w) + ','
         + Math.round(r.h) + '@' + Math.round(gLayoutCorpoAtual(l));
  }).sort().join('|');
  if(geo(legado) === geo(novo)) return { nivel:'exact', motivo:'mesma geometria e mesma tipografia' };
  // ── 4. ESTRUTURA ── mudou a geometria, mas as relações da Gramática continuam as mesmas.
  if(estrut.sameStructure && !comps.added.length && !comps.removed.length
     && !comps.changed.length)
    return { nivel:'structurally-equivalent',
             motivo:'a geometria mudou e nenhuma relação nem componente mudou' };
  return { nivel:'visually-different',
           motivo:(estrut.relationsRemoved.length + ' relação(ões) a menos, '
                 + estrut.relationsAdded.length + ' a mais, '
                 + (comps.changed.length + comps.added.length + comps.removed.length)
                 + ' componente(s) mexido(s)'),
           relacoesPerdidas:estrut.relationsRemoved.map(r => r.tipo) };
}

/* ── 21.2 CONFIANÇA — não é a nota, e não é beleza (§5/§6) ────────────────────────────────
   ⛔ O VETOR DE SCORING NÃO SERVE COMO CONFIANÇA. Ele responde "qual é a melhor composição
   entre estas"; confiança responde outra pergunta: "quão segura é esta decisão para receber
   autoridade?". Uma composição lindíssima escolhida por um fio, em modo de emergência, com
   metade da arte descendo junto, é uma decisão FRÁGIL — e o vetor não sabe disso.

   Os sinais são FATOS do processo, todos já medidos pelas fases anteriores. Nenhum deles é
   estético, e nenhum é aprendido. */
/* ⚠ O GRUPO ADAPTATIVO NÃO SE MEDE SÓ POR FRAÇÃO, e a corrida em massa é quem provou isso: em
   arte real de 5 a 8 camadas, TODOS os 81 vencedores adaptados tinham grupo de 3 a 6 camadas
   cobrindo de 43% a 83% da peça (p50 = 0,67). Um sinal que dispara em 100% de uma classe não
   informa nada — ele estava medindo o tamanho da arte, não a qualidade da solução.
   O dano real é quantas camadas foram efetivamente arrastadas, então o limiar principal é
   ABSOLUTO e a fração entra como qualificador. Oito camadas é mais do que a maior arte do
   corpus real inteira; trinta é o porte em que a Fase 5.95 viu 132 de 344 descendo juntas. */
const G_SHADOW_CONF = {
  grupoGrandeAbs: 8,   // grupo grande em termos absolutos: mais que uma arte pequena inteira
  grupoMedioAbs:  5,   // com fração alta junto, já é boa parte da composição
  grupoFracao:  0.50,
  quaseEmpate: 3,      // candidatos empatados com o vencedor até o critério que decidiu
  margemBaixa: 0.15    // fração da escala do critério decisor
};

function gShadowConfidence(rec){
  const motivos = [], sinais = {};
  // ── BLOQUEADO ── não há decisão a confiar.
  if(rec.erro) return { tier:'BLOQUEADO', motivos:['exceção no pipeline: ' + rec.erro], sinais };
  if(!rec.winner || !rec.winner.acoes)
    return { tier:'BLOQUEADO', motivos:['nenhum candidato venceu'], sinais };
  if(rec.winner.seguro === false)
    return { tier:'BLOQUEADO', motivos:['o portão de segurança reprovou'], sinais };
  if(rec.winner.contrato === false)
    return { tier:'BLOQUEADO', motivos:['o Candidate Contract reprovou'], sinais };

  let baixa = false, media = false;
  // ── EMERGÊNCIA ── o piso tipográfico normal não bastou: é sacrifício, e sacrifício é risco.
  sinais.emergencia = rec.winner.modo === 'emergency';
  if(sinais.emergencia){ baixa = true; motivos.push('venceu em modo de emergência'); }
  // ── GRUPO ADAPTATIVO ── quantidade da arte que precisou descer junto.
  sinais.grupoRatio = rec.winner.grupoRatio || 0;
  sinais.grupoSize = rec.winner.grupoSize || 0;
  const _grupo = sinais.grupoSize + ' camadas / ' + Math.round(sinais.grupoRatio * 100) + '% da arte';
  if(sinais.grupoSize >= G_SHADOW_CONF.grupoGrandeAbs){
    baixa = true; motivos.push('grupo adaptativo de ' + _grupo);
  }else if(sinais.grupoSize >= G_SHADOW_CONF.grupoMedioAbs
           && sinais.grupoRatio >= G_SHADOW_CONF.grupoFracao){
    media = true; motivos.push('grupo adaptativo de ' + _grupo);
  }
  // ── DIVERGÊNCIA DO LEGADO ── quanto mais longe do que o solver entrega, mais atenção.
  sinais.equivalencia = rec.equivalencia;
  if(rec.equivalencia === 'semantically-different'){
    baixa = true; motivos.push('a solução nova tem violação semântica que o solver não tem');
  }else if(rec.equivalencia === 'safety-different'){
    /* ⚠ `safety-different` é AMBÍGUO e os dois lados são opostos: ou o novo resolve o que o
       solver reprova (so-search, o caso que prova valor), ou o novo entrega o que o solver
       aprova como quebrado — e este último nem chega aqui, porque o portão e o contrato o
       barram antes. Então, com o legado reprovando, divergir é o trabalho dando certo. */
    if(rec.legacy && rec.legacy.safe === false)
      motivos.push('so-search: o solver reprova esta arte e a busca resolveu');
    else { baixa = true; motivos.push('divergência de segurança contra o solver'); }
  }else if(rec.equivalencia === 'visually-different'){
    media = true; motivos.push('resultado visualmente diferente do solver');
  }
  /* ⛔ `structurally-equivalent` NÃO É RISCO. A §6 lista "estrutura preservada" entre os sinais
     de ALTA, e é exatamente isso que esse nível significa: a geometria mudou e nenhuma relação
     da Gramática nem componente mudou. Tratá-lo como divergência fazia ALTA virar sinônimo de
     "a arte já cabia" — 192 de 192, com toda solução adaptada rebaixada por definição. */
  // ── QUASE-EMPATE ── várias soluções indistinguíveis até o critério que decidiu.
  sinais.quaseEmpatados = rec.winner.quaseEmpatados || 0;
  if(sinais.quaseEmpatados >= G_SHADOW_CONF.quaseEmpate){
    media = true; motivos.push(sinais.quaseEmpatados + ' candidatos empatados até o critério decisor');
  }
  // ── MARGEM ── decisão apertada DENTRO do critério que decidiu (já fora da zona morta).
  sinais.margemRelativa = (rec.winner.margem && rec.winner.margem.deltaRelativo) || 0;
  if(rec.winner.margem && !rec.winner.margem.desempate
     && sinais.margemRelativa > 0 && sinais.margemRelativa < G_SHADOW_CONF.margemBaixa){
    media = true; motivos.push('margem de ' + Math.round(sinais.margemRelativa * 100) + '% no critério decisor');
  }
  // ── EMPATE PERCEPTUAL ATRAVESSADO ── a decisão desceu de camada por falta de resolução.
  sinais.empatesPerceptuais = (rec.winner.margem && rec.winner.margem.empatesPerceptuaisAcima) || 0;
  if(sinais.empatesPerceptuais > 0){
    media = true; motivos.push(sinais.empatesPerceptuais + ' critério(s) empatado(s) por resolução');
  }
  /* ── VIOLAÇÃO SEMÂNTICA NO PRÓPRIO VENCEDOR ── ele é o MENOS ruim entre os candidatos, e
     ainda assim carrega uma inversão de papel. Pode até ser idêntico ao que o solver entrega
     hoje (e aí `equivalencia` é 'exact' e nenhum outro sinal dispara), mas "o resultado tem
     problema semântico conhecido" é fragilidade do RESULTADO — e a §6 pede ALTA sem sinal de
     fragilidade nenhum. A corrida em massa encontrou 2 casos assim escondidos em ALTA. */
  sinais.violacoesNoVencedor = rec.winner.semantica || 0;
  if(sinais.violacoesNoVencedor > 0){
    media = true;
    motivos.push(sinais.violacoesNoVencedor + ' violação(ões) semântica(s) no próprio vencedor');
  }
  // ── CAUSAS ── conflito com muitas origens é composição sob pressão.
  sinais.causas = rec.search ? (rec.search.causas || 0) : 0;
  if(sinais.causas >= 3){ media = true; motivos.push(sinais.causas + ' causas simultâneas'); }
  // ── DESEMPATE POR ASSINATURA ── a decisão caiu no hash: não há critério que a explique.
  if(rec.winner.margem && rec.winner.margem.desempatePor === 'assinatura'){
    media = true; motivos.push('decidido no desempate por assinatura');
  }
  const tier = baixa ? 'BAIXA' : media ? 'MEDIA' : 'ALTA';
  if(tier === 'ALTA') motivos.push('modo normal, sem sinal de fragilidade');
  return { tier:tier, motivos:motivos, sinais:sinais };
}

/* ── 21.3 POLÍTICA DE FALLBACK — documentada, NÃO ativada (§12) ───────────────────────────
   ⛔ Nenhuma falha do Automatic Designer pode quebrar a criação de arte. A regra abaixo é o
   contrato que a Fase 8 vai executar; aqui ela só CLASSIFICA o que aconteceria.

     · sem vencedor            → solver legado
     · contrato reprovado      → solver legado
     · segurança reprovada     → solver legado
     · confiança BAIXA/BLOQUEADA → solver legado
     · exceção ou timeout      → solver legado
     · confiança ALTA/MÉDIA com vencedor seguro → entregaria o novo

   O legado SEMPRE termina: ele roda primeiro, fora do `try` do pipeline novo. */
function gShadowWouldDeliver(rec){
  if(rec.erro) return { decisao:'wouldFallbackLegacy', motivo:'exceção no pipeline novo' };
  if(!rec.winner || !rec.winner.acoes)
    return { decisao:'wouldFallbackLegacy', motivo:'nenhum vencedor' };
  if(rec.winner.seguro === false || rec.winner.contrato === false)
    return { decisao:'wouldBlock', motivo:'portão de segurança ou Candidate Contract reprovou' };
  if(rec.confianca && (rec.confianca.tier === 'BAIXA' || rec.confianca.tier === 'BLOQUEADO'))
    return { decisao:'wouldFallbackLegacy', motivo:'confiança ' + rec.confianca.tier };
  return { decisao:'wouldDeliverSafe', motivo:'confiança ' + (rec.confianca && rec.confianca.tier) };
}

/* ── 21.4 BALDE DE REGRESSÃO (§17) ────────────────────────────────────────────────────────
   O que precisa aparecer em destaque no relatório, mesmo quando o resultado é "seguro". Cada
   item é um FATO comparado contra o solver, nunca um juízo de gosto. */
function gShadowRegressions(rec, legado, novo, ctx){
  const out = [];
  if(!legado || !novo) return out;
  const hierL = gLayoutHierarchyRelation(legado, legado, ctx);
  const hierN = gLayoutHierarchyRelation(legado, novo, ctx);
  const zona = (ctx && ctx._deadZone && ctx._deadZone['hierarchy-compression']) || 0;
  if(hierN.compressao > hierL.compressao + Math.max(zona, 1e-9))
    out.push({ tipo:'hierarchy-worse', de:hierL.compressao, para:hierN.compressao, zona:zona });
  if(hierN.pares.some(p => p.classe === 'inversao'))
    out.push({ tipo:'semantic-role-worse',
               pares:hierN.pares.filter(p => p.classe === 'inversao').map(p => p.de + '>' + p.para) });
  if(rec.winner && rec.winner.grupoSize >= G_SHADOW_CONF.grupoGrandeAbs)
    out.push({ tipo:'excessive-scale-group', camadas:rec.winner.grupoSize,
               ratio:rec.winner.grupoRatio });
  if(rec.winner && rec.winner.modo === 'emergency' && rec.legacy && rec.legacy.safe)
    out.push({ tipo:'emergency-unnecessary', nota:'o solver resolveu sem emergência' });
  /* DESLOCAMENTO EXCESSIVO: a solução nova mexeu MUITO mais na posição que a do solver. A régua
     é o lado curto da prancheta — 10% dele é um bloco viajando. */
  const cv = (ctx && ctx.canvas) || { w:1080, h:1080 };
  const curto = Math.max(1, Math.min(cv.w || 1080, cv.h || 1080));
  const idxL = new Map(legado.map(l => [l.id, l]));
  let desloc = 0;
  novo.forEach(l => { const b = idxL.get(l.id); if(!b) return;
    desloc = Math.max(desloc, Math.abs((l.x || 0) - (b.x || 0)) + Math.abs((l.y || 0) - (b.y || 0))); });
  if(desloc > curto * 0.10)
    out.push({ tipo:'excessive-displacement', px:Math.round(desloc),
               fracaoDoLadoCurto:Math.round(desloc / curto * 100) / 100 });
  return out;
}

/* ── 21.5 O REGISTRO DE UMA EXECUÇÃO (§2) ─────────────────────────────────────────────────
   Determinístico, serializável e sem dado sensível: o conteúdo do franqueado entra como HASH,
   nunca como texto. Uma execução, um registro.
   ⛔ O SOLVER RODA PRIMEIRO E FORA DO `try` DO PIPELINE NOVO. É essa ordem que garante a §23:
   o legado sempre termina, aconteça o que acontecer depois. */
function gShadowValidationRecord(fx, dados, opts){
  const o = opts || {};
  const agora = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
  const t0 = agora();
  const clonar = (ls) => ls.map(l => JSON.parse(JSON.stringify(l)));
  const rec = {
    templateId: fx.nome || fx.id || '?',
    inputSignature: (typeof _gGramHash === 'function') ? _gGramHash(JSON.stringify(dados || {})) : '',
    camadas: (fx.layers || []).length,
    tamanho: gShadowTemplateSize((fx.layers || []).length),
    /* LOCAL FIT (§8): a frente paralela não existe neste repositório. Os campos ficam
       declarados e nulos — o que se mede hoje é o proxy honesto, `original-first`: a arte que
       resolve o conteúdo real sem nenhuma adaptação. */
    localFit: { disponivel:false, resolvedByLocalFit:null, escalatedToAutomaticDesigner:null,
                localFitOverflowReason:null },
    legacy:null, search:null, scoring:null, winner:null, equivalencia:null, equivalenciaMotivo:null,
    classe:null, confianca:null, entrega:null, regressoes:[], erro:null, ms:0
  };

  // ── 1. O SOLVER LEGADO, sozinho e primeiro ──────────────────────────────────────────────
  let saidaLegado = null;
  const tL = agora();
  try{
    saidaLegado = gApplyRelativeAnchors(clonar(fx.layers), dados || {}, {},
      { fitText:true, canvas:fx.canvas, scope:'franqueado' });
  }catch(e){ saidaLegado = null; }
  const msLegado = agora() - tL;
  const legadoSeguro = saidaLegado
    ? !saidaLegado.some(l => typeof gLayoutCamadaReprovada === 'function'
        ? gLayoutCamadaReprovada(l) : !!(l && (l._layoutInvalido || l._foraDaArte)))
    : null;
  rec.legacy = { safe:legadoSeguro, ms:Math.round(msLegado * 100) / 100,
                 voltas:(saidaLegado && saidaLegado._layoutMeta && saidaLegado._layoutMeta.tentativas) || 0,
                 efetivo:(saidaLegado && saidaLegado._layoutMeta && saidaLegado._layoutMeta.efetivo) || null };

  // ── 2. O PIPELINE NOVO, inteiro dentro de um `try` ──────────────────────────────────────
  try{
    const tB = agora();
    const ctx = gBuildOperationalContext(clonar(fx.layers), fx.canvas, { dados:dados || {} });
    const r = gSearchLayoutCandidates({ ctx:ctx, base:clonar(fx.layers) });
    const msBusca = agora() - tB;
    const rd = (r.original && r.original.diagnostics) || {};
    rec.search = { gerados:r.diagnostics.generated, solved:r.solved.length,
                   partial:r.partial.length, invalid:r.invalid.length,
                   profundidade:r.diagnostics.maxDepthReached,
                   primeiraSolucao:r.diagnostics.firstSolvedDepth,
                   modo:r.diagnostics.firstSolvedMode || null,
                   emergenciaRodou:!!r.diagnostics.emergencia,
                   problemas:rd.problemas || 0, causas:(rd.causas || []).length,
                   tipos:[...new Set(rd.tipos || [])].sort(),
                   ms:Math.round(msBusca * 100) / 100 };
    /* ORIGINAL-FIRST: a arte já cabe. É o proxy do Local Fit enquanto ele não existe. */
    rec.originalFirst = (rd.problemas || 0) === 0;

    const tS = agora();
    const esc = gSelectLayoutCandidate(r, ctx, { legacySolverOutcome:
      legadoSeguro == null ? null : (legadoSeguro ? 'solved' : 'unsafe') });
    const msScore = agora() - tS;
    rec.scoring = { avaliados:esc.diagnostics.avaliados, descartados:esc.diagnostics.descartados,
                    porSeguranca:esc.diagnostics.porSeguranca || 0,
                    porContrato:esc.diagnostics.porContrato || 0,
                    contratoViolado:[...new Set(esc.diagnostics.contratoViolado || [])].slice(0, 4),
                    originalFirst:esc.diagnostics.originalFirst,
                    ms:Math.round(msScore * 100) / 100 };

    if(esc.winner){
      const pv = (esc.ranked[0] && esc.ranked[0].profile) || null;
      /* QUASE-EMPATADOS: quantos candidatos são indistinguíveis do vencedor ATÉ o critério que
         decidiu. É o sinal de "a decisão podia ter caído para qualquer um destes". */
      const pos = (esc.explanation.margem && esc.explanation.margem.posicao);
      let quase = 0;
      if(pv && pos != null && pos >= 0)
        quase = esc.ranked.slice(1).filter(x => x.profile
          && x.profile.vector.slice(0, pos).every((v, i) => Math.abs(v - pv.vector[i]) < 1e-9)).length;
      const assentado = gSettleCandidateState(esc.winner, ctx);
      rec._novo = assentado.layers;
      rec.winner = {
        acoes:(esc.winner.actions || []).map(a => a.id),
        modo:esc.winner.searchMode, depth:esc.winner.depth,
        wonBy:esc.explanation.wonBy, criterio:esc.explanation.criterio,
        margem:esc.explanation.margem || null,
        seguro:pv ? pv.safety.seguro : null, contrato:pv ? pv.contract.ok : null,
        grupoSize:pv ? pv.observabilidade.adaptiveGroupSize : 0,
        grupoRatio:pv ? pv.observabilidade.adaptiveGroupRatio : 0,
        semantica:pv ? pv.semantics.violacoes.length : null,
        compressao:pv ? pv.semantics.hierarquiaComprimida : null,
        camadasAlteradas:pv ? pv.alteration.camadasAlteradas : null,
        quaseEmpatados:quase,
        explicacao:gExplainLayoutDecision(esc)
      };
      // ── 3. EQUIVALÊNCIA contra o que o solver entregou ────────────────────────────────
      if(saidaLegado){
        const eq = gShadowEquivalence(saidaLegado, assentado.layers, ctx, fx.canvas);
        rec.equivalencia = eq.nivel; rec.equivalenciaMotivo = eq.motivo;
        rec.regressoes = gShadowRegressions(rec, saidaLegado, assentado.layers, ctx);
      }
    }
  }catch(e){ rec.erro = String(e && e.message || e); }

  /* ── 4. CLASSIFICAÇÃO, CONFIANÇA E O QUE SERIA ENTREGUE ─────────────────────────────────
     ⛔ TAMBÉM DENTRO DE `try`, e isto foi um defeito real que a injeção de falha da §22 pegou:
     este bloco vivia fora do `catch` acima, então uma exceção na confiança ESCAPAVA do shadow
     — exatamente o que a regra absoluta proíbe. Shadow que lança para fora é shadow que
     derruba a criação de arte. Falhando aqui, o registro vira fallback e segue. */
  try{
    const novoSeguro = !!(rec.winner && rec.winner.acoes && rec.winner.seguro !== false
                          && rec.winner.contrato !== false);
    rec.classe = (rec.scoring && rec.scoring.porContrato > 0 && !novoSeguro) ? 'F'
      : (legadoSeguro === true && novoSeguro && rec.equivalencia === 'exact') ? 'A'
      : (legadoSeguro === true && novoSeguro) ? 'B'
      : (legadoSeguro === false && novoSeguro) ? 'C'
      : (legadoSeguro === true && !novoSeguro) ? 'D'
      : (legadoSeguro === false && !novoSeguro) ? 'E' : 'F';
    rec.confianca = gShadowConfidence(rec);
    const ent = gShadowWouldDeliver(rec);
    rec.entrega = ent.decisao; rec.entregaMotivo = ent.motivo;
  }catch(e){
    rec.erro = rec.erro || String(e && e.message || e);
    rec.classe = rec.classe || 'F';
    rec.confianca = { tier:'BLOQUEADO', motivos:['exceção ao classificar: ' + rec.erro], sinais:{} };
    rec.entrega = 'wouldFallbackLegacy';
    rec.entregaMotivo = 'exceção ao classificar';
  }
  rec.ms = Math.round((agora() - t0) * 100) / 100;
  return rec;
}
