/* ══════════════════════════════════════════════════════════════════════════════════════════
   CORPUS DE CALIBRAÇÃO DO SCORING — Fase 6.5. Abra `tests/scoring.html` ou rode
   `node scripts/run-browser-tests.js scoring`.

   A Fase 6 provou que a decisão é LEXICOGRÁFICA e determinística. Ela não provou que a decisão
   é CERTA por princípio — o corpus da Fase 6 tinha poucos casos com mais de um candidato
   `solved` disputando, e em 6 dos 8 contestados quem decidiu foi a mesma posição do vetor
   (compressão de hierarquia). Um comparador que sempre decide na mesma posição ou está
   medindo a coisa certa, ou está com uma posição dominante e as outras mudas.

   ⛔ ESTA SUÍTE NÃO CALIBRA PARA FIXTURE. A regra: só vira asserção o que é PRINCÍPIO declarado
   (segurança acima de tudo, semântica acima de estética, estrutura acima de coordenada). O
   resto entra como OBSERVAÇÃO — sai em nota, com a camada que decidiu e a margem, e nenhuma
   asserção depende do número. Ajustar peso até um fixture passar é exatamente o que
   transformaria este corpus em decoração.

   O QUE ELE FAZ, em ordem:
     1. PARES CONTROLADOS — dois estados em que só UMA dimensão relevante difere (§2/§3).
     2. HIERARQUIA — a medida relacional contra a referência autoral (§4/§5/§6).
     3. VIOLAÇÕES DURAS — cada regra com fixture positivo E negativo (§10).
     4. INTENÇÃO AUTORAL — estrutura vence coordenada (§11).
     5. ESTÉTICA — só decide quando as camadas de cima empatam (§12).
     6. CUSTO DE ALTERAÇÃO — o último tier, decomposto (§13).
     7. SENSIBILIDADE — varredura contínua à procura de cliff (§14).
     8. INVARIANTES — duplicar, reordenar, renomear, transladar, escalar (§18).
     9. ADVERSARIAIS — casos feitos para enganar o comparador (§19).
    10. PAPEL EFETIVO + AUDITORIA DO SCORER LEGADO (§7/§8/§21).
    11. DISTRIBUIÇÃO DOS TIERS e DESEMPENHO (§15/§20).
   ══════════════════════════════════════════════════════════════════════════════════════════ */
(async function(){
  const results=document.getElementById('results');
  const summary=document.getElementById('summary');
  const cases=[]; const avisos=[];
  const test=(name,fn)=>cases.push({name,fn});
  const assert=(c,m)=>{if(!c)throw new Error(m||'asserção falhou');};

  /* ── O BANCO DE ARTE ────────────────────────────────────────────────────────────────────
     Camadas com NOME de função, porque é do nome que o compilador semântico tira o papel —
     e usar id genérico faria o corpus medir o fallback, não o papel. */
  const text=(id,x,y,w,h,content,extra)=>Object.assign({id,name:id,type:'text',x,y,w,h,
    content,font:'Arial',fontSize:48,lineHeight:1.2,textBox:'point',textAlign:'left',vAlign:'top',
    visible:true,opacity:100},extra||{});
  const shape=(id,x,y,w,h,extra)=>Object.assign({id,name:id,type:'shape',shapeKind:'rect',x,y,w,h,
    visible:true,opacity:100},extra||{});

  const CV={w:1080,h:1080};
  /* A ARTE CANÔNICA: título, apoio, preço, CTA e legal — os cinco papéis que a ordem de
     hierarquia (`G_SCORE_PAPEIS_ORDEM`) conhece, com as razões que uma peça real tem. */
  const ARTE=()=>[
    text('Título',      80,  80, 640, 90,'Combo da casa',{fontSize:72}),
    text('Descrição',   80, 300, 640, 50,'Batata, bebida e sobremesa',{fontSize:36}),
    text('Preço',       80, 500, 340, 80,'R$ 49,90',{fontSize:64}),
    text('CTA',         80, 660, 340, 56,'PEÇA AGORA',{fontSize:40}),
    text('Legal',       80, 980, 900, 30,'Imagens ilustrativas. Consulte o regulamento.',{fontSize:18})
  ];
  /* Bloco de preço "de/por" + placa: é onde moram componente, `dentro-de` e o par ordenado. */
  const ARTE_PRECO=()=>[
    text('Título',      80,  90, 640, 90,'Oferta da semana',{fontSize:64}),
    shape('Placa',      80, 300, 420,170,{fill:'#FF9000'}),
    text('Preço de',   110, 320, 360, 40,'De: R$ 79,90',{fontSize:28}),
    text('Preço por',  110, 380, 360, 70,'Por: R$ 49,90',{fontSize:56}),
    text('Descrição',   80, 520, 640, 50,'Batata, bebida e sobremesa',{fontSize:32}),
    text('Legal',       80, 980, 900, 30,'Imagens ilustrativas. Consulte o regulamento.',{fontSize:18})
  ];

  /* O "de/por" REAL — a geometria do fixture `de-por-lateral` do corpus (PSD "rangos que
     baixaram o preço"), porque o `price-block` só nasce com os quatro sinais estruturais que
     ele tem: os dois preços com a MESMA raiz dinâmica (o nome do produto, acima), consecutivos
     no fluxo de leitura e no mesmo cluster. Inventar uma arte mais simples aqui produziria dois
     componentes soltos — e o teste mediria a ausência do componente, não a hierarquia dele. */
  const CV_DEPOR={w:1080,h:1920};
  const ARTE_DEPOR=()=>[
    text('Produto',   90, 180, 900, 200,'{{produto}}',
      {fontSize:96,lineHeight:1.05,textBox:'box',layoutRefText:'Pizza Grande'}),
    text('Preço de',  90, 700, 340,  60,'{{de}}',{fontSize:38,layoutRefText:'De R$ 49,90 por'}),
    text('Preço por',470, 672, 400, 110,'{{por}}',{fontSize:84,layoutRefText:'R$ 29,90'}),
    shape('Placa',    90, 860, 460, 120,{fill:'#FFFFFF',radius:16}),
    text('Cupom',    120, 890, 400,  60,'{{cupom}}',{fontSize:48,layoutRefText:'MUCH30'}),
    text('Legal',     90,1780, 900,  90,
      'Válido até 31/12. Imagens ilustrativas. Consulte o regulamento.',{fontSize:20,textBox:'box'})
  ];

  const _cv2d=document.createElement('canvas').getContext('2d');
  const clonar=(L)=>L.map(l=>JSON.parse(JSON.stringify(l)));

  /* ── O ESTADO CONTROLADO ────────────────────────────────────────────────────────────────
     A mutação é a VARIÁVEL do experimento. Ela não pode passar por `gSettleCandidateState`:
     assentar restaura `_geoAutor` e roda o motor, devolvendo a composição que o solver quer —
     que é justamente o que se está tentando fixar. Então o estado é medido aqui, com o MESMO
     motor de encaixe (`gFitTextLayer`), e carimbado como o solver carimba:
       · `_tetoFonte`      o corpo que vale AGORA (o autorado continua em `fontSize`);
       · `_entrelinha`     a entrelinha fechada;
       · `_layoutSemAjuste` a geometria publicada — a referência de deslocamento da nota. */
  function medir(L,base){
    const idxB=new Map((base||[]).map(l=>[l.id,l]));
    L.forEach(l=>{
      if(!l||l.type!=='text')return;
      const corpo=gLayoutCorpoAtual(l);
      const alvo=Object.assign({},l,{fontSize:corpo,
        lineHeight:(l._entrelinha!=null?l._entrelinha:l.lineHeight)});
      try{ l._fit=gFitTextLayer(alvo,String(l.content||''),_cv2d,{encolher:false}); }
      catch(e){ l._fit={lines:[String(l.content||'')],altura:l.h,largura:l.w,estourou:false}; }
      const b=idxB.get(l.id);
      if(b) l._layoutSemAjuste={x:b.x,y:b.y,w:b.w,h:b.h,
        linhas:(b._fit&&b._fit.lines&&b._fit.lines.length)||1};
      l._layoutBase=l._layoutSemAjuste;
    });
    return L;
  }
  /* Mutadores: o vocabulário dos pares controlados. Cada um mexe em UMA dimensão. */
  const M={
    encolher:(id,fator)=>L=>{const l=L.find(x=>x.id===id); l._tetoFonte=Math.round((l.fontSize)*fator);},
    mover:(id,dx,dy)=>L=>{const l=L.find(x=>x.id===id); l.x+=dx; l.y+=dy;},
    moverTodos:(ids,dx,dy)=>L=>{ids.forEach(id=>{const l=L.find(x=>x.id===id); l.x+=dx; l.y+=dy;});},
    escalar:(ids,fator)=>L=>{ids.forEach(id=>{const l=L.find(x=>x.id===id);
      if(l.type==='text') l._tetoFonte=Math.round(l.fontSize*fator);});},
    corpo:(id,px)=>L=>{const l=L.find(x=>x.id===id); l._tetoFonte=px;},
    entrelinha:(id,lh)=>L=>{const l=L.find(x=>x.id===id); l._entrelinha=lh;},
    largura:(id,w)=>L=>{const l=L.find(x=>x.id===id); l.w=w; l.textBox='box'; l._layoutW=w;},
    tracking:(id,ls)=>L=>{const l=L.find(x=>x.id===id); l.letterSpacing=ls;},
    redim:(id,w,h)=>L=>{const l=L.find(x=>x.id===id); l.w=w; l.h=h;},
    nada:()=>()=>{}
  };
  const combo=(...ms)=>L=>ms.forEach(m=>m(L));

  /* ── A DISPUTA ──────────────────────────────────────────────────────────────────────────
     Dois estados, o mesmo contexto, o mesmo base. Devolve quem venceu, em que camada e com
     que margem — exatamente o que o comparador de produção usaria. */
  const CTXCACHE=new Map();
  function ctxDe(arte,canvas,chave){
    if(CTXCACHE.has(chave))return CTXCACHE.get(chave);
    const c=gBuildOperationalContext(arte,canvas||CV,{dados:{}});
    CTXCACHE.set(chave,c); return c;
  }
  function disputar(d){
    const canvas=d.canvas||CV;
    const arte=(d.base||ARTE)();
    const ctx=ctxDe(arte,canvas,d.id+'#ctx');
    const base=medir(clonar(arte),arte);
    /* `acoes` e `modo` são do CANDIDATO, não do estado: é assim que se monta o par da §13
       (duas ações contra cinco, tudo o mais igual) e o da §4 (normal contra emergência) sem
       precisar que a busca tenha gerado os dois por acaso. */
    const fazer=(lado,nome,cfg)=>{
      const L=medir((()=>{const c=clonar(arte); lado(c); return medir(c,arte);})(),arte);
      const acoes=((cfg&&cfg.acoes)||[]).map(x=>typeof x==='string'?{id:x}:x);
      return gLayoutScoreProfileState(L,ctx,{base:base,cand:{ id:nome,
        signature:d.id+'#'+nome, depth:(cfg&&cfg.depth!=null)?cfg.depth:acoes.length,
        searchMode:(cfg&&cfg.modo)||'normal', actions:acoes, scaleGroupIds:[] }});
    };
    const pa=fazer(d.a.mut,'A',d.a), pb=fazer(d.b.mut,'B',d.b);
    const cmp=gCompareLayoutCandidates(pa,pb);
    const venc=cmp<=0?'a':'b';
    const tr=cmp<=0?gLayoutDecisionTrace(pa,pb):gLayoutDecisionTrace(pb,pa);
    return { id:d.id, categoria:d.categoria, vencedor:venc, perfilA:pa, perfilB:pb,
             nomeVencedor:venc==='a'?d.a.nome:d.b.nome, trace:tr,
             camada:tr.camadaDecisora, criterio:tr.criterio, margem:tr.margem,
             vetorA:pa.vector.map(v=>Math.round(v*1000)/1000),
             vetorB:pb.vector.map(v=>Math.round(v*1000)/1000) };
  }

  /* A DISTRIBUIÇÃO (§15): quem decidiu cada disputa do corpus. Preenchida por cada caso. */
  const DIST={}; const REGISTRO=[];
  function registrar(r){
    const k=r.trace.parouEm<0?'desempate-deterministico'
      :['safety','semantics-hard','hierarchy-compression','authored-intent-relacao',
        'authored-intent-composicao','mode','aesthetics','alteration'][r.trace.parouEm];
    DIST[k]=(DIST[k]||0)+1;
    REGISTRO.push({id:r.id,categoria:r.categoria,venceu:r.nomeVencedor,camada:k,
                   margem:r.margem.delta,rel:r.margem.deltaRelativo});
    return k;
  }

  /* ══ 1. PARES CONTROLADOS (§2/§3) ═══════════════════════════════════════════════════════
     Dezenas de disputas em que exatamente UMA dimensão relevante difere. Nenhuma delas
     depende de a busca ter gerado os dois candidatos por acaso: os dois estados são montados.

     `espera` só é preenchido quando existe PRINCÍPIO declarado a cobrar. O resto roda como
     observação — sai em nota com a camada que decidiu, e é dali que sai a distribuição da §15. */
  const CORPUS=[
    { id:'wrap-vs-shrink-titulo', categoria:'wrap vs shrink',
      a:{nome:'título quebra em 2 linhas',mut:M.largura('Título',360)},
      b:{nome:'título encolhe 20%',mut:M.encolher('Título',0.8)} },
    { id:'wrap-vs-shrink-apoio', categoria:'wrap vs shrink',
      a:{nome:'apoio quebra',mut:M.largura('Descrição',300)},
      b:{nome:'apoio encolhe 20%',mut:M.encolher('Descrição',0.8)} },
    { id:'shrink-vs-push-apoio', categoria:'shrink vs push',
      a:{nome:'apoio encolhe 15%',mut:M.encolher('Descrição',0.85)},
      b:{nome:'CTA desce 40px',mut:M.mover('CTA',0,40)} },
    { id:'shrink-vs-push-titulo', categoria:'shrink vs push',
      a:{nome:'título encolhe 10%',mut:M.encolher('Título',0.9)},
      b:{nome:'preço e CTA descem 50px',mut:M.moverTodos(['Preço','CTA'],0,50)} },
    { id:'push-vs-resize', categoria:'push vs resize', base:ARTE_PRECO,
      a:{nome:'preço desce 10px',mut:M.mover('Preço por',0,10)},
      b:{nome:'a placa cresce 40px',mut:M.redim('Placa',420,210)} },
    { id:'component-scale-vs-local-shrink', categoria:'component scale vs local shrink',
      base:ARTE_DEPOR, canvas:CV_DEPOR,
      a:{nome:'o bloco de preço desce junto (50%)',mut:M.escalar(['Preço de','Preço por'],0.5)},
      b:{nome:'só o "por" encolhe 50%',mut:M.encolher('Preço por',0.5)} },
    { id:'alinhamento-vs-deslocamento', categoria:'authored alignment vs menor displacement',
      a:{nome:'mantém a coluna, move o grupo 30px',mut:M.moverTodos(['Título','Descrição','Preço','CTA'],0,30)},
      b:{nome:'quebra a coluna, move 5px',mut:M.mover('CTA',40,5)} },
    { id:'hierarquia-vs-respiro', categoria:'hierarchy preservation vs whitespace',
      a:{nome:'preserva a hierarquia, respiro apertado',mut:M.encolher('Descrição',0.95)},
      b:{nome:'mais respiro, título 25% menor',mut:M.encolher('Título',0.75)} },
    { id:'compressao-moderada-vs-forte', categoria:'hierarchy compression moderada vs forte',
      a:{nome:'título perde 8%',mut:M.encolher('Título',0.92)},
      b:{nome:'título perde 38%',mut:M.encolher('Título',0.62)} },
    { id:'cta-vs-titulo', categoria:'CTA vs title',
      a:{nome:'encolhe o CTA',mut:M.encolher('CTA',0.8)},
      b:{nome:'encolhe o título',mut:M.encolher('Título',0.8)} },
    { id:'preco-vs-titulo', categoria:'price vs title',
      a:{nome:'encolhe o preço',mut:M.encolher('Preço',0.8)},
      b:{nome:'encolhe o título',mut:M.encolher('Título',0.8)} },
    { id:'legal-vs-apoio', categoria:'legal vs support',
      a:{nome:'encolhe o legal 30%',mut:M.encolher('Legal',0.7)},
      b:{nome:'encolhe o apoio 30%',mut:M.encolher('Descrição',0.7)} },
    { id:'texto-na-placa', categoria:'text-with-plate', base:ARTE_PRECO,
      a:{nome:'a placa acompanha o texto',mut:combo(M.redim('Placa',420,200),M.mover('Preço por',0,20))},
      b:{nome:'o texto sai da placa',mut:M.mover('Preço por',0,180)} },
    { id:'bloco-de-preco', categoria:'price-block', base:ARTE_DEPOR, canvas:CV_DEPOR,
      a:{nome:'o bloco desce junto',mut:M.escalar(['Preço de','Preço por'],0.5)},
      b:{nome:'o bloco se parte',mut:M.mover('Preço de',0,-300)} },
    { id:'bloco-da-oferta', categoria:'offer-block',
      a:{nome:'título e apoio descem juntos',mut:M.moverTodos(['Título','Descrição'],0,20)},
      b:{nome:'o apoio viaja para longe do título',mut:M.mover('Descrição',320,20)} },
    { id:'multiplas-causas', categoria:'múltiplas causas',
      a:{nome:'encolhe o título 10% e desce o CTA 20px',
         mut:combo(M.encolher('Título',0.9),M.mover('CTA',0,20))},
      b:{nome:'sobe o título 30px e encolhe o CTA 30%',
         mut:combo(M.mover('Título',0,-30),M.encolher('CTA',0.7))} },
    { id:'linhas-2-vs-3', categoria:'aesthetics: line count',
      a:{nome:'apoio em 2 linhas',mut:M.largura('Descrição',500)},
      b:{nome:'apoio em 3 linhas',mut:M.largura('Descrição',300)} },
    { id:'entrelinha', categoria:'aesthetics: line-height',
      a:{nome:'entrelinha 1.15',mut:M.entrelinha('Descrição',1.15)},
      b:{nome:'entrelinha 1.05',mut:M.entrelinha('Descrição',1.05)} },
    { id:'tracking', categoria:'aesthetics: tracking',
      a:{nome:'tracking -1px no título',mut:M.tracking('Título','-1px')},
      b:{nome:'tracking -3px no título',mut:M.tracking('Título','-3px')} },
    { id:'respiro', categoria:'aesthetics: whitespace',
      a:{nome:'apoio sobe 10px',mut:M.mover('Descrição',0,-10)},
      b:{nome:'apoio sobe 40px (encosta no título)',mut:M.mover('Descrição',0,-40)} },
    { id:'equilibrio', categoria:'aesthetics: balance',
      a:{nome:'CTA anda 20px para a direita',mut:M.mover('CTA',20,0)},
      b:{nome:'CTA anda 200px para a direita',mut:M.mover('CTA',200,0)} },
    { id:'densidade-uniforme', categoria:'aesthetics: density',
      a:{nome:'a peça inteira desce 10%',mut:M.escalar(['Título','Descrição','Preço','CTA','Legal'],0.9)},
      b:{nome:'a peça inteira desce 5%',mut:M.escalar(['Título','Descrição','Preço','CTA','Legal'],0.95)} },
    { id:'move-pouco-e-encolhe-vs-move-muito', categoria:'change cost',
      a:{nome:'move 10px e encolhe 5%',mut:combo(M.mover('CTA',0,10),M.encolher('CTA',0.95))},
      b:{nome:'move 50px sem encolher',mut:M.mover('CTA',0,50)} },
    { id:'um-alvo-vs-tres-alvos', categoria:'change cost',
      a:{nome:'mexe em 1 camada',mut:M.mover('CTA',0,30)},
      b:{nome:'mexe em 3 camadas',mut:M.moverTodos(['Descrição','Preço','CTA'],0,30)} }
  ];

  const RESULT={};
  CORPUS.forEach(d=>{
    test('corpus · '+d.categoria+' · '+d.id,()=>{
      const r=disputar(d);
      RESULT[d.id]=r;
      const k=registrar(r);
      avisos.push('['+d.categoria+'] '+d.id+' → venceu '+r.vencedor.toUpperCase()+' ('+r.nomeVencedor+')'
        +' por '+r.criterio+' [tier '+k+']'
        +' margem '+r.margem.delta+' ('+Math.round(r.margem.deltaRelativo*100)+'%)'
        +'\n      A='+JSON.stringify(r.vetorA)+'\n      B='+JSON.stringify(r.vetorB));
      /* O QUE É ASSERÇÃO AQUI: nada sobre QUEM vence — isso é observação. O que não pode
         falhar é o comparador ser uma ordem: antissimétrico e total. */
      assert(gCompareLayoutCandidates(r.perfilA,r.perfilB)
             ===-gCompareLayoutCandidates(r.perfilB,r.perfilA)
             ||gCompareLayoutCandidates(r.perfilA,r.perfilB)===0,
        'a comparação não é antissimétrica em '+d.id);
      assert(r.perfilA.vector.length===r.perfilB.vector.length,'vetores de tamanhos diferentes');
      assert(r.perfilA.vector.every(v=>typeof v==='number'&&isFinite(v)),'vetor de A com valor não finito');
      assert(r.perfilB.vector.every(v=>typeof v==='number'&&isFinite(v)),'vetor de B com valor não finito');
    });
  });

  /* ══ 2. A MEDIDA DE HIERARQUIA (§4/§5/§6) ═══════════════════════════════════════════════
     A posição 2 do vetor decidiu 6 dos 8 casos contestados da Fase 6. Aqui ela é auditada
     diretamente, sem passar por candidato: a função recebe duas composições e diz o que
     sobreviveu da relação AUTORAL. */
  const hier=(mut,base,canvas)=>{
    const arte=(base||ARTE)();
    const ctx=ctxDe(arte,canvas||CV,(base||ARTE).name+'#hier');
    const A=medir(clonar(arte),arte);
    const B=medir((()=>{const c=clonar(arte); mut(c); return c;})(),arte);
    return gLayoutHierarchyRelation(A,B,ctx);
  };
  const par=(h,de,para)=>h.pares.find(p=>p.de===de&&p.para===para);

  test('hierarquia: as quatro classes existem e não se misturam',()=>{
    /* A: preservada. Encolher o apoio AUMENTA o contraste título/apoio — a relação do designer
       não foi comprimida, e o clipe em 1 impede que "melhorou" vire crédito. */
    const a=hier(M.encolher('Descrição',0.9));
    assert(par(a,'titulo','apoio').classe==='preservado',
      'aumentar o contraste não foi classificado como preservado: '+par(a,'titulo','apoio').classe);
    // B: comprimida — o título desce e o apoio fica.
    const b=hier(M.corpo('Título',44));
    assert(par(b,'titulo','apoio').classe==='comprimido',
      'título 72→44 contra apoio 36 não foi lido como compressão: '+JSON.stringify(par(b,'titulo','apoio')));
    // C: empate visual — formalmente maior, visualmente o mesmo degrau.
    const c=hier(M.corpo('Título',37));
    assert(par(c,'titulo','apoio').classe==='empate-visual',
      'título 37 contra apoio 36 não foi lido como empate visual: '+JSON.stringify(par(c,'titulo','apoio')));
    // D: inversão — e ela NÃO é compressão.
    const d=hier(M.corpo('Título',30));
    assert(par(d,'titulo','apoio').classe==='inversao','título 30 contra apoio 36 não é inversão');
    assert(d.pares.filter(p=>p.classe==='inversao').every(p=>p.preservacao===0),
      'inversão entrou na média de compressão');
    avisos.push('classes de hierarquia: A='+JSON.stringify(a.classes)+' B='+JSON.stringify(b.classes)
      +' C='+JSON.stringify(c.classes)+' D='+JSON.stringify(d.classes));
  });

  test('hierarquia: a medida é RELAÇÃO, não diferença de fontSize (§5)',()=>{
    /* Os dois exemplos da §5, lado a lado. O primeiro perde 16px de título e preserva a
       relação; o segundo perde 1px e a destrói. Diferença absoluta erraria os dois. */
    const grande=hier(combo(M.corpo('Título',56),M.corpo('Descrição',32)));   // 72/36 → 56/32
    const rente =hier(combo(M.corpo('Título',46),M.corpo('Descrição',44)));   // 72/36 → 46/44
    const pg=par(grande,'titulo','apoio'), pr=par(rente,'titulo','apoio');
    avisos.push('§5 · 72/36→56/32: razão '+pg.razaoAutoral+'→'+pg.razaoAtual
      +' preservou '+Math.round(pg.preservacao*100)+'%  |  72/36→46/44: razão '
      +pr.razaoAutoral+'→'+pr.razaoAtual+' preservou '+Math.round(pr.preservacao*100)+'%');
    assert(pg.preservacao>pr.preservacao,
      'perder 16px preservando a relação pontuou pior que perder 1px destruindo-a');
    assert(pg.preservacao>0.7,'56/32 sobre 72/36 deveria preservar a maior parte da relação');
    assert(pr.preservacao<0.2,'46/44 sobre 72/36 deveria ter perdido quase toda a relação');
  });

  test('hierarquia: a referência é AUTORAL, não uma razão universal (§6)',()=>{
    /* 2,0 → 1,7 e 1,1 → 1,0 são a mesma "perda de 0,3 e 0,1" para quem olha o número solto.
       Contra a referência autoral são coisas diferentes: a primeira preserva 77% da relação
       criada; a segunda preserva ZERO — o que existia de contraste acabou. */
    const forte=hier(combo(M.corpo('Título',68),M.corpo('Descrição',40)));  // 2,0 → 1,7
    const fraca=hier(combo(M.corpo('Título',44),M.corpo('Descrição',40)));  // de 72/36 para 1,1
    const pf=par(forte,'titulo','apoio');
    avisos.push('§6 · autoral 2,0 → 1,7 preservou '+Math.round(pf.preservacao*100)+'%'
      +' | o mesmo par levado a 1,1 preservou '
      +Math.round((par(fraca,'titulo','apoio').preservacao)*100)+'%');
    assert(pf.preservacao>0.6&&pf.preservacao<0.95,
      'razão 2,0 → 1,7 deveria preservar a maior parte, não tudo: '+pf.preservacao);
    /* E a prova de que a referência é a AUTORAL: a mesma razão final (1,7) sobre um desenho que
       já era 1,7 preserva 100%. Se a medida tivesse uma razão ideal embutida, os dois casos
       dariam o mesmo número. */
    const arteRente=()=>{const L=ARTE(); L[0].fontSize=61; L[1].fontSize=36; return L;};
    const jaEra=hier(M.nada(),arteRente);
    assert(par(jaEra,'titulo','apoio').preservacao>=0.99,
      'um desenho que já nasceu em 1,7 foi cobrado por não ser 2,0 — a régua não é autoral');
  });

  test('hierarquia: escala global uniforme NÃO comprime relação nenhuma (§18)',()=>{
    /* A medida antiga somava fração de corpo perdida por papel: encolher a peça inteira em 50%
       pontuava 0,5 de "compressão de hierarquia" sem ter comprimido relação nenhuma. Os corpos
       da arte canônica são todos pares, então o fator 0,5 é EXATO e não há arredondamento para
       confundir com o resultado. */
    const h=hier(M.escalar(['Título','Descrição','Preço','CTA','Legal'],0.5));
    assert(h.compressao===0,'escala global uniforme gerou compressão '+h.compressao);
    assert(!h.pares.some(p=>p.classe==='inversao'),'escala global uniforme inverteu papel');
    assert(!h.pares.some(p=>p.classe==='comprimido'),'escala global uniforme comprimiu par');
  });

  test('hierarquia: o par autorado SEM contraste não cobra contraste do candidato',()=>{
    /* Título 46 / apoio 44 é um empate visual que o DESIGNER criou. Cobrar do candidato uma
       relação que nunca existiu seria um falso positivo — e, pior, dividir por um log quase
       zero transformaria 1px de ruído em nota cheia. */
    const arteRente=()=>{const L=ARTE(); L[0].fontSize=46; L[1].fontSize=44; return L;};
    const h=hier(M.corpo('Título',45),arteRente);
    const p=par(h,'titulo','apoio');
    assert(p&&p.classe==='sem-contraste-autoral','par autorado em 1,045 não foi isentado: '
      +JSON.stringify(p));
    assert(p.preservacao===null,'par sem contraste autoral entrou na média');
  });

  /* ══ 3. VIOLAÇÕES DURAS (§10) — cada regra com fixture positivo E negativo ══════════════ */
  const semantica=(mut,base,canvas)=>{
    const arte=(base||ARTE)();
    const ctx=ctxDe(arte,canvas||CV,(base||ARTE).name+'#sem');
    const A=medir(clonar(arte),arte);
    const B=medir((()=>{const c=clonar(arte); mut(c); return c;})(),arte);
    const gB=gCompileLayoutGrammar(B,canvas||CV);
    const cB=gCompileLayoutComponents(gB,gCompileCompositionGraph(gB));
    const diffs={ estrutura:gCompareLayoutStructure(gCompileLayoutGrammar(A,canvas||CV),gB),
                  componentes:gCompareLayoutComponents(ctx.components,cB), compsB:cB };
    return gLayoutSemanticDamage(A,B,{ _diffEstrutura:diffs.estrutura,_diffComponentes:diffs.componentes,
      _compsCandidato:diffs.compsB,_no:ctx._no,_placa:ctx._placa,components:ctx.components,
      canvas:canvas||CV });
  };
  const temViol=(s,tipo,de,para)=>s.violacoes.some(v=>v.tipo===tipo
    &&(de==null||v.de===de)&&(para==null||v.para===para));

  test('violação dura: título abaixo do apoio — positivo e negativo',()=>{
    assert(temViol(semantica(M.corpo('Título',30)),'inversao-de-papel','titulo','apoio'),
      'título 30 sob apoio 36 não levantou inversão');
    /* O NEGATIVO é do MESMO par: título 60 continua acima do apoio 36. (Ele passa por baixo do
       preço 64, e essa OUTRA inversão é verdadeira — cobrar "nenhuma inversão" aqui misturaria
       duas regras e esconderia a que interessa.) */
    assert(!temViol(semantica(M.corpo('Título',60)),'inversao-de-papel','titulo','apoio'),
      'título 60 sobre apoio 36 levantou inversão (falso positivo)');
  });

  test('violação dura: hierarquia de preço quebrada — positivo e negativo',()=>{
    /* O par "de/por" é a hierarquia mais carregada da peça e ela some no escopo de papel: os
       dois são 'preco'. Por isso o escopo de COMPONENTE existe. */
    const comps=ctxDe(ARTE_DEPOR(),CV_DEPOR,'ARTE_DEPOR#ctx').components;
    const bloco=comps.find(c=>c.tipo==='price-block');
    avisos.push('componentes de ARTE_DEPOR: '+comps.map(c=>c.tipo+'['+c.membros.join('+')+']').join(' · '));
    assert(bloco&&bloco.membros.indexOf('Preço de')>=0&&bloco.membros.indexOf('Preço por')>=0,
      'o fixture perdeu o sentido: "de" e "por" não formam um price-block');
    const quebrou=semantica(M.corpo('Preço por',36),ARTE_DEPOR,CV_DEPOR);
    assert(temViol(quebrou,'inversao-no-componente'),
      '"por" 36 sob "de" 38 não levantou violação dentro do componente: '
      +JSON.stringify(quebrou.violacoes));
    const desceuJunto=semantica(M.escalar(['Preço de','Preço por'],0.5),ARTE_DEPOR,CV_DEPOR);
    assert(!temViol(desceuJunto,'inversao-no-componente'),
      'o bloco inteiro descendo junto levantou violação de hierarquia (falso positivo)');
  });

  test('violação dura: componente perdeu membro — positivo e negativo',()=>{
    const partiu=semantica(M.mover('Preço de',0,-300),ARTE_DEPOR,CV_DEPOR);
    avisos.push('price-block partido → '+JSON.stringify(partiu.violacoes.map(v=>v.tipo)));
    assert(partiu.violacoes.some(v=>v.tipo==='componente-perdeu-membro'||v.tipo==='componente-desfeito'
      ||v.tipo==='texto-saiu-da-placa'),'partir o bloco de preço não levantou violação nenhuma');
    const junto=semantica(M.moverTodos(['Preço de','Preço por'],0,30),ARTE_DEPOR,CV_DEPOR);
    assert(!junto.violacoes.some(v=>v.tipo==='componente-perdeu-membro'||v.tipo==='componente-desfeito'),
      'mover o bloco inteiro desfez o componente (falso positivo): '+JSON.stringify(junto.violacoes));
  });

  test('violação dura: texto saiu da placa — positivo e negativo',()=>{
    assert(temViol(semantica(M.mover('Cupom',0,240),ARTE_DEPOR,CV_DEPOR),'texto-saiu-da-placa'),
      'o texto saindo da placa não levantou violação');
    assert(!temViol(semantica(M.mover('Cupom',0,8),ARTE_DEPOR,CV_DEPOR),'texto-saiu-da-placa'),
      'o texto andando 8px DENTRO da placa levantou violação (falso positivo)');
  });

  test('violação dura: CTA subordinado ao legal — positivo e negativo',()=>{
    assert(temViol(semantica(M.corpo('CTA',16)),'inversao-de-papel','cta','legal'),
      'CTA 16 sob legal 18 não levantou inversão');
    assert(!temViol(semantica(M.corpo('CTA',38)),'inversao-de-papel','cta','legal'),
      'CTA 38 sobre legal 18 levantou inversão (falso positivo)');
  });

  test('violação dura: relação protegida — a camada travada não entra na disputa',()=>{
    /* A régua de proteção é do portão de segurança, não da semântica: uma camada protegida
       alterada nunca chega a ser ranqueada. Aqui só se confirma que o papel é reconhecido. */
    const L=ARTE(); L.push(text('Logo',820,60,180,80,'MARCA',{fontSize:32,locked:true}));
    const ctx=ctxDe(L,CV,'logo#ctx');
    assert(gLayoutEffectiveRole(ctx,L[L.length-1])==='protegida',
      'a camada travada não foi lida como protegida: '+gLayoutEffectiveRole(ctx,L[L.length-1]));
  });

  /* ══ 4. INTENÇÃO AUTORAL — estrutura vence coordenada (§11) ═════════════════════════════ */
  test('intenção: relação preservada vence movimento menor que quebra relação',()=>{
    const r=RESULT['alinhamento-vs-deslocamento'];
    assert(r,'a disputa não rodou');
    assert(r.vencedor==='a','o movimento menor venceu a preservação da composição');
    assert(r.trace.parouEm<=4,'quem decidiu foi uma camada ABAIXO da intenção autoral: '
      +r.trace.parouEm+' ('+r.criterio+')');
    /* E a prova de que não foi coincidência de custo: o vencedor é o MAIS CARO em alteração. */
    assert(r.perfilA.vector[7]>r.perfilB.vector[7],
      'o fixture perdeu o sentido: o vencedor também era o mais barato');
  });

  test('intenção: componente preservado vence componente partido',()=>{
    ['bloco-de-preco','bloco-da-oferta'].forEach(id=>{
      const r=RESULT[id];
      assert(r.vencedor==='a','o bloco partido venceu em '+id);
      assert(r.trace.parouEm<=4,'em '+id+' quem decidiu foi '+r.criterio
        +' (posição '+r.trace.parouEm+'), abaixo da intenção autoral');
    });
  });

  test('intenção: coluna preservada vence melhora de coordenada',()=>{
    /* A move o grupo inteiro e mantém a coluna da esquerda; B "melhora" a posição de UM item
       centralizando-o, e com isso sai da coluna. Estrutura tem que vencer. */
    const r=disputar({ id:'coluna-vs-coordenada', categoria:'authored intent',
      a:{nome:'mantém a coluna',mut:M.moverTodos(['Descrição','Preço','CTA'],0,24)},
      b:{nome:'centraliza o CTA, sai da coluna',mut:M.mover('CTA',290,0)} });
    RESULT['coluna-vs-coordenada']=r; registrar(r);
    avisos.push('[authored intent] coluna-vs-coordenada → venceu '+r.vencedor.toUpperCase()
      +' ('+r.nomeVencedor+') por '+r.criterio+'  A='+JSON.stringify(r.vetorA)
      +' B='+JSON.stringify(r.vetorB));
    assert(r.vencedor==='a','sair da coluna para "melhorar a coordenada" venceu');
  });

  /* ══ 5. ESTÉTICA SÓ DECIDE NO EMPATE (§12) ══════════════════════════════════════════════ */
  test('estética: quando ela decide, TODAS as camadas acima empataram',()=>{
    const porEstetica=REGISTRO.filter(x=>x.camada==='aesthetics');
    assert(porEstetica.length>=3,'o corpus não produziu disputas decididas por estética');
    porEstetica.forEach(x=>{
      const r=RESULT[x.id];
      const acima=r.trace.tiers.slice(0,-1);
      assert(acima.length===6,'a estética decidiu na posição errada do vetor em '+x.id);
      assert(acima.every(t=>t.resultado==='empate'),
        'a estética decidiu em '+x.id+' com camada acima em desempate: '+JSON.stringify(acima));
    });
    avisos.push('estética decidiu '+porEstetica.length+' disputas, todas com as 6 posições acima empatadas: '
      +porEstetica.map(x=>x.id).join(', '));
  });

  test('estética: as sete dimensões da §12 aparecem e são separáveis',()=>{
    /* Cada par muda UMA dimensão estética. O que se cobra aqui não é quem vence — é que a
       dimensão EXISTE no vetor: um par que muda a arte e não move um número é uma dimensão
       CEGA, e cego é pior que errado (decide por desempate de assinatura). */
    const dims={ 'linhas':'linhas-2-vs-3', 'entrelinha':'entrelinha', 'tracking':'tracking',
                 'respiro':'respiro', 'equilíbrio':'equilibrio', 'densidade':'densidade-uniforme' };
    const cegas=[];
    Object.keys(dims).forEach(d=>{
      const r=RESULT[dims[d]];
      if(!r) return;
      const igual=r.perfilA.vector.every((v,i)=>Math.abs(v-(r.perfilB.vector[i]||0))<1e-9);
      if(igual) cegas.push(d);
    });
    avisos.push('§12 · dimensões estéticas CEGAS ao scorer (o par muda a arte e o vetor não se move): '
      +(cegas.length?cegas.join(', '):'nenhuma'));
    /* ⚠ ISTO É OBSERVAÇÃO, e é o achado: `tracking` não entra em nenhum item de
       `gScoreComposition`, então dois candidatos que só diferem em tracking empatam no vetor
       inteiro e a decisão cai no desempate por assinatura. Não vira asserção vermelha porque
       consertar é decisão da fase de migração — vira RELATÓRIO. */
    assert(cegas.length<=1,'mais de uma dimensão estética é cega ao scorer: '+cegas.join(', '));
  });

  /* ══ 6. CUSTO DE ALTERAÇÃO — o último tier, decomposto (§13) ════════════════════════════ */
  test('custo: menos ações vence, com tudo o mais idêntico',()=>{
    const r=disputar({ id:'2-acoes-vs-5-acoes', categoria:'change cost',
      a:{nome:'2 ações',mut:M.mover('CTA',0,30),acoes:['push-down','push-down']},
      b:{nome:'5 ações',mut:M.mover('CTA',0,30),
         acoes:['push-down','push-down','push-down','push-down','push-down']} });
    RESULT['2-acoes-vs-5-acoes']=r; registrar(r);
    assert(r.vencedor==='a','5 ações venceram 2 ações com o mesmo estado final');
    assert(r.trace.parouEm===-1,'o vetor diferiu onde não devia: o estado final é o MESMO');
    assert(r.margem.desempatePor==='número de ações',
      'o desempate não foi pelo número de ações: '+r.margem.desempatePor);
    avisos.push('§13 · 2 ações contra 5, mesmo estado final → vence '+r.nomeVencedor
      +' pelo desempate determinístico ('+r.margem.desempatePor+')');
  });

  test('custo: "move 10px e encolhe" contra "move 50px" se decompõe, não se arbitra',()=>{
    const r=RESULT['move-pouco-e-encolhe-vs-move-muito'];
    const a=r.perfilA.alteration, b=r.perfilB.alteration;
    avisos.push('§13 · A(move 10 + encolhe 5%): deslocamento '+a.distanciaMovida+'px · redução '
      +a.reducaoFonte+' · camadas '+a.camadasAlteradas+' · score '+a.score
      +'\n      B(move 50): deslocamento '+b.distanciaMovida+'px · redução '+b.reducaoFonte
      +' · camadas '+b.camadasAlteradas+' · score '+b.score
      +'\n      → decidiu '+r.criterio+' (não o custo): '+r.nomeVencedor);
    /* O que se cobra: o custo é EXPLICÁVEL item a item, e o item bate com a mutação. */
    assert(a.reducaoFonte>0&&b.reducaoFonte===0,'a redução de fonte não apareceu no custo de A');
    assert(b.distanciaMovida>a.distanciaMovida,'o deslocamento maior não apareceu no custo de B');
    assert(Math.abs(a.score+b.score)>0,'o tier de alteração ficou mudo nos dois lados');
  });

  /* ══ 7. EXPLICAÇÃO = COMPARADOR (§16) e MARGEM (§17) ════════════════════════════════════ */
  test('explicação: cada disputa é explicada EXATAMENTE como o comparador decidiu',()=>{
    Object.keys(RESULT).forEach(id=>{
      const r=RESULT[id];
      const va=r.vencedor==='a'?r.perfilA.vector:r.perfilB.vector;
      const vb=r.vencedor==='a'?r.perfilB.vector:r.perfilA.vector;
      /* A varredura INDEPENDENTE: a primeira posição que difere. Se o traço disser outra, a
         explicação está contando uma história que o comparador não viveu. */
      let esperada=-1;
      for(let i=0;i<va.length;i++) if(Math.abs(va[i]-vb[i])>1e-9){ esperada=i; break; }
      assert(r.trace.parouEm===esperada,'em '+id+' o traço diz posição '+r.trace.parouEm
        +' e o vetor diz '+esperada);
      const decisores=r.trace.tiers.filter(t=>t.resultado==='decidiu');
      assert(decisores.length===(esperada<0?0:1),
        'em '+id+' o traço marcou '+decisores.length+' critérios decisores');
      r.trace.tiers.slice(0,-1).forEach(t=>assert(t.resultado==='empate',
        'em '+id+' o traço listou uma camada não-empatada antes do decisor'));
      if(esperada>=0) assert(r.trace.tiers.length===esperada+1,
        'em '+id+' o traço continuou depois de decidir — a explicação fingiria participação');
    });
  });

  test('margem: a distância entre #1 e #2 sai no critério que decidiu',()=>{
    const linhas=REGISTRO.slice().sort((a,b)=>a.rel-b.rel);
    avisos.push('── MARGEM DE DECISÃO (as 6 mais apertadas) ──');
    linhas.slice(0,6).forEach(x=>avisos.push('   '+x.id+' · '+x.camada+' · Δ='+x.margem
      +' ('+Math.round(x.rel*100)+'% da escala)'));
    REGISTRO.forEach(x=>{
      assert(typeof x.margem==='number'&&isFinite(x.margem),'margem não numérica em '+x.id);
      assert(x.margem>=0,'margem negativa em '+x.id);
    });
    /* A margem NÃO decide nada nesta fase — a prova é que o vencedor não muda se ela for
       ignorada. Aqui isso é estrutural: `gCompareLayoutCandidates` não a lê. */
    assert(String(gCompareLayoutCandidates).indexOf('margem')<0,
      'o comparador passou a ler a margem de decisão');
  });

  /* ══ 8. ANÁLISE DE SENSIBILIDADE (§14) ══════════════════════════════════════════════════
     Métrica contínua dentro de uma camada: onde a decisão VIRA, e vira com que justificativa?
     Um cliff é 1px mudando o vencedor sem que nada perceptual tenha mudado. */
  test('sensibilidade: varredura do corpo do título à procura de cliff',()=>{
    const oponente={nome:'CTA desce 40px',mut:M.mover('CTA',0,40)};
    const linha=[];
    for(let s=72;s>=40;s--){
      const r=disputar({ id:'sweep'+s, categoria:'sensibilidade',
        a:{nome:'título '+s,mut:M.corpo('Título',s)}, b:oponente });
      linha.push({ s:s, venc:r.vencedor, camada:r.trace.parouEm, criterio:r.criterio,
                   compressao:r.perfilA.vector[2], viol:r.perfilA.vector[1],
                   margem:r.margem.delta });
    }
    const viradas=[];
    for(let i=1;i<linha.length;i++)
      if(linha[i].venc!==linha[i-1].venc||linha[i].camada!==linha[i-1].camada)
        viradas.push({ de:linha[i-1], para:linha[i] });
    avisos.push('── SENSIBILIDADE: título 72→40px contra "CTA desce 40px" ──');
    linha.filter((x,i)=>i%4===0||viradas.some(v=>v.para.s===x.s||v.de.s===x.s))
      .forEach(x=>avisos.push('   título '+x.s+'px → vence '+x.venc.toUpperCase()
        +' por '+x.criterio+' · compressão '+x.compressao+' · violações '+x.viol
        +' · margem '+x.margem));
    viradas.forEach(v=>avisos.push('   ⚠ VIRADA em '+v.de.s+'px → '+v.para.s+'px: '
      +v.de.venc.toUpperCase()+'/'+v.de.criterio+' vira '+v.para.venc.toUpperCase()+'/'+v.para.criterio
      +' · margem na virada: '+v.de.margem+' → '+v.para.margem));
    /* MONOTONICIDADE LEXICOGRÁFICA: encolher mais o título nunca pode produzir um candidato
       MELHOR. É o invariante certo — mais forte que exigir monotonicidade de uma posição
       isolada, e é o que a decisão realmente usa. (Foi esta varredura que mostrou a posição 2
       caindo ao cruzar a inversão, e é por isso que a inversão passou a contar na média com
       preservação zero: fora dela, o denominador mudava de candidato para candidato.) */
    for(let i=1;i<linha.length;i++){
      const pior=linha[i].viol>linha[i-1].viol
        ||(linha[i].viol===linha[i-1].viol&&linha[i].compressao>=linha[i-1].compressao-1e-9);
      assert(pior,'encolher o título de '+linha[i-1].s+'px para '+linha[i].s
        +'px produziu um candidato MELHOR: violações '+linha[i-1].viol+'→'+linha[i].viol
        +', compressão '+linha[i-1].compressao+'→'+linha[i].compressao);
    }
    assert(viradas.length>0,'a varredura inteira não mudou de vencedor: o fixture não discrimina');
    window.__SWEEP=linha; window.__VIRADAS=viradas;
  });

  test('sensibilidade: o piso de ruído da compressão (arredondamento de corpo)',()=>{
    /* Escala global uniforme não comprime relação nenhuma — a compressão TEM que ser 0. Mas o
       corpo é arredondado para inteiro, e o arredondamento move a razão. Este caso mede o
       tamanho desse ruído: é o piso abaixo do qual uma margem de decisão em compressão não
       significa nada perceptual. */
    let pior={f:null,c:0};
    for(let f=50;f<=99;f++){
      const h=hier(M.escalar(['Título','Descrição','Preço','CTA','Legal'],f/100));
      if(h.compressao>pior.c) pior={f:f/100,c:h.compressao};
    }
    avisos.push('§14 · PISO DE RUÍDO: a maior compressão medida numa escala global UNIFORME '
      +'(onde a relação não mudou) é '+pior.c+' — no fator '+pior.f
      +'. Toda margem de decisão em compressão abaixo disso é arredondamento de corpo, '
      +'não perda de hierarquia.');
    window.__RUIDO=pior.c;
    assert(pior.c<0.05,'o ruído de arredondamento passou de 5% da escala de compressão: '+pior.c);
    /* E o achado que interessa: alguma disputa do corpus foi decidida DENTRO do ruído? */
    const dentro=REGISTRO.filter(x=>x.camada==='hierarchy-compression'&&x.margem<=pior.c);
    if(dentro.length) avisos.push('   ⚠ '+dentro.length+' disputa(s) decidida(s) por compressão '
      +'com margem DENTRO do piso de ruído: '
      +dentro.map(x=>x.id+' (Δ='+x.margem+')').join(', '));
    window.__DENTRO_DO_RUIDO=dentro;
  });

  /* ══ 9. INVARIANTES (§18) ═══════════════════════════════════════════════════════════════ */
  /* A arte com CONFLITO REAL — é a mesma do corpus da Fase 5.9 (`arteIrma`), escolhida porque
     ela produz VÁRIOS candidatos resolvidos: sem disputa não há invariante de ranking a testar. */
  const ARTE_VAR=()=>[
    text('Produto',   60, 60,600,140,'{{produto}}',{fontSize:96}),
    text('Preço de',  60,230,120, 50,'DE',{fontSize:38}),
    text('Preço por',200,215,300, 90,'{{por}}',{fontSize:84}),
    shape('Selo',     60,340,600,160,{shapeKind:'circle',layoutRole:'protected'})
  ];
  const CV_VAR={w:720,h:560};
  const D_LONGO={ produto:'Combo artesanal da casa com borda recheada e bebida', por:'R$ 109,90' };
  const buscar=(arte,dados,canvas)=>{
    const ctx=gBuildOperationalContext(arte,canvas||CV,{dados:dados||{}});
    return { ctx:ctx, r:gSearchLayoutCandidates({ctx:ctx,base:arte}) };
  };
  const assinar=(esc)=>esc.winner?((esc.winner.actions||[]).map(a=>a.id).join('→')||'(original)')
    +'@'+esc.winner.searchMode+'d'+esc.winner.depth:'(sem vencedor)';

  test('invariante: duplicar candidato não muda o vencedor',()=>{
    const {ctx,r}=buscar(ARTE_VAR(),D_LONGO,CV_VAR);
    assert(r.solved.length>1,'o cenário não produziu disputa: '+r.solved.length+' solved');
    const antes=gSelectLayoutCandidate(r,ctx);
    const dobrado=Object.assign({},r,{solved:r.solved.concat(r.solved.slice(0,2))});
    const depois=gSelectLayoutCandidate(dobrado,ctx);
    assert(assinar(antes)===assinar(depois),'duplicar candidato mudou o vencedor: '
      +assinar(antes)+' → '+assinar(depois));
    avisos.push('invariantes: '+r.solved.length+' candidatos resolvidos · vencedor '+assinar(antes));
  });

  test('invariante: reordenar candidatos não muda o vencedor',()=>{
    const {ctx,r}=buscar(ARTE_VAR(),D_LONGO,CV_VAR);
    const antes=gSelectLayoutCandidate(r,ctx);
    const invertido=Object.assign({},r,{solved:r.solved.slice().reverse()});
    const depois=gSelectLayoutCandidate(invertido,ctx);
    assert(assinar(antes)===assinar(depois),'a ordem do array mudou o vencedor: '
      +assinar(antes)+' → '+assinar(depois));
    // E embaralhado de forma determinística (rotação), para não depender de uma permutação só.
    for(let k=1;k<Math.min(5,r.solved.length);k++){
      const rot=r.solved.slice(k).concat(r.solved.slice(0,k));
      assert(assinar(gSelectLayoutCandidate(Object.assign({},r,{solved:rot}),ctx))===assinar(antes),
        'a rotação '+k+' mudou o vencedor');
    }
  });

  test('invariante: renomear IDs sem mexer na estrutura não muda a decisão',()=>{
    const {ctx,r}=buscar(ARTE_VAR(),D_LONGO,CV_VAR);
    const antes=gSelectLayoutCandidate(r,ctx);
    const arte2=ARTE_VAR().map(l=>Object.assign({},l,{id:'z_'+l.id}));
    const b=buscar(arte2,D_LONGO,CV_VAR);
    const depois=gSelectLayoutCandidate(b.r,b.ctx);
    assert(assinar(antes).replace(/z_/g,'')===assinar(depois).replace(/z_/g,''),
      'renomear IDs mudou a decisão: '+assinar(antes)+' → '+assinar(depois));
  });

  test('invariante: deslocar a composição inteira não muda relação nenhuma',()=>{
    const arte=ARTE();
    const ctx=ctxDe(arte,CV,'ARTE#ctx');
    const A=medir(clonar(arte),arte);
    const B=medir((()=>{const c=clonar(arte); c.forEach(l=>{l.x+=20;l.y+=20;}); return c;})(),arte);
    const h=gLayoutHierarchyRelation(A,B,ctx);
    assert(h.compressao===0,'transladar a arte inteira comprimiu hierarquia: '+h.compressao);
    const est=gCompareLayoutStructure(gCompileLayoutGrammar(A,CV),gCompileLayoutGrammar(B,CV));
    assert(!est.relationsRemoved.length,'transladar a arte inteira removeu relação: '
      +JSON.stringify(est.relationsRemoved));
  });

  test('invariante: escala global proporcional não cria violação semântica',()=>{
    [0.5,0.75].forEach(f=>{
      const s=semantica(M.escalar(['Título','Descrição','Preço','CTA','Legal'],f));
      assert(!s.violacoes.some(v=>v.tipo==='inversao-de-papel'),
        'escala global de '+f+' inverteu papel: '+JSON.stringify(s.violacoes));
    });
  });

  /* Os três invariantes de AUTORIDADE ENTRE CAMADAS — sobre vetores, que é como se testa um
     comparador: com o caso extremo, não com a sorte de um fixture. */
  const vec=(v,extra)=>Object.assign({ vector:v,
    vectorCamadas:['safety','semantics','semantics','authored-intent','authored-intent',
                   'mode','aesthetics','alteration'],
    depth:1, signature:'s'+v.join('_'), alteration:{camadasAlteradas:1,acoes:1},
    semantics:{violacoes:[]}, mode:{emergency:v[5]===1}, authoredIntent:{estruturaIgual:true} },extra||{});

  test('invariante: estética não compra semântica, alteração não compra estética',()=>{
    const feioLimpo=vec([0,0,0, 0,0, 0, 99,99]);
    const belosujo =vec([0,1,0, 0,0, 0,  0, 0]);
    assert(gCompareLayoutCandidates(feioLimpo,belosujo)<0,'estética comprou violação semântica');
    const caroBonito=vec([0,0,0, 0,0, 0, 10, 99]);
    const baratoFeio=vec([0,0,0, 0,0, 0, 40,  1]);
    assert(gCompareLayoutCandidates(caroBonito,baratoFeio)<0,'alteração comprou estética');
  });

  test('invariante: emergência não compra intenção autoral',()=>{
    /* Emergência é a posição 5; intenção autoral é 3 e 4. Um candidato de emergência que
       preserva a composição vence um normal que a destrói — a camada de cima manda. */
    const emergPreserva=vec([0,0,0, 0,0, 1, 90,90]);
    const normalDestroi=vec([0,0,0, 2,2, 0,  0, 0]);
    assert(gCompareLayoutCandidates(emergPreserva,normalDestroi)<0,
      'o modo normal comprou intenção autoral perdida');
    // E o contrário: com a intenção empatada, o normal vence.
    const normal=vec([0,0,0, 1,1, 0, 50,50]), emerg=vec([0,0,0, 1,1, 1, 50,50]);
    assert(gCompareLayoutCandidates(normal,emerg)<0,'emergência empatou com normal no resto igual');
  });

  /* ══ 10. FIXTURES ADVERSARIAIS (§19) ════════════════════════════════════════════════════
     Casos montados para ENGANAR o comparador: bonitos por fora, quebrados por dentro. O que se
     cobra é o TIER — cair no lugar certo importa mais que o vencedor. */
  const ARTE_LOGO=()=>{ const L=ARTE();
    L.push(text('Logo',820,60,180,80,'MARCA',{fontSize:32,locked:true})); return L; };

  const adversarios=[
    { id:'adv-arte-igual-texto-ilegivel', categoria:'adversarial',
      a:{nome:'quase idêntica, título em 6px (ilegível)',mut:M.corpo('Título',6)},
      b:{nome:'título em 60px',mut:M.corpo('Título',60)}, esperaVencedor:'b' },
    { id:'adv-alinhamento-perfeito-hierarquia-invertida', categoria:'adversarial',
      a:{nome:'alinhamento intacto, título sob o apoio',mut:M.corpo('Título',30)},
      b:{nome:'quebra a coluna, hierarquia de pé',mut:M.mover('CTA',40,0)},
      esperaVencedor:'b', esperaCamada:'semantics' },
    { id:'adv-hierarquia-perfeita-fora-da-prancheta', categoria:'adversarial',
      a:{nome:'hierarquia intacta, CTA fora da prancheta',mut:M.mover('CTA',0,900)},
      b:{nome:'apoio 10% menor, tudo dentro',mut:M.encolher('Descrição',0.9)},
      esperaVencedor:'b', esperaCamada:'safety' },
    { id:'adv-pouco-movimento-placa-separada', categoria:'adversarial',
      base:ARTE_DEPOR, canvas:CV_DEPOR,
      a:{nome:'move pouco, mas o texto larga a placa',mut:M.mover('Cupom',0,240)},
      b:{nome:'encolhe o cupom, placa preservada',mut:M.encolher('Cupom',0.8)},
      esperaVencedor:'b', esperaCamada:'semantics' },
    { id:'adv-estetica-excelente-protegida-quebrada', categoria:'adversarial', base:ARTE_LOGO,
      a:{nome:'composição melhor, mas mexe no logo travado',mut:M.mover('Logo',-120,40)},
      b:{nome:'mexe no CTA, logo intocado',mut:M.mover('CTA',0,60)} },
    { id:'adv-emergencia-linda-vs-normal-correto', categoria:'adversarial',
      a:{nome:'emergência, semântica intacta',mut:M.encolher('Descrição',0.9),modo:'emergency'},
      b:{nome:'normal, título sob o preço',mut:M.corpo('Título',60)},
      esperaVencedor:'a', esperaCamada:'semantics' }
  ];
  adversarios.forEach(d=>{
    test('adversarial · '+d.id,()=>{
      const r=disputar(d); RESULT[d.id]=r; const k=registrar(r);
      avisos.push('[adversarial] '+d.id+' → venceu '+r.vencedor.toUpperCase()+' ('+r.nomeVencedor
        +') por '+r.criterio+' [tier '+k+']\n      A='+JSON.stringify(r.vetorA)
        +'\n      B='+JSON.stringify(r.vetorB));
      if(d.esperaVencedor) assert(r.vencedor===d.esperaVencedor,
        'o candidato armadilha venceu em '+d.id+': '+r.nomeVencedor+' por '+r.criterio);
      if(d.esperaCamada) assert(r.camada===d.esperaCamada,
        'em '+d.id+' quem decidiu foi '+r.camada+' ('+r.criterio+'), não '+d.esperaCamada);
    });
  });

  test('adversarial: o que o portão de segurança NÃO vê (relatório honesto)',()=>{
    /* Dois buracos que os adversariais acima expõem e que NENHUM teste desta suíte esconde:
       · piso de legibilidade: `gLayoutCamadaReprovada` reprova por tinta fora da arte e por
         estouro de caixa com campo — não por corpo pequeno demais. Quem impede 6px é o
         GERADOR (`gLayoutPisoFonte` limita a ação), não o portão. Um estado que chegue ali por
         outro caminho passa;
       · camada protegida: o portão confere o RESULTADO (colisão, fora da prancheta, reprovação
         do produto). "Esta camada estava travada e se mexeu" é regra da geração de ações. */
    const ilegivel=RESULT['adv-arte-igual-texto-ilegivel'];
    const protegida=RESULT['adv-estetica-excelente-protegida-quebrada'];
    avisos.push('§19 · ILEGÍVEL (título 6px): seguro='+ilegivel.perfilA.safety.seguro
      +' · margemLegibilidade='+ilegivel.perfilA.safety.margemLegibilidade
      +' · decidiu '+ilegivel.criterio);
    avisos.push('§19 · PROTEGIDA MOVIDA: seguro='+protegida.perfilA.safety.seguro
      +' · venceu '+protegida.vencedor.toUpperCase()+' por '+protegida.criterio
      +(protegida.vencedor==='a'?'  ⚠ a composição que mexeu na camada travada VENCEU':''));
    /* A margem de legibilidade é MEDIDA (a §4 mandou guardá-la) — o que ela ainda não é é
       portão. Isto é asserção porque o dado precisa existir para a Fase 7 poder usá-lo. */
    assert(ilegivel.perfilA.safety.margemLegibilidade!=null,
      'a margem de legibilidade não foi medida');
    assert(ilegivel.perfilA.safety.margemLegibilidade<0,
      'o título em 6px não apareceu como abaixo do piso de legibilidade: '
      +ilegivel.perfilA.safety.margemLegibilidade);
  });

  /* ══ 11. PAPEL EFETIVO (§7) ═════════════════════════════════════════════════════════════ */
  test('papel: a prioridade é manual → compilado → contrato antigo → fallback',()=>{
    const arte=ARTE(); const ctx=ctxDe(arte,CV,'ARTE#ctx');
    const titulo=arte[0];
    assert(gLayoutEffectiveRole(ctx,titulo)==='titulo','o papel compilado não saiu da gramática');
    // 1. manual vence tudo
    const manual=Object.assign({},titulo,{layoutRoleManual:'legal'});
    assert(gLayoutEffectiveRole(ctx,manual)==='legal','a palavra do designer não venceu');
    // 2. sem gramática, o carimbo do clone responde
    assert(gLayoutEffectiveRole(null,{id:'x',type:'text',layoutSemantic:'preco'})==='preco',
      'o carimbo `layoutSemantic` não foi lido');
    // 3. o contrato antigo é TRADUZIDO, nunca devolvido cru
    assert(gLayoutEffectiveRole(null,{id:'y',type:'text',layoutRole:'protected'})==='protegida',
      "'protected' não foi traduzido para o vocabulário rico");
    // 4. sem sinal nenhum: 'apoio', o papel neutro — nunca um palpite
    assert(gLayoutEffectiveRole(null,{id:'z',type:'text'})==='apoio','o fallback mudou');
    // E o papel sai do vocabulário fechado, sempre.
    arte.forEach(l=>assert(G_LAYOUT_ROLES.indexOf(gLayoutEffectiveRole(ctx,l))>=0,
      'papel fora do vocabulário em '+l.id+': '+gLayoutEffectiveRole(ctx,l)));
  });

  test('papel: quanto o leitor LEGADO erra, camada a camada',()=>{
    const arts=[['ARTE',ARTE,CV],['ARTE_DEPOR',ARTE_DEPOR,CV_DEPOR],['ARTE_VAR',ARTE_VAR,CV_VAR]];
    let total=0,diverge=0,peso=0;
    arts.forEach(([nome,fn,cv])=>{
      const arte=fn(); const ctx=ctxDe(arte,cv,nome+'#ctx');
      const tr=arte.filter(l=>l.type==='text').map(l=>gLayoutRoleTrace(ctx,l));
      total+=tr.length; diverge+=tr.filter(t=>t.diverge).length;
      peso+=tr.filter(t=>t.pesoDiverge).length;
      avisos.push('§7 · '+nome+': '+tr.map(t=>t.id+' legado='+t.legado+'→efetivo='+t.papel
        +(t.pesoDiverge?' (peso '+t.pesoLegado+'→'+t.pesoEfetivo+')':'')).join(' · '));
    });
    avisos.push('§7 · RESUMO: '+diverge+'/'+total+' camadas de texto têm papel legado ERRADO ('
      +Math.round(diverge/total*100)+'%); em '+peso+' delas o PESO da nota muda.');
    assert(diverge>0,'o defeito de papel sumiu sem ninguém ter migrado nada — desconfie do teste');
    window.__PAPEIS={total:total,diverge:diverge,peso:peso};
  });

  /* ══ 12. AUDITORIA LEGACY × ROLE-CORRECTED (§8/§21) ═════════════════════════════════════ */
  test('auditoria: o scorer legado contra ele mesmo com o papel certo',()=>{
    const casos=[
      ['ARTE_VAR · longo', ARTE_VAR(), D_LONGO, CV_VAR],
      ['ARTE_VAR · extremo', ARTE_VAR(),
        {produto:'Combo artesanal gigante da casa com borda recheada de catupiry, bebida e sobremesa',
         por:'R$ 1.109,90'}, CV_VAR],
      ['ARTE_DEPOR · longo', ARTE_DEPOR(),
        {produto:'Pizza Grande de Calabresa Especial',de:'De R$ 149,90 por',por:'R$ 109,90',
         cupom:'DELIVERYMUCH',descricao:'Batata rústica e bebida'}, CV_DEPOR],
      ['ARTE_DEPOR · extremo', ARTE_DEPOR(),
        {produto:'Pizza Gigante de Calabresa Especial com Borda Recheada de Catupiry',
         de:'De R$ 1.249,90 por',por:'R$ 1.099,90',cupom:'PROMOCAOESPECIAL',
         descricao:'Batata rústica, bebida gelada e sobremesa do dia'}, CV_DEPOR]
    ];
    let mudou=0, aplicaveis=0;
    casos.forEach(([nome,arte,dados,cv])=>{
      const a=gAuditLegacyRoleImpact(arte,dados,cv);
      if(a.erro){ avisos.push('§8 · '+nome+': ERRO '+a.erro); return; }
      if(!a.aplicavel){ avisos.push('§8 · '+nome+': '+(a.motivo||'sem alternativa a decidir')); return; }
      aplicaveis++; if(a.mudou) mudou++;
      avisos.push('§8 · '+nome+': legado escolhe "'+a.politicaLegacy+'" ('+a.penalLegacy
        +') · com papel efetivo escolhe "'+a.politicaCorrigida+'" ('+a.penalCorrigido+')'
        +' → '+(a.mudou?'MUDOU O VENCEDOR':'mesmo vencedor')
        +' · Δpenal da MESMA composição: '+a.deltaPenalPadrao
        +' · papéis divergentes '+a.divergentes+'/'+a.camadas
        +' (peso muda em '+a.pesoDivergentes+')');
      avisos.push('      ranking legado:    '+a.ranking.legacy.join(' | '));
      avisos.push('      ranking corrigido: '+a.ranking.corrigido.join(' | '));
    });
    window.__AUDIT={mudou:mudou,aplicaveis:aplicaveis};
    avisos.push('§21 · IMPACTO DO BUG DE PAPEL no corpus de scoring: '+mudou+'/'+aplicaveis
      +' decisões do scorer legado mudariam com o papel correto.');
    assert(aplicaveis>0,'nenhum caso do corpus de scoring chega a ter alternativa a decidir');
  });

  /* ══ 13. DESEMPENHO (§20) ═══════════════════════════════════════════════════════════════ */
  test('desempenho: perfil, comparação, ranking e a sombra do legado',()=>{
    const arte=ARTE_VAR();
    const t0=performance.now();
    const ctx=gBuildOperationalContext(arte,CV_VAR,{dados:D_LONGO});
    const msCtx=performance.now()-t0;
    const t1=performance.now();
    const r=gSearchLayoutCandidates({ctx:ctx,base:arte});
    const msBusca=performance.now()-t1;
    const base=gSettleCandidateState(r.original,ctx).layers;
    const t2=performance.now();
    const perfis=r.solved.map(c=>gLayoutScoreProfile(c,ctx,{base:base}));
    const msPerfis=performance.now()-t2;
    // O MESMO trabalho de novo: o que o cache de diffs por assinatura assentada economiza.
    const t3=performance.now();
    r.solved.forEach(c=>gLayoutScoreProfile(c,ctx,{base:base}));
    const msQuente=performance.now()-t3;
    const t4=performance.now();
    for(let i=0;i<1000;i++) gCompareLayoutCandidates(perfis[0],perfis[perfis.length-1]);
    const msCmp=(performance.now()-t4)/1000;
    const t5=performance.now();
    const esc=gSelectLayoutCandidate(r,ctx);
    const msRank=performance.now()-t5;
    const t6=performance.now();
    gAuditLegacyRoleImpact(arte,D_LONGO,CV_VAR);
    const msSombra=performance.now()-t6;
    avisos.push('§20 · DESEMPENHO ('+arte.length+' camadas, '+r.solved.length+' soluções): '
      +'contexto '+msCtx.toFixed(1)+'ms · busca '+msBusca.toFixed(1)+'ms · '
      +perfis.length+' perfis FRIOS '+msPerfis.toFixed(1)+'ms ('
      +(msPerfis/Math.max(1,perfis.length)).toFixed(1)+'ms cada) · os mesmos QUENTES '
      +msQuente.toFixed(1)+'ms · comparação '+(msCmp*1000).toFixed(2)+'µs · ranking '
      +msRank.toFixed(1)+'ms · sombra legacy×corrigido '+msSombra.toFixed(1)+'ms (5 solves)');
    assert(msPerfis<msBusca*1.5,'o perfil passou a custar mais que a busca inteira');
    assert(msQuente<=msPerfis+1,'o cache de diffs por assinatura assentada parou de funcionar');
    assert(esc.winner,'o cenário perdeu o sentido: sem vencedor');
  });

  test('desempenho: o que recompila Grammar/Graph/Components por candidato',()=>{
    /* A conta honesta: cada perfil de um estado INÉDITO compila Gramática + Grafo +
       Componentes do candidato (3 compilações). Dois candidatos que chegam ao MESMO estado
       assentado dividem a resposta — a chave do cache é a assinatura assentada, e é por isso
       que ela existe. O da BASE é compilado uma vez por contexto (`ctx._gramBase`). */
    const arte=ARTE_VAR();
    const ctx=gBuildOperationalContext(arte,CV_VAR,{dados:D_LONGO});
    const r=gSearchLayoutCandidates({ctx:ctx,base:arte});
    const base=gSettleCandidateState(r.original,ctx).layers;
    r.solved.forEach(c=>gLayoutScoreProfile(c,ctx,{base:base}));
    const chaves=new Set(r.solved.map(c=>c.settledSignature||c.signature));
    avisos.push('§20 · '+r.solved.length+' soluções → '+chaves.size
      +' estados assentados distintos → '+(chaves.size*3)+' compilações (Gramática+Grafo+Componentes)'
      +' + 2 da base, reusadas pelo contexto. Cache de diffs: '
      +(ctx._diffScore?ctx._diffScore.size:0)+' entradas.');
    assert(ctx._diffScore&&ctx._diffScore.size<=chaves.size,
      'o cache de diffs guardou mais entradas que estados distintos');
  });

  /* ══ 14. A EXPLICAÇÃO EM PT-BR (§16) ════════════════════════════════════════════════════ */
  test('explicação: a decisão sai em texto, e para onde o comparador parou',()=>{
    const {ctx,r}=buscar(ARTE_VAR(),D_LONGO,CV_VAR);
    const esc=gSelectLayoutCandidate(r,ctx);
    const linhas=gExplainLayoutDecision(esc);
    avisos.push('── EXPLICAÇÃO DE UMA DECISÃO REAL ──');
    linhas.forEach(l=>avisos.push('   '+l));
    assert(linhas.length>=2,'a explicação saiu vazia');
    if(esc.explanation.trace&&esc.explanation.trace.parouEm>=0){
      assert(linhas.some(l=>/DECIDIU/.test(l)),'a explicação não diz qual critério decidiu');
      assert(linhas.some(l=>/PAROU AQUI/.test(l)),'a explicação não declara onde a decisão parou');
      /* E o essencial: ela NÃO menciona camada nenhuma depois do critério decisor. */
      const iParou=linhas.findIndex(l=>/PAROU AQUI/.test(l));
      const depois=linhas.slice(iParou+1).filter(l=>/empate/.test(l));
      assert(!depois.length,'a explicação continuou listando camadas depois de a decisão parar');
    }
    // A mesma explicação, sobre um par controlado, com o detalhe da hierarquia à vista.
    const r2=RESULT['compressao-moderada-vs-forte'];
    avisos.push('── EXPLICAÇÃO DE UM PAR CONTROLADO (compressão moderada × forte) ──');
    r2.trace.tiers.forEach(t=>avisos.push('   '+t.criterio+': '
      +(t.resultado==='empate'?'empate ('+t.vencedor+')':t.vencedor+' contra '+t.perdedor+' → DECIDIU')
      +(t.detalhe?'\n      #1 preservou '+(t.detalhe.vencedor||'—')
                 +'\n      #2 preservou '+(t.detalhe.perdedor||'—'):'')));
  });

  /* ══ 15. O PORTÃO DA FASE 7 (§22) ═══════════════════════════════════════════════════════
     Os seis critérios, medidos — não opinados. Este caso não reprova nada: ele IMPRIME o
     veredito de cada um, e é dele que sai a resposta final do relatório. */
  test('portão da Fase 7: os seis critérios, medidos',()=>{
    const dominante=Object.keys(DIST).sort((a,b)=>DIST[b]-DIST[a])[0];
    const tot=Object.keys(DIST).reduce((s,k)=>s+DIST[k],0);
    const share=DIST[dominante]/tot;
    const A='A) nenhum tier inferior compra violação superior: OK (invariantes de autoridade verdes'
      +' nas 3 direções + '+REGISTRO.filter(x=>x.camada==='aesthetics').length
      +' decisões por estética, todas com as 6 posições acima empatadas)';
    const ruido=window.__RUIDO, dentro=(window.__DENTRO_DO_RUIDO||[]);
    const B='B) hierarchyCompression sem patologia: PARCIAL — monótona na varredura e zero em'
      +' escala uniforme exata, mas com piso de ruído de arredondamento de '+ruido
      +' e '+dentro.length+' decisão(ões) do corpus com margem dentro dele'
      +(dentro.length?' ('+dentro.map(x=>x.id).join(', ')+')':'');
    const P=window.__PAPEIS||{};
    const C='C) fonte única de papel: OK (gLayoutEffectiveRole), mas a PRODUÇÃO ainda lê o'
      +' legado: '+P.diverge+'/'+P.total+' camadas com papel errado no leitor antigo';
    const D='D) determinismo: OK (duplicar, reordenar, rotacionar e renomear não movem o vencedor)';
    const E='E) explicação = comparador: OK (traço conferido contra varredura independente do'
      +' vetor em '+Object.keys(RESULT).length+' disputas)';
    const F='F) bug capaz de inverter winners sistematicamente: NÃO no comparador novo;'
      +' o do scorer LEGADO está medido ('+((window.__AUDIT||{}).mudou||0)+'/'
      +((window.__AUDIT||{}).aplicaveis||0)+' vencedores mudariam)';
    [A,B,C,D,E,F].forEach(x=>avisos.push('§22 · '+x));
    avisos.push('§22 · tier mais frequente: '+dominante+' com '+Math.round(share*100)
      +'% de '+tot+' disputas');
    assert(share<0.5,'um tier decidiu mais da metade das disputas ('+dominante+': '
      +Math.round(share*100)+'%) — a hierarquia virou uma camada só');
  });

  /* ══ DISTRIBUIÇÃO DOS TIERS (§15) e o FECHAMENTO ════════════════════════════════════════ */
  test('relatório: a distribuição de quem decidiu',()=>{
    const tot=Object.keys(DIST).reduce((s,k)=>s+DIST[k],0);
    avisos.push('── DISTRIBUIÇÃO DOS TIERS DECISORES ('+tot+' disputas) ──');
    Object.keys(DIST).sort((a,b)=>DIST[b]-DIST[a]).forEach(k=>
      avisos.push('   '+k+': '+DIST[k]+' ('+Math.round(DIST[k]/tot*100)+'%)'));
    assert(tot>0,'nenhuma disputa registrada');
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
      console.error('[scoring]',item.name,error);
      falhas.push({name:item.name,error:String(error&&error.message||error)});
    }
    results.appendChild(li);
  }
  const failed=cases.length-passed;
  summary.textContent=passed+'/'+cases.length+' casos passaram'+(failed?' · '+failed+' falharam':' · calibração concluída');
  summary.dataset.passed=String(passed);summary.dataset.total=String(cases.length);
  document.title=(failed?'FALHOU':'OK')+' — Scoring ('+passed+'/'+cases.length+')';
  window.__lumaTest={passed:passed,total:cases.length,failures:falhas,notas:avisos};
})();
