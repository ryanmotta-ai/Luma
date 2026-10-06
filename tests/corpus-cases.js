/* ══════════════════════════════════════════════════════════════════════════════════════════
   CORPUS REPRODUZÍVEL DO LOCAL FIT — abra `tests/corpus.html` ou rode
   `node scripts/run-browser-tests.js corpus`.

   O que ele é: cada fixture de `tests/corpus/` é uma prancheta real sanitizada (geometria e
   tipografia dos PSDs da Deskfy, sem dado de cliente e sem imagem embutida). Cada uma roda em
   4 NÍVEIS DE COPY pelo MESMO runtime da prévia e da exportação:

     curto   — o conteúdo AUTORAL (o `example` do campo, que é o texto que o designer tinha na
               tela quando compôs). Por construção ele cabe.
     medio   — o cenário nominal do fixture.
     longo   — copy real esticada.
     extremo — copy que um franqueado apressado cola de um WhatsApp.

   O que ele cobra:

   1. INVARIANTES (o portão de verdade). Não dependem da pilha de fontes da máquina:
        · o runtime devolve a mesma quantidade de camadas;
        · rodar duas vezes dá geometria IDÊNTICA (sem isso, prévia e PNG podem divergir);
        · ⛔ NENHUM TERCEIRO SE MOVE — a única geometria que o Local Fit escreve é a da placa
          ligada ao próprio texto. Esta é a asserção que define o produto;
        · a hierarquia tipográfica não inverte;
        · o veredito é um dos quatro (`original`/`wrapped`/`shrunk`/`overflow`);
        · quando bloqueia, o diagnóstico diz QUAL campo e QUANTOS caracteres cabem;
        · o tempo entra no orçamento de desempenho (p50/p95 no fim).

   2. GOLDEN (geometria + imagem). Comparação fina, ancorada na PILHA DE FONTES: o golden é
      gravado por "impressão digital" de fonte (`fp`). Sem golden da máquina atual, a comparação
      é PULADA com aviso — nunca vira falso vermelho. Regravar: `tests/corpus.html?record=1`.

   3. DISTRIBUIÇÃO. Quanto o Local Fit resolve sozinho, por nível de copy. Overflow seguro é
      RESULTADO VÁLIDO, não falha: 100% é a meta errada. O número sai no resumo.

   Como crescer o corpus: todo PSD que der problema vira um arquivo em `tests/corpus/`, com um
   `<script>` em `corpus.html`. A partir daí ele nunca mais pode regredir em silêncio.
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
  /* ── O RUNTIME, igual ao da prévia e do PNG: âncoras autoradas + Local Fit ─────────────── */
  const runtime=(fx,dados)=>{
    const base=gApplyRelativeAnchors(clonar(fx.layers),dados,{},
      {canvas:fx.canvas,scope:'franqueado'});
    return { base, lf:gLocalFitArte(base,{canvas:fx.canvas,dados:dados,defaults:{}}) };
  };
  const geo=(out)=>out.filter(l=>l&&l.type==='text').map(l=>
    [l.id,Math.round(l.x||0),Math.round(l.y||0),Math.round(l.w||0),Math.round(l.h||0),
     Math.round((l._tetoFonte!=null?l._tetoFonte:l.fontSize)||0)]);

  /* DISTRIBUIÇÃO (item 16): quanto o Local Fit resolve sozinho, por nível de copy. */
  const _dist={};
  const contar=(nivel,status)=>{
    const d=_dist[nivel]||(_dist[nivel]={original:0,wrapped:0,shrunk:0,overflow:0,n:0});
    d[status]++; d.n++;
  };
  /* DESEMPENHO POR EDIÇÃO DE CAMPO (item 17): o custo REAL de uma tecla. Medido com conteúdo
     de verdade, nunca com `dados:{}` — arte sem conteúdo não mede nada. */
  const _perf={ original:[], wrap:[], shrink:[], piso:[] };

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

  /* O nível `curto` é o conteúdo AUTORAL: o `example` de cada campo, que é de onde saiu o
     `layoutRefText` do fixture. Por construção ele cabe — se o Local Fit mexer aqui, ele está
     redesenhando arte saudável. */
  const copyAutoral=(fx)=>{
    const d={};
    (fx.campos||[]).forEach(c=>{ if(c&&c.name&&c.example!=null) d[c.name]=String(c.example); });
    return d;
  };
  const niveis=(fx)=>Object.assign({ curto:copyAutoral(fx) },
    { medio:fx.cenarios.nominal, longo:fx.cenarios.longo, extremo:fx.cenarios.extremo });

  fixtures.forEach(fx=>{
    const cen=niveis(fx);
    Object.keys(cen).forEach(nivel=>{
      const dados=cen[nivel];
      if(!dados||!Object.keys(dados).length) return;
      test(fx.nome+' · '+nivel,async()=>{
        usarCampos(fx.campos);
        const t0=performance.now();
        const r=runtime(fx,dados);
        const ms=performance.now()-t0;
        const out=r.lf.layers, res=r.lf.result;

        // ── INVARIANTE 1: nada some no caminho ──
        assert(out.length===fx.layers.length,'saíram '+out.length+' camadas de '+fx.layers.length);

        // ── INVARIANTE 2: determinismo (prévia e PNG saem do mesmo lugar) ──
        assert(JSON.stringify(geo(out))===JSON.stringify(geo(runtime(fx,dados).lf.layers)),
          'duas execuções iguais deram geometrias diferentes — a prévia mentiria sobre o PNG');

        /* ── INVARIANTE 3: ⛔ TERCEIROS NUNCA MUDAM ─────────────────────────────────────────
           A asserção que define o produto. A ÚNICA camada autorizada a ter geometria diferente
           da publicada é a PLACA ligada ao texto que encaixou — e ela só porque a forma faz
           parte do próprio campo. Qualquer outro deslocamento é recomposição. */
        const placas=new Set(res.changes.filter(c=>c.geometry&&c.placaDe).map(c=>c.id));
        assert(res.changes.filter(c=>c.geometry).every(c=>c.placaDe),
               'houve mudança de geometria que não é de placa de campo nenhum');
        const antes=new Map(r.base.map(l=>[l.id,l]));
        out.forEach(l=>{
          if(placas.has(l.id)) return;              // placa local: a exceção do contrato (item 9)
          const o=antes.get(l.id)||{};
          ['x','y','w','h'].forEach(k=>assert((l[k]||0)===(o[k]||0),
            '“'+l.name+'” teve '+k+' alterado de '+(o[k]||0)+' para '+(l[k]||0)
            +' — isso é recomposição, e ela saiu do produto'));
        });

        /* ── INVARIANTE 4: a hierarquia não inverte ALÉM DA FOLGA ──
           26/09/2026 (decisão do Ryan): no último recurso antes do bloqueio um texto pode descer
           até 80% do próximo degrau DA MESMA FAMÍLIA (`G_PISO_FOLGA_HIERARQUIA`); entre famílias
           (preço × texto) não há hierarquia. Abaixo disso continua sendo inversão. */
        const txt=out.filter(l=>l&&l.type==='text');
        const folga=(typeof G_PISO_FOLGA_HIERARQUIA==='number')?G_PISO_FOLGA_HIERARQUIA:1;
        const familia=(l)=>(typeof _gPisoFamilia==='function')?_gPisoFamilia(l):'texto';
        const corpo=(l)=>(l._tetoFonte!=null?l._tetoFonte:(l.fontSize||24));
        txt.forEach(a=>txt.forEach(b=>{
          if((a.fontSize||24)<=(b.fontSize||24))return;
          /* EXCEÇÃO DO PREÇO: campo de preço só cede por causa do PRÓPRIO preço. Como cada
             texto agora encaixa isolado, uma camada autorada maior pode terminar menor que ele.
             É decisão de produto (o preço é o argumento da peça), não defeito. */
          if(typeof gLayoutEhPrecoDinamico==='function'&&gLayoutEhPrecoDinamico(b))return;
          if(familia(a)!==familia(b))return;
          assert(corpo(a)>=Math.round((b.fontSize||24)*folga)-0.5,'“'+a.name+'” ficou menor que 80% de “'+b.name+'” — hierarquia invertida além da folga');
        }));

        // ── INVARIANTE 5: o veredito é um dos quatro ──
        assert(['original','wrapped','shrunk','overflow'].indexOf(res.status)>=0,
               'veredito inesperado: '+res.status);
        contar(nivel,res.status);
        const degraus=res.campos.map(c=>c.degrau);
        if(degraus.indexOf('piso')>=0) _perf.piso.push(ms);
        else if(degraus.indexOf('shrink')>=0) _perf.shrink.push(ms);
        else if(degraus.indexOf('wrap')>=0) _perf.wrap.push(ms);
        else _perf.original.push(ms);

        // ── INVARIANTE 6: nenhum encaixe para ANTES do piso ──
        res.campos.forEach(c=>{
          if(c.status!=='overflow')return;
          assert(c.fontSize<=c.piso+1,'“'+c.id+'” desistiu em '+c.fontSize
            +'px com piso '+c.piso+'px — parou antes do fundo do poço');
        });

        // ── INVARIANTE 7: baseline autorado universal (inclusive material antigo) ──
        (fx.exigeBaselineMigrado||[]).forEach(id=>{
          const l=out.find(x=>x.id===id);
          assert(l&&l.layoutRef&&l.layoutRef.ink&&l.layoutRefText,
            'a camada “'+id+'” continuou sem baseline — a migração em runtime não rodou');
        });

        // ── INVARIANTE 8: bloqueio tem saída ──
        if(res.status==='overflow'){
          const diag=gLocalFitDiagnostico(out,res,dados,{canvas:fx.canvas,defaults:{}});
          assert(diag&&diag.campo,'a arte foi bloqueada sem dizer qual campo travou');
          assert(!/\{\{|_/.test(diag.mensagem),'a mensagem do bloqueio vazou nome técnico');
          assert(diag.limite<=String(dados[diag.campo]||'').length,
            'o limite seguro prometido é maior que o texto que já não coube');
        }

        // ── GOLDEN ── (só quando a pilha de fontes bate com a gravada)
        const chave=fx.nome+'|'+nivel;
        const hash=await assinatura(fx,dados);
        if(gravando) gravado[chave]={fp:fpMaquina,status:res.status,hash:hash,geo:geo(out)};
        const g=goldens[chave];
        if(!g){ avisos.push(chave+': sem golden gravado'); }
        else if(g.fp!==fpMaquina){ avisos.push(chave+': golden é de outra pilha de fontes — comparação fina pulada'); }
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
        if(!g||g.fp!==fpMaquina) avisos.push(chave+' → '+res.status+' em '+Math.round(ms)+'ms');
      });
    });
  });

  /* ══ ORIGINAL FIRST ABSOLUTO ══════════════════════════════════════════════════════════════
     "Conteúdo que já cabe permanece geometricamente igual." Não é a tolerância de 3% do golden:
     é IGUALDADE EXATA, e a ausência de QUALQUER carimbo. O golden mede "a arte continua
     parecida"; isto mede "o Luma não encostou na arte".
     A asserção é sobre o que o RENDER devolve (`fRenderTemplateLayers`), não sobre o Local Fit
     isolado: é no render que o runtime inteiro se fecha, e é ele que se quer travar. */
  let intactas=0;
  fixtures.forEach(fx=>{
    test(fx.nome+' · autoral · cabe → geometria intacta',async()=>{
      usarCampos(fx.campos);
      const dados=copyAutoral(fx);
      assert(Object.keys(dados).length,'o fixture não tem `example` em nenhum campo');
      const cv=document.createElement('canvas');cv.width=fx.canvas.w;cv.height=fx.canvas.h;
      const rendered=await fRenderTemplateLayers(cv.getContext('2d'),clonar(fx.layers),
        fx.canvas.w,fx.canvas.h,dados,{color:'#FF9000'},
        {layers:[],w:fx.canvas.w,h:fx.canvas.h,bg:'#ffffff'},{scope:'franqueado',purpose:'preview'});
      const res=rendered&&rendered._layoutResult;
      assert(res,'o render não devolveu o contrato de layout (_layoutResult)');
      if(res.requiresAdaptation){
        // Há fixture no corpus desenhado para NÃO caber — é para isso que ele existe.
        avisos.push(fx.nome+' · autoral → '+res.status+' (o contrato de geometria intacta não se aplica)');
        return;
      }
      intactas++;
      /* A régua é o DESENHO PUBLICADO — `fx.layers` cru, o x/y/w/h que o designer salvou. */
      const porId=new Map(fx.layers.filter(l=>l&&l.id).map(l=>[l.id,l]));
      rendered.forEach(l=>{
        if(!l||!l.id)return;
        const o=porId.get(l.id);
        assert(o,'a camada “'+l.id+'” apareceu no render e não existe no desenho publicado');
        ['x','y','w','h'].forEach(k=>assert((Number(l[k])||0)===(Number(o[k])||0),
          'a camada “'+l.id+'” mudou '+k+': '+o[k]+' → '+l[k]+' com conteúdo que cabe'));
        assert((Number(l.fontSize)||0)===(Number(o.fontSize)||0),
          'a camada “'+l.id+'” teve o corpo trocado com conteúdo que cabe');
        assert(l._tetoFonte==null&&l._layoutW==null&&l._entrelinha==null,
          'a camada “'+l.id+'” voltou carimbada — a arte que cabia passou pelo caminho adaptado');
      });
    });
  });
  test('o contrato de geometria intacta é exercido por algum fixture',async()=>{
    assert(intactas>0,'nenhum fixture chegou a “cabe” com o conteúdo autoral — o contrato ficaria sem prova');
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

  /* ── DISTRIBUIÇÃO (item 16) ────────────────────────────────────────────────────────────── */
  const pct=(a,b)=>b?Math.round(a/b*1000)/10:0;
  const geral={original:0,wrapped:0,shrunk:0,overflow:0,n:0};
  ['curto','medio','longo','extremo'].forEach(nv=>{
    const d=_dist[nv]; if(!d)return;
    Object.keys(geral).forEach(k=>geral[k]+=d[k]);
    avisos.push('DISTRIBUIÇÃO · '+nv.padEnd(8)+' original '+d.original+' ('+pct(d.original,d.n)
      +'%) · wrap '+d.wrapped+' ('+pct(d.wrapped,d.n)+'%) · shrink '+d.shrunk+' ('+pct(d.shrunk,d.n)
      +'%) · overflow '+d.overflow+' ('+pct(d.overflow,d.n)+'%) · n='+d.n);
  });
  if(geral.n){
    const resolvido=geral.original+geral.wrapped+geral.shrunk;
    avisos.push('DISTRIBUIÇÃO · TOTAL   o Local Fit resolve sozinho '+resolvido+'/'+geral.n
      +' ('+pct(resolvido,geral.n)+'%) · bloqueio seguro em '+geral.overflow
      +' ('+pct(geral.overflow,geral.n)+'%) — overflow é resultado válido, não falha');
  }
  /* ── DESEMPENHO POR EDIÇÃO DE CAMPO (item 17) ──────────────────────────────────────────── */
  const p95=(a)=>{ if(!a.length)return null; const s=a.slice().sort((x,y)=>x-y);
                   return Math.round(s[Math.min(s.length-1,Math.floor(s.length*0.95))]*10)/10; };
  const med=(a)=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length*10)/10:null;
  avisos.push('DESEMPENHO por edição de campo (runtime completo: âncoras + Local Fit):');
  ['original','wrap','shrink','piso'].forEach(k=>{
    const a=_perf[k]; if(!a.length){ avisos.push('   '+k+': sem casos'); return; }
    avisos.push('   '+k.padEnd(9)+' n='+a.length+' · média '+med(a)+'ms · p95 '+p95(a)+'ms'
      +' · máx '+Math.round(Math.max.apply(null,a)*10)/10+'ms');
  });

  summary.textContent=passed+'/'+cases.length+' cenários passaram'
    +(failed?' · '+failed+' falharam':'')
    +(perf&&perf.n?' · Local Fit p50 '+perf.p50+'ms / p95 '+perf.p95+'ms':'')
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
    window.__lumaGolden=json;
    console.log(json);
  }
  document.title=(failed?'FALHOU':'OK')+' — Corpus ('+passed+'/'+cases.length+')';
  window.__lumaTest={passed:passed,total:cases.length,failures:falhas,perf:perf,notas:avisos};
})();
