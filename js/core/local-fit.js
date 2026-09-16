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
     · não fala com Candidate Search, beam, scoring, adaptive scale groups nem
       `gLayoutEscolherAlternativa`;
     · não cria segunda quebra (`gSmartWrapText` é a única) nem segundo piso
       (`gLayoutPisoFonte` em modo NORMAL é o único) nem segunda medida (`gFitTextLayer` é a
       régua do render — medir diferente do render é como prévia e arquivo final divergiram).

   ⚠ NÃO ESTÁ NO `index.html` DE PROPÓSITO. Enquanto for shadow-only, nenhum byte de produção
   depende disto; só as suítes de `tests/` carregam o arquivo. Ligar na produção é decisão de
   outra tarefa — e aí sim entra o `?v=N`.

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

/* Os carimbos transitórios da cascata. `gLayoutLimpaCarimbos` é o dono desta lista; a cópia
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
     ao `gFitTextLayer` — a medida não pode ver nada que a cascata tenha deixado para trás. */
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
    ? Math.min(fontSize, Math.max(8, Math.round(gLayoutPisoFonte(camadaPiso, false))))
    : Math.max(8, Math.round(fontSize * 0.5));

  /* A TINTA AUTORADA. `layoutRef.ink`/`layoutRef.linhas` já guardam a medida feita no vínculo;
     sem baseline, mede-se o texto autorado provável com a MESMA régua do render. */
  const textoAutorado = (typeof gLayoutTextoAutorado === 'function') ? gLayoutTextoAutorado(layer)
                      : String(layer.content || '');
  let tinta = (ref && ref.ink) ? { w: ref.ink.w || 0, h: ref.ink.h || 0 } : { w:0, h:0 };
  let linhasAutoradas = (ref && ref.linhas) || 0;
  if((!tinta.w && !tinta.h) && textoAutorado && typeof gFitTextLayer === 'function'){
    const f = gFitTextLayer(camada, textoAutorado, _gLfCtx(opts.ctx), { encolher:false });
    tinta = { w: Math.round(f.larguraMax || 0), h: Math.round(f.altura || 0) };
    linhasAutoradas = (f.lines && f.lines.length) || 1;
  }
  linhasAutoradas = Math.max(1, linhasAutoradas || 1);

  /* Quebrar é privilégio de CAIXA DE PARÁGRAFO. Texto de ponto não vira caixa aqui: criar uma
     largura de quebra que o designer não desenhou é movimento de composição (é o que o
     `_layoutW` do guardião faz), e isso é da outra camada. Texto de ponto só encolhe. */
  const quebravel = (camada.textBox === 'box') && !camada.vertical;

  const maxLinhasEditorial = _gLfMaxLinhasEditorial(layer, camada);

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
    maxLinhasEditorial,
    /* O espaço REAL de cada eixo (ver invariante 2 do cabeçalho). */
    larguraDisponivel: Math.max(_gLfLarguraCaixa(camada, fontSize), tinta.w || 0),
    alturaDisponivel: Math.max(camada.h || 0, tinta.h || 0)
  };
}

/* ── TETO DE LINHAS ───────────────────────────────────────────────────────────────────────
   Regra explícita vence sempre; sem ela, infere-se de forma conservadora.

   1. EXPLÍCITO — `layer.maxLines` (número finito > 0). É o único campo que um designer/campo
      pode definir à mão e ele manda em tudo.
   2. SEMÂNTICO — `_gLayoutMaxLinhas(camada)`, que já cruza papel compilado (`layoutSemantic`)
      e, como rede, o nome/conteúdo. Título 3, preço 2, CTA 2, legal 8, apoio 4.
      ⛔ `_layoutMaxLines` (com underscore) NÃO entra: é carimbo de runtime, geometria adaptada.
   3. GEOMÉTRICO — quantas linhas cabem na altura disponível NO CORPO DAQUELE PASSO:
      `floor(alturaDisponivel / (fontSize × lineHeight))`. Recalculado a cada degrau de
      encolhimento de propósito: um corpo menor cabe em mais linhas, e travar o teto no corpo
      autorado declararia overflow onde o encolhimento resolveu.
   4. PISO — nunca menos que `linhasAutoradas`. Se o designer desenhou em 4 linhas, 4 linhas
      são legais por definição; um teto que reprova o próprio desenho é teto errado.

   O valor final é `max(linhasAutoradas, min(editorial, geométrico))`. */
function _gLfMaxLinhasEditorial(layer, camada){
  const explicito = Number(layer && layer.maxLines);
  if(Number.isFinite(explicito) && explicito > 0) return Math.round(explicito);
  if(typeof _gLayoutMaxLinhas === 'function') return _gLayoutMaxLinhas(camada);
  return 4;
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

  for(let i = 0; i < G_LF_MAX_PASSOS; i++){
    /* `fontSize` cru, nunca `_tetoFonte`: o teto é carimbo da cascata e a prova tem que ser
       lida como camada autorada de outro corpo, não como camada já adaptada. */
    const prova = Object.assign({}, box.camada, { fontSize: fs });
    const f = gFitTextLayer(prova, texto, ctx, { encolher:false });
    const linhas = (f.lines || []).length;
    const dispX = _gLfLarguraDisponivel(box, fs);
    const dispY = box.alturaDisponivel;
    const maxLinhas = _gLfMaxLinhas(box, fs);
    const overflowX = Math.max(0, Math.round((f.larguraMax || 0) - dispX));
    const overflowY = Math.max(0, Math.round((f.altura || 0) - dispY));
    const excedeuLinhas = linhas > maxLinhas;

    passos.push({ fontSize:fs, linhas, maxLinhas, overflowX, overflowY });
    ultimo = { f, fs, linhas, maxLinhas, overflowX, overflowY, dispX, dispY, passo:i };

    if(overflowX <= G_LF_TOL && overflowY <= G_LF_TOL && !excedeuLinhas){
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
  const intacto = status === 'fits' && !encolheu && u.linhas <= box.linhasAutoradas;
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
