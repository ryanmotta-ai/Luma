// docs/luma-evolution/scripts/publicar.js — escreve a apresentação e seus derivados.
//
//   node docs/luma-evolution/scripts/publicar.js
//
// Gera, nesta ordem: o HTML (fonte de verdade do visual), um PNG por slide, o PDF, as
// notas do apresentador e o índice de evidências. O PPTX sai dos PNGs, em montar-pptx.py
// — assim o PowerPoint mostra exatamente o que foi validado no HTML, sem uma segunda
// implementação do layout pra divergir.

const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const M = require('./narrativa-b.js');
const BASE = path.resolve(__dirname, '..');
const OUT = path.join(BASE, 'presentation');
const PNGS = path.join(OUT, 'slides-png');
fs.mkdirSync(PNGS, { recursive: true });

const css = fs.readFileSync(path.join(__dirname, 'estilo.css'), 'utf8');

// Números que só se sabem depois de tudo montado — preenchidos aqui, nunca chutados.
function contar() {
  const dirs = fs.existsSync(path.join(BASE, 'screenshots', 'original')) ? fs.readdirSync(path.join(BASE, 'screenshots', 'original')) : [];
  let shots = 0;
  for (const d of dirs) {
    const p = path.join(BASE, 'screenshots', 'original', d);
    if (fs.statSync(p).isDirectory()) shots += fs.readdirSync(p).filter(f => f.endsWith('.png')).length;
  }
  const atlasP = path.join(BASE, 'commit-map', 'atlas.json');
  const atlas = fs.existsSync(atlasP) ? JSON.parse(fs.readFileSync(atlasP, 'utf8')) : [];
  const feats = atlas.reduce((n, q) => n + q.feats.length, 0);
  const capturados = dirs.filter(d => {
    const p = path.join(BASE, 'screenshots', 'original', d);
    return fs.statSync(p).isDirectory() && fs.readdirSync(p).some(f => f.endsWith('.png'));
  }).length;
  return { shots, feats, capturados, atlasTelas: atlas.length };
}

(async () => {
  const n = contar();
  const nSlides = M.slides.length;
  // Numeração pela POSIÇÃO REAL do slide, feita slide a slide. Um replace global sobre o
  // HTML já unido contaria só os slides QUE TÊM rodapé — capa e divisores não têm — e o
  // número saía menor que a posição de fato (o slide 23 aparecia como "19").
  const html = M.slides.map((sl, k) => sl
    .replace('<span class="s-num"></span>', `<span class="s-num">${String(k + 1).padStart(2, '0')} / ${nSlides}</span>`)
    .replace('<div class="num-v" id="n-shots">—</div>', `<div class="num-v">${n.shots}</div>`)
    .replace('<div class="num-v" id="n-feats">—</div>', `<div class="num-v">${n.feats}</div>`)
    .replace('<div class="num-v" id="n-marcos">9</div>', `<div class="num-v">${n.capturados}</div>`)
  ).join('\n');

  const doc = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Luma — de piloto a produto</title>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;700;900&display=swap" rel="stylesheet">
<style>${css}
@page{size:1920px 1080px;margin:0}
@media print{body{background:#fff}.slide+.slide{margin-top:0}}
</style></head><body>\n${html}\n</body></html>`;

  fs.writeFileSync(path.join(OUT, 'luma-evolution.html'), doc);
  console.log(`HTML: ${M.slides.length} slides`);

  // ── PNG por slide + PDF ────────────────────────────────────────────────────
  const nav = await chromium.launch();
  const p = await nav.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + path.join(OUT, 'luma-evolution.html'), { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);
  const total = await p.evaluate(() => document.querySelectorAll('.slide').length);
  for (let k = 0; k < total; k++) {
    const el = p.locator('.slide').nth(k);
    await el.screenshot({ path: path.join(PNGS, `slide-${String(k + 1).padStart(2, '0')}.png`) });
  }
  console.log(`PNG: ${total} slides`);
  await p.pdf({ path: path.join(OUT, 'luma-evolution.pdf'), width: '1920px', height: '1080px',
                printBackground: true, pageRanges: `1-${total}` });
  console.log('PDF: luma-evolution.pdf');
  await nav.close();

  // ── notas do apresentador ──────────────────────────────────────────────────
  const notas = ['# Notas do apresentador — Luma, de piloto a produto', '',
    `${M.slides.length} slides. Tempo somado das notas: cerca de 20 minutos falando; dá pra cortar os slides de era e ficar em 12.`,
    '', '> Tudo que está nas notas tem lastro no repositório. Onde a motivação não está registrada, a nota diz "aparenta" em vez de afirmar.', ''];
  M.notas.forEach((t, k) => {
    notas.push(`## Slide ${String(k + 1).padStart(2, '0')}`, '', t.trim(), '');
  });
  fs.writeFileSync(path.join(OUT, 'luma-evolution-speaker-notes.md'), notas.join('\n'));
  console.log('Notas: luma-evolution-speaker-notes.md');

  // ── índice de evidências ───────────────────────────────────────────────────
  const idx = ['# Índice de evidências', '',
    'Cada slide, o que o sustenta e o quanto se pode confiar. Níveis usados:', '',
    '- **Alto** — captura real de uma execução (do commit ou do arquivo original), sem alteração no código da interface.',
    '- **Médio** — captura real que exigiu restauração técnica. *Nenhum slide desta apresentação está neste nível.*',
    '- **Baixo** — reconstrução visual a partir do código. *Nenhum slide desta apresentação está neste nível.*', '',
    '| # | Slide | Tipo de evidência | Imagens | Confiança | Observação |', '|---|---|---|---|---|---|'];
  M.indice.forEach((e, k) => {
    const imgs = (e.imagens || []).filter(Boolean).map(s => '`' + path.basename(s) + '`').join('<br>') || '—';
    // A ordem importa: os slides de era não têm .s-titulo, o rótulo deles é o .t-rot da
    // legenda da captura. Sem esse fallback o índice repetia o tipo de evidência no lugar
    // do nome do slide.
    const tit = (M.slides[k].match(/class="s-titulo"[^>]*>([\s\S]*?)<\/h2>/) || M.slides[k].match(/<h1>([\s\S]*?)<\/h1>/)
      || M.slides[k].match(/<h2>([\s\S]*?)<\/h2>/) || M.slides[k].match(/class="t-rot">([\s\S]*?)<\/span>/) || [, e.tipo])[1]
      .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 62);
    idx.push(`| ${k + 1} | ${tit} | ${e.tipo} | ${imgs} | ${e.confianca} | ${e.obs || '—'} |`);
  });
  idx.push('', '## Como conferir uma imagem', '',
    'Cada PNG tem um JSON irmão em `screenshots/metadata/<marco>/` com a tela, o estado, o commit, a data, a viewport e o tipo de captura.',
    'Pra reabrir a versão que gerou a imagem: `node scripts/versao.js <hash>`.');
  fs.writeFileSync(path.join(OUT, 'luma-evolution-index.md'), idx.join('\n'));
  console.log('Índice: luma-evolution-index.md');
  console.log(`\n${n.shots} capturas · ${n.capturados} marcos · ${n.feats} funcionalidades no atlas\n`);
})();
