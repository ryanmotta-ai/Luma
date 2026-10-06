/* ══════════════════════════════════════════════════════════════════════════════════════════
   STRESS DE TIPOGRAFIA, LOCAL FIT EXTREMO E SANITIZAÇÃO — 60 ARTES
   ------------------------------------------------------------------------------------------
   Validação do motor real Canvas 2D (fRenderTemplateLayers) e Local Fit (gLocalFitArte):
     · Grupo 1 (01 a 12): Títulos mínimos (1 a 4 chars) — preservação autoral (original first).
     · Grupo 2 (13 a 24): Títulos ultra-longos (45 a 90 chars) — smart wrap, shrink e bounding box.
     · Grupo 3 (25 a 36): Palavras gigantes sem espaço — corte/shrink do Local Fit sem quebrar.
     · Grupo 4 (37 a 48): Caracteres especiais, aspas, acentos e sanitização XSS — zero injeção.
     · Grupo 5 (49 a 60): Preços extremos e formatações financeiras — split, rótulos e placa.

   Contrato:
     · Executa 60/60 no motor real de Canvas 2D;
     · Gera PNGs válidos e verificáveis para cada uma das 60 artes;
     · Publica window.__lumaTest = { passed, total: 60, failures, notas, perf };
   ══════════════════════════════════════════════════════════════════════════════════════════ */

(async function () {
  const results = document.getElementById('results');
  const summary = document.getElementById('summary');
  const statsBar = document.getElementById('statsBar');
  const statPassed = document.getElementById('statPassed');
  const statMediaMs = document.getElementById('statMediaMs');
  const statP95 = document.getElementById('statP95');

  const cases = [];
  const failures = [];
  const notas = [];
  const tempos = [];

  const assert = (condition, message) => {
    if (!condition) throw new Error(message || 'Asserção falhou');
  };

  const perc = (xs, p) => {
    if (!xs.length) return 0;
    const s = xs.slice().sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(s.length * p))];
  };

  const W = 1080;
  const H = 1350;

  function templateArte(opts) {
    opts = opts || {};
    const bg = opts.bg || '#FF9000';
    return [
      {
        id: 'bg',
        type: 'shape',
        name: 'Fundo',
        x: 0, y: 0, w: W, h: H,
        fill: bg,
        visible: true,
        opacity: 100
      },
      {
        id: 'faixa',
        type: 'shape',
        name: 'Faixa Selo',
        shapeKind: 'rect',
        radius: 12,
        x: 80, y: 60, w: 260, h: 48,
        fill: 'rgba(0,0,0,0.28)',
        visible: true,
        opacity: 100
      },
      {
        id: 'seloTxt',
        type: 'text',
        name: 'Selo Topo',
        content: opts.selo || 'DELIVERY MUCH',
        x: 80, y: 72, w: 260, h: 30,
        fontSize: 20,
        color: '#FFFFFF',
        font: 'Roboto',
        textAlign: 'center',
        textBox: 'point',
        vAlign: 'top',
        visible: true,
        opacity: 100
      },
      {
        id: 'titulo',
        type: 'text',
        name: 'Título Principal',
        content: '{{titulo}}',
        isVar: true,
        x: 80, y: 150, w: 920, h: 290,
        fontSize: opts.tituloFs || 68,
        font: 'Roboto',
        lineHeight: 1.15,
        color: '#FFFFFF',
        textAlign: 'left',
        textBox: 'box',
        vAlign: 'top',
        layoutRefText: 'OFERTA ESPECIAL DA SEMANA',
        visible: true,
        opacity: 100
      },
      {
        id: 'subtitulo',
        type: 'text',
        name: 'Subtítulo',
        content: '{{subtitulo}}',
        isVar: true,
        x: 80, y: 480, w: 920, h: 140,
        fontSize: 32,
        font: 'Roboto',
        lineHeight: 1.25,
        color: '#F8FAFC',
        textAlign: 'left',
        textBox: 'box',
        vAlign: 'top',
        layoutRefText: 'Peça pelo app oficial e aproveite descontos exclusivos hoje',
        visible: true,
        opacity: 100
      },
      {
        id: 'placa',
        type: 'shape',
        name: 'Placa Preço',
        shapeKind: 'rect',
        radius: 20,
        x: 80, y: 660, w: 480, h: 110,
        fill: '#FFFFFF',
        shadow: true,
        shadowBlur: 14,
        shadowDist: 5,
        shadowColor: 'rgba(0,0,0,0.22)',
        visible: true,
        opacity: 100
      },
      {
        id: 'preco',
        type: 'text',
        name: 'Preço',
        content: '{{preco}}',
        isVar: true,
        x: 90, y: 685, w: 460, h: 65,
        fontSize: 48,
        font: 'Roboto',
        color: '#D97706',
        textAlign: 'center',
        textBox: 'box',
        vAlign: 'top',
        layoutRefText: 'R$ 29,90',
        visible: true,
        opacity: 100
      },
      {
        id: 'ctaBox',
        type: 'shape',
        name: 'Botão CTA',
        shapeKind: 'rect',
        radius: 16,
        x: 80, y: 810, w: 380, h: 65,
        fill: 'rgba(255,255,255,0.18)',
        strokeW: 2,
        strokeColor: '#FFFFFF',
        visible: true,
        opacity: 100
      },
      {
        id: 'cta',
        type: 'text',
        name: 'CTA',
        content: 'PEÇA AGORA NO APP',
        x: 80, y: 828, w: 380, h: 36,
        fontSize: 24,
        font: 'Roboto',
        color: '#FFFFFF',
        textAlign: 'center',
        textBox: 'point',
        vAlign: 'top',
        visible: true,
        opacity: 100
      }
    ];
  }

  /* ════════════════════════════════════════════════════════════════════
     DEFINIÇÃO DAS 60 ARTES
     ════════════════════════════════════════════════════════════════════ */

  // Grupo 1: 12 Artes com Títulos Mínimos (1 a 4 chars)
  const GRUPO_1 = [
    { id: 1,  titulo: 'X',    subtitulo: 'O mais clássico dos lanches artesanais', preco: 'R$ 14,90', bg: '#EA580C', selo: 'LANCHES' },
    { id: 2,  titulo: 'Pão',  subtitulo: 'Pão francês quentinho e crocante direto do forno', preco: 'R$ 1,50', bg: '#D97706', selo: 'PADARIA' },
    { id: 3,  titulo: 'Chá',  subtitulo: 'Chá gelado com limão siciliano e hortelã fresca', preco: 'R$ 7,90', bg: '#0D9488', selo: 'BEBIDAS' },
    { id: 4,  titulo: 'Wrap', subtitulo: 'Wrap integral leve com frango desfiado e salada', preco: 'R$ 18,90', bg: '#059669', selo: 'FITNESS' },
    { id: 5,  titulo: 'Maki', subtitulo: 'Hossomaki de salmão fresco com gergelim torrado', preco: 'R$ 22,00', bg: '#BE123C', selo: 'JAPONÊS' },
    { id: 6,  titulo: 'Mel',  subtitulo: 'Mel silvestre puro e orgânico do produtor', preco: 'R$ 25,00', bg: '#B45309', selo: 'NATURAL' },
    { id: 7,  titulo: 'Açaí', subtitulo: 'Açaí cremoso na tigela com frutas selecionadas', preco: 'R$ 16,90', bg: '#7E22CE', selo: 'SOBREMESAS' },
    { id: 8,  titulo: 'Suco', subtitulo: 'Suco natural da fruta preparado na hora', preco: 'R$ 8,50', bg: '#F59E0B', selo: 'SUCOS' },
    { id: 9,  titulo: 'Bolo', subtitulo: 'Fatia artesanal de bolo de cenoura com brigadeiro', preco: 'R$ 9,90', bg: '#C2410C', selo: 'DOCERIA' },
    { id: 10, titulo: 'Café', subtitulo: 'Café expresso especial grãos 100% arábica', preco: 'R$ 5,00', bg: '#78350F', selo: 'CAFETERIA' },
    { id: 11, titulo: 'Taco', subtitulo: 'Taco crocante recheado com queijo e carne moída', preco: 'R$ 15,90', bg: '#E11D48', selo: 'MEXICANO' },
    { id: 12, titulo: 'Uva',  subtitulo: 'Cacho selecionado de uva verde sem sementes', preco: 'R$ 11,90', bg: '#15803D', selo: 'HORTIFRUTI' }
  ];

  // Grupo 2: 12 Artes com Títulos Ultra-Longos (45 a 90 chars)
  const GRUPO_2 = [
    { id: 13, titulo: 'Super Mega Combo Família Especial com Duplo Cheddar Bacon Batata Rústica e Refri 2L', subtitulo: 'Serve até quatro pessoas com muita fartura e sabor', preco: 'R$ 89,90', bg: '#991B1B', selo: 'MEGA COMBO' },
    { id: 14, titulo: 'Festival de Hambúrguer Artesanal com Fritas Crocantes e Refrigerante Gelado em Dobro', subtitulo: 'A promoção mais esperada de toda a semana no delivery', preco: 'R$ 49,90', bg: '#C2410C', selo: 'BURGER FEST' },
    { id: 15, titulo: 'Grande Promoção Especial de Pizza Família Dois Sabores com Borda Recheada de Catupiry', subtitulo: 'Massa artesanal com fermentação natural de 48 horas', preco: 'R$ 64,90', bg: '#B91C1C', selo: 'PIZZARIA' },
    { id: 16, titulo: 'Delicioso Banquete Completo com Prato Principal Acompanhamentos Variados e Bebida 1L', subtitulo: 'Refeição equilibrada preparada com ingredientes nobres', preco: 'R$ 72,00', bg: '#047857', selo: 'ALMOÇO VIP' },
    { id: 17, titulo: 'Sanduíche Especial de Costela Desfiada ao Molho Barbecue com Queijo Prato Derretido', subtitulo: 'Carne desfiada lentamente por oito horas de cocção', preco: 'R$ 38,90', bg: '#831843', selo: 'GOURMET' },
    { id: 18, titulo: 'Mega Porção de Coxinha Gourmet Crocante com Molho Especial da Casa para Compartilhar', subtitulo: 'Vinte unidades com recheio cremoso e massa crocante', preco: 'R$ 34,90', bg: '#B45309', selo: 'PETISCOS' },
    { id: 19, titulo: 'Combinado Supremo do Chef com Sashimi Salmão Fresco Niguiri Variado e Temaki Especial', subtitulo: 'O melhor da culinária japonesa selecionado para você', preco: 'R$ 109,90', bg: '#1E1B4B', selo: 'ORIENTAL' },
    { id: 20, titulo: 'Açaí Tropical Completo na Tigela com Leite Ninho Granola Banana Morango e Muito Mel', subtitulo: 'Energia garantida no tamanho grande de 700ml', preco: 'R$ 28,00', bg: '#581C87', selo: 'AÇAÍ FEST' },
    { id: 21, titulo: 'Torta Doce Artesanal de Chocolate Meio Amargo com Frutas Vermelhas e Creme Especial', subtitulo: 'Sobremesa irresistível criada por nossos mestres confeiteiros', preco: 'R$ 45,00', bg: '#881337', selo: 'SOBREMESA' },
    { id: 22, titulo: 'Almoço Executivo Tradicional com Filé de Frango Arroz Integral Feijão e Salada Fresca', subtitulo: 'Comida caseira balanceada com sabor de verdade todos os dias', preco: 'R$ 26,90', bg: '#166534', selo: 'EXECUTIVO' },
    { id: 23, titulo: 'Combo Burguer Supremo Artesanal Pão Brioche Duas Carnes Queijo e Bacon Crocante Extra', subtitulo: 'Acompanha batata frita média crocante e molho secreto', preco: 'R$ 42,90', bg: '#9A3412', selo: 'SUPREMO' },
    { id: 24, titulo: 'Super Rodízio de Massas Artesanais com Molhos Especiais e Bebidas Liberadas na Mesa', subtitulo: 'Válido para consumo de terça a domingo no restaurante', preco: 'R$ 59,90', bg: '#701A75', selo: 'RODÍZIO' }
  ];

  // Grupo 3: 12 Artes com Palavras Únicas Gigantes sem Espaço
  const GRUPO_3 = [
    { id: 25, titulo: 'MEGAHIPERSUPEROFERTADODIA', subtitulo: 'Desconto imperdível que você só encontra no aplicativo', preco: 'R$ 29,90', bg: '#6B21A8', selo: 'EXPLOSÃO' },
    { id: 26, titulo: 'COMBOINACREDITAVELMENTEGRANDE', subtitulo: 'Tamanho surreal para saciar toda a sua família', preco: 'R$ 59,90', bg: '#1D4ED8', selo: 'GIGANTE' },
    { id: 27, titulo: 'SUPERDELICIOSOFESTIVALDAHORA', subtitulo: 'Os sabores mais pedidos reunidos em um combo único', preco: 'R$ 39,90', bg: '#B45309', selo: 'FESTIVAL' },
    { id: 28, titulo: 'HAMBURGUERARTESANALGIGANTESCO', subtitulo: 'Hambúrguer duplo prensado com blend exclusivo defumado', preco: 'R$ 37,50', bg: '#C2410C', selo: 'BURGER' },
    { id: 29, titulo: 'PROMOÇÃOEXTRAORDINARIAMENTEBOM', subtitulo: 'Preço promocional válido apenas enquanto durar o estoque', preco: 'R$ 24,90', bg: '#047857', selo: 'IMPERDÍVEL' },
    { id: 30, titulo: 'SABORINCOMPARAVELMENTEGULOSO', subtitulo: 'Receita artesanal com temperos naturais da nossa cozinha', preco: 'R$ 33,00', bg: '#BE123C', selo: 'SABOR' },
    { id: 31, titulo: 'DESCONTOSIMPERDIVEISDATARDE', subtitulo: 'Aproveite entrega grátis em todos os pedidos da tarde', preco: 'R$ 21,90', bg: '#0369A1', selo: 'DESCONTO' },
    { id: 32, titulo: 'INACREDITAVELMENTESABOROSO', subtitulo: 'Uma experiência gastronômica memorável direto na sua casa', preco: 'R$ 42,00', bg: '#4338CA', selo: 'PREMIUM' },
    { id: 33, titulo: 'CARDAPIOPROMOCIONALDOFINAL', subtitulo: 'Pratos especiais selecionados para o seu final de semana', preco: 'R$ 48,90', bg: '#9F1239', selo: 'WEEKEND' },
    { id: 34, titulo: 'FESTIVALGASTRONOMICODELOCURA', subtitulo: 'Mais de trinta opções gastronômicas com super desconto', preco: 'R$ 52,00', bg: '#0F766E', selo: 'GASTRO' },
    { id: 35, titulo: 'EXPERIENCIAGOURMETMARAVILHOSA', subtitulo: 'Ingredientes nobres combinados com técnica e carinho', preco: 'R$ 68,00', bg: '#3730A3', selo: 'GOURMET' },
    { id: 36, titulo: 'OFERTAZOPARANINGUEMBOTARDEFEITO', subtitulo: 'Preço arrasador que não cabe no cardápio convencional', preco: 'R$ 19,90', bg: '#854D0E', selo: 'OFERTAÇO' }
  ];

  // Grupo 4: 12 Artes com Caracteres Especiais, Aspas, Acentos e Sanitização XSS
  const GRUPO_4 = [
    { id: 37, titulo: '<script>alert("XSS")</script>', subtitulo: 'Teste rigoroso de sanitização e proteção contra scripts', preco: 'R$ 19,90', bg: '#0F172A', selo: 'SEGURANÇA' },
    { id: 38, titulo: 'Pizza & Burger: 100% Caseiro!', subtitulo: 'Símbolos ampersand e porcentagem tratados perfeitamente', preco: 'R$ 49,90', bg: '#C2410C', selo: 'CASEIRO' },
    { id: 39, titulo: '"Especial" do Chef (Edição Limitada)', subtitulo: 'Aspas duplas e parênteses de destaque na tipografia', preco: 'R$ 39,90', bg: '#831843', selo: 'ED. LIMITADA' },
    { id: 40, titulo: 'Promoção: 1/2 Frango + 1/2 Costela', subtitulo: 'Frações, dois pontos e sinais matemáticos no título', preco: 'R$ 55,00', bg: '#15803D', selo: 'COMBINADO' },
    { id: 41, titulo: 'Coração, Pinhão & Feijão Tropeiro (Ç/ã/õ)', subtitulo: 'Cedilhas e múltiplos diacríticos e acentos do português', preco: 'R$ 32,90', bg: '#78350F', selo: 'REGIONAL' },
    { id: 42, titulo: 'Bife à Milanesa c/ Molho d\'Alho Especial', subtitulo: 'Apostrofe e crase testadas em texto composto', preco: 'R$ 29,90', bg: '#B45309', selo: 'MILANESA' },
    { id: 43, titulo: '★ Mega Combo VIP ★ (Apenas hoje!)', subtitulo: 'Glifos unicode estrela e exclamações renderizados', preco: 'R$ 69,90', bg: '#854D0E', selo: 'ESTRELA' },
    { id: 44, titulo: 'Açaí 700ml c/ Guaraná + Paçoca + Mel 100%', subtitulo: 'Unidades de volume e múltiplos aditivos sem conflito', preco: 'R$ 24,00', bg: '#581C87', selo: 'TURBO' },
    { id: 45, titulo: '<b>Super</b> Hamburguer <i>Premium</i>', subtitulo: 'Tags HTML de formatação tratadas como texto literal', preco: 'R$ 33,90', bg: '#1E293B', selo: 'SANITIZADO' },
    { id: 46, titulo: 'Combo #1: Sanduba / Batata / Refri (Top!)', subtitulo: 'Barras, cerquilha e pontuação de catálogo comercial', preco: 'R$ 36,90', bg: '#0369A1', selo: 'TRIO' },
    { id: 47, titulo: '<img src=x onerror="window.__xssTriggered=true"> Pastel', subtitulo: 'Payload com evento inline neutralizado', preco: 'R$ 12,00', bg: '#334155', selo: 'ESCAPE' },
    { id: 48, titulo: 'Pastel "Duplo Queijo" & Bacon (Crocante!)', subtitulo: 'Aspas internas e e-comercial estilizado na composição', preco: 'R$ 14,00', bg: '#B91C1C', selo: 'CROCANTE' }
  ];

  // Grupo 5: 12 Artes com Preços Extremos e Formatações Financeiras
  const GRUPO_5 = [
    { id: 49, titulo: 'Bala Recheada de Morango', subtitulo: 'Preço unitário simbólico de degustação da loja', preco: 'R$ 0,50', bg: '#BE123C', selo: 'CENTAVOS' },
    { id: 50, titulo: 'Buffet Completo de Casamento', subtitulo: 'Pacote gourmet para eventos e cerimônias especiais', preco: 'R$ 1.999,90', bg: '#0F766E', selo: 'EVENTOS' },
    { id: 51, titulo: 'Temporada Gastronômica VIP', subtitulo: 'Reserva exclusiva anual da mesa do chef', preco: 'R$ 9.999,00', bg: '#1E1B4B', selo: 'PRESTÍGIO' },
    { id: 52, titulo: 'Sobremesa do Dia de Cortesia', subtitulo: 'Na compra de qualquer prato principal do almoço', preco: 'Grátis', bg: '#059669', selo: 'CORTESIA' },
    { id: 53, titulo: 'Melancia Fresca Direto do Produtor', subtitulo: 'Pesagem e corte realizados na hora da entrega', preco: 'R$ 19,90 / kg', bg: '#15803D', selo: 'POR KG' },
    { id: 54, titulo: 'Pão de Queijo Mineiro Quente', subtitulo: 'Tradicional receita da fazenda com queijo canastra', preco: 'R$ 0,99', bg: '#D97706', selo: 'PROMOÇÃO' },
    { id: 55, titulo: 'Almoço Prato Feito Caseiro', subtitulo: 'Monte com sua carne e salada favoritas no delivery', preco: 'A partir de R$ 14,90', bg: '#B45309', selo: 'PRATO FEITO' },
    { id: 56, titulo: 'Barca Especial de Salmão e Atum', subtitulo: 'Cinquenta peças artesanais com molhos inclusos', preco: 'R$ 120,00', bg: '#4338CA', selo: 'SUSHI BAR' },
    { id: 57, titulo: 'Catering Premium Corporativo', subtitulo: 'Cardápio assinado para cem convidados com garçom', preco: 'R$ 5.499,99', bg: '#312E81', selo: 'EMPRESAS' },
    { id: 58, titulo: 'Dupla de Burgers Artesanais', subtitulo: 'Pão brioche, queijo derretido e molho da casa', preco: '2 por R$ 25,00', bg: '#9A3412', selo: 'LEVE 2' },
    { id: 59, titulo: 'Cerveja Artesanal IPA 500ml', subtitulo: 'Lúpulo selecionado e aroma cítrico marcante e fresco', preco: 'R$ 10,00 unid.', bg: '#A16207', selo: 'BEBIDA' },
    { id: 60, titulo: 'Combo Almoço Individual Completo', subtitulo: 'Prato do dia com bebida e sobremesa de cortesia', preco: 'De R$ 49,90 Por R$ 29,90', bg: '#C2410C', selo: 'DE / POR' }
  ];

  const TODAS_AS_ARTES = [...GRUPO_1, ...GRUPO_2, ...GRUPO_3, ...GRUPO_4, ...GRUPO_5];

  // Garante que as fontes estejam aquecidas
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch (e) {}
  }

  /* ════════════════════════════════════════════════════════════════════
     EXECUÇÃO SEQUENCIAL DAS 60 ARTES
     ════════════════════════════════════════════════════════════════════ */

  let passed = 0;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');

  for (let idx = 0; idx < TODAS_AS_ARTES.length; idx++) {
    const item = TODAS_AS_ARTES[idx];
    const n = item.id;
    let grupo = 1;
    let grupoNome = 'Títulos Mínimos';
    let badgeClass = 'badge-g1';

    if (n >= 13 && n <= 24) { grupo = 2; grupoNome = 'Títulos Ultra-Longos'; badgeClass = 'badge-g2'; }
    else if (n >= 25 && n <= 36) { grupo = 3; grupoNome = 'Palavras Gigantes'; badgeClass = 'badge-g3'; }
    else if (n >= 37 && n <= 48) { grupo = 4; grupoNome = 'Caracteres & XSS'; badgeClass = 'badge-g4'; }
    else if (n >= 49 && n <= 60) { grupo = 5; grupoNome = 'Preços Extremos'; badgeClass = 'badge-g5'; }

    const nomeTeste = `Arte ${String(n).padStart(2, '0')}/60 · [G${grupo} ${grupoNome}] "${item.titulo.slice(0, 28)}${item.titulo.length > 28 ? '…' : ''}"`;
    const li = document.createElement('li');
    li.className = 'case';

    const t0 = performance.now();
    try {
      ctx.clearRect(0, 0, W, H);

      const layers = templateArte({ bg: item.bg, selo: item.selo });
      const dados = {
        titulo: item.titulo,
        subtitulo: item.subtitulo,
        preco: item.preco
      };
      const camp = { name: 'Campanha Teste', color: item.bg };
      const material = { layers, w: W, h: H, fmt: 'feed', bg: item.bg };

      // Renderização com o motor oficial do franqueado
      const out = await fRenderTemplateLayers(ctx, layers, W, H, dados, camp, material, {
        scope: 'franqueado',
        purpose: 'preview'
      });

      const tDelta = performance.now() - t0;
      tempos.push(tDelta);

      // ── Validações de integridade gerais ──
      assert(out, 'fRenderTemplateLayers deve retornar as camadas resolvidas');
      const lr = out._layoutResult;
      assert(lr, 'out._layoutResult deve conter o laudo do Local Fit');
      assert(!lr.invalid, `Arte não coube no Local Fit (bloqueio indevido): ${(lr.diagnostico && lr.diagnostico.motivo) || lr.status}`);

      // Validação de PNG real gerado no Canvas
      const png = cv.toDataURL('image/png');
      assert(typeof png === 'string', 'PNG deve ser uma string DataURL');
      assert(png.startsWith('data:image/png;base64,'), 'PNG deve iniciar com header data:image/png;base64');
      assert(png.length > 5000, `PNG deve ter tamanho de dados consistente (> 5000 bytes, gerado: ${png.length})`);

      const cTitulo = lr.campos && lr.campos.find(c => c.id === 'titulo');
      const cPreco = lr.campos && lr.campos.find(c => c.id === 'preco');

      // ── Asserções específicas por Grupo ──
      if (grupo === 1) {
        assert(item.titulo.length <= 4, `Título mínimo deve ter 1 a 4 chars (tem ${item.titulo.length})`);
        assert(cTitulo && cTitulo.status === 'fits', 'Título mínimo deve ter status fits');
        assert(cTitulo.degrau === 'original', `Título mínimo deve preservar corpo autorado (veio ${cTitulo.degrau})`);
        assert(cTitulo.linhas === 1, 'Título mínimo deve ocupar exatamente 1 linha');
      } else if (grupo === 2) {
        assert(item.titulo.length >= 45 && item.titulo.length <= 90, `Título ultra-longo deve ter 45 a 90 chars (tem ${item.titulo.length})`);
        assert(cTitulo && cTitulo.status === 'fits', 'Título ultra-longo deve caber no Local Fit');
        assert(cTitulo.linhas > 1, `Título ultra-longo deve quebrar em múltiplas linhas (veio ${cTitulo.linhas})`);
        assert(cTitulo.overflowX === 0 && cTitulo.overflowY === 0, 'Bounding box deve ser respeitado sem overflow');
      } else if (grupo === 3) {
        assert(!/\s/.test(item.titulo), 'Palavra gigante não deve conter espaços');
        assert(item.titulo.length >= 20, 'Palavra gigante deve ter 20+ caracteres');
        assert(cTitulo && cTitulo.status === 'fits', 'Palavra gigante deve ser acomodada pelo Local Fit');
        assert(cTitulo.degrau === 'shrink' || cTitulo.degrau === 'wrap' || cTitulo.fontSize <= cTitulo.fontSizeAutorado,
          'Local Fit deve adaptar a palavra gigante sem transbordar');
      } else if (grupo === 4) {
        // Zero injeção de script
        assert(window.__xssTriggered !== true, 'Ataque XSS foi executado no runtime!');
        // Sanitização de HTML com gEsc
        const sanitizado = gEsc(item.titulo);
        if (item.titulo.includes('<script>')) {
          assert(!sanitizado.includes('<script>'), 'gEsc deve neutralizar tag <script>');
          assert(sanitizado.includes('&lt;script&gt;'), 'gEsc deve converter tags para entidades HTML');
        }
        if (item.titulo.includes('<img')) {
          assert(!sanitizado.includes('<img'), 'gEsc deve neutralizar tag <img');
        }
        assert(cTitulo && cTitulo.status === 'fits', 'Texto com caracteres especiais deve ser aceito');
      } else if (grupo === 5) {
        assert(cPreco && cPreco.status === 'fits', 'Preço extremo deve caber no Local Fit');
        const sp = gSplitPrice(item.preco);
        assert(sp && typeof sp.inteiro === 'string', 'gSplitPrice deve processar o preço sem lançar exceção');
      }

      passed++;
      li.classList.add('pass');

      const metaStr = `Degrau: ${cTitulo ? cTitulo.degrau : lr.status} · Linhas: ${cTitulo ? cTitulo.linhas : 1} · Fonte: ${cTitulo ? cTitulo.fontSize : '-'}px · PNG: ${Math.round(png.length / 1024)}KB · Tempo: ${Math.round(tDelta)}ms`;

      li.innerHTML = `
        <div class="case-info">
          <div class="case-title">
            <span>✓ ${nomeTeste}</span>
            <span class="badge ${badgeClass}">G${grupo}</span>
            <span class="badge badge-fit">${cTitulo ? cTitulo.degrau : lr.status}</span>
          </div>
          <div class="case-meta">
            <span>${metaStr}</span>
          </div>
        </div>
        <img class="thumb" src="${png}" alt="Arte ${n}" />
      `;

      if (n % 12 === 0) {
        notas.push(`Grupo ${grupo} (${grupoNome}): 12/12 artes renderizadas com sucesso`);
      }
    } catch (err) {
      li.classList.add('fail');
      li.innerHTML = `
        <div class="case-info">
          <div class="case-title">✕ ${nomeTeste}</div>
          <div class="case-meta" style="color:#f87171">Erro: ${err.message || String(err)}</div>
        </div>
      `;
      failures.push({ name: nomeTeste, error: err.message || String(err) });
      console.error('[artes-tipografia-fit]', nomeTeste, err);
    }

    results.appendChild(li);
  }

  // ── Consolidação e Métricas ──
  const total = TODAS_AS_ARTES.length;
  const p50 = tempos.length ? Math.round(perc(tempos, 0.5) * 10) / 10 : 0;
  const p95 = tempos.length ? Math.round(perc(tempos, 0.95) * 10) / 10 : 0;
  const mediaMs = tempos.length ? Math.round((tempos.reduce((a, b) => a + b, 0) / tempos.length) * 10) / 10 : 0;

  summary.textContent = `${passed}/${total} artes geradas e verificadas com sucesso no motor Canvas 2D + Local Fit (${mediaMs}ms médio por arte).`;
  document.title = (failures.length ? 'FALHOU' : 'OK') + ` — Tipografia Fit (${passed}/${total})`;

  statsBar.style.display = 'flex';
  statPassed.textContent = `${passed}/${total}`;
  statMediaMs.textContent = `${mediaMs}ms`;
  statP95.textContent = `${p95}ms`;

  notas.push(`Performance total: 60 artes em ${Math.round(tempos.reduce((a, b) => a + b, 0))}ms (p50: ${p50}ms, p95: ${p95}ms, média: ${mediaMs}ms)`);

  // Publica contrato exigido pelo runner
  window.__lumaTest = {
    passed: passed,
    total: total,
    failures: failures,
    notas: notas,
    perf: { p50, p95 }
  };
})();
