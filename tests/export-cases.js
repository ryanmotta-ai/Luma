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

  /* Contorno em IMAGEM (07/10/2026): texto do PSD que virou imagem fiel dependia do traço para
     existir ("R$ 40" rosa sobre rosa com contorno branco). Sem path, o traço sai da distância
     ao alpha. Trava a geometria: até r por fora, nada além; por dentro só dentro do recorte. */
  test('contorno de imagem segue a silhueta, nos três alinhamentos',()=>{
    const oc=document.createElement('canvas'); oc.width=oc.height=60;
    const x=oc.getContext('2d'); x.fillStyle='#000'; x.fillRect(20,20,20,20);
    const a=(c,px,py)=>c?c.getContext('2d').getImageData(px,py,1,1).data[3]:0;
    const fora=_fContornoSilhueta(oc,{x:20,y:20,w:20,h:20},4,'outside','#fff');
    assert(fora&&fora.fora&&!fora.dentro,'contorno por fora não gerou só a peça de fora');
    const ox=fora.x, oy=fora.y;
    assert(a(fora.fora,30-ox,17-oy)===255,'3px fora do recorte deveria estar coberto');
    assert(a(fora.fora,30-ox,14-oy)===0,'6px fora do recorte já está além do traço de 4px');
    const dentro=_fContornoSilhueta(oc,{x:20,y:20,w:20,h:20},4,'inside','#fff');
    assert(dentro&&dentro.dentro&&!dentro.fora,'contorno por dentro não gerou só a peça de dentro');
    assert(a(dentro.dentro,30-dentro.x,22-dentro.y)===255,'2px dentro da borda deveria estar coberto');
    assert(a(dentro.dentro,30-dentro.x,30-dentro.y)===0,'o miolo do recorte não pode receber traço');
    const centro=_fContornoSilhueta(oc,{x:20,y:20,w:20,h:20},4,'center','#fff');
    assert(centro.fora&&centro.dentro,'centro precisa das duas peças, cada uma com metade');
    assert(a(centro.fora,30-centro.x,16-centro.y)===0,'centro com 4px não passa de 2px por fora');
  });

  /* Escala horizontal da letra (07/10/2026): o mesmo texto a 50% tem que DESENHAR com metade
     da largura, ancorado à esquerda — a medida (gTextScaleX) e o desenho são a mesma régua. */
  test('textScaleX desenha a letra condensada, ancorada no alinhamento',async()=>{
    const tinta=async(sx,align)=>{
      const cv=document.createElement('canvas'); cv.width=800; cv.height=200;
      const c=cv.getContext('2d');
      window.fState={material:{w:800,h:200,layers:[]}};
      await fRenderTemplateLayers(c,[{id:'t',type:'text',content:'MMMMMMMM',x:0,y:0,w:800,h:200,font:'Arial',
        fontSize:80,color:'#000',textAlign:align,vAlign:'top',visible:true,opacity:100,textScaleX:sx}],800,200,{},{color:'#fff'},null,{});
      const d=c.getImageData(0,0,800,200).data; let x0=800,x1=-1;
      for(let y=0;y<200;y++)for(let x=0;x<800;x++){ if(d[(y*800+x)*4]<100){ if(x<x0)x0=x; if(x>x1)x1=x; } /* tinta preta: o fundo da campanha pinta o quadro todo */ }
      return {x0,x1,w:x1-x0};
    };
    const cheio=await tinta(1,'left'), meio=await tinta(0.5,'left');
    assert(cheio.w>100,'o texto de referência não foi desenhado');
    assert(Math.abs(meio.w/cheio.w-0.5)<0.06,'a 50% a tinta deveria ter metade da largura ('+(meio.w/cheio.w).toFixed(2)+')');
    assert(Math.abs(meio.x0-cheio.x0)<4,'alinhado à esquerda, o início da linha não pode andar');
    const dir1=await tinta(1,'right'), dir5=await tinta(0.5,'right');
    assert(Math.abs(dir1.x1-dir5.x1)<4,'alinhado à direita, o fim da linha não pode andar');
  });

  /* Equilíbrio de Cores e Filtro de Foto (07/10/2026): antes eram ignorados — o ajuste do PSD
     sumia da arte. Trava o sentido de cada um (a fórmula é aproximação do Photoshop). */
  test('equilíbrio de cores e filtro de foto mudam a cor no sentido certo',()=>{
    const px=(r,g,b)=>{const id=new ImageData(1,1);id.data.set([r,g,b,255]);return id;};
    const cb=fAdjustImageData(px(128,128,128),{type:'color balance',preserveLuminosity:false,
      shadows:{},highlights:{},midtones:{cyanRed:60,magentaGreen:0,yellowBlue:-60}}).data;
    assert(cb[0]>140 && cb[2]<116,'meios-tons +vermelho/−azul não esquentaram o cinza ('+cb[0]+','+cb[2]+')');
    const sombra=fAdjustImageData(px(10,10,10),{type:'color balance',preserveLuminosity:false,
      shadows:{},highlights:{},midtones:{cyanRed:60}}).data;
    assert(sombra[0]<20,'correção de meios-tons vazou para a sombra ('+sombra[0]+')');
    const pf=fAdjustImageData(px(128,128,128),{type:'photo filter',density:.5,preserveLuminosity:true,
      color:{l:0.6706,a:0.252,b:0.945}}).data; // filtro de aquecimento (laranja), como no PSD real
    assert(pf[0]>pf[2]+20,'o filtro laranja não esquentou o cinza ('+pf[0]+','+pf[2]+')');
    const y=.299*pf[0]+.587*pf[1]+.114*pf[2];
    assert(Math.abs(y-128)<4,'preservar luminosidade não manteve a luminância ('+y.toFixed(1)+')');
  });

  /* Texto girado (07/10/2026): 90° troca largura por altura da tinta, em torno do centro. */
  test('texto com rotação gira em torno do centro da caixa',async()=>{
    const tinta=async(rot)=>{
      const cv=document.createElement('canvas'); cv.width=600; cv.height=600;
      const c=cv.getContext('2d'); window.fState={material:{w:600,h:600,layers:[]}};
      await fRenderTemplateLayers(c,[{id:'t',type:'text',content:'MMMMM',x:100,y:250,w:400,h:100,font:'Arial',
        fontSize:80,color:'#000',textAlign:'center',vAlign:'top',visible:true,opacity:100,rotation:rot}],600,600,{},{color:'#fff'},null,{});
      const d=c.getImageData(0,0,600,600).data; let x0=600,x1=-1,y0=600,y1=-1;
      for(let y=0;y<600;y++)for(let x=0;x<600;x++){ if(d[(y*600+x)*4]<100){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; } }
      return {w:x1-x0,h:y1-y0,cx:(x0+x1)/2,cy:(y0+y1)/2};
    };
    const reto=await tinta(0), em90=await tinta(90);
    assert(reto.w>reto.h*2,'o texto de referência não saiu horizontal');
    assert(em90.h>em90.w*2,'a 90° a tinta deveria ficar vertical ('+em90.w+'×'+em90.h+')');
    // O centro horizontal da linha (x=300, centralizada) vai para y=300 a 90°; o deslocamento
    // vertical da tinta (vAlign top) vira horizontal — por isso só o eixo y é exato aqui.
    assert(Math.abs(em90.cy-300)<6,'o giro não foi em torno do centro da caixa (cy '+em90.cy+')');
  });

  /* Opacidade do preenchimento (07/10/2026): "GRÁTIS" a 0% com traço = só contorno; forma a 0%
     com brilho interno não pode virar retângulo preto. */
  test('preenchimento 0% desenha só o efeito, em texto e em forma',async()=>{
    const pinta=async(layer)=>{
      const cv=document.createElement('canvas'); cv.width=400; cv.height=200;
      const c=cv.getContext('2d'); window.fState={material:{w:400,h:200,layers:[],bg:'transparent'}};
      await fRenderTemplateLayers(c,[layer],400,200,{},{color:'transparent'},{layers:[layer],w:400,h:200,bg:'transparent'},{});
      return c.getImageData(0,0,400,200).data;
    };
    const a=(d,x,y)=>d[(y*400+x)*4+3];
    const forma=await pinta({id:'f',type:'shape',shapeKind:'rect',x:100,y:50,w:200,h:100,fill:'#000',visible:true,opacity:100,
      fillOpacity:0,strokeW:6,strokeColor:'#fff',strokeAlign:'outside'});
    assert(a(forma,200,100)===0,'o miolo da forma a 0% foi pintado ('+a(forma,200,100)+')');
    assert(a(forma,200,47)>200,'o traço externo sumiu junto com o preenchimento');
    const meia=await pinta({id:'f',type:'shape',shapeKind:'rect',x:100,y:50,w:200,h:100,fill:'#000',visible:true,opacity:100,
      fillOpacity:0.5,strokeW:6,strokeColor:'#fff',strokeAlign:'outside'});
    assert(Math.abs(a(meia,200,100)-128)<6,'preenchimento a 50% não saiu pela metade ('+a(meia,200,100)+')');
    const txt=await pinta({id:'t',type:'text',content:'IIIII',x:0,y:0,w:400,h:200,font:'Arial',fontSize:150,color:'#000',
      textAlign:'center',vAlign:'top',visible:true,opacity:100,fillOpacity:0,strokeW:2,strokeColor:'#f00'});
    let cheio=0,traco=0; for(let i=0;i<txt.length;i+=4){ if(txt[i+3]>200){ if(txt[i]>200) traco++; else cheio++; } }
    assert(traco>50,'o contorno do texto sumiu com o preenchimento a 0%');
    assert(cheio===0,'o glifo foi pintado com preenchimento a 0% ('+cheio+' px)');
  });

  /* Brilho/Contraste MODERNO (07/10/2026), medido num PSD real (+21/−10, média 127): o fundo
     38/87/182 vira 44/99/199 no Photoshop. A fórmula legada dava 92/123/185. */
  test('brilho/contraste moderno segue o Photoshop, não a fórmula legada',()=>{
    const px=v=>{const id=new ImageData(1,1);id.data.set([v,v,v,255]);return id;};
    const aj={type:'brightness/contrast',brightness:21,contrast:-10,meanValue:127,useLegacy:false};
    [[38,44],[87,99],[182,199]].forEach(([de,ps])=>{
      const v=fAdjustImageData(px(de),aj).data[0];
      assert(Math.abs(v-ps)<=8,de+' deveria virar ~'+ps+' (Photoshop), virou '+v);
    });
    const leg=fAdjustImageData(px(38),Object.assign({},aj,{useLegacy:true})).data[0];
    assert(leg>80,'o modo legado mudou ('+leg+') — ele continua com a fórmula antiga');
  });

  /* Vibração (07/10/2026), medida em PSD real (cupoms_v2, −13/+1): o canal mais forte fica e
     os outros andam até ele. A fórmula HSL antiga baixava o máximo e saturava o cinza. */
  test('vibração segue o Photoshop: segura o canal máximo e poupa o cinza',()=>{
    const px=(r,g,b)=>{const id=new ImageData(1,1);id.data.set([r,g,b,255]);return id;};
    const aj={type:'vibrance',vibrance:-13,saturation:1};
    [[[104,38,27],[104,43,34]],[[200,113,77],[199,118,87]],[[188,40,92],[188,56,98]]].forEach(([de,ps])=>{
      const v=fAdjustImageData(px(...de),aj).data;
      assert([0,1,2].every(k=>Math.abs(v[k]-ps[k])<=3),de+' deveria virar ~'+ps+' (Photoshop), virou '+[v[0],v[1],v[2]]);
    });
    const cinza=fAdjustImageData(px(220,223,233),{type:'vibrance',vibrance:80,saturation:-3}).data;
    assert(cinza[2]<=236 && cinza[0]>=214,'vibração +80 saturou o cinza ('+[cinza[0],cinza[1],cinza[2]]+')');
  });

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
