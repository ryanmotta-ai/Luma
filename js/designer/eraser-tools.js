/**
 * js/designer/eraser-tools.js
 *
 * Borrachas avançadas sobre ImageData do #d-paint-canvas.
 * NÃO altera o pipeline de pintura (brush.js) nem a borracha simples.
 *
 * API pública:
 *   dBgEraseAt(ctx, x, y, radius, tolerance)
 *   dMagicEraseAt(ctx, x, y, tolerance)
 */

/**
 * Verifica se duas cores estão dentro da tolerância.
 * Usa distância euclidiana ao quadrado no espaço RGB (ignora alpha).
 * c1, c2 = arrays [r, g, b, a]
 */
function _dColorWithinTol(c1, c2, tol) {
  var dr = c1[0] - c2[0];
  var dg = c1[1] - c2[1];
  var db = c1[2] - c2[2];
  return (dr * dr + dg * dg + db * db) <= (tol * tol * 3);
}

/**
 * Background Eraser
 * Amostra a cor no ponto central (x, y) e, dentro do raio, zera o alpha
 * apenas dos pixels cuja cor está dentro da tolerância da cor amostrada.
 * Opera numa bbox mínima — nunca lê o canvas inteiro.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x          coordenada canvas (inteiro)
 * @param {number} y
 * @param {number} radius     raio em pixels (>= 1)
 * @param {number} tolerance  0–255 (distância euclidiana por canal)
 */
function dBgEraseAt(ctx, x, y, radius, tolerance) {
  if (!ctx) return;
  var cv = ctx.canvas;
  var r   = Math.max(1, Math.round(radius));
  var tol = Math.max(0, tolerance !== undefined ? tolerance : 30);

  // bbox mínima clampada ao canvas
  var sx = Math.max(0, x - r);
  var sy = Math.max(0, y - r);
  var ex = Math.min(cv.width  - 1, x + r);
  var ey = Math.min(cv.height - 1, y + r);
  var bw = ex - sx + 1;
  var bh = ey - sy + 1;
  if (bw <= 0 || bh <= 0) return;

  var imgData = ctx.getImageData(sx, sy, bw, bh);
  var d = imgData.data;

  // Amostra a cor do ponto central dentro da bbox
  var cx = Math.max(0, Math.min(bw - 1, x - sx));
  var cy = Math.max(0, Math.min(bh - 1, y - sy));
  var ci = (cy * bw + cx) * 4;
  var sample = [d[ci], d[ci + 1], d[ci + 2], d[ci + 3]];

  var r2 = r * r;
  for (var py = 0; py < bh; py++) {
    for (var px = 0; px < bw; px++) {
      var ddx = (sx + px) - x;
      var ddy = (sy + py) - y;
      if (ddx * ddx + ddy * ddy > r2) continue; // fora do círculo

      var idx = (py * bw + px) * 4;
      if (d[idx + 3] === 0) continue;            // já transparente

      var pix = [d[idx], d[idx + 1], d[idx + 2], d[idx + 3]];
      if (_dColorWithinTol(pix, sample, tol)) {
        d[idx + 3] = 0;
      }
    }
  }

  ctx.putImageData(imgData, sx, sy);
}

/**
 * Magic Eraser
 * Flood-fill BFS 4-direções a partir de (x, y), apagando (alpha=0)
 * toda a região contígua de cor similar à cor amostrada no ponto.
 * Usa Int32Array como fila circular para evitar estouro de pilha.
 * Limite de segurança: 2 M pixels.
 * Opera numa bbox mínima — só faz putImageData na região modificada.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} tolerance  0–255
 */
function dMagicEraseAt(ctx, x, y, tolerance) {
  if (!ctx) return;
  var cv  = ctx.canvas;
  var W   = cv.width;
  var H   = cv.height;
  var tol = Math.max(0, tolerance !== undefined ? tolerance : 30);
  var MAX_PIXELS = 2000000;

  if(window.dMagicEraseRunning) return;
  var ix = Math.round(x);
  var iy = Math.round(y);
  if (ix < 0 || ix >= W || iy < 0 || iy >= H) return;

  // Lê o canvas inteiro (BFS precisa verificar vizinhos arbitrários)
  var full = ctx.getImageData(0, 0, W, H);
  var d    = full.data;

  var si   = (iy * W + ix) * 4;
  var seed = [d[si], d[si + 1], d[si + 2], d[si + 3]];
  if (seed[3] === 0) return; // pixel semente já transparente

  var visited = new Uint8Array(W * H);

  // Fila circular com Int32Array — sem realocação, sem .shift() O(n)
  var qCap  = Math.min(MAX_PIXELS + 4, W * H + 4);
  var queue = new Int32Array(qCap);
  var head  = 0;
  var tail  = 0;

  // bbox dos pixels modificados (para putImageData mínimo)
  var minX = ix, maxX = ix, minY = iy, maxY = iy;

  var startLi = iy * W + ix;
  visited[startLi] = 1;
  queue[tail] = startLi;
  tail = (tail + 1) % qCap;

  window.dMagicEraseRunning = true;
  var bMinX = ix, bMaxX = ix, bMinY = iy, bMaxY = iy;

  function doChunk() {
    var chunkLimit = count + 25000;
    while (head !== tail && count < Math.min(MAX_PIXELS, chunkLimit)) {
      var li = queue[head]; head = (head + 1) % qCap; count++;
      var py = (li / W) | 0; var px = li % W; var idx = li * 4;
      d[idx + 3] = 0; // apaga
      if (px < bMinX) bMinX = px; if (px > bMaxX) bMaxX = px;
      if (py < bMinY) bMinY = py; if (py > bMaxY) bMaxY = py;

      var nx, ny, nli, nidx;
      if (px > 0) { nx = px - 1; ny = py; nli = ny * W + nx; if (!visited[nli]) { visited[nli] = 1; nidx = nli * 4; if (d[nidx + 3] > 0 && _dColorWithinTol([d[nidx], d[nidx+1], d[nidx+2], d[nidx+3]], seed, tol)) { queue[tail] = nli; tail = (tail + 1) % qCap; } } }
      if (px < W - 1) { nx = px + 1; ny = py; nli = ny * W + nx; if (!visited[nli]) { visited[nli] = 1; nidx = nli * 4; if (d[nidx + 3] > 0 && _dColorWithinTol([d[nidx], d[nidx+1], d[nidx+2], d[nidx+3]], seed, tol)) { queue[tail] = nli; tail = (tail + 1) % qCap; } } }
      if (py > 0) { nx = px; ny = py - 1; nli = ny * W + nx; if (!visited[nli]) { visited[nli] = 1; nidx = nli * 4; if (d[nidx + 3] > 0 && _dColorWithinTol([d[nidx], d[nidx+1], d[nidx+2], d[nidx+3]], seed, tol)) { queue[tail] = nli; tail = (tail + 1) % qCap; } } }
      if (py < H - 1) { nx = px; ny = py + 1; nli = ny * W + nx; if (!visited[nli]) { visited[nli] = 1; nidx = nli * 4; if (d[nidx + 3] > 0 && _dColorWithinTol([d[nidx], d[nidx+1], d[nidx+2], d[nidx+3]], seed, tol)) { queue[tail] = nli; tail = (tail + 1) % qCap; } } }
    }
    
    if (head !== tail && count < MAX_PIXELS) {
      setTimeout(doChunk, 0);
    } else {
      window.dMagicEraseRunning = false;
      if (count >= MAX_PIXELS) { if (typeof gToast === 'function') gToast('Área grande demais para apagar — reduza a seleção'); }
      var bx = Math.max(0, bMinX), by = Math.max(0, bMinY);
      var bw = Math.min(W, bMaxX + 1) - bx, bh = Math.min(H, bMaxY + 1) - by;
      if (bw > 0 && bh > 0) {
        var patch = ctx.createImageData(bw, bh);
        for (var row = 0; row < bh; row++) {
          var srcOff = ((by + row) * W + bx) * 4; var dstOff = row * bw * 4;
          patch.data.set(d.subarray(srcOff, srcOff + bw * 4), dstOff);
        }
        ctx.putImageData(patch, bx, by);
        if(typeof dMarkUnsaved==='function') dMarkUnsaved();
      }
    }
  }
  doChunk();
}
