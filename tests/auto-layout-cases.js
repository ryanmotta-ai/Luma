/* ══════════════════════════════════════════════════════════════════════════════════════════
   AUTO-LAYOUT — as primitivas de LEITURA. Abra `tests/auto-layout.html`.

   ⚠ O QUE SAIU DAQUI (09/2026): esta suíte tinha 265 casos, e ~230 deles cobriam o Automatic
   Designer — grammar, graph, components, elasticidade, capability, designer moves, candidate
   search, scoring, adaptive groups, emergência. Aquela arquitetura foi removida do produto;
   testar o que não existe é ruído que o time aprende a ignorar.

   O COMPORTAMENTO que substituiu tudo aquilo (Local Fit) tem suíte própria e maior:
   `tests/local-fit.html`. Aqui ficaram as primitivas que o Local Fit, o render, o importador de
   PSD e o Estúdio continuam usando — baseline autorado, deriva de fonte, papel semântico, safe
   zone, quebra semântica — mais os invariantes do que sobrou do solver.

   Browser-native, sem framework: usa Canvas 2D real, para que as mesmas métricas tipográficas
   da prévia e da exportação sejam exercitadas.
   ══════════════════════════════════════════════════════════════════════════════════════════ */
(async function(){
  const results=document.getElementById('results');
  const summary=document.getElementById('summary');
  const cases=[]; const avisos=[];
  const test=(name,fn)=>cases.push({name,fn});
  const assert=(condition,message)=>{if(!condition)throw new Error(message||'asserção falhou');};
  const text=(id,x,y,w,h,content,extra)=>Object.assign({id,name:id,type:'text',x,y,w,h,
    content,font:'Arial',fontSize:48,lineHeight:1.2,textBox:'box',textAlign:'left',vAlign:'top',
    visible:true,opacity:100},extra||{});
  const shape=(id,x,y,w,h,extra)=>Object.assign({id,name:id,type:'shape',shapeKind:'rect',x,y,w,h,
    visible:true,opacity:100,locked:true},extra||{});
  /* O RUNTIME COMPLETO do franqueado: âncoras autoradas + Local Fit. É o mesmo par que a
     prévia e o PNG executam — testar um caminho diferente seria testar outro produto. */
  const runtime=(layers,dados,canvas)=>{
    const cv=canvas||{w:1080,h:1080};
    const base=gApplyRelativeAnchors(layers,dados||{},{},{canvas:cv,scope:'franqueado'});
    return gLocalFitArte(base,{canvas:cv,dados:dados||{},defaults:{}});
  };
  const by=(layers,id)=>layers.find(l=>l.id===id);

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


  /* ══ INVARIANTES DO QUE SOBROU DO SOLVER ══════════════════════════════════════════════════
     `gApplyRelativeAnchors` deixou de acomodar: interpola e resolve âncora MANUAL, só. */

  test('âncoras: o solver é determinístico e não muta o template',()=>{
    const input=[text('produto',60,80,280,54,'{{produto}}',{fontSize:42}),
                 shape('preco',370,55,150,150,{shapeKind:'circle'})];
    const before=JSON.stringify(input);
    const dados={produto:'Hambúrguer artesanal com queijo e molho especial'};
    const a=runtime(input,dados,{w:600,h:400}), b=runtime(input,dados,{w:600,h:400});
    assert(JSON.stringify(a.layers)===JSON.stringify(b.layers),
           'duas execuções iguais deram geometrias diferentes');
    assert(JSON.stringify(input)===before,'o template de entrada foi mutado');
  });

  test('âncoras: conteúdo maior NÃO empurra mais ninguém',()=>{
    const molde=()=>[
      text('titulo',60,80,560,120,'{{titulo}}',{fontSize:72,textBox:'box',layoutRefText:'OFERTA'}),
      text('cta',60,240,300,60,'PEÇA AGORA',{fontSize:32,textBox:'point'})
    ];
    const curto=runtime(molde(),{titulo:'OFERTA'},{w:1080,h:1080});
    const longo=runtime(molde(),{titulo:'SEMANA DE OFERTAS IMPERDÍVEIS DE ANIVERSÁRIO DA REDE INTEIRA'},
                        {w:1080,h:1080});
    const cta=(r)=>r.layers.find(l=>l.id==='cta');
    assert(cta(longo).y===cta(curto).y,
      'o CTA desceu de '+cta(curto).y+' para '+cta(longo).y+' — isso é recomposição, e ela saiu do produto');
    assert(cta(longo).fontSize===cta(curto).fontSize,'o CTA encolheu por causa do título');
  });

  test('âncora MANUAL do designer continua valendo — ela é intenção autorada',()=>{
    const layers=[
      shape('placa',60,80,400,200,{locked:false}),
      text('sob',0,0,300,60,'texto ancorado',{fontSize:28,textBox:'point',
        relativeAnchor:{layerId:'placa',type:'top-to-bottom',gap:20}})
    ];
    const r=runtime(layers,{},{w:1080,h:1080});
    const sob=r.layers.find(l=>l.id==='sob');
    assert(sob.y===300,'a âncora manual não foi resolvida (y='+sob.y+', esperado 300)');
  });

  test('renderer nunca executa Local Fit no escopo designer',async()=>{
    const real=window.gLocalFitArte, calls=[];
    window.gLocalFitArte=(layers,opts)=>{ calls.push(opts); return {layers:layers,result:{
      status:'original',adapted:false,invalid:false,invalidIds:[],requiresAdaptation:false,
      forced:false,changes:[],campos:[],bloqueios:[],meta:null,diagnostico:null}}; };
    try{
      const cv=document.createElement('canvas');cv.width=40;cv.height=40;
      await fRenderTemplateLayers(cv.getContext('2d'),[],40,40,{},{color:'#fff'},
        {layers:[],w:40,h:40,bg:'#fff'},{scope:'designer',purpose:'preview'});
      assert(calls.length===0,'o Estúdio acionou o encaixe do franqueado');
    }finally{window.gLocalFitArte=real;}
  });

  test('exportação bloqueada sai como CONTENT_TOO_LARGE, antes do arquivo',async()=>{
    const real=window.gLocalFitArte;
    window.gLocalFitArte=(layers)=>({layers:layers,result:{
      status:'overflow',adapted:false,invalid:true,invalidIds:['x'],requiresAdaptation:true,
      forced:false,changes:[],campos:[],meta:null,
      bloqueios:[{status:'CONTENT_TOO_LARGE',fieldId:'x',campos:[],overflowX:12,overflowY:0,
                  requiredLines:2,maxLines:1,fontSize:18,minimumFontSize:18,motivo:'teste'}],
      diagnostico:{campo:'x',rotulo:'Campo X',atual:40,limite:12,
                   mensagem:'O texto de “Campo X” é longo demais para esta arte.'}}});
    try{
      const cv=document.createElement('canvas');cv.width=40;cv.height=40;
      let error=null;
      try{
        await fRenderTemplateLayers(cv.getContext('2d'),
          [{id:'x',type:'group',visible:false,x:0,y:0,w:1,h:1}],40,40,{},{color:'#fff'},
          {layers:[],w:40,h:40,bg:'#fff'},{scope:'franqueado',purpose:'export'});
      }catch(e){error=e;}
      assert(error&&error.code==='LUMA_CONTENT_TOO_LARGE','a exportação não recebeu o bloqueio tipado');
      assert(/Campo X/.test(error.message),'a mensagem do bloqueio não chegou ao erro');
    }finally{window.gLocalFitArte=real;}
  });

  test('prévia NUNCA é bloqueada — só a exportação',async()=>{
    const real=window.gLocalFitArte;
    window.gLocalFitArte=(layers)=>({layers:layers,result:{
      status:'overflow',adapted:false,invalid:true,invalidIds:['x'],requiresAdaptation:true,
      forced:false,changes:[],campos:[],bloqueios:[],meta:null,diagnostico:null}});
    try{
      const cv=document.createElement('canvas');cv.width=40;cv.height=40;
      let error=null;
      try{
        await fRenderTemplateLayers(cv.getContext('2d'),
          [{id:'x',type:'group',visible:false,x:0,y:0,w:1,h:1}],40,40,{},{color:'#fff'},
          {layers:[],w:40,h:40,bg:'#fff'},{scope:'franqueado',purpose:'preview'});
      }catch(e){error=e;}
      assert(!error,'a prévia foi interrompida — a pessoa precisa VER o que não cabe');
    }finally{window.gLocalFitArte=real;}
  });

  test('a deriva de fonte é detectada e não muda o veredito',()=>{
    const molde=()=>[
      text('titulo',80,100,700,110,'{{titulo}}',{fontSize:72,textBox:'point',
        layoutRefText:'OFERTA DA SEMANA'}),
      text('apoio',80,250,700,70,'apoio fixo',{fontSize:30})
    ];
    const comFonte=molde(); gStampLayoutBaseline(comFonte[0],'OFERTA DA SEMANA');
    assert(gLayoutFontStatus(comFonte[0])==='ok','a sonda acusou substituição com a mesma fonte');
    /* Simula o PSD autorado com a fonte da marca, aberto num aparelho que não a tem: a sonda
       gravada mede diferente da atual. Sonda MENOR que a atual = a fonte autorada era mais
       estreita que a substituta, e a referência tem que crescer na mesma proporção — senão o
       encaixe leria "o texto cresceu" onde só houve troca de métrica. */
    const semFonte=molde(); gStampLayoutBaseline(semFonte[0],'OFERTA DA SEMANA');
    semFonte[0].layoutRef.probe=semFonte[0].layoutRef.probe*0.85;
    assert(gLayoutFontStatus(semFonte[0])==='substituida','a troca de métrica passou despercebida');
    const ink=gLayoutRefInk(semFonte[0]);
    assert(ink.w>semFonte[0].layoutRef.ink.w*1.1,'a referência não foi calibrada pelo desvio da fonte');
    assert(Math.abs(ink.drift-1/0.85)<0.01,'o desvio medido não bate com a troca de fonte simulada');
    const dados={titulo:'SEMANA DE OFERTAS IMPERDÍVEIS DE ANIVERSÁRIO'};
    const a=runtime(comFonte,dados,{w:1080,h:1080}).result.status;
    const b=runtime(semFonte,dados,{w:1080,h:1080}).result.status;
    assert(a===b,'a mesma arte decidiu diferente só porque a fonte foi substituída ('+a+' × '+b+')');
  });

  test('telemetria registra veredito e culpado sem vazar conteúdo do franqueado',()=>{
    const real=window.gTrackEvent, capturado=[];
    window.gTrackEvent=(evento,payload)=>capturado.push({evento,payload});
    try{
      gLayoutTelemetry({status:'overflow',changes:[{id:'a'}],invalidIds:['a'],
        meta:{ms:1.8,fonte:'ok'},
        diagnostico:{campo:'produto',limite:28,mensagem:'texto do usuário aqui'}},
        {purpose:'export',template:'tpl-1',formato:'1080x1350'});
      assert(capturado.length===1,'o evento não foi emitido');
      const p=capturado[0].payload;
      assert(capturado[0].evento==='layout_resolvido','nome do evento fora da convenção');
      assert(p.status==='overflow'&&p.campo==='produto'&&p.ms===1.8&&p.fonte==='ok',
        'o evento não carrega veredito, campo, tempo e estado da fonte');
      assert(p.camadas_invalidas===1,'o evento não conta a camada bloqueada');
      assert(JSON.stringify(p).indexOf('texto do usuário')<0,'a telemetria vazou conteúdo do franqueado');
    }finally{window.gTrackEvent=real;}
  });

  test('⛔ NENHUM símbolo do Automatic Designer sobrevive no runtime',()=>{
    /* O portão do encerramento da frente. Se qualquer um destes voltar a existir, alguém
       reconstruiu a arquitetura que o produto decidiu não ter. */
    const removidos=['gCompileLayoutGrammar','gCompileCompositionGraph','gCompileLayoutComponents',
      'gLayoutElasticity','gLayoutImpactZones','gLayoutOperationalCapability','gLayoutDesignerMoves',
      'gApplyLayoutAction','gSearchLayoutCandidates','gSelectLayoutCandidate','gScoreComposition',
      'gLayoutScoreProfile','gLayoutEscolherAlternativa','gLayoutPrecisaAlternativas',
      'gLayoutDiagnosis','gAdaptiveScaleGroups','gShadowValidationRecord','gShadowConfidence',
      'gLayoutEffectiveRole','gDescribeFranchiseeLayout','gLayoutCamadaReprovada'];
    const vivos=removidos.filter(n=>typeof window[n]==='function');
    assert(!vivos.length,'o Automatic Designer voltou ao runtime: '+vivos.join(', '));
    assert(typeof gLocalFitArte==='function','o Local Fit não está carregado — o runtime ficou sem motor');
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
  window.__lumaTest={passed:passed,total:cases.length,failures:falhas,notas:avisos,
    perf:(typeof gLayoutPerfStats==='function'?gLayoutPerfStats():null)};
})();
