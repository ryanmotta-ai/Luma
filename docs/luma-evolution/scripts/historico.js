// docs/luma-evolution/scripts/historico.js — levanta TODOS os commits do repositório.
//
//   node docs/luma-evolution/scripts/historico.js
//
// Escreve commit-map/todos-os-commits.json, que alimenta a mega linha do tempo e a lista
// completa. Cada commit ganha data-hora, autor, assunto, quantos arquivos tocou, se mexeu
// em tela e a que áreas do produto pertence.
//
// É um passo à parte porque classificar cada commit exige um `git show` por commit — uns
// dez segundos no total. Rodar isso a cada montagem de slide seria desperdício; o JSON
// fica em disco e só precisa ser refeito quando o histórico muda.

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const BASE = path.resolve(__dirname, '..');
const RAIZ = path.resolve(BASE, '..', '..');
const SAIDA = path.join(BASE, 'commit-map', 'todos-os-commits.json');

const git = (...a) => execFileSync('git', a, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });

// A que parte do produto o commit pertence, pelo caminho dos arquivos que ele tocou.
// A ordem importa: `js/core/ai.js` é IA, não Núcleo — o teste mais específico vem antes.
function areas(arquivos) {
  const A = new Set();
  for (const f of arquivos) {
    if (/console/i.test(f) || /\bcli\b/i.test(f))            A.add('CLI');
    else if (f.startsWith('js/core/ai') || /functions\/ai/.test(f)) A.add('IA');
    else if (f.startsWith('js/franqueado') || /franqueado\.css|chat\.css/.test(f)) A.add('Franqueado');
    else if (f.startsWith('js/designer') || /designer/.test(f)) A.add('Designer');
    else if (f.startsWith('js/core') || f === 'index.html')  A.add('Núcleo');
    else if (f.startsWith('css/'))                            A.add('Design');
    else if (f.startsWith('supabase/'))                       A.add('Backend');
    else if (f.startsWith('luma-brain') || f.startsWith('docs/')) A.add('Docs');
    else if (f.startsWith('desktop/') || f === 'manifest.json' || f === 'sw.js') A.add('Pacote');
  }
  return A.size ? [...A].sort() : ['Outro'];
}

const mexeEmTela = f => f === 'index.html' || f.startsWith('css/') || f.startsWith('js/');

const linhas = git('log', '--all', '--date=format:%Y-%m-%d %H:%M', '--pretty=format:%H|%h|%ad|%an|%s')
  .trim().split('\n');

const commits = linhas.map(l => {
  const [sha, h, dt, autor, ...resto] = l.split('|');
  const assunto = resto.join('|');
  const arquivos = git('show', '--name-only', '--format=', '--no-renames', sha).split('\n').filter(Boolean);
  return { h, dt, dia: dt.slice(0, 10), hora: dt.slice(11), autor, s: assunto,
           areas: areas(arquivos), n: arquivos.length, tela: arquivos.some(mexeEmTela) };
}).sort((a, b) => a.dt.localeCompare(b.dt));

fs.writeFileSync(SAIDA, JSON.stringify(commits, null, 0));

const porDia = {};
for (const c of commits) porDia[c.dia] = (porDia[c.dia] || 0) + 1;
console.log(`${commits.length} commits · ${Object.keys(porDia).length} dias com atividade`);
for (const [d, n] of Object.entries(porDia)) {
  const tela = commits.filter(c => c.dia === d && c.tela).length;
  console.log(`  ${d}  ${String(n).padStart(2)} commits (${tela} em tela)  ${'█'.repeat(n)}`);
}
console.log(`\n→ ${path.relative(RAIZ, SAIDA)}\n`);
