const fs = require('fs');
const path = require('path');

// 1. Carregar logo oficial DM branca e fonte Realce Black em base64
const b64Logo = fs.readFileSync('assets/logos/dm-h-branca.png').toString('base64');
const dataUriLogo = 'data:image/png;base64,' + b64Logo;

const realceWoff2 = fs.readFileSync('assets/fonts/realce-black.woff2').toString('base64');
const realceDataUri = 'data:font/woff2;charset=utf-8;base64,' + realceWoff2;

// 2. Carregar o pattern oficial de 49 arcos do Illustrator (pattern.ai)
// Substituindo currentColor por #FF9000 diretamente para NUNCA cair em preto/marrom escuro!
const patternSvgRaw = fs.readFileSync('assets/grafismos/pattern-dm-oficial.svg', 'utf8');
const patternInner = patternSvgRaw
  .replace(/<svg[^>]*>/, '')
  .replace(/<\/svg>/, '')
  .replace(/fill="currentColor"/g, 'fill="#FF9000"')
  .trim();

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
      .font-hero-outline {
        font-family: 'Realce', 'Impact', sans-serif;
        font-weight: 900;
        letter-spacing: 1px;
        fill: none;
        stroke: #FFFFFF;
        stroke-width: 4.5px;
      }
      .font-support {
        font-family: 'Roboto', sans-serif;
        font-weight: 500;
        letter-spacing: 0.6px;
      }
      .font-body {
        font-family: 'Roboto', sans-serif;
        font-weight: 400;
        letter-spacing: 0.2px;
      }
      .font-legal {
        font-family: 'Roboto', sans-serif;
        font-weight: 300;
        letter-spacing: 0.2px;
      }
    </style>

    <!-- Pattern oficial DM de 49 arcos vetoriais em Laranja Solar #FF9000 -->
    <g id="official-dm-pattern">
      ${patternInner}
    </g>

    <!-- Sombras refinadas -->
    <filter id="soft-card-shadow" x="-15%" y="-15%" width="130%" height="135%">
      <feDropShadow dx="0" dy="16" stdDeviation="22" flood-color="#000000" flood-opacity="0.18"/>
    </filter>

    <filter id="badge-shadow" x="-20%" y="-20%" width="140%" height="145%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.22"/>
    </filter>

    <filter id="ticket-shadow" x="-15%" y="-15%" width="130%" height="135%">
      <feDropShadow dx="0" dy="20" stdDeviation="25" flood-color="#000000" flood-opacity="0.2"/>
    </filter>

    <!-- Gradientes de iluminação de foto -->
    <linearGradient id="photo-vignette-bottom" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="65%" stop-color="#000000" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.65"/>
    </linearGradient>

    <linearGradient id="food-placeholder-grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2c1d18"/>
      <stop offset="50%" stop-color="#3d2720"/>
      <stop offset="100%" stop-color="#231510"/>
    </linearGradient>
  </defs>
`;

// Helper para desenhar slot de fotografia sangrada com acabamento profissional
function renderPhotoSlot(x, y, w, h, label, detail, clipId = null, showIcon = true) {
  const clipAttr = clipId ? `clip-path="url(#${clipId})"` : '';
  const cx = x + w / 2;
  const cy = y + h / 2;
  return `
    <g ${clipAttr}>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#food-placeholder-grad)"/>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#photo-vignette-bottom)"/>
      
      ${showIcon ? `
      <!-- Linhas de enquadramento fotográfico e ícone -->
      <g transform="translate(${cx}, ${cy - 20})" opacity="0.65">
        <rect x="-45" y="-36" width="90" height="72" rx="14" fill="none" stroke="#FFFFFF" stroke-width="4"/>
        <circle cx="18" cy="-14" r="6" fill="#FFFFFF"/>
        <polyline points="-28,14 -6,-10 12,8" fill="none" stroke="#FFFFFF" stroke-width="4"/>
        <polyline points="2,14 18,-2 30,12" fill="none" stroke="#FFFFFF" stroke-width="4"/>
      </g>
      <text x="${cx}" y="${cy + 65}" text-anchor="middle" class="font-support" font-size="20" fill="#FFFFFF" opacity="0.95">${label}</text>
      <text x="${cx}" y="${cy + 92}" text-anchor="middle" class="font-legal" font-size="15" fill="#FFFFFF" opacity="0.7">${detail}</text>
      ` : ''}
    </g>
  `;
}

const templates = [];

// ══════════════════════════════════════════════════════════════
// TEMPLATE 1: 100% TIPOGRÁFICO / VOUCHER HERO (Feed 1080x1350)
// SEM FOTO DE COMIDA! Cupom Ticket com picote, desconto agressivo e respiro
// ══════════════════════════════════════════════════════════════
templates.push({
  id: 'template_01_cupom_semana',
  filename: 'template_01_cupom_semana.svg',
  w: 1080,
  h: 1350,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="1080" height="1350">
  ${defsCommon}
  <clipPath id="feed-clip-1"><rect width="1080" height="1350" rx="54"/></clipPath>

  <g clip-path="url(#feed-clip-1)">
    <!-- Fundo Laranja #F85400 com pattern oficial de arcos em #FF9000 vibrante -->
    <rect width="1080" height="1350" fill="#F85400"/>
    <g opacity="0.55" transform="scale(0.85) translate(80, 100)">
      <use href="#official-dm-pattern"/>
    </g>

    <!-- TOPO: BADGE E HEADLINE EM CAIXA MISTA -->
    <g transform="translate(80, 110)">
      <!-- Pill de Destaque Amarelo Ouro #FFB900 -->
      <rect x="0" y="0" width="240" height="48" rx="24" fill="#FFB900"/>
      <text x="120" y="31" text-anchor="middle" class="font-support" font-size="16" fill="#434343">CUPOM DA SEMANA</text>

      <!-- Headline acolhedora com contraste tipográfico -->
      <text x="0" y="105" class="font-support" font-size="34" fill="#FFFFFF">pega este cupom pra você</text>
      <text x="0" y="180" class="font-hero" font-size="76" fill="#FFFFFF">ECONOMIZAR HOJE!</text>
      <text x="0" y="222" class="font-body" font-size="22" fill="#FFFFFF" opacity="0.9">Desconto exclusivo no app Delivery Much da sua cidade</text>
    </g>

    <!-- CENTRO: TICKET DE CUPOM COM PICOTE E SOMBRA PROFUNDA (y=420, w=920, h=420) -->
    <g transform="translate(80, 420)" filter="url(#ticket-shadow)">
      <!-- Base do Bilhete Branco -->
      <rect width="920" height="420" rx="28" fill="#FFFFFF"/>

      <!-- Bloco Lateral Esquerdo Ouro #FFB900 (Largura 300px) -->
      <path d="M 0 28 Q 0 0 28 0 L 300 0 L 300 420 L 28 420 Q 0 420 0 392 Z" fill="#FFB900"/>
      
      <!-- Conteúdo do Bloco de Desconto Esquerdo -->
      <g transform="translate(150, 110)">
        <text x="0" y="20" text-anchor="middle" class="font-hero" font-size="92" fill="#434343">20%</text>
        <text x="0" y="75" text-anchor="middle" class="font-hero" font-size="46" fill="#F85400">OFF</text>
        <text x="0" y="125" text-anchor="middle" class="font-support" font-size="18" fill="#434343">NO SEU PEDIDO</text>
      </g>

      <!-- Linha de Picote / Separação com Círculos recortados -->
      <line x1="300" y1="30" x2="300" y2="390" stroke="#E2E2E2" stroke-width="4" stroke-dasharray="10 8"/>
      <!-- Entalhes circulares superior e inferior do bilhete -->
      <circle cx="300" cy="0" r="22" fill="#F85400"/>
      <circle cx="300" cy="420" r="22" fill="#F85400"/>

      <!-- Bloco Direito: Código e Regras (x=340) -->
      <g transform="translate(340, 70)">
        <text x="0" y="24" class="font-support" font-size="16" fill="#888888">INSIRA O CÓDIGO NO APP:</text>
        
        <!-- Cartão interno com o Código tracejado -->
        <g transform="translate(0, 45)">
          <rect width="520" height="110" rx="18" fill="#FFF6F0" stroke="#F85400" stroke-width="2.5" stroke-dasharray="8 6"/>
          <text x="260" y="72" text-anchor="middle" class="font-hero" font-size="48" fill="#F85400">QUERODELIVERY20</text>
        </g>

        <!-- Regras e Condições -->
        <g transform="translate(0, 205)">
          <circle cx="10" cy="8" r="4" fill="#F85400"/>
          <text x="26" y="14" class="font-body" font-size="18" fill="#555555">Válido para pedidos acima de R$ 45</text>
          
          <circle cx="10" cy="42" r="4" fill="#F85400"/>
          <text x="26" y="48" class="font-body" font-size="18" fill="#555555">Aplicável em todos os restaurantes participantes</text>

          <circle cx="10" cy="76" r="4" fill="#F85400"/>
          <text x="26" y="82" class="font-body" font-size="18" fill="#555555">Válido somente hoje até 23h59</text>
        </g>
      </g>
    </g>

    <!-- INFORMAÇÃO COMPLEMENTAR COM RESPIRO CALCULADO -->
    <g transform="translate(80, 920)">
      <rect width="920" height="96" rx="24" fill="#FFFFFF" fill-opacity="0.15"/>
      <circle cx="56" cy="48" r="24" fill="#FFFFFF"/>
      <text x="56" y="56" text-anchor="middle" class="font-hero" font-size="24" fill="#F85400">%</text>
      <text x="100" y="44" class="font-support" font-size="22" fill="#FFFFFF">Acumula com promoções da loja</text>
      <text x="100" y="70" class="font-body" font-size="16" fill="#FFFFFF" opacity="0.85">O desconto é aplicado automaticamente no carrinho ao inserir o cupom</text>
    </g>

    <!-- RODAPÉ: RESPIRO LIVRE E LOGO OFICIAL DM -->
    <g transform="translate(80, 1140)">
      <text x="0" y="40" class="font-hero" font-size="34" fill="#FFFFFF">Delivery Much</text>
      <text x="0" y="74" class="font-support" font-size="18" fill="#FFFFFF" opacity="0.9">O app de comida da nossa cidade</text>

      <!-- Logo Oficial DM Branca à direita -->
      <image href="${dataUriLogo}" x="660" y="0" width="260" height="90" preserveAspectRatio="xMidYMid meet"/>
    </g>
  </g>
</svg>`
});

// ══════════════════════════════════════════════════════════════
// TEMPLATE 2: SPLIT SUPERIOR 35/65 COM SANGRIA TOTAL (Feed 1080x1350)
// Topo Laranja com Preço Direto + Base 65% Foto Sangrada de ponta a ponta
// ══════════════════════════════════════════════════════════════
templates.push({
  id: 'template_02_almoco_executivo',
  filename: 'template_02_almoco_executivo.svg',
  w: 1080,
  h: 1350,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="1080" height="1350">
  ${defsCommon}
  <clipPath id="feed-clip-2"><rect width="1080" height="1350" rx="54"/></clipPath>
  <clipPath id="bleed-photo-clip">
    <path d="M 0 500 Q 540 450 1080 500 L 1080 1350 L 0 1350 Z"/>
  </clipPath>

  <g clip-path="url(#feed-clip-2)">
    <!-- FUNDO TOPO: Laranja #F85400 com pattern oficial de arcos em #FF9000 -->
    <rect width="1080" height="520" fill="#F85400"/>
    <g opacity="0.5" transform="scale(0.8) translate(50, -40)">
      <use href="#official-dm-pattern"/>
    </g>

    <!-- CONTEÚDO DO TOPO LARANJA (y=80 a 460) -->
    <g transform="translate(80, 90)">
      <!-- Pill Branca de Categoria -->
      <rect x="0" y="0" width="280" height="44" rx="22" fill="#FFFFFF"/>
      <text x="140" y="29" text-anchor="middle" class="font-support" font-size="16" fill="#F85400">MAIS PEDIDOS DA SEMANA</text>

      <!-- Logo Oficial DM no Topo Direito -->
      <image href="${dataUriLogo}" x="660" y="-15" width="260" height="80" preserveAspectRatio="xMidYMid meet"/>

      <!-- Nome do Prato em Realce Black Branco -->
      <text x="0" y="115" class="font-hero" font-size="58" fill="#FFFFFF">Pizza Calabresa Especial</text>
      <text x="0" y="152" class="font-body" font-size="22" fill="#FFFFFF" opacity="0.9">Molho de tomate artesanal, mussarela premium e orégano</text>

      <!-- PREÇO DIRETO NO LARANJA EM BRANCO (Alinhamento rigoroso) -->
      <g transform="translate(0, 240)">
        <!-- Preço De tachado -->
        <text x="0" y="24" class="font-support" font-size="22" fill="#FFFFFF" opacity="0.75">DE R$ 54,90</text>
        <line x1="0" y1="16" x2="135" y2="16" stroke="#FFFFFF" stroke-width="2.5" opacity="0.85"/>

        <!-- Preço Por Gigante sem espaçamento excessivo -->
        <g transform="translate(160, 0)">
          <text x="0" y="26" class="font-support" font-size="24" fill="#FFB900">POR</text>
          <text x="65" y="48" class="font-hero" font-size="78" fill="#FFFFFF">R$ 38</text>
          <text x="245" y="18" class="font-hero" font-size="44" fill="#FFFFFF">,90</text>
        </g>
      </g>
    </g>

    <!-- BASE: FOTO SANGRADA TOTAL (x=0 a 1080, y=470 a 1350) COM CORTE EM ONDA ORGÂNICA -->
    ${renderPhotoSlot(0, 470, 1080, 880, 'Foto Real Sangrada da Pizza', 'Alta resolução • Borda a borda', 'bleed-photo-clip')}

    <!-- SELO DO RESTAURANTE PARCEIRO NA COSTURA (x=150, y=480) -->
    <g transform="translate(150, 480)" filter="url(#badge-shadow)">
      <circle cx="0" cy="0" r="75" fill="#FFFFFF"/>
      <circle cx="0" cy="0" r="68" fill="#FFF5EE"/>
      <circle cx="0" cy="0" r="64" fill="none" stroke="#F85400" stroke-width="2.5" stroke-dasharray="6 4"/>
      
      <!-- Ícone e Nome do Restaurante -->
      <text x="0" y="-12" text-anchor="middle" class="font-support" font-size="14" fill="#F85400">FORNO A LENHA</text>
      <text x="0" y="14" text-anchor="middle" class="font-hero" font-size="22" fill="#434343">Bella Vista</text>
      <text x="0" y="34" text-anchor="middle" class="font-legal" font-size="13" fill="#888888">Pizzaria</text>
    </g>

    <!-- SELO FLUTUANTE DE BENEFÍCIO NA BASE DA FOTO (y=1220) -->
    <g transform="translate(680, 1220)" filter="url(#badge-shadow)">
      <rect width="320" height="64" rx="32" fill="#FFB900"/>
      <text x="160" y="40" text-anchor="middle" class="font-support" font-size="18" fill="#434343">ENTREGA EXPRESSA</text>
    </g>
  </g>
</svg>`
});

// ══════════════════════════════════════════════════════════════
// TEMPLATE 3: STORY 9:16 - SPLIT COM ABA ORGÂNICA SUBINDO (Story 1080x1920)
// Foto Sangrada 60% Topo + Aba Laranja Assimétrica Inferior Devidamente Confinada
// ══════════════════════════════════════════════════════════════
templates.push({
  id: 'template_03_sexta_burger_story',
  filename: 'template_03_sexta_burger_story.svg',
  w: 1080,
  h: 1920,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
  ${defsCommon}
  <clipPath id="story-clip-3"><rect width="1080" height="1920" rx="54"/></clipPath>
  <clipPath id="story-tab-clip">
    <path d="M 0 1040 Q 380 1040 430 1100 L 470 1160 Q 520 1210 600 1210 L 1080 1210 L 1080 1920 L 0 1920 Z"/>
  </clipPath>

  <g clip-path="url(#story-clip-3)">
    <!-- FUNDO GERAL ESCURO DA FOTO (x=0 a 1080, y=0 a 1220) -->
    ${renderPhotoSlot(0, 0, 1080, 1220, 'Foto Hero Sangrada do Burger', 'Alta definição • Iluminação quente')}

    <!-- SELO DE URGÊNCIA NO TOPO DIREITO (Safe Zone y > 280) -->
    <g transform="translate(940, 360)" filter="url(#badge-shadow)">
      <circle cx="0" cy="0" r="70" fill="#F62900"/>
      <circle cx="0" cy="0" r="62" fill="none" stroke="#FFFFFF" stroke-width="2.5"/>
      <text x="0" y="-8" text-anchor="middle" class="font-hero" font-size="28" fill="#FFFFFF">SÓ</text>
      <text x="0" y="24" text-anchor="middle" class="font-hero" font-size="28" fill="#FFFFFF">HOJE</text>
    </g>

    <!-- ABA ORGÂNICA ASSIMÉTRICA SUBINDO NO LADO ESQUERDO (y=1040) COM CLIPPING ESTRITO -->
    <g clip-path="url(#story-tab-clip)">
      <rect width="1080" height="1920" fill="#F85400"/>
      <g opacity="0.45" transform="scale(0.85) translate(40, 1120)">
        <use href="#official-dm-pattern"/>
      </g>
    </g>

    <!-- CONTEÚDO INFERIOR NO BLOCO LARANJA (y=1180 a 1700) -->
    <g transform="translate(90, 1180)">
      <!-- Tag Amarela #FFB900 -->
      <rect x="0" y="0" width="220" height="46" rx="23" fill="#FFB900"/>
      <text x="110" y="30" text-anchor="middle" class="font-support" font-size="16" fill="#434343">SEXTA DO BURGER</text>

      <!-- Nome do Produto -->
      <text x="0" y="100" class="font-hero" font-size="70" fill="#FFFFFF">Monster Bacon Duplo</text>
      <text x="0" y="146" class="font-body" font-size="26" fill="#FFFFFF" opacity="0.95">2x smash 140g, cheddar melt e maionese defumada</text>

      <!-- PREÇO DIRETO NO LARANJA EM BRANCO (Ajustado) -->
      <g transform="translate(0, 240)">
        <text x="0" y="30" class="font-support" font-size="28" fill="#FFFFFF" opacity="0.8">POR APENAS</text>
        <text x="210" y="55" class="font-hero" font-size="94" fill="#FFFFFF">R$ 29</text>
        <text x="430" y="20" class="font-hero" font-size="48" fill="#FFFFFF">,90</text>
      </g>

      <!-- Pill de Acompanhamento Grátis -->
      <g transform="translate(0, 330)">
        <rect width="440" height="60" rx="30" fill="#FFFFFF"/>
        <circle cx="32" cy="30" r="14" fill="#F85400"/>
        <polyline points="26,30 30,34 38,26" fill="none" stroke="#FFFFFF" stroke-width="3"/>
        <text x="65" y="38" class="font-support" font-size="18" fill="#F85400">BATATA CRINKLE INCLUSA</text>
      </g>
    </g>

    <!-- RODAPÉ STORY: RESPEITANDO SAFE ZONE INFERIOR (y > 1700) -->
    <g transform="translate(540, 1750)">
      <image href="${dataUriLogo}" x="-130" y="-30" width="260" height="70" preserveAspectRatio="xMidYMid meet"/>
      <text x="0" y="65" text-anchor="middle" class="font-support" font-size="18" fill="#FFFFFF" opacity="0.9">Peça no app Delivery Much</text>
    </g>
  </g>
</svg>`
});

// ══════════════════════════════════════════════════════════════
// TEMPLATE 4: TIPOGRAFIA DISPLAY HERO (SOLID + OUTLINE) (Feed 1080x1350)
// Campanha Frete Grátis com contraste extremo de texto e card horizontal
// ══════════════════════════════════════════════════════════════
templates.push({
  id: 'template_04_entrega_gratis',
  filename: 'template_04_entrega_gratis.svg',
  w: 1080,
  h: 1350,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="1080" height="1350">
  ${defsCommon}
  <clipPath id="feed-clip-4"><rect width="1080" height="1350" rx="54"/></clipPath>
  <clipPath id="card-photo-half"><path d="M 0 0 L 380 0 L 380 440 L 0 440 Z"/></clipPath>

  <g clip-path="url(#feed-clip-4)">
    <!-- FUNDO LARANJA #F85400 COM ARCOS OFICIAIS EM #FF9000 -->
    <rect width="1080" height="1350" fill="#F85400"/>
    <g opacity="0.5" transform="scale(0.85) translate(80, 80)">
      <use href="#official-dm-pattern"/>
    </g>

    <!-- TOPO: DUPLA TIPOGRAFIA HERO (SÓLIDO + CONTORNO) -->
    <g transform="translate(80, 120)">
      <!-- Tag de Campanha -->
      <rect x="0" y="0" width="260" height="46" rx="23" fill="#FFB900"/>
      <text x="130" y="30" text-anchor="middle" class="font-support" font-size="16" fill="#434343">CAMPANHA ESPECIAL</text>

      <!-- Jogo Tipográfico: ENTREGA (Sólido) + GRÁTIS (Outline) -->
      <text x="0" y="145" class="font-hero" font-size="108" fill="#FFFFFF">ENTREGA</text>
      <text x="0" y="260" class="font-hero-outline" font-size="124">GRÁTIS</text>

      <text x="0" y="315" class="font-body" font-size="24" fill="#FFFFFF" opacity="0.95">Em restaurantes selecionados para você pedir sem taxa</text>
    </g>

    <!-- CENTRO: CARD HORIZONTAL COM FOTO LATERAL (y=490, w=920, h=440) -->
    <g transform="translate(80, 490)" filter="url(#soft-card-shadow)">
      <rect width="920" height="440" rx="32" fill="#FFFFFF"/>

      <!-- Metade Esquerda: Foto Sangrada do Card (w=380, h=440) -->
      <g clip-path="url(#card-photo-half)">
        ${renderPhotoSlot(0, 0, 380, 440, 'Foto do Prato', 'Recorte 1/2 lateral')}
      </g>

      <!-- Metade Direita: Informações e Preço (x=420) -->
      <g transform="translate(420, 50)">
        <rect x="0" y="0" width="180" height="36" rx="18" fill="#FFF5EE"/>
        <text x="90" y="24" text-anchor="middle" class="font-support" font-size="14" fill="#F85400">COMBO FAMÍLIA</text>

        <text x="0" y="90" class="font-hero" font-size="38" fill="#434343">Burger &amp; Batata</text>
        <text x="0" y="130" class="font-body" font-size="18" fill="#666666">2 Burgers Artesanais + Fritas Grande + Refrigerante 2L</text>

        <!-- Preço e Selo no Card -->
        <g transform="translate(0, 220)">
          <text x="0" y="24" class="font-support" font-size="18" fill="#888888">APENAS</text>
          <text x="80" y="38" class="font-hero" font-size="56" fill="#F85400">R$ 59,90</text>
        </g>

        <!-- Badge de Frete Zero dentro do Card -->
        <g transform="translate(0, 290)">
          <rect width="260" height="48" rx="24" fill="#FFB900"/>
          <text x="130" y="31" text-anchor="middle" class="font-support" font-size="15" fill="#434343">TAXA DE ENTREGA: R$ 0</text>
        </g>
      </g>
    </g>

    <!-- BANNER DE RESPIRO INFERIOR E LOGO -->
    <g transform="translate(80, 1020)">
      <rect width="920" height="100" rx="24" fill="#FFFFFF" fill-opacity="0.15"/>
      <circle cx="50" cy="50" r="22" fill="#FFB900"/>
      <text x="50" y="58" text-anchor="middle" class="font-hero" font-size="22" fill="#434343">!</text>
      <text x="90" y="44" class="font-support" font-size="22" fill="#FFFFFF">Válido para pedidos a partir de R$ 35</text>
      <text x="90" y="72" class="font-body" font-size="16" fill="#FFFFFF" opacity="0.85">Confira a lista de lojas participantes no banner do app</text>
    </g>

    <!-- RODAPÉ -->
    <g transform="translate(80, 1190)">
      <text x="0" y="40" class="font-hero" font-size="34" fill="#FFFFFF">Delivery Much</text>
      <text x="0" y="72" class="font-support" font-size="18" fill="#FFFFFF" opacity="0.9">Peça agora e economize no frete</text>
      <image href="${dataUriLogo}" x="660" y="0" width="260" height="80" preserveAspectRatio="xMidYMid meet"/>
    </g>
  </g>
</svg>`
});

// ══════════════════════════════════════════════════════════════
// TEMPLATE 5: SPLIT INFERIOR 60/40 - NOVO PARCEIRO (Feed 1080x1350)
// Topo 60% Foto Sangrada + Base 40% Laranja com Avatar Circular Gigante Confinado
// ══════════════════════════════════════════════════════════════
templates.push({
  id: 'template_05_novo_parceiro',
  filename: 'template_05_novo_parceiro.svg',
  w: 1080,
  h: 1350,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="1080" height="1350">
  ${defsCommon}
  <clipPath id="feed-clip-5"><rect width="1080" height="1350" rx="54"/></clipPath>
  <clipPath id="bottom-wedge-clip"><path d="M 0 740 L 1080 700 L 1080 1350 L 0 1350 Z"/></clipPath>

  <g clip-path="url(#feed-clip-5)">
    <!-- TOPO: FOTO SANGRADA DO RESTAURANTE (x=0 a 1080, y=0 a 740) -->
    ${renderPhotoSlot(0, 0, 1080, 740, 'Foto do Restaurante / Fachada ou Prato', 'Sangria total nos 3 lados')}

    <!-- SELO DE NOVIDADE NO TOPO ESQUERDO -->
    <g transform="translate(80, 80)">
      <rect width="220" height="48" rx="24" fill="#FFB900"/>
      <text x="110" y="31" text-anchor="middle" class="font-support" font-size="16" fill="#434343">NOVO NO APP</text>
    </g>

    <!-- LOGO DM NO TOPO DIREITO -->
    <image href="${dataUriLogo}" x="740" y="65" width="260" height="80" preserveAspectRatio="xMidYMid meet"/>

    <!-- BASE: BLOCO LARANJA #F85400 (y=700 a 1350) COM CLIPPING ESTRITO -->
    <g clip-path="url(#bottom-wedge-clip)">
      <rect width="1080" height="1350" fill="#F85400"/>
      <g opacity="0.5" transform="scale(0.85) translate(80, 780)">
        <use href="#official-dm-pattern"/>
      </g>
    </g>

    <!-- AVATAR CIRCULAR GIGANTE DO NOVO PARCEIRO NA COSTURA (x=180, y=700) -->
    <g transform="translate(180, 700)" filter="url(#badge-shadow)">
      <circle cx="0" cy="0" r="95" fill="#FFFFFF"/>
      <circle cx="0" cy="0" r="88" fill="#434343"/>
      <!-- Placeholder de Logo da Loja -->
      <circle cx="0" cy="-10" r="30" fill="none" stroke="#FFFFFF" stroke-width="3"/>
      <text x="0" y="38" text-anchor="middle" class="font-hero" font-size="18" fill="#FFFFFF">LOGO DA LOJA</text>
    </g>

    <!-- CONTEÚDO DO PARCEIRO NO BLOCO LARANJA (y=840 a 1280) -->
    <g transform="translate(80, 850)">
      <text x="0" y="24" class="font-support" font-size="24" fill="#FFFFFF" opacity="0.9">seja bem-vindo ao app!</text>
      <text x="0" y="85" class="font-hero" font-size="64" fill="#FFFFFF">Cantina Di Napoli</text>
      <text x="0" y="126" class="font-body" font-size="22" fill="#FFFFFF" opacity="0.95">Massas artesanais, molhos especiais e pizzas napolitanas</text>

      <!-- BOTÃO / PILL LARGO BRANCO COM CUPOM DE BOAS-VINDAS -->
      <g transform="translate(0, 180)" filter="url(#badge-shadow)">
        <rect width="920" height="96" rx="28" fill="#FFFFFF"/>
        <text x="50" y="44" class="font-support" font-size="16" fill="#888888">CUPOM DE 1ª COMPRA NA LOJA</text>
        <text x="50" y="78" class="font-hero" font-size="34" fill="#F85400">NAPOLI15 • 15% OFF</text>
        
        <rect x="700" y="22" width="180" height="52" rx="26" fill="#FFB900"/>
        <text x="790" y="55" text-anchor="middle" class="font-support" font-size="16" fill="#434343">APROVEITAR</text>
      </g>

      <!-- Respiro de Rodapé -->
      <text x="0" y="340" class="font-legal" font-size="16" fill="#FFFFFF" opacity="0.8">Disponível agora para entrega em toda a cidade pelo app Delivery Much</text>
    </g>
  </g>
</svg>`
});

// ══════════════════════════════════════════════════════════════
// TEMPLATE 6: JANELA EM DOMO / ARCH FRAME (Feed 1080x1350)
// Festival de Sobremesas com Moldura Clássica em Arco e Respiro
// ══════════════════════════════════════════════════════════════
templates.push({
  id: 'template_06_domingo_doce',
  filename: 'template_06_domingo_doce.svg',
  w: 1080,
  h: 1350,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="1080" height="1350">
  ${defsCommon}
  <clipPath id="feed-clip-6"><rect width="1080" height="1350" rx="54"/></clipPath>
  <clipPath id="arch-frame-clip">
    <path d="M 0 300 A 300 300 0 0 1 600 300 L 600 640 L 0 640 Z"/>
  </clipPath>

  <g clip-path="url(#feed-clip-6)">
    <!-- FUNDO LARANJA #F85400 COM ARCOS EM #FF9000 -->
    <rect width="1080" height="1350" fill="#F85400"/>
    <g opacity="0.5" transform="scale(0.85) translate(80, 100)">
      <use href="#official-dm-pattern"/>
    </g>

    <!-- TOPO: HEADLINE ACOLHEDORA EM CAIXA MISTA -->
    <g transform="translate(80, 100)">
      <rect x="0" y="0" width="220" height="44" rx="22" fill="#FFB900"/>
      <text x="110" y="29" text-anchor="middle" class="font-support" font-size="15" fill="#434343">DOMINGO DOCE</text>

      <text x="0" y="95" class="font-support" font-size="32" fill="#FFFFFF">um docinho pra você</text>
      <text x="0" y="165" class="font-hero" font-size="68" fill="#FFFFFF">FECHAR O DIA BEM!</text>
    </g>

    <!-- CENTRO: MOLDURA EM DOMO COM BORDA BRANCA PERFEITA -->
    <g transform="translate(240, 320)" filter="url(#soft-card-shadow)">
      <!-- Fundo branco de moldura com o mesmo traçado -->
      <path d="M 0 300 A 300 300 0 0 1 600 300 L 600 640 L 0 640 Z" fill="none" stroke="#FFFFFF" stroke-width="18"/>
      
      <!-- Slot de Foto Recortado no Formato de Domo -->
      ${renderPhotoSlot(0, 0, 600, 640, 'Foto da Sobremesa', 'Alta definição • Domo com borda', 'arch-frame-clip')}

      <!-- Selo Flutuante de Preço Ouro #FFB900 -->
      <g transform="translate(560, 560)" filter="url(#badge-shadow)">
        <circle cx="0" cy="0" r="80" fill="#FFB900"/>
        <text x="0" y="-18" text-anchor="middle" class="font-support" font-size="14" fill="#434343">A PARTIR DE</text>
        <text x="0" y="16" text-anchor="middle" class="font-hero" font-size="34" fill="#F85400">R$ 14</text>
        <text x="0" y="44" text-anchor="middle" class="font-hero" font-size="22" fill="#434343">,90</text>
      </g>
    </g>

    <!-- CARD FLUTUANTE DE DETALHE DO PRODUTO (y=1020) -->
    <g transform="translate(180, 1020)" filter="url(#soft-card-shadow)">
      <rect width="720" height="96" rx="28" fill="#FFFFFF"/>
      <text x="40" y="42" class="font-hero" font-size="30" fill="#434343">Torta Holandesa com Chantilly</text>
      <text x="40" y="72" class="font-body" font-size="18" fill="#F85400">Confeitaria Doce Sabor • Entrega em até 35 min</text>
    </g>

    <!-- RODAPÉ: LOGO DM BRANCA E RESPIRO -->
    <g transform="translate(80, 1190)">
      <text x="0" y="38" class="font-hero" font-size="32" fill="#FFFFFF">Delivery Much</text>
      <text x="0" y="68" class="font-support" font-size="18" fill="#FFFFFF" opacity="0.9">Peça sua sobremesa favorita</text>
      <image href="${dataUriLogo}" x="660" y="0" width="260" height="80" preserveAspectRatio="xMidYMid meet"/>
    </g>
  </g>
</svg>`
});

// ══════════════════════════════════════════════════════════════
// TEMPLATE 7: STORY 9:16 - FAIXA PANORÂMICA SANGRADA (Story 1080x1920)
// Happy Hour & Porções com Sangria Lateral Infinita e Topo/Base Laranja
// ══════════════════════════════════════════════════════════════
templates.push({
  id: 'template_07_happy_hour_story',
  filename: 'template_07_happy_hour_story.svg',
  w: 1080,
  h: 1920,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
  ${defsCommon}
  <clipPath id="story-clip-7"><rect width="1080" height="1920" rx="54"/></clipPath>
  <clipPath id="panoramic-photo-clip"><rect width="1080" height="780"/></clipPath>

  <g clip-path="url(#story-clip-7)">
    <!-- FUNDO GERAL LARANJA #F85400 COM ARCOS EM #FF9000 -->
    <rect width="1080" height="1920" fill="#F85400"/>
    <g opacity="0.5" transform="scale(0.9) translate(60, 80)">
      <use href="#official-dm-pattern"/>
    </g>

    <!-- TOPO STORY: RESPEITANDO SAFE ZONE (y=320 a 540) -->
    <g transform="translate(90, 320)">
      <rect x="0" y="0" width="220" height="46" rx="23" fill="#FFB900"/>
      <text x="110" y="30" text-anchor="middle" class="font-support" font-size="16" fill="#434343">HAPPY HOUR DM</text>

      <text x="0" y="105" class="font-hero" font-size="74" fill="#FFFFFF">CHOPP &amp; PETISCOS</text>
      <text x="0" y="152" class="font-body" font-size="26" fill="#FFFFFF" opacity="0.95">Peça sua porção favorita e aproveite a noite</text>
    </g>

    <!-- MEIO: FAIXA PANORÂMICA SANGRADA TOTAL (x=0 a 1080, y=560 a 1340) -->
    <g transform="translate(0, 560)">
      ${renderPhotoSlot(0, 0, 1080, 780, 'Foto Panorâmica dos Petiscos', 'Sangria total de ponta a ponta nas laterais', 'panoramic-photo-clip', true)}

      <!-- SELO FLUTUANTE EM CÍRCULO VERMELHO #F62900 NO CANTO SUPERIOR DIREITO DA FOTO -->
      <g transform="translate(920, 120)" filter="url(#badge-shadow)">
        <circle cx="0" cy="0" r="90" fill="#F62900"/>
        <circle cx="0" cy="0" r="82" fill="none" stroke="#FFFFFF" stroke-width="2.5"/>
        <text x="0" y="-18" text-anchor="middle" class="font-hero" font-size="26" fill="#FFFFFF">CHOPP</text>
        <text x="0" y="18" text-anchor="middle" class="font-hero" font-size="38" fill="#FFB900">EM DOBRO</text>
        <text x="0" y="46" text-anchor="middle" class="font-support" font-size="13" fill="#FFFFFF">NA 1ª PORÇÃO</text>
      </g>
    </g>

    <!-- BASE STORY: CONTEÚDO E SAFE ZONE (y=1380 a 1750) -->
    <g transform="translate(90, 1400)">
      <!-- Card com Estabelecimento Parceiro -->
      <rect width="900" height="110" rx="28" fill="#FFFFFF"/>
      <circle cx="65" cy="55" r="32" fill="#F85400"/>
      <text x="65" y="66" text-anchor="middle" class="font-hero" font-size="28" fill="#FFFFFF">🍻</text>
      <text x="120" y="48" class="font-hero" font-size="32" fill="#434343">Espeto &amp; Cia Bar</text>
      <text x="120" y="80" class="font-body" font-size="18" fill="#888888">Porções a partir de R$ 32,90 • Entrega rápida</text>
    </g>

    <!-- RODAPÉ STORY: LOGO DM OFICIAL BRANCA (y=1720) -->
    <g transform="translate(540, 1720)">
      <image href="${dataUriLogo}" x="-130" y="-30" width="260" height="70" preserveAspectRatio="xMidYMid meet"/>
      <text x="0" y="65" text-anchor="middle" class="font-support" font-size="18" fill="#FFFFFF" opacity="0.9">Peça agora no app Delivery Much</text>
    </g>
  </g>
</svg>`
});

// ══════════════════════════════════════════════════════════════
// TEMPLATE 8: CORTE DIAGONAL DINÂMICO 15° (Feed 1080x1350)
// Bebidas Geladas & Madrugada com Partição Angular
// ══════════════════════════════════════════════════════════════
templates.push({
  id: 'template_08_bebidas_conveniencia',
  filename: 'template_08_bebidas_conveniencia.svg',
  w: 1080,
  h: 1350,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="1080" height="1350">
  ${defsCommon}
  <clipPath id="feed-clip-8"><rect width="1080" height="1350" rx="54"/></clipPath>
  <clipPath id="diagonal-photo-clip">
    <polygon points="0,480 1080,360 1080,1350 0,1350"/>
  </clipPath>

  <g clip-path="url(#feed-clip-8)">
    <!-- FUNDO TOPO: LARANJA #F85400 COM ARCOS EM #FF9000 -->
    <rect width="1080" height="520" fill="#F85400"/>
    <g opacity="0.5" transform="scale(0.85) translate(80, 50)">
      <use href="#official-dm-pattern"/>
    </g>

    <!-- TOPO LARANJA: HEADLINE ENÉRGICA -->
    <g transform="translate(80, 95)">
      <rect x="0" y="0" width="240" height="44" rx="22" fill="#FFB900"/>
      <text x="120" y="29" text-anchor="middle" class="font-support" font-size="15" fill="#434343">CHEGA GELADA</text>

      <image href="${dataUriLogo}" x="660" y="-10" width="260" height="80" preserveAspectRatio="xMidYMid meet"/>

      <text x="0" y="115" class="font-hero" font-size="64" fill="#FFFFFF">BEBIDAS EM MINUTOS</text>
      <text x="0" y="155" class="font-body" font-size="22" fill="#FFFFFF" opacity="0.95">Cervejas, destilados, gelo e petiscos direto na sua porta</text>
    </g>

    <!-- BASE: FOTO SANGRADA COM CORTE DIAGONAL DINÂMICO -->
    ${renderPhotoSlot(0, 360, 1080, 990, 'Foto de Bebidas Geladas e Packs', 'Corte angular dinâmico 15°', 'diagonal-photo-clip')}

    <!-- SELO DESTAQUE NA COSTURA DIAGONAL (x=880, y=420) -->
    <g transform="translate(880, 420)" filter="url(#badge-shadow)">
      <circle cx="0" cy="0" r="75" fill="#F62900"/>
      <circle cx="0" cy="0" r="68" fill="none" stroke="#FFFFFF" stroke-width="2.5"/>
      <text x="0" y="-12" text-anchor="middle" class="font-support" font-size="14" fill="#FFFFFF">ENTREGA ATÉ</text>
      <text x="0" y="20" text-anchor="middle" class="font-hero" font-size="34" fill="#FFB900">02:00</text>
      <text x="0" y="42" text-anchor="middle" class="font-support" font-size="12" fill="#FFFFFF">DA MANHÃ</text>
    </g>

    <!-- PILL HORIZONTAL BRANCA COM OFERTA NA BASE (y=1180) -->
    <g transform="translate(80, 1180)" filter="url(#soft-card-shadow)">
      <rect width="920" height="90" rx="26" fill="#FFFFFF"/>
      <text x="40" y="40" class="font-hero" font-size="28" fill="#434343">Pack Cerveja Long Neck (6 un)</text>
      <text x="40" y="68" class="font-body" font-size="17" fill="#888888">Empório das Bebidas • Gelada e pronta para brindar</text>

      <rect x="740" y="20" width="140" height="50" rx="25" fill="#F85400"/>
      <text x="810" y="52" text-anchor="middle" class="font-hero" font-size="22" fill="#FFFFFF">R$ 29,90</text>
    </g>
  </g>
</svg>`
});

// ══════════════════════════════════════════════════════════════
// TEMPLATE 9: QUARTA ORIENTAL / SUSHI MINIMAL PREMIUM (Feed 1080x1350)
// Prato Flutuante com Sombra Ampla, Preço Direto e Respiro Generoso
// ══════════════════════════════════════════════════════════════
templates.push({
  id: 'template_09_quarta_oriental',
  filename: 'template_09_quarta_oriental.svg',
  w: 1080,
  h: 1350,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="1080" height="1350">
  ${defsCommon}
  <clipPath id="feed-clip-9"><rect width="1080" height="1350" rx="54"/></clipPath>
  <clipPath id="oval-dish-clip">
    <rect width="920" height="520" rx="60"/>
  </clipPath>

  <g clip-path="url(#feed-clip-9)">
    <!-- FUNDO LARANJA #F85400 COM ARCOS SUAVES EM #FF9000 -->
    <rect width="1080" height="1350" fill="#F85400"/>
    <g opacity="0.4" transform="scale(0.85) translate(80, 120)">
      <use href="#official-dm-pattern"/>
    </g>

    <!-- TOPO: HEADLINE REFINADA E RESPIRO -->
    <g transform="translate(80, 110)">
      <rect x="0" y="0" width="220" height="44" rx="22" fill="#FFB900"/>
      <text x="110" y="29" text-anchor="middle" class="font-support" font-size="15" fill="#434343">QUARTA ORIENTAL</text>

      <text x="0" y="105" class="font-hero" font-size="74" fill="#FFFFFF">FESTIVAL DO SUSHI</text>
      <text x="0" y="148" class="font-body" font-size="24" fill="#FFFFFF" opacity="0.95">Combinado Especial do Chef • Salmão fresco selecionado</text>
    </g>

    <!-- CENTRO: BANDEJA/PRATO FLUTUANTE COM BORDA DECORATIVA (y=320, w=920, h=520) -->
    <g transform="translate(80, 320)" filter="url(#soft-card-shadow)">
      <rect width="920" height="520" rx="60" fill="none" stroke="#FFFFFF" stroke-width="8" opacity="0.3"/>
      ${renderPhotoSlot(0, 0, 920, 520, 'Foto do Combinado de Sushi', 'Bandeja panorâmica • Salmão e rolls', 'oval-dish-clip')}

      <!-- Selo Circular de Salmão Fresco no Topo Direito da Foto -->
      <g transform="translate(840, 80)" filter="url(#badge-shadow)">
        <circle cx="0" cy="0" r="55" fill="#FFB900"/>
        <text x="0" y="-8" text-anchor="middle" class="font-support" font-size="13" fill="#434343">PEIXE</text>
        <text x="0" y="14" text-anchor="middle" class="font-hero" font-size="20" fill="#F85400">FRESCO</text>
        <text x="0" y="32" text-anchor="middle" class="font-legal" font-size="11" fill="#434343">DO DIA</text>
      </g>
    </g>

    <!-- PREÇO DIRETO NO LARANJA EM BRANCO (y=920) -->
    <g transform="translate(80, 920)">
      <text x="0" y="30" class="font-support" font-size="24" fill="#FFFFFF" opacity="0.8">COMBINADO 32 PEÇAS POR</text>
      <text x="0" y="110" class="font-hero" font-size="94" fill="#FFFFFF">R$ 59,90</text>
      <text x="0" y="150" class="font-body" font-size="20" fill="#FFFFFF" opacity="0.85">Acompanha wasabi, gengibre artesanal e molho tarê especial</text>
    </g>

    <!-- RODAPÉ LIMPO E LOGO DM -->
    <g transform="translate(80, 1180)">
      <text x="0" y="40" class="font-hero" font-size="34" fill="#FFFFFF">Delivery Much</text>
      <text x="0" y="70" class="font-support" font-size="18" fill="#FFFFFF" opacity="0.9">O melhor da culinária japonesa</text>
      <image href="${dataUriLogo}" x="660" y="0" width="260" height="80" preserveAspectRatio="xMidYMid meet"/>
    </g>
  </g>
</svg>`
});

// ══════════════════════════════════════════════════════════════
// TEMPLATE 10: VITRINE DUPLA / COMÉRCIO LOCAL & HORTIFRUTI (Feed 1080x1350)
// Dois Cards Paralelos com Fotos Sangradas Internas e Ofertas da Feira
// ══════════════════════════════════════════════════════════════
templates.push({
  id: 'template_10_comercio_local',
  filename: 'template_10_comercio_local.svg',
  w: 1080,
  h: 1350,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="1080" height="1350">
  ${defsCommon}
  <clipPath id="feed-clip-10"><rect width="1080" height="1350" rx="54"/></clipPath>
  <clipPath id="col-photo-1"><path d="M 0 0 L 440 0 L 440 320 L 0 320 Z"/></clipPath>
  <clipPath id="col-photo-2"><path d="M 0 0 L 440 0 L 440 320 L 0 320 Z"/></clipPath>

  <g clip-path="url(#feed-clip-10)">
    <!-- FUNDO LARANJA #F85400 COM ARCOS EM #FF9000 -->
    <rect width="1080" height="1350" fill="#F85400"/>
    <g opacity="0.5" transform="scale(0.85) translate(80, 80)">
      <use href="#official-dm-pattern"/>
    </g>

    <!-- TOPO: HEADLINE E LOGO DM -->
    <g transform="translate(80, 100)">
      <rect x="0" y="0" width="240" height="44" rx="22" fill="#FFB900"/>
      <text x="120" y="29" text-anchor="middle" class="font-support" font-size="15" fill="#434343">PRODUTORES LOCAIS</text>

      <image href="${dataUriLogo}" x="660" y="-10" width="260" height="80" preserveAspectRatio="xMidYMid meet"/>

      <text x="0" y="115" class="font-hero" font-size="64" fill="#FFFFFF">FEIRINHA NA SUA PORTA</text>
      <text x="0" y="155" class="font-body" font-size="22" fill="#FFFFFF" opacity="0.95">Frutas, legumes e verduras selecionadas no app Delivery Much</text>
    </g>

    <!-- CENTRO: DUAS COLUNAS / CARDS LADO A LADO (y=330, cada w=440, h=540) -->
    <!-- Card 1: Frutas da Estação (x=80) -->
    <g transform="translate(80, 330)" filter="url(#soft-card-shadow)">
      <rect width="440" height="540" rx="28" fill="#FFFFFF"/>
      <g clip-path="url(#col-photo-1)">
        ${renderPhotoSlot(0, 0, 440, 320, 'Foto de Frutas Frescas', 'Hortifruti selecionado')}
      </g>
      <g transform="translate(30, 350)">
        <text x="0" y="26" class="font-hero" font-size="26" fill="#434343">Frutas Selecionadas</text>
        <text x="0" y="55" class="font-body" font-size="16" fill="#777777">Maçã, banana, laranja e uva</text>

        <g transform="translate(0, 90)">
          <text x="0" y="20" class="font-support" font-size="14" fill="#888888">A PARTIR DE</text>
          <text x="0" y="54" class="font-hero" font-size="36" fill="#F85400">R$ 5,99</text>
          <text x="140" y="50" class="font-support" font-size="16" fill="#888888">/kg</text>
        </g>
      </g>
    </g>

    <!-- Card 2: Verduras e Legumes (x=560) -->
    <g transform="translate(560, 330)" filter="url(#soft-card-shadow)">
      <rect width="440" height="540" rx="28" fill="#FFFFFF"/>
      <g clip-path="url(#col-photo-2)">
        ${renderPhotoSlot(0, 0, 440, 320, 'Foto de Verduras e Folhas', 'Colheita diária fresca')}
      </g>
      <g transform="translate(30, 350)">
        <text x="0" y="26" class="font-hero" font-size="26" fill="#434343">Hortaliças &amp; Folhas</text>
        <text x="0" y="55" class="font-body" font-size="16" fill="#777777">Alface, rúcula, tomate e cenoura</text>

        <g transform="translate(0, 90)">
          <text x="0" y="20" class="font-support" font-size="14" fill="#888888">A PARTIR DE</text>
          <text x="0" y="54" class="font-hero" font-size="36" fill="#F85400">R$ 3,49</text>
          <text x="140" y="50" class="font-support" font-size="16" fill="#888888">/un</text>
        </g>
      </g>
    </g>

    <!-- FAIXA DE BENEFÍCIO INFERIOR (y=920) -->
    <g transform="translate(80, 920)">
      <rect width="920" height="100" rx="24" fill="#FFFFFF" fill-opacity="0.15"/>
      <circle cx="50" cy="50" r="22" fill="#FFB900"/>
      <text x="50" y="58" text-anchor="middle" class="font-hero" font-size="22" fill="#434343">✓</text>
      <text x="90" y="44" class="font-support" font-size="22" fill="#FFFFFF">Entrega agendada ou em até 90 minutos</text>
      <text x="90" y="72" class="font-body" font-size="16" fill="#FFFFFF" opacity="0.85">Apoie os feirantes e mercearias da sua região</text>
    </g>

    <!-- RODAPÉ COM RESPIRO TOTAL -->
    <g transform="translate(80, 1180)">
      <text x="0" y="40" class="font-hero" font-size="34" fill="#FFFFFF">Delivery Much</text>
      <text x="0" y="70" class="font-support" font-size="18" fill="#FFFFFF" opacity="0.9">Sua feira completa na palma da mão</text>
    </g>
  </g>
</svg>`
});

// 3. Gravar todos os 10 arquivos SVG
fs.mkdirSync('assets/templates', { recursive: true });

templates.forEach((t, i) => {
  const filePath = path.join('assets/templates', t.filename);
  fs.writeFileSync(filePath, t.svg);
  console.log(`[${i + 1}/10] Gravado ${t.filename} (${t.w}x${t.h})`);
});

console.log('\nTodos os 10 templates gerados com sucesso!');
