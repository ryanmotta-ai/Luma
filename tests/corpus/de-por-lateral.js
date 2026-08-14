/* Corpus do Auto-layout — padrão "De R$ X por R$ Y" lado a lado, com cupom e rodapé legal.
   Dois casos difíceis no mesmo arquivo: a corrente LATERAL (o "de" empurra o "por") e a quebra
   semântica (o valor não pode se partir entre linhas). */
(window.LUMA_CORPUS = window.LUMA_CORPUS || []).push({
  nome: 'de-por-lateral',
  origem: 'padrão dos PSDs "pedido da sorte" / "rangos que baixaram o preço"',
  canvas: { w: 1080, h: 1920 },
  campos: [
    { name: 'de',      label: 'Preço antigo', example: 'De R$ 49,90 por', type:'text', maxLen: 24 },
    { name: 'por',     label: 'Preço promocional', example: 'R$ 29,90', type:'currency', maxLen: 14 },
    { name: 'cupom',   label: 'Código do cupom', example: 'MUCH30', maxLen: 12 },
    { name: 'produto', label: 'Nome do produto', example: 'Pizza Grande', maxLen: 44 }
  ],
  layers: [
    { id:'fundo', name:'Background', type:'shape', shapeKind:'rect', x:0, y:0, w:1080, h:1920, fill:'#E8231A', visible:true, opacity:100 },
    { id:'produto', name:'Produto', type:'text', content:'{{produto}}', isVar:true, x:90, y:420, w:900, h:200,
      font:'Arial', fontSize:96, lineHeight:1.05, textAlign:'left', textBox:'box', vAlign:'top',
      textTransform:'uppercase', visible:true, opacity:100, layoutRefText:'Pizza Grande' },
    { id:'de', name:'De por', type:'text', content:'{{de}}', isVar:true, x:90, y:700, w:340, h:60,
      font:'Arial', fontSize:38, lineHeight:1.2, textAlign:'left', textBox:'point', vAlign:'top',
      visible:true, opacity:100, layoutRefText:'De R$ 49,90 por' },
    { id:'por', name:'Preço', type:'text', content:'{{por}}', isVar:true, x:470, y:672, w:400, h:110,
      font:'Arial', fontSize:84, lineHeight:1.1, textAlign:'left', textBox:'point', vAlign:'top',
      visible:true, opacity:100, layoutRefText:'R$ 29,90' },
    { id:'cupomPlaca', name:'Placa do cupom', type:'shape', shapeKind:'rect', x:90, y:860, w:460, h:120,
      fill:'#FFFFFF', radius:16, visible:true, opacity:100 },
    { id:'cupom', name:'Cupom', type:'text', content:'{{cupom}}', isVar:true, x:120, y:890, w:400, h:60,
      font:'Arial', fontSize:48, lineHeight:1.1, textAlign:'left', textBox:'point', vAlign:'top',
      visible:true, opacity:100, layoutRefText:'MUCH30' },
    { id:'legal', name:'Regulamento', type:'text',
      content:'Válido até 31/12. Imagens ilustrativas. Consulte o regulamento completo no aplicativo.',
      x:90, y:1780, w:900, h:90, font:'Arial', fontSize:20, lineHeight:1.3, textAlign:'left',
      textBox:'box', visible:true, opacity:100 }
  ],
  cenarios: {
    nominal: { de:'De R$ 49,90 por', por:'R$ 29,90', cupom:'MUCH30', produto:'Pizza Grande' },
    longo:   { de:'De R$ 149,90 por', por:'R$ 109,90', cupom:'DELIVERYMUCH', produto:'Pizza Grande de Calabresa Especial' },
    extremo: { de:'De R$ 1.249,90 por', por:'R$ 1.099,90', cupom:'PROMOCAOESPECIAL', produto:'Pizza Gigante de Calabresa Especial com Borda Recheada de Catupiry' }
  }
});
