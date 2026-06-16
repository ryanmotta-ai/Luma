// scripts/gen-favicon.js — rode uma vez: node scripts/gen-favicon.js
// Gera assets/favicon-180.png (Apple Touch Icon) a partir do mesmo design do favicon.svg.
// Requer o pacote 'canvas' (node-canvas). Se não estiver instalado, o script avisa e sai —
// não instale dependências só por causa disso; o favicon.svg já cobre 95% dos casos.
const fs = require('fs');

try {
  const { createCanvas } = require('canvas');
  const size = 180;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  // fundo laranja com bordas arredondadas
  ctx.fillStyle = '#FF9000';
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.22);
  ctx.fill();
  // chevron superior
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = size * 0.094;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(size * 0.25, size * 0.31);
  ctx.lineTo(size * 0.5,  size * 0.56);
  ctx.lineTo(size * 0.75, size * 0.31);
  ctx.stroke();
  // chevron inferior
  ctx.lineWidth = size * 0.063;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(size * 0.34, size * 0.56);
  ctx.lineTo(size * 0.5,  size * 0.72);
  ctx.lineTo(size * 0.66, size * 0.56);
  ctx.stroke();
  fs.writeFileSync('assets/favicon-180.png', canvas.toBuffer('image/png'));
  console.log('favicon-180.png gerado');
} catch(e) {
  console.log('Pulando PNG — pacote canvas não disponível. SVG favicon é suficiente.');
}
