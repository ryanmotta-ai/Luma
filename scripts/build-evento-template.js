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

    <!-- Grafismo de arcos tone-on-tone (#F62900 / #FF9000) -->
    <g fill="none" stroke="#F62900" stroke-width="115" opacity="0.45">
      <path d="M -150 1280 A 380 380 0 0 1 450 1380"/>
      <path d="M 720 1380 A 340 340 0 0 1 1200 950"/>
      <path d="M -80 1020 A 240 240 0 0 1 280 1350" stroke-width="75" opacity="0.35"/>
    </g>

    <!-- ══════════════════════════════════════════════════════════════
         2. CABEÇALHO DO EVENTO (MANCHETE HERO EM REALCE BLACK)
         ══════════════════════════════════════════════════════════════ -->
    <g transform="translate(110, 80)">
      <!-- Micro-tag de Categoria em Roboto Medium -->
      <g transform="translate(0, 0)">
        <rect x="0" y="0" width="170" height="28" rx="8" fill="rgba(255, 255, 255, 0.22)"/>
        <text x="85" y="19" text-anchor="middle" 
              class="font-support" font-size="12" fill="#FFFFFF">
          EVENTO NA CIDADE
        </text>
      </g>

      <!-- Título Hero do Evento em Realce Black (Nível 1) -->
      <!-- Variável: {{evento_titulo}} -->
      <text x="0" y="102" 
            class="font-hero" font-size="88" fill="#FFFFFF">
        FESTIVAL
      </text>
      <text x="0" y="180" 
            class="font-hero" font-size="88" fill="#FFFFFF">
        GASTRONÔMICO
      </text>

      <!-- Subtítulo de Apoio em Caixa Normal (Reflexão: não gritar em caixa alta) -->
      <!-- Variável: {{evento_subtitulo}} -->
      <text x="0" y="228" 
            class="font-support" font-size="22" fill="#FFFFFF" opacity="0.95">
        O melhor da nossa cidade reunido
      </text>
    </g>

    <!-- ══════════════════════════════════════════════════════════════
         3. CARD FLUTUANTE DE DATA (BRANCO + #F85400 PARA CONTRASTE IDEAL)
         ══════════════════════════════════════════════════════════════ -->
    <g transform="translate(680, 80)" filter="url(#soft-card-shadow)">
      <rect x="0" y="0" width="290" height="215" rx="34" fill="#FFFFFF"/>

      <!-- Mês e Dias (No branco usa #F85400, pois #FF9000 fica sem contraste) -->
      <g transform="translate(145, 66)">
        <text x="0" y="0" text-anchor="middle" 
              class="font-support" font-size="14" fill="#434343">
          De Outubro
        </text>
        <!-- Variável: {{evento_dias}} -->
        <text x="0" y="60" text-anchor="middle" 
              class="font-hero" font-size="64" fill="#F85400">
          15 A 18
        </text>
      </g>

      <!-- Linha divisória sutil -->
      <line x1="35" y1="152" x2="255" y2="152" stroke="#F0F0F0" stroke-width="2"/>

      <!-- Local do Evento em Roboto Medium (#434343) -->
      <!-- Variável: {{evento_local}} -->
      <text x="145" y="186" text-anchor="middle" 
            class="font-support" font-size="15" fill="#434343">
        Praça Central
      </text>
    </g>

    <!-- ══════════════════════════════════════════════════════════════
         4. SLOT DA FOTO DO EVENTO (MOLDURA OFICIAL CINZA #434343)
         ══════════════════════════════════════════════════════════════ -->
    <g id="slot-foto-container">
      <!-- Shape unificado no cinza neutro oficial da marca (#434343) -->
      <g fill="#434343">
        <circle cx="860" cy="385" r="92"/>
        <rect x="110" y="380" width="860" height="740" rx="54"/>
      </g>

      <!-- Ícone de foto dentro da aba superior direita -->
      <g transform="translate(860, 380)">
        <rect x="-34" y="-26" width="68" height="52" rx="10" 
              fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="-22,14 -4,-6 14,14" 
              fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="4,14 18,2 26,14" 
              fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="14" cy="-10" r="5" fill="#FFFFFF"/>
      </g>

      <!-- Placeholder central instrutivo em Roboto Regular -->
      <!-- Slot: {{foto_evento}} -->
      <g transform="translate(540, 750)">
        <rect x="-65" y="-68" width="130" height="98" rx="18" 
              fill="none" stroke="#FFFFFF" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="-42,12 -8,-24 24,12" 
              fill="none" stroke="#FFFFFF" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="6,12 32,-14 48,12" 
              fill="none" stroke="#FFFFFF" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="24" cy="-34" r="8" fill="#FFFFFF"/>

        <text x="0" y="84" text-anchor="middle" 
              class="font-body" font-size="34" fill="#FFFFFF">
          Foto do festival, praça ou pratos do evento
        </text>
        <text x="0" y="118" text-anchor="middle" 
              class="font-legal" font-size="20" fill="#FFFFFF" opacity="0.75">
          (Slot de alta resolução — substituível no Luma)
        </text>
      </g>

      <!-- ══════════════════════════════════════════════════════════════
           5. BADGES OFICIAIS FLUTUANTES (ENTRADA GRATUITA & PARCEIRO)
           ══════════════════════════════════════════════════════════════ -->
      <!-- Selo Esquerdo: ENTRADA FRANCA -->
      <g transform="translate(125, 335)" filter="url(#badge-shadow)">
        <rect x="0" y="0" width="260" height="72" rx="20" fill="#FFFFFF"/>
        <rect x="4" y="4" width="252" height="64" rx="16" fill="#F85400"/>
        
        <text x="130" y="31" text-anchor="middle" 
              class="font-hero" font-size="22" fill="#FFFFFF">
          ENTRADA FRANCA
        </text>
        <text x="130" y="50" text-anchor="middle" 
              class="font-support" font-size="11" fill="#FFFFFF" opacity="0.9">
          Shows e Gastronomia
        </text>
      </g>

      <!-- Selo Direito Sobreposto: Badge do Parceiro (#434343 + #FFB900 + #FFFFFF) -->
      <g transform="translate(860, 990)" filter="url(#badge-shadow)">
        <circle cx="0" cy="0" r="76" fill="#FFFFFF"/>
        <circle cx="0" cy="0" r="70" fill="#434343"/>
        <circle cx="0" cy="0" r="62" fill="none" stroke="#FFB900" stroke-width="2" stroke-dasharray="6 4"/>
        <text x="0" y="-8" text-anchor="middle" 
              class="font-hero" font-size="20" fill="#FFFFFF">
          PIZZAS
        </text>
        <text x="0" y="16" text-anchor="middle" 
              class="font-hero" font-size="15" fill="#FFB900">
          BORCELLE
        </text>
        <text x="0" y="34" text-anchor="middle" 
              class="font-support" font-size="9" fill="#FFFFFF" opacity="0.9">
          Presença confirmada
        </text>
      </g>
    </g>

    <!-- ══════════════════════════════════════════════════════════════
         6. RODAPÉ: LOGO DELIVERY MUCH + TEXTO BRANCO SOBRE LARANJA #F85400
         (Regra Rígida: Em cima do #F85400 SEMPRE use BRANCO, NUNCA preto!)
         ══════════════════════════════════════════════════════════════ -->
    <g transform="translate(110, 1160)">
      <!-- Logo Oficial Delivery Much Branca -->
      <image href="${dataUriLogo}" x="0" y="0" width="210" height="62" preserveAspectRatio="xMidYMid meet" />

      <!-- Chamada In-App + Legal Disclaimer em BRANCO (#FFFFFF) e Caixa Normal -->
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
console.log('Template de evento ajustado com sucesso com as cores oficiais e regras de contraste!');
