/* Corpus do Auto-layout — MATERIAL ANTIGO, sem baseline autorado.
   Nenhuma camada aqui tem `layoutRefText`/`layoutRef`: é como um template publicado antes de o
   baseline existir. A referência precisa ser reconstruída em runtime a partir do exemplo do
   campo (`gEnsureLayoutBaseline`) — se a migração parar de funcionar, este caso acusa.
   Também é o único fixture com campo OPCIONAL vazio, que fecha o vão. */
(window.LUMA_CORPUS = window.LUMA_CORPUS || []).push({
  nome: 'legado-sem-baseline',
  origem: 'template publicado antes do baseline universal (migração em runtime)',
  canvas: { w: 1080, h: 1350 },
  exigeBaselineMigrado: ['titulo', 'produto'],
  campos: [
    { name: 'titulo',   label: 'Título',  example: 'SEXTA DE PROMO', maxLen: 36 },
    { name: 'produto',  label: 'Produto', example: 'Marmita Executiva', maxLen: 40 },
    { name: 'opcional', label: 'Selo opcional', example: 'novidade', maxLen: 20 }
  ],
  layers: [
    { id:'fundo', name:'Fundo', type:'shape', shapeKind:'rect', x:0, y:0, w:1080, h:1350, fill:'#0A0A0A', visible:true, opacity:100 },
    { id:'titulo', name:'Título', type:'text', content:'{{titulo}}', isVar:true, x:90, y:180, w:780, h:120,
      font:'Arial', fontSize:80, lineHeight:1.1, textAlign:'left', textBox:'point', vAlign:'top',
      textTransform:'uppercase', visible:true, opacity:100 },
    { id:'opcional', name:'Selo', type:'text', content:'{{opcional}}', isVar:true, x:90, y:330, w:400, h:56,
      font:'Arial', fontSize:34, lineHeight:1.2, textAlign:'left', textBox:'point', vAlign:'top',
      visible:true, opacity:100 },
    { id:'produto', name:'Produto', type:'text', content:'{{produto}}', isVar:true, x:90, y:420, w:780, h:140,
      font:'Arial', fontSize:54, lineHeight:1.2, textAlign:'left', textBox:'box', vAlign:'top',
      visible:true, opacity:100 },
    { id:'cta', name:'CTA', type:'text', content:'PEÇA AGORA', x:90, y:600, w:340, h:56,
      font:'Arial', fontSize:34, lineHeight:1.2, textAlign:'left', textBox:'point', visible:true, opacity:100 },
    { id:'foto', name:'Foto', type:'image', x:0, y:760, w:1080, h:590, visible:true, opacity:100 }
  ],
  cenarios: {
    nominal:  { titulo:'SEXTA DE PROMO', produto:'Marmita Executiva', opcional:'novidade' },
    semSelo:  { titulo:'SEXTA DE PROMO', produto:'Marmita Executiva', opcional:'' },
    longo:    { titulo:'SEXTA DE PROMOÇÃO NA CIDADE', produto:'Marmita Executiva Completa com Sobremesa', opcional:'novidade da casa' }
  }
});
