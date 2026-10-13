const fs = require('fs');
const path = require('path');

const baseDir = '.agents/skills/luma-creative';
const dirs = [
  'assets/logos',
  'assets/molduras',
  'assets/cards-preco',
  'assets/selos',
  'assets/grafismos',
  'assets/fontes',
  'referencias'
];

dirs.forEach(d => {
  const p = path.join(baseDir, d);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// 1. Copy fonts
fs.copyFileSync('assets/fonts/realce-black.woff2', path.join(baseDir, 'assets/fontes/realce-black.woff2'));
fs.copyFileSync('assets/fonts/Realce-Black-v0.006.otf', path.join(baseDir, 'assets/fontes/Realce-Black-v0.006.otf'));
fs.copyFileSync('assets/fonts/Roboto-Regular.ttf', path.join(baseDir, 'assets/fontes/Roboto-Regular.ttf'));

// 2. Copy logos
fs.copyFileSync('assets/logos/dm-h-branca.png', path.join(baseDir, 'assets/logos/dm-h-branca.png'));
fs.copyFileSync('assets/logos/dm-h-laranja.png', path.join(baseDir, 'assets/logos/dm-h-laranja.png'));
fs.copyFileSync('assets/logos/dm-simbolo.png', path.join(baseDir, 'assets/logos/dm-simbolo.png'));

// 3. Moldura com Aba
const molduraSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 860 680" width="860" height="680">
  <g fill="#5A5D61">
    <circle cx="750" cy="5" r="92"/>
    <rect x="0" y="0" width="860" height="680" rx="54"/>
  </g>
  <g transform="translate(750, 0)">
    <rect x="-34" y="-26" width="68" height="52" rx="10" 
          fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <polyline points="-22,14 -4,-6 14,14" 
              fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <polyline points="4,14 18,2 26,14" 
              fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="14" cy="-10" r="5" fill="#FFFFFF"/>
  </g>
  <g transform="translate(430, 310)">
    <rect x="-65" y="-68" width="130" height="98" rx="18" 
          fill="none" stroke="#FFFFFF" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
    <polyline points="-42,12 -8,-24 24,12" 
          fill="none" stroke="#FFFFFF" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
    <polyline points="6,12 32,-14 48,12" 
          fill="none" stroke="#FFFFFF" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="24" cy="-34" r="8" fill="#FFFFFF"/>
    <text x="0" y="84" text-anchor="middle" 
          font-family="'Roboto', sans-serif" font-size="36" font-weight="400" fill="#FFFFFF">
      Use aqui sua foto do produto
    </text>
  </g>
</svg>`;
fs.writeFileSync(path.join(baseDir, 'assets/molduras/moldura-aba-foto.svg'), molduraSvg);

// 4. Card Preço Topo
const cardPrecoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 310 205" width="310" height="205">
  <rect x="0" y="0" width="310" height="205" rx="36" fill="#FFFFFF"/>
  <g transform="translate(155, 78)">
    <text x="0" y="0" text-anchor="middle" 
          font-family="'Roboto', sans-serif" font-weight="500" font-size="28" fill="#0A0A0A">
      R$ 28,00
    </text>
    <line x1="-72" y1="-8" x2="72" y2="-8" stroke="#0A0A0A" stroke-width="3.5" stroke-linecap="round"/>
  </g>
  <text x="155" y="150" text-anchor="middle" 
        font-family="'Realce', 'Impact', sans-serif" font-weight="900" font-size="52" fill="#FF4D00">
    R$ 22,90
  </text>
</svg>`;
fs.writeFileSync(path.join(baseDir, 'assets/cards-preco/card-preco-topo.svg'), cardPrecoSvg);

// 5. Grafismos
const grafismoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="1080" height="1350">
  <g fill="none" stroke="#E63E00" stroke-width="115" opacity="0.95">
    <path d="M -150 1280 A 380 380 0 0 1 450 1380"/>
    <path d="M 720 1380 A 340 340 0 0 1 1200 950"/>
    <path d="M -80 1020 A 240 240 0 0 1 280 1350" stroke-width="75" opacity="0.75"/>
  </g>
</svg>`;
fs.writeFileSync(path.join(baseDir, 'assets/grafismos/arcos-tone-on-tone.svg'), grafismoSvg);

// 6. Selo Mais Vendidos
const seloSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 388 94" width="388" height="94">
  <rect x="0" y="0" width="388" height="94" rx="26" fill="#FFFFFF"/>
  <rect x="4" y="4" width="380" height="86" rx="22" fill="#FF4D00"/>
  <g transform="translate(24, 28)">
    <rect x="0" y="0" width="56" height="17" rx="4" fill="#FFFFFF"/>
    <text x="28" y="13" text-anchor="middle" 
          font-family="'Roboto', sans-serif" font-size="11" font-weight="500" fill="#FF4D00">
      MAIS
    </text>
    <text x="0" y="36" 
          font-family="'Realce', 'Impact', sans-serif" font-size="28" font-weight="900" fill="#FFFFFF">
      VENDIDOS
    </text>
    <text x="0" y="52" 
          font-family="'Roboto', sans-serif" font-size="12" font-weight="500" fill="#FFFFFF">
      DO APP
    </text>
  </g>
  <g transform="translate(186, 47)">
    <ellipse cx="0" cy="-14" rx="32" ry="16" fill="#D9822B" stroke="#FFFFFF" stroke-width="2"/>
    <circle cx="-10" cy="-18" r="1.5" fill="#FFF5E5"/>
    <circle cx="8" cy="-16" r="1.5" fill="#FFF5E5"/>
    <circle cx="-2" cy="-12" r="1.5" fill="#FFF5E5"/>
    <polygon points="-30,-4 30,-4 15,8 -20,6" fill="#FFB900"/>
    <rect x="-30" y="-2" width="60" height="14" rx="4" fill="#5A2E14"/>
    <ellipse cx="0" cy="14" rx="28" ry="10" fill="#D9822B"/>
  </g>
  <path d="M 264 4 L 362 4 C 374 4, 384 14, 384 26 L 384 68 C 384 80, 374 90, 362 90 L 244 90 Q 269 47 264 4 Z" 
        fill="#FFB900"/>
  <text x="309" y="46" text-anchor="middle" 
        font-family="'Realce', 'Impact', sans-serif" font-size="36" font-weight="900" fill="#FFFFFF">
    25<tspan font-size="22">%</tspan>
  </text>
  <text x="309" y="62" text-anchor="middle" 
        font-family="'Roboto', sans-serif" font-size="13" font-weight="500" fill="#FFFFFF" letter-spacing="-0.5">
    OFF
  </text>
  <text x="309" y="76" text-anchor="middle" 
        font-family="'Roboto', sans-serif" font-size="10" font-weight="400" fill="#FFFFFF">
    ou mais
  </text>
</svg>`;
fs.writeFileSync(path.join(baseDir, 'assets/selos/selo-mais-vendidos.svg'), seloSvg);

// 7. References
fs.copyFileSync('assets/templates/template_clean_feed.svg', path.join(baseDir, 'referencias/template-clean-feed.svg'));
fs.copyFileSync('C:/Users/ryan/.gemini/antigravity/brain/6fabf459-9048-47b5-be2b-b983c8e9970b/.user_uploaded/media_1791850301440_e3d2f5f2.png', path.join(baseDir, 'referencias/referencia-clean-ryan.png'));

console.log('Skill directory and assets scaffolded successfully!');
