const fs = require('fs');
const path = require('path');

// 1. Carregar logo oficial DM branca e fonte Realce Black em base64
const b64Logo = fs.readFileSync('assets/logos/dm-h-branca.png').toString('base64');
const dataUriLogo = 'data:image/png;base64,' + b64Logo;

const realceWoff2 = fs.readFileSync('assets/fonts/realce-black.woff2').toString('base64');
const realceDataUri = 'data:font/woff2;charset=utf-8;base64,' + realceWoff2;

const defsCommon = `
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500&amp;display=swap');

      @font-face {
        font-family: 'Realce';
        src: url('${realceDataUri}') format('woff2');
        font-weight: 900;
        font-style: normal;
        font-display: block;
      }

      .font-hero {
        font-family: 'Realce', 'Impact', sans-serif;
        font-weight: 900;
        letter-spacing: 0.5px;
      }
      .font-support {
        font-family: 'Roboto', sans-serif;
        font-weight: 500;
        letter-spacing: 0.8px;
      }
      .font-body {
        font-family: 'Roboto', sans-serif;
        font-weight: 400;
      }
      .font-legal {
        font-family: 'Roboto', sans-serif;
        font-weight: 300;
        letter-spacing: 0.2px;
      }
    </style>

    <filter id="soft-card-shadow" x="-10%" y="-10%" width="125%" height="130%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#802000" flood-opacity="0.22"/>
    </filter>

    <filter id="badge-shadow" x="-15%" y="-15%" width="130%" height="135%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000000" flood-opacity="0.2"/>
    </filter>
  </defs>
`;

const templates = [];

// ══════════════════════════════════════════════════════════════
// TEMPLATE 1: CUPOM DA SEMANA / VOUCHER AGRESSIVO (Feed 1080x1350)
// Foto em Arco no Topo + Ticket Branco com Picote no Centro + Selo 25% OFF
// ══════════════════════════════════════════════════════════════
templates.push({
  id: 'template_01_cupom_semana',
  filename: 'template_01_cupom_semana.svg',
  w: 1080,
  h: 1350,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="1080" height="1350">
  ${defsCommon}
  <clipPath id="feed-clip-1"><rect width="1080" height="1350" rx="54"/></clipPath>
  <clipPath id="arch-top-clip"><path d="M 0 200 A 200 200 0 0 1 400 200 L 400 440 L 0 440 Z"/></clipPath>

  <g clip-path="url(#feed-clip-1)">
    <!-- Fundo Laranja #F85400 com Sorriso da DM em #FF9000 -->
    <rect width="1080" height="1350" fill="#F85400"/>
    <g fill="none" stroke="#FF9000" stroke-width="115" opacity="0.4">
      <path d="M -150 1280 A 380 380 0 0 1 450 1380"/>
      <path d="M 720 1380 A 340 340 0 0 1 1200 950"/>
    </g>

    <!-- TOPO: FOTO EM ARCO / DOMO (x=340, y=80, w=400, h=440) -->
    <g transform="translate(340, 80)">
      <!-- Moldura Cinza #434343 em Arco -->
      <path d="M 0 200 A 200 200 0 0 1 400 200 L 400 440 L 0 440 Z" fill="#434343"/>
      <!-- Slot de foto e ícone -->
      <g transform="translate(200, 240)">
        <rect x="-40" y="-35" width="80" height="60" rx="12" fill="none" stroke="#FFFFFF" stroke-width="5"/>
        <circle cx="15" cy="-15" r="5" fill="#FFFFFF"/>
        <polyline points="-25,12 -5,-8 10,8" fill="none" stroke="#FFFFFF" stroke-width="5"/>
        <polyline points="0,12 15,-3 25,12" fill="none" stroke="#FFFFFF" stroke-width="5"/>
      </g>
      <text x="200" y="340" text-anchor="middle" class="font-support" font-size="18" fill="#FFFFFF">Foto da Pizza</text>
      <text x="200" y="365" text-anchor="middle" class="font-legal" font-size="14" fill="#FFFFFF" opacity="0.8">(Slot de alta resolução)</text>
    </g>

    <!-- SELO DESTAQUE 25% OFF EM AMARELO OURO (#FFB900) -->
    <g transform="translate(680, 240)" filter="url(#badge-shadow)">
      <circle cx="0" cy="0" r="70" fill="#FFB900"/>
      <circle cx="0" cy="0" r="62" fill="none" stroke="#F85400" stroke-width="2" stroke-dasharray="6 4"/>
      <text x="0" y="-8" text-anchor="middle" class="font-hero" font-size="28" fill="#434343">25%</text>
      <text x="0" y="20" text-anchor="middle" class="font-hero" font-size="22" fill="#F85400">OFF</text>
      <text x="0" y="38" text-anchor="middle" class="font-support" font-size="10" fill="#434343">NO APP</text>
    </g>

    <!-- CENTRO: TICKET DE CUPOM COM PICOTE EM BRANCO (#FFFFFF) -->
    <!-- Respiro calculado de 90px abaixo da foto -->
    <g transform="translate(140, 580)" filter="url(#soft-card-shadow)">
      <!-- Fundo do Ticket -->
      <path d="M 0 24 Q 0 0 24 0 L 776 0 Q 800 0 800 24 L 800 120 A 24 24 0 0 0 800 168 L 800 264 Q 800 288 776 288 L 24 288 Q 0 288 0 264 L 0 168 A 24 24 0 0 0 0 120 Z" fill="#FFFFFF"/>
      
      <!-- Linha pontilhada de picote vertical em x=550 -->
      <line x1="550" y1="20" x2="550" y2="268" stroke="#E0E0E0" stroke-width="3" stroke-dasharray="8 6"/>

      <!-- Lado Esquerdo do Ticket: Código do Cupom -->
      <g transform="translate(50, 60)">
        <text x="0" y="0" class="font-support" font-size="14" fill="#434343">USE O CUPOM EXCLUSIVO</text>
        <text x="0" y="62" class="font-hero" font-size="56" fill="#F85400">QUEROPIZZA</text>
        <text x="0" y="110" class="font-body" font-size="18" fill="#434343">Válido para todas as pizzarias participantes</text>
        <text x="0" y="140" class="font-legal" font-size="13" fill="#434343" opacity="0.8">*Desconto máximo de R$ 20. Consulte regras no app.</text>
      </g>

      <!-- Lado Direito do Ticket: Valor -->
      <g transform="translate(675, 120)">
        <text x="0" y="0" text-anchor="middle" class="font-support" font-size="14" fill="#434343">DESCONTO</text>
        <text x="0" y="52" text-anchor="middle" class="font-hero" font-size="48" fill="#F85400">R$ 15</text>
      </g>
    </g>

    <!-- CHAMADA DE IMPACTO INFERIOR (y=920 a 1040) -->
    <g transform="translate(140, 940)">
      <text x="0" y="0" class="font-hero" font-size="44" fill="#FFFFFF">PEÇA SUA PIZZA FAVORITA</text>
      <text x="0" y="42" class="font-support" font-size="22" fill="#FFFFFF" opacity="0.95">Aproveite hoje o cupom de desconto no app</text>
    </g>

    <!-- RODAPÉ INSTITUCIONAL (y=1160) -->
    <g transform="translate(140, 1160)">
      <image href="${dataUriLogo}" x="0" y="0" width="210" height="62" preserveAspectRatio="xMidYMid meet"/>
      <g transform="translate(800, 22)">
        <text x="0" y="0" text-anchor="end" class="font-support" font-size="17" fill="#FFFFFF">Delivery Much · A sua fome resolvida</text>
        <text x="0" y="24" text-anchor="end" class="font-legal" font-size="13" fill="#FFFFFF" opacity="0.85">Baixe o app e peça agora mesmo</text>
      </g>
    </g>
  </g>
</svg>`
});

// ══════════════════════════════════════════════════════════════
// TEMPLATE 2: ALMOÇO EXECUTIVO / PRATOS DO DIA (Feed 1080x1350)
// Card Branco Flutuante Gigante no Centro + Moldura Horizontal na Base
// ══════════════════════════════════════════════════════════════
templates.push({
  id: 'template_02_almoco_executivo',
  filename: 'template_02_almoco_executivo.svg',
  w: 1080,
  h: 1350,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="1080" height="1350">
  ${defsCommon}
  <clipPath id="feed-clip-2"><rect width="1080" height="1350" rx="54"/></clipPath>

  <g clip-path="url(#feed-clip-2)">
    <rect width="1080" height="1350" fill="#F85400"/>
    <g fill="none" stroke="#FF9000" stroke-width="115" opacity="0.4">
      <path d="M 850 1100 A 320 320 0 0 1 1250 800"/>
      <path d="M -100 1350 A 420 420 0 0 1 500 1350"/>
    </g>

    <!-- TOPO: LOGO DM + MANCHETE DIRETA -->
    <g transform="translate(110, 75)">
      <image href="${dataUriLogo}" x="0" y="0" width="180" height="53" preserveAspectRatio="xMidYMid meet"/>
      <g transform="translate(0, 95)">
        <rect x="0" y="0" width="165" height="26" rx="6" fill="rgba(255, 255, 255, 0.22)"/>
        <text x="82" y="18" text-anchor="middle" class="font-support" font-size="11" fill="#FFFFFF">SEGUNDA A SEXTA</text>
        <text x="0" y="80" class="font-hero" font-size="68" fill="#FFFFFF">ALMOÇO</text>
        <text x="0" y="145" class="font-hero" font-size="68" fill="#FFFFFF">EXECUTIVO</text>
        <text x="0" y="186" class="font-support" font-size="20" fill="#FFFFFF" opacity="0.95">Pratos deliciosos sem fila e sem espera</text>
      </g>
    </g>

    <!-- CARD BRANCO GIGANTE DE PREÇO (Flutuando no Topo-Direito, x=580, y=95) -->
    <g transform="translate(580, 95)" filter="url(#soft-card-shadow)">
      <rect width="390" height="235" rx="36" fill="#FFFFFF"/>
      <g transform="translate(195, 55)">
        <text x="0" y="0" text-anchor="middle" class="font-support" font-size="15" fill="#434343">PRATOS A PARTIR DE</text>
        <text x="0" y="72" text-anchor="middle" class="font-hero" font-size="68" fill="#F85400">R$ 19,90</text>
        <line x1="-120" y1="102" x2="120" y2="102" stroke="#F0F0F0" stroke-width="2"/>
        <text x="0" y="132" text-anchor="middle" class="font-support" font-size="14" fill="#434343">ENTREGA RÁPIDA NO TRABALHO</text>
      </g>
    </g>

    <!-- POLO CENTRAL/BASE: MOLDURA HORIZONTAL DA FOTO (y=440 a 1060) -->
    <g transform="translate(110, 440)">
      <rect width="860" height="620" rx="44" fill="#434343"/>
      <!-- Aba lateral de restaurante -->
      <g transform="translate(730, -25)" filter="url(#badge-shadow)">
        <rect width="130" height="50" rx="14" fill="#FFB900"/>
        <text x="65" y="32" text-anchor="middle" class="font-hero" font-size="16" fill="#434343">CARDÁPIO DO DIA</text>
      </g>
      <!-- Placeholder de Foto do Almoço -->
      <g transform="translate(430, 300)">
        <rect x="-60" y="-55" width="120" height="85" rx="16" fill="none" stroke="#FFFFFF" stroke-width="6"/>
        <circle cx="20" cy="-25" r="7" fill="#FFFFFF"/>
        <polyline points="-35,15 -10,-12 15,15" fill="none" stroke="#FFFFFF" stroke-width="6"/>
        <polyline points="5,15 25,-2 40,15" fill="none" stroke="#FFFFFF" stroke-width="6"/>
        <text x="0" y="70" text-anchor="middle" class="font-body" font-size="30" fill="#FFFFFF">Foto do Prato Executivo</text>
        <text x="0" y="102" text-anchor="middle" class="font-legal" font-size="18" fill="#FFFFFF" opacity="0.8">(Slot de alta resolução — substituível)</text>
      </g>
    </g>

    <!-- RODAPÉ AVALIADO (y=1160) -->
    <g transform="translate(110, 1160)">
      <text x="0" y="24" class="font-support" font-size="20" fill="#FFFFFF">Peça seu almoço nos restaurantes locais pelo app</text>
      <text x="0" y="48" class="font-legal" font-size="14" fill="#FFFFFF" opacity="0.85">*Consulte disponibilidade e taxas de entrega de cada restaurante parceiro.</text>
    </g>
  </g>
</svg>`
});

// ══════════════════════════════════════════════════════════════
// TEMPLATE 3: SEXTA DO BURGER (Story 1080x1920)
// Vertical Stories + Foto Protagonista Vertical + Safe Zones de 250px
// ══════════════════════════════════════════════════════════════
templates.push({
  id: 'template_03_sexta_burger_story',
  filename: 'template_03_sexta_burger_story.svg',
  w: 1080,
  h: 1920,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
  ${defsCommon}
  <clipPath id="story-clip-3"><rect width="1080" height="1920" rx="64"/></clipPath>

  <g clip-path="url(#story-clip-3)">
    <rect width="1080" height="1920" fill="#F85400"/>
    <g fill="none" stroke="#FF9000" stroke-width="125" opacity="0.45">
      <path d="M -180 1750 A 440 440 0 0 1 550 1850"/>
      <path d="M 680 1900 A 380 380 0 0 1 1250 1450"/>
    </g>

    <!-- TOPO: DENTRO DA SAFE ZONE (y >= 260) -->
    <g transform="translate(100, 270)">
      <image href="${dataUriLogo}" x="0" y="0" width="220" height="65" preserveAspectRatio="xMidYMid meet"/>
      <g transform="translate(620, 15)">
        <rect width="260" height="38" rx="10" fill="#FFFFFF"/>
        <text x="130" y="24" text-anchor="middle" class="font-support" font-size="14" fill="#F85400">SEXTA-FEIRA É DIA</text>
      </g>
      
      <g transform="translate(0, 110)">
        <text x="0" y="60" class="font-hero" font-size="74" fill="#FFFFFF">SEXTOU COM</text>
        <text x="0" y="132" class="font-hero" font-size="74" fill="#FFFFFF">BURGER!</text>
        <text x="0" y="174" class="font-support" font-size="22" fill="#FFFFFF" opacity="0.95">Os melhores artesanais da cidade chegam quentinhos</text>
      </g>
    </g>

    <!-- POLO CENTRAL: FOTO DOMINANTE VERTICAL (y=620 a 1380, Altura 760px) -->
    <!-- Respiro calculado de 136px abaixo do subtítulo! -->
    <g transform="translate(100, 620)">
      <rect width="880" height="760" rx="56" fill="#434343"/>
      <!-- Ícone e Placeholder de Foto do Burger -->
      <g transform="translate(440, 360)">
        <rect x="-65" y="-55" width="130" height="95" rx="18" fill="none" stroke="#FFFFFF" stroke-width="7"/>
        <circle cx="25" cy="-25" r="8" fill="#FFFFFF"/>
        <polyline points="-40,15 -10,-15 15,15" fill="none" stroke="#FFFFFF" stroke-width="7"/>
        <polyline points="5,15 30,-5 45,15" fill="none" stroke="#FFFFFF" stroke-width="7"/>
        <text x="0" y="80" text-anchor="middle" class="font-body" font-size="34" fill="#FFFFFF">Foto do Burger Artesanal</text>
        <text x="0" y="116" text-anchor="middle" class="font-legal" font-size="20" fill="#FFFFFF" opacity="0.8">(Slot de alta resolução — substituível no Luma)</text>
      </g>

      <!-- BADGE CIRCULAR DO PARCEIRO (x=730, y=650) -->
      <g transform="translate(730, 650)" filter="url(#badge-shadow)">
        <circle cx="0" cy="0" r="85" fill="#FFFFFF"/>
        <circle cx="0" cy="0" r="78" fill="#434343"/>
        <circle cx="0" cy="0" r="68" fill="none" stroke="#FFB900" stroke-width="2.5" stroke-dasharray="6 4"/>
        <text x="0" y="-10" text-anchor="middle" class="font-hero" font-size="22" fill="#FFFFFF">BURGER</text>
        <text x="0" y="18" text-anchor="middle" class="font-hero" font-size="17" fill="#FFB900">PREMIUM</text>
        <text x="0" y="38" text-anchor="middle" class="font-support" font-size="10" fill="#FFFFFF" opacity="0.9">ARTESANAL</text>
      </g>
    </g>

    <!-- POLO BASE: CARD DE OFERTA / CTA (y=1450) -->
    <g transform="translate(100, 1450)" filter="url(#soft-card-shadow)">
      <rect width="880" height="170" rx="36" fill="#FFFFFF"/>
      <g transform="translate(50, 48)">
        <text x="0" y="0" class="font-support" font-size="16" fill="#434343">COMBO DO CHEF</text>
        <text x="0" y="44" class="font-hero" font-size="38" fill="#F85400">BURGER + FRITAS + REFRI</text>
        <text x="0" y="76" class="font-body" font-size="17" fill="#434343">A partir de R$ 34,90 no aplicativo Delivery Much</text>
      </g>
      <!-- Botão Visual CTA -->
      <g transform="translate(680, 50)">
        <rect width="150" height="65" rx="18" fill="#F85400"/>
        <text x="75" y="38" text-anchor="middle" class="font-hero" font-size="18" fill="#FFFFFF">PEDIR</text>
      </g>
    </g>
  </g>
</svg>`
});

// ══════════════════════════════════════════════════════════════
// TEMPLATE 4: ENTREGA GRÁTIS / DIA DA PIZZA (Feed 1080x1350)
// Selo Protagonista Amarelo Ouro (#FFB900) + Moldura Central
// ══════════════════════════════════════════════════════════════
templates.push({
  id: 'template_04_entrega_gratis',
  filename: 'template_04_entrega_gratis.svg',
  w: 1080,
  h: 1350,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="1080" height="1350">
  ${defsCommon}
  <clipPath id="feed-clip-4"><rect width="1080" height="1350" rx="54"/></clipPath>

  <g clip-path="url(#feed-clip-4)">
    <rect width="1080" height="1350" fill="#F85400"/>
    <g fill="none" stroke="#FF9000" stroke-width="115" opacity="0.45">
      <path d="M -150 1280 A 380 380 0 0 1 450 1380"/>
      <path d="M 720 1380 A 340 340 0 0 1 1200 950"/>
    </g>

    <!-- TOPO: SELO PROTAGONISTA FRETE GRÁTIS EM AMARELO OURO (#FFB900) -->
    <g transform="translate(110, 75)">
      <!-- Selo Amarelo Ouro de Alta Urgência -->
      <g transform="translate(0, 0)" filter="url(#badge-shadow)">
        <rect width="250" height="42" rx="12" fill="#FFB900"/>
        <text x="125" y="27" text-anchor="middle" class="font-hero" font-size="18" fill="#434343">ENTREGA GRÁTIS</text>
      </g>

      <g transform="translate(0, 70)">
        <text x="0" y="74" class="font-hero" font-size="76" fill="#FFFFFF">QUINTA DA</text>
        <text x="0" y="148" class="font-hero" font-size="76" fill="#FFFFFF">PIZZA</text>
        <text x="0" y="190" class="font-support" font-size="22" fill="#FFFFFF" opacity="0.95">A taxa de entrega hoje é por nossa conta!</text>
      </g>
    </g>

    <!-- MINI CARD DE REGRA NO TOPO DIREITO -->
    <g transform="translate(710, 75)" filter="url(#soft-card-shadow)">
      <rect width="260" height="175" rx="28" fill="#FFFFFF"/>
      <g transform="translate(130, 45)">
        <text x="0" y="0" text-anchor="middle" class="font-support" font-size="13" fill="#434343">TAXA ZERO</text>
        <text x="0" y="44" text-anchor="middle" class="font-hero" font-size="38" fill="#F85400">R$ 0,00</text>
        <text x="0" y="80" text-anchor="middle" class="font-support" font-size="12" fill="#434343">PEDIDOS ACIMA DE R$ 35</text>
      </g>
    </g>

    <!-- POLO CENTRAL: MOLDURA DE FOTO CLÁSSICA (y=370 a 1040, Altura 670px) -->
    <g transform="translate(110, 370)">
      <!-- Aba circular de ícone -->
      <circle cx="750" cy="50" r="75" fill="#434343"/>
      <rect y="50" width="860" height="620" rx="46" fill="#434343"/>

      <!-- Ícone na aba -->
      <g transform="translate(750, 45)">
        <rect x="-26" y="-20" width="52" height="40" rx="8" fill="none" stroke="#FFFFFF" stroke-width="4.5"/>
        <polyline points="-16,10 -3,-5 10,10" fill="none" stroke="#FFFFFF" stroke-width="4.5"/>
        <polyline points="3,10 13,0 20,10" fill="none" stroke="#FFFFFF" stroke-width="4.5"/>
        <circle cx="10" cy="-8" r="4" fill="#FFFFFF"/>
      </g>

      <!-- Placeholder Central -->
      <g transform="translate(430, 360)">
        <text x="0" y="0" text-anchor="middle" class="font-body" font-size="32" fill="#FFFFFF">Foto da Pizza Especial</text>
        <text x="0" y="34" text-anchor="middle" class="font-legal" font-size="18" fill="#FFFFFF" opacity="0.8">(Slot de alta resolução — substituível no Luma)</text>
      </g>
    </g>

    <!-- RODAPÉ INSTITUCIONAL (y=1160) -->
    <g transform="translate(110, 1160)">
      <image href="${dataUriLogo}" x="0" y="0" width="200" height="58" preserveAspectRatio="xMidYMid meet"/>
      <g transform="translate(860, 22)">
        <text x="0" y="0" text-anchor="end" class="font-support" font-size="18" fill="#FFFFFF">Peça nas pizzarias participantes pelo app</text>
        <text x="0" y="24" text-anchor="end" class="font-legal" font-size="14" fill="#FFFFFF" opacity="0.85">*Promoção válida somente para pedidos realizados hoje.</text>
      </g>
    </g>
  </g>
</svg>`
});

// ══════════════════════════════════════════════════════════════
// TEMPLATE 5: NOVO PARCEIRO NA CIDADE (Feed 1080x1350)
// Foto Panorâmica + Badge Circular Proeminente + Voucher no Rodapé
// ══════════════════════════════════════════════════════════════
templates.push({
  id: 'template_05_novo_parceiro',
  filename: 'template_05_novo_parceiro.svg',
  w: 1080,
  h: 1350,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="1080" height="1350">
  ${defsCommon}
  <clipPath id="feed-clip-5"><rect width="1080" height="1350" rx="54"/></clipPath>

  <g clip-path="url(#feed-clip-5)">
    <rect width="1080" height="1350" fill="#F85400"/>
    <g fill="none" stroke="#FF9000" stroke-width="115" opacity="0.45">
      <path d="M -150 1280 A 380 380 0 0 1 450 1380"/>
      <path d="M 720 1380 A 340 340 0 0 1 1200 950"/>
    </g>

    <!-- TOPO: ANÚNCIO DE NOVIDADE -->
    <g transform="translate(110, 75)">
      <rect width="170" height="28" rx="8" fill="rgba(255, 255, 255, 0.22)"/>
      <text x="85" y="19" text-anchor="middle" class="font-support" font-size="12" fill="#FFFFFF">TEM NOVIDADE NO APP</text>
      <text x="0" y="90" class="font-hero" font-size="74" fill="#FFFFFF">NOVO NA CIDADE</text>
      <text x="0" y="132" class="font-support" font-size="22" fill="#FFFFFF" opacity="0.95">Um dos restaurantes mais pedidos chegou à Delivery Much</text>
    </g>

    <!-- POLO CENTRAL: FOTO PANORÂMICA (y=260 a 860, Altura 600px) -->
    <g transform="translate(110, 260)">
      <rect width="860" height="600" rx="48" fill="#434343"/>
      <g transform="translate(430, 290)">
        <text x="0" y="0" text-anchor="middle" class="font-body" font-size="34" fill="#FFFFFF">Foto da Fachada ou Prato Principal</text>
        <text x="0" y="34" text-anchor="middle" class="font-legal" font-size="20" fill="#FFFFFF" opacity="0.8">(Slot de alta resolução)</text>
      </g>

      <!-- BADGE CIRCULAR PROEMINENTE DO NOVO PARCEIRO (Centralizado em y=600) -->
      <g transform="translate(430, 600)" filter="url(#badge-shadow)">
        <circle cx="0" cy="0" r="95" fill="#FFFFFF"/>
        <circle cx="0" cy="0" r="88" fill="#434343"/>
        <circle cx="0" cy="0" r="76" fill="none" stroke="#FFB900" stroke-width="3" stroke-dasharray="8 5"/>
        <text x="0" y="-12" text-anchor="middle" class="font-hero" font-size="24" fill="#FFFFFF">{{NOME_LOJA}}</text>
        <text x="0" y="20" text-anchor="middle" class="font-hero" font-size="18" fill="#FFB900">AGORA NO APP</text>
        <text x="0" y="42" text-anchor="middle" class="font-support" font-size="11" fill="#FFFFFF" opacity="0.9">ENTREGA EXCLUSIVA</text>
      </g>
    </g>

    <!-- POLO INFERIOR: MINI VOUCHER DE BOAS-VINDAS (y=980 a 1110) -->
    <g transform="translate(110, 980)" filter="url(#soft-card-shadow)">
      <rect width="860" height="130" rx="28" fill="#FFFFFF"/>
      <g transform="translate(50, 44)">
        <text x="0" y="0" class="font-support" font-size="14" fill="#434343">PRIMEIRO PEDIDO NA LOJA?</text>
        <text x="0" y="38" class="font-hero" font-size="34" fill="#F85400">R$ 15 OFF COM O CUPOM BEMVINDO</text>
        <text x="0" y="66" class="font-legal" font-size="13" fill="#434343" opacity="0.8">*Válido apenas para compras na nova loja parceira.</text>
      </g>
    </g>

    <!-- RODAPÉ COM LOGO BRANCA (y=1170) -->
    <g transform="translate(110, 1170)">
      <image href="${dataUriLogo}" x="0" y="0" width="190" height="55" preserveAspectRatio="xMidYMid meet"/>
      <g transform="translate(860, 20)">
        <text x="0" y="0" text-anchor="end" class="font-support" font-size="17" fill="#FFFFFF">Delivery Much · Conectando você ao melhor da sua cidade</text>
      </g>
    </g>
  </g>
</svg>`
});

// ══════════════════════════════════════════════════════════════
// TEMPLATE 6: DOMINGO DOCE / SOBREMESAS (Feed 1080x1350)
// Fundo Laranja Solar #FF9000 + Sorriso em #F85400 + Moldura Soft (rx=72)
// ══════════════════════════════════════════════════════════════
templates.push({
  id: 'template_06_domingo_doce',
  filename: 'template_06_domingo_doce.svg',
  w: 1080,
  h: 1350,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="1080" height="1350">
  ${defsCommon}
  <clipPath id="feed-clip-6"><rect width="1080" height="1350" rx="54"/></clipPath>

  <g clip-path="url(#feed-clip-6)">
    <!-- Fundo Laranja Solar #FF9000 com Sorriso da DM em #F85400 -->
    <rect width="1080" height="1350" fill="#FF9000"/>
    <g fill="none" stroke="#F85400" stroke-width="115" opacity="0.5">
      <path d="M -150 1280 A 380 380 0 0 1 450 1380"/>
      <path d="M 720 1380 A 340 340 0 0 1 1200 950"/>
    </g>

    <!-- TOPO: TÍTULO EM CAIXA NORMAL ELEGANTE -->
    <g transform="translate(110, 80)">
      <rect width="140" height="28" rx="8" fill="#F85400"/>
      <text x="70" y="19" text-anchor="middle" class="font-support" font-size="12" fill="#FFFFFF">DOMINGO DOCE</text>

      <g transform="translate(0, 60)">
        <text x="0" y="60" class="font-hero" font-size="64" fill="#FFFFFF">BATEU AQUELA</text>
        <text x="0" y="128" class="font-hero" font-size="64" fill="#FFFFFF">VONTADE DE DOCE?</text>
        <text x="0" y="170" class="font-support" font-size="22" fill="#FFFFFF">Sobremesas, açaís e bolos das melhores docerias da cidade</text>
      </g>
    </g>

    <!-- POLO CENTRAL: MOLDURA QUADRADA ULTRA SOFT EM #434343 (y=340 a 980) -->
    <g transform="translate(110, 340)">
      <rect width="860" height="640" rx="72" fill="#434343"/>
      <g transform="translate(430, 310)">
        <text x="0" y="0" text-anchor="middle" class="font-body" font-size="34" fill="#FFFFFF">Foto da Sobremesa ou Açaí</text>
        <text x="0" y="34" text-anchor="middle" class="font-legal" font-size="20" fill="#FFFFFF" opacity="0.8">(Slot de alta resolução — substituível)</text>
      </g>

      <!-- CARD BRANCO LATERAL DE PREÇO SOBREPOSTO (x=530, y=470) -->
      <g transform="translate(530, 470)" filter="url(#soft-card-shadow)">
        <rect width="290" height="130" rx="26" fill="#FFFFFF"/>
        <g transform="translate(145, 42)">
          <text x="0" y="0" text-anchor="middle" class="font-support" font-size="13" fill="#434343">OPÇÕES A PARTIR DE</text>
          <text x="0" y="44" text-anchor="middle" class="font-hero" font-size="44" fill="#F85400">R$ 12,90</text>
          <text x="0" y="70" text-anchor="middle" class="font-legal" font-size="12" fill="#434343" opacity="0.8">Peça e receba em minutos</text>
        </g>
      </g>
    </g>

    <!-- RODAPÉ INSTITUCIONAL (y=1160) -->
    <g transform="translate(110, 1160)">
      <image href="${dataUriLogo}" x="0" y="0" width="200" height="58" preserveAspectRatio="xMidYMid meet"/>
      <g transform="translate(860, 22)">
        <text x="0" y="0" text-anchor="end" class="font-support" font-size="18" fill="#FFFFFF">O doce do seu domingo tá no app Delivery Much</text>
        <text x="0" y="24" text-anchor="end" class="font-legal" font-size="14" fill="#FFFFFF" opacity="0.9">*Consulte cardápios e horários de funcionamento.</text>
      </g>
    </g>
  </g>
</svg>`
});

// ══════════════════════════════════════════════════════════════
// TEMPLATE 7: HAPPY HOUR & PORÇÕES (Story 1080x1920)
// Domo Central Rebaixado com Respiro + Selo Dourado
// ══════════════════════════════════════════════════════════════
templates.push({
  id: 'template_07_happy_hour_story',
  filename: 'template_07_happy_hour_story.svg',
  w: 1080,
  h: 1920,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
  ${defsCommon}
  <clipPath id="story-clip-7"><rect width="1080" height="1920" rx="64"/></clipPath>

  <g clip-path="url(#story-clip-7)">
    <rect width="1080" height="1920" fill="#F85400"/>
    <g fill="none" stroke="#FF9000" stroke-width="125" opacity="0.45">
      <path d="M -180 1750 A 440 440 0 0 1 550 1850"/>
      <path d="M 680 1900 A 380 380 0 0 1 1250 1450"/>
    </g>

    <!-- TOPO: ACIMA DA SAFE ZONE DE 250px (y=270 a 480) -->
    <g transform="translate(100, 270)">
      <rect width="140" height="32" rx="8" fill="#FFFFFF"/>
      <text x="70" y="22" text-anchor="middle" class="font-support" font-size="13" fill="#F85400">HAPPY HOUR</text>
      <text x="0" y="90" class="font-hero" font-size="70" fill="#FFFFFF">SEXTOU COM</text>
      <text x="0" y="160" class="font-hero" font-size="70" fill="#FFFFFF">PETISCOS!</text>
      <text x="0" y="202" class="font-support" font-size="22" fill="#FFFFFF" opacity="0.95">Reúna os amigos que a porção tá garantida</text>
    </g>

    <!-- POLO CENTRAL: FOTO DOMINANTE VERTICAL (y=640 a 1380, Altura 740px) -->
    <!-- 168px de respiro livre e limpo abaixo do subtítulo! -->
    <g transform="translate(100, 640)">
      <rect width="880" height="740" rx="56" fill="#434343"/>

      <!-- Placeholder Central -->
      <g transform="translate(440, 360)">
        <text x="0" y="0" text-anchor="middle" class="font-body" font-size="34" fill="#FFFFFF">Foto da Porção com Chopp</text>
        <text x="0" y="34" text-anchor="middle" class="font-legal" font-size="20" fill="#FFFFFF" opacity="0.8">(Slot de alta resolução)</text>
      </g>

      <!-- Selo Flutuante Amarelo Ouro (#FFB900) -->
      <g transform="translate(730, 200)" filter="url(#badge-shadow)">
        <circle cx="0" cy="0" r="76" fill="#FFB900"/>
        <text x="0" y="-6" text-anchor="middle" class="font-hero" font-size="22" fill="#434343">CHOPP &amp;</text>
        <text x="0" y="18" text-anchor="middle" class="font-hero" font-size="17" fill="#F85400">PORÇÕES</text>
        <text x="0" y="36" text-anchor="middle" class="font-support" font-size="10" fill="#434343">COMBOS NO APP</text>
      </g>
    </g>

    <!-- POLO BASE: CARD CTA EM BRANCO (y=1450 a 1630) -->
    <g transform="translate(100, 1450)" filter="url(#soft-card-shadow)">
      <rect width="880" height="175" rx="36" fill="#FFFFFF"/>
      <g transform="translate(50, 50)">
        <text x="0" y="0" class="font-support" font-size="16" fill="#434343">PEÇA PELO DELIVERY MUCH</text>
        <text x="0" y="44" class="font-hero" font-size="38" fill="#F85400">PORÇÕES A PARTIR DE R$ 28,00</text>
        <text x="0" y="76" class="font-body" font-size="17" fill="#434343">Entrega expressa na sua casa para não esfriar</text>
      </g>
    </g>
  </g>
</svg>`
});

// ══════════════════════════════════════════════════════════════
// TEMPLATE 8: BEBIDAS & CONVENIÊNCIA (Feed 1080x1350)
// Faixa de Urgência em #F62900 + Foto de Apoio
// ══════════════════════════════════════════════════════════════
templates.push({
  id: 'template_08_bebidas_conveniencia',
  filename: 'template_08_bebidas_conveniencia.svg',
  w: 1080,
  h: 1350,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="1080" height="1350">
  ${defsCommon}
  <clipPath id="feed-clip-8"><rect width="1080" height="1350" rx="54"/></clipPath>

  <g clip-path="url(#feed-clip-8)">
    <rect width="1080" height="1350" fill="#F85400"/>
    <g fill="none" stroke="#FF9000" stroke-width="115" opacity="0.45">
      <path d="M -150 1280 A 380 380 0 0 1 450 1380"/>
      <path d="M 720 1380 A 340 340 0 0 1 1200 950"/>
    </g>

    <!-- FAIXA DE ALERTA DE URGÊNCIA EM #F62900 NO TOPO -->
    <g transform="translate(110, 75)">
      <rect width="260" height="38" rx="10" fill="#F62900"/>
      <text x="130" y="25" text-anchor="middle" class="font-hero" font-size="16" fill="#FFFFFF">A CERVEJA ACABOU?</text>

      <g transform="translate(0, 60)">
        <text x="0" y="70" class="font-hero" font-size="74" fill="#FFFFFF">GELADA EM</text>
        <text x="0" y="142" class="font-hero" font-size="74" fill="#FFFFFF">MINUTOS!</text>
        <text x="0" y="184" class="font-support" font-size="22" fill="#FFFFFF" opacity="0.95">Bebidas, gelo e carvão sem precisar sair de casa</text>
      </g>
    </g>

    <!-- POLO CENTRAL: MOLDURA DE FOTO EM #434343 (y=360 a 980) -->
    <g transform="translate(110, 360)">
      <rect width="860" height="620" rx="48" fill="#434343"/>
      <g transform="translate(430, 300)">
        <text x="0" y="0" text-anchor="middle" class="font-body" font-size="34" fill="#FFFFFF">Foto das Bebidas Geladas</text>
        <text x="0" y="34" text-anchor="middle" class="font-legal" font-size="20" fill="#FFFFFF" opacity="0.8">(Slot de alta resolução)</text>
      </g>

      <!-- Card Flutuante de Tempo de Entrega Rápida -->
      <g transform="translate(560, 470)" filter="url(#soft-card-shadow)">
        <rect width="260" height="115" rx="24" fill="#FFFFFF"/>
        <g transform="translate(130, 42)">
          <text x="0" y="0" text-anchor="middle" class="font-support" font-size="12" fill="#434343">ENTREGA RÁPIDA</text>
          <text x="0" y="38" text-anchor="middle" class="font-hero" font-size="32" fill="#F85400">EM ATÉ 30 MIN</text>
        </g>
      </g>
    </g>

    <!-- RODAPÉ INSTITUCIONAL (y=1160) -->
    <g transform="translate(110, 1160)">
      <image href="${dataUriLogo}" x="0" y="0" width="200" height="58" preserveAspectRatio="xMidYMid meet"/>
      <g transform="translate(860, 22)">
        <text x="0" y="0" text-anchor="end" class="font-support" font-size="18" fill="#FFFFFF">Peça nas distribuidoras e mercados pelo app</text>
        <text x="0" y="24" text-anchor="end" class="font-legal" font-size="14" fill="#FFFFFF" opacity="0.85">*Beba com moderação. Venda proibida para menores de 18 anos.</text>
      </g>
    </g>
  </g>
</svg>`
});

// ══════════════════════════════════════════════════════════════
// TEMPLATE 9: FESTIVAL DE SUSHI / QUARTA ORIENTAL (Feed 1080x1350)
// Foto em Arco Superior + Desconto Flutuante + Título Desafogado
// ══════════════════════════════════════════════════════════════
templates.push({
  id: 'template_09_quarta_oriental',
  filename: 'template_09_quarta_oriental.svg',
  w: 1080,
  h: 1350,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="1080" height="1350">
  ${defsCommon}
  <clipPath id="feed-clip-9"><rect width="1080" height="1350" rx="54"/></clipPath>

  <g clip-path="url(#feed-clip-9)">
    <rect width="1080" height="1350" fill="#F85400"/>
    <g fill="none" stroke="#FF9000" stroke-width="115" opacity="0.45">
      <path d="M -150 1280 A 380 380 0 0 1 450 1380"/>
      <path d="M 720 1380 A 340 340 0 0 1 1200 950"/>
    </g>

    <!-- TOPO: FOTO EM DOMO (y=75 a 540, Altura calibrada de 465px) -->
    <g transform="translate(110, 75)">
      <path d="M 0 180 A 180 180 0 0 1 860 180 L 860 465 L 0 465 Z" fill="#434343"/>
      <g transform="translate(430, 260)">
        <text x="0" y="0" text-anchor="middle" class="font-body" font-size="34" fill="#FFFFFF">Foto da Barca ou Combinado de Sushi</text>
        <text x="0" y="34" text-anchor="middle" class="font-legal" font-size="20" fill="#FFFFFF" opacity="0.8">(Slot de alta resolução)</text>
      </g>

      <!-- SELO FLUTUANTE AMARELO OURO (#FFB900) NA TRANSIÇÃO -->
      <g transform="translate(720, 420)" filter="url(#badge-shadow)">
        <circle cx="0" cy="0" r="76" fill="#FFB900"/>
        <text x="0" y="-8" text-anchor="middle" class="font-hero" font-size="26" fill="#434343">ATÉ 30%</text>
        <text x="0" y="18" text-anchor="middle" class="font-hero" font-size="20" fill="#F85400">OFF</text>
        <text x="0" y="36" text-anchor="middle" class="font-support" font-size="10" fill="#434343">NO CARDÁPIO</text>
      </g>
    </g>

    <!-- POLO INFERIOR: TÍTULO HERO & DESCRITIVO COM RESPIRO PERFEITO (y=610 a 1050) -->
    <g transform="translate(110, 610)">
      <rect width="180" height="28" rx="8" fill="rgba(255, 255, 255, 0.22)"/>
      <text x="90" y="19" text-anchor="middle" class="font-support" font-size="12" fill="#FFFFFF">TODAS AS QUARTAS</text>

      <g transform="translate(0, 45)">
        <text x="0" y="65" class="font-hero" font-size="74" fill="#FFFFFF">QUARTA</text>
        <text x="0" y="135" class="font-hero" font-size="74" fill="#FFFFFF">ORIENTAL</text>
        <text x="0" y="176" class="font-support" font-size="22" fill="#FFFFFF" opacity="0.95">Combinados especiais e sushis frescos na sua porta</text>
      </g>

      <!-- MINI CARD DE CUPOM (y=255, totalmente desafogado com 79px de ar livre) -->
      <g transform="translate(0, 255)" filter="url(#soft-card-shadow)">
        <rect width="460" height="85" rx="20" fill="#FFFFFF"/>
        <g transform="translate(30, 32)">
          <text x="0" y="0" class="font-support" font-size="12" fill="#434343">CUPOM DA RODADA</text>
          <text x="0" y="32" class="font-hero" font-size="28" fill="#F85400">SUSHIDM</text>
        </g>
        <text x="420" y="50" text-anchor="end" class="font-support" font-size="17" fill="#434343">R$ 10 OFF NO APP</text>
      </g>
    </g>

    <!-- RODAPÉ INSTITUCIONAL (y=1160) -->
    <g transform="translate(110, 1160)">
      <image href="${dataUriLogo}" x="0" y="0" width="200" height="58" preserveAspectRatio="xMidYMid meet"/>
      <g transform="translate(860, 22)">
        <text x="0" y="0" text-anchor="end" class="font-support" font-size="18" fill="#FFFFFF">Peça nos restaurantes orientais pelo app</text>
        <text x="0" y="24" text-anchor="end" class="font-legal" font-size="14" fill="#FFFFFF" opacity="0.85">*Consulte restaurantes participantes e regras do cupom.</text>
      </g>
    </g>
  </g>
</svg>`
});

// ══════════════════════════════════════════════════════════════
// TEMPLATE 10: VALORIZE O COMÉRCIO LOCAL / INSTITUCIONAL (Feed 1080x1350)
// Foco Tipográfico Forte + Selo Orgulho Local em #434343 e #FFB900
// ══════════════════════════════════════════════════════════════
templates.push({
  id: 'template_10_comercio_local',
  filename: 'template_10_comercio_local.svg',
  w: 1080,
  h: 1350,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="1080" height="1350">
  ${defsCommon}
  <clipPath id="feed-clip-10"><rect width="1080" height="1350" rx="54"/></clipPath>

  <g clip-path="url(#feed-clip-10)">
    <rect width="1080" height="1350" fill="#F85400"/>
    <g fill="none" stroke="#FF9000" stroke-width="115" opacity="0.45">
      <path d="M -150 1280 A 380 380 0 0 1 450 1380"/>
      <path d="M 720 1380 A 340 340 0 0 1 1200 950"/>
    </g>

    <!-- TOPO: HERO INSTITUCIONAL DE ORGULHO LOCAL -->
    <g transform="translate(110, 75)">
      <rect width="200" height="28" rx="8" fill="rgba(255, 255, 255, 0.22)"/>
      <text x="100" y="19" text-anchor="middle" class="font-support" font-size="12" fill="#FFFFFF">VALORIZE SUA CIDADE</text>

      <g transform="translate(0, 55)">
        <text x="0" y="70" class="font-hero" font-size="70" fill="#FFFFFF">O SABOR DA</text>
        <text x="0" y="140" class="font-hero" font-size="70" fill="#FFFFFF">NOSSA TERRA</text>
        <text x="0" y="184" class="font-support" font-size="22" fill="#FFFFFF" opacity="0.95">Apoie os restaurantes e empreendedores locais da sua cidade</text>
      </g>
    </g>

    <!-- POLO CENTRAL: MOLDURA PANORÂMICA (y=340 a 960, Altura 620px) -->
    <g transform="translate(110, 340)">
      <rect width="860" height="620" rx="52" fill="#434343"/>
      <g transform="translate(430, 300)">
        <text x="0" y="0" text-anchor="middle" class="font-body" font-size="34" fill="#FFFFFF">Foto dos Restaurantes e Chefs da Cidade</text>
        <text x="0" y="34" text-anchor="middle" class="font-legal" font-size="20" fill="#FFFFFF" opacity="0.8">(Slot de alta resolução — substituível no Luma)</text>
      </g>

      <!-- SELO OFICIAL "ORGULHO LOCAL" EM #434343 E #FFB900 -->
      <g transform="translate(730, 480)" filter="url(#badge-shadow)">
        <circle cx="0" cy="0" r="88" fill="#FFFFFF"/>
        <circle cx="0" cy="0" r="80" fill="#434343"/>
        <circle cx="0" cy="0" r="70" fill="none" stroke="#FFB900" stroke-width="2.5" stroke-dasharray="7 4"/>
        <text x="0" y="-12" text-anchor="middle" class="font-hero" font-size="20" fill="#FFFFFF">ORGULHO</text>
        <text x="0" y="16" text-anchor="middle" class="font-hero" font-size="18" fill="#FFB900">LOCAL</text>
        <text x="0" y="38" text-anchor="middle" class="font-support" font-size="10" fill="#FFFFFF" opacity="0.9">DELIVERY MUCH</text>
      </g>
    </g>

    <!-- RODAPÉ INSTITUCIONAL ELEGANTE (y=1160) -->
    <g transform="translate(110, 1160)">
      <image href="${dataUriLogo}" x="0" y="0" width="200" height="58" preserveAspectRatio="xMidYMid meet"/>
      <g transform="translate(860, 20)">
        <text x="0" y="0" text-anchor="end" class="font-support" font-size="18" fill="#FFFFFF">Mais de 100 cidades valorizando a gastronomia local</text>
        <text x="0" y="24" text-anchor="end" class="font-legal" font-size="14" fill="#FFFFFF" opacity="0.85">Delivery Much · O app de delivery oficial da sua cidade.</text>
      </g>
    </g>
  </g>
</svg>`
});

// 2. Gravar todos os 10 arquivos SVG
const outDir = 'assets/templates';
templates.forEach(t => {
  const filePath = path.join(outDir, t.filename);
  fs.writeFileSync(filePath, t.svg);
  console.log(`Gerado: ${filePath}`);
});

console.log('\\nTodos os 10 templates gerados com sucesso!');
