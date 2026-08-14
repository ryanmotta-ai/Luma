/* Corpus do Auto-layout — padrão "oferta com selo de preço".
   Sanitizado a partir das pranchetas de promo da Deskfy (nome de produto, preço e CTA sobre
   foto, com selo circular travado). Nenhum dado real de cliente, nenhuma imagem embutida:
   o que importa aqui é a GEOMETRIA e a tipografia, que é o que o solver lê. */
(window.LUMA_CORPUS = window.LUMA_CORPUS || []).push({
  nome: 'promo-preco-circulo',
  origem: 'padrão recorrente nos PSDs "rangos que baixaram o preço" / "tudo até 25"',
  canvas: { w: 1080, h: 1350 },
  campos: [
    { name: 'titulo',  label: 'Título da oferta', example: 'OFERTA DA SEMANA', maxLen: 40 },
    { name: 'produto', label: 'Nome do produto',  example: 'Combo Burger Duplo', maxLen: 48 },
    { name: 'preco',   label: 'Preço',            example: 'R$ 29,90', type: 'currency', maxLen: 12 }
  ],
  layers: [
    { id:'fundo', name:'Fundo', type:'shape', shapeKind:'rect', x:0, y:0, w:1080, h:1350, fill:'#FF9000', visible:true, opacity:100 },
    { id:'foto', name:'Foto do produto', type:'image', x:0, y:640, w:1080, h:710, visible:true, opacity:100,
      inkBox:{ x:0.18, y:0.06, w:0.64, h:0.9 } },
    { id:'titulo', name:'Título', type:'text', content:'{{titulo}}', isVar:true, x:80, y:120, w:700, h:110,
      font:'Arial', fontSize:88, lineHeight:1.1, textAlign:'left', textBox:'point', vAlign:'top',
      textTransform:'uppercase', visible:true, opacity:100,
      layoutRefText:'OFERTA DA SEMANA' },
    { id:'produto', name:'Produto', type:'text', content:'{{produto}}', isVar:true, x:80, y:260, w:620, h:140,
      font:'Arial', fontSize:58, lineHeight:1.2, textAlign:'left', textBox:'box', vAlign:'top',
      visible:true, opacity:100, layoutRefText:'Combo Burger Duplo' },
    { id:'selo', name:'Selo de preço', type:'shape', shapeKind:'circle', x:760, y:180, w:250, h:250,
      fill:'#0A0A0A', visible:true, opacity:100, locked:true },
    { id:'preco', name:'Preço', type:'text', content:'{{preco}}', isVar:true, x:772, y:265, w:226, h:80,
      font:'Arial', fontSize:56, lineHeight:1.1, textAlign:'center', textBox:'point', vAlign:'top',
      visible:true, opacity:100, layoutRefText:'R$ 29,90' },
    { id:'cta', name:'CTA', type:'text', content:'PEÇA AGORA PELO APP', x:80, y:470, w:420, h:56,
      font:'Arial', fontSize:34, lineHeight:1.2, textAlign:'left', textBox:'point', visible:true, opacity:100 },
    { id:'legal', name:'Legal', type:'text', content:'Imagens meramente ilustrativas. Consulte o regulamento no app.',
      x:80, y:1280, w:920, h:40, font:'Arial', fontSize:18, lineHeight:1.2, textAlign:'left',
      textBox:'box', visible:true, opacity:100 }
  ],
  cenarios: {
    nominal: { titulo:'OFERTA DA SEMANA', produto:'Combo Burger Duplo', preco:'R$ 29,90' },
    longo:   { titulo:'SEMANA DE OFERTAS IMPERDÍVEIS', produto:'Super Combo Duplo Mega Burger Artesanal', preco:'R$ 129,90' },
    extremo: { titulo:'PROMOÇÃO RELÂMPAGO EXCLUSIVA DE ANIVERSÁRIO', produto:'Super Combo Duplo Mega Burger Artesanal com Batata Frita Cheddar Bacon e Refrigerante', preco:'R$ 1.249,00' }
  }
});
