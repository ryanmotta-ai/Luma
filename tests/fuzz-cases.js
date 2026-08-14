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
     · o veredito é sempre um dos três (`original`/`adapted`/`unsafe`);
     · quando é `unsafe`, existe diagnóstico com campo e limite — nunca beco sem saída;
     · roda duas vezes e dá o mesmo resultado.

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

  const geo=(out)=>out.filter(l=>l&&l.type==='text').map(l=>{
    const r=gInkRect(l,l._fit);
    return [l.id,Math.round(r.x),Math.round(r.y),Math.round(r.w),Math.round(r.h)];
  });
  const finito=(n)=>typeof n==='number'&&isFinite(n);

  const RODADAS=60;
  const TETO_MS=900;              // teto por caso: acima disso é laço que não converge
  let piorMs=0, contagem={original:0,adapted:0,unsafe:0}, semDiagnostico=0;

  for(let i=0;i<RODADAS;i++){
    const dados={
      titulo: rnd()<0.1 ? '' : frase(inteiro(1,7)),
      produto: rnd()<0.1 ? '' : frase(inteiro(1,14)),
      preco: rnd()<0.1 ? '' : frase(inteiro(1,3))
    };
    const rotulo='rodada '+(i+1)+' · '+JSON.stringify(dados).slice(0,88);
    test(rotulo,()=>{
      const t0=performance.now();
      let out=null, erro=null;
      try{
        out=gApplyRelativeAnchors(molde(),dados,{},{fitText:true,canvas:canvas,scope:'franqueado'});
      }catch(e){ erro=e; }
      const ms=performance.now()-t0;
      piorMs=Math.max(piorMs,ms);
      assert(!erro,'o solver lançou exceção: '+(erro&&erro.message||erro));
      assert(out&&out.length===7,'o solver devolveu '+(out?out.length:0)+' camadas de 7');
      assert(ms<TETO_MS,'o solve levou '+Math.round(ms)+'ms (teto '+TETO_MS+'ms) — laço que não converge');

      out.forEach(l=>{
        ['x','y','w','h'].forEach(k=>assert(finito(l[k]),'“'+l.name+'” saiu com '+k+'='+l[k]));
        if(l.type==='text'&&l._fit){
          assert(finito(l._fit.altura)&&finito(l._fit.larguraMax),'“'+l.name+'” mediu tinta não-finita');
          assert(l._fit.lines.every(s=>typeof s==='string'),'“'+l.name+'” quebrou em linha não-textual');
        }
      });

      const original=gApplyRelativeAnchors(molde(),dados,{},{fitText:false,canvas:canvas,scope:'franqueado'});
      const res=gDescribeFranchiseeLayout(original,out);
      assert(['original','adapted','unsafe'].indexOf(res.status)>=0,'veredito inesperado: '+res.status);
      contagem[res.status]++;

      // Determinismo: a prévia e o PNG saem de execuções diferentes do mesmo motor.
      assert(JSON.stringify(geo(out))===JSON.stringify(
        geo(gApplyRelativeAnchors(molde(),dados,{},{fitText:true,canvas:canvas,scope:'franqueado'}))),
        'duas execuções idênticas divergiram');

      // Bloqueio sem saída é o pior resultado possível: o franqueado não sabe o que encurtar.
      if(res.status==='unsafe'){
        const diag=gLayoutDiagnosis(molde(),dados,{},
          {fitText:true,canvas:canvas,scope:'franqueado'},out);
        if(!diag||!diag.campo) semDiagnostico++;
        else{
          assert(finito(diag.limite)&&diag.limite>=0,'limite seguro inválido: '+diag.limite);
          assert(!/\{\{|undefined|null/.test(diag.mensagem),'mensagem do bloqueio vazou termo técnico: '+diag.mensagem);
        }
      }
    });
  }

  test('campo vazio em TODOS os campos não quebra a arte',()=>{
    const out=gApplyRelativeAnchors(molde(),{titulo:'',produto:'',preco:''},{},
      {fitText:true,canvas:canvas,scope:'franqueado'});
    assert(out.length===7,'camadas sumiram com todos os campos vazios');
    out.forEach(l=>['x','y','w','h'].forEach(k=>assert(finito(l[k]),'“'+l.name+'” saiu com '+k+'='+l[k])));
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
    +' · original '+contagem.original+' / adaptadas '+contagem.adapted+' / bloqueadas '+contagem.unsafe
    +(semDiagnostico?' · '+semDiagnostico+' bloqueios sem diagnóstico':'')
    +' · pior solve '+Math.round(piorMs)+'ms';
  document.title=(failed?'FALHOU':'OK')+' — Fuzz ('+passed+'/'+cases.length+')';
  window.__lumaTest={passed:passed,total:cases.length,failures:falhas,perf:perf,
    resumo:{contagem:contagem,piorMs:Math.round(piorMs),semDiagnostico:semDiagnostico}};
})();
