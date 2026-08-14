/* Browser-native, sem framework: abra tests/auto-layout.html. A suíte usa Canvas 2D real para
   que as mesmas métricas tipográficas da prévia/exportação sejam exercitadas. */
(async function(){
  const results=document.getElementById('results');
  const summary=document.getElementById('summary');
  const cases=[];
  const test=(name,fn)=>cases.push({name,fn});
  const assert=(condition,message)=>{if(!condition)throw new Error(message||'asserção falhou');};
  const text=(id,x,y,w,h,content,extra)=>Object.assign({id,name:id,type:'text',x,y,w,h,
    content,font:'Arial',fontSize:48,lineHeight:1.2,textBox:'box',textAlign:'left',vAlign:'top',
    visible:true,opacity:100},extra||{});
  const shape=(id,x,y,w,h,extra)=>Object.assign({id,name:id,type:'shape',shapeKind:'rect',x,y,w,h,
    visible:true,opacity:100,locked:true},extra||{});
  const solve=(layers,dados,canvas)=>gApplyRelativeAnchors(layers,dados||{}, {},
    {fitText:true,canvas:canvas||{w:1080,h:1080}});
  const by=(layers,id)=>layers.find(l=>l.id===id);

  test('texto respeita o respiro do círculo de preço',()=>{
    const layers=[
      text('produto',80,260,430,90,'{{produto}}',{fontSize:64,textBox:'point'}),
      shape('preco',560,225,220,220,{shapeKind:'circle',layoutRole:'protected'})
    ];
    const out=solve(layers,{produto:'Batata quente recheada com cheddar e bacon crocante'},{w:900,h:700});
    const t=by(out,'produto'), r=gInkRect(t,t._fit);
    assert(t._layoutW!=null,'o corredor seguro não foi criado');
    assert(r.x+r.w<=560-_gLayoutRespiro(t,50,{w:900,h:700})+2,'o texto atravessou a zona de respiro');
    assert(t._fit.lines.length>1,'o título não quebrou linha');
  });

  test('corrente vertical empurra o bloco abaixo',()=>{
    const layers=[
      text('titulo',90,100,420,58,'{{titulo}}',{fontSize:46}),
      text('cta',90,180,260,48,'PEÇA AGORA',{fontSize:30})
    ];
    const out=solve(layers,{titulo:'Combo artesanal com batata, bebida e sobremesa especial'},{w:700,h:600});
    assert(by(out,'cta').y>180,'o CTA não acompanhou o crescimento do título');
  });

  test('campo opcional vazio fecha somente o vão autorizado',()=>{
    const layers=[
      text('titulo',80,90,360,60,'OFERTA',{fontSize:44}),
      text('opcional',80,170,360,40,'{{opcional}}',{fontSize:26}),
      text('cta',80,230,240,44,'APROVEITE',{fontSize:28})
    ];
    const out=solve(layers,{opcional:''},{w:600,h:500});
    assert(by(out,'cta').y<230,'o espaço do campo vazio não foi recolhido');
    assert(by(out,'cta').y>=190,'o bloco subiu além da faixa opcional');
  });

  test('placa dentro de grupo PSD cresce com o texto',()=>{
    const layers=[
      shape('placa',70,80,360,110,{locked:false,parentId:'grupo'}),
      text('texto',95,100,310,65,'{{produto}}',{fontSize:40,parentId:'grupo'}),
      {id:'grupo',name:'Grupo',type:'group',x:70,y:80,w:360,h:110,visible:true,opacity:100}
    ];
    const out=solve(layers,{produto:'Festival de sabores artesanais por tempo limitado'},{w:600,h:500});
    assert(by(out,'placa').h>110,'a placa agrupada não acompanhou a nova altura');
  });

  test('quebra manual não desliga a proteção das linhas longas',()=>{
    const l=text('manual',0,0,260,100,'',{fontSize:30});
    const wrapped=gSmartWrapText('Linha manual\nSUPERMEGAULTRAPROMOÇÃO🔥🔥🔥🔥🔥',260,l,{},{});
    assert(wrapped.startsWith('Linha manual\n'),'a quebra manual foi removida');
    assert(wrapped.split('\n').length>2,'o trecho longo depois da quebra não foi protegido');
    assert(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(wrapped),'um emoji foi dividido no meio');
  });

  test('hierarquia tipográfica nunca é invertida',()=>{
    const layers=[
      text('titulo',30,20,180,42,'{{titulo}}',{fontSize:64}),
      text('apoio',30,150,180,38,'APOIO',{fontSize:32}),
      shape('limite',220,0,100,260,{layoutRole:'protected'})
    ];
    const out=solve(layers,{titulo:'Título promocional extraordinariamente comprido'},{w:340,h:260});
    const titulo=by(out,'titulo'),apoio=by(out,'apoio');
    assert(titulo._fit.fontSize>=apoio._fit.fontSize,'o título ficou menor que o texto de apoio');
    assert(Math.abs(titulo._fit.fontSize/apoio._fit.fontSize-2)<0.15,
      'a emergência não preservou a proporção entre título e apoio');
  });

  test('redução de emergência fica no componente afetado',()=>{
    const layers=[
      text('oferta',30,150,150,38,'{{oferta}}',{fontSize:52}),
      shape('selo',185,120,95,120,{layoutRole:'protected'}),
      text('rodape',320,20,240,40,'REGULAMENTO',{fontSize:24})
    ];
    const out=solve(layers,{oferta:'Oferta super extraordinária e imperdível hoje'},{w:600,h:260});
    assert(by(out,'rodape')._tetoFonte==null,'um texto sem relação com a colisão foi reduzido');
  });

  test('PSD sem campo dinâmico não é recomposto nem bloqueado',()=>{
    const layers=[
      text('fixo',80,90,110,34,'TEXTO FIXO',{fontSize:44,textBox:'point'}),
      shape('sangria',-160,260,920,480,{name:'Objeto Inteligente decorativo',locked:false})
    ];
    const out=solve(layers,{}, {w:600,h:500});
    const report=gDescribeFranchiseeLayout(layers,out);
    assert(report.status==='original','uma arte sem campos foi tratada como adaptada/insegura');
    assert(by(out,'fixo')._tetoFonte==null,'texto fixo foi reduzido sem ação do franqueado');
    assert(by(out,'sangria').x===-160&&by(out,'sangria').y===260,'a sangria autorada foi movida');
  });

  test('componente decorativo gigante não entra na corrente do campo',()=>{
    const layers=[
      text('titulo',50,70,280,60,'{{produto}}',{fontSize:54,textBox:'point'}),
      shape('decor',-120,155,900,620,{name:'Raio verde decorativo',locked:false})
    ];
    const out=solve(layers,{produto:'Combo artesanal com acompanhamento especial'},{w:600,h:500});
    assert(by(out,'decor').x===-120&&by(out,'decor').y===155,'a decoração foi arrastada pelo título');
    assert(!by(out,'decor')._foraDaArte,'a sangria original virou falha de exportação');
  });

  test('borda da prancheta cria corredor e quebra point text',()=>{
    const layers=[text('validade',700,1180,250,32,'{{validade}}',{fontSize:30,textBox:'point'})];
    const out=solve(layers,{validade:'Válido de segunda a quinta-feira, exceto feriados'},{w:1080,h:1350});
    const l=by(out,'validade'),r=gInkRect(l,l._fit);
    assert(l._layoutW!=null,'a borda direita não criou um corredor seguro');
    assert(l._fit.lines.length>1,'o texto próximo da borda continuou em uma linha');
    assert(r.x+r.w<=1080+2,'o texto continuou saindo da prancheta');
  });

  test('referência autorada calibra a métrica da fonte substituta',()=>{
    const layers=[
      text('campo',40,80,95,48,'{{oferta}}',{fontSize:46,textBox:'point',layoutRefText:'PROMOÇÃO'}),
      shape('selo',280,50,140,130,{layoutRole:'protected'})
    ];
    const out=solve(layers,{oferta:'PROMOÇÃO'},{w:500,h:320});
    const report=gDescribeFranchiseeLayout(layers,out);
    assert(report.status==='original','o mesmo texto da referência pareceu crescer por diferença de fonte');
    assert(by(out,'campo')._layoutW==null,'foi criado corredor para um valor idêntico ao autorado');
  });

  test('limite semântico nunca reduz as linhas autoradas',()=>{
    const original='UM\nDOIS\nTRÊS\nQUATRO';
    const layers=[text('produto',40,30,210,150,'{{produto}}',{
      fontSize:28,textBox:'box',layoutRefText:original
    })];
    const out=solve(layers,{produto:original},{w:320,h:260});
    const l=by(out,'produto'),report=gDescribeFranchiseeLayout(layers,out);
    assert(l._layoutMaxLines===4,'o teto de título apagou uma linha que o designer publicou');
    assert(!l._fit.estourou&&!report.invalid,'o conteúdo autorado foi marcado como inseguro');
  });

  test('emergência proporcional pode passar de 50% sem perder legibilidade',()=>{
    const layers=[
      text('produto',35,40,280,62,'{{produto}}',{fontSize:80,textBox:'point'}),
      shape('preco',345,20,150,190,{shapeKind:'circle',layoutRole:'protected'}),
      text('cta',35,270,240,45,'PEÇA AGORA',{fontSize:30})
    ];
    const out=solve(layers,{produto:'Combo Artesanal com Hambúrguer'},{w:520,h:360});
    const l=by(out,'produto'),report=gDescribeFranchiseeLayout(layers,out);
    assert(l._tetoFonte!=null&&l._tetoFonte<40,'o componente continuou preso ao antigo piso de 50%');
    assert(l._tetoFonte>=l._pisoLegivel,'a emergência atravessou o piso de legibilidade');
    assert(!report.invalid,'um caso acomodável continuou bloqueado');
  });

  test('composição impossível é marcada como insegura',()=>{
    const layers=[
      text('produto',8,8,72,24,'{{produto}}',{fontSize:34}),
      shape('bloqueio',86,0,110,196,{layoutRole:'protected'})
    ];
    const out=solve(layers,{produto:'Texto impossível de acomodar em uma área minúscula sem perder legibilidade'},{w:200,h:200});
    const l=by(out,'produto');
    assert(l._foraDaArte||l._layoutInvalido||(l._fit&&l._fit.estourou),'a falha impossível não foi carimbada');
  });

  test('solver é determinístico e não muta o template',()=>{
    const input=[text('produto',60,80,280,54,'{{produto}}',{fontSize:42}),shape('preco',370,55,150,150,{shapeKind:'circle'})];
    const before=JSON.stringify(input);
    const dados={produto:'Hambúrguer artesanal com queijo e molho especial'};
    const a=solve(input,dados,{w:600,h:400}), b=solve(input,dados,{w:600,h:400});
    assert(JSON.stringify(a)===JSON.stringify(b),'duas execuções iguais deram geometrias diferentes');
    assert(JSON.stringify(input)===before,'o template de entrada foi mutado');
  });

  test('renderer nunca executa Auto-layout no escopo designer',async()=>{
    const real=gApplyRelativeAnchors, calls=[];
    window.gApplyRelativeAnchors=(layers,dados,defaults,opts)=>{
      calls.push(!!(opts&&opts.fitText));
      return (layers||[]).map(l=>Object.assign({},l,opts&&opts.fitText?{_layoutInvalido:true}:{}));
    };
    try{
      const cv=document.createElement('canvas');cv.width=40;cv.height=40;
      await fRenderTemplateLayers(cv.getContext('2d'),[],40,40,{}, {color:'#fff'},
        {layers:[],w:40,h:40,bg:'#fff'},{scope:'designer',purpose:'preview'});
      assert(calls.length===1&&calls[0]===false,'o Estúdio acionou o solver do franqueado');
    }finally{window.gApplyRelativeAnchors=real;}
  });

  test('exportação insegura é bloqueada antes do arquivo',async()=>{
    const real=gApplyRelativeAnchors;
    window.gApplyRelativeAnchors=(layers,dados,defaults,opts)=>(layers||[]).map(l=>
      Object.assign({},l,opts&&opts.fitText?{_layoutInvalido:true}:{}));
    try{
      const cv=document.createElement('canvas');cv.width=40;cv.height=40;
      let error=null;
      try{
        await fRenderTemplateLayers(cv.getContext('2d'),[
          {id:'x',type:'group',visible:false,x:0,y:0,w:1,h:1}
        ],40,40,{}, {color:'#fff'},{layers:[],w:40,h:40,bg:'#fff'},
        {scope:'franqueado',purpose:'export'});
      }catch(e){error=e;}
      assert(error&&error.code==='LUMA_LAYOUT_UNSAFE','a exportação não recebeu o bloqueio tipado');
    }finally{window.gApplyRelativeAnchors=real;}
  });

  let passed=0;
  for(const item of cases){
    const li=document.createElement('li');li.className='case';
    try{
      await item.fn();passed++;li.classList.add('pass');
      li.innerHTML='<strong>✓ '+item.name+'</strong>';
    }catch(error){
      li.classList.add('fail');li.innerHTML='<strong>✕ '+item.name+'</strong><small>'+String(error&&error.message||error)+'</small>';
      console.error('[auto-layout]',item.name,error);
    }
    results.appendChild(li);
  }
  const failed=cases.length-passed;
  summary.textContent=passed+'/'+cases.length+' cenários passaram'+(failed?' · '+failed+' falharam':' · motor aprovado');
  summary.dataset.passed=String(passed);summary.dataset.total=String(cases.length);
  document.title=(failed?'FALHOU':'OK')+' — Auto-layout ('+passed+'/'+cases.length+')';
})();
