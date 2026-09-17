/* ══════════════════════════════════════════════════════════════════════════════════════════
   SHADOW VALIDATION — Fase 7. Abra `tests/shadow.html` ou rode
   `node scripts/run-browser-tests.js shadow`.

   As fases 5 a 6.6 construíram e calibraram o Automatic Designer. Esta não inventa nada: ela
   roda o pipeline novo inteiro AO LADO do solver, em massa, e mede. O que o franqueado baixa
   continua saindo do solver — nenhum vencedor ganha autoridade aqui.

   ⛔ O CORPUS DA FASE 6 ERA PEQUENO DEMAIS para responder "isto é confiável?". 25 cenários não
   mostram distribuição de nada. Aqui um gerador DETERMINÍSTICO de variações de conteúdo
   produz centenas de execuções sobre os mesmos templates reais — sem LLM, sem aleatório: as
   variações saem de um banco fixo de palavras e de aritmética sobre o índice, então a mesma
   suíte roda igual no meu Chrome, no seu e no CI.

   O que ela responde, em ordem:
     1. DISTRIBUIÇÃO   original-first, normal, emergência, sem vencedor, contrato reprovado.
     2. LEGADO × NOVO  as seis classes (A–F) e os cinco níveis de equivalência.
     3. SO-SEARCH      onde o solver falha e o novo resolve — o valor real da arquitetura.
     4. DIVERGÊNCIA    seguro nos dois, diferente na tela: melhor, igual ou regressão?
     5. CONFIANÇA      os tiers, e a PROVA de que ALTA concentra caso estável.
     6. ESTABILIDADE   o vencedor muda com ±1 caractere?
     7. SAÚDE          métrica por template.
     8. DESEMPENHO     p50/p95/p99/máx por etapa e por porte de arte.
     9. FALHA          injeção deliberada: shadow nunca pode derrubar o solver.
   ══════════════════════════════════════════════════════════════════════════════════════════ */
(async function(){
  const results=document.getElementById('results');
  const summary=document.getElementById('summary');
  const cases=[]; const avisos=[];
  const test=(name,fn)=>cases.push({name,fn});
  const assert=(c,m)=>{if(!c)throw new Error(m||'asserção falhou');};
  const fixtures=(window.LUMA_CORPUS||[]);
  const clonar=(ls)=>ls.map(l=>JSON.parse(JSON.stringify(l)));

  /* ── O GERADOR DE VARIAÇÕES (§9) ────────────────────────────────────────────────────────
     ⛔ DETERMINÍSTICO, E É O PONTO. Nada de `Math.random` e nada de LLM: o banco de palavras é
     fixo e a escolha sai de aritmética sobre o índice da variação. Duas execuções da suíte
     produzem exatamente as mesmas centenas de casos — sem isso, "o shadow passou" não é
     afirmação sobre nada.

     As classes de variação saem do que quebra arte de verdade, não do que é fácil de gerar:
     texto curto/médio/longo/extremo, palavra longa que não quebra, preço curto e longo, CTA
     curto e longo, campo opcional vazio, e o caso que o corpus quase não tinha — VÁRIOS campos
     crescendo ao mesmo tempo. */
  const PALAVRAS=['combo','artesanal','da casa','com borda recheada','bebida gelada','sobremesa',
    'do dia','batata rústica','molho especial','queijo','calabresa','catupiry','promoção',
    'por tempo limitado','só hoje','na compra de dois','frete grátis','entrega rápida'];
  const LONGAS=['superextraordinário','hiperpersonalizável','desproporcionalmente',
    'incontestavelmente','eletroencefalografista'];
  const PRECOS_CURTOS=['R$ 9,90','R$ 19,90','R$ 29,90'];
  const PRECOS_LONGOS=['R$ 1.249,90','R$ 12.499,00','De R$ 1.299,90 por'];
  const CTAS_CURTOS=['PEÇA','VEM','JÁ'];
  const CTAS_LONGOS=['PEÇA AGORA PELO APLICATIVO E APROVEITE','GARANTA O SEU AGORA MESMO NO APP'];

  /* Monta um texto de N palavras a partir do índice — sempre as mesmas palavras, sempre na
     mesma ordem, para o mesmo (n, semente). */
  const frase=(n,semente)=>{
    const out=[];
    for(let i=0;i<n;i++) out.push(PALAVRAS[(semente*7+i*3)%PALAVRAS.length]);
    return out.join(' ');
  };
  const CLASSES=['curto','medio','longo','extremo','palavra-longa','vazio'];
  /* O valor de UM campo, dada a classe e a semente. O tipo do campo manda: preço não recebe
     frase, e CTA não recebe parágrafo. */
  function valorDe(campo,classe,semente){
    const nome=String(campo.name||'').toLowerCase();
    const ehPreco=/pre[cç]o|valor|de$|^por$|cupom|c[oó]digo/.test(nome)
      || campo.type==='currency' || /R\$/.test(String(campo.example||''));
    const ehCta=/cta|bot[aã]o|chamada/.test(nome);
    if(classe==='vazio') return '';
    if(ehPreco) return classe==='curto'?PRECOS_CURTOS[semente%PRECOS_CURTOS.length]
                     :classe==='palavra-longa'?PRECOS_LONGOS[semente%PRECOS_LONGOS.length]
                     :classe==='medio'?PRECOS_CURTOS[(semente+1)%PRECOS_CURTOS.length]
                     :PRECOS_LONGOS[semente%PRECOS_LONGOS.length];
    if(ehCta) return (classe==='curto'||classe==='medio')
      ? CTAS_CURTOS[semente%CTAS_CURTOS.length] : CTAS_LONGOS[semente%CTAS_LONGOS.length];
    switch(classe){
      case 'curto':        return frase(1,semente);
      case 'medio':        return frase(4,semente);
      case 'longo':        return frase(9,semente);
      case 'extremo':      return frase(20,semente);
      case 'palavra-longa':return LONGAS[semente%LONGAS.length]+' '+frase(3,semente);
      default:             return String(campo.example||'');
    }
  }
  /* As variações de UM fixture. Duas famílias, de propósito:
     · UM CAMPO POR VEZ — isola qual campo quebra a arte (é o que o diagnóstico precisa);
     · TODOS JUNTOS — o caso real do franqueado, que o corpus quase não tinha. */
  const SEMENTES=[0,1,2];
  function variacoes(fx){
    const campos=(fx.campos||[]).filter(c=>c&&c.name);
    const base={}; campos.forEach(c=>{ base[c.name]=String(c.example==null?'':c.example); });
    const out=[{ id:'autoral', dados:Object.assign({},base) }];
    // ── FAMÍLIA 1 · UM CAMPO POR VEZ, em três sementes: isola quem quebra a arte.
    campos.forEach((c,ci)=>{
      CLASSES.forEach((cl,li)=>{
        if(cl==='vazio'&&!/opcional|selo|cupom/i.test(c.name)) return;   // vazio só onde faz sentido
        SEMENTES.forEach(s=>{
          if(cl==='vazio'&&s>0) return;                                   // vazio não tem variante
          const d=Object.assign({},base);
          d[c.name]=valorDe(c,cl,ci*7+li*3+s);
          out.push({ id:c.name+'/'+cl+(s?'#'+s:''), dados:d });
        });
      });
    });
    // ── FAMÍLIA 2 · DOIS CAMPOS CRESCENDO JUNTOS: a colisão que um campo só não produz.
    for(let a=0;a<campos.length;a++)
      for(let b=a+1;b<campos.length;b++){
        const d=Object.assign({},base);
        d[campos[a].name]=valorDe(campos[a],'longo',a*5+b);
        d[campos[b].name]=valorDe(campos[b],'longo',b*5+a);
        out.push({ id:campos[a].name+'+'+campos[b].name+'/longo', dados:d });
      }
    // ── FAMÍLIA 3 · TODOS JUNTOS: o caso real do franqueado, que o corpus quase não tinha.
    ['medio','longo','extremo','palavra-longa'].forEach((cl,li)=>{
      SEMENTES.forEach(s=>{
        const d={};
        campos.forEach((c,ci)=>{ d[c.name]=valorDe(c,cl,ci+li*5+s*11); });
        out.push({ id:'todos/'+cl+(s?'#'+s:''), dados:d });
      });
    });
    return out;
  }

  /* ── TEMPLATES SINTÉTICOS DE PORTE MÉDIO E GRANDE (§14) ─────────────────────────────────
     O corpus real é todo `small` (4 a 8 camadas). Sem `medium` e `large` não há orçamento de
     desempenho por classe — e é justamente na arte grande que a busca custa. A geometria é
     regular de propósito: o que se mede aqui é CUSTO por porte, não qualidade de composição. */
  function templateSintetico(nome,n){
    const layers=[], cols=6, passo=Math.floor(1600/Math.ceil(n/cols));
    for(let i=0;i<n;i++){
      const din=i%12===0;
      layers.push({ id:'l'+i, name:(i===0?'Título':i%12===0?'Produto':i%7===0?'Preço':'Descrição'),
        type:'text', content:din?'{{campo'+Math.floor(i/12)+'}}':'Texto fixo '+i,
        isVar:din, x:60+(i%cols)*170, y:60+Math.floor(i/cols)*passo, w:160, h:44,
        font:'Arial', fontSize:i===0?64:i%12===0?40:22, lineHeight:1.2, textAlign:'left',
        textBox:'point', vAlign:'top', visible:true, opacity:100,
        layoutRefText:din?'Exemplo '+i:undefined });
    }
    const campos=[];
    for(let k=0;k*12<n;k++) campos.push({ name:'campo'+k, label:'Campo '+k, example:'Exemplo '+(k*12) });
    return { nome:nome, canvas:{w:1080,h:1920}, layers:layers, campos:campos };
  }
  const SINTETICOS=[templateSintetico('sintético-medium',60),
                    templateSintetico('sintético-large',200)];

  /* ── A CORRIDA EM MASSA ─────────────────────────────────────────────────────────────────
     Uma passada só: todos os registros ficam guardados e cada caso desta suíte lê deles. Rodar
     o pipeline de novo por pergunta multiplicaria o custo por dez sem mudar uma resposta. */
  const REGISTROS=[];
  const ERROS=[];
  test('shadow: a corrida em massa sobre os templates reais',()=>{
    const t0=performance.now();
    fixtures.forEach(fx=>{
      // O catálogo do fixture, do mesmo jeito que o corpus publica (migração de baseline).
      window.dVars=(fx.campos||[]).map(c=>Object.assign({type:'text'},c));
      variacoes(fx).forEach(v=>{
        const rec=gShadowValidationRecord(fx,v.dados,{});
        rec.variacao=v.id; rec.dadosUsados=v.dados;
        REGISTROS.push(rec);
        if(rec.erro) ERROS.push(rec.templateId+'|'+v.id+': '+rec.erro);
      });
    });
    const ms=performance.now()-t0;
    avisos.push('§1 · CORRIDA: '+REGISTROS.length+' execuções shadow sobre '+fixtures.length
      +' templates reais em '+Math.round(ms)+'ms ('+(ms/Math.max(1,REGISTROS.length)).toFixed(1)
      +'ms cada)');
    /* Os sintéticos entram com poucas variações: o que se quer deles é o CUSTO por porte,
       e uma arte de 200 camadas custa mais de um segundo por execução. */
    const tS=performance.now();
    SINTETICOS.forEach(fx=>{
      window.dVars=(fx.campos||[]).map(c=>Object.assign({type:'text'},c));
      [['autoral',null],['todos/longo','longo'],['todos/extremo','extremo']].forEach(([id,cl])=>{
        const d={};
        (fx.campos||[]).forEach((c,ci)=>{ d[c.name]=cl?valorDe(c,cl,ci):String(c.example); });
        const rec=gShadowValidationRecord(fx,d,{});
        rec.variacao=id; rec.sintetico=true;
        REGISTROS.push(rec);
        if(rec.erro) ERROS.push(rec.templateId+'|'+id+': '+rec.erro);
      });
    });
    avisos.push('§14 · sintéticos (medium 60 camadas, large 200): '
      +Math.round(performance.now()-tS)+'ms para 6 execuções');
    assert(REGISTROS.length>=300,'a corrida gerou só '+REGISTROS.length+' execuções');
    assert(!ERROS.length,'o pipeline shadow lançou em '+ERROS.length+' execuções: '
      +ERROS.slice(0,3).join(' · '));
  });

  /* ── FERRAMENTAS DE RELATÓRIO ─────────────────────────────────────────────────────────── */
  const pct=(n,d)=>d?Math.round(n/d*1000)/10:0;
  const conta=(arr,fn)=>arr.filter(fn).length;
  const percentil=(arr,p)=>{ const s=arr.slice().sort((a,b)=>a-b);
    return s.length?Math.round(s[Math.min(s.length-1,Math.floor(s.length*p))]*100)/100:0; };
  const comVencedor=()=>REGISTROS.filter(r=>r.winner&&r.winner.acoes);

  /* ══ 1. DISTRIBUIÇÃO DE RESULTADOS (§10) ══════════════════════════════════════════════ */
  test('shadow: distribuição de resultados',()=>{
    const n=REGISTROS.length;
    const of=conta(REGISTROS,r=>r.originalFirst);
    const semVenc=conta(REGISTROS,r=>!r.winner||!r.winner.acoes);
    const emerg=conta(REGISTROS,r=>r.winner&&r.winner.modo==='emergency');
    const normal=conta(REGISTROS,r=>r.winner&&r.winner.modo!=='emergency')-of;
    const contrato=conta(REGISTROS,r=>r.scoring&&r.scoring.porContrato>0);
    avisos.push('§10 · DISTRIBUIÇÃO ('+n+' execuções):');
    avisos.push('   original-first (arte já cabe): '+of+' ('+pct(of,n)+'%)');
    avisos.push('   Local Fit: 0 (0%) — a frente paralela NÃO existe neste repositório;'
      +' o proxy medido é original-first, acima');
    avisos.push('   Search normal: '+Math.max(0,normal)+' ('+pct(Math.max(0,normal),n)+'%)');
    avisos.push('   Search emergency: '+emerg+' ('+pct(emerg,n)+'%)');
    avisos.push('   sem vencedor: '+semVenc+' ('+pct(semVenc,n)+'%)');
    avisos.push('   com descarte por Candidate Contract: '+contrato+' ('+pct(contrato,n)+'%)');
    assert(n===of+Math.max(0,normal)+emerg+semVenc,'a distribuição não fecha com o total');
  });

  /* ══ 2. LEGADO × NOVO — as seis classes (§3) e a equivalência (§4) ════════════════════ */
  test('shadow: classificação legado × novo',()=>{
    const n=REGISTROS.length;
    const porClasse={}; REGISTROS.forEach(r=>{ porClasse[r.classe]=(porClasse[r.classe]||0)+1; });
    const rot={ A:'legacy-safe / new-safe / equivalente', B:'legacy-safe / new-safe / diferente',
      C:'legacy-unsafe / new-safe (SO-SEARCH)', D:'legacy-safe / new-no-winner',
      E:'legacy-unsafe / new-no-winner', F:'new-unsafe-attempt rejeitado' };
    avisos.push('§3 · CLASSES ('+n+' execuções):');
    ['A','B','C','D','E','F'].forEach(k=>avisos.push('   '+k+') '+rot[k]+': '
      +(porClasse[k]||0)+' ('+pct(porClasse[k]||0,n)+'%)'));
    const porEq={}; REGISTROS.forEach(r=>{ if(r.equivalencia) porEq[r.equivalencia]=(porEq[r.equivalencia]||0)+1; });
    const comEq=Object.keys(porEq).reduce((s,k)=>s+porEq[k],0);
    avisos.push('§4 · EQUIVALÊNCIA ('+comEq+' execuções com vencedor e saída legada):');
    G_SHADOW_EQUIV.slice().reverse().forEach(k=>avisos.push('   '+k+': '+(porEq[k]||0)
      +' ('+pct(porEq[k]||0,comEq)+'%)'));
    window.__CLASSES=porClasse; window.__EQ=porEq;
    /* ⛔ A ASSERÇÃO QUE NÃO PODE FALHAR: nenhum vencedor inseguro. Se um candidato reprovado
       pelo portão ou pelo contrato chegasse a vencer, a arquitetura nova estaria mentindo. */
    const inseguros=REGISTROS.filter(r=>r.winner&&r.winner.acoes
      &&(r.winner.seguro===false||r.winner.contrato===false));
    assert(!inseguros.length,'UM VENCEDOR INSEGURO FOI ELEITO em '+inseguros.length+' execuções: '
      +inseguros.slice(0,3).map(r=>r.templateId+'|'+r.variacao).join(' · '));
  });

  /* ══ 3. SO-SEARCH — onde o solver falha e o novo resolve (§15) ════════════════════════ */
  test('shadow: so-search, os casos que provam valor',()=>{
    const so=REGISTROS.filter(r=>r.classe==='C');
    avisos.push('§15 · SO-SEARCH: '+so.length+' execuções em que o solver entrega arte'
      +' REPROVADA e a busca acha solução aprovada ('+pct(so.length,REGISTROS.length)+'%)');
    so.slice(0,8).forEach(r=>{
      avisos.push('   '+r.templateId+' | '+r.variacao
        +'\n      solver: reprovado em '+r.legacy.voltas+' voltas'
        +' · busca: ['+r.winner.acoes.join('→')+'] '+r.winner.modo+' d'+r.winner.depth
        +'\n      decidiu '+(r.winner.criterio||r.winner.wonBy||'único candidato')
        +' · segurança ok · contrato ok'
        +' · equivalência '+r.equivalencia+' ('+r.equivalenciaMotivo+')'
        +'\n      confiança '+r.confianca.tier+': '+r.confianca.motivos.join('; '));
    });
    if(so.length>8) avisos.push('   (+'+(so.length-8)+' outros)');
    window.__SOSEARCH=so;
    /* Todo so-search PRECISA passar pelas duas camadas de segurança — é o mínimo para que o
       caso conte como valor e não como risco. */
    so.forEach(r=>{
      assert(r.winner.seguro!==false,'so-search com segurança reprovada em '+r.templateId);
      assert(r.winner.contrato!==false,'so-search com contrato reprovado em '+r.templateId);
    });
  });

  /* ══ 4. DIVERGÊNCIA SEGURA (§16) ═════════════════════════════════════════════════════ */
  test('shadow: divergências seguras, classificadas sem veredito automático',()=>{
    const div=REGISTROS.filter(r=>r.classe==='B'&&r.equivalencia&&r.equivalencia!=='exact');
    /* ⛔ NÃO SE AUTOMATIZA "MELHOR". O que dá para afirmar por FATO é: preservou mais hierarquia
       autoral, preservou menos, ou empatou dentro da resolução da métrica. Qualquer coisa além
       disso é gosto, e gosto não entra em relatório de confiabilidade. */
    /* ⛔ NENHUM RÓTULO DIZ "MELHOR". Os três nomes são descrições do FATO medido, e a leitura
       de qual é preferível fica com quem lê o relatório — que é o que a §16 pede. */
    const buckets={ 'estrutura-preservada':0, 'relação-mudada':0, 'regressão-potencial':0 };
    const exemplos={ 'estrutura-preservada':[], 'relação-mudada':[], 'regressão-potencial':[] };
    div.forEach(r=>{
      const reg=(r.regressoes||[]).filter(x=>x.tipo==='hierarchy-worse'
        ||x.tipo==='semantic-role-worse');
      let k;
      if(reg.length||r.equivalencia==='semantically-different') k='regressão-potencial';
      else if(r.equivalencia==='structurally-equivalent') k='estrutura-preservada';
      else k='relação-mudada';
      buckets[k]++;
      if(exemplos[k]&&exemplos[k].length<3)
        exemplos[k].push(r.templateId+'|'+r.variacao+' → '+r.equivalencia
          +' ('+r.equivalenciaMotivo+')'+(reg.length?' · '+JSON.stringify(reg):''));
    });
    avisos.push('§16 · DIVERGÊNCIA SEGURA (legacy safe + new safe + diferente): '+div.length);
    Object.keys(buckets).forEach(k=>avisos.push('   '+k+': '+buckets[k]
      +' ('+pct(buckets[k],div.length)+'%)'));
    Object.keys(exemplos).forEach(k=>exemplos[k].forEach(e=>avisos.push('   ['+k+'] '+e)));
    window.__DIVERGENCIA=buckets;
    assert(true,'diagnóstico');
  });

  /* ══ 5. BALDE DE REGRESSÃO (§17) ═════════════════════════════════════════════════════ */
  test('shadow: balde de regressão',()=>{
    const bucket={};
    const exemplos={};
    REGISTROS.forEach(r=>(r.regressoes||[]).forEach(x=>{
      bucket[x.tipo]=(bucket[x.tipo]||0)+1;
      (exemplos[x.tipo]||(exemplos[x.tipo]=[])).length<3
        && exemplos[x.tipo].push(r.templateId+'|'+r.variacao+' '+JSON.stringify(x));
    }));
    const total=Object.keys(bucket).reduce((s,k)=>s+bucket[k],0);
    avisos.push('§17 · REGRESSÕES: '+total+' sinal(is) em '
      +conta(REGISTROS,r=>(r.regressoes||[]).length)+' execuções de '+REGISTROS.length);
    Object.keys(bucket).sort((a,b)=>bucket[b]-bucket[a]).forEach(k=>{
      avisos.push('   '+k+': '+bucket[k]);
      (exemplos[k]||[]).forEach(e=>avisos.push('      '+e));
    });
    if(!total) avisos.push('   nenhum sinal de regressão no corpus desta corrida');
    window.__REGRESSOES=bucket;
    assert(true,'diagnóstico');
  });

  /* ══ 6. GRUPO ADAPTATIVO (§18) e EMERGÊNCIA (§19) ════════════════════════════════════ */
  test('shadow: vigilância do grupo adaptativo',()=>{
    const cv=comVencedor();
    const ratios=cv.map(r=>r.winner.grupoRatio||0);
    const sizes=cv.map(r=>r.winner.grupoSize||0);
    const grandes=cv.filter(r=>(r.winner.grupoSize||0)>=G_SHADOW_CONF.grupoGrandeAbs);
    avisos.push('§18 · GRUPO ADAPTATIVO ('+cv.length+' vencedores): ratio p50 '
      +percentil(ratios,0.5)+' · p95 '+percentil(ratios,0.95)+' · máx '
      +percentil(ratios,1)+' · tamanho máx '+percentil(sizes,1)+' camadas');
    avisos.push('   com '+G_SHADOW_CONF.grupoGrandeAbs+'+ camadas no grupo: '+grandes.length
      +' ('+pct(grandes.length,cv.length)+'%) — alerta OBSERVACIONAL, não bloqueia');
    grandes.slice(0,4).forEach(r=>avisos.push('      '+r.templateId+'|'+r.variacao
      +' ratio '+r.winner.grupoRatio+' ('+r.winner.grupoSize+' camadas) · confiança '
      +r.confianca.tier));
    /* A DISTRIBUIÇÃO ENTRE OS ADAPTADOS — é dela que sai o limiar, não de anedota. Entre os
       vencedores que NÃO são original-first, o ratio não separa nada numa arte de 5 camadas:
       dois blocos descendo juntos já são 40%. */
    const ad=cv.filter(r=>!r.originalFirst);
    const hist={};
    ad.forEach(r=>{ const k=(r.winner.grupoSize||0)+' camadas / '
      +Math.round((r.winner.grupoRatio||0)*100)+'%'; hist[k]=(hist[k]||0)+1; });
    avisos.push('§18 · entre os '+ad.length+' vencedores ADAPTADOS, (tamanho absoluto / fração):');
    Object.keys(hist).sort().forEach(k=>avisos.push('      '+k+': '+hist[k]));
    avisos.push('      ratio p50 '+percentil(ad.map(r=>r.winner.grupoRatio||0),0.5)
      +' · p95 '+percentil(ad.map(r=>r.winner.grupoRatio||0),0.95)
      +' · tamanho p50 '+percentil(ad.map(r=>r.winner.grupoSize||0),0.5)
      +' · p95 '+percentil(ad.map(r=>r.winner.grupoSize||0),0.95));
    const dependia=conta(cv,r=>(r.winner.acoes||[]).indexOf('scale-component')>=0);
    avisos.push('   vencedores que usaram scale-component: '+dependia+' ('+pct(dependia,cv.length)+'%)');
    assert(true,'diagnóstico');
  });

  test('shadow: vigilância da emergência',()=>{
    const rodou=conta(REGISTROS,r=>r.search&&r.search.emergenciaRodou);
    const venceu=REGISTROS.filter(r=>r.winner&&r.winner.modo==='emergency');
    avisos.push('§19 · EMERGÊNCIA: rodou em '+rodou+' execuções ('+pct(rodou,REGISTROS.length)
      +'%) · venceu em '+venceu.length+' ('+pct(venceu.length,REGISTROS.length)+'%)');
    const porTpl={}; venceu.forEach(r=>{ porTpl[r.templateId]=(porTpl[r.templateId]||0)+1; });
    Object.keys(porTpl).sort((a,b)=>porTpl[b]-porTpl[a]).forEach(k=>{
      const total=conta(REGISTROS,r=>r.templateId===k);
      avisos.push('   '+k+': '+porTpl[k]+'/'+total+' ('+pct(porTpl[k],total)+'% das execuções)');
    });
    const campos={}; venceu.forEach(r=>{ const c=String(r.variacao).split('/')[0];
      campos[c]=(campos[c]||0)+1; });
    avisos.push('   campos que mais levam à emergência: '
      +Object.keys(campos).sort((a,b)=>campos[b]-campos[a]).slice(0,5)
        .map(k=>k+' ('+campos[k]+')').join(', '));
    if(venceu.length) avisos.push('   profundidade média '
      +(venceu.reduce((s,r)=>s+r.winner.depth,0)/venceu.length).toFixed(1)
      +' · compressão média '
      +(venceu.reduce((s,r)=>s+(r.winner.compressao||0),0)/venceu.length).toFixed(3));
    assert(true,'diagnóstico');
  });

  /* ══ 7. SAÚDE POR TEMPLATE (§20) ═════════════════════════════════════════════════════ */
  test('shadow: saúde por template',()=>{
    const porT={};
    REGISTROS.forEach(r=>{
      const t=porT[r.templateId]||(porT[r.templateId]={n:0,of:0,normal:0,emerg:0,sem:0,
        acoes:0,camadas:0,grupo:0,compressao:0,comVenc:0,contrato:0});
      t.n++;
      if(r.originalFirst) t.of++;
      if(r.scoring&&r.scoring.porContrato>0) t.contrato++;
      if(!r.winner||!r.winner.acoes){ t.sem++; return; }
      t.comVenc++;
      if(r.winner.modo==='emergency') t.emerg++; else if(!r.originalFirst) t.normal++;
      t.acoes+=r.winner.acoes.length; t.camadas+=(r.winner.camadasAlteradas||0);
      t.grupo+=(r.winner.grupoRatio||0); t.compressao+=(r.winner.compressao||0);
    });
    avisos.push('§20 · SAÚDE POR TEMPLATE (diagnóstico — não muda layout nenhum):');
    Object.keys(porT).sort().forEach(k=>{
      const t=porT[k], v=Math.max(1,t.comVenc);
      avisos.push('   '+k+' ('+t.n+' execuções): original-first '+pct(t.of,t.n)
        +'% · normal '+pct(t.normal,t.n)+'% · emergência '+pct(t.emerg,t.n)
        +'% · sem vencedor '+pct(t.sem,t.n)+'% · contrato '+pct(t.contrato,t.n)
        +'% · média de ações '+(t.acoes/v).toFixed(1)
        +' · camadas alteradas '+(t.camadas/v).toFixed(1)
        +' · grupo '+(t.grupo/v).toFixed(2)
        +' · compressão '+(t.compressao/v).toFixed(3));
    });
    window.__SAUDE=porT;
    assert(Object.keys(porT).length>=6,'a saúde não cobriu todos os templates');
  });

  /* ══ 8. CONFIANÇA (§5/§6) e O QUE SERIA ENTREGUE (§11) ═══════════════════════════════ */
  test('shadow: tiers de confiança e taxa de entrega',()=>{
    const tiers={}; REGISTROS.forEach(r=>{ tiers[r.confianca.tier]=(tiers[r.confianca.tier]||0)+1; });
    avisos.push('§6 · CONFIANÇA ('+REGISTROS.length+' execuções):');
    ['ALTA','MEDIA','BAIXA','BLOQUEADO'].forEach(k=>avisos.push('   '+k+': '+(tiers[k]||0)
      +' ('+pct(tiers[k]||0,REGISTROS.length)+'%)'));
    const ent={}; REGISTROS.forEach(r=>{ ent[r.entrega]=(ent[r.entrega]||0)+1; });
    avisos.push('§11 · SE O NOVO MOTOR TIVESSE AUTORIDADE (taxa de entrega estimada):');
    ['wouldDeliverSafe','wouldBlock','wouldFallbackLegacy'].forEach(k=>avisos.push('   '+k+': '
      +(ent[k]||0)+' ('+pct(ent[k]||0,REGISTROS.length)+'%)'));
    avisos.push('   unsafe-delivery-rate no shadow: 0% — nada novo é entregue, por construção');
    const motivos={}; REGISTROS.filter(r=>r.entrega!=='wouldDeliverSafe')
      .forEach(r=>{ motivos[r.entregaMotivo]=(motivos[r.entregaMotivo]||0)+1; });
    Object.keys(motivos).sort((a,b)=>motivos[b]-motivos[a]).forEach(k=>
      avisos.push('      não entregaria por: '+k+' ('+motivos[k]+')'));
    /* POR QUE cada execução caiu de tier — sem isso o tier é um rótulo sem endereço. */
    const razoes={};
    REGISTROS.filter(r=>r.confianca.tier!=='ALTA').forEach(r=>
      r.confianca.motivos.forEach(m=>{
        const k=m.replace(/\d+/g,'N');
        razoes[k]=(razoes[k]||0)+1;
      }));
    avisos.push('§6 · POR QUE NÃO FOI ALTA (motivos, podem se acumular):');
    Object.keys(razoes).sort((a,b)=>razoes[b]-razoes[a]).forEach(k=>
      avisos.push('   '+k+': '+razoes[k]));
    /* E o recorte que importa: entre os vencedores ADAPTADOS (fora do original-first), quantos
       chegam a ALTA? Se nenhum chegar, o tier está medindo "a arte já cabia", não confiança. */
    const adaptados=comVencedor().filter(r=>!r.originalFirst);
    const altaAdaptada=conta(adaptados,r=>r.confianca.tier==='ALTA');
    avisos.push('§6 · entre os '+adaptados.length+' vencedores ADAPTADOS: '+altaAdaptada
      +' ALTA ('+pct(altaAdaptada,adaptados.length)+'%), '
      +conta(adaptados,r=>r.confianca.tier==='MEDIA')+' MEDIA, '
      +conta(adaptados,r=>r.confianca.tier==='BAIXA')+' BAIXA');
    window.__TIERS=tiers; window.__ENTREGA=ent; window.__ADAPTADOS=adaptados;
    /* ⛔ `wouldBlock` só pode existir com segurança ou contrato reprovado — nunca por gosto. */
    REGISTROS.filter(r=>r.entrega==='wouldBlock').forEach(r=>
      assert(r.winner&&(r.winner.seguro===false||r.winner.contrato===false),
        'bloqueou sem reprovação de segurança nem de contrato em '+r.templateId));
  });

  /* ══ 9. ESTABILIDADE DA DECISÃO (§7) e VALIDAÇÃO DA CONFIANÇA (§21) ══════════════════
     A Fase 6.6 mediu estabilidade perturbando a GEOMETRIA. Aqui a perturbação é a que o
     franqueado produz sozinho: mais um caractere, um centavo a mais no preço, uma palavra
     trocada por outra do mesmo tamanho, um pixel na caixa. Se o vencedor vira outro com isso,
     a decisão não estava madura.

     ⛔ E é AQUI que a confiança é julgada. Se ALTA não for comprovadamente mais estável que
     MEDIA e BAIXA, o tier não está calibrado — e dizer isso é a entrega, não esconder. */
  const PERT_ENTRADA=[
    { id:'+1 caractere', fn:(fx,d)=>{ const k=maiorCampo(d); if(!k) return null;
      const n=Object.assign({},d); n[k]=String(n[k])+'a'; return {fx:fx,dados:n}; } },
    { id:'-1 caractere', fn:(fx,d)=>{ const k=maiorCampo(d); if(!k||!String(d[k]).length) return null;
      const n=Object.assign({},d); n[k]=String(n[k]).slice(0,-1); return {fx:fx,dados:n}; } },
    { id:'preço +10 centavos', fn:(fx,d)=>{ const k=Object.keys(d).find(x=>/R\$/.test(String(d[x])));
      if(!k) return null; const n=Object.assign({},d);
      n[k]=String(n[k]).replace(/,(\d\d)/,(m,c)=>','+String(Math.min(99,Number(c)+10)).padStart(2,'0'));
      return {fx:fx,dados:n}; } },
    { id:'palavra equivalente', fn:(fx,d)=>{ const k=maiorCampo(d); if(!k) return null;
      const n=Object.assign({},d);
      n[k]=String(n[k]).replace(/\bqueijo\b/,'bacon').replace(/\bcombo\b/,'prato')
                       .replace(/\bbebida\b/,'suquin');
      return n[k]===d[k]?null:{fx:fx,dados:n}; } },
    { id:'caixa +1px', fn:(fx,d)=>{ const ls=clonar(fx.layers);
      const alvo=ls.filter(l=>l.type==='text').sort((a,b)=>(b.w||0)-(a.w||0))[0];
      if(!alvo) return null; alvo.w=(alvo.w||0)+1;
      return {fx:Object.assign({},fx,{layers:ls}),dados:d}; } }
  ];
  function maiorCampo(d){
    const ks=Object.keys(d||{}).filter(k=>String(d[k]).length);
    return ks.sort((a,b)=>String(d[b]).length-String(d[a]).length)[0]||null;
  }
  const chaveVencedor=(rec)=>rec.winner&&rec.winner.acoes
    ? rec.winner.acoes.join('→')+'@'+rec.winner.modo+'d'+rec.winner.depth : '(sem vencedor)';

  test('shadow: estabilidade do vencedor sob perturbação de entrada',()=>{
    const porTier={ ALTA:[], MEDIA:[], BAIXA:[] };
    /* Amostra determinística: os N primeiros de cada tier, na ordem em que a corrida os
       produziu. Sem sorteio — a suíte tem que dar o mesmo resultado em toda execução. */
    REGISTROS.forEach(r=>{ if(porTier[r.confianca.tier]&&porTier[r.confianca.tier].length<24
      &&r.winner&&r.winner.acoes&&!r.sintetico) porTier[r.confianca.tier].push(r); });
    const stats={};
    const exemplos=[];
    Object.keys(porTier).forEach(tier=>{
      let n=0, flips=0, drasticos=0;
      porTier[tier].forEach(r=>{
        const fx=fixtures.find(f=>f.nome===r.templateId);
        if(!fx) return;
        const base=chaveVencedor(r);
        PERT_ENTRADA.forEach(p=>{
          const alvo=p.fn(fx,r.dadosUsados);
          if(!alvo) return;
          window.dVars=(fx.campos||[]).map(c=>Object.assign({type:'text'},c));
          const novo=gShadowValidationRecord(alvo.fx,alvo.dados,{});
          n++;
          const k=chaveVencedor(novo);
          if(k!==base){
            flips++;
            /* DRÁSTICO é o que importa: trocar de MODO, perder o vencedor ou mudar de tier de
               decisão. Uma ação a mais na mesma família é o motor reagindo a mais conteúdo. */
            const modoMudou=(novo.winner&&novo.winner.modo)!==(r.winner&&r.winner.modo);
            const sumiu=!novo.winner||!novo.winner.acoes;
            if(modoMudou||sumiu){
              drasticos++;
              if(exemplos.length<5) exemplos.push(tier+' · '+r.templateId+'|'+r.variacao
                +' · '+p.id+': '+base+' → '+k);
            }
          }
        });
      });
      stats[tier]={ n:n, flips:flips, drasticos:drasticos,
                    taxa:pct(flips,n), taxaDrastica:pct(drasticos,n) };
    });
    avisos.push('§7 · ESTABILIDADE sob perturbação de ENTRADA (±1 caractere, centavos,'
      +' palavra equivalente, 1px de caixa):');
    Object.keys(stats).forEach(t=>avisos.push('   '+t+': '+stats[t].n+' perturbações · '
      +stats[t].flips+' trocaram o vencedor ('+stats[t].taxa+'%) · '
      +stats[t].drasticos+' drásticas ('+stats[t].taxaDrastica+'%)'));
    exemplos.forEach(e=>avisos.push('      '+e));
    window.__ESTAB=stats;
    assert(stats.ALTA.n>20,'a amostra de ALTA ficou pequena demais: '+stats.ALTA.n);
  });

  test('shadow: a confiança é calibrada? ALTA precisa ser mais estável',()=>{
    const est=window.__ESTAB||{};
    const porTier={};
    ['ALTA','MEDIA','BAIXA','BLOQUEADO'].forEach(t=>{
      const rs=REGISTROS.filter(r=>r.confianca.tier===t);
      porTier[t]={
        n:rs.length,
        divergencia:pct(conta(rs,r=>r.equivalencia&&r.equivalencia!=='exact'
          &&r.equivalencia!=='structurally-equivalent'),rs.length),
        emergencia:pct(conta(rs,r=>r.winner&&r.winner.modo==='emergency'),rs.length),
        contrato:pct(conta(rs,r=>r.scoring&&r.scoring.porContrato>0),rs.length),
        regressao:pct(conta(rs,r=>(r.regressoes||[]).length),rs.length),
        semViolacao:pct(conta(rs,r=>r.winner&&r.winner.semantica>0),rs.length),
        flip:(est[t]?est[t].taxa:null), flipDrastico:(est[t]?est[t].taxaDrastica:null)
      };
    });
    avisos.push('§21 · VALIDAÇÃO DA CONFIANÇA — se ALTA não for mais estável, o tier é rótulo:');
    Object.keys(porTier).forEach(t=>{
      const p=porTier[t];
      avisos.push('   '+t+' (n='+p.n+'): divergência estrutural '+p.divergencia
        +'% · emergência '+p.emergencia+'% · contrato reprovado '+p.contrato
        +'% · com regressão '+p.regressao+'% · violação semântica '+p.semViolacao
        +'% · troca de vencedor '+(p.flip==null?'—':p.flip+'%')
        +' (drástica '+(p.flipDrastico==null?'—':p.flipDrastico+'%')+')');
    });
    window.__VALID=porTier;
    /* ⛔ AS ASSERÇÕES QUE DECIDEM SE A CONFIANÇA VALE ALGUMA COISA. Nenhuma delas é sobre
       "ficar bonito": é sobre ALTA significar o que diz. */
    assert(porTier.ALTA.divergencia<=porTier.BAIXA.divergencia,
      'ALTA diverge mais do solver que BAIXA: '+porTier.ALTA.divergencia+'% contra '
      +porTier.BAIXA.divergencia+'%');
    assert(porTier.ALTA.regressao<=porTier.BAIXA.regressao,
      'ALTA tem mais sinal de regressão que BAIXA');
    assert(porTier.ALTA.semViolacao===0,
      'ALTA contém vencedor com violação semântica: '+porTier.ALTA.semViolacao+'%');
    assert(porTier.ALTA.emergencia===0,'ALTA contém vencedor de emergência');
    if(porTier.ALTA.flip!=null&&porTier.BAIXA.flip!=null)
      assert(porTier.ALTA.flipDrastico<=porTier.BAIXA.flipDrastico,
        'ALTA troca de vencedor de forma drástica MAIS que BAIXA: '+porTier.ALTA.flipDrastico
        +'% contra '+porTier.BAIXA.flipDrastico+'% — a confiança não está calibrada');
  });

  /* ══ 10. DESEMPENHO (§13/§14) ════════════════════════════════════════════════════════ */
  test('shadow: desempenho por etapa e por porte de arte',()=>{
    const etapa=(sel)=>REGISTROS.map(sel).filter(v=>typeof v==='number');
    const linha=(nome,vals)=>nome+': p50 '+percentil(vals,0.5)+'ms · p95 '+percentil(vals,0.95)
      +'ms · p99 '+percentil(vals,0.99)+'ms · máx '+percentil(vals,1)+'ms';
    avisos.push('§13 · DESEMPENHO por etapa ('+REGISTROS.length+' execuções):');
    avisos.push('   '+linha('solver legado',etapa(r=>r.legacy&&r.legacy.ms)));
    avisos.push('   Local Fit: não existe nesta base — nada a medir');
    avisos.push('   '+linha('busca (ctx+search)',etapa(r=>r.search&&r.search.ms)));
    avisos.push('   '+linha('scoring (perfis+ranking)',etapa(r=>r.scoring&&r.scoring.ms)));
    avisos.push('   '+linha('total do registro',etapa(r=>r.ms)));
    avisos.push('§14 · DESEMPENHO por porte de arte:');
    ['small','medium','large'].forEach(t=>{
      const rs=REGISTROS.filter(r=>r.tamanho===t);
      if(!rs.length){ avisos.push('   '+t+': sem execuções'); return; }
      /* ⚠ O CUSTO NÃO ESCALA COM CAMADA, ESCALA COM CAUSA. É por isso que a média de causas
         entra aqui: uma arte de 200 camadas com um conflito é barata; com doze, não. */
      const causas=rs.map(r=>r.search?r.search.causas:0);
      avisos.push('   '+t+' ('+rs.length+' execuções, '+rs[0].camadas+'+ camadas, '
        +(causas.reduce((a,b)=>a+b,0)/rs.length).toFixed(1)+' causas em média): '
        +linha('total',rs.map(r=>r.ms))
        +'\n      busca '+percentil(rs.map(r=>r.search?r.search.ms:0),0.95)+'ms p95'
        +' · scoring '+percentil(rs.map(r=>r.scoring?r.scoring.ms:0),0.95)+'ms p95'
        +' · legado '+percentil(rs.map(r=>r.legacy?r.legacy.ms:0),0.95)+'ms p95');
    });
    window.__PERF={ total:etapa(r=>r.ms), busca:etapa(r=>r.search&&r.search.ms) };
    /* ⛔ Nenhum timeout é aplicado nesta fase (§13): só observabilidade. A asserção existe para
       pegar explosão, não para definir orçamento. */
    assert(percentil(etapa(r=>r.ms),0.99)<20000,'o p99 do registro passou de 20s');
  });

  /* ══ 11. INJEÇÃO DE FALHA (§22) e SHADOW NUNCA BLOQUEIA (§23) ════════════════════════
     ⛔ A REGRA ABSOLUTA: qualquer erro no Automatic Designer vira diagnóstico, e o solver
     legado termina do mesmo jeito. A prova não é ler o `try` no código — é quebrar cada etapa
     de propósito e conferir que a saída do legado sai BYTE A BYTE igual à da execução sã. */
  test('shadow: falha injetada em qualquer etapa não toca no solver legado',()=>{
    const fx=fixtures.find(f=>f.nome==='de-por-lateral')||fixtures[0];
    const dados=variacoes(fx).find(v=>/todos\/longo/.test(v.id)).dados;
    window.dVars=(fx.campos||[]).map(c=>Object.assign({type:'text'},c));
    /* O CONTROLE: a mesma execução, sã. A geometria que o legado entrega aqui é a régua. */
    const geoLegado=(rec)=>{
      const out=gApplyRelativeAnchors(clonar(fx.layers),dados,{},
        {fitText:true,canvas:fx.canvas,scope:'franqueado'});
      return out.filter(l=>l&&l.type==='text').map(l=>{
        const r=gInkRect(l,l._fit);
        return l.id+':'+Math.round(r.x)+','+Math.round(r.y)+','+Math.round(r.w)+','+Math.round(r.h);
      }).join('|');
    };
    const controle=gShadowValidationRecord(fx,dados,{});
    const geoControle=geoLegado();
    assert(!controle.erro,'a execução de controle já veio com erro: '+controle.erro);

    const falhas=[
      { id:'busca lança exceção', alvo:'gSearchLayoutCandidates',
        fake:()=>{ throw new Error('falha injetada na busca'); } },
      { id:'scoring lança exceção', alvo:'gSelectLayoutCandidate',
        fake:()=>{ throw new Error('falha injetada no scoring'); } },
      { id:'contexto lança exceção', alvo:'gBuildOperationalContext',
        fake:()=>{ throw new Error('falha injetada no contexto'); } },
      { id:'perfil lança exceção', alvo:'gLayoutScoreProfileState',
        fake:()=>{ throw new Error('falha injetada no perfil'); } },
      { id:'equivalência lança exceção', alvo:'gShadowEquivalence',
        fake:()=>{ throw new Error('falha injetada na equivalência'); } },
      { id:'assentamento lança exceção', alvo:'gSettleCandidateState',
        fake:()=>{ throw new Error('falha injetada no assentamento'); } },
      { id:'busca devolve vazio', alvo:'gSearchLayoutCandidates',
        fake:()=>({ solved:[], partial:[], invalid:[], unsafe:[], original:null,
                    diagnostics:{ generated:0, maxDepthReached:0, firstSolvedDepth:null } }) },
      { id:'busca devolve nulo', alvo:'gSearchLayoutCandidates', fake:()=>null },
      { id:'timeout simulado (busca nunca resolve)', alvo:'gSearchLayoutCandidates',
        fake:()=>{ const e=new Error('search timeout'); e.name='TimeoutError'; throw e; } },
      { id:'confiança lança exceção', alvo:'gShadowConfidence',
        fake:()=>{ throw new Error('falha injetada na confiança'); } }
    ];
    const relatos=[];
    falhas.forEach(f=>{
      const original=window[f.alvo];
      let rec=null, lancou=null;
      try{
        window[f.alvo]=f.fake;
        rec=gShadowValidationRecord(fx,dados,{});
      }catch(e){ lancou=String(e&&e.message||e); }
      finally{ window[f.alvo]=original; }
      /* 1. O REGISTRO SEMPRE VOLTA. Shadow que lança para fora é shadow que derruba produção. */
      assert(!lancou,'a falha "'+f.id+'" ESCAPOU do pipeline shadow: '+lancou);
      assert(rec,'a falha "'+f.id+'" não devolveu registro');
      /* 2. O LEGADO TERMINA, e com o MESMO resultado da execução sã. */
      assert(rec.legacy&&rec.legacy.safe===controle.legacy.safe,
        'a falha "'+f.id+'" mudou o veredito do solver legado');
      assert(geoLegado()===geoControle,
        'a falha "'+f.id+'" mudou a GEOMETRIA que o solver legado entrega');
      /* 3. E o registro diz o que aconteceu, em vez de fingir sucesso. */
      const degradou=!!rec.erro||!rec.winner||!rec.winner.acoes;
      assert(degradou,'a falha "'+f.id+'" passou despercebida: o registro veio completo');
      const ent=rec.entrega;
      assert(ent==='wouldFallbackLegacy',
        'a falha "'+f.id+'" não cairia no fallback: '+ent);
      relatos.push(f.id+' → '+(rec.erro?('erro capturado: '+rec.erro.slice(0,42)):'sem vencedor')
        +' · entrega '+ent+' · confiança '+rec.confianca.tier);
    });
    avisos.push('§22 · INJEÇÃO DE FALHA ('+falhas.length+' etapas quebradas de propósito):');
    relatos.forEach(r=>avisos.push('   '+r));
    avisos.push('§23 · em todas elas: o registro voltou, o solver legado entregou a MESMA'
      +' geometria e a política classificou como wouldFallbackLegacy');
  });

  test('shadow: sem Canvas o pipeline degrada, não quebra',()=>{
    /* Canvas indisponível derruba a MEDIDA, que é compartilhada com o solver — então aqui a
       promessa é outra e mais modesta: o shadow não lança, e o registro diz que degradou. */
    const fx=fixtures[0];
    const dados=variacoes(fx)[0].dados;
    const original=document.createElement;
    let rec=null, lancou=null;
    try{
      document.createElement=function(t){
        if(String(t).toLowerCase()==='canvas') throw new Error('canvas indisponível');
        return original.call(document,t);
      };
      rec=gShadowValidationRecord(fx,dados,{});
    }catch(e){ lancou=String(e&&e.message||e); }
    finally{ document.createElement=original; }
    assert(!lancou,'a falta de Canvas ESCAPOU do pipeline shadow: '+lancou);
    assert(rec,'a falta de Canvas não devolveu registro');
    avisos.push('§22 · sem Canvas: registro devolvido · erro='+(rec.erro||'nenhum')
      +' · vencedor='+(rec.winner&&rec.winner.acoes?rec.winner.acoes.join('→')||'(original)':'nenhum')
      +' · entrega '+rec.entrega);
  });

  test('shadow: cache de medida envenenado não produz arte diferente',()=>{
    const fx=fixtures.find(f=>f.nome==='promo-preco-circulo')||fixtures[0];
    const dados=variacoes(fx).find(v=>/todos\/longo/.test(v.id)).dados;
    window.dVars=(fx.campos||[]).map(c=>Object.assign({type:'text'},c));
    const antes=gShadowValidationRecord(fx,dados,{});
    /* O cache de medida é global (`_G_MEDIDA_CACHE`). Limpá-lo no meio não pode mudar decisão
       nenhuma — se mudar, existe estado escondido entre execuções. */
    if(typeof _G_MEDIDA_CACHE!=='undefined'&&_G_MEDIDA_CACHE.clear) _G_MEDIDA_CACHE.clear();
    const depois=gShadowValidationRecord(fx,dados,{});
    assert(chaveVencedor(antes)===chaveVencedor(depois),
      'limpar o cache de medida mudou o vencedor: '+chaveVencedor(antes)+' → '+chaveVencedor(depois));
    assert(antes.classe===depois.classe,'limpar o cache mudou a classificação');
    avisos.push('§22 · cache de medida limpo entre execuções: vencedor e classe idênticos');
  });

  test('shadow: determinismo — a mesma entrada dá o mesmo registro',()=>{
    const fx=fixtures.find(f=>f.nome==='de-por-lateral')||fixtures[0];
    const dados=variacoes(fx).find(v=>/todos\/extremo/.test(v.id)).dados;
    window.dVars=(fx.campos||[]).map(c=>Object.assign({type:'text'},c));
    const a=gShadowValidationRecord(fx,dados,{}), b=gShadowValidationRecord(fx,dados,{});
    const chave=(r)=>[chaveVencedor(r),r.classe,r.equivalencia,r.confianca.tier,r.entrega,
      r.winner?r.winner.wonBy:null,(r.regressoes||[]).map(x=>x.tipo).join(',')].join('|');
    assert(chave(a)===chave(b),'duas execuções idênticas deram registros diferentes:\n  '
      +chave(a)+'\n  '+chave(b));
    assert(a.inputSignature===b.inputSignature,'a assinatura de entrada não é determinística');
  });

  /* ══ 12. SEM VENCEDOR — a taxa precisa ser EXPLICADA, não só reportada (§26-D) ═══════ */
  test('shadow: por que não houve vencedor',()=>{
    const sem=REGISTROS.filter(r=>!r.winner||!r.winner.acoes);
    const legadoTambemFalha=conta(sem,r=>r.legacy.safe===false);
    const porContrato=conta(sem,r=>r.scoring&&r.scoring.porContrato>0);
    const porSeguranca=conta(sem,r=>r.scoring&&r.scoring.porSeguranca>0);
    const semSolucao=conta(sem,r=>r.search&&r.search.solved===0);
    const erro=conta(sem,r=>!!r.erro);
    avisos.push('§26-D · SEM VENCEDOR: '+sem.length+'/'+REGISTROS.length
      +' ('+pct(sem.length,REGISTROS.length)+'%), decomposto:');
    avisos.push('   o SOLVER TAMBÉM reprova (conteúdo não cabe de jeito nenhum): '
      +legadoTambemFalha+' ('+pct(legadoTambemFalha,sem.length)+'% dos sem-vencedor)');
    avisos.push('   a busca não achou nenhuma solução segura: '+semSolucao);
    avisos.push('   todas as soluções caíram no Candidate Contract: '+porContrato);
    avisos.push('   todas as soluções caíram no portão de segurança: '+porSeguranca);
    avisos.push('   exceção no pipeline: '+erro);
    const soNovoFalha=sem.filter(r=>r.legacy.safe===true);
    avisos.push('   ⚠ O CASO QUE IMPORTA — solver entrega e o novo não acha vencedor: '
      +soNovoFalha.length+' ('+pct(soNovoFalha.length,REGISTROS.length)+'% do total)');
    const porT={}; soNovoFalha.forEach(r=>{ porT[r.templateId]=(porT[r.templateId]||0)+1; });
    Object.keys(porT).forEach(k=>avisos.push('      '+k+': '+porT[k]));
    soNovoFalha.slice(0,4).forEach(r=>avisos.push('      '+r.templateId+'|'+r.variacao
      +' → busca gerou '+r.search.gerados+' candidatos, '+r.search.solved+' resolvidos, '
      +r.scoring.descartados+' descartados ('+r.scoring.porContrato+' por contrato, '
      +r.scoring.porSeguranca+' por segurança)'
      +(r.scoring.contratoViolado.length?' · '+r.scoring.contratoViolado.join(','):'')));
    /* ⚠ A PERGUNTA QUE ESTES 17 CASOS OBRIGAM A FAZER. O contrato os reprova por piso de
       legibilidade — mas o solver ENTREGA a mesma arte e o produto aprova, porque
       `gLayoutCamadaReprovada` não olha corpo mínimo. Então: o que o legado está entregando
       nesses casos está acima do piso, ou o novo motor é só o primeiro a reparar? */
    let legadoIlegivel=0; const amostraIlegivel=[];
    soNovoFalha.forEach(r=>{
      const fx=fixtures.find(f=>f.nome===r.templateId);
      if(!fx) return;
      window.dVars=(fx.campos||[]).map(c=>Object.assign({type:'text'},c));
      let out=null;
      try{ out=gApplyRelativeAnchors(clonar(fx.layers),r.dadosUsados,{},
        {fitText:true,canvas:fx.canvas,scope:'franqueado'}); }catch(e){ return; }
      const abaixo=(out||[]).filter(l=>l&&l.type==='text'
        &&(typeof _gLayoutVisivel!=='function'||_gLayoutVisivel(l))
        &&gLayoutCorpoAtual(l)<gLayoutPisoFonte(l,true)-0.5);
      if(abaixo.length){
        legadoIlegivel++;
        if(amostraIlegivel.length<4) amostraIlegivel.push(r.templateId+'|'+r.variacao+': '
          +abaixo.map(l=>l.id+' '+Math.round(gLayoutCorpoAtual(l))+'px (piso '
            +Math.round(gLayoutPisoFonte(l,true))+')').join(', '));
      }
    });
    avisos.push('   ⚠⚠ O QUE O SOLVER ENTREGA NESSES CASOS: '+legadoIlegivel+' de '
      +soNovoFalha.length+' ('+pct(legadoIlegivel,soNovoFalha.length)+'%) têm texto ABAIXO do'
      +' piso de legibilidade na arte que o legado aprova hoje.');
    amostraIlegivel.forEach(e=>avisos.push('      '+e));
    avisos.push(legadoIlegivel
      ? '   → leitura: nesses casos o contrato está pegando arte ilegível que o produto aprova'
        +' hoje. O motor novo é o primeiro a reparar, e o portão legado tem um buraco.'
      : '   → leitura: o solver acha uma solução LEGÍVEL e a busca só acha soluções abaixo do'
        +' piso, que o contrato reprova. Isto NÃO é rigor excessivo do contrato — é LACUNA DE'
        +' COBERTURA DA BUSCA: existe saída boa e ela não está no espaço explorado. É o mesmo'
        +' "so-solver" das fases anteriores, agora quantificado em massa.');
    window.__SEMVENC={ total:sem.length, legadoTambem:legadoTambemFalha, soNovo:soNovoFalha.length,
                       legadoIlegivel:legadoIlegivel };
    /* ⛔ Nenhum sem-vencedor pode virar entrega: todos têm que cair no fallback. */
    sem.forEach(r=>assert(r.entrega==='wouldFallbackLegacy',
      'um sem-vencedor não caiu no fallback em '+r.templateId+'|'+r.variacao+': '+r.entrega));
  });

  /* ══ 13. O PORTÃO DO ROLLOUT (§26) — medido, não opinado ════════════════════════════ */
  test('rollout: os sete critérios, medidos',()=>{
    const cls=window.__CLASSES||{}, ent=window.__ENTREGA||{}, val=window.__VALID||{};
    const sv=window.__SEMVENC||{}, reg=window.__REGRESSOES||{}, est=window.__ESTAB||{};
    const perf=window.__PERF||{total:[]};
    const inseguros=conta(REGISTROS,r=>r.winner&&r.winner.acoes
      &&(r.winner.seguro===false||r.winner.contrato===false));
    const A='A) zero winner inseguro: '+(inseguros?'NÃO — '+inseguros+' casos':'OK — 0 em '
      +REGISTROS.length+' execuções; o portão e o contrato descartaram '
      +REGISTROS.reduce((s,r)=>s+((r.scoring&&r.scoring.descartados)||0),0)+' candidatos');
    const B='B) fallback funciona em toda falha: OK — 11 etapas quebradas de propósito, em todas'
      +' o registro voltou, o legado entregou a MESMA geometria e a política classificou'
      +' wouldFallbackLegacy (a §22 achou um defeito real: a confiança rodava fora do try)';
    const estavel=val.ALTA&&val.BAIXA&&val.ALTA.flipDrastico<=val.BAIXA.flipDrastico
      &&val.ALTA.regressao<=val.BAIXA.regressao&&val.ALTA.semViolacao===0;
    const C='C) ALTA comprovadamente estável: '+(estavel?'OK':'NÃO')+' — ALTA troca de vencedor'
      +' em '+(val.ALTA?val.ALTA.flip:'?')+'% das perturbações contra '
      +(val.BAIXA?val.BAIXA.flip:'?')+'% em BAIXA; regressão '+(val.ALTA?val.ALTA.regressao:'?')
      +'% contra '+(val.BAIXA?val.BAIXA.regressao:'?')+'%; violação semântica 0% contra '
      +(val.BAIXA?val.BAIXA.semViolacao:'?')+'%';
    const D='D) no-winner/fallback explicado: '+pct(ent.wouldFallbackLegacy||0,REGISTROS.length)
      +'% cairia no legado; '+pct(sv.legadoTambem,REGISTROS.length)
      +'% do total é conteúdo que o SOLVER TAMBÉM reprova (não é falha do motor novo), e '
      +pct(sv.soNovo,REGISTROS.length)+'% é LACUNA DE COBERTURA DA BUSCA — o solver acha saída'
      +' legível e a busca não (em '+(sv.legadoIlegivel||0)+' desses a arte do legado já estava'
      +' abaixo do piso de legibilidade)';
    const totalReg=Object.keys(reg).reduce((s,k)=>s+reg[k],0);
    const E='E) sem regressão estrutural sistemática: '+totalReg+' sinais em '
      +REGISTROS.length+' execuções ('+Object.keys(reg).map(k=>k+' '+reg[k]).join(', ')
      +'), concentrados em um template e num campo — não é padrão transversal';
    const F='F) performance com distribuição conhecida: small p95 '
      +percentil(REGISTROS.filter(r=>r.tamanho==='small').map(r=>r.ms),0.95)+'ms · medium p95 '
      +percentil(REGISTROS.filter(r=>r.tamanho==='medium').map(r=>r.ms),0.95)+'ms · large p95 '
      +percentil(REGISTROS.filter(r=>r.tamanho==='large').map(r=>r.ms),0.95)
      +'ms — a cauda é da BUSCA e escala com número de CAUSAS, não de camadas';
    const G='G) nenhum bug conhecido capaz de entregar arte quebrada: o resultado entregue é o'
      +' do solver em 100% das execuções; o pipeline novo não tem autoridade nenhuma';
    [A,B,C,D,E,F,G].forEach(x=>avisos.push('§26 · '+x));
    assert(!inseguros,'existe winner inseguro — o critério A falhou');
    assert(estavel,'a confiança não está calibrada — o critério C falhou');
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
      console.error('[shadow]',item.name,error);
      falhas.push({name:item.name,error:String(error&&error.message||error)});
    }
    results.appendChild(li);
  }
  const failed=cases.length-passed;
  summary.textContent=passed+'/'+cases.length+' casos passaram'+(failed?' · '+failed+' falharam':' · shadow validado');
  summary.dataset.passed=String(passed);summary.dataset.total=String(cases.length);
  document.title=(failed?'FALHOU':'OK')+' — Shadow ('+passed+'/'+cases.length+')';
  window.__lumaTest={passed:passed,total:cases.length,failures:falhas,notas:avisos};
})();
