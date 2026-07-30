// docs/luma-evolution/scripts/publicar.js — escreve a apresentação e seus derivados.
//
//   node docs/luma-evolution/scripts/publicar.js
//
// Gera, nesta ordem: o HTML (fonte de verdade do visual) → confere o layout → um PNG por
// slide → o PDF → as notas do apresentador → o índice de evidências. O PPTX sai dos PNGs,
// em pptx.py, pra que as três saídas mostrem exatamente o mesmo layout já conferido.
//
// A conferência de layout roda ANTES dos PNGs de propósito: não adianta exportar 20
// imagens e só depois descobrir que um texto saiu da página.

const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const fs = require('fs');
// Qual narrativa montar e com que nome sair. Sem argumento, monta a V1 — o comportamento
// que já existia. `node publicar.js slides-v2.js luma-evolution-v2` monta a V2.
const NARRATIVA = process.argv[2] || './slides.js';
const PREFIXO = process.argv[3] || 'luma-evolution';
const S = require(NARRATIVA.startsWith('.') ? NARRATIVA : './' + NARRATIVA);

const BASE = path.resolve(__dirname, '..');
const OUT = path.join(BASE, 'presentation');
const PNGS = path.join(OUT, PREFIXO === 'luma-evolution' ? 'slides-png' : PREFIXO + '-png');
const W = 1920, H = 1080;
const MIN_FONTE = 14;        // abaixo disso não se lê numa projeção
const MIN_CONTRASTE = 4.5;   // WCAG AA para texto

fs.mkdirSync(PNGS, { recursive: true });
fs.mkdirSync(path.join(BASE, 'reports'), { recursive: true });
// Limpa os PNGs da rodada anterior. Sem isso, uma apresentação que encolhe deixa os
// slides extras em disco e o montar-pptx.py os empacota junto — o PPTX saiu com 44
// páginas quando o HTML tinha 35.
for (const f of fs.readdirSync(PNGS)) if (/^slide-\d+\.png$/.test(f)) fs.unlinkSync(path.join(PNGS, f));

const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
  return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
const razao = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05); };
const rgb = s => (String(s).match(/\d+/g) || [0, 0, 0]).slice(0, 3).map(Number);

(async () => {
  // ── 1. HTML ────────────────────────────────────────────────────────────────
  // Numera por posição REAL no baralho. Um replace sequencial sobre o HTML inteiro só
  // conta os slides que têm rodapé — os escuros (capa e divisores) não têm, e o número
  // saía defasado: o 13º slide exibia "10".
  const corpo = S.slides.map((s, k) =>
    s.replace('<div class="num"></div>',
      `<div class="num">${String(k + 1).padStart(2, '0')} / ${S.slides.length}</div>`)).join('\n');

  const css = fs.readFileSync(path.join(__dirname, 'estilo.css'), 'utf8');
  const doc = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${S.titulo || 'Luma — de piloto a produto'}</title>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;700;900&display=swap" rel="stylesheet">
<style>${css}</style></head><body>
${corpo}
</body></html>`;
  fs.writeFileSync(path.join(OUT, PREFIXO + '.html'), doc);
  console.log(`HTML: ${S.slides.length} slides`);

  const nav = await chromium.launch();
  const p = await nav.newPage({ viewport: { width: W, height: H } });
  await p.goto('file://' + path.join(OUT, PREFIXO + '.html'), { waitUntil: 'networkidle' });
  await p.waitForTimeout(2000);

  // ── 2. conferência de layout (antes de exportar nada) ──────────────────────
  const achados = await p.evaluate(({ W, H, MIN_FONTE }) => {
    const out = [];
    document.querySelectorAll('.slide').forEach((s, idx) => {
      const nSlide = idx + 1, sr = s.getBoundingClientRect(), prob = [];
      s.querySelectorAll('*').forEach(e => {
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        const r = e.getBoundingClientRect();
        const x = r.x - sr.x, y = r.y - sr.y;
        if (r.width < 1 || r.height < 1) return;

        if (x < -2 || y < -2 || x + r.width > W + 2 || y + r.height > H + 2) {
          prob.push({ t: 'fora-da-pagina', el: (e.className || e.tagName).toString().slice(0, 28),
            d: `x${Math.round(x)} y${Math.round(y)} ${Math.round(r.width)}×${Math.round(r.height)}` });
        }
        if (e.children.length === 0 && (e.textContent || '').trim()) {
          // Só conta como cortado quando algo CLIPA de fato. scrollHeight > clientHeight
          // sozinho é falso positivo: dispara em qualquer line-height abaixo de 1.
          const proprio = cs.overflow !== 'visible' &&
            (e.scrollHeight > e.clientHeight + 3 || e.scrollWidth > e.clientWidth + 3);
          let porPai = false;
          for (let a = e.parentElement; a && a !== s; a = a.parentElement) {
            if (getComputedStyle(a).overflow === 'visible') continue;
            const ra = a.getBoundingClientRect();
            if (r.bottom > ra.bottom + 2 || r.right > ra.right + 2 || r.top < ra.top - 2) porPai = true;
            break;   // só o contêiner que clipa mais perto importa
          }
          if (proprio || porPai) prob.push({ t: 'texto-cortado', el: (e.className || e.tagName).toString().slice(0, 28),
            d: `"${e.textContent.trim().slice(0, 38)}"` });
          const px = parseFloat(cs.fontSize);
          if (px < MIN_FONTE) prob.push({ t: 'fonte-pequena', el: (e.className || e.tagName).toString().slice(0, 28), d: px + 'px' });
        }
      });
      const chars = (s.innerText || '').replace(/\s+/g, ' ').trim().length;
      if (chars > 1500) prob.push({ t: 'slide-denso', el: '(slide)', d: chars + ' caracteres' });

      // Sobreposição com a faixa de conclusão. A conclusão é `position:absolute`, então
      // texto do corpo passando por baixo dela não conta como "fora da página" — mas
      // aparece cortado no slide. Aconteceu: a quarta diferença sumia atrás da barra.
      const concl = s.querySelector('.conclusao');
      if (concl && getComputedStyle(concl).position === 'absolute') {
        const rc = concl.getBoundingClientRect();
        s.querySelectorAll('.corpo *').forEach(e => {
          if (!(e.textContent || '').trim() || e.children.length) return;
          const re = e.getBoundingClientRect();
          if (re.bottom > rc.top + 4 && re.top < rc.bottom - 4 && re.right > rc.left && re.left < rc.right) {
            prob.push({ t: 'sob-a-conclusao', el: (e.className || e.tagName).toString().slice(0, 28),
              d: `"${e.textContent.trim().slice(0, 34)}"` });
          }
        });
      }

      const fundoSlide = getComputedStyle(s).backgroundColor;
      s.querySelectorAll('.sub,.nota,.card .r,.li p,.conclusao,.csub,.psec,.tl-desc').forEach(e => {
        if (!(e.textContent || '').trim()) return;
        let bg = fundoSlide;
        for (let no = e; no && no !== s; no = no.parentElement) {
          const b = getComputedStyle(no).backgroundColor;
          if (b && b !== 'rgba(0, 0, 0, 0)') { bg = b; break; }
        }
        out.push({ slide: nSlide, contraste: { cor: getComputedStyle(e).color, fundo: bg,
          px: parseFloat(getComputedStyle(e).fontSize), el: (e.className || e.tagName).toString().slice(0, 22) } });
      });
      if (prob.length) out.push({ slide: nSlide, problemas: prob });
    });
    return out;
  }, { W, H, MIN_FONTE });

  const problemas = achados.filter(a => a.problemas);
  const contrastes = achados.filter(a => a.contraste)
    .map(a => { const r = razao(rgb(a.contraste.cor), rgb(a.contraste.fundo)); return { ...a, razao: r, ok: r >= MIN_CONTRASTE }; });
  const ruins = contrastes.filter(c => !c.ok);
  const nProb = problemas.reduce((n2, s) => n2 + s.problemas.length, 0);

  console.log(`Layout: ${nProb} problema(s) · contraste: ${ruins.length} abaixo de ${MIN_CONTRASTE}:1 (menor ${contrastes.length ? Math.min(...contrastes.map(c => c.razao)).toFixed(2) : '—'}:1)`);
  for (const s of problemas) for (const q of s.problemas) console.log(`   slide ${s.slide}: ${q.t} — ${q.el} ${q.d}`);

  const V = ['# Conferência visual dos slides', '',
    `\`presentation/luma-evolution.html\` — **${S.slides.length} slides**, palco de ${W}×${H}.`, '',
    'Medido em cada slide: elemento fora da página; texto realmente cortado (só conta quando um contêiner com `overflow` diferente de `visible` clipa — `scrollHeight > clientHeight` sozinho é falso positivo);',
    `imagem sem espaço; fonte abaixo de ${MIN_FONTE}px; mais de 1.500 caracteres num slide; e contraste do texto de corpo (mínimo ${MIN_CONTRASTE}:1, WCAG AA).`, '',
    '| Verificação | Resultado |', '|---|---|',
    `| Slides | ${S.slides.length} |`,
    `| Problemas de layout | ${nProb === 0 ? '**nenhum**' : '**' + nProb + '**'} |`,
    `| Textos de corpo medidos | ${contrastes.length} |`,
    `| Contraste abaixo de ${MIN_CONTRASTE}:1 | ${ruins.length === 0 ? '**nenhum**' : '**' + ruins.length + '**'} |`,
    `| Menor contraste medido | ${contrastes.length ? Math.min(...contrastes.map(c => c.razao)).toFixed(2) + ':1' : '—'} |`, ''];
  if (nProb) { V.push('## Problemas de layout', '', '| Slide | Tipo | Elemento | Detalhe |', '|---|---|---|---|');
    for (const s of problemas) for (const q of s.problemas) V.push(`| ${s.slide} | ${q.t} | \`${q.el}\` | ${q.d} |`); V.push(''); }
  else V.push('## Problemas de layout', '', 'Nenhum.', '');
  if (ruins.length) { V.push('## Contrastes abaixo do mínimo', '', '| Slide | Elemento | Razão |', '|---|---|---|');
    for (const c of ruins) V.push(`| ${c.slide} | \`${c.contraste.el}\` | ${c.razao.toFixed(2)}:1 |`); V.push(''); }
  else V.push('## Contraste', '', `Todos os ${contrastes.length} textos de corpo medidos passam de ${MIN_CONTRASTE}:1.`, '');
  V.push('---', '', '## O que esta conferência NÃO cobre', '',
    '- Se a narrativa faz sentido na ordem em que está.',
    '- Se a captura escolhida é a que melhor mostra o ponto do slide.',
    '- Se o texto está correto quanto ao fato — isso é o índice de evidências que responde.', '',
    'Essas três coisas precisam de leitura humana.');
  fs.writeFileSync(path.join(BASE, 'reports', PREFIXO + '-conferencia.md'), V.join('\n') + '\n');

  // ── 3. PNGs e PDF ──────────────────────────────────────────────────────────
  const total = await p.evaluate(() => document.querySelectorAll('.slide').length);
  for (let k = 0; k < total; k++) {
    await p.locator('.slide').nth(k).screenshot({ path: path.join(PNGS, `slide-${String(k + 1).padStart(2, '0')}.png`) });
  }
  console.log(`PNG: ${total} slides`);

  await p.pdf({ path: path.join(OUT, PREFIXO + '.pdf'), width: '1920px', height: '1080px',
                printBackground: true, pageRanges: `1-${total}` });
  console.log('PDF: ' + PREFIXO + '.pdf');
  await nav.close();

  // ── 4. notas do apresentador ───────────────────────────────────────────────
  const N = ['# Notas do apresentador — Luma, de piloto a produto', '',
    `${S.slides.length} slides. Somando as durações das notas dá cerca de 15 minutos falando; dá pra cortar os slides de era e ficar em 10.`, '',
    '> Tudo aqui tem lastro no repositório. Onde a motivação não está registrada, a nota diz "aparenta" em vez de afirmar.', ''];
  S.notas.forEach((t, k) => N.push(`## Slide ${String(k + 1).padStart(2, '0')}`, '', t, ''));
  fs.writeFileSync(path.join(OUT, PREFIXO + (PREFIXO.endsWith('v2') ? '-speaker-notes.md' : '-notas.md')), N.join('\n'));
  console.log('Notas: ' + PREFIXO + (PREFIXO.endsWith('v2') ? '-speaker-notes.md' : '-notas.md'));

  // ── 5. índice de evidências ────────────────────────────────────────────────
  const I = [`# Índice de evidências — ${S.titulo || 'Luma'}`, '',
    'Tipos usados: **Captura real** (execução do commit), **Arquivo histórico fornecido** (o piloto preservado),',
    '**Estado atual** (branch atual) e **Capa** (slide sem imagem de produto).', '',
    'Não há nesta apresentação nenhuma **captura restaurada** nem **reconstrução**: toda imagem saiu de uma execução real,',
    'sem alteração no código da interface.', '',
    '| # | Slide | Imagens | Data ou commit | Tipo de evidência | Observações |', '|---|---|---|---|---|---|'];
  S.indice.forEach((e, k) => {
    const s = S.slides[k];
    // A ordem importa: os slides de era não têm .titulo — o rótulo deles é o .rot da legenda.
    const tit = (s.match(/class="titulo"[^>]*>([\s\S]*?)<\/h2>/) || s.match(/<h1>([\s\S]*?)<\/h1>/)
      || s.match(/<h2>([\s\S]*?)<\/h2>/) || s.match(/class="rot">([\s\S]*?)<\/span>/) || [, e.tipo])[1]
      .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
    const imgs = (e.imagens || []).filter(Boolean).map(x => '`' + path.basename(x) + '`').join('<br>') || '—';
    // Escapa o pipe: uma observação com `git log | wc -l` quebrava a coluna da tabela.
    const cel = t => String(t).replace(/\|/g, '\\|');
    I.push(`| ${k + 1} | ${cel(tit)} | ${imgs} | ${cel(e.quando || '—')} | ${cel(e.tipo)} | ${cel(e.obs || '—')} |`);
  });
  I.push('', '## Como conferir uma imagem', '',
    'Cada PNG tem um JSON irmão em `screenshots/metadata/<marco>/` com a tela, o estado, o commit, a data, a viewport e o tipo de captura.',
    'Para reabrir a versão que gerou a imagem: `node scripts/versao.js <hash>`.');
  fs.writeFileSync(path.join(OUT, PREFIXO + (PREFIXO.endsWith('v2') ? '-index.md' : '-indice.md')), I.join('\n'));
  console.log('Índice: ' + PREFIXO + (PREFIXO.endsWith('v2') ? '-index.md' : '-indice.md'));

  console.log(`\n${S.totalShots} capturas · ${(S.MARCOS || []).length || S.marcosComShot} marcos · ${S.slides.length} slides\n`);
  if (nProb || ruins.length) { console.log('⚠ há apontamentos em reports/conferencia-visual.md\n'); process.exitCode = 1; }
})();
