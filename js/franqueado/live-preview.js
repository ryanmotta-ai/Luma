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
  const all=[...CAMPS_ATIVAS,...CAMPS_OUTRAS];
  const c=all.find(x=>x.id===id);if(!c)return;
  document.getElementById('pv-title').textContent=c.name;
  document.getElementById('pv-note').textContent=`${c.count} materiais · Expira em ${c.expiraDias} dias`;
  // F-09: monta os 3 formatos lado a lado, cada um clicável
  const multi = document.getElementById('pv-multi');
  multi.innerHTML = FMTS.map(f=>{
    const cls = `pv-multi-canvas pv-fmt-${f.id}`;
    return `<div class="pv-multi-item" onclick="fStartFromPreview('${c.id}','${f.id}')" role="button" tabindex="0">
      <div class="${cls}" style="background:${c.color}">
        <div class="pv-multi-tag">${c.name.toUpperCase()}</div>
        <div class="pv-multi-prod">${c.previewProd||c.name}</div>
        ${c.previewDe?`<div class="pv-multi-de">${c.previewDe}</div>`:''}
        ${c.previewPor?`<div class="pv-multi-por">${c.previewPor}</div>`:''}
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
// Dimensões por formato — espelha o png-generator (cobre 'post' e 'wide', que o
// DFMT_SIZES do designer não tem). fState.fmt.id pode ser 'post'.
const F_LP_SIZES = {story:[1080,1920], feed:[1080,1080], wide:[1200,628], post:[1200,628]};

let _lpRendering = false;
let _lpPendingRender = false;

async function fUpdateLivePreview(opts){
  opts = opts || {}; // animateField é ignorado: o canvas já reflete o estado atual
  const canvas = document.getElementById('lp-canvas');
  if(!canvas || canvas.tagName !== 'CANVAS') return;

  // Sem template selecionado → estado vazio
  if(!fState.material || !fState.material.layers || !fState.material.layers.length){
    fLpShowEmpty(canvas);
    fLpUpdateMeta(false);
    return;
  }

  // Render em andamento → agenda só mais um (coalesce de digitação rápida)
  if(_lpRendering){ _lpPendingRender = true; return; }
  _lpRendering = true;

  try {
    const fmtId = (fState.fmt && fState.fmt.id) || fState.material.fmt || 'story';
    const sz = F_LP_SIZES[fmtId] || F_LP_SIZES.story;
    const W = sz[0], H = sz[1];
    canvas.width = W; canvas.height = H;
    fLpSizeCanvas(canvas, W, H);

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    // Dados preenchidos + placeholders {{var}} nos campos de texto ainda vazios
    // (e sem default do designer). dadosPreview é uma cópia — não mexe em fState.dados.
    const _defaults = (typeof gVarDefaults === 'function') ? gVarDefaults() : {};
    const dadosPreview = Object.assign({}, fState.dados || {});
    const pendentes = fLpInjectPlaceholders(fState.material.layers, dadosPreview, _defaults);

    await fRenderTemplateLayers(ctx, fState.material.layers, W, H, dadosPreview, fState.camp);

    // Véu sutil sobre os campos ainda não preenchidos (tom mais suave)
    fLpHighlightEmpty(ctx, fState.material.layers, pendentes, W, H);

    fLpUpdateMeta(true);
  } catch(e){
    console.warn('[lp] erro ao renderizar preview:', e);
    fLpShowEmpty(canvas);
    fLpUpdateMeta(true);
  } finally {
    _lpRendering = false;
    if(_lpPendingRender){ _lpPendingRender = false; setTimeout(()=>fUpdateLivePreview(), 50); }
  }
}

// Dimensiona o canvas para caber no .lp-stage sem distorcer (escala única).
function fLpSizeCanvas(canvas, W, H){
  const stage = canvas.closest('.lp-stage') || canvas.parentElement;
  const csW = (stage && stage.clientWidth) ? stage.clientWidth : 264;
  const availW = Math.max(120, csW - 36); // desconta o padding lateral do .lp-stage (18+18)
  const maxH = 380;
  const scale = Math.min(availW / W, maxH / H);
  canvas.style.width  = Math.round(W * scale) + 'px';
  canvas.style.height = Math.round(H * scale) + 'px';
}

// Estado vazio: nenhum template selecionado.
function fLpShowEmpty(canvas){
  const W = 600, H = 800;
  canvas.width = W; canvas.height = H;
  fLpSizeCanvas(canvas, W, H);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.font = '28px Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('aguardando template...', W / 2, H / 2);
}

// Injeta placeholder {{var}} nos layers de texto com variável vazia e sem default.
// A detecção de "vazio" usa fState.dados original (não o clone mutado), pra a mesma
// variável em vários layers marcar todos. Retorna o Set de ids de layers pendentes.
function fLpInjectPlaceholders(layers, dadosPreview, defaults){
  const pendentes = new Set();
  const orig = fState.dados || {};
  (layers || []).forEach(l => {
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
      // Só injeta token literal se NÃO houver default — com default o motor já preenche.
      if(def == null || def === ''){ dadosPreview[name] = '{{' + name + '}}'; }
    }
  });
  return pendentes;
}

// Desenha um véu translúcido sobre os layers com variáveis pendentes (tom mais suave).
// Só quando NÃO houve smart-resize: com reflow as coords mudam e o véu desalinharia.
function fLpHighlightEmpty(ctx, layers, pendentes, W, H){
  if(!pendentes || !pendentes.size) return;
  const src = F_LP_SIZES[(fState.material && fState.material.fmt)] || F_LP_SIZES.story;
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

// Atualiza a lista de campos (#lp-fields) e o sub-header (#lp-sub).
function fLpUpdateMeta(hasTemplate){
  const fieldsEl = document.getElementById('lp-fields');
  const subEl = document.getElementById('lp-sub');
  const c = fState.camp, d = fState.dados || {};
  const perguntas = (hasTemplate && c && c.perguntas) ? c.perguntas : [];
  if(fieldsEl){
    const currentIdx = (fState.stepIdx >= 0 && fState.stepIdx < perguntas.length) ? fState.stepIdx : -1;
    fieldsEl.innerHTML = perguntas.map((p, i) => {
      const filled = d[p.id] != null && d[p.id] !== '';
      const isCurrent = i === currentIdx && !filled && !fState.done;
      const cls = 'lp-field' + (filled ? ' filled' : '') + (isCurrent ? ' current' : '');
      const valDisplay = p.isImage
        ? (filled ? '✓ foto enviada' : (isCurrent ? 'aguardando...' : '—'))
        : (filled ? gEsc(d[p.id]) : (isCurrent ? 'aguardando...' : '—'));
      return `<div class="${cls}">
        <div class="lp-field-dot"></div>
        <div class="lp-field-label">${F_FIELD_LABELS[p.id] || p.label || p.id}</div>
        <div class="lp-field-val">${valDisplay}</div>
      </div>`;
    }).join('');
  }
  if(subEl){
    if(!hasTemplate){ subEl.textContent = 'selecione um material...'; subEl.classList.remove('ready'); return; }
    const total = perguntas.length;
    const preenchidos = perguntas.filter(p => d[p.id] != null && d[p.id] !== '').length;
    if(fState.done){ subEl.textContent = 'arte pronta ✓'; subEl.classList.add('ready'); }
    else if(preenchidos === 0){ subEl.textContent = 'aguardando respostas...'; subEl.classList.remove('ready'); }
    else if(preenchidos === total){ subEl.textContent = 'tudo pronto · confirme pra gerar'; subEl.classList.add('ready'); }
    else { subEl.textContent = `${preenchidos} de ${total} preenchido${preenchidos > 1 ? 's' : ''}`; subEl.classList.remove('ready'); }
  }
}
// Update inicial assim que DOM tá pronto
document.addEventListener('DOMContentLoaded', () => {
  try { dPreloadFolders(); } catch(e){}
  try { fUpdateLivePreview(); } catch(e){}
});

