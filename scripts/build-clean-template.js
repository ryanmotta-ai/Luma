const fs = require('fs');

const b64Logo = fs.readFileSync('assets/logos/dm-h-branca.b64', 'utf8').trim();
const dataUriLogo = 'data:image/png;base64,' + b64Logo;

const realceWoff2 = fs.readFileSync('assets/fonts/realce-black.woff2').toString('base64');
const realceDataUri = 'data:font/woff2;charset=utf-8;base64,' + realceWoff2;

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="1080" height="1350">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700;800;900&amp;display=swap');

      /* Fonte Oficial de Destaque da Delivery Much: Realce Black */
      @font-face {
        font-family: 'Realce';
        src: url('${realceDataUri}') format('woff2');
        font-weight: 900;
        font-style: normal;
        font-display: block;
      }

      .font-realce {
        font-family: 'Realce', 'Impact', sans-serif;
        font-weight: 900;
        letter-spacing: 0.5px;
      }
      .font-roboto-black {
        font-family: 'Roboto', sans-serif;
        font-weight: 900;
        letter-spacing: 0.5px;
      }
      .font-roboto-bold {
        font-family: 'Roboto', sans-serif;
        font-weight: 700;
      }
      .font-roboto-regular {
        font-family: 'Roboto', sans-serif;
        font-weight: 400;
      }
    </style>

    <!-- Clip path para o formato Feed 1080x1350 com cantos arredondados -->
    <clipPath id="feed-clip">
      <rect x="0" y="0" width="1080" height="1350" rx="54" ry="54"/>
    </clipPath>
  </defs>

  <g clip-path="url(#feed-clip)">
    <!-- 1. FUNDO LARANJA DELIVERY MUCH & ARCOS GEOMÉTRICOS TONE-ON-TONE -->
    <rect width="1080" height="1350" fill="#FF4D00"/>

    <!-- Arcos geométricos característicos da DM (tom sobre tom) -->
    <g fill="none" stroke="#E63E00" stroke-width="115" opacity="0.95">
      <path d="M -150 1280 A 380 380 0 0 1 450 1380"/>
      <path d="M 720 1380 A 340 340 0 0 1 1200 950"/>
      <path d="M -80 1020 A 240 240 0 0 1 280 1350" stroke-width="75" opacity="0.75"/>
    </g>

    <!-- 2. CABEÇALHO: TÍTULO DO PRODUTO (REALCE BLACK) + DETALHES (ROBOTO BLACK) -->
    <g transform="translate(120, 160)">
      <!-- Variável: {{produto}} em Realce Black autêntica -->
      <text x="0" y="0" 
            class="font-realce" font-size="112" fill="#FFFFFF">
        PRODUTO
      </text>

      <!-- Variável: {{detalhes}} em Roboto Black autêntica -->
      <text x="0" y="65" 
            class="font-roboto-black" font-size="34" fill="#FFFFFF">
        DETALHES
      </text>
    </g>

    <!-- 3. CARD FLUTUANTE DE PREÇO (CANTO SUPERIOR DIREITO) -->
    <g transform="translate(650, 68)">
      <!-- Card branco clean com cantos arredondados -->
      <rect x="0" y="0" width="310" height="205" rx="36" fill="#FFFFFF"/>

      <!-- Preço Antigo: De / R$ (com tachado em Roboto) -->
      <g transform="translate(155, 78)">
        <text x="0" y="0" text-anchor="middle" 
              class="font-roboto-bold" font-size="28" fill="#0A0A0A">
          R$ 28,00
        </text>
        <line x1="-72" y1="-8" x2="72" y2="-8" stroke="#0A0A0A" stroke-width="3.5" stroke-linecap="round"/>
      </g>

      <!-- Preço Promocional em Realce Black (Laranja DM de Destaque) -->
      <!-- Variável: {{preco}} -->
      <text x="155" y="150" text-anchor="middle" 
            class="font-realce" font-size="52" fill="#FF4D00">
        R$ 22,90
      </text>
    </g>

    <!-- 4. SLOT CENTRAL DA FOTO DO PRODUTO (FORMA COM ABA EMBUTIDA) -->
    <g id="slot-foto-container">
      <!-- Forma unificada cinza (Card base + Aba circular no topo direito) -->
      <g fill="#5A5D61">
        <circle cx="860" cy="445" r="92"/>
        <rect x="110" y="440" width="860" height="680" rx="54"/>
      </g>

      <!-- Ícone de foto dentro da aba superior direita -->
      <g transform="translate(860, 440)">
        <rect x="-34" y="-26" width="68" height="52" rx="10" 
              fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="-22,14 -4,-6 14,14" 
                  fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="4,14 18,2 26,14" 
                  fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="14" cy="-10" r="5" fill="#FFFFFF"/>
      </g>

      <!-- Conteúdo central do placeholder de foto -->
      <g transform="translate(540, 750)">
        <rect x="-65" y="-68" width="130" height="98" rx="18" 
              fill="none" stroke="#FFFFFF" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="-42,12 -8,-24 24,12" 
                  fill="none" stroke="#FFFFFF" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="6,12 32,-14 48,12" 
                  fill="none" stroke="#FFFFFF" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="24" cy="-34" r="8" fill="#FFFFFF"/>

        <text x="0" y="84" text-anchor="middle" 
              class="font-roboto-bold" font-size="36" fill="#FFFFFF" letter-spacing="0.5">
          Use aqui sua foto do produto
        </text>
      </g>

      <!-- 5. SELO OFICIAL DE CAMPANHA (MAIS VENDIDOS DO APP / 25% OFF) -->
      <g transform="translate(120, 395)">
        <!-- Borda externa branca do selo -->
        <rect x="-4" y="-4" width="388" height="94" rx="26" fill="#FFFFFF"/>

        <!-- Corpo do selo: Lado esquerdo Laranja -->
        <rect x="0" y="0" width="380" height="86" rx="22" fill="#FF4D00"/>

        <!-- Texto Esquerdo: MAIS VENDIDOS DO APP -->
        <g transform="translate(20, 24)">
          <rect x="0" y="0" width="56" height="17" rx="4" fill="#FFFFFF"/>
          <text x="28" y="13" text-anchor="middle" 
                class="font-roboto-black" font-size="11" fill="#FF4D00">
            MAIS
          </text>
          <text x="0" y="36" 
                class="font-realce" font-size="28" fill="#FFFFFF">
            VENDIDOS
          </text>
          <text x="0" y="52" 
                class="font-roboto-black" font-size="12" fill="#FFFFFF">
            DO APP
          </text>
        </g>

        <!-- Recorte do Hambúrguer no centro -->
        <g transform="translate(182, 43)">
          <ellipse cx="0" cy="-14" rx="32" ry="16" fill="#D9822B" stroke="#FFFFFF" stroke-width="2"/>
          <circle cx="-10" cy="-18" r="1.5" fill="#FFF5E5"/>
          <circle cx="8" cy="-16" r="1.5" fill="#FFF5E5"/>
          <circle cx="-2" cy="-12" r="1.5" fill="#FFF5E5"/>
          <polygon points="-30,-4 30,-4 15,8 -20,6" fill="#FFB900"/>
          <rect x="-30" y="-2" width="60" height="14" rx="4" fill="#5A2E14"/>
          <ellipse cx="0" cy="14" rx="28" ry="10" fill="#D9822B"/>
        </g>

        <!-- Lado direito: Bloco Dourado (25% OFF ou mais) -->
        <path d="M 260 0 L 358 0 C 370 0, 380 10, 380 22 L 380 64 C 380 76, 370 86, 358 86 L 240 86 Q 265 43 260 0 Z" 
              fill="#FFB900"/>
        <text x="305" y="42" text-anchor="middle" 
              class="font-realce" font-size="36" fill="#FFFFFF">
          25<tspan font-size="22">%</tspan>
        </text>
        <text x="305" y="58" text-anchor="middle" 
              class="font-roboto-black" font-size="13" fill="#FFFFFF" letter-spacing="-0.5">
          OFF
        </text>
        <text x="305" y="72" text-anchor="middle" 
              class="font-roboto-bold" font-size="10" fill="#FFFFFF">
          ou mais
        </text>
      </g>
    </g>

    <!-- 6. RODAPÉ: LOGO DELIVERY MUCH OFICIAL (BRANCA) + LEGAL -->
    <g transform="translate(120, 1220)">
      <!-- Logo Oficial Delivery Much (assets/logos/dm-h-branca.png) -->
      <image href="${dataUriLogo}" x="0" y="0" width="215" height="63" preserveAspectRatio="xMidYMid meet" />

      <!-- Disclaimer Legal à direita em Preto Puro (Roboto Bold) -->
      <text x="840" y="40" text-anchor="end" 
            class="font-roboto-black" font-size="18" fill="#000000" letter-spacing="-0.2">
        Promoção por tempo limitado
      </text>
    </g>
  </g>
</svg>`;

fs.writeFileSync('assets/templates/template_clean_feed.svg', svgContent);
fs.writeFileSync('C:/Users/ryan/.gemini/antigravity/brain/6fabf459-9048-47b5-be2b-b983c8e9970b/template_clean_feed.svg', svgContent);
console.log('Build with authentic Realce Black font completed!');
