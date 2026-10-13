const fs = require('fs');

// 1. Carregar logo oficial DM branca em base64
const b64Logo = fs.readFileSync('assets/logos/dm-h-branca.png').toString('base64');
const dataUriLogo = 'data:image/png;base64,' + b64Logo;

// 2. Carregar fonte oficial Realce Black em base64
const realceWoff2 = fs.readFileSync('assets/fonts/realce-black.woff2').toString('base64');
const realceDataUri = 'data:font/woff2;charset=utf-8;base64,' + realceWoff2;

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="1080" height="1350">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500&amp;display=swap');

      /* Fonte Oficial de Impacto da Delivery Much: Realce Black (Nível 1) */
      @font-face {
        font-family: 'Realce';
        src: url('${realceDataUri}') format('woff2');
        font-weight: 900;
        font-style: normal;
        font-display: block;
      }

      /* Escala Tipográfica Estrita de 4 Níveis (Sem Bold) */
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

    <!-- Clip path para o formato Feed 1080x1350 -->
    <clipPath id="feed-clip">
      <rect x="0" y="0" width="1080" height="1350" rx="54" ry="54"/>
    </clipPath>

    <!-- Sombra suave para o card de data -->
    <filter id="soft-card-shadow" x="-10%" y="-10%" width="125%" height="130%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#802000" flood-opacity="0.22"/>
    </filter>

    <!-- Sombra para o badge de entrada franca -->
    <filter id="badge-shadow" x="-15%" y="-15%" width="130%" height="135%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000000" flood-opacity="0.2"/>
    </filter>
  </defs>

  <g clip-path="url(#feed-clip)">
    <!-- ══════════════════════════════════════════════════════════════
         1. FUNDO LARANJA OFICIAL DELIVERY MUCH (#F85400)
         ══════════════════════════════════════════════════════════════ -->
    <rect width="1080" height="1350" fill="#F85400"/>

    <!-- Grafismo do sorriso Delivery Much (#FF9000 sobre #F85400 com opacidade dosada) -->
    <g fill="none" stroke="#FF9000" stroke-width="115" opacity="0.45">
      <path d="M -150 1280 A 380 380 0 0 1 450 1380"/>
      <path d="M 720 1380 A 340 340 0 0 1 1200 950"/>
      <path d="M -80 1020 A 240 240 0 0 1 280 1350" stroke-width="75" opacity="0.30"/>
    </g>

    <!-- ══════════════════════════════════════════════════════════════
         POLO 1: TOPO / CABEÇALHO (y = 70 a 285)
         Respiro calculado até o Polo 2: ~125px de ar livre!
         ══════════════════════════════════════════════════════════════ -->
    <g transform="translate(110, 70)">
      <!-- Micro-tag de Categoria em Roboto Medium -->
      <g transform="translate(0, 0)">
        <rect x="0" y="0" width="160" height="26" rx="8" fill="rgba(255, 255, 255, 0.22)"/>
        <text x="80" y="18" text-anchor="middle" 
              class="font-support" font-size="11" fill="#FFFFFF">
          EVENTO NA CIDADE
        </text>
      </g>

      <!-- Título Hero do Evento em Realce Black (Nível 1) -->
      <!-- Variável: {{evento_titulo}} -->
      <text x="0" y="96" 
            class="font-hero" font-size="82" fill="#FFFFFF">
        FESTIVAL
      </text>
      <text x="0" y="170" 
            class="font-hero" font-size="82" fill="#FFFFFF">
        GASTRONÔMICO
      </text>

      <!-- Subtítulo em Caixa Mista com respiro generoso -->
      <!-- Variável: {{evento_subtitulo}} -->
      <text x="0" y="214" 
            class="font-support" font-size="21" fill="#FFFFFF" opacity="0.95">
        O melhor da nossa cidade reunido
      </text>
    </g>

    <!-- CARD FLUTUANTE DE DATA (TOP-RIGHT EM BRANCO + #F85400) -->
    <!-- Fim em y = 265, deixando mais de 100px de respiro até o topo da moldura -->
    <g transform="translate(690, 70)" filter="url(#soft-card-shadow)">
      <rect x="0" y="0" width="280" height="195" rx="30" fill="#FFFFFF"/>

      <g transform="translate(140, 58)">
        <text x="0" y="0" text-anchor="middle" 
              class="font-support" font-size="14" fill="#434343">
          De Outubro
        </text>
        <!-- Variável: {{evento_dias}} -->
        <text x="0" y="56" text-anchor="middle" 
              class="font-hero" font-size="58" fill="#F85400">
          15 A 18
        </text>
      </g>

      <line x1="30" y1="138" x2="250" y2="138" stroke="#F0F0F0" stroke-width="2"/>

      <text x="140" y="170" text-anchor="middle" 
            class="font-support" font-size="14" fill="#434343">
        Praça Central
      </text>
    </g>

    <!-- ══════════════════════════════════════════════════════════════
         POLO 2: CENTRO / MIOLO (MOLDURA DA FOTO)
         Início do corpo em y = 430, término em y = 1050 (Altura: 620px)
         Distância do Polo 1: 145px livre do título e 165px livre do card!
         Distância do Polo 3 (Rodapé): 110px livre!
         ══════════════════════════════════════════════════════════════ -->
    <g id="slot-foto-container">
      <!-- Shape unificado no cinza neutro oficial da marca (#434343) -->
      <g fill="#434343">
        <!-- Aba de ícone com topo em y = 350 (85px de respiro livre até o card de data) -->
        <circle cx="860" cy="430" r="80"/>
        <rect x="110" y="430" width="860" height="620" rx="48"/>
      </g>

      <!-- Ícone de foto dentro da aba superior direita -->
      <g transform="translate(860, 420)">
        <rect x="-30" y="-23" width="60" height="46" rx="8" 
              fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="-19,12 -3,-5 12,12" 
              fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="3,12 15,1 23,12" 
              fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="12" cy="-9" r="4.5" fill="#FFFFFF"/>
      </g>

      <!-- Placeholder central instrutivo -->
      <g transform="translate(540, 740)">
        <rect x="-60" y="-62" width="120" height="90" rx="16" 
              fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="-38,11 -7,-22 22,11" 
              fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="5,11 29,-13 44,11" 
              fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="22" cy="-31" r="7.5" fill="#FFFFFF"/>

        <text x="0" y="76" text-anchor="middle" 
              class="font-body" font-size="32" fill="#FFFFFF">
          Foto do festival, praça ou pratos do evento
        </text>
        <text x="0" y="108" text-anchor="middle" 
              class="font-legal" font-size="19" fill="#FFFFFF" opacity="0.75">
          (Slot de alta resolução — substituível no Luma)
        </text>
      </g>

      <!-- Selo Esquerdo: ENTRADA FRANCA (y = 395, com 110px de folga do subtítulo) -->
      <g transform="translate(125, 395)" filter="url(#badge-shadow)">
        <rect x="0" y="0" width="250" height="68" rx="18" fill="#FFFFFF"/>
        <rect x="4" y="4" width="242" height="60" rx="14" fill="#F85400"/>
        
        <text x="125" y="29" text-anchor="middle" 
              class="font-hero" font-size="20" fill="#FFFFFF">
          ENTRADA FRANCA
        </text>
        <text x="125" y="47" text-anchor="middle" 
              class="font-support" font-size="11" fill="#FFFFFF" opacity="0.9">
          Shows e Gastronomia
        </text>
      </g>

      <!-- Selo Direito: Badge do Parceiro (Finaliza em y = 1046, perfeitamente embutido na base da moldura) -->
      <g transform="translate(860, 970)" filter="url(#badge-shadow)">
        <circle cx="0" cy="0" r="74" fill="#FFFFFF"/>
        <circle cx="0" cy="0" r="68" fill="#434343"/>
        <circle cx="0" cy="0" r="60" fill="none" stroke="#FFB900" stroke-width="2" stroke-dasharray="6 4"/>
        <text x="0" y="-8" text-anchor="middle" 
              class="font-hero" font-size="19" fill="#FFFFFF">
          PIZZAS
        </text>
        <text x="0" y="15" text-anchor="middle" 
              class="font-hero" font-size="15" fill="#FFB900">
          BORCELLE
        </text>
        <text x="0" y="32" text-anchor="middle" 
              class="font-support" font-size="9" fill="#FFFFFF" opacity="0.9">
          Presença confirmada
        </text>
      </g>
    </g>

    <!-- ══════════════════════════════════════════════════════════════
         POLO 3: BASE / RODAPÉ (y = 1160)
         110px de respiro livre após a moldura da foto!
         ══════════════════════════════════════════════════════════════ -->
    <g transform="translate(110, 1160)">
      <!-- Logo Oficial Delivery Much Branca -->
      <image href="${dataUriLogo}" x="0" y="0" width="210" height="62" preserveAspectRatio="xMidYMid meet" />

      <!-- Chamada In-App + Legal Disclaimer em BRANCO (#FFFFFF) -->
      <g transform="translate(860, 22)">
        <text x="0" y="0" text-anchor="end" 
              class="font-support" font-size="18" fill="#FFFFFF">
          Peça nos restaurantes do evento pelo app
        </text>
        <text x="0" y="24" text-anchor="end" 
              class="font-legal" font-size="14" fill="#FFFFFF" opacity="0.85">
          *Consulte horários e programação completa no aplicativo.
        </text>
      </g>
    </g>
  </g>
</svg>`;

fs.writeFileSync('assets/templates/template_evento_cidade.svg', svgContent);
fs.writeFileSync('C:/Users/ryan/.gemini/antigravity/brain/6fabf459-9048-47b5-be2b-b983c8e9970b/template_evento_cidade.svg', svgContent);
console.log('Template de evento ajustado com sucesso com a regra dos 3 polos e respiros calculados!');
