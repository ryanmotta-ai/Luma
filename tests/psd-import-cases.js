/* Browser-native, sem framework: abra tests/psd-import.html. Estes casos guardam os padrões
   de geometria de texto encontrados no corpus de PSDs reais da Deskfy. */
(async function(){
  const results=document.getElementById('results');
  const summary=document.getElementById('summary');
  const cases=[];
  const test=(name,fn)=>cases.push({name,fn});
  const assert=(condition,message)=>{if(!condition)throw new Error(message||'asserção falhou');};

  test('boxBounds antigo compartilhado é rejeitado',()=>{
    const node={left:120,top:12,right:170,bottom:54,text:{
      shapeType:'box',transform:[1,0,0,1,0,0],boxBounds:{left:0,top:0,right:320,bottom:110},
      style:{fontSize:40},paragraphStyle:{justification:'left'}
    }};
    assert(_dPsdParagraphBox(node)===null,
      'uma caixa distante da âncora dos glifos foi aceita e empilharia os fragmentos de preço');
  });

  test('caixa de parágrafo transformada e coerente é preservada',()=>{
    const node={left:105,top:24,right:246,bottom:70,text:{
      shapeType:'box',transform:[1,0,0,1,100,20],boxBounds:{left:0,top:0,right:300,bottom:100},
      style:{fontSize:36},paragraphStyle:{justification:'left'}
    }};
    const box=_dPsdParagraphBox(node);
    assert(box&&box.x===100&&box.y===20&&box.w===300&&box.h===100,
      'a caixa válida do Photoshop não sobreviveu à transformação');
  });

  test('campo importado guarda o texto autorado como referência',()=>{
    const layer=dItemToLayer({n:1,name:'Produto',kind:'text',mode:'var',varName:'produto',
      content:'Pizza Calabresa',x:20,y:30,w:240,h:60,visible:true,opacity:100,
      font:'Arial',fontSize:42,color:'#ffffff',textAlign:'left',textBox:'point'});
    assert(layer.content==='{{produto}}','a camada não virou campo do franqueado');
    assert(layer.layoutRefText==='Pizza Calabresa','o texto autorado não foi preservado para calibrar métricas');
  });

  test('convenção @campo associa com confiança máxima sem expor token',()=>{
    const fields=[{name:'precoPor',label:'Preço promocional',type:'currency'}];
    const hit=gFieldInfer({layerName:'@preco_promocional',content:'R$ 29,90',target:'text',fields});
    assert(hit.confidence==='high','@campo não recebeu confiança alta');
    assert(hit.field&&hit.field.name==='precoPor','@preco_promocional não reutilizou o campo canônico existente');
    assert(hit.source==='explicit','a convenção explícita perdeu precedência');
  });

  test('nome semântico exato reutiliza catálogo e conteúdo isolado pede decisão',()=>{
    const fields=[
      {name:'precoDe',label:'Preço original',type:'currency'},
      {name:'precoPor',label:'Preço promocional',type:'currency'}
    ];
    const named=gFieldInfer({layerName:'PREÇO POR',content:'R$ 29,90',target:'text',fields});
    assert(named.confidence==='high'&&named.field.name==='precoPor',
      'nome inequívoco não ficou pronto automaticamente');
    const contentOnly=gFieldInfer({layerName:'Texto 12',content:'R$ 29,90',target:'text',fields});
    assert(contentOnly.confidence==='medium','um preço sem contexto decidiu sozinho entre original e promocional');
    assert(contentOnly.alternatives.length>0,'a ambiguidade de preço não trouxe alternativa');
  });

  test('título de oferta oferece Produto e Headline sem decidir sozinho',()=>{
    const fields=[
      {name:'produto',label:'Produto',type:'text'},
      {name:'headline',label:'Headline',type:'text'}
    ];
    const hit=gFieldInfer({layerName:'Texto 8',content:'COMBO FAMÍLIA',target:'text',fields});
    assert(hit.confidence==='medium'&&hit.field.name==='produto',
      'o título de produto não chegou como decisão simples');
    assert(hit.alternatives.some(v=>v.name==='headline'),
      'a leitura alternativa como Headline não foi oferecida');
  });

  test('CTA e fundo permanecem fixos quando não há sinal autoral',()=>{
    const text=gFieldInfer({layerName:'Texto 4',content:'APROVEITE',target:'text',fields:[{name:'produto',label:'Produto',type:'text'}]});
    assert(text.confidence==='low'&&!text.field,'CTA virou campo só porque é texto');
    const image=gFieldInfer({layerName:'Fundo',target:'imagem',areaRatio:.95,isBackground:true,
      fields:[{name:'foto_produto',label:'Foto do produto',type:'image'}]});
    assert(image.confidence==='low','o fundo da arte voltou a virar foto do produto');
  });

  test('parser aplica alta confiança e conserva sugestão média como transitória',()=>{
    const textNode=(name,text)=>({name,left:40,top:60,right:240,bottom:120,
      text:{text,shapeType:'point',transform:[1,0,0,1,0,0],style:{fontSize:36},paragraphStyle:{justification:'left'}}});
    const explicit=dPsdParseItems({children:[textNode('@produto','Combo Família')],width:1080,height:1350},72,0,0)[0];
    assert(explicit.mode==='var'&&explicit.varName==='produto','@produto não entrou configurado');
    const ambiguous=dPsdParseItems({children:[textNode('Texto 12','R$ 29,90')],width:1080,height:1350},72,0,0)[0];
    assert(ambiguous.mode==='text'&&ambiguous.varName==='precoPor','sugestão média alterou a arte ou desapareceu');
    assert(ambiguous._fieldInference&&ambiguous._fieldInference.confidence==='medium','confiança não chegou à revisão');
  });

  test('memória aprovada vence a inferência do PSD, inclusive para manter fixo',()=>{
    const old=localStorage.getItem(_PSD_MEM_KEY);
    try{
      localStorage.setItem(_PSD_MEM_KEY,JSON.stringify({
        'preço por':{mode:'var',varName:'precoDe'},
        '@produto':{mode:'text'}
      }));
      const items=[
        {name:'Preço Por',kind:'text',mode:'var',varName:'precoPor',_defaultMode:'var'},
        {name:'@produto',kind:'text',mode:'var',varName:'produto',_defaultMode:'var'}
      ];
      _dPsdMemApply(items);
      assert(items[0].mode==='var'&&items[0].varName==='precoDe'&&items[0].varSource==='memory',
        'a escolha aprovada não venceu a nova inferência');
      assert(items[1].mode==='text'&&!items[1].varName,
        'a decisão explícita de manter fixo foi sobrescrita pela convenção @campo');
    }finally{
      if(old==null)localStorage.removeItem(_PSD_MEM_KEY);else localStorage.setItem(_PSD_MEM_KEY,old);
    }
  });

  test('memória guarda moldura aprovada e não promove inferência automática',()=>{
    const old=localStorage.getItem(_PSD_MEM_KEY);
    try{
      localStorage.removeItem(_PSD_MEM_KEY);
      _dPsdMemSave([
        {name:'Foto hero',kind:'raster',mode:'frame',varName:'foto_produto',varSource:'user',_defaultMode:'raster'},
        {name:'Produto automático',kind:'text',mode:'var',varName:'produto',varSource:'',_defaultMode:'var'}
      ]);
      const mem=_dPsdMemLoad();
      assert(mem['foto hero']&&mem['foto hero'].varName==='foto_produto',
        'a escolha de campo de imagem não foi lembrada');
      assert(!mem['produto automático'],
        'uma inferência nunca aprovada virou autoridade de memória');
    }finally{
      if(old==null)localStorage.removeItem(_PSD_MEM_KEY);else localStorage.setItem(_PSD_MEM_KEY,old);
    }
  });

  test('fallback de glifos mantém semântica de point text',()=>{
    const layer=dItemToLayer({n:2,name:'R$',kind:'text',mode:'text',content:'R$',
      x:40,y:50,w:28,h:34,visible:true,opacity:100,font:'Arial',fontSize:30,
      color:'#ffffff',textAlign:'left',textBox:'point',textBoxApprox:true});
    assert(layer.textBox!=='box','o bbox justo voltou a quebrar R$ como caixa de parágrafo');
  });

  /* ── Integridade da importação (estudo de fidelidade 05/09, §5.7) ───────────────────────
     O dedupe antigo era por APARÊNCIA: duas camadas reais com mesmo nome, caixa e conteúdo
     viravam uma só. Perder camada é silencioso e irreversível — a chave passou a ser a
     identidade do nó do PSD.                                                              */
  test('duas camadas iguais com opacidades diferentes continuam duas',()=>{
    const no=(op)=>({name:'Preço',left:40,top:60,right:240,bottom:120,opacity:op,
      text:{text:'R$ 19,90',shapeType:'point',transform:[1,0,0,1,0,0],
        style:{fontSize:36},paragraphStyle:{justification:'left'}}});
    const items=dPsdParseItems({children:[no(1),no(0.5)],width:1080,height:1350},72,0,0);
    assert(items.length===2,'o dedupe apagou uma camada real do designer (voltaram '+items.length+' item[ns])');
    assert(items[0].opacity!==items[1].opacity,'as duas camadas voltaram com a mesma opacidade');
  });

  /* ── Preservação do pixel importado (§5.2) ─────────────────────────────────────────────
     A detecção de alpha era amostrada numa grade de 50×50 e o conteúdo "opaco" virava JPEG,
     que não tem canal alpha. Recorte de borda fina passava por opaco e perdia a transparência
     sem volta.                                                                              */
  test('um pixel transparente fora da grade antiga não passa por opaco',()=>{
    const k=document.createElement('canvas');k.width=k.height=512;
    const x=k.getContext('2d');x.fillStyle='#c33';x.fillRect(0,0,512,512);
    // (7,7): a grade antiga andava de 10 em 10 a partir de (0,0) e nunca olhava aqui.
    x.clearRect(7,7,1,1);
    assert(_dPsdHasAlpha(k),'a transparência de 1px foi lida como opaca — o JPEG a destruiria');
  });

  test('alpha 254 conta como transparência',()=>{
    const k=document.createElement('canvas');k.width=k.height=8;
    const x=k.getContext('2d');x.fillStyle='rgba(200,40,40,0.996)';x.fillRect(0,0,8,8);
    assert(_dPsdHasAlpha(k),'o limiar antigo (250) tratava o antialias da borda do Photoshop como opaco');
  });

  test('raster de fonte única não passa por JPEG',()=>{
    const k=document.createElement('canvas');k.width=k.height=64;
    const x=k.getContext('2d');x.fillStyle='#1a4';x.fillRect(0,0,64,64);
    assert(_dPsdRasterURL(k,{lossless:true}).indexOf('data:image/png')===0,
      'a camada cujo pixel é a única fonte de verdade saiu recomprimida em JPEG');
    assert(_dPsdRasterURL(k).indexOf('data:image/jpeg')===0,
      'foto comum opaca deixou de usar JPEG — o custo de banda do franqueado não era pra mudar aqui');
  });

  /* ── Honestidade do selo de fidelidade (§5.1) ──────────────────────────────────────────
     A medição por cobertura com tolerância ±16 anunciava 100% para uma arte inteira em cinza
     claro comparada com branco: cada pixel, isolado, cabia na tolerância.                  */
  test('cinza claro contra branco não é anunciado como 100%',()=>{
    const chapa=(cor)=>{const k=document.createElement('canvas');k.width=k.height=64;
      const x=k.getContext('2d');x.fillStyle=cor;x.fillRect(0,0,64,64);return k;};
    const rep=_dPsdFidelity(chapa('#f0f0f0'),chapa('#ffffff'),[],64,64);
    assert(rep,'a medição não devolveu relatório');
    assert(rep.pct<100,'240 contra 255 voltou como 100% fiel — era o furo do selo');
    assert(rep.exactPct===0,'nenhum pixel é idêntico, mas o relatório disse que há');
  });

  /* ── Estágio de capacidade (rodada de arquitetura 10/09) ───────────────────────────────
     A pergunta "o Luma representa esta camada?" era respondida em seis lugares, cada um
     escrevendo o seu booleano, e a revisão remontava o veredito de doze campos soltos. Estes
     casos travam o contrato do estágio único: o nível, o motivo NOMEADO e a etapa em que a
     decisão aconteceu.                                                                      */
  test('objeto inteligente decide raster no estágio de decode, com motivo',()=>{
    const node={name:'Selo',left:0,top:0,right:80,bottom:80,smartObject:{}};
    const cap=_dPsdCapNode(node);
    assert(cap.raster===true,'objeto inteligente não pediu raster fiel');
    assert(cap.nivel==='raster','o nível do veredito não é raster');
    const m=cap.motivos.find(x=>x.code.indexOf('smart_object')===0);
    assert(m,'o motivo do raster não foi nomeado — voltamos ao booleano mudo');
    assert(m.etapa==='decode','a etapa do motivo não permite classificar o defeito');
    assert(_dPsdNeedsRaster(node)===true,'a pergunta booleana antiga deixou de ser derivada do estágio');
  });

  /* ── OBJETO INTELIGENTE: dois casos, não um (rodada 4) ─────────────────────────────────
     O parser mandava todo smart object para raster e nunca olhava o que ele é. O ag-psd
     entrega os 4 CANTOS da colocação (`placedLayer.transform`) e grava
     `nonAffineTransform` só quando há PERSPECTIVA — o que separa uma foto colocada reta
     (substituível) de um mockup deformado (o pixel é a única verdade).                    */
  test('foto colocada reta é distinguida de mockup deformado',()=>{
    // 4 cantos alinhados ao eixo: SE, SD, ID, IE de um retângulo 400×300.
    const reto={name:'Hamburguer',left:0,top:0,right:400,bottom:300,
      placedLayer:{type:'raster',width:1200,height:900,transform:[0,0,400,0,400,300,0,300]}};
    const so=_dPsdSmartObject(reto);
    assert(so.eixoAlinhado===true&&so.perspectiva===false&&so.cisalhado===false,
      'uma colocação reta foi lida como deformada');
    assert(so.substituivel===true,'a foto reta não foi marcada como substituível');
    assert(so.escala&&Math.abs(so.escala-400/1200)<0.001,
      'a escala da colocação não foi derivada da dimensão original do conteúdo');
    const capReto=_dPsdCapNode(reto);
    assert(capReto.motivos.some(m=>m.code==='smart_object_substituivel'),
      'a foto reta não recebeu o motivo que permite oferecer moldura com honestidade');
    assert(capReto.raster===true,
      'a foto reta deixou de pedir raster: o ag-psd só entrega o composto, o pixel é a única fonte');

    // Mockup: `nonAffineTransform` diferente do transform é a assinatura de perspectiva.
    const persp={name:'Mockup',left:0,top:0,right:400,bottom:300,
      placedLayer:{type:'raster',width:1200,height:900,transform:[0,0,400,0,400,300,0,300],
        nonAffineTransform:[10,20,390,0,400,300,0,280]}};
    const soP=_dPsdSmartObject(persp);
    assert(soP.perspectiva===true,'a perspectiva não foi detectada');
    assert(soP.substituivel===false,'um mockup em perspectiva foi oferecido como substituível');
    const mP=_dPsdCapNode(persp).motivos.find(m=>m.code==='smart_object');
    assert(mP&&/perspectiva/.test(mP.detalhe),'o motivo não diz QUAL deformação (veio "'+(mP&&mP.detalhe)+'")');

    // Cisalhamento: arestas que deixam de ser perpendiculares.
    const cis={name:'Torto',left:0,top:0,right:400,bottom:300,
      placedLayer:{type:'raster',width:400,height:300,transform:[0,0,400,0,460,300,60,300]}};
    assert(_dPsdSmartObject(cis).cisalhado===true,'o cisalhamento não foi detectado');
    assert(_dPsdSmartObject(cis).substituivel===false,'camada cisalhada foi oferecida como substituível');
  });

  /* ── DEPENDÊNCIA: a cadeia de recorte é um dado, e a fronteira é a IDENTIDADE do grupo ── */
  test('cadeia de recorte é resolvida uma vez e não atravessa grupos de nome igual',()=>{
    const forma=(nome,top)=>({name:nome,left:0,top:top,right:100,bottom:top+100,
      vectorFill:{type:'color',color:{r:255,g:0,b:0}},
      canvas:(()=>{const c=document.createElement('canvas');c.width=c.height=100;
        const x=c.getContext('2d');x.fillStyle='#f00';x.fillRect(0,0,100,100);return c;})()});
    const recortada=(nome,top)=>Object.assign(forma(nome,top),{clipping:true});
    /* Dois grupos com o MESMO nome — o caso comum num PSD real ("Grupo 1", "Camada 5 cópia").
       Antes a busca da base era limitada pelo NOME do grupo, então a recortada do segundo
       grupo podia encontrar a base do primeiro. */
    const grupo=(filhos)=>({name:'Grupo 1',children:filhos,
      left:0,top:0,right:100,bottom:400,opacity:1});
    const items=dPsdParseItems({children:[
      grupo([forma('Base A',0), recortada('Foto A',100)]),
      grupo([forma('Base B',200), recortada('Foto B',300)])
    ],width:1080,height:1350},72,0,0);
    const porNome=n=>items.find(i=>i.name===n);
    assert(porNome('Foto A')&&porNome('Foto B'),'as camadas recortadas não sobreviveram');
    assert(porNome('Foto A').clipBaseName==='Base A',
      'Foto A recortou pela base errada ("'+porNome('Foto A').clipBaseName+'")');
    assert(porNome('Foto B').clipBaseName==='Base B',
      'Foto B atravessou a fronteira do grupo e pegou a base do grupo de nome igual ("'
      +porNome('Foto B').clipBaseName+'")');
    // A relação viaja no item: papel na cadeia, não só o id da base.
    assert(porNome('Base A').clipRole==='base'&&porNome('Foto A').clipRole==='clipped',
      'o papel de cada camada na cadeia de recorte não foi registrado');
    assert(porNome('Foto A').clipChainSize===1,'o tamanho da cadeia não foi registrado');
  });

  test('camada comum é native e não inventa motivo',()=>{
    const cap=_dPsdCapNode({name:'Retângulo 2',left:0,top:0,right:10,bottom:10});
    assert(cap.raster===false&&cap.nivel==='native','uma forma comum recebeu veredito de perda');
    assert(cap.motivos.length===0,'motivo inventado numa camada sem perda');
  });

  test('fillOpacity com efeito é decidido UMA vez, no estágio, não na conversão',()=>{
    // A mesma regra existia em dois lugares (bloco _fxUnsup e dItemToLayer) e mutava o item
    // durante a conversão — a prévia da revisão alterava o estado que o import leria depois.
    const comFx={n:1,name:'Placa',kind:'shape',mode:'shape',x:0,y:0,w:100,h:40,visible:true,
      opacity:100,fillOpacity:0.2,shadow:true,shadowColor:'rgba(0,0,0,.5)',fill:'#FF9000'};
    const cap=_dPsdCapItem(comFx);
    assert(cap.raster===true,'fillOpacity + efeito deixou de exigir raster fiel');
    assert(cap.motivos.some(m=>m.code==='fill_opacity_with_fx'),'a regra do fillOpacity perdeu o nome');
    const L1=dItemToLayer(comFx);
    assert(L1.opacity===100,'a opacidade foi dobrada num caso que o modelo não representa');
    // Sem efeito, dobrar os dois canais num só é equivalência exata — e continua acontecendo.
    const semFx={n:2,name:'Placa',kind:'shape',mode:'shape',x:0,y:0,w:100,h:40,visible:true,
      opacity:100,fillOpacity:0.5,fill:'#FF9000'};
    const L2=dItemToLayer(semFx);
    assert(L2.opacity===50,'fillOpacity sem efeito parou de ser dobrado na opacidade');
  });

  /* ── O aviso descreve a perda REAL, não a perda de ontem (10/09) ───────────────────────
     Desde que o motor Canvas, o SVG e o DOM passaram a consumir sombra, brilho e sobreposição
     em type:'image'/'frame', sombra em imagem DEIXOU de ser perda. Um aviso que descreve perda
     inexistente ensina o designer a ignorar os avisos — então o estágio de capacidade só pode
     registrar o que de fato não é aplicado: contorno, sombra interna, brilho interno, relevo. */
  test('sombra em imagem fiel NÃO é mais declarada como perda',()=>{
    const it={n:1,name:'Selo',kind:'raster',mode:'raster',x:0,y:0,w:80,h:80,visible:true,
      opacity:100,imgUrl:'data:image/png;base64,iVBORw0KGgo=',shadow:true,shadowColor:'rgba(0,0,0,.5)'};
    _dPsdCapItem(it);
    assert(!it.capability.motivos.some(m=>m.code==='fx_only_native'),
      'o objeto inteligente com sombra voltou a ser avisado como perda — o motor já desenha essa sombra');
    assert(_dPsdCapPerdeFx(it)===false,'a revisão avisaria uma perda que não existe mais');
  });

  test('contorno e efeito interno em imagem continuam perda, com o nome de cada um',()=>{
    // Estes dependem da borda REAL do recorte (dilatação/erosão do alpha), não da caixa —
    // aproximá-los desenharia uma moldura em volta de um recorte.
    const it={n:1,name:'Selo',kind:'raster',mode:'raster',x:0,y:0,w:80,h:80,visible:true,
      opacity:100,imgUrl:'data:image/png;base64,iVBORw0KGgo=',strokeW:4,strokeColor:'#000',bevel:true};
    _dPsdCapItem(it);
    const m=it.capability.motivos.find(x=>x.code==='fx_only_native');
    assert(m,'contorno e relevo em imagem deixaram de ser registrados');
    assert(/contorno/.test(m.detalhe)&&/relevo/.test(m.detalhe),
      'o aviso não diz QUAL efeito se perde (detalhe: "'+m.detalhe+'")');
    assert(_dPsdCapPerdeFx(it)===true,'a revisão não avisaria a perda real');
    // A MESMA camada como forma editável renderiza contorno e relevo — não há perda a declarar.
    // `capability:null` de propósito: sem isso o Object.assign compartilha o livro-caixa do
    // item de cima e o caso testaria a referência, não a regra do modo.
    const comoForma=Object.assign({},it,{kind:'shape',mode:'shape',fill:'#FF9000',capability:null});
    _dPsdCapItem(comoForma);
    assert(_dPsdCapPerdeFx(comoForma)===false,'avisou perda de efeito numa camada que renderiza efeito');
  });

  test('mesclagem sem render entra como Normal COM motivo registrado',()=>{
    // _dPsdBlendMode devolve undefined de propósito p/ um modo sem render ('dissolve'), pra o
    // selo não prometer o que sai Normal. Isso era uma perda muda.
    const it=dPsdParseItems({children:[{name:'Textura',left:0,top:0,right:60,bottom:60,
      blendMode:'dissolve',text:{text:'x',shapeType:'point',transform:[1,0,0,1,0,0],
      style:{fontSize:20},paragraphStyle:{justification:'left'}}}],width:1080,height:1350},72,0,0)[0];
    assert(it&&!it.blendMode,'um modo sem render passou a ser prometido no modelo');
    assert(_dPsdCapMotivo(it,'blend_dropped'),'a mesclagem descartada não foi registrada');
  });

  test('perda conhecida não exige raster e não mente sobre o nível',()=>{
    const it={n:1,name:'Título',kind:'text',mode:'text',content:'OFERTA',x:0,y:0,w:200,h:50,
      visible:true,opacity:100,fontName:'Montserrat SemiBold',fxSatin:true};
    const cap=_dPsdCapItem(it);
    assert(cap.nivel==='native_lossy','cetim + fonte ausente não são perda de raster, mas mudam o nível');
    assert(cap.raster===false,'uma perda que o pixel também não resolve pediu raster');
    assert(cap.motivos.some(m=>m.code==='fx_satin'),'cetim perdeu o registro');
    const f=cap.motivos.find(m=>m.code==='font_missing');
    assert(f&&f.detalhe==='Montserrat SemiBold','a fonte ausente não guardou QUAL fonte faltou');
    assert(f.etapa==='fonte','erro de fonte não é classificável separado de erro de posição');
  });

  test('diagnóstico por camada devolve etapa e motivo de cada perda',()=>{
    const itens=[
      {n:1,name:'Limpa',kind:'shape',mode:'shape',x:0,y:0,w:10,h:10},
      // strokeW e não glow: brilho em imagem passou a ser renderizado e deixou de ser perda.
      {n:2,name:'Selo',kind:'raster',mode:'raster',x:0,y:0,w:10,h:10,strokeW:3,strokeColor:'#000'}
    ];
    itens.forEach(_dPsdCapItem);
    const rep=dPsdCapReport(itens);
    assert(rep.length===1&&rep[0].camada==='Selo','o relatório não isolou a camada com perda');
    assert(rep[0].motivos.some(m=>m.indexOf('conversao:fx_only_native')===0),
      'o relatório não diz em que etapa a perda aconteceu');
  });

  /* ── GEOMETRIA: o reflow leva TODA medida em px, não três (10/09) ──────────────────────
     `gReflowLayers` escalava só fontSize, radius e strokeW. Tudo o mais que o importador
     grava em pixel — tracking, cantos por-canto, e todas as medidas de sombra/brilho/relevo —
     ficava com o valor absoluto do PSD original. Como o caminho comum é importar num preset
     (Story/Feed/Wide), isso valia para quase toda arte: a geometria refluía, o respiro entre
     letras e a sombra não.                                                                */
  test('reflow escala tracking, cantos e sombra junto com a geometria',()=>{
    const l={id:'t',type:'text',x:100,y:200,w:400,h:120,fontSize:64,letterSpacing:12,
      radius:24,radii:{tl:24,tr:24,br:8,bl:8},strokeW:4,strokeDash:[12,6],
      shadowBlur:20,shadowDist:10,shadowSpread:4,glowSize:16,bevelSize:6,
      layerEffects:[{type:'dropShadow',blur:30,distance:15,spread:5},{type:'stroke',width:6}]};
    const out=gReflowLayers([l],{w:1080,h:1350},{w:1200,h:628})[0];
    const s=Math.min(1200,628)/Math.min(1080,1350);
    const perto=(a,b,tol)=>Math.abs(a-b)<=(tol||1);
    assert(perto(out.letterSpacing,Math.round(12*s)),'o tracking não acompanhou a escala ('+out.letterSpacing+')');
    assert(perto(out.radii.tl,Math.round(24*s))&&perto(out.radii.br,Math.round(8*s)),
      'os cantos por-canto ficaram no valor absoluto do PSD');
    assert(perto(out.shadowBlur,Math.round(20*s))&&perto(out.shadowDist,Math.round(10*s)),
      'a sombra saiu na escala do documento original, não da prancheta de destino');
    assert(perto(out.glowSize,Math.round(16*s))&&perto(out.bevelSize,Math.round(6*s)),
      'brilho e relevo não escalaram');
    assert(perto(out.strokeDash[0],Math.round(12*s)),'o tracejado não escalou');
    assert(perto(out.layerEffects[0].blur,Math.round(30*s))&&perto(out.layerEffects[1].width,Math.round(6*s)),
      'a pilha de efeitos do Photoshop não escalou');
  });

  test('reflow NÃO escala o que não é px, e solta o snapshot de recorte',()=>{
    const l={id:'t',type:'text',x:10,y:10,w:200,h:60,fontSize:40,lineHeight:1.15,
      shadowAngle:120,bevelAngle:45,radius:999,inkBox:{x:.1,y:.1,w:.5,h:.5},
      clipBaseSnapshot:{x:0,y:0,w:200,h:60}};
    const out=gReflowLayers([l],{w:1080,h:1350},{w:1200,h:628})[0];
    assert(out.lineHeight===1.15,'entrelinha é FATOR, não px — escalar deforma o bloco de texto');
    assert(out.shadowAngle===120&&out.bevelAngle===45,'ângulo em graus foi escalado');
    assert(out.radius===999,'o sentinela de círculo (999) virou um raio real');
    assert(out.inkBox.w===.5,'inkBox é normalizado 0..1 — não escala');
    assert(out.clipBaseSnapshot===undefined,
      'o snapshot da base de recorte sobreviveu ao reflow: ele nunca mais bateria, e o motor '
      +'perderia o vínculo vivo que reflui junto');
  });

  /* ── FONTE: quatro estados, porque cada um erra de um jeito diferente ─────────────────── */
  test('resolução de fonte separa exata, aproximada, substituída e ausente',()=>{
    // Catálogo real: dBuiltinFonts (designer/fonts.js) traz 'Obviously Wide' empacotada.
    // ⚠ 'Roboto' NÃO está nele — é o padrão do Luma, tratado por _dPsdRobotoFont, e o estágio
    // de capacidade ignora nomes /roboto/i justamente por isso.
    /* Catálogo real: dBuiltinFonts (designer/fonts.js) traz 'Obviously Wide' em peso 700 e
       'Realce' em 900. ⚠ 'Roboto' NÃO está nele — é o padrão do Luma, tratado por
       _dPsdRobotoFont, e o estágio de capacidade ignora nomes /roboto/i por isso.
       A FAMÍLIA vem antes do PESO, que é o que a definição de APPROXIMATED pede: "achou a
       família, mas não exatamente o mesmo peso/estilo". */
    const r=n=>_dPsdFontResolve(n).status;
    assert(r('Obviously Wide')==='exact','a família empacotada não foi reconhecida como exata');
    // Família + peso batem: "ObviouslyWideBold" pede Obviously Wide em 700, que é o peso
    // registrado. É exato — o arquivo que vai renderizar É o que o Photoshop pediu.
    assert(r('ObviouslyWideBold')==='exact',
      'família e peso coincidentes não foram reconhecidos como exatos');
    // Família certa, peso DIFERENTE (Realce só existe em 900) → aproximada.
    assert(r('Realce Light')==='approximated',
      'família certa com peso diferente deveria ser aproximada, não exata: o desenho da letra difere');
    assert(r('Montserrat SemiBold')==='substituted',
      'fonte ausente COM peso no nome deveria preservar o peso e ser marcada como substituída');
    assert(r('Gilroy')==='missing','fonte ausente sem peso no nome não foi marcada como ausente');
    // O peso do nome sobrevive à substituição: é o que separa 'substituted' de 'missing'.
    assert(/900|Black/i.test(_dPsdFontResolve('Gotham Black').font),
      'o peso 900 do nome não foi preservado na fonte substituída');
    assert(_dPsdRemapFont('Obviously Wide')&&!_dPsdRemapFont('Gilroy'),
      'o contrato booleano antigo (_dPsdRemapFont) deixou de ser derivado da resolução');
  });

  test('erro de fonte é classificado como fonte, nunca como geometria',()=>{
    const it={n:1,name:'Título',kind:'text',mode:'text',content:'OFERTA',x:0,y:0,w:200,h:50,
      visible:true,opacity:100,fontName:'Montserrat SemiBold',fontStatus:'substituted'};
    const cap=_dPsdCapItem(it);
    const m=cap.motivos.find(x=>x.code==='font_substituted');
    assert(m,'fonte substituída não gerou motivo próprio');
    assert(m.etapa==='fonte','a etapa não é "fonte" — a perda seria investigada como posição');
    assert(m.detalhe==='Montserrat SemiBold','o motivo não guardou QUAL fonte faltou');
    // Fonte exata não é perda: não pode gerar motivo nenhum.
    const ok={n:2,name:'Título',kind:'text',mode:'text',x:0,y:0,w:200,h:50,
      fontName:'Obviously',fontStatus:'exact'};
    assert(!_dPsdCapItem(ok).motivos.some(x=>x.code.indexOf('font_')===0),
      'fonte exata gerou aviso de perda');
  });

  /* ══ TIPOGRAFIA (rodada 3) ═══════════════════════════════════════════════════════════════
     O corpo da fonte saía de uma cascata com seis números mágicos, e três fontes de escala do
     Photoshop eram lidas como uma. Estes casos travam a FÓRMULA:
         corpoPx = style.fontSize × escalaY × fatorDeResolucao
     com escalaY = |vetor-y do transform| × verticalScale/100.                              */
  test('peso da fonte sai da tabela, não de busca por substring',()=>{
    // "SemiBold" contém "bold" e "ExtraLight" contém "light": a busca por substring errava um
    // degrau em toda a faixa intermediária, que é justamente a que o designer usa.
    const p=n=>_dPsdFontFace(n).peso;
    assert(p('Montserrat-SemiBold')===600,'SemiBold voltou '+p('Montserrat-SemiBold')+' em vez de 600');
    assert(p('Montserrat ExtraLight')===200,'ExtraLight voltou '+p('Montserrat ExtraLight')+' em vez de 200');
    assert(p('Gotham-ExtraBold')===800,'ExtraBold voltou '+p('Gotham-ExtraBold')+' em vez de 800');
    assert(p('Inter-Bold')===700&&p('Inter-Light')===300&&p('Inter-Black')===900,'a faixa direta regrediu');
    assert(p('Gotham-Book')===400,'Book é 400');
    assert(p('Helvetica')===null,'nome sem peso declarado não pode assumir 400 em silêncio');
  });

  test('família e estilo saem do nome PostScript nas quatro grafias',()=>{
    ['Montserrat-SemiBold','Montserrat SemiBold','MontserratSemiBold','Montserrat_SemiBold']
      .forEach(n=>assert(_dPsdFontFace(n).familia==='Montserrat',
        'a família não saiu limpa de "'+n+'" (veio "'+_dPsdFontFace(n).familia+'")'));
    assert(_dPsdFontFace('Gotham-BookItalic').italico===true,'itálico no nome PostScript não foi visto');
    assert(_dPsdFontFace('Gotham-BookItalic').familia==='Gotham','o itálico ficou colado na família');
    assert(_dPsdFontFace('Montserrat').italico===false,'inventou itálico onde não há');
  });

  test('a escala do painel Caractere entra no corpo, e o eixo horizontal não se perde calado',()=>{
    // verticalScale 80% num transform identidade: o corpo é 80% do valor do painel.
    const t80={text:'X',shapeType:'point',transform:[1,0,0,1,0,0],
      style:{fontSize:100,verticalScale:80,horizontalScale:80},paragraphStyle:{}};
    const m80=_dPsdTextMetrics(t80,{top:0,bottom:120},72,'X');
    assert(m80.corpo===80,'a escala vertical do painel Caractere foi ignorada (corpo '+m80.corpo+')');
    assert(m80.escala.uniforme===true,'80/80 é uniforme');
    // Condensado: 85% na horizontal, 100% na vertical → corpo pelo eixo VERTICAL, e o
    // estiramento fica registrado em vez de virar tracking.
    const cond={text:'X',shapeType:'point',transform:[1,0,0,1,0,0],
      style:{fontSize:100,horizontalScale:85},paragraphStyle:{}};
    const mc=_dPsdTextMetrics(cond,{top:0,bottom:120},72,'X');
    assert(mc.corpo===100,'o corpo deve seguir o eixo vertical, não a média dos dois');
    assert(mc.escala.uniforme===false,'85×100 não foi detectado como escala não uniforme');
    assert(Math.round(mc.escala.razao*100)===85,'a razão do estiramento não foi preservada');
  });

  test('transform escala o corpo uma vez só, sem número mágico de DPI',()=>{
    // 72dpi: nenhum fator de resolução entra.
    const t2={text:'X',shapeType:'point',transform:[2,0,0,2,0,0],style:{fontSize:30},paragraphStyle:{}};
    const m2=_dPsdTextMetrics(t2,{top:0,bottom:80},72,'X');
    assert(m2.corpo===60,'transform 2× sobre 30pt deveria dar 60px (veio '+m2.corpo+')');
    assert(m2.fatorResolucao===1,'documento a 72dpi não pode receber fator de resolução');
    /* 300dpi com transform identidade: o corpo em pontos precisa do fator res/72. O
       DISCRIMINADOR é `text.bounds` — a caixa do motor de texto, em text-space — comparada
       com o bbox de pixels da camada. Aqui 24pt × 4,1667 ≈ 100px, e a caixa de pixels
       (28,8 × 4,1667 ≈ 120) confirma que a resolução NÃO estava no transform. */
    const hi={text:'X',shapeType:'point',transform:[1,0,0,1,0,0],style:{fontSize:24},
      bounds:{left:0,top:0,right:100,bottom:28.8},paragraphStyle:{}};
    const mh=_dPsdTextMetrics(hi,{left:0,top:0,right:417,bottom:120},300,'X');
    assert(mh.corpo===100,'24pt a 300dpi deveria dar 100px (veio '+mh.corpo+')');
    assert(mh.fatorResolucao>4,'o fator de resolução não foi aplicado');
    /* Mesmo documento, mas o transform JÁ carrega a resolução (o caso que o limiar mágico
       `_tScale<1.5` tentava adivinhar): os bounds mapeados já explicam o bbox, então o fator
       tem de ser 1 — sem isso o corpo saía 4× maior. */
    const hi2={text:'X',shapeType:'point',transform:[4.1667,0,0,4.1667,0,0],style:{fontSize:24},
      bounds:{left:0,top:0,right:100,bottom:28.8},paragraphStyle:{}};
    const mh2=_dPsdTextMetrics(hi2,{left:0,top:0,right:417,bottom:120},300,'X');
    assert(mh2.corpo===100,'o corpo dobrou: a resolução foi aplicada duas vezes (veio '+mh2.corpo+')');
    assert(mh2.fatorResolucao===1,'o fator deveria ser 1 — o transform já trazia a resolução');
  });

  test('o corpo do designer nunca é trocado pelo estimado da caixa',()=>{
    /* A cascata antiga tinha uma faixa de plausibilidade (0,4× a 2,5× do estimado pela
       altura): fora dela, o corpo AUTORADO era descartado. Um "R$" de 12px num bbox alto
       caía fora e virava outro tamanho — o Photoshop dizia um número e o Luma usava outro. */
    const t={text:'R$',shapeType:'point',transform:[1,0,0,1,0,0],style:{fontSize:12},paragraphStyle:{}};
    const m=_dPsdTextMetrics(t,{top:0,bottom:200},72,'R$');
    assert(m.corpo===12,'o corpo autorado (12) foi trocado pelo estimado da caixa (veio '+m.corpo+')');
    assert(m.origem==='autorado','o corpo autorado foi marcado como estimado');
    // Sem corpo nenhum no arquivo, a estimativa acontece — e fica DECLARADA como estimativa.
    const semCorpo={text:'X',shapeType:'point',transform:[1,0,0,1,0,0],style:{},paragraphStyle:{}};
    const me=_dPsdTextMetrics(semCorpo,{top:0,bottom:120},72,'X');
    assert(me.corpo>0&&me.origem!=='autorado','estimativa sem corpo não foi marcada como estimativa');
  });

  test('tracking é milésimo de em, numa função só, sem arredondar para zero',()=>{
    // -20/1000 em sobre 62px = -1,24px. Arredondar para inteiro perdia o aperto.
    assert(_dPsdTracking(-20,62)===-1.24,'a conversão de tracking mudou (veio '+_dPsdTracking(-20,62)+')');
    // Corpo pequeno: -0,3px sobrevive em vez de virar 0.
    assert(_dPsdTracking(-20,16)===-0.32,'em corpo pequeno o tracking foi arredondado para zero');
    assert(_dPsdTracking(0,62)===0,'tracking 0 é informação e precisa continuar 0');
    // A camada e cada trecho de texto rico usam a MESMA função — era a fórmula escrita duas vezes.
    const t={text:'AB',shapeType:'point',transform:[1,0,0,1,0,0],
      style:{fontSize:62,tracking:-20},paragraphStyle:{}};
    assert(_dPsdTextMetrics(t,{top:0,bottom:80},72,'AB').tracking===-1.24,
      'a métrica da camada não usa a mesma conversão de tracking');
  });

  test('entrelinha: Auto vem do parágrafo, explícita é razão adimensional',()=>{
    // Auto é o padrão do Photoshop e `style.leading` guarda LIXO nesse caso.
    const auto={text:'X',shapeType:'point',transform:[1,0,0,1,0,0],
      style:{fontSize:40,autoLeading:true,leading:9999},paragraphStyle:{autoLeading:1.32}};
    assert(_dPsdLeading(auto,40)===1.32,'o fator do Auto não veio do parágrafo (veio '+_dPsdLeading(auto,40)+')');
    // Explícita: leading/fontSize, ambos em pontos → a resolução se cancela, nenhum DPI entra.
    const expl={text:'X',shapeType:'point',transform:[1,0,0,1,0,0],
      style:{fontSize:60,leading:66},paragraphStyle:{}};
    assert(_dPsdLeading(expl,250)===1.1,'entrelinha explícita não é a razão em pontos (veio '+_dPsdLeading(expl,250)+')');
    assert(_dPsdLeading(expl,60)===_dPsdLeading(expl,600),
      'a entrelinha explícita variou com o corpo em pixel — a razão em pontos é adimensional');
  });

  test('centavos elevados sobrevivem: baselineShift entra por trecho, não na geometria',()=>{
    const t={text:'R$ 29,90',shapeType:'point',transform:[1,0,0,1,0,0],
      style:{fontSize:60},paragraphStyle:{},
      styleRuns:[
        {length:6,style:{fontSize:60,fillColor:{r:255,g:255,b:255}}},
        {length:2,style:{fontSize:36,baselineShift:14,fillColor:{r:255,g:255,b:255}}}
      ]};
    const runs=_dPsdRichRuns(t,72,80);
    assert(runs&&runs.length===2,'os trechos de estilo não sobreviveram');
    // Canvas cresce para baixo: elevar exige offset NEGATIVO.
    assert(runs[1].yOffset===-14,'o deslocamento de baseline do trecho não virou yOffset (veio '+runs[1].yOffset+')');
    assert(runs[0].yOffset===0,'inventou deslocamento num trecho sem baselineShift');
    /* ⛔ E NÃO pode entrar na geometria da camada: node.top/bottom é o bbox de PIXELS, que já
       saiu do Photoshop com o deslocamento aplicado. Somá-lo de novo aplicaria a mesma
       transformação duas vezes. */
    const it=dPsdParseItems({children:[{name:'Preço',left:40,top:60,right:340,bottom:140,text:t}],
      width:1080,height:1350},72,0,0)[0];
    assert(it.baselineShift===undefined,
      'o deslocamento de baseline foi gravado na camada de estilo único — dobraria com o bbox');
  });

  /* ══ MÁSCARAS: os parâmetros que o Photoshop grava e o worker descartava (rodada 4) ══════
     `userMaskDensity`, `userMaskFeather` e `positionRelativeToLayer` são lidos pelo ag-psd e
     ficavam de fora da lista branca que atravessa o Web Worker — então uma máscara a 50% de
     densidade escondia 100%, uma máscara com difusão entrava dura, e uma máscara marcada como
     relativa à camada tinha o offset calculado no espaço errado.                            */
  const _mkCanvas=(tom)=>{ const c=document.createElement('canvas'); c.width=c.height=40;
    const x=c.getContext('2d'); x.fillStyle=tom; x.fillRect(0,0,40,40); return c; };
  const _alphaEm=(cv,px,py)=>cv.getContext('2d').getImageData(px,py,1,1).data[3];

  test('densidade da máscara é a opacidade dela, não é ignorada',()=>{
    const caixa={x:0,y:0,w:40,h:40};
    // Máscara toda PRETA = esconde tudo. Com densidade 100%, alpha 0 (invisível).
    const cheia=_dPsdMaskToBox({canvas:_mkCanvas('#000'),left:0,top:0,defaultColor:0},caixa,caixa);
    assert(_alphaEm(cheia,20,20)===0,'máscara preta com densidade cheia deveria esconder por completo');
    // Densidade 50% → esconde metade: o alpha sobe para ~128.
    const meia=_dPsdMaskToBox({canvas:_mkCanvas('#000'),left:0,top:0,defaultColor:0,density:0.5},caixa,caixa);
    const a=_alphaEm(meia,20,20);
    assert(a>120&&a<136,'densidade 50% não levantou o piso do alpha (veio '+a+', esperado ~128)');
    // Densidade 0 → a máscara não esconde nada.
    const zero=_dPsdMaskToBox({canvas:_mkCanvas('#000'),left:0,top:0,defaultColor:0,density:0},caixa,caixa);
    assert(_alphaEm(zero,20,20)===255,'densidade 0 deveria deixar o conteúdo inteiro visível');
  });

  test('máscara relativa à camada mede a partir da camada, não do documento',()=>{
    /* A camada vive em (100,100). A máscara marcada como relativa tem left/top 0, que
       significa "no canto da camada" — não "no canto do documento". Sem honrar a flag, a
       máscara era desenhada 100px fora e a camada aparecia inteira (ou inteira escondida). */
    const caixaCamada={x:100,y:100,w:40,h:40};
    const rel=_dPsdMaskToBox({canvas:_mkCanvas('#000'),left:0,top:0,defaultColor:255,relativa:true},
      caixaCamada,caixaCamada);
    assert(_alphaEm(rel,20,20)===0,
      'a máscara relativa não caiu sobre a camada — o offset foi calculado no espaço do documento');
    // A MESMA máscara sem a flag é absoluta: em (0,0) do documento, longe da camada, então a
    // caixa fica com o defaultColor (255 = visível).
    const abs=_dPsdMaskToBox({canvas:_mkCanvas('#000'),left:0,top:0,defaultColor:255},
      caixaCamada,caixaCamada);
    assert(_alphaEm(abs,20,20)===255,'uma máscara absoluta longe da camada não deveria escondê-la');
  });

  test('difusão da máscara vira desfoque do alpha, não borda dura',()=>{
    // Metade preta / metade branca: com difusão, a transição deixa de ser um degrau.
    const c=document.createElement('canvas'); c.width=c.height=40;
    const x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,40,40);
    x.fillStyle='#000'; x.fillRect(0,0,20,40);
    const caixa={x:0,y:0,w:40,h:40};
    const dura=_dPsdMaskToBox({canvas:c,left:0,top:0,defaultColor:0},caixa,caixa);
    const suave=_dPsdMaskToBox({canvas:c,left:0,top:0,defaultColor:0,feather:12},caixa,caixa);
    // Na borda (x=20) a dura salta de 0 para 255; a suave passa por valores intermediários.
    const bordaDura=_alphaEm(dura,17,20), bordaSuave=_alphaEm(suave,17,20);
    assert(bordaDura===0,'a máscara sem difusão deveria ser um degrau nesse ponto');
    assert(bordaSuave>bordaDura,
      'a difusão não amaciou a borda (dura '+bordaDura+' vs suave '+bordaSuave+')');
  });

  /* ── VETOR: forma com furo continua editável (§21) ─────────────────────────────────────
     O Photoshop guarda um buraco como subcaminho `operation:'subtract'`. Antes qualquer
     operação diferente de 'combine' reprovava a forma inteira e ela caía no recorte raster —
     todo anel, letra vazada ou moldura perdia a geometria.                                  */
  test('subcaminho subtraído preserva o furo em vez de cair no raster',()=>{
    const quad=(x0,y0,x1,y1)=>({knots:[
      {points:[x0,y0,x0,y0,x0,y0]},{points:[x1,y0,x1,y0,x1,y0]},
      {points:[x1,y1,x1,y1,x1,y1]},{points:[x0,y1,x0,y1,x0,y1]}]});
    const anel={left:0,top:0,right:100,bottom:100,vectorMask:{paths:[
      Object.assign(quad(0,0,100,100),{operation:'combine'}),
      Object.assign(quad(25,25,75,75),{operation:'subtract'})
    ]}};
    const vp=_dPsdEditableVectorPath(anel,false);
    assert(vp,'a forma com furo foi reprovada e cairia no recorte raster');
    assert(vp.paths.length===2,'o subcaminho do furo não sobreviveu');
    assert(vp.fillRule==='evenodd',
      'sem evenodd o furo fecha: com nonzero as duas bordas somam (veio "'+vp.fillRule+'")');
    // intersect e exclude continuam reprovando: não têm equivalente em regra de preenchimento.
    const inter={left:0,top:0,right:100,bottom:100,vectorMask:{paths:[
      Object.assign(quad(0,0,100,100),{operation:'combine'}),
      Object.assign(quad(25,25,75,75),{operation:'intersect'})
    ]}};
    assert(_dPsdEditableVectorPath(inter,false)===null,
      'intersect foi aceito como se fosse subtract — encheria ou apagaria área');
  });

  /* ── CADEIA DE DIAGNÓSTICO: desligada não custa nada, ligada responde "onde divergiu" ── */
  test('a cadeia é desligada por padrão e registra as sete etapas quando ligada',()=>{
    const no={name:'Título',left:40,top:60,right:340,bottom:140,blendMode:'multiply',
      text:{text:'COMBO FAMÍLIA',shapeType:'box',transform:[1,0,0,1,0,0],
        boxBounds:{left:40,top:60,right:340,bottom:140},
        style:{fontSize:48,font:{name:'Montserrat SemiBold'}},paragraphStyle:{justification:'left'}}};
    // Desligada: nenhum item carrega cadeia — o custo é um `if` de booleano por ponto.
    const semTrace=dPsdParseItems({children:[no],width:1080,height:1350},72,0,0)[0];
    assert(!semTrace.trace,'a cadeia veio ligada por padrão — diagnóstico não pode custar no caminho normal');
    dPsdTrace(true);
    try{
      const it=dPsdParseItems({children:[no],width:1080,height:1350},72,0,0)[0];
      assert(it.trace&&it.trace.length,'ligar dPsdTrace(true) não registrou nada');
      const etapas=it.trace.map(t=>t.etapa);
      ['decode','dependencias','normalize','geometria','capacidade'].forEach(e=>
        assert(etapas.indexOf(e)>=0,'a etapa "'+e+'" não entrou na cadeia (veio: '+etapas.join(',')+')'));
      const dec=it.trace.find(t=>t.etapa==='decode');
      assert(dec.mesclagemCrua==='multiply','o decode não guardou a mesclagem CRUA do ag-psd');
      assert(/40,60/.test(dec.caixaDoc),'o decode não guardou a caixa em coordenadas de documento');
      const geo=it.trace.find(t=>t.etapa==='geometria');
      assert(geo.caixaGlifos&&geo.caixaAutorada,
        'a geometria não separou contorno dos glifos de caixa autorada — é a distinção que evita '
        +'consertar erro de fonte mexendo em posição');
      assert(/autorada/.test(geo.venceu),'a caixa do parágrafo do Photoshop não venceu, e ela era válida');
      const nor=it.trace.find(t=>t.etapa==='normalize');
      /* O normalize é o laudo tipográfico: FONTE pedida × usada, e o CORPO com cada fator da
         fórmula visível. É o que permite responder "o texto está diferente por causa da fonte
         ou por causa da métrica?" sem depurar por tentativa e erro. */
      assert(nor.fonteStatus==='substituted','o normalize não registrou o estado da fonte');
      assert(nor.fontePedida==='Montserrat SemiBold'&&nor.familia==='Montserrat',
        'a fonte PEDIDA e a família não foram preservadas como conceitos separados');
      assert(nor.pesoPedido===600,'o peso pedido não foi registrado (veio '+nor.pesoPedido+')');
      assert(nor.corpoPt===48&&nor.corpoPx===48,'o corpo não foi registrado em pontos E em pixel');
      assert(nor.escalaTransformY===1&&nor.escalaPainelY===1&&nor.fatorResolucao===1,
        'os três fatores da fórmula do corpo não estão todos visíveis no laudo');
      assert(nor.origemDoCorpo==='autorado','o corpo autorado foi marcado como estimado');
      assert(typeof nor.porqueResolucao==='string'&&nor.porqueResolucao.length,
        'o laudo não diz POR QUE o fator de resolução é o que é');
      // A conversão é a última etapa e só entra quando dItemToLayer roda.
      dItemToLayer(it);
      assert(it.trace.some(t=>t.etapa==='conversao'),'a etapa de conversão não fecha a cadeia');
    } finally { dPsdTrace(false); }
  });

  test('sem referência o selo mostra não verificado',()=>{
    const host=document.createElement('div');host.id='d-psd-modal';
    host.innerHTML='<span class="psd-fidelity-badge"><span></span>Fiel ao arquivo</span>';
    document.body.appendChild(host);
    try{
      _dPsdShowFidelity(null);
      const texto=host.querySelector('.psd-fidelity-badge').textContent;
      assert(/não verificado/i.test(texto),'sem composto para comparar, o selo continuou aprovando o arquivo: "'+texto+'"');
    }finally{ host.remove(); }
  });


  /* ── ATENÇÃO: o segundo eixo (10/09) ──────────────────────────────────────────────────
     O livro-caixa diz COMO a camada foi convertida. Estes casos guardam a outra pergunta,
     que é a do designer: PRECISO FAZER ALGO? As duas se confundiam, e a confusão custava nos
     dois sentidos — textura decorativa em raster fiel virava trabalho inventado, e headline
     com fonte trocada aparecia com o mesmo peso de um aviso de cetim. */
  const _at=(it)=>{ it.include=(it.include!==false); if(!it.capability) _dPsdCapDe(it); return it; };
  const _marca=(it,code,det)=>{ _dPsdCapMarca(_dPsdCapDe(it),code,det); return it; };

  test('raster fiel NÃO é problema do designer',()=>{
    // O pixel de um objeto inteligente deformado É o composto do Photoshop: a arte está igual.
    // Chamar isso de aviso ensina o designer a ignorar avisos.
    const it=_at({n:1,name:'Embalagem',kind:'raster',mode:'raster',x:0,y:0,w:300,h:300});
    _marca(it,'smart_object');
    const r=dPsdImportResult([{nome:'Arte',items:[it]}]);
    assert(r.status==='ok','raster fiel derrubou o status da importação');
    assert(r.precisaRevisao===0,'raster fiel entrou na conta de revisão');
    assert(r.atencoes.length===1&&r.atencoes[0].nivel==='info',
      'a decisão sumiu do resultado — informar COMO foi convertido continua obrigatório');
    assert(r.resumo.raster===1&&r.resumo.native===0,'o resumo perdeu o nível de capacidade da camada');
  });

  test('texto que virou imagem PEDE atenção mesmo com a arte igual',()=>{
    // Os dois eixos são independentes: visual preservado, editabilidade achatada. É o caso que
    // prova por que um eixo só não serve — aquela camada deixou de poder ser um campo.
    const it=_at({n:1,name:'Selo girado',kind:'text',mode:'raster',content:'50% OFF',x:0,y:0,w:200,h:80,fontSize:40});
    _marca(it,'text_warp');
    const r=dPsdImportResult([{nome:'Arte',items:[it]}]);
    const a=r.atencoes[0];
    assert(r.precisaRevisao===1&&a.nivel==='review','texto deformado virou imagem em silêncio');
    assert(a.visual==='preservado','o eixo visual mentiu: a deformação está nos pixels, fiel');
    assert(a.editabilidade==='achatada','o eixo de editabilidade não registrou a perda real');
    assert(a.categoria==='texto_imagem','a categoria errada escolheria a ação errada');
  });

  test('prominência tipográfica eleva o aviso; letra miúda de rodapé o reduz',()=>{
    const head=_marca(_at({n:1,name:'Headline',kind:'text',mode:'text',x:0,y:0,w:600,h:120,fontSize:96}),'fx_satin');
    const corpo=_at({n:2,name:'Corpo',kind:'text',mode:'text',x:0,y:0,w:400,h:60,fontSize:24});
    const rodape=_marca(_at({n:3,name:'Regulamento',kind:'text',mode:'text',x:0,y:0,w:400,h:20,fontSize:10}),'font_missing','Gotham Book');
    const r=dPsdImportResult([{nome:'Arte',items:[head,corpo,rodape]}]);
    const aHead=r.atencoes.find(a=>a.itemN===1), aRod=r.atencoes.find(a=>a.itemN===3);
    assert(aHead&&aHead.nivel==='review','cetim na headline ficou no mesmo peso de cetim numa textura');
    assert(aRod&&aRod.nivel==='info','aviso de fonte em 3 linhas de regulamento ocupou o lugar de um aviso real');
    assert(r.precisaRevisao===1,'a conta de revisão não seguiu a relevância estrutural');
  });

  test('camada já ligada a um campo eleva qualquer adaptação',()=>{
    // Quem ligou o campo disse que aquilo varia — o conteúdo vai mudar e a adaptação vai
    // aparecer em toda peça da campanha. Sinal que JÁ existe, não classificação nova.
    const solto=_marca(_at({n:1,name:'Fundo',kind:'raster',mode:'raster',x:0,y:0,w:100,h:100}),'fx_satin');
    const campo=_marca(_at({n:2,name:'Foto',kind:'raster',mode:'frame',varName:'fotoProduto',x:0,y:0,w:100,h:100}),'fx_satin');
    const r=dPsdImportResult([{nome:'Arte',items:[solto,campo]}]);
    assert(r.atencoes.find(a=>a.itemN===1).nivel==='info','adaptação em camada fixa virou trabalho');
    assert(r.atencoes.find(a=>a.itemN===2).nivel==='review','adaptação num campo do franqueado passou calada');
  });

  test('três adaptações da mesma natureza são UM aviso, não três',()=>{
    const it=_at({n:1,name:'Placa',kind:'shape',mode:'shape',x:0,y:0,w:200,h:80});
    _marca(it,'fx_satin'); _marca(it,'fx_contour'); _marca(it,'fx_scale');
    const r=dPsdImportResult([{nome:'Arte',items:[it]}]);
    assert(r.atencoes.length===1,'a mesma camada abriu '+r.atencoes.length+' avisos para a mesma ação');
    assert(r.atencoes[0].categoria==='efeito','o agrupamento perdeu a categoria');
  });

  test('só a camada irrepresentável bloqueia, e o status diz isso',()=>{
    const it=_at({n:1,name:'Camada exótica',kind:'raster',mode:'raster',x:0,y:0,w:100,h:100});
    _marca(it,'sem_representacao');
    const r=dPsdImportResult([{nome:'Arte',items:[it]}]);
    assert(r.status==='bloqueado','a única camada que o motor não preservou não bloqueou o status');
    assert(r.atencoes[0].nivel==='blocking','o nível bloqueante não chegou na tela');
    assert(r.atencoes[0].visual==='perdido'&&r.atencoes[0].editabilidade==='perdida',
      'perder tudo foi reportado como "entrou como imagem" — e não entrou nem como imagem');
    assert(r.resumo.preservadas===0,'o resumo contou como preservada uma camada que não existe na arte');
  });

  test('divergência com causa conhecida entra no aviso; sem causa abre item próprio',()=>{
    const comCausa=_marca(_at({n:1,name:'Título',kind:'text',mode:'text',x:0,y:0,w:400,h:90,fontSize:72,
      fontName:'Gotham Black'}),'font_missing','Gotham Black');
    const limpa=_at({n:2,name:'Foto',kind:'raster',mode:'raster',x:0,y:0,w:300,h:300});
    const r=dPsdImportResult([{nome:'Arte',items:[comCausa,limpa]}],
      {divergencias:[{prancheta:0,itemN:1,pct:41,camada:'Título',kind:'text'},
                     {prancheta:0,itemN:2,pct:33,camada:'Foto',kind:'raster'}]});
    const a1=r.atencoes.find(a=>a.itemN===1), a2=r.atencoes.find(a=>a.itemN===2);
    assert(r.atencoes.filter(a=>a.itemN===1).length===1,
      'a mesma fonte trocada apareceu duas vezes: uma como decisão, outra como surpresa');
    assert(a1.divergencia===41,'o número medido não entrou dentro do aviso que o explica');
    assert(a1.categoria==='fonte','a divergência roubou a categoria de quem tem a causa');
    assert(a2&&a2.semCausa===true&&a2.categoria==='divergencia',
      'divergência sem causa conhecida ficou muda — a arte está diferente e ninguém avisou');
    assert(/nenhuma adaptação conhecida/i.test(a2.explicacao),'o motor inventou um culpado');
    assert(r.pranchetas[0].revisao===2,
      'a divergência sem causa não entrou na conta da prancheta — a aba mostraria menos do que existe');
  });

  test('resultado sem medição de pixels sai completo do mesmo jeito',()=>{
    // A engine produz o resultado exista ou não tela: a medição precisa de canvas, o veredito não.
    const it=_marca(_at({n:1,name:'Título',kind:'text',mode:'text',x:0,y:0,w:400,h:90,fontSize:72}),'font_substituted','Gotham');
    const r=dPsdImportResult([{nome:'Arte',items:[it]}]);
    assert(r.atencoes.length===1&&r.precisaRevisao===1,'sem medição o resultado veio vazio');
    assert(r.atencoes[0].divergencia===undefined,'inventou um número de divergência que ninguém mediu');
  });

  test('multi-prancheta: cada prancheta responde pela sua conta e o item traz o endereço',()=>{
    const a=_marca(_at({n:1,name:'Headline A',kind:'text',mode:'text',x:0,y:0,w:600,h:120,fontSize:96}),'font_missing','Gotham');
    const b=_marca(_at({n:1,name:'Foto B',kind:'raster',mode:'raster',x:0,y:0,w:300,h:300}),'smart_object');
    const r=dPsdImportResult([{nome:'Story',items:[a]},{nome:'Feed',items:[b]}]);
    assert(r.pranchetas.length===2,'a estrutura multi-prancheta não é a mesma da prancheta única');
    assert(r.pranchetas[0].atencoes===1&&r.pranchetas[1].atencoes===1,'a conta por prancheta se perdeu');
    // A aba mostra `revisao`, não `atencoes`: a prancheta cuja única decisão é informativa
    // não pode ganhar um número laranja dizendo que tem problema.
    assert(r.pranchetas[0].revisao===1&&r.pranchetas[1].revisao===0,
      'a aba da prancheta marcaria problema onde só houve uma decisão informativa');
    assert(r.precisaRevisao===1,'a atenção informativa da segunda prancheta entrou na conta de revisão');
    const at=r.atencoes.find(x=>x.nivel==='review');
    assert(at.prancheta===0&&at.pranchetaNome==='Story',
      'o item não sabe em que prancheta mora — clicar nele abriria a errada');
  });

  test('camada fora do import sai do resultado inteiro',()=>{
    const fora={n:1,name:'Rascunho',kind:'raster',mode:'raster',x:0,y:0,w:100,h:100,include:false};
    _dPsdCapMarca(_dPsdCapDe(fora),'sem_representacao');
    const r=dPsdImportResult([{nome:'Arte',items:[fora]}]);
    assert(r.status==='ok'&&!r.atencoes.length,'camada desmarcada continuou bloqueando a importação');
    assert(r.resumo.camadas===0,'o resumo contou uma camada que não vai ser importada');
  });

  test('nenhuma explicação vaza o vocabulário do motor',()=>{
    // O designer resolve o problema sem aprender `raster`, `native_lossy` ou nome de código.
    const proibido=/raster|native|unsupported|capability|fallback|_[a-z]+_[a-z]+|fx_|blend_/i;
    _DPSD_ATENCAO_CATS.forEach(c=>{
      const txt=c.titulo+' '+c.texto({name:'x'});
      assert(!proibido.test(txt),'a categoria "'+c.id+'" fala a língua do motor: "'+txt+'"');
      assert(/^[A-ZÀ-Ú]/.test(c.titulo)&&c.titulo.length<=52,
        'o título da categoria "'+c.id+'" não é uma frase curta em PT-BR: "'+c.titulo+'"');
      assert(['fonte','ciente','ver'].indexOf(c.acao)>=0,'a categoria "'+c.id+'" não tem ação contextual');
    });
  });


  test('TODO motivo do livro-caixa tem categoria de atenção — nenhum cai no vazio',()=>{
    // _dPsdCatDe devolvendo null DESCARTA a atenção em silêncio. Um motivo novo sem categoria
    // seria uma perda que o motor conhece e a tela nunca mostra — o pior modo de falhar.
    const orfaos=Object.keys(_DPSD_CAP_MOTIVOS).filter(c=>!_dPsdCatDe(c));
    assert(!orfaos.length,'motivos sem categoria (a atenção deles seria descartada calada): '+orfaos.join(', '));
  });

  test('o selo da lista lê o veredito do motor, não a flag crua da camada',()=>{
    // A mesma condição escrita duas vezes — no estágio que decide e na tela que desenha — é
    // como nasceram as verdades paralelas de fidelidade. A tela agora só traduz o motivo.
    const semLivro={n:1,name:'Placa',kind:'shape',mode:'shape',x:0,y:0,w:100,h:40,fxSatin:true};
    assert(_dPsdSelos(semLivro)==='','a tela voltou a decidir a perda por conta própria');
    const comLivro=Object.assign({},semLivro,{capability:null});
    _dPsdCapItem(comLivro);
    assert(/Cetim/.test(_dPsdSelos(comLivro)),'o motivo registrado pelo estágio não chegou na lista');
    assert(/title="Cetim não tem equivalente"/.test(_dPsdSelos(comLivro)),
      'a explicação técnica do selo não vem do rótulo do próprio motivo');
  });


  /* ── SMART MAPPING: significado do conteúdo (10/09, rodada 6) ─────────────────────────
     `gFieldInfer` olha UMA camada. Estes casos guardam a evidência que só existe ENTRE elas
     — e a fronteira que ela não atravessa: sem discriminante, a resposta é uma pergunta, não
     um palpite. */
  const _L=(o)=>Object.assign({visible:true,opacity:100,w:300,h:60},o);
  const _lote=(layers,opts)=>gFieldInferBatch(layers,Object.assign({fields:[]},opts||{}));
  const _mapa=(r)=>{const o={};r.forEach(x=>o[x.layer.id]=x.field.name+'/'+x.confidence);return o;};

  test('o par DE/POR resolve os dois preços que camada a camada ficariam ambíguos',()=>{
    const r=_mapa(_lote([
      _L({id:'de',type:'text',name:'Copy 3',content:'DE R$ 49,90',fontSize:32}),
      _L({id:'por',type:'text',name:'Copy 4',content:'POR R$ 29,90',fontSize:64})
    ]));
    assert(r.de==='precoDe/high','o valor anterior do par não foi reconhecido: '+r.de);
    assert(r.por==='precoPor/high','o valor que vale não foi reconhecido: '+r.por);
  });

  test('o texto tachado é o preço anterior mesmo sem a palavra "de"',()=>{
    const r=_mapa(_lote([
      _L({id:'a',type:'text',name:'t1',content:'R$ 49,90',fontSize:60,strikethrough:true}),
      _L({id:'b',type:'text',name:'t2',content:'R$ 29,90',fontSize:60})
    ]));
    assert(r.a==='precoDe/high'&&r.b==='precoPor/high','o risco no texto deixou de ser evidência: '+JSON.stringify(r));
  });

  test('dois preços SEM discriminante viram uma pergunta com as duas leituras, não um palpite',()=>{
    // Adivinhar aqui troca o valor que o franqueado vê na arte publicada. O custo de perguntar
    // é um clique; o de errar é uma peça errada no ar.
    const out=_lote([
      _L({id:'a',type:'text',name:'t1',content:'R$ 49,90',fontSize:60}),
      _L({id:'b',type:'text',name:'t2',content:'R$ 29,90',fontSize:60})
    ]);
    assert(out.length===2&&out.every(x=>x.confidence==='medium'),
      'aplicou preço sozinho sem nenhuma evidência de qual é qual');
    assert(out.every(x=>(x.alternatives||[]).some(a=>a.name==='precoDe')),
      'a pergunta não oferece a segunda leitura — o designer não tem como responder');
  });

  test('preço sozinho é o preço que vale, e não é palpite',()=>{
    // "Preço original" só existe em relação a outro preço; um valor único numa peça de oferta
    // É o de venda. A evidência contrária continua vencendo.
    const um=_mapa(_lote([_L({id:'a',type:'text',name:'txt',content:'R$ 19,90',fontSize:60})]));
    assert(um.a==='precoPor/high','o preço único da arte não foi resolvido: '+um.a);
    const risc=_mapa(_lote([_L({id:'a',type:'text',name:'txt',content:'R$ 19,90',fontSize:60,strikethrough:true})]));
    assert(risc.a==='precoDe/high','o risco no texto perdeu para a regra do preço único: '+risc.a);
  });

  test('a regra do par NUNCA sobrescreve a convenção escrita no Photoshop',()=>{
    // O bug que este caso trava: `@preco_original` num corpo grande e `@preco_promocional`
    // num corpo pequeno faziam a regra de destaque tipográfico TROCAR os dois campos — a
    // convenção explícita do designer perdia para uma heurística.
    const r=_mapa(_lote([
      _L({id:'a',type:'text',name:'@preco_original',content:'R$ 49,90',fontSize:80}),
      _L({id:'b',type:'text',name:'@preco_promocional',content:'R$ 29,90',fontSize:30})
    ]));
    assert(r.a==='precoDe/high'&&r.b==='precoPor/high',
      'a convenção @campo foi sobrescrita pela regra de contexto: '+JSON.stringify(r));
  });

  test('um preço explícito resolve o outro do par por complemento',()=>{
    const r=_mapa(_lote([
      _L({id:'a',type:'text',name:'@preco_original',content:'R$ 49,90',fontSize:32}),
      _L({id:'b',type:'text',name:'Copy 7',content:'R$ 29,90',fontSize:32})
    ]));
    assert(r.a==='precoDe/high','a convenção do primeiro se perdeu');
    assert(r.b==='precoPor/high','o complemento do par não foi deduzido: '+r.b);
  });

  test('chamada para ação continua conteúdo fixo',()=>{
    // §11: nem todo texto vira campo. Sem evidência de personalização, ficar fixo é a
    // resposta certa — e transformar "PEÇA AGORA" em campo é trabalho inventado.
    const out=_lote([
      _L({id:'a',type:'text',name:'Layer 42',content:'PEÇA AGORA',fontSize:28}),
      _L({id:'b',type:'text',name:'Layer 43',content:'APROVEITE',fontSize:24})
    ]);
    assert(!out.length,'uma chamada para ação virou campo: '+JSON.stringify(_mapa(out)));
  });

  test('data com contexto de validade é validade; data solta não é',()=>{
    const com=_mapa(_lote([_L({id:'a',type:'text',name:'Shape 12',content:'VÁLIDO ATÉ 30/09',fontSize:18})]));
    assert(com.a==='validade/high','"válido até" no próprio texto não resolveu a data: '+com.a);
    const sem=_lote([_L({id:'a',type:'text',name:'Layer 3',content:'30/09',fontSize:18})]);
    assert(!sem.length||sem[0].confidence!=='high',
      'uma data solta foi aplicada como validade sem nenhum contexto');
  });

  test('a foto principal exige a pista do Photoshop para ser automática',()=>{
    const ab={w:1080,h:1350};
    const img=()=>_L({id:'f',type:'image',name:'Objeto Inteligente 3',w:480,h:480});
    const sem=_lote([img()],{artboard:ab});
    assert(sem.length===1&&sem[0].confidence==='medium',
      'imagem sem pista nenhuma foi ligada sozinha — o franqueado receberia pedido de foto para um grafismo');
    const com=_lote([img()],{artboard:ab, pistas:{f:{fotoColocada:true}}});
    assert(com[0].field.name==='foto_produto'&&com[0].confidence==='high',
      'a pista de objeto inteligente com foto reta não virou decisão: '+JSON.stringify(_mapa(com)));
  });

  test('várias imagens candidatas não viram nenhuma decisão',()=>{
    // §80: arte correta com menos automação é melhor que automação errada.
    const out=_lote([
      _L({id:'a',type:'image',name:'Img 1',w:400,h:400}),
      _L({id:'b',type:'image',name:'Img 2',w:380,h:380})
    ],{artboard:{w:1080,h:1350}});
    assert(!out.length,'escolheu uma entre imagens indistinguíveis: '+JSON.stringify(_mapa(out)));
  });

  test('o mesmo campo em duas camadas com textos diferentes deixa a mais fraca em revisão',()=>{
    const out=_lote([
      _L({id:'a',type:'text',name:'@produto',content:'COMBO FAMÍLIA',fontSize:80}),
      _L({id:'b',type:'text',name:'produto',content:'PIZZA GRANDE',fontSize:30})
    ]);
    const altas=out.filter(x=>x.field.name==='produto'&&x.confidence==='high');
    assert(altas.length===1,'duas camadas com textos diferentes foram ligadas ao mesmo campo');
    assert(altas[0].layer.id==='a','a evidência mais forte (convenção explícita) não venceu');
  });

  /* ── A PONTE: o resultado da análise vai para o caminho canônico, e nada mais ─────────── */
  const _it=(o)=>Object.assign({include:true,visible:true,opacity:100,x:0,y:0,w:300,h:60},o);

  test('alta confiança grava no MESMO par que um clique do designer gravaria',()=>{
    // Zero caminho novo de persistência: `it.varName` + `it.mode` é o que `dItemToLayer` já
    // converte em {{campo}} e o que `_dPsdSyncVarsFromLayers` já cria no catálogo.
    const de=_it({n:1,name:'Copy 3',kind:'text',mode:'text',content:'DE R$ 49,90',fontSize:32});
    const por=_it({n:2,name:'Copy 4',kind:'text',mode:'text',content:'POR R$ 29,90',fontSize:64});
    const r=dPsdSmartMap([de,por],{w:1080,h:1350});
    assert(r.aplicados===2,'o par de preços não foi aplicado: '+r.aplicados);
    assert(de.mode==='var'&&de.varName==='precoDe','o valor anterior não virou campo');
    assert(por.mode==='var'&&por.varName==='precoPor','o valor que vale não virou campo');
    assert(dItemToLayer(por).content==='{{precoPor}}','a camada canônica não saiu com o campo');
    assert(de.varSource==='auto','a origem da decisão não ficou registrada');
  });

  test('média confiança fica PENDENTE e vira uma pergunta, não um vínculo',()=>{
    const it=_it({n:1,name:'Layer 8',kind:'text',mode:'text',content:'COMBO FAMÍLIA',fontSize:88});
    const r=dPsdSmartMap([it],{w:1080,h:1350});
    assert(r.aplicados===0,'aplicou uma leitura ambígua sozinho');
    assert(_dPsdPendingSug(it),'a ambiguidade não ficou no estado pendente que a tela conhece');
    assert(r.ambiguidades.length===1,'a pergunta não chegou ao resultado');
    const q=r.ambiguidades[0];
    assert(q.amostra==='COMBO FAMÍLIA','a pergunta usa o nome técnico da camada em vez do conteúdo');
    assert(q.opcoes.length>=2&&q.opcoes.some(o=>o.name==='produto'),
      'a pergunta não oferece as leituras: '+JSON.stringify(q.opcoes));
    assert(it.content==='COMBO FAMÍLIA','o texto autorado foi trocado antes de o designer responder');
  });

  test('decisão do designer, memória aprovada e convenção do PSD são intocáveis',()=>{
    const doUser=_it({n:1,name:'Copy 3',kind:'text',mode:'text',content:'DE R$ 49,90',fontSize:32,
      varName:'precoPor',varSource:'user'});
    const daMemoria=_it({n:2,name:'Copy 4',kind:'text',mode:'text',content:'POR R$ 29,90',fontSize:64,
      varName:'produto',_memoryApplied:true});
    const fixada=_it({n:3,name:'Copy 5',kind:'text',mode:'text',content:'R$ 9,90',fontSize:20,_fixedByUser:true});
    dPsdSmartMap([doUser,daMemoria,fixada],{w:1080,h:1350});
    assert(doUser.varName==='precoPor'&&doUser.varSource==='user','a escolha do designer foi sobrescrita');
    assert(daMemoria.varName==='produto','a memória aprovada foi sobrescrita por uma regra');
    assert(!fixada.varName,'uma camada que o designer tornou fixa recebeu campo de volta');
  });

  test('semântica e compatibilidade precisam concordar',()=>{
    // §17: campo de imagem não entra numa camada de texto porque o significado parecia certo.
    const it=_it({n:1,name:'@foto_produto',kind:'text',mode:'text',content:'Foto',fontSize:20});
    dPsdSmartMap([it],{w:1080,h:1350});
    assert(it.mode!=='var'||it.varName!=='foto_produto',
      'um campo de imagem foi ligado numa camada de texto');
  });

  test('a análise roda UMA vez por camada, não a cada abertura de prancheta',()=>{
    const it=_it({n:1,name:'Copy 4',kind:'text',mode:'text',content:'R$ 29,90',fontSize:64});
    const a=dPsdSmartMap([it],{w:1080,h:1350});
    const b=dPsdSmartMap([it],{w:1080,h:1350});
    assert(a.aplicados===1,'a primeira passada não aplicou');
    assert(b.aplicados===0&&!b.ambiguidades.length,'reprocessou a camada — trocar de aba reabriria pergunta já respondida');
  });

  let passed=0;
  const falhas=[];
  for(const item of cases){
    const li=document.createElement('li');li.className='case';
    try{
      await item.fn();passed++;li.classList.add('pass');
      li.innerHTML='<strong>✓ '+item.name+'</strong>';
    }catch(error){
      li.classList.add('fail');
      li.innerHTML='<strong>✕ '+item.name+'</strong><small>'+String(error&&error.message||error)+'</small>';
      console.error('[psd-import]',item.name,error);
      falhas.push({name:item.name,error:String(error&&error.message||error)});
    }
    results.appendChild(li);
  }
  const failed=cases.length-passed;
  summary.textContent=passed+'/'+cases.length+' cenários passaram'+(failed?' · '+failed+' falharam':' · importador aprovado');
  summary.dataset.passed=String(passed);summary.dataset.total=String(cases.length);
  document.title=(failed?'FALHOU':'OK')+' — PSD ('+passed+'/'+cases.length+')';

  /* Contrato do runner de CI (`scripts/run-browser-tests.js`): a suíte publica o resultado
     aqui quando termina. Esperar o `load` da página pegaria o teste no meio — as asserções
     são assíncronas porque medem fonte real e desenham em canvas. */
  window.__lumaTest={passed:passed,total:cases.length,failures:falhas};
})();
