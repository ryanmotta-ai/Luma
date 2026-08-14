/* Corpus do Auto-layout — padrão "bloco editorial arejado".
   Aqui a ENTRELINHA é a declaração de design: o respiro entre as linhas é o que dá o ar de peça
   institucional. Apertar o espaçamento estraga mais do que ceder um ponto de corpo — é o caso
   que justifica a política `sem-entrelinha` existir. Se ela não vencer aqui, ela não vence em
   lugar nenhum e deve sair do motor.
   Sanitizado do padrão de peça de campanha institucional (Copa / clube de assinatura). */
(window.LUMA_CORPUS = window.LUMA_CORPUS || []).push({
  nome: 'bloco-arejado',
  origem: 'peça institucional — entrelinha larga como intenção de design',
  canvas: { w: 1080, h: 1350 },
  campos: [
    { name: 'manchete', label: 'Manchete',       example: 'A CIDADE INTEIRA PEDE AQUI', maxLen: 46 },
    { name: 'corpo',    label: 'Texto de apoio', example: 'Mais de mil restaurantes na palma da mão, com entrega rápida e cupom todo dia.', maxLen: 140 }
  ],
  layers: [
    { id:'fundo', name:'Fundo', type:'shape', shapeKind:'rect', x:0, y:0, w:1080, h:1350, fill:'#F3EFE7', visible:true, opacity:100 },
    { id:'manchete', name:'Manchete', type:'text', content:'{{manchete}}', isVar:true, x:110, y:180, w:860, h:260,
      font:'Arial', fontSize:78, lineHeight:1.45, textAlign:'left', textBox:'box', vAlign:'top',
      textTransform:'uppercase', visible:true, opacity:100, layoutRefText:'A CIDADE INTEIRA PEDE AQUI' },
    // lineHeight 1.9: o respiro É o desenho. Fechar isso descaracteriza a peça.
    { id:'corpo', name:'Corpo', type:'text', content:'{{corpo}}', isVar:true, x:110, y:520, w:700, h:340,
      font:'Arial', fontSize:30, lineHeight:1.9, textAlign:'left', textBox:'box', vAlign:'top',
      visible:true, opacity:100,
      layoutRefText:'Mais de mil restaurantes na palma da mão, com entrega rápida e cupom todo dia.' },
    { id:'cta', name:'CTA', type:'text', content:'BAIXE O APLICATIVO', x:110, y:930, w:420, h:60,
      font:'Arial', fontSize:34, lineHeight:1.2, textAlign:'left', textBox:'point', visible:true, opacity:100 },
    { id:'selo', name:'Selo', type:'shape', shapeKind:'circle', x:760, y:520, w:210, h:210,
      fill:'#FF9000', visible:true, opacity:100, locked:true },
    { id:'legal', name:'Legal', type:'text', content:'Consulte as condições no aplicativo.',
      x:110, y:1270, w:860, h:40, font:'Arial', fontSize:18, lineHeight:1.4, textAlign:'left',
      textBox:'box', visible:true, opacity:100 }
  ],
  cenarios: {
    nominal: { manchete:'A CIDADE INTEIRA PEDE AQUI',
               corpo:'Mais de mil restaurantes na palma da mão, com entrega rápida e cupom todo dia.' },
    longo:   { manchete:'A CIDADE INTEIRA JÁ PEDE POR AQUI TODO DIA',
               corpo:'Mais de mil restaurantes na palma da mão, com entrega rápida, cupom todo dia e frete grátis nas lojas participantes da sua região.' },
    extremo: { manchete:'A CIDADE INTEIRA JÁ PEDE POR AQUI TODO SANTO DIA SEM EXCEÇÃO',
               corpo:'Mais de mil restaurantes parceiros na palma da mão, com entrega rápida, cupom todo dia, frete grátis nas lojas participantes e atendimento sete dias por semana para toda a região metropolitana.' }
  }
});
