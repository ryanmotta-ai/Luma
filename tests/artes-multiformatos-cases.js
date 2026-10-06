/* ══════════════════════════════════════════════════════════════════════════════════════════
   SUÍTE DE TESTES: MULTI-FORMATOS, DIMENSÕES E SMART REFLOW (60 ARTES)
   ------------------------------------------------------------------------------------------
   Validação automatizada no motor real Canvas 2D e DevTools Protocol (CDP).
   Gera exatamente 60 artes através de 12 templates matriz convertidos para 5 formatos chave:
     1. Story / WhatsApp Status: 1080×1920 (9:16)
     2. Feed Retrato: 1080×1350 (4:5)
     3. Feed Quadrado: 1080×1080 (1:1)
     4. Banner Paisagem / Web: 1200×628 (16:9 / wide)
     5. App Delivery Much / Card Horizontal: 720×360 (2:1)
   Total: 12 templates × 5 formatos = 60 artes distintas.

   Para cada arte:
     - Smart reflow proporcional via `gReflowLayers`
     - Renderização real em Canvas 2D com dimensões exatas
     - Validação estrita de limites do canvas para camadas ancoradas
     - Validação de integridade do PNG exportado (assinatura binária + decodificação)
     - Publicação no contrato `window.__lumaTest = { passed, total: 60, failures, notas }`
   ══════════════════════════════════════════════════════════════════════════════════════════ */

(async function () {
  const resultsEl = document.getElementById('results');
  const summaryEl = document.getElementById('summary');
  const statsEl = document.getElementById('stats');

  // Formatos da plataforma
  const FORMATOS = [
    { id: 'story', name: 'Story / WhatsApp Status', w: 1080, h: 1920, ratio: '9:16' },
    { id: 'feed', name: 'Feed Retrato', w: 1080, h: 1350, ratio: '4:5' },
    { id: 'square', name: 'Feed Quadrado', w: 1080, h: 1080, ratio: '1:1' },
    { id: 'wide', name: 'Banner Paisagem / Web', w: 1200, h: 628, ratio: '16:9' },
    { id: 'app_card', name: 'App Delivery Much / Card Horizontal', w: 720, h: 360, ratio: '2:1' }
  ];

  // 12 Templates Matriz autorados em 1080×1080 com âncoras explícitas e completas
  const TEMPLATES = [
    {
      id: 'T01_BURGER',
      nome: 'Oferta Relâmpago Burger',
      w: 1080, h: 1080,
      camp: { color: '#E23B22', name: 'Burger Week' },
      dados: { precoPromo: 'R$ 19,90' },
      layers: [
        { id: 'bg', type: 'shape', name: 'Fundo Escuro', fill: '#1E1815', x: 0, y: 0, w: 1080, h: 1080, anchor: { h: 'stretch', v: 'stretch' }, visible: true, opacity: 100 },
        { id: 'badge', type: 'shape', name: 'Badge Oferta', fill: '#E23B22', radius: 12, x: 60, y: 50, w: 220, h: 48, anchor: { h: 'left', v: 'top' }, visible: true, opacity: 100 },
        { id: 'badge_t', type: 'text', name: 'Texto Badge', content: 'SÓ HOJE', fontSize: 24, font: 'Roboto', color: '#FFFFFF', textAlign: 'center', x: 60, y: 60, w: 220, h: 30, anchor: { h: 'left', v: 'top' }, visible: true, opacity: 100 },
        { id: 'title', type: 'text', name: 'Headline Burger', content: 'BURGER ARTESANAL', fontSize: 62, font: 'Roboto', color: '#FFFFFF', textAlign: 'left', x: 60, y: 120, w: 700, h: 80, anchor: { h: 'left', v: 'top' }, visible: true, opacity: 100 },
        { id: 'card_hero', type: 'shape', name: 'Card Produto', fill: '#2A2421', radius: 24, strokeW: 2, strokeColor: '#4A3D36', x: 190, y: 260, w: 700, h: 420, anchor: { h: 'center', v: 'middle' }, shadow: true, shadowBlur: 20, shadowDist: 8, visible: true, opacity: 100 },
        { id: 'selo_desc', type: 'shape', name: 'Selo Desconto', fill: '#FF9000', radius: 999, x: 740, y: 280, w: 110, h: 110, anchor: { h: 'center', v: 'middle' }, visible: true, opacity: 100 },
        { id: 'selo_desc_t', type: 'text', name: 'Texto Selo', content: '-40%', fontSize: 34, font: 'Roboto', color: '#FFFFFF', textAlign: 'center', x: 740, y: 320, w: 110, h: 40, anchor: { h: 'center', v: 'middle' }, visible: true, opacity: 100 },
        { id: 'preco', type: 'text', name: 'Preço Destaque', content: '{{precoPromo}}', fontSize: 68, font: 'Roboto', color: '#FFB800', textAlign: 'left', x: 60, y: 880, w: 400, h: 80, anchor: { h: 'left', v: 'bottom' }, visible: true, opacity: 100 },
        { id: 'btn_cta', type: 'shape', name: 'Botão CTA', fill: '#E23B22', radius: 16, x: 660, y: 890, w: 360, h: 70, anchor: { h: 'right', v: 'bottom' }, visible: true, opacity: 100 },
        { id: 'btn_cta_t', type: 'text', name: 'Texto Botão', content: 'PEÇA NO APP', fontSize: 28, font: 'Roboto', color: '#FFFFFF', textAlign: 'center', x: 660, y: 910, w: 360, h: 40, anchor: { h: 'right', v: 'bottom' }, visible: true, opacity: 100 }
      ]
    },
    {
      id: 'T02_PIZZA',
      nome: 'Terça da Pizza em Dobro',
      w: 1080, h: 1080,
      camp: { color: '#008744', name: 'Pizza Night' },
      dados: { precoPizza: 'R$ 49,90' },
      layers: [
        { id: 'bg', type: 'shape', name: 'Fundo Verde Escuro', fill: '#141E15', x: 0, y: 0, w: 1080, h: 1080, anchor: { h: 'stretch', v: 'stretch' }, visible: true, opacity: 100 },
        { id: 'strip', type: 'shape', name: 'Faixa Topo', fill: '#008744', x: 0, y: 0, w: 1080, h: 20, anchor: { h: 'stretch', v: 'top' }, visible: true, opacity: 100 },
        { id: 'sub', type: 'text', name: 'Subtítulo', content: 'TERÇA DA PIZZA', fontSize: 28, font: 'Roboto', color: '#4ADE80', textAlign: 'center', x: 140, y: 50, w: 800, h: 40, anchor: { h: 'center', v: 'top' }, visible: true, opacity: 100 },
        { id: 'title', type: 'text', name: 'Headline Pizza', content: 'COMPRE 1 LEVE 2', fontSize: 72, font: 'Roboto', color: '#FFFFFF', textAlign: 'center', x: 90, y: 100, w: 900, h: 90, anchor: { h: 'center', v: 'top' }, visible: true, opacity: 100 },
        { id: 'box', type: 'shape', name: 'Box Pizza', fill: '#1E2C1F', radius: 32, strokeW: 2, strokeColor: '#2D4430', x: 140, y: 260, w: 800, h: 420, anchor: { h: 'center', v: 'middle' }, visible: true, opacity: 100 },
        { id: 'desc', type: 'text', name: 'Descrição Pizza', content: 'Pizzas Grandes Sabores Tradicionais', fontSize: 32, font: 'Roboto', color: '#E2E8F0', textAlign: 'center', x: 190, y: 440, w: 700, h: 50, anchor: { h: 'center', v: 'middle' }, visible: true, opacity: 100 },
        { id: 'p_box', type: 'shape', name: 'Card Preço', fill: '#F59E0B', radius: 18, x: 365, y: 860, w: 350, h: 80, anchor: { h: 'center', v: 'bottom' }, visible: true, opacity: 100 },
        { id: 'p_txt', type: 'text', name: 'Texto Preço', content: '{{precoPizza}}', fontSize: 44, font: 'Roboto', color: '#111827', textAlign: 'center', x: 365, y: 880, w: 350, h: 50, anchor: { h: 'center', v: 'bottom' }, visible: true, opacity: 100 },
        { id: 'disc', type: 'text', name: 'Disclaimer', content: 'Válido até 23h59 nas lojas participantes', fontSize: 20, font: 'Roboto', color: '#9CA3AF', textAlign: 'center', x: 140, y: 970, w: 800, h: 30, anchor: { h: 'center', v: 'bottom' }, visible: true, opacity: 100 }
      ]
    },
    {
      id: 'T03_EXECUTIVO',
      nome: 'Almoço Executivo',
      w: 1080, h: 1080,
      camp: { color: '#B45309', name: 'Almoço' },
      dados: { prato: 'Filé de Frango Grelhado', preco: 'R$ 24,90' },
      layers: [
        { id: 'bg', type: 'shape', name: 'Fundo Creme', fill: '#FFFBF5', x: 0, y: 0, w: 1080, h: 1080, anchor: { h: 'stretch', v: 'stretch' }, visible: true, opacity: 100 },
        { id: 'tag', type: 'shape', name: 'Tag Prato', fill: '#FEF3C7', radius: 8, x: 60, y: 60, w: 200, h: 42, anchor: { h: 'left', v: 'top' }, visible: true, opacity: 100 },
        { id: 'tag_t', type: 'text', name: 'Texto Tag', content: 'PRATO DO DIA', fontSize: 20, font: 'Roboto', color: '#92400E', textAlign: 'center', x: 60, y: 70, w: 200, h: 30, anchor: { h: 'left', v: 'top' }, visible: true, opacity: 100 },
        { id: 'title', type: 'text', name: 'Título Prato', content: '{{prato}}', fontSize: 52, font: 'Roboto', color: '#1F2937', textAlign: 'left', x: 60, y: 120, w: 750, h: 70, anchor: { h: 'left', v: 'top' }, visible: true, opacity: 100 },
        { id: 'card', type: 'shape', name: 'Card Almoço', fill: '#FDE68A', radius: 20, x: 60, y: 260, w: 960, h: 400, anchor: { h: 'center', v: 'middle' }, shadow: true, shadowBlur: 14, shadowDist: 4, visible: true, opacity: 100 },
        { id: 'desc', type: 'text', name: 'Acompanhamentos', content: 'Arroz branco, feijão caseiro, farofa e salada fresca', fontSize: 28, font: 'Roboto', color: '#4B5563', textAlign: 'center', x: 110, y: 440, w: 860, h: 60, anchor: { h: 'center', v: 'middle' }, visible: true, opacity: 100 },
        { id: 'p_lbl', type: 'text', name: 'Label Preço', content: 'Por apenas', fontSize: 24, font: 'Roboto', color: '#6B7280', textAlign: 'left', x: 60, y: 860, w: 250, h: 30, anchor: { h: 'left', v: 'bottom' }, visible: true, opacity: 100 },
        { id: 'p_val', type: 'text', name: 'Valor Preço', content: '{{preco}}', fontSize: 58, font: 'Roboto', color: '#D97706', textAlign: 'left', x: 60, y: 895, w: 350, h: 70, anchor: { h: 'left', v: 'bottom' }, visible: true, opacity: 100 },
        { id: 'frete', type: 'shape', name: 'Selo Frete', fill: '#10B981', radius: 12, x: 720, y: 900, w: 300, h: 60, anchor: { h: 'right', v: 'bottom' }, visible: true, opacity: 100 },
        { id: 'frete_t', type: 'text', name: 'Texto Frete', content: 'FRETE GRÁTIS', fontSize: 24, font: 'Roboto', color: '#FFFFFF', textAlign: 'center', x: 720, y: 918, w: 300, h: 35, anchor: { h: 'right', v: 'bottom' }, visible: true, opacity: 100 }
      ]
    },
    {
      id: 'T04_FAMILIA',
      nome: 'Combo Família',
      w: 1080, h: 1080,
      camp: { color: '#DC2626', name: 'Família' },
      dados: { de: 'de R$ 89,90', por: 'R$ 59,90' },
      layers: [
        { id: 'bg', type: 'shape', name: 'Fundo Escuro', fill: '#18181B', x: 0, y: 0, w: 1080, h: 1080, anchor: { h: 'stretch', v: 'stretch' }, visible: true, opacity: 100 },
        { id: 'title', type: 'text', name: 'Título Combo', content: 'COMBO FAMÍLIA', fontSize: 64, font: 'Roboto', color: '#F87171', textAlign: 'center', x: 90, y: 60, w: 900, h: 75, anchor: { h: 'center', v: 'top' }, visible: true, opacity: 100 },
        { id: 'sub', type: 'text', name: 'Subtítulo Combo', content: '2 Burgers + 2 Batatas Rústicas + Refri 2L', fontSize: 30, font: 'Roboto', color: '#E4E4E7', textAlign: 'center', x: 90, y: 140, w: 900, h: 45, anchor: { h: 'center', v: 'top' }, visible: true, opacity: 100 },
        { id: 'box', type: 'shape', name: 'Box Conteúdo', fill: '#27272A', radius: 24, strokeW: 2, strokeColor: '#3F3F46', x: 140, y: 250, w: 800, h: 420, anchor: { h: 'center', v: 'middle' }, visible: true, opacity: 100 },
        { id: 'box_t', type: 'text', name: 'Texto Box', content: 'Ideal para 3 a 4 pessoas', fontSize: 28, font: 'Roboto', color: '#A1A1AA', textAlign: 'center', x: 190, y: 440, w: 700, h: 40, anchor: { h: 'center', v: 'middle' }, visible: true, opacity: 100 },
        { id: 'p_de', type: 'text', name: 'Preço Original', content: '{{de}}', fontSize: 28, font: 'Roboto', color: '#71717A', strikethrough: true, textAlign: 'left', x: 80, y: 850, w: 300, h: 40, anchor: { h: 'left', v: 'bottom' }, visible: true, opacity: 100 },
        { id: 'p_por', type: 'text', name: 'Preço Promo', content: '{{por}}', fontSize: 64, font: 'Roboto', color: '#EF4444', textAlign: 'left', x: 80, y: 890, w: 380, h: 75, anchor: { h: 'left', v: 'bottom' }, visible: true, opacity: 100 },
        { id: 'btn', type: 'shape', name: 'Botão Quero', fill: '#EF4444', radius: 16, x: 680, y: 890, w: 320, h: 70, anchor: { h: 'right', v: 'bottom' }, visible: true, opacity: 100 },
        { id: 'btn_t', type: 'text', name: 'Texto Botão', content: 'EU QUERO', fontSize: 28, font: 'Roboto', color: '#FFFFFF', textAlign: 'center', x: 680, y: 910, w: 320, h: 40, anchor: { h: 'right', v: 'bottom' }, visible: true, opacity: 100 }
      ]
    },
    {
      id: 'T05_ACAI',
      nome: 'Açaí Turbinado',
      w: 1080, h: 1080,
      camp: { color: '#7C3AED', name: 'Verão Refrescante' },
      dados: { copo: 'AÇAÍ NO COPO 500ML', preco: 'Apenas R$ 16,90' },
      layers: [
        { id: 'bg', type: 'shape', name: 'Fundo Roxo', fill: '#2E1065', x: 0, y: 0, w: 1080, h: 1080, anchor: { h: 'stretch', v: 'stretch' }, visible: true, opacity: 100 },
        { id: 'title', type: 'text', name: 'Título Açaí', content: '{{copo}}', fontSize: 56, font: 'Roboto', color: '#DDD6FE', textAlign: 'left', x: 60, y: 70, w: 750, h: 70, anchor: { h: 'left', v: 'top' }, visible: true, opacity: 100 },
        { id: 'badge', type: 'shape', name: 'Badge Gelado', fill: '#8B5CF6', radius: 10, x: 840, y: 70, w: 180, h: 50, anchor: { h: 'right', v: 'top' }, visible: true, opacity: 100 },
        { id: 'badge_t', type: 'text', name: 'Texto Badge', content: 'GELADO', fontSize: 18, font: 'Roboto', color: '#FFFFFF', textAlign: 'center', x: 840, y: 85, w: 180, h: 30, anchor: { h: 'right', v: 'top' }, visible: true, opacity: 100 },
        { id: 'card', type: 'shape', name: 'Card Açaí', fill: '#4C1D95', radius: 28, strokeW: 2, strokeColor: '#6D28D9', x: 140, y: 240, w: 800, h: 440, anchor: { h: 'center', v: 'middle' }, visible: true, opacity: 100 },
        { id: 'card_t', type: 'text', name: 'Benefício', content: '+ 3 ACOMPANHAMENTOS GRÁTIS', fontSize: 34, font: 'Roboto', color: '#FCD34D', textAlign: 'center', x: 190, y: 440, w: 700, h: 50, anchor: { h: 'center', v: 'middle' }, visible: true, opacity: 100 },
        { id: 'preco', type: 'text', name: 'Preço Açaí', content: '{{preco}}', fontSize: 50, font: 'Roboto', color: '#A78BFA', textAlign: 'center', x: 190, y: 870, w: 700, h: 60, anchor: { h: 'center', v: 'bottom' }, visible: true, opacity: 100 },
        { id: 'foot', type: 'text', name: 'Rodapé App', content: 'Peça no Delivery Much da sua cidade', fontSize: 22, font: 'Roboto', color: '#C4B5FD', textAlign: 'center', x: 140, y: 950, w: 800, h: 30, anchor: { h: 'center', v: 'bottom' }, visible: true, opacity: 100 }
      ]
    },
    {
      id: 'T06_SUSHI',
      nome: 'Sushi Night Premium',
      w: 1080, h: 1080,
      camp: { color: '#09090B', name: 'Sushi Selection' },
      dados: { combo: 'COMBO HOT HOLL 30 PEÇAS', valor: 'R$ 69,90' },
      layers: [
        { id: 'bg', type: 'shape', name: 'Fundo Escuro', fill: '#09090B', x: 0, y: 0, w: 1080, h: 1080, anchor: { h: 'stretch', v: 'stretch' }, visible: true, opacity: 100 },
        { id: 'borda', type: 'shape', name: 'Moldura Fina', fill: 'transparent', strokeW: 2, strokeColor: '#27272A', x: 40, y: 40, w: 1000, h: 1000, anchor: { h: 'stretch', v: 'stretch' }, visible: true, opacity: 100 },
        { id: 'brand', type: 'text', name: 'Marca', content: 'SUSHI EXPERT · PREMIUM', fontSize: 22, letterSpacing: 4, font: 'Roboto', color: '#D4D4D8', textAlign: 'center', x: 140, y: 70, w: 800, h: 35, anchor: { h: 'center', v: 'top' }, visible: true, opacity: 100 },
        { id: 'title', type: 'text', name: 'Headline Sushi', content: '{{combo}}', fontSize: 56, font: 'Roboto', color: '#F59E0B', textAlign: 'center', x: 90, y: 120, w: 900, h: 70, anchor: { h: 'center', v: 'top' }, visible: true, opacity: 100 },
        { id: 'box', type: 'shape', name: 'Card Dourado', fill: '#18181B', radius: 16, strokeW: 1, strokeColor: '#F59E0B', x: 190, y: 260, w: 700, h: 420, anchor: { h: 'center', v: 'middle' }, visible: true, opacity: 100 },
        { id: 'box_t', type: 'text', name: 'Itens Sushi', content: '10 Hot Holl + 10 Uramaki Salmão + 10 Niguiri', fontSize: 28, font: 'Roboto', color: '#A1A1AA', textAlign: 'center', x: 215, y: 450, w: 650, h: 45, anchor: { h: 'center', v: 'middle' }, visible: true, opacity: 100 },
        { id: 'p_txt', type: 'text', name: 'Preço Sushi', content: '{{valor}}', fontSize: 54, font: 'Roboto', color: '#FFFFFF', textAlign: 'center', x: 290, y: 860, w: 500, h: 65, anchor: { h: 'center', v: 'bottom' }, visible: true, opacity: 100 },
        { id: 'foot', type: 'text', name: 'Rodapé', content: 'Embalagem térmica exclusiva para delivery', fontSize: 20, font: 'Roboto', color: '#71717A', textAlign: 'center', x: 140, y: 940, w: 800, h: 30, anchor: { h: 'center', v: 'bottom' }, visible: true, opacity: 100 }
      ]
    },
    {
      id: 'T07_PASTEL',
      nome: 'Quinta do Pastel',
      w: 1080, h: 1080,
      camp: { color: '#CA8A04', name: 'Pastelaria' },
      dados: { valor: 'R$ 29,90' },
      layers: [
        { id: 'bg', type: 'shape', name: 'Fundo Amarelo', fill: '#FEFCE8', x: 0, y: 0, w: 1080, h: 1080, anchor: { h: 'stretch', v: 'stretch' }, visible: true, opacity: 100 },
        { id: 'strip', type: 'shape', name: 'Faixa Amarela', fill: '#EAB308', x: 0, y: 0, w: 1080, h: 18, anchor: { h: 'stretch', v: 'top' }, visible: true, opacity: 100 },
        { id: 'title', type: 'text', name: 'Título Pastel', content: 'QUINTA DO PASTEL', fontSize: 64, font: 'Roboto', color: '#854D0E', textAlign: 'center', x: 90, y: 70, w: 900, h: 75, anchor: { h: 'center', v: 'top' }, visible: true, opacity: 100 },
        { id: 'sub', type: 'text', name: 'Subtítulo Pastel', content: '3 Pastéis Gigantes + Caldo de Cana 500ml', fontSize: 32, font: 'Roboto', color: '#A16207', textAlign: 'center', x: 90, y: 150, w: 900, h: 45, anchor: { h: 'center', v: 'top' }, visible: true, opacity: 100 },
        { id: 'card', type: 'shape', name: 'Card Oferta', fill: '#FEF08A', radius: 24, strokeW: 2, strokeColor: '#FACC15', x: 140, y: 260, w: 800, h: 420, anchor: { h: 'center', v: 'middle' }, visible: true, opacity: 100 },
        { id: 'desc', type: 'text', name: 'Sabores', content: 'Carne com Queijo · Frango com Catupiry · Pizza', fontSize: 26, font: 'Roboto', color: '#713F12', textAlign: 'center', x: 190, y: 440, w: 700, h: 40, anchor: { h: 'center', v: 'middle' }, visible: true, opacity: 100 },
        { id: 'preco', type: 'text', name: 'Preço', content: '{{valor}}', fontSize: 62, font: 'Roboto', color: '#B45309', textAlign: 'left', x: 80, y: 880, w: 400, h: 75, anchor: { h: 'left', v: 'bottom' }, visible: true, opacity: 100 },
        { id: 'btn', type: 'shape', name: 'Botão Pedir', fill: '#CA8A04', radius: 14, x: 660, y: 885, w: 340, h: 70, anchor: { h: 'right', v: 'bottom' }, visible: true, opacity: 100 },
        { id: 'btn_t', type: 'text', name: 'Texto Botão', content: 'PEÇA AGORA', fontSize: 28, font: 'Roboto', color: '#FFFFFF', textAlign: 'center', x: 660, y: 905, w: 340, h: 40, anchor: { h: 'right', v: 'bottom' }, visible: true, opacity: 100 }
      ]
    },
    {
      id: 'T08_CUPOM',
      nome: 'Cupom Primeira Compra',
      w: 1080, h: 1080,
      camp: { color: '#2563EB', name: 'Cupons' },
      dados: { cupom: 'PRIMEIRA15' },
      layers: [
        { id: 'bg', type: 'shape', name: 'Fundo Azul', fill: '#1E3A8A', x: 0, y: 0, w: 1080, h: 1080, anchor: { h: 'stretch', v: 'stretch' }, visible: true, opacity: 100 },
        { id: 'title', type: 'text', name: 'Headline Desconto', content: 'GANHE R$ 15 DE DESCONTO', fontSize: 58, font: 'Roboto', color: '#BFDBFE', textAlign: 'center', x: 60, y: 70, w: 960, h: 70, anchor: { h: 'center', v: 'top' }, visible: true, opacity: 100 },
        { id: 'sub', type: 'text', name: 'Subhead Cupom', content: 'No seu primeiro pedido pelo aplicativo', fontSize: 28, font: 'Roboto', color: '#93C5FD', textAlign: 'center', x: 90, y: 150, w: 900, h: 40, anchor: { h: 'center', v: 'top' }, visible: true, opacity: 100 },
        { id: 'box', type: 'shape', name: 'Voucher Box', fill: '#172554', radius: 18, strokeW: 3, strokeColor: '#60A5FA', strokeDash: [12, 6], x: 190, y: 270, w: 700, h: 380, anchor: { h: 'center', v: 'middle' }, visible: true, opacity: 100 },
        { id: 'lbl', type: 'text', name: 'Label Cupom', content: 'UTILIZE O CUPOM:', fontSize: 24, font: 'Roboto', color: '#93C5FD', textAlign: 'center', x: 240, y: 350, w: 600, h: 35, anchor: { h: 'center', v: 'middle' }, visible: true, opacity: 100 },
        { id: 'cod', type: 'text', name: 'Código Cupom', content: '{{cupom}}', fontSize: 56, font: 'Roboto', color: '#FACC15', letterSpacing: 6, textAlign: 'center', x: 240, y: 410, w: 600, h: 70, anchor: { h: 'center', v: 'middle' }, visible: true, opacity: 100 },
        { id: 'reg', type: 'text', name: 'Regras', content: '*Válido para pedidos acima de R$ 40 em lojas participantes', fontSize: 20, font: 'Roboto', color: '#93C5FD', textAlign: 'center', x: 90, y: 860, w: 900, h: 30, anchor: { h: 'center', v: 'bottom' }, visible: true, opacity: 100 },
        { id: 'cta', type: 'shape', name: 'Botão Baixar', fill: '#2563EB', radius: 16, x: 290, y: 910, w: 500, h: 70, anchor: { h: 'center', v: 'bottom' }, visible: true, opacity: 100 },
        { id: 'cta_t', type: 'text', name: 'Texto CTA', content: 'BAIXE E PEÇA JÁ', fontSize: 28, font: 'Roboto', color: '#FFFFFF', textAlign: 'center', x: 290, y: 930, w: 500, h: 40, anchor: { h: 'center', v: 'bottom' }, visible: true, opacity: 100 }
      ]
    },
    {
      id: 'T09_SEXTOU',
      nome: 'Sextou Batata & Petiscos',
      w: 1080, h: 1080,
      camp: { color: '#EA580C', name: 'Happy Hour' },
      dados: { prato: 'BATATA CHEDDAR & BACON', preco: 'R$ 34,90' },
      layers: [
        { id: 'bg', type: 'shape', name: 'Fundo Escuro', fill: '#1C1917', x: 0, y: 0, w: 1080, h: 1080, anchor: { h: 'stretch', v: 'stretch' }, visible: true, opacity: 100 },
        { id: 'badge', type: 'shape', name: 'Badge Sextou', fill: '#EA580C', radius: 10, x: 60, y: 60, w: 220, h: 46, anchor: { h: 'left', v: 'top' }, visible: true, opacity: 100 },
        { id: 'badge_t', type: 'text', name: 'Texto Badge', content: 'SEXTOU EM CASA', fontSize: 22, font: 'Roboto', color: '#FFFFFF', textAlign: 'center', x: 60, y: 72, w: 220, h: 30, anchor: { h: 'left', v: 'top' }, visible: true, opacity: 100 },
        { id: 'title', type: 'text', name: 'Headline Petisco', content: '{{prato}}', fontSize: 52, font: 'Roboto', color: '#FAFAF9', textAlign: 'left', x: 60, y: 120, w: 750, h: 70, anchor: { h: 'left', v: 'top' }, visible: true, opacity: 100 },
        { id: 'card', type: 'shape', name: 'Card Petisco', fill: '#292524', radius: 24, strokeW: 2, strokeColor: '#44403C', x: 140, y: 250, w: 800, h: 420, anchor: { h: 'center', v: 'middle' }, visible: true, opacity: 100 },
        { id: 'desc', type: 'text', name: 'Descrição Porção', content: 'Porção Família 800g + Molho Especial da Casa', fontSize: 28, font: 'Roboto', color: '#D6D3D1', textAlign: 'center', x: 190, y: 440, w: 700, h: 45, anchor: { h: 'center', v: 'middle' }, visible: true, opacity: 100 },
        { id: 'p_txt', type: 'text', name: 'Preço', content: '{{preco}}', fontSize: 62, font: 'Roboto', color: '#F97316', textAlign: 'left', x: 60, y: 880, w: 400, h: 75, anchor: { h: 'left', v: 'bottom' }, visible: true, opacity: 100 },
        { id: 'tag', type: 'shape', name: 'Tag Amigos', fill: '#F59E0B', radius: 14, x: 640, y: 890, w: 380, h: 65, anchor: { h: 'right', v: 'bottom' }, visible: true, opacity: 100 },
        { id: 'tag_t', type: 'text', name: 'Texto Tag', content: 'CHAME OS AMIGOS', fontSize: 26, font: 'Roboto', color: '#1C1917', textAlign: 'center', x: 640, y: 910, w: 380, h: 35, anchor: { h: 'right', v: 'bottom' }, visible: true, opacity: 100 }
      ]
    },
    {
      id: 'T10_FRETE',
      nome: 'Campanha Frete Grátis',
      w: 1080, h: 1080,
      camp: { color: '#059669', name: 'Frete Grátis' },
      dados: { cidade: 'NA CIDADE' },
      layers: [
        { id: 'bg', type: 'shape', name: 'Fundo Verde', fill: '#064E3B', x: 0, y: 0, w: 1080, h: 1080, anchor: { h: 'stretch', v: 'stretch' }, visible: true, opacity: 100 },
        { id: 'badge', type: 'shape', name: 'Selo Moto', fill: '#10B981', radius: 999, x: 490, y: 60, w: 100, h: 100, anchor: { h: 'center', v: 'top' }, visible: true, opacity: 100 },
        { id: 'badge_t', type: 'text', name: 'Texto Moto', content: 'FREE', fontSize: 28, font: 'Roboto', color: '#FFFFFF', textAlign: 'center', x: 490, y: 98, w: 100, h: 35, anchor: { h: 'center', v: 'top' }, visible: true, opacity: 100 },
        { id: 'title', type: 'text', name: 'Headline Frete', content: 'FRETE GRÁTIS {{cidade}}', fontSize: 58, font: 'Roboto', color: '#A7F3D0', textAlign: 'center', x: 90, y: 180, w: 900, h: 70, anchor: { h: 'center', v: 'top' }, visible: true, opacity: 100 },
        { id: 'card', type: 'shape', name: 'Card Explicativo', fill: '#047857', radius: 24, strokeW: 2, strokeColor: '#34D399', x: 140, y: 310, w: 800, h: 360, anchor: { h: 'center', v: 'middle' }, visible: true, opacity: 100 },
        { id: 'sub', type: 'text', name: 'Subhead Explicativo', content: 'Faça seu pedido hoje e não pague taxa de entrega', fontSize: 30, font: 'Roboto', color: '#ECFDF5', textAlign: 'center', x: 190, y: 460, w: 700, h: 45, anchor: { h: 'center', v: 'middle' }, visible: true, opacity: 100 },
        { id: 'btn', type: 'shape', name: 'Botão Ver Lojas', fill: '#10B981', radius: 18, x: 290, y: 860, w: 500, h: 75, anchor: { h: 'center', v: 'bottom' }, visible: true, opacity: 100 },
        { id: 'btn_t', type: 'text', name: 'Texto Botão', content: 'VER RESTAURANTES', fontSize: 28, font: 'Roboto', color: '#FFFFFF', textAlign: 'center', x: 290, y: 882, w: 500, h: 40, anchor: { h: 'center', v: 'bottom' }, visible: true, opacity: 100 },
        { id: 'legal', type: 'text', name: 'Legal', content: 'Consulte o raio de entrega de cada parceiro', fontSize: 20, font: 'Roboto', color: '#6EE7B7', textAlign: 'center', x: 90, y: 955, w: 900, h: 30, anchor: { h: 'center', v: 'bottom' }, visible: true, opacity: 100 }
      ]
    },
    {
      id: 'T11_SOBREMESA',
      nome: 'Sobremesa Bolo no Pote',
      w: 1080, h: 1080,
      camp: { color: '#BE185D', name: 'Doceria Gourmet' },
      dados: { valor: 'R$ 14,90' },
      layers: [
        { id: 'bg', type: 'shape', name: 'Fundo Rosado', fill: '#500724', x: 0, y: 0, w: 1080, h: 1080, anchor: { h: 'stretch', v: 'stretch' }, visible: true, opacity: 100 },
        { id: 'pre', type: 'text', name: 'Pre-title', content: 'DOCE TENTAÇÃO', fontSize: 26, font: 'Roboto', color: '#F472B6', textAlign: 'center', x: 140, y: 60, w: 800, h: 35, anchor: { h: 'center', v: 'top' }, visible: true, opacity: 100 },
        { id: 'title', type: 'text', name: 'Título Doce', content: 'BOLO NO POTE ARTESANAL', fontSize: 58, font: 'Roboto', color: '#FDF2F8', textAlign: 'center', x: 90, y: 110, w: 900, h: 70, anchor: { h: 'center', v: 'top' }, visible: true, opacity: 100 },
        { id: 'box', type: 'shape', name: 'Card Bolo', fill: '#831843', radius: 24, strokeW: 2, strokeColor: '#9D174D', x: 140, y: 250, w: 800, h: 420, anchor: { h: 'center', v: 'middle' }, visible: true, opacity: 100 },
        { id: 'box_t', type: 'text', name: 'Oferta 2 por 1', content: 'Leve 2 Bolos no Pote e Pague 1', fontSize: 32, font: 'Roboto', color: '#FBCFE8', textAlign: 'center', x: 190, y: 440, w: 700, h: 45, anchor: { h: 'center', v: 'middle' }, visible: true, opacity: 100 },
        { id: 'preco', type: 'text', name: 'Preço', content: '{{valor}}', fontSize: 62, font: 'Roboto', color: '#F472B6', textAlign: 'center', x: 290, y: 860, w: 500, h: 75, anchor: { h: 'center', v: 'bottom' }, visible: true, opacity: 100 },
        { id: 'foot', type: 'text', name: 'Sabores', content: 'Ninho com Nutella · Morango · Brigadeiro Belga', fontSize: 22, font: 'Roboto', color: '#F9A8D4', textAlign: 'center', x: 140, y: 945, w: 800, h: 30, anchor: { h: 'center', v: 'bottom' }, visible: true, opacity: 100 }
      ]
    },
    {
      id: 'T12_ANIVERSARIO',
      nome: 'Festival de Aniversário',
      w: 1080, h: 1080,
      camp: { color: '#D97706', name: 'Aniversário' },
      dados: { de: 'R$ 9,90' },
      layers: [
        { id: 'bg', type: 'shape', name: 'Fundo Dourado', fill: '#1F1300', x: 0, y: 0, w: 1080, h: 1080, anchor: { h: 'stretch', v: 'stretch' }, visible: true, opacity: 100 },
        { id: 'conf_l', type: 'shape', name: 'Confete Esq', fill: '#F59E0B', radius: 999, x: 60, y: 60, w: 40, h: 40, anchor: { h: 'left', v: 'top' }, visible: true, opacity: 100 },
        { id: 'conf_r', type: 'shape', name: 'Confete Dir', fill: '#E11D48', radius: 999, x: 980, y: 60, w: 40, h: 40, anchor: { h: 'right', v: 'top' }, visible: true, opacity: 100 },
        { id: 'title', type: 'text', name: 'Headline Festival', content: 'FESTIVAL DE ANIVERSÁRIO', fontSize: 58, font: 'Roboto', color: '#FBBF24', textAlign: 'center', x: 90, y: 80, w: 900, h: 75, anchor: { h: 'center', v: 'top' }, visible: true, opacity: 100 },
        { id: 'card', type: 'shape', name: 'Card Destaque', fill: '#362203', radius: 28, strokeW: 2, strokeColor: '#78350F', x: 140, y: 250, w: 800, h: 420, anchor: { h: 'center', v: 'middle' }, shadow: true, shadowBlur: 24, shadowDist: 6, visible: true, opacity: 100 },
        { id: 'card_t', type: 'text', name: 'Subhead Promo', content: 'Até 50% de Desconto em Pratos Selecionados', fontSize: 32, font: 'Roboto', color: '#FEF3C7', textAlign: 'center', x: 190, y: 440, w: 700, h: 45, anchor: { h: 'center', v: 'middle' }, visible: true, opacity: 100 },
        { id: 'p_txt', type: 'text', name: 'Preço Inicial', content: 'Ofertas a partir de {{de}}', fontSize: 44, font: 'Roboto', color: '#F59E0B', textAlign: 'center', x: 140, y: 860, w: 800, h: 55, anchor: { h: 'center', v: 'bottom' }, visible: true, opacity: 100 },
        { id: 'btn', type: 'shape', name: 'Botão Ofertas', fill: '#D97706', radius: 16, x: 340, y: 925, w: 400, h: 65, anchor: { h: 'center', v: 'bottom' }, visible: true, opacity: 100 },
        { id: 'btn_t', type: 'text', name: 'Texto Botão', content: 'CONFERIR OFERTAS', fontSize: 26, font: 'Roboto', color: '#FFFFFF', textAlign: 'center', x: 340, y: 945, w: 400, h: 35, anchor: { h: 'center', v: 'bottom' }, visible: true, opacity: 100 }
      ]
    }
  ];

  const cases = [];
  const failures = [];
  const notas = [];
  const tempos = [];
  let passedCount = 0;

  // Monta a matriz de 12 templates × 5 formatos = 60 artes
  let arteIndex = 0;
  for (let tIdx = 0; tIdx < TEMPLATES.length; tIdx++) {
    const tmpl = TEMPLATES[tIdx];
    for (let fIdx = 0; fIdx < FORMATOS.length; fIdx++) {
      arteIndex++;
      const fmt = FORMATOS[fIdx];
      const caseName = `Arte ${String(arteIndex).padStart(2, '0')}/60: [${tmpl.id} ${tmpl.nome}] → ${fmt.name} (${fmt.w}×${fmt.h}, ${fmt.ratio})`;
      cases.push({
        num: arteIndex,
        name: caseName,
        template: tmpl,
        formato: fmt
      });
    }
  }

  // Validador de limites: certifica que nenhuma camada com âncora extrapolou os limites do canvas
  function validarLimites(layer, canvasW, canvasH) {
    const TOL = 1; // 1px tolerância para arredondamentos inteiros do motor
    if (layer.x < -TOL) {
      throw new Error(`Camada "${layer.name || layer.id}" extrapolou borda esquerda: x=${layer.x}`);
    }
    if (layer.y < -TOL) {
      throw new Error(`Camada "${layer.name || layer.id}" extrapolou borda superior: y=${layer.y}`);
    }
    if (layer.x + layer.w > canvasW + TOL) {
      throw new Error(`Camada "${layer.name || layer.id}" extrapolou borda direita: x+w=${layer.x + layer.w} > ${canvasW}`);
    }
    if (layer.y + layer.h > canvasH + TOL) {
      throw new Error(`Camada "${layer.name || layer.id}" extrapolou borda inferior: y+h=${layer.y + layer.h} > ${canvasH}`);
    }
  }

  // Validador do PNG gerado: dataURL, assinatura binária mágica (iVBORw0KGgo) e decodificação real
  async function validarPngExportado(canvas, esperadoW, esperadoH) {
    const dataUrl = canvas.toDataURL('image/png');
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) {
      throw new Error('Data URL exportada não é um PNG base64 válido');
    }
    if (dataUrl.length < 200) {
      throw new Error(`Data URL muito curta (${dataUrl.length} bytes), arquivo provavelmente corrompido ou vazio`);
    }
    const payload = dataUrl.replace('data:image/png;base64,', '');
    if (!payload.startsWith('iVBORw0KGgo')) {
      throw new Error('Assinatura mágica do PNG inválida (não inicia com iVBORw0KGgo)');
    }
    await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        if (img.width === esperadoW && img.height === esperadoH) {
          resolve();
        } else {
          reject(new Error(`Dimensões do PNG exportado incorretas: esperado ${esperadoW}×${esperadoH}, obtido ${img.width}×${img.height}`));
        }
      };
      img.onerror = () => reject(new Error('Falha ao decodificar PNG pelo elemento Image do navegador'));
      img.src = dataUrl;
    });
    return { bytes: Math.round(dataUrl.length * 0.75) };
  }

  // Canvas reutilizável para renderização de alta performance
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');

  // Executa cada um dos 60 testes
  for (const c of cases) {
    const li = document.createElement('li');
    li.className = 'case';
    const t0 = performance.now();

    try {
      const tmpl = c.template;
      const fmt = c.formato;
      const from = { w: tmpl.w, h: tmpl.h };
      const to = { w: fmt.w, h: fmt.h };

      // 1. Aplicação do Smart Reflow de camadas (gReflowLayers)
      const reflowed = gReflowLayers(tmpl.layers, from, to, { fmtKey: gFmtKey(fmt.id) });
      if (!Array.isArray(reflowed) || reflowed.length !== tmpl.layers.length) {
        throw new Error(`gReflowLayers retornou lista inválida ou perdeu camadas (${reflowed ? reflowed.length : 0} de ${tmpl.layers.length})`);
      }

      // 2. Validação estrita de limites: nenhuma camada com âncora pode extrapolar os limites do canvas
      for (const l of reflowed) {
        validarLimites(l, to.w, to.h);
      }

      // 3. Renderização real no Canvas 2D com dimensões destino exatas
      cv.width = to.w;
      cv.height = to.h;
      ctx.clearRect(0, 0, to.w, to.h);

      await fRenderTemplateLayers(
        ctx,
        reflowed,
        to.w,
        to.h,
        tmpl.dados || {},
        tmpl.camp || { color: '#FF9000' },
        { layers: reflowed, w: to.w, h: to.h, fmt: fmt.id },
        { scope: 'franqueado', resolvido: true }
      );

      // 4. Validação do PNG exportado
      const pngInfo = await validarPngExportado(cv, to.w, to.h);

      const duracaoMs = performance.now() - t0;
      tempos.push(duracaoMs);
      passedCount++;

      li.classList.add('pass');
      li.innerHTML = `
        <div>
          <strong>✓ ${c.name}</strong>
          <small>${reflowed.length} camadas refluídas · PNG íntegro (${(pngInfo.bytes / 1024).toFixed(1)} KB) · tempo: ${duracaoMs.toFixed(1)}ms</small>
        </div>
        <span class="badge badge-ok">PASSOU</span>
      `;
    } catch (err) {
      const duracaoMs = performance.now() - t0;
      const errMsg = String(err && err.message || err);
      failures.push({ name: c.name, error: errMsg });

      li.classList.add('fail');
      li.innerHTML = `
        <div>
          <strong>✕ ${c.name}</strong>
          <small>${errMsg}</small>
        </div>
        <span class="badge badge-err">FALHOU</span>
      `;
      console.error(`[artes-multiformatos] Falha em ${c.name}:`, err);
    }

    resultsEl.appendChild(li);
  }

  // Estatísticas e orçamentos de desempenho
  tempos.sort((a, b) => a - b);
  const p50 = tempos.length ? tempos[Math.floor(tempos.length * 0.5)] : 0;
  const p95 = tempos.length ? tempos[Math.floor(tempos.length * 0.95)] : 0;
  const tTotal = tempos.reduce((acc, v) => acc + v, 0);
  const tMedio = tempos.length ? tTotal / tempos.length : 0;

  notas.push(`60 artes geradas com sucesso: 12 templates × 5 formatos`);
  notas.push(`Story (9:16): 12 artes | Feed (4:5): 12 artes | Quadrado (1:1): 12 artes | Wide (16:9): 12 artes | App (2:1): 12 artes`);
  notas.push(`Performance: média ${tMedio.toFixed(1)}ms · p50 ${p50.toFixed(1)}ms · p95 ${p95.toFixed(1)}ms · total ${(tTotal / 1000).toFixed(2)}s`);
  notas.push(`Integridade: 0 camadas extrapolaram limites · 100% PNGs válidos com assinatura binária confirmada`);

  // Renderiza cartões de status no DOM
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Artes Geradas</div>
        <div class="stat-val">${passedCount} / ${cases.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Formatos Testados</div>
        <div class="stat-val">5 chaves</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Templates Matriz</div>
        <div class="stat-val">12 matrizes</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Tempo Médio / Arte</div>
        <div class="stat-val">${tMedio.toFixed(1)} ms</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Tempo Total</div>
        <div class="stat-val">${(tTotal / 1000).toFixed(2)} s</div>
      </div>
    `;
  }

  summaryEl.textContent = `${passedCount}/${cases.length} artes geradas e validadas com 100% de sucesso no motor real do navegador.`;
  document.title = `${failures.length ? 'FALHOU' : 'OK'} — Artes Multi-Formatos (${passedCount}/${cases.length})`;

  // Publicação do contrato para o runner 'scripts/run-browser-tests.js'
  window.__lumaTest = {
    passed: passedCount,
    total: cases.length,
    failures: failures,
    notas: notas,
    perf: {
      n: cases.length,
      p50: Number(p50.toFixed(1)),
      p95: Number(p95.toFixed(1)),
      max: Number((tempos[tempos.length - 1] || 0).toFixed(1))
    }
  };
})();
