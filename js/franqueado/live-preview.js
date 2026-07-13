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
let _lpGuides = false;   // toggle "Guias": margens de segurança + terços sobre a prévia

async function fUpdateLivePreview(opts){
  opts = opts || {}; // animateField é ignorado: o canvas já reflete o estado atual
  const canvas = document.getElementById('lp-canvas');
  if(!canvas || canvas.tagName !== 'CANVAS') return;

  // Sem template selecionado (ou camadas vazias) → Tenta fallback renderer, ou mostra estado vazio
  if(!fState.material || !fState.material.layers || !fState.material.layers.length){
    if (fState.material && fState.material.bg) {
      // Tem background ou programmatic, invoca o helper!
    } else {
      fLpShowEmpty(canvas);
      fLpUpdateMeta(false);
      return;
    }
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
    canvas.width = W; canvas.height = H;
    fLpSizeCanvas(canvas, W, H);

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    // Dados preenchidos + placeholders {{var}} nos campos de texto ainda vazios
    // (e sem default do designer). dadosPreview é uma cópia — não mexe em fState.dados.
    const _defaults = (typeof gVarDefaults === 'function') ? gVarDefaults() : {};
    const dadosPreview = Object.assign({}, fState.dados || {});
    const pendentes = fLpInjectPlaceholders(fState.material.layers, dadosPreview, _defaults);

    if (!fState.material.layers || !fState.material.layers.length) {
      if (typeof fRenderCanvasHelper === 'function') {
        await fRenderCanvasHelper(canvas, fState.material, W, H, dadosPreview, fState.camp);
      }
    } else {
      await fRenderTemplateLayers(ctx, fState.material.layers, W, H, dadosPreview, fState.camp);
      
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
      
      // Smart Zoom & Highlight de Foco (Ideia 2)
      if (activeLayer && !fState.done) {
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

    if(_lpGuides) _fLpDrawGuides(ctx, W, H);

    // Micro-sinal de "vivo": anel que pulsa quando a prévia reflete uma resposta nova
    const wrap = canvas.closest('.lp-canvas-wrap');
    if(wrap){ wrap.classList.remove('updated'); void wrap.offsetWidth; wrap.classList.add('updated'); }

    fLpUpdateMeta(true);
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
  // Toolbar honesta: escala real da prévia + dimensões da arte final
  _lpScale = scale;
  const zoomEl = document.getElementById('lp-zoom');
  if(zoomEl) zoomEl.textContent = Math.round(scale * 100) + '%';
  const dimEl = document.getElementById('lp-dim');
  if(dimEl) dimEl.textContent = W + '×' + H;
}

// Reajusta a prévia à tela (botão da toolbar) — útil após redimensionar a janela.
function fLpRefit(){
  const canvas = document.getElementById('lp-canvas');
  if(!canvas || !canvas.width) return;
  const stage = canvas.closest('.lp-stage');
  if(stage) _fLpStageWidthCache = stage.clientWidth;
  fLpSizeCanvas(canvas, canvas.width, canvas.height);
}

// Liga/desliga as guias de composição (margens de segurança + terços + centro).
function fLpToggleGuides(){
  _lpGuides = !_lpGuides;
  const t = document.getElementById('lp-guides-toggle');
  if(t){ t.classList.toggle('active', _lpGuides); t.setAttribute('aria-checked', String(_lpGuides)); }
  try { fUpdateLivePreview(); } catch(e){}
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

// Desenha um véu translúcido sobre os layers com variáveis pendentes (tom mais suave).
// Só quando NÃO houve smart-resize: com reflow as coords mudam e o véu desalinharia.
function fLpHighlightEmpty(ctx, layers, pendentes, W, H){
  if(!pendentes || !pendentes.size) return;
  const src = (fState.material && fState.material.w>0 && fState.material.h>0)
    ? [fState.material.w, fState.material.h]
    : (F_LP_SIZES[(fState.material && fState.material.fmt)] || F_LP_SIZES.story);
  if(src[0] !== W || src[1] !== H) return; // houve reflow → omite o véu
  ctx.save();
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = '#000000';
  (layers || []).forEach(l => {
    if(!pendentes.has(l.id)) return;
    const r = Math.min(l.radius || 0, (l.w || 0) / 2, (l.h || 0) / 2);
    if(typeof roundedRect === 'function'){ roundedRect(ctx, l.x || 0, l.y || 0, l.w || W, l.h || 40, r || 0); ctx.fill(); }
    else { ctx.fillRect(l.x || 0, l.y || 0, l.w || W, l.h || 40); }
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

// Update inicial assim que DOM tá pronto
document.addEventListener('DOMContentLoaded', () => {
  try { dPreloadFolders(); } catch(e){}
  try { fUpdateLivePreview(); } catch(e){}
  try { fInitMobilePreviewEvents(); } catch(e){}
});

