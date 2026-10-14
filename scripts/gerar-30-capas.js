#!/usr/bin/env node
/**
 * scripts/gerar-30-capas.js
 * 
 * Gera uma suíte de 30 capas oficiais para o Luma (750x400), aplicando rigorosamente
 * as diretrizes aprendidas na skill luma-creative e validadas nas 26 referências reais.
 * 
 * Uso: node scripts/gerar-30-capas.js [--png]
 */

const fs = require('fs');
const path = require('path');
const { embutir } = require('./embutir-arte');
const { capturarArte } = require('./capture-art');

process.env.CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const OUT_SVG_DIR = path.join(__dirname, '..', 'assets', 'templates', 'capas', 'svg');
const OUT_PNG_DIR = path.join(__dirname, '..', 'assets', 'templates', 'capas', 'prints');

if (!fs.existsSync(OUT_SVG_DIR)) fs.mkdirSync(OUT_SVG_DIR, { recursive: true });
if (!fs.existsSync(OUT_PNG_DIR)) fs.mkdirSync(OUT_PNG_DIR, { recursive: true });

const CAPAS = [
  // Grupo 1: Campanhas de Cupom & Desconto (Laranja & Amarelo)
  {
    id: '01_cupons_exclusivos',
    bg: '#F85400',
    pre: { txt: 'AQUI TEM', fill: '#F62900', color: '#FFFFFF' },
    hero: { txt: 'CUPONS', size: 76, color: '#F85400', stroke: '#FFFFFF' },
    post: { txt: 'EXCLUSIVOS', fill: '#FFFFFF', color: '#F85400' },
    aderecos: ['ticket', 'moeda']
  },
  {
    id: '02_desconto_em_dobro',
    bg: '#F85400',
    bgGraphic: 'raio',
    pre: { txt: 'VOCÊ ACHOU', fill: '#F62900', color: '#FFFFFF' },
    hero: { txt: 'DESCONTO', size: 70, color: '#F85400', stroke: '#FFFFFF' },
    post: { txt: 'EM DOBRO', fill: '#FFFFFF', color: '#F85400' },
    aderecos: ['porcentagem']
  },
  {
    id: '03_ofertas_favoritas',
    bg: '#FFB900',
    pre: { txt: 'BORA DE', fill: '#F85400', color: '#FFFFFF' },
    hero: { txt: 'OFERTAS', size: 76, color: '#F85400', stroke: '#FFFFFF' },
    post: { txt: 'FAVORITAS', fill: '#FFFFFF', color: '#F85400' },
    aderecos: ['porcentagem', 'moeda']
  },
  {
    id: '04_maratona_de_descontos',
    bg: '#FFB900',
    bgGraphic: 'arco',
    pre: { txt: 'MARATONA', fill: '#F85400', color: '#FFFFFF' },
    hero: { txt: 'DESCONTOS', size: 68, color: '#F85400', stroke: '#FFFFFF' },
    post: { txt: 'NO APP', fill: '#FFFFFF', color: '#F85400' },
    aderecos: ['porcentagem', 'moeda']
  },
  {
    id: '05_rangos_que_baixaram_o_preco',
    bg: '#FFB900',
    pre: { txt: 'RANGOS QUE', fill: '#F85400', color: '#FFFFFF' },
    hero: { txt: 'BAIXARAM', size: 72, color: '#F85400', stroke: '#FFFFFF' },
    post: { txt: 'O PREÇO', fill: '#FFFFFF', color: '#F85400' },
    aderecos: ['moeda']
  },
  {
    id: '06_promo_turbinada',
    bg: '#FFB900',
    bgGraphic: 'arco',
    pre: { txt: 'PROMO', fill: '#F85400', color: '#FFFFFF' },
    hero: { txt: 'TURBINADA', size: 68, color: '#F85400', stroke: '#FFFFFF' },
    post: { txt: 'DE HOJE', fill: '#FFFFFF', color: '#F85400' },
    aderecos: ['porcentagem']
  },

  // Grupo 2: Valor & Frete (Verde, Laranja & Amarelo)
  {
    id: '07_entrega_gratis',
    bg: '#00B32C',
    pre: { txt: 'AQUI TEM', fill: '#008C22', color: '#FFFFFF' },
    hero: { txt: 'ENTREGA', size: 76, color: '#F85400', stroke: '#FFFFFF' },
    post: { txt: 'GRÁTIS NO APP', fill: '#FFFFFF', color: '#00B32C' },
    aderecos: ['moeda']
  },
  {
    id: '08_tudo_ate_25',
    bg: '#F85400',
    pre: { txt: 'ECONOMIA', fill: '#F62900', color: '#FFFFFF' },
    hero: { txt: 'TUDO', size: 80, color: '#F85400', stroke: '#FFFFFF' },
    post: { txt: 'ATÉ R$ 25', fill: '#FFFFFF', color: '#F85400' },
    aderecos: ['porcentagem']
  },
  {
    id: '09_combos_economicos',
    bg: '#F85400',
    pre: { txt: 'PEÇA JÁ', fill: '#F62900', color: '#FFFFFF' },
    hero: { txt: 'COMBOS', size: 76, color: '#F85400', stroke: '#FFFFFF' },
    post: { txt: 'A PARTIR DE R$ 19', fill: '#FFFFFF', color: '#F85400' },
    aderecos: ['moeda']
  },
  {
    id: '10_frete_zero',
    bg: '#00B32C',
    pre: { txt: 'ECONOMIZE NO', fill: '#008C22', color: '#FFFFFF' },
    hero: { txt: 'FRETE', size: 78, color: '#F85400', stroke: '#FFFFFF' },
    post: { txt: 'TAXA ZERO REAIS', fill: '#FFFFFF', color: '#00B32C' },
    aderecos: ['moeda']
  },
  {
    id: '11_compre_1_leve_2',
    bg: '#FFB900',
    pre: { txt: 'DOSE DUPLA', fill: '#F85400', color: '#FFFFFF' },
    hero: { txt: 'COMPRE 1', size: 72, color: '#F85400', stroke: '#FFFFFF' },
    post: { txt: 'LEVE 2 NO APP', fill: '#FFFFFF', color: '#F85400' },
    aderecos: ['porcentagem']
  },
  {
    id: '12_vale_presente',
    bg: '#F85400',
    pre: { txt: 'PEGA O SEU', fill: '#F62900', color: '#FFFFFF' },
    hero: { txt: 'VALE', size: 82, color: '#F85400', stroke: '#FFFFFF' },
    post: { txt: 'DE R$ 15 OFF', fill: '#FFFFFF', color: '#F85400' },
    aderecos: ['ticket']
  },

  // Grupo 3: Categorias Gastronômicas Populares (Laranja, Grafite, Roxo)
  {
    id: '13_acai_aqui',
    bg: '#73109E',
    pre: { txt: 'REFRESCANTE', fill: '#550877', color: '#FFFFFF' },
    hero: { txt: 'AÇAÍ', size: 82, color: '#F85400', stroke: '#FFFFFF' },
    post: { txt: 'AQUI NO APP', fill: '#FFFFFF', color: '#73109E' },
    aderecos: ['porcentagem']
  },
  {
    id: '14_pizza_em_dobro',
    bg: '#F85400',
    pre: { txt: 'HOJE PEDE', fill: '#F62900', color: '#FFFFFF' },
    hero: { txt: 'PIZZA', size: 80, color: '#F85400', stroke: '#FFFFFF' },
    post: { txt: 'EM DOBRO', fill: '#FFFFFF', color: '#F85400' },
    aderecos: ['porcentagem']
  },
  {
    id: '15_burger_artesanal',
    bg: '#F85400',
    pre: { txt: 'FESTIVAL', fill: '#F62900', color: '#FFFFFF' },
    hero: { txt: 'BURGER', size: 78, color: '#F85400', stroke: '#FFFFFF' },
    post: { txt: 'SUCULENTO', fill: '#FFFFFF', color: '#F85400' },
    aderecos: ['moeda']
  },
  {
    id: '16_sushi_oriental',
    bg: '#1C1C1C',
    pre: { txt: 'QUARTA', fill: '#F85400', color: '#FFFFFF' },
    hero: { txt: 'SUSHI', size: 80, color: '#FFFFFF', stroke: '#F85400' },
    post: { txt: 'EM CASA', fill: '#F85400', color: '#FFFFFF' },
    aderecos: ['moeda']
  },
  {
    id: '17_pastel_crocante',
    bg: '#FFB900',
    pre: { txt: 'MUITO SABOR', fill: '#F85400', color: '#FFFFFF' },
    hero: { txt: 'PASTEL', size: 78, color: '#F85400', stroke: '#FFFFFF' },
    post: { txt: 'BEM CROCANTE', fill: '#FFFFFF', color: '#F85400' },
    aderecos: ['porcentagem']
  },
  {
    id: '18_churrasco_completo',
    bg: '#1C1C1C',
    pre: { txt: 'DOMINGOU COM', fill: '#F85400', color: '#FFFFFF' },
    hero: { txt: 'CHURRASCO', size: 66, color: '#FFFFFF', stroke: '#F85400' },
    post: { txt: 'COMPLETO', fill: '#F85400', color: '#FFFFFF' },
    aderecos: ['moeda']
  },
  {
    id: '19_frango_crocante',
    bg: '#F85400',
    pre: { txt: 'NOVIDADE', fill: '#F62900', color: '#FFFFFF' },
    hero: { txt: 'FRANGO', size: 78, color: '#F85400', stroke: '#FFFFFF' },
    post: { txt: 'NO BALDE', fill: '#FFFFFF', color: '#F85400' },
    aderecos: ['moeda']
  },
  {
    id: '20_massas_italianas',
    bg: '#F85400',
    pre: { txt: 'TRADIÇÃO', fill: '#F62900', color: '#FFFFFF' },
    hero: { txt: 'MASSAS', size: 78, color: '#F85400', stroke: '#FFFFFF' },
    post: { txt: 'CASEIRAS', fill: '#FFFFFF', color: '#F85400' },
    aderecos: ['porcentagem']
  },

  // Grupo 4: Momentos de Consumo & Refeições (Laranja, Amarelo, Grafite)
  {
    id: '21_almoco_do_dia',
    bg: '#F85400',
    pre: { txt: 'PEÇA SEU', fill: '#F62900', color: '#FFFFFF' },
    hero: { txt: 'ALMOÇO', size: 78, color: '#F85400', stroke: '#FFFFFF' },
    post: { txt: 'DO DIA', fill: '#FFFFFF', color: '#F85400' },
    aderecos: ['moeda']
  },
  {
    id: '22_prato_feito',
    bg: '#FFB900',
    pre: { txt: 'NO CAPRICHO', fill: '#F85400', color: '#FFFFFF' },
    hero: { txt: 'PRATO FEITO', size: 66, color: '#F85400', stroke: '#FFFFFF' },
    post: { txt: 'POPULAR', fill: '#FFFFFF', color: '#F85400' },
    aderecos: ['moeda']
  },
  {
    id: '23_sobremesas_e_doces',
    bg: '#F85400',
    pre: { txt: 'VAI UM', fill: '#F62900', color: '#FFFFFF' },
    hero: { txt: 'DOCINHO', size: 76, color: '#F85400', stroke: '#FFFFFF' },
    post: { txt: 'DEPOIS DO ALMOÇO?', fill: '#FFFFFF', color: '#F85400' },
    aderecos: ['porcentagem']
  },
  {
    id: '24_bebidas_conveniencia',
    bg: '#FFB900',
    pre: { txt: 'BEM GELADA', fill: '#F85400', color: '#FFFFFF' },
    hero: { txt: 'BEBIDAS', size: 78, color: '#F85400', stroke: '#FFFFFF' },
    post: { txt: 'NO APP', fill: '#FFFFFF', color: '#F85400' },
    aderecos: ['moeda']
  },
  {
    id: '25_happy_hour',
    bg: '#F85400',
    pre: { txt: 'SEXTOU COM', fill: '#F62900', color: '#FFFFFF' },
    hero: { txt: 'HAPPY HOUR', size: 66, color: '#F85400', stroke: '#FFFFFF' },
    post: { txt: 'COM OS AMIGOS', fill: '#FFFFFF', color: '#F85400' },
    aderecos: ['porcentagem']
  },
  {
    id: '26_fome_na_madruga',
    bg: '#1C1C1C',
    pre: { txt: 'FOME NA', fill: '#F85400', color: '#FFFFFF' },
    hero: { txt: 'MADRUGA', size: 74, color: '#FFFFFF', stroke: '#F85400' },
    post: { txt: 'PEDE DELIVERY MUCH', fill: '#F85400', color: '#FFFFFF' },
    aderecos: ['moeda']
  },

  // Grupo 5: Institucional, Comunidade & Franquia (Laranja, Amarelo, Verde)
  {
    id: '27_lojas_favoritas',
    bg: '#F85400',
    pre: { txt: 'AS MELHORES', fill: '#F62900', color: '#FFFFFF' },
    hero: { txt: 'LOJAS', size: 82, color: '#F85400', stroke: '#FFFFFF' },
    post: { txt: 'DA NOSSA CIDADE', fill: '#FFFFFF', color: '#F85400' },
    aderecos: ['porcentagem']
  },
  {
    id: '28_novos_parceiros',
    bg: '#FFB900',
    pre: { txt: 'CHEGOU', fill: '#F85400', color: '#FFFFFF' },
    hero: { txt: 'NOVIDADE', size: 72, color: '#F85400', stroke: '#FFFFFF' },
    post: { txt: 'NO APLICATIVO', fill: '#FFFFFF', color: '#F85400' },
    aderecos: ['porcentagem']
  },
  {
    id: '29_comercio_local',
    bg: '#F85400',
    pre: { txt: 'VALORIZE O', fill: '#F62900', color: '#FFFFFF' },
    hero: { txt: 'COMÉRCIO', size: 70, color: '#F85400', stroke: '#FFFFFF' },
    post: { txt: 'LOCAL E DA TERRA', fill: '#FFFFFF', color: '#F85400' },
    aderecos: ['moeda']
  },
  {
    id: '30_aniversario_franquia',
    bg: '#FFB900',
    bgGraphic: 'arco',
    pre: { txt: 'FESTA DE', fill: '#F85400', color: '#FFFFFF' },
    hero: { txt: 'ANIVERSÁRIO', size: 62, color: '#F85400', stroke: '#FFFFFF' },
    post: { txt: 'COM MUITO CUPOM', fill: '#FFFFFF', color: '#F85400' },
    aderecos: ['ticket', 'porcentagem']
  }
];

function buildSvg(item) {
  const preW = Math.max(130, item.pre.txt.length * 11 + 36);
  const postW = Math.max(160, item.post.txt.length * 12 + 40);

  let bgGraphicXml = '';
  if (item.bgGraphic === 'raio') {
    bgGraphicXml = `<polygon points="340,50 440,50 380,180 450,180 310,330 360,200 300,200" fill="#FFB900" opacity="0.95"/>`;
  } else if (item.bgGraphic === 'arco') {
    bgGraphicXml = `<path d="M 100 170 Q 375 270 650 170" fill="none" stroke="#F85400" stroke-width="44" stroke-linecap="round" opacity="0.2"/>`;
  }

  let aderecosXml = '';
  if (item.aderecos && item.aderecos.includes('ticket')) {
    aderecosXml += `
      <g transform="translate(195, -45) rotate(14)">
        <rect x="-35" y="-18" width="70" height="36" rx="6" fill="#FFB900" stroke="#FFFFFF" stroke-width="3"/>
        <circle cx="-35" cy="0" r="6" fill="${item.bg}"/>
        <circle cx="35" cy="0" r="6" fill="${item.bg}"/>
        <line x1="-15" y1="0" x2="15" y2="0" stroke="${item.bg}" stroke-width="2.5" stroke-dasharray="4 3"/>
      </g>`;
  }
  if (item.aderecos && item.aderecos.includes('porcentagem')) {
    aderecosXml += `
      <g transform="translate(-190, -42) rotate(-12)">
        <circle cx="0" cy="0" r="23" fill="#FFB900" stroke="#FFFFFF" stroke-width="3"/>
        <text y="7" font-family="'Realce', sans-serif" font-weight="900" font-size="20" fill="#F85400" text-anchor="middle">%</text>
      </g>`;
  }
  if (item.aderecos && item.aderecos.includes('moeda')) {
    aderecosXml += `
      <g transform="translate(195, 48) rotate(12)">
        <circle cx="0" cy="0" r="21" fill="#FFB900" stroke="#FFFFFF" stroke-width="3"/>
        <text y="7" font-family="'Roboto', sans-serif" font-weight="900" font-size="19" fill="#F85400" text-anchor="middle">$</text>
      </g>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 400" width="750" height="400" data-luma="1">
  <defs>
    <style>
      @font-face {
        font-family: 'Realce';
        src: url('asset:fontes/realce-black.woff2') format('woff2');
        font-weight: 900;
        font-style: normal;
      }
      @font-face {
        font-family: 'Roboto';
        src: url('asset:fontes/Roboto-Medium.woff2') format('woff2');
        font-weight: 500;
        font-style: normal;
      }
      @font-face {
        font-family: 'Roboto';
        src: url('asset:fontes/Roboto-Regular.woff2') format('woff2');
        font-weight: 400;
        font-style: normal;
      }
    </style>
    <filter id="sticker-shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#434343" flood-opacity="0.26"/>
    </filter>
  </defs>

  <!-- Fundo Sólido Oficial -->
  <rect width="750" height="400" fill="${item.bg}"/>

  ${bgGraphicXml}

  <!-- Lockup Central Inclinado (Sticker Retail -8°) -->
  <g transform="translate(375, 175) rotate(-8)" filter="url(#sticker-shadow)" text-anchor="middle">
    
    ${aderecosXml}

    <!-- Tag Superior / Pré-título -->
    <g transform="translate(0, -56)">
      <rect x="${-preW / 2}" y="-18" width="${preW}" height="36" rx="8" fill="${item.pre.fill}"/>
      <text y="7" font-family="'Roboto', sans-serif" font-weight="500" font-size="20" fill="${item.pre.color}" letter-spacing="1">${item.pre.txt}</text>
    </g>

    <!-- Palavra Principal (Hero Sticker) -->
    <text x="0" y="24" font-family="'Realce', sans-serif" font-weight="900" font-size="${item.hero.size}" fill="${item.hero.color}" stroke="${item.hero.stroke}" stroke-width="18" stroke-linejoin="round" paint-order="stroke fill" letter-spacing="0.5" data-campo="titulo">${item.hero.txt}</text>

    <!-- Tag Inferior / Complemento -->
    <g transform="translate(0, 56)">
      <rect x="${-postW / 2}" y="-18" width="${postW}" height="36" rx="10" fill="${item.post.fill}"/>
      <text y="7" font-family="'Roboto', sans-serif" font-weight="500" font-size="21" fill="${item.post.color}" letter-spacing="0.5">${item.post.txt}</text>
    </g>
  </g>

  <!-- Assinatura Inferior Centralizada -->
  <image href="asset:logos/dm-h-branca.png" x="288" y="336" width="174" height="35" preserveAspectRatio="xMidYMid meet"/>
</svg>`;
}

async function main() {
  console.log(`Iniciando geração de ${CAPAS.length} capas para o Luma (750x400)...`);
  
  for (let i = 0; i < CAPAS.length; i++) {
    const item = CAPAS[i];
    const rawSvg = buildSvg(item);
    
    // 1. Embutir base64 autônomo
    const embeddedSvg = embutir(rawSvg);
    const svgPath = path.join(OUT_SVG_DIR, `capa_${item.id}.svg`);
    fs.writeFileSync(svgPath, embeddedSvg, 'utf8');

    // 2. Renderizar PNG correspondente
    const pngPath = path.join(OUT_PNG_DIR, `capa_${item.id}.png`);
    await capturarArte(svgPath, pngPath);

    console.log(`[${i + 1}/${CAPAS.length}] ✓ Gerada: capa_${item.id}`);
  }

  console.log(`\n🎉 Concluído com sucesso! 30 capas geradas em:`);
  console.log(`  SVG: assets/templates/capas/svg/`);
  console.log(`  PNG: assets/templates/capas/prints/`);
}

main().catch(err => {
  console.error('Erro na geração:', err);
  process.exit(1);
});
