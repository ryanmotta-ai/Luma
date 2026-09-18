(function(){
  const L=[]; const log=(...a)=>L.push(a.join(' '));
  const text=(id,x,y,w,h,content,extra)=>Object.assign({id,name:id,type:'text',x,y,w,h,
    content,font:'Arial',fontSize:48,lineHeight:1.2,textBox:'point',textAlign:'left',vAlign:'top',
    visible:true,opacity:100},extra||{});
  const shape=(id,x,y,w,h,extra)=>Object.assign({id,name:id,type:'shape',shapeKind:'rect',x,y,w,h,
    visible:true,opacity:100,locked:true},extra||{});
  const arteGrande=(n)=>{
    const A=[],COLS=6,CW=170;
    for(let i=0;i<n;i++){
      const x=40+(i%COLS)*CW, y=40+Math.floor(i/COLS)*72;
      if(i%7===3)A.push(shape('s'+i,x-6,y-6,150,56,{locked:false,name:'Placa'}));
      A.push(text('t'+i,x,y,138,44,i%4===0?'{{campo'+i+'}}':'TEXTO '+i,
        {fontSize:i%5===0?34:24,name:i%5===0?'Preço':'Texto '+i}));
    }
    return A;
  };
  const dadosGrande=(n)=>{ const d={}; let longos=0;
    for(let i=0;i<n;i++){ if(i%4!==0) continue;
      d['campo'+i]=(longos++<1)?'Combo artesanal da casa com borda recheada e bebida gelada '+i:'Combo '+i; }
    return d; };

  /* ── TETO DE CADA OTIMIZAÇÃO, medido antes de escrever qualquer uma ──────────────────── */
  const sigPre=new Map(), sigPos=new Map(), idxKeys=new Map(), detKeys=new Map();
  const oSettle=window.gSettleCandidateState, oDet=window.gDetectLayoutProblems,
        oIdx=window.gLayoutIndicePisoExterno;
  window.gSettleCandidateState=function(cand,ctx){
    const k=cand.signature||gLayoutCandidateSignature(cand);
    sigPre.set(k,(sigPre.get(k)||0)+1);
    const r=oSettle.apply(this,arguments);
    sigPos.set(r.settledSignature,(sigPos.get(r.settledSignature)||0)+1);
    return r;
  };
  window.gDetectLayoutProblems=function(estado,ctx){
    const k=gLayoutCandidateSignature({layers:estado.layers,solveState:estado.solveState});
    detKeys.set(k,(detKeys.get(k)||0)+1);
    return oDet.apply(this,arguments);
  };
  window.gLayoutIndicePisoExterno=function(camadas,ids,preco){
    const g=(ids instanceof Set?[...ids]:(ids||[])).slice().sort().join(',');
    const k=g+'|'+(preco?1:0)+'|'+(camadas?camadas.length:0);
    idxKeys.set(k,(idxKeys.get(k)||0)+1);
    return oIdx.apply(this,arguments);
  };

  [58,172,344].forEach(n=>{
    sigPre.clear(); sigPos.clear(); idxKeys.clear(); detKeys.clear();
    const A=arteGrande(n), cv={w:1080,h:40+Math.ceil(n/6)*72+200}, d=dadosGrande(n);
    const t0=performance.now();
    const C=gBuildOperationalContext(A,cv,{dados:d});
    const r=gSearchLayoutCandidates({ctx:C,base:A});
    const ms=performance.now()-t0;
    const soma=(m)=>[...m.values()].reduce((a,b)=>a+b,0);
    log('\n══ '+n+' camadas · '+ms.toFixed(0)+'ms · '+r.diagnostics.generated+' candidatos · '
      +(ms/Math.max(1,r.diagnostics.generated)).toFixed(1)+'ms/cand · solved '+r.solved.length);
    log('  settle:  '+soma(sigPre)+' chamadas · '+sigPre.size+' assinaturas PRÉ distintas'
      +' → teto de economia por dedupe precoce: '+(soma(sigPre)-sigPre.size)
      +' ('+Math.round((soma(sigPre)-sigPre.size)/Math.max(1,soma(sigPre))*100)+'%)');
    log('  detect:  '+soma(detKeys)+' chamadas · '+detKeys.size+' estados distintos'
      +' → teto por cache de detecção: '+(soma(detKeys)-detKeys.size)
      +' ('+Math.round((soma(detKeys)-detKeys.size)/Math.max(1,soma(detKeys))*100)+'%)');
    log('  índice:  '+soma(idxKeys)+' chamadas · '+idxKeys.size+' chaves distintas'
      +' → teto por memoização: '+(soma(idxKeys)-idxKeys.size)
      +' ('+Math.round((soma(idxKeys)-idxKeys.size)/Math.max(1,soma(idxKeys))*100)+'%)');
    log('  dedup da busca hoje: '+(r.diagnostics.deduplicated||0)+' · podados: '+(r.diagnostics.pruned||0));
  });
  window.gSettleCandidateState=oSettle; window.gDetectLayoutProblems=oDet;
  window.gLayoutIndicePisoExterno=oIdx;
  window.__lumaTest={passed:1,total:1,failures:[],notas:L};
})();
