// docs/luma-evolution/scripts/tudo.js — reconstrói a apresentação inteira.
//
//   node docs/luma-evolution/scripts/tudo.js --v2 --sem-captura   remonta a V2 (~1 min)
//   node docs/luma-evolution/scripts/tudo.js --v2                 V2 com atlas e anotações
//   node docs/luma-evolution/scripts/tudo.js                      V1 completa, do zero (~25 min)
//   node docs/luma-evolution/scripts/tudo.js --faltando           captura só os marcos sem PNG
//
// V2 é a apresentação curada (5 marcos, atlas de funcionalidades, Much+). V1 é a versão
// auditoria, com os 9 marcos. As duas partilham as mesmas capturas e o mesmo estilo.
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
// --v2 monta a apresentação curada (5 marcos, atlas, Much+). Sem ela, monta a V1.
const v2 = args.includes('--v2');
const NARRATIVA = v2 ? 'slides-v2.js' : 'slides.js';
const PREFIXO = v2 ? 'luma-evolution-v2' : 'luma-evolution';

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
  if (v2 && !semCaptura) {
    passo('· medindo onde as funcionalidades estão hoje', 'node', [path.join(AQUI, 'atlas.js')]);
    passo('· gerando as capturas anotadas', 'node', [path.join(AQUI, 'anotar.js')]);
  }
  if (v2) passo('· levantando o histórico completo de commits', 'node', [path.join(AQUI, 'historico.js')]);
  passo(`montando HTML, conferindo layout, PNGs, PDF, notas e índice (${v2 ? 'V2' : 'V1'})`,
    'node', [path.join(AQUI, 'publicar.js'), NARRATIVA, PREFIXO]);
  passo('empacotando o PowerPoint', 'python3', [path.join(AQUI, 'montar-pptx.py'), PREFIXO]);
  console.log('\n✓ pronto — os arquivos estão em docs/luma-evolution/presentation/\n');
} catch (e) {
  // publicar.js sai com código 1 quando há apontamento de layout: o PPTX ainda assim vale
  // ser gerado, mas o aviso não pode passar batido.
  console.error('\n✗ uma das etapas terminou com apontamento ou erro. A saída acima diz onde.\n');
  process.exit(1);
}
