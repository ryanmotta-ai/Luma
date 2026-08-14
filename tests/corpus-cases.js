/* ══════════════════════════════════════════════════════════════════════════════════════════
   CORPUS REPRODUZÍVEL DO AUTO-LAYOUT — abra `tests/corpus.html` ou rode
   `node scripts/run-browser-tests.js corpus`.

   O que ele é: cada fixture de `tests/corpus/` é uma prancheta real sanitizada (geometria e
   tipografia dos PSDs da Deskfy, sem dado de cliente e sem imagem embutida). Cada uma roda em
   3 cenários (nominal, longo, extremo) pelo MESMO motor da prévia e da exportação.

   O que ele cobra — dois níveis, de propósito:

   1. INVARIANTES (o portão de verdade). Não dependem da pilha de fontes da máquina, então valem
      igual no seu Chrome, no meu e no runner do GitHub:
        · o solver devolve a mesma quantidade de camadas;
        · rodar duas vezes dá geometria IDÊNTICA (sem isso, prévia e PNG podem divergir);
        · a hierarquia tipográfica não inverte (título nunca fica menor que o preço);
        · a tinta não escapa da prancheta além do que o desenho já escapava;
        · o veredito (`original`/`adapted`/`unsafe`) é o esperado;
        · quando bloqueia, o diagnóstico diz QUAL campo e QUANTOS caracteres cabem;
        · o tempo de solve entra no orçamento de desempenho (p50/p95 no fim).

   2. GOLDEN (geometria + imagem). Comparação fina, e por isso ancorada na PILHA DE FONTES: o
      golden é gravado por "impressão digital" de fonte (`fp`). Se a máquina atual não tiver
      golden gravado, a comparação é PULADA com aviso — nunca vira falso vermelho. Regravar:
      abra `tests/corpus.html?record=1` e cole o JSON impresso em `tests/corpus-golden.js`.
      ⚠ Isto é deliberado: reprovar por 2px de diferença entre rasterizadores treina o time a
      ignorar o vermelho, que é pior do que não ter o teste.

   Como crescer o corpus (o item "aprendizado pelo corpus" do roadmap): todo PSD que der
   problema vira um arquivo em `tests/corpus/`, com um `<script>` em `corpus.html`. A partir daí
   ele nunca mais pode regredir em silêncio.
   ══════════════════════════════════════════════════════════════════════════════════════════ */
(async function(){
  const results=document.getElementById('results');
  const summary=document.getElementById('summary');
  const cases=[]; const falhas=[]; const avisos=[];
  const test=(name,fn)=>cases.push({name,fn});
  const assert=(c,m)=>{if(!c)throw new Error(m||'asserção falhou');};
  const gravando=/[?&]record=1/.test(location.search);
  const gravado={};

  const fixtures=(window.LUMA_CORPUS||[]);
  const goldens=(window.LUMA_CORPUS_GOLDEN||{});

  /* Impressão digital da pilha de fontes desta máquina. Duas máquinas com a mesma fingerprint
     medem texto igual — é o que autoriza comparar geometria ao pixel. */
  const fpMaquina=(()=>{
    try{
      const c=document.createElement('canvas').getContext('2d');
      const medir=(f)=>{c.font='700 100px '+f;c.letterSpacing='0px';
        return Math.round(c.measureText('Wg08 Preço Mn R$ 1.249,00').width*10)/10;};
      return [medir('Arial'),medir('sans-serif'),medir('serif')].join('/');
    }catch(e){ return 'desconhecida'; }
  })();

  // `dVars` não existe nesta página (mora no `templates.js` do Estúdio). O corpus publica o
  // catálogo do fixture para exercitar exatamente o caminho da migração de baseline.
  const usarCampos=(campos)=>{ window.dVars=(campos||[]).map(c=>Object.assign({type:'text'},c)); };

  const clonar=(ls)=>ls.map(l=>JSON.parse(JSON.stringify(l)));
  const solve=(fx,dados,opts)=>gApplyRelativeAnchors(clonar(fx.layers),dados,{},
    Object.assign({fitText:true,canvas:fx.canvas,scope:'franqueado'},opts||{}));
  const geo=(out)=>out.filter(l=>l&&l.type==='text').map(l=>{
    const r=gInkRect(l,l._fit);
    return [l.id,Math.round(r.x),Math.round(r.y),Math.round(r.w),Math.round(r.h),
            Math.round((l._tetoFonte!=null?l._tetoFonte:l.fontSize)||0)];
  });

  /* Assinatura VISUAL: a arte renderizada pelo motor único, reduzida a 8×8 tons de cinza e
     comparada por diferença de vizinhos (dHash). Sobrevive a antialiasing e a meio pixel de
     diferença de fonte; NÃO sobrevive a uma camada sumindo, à arte mudando de composição ou a
     um bloco viajando pela prancheta — que é exatamente o que queremos pegar. */
  async function assinatura(fx,dados){
    const cv=document.createElement('canvas');cv.width=fx.canvas.w;cv.height=fx.canvas.h;
    const ctx=cv.getContext('2d');
    try{
      await fRenderTemplateLayers(ctx,clonar(fx.layers),fx.canvas.w,fx.canvas.h,dados,
        {color:'#FF9000'},{layers:[],w:fx.canvas.w,h:fx.canvas.h,bg:'#ffffff'},
        {scope:'franqueado',purpose:'preview'});
    }catch(e){ return 'erro:'+(e&&e.code||e&&e.message||'render'); }
    const p=document.createElement('canvas');p.width=9;p.height=8;
    const pc=p.getContext('2d');pc.imageSmoothingQuality='high';pc.drawImage(cv,0,0,9,8);
    const d=pc.getImageData(0,0,9,8).data;
    let bits='';
    for(let y=0;y<8;y++)for(let x=0;x<8;x++){
      const i=(y*9+x)*4, j=(y*9+x+1)*4;
      const a=d[i]*.299+d[i+1]*.587+d[i+2]*.114, b=d[j]*.299+d[j+1]*.587+d[j+2]*.114;
      bits+=(a>b?'1':'0');
    }
    return bits;
  }
  const hamming=(a,b)=>{ if(!a||!b||a.length!==b.length)return 64; let n=0;
    for(let i=0;i<a.length;i++) if(a[i]!==b[i])n++; return n; };

  const TOL_GEO=(fx)=>Math.round(Math.min(fx.canvas.w,fx.canvas.h)*0.03);   // 3% do lado curto
  const TOL_HASH=10;                                                        // de 64 bits

  fixtures.forEach(fx=>{
    Object.keys(fx.cenarios).forEach(cenario=>{
      const dados=fx.cenarios[cenario];
      test(fx.nome+' · '+cenario,async()=>{
        usarCampos(fx.campos);
        const t0=performance.now();
        const out=solve(fx,dados);
        const ms=performance.now()-t0;
        const original=gApplyRelativeAnchors(clonar(fx.layers),dados,{},
          {fitText:false,canvas:fx.canvas,scope:'franqueado'});
        const res=gDescribeFranchiseeLayout(original,out);

        // ── INVARIANTE 1: nada some no caminho ──
        assert(out.length===fx.layers.length,'o solver devolveu '+out.length+' camadas de '+fx.layers.length);

        // ── INVARIANTE 2: determinismo (prévia e PNG saem do mesmo lugar) ──
        const g1=JSON.stringify(geo(out)), g2=JSON.stringify(geo(solve(fx,dados)));
        assert(g1===g2,'duas execuções iguais deram geometrias diferentes — a prévia mentiria sobre o PNG');

        // ── INVARIANTE 3: a hierarquia não inverte ──
        const txt=out.filter(l=>l&&l.type==='text'&&l._fit);
        const corpo=(l)=>(l._tetoFonte!=null?l._tetoFonte:(l.fontSize||24));
        txt.forEach(a=>txt.forEach(b=>{
          if((a.fontSize||24)<=(b.fontSize||24))return;
          assert(corpo(a)>=corpo(b)-0.5,'“'+a.name+'” ficou menor que “'+b.name+'” — hierarquia invertida');
        }));

        // ── INVARIANTE 4: a tinta não piora a sangria da prancheta ──
        out.forEach(l=>{
          if(!l||l.type!=='text'||!l._fit)return;
          const r=gInkRect(l,l._fit), b=l._layoutBase||r;
          const foraAgora=Math.max(0,-r.x)+Math.max(0,-r.y)
            +Math.max(0,r.x+r.w-fx.canvas.w)+Math.max(0,r.y+r.h-fx.canvas.h);
          const foraAntes=Math.max(0,-b.x)+Math.max(0,-b.y)
            +Math.max(0,b.x+b.w-fx.canvas.w)+Math.max(0,b.y+b.h-fx.canvas.h);
          if(res.status!=='unsafe')
            assert(foraAgora<=foraAntes+3,'“'+l.name+'” saiu da prancheta ('+Math.round(foraAgora)+'px) sem a arte ser marcada como insegura');
        });

        // ── INVARIANTE 5: baseline autorado universal (inclusive material antigo) ──
        (fx.exigeBaselineMigrado||[]).forEach(id=>{
          const l=out.find(x=>x.id===id);
          assert(l&&l.layoutRef&&l.layoutRef.ink&&l.layoutRefText,
            'a camada “'+id+'” continuou sem baseline — a migração em runtime não rodou');
        });

        // ── INVARIANTE 6: bloqueio tem saída ──
        if(res.status==='unsafe'){
          const diag=gLayoutDiagnosis(clonar(fx.layers),dados,{},
            {fitText:true,canvas:fx.canvas,scope:'franqueado'},out);
          assert(diag&&diag.campo,'a arte foi bloqueada sem dizer qual campo travou');
          assert(!/\{\{|_/.test(diag.mensagem),'a mensagem do bloqueio vazou nome técnico');
          assert(diag.limite<=String(dados[diag.campo]||'').length,
            'o limite seguro prometido é maior que o texto que já não coube');
        }

        // ── GOLDEN ── (só quando a pilha de fontes bate com a gravada)
        const chave=fx.nome+'|'+cenario;
        const hash=await assinatura(fx,dados);
        if(gravando){
          gravado[chave]={fp:fpMaquina,status:res.status,hash:hash,geo:geo(out)};
        }
        const g=goldens[chave];
        if(!g){ avisos.push(chave+': sem golden gravado'); }
        else if(g.fp!==fpMaquina){ avisos.push(chave+': golden é de outra pilha de fontes ('+g.fp+' ≠ '+fpMaquina+') — comparação fina pulada'); }
        else {
          assert(res.status===g.status,'o veredito mudou: era “'+g.status+'”, virou “'+res.status+'”');
          const atual=geo(out), tol=TOL_GEO(fx);
          g.geo.forEach(esperado=>{
            const achou=atual.find(a=>a[0]===esperado[0]);
            assert(achou,'a camada “'+esperado[0]+'” sumiu do resultado');
            for(let i=1;i<5;i++) assert(Math.abs(achou[i]-esperado[i])<=tol,
              'a camada “'+esperado[0]+'” moveu '+Math.abs(achou[i]-esperado[i])+'px (tolerância '+tol+')');
          });
          const dist=hamming(hash,g.hash);
          assert(dist<=TOL_HASH,'a arte renderizada mudou visualmente ('+dist+'/64 células diferentes)');
        }
        // Status fora do golden ainda é informação: registra para o resumo.
        if(!g||g.fp!==fpMaquina) avisos.push(chave+' → '+res.status+' em '+Math.round(ms)+'ms');
      });
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
      console.error('[corpus]',item.name,error);
      falhas.push({name:item.name,error:String(error&&error.message||error)});
    }
    results.appendChild(li);
  }
  const failed=cases.length-passed;
  const perf=(typeof gLayoutPerfStats==='function')?gLayoutPerfStats():null;
  summary.textContent=passed+'/'+cases.length+' cenários passaram'
    +(failed?' · '+failed+' falharam':'')
    +(perf&&perf.n?' · solver p50 '+perf.p50+'ms / p95 '+perf.p95+'ms':'')
    +' · fontes '+fpMaquina;
  if(avisos.length){
    const li=document.createElement('li');li.className='case';
    li.innerHTML='<strong>Notas</strong><small>'+avisos.map(a=>a.replace(/</g,'&lt;')).join('<br>')+'</small>';
    results.appendChild(li);
  }
  if(gravando){
    const li=document.createElement('li');li.className='case';
    const json='window.LUMA_CORPUS_GOLDEN='+JSON.stringify(gravado,null,1)+';';
    li.innerHTML='<strong>Golden desta máquina — cole em tests/corpus-golden.js</strong>'
      +'<textarea style="width:100%;height:240px" readonly></textarea>';
    results.appendChild(li);li.querySelector('textarea').value=json;
    // O runner de CI grava o arquivo sozinho quando roda com LUMA_RECORD=1; a textarea acima
    // atende quem abriu a página na mão.
    window.__lumaGolden=json;
    console.log(json);
  }
  document.title=(failed?'FALHOU':'OK')+' — Corpus ('+passed+'/'+cases.length+')';
  window.__lumaTest={passed:passed,total:cases.length,failures:falhas,perf:perf,notas:avisos};
})();
