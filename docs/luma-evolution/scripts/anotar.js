// docs/luma-evolution/scripts/anotar.js — versões anotadas das capturas do atlas.
//
//   node docs/luma-evolution/scripts/anotar.js
//
// Gera, a partir de commit-map/atlas.json, um PNG por tela com os contornos numerados e a
// legenda embaixo. Serve pra usar FORA dos slides — num guia, num chamado, numa mensagem
// — sem ter que recortar slide.
//
// ⛔ As imagens originais nunca são sobrescritas: a anotada sai em screenshots/annotated/.
// As posições vêm da medição no DOM, não do olho.

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

// Uma linguagem de anotação só: número em bolinha + contorno laranja. Sem setas, sem
// círculos soltos, no máximo 4 destaques por imagem (o resto vira ruído).
const pagina = (imgAbs, q) => {
  // A imagem vai embutida em base64: com setContent o documento é about:blank, e daí um
  // src="file://…" é bloqueado — a página renderiza com o quadro vazio e a moldura certa,
  // que é pior que falhar, porque parece ter dado certo.
  const dataUri = 'data:image/png;base64,' + fs.readFileSync(imgAbs).toString('base64');
  const fs4 = q.feats.slice(0, 4);
  const alturaLegenda = 60 + fs4.length * 46;
  return `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1440px;font-family:'Roboto',-apple-system,sans-serif;background:#fff}
  .fig{position:relative;width:1440px;height:1000px;overflow:hidden;background:#F7F7F5}
  .fig img{width:1440px;height:1000px;display:block}
  .alvo{position:absolute;border:3px solid #FF9000;border-radius:8px;
    box-shadow:0 0 0 3px rgba(255,144,0,.26)}
  .n{position:absolute;width:38px;height:38px;border-radius:50%;background:#FF9000;color:#fff;
     font-size:21px;font-weight:900;display:flex;align-items:center;justify-content:center;
     box-shadow:0 4px 14px rgba(10,10,10,.32)}
  .leg{padding:24px 34px 28px;border-top:4px solid #FF9000}
  .leg h3{font-size:25px;font-weight:900;letter-spacing:-.02em;margin-bottom:4px}
  .leg .fluxo{font-size:14px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#F85400;margin-bottom:16px}
  .item{display:flex;gap:14px;align-items:baseline;margin-top:12px}
  .item .b{width:26px;height:26px;border-radius:50%;background:#FF9000;color:#fff;font-size:15px;font-weight:900;
     display:flex;align-items:center;justify-content:center;flex-shrink:0;transform:translateY(3px)}
  .item .nome{font-size:19px;font-weight:800;white-space:nowrap}
  .item .txt{font-size:17px;color:#4A4A4A}
  .item .onde{margin-left:auto;font-family:ui-monospace,Menlo,monospace;font-size:14px;color:#8A8A8A;white-space:nowrap}
</style>
<div class="fig"><img src="${dataUri}">
  ${fs4.map((f, i) => `<div class="alvo" style="left:${f.caixa.x.toFixed(2)}%;top:${f.caixa.y.toFixed(2)}%;width:${f.caixa.w.toFixed(2)}%;height:${f.caixa.h.toFixed(2)}%"></div>
  <div class="n" style="left:calc(${f.caixa.x.toFixed(2)}% - 19px);top:calc(${f.caixa.y.toFixed(2)}% - 19px)">${i + 1}</div>`).join('')}
</div>
<div class="leg" style="min-height:${alturaLegenda}px">
  <div class="fluxo">${esc(q.fluxo)}</div>
  <h3>${esc(q.tela)}</h3>
  ${fs4.map((f, i) => `<div class="item"><div class="b">${i + 1}</div>
    <div class="nome">${esc(f.nome)}</div>
    <div class="txt">${esc(f.oQueFaz)}</div>
    <div class="onde">${esc(f.onde)}</div></div>`).join('')}
</div>`;
};

(async () => {
  const nav = await chromium.launch();
  const p = await nav.newPage({ viewport: { width: 1440, height: 1400 }, deviceScaleFactor: 2 });
  let n = 0;
  const total = ATLAS.filter(q => q.feats.length).length;
  for (const q of ATLAS) {
    if (!q.feats.length) { console.log(`   · ${q.quadro}: sem funcionalidade localizada, pulado`); continue; }
    const imgAbs = path.resolve(BASE, 'screenshots', 'feature-atlas', path.basename(q.imagem));
    if (!fs.existsSync(imgAbs)) { console.log(`   · ${q.quadro}: captura ausente, pulado`); continue; }
    await p.setContent(pagina(imgAbs, q), { waitUntil: 'load' });
    await p.waitForTimeout(500);
    const arq = `anotada_${q.quadro}.png`;
    await p.locator('body').screenshot({ path: path.join(DEST, arq) });
    n++;
    console.log(`[${n}/${total}] ${arq} — ${Math.min(q.feats.length, 4)} destaques`);
  }
  await nav.close();
  console.log(`\n${n} capturas anotadas em screenshots/annotated/\n`);
})();
