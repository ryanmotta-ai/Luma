#!/usr/bin/env node
/**
 * scripts/gerar-artes-depor.js
 * 
 * Gera 5 artes oficiais DE/POR no Luma (Feed 1080x1350 e Story 1080x1920),
 * cobrindo os nichos de Pizza, Burger, Sushi, Açaí e Almoço Executivo.
 * Gera os SVGs fonte (legíveis), SVGs fechados (embutidos com base64),
 * e renderiza DOIS prints para cada peça:
 *  1. Com placeholder cinza oficial (#foto_produto)
 *  2. Com a foto real de teste aplicada via scripts/capture-art.js
 */

const fs = require('fs');
const path = require('path');
const { embutir } = require('./embutir-arte');
const { capturarArte } = require('./capture-art');

process.env.CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const DIRS = {
  fontes: path.join(__dirname, '..', 'assets', 'templates', 'de-por', 'fontes'),
  svg: path.join(__dirname, '..', 'assets', 'templates', 'de-por', 'svg'),
  printsPlaceholder: path.join(__dirname, '..', 'assets', 'templates', 'de-por', 'prints', 'placeholder'),
  printsComFoto: path.join(__dirname, '..', 'assets', 'templates', 'de-por', 'prints', 'com-foto')
};

Object.values(DIRS).forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const ARTES = [
  // 1. Pizza Calabresa (Feed 1080x1350)
  {
    id: '01_pizza_calabresa_feed',
    tipo: 'feed',
    w: 1080,
    h: 1350,
    fotoTeste: path.join(__dirname, '..', '.agents', 'skills', 'luma-creative', 'assets', 'fotos-teste', 'pizza-quente.jpg'),
    svg: `<svg xmlns="http://www.w3.org/2000/svg" data-luma="1" viewBox="0 0 1080 1350" width="1080" height="1350"><defs><style>
@font-face{font-family:'Realce';src:url('asset:fontes/realce-black.woff2') format('woff2');font-weight:900;}
@font-face{font-family:'Roboto';src:url('asset:fontes/Roboto-Medium.woff2') format('woff2');font-weight:500;}
@font-face{font-family:'Roboto';src:url('asset:fontes/Roboto-Regular.woff2') format('woff2');font-weight:400;}
@font-face{font-family:'Roboto';src:url('asset:fontes/Roboto-Light.woff2') format('woff2');font-weight:300;}
.hero{font-family:'Realce',sans-serif;font-weight:900;letter-spacing:0.5px}
.sup{font-family:'Roboto',sans-serif;font-weight:500;letter-spacing:1.2px}
.body{font-family:'Roboto',sans-serif;font-weight:400}
.legal{font-family:'Roboto',sans-serif;font-weight:300;letter-spacing:0.3px}
</style>
<filter id="sh" x="-10%" y="-10%" width="125%" height="135%"><feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#434343" flood-opacity="0.25"/></filter>
<filter id="shs" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#434343" flood-opacity="0.2"/></filter>
</defs>
<rect width="1080" height="1350" fill="#F85400"/>
<image href="asset:logos/dm-h-branca.png" x="100" y="80" width="260" height="52"/>
<g id="produto">
  <text x="100" y="295" class="hero" font-size="124" data-campo="produto" fill="#FFFFFF">PIZZA CALABRESA</text>
</g>
<text x="100" y="358" class="body" font-size="36" fill="#FFFFFF">Borda recheada e massa artesanal no forno</text>
<g id="foto_produto"><rect x="100" y="420" width="880" height="520" rx="56" fill="#D9D9D9"/>
<g transform="translate(540,650)">
  <rect x="-65" y="-68" width="130" height="98" rx="18" fill="none" stroke="#434343" stroke-width="7.5"/>
  <circle cx="26" cy="-38" r="8" fill="#434343"/>
  <polyline points="-42,12 -8,-24 24,12" fill="none" stroke="#434343" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
  <polyline points="6,12 32,-14 48,12" fill="none" stroke="#434343" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="0" y="85" text-anchor="middle" class="body" font-size="32" fill="#434343">Use aqui sua foto do produto</text>
</g></g>
<g transform="translate(880,440)" filter="url(#shs)">
  <circle r="96" fill="#FFB900"/>
  <text y="8" text-anchor="middle" class="hero" font-size="70" fill="#434343">27%</text>
  <text y="50" text-anchor="middle" class="hero" font-size="38" fill="#434343">OFF</text>
</g>
<g data-sobrepoe="foto">
  <rect x="100" y="860" width="480" height="320" rx="36" fill="#FFFFFF" filter="url(#sh)"/>
  <g id="preco">
    <text x="148" y="924" class="body" font-size="40" fill="#434343" text-decoration="line-through" data-campo="precoDe">DE R$ 54,90</text>
    <text x="150" y="980" class="sup" font-size="38" fill="#434343">POR</text>
    <text x="146" y="1120" class="hero" font-size="160" data-campo="precoPor" fill="#F85400"><tspan font-size="88" dy="-56">R$</tspan><tspan dy="56" dx="6">39</tspan><tspan font-size="88" dy="-56">,90</tspan></text>
  </g>
</g>
<rect x="692" y="1074" width="288" height="96" rx="48" fill="none" stroke="#FFFFFF" stroke-width="4"/>
<text x="836" y="1142" text-anchor="middle" class="hero" font-size="52" fill="#FFFFFF">PEDIR</text>
<text x="100" y="1260" class="legal" font-size="26" fill="#FFFFFF">Imagem ilustrativa. Oferta válida por tempo limitado.</text>
</svg>`
  },

  // 2. Burger Artesanal (Story 1080x1920)
  {
    id: '02_burger_artesanal_story',
    tipo: 'story',
    w: 1080,
    h: 1920,
    fotoTeste: path.join(__dirname, '..', '.agents', 'skills', 'luma-creative', 'assets', 'fotos-teste', 'burger-escuro.jpg'),
    svg: `<svg xmlns="http://www.w3.org/2000/svg" data-luma="1" viewBox="0 0 1080 1920" width="1080" height="1920"><defs><style>
@font-face{font-family:'Realce';src:url('asset:fontes/realce-black.woff2') format('woff2');font-weight:900;}
@font-face{font-family:'Roboto';src:url('asset:fontes/Roboto-Medium.woff2') format('woff2');font-weight:500;}
@font-face{font-family:'Roboto';src:url('asset:fontes/Roboto-Regular.woff2') format('woff2');font-weight:400;}
@font-face{font-family:'Roboto';src:url('asset:fontes/Roboto-Light.woff2') format('woff2');font-weight:300;}
.hero{font-family:'Realce',sans-serif;font-weight:900;letter-spacing:0.5px}
.sup{font-family:'Roboto',sans-serif;font-weight:500;letter-spacing:1.2px}
.body{font-family:'Roboto',sans-serif;font-weight:400}
.legal{font-family:'Roboto',sans-serif;font-weight:300;letter-spacing:0.3px}
</style>
<filter id="sh" x="-10%" y="-10%" width="125%" height="135%"><feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#434343" flood-opacity="0.25"/></filter>
<filter id="shs" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#434343" flood-opacity="0.2"/></filter>
</defs>
<rect width="1080" height="1920" fill="#F85400"/>
<image href="asset:logos/dm-h-branca.png" x="100" y="280" width="260" height="52"/>
<g id="produto">
  <text x="100" y="470" class="hero" font-size="122" data-campo="produto" fill="#FFFFFF">BURGER ARTESANAL</text>
</g>
<text x="100" y="535" class="body" font-size="38" fill="#FFFFFF">Blend duplo 180g com queijo cheddar</text>
<g id="foto_produto"><rect x="100" y="600" width="880" height="680" rx="56" fill="#D9D9D9"/>
<g transform="translate(540,910)">
  <rect x="-65" y="-68" width="130" height="98" rx="18" fill="none" stroke="#434343" stroke-width="7.5"/>
  <circle cx="26" cy="-38" r="8" fill="#434343"/>
  <polyline points="-42,12 -8,-24 24,12" fill="none" stroke="#434343" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
  <polyline points="6,12 32,-14 48,12" fill="none" stroke="#434343" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="0" y="85" text-anchor="middle" class="body" font-size="32" fill="#434343">Use aqui sua foto do produto</text>
</g></g>
<g transform="translate(880,620)" filter="url(#shs)">
  <circle r="96" fill="#FFB900"/>
  <text y="8" text-anchor="middle" class="hero" font-size="70" fill="#434343">23%</text>
  <text y="50" text-anchor="middle" class="hero" font-size="38" fill="#434343">OFF</text>
</g>
<g data-sobrepoe="foto">
  <rect x="100" y="1200" width="500" height="320" rx="36" fill="#FFFFFF" filter="url(#sh)"/>
  <g id="preco">
    <text x="148" y="1264" class="body" font-size="40" fill="#434343" text-decoration="line-through" data-campo="precoDe">DE R$ 38,00</text>
    <text x="150" y="1320" class="sup" font-size="38" fill="#434343">POR</text>
    <text x="146" y="1460" class="hero" font-size="160" data-campo="precoPor" fill="#F85400"><tspan font-size="88" dy="-56">R$</tspan><tspan dy="56" dx="6">28</tspan><tspan font-size="88" dy="-56">,90</tspan></text>
  </g>
</g>
<rect x="660" y="1410" width="320" height="100" rx="50" fill="#FFFFFF" filter="url(#sh)"/>
<text x="820" y="1478" text-anchor="middle" class="hero" font-size="48" fill="#F85400">PEÇA JÁ</text>
<text x="100" y="1630" class="legal" font-size="26" fill="#FFFFFF">Consulte os restaurantes participantes no aplicativo.</text>
</svg>`
  },

  // 3. Combo Oriental / Sushi (Feed 1080x1350)
  {
    id: '03_combo_oriental_feed',
    tipo: 'feed',
    w: 1080,
    h: 1350,
    fotoTeste: path.join(__dirname, '..', '.agents', 'skills', 'luma-creative', 'assets', 'fotos-teste', 'sushi.jpg'),
    svg: `<svg xmlns="http://www.w3.org/2000/svg" data-luma="1" viewBox="0 0 1080 1350" width="1080" height="1350"><defs><style>
@font-face{font-family:'Realce';src:url('asset:fontes/realce-black.woff2') format('woff2');font-weight:900;}
@font-face{font-family:'Roboto';src:url('asset:fontes/Roboto-Medium.woff2') format('woff2');font-weight:500;}
@font-face{font-family:'Roboto';src:url('asset:fontes/Roboto-Regular.woff2') format('woff2');font-weight:400;}
@font-face{font-family:'Roboto';src:url('asset:fontes/Roboto-Light.woff2') format('woff2');font-weight:300;}
.hero{font-family:'Realce',sans-serif;font-weight:900;letter-spacing:0.5px}
.sup{font-family:'Roboto',sans-serif;font-weight:500;letter-spacing:1.2px}
.body{font-family:'Roboto',sans-serif;font-weight:400}
.legal{font-family:'Roboto',sans-serif;font-weight:300;letter-spacing:0.3px}
</style>
<filter id="sh" x="-10%" y="-10%" width="125%" height="135%"><feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#1C1C1C" flood-opacity="0.3"/></filter>
<filter id="shs" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#1C1C1C" flood-opacity="0.25"/></filter>
</defs>
<rect width="1080" height="1350" fill="#434343"/>
<image href="asset:logos/dm-h-branca.png" x="100" y="80" width="260" height="52"/>
<g id="produto">
  <text x="100" y="295" class="hero" font-size="124" data-campo="produto" fill="#FFFFFF">COMBO ORIENTAL</text>
</g>
<text x="100" y="358" class="body" font-size="36" fill="#FFB900">20 peças selecionadas de salmão e hot roll</text>
<g id="foto_produto"><rect x="100" y="420" width="880" height="520" rx="56" fill="#D9D9D9"/>
<g transform="translate(540,650)">
  <rect x="-65" y="-68" width="130" height="98" rx="18" fill="none" stroke="#434343" stroke-width="7.5"/>
  <circle cx="26" cy="-38" r="8" fill="#434343"/>
  <polyline points="-42,12 -8,-24 24,12" fill="none" stroke="#434343" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
  <polyline points="6,12 32,-14 48,12" fill="none" stroke="#434343" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="0" y="85" text-anchor="middle" class="body" font-size="32" fill="#434343">Use aqui sua foto do produto</text>
</g></g>
<g transform="translate(880,440)" filter="url(#shs)">
  <circle r="96" fill="#F85400"/>
  <text y="8" text-anchor="middle" class="hero" font-size="70" fill="#FFFFFF">28%</text>
  <text y="50" text-anchor="middle" class="hero" font-size="38" fill="#FFFFFF">OFF</text>
</g>
<g data-sobrepoe="foto">
  <rect x="100" y="860" width="480" height="320" rx="36" fill="#FFFFFF" filter="url(#sh)"/>
  <g id="preco">
    <text x="148" y="924" class="body" font-size="40" fill="#434343" text-decoration="line-through" data-campo="precoDe">DE R$ 69,90</text>
    <text x="150" y="980" class="sup" font-size="38" fill="#434343">POR</text>
    <text x="146" y="1120" class="hero" font-size="160" data-campo="precoPor" fill="#F85400"><tspan font-size="88" dy="-56">R$</tspan><tspan dy="56" dx="6">49</tspan><tspan font-size="88" dy="-56">,90</tspan></text>
  </g>
</g>
<rect x="692" y="1074" width="288" height="96" rx="48" fill="none" stroke="#FFFFFF" stroke-width="4"/>
<text x="836" y="1142" text-anchor="middle" class="hero" font-size="52" fill="#FFFFFF">PEDIR</text>
<text x="100" y="1260" class="legal" font-size="26" fill="#D9D9D9">Disponível nos restaurantes japoneses participantes.</text>
</svg>`
  },

  // 4. Copo de Açaí 500ml (Story 1080x1920)
  {
    id: '04_acai_turbinado_story',
    tipo: 'story',
    w: 1080,
    h: 1920,
    fotoTeste: path.join(__dirname, '..', '.agents', 'skills', 'luma-creative', 'assets', 'fotos-teste', 'doce.jpg'),
    svg: `<svg xmlns="http://www.w3.org/2000/svg" data-luma="1" viewBox="0 0 1080 1920" width="1080" height="1920"><defs><style>
@font-face{font-family:'Realce';src:url('asset:fontes/realce-black.woff2') format('woff2');font-weight:900;}
@font-face{font-family:'Roboto';src:url('asset:fontes/Roboto-Medium.woff2') format('woff2');font-weight:500;}
@font-face{font-family:'Roboto';src:url('asset:fontes/Roboto-Regular.woff2') format('woff2');font-weight:400;}
@font-face{font-family:'Roboto';src:url('asset:fontes/Roboto-Light.woff2') format('woff2');font-weight:300;}
.hero{font-family:'Realce',sans-serif;font-weight:900;letter-spacing:0.5px}
.sup{font-family:'Roboto',sans-serif;font-weight:500;letter-spacing:1.2px}
.body{font-family:'Roboto',sans-serif;font-weight:400}
.legal{font-family:'Roboto',sans-serif;font-weight:300;letter-spacing:0.3px}
</style>
<filter id="sh" x="-10%" y="-10%" width="125%" height="135%"><feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#434343" flood-opacity="0.25"/></filter>
<filter id="shs" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#434343" flood-opacity="0.2"/></filter>
</defs>
<rect width="1080" height="1920" fill="#FFB900"/>
<image href="asset:logos/dm-h-branca.png" x="100" y="280" width="260" height="52"/>
<g id="produto">
  <text x="100" y="470" class="hero" font-size="116" data-campo="produto" fill="#434343">AÇAÍ NO COPO 500ML</text>
</g>
<text x="100" y="535" class="body" font-size="38" fill="#434343">Com leite condensado, morango e granola</text>
<g id="foto_produto"><rect x="100" y="600" width="880" height="680" rx="56" fill="#D9D9D9"/>
<g transform="translate(540,910)">
  <rect x="-65" y="-68" width="130" height="98" rx="18" fill="none" stroke="#434343" stroke-width="7.5"/>
  <circle cx="26" cy="-38" r="8" fill="#434343"/>
  <polyline points="-42,12 -8,-24 24,12" fill="none" stroke="#434343" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
  <polyline points="6,12 32,-14 48,12" fill="none" stroke="#434343" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="0" y="85" text-anchor="middle" class="body" font-size="32" fill="#434343">Use aqui sua foto do produto</text>
</g></g>
<g transform="translate(880,620)" filter="url(#shs)">
  <circle r="96" fill="#F85400"/>
  <text y="8" text-anchor="middle" class="hero" font-size="70" fill="#FFFFFF">27%</text>
  <text y="50" text-anchor="middle" class="hero" font-size="38" fill="#FFFFFF">OFF</text>
</g>
<g data-sobrepoe="foto">
  <rect x="100" y="1200" width="500" height="320" rx="36" fill="#FFFFFF" filter="url(#sh)"/>
  <g id="preco">
    <text x="148" y="1264" class="body" font-size="40" fill="#434343" text-decoration="line-through" data-campo="precoDe">DE R$ 26,00</text>
    <text x="150" y="1320" class="sup" font-size="38" fill="#434343">POR</text>
    <text x="146" y="1460" class="hero" font-size="160" data-campo="precoPor" fill="#F85400"><tspan font-size="88" dy="-56">R$</tspan><tspan dy="56" dx="6">18</tspan><tspan font-size="88" dy="-56">,90</tspan></text>
  </g>
</g>
<rect x="660" y="1410" width="320" height="100" rx="50" fill="#F85400" filter="url(#sh)"/>
<text x="820" y="1478" text-anchor="middle" class="hero" font-size="46" fill="#FFFFFF">QUERO AÇAÍ</text>
<text x="100" y="1630" class="legal" font-size="26" fill="#434343">Válido para pedidos realizados exclusivamente no app.</text>
</svg>`
  },

  // 5. Almoço Executivo (Feed 1080x1350)
  {
    id: '05_almoco_executivo_feed',
    tipo: 'feed',
    w: 1080,
    h: 1350,
    fotoTeste: path.join(__dirname, '..', '.agents', 'skills', 'luma-creative', 'assets', 'fotos-teste', 'salada-clara.jpg'),
    svg: `<svg xmlns="http://www.w3.org/2000/svg" data-luma="1" viewBox="0 0 1080 1350" width="1080" height="1350"><defs><style>
@font-face{font-family:'Realce';src:url('asset:fontes/realce-black.woff2') format('woff2');font-weight:900;}
@font-face{font-family:'Roboto';src:url('asset:fontes/Roboto-Medium.woff2') format('woff2');font-weight:500;}
@font-face{font-family:'Roboto';src:url('asset:fontes/Roboto-Regular.woff2') format('woff2');font-weight:400;}
@font-face{font-family:'Roboto';src:url('asset:fontes/Roboto-Light.woff2') format('woff2');font-weight:300;}
.hero{font-family:'Realce',sans-serif;font-weight:900;letter-spacing:0.5px}
.sup{font-family:'Roboto',sans-serif;font-weight:500;letter-spacing:1.2px}
.body{font-family:'Roboto',sans-serif;font-weight:400}
.legal{font-family:'Roboto',sans-serif;font-weight:300;letter-spacing:0.3px}
</style>
<filter id="sh" x="-10%" y="-10%" width="125%" height="135%"><feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#434343" flood-opacity="0.25"/></filter>
<filter id="shs" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#434343" flood-opacity="0.2"/></filter>
</defs>
<rect width="1080" height="1350" fill="#F85400"/>
<image href="asset:logos/dm-h-branca.png" x="100" y="80" width="260" height="52"/>
<g id="produto">
  <text x="100" y="295" class="hero" font-size="124" data-campo="produto" fill="#FFFFFF">ALMOÇO EXECUTIVO</text>
</g>
<text x="100" y="358" class="body" font-size="36" fill="#FFFFFF">Filé de frango grelhado com arroz e fritas</text>
<g id="foto_produto"><rect x="100" y="420" width="880" height="520" rx="56" fill="#D9D9D9"/>
<g transform="translate(540,650)">
  <rect x="-65" y="-68" width="130" height="98" rx="18" fill="none" stroke="#434343" stroke-width="7.5"/>
  <circle cx="26" cy="-38" r="8" fill="#434343"/>
  <polyline points="-42,12 -8,-24 24,12" fill="none" stroke="#434343" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
  <polyline points="6,12 32,-14 48,12" fill="none" stroke="#434343" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="0" y="85" text-anchor="middle" class="body" font-size="32" fill="#434343">Use aqui sua foto do produto</text>
</g></g>
<g transform="translate(880,440)" filter="url(#shs)">
  <circle r="96" fill="#FFB900"/>
  <text y="8" text-anchor="middle" class="hero" font-size="70" fill="#434343">30%</text>
  <text y="50" text-anchor="middle" class="hero" font-size="38" fill="#434343">OFF</text>
</g>
<g data-sobrepoe="foto">
  <rect x="100" y="860" width="480" height="320" rx="36" fill="#FFFFFF" filter="url(#sh)"/>
  <g id="preco">
    <text x="148" y="924" class="body" font-size="40" fill="#434343" text-decoration="line-through" data-campo="precoDe">DE R$ 32,90</text>
    <text x="150" y="980" class="sup" font-size="38" fill="#434343">POR</text>
    <text x="146" y="1120" class="hero" font-size="160" data-campo="precoPor" fill="#F85400"><tspan font-size="88" dy="-56">R$</tspan><tspan dy="56" dx="6">22</tspan><tspan font-size="88" dy="-56">,90</tspan></text>
  </g>
</g>
<rect x="692" y="1074" width="288" height="96" rx="48" fill="none" stroke="#FFFFFF" stroke-width="4"/>
<text x="836" y="1142" text-anchor="middle" class="hero" font-size="52" fill="#FFFFFF">PEDIR</text>
<text x="100" y="1260" class="legal" font-size="26" fill="#FFFFFF">Válido de segunda a sexta no horário de almoço.</text>
</svg>`
  }
];

async function main() {
  console.log(`Iniciando geração das 5 artes oficiais DE/POR no Luma...`);
  
  for (let i = 0; i < ARTES.length; i++) {
    const item = ARTES[i];
    
    // 1. Salvar fonte legível (com asset:)
    const fontePath = path.join(DIRS.fontes, `${item.id}.svg`);
    fs.writeFileSync(fontePath, item.svg, 'utf8');

    // 2. Fechar com base64 autônomo
    const embeddedSvg = embutir(item.svg);
    const svgPath = path.join(DIRS.svg, `${item.id}.svg`);
    fs.writeFileSync(svgPath, embeddedSvg, 'utf8');

    // 3. Renderizar Print 1: Placeholder oficial cinza
    const pngPlaceholderPath = path.join(DIRS.printsPlaceholder, `${item.id}.png`);
    await capturarArte(svgPath, pngPlaceholderPath);

    // 4. Renderizar Print 2: Peça como vai ao ar com a foto real de teste
    const pngFotoPath = path.join(DIRS.printsComFoto, `${item.id}.png`);
    await capturarArte(svgPath, pngFotoPath, item.fotoTeste);

    console.log(`[${i + 1}/${ARTES.length}] ✓ Gerada: ${item.id} (${item.tipo})`);
  }

  console.log(`\n🎉 Concluído com sucesso! Artes salvas em:`);
  console.log(`  Fontes SVG: assets/templates/de-por/fontes/`);
  console.log(`  SVGs Prontos: assets/templates/de-por/svg/`);
  console.log(`  Prints (Placeholder): assets/templates/de-por/prints/placeholder/`);
  console.log(`  Prints (Com Foto Real): assets/templates/de-por/prints/com-foto/`);
}

main().catch(err => {
  console.error('Erro na geração:', err);
  process.exit(1);
});
