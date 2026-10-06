/* ══════════════════════════════════════════════════════════════════════════════════════════
   FUZZING DO AUTO-LAYOUT — abra `tests/fuzz.html` ou rode
   `node scripts/run-browser-tests.js fuzz`.

   O corpus prova que a arte REAL sobrevive. Isto prova que o motor sobrevive ao que o
   franqueado digita de verdade num campo livre: emoji, palavra gigante sem espaço, moeda,
   data, CAIXA ALTA, caractere especial, campo vazio e vários campos crescendo juntos.

   ⛔ O que se cobra aqui NÃO é beleza — é CONTRATO. Uma arte feia é um problema de design; uma
   exceção não tratada, um laço infinito ou uma geometria `NaN` é um material que não sai e um
   franqueado sem saída:
     · nunca lança exceção;
     · sempre termina (com teto de tempo por caso);
     · toda geometria devolvida é número finito (nada de NaN/Infinity);
     · o veredito é sempre um dos quatro (`original`/`wrapped`/`shrunk`/`overflow`);
     · quando é `overflow`, existe diagnóstico com campo e limite — nunca beco sem saída;
     · roda duas vezes e dá o mesmo resultado;
     · NENHUM terceiro se move — a única geometria que o Local Fit escreve é a da placa ligada
       ao próprio texto, e este molde não tem placa.

   O gerador é PSEUDO-ALEATÓRIO COM SEMENTE FIXA: a mesma sequência em toda máquina e em todo
   commit. Fuzz que sorteia de verdade acha bug uma vez e nunca mais reproduz — e um vermelho
   que não reproduz é um vermelho que o time aprende a ignorar.
   ══════════════════════════════════════════════════════════════════════════════════════════ */
(async function(){
  const results=document.getElementById('results');
  const summary=document.getElementById('summary');
  const cases=[]; const falhas=[];
  const test=(name,fn)=>cases.push({name,fn});
  const assert=(c,m)=>{if(!c)throw new Error(m||'asserção falhou');};

  /* PRNG determinístico (LCG de Numerical Recipes). Sem `Math.random`: a suíte tem que dar o
     mesmo resultado no meu Chrome, no seu e no runner do CI. */
  let _semente=20260814;
  const rnd=()=>{ _semente=(_semente*1664525+1013904223)>>>0; return _semente/4294967296; };
  const escolher=(arr)=>arr[Math.floor(rnd()*arr.length)];
  const inteiro=(a,b)=>a+Math.floor(rnd()*(b-a+1));

  const PEDACOS=[
    'Combo','Burger','Artesanal','Pizza','Marmita','Açaí','Feijoada','Bebida','Sobremesa',
    'R$ 29,90','R$ 1.249,00','US$ 15','50%','2 por 1','500 ml','1,5 L','3 un',
    '🍔','🔥🔥🔥','😋 top','⚡ RELÂMPAGO','🇧🇷',
    'SUPERPROMOÇÃOIMPERDÍVELDEANIVERSÁRIO','Xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    'ÇÃÕÉÍÜ','<script>alert(1)</script>','"aspas" & <tags>','a​b​c',
    '31/12/2026','de segunda a sexta','às 18h','#hashtag','@perfil',
    'ｆｕｌｌｗｉｄｔｈ','مرحبا','日本語のテキスト','\t  espaços   demais  ',
    '—travessão—','...','!!!','R$','%','de','da','com'
  ];
  const frase=(n)=>{ let s=[]; for(let i=0;i<n;i++) s.push(escolher(PEDACOS)); return s.join(' '); };

  // Prancheta de teste: 3 campos que crescem juntos + obstáculos travados, que é onde o motor
  // realmente sofre (um campo sozinho quase sempre acha saída).
  const canvas={w:1080,h:1350};
  const molde=()=>[
    {id:'fundo',name:'Fundo',type:'shape',shapeKind:'rect',x:0,y:0,w:1080,h:1350,fill:'#FF9000',visible:true,opacity:100},
    {id:'titulo',name:'Título',type:'text',content:'{{titulo}}',isVar:true,x:70,y:120,w:700,h:120,
     font:'Arial',fontSize:84,lineHeight:1.1,textAlign:'left',textBox:'point',vAlign:'top',
     textTransform:'uppercase',visible:true,opacity:100,layoutRefText:'OFERTA DO DIA'},
    {id:'produto',name:'Produto',type:'text',content:'{{produto}}',isVar:true,x:70,y:280,w:640,h:160,
     font:'Arial',fontSize:52,lineHeight:1.2,textAlign:'left',textBox:'box',vAlign:'top',
     visible:true,opacity:100,layoutRefText:'Combo Burger'},
    {id:'selo',name:'Selo de preço',type:'shape',shapeKind:'circle',x:790,y:230,w:220,h:220,
     fill:'#0A0A0A',visible:true,opacity:100,locked:true},
    {id:'preco',name:'Preço',type:'text',content:'{{preco}}',isVar:true,x:800,y:310,w:200,h:70,
     font:'Arial',fontSize:44,lineHeight:1.1,textAlign:'center',textBox:'point',vAlign:'top',
     visible:true,opacity:100,layoutRefText:'R$ 29,90'},
    {id:'cta',name:'CTA',type:'text',content:'PEÇA AGORA',x:70,y:500,w:320,h:56,
     font:'Arial',fontSize:32,lineHeight:1.2,textAlign:'left',textBox:'point',visible:true,opacity:100},
    {id:'legal',name:'Regulamento',type:'text',content:'Consulte o regulamento no aplicativo.',
     x:70,y:1290,w:940,h:40,font:'Arial',fontSize:18,lineHeight:1.3,textAlign:'left',
     textBox:'box',visible:true,opacity:100}
  ];
  window.dVars=[
    {name:'titulo',label:'Título',example:'OFERTA DO DIA',type:'text',maxLen:48},
    {name:'produto',label:'Nome do produto',example:'Combo Burger',type:'text',maxLen:80},
    {name:'preco',label:'Preço',example:'R$ 29,90',type:'currency',maxLen:16}
  ];

  const geo=(out)=>out.map(l=>[l.id,Math.round(l.x||0),Math.round(l.y||0),
                               Math.round(l.w||0),Math.round(l.h||0),l._tetoFonte||0]);
  const finito=(n)=>typeof n==='number'&&isFinite(n);

  const RODADAS=60;
  const TETO_MS=900;              // teto por caso: acima disso é laço que não converge
  let piorMs=0, contagem={original:0,wrapped:0,shrunk:0,overflow:0}, semDiagnostico=0;

  const OPTS={canvas:canvas,scope:'franqueado'};
  const rodar=(dados)=>{
    const base=gApplyRelativeAnchors(molde(),dados,{},OPTS);
    return {base, lf:gLocalFitArte(base,{canvas:canvas,dados:dados,defaults:{}})};
  };

  for(let i=0;i<RODADAS;i++){
    const dados={
      titulo: rnd()<0.1 ? '' : frase(inteiro(1,7)),
      produto: rnd()<0.1 ? '' : frase(inteiro(1,14)),
      preco: rnd()<0.1 ? '' : frase(inteiro(1,3))
    };
    const rotulo='rodada '+(i+1)+' · '+JSON.stringify(dados).slice(0,88);
    test(rotulo,()=>{
      const t0=performance.now();
      let r=null, erro=null;
      try{ r=rodar(dados); }catch(e){ erro=e; }
      const ms=performance.now()-t0;
      piorMs=Math.max(piorMs,ms);
      assert(!erro,'o Local Fit lançou exceção: '+(erro&&erro.message||erro));
      assert(r.lf.layers.length===7,'saíram '+r.lf.layers.length+' camadas de 7');
      assert(ms<TETO_MS,'levou '+Math.round(ms)+'ms (teto '+TETO_MS+'ms) — laço que não converge');

      r.lf.layers.forEach(l=>{
        ['x','y','w','h'].forEach(k=>assert(finito(l[k]),'“'+l.name+'” saiu com '+k+'='+l[k]));
        if(l._tetoFonte!=null) assert(finito(l._tetoFonte)&&l._tetoFonte>0,
          '“'+l.name+'” recebeu teto de fonte inválido: '+l._tetoFonte);
      });

      const res=r.lf.result;
      assert(['original','wrapped','shrunk','overflow'].indexOf(res.status)>=0,
             'veredito inesperado: '+res.status);
      contagem[res.status]++;

      /* ⛔ TERCEIROS NUNCA MUDAM — o contrato inteiro em uma asserção. Sem placa no molde,
         NENHUMA camada pode ter x/y/w/h diferente do que a arte publicada produz. */
      /* Exceção declarada: a PILHA (âncora ou o par inferido no bloqueio) só DESCE, no y. */
      const antes=new Map(r.base.map(l=>[l.id,l]));
      const pilha=new Set(res.changes.filter(c=>c.pilhaDe).map(c=>c.id));
      r.lf.layers.forEach(l=>{
        const o=antes.get(l.id)||{};
        if(pilha.has(l.id)) assert((l.y||0)>(o.y||0),'“'+l.name+'” subiu na pilha');
        ['x','y','w','h'].filter(k=>!(k==='y'&&pilha.has(l.id))).forEach(k=>assert((l[k]||0)===(o[k]||0),
          '“'+l.name+'” teve '+k+' alterado de '+(o[k]||0)+' para '+(l[k]||0)+' — isso é recomposição'));
      });

      // Determinismo: a prévia e o PNG saem de execuções diferentes do mesmo motor.
      assert(JSON.stringify(geo(r.lf.layers))===JSON.stringify(geo(rodar(dados).lf.layers)),
        'duas execuções idênticas divergiram');

      // Bloqueio sem saída é o pior resultado possível: o franqueado não sabe o que encurtar.
      if(res.status==='overflow'){
        assert(res.bloqueios.length>0,'bloqueou sem dizer o quê');
        res.bloqueios.forEach(b=>{
          assert(b.status==='CONTENT_TOO_LARGE','código de bloqueio inesperado: '+b.status);
          assert(finito(b.fontSize)&&finito(b.minimumFontSize),'corpo/piso não-finito no bloqueio');
          assert(b.fontSize<=b.minimumFontSize+1,'bloqueou ANTES de chegar ao piso: '
                 +b.fontSize+'px com piso '+b.minimumFontSize+'px');
        });
        const diag=gLocalFitDiagnostico(r.lf.layers,res,dados,{canvas:canvas,defaults:{}});
        if(!diag||!diag.campo) semDiagnostico++;
        else{
          assert(finito(diag.limite)&&diag.limite>=0,'limite seguro inválido: '+diag.limite);
          assert(!/\{\{|undefined|null/.test(diag.mensagem),'mensagem do bloqueio vazou termo técnico: '+diag.mensagem);
        }
      }
    });
  }

  test('campo vazio em TODOS os campos não quebra a arte nem aciona adaptação',()=>{
    const r=rodar({titulo:'',produto:'',preco:''});
    assert(r.lf.layers.length===7,'camadas sumiram com todos os campos vazios');
    r.lf.layers.forEach(l=>['x','y','w','h'].forEach(k=>assert(finito(l[k]),'“'+l.name+'” saiu com '+k+'='+l[k])));
    assert(r.lf.result.status==='original','campo vazio virou adaptação: '+r.lf.result.status);
    assert(r.lf.result.campos.filter(c=>c.status==='vazio').length===3,
           'os três campos vazios deveriam ser reportados como vazios, não como problema');
  });

  test('quebra semântica: valor em real não se parte entre linhas',()=>{
    const camada={id:'p',name:'Preço',type:'text',content:'x',x:0,y:0,w:230,h:120,font:'Arial',
      fontSize:40,lineHeight:1.2,textAlign:'left',textBox:'box',visible:true,opacity:100};
    const q=gSmartWrapText('Leve tudo por apenas R$ 29,90 hoje',230,camada,null,null).split('\n');
    q.forEach((linha,i)=>{
      if(i===q.length-1)return;
      assert(!/R\$\s*$/.test(linha.trim()),'a linha terminou em "R$" e o valor foi para a linha de baixo');
    });
    assert(q.some(l=>/R\$\s*29,90/.test(l)),'o valor “R$ 29,90” não sobreviveu inteiro em nenhuma linha');
  });

  test('quebra semântica: preposição não fica órfã no fim da linha',()=>{
    const camada={id:'t',name:'Título',type:'text',content:'x',x:0,y:0,w:300,h:200,font:'Arial',
      fontSize:36,lineHeight:1.2,textAlign:'left',textBox:'box',visible:true,opacity:100};
    const q=gSmartWrapText('Combo especial de hambúrguer artesanal da casa',300,camada,null,null).split('\n');
    q.slice(0,-1).forEach(linha=>{
      const ultima=linha.trim().split(/\s+/).pop().toLowerCase();
      assert(!G_CONNECTORS.has(ultima),'a linha terminou na preposição “'+ultima+'”');
    });
  });

  let passed=0;
  for(const item of cases){
    const li=document.createElement('li');li.className='case';
    try{
      await item.fn();passed++;li.classList.add('pass');
      li.innerHTML='<strong>✓ '+item.name+'</strong>';
    }catch(error){
      li.classList.add('fail');
      li.innerHTML='<strong>✕ '+item.name+'</strong><small>'+String(error&&error.message||error)+'</small>';
      console.error('[fuzz]',item.name,error);
      falhas.push({name:item.name,error:String(error&&error.message||error)});
    }
    results.appendChild(li);
  }
  const failed=cases.length-passed;
  const perf=(typeof gLayoutPerfStats==='function')?gLayoutPerfStats():null;
  summary.textContent=passed+'/'+cases.length+' casos passaram'+(failed?' · '+failed+' falharam':'')
    +' · original '+contagem.original+' / wrap '+contagem.wrapped+' / shrink '+contagem.shrunk
    +' / bloqueadas '+contagem.overflow
    +(semDiagnostico?' · '+semDiagnostico+' bloqueios sem diagnóstico':'')
    +' · pior solve '+Math.round(piorMs)+'ms';
  document.title=(failed?'FALHOU':'OK')+' — Fuzz ('+passed+'/'+cases.length+')';
  window.__lumaTest={passed:passed,total:cases.length,failures:falhas,perf:perf,
    resumo:{contagem:contagem,piorMs:Math.round(piorMs),semDiagnostico:semDiagnostico}};
})();
