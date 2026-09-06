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
