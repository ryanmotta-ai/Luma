#!/usr/bin/env node
/**
 * scripts/embutir-arte.js
 *
 * Fecha uma arte da skill luma-creative: troca cada `asset:<caminho>` (relativo a
 * .agents/skills/luma-creative/assets/) pelo arquivo em base64. Assim a arte é escrita e revisada
 * legível (≈ 4 KB) e publicada autônoma (fontes e logo embutidos — SVG como imagem não carrega
 * nada de fora; @import de fonte cai em Arial). Zero dependências.
 *
 * Uso:   node scripts/embutir-arte.js <fonte.svg> <saida.svg>
 * Ex.:   <image href="asset:logos/dm-h-branca.png" …/>
 *        @font-face{font-family:'Realce';src:url('asset:fontes/realce-black.woff2') format('woff2')}
 */
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', '.agents', 'skills', 'luma-creative', 'assets');
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf' };

function embutir(svg) {
  return svg.replace(/asset:([\w./-]+)/g, (m, rel) => {
    const arq = path.join(BASE, rel);
    if (!fs.existsSync(arq)) throw new Error('asset não encontrado: ' + rel);
    const mime = MIME[path.extname(rel).slice(1).toLowerCase()];
    if (!mime) throw new Error('tipo não suportado: ' + rel);
    return 'data:' + mime + ';base64,' + fs.readFileSync(arq).toString('base64');
  });
}

module.exports = { embutir };

if (require.main === module) {
  const [src, out] = process.argv.slice(2);
  if (!src || !out) { console.log('Uso: node scripts/embutir-arte.js <fonte.svg> <saida.svg>'); process.exit(1); }
  try {
    fs.writeFileSync(out, embutir(fs.readFileSync(src, 'utf8')));
    console.log(`${out} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
  } catch (e) { console.error('Erro:', e.message); process.exit(1); }
}
