/* BANCADA DE SONDAGEM — não é teste, é instrumento. Mede o comportamento do motor em massa
   para dizer ONDE ele ainda é fraco, em vez de a gente adivinhar. Descartável. */
(async function(){
  const out=document.getElementById('out');
  const linhas=[];
  const log=(s)=>{linhas.push(s);out.textContent=linhas.join('\n');};

  const clonar=(ls)=>ls.map(l=>JSON.parse(JSON.stringify(l)));
  const POLS=['padrao','sem-entrelinha','entrelinha-livre','proporcional'];

  // ── gerador determinístico de entradas (mesmo do fuzz) ──
  let sem=20260814;
  const rnd=()=>{sem=(sem*1664525+1013904223)>>>0;return sem/4294967296;};
  const pick=(a)=>a[Math.floor(rnd()*a.length)];
  const PED=['Combo','Burger','Artesanal','Pizza','Marmita','Açaí','Feijoada','Bebida','Sobremesa',
    'R$ 29,90','R$ 1.249,00','50%','2 por 1','500 ml','Especial','da Casa','Duplo','Gigante',
    'com Batata','e Refrigerante','Promoção','Imperdível','Hoje','Só Hoje','Frita','Cheddar','Bacon'];
  const frase=(n)=>{let s=[];for(let i=0;i<n;i++)s.push(pick(PED));return s.join(' ');};

  const cenarios=[];
  (window.LUMA_CORPUS||[]).forEach(fx=>{
    Object.keys(fx.cenarios).forEach(c=>cenarios.push({nome:fx.nome+'·'+c,fx,dados:fx.cenarios[c]}));
  });
  // Varredura de crescimento: o mesmo fixture com o campo principal crescendo palavra a palavra.
  // É o que o franqueado faz de verdade — digitar até estourar.
  (window.LUMA_CORPUS||[]).forEach(fx=>{
    // Cada campo crescendo sozinho, e todos crescendo juntos — que é onde o motor sofre.
    fx.campos.forEach(c=>{
      for(let n=1;n<=12;n++){
        const dados=Object.assign({},fx.cenarios.nominal);
        dados[c.name]=frase(n);
        cenarios.push({nome:fx.nome+'·'+c.name+n,fx,dados});
      }
    });
    for(let n=2;n<=12;n++){
      const dados=Object.assign({},fx.cenarios.nominal);
      fx.campos.forEach(c=>{dados[c.name]=frase(Math.max(1,Math.round(n/2)));});
      cenarios.push({nome:fx.nome+'·todos'+n,fx,dados});
    }
  });

  const bloqueadas=[]; const encolhimentos=[]; const encolheuEm=[];
  const vitorias={},margens=[],itensQueDisparam={},vereditos={original:0,adapted:0,unsafe:0};
  const motivoUnsafe={foraDaArte:0,layoutInvalido:0,estourou:0};
  const tempos={};POLS.forEach(p=>tempos[p]=[]);
  let comAlternativas=0,alternativaVenceu=0,empates=0;
  const trocas=[];

  cenarios.forEach(({nome,fx,dados})=>{
    window.dVars=(fx.campos||[]).map(c=>Object.assign({type:'text'},c));
    const res={};
    POLS.forEach(pol=>{
      const t0=performance.now();
      let o=null;
      try{
        o=gApplyRelativeAnchors(clonar(fx.layers),dados,{},
          {fitText:true,canvas:fx.canvas,scope:'franqueado',_semAlternativas:true,
           _politica:pol==='padrao'?undefined:pol});
      }catch(e){ o=null; }
      tempos[pol].push(performance.now()-t0);
      if(!o)return;
      res[pol]={out:o,score:gScoreComposition(o,{canvas:fx.canvas})};
    });
    if(!res.padrao)return;

    // veredito do caminho real (com alternativas)
    const original=gApplyRelativeAnchors(clonar(fx.layers),dados,{},{fitText:false,canvas:fx.canvas,scope:'franqueado'});
    const real=gApplyRelativeAnchors(clonar(fx.layers),dados,{},{fitText:true,canvas:fx.canvas,scope:'franqueado'});
    const d=gDescribeFranchiseeLayout(original,real);
    vereditos[d.status]++;
    if(true){
      real.forEach(l=>{ if(!l)return;
        if(l._foraDaArte)motivoUnsafe.foraDaArte++;
        else if(l._layoutInvalido)motivoUnsafe.layoutInvalido++;
        else if(gLayoutCamadaReprovada(l))motivoUnsafe.estourou++; });
      /* A pergunta que importa: a arte bloqueada estava REALMENTE ruim? Mede o que o olho
         mediria — tinta fora da prancheta e sobreposição que não existia no desenho. */
      const inter=(a,b)=>{const w=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),
        h=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);return w>0&&h>0?w*h:0;};
      let fora=0,sobrepos=0,linhasInfo=[];
      /* Mede com a MESMA régua do motor: para foto, o obstáculo é a zona segura (o assunto),
         não a moldura. Medir a moldura inventava colisão onde o texto caiu na margem
         transparente do PNG recortado — que é justamente o espaço que a safe zone libera. */
      const caixas=real.filter(l=>l&&l.visible!==false).map(l=>({l,
        r:gLayoutObstacleRect(l,gInkRect(l,l._fit)),
        b:l._layoutBase?gLayoutObstacleRect(l,l._layoutBase):null}));
      caixas.forEach(({l,r})=>{
        if(l.type!=='text')return;
        fora+=Math.max(0,-r.x)+Math.max(0,-r.y)+Math.max(0,r.x+r.w-fx.canvas.w)+Math.max(0,r.y+r.h-fx.canvas.h);
        if(l._fit&&l._fit.estourou)linhasInfo.push(l.name+':'+l._fit.lines.length+'linhas/teto'+(l._layoutMaxLines||'-')+'@'+l._fit.fontSize+'px');
      });
      /* ⚠ Fundo e camada que CONTÉM a outra no desenho não são colisão — contá-los inventava
         58.900px² de "sobreposição" que era só o texto crescendo em cima do próprio fundo. */
      const contem=(a,b)=>a&&b&&b.x>=a.x-2&&b.y>=a.y-2&&b.x+b.w<=a.x+a.w+2&&b.y+b.h<=a.y+a.h+2;
      const pares=[];
      for(let i=0;i<caixas.length;i++)for(let j=i+1;j<caixas.length;j++){
        const A=caixas[i],B=caixas[j];
        if(A.l.type!=='text'&&B.l.type!=='text')continue;
        if(A.l.layoutSemantic==='fundo'||B.l.layoutSemantic==='fundo')continue;
        if(A.b&&B.b&&(contem(A.b,B.b)||contem(B.b,A.b)))continue;
        const agora=inter(A.r,B.r);
        const antes=(A.b&&B.b)?inter(A.b,B.b):0;
        if(agora>antes+8){sobrepos+=agora-antes;pares.push(A.l.name+'×'+B.l.name+'('+Math.round(agora-antes)+')');}
      }
      linhasInfo=linhasInfo.concat(pares);
      // Guarda TODAS: interessa saber se alguma arte APROVADA saiu com colisão real.
      if(fora>2||sobrepos>2||d.status==='unsafe')
        bloqueadas.push({nome,status:d.status,fora:Math.round(fora),sobrepos:Math.round(sobrepos),info:linhasInfo.join(' | ')});
    }

    /* A MÉTRICA DA QUEIXA DO RYAN: quantas artes chegam com a letra menor do que o designer
       publicou, e quanto. É isto que o franqueado vê como "abri a prévia e está tudo pequeno". */
    let pior=0, quemPior='';
    real.forEach(l=>{
      if(!l||l.type!=='text'||!l._fit)return;
      const pub=fx.layers.find(x=>x.id===l.id); if(!pub)return;
      const perda=1-(l._fit.fontSize/(pub.fontSize||24));
      if(perda>pior){pior=perda;quemPior=l.name;}
    });
    encolhimentos.push(pior);
    if(pior>0.001)encolheuEm.push(nome+' · '+quemPior+' -'+Math.round(pior*100)+'%');

    // itens de score que efetivamente disparam
    Object.keys(res.padrao.score.itens).forEach(k=>{
      if(res.padrao.score.itens[k]>0.001)itensQueDisparam[k]=(itensQueDisparam[k]||0)+1;
    });

    const precisou=gLayoutPrecisaAlternativas(res.padrao.out);
    if(!precisou)return;
    comAlternativas++;
    // Lê a ESCOLHA REAL do motor (com a margem mínima), não uma régua paralela da bancada.
    const melhor=(real._layoutMeta&&real._layoutMeta.politica)||'padrao';
    const melhorP=(real._layoutMeta&&real._layoutMeta.penal!=null)?real._layoutMeta.penal:res.padrao.score.penal;
    vitorias[melhor]=(vitorias[melhor]||0)+1;
    if(melhor!=='padrao'){
      alternativaVenceu++;
      const ganho=res.padrao.score.penal-melhorP;
      margens.push(ganho);
      trocas.push(nome+' → '+melhor+' (ganho '+ganho.toFixed(1)+' de '+res.padrao.score.penal.toFixed(1)+')');
    } else {
      const melhorPossivel=Math.min(...POLS.filter(p=>res[p]).map(p=>res[p].score.penal));
      if(res.padrao.score.penal-melhorPossivel>0.001) empates++;   // havia ganho, mas abaixo da margem
    }
  });

  const pct=(n,d)=>d?((n/d*100).toFixed(0)+'%'):'—';
  const q=(arr,p)=>{const s=arr.slice().sort((a,b)=>a-b);return s.length?s[Math.min(s.length-1,Math.floor(p*(s.length-1)))].toFixed(1):'0';};

  log('CENÁRIOS MEDIDOS: '+cenarios.length);
  log('');
  log('VEREDITOS: original '+vereditos.original+' · adaptadas '+vereditos.adapted+' · BLOQUEADAS '+vereditos.unsafe
      +'  ('+pct(vereditos.unsafe,cenarios.length)+' bloqueadas)');
  log('  motivo do bloqueio: '+JSON.stringify(motivoUnsafe));
  log('');
  log('ALTERNATIVAS: geradas em '+comAlternativas+'/'+cenarios.length+' ('+pct(comAlternativas,cenarios.length)+')');
  log('  alternativa venceu a padrão: '+alternativaVenceu+' ('+pct(alternativaVenceu,comAlternativas)+' das vezes que rodou)');
  log('  manteve a padrão tendo ganho abaixo da margem: '+empates);
  log('  vitórias por política: '+JSON.stringify(vitorias));
  log('  ganho quando troca: mediana '+q(margens,0.5)+' · p90 '+q(margens,0.9)+' · máx '+q(margens,1));
  log('');
  const comEncolhimento=encolhimentos.filter(v=>v>0.001);
  log('LETRA ENCOLHIDA (o que o franqueado vê como "ficou tudo pequeno"):');
  log('  artes que chegam com alguma redução: '+comEncolhimento.length+'/'+encolhimentos.length
      +' ('+pct(comEncolhimento.length,encolhimentos.length)+')');
  log('  redução quando acontece: mediana '+(comEncolhimento.length?(q(comEncolhimento.map(v=>v*100),0.5)+'%'):'—')
      +' · p90 '+(comEncolhimento.length?(q(comEncolhimento.map(v=>v*100),0.9)+'%'):'—')
      +' · máx '+(comEncolhimento.length?(q(comEncolhimento.map(v=>v*100),1)+'%'):'—'));
  encolheuEm.slice(0,10).forEach(e=>log('    '+e));
  log('');
  log('ITENS DE PONTUAÇÃO QUE DISPARAM (em quantos cenários):');
  Object.keys(gScoreComposition([], {canvas:{w:1,h:1}}).itens).forEach(k=>{
    log('  '+k.padEnd(14)+' '+String(itensQueDisparam[k]||0).padStart(4)+'  '+pct(itensQueDisparam[k]||0,cenarios.length));
  });
  log('');
  log('TEMPO POR POLÍTICA (ms): ');
  POLS.forEach(p=>log('  '+p.padEnd(18)+' p50 '+q(tempos[p],0.5)+' · p95 '+q(tempos[p],0.95)+' · máx '+q(tempos[p],1)));
  log('');
  log('DANO REAL (fuga da prancheta ou sobreposição nova), medido com a régua do motor:');
  const escapou=bloqueadas.filter(b=>b.status!=='unsafe');
  log('  artes APROVADAS que saíram com dano: '+escapou.length+'  ← estas são o buraco do guardião');
  bloqueadas.forEach(b=>log('   ['+b.status+'] '+b.nome
    +' · fora='+b.fora+'px · sobrepos='+b.sobrepos+'px² · '+b.info));
  log('');
  log('TROCAS DE POLÍTICA (as 25 primeiras):');
  trocas.slice(0,25).forEach(t=>log('  '+t));

  window.__lumaTest={passed:1,total:1,failures:[],notas:linhas};
  document.title='OK — bancada';
})();
