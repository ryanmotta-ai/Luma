/* Corpus do Auto-layout — padrão "texto sobre foto recortada".
   A caixa da foto ocupa a arte inteira, mas o assunto (o produto recortado) vive só no terço
   direito. Sem safe zone, o título crescia livre por cima do produto — a caixa estava "segura"
   e a arte, arruinada. Com `inkBox`, o obstáculo é o ASSUNTO, e o vão da esquerda continua
   disponível. É o caso que prova os dois lados da mesma regra. */
(window.LUMA_CORPUS = window.LUMA_CORPUS || []).push({
  nome: 'foto-safe-zone',
  origem: 'padrão dos PSDs com produto recortado em PNG (Coca / Copa)',
  canvas: { w: 1080, h: 1080 },
  campos: [
    { name: 'titulo', label: 'Chamada principal', example: 'GELADA NA MEDIDA', maxLen: 42 },
    { name: 'apoio',  label: 'Texto de apoio', example: 'peça já no aplicativo', maxLen: 50 }
  ],
  layers: [
    { id:'fundo', name:'Fundo', type:'shape', shapeKind:'rect', x:0, y:0, w:1080, h:1080, fill:'#C8102E', visible:true, opacity:100 },
    // A foto cobre a arte, mas o assunto opaco mora de x=0,62 a x=0,98 (o produto recortado).
    { id:'foto', name:'Produto recortado', type:'image', x:0, y:0, w:1080, h:1080, visible:true, opacity:100,
      inkBox:{ x:0.62, y:0.12, w:0.36, h:0.8 } },
    { id:'titulo', name:'Título', type:'text', content:'{{titulo}}', isVar:true, x:70, y:220, w:560, h:230,
      font:'Arial', fontSize:82, lineHeight:1.08, textAlign:'left', textBox:'box', vAlign:'top',
      textTransform:'uppercase', visible:true, opacity:100, layoutRefText:'GELADA NA MEDIDA' },
    { id:'apoio', name:'Apoio', type:'text', content:'{{apoio}}', isVar:true, x:70, y:490, w:520, h:70,
      font:'Arial', fontSize:32, lineHeight:1.25, textAlign:'left', textBox:'box', vAlign:'top',
      visible:true, opacity:100, layoutRefText:'peça já no aplicativo' },
    { id:'logo', name:'Logo Delivery Much', type:'shape', shapeKind:'rect', x:70, y:920, w:220, h:70,
      fill:'#FFFFFF', visible:true, opacity:100 }
  ],
  cenarios: {
    nominal: { titulo:'GELADA NA MEDIDA', apoio:'peça já no aplicativo' },
    longo:   { titulo:'GELADA NA MEDIDA CERTA PRA SUA SEXTA', apoio:'peça já no aplicativo e receba em casa' },
    extremo: { titulo:'A BEBIDA MAIS GELADA DA CIDADE CHEGOU PARA VOCÊ APROVEITAR', apoio:'peça já no aplicativo e receba em casa hoje mesmo sem pagar entrega' }
  }
});
