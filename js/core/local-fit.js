/* LOCAL FIT — medida única de texto e adaptação local, em clones.
   Caixa autorada: layoutRef > _layoutBase > camada limpa; tinta autorada é o mínimo da caixa.
   Texto: corpo original → quebra → redução até o piso → overflow com diagnóstico.
   Cadeia vertical declarada: mede TODOS os membros, preserva gaps, respeita paredes e safe
   zone, aplica posições somente quando o conjunto cabe. Sem ciclos, ramificações ou rotação.
   Legado: o par inferido no bloqueio continua limitado a um nível, sem ampliar a heurística.
   fitFontGroup declara quais campos mantêm o mesmo corpo; sem vínculo, são independentes.
   A régua continua gFitTextLayer; quebra, piso e placa continuam nas primitivas existentes.
   Sem busca de composições, scoring, LLM, escala de componente ou movimento global.
   API: gAuthoredTextBox, gFitTextToAuthoredBox, gLocalFitArte, gLocalFitMedidor e diagnóstico.
   Contrato e critérios: docs/LOCAL-FIT-CONTRACT.md. */

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
   '_foraDaArte','_layoutInvalido','_layoutBase','_layoutH'].forEach(k => { delete c[k]; });
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
  const livre = _gLfEspacoAbaixo(layer, camada, opts);

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
    /* A caixa desenhada + o RESPIRO livre abaixo dela (ver `_gLfEspacoAbaixo`), com o teto da
       PILHA quando há camadas ancoradas embaixo (ver `_gLfTetoPilha`). */
    alturaLivre: livre,
    alturaDisponivel: Math.min(Math.max(camada.h || 0, tinta.h || 0, (camada.h || 0) + livre),
                               Math.max(_gLfTetoPilha(layer, camada, opts), tinta.h || 0))
  };
}

/* ── A PILHA DO DESIGNER (decisão do Ryan, 22/09/2026) ────────────────────────────────────
   `relativeAnchor {type:'top-to-bottom', gap}` é a pilha do Figma que o Luma já tinha: o
   designer ancora o "Detalhes" embaixo do "Produto", e `gApplyRelativeAnchors` põe o filho em
   `y do pai + altura do pai + gap`. Só que essa altura é a das quebras MANUAIS
   (`gMeasureLayerHeight`) e é calculada ANTES do Local Fit — a quebra automática vem depois.
   Resultado: o Produto ia para 3 linhas, o Detalhes não descia, e o respiro o tratava como
   parede. A intenção declarada era ignorada.

   Agora: o TOPO da pilha (texto não ancorado em ninguém, com membros ancorados embaixo) pode
   crescer até o menor vazio livre embaixo de QUALQUER membro; depois do encaixe, os membros
   descem exatamente o que o topo cresceu (fase 4 do `gLocalFitArte`), placa junto.
   ⛔ Âncora MANUAL sempre vence. Sem ela, só no BLOQUEIO vale o par inferido (`_gLfPilhaInferida`).
   ⛔ Só desce, nunca sobe. Membro não reserva respiro próprio: o vazio é do topo.
   No runtime da arte, `_gLfResolverCadeia` resolve a cadeia inteira. As primitivas abaixo
     também atendem medições isoladas e o fallback legado; não são um segundo solver. */
function _gLfEhMembro(o){
  const a = o && o.relativeAnchor;
  return !!(a && a.layerId && a.type === 'top-to-bottom');
}
function _gLfPilha(layers, raizId){
  const membros = [], vistos = new Set([raizId]);
  let fila = [raizId];
  while(fila.length){
    const pai = fila.shift();
    (layers || []).forEach(o => {
      if(!_gLfEhMembro(o) || o.relativeAnchor.layerId !== pai || vistos.has(o.id)) return;
      vistos.add(o.id); membros.push(o); fila.push(o.id);
    });
  }
  return membros;
}
/* O primeiro objeto abaixo de `r` na faixa dele, fora de `ignora`, com o teto da prancheta. */
function _gLfParedeAbaixo(r, layers, canvas, ignora){
  const story = canvas.w && canvas.h / canvas.w >= 1.7;
  let limite = canvas.h - (story ? 250 : Math.round(canvas.h * 0.04));
  const fim = (r.y || 0) + (r.h || 0);
  (layers || []).forEach(o => {
    if(!o || ignora.has(o.id)) return;
    if(typeof _gLayoutVisivel === 'function' && !_gLayoutVisivel(o)) return;
    const ox = o.x || 0, oy = o.y || 0, ow = o.w || 0, oh = o.h || 0;
    if(ow <= 0 || oh <= 0) return;
    if(ox >= (r.x || 0) + (r.w || 0) || ox + ow <= (r.x || 0)) return;
    if(oy < fim - 1) return;
    if(oy < limite) limite = oy;
  });
  return limite;
}
/* PILHA INFERIDA (23/09/2026) — revê o "só âncora manual" de 22/09. Na arte da Copa publicada
   sem âncora, "QUANTO TU SABE MANO SOBRE" bloqueava com o Detalhes colado embaixo, e o
   franqueado não tem como ancorar nada: a saída estava no Estúdio, fora do alcance dele. Agora,
   quando o texto BLOQUEARIA, o vizinho que o linter 4c já aponta como par de pilha (logo abaixo,
   até 1,5 linha; mesma coluna pela borda esquerda ou pelo centro; nada entre os dois) desce
   junto — a MESMA régua do linter, não outra.
   ⛔ Só no bloqueio: o que cabe sem pilha segue exatamente como o designer desenhou.
   ⛔ Um nível só (o vizinho direto); o de baixo dele é parede. Âncora manual sempre vence. */
function _gLfPilhaInferida(layer, layers){
  if(!layer || layer.vertical || layer.vAlign !== 'top') return [];
  const ax = layer.x || 0, aw = layer.w || 0, fim = (layer.y || 0) + (layer.h || 0);
  const vis = o => o && o !== layer && o.type !== 'group' && (o.w || 0) > 0 && (o.h || 0) > 0 && !o._placa
                && (typeof _gLayoutVisivel !== 'function' || _gLayoutVisivel(o));
  return (layers || []).filter(o => {
    if(!vis(o) || o.relativeAnchor) return false;
    const vao = (o.y || 0) - fim;
    if(vao < -2 || vao > (layer.fontSize || 24) * 1.5) return false;
    const esq = Math.abs((o.x || 0) - ax) <= 12;
    const cen = Math.abs(((o.x || 0) + (o.w || 0) / 2) - (ax + aw / 2)) <= 12;
    if(!esq && !cen) return false;
    return !(layers || []).some(b => vis(b) && b !== o
      && (b.y || 0) >= fim - 1 && (b.y || 0) + (b.h || 0) <= (o.y || 0) + 1
      && (b.x || 0) < ax + aw && (b.x || 0) + (b.w || 0) > ax);
  });
}
function _gLfTetoPilha(layer, camada, opts){
  const p = opts && opts.pilha;
  if(!p || !p.membros || !p.membros.length || !opts.canvas || !opts.canvas.h) return Infinity;
  const ignora = new Set([layer.id].concat(p.membros.map(m => m.id)));
  (opts.layers || []).forEach(o => { if(o && o._placa && ignora.has(o._placa.alvo)) ignora.add(o.id); });
  const respiro = Math.max(8, Math.round((camada.fontSize || 24) * 0.25));
  let folga = Infinity;
  p.membros.forEach(m => {
    if(typeof _gLayoutVisivel === 'function' && !_gLayoutVisivel(m)) return;
    const parede = _gLfParedeAbaixo(m, opts.layers, opts.canvas, ignora);
    folga = Math.min(folga, _gLfLimiteDescida(m), parede - respiro - ((m.y || 0) + (m.h || 0)));
  });
  if(!isFinite(folga)) return Infinity;
  return (p.alturaAncora || 0) + Math.max(0, Math.floor(folga));
}

/* ── O RESPIRO ABAIXO DA CAIXA (decisão do Ryan, 22/09/2026) ──────────────────────────────
   O PSD traz a caixa justa na frase de exemplo: na arte da Copa, "Produto" tinha 72px de
   altura e 167px vazios até o "Detalhes". Texto maior bloqueava com o espaço ali, sem uso.
   Agora a caixa pode CRESCER PARA BAIXO até o próximo objeto, menos um respiro — e dentro
   dela vale a mesma caixa do Illustrator: quebra, lotou, diminui. NADA SE MOVE: o texto só
   passa a enxergar o vazio que já existe na arte.

   As regras (e cada uma existe porque sem ela a caixa atravessa o que não devia):
     · só texto ancorado no TOPO (`vAlign:'top'`) — é o único que cresce só para baixo;
       centralizado ou ancorado embaixo cresceria para cima também. Vertical também não;
     · "próximo objeto" = qualquer camada visível que comece abaixo do fim da caixa e cruze
       a mesma faixa horizontal. NÃO contam: o fundo/painel que CONTÉM a caixa, a placa do
       próprio texto, e o que já está ao lado (começa antes do fim da caixa);
     · respiro mínimo de ¼ do corpo (mín. 8px) até esse objeto — o texto não encosta;
     · teto na prancheta: margem de 4% embaixo, e a safe zone de 250px no Story (9:16);
     · sem prancheta ou sem camadas (o contador do chat, por exemplo), não cresce: sem saber
       o que tem embaixo, a única resposta segura é a caixa desenhada. */
function _gLfEspacoAbaixo(layer, camada, opts){
  if(!opts || !Array.isArray(opts.layers) || !opts.canvas || !opts.canvas.h) return 0;
  if(camada.vertical || camada.vAlign !== 'top') return 0;
  // Membro de pilha não reserva respiro: o vazio abaixo da pilha é do TOPO (ver a pilha).
  if(_gLfEhMembro(layer)) return 0;
  const bw = camada.w || 0, bh = camada.h || 0;
  if(bw <= 0 || bh <= 0) return 0;
  /* Fora da conta: o próprio texto, a placa dele e — numa pilha — os membros (e as placas
     deles), que DESCEM junto em vez de serem parede. O painel que CONTÉM a caixa começa
     acima dela, então `_gLfParedeAbaixo` já o deixa de fora. */
  const ignora = new Set([layer.id]);
  if(opts.placa && opts.placa.id) ignora.add(opts.placa.id);
  if(opts.pilha && opts.pilha.membros) opts.pilha.membros.forEach(m => ignora.add(m.id));
  opts.layers.forEach(o => { if(o && o._placa && ignora.has(o._placa.alvo)) ignora.add(o.id); });
  const limite = _gLfParedeAbaixo(camada, opts.layers, opts.canvas, ignora);
  const respiro = Math.max(8, Math.round((camada.fontSize || 24) * 0.25));
  return Math.max(0, Math.floor(limite - respiro - ((camada.y || 0) + bh)));
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
  /* TOPO DE PILHA (ver `_gLfTetoPilha`): derivado AQUI, na porta única, para que a prévia, o
     "cabem até N" do bloqueio e o balão da solução meçam a mesma pilha. `alturaAncora` é a
     altura que `gApplyRelativeAnchors` usou para posicionar os membros — a régua de quanto eles
     descem depois (fase 4 do `gLocalFitArte`, que lê `opts.pilha` deste mesmo objeto). */
  let inferidos = null;
  if(opts.pilha === undefined && Array.isArray(opts.layers) && layer && !_gLfEhMembro(layer)){
    const membros = _gLfPilha(opts.layers, layer.id);
    opts.pilha = membros.length ? { membros,
      alturaAncora: (typeof gMeasureLayerHeight === 'function')
        ? gMeasureLayerHeight(layer, String(conteudo == null ? '' : conteudo)) : (layer.h || 0) } : null;
    // Sem âncora manual: o par do linter 4c fica de reserva para o caso de bloqueio (abaixo).
    if(!membros.length && opts.canvas){
      const cand = _gLfPilhaInferida(layer, opts.layers);
      if(cand.length) inferidos = cand;
    }
  }
  if(inferidos){
    const r0 = gFitTextToAuthoredBox(layer, conteudo, opts);
    if(!r0 || r0.status !== 'overflow') return r0;
    /* Inferida, o membro está onde o designer o pôs: a régua de quanto desce é a caixa
       desenhada do topo (`h`), não a medida das quebras manuais que a âncora usaria. */
    opts.pilha = { membros: inferidos, inferida: true, alturaAncora: gAuthoredTextBox(layer, opts).h || 0 };
    const r1 = gFitTextToAuthoredBox(layer, conteudo, opts);
    if(r1 && r1.status === 'fits') return r1;
    opts.pilha = null;
    return r0;
  }
  const box = gAuthoredTextBox(layer, opts);
  if(!box) return null;
  // Uma cadeia declarada empresta altura aos membros; a transação valida o conjunto depois.
  if(Number.isFinite(opts.alturaDisponivel)) box.alturaDisponivel = Math.max(0, opts.alturaDisponivel);
  /* PLACA NÃO CRESCE PARA CIMA DO VIZINHO. A placa acompanha a tinta, então cada linha nova
     do texto era uma placa mais alta — medido: CTA de 70px virou 152px e cobriu a foto de
     baixo. Com placa, a altura útil é o INTERIOR dela: o texto quebra/encolhe lá dentro. */
  const _pl = opts.placa && opts.placa._placa;
  if(_pl && _pl.refH > 0){
    const interno = (opts.placa.h || 0) - Math.max(0, _pl.padT) - Math.max(0, _pl.padB);
    box.alturaDisponivel = Math.min(box.alturaDisponivel,
                                    Math.max(box.tintaAutorada.h || 0, _pl.refH, interno));
  }

  const ctx = _gLfCtx(opts.ctx);
  const texto = String(conteudo == null ? '' : conteudo);
  const passos = [];
  /* `tetoFonte`: corpo máximo imposto pelo grupo de irmãos (§3, fase 2). Nunca sobe. */
  let fs = (opts.tetoFonte > 0) ? Math.max(box.piso, Math.min(box.fontSize, Math.round(opts.tetoFonte)))
                                : box.fontSize, ultimo = null;

  /* CAIXA DO ILLUSTRATOR. Texto de PONTO também quebra dentro da caixa que o designer
     desenhou (`w/h` da camada): em cada corpo tenta primeiro a linha única (ORIGINAL FIRST —
     o texto autorado nunca muda de desenho), depois quebra na largura da caixa, e só se a
     quebra não couber na altura desce o corpo. A quebra usa `_layoutW = w`, que o
     `gFitTextLayer` e o render já honram — nada muda de lugar, a largura é a desenhada.
     (Decisão do Ryan, 22/09/2026: "vai pulando pra linha de baixo; lotou, diminui".) */
  const podeQuebrarPonto = !box.quebravel && !box.vertical && (box.w || 0) > 0;
  const nPalavras = texto.split(/\s+/).filter(Boolean).length;
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
    /* PALAVRA PARTIDA NÃO É "CABER". Quando uma palavra é mais larga que a caixa, a quebra
       cai no corte por letra ("RECHEA-" / "DA") — medido na arte da Copa depois do respiro.
       Mais pedaços nas linhas do que palavras no texto = alguma foi partida: desce o corpo. */
    const pedacos = (f.lines || []).join(' ').split(/\s+/).filter(Boolean).length;
    const partiu = linhas > 1 && pedacos > nPalavras;
    const cabe = overflowX <= G_LF_TOL && overflowY <= G_LF_TOL && !excedeuLinhas && !partiu;
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
    if(opts.fonteExata || fs <= box.piso) break;
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

   Fora de cadeias declaradas e do par legado inferido, terceiros não se movem. Placas
   acompanham o próprio texto. Não abre corredor, não escala componente nem busca composição.

   ORIGINAL FIRST ABSOLUTO: quando o conteúdo cabe como o designer desenhou, a camada sai daqui
   SEM UM ÚNICO CARIMBO — é o mesmo objeto que a arte publicada produz. Não é tolerância de
   comparação, é ausência de escrita.

   COMO O RESULTADO CHEGA AO DESENHO: `_tetoFonte`, `_layoutW`, `_layoutH` e posições nos clones. `gFitTextLayer` (a régua
   do render, em `00-config.js`) lê `min(_tetoFonte, fontSize)` como corpo de partida, então
   prévia e PNG desenham no corpo que o Local Fit decidiu — sem segundo motor e sem segunda
   medida. É daí que sai a paridade do item 13.

   @returns {object} { layers, result } — `result` mantém as chaves que a prévia, a telemetria
   e o Estúdio já liam (`status`, `invalid`, `invalidIds`, `changes`, `requiresAdaptation`) e
   acrescenta `campos` (o laudo por campo) e `bloqueios` (o payload de CONTENT_TOO_LARGE). */
/* Cadeias simples, declaradas por ID. Relações ambíguas nunca entram no fallback inferido.
   Não há busca de composição: cada cadeia tem uma ordem e um limite externo por membro. */
function _gLfCadeias(layers){
  const porId = new Map(layers.map(l => [l.id, l])), ids = new Set(), cadeias = [];
  layers.forEach(l => {
    if(!_gLfEhMembro(l)) return;
    ids.add(l.id); ids.add(l.relativeAnchor.layerId);
  });
  const vistos = new Set();
  ids.forEach(id => {
    if(vistos.has(id)) return;
    const componente = [], fila = [id];
    while(fila.length){
      const atual = fila.pop();
      if(vistos.has(atual)) continue;
      vistos.add(atual);
      const l = porId.get(atual);
      if(l) componente.push(l);
      if(_gLfEhMembro(l)) fila.push(l.relativeAnchor.layerId);
      layers.forEach(o => { if(_gLfEhMembro(o) && o.relativeAnchor.layerId === atual) fila.push(o.id); });
    }
    const raizes = componente.filter(l => !_gLfEhMembro(l));
    const ordem = [], visitados = new Set();
    let atual = raizes.length === 1 ? raizes[0] : null;
    while(atual && !visitados.has(atual.id)){
      ordem.push(atual); visitados.add(atual.id);
      const filhos = componente.filter(l => _gLfEhMembro(l) && l.relativeAnchor.layerId === atual.id);
      atual = filhos.length === 1 ? filhos[0] : null;
    }
    const valida = ordem.length === componente.length && ordem.length > 1 && componente.every(l =>
      l.abId === ordem[0].abId && l.type !== 'group' && !l.vertical && !l.rotation
      && (l.type !== 'text' || l.vAlign === 'top')
      && (!_gLfEhMembro(l) || Number.isFinite(Number(l.relativeAnchor.gap || 0))));
    cadeias.push({ membros: valida ? ordem : componente, valida });
  });
  return { ids, cadeias };
}

// A folga pertence ao vizinho: três linhas AUTORADAS, sem aumentar a cada tentativa.
function _gLfLimiteDescida(l){
  const ref = l.layoutRef || l._layoutBase || l;
  return 3 * (ref.fontSize || l.fontSize || 24) * (ref.lineHeight || l.lineHeight || 1.2);
}

function _gLfResolverCadeia(cadeia, medidos, layers, canvas, ctx){
  const medidas = new Map(medidos.map(m => [m.l.id, m]));
  const variaveis = cadeia.membros.map(l => medidas.get(l.id)).filter(m => m && !m.vazio);
  if(!variaveis.length) return [];
  const ignora = new Set(cadeia.membros.map(l => l.id));
  layers.forEach(l => { if(l._placa && ignora.has(l._placa.alvo)) ignora.add(l.id); });
  const tetos = new Map(variaveis.map(m => [m.l.id, m.r.diagnostics.fontSizeAutorado]));
  let tentativa = [], excesso = 0;
  if(cadeia.valida && canvas && canvas.h){
    for(let passo = 0; passo < G_LF_MAX_PASSOS; passo++){
      tentativa = []; excesso = 0;
      let anterior = null, candidatos = null;
      for(const l of cadeia.membros){
        const m = medidas.get(l.id);
        const visivel = typeof _gLayoutVisivel !== 'function' || _gLayoutVisivel(l);
        const vazio = !visivel || (m && m.vazio);
        const y = _gLfYDepois(l, anterior);
        const fitOpts = m && !m.vazio ? Object.assign({}, m.fitOpts, {
          pilha:null, alturaDisponivel:canvas.h, tetoFonte:tetos.get(l.id), fonteExata:true
        }) : null;
        const r = fitOpts ? gFitTextToAuthoredBox(l, m.conteudo, fitOpts) : null;
        const h = vazio ? 0 : r ? r.diagnostics.alturaNecessaria : l.type === 'text'
          ? gFitTextLayer(_gLfLimpa(l), l.content || '', ctx, { encolher:false }).altura : (l.h || 0);
        let fundo = y + h, excessoLocal = 0;
        const origemY = Number.isFinite(l._localFitY) ? l._localFitY : (l.y || 0);
        const descida = anterior && !vazio ? y - origemY - _gLfLimiteDescida(l) : 0;
        const placa = m && m.fitOpts && m.fitOpts.placa;
        if(placa && r && typeof gInkRect === 'function'){
          const tinta = gInkRect(Object.assign({}, l, { y, fontSize:r.fontSize }), {
            altura:h, larguraMax:r.diagnostics.larguraNecessaria, lines:r.lines, fontSize:r.fontSize, text:r.text
          });
          const ret = gLayoutPlacaSegue(placa._placa, tinta, r.fontSize);
          if(ret){
            fundo = Math.max(fundo, ret.y + ret.h);
            // A placa pode ser mais larga que o texto e encontrar uma parede só na lateral.
            excessoLocal = Math.max(excessoLocal, ret.y + ret.h - _gLfParedeAbaixo(placa, layers, canvas, ignora) + 8);
          }
        }
        const respiro = Math.max(8, Math.round((l.fontSize || 24) * 0.25));
        const parede = _gLfParedeAbaixo(Object.assign({}, l, { y:Math.min(l.y || 0, origemY) }), layers, canvas, ignora) - respiro;
        if(!vazio) excessoLocal = Math.max(excessoLocal, fundo - parede);
        excesso = Math.max(excesso, excessoLocal, descida);
        // A primeira restrição identifica quem pode resolvê-la. Encolher o vizinho
        // não reduz sua posição: nesse caso só os antecessores podem ceder espaço.
        if(!candidatos && (descida > G_LF_TOL || excessoLocal > G_LF_TOL || (r && r.status !== 'fits'))){
          candidatos = tentativa.map(t => t.m).filter(Boolean);
          if(descida <= G_LF_TOL && m) candidatos.unshift(m);
        }
        tentativa.push({ l, m, r, fitOpts, y, h });
        anterior = { y, h, visible:visivel };
      }
      if(excesso <= G_LF_TOL && tentativa.every(t => !t.r || t.r.status === 'fits')){
        tentativa.forEach(t => { if(t.r){ t.m.r = t.r; t.m.fitOpts = t.fitOpts; } });
        return tentativa.map(t => ({ id:t.l.id, y:t.y, raiz:cadeia.membros[0].id }));
      }
      let mudou = false;
      for(const m of candidatos || variaveis){
        if(m.vazio) continue;
        const teto = tetos.get(m.l.id), piso = m.r.diagnostics.piso;
        const proximo = Math.max(piso, Math.floor(teto * G_LF_DEGRAU));
        if(proximo < teto){ tetos.set(m.l.id, proximo); mudou = true; break; }
      }
      if(!mudou) break;
    }
  }
  // Transação recusada: nenhum y é aplicado. O diagnóstico explica o limite do conjunto.
  variaveis.forEach(m => {
    const t = tentativa.find(t => t.l.id === m.l.id);
    const r = t && t.r ? t.r : m.r;
    m.r = Object.assign({}, r, { status:'overflow', degrau:'piso',
      overflowY:Math.max(r.overflowY, Math.ceil(Math.max(0, excesso))),
      diagnostics:Object.assign({}, r.diagnostics, { motivo:cadeia.valida
        ? 'a pilha não cabe no espaço disponível' : 'âncora inválida: use uma cadeia vertical simples' }) });
  });
  return [];
}

function _gLfYDepois(l, anterior){
  const base = Number.isFinite(l._localFitY) ? Math.min(l.y || 0, l._localFitY) : (l.y || 0);
  const y = anterior ? anterior.y + anterior.h
    + (anterior.visible === false ? 0 : Number(l.relativeAnchor.gap || 0)) : base;
  return y > base + G_LF_TOL ? y : base;
}

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

  /* FASE 1 — MEDIR cada texto com campo, sem escrever nada. */
  const medidos = [];
  const estrutura = _gLfCadeias(out);
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
    if(!String(conteudo).trim()){ medidos.push({ l, vazio:true }); return; }

    /* Os MESMOS runs do render (split de preço: inteiro, símbolo e centavos em corpos
       diferentes). Medir sem eles é medir outro texto. */
    const runs = (typeof gBuildVirtualRuns === 'function')
      ? gBuildVirtualRuns(l, dados, 1, defaults) : null;
    const placa = out.find(p => p && p._placa && p._placa.alvo === l.id) || null;
    const fitOpts = { layers: out, canvas: cv, ctx, runs, placa };
    if(estrutura.ids.has(l.id)) fitOpts.pilha = null;
    const r = gFitTextToAuthoredBox(l, conteudo, fitOpts);
    if(r) medidos.push({ l, conteudo, fitOpts, r });
  });

  const posicoes = estrutura.cadeias.flatMap(c => _gLfResolverCadeia(c, medidos, out, cv, ctx));

  /* Mesmo corpo somente no conjunto declarado pelo designer. Aparência não é vínculo. */
  const grupos = new Map();
  medidos.forEach(m => {
    if(m.vazio || m.r.status !== 'fits' || !m.l.fitFontGroup) return;
    const l = m.l;
    const k = JSON.stringify([l.abId || '', l.fitFontGroup]);
    if(!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(m);
  });
  grupos.forEach(g => {
    if(g.length < 2) return;
    const menor = Math.min(...g.map(m => m.r.fontSize));
    if(g.some(m => m.r.diagnostics.piso > menor)){
      g.forEach(m => { m.r = Object.assign({}, m.r, { status:'overflow', degrau:'piso',
        diagnostics:Object.assign({}, m.r.diagnostics, { motivo:'o conjunto de fontes tem pisos incompatíveis' }) }); });
      return;
    }
    g.forEach(m => {
      if(m.r.fontSize === menor) return;
      const r2 = gFitTextToAuthoredBox(m.l, m.conteudo, Object.assign({}, m.fitOpts, { tetoFonte: menor }));
      if(r2) m.r = r2;
    });
  });

  /* FASE 3 — APLICAR. */
  // Reposiciona com as alturas finais, inclusive após igualar fontes, preservando o gap.
  const cadeiasRecusadas = new Set();
  estrutura.cadeias.forEach(c => {
    let anterior = null;
    const falhou = medidos.some(m => !m.vazio && c.membros.some(l => l.id === m.l.id) && m.r.status !== 'fits');
    if(falhou) c.membros.forEach(l => cadeiasRecusadas.add(l.id));
    c.membros.forEach(l => {
      const p = posicoes.find(p => p.id === l.id);
      if(!p) return;
      if(falhou){ p.y = l.y; return; }
      const m = medidos.find(m => m.l.id === l.id);
      const visivel = typeof _gLayoutVisivel !== 'function' || _gLayoutVisivel(l);
      const h = !visivel ? 0 : m ? (m.vazio ? 0 : m.r.diagnostics.alturaNecessaria)
        : l.type === 'text' ? gFitTextLayer(_gLfLimpa(l), l.content || '', ctx, { encolher:false }).altura : l.h || 0;
      p.y = _gLfYDepois(l, anterior);
      anterior = { y:p.y, h, visible:visivel };
    });
  });
  posicoes.forEach(p => {
    const l = out.find(o => o.id === p.id), delta = p.y - l.y;
    if(!delta) return;
    const placa = out.find(o => o._placa && o._placa.alvo === l.id);
    [l, placa].forEach(o => {
      if(!o) return;
      o.y += delta;
      changes.push({ id:o.id, pilhaDe:p.raiz, geometry:true, typography:false, moved:true, resized:false });
    });
  });
  medidos.forEach(m => {
    const l = m.l;
    if(m.vazio){ campos.push({ id:l.id, status:'vazio', degrau:'vazio' }); return; }
    const r = m.r, placa = m.fitOpts.placa;

    campos.push({ id:l.id, nomes:(typeof gLayoutCamposDe === 'function') ? gLayoutCamposDe(l) : [],
                  chars:String(m.conteudo || '').length,
                  status:r.status, degrau:r.degrau, fontSize:r.fontSize,
                  fontSizeAutorado:r.diagnostics.fontSizeAutorado, linhas:r.lines.length,
                  overflowX:r.overflowX, overflowY:r.overflowY, piso:r.diagnostics.piso });

    if(r.status === 'overflow'){
      l._layoutInvalido = true;
      invalidIds.push(l.id);
      /* FAIL SAFE (item 8): o payload é OBJETIVO — quem travou, por quantos pixels, quantas
         linhas precisaria e onde o piso parou. Sem LLM, sem estimativa por caractere. */
      /* `placa`: a forma COMO ELA ESTAVA quando o texto foi medido (cópia tirada antes de ela
         acompanhar a tinta, logo abaixo, e ainda com o `_placa` que a fase 4 apaga). Quem mede
         de novo este campo depois — "cabem até N", o balão da solução — precisa da MESMA placa
         que o runtime usou: sem ela o interior da placa não limita a altura, e a sugestão
         "cabe" lá e não aqui (`gLocalFitMedidor`). */
      bloqueios.push({ status:'CONTENT_TOO_LARGE', fieldId:l.id,
                       campos:(typeof gLayoutCamposDe === 'function') ? gLayoutCamposDe(l) : [],
                       overflowX:r.overflowX, overflowY:r.overflowY,
                       requiredLines:r.lines.length, maxLines:r.diagnostics.maxLinhas,
                       fontSize:r.fontSize, minimumFontSize:r.diagnostics.piso,
                       motivo:r.diagnostics.motivo,
                       contextoPilha: estrutura.ids.has(l.id) || l.fitFontGroup
                         ? { layers:(layers || []).map(o => Object.assign({}, o)), canvas:cv } : null,
                       placa: placa ? Object.assign({}, placa) : null });
    }

    /* ORIGINAL FIRST ABSOLUTO: coube como desenhado → nenhum carimbo, nenhum `change`. */
    if(r.degrau === 'original') return;

    if(r.degrau === 'shrink' || r.degrau === 'piso'){ encolheu = true; }
    if(r.degrau === 'wrap'){ quebrou = true; }
    if(r.fontSize !== r.diagnostics.fontSizeAutorado) l._tetoFonte = r.fontSize;
    if(r.layoutW) l._layoutW = r.layoutW;
    /* Caixa que cresceu para o respiro: o render já desenha para baixo (âncora no topo);
       `_layoutH` só conta até onde, para o toque da prévia cobrir o texto inteiro. */
    if(r.status === 'fits' && r.diagnostics.alturaNecessaria > (l.h || 0))
      l._layoutH = r.diagnostics.alturaNecessaria;
    /* TEXTO NÃO SOBE. Enquanto cabe na caixa segue centralizado (é o desenho do designer);
       quando passa dela, ancora no topo e cresce só para baixo — senão metade do excesso come
       a margem que o designer deixou em cima. Mesma regra do `_gStampVTop` da cascata antiga,
       agora escrita por quem de fato mediu o encaixe. */
    if(typeof _gStampVTop === 'function') _gStampVTop(l, r.diagnostics.alturaNecessaria);
    changes.push({ id:l.id, geometry:false, typography:true, moved:false, resized:false });

    /* A PLACA ACOMPANHA — a única geometria que o Local Fit escreve, e só na forma que o
       próprio texto carrega. `gLayoutPlacaSegue` é a conta única do card. */
    if(placa && !cadeiasRecusadas.has(l.id) && typeof gLayoutPlacaSegue === 'function' && typeof gInkRect === 'function'){
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

  /* FASE 4 — O PAR LEGADO INFERIDO DESCE. Depois de todo mundo encaixado (e das placas acompanharem os
     próprios textos), os membros da pilha de um topo que COUBE descem exatamente o que ele
     cresceu além da altura que as âncoras usaram. O teto (`_gLfTetoPilha`) já garantiu que a
     descida para antes do próximo objeto. Só desce: encolher o topo não puxa ninguém para
     cima — isso recomporia o que o designer posicionou. */
  medidos.forEach(m => {
    const p = m.fitOpts && m.fitOpts.pilha;
    if(!p || m.vazio || m.r.status !== 'fits') return;
    const delta = Math.round(m.r.diagnostics.alturaNecessaria - (p.alturaAncora || 0));
    if(delta <= 0) return;
    p.membros.forEach(mb => {
      const placaMb = out.find(o => o && o._placa && o._placa.alvo === mb.id);
      [mb, placaMb].forEach(o => {
        if(!o) return;
        o.y = (o.y || 0) + delta;
        changes.push({ id:o.id, pilhaDe:m.l.id, geometry:true, typography:false, moved:true, resized:false });
      });
    });
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
              diagnostico: bloqueios[0] || null },
    // Somente o medidor de bloqueio pede o encaixe completo, sem duplicar o solve da cadeia.
    medicao: opts.medirId ? (medidos.find(m => m.l.id === opts.medirId) || {}).r : null
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

/* O CULPADO de um bloqueio, numa conta só. Com mais de um campo na mesma camada, é o de valor
   mais longo (empate: a ordem da camada). O aviso da prévia, o balão da solução e o laudo
   escolhiam cada um o seu — `campos[0]` num, o mais longo no outro — e o aviso podia nomear um
   campo enquanto o "cabem até N" media outro. */
function gLocalFitCulpado(bloqueio, dados){
  const campos = (bloqueio && bloqueio.campos) || [];
  if(!campos.length) return null;
  const tam = (c) => String((dados && dados[c] != null) ? dados[c] : '').length;
  return campos.slice().sort((a, b) => tam(b) - tam(a))[0];
}

/* "ESTE VALOR NESTE CAMPO DESTA ARTE CABE?" pelo MESMO caminho do `gLocalFitArte`: mesma
   interpolação, mesmos runs, mesmas camadas (pilha e pisos) e a MESMA placa (`bloqueio.placa`).
   Uma medida por fora do runtime é como o balão sugeria texto que "cabia" e a arte seguia
   bloqueada — a placa limitava a altura aqui e não lá.
   @returns {function(valor):object|null} o resultado do `gFitTextToAuthoredBox` por valor. */
function gLocalFitMedidor(layers, bloqueio, campo, dados, opts){
  const alvo = bloqueio && (layers || []).find(l => l && l.id === bloqueio.fieldId);
  if(!alvo || !campo) return null;
  const o = opts || {};
  const defaults = (o.defaults != null) ? o.defaults
                 : ((typeof gVarDefaults === 'function') ? gVarDefaults() : null);
  return (valor) => {
    const d = Object.assign({}, dados || {});
    d[campo] = valor;
    if(bloqueio.contextoPilha){
      const base = bloqueio.contextoPilha;
      return gLocalFitArte(base.layers, { canvas:base.canvas, ctx:o.ctx, dados:d, defaults,
        medirId:alvo.id }).medicao || null;
    }
    const texto = (typeof gInterpolate === 'function')
      ? gInterpolate(alvo.content, d, { onEmpty:'remove', defaults }) : String(valor);
    const runs = (typeof gBuildVirtualRuns === 'function')
      ? gBuildVirtualRuns(alvo, d, 1, defaults) : null;
    return gFitTextToAuthoredBox(alvo, texto,
      { layers, canvas:o.canvas || null, ctx:o.ctx, runs, placa:bloqueio.placa || null });
  };
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
    /* `opts.campo`: a prévia mede com placeholders nos campos vazios, e o culpado tem que ser
       escolhido pelo que a PESSOA digitou (é o que ela pode encurtar) — ela o passa pronto. */
    const campo = (opts && opts.campo) || gLocalFitCulpado(bloqueio, dados);
    const medir = gLocalFitMedidor(layers, bloqueio, campo, dados, opts);
    if(!medir) return null;
    const valor = String((dados && dados[campo]) != null ? dados[campo] : '');
    const rotulo = gLocalFitRotulo(campo);
    if(valor.length < 3) return { campo, rotulo, atual: valor.length, limite: 0,
      mensagem: 'A arte não tem espaço seguro para “' + rotulo + '” neste material. Escolha outro material para este conteúdo.' };

    const { limite } = gLocalFitMaiorPrefixo(valor, (t) => { const r = medir(t); return !!r && r.status === 'fits'; });
    return { campo, rotulo, atual: valor.length, limite,
             mensagem: gLocalFitMensagem(rotulo, valor.length, limite) };
  }catch(e){ return null; }
}

/* O MAIOR COMEÇO DO TEXTO, cortado na palavra (`gLocalFitCorta`), que cabe — o "cabem até N"
   do laudo e o "tire umas N letras" da prévia saem desta mesma busca, então o aviso da barra,
   o diálogo e o contador dizem o mesmo número. Busca binária de verdade: os cortes crescem
   aninhados com `n` (cada um é prefixo do seguinte), então "cabe" é monotônico. ~log2(n)
   medições (50 letras → 6). A anterior parava no primeiro meio que cabia e subia de 1 em 1.
   ⚠ `limite` é o comprimento do TEXTO QUE FOI MEDIDO, não o `n` da busca: em "Pizza Calabresa
   Mussarela", n=24 corta em "Pizza Calabresa" (15) — prometer 24 era prometer 9 letras que
   ninguém mediu ("tire 1 letra" quando falta uma palavra inteira).
   @param {function(string):boolean} cabe  "este texto cabe?" — o medidor em pixel do chamador
   @returns {{limite:number, texto:string, medidas:number}}  `limite` 0 = nem 1 letra cabe */
function gLocalFitMaiorPrefixo(valor, cabe){
  const t = String(valor || '');
  let baixo = 1, alto = t.length, texto = '', medidas = 0;
  while(baixo <= alto){
    const meio = (baixo + alto) >> 1, corte = gLocalFitCorta(t, meio);
    medidas++;
    if(corte && cabe(corte)){ texto = corte; baixo = meio + 1; } else alto = meio - 1;
  }
  return { limite: texto.length, texto, medidas };
}
