/* ══════════════════════════════════════════════════════════════════════════════════════════
   CONTRATO DE EXPORTAÇÃO — abra `tests/export.html` ou rode
   `node scripts/run-browser-tests.js export`.

   O que ele cobra: as DIMENSÕES e a escala do que sai pelo caminho do franqueado. Não é o
   corpus (aquele mede composição e geometria de texto) nem o importador de PSD — é a promessa
   do arquivo entregue: uma prancheta de 1080×1350 tem que conseguir sair 1080×1350.

   Por que existe: o 2× estava escrito na mão dentro do render e não havia como pedir o tamanho
   nativo. Comparar a saída do Luma com o composto do Photoshop exige as mesmas dimensões —
   2160×2700 ao lado de 1080×1350 é outra resolução, não é igualdade (estudo de fidelidade
   05/09 §5.8, ticket 3). Aqui é onde os próximos contratos de saída (original sem perdas,
   paridade Estúdio × franqueado) devem entrar.
   ══════════════════════════════════════════════════════════════════════════════════════════ */
(async function(){
  const results=document.getElementById('results');
  const summary=document.getElementById('summary');
  const cases=[];
  const test=(name,fn)=>cases.push({name,fn});
  const assert=(condition,message)=>{if(!condition)throw new Error(message||'asserção falhou');};

  /* Material mínimo com layers reais (fundo + texto): é o CAMINHO NOVO do render, o mesmo que
     o franqueado usa. `fState` mora no 01-state.js, que esta página não carrega — o motor só
     lê `fState.material`, então o stub basta e não inventa uma segunda fonte de estado. */
  const material=()=>({w:1080,h:1350,layers:[
    {id:'fundo',name:'Fundo',type:'shape',shapeKind:'rect',x:0,y:0,w:1080,h:1350,fill:'#F3EFE7',visible:true,opacity:100},
    {id:'titulo',name:'Título',type:'text',content:'PIZZA HOJE',x:110,y:180,w:860,h:200,
     font:'Arial',fontSize:78,lineHeight:1.2,textAlign:'left',textBox:'box',vAlign:'top',visible:true,opacity:100}
  ]});
  const camp={id:'teste',color:'#FF9000'};
  const fmt={id:'feed'};
  const exportar=async(opts)=>{
    window.fState={material:material(),dados:{},camp:camp,fmt:fmt};
    return await fRenderCanvasHelper({},camp,fmt,opts);
  };

  test('modo nativo exporta a prancheta no tamanho real',async()=>{
    const cv=await exportar({scale:1});
    assert(cv.width===1080&&cv.height===1350,
      'a prancheta de 1080×1350 saiu '+cv.width+'×'+cv.height+' — o modo nativo não é nativo');
  });

  test('2× continua o padrão quando ninguém pede escala',async()=>{
    const cv=await exportar();
    assert(cv.width===2160&&cv.height===2700,
      'o super-sampling padrão mudou sem aviso: saiu '+cv.width+'×'+cv.height+' em vez de 2160×2700');
  });

  test('escala inválida cai no padrão em vez de zerar o arquivo',()=>{
    assert(fExportScale({scale:0})===F_EXPORT_SCALE_DEFAULT,'escala 0 produziria um canvas vazio');
    assert(fExportScale({scale:-3})===F_EXPORT_SCALE_DEFAULT,'escala negativa passou pelo resolvedor');
    assert(fExportScale(null)===F_EXPORT_SCALE_DEFAULT,'sem opções o resolvedor não devolveu o padrão');
    assert(fExportScale({scale:3})===3,'uma escala explícita e válida foi ignorada');
  });

  /* ── ENQUADRAMENTO INTELIGENTE (23/09) — a foto/logo do franqueado se enquadra sozinha ──
     Imagens sintéticas, desenhadas aqui: o que se cobra é a regra, não um arquivo de amostra. */
  const imagem=async(w,h,pinta)=>{
    const c=document.createElement('canvas');c.width=w;c.height=h;pinta(c.getContext('2d'));
    const url=c.toDataURL('image/png');
    const img=await fLoadImageDataUrl(url);fFrameAnalisa(img,url);return url;
  };
  const moldura=(extra)=>Object.assign({id:'m',type:'image',x:0,y:0,w:400,h:400,imgVar:'foto',
    imgUrl:'https://exemplo/amostra.png',imgScale:1.4,imgOffsetX:0.3,imgOffsetY:0.45,visible:true,opacity:100},extra||{});
  // Onde a caixa [x0..x1] da imagem (fração) cai na moldura, pela conta do motor.
  const naMoldura=(l,f,a,fx0,fx1,eixo)=>{
    const b=fFrameBaseSize(l,a.iw,a.ih,l.w,l.h), dim=eixo==='x'?l.w:l.h, base=(eixo==='x'?b.baseW:b.baseH)*f.scale;
    const d0=(dim-base)*(0.5+(eixo==='x'?f.offX:f.offY));
    return [d0+fx0*base,d0+fx1*base];
  };

  test('logo com margem branca: a marca ocupa a moldura, inteira e centralizada',async()=>{
    // 1000×400 branco com a marca (preta) só no miolo: 300×120 no centro.
    const url=await imagem(1000,400,c=>{c.fillStyle='#fff';c.fillRect(0,0,1000,400);c.fillStyle='#111';c.fillRect(350,140,300,120);});
    const l=moldura({objectFit:'contain'}), f=fFrameFitPadrao(l,{foto:url}), a=_fFrameAnalises.get(url);
    assert(f.scale>2,'a marca continuou pequena (zoom '+f.scale+'×)');
    const [x0,x1]=naMoldura(l,f,a,a.caixa.x,a.caixa.x+a.caixa.w,'x');
    const [y0,y1]=naMoldura(l,f,a,a.caixa.y,a.caixa.y+a.caixa.h,'y');
    assert(x0>=-1&&x1<=401&&y0>=-1&&y1<=401,'a marca foi CORTADA: x '+x0.toFixed(0)+'..'+x1.toFixed(0)+' y '+y0.toFixed(0)+'..'+y1.toFixed(0));
    assert(Math.abs((x0+x1)/2-200)<12&&Math.abs((y0+y1)/2-200)<12,'a marca não ficou no centro');
  });

  test('logo com fundo transparente: o vazio conta como margem',async()=>{
    const url=await imagem(600,600,c=>{c.fillStyle='#e8a317';c.fillRect(60,60,150,150);});
    const l=moldura({objectFit:'contain'}), f=fFrameFitPadrao(l,{foto:url}), a=_fFrameAnalises.get(url);
    assert(f.scale>2.5,'a marca no canto não ganhou zoom: '+f.scale);
    const [x0,x1]=naMoldura(l,f,a,a.caixa.x,a.caixa.x+a.caixa.w,'x');
    assert(x0>=-1&&x1<=401,'a marca saiu da moldura: '+x0.toFixed(0)+'..'+x1.toFixed(0));
  });

  test('foto com o assunto fora do meio: o corte vai até ele',async()=>{
    // 1200×400 (larga) numa moldura quadrada: o prato colorido está no terço direito.
    const url=await imagem(1200,400,c=>{c.fillStyle='#d9d4cc';c.fillRect(0,0,1200,400);
      c.fillStyle='#c0392b';c.beginPath();c.arc(930,200,120,0,7);c.fill();c.fillStyle='#f1c40f';c.fillRect(880,150,100,100);});
    const l=moldura(), f=fFrameFitPadrao(l,{foto:url});
    assert(f.scale===1,'foto não deveria ganhar zoom sozinha');
    assert(f.offX>0.25,'o corte continuou no meio e perdeu o prato (offX '+f.offX.toFixed(2)+')');
  });

  test('o DESENHO usa o enquadramento inteligente (não só a conta)',async()=>{
    // Logo 1000×400 com a marca preta de 300 px no miolo; sem inteligência ela ocupa 30% da moldura.
    const c=document.createElement('canvas');c.width=1000;c.height=400;const g=c.getContext('2d');
    g.fillStyle='#fff';g.fillRect(0,0,1000,400);g.fillStyle='#111';g.fillRect(350,140,300,120);
    const url=c.toDataURL('image/png');
    const cv=document.createElement('canvas');cv.width=400;cv.height=400;const ctx=cv.getContext('2d');
    await fRenderOneLayer(ctx,moldura({objectFit:'contain'}),{foto:url},1,1);
    const d=ctx.getImageData(0,200,400,1).data;let x0=400,x1=-1;
    for(let x=0;x<400;x++){const i=x*4;if(d[i+3]>200&&d[i]<60){x0=Math.min(x0,x);x1=Math.max(x1,x);}}
    assert(x1-x0>300,'a marca desenhada ocupa só '+(x1-x0+1)+'px de 400');
    assert(x0>0&&x1<399,'a marca desenhada encostou na borda (cortada?): '+x0+'..'+x1);
  });

  test('a foto de exemplo do designer segue com o enquadramento dele',()=>{
    const f=fFrameFitPadrao(moldura(),{});
    assert(f.scale===1.4&&f.offX===0.3&&f.offY===0.45,'o enquadramento do designer foi trocado: '+JSON.stringify(f));
  });

  test('imagem sem leitura (sem análise) nasce inteira e no centro',()=>{
    const f=fFrameFitPadrao(moldura({objectFit:'contain'}),{foto:'data:image/png;base64,SEM-ANALISE'});
    assert(f.scale===1&&f.offX===0&&f.offY===0,'sem análise deveria ser o neutro: '+JSON.stringify(f));
  });

  /* Nome do arquivo baixado: a foto enviada (data URL) virou o nome no celular, porque
     `foto_produto` casa o /produto/ da busca do nome (23/09/2026). */
  test('nome do arquivo nunca é a foto enviada (data URL, idb://, URL)',()=>{
    const camp={name:'Rangos Que Baixaram O Preço'}, fmt={name:'Feed'};
    const foto='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD';
    const soFoto=fBuildFilename(camp,fmt,{foto_produto:foto});
    assert(soFoto==='Rangos Que Baixaram O Preço - Feed.png','só foto deveria cair na campanha: '+soFoto);
    const outros=fBuildFilename(camp,fmt,{foto_produto:'idb://abc',logo:'https://x.supabase.co/a.png',precoPor:'19,90'});
    assert(!/idb|https|supabase/i.test(outros),'referência de imagem vazou no nome: '+outros);
    const comNome=fBuildFilename(camp,fmt,{foto_produto:foto,nomeProduto:'X-Tudo Duplo'});
    assert(comNome==='X-Tudo Duplo - Feed - Rangos Que Baixaram O Preço.png','o nome do produto sumiu: '+comNome);
  });

  const broken='data:image/png;base64,IMAGEM-QUEBRADA';
  const renderImage=async(layers,dados,purpose)=>{
    const cv=document.createElement('canvas');cv.width=40;cv.height=40;
    const mat={w:40,h:40,bg:'transparent',layers};
    return fRenderTemplateLayers(cv.getContext('2d'),layers,40,40,dados||{},camp,mat,{purpose:purpose||'export'});
  };
  const imgLayer=extra=>Object.assign({id:'foto',name:'Foto do produto',type:'image',imgUrl:broken,x:0,y:0,w:40,h:40},extra);
  test('export recusa imagem quebrada e identifica o recurso, prévia continua',async()=>{
    let error=null;try{await renderImage([imgLayer()]);}catch(e){error=e;}
    assert(error&&error.code==='LUMA_IMAGE_UNAVAILABLE'&&error.layerId==='foto','export entregou arte incompleta');
    assert(error.message.includes('Foto do produto'),'erro não identifica a camada');
    await renderImage([imgLayer()],{},'preview');
  });
  test('foto enviada válida substitui amostra quebrada sem bloquear export',async()=>{
    const c=document.createElement('canvas');c.width=4;c.height=4;
    const url=c.toDataURL();
    await renderImage([imgLayer({imgVar:'foto'})],{foto:url});
  });
  test('máscara quebrada bloqueia export mesmo sem uma camada imagem',async()=>{
    let error=null;try{await renderImage([{id:'forma',name:'Recorte',type:'shape',shapeKind:'rect',fill:'red',x:0,y:0,w:40,h:40,mask:broken}]);}catch(e){error=e;}
    assert(error&&error.resourceKind==='máscara','máscara falhou silenciosamente');
  });
  test('imagem de grupo oculto não bloqueia a arte',async()=>{
    await renderImage([{id:'grupo',type:'group',visible:false},imgLayer({parentId:'grupo'})]);
  });
  test('cache negativo permite repetir export sem perder dados',async()=>{
    const c=document.createElement('canvas');c.width=4;c.height=4;const url=c.toDataURL();
    _fImgCache.set(url,null);
    await renderImage([imgLayer({imgUrl:url})]);
    assert(_fImgCache.get(url),'nova tentativa ficou presa na falha antiga');
  });
  test('imagem HTTP solicita CORS e recusa timeout sem cache tardio',async()=>{
    const ImageOriginal=window.Image,timerOriginal=window.setTimeout;
    let request=null;
    window.Image=class{constructor(){request=this;}set src(v){this.url=v;}};
    window.setTimeout=(fn,ms,...args)=>timerOriginal(fn,ms===20000?20:ms,...args);
    try{
      const url='https://imagem-teste.invalid/sem-resposta.png';
      assert(await fLoadImageDataUrl(url)===null,'request estagnado não termina');
      assert(request.crossOrigin==='anonymous','imagem HTTP pode contaminar export');
      assert(request.onload===null&&request.onerror===null,'callback tardio modifica cache após timeout');
      assert(_fImgCache.get(url)===null,'falha não ficou negativa para prévia');
    }finally{window.Image=ImageOriginal;window.setTimeout=timerOriginal;}
  });
  test('referência IndexedDB sem resposta também termina no watchdog',async()=>{
    const resolveOriginal=gResolveImgUrl,timerOriginal=window.setTimeout;
    gResolveImgUrl=()=>new Promise(()=>{});
    window.setTimeout=(fn,ms,...args)=>timerOriginal(fn,ms===20000?20:ms,...args);
    try{assert(await fLoadImageDataUrl('idb://travado')===null,'leitura local segura render para sempre');}
    finally{gResolveImgUrl=resolveOriginal;window.setTimeout=timerOriginal;}
  });
  test('IndexedDB confirma antes de compactar imagens e máscaras grandes',async()=>{
    const data='data:image/png;base64,'+'A'.repeat(200000);
    const pending=gPackImgUrl(data);
    assert(pending.url===data&&!pending.dropped,'pack anunciou referência antes do commit');
    assert(gPackMask(data).url===data,'máscara foi descartada enquanto pendente');
    assert(await gImgStoreFlush([{imgUrl:data,mask:data}]),'gravação local falhou');
    const packed=gPackImgUrl(data),mask=gPackMask(data);
    assert(packed.url.startsWith('idb://')&&mask.url===packed.url,'commit confirmado não compactou');
    assert(await gResolveImgUrl(packed.url)===data,'referência não resolve bytes originais');
    await gIdbDel(packed.url.slice(6));
  });
  test('falha no armazenamento nunca cria referência nem descarta máscara',async()=>{
    const old=_gIdbPromise;_gIdbPromise=Promise.reject(new Error('quota simulada'));
    try{
      const data='data:image/png;base64,'+'B'.repeat(200001);
      assert(!(await gImgStoreFlush([{imgUrl:data,mask:data}])),'falha anunciou sucesso');
      assert(gPackImgUrl(data).url===data&&gPackMask(data).url===data,'bytes perdidos na falha');
      await Promise.all(Array.from(_gImgWrites.values()));
    }finally{_gIdbPromise=old;}
  });
  test('transação IndexedDB travada termina sem anunciar referência tardia',async()=>{
    const old=_gIdbPromise,timerOriginal=window.setTimeout;
    let tx=null,aborted=false;
    _gIdbPromise=Promise.resolve({transaction(){tx={objectStore:()=>({put(){}}),abort(){aborted=true;}};return tx;}});
    window.setTimeout=(fn,ms,...args)=>timerOriginal(fn,ms===8000?20:ms,...args);
    const data='data:image/png;base64,'+'C'.repeat(200002),key=gImgHash(data);
    try{
      assert(!(await gIdbPut(key,data))&&aborted,'transação travada não é recuperável');
      tx.oncomplete();
      assert(!gImgStoredRef(data),'commit tardio após falha anunciou referência');
    }finally{_gIdbPromise=old;window.setTimeout=timerOriginal;}
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
      console.error('[export]',item.name,error);
      falhas.push({name:item.name,error:String(error&&error.message||error)});
    }
    results.appendChild(li);
  }
  const failed=cases.length-passed;
  summary.textContent=passed+'/'+cases.length+' cenários passaram'+(failed?' · '+failed+' falharam':' · contrato de saída mantido');
  summary.dataset.passed=String(passed);summary.dataset.total=String(cases.length);
  document.title=(failed?'FALHOU':'OK')+' — Export ('+passed+'/'+cases.length+')';

  /* Contrato do runner de CI (`scripts/run-browser-tests.js`): a suíte publica o resultado
     aqui quando termina — o render é assíncrono, esperar o `load` pegaria no meio. */
  window.__lumaTest={passed:passed,total:cases.length,failures:falhas};
})();
