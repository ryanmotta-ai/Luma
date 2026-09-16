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

  test('placa usa a tinta de referência quando o bbox nominal do PSD sobra',()=>{
    const layers=[
      shape('placa',145,85,150,90,{locked:false,parentId:'grupo'}),
      text('texto',100,100,240,60,'{{produto}}',{fontSize:40,textBox:'point',textAlign:'center',
        parentId:'grupo',layoutRefText:'VAMO'}),
      {id:'grupo',name:'Grupo',type:'group',x:100,y:80,w:240,h:100,visible:true,opacity:100}
    ];
    const out=solve(layers,{produto:'VAMOS JUNTOS'},{w:700,h:400});
    const p=by(out,'placa'),t=by(out,'texto'),r=gInkRect(t,t._fit);
    assert(p._placa&&p._placa.alvo==='texto','a tinta real não vinculou texto e placa');
    assert(p.w>150,'a placa não cresceu porque o bbox nominal desligou a relação');
    assert(p.x<=r.x&&p.x+p.w>=r.x+r.w,'a placa não envolveu a tinta maior');
  });

  test('placa encolhe preservando o respiro da copy curta',()=>{
    const layers=[
      shape('placa',70,85,360,90,{locked:false,parentId:'grupo'}),
      text('texto',95,100,310,60,'{{produto}}',{fontSize:40,textBox:'point',textAlign:'center',
        parentId:'grupo',layoutRefText:'COMBO FAMÍLIA'}),
      {id:'grupo',name:'Grupo',type:'group',x:70,y:80,w:360,h:100,visible:true,opacity:100}
    ];
    const out=solve(layers,{produto:'Dale'},{w:700,h:400});
    const p=by(out,'placa'),t=by(out,'texto'),r=gInkRect(t,t._fit);
    assert(p._placa&&p._placa.padE>0&&p._placa.padD>0,'os respiros laterais não foram preservados');
    assert(p.w<360,'a placa manteve a largura autorada mesmo com uma copy muito menor');
    assert(p.x<r.x&&p.x+p.w>r.x+r.w,'a placa curta cortou a tinta');
  });

  test('pill oval acompanha o campo quando ele muda de posição',()=>{
    const layers=[
      text('titulo',80,40,360,55,'{{titulo}}',{fontSize:42}),
      shape('pill',150,190,180,70,{locked:false,shapeKind:'ellipse',parentId:'grupo'}),
      text('cta',170,202,140,46,'{{cta}}',{fontSize:34,textBox:'point',textAlign:'center',
        parentId:'grupo',layoutRefText:'Dale',relativeAnchor:{layerId:'titulo',type:'top-to-bottom',gap:95}}),
      {id:'grupo',name:'Grupo',type:'group',x:140,y:180,w:200,h:90,visible:true,opacity:100}
    ];
    const out=solve(layers,{titulo:'Festival de sabores artesanais por tempo limitado',cta:'Dale'},{w:600,h:500});
    const p=by(out,'pill'),t=by(out,'cta'),r=gInkRect(t,t._fit);
    assert(p._placa&&p._placa.alvo==='cta','o pill oval não foi reconhecido como caixa do campo');
    assert(p.y>190,'o pill ficou para trás quando o texto foi empurrado');
    assert(p.y<=r.y&&p.y+p.h>=r.y+r.h,'o pill se separou verticalmente da copy');
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

  /* ⚠ Dois fixtures anteriores deste teste NÃO eram impossíveis, e medir mostrou por quê:
     o primeiro (caixa 72×24) cabia em 11px dentro da prancheta; o segundo tinha a composição
     AUTORADA já sangrando para fora, e sangria autorada é intenção do designer — nada que o
     franqueado digite pode "piorar" o que já saía. Este é impossível de verdade: prancheta
     real, o preço autorado cabe folgado, e o piso de LEGIBILIDADE (2,2% do lado curto = 24px
     numa peça de 1080) impede encolher o bastante para o texto do franqueado caber. */
  const _arteImpossivel=()=>[
    shape('fundo',0,0,1080,1350),
    text('preco',80,1250,300,80,'{{preco}}',{name:'Preço',fontSize:60,lineHeight:1.15,
      layoutRefText:'R$ 29,90'})
  ];
  const _valorImpossivel='De R$ 149,90 por apenas R$ 29,90 à vista ou em até doze vezes sem juros no cartão de crédito, válido somente para pedidos feitos pelo aplicativo nas lojas participantes da região';

  test('composição impossível é marcada como insegura',()=>{
    const layers=_arteImpossivel();
    const out=solve(layers,{preco:_valorImpossivel},{w:1080,h:1350});
    const l=by(out,'preco'), r=gInkRect(l,l._fit);
    assert(r.y+r.h>1350,'o cenário escolhido não chega a escapar da prancheta');
    assert(l._foraDaArte,'a fuga da prancheta não foi carimbada');
    assert(out.some(gLayoutCamadaReprovada),'a composição impossível não reprovou');
  });

  test('CONTRATO: o texto do designer sai IDÊNTICO ao publicado',()=>{
    /* O pedido do Ryan, em uma frase: "as medidas que eu deixei quando cliquei em publicar são
       as medidas que eu quero que sejam respeitadas". Com o texto que ele compôs, a arte do
       franqueado tem que ser a arte do Estúdio — mesma fonte, mesma posição, veredito
       `original`. Se isto quebrar, o franqueado abre a prévia e vê outra arte sem ter digitado
       nada, e a confiança no produto vai junto. */
    const layers=[
      text('titulo',80,120,700,120,'{{titulo}}',{name:'Título',fontSize:80,lineHeight:1.15,
        layoutRefText:'OFERTA DA SEMANA'}),
      text('produto',80,280,700,120,'{{produto}}',{name:'Produto',fontSize:44,
        layoutRefText:'Combo Burger'}),
      text('preco',80,440,400,90,'{{preco}}',{name:'Preço',fontSize:64,lineHeight:1.1,
        textBox:'point',layoutRefText:'R$ 29,90'}),
      text('cta',80,580,340,56,'PEÇA AGORA',{name:'CTA',fontSize:34,textBox:'point'})
    ];
    const dados={titulo:'OFERTA DA SEMANA',produto:'Combo Burger',preco:'R$ 29,90'};
    const out=solve(layers,dados,{w:1080,h:1350});
    out.forEach(l=>{
      if(l.type!=='text')return;
      const pub=layers.find(x=>x.id===l.id);
      assert(Math.abs(l.y-pub.y)<0.5,'“'+l.name+'” saiu de y='+pub.y+' para '+Math.round(l.y)+' com o texto do próprio designer');
      assert(Math.abs(l._fit.fontSize-pub.fontSize)<0.5,
        '“'+l.name+'” encolheu de '+pub.fontSize+'px para '+l._fit.fontSize+'px com o texto do próprio designer');
      assert(l._entrelinha==null,'“'+l.name+'” teve a entrelinha apertada sem ninguém digitar nada');
    });
    assert(gDescribeFranchiseeLayout(layers,out).status==='original',
      'a arte com o texto autorado não saiu como “original”');
  });

  test('CONTRATO: a prévia ABRE mostrando a arte publicada',()=>{
    /* Antes de o franqueado digitar qualquer coisa, a prévia preenche os campos vazios com um
       placeholder. A ordem antiga caía no exemplo de dicionário ou no RÓTULO do campo ("Nome do
       produto") quando o campo não tinha `example` — quase sempre mais longo que a frase que o
       designer compôs, então a arte já abria adaptada, com a letra menor, sem ninguém ter
       digitado nada. É a causa mais visível do "abri a prévia e está tudo pequeno".
       Agora o placeholder é o próprio texto autorado (`layoutRefText`). */
    if(typeof fLpInjectPlaceholders!=='function'){ return; }   // página sem a prévia carregada
    const layers=[
      text('titulo',80,120,700,120,'{{produto}}',{name:'Título',fontSize:80,lineHeight:1.15,
        layoutRefText:'Combo Burger'}),
      text('depor',80,300,400,60,'De {{de}} por',{name:'De por',fontSize:32,textBox:'point',
        layoutRefText:'De R$ 49,90 por'}),
      text('cta',80,280,340,56,'PEÇA AGORA',{name:'CTA',fontSize:34,textBox:'point'})
    ];
    const antesState=window.fState, antesVars=window.dVars;
    window.fState={dados:{},camp:{},material:{layers:layers}};
    window.dVars=[{name:'produto',label:'Nome do produto',type:'text'},
                  {name:'de',label:'Preço antigo',type:'text'}];
    let dados={};
    try{ fLpInjectPlaceholders(layers,dados,{}); }
    finally{ window.fState=antesState; window.dVars=antesVars; }

    assert(dados.produto==='Combo Burger',
      'a prévia abriu com “'+dados.produto+'” em vez do texto que o designer compôs');
    /* ⚠ Campo DENTRO de uma frase não pode receber a frase montada: em "De {{de}} por", usar o
       `layoutRefText` como valor do campo produziria "De De R$ 49,90 por por". */
    assert(dados.de!=='De R$ 49,90 por','a frase montada vazou como valor do campo');

    const out=solve(layers,dados,{w:1080,h:1350});
    const t=by(out,'titulo');
    assert(Math.abs(t._fit.fontSize-80)<0.5,
      'a arte abriu com o título em '+t._fit.fontSize+'px em vez dos 80px publicados');
    assert(gDescribeFranchiseeLayout(layers,out).status==='original',
      'a prévia recém-aberta já saiu adaptada, sem ninguém digitar nada');
  });

  test('CONTRATO: texto maior desce o de baixo e NÃO encolhe a letra',()=>{
    /* A outra metade: quando a pessoa digita mais, o motor acomoda pela ORDEM — quebra, empurra
       o bloco de baixo — e só encolhe quando empurrar não resolve. Encolher primeiro era o que
       fazia a arte chegar pequena na mão do franqueado. */
    const layers=[
      text('titulo',80,120,700,120,'{{titulo}}',{name:'Título',fontSize:80,lineHeight:1.15,
        layoutRefText:'OFERTA DA SEMANA'}),
      text('produto',80,280,700,120,'{{produto}}',{name:'Produto',fontSize:44,
        layoutRefText:'Combo Burger'}),
      // Perto o bastante para o motor inferir a corrente: mais de duas linhas de distância é
      // quebra de seção, não respiro entre irmãos (regra de `_gInferirCorrentes`).
      text('cta',80,440,340,56,'PEÇA AGORA',{name:'CTA',fontSize:34,textBox:'point'})
    ];
    const dados={titulo:'OFERTA DA SEMANA',
      produto:'Super Combo Duplo Mega Burger Artesanal com Batata Frita e Refrigerante'};
    const out=solve(layers,dados,{w:1080,h:1350});
    const prod=by(out,'produto'), cta=by(out,'cta');
    assert(Math.abs(prod._fit.fontSize-44)<0.5,'o produto encolheu ('+prod._fit.fontSize+'px) em vez de crescer em linhas');
    assert(Math.abs(by(out,'titulo')._fit.fontSize-80)<0.5,'o título encolheu sem precisar');
    assert(cta.y>440,'o CTA não acompanhou o crescimento do produto');
  });

  test('teto de linhas não encolhe a letra quando há espaço',()=>{
    /* Medido antes da correção: numa prancheta 1080×1350 com caixa de 600×300 e espaço de
       sobra, um texto de 5 linhas saía a 36px em vez de 40px só para obedecer ao teto semântico
       de 3 linhas; com um selo travado ao lado (que nem chegava a ser tocado), a mesma caixa
       saía a 24px — 40% menor, sem nada colidir e sem nada sair da prancheta. */
    const layers=[
      text('produto',100,100,600,300,'{{produto}}',{name:'Produto',fontSize:40,layoutRefText:'Combo Burger'}),
      shape('selo',760,80,200,200,{locked:true})
    ];
    const out=solve(layers,
      {produto:'Super Combo Duplo Mega Burger Artesanal com Batata Frita Cheddar e Bacon Crocante'},
      {w:1080,h:1350});
    const l=by(out,'produto');
    assert(l._fit.excedeuLinhas,'o cenário escolhido nem passou do teto de linhas');
    assert(Math.abs(l._fit.fontSize-40)<0.5,
      'encolheu de 40px para '+l._fit.fontSize+'px só para obedecer ao teto de linhas, com a prancheta vazia em volta');
  });

  test('teto de linhas é preferência, não bloqueio',()=>{
    /* O erro mais caro deste produto seria recusar a arte de um franqueado por gosto editorial.
       Aqui o texto usa mais linhas do que o teto semântico pede, mas cabe na prancheta e não
       toca em nada: tem que sair como ADAPTADA, nunca como bloqueada.
       Medido na bancada antes da correção: 12 de 14 bloqueios eram exatamente isto. */
    const layers=[
      text('produto',8,8,72,24,'{{produto}}',{fontSize:34,name:'Produto',layoutRefText:'Combo'}),
      shape('bloqueio',86,0,110,196,{layoutRole:'protected'})
    ];
    const dados={produto:'Texto impossível de acomodar em uma área minúscula sem perder legibilidade'};
    const out=solve(layers,dados,{w:200,h:200});
    const l=by(out,'produto'), r=gInkRect(l,l._fit);
    assert(l._fit.excedeuLinhas,'o cenário escolhido nem chegou a passar do teto de linhas');
    assert(!l._fit.estourou,'passar do teto de linhas está sendo tratado como "não coube"');
    assert(r.x>=0&&r.y>=0&&r.x+r.w<=200&&r.y+r.h<=200,'o cenário escolhido escapou da prancheta');
    const res=gDescribeFranchiseeLayout(layers,out);
    assert(res.status!=='unsafe','arte inteira dentro da prancheta foi BLOQUEADA por gosto editorial');
  });

  test('camada fixa empurrada para cima de obstáculo é acusada',()=>{
    /* O buraco do guardião: o varredor de colisão só olhava camadas COM CAMPO como possíveis
       culpadas. Um CTA fixo, empurrado pela corrente para cima da foto, passava batido — três
       artes saíam APROVADAS com o texto sobre o assunto da imagem (medido na bancada).
       O culpado nomeado tem que ser quem CRESCEU, não a vítima que foi empurrada. */
    const layers=[
      text('produto',60,60,400,120,'{{produto}}',{fontSize:48,textBox:'box',name:'Produto',layoutRefText:'Combo'}),
      text('cta',60,220,300,50,'PEÇA AGORA',{fontSize:30,textBox:'point',name:'CTA'}),
      {id:'foto',name:'Foto',type:'image',x:60,y:300,w:400,h:260,visible:true,opacity:100}
    ];
    const out=solve(layers,{produto:'Super Combo Duplo Mega Burger Artesanal com Batata Frita e Refrigerante Gelado'},{w:600,h:600});
    const cta=by(out,'cta'), foto=by(out,'foto');
    const rc=gInkRect(cta,cta._fit);
    /* A INVARIANTE, não o mecanismo: ou a escada resolve, ou a arte é acusada. As duas saídas
       são aceitáveis; o que não pode é sair aprovada com o CTA sobre a foto. */
    const invadiu=rc.y+rc.h>foto.y+2 && rc.x<foto.x+foto.w && rc.x+rc.w>foto.x;
    assert(!invadiu||out.some(gLayoutCamadaReprovada),
      'o CTA fixo entrou na foto e a arte saiu aprovada');
    if(invadiu){
      const culpado=gLayoutCulpado(out);
      assert(culpado&&culpado.id==='produto',
        'o culpado apontado foi “'+(culpado&&culpado.name)+'” — a vítima empurrada, não quem cresceu');
    }
  });

  test('alternativa só destrona a padrão com ganho visível',()=>{
    /* Medido na bancada: em metade das trocas o ganho era ~1 ponto numa penalidade de 150–390.
       Meio por cento movendo o CTA 14px é ruído decidindo geometria — e arte que muda entre
       versões sem ninguém ter pedido. A padrão é a de alteração mínima e vence empate prático. */
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
    if(meta&&meta.candidatos&&meta.candidatos.length>1){
      const padrao=meta.candidatos.find(c=>c.politica==='padrao');
      if(meta.politica!=='padrao'){
        const ganho=padrao.penal-meta.penal;
        assert(ganho>=Math.max(3,padrao.penal*0.02)-0.001,
          'trocou de política por um ganho de '+ganho.toFixed(2)+' — abaixo da margem mínima');
      }
    }
  });

  test('a nota mede a adaptação, não o texto do franqueado',()=>{
    /* Densidade e equilíbrio comparavam a arte com a referência AUTORADA, então disparavam em
       100% dos cenários — inclusive nos que saíram intocados, onde o motor não fez nada. A nota
       saturava em zero e não servia para comparar candidatos nem para telemetria. */
    const layers=[
      text('titulo',60,60,600,120,'{{titulo}}',{fontSize:48,textBox:'box',layoutRefText:'Oferta'}),
      text('apoio',60,220,600,60,'texto fixo de apoio',{fontSize:24,textBox:'box'})
    ];
    const out=solve(layers,{titulo:'Oferta bem maior que a referência autorada'},{w:1080,h:1080});
    const res=gDescribeFranchiseeLayout(layers,out);
    const nota=gScoreComposition(out,{canvas:{w:1080,h:1080}});
    if(res.status==='original'){
      assert(nota.itens.densidade<0.001,'arte intocada pontuou densidade '+nota.itens.densidade.toFixed(2));
      assert(nota.itens.equilibrio<0.001,'arte intocada pontuou equilíbrio '+nota.itens.equilibrio.toFixed(2));
      assert(nota.penal<0.001,'arte intocada saiu com penalidade '+nota.penal.toFixed(2));
    }
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
    window.dVars=[{name:'preco',label:'Preço promocional',example:'R$ 29,90',type:'text'}];
    try{
      // Mesma arte do caso "composição impossível" já provado nesta suíte. O que se cobra aqui
      // é a SAÍDA (qual campo, quantos caracteres), não o bloqueio em si.
      const layers=_arteImpossivel();
      const dados={preco:_valorImpossivel};
      const out=solve(layers,dados,{w:1080,h:1350});
      assert(out.some(gLayoutCamadaReprovada),'o caso escolhido não chegou a ser bloqueado');
      const diag=gLayoutDiagnosis(layers,dados,{},{fitText:true,canvas:{w:1080,h:1350},scope:'franqueado'},out);
      assert(diag&&diag.campo==='preco','o diagnóstico não achou o campo culpado');
      assert(diag.mensagem.indexOf('Preço promocional')>=0,'a mensagem não usou o rótulo do campo');
      assert(!/\{\{|_/.test(diag.mensagem),'a mensagem vazou nome técnico: '+diag.mensagem);
      assert(diag.limite>=0&&diag.limite<dados.preco.length,'o limite seguro não faz sentido: '+diag.limite);
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

  /* ══ LAYOUT GRAMMAR — a leitura da arte autorada (`gCompileLayoutGrammar`) ═══════════════
     A gramática é OBSERVACIONAL: descreve a composição e NÃO entra no solve. Os casos aqui
     provam três coisas diferentes — que a leitura reconhece o que um designer reconheceria, que
     ela usa a MESMA régua espacial do solver, e que ela não toca em nada. */
  const gram=(layers,canvas)=>gCompileLayoutGrammar(layers,canvas||{w:1080,h:1080});
  const temRel=(g,tipo,de,para)=>gGrammarRelations(g,tipo).some(r=>r.de===de&&r.para===para);
  const coluna=(g,tipo,ids)=>gGrammarRelations(g,tipo).some(r=>r.membros&&ids.every(i=>r.membros.indexOf(i)>=0));
  // Arte sintética grande: N blocos em 6 colunas, relações reais em toda a extensão da lista.
  const arteGrande=(n)=>{
    const L=[],COLS=6,CW=170;
    for(let i=0;i<n;i++){
      const x=40+(i%COLS)*CW, y=40+Math.floor(i/COLS)*72;
      if(i%7===3)L.push(shape('s'+i,x-6,y-6,150,56,{locked:false,name:'Placa'}));
      L.push(text('t'+i,x,y,138,44,i%4===0?'{{campo'+i+'}}':'TEXTO '+i,
        {fontSize:i%5===0?34:24,name:i%5===0?'Preço':'Texto '+i}));
    }
    return L;
  };

  test('gramática: título acima de CTA vira relação de vizinhança',()=>{
    const layers=[
      text('titulo',90,100,420,60,'OFERTA DA SEMANA',{fontSize:46}),
      text('cta',90,180,260,48,'PEÇA AGORA',{fontSize:30})
    ];
    const g=gram(layers,{w:700,h:600});
    assert(gGrammarNode(g,'titulo').papel==='titulo','o título não foi reconhecido como título');
    assert(gGrammarNode(g,'cta').papel==='cta','o CTA não foi reconhecido como CTA');
    assert(temRel(g,'abaixo-de','cta','titulo'),'a gramática não leu o CTA como filho do título');
    assert(gGrammarRelations(g,'abaixo-de','cta')[0].confianca==='fraca',
      'proximidade pura não pode nascer com confiança alta');
    assert(gGrammarNode(g,'titulo').degrau===0&&gGrammarNode(g,'cta').degrau===1,
      'os degraus tipográficos saíram fora de ordem');
  });

  test('gramática: preço dentro de placa é contenção forte e componente reconhecido',()=>{
    const layers=[
      shape('placa',70,80,360,110,{locked:false}),
      text('preco',95,100,310,65,'{{preco}}',{fontSize:40,name:'Preço'})
    ];
    const g=gram(layers,{w:600,h:500});
    assert(gGrammarNode(g,'preco').papel==='preco','o preço não foi reconhecido');
    const dentro=gGrammarRelations(g,'dentro-de','preco')[0];
    assert(dentro&&dentro.para==='placa','a contenção texto-dentro-de-placa não foi lida');
    assert(dentro.intencional===true,'a contenção autorada não foi marcada como intencional');
    const comp=g.groups.find(x=>x.componente==='placa');
    assert(comp&&comp.membros.indexOf('placa')>=0&&comp.membros.indexOf('preco')>=0,
      'o componente placa+texto não foi reconhecido');
    assert(comp.confianca==='forte','a placa perdeu a confiança forte');
    assert(comp.evidencia.indexOf('contencao')>=0&&comp.evidencia.indexOf('z-order')>=0
      &&comp.evidencia.indexOf('texto-unico')>=0,'a placa não registrou os três sinais');
    assert(comp.evidencia.indexOf('campo-dinamico')>=0,'a placa não viu o campo dinâmico');
  });

  test('gramática: alinhamento vira COLUNA com membros, não par a par',()=>{
    const layers=[
      text('a',120,100,400,60,'PRIMEIRA',{fontSize:40}),
      text('b',120,400,300,50,'SEGUNDA',{fontSize:32}),
      text('c',600,100,200,50,'SOLTA',{fontSize:32})
    ];
    const g=gram(layers,{w:900,h:700});
    assert(coluna(g,'alinha-esquerda',['a','b']),'a coluna da esquerda não foi lida');
    const col=gGrammarRelations(g,'alinha-esquerda').find(r=>r.membros.indexOf('a')>=0);
    assert(col.membros.indexOf('c')<0,'a camada de outra coluna entrou na coluna errada');
    assert(col.valor===120,'a coluna não guardou a aresta que a define');
    assert(gGrammarRelations(g,'alinha-esquerda').every(r=>r.membros.length>=2),
      'coluna de um membro só não é alinhamento');
  });

  test('gramática: decoração sem campo é decorativa e não dinâmica',()=>{
    const layers=[
      text('titulo',80,80,400,60,'{{titulo}}',{fontSize:44}),
      shape('enfeite',700,700,120,120,{locked:false,name:'Forma decorativa'})
    ];
    const g=gram(layers,{w:1080,h:1080});
    const d=gGrammarNode(g,'enfeite');
    assert(d.papel==='decoracao','a forma não foi lida como decoração');
    assert(d.decorativa===true,'a decoração não foi marcada como decorativa');
    assert(d.campos.length===0&&d.flex==='fixa','decoração sem campo não pode ser dinâmica');
    assert(gGrammarNode(g,'titulo').flex==='dinamica','o campo do título não virou nó dinâmico');
  });

  test('gramática: camada protegida é rígida',()=>{
    const layers=[
      text('titulo',80,80,400,60,'{{titulo}}',{fontSize:44}),
      {id:'logo',name:'Logo da marca',type:'image',x:820,y:60,w:180,h:90,visible:true,opacity:100},
      text('travado',80,900,400,50,'ENDEREÇO FIXO',{fontSize:24,lockPosition:true})
    ];
    const g=gram(layers,{w:1080,h:1080});
    const logo=gGrammarNode(g,'logo');
    assert(logo.papel==='protegida','o logo não foi reconhecido como protegido');
    assert(logo.protegida===true&&logo.flex==='rigida','o logo protegido não ficou rígido');
    assert(gGrammarNode(g,'travado').flex==='rigida','a camada com posição travada não ficou rígida');
  });

  test('gramática: grupo autoral é CERTO e explícito',()=>{
    const layers=[
      {id:'grupo',name:'Bloco de oferta',type:'group',x:70,y:80,w:360,h:180,visible:true,opacity:100},
      shape('placa',70,80,360,110,{locked:false,parentId:'grupo'}),
      text('preco',95,100,310,65,'{{preco}}',{fontSize:40,name:'Preço',parentId:'grupo'}),
      {id:'rodape',name:'Grupo legal',type:'group',x:70,y:1000,w:360,h:40,visible:true,opacity:100},
      text('legal',80,1000,340,30,'Consulte o regulamento',{fontSize:16,parentId:'rodape'})
    ];
    const g=gram(layers,{w:1080,h:1080});
    const autoral=g.groups.find(x=>x.id==='g:grupo');
    assert(autoral&&autoral.dinamico===true,'o grupo com campo não foi marcado como dinâmico');
    assert(autoral.confianca==='certa','grupo declarado pelo designer não é inferência');
    assert(autoral.componente==='grupo'&&autoral.evidencia[0]==='grupo-autoral',
      'o grupo autoral perdeu a evidência de ser declarado');
    const fixo=g.groups.find(x=>x.id==='g:rodape');
    assert(fixo&&fixo.dinamico===false,'um grupo sem campo foi marcado como dinâmico');
  });

  test('gramática: proximidade sozinha é FRACA e não vira componente',()=>{
    const layers=[
      text('a',90,100,300,50,'PRIMEIRA LINHA',{fontSize:34}),
      text('b',90,165,300,50,'SEGUNDA LINHA',{fontSize:34})
    ];
    const g=gram(layers,{w:700,h:600});
    const bloco=g.groups.find(x=>x.motivo==='proximidade');
    assert(bloco,'o aglomerado por proximidade não foi observado');
    assert(bloco.confianca==='fraca','estar perto não pode valer confiança alta');
    assert(bloco.componente===null,'proximidade sozinha virou componente operacional');
    assert(bloco.padrao==='bloco','o padrão observado se perdeu');
    assert(bloco.evidencia.length===1&&bloco.evidencia[0]==='proximidade',
      'apareceu evidência que não existe');
  });

  test('gramática: âncora autoral promove o aglomerado a CERTO',()=>{
    const layers=[
      text('a',90,100,300,50,'PRIMEIRA',{fontSize:34}),
      text('b',90,165,300,50,'SEGUNDA',{fontSize:34,
        relativeAnchor:{type:'top-to-bottom',layerId:'a',gap:15}})
    ];
    const g=gram(layers,{w:700,h:600});
    assert(temRel(g,'ancora-autoral','b','a'),'a âncora que o designer marcou não foi lida');
    assert(!temRel(g,'abaixo-de','b','a'),'a inferência competiu com a relação manual');
    const bloco=g.groups.find(x=>x.motivo==='proximidade');
    assert(bloco.confianca==='certa','declaração do designer não pode valer o mesmo que proximidade');
    assert(bloco.evidencia.indexOf('ancora-autoral')>=0,'a evidência da âncora não foi registrada');
  });

  test('gramática: par de preço lateral é PROVÁVEL, ainda não componente',()=>{
    const layers=[
      text('de',80,200,150,44,'De R$ 149,90',{fontSize:26,name:'De'}),
      text('por',245,200,190,44,'{{preco}}',{fontSize:26,name:'Preço'})
    ];
    const g=gram(layers,{w:700,h:600});
    assert(temRel(g,'direita-de','por','de'),'a vizinhança lateral não foi lida');
    const par=g.groups.find(x=>x.padrao==='par-de-preco');
    assert(par,'o par de preço não foi observado');
    assert(par.confianca==='provavel','proximidade + papel não é certeza nem é só proximidade');
    assert(par.componente===null,'o par de preço virou componente operacional cedo demais');
  });

  test('gramática e solver usam a MESMA régua de vizinhança',()=>{
    // O vão é medido em LINHAS de texto da própria arte: `gLayoutLinhaTipografica` × 2.
    const linha=gLayoutLinhaTipografica({fontSize:40},{fontSize:40});   // 48
    const dentroDoAlcance=Math.round(linha*2)-6, foraDoAlcance=Math.round(linha*2)+20;
    const monta=(vao)=>[
      text('pai',90,100,300,60,'{{titulo}}',{fontSize:40}),
      text('filho',90,160+vao,300,60,'FIXO',{fontSize:40})
    ];
    const perto=monta(dentroDoAlcance), longe=monta(foraDoAlcance);
    const gPerto=gram(perto,{w:700,h:900}), gLonge=gram(longe,{w:700,h:900});
    assert(temRel(gPerto,'abaixo-de','filho','pai'),'a gramática não viu o vizinho dentro do alcance');
    assert(!temRel(gLonge,'abaixo-de','filho','pai'),'a gramática adotou vizinho fora do alcance');
    // O solver, com a mesma arte, tem que concordar — é a mesma primitiva nos dois lados.
    const sPerto=solve(monta(dentroDoAlcance),{titulo:'TEXTO QUE CRESCE MUITO ALÉM DA CAIXA'},{w:700,h:900});
    const sLonge=solve(monta(foraDoAlcance),{titulo:'TEXTO QUE CRESCE MUITO ALÉM DA CAIXA'},{w:700,h:900});
    assert(by(sPerto,'filho')._anchorAuto&&by(sPerto,'filho')._anchorAuto.layerId==='pai',
      'o solver não encadeou o que a gramática leu como vizinho');
    assert(!by(sLonge,'filho')._anchorAuto,
      'o solver encadeou o que a gramática rejeitou: as réguas divergiram');
  });

  test('corrente inferida do solver continua com o mesmo contrato',()=>{
    const layers=[
      text('titulo',90,100,420,58,'{{titulo}}',{fontSize:46}),
      text('cta',90,180,260,48,'PEÇA AGORA',{fontSize:30})
    ];
    const out=solve(layers,{titulo:'Combo artesanal com batata, bebida e sobremesa especial'},{w:700,h:600});
    const a=by(out,'cta')._anchorAuto;
    assert(a&&a.type==='top-to-bottom'&&a.layerId==='titulo'&&a.auto===true,
      'a corrente inferida mudou de forma');
    assert(by(out,'cta').y>180,'o CTA não acompanhou o crescimento do título');
  });

  test('gramática: relação válida depois da 200ª camada é descoberta',()=>{
    const layers=arteGrande(250);
    const g=gram(layers,{w:1080,h:3200});
    const tarde=layers.slice(200).map(l=>l.id);
    const achadas=g.relations.filter(r=>
      tarde.indexOf(r.de)>=0||tarde.indexOf(r.para)>=0
      ||(r.membros&&r.membros.some(m=>tarde.indexOf(m)>=0)));
    assert(achadas.length>0,'nenhuma relação depois da 200ª camada — o teto cego voltou');
    const penultima=layers[layers.length-2].id;
    assert(g.relations.some(r=>r.de===penultima||r.para===penultima
      ||(r.membros&&r.membros.indexOf(penultima)>=0)),
      'a penúltima camada da arte saiu sem nenhuma relação');
    assert(g.nodes.length===layers.length,'a gramática deixou camadas de fora');
  });

  test('gramática: 300 camadas não explodem o tempo',()=>{
    const p150=arteGrande(150), p300=arteGrande(300);
    const marca=(L,cv)=>{const t0=performance.now();gCompileLayoutGrammar(L,cv);return performance.now()-t0;};
    marca(p300,{w:1080,h:4000});                       // aquece: a 1ª volta paga o JIT
    const t150=marca(p150,{w:1080,h:2200}), t300=marca(p300,{w:1080,h:4000});
    /* Guarda de EXPLOSÃO, não orçamento fino: o que não pode voltar é o O(n²) cego. Dobrar a
       arte pode mais que dobrar o tempo (mais camadas por célula), mas não pode quadruplicar.
       Medido fora do navegador: 150 camadas ≈ 6ms, 300 ≈ 11ms. O teto aqui é folgado de
       propósito — máquina de CI é mais lenta, e teste que pisca não vale nada. */
    assert(t300<400,'300 camadas levaram '+t300.toFixed(1)+'ms: virou explosão');
    assert(t300<Math.max(30,t150*3.5),
      'o custo cresceu pior que linear: '+t150.toFixed(1)+'ms → '+t300.toFixed(1)+'ms');
  });

  test('gramática: structuralSignature ignora o conteúdo e a adaptação',()=>{
    const monta=(txt)=>[
      text('titulo',80,90,420,70,txt,{fontSize:52}),
      shape('placa',80,200,360,110,{locked:false}),
      text('produto',105,220,310,70,'{{produto}}',{fontSize:40,textBox:'point',
        textAlign:'center',layoutRefText:'COMBO'}),
      text('cta',80,340,260,48,'PEÇA AGORA',{fontSize:30})
    ];
    const a=gram(monta('OFERTA DA SEMANA'),{w:700,h:600});
    const b=gram(monta('PROMOÇÃO RELÂMPAGO DE INVERNO'),{w:700,h:600});
    assert(a.structuralSignature===b.structuralSignature,
      'trocar o texto de uma camada mudou a assinatura ESTRUTURAL');
    // ORIGINAL FIRST: o conteúdo é o que o designer compôs — nada se move, nada muda.
    const out=solve(monta('OFERTA DA SEMANA'),{produto:'COMBO'},{w:700,h:600});
    const depois=gram(out,{w:700,h:600});
    assert(a.structuralSignature===depois.structuralSignature,
      'a composição intocada mudou de gramática: '+a.structuralSignature+' → '+depois.structuralSignature);
    assert(gGrammarRelations(depois,'dentro-de','produto')[0].intencional===true,
      'a relação autorada foi lida como colisão depois do solve');
  });

  test('gramática: a assinatura VISUAL enxerga o deslocamento que a estrutural ignora',()=>{
    const monta=(yCta)=>[
      text('titulo',90,100,420,60,'OFERTA DA SEMANA',{fontSize:46}),
      text('cta',90,yCta,260,48,'PEÇA AGORA',{fontSize:30})
    ];
    const a=gram(monta(180),{w:700,h:600});
    const b=gram(monta(205),{w:700,h:600});
    assert(a.structuralSignature===b.structuralSignature,
      'deslocar 25px sem mudar relação nenhuma alterou a assinatura estrutural');
    assert(a.visual.visualSignature!==b.visual.visualSignature,
      'a assinatura visual não percebeu o deslocamento');
    assert(a.visual.gaps.length&&a.visual.gaps[0]!==b.visual.gaps[0],
      'o respiro normalizado não acompanhou o deslocamento');
    assert(JSON.stringify(a.visual).indexOf('OFERTA')<0,
      'a representação visual vazou conteúdo de texto');
    assert(a.visual.degraus[0]===1,'o maior degrau tipográfico não é a base da proporção');
  });

  test('gramática: é determinística e não toca nas camadas',()=>{
    const layers=[
      text('titulo',80,90,420,70,'{{titulo}}',{fontSize:52}),
      shape('placa',80,200,360,110,{locked:false}),
      text('preco',105,220,310,70,'R$ 29,90',{fontSize:40}),
      {id:'logo',name:'Logo',type:'image',x:560,y:40,w:100,h:60,visible:true,opacity:100}
    ];
    const congelado=JSON.stringify(layers);
    const a=gram(layers,{w:700,h:600});
    const b=gram(layers,{w:700,h:600});
    assert(JSON.stringify(layers)===congelado,'a gramática MUTOU as camadas recebidas');
    assert(JSON.stringify(a)===JSON.stringify(b),'duas compilações iguais divergiram');
    assert(a.version===G_LAYOUT_GRAMMAR_V,'a gramática saiu sem versão');
    // Não copia camada inteira: o nó carrega ID e dados derivados, não o conteúdo autorado.
    assert(JSON.stringify(a.nodes).indexOf('{{titulo}}')<0,'a gramática copiou o conteúdo da camada');
    // Ordem da lista não pode virar informação: a mesma arte embaralhada tem a mesma estrutura.
    const invertida=layers.slice().reverse();
    assert(gram(invertida,{w:700,h:600}).nodes.length===a.nodes.length,'a ordem mudou a leitura');
  });

  test('gramática: hierarquia tipográfica sai ordenada do maior para o menor',()=>{
    const layers=[
      text('legal',80,980,900,30,'Consulte o regulamento',{fontSize:16}),
      text('titulo',80,90,900,80,'MANCHETE',{fontSize:72}),
      text('apoio',80,220,900,50,'Subtítulo de apoio',{fontSize:32})
    ];
    const g=gram(layers,{w:1080,h:1080});
    assert(g.hierarchy.length===3,'a hierarquia não separou os três degraus');
    assert(g.hierarchy[0].fontSize===72&&g.hierarchy[2].fontSize===16,'a hierarquia saiu fora de ordem');
    assert(g.hierarchy[0].ids[0]==='titulo','o maior degrau não é o título');
  });

  /* ══ COMPOSITION GRAPH — a gramática virando rede navegável (§11) ════════════════════════
     O Graph é DERIVADO: recebe a gramática, não as camadas. Os casos aqui provam o que ele
     promete — que a autoridade da evidência é respeitada (fraco não vira estrutura), que a
     navegação não entra em laço, e que ele não toca em nada do que recebeu. */
  const grafo=(layers,canvas)=>gCompileCompositionGraph(gCompileLayoutGrammar(layers,canvas||{w:1080,h:1080}));

  test('graph: relação só é estrutural quando a evidência é forte',()=>{
    const perto=[
      text('titulo',90,100,420,60,'OFERTA DA SEMANA',{fontSize:46}),
      text('cta',90,180,260,48,'PEÇA AGORA',{fontSize:30})
    ];
    const G1=grafo(perto,{w:700,h:600});
    assert(gGraphOutgoing(G1,'cta','below').length===1,'a vizinhança nem sequer virou aresta');
    assert(!gGraphHasStructuralRelation(G1,'cta','titulo','below'),
      'proximidade sozinha virou relação estrutural');
    assert(gGraphAncestors(G1,'cta').length===0,'a proximidade virou dependência');
    /* As duas TÊM relação forte — são alinhadas pela esquerda, e isso a §10 prova. O que não
       existe é DEPENDÊNCIA forte. A pergunta sem tipo responde a primeira, não a segunda. */
    assert(gGraphHasStructuralRelation(G1,'cta','titulo','aligned-left'),
      'o alinhamento autorado deixou de ser relação forte');
    // A MESMA arte, com a âncora que o designer marcou: aí sim é estrutura.
    const declarado=[
      text('titulo',90,100,420,60,'OFERTA DA SEMANA',{fontSize:46}),
      text('cta',90,180,260,48,'PEÇA AGORA',{fontSize:30,
        relativeAnchor:{type:'top-to-bottom',layerId:'titulo',gap:20}})
    ];
    const G2=grafo(declarado,{w:700,h:600});
    assert(gGraphHasStructuralRelation(G2,'cta','titulo','authorial-anchor'),
      'a declaração do designer não virou relação estrutural');
    assert(gGraphRelationStrength(gGraphOutgoing(G2,'cta','authorial-anchor')[0])
      >G_GRAPH_MIN_ESTRUTURAL-1,'a força da âncora ficou abaixo do corte estrutural');
  });

  test('graph: duas colunas independentes não viram uma cadeia só',()=>{
    const duas=[
      text('e1',80,100,300,60,'ESQ TOPO',{fontSize:40}),
      text('e2',80,200,300,60,'ESQ BASE',{fontSize:40}),
      text('d1',600,100,300,60,'DIR TOPO',{fontSize:40}),
      text('d2',600,200,300,60,'DIR BASE',{fontSize:40})
    ];
    const G=grafo(duas,{w:1080,h:600});
    assert(gGraphOutgoing(G,'d2','below').every(e=>e.para!=='e1'&&e.para!=='e2'),
      'a coluna da direita adotou pai na coluna da esquerda');
    assert(G.readingFlow.length===2,'as duas colunas viraram um fluxo de leitura só');
    assert(G.readingFlow[0].indexOf('e1')>=0&&G.readingFlow[1].indexOf('d1')>=0,
      'os ramos não separaram as colunas');
  });

  test('graph: placa + preço é cluster estrutural forte',()=>{
    const layers=[
      shape('placa',70,80,360,110,{locked:false}),
      text('preco',95,100,310,65,'{{preco}}',{fontSize:40,name:'Preço'})
    ];
    const G=grafo(layers,{w:600,h:500});
    const c=gGraphCluster(G,'preco');
    assert(c&&c.tipo==='placa','o par placa+preço não formou cluster');
    assert(c.confianca==='forte'&&c.membros.join(',')==='placa,preco','o cluster saiu errado');
    assert(gGraphHasStructuralRelation(G,'placa','preco','plate-of'),'a aresta plate-of não é forte');
    assert(gGraphCluster(G,'placa').id===c.id,'os dois membros não caíram no mesmo cluster');
  });

  test('graph: proximidade fraca NÃO forma cluster',()=>{
    const layers=[
      text('a',90,100,300,50,'PRIMEIRA LINHA',{fontSize:34}),
      text('b',90,165,300,50,'SEGUNDA LINHA',{fontSize:34})
    ];
    const G=grafo(layers,{w:700,h:600});
    assert(G.clusters.length===0,'proximidade fraca fundiu nós num cluster');
    assert(G.sugestoes.length===1&&G.sugestoes[0].confianca==='fraca',
      'a observação fraca sumiu em vez de virar sugestão consultável');
    assert(gGraphCluster(G,'a')===null,'um nó fraco foi atribuído a cluster');
  });

  test('graph: âncora manual vence a inferência automática',()=>{
    const layers=[
      text('a',90,100,300,50,'PRIMEIRA',{fontSize:34}),
      text('b',90,165,300,50,'SEGUNDA',{fontSize:34,
        relativeAnchor:{type:'top-to-bottom',layerId:'a',gap:15}})
    ];
    const G=grafo(layers,{w:700,h:600});
    assert(gGraphOutgoing(G,'b','authorial-anchor').length===1,'a âncora do designer não virou aresta');
    assert(gGraphOutgoing(G,'b','below').length===0,'a inferência competiu com a relação manual');
    const aut=gGraphAuthorialRelations(G,'b');
    assert(aut.length&&aut.every(e=>e.autorada===true),'as relações autorais não são consultáveis');
    assert(gGraphAncestors(G,'b').join(',')==='a','a subida não usou a relação declarada');
  });

  test('graph: raiz dinâmica atravessa cadeia forte',()=>{
    const layers=[
      shape('placa',70,80,360,110,{locked:false}),
      text('preco',95,100,310,65,'{{preco}}',{fontSize:40,name:'Preço'})
    ];
    const G=grafo(layers,{w:600,h:500});
    const r=gGraphDynamicRoot(G,'placa');
    assert(r&&r.id==='preco','a placa não achou o campo que a faz crescer');
    assert(r.confianca==='forte','a raiz veio com confiança diferente da cadeia');
    assert(r.caminho.join(',')==='preco','o caminho até a raiz não foi registrado');
    assert(gGraphOutgoing(G,'placa','dynamic-root').length===1,'a raiz não virou aresta navegável');
  });

  test('graph: sem campo dinâmico não existe dependência — só vizinhança',()=>{
    /* MESMA GEOMETRIA do caso autorizado, sem um único campo. O solver não cria corrente aqui
       (a poda por raiz dinâmica a apaga), e o Graph tem que dizer a mesma coisa. */
    const layers=[
      text('titulo',90,100,420,60,'OFERTA DA SEMANA',{fontSize:46}),
      text('cta',90,180,260,48,'PEÇA AGORA',{fontSize:30})
    ];
    const G=grafo(layers,{w:700,h:600});
    assert(gGraphOutgoing(G,'cta','below').length===1,'a vizinhança sumiu do grafo');
    assert(gGraphOutgoing(G,'cta','dynamic-dependency').length===0,
      'autorizou dependência numa arte sem campo nenhum');
    assert(gGraphDynamicRoot(G,'cta')===null,'inventou raiz onde não há campo');
    assert(!gGraphHasDependency(G,'cta','titulo'),'proximidade sozinha virou dependência');
    // E o solver, na mesma arte, também não encadeia: é a mesma regra nos dois lados.
    const out=solve(layers,{},{w:700,h:600});
    assert(!by(out,'cta')._anchorAuto,'o solver encadeou o que o Graph rejeitou');
  });

  test('graph: ciclo autoral não trava a navegação',()=>{
    const layers=[
      text('a',90,100,300,50,'{{titulo}}',{fontSize:34,
        relativeAnchor:{type:'top-to-bottom',layerId:'b',gap:10}}),
      text('b',90,165,300,50,'SEGUNDA',{fontSize:34,
        relativeAnchor:{type:'top-to-bottom',layerId:'a',gap:10}})
    ];
    const G=grafo(layers,{w:700,h:600});     // se laçar, o teste nem chega aqui
    assert(gGraphAncestors(G,'a').join(',')==='b','a subida não sobreviveu ao ciclo');
    assert(gGraphAncestors(G,'b').join(',')==='a','a subida não sobreviveu ao ciclo (inverso)');
    const r=gGraphDynamicRoot(G,'b');
    assert(r&&r.id==='a','o ciclo escondeu a raiz que existia');
    assert(gGraphDynamicRoot(G,'a')===null,'inventou raiz dando a volta no ciclo');
    assert(gGraphDescendants(G,'a').join(',')==='b','a descida não sobreviveu ao ciclo');
  });

  test('graph: fluxo de leitura simples é estável e ordenado',()=>{
    const layers=[
      text('legal',80,980,900,30,'Consulte o regulamento',{fontSize:16}),
      text('titulo',80,90,900,80,'MANCHETE',{fontSize:72}),
      text('cta',80,400,400,50,'PEÇA AGORA',{fontSize:30}),
      text('apoio',80,220,900,50,'Subtítulo de apoio',{fontSize:32})
    ];
    const a=grafo(layers,{w:1080,h:1080}), b=grafo(layers,{w:1080,h:1080});
    assert(a.readingFlow.length===1,'coluna única virou mais de um ramo');
    assert(a.readingFlow[0].join(',')==='titulo,apoio,cta,legal',
      'a leitura não saiu de cima para baixo: '+a.readingFlow[0].join(','));
    assert(JSON.stringify(a.readingFlow)===JSON.stringify(b.readingFlow),
      'o fluxo de leitura não é estável entre compilações');
    // A ordem da lista de camadas não pode virar a ordem de leitura.
    const trocado=grafo([layers[1],layers[3],layers[2],layers[0]],{w:1080,h:1080});
    assert(JSON.stringify(trocado.readingFlow)===JSON.stringify(a.readingFlow),
      'reordenar as camadas mudou o fluxo de leitura');
  });

  test('graph: deslocamento muda o diff VISUAL, não o ESTRUTURAL',()=>{
    const monta=(yCta)=>[
      text('titulo',90,100,420,60,'OFERTA DA SEMANA',{fontSize:46}),
      text('cta',90,yCta,260,48,'PEÇA AGORA',{fontSize:30})
    ];
    const a=gCompileLayoutGrammar(monta(180),{w:700,h:600});
    const b=gCompileLayoutGrammar(monta(205),{w:700,h:600});
    const d=gCompareLayoutStructure(a,b);
    assert(d.sameStructure===true,'deslocar 25px foi lido como mudança de estrutura');
    assert(d.visualChanged===true,'o diff visual não percebeu o deslocamento');
    assert(d.relationsAdded.length===0&&d.relationsRemoved.length===0,
      'apareceu relação nova onde só houve deslocamento');
    assert(d.clustersChanged.length===0&&d.hierarchyChanged===false,'o diff acusou o que não mudou');
    // O diff aceita Graph nos dois lados: o Graph é derivado, a resposta é a mesma.
    const dg=gCompareLayoutStructure(gCompileCompositionGraph(a),gCompileCompositionGraph(b));
    assert(JSON.stringify(dg)===JSON.stringify(d),'comparar Graphs deu resultado diferente de comparar Grammars');
  });

  test('graph: remover uma relação forte aparece no diff estrutural',()=>{
    const comPlaca=[
      shape('placa',70,80,360,110,{locked:false}),
      text('preco',95,100,310,65,'{{preco}}',{fontSize:40,name:'Preço'})
    ];
    const semPlaca=[text('preco',95,100,310,65,'{{preco}}',{fontSize:40,name:'Preço'})];
    const d=gCompareLayoutStructure(gCompileLayoutGrammar(comPlaca,{w:600,h:500}),
                                    gCompileLayoutGrammar(semPlaca,{w:600,h:500}));
    assert(d.sameStructure===false,'perder a placa não mudou a assinatura estrutural');
    assert(d.relationsRemoved.some(r=>r.tipo==='dentro-de'&&r.de==='preco'),
      'a contenção removida não apareceu no diff');
    assert(d.clustersChanged.some(c=>c.motivo==='placa'&&c.mudanca==='removido'),
      'o cluster da placa não foi reportado como removido');
  });

  test('graph: IDs de cluster são determinísticos',()=>{
    const base=[
      shape('placa',70,80,360,110,{locked:false}),
      text('preco',95,100,310,65,'{{preco}}',{fontSize:40,name:'Preço'}),
      text('solto',700,700,200,50,'RODAPÉ',{fontSize:20})
    ];
    // Mesma arte, outra ordem na lista — sem alterar o z-order relativo de placa e preço.
    const outraOrdem=[base[2],base[0],base[1]];
    const a=grafo(base,{w:1080,h:1080}), b=grafo(base,{w:1080,h:1080}), c=grafo(outraOrdem,{w:1080,h:1080});
    assert(a.clusters[0].id===b.clusters[0].id,'duas compilações iguais deram IDs diferentes');
    assert(a.clusters[0].id===c.clusters[0].id,
      'a ordem incidental da lista virou parte do ID do cluster');
    assert(/^c:[0-9a-f]{8}$/.test(a.clusters[0].id),'o ID do cluster não tem forma estável');
  });

  test('graph: 300 camadas continuam analisáveis',()=>{
    const L=arteGrande(300), cv={w:1080,h:4000};
    const marca=(fn)=>{const t0=performance.now();const r=fn();return {ms:performance.now()-t0,r};};
    marca(()=>gCompileCompositionGraph(gCompileLayoutGrammar(L,cv)));   // aquece o JIT
    const g=marca(()=>gCompileLayoutGrammar(L,cv));
    const G=marca(()=>gCompileCompositionGraph(g.r));
    assert(G.r.nodes.length===L.length,'o Graph perdeu camadas no caminho');
    assert(G.r.edges.length>0&&G.r.readingFlow.length>0,'o Graph saiu vazio numa arte grande');
    /* O Graph é DERIVADO: ele percorre relações, não camadas ao quadrado. O que este caso
       protege é justamente isso — se algum dia alguém puser uma varredura de pares aqui, o
       custo do Graph deixa de ser uma fração do da Grammar e este número dispara. */
    assert(G.ms<g.ms*2.5,'o Graph passou a custar mais que a Grammar que o alimenta: '
      +g.ms.toFixed(1)+'ms → '+G.ms.toFixed(1)+'ms');
    assert(g.ms+G.ms<500,'Grammar+Graph levaram '+(g.ms+G.ms).toFixed(1)+'ms em 300 camadas');
  });

  test('graph: não muta a Grammar nem as camadas',()=>{
    const layers=[
      shape('placa',70,80,360,110,{locked:false}),
      text('preco',95,100,310,65,'{{preco}}',{fontSize:40,name:'Preço'}),
      text('cta',80,340,260,48,'PEÇA AGORA',{fontSize:30})
    ];
    const antesLayers=JSON.stringify(layers);
    const gram=gCompileLayoutGrammar(layers,{w:1080,h:1080});
    const antesGram=JSON.stringify(gram);
    const G=gCompileCompositionGraph(gram);
    assert(JSON.stringify(layers)===antesLayers,'o Graph MUTOU as camadas');
    assert(JSON.stringify(gram)===antesGram,'o Graph MUTOU a Grammar que recebeu');
    // Nó do Graph é projeção, não cópia da camada: geometria e conteúdo ficam na Grammar.
    const n=gGraphNode(G,'preco');
    assert(n&&n.rect===undefined&&n.content===undefined,'o nó do Graph copiou a camada');
    assert(gGrammarNode(gram,'preco').rect,'a geometria deixou de estar na Grammar');
    // Determinismo: duas compilações da mesma gramática são idênticas.
    const H=gCompileCompositionGraph(gram);
    assert(JSON.stringify(G.edges)===JSON.stringify(H.edges),'as arestas não são determinísticas');
    assert(JSON.stringify(G.clusters)===JSON.stringify(H.clusters),'os clusters não são determinísticos');
  });

  test('graph: a força da relação mora num lugar só',()=>{
    assert(G_GRAPH_FORCA.certa>G_GRAPH_FORCA.forte,'a ordem de autoridade está invertida');
    assert(G_GRAPH_FORCA.forte>G_GRAPH_FORCA.provavel,'a ordem de autoridade está invertida');
    assert(G_GRAPH_FORCA.provavel>G_GRAPH_FORCA.fraca,'a ordem de autoridade está invertida');
    assert(gGraphIsStructural({confianca:'certa'})&&gGraphIsStructural({confianca:'forte'}),
      'declaração e prova forte deveriam montar estrutura');
    assert(!gGraphIsStructural({confianca:'provavel'})&&!gGraphIsStructural({confianca:'fraca'}),
      'inferência provável ou fraca não pode montar estrutura');
    assert(gGraphRelationStrength(null)===0&&gGraphRelationStrength({})===0,
      'aresta sem confiança precisa cair no piso, não virar undefined');
  });

  /* ══ AUTORIZAÇÃO DE DEPENDÊNCIA — a fonte única (§ `gLayoutDependencyAuthorization`) ══════
     A dívida que o Composition Graph expôs: o solver sabia distinguir "está perto" de "faz
     parte da cadeia de adaptação de um campo", mas essa regra vivia dentro de
     `_gInferirCorrentes`. Agora ela é uma primitiva que solver e gramática consomem.
     O que estes casos protegem: os dois lados respondendo IGUAL, e a geometria continuando
     fraca — nenhuma relação foi promovida para que a dependência existisse. */
  // campo → bloco fixo → CTA fixo: a cadeia do enunciado, com e sem campo na raiz.
  const cadeia=(conteudoTitulo)=>[
    text('titulo',90,100,420,60,conteudoTitulo,{fontSize:46}),
    text('bloco',90,175,420,50,'BLOCO FIXO',{fontSize:34}),
    text('cta',90,240,260,48,'PEÇA AGORA',{fontSize:30})
  ];

  test('dep: campo → bloco fixo → CTA — Graph acha a mesma raiz que o solver encadeia',()=>{
    const G=grafo(cadeia('{{titulo}}'),{w:700,h:600});
    const r=gGraphDynamicRoot(G,'cta');
    assert(r&&r.id==='titulo','o Graph não chegou ao campo que origina a cadeia');
    assert(r.caminho.join(',')==='bloco,titulo','o caminho até a raiz não bate com a cadeia');
    assert(r.confianca==='forte','cadeia inferida mas autorizada vale forte, não certa');
    // O solver, na mesma arte: a corrente que ele monta é EXATAMENTE esse caminho.
    const out=solve(cadeia('{{titulo}}'),{titulo:'TEXTO QUE CRESCE MUITO ALEM DA CAIXA DESENHADA'},{w:700,h:600});
    assert(by(out,'cta')._anchorAuto.layerId==='bloco','o solver encadeou diferente do Graph');
    assert(by(out,'bloco')._anchorAuto.layerId==='titulo','o solver encadeou diferente do Graph');
  });

  test('dep: a geometria continua FRACA — nada foi promovido',()=>{
    const G=grafo(cadeia('{{titulo}}'),{w:700,h:600});
    const below=gGraphOutgoing(G,'cta','below')[0];
    assert(below&&below.confianca==='fraca',
      'a vizinhança foi promovida para que a dependência existisse');
    assert(!gGraphIsStructural(below),'aresta geométrica fraca virou estrutural');
    const dep=gGraphOutgoing(G,'cta','dynamic-dependency')[0];
    assert(dep&&dep.para==='bloco'&&gGraphIsStructural(dep),
      'a autorização não virou aresta própria');
    assert(dep.raiz==='titulo'&&dep.motivo==='campo-dinamico','a aresta não carrega a origem');
    // As duas convivem sobre o MESMO par: são fatos diferentes, não um substituindo o outro.
    assert(below.de===dep.de&&below.para!==undefined,'as duas leituras se perderam');
  });

  test('dep: relação manual cria dependência onde a heurística não criaria',()=>{
    // 600px de distância: muito além do alcance da régua espacial. Só a declaração vale.
    const layers=[
      text('titulo',90,100,420,60,'{{titulo}}',{fontSize:46}),
      text('longe',90,800,260,48,'RODAPÉ',{fontSize:30,
        relativeAnchor:{type:'top-to-bottom',layerId:'titulo',gap:20}})
    ];
    const G=grafo(layers,{w:700,h:1000});
    assert(gGraphOutgoing(G,'longe','below').length===0,'a heurística criou corrente a 600px');
    const r=gGraphDynamicRoot(G,'longe');
    assert(r&&r.id==='titulo','a declaração do designer não criou dependência');
    assert(r.confianca==='certa','cadeia toda declarada tem que valer certa');
    assert(gGraphHasAuthorialRelation(G,'longe','titulo'),'a relação autoral não é consultável');
  });

  test('dep: grupo travado bloqueia a propagação, igual ao solver',()=>{
    const monta=(travado)=>[
      text('titulo',90,100,420,60,'{{titulo}}',{fontSize:46}),
      Object.assign({id:'g',name:'Grupo',type:'group',x:90,y:175,w:420,h:120,
        visible:true,opacity:100},travado?{locked:true}:{}),
      text('cta',90,185,260,48,'PEÇA AGORA',{fontSize:30,parentId:'g'})
    ];
    const solto=grafo(monta(false),{w:700,h:600}), preso=grafo(monta(true),{w:700,h:600});
    assert(gGraphDynamicRoot(solto,'cta'),'sem trava a cadeia deveria existir');
    assert(gGraphDynamicRoot(preso,'cta')===null,'o grupo travado não bloqueou a propagação');
    // O solver concorda: dentro de grupo travado não nasce corrente.
    const out=solve(monta(true),{titulo:'TEXTO LONGO QUE CRESCE ALEM DA CAIXA DESENHADA'},{w:700,h:600});
    assert(!by(out,'cta')._anchorAuto,'o solver encadeou dentro de grupo travado');
  });

  test('dep: bloco de preço fixo não é empurrado — nem no Graph, nem no solver',()=>{
    const layers=[
      text('titulo',90,100,420,60,'{{titulo}}',{fontSize:46}),
      text('preco',90,175,260,60,'{{preco}}',{fontSize:44,name:'Preço'})
    ];
    const G=grafo(layers,{w:700,h:600});
    assert(gGrammarNode(G.grammar,'preco').papel==='preco','o preço não foi reconhecido');
    assert(gGraphOutgoing(G,'preco','dynamic-dependency').length===0,
      'o bloco de preço virou filho de corrente');
    const r=gGraphDynamicRoot(G,'preco');
    assert(!r||r.id==='preco','o preço foi tratado como empurrado por outro campo');
    const out=solve(layers,{titulo:'TEXTO LONGO QUE CRESCE ALEM DA CAIXA',preco:'R$ 9,99'},{w:700,h:600});
    assert(!by(out,'preco')._anchorAuto,'o solver empurrou o bloco de preço');
  });

  test('dep: campo opcional vazio autoriza SÓ o colapso do próprio vão',()=>{
    /* A exceção é de RUNTIME: o vão só existe depois de interpolar. A gramática lê a arte
       AUTORADA, onde nada está vazio — então quem responde por ela é o solver, e é ele que o
       caso exercita. O que se prova aqui é que a exceção sobreviveu à extração. */
    const layers=[
      text('titulo',80,90,360,60,'OFERTA',{fontSize:44}),
      text('opcional',80,170,360,40,'{{opcional}}',{fontSize:26}),
      text('cta',80,230,240,44,'APROVEITE',{fontSize:28})
    ];
    const out=solve(layers,{opcional:''},{w:600,h:500});
    assert(by(out,'cta')._anchorAuto,'a exceção do campo vazio se perdeu na extração');
    assert(by(out,'cta')._anchorAuto.colapso>0,'o colapso do vão não foi creditado');
    assert(by(out,'cta').y<230,'o espaço do campo vazio não foi recolhido');
    assert(by(out,'cta').y>=190,'o bloco subiu além da faixa opcional');
    // Sem campo NENHUM na arte, a mesma vizinhança não autoriza nada.
    const semCampo=[
      text('a',80,90,360,60,'OFERTA',{fontSize:44}),
      text('b',80,170,360,40,'FIXO',{fontSize:26})
    ];
    assert(!by(solve(semCampo,{},{w:600,h:500}),'b')._anchorAuto,
      'arte sem campo ganhou corrente: a poda se perdeu');
  });

  test('dep: duas raízes possíveis desempatam de forma determinística',()=>{
    // O CTA tem campo acima E âncora manual para outro campo: manual vence, sempre.
    const layers=[
      text('campoA',90,100,420,60,'{{a}}',{fontSize:46}),
      text('campoB',600,100,300,60,'{{b}}',{fontSize:46}),
      text('cta',90,180,260,48,'PEÇA AGORA',{fontSize:30,
        relativeAnchor:{type:'top-to-bottom',layerId:'campoB',gap:20}})
    ];
    const a=grafo(layers,{w:1080,h:600}), b=grafo(layers,{w:1080,h:600});
    const r=gGraphDynamicRoot(a,'cta');
    assert(r&&r.id==='campoB','a âncora manual não venceu a vizinhança geométrica');
    assert(JSON.stringify(r)===JSON.stringify(gGraphDynamicRoot(b,'cta')),
      'o desempate não é determinístico');
  });

  test('dep: relação visual forte continua NÃO sendo dependência',()=>{
    const layers=[
      text('titulo',120,100,400,60,'{{titulo}}',{fontSize:46}),
      text('rodape',120,900,400,40,'RODAPÉ ALINHADO',{fontSize:20})
    ];
    const G=grafo(layers,{w:1080,h:1080});
    assert(gGraphHasStructuralRelation(G,'titulo','rodape','aligned-left'),
      'o alinhamento autorado deixou de ser relação forte');
    assert(!gGraphHasDependency(G,'titulo','rodape'),
      'alinhamento forte foi tratado como dependência — o erro que o rename existe para evitar');
    assert(gGraphDynamicRoot(G,'rodape')===null,'subiu por alinhamento');
    assert(G_GRAPH_DEPENDENCIA.indexOf('below')<0&&G_GRAPH_DEPENDENCIA.indexOf('inside')<0,
      'geometria voltou para a lista de dependência');
  });

  test('dep: a primitiva de autorização é pura e não laça em ciclo',()=>{
    const fatos=[
      {id:'raiz',temCampo:true,elegivel:true,anchor:null},
      {id:'meio',temCampo:false,elegivel:true,anchor:{layerId:'raiz',autorada:false}},
      {id:'folha',temCampo:false,elegivel:true,anchor:{layerId:'meio',autorada:false}},
      {id:'solto',temCampo:false,elegivel:true,anchor:null},
      // ciclo puro, sem raiz: tem que terminar, não autorizar e não travar
      {id:'c1',temCampo:false,elegivel:true,anchor:{layerId:'c2',autorada:false}},
      {id:'c2',temCampo:false,elegivel:true,anchor:{layerId:'c1',autorada:false}}
    ];
    const congelado=JSON.stringify(fatos);
    const r=gLayoutDependencyAuthorization(fatos);
    assert(JSON.stringify(fatos)===congelado,'a primitiva MUTOU os fatos recebidos');
    assert(r.get('raiz').autorizado&&r.get('raiz').raizId==='raiz','a raiz não se autoriza');
    assert(r.get('folha').autorizado&&r.get('folha').raizId==='raiz','a autorização não propagou');
    assert(r.get('folha').caminho.join(',')==='meio,raiz','o caminho saiu errado');
    assert(!r.get('solto').autorizado,'autorizou quem não tem elo nenhum');
    assert(!r.get('c1').autorizado&&!r.get('c2').autorizado,'o ciclo virou autorização');
    assert(JSON.stringify([...gLayoutDependencyAuthorization(fatos)])===JSON.stringify([...r]),
      'a primitiva não é determinística');
  });

  test('dep: campo opcional vazio NÃO é passe livre de dependência geral',()=>{
    const fatos=[
      {id:'vaziu',temCampo:true,vazio:true,elegivel:true,anchor:null},
      {id:'filho',temCampo:false,elegivel:true,anchor:{layerId:'vaziu',autorada:false}}
    ];
    const r=gLayoutDependencyAuthorization(fatos);
    assert(!r.get('vaziu').autorizado,'campo vazio autorizou a si mesmo como raiz geral');
    assert(!r.get('filho').autorizado,'campo vazio transmitiu dependência geral');
    // Com o colapso específico carimbado, aí sim — e só aí.
    const comColapso=[
      {id:'vaziu',temCampo:true,vazio:true,elegivel:true,anchor:null},
      {id:'filho',temCampo:false,elegivel:true,colapsoDeCampo:true,
        anchor:{layerId:'vaziu',autorada:false}}
    ];
    const r2=gLayoutDependencyAuthorization(comColapso);
    assert(r2.get('filho').autorizado&&r2.get('filho').motivo==='campo-opcional-vazio',
      'a exceção do colapso específico se perdeu');
  });

  test('dep: a proteção mora numa régua só (solver e gramática usam a mesma)',()=>{
    const fatoDe=(id)=>({travada:id==='grupoTravado',paiId:null});
    assert(gLayoutPodeAcompanhar({id:'a',grupo:false,visivel:true,travada:false,
      precoFixo:false,paiId:null},fatoDe)===true,'camada solta deveria poder acompanhar');
    assert(gLayoutPodeAcompanhar({id:'a',grupo:false,visivel:true,travada:true,
      precoFixo:false,paiId:null},fatoDe)===false,'camada travada foi liberada');
    assert(gLayoutPodeAcompanhar({id:'a',grupo:false,visivel:true,travada:false,
      precoFixo:true,paiId:null},fatoDe)===false,'bloco de preço foi liberado');
    assert(gLayoutPodeAcompanhar({id:'a',grupo:true,visivel:true,travada:false,
      precoFixo:false,paiId:null},fatoDe)===false,'grupo entrou na corrente');
    assert(gLayoutPodeAcompanhar({id:'a',grupo:false,visivel:true,travada:false,
      precoFixo:false,paiId:'grupoTravado'},fatoDe)===false,'grupo travado não bloqueou o filho');
    assert(gLayoutPodeAcompanhar(null,fatoDe)===false,'camada inexistente foi liberada');
  });

  /* ══ LAYOUT COMPONENTS — o motor reconhecendo unidades, não camadas (§12) ═════════════════
     A disciplina desta fase: ERRAR POR NÃO AGRUPAR É MELHOR QUE AGRUPAR ERRADO. Metade dos
     casos aqui prova o que o compilador RECUSA — logo dentro do preço, containment virando
     acoplamento, proximidade virando bloco. É onde o estrago moraria quando isto virar
     operacional. */
  const comps=(layers,canvas)=>{
    const g=gCompileLayoutGrammar(layers,canvas||{w:1080,h:1080});
    const G=gCompileCompositionGraph(g);
    return {g:g,G:G,C:gCompileLayoutComponents(g,G)};
  };
  const umDe=(r,tipo)=>gComponentsByType(r.C,tipo)[0]||null;

  test('comp: preço + placa vira price-block',()=>{
    const r=comps([
      shape('placa',70,80,360,110,{locked:false}),
      text('preco',95,100,310,65,'{{preco}}',{fontSize:40,name:'Preço'})
    ],{w:600,h:500});
    const c=umDe(r,'price-block');
    assert(c,'o par preço+placa não virou price-block');
    assert(c.membros.join(',')==='placa,preco','os membros do price-block saíram errados');
    assert(c.confianca==='forte','price-block com placa deveria ser forte');
    assert(c.evidencia.indexOf('semantic-price')>=0&&c.evidencia.indexOf('plate-of')>=0,
      'o componente não registra POR QUE existe');
    assert(c.rootId==='preco','a raiz do componente não é o texto do preço');
    assert(gComponentContains(c,'placa')&&gComponentOfNode(r.C,'preco')===c,'as APIs não acham o membro');
  });

  test('comp: de + por + placa formam UM price-block coerente',()=>{
    /* O padrão real dos PSDs da marca. No grafo `de` e `por` são IRMÃOS (penduram no mesmo
       produto), não pai e filho — por isso existe o juntor de irmão de preço. */
    const r=comps([
      text('produto',90,420,900,200,'{{produto}}',{fontSize:96,name:'Produto'}),
      text('de',90,700,340,60,'{{de}}',{fontSize:38,textBox:'point',name:'De por'}),
      text('por',470,672,400,110,'{{por}}',{fontSize:84,textBox:'point',name:'Preço'})
    ],{w:1080,h:1920});
    const blocos=gComponentsByType(r.C,'price-block');
    assert(blocos.length===1,'o par de preço virou '+blocos.length+' componentes em vez de um');
    assert(blocos[0].membros.join(',')==='de,por','o bloco não juntou o preço antigo e o atual');
    assert(blocos[0].evidencia.indexOf('same-dynamic-root')>=0
      &&blocos[0].evidencia.indexOf('reading-adjacent')>=0,
      'o irmão de preço entrou sem os sinais que o autorizam');
    assert(blocos[0].membros.indexOf('produto')<0,'o nome do produto foi engolido pelo preço');
  });

  test('comp: CTA + pill vira cta-block; CTA textual é unitário',()=>{
    const r=comps([
      shape('pill',80,300,300,70,{locked:false,shapeKind:'ellipse'}),
      text('cta',100,315,260,40,'PEÇA AGORA',{fontSize:30,name:'CTA'}),
      text('cta2',80,600,260,40,'COMPRE JÁ',{fontSize:30,name:'Botao'})
    ],{w:700,h:900});
    const lista=gComponentsByType(r.C,'cta-block');
    assert(lista.length===2,'esperava dois CTA, veio '+lista.length);
    const comPill=lista.find(c=>c.membros.indexOf('pill')>=0);
    assert(comPill&&comPill.membros.join(',')==='cta,pill','o CTA não abraçou a pill');
    const sozinho=lista.find(c=>c.membros.join(',')==='cta2');
    assert(sozinho,'o CTA textual sozinho não virou componente unitário');
    assert(sozinho.rootId==='cta2','a raiz do CTA unitário está errada');
  });

  test('comp: título + apoio na mesma cadeia dinâmica viram offer-block',()=>{
    const r=comps([
      text('titulo',90,100,420,70,'{{titulo}}',{fontSize:52,name:'Titulo'}),
      text('apoio',90,190,420,50,'Subtítulo de apoio',{fontSize:28,name:'Descrição'})
    ],{w:700,h:600});
    const o=umDe(r,'offer-block');
    assert(o,'a cadeia dinâmica não virou offer-block');
    assert(o.membros.join(',')==='apoio,titulo','os membros do offer-block saíram errados');
    assert(o.evidencia.indexOf('same-dynamic-root')>=0
      &&o.evidencia.indexOf('same-reading-branch')>=0,'o offer-block nasceu sem evidência');
    assert(o.nivel===1,'offer-block deveria ser nível 1');
  });

  test('comp: título perto do preço SEM relação estrutural não vira offer-block',()=>{
    // Nenhum campo na arte: sem cadeia dinâmica, é só proximidade — e proximidade não agrupa.
    const r=comps([
      text('titulo',90,100,420,70,'OFERTA DA SEMANA',{fontSize:52,name:'Titulo'}),
      text('preco',90,190,300,60,'R$ 29,90',{fontSize:44,name:'Preço'})
    ],{w:700,h:600});
    assert(gComponentsByType(r.C,'offer-block').length===0,
      'proximidade sozinha criou offer-block — é o erro que esta fase existe para evitar');
    const p=umDe(r,'price-block');
    assert(p&&p.membros.join(',')==='preco','o preço deveria continuar sozinho');
  });

  test('comp: logo colado no preço NUNCA entra no bloco comercial',()=>{
    const monta=(agrupado)=>[
      shape('placa',70,80,360,110,{locked:false,parentId:agrupado?'g':undefined}),
      text('preco',95,100,310,65,'{{preco}}',{fontSize:40,name:'Preço',parentId:agrupado?'g':undefined}),
      Object.assign({id:'logo',name:'Logo da marca',type:'image',x:440,y:80,w:120,h:110,
        visible:true,opacity:100},agrupado?{parentId:'g'}:{}),
      {id:'g',name:'Grupo',type:'group',x:70,y:80,w:490,h:110,visible:true,opacity:100}
    ];
    [false,true].forEach(agrupado=>{
      const r=comps(monta(agrupado),{w:700,h:600});
      r.C.forEach(c=>assert(c.membros.indexOf('logo')<0||c.tipo==='generic-cluster',
        'o logo entrou num '+c.tipo+(agrupado?' (via grupo autoral)':'')));
      const p=umDe(r,'price-block');
      assert(p&&p.membros.indexOf('logo')<0,
        'o logo entrou no price-block'+(agrupado?' porque o PSD agrupou junto':''));
    });
  });

  test('comp: containment sozinho NÃO cria image-subject-block',()=>{
    /* A Fase 2.5 provou que contenção não implica dependência. A mesma disciplina aqui: texto
       sobre a foto é intenção visual, não acoplamento — a foto não empurra o texto. */
    const r=comps([
      {id:'foto',name:'Foto produto',type:'image',x:0,y:0,w:700,h:400,visible:true,opacity:100},
      text('label',60,150,300,60,'SABOR NOVO',{fontSize:40})
    ],{w:700,h:600});
    assert(gComponentsByType(r.C,'image-subject-block').length===0,
      'containment virou acoplamento — exatamente o que a Fase 2.5 proibiu');
    // Com um juntor de verdade (grupo autoral), aí sim é bloco.
    const r2=comps([
      {id:'g',name:'Grupo foto',type:'group',x:0,y:0,w:700,h:400,visible:true,opacity:100},
      {id:'foto',name:'Foto produto',type:'image',x:0,y:0,w:700,h:400,visible:true,opacity:100,parentId:'g'},
      text('badge',60,150,300,60,'NOVO',{fontSize:40,parentId:'g'})
    ],{w:700,h:600});
    const b=umDe(r2,'image-subject-block');
    assert(b&&b.membros.join(',')==='badge,foto','o grupo autoral não orientou o bloco da foto');
    assert(b.confianca==='certa','grupo declarado pelo designer não é inferência');
  });

  test('comp: grupo autoral orienta o componente e vale CERTA',()=>{
    // Duas peças de preço que o grafo não ligaria sozinho — quem as junta é a pasta do designer.
    const r=comps([
      {id:'g',name:'Bloco de preço',type:'group',x:70,y:80,w:900,h:120,visible:true,opacity:100},
      text('preco',95,100,200,65,'{{preco}}',{fontSize:40,name:'Preço',parentId:'g'}),
      text('centavos',760,100,180,65,'{{centavos}}',{fontSize:40,name:'Valor',parentId:'g'})
    ],{w:1080,h:1080});
    const p=umDe(r,'price-block');
    assert(p&&p.membros.join(',')==='centavos,preco','o grupo autoral não orientou o componente');
    assert(p.confianca==='certa','grupo autoral tem que valer certa');
    assert(p.evidencia.indexOf('grupo-autoral')>=0,'a evidência do grupo se perdeu');
  });

  test('comp: price-block aninha dentro de offer-block',()=>{
    const r=comps([
      text('produto',90,420,900,200,'{{produto}}',{fontSize:96,name:'Produto'}),
      text('de',90,700,340,60,'{{de}}',{fontSize:38,textBox:'point',name:'De por'}),
      text('por',470,672,400,110,'{{por}}',{fontSize:84,textBox:'point',name:'Preço'})
    ],{w:1080,h:1920});
    const o=umDe(r,'offer-block'), p=umDe(r,'price-block');
    assert(o&&p,'faltou um dos dois componentes');
    assert(o.filhos.indexOf(p.id)>=0,'o price-block não virou filho do offer-block');
    assert(o.membrosDiretos.join(',')==='produto','os membros diretos do offer-block estão errados');
    assert(p.membros.every(m=>o.membros.indexOf(m)>=0),'a hierarquia não é consistente');
    assert(o.nivel>p.nivel,'o container não está acima do contido');
  });

  test('comp: um membro não pertence a dois componentes fortes do mesmo nível',()=>{
    const r=comps([
      text('produto',90,420,900,200,'{{produto}}',{fontSize:96,name:'Produto'}),
      text('de',90,700,340,60,'{{de}}',{fontSize:38,textBox:'point',name:'De por'}),
      text('por',470,672,400,110,'{{por}}',{fontSize:84,textBox:'point',name:'Preço'}),
      shape('placa',70,860,460,120,{locked:false}),
      text('cupom',120,890,400,60,'{{cupom}}',{fontSize:48,textBox:'point',name:'Cupom'}),
      text('cta',90,1100,300,60,'PEÇA AGORA',{fontSize:40,name:'CTA'}),
      text('legal',90,1780,900,90,'Consulte o regulamento completo',{fontSize:20})
    ],{w:1080,h:1920});
    const dono=new Map();
    r.C.filter(c=>c.nivel===0).forEach(c=>c.membros.forEach(m=>{
      assert(!dono.has(m),'"'+m+'" ficou em dois componentes de nível 0: '
        +dono.get(m)+' e '+c.tipo);
      dono.set(m,c.tipo);
    }));
    // E nenhum componente duplicado com o mesmo conjunto de membros.
    const chaves=r.C.map(c=>c.membros.join('+'));
    assert(new Set(chaves).size===chaves.length,'apareceram componentes duplicados');
    assert(gComponentsByType(r.C,'legal-block').length===0,
      'um texto legal sozinho não deveria virar bloco');
  });

  test('comp: IDs são determinísticos e independem da ordem das camadas',()=>{
    const base=[
      shape('placa',70,80,360,110,{locked:false}),
      text('preco',95,100,310,65,'{{preco}}',{fontSize:40,name:'Preço'}),
      text('solto',700,700,200,50,'RODAPÉ',{fontSize:20})
    ];
    const a=comps(base,{w:1080,h:1080}), b=comps(base,{w:1080,h:1080});
    const c=comps([base[2],base[0],base[1]],{w:1080,h:1080});   // z-order de placa/preço intacto
    assert(JSON.stringify(a.C)===JSON.stringify(b.C),'duas compilações iguais divergiram');
    assert(umDe(a,'price-block').id===umDe(c,'price-block').id,
      'a ordem incidental da lista virou parte do ID do componente');
    assert(/^k:[0-9a-f]{8}$/.test(umDe(a,'price-block').id),'o ID não tem forma estável');
    assert(gComponentById(a.C,umDe(a,'price-block').id),'gComponentById não acha o próprio ID');
  });

  test('comp: dynamicRoot do componente bate com o Composition Graph',()=>{
    const r=comps([
      text('produto',90,420,900,200,'{{produto}}',{fontSize:96,name:'Produto'}),
      text('de',90,700,340,60,'{{de}}',{fontSize:38,textBox:'point',name:'De por'}),
      text('por',470,672,400,110,'{{por}}',{fontSize:84,textBox:'point',name:'Preço'})
    ],{w:1080,h:1920});
    const p=umDe(r,'price-block');
    assert(gComponentDynamicRoot(p)==='produto',
      'a raiz do componente não é a que o Graph aponta: '+gComponentDynamicRoot(p));
    // A conferência direta contra o Graph, membro a membro.
    p.membros.forEach(m=>{
      const g=gGraphDynamicRoot(r.G,m);
      const esperado=g?g.id:(gGrammarNode(r.g,m).campos.length?m:null);
      if(esperado) assert(p.dynamicRoots.indexOf(esperado)>=0,
        'a raiz de "'+m+'" segundo o Graph ficou de fora do componente');
    });
  });

  test('comp: duas raízes independentes não viram uma raiz falsa',()=>{
    const r=comps([
      {id:'g',name:'Bloco',type:'group',x:70,y:80,w:900,h:120,visible:true,opacity:100},
      text('preco',95,100,200,65,'{{precoA}}',{fontSize:40,name:'Preço',parentId:'g'}),
      text('outro',760,100,180,65,'{{precoB}}',{fontSize:40,name:'Valor',parentId:'g'})
    ],{w:1080,h:1080});
    const p=umDe(r,'price-block');
    assert(p&&p.membros.length===2,'o grupo autoral não formou o componente');
    assert(p.dynamicRoots.length===2,'esperava duas raízes, veio '+p.dynamicRoots.length);
    assert(p.dynamicRootId===null,'forçou uma raiz única onde existem duas independentes');
    assert(p.dinamico===true,'o componente com campos não foi marcado como dinâmico');
  });

  test('comp: bounds saem da geometria da Grammar, nos três recortes',()=>{
    const r=comps([
      shape('placa',70,80,360,110,{locked:false}),
      text('preco',95,100,310,65,'{{preco}}',{fontSize:40,name:'Preço'})
    ],{w:600,h:500});
    const p=umDe(r,'price-block');
    const b=gComponentBounds(p,r.g);
    assert(b.autorado.x===70&&b.autorado.y===80,'o bounds autorado não cobre a placa');
    assert(b.autorado.w===360&&b.autorado.h===110,'o bounds autorado saiu errado');
    // A placa é decorativa: o recorte VISUAL é só a tinta que carrega informação.
    assert(b.visual.x===95&&b.visual.w===310,'o bounds visual não descontou a decoração');
    assert(b.seguro.x===70,'sem zona segura, o recorte seguro cai na caixa desenhada');
    assert(JSON.stringify(b)===JSON.stringify(p.bounds),'o bounds gravado difere do recalculado');
  });

  test('comp: 300 camadas continuam compiláveis',()=>{
    const L=arteGrande(300), cv={w:1080,h:4000};
    const marca=(fn)=>{const t0=performance.now();const r=fn();return {ms:performance.now()-t0,r};};
    const g0=gCompileLayoutGrammar(L,cv);
    gCompileLayoutComponents(g0,gCompileCompositionGraph(g0));   // aquece o JIT
    const g=marca(()=>gCompileLayoutGrammar(L,cv));
    const G=marca(()=>gCompileCompositionGraph(g.r));
    const C=marca(()=>gCompileLayoutComponents(g.r,G.r));
    assert(C.r.length>0,'nenhum componente numa arte de 300 camadas');
    /* Guarda de EXPLOSÃO: o compilador percorre relações e sementes, não pares de camadas. Se
       alguém puser uma varredura quadrática aqui, este número dispara. */
    assert(C.ms<Math.max(40,(g.ms+G.ms)*2),'os Components passaram a dominar o custo: '
      +g.ms.toFixed(1)+'+'+G.ms.toFixed(1)+' → '+C.ms.toFixed(1)+'ms');
    assert(g.ms+G.ms+C.ms<600,'a pilha inteira levou '+(g.ms+G.ms+C.ms).toFixed(1)+'ms');
  });

  test('comp: não muta Grammar, Graph nem camadas',()=>{
    const layers=[
      shape('placa',70,80,360,110,{locked:false}),
      text('preco',95,100,310,65,'{{preco}}',{fontSize:40,name:'Preço'}),
      text('cta',80,340,260,48,'PEÇA AGORA',{fontSize:30,name:'CTA'})
    ];
    const antesL=JSON.stringify(layers);
    const g=gCompileLayoutGrammar(layers,{w:1080,h:1080});
    const G=gCompileCompositionGraph(g);
    const antesG=JSON.stringify(g), antesGrafo=JSON.stringify(G.edges)+JSON.stringify(G.clusters);
    const C=gCompileLayoutComponents(g,G);
    assert(JSON.stringify(layers)===antesL,'os Components MUTARAM as camadas');
    assert(JSON.stringify(g)===antesG,'os Components MUTARAM a Grammar');
    assert(JSON.stringify(G.edges)+JSON.stringify(G.clusters)===antesGrafo,
      'os Components MUTARAM o Graph');
    assert(C.every(c=>c.membros.every(m=>typeof m==='string')),
      'o componente guardou camada em vez de ID');
    assert(JSON.stringify(C).indexOf('{{preco}}')<0,'o componente copiou conteúdo de camada');
  });

  /* ══ ENDURECIMENTO DOS COMPONENTS (Fase 3.5) ═════════════════════════════════════════════
     Três riscos que a própria Fase 3 expôs, fechados antes de a camada ganhar autoridade:
     containment virando unidade semântica, precedência morando na ordem física do código, e
     componente unitário indistinguível de bloco composto. */

  test('hard: texto sobre foto — o Graph registra, os Components NÃO criam bloco',()=>{
    const layers=[
      {id:'foto',name:'Foto produto',type:'image',x:0,y:0,w:700,h:400,visible:true,opacity:100},
      text('label',60,150,300,60,'SABOR NOVO',{fontSize:40})
    ];
    const r=comps(layers,{w:700,h:600});
    // O Graph continua vendo a relação visual — ela é verdadeira como DESCRIÇÃO.
    assert(gGrammarRelations(r.g,'dentro-de','label').length===1,'o Graph perdeu a contenção');
    assert(r.G.clusters.some(c=>c.tipo==='contencao'),'o cluster de contenção sumiu do Graph');
    // Mas contenção não prova identidade de componente.
    assert(r.C.length===0,'containment virou componente: '+r.C.map(c=>c.tipo).join(','));
    assert(gComponentsByType(r.C,'generic-cluster').length===0,'nasceu generic-cluster de contenção');
    assert(gComponentsByType(r.C,'image-subject-block').length===0,'nasceu image-subject-block');
  });

  test('hard: generic-cluster exige um juntor verdadeiro entre os membros',()=>{
    // Com juntor de verdade (grupo autoral), o cluster vira componente — mas aí ele é
    // reconhecido pelo tipo específico, não pelo genérico.
    const r=comps([
      {id:'g',name:'Bloco',type:'group',x:70,y:80,w:400,h:200,visible:true,opacity:100},
      text('a',95,100,200,50,'APOIO UM',{fontSize:26,name:'Detalhe',parentId:'g'}),
      text('b',95,200,200,50,'APOIO DOIS',{fontSize:26,name:'Observação',parentId:'g'})
    ],{w:700,h:600});
    assert(r.C.length>0,'grupo autoral deixou de criar componente');
    assert(r.C[0].membros.join(',')==='a,b','o grupo autoral não juntou os membros');
    assert(r.C[0].confianca==='certa','grupo declarado pelo designer não é inferência');
  });

  test('hard: plate-of e dynamic-dependency continuam criando componente',()=>{
    const porPlaca=comps([
      shape('placa',70,80,360,110,{locked:false}),
      text('titulo',95,100,310,65,'CHAMADA',{fontSize:40,name:'Titulo'})
    ],{w:600,h:500});
    assert(umDe(porPlaca,'text-with-plate'),'plate-of deixou de criar componente');
    const porCadeia=comps([
      text('titulo',90,100,420,70,'{{titulo}}',{fontSize:52,name:'Titulo'}),
      text('apoio',90,190,420,50,'Subtítulo de apoio',{fontSize:28,name:'Descrição'})
    ],{w:700,h:600});
    assert(umDe(porCadeia,'offer-block'),'dynamic-dependency deixou de unir bloco coerente');
  });

  test('hard: G_COMP_PRECEDENCIA é quem decide o conflito, não a ordem do código',()=>{
    /* Um par placa+texto de preço é candidato aos DOIS tipos ao mesmo tempo. Quem leva é o que
       vem antes na constante — e a asserção é escrita contra a constante, não contra o
       resultado esperado, para que mudar a precedência quebre o teste em vez de passar calado. */
    const r=comps([
      shape('placa',70,80,360,110,{locked:false}),
      text('preco',95,100,310,65,'{{preco}}',{fontSize:40,name:'Preço'})
    ],{w:600,h:500});
    const vencedor=gComponentOfNode(r.C,'preco');
    const perdedor='text-with-plate';
    assert(G_COMP_PRECEDENCIA.indexOf(vencedor.tipo)<G_COMP_PRECEDENCIA.indexOf(perdedor),
      'o vencedor não é o de maior precedência declarada');
    assert(vencedor.tipo==='price-block','o price-block deveria vencer o text-with-plate');
    assert(gComponentsByType(r.C,perdedor).length===0,'o perdedor sobreviveu ao conflito');
    assert(G_COMP_PRECEDENCIA.indexOf('generic-cluster')===G_COMP_PRECEDENCIA.length-1,
      'o genérico tem que ser o último a reivindicar');
  });

  test('hard: ordem das camadas não muda os Components nem os IDs',()=>{
    /* O z-order de placa e preço é preservado nas permutações — o que muda é só a ordem em que
       os candidatos são gerados, que é exatamente o que não pode importar. */
    const placa=shape('placa',70,80,360,110,{locked:false});
    const preco=text('preco',95,100,310,65,'{{preco}}',{fontSize:40,name:'Preço'});
    const cta=text('cta',80,340,260,48,'PEÇA AGORA',{fontSize:30,name:'CTA'});
    const legal=text('legal',80,900,400,40,'Consulte o regulamento',{fontSize:18});
    const a=comps([placa,preco,cta,legal],{w:700,h:1000});
    const b=comps([legal,placa,preco,cta],{w:700,h:1000});
    const c=comps([cta,legal,placa,preco],{w:700,h:1000});
    const chave=(r)=>r.C.map(x=>x.tipo+':'+x.membros.join('+')+':'+x.id).sort().join('|');
    assert(chave(a)===chave(b),'mudar a ordem das camadas mudou os componentes');
    assert(chave(a)===chave(c),'mudar a ordem das camadas mudou os componentes');
    assert(a.C.map(x=>x.componentSignature).sort().join()===
           c.C.map(x=>x.componentSignature).sort().join(),'as assinaturas dependeram da ordem');
  });

  test('hard: CTA isolado é singleton; CTA + pill é grupo',()=>{
    const r=comps([
      shape('pill',80,300,300,70,{locked:false,shapeKind:'ellipse'}),
      text('cta',100,315,260,40,'PEÇA AGORA',{fontSize:30,name:'CTA'}),
      text('cta2',80,600,260,40,'COMPRE JÁ',{fontSize:30,name:'Botao'})
    ],{w:700,h:900});
    const lista=gComponentsByType(r.C,'cta-block');
    const sozinho=lista.find(c=>c.membros.join(',')==='cta2');
    const comPill=lista.find(c=>c.membros.indexOf('pill')>=0);
    assert(sozinho&&sozinho.singleton===true,'o CTA isolado não foi marcado como singleton');
    assert(comPill&&comPill.singleton===false,'o CTA com pill foi marcado como singleton');
    /* A distinção que a fase seguinte precisa: "é semanticamente um CTA" não implica "é um
       bloco composto que deve escalar e mover como grupo". */
    assert(sozinho.tipo===comPill.tipo,'os dois são CTA — o que muda é a cardinalidade');
    assert(sozinho.componentSignature!==comPill.componentSignature,
      'singleton e grupo não podem ter a mesma assinatura');
    // Preço solto também é unitário, e também precisa dizer isso.
    const p=comps([text('so',90,100,300,60,'{{preco}}',{fontSize:44,name:'Preço'})],{w:700,h:600});
    assert(umDe(p,'price-block').singleton===true,'o preço solto não foi marcado como singleton');
  });

  test('hard: preços em placas diferentes não viram um bloco só',()=>{
    /* A guarda contra "duas ofertas compartilhando a mesma raiz por acidente". O sinal é
       ESTRUTURAL e já existia: clusters diferentes (duas placas) = duas ofertas. Sem
       heurística de distância. */
    const layers=[
      text('titulo',90,60,900,80,'{{titulo}}',{fontSize:70,name:'Titulo'}),
      shape('placaA',90,200,380,120,{locked:false}),
      text('precoA',120,230,320,60,'{{precoA}}',{fontSize:44,name:'Preço'}),
      shape('placaB',90,340,380,120,{locked:false}),
      text('precoB',120,370,320,60,'{{precoB}}',{fontSize:44,name:'Valor'})
    ];
    const r=comps(layers,{w:1080,h:1080});
    const blocos=gComponentsByType(r.C,'price-block');
    assert(blocos.length===2,'as duas ofertas viraram '+blocos.length+' bloco(s)');
    blocos.forEach(b=>assert(b.membros.length===2,'um bloco engoliu a outra oferta: '+b.membros.join(',')));
    // E o irmão de preço do corpus continua unido, que é o caso que a guarda não pode quebrar.
    const corpus=comps([
      text('produto',90,420,900,200,'{{produto}}',{fontSize:96,name:'Produto'}),
      text('de',90,700,340,60,'{{de}}',{fontSize:38,textBox:'point',name:'De por'}),
      text('por',470,672,400,110,'{{por}}',{fontSize:84,textBox:'point',name:'Preço'})
    ],{w:1080,h:1920});
    assert(gComponentsByType(corpus.C,'price-block')[0].membros.join(',')==='de,por',
      'a guarda quebrou o par de preço do corpus');
  });

  test('hard: componentSignature é determinística e ignora deslocamento',()=>{
    const monta=(yCta)=>[
      text('titulo',90,100,420,70,'{{titulo}}',{fontSize:52,name:'Titulo'}),
      text('apoio',90,190,420,50,'Subtítulo de apoio',{fontSize:28,name:'Descrição'}),
      shape('pill',90,yCta,300,70,{locked:false,shapeKind:'ellipse'}),
      text('cta',110,yCta+15,260,40,'PEÇA AGORA',{fontSize:30,name:'CTA'})
    ];
    const a=comps(monta(400),{w:700,h:900}), b=comps(monta(420),{w:700,h:900});
    const assinaturas=(r)=>r.C.map(c=>c.componentSignature).sort().join('|');
    assert(assinaturas(a)===assinaturas(comps(monta(400),{w:700,h:900})),
      'a assinatura não é determinística');
    assert(assinaturas(a)===assinaturas(b),'deslocar 20px mudou a assinatura do componente');
    assert(JSON.stringify(a.C).indexOf('{{titulo}}')<0,'a assinatura carregou conteúdo');
    // Já mudar a composição — tirar a pill do CTA — tem que mudar.
    const semPill=comps(monta(400).filter(l=>l.id!=='pill'),{w:700,h:900});
    assert(assinaturas(a)!==assinaturas(semPill),
      'separar o CTA da pill não mudou a assinatura');
  });

  test('hard: diff identifica componente adicionado, removido e alterado',()=>{
    const comPlaca=[
      shape('placa',70,80,360,110,{locked:false}),
      text('preco',95,100,310,65,'{{preco}}',{fontSize:40,name:'Preço'}),
      text('cta',80,340,260,48,'PEÇA AGORA',{fontSize:30,name:'CTA'})
    ];
    const semPlaca=comPlaca.filter(l=>l.id!=='placa');
    const semCta=comPlaca.filter(l=>l.id!=='cta');
    const A=comps(comPlaca,{w:700,h:600}).C;
    const B=comps(semPlaca,{w:700,h:600}).C;
    const C=comps(semCta,{w:700,h:600}).C;
    assert(gCompareLayoutComponents(A,A).sameComponents===true,'o diff acusou mudança onde não houve');
    const d1=gCompareLayoutComponents(A,B);
    assert(d1.sameComponents===false,'perder a placa não apareceu no diff');
    assert(d1.changed.some(x=>x.tipo==='price-block'),'o price-block alterado não foi reportado');
    assert(d1.changed[0].de.length===2&&d1.changed[0].para.length===1,
      'o diff não mostra o que entrou e o que saiu do componente');
    const d2=gCompareLayoutComponents(A,C);
    assert(d2.removed.some(x=>x.tipo==='cta-block'),'o CTA removido não apareceu no diff');
    assert(gCompareLayoutComponents(C,A).added.some(x=>x.tipo==='cta-block'),
      'o CTA adicionado não apareceu no diff invertido');
  });

  test('hard: 300 camadas seguem compiláveis depois da refatoração',()=>{
    const L=arteGrande(300), cv={w:1080,h:4000};
    const marca=(fn)=>{const t0=performance.now();const r=fn();return {ms:performance.now()-t0,r};};
    const g0=gCompileLayoutGrammar(L,cv);
    gCompileLayoutComponents(g0,gCompileCompositionGraph(g0));   // aquece o JIT
    const g=marca(()=>gCompileLayoutGrammar(L,cv));
    const G=marca(()=>gCompileCompositionGraph(g.r));
    const C=marca(()=>gCompileLayoutComponents(g.r,G.r));
    assert(C.r.length>0,'nenhum componente numa arte de 300 camadas');
    assert(C.r.every(c=>c.componentSignature&&typeof c.singleton==='boolean'),
      'algum componente saiu sem assinatura ou sem cardinalidade');
    /* A refatoração de precedência ordena candidatos — O(k log k) sobre CANDIDATOS, não sobre
       pares de camadas. Se alguém trouxer varredura quadrática, este número dispara. */
    assert(C.ms<Math.max(40,(g.ms+G.ms)*2),'os Components passaram a dominar o custo: '
      +g.ms.toFixed(1)+'+'+G.ms.toFixed(1)+' → '+C.ms.toFixed(1)+'ms');
  });

  /* ══ ELASTICITY MODEL + IMPACT ZONES (Fase 4) ════════════════════════════════════════════
     Elasticidade descreve a LIBERDADE permitida, não a ação tomada. Todo nível aqui deve ser
     rastreável a um degrau que o solver realmente tem — onde a regra existente e a intuição
     divergirem, quem vence é a regra, e o caso registra isso. */
  const elast=(layers,canvas)=>{
    const g=gCompileLayoutGrammar(layers,canvas||{w:1080,h:1080});
    const G=gCompileCompositionGraph(g);
    const C=gCompileLayoutComponents(g,G);
    const E=gCompileLayerElasticity(g,G);
    return {g,G,C,E,CE:gCompileComponentsElasticity(C,g,G,E),
            Z:gCompileAllImpactZones(G,C)};
  };
  const nivel=(v)=>gElasticityLevel(v);
  const arteBase=()=>[
    text('titulo',90,60,900,90,'{{titulo}}',{fontSize:72,name:'Titulo'}),
    text('produto',90,200,900,120,'{{produto}}',{fontSize:56,name:'Produto'}),
    shape('placa',90,360,400,120,{locked:false,name:'Placa'}),
    text('preco',120,390,340,60,'{{preco}}',{fontSize:52,name:'Preço'}),
    text('apoio',90,520,600,50,'Ingredientes selecionados',{fontSize:24,name:'Descrição',lineHeight:1.9}),
    shape('pill',90,620,300,70,{locked:false,shapeKind:'ellipse',name:'Pill'}),
    text('cta',110,635,260,40,'PEÇA AGORA',{fontSize:30,name:'CTA'}),
    {id:'logo',name:'Logo da marca',type:'image',x:820,y:60,w:180,h:90,visible:true,opacity:100},
    shape('enfeite',700,900,120,120,{locked:false,name:'Forma decorativa'}),
    text('legal',90,1000,900,40,'Consulte o regulamento completo',{fontSize:18})
  ];

  test('elast: protegida é rígida em todas as dimensões',()=>{
    const r=elast(arteBase());
    const e=r.E.get('logo');
    G_ELASTICITY_DIMENSOES.forEach(d=>assert(e[d]==='none',
      'o logo ganhou liberdade em "'+d+'": '+e[d]));
    assert(e.rigidity==='high','o logo deveria ter custo máximo de descaracterização');
    assert(e.motivos.indexOf('protegida')>=0,'a trava não registrou o motivo');
  });

  test('elast: decoração é a mais livre da arte',()=>{
    const r=elast(arteBase());
    const d=r.E.get('enfeite'), t=r.E.get('titulo');
    assert(d.moveX==='high'&&d.moveY==='high','a decoração não pode mover livremente');
    assert(d.scale==='high','a decoração não pode escalar livremente');
    assert(nivel(d.rigidity)<nivel(t.rigidity),
      'descaracterizar a decoração não pode custar o mesmo que o título');
    assert(d.rigidity==='low','a decoração deveria ter custo baixo');
  });

  test('elast: o preço preserva a tipografia mais que o apoio',()=>{
    const r=elast(arteBase());
    const p=r.E.get('preco'), a=r.E.get('apoio');
    assert(nivel(p.fontShrink)<nivel(a.fontShrink),
      'o preço cedeu tipografia tanto quanto o apoio');
    assert(nivel(p.scale)<nivel(a.scale),'o preço escala tanto quanto o apoio');
    assert(nivel(p.rigidity)>nivel(a.rigidity),'o preço não custa mais caro que o apoio');
    assert(p.motivos.indexOf('preco-so-cede-por-si')>=0,'a regra de 19/08 não foi registrada');
  });

  test('elast: o título quebra mais linha que o preço',()=>{
    const r=elast(arteBase());
    assert(nivel(r.E.get('titulo').wrap)>nivel(r.E.get('preco').wrap),
      'o título não quebra mais que o preço');
    // A régua é o teto de linhas que já existe — não uma opinião nova.
    assert(gLayoutRoleMaxLines('titulo')>gLayoutRoleMaxLines('preco'),
      'o nível deixou de acompanhar gLayoutRoleMaxLines');
    assert(r.E.get('legal').wrap==='high','o regulamento deveria poder correr em linhas');
  });

  test('elast: o legal cede fonte, mas com o piso de legibilidade registrado',()=>{
    const r=elast(arteBase());
    const l=r.E.get('legal');
    assert(l.motivos.indexOf('piso-de-legibilidade')>=0,
      'o piso de legibilidade não aparece como motivo');
    assert(l.fontShrink!=='high','sem o piso, o regulamento viraria 8px numa arte de 1080');
    assert(nivel(l.fontShrink)>0,'o regulamento precisa poder ceder alguma coisa');
    assert(l.rigidity==='low','descaracterizar o rodapé é o mais barato da arte');
  });

  test('elast: o preço dinâmico NÃO se move — a regra do solver vence a intuição',()=>{
    /* Seria natural marcar o preço como `moveY: medium`. Mas desde 03/09 o bloco de preço
       dinâmico não é filho de corrente (`_gLayoutBlocoPrecoFixo`): ele desloca os outros e não
       é deslocado. Descrever `medium` seria descrever um motor que não existe. */
    const r=elast(arteBase());
    assert(r.E.get('preco').moveY==='none','a elasticidade discorda do solver sobre o preço');
    assert(r.E.get('preco').motivos.indexOf('bloco-de-preco-nao-sai-do-lugar')>=0,
      'a divergência não foi registrada');
    const out=solve(arteBase(),{titulo:'TEXTO ENORME QUE CRESCE MUITO ALEM DA CAIXA DESENHADA',
      produto:'PRODUTO',preco:'R$ 9,99'},{w:1080,h:1080});
    assert(!by(out,'preco')._anchorAuto,'o solver encadeou o preço: a descrição está errada');
    // Com âncora MANUAL ele volta a mover — declaração do designer vence heurística.
    const comAncora=arteBase();
    comAncora.find(l=>l.id==='preco').relativeAnchor={type:'top-to-bottom',layerId:'produto',gap:20};
    assert(elast(comAncora).E.get('preco').moveY!=='none',
      'a âncora manual não devolveu o movimento ao preço');
  });

  test('elast: rigidez não é o inverso das permissões',()=>{
    const r=elast(arteBase());
    const t=r.E.get('titulo');
    assert(t.rigidity==='high','o título deveria custar caro de descaracterizar');
    assert(t.moveY==='high','rigidez alta não pode travar o reposicionamento');
    /* É a distinção do modelo: "preserve a identidade, mas reposicionar é aceitável". Se
       rigidez fosse o inverso das permissões, este caso seria impossível. */
    assert(nivel(t.rigidity)===3&&nivel(t.moveY)===3,'a dupla alta/alta se perdeu');
  });

  test('elast: ancestral travado restringe o filho, como no solver',()=>{
    const monta=(trava)=>[
      text('titulo',90,60,900,80,'{{titulo}}',{fontSize:60}),
      Object.assign({id:'g',name:'Grupo',type:'group',x:90,y:180,w:400,h:100,
        visible:true,opacity:100},trava?{locked:true}:{}),
      text('filho',90,190,400,60,'TEXTO FIXO',{fontSize:30,parentId:'g'})
    ];
    assert(elast(monta(false)).E.get('filho').moveY==='high','sem trava o filho deveria mover');
    const preso=elast(monta(true)).E.get('filho');
    assert(preso.moveY==='none','o grupo travado não restringiu o filho');
    assert(preso.motivos.indexOf('ancestral-travado')>=0,'a herança não registrou o motivo');
    // E o solver concorda — é a mesma fonte única (`gLayoutPodeAcompanhar`).
    assert(!by(solve(monta(true),{titulo:'TEXTO ENORME QUE CRESCE ALEM DA CAIXA'},{w:1080,h:1080}),
      'filho')._anchorAuto,'o solver encadeou dentro de grupo travado');
  });

  test('elast: price-block preserva junto; CTA singleton não vira grupo',()=>{
    const r=elast(arteBase());
    const pb=r.CE.get(gComponentsByType(r.C,'price-block')[0].id);
    assert(pb.preserveTogether==='high','o price-block não preserva os membros juntos');
    assert(pb.resizeContainer!=='none','o price-block perdeu a placa que sabe crescer');
    assert(pb.rigidity==='high','o bloco que contém o preço tem que custar caro');
    const cta=gComponentsByType(r.C,'cta-block').find(c=>!c.singleton);
    assert(cta,'faltou o CTA com pill');
    const ce=r.CE.get(cta.id);
    assert(ce.singleton===false&&ce.preserveTogether==='high','o CTA+pill não virou grupo');
    // Agora o unitário: mesma semântica, nenhuma promessa de bloco composto.
    const so=elast([text('so',90,100,300,60,'PEÇA AGORA',{fontSize:40,name:'CTA'})],{w:700,h:600});
    const u=so.CE.get(gComponentsByType(so.C,'cta-block')[0].id);
    assert(u.singleton===true,'o CTA isolado não foi marcado no modelo de elasticidade');
    assert(u.preserveTogether==='none','um membro só não tem o que preservar junto');
  });

  test('elast: componente nunca torna membro proibido mais livre',()=>{
    /* Um offer-block com um logo dentro (o PSD agrupou). O perfil do offer-block permite
       `moveY: high`; o logo proíbe. A herança é `min` — o componente não pode libertá-lo. */
    const layers=[
      text('titulo',90,60,600,80,'{{titulo}}',{fontSize:60,name:'Titulo'}),
      text('produto',90,170,600,70,'{{produto}}',{fontSize:44,name:'Produto'}),
      {id:'logo',name:'Logo',type:'image',x:90,y:260,w:200,h:80,visible:true,opacity:100}
    ];
    const r=elast(layers,{w:1080,h:1080});
    r.C.forEach(c=>{
      const ce=r.CE.get(c.id);
      c.membros.forEach(m=>{
        const le=r.E.get(m);
        G_ELASTICITY_DIMENSOES.forEach(d=>{
          if(d==='resizeContainer') return;            // capacidade do contêiner, agrega por max
          assert(nivel(ce[d])<=nivel(le[d]),
            c.tipo+' liberou "'+d+'" além do que "'+m+'" permite ('+ce[d]+' > '+le[d]+')');
        });
      });
    });
  });

  test('elast: generic-cluster não adiciona liberdade por tipo',()=>{
    assert(JSON.stringify(G_COMP_ELASTICIDADE['generic-cluster'])==='{}',
      'o genérico ganhou perfil de elasticidade');
    // Sem perfil, a elasticidade do bloco é exatamente o mínimo dos membros.
    const r=elast(arteBase());
    r.C.filter(c=>c.tipo==='generic-cluster').forEach(c=>{
      const ce=r.CE.get(c.id);
      assert(ce.preserveTogether==='low','o genérico prometeu preservar junto');
    });
  });

  test('elast: é determinística',()=>{
    const a=elast(arteBase()), b=elast(arteBase());
    const chave=(r)=>JSON.stringify([...r.E].sort())+JSON.stringify([...r.CE].sort());
    assert(chave(a)===chave(b),'a elasticidade não é determinística');
    assert(gElasticityMin('high','low')==='low'&&gElasticityMax('none','medium')==='medium',
      'os comparadores centrais estão errados');
    assert(gElasticityLevel('nada-disso')===0,'nível desconhecido tem que cair no piso');
  });

  test('zona: L0 é só a camada do campo; L1 é o componente dela',()=>{
    const r=elast(arteBase());
    const z=r.Z.get('preco');
    assert(z.levels[0].join(',')==='preco','o nível 0 não é só a camada alterada');
    assert(z.levels[1].indexOf('placa')>=0,'o nível 1 não trouxe o componente do preço');
    assert(z.componentes.length>0,'a zona não registrou o componente envolvido');
    assert(gDescribeImpactZone(z).indexOf('L1: placa')>=0,'o diagnóstico não é legível');
  });

  test('zona: dependente entra downstream; a direção é respeitada',()=>{
    const r=elast(arteBase());
    const zTitulo=r.Z.get('titulo'), zProduto=r.Z.get('produto');
    assert(zTitulo.levels[2].indexOf('produto')>=0,'o produto não entrou downstream do título');
    /* A DIREÇÃO é o ponto: mudar o produto NÃO autoriza recompor o título que o empurra. Ele
       aparece como `upstream`, informação separada, nunca somado aos níveis. */
    assert(zProduto.levels[2].indexOf('titulo')<0,'o título entrou como impacto do produto');
    assert(zProduto.upstream.indexOf('titulo')>=0,'o upstream do produto não foi registrado');
    assert(zTitulo.upstream.length===0,'o título não deveria ter ninguém acima');
  });

  test('zona: alinhamento e contenção NÃO transmitem impacto',()=>{
    const layers=[
      text('titulo',120,100,400,60,'{{titulo}}',{fontSize:46,name:'Titulo'}),
      text('longe',120,900,400,40,'RODAPÉ ALINHADO',{fontSize:20}),       // só alinhado
      {id:'foto',name:'Foto',type:'image',x:600,y:100,w:400,h:300,visible:true,opacity:100},
      text('sobre',620,180,300,60,'SOBRE A FOTO',{fontSize:30})           // só contido
    ];
    const r=elast(layers,{w:1080,h:1080});
    const z=r.Z.get('titulo');
    const ate3=[].concat(z.levels[0],z.levels[1],z.levels[2],z.levels[3]);
    assert(ate3.indexOf('longe')<0,'alinhamento forte virou impacto');
    assert(ate3.indexOf('sobre')<0,'contenção virou impacto');
    assert(z.levels[4].indexOf('longe')>=0&&z.levels[4].indexOf('sobre')>=0,
      'os dois deveriam cair no fallback global');
    assert(z.arestas.every(a=>G_IMPACT_ARESTAS.indexOf(a)>=0),
      'a zona usou aresta que não transmite impacto');
  });

  test('zona: duas colunas independentes não se invadem',()=>{
    const layers=[
      text('e1',80,100,300,60,'{{esq}}',{fontSize:40,name:'Titulo'}),
      text('e2',80,200,300,60,'APOIO ESQ',{fontSize:30}),
      text('d1',600,100,300,60,'{{dir}}',{fontSize:40,name:'Titulo'}),
      text('d2',600,200,300,60,'APOIO DIR',{fontSize:30})
    ];
    const r=elast(layers,{w:1080,h:600});
    const ze=r.Z.get('e1'), zd=r.Z.get('d1');
    const perto=(z)=>[].concat(z.levels[1],z.levels[2],z.levels[3]);
    assert(perto(ze).indexOf('e2')>=0,'a própria coluna não entrou na zona');
    assert(perto(ze).indexOf('d1')<0&&perto(ze).indexOf('d2')<0,
      'a zona da esquerda invadiu a coluna da direita');
    assert(perto(zd).indexOf('e1')<0,'a zona da direita invadiu a esquerda');
    assert(ze.impactSignature!==zd.impactSignature,'duas zonas distintas com a mesma assinatura');
  });

  test('zona: múltiplas raízes geram zonas independentes',()=>{
    const layers=[
      text('a',80,100,300,60,'{{campoA}}',{fontSize:40,name:'Titulo'}),
      text('b',600,100,300,60,'{{campoB}}',{fontSize:40,name:'Titulo'})
    ];
    const r=elast(layers,{w:1080,h:600});
    assert(r.Z.size===2,'esperava uma zona por campo, veio '+r.Z.size);
    assert(r.Z.get('a').levels[0].join()==='a'&&r.Z.get('b').levels[0].join()==='b',
      'as raízes se misturaram');
    const perto=(z)=>[].concat(z.levels[1],z.levels[2],z.levels[3]);
    assert(perto(r.Z.get('a')).indexOf('b')<0,'as duas raízes foram fundidas cedo demais');
  });

  test('zona: cadeia longa propaga deterministicamente e ciclo não laça',()=>{
    const cadeia=[text('raiz',90,60,600,60,'{{raiz}}',{fontSize:50,name:'Titulo'})];
    for(let i=1;i<=6;i++) cadeia.push(text('n'+i,90,60+i*80,600,60,'FIXO '+i,{fontSize:40}));
    const a=elast(cadeia,{w:1080,h:1080}), b=elast(cadeia,{w:1080,h:1080});
    const z=a.Z.get('raiz');
    assert(z.levels[2].length===6,'a cadeia não propagou inteira: '+z.levels[2].length);
    assert(z.impactSignature===b.Z.get('raiz').impactSignature,'a zona não é determinística');
    // Ciclo autoral: se laçar, o teste nem termina.
    const ciclo=[
      text('x',90,100,300,50,'{{x}}',{fontSize:34,
        relativeAnchor:{type:'top-to-bottom',layerId:'y',gap:10}}),
      text('y',90,165,300,50,'FIXO',{fontSize:34,
        relativeAnchor:{type:'top-to-bottom',layerId:'x',gap:10}})
    ];
    const zc=elast(ciclo,{w:700,h:600}).Z.get('x');
    assert(zc&&zc.levels[0].join()==='x','a zona do ciclo não foi compilada');
  });

  test('zona: o nível 4 é o resto, sem duplicar ninguém',()=>{
    const r=elast(arteBase());
    r.Z.forEach(z=>{
      const todos=[].concat(z.levels[0],z.levels[1],z.levels[2],z.levels[3],z.levels[4]);
      assert(new Set(todos).size===todos.length,'uma camada apareceu em dois níveis');
      assert(new Set(todos).size===r.g.nodes.length,
        'a zona não cobre a composição inteira: '+todos.length+' de '+r.g.nodes.length);
    });
  });

  test('zona: deslocar sem mudar dependência mantém a impactSignature',()=>{
    const monta=(y)=>[
      text('titulo',90,60,900,90,'{{titulo}}',{fontSize:72,name:'Titulo'}),
      text('produto',90,y,900,100,'{{produto}}',{fontSize:56,name:'Produto'})
    ];
    const a=elast(monta(180),{w:1080,h:1080}), b=elast(monta(195),{w:1080,h:1080});
    assert(a.Z.get('titulo').impactSignature===b.Z.get('titulo').impactSignature,
      'deslocar 15px sem mudar dependência mudou a zona');
    // Já quebrar a dependência (longe demais para a régua) tem que mudar.
    const longe=elast(monta(900),{w:1080,h:1080});
    assert(a.Z.get('titulo').impactSignature!==longe.Z.get('titulo').impactSignature,
      'romper a cadeia não mudou a assinatura da zona');
    assert(JSON.stringify([...a.Z]).indexOf('{{titulo}}')<0,'a zona carregou conteúdo');
  });

  test('zona: 300 camadas seguem compiláveis com elasticidade e zonas',()=>{
    const L=arteGrande(300), cv={w:1080,h:4000};
    const marca=(fn)=>{const t0=performance.now();const r=fn();return {ms:performance.now()-t0,r};};
    const g0=gCompileLayoutGrammar(L,cv), G0=gCompileCompositionGraph(g0);
    const C0=gCompileLayoutComponents(g0,G0);
    gCompileAllImpactZones(G0,C0);                                  // aquece o JIT
    const E=marca(()=>gCompileLayerElasticity(g0,G0));
    const Z=marca(()=>gCompileAllImpactZones(G0,C0));
    assert(E.r.size===g0.nodes.length,'a elasticidade deixou camadas de fora');
    assert(Z.r.size>0,'nenhuma zona numa arte de 300 camadas');
    /* Uma zona por CAMPO, não por camada — e cada uma é uma travessia das arestas de impacto,
       não uma BFS completa do grafo. Se alguém trocar por zona-por-camada, isto dispara. */
    assert(Z.r.size<=g0.nodes.length,'há mais zonas que camadas: virou zona por camada');
    assert(E.ms+Z.ms<800,'elasticidade+zonas levaram '+(E.ms+Z.ms).toFixed(1)+'ms');
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
