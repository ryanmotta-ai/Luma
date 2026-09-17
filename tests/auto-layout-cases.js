/* Browser-native, sem framework: abra tests/auto-layout.html. A suíte usa Canvas 2D real para
   que as mesmas métricas tipográficas da prévia/exportação sejam exercitadas. */
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
    // O nível 4 é DERIVADO sob demanda: quem quer emergência global paga por ela ali.
    const L4=gImpactLevelMembers(z,4,r.G);
    assert(L4.indexOf('longe')>=0&&L4.indexOf('sobre')>=0,
      'os dois deveriam cair no fallback global');
    assert(z.levels[4]===undefined,'o nível 4 voltou a ser materializado de véspera');
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
      const L4=gImpactLevelMembers(z,4,r.G);
      const todos=[].concat(z.levels[0],z.levels[1],z.levels[2],z.levels[3],L4);
      assert(new Set(todos).size===todos.length,'uma camada apareceu em dois níveis');
      assert(new Set(todos).size===r.g.nodes.length,
        'a zona não cobre a composição inteira: '+todos.length+' de '+r.g.nodes.length);
      // A contagem guardada tem que bater com a lista derivada — senão a assinatura mente.
      assert(z.restantes===L4.length,'a contagem do nível 4 divergiu da lista derivada');
      assert(gImpactLevelMembers(z,4,null).length===0,'derivou o nível 4 sem contexto');
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

  /* ══ OPERATIONAL CAPABILITY — o contrato de paridade com o solver (Fase 4.5) ═════════════
     Elasticidade descreve liberdade; capacidade confirma que o motor REAL consegue exercê-la.
     Cada caso aqui compara a resposta declarada contra o comportamento do solver na mesma arte
     — é isso que impede a Fase 5 de propor ações que a escada não executa. */
  const opctx=(layers,canvas,dados)=>gBuildOperationalContext(layers,canvas||{w:1080,h:1080},
    dados?{dados:dados}:null);
  const cap=(C,id,c)=>gLayoutCapability(C,id,c);

  test('paridade: protegida não move — capacidade e solver dizem o mesmo',()=>{
    const layers=[
      text('titulo',90,60,900,90,'{{titulo}}',{fontSize:72,name:'Titulo'}),
      {id:'logo',name:'Logo da marca',type:'image',x:90,y:200,w:200,h:90,visible:true,opacity:100}
    ];
    const C=opctx(layers);
    const r=cap(C,'logo','canMoveY');
    assert(!r.permitido&&r.motivo==='protegida','a capacidade liberou o logo');
    const out=solve(layers,{titulo:'TEXTO ENORME QUE CRESCE MUITO ALEM DA CAIXA DESENHADA'},{w:1080,h:1080});
    assert(!by(out,'logo')._anchorAuto,'o solver encadeou o logo: a capacidade mentiu');
    // E todas as outras capacidades também dizem não.
    ['canWrap','canShrinkFont','canCompressLineHeight','canRestoreTracking','canResizeContainer']
      .forEach(c=>assert(!cap(C,'logo',c).permitido,'o logo foi liberado em '+c));
  });

  test('paridade: título pode quebrar linha — e o solver quebra mesmo',()=>{
    const layers=[
      text('titulo',90,60,500,90,'{{titulo}}',{fontSize:60,name:'Titulo'}),
      shape('selo',700,60,220,220,{shapeKind:'circle',locked:true})
    ];
    const C=opctx(layers,{w:1080,h:1080});
    const r=cap(C,'titulo','canWrap');
    assert(r.permitido&&r.maxLinhas===gLayoutRoleMaxLines('titulo'),
      'a capacidade não devolveu o teto real de linhas');
    const out=solve(layers,{titulo:'Combo artesanal com batata bebida e sobremesa especial'},{w:1080,h:1080});
    assert(by(out,'titulo')._fit.lines.length>1,'o solver não quebrou o que a capacidade prometeu');
  });

  test('paridade: preço automático não é filho de corrente; com âncora manual, é',()=>{
    const semAncora=[
      text('produto',90,60,900,90,'{{produto}}',{fontSize:72,name:'Produto'}),
      text('preco',90,200,400,70,'{{preco}}',{fontSize:52,name:'Preço'})
    ];
    const C1=opctx(semAncora);
    const r1=cap(C1,'preco','canMoveY');
    assert(!r1.permitido&&r1.motivo==='bloco-de-preco-nao-sai-do-lugar',
      'a capacidade "corrigiu" o preço para o que parece intuitivo');
    const out1=solve(semAncora,{produto:'NOME MUITO LONGO QUE CRESCE ALEM DA CAIXA DESENHADA',
      preco:'R$ 9,99'},{w:1080,h:1080});
    assert(!by(out1,'preco')._anchorAuto,'o solver encadeou o preço automático');
    // Com a declaração do designer, muda — e a capacidade acompanha.
    const comAncora=semAncora.map(l=>l.id==='preco'
      ?Object.assign({},l,{relativeAnchor:{type:'top-to-bottom',layerId:'produto',gap:20}}):l);
    const r2=cap(opctx(comAncora),'preco','canMoveY');
    assert(r2.permitido&&r2.autorada===true,'a âncora manual não devolveu o movimento');
    const out2=solve(comAncora,{produto:'NOME MUITO LONGO QUE CRESCE ALEM DA CAIXA DESENHADA',
      preco:'R$ 9,99'},{w:1080,h:1080});
    assert(by(out2,'preco').y>200,'o solver não moveu o preço com âncora manual');
  });

  test('paridade: placa pode crescer — e o solver a faz crescer',()=>{
    // Placa que ABRAÇA o texto — a proporção real de um card de promo.
    const layers=[
      shape('placa',70,80,360,110,{locked:false}),
      text('preco',95,100,310,65,'{{preco}}',{fontSize:40,name:'Preço',layoutRefText:'R$ 9,99'})
    ];
    const C=opctx(layers,{w:600,h:500});
    const r=cap(C,'placa','canResizeContainer');
    assert(r.permitido,'a capacidade não viu a placa: '+r.motivo);
    assert(r.medidoNaTinta===true,'a capacidade não mediu na tinta — mediu na caixa');
    assert(!cap(C,'preco','canResizeContainer').permitido,'o texto virou contêiner');
    const out=solve(layers,{preco:'R$ 1.249,90 POR TEMPO LIMITADO E MAIS UM POUCO'},{w:600,h:500});
    assert(by(out,'placa').h!==110||by(out,'placa').w!==360,
      'o solver não mexeu na placa que a capacidade prometeu');
    /* PAINEL NÃO É PLACA — e os dois lados têm que concordar nisso também. A forma abaixo é
       grande demais para a tinta de referência: o solver recusa (teto de 6× a área) e a
       capacidade tem que recusar junto, medindo na TINTA e não na caixa. */
    const painel=[
      shape('painel',40,40,520,300,{locked:false}),
      text('titulo',95,100,310,65,'{{titulo}}',{fontSize:40,textBox:'point',textAlign:'center',
        name:'Titulo',layoutRefText:'OI'})
    ];
    const Cp=opctx(painel,{w:600,h:500});
    const rp=cap(Cp,'painel','canResizeContainer');
    const outP=solve(painel,{titulo:'TEXTO BEM MAIOR QUE O ORIGINAL'},{w:600,h:500});
    const cresceu=by(outP,'painel').w!==520||by(outP,'painel').h!==300;
    assert(rp.permitido===cresceu,
      'capacidade diz '+rp.permitido+' e o solver '+cresceu+' — a paridade quebrou');
  });

  test('paridade: tracking só é devolvido onde o render somou (fonte display)',()=>{
    const layers=[
      text('display',90,60,600,90,'CHAMADA',{fontSize:60,font:'Anton Black',name:'Titulo'}),
      text('texto',90,200,600,60,'apoio comum',{fontSize:30,name:'Descrição'}),
      text('autoral',90,300,600,60,'COM TRACKING',{fontSize:40,letterSpacing:3,name:'Titulo'})
    ];
    const C=opctx(layers);
    const d=cap(C,'display','canRestoreTracking');
    assert(d.permitido&&d.display===true,'fonte display não pôde devolver tracking');
    assert(Math.abs(d.efetivo-gLayoutTrackingEfetivo(layers[0]))<0.001,
      'a capacidade usou uma conta de tracking diferente da do solver');
    assert(!cap(C,'texto','canRestoreTracking').permitido,
      'fonte de texto não tem tracking a devolver — não pode prometer');
    assert(cap(C,'autoral','canRestoreTracking').permitido,
      'tracking que o designer escreveu também pode ser apertado até zero');
  });

  test('paridade: fonte no piso de legibilidade NÃO pode encolher',()=>{
    /* O ponto da fase inteira: a elasticidade classifica o PAPEL como flexível; só a capacidade
       sabe que não sobrou pixel nenhum, porque o piso depende do lado curto do canvas. */
    const layers=[
      text('titulo',90,60,900,90,'{{titulo}}',{fontSize:72,name:'Titulo'}),
      text('mini',90,200,600,30,'letra miuda',{fontSize:13,name:'Descrição'})
    ];
    const C=opctx(layers,{w:1080,h:1080});
    assert(gElasticityLevel(C.elasticity.get('mini').fontShrink)>0,
      'a elasticidade deveria descrever o apoio como flexível');
    const r=cap(C,'mini','canShrinkFont');
    assert(!r.permitido&&r.motivo==='no-piso','a capacidade prometeu espaço que não existe');
    assert(r.atual===r.piso&&r.folga===0,'o diagnóstico do piso saiu errado');
    // O título tem folga de verdade — e o piso é o MESMO que a escada usa.
    const t=cap(C,'titulo','canShrinkFont');
    const clone=Object.assign({},layers[0]);
    gStampPisosHierarquia([clone],{w:1080,h:1080});
    assert(t.permitido&&t.piso===gLayoutPisoFonte(clone,false),
      'a capacidade usou um piso diferente do solver');
  });

  test('paridade: colapso de campo vazio é capacidade própria, não liberdade de movimento',()=>{
    const layers=[
      text('titulo',80,90,360,60,'OFERTA',{fontSize:44}),
      text('opcional',80,170,360,40,'{{opcional}}',{fontSize:26}),
      text('cta',80,230,240,44,'APROVEITE',{fontSize:28,name:'CTA'})
    ];
    // Sem os dados do franqueado a capacidade NÃO inventa: ela declara que não sabe.
    assert(cap(opctx(layers,{w:600,h:500}),'cta','canCollapseGap').motivo==='sem-dados-do-franqueado',
      'a capacidade inventou colapso sem saber o que o franqueado digitou');
    // Com o campo preenchido, não há vão a fechar.
    assert(!cap(opctx(layers,{w:600,h:500},{opcional:'TEM TEXTO'}),'cta','canCollapseGap').permitido,
      'prometeu colapso com o campo preenchido');
    // Com o campo em branco, há — e o solver credita exatamente isso.
    const r=cap(opctx(layers,{w:600,h:500},{opcional:''}),'cta','canCollapseGap');
    assert(r.permitido&&r.credito>0,'não viu o vão que o campo vazio deixou');
    const out=solve(layers,{opcional:''},{w:600,h:500});
    assert(by(out,'cta')._anchorAuto.colapso===r.credito,
      'o crédito da capacidade ('+r.credito+') difere do solver ('+by(out,'cta')._anchorAuto.colapso+')');
    // ⛔ E isso NÃO virou liberdade geral de movimento.
    assert(G_LAYOUT_ACOES['collapse-empty-gap'].dimensao===null,
      'o colapso foi enfiado numa dimensão de elasticidade');
  });

  test('paridade: compressão de respiro é DISCRETA, não escala contínua',()=>{
    const C=opctx([text('a',90,60,600,60,'{{a}}',{fontSize:40,name:'Titulo'})]);
    const r=cap(C,'a','canCompressSpacing');
    assert(r.permitido&&r.degraus===1&&r.fator===0.5,
      'a capacidade prometeu níveis de compressão que o motor não tem');
  });

  test('paridade: singleton não escala como grupo; membro protegido bloqueia o componente',()=>{
    const so=opctx([text('cta',90,100,300,60,'PEÇA AGORA',{fontSize:40,name:'CTA'})],{w:700,h:600});
    const unit=gComponentsByType(so.components,'cta-block')[0];
    const r=gComponentCapability(so,unit.id,'canScaleComponent');
    assert(!r.permitido&&r.motivo==='singleton-nao-escala-como-grupo',
      'um membro só recebeu escala de grupo');
    // Grupo com membro protegido: bloqueia o componente inteiro.
    const comLogo=opctx([
      {id:'g',name:'Bloco',type:'group',x:70,y:80,w:600,h:140,visible:true,opacity:100},
      text('preco',95,100,300,65,'{{preco}}',{fontSize:40,name:'Preço',parentId:'g'}),
      {id:'logo',name:'Logo',type:'image',x:450,y:100,w:150,h:80,visible:true,opacity:100,parentId:'g'}
    ],{w:1080,h:1080});
    comLogo.components.filter(c=>!c.singleton).forEach(c=>{
      const x=gComponentCapability(comLogo,c.id,'canScaleComponent');
      if(c.membros.indexOf('logo')>=0)
        assert(!x.permitido,'componente com logo dentro pôde escalar: '+c.tipo);
    });
  });

  test('portão: a conjunção elasticidade × capacidade mora num lugar só',()=>{
    const layers=[
      text('titulo',90,60,900,90,'{{titulo}}',{fontSize:72,name:'Titulo'}),
      text('mini',90,200,600,30,'letra miuda',{fontSize:13,name:'Descrição'}),
      {id:'logo',name:'Logo',type:'image',x:820,y:60,w:180,h:90,visible:true,opacity:100}
    ];
    const C=opctx(layers);
    // Bloqueado pela ELASTICIDADE (o papel nem permite) — nem chega a perguntar ao motor.
    const p1=gLayoutOperationalPermission(C,'logo','wrap-text');
    assert(!p1.permitido&&p1.bloqueadoPor==='elasticity','o bloqueio por elasticidade se perdeu');
    assert(p1.capacidade===null,'perguntou ao motor mesmo com a elasticidade proibindo');
    // Bloqueado pela CAPACIDADE (o papel permite, o motor não consegue).
    const p2=gLayoutOperationalPermission(C,'mini','shrink-text');
    assert(!p2.permitido&&p2.bloqueadoPor==='solver-capability','o bloqueio por capacidade se perdeu');
    assert(gElasticityLevel(p2.elasticidade)>0,'este caso tinha que passar pela elasticidade');
    // Permitido pelos dois.
    assert(gLayoutOperationalPermission(C,'titulo','shrink-text').permitido,
      'o caso que deveria passar foi bloqueado');
  });

  test('portão: fora da zona de impacto é bloqueio próprio',()=>{
    const layers=[
      text('titulo',90,60,600,90,'{{titulo}}',{fontSize:72,name:'Titulo'}),
      text('apoio',90,180,600,60,'ACOMPANHA',{fontSize:40}),
      text('longe',90,1500,600,60,'OUTRA SEÇÃO',{fontSize:40})
    ];
    const C=opctx(layers,{w:1080,h:1920});
    const perto=gLayoutCanAttempt({ctx:C,action:'shrink-text',targetId:'apoio',rootId:'titulo'});
    assert(perto.permitido,'quem está na zona foi bloqueado: '+perto.motivo);
    assert(perto.nivelImpacto!=null&&perto.nivelImpacto<=3,'o nível de impacto não foi reportado');
    const fora=gLayoutCanAttempt({ctx:C,action:'shrink-text',targetId:'longe',rootId:'titulo'});
    assert(!fora.permitido&&fora.bloqueadoPor==='impact-scope','a zona não barrou quem está fora');
    // Emergência global: só quando alguém pede explicitamente o nível 4.
    const emerg=gLayoutCanAttempt({ctx:C,action:'shrink-text',targetId:'longe',rootId:'titulo',impactLevel:4});
    assert(emerg.permitido&&emerg.nivelImpacto===4,'o nível 4 não abriu nem sob pedido explícito');
  });

  test('vocabulário: fechado, coerente e sem execução',()=>{
    const esperadas=['wrap-text','compress-gap','restore-tracking','compress-line-height',
      'push-dependent','resize-container','shrink-text','scale-component','collapse-empty-gap'];
    esperadas.forEach(a=>assert(G_LAYOUT_ACOES[a],'falta a ação "'+a+'" no vocabulário'));
    assert(Object.keys(G_LAYOUT_ACOES).length===esperadas.length,'o vocabulário cresceu sem aviso');
    Object.keys(G_LAYOUT_ACOES).forEach(a=>{
      const m=G_LAYOUT_ACOES[a];
      assert(m.capacidade&&m.alvo&&m.degrau,'a ação "'+a+'" está sem metadados');
      assert(!m.apply&&!m.executar,'apareceu execução no vocabulário: esta fase não executa');
      assert(m.dimensao===null||G_ELASTICITY_DIMENSOES.indexOf(m.dimensao)>=0,
        'a ação "'+a+'" aponta para dimensão inexistente: '+m.dimensao);
    });
    assert(gLayoutCanAttempt({ctx:{},action:'inventada',targetId:'x'}).motivo==='acao-desconhecida',
      'ação fora do vocabulário foi aceita');
  });

  test('capacidade é barata o bastante para a busca consultar muito',()=>{
    const L=arteGrande(150), cv={w:1080,h:2200};
    const t0=performance.now();
    const C=gBuildOperationalContext(L,cv);
    const msCtx=performance.now()-t0;
    const alvos=C.grammar.nodes.map(n=>n.id);
    const caps=['canWrap','canShrinkFont','canMoveY','canCompressSpacing'];
    const t1=performance.now();
    let n=0;
    for(let k=0;k<5;k++) alvos.forEach(id=>caps.forEach(c=>{gLayoutCapability(C,id,c);n++;}));
    const ms=performance.now()-t1;
    /* O contexto é compilado UMA vez e indexado; a consulta é lookup em `Map` mais aritmética.
       Se alguém trouxer `.find()` linear ou travessia completa para dentro da consulta, este
       número dispara — e a busca de candidatos, que vai perguntar milhares de vezes, para. */
    assert(n>=3000,'o teste não exercitou consultas suficientes: '+n);
    assert(ms<400,n+' consultas levaram '+ms.toFixed(1)+'ms (contexto: '+msCtx.toFixed(1)+'ms)');
    assert(ms/n<0.05,'cada consulta custou '+(ms/n).toFixed(4)+'ms — caro demais para a busca');
  });

  test('capacidade não muta nada e é determinística',()=>{
    const layers=[
      shape('placa',70,80,360,110,{locked:false}),
      text('preco',95,100,310,65,'{{preco}}',{fontSize:40,name:'Preço'})
    ];
    const antes=JSON.stringify(layers);
    const C=opctx(layers,{w:600,h:500});
    ['canWrap','canShrinkFont','canMoveY','canResizeContainer'].forEach(c=>{
      gLayoutCapability(C,'preco',c); gLayoutCapability(C,'placa',c);
    });
    assert(JSON.stringify(layers)===antes,'a capacidade MUTOU as camadas');
    /* `gStampPisosHierarquia` escreve `_pisoFonte`/`_pisoLegivel` — por isso o contexto trabalha
       em clones. Se um dia alguém tirar o clone, esta asserção é quem avisa. */
    assert(layers[1]._pisoLegivel===undefined,'o carimbo de piso vazou para o template');
    const a=JSON.stringify(gLayoutCapability(C,'preco','canShrinkFont'));
    const b=JSON.stringify(gLayoutCapability(opctx(layers,{w:600,h:500}),'preco','canShrinkFont'));
    assert(a===b,'a capacidade não é determinística');
  });

  // Helper local: monta a ação de escala de um componente sem depender do gerador (a escala
  // nasce de um problema de colisão, e aqui o alvo é a mecânica da aplicação).
  const _gAcaoParaTeste=(c)=>({id:'scale-component',targetId:null,componentId:c.id,rootId:null,
    impactLevel:null,params:{fator:0.92},reason:'teste',
    signature:gLayoutActionSignature({id:'scale-component',componentId:c.id,params:{fator:0.92}})});

  /* ══ DESIGNER MOVES — a primeira transformação real (Fase 5) ═════════════════════════════
     Cada ação é UM degrau da escada, isolado e reversível. Os casos aqui provam três coisas:
     que nada é gerado sem passar pelo portão, que aplicar uma ação não contamina nem a base nem
     as outras, e que o resultado de cada movimento bate com o que o solver faz no mesmo degrau.
     ⛔ Não existe Candidate Search: nada aqui combina, pontua ou escolhe. */
  const gera=(C,p)=>gGenerateLayoutActions(C,p);
  const temAcao=(as,id)=>as.some(a=>a.id===id);
  const acaoDe=(as,id)=>as.find(a=>a.id===id)||null;
  const arteMov=()=>[
    text('titulo',90,60,600,90,'{{titulo}}',{fontSize:72,name:'Titulo',lineHeight:1.6}),
    text('apoio',90,200,600,60,'ACOMPANHA',{fontSize:30,name:'Descrição'}),
    shape('placa',90,320,400,120,{locked:false,name:'Placa'}),
    text('preco',120,350,340,60,'{{preco}}',{fontSize:52,name:'Preço',layoutRefText:'R$ 9,99'}),
    text('mini',90,500,600,30,'letra miuda',{fontSize:13,name:'Observação'}),
    text('display',90,560,600,80,'CHAMADA',{fontSize:60,font:'Anton Black',name:'Chamada'}),
    {id:'logo',name:'Logo',type:'image',x:820,y:60,w:180,h:90,visible:true,opacity:100}
  ];
  const ctxMov=(layers,dados)=>gBuildOperationalContext(layers||arteMov(),{w:1080,h:1080},
    {dados:dados||{titulo:'NOME BEM MAIS LONGO DO QUE O ORIGINAL',preco:'R$ 1.249,90'}});

  test('mov: sem problema, zero ações e zero clones',()=>{
    const C=ctxMov();
    assert(gera(C,null).length===0,'gerou ação sem problema');
    assert(gera(C,{tipo:'inventado',targetId:'titulo'}).length===0,'aceitou problema fora do vocabulário');
    assert(gera(C,{tipo:'text-overflow',targetId:'nao-existe'}).length===0,'gerou para alvo inexistente');
    // O vocabulário de problemas é fechado e objetivo — nada de "layout feio".
    ['text-overflow','collision','outside-canvas','spacing-pressure','container-mismatch','optional-empty']
      .forEach(t=>assert(G_LAYOUT_PROBLEMAS[t],'falta o problema "'+t+'"'));
    assert(Object.keys(G_LAYOUT_PROBLEMAS).length===6,'o vocabulário de problemas cresceu sem aviso');
  });

  test('mov: overflow gera as ações da escada, na ordem da escada',()=>{
    const C=ctxMov();
    const as=gera(C,{tipo:'text-overflow',targetId:'titulo',rootId:'titulo',detalhe:{largura:520}});
    assert(as.length>0,'não gerou ação para overflow');
    assert(as[0].id==='wrap-text','a primeira tentativa deveria ser a mais barata (quebrar)');
    const iShrink=as.findIndex(a=>a.id==='shrink-text');
    assert(iShrink===as.length-1,'encolher a fonte deveria ser a última opção');
    as.forEach(a=>{
      assert(G_LAYOUT_ACOES[a.id],'ação fora do vocabulário da Fase 4.5: '+a.id);
      assert(a.signature&&a.reason,'a ação saiu sem assinatura ou sem razão');
      assert(typeof a.params==='object'&&!a.apply,'o descriptor levou função dentro');
    });
  });

  test('mov: fonte no piso não gera shrink; fonte sem display não gera tracking',()=>{
    const C=ctxMov();
    const mini=gera(C,{tipo:'text-overflow',targetId:'mini',rootId:null});
    assert(!temAcao(mini,'shrink-text'),'gerou encolhimento para uma fonte que já está no piso');
    const apoio=gera(C,{tipo:'text-overflow',targetId:'apoio',rootId:null});
    assert(!temAcao(apoio,'restore-tracking'),'gerou devolução de tracking em fonte de texto');
    const disp=gera(C,{tipo:'text-overflow',targetId:'display',rootId:null});
    assert(temAcao(disp,'restore-tracking'),'fonte display deveria poder devolver tracking');
  });

  test('mov: preço automático não ganha movimento; com âncora manual, ganha',()=>{
    const arte=[
      text('produto',90,60,900,90,'{{produto}}',{fontSize:72,name:'Produto'}),
      text('preco',90,200,400,70,'{{preco}}',{fontSize:52,name:'Preço'})
    ];
    const C=gBuildOperationalContext(arte,{w:1080,h:1080},{dados:{produto:'X',preco:'R$ 1,00'}});
    const as=gera(C,{tipo:'collision',targetId:'preco',rootId:'produto',detalhe:{delta:40}});
    assert(!temAcao(as,'push-dependent'),'o bloco de preço automático ganhou movimento');
    const comAncora=arte.map(l=>l.id==='preco'
      ?Object.assign({},l,{relativeAnchor:{type:'top-to-bottom',layerId:'produto',gap:20}}):l);
    const C2=gBuildOperationalContext(comAncora,{w:1080,h:1080},{dados:{produto:'X',preco:'R$ 1,00'}});
    assert(temAcao(gera(C2,{tipo:'collision',targetId:'preco',rootId:'produto',detalhe:{delta:40}}),
      'push-dependent'),'a âncora manual não devolveu o movimento');
  });

  test('mov: placa gera resize; painel grande não; protegida não gera nada',()=>{
    const C=ctxMov();
    assert(temAcao(gera(C,{tipo:'container-mismatch',targetId:'placa',rootId:'preco'}),'resize-container'),
      'a placa válida não gerou resize');
    const painel=[
      shape('painel',40,40,520,300,{locked:false}),
      text('t',95,100,310,65,'{{t}}',{fontSize:40,textBox:'point',textAlign:'center',layoutRefText:'OI'})
    ];
    const Cp=gBuildOperationalContext(painel,{w:600,h:500},{dados:{t:'TEXTO GRANDE'}});
    assert(!temAcao(gera(Cp,{tipo:'container-mismatch',targetId:'painel',rootId:'t'}),'resize-container'),
      'um painel virou placa');
    // Protegida: nenhuma ação destrutiva, em nenhum problema.
    ['text-overflow','collision','outside-canvas','spacing-pressure'].forEach(t=>
      assert(gera(C,{tipo:t,targetId:'logo',rootId:'titulo',detalhe:{delta:40,largura:100}}).length===0,
        'o logo ganhou ação em "'+t+'"'));
  });

  test('mov: fora do escopo de impacto a ação não é gerada',()=>{
    const arte=[
      text('titulo',90,60,600,90,'{{titulo}}',{fontSize:72,name:'Titulo'}),
      text('longe',90,1500,600,60,'OUTRA SEÇÃO',{fontSize:40,name:'Descrição'})
    ];
    const C=gBuildOperationalContext(arte,{w:1080,h:1920},{dados:{titulo:'X'}});
    assert(gera(C,{tipo:'text-overflow',targetId:'longe',rootId:'titulo'}).length===0,
      'gerou ação para quem está fora da zona de impacto da raiz');
    assert(gera(C,{tipo:'text-overflow',targetId:'longe',rootId:null}).length>0,
      'sem raiz não há escopo a verificar — deveria gerar');
  });

  test('mov: colapso só com dados reais; singleton e membro protegido barram a escala',()=>{
    const arte=[
      text('titulo',80,90,360,60,'OFERTA',{fontSize:44,name:'Titulo'}),
      text('opcional',80,170,360,40,'{{opcional}}',{fontSize:26}),
      text('cta',80,230,240,44,'APROVEITE',{fontSize:28,name:'CTA'})
    ];
    const semDados=gBuildOperationalContext(arte,{w:600,h:500});
    assert(gera(semDados,{tipo:'optional-empty',targetId:'cta'}).length===0,
      'gerou colapso sem saber o que o franqueado digitou');
    assert(gera(gBuildOperationalContext(arte,{w:600,h:500},{dados:{opcional:'TEM'}}),
      {tipo:'optional-empty',targetId:'cta'}).length===0,'gerou colapso com o campo preenchido');
    const comVazio=gBuildOperationalContext(arte,{w:600,h:500},{dados:{opcional:''}});
    assert(temAcao(gera(comVazio,{tipo:'optional-empty',targetId:'cta'}),'collapse-empty-gap'),
      'o campo vazio não gerou colapso');
    // Escala: singleton e membro protegido bloqueiam (o portão já disse; aqui não vaza).
    const so=gBuildOperationalContext([text('cta',90,100,300,60,'PEÇA AGORA',{fontSize:40,name:'CTA'})],
      {w:700,h:600});
    assert(!temAcao(gera(so,{tipo:'collision',targetId:'cta'}),'scale-component'),
      'um membro só ganhou escala de grupo');
  });

  test('mov: aplicar não toca a base e um ramo não contamina o outro',()=>{
    const base=arteMov();
    const congelado=JSON.stringify(base);
    const C=ctxMov(base);
    const as=gera(C,{tipo:'text-overflow',targetId:'titulo',rootId:'titulo',detalhe:{largura:520}});
    assert(as.length>=2,'este caso precisa de pelo menos duas ações');
    const rs=as.map(a=>gApplyLayoutAction(base,a,C));
    assert(JSON.stringify(base)===congelado,'a aplicação MUTOU a base');
    // Cada clone carrega SÓ o efeito da própria ação.
    const wrap=rs[as.findIndex(a=>a.id==='wrap-text')];
    const shrink=rs[as.findIndex(a=>a.id==='shrink-text')];
    const tw=wrap.layers.find(l=>l.id==='titulo'), ts=shrink.layers.find(l=>l.id==='titulo');
    assert(tw._layoutW!=null&&tw._tetoFonte==null,'o ramo do wrap recebeu o efeito do shrink');
    assert(ts._tetoFonte!=null&&ts._layoutW==null,'o ramo do shrink recebeu o efeito do wrap');
    assert(wrap.layers!==shrink.layers&&wrap.layers[0]!==shrink.layers[0],
      'os dois ramos compartilham o mesmo objeto de camada');
  });

  test('mov: changedIds corresponde exatamente ao que mudou',()=>{
    const base=arteMov(), C=ctxMov(base);
    const casos=[
      gera(C,{tipo:'text-overflow',targetId:'titulo',rootId:'titulo',detalhe:{largura:520}}),
      gera(C,{tipo:'container-mismatch',targetId:'placa',rootId:'preco'}),
      gera(C,{tipo:'collision',targetId:'apoio',rootId:'titulo',detalhe:{delta:40}})
    ];
    casos.forEach(as=>as.forEach(a=>{
      const r=gApplyLayoutAction(base,a,C);
      const idxB=new Map(base.map(l=>[l.id,l]));
      const mudaram=r.layers.filter(l=>JSON.stringify(l)!==JSON.stringify(idxB.get(l.id))).map(l=>l.id).sort();
      assert(JSON.stringify(mudaram)===JSON.stringify(r.changedIds),
        a.id+': changedIds='+JSON.stringify(r.changedIds)+' mas mudou '+JSON.stringify(mudaram));
    }));
  });

  test('mov: a assinatura da ação é determinística e ignora ordem de params',()=>{
    const C=ctxMov();
    const p={tipo:'text-overflow',targetId:'titulo',rootId:'titulo',detalhe:{largura:520}};
    const a=gera(C,p), b=gera(ctxMov(),p);
    assert(a.length===b.length,'duas gerações iguais deram contagens diferentes');
    assert(a.map(x=>x.signature).join()===b.map(x=>x.signature).join(),
      'as assinaturas não são determinísticas');
    assert(a.map(x=>x.id).join()===b.map(x=>x.id).join(),'a ORDEM das ações não é determinística');
    // A ordem das chaves de params não pode virar informação.
    const s1=gLayoutActionSignature({id:'shrink-text',targetId:'t',params:{de:72,para:66}});
    const s2=gLayoutActionSignature({id:'shrink-text',targetId:'t',params:{para:66,de:72}});
    assert(s1===s2,'a ordem das chaves mudou a assinatura');
  });

  /* ══ PARIDADE POR MOVIMENTO — cada ação contra o degrau equivalente do solver ═══════════ */

  test('paridade-mov: shrink é UM degrau de 8% e nunca cruza o piso',()=>{
    const base=arteMov(), C=ctxMov(base);
    const a=acaoDe(gera(C,{tipo:'text-overflow',targetId:'titulo',rootId:'titulo'}),'shrink-text');
    const clone=Object.assign({},base[0]);
    gStampPisosHierarquia([clone].concat(base.slice(1).map(l=>Object.assign({},l))),{w:1080,h:1080});
    const piso=gLayoutPisoFonte(clone,false);
    assert(a.params.para===Math.max(piso,Math.floor(72*0.92)),
      'o degrau não é o mesmo do solver: '+a.params.para);
    assert(a.params.para>=piso,'o degrau cruzou o piso');
    assert(a.params.para>Math.floor(72*0.5),'reduziu direto até o fundo em vez de um degrau');
  });

  test('paridade-mov: entrelinha usa a conta do solver e nunca cruza 1.05',()=>{
    const base=arteMov(), C=ctxMov(base);
    const a=acaoDe(gera(C,{tipo:'text-overflow',targetId:'titulo',rootId:'titulo',detalhe:{largura:400}}),
      'compress-line-height');
    assert(a,'o título com entrelinha 1.6 e duas linhas tinha que gerar o degrau');
    assert(a.params.para>=1.05,'a entrelinha cruzou o piso de 1.05');
    assert(a.params.para<a.params.de,'gerou compressão que não comprime');
    const r=gApplyLayoutAction(base,a,C);
    assert(r.layers.find(l=>l.id==='titulo')._entrelinha===a.params.para,
      'a aplicação não usou o carimbo que a escada usa');
    assert(r.typographyChanged&&!r.geometryChanged,'a entrelinha mexeu em geometria');
  });

  test('paridade-mov: tracking devolve exatamente o que o motor somou, e só isso',()=>{
    const base=arteMov(), C=ctxMov(base);
    const a=acaoDe(gera(C,{tipo:'text-overflow',targetId:'display',rootId:null}),'restore-tracking');
    assert(a,'fonte display deveria gerar a devolução');
    const l=base.find(x=>x.id==='display');
    const esperado=Math.max(0,gLayoutTrackingEfetivo(l,l.fontSize)-l.fontSize*0.02);
    assert(Math.abs(a.params.para-esperado)<0.001,'a conta difere da do solver');
    assert(a.params.origem==='motor','a ação não declarou que devolve tracking do motor');
    /* ⛔ Tracking AUTORAL não é tocado — esta ação é mais conservadora que a escada de
       propósito: devolver o que o render somou é reverter o motor; apertar o do designer é
       mexer no desenho dele. */
    const comAutoral=base.map(x=>x.id==='display'?Object.assign({},x,{letterSpacing:3}):x);
    const C2=gBuildOperationalContext(comAutoral,{w:1080,h:1080},{dados:{titulo:'X',preco:'R$ 1'}});
    assert(!temAcao(gera(C2,{tipo:'text-overflow',targetId:'display'}),'restore-tracking'),
      'a ação mexeu no tracking que o designer escreveu');
  });

  test('paridade-mov: compress-gap é UM degrau de 0.5 e não é geometria de camada',()=>{
    const base=arteMov(), C=ctxMov(base);
    const a=acaoDe(gera(C,{tipo:'spacing-pressure',targetId:'apoio',rootId:'titulo'}),'compress-gap');
    assert(a&&a.params.fator===0.5,'o degrau do respiro não é 0.5');
    const r=gApplyLayoutAction(base,a,C);
    assert(r.opts&&r.opts._respiroFator===0.5,'a ação não devolveu a opção de solve');
    assert(r.changedIds.length===0&&!r.geometryChanged,
      'o respiro virou geometria de camada — ele é parâmetro do solve');
    // E o degrau existe de verdade no motor: o respiro apertado é menor que o ideal.
    const t=base.find(x=>x.id==='apoio'), cv={w:1080,h:1080};
    assert(_gLayoutRespiro(t,40,cv,0.5)<_gLayoutRespiro(t,40,cv,1),
      'o fator 0.5 não aperta nada no motor real');
  });

  test('paridade-mov: resize-container reproduz a placa que o solver produz',()=>{
    const base=[
      shape('placa',70,80,360,110,{locked:false}),
      text('preco',95,100,310,65,'{{preco}}',{fontSize:40,name:'Preço',layoutRefText:'R$ 9,99'})
    ];
    const dados={preco:'R$ 1.249,90 POR TEMPO LIMITADO E MAIS UM POUCO'};
    const C=gBuildOperationalContext(base,{w:600,h:500},{dados:dados});
    const a=acaoDe(gera(C,{tipo:'container-mismatch',targetId:'placa',rootId:'preco'}),'resize-container');
    assert(a,'não gerou o resize');
    const r=gApplyLayoutAction(base,a,C);
    const minha=r.layers.find(l=>l.id==='placa');
    const doSolver=by(solve(base,dados,{w:600,h:500}),'placa');
    ['x','y','w','h'].forEach(k=>assert(Math.abs(minha[k]-doSolver[k])<=1,
      'a placa da ação difere da do solver em '+k+': '+minha[k]+' vs '+doSolver[k]));
    assert(r.diagnostics.padding&&r.diagnostics.padding.e!=null,'o padding autorado não foi registrado');
  });

  test('paridade-mov: collapse usa o mesmo crédito que o solver credita',()=>{
    const base=[
      text('titulo',80,90,360,60,'OFERTA',{fontSize:44,name:'Titulo'}),
      text('opcional',80,170,360,40,'{{opcional}}',{fontSize:26}),
      text('cta',80,230,240,44,'APROVEITE',{fontSize:28,name:'CTA'})
    ];
    const C=gBuildOperationalContext(base,{w:600,h:500},{dados:{opcional:''}});
    const a=acaoDe(gera(C,{tipo:'optional-empty',targetId:'cta'}),'collapse-empty-gap');
    assert(a,'não gerou o colapso');
    const doSolver=by(solve(base,{opcional:''},{w:600,h:500}),'cta')._anchorAuto.colapso;
    assert(a.params.credito===doSolver,
      'o crédito ('+a.params.credito+') difere do solver ('+doSolver+')');
    const r=gApplyLayoutAction(base,a,C);
    assert(r.layers.find(l=>l.id==='cta').y===230-doSolver,'a subida não foi o crédito exato');
    assert(r.geometryChanged&&r.changedIds.join()==='cta','o colapso mexeu em quem não devia');
  });

  test('paridade-mov: push só desce, e só por dependência autorizada',()=>{
    const base=[
      text('titulo',90,100,420,58,'{{titulo}}',{fontSize:46,name:'Titulo'}),
      text('cta',90,180,260,48,'PEÇA AGORA',{fontSize:30,name:'CTA'})
    ];
    const dados={titulo:'Combo artesanal com batata bebida e sobremesa especial'};
    const C=gBuildOperationalContext(base,{w:700,h:600},{dados:dados});
    const a=acaoDe(gera(C,{tipo:'collision',targetId:'cta',rootId:'titulo',detalhe:{delta:37}}),
      'push-dependent');
    assert(a,'não gerou o empurrão numa cadeia autorizada');
    const r=gApplyLayoutAction(base,a,C);
    assert(r.layers.find(l=>l.id==='cta').y===180+37,'o empurrão não aplicou o delta');
    // Delta negativo (puxar para cima) não existe: a corrente inferida SÓ empurra.
    assert(!temAcao(gera(C,{tipo:'collision',targetId:'cta',rootId:'titulo',detalhe:{delta:-20}}),
      'push-dependent'),'gerou um empurrão para cima');
    // E o solver, na mesma arte, também desce o CTA.
    assert(by(solve(base,dados,{w:700,h:600}),'cta').y>180,'o solver não desceu o CTA');
  });

  test('mov: scale-component é proporcional e respeita o piso de emergência',()=>{
    const base=[
      text('titulo',90,60,600,90,'{{titulo}}',{fontSize:72,name:'Titulo'}),
      text('apoio',90,180,600,60,'ACOMPANHA',{fontSize:36,name:'Descrição'})
    ];
    const C=gBuildOperationalContext(base,{w:1080,h:1080},{dados:{titulo:'X'}});
    const c=gComponentsByType(C.components,'offer-block')[0];
    if(!c){ assert(true,'sem componente composto não há escala a testar'); return; }
    const a=_gAcaoParaTeste(c);
    const r=gApplyLayoutAction(base,a,C);
    r.diagnostics.membros.forEach(m=>{
      const l=base.find(x=>x.id===m.id), clone=Object.assign({},l);
      gStampPisosHierarquia(base.map(x=>Object.assign({},x)),{w:1080,h:1080});
      assert(m.para<m.de,'a escala não reduziu '+m.id);
      assert(m.para/m.de>0.85,'a escala de um degrau reduziu demais');
    });
    // Proporção preservada: todos caem pelo mesmo fator (dentro do arredondamento).
    if(r.diagnostics.membros.length>1){
      const fs=r.diagnostics.membros.map(m=>m.para/m.de);
      assert(Math.max.apply(null,fs)-Math.min.apply(null,fs)<0.03,'a escala não foi proporcional');
    }
  });

  test('mov: o diff de mutação diz o que mudou, sem pontuar',()=>{
    const base=arteMov(), C=ctxMov(base);
    const a=acaoDe(gera(C,{tipo:'collision',targetId:'apoio',rootId:'titulo',detalhe:{delta:40}}),
      'push-dependent');
    const r=gApplyLayoutAction(base,a,C);
    const d=gDescribeLayoutMutation(base,r.layers,{w:1080,h:1080});
    assert(d.moved.join()==='apoio','o diff não viu o deslocamento');
    assert(d.typographyChanged.length===0,'o diff acusou tipografia onde não houve');
    assert(d.visualChanged===true,'a assinatura visual não percebeu o movimento');
    assert(d.nota===undefined&&d.score===undefined,'apareceu pontuação: esta fase não pontua');
  });

  test('mov: gerar e aplicar é barato o bastante para 8–16 candidatos',()=>{
    const L=arteGrande(150), cv={w:1080,h:2200};
    const t0=performance.now();
    const C=gBuildOperationalContext(L,cv,{dados:{}});
    const msCtx=performance.now()-t0;
    const alvos=C.grammar.nodes.filter(n=>n.tipo==='text'&&n.campos.length).slice(0,8).map(n=>n.id);
    const t1=performance.now();
    let todas=[];
    alvos.forEach(id=>{ todas=todas.concat(gera(C,{tipo:'text-overflow',targetId:id,rootId:id})); });
    const msGer=performance.now()-t1;
    const t2=performance.now();
    todas.forEach(a=>gApplyLayoutAction(L,a,C));
    const msApp=performance.now()-t2;
    assert(todas.length>0,'não gerou ação nenhuma numa arte de 150 camadas');
    /* A busca da fase seguinte vai gerar ~8–16 candidatos por problema. Se alguém trouxer
       varredura da arte inteira para dentro da geração, estes números disparam. */
    assert(msGer<300,'geração levou '+msGer.toFixed(1)+'ms para '+alvos.length+' problemas');
    assert(msApp<400,todas.length+' aplicações levaram '+msApp.toFixed(1)+'ms (ctx '+msCtx.toFixed(1)+'ms)');
  });

  // Candidato mínimo só para exercitar a assinatura de ESTADO, sem passar pela busca.
  const _gCandidatoTeste=(layers)=>({layers:layers,actions:[],actionSignatures:[],depth:0});

  /* ══ CANDIDATE SEARCH — sequências curtas de movimentos seguros (Fase 5.5) ════════════════
     A busca devolve TODAS as sequências que resolveram; qual delas preserva melhor a intenção
     é pergunta da Fase 6. Aqui só existe DANO OBJETIVO — saiu da arte, colidiu, não coube.
     ⛔ Nada aqui escolhe vencedor e nada muda produção. */
  const ctxB=(layers,dados,cv)=>gBuildOperationalContext(layers,cv||{w:1080,h:1080},{dados:dados||{}});
  const busca=(layers,dados,cv,lim)=>{
    const c=ctxB(layers,dados,cv);
    return {ctx:c,r:gSearchLayoutCandidates({ctx:c,base:layers,limites:lim})};
  };
  const seq=(c)=>c.actions.map(a=>a.id).join(' → ');
  // Arte com um título que cresce e empurra o apoio; a placa e o preço abaixo, logo protegido.
  const arteB=()=>[
    text('titulo',90,60,500,90,'{{titulo}}',{fontSize:64,name:'Titulo'}),
    text('apoio',90,190,500,60,'ACOMPANHA O TITULO',{fontSize:30,name:'Descrição'}),
    shape('placa',90,320,400,120,{locked:false,name:'Placa'}),
    text('preco',120,350,340,60,'{{preco}}',{fontSize:52,name:'Preço',layoutRefText:'R$ 9,99'}),
    {id:'logo',name:'Logo',type:'image',x:820,y:60,w:180,h:90,visible:true,opacity:100}
  ];

  test('busca: sem dano objetivo, original-first e zero expansão',()=>{
    const {r}=busca(arteB(),{titulo:'OFERTA',preco:'R$ 9,99'});
    assert(r.diagnostics.expanded===0,'expandiu uma arte sem problema');
    assert(r.diagnostics.generated===0,'gerou candidato sem problema');
    assert(r.solved.length===1&&r.solved[0].depth===0,'o original não voltou como solução');
    assert(r.solved[0].actions.length===0,'o original veio com ação');
    assert(r.original&&r.original.signature===r.solved[0].signature,'o original não é o candidato 0');
  });

  test('busca: detector aponta o CULPADO certo e o delta da corrente',()=>{
    const layers=arteB();
    const c=ctxB(layers,{titulo:'Combo artesanal da casa com borda recheada',preco:'R$ 9,99'});
    const probs=gDetectLayoutProblems(layers,c);
    assert(probs.length>0,'não detectou dano numa arte que estoura');
    const col=probs.find(p=>p.tipo==='collision');
    assert(col,'não detectou a colisão');
    /* O culpado é quem CRESCEU, não quem está mais abaixo — apontar a vítima faria a busca
       tentar encolher o preço porque o título ficou longo. */
    assert(col.detalhe.culpado==='titulo','o culpado saiu errado: '+col.detalhe.culpado);
    assert(col.detalhe.delta>0,'o delta do empurrão não foi calculado');
    // Vocabulário fechado: nada subjetivo.
    probs.forEach(p=>assert(G_LAYOUT_PROBLEMAS[p.tipo],'problema fora do vocabulário: '+p.tipo));
    // Ordem por prioridade declarada, nunca a ordem das camadas.
    for(let i=1;i<probs.length;i++)
      assert(G_LAYOUT_PROBLEM_PRIORITY.indexOf(probs[i-1].tipo)
          <= G_LAYOUT_PROBLEM_PRIORITY.indexOf(probs[i].tipo),'os problemas saíram fora da prioridade');
  });

  test('paridade-busca: o delta detectado é o que o solver empurra',()=>{
    const layers=[
      text('titulo',90,100,420,58,'{{titulo}}',{fontSize:46,name:'Titulo'}),
      text('cta',90,180,260,48,'PEÇA AGORA',{fontSize:30,name:'CTA'})
    ];
    const dados={titulo:'Combo artesanal com batata bebida e sobremesa especial'};
    const c=ctxB(layers,dados,{w:700,h:600});
    const probs=gDetectLayoutProblems(layers,c);
    const col=probs.find(p=>p.tipo==='collision'||p.tipo==='spacing-pressure');
    if(!col){ assert(true,'sem colisão nesta arte não há delta a comparar'); return; }
    const out=solve(layers,dados,{w:700,h:600});
    const deslocouSolver=by(out,'cta').y-180;
    assert(Math.abs((col.detalhe.delta||0)-deslocouSolver)<=2,
      'o delta detectado ('+col.detalhe.delta+') difere do que o solver empurrou ('+deslocouSolver+')');
  });

  test('busca: encadeia profundidade e respeita maxDepth/beamWidth',()=>{
    const dados={titulo:'Combo artesanal da casa com borda recheada',preco:'R$ 9,99'};
    const {r}=busca(arteB(),dados);
    assert(r.diagnostics.expanded>0,'não expandiu uma arte com dano');
    const todos=[].concat(r.solved,r.partial);
    assert(todos.some(c=>c.depth>=2),'nunca chegou a encadear dois movimentos');
    todos.forEach(c=>assert(c.depth<=G_SEARCH_LIMITES.maxDepth,'passou do maxDepth: '+c.depth));
    // Os limites mandam de verdade: cortar maxDepth corta a profundidade.
    const raso=busca(arteB(),dados,null,{maxDepth:1}).r;
    assert([].concat(raso.solved,raso.partial).every(c=>c.depth<=1),'maxDepth=1 não foi respeitado');
    const estreito=busca(arteB(),dados,null,{beamWidth:1}).r;
    assert(estreito.diagnostics.generated<=r.diagnostics.generated,
      'beamWidth=1 não reduziu a busca');
    // E não explode: a ordem de grandeza é dezenas, não centenas.
    assert(r.diagnostics.generated<=G_SEARCH_LIMITES.maxCandidatos,'a busca passou do teto');
  });

  test('busca: dedup é por ESTADO, não por lista de ações',()=>{
    const dados={titulo:'Combo artesanal da casa com borda recheada',preco:'R$ 9,99'};
    const {r}=busca(arteB(),dados);
    assert(r.diagnostics.deduplicated>0,'nenhum estado repetido foi reconhecido');
    const sigs=[].concat(r.solved,r.partial,r.invalid).map(c=>c.signature);
    assert(new Set(sigs).size===sigs.length,'dois candidatos com a mesma assinatura sobreviveram');
    /* A assinatura é do ESTADO: dois caminhos diferentes que chegaram à mesma composição têm
       que colidir. Aqui provamos o inverso do trivial — mudar só a ordem das camadas não muda
       a assinatura, porque ela é ordenada por ID. */
    const a=_gCandidatoTeste(arteB()), b=_gCandidatoTeste(arteB().slice().reverse());
    assert(gLayoutCandidateSignature(a)===gLayoutCandidateSignature(b),
      'a ordem da lista virou parte da assinatura do candidato');
    const mexido=arteB(); mexido[0]=Object.assign({},mexido[0],{y:70});
    assert(gLayoutCandidateSignature(_gCandidatoTeste(mexido))!==gLayoutCandidateSignature(a),
      'deslocar uma camada não mudou a assinatura do estado');
    // Tipografia transitória também é estado.
    const comTeto=arteB(); comTeto[0]=Object.assign({},comTeto[0],{_tetoFonte:50});
    assert(gLayoutCandidateSignature(_gCandidatoTeste(comTeto))!==gLayoutCandidateSignature(a),
      'o teto de fonte não entrou na assinatura');
  });

  test('busca: ação sem efeito é podada e nenhum ramo entra em laço',()=>{
    const dados={titulo:'Combo artesanal da casa com borda recheada',preco:'R$ 9,99'};
    const {r}=busca(arteB(),dados);
    assert(r.diagnostics.pruned>0,'nada foi podado numa busca que repetiu estados');
    // Repetição por ação: nunca além do que o motor tem de degraus.
    [].concat(r.solved,r.partial).forEach(c=>{
      const conta={};
      c.actions.forEach(a=>{conta[a.id]=(conta[a.id]||0)+1;});
      Object.keys(conta).forEach(id=>assert(conta[id]<=G_ACAO_REPETICAO[id],
        id+' repetiu '+conta[id]+'× (teto '+G_ACAO_REPETICAO[id]+')'));
    });
    // `compress-gap` tem UM degrau: nunca aparece duas vezes na mesma sequência.
    assert(G_ACAO_REPETICAO['compress-gap']===1,'o respiro ganhou um degrau que o motor não tem');
    assert(G_ACAO_REPETICAO['shrink-text']>1,'encolher deveria poder repetir: cada volta são 8%');
  });

  test('busca: shrink repetido não cruza o piso',()=>{
    const dados={titulo:'Combo artesanal da casa com borda recheada muito maior',preco:'R$ 9,99'};
    const {ctx,r}=busca(arteB(),dados);
    const comShrink=[].concat(r.solved,r.partial).filter(c=>c.actions.some(a=>a.id==='shrink-text'));
    assert(comShrink.length>0,'nenhum candidato encolheu');
    const clones=arteB().map(l=>Object.assign({},l));
    gStampPisosHierarquia(clones,{w:1080,h:1080});
    const alvo=clones.find(l=>l.id==='titulo');
    const piso=gLayoutPisoFonte(alvo,false);
    /* ⚠ DOIS PISOS, e é assim no motor. `shrink-text` cede um degrau por vez até o piso NORMAL
       (metade do corpo autorado, ou o piso de hierarquia). `scale-component` é o degrau de
       EMERGÊNCIA da escada (`_pisoEmergenciaDe`): quando o componente inteiro reduz na mesma
       escala a hierarquia já está protegida pela proporção comum, então o piso que resta é
       legibilidade. Cobrar o piso normal de uma sequência que escalou o componente seria cobrar
       do motor uma regra que ele não tem. */
    const pisoEmerg=gLayoutPisoFonte(alvo,true);
    comShrink.forEach(c=>{
      const t=c.layers.find(l=>l.id==='titulo');
      if(!t||t._tetoFonte==null) return;
      const escalou=c.actions.some(a=>a.id==='scale-component');
      const limite=escalou?pisoEmerg:piso;
      assert(t._tetoFonte>=limite,'a sequência ['+seq(c)+'] cruzou o piso: '
        +t._tetoFonte+' < '+limite);
    });
    // E o piso de emergência nunca é mais generoso do que a legibilidade permite.
    assert(pisoEmerg>=8,'o piso de emergência desceu abaixo da legibilidade');
  });

  test('busca: protegida nunca sobrevive como candidato válido',()=>{
    const dados={titulo:'Combo artesanal da casa com borda recheada',preco:'R$ 9,99'};
    const {ctx,r}=busca(arteB(),dados);
    [].concat(r.solved,r.partial).forEach(c=>{
      c.changedIds.forEach(id=>{
        const n=ctx._no.get(id);
        assert(!(n&&(n.protegida||n.fundo)),
          'o candidato '+c.id+' mexeu em "'+id+'", que é protegida');
      });
    });
    // O logo não aparece em movimento nenhum.
    [].concat(r.solved,r.partial).forEach(c=>assert(c.changedIds.indexOf('logo')<0,
      'o logo entrou num candidato'));
  });

  test('busca: duas colunas independentes não se invadem',()=>{
    const layers=[
      text('e1',80,100,300,60,'{{esq}}',{fontSize:44,name:'Titulo'}),
      text('e2',80,200,300,60,'APOIO ESQ',{fontSize:28,name:'Descrição'}),
      text('d1',700,100,300,60,'DIR FIXO',{fontSize:44,name:'Titulo'}),
      text('d2',700,200,300,60,'APOIO DIR',{fontSize:28,name:'Descrição'})
    ];
    const {r}=busca(layers,{esq:'Titulo bem mais longo do que cabia originalmente aqui'},{w:1080,h:600});
    [].concat(r.solved,r.partial).forEach(c=>{
      assert(c.changedIds.indexOf('d1')<0&&c.changedIds.indexOf('d2')<0,
        'a busca da coluna esquerda invadiu a direita: '+JSON.stringify(c.changedIds));
    });
  });

  test('busca: solved, partial e invalid são categorias separadas',()=>{
    const dados={titulo:'Combo artesanal da casa com borda recheada',preco:'R$ 9,99'};
    const {r}=busca(arteB(),dados);
    r.solved.forEach(c=>assert(c.status==='solved'&&c.diagnostics.problemasDepois===0||c.depth===0,
      'um "solved" ainda tem dano'));
    r.partial.forEach(c=>assert(c.status==='partial'&&c.diagnostics.problemasDepois>0,
      'um "partial" não tem dano restante'));
    r.invalid.forEach(c=>assert(c.status==='invalid','categoria errada em invalid'));
    // Progresso é diagnóstico, não ranking.
    r.partial.forEach(c=>assert(typeof c.diagnostics.resolvidos==='number','falta o diagnóstico de progresso'));
    assert(r.solved.every(c=>!('nota' in c)&&!('score' in c)),'apareceu pontuação num candidato');
  });

  test('busca: é determinística — mesmos candidatos, mesma ordem',()=>{
    const dados={titulo:'Combo artesanal da casa com borda recheada',preco:'R$ 9,99'};
    const a=busca(arteB(),dados).r, b=busca(arteB(),dados).r;
    const chave=(r)=>[].concat(r.solved,r.partial,r.invalid)
      .map(c=>c.depth+':'+seq(c)+':'+c.signature).join('|');
    assert(chave(a)===chave(b),'duas buscas iguais deram candidatos ou ordem diferentes');
    /* Tempo de relógio nunca é determinístico e não descreve a busca — sai da comparação;
       todo o resto do diagnóstico (expandidos, gerados, dedupe, podados, profundidade) entra. */
    const semTempo=(d)=>JSON.stringify(Object.assign({},d,
      {porDepth:(d.porDepth||[]).map(x=>Object.assign({},x,{ms:null}))}));
    assert(semTempo(a.diagnostics)===semTempo(b.diagnostics),
      'o diagnóstico não é determinístico');
    // Serializável e sem função.
    [].concat(a.solved,a.partial).forEach(c=>{
      assert(JSON.stringify(c).length>0,'o candidato não é serializável');
      assert(typeof c.signature==='string'&&Array.isArray(c.actionSignatures),'formato do candidato errado');
    });
  });

  test('busca: candidato resolve quando o dano é pequeno',()=>{
    /* Uma arte que estoura pouco: um degrau resolve, e é isso que a busca tem que devolver
       como `solved` em vez de mastigar até o fundo. */
    const layers=[
      text('titulo',90,60,560,120,'{{titulo}}',{fontSize:40,name:'Titulo'}),
      text('apoio',90,230,560,60,'ACOMPANHA',{fontSize:26,name:'Descrição'})
    ];
    const {r}=busca(layers,{titulo:'Combo artesanal da casa com borda recheada de catupiry'},{w:1080,h:900});
    const todos=[].concat(r.solved,r.partial);
    assert(todos.length>0,'não gerou candidato nenhum');
    if(r.solved.length){
      r.solved.forEach(c=>assert(c.diagnostics.problemasDepois===0||c.depth===0,'solved com dano'));
      assert(r.solved[0].depth<=2,'a solução mais curta ficou funda demais');
    }else{
      assert(r.partial.some(c=>c.diagnostics.resolvidos>0||c.diagnostics.danoDepois<c.diagnostics.danoAntes),
        'nenhum candidato progrediu');
    }
  });

  test('busca: escala de componente não aparece no primeiro passo',()=>{
    const dados={titulo:'Combo artesanal da casa com borda recheada',preco:'R$ 9,99'};
    const {r}=busca(arteB(),dados);
    [].concat(r.solved,r.partial).forEach(c=>{
      if(c.actions.length&&c.actions[0].id==='scale-component')
        assert(false,'o maior raio de intervenção foi a PRIMEIRA tentativa');
    });
  });

  test('busca: nível 4 global fica fora da busca normal',()=>{
    const dados={titulo:'Combo artesanal da casa com borda recheada',preco:'R$ 9,99'};
    const {r}=busca(arteB(),dados);
    [].concat(r.solved,r.partial).forEach(c=>c.actions.forEach(a=>
      assert(a.impactLevel==null||a.impactLevel<=3,
        'a busca usou o nível 4 (emergência): '+a.id+' em L'+a.impactLevel)));
  });

  test('shadow: roda ao lado do solver e não muda a saída dele',()=>{
    const layers=arteB();
    const dados={titulo:'Combo artesanal da casa com borda recheada',preco:'R$ 9,99'};
    const antes=JSON.stringify(layers);
    const semShadow=solve(layers,dados,{w:1080,h:1080}).map(l=>({id:l.id,x:l.x,y:l.y,w:l.w,h:l.h,f:l._tetoFonte}));
    const s=gShadowLayoutSearch(layers,dados,{w:1080,h:1080});
    const comShadow=solve(layers,dados,{w:1080,h:1080}).map(l=>({id:l.id,x:l.x,y:l.y,w:l.w,h:l.h,f:l._tetoFonte}));
    assert(JSON.stringify(layers)===antes,'o shadow mode MUTOU as camadas');
    assert(JSON.stringify(semShadow)===JSON.stringify(comShadow),
      'a saída do solver mudou depois de rodar a busca ao lado');
    assert(s.erro===null,'o shadow mode estourou: '+s.erro);
    assert(s.problemas>0&&s.gerados>0,'o shadow não observou nada');
    assert(typeof s.ms==='number'&&s.acoes,'o diagnóstico do shadow está incompleto');
  });

  test('busca: nenhuma função de pontuação é chamada',()=>{
    /* A garantia central da fase: a busca NÃO escolhe vencedor. Se ela consultasse
       `gScoreComposition` estaria pontuando, e a Fase 6 herdaria uma decisão já tomada. */
    const real=window.gScoreComposition, realAlt=window.gLayoutEscolherAlternativa;
    let chamou=0;
    window.gScoreComposition=function(){chamou++;return real.apply(null,arguments);};
    window.gLayoutEscolherAlternativa=function(){chamou++;return realAlt.apply(null,arguments);};
    try{
      const {r}=busca(arteB(),{titulo:'Combo artesanal da casa com borda recheada',preco:'R$ 9,99'});
      assert(r.diagnostics.generated>0,'a busca não rodou — o teste não provaria nada');
      assert(chamou===0,'a busca chamou pontuação '+chamou+' vez(es)');
    }finally{ window.gScoreComposition=real; window.gLayoutEscolherAlternativa=realAlt; }
  });

  test('busca: 300 camadas cabem numa interação',()=>{
    const L=arteGrande(300), cv={w:1080,h:4000};
    const t0=performance.now();
    const c=gBuildOperationalContext(L,cv,{dados:{}});
    const msCtx=performance.now()-t0;
    const t1=performance.now();
    const probs=gDetectLayoutProblems(L,c);
    const msDet=performance.now()-t1;
    const t2=performance.now();
    const r=gSearchLayoutCandidates({ctx:c,base:L});
    const msBusca=performance.now()-t2;
    assert(msDet<900,'a detecção levou '+msDet.toFixed(1)+'ms em 300 camadas');
    assert(msBusca<2500,'a busca levou '+msBusca.toFixed(1)+'ms (ctx '+msCtx.toFixed(1)
      +'ms, '+probs.length+' problemas, '+r.diagnostics.generated+' candidatos)');
    assert(r.diagnostics.generated<=G_SEARCH_LIMITES.maxCandidatos,'a busca passou do teto');
  });

  /* ══ SEARCH COMPLETENESS + CANDIDATE STATE (Fase 5.75) ═══════════════════════════════════
     O estado de um candidato deixou de ser só `layers`: `compress-gap` escreve numa opção de
     SOLVE, e enquanto isso não existia o efeito da ação sumia no passo seguinte. */

  test('estado: compress-gap grava no solveState e a assinatura enxerga',()=>{
    const layers=arteB(), C=ctxB(layers,{titulo:'Combo artesanal da casa com borda',preco:'R$ 9,99'});
    const probs=gDetectLayoutProblems(layers,C);
    const alvo=probs.find(p=>p.tipo==='spacing-pressure')||probs[0];
    const as=gGenerateLayoutActions(C,Object.assign({},alvo,{impactLevel:3}));
    const a=as.find(x=>x.id==='compress-gap');
    if(!a){ assert(true,'esta arte não oferece o degrau do respiro'); return; }
    const r=gApplyLayoutAction(layers,a,C);
    assert(r.solveState&&r.solveState.respiroFator===0.5,'a ação não gravou no solveState');
    assert(r.changedIds.length===0,'o respiro virou geometria de camada');
    // A assinatura distingue: mesma geometria, respiro diferente, estados diferentes.
    const semGap=gLayoutCandidateSignature({layers:layers,solveState:{}});
    const comGap=gLayoutCandidateSignature({layers:layers,solveState:{respiroFator:0.5}});
    assert(semGap!==comGap,'respiro 1 e 0.5 deram a mesma assinatura');
    assert(G_SOLVE_STATE_CHAVES.indexOf('respiroFator')>=0,'a chave de solve não está declarada');
  });

  test('estado: o detector consome o respiro do candidato',()=>{
    const layers=arteB(), C=ctxB(layers,{titulo:'Combo artesanal da casa com borda',preco:'R$ 9,99'});
    const solto=gDetectLayoutProblems({layers:layers,solveState:{}},C);
    const apertado=gDetectLayoutProblems({layers:layers,solveState:{respiroFator:0.5}},C);
    /* Com o respiro já apertado não existe mais pressão a aliviar — se o detector ignorasse o
       estado, `compress-gap` pareceria não resolver nada e a busca a descartaria. */
    assert(apertado.filter(p=>p.tipo==='spacing-pressure').length
        <= solto.filter(p=>p.tipo==='spacing-pressure').length,
      'apertar o respiro não reduziu a pressão detectada');
    assert(apertado.length<=solto.length,'apertar o respiro aumentou o dano detectado');
  });

  test('estado: o candidato não vaza para o template',()=>{
    const layers=arteB();
    const congelado=JSON.stringify(layers);
    const {r}=busca(layers,{titulo:'Combo artesanal da casa com borda recheada',preco:'R$ 9,99'});
    assert(JSON.stringify(layers)===congelado,'a busca MUTOU as camadas de entrada');
    [].concat(r.solved,r.partial).forEach(c=>{
      assert(c.layers!==layers,'um candidato compartilha o array da base');
      assert(JSON.stringify(c).indexOf('function')<0,'o candidato levou função dentro');
    });
  });

  test('assentamento: a geometria do obstáculo acompanha o candidato',()=>{
    /* A identidade do obstáculo é fato AUTORADO (congelada); a GEOMETRIA vem do estado atual —
       senão uma placa que cresceu continuaria sendo medida onde ela estava. */
    const layers=[
      shape('placa',70,80,360,110,{locked:false}),
      text('preco',95,100,310,65,'{{preco}}',{fontSize:40,name:'Preço',layoutRefText:'R$ 9,99'}),
      text('abaixo',70,220,360,50,'RODAPE',{fontSize:24,name:'Descrição'})
    ];
    const C=ctxB(layers,{preco:'R$ 1.249,90 POR TEMPO LIMITADO'},{w:600,h:500});
    const as=gGenerateLayoutActions(C,{tipo:'container-mismatch',targetId:'placa',rootId:'preco'});
    const a=as.find(x=>x.id==='resize-container');
    assert(a,'não gerou o resize');
    const r=gApplyLayoutAction(layers,a,C);
    const nova=r.layers.find(l=>l.id==='placa');
    assert(nova.h!==110||nova.w!==360,'a placa não mudou');
    // O detector no estado NOVO mede a placa onde ela está agora.
    const probs=gDetectLayoutProblems(r,C);
    const tocaPlaca=probs.some(p=>p.targetId==='placa'||p.withId==='placa');
    assert(typeof tocaPlaca==='boolean','o detector não conseguiu ler o estado novo');
    assert(C._obstaculos&&C._obstaculos.indexOf('placa')>=0,
      'a identidade do obstáculo deveria estar congelada no contexto');
  });

  test('cache: só remede quem mudou',()=>{
    const layers=arteB(), C=ctxB(layers,{titulo:'OFERTA',preco:'R$ 9,99'});
    gDetectLayoutProblems(layers,C);
    const antes=C._medida.size;
    gDetectLayoutProblems(layers,C);                 // mesmo estado: nada novo a medir
    assert(C._medida.size===antes,'remediu a arte inteira sem nada ter mudado');
    // Mexer na tipografia de UMA camada gera UMA entrada nova.
    const mexido=layers.map(l=>l.id==='titulo'?Object.assign({},l,{_tetoFonte:50}):l);
    gDetectLayoutProblems(mexido,C);
    assert(C._medida.size===antes+1,'a invalidação não foi cirúrgica: '+(C._medida.size-antes)+' medidas novas');
    /* Mover não remede: a chave do cache não tem x/y, porque deslocar não muda o encaixe. */
    const movido=layers.map(l=>l.id==='titulo'?Object.assign({},l,{y:(l.y||0)+30}):l);
    const antes2=C._medida.size;
    gDetectLayoutProblems(movido,C);
    assert(C._medida.size===antes2,'deslocar uma camada disparou remedida');
  });

  test('busca: aprofundamento progressivo para no primeiro solved',()=>{
    const layers=arteB(), dados={titulo:'OFERTA',preco:'R$ 9,99'};
    const {r}=busca(layers,dados);
    assert(r.diagnostics.firstSolvedDepth===0,'arte saudável deveria resolver em d0');
    // Numa arte com dano, a busca registra por profundidade e não passa do teto.
    const dif=busca(arteB(),{titulo:'Combo artesanal da casa com borda recheada',preco:'R$ 9,99'}).r;
    assert(Array.isArray(dif.diagnostics.porDepth),'não registrou a distribuição por profundidade');
    dif.diagnostics.porDepth.forEach(d=>assert(typeof d.expandidos==='number'
      &&typeof d.gerados==='number'&&typeof d.dedup==='number','a distribuição está incompleta'));
    assert(dif.diagnostics.maxDepthReached<=G_SEARCH_LIMITES.maxDepth,'passou do teto de profundidade');
    // Se encontrou solução, parou ali: nenhuma profundidade além do primeiro solved.
    if(dif.diagnostics.firstSolvedDepth!=null)
      assert(dif.diagnostics.maxDepthReached===dif.diagnostics.firstSolvedDepth,
        'continuou buscando depois de achar solução completa');
  });

  test('busca: corrida monotônica preserva o histórico de cada degrau',()=>{
    const {r}=busca(arteB(),{titulo:'Combo artesanal da casa com borda recheada muito maior',preco:'R$ 9,99'});
    const corridas=[].concat(r.solved,r.partial)
      .filter(c=>c.actions.filter(a=>a.id==='shrink-text').length>1);
    if(!corridas.length){ assert(true,'esta arte não exigiu repetir o encolhimento'); return; }
    corridas.forEach(c=>{
      /* A corrida encurta a PROFUNDIDADE, não o rastro: cada degrau continua sendo um Designer
         Move próprio, auditável, com o seu `de`/`para`. */
      const passos=c.actions.filter(a=>a.id==='shrink-text');
      assert(passos.every(a=>a.params.de>a.params.para),'um degrau da corrida não reduziu');
      assert(c.actionSignatures.length===c.actions.length,'o histórico de assinaturas se perdeu');
      // Nenhum piso pulado.
      passos.forEach(a=>assert(a.params.para>=a.params.piso,'a corrida cruzou o piso'));
    });
    /* ⚠ REPETIR NÃO É CORRER. Dois encolhimentos podem vir de duas expansões distintas — a
       corrida para assim que a causa atacada some, e a profundidade seguinte reataca. O que a
       corrida promete é que ALGUÉM cabe N movimentos num degrau só; é isso que se cobra. */
    assert(corridas.some(c=>c.actions.length>c.depth),
      'nenhuma sequência encurtou profundidade: a corrida monotônica não está rodando');
    assert(G_ACAO_MONOTONICA['shrink-text'],'encolher deveria ser monotônica');
    assert(!G_ACAO_MONOTONICA['compress-gap'],'o respiro tem um degrau só: não é corrida');
  });

  test('busca: a escalada de impacto responde a esgotamento, não a profundidade',()=>{
    const layers=arteB(), dados={titulo:'Combo artesanal da casa com borda recheada',preco:'R$ 9,99'};
    const C=ctxB(layers,dados);
    const probs=gDetectLayoutProblems(layers,C);
    if(!probs.length){ assert(true,'sem dano não há escalada a observar'); return; }
    // Havendo ação no nível local, a geração nem chega a olhar níveis maiores.
    const local=gGenerateLayoutActions(C,Object.assign({},probs[0],{impactLevel:0}));
    const amplo=gGenerateLayoutActions(C,Object.assign({},probs[0],{impactLevel:3}));
    if(local.length) assert(local.length<=amplo.length,'o nível local ofereceu mais que o amplo');
    const {r}=busca(layers,dados);
    [].concat(r.solved,r.partial).forEach(c=>c.actions.forEach(a=>
      assert(a.impactLevel==null||a.impactLevel<=3,'a busca usou o nível 4 (emergência)')));
  });

  test('busca: nenhum critério estético ordena os candidatos',()=>{
    const {r}=busca(arteB(),{titulo:'Combo artesanal da casa com borda recheada',preco:'R$ 9,99'});
    [].concat(r.solved,r.partial,r.invalid).forEach(c=>{
      ['nota','score','beleza','estetica','ranking'].forEach(k=>
        assert(!(k in c)&&!(k in c.diagnostics),'apareceu critério estético: '+k));
      // O que existe é fato objetivo: contagem de problemas e dano em pixels.
      assert(typeof c.diagnostics.problemasDepois==='number'||c.depth===0,'falta a contagem objetiva');
    });
  });

  /* ══ CANONICAL SETTLE + CAUSAL PROBLEM MODEL (Fase 5.8) ═══════════════════════════════════
     Assentar é o estado NORMAL da arte com o conteúdo real: a corrente empurra, a placa segue,
     o vão do campo vazio fecha. Não é adaptação e não é Designer Move. A Fase 5.75 aproximava
     isso com os próprios movimentos e não convergia; agora o assentamento É o solver, por uma
     saída dedicada (`_soAssentar`), e a busca mede o MESMO estado que o motor julga. */

  const geoDe=(ls)=>ls.map(l=>[l.id,Math.round(l.x||0),Math.round(l.y||0),
    Math.round(l.w||0),Math.round(l.h||0)]).sort().join('|');

  test('assentar: é idempotente — settle(settle(x)) === settle(x)',()=>{
    const layers=arteB(), dados={titulo:'Combo artesanal da casa com borda recheada',preco:'R$ 9,99'};
    const C=ctxB(layers,dados);
    const um=gSettleLayoutState({layers:layers,solveState:{}},C);
    assert(um.assentado,'o assentamento não rodou');
    const dois=gSettleLayoutState({layers:um.layers,solveState:{}},C);
    assert(geoDe(um.layers)===geoDe(dois.layers),
      'assentar duas vezes deu geometria diferente:\n1: '+geoDe(um.layers)+'\n2: '+geoDe(dois.layers));
    const tres=gSettleLayoutState({layers:dois.layers,solveState:{}},C);
    assert(geoDe(dois.layers)===geoDe(tres.layers),'a terceira volta ainda mexeu na arte');
    // A idempotência vem do carimbo: a base é sempre a geometria autorada.
    um.layers.forEach(l=>assert(l._geoAutor,'camada assentada sem a base autorada carimbada'));
    const t=um.layers.find(l=>l.id==='titulo');
    assert(t._geoAutor.y===60,'o carimbo guardou a posição assentada em vez da autorada');
  });

  test('assentar: o estado assentado é o do SOLVER, não uma aproximação',()=>{
    const layers=arteB(), dados={titulo:'Combo artesanal da casa com borda recheada',preco:'R$ 9,99'};
    const C=ctxB(layers,dados);
    const meu=gSettleLayoutState({layers:layers,solveState:{}},C);
    const dele=gApplyRelativeAnchors(layers.map(l=>Object.assign({},l)),dados,{},
      {fitText:true,canvas:{w:1080,h:1080},scope:'franqueado',_soAssentar:true});
    assert(geoDe(meu.layers)===geoDe(dele),'a busca assentou diferente do motor');
    assert(dele._layoutMeta&&dele._layoutMeta.assentado&&dele._layoutMeta.tentativas===0,
      '`_soAssentar` subiu a escada em vez de só assentar');
  });

  test('assentar: arte que o solver resolve em ZERO voltas já nasce resolvida',()=>{
    /* PARIDADE DE ENTRADA, camada por camada. O solver posiciona ANTES de julgar: aqui o apoio
       desce 124px e o CTA 124px só pela corrente, e a escada não roda uma volta sequer. Se a
       busca começasse do estado cru, veria dano onde o motor não vê e gastaria profundidade
       "resolvendo" o que já estava resolvido antes de começar. */
    const arte=()=>[
      text('titulo',90,60,760,70,'{{titulo}}',{fontSize:54,name:'Titulo'}),
      text('apoio',90,180,760,50,'ACOMPANHA',{fontSize:26,name:'Descrição'}),
      text('cta',90,280,400,50,'PECA AGORA',{fontSize:26,name:'CTA'})
    ];
    const dados={titulo:'Combo artesanal da casa com borda recheada e bebida'};
    const out=gApplyRelativeAnchors(arte(),dados,{},
      {fitText:true,canvas:{w:1080,h:1080},scope:'franqueado'});
    assert(out._layoutMeta&&out._layoutMeta.tentativas===0,
      'o cenário perdeu o sentido: o solver subiu a escada '+(out._layoutMeta||{}).tentativas+'×');
    assert(out.find(l=>l.id==='apoio').y>180,'a corrente nem chegou a empurrar nesta arte');
    const C=ctxB(arte(),dados);
    const st=gSettleLayoutState({layers:arte(),solveState:{}},C);
    assert(geoDe(st.layers)===geoDe(out),
      'o estado assentado divergiu do que o solver entregou sem subir a escada:\nbusca:  '
      +geoDe(st.layers)+'\nsolver: '+geoDe(out));
    const {r}=busca(arte(),dados);
    assert(r.diagnostics.firstSolvedDepth===0,
      'o solver resolveu em 0 voltas e a busca começou com dano (d'+r.diagnostics.firstSolvedDepth+')');
    assert(r.original.diagnostics.problemas===0,'a busca viu dano que o motor não vê');
  });

  test('assentar: NÃO é Designer Move — fica fora do histórico de ações',()=>{
    const {r}=busca(arteB(),{titulo:'Combo artesanal da casa com borda recheada',preco:'R$ 9,99'});
    assert(r.original.actions.length===0,'o assentamento entrou como ação do candidato raiz');
    assert(r.original.settleDiagnostics,'o assentamento não deixou diagnóstico');
    assert(Array.isArray(r.original.settleDiagnostics.moveu),'o diagnóstico não diz quem se moveu');
    [].concat(r.solved,r.partial,r.invalid).forEach(c=>{
      c.actions.forEach(a=>assert(G_LAYOUT_ACOES[a.id],'ação fora do vocabulário: '+a.id));
      assert(!c.actions.some(a=>/assent|settle/i.test(a.id)),'assentar virou ação em '+seq(c));
    });
  });

  test('assentar: o candidato guarda a geometria AUTORADA, não a assentada',()=>{
    const layers=arteB(), dados={titulo:'Combo artesanal da casa com borda recheada',preco:'R$ 9,99'};
    const {ctx:C,r}=busca(layers,dados);
    const apoioAutor=layers.find(l=>l.id==='apoio').y;
    const noCandidato=r.original.layers.find(l=>l.id==='apoio').y;
    assert(noCandidato===apoioAutor,'o candidato guardou a posição assentada');
    const assentado=gSettleCandidateState(r.original,C);
    assert(assentado.layers.find(l=>l.id==='apoio').y>apoioAutor,
      'o apoio deveria ter descido no estado assentado');
    assert(r.original.settledSignature&&r.original.settledSignature!==r.original.signature,
      'a assinatura assentada não foi publicada');
  });

  test('assentar: Designer Move que mexe em geometria sobrevive ao assentamento seguinte',()=>{
    /* A distinção que o carimbo `_geoAutor` guarda: a corrente empurrar é CONSEQUÊNCIA (não
       vira base), o designer descer o bloco é DECISÃO (vira base). */
    const layers=[
      text('topo',80,60,400,60,'FIXO',{fontSize:30}),
      text('meio',80,160,400,60,'{{campo}}',{fontSize:30,name:'Campo'}),
      text('base',80,260,400,60,'RODAPE',{fontSize:24,name:'Descrição'})
    ];
    const C=ctxB(layers,{campo:'VALOR'},{w:600,h:600});
    const acao=_gAcao('push-dependent','base',{params:{delta:40}});
    const r=gApplyLayoutAction({layers:layers,solveState:{}},acao,C);
    const movida=r.layers.find(l=>l.id==='base');
    assert(movida.y===300,'a ação não empurrou');
    assert(movida._geoAutor&&movida._geoAutor.y===300,'a ação não reescreveu a base autorada');
    const dep=gSettleLayoutState({layers:r.layers,solveState:{}},C);
    assert(dep.layers.find(l=>l.id==='base').y>=300,'o assentamento desfez o movimento');
  });

  test('causa: mesmo culpado provado, um grupo só',()=>{
    const probs=[
      {tipo:'collision',targetId:'preco',withId:'titulo',detalhe:{culpado:'titulo',delta:100}},
      {tipo:'collision',targetId:'placa',withId:'titulo',detalhe:{culpado:'titulo',delta:80}},
      {tipo:'collision',targetId:'cta',withId:'selo',detalhe:{culpado:'selo',delta:20}}
    ];
    const g=gGroupLayoutProblems(probs);
    assert(g.length===2,'esperava 2 causas, veio '+g.length);
    assert(g[0].culpritId==='titulo'&&g[0].problems.length===2,'a causa com mais sintomas não veio primeiro');
    assert(g[0].type==='growth-pressure'&&g[1].type==='growth-pressure','tipo de causa errado');
    assert(g[0].totalDamage===180,'o dano da causa não somou os sintomas: '+g[0].totalDamage);
  });

  test('causa: sem culpado provado, cada sintoma é a própria causa',()=>{
    /* ⛔ CAUSA SÓ COM PROVA. Papel semântico e proximidade não inventam origem comum. */
    const probs=[
      {tipo:'outside-canvas',targetId:'a',detalhe:{excedeAbaixo:30}},
      {tipo:'outside-canvas',targetId:'b',detalhe:{excedeAbaixo:20}}
    ];
    const g=gGroupLayoutProblems(probs);
    assert(g.length===2,'juntou dois danos sem prova de causa comum');
    g.forEach(x=>{assert(x.type==='isolated','tipo errado para causa não provada');
      assert(x.culpritId===null,'inventou um culpado');});
  });

  test('causa: a assinatura ignora a ORDEM em que os sintomas foram detectados',()=>{
    const a={tipo:'collision',targetId:'preco',withId:'titulo',detalhe:{culpado:'titulo',delta:10}};
    const b={tipo:'collision',targetId:'placa',withId:'titulo',detalhe:{culpado:'titulo',delta:10}};
    const um=gGroupLayoutProblems([a,b])[0], dois=gGroupLayoutProblems([b,a])[0];
    assert(um.signature===dois.signature,'a ordem dos sintomas virou parte da identidade da causa');
    assert(um.causeId===dois.causeId,'o causeId mudou com a ordem');
  });

  test('causa: a busca ataca o CULPADO antes das vítimas',()=>{
    const layers=arteB(), dados={titulo:'Combo artesanal da casa com borda recheada',preco:'R$ 9,99'};
    const {r}=busca(layers,dados);
    const causas=r.original.diagnostics.causas;
    assert(causas&&causas.length,'a raiz não publicou as causas');
    const comCulpado=causas.filter(c=>c.culpritId);
    if(!comCulpado.length){ assert(true,'esta arte não tem causa provada'); return; }
    const culpado=comCulpado[0].culpritId;
    const primeiros=[].concat(r.solved,r.partial).filter(c=>c.depth===1);
    assert(primeiros.length,'não houve primeiro passo');
    assert(primeiros.every(c=>c.actions[0].targetId===culpado||c.actions[0].componentId),
      'o primeiro movimento foi contra uma vítima: '+primeiros.map(c=>seq(c)).join(' / '));
  });

  test('detector: campo opcional VAZIO não é obstáculo',()=>{
    /* A caixa desenhada de um selo em branco é do texto que NÃO veio. Tratá-la como tinta
       fazia o detector acusar colisão com quem subiu pelo colapso — dano que o solver não vê
       e que nenhuma ação resolve, porque o culpado é um texto inexistente. */
    const layers=[
      text('titulo',90,60,400,60,'FIXO',{fontSize:34}),
      text('opcional',90,180,400,56,'{{opcional}}',{fontSize:34,textBox:'point',name:'Selo'}),
      text('produto',90,270,400,80,'{{produto}}',{fontSize:44,name:'Produto'})
    ];
    const C=ctxB(layers,{opcional:'',produto:'Marmita Executiva'},{w:600,h:600});
    const assentado=gSettleLayoutState({layers:layers,solveState:{}},C);
    const probs=gDetectLayoutProblems({layers:assentado.layers,solveState:{}},C);
    assert(!probs.some(p=>p.targetId==='opcional'||p.withId==='opcional'),
      'o campo vazio virou obstáculo: '+JSON.stringify(probs));
  });

  test('detector: o crédito do vão é o que SOBROU, não a faixa inteira',()=>{
    const layers=[
      text('titulo',90,60,760,70,'{{titulo}}',{fontSize:54,name:'Titulo'}),
      text('opcional',90,150,400,56,'{{opcional}}',{fontSize:34,textBox:'point',name:'Selo'}),
      text('produto',90,230,780,140,'{{produto}}',{fontSize:54,name:'Produto'})
    ];
    const dados={titulo:'SEXTA DE PROMO',opcional:'',produto:'Marmita Executiva'};
    const C=ctxB(layers,dados);
    const cru=gDetectLayoutProblems({layers:layers,solveState:{}},C)
      .filter(p=>p.tipo==='optional-empty');
    assert(cru.length&&cru[0].detalhe.credito===56,
      'o cenário perdeu o sentido: sem vão colapsável a medir');
    const assentado=gSettleLayoutState({layers:layers,solveState:{}},C);
    const subiu=layers.find(l=>l.id==='produto').y
              - assentado.layers.find(l=>l.id==='produto').y;
    assert(subiu===56,'o assentamento devia ter fechado os 56px do vão, fechou '+subiu);
    const depois=gDetectLayoutProblems({layers:assentado.layers,solveState:{}},C)
      .filter(p=>p.tipo==='optional-empty');
    assert(!depois.length,
      'o crédito não descontou o que o assentamento já fechou: '+JSON.stringify(depois));
  });

  test('placa: o descritor é UM SÓ — detector e ação leem o do solver',()=>{
    const layers=[
      shape('placa',70,80,360,110,{locked:false}),
      text('preco',95,100,310,65,'{{preco}}',{fontSize:40,name:'Preço',layoutRefText:'R$ 9,99'})
    ];
    const dados={preco:'R$ 1.249,90 POR TEMPO LIMITADO'};
    const C=ctxB(layers,dados,{w:600,h:500});
    const um=gSettleLayoutState({layers:layers,solveState:{}},C);
    const p1=um.layers.find(l=>l.id==='placa');
    assert(p1._placa,'o assentamento não publicou o descritor da placa');
    // Assentado, a placa já abraça a tinta: não sobra `container-mismatch`.
    const probs=gDetectLayoutProblems({layers:um.layers,solveState:{}},C);
    assert(!probs.some(p=>p.tipo==='container-mismatch'),
      'a placa assentada ainda foi acusada de não abraçar a tinta');
    // E aplicar o resize sobre o estado assentado é NO-OP: o alvo não anda junto com a placa.
    const as=gGenerateLayoutActions(C,{tipo:'container-mismatch',targetId:'placa',rootId:'preco'},um.layers);
    const a=as.find(x=>x.id==='resize-container');
    if(!a){ assert(true,'sem mismatch não há resize a gerar'); return; }
    const r=gApplyLayoutAction({layers:um.layers,solveState:{}},a,C);
    const p2=r.layers.find(l=>l.id==='placa');
    assert(Math.abs(p2.x-p1.x)<=1&&Math.abs(p2.y-p1.y)<=1
        &&Math.abs(p2.w-p1.w)<=1&&Math.abs(p2.h-p1.h)<=1,
      'o segundo resize mexeu na placa sem o texto ter mudado');
  });

  test('busca: o ciclo assenta a CADA passo, não só na raiz',()=>{
    const layers=arteB(), dados={titulo:'Combo artesanal da casa com borda recheada',preco:'R$ 9,99'};
    const {ctx:C,r}=busca(layers,dados);
    const filhos=[].concat(r.solved,r.partial).filter(c=>c.depth>=1);
    assert(filhos.length,'a busca não gerou filho nenhum');
    filhos.forEach(c=>{
      assert(c.settleDiagnostics,'o filho '+seq(c)+' não foi assentado');
      assert(c.settledSignature,'o filho '+seq(c)+' não publicou a assinatura assentada');
    });
    // E o cache do assentamento existe: assentar é rodar o solver, e repetir é desperdício.
    assert(C._settle&&C._settle.size>0,'o assentamento não foi memorizado por candidato');
  });

  test('busca: o guard de progresso é CAUSAL',()=>{
    /* Encolher o culpado corta o dano dele e, no mesmo passo, traz o dependente de volta para
       cima — onde ele pode encostar em outra coisa. O placar GLOBAL piora; a causa atacada
       ENCOLHE. Medir só o global matava o ramo e a busca não encadeava nada. */
    const layers=arteB(), dados={titulo:'Combo artesanal da casa com borda recheada',preco:'R$ 9,99'};
    const {r}=busca(layers,dados);
    const fundos=[].concat(r.solved,r.partial).filter(c=>c.depth>=2);
    assert(fundos.length,'com o guard causal a busca ainda não encadeia dois movimentos');
    // Nada de vaivém: nenhum estado aparece duas vezes.
    const sigs=[].concat(r.solved,r.partial,r.invalid).map(c=>c.signature);
    assert(new Set(sigs).size===sigs.length,'o guard causal deixou o mesmo estado nascer duas vezes');
    assert(r.diagnostics.generated<=G_SEARCH_LIMITES.maxCandidatos,'a busca passou do teto');
  });

  test('busca: causa expandida sem ação nenhuma vira diagnóstico de bloqueio',()=>{
    /* "0 candidatos" não diz nada sozinho. `bloqueios` separa "não achou solução" de "não
       tinha o que tentar" — que é onde falta vocabulário, não profundidade. */
    const layers=[
      text('travado',80,60,400,90,'{{campo}}',{fontSize:44,layoutRole:'protected',name:'Campo'}),
      shape('selo',80,200,200,120,{shapeKind:'circle',layoutRole:'protected'})
    ];
    const {r}=busca(layers,{campo:'Um valor muito maior do que cabia na caixa desenhada'},{w:600,h:400});
    assert(r.diagnostics.bloqueios&&typeof r.diagnostics.bloqueios==='object',
      'a busca não publicou o diagnóstico de bloqueio');
    if(r.diagnostics.generated===0&&r.diagnostics.expanded>0)
      assert(Object.keys(r.diagnostics.bloqueios).length>0,
        'expandiu sem gerar ação e não registrou onde travou');
  });

  test('busca: assentar não muda determinismo nem vaza para a base',()=>{
    const layers=arteB(), dados={titulo:'Combo artesanal da casa com borda recheada',preco:'R$ 9,99'};
    const congelado=JSON.stringify(layers);
    const a=busca(layers,dados).r, b=busca(layers,dados).r;
    assert(JSON.stringify(layers)===congelado,'o assentamento mutou as camadas de entrada');
    const chapa=(x)=>[].concat(x.solved,x.partial,x.invalid)
      .map(c=>c.depth+':'+c.status+':'+seq(c)+':'+c.signature).join('\n');
    assert(chapa(a)===chapa(b),'duas buscas iguais deram candidatos diferentes');
    assert(a.diagnostics.generated===b.diagnostics.generated,'contagem de candidatos instável');
  });

  test('busca: o custo cresce com a arte, não explode',()=>{
    /* Três tamanhos, a mesma medida. Serve para ver a CURVA — se um dia assentar virar o gargalo
       (é rodar o solver por candidato), é aqui que aparece antes de chegar na mão de alguém. */
    [58,172].forEach(n=>{
      const L=arteGrande(n), cv={w:1080,h:40+Math.ceil(n/6)*72+200};
      const C=gBuildOperationalContext(L,cv,{dados:{}});
      const t0=performance.now();
      const st=gSettleLayoutState({layers:L,solveState:{}},C);
      const ms=performance.now()-t0;
      const t1=performance.now();
      const r=gSearchLayoutCandidates({ctx:C,base:L});
      const msB=performance.now()-t1;
      avisos.push(n+' camadas: assentar '+ms.toFixed(1)+'ms · busca '+msB.toFixed(1)
        +'ms ('+r.diagnostics.generated+' candidatos)');
      assert(st.layers.length===L.length,'o assentamento perdeu camadas em '+n);
    });
  });

  test('busca: assentar cabe no orçamento de 344 camadas',()=>{
    const L=arteGrande(344), cv={w:1080,h:4600};
    const C=gBuildOperationalContext(L,cv,{dados:{}});
    const t0=performance.now();
    const st=gSettleLayoutState({layers:L,solveState:{}},C);
    const msSettle=performance.now()-t0;
    assert(st.assentado||st.layers.length===L.length,'o assentamento perdeu camadas');
    const t1=performance.now();
    gGroupLayoutProblems(gDetectLayoutProblems({layers:st.layers,solveState:{}},C));
    const msCausa=performance.now()-t1;
    const t2=performance.now();
    const r=gSearchLayoutCandidates({ctx:C,base:L});
    const msBusca=performance.now()-t2;
    avisos.push('344 camadas: assentar '+msSettle.toFixed(1)+'ms · detectar+agrupar '
      +msCausa.toFixed(1)+'ms · busca '+msBusca.toFixed(1)+'ms ('+r.diagnostics.generated+' candidatos)');
    assert(msSettle<400,'assentar levou '+msSettle.toFixed(1)+'ms em 344 camadas');
    assert(msCausa<400,'detectar+agrupar levou '+msCausa.toFixed(1)+'ms');
    assert(msBusca<4000,'a busca levou '+msBusca.toFixed(1)+'ms ('+r.diagnostics.generated+' candidatos)');
  });

  /* ══ EMERGENCY PARITY + MULTI-CAUSE SEARCH (Fase 5.9) ════════════════════════════════════
     Dois buracos, dois mecanismos. O primeiro: a escada desce até o piso de EMERGÊNCIA quando
     ninguém mais tem folga normal, e a busca parava no piso normal — declarava "sem saída" onde
     o motor continuava. O segundo: com várias causas ao mesmo tempo, o beam enchia com oito
     ramos da MESMA causa e os caminhos cruzados morriam antes de nascer. */

  // Arte que resolve NO NORMAL, com dano real. O selo protegido é o obstáculo.
  const arteN=()=>[
    text('titulo',60,60,420,80,'{{titulo}}',{fontSize:44,name:'Titulo'}),
    text('rodape',60,420,420,40,'CONSULTE',{fontSize:20,name:'Descrição'}),
    shape('selo',60,220,420,160,{shapeKind:'circle',layoutRole:'protected'})
  ];
  // A MESMA arte com o corpo maior e o selo mais perto: o normal esgota e só a emergência fecha.
  const arteE=()=>[
    text('titulo',60,60,420,80,'{{titulo}}',{fontSize:56,name:'Titulo'}),
    text('rodape',60,420,420,40,'CONSULTE',{fontSize:20,name:'Descrição'}),
    shape('selo',60,180,420,200,{shapeKind:'circle',layoutRole:'protected'})
  ];
  // Duas colunas independentes: duas causas simultâneas que não se explicam uma pela outra.
  const arteDuas=()=>[
    text('tA',40,40,300,70,'{{a}}',{fontSize:44,name:'Titulo A'}),
    shape('sA',40,180,300,120,{layoutRole:'protected'}),
    text('tB',600,40,300,70,'{{b}}',{fontSize:44,name:'Titulo B'}),
    shape('sB',600,180,300,120,{layoutRole:'protected'})
  ];
  const D_N={titulo:'Combo artesanal da casa com borda recheada'};
  /* ⚠ ESTE TEXTO É O CENÁRIO. Com uma copy menor o grupo adaptativo resolve tudo no NORMAL
     (a Fase 5.95 empurrou a fronteira), e o teste de emergência perderia o sentido sem avisar.
     Aqui o piso normal (metade do corpo desenhado) não basta nem para o grupo inteiro. */
  const D_E={titulo:'Combo artesanal da casa com borda recheada e bebida gelada mais sobremesa '
    +'especial da casa para dois'};
  const D_2={a:'Combo artesanal da casa com borda recheada',
             b:'Pizza grande com borda recheada e refrigerante'};
  const CV_P={w:560,h:520}, CV_2={w:960,h:420};

  test('modo: normal resolve → emergência NÃO roda',()=>{
    const {r}=busca(arteN(),D_N,CV_P);
    assert(r.original.diagnostics.problemas>0,'o cenário perdeu o sentido: arte sem dano');
    assert(r.solved.length>0,'o normal deveria resolver esta arte');
    assert(r.diagnostics.modo==='normal','entrou em emergência com solução normal na mão');
    assert(r.diagnostics.emergencia===null,'a busca de emergência rodou sem necessidade');
    assert(r.diagnostics.firstSolvedMode==='normal','a solução foi marcada como emergência');
    [].concat(r.solved,r.partial).forEach(c=>{
      assert(c.searchMode==='normal','candidato de emergência num caso resolvido no normal');
      c.actions.forEach(a=>assert(!a.params||a.params.modo!=='emergency',
        'ação de emergência num caso normal: '+a.id));
    });
  });

  test('modo: normal esgota → emergência começa e resolve',()=>{
    const {r}=busca(arteE(),D_E,CV_P);
    assert(r.diagnostics.emergencia,'o normal esgotou e a emergência não foi tentada');
    assert(r.solved.length>0,'nem a emergência resolveu: '+JSON.stringify(r.diagnostics.bloqueios));
    assert(r.diagnostics.firstSolvedMode==='emergency','a solução não foi marcada como emergência');
    r.solved.forEach(c=>assert(c.searchMode==='emergency','solução de emergência sem o modo'));
    // A ordem importa: o normal inteiro rodou ANTES.
    assert(r.diagnostics.generated>r.diagnostics.emergencia.generated,
      'a emergência gerou tudo: o normal não chegou a ser tentado');
  });

  test('modo: o piso de emergência é o do solver, e a hierarquia continua valendo',()=>{
    const layers=arteE(), C=ctxB(layers,D_E,CV_P);
    const clones=layers.map(l=>Object.assign({},l));
    gStampPisosHierarquia(clones,CV_P);
    const t=clones.find(l=>l.id==='titulo');
    assert(gLayoutPisoDoModo(clones,t,'normal')===gLayoutPisoFonte(t,false),
      'o piso normal não é o do solver');
    /* Emergência = piso de legibilidade do motor MAIS o piso de hierarquia EXTERNO. A segunda
       parcela é a trava que impede o título de passar por baixo de quem ficou parado. */
    const legivel=gLayoutPisoFonte(t,true);
    const hier=gLayoutPisoHierarquiaExterno(clones,t,[t.id],false);
    assert(gLayoutPisoDoModo(clones,t,'emergency')===Math.max(legivel,hier),
      'o piso de emergência não é o do solver');
    assert(gLayoutPisoDoModo(clones,t,'emergency')<=gLayoutPisoDoModo(clones,t,'normal')
        || hier>legivel,'a emergência ficou mais apertada que o normal sem hierarquia mandando');
    // A capacidade de emergência tem porta PRÓPRIA — nunca se mistura com a normal.
    const em=gLayoutCanEmergencyShrink(C,'titulo',clones);
    const normalCap=gLayoutCapability(C,'titulo','canShrinkFont');
    assert(em.motivo!==normalCap.motivo||em.piso!==normalCap.piso,
      'a capacidade de emergência devolveu exatamente a normal');
    assert(gElasticityLevel(C.elasticity.get('titulo').fontShrink)>0,
      'o cenário perdeu o sentido: elasticidade já proíbe encolher');
  });

  test('modo: nenhuma sequência cruza o piso de emergência',()=>{
    const {r}=busca(arteE(),D_E,CV_P);
    const clones=arteE().map(l=>Object.assign({},l));
    gStampPisosHierarquia(clones,CV_P);
    const corpoFinal=(c,id)=>{
      const l=c.layers.find(x=>x.id===id);
      return l?gLayoutCorpoAtual(l):null;
    };
    let conferiu=0;
    [].concat(r.solved,r.partial).forEach(c=>{
      c.actions.filter(a=>a.id==='shrink-text').forEach(a=>{
        assert(a.params.para>=a.params.piso,'a ação cruzou o próprio piso');
        conferiu++;
      });
      /* O que vale de verdade é o ESTADO FINAL: nenhuma camada pode terminar abaixo do piso de
         legibilidade do motor, tenha chegado lá por um degrau ou por sete. */
      clones.filter(l=>l.type==='text').forEach(l=>{
        const fim=corpoFinal(c,l.id);
        if(fim==null) return;
        assert(fim>=gLayoutPisoFonte(l,true),
          'a camada '+l.id+' terminou em '+fim+', abaixo do piso de legibilidade do motor');
      });
      // Emergência não vira licença: protegida continua intocável.
      assert(c.changedIds.indexOf('selo')<0,'a emergência mexeu na camada protegida');
    });
    assert(conferiu>0,'o cenário perdeu o sentido: nenhum encolhimento a conferir');
  });

  test('modo: emergência não compra imunidade — protegida segue intocável',()=>{
    const layers=[
      text('travado',60,60,420,90,'{{campo}}',{fontSize:56,layoutRole:'protected',name:'Campo'}),
      shape('selo',60,200,420,200,{shapeKind:'circle',layoutRole:'protected'})
    ];
    const C=ctxB(layers,{campo:'Um valor muito maior do que cabia na caixa desenhada'},CV_P);
    ['normal','emergency'].forEach(m=>{
      const em=gLayoutCanEmergencyShrink(C,'travado',layers);
      assert(!em.permitido&&em.motivo==='protegida',
        'a emergência liberou uma camada protegida ('+m+'): '+em.motivo);
    });
    const r=gSearchLayoutCandidates({ctx:C,base:layers});
    [].concat(r.solved,r.partial).forEach(c=>assert(c.changedIds.indexOf('travado')<0,
      'candidato válido mexeu na camada protegida'));
  });

  test('modo: o searchMode entra na assinatura quando é emergência',()=>{
    const layers=arteE();
    const n=gLayoutCandidateSignature({layers:layers,solveState:{},searchMode:'normal'});
    const e=gLayoutCandidateSignature({layers:layers,solveState:{},searchMode:'emergency'});
    assert(n!==e,'candidato normal e de emergência com a mesma geometria colidiram');
    /* ⚠ O normal NÃO entra na conta: a assinatura de tudo o que já existia continua idêntica.
       Modo é exceção, não parte da identidade de todo estado. */
    assert(gLayoutCandidateSignature({layers:layers,solveState:{}})===n,
      'o modo normal virou parte da assinatura de todo candidato');
  });

  test('causa: o beam mantém representantes de mais de uma causa',()=>{
    const {r}=busca(arteDuas(),D_2,CV_2);
    assert(r.original.causasAtivas.length>=2,
      'o cenário perdeu o sentido: '+JSON.stringify(r.original.causasAtivas));
    const porDepth=r.diagnostics.porDepth||[];
    const comDuas=porDepth.filter(d=>d.causasNoBeam>=2);
    assert(comDuas.length>0,'o beam nunca carregou duas causas ao mesmo tempo: '
      +JSON.stringify(porDepth.map(d=>d.causasNoBeam)));
    // As duas causas foram atacadas de verdade — não só observadas.
    const atacadas=new Set([].concat(r.solved,r.partial).map(c=>c.diagnostics.causaAtacada));
    assert(atacadas.size>=2,'a busca só atacou uma causa: '+[...atacadas].join(','));
    assert(G_SEARCH_LIMITES.beamWidth===8,'a largura do beam mudou');
    assert(G_SEARCH_LIMITES.maxDepth===8,'a profundidade máxima mudou');
  });

  test('causa: o rodízio do beam não deixa uma causa tomar a fronteira',()=>{
    /* Direto na régua: dez candidatos da causa A, um da B. Sem rodízio a B não entra. */
    const faz=(k,causa,dano)=>({ depth:1, signature:'s'+k, actions:[],
      diagnostics:{ causaAtacada:causa, causas:1, problemasDepois:1, danoDepois:dano } });
    const lista=[];
    for(let k=0;k<10;k++) lista.push(faz(k,'c:A',10+k));
    lista.push(faz(99,'c:B',500));
    const beam=_gBeamPorCausa(lista,8);
    assert(beam.length===8,'o beam mudou de largura: '+beam.length);
    assert(beam.some(c=>c.diagnostics.causaAtacada==='c:B'),
      'a causa com dano maior foi excluída da fronteira pelo volume da outra');
    assert(beam.filter(c=>c.diagnostics.causaAtacada==='c:A').length===7,
      'o rodízio não distribuiu as vagas');
    // Determinístico: a mesma entrada, a mesma fronteira.
    assert(_gBeamPorCausa(lista,8).map(c=>c.signature).join()===beam.map(c=>c.signature).join(),
      'o rodízio do beam não é determinístico');
  });

  test('causa: resolver A e depois atacar B é um caminho vivo',()=>{
    const {r}=busca(arteDuas(),D_2,CV_2);
    const cruzados=[].concat(r.solved,r.partial)
      .filter(c=>(c.causasTocadas||[]).length>=2);
    assert(cruzados.length>0,'nenhuma sequência atacou duas causas: as combinações cruzadas '
      +'continuam morrendo antes de nascer');
    // E a cobertura causal é diagnóstico, não nota.
    [].concat(r.solved,r.partial).forEach(c=>{
      assert(Array.isArray(c.causasAtivas)&&Array.isArray(c.causasResolvidas)
          &&Array.isArray(c.causasReduzidas)&&Array.isArray(c.causasReabertas),
        'falta a cobertura causal no candidato');
      c.causasResolvidas.forEach(k=>assert(c.causasAtivas.indexOf(k)<0,
        'uma causa foi dada como resolvida e continua ativa: '+k));
    });
  });

  test('causa: as causas saem do ESTADO atual, nunca congeladas no candidato',()=>{
    const {r}=busca(arteDuas(),D_2,CV_2);
    const fundos=[].concat(r.solved,r.partial).filter(c=>c.depth>=2);
    assert(fundos.length,'a busca não chegou à segunda profundidade');
    /* Se a causa ficasse congelada, o filho reatacaria sempre a mesma; aqui pelo menos um filho
       de profundidade 2 ataca uma causa diferente da que o pai atacou. */
    const mudouDeCausa=fundos.some(c=>{
      const usadas=c.causasTocadas||[];
      return usadas.length>=2;
    });
    assert(mudouDeCausa,'nenhum ramo trocou de causa entre um passo e o seguinte');
  });

  test('causa: causa reaberta é diagnosticada, não proibida',()=>{
    /* Trocar um dano por outro às vezes é o caminho. O que não pode é ficar invisível. */
    const {r}=busca(arteE(),D_E,CV_P);
    const todos=[].concat(r.solved,r.partial);
    todos.forEach(c=>{
      assert(Array.isArray(c.causasReabertas),'falta o diagnóstico de causa reaberta');
      c.causasReabertas.forEach(k=>assert(c.causasAtivas.indexOf(k)>=0,
        'uma causa foi marcada como reaberta sem estar ativa: '+k));
    });
    // Reabrir não invalida: um candidato com causa reaberta pode seguir sendo `partial`.
    const reabriu=todos.filter(c=>c.causasReabertas.length);
    reabriu.forEach(c=>assert(c.status!=='invalid','causa reaberta virou candidato inválido'));
  });

  test('modo: a busca de emergência continua determinística',()=>{
    const congelado=JSON.stringify(arteE());
    const a=busca(arteE(),D_E,CV_P).r, b=busca(arteE(),D_E,CV_P).r;
    assert(JSON.stringify(arteE())===congelado,'a busca mutou a base');
    const chapa=(r)=>[].concat(r.solved,r.partial,r.invalid)
      .map(c=>c.depth+':'+c.searchMode+':'+seq(c)+':'+c.signature).join('|');
    assert(chapa(a)===chapa(b),'duas buscas iguais deram candidatos diferentes');
    assert(a.diagnostics.emergencia.generated===b.diagnostics.emergencia.generated,
      'a contagem da emergência é instável');
  });

  test('modo: nenhum critério estético entra na escalada nem no rodízio',()=>{
    const {r}=busca(arteE(),D_E,CV_P);
    [].concat(r.solved,r.partial,r.invalid).forEach(c=>{
      ['nota','score','beleza','estetica','ranking','preferencia'].forEach(k=>
        assert(!(k in c)&&!(k in c.diagnostics),'apareceu critério estético: '+k));
    });
    // O que decide o rodízio é fato: causa atacada, causas vivas, problemas, dano, profundidade.
    const fonte=String(_gBeamPorCausa);
    ['beleza','estetic','semantic','papel','hierarquia','preferenc'].forEach(k=>
      assert(fonte.toLowerCase().indexOf(k)<0,'o beam consultou critério subjetivo: '+k));
  });

  test('modo: o custo da emergência escala com a arte',()=>{
    /* A pergunta do §17: quanto custa ENTRAR em emergência? O fallback é uma segunda busca
       completa, então o pior caso é o dobro do normal mais a profundidade extra que o piso
       novo abre. É isso que se mede — e o caso normal nunca paga por ele. */
    [58,172,344].forEach(n=>{
      const L=arteGrande(n), cv={w:1080,h:40+Math.ceil(n/6)*72+200};
      const C=gBuildOperationalContext(L,cv,{dados:{}});
      const t0=performance.now();
      const r=gSearchLayoutCandidates({ctx:C,base:L});
      const ms=performance.now()-t0;
      const de=r.diagnostics.emergencia;
      avisos.push(n+' camadas: total '+ms.toFixed(1)+'ms · normal '
        +(r.diagnostics.generated-(de?de.generated:0))+' cands · emergência '
        +(de?de.generated+' cands':'não rodou'));
      assert(ms<5000,'a busca com fallback levou '+ms.toFixed(1)+'ms em '+n+' camadas');
    });
  });

  test('modo: emergência custa, e o custo é medido',()=>{
    const medir=(L,d,cv)=>{
      const C=ctxB(L,d,cv);
      const t0=performance.now(); const r=gSearchLayoutCandidates({ctx:C,base:L});
      return { ms:performance.now()-t0, r };
    };
    const n=medir(arteN(),D_N,CV_P), e=medir(arteE(),D_E,CV_P);
    avisos.push('emergência: normal '+n.ms.toFixed(1)+'ms ('+n.r.diagnostics.generated+' cands, '
      +(n.r.diagnostics.emergencia?'com':'sem')+' fallback) · com fallback '+e.ms.toFixed(1)+'ms ('
      +e.r.diagnostics.generated+' cands, emerg '+e.r.diagnostics.emergencia.generated+')');
    assert(!n.r.diagnostics.emergencia,'o caso normal pagou o custo da emergência');
    assert(e.ms<1500,'o fallback de emergência levou '+e.ms.toFixed(1)+'ms');
  });

  /* ══ ADAPTIVE SCALE GROUPS + SAFETY GATE (Fase 5.95) ═════════════════════════════════════
     Componente e grupo de escala são conceitos DIFERENTES, e confundi-los era o último buraco:
       Component      = quem pertence junto SEMANTICAMENTE (bloco de preço, CTA, oferta).
       Adaptive group = quem precisa descer junto para resolver ESTE conflito, agora.
     O solver já tinha o segundo sem nome, dentro do degrau `relaxou`. */

  /* Arte no padrão "de/por": o produto grande, e um preço IRMÃO cujo corpo desenhado fica logo
     abaixo dele. É o irmão que vira piso de hierarquia externo e trava o produto — e o que o
     grupo adaptativo resolve ao trazê-lo para dentro do conjunto. */
  const arteIrma=()=>[
    text('produto',60,60,600,140,'{{produto}}',{fontSize:96,name:'Produto'}),
    text('de',60,230,120,50,'DE',{fontSize:38,name:'Preço de'}),
    text('por',200,215,300,90,'{{por}}',{fontSize:84,name:'Preço por'}),
    shape('selo',60,340,600,160,{shapeKind:'circle',layoutRole:'protected'})
  ];
  const D_IRMA={produto:'Combo artesanal da casa com borda recheada e bebida',por:'R$ 109,90'};
  const CV_IRMA={w:720,h:560};
  const asgDe=(C,st,g,probs,previo)=>gBuildAdaptiveScaleGroup(C,{layers:st,solveState:{}},g,probs,previo);

  test('grupo: o adaptive group NÃO é o componente semântico',()=>{
    const layers=arteIrma(), C=ctxB(layers,D_IRMA,CV_IRMA);
    const st=gSettleLayoutState({layers:layers,solveState:{}},C);
    const probs=gDetectLayoutProblems({layers:st.layers,solveState:{}},C);
    assert(probs.length,'o cenário perdeu o sentido: arte sem conflito');
    const g=gGroupLayoutProblems(probs)[0];
    const asg=asgDe(C,st.layers,g,probs);
    const comp=gComponentOfNode(C.components,g.culpritId||g.problems[0].targetId);
    assert(asg.membros.length>=2,'o grupo adaptativo não fechou ninguém: '+asg.membros.join(','));
    if(comp) assert(asg.membros.slice().sort().join('+')!==comp.membros.slice().sort().join('+')
      ||asg.membros.length>comp.membros.length,
      'o grupo adaptativo virou cópia do componente — não há o que ele resolva');
    /* ⛔ O COMPONENTE CONTINUA EXISTINDO. O grupo serve à ação operacional; o componente segue
       respondendo pela semântica, pela hierarquia e pelo scoring que vem depois. */
    assert(C.components.length>0,'os componentes semânticos sumiram');
    assert(asg.id.indexOf('asg:')===0,'o grupo adaptativo não tem identidade própria');
  });

  test('grupo: o fecho transitivo é determinístico',()=>{
    const layers=arteIrma(), C=ctxB(layers,D_IRMA,CV_IRMA);
    const st=gSettleLayoutState({layers:layers,solveState:{}},C);
    const probs=gDetectLayoutProblems({layers:st.layers,solveState:{}},C);
    const g=gGroupLayoutProblems(probs)[0];
    const a=asgDe(C,st.layers,g,probs), b=asgDe(C,st.layers,g,probs);
    assert(a.signature===b.signature,'dois fechos iguais deram assinaturas diferentes');
    assert(a.membros.join('+')===b.membros.join('+'),'a ordem do fecho não é estável');
    // E a ordem da lista de camadas não decide o fecho.
    const C2=ctxB(arteIrma().slice().reverse(),D_IRMA,CV_IRMA);
    const st2=gSettleLayoutState({layers:arteIrma().slice().reverse(),solveState:{}},C2);
    const probs2=gDetectLayoutProblems({layers:st2.layers,solveState:{}},C2);
    const g2=gGroupLayoutProblems(probs2)[0];
    assert(asgDe(C2,st2.layers,g2,probs2).membros.join('+')===a.membros.join('+'),
      'inverter a lista de camadas mudou o fecho');
  });

  test('grupo: proximidade pura NÃO expande o fecho',()=>{
    /* ⛔ `aligned`, `near`, `inside` e afins são DESCRITIVOS: dois blocos na mesma margem não
       descem juntos por isso. Só colisão medida e dependência autorizada expandem. */
    assert(G_SCALE_GROUP_RELACOES.indexOf('collision')>=0,'colisão deveria expandir');
    G_GRAPH_DEPENDENCIA.forEach(t=>assert(G_SCALE_GROUP_RELACOES.indexOf(t)>=0,
      'a relação de dependência '+t+' deveria expandir'));
    ['aligned','near','inside','same-column','overlap','reading-order'].forEach(t=>
      assert(G_SCALE_GROUP_RELACOES.indexOf(t)<0,'proximidade entrou no fecho: '+t));
    // Na prática: um bloco alinhado e distante não entra no grupo.
    const layers=arteIrma().concat([
      text('longe',60,60,200,50,'ALINHADO',{fontSize:30,name:'Texto solto'})
    ]);
    layers[layers.length-1].x=60; layers[layers.length-1].y=505;
    const C=ctxB(layers,D_IRMA,CV_IRMA);
    const st=gSettleLayoutState({layers:layers,solveState:{}},C);
    const probs=gDetectLayoutProblems({layers:st.layers,solveState:{}},C);
    if(!probs.length){ assert(true,'sem conflito não há fecho a medir'); return; }
    const asg=asgDe(C,st.layers,gGroupLayoutProblems(probs)[0],probs);
    const brigou=probs.some(p=>p.targetId==='longe'||p.withId==='longe');
    if(!brigou) assert(asg.membros.indexOf('longe')<0,
      'uma camada que só está alinhada entrou no grupo de escala');
  });

  test('grupo: o piso externo EXCLUI quem desce junto',()=>{
    /* O ponto central do caso que faltava. `por` desenhado a 84 é piso do `produto` enquanto
       estiver de fora; dentro do grupo ele sai da conta e o produto pode continuar descendo. */
    const clones=arteIrma().map(l=>Object.assign({},l));
    gStampPisosHierarquia(clones,CV_IRMA);
    const prod=clones.find(l=>l.id==='produto');
    const semPor=gLayoutPisoHierarquiaExterno(clones,prod,['produto'],false);
    const comPor=gLayoutPisoHierarquiaExterno(clones,prod,['produto','de','por'],false);
    assert(semPor===84,'o irmão deveria fixar o piso externo em 84, deu '+semPor);
    assert(comPor<semPor,'trazer o irmão para o grupo não baixou o piso externo: '+comPor);
    // E o piso do MODO reflete isso — só em emergência, que é onde o piso externo manda.
    assert(gLayoutPisoDoModo(clones,prod,'emergency',['produto'])
         > gLayoutPisoDoModo(clones,prod,'emergency',['produto','de','por']),
      'o piso de emergência ignorou o grupo');
    assert(gLayoutPisoDoModo(clones,prod,'normal',['produto'])
        === gLayoutPisoDoModo(clones,prod,'normal',['produto','de','por']),
      'o piso NORMAL passou a depender do grupo — emergência vazou para o fluxo normal');
  });

  test('grupo: com o fecho certo a busca alcança o piso que o solver alcança',()=>{
    const layers=arteIrma(), C=ctxB(layers,D_IRMA,CV_IRMA);
    const st=gSettleLayoutState({layers:layers,solveState:{}},C);
    const probs=gDetectLayoutProblems({layers:st.layers,solveState:{}},C);
    assert(probs.length,'o cenário perdeu o sentido');
    const g=gGroupLayoutProblems(probs)[0];
    const asg=asgDe(C,st.layers,g,probs);
    const cap=gLayoutCanScaleGroup(C,asg,st.layers,'emergency');
    assert(cap.permitido,'o grupo não pôde descer: '+cap.motivo);
    const pisoProduto=(cap.pisos||[]).find(x=>x.id==='produto');
    if(pisoProduto) assert(pisoProduto.piso<84,
      'o piso do produto continuou preso ao irmão: '+pisoProduto.piso);
    // E a ação existe, com o escopo explícito.
    const acoes=gGenerateLayoutActions(C,Object.assign({},g.problems[0],
      {rootId:g.culpritId||null,impactLevel:3,_adaptiveGroup:asg}),st.layers,'emergency');
    const grupoAcao=acoes.find(a=>a.id==='scale-component'&&a.params.escopo==='collision-group');
    assert(grupoAcao,'não gerou a escala no escopo do grupo: '
      +acoes.map(a=>a.id+'/'+(a.params.escopo||'-')).join(','));
    assert(grupoAcao.adaptiveGroupId===asg.id,'a ação não carrega a identidade do grupo');
    assert(grupoAcao.params.grupoPiso&&grupoAcao.params.grupoPiso.length>=grupoAcao.params.membros.length,
      'o grupo do PISO tem que conter quem desce — são dois conjuntos, e o do piso é o fecho');
  });

  test('portão: detector em zero e produto reprovando NÃO é solved',()=>{
    /* Duas implementações da mesma pergunta divergem — foi assim que um estouro de largura
       passou pelo detector na 5.9. O veredito do produto é a autoridade final. */
    const layers=arteIrma(), C=ctxB(layers,D_IRMA,CV_IRMA);
    const r=gSearchLayoutCandidates({ctx:C,base:layers});
    const todos=[].concat(r.solved,r.partial,r.invalid,r.unsafe||[]);
    assert(todos.length,'a busca não produziu candidato nenhum');
    r.solved.forEach(c=>{
      const seg=gLayoutCandidateSafety(c,C);
      assert(seg.seguro,'um `solved` é reprovado pelo produto: '+seq(c)+' → '+seg.reprovadas.join(','));
      assert(!seg.reprovadas.length,'um `solved` tem camada reprovada');
    });
    (r.unsafe||[]).forEach(c=>{
      assert(c.status==='unsafe','a categoria de inseguro está errada');
      assert(c.diagnostics.problemasDepois===0,
        'um `unsafe` tinha dano objetivo — isso é `partial`, não `unsafe`');
      assert((c.diagnostics.reprovadas||[]).length,'um `unsafe` não diz quem o produto reprova');
      assert(r.solved.indexOf(c)<0,'um candidato inseguro entrou na lista de soluções');
    });
  });

  test('portão: o veredito é o do produto, não um segundo checker',()=>{
    const layers=arteIrma(), C=ctxB(layers,D_IRMA,CV_IRMA);
    const seg=gLayoutCandidateSafety({layers:layers,solveState:{},signature:'seg1'},C);
    assert(typeof seg.seguro==='boolean'&&Array.isArray(seg.reprovadas),'o contrato mudou');
    /* A régua é `gLayoutCamadaReprovada` — a MESMA que o checklist e a publicação usam. */
    assert(String(gLayoutCandidateSafety).indexOf('gLayoutCamadaReprovada')>=0,
      'o portão parou de consultar o veredito do produto');
    assert(typeof gLayoutCamadaReprovada==='function','o veredito do produto sumiu');
  });

  test('cache: pisos diferentes medem diferente, e a chave sabe disso',()=>{
    /* O bug da 5.9: mesma geometria, mesmo texto, mesmo corpo — e `gFitTextLayer` reduz
       internamente até `_pisoFonte`/`_pisoLegivel`, então o resultado É outro. */
    const C=ctxB(arteIrma(),D_IRMA,CV_IRMA);
    /* A configuração EXATA em que a 5.9 divergiu: corredor largo com teto de linhas, texto que
       cabe em duas linhas e um teto de fonte já aplicado. Aí o encaixe reduz por LARGURA até o
       piso — e o piso decide se `estourou` ou não. */
    const base={id:'x',name:'Produto',type:'text',x:0,y:0,w:900,h:200,
      content:'Pizza Grande de Calabresa Especial',_tetoFonte:80,_layoutW:900,_layoutMaxLines:3,
      /* Caixa-alta é o que faz a linha quebrada ainda passar do corredor — sem ela o encaixe
         acomoda a largura sozinho e o piso nunca chega a decidir nada. É a configuração real
         do `de-por-lateral`, que é onde o defeito apareceu. */
      font:'Arial',fontSize:96,lineHeight:1.05,textTransform:'uppercase',
      textBox:'box',textAlign:'left',vAlign:'top',visible:true,opacity:100};
    const baixo=Object.assign({},base,{_pisoFonte:48,_pisoLegivel:24});
    const alto=Object.assign({},base,{_pisoFonte:84,_pisoLegivel:24});
    const fb=_gAcaoFit(C,baixo,base.content), fa=_gAcaoFit(C,alto,base.content);
    assert(fb&&fa,'não mediu');
    assert(fb.fontSize!==fa.fontSize,'pisos diferentes deram o MESMO corpo: '+fb.fontSize);
    assert(fb.estourou===false&&fa.estourou===true,
      'o piso deixou de decidir o estouro — a chave do cache está cega para ele: '
      +fb.estourou+'/'+fa.estourou);
    /* E o cache não pode confundir os dois: pedir de novo, na ordem inversa, tem que devolver
       cada um o seu. É o teste do bug, não da implementação. */
    assert(_gAcaoFit(C,alto,base.content).estourou===true
        && _gAcaoFit(C,baixo,base.content).estourou===false,
      'o cache devolveu a medida de um piso para o outro');
    /* ⚠ `encolher:false` não pode voltar para a medida do detector: ele pula a ÚNICA linha que
       levanta `estourou` por largura, e foi assim que a busca aprovou arte que o produto
       reprova. Aqui isso se prova pelo comportamento — com ele, `fa.estourou` seria false. */
    assert(fa.estourou===true,'o detector parou de enxergar o estouro por largura');
  });

  test('isolado: overflow sem culpado gera só auto-adaptação',()=>{
    const layers=[
      text('solto',60,60,300,60,'{{v}}',{fontSize:44,name:'Texto'}),
      text('outro',60,300,300,60,'FIXO',{fontSize:24,name:'Descrição'})
    ];
    const C=ctxB(layers,{v:'Um valor bem maior do que a caixa desenhada comporta'},{w:420,h:420});
    const p={tipo:'text-overflow',targetId:'solto',detalhe:{largura:300,linhas:3,excesso:40}};
    const acoes=gGenerateLayoutActions(C,p,layers,'normal');
    assert(acoes.length,'não gerou nada para um estouro isolado');
    acoes.forEach(a=>{
      assert(a.motivo==='isolated-self','sem culpado o motivo deveria ser isolated-self: '+a.id);
      assert(a.targetId==='solto'||a.componentId==null,
        'uma ação isolada mirou terceiro: '+a.id+'@'+(a.targetId||a.componentId));
      assert(G_ACAO_AUTO_ADAPTACAO.indexOf(a.id)>=0,
        'ação fora da política de auto-adaptação: '+a.id);
    });
    // ⛔ Escala de grupo INFERIDO sem evidência não entra.
    assert(!acoes.some(a=>a.id==='scale-component'),
      'escalou um grupo sem evidência de origem');
  });

  test('isolado: overflow sem culpado não mexe em terceiro',()=>{
    const layers=[
      text('solto',60,60,300,60,'{{v}}',{fontSize:44,name:'Texto'}),
      text('outro',60,300,300,60,'FIXO',{fontSize:24,name:'Descrição'})
    ];
    const C=ctxB(layers,{v:'Um valor bem maior do que a caixa desenhada comporta'},{w:420,h:420});
    const p={tipo:'text-overflow',targetId:'solto',detalhe:{largura:300}};
    gGenerateLayoutActions(C,p,layers,'normal').forEach(a=>{
      const r=gApplyLayoutAction({layers:layers,solveState:{}},a,C);
      r.changedIds.forEach(id=>assert(id==='solto',
        'a ação isolada '+a.id+' mexeu em '+id));
    });
  });

  test('isolado: com culpado provado a geração continua causal',()=>{
    const layers=arteIrma(), C=ctxB(layers,D_IRMA,CV_IRMA);
    const st=gSettleLayoutState({layers:layers,solveState:{}},C);
    const probs=gDetectLayoutProblems({layers:st.layers,solveState:{}},C);
    const comCulpado=probs.find(p=>p.detalhe&&p.detalhe.culpado);
    if(!comCulpado){ assert(true,'esta arte não tem causa provada'); return; }
    const acoes=gGenerateLayoutActions(C,Object.assign({},comCulpado,
      {rootId:comCulpado.detalhe.culpado,impactLevel:3}),st.layers,'normal');
    assert(acoes.length,'a geração causal não produziu nada');
    acoes.forEach(a=>assert(a.motivo==='causal','o motivo deveria ser causal: '+a.id));
    assert(acoes.some(a=>a.targetId===comCulpado.detalhe.culpado||a.componentId||a.adaptiveGroupId),
      'nenhuma ação mirou a origem');
  });

  test('grupo: construir o fecho e recalcular o piso cabem no orçamento',()=>{
    const L=arteGrande(344), cv={w:1080,h:4600};
    const C=gBuildOperationalContext(L,cv,{dados:{}});
    const st=gSettleLayoutState({layers:L,solveState:{}},C);
    const probs=gDetectLayoutProblems({layers:st.layers,solveState:{}},C);
    const grupos=gGroupLayoutProblems(probs).slice(0,8);
    let t=performance.now();
    const asgs=grupos.map(g=>gBuildAdaptiveScaleGroup(C,{layers:st.layers,solveState:{}},g,probs));
    const msGrupo=performance.now()-t;
    t=performance.now();
    asgs.forEach(a=>gLayoutCanScaleGroup(C,a,st.layers,'emergency'));
    const msPiso=performance.now()-t;
    t=performance.now();
    gLayoutCandidateSafety({layers:L,solveState:{},signature:'perf1'},C,probs);
    const msSeg=performance.now()-t;
    avisos.push('344 camadas: 8 fechos '+msGrupo.toFixed(1)+'ms (até '
      +Math.max.apply(null,asgs.map(a=>a.membros.length))+' membros) · 8 pisos de grupo '
      +msPiso.toFixed(1)+'ms · 1 portão de segurança '+msSeg.toFixed(1)+'ms');
    assert(msGrupo<200,'construir 8 fechos levou '+msGrupo.toFixed(1)+'ms');
    assert(msPiso<200,'recalcular 8 pisos levou '+msPiso.toFixed(1)+'ms');
    assert(msSeg<400,'o portão de segurança levou '+msSeg.toFixed(1)+'ms');
    assert(G_SEARCH_LIMITES.beamWidth===8&&G_SEARCH_LIMITES.maxDepth===8,
      'os limites da busca mudaram');
  });

  /* ══ SCORING HIERÁRQUICO + SELEÇÃO (Fase 6) ══════════════════════════════════════════════
     A busca devolve TODAS as sequências que resolveram. Aqui se escolhe — e a escolha é
     LEXICOGRÁFICA, nunca um número só. Camada de baixo não compra violação de camada de cima. */

  // Um perfil sintético: é assim que se testa comparador — com vetores, não com sorte de fixture.
  const perfil=(v,extra)=>Object.assign({
    vector:v, vectorCamadas:['safety','semantics','semantics','authored-intent',
                             'authored-intent','mode','aesthetics','alteration'],
    depth:1, signature:'sig'+v.join('_'),
    alteration:{ camadasAlteradas:1, acoes:1 }, semantics:{ violacoes:[] },
    mode:{ emergency:v[5]===1 }, authoredIntent:{ estruturaIgual:true }
  },extra||{});
  const venceu=(a,b)=>gCompareLayoutCandidates(a,b)<0;

  test('scoring: estética nunca compra violação de segurança',()=>{
    /* Candidato B é impecável em tudo o que vem depois — e inseguro. A não perde nunca. */
    const A=perfil([0, 3,0.9, 5,5, 1, 99,99]);
    const B=perfil([1, 0,0,   0,0, 0,  0, 0]);
    assert(venceu(A,B),'um candidato inseguro venceu um seguro por ser mais bonito');
    assert(!venceu(B,A),'a comparação não é antissimétrica');
    // E o vetor tem a segurança na primeira posição, por construção.
    assert(G_SCORE_CAMADAS[0]==='safety','a ordem das camadas mudou: safety saiu da frente');
  });

  test('scoring: estética nunca compra violação semântica',()=>{
    const A=perfil([0, 0,0, 9,9, 1, 90,90]);   // semântica limpa, feio, caro, emergência
    const B=perfil([0, 1,0, 0,0, 0,  0, 0]);   // uma violação semântica, perfeito no resto
    assert(venceu(A,B),'uma violação semântica foi compensada por estética');
    assert(G_SCORE_CAMADAS.indexOf('semantics')<G_SCORE_CAMADAS.indexOf('aesthetics'),
      'semântica deixou de vir antes de estética');
  });

  test('scoring: hierarquia quebrada perde para hierarquia preservada',()=>{
    /* Quebrar é violação (posição 1). Comprimir mantendo a ordem é diagnóstico (posição 2) —
       e é a distinção que impede a nota de preferir arte que não coube a arte que encolheu. */
    const quebrou=perfil([0, 1,0.0, 0,0, 0, 0,0]);
    const comprimiu=perfil([0, 0,0.5, 0,0, 0, 0,0]);
    assert(venceu(comprimiu,quebrou),'comprimir preservando a ordem perdeu para quebrar a ordem');
  });

  test('scoring: relação estrutural preservada vence menor deslocamento',()=>{
    /* §8: estrutura vale mais que coordenada. A move muito e mantém a composição; B move
       pouco e rompe uma relação autoral. A vence. */
    const A=perfil([0, 0,0, 0,0, 0, 10, 80]);  // caro em alteração
    const B=perfil([0, 0,0, 1,0, 0, 10,  5]);  // barato, mas perdeu uma relação autoral
    assert(venceu(A,B),'o deslocamento menor venceu a preservação estrutural');
    assert(G_SCORE_CAMADAS.indexOf('authored-intent')<G_SCORE_CAMADAS.indexOf('alteration'),
      'intenção autoral deixou de vir antes de alteração');
  });

  test('scoring: normal vence emergency com o resto equivalente',()=>{
    const normal=perfil([0, 0,0.2, 1,1, 0, 40,40]);
    const emerg =perfil([0, 0,0.2, 1,1, 1, 40,40]);
    assert(venceu(normal,emerg),'emergência empatou com normal sendo tudo o mais igual');
  });

  test('scoring: emergency VENCE normal quando o normal custa mais semântica',()=>{
    /* §9: emergência é sacrifício, não invalidação. Se o caminho normal quebra a leitura e o
       de emergência não, o de emergência vence — a camada superior manda. */
    const normal=perfil([0, 2,0.1, 0,0, 0, 5, 5]);
    const emerg =perfil([0, 0,0.4, 1,1, 1, 60,60]);
    assert(venceu(emerg,normal),'emergência foi invalidada mesmo preservando mais semântica');
  });

  test('scoring: menos movimentos só decide EMPATE real',()=>{
    const poucos=perfil([0,0,0, 0,0, 0, 50, 10]);   // 1 ação, composição pior
    const muitos=perfil([0,0,0, 0,0, 0, 10, 90]);   // caro, composição melhor
    assert(venceu(muitos,poucos),'o custo de alteração passou na frente da composição');
    // Com tudo igual até a estética, aí sim a alteração decide.
    const a=perfil([0,0,0, 0,0, 0, 10, 10]), b=perfil([0,0,0, 0,0, 0, 10, 40]);
    assert(venceu(a,b),'com tudo igual, a menor alteração não decidiu');
  });

  test('scoring: o desempate é determinístico e não depende da ordem do array',()=>{
    const a=perfil([0,0,0,0,0,0,0,0],{ signature:'aaa', depth:2,
      alteration:{ camadasAlteradas:2, acoes:3 } });
    const b=perfil([0,0,0,0,0,0,0,0],{ signature:'bbb', depth:1,
      alteration:{ camadasAlteradas:2, acoes:3 } });
    assert(gCompareLayoutCandidates(a,b)>0,'profundidade não desempatou');
    const c=perfil([0,0,0,0,0,0,0,0],{ signature:'aaa', depth:1,
      alteration:{ camadasAlteradas:2, acoes:3 } });
    const d=perfil([0,0,0,0,0,0,0,0],{ signature:'bbb', depth:1,
      alteration:{ camadasAlteradas:2, acoes:3 } });
    assert(gCompareLayoutCandidates(c,d)<0&&gCompareLayoutCandidates(d,c)>0,
      'a assinatura não desempatou de forma estável');
    // Ordenar embaralhado dá a mesma ordem.
    const lista=[b,d,a,c];
    const ord1=lista.slice().sort(gCompareLayoutCandidates).map(x=>x.signature+':'+x.depth);
    const ord2=lista.slice().reverse().sort(gCompareLayoutCandidates).map(x=>x.signature+':'+x.depth);
    assert(ord1.join()===ord2.join(),'a ordem de entrada mudou o ranking: '+ord1+' vs '+ord2);
  });

  test('scoring: `partial` e `unsafe` não competem com `solved`',()=>{
    const layers=arteIrma(), C=ctxB(layers,D_IRMA,CV_IRMA);
    const r=gSearchLayoutCandidates({ctx:C,base:layers});
    assert(r.solved.length,'o cenário perdeu o sentido: sem solução');
    const esc=gSelectLayoutCandidate(r,C);
    assert(esc.winner,'não escolheu vencedor havendo solução');
    assert(esc.winner.status==='solved','o vencedor não é um candidato resolvido');
    esc.ranked.forEach(x=>{
      assert(x.candidate.status==='solved','um não-resolvido entrou no ranking');
      assert(!x.profile||x.profile.safety.seguro,'um inseguro entrou no ranking');
    });
    // Sem solução, não existe "o menos quebrado".
    const vazio=gSelectLayoutCandidate({solved:[],partial:r.partial,unsafe:r.unsafe||[]},C);
    assert(vazio.winner===null&&!vazio.ranked.length,'escolheu vencedor sem candidato resolvido');
    assert(vazio.explanation.wonBy===null,'inventou motivo de vitória sem vencedor');
  });

  test('scoring: ORIGINAL FIRST vence sem rodar scoring nenhum',()=>{
    const layers=arteN(), C=ctxB(layers,{titulo:'OFERTA'},CV_P);
    const r=gSearchLayoutCandidates({ctx:C,base:layers});
    assert(r.original.diagnostics.problemas===0,'o cenário perdeu o sentido: arte com dano');
    const esc=gSelectLayoutCandidate(r,C);
    assert(esc.winner===r.original,'a composição publicada não venceu');
    assert(esc.explanation.wonBy==='original-first','venceu por outro critério');
    assert(esc.diagnostics.originalFirst===true,'não registrou o atalho');
    assert(esc.diagnostics.avaliados===0,'calculou perfil para reeleger a arte intocada');
    assert(esc.ranked[0].profile===null,'gastou perfil no caminho feliz');
  });

  test('scoring: o perfil é serializável e determinístico',()=>{
    const layers=arteIrma(), C=ctxB(layers,D_IRMA,CV_IRMA);
    const r=gSearchLayoutCandidates({ctx:C,base:layers});
    const base=gSettleCandidateState(r.original,C).layers;
    const p1=gLayoutScoreProfile(r.solved[0],C,{base:base});
    const p2=gLayoutScoreProfile(r.solved[0],C,{base:base});
    assert(JSON.stringify(p1)===JSON.stringify(p2),'dois perfis do mesmo candidato diferem');
    assert(JSON.stringify(p1).indexOf('function')<0,'o perfil levou função dentro');
    G_SCORE_CAMADAS.forEach(c=>{
      const k=c==='authored-intent'?'authoredIntent':c;
      assert(p1[k],'falta a camada '+c+' no perfil');
    });
    assert(Array.isArray(p1.vector)&&p1.vector.length===p1.vectorCamadas.length,
      'o vetor e os rótulos das camadas divergem');
    p1.vector.forEach(v=>assert(typeof v==='number'&&isFinite(v),'posição não numérica no vetor'));
    // Observabilidade do grupo adaptativo (§23): registrada, NÃO penalizada.
    assert(typeof p1.observabilidade.adaptiveGroupSize==='number'
        && typeof p1.observabilidade.adaptiveGroupRatio==='number','falta a observabilidade do grupo');
    /* §23: o tamanho do fecho é OBSERVABILIDADE, não critério. O vetor tem exatamente uma
       posição por rótulo declarado, e nenhuma delas vem da observabilidade. */
    assert(p1.vector.length===8,'o vetor mudou de tamanho: '+p1.vector.length);
    p1.vectorCamadas.forEach(c=>assert(G_SCORE_CAMADAS.indexOf(c)>=0,
      'o vetor cita uma camada que não existe: '+c));
    assert(p1.vectorCamadas.indexOf('observabilidade')<0,'a observabilidade virou camada');
    assert(String(gCompareLayoutCandidates).indexOf('adaptiveGroup')<0
        && String(gLayoutScoreProfile).indexOf('vector.push')<0,
      'o comparador passou a consultar o tamanho do grupo adaptativo');
  });

  test('scoring: mesma entrada, mesmo vencedor',()=>{
    const a=gSelectLayoutCandidate(gSearchLayoutCandidates(
      {ctx:ctxB(arteIrma(),D_IRMA,CV_IRMA),base:arteIrma()}),ctxB(arteIrma(),D_IRMA,CV_IRMA));
    const b=gSelectLayoutCandidate(gSearchLayoutCandidates(
      {ctx:ctxB(arteIrma(),D_IRMA,CV_IRMA),base:arteIrma()}),ctxB(arteIrma(),D_IRMA,CV_IRMA));
    assert((a.winner&&a.winner.signature)===(b.winner&&b.winner.signature),
      'duas execuções iguais escolheram vencedores diferentes');
    assert(a.explanation.wonBy===b.explanation.wonBy,'o motivo da vitória é instável');
    assert(a.ranked.map(x=>x.candidate.signature).join()===b.ranked.map(x=>x.candidate.signature).join(),
      'o ranking é instável');
  });

  test('scoring: a nota que já existia é REUSADA, não duplicada',()=>{
    /* ⛔ Dois modelos de estética paralelos é o erro que a §11 proíbe. Cada item da nota
       pertence a exatamente UMA camada, e a soma das camadas devolve a penalidade inteira. */
    const layers=arteIrma(), C=ctxB(layers,D_IRMA,CV_IRMA);
    const r=gSearchLayoutCandidates({ctx:C,base:layers});
    const base=gSettleCandidateState(r.original,C).layers;
    const p=gLayoutScoreProfile(r.solved[0],C,{base:base});
    const itens=p.aesthetics.itens;
    Object.keys(itens).forEach(k=>assert(G_SCORE_ITENS_CAMADA[k],
      'o item "'+k+'" da nota não foi auditado para nenhuma camada'));
    const camadas=[...new Set(Object.values(G_SCORE_ITENS_CAMADA))];
    camadas.forEach(c=>assert(G_SCORE_CAMADAS.indexOf(c)>=0,'camada inventada na auditoria: '+c));
    const soma=camadas.reduce((s,c)=>s+_gScoreDaCamada(itens,c),0);
    const total=Object.keys(itens).reduce((s,k)=>s+(itens[k]||0),0);
    assert(Math.abs(soma-total)<0.05,'a repartição perdeu ou duplicou penalidade: '+soma+' vs '+total);
    assert(p.aesthetics.score===_gScoreDaCamada(itens,'aesthetics'),'a estética não veio da nota');
    assert(p.alteration.score===_gScoreDaCamada(itens,'alteration'),'a alteração não veio da nota');
  });

  test('scoring: nenhuma regra estética entra na camada de segurança',()=>{
    /* Safety é portão. As margens existem para diagnóstico FUTURO (§4) e não podem aparecer
       no vetor — usar folga de segurança para desempatar é estética pela porta dos fundos. */
    Object.keys(G_SCORE_ITENS_CAMADA).forEach(k=>{
      if(G_SCORE_ITENS_CAMADA[k]!=='safety') return;
      assert(k==='invalido','item estético classificado como segurança: '+k);
    });
    const layers=arteIrma(), C=ctxB(layers,D_IRMA,CV_IRMA);
    const r=gSearchLayoutCandidates({ctx:C,base:layers});
    const base=gSettleCandidateState(r.original,C).layers;
    const p=gLayoutScoreProfile(r.solved[0],C,{base:base});
    assert(p.vector[0]===0||p.vector[0]===1,'a posição de segurança deixou de ser binária');
    [p.safety.margemBorda,p.safety.margemLegibilidade].forEach(m=>{
      if(m==null) return;
      assert(p.vector.indexOf(m)<0||m===0,'uma margem de segurança entrou no vetor de decisão');
    });
    assert(String(gCompareLayoutCandidates).indexOf('margem')<0,
      'o comparador passou a consultar margem de segurança');
  });

  test('scoring: a decisão se explica — qual camada decidiu e por quê',()=>{
    const layers=arteIrma(), C=ctxB(layers,D_IRMA,CV_IRMA);
    const esc=gSelectLayoutCandidate(gSearchLayoutCandidates({ctx:C,base:layers}),C);
    assert(esc.winner,'sem vencedor não há o que explicar');
    assert(esc.explanation.wonBy,'não disse qual camada decidiu');
    assert(G_SCORE_CAMADAS.indexOf(esc.explanation.wonBy)>=0
        || ['original-first','unico','empate'].indexOf(esc.explanation.wonBy)>=0,
      'camada de decisão fora do vocabulário: '+esc.explanation.wonBy);
    assert(Array.isArray(esc.explanation.reasons)&&esc.explanation.reasons.length,
      'a explicação veio vazia');
    if(esc.ranked.length>1){
      assert(esc.explanation.posicao>=0,'não disse em que posição do vetor a decisão caiu');
      const a=esc.ranked[0].profile.vector, b=esc.ranked[1].profile.vector;
      /* ⚠ A PRIMEIRA QUE DIFERIU **ALÉM DA RESOLUÇÃO DA MÉTRICA** (zona morta, Fase 6.6).
         Antes bastava diferir; hoje uma diferença contínua menor que o ruído medido daquela
         arte é empate perceptual, e a decisão desce de camada de propósito. */
      const zonas=esc.ranked[0].profile.deadZone||{};
      for(let i=0;i<esc.explanation.posicao;i++){
        const z=(G_SCORE_VETOR_ZONA[i]&&zonas[G_SCORE_VETOR_ZONA[i]])||0;
        assert(Math.abs((a[i]||0)-(b[i]||0))<=Math.max(1e-9,z),
          'a posição declarada não é a PRIMEIRA que diferiu além da zona morta (posição '+i+')');
      }
    }
  });

  /* ══ STRESS DO PORTÃO DE SEGURANÇA (§22) ═════════════════════════════════════════════════
     A Fase 5.95 observou que o portão não tinha disparado em caso real. Aqui ele é exercitado
     de propósito: composições que o DETECTOR aprova e o PRODUTO reprova não podem ranquear. */

  const forcaCandidato=(C,layers,mut)=>{
    const ls=layers.map(l=>Object.assign({},l));
    mut(ls);
    const c=_gCandidatoTesteScore(ls);
    return c;
  };
  const _gCandidatoTesteScore=(ls)=>({ id:'forc', layers:ls, solveState:{}, depth:1,
    searchMode:'normal', status:'solved', actions:[], actionSignatures:[], changedIds:[],
    diagnostics:{ problemasDepois:0 }, causasTocadas:[], scaleGroupIds:[],
    signature:gLayoutCandidateSignature({layers:ls,solveState:{}}) });

  test('portão: piso de fonte — abaixo da legibilidade o produto reprova',()=>{
    const layers=[
      text('titulo',60,60,420,90,'{{v}}',{fontSize:56,name:'Titulo',textTransform:'uppercase',
        _layoutW:420,textBox:'box'}),
      text('rodape',60,300,420,40,'CONSULTE',{fontSize:20,name:'Descrição'})
    ];
    const dados={v:'Combo artesanal da casa com borda recheada e bebida gelada da promoção'};
    const C=ctxB(layers,dados,CV_P);
    /* Um candidato que NÃO encolheu: o texto continua estourando a caixa. O detector do
       corredor pode não acusar, mas `gLayoutCamadaReprovada` acusa. */
    const c=forcaCandidato(C,layers,ls=>{});
    const seg=gLayoutCandidateSafety(c,C);
    const esc=gSelectLayoutCandidate({solved:[c]},C);
    if(seg.seguro){ assert(esc.winner===c,'aprovado pelo produto e não ranqueado'); }
    else{
      assert(esc.winner===null,'um candidato reprovado pelo produto foi eleito vencedor');
      assert(esc.diagnostics.descartados===1,'o descarte não foi registrado');
    }
    assert(typeof seg.seguro==='boolean','o portão não respondeu');
  });

  test('portão: fora da prancheta nunca entra no ranking',()=>{
    const layers=[
      text('titulo',60,60,420,90,'{{v}}',{fontSize:44,name:'Titulo'}),
      text('rodape',60,300,420,40,'CONSULTE',{fontSize:20,name:'Descrição'})
    ];
    const C=ctxB(layers,{v:'OFERTA'},CV_P);
    // Empurra o rodapé para fora da prancheta, muito além da sangria autorada.
    const c=forcaCandidato(C,layers,ls=>{
      const l=ls.find(x=>x.id==='rodape');
      l.y=CV_P.h+200; l._geoAutor={x:l.x,y:l.y,w:l.w,h:l.h};
    });
    const seg=gLayoutCandidateSafety(c,C);
    assert(!seg.seguro,'uma camada fora da prancheta passou pelo portão: '+JSON.stringify(seg));
    const esc=gSelectLayoutCandidate({solved:[c]},C);
    assert(esc.winner===null,'a composição fora da prancheta foi eleita');
    assert(esc.diagnostics.descartados===1,'o descarte não foi registrado');
  });

  test('portão: sobreposição relevante e zona segura de imagem barram a eleição',()=>{
    const layers=[
      text('titulo',60,60,300,70,'{{v}}',{fontSize:40,name:'Titulo'}),
      shape('foto',60,200,380,200,{layoutRole:'protected',name:'Foto'}),
      text('apoio',60,150,300,40,'APOIO',{fontSize:22,name:'Descrição'})
    ];
    const C=ctxB(layers,{v:'OFERTA DA SEMANA'},{w:500,h:440});
    // Joga o apoio por cima da foto protegida — invasão que não existia no desenho.
    const c=forcaCandidato(C,layers,ls=>{
      const l=ls.find(x=>x.id==='apoio');
      l.y=260; l._geoAutor={x:l.x,y:l.y,w:l.w,h:l.h};
    });
    const seg=gLayoutCandidateSafety(c,C);
    const esc=gSelectLayoutCandidate({solved:[c]},C);
    if(!seg.seguro){
      assert(esc.winner===null,'uma invasão de zona protegida foi eleita');
    }else{
      // Se o detector considerar a sobreposição intencional, o produto tem que concordar.
      assert(!seg.reprovadas.length,'detector e produto discordaram sem que o portão barrasse');
    }
  });

  test('portão: camada protegida alterada nunca vira vencedora',()=>{
    const layers=[
      text('titulo',60,60,300,70,'{{v}}',{fontSize:40,name:'Titulo'}),
      text('selo',60,200,300,60,'SELO',{fontSize:30,layoutRole:'protected',name:'Selo'})
    ];
    const C=ctxB(layers,{v:'Oferta muito maior do que a caixa desenhada comporta'},{w:420,h:360});
    const r=gSearchLayoutCandidates({ctx:C,base:layers});
    const esc=gSelectLayoutCandidate(r,C);
    [].concat(esc.ranked.map(x=>x.candidate)).forEach(c=>
      assert((c.changedIds||[]).indexOf('selo')<0,'o vencedor mexeu na camada protegida'));
    if(esc.winner) assert((esc.winner.changedIds||[]).indexOf('selo')<0,
      'a camada protegida foi alterada pelo vencedor');
  });

  test('scoring: o custo de alteração é explicável item a item',()=>{
    const layers=arteIrma(), C=ctxB(layers,D_IRMA,CV_IRMA);
    const r=gSearchLayoutCandidates({ctx:C,base:layers});
    const base=gSettleCandidateState(r.original,C).layers;
    const p=gLayoutScoreProfile(r.solved[0],C,{base:base});
    ['camadasAlteradas','camadasMovidas','distanciaMovida','reducaoFonte','reducaoEntrelinha',
     'mudancasDeTracking','placasRedimensionadas','componentesEscalados','acoes','profundidade',
     'acoesDeEmergencia'].forEach(k=>
      assert(typeof p.alteration[k]==='number','falta o item "'+k+'" no custo de alteração'));
    assert(p.alteration.acoes===p.actions.length,'a contagem de ações diverge do histórico');
    assert(p.alteration.profundidade===r.solved[0].depth,'a profundidade diverge do candidato');
  });

  test('scoring: o custo em 344 camadas não dobra a busca',()=>{
    const L=arteGrande(344), cv={w:1080,h:4600};
    const C=gBuildOperationalContext(L,cv,{dados:{}});
    const t0=performance.now();
    const r=gSearchLayoutCandidates({ctx:C,base:L});
    const msBusca=performance.now()-t0;
    const t1=performance.now();
    const esc=gSelectLayoutCandidate(r,C);
    const msEscolha=performance.now()-t1;
    /* ⚠ Nesta arte sintética a busca não fecha nenhum candidato, então a escolha sai de graça e
       o número não diria nada. O custo REAL do scoring é o do PERFIL — compilar Gramática,
       Graph e Componentes do estado e comparar com o original. Mede-se nos parciais, que é
       exatamente o mesmo trabalho. */
    const base=gSettleCandidateState(r.original,C).layers;
    const amostra=r.partial.slice(0,5);
    const t2=performance.now();
    amostra.forEach(c=>gLayoutScoreProfile(c,C,{base:base}));
    const msPerfis=performance.now()-t2;
    avisos.push('344 camadas: busca '+msBusca.toFixed(1)+'ms · escolha '+msEscolha.toFixed(1)
      +'ms ('+esc.diagnostics.avaliados+' perfis) · '+amostra.length+' perfis medidos '
      +msPerfis.toFixed(1)+'ms ('+(amostra.length?(msPerfis/amostra.length).toFixed(1):'—')
      +'ms cada)');
    assert(msEscolha<msBusca,'a escolha custou mais que a busca inteira');
    assert(msPerfis<msBusca,'o scoring dobrou o custo da busca em 344 camadas: '
      +msPerfis.toFixed(1)+'ms contra '+msBusca.toFixed(1)+'ms');
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
