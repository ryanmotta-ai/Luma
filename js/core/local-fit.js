/* ══════════════════════════════════════════════════════════════════════════════════════════
   LOCAL FIT CONTRACT — o texto tenta caber na PRÓPRIA CAIXA antes de qualquer composição
   ------------------------------------------------------------------------------------------
   EXPLICIT > INFERRED. Se o designer desenhou uma caixa de texto, essa caixa é informação
   explícita: não precisa ser inferida do grafo de composição. Esta camada responde UMA
   pergunta, sem ambiguidade e sem mover nada:

        este conteúdo cabe na caixa que o designer desenhou?   →  FITS | OVERFLOW

   Fluxo: conteúdo novo → Local Fit → cabe? sim, terminou. não? overflow OBJETIVO (com pixels,
   linhas, corpo e piso) que OUTRA camada decidirá o que fazer. Aqui o fallback NÃO é acionado.

   ⛔ O QUE ESTA CAMADA NÃO FAZ — e a lista é o contrato:
     · não move, não empurra e não redimensiona NENHUM outro layer (nem o próprio: devolve
       valor, nunca escreve na camada recebida);
     · não escala componente, não abre corredor, não usa emergência;
     · não fala com Candidate Search, beam, scoring nem adaptive scale groups — nada disso
       existe mais no repositório;
     · não cria segunda quebra (`gSmartWrapText` é a única) nem segundo piso
       (`gLayoutPisoFonte` em modo NORMAL é o único) nem segunda medida (`gFitTextLayer` é a
       régua do render — medir diferente do render é como prévia e arquivo final divergiram).

   ✅ ESTE É O RUNTIME OFICIAL desde 09/2026. `gLocalFitArte` (§3) é o que a prévia e o
   arquivo final chamam; o Automatic Designer (grammar, graph, components, elasticity, moves,
   candidate search, scoring, rollout) foi REMOVIDO do repositório, e a escada de recomposição
   do `gApplyRelativeAnchors` saiu junto. Não existe mais caminho que empurre terceiros.

   ── As duas invariantes que sustentam tudo ────────────────────────────────────────────────
   1. A CAIXA AUTORADA NUNCA VEM DA GEOMETRIA ADAPTADA. `gApplyRelativeAnchors` trabalha em
      CLONES e move/encolhe `x/y/w/h/fontSize` neles. Ler um clone adaptado como "o que o
      designer desenhou" faria a caixa encolher a cada volta. Ordem de confiança:
      `layoutRef` (o contrato carimbado no vínculo) > `_layoutBase` (a base do solve atual,
      só geometria) > a camada com os carimbos da cascata removidos.
   2. A TINTA AUTORADA É O PISO DA CAIXA. O `w/h` que vem do PSD costuma ser o bbox JUSTO do
      texto original — com `lineHeight` 1.2 a tinta de uma linha pode medir 1px a mais que a
      caixa. Sem isto o próprio texto do designer seria declarado OVERFLOW, que é o oposto do
      ORIGINAL FIRST. Então o espaço disponível é `max(caixa desenhada, tinta autorada)`.
      Consequência boa: "conteúdo igual ao autorado ⇒ FITS" passa a ser verdade por
      CONSTRUÇÃO, não por sorte de arredondamento.

   API: gAuthoredTextBox(layer, opts) · gFitTextToAuthoredBox(layer, conteudo, opts)
   Depende de: 00-config.js (gFitTextLayer, gSmartWrapText, gLayoutPisoFonte, gLineHeightDe,
   _gLayoutMaxLinhas, gStampPisosHierarquia, gLayoutFormaEhPlaca, gLayoutPlacaSegue) e de
   core/auto-layout.js (gLayoutLimpaCarimbos, gLayoutTextoAutorado). Não escreve em nenhum.
   ══════════════════════════════════════════════════════════════════════════════════════════ */

const G_LOCAL_FIT_V = 1;
/* Mesmo degrau de 8% que o teto de linhas do `gFitTextLayer` usa. Inventar um passo diferente
   faria Local Fit e motor pararem em corpos distintos para o mesmo texto. */
const G_LF_DEGRAU = 0.92;
/* Tolerância de 1px — a MESMA do `estourou` do motor (`m.altura > boxH + 1`). Sem ela o
   arredondamento de `Math.round` vira veredito. */
const G_LF_TOL = 1;
/* Teto duro de passos. De 120px até o piso de 8px são ~33 degraus de 8%; 60 é folga larga e
   garante que nenhuma entrada hostil (fonte ausente, métrica zero) vire laço infinito. */
const G_LF_MAX_PASSOS = 60;

let _gLfCanvas = null;
function _gLfCtx(ctxAux){
  if(ctxAux) return ctxAux;
  if(!_gLfCanvas) _gLfCanvas = document.createElement('canvas');
  return _gLfCanvas.getContext('2d');
}

/* Os carimbos transitórios do encaixe. `gLayoutLimpaCarimbos` é o dono desta lista; a cópia
   local só existe para o caso de `auto-layout.js` não ter carregado (suíte enxuta). */
function _gLfLimpa(l){
  if(typeof gLayoutLimpaCarimbos === 'function') return gLayoutLimpaCarimbos(l);
  const c = Object.assign({}, l);
  ['_layoutW','_layoutDx','_layoutMaxLines','_tetoFonte','_entrelinha','_fit','_vTopAuto',
   '_foraDaArte','_layoutInvalido','_layoutBase'].forEach(k => { delete c[k]; });
  return c;
}

/* ════════════════════════════════════════════════════════════════════
   1. AUTHORED TEXT BOX — a formalização do que o designer desenhou
   ════════════════════════════════════════════════════════════════════
   Devolve um objeto de LEITURA: geometria autorada, largura e altura disponíveis, corpo,
   entrelinha, alinhamento, teto de linhas e piso normal. `origemCaixa` diz de onde a
   geometria veio, para que um teste consiga provar que ela não saiu de geometria adaptada.

   @param {object} opts.layers  as camadas da arte (opcional) — só para carimbar os pisos de
                                hierarquia/legibilidade nos CLONES e obter o MESMO piso que a
                                produção usa. Sem elas, o piso cai no padrão do render (50%).
   @param {object} opts.canvas  {w,h} da prancheta, idem. */
function gAuthoredTextBox(layer, opts){
  opts = opts || {};
  if(!layer || layer.type !== 'text') return null;

  const limpo = _gLfLimpa(layer);
  const ref = (layer.layoutRef && layer.layoutRef.w) ? layer.layoutRef : null;
  const base = (!ref && layer._layoutBase) ? layer._layoutBase : null;
  const origemCaixa = ref ? 'layoutRef' : (base ? '_layoutBase' : 'camada');

  /* A camada de PROVA: os campos autorados por cima da camada já sem carimbos. É ela que vai
     ao `gFitTextLayer` — a medida não pode ver nada que uma passada anterior tenha deixado. */
  const camada = Object.assign({}, limpo, {
    x: Math.round((ref ? ref.x : (base ? base.x : limpo.x)) || 0),
    y: Math.round((ref ? ref.y : (base ? base.y : limpo.y)) || 0),
    w: Math.round((ref ? ref.w : (base ? base.w : limpo.w)) || 0),
    h: Math.round((ref ? ref.h : (base ? base.h : limpo.h)) || 0)
  });
  if(ref){
    camada.fontSize = ref.fontSize || camada.fontSize;
    camada.textAlign = ref.textAlign || camada.textAlign;
    camada.textBox = ref.textBox || camada.textBox;
    if(ref.font) camada.font = ref.font;
    if(ref.letterSpacing != null) camada.letterSpacing = ref.letterSpacing;
    if(ref.lineHeight != null) camada.lineHeight = ref.lineHeight;
  }

  const fontSize = Math.max(1, Math.round(camada.fontSize || 24));
  const lineHeight = (typeof gLineHeightDe === 'function') ? gLineHeightDe(camada)
                   : (camada.lineHeight || 1.2);

  /* PISO NORMAL. Nunca emergência: emergência é escala proporcional de componente, que é
     movimento de composição — não pertence ao escopo local. Com as camadas da arte em mãos,
     carimba os pisos em CLONES (nunca nos objetos do chamador) para que o piso local seja
     byte a byte o piso que a produção aplicaria. */
  let camadaPiso = camada;
  if(Array.isArray(opts.layers) && opts.canvas && typeof gStampPisosHierarquia === 'function'){
    const clones = opts.layers.map(o => (o && o.id === layer.id) ? Object.assign({}, camada)
                                                                 : Object.assign({}, o));
    gStampPisosHierarquia(clones, opts.canvas);
    camadaPiso = clones.find(o => o && o.id === layer.id) || camada;
    camada._pisoFonte = camadaPiso._pisoFonte;
    camada._pisoLegivel = camadaPiso._pisoLegivel;
  }
  const piso = (typeof gLayoutPisoFonte === 'function')
    ? Math.min(fontSize, Math.max(8, Math.round(gLayoutPisoFonte(camadaPiso))))
    : Math.max(8, Math.round(fontSize * 0.5));

  /* A TINTA AUTORADA. `layoutRef.ink`/`layoutRef.linhas` já guardam a medida feita no vínculo;
     sem baseline, mede-se o texto autorado provável com a MESMA régua do render. */
  const textoAutorado = (typeof gLayoutTextoAutorado === 'function') ? gLayoutTextoAutorado(layer)
                      : String(layer.content || '');
  let tinta = (ref && ref.ink) ? { w: ref.ink.w || 0, h: ref.ink.h || 0 } : { w:0, h:0 };
  let linhasAutoradas = (ref && ref.linhas) || 0;
  if((!tinta.w && !tinta.h) && textoAutorado && typeof gFitTextLayer === 'function'){
    const f = gFitTextLayer(camada, textoAutorado, _gLfCtx(opts.ctx),
                           { encolher:false, runs: opts.runs || null });
    tinta = { w: Math.round(f.larguraMax || 0), h: Math.round(f.altura || 0) };
    linhasAutoradas = (f.lines && f.lines.length) || 1;
  }
  linhasAutoradas = Math.max(1, linhasAutoradas || 1);

  /* `quebravel` = CAIXA DE PARÁGRAFO (a quebra vem do próprio `gFitTextLayer`). Texto de ponto
     também quebra, mas na largura DESENHADA (`w`), via `_layoutW` — ver o laço da §2. */
  const quebravel = (camada.textBox === 'box') && !camada.vertical;

  const editorial = _gLfMaxLinhasEditorial(layer, camada);

  return {
    v: G_LOCAL_FIT_V,
    id: layer.id, origemCaixa, camada,
    x: camada.x, y: camada.y, w: camada.w, h: camada.h,
    fontSize, lineHeight,
    letterSpacing: (camada.letterSpacing != null) ? camada.letterSpacing : null,
    textAlign: camada.textAlign || 'left',
    textBox: camada.textBox || 'point',
    textTransform: camada.textTransform || null,
    vertical: !!camada.vertical,
    quebravel,
    piso,
    textoAutorado,
    tintaAutorada: tinta,
    linhasAutoradas,
    maxLinhasEditorial: editorial.n,
    maxLinhasDuro: editorial.duro,
    /* O espaço REAL de cada eixo (ver invariante 2 do cabeçalho). */
    larguraDisponivel: Math.max(_gLfLarguraCaixa(camada, fontSize), tinta.w || 0),
    alturaDisponivel: Math.max(camada.h || 0, tinta.h || 0)
  };
}

/* ── TETO DE LINHAS ───────────────────────────────────────────────────────────────────────
   Regra explícita vence sempre; sem ela, infere-se de forma conservadora.

   1. EXPLÍCITO — `layer.maxLines` (número finito > 0). É o único campo que um designer/campo
      pode definir à mão, e o ÚNICO que BLOQUEIA. Os outros dois são preferência.
   2. SEMÂNTICO — `_gLayoutMaxLinhas(camada)`, que já cruza papel compilado (`layoutSemantic`)
      e, como rede, o nome/conteúdo. Título 3, preço 2, CTA 2, legal 8, apoio 4.
      ⛔ `_layoutMaxLines` (com underscore) NÃO entra: é carimbo de runtime, geometria adaptada.
      ⚠ ISTO É PREFERÊNCIA EDITORIAL, NÃO DANO — e a diferença custou caro. O motor antigo
      bloqueava por aqui: 12 dos 14 bloqueios do corpus eram artes INTEIRAS dentro da prancheta,
      sem tocar em nada, barradas só pelo teto semântico. Bloquear por preferência deixa o
      franqueado sem arte E sem saída, porque reduzir linhas exige uma caixa MAIS LARGA — e
      alargar caixa é recompor, que saiu do produto. Então o teto semântico informa, não trava.
   3. GEOMÉTRICO — quantas linhas cabem na altura disponível NO CORPO DAQUELE PASSO:
      `floor(alturaDisponivel / (fontSize × lineHeight))`. Recalculado a cada degrau de
      encolhimento de propósito: um corpo menor cabe em mais linhas, e travar o teto no corpo
      autorado declararia overflow onde o encolhimento resolveu.
   4. PISO — nunca menos que `linhasAutoradas`. Se o designer desenhou em 4 linhas, 4 linhas
      são legais por definição; um teto que reprova o próprio desenho é teto errado.

   O valor final é `max(linhasAutoradas, min(editorial, geométrico))`. */
function _gLfMaxLinhasEditorial(layer, camada){
  const explicito = Number(layer && layer.maxLines);
  if(Number.isFinite(explicito) && explicito > 0) return { n: Math.round(explicito), duro: true };
  const n = (typeof _gLayoutMaxLinhas === 'function') ? _gLayoutMaxLinhas(camada) : 4;
  return { n, duro: false };
}

function _gLfMaxLinhas(box, fs){
  const geo = Math.max(1, Math.floor((box.alturaDisponivel || 0) / Math.max(1, fs * box.lineHeight)));
  return Math.max(box.linhasAutoradas, Math.min(box.maxLinhasEditorial, geo));
}

/* ── LARGURA DA CAIXA ─────────────────────────────────────────────────────────────────────
   ESPELHO da conta do `gFitTextLayer` (`js/00-config.js`, bloco "4) ENCOLHER"): caixa de
   parágrafo desconta o padding de 0,08em de cada lado; texto de ponto compara com a largura
   crua. Duas contas para a mesma pergunta é como medida e desenho divergiram no passado —
   quem mexer lá mexe aqui junto. */
function _gLfLarguraCaixa(camada, fs){
  const largura = Math.round(camada.w || 0);
  if(camada.textBox !== 'box') return largura;
  const pad = Math.round(fs * 0.08);
  return Math.max(10, largura - pad * 2);
}
function _gLfLarguraDisponivel(box, fs){
  return Math.max(_gLfLarguraCaixa(box.camada, fs), box.tintaAutorada.w || 0);
}

/* ════════════════════════════════════════════════════════════════════
   2. LOCAL FIT — a escada conservadora
   ════════════════════════════════════════════════════════════════════
   1. corpo autorado  → 2. wrap semântico → 3. linhas novas dentro do teto
   → 4. shrink progressivo → 5. parar no piso normal → 6. declarar overflow.

   Os degraus 1–3 são o MESMO passo de medida: `gFitTextLayer` no corpo autorado já aplica
   `gSmartWrapText` (com unidades semânticas, preço, preposição órfã e caixa alta) quando a
   camada é caixa de parágrafo. Fazer disso três chamadas seria criar uma segunda quebra —
   exatamente o que o contrato proíbe. Eles se DISTINGUEM no resultado (`degrau`), não na
   execução.

   @returns {object} { status:'fits'|'overflow', degrau, intacto, changed, text, lines,
                       fontSize, lineHeight, overflowX, overflowY, diagnostics } */
function gFitTextToAuthoredBox(layer, conteudo, opts){
  opts = opts || {};
  const box = gAuthoredTextBox(layer, opts);
  if(!box) return null;

  const ctx = _gLfCtx(opts.ctx);
  const texto = String(conteudo == null ? '' : conteudo);
  const passos = [];
  let fs = box.fontSize, ultimo = null;

  /* CAIXA DO ILLUSTRATOR. Texto de PONTO também quebra dentro da caixa que o designer
     desenhou (`w/h` da camada): em cada corpo tenta primeiro a linha única (ORIGINAL FIRST —
     o texto autorado nunca muda de desenho), depois quebra na largura da caixa, e só se a
     quebra não couber na altura desce o corpo. A quebra usa `_layoutW = w`, que o
     `gFitTextLayer` e o render já honram — nada muda de lugar, a largura é a desenhada.
     (Decisão do Ryan, 22/09/2026: "vai pulando pra linha de baixo; lotou, diminui".) */
  const podeQuebrarPonto = !box.quebravel && !box.vertical && (box.w || 0) > 0;
  const prova_ = (fs, layoutW) => {
    /* `fontSize` cru, nunca `_tetoFonte`: o teto é carimbo da cascata e a prova tem que ser
       lida como camada autorada de outro corpo, não como camada já adaptada. */
    const prova = Object.assign({}, box.camada, { fontSize: fs });
    if(layoutW != null) prova._layoutW = layoutW;
    const f = gFitTextLayer(prova, texto, ctx, { encolher:false, runs: opts.runs || null });
    const linhas = (f.lines || []).length;
    const dispX = _gLfLarguraDisponivel(box, fs);
    const dispY = box.alturaDisponivel;
    const maxLinhas = _gLfMaxLinhas(box, fs);
    const overflowX = Math.max(0, Math.round((f.larguraMax || 0) - dispX));
    const overflowY = Math.max(0, Math.round((f.altura || 0) - dispY));
    /* Só o teto EXPLÍCITO reprova. O semântico entra no laudo e não no veredito (ver §1). */
    const excedeuLinhas = box.maxLinhasDuro && linhas > maxLinhas;
    const cabe = overflowX <= G_LF_TOL && overflowY <= G_LF_TOL && !excedeuLinhas;
    return { f, fs, linhas, maxLinhas, overflowX, overflowY, dispX, dispY, cabe,
             layoutW: (layoutW != null && linhas > 1) ? layoutW : null };
  };

  for(let i = 0; i < G_LF_MAX_PASSOS; i++){
    let u = prova_(fs, null);
    /* Só a LARGURA justifica quebrar: se faltou altura, linha a mais só piora. */
    if(!u.cabe && podeQuebrarPonto && u.overflowX > G_LF_TOL){
      const q = prova_(fs, box.w);
      if(q.linhas > u.linhas) u = q;
    }
    ultimo = Object.assign(u, { passo:i });
    passos.push({ fontSize:fs, linhas:u.linhas, maxLinhas:u.maxLinhas,
                  overflowX:u.overflowX, overflowY:u.overflowY });

    if(u.cabe){
      return _gLfResultado(box, ultimo, passos, 'fits', opts);
    }
    if(fs <= box.piso) break;
    /* FAIL SAFE: chegou ao piso normal, PARA. Continuar descendo é o que transforma "não
       coube" em "saiu ilegível" — e a decisão do que fazer daqui é de outra camada. */
    const prox = Math.max(box.piso, Math.floor(fs * G_LF_DEGRAU));
    if(prox === fs) break;
    fs = prox;
  }
  return _gLfResultado(box, ultimo, passos, 'overflow', opts);
}

function _gLfResultado(box, u, passos, status, opts){
  const f = u.f;
  const encolheu = u.fs !== box.fontSize;
  const intacto = status === 'fits' && !encolheu && !u.layoutW && u.linhas <= box.linhasAutoradas;
  const degrau = status === 'overflow' ? 'piso'
               : intacto ? 'original'
               : encolheu ? 'shrink' : 'wrap';

  const motivos = [];
  if(u.overflowX > G_LF_TOL) motivos.push('largura excedida em ' + u.overflowX + 'px');
  if(u.overflowY > G_LF_TOL) motivos.push('altura excedida em ' + u.overflowY + 'px');
  if(u.linhas > u.maxLinhas) motivos.push('precisa de ' + u.linhas + ' linhas e o teto é ' + u.maxLinhas);

  return {
    v: G_LOCAL_FIT_V,
    status, degrau, intacto, changed: encolheu,
    /* Largura de quebra do texto de PONTO (null quando não quebrou). O render lê `_layoutW`. */
    layoutW: u.layoutW || null,
    text: f.text, lines: (f.lines || []).slice(),
    fontSize: u.fs, lineHeight: box.lineHeight,
    overflowX: u.overflowX, overflowY: u.overflowY,
    diagnostics: {
      motivo: motivos.length ? motivos.join(' · ') : 'cabe na caixa autorada',
      origemCaixa: box.origemCaixa,
      larguraDisponivel: u.dispX, larguraNecessaria: Math.round(f.larguraMax || 0),
      alturaDisponivel: u.dispY,  alturaNecessaria: Math.round(f.altura || 0),
      linhas: u.linhas, maxLinhas: u.maxLinhas, linhasAutoradas: box.linhasAutoradas,
      fontSizeAutorado: box.fontSize, piso: box.piso, noPiso: u.fs <= box.piso,
      quebravel: box.quebravel, degraus: passos.length, passos,
      placa: _gLfPlaca(box, u, opts)
    }
  };
}

/* ── PLACA INTERNA (diagnóstico, nunca movimento) ─────────────────────────────────────────
   Quando a placa/selo faz parte do próprio campo, o encaixe local pode mudar a tinta e a
   placa desenhada deixar de abraçá-la. Isso é informação útil — e é SÓ informação: reposicionar
   a placa é recompor, e recompor não é escopo local. Usa as primitivas estáveis que o motor já
   tem (`gLayoutFormaEhPlaca` decide se a forma é placa; `gLayoutPlacaSegue` diz qual seria a
   geometria coerente), sem escrever em nenhuma das duas camadas. */
function _gLfPlaca(box, u, opts){
  const p = opts && opts.placa;
  if(!p || typeof gLayoutFormaEhPlaca !== 'function') return null;
  const pRect = { x:p.x||0, y:p.y||0, w:p.w||0, h:p.h||0 };
  const tintaRef = { x:box.x, y:box.y, w:box.tintaAutorada.w||0, h:box.tintaAutorada.h||0 };
  if(!gLayoutFormaEhPlaca(p, pRect, tintaRef)) return null;
  const tintaNova = { x:box.x, y:box.y,
                      w:Math.round(u.f.larguraMax||0), h:Math.round(u.f.altura||0) };
  const cabe = tintaNova.w <= pRect.w + G_LF_TOL && tintaNova.h <= pRect.h + G_LF_TOL;
  const sugerida = (typeof gLayoutPlacaSegue === 'function')
    ? gLayoutPlacaSegue({ refW:tintaRef.w, refH:tintaRef.h,
                          padE:(tintaRef.x-pRect.x), padT:(tintaRef.y-pRect.y),
                          padD:(pRect.x+pRect.w)-(tintaRef.x+tintaRef.w),
                          padB:(pRect.y+pRect.h)-(tintaRef.y+tintaRef.h) }, tintaNova, u.fs)
    : null;
  return { id:p.id, mismatch: !cabe, placa: pRect, tinta: tintaNova, sugerida,
           motivo: cabe ? 'a placa ainda abraça a tinta'
                        : 'a tinta passou da placa desenhada — diagnóstico apenas, nada foi movido' };
}

/* ════════════════════════════════════════════════════════════════════
   3. LOCAL FIT DA ARTE — o runtime oficial
   ════════════════════════════════════════════════════════════════════
   A §2 responde por UMA camada. Esta responde pela ARTE inteira, e é o que a prévia e a
   exportação chamam. O contrato é o mesmo, escalado:

     conteúdo novo → caixa autorada de cada texto → cabe? → render
                                                  → não cabe no piso? → CONTENT_TOO_LARGE

   ⛔ O QUE ELA NÃO FAZ (e é o motivo de existir): não empurra, não reancora, não abre corredor,
   não escala componente, não gera candidato, não pontua, não escolhe. Terceiros NUNCA mudam.
   A única exceção é a do contrato: a PLACA explicitamente ligada ao próprio texto acompanha a
   tinta dele, pela primitiva já validada (`_gInferirPlacas` + `gLayoutPlacaSegue`).

   ORIGINAL FIRST ABSOLUTO: quando o conteúdo cabe como o designer desenhou, a camada sai daqui
   SEM UM ÚNICO CARIMBO — é o mesmo objeto que a arte publicada produz. Não é tolerância de
   comparação, é ausência de escrita.

   COMO O RESULTADO CHEGA AO DESENHO: o único carimbo é `_tetoFonte`. `gFitTextLayer` (a régua
   do render, em `00-config.js`) lê `min(_tetoFonte, fontSize)` como corpo de partida, então
   prévia e PNG desenham no corpo que o Local Fit decidiu — sem segundo motor e sem segunda
   medida. É daí que sai a paridade do item 13.

   @returns {object} { layers, result } — `result` mantém as chaves que a prévia, a telemetria
   e o Estúdio já liam (`status`, `invalid`, `invalidIds`, `changes`, `requiresAdaptation`) e
   acrescenta `campos` (o laudo por campo) e `bloqueios` (o payload de CONTENT_TOO_LARGE). */
function gLocalFitArte(layers, opts){
  opts = opts || {};
  const cv = opts.canvas || null;
  const dados = opts.dados || {};
  const defaults = (opts.defaults !== undefined && opts.defaults !== null) ? opts.defaults
                 : ((typeof gVarDefaults === 'function') ? gVarDefaults() : null);
  const ctx = _gLfCtx(opts.ctx);
  const out = (layers || []).map(l => Object.assign({}, l));
  const _t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;

  /* As MESMAS preparações que a cascata fazia antes de medir — baseline autorado, papel
     semântico e piso de hierarquia. Elas não movem nada: descrevem o desenho. Sem elas o piso
     do Local Fit não seria o piso da produção, e o encaixe pararia no corpo errado. */
  if(typeof gEnsureLayoutBaseline === 'function') gEnsureLayoutBaseline(out, ctx);
  if(typeof gCompileLayoutRoles === 'function' && out.some(l => l && l.layoutSemantic == null))
    gCompileLayoutRoles(out, cv);
  if(typeof gStampPisosHierarquia === 'function') gStampPisosHierarquia(out, cv);

  /* PLACAS (item 9). `_gInferirPlacas` é a régua estrutural já validada: retângulo ou pill
     horizontal, atrás no z-order, abraçando a tinta pelos quatro lados, no máximo 6× a área do
     texto, UM texto só e com campo. Ela carimba `_placa` na FORMA, dizendo de qual texto a
     forma é placa. Nenhuma outra camada é tocada. */
  const baseVisual = (typeof _gLayoutBaseVisual === 'function')
    ? _gLayoutBaseVisual(out, defaults, ctx) : {};
  if(typeof _gInferirPlacas === 'function') _gInferirPlacas(out, { canvas: cv }, baseVisual);

  const campos = [], bloqueios = [], changes = [], invalidIds = [];
  let encolheu = false, quebrou = false;

  out.forEach(l => {
    if(!l || l.type !== 'text') return;
    if(typeof _gLayoutVisivel === 'function' && !_gLayoutVisivel(l)) return;
    /* Texto FIXO é do designer: ele escreveu, ele mediu, ele publicou. Encaixar o que o
       franqueado não pode mudar só produziria bloqueio que ninguém consegue resolver. */
    if(typeof _gLayoutTemCampo === 'function' && !_gLayoutTemCampo(l)) return;

    const conteudo = (typeof gInterpolate === 'function')
      ? gInterpolate(l.content, dados, { onEmpty:'remove', defaults })
      : String(l.content || '');
    /* CAMPO VAZIO NÃO É ERRO (item 14). Não encaixa, não bloqueia, não adapta nada: a camada
       segue exatamente como está e quem decide se ela aparece é o render. */
    if(!String(conteudo).trim()){ campos.push({ id:l.id, status:'vazio', degrau:'vazio' }); return; }

    /* Os MESMOS runs do render (split de preço: inteiro, símbolo e centavos em corpos
       diferentes). Medir sem eles é medir outro texto. */
    const runs = (typeof gBuildVirtualRuns === 'function')
      ? gBuildVirtualRuns(l, dados, 1, defaults) : null;
    const placa = out.find(p => p && p._placa && p._placa.alvo === l.id) || null;

    const r = gFitTextToAuthoredBox(l, conteudo, { layers: out, canvas: cv, ctx, runs, placa });
    if(!r) return;

    campos.push({ id:l.id, status:r.status, degrau:r.degrau, fontSize:r.fontSize,
                  fontSizeAutorado:r.diagnostics.fontSizeAutorado, linhas:r.lines.length,
                  overflowX:r.overflowX, overflowY:r.overflowY, piso:r.diagnostics.piso });

    if(r.status === 'overflow'){
      l._layoutInvalido = true;
      invalidIds.push(l.id);
      /* FAIL SAFE (item 8): o payload é OBJETIVO — quem travou, por quantos pixels, quantas
         linhas precisaria e onde o piso parou. Sem LLM, sem estimativa por caractere. */
      bloqueios.push({ status:'CONTENT_TOO_LARGE', fieldId:l.id,
                       campos:(typeof gLayoutCamposDe === 'function') ? gLayoutCamposDe(l) : [],
                       overflowX:r.overflowX, overflowY:r.overflowY,
                       requiredLines:r.lines.length, maxLines:r.diagnostics.maxLinhas,
                       fontSize:r.fontSize, minimumFontSize:r.diagnostics.piso,
                       motivo:r.diagnostics.motivo });
    }

    /* ORIGINAL FIRST ABSOLUTO: coube como desenhado → nenhum carimbo, nenhum `change`. */
    if(r.degrau === 'original') return;

    if(r.degrau === 'shrink' || r.degrau === 'piso'){ encolheu = true; }
    if(r.degrau === 'wrap'){ quebrou = true; }
    if(r.fontSize !== r.diagnostics.fontSizeAutorado) l._tetoFonte = r.fontSize;
    if(r.layoutW) l._layoutW = r.layoutW;
    /* TEXTO NÃO SOBE. Enquanto cabe na caixa segue centralizado (é o desenho do designer);
       quando passa dela, ancora no topo e cresce só para baixo — senão metade do excesso come
       a margem que o designer deixou em cima. Mesma regra do `_gStampVTop` da cascata antiga,
       agora escrita por quem de fato mediu o encaixe. */
    if(typeof _gStampVTop === 'function') _gStampVTop(l, r.diagnostics.alturaNecessaria);
    changes.push({ id:l.id, geometry:false, typography:true, moved:false, resized:false });

    /* A PLACA ACOMPANHA — a única geometria que o Local Fit escreve, e só na forma que o
       próprio texto carrega. `gLayoutPlacaSegue` é a conta única do card. */
    if(placa && typeof gLayoutPlacaSegue === 'function' && typeof gInkRect === 'function'){
      const sim = { altura:r.diagnostics.alturaNecessaria, larguraMax:r.diagnostics.larguraNecessaria,
                    lines:r.lines, fontSize:r.fontSize, text:r.text };
      const tinta = gInkRect(Object.assign({}, l, { fontSize:r.fontSize }), sim);
      const g = gLayoutPlacaSegue(placa._placa, tinta, r.fontSize);
      if(g && (placa.x !== g.x || placa.y !== g.y || placa.w !== g.w || placa.h !== g.h)){
        placa.x = g.x; placa.y = g.y; placa.w = g.w; placa.h = g.h;
        /* `placaDe` diz DE QUEM esta forma é placa. É o que permite a um teste provar que a
           única geometria escrita foi a da exceção do contrato, e não "alguma geometria". */
        changes.push({ id:placa.id, placaDe:l.id, geometry:true, typography:false,
                       moved:true, resized:true });
      }
    }
  });

  out.forEach(l => { if(l) delete l._placa; });
  const _ms = _t0 ? (performance.now() - _t0) : null;
  if(typeof gLayoutRegistraTempo === 'function' && _ms != null) gLayoutRegistraTempo(_ms);

  const invalid = invalidIds.length > 0;
  const status = invalid ? 'overflow' : (encolheu ? 'shrunk' : (quebrou ? 'wrapped' : 'original'));
  return {
    layers: out,
    result: { status, adapted: changes.length > 0, invalid, invalidIds,
              requiresAdaptation: changes.length > 0 || invalid, forced:false,
              changes, campos, bloqueios,
              meta: { ms: (_ms != null) ? Math.round(_ms * 10) / 10 : null },
              diagnostico: bloqueios[0] || null }
  };
}

/* ════════════════════════════════════════════════════════════════════
   4. DIAGNÓSTICO ACIONÁVEL — "cabem até N caracteres aqui"
   ════════════════════════════════════════════════════════════════════
   Bloquear com "não cabe" deixa o franqueado sem saída: ele não sabe se faltou UMA palavra ou
   metade da frase. O limite sai de busca binária sobre o PRÓPRIO Local Fit do campo culpado —
   nada de estimativa por caractere, que erraria com fonte proporcional.

   Custo: até ~12 encaixes de UMA camada. A versão anterior re-rodava o solver inteiro (até 8
   solves da arte toda); esta é ordens de grandeza mais barata. Mesmo assim roda só no caminho
   de FALHA (exportação bloqueada), nunca na digitação. */

/* Corta na PALAVRA, não no caractere: um limite que parte a última palavra no meio parece bug
   para quem lê, e o número que o franqueado vê tem que ser o número que ele consegue digitar. */
function gLocalFitCorta(s, n){
  const t = String(s || '');
  if(n >= t.length) return t;
  const bruto = t.slice(0, Math.max(0, n));
  const corte = bruto.lastIndexOf(' ');
  return (corte > n * 0.6 ? bruto.slice(0, corte) : bruto).trim();
}

/* Motor único de rótulo (`gFieldLabel`, em 00-config.js). Nome técnico (`precoPor`) nunca
   aparece para quem lê. */
function gLocalFitRotulo(nome){
  if(typeof gFieldLabel === 'function') return gFieldLabel(nome);
  if(typeof dVars !== 'undefined' && Array.isArray(dVars)){
    const v = dVars.find(x => x && x.name === nome);
    if(v && v.label) return v.label;
  }
  return 'este campo';
}

function gLocalFitMensagem(rotulo, atual, limite){
  if(!limite) return 'O texto de “' + rotulo + '” não cabe nesta arte. Escolha outro material para este conteúdo.';
  return 'O texto de “' + rotulo + '” é longo demais para esta arte. Cabem até ' + limite
       + ' caracteres aqui — hoje tem ' + atual + '.';
}

/**
 * @param {Array}  layers  as camadas JÁ passadas por `gLocalFitArte` (é onde mora o culpado)
 * @param {object} result  o `result` devolvido por `gLocalFitArte`
 * @returns {{campo,rotulo,atual,limite,mensagem}|null} `null` quando não há campo identificável
 *          (arte impossível por desenho, não por conteúdo) — aí vale a mensagem genérica.
 */
function gLocalFitDiagnostico(layers, result, dados, opts){
  try{
    const bloqueio = result && result.bloqueios && result.bloqueios[0];
    if(!bloqueio) return null;
    const alvo = (layers || []).find(l => l && l.id === bloqueio.fieldId);
    if(!alvo) return null;
    const campos = bloqueio.campos || [];
    if(!campos.length) return null;
    // Com mais de um campo na mesma camada, o culpado é o de valor mais longo.
    const campo = campos.slice().sort((a, b) =>
      String((dados && dados[b]) || '').length - String((dados && dados[a]) || '').length)[0];
    const valor = String((dados && dados[campo]) != null ? dados[campo] : '');
    const rotulo = gLocalFitRotulo(campo);
    if(valor.length < 3) return { campo, rotulo, atual: valor.length, limite: 0,
      mensagem: 'A arte não tem espaço seguro para “' + rotulo + '” neste material. Escolha outro material para este conteúdo.' };

    const o = opts || {};
    const defaults = (o.defaults != null) ? o.defaults
                   : ((typeof gVarDefaults === 'function') ? gVarDefaults() : null);
    const cabe = (n) => {
      const d = Object.assign({}, dados);
      d[campo] = gLocalFitCorta(valor, n);
      const texto = (typeof gInterpolate === 'function')
        ? gInterpolate(alvo.content, d, { onEmpty:'remove', defaults }) : d[campo];
      const runs = (typeof gBuildVirtualRuns === 'function')
        ? gBuildVirtualRuns(alvo, d, 1, defaults) : null;
      const r = gFitTextToAuthoredBox(alvo, texto,
        { layers, canvas:o.canvas || null, ctx:o.ctx, runs });
      return !!r && r.status === 'fits';
    };

    let baixo = 1, alto = valor.length, limite = 0, voltas = 0;
    while(baixo <= alto && voltas++ < 8 && !limite){
      const meio = Math.floor((baixo + alto) / 2);
      if(cabe(meio)){ limite = meio; baixo = meio + 1; } else alto = meio - 1;
    }
    // Refina para cima: o meio da busca costuma ser conservador e prometer menos do que cabe.
    while(limite && voltas++ < 12 && limite < valor.length && cabe(limite + 1)) limite++;
    return { campo, rotulo, atual: valor.length, limite,
             mensagem: gLocalFitMensagem(rotulo, valor.length, limite) };
  }catch(e){ return null; }
}
