/* ══════════════════════════════════════════════════════════════════════════════════════════
   TESTE DE CARGA — volume realista nos dois motores que o usuário espera terminar
   ------------------------------------------------------------------------------------------
   As outras suítes provam que o resultado está CERTO. Esta prova que ele chega A TEMPO com o
   volume que existe na vida real — e ela reprova o CI quando não chega.

   POR QUE NÃO HÁ "TESTE DE CARGA" NO SENTIDO DE SERVIDOR: o Luma não tem backend próprio. O
   Supabase é de terceiros e está fora do alcance desta base por decisão explícita; disparar
   carga contra ele seria carregar produção alheia, não testar o Luma. O que escala mal AQUI
   roda no navegador de quem usa, e é isso que se mede.

   OS DOIS ALVOS, e por que são estes:

   · LOTE DO FRANQUEADO (Sheets) — uma planilha com 50 ofertas vira 50 artes, uma a uma, no
     celular de quem está no balcão. É o caminho mais pesado do produto e o único sem nenhuma
     cobertura. Mede `fRenderTemplateLayers`, o interpolador e o Auto-layout juntos, que é
     como eles realmente rodam.

   · IMPORTADOR DE PSD EM VOLUME — o PSD de campanha real tem centenas de camadas. Mede a
     cadeia inteira DEPOIS do decode: item → camada canônica → Smart Mapping → resultado de
     fidelidade → reflow de formato. O decode em si (`ag-psd`) fica de fora porque exige um
     arquivo binário de verdade; tudo o que vem depois é nosso e é onde o custo cresce com o
     número de camadas.

   ⛔ O ORÇAMENTO É POR ARTE/CAMADA, NÃO PELO TOTAL. Um teto no total ficaria vermelho no dia
   em que alguém aumentasse o volume do teste, escondendo que o custo unitário melhorou. O que
   interessa é quanto custa UMA arte — o total é consequência.

   ⛔ OS TETOS TÊM FOLGA DE PROPÓSITO (≈10× a medição em máquina de desenvolvimento). Um teto
   apertado transforma variação de runner em falso vermelho, e um portão que dá falso vermelho
   é desligado pela equipe na terceira vez. Ele existe para pegar REGRESSÃO DE ORDEM DE
   GRANDEZA — o laço aninhado que alguém introduziu sem perceber —, não para cravar
   milissegundo.

   O QUE ESTES CASOS NÃO PEGAM, e vale saber antes de confiar demais neles:

   · Um laço aninhado BARATO. Ao validar o caso de degradação, um O(n²) de `indexOf` sobre
     400 camadas (160 mil pares) passou verde — custa ~1ms contra os ~64ms do trabalho real.
     A régua só acusa quando o custo por par se aproxima do custo por camada, que é quando o
     usuário sente. Um O(n²) trivial continua invisível aqui, e por ora tudo bem: ele também é
     invisível na mão de quem usa.
   · Memória. Estes casos medem TEMPO. Um vazamento que só derruba a aba na arte 200 do lote
     não aparece — o caso "não vaza estado entre uma arte e a próxima" cobre a contaminação de
     ESTADO, que é coisa diferente.
   · O decode do PSD. Exige arquivo binário de verdade; só o que vem depois dele é medido.

   Para medir no celular fraco: `LUMA_CPU_THROTTLE=4 node scripts/run-browser-tests.js carga`.
   O CI roda sem freio de propósito: ligá-lo mudaria a régua de todas as outras suítes junto.
   ══════════════════════════════════════════════════════════════════════════════════════════ */
(async function(){
  const results=document.getElementById('results');
  const summary=document.getElementById('summary');
  const cases=[]; const notas=[];
  const test=(name,fn)=>cases.push({name,fn});
  const assert=(c,m)=>{ if(!c) throw new Error(m||'asserção falhou'); };

  // Mediana e p95 de uma lista de tempos. Média mentiria: um pico de coleta de lixo no meio do
  // lote levanta a média inteira e some dentro dela; a mediana mostra o custo típico e o p95
  // mostra o pior caso que o usuário realmente encontra.
  const perc=(xs,p)=>{ const s=xs.slice().sort((a,b)=>a-b); return s[Math.min(s.length-1,Math.floor(s.length*p))]; };
  const ms=n=>Math.round(n*10)/10;
  function orcamento(rotulo, tempos, tetoP95){
    const p50=perc(tempos,.5), p95=perc(tempos,.95), pior=Math.max(...tempos);
    notas.push(rotulo+': n='+tempos.length+' p50='+ms(p50)+'ms p95='+ms(p95)+'ms pior='+ms(pior)+'ms (teto p95 '+tetoP95+'ms)');
    assert(p95<=tetoP95, rotulo+' estourou o orçamento: p95 '+ms(p95)+'ms > '+tetoP95+'ms '
      +'(p50 '+ms(p50)+'ms, pior '+ms(pior)+'ms em '+tempos.length+' execuções). '
      +'Teto com ~10× de folga: p95 acima dele é regressão de ordem de grandeza, não ruído.');
    return {p50,p95,pior};
  }

  /* ── O material de teste: uma peça de oferta como as que existem ────────────────────── */
  const CAMPOS=[
    {name:'produto',label:'Produto',type:'text'},
    {name:'precoDe',label:'Preço original',type:'currency'},
    {name:'precoPor',label:'Preço promocional',type:'currency'},
    {name:'validade',label:'Validade',type:'date'},
    {name:'descricao',label:'Descrição',type:'text'}
  ];
  // 26 camadas: a contagem de uma peça de oferta real (fundo, selo, headline, par de preços,
  // descrição, regulamento e os grafismos em volta).
  function templateOferta(W,H){
    const L=[{id:'bg',type:'shape',name:'Fundo',x:0,y:0,w:W,h:H,fill:'#FF9000',visible:true,opacity:100}];
    L.push({id:'t1',type:'text',name:'Headline',content:'{{produto}}',isVar:true,x:60,y:120,w:W-120,h:160,
      fontSize:Math.round(W*.085),color:'#FFFFFF',textAlign:'left',font:'Roboto',lineHeight:1.1,visible:true,opacity:100});
    L.push({id:'t2',type:'text',name:'De',content:'de {{precoDe}}',x:60,y:H-460,w:320,h:60,
      fontSize:Math.round(W*.03),color:'#FFE0BD',textAlign:'left',font:'Roboto',strikethrough:true,visible:true,opacity:100});
    L.push({id:'t3',type:'text',name:'Por',content:'{{precoPor}}',isVar:true,x:60,y:H-400,w:520,h:130,
      fontSize:Math.round(W*.075),color:'#FFFFFF',textAlign:'left',font:'Roboto',visible:true,opacity:100});
    L.push({id:'t4',type:'text',name:'Descrição',content:'{{descricao}}',x:60,y:H-250,w:W-120,h:100,
      fontSize:Math.round(W*.022),color:'#FFFFFF',textAlign:'left',font:'Roboto',lineHeight:1.35,textBox:'box',visible:true,opacity:100});
    L.push({id:'t5',type:'text',name:'Validade',content:'Válido até {{validade}}',x:60,y:H-110,w:W-120,h:40,
      fontSize:Math.round(W*.016),color:'#FFE0BD',textAlign:'left',font:'Roboto',visible:true,opacity:100});
    // Grafismos: shapes com raio, sombra e traçado — o caminho caro do motor Canvas.
    for(let i=0;i<20;i++){
      L.push({id:'g'+i,type:'shape',name:'Grafismo '+i,x:40+(i*37)%(W-140),y:300+(i*53)%(H-700),
        w:90+(i%5)*20,h:60+(i%3)*18,fill:i%2?'#FFFFFF':'#F85400',radius:i%4?14:999,
        shadow:i%3===0,shadowColor:'rgba(0,0,0,.28)',shadowBlur:18,shadowDist:6,
        strokeW:i%5===0?3:0,strokeColor:'#FFFFFF',visible:true,opacity:i%7===0?55:100});
    }
    return L;
  }
  const OFERTAS=['Combo Família','Pizza Calabresa Grande','Burger Duplo com Fritas','Açaí 500ml com 3 acompanhamentos',
    'Esfiha de Carne (10 un.)','Marmita Executiva','Sushi Combo 20 peças','Bolo no Pote','Pastel de Feira','Coxinha Gigante'];
  const dadosDa=i=>({produto:OFERTAS[i%OFERTAS.length], precoDe:'R$ '+(39+i%20)+',90',
    precoPor:'R$ '+(19+i%15)+',90', validade:'3'+(i%2)+'/09',
    descricao:'Peça pelo aplicativo e receba em casa. Promoção válida para a loja participante mais próxima de você.'});

  /* ══ ALVO 1 — o lote do franqueado ═══════════════════════════════════════════════════ */

  test('lote de 50 artes: cada arte cabe no orçamento',async()=>{
    const W=1080,H=1350, N=50;
    const layers=templateOferta(W,H);
    const camp={color:'#FF9000',name:'Setembro'};
    const material={layers,w:W,h:H,fmt:'feed'};
    // Canvas ÚNICO, reaproveitado: é assim que o lote real desenha, e criar 50 canvases de
    // 1080×1350 mediria alocação de memória em vez do motor.
    const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
    const ctx=cv.getContext('2d');
    const tempos=[];
    for(let i=0;i<N;i++){
      ctx.clearRect(0,0,W,H);
      const t0=performance.now();
      await fRenderTemplateLayers(ctx,layers,W,H,dadosDa(i),camp,material,{scope:'franqueado'});
      tempos.push(performance.now()-t0);
    }
    // Descarta a primeira: ela paga o carregamento de fonte (`document.fonts.ready`) que as
    // outras 49 encontram pronto. Medi-la junto seria medir o boot, não o lote.
    orcamento('lote do franqueado (1080×1350, 26 camadas)', tempos.slice(1), 40);
  });

  test('lote com troca de formato paga o reflow sem estourar',async()=>{
    // O caso que dói de verdade: o template foi desenhado em Feed e o franqueado pede Story,
    // então CADA arte passa pelo `gReflowLayers` antes de desenhar.
    const layers=templateOferta(1080,1350);
    const material={layers,w:1080,h:1350,fmt:'feed'};
    const camp={color:'#FF9000',name:'Setembro'};
    const cv=document.createElement('canvas'); cv.width=1080; cv.height=1920;
    const ctx=cv.getContext('2d');
    const tempos=[];
    for(let i=0;i<25;i++){
      ctx.clearRect(0,0,1080,1920);
      const t0=performance.now();
      await fRenderTemplateLayers(ctx,layers,1080,1920,dadosDa(i),camp,material,{scope:'franqueado'});
      tempos.push(performance.now()-t0);
    }
    orcamento('lote com reflow Feed→Story', tempos.slice(1), 60);
  });

  test('o lote não vaza estado entre uma arte e a próxima',async()=>{
    /* Carga não é só tempo. O motor recebe `dados` diferentes a cada volta e, se algo ficar
       pendurado (uma camada mutada no lugar, um baseline carimbado uma vez só), a arte 50 sai
       diferente da arte 1 com os MESMOS dados — o bug que só aparece em lote e que ninguém
       reproduz clicando uma vez. */
    const W=1080,H=1350;
    const layers=templateOferta(W,H);
    const antes=JSON.stringify(layers);
    const camp={color:'#FF9000',name:'Setembro'};
    const material={layers,w:W,h:H,fmt:'feed'};
    const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
    const ctx=cv.getContext('2d');
    const assinatura=async(d)=>{
      ctx.clearRect(0,0,W,H);
      await fRenderTemplateLayers(ctx,layers,W,H,d,camp,material,{scope:'franqueado'});
      return cv.toDataURL('image/png').length;
    };
    const primeira=await assinatura(dadosDa(0));
    for(let i=1;i<30;i++) await assinatura(dadosDa(i));
    const repetida=await assinatura(dadosDa(0));
    assert(primeira===repetida,
      'a mesma oferta saiu diferente depois de 29 artes no lote ('+primeira+' × '+repetida+' bytes) '
      +'— algo ficou pendurado no estado entre uma arte e a próxima');
    assert(JSON.stringify(layers)===antes,
      'o lote MUTOU as camadas do template: a arte seguinte parte de um material alterado');
  });

  /* ══ ALVO 2 — o importador de PSD em volume ══════════════════════════════════════════ */

  // 300 itens como o parse os entrega: texto, forma e imagem misturados, com nomes de PSD real.
  function itensPsd(n){
    /* As seis primeiras são a OFERTA de verdade — é nelas que o Smart Mapping tem trabalho
       (par de preços, validade, headline). O resto é o volume de grafismo e texto solto que
       um PSD de campanha carrega. Sem esse núcleo, a medição pegaria só o caminho frio: 300
       camadas onde não há nada a reconhecer não exercitam o auto-apply. */
    const out=[
      {n:1,name:'@produto',kind:'text',mode:'text',content:'COMBO FAMÍLIA',x:60,y:80,w:600,h:120,fontSize:88},
      {n:2,name:'Copy de',kind:'text',mode:'text',content:'DE R$ 49,90',x:60,y:400,w:220,h:40,fontSize:32},
      {n:3,name:'Copy por',kind:'text',mode:'text',content:'POR R$ 29,90',x:60,y:450,w:320,h:70,fontSize:64},
      {n:4,name:'Validade',kind:'text',mode:'text',content:'VÁLIDO ATÉ 30/09',x:60,y:1250,w:400,h:30,fontSize:18},
      {n:5,name:'Objeto Inteligente 1',kind:'raster',mode:'raster',x:500,y:500,w:480,h:480,imgUrl:''},
      {n:6,name:'Regulamento',kind:'text',mode:'text',content:'Consulte o regulamento na loja.',x:60,y:1300,w:500,h:24,fontSize:11}
    ].map(o=>Object.assign({visible:true,opacity:100,include:true,font:'Roboto',color:'#FFFFFF',textAlign:'left'},o));
    const nomes=['Camada','Copy','Shape','Retângulo','Objeto Inteligente','Grupo'];
    for(let i=out.length+1;i<=n;i++){
      const k=i%7;
      const base={n:i,name:nomes[i%nomes.length]+' '+i,x:(i*29)%960,y:(i*71)%1240,w:80+(i%9)*40,h:40+(i%6)*30,
        visible:true,opacity:i%11===0?60:100,include:true};
      if(k<3) out.push(Object.assign(base,{kind:'text',mode:'text',fontSize:14+(i%8)*9,font:'Roboto',
        color:'#FFFFFF',textAlign:'left',
        content:(k===0?'R$ '+(19+i%40)+',90':(k===1?'OFERTA '+i:'Válido até 3'+(i%2)+'/09'))}));
      else if(k<5) out.push(Object.assign(base,{kind:'shape',mode:'shape',fill:'#FF9000',radius:i%3?12:0}));
      else out.push(Object.assign(base,{kind:'raster',mode:'raster',imgUrl:''}));
      /* Uma em cada nove carrega PERDA de verdade (cetim, traço aproximado, fonte ausente,
         mesclagem sem render). Sem isso `dPsdImportResult` percorreria 300 livros-caixa
         vazios e mediria o laço, não o trabalho — e a revisão por exceção, que é o consumidor
         real, nunca entraria na conta. */
      const it=out[out.length-1];
      if(i%9===0){ it.fxSatin=true; it.strokeApprox=true; }
      if(i%9===4 && it.kind==='text'){ it.fontName='Gotham Black'; }
      if(i%9===7){ it.groupBlendApprox=true; }
    }
    return out;
  }

  test('PSD de 300 camadas: a cadeia pós-decode cabe no orçamento por camada',async()=>{
    const N=300, meta={w:1080,h:1350,name:'campanha',res:72};
    const itens=itensPsd(N);
    const t0=performance.now();
    itens.forEach(it=>_dPsdCapItem(it));           // capacidade: o livro-caixa por camada
    const tCap=performance.now()-t0;
    const t1=performance.now();
    const smart=dPsdSmartMap(itens,meta);          // significado: a passada relacional
    const tSmart=performance.now()-t1;
    const t2=performance.now();
    const camadas=dPsdItemsToLayers(itens,false,{w:meta.w,h:meta.h});   // conversão canônica
    const tConv=performance.now()-t2;
    const t3=performance.now();
    const res=dPsdImportResult([{nome:'campanha',items:itens}],{nome:'campanha'});  // fidelidade
    const tRes=performance.now()-t3;

    notas.push('PSD '+N+' camadas: capacidade '+ms(tCap)+'ms · smart mapping '+ms(tSmart)
      +'ms · conversão '+ms(tConv)+'ms · resultado '+ms(tRes)+'ms'
      +' → '+smart.aplicados+' campos automáticos, '+res.atencoes.length+' decisões registradas');
    assert(camadas.length>=N,'a conversão perdeu camadas: '+camadas.length+' de '+N);

    // Orçamento POR CAMADA: é o que não pode crescer. O total é consequência do volume.
    const porCamada=(tCap+tSmart+tConv+tRes)/N;
    notas.push('PSD: '+ms(porCamada)+'ms por camada (teto 4ms)');
    assert(porCamada<=4,'a cadeia do importador custa '+ms(porCamada)+'ms por camada (teto 4ms). '
      +'Com 300 camadas isso é '+ms(porCamada*N)+'ms de espera depois do decode.');
  });

  test('o Smart Mapping não degrada com o número de camadas',async()=>{
    /* A passada relacional compara camadas ENTRE SI. É exatamente o desenho onde um laço
       aninhado passa despercebido: com 20 camadas ninguém nota, com 400 a revisão trava.
       Este caso mede 50 e 400 e exige que o custo POR CAMADA não exploda — o sinal de que
       alguém transformou a análise em O(n²) sem querer. */
    const medir=(n)=>{
      const itens=itensPsd(n);
      itens.forEach(it=>_dPsdCapItem(it));
      const t0=performance.now();
      dPsdSmartMap(itens,{w:1080,h:1350,name:'x',res:72});
      return (performance.now()-t0)/n;
    };
    medir(40);                                    // aquece: a primeira passada paga JIT
    const pequeno=medir(50), grande=medir(400);
    const fator=grande/Math.max(pequeno,0.001);
    const mil=n=>Math.round(n*1000)/1000;   // µs importam aqui: o custo é por camada
    notas.push('Smart Mapping: '+mil(pequeno)+'ms/camada em 50 · '
      +mil(grande)+'ms/camada em 400 · fator '+ms(fator)+'×');
    assert(fator<=4,'o custo por camada subiu '+ms(fator)+'× ao ir de 50 para 400 camadas '
      +'(limite 4×). Isso é assinatura de laço aninhado: a análise virou O(n²).');
  });

  test('reflow de 300 camadas entre formatos cabe no orçamento',async()=>{
    // Todo PSD importado num preset paga isto uma vez — e a arte inteira passa por ele.
    const itens=itensPsd(300);
    itens.forEach(it=>_dPsdCapItem(it));
    const camadas=dPsdItemsToLayers(itens,false,{w:1080,h:1350});
    const tempos=[]; let saida=null;
    for(let i=0;i<10;i++){
      const clone=JSON.parse(JSON.stringify(camadas));
      const t0=performance.now();
      // ⚠ `gReflowLayers(layers, {w,h}, {w,h}, opts)` DEVOLVE a lista nova; não muta a de
      // entrada. A primeira versão deste caso passou 5 números soltos, media um no-op e
      // passava verde em 0ms — teste de carga que não carrega nada é pior que nenhum.
      saida=gReflowLayers(clone,{w:1080,h:1350},{w:1080,h:1920},{fmtKey:'story'});
      tempos.push(performance.now()-t0);
    }
    assert(saida && saida.length===camadas.length,'o reflow não devolveu as camadas');
    const mexeu=saida.some((l,i)=>l.y!==camadas[i].y||l.h!==camadas[i].h||l.fontSize!==camadas[i].fontSize);
    assert(mexeu,'o reflow devolveu a arte IDÊNTICA ao ir de 1080×1350 para 1080×1920 — '
      +'ou a chamada está errada, ou o motor parou de re-ancorar');
    orcamento('reflow de 300 camadas (Feed→Story)', tempos.slice(1), 60);
  });

  let passed=0; const falhas=[];
  for(const item of cases){
    const li=document.createElement('li'); li.className='case';
    try{
      await item.fn(); passed++; li.classList.add('pass');
      li.innerHTML='<strong>✓ '+item.name+'</strong>';
    }catch(error){
      li.classList.add('fail');
      li.innerHTML='<strong>✕ '+item.name+'</strong><small>'+String(error&&error.message||error)+'</small>';
      console.error('[carga]',item.name,error);
      falhas.push({name:item.name,error:String(error&&error.message||error)});
    }
    results.appendChild(li);
  }
  const failed=cases.length-passed;
  summary.textContent=passed+'/'+cases.length+' cenários passaram'+(failed?' · '+failed+' falharam':' · dentro do orçamento');
  document.title=(failed?'FALHOU':'OK')+' — carga ('+passed+'/'+cases.length+')';
  window.__lumaTest={passed:passed,total:cases.length,failures:falhas,notas:notas};
})();
