// docs/luma-evolution/scripts/tudo.js — reconstrói a apresentação inteira.
//
//   node docs/luma-evolution/scripts/tudo.js                 tudo, do zero (~25 min)
//   node docs/luma-evolution/scripts/tudo.js --faltando      captura só os marcos sem PNG
//   node docs/luma-evolution/scripts/tudo.js --sem-captura   só remonta os slides (~1 min)
//
// A captura é a etapa cara: sobe uma versão por marco e navega tela a tela. Quando só o
// texto ou o layout mudou, --sem-captura vai direto pra montagem usando as evidências que
// já estão em disco.

const { execFileSync } = require('child_process');
const path = require('path');

const AQUI = __dirname;
const RAIZ = path.resolve(AQUI, '..', '..', '..');
const args = process.argv.slice(2);
const semCaptura = args.includes('--sem-captura');
const faltando = args.includes('--faltando');

const passo = (rotulo, cmd, argv) => {
  console.log(`\n${'─'.repeat(66)}\n▶ ${rotulo}\n${'─'.repeat(66)}`);
  execFileSync(cmd, argv, { stdio: 'inherit', cwd: RAIZ });
};

try {
  if (semCaptura) {
    console.log('\n(pulando a captura — usando as evidências já em disco)');
  } else {
    passo('1/3 · capturando as versões históricas', 'node',
      [path.join(AQUI, 'capturar.js'), ...(faltando ? ['--faltando'] : [])]);
  }
  passo(`${semCaptura ? '1/2' : '2/3'} · montando HTML, conferindo layout, PNGs, PDF, notas e índice`,
    'node', [path.join(AQUI, 'publicar.js')]);
  passo(`${semCaptura ? '2/2' : '3/3'} · empacotando o PowerPoint`, 'python3', [path.join(AQUI, 'montar-pptx.py')]);
  console.log('\n✓ pronto — os arquivos estão em docs/luma-evolution/presentation/\n');
} catch (e) {
  // publicar.js sai com código 1 quando há apontamento de layout: o PPTX ainda assim vale
  // ser gerado, mas o aviso não pode passar batido.
  console.error('\n✗ uma das etapas terminou com apontamento ou erro. A saída acima diz onde.\n');
  process.exit(1);
}
