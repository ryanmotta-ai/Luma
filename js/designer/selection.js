/**
 * js/designer/selection.js
 *
 * Ferramentas avançadas de seleção inspiradas no Photoshop:
 *   1. Object Selection (obj-select)  — retângulo + IOU
 *   2. Quick Selection (quick-select) — hit-test por clique/arrasto
 *   3. Magic Wand (magic-wand)        — seleção por cor dominante
 *
 * Depende de: designer/canvas.js, designer/layers.js
 */


/* ═══════════════════════════════════════════════════════════════════
 *  ESTADO COMPARTILHADO — Opções da barra de ferramentas
 * ═══════════════════════════════════════════════════════════════════ */

/** Tolerância para Magic Wand (0–255 por canal, distância euclidiana) */
let dSelectionTolerance = 32;

/** Se true, Magic Wand considera apenas layers "adjacentes" (contíguos) */
let dSelectionContiguous = true;


/* ═══════════════════════════════════════════════════════════════════
 *  1. OBJECT SELECTION — Rubber Band + IOU
 * ═══════════════════════════════════════════════════════════════════ */

/**
 * Estado do arrasto de Object Selection.
 * {startX, startY, curX, curY, preview: HTMLDivElement} ou null
 */
let dObjSelectState = null;

/**
 * Inicia o arrasto do retângulo de seleção por objeto.
 * Chamado no mousedown do canvas-frame quando a ferramenta ativa é 'obj-select'.
 * @param {MouseEvent} e
 * @param {HTMLElement} frame — #d-canvas-frame
 */
function dObjSelectStart(e, frame) {
  // Coordenadas relativas ao frame, compensando zoom
  const rect = frame.getBoundingClientRect();
  const scale = dZoomLevel / 100;
  const x = (e.clientX - rect.left) / scale;
  const y = (e.clientY - rect.top) / scale;

  // Criar div de preview (rubber band)
  const preview = document.createElement('div');
  preview.className = 'd-objsel-preview';
  preview.style.cssText =
    'position:absolute;border:2px dashed #4A90D9;background:rgba(74,144,217,0.12);' +
    'pointer-events:none;z-index:9999;box-sizing:border-box;';
  frame.appendChild(preview);

  dObjSelectState = { startX: x, startY: y, curX: x, curY: y, preview: preview, frame: frame };

  // Listeners globais para capturar mesmo fora do frame
  document.addEventListener('mousemove', dObjSelectMove);
  document.addEventListener('mouseup', dObjSelectEnd);
}

/**
 * Atualiza a posição do retângulo de rubber band enquanto o usuário arrasta.
 * @param {MouseEvent} e
 */
function dObjSelectMove(e) {
  const st = dObjSelectState;
  if (!st) return;

  const rect = st.frame.getBoundingClientRect();
  const scale = dZoomLevel / 100;
  st.curX = (e.clientX - rect.left) / scale;
  st.curY = (e.clientY - rect.top) / scale;

  // Calcular retângulo normalizado (suporte a arrastar em qualquer direção)
  const lx = Math.min(st.startX, st.curX);
  const ly = Math.min(st.startY, st.curY);
  const rw = Math.abs(st.curX - st.startX);
  const rh = Math.abs(st.curY - st.startY);

  st.preview.style.left   = lx + 'px';
  st.preview.style.top    = ly + 'px';
  st.preview.style.width  = rw + 'px';
  st.preview.style.height = rh + 'px';
}

/**
 * Finaliza o arrasto: calcula IOU de cada layer com o retângulo desenhado
 * e seleciona o layer com maior sobreposição.
 * @param {MouseEvent} e
 */
function dObjSelectEnd(e) {
  document.removeEventListener('mousemove', dObjSelectMove);
  document.removeEventListener('mouseup', dObjSelectEnd);

  const st = dObjSelectState;
  if (!st) return;

  // Remover preview
  if (st.preview && st.preview.parentNode) {
    st.preview.parentNode.removeChild(st.preview);
  }

  // Retângulo desenhado pelo usuário (coordenadas de design, sem zoom)
  const rx = Math.min(st.startX, st.curX);
  const ry = Math.min(st.startY, st.curY);
  const rw = Math.abs(st.curX - st.startX);
  const rh = Math.abs(st.curY - st.startY);

  dObjSelectState = null;

  // Se o retângulo é muito pequeno, desselecionar
  if (rw < 4 && rh < 4) {
    dSelId = null;
    dMultiSel = [];
    dRenderCanvas();
    dRenderLayersList();
    return;
  }

  // Calcular IOU de cada layer elegível
  let bestLayer = null;
  let bestIOU = 0;
  const MIN_IOU = 0.02; // limiar mínimo para considerar sobreposição

  for (let i = 0; i < dLayers.length; i++) {
    const l = dLayers[i];
    // Pular layers invisíveis, travados e grupos
    if (!l.visible || l.locked || l.type === 'group') continue;

    const iou = _dObjSelectIOU(rx, ry, rw, rh, l.x, l.y, l.w, l.h);
    if (iou > bestIOU) {
      bestIOU = iou;
      bestLayer = l;
    }
  }

  if (bestLayer && bestIOU >= MIN_IOU) {
    // Shift → multi-select; senão → seleção simples
    if (e.shiftKey) {
      dToggleMultiSel(bestLayer.id);
    } else {
      dSelLayer(bestLayer.id);
    }
    gToast('✓ Selecionado: ' + (bestLayer.name || bestLayer.id));
  } else {
    // Nenhuma sobreposição significativa — desselecionar
    dSelId = null;
    dMultiSel = [];
    dRenderCanvas();
    dRenderLayersList();
  }
}

/**
 * Calcula o Intersection over Union (IOU) entre dois retângulos.
 * @returns {number} 0 a 1
 * @private
 */
function _dObjSelectIOU(ax, ay, aw, ah, bx, by, bw, bh) {
  // Interseção
  const ix = Math.max(ax, bx);
  const iy = Math.max(ay, by);
  const ix2 = Math.min(ax + aw, bx + bw);
  const iy2 = Math.min(ay + ah, by + bh);

  if (ix2 <= ix || iy2 <= iy) return 0; // sem interseção

  const interArea = (ix2 - ix) * (iy2 - iy);
  const areaA = aw * ah;
  const areaB = bw * bh;
  const unionArea = areaA + areaB - interArea;

  return unionArea > 0 ? interArea / unionArea : 0;
}


/* ═══════════════════════════════════════════════════════════════════
 *  2. QUICK SELECTION — Hit-test por clique / arrasto
 * ═══════════════════════════════════════════════════════════════════ */

/**
 * Seleciona o layer mais ao topo sob o ponto (x, y) no canvas.
 * Coordenadas em espaço de design (sem zoom).
 *
 * @param {number} x
 * @param {number} y
 * @param {boolean} additive  — true se Shift estiver pressionado (adicionar à seleção)
 * @param {boolean} subtractive — true se Alt estiver pressionado (remover da seleção)
 */
function dQuickSelectAt(x, y, additive, subtractive) {
  // Iterar de trás para frente (topo → base) para respeitar z-order
  for (let i = dLayers.length - 1; i >= 0; i--) {
    const l = dLayers[i];

    // Pular invisíveis, travados e grupos
    if (!l.visible || l.locked || l.type === 'group') continue;

    // Hit-test: verificar se (x,y) está dentro da bounding box do layer
    if (!_dQuickSelectHitTest(l, x, y)) continue;

    // Encontrou o layer mais ao topo neste ponto
    if (subtractive) {
      // Alt → remover da multi-seleção
      _dQuickSelectRemove(l.id);
    } else if (additive) {
      // Shift → adicionar à multi-seleção
      if (!dMultiSel.includes(l.id) && dSelId !== l.id) {
        dToggleMultiSel(l.id);
      }
    } else {
      // Clique simples → selecionar somente este layer
      dSelLayer(l.id);
    }
    dSelResult.ids = [l.id];
    return l.id;
  }

  // Nenhum layer atingido — desselecionar (se não estiver adicionando/removendo)
  if (!additive && !subtractive) {
    dSelId = null;
    dMultiSel = [];
    dRenderCanvas();
    dRenderLayersList();
  }
  dSelResult.ids = [];
  return null;
}

/**
 * Hit-test: retorna true se o ponto (px, py) está dentro do layer.
 * Para elipses/círculos, usa equação de elipse; caso contrário, bounding box.
 * @private
 */
function _dQuickSelectHitTest(layer, px, py) {
  // Verificar bounding box primeiro (descarta rápido)
  if (px < layer.x || px > layer.x + layer.w) return false;
  if (py < layer.y || py > layer.y + layer.h) return false;

  // Para shapes com forma de elipse/círculo, fazer hit-test preciso
  if (layer.type === 'shape' && (layer.shapeKind === 'circle' || layer.shapeKind === 'ellipse')) {
    // Centro e raios da elipse
    const cx = layer.x + layer.w / 2;
    const cy = layer.y + layer.h / 2;
    const rx = layer.w / 2;
    const ry = layer.h / 2;

    if (rx <= 0 || ry <= 0) return false;

    // Equação da elipse: ((px-cx)/rx)^2 + ((py-cy)/ry)^2 <= 1
    const dx = (px - cx) / rx;
    const dy = (py - cy) / ry;
    return (dx * dx + dy * dy) <= 1;
  }

  // Bounding box já foi aprovado
  return true;
}

/**
 * Remove um layer da seleção atual (Alt+click no Quick Selection).
 * Se o layer era o dSelId, promove o primeiro da multi-sel ou desseleciona.
 * @private
 */
function _dQuickSelectRemove(id) {
  const idx = dMultiSel.indexOf(id);
  if (idx !== -1) {
    dMultiSel.splice(idx, 1);
  }

  if (dSelId === id) {
    if (dMultiSel.length > 0) {
      dSelId = dMultiSel.shift();
    } else {
      dSelId = null;
    }
  }

  dRenderCanvas();
  dRenderLayersList();
}

/**
 * Converte coordenadas do mouse (clientX/Y) para espaço de design (sem zoom).
 * Utilitário para handlers de Quick Selection.
 * @param {MouseEvent} e
 * @returns {{x: number, y: number}}
 */
function dQuickSelectCoordsFromEvent(e) {
  const frame = document.getElementById('d-canvas-frame');
  if (!frame) return { x: 0, y: 0 };
  const rect = frame.getBoundingClientRect();
  const scale = dZoomLevel / 100;
  return {
    x: (e.clientX - rect.left) / scale,
    y: (e.clientY - rect.top) / scale
  };
}


/* ═══════════════════════════════════════════════════════════════════
 *  3. MAGIC WAND — Seleção por cor dominante
 * ═══════════════════════════════════════════════════════════════════ */

/** Tolerância da Magic Wand (0–255 de distância Euclidiana RGB) */
let dMagicWandTolerance = 32;

/**
 * Clique da Magic Wand: amostra a cor do layer mais ao topo sob (x, y)
 * e seleciona TODOS os layers cuja cor dominante está dentro da tolerância.
 * Coordenadas em espaço de design (sem zoom).
 *
 * @param {number} x
 * @param {number} y
 */
function dMagicWandAt(x, y) {
  // 1. Encontrar o layer mais ao topo neste ponto
  let sourceLayer = null;
  for (let i = dLayers.length - 1; i >= 0; i--) {
    const l = dLayers[i];
    if (!l.visible || l.locked || l.type === 'group') continue;
    if (_dQuickSelectHitTest(l, x, y)) {
      sourceLayer = l;
      break;
    }
  }

  if (!sourceLayer) {
    gToast('⚠ Nenhuma camada sob o ponto');
    dSelId = null;
    dMultiSel = [];
    dRenderCanvas();
    dRenderLayersList();
    return;
  }

  // 2. Obter cor dominante do layer-fonte
  const sourceColor = _dMagicWandGetLayerColor(sourceLayer);
  if (!sourceColor) {
    gToast('⚠ Camada sem cor dominante (imagem/frame)');
    return;
  }

  // 3. Encontrar todos os layers cuja cor está dentro da tolerância
  const tolerance = dMagicWandTolerance;
  const matched = [];

  for (let i = 0; i < dLayers.length; i++) {
    const l = dLayers[i];
    if (!l.visible || l.locked || l.type === 'group') continue;

    const lColor = _dMagicWandGetLayerColor(l);
    if (!lColor) continue;

    const dist = _dMagicWandColorDist(sourceColor, lColor);
    if (dist <= tolerance) {
      matched.push(l);
    }
  }

  if (matched.length === 0) {
    gToast('⚠ Nenhuma camada correspondente');
    return;
  }

  // 4. Selecionar: primeiro vira dSelId, restantes entram em dMultiSel
  dSelId = matched[0].id;
  dMultiSel = matched.slice(1).map(function (l) { return l.id; });

  dRenderCanvas();
  dRenderLayersList();
  gToast('✓ Magic Wand: ' + matched.length + ' camada(s) selecionada(s) (cor: ' + sourceColor + ')');
}

/**
 * Retorna a cor hexadecimal dominante de um layer, ou null.
 * - Texto → l.color
 * - Shape → l.fill
 * - Image/Frame → null (sem cor dominante determinável)
 * @private
 */
function _dMagicWandGetLayerColor(l) {
  if (l.type === 'text') {
    return l.color || null;
  }
  if (l.type === 'shape') {
    return l.fill || null;
  }
  // image, frame e outros tipos não têm cor dominante simples
  return null;
}

/**
 * Calcula a distância euclidiana entre duas cores hex no espaço RGB.
 * Retorna 0 (iguais) a ~441 (sqrt(3) * 255, preto vs branco).
 * @param {string} hex1 — ex: '#FF9000'
 * @param {string} hex2 — ex: '#FF8800'
 * @returns {number}
 * @private
 */
function _dMagicWandColorDist(hex1, hex2) {
  const c1 = _dMagicWandParseHex(hex1);
  const c2 = _dMagicWandParseHex(hex2);
  if (!c1 || !c2) return 999; // se não conseguir parsear, distância máxima

  const dr = c1.r - c2.r;
  const dg = c1.g - c2.g;
  const db = c1.b - c2.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Parseia uma string hex (#RGB, #RRGGBB, ou sem #) para {r, g, b}.
 * @private
 */
function _dMagicWandParseHex(hex) {
  if (!hex || typeof hex !== 'string') return null;

  // Remover '#' se presente
  let h = hex.replace(/^#/, '');

  // Suporte a shorthand (#RGB → #RRGGBB)
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }

  if (h.length !== 6) return null;

  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return { r: r, g: g, b: b };
}


/* ═══════════════════════════════════════════════════════════════════
 *  SELECTION OVERLAY — Marching Ants / Borda tracejada
 * ═══════════════════════════════════════════════════════════════════ */

/**
 * Renderiza o contorno de seleção (borda tracejada animada) nos layers
 * atualmente selecionados. Chamado após dRenderCanvas.
 *
 * Cria/atualiza uma div overlay sobre cada layer selecionado no #d-canvas-frame.
 * A animação de "marching ants" é feita via CSS (stroke-dashoffset animado).
 */
function dRenderSelectionOverlay() {
  const frame = document.getElementById('d-canvas-frame');
  if (!frame) return;

  // Remover overlays anteriores
  const old = frame.querySelectorAll('.d-sel-overlay');
  for (let i = 0; i < old.length; i++) {
    old[i].parentNode.removeChild(old[i]);
  }

  // Reunir IDs selecionados
  const selectedIds = [];
  if (dSelId) selectedIds.push(dSelId);
  if (dMultiSel && dMultiSel.length) {
    for (let i = 0; i < dMultiSel.length; i++) {
      if (!selectedIds.includes(dMultiSel[i])) {
        selectedIds.push(dMultiSel[i]);
      }
    }
  }

  if (selectedIds.length === 0) return;

  for (let i = 0; i < selectedIds.length; i++) {
    const l = dLayers.find(function (layer) { return layer.id === selectedIds[i]; });
    if (!l || !l.visible) continue;

    // Criar overlay SVG com borda tracejada animada (marching ants)
    const overlay = document.createElement('div');
    overlay.className = 'd-sel-overlay';
    overlay.style.cssText =
      'position:absolute;pointer-events:none;z-index:9998;' +
      'left:' + l.x + 'px;top:' + l.y + 'px;' +
      'width:' + l.w + 'px;height:' + l.h + 'px;';

    // SVG com stroke tracejado animado
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.cssText = 'position:absolute;top:0;left:0;overflow:visible;';

    const rectEl = document.createElementNS(svgNS, 'rect');
    rectEl.setAttribute('x', '0.5');
    rectEl.setAttribute('y', '0.5');
    rectEl.setAttribute('width', Math.max(0, l.w - 1) + '');
    rectEl.setAttribute('height', Math.max(0, l.h - 1) + '');
    rectEl.setAttribute('fill', 'none');
    rectEl.setAttribute('stroke', '#4A90D9');
    rectEl.setAttribute('stroke-width', '1.5');
    rectEl.setAttribute('stroke-dasharray', '6 4');
    rectEl.style.cssText = 'animation:d-marching-ants .4s linear infinite;';

    svg.appendChild(rectEl);
    overlay.appendChild(svg);
    frame.appendChild(overlay);
  }

  // Injetar CSS da animação se ainda não existir
  _dEnsureMarchingAntsCSS();
}

/**
 * Garante que o @keyframes de marching ants esteja no DOM.
 * @private
 */
let _dMarchingAntsCSSInjected = false;
function _dEnsureMarchingAntsCSS() {
  if (_dMarchingAntsCSSInjected) return;
  _dMarchingAntsCSSInjected = true;

  const style = document.createElement('style');
  style.textContent =
    '@keyframes d-marching-ants{to{stroke-dashoffset:-10;}}' +
    '.d-sel-overlay svg rect{will-change:stroke-dashoffset;}';
  document.head.appendChild(style);
}


/* ═══════════════════════════════════════════════════════════════════
 *  API DE LÓGICA PURA — P1.2
 *  Funções sem efeito colateral que retornam ids.
 *  A fiação com eventos é tarefa P1.3.
 * ═══════════════════════════════════════════════════════════════════ */

/**
 * Estado de resultado das seleções puras.
 * A fiação (P1.3) lê este objeto após cada chamada.
 */
var dSelResult = { ids: [], rect: null };


/* ─── 1. dObjSelectInRect ─────────────────────────────────────────── */

/**
 * Retorna o id do layer com maior IOU em relação ao retângulo de arrasto.
 * Ignora layers locked/invisible/group.
 *
 * @param {{x:number, y:number, w:number, h:number}} rect  Retângulo de seleção
 * @returns {string|null}  id do melhor layer, ou null
 */
function dObjSelectInRect(rect) {
    if (typeof dLayers === 'undefined') { dSelResult.ids = []; return null; }

    var best = null;
    var bestIou = 0;

    for (var i = 0; i < dLayers.length; i++) {
        var l = dLayers[i];
        if (!l.visible || l.locked || l.type === 'group') continue;

        var iou = _dIOU(rect, { x: l.x, y: l.y, w: l.w, h: l.h });
        if (iou > bestIou) {
            bestIou = iou;
            best = l.id;
        }
    }

    dSelResult.ids  = best ? [best] : [];
    dSelResult.rect = { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
    return best;
}

/**
 * Intersection-over-Union entre dois retângulos {x,y,w,h}.
 * @param {{x,y,w,h}} a
 * @param {{x,y,w,h}} b
 * @returns {number} 0–1
 * @private
 */
function _dIOU(a, b) {
    var ix  = Math.max(a.x, b.x);
    var iy  = Math.max(a.y, b.y);
    var ix2 = Math.min(a.x + a.w, b.x + b.w);
    var iy2 = Math.min(a.y + a.h, b.y + b.h);

    if (ix2 <= ix || iy2 <= iy) return 0;

    var inter = (ix2 - ix) * (iy2 - iy);
    var union = a.w * a.h + b.w * b.h - inter;
    return union > 0 ? inter / union : 0;
}


/* ─── 2. _dCompositeOffscreen ─────────────────────────────────────── */

/**
 * Cria e retorna um canvas offscreen com todos os layers visíveis renderizados
 * sincronamente (shapes geométricos; image/frame como rect opaco).
 * Não vaza nenhum nó no DOM — o canvas não é appendado a lugar nenhum.
 *
 * Usos principais:
 *   - Amostragem de cor (dMagicWandSelect)
 *   - Verificação de transparência em dQuickSelectAt para image/frame
 *
 * @param {number} w  Largura do canvas (px)
 * @param {number} h  Altura do canvas (px)
 * @returns {{cv: HTMLCanvasElement, ctx: CanvasRenderingContext2D}}
 */
function _dCompositeOffscreen(w, h) {
    var cv = document.createElement('canvas');
    cv.width  = Math.max(1, w | 0);
    cv.height = Math.max(1, h | 0);
    var ctx = cv.getContext('2d');

    if (typeof dLayers === 'undefined') return { cv: cv, ctx: ctx };

    for (var i = 0; i < dLayers.length; i++) {
        var l = dLayers[i];
        if (!l.visible || l.type === 'group') continue;

        ctx.save();
        ctx.globalAlpha = (l.opacity != null ? l.opacity : 100) / 100;

        if (l.type === 'shape') {
            ctx.fillStyle = l.fill || '#000000';

            if (l.shapeKind === 'circle' || l.shapeKind === 'ellipse') {
                var rx = l.w / 2;
                var ry = l.h / 2;
                ctx.beginPath();
                ctx.ellipse(l.x + rx, l.y + ry, rx, ry, 0, 0, Math.PI * 2);
                ctx.fill();
            } else {
                var rd = Math.min(l.radius || 0, Math.floor(l.w / 2), Math.floor(l.h / 2));
                if (rd > 0 && typeof ctx.roundRect === 'function') {
                    ctx.beginPath();
                    ctx.roundRect(l.x, l.y, l.w, l.h, rd);
                    ctx.fill();
                } else {
                    ctx.fillRect(l.x, l.y, l.w, l.h);
                }
            }
        } else {
            // text, image, frame → bounding box com a cor dominante disponível
            ctx.fillStyle = l.color || l.fill || 'rgba(128,128,128,0.9)';
            ctx.fillRect(l.x, l.y, l.w, l.h);
        }

        ctx.restore();
    }

    return { cv: cv, ctx: ctx };
}


/* ─── 3. dMagicWandSelect ─────────────────────────────────────────── */

/**
 * Amostra a cor do layer mais ao topo em (x, y) e retorna os ids de todos
 * os layers cuja cor representativa (fill para shape, color para text) esteja
 * dentro da tolerância (distância Euclidiana RGB).
 *
 * Se o layer-fonte for image/frame (sem cor hex direta), usa o pixel composto
 * do _dCompositeOffscreen para amostrar a cor do canvas renderizado.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} [tolerance=32]  0–441 (distância Euclidiana máx ≈ 441)
 * @returns {string[]}  Array de ids correspondentes (pode ser vazio)
 */
function dMagicWandSelect(x, y, tolerance) {
    if (typeof tolerance !== 'number') tolerance = 32;
    if (typeof dLayers === 'undefined') { dSelResult.ids = []; return []; }

    var px = Math.round(x);
    var py = Math.round(y);

    // 1. Encontrar layer-fonte no topo do ponto
    var srcLayer = null;
    for (var i = dLayers.length - 1; i >= 0; i--) {
        var l = dLayers[i];
        if (!l.visible || l.locked || l.type === 'group') continue;
        var hit = (typeof _dQuickSelectHitTest !== 'undefined')
            ? _dQuickSelectHitTest(l, x, y)
            : (x >= l.x && x <= l.x + l.w && y >= l.y && y <= l.y + l.h);
        if (hit) { srcLayer = l; break; }
    }

    if (!srcLayer) {
        dSelResult.ids = [];
        return [];
    }

    // 2. Obter cor do layer-fonte
    var srcHex = (srcLayer.type === 'text') ? (srcLayer.color || null)
               : (srcLayer.type === 'shape') ? (srcLayer.fill  || null)
               : null;

    // Para image/frame sem cor hex: amostrar pixel do canvas composto
    if (!srcHex) {
        var artW = (typeof dArtboards !== 'undefined' && dArtboards && dArtboards[0])
            ? dArtboards[0].w : 1080;
        var artH = (typeof dArtboards !== 'undefined' && dArtboards && dArtboards[0])
            ? dArtboards[0].h : 1920;
        var ofc = _dCompositeOffscreen(artW, artH);
        try {
            var pd = ofc.ctx.getImageData(px, py, 1, 1).data;
            if (pd[3] > 0) {
                srcHex = '#'
                    + ('0' + pd[0].toString(16)).slice(-2)
                    + ('0' + pd[1].toString(16)).slice(-2)
                    + ('0' + pd[2].toString(16)).slice(-2);
            }
        } catch (e) {}
    }

    if (!srcHex) {
        dSelResult.ids = [];
        return [];
    }

    // 3. Comparar cor de todos os layers com a cor-fonte
    var srcRgb = _dHexToRgb(srcHex);
    var matched = [];

    for (var j = 0; j < dLayers.length; j++) {
        var lj = dLayers[j];
        if (!lj.visible || lj.locked || lj.type === 'group') continue;

        var lHex = (lj.type === 'text')  ? (lj.color || null)
                 : (lj.type === 'shape') ? (lj.fill  || null)
                 : null;
        if (!lHex) continue;

        var lRgb = _dHexToRgb(lHex);
        if (_dColorDist(srcRgb, lRgb) <= tolerance) {
            matched.push(lj.id);
        }
    }

    dSelResult.ids  = matched;
    dSelResult.rect = null;
    return matched;
}

/**
 * Converte string hex (#RGB, #RRGGBB, sem #) para array [r, g, b].
 * @param {string} hex
 * @returns {number[]|null}  [r, g, b] em 0–255, ou null se inválido
 * @private
 */
function _dHexToRgb(hex) {
    if (!hex || typeof hex !== 'string') return null;

    var h = hex.replace(/^#/, '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length !== 6) return null;

    var r = parseInt(h.substring(0, 2), 16);
    var g = parseInt(h.substring(2, 4), 16);
    var b = parseInt(h.substring(4, 6), 16);

    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return [r, g, b];
}

/**
 * Distância Euclidiana RGB entre dois arrays [r, g, b].
 * Retorna 999 se algum array for inválido.
 * @param {number[]} c1
 * @param {number[]} c2
 * @returns {number}  0 (iguais) – ~441 (preto vs branco)
 * @private
 */
function _dColorDist(c1, c2) {
    if (!c1 || !c2) return 999;
    var dr = c1[0] - c2[0];
    var dg = c1[1] - c2[1];
    var db = c1[2] - c2[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
}
