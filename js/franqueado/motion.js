/**
 * js/franqueado/motion.js
 *
 * STORY ANIMADO — o Story do franqueado sai também em MP4 (28/10/2026)
 * ---------------------------------------------------------------------------
 * Pedido do Ryan: todo Story com motion, animação PRÉ-DEFINIDA, download em MP4 de alta
 * qualidade. Decisões dele na mesma conversa: a animação é AUTOMÁTICA e sai dos componentes
 * de CADA arte — ela se monta peça por peça, cada peça do jeito do que ela é (referência
 * "Festival do Xis"; ver `_fMotionPlano`), sutil, sem preço pulando; o franqueado não escolhe
 * estilo; 8 s em 1080×1920 a 60 fps, com a montagem terminando em ~2,5 s para sobrar tempo de
 * ler a oferta.
 *
 * ⛔ NÃO É UM SEGUNDO RENDER. Cada quadro passa pelo motor único (`fRenderTemplateLayers`)
 * com `resolvido:true` — o mesmo gancho que a prévia usa para o deslize (`_fLpCinema`): o
 * encaixe, as regras e o Local Fit rodam UMA vez (`soLayout`), e cada quadro só desenha clones
 * com `_fxEscala/_fxDx/_fxDy/_fxGiro` e a opacidade da vez. Por isso o vídeo é, quadro a quadro, a
 * mesma arte do PNG — o último quadro é o PNG.
 *
 * ⛔ ZERO DEPENDÊNCIA. O H.264 sai do `VideoEncoder` do próprio navegador (WebCodecs) e o
 * arquivo é montado por um muxer MP4 mínimo aqui embaixo (`_fMp4Monta`: uma faixa de vídeo,
 * um chunk, `moov` na frente para o Instagram/WhatsApp começarem a tocar sem baixar tudo).
 * Sem WebCodecs (navegador antigo, página fora de HTTPS) o botão nem aparece.
 *
 * ⚠ Opacidade de grupo: grupo de COMPOSIÇÃO (opacidade/máscara/blend) esmaece pelo próprio
 * grupo, que o motor aplica no composto; grupo pass-through esmaece filho a filho. Esmaecer os
 * dois multiplicaria o alfa.
 *
 * O BOTÃO É "Virar motion" (30/10/2026): `fVirarMotion` abre o estúdio de motion
 * (franqueado/motion-estudio.js), que monta a animação ao vivo enquanto este arquivo grava, e
 * devolve o vídeo para o mockup; depois o mesmo botão vira "Baixar vídeo" (`fBaixarMotion`).
 *
 * Depende de: franqueado/png-generator.js (fRenderTemplateLayers, fMaterialSize,
 *   fBuildFilename, _fArteEhCelular), core/auto-layout.js (gLayoutSemanticRole),
 *   core/toast.js (gToast, gBtnLoading), core/feature-flags.js (gFeatureCan),
 *   franqueado/chat.js (_fArtSnapshots), franqueado/history.js (fAddHist, fMarkHistBaixada).
 */

const F_MOTION_FPS = 60;
const F_MOTION_SEG = 8;
const F_MOTION_BITRATE = 20e6;   // ~20 Mbps: o Instagram re-encoda, então o que mandamos é o teto dele
// High 4.2 cobre 1080×1920 a 60 fps (8.160 macroblocos/quadro); os outros são rede para
// encoder que não fala High (hardware antigo, alguns Android).
const F_MOTION_CODECS = ['avc1.64002A', 'avc1.640033', 'avc1.4D002A', 'avc1.42E02A'];

// O navegador sabe gerar vídeo? WebCodecs só existe em contexto seguro (HTTPS/localhost).
function fMotionDisponivel(){
  return typeof window !== 'undefined' && window.isSecureContext !== false
    && typeof VideoEncoder === 'function' && typeof VideoFrame === 'function';
}

// "É Story?" pela GEOMETRIA (9:16), não pelo id do formato: o template publicado traz w/h reais.
function fMotionEhStory(material, fmt){
  if(typeof fMaterialSize !== 'function') return false;
  const [w, h] = fMaterialSize(material, fmt);
  return w > 0 && Math.abs(h / w - 16 / 9) < 0.02;
}

/* ── CURVAS ──────────────────────────────────────────────────────────────────── */
const _fMoSuave = x => 1 - Math.pow(1 - x, 4);   // sai rápido e pousa devagar, sem passar do ponto
const _fMoProg = (t, ini, dur) => Math.max(0, Math.min(1, (t - ini) / dur));
// Só para adesivo: passa ~4 % do ponto e volta, o "pop" da referência. Preço e texto nunca usam.
const _fMoAssenta = x => { const c1 = .9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

/* ── O PLANO: que camada faz o quê ──────────────────────────────────────────────
   Unidade = o que se move junto. Grupo pass-through se abre (cada filho é unidade); grupo de
   composição é atômico (o motor o desenha como um composto). Camada com clipping vai junto
   da base, senão o recorte e o conteúdo se separam no meio do movimento. */
function _fMoGrupoComposto(g){
  return g.isolation === true || !!g.mask || (g.opacity != null && g.opacity < 100)
    || (g.blendMode && g.blendMode !== 'normal') || !!g.shadow || !!g.glow;
}
const _F_MO_PRIORIDADE = ['preco', 'cta', 'titulo', 'produto', 'apoio', 'protegida', 'legal', 'decoracao', 'fundo'];

function _fMotionPlano(layers, W, H){
  // A árvore com TODAS as camadas (a mesma regra de pai do motor); quem está oculto, ou dentro
  // de grupo oculto, simplesmente não é visitado — senão viraria unidade solta e atrasaria a fila.
  const todas = layers.filter(Boolean);
  const vivas = todas.filter(l => l.visible !== false);
  const porId = new Map(todas.map(l => [l.id, l]));
  const filhos = new Map();
  todas.forEach(l => {
    if(l.visible === false) return;
    const p = (l.parentId && porId.has(l.parentId) && porId.get(l.parentId).type === 'group') ? l.parentId : null;
    if(!filhos.has(p)) filhos.set(p, []);
    filhos.get(p).push(l);
  });
  const degraus = [...new Set(vivas.filter(l => l.type === 'text').map(l => Math.round(l.fontSize || 24)))].sort((a, b) => b - a);
  const papelCtx = { canvas: { w: W, h: H }, degraus };
  // `layoutSemantic` é carimbado na publicação; sem ele, a mesma régua, SEM escrever na camada
  // (o clone resolvido pode compartilhar objeto com o template).
  const papelDe = l => l.layoutSemantic || ((typeof gLayoutSemanticRole === 'function') ? gLayoutSemanticRole(l, papelCtx) : 'decoracao');

  const unidades = [];
  const folhas = (g, acc) => { (filhos.get(g.id) || []).forEach(f => f.type === 'group' ? folhas(f, acc) : acc.push(f)); return acc; };
  const monta = paiId => (filhos.get(paiId) || []).forEach(l => {
    if(l.type === 'adjustment') return;   // ajuste transforma o que está embaixo; não se move
    if(l.type === 'group' && !_fMoGrupoComposto(l)) { monta(l.id); return; }
    unidades.push({ raiz: l, folhas: l.type === 'group' ? folhas(l, []) : [l] });
  });
  monta(null);

  /* Clipping. Base que é CENÁRIO (o fundo nunca para) leva o recortado junto. Base que assenta
     (card, placa) deixa o recortado virar unidade própria, que REVELA por dentro dela depois —
     a foto que sobe dentro do card na referência do Ryan (28/10). */
  const unidadeDaFolha = new Map();
  unidades.forEach(u => u.folhas.forEach(f => unidadeDaFolha.set(f.id, u)));
  unidades.forEach(u => {
    if(u.raiz.type === 'group' || !u.raiz.clipBaseId) return;
    const dona = unidadeDaFolha.get(u.raiz.clipBaseId);
    if(dona && dona !== u) u.dona = dona;
  });

  const deUnidade = new Map();
  let plano = unidades.filter(u => u.folhas.length).map(u => {
    const fs = u.folhas.filter(f => f.type !== 'adjustment');
    const x0 = Math.min(...fs.map(f => +f.x || 0)), y0 = Math.min(...fs.map(f => +f.y || 0));
    const x1 = Math.max(...fs.map(f => (+f.x || 0) + (+f.w || 0))), y1 = Math.max(...fs.map(f => (+f.y || 0) + (+f.h || 0)));
    let papel = 'decoracao';
    const papeis = fs.map(papelDe);
    for(const p of _F_MO_PRIORIDADE){ if(papeis.includes(p)) { papel = p; break; } }
    // Unidade do tamanho da arte é cenário, seja qual for o papel do que está dentro: um PSD
    // inteiro num grupo de composição faria a arte toda deslizar.
    if((x1 - x0) * (y1 - y0) >= W * H * 0.85) papel = 'fundo';
    const pl = { u, raiz: u.raiz, folhas: fs, extras: [], papel, x0, y0, x1, y1, ox: (x0 + x1) / 2, oy: (y0 + y1) / 2, topo: y0, ini: 0 };
    deUnidade.set(u, pl);
    return pl;
  });
  plano.forEach(pl => {
    const base = pl.u.dona && deUnidade.get(pl.u.dona);
    if(!base) return;
    if(base.papel === 'fundo'){ base.folhas.push(pl.raiz); base.extras.push(pl.raiz); pl.morta = true; }
    else { pl.base = base; pl.tipo = 'revela'; }
  });
  plano = plano.filter(pl => !pl.morta);

  /* ── A COREOGRAFIA SAI DOS COMPONENTES DE CADA ARTE ──────────────────────────────────────
     Pedido do Ryan (28/10): "cada arte ter seu próprio motion", na linha da referência do
     Festival do Xis — a arte se MONTA peça por peça, e cada peça entra do jeito do que ela é:
       marca (logo pequeno)  → aparece primeiro
       título                → cresce de 82 % e endireita 3°
       painel (card grande)  → sobe; o conteúdo dele entra depois
       foto recortada no card→ sobe POR DENTRO do card (revela)
       forma (placa, pílula) → chega e traz o texto de dentro de carona
       adesivo (selo, ícone) → pop com giro, no fim
       faixa colada na borda → entra pela borda, com o texto de carona
       texto, preço, CTA     → chegam de leve do lado onde moram, SEM pulo (Ryan: "nada de preço
                               ficar pulando")
       legal                 → por último
     A ordem é a de leitura DESTA composição. Duas artes diferentes saem com movimentos
     diferentes sem o designer configurar nada. Tudo assentado em ~2,5 s; o resto do vídeo é a
     oferta parada para ler (só o fundo respira). */
  const A = W * H;
  const contem = (d, u) => u !== d && u.ox >= d.x0 && u.ox <= d.x1 && u.oy >= d.y0 && u.oy <= d.y1
    && (u.x1 - u.x0) * (u.y1 - u.y0) < (d.x1 - d.x0) * (d.y1 - d.y0);
  const vivos = plano.filter(u => u.papel !== 'fundo');
  vivos.forEach(u => {
    if(u.tipo) return;
    const w = u.x1 - u.x0, h = u.y1 - u.y0, area = w * h;
    const temTexto = u.folhas.some(f => f.type === 'text');
    const ehFoto = u.folhas.some(f => f.type === 'image' || f.type === 'frame');
    const ehConteiner = vivos.some(o => o !== u && o.papel !== 'fundo' && contem(u, o));
    if(u.papel === 'legal') u.tipo = 'legal';
    else if(u.papel === 'protegida' && area < A * .04 && !ehConteiner) u.tipo = 'marca';
    else if(u.papel === 'titulo') u.tipo = 'titulo';
    else if(!temTexto && w >= W * .6 && h < H * .3 && (u.y1 >= H - 2 || u.y0 <= 2)) u.tipo = 'faixa';
    else if(!temTexto && area < A * .05 && !ehConteiner && u.papel !== 'produto') u.tipo = 'adesivo';
    else if(!temTexto && !ehFoto && ehConteiner) u.tipo = area >= A * .08 ? 'painel' : 'forma';
    else if(ehFoto) u.tipo = 'foto';
    else if(!temTexto) u.tipo = 'forma';
    else u.tipo = 'texto';
  });
  /* Título em PEDAÇOS ("FESTIVAL" / "DO" / "XIS"): texto FIXO (lettering, sem campo) grande e
     colado no bloco do título é título também — cresce como ele. Texto com campo (nome do
     produto, preço) é conteúdo do franqueado e continua chegando como texto. */
  const temCampo = u => u.folhas.some(f => (typeof _gLayoutTemCampo === 'function') ? _gLayoutTemCampo(f) : !!f.isVar);
  const fonteDe = u => Math.max(0, ...u.folhas.filter(f => f.type === 'text').map(f => +f.fontSize || 0));
  const titulos = vivos.filter(u => u.tipo === 'titulo');
  if(titulos.length){
    const corpo = Math.max(...titulos.map(fonteDe));
    const tb = { y0: Math.min(...titulos.map(u => u.y0)), y1: Math.max(...titulos.map(u => u.y1)) };
    const folga = (tb.y1 - tb.y0) * .5;
    vivos.forEach(u => {
      if(u.tipo === 'texto' && !temCampo(u) && fonteDe(u) >= corpo * .4 && u.y0 <= tb.y1 + folga && u.y1 >= tb.y0 - folga) u.tipo = 'titulo';
    });
  }
  // Carona: o que está dentro de uma forma ou faixa viaja com ela (o preço chega NA placa).
  vivos.forEach(u => {
    if(u.tipo === 'revela' || u.tipo === 'forma' || u.tipo === 'faixa' || u.tipo === 'painel') return;
    const dona = vivos.filter(d => (d.tipo === 'forma' || d.tipo === 'faixa') && contem(d, u))
      .sort((a, b) => (a.x1 - a.x0) * (a.y1 - a.y0) - (b.x1 - b.x0) * (b.y1 - b.y0))[0];
    if(dona) u.carona = dona;
  });
  vivos.forEach(u => { u.de = _fMoDe(u, W, H); u.dur = _F_MO_DUR[u.tipo] || .5; });

  // Ordem de leitura: na MESMA linha (sobreposição vertical de metade da menor altura), da
  // esquerda para a direita; senão, de cima para baixo. "DO" antes de "XIS" mesmo com o XIS
  // começando 15 px mais alto.
  const leitura = (a, b) => {
    const sobre = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0), menor = Math.min(a.y1 - a.y0, b.y1 - b.y0);
    return (sobre > menor * .5) ? (a.ox - b.ox) : (a.topo - b.topo);
  };
  const fim = lista => Math.max(0, ...lista.map(u => u.ini + u.dur));
  vivos.filter(u => u.tipo === 'marca').sort(leitura).forEach((u, i) => { u.ini = .15 + i * .05; });
  const principal = vivos.filter(u => !u.carona && ['titulo', 'texto', 'foto', 'painel', 'forma'].includes(u.tipo)).sort(leitura);
  const passo = principal.length > 1 ? Math.min(.18, 1 / (principal.length - 1)) : 0;
  principal.forEach((u, i) => { u.ini = .35 + i * passo; });
  // Conteúdo de painel espera o painel quase assentar (o card chega, depois o que mora nele).
  principal.forEach(u => {
    const painel = principal.find(d => d.tipo === 'painel' && contem(d, u));
    if(painel) u.ini = Math.max(u.ini, painel.ini + painel.dur * .5);
  });
  vivos.filter(u => u.tipo === 'revela').sort(leitura).forEach((u, i) => {
    const b = u.base; u.ini = Math.max(.35, (b.ini || 0) + (b.dur || 0)) + i * .1;
  });
  const fimMontagem = fim(vivos.filter(u => ['marca', 'titulo', 'texto', 'foto', 'painel', 'forma', 'revela'].includes(u.tipo) && !u.carona));
  const adesivos = vivos.filter(u => u.tipo === 'adesivo').sort(leitura);
  adesivos.forEach((u, i) => { u.ini = Math.max(.35, fimMontagem - .25) + i * .12; });
  const faixas = vivos.filter(u => u.tipo === 'faixa').sort(leitura);
  const iniFaixa = Math.max(.35, adesivos.length ? fim(adesivos) - .3 : fimMontagem - .2);
  faixas.forEach((u, i) => { u.ini = iniFaixa + i * .12; });
  vivos.filter(u => u.carona).forEach(u => { u.ini = u.carona.ini + .06; });
  const fimTudo = fim(vivos.filter(u => u.tipo !== 'legal'));
  vivos.filter(u => u.tipo === 'legal' && !u.carona).forEach(u => { u.ini = Math.max(.35, fimTudo - .3); });
  return plano;
}

const _F_MO_DUR = { marca: .5, titulo: .55, texto: .5, foto: .6, painel: .6, forma: .45, faixa: .55, adesivo: .5, revela: .65, legal: .5 };

// Onde a unidade começa: deslocamento (px), escala e giro (graus) iniciais — lidos da peça.
function _fMoDe(u, W, H){
  const zero = { dx: 0, dy: 0, s: 1, g: 0 };
  switch(u.tipo){
    case 'marca': case 'legal': return zero;
    case 'titulo': return { dx: 0, dy: 0, s: .82, g: -3 };
    case 'painel': return { dx: 0, dy: H * .06, s: 1, g: 0 };
    case 'forma': return { dx: 0, dy: H * .02, s: .92, g: 0 };
    case 'faixa': return u.y1 >= H - 2 ? { dx: 0, dy: H - u.y0 + 12, s: 1, g: 0 } : { dx: 0, dy: -(u.y1 + 12), s: 1, g: 0 };
    case 'adesivo': return { dx: 0, dy: 0, s: .4, g: u.ox < W / 2 ? -12 : 12 };
    case 'revela': return { dx: 0, dy: (u.y1 - u.y0) * .45, s: 1, g: 0 };
    case 'foto':
      if(u.x0 <= 1 && u.x1 < W - 1) return { dx: -W * .04, dy: 0, s: 1, g: 0 };
      if(u.x1 >= W - 1 && u.x0 > 1) return { dx: W * .04, dy: 0, s: 1, g: 0 };
      if(u.y1 >= H - 1) return { dx: 0, dy: H * .03, s: 1, g: 0 };
      return { dx: 0, dy: H * .02, s: 1.03, g: 0 };   // foto solta: sobe e assenta de leve
    default: {    // texto, preço, CTA: do lado onde mora, sem escala nem pulo
      const cx = u.ox / W;
      if(cx < .35) return { dx: -W * .025, dy: 0, s: 1, g: 0 };
      if(cx > .65) return { dx: W * .025, dy: 0, s: 1, g: 0 };
      return { dx: 0, dy: H * .015, s: 1, g: 0 };
    }
  }
}

// O estado de UMA unidade no instante t (segundos). `geo` = deslocamento de GEOMETRIA (revela).
function _fMotionEstado(u, t, W, H){
  /* Fundo PARADO, como na referência: a espera é para ler a oferta. E é o que deixa
     `fGenMP4` reaproveitar o quadro final em vez de redesenhar ~5 s de arte idêntica. */
  if(u.papel === 'fundo') return { a: 1, dx: 0, dy: 0, s: 1, g: 0 };
  const mov = u.carona || u;           // carona usa o movimento do contêiner, com o próprio início
  const p = _fMoProg(t, u.ini, mov.dur);
  const e = mov.tipo === 'adesivo' ? _fMoAssenta(p) : _fMoSuave(p);
  const de = mov.de;
  // Faixa vem de fora da arte: aparece inteira (esmaecer na borda pareceria fantasma).
  const a = mov.tipo === 'faixa' ? (p > 0 ? 1 : 0) : _fMoSuave(Math.min(1, p / (mov.tipo === 'revela' ? .3 : .7)));
  if(u.tipo === 'revela') return { a, dx: 0, dy: 0, s: 1, g: 0, geo: (1 - e) * de.dy };
  return { a, dx: (1 - e) * de.dx, dy: (1 - e) * de.dy, s: de.s + (1 - de.s) * e, g: (1 - e) * de.g,
    ox: u.carona ? mov.ox : u.ox, oy: u.carona ? mov.oy : u.oy };
}

// Clones do quadro t. Nada do material é tocado: cada quadro nasce do resolvido.
function _fMotionQuadro(resolvidas, plano, t, W, H){
  const fx = new Map();      // id → props a sobrepor
  const esmaece = (l, a) => {
    const atual = fx.get(l.id) || {};
    atual.opacity = (l.opacity != null ? l.opacity : 100) * a;
    fx.set(l.id, atual);
  };
  const porPai = new Map();
  resolvidas.forEach(l => { if(l && l.parentId){ if(!porPai.has(l.parentId)) porPai.set(l.parentId, []); porPai.get(l.parentId).push(l); } });
  const esmaeceArvore = (l, a) => {
    if(l.type !== 'group') return esmaece(l, a);
    if(_fMoGrupoComposto(l)) return esmaece(l, a);
    (porPai.get(l.id) || []).forEach(f => esmaeceArvore(f, a));
  };
  plano.forEach(u => {
    const e = _fMotionEstado(u, t, W, H);
    const ox = e.ox != null ? e.ox : u.ox, oy = e.oy != null ? e.oy : u.oy;
    if(e.s !== 1 || e.dx || e.dy || e.g){
      u.folhas.forEach(f => { const o = fx.get(f.id) || {}; Object.assign(o, { _fxEscala: e.s, _fxOx: ox, _fxOy: oy, _fxDx: e.dx, _fxDy: e.dy, _fxGiro: e.g }); fx.set(f.id, o); });
    }
    /* REVELA: move a GEOMETRIA, não o quadro — o recorte tem que ficar parado na base enquanto a
       foto sobe por dentro. Sem o snapshot, o motor recorta pela base VIVA em vez do alfa
       congelado do PSD (que andaria junto com a foto). No quadro final (geo 0) nada é tocado:
       volta o recorte original, idêntico ao PNG. */
    if(e.geo){
      const l = u.raiz, o = fx.get(l.id) || {};
      Object.assign(o, { y: (+l.y || 0) + e.geo, clipBaseSnapshot: null }); fx.set(l.id, o);
    }
    if(e.a < 1){
      // Unidade atômica (folha ou grupo de composição) esmaece inteira; a folha agregada por
      // clipping está fora da árvore da raiz e esmaece por conta própria, junto da base.
      esmaeceArvore(u.raiz, e.a);
      u.extras.forEach(f => esmaece(f, e.a));
    }
  });
  return resolvidas.map(l => (l && fx.has(l.id)) ? Object.assign({}, l, fx.get(l.id)) : l);
}

/* ── MUXER MP4 MÍNIMO ────────────────────────────────────────────────────────────
   ISO/IEC 14496-12 + 14496-15 (avcC). Só o que um vídeo de uma faixa precisa. Amostras em
   ordem de decodificação = de apresentação (o VideoEncoder não emite B-frame), então sem ctts.
   Escala de tempo 60000 com delta 1000 (60 fps): inteiro, sem a deriva de 16.666,67 µs. */
function _fMp4Monta(amostras, avcC, W, H, fps, cor){
  const u32 = v => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
  const u16 = v => [(v >>> 8) & 255, v & 255];
  const str = s => [...s].map(c => c.charCodeAt(0));
  const junta = partes => {
    let n = 0; partes.forEach(p => n += p.length);
    const out = new Uint8Array(n); let o = 0;
    partes.forEach(p => { out.set(p, o); o += p.length; });
    return out;
  };
  const caixa = (tipo, ...partes) => {
    const corpo = junta(partes.map(p => p instanceof Uint8Array ? p : new Uint8Array(p)));
    return junta([new Uint8Array(u32(corpo.length + 8)), new Uint8Array(str(tipo)), corpo]);
  };
  const cheia = (tipo, versao, flags, ...partes) => caixa(tipo, [versao, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255], ...partes);
  const MATRIZ = [...u32(0x00010000), ...u32(0), ...u32(0), ...u32(0), ...u32(0x00010000), ...u32(0), ...u32(0), ...u32(0), ...u32(0x40000000)];
  const N = amostras.length, ESCALA = fps * 1000, DUR_MS = Math.round(N * 1000 / fps);

  const stbl = base => caixa('stbl',
    cheia('stsd', 0, 0, u32(1),
      caixa('avc1', new Array(6).fill(0), u16(1), new Array(16).fill(0), u16(W), u16(H),
        u32(0x00480000), u32(0x00480000), u32(0), u16(1), new Array(32).fill(0), u16(0x0018), u16(0xFFFF),
        caixa('avcC', avcC),
        ...(cor ? [caixa('colr', str('nclx'), u16(cor.p), u16(cor.t), u16(cor.m), [cor.full ? 0x80 : 0])] : []))),
    cheia('stts', 0, 0, u32(1), u32(N), u32(1000)),
    cheia('stss', 0, 0, u32(amostras.filter(a => a.chave).length), ...amostras.map((a, i) => a.chave ? u32(i + 1) : []).filter(x => x.length)),
    cheia('stsc', 0, 0, u32(1), u32(1), u32(N), u32(1)),
    cheia('stsz', 0, 0, u32(0), u32(N), ...amostras.map(a => u32(a.dados.length))),
    cheia('stco', 0, 0, u32(1), u32(base)));

  const moov = base => caixa('moov',
    cheia('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(DUR_MS), u32(0x00010000), u16(0x0100), new Array(10).fill(0), MATRIZ, new Array(24).fill(0), u32(2)),
    caixa('trak',
      cheia('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(DUR_MS), new Array(8).fill(0), u16(0), u16(0), u16(0), u16(0), MATRIZ, u32(W * 65536), u32(H * 65536)),
      caixa('mdia',
        cheia('mdhd', 0, 0, u32(0), u32(0), u32(ESCALA), u32(N * 1000), u16(0x55C4), u16(0)),
        cheia('hdlr', 0, 0, u32(0), str('vide'), new Array(12).fill(0), str('Luma Video'), [0]),
        caixa('minf',
          cheia('vmhd', 0, 1, u16(0), u16(0), u16(0), u16(0)),
          caixa('dinf', cheia('dref', 0, 0, u32(1), cheia('url ', 0, 1))),
          stbl(base)))));

  const ftyp = caixa('ftyp', str('isom'), u32(512), str('isom'), str('iso2'), str('avc1'), str('mp41'));
  // O tamanho do moov não depende do valor do offset (stco de 32 bits): mede com 0, monta de novo.
  const tamMoov = moov(0).length;
  let tamDados = 0; amostras.forEach(a => tamDados += a.dados.length);
  const cabMdat = new Uint8Array([...u32(tamDados + 8), ...str('mdat')]);
  return new Blob([ftyp, moov(ftyp.length + tamMoov + 8), cabMdat, ...amostras.map(a => a.dados)], { type: 'video/mp4' });
}

// VideoColorSpace → códigos do `colr` (ISO/IEC 23091-2). Desconhecido → sem `colr`.
function _fMp4Cor(cs){
  if(!cs) return null;
  const P = { bt709: 1, bt470bg: 5, smpte170m: 6, bt2020: 9 }, TR = { bt709: 1, smpte170m: 6, 'iec61966-2-1': 13, linear: 8 }, M = { rgb: 0, bt709: 1, bt470bg: 5, smpte170m: 6 };
  if(!(cs.primaries in P) || !(cs.transfer in TR) || !(cs.matrix in M)) return null;
  return { p: P[cs.primaries], t: TR[cs.transfer], m: M[cs.matrix], full: !!cs.fullRange };
}

// Devolve a vez ao navegador (pinta o estúdio) sem cair no freio de 1 s que o setTimeout leva
// em aba de fundo: MessageChannel é tarefa comum, não timer.
const _fMoCede = () => new Promise(r => { const mc = new MessageChannel(); mc.port1.onmessage = () => r(); mc.port2.postMessage(0); });

/* ── O VÍDEO ─────────────────────────────────────────────────────────────────── */
// Gera o MP4 da arte. `onProgresso(0..1, nMov, nTot)` acompanha os quadros. Devolve {blob, fname}.
// opcoes.aoPlanejar(plano, resolvidas, W, H, tAssenta): esperado ANTES do encoder — o estúdio
//   separa as peças ali (motion-estudio.js). opcoes.ceder: solta o laço a cada ~24 ms para o
//   estúdio animar; sem isto o encoder segura a thread e o teatro congela.
async function fGenMP4(d, c, fmt, material, onProgresso, opcoes){
  opcoes = opcoes || {};
  if(!fMotionDisponivel()) { const e = new Error('Este navegador não gera vídeo.'); e.code = 'LUMA_VIDEO_UNSUPPORTED'; throw e; }
  if(!(material && material.layers && material.layers.length)) throw new Error('Arte sem camadas para animar.');
  const [W, H] = fMaterialSize(material, fmt);

  let config = null;
  for(const codec of F_MOTION_CODECS){
    const tentativa = { codec, width: W, height: H, bitrate: F_MOTION_BITRATE, framerate: F_MOTION_FPS, latencyMode: 'quality', avc: { format: 'avc' } };
    try{ const r = await VideoEncoder.isConfigSupported(tentativa); if(r && r.supported) { config = r.config || tentativa; break; } }catch(e){}
  }
  if(!config) { const e = new Error('Este navegador não gera vídeo H.264.'); e.code = 'LUMA_VIDEO_UNSUPPORTED'; throw e; }

  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { alpha: false });
  // UMA resolução de layout para o vídeo inteiro — e o mesmo bloqueio "não cabe" do PNG.
  // (O `soLayout` ainda pinta o fundo no ctx antes de sair; o 1º quadro o cobre.)
  const resolvidas = await fRenderTemplateLayers(ctx, material.layers, W, H, d, c, material,
    { scope: 'franqueado', purpose: 'export', soLayout: true });
  const plano = _fMotionPlano(resolvidas, W, H);
  // Depois daqui nada se mexe: o canvas fica com o quadro final e só se re-encoda.
  const tAssenta = Math.max(0, ...plano.filter(u => u.papel !== 'fundo').map(u => u.ini + (u.carona || u).dur));
  if(opcoes.aoPlanejar){ try{ await opcoes.aoPlanejar(plano, resolvidas, W, H, tAssenta); }catch(e){ console.warn('[motion] estúdio:', e); } }
  const nMov = Math.min(F_MOTION_FPS * F_MOTION_SEG, Math.ceil((tAssenta + 1 / F_MOTION_FPS) * F_MOTION_FPS) + 1);
  let cedeuEm = performance.now();

  const amostras = []; let avcC = null, cor = null, erro = null;
  const enc = new VideoEncoder({
    output: (chunk, meta) => {
      const dados = new Uint8Array(chunk.byteLength); chunk.copyTo(dados);
      amostras.push({ dados, chave: chunk.type === 'key' });
      if(!avcC && meta && meta.decoderConfig && meta.decoderConfig.description){
        const desc = meta.decoderConfig.description;   // ArrayBuffer ou view com offset
        avcC = ArrayBuffer.isView(desc) ? new Uint8Array(desc.buffer, desc.byteOffset, desc.byteLength).slice() : new Uint8Array(desc).slice();
        cor = _fMp4Cor(meta.decoderConfig.colorSpace);
      }
    },
    error: e => { erro = e; }
  });
  enc.configure(config);
  const N = F_MOTION_FPS * F_MOTION_SEG, US = 1e6 / F_MOTION_FPS;
  try{
    for(let i = 0; i < N; i++){
      if(erro) throw erro;
      const t = i / F_MOTION_FPS, parado = t > tAssenta + 1 / F_MOTION_FPS && i > 0;
      if(!parado){
        // Fundo transparente não existe em H.264: sem este preto, o "vazio" viraria lixo do quadro anterior.
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, W, H);
        await fRenderTemplateLayers(ctx, _fMotionQuadro(resolvidas, plano, t, W, H), W, H, d, c, material,
          { scope: 'franqueado', purpose: 'export', resolvido: true });
      }
      const quadro = new VideoFrame(cv, { timestamp: Math.round(i * US), duration: Math.round(US) });
      enc.encode(quadro, { keyFrame: i % F_MOTION_FPS === 0 });   // chave a cada 1 s: o player pula sem travar
      quadro.close();
      while(enc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 4));
      if(onProgresso) onProgresso((i + 1) / N, nMov, N);
      if(opcoes.ceder && performance.now() - cedeuEm > 40){ await _fMoCede(); cedeuEm = performance.now(); }
    }
    await enc.flush();
    if(erro) throw erro;
  } finally { try{ enc.close(); }catch(e){} }
  if(!avcC || amostras.length !== N) throw new Error('O codificador de vídeo não devolveu todos os quadros.');
  const fname = fBuildFilename(c, fmt, d).replace(/\.png$/i, '') + '.mp4';
  return { blob: _fMp4Monta(amostras, avcC, W, H, F_MOTION_FPS, cor), fname };
}

/* Enquanto o MP4 renderiza, sair da aba/janela custa o vídeo: o navegador pausa o canvas em
   segundo plano e fechar a aba joga o trabalho fora. Trava de saída enquanto gera. */
let _fVideoRenderizando = false;
function _fVideoAntesDeSair(e){ if(_fVideoRenderizando){ e.preventDefault(); e.returnValue = ''; return ''; } }
window.addEventListener('beforeunload', _fVideoAntesDeSair);

const _F_MOTION_ICONE_BAIXAR = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="4" x2="12" y2="16"/><polyline points="18 11 12 17 6 11"/><path d="M5 20h14"/></svg>';

/* O botão "Virar motion" do card (30/10/2026). Dois tempos:
   1. a 1ª vez GERA: abre o estúdio de motion (motion-estudio.js) por cima do app, que monta a
      animação ao vivo enquanto o encoder grava, e no fim devolve o vídeo para o mockup;
   2. pronto o vídeo, o mesmo botão vira "Baixar vídeo" (`fBaixarMotion`). O download saiu do fim
      da geração de propósito: depois de 20 s gerando, o iOS já não aceitava o share (o gesto do
      toque tinha expirado); agora o share nasce de um toque novo.
   Movimento reduzido: o estúdio ABRE mesmo assim (30/10, Ryan: "não tá aparecendo" — o Windows
   com "Efeitos de animação" desligado manda `prefers-reduced-motion` e o estúdio era pulado).
   Ver o designer trabalhar é o que a pessoa pediu ao clicar, como dar play num vídeo; o que o
   modo reduzido corta são os enfeites (voo em arco, mola, faíscas), dentro do motion-estudio.js. */
async function fVirarMotion(btn, snapId){
  if(typeof gFeatureCan === 'function' && !gFeatureCan('franqueado.export.video', 'execute')){
    if(typeof gFeatureBlockedFeedback === 'function') gFeatureBlockedFeedback('franqueado.export.video');
    return;
  }
  if(snapId && typeof _fMotionVideos !== 'undefined' && _fMotionVideos[snapId]) return fBaixarMotion(btn, snapId);
  if(_fVideoRenderizando) return;
  const snap = (snapId && typeof _fArtSnapshots !== 'undefined' && _fArtSnapshots[snapId])
    || { dados: fState.dados, camp: fState.camp, fmt: fState.fmt, histId: fState._lastHistId, material: fState.material };
  const material = snap.material || fState.material;
  const reduz = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;
  const restore = gBtnLoading(btn, 'Virando motion…');
  const rotulo = btn && btn.querySelector('span:last-child');
  _fVideoRenderizando = true;
  let estudio = null;
  if(typeof fMotionEstudio === 'function'){
    try{ estudio = fMotionEstudio(document.getElementById(snapId), { dados: snap.dados, camp: snap.camp, material }); }
    catch(e){ console.warn('[motion] estúdio não abriu:', e); estudio = null; }
  }
  // Sem estúdio: modal, não toast — toast some em 3 s e quem troca de aba perde o vídeo.
  if(!estudio) gAviso('O vídeo está sendo gerado. Não feche nem saia desta janela, e mantenha esta aba aberta na frente até terminar — senão o vídeo se perde.',
    { id: 'video-render', title: 'Gerando seu vídeo' });
  let ok = false;
  try{
    const { blob, fname } = await fGenMP4(snap.dados, snap.camp, snap.fmt, material,
      (p, nMov, nTot) => { if(rotulo) rotulo.textContent = 'Virando motion… ' + Math.round(p * 100) + '%'; if(estudio) estudio.progresso(p, nMov, nTot); },
      estudio ? { aoPlanejar: (plano, resolvidas, W, H, tA) => estudio.prepara(plano, resolvidas, W, H, tA), ceder: true } : null);
    const url = URL.createObjectURL(blob);
    if(snapId) _fMotionVideos[snapId] = { blob, fname, url };
    _fVideoRenderizando = false;
    restore(); ok = true;
    if(btn){ btn.innerHTML = _F_MOTION_ICONE_BAIXAR + 'Baixar vídeo'; btn.classList.add('pri', 'f-motion-pronto'); btn.title = 'Baixar o Story animado (MP4 de ' + F_MOTION_SEG + ' s)'; }
    const destino = (typeof fMotionDestino === 'function') ? fMotionDestino(snapId) : null;
    if(estudio) await estudio.entrega(url, destino);
    else if(destino && typeof fMotionMontaNoSlot === 'function') fMotionMontaNoSlot(destino);
    if(btn && !reduz && typeof _fMeTok === 'function')
      btn.animate([{ scale: '1' }, { scale: '1.06', offset: .4 }, { scale: '1' }], { duration: _fMeTok('--dur-slow'), easing: _fMeEase('--ease-spring') });
    if(typeof window.gPlayExportSuccessSound === 'function') window.gPlayExportSuccessSound();
  }catch(e){
    console.warn('Falha ao gerar vídeo:', e);
    if(estudio) estudio.falha();
    if(typeof gHandleLayoutUnsafeError === 'function' && gHandleLayoutUnsafeError(e)) return;
    gToast(e && e.code === 'LUMA_VIDEO_UNSUPPORTED' ? 'Este navegador não gera vídeo. Use o Chrome, o Edge ou o Safari atualizados.'
      : e && e.code === 'LUMA_IMAGE_UNAVAILABLE' ? e.message : 'Não consegui gerar o vídeo. Tente de novo.', 'error');
  }finally{ _fVideoRenderizando = false; if(!estudio) gAvisoFechar('video-render'); if(!ok) restore(); }
}

// O download do vídeo já pronto. Mesmo funil do fBaixar: folha nativa no celular, histórico e evento.
async function fBaixarMotion(btn, snapId){
  const reg = typeof _fMotionVideos !== 'undefined' && _fMotionVideos[snapId];
  if(!reg) return;
  const snap = (snapId && typeof _fArtSnapshots !== 'undefined' && _fArtSnapshots[snapId])
    || { dados: fState.dados, camp: fState.camp, fmt: fState.fmt, histId: fState._lastHistId, material: fState.material };
  const file = new File([reg.blob], reg.fname, { type: 'video/mp4' });
  let via = 'download';
  if(typeof _fArteEhCelular === 'function' && _fArteEhCelular()){
    let podeShare = false;
    try{ podeShare = !!(navigator.canShare && navigator.canShare({ files: [file] })); }catch(e){}
    if(podeShare){
      try{ await navigator.share({ files: [file] }); via = 'share'; }
      catch(e){ if(e && e.name === 'AbortError') return; }
    }
  }
  if(via === 'download'){
    const a = document.createElement('a');
    a.download = reg.fname; a.href = reg.url; a.click();
  }
  if(snap.histId) fMarkHistBaixada(snap.histId);
  else fAddHist(snap.dados, snap.camp, snap.fmt, 'baixada');
  if(typeof gTrackEvent === 'function') gTrackEvent('arte_baixada', { camp_id: snap.camp.id, fmt_id: snap.fmt.id,
    template_id: (typeof _fTplId === 'function') ? _fTplId(snap.material) : null, tipo: 'mp4', origem: 'chat', via });
  gToast(via === 'share' ? 'Vídeo pronto!' : 'Vídeo baixado!');
}
