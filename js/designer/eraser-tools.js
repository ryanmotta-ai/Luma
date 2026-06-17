// ============================================================================
// eraser-tools.js — Ferramentas avançadas de borracha para o Luma
// Borracha de Fundo (Background Eraser) e Borracha Mágica (Magic Eraser)
// ============================================================================

// ---------------------------------------------------------------------------
//  BORRACHA DE FUNDO (Background Eraser) — Configuração
// ---------------------------------------------------------------------------

/** Tolerância de cor para a borracha de fundo (0-255, distância euclidiana RGB) */
let dBgEraserTolerance = 50;

/** Cor de referência amostrada no mousedown — {r, g, b} ou null */
let dBgEraserRefColor = null;

/**
 * Modo de amostragem da cor de referência:
 *   'once'       — amostra apenas no primeiro clique (mousedown)
 *   'continuous' — reamostra a cada passo do pincel (mousemove)
 *   'swatch'     — usa cor fixa definida pelo usuário (dBgEraserRefColor manual)
 */
let dBgEraserSampling = 'once';

// ---------------------------------------------------------------------------
//  BORRACHA DE FUNDO — Funções
// ---------------------------------------------------------------------------

/**
 * Amostra a cor de referência no ponto (x, y) do paint canvas.
 * Atualiza dBgEraserRefColor com os valores RGB do pixel.
 * @param {CanvasRenderingContext2D} ctx — contexto do paint canvas
 * @param {number} x — coordenada X (pixels, inteiro)
 * @param {number} y — coordenada Y (pixels, inteiro)
 */
function dBgEraserSample(ctx, x, y) {
  // Garante coordenadas inteiras para getImageData
  var px = Math.round(x);
  var py = Math.round(y);

  // Pega exatamente 1 pixel
  var pixel = ctx.getImageData(px, py, 1, 1).data;

  // Se o pixel for totalmente transparente, não atualiza a referência
  if (pixel[3] === 0) return;

  dBgEraserRefColor = { r: pixel[0], g: pixel[1], b: pixel[2] };
}

/**
 * Distância de cor euclidiana no espaço RGB.
 * Valor máximo teórico: ~441.67 (√(255²+255²+255²))
 * @returns {number} distância entre as duas cores
 */
function _dBgEraserColorDist(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

/**
 * Apaga pixels similares à cor de referência dentro do raio do pincel.
 * Aplica feathering suave na borda do pincel.
 *
 * @param {CanvasRenderingContext2D} ctx — contexto do paint canvas
 * @param {number} x — centro X do pincel
 * @param {number} y — centro Y do pincel
 * @param {number} brushSize — diâmetro do pincel em pixels
 */
function dBgEraserStep(ctx, x, y, brushSize) {
  // Sem cor de referência, nada a fazer
  if (!dBgEraserRefColor) return;

  var ref = dBgEraserRefColor;
  var radius = brushSize / 2;

  // Coordenadas do retângulo que contém o pincel (clampado ao canvas)
  var canvasW = ctx.canvas.width;
  var canvasH = ctx.canvas.height;

  var sx = Math.max(0, Math.floor(x - radius));
  var sy = Math.max(0, Math.floor(y - radius));
  var ex = Math.min(canvasW, Math.ceil(x + radius));
  var ey = Math.min(canvasH, Math.ceil(y + radius));

  var regionW = ex - sx;
  var regionH = ey - sy;

  // Nada a processar se a região é inválida
  if (regionW <= 0 || regionH <= 0) return;

  // Obtém os dados de pixels da região do pincel
  var imgData = ctx.getImageData(sx, sy, regionW, regionH);
  var data = imgData.data;

  var changed = false;

  for (var py = 0; py < regionH; py++) {
    for (var px = 0; px < regionW; px++) {
      // Coordenadas absolutas deste pixel
      var absX = sx + px;
      var absY = sy + py;

      // Distância do centro do pincel
      var dx = absX - x;
      var dy = absY - y;
      var distFromCenter = Math.sqrt(dx * dx + dy * dy);

      // Fora do raio do pincel — ignora
      if (distFromCenter > radius) continue;

      var idx = (py * regionW + px) * 4;

      // Pixel já transparente — pula
      if (data[idx + 3] === 0) continue;

      // Distância de cor entre este pixel e a referência
      var colorDist = _dBgEraserColorDist(
        data[idx], data[idx + 1], data[idx + 2],
        ref.r, ref.g, ref.b
      );

      // Cor fora da tolerância — mantém o pixel
      if (colorDist > dBgEraserTolerance) continue;

      // === Feathering na borda do pincel ===
      // Fator de borda: 1.0 no centro, decai suavemente até 0.0 na borda
      var edgeFactor = 1.0;
      var featherZone = radius * 0.3; // 30% externo do raio é zona de feathering
      var featherStart = radius - featherZone;

      if (distFromCenter > featherStart) {
        // Interpolação suave (coseno) na zona de feathering
        var t = (distFromCenter - featherStart) / featherZone;
        edgeFactor = 0.5 * (1.0 + Math.cos(Math.PI * t)); // 1→0 suave
      }

      // Fator de semelhança: quanto mais parecida a cor, mais apaga
      var colorFactor = 1.0 - (colorDist / dBgEraserTolerance);

      // Alpha final = alpha atual * (1 - eraseFactor)
      var eraseFactor = edgeFactor * colorFactor;
      var newAlpha = data[idx + 3] * (1.0 - eraseFactor);
      data[idx + 3] = Math.max(0, Math.round(newAlpha));

      changed = true;
    }
  }

  // Só escreve de volta se houve alguma alteração
  if (changed) {
    ctx.putImageData(imgData, sx, sy);
  }
}

/**
 * Inicia o traço da borracha de fundo (chamado no mousedown).
 * Amostra a cor de referência se o modo for 'once'.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 */
function dBgEraserStart(ctx, x, y) {
  if (dBgEraserSampling === 'once' || dBgEraserSampling === 'continuous') {
    dBgEraserSample(ctx, x, y);
  }
  // No modo 'swatch', dBgEraserRefColor já deve estar definido manualmente
  dBgEraserStep(ctx, x, y, dBrush.size);
}

/**
 * Continua o traço da borracha de fundo (chamado no mousemove durante drag).
 * Reamostra se estiver em modo contínuo.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 */
function dBgEraserMove(ctx, x, y) {
  if (dBgEraserSampling === 'continuous') {
    dBgEraserSample(ctx, x, y);
  }
  dBgEraserStep(ctx, x, y, dBrush.size);
}

/**
 * Finaliza o traço da borracha de fundo (chamado no mouseup).
 * Limpa a cor de referência se o modo for 'once'.
 */
function dBgEraserEnd() {
  if (dBgEraserSampling === 'once') {
    dBgEraserRefColor = null;
  }
  // Salva estado para undo
  dHistoryPush();
  dMarkUnsaved();
}


// ---------------------------------------------------------------------------
//  BORRACHA MÁGICA (Magic Eraser) — Configuração
// ---------------------------------------------------------------------------

/** Tolerância de cor para a borracha mágica (0-255) */
let dMagicEraserTolerance = 32;

/** Se true: flood-fill contíguo (4-connected). Se false: apaga todos os pixels similares */
let dMagicEraserContiguous = true;

/** Se true: suaviza bordas com alpha parcial baseado na distância de cor */
let dMagicEraserAntiAlias = true;

// ---------------------------------------------------------------------------
//  BORRACHA MÁGICA — Funções
// ---------------------------------------------------------------------------

/**
 * BFS flood-fill para borracha mágica contígua.
 * Percorre pixels 4-conectados a partir do ponto inicial, apagando os que
 * possuem cor similar à referência dentro da tolerância.
 *
 * @param {Uint8ClampedArray} data — array de pixels (RGBA)
 * @param {number} w — largura do canvas
 * @param {number} h — altura do canvas
 * @param {number} startX — X inicial do flood-fill
 * @param {number} startY — Y inicial do flood-fill
 * @param {number} refR — componente R da cor de referência
 * @param {number} refG — componente G da cor de referência
 * @param {number} refB — componente B da cor de referência
 * @param {number} tolerance — tolerância de distância de cor
 * @param {boolean} antiAlias — se true, aplica alpha parcial nas bordas
 */
function _dMagicEraserFlood(data, w, h, startX, startY, refR, refG, refB, tolerance, antiAlias) {
  // Mapa de pixels visitados (1 bit por pixel via Uint8Array)
  var visited = new Uint8Array(w * h);

  // Fila BFS — armazena índices lineares (y * w + x)
  var queue = [];
  var startIdx = startY * w + startX;

  // Verifica se o pixel inicial é válido
  var si = startIdx * 4;
  if (data[si + 3] === 0) return; // pixel já transparente

  queue.push(startIdx);
  visited[startIdx] = 1;

  // Offsets para vizinhos 4-conectados: cima, baixo, esquerda, direita
  var dx = [0, 0, -1, 1];
  var dy = [-1, 1, 0, 0];

  while (queue.length > 0) {
    var current = queue.shift();
    var cx = current % w;
    var cy = (current - cx) / w;
    var ci = current * 4;

    // Calcula distância de cor deste pixel à referência
    var dist = _dBgEraserColorDist(
      data[ci], data[ci + 1], data[ci + 2],
      refR, refG, refB
    );

    if (dist <= tolerance) {
      // Dentro da tolerância — apaga o pixel
      if (antiAlias && dist > tolerance * 0.7) {
        // Zona de transição (últimos 30% da tolerância): alpha parcial
        var t = (dist - tolerance * 0.7) / (tolerance * 0.3);
        data[ci + 3] = Math.round(data[ci + 3] * t);
      } else {
        data[ci + 3] = 0;
      }

      // Enfileira vizinhos 4-conectados
      for (var d = 0; d < 4; d++) {
        var nx = cx + dx[d];
        var ny = cy + dy[d];

        // Verifica limites
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;

        var ni = ny * w + nx;
        if (visited[ni]) continue;

        visited[ni] = 1;

        // Só enfileira se o pixel não for transparente
        if (data[ni * 4 + 3] > 0) {
          queue.push(ni);
        }
      }
    }
    // Se dist > tolerance, pixel fica intocado (e não propaga)
  }
}

/**
 * Executa a borracha mágica no ponto clicado.
 * Amostra a cor, depois apaga pixels similares (contíguos ou globais).
 *
 * @param {CanvasRenderingContext2D} ctx — contexto do paint canvas
 * @param {number} x — coordenada X do clique
 * @param {number} y — coordenada Y do clique
 * @param {number} canvasW — largura total do canvas
 * @param {number} canvasH — altura total do canvas
 */
function dMagicEraserAt(ctx, x, y, canvasW, canvasH) {
  // Coordenadas inteiras
  var px = Math.round(x);
  var py = Math.round(y);

  // Clamp às bordas do canvas
  if (px < 0 || px >= canvasW || py < 0 || py >= canvasH) {
    gToast('Clique dentro da área do canvas');
    return;
  }

  // Obtém todos os pixels do canvas
  var imgData = ctx.getImageData(0, 0, canvasW, canvasH);
  var data = imgData.data;

  // Amostra a cor de referência no ponto clicado
  var si = (py * canvasW + px) * 4;

  // Se o pixel clicado já é transparente, nada a fazer
  if (data[si + 3] === 0) {
    gToast('Pixel já é transparente');
    return;
  }

  var refR = data[si];
  var refG = data[si + 1];
  var refB = data[si + 2];

  if (dMagicEraserContiguous) {
    // --- Modo contíguo: BFS flood-fill ---
    _dMagicEraserFlood(
      data, canvasW, canvasH,
      px, py,
      refR, refG, refB,
      dMagicEraserTolerance,
      dMagicEraserAntiAlias
    );
  } else {
    // --- Modo global: varre TODOS os pixels do canvas ---
    var totalPixels = canvasW * canvasH;
    for (var i = 0; i < totalPixels; i++) {
      var idx = i * 4;

      // Pula pixels já transparentes
      if (data[idx + 3] === 0) continue;

      var dist = _dBgEraserColorDist(
        data[idx], data[idx + 1], data[idx + 2],
        refR, refG, refB
      );

      if (dist <= dMagicEraserTolerance) {
        if (dMagicEraserAntiAlias && dist > dMagicEraserTolerance * 0.7) {
          // Anti-alias: alpha parcial na zona de transição
          var t = (dist - dMagicEraserTolerance * 0.7) / (dMagicEraserTolerance * 0.3);
          data[idx + 3] = Math.round(data[idx + 3] * t);
        } else {
          data[idx + 3] = 0;
        }
      }
    }
  }

  // Aplica as alterações de volta no canvas
  ctx.putImageData(imgData, 0, 0);

  // Salva estado para undo e marca como não-salvo
  dHistoryPush();
  dMarkUnsaved();
  dRenderCanvas();
}


// ---------------------------------------------------------------------------
//  UTILITÁRIOS COMPARTILHADOS
// ---------------------------------------------------------------------------

/**
 * Gera o HTML da barra de opções para as borrachas avançadas.
 * Retorna string HTML pronta para inserir no painel de opções.
 *
 * @param {'bg-eraser'|'magic-eraser'} tool — ferramenta ativa
 * @returns {string} HTML da barra de opções
 */
function dEraserToolsOptionsHTML(tool) {
  if (tool === 'bg-eraser') {
    return '' +
      '<div class="d-eraser-opts" style="display:flex;align-items:center;gap:12px;padding:4px 8px;">' +
        // Tolerância
        '<label style="display:flex;align-items:center;gap:4px;font-size:12px;">' +
          'Tolerância: ' +
          '<input type="range" min="1" max="255" value="' + dBgEraserTolerance + '" ' +
            'oninput="dBgEraserTolerance=+this.value;this.nextElementSibling.textContent=this.value" ' +
            'style="width:100px;">' +
          '<span style="min-width:28px;text-align:right;">' + dBgEraserTolerance + '</span>' +
        '</label>' +
        // Modo de amostragem
        '<label style="display:flex;align-items:center;gap:4px;font-size:12px;">' +
          'Amostragem: ' +
          '<select onchange="dBgEraserSampling=this.value" style="font-size:12px;">' +
            '<option value="once"' + (dBgEraserSampling === 'once' ? ' selected' : '') + '>Uma vez</option>' +
            '<option value="continuous"' + (dBgEraserSampling === 'continuous' ? ' selected' : '') + '>Contínua</option>' +
            '<option value="swatch"' + (dBgEraserSampling === 'swatch' ? ' selected' : '') + '>Amostra fixa</option>' +
          '</select>' +
        '</label>' +
      '</div>';
  }

  if (tool === 'magic-eraser') {
    return '' +
      '<div class="d-eraser-opts" style="display:flex;align-items:center;gap:12px;padding:4px 8px;">' +
        // Tolerância
        '<label style="display:flex;align-items:center;gap:4px;font-size:12px;">' +
          'Tolerância: ' +
          '<input type="range" min="1" max="255" value="' + dMagicEraserTolerance + '" ' +
            'oninput="dMagicEraserTolerance=+this.value;this.nextElementSibling.textContent=this.value" ' +
            'style="width:100px;">' +
          '<span style="min-width:28px;text-align:right;">' + dMagicEraserTolerance + '</span>' +
        '</label>' +
        // Contíguo
        '<label style="display:flex;align-items:center;gap:4px;font-size:12px;">' +
          '<input type="checkbox"' + (dMagicEraserContiguous ? ' checked' : '') + ' ' +
            'onchange="dMagicEraserContiguous=this.checked">' +
          'Contíguo' +
        '</label>' +
        // Anti-alias
        '<label style="display:flex;align-items:center;gap:4px;font-size:12px;">' +
          '<input type="checkbox"' + (dMagicEraserAntiAlias ? ' checked' : '') + ' ' +
            'onchange="dMagicEraserAntiAlias=this.checked">' +
          'Anti-alias' +
        '</label>' +
      '</div>';
  }

  return '';
}

/**
 * Reseta todas as configurações das borrachas avançadas para os valores padrão.
 */
function dEraserToolsReset() {
  // Borracha de fundo
  dBgEraserTolerance = 50;
  dBgEraserRefColor = null;
  dBgEraserSampling = 'once';

  // Borracha mágica
  dMagicEraserTolerance = 32;
  dMagicEraserContiguous = true;
  dMagicEraserAntiAlias = true;
}
