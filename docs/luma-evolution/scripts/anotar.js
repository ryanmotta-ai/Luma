// docs/luma-evolution/scripts/anotar.js — versões anotadas das capturas.
//
//   node docs/luma-evolution/scripts/anotar.js
//
// Gera, a partir de commit-map/atlas.json, um PNG por funcionalidade: a captura da tela
// com o contorno em cima do elemento e uma legenda curta. Serve pra usar fora dos slides
// (num guia, num chamado, numa mensagem) sem ter que recortar slide.
//
// As imagens originais NUNCA são sobrescritas: a anotada sai em screenshots/annotated/.
// As posições vêm da medição feita no DOM, não do olho.

const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const BASE = path.resolve(__dirname, '..');
const DEST = path.join(BASE, 'screenshots', 'annotated');
const atlasPath = path.join(BASE, 'commit-map', 'atlas.json');

if (!fs.existsSync(atlasPath)) {
  console.log('sem atlas.json — rode antes: node docs/luma-evolution/scripts/atlas.js');
  process.exit(0);
}
const ATLAS = JSON.parse(fs.readFileSync(atlasPath, 'utf8'));
fs.mkdirSync(DEST, { recursive: true });

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const pagina = (imgAbs, f, n) => `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1440px;height:1120px;font-family:'Roboto',-apple-system,sans-serif;background:#fff}
  .fig{position:relative;width:1440px;height:1000px;overflow:hidden}
  .fig img{width:1440px;height:1000px;display:block}
  /* o resto da tela escurece pra o alvo saltar sem precisar de seta atravessando o print */
  .veu{position:absolute;inset:0;background:rgba(10,10,10,.42)}
  .alvo{position:absolute;border:4px solid #FF9000;border-radius:9px;box-shadow:0 0 0 4px rgba(255,144,0,.28),0 0 0 9999px rgba(10,10,10,.42)}
  .n{position:absolute;width:44px;height:44px;border-radius:50%;background:#FF9000;color:#fff;
     font-size:24px;font-weight:900;display:flex;align-items:center;justify-content:center;
     box-shadow:0 5px 16px rgba(10,10,10,.35)}
  .leg{height:120px;padding:22px 34px;border-top:4px solid #FF9000;display:flex;align-items:center;gap:22px}
  .leg .b{width:44px;height:44px;border-radius:50%;background:#FF9000;color:#fff;font-size:24px;font-weight:900;
     display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .leg h4{font-size:27px;font-weight:900;letter-spacing:-.02em}
  .leg p{margin-top:5px;font-size:19px;color:#4A4A4A}
  .leg .cam{margin-left:auto;text-align:right;font-family:ui-monospace,Menlo,monospace;font-size:15px;color:#8A8A8A;line-height:1.5}
</style>
<div class="fig"><img src="file://${imgAbs}">
  <div class="alvo" style="left:${f.caixa.x.toFixed(2)}%;top:${f.caixa.y.toFixed(2)}%;width:${f.caixa.w.toFixed(2)}%;height:${f.caixa.h.toFixed(2)}%"></div>
  <div class="n" style="left:calc(${f.caixa.x.toFixed(2)}% - 22px);top:calc(${f.caixa.y.toFixed(2)}% - 22px)">${n}</div>
</div>
<div class="leg"><div class="b">${n}</div>
  <div><h4>${esc(f.nome)}</h4><p>${esc(f.oQueFaz)}</p></div>
  <div class="cam">${esc(f.caminho)}<br>${esc(f.perfil)} · ${esc(f.estado)}</div>
</div>`;

(async () => {
  const nav = await chromium.launch();
  const p = await nav.newPage({ viewport: { width: 1440, height: 1120 }, deviceScaleFactor: 2 });
  let n = 0;
  for (const q of ATLAS) {
    const imgAbs = path.resolve(BASE, 'screenshots', 'feature-atlas', path.basename(q.imagem));
    if (!fs.existsSync(imgAbs)) { console.log(`   · ${q.quadro}: captura ausente`); continue; }
    for (let i = 0; i < q.feats.length; i++) {
      const f = q.feats[i];
      await p.setContent(pagina(imgAbs, f, i + 1), { waitUntil: 'load' });
      await p.waitForTimeout(400);
      const arq = `anotada_${q.quadro}_${f.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`;
      await p.screenshot({ path: path.join(DEST, arq) });
      console.log(`   ✓ ${arq}`);
      n++;
    }
  }
  await nav.close();
  console.log(`\n${n} capturas anotadas em screenshots/annotated/\n`);
})();
