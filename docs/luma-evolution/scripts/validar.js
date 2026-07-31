// docs/luma-evolution/scripts/validar.js — revisa os slides antes de dar por pronto.
//
//   node docs/luma-evolution/scripts/validar.js
//
// Abre o HTML final e mede, slide a slide: elemento fora da página, texto cortado,
// imagem deformada, contraste baixo, fonte pequena demais e slide denso demais. Escreve
// reports/presentation-validation.md com o que passou e o que falhou.
//
// Isto não substitui olhar os slides — substitui olhar 30 slides procurando as MESMAS
// cinco coisas. O que precisa de olho (a narrativa fazer sentido) continua sendo humano.

const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const BASE = path.resolve(__dirname, '..');
const HTML = path.join(BASE, 'presentation', 'luma-evolution.html');
const W = 1920, H = 1080;
const MIN_FONTE = 14;      // abaixo disso não se lê numa projeção
const MIN_CONTRASTE = 4.5; // WCAG AA para texto

const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
  return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
const razao = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05); };
const rgb = s => (String(s).match(/\d+/g) || [0, 0, 0]).slice(0, 3).map(Number);

(async () => {
  if (!fs.existsSync(HTML)) { console.error('sem HTML — rode antes: node scripts/publicar.js'); process.exit(1); }
  const nav = await chromium.launch();
  const p = await nav.newPage({ viewport: { width: W, height: H } });
  await p.goto('file://' + HTML, { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);

  const achados = await p.evaluate(({ W, H, MIN_FONTE }) => {
    const out = [];
    document.querySelectorAll('.slide').forEach((s, i) => {
      const n = i + 1, sr = s.getBoundingClientRect(), prob = [];
      const dentro = e => { const r = e.getBoundingClientRect();
        return { x: r.x - sr.x, y: r.y - sr.y, w: r.width, h: r.height }; };

      s.querySelectorAll('*').forEach(e => {
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        const r = dentro(e);
        if (r.w < 1 || r.h < 1) return;

        // 1. saiu da página?
        if (r.x < -2 || r.y < -2 || r.x + r.w > W + 2 || r.y + r.h > H + 2) {
          const q = (e.textContent || '').trim().slice(0, 34);
          prob.push({ t: 'fora-da-pagina', el: (e.className || e.tagName).toString().slice(0, 30),
            d: `x${Math.round(r.x)} y${Math.round(r.y)} ${Math.round(r.w)}×${Math.round(r.h)}${q ? ' "' + q + '"' : ''}` });
        }
        // 2. texto REALMENTE cortado — só conta quando algo clipa de fato.
        //    scrollHeight > clientHeight sozinho é falso positivo: qualquer line-height
        //    abaixo de 1 dispara sem nada sumir da tela.
        if (e.children.length === 0 && (e.textContent || '').trim()) {
          const proprio = cs.overflow !== 'visible' && (e.scrollHeight > e.clientHeight + 3 || e.scrollWidth > e.clientWidth + 3);
          let cortadoPorPai = false;
          for (let a = e.parentElement; a && a !== s; a = a.parentElement) {
            if (getComputedStyle(a).overflow === 'visible') continue;
            const ra = a.getBoundingClientRect(), re = e.getBoundingClientRect();
            if (re.bottom > ra.bottom + 2 || re.right > ra.right + 2 || re.top < ra.top - 2) cortadoPorPai = true;
            break;   // só o contêiner que clipa mais perto importa
          }
          if (proprio || cortadoPorPai) {
            prob.push({ t: 'texto-cortado', el: (e.className || e.tagName).toString().slice(0, 30),
              d: `"${e.textContent.trim().slice(0, 40)}"` });
          }
          const px = parseFloat(cs.fontSize);
          if (px < MIN_FONTE) prob.push({ t: 'fonte-pequena', el: (e.className || e.tagName).toString().slice(0, 30), d: px + 'px' });
        }
        // 3. imagem deformada? (object-fit fill sem a proporção certa)
        if (e.tagName === 'IMG' && e.naturalWidth) {
          const pn = e.naturalWidth / e.naturalHeight, pr = r.w / r.h;
          if (getComputedStyle(e).objectFit === 'fill' && Math.abs(pn - pr) / pn > 0.06) {
            prob.push({ t: 'imagem-deformada', el: e.src.split('/').pop(),
              d: `natural ${pn.toFixed(2)} vs caixa ${pr.toFixed(2)}` });
          }
        }
      });

      // 4. densidade: quantos caracteres num slide
      const chars = (s.innerText || '').replace(/\s+/g, ' ').trim().length;
      if (chars > 1400) prob.push({ t: 'slide-denso', el: '(slide)', d: chars + ' caracteres' });

      // 5. contraste dos textos de corpo
      const fundo = getComputedStyle(s).backgroundColor;
      s.querySelectorAll('.s-sub, .tela-nota, .num-r, .atlas-txt p, .lista-txt p, .conclusao, .secao p, .c-sub').forEach(e => {
        if (!(e.textContent || '').trim()) return;
        let bg = fundo, no = e;
        while (no && no !== s) { const b = getComputedStyle(no).backgroundColor;
          if (b && b !== 'rgba(0, 0, 0, 0)') { bg = b; break; } no = no.parentElement; }
        out.push({ slide: n, contraste: { cor: getComputedStyle(e).color, fundo: bg,
          px: parseFloat(getComputedStyle(e).fontSize), el: (e.className || e.tagName).toString().slice(0, 24) } });
      });
      if (prob.length) out.push({ slide: n, problemas: prob });
    });
    return out;
  }, { W, H, MIN_FONTE });

  const total = await p.evaluate(() => document.querySelectorAll('.slide').length);
  await nav.close();

  // contraste calculado fora da página (matemática, não CSS)
  const contrastes = achados.filter(a => a.contraste).map(a => {
    const r = razao(rgb(a.contraste.cor), rgb(a.contraste.fundo));
    return { ...a, razao: r, ok: r >= MIN_CONTRASTE };
  });
  const problemas = achados.filter(a => a.problemas);

  const L = ['# Validação visual dos slides', '',
    `Rodada automática sobre \`presentation/luma-evolution.html\` — **${total} slides**, palco de ${W}×${H}.`, '',
    'O que foi medido em cada slide:', '',
    '1. Elemento que sai da página.',
    '2. Texto realmente cortado — só conta quando algo clipa de fato (`overflow` diferente de `visible`), porque `scrollHeight > clientHeight` sozinho dispara em qualquer `line-height` abaixo de 1.',
    `3. Imagem deformada (proporção natural contra a da caixa, tolerância de 6%).`,
    `4. Fonte abaixo de ${MIN_FONTE}px.`,
    '5. Densidade: mais de 1.400 caracteres num slide.',
    `6. Contraste do texto de corpo (mínimo ${MIN_CONTRASTE}:1, WCAG AA).`, '',
    '---', '', '## Resultado', ''];

  const nProb = problemas.reduce((n, s) => n + s.problemas.length, 0);
  const ruins = contrastes.filter(c => !c.ok);
  L.push(`| Verificação | Resultado |`, `|---|---|`);
  L.push(`| Slides analisados | ${total} |`);
  L.push(`| Problemas de layout | ${nProb === 0 ? '**nenhum**' : '**' + nProb + '**'} |`);
  L.push(`| Textos de corpo medidos | ${contrastes.length} |`);
  L.push(`| Contraste abaixo de ${MIN_CONTRASTE}:1 | ${ruins.length === 0 ? '**nenhum**' : '**' + ruins.length + '**'} |`);
  L.push(`| Menor contraste medido | ${contrastes.length ? Math.min(...contrastes.map(c => c.razao)).toFixed(2) + ':1' : '—'} |`);
  L.push('');

  if (nProb) {
    L.push('## Problemas de layout', '', '| Slide | Tipo | Elemento | Detalhe |', '|---|---|---|---|');
    for (const s of problemas) for (const q of s.problemas) L.push(`| ${s.slide} | ${q.t} | \`${q.el}\` | ${q.d} |`);
    L.push('');
  } else {
    L.push('## Problemas de layout', '', 'Nenhum. Nenhum elemento sai da página, nenhum texto está cortado, nenhuma imagem está deformada e nenhum slide passou do teto de densidade.', '');
  }

  if (ruins.length) {
    L.push('## Contrastes abaixo do mínimo', '', '| Slide | Elemento | Razão | Tamanho |', '|---|---|---|---|');
    for (const c of ruins) L.push(`| ${c.slide} | \`${c.contraste.el}\` | ${c.razao.toFixed(2)}:1 | ${c.contraste.px}px |`);
    L.push('');
  } else {
    L.push('## Contraste', '', `Todos os ${contrastes.length} textos de corpo medidos passam de ${MIN_CONTRASTE}:1.`, '');
  }

  L.push('---', '', '## O que esta rodada NÃO cobre', '',
    '- Se a narrativa faz sentido na ordem em que está.',
    '- Se a captura escolhida é a que melhor mostra o ponto do slide.',
    '- Se o texto está correto quanto ao fato — isso é o índice de evidências que responde.',
    '', 'Essas três coisas precisam de leitura humana. O resto é o que está medido acima.');

  fs.mkdirSync(path.join(BASE, 'reports'), { recursive: true });
  fs.writeFileSync(path.join(BASE, 'reports', 'presentation-validation.md'), L.join('\n') + '\n');
  console.log(`\n${total} slides · ${nProb} problemas de layout · ${ruins.length} contrastes abaixo de ${MIN_CONTRASTE}:1`);
  if (nProb) for (const s of problemas) for (const q of s.problemas) console.log(`   slide ${s.slide}: ${q.t} — ${q.el} ${q.d}`);
  console.log('');
  process.exit(nProb || ruins.length ? 1 : 0);
})();
