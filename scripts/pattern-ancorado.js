#!/usr/bin/env node
/**
 * scripts/pattern-ancorado.js
 *
 * Posiciona o pattern oficial da DM (assets/grafismos/pattern-dm-oficial.svg) numa arte da skill luma-creative.
 * Escolhe SÓ sorrisos INTEIROS (sem desfoque, sem máscara, sem recorte de forma) que ficam dentro da zona
 * do bloco-âncora e FORA das caixas de texto, e procura o deslocamento que mostra mais sorrisos.
 * Zero dependências (Node puro).
 *
 * Uso (CLI) — imprime o <g> pronto para colar no SVG, entre o fundo liso e o conteúdo:
 *   node scripts/pattern-ancorado.js --canvas 1080x1350 --zone ellipse:540,365,430,290 \
 *        --text 100,742,880,330 --text 410,1112,260,77 --scale 1.4 --color "#FF9000" --opacity 0.45
 *
 *   --zone  ellipse:cx,cy,rx,ry   ou   rect:x,y,w,h      (onde os CENTROS dos sorrisos podem ficar; pode passar da borda)
 *   --text  x,y,w,h               (repetível: cada caixa de texto/preço/CTA/logo; a ferramenta afasta o pattern 30px)
 *   --anchor x,y,w,h              (caixa do bloco-âncora: sorrisos totalmente escondidos atrás dele não contam)
 *   --scale feed ~1.4 | story ~1.8   --color "#FF9000"|"#F85400"|"#FFFFFF"   --opacity 0.30..0.50
 *   --min   mínimo de sorrisos desejado (padrão 3; se não houver, imprime aviso e NADA => faça arte clean)
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '.agents', 'skills', 'luma-creative', 'assets', 'grafismos', 'pattern-dm-oficial.svg');

function lerSorrisos() {
  const svg = fs.readFileSync(SRC, 'utf8');
  const out = [];
  const re = /<g transform="matrix\(([^)]*)\)">\s*<path d="([^"]*)"[^>]*\/>\s*<\/g>/g;
  let m;
  while ((m = re.exec(svg))) {
    const [a, b, c, d, e, f] = m[1].trim().split(/\s+/).map(Number);
    const nums = (m[2].match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const px = a * nums[i] + c * nums[i + 1] + e;
      const py = 1080 - (b * nums[i] + d * nums[i + 1] + f); // matriz externa: flip vertical
      if (px < x0) x0 = px; if (px > x1) x1 = px;
      if (py < y0) y0 = py; if (py > y1) y1 = py;
    }
    out.push({ transform: `matrix(${a} ${b} ${c} ${d} ${e} ${f})`, d: m[2], x0, y0, x1, y1 });
  }
  return out;
}

const inter = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

function dentroDaZona(z, cx, cy) {
  if (z.type === 'ellipse') return ((cx - z.cx) / z.rx) ** 2 + ((cy - z.cy) / z.ry) ** 2 <= 1;
  return cx >= z.x && cx <= z.x + z.w && cy >= z.y && cy <= z.y + z.h;
}

function posicionar({ w, h, zone, texts = [], anchor = null, scale = 1.4, color = '#FF9000', opacity = 0.45, min = 3, pad = 30 }) {
  const sorrisos = lerSorrisos();
  const caixas = texts.map(t => ({ x0: t.x - pad, y0: t.y - pad, x1: t.x + t.w + pad, y1: t.y + t.h + pad }));
  const minTx = Math.min(0, w - 1920 * scale), minTy = Math.min(0, h - 1080 * scale);
  let melhor = null;
  for (let tx = minTx; tx <= 0; tx += 20) {
    for (let ty = minTy; ty <= 0; ty += 20) {
      const keep = [];
      for (const s of sorrisos) {
        const b = { x0: tx + s.x0 * scale, y0: ty + s.y0 * scale, x1: tx + s.x1 * scale, y1: ty + s.y1 * scale };
        if (!inter(b, { x0: 0, y0: 0, x1: w, y1: h })) continue;
        if (!dentroDaZona(zone, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2)) continue;
        if (caixas.some(c => inter(b, c))) continue;
        if (anchor && b.x0 >= anchor.x && b.x1 <= anchor.x + anchor.w && b.y0 >= anchor.y && b.y1 <= anchor.y + anchor.h) continue; // escondido atrás do âncora
        keep.push(s);
      }
      if (!melhor || keep.length > melhor.keep.length) melhor = { tx, ty, keep };
    }
  }
  if (!melhor || melhor.keep.length < min) {
    return { ok: false, n: melhor ? melhor.keep.length : 0, svg: '' };
  }
  const { tx, ty, keep } = melhor;
  const g = keep.map(s => `<g transform="${s.transform}"><path d="${s.d}" fill-rule="evenodd"/></g>`).join('');
  const svg = `<g id="pattern-ancorado" color="${color}" fill="currentColor" opacity="${opacity}" transform="translate(${tx},${ty}) scale(${scale}) matrix(1 0 0 -1 0 1080)">${g}</g>`;
  return { ok: true, n: keep.length, tx, ty, svg };
}

module.exports = { posicionar };

if (require.main === module) {
  const arg = (k, multi) => {
    const v = [];
    process.argv.forEach((a, i) => { if (a === '--' + k) v.push(process.argv[i + 1]); });
    return multi ? v : v[0];
  };
  const [w, h] = (arg('canvas') || '1080x1350').split('x').map(Number);
  const zs = arg('zone') || '';
  const [zt, zv] = zs.split(':');
  const n = (zv || '').split(',').map(Number);
  const zone = zt === 'ellipse' ? { type: 'ellipse', cx: n[0], cy: n[1], rx: n[2], ry: n[3] } : { type: 'rect', x: n[0], y: n[1], w: n[2], h: n[3] };
  const texts = arg('text', true).map(t => { const [x, y, ww, hh] = t.split(',').map(Number); return { x, y, w: ww, h: hh }; });
  const an = arg('anchor'); const anchor = an ? (([x, y, ww, hh]) => ({ x, y, w: ww, h: hh }))(an.split(',').map(Number)) : null;
  const r = posicionar({ w, h, zone, texts, anchor, scale: Number(arg('scale') || 1.4), color: arg('color') || '#FF9000', opacity: Number(arg('opacity') || 0.45), min: Number(arg('min') || 3) });
  if (!r.ok) { console.error(`SEM PATTERN: só ${r.n} sorriso(s) inteiros cabem na zona fora do texto. Faça arte clean (§3.1).`); process.exit(2); }
  console.error(`${r.n} sorrisos | translate(${r.tx},${r.ty})`);
  console.log(r.svg);
}
