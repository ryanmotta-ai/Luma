const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const templates = [
  'template_01_cupom_semana.svg',
  'template_02_almoco_executivo.svg',
  'template_03_sexta_burger_story.svg',
  'template_04_entrega_gratis.svg',
  'template_05_novo_parceiro.svg',
  'template_06_domingo_doce.svg',
  'template_07_happy_hour_story.svg',
  'template_08_bebidas_conveniencia.svg',
  'template_09_quarta_oriental.svg',
  'template_10_comercio_local.svg'
];

fs.mkdirSync('assets/templates/prints', { recursive: true });

for (let i = 0; i < templates.length; i++) {
  const t = templates[i];
  const svgPath = path.join('assets/templates', t);
  const pngName = t.replace('.svg', '.png');
  const pngPath = path.join('assets/templates/prints', pngName);

  console.log(`[${i + 1}/10] Renderizando ${t} -> ${pngPath}...`);
  try {
    execSync(`node scripts/capture-art.js "${svgPath}" "${pngPath}"`, { stdio: 'inherit' });
  } catch (err) {
    console.error(`Erro ao renderizar ${t}:`, err.message);
  }
}

console.log('\\nTodos os 10 prints foram gerados em assets/templates/prints/!');
