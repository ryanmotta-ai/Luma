#!/usr/bin/env node
/**
 * scripts/lint-art.js
 *
 * Linter das artes da skill luma-creative (Fase 5). Mede o SVG de verdade no navegador headless
 * (caixas reais dos textos e blocos) e confere as regras do SKILL.md: paleta, fontes, tamanhos,
 * margens, colisões, vãos, contraste por fundo, botões/tags, selos, foto, pattern nítido, raios e alinhamento.
 * Zero dependências (reusa o Edge/Chromium de scripts/capture-art.js).
 *
 * Uso:   node scripts/lint-art.js <arte.svg> [--story|--feed]
 * Saída: lista de ERROS (bloqueiam) e AVISOS. Código de saída 1 se houver erro.
 */
const fs = require('fs');
const path = require('path');
const { avaliarNaPagina } = require('./capture-art.js');

const PALETA = ['434343', 'F62900', 'FFB900', 'F85400', 'FF9000', 'FFFFFF', 'D9D9D9'];
const hex = rgb => {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb || '');
  return m ? [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase() : null;
};

// Expressão executada dentro da página: devolve as caixas reais (coordenadas do canvas).
const COLETA = `(async () => {
  await document.fonts.ready;
  const svg = document.querySelector('svg');
  const r0 = svg.getBoundingClientRect();
  const rel = el => { const r = el.getBoundingClientRect(); return { x: r.x - r0.x, y: r.y - r0.y, w: r.width, h: r.height }; };
  const ctx = document.createElement('canvas').getContext('2d');
  const noDefs = el => !el.closest('defs,clipPath,mask,filter,symbol');
  const texts = [...svg.querySelectorAll('text')].filter(noDefs).map(t => {
    const cs = getComputedStyle(t);
    const box = rel(t);
    const fs = parseFloat(cs.fontSize);
    ctx.font = cs.fontWeight + ' ' + fs + 'px ' + cs.fontFamily;
    const m = ctx.measureText(t.textContent.trim());
    const asc = m.fontBoundingBoxAscent || fs * 0.9;
    const base = box.y + asc;
    const girado = /rotate|matrix\\(0/.test((t.getAttribute('transform') || '') + (t.parentElement.getAttribute('transform') || ''));
    const ink = girado ? box : { x: box.x, y: base - m.actualBoundingBoxAscent, w: box.w, h: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent };
    return { txt: t.textContent.trim(), fs, weight: cs.fontWeight, family: cs.fontFamily, fill: cs.fill, op: parseFloat(cs.opacity) * parseFloat(cs.fillOpacity || 1), anchor: t.getAttribute('text-anchor') || 'start', ink, box, girado, grupo: (t.closest('[id]') || {}).id || '' };
  });
  const shapes = [...svg.querySelectorAll('rect,circle,ellipse,path')].filter(s => noDefs(s) && !s.closest('#pattern-ancorado') && !s.closest('[mask]')).map(s => {
    const cs = getComputedStyle(s);
    return { tag: s.tagName.toLowerCase(), fill: cs.fill, fillOp: parseFloat(cs.fillOpacity), op: parseFloat(cs.opacity), box: rel(s), rx: parseFloat(s.getAttribute('rx') || 0), grupo: (s.closest('[id]') || {}).id || '' };
  });
  return JSON.stringify({ w: r0.width, h: r0.height, texts, shapes, imgs: [...svg.querySelectorAll('image')].map(rel) });
})()`;

const inside = (a, b, pad = 0) => a.x >= b.x - pad && a.y >= b.y - pad && a.x + a.w <= b.x + b.w + pad && a.y + a.h <= b.y + b.h + pad;
const contem = (c, a) => { const cx = a.x + a.w / 2, cy = a.y + a.h / 2; return cx >= c.x && cx <= c.x + c.w && cy >= c.y && cy <= c.y + c.h; };
const gapCirculo = (c, r) => {
  const cx = c.x + c.w / 2, cy = c.y + c.h / 2, rad = c.w / 2;
  const nx = Math.max(r.x, Math.min(cx, r.x + r.w)), ny = Math.max(r.y, Math.min(cy, r.y + r.h));
  const d = Math.hypot(cx - nx, cy - ny) - rad;
  return { dist: Math.max(0, d), overlap: d <= 0 };
};
const gap = (a, b) => {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));
  return { dx, dy, overlap: dx === 0 && dy === 0, dist: Math.hypot(dx, dy) };
};

async function lint(svgPath, formato) {
  const raw = fs.readFileSync(svgPath, 'utf8');
  const vb = /viewBox=["']\s*0\s+0\s+(\d+)\s+(\d+)/.exec(raw);
  const W = vb ? +vb[1] : 1080, H = vb ? +vb[2] : 1350;
  const story = formato ? formato === 'story' : H >= 1800;
  const erros = [], avisos = [];
  const E = m => erros.push(m), A = m => avisos.push(m);

  // ── estático ──
  const hexes = [...new Set((raw.match(/#[0-9a-fA-F]{6}\b/g) || []).map(h => h.slice(1).toUpperCase()))];
  const fora = hexes.filter(h => !PALETA.includes(h));
  if (fora.length) E(`Hex fora da paleta: ${fora.map(h => '#' + h).join(', ')}`);
  if (/#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])/.test(raw.replace(/data:[^"')]*/g, ''))) A('Hex curto (#fff/#000) no SVG: use o hex de 6 dígitos da paleta.');
  if (/@import/.test(raw)) E('@import externo (embutir @font-face em base64).');
  if (/font-weight[:="' ]+700/.test(raw)) E('Bold 700 proibido.');
  if (/<rect[^>]*width="(1080)"[^>]*height="(1350|1920)"[^>]*rx=/.test(raw) || /<clipPath[^>]*><rect[^>]*width="1080"[^>]*rx=/.test(raw)) E('Canvas com cantos arredondados (rx).');
  if (/feGaussianBlur/.test(raw.replace(/<filter id="sh"[\s\S]*?<\/filter>/, '')) || /pattern-ancorado[^>]*(mask|filter)=/.test(raw)) E('Pattern desfocado/mascarado: o pattern é sempre nítido (§3.1).');
  if (/<mask|<linearGradient/.test(raw)) A('mask/linearGradient no SVG: confira que não é degradê sobre o pattern (§3.1) e que não usa cor fora da paleta.');
  if (!/Realce/.test(raw) || !/@font-face/.test(raw)) A('Fonte Realce/Roboto não embutida via @font-face.');

  // ── medições no navegador ──
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0}body{background:#fff}svg{display:block}</style></head><body>${raw}</body></html>`;
  const d = JSON.parse(await avaliarNaPagina(html, W, H, COLETA));
  const bgShape = d.shapes.find(s => s.box.w >= W - 2 && s.box.h >= H - 2);
  const bg = bgShape ? hex(bgShape.fill) : 'FFFFFF';
  const blocos = d.shapes.filter(s => !(s.box.w >= W - 2 && s.box.h >= H - 2) && hex(s.fill) && s.fill !== 'none' && s.box.w > 30 && s.box.h > 30);

  // contêiner de cada texto: menor bloco preenchido que contém o centro
  d.texts.forEach(t => {
    const cand = blocos.filter(b => contem(b.box, t.ink));
    t.cont = cand.sort((a, b) => a.box.w * a.box.h - b.box.w * b.box.h)[0] || null;
    t.fundo = t.cont ? hex(t.cont.fill) : bg;
    t.cor = hex(t.fill);
  });

  d.texts.filter(t => t.txt).forEach(t => { if (t.fs < 22) E(`"${t.txt}": font-size ${t.fs}px < 22px.`); });
  const textos = d.texts.filter(t => t.txt && !['foto_produto', 'logo_loja'].includes(t.grupo)); // legenda do slot não conta nas demais regras
  const heroes = textos.filter(t => t.family.includes('Realce') && t.fs >= 80);
  const grupoProd = textos.filter(t => t.grupo === 'produto');
  if (grupoProd.length && Math.max(...grupoProd.map(t => t.fs)) < 80) E('Hero ({{produto}}) abaixo de 80px.');
  const preco = textos.filter(t => t.grupo === 'preco');
  if (preco.length && Math.max(...preco.map(t => t.fs)) < 96) E('Preço abaixo de 96px.');
  const maior = Math.max(...textos.map(t => t.fs), 0);
  const apoio = textos.filter(t => t.fs >= 28 && t.fs <= 60 && t.cont === null).map(t => t.fs).sort((a, b) => a - b);
  if (apoio.length && maior / apoio[Math.floor(apoio.length / 2)] < 2.5) A(`Hierarquia fraca: maior texto ${maior}px vs apoio ~${apoio[Math.floor(apoio.length / 2)]}px (< 2,5×).`);
  const tamanhosVisiveis = [...new Set(textos.filter(t => t.fs >= 22).map(t => Math.round(t.fs / 4) * 4))];
  if (tamanhosVisiveis.length > 7) A(`Muitos tamanhos de texto (${tamanhosVisiveis.length}). Reduza para hero/apoio/corpo/legal.`);

  // margens
  textos.forEach(t => {
    const { x, y, w, h } = t.ink;
    const esq = x, dir = W - (x + w);
    if (esq < 80 || dir < 80) E(`"${t.txt}": margem lateral ${Math.round(Math.min(esq, dir))}px (< 80).`);
    else if ((esq < 100 || dir < 100) && !t.cont) A(`"${t.txt}": margem lateral ${Math.round(Math.min(esq, dir))}px (< 100).`);
    if (story) { if (y < 255 || y + h > 1665) E(`"${t.txt}": fora da zona útil do story (y ${Math.round(y)}–${Math.round(y + h)}; use 260–1660).`); }
    else if (y < 65 || y + h > H - 65) A(`"${t.txt}": margem vertical ${Math.round(Math.min(y, H - y - h))}px (< 70).`);
  });

  // colisões e vãos entre textos soltos (fora de card) e entre contêineres
  for (let i = 0; i < textos.length; i++) for (let j = i + 1; j < textos.length; j++) {
    const a = textos[i], b = textos[j];
    if (a.cont && a.cont === b.cont) continue;
    const g = gap(a.ink, b.ink);
    if (g.overlap) { E(`Colisão: "${a.txt}" × "${b.txt}".`); continue; }
    const hero = a.fs >= 80 || b.fs >= 80;
    if (a.cont || b.cont) continue;
    if (a.fs >= 80 && b.fs >= 80) continue;
    if (a.fs === b.fs && Math.abs(a.ink.x - b.ink.x) < 6) continue; // mesmo parágrafo
    const vertical = g.dx === 0;
    if (vertical && g.dy < (hero ? 36 : 28)) A(`Vão curto (${Math.round(g.dy)}px): "${a.txt}" ↔ "${b.txt}" (mín. ${hero ? 40 : 30}).`);
  }

  // texto vs contêiner (estouro)
  textos.forEach(t => {
    if (!t.cont || t.girado) return;
    const b = t.cont.box;
    if (!inside(t.ink, b, 0)) E(`"${t.txt}" estoura o bloco que o contém.`);
    else if (t.ink.w > 0 && (t.ink.x - b.x < 24 || b.x + b.w - (t.ink.x + t.ink.w) < 24) && b.w > 160) A(`"${t.txt}" a menos de 24px da borda lateral do bloco.`);
  });

  // selos: círculos amarelos
  const selos = blocos.filter(b => b.tag === 'circle' && hex(b.fill) === 'FFB900');
  const slots = blocos.filter(b => b.grupo === 'foto_produto' || b.grupo === 'logo_loja');
  textos.forEach(t => {
    selos.forEach(s => {
      if (t.cont === s) return;
      if (['foto_produto', 'logo_loja'].includes(t.grupo)) return; // legenda do slot
      const g = gapCirculo(s.box, t.ink);
      if (g.overlap) E(`Selo cobre texto "${t.txt}".`);
      else if (g.dist < 40) A(`Selo a ${Math.round(g.dist)}px do texto "${t.txt}" (mín. 40).`);
    });
  });
  const foto = slots.filter(s => s.grupo === 'foto_produto').sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h)[0];
  if (foto) {
    const util = story ? 1400 : H - 200;
    const lim = story ? 0.5 : 0.55;
    if (foto.box.w > W * 0.6) { if (foto.box.h / util > lim + 0.12) A(`Foto ocupa ${Math.round(foto.box.h / util * 100)}% da altura útil (máx. ~${lim * 100}%).`); }
    else if (foto.box.w * foto.box.h > W * H * 0.5) A(`Foto lateral ocupa ${Math.round(foto.box.w * foto.box.h / (W * H) * 100)}% da área (máx. 50%).`);
    selos.forEach(s => { if (s.box.w > foto.box.w * 0.35) A('Selo maior que 35% da largura da foto.'); });
    if (foto.box.w < W * 0.35) A('Foto menor que 35% da largura do canvas (legenda ilegível).');
    if (hex(foto.fill) !== 'D9D9D9') E('Slot de foto não está em #D9D9D9 (use assets/placeholders/).');
  }
  slots.forEach(s => { if (hex(s.fill) !== 'D9D9D9') E(`Slot "${s.grupo}" fora do padrão #D9D9D9.`); });

  // contraste por fundo
  textos.forEach(t => {
    const f = t.fundo, c = t.cor;
    if (!f || !c) return;
    const ok = {
      F85400: ['FFFFFF'], FF9000: ['FFFFFF'], FFFFFF: ['F85400', '434343', 'F62900'], FFB900: ['434343', 'F85400'], D9D9D9: ['434343'], '434343': ['FFFFFF', 'FFB900'], F62900: ['FFFFFF'],
    }[f];
    if (ok && !ok.includes(c)) {
      const grave = (f === 'FFFFFF' && c === 'FF9000') || (f === 'FFB900' && c === 'FFFFFF') || (f === 'F85400' && c === '434343');
      (grave ? E : A)(`Contraste: "${t.txt}" em #${c} sobre #${f}.`);
    }
  });

  // botões/tags amarelos (pílula/retângulo curto); selo é círculo
  blocos.filter(b => b.tag === 'rect' && hex(b.fill) === 'FFB900' && b.box.h <= 110).forEach(b => {
    if (textos.some(t => t.cont === b)) E('Botão/tag amarelo: use #F85400 + branco sobre #FF9000, branco + #F85400 sobre #F85400 (amarelo só em selo/voucher).');
  });

  // raios: foto 56 | card 36 | botão = pílula
  d.shapes.filter(s => s.tag === 'rect' && s.rx > 0 && !(s.box.w >= W - 2) && !['foto_produto', 'logo_loja'].includes(s.grupo) || (s.tag === 'rect' && ['foto_produto'].includes(s.grupo) && s.box.w > 300)).forEach(s => {
    const pilula = Math.abs(s.rx - s.box.h / 2) < 1.5;
    if (![56, 36].includes(Math.round(s.rx)) && !pilula) A(`Raio ${s.rx} fora dos tokens (56 foto, 36 card, pílula = h/2): bloco ${Math.round(s.box.w)}×${Math.round(s.box.h)}.`);
  });

  // alinhamento: um eixo só entre os textos soltos
  const soltos = textos.filter(t => !t.cont && t.fs >= 28 && !t.girado);
  const centrados = soltos.filter(t => Math.abs(t.ink.x + t.ink.w / 2 - W / 2) < 14).length;
  const esquerda = soltos.filter(t => Math.abs(t.ink.x - 100) < 14).length;
  if (centrados >= 2 && esquerda >= 2) A('Dois eixos de alinhamento (centro e esquerda). Use um só.');

  return { erros, avisos, info: { W, H, textos: textos.length, bg, selos: selos.length } };
}

if (require.main === module) {
  const arg = process.argv[2];
  if (!arg) { console.log('Uso: node scripts/lint-art.js <arte.svg> [--story|--feed]'); process.exit(1); }
  const fmt = process.argv.includes('--story') ? 'story' : process.argv.includes('--feed') ? 'feed' : null;
  lint(path.resolve(arg), fmt).then(r => {
    console.log(`${path.basename(arg)}  [${r.info.W}×${r.info.H}, fundo #${r.info.bg}, ${r.info.textos} textos]`);
    r.erros.forEach(m => console.log('  ✖ ERRO  ' + m));
    r.avisos.forEach(m => console.log('  ⚠ aviso ' + m));
    if (!r.erros.length && !r.avisos.length) console.log('  ✔ sem problemas');
    process.exit(r.erros.length ? 1 : 0);
  }).catch(e => { console.error('Erro no lint:', e.message); process.exit(2); });
}

module.exports = { lint };
