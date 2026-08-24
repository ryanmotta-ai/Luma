/* Corpus do Auto-layout — padrão "card com placa atrás do texto, dentro de grupo do PSD".
   É o caso que fez a cor sair debaixo da letra antes de a placa aprender a crescer junto.
   Sanitizado dos PSDs de cupom/entrega grátis. */
(window.LUMA_CORPUS = window.LUMA_CORPUS || []).push({
  nome: 'card-placa-grupo',
  origem: 'padrão dos PSDs "entrega grátis / aqui tem cupons"',
  canvas: { w: 1080, h: 1080 },
  campos: [
    { name: 'chamada', label: 'Chamada', example: 'ENTREGA GRÁTIS', maxLen: 32 },
    { name: 'detalhe', label: 'Detalhe da oferta', example: 'em pedidos acima de R$ 30', maxLen: 60 }
  ],
  layers: [
    { id:'fundo', name:'Fundo', type:'shape', shapeKind:'rect', x:0, y:0, w:1080, h:1080, fill:'#111111', visible:true, opacity:100 },
    { id:'grupo', name:'Card', type:'group', x:90, y:300, w:900, h:300, visible:true, opacity:100 },
    { id:'placa', name:'Placa do card', type:'shape', shapeKind:'rect', x:90, y:300, w:900, h:170,
      fill:'#FF9000', radius:24, visible:true, opacity:100, parentId:'grupo' },
    { id:'chamada', name:'Chamada', type:'text', content:'{{chamada}}', isVar:true, x:130, y:330, w:820, h:110,
      font:'Arial', fontSize:76, lineHeight:1.1, textAlign:'left', textBox:'box', vAlign:'top',
      textTransform:'uppercase', visible:true, opacity:100, parentId:'grupo', layoutRefText:'ENTREGA GRÁTIS' },
    { id:'detalhe', name:'Detalhe', type:'text', content:'{{detalhe}}', isVar:true, x:130, y:500, w:820, h:70,
      font:'Arial', fontSize:34, lineHeight:1.25, textAlign:'left', textBox:'box', vAlign:'top',
      visible:true, opacity:100, parentId:'grupo', layoutRefText:'em pedidos acima de R$ 30' },
    { id:'assinatura', name:'Logo', type:'shape', shapeKind:'rect', x:420, y:900, w:240, h:80,
      fill:'#FFFFFF', visible:true, opacity:100, locked:true }
  ],
  cenarios: {
    nominal: { chamada:'ENTREGA GRÁTIS', detalhe:'em pedidos acima de R$ 30' },
    longo:   { chamada:'ENTREGA GRÁTIS HOJE', detalhe:'em pedidos acima de R$ 30 nas lojas participantes da cidade' },
    extremo: { chamada:'ENTREGA GRATUITA POR TEMPO LIMITADO', detalhe:'válido apenas em pedidos acima de R$ 30 realizados pelo aplicativo nas lojas participantes até domingo' }
  }
});
