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
    const m=cap.motivos.find(x=>x.code==='smart_object');
    assert(m,'o motivo do raster não foi nomeado — voltamos ao booleano mudo');
    assert(m.etapa==='decode','a etapa do motivo não permite classificar o defeito');
    assert(_dPsdNeedsRaster(node)===true,'a pergunta booleana antiga deixou de ser derivada do estágio');
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

  test('efeito em camada que sai como imagem é declarado, não sumido em silêncio',()=>{
    /* Nenhum dos três renderizadores lê sombra/brilho/contorno em type:'image'/'frame'
       (fRenderOneLayer ramo image/frame, o DOM de canvas.js, o SVG). O parser copiava os
       campos e ninguém os consumia: objeto inteligente com sombra perdia a sombra sem aviso. */
    const it={n:1,name:'Selo',kind:'raster',mode:'raster',x:0,y:0,w:80,h:80,visible:true,
      opacity:100,imgUrl:'data:image/png;base64,iVBORw0KGgo=',shadow:true,shadowColor:'rgba(0,0,0,.5)'};
    _dPsdCapItem(it);
    assert(it.capability.motivos.some(m=>m.code==='fx_only_native'),
      'a perda de efeito em imagem fiel continuou sem nome');
    assert(_dPsdCapPerdeFx(it)===true,'a revisão não teria como avisar que os efeitos não saem');
    // A MESMA camada como forma editável renderiza o efeito — então não há perda a declarar.
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
      {n:2,name:'Selo',kind:'raster',mode:'raster',x:0,y:0,w:10,h:10,glow:true}
    ];
    itens.forEach(_dPsdCapItem);
    const rep=dPsdCapReport(itens);
    assert(rep.length===1&&rep[0].camada==='Selo','o relatório não isolou a camada com perda');
    assert(rep[0].motivos.some(m=>m.indexOf('conversao:fx_only_native')===0),
      'o relatório não diz em que etapa a perda aconteceu');
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
