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


  /* ══ Camada de julgamento (core/auto-layout.js) — 2026-08-14 ══ */

  test('baseline autorado nasce em todo vínculo, não só no PSD',()=>{
    const l=text('produto',80,100,400,80,'Combo Burger Duplo',{fontSize:44});
    const ref=gStampLayoutBaseline(l,'Combo Burger Duplo');
    assert(ref&&ref.ink&&ref.ink.w>0,'o baseline não mediu a tinta autorada');
    assert(l.layoutRefText==='Combo Burger Duplo','o texto autorado não foi guardado');
    assert(ref.probe>0,'a sonda de fonte não foi gravada — sem ela não há calibragem entre aparelhos');
    assert(gStampLayoutBaseline(l,'{{produto}}')===null,'um placeholder virou referência autorada');
  });

  test('material antigo ganha baseline pelo exemplo do campo (migração em runtime)',()=>{
    const antes=window.dVars;
    window.dVars=[{name:'produto',label:'Nome do produto',example:'Marmita Executiva',type:'text'}];
    try{
      const l=text('produto',80,100,400,80,'{{produto}}',{fontSize:40,isVar:true});
      gEnsureLayoutBaseline([l]);
      assert(l.layoutRefText==='Marmita Executiva','a referência não foi reconstruída a partir do exemplo');
      assert(l.layoutRef&&l.layoutRef.ink.h>0,'a migração não mediu a tinta');
      // Sem exemplo confiável é melhor não ter baseline do que ter um falso (o rótulo mediria outra coisa).
      window.dVars=[{name:'x',label:'Campo X',type:'text'}];
      const semExemplo=text('x',0,0,200,50,'{{x}}',{isVar:true});
      gEnsureLayoutBaseline([semExemplo]);
      assert(!semExemplo.layoutRefText,'inventou baseline a partir do rótulo do campo');
    }finally{window.dVars=antes;}
  });

  test('fonte substituída é detectada e não muda o veredito',()=>{
    const molde=()=>[
      text('titulo',80,100,700,110,'{{titulo}}',{fontSize:72,textBox:'point',
        layoutRefText:'OFERTA DA SEMANA'}),
      text('apoio',80,250,700,70,'apoio fixo',{fontSize:30})
    ];
    const comFonte=molde(); gStampLayoutBaseline(comFonte[0],'OFERTA DA SEMANA');
    assert(gLayoutFontStatus(comFonte[0])==='ok','a sonda acusou substituição com a mesma fonte');
    // Simula o PSD autorado com a fonte da marca e aberto num aparelho que não a tem: a sonda
    // gravada mede diferente da atual.
    const semFonte=molde(); gStampLayoutBaseline(semFonte[0],'OFERTA DA SEMANA');
    // Sonda gravada MENOR que a atual = a fonte autorada era mais estreita que a substituta.
    // A referência tem que crescer na mesma proporção, senão o solver leria "o texto cresceu"
    // onde só houve troca de métrica — e encolheria a arte num aparelho e não no outro.
    semFonte[0].layoutRef.probe=semFonte[0].layoutRef.probe*0.85;
    assert(gLayoutFontStatus(semFonte[0])==='substituida','a troca de métrica passou despercebida');
    const ink=gLayoutRefInk(semFonte[0]);
    assert(ink.w>semFonte[0].layoutRef.ink.w*1.1,'a referência não foi calibrada pelo desvio da fonte');
    assert(Math.abs(ink.drift-1/0.85)<0.01,'o desvio medido não bate com a troca de fonte simulada');
    const dados={titulo:'SEMANA DE OFERTAS IMPERDÍVEIS DE ANIVERSÁRIO'};
    const a=solve(comFonte,dados,{w:1080,h:1080}), b=solve(semFonte,dados,{w:1080,h:1080});
    const veredito=(o)=>gDescribeFranchiseeLayout(molde(),o).status;
    assert(veredito(a)===veredito(b),
      'a mesma arte decidiu diferente só porque a fonte foi substituída ('+veredito(a)+' × '+veredito(b)+')');
  });

  test('papel semântico é compilado sem trabalho do designer',()=>{
    const layers=[
      shape('Fundo',0,0,1080,1080,{name:'Fundo',locked:false}),
      text('t',80,100,700,110,'{{titulo}}',{name:'Título',fontSize:80,isVar:true}),
      text('p',800,100,200,80,'R$ 29,90',{name:'Camada 12',fontSize:48}),
      text('c',80,600,300,60,'PEÇA AGORA',{name:'Camada 3',fontSize:32}),
      text('l',80,1020,900,40,'Consulte o regulamento no aplicativo.',{name:'Camada 9',fontSize:16}),
      shape('logo',800,950,200,80,{name:'Logo Delivery Much',locked:false})
    ];
    gCompileLayoutRoles(layers,{w:1080,h:1080});
    const papel=(id)=>layers.find(l=>l.id===id).layoutSemantic;
    assert(papel('Fundo')==='fundo','o fundo não foi reconhecido');
    assert(papel('t')==='titulo','o título não foi reconhecido');
    assert(papel('p')==='preco','o preço não foi reconhecido pelo conteúdo (a camada tinha nome genérico)');
    assert(papel('c')==='cta','o CTA não foi reconhecido pelo verbo');
    assert(papel('l')==='legal','o texto legal não foi reconhecido');
    assert(papel('logo')==='protegida','o logo não foi protegido');
    // ⛔ O contrato antigo do runtime só aceita duas palavras — e campo dinâmico NUNCA é
    // imobilizado, senão o Auto-layout se desligaria justamente onde precisa agir.
    assert(layers.find(l=>l.id==='Fundo').layoutRole==='background','layoutRole do fundo fora do contrato');
    assert(layers.find(l=>l.id==='logo').layoutRole==='protected','layoutRole do logo fora do contrato');
    assert(!layers.find(l=>l.id==='t').layoutRole,'um campo dinâmico foi carimbado como imóvel');
  });

  test('safe zone protege o assunto da foto, não a moldura',()=>{
    const foto={id:'foto',name:'Produto recortado',type:'image',x:0,y:0,w:1000,h:600,
      visible:true,opacity:100,inkBox:{x:0.7,y:0.1,w:0.28,h:0.8}};
    const r=gLayoutObstacleRect(foto,{x:0,y:0,w:1000,h:600});
    assert(r.x>=690&&r.x+r.w<=985,'a zona segura não acompanhou o assunto ('+JSON.stringify(r)+')');
    assert(r.w<400,'a proteção continuou do tamanho da moldura inteira');
    const semZona=gLayoutObstacleRect({id:'x',type:'image',x:0,y:0,w:100,h:100},{x:0,y:0,w:100,h:100});
    assert(semZona.w===100,'camada sem zona segura deixou de proteger a caixa inteira');
  });

  test('quebra semântica não parte valor, medida nem preposição',()=>{
    const camada=text('p',0,0,260,140,'x',{fontSize:38,textBox:'box'});
    const linhas=gSmartWrapText('Combo de bacon por apenas R$ 29,90',260,camada,null,null).split('\n');
    linhas.forEach((linha,i)=>{
      if(i===linhas.length-1)return;
      const ultima=linha.trim().split(/\s+/).pop();
      assert(!/^(R\$|US\$)$/i.test(ultima),'o símbolo de moeda ficou sozinho no fim da linha');
      assert(!G_CONNECTORS.has(ultima.toLowerCase()),'a preposição “'+ultima+'” ficou órfã');
    });
    const un=gSemanticUnits(['Refri','500','ml','gelado'],()=>10,1000);
    assert(un.indexOf('500 ml')>=0,'“500 ml” não virou unidade única');
    // A cola é condicional: se a unidade colada não couber, é melhor separada que partida no meio.
    const apertado=gSemanticUnits(['R$','1.249,00'],(s)=>s.length*40,200);
    assert(apertado.length===2,'colou uma unidade que não cabia e forçaria quebra dura');
  });

  test('alternativas: escolhe por nota e nunca piora a padrão',()=>{
    const layers=[
      text('titulo',60,80,560,200,'{{titulo}}',{fontSize:76,textBox:'box',textTransform:'uppercase',
        layoutRefText:'OFERTA DA SEMANA'}),
      text('produto',60,320,560,180,'{{produto}}',{fontSize:44,textBox:'box',layoutRefText:'Combo Burger'}),
      text('preco',60,540,300,90,'{{preco}}',{fontSize:60,textBox:'point',layoutRefText:'R$ 29,90'}),
      shape('selo',640,300,320,320,{shapeKind:'circle',locked:true})
    ];
    const dados={titulo:'SEMANA DE OFERTAS IMPERDÍVEIS DE ANIVERSÁRIO DA REDE',
                 produto:'Super Combo Duplo Mega Burger Artesanal com Batata',preco:'R$ 1.249,00'};
    const out=solve(layers,dados,{w:1080,h:1080});
    const meta=out._layoutMeta;
    assert(meta&&meta.politica,'o solver não registrou a estratégia usada');
    if(meta.candidatos){
      const padrao=meta.candidatos.find(c=>c.politica==='padrao');
      assert(meta.penal<=padrao.penal+0.001,
        'a alternativa escolhida ficou PIOR que a padrão ('+meta.penal+' × '+padrao.penal+')');
      assert(meta.candidatos.length>1,'nenhuma alternativa foi gerada num caso que precisou encolher');
    }
    // Arte que cabe não paga alternativa nenhuma: o caminho feliz continua o de antes.
    const folgado=solve(layers,{titulo:'OFERTA',produto:'Combo',preco:'R$ 9,90'},{w:1080,h:1080});
    assert(!folgado._layoutMeta.candidatos,'gerou alternativas numa arte que já cabia');
  });

  test('bloqueio impossível diz o campo e o limite seguro, em PT-BR',()=>{
    const antes=window.dVars;
    window.dVars=[{name:'produto',label:'Nome do produto',example:'Combo',type:'text'}];
    try{
      // Mesma geometria do caso "composição impossível" já provado nesta suíte: área minúscula
      // com obstáculo protegido ao lado. O que se cobra aqui é a SAÍDA, não o bloqueio.
      const layers=[
        text('produto',8,8,72,24,'{{produto}}',{fontSize:34,layoutRefText:'Combo'}),
        shape('bloqueio',86,0,110,196,{layoutRole:'protected'})
      ];
      const dados={produto:'Texto impossível de acomodar em uma área minúscula sem perder legibilidade'};
      const out=solve(layers,dados,{w:200,h:200});
      assert(out.some(gLayoutCamadaReprovada),'o caso escolhido não chegou a ser bloqueado');
      const diag=gLayoutDiagnosis(layers,dados,{},{fitText:true,canvas:{w:200,h:200},scope:'franqueado'},out);
      assert(diag&&diag.campo==='produto','o diagnóstico não achou o campo culpado');
      assert(diag.mensagem.indexOf('Nome do produto')>=0,'a mensagem não usou o rótulo do campo');
      assert(!/\{\{|_/.test(diag.mensagem),'a mensagem vazou nome técnico: '+diag.mensagem);
      assert(diag.limite>=0&&diag.limite<dados.produto.length,'o limite seguro não faz sentido: '+diag.limite);
    }finally{window.dVars=antes;}
  });

  test('telemetria registra veredito e culpado sem vazar conteúdo do franqueado',()=>{
    const real=window.gTrackEvent, capturado=[];
    window.gTrackEvent=(evento,payload)=>capturado.push({evento,payload});
    try{
      gLayoutTelemetry({status:'unsafe',changes:[{id:'a'}],invalidIds:['a'],
        meta:{politica:'proporcional',nota:71.2,tentativas:6,ms:18.4,fonte:'ok'},
        diagnostico:{campo:'produto',limite:28,mensagem:'texto do usuário aqui'}},
        {purpose:'export',template:'tpl-1',formato:'1080x1350'});
      assert(capturado.length===1,'o evento não foi emitido');
      const p=capturado[0].payload;
      assert(capturado[0].evento==='layout_resolvido','nome do evento fora da convenção');
      assert(p.status==='unsafe'&&p.campo==='produto'&&p.estrategia==='proporcional'&&p.ms===18.4,
        'o evento não carrega veredito, campo, estratégia e tempo');
      assert(JSON.stringify(p).indexOf('texto do usuário')<0,'a telemetria vazou conteúdo do franqueado');
    }finally{window.gTrackEvent=real;}
  });

  let passed=0;
  const falhas=[];
  for(const item of cases){
    const li=document.createElement('li');li.className='case';
    try{
      await item.fn();passed++;li.classList.add('pass');
      li.innerHTML='<strong>✓ '+item.name+'</strong>';
    }catch(error){
      li.classList.add('fail');li.innerHTML='<strong>✕ '+item.name+'</strong><small>'+String(error&&error.message||error)+'</small>';
      console.error('[auto-layout]',item.name,error);
      falhas.push({name:item.name,error:String(error&&error.message||error)});
    }
    results.appendChild(li);
  }
  const failed=cases.length-passed;
  summary.textContent=passed+'/'+cases.length+' cenários passaram'+(failed?' · '+failed+' falharam':' · motor aprovado');
  summary.dataset.passed=String(passed);summary.dataset.total=String(cases.length);
  document.title=(failed?'FALHOU':'OK')+' — Auto-layout ('+passed+'/'+cases.length+')';

  /* Contrato do runner de CI (`scripts/run-browser-tests.js`): a suíte publica o resultado
     aqui quando termina. Esperar o `load` da página pegaria o teste no meio — as asserções
     são assíncronas porque medem fonte real e desenham em canvas. */
  window.__lumaTest={passed:passed,total:cases.length,failures:falhas,perf:(typeof gLayoutPerfStats==='function'?gLayoutPerfStats():null)};
})();
