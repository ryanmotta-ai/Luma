/**
 * js/franqueado/live-preview.js
 *
 * Preview lateral em tempo real (fUpdateLivePreview) e modal de preview
 * multi-formato (fOpenPreview, fClosePreview, fStartFromPreview).
 * Depende de: 00-config.js, 01-state.js
 */

/* ── PREVIEW MODAL ── */
function fOpenPreview(e,id){
  e.stopPropagation();
  const c=(typeof fResolveCamp==='function')?fResolveCamp(id):[...CAMPS_ATIVAS,...CAMPS_OUTRAS].find(x=>x.id===id);
  if(!c)return;
  document.getElementById('pv-title').textContent=c.name;
  // Contagem HONESTA: materiais realmente publicados e válidos (não o count estático do
  // config). Fallback: count do config → templates.length.
  let _count;
  try{
    _count=(typeof fGetMaterialsForCamp==='function')
      ? fGetMaterialsForCamp(c.id).filter(m=>(typeof fIsMaterialValid!=='function')||fIsMaterialValid(m)).length
      : null;
  }catch(e){ _count=null; }
  if(_count==null||_count===0) _count=(c.count!=null)?c.count:(c.templates?c.templates.length:0);
  const _exp=(c.expiraDias!=null)?` · Expira em ${c.expiraDias} dias`:'';
  document.getElementById('pv-note').textContent=`${_count} materiais${_exp}`;
  // F-09: monta os 3 formatos lado a lado, cada um clicável
  const multi = document.getElementById('pv-multi');
  multi.innerHTML = FMTS.map(f=>{
    const cls = `pv-multi-canvas pv-fmt-${f.id}`;
    return `<div class="pv-multi-item" onclick="fStartFromPreview('${c.id}','${f.id}')" role="button" tabindex="0">
      <div class="${cls}" style="background:${c.color}">
        <div class="pv-multi-tag">${gEsc(c.name.toUpperCase())}</div>
        <div class="pv-multi-prod">${gEsc(c.previewProd||c.name)}</div>
        ${c.previewDe?`<div class="pv-multi-de">${gEsc(c.previewDe)}</div>`:''}
        ${c.previewPor?`<div class="pv-multi-por">${gEsc(c.previewPor)}</div>`:''}
        <div class="pv-multi-logo" role="img" aria-label="Luma"></div>
      </div>
      <div class="pv-multi-label">
        <span class="pv-multi-fmt-name">${f.name}</span>
        <span class="pv-multi-fmt-dim">${f.dim}</span>
      </div>
    </div>`;
  }).join('');
  document.getElementById('f-preview-modal').classList.add('open');
}
// F-09: começar campanha + formato direto do modal
function fStartFromPreview(campId, fmtId){
  fClosePreview();
  const f = FMTS.find(x=>x.id===fmtId);
  if(f) fState.fmt = f;
  fRenderFmts();
  fSelectCamp(campId);
}
function fClosePreview(){document.getElementById('f-preview-modal').classList.remove('open');}
document.getElementById('f-preview-modal').addEventListener('click',function(e){if(e.target===this)fClosePreview();});


/* ── LIVE PREVIEW (F-01) ──
   Renderiza o template REAL publicado pelo designer no canvas #lp-canvas,
   substituindo {{var}} pelos dados já preenchidos em fState.dados. Usa o mesmo
   motor do PNG final (fRenderTemplateLayers), então a prévia bate com a arte
   gerada. Variáveis ainda não preenchidas (e sem default do designer) aparecem
   como placeholder {{var}} com um véu sutil indicando que faltam.
   Depende de: png-generator.js (fRenderTemplateLayers, roundedRect),
   00-config.js (gVarRegex, gVarDefaults). */
const F_FIELD_LABELS = {
  produto:'Produto',precoDe:'Preço original',precoPor:'Preço promo',validade:'Validade',
  desconto:'Desconto',pedidoMin:'Pedido mínimo',bairros:'Cobertura',codigo:'Código',
  condicao:'Condição',brinde:'Brinde',categoria:'Categoria',oferta:'Oferta'
};
// Bancos de dados de exemplos realistas por segmento de produto
const F_LP_CONTEXT_EXAMPLES = {
  pizzas: {
    produto: 'Pizza de Calabresa G',
    precoPor: 'R$ 39,90',
    precoDe: 'R$ 49,90',
    validade: 'só neste fim de semana',
    desconto: '20% off',
    pedidoMin: 'R$ 30,00',
    bairros: 'Centro e bairros próximos',
    codigo: 'QUEROPIZZA',
    condicao: 'exclusivo no aplicativo',
    brinde: 'borda recheada grátis',
    categoria: 'Pizzas',
    oferta: 'Compre uma pizza G, ganhe um refri 2L'
  },
  lanches: {
    produto: 'Cheddar Burger Duplo',
    precoPor: 'R$ 29,90',
    precoDe: 'R$ 34,90',
    validade: 'apenas hoje no jantar',
    desconto: '15% off',
    pedidoMin: 'R$ 25,00',
    bairros: 'Entrega em toda a cidade',
    codigo: 'BURGER15',
    condicao: 'somente no delivery',
    brinde: 'batata frita individual grátis',
    categoria: 'Lanches',
    oferta: 'Combo Burger + Fritas + Refri'
  },
  japonesa: {
    produto: 'Combo Premium 30 Peças',
    precoPor: 'R$ 59,90',
    precoDe: 'R$ 79,90',
    validade: 'válido de terça a quinta',
    desconto: '25% off',
    pedidoMin: 'R$ 50,00',
    bairros: 'Raio de até 5km',
    codigo: 'JAPATOP',
    condicao: 'pedidos pelo app',
    brinde: 'hot roll cortesia',
    categoria: 'Comida Japonesa',
    oferta: 'Ganhe 5 hot rolls de brinde'
  },
  doces: {
    produto: 'Açaí 500ml Turbinado',
    precoPor: 'R$ 19,90',
    precoDe: 'R$ 24,90',
    validade: 'válido até domingo',
    desconto: '20% off',
    pedidoMin: 'R$ 15,00',
    bairros: 'Consulte bairros atendidos',
    codigo: 'SOBREMESA20',
    condicao: 'não acumulativo',
    brinde: 'leite condensado extra grátis',
    categoria: 'Doces e Bebidas',
    oferta: 'Adicione 3 acompanhamentos grátis'
  },
  universal: {
    produto: 'Prato Feito Executivo',
    precoPor: 'R$ 22,90',
    precoDe: 'R$ 28,00',
    validade: 'de segunda a sexta das 11h às 14h',
    desconto: 'R$ 5,00 off',
    pedidoMin: 'R$ 20,00',
    bairros: 'Centro e Centro-Sul',
    codigo: 'ALMOCOTAL',
    condicao: 'válido no app',
    brinde: 'sobremesa de brinde',
    categoria: 'Refeições',
    oferta: 'Suco grátis acompanhando o prato'
  }
};

// Infere semanticamente o segmento do material ativo baseado no nome da campanha e do material
function _fLpGuessSegment() {
  const campName = String(fState.camp?.name || '').toLowerCase();
  const matName = String(fState.material?.name || '').toLowerCase();
  const combined = campName + ' ' + matName;
  
  if (/pizza|pizzaria|calabresa|borda/i.test(combined)) return 'pizzas';
  if (/burger|burguer|lanche|combo|artesanal|hamburguer|hambúrguer/i.test(combined)) return 'lanches';
  if (/sushi|temaki|japa|japanese|peixe/i.test(combined)) return 'japonesa';
  if (/doce|sobremesa|açai|açaí|sorvete|milkshake|brownie|pudim|bolo/i.test(combined)) return 'doces';
  
  return 'universal';
}
// Dimensões por formato — espelha o png-generator (cobre 'post' e 'wide', que o
// DFMT_SIZES do designer não tem). fState.fmt.id pode ser 'post'.
const F_LP_SIZES = {story:[1080,1920], feed:[1080,1350], wide:[1200,628], post:[1200,628]};

let _lpRendering = false;
let _lpPendingRender = false;
let _lpScale = 1;        // escala real prévia ÷ arte final (mostrada na toolbar)
// (o antigo _lpGuides virou _lpView — ver fLpSetView, mais abaixo)
let _lpFraming = null;   // {layer, varName} enquanto o franqueado enquadra a foto (trava o zoom automático)
let _lpOverflow = new Set(); // ids de camadas de texto com estouro no último render (avisos)
let _lpImgDims = {};     // cache url→{w,h} p/ aviso de baixa resolução sem recarregar

// Zoom/pan manual da prova digital (item: inspecionar a arte de perto).
// _lpUserZoom=1 é o ajuste à tela; >1 amplia. Pan em px de tela relativo ao centro do quadro.
// Tem PRIORIDADE sobre o smart-zoom do chat (que foca o campo ativo) — ver _fLpApplyCanvasFocus.
let _lpUserZoom = 1, _lpPanX = 0, _lpPanY = 0;
let _lpPanning = null, _lpDidPan = false, _lpSuppressClick = false;

async function fUpdateLivePreview(opts){
  opts = opts || {}; // animateField é ignorado: o canvas já reflete o estado atual
  const canvas = document.getElementById('lp-canvas');
  if(!canvas || canvas.tagName !== 'CANVAS') return;

  // Sem template ou sem camadas → estado vazio. (Material publicado sempre tem camadas;
  // não existe caminho de preview "só com bg" — o antigo caía num fRenderCanvasHelper de
  // assinatura incompatível que nem desenhava no lp-canvas.)
  if(!fState.material || !fState.material.layers || !fState.material.layers.length){
    fLpShowEmpty(canvas);
    fLpUpdateMeta(false);
    return;
  }

  // Render em andamento → agenda só mais um (coalesce de digitação rápida)
  if(_lpRendering){ _lpPendingRender = true; return; }
  _lpRendering = true;

  const stage = document.querySelector('.lp-stage');
  if(stage) stage.classList.add('loading');

  try {
    // Saiu do estado vazio → mostra o palco da arte
    if(stage) stage.classList.remove('empty');

    const fmtId = (fState.fmt && fState.fmt.id) || fState.material.fmt || 'story';
    const sz = F_LP_SIZES[fmtId] || F_LP_SIZES.story;
    // Template 1:1 do PSD guarda w/h reais → preview no tamanho exato; senão o preset por formato.
    const W = (fState.material.w>0) ? fState.material.w : sz[0];
    const H = (fState.material.h>0) ? fState.material.h : sz[1];
    // Arte diferente da anterior → zera o zoom/pan manual (senão a prova abre já ampliada/deslocada).
    if (canvas.width !== W || canvas.height !== H) { _lpUserZoom = 1; _lpPanX = 0; _lpPanY = 0; }
    canvas.width = W; canvas.height = H;
    fLpSizeCanvas(canvas, W, H);

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    // Dados preenchidos + placeholders {{var}} nos campos de texto ainda vazios
    // (e sem default do designer). dadosPreview é uma cópia — não mexe em fState.dados.
    const _defaults = (typeof gVarDefaults === 'function') ? gVarDefaults() : {};
    const dadosPreview = Object.assign({}, fState.dados || {});
    const pendentes = fLpInjectPlaceholders(fState.material.layers, dadosPreview, _defaults);

    {
      // Coleta overflow de texto durante ESTE render (só a prévia liga o coletor).
      window._fOverflowSink = new Set();
      await fRenderTemplateLayers(ctx, fState.material.layers, W, H, dadosPreview, fState.camp);
      _lpOverflow = window._fOverflowSink; window._fOverflowSink = null;

      // Véu sutil sobre os campos ainda não preenchidos (tom mais suave)
      fLpHighlightEmpty(ctx, fState.material.layers, pendentes, W, H);
      
      // Focus Sync: Destaque sutil no campo correspondente à pergunta ativa do chat
      const activeVar = fState.camp?.perguntas?.[fState.stepIdx]?.id;
      let activeLayer = null;
      if (activeVar) {
        activeLayer = fState.material.layers.find(l => {
          if (l.type === 'text' && l.content) {
            const re = gVarRegex();
            let match;
            while ((match = re.exec(l.content)) !== null) {
              if (match[1] === activeVar) return true;
            }
          }
          if ((l.type === 'image' || l.type === 'frame') && l.imgVar === activeVar) return true;
          return false;
        });
        if (activeLayer) {
          fLpHighlightActiveField(ctx, activeLayer, W, H);
        }
      }
      
      // Mesa infinita: o zoom/pan manual transforma o CARD; o smart-zoom do chat fica no canvas
      // e só age quando não há view manual.
      _fLpApplyUserView();
      _fLpApplyCanvasFocus(activeLayer, W, H);
    }

    if(_lpView==='guides') _fLpDrawGuides(ctx, W, H);
    else if(_lpView==='env') _fLpDrawEnvironment(ctx, W, H);

    // Micro-sinal de "vivo": anel que pulsa quando a prévia reflete uma resposta nova
    const wrap = canvas.closest('.lp-canvas-wrap');
    if(wrap){ wrap.classList.remove('updated'); void wrap.offsetWidth; wrap.classList.add('updated'); }

    fLpUpdateMeta(true);
    try{ fLpUpdateWarnings(); }catch(e){}
  } catch(e){
    console.warn('[lp] erro ao renderizar preview:', e);
    fLpShowEmpty(canvas);
    fLpUpdateMeta(true);
  } finally {
    _lpRendering = false;
    if(_lpPendingRender){
      _lpPendingRender = false;
      setTimeout(()=>fUpdateLivePreview(), 50);
    } else {
      const stage = document.querySelector('.lp-stage');
      if(stage) stage.classList.remove('loading');
    }
  }
}

let _fLpStageWidthCache = 264;
// Dimensiona o canvas para caber no .lp-stage sem distorcer (escala única).
function fLpSizeCanvas(canvas, W, H){
  const stage = canvas.closest('.lp-stage') || canvas.parentElement;
  if (stage && !stage._hasResizeObserver && typeof ResizeObserver !== 'undefined') {
    stage._hasResizeObserver = true;
    new ResizeObserver(entries => {
      if(entries && entries.length) {
        _fLpStageWidthCache = entries[0].contentRect.width;
      }
    }).observe(stage);
    _fLpStageWidthCache = stage.clientWidth;
  }
  const csW = stage ? _fLpStageWidthCache : 264;
  const availW = Math.max(120, csW - 36); // desconta o padding lateral do .lp-stage (18+18)
  const maxH = 380;
  const scale = Math.min(availW / W, maxH / H);
  canvas.style.width  = Math.round(W * scale) + 'px';
  canvas.style.height = Math.round(H * scale) + 'px';
  // Toolbar honesta: escala real da prévia (× zoom manual) + dimensões da arte final
  _lpScale = scale;
  _fLpUpdateZoomLabel();
  const dimEl = document.getElementById('lp-dim');
  if(dimEl) dimEl.textContent = W + '×' + H;
  // Amarra roda (zoom) e arrasto (pan) na MESA (.lp-stage) — uma única vez. Arrastar em qualquer
  // ponto da mesa (arte ou fundo) move a arte, como no Miro. (reusa o `stage` acima)
  if(stage && !stage._lpZoomBound){
    stage._lpZoomBound = true;
    stage.addEventListener('wheel', _fLpWheelZoom, {passive:false});
    stage.addEventListener('mousedown', _fLpPanDown);
  }
}

// Rótulo honesto na toolbar: escala real (ajuste × zoom manual) da prévia sobre a arte final.
function _fLpUpdateZoomLabel(){
  const zoomEl = document.getElementById('lp-zoom');
  if(zoomEl) zoomEl.textContent = Math.round(_lpScale * _lpUserZoom * 100) + '%';
}

// Reajusta a prévia à tela e RECENTRALIZA (botão da toolbar / clique no %). O resgate do
// "totalmente livre": por mais longe que a arte tenha ido, isto traz de volta ao centro em 100%.
function fLpRefit(){
  const canvas = document.getElementById('lp-canvas');
  if(!canvas || !canvas.width) return;
  _lpUserZoom = 1; _lpPanX = 0; _lpPanY = 0;
  const stage = canvas.closest('.lp-stage');
  if(stage) _fLpStageWidthCache = stage.clientWidth;
  fLpSizeCanvas(canvas, canvas.width, canvas.height);
  _fLpApplyUserView();                                  // recentra o card (com a mola do CSS)
  _fLpApplyCanvasFocus(null, canvas.width, canvas.height);
}

/* ══ ZOOM / PAN DA PROVA DIGITAL — mesa infinita (estilo Miro) ══
   O card da arte (.lp-canvas-wrap) FLUTUA no palco (.lp-stage, a mesa pontilhada, overflow:hidden
   = a viewport). O zoom/pan transforma o CARD (não o canvas): a arte pode crescer além da moldura
   e ser arrastada livremente pela mesa. O smart-zoom do chat continua no canvas, mas cede enquanto
   houver zoom/pan manual. Pan é LIVRE (sem clamp) — o botão Reajustar / % resgata ao centro. */

// Aplica pan+zoom manual ao CARD inteiro. transform-origin no centro → pan translada, zoom amplia.
function _fLpApplyUserView(){
  const wrap = document.querySelector('.lp-canvas-wrap');
  if(!wrap) return;
  wrap.style.transformOrigin = 'center center';
  wrap.style.transform = `translate(${_lpPanX}px, ${_lpPanY}px) scale(${_lpUserZoom})`;
  _fLpUpdateZoomLabel();
}

// Smart-zoom do chat no CANVAS — só quando NÃO há view manual (senão cederia e composição confusa).
function _fLpApplyCanvasFocus(activeLayer, W, H){
  const canvas = document.getElementById('lp-canvas');
  if(!canvas) return;
  const manual = (_lpUserZoom !== 1 || _lpPanX !== 0 || _lpPanY !== 0);
  if(!manual && activeLayer && !fState.done && !_lpFraming){
    const cx = activeLayer.x + activeLayer.w / 2;
    const cy = activeLayer.y + activeLayer.h / 2;
    const px = Math.min(100, Math.max(0, (cx / W) * 100));
    const py = Math.min(100, Math.max(0, (cy / H) * 100));
    canvas.style.transformOrigin = `${px.toFixed(1)}% ${py.toFixed(1)}%`;
    canvas.style.transform = 'scale(1.8)';
  } else {
    canvas.style.transformOrigin = 'center center';
    canvas.style.transform = 'scale(1)';
  }
}

// Cursor de mesa: grabbing enquanto arrasta (classe no palco; o CSS mostra grab em repouso).
function _fLpUpdatePanCursor(dragging){
  const stage = document.querySelector('.lp-stage');
  if(stage) stage.classList.toggle('lp-panning', !!dragging);
}

// Zoom mantendo fixo o ponto (sx,sy) da tela — usado pela roda (cursor) e pelos botões (centro).
// Centro natural do card = centro visual atual − pan (transform translate+scale, origin center).
function _fLpZoomAround(next, sx, sy){
  const wrap = document.querySelector('.lp-canvas-wrap');
  if(!wrap) return;
  const old = _lpUserZoom;
  next = Math.max(1, Math.min(6, next));
  if(next === old) return;
  const r = wrap.getBoundingClientRect();
  const cx = sx - (r.left + r.width / 2 - _lpPanX);
  const cy = sy - (r.top + r.height / 2 - _lpPanY);
  const k = next / old;
  _lpPanX = cx - k * (cx - _lpPanX);
  _lpPanY = cy - k * (cy - _lpPanY);
  _lpUserZoom = next;
  if(next === 1){ _lpPanX = 0; _lpPanY = 0; } // volta ao fit → recentra
  wrap.classList.add('lp-no-anim');
  _fLpApplyUserView();
  clearTimeout(_fLpZoomAround._t);
  _fLpZoomAround._t = setTimeout(()=>wrap.classList.remove('lp-no-anim'), 200);
}

// Roda do mouse = zoom centrado no ponto sob o cursor.
function _fLpWheelZoom(e){
  if(_lpFraming) return; // o modo enquadrar-foto tem seu próprio zoom
  const canvas = document.getElementById('lp-canvas');
  if(!canvas || !canvas.width) return;
  e.preventDefault();
  _fLpZoomAround(_lpUserZoom * (e.deltaY > 0 ? 0.9 : 1.1), e.clientX, e.clientY);
}

// Arrastar em qualquer lugar da mesa = mover a arte (em qualquer zoom). Clique sem arrasto edita.
function _fLpPanDown(e){
  if(_lpFraming || e.button !== 0) return;
  if(e.target.closest('.lp-warnings, .lp-stage-meta, button, a, input, textarea, select')) return;
  _lpPanning = { sx:e.clientX, sy:e.clientY, px:_lpPanX, py:_lpPanY };
  _lpDidPan = false;
  const wrap = document.querySelector('.lp-canvas-wrap');
  if(wrap) wrap.classList.add('lp-no-anim');
  window.addEventListener('mousemove', _fLpPanMove);
  window.addEventListener('mouseup', _fLpPanUp);
}
function _fLpPanMove(e){
  if(!_lpPanning) return;
  const dx = e.clientX - _lpPanning.sx, dy = e.clientY - _lpPanning.sy;
  if(!_lpDidPan && Math.hypot(dx, dy) < 4) return; // limiar: micro-movimento ainda é clique
  _lpDidPan = true;
  _lpPanX = _lpPanning.px + dx;
  _lpPanY = _lpPanning.py + dy;
  _fLpApplyUserView();       // pan LIVRE — sem clamp (o Reajustar resgata)
  _fLpUpdatePanCursor(true);
}
function _fLpPanUp(){
  window.removeEventListener('mousemove', _fLpPanMove);
  window.removeEventListener('mouseup', _fLpPanUp);
  _lpPanning = null;
  const wrap = document.querySelector('.lp-canvas-wrap');
  if(wrap) wrap.classList.remove('lp-no-anim');
  _fLpUpdatePanCursor(false);
  // Se de fato houve pan, engole o clique seguinte para não abrir a edição de campo.
  if(_lpDidPan){ _lpSuppressClick = true; setTimeout(()=>{ _lpSuppressClick = false; }, 0); }
}

// Botões −/+ da toolbar: zoom pelo centro da mesa (sem cursor de referência).
function fLpZoomStep(dir){
  const stage = document.querySelector('.lp-stage');
  if(!stage) return;
  const r = stage.getBoundingClientRect();
  _fLpZoomAround(_lpUserZoom * (dir > 0 ? 1.25 : 0.8), r.left + r.width / 2, r.top + r.height / 2);
}
// Clicar no % recentraliza e volta ao ajuste de tela.
function fLpZoomReset(){ fLpRefit(); }

// Liga/desliga as guias de composição (margens de segurança + terços + centro).
// Sobreposição da prévia: 'off' | 'guides' | 'env'. Substitui o antigo liga/desliga de
// guias (_lpGuides), que virou este estado de 3 valores.
let _lpView = 'off';
function fLpSetView(v){
  _lpView = (v==='guides'||v==='env') ? v : 'off';
  const map = {off:'lp-view-off', guides:'lp-view-guides', env:'lp-view-env'};
  Object.keys(map).forEach(k=>{
    const b = document.getElementById(map[k]);
    if(b){ const on = (k===_lpView); b.classList.toggle('active', on); b.setAttribute('aria-checked', String(on)); }
  });
  try { fUpdateLivePreview(); } catch(e){}
}
// No-op defensivo: o liga/desliga de Guias virou o seletor de 3 estados e não tem mais
// chamador. Mantida (f* não regride) caso algum ponto antigo ainda chame — alterna
// limpo↔guias, sem passar pelo Ambiente, que é escolha explícita.
function fLpToggleGuides(){
  fLpSetView(_lpView==='guides' ? 'off' : 'guides');
}

// Desenha as guias por cima da prévia: margem de segurança (tracejada laranja),
// terços e centro (traço duplo escuro+claro → legível sobre qualquer arte).
function _fLpDrawGuides(ctx, W, H){
  ctx.save();
  const lw = Math.max(2, Math.round(W * 0.0025));
  // Margem de segurança (~4.5%): o que fica fora corre risco de corte/interface
  const mx = W * 0.045, my = H * 0.045;
  ctx.strokeStyle = 'rgba(255,144,0,.9)';
  ctx.lineWidth = lw;
  ctx.setLineDash([lw * 4, lw * 3]);
  ctx.strokeRect(mx, my, W - mx * 2, H - my * 2);
  ctx.setLineDash([]);
  // Terços + centro em traço duplo (sombra escura + linha clara)
  const lines = [
    ['v', W / 3], ['v', (2 * W) / 3], ['h', H / 3], ['h', (2 * H) / 3],
    ['v', W / 2], ['h', H / 2],
  ];
  const pass = (style, width) => {
    ctx.strokeStyle = style; ctx.lineWidth = width;
    lines.forEach(([dir, pos], i) => {
      const isCenter = i >= 4;
      ctx.globalAlpha = isCenter ? .5 : .35;
      ctx.beginPath();
      if(dir === 'v'){ ctx.moveTo(pos, 0); ctx.lineTo(pos, H); }
      else { ctx.moveTo(0, pos); ctx.lineTo(W, pos); }
      ctx.stroke();
    });
  };
  pass('rgba(0,0,0,.6)', Math.max(2, lw));
  pass('rgba(255,255,255,.9)', Math.max(1, Math.round(lw / 2)));
  ctx.restore();
}

/* ── AMBIENTE: como a arte fica POSTADA no Stories ─────────────────────────────
   O Estúdio já sabia disto (o linter reprova camada crítica nos 250px do topo/base —
   ver dRunLinter §3), mas o conhecimento nunca chegava ao franqueado: ele via um
   retângulo limpo e descobria o problema depois de postar. Aqui a MESMA constante
   vira desenho. Só faz sentido em Story (9:16) — Feed/Wide não têm esse chrome. */
const F_LP_STORY_SAFE = 250;                 // px na arte 1080×1920 (idêntico ao linter)
function _fLpIsStory(W,H){ return H > W && Math.abs((H/W) - (1920/1080)) < 0.06; }
// Fração da altura ocupada por cada zona de perigo — escala para qualquer 9:16.
function _fLpSafeFrac(H){ return F_LP_STORY_SAFE / (H || 1920); }

function _fLpDrawEnvironment(ctx, W, H){
  if(!_fLpIsStory(W,H)) return;
  const zone = H * _fLpSafeFrac(H);
  const u = W / 1080;                          // unidade: escala tudo a partir do 1080 nativo
  ctx.save();
  // 1) Zonas que o app cobre — véu vermelho + borda tracejada
  ctx.fillStyle = 'rgba(200,24,24,.16)';
  ctx.fillRect(0, 0, W, zone);
  ctx.fillRect(0, H - zone, W, zone);
  ctx.strokeStyle = 'rgba(200,24,24,.55)';
  ctx.lineWidth = Math.max(2, 3 * u);
  ctx.setLineDash([12 * u, 8 * u]);
  ctx.beginPath(); ctx.moveTo(0, zone); ctx.lineTo(W, zone);
  ctx.moveTo(0, H - zone); ctx.lineTo(W, H - zone); ctx.stroke();
  ctx.setLineDash([]);
  // 2) Chrome do Stories (proxy genérico — não imita a marca de ninguém; comunica
  //    "aqui o app cobre"). Barras de progresso + avatar + barra de mensagem.
  const wht = 'rgba(255,255,255,.9)';
  ctx.fillStyle = wht;
  const bx = 24 * u, bw = (W - bx * 2 - 18 * u) / 4;
  for(let i = 0; i < 4; i++){
    ctx.globalAlpha = i === 0 ? .9 : .35;
    _fLpRoundRect(ctx, bx + i * (bw + 6 * u), 22 * u, bw, 5 * u, 3 * u); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // avatar + nome
  ctx.beginPath(); ctx.arc(bx + 20 * u, 62 * u, 20 * u, 0, Math.PI * 2); ctx.fillStyle = wht; ctx.fill();
  ctx.font = `600 ${Math.round(22 * u)}px Roboto, sans-serif`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('sua loja', bx + 50 * u, 62 * u);
  // barra "Enviar mensagem" + ícones
  const by = H - zone + 90 * u;
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = Math.max(1.5, 2 * u);
  _fLpRoundRect(ctx, bx, by, W - bx * 2 - 130 * u, 62 * u, 31 * u); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  ctx.font = `400 ${Math.round(20 * u)}px Roboto, sans-serif`;
  ctx.fillText('Enviar mensagem', bx + 24 * u, by + 31 * u);
  [0, 1].forEach(i => { _fLpRoundRect(ctx, W - bx - 100 * u + i * 55 * u, by + 14 * u, 34 * u, 34 * u, 8 * u); ctx.fill(); });
  // 3) Rótulos das zonas
  ctx.font = `700 ${Math.round(18 * u)}px Roboto, sans-serif`;
  ctx.textAlign = 'center';
  const tag = (txt, y) => {
    const w = ctx.measureText(txt).width + 20 * u;
    ctx.fillStyle = 'rgba(200,24,24,.9)';
    _fLpRoundRect(ctx, W / 2 - w / 2, y - 13 * u, w, 26 * u, 6 * u); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(txt, W / 2, y);
  };
  tag('perfil e barras cobrem aqui', zone - 20 * u);
  tag('barra de mensagem cobre aqui', H - zone + 22 * u);
  ctx.restore();
}
// roundRect próprio: o global roundedRect() vive no png-generator e usa outra assinatura.
function _fLpRoundRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
// NOTA: aqui NÃO entra aviso na barra de chips quando uma camada cai na zona coberta.
// Camada é do TEMPLATE — o franqueado não move camadas (01_BUSINESS §5), então seria
// ruído que ele não pode resolver (o mesmo erro dos avisos de placeholder). Quem barra
// isso é o linter, no publicar, com o designer — que é quem pode consertar.

// Estado vazio contextual: a copy acompanha o passo do fluxo do franqueado.
function fLpShowEmpty(canvas){
  const stage = canvas.closest('.lp-stage') || document.querySelector('.lp-stage');
  if(stage) stage.classList.add('empty');
  const t = document.getElementById('lp-empty-title');
  const s = document.getElementById('lp-empty-sub');
  if(t && s){
    if(fState.material){
      // Render falhou (catch) — honestidade sem alarme
      t.textContent = 'Não deu pra montar a prévia';
      s.textContent = 'A arte final não é afetada — continue respondendo normalmente.';
    } else if(fState.materialView && fState.camp){
      t.textContent = 'Quase lá';
      s.textContent = 'Escolha um material da campanha e a prévia monta aqui em tempo real.';
    } else {
      t.textContent = 'Sua arte nasce aqui';
      s.textContent = 'Escolha uma campanha no catálogo para começar.';
    }
  }
  // Toolbar sem números fantasma no vazio
  const zoomEl = document.getElementById('lp-zoom');
  if(zoomEl) zoomEl.textContent = '—';
  const dimEl = document.getElementById('lp-dim');
  if(dimEl) dimEl.textContent = '';
}

// Injeta placeholder {{var}} nos layers de texto com variável vazia e sem default.
// A detecção de "vazio" usa fState.dados original (não o clone mutado), pra a mesma
// variável em vários layers marcar todos. Retorna o Set de ids de layers pendentes.
function fLpInjectPlaceholders(layers, dadosPreview, defaults){
  const pendentes = new Set();
  const orig = fState.dados || {};
  
  (layers || []).forEach(l => {
    // Processamento de variáveis de imagem/moldura vazias: injeta a capa da campanha como fallback visual realista
    if ((l.type === 'image' || l.type === 'frame') && l.imgVar) {
      const name = l.imgVar;
      const val = orig[name];
      const vazio = (val == null || val === '');
      if (vazio) {
        pendentes.add(l.id);
        if (fState.camp && fState.camp.cover) {
          dadosPreview[name] = fState.camp.cover;
        }
      }
    }
    
    // Processamento de variáveis de texto
    if(l.type !== 'text' || !l.content) return;
    const re = gVarRegex();
    let m;
    while((m = re.exec(l.content)) !== null){
      const name = m[1];
      const val = orig[name];
      const vazio = (val == null || val === '');
      if(!vazio) continue;
      pendentes.add(l.id);
      const def = defaults ? defaults[name] : undefined;
      
      if(def == null || def === ''){
        const vDef=(typeof dVars!=='undefined'&&dVars)?dVars.find(v=>v.name===name):null;
        let ex=(vDef&&vDef.example!=null&&String(vDef.example).trim()!=='')?String(vDef.example).trim():'';
        
        if(!ex){
          // 1ª Linha de Defesa: Primeira sugestão da pergunta da campanha ativa (se disponível)
          const perg = fState.camp?.perguntas?.find(p => p.id === name);
          if (perg && Array.isArray(perg.sugestoes) && perg.sugestoes.length > 0 && perg.sugestoes[0]) {
            ex = perg.sugestoes[0];
          }
        }
        if(!ex){
          // 2ª Linha de Defesa: Exemplos baseados no segmento do material
          const segment = _fLpGuessSegment();
          const dict = F_LP_CONTEXT_EXAMPLES[segment] || F_LP_CONTEXT_EXAMPLES.universal;
          ex = dict[name] || F_LP_CONTEXT_EXAMPLES.universal[name];
        }
        if(!ex){
          // 3ª Linha de Defesa: Rótulos amigáveis ou o nome puro da variável
          ex = (vDef && vDef.label) || F_FIELD_LABELS[name] || name;
        }
        dadosPreview[name] = ex;
      }
    }
  });
  return pendentes;
}

// Marca os campos ainda vazios como EDITÁVEIS (contorno tracejado laranja), em vez de
// escurecer — o objetivo é convidar ao toque ("toque pra preencher"), não parecer travado.
// Só quando NÃO houve smart-resize (com reflow as coords mudam e o contorno desalinharia).
function fLpHighlightEmpty(ctx, layers, pendentes, W, H){
  if(!pendentes || !pendentes.size) return;
  const src = (fState.material && fState.material.w>0 && fState.material.h>0)
    ? [fState.material.w, fState.material.h]
    : (F_LP_SIZES[(fState.material && fState.material.fmt)] || F_LP_SIZES.story);
  if(src[0] !== W || src[1] !== H) return; // houve reflow → omite
  ctx.save();
  const dash = Math.max(4, Math.round(W * 0.006));
  ctx.setLineDash([dash * 1.6, dash]);
  ctx.lineWidth = Math.max(2, Math.round(W * 0.003));
  (layers || []).forEach(l => {
    if(!pendentes.has(l.id)) return;
    const x = l.x || 0, y = l.y || 0, w = l.w || W, h = l.h || 40;
    const r = Math.min(l.radius || 0, w / 2, h / 2);
    // leve realce de fundo + contorno tracejado da marca
    ctx.globalAlpha = 0.06; ctx.fillStyle = '#F85400';
    if(typeof roundedRect === 'function'){ roundedRect(ctx, x, y, w, h, r || 0); ctx.fill(); }
    else ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 0.55; ctx.strokeStyle = '#F85400';
    if(typeof roundedRect === 'function'){ roundedRect(ctx, x, y, w, h, r || 0); ctx.stroke(); }
    else ctx.strokeRect(x, y, w, h);
  });
  ctx.restore();
}

// Desenha um destaque sutil de foco ao redor do campo correspondente à pergunta ativa do chat (Focus Sync)
function fLpHighlightActiveField(ctx, l, W, H) {
  const src = (fState.material && fState.material.w>0 && fState.material.h>0)
    ? [fState.material.w, fState.material.h]
    : (F_LP_SIZES[(fState.material && fState.material.fmt)] || F_LP_SIZES.story);
  if(src[0] !== W || src[1] !== H) return; // ignora se houver reflow de zoom/coords
  
  ctx.save();
  
  // Cor do destaque: Laranja oficial Delivery Much
  ctx.strokeStyle = '#F85400';
  ctx.lineWidth = Math.max(3, Math.round(W * 0.005));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // Efeito de Glow/Sombra
  ctx.shadowColor = 'rgba(248, 84, 0, 0.45)';
  ctx.shadowBlur = Math.max(8, Math.round(W * 0.012));
  
  const padding = 8;
  const x = (l.x || 0) - padding;
  const y = (l.y || 0) - padding;
  const w = (l.w || W) + padding * 2;
  const h = (l.h || 40) + padding * 2;
  const r = Math.min(l.radius || 6, w / 2, h / 2);
  
  ctx.beginPath();
  if (typeof roundedRect === 'function') {
    roundedRect(ctx, x, y, w, h, r);
  } else if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.rect(x, y, w, h);
  }
  ctx.stroke();
  
  ctx.restore();
}

// Atualiza o sub-header (#lp-sub).
function fLpUpdateMeta(hasTemplate){
  const subEl = document.getElementById('lp-sub');
  const syncParent = subEl ? subEl.closest('.lp-sync') : null;
  const c = fState.camp, d = fState.dados || {};
  const perguntas = (hasTemplate && c && c.perguntas) ? c.perguntas : [];
  
  if(subEl){
    if(!hasTemplate){ 
      subEl.textContent = 'Selecione um material'; 
      if(syncParent) syncParent.classList.remove('ready'); 
      return; 
    }
    const total = perguntas.length;
    const preenchidos = perguntas.filter(p => d[p.id] != null && d[p.id] !== '').length;
    if(fState.done){ 
      subEl.textContent = 'arte pronta'; 
      if(syncParent) syncParent.classList.add('ready'); 
    }
    else if(preenchidos === 0){ 
      subEl.textContent = 'aguardando respostas...'; 
      if(syncParent) syncParent.classList.remove('ready'); 
    }
    else if(preenchidos === total){ 
      subEl.textContent = 'tudo pronto, gerar arte'; 
      if(syncParent) syncParent.classList.add('ready'); 
    }
    else { 
      subEl.textContent = `${preenchidos} de ${total} preenchidos`; 
      if(syncParent) syncParent.classList.remove('ready'); 
    }
  }
}
function fInitMobilePreviewEvents() {
  if (!document.getElementById('mobile-preview-toggle')) {
    const btn = document.createElement('button');
    btn.id = 'mobile-preview-toggle';
    btn.setAttribute('aria-label', 'Ver prévia da arte');
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="12" cy="12" r="3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    document.body.appendChild(btn);
    
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const previewEl = document.getElementById('f-live-preview');
      if (previewEl) {
        previewEl.classList.toggle('open');
      }
    });

    document.addEventListener('click', (e) => {
      const previewEl = document.getElementById('f-live-preview');
      if (previewEl && previewEl.classList.contains('open') && !previewEl.contains(e.target)) {
        previewEl.classList.remove('open');
      }
    });
  }
}

/* ══════════════════════════════════════════════════════════════
   EDIÇÃO DIRETA NA PRÉVIA (clique-para-preencher) + ENQUADRAR FOTO
   O franqueado clica num campo da arte e edita ali: texto inline ou
   foto (enviar/link/reposicionar/trocar/remover). NUNCA edita camadas
   — texto/foto vão pra fState.dados; o enquadramento vai pra
   fState.dados['__fit__'+var] (override por-arte lido pelo motor, sem
   mutar o template compartilhado). Respeita permissão do designer
   (edit:false → cadeado) e maxLen. Depende de: png-generator (render,
   fResizeImageIfNeeded), chat-input (fApplyMask, fGetFieldType).
══════════════════════════════════════════════════════════════ */
function _fLpRender(){ try{ fUpdateLivePreview(); }catch(e){} }
function _fLpLabel(v){
  const perg=fState.camp&&fState.camp.perguntas&&fState.camp.perguntas.find(p=>p.id===v);
  if(perg&&perg.label) return perg.label;
  const vDef=(typeof dVars!=='undefined'&&dVars)?dVars.find(x=>x.name===v):null;
  return (vDef&&vDef.label)||F_FIELD_LABELS[v]||v;
}
function _fLpExample(v){
  const perg=fState.camp&&fState.camp.perguntas&&fState.camp.perguntas.find(p=>p.id===v);
  if(perg&&Array.isArray(perg.sugestoes)&&perg.sugestoes[0]) return perg.sugestoes[0];
  const seg=(typeof _fLpGuessSegment==='function')?_fLpGuessSegment():'universal';
  const dict=F_LP_CONTEXT_EXAMPLES[seg]||F_LP_CONTEXT_EXAMPLES.universal;
  return dict[v]||'';
}
// Permissão por campo do designer (edit:false = fixo) + maxLen.
function _fLpPerm(v){
  const perms=(fState.material&&fState.material.publishMeta&&fState.material.publishMeta.permissoes)||{};
  const p=perms[v]||{};
  const cfg=(typeof fGetFieldType==='function')?fGetFieldType(v):{maxLen:32};
  return { editable: p.edit!==false, maxLen: (p.maxLen||cfg.maxLen||32) };
}
// Ponto do clique em espaço da ARTE (W×H) — robusto a qualquer transform CSS do canvas.
function _fLpArtCoords(ev){
  const canvas=document.getElementById('lp-canvas');
  if(!canvas||!canvas.width) return null;
  const r=canvas.getBoundingClientRect();
  if(!r.width||!r.height) return null;
  const cx=(ev.touches?ev.touches[0].clientX:ev.clientX), cy=(ev.touches?ev.touches[0].clientY:ev.clientY);
  return { x:((cx-r.left)/r.width)*canvas.width, y:((cy-r.top)/r.height)*canvas.height };
}
function _fLpLayerVars(l){
  if(!l) return [];
  if((l.type==='image'||l.type==='frame') && l.imgVar) return [l.imgVar];
  if(l.type==='text' && l.content){
    const out=[]; const re=gVarRegex(); let m;
    while((m=re.exec(l.content))!==null){ if(out.indexOf(m[1])<0) out.push(m[1]); }
    return out;
  }
  return [];
}
function _fLpLayerAt(x,y){
  const mat=fState.material;
  let layers=(mat&&mat.layers)||[];
  // Espelha o reflow do render: quando o formato exibido difere do nativo do template,
  // fRenderTemplateLayers re-ancora as coords (gReflowLayers). Sem espelhar aqui, o clique/
  // hover caía no layer errado em templates legados exibidos noutro formato. Os callers só
  // leem type/imgVar/vars (preservados na cópia refluída), então devolver a cópia é seguro.
  const cv=document.getElementById('lp-canvas');
  if(mat && cv && typeof fMaterialSize==='function' && typeof gReflowLayers==='function'){
    const sz=fMaterialSize(mat), tw=sz[0], th=sz[1], W=cv.width, H=cv.height;
    if((tw!==W || th!==H) && W && H){
      const fmtSizes={story:[1080,1920],feed:[1080,1350],wide:[1200,628],post:[1200,628]};
      const fmtKey=Object.keys(fmtSizes).find(k=>fmtSizes[k][0]===W&&fmtSizes[k][1]===H);
      layers=gReflowLayers(mat.layers,{w:tw,h:th},{w:W,h:H},{fmtKey:(fmtKey&&typeof gFmtKey==='function')?gFmtKey(fmtKey):null});
    }
  }
  for(let i=layers.length-1;i>=0;i--){
    const l=layers[i];
    if(!l||l.visible===false||!_fLpLayerVars(l).length) continue;
    const lx=l.x||0, ly=l.y||0, lw=l.w||0, lh=l.h||0;
    if(x>=lx&&x<=lx+lw&&y>=ly&&y<=ly+lh) return l;
  }
  return null;
}
function _fLpLockToast(v){ gToast('Campo fixo da marca — não editável neste material.'); }

// ── Setter + commit ──
function _fLpCommit(v,val){
  if(!fState.dados) fState.dados={};
  const mv=(typeof fApplyMask==='function')?fApplyMask(v,val):val;
  if(mv===''||mv==null) delete fState.dados[v]; else fState.dados[v]=mv;
  try{ if(typeof fSaveChatDraft==='function') fSaveChatDraft(); }catch(e){}
  _fLpRender();
}

// ── Popover ──
function _fLpCloseEditor(){
  const p=document.getElementById('lp-edit-pop'); if(p) p.remove();
  document.removeEventListener('mousedown',_fLpPopOutside,true);
  document.removeEventListener('keydown',_fLpPopKey,true);
}
function _fLpPopOutside(e){ const p=document.getElementById('lp-edit-pop'); if(p&&!p.contains(e.target)&&e.target.id!=='lp-canvas') _fLpCloseEditor(); }
function _fLpPopKey(e){ if(e.key==='Escape'){ e.preventDefault(); _fLpCloseEditor(); } }
function _fLpMakePop(ev){
  _fLpCloseEditor();
  const p=document.createElement('div'); p.id='lp-edit-pop'; p.className='lp-edit-pop';
  document.body.appendChild(p);
  const px=(ev&&(ev.clientX||(ev.touches&&ev.touches[0].clientX)))||window.innerWidth/2;
  const py=(ev&&(ev.clientY||(ev.touches&&ev.touches[0].clientY)))||window.innerHeight/2;
  p.style.left=Math.max(8,Math.min(px, window.innerWidth-270))+'px';
  p.style.top=Math.max(8,Math.min(py+10, window.innerHeight-210))+'px';
  setTimeout(()=>{ document.addEventListener('mousedown',_fLpPopOutside,true); document.addEventListener('keydown',_fLpPopKey,true); },0);
  return p;
}

// ── Editor de texto ──
function _fLpTextEditor(v,maxLen,ev){
  const p=_fLpMakePop(ev);
  const cur=(fState.dados&&fState.dados[v]!=null)?String(fState.dados[v]):'';
  p.innerHTML=`<div class="lp-edit-lbl">${gEsc(_fLpLabel(v))}</div>
    <input type="text" class="lp-edit-input" maxlength="${maxLen}" placeholder="${gEsc(_fLpExample(v))}">
    <div class="lp-edit-row"><span class="lp-edit-count"></span><button class="lp-edit-ok" type="button">Salvar</button></div>`;
  const inp=p.querySelector('.lp-edit-input'), cnt=p.querySelector('.lp-edit-count');
  inp.value=cur;
  const refresh=()=>{ cnt.textContent=inp.value.length+'/'+maxLen; };
  inp.addEventListener('input',()=>{ refresh(); if(!fState.dados)fState.dados={}; fState.dados[v]=inp.value; _fLpRender(); }); // preview ao vivo (cru)
  inp.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); _fLpCommit(v,inp.value); _fLpCloseEditor(); } });
  p.querySelector('.lp-edit-ok').onclick=()=>{ _fLpCommit(v,inp.value); _fLpCloseEditor(); };
  refresh();
  setTimeout(()=>{ inp.focus(); inp.select(); },20);
}

// ── Editor de imagem ──
function _fLpImageEditor(l,v,ev){
  const p=_fLpMakePop(ev);
  const has=!!(fState.dados&&fState.dados[v]);
  p.innerHTML=`<div class="lp-edit-lbl">${gEsc(_fLpLabel(v))}</div>
    <div class="lp-edit-actions">
      <button class="lp-edit-btn" data-a="upload" type="button">${has?'Trocar foto':'Enviar foto'}</button>
      ${has?'<button class="lp-edit-btn" data-a="frame" type="button">Reposicionar</button>':''}
      ${has?'<button class="lp-edit-btn lp-edit-danger" data-a="remove" type="button">Remover</button>':''}
    </div>
    <div class="lp-edit-orlink">ou cole um link de imagem:</div>
    <div class="lp-edit-row"><input type="text" class="lp-edit-input" placeholder="https://..."><button class="lp-edit-ok" type="button">OK</button></div>
    <input type="file" accept="image/png,image/jpeg,image/webp" class="lp-edit-file" style="display:none">`;
  const file=p.querySelector('.lp-edit-file');
  p.querySelector('[data-a="upload"]').onclick=()=>file.click();
  file.onchange=e=>{ const f=e.target.files&&e.target.files[0]; if(f) _fLpUploadImage(f,v); };
  const fb=p.querySelector('[data-a="frame"]'); if(fb) fb.onclick=()=>{ _fLpCloseEditor(); fLpStartFraming(l,v); };
  const rb=p.querySelector('[data-a="remove"]'); if(rb) rb.onclick=()=>{ delete fState.dados[v]; delete fState.dados['__fit__'+v]; try{fSaveChatDraft&&fSaveChatDraft();}catch(e){} _fLpRender(); _fLpCloseEditor(); };
  const link=p.querySelector('.lp-edit-input');
  p.querySelector('.lp-edit-ok').onclick=()=>{ const u=link.value.trim(); if(!u)return; if(!fState.dados)fState.dados={}; fState.dados[v]=u; delete fState.dados['__fit__'+v]; try{fSaveChatDraft&&fSaveChatDraft();}catch(e){} _fLpRender(); _fLpCloseEditor(); };
}
function _fLpUploadImage(file,v){
  const reader=new FileReader();
  reader.onload=e=>{
    const done=(url)=>{
      if(!fState.dados)fState.dados={};
      fState.dados[v]=url; delete fState.dados['__fit__'+v];
      try{fSaveChatDraft&&fSaveChatDraft();}catch(e){}
      _fLpRender();
      const im=new Image(); im.onload=()=>{ if(im.naturalWidth<600||im.naturalHeight<600) gToast('⚠ Foto de baixa resolução ('+im.naturalWidth+'×'+im.naturalHeight+'px) — pode sair pixelada na arte.','error'); }; im.src=url;
      _fLpCloseEditor();
    };
    if(typeof fResizeImageIfNeeded==='function') fResizeImageIfNeeded(e.target.result,1500,done); else done(e.target.result);
  };
  reader.readAsDataURL(file);
}

// ── Modo enquadrar foto (arrasta = posição, roda/pinça = zoom) ──
let _fLpFrameDrag=null;
let _fLpPinch=null;
function _fLpTouchDist(e){ const a=e.touches[0], b=e.touches[1]; return Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY); }
function _fLpFrameMove(e){
  if(!_fLpFrameDrag||!_lpFraming) return;
  const l=_lpFraming.layer, v=_lpFraming.varName;
  const dx=(e.clientX-_fLpFrameDrag.sx)/((_lpScale||1)*(l.w||1));
  const dy=(e.clientY-_fLpFrameDrag.sy)/((_lpScale||1)*(l.h||1));
  const offX=Math.max(-.5,Math.min(.5,_fLpFrameDrag.ox-dx));
  const offY=Math.max(-.5,Math.min(.5,_fLpFrameDrag.oy-dy));
  const f=fState.dados['__fit__'+v]||{scale:1};
  fState.dados['__fit__'+v]={scale:f.scale||1,offX,offY};
  _fLpRender();
}
function _fLpFrameUp(){ _fLpFrameDrag=null; }
function fLpStartFraming(l,v){
  const canvas=document.getElementById('lp-canvas'); const wrap=canvas&&canvas.closest('.lp-canvas-wrap'); if(!wrap) return;
  _lpFraming={layer:l,varName:v};
  const init=(fState.dados&&fState.dados['__fit__'+v])||{scale:(l.imgScale||1),offX:(l.imgOffsetX||0),offY:(l.imgOffsetY||0)};
  fState.dados['__fit__'+v]={scale:init.scale||1,offX:init.offX||0,offY:init.offY||0};
  _fLpRender(); // trava scale 1 e aplica o fit
  let ov=document.getElementById('lp-frame-ov');
  if(!ov){ ov=document.createElement('div'); ov.id='lp-frame-ov'; ov.className='lp-frame-ov'; wrap.appendChild(ov); }
  ov.innerHTML=`<div class="lp-frame-hint">Arraste pra posicionar · role pra dar zoom <button class="lp-frame-reset" type="button" title="Voltar ao enquadramento original">Restaurar</button><button class="lp-frame-done" type="button">Concluir</button></div>`;
  ov.querySelector('.lp-frame-done').onclick=()=>fLpStopFraming();
  ov.querySelector('.lp-frame-reset').onclick=()=>fLpResetFraming();
  // Botões da barra não podem iniciar arrasto (senão "Restaurar" move a foto antes de resetar).
  ov.onmousedown=(e)=>{ if(e.target.closest('.lp-frame-hint'))return; e.preventDefault(); const f=fState.dados['__fit__'+v]||{}; _fLpFrameDrag={sx:e.clientX,sy:e.clientY,ox:f.offX||0,oy:f.offY||0}; };
  ov.onwheel=(e)=>{ e.preventDefault(); const f=fState.dados['__fit__'+v]||{scale:1,offX:0,offY:0}; const sc=Math.max(1,Math.min(5,(f.scale||1)*(e.deltaY>0?0.94:1.06))); fState.dados['__fit__'+v]={scale:sc,offX:f.offX||0,offY:f.offY||0}; _fLpRender(); };
  // Toque (mobile): 1 dedo = posição, 2 dedos = pinça-zoom
  ov.ontouchstart=(e)=>{ if(e.target.closest('.lp-frame-hint'))return; const f=fState.dados['__fit__'+v]||{}; if(e.touches.length>=2){ _fLpPinch={d:_fLpTouchDist(e),sc:f.scale||1}; _fLpFrameDrag=null; } else { _fLpFrameDrag={sx:e.touches[0].clientX,sy:e.touches[0].clientY,ox:f.offX||0,oy:f.offY||0}; } e.preventDefault(); };
  ov.ontouchmove=(e)=>{ e.preventDefault(); const f=fState.dados['__fit__'+v]||{scale:1,offX:0,offY:0}; if(e.touches.length>=2&&_fLpPinch){ const nd=_fLpTouchDist(e); const sc=Math.max(1,Math.min(5,_fLpPinch.sc*(nd/(_fLpPinch.d||1)))); fState.dados['__fit__'+v]={scale:sc,offX:f.offX||0,offY:f.offY||0}; _fLpRender(); } else if(_fLpFrameDrag){ const dx=(e.touches[0].clientX-_fLpFrameDrag.sx)/((_lpScale||1)*(l.w||1)); const dy=(e.touches[0].clientY-_fLpFrameDrag.sy)/((_lpScale||1)*(l.h||1)); fState.dados['__fit__'+v]={scale:f.scale||1,offX:Math.max(-.5,Math.min(.5,_fLpFrameDrag.ox-dx)),offY:Math.max(-.5,Math.min(.5,_fLpFrameDrag.oy-dy))}; _fLpRender(); } };
  ov.ontouchend=(e)=>{ if(!e.touches.length){ _fLpFrameDrag=null; _fLpPinch=null; } };
  window.addEventListener('mousemove',_fLpFrameMove);
  window.addEventListener('mouseup',_fLpFrameUp);
}
// Volta ao enquadramento que o DESIGNER definiu no template, descartando o que o
// franqueado mexeu. Sem isto, o único jeito de desfazer era reenviar a foto — e o medo
// de "estragar" mata o valor da prévia (05_DESIGN_PHILOSOPHY §2: impossível errar).
// Mantém o modo enquadramento aberto: restaurar é um passo atrás, não uma saída.
function fLpResetFraming(){
  if(!_lpFraming) return;
  const l=_lpFraming.layer, v=_lpFraming.varName;
  fState.dados['__fit__'+v]={scale:(l.imgScale||1),offX:(l.imgOffsetX||0),offY:(l.imgOffsetY||0)};
  _fLpFrameDrag=null; _fLpPinch=null;
  try{fSaveChatDraft&&fSaveChatDraft();}catch(e){}
  _fLpRender();
  if(typeof gToast==='function') gToast('Enquadramento restaurado');
}
function fLpStopFraming(){
  window.removeEventListener('mousemove',_fLpFrameMove);
  window.removeEventListener('mouseup',_fLpFrameUp);
  _fLpFrameDrag=null; _fLpPinch=null; _lpFraming=null;
  const ov=document.getElementById('lp-frame-ov'); if(ov) ov.remove();
  try{fSaveChatDraft&&fSaveChatDraft();}catch(e){}
  _fLpRender();
}

// ── Chooser quando a camada de texto tem +de 1 variável ──
function _fLpVarChooser(l,vars,ev){
  const p=_fLpMakePop(ev);
  p.innerHTML=`<div class="lp-edit-lbl">O que editar aqui?</div><div class="lp-edit-actions">`+
    vars.map(v=>`<button class="lp-edit-btn" data-v="${gEsc(v)}" type="button">${gEsc(_fLpLabel(v))}${_fLpPerm(v).editable?'':' · fixo'}</button>`).join('')+`</div>`;
  p.querySelectorAll('[data-v]').forEach(b=>{ b.onclick=()=>{ const v=b.getAttribute('data-v'); const perm=_fLpPerm(v); if(!perm.editable){ _fLpLockToast(v); return; } _fLpTextEditor(v,perm.maxLen,ev); }; });
}

// ── Clique no canvas ──
function _fLpOnCanvasClick(ev){
  if(_lpFraming) return;
  if(_lpSuppressClick) return; // veio de um arrasto de pan — não abre edição de campo
  if(!fState.material||!fState.material.layers||!fState.material.layers.length) return;
  const pt=_fLpArtCoords(ev); if(!pt) return;
  const l=_fLpLayerAt(pt.x,pt.y);
  if(!l){ _fLpCloseEditor(); return; }
  if(l.type==='image'||l.type==='frame'){
    const perm=_fLpPerm(l.imgVar);
    if(!perm.editable){ _fLpLockToast(l.imgVar); return; }
    _fLpImageEditor(l,l.imgVar,ev); return;
  }
  const vars=_fLpLayerVars(l); if(!vars.length) return;
  if(vars.length===1){ const perm=_fLpPerm(vars[0]); if(!perm.editable){ _fLpLockToast(vars[0]); return; } _fLpTextEditor(vars[0],perm.maxLen,ev); }
  else { _fLpVarChooser(l,vars,ev); }
}
// ── Avisos persistentes: "não deixar sair errado" (faltou / estourou / baixa-res) ──
function _fLpMeasureImg(url){
  if(_lpImgDims[url]!==undefined) return;
  _lpImgDims[url]=null; // medindo
  const im=new Image();
  im.onload=()=>{ _lpImgDims[url]={w:im.naturalWidth,h:im.naturalHeight}; try{fLpUpdateWarnings();}catch(e){} };
  im.onerror=()=>{ _lpImgDims[url]={w:9999,h:9999}; };
  im.src=url;
}
function _fLpJumpToField(v){
  const l=(fState.material&&fState.material.layers||[]).find(x=>_fLpLayerVars(x).indexOf(v)>=0);
  if(!l) return;
  const perm=_fLpPerm(v);
  if(!perm.editable){ _fLpLockToast(v); return; }
  if(l.type==='image'||l.type==='frame') _fLpImageEditor(l,v,null);
  else _fLpTextEditor(v,perm.maxLen,null);
}
function fLpUpdateWarnings(){
  const box=document.getElementById('lp-warnings'); if(!box) return;
  if(!fState.material||!fState.material.layers||!fState.material.layers.length){ box.innerHTML=''; return; }
  const d=fState.dados||{}, layers=fState.material.layers, items=[];
  const seen=new Set(); // dedup por var+tipo (uma var em vários layers não vira vários chips)
  // 1) Faltou preencher (perguntas do fluxo ainda sem resposta)
  ((fState.camp&&fState.camp.perguntas)||[]).forEach(p=>{
    // Campo opcional pulado continua vazio no render, mas não é uma pendência do usuário.
    if((d[p.id]==null||d[p.id]==='') && !d['__skipped__'+p.id] && !seen.has('m:'+p.id)){ seen.add('m:'+p.id); items.push({kind:'miss', v:p.id, label:(p.label||_fLpLabel(p.id))}); }
  });
  const missVars=new Set(items.filter(i=>i.kind==='miss').map(i=>i.v));
  // 2) Texto estourando a caixa — SÓ quando é ação do franqueado: campo com variável
  //    EDITÁVEL e JÁ preenchido. Placeholder de campo vazio e layer fixo (sem var) não
  //    contam — "encurtar" o que ele não escreveu (ou não pode editar) é ruído inútil.
  if(_lpOverflow&&_lpOverflow.size){
    _lpOverflow.forEach(id=>{
      const l=layers.find(x=>x.id===id); if(!l) return;
      const v=_fLpLayerVars(l)[0];
      if(!v || missVars.has(v)) return;            // sem var, ou ainda vazio → é placeholder
      if(d[v]==null||d[v]==='') return;            // sem valor real → overflow de placeholder
      const perm=_fLpPerm(v); if(perm && perm.editable===false) return; // franqueado não edita
      if(seen.has('o:'+v)) return; seen.add('o:'+v);
      items.push({kind:'over', v, label:_fLpLabel(v)});
    });
  }
  // 3) Foto de baixa resolução (mede uma vez por URL, cacheado)
  layers.forEach(l=>{
    if((l.type!=='image'&&l.type!=='frame')||!l.imgVar) return;
    const val=d[l.imgVar];
    if(!val||typeof val!=='string') return;
    const dim=_lpImgDims[val];
    if(dim===undefined){ _fLpMeasureImg(val); }
    else if(dim && (dim.w<600||dim.h<600) && !seen.has('l:'+l.imgVar)){ seen.add('l:'+l.imgVar); items.push({kind:'low', v:l.imgVar, label:_fLpLabel(l.imgVar), dim}); }
  });
  // Teto: nunca soterra a prévia. Mostra os primeiros e resume o resto num "+N".
  const MAX=4;
  const shown=items.slice(0,MAX);
  const extra=items.length-shown.length;
  box.innerHTML = shown.map(it=>{
    const cls = it.kind==='miss'?'lp-warn-miss':(it.kind==='over'?'lp-warn-over':'lp-warn-low');
    const txt = it.kind==='miss'?('Falta preencher: '+it.label)
              : it.kind==='over'?('“'+it.label+'” não cabe — encurte o texto')
              : ('Foto “'+it.label+'” está baixa ('+it.dim.w+'×'+it.dim.h+')');
    return `<button type="button" class="lp-warn ${cls}" data-v="${gEsc(it.v||'')}">${gEsc(txt)}</button>`;
  }).join('') + (extra>0 ? `<span class="lp-warn lp-warn-more">+${extra} aviso${extra>1?'s':''}</span>` : '');
  box.querySelectorAll('button.lp-warn').forEach(b=>{ b.onclick=()=>{ const v=b.getAttribute('data-v'); if(v) _fLpJumpToField(v); }; });
}

// ── Hover: chip flutuante indicando que o campo é editável (descoberta) ──
let _fLpHoverChip=null;
function _fLpHideHoverChip(){ if(_fLpHoverChip) _fLpHoverChip.style.display='none'; }
function _fLpOnCanvasMove(ev){
  const cv=document.getElementById('lp-canvas');
  if(_lpFraming||!fState.material||!fState.material.layers||!fState.material.layers.length){ _fLpHideHoverChip(); return; }
  const pt=_fLpArtCoords(ev); if(!pt){ _fLpHideHoverChip(); return; }
  const l=_fLpLayerAt(pt.x,pt.y);
  if(!l){ _fLpHideHoverChip(); if(cv) cv.style.cursor='default'; return; }
  if(cv) cv.style.cursor='pointer';
  const v=(l.type==='image'||l.type==='frame')?l.imgVar:_fLpLayerVars(l)[0];
  const editable=_fLpPerm(v).editable;
  const label=(l.type==='image'||l.type==='frame')?'foto':_fLpLabel(v);
  let c=_fLpHoverChip;
  if(!c){ c=document.createElement('div'); c.id='lp-hover-chip'; document.body.appendChild(c); _fLpHoverChip=c; }
  c.className='lp-hover-chip'+(editable?'':' locked');
  c.textContent = editable ? ('Editar '+label) : 'Fixo da marca';
  c.style.left=Math.min((ev.clientX||0)+14, window.innerWidth-150)+'px';
  c.style.top=Math.min((ev.clientY||0)+14, window.innerHeight-38)+'px';
  c.style.display='block';
}
function _fLpBindCanvasEditing(){
  const cv=document.getElementById('lp-canvas');
  if(cv && !cv._fLpBound){
    cv._fLpBound=true;
    cv.addEventListener('click',_fLpOnCanvasClick);
    cv.addEventListener('mousemove',_fLpOnCanvasMove);
    cv.addEventListener('mouseleave',_fLpHideHoverChip);
  }
}

// Update inicial assim que DOM tá pronto
document.addEventListener('DOMContentLoaded', () => {
  try { dPreloadFolders(); } catch(e){}
  try { fUpdateLivePreview(); } catch(e){}
  try { fInitMobilePreviewEvents(); } catch(e){}
  try { _fLpBindCanvasEditing(); } catch(e){}
});

