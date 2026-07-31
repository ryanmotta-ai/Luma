// docs/luma-evolution/scripts/tudo.js — reconstrói a apresentação inteira.
//
//   node docs/luma-evolution/scripts/tudo.js              tudo, do zero
//   node docs/luma-evolution/scripts/tudo.js --sem-captura   só remonta os slides
//
// Ordem: capturar (executa cada marco e fotografa) → atlas (mede onde as coisas estão
// hoje) → anotar (contorna cada funcionalidade) → publicar (HTML, PNGs, PDF, notas,
// índice) → pptx (empacota os PNGs).
//
// A captura é a etapa cara: sobe uma versão por marco e navega tela a tela. Quando só o
// texto ou o layout dos slides mudou, --sem-captura pula direto pra montagem.

const { execFileSync } = require('child_process');
const path = require('path');

const AQUI = __dirname;
const semCaptura = process.argv.includes('--sem-captura');

const passo = (rotulo, cmd, args) => {
  console.log(`\n${'─'.repeat(64)}\n▶ ${rotulo}\n${'─'.repeat(64)}`);
  execFileSync(cmd, args, { stdio: 'inherit', cwd: path.resolve(AQUI, '..', '..', '..') });
};

try {
  if (!semCaptura) {
    passo('1/5 · capturando as versões históricas', 'node', [path.join(AQUI, 'capturar.js')]);
    passo('2/5 · medindo onde as funcionalidades estão hoje', 'node', [path.join(AQUI, 'atlas.js')]);
    passo('3/5 · gerando as capturas anotadas', 'node', [path.join(AQUI, 'anotar.js')]);
  } else {
    console.log('\n(pulando captura, atlas e anotações — usando as evidências já em disco)');
  }
  passo('4/5 · montando HTML, PNGs, PDF, notas e índice', 'node', [path.join(AQUI, 'publicar.js')]);
  passo('5/5 · empacotando o PowerPoint', 'python3', [path.join(AQUI, 'montar-pptx.py')]);
  console.log('\n✓ pronto — os arquivos estão em docs/luma-evolution/presentation/\n');
} catch (e) {
  console.error('\n✗ parou em uma das etapas. A saída acima diz onde.\n');
  process.exit(1);
}
