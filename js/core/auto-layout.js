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
function gLayoutPisoDoModo(camadas, l, modo, grupo){
  if(!l || typeof gLayoutPisoFonte !== 'function') return 8;
  if(modo !== 'emergency') return gLayoutPisoFonte(l, false);
  const legivel = gLayoutPisoFonte(l, true);
  const hier = (typeof gLayoutPisoHierarquiaExterno === 'function')
    ? gLayoutPisoHierarquiaExterno(camadas || [], l, grupo || [l.id], false) : 0;
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
  const vivos = camadas || [...ctx._camada.values()];
  const idx = new Map(vivos.map(l => [l.id, l]));
  const grupo = new Set(c.membros);
  let degraus = 0;
  const pisos = [];
  c.membros.forEach(id => {
    const autorada = ctx._camada.get(id);
    const vivo = idx.get(id);
    if(!autorada || autorada.type !== 'text') return;
    const medida = Object.assign({}, autorada, { _tetoFonte: vivo && vivo._tetoFonte });
    const atual = Math.round(gLayoutCorpoAtual(medida));
    const piso = Math.round(gLayoutPisoDoModo(vivos, medida, modo === 'emergency' ? 'emergency' : 'normal', grupo));
    pisos.push({ id, atual, piso });
    if(piso < atual) degraus = Math.max(degraus, Math.ceil(Math.log(piso / atual) / Math.log(0.92)));
  });
  if(!degraus) return _gCapNao('componente-no-piso', { pisos });
  /* O teto de 0,35 é o mesmo da escada (`escalaGlobal = max(0.35, escalaAtual*0.92)`): abaixo
     disso o motor não desce, e prometer degraus que ele não tem seria inventar escada. */
  const tetoGlobal = Math.ceil(Math.log(0.35) / Math.log(0.92));
  return _gCapOk('componente-pode-descer', { degraus: Math.min(degraus, tetoGlobal),
                                             membros:c.membros.length, pisos });
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
const G_PROBLEMA_ACOES = {
  'text-overflow':      [{a:'wrap-text',alvo:'alvo'},{a:'restore-tracking',alvo:'alvo'},
                         {a:'compress-line-height',alvo:'alvo'},{a:'shrink-text',alvo:'alvo'}],
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
                            impactLevel:null, params:{}, reason:'' }, extra || {});
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
  const raiz = problem.rootId || null;
  const ordem = G_PROBLEMA_ACOES[problem.tipo] || [];
  const culpadoId = (problem.detalhe && problem.detalhe.culpado) || alvo;
  const out = [];

  ordem.forEach((passo, i) => {
    const acaoId = passo.a;
    const meta = G_LAYOUT_ACOES[acaoId];
    if(!meta) return;
    // Vítima ou culpado — ver `G_PROBLEMA_ACOES`.
    const alvoId = passo.alvo === 'culpado' ? culpadoId : alvo;
    const nAlvo = ctx._no.get(alvoId), lAlvo = _camada(alvoId);
    if(!nAlvo || !lAlvo) return;

    if(meta.alvo === 'component'){
      const c = gComponentOfNode(ctx.components, alvoId);
      if(!c) return;
      const portao = gLayoutCanAttempt({ ctx, action:acaoId, targetId:c.id, rootId:null });
      if(!portao.permitido) return;
      /* ⚠ O MODO VIAJA NO DESCRITOR. A escala proporcional é o degrau de emergência da escada,
         mas isso não autoriza a busca a usar o piso de emergência no fluxo NORMAL — seria
         emergência por padrão, exatamente o que esta fase separa. O piso sai do modo. */
      const esc = gLayoutCanEmergencyScale(ctx, c.id, _estadoVivo, emergencia ? 'emergency' : 'normal');
      if(!esc.permitido) return;                 // já está no piso do modo: a ação não existe
      out.push(_gAcao(acaoId, null, { componentId:c.id, rootId:raiz, ordem:i,
        params:{ fator:0.92, modo:emergencia ? 'emergency' : 'normal', degraus:esc.degraus },
        reason:meta.degrau }));
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
      params:params, reason:meta.degrau }));
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
      const c = ctx && gComponentById(ctx.components, action.componentId);
      if(!c){ r.diagnostics.erro = 'componente-inexistente'; break; }
      /* ESCALA PROPORCIONAL — todo o componente desce na mesma escala, e a hierarquia DENTRO
         dele fica protegida por isso. O piso vem do MODO:
         · normal    → `gLayoutPisoFonte(l,false)`, metade do corpo desenhado;
         · emergency → legibilidade MAIS o piso de hierarquia EXTERNO (quem ficou de fora do
           componente e era menor não pode ser ultrapassado) — a trava que o solver aplica no
           degrau `relaxou`.
         ⚠ Antes desta fase esta ação usava o piso de emergência SEMPRE. Era emergência por
         padrão dentro do fluxo normal, e apagava justamente a separação que a Fase 5.9 mede. */
      const modoEsc = p.modo === 'emergency' ? 'emergency' : 'normal';
      const grupo = new Set(c.membros);
      const alvos = [];
      c.membros.forEach(id => {
        const m = idx.get(id);
        if(!m || m.type !== 'text') return;
        const atual = Math.round(gLayoutCorpoAtual(m));
        const piso = gLayoutPisoDoModo(camadas, m, modoEsc, grupo);
        const novo = Math.max(piso, Math.floor(atual * p.fator));
        if(novo < atual){ m._tetoFonte = novo; marca(id); alvos.push({ id, de:atual, para:novo, piso }); }
      });
      r.typographyChanged = alvos.length > 0;
      r.diagnostics = { fator:p.fator, modo:modoEsc, membros:alvos, componente:c.id, tipo:c.tipo };
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
    searchMode:'normal', causeKey:null,
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
  if(!ctx) return { original:null, solved:[], partial:[], invalid:[],
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
    diagnostics: Object.assign({}, normal.diagnostics, {
      modo: emerg.solved.length ? 'emergency' : 'normal',
      firstSolvedDepth: emerg.diagnostics.firstSolvedDepth,
      firstSolvedMode: emerg.solved.length ? 'emergency' : null,
      generated: normal.diagnostics.generated + emerg.diagnostics.generated,
      expanded: normal.diagnostics.expanded + emerg.diagnostics.expanded,
      deduplicated: normal.diagnostics.deduplicated + emerg.diagnostics.deduplicated,
      pruned: normal.diagnostics.pruned + emerg.diagnostics.pruned,
      maxDepthReached: Math.max(normal.diagnostics.maxDepthReached, emerg.diagnostics.maxDepthReached),
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
    raiz.status = 'solved';
    diag.firstSolvedDepth = 0; diag.firstSolvedMode = modo;
    return { original:raiz, solved:[raiz], partial:[], invalid:[], diagnostics:diag };
  }

  const vistos = new Set([raiz.signature]);
  const solved = [], partial = [], invalid = [];
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

        /* ── ESCALADA DE IMPACTO ── começa LOCAL e só abre o raio quando o nível atual NÃO
           PRODUZ MOVIMENTO NENHUM. O nível 4 (a arte inteira) fica FORA: é outra fase. */
        let acoes = [];
        for(let nivel = 0; nivel <= 3 && !acoes.length; nivel++){
          acoes = gGenerateLayoutActions(ctx, Object.assign({}, alvo,
            { rootId: culpado || pai.rootId || alvo.targetId, impactLevel:nivel }),
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
          const jaUsou = pai.actions.filter(x => x.id === acao.id).length;
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
              causeKey: grupo.key, searchMode: modo,
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

            if(!restantes.length){
              filho.status = 'solved'; solved.push(filho); doDepth.solved++;
              if(diag.firstSolvedDepth == null){ diag.firstSolvedDepth = filho.depth; diag.firstSolvedMode = modo; }
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
              const cand = gGenerateLayoutActions(ctx, Object.assign({}, gMesma.problems[0],
                { rootId: gMesma.culpritId || pai.rootId || alvo.targetId, impactLevel:3 }),
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
  solved.sort(_ord); partial.sort(_ord); invalid.sort(_ord);
  [].concat([raiz], solved, partial, invalid).forEach(c => {
    delete c.diagnostics.lista; delete c.diagnostics.grupos; delete c._medido; delete c._resolvidas;
  });
  return { original:raiz, solved, partial, invalid, diagnostics:diag };
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
function gLayoutCandidateSafety(cand, ctx){
  const r = gSettleCandidateState(cand, ctx);
  const estado = { layers:r.layers, solveState:cand.solveState };
  const problemas = gDetectLayoutProblems(estado, ctx);
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
    out.causasTocadas = r.solved.length ? (r.solved[0].causasTocadas || []).length
                      : (r.partial.length ? (r.partial[r.partial.length - 1].causasTocadas || []).length : 0);
    out.causasReabertas = [].concat(r.solved, r.partial)
      .filter(c => (c.causasReabertas || []).length).length;
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
