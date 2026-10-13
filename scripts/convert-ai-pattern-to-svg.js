const fs = require('fs');

const text = fs.readFileSync('pattern_extracted.txt', 'latin1');
const lines = text.split(/\r?\n/);

let paths = [];
let currentMatrix = [1, 0, 0, 1, 0, 0];
let currentPath = '';

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const cmMatch = line.match(/(?:q\s+)?([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+cm/);
  if (cmMatch) {
    currentMatrix = cmMatch.slice(1, 7).map(Number);
    continue;
  }

  if (line.endsWith(' m')) {
    const parts = line.slice(0, -2).trim().split(/\s+/).map(Number);
    currentPath += `M ${parts[0]} ${parts[1]} `;
  } else if (line.endsWith(' l')) {
    const parts = line.slice(0, -2).trim().split(/\s+/).map(Number);
    currentPath += `L ${parts[0]} ${parts[1]} `;
  } else if (line.endsWith(' c')) {
    const parts = line.slice(0, -2).trim().split(/\s+/).map(Number);
    currentPath += `C ${parts[0]} ${parts[1]}, ${parts[2]} ${parts[3]}, ${parts[4]} ${parts[5]} `;
  } else if (line === 'h') {
    currentPath += 'Z ';
  } else if (line === 'f*' || line === 'f') {
    if (currentPath) {
      paths.push({
        transform: `matrix(${currentMatrix.join(' ')})`,
        d: currentPath.trim()
      });
      currentPath = '';
    }
  } else if (line === 'Q') {
    currentMatrix = [1, 0, 0, 1, 0, 0];
    currentPath = '';
  }
}

console.log(`Processados ${paths.length} caminhos vetoriais com suas matrizes reais de translação!`);

const svgBody = paths.map(p => `    <g transform="${p.transform}">\n      <path d="${p.d}" fill-rule="evenodd"/>\n    </g>`).join('\n');

// SVG oficial limpo para importação
const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
  <g transform="matrix(1 0 0 -1 0 1080)" fill="currentColor">
${svgBody}
  </g>
</svg>`;

// SVG com fundo laranja para prévia visual
const previewSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
  <rect width="1920" height="1080" fill="#F85400"/>
  <g transform="matrix(1 0 0 -1 0 1080)" fill="#FF9000" opacity="0.65">
${svgBody}
  </g>
</svg>`;

fs.writeFileSync('.agents/skills/luma-creative/assets/grafismos/pattern-dm-oficial.svg', fullSvg);
fs.writeFileSync('assets/grafismos/pattern-dm-oficial.svg', fullSvg);
fs.writeFileSync('assets/grafismos/pattern-dm-preview.svg', previewSvg);
console.log('Arquivos salvos com sucesso!');
