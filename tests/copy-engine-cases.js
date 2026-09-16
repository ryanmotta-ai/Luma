/* ══════════════════════════════════════════════════════════════════════════════════════════
   MOTOR DE COPY — abra `tests/copy-engine.html` ou rode
   `node scripts/run-browser-tests.js copy-engine`.

   O que ele cobra: as 3 leis do motor (ver o cabeçalho dele em `js/franqueado/png-generator.js`).

   1. NÃO INVENTAR — nenhum preço, desconto ou validade aparece sem o franqueado ter digitado.
      É a parte mais importante daqui: legenda que promete o que a loja não combinou vira
      problema no balcão. Cada mentira que o motor já contou virou um caso nomeado abaixo.
   2. NÃO REPETIR — as 3 opções não dividem gancho/corpo/CTA, e a memória curta impede que a
      arte seguinte repita a frase da anterior.
   3. NÃO SOAR ARTIFICIAL — sem placeholder vazado, sem espaço duplo, sem "OFF OFF", sem
      "Válido válido", sem artigo de gênero grudado no produto.

   Por que aqui e não num `test_*.py`: o Luma não tem build nem runner de unidade — a suíte é
   HTML que carrega o arquivo REAL no navegador REAL, como as outras seis de `tests/`.

   A aleatoriedade é fixada por `_fCopySetRandom` (semente do próprio motor, sem configuração
   nova no produto), então os casos que precisam de saída estável são determinísticos — e o
   fuzz do fim roda com aleatoriedade solta de propósito, que é onde os bugs aparecem.
   ══════════════════════════════════════════════════════════════════════════════════════════ */
(async function(){
  const results=document.getElementById('results');
  const summary=document.getElementById('summary');
  const cases=[];
  const test=(name,fn)=>cases.push({name,fn});
  const assert=(condition,message)=>{if(!condition)throw new Error(message||'asserção falhou');};

  /* Gerador com semente (mulberry32) — determinismo sem o produto ganhar configuração. */
  const semente=(s)=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
  const limpaMemoria=()=>{try{localStorage.removeItem('dm_copy_recent_v1');}catch(e){}};
  const solta=()=>{_fCopySetRandom(null);limpaMemoria();};
  const gerar=(b)=>fBuildCopy(b.prod,b.de,b.por,b.val,b.desc,b.fmt||'feed',b.ctx);
  const tudo=(o)=>[o.op1,o.op2,o.op3];
  const corpoDe=(t)=>String(t).split('\n').filter(l=>l.trim()&&!/^#/.test(l.trim()));

  /* ── O catálogo de invariantes. Uma função só, usada pelos casos fixos E pelo fuzz: o que
        o fuzz descobre vira regra aqui e passa a valer para todo mundo. ── */
  function violacoes(texto,b,qual){
    const t=String(texto==null?'':texto);
    const out=[];
    const nDe=fParsePriceNumber(b.de),nPor=fParsePriceNumber(b.por);
    const temEconomia=nDe>0&&nPor>0&&nDe>nPor;
    const mPct=/(\d{1,3})\s*%/.exec(String(b.desc==null?'':b.desc));
    const temPct=!!mPct&&+mPct[1]>0&&+mPct[1]<100;
    const temPorReal=/\d/.test(String(b.por==null?'':b.por))&&nPor>0;
    const temDeReal=/\d/.test(String(b.de==null?'':b.de))&&nDe>0;

    if(typeof texto!=='string')out.push('não é string');
    if(!t.trim())out.push('copy vazia');
    if(/undefined|\[object Object\]|NaN/.test(t))out.push('valor tóxico (undefined/NaN/[object Object])');
    if(/\{[a-zA-Z]+\}/.test(t))out.push('placeholder vazou');
    if(/ {2,}/.test(t))out.push('espaço duplicado');
    if(/ [.,!?;:]/.test(t))out.push('espaço antes de pontuação');
    if(/off\s+off/i.test(t))out.push('OFF duplicado');
    if(/%\s*%/.test(t))out.push('% duplicado');
    if(/v[áa]lid[oa]\s+v[áa]lid[oa]/i.test(t))out.push('"Válido válido"');
    if(/R\$(?!\s*\*?\s*\d)/.test(t))out.push('R$ sem número');
    if(/R\$\s*\*?0,00/.test(t))out.push('preço zerado exibido');
    if(/\b0\s*%/.test(t))out.push('desconto de 0%');
    if(/\n{3,}/.test(t))out.push('linha em branco tripla');
    if(/^\s|\s$/.test(t))out.push('espaço nas bordas');
    if(/\(\s*\)/.test(t))out.push('parêntese vazio');

    // 1ª LEI — não inventar
    if(!String(b.val==null?'':b.val).trim()&&/v[áa]lido/i.test(t))out.push('INVENTOU validade');
    if(!temPorReal&&!temDeReal&&/R\$/.test(t))out.push('INVENTOU preço');
    const marcaDePor=/\bera\s+\*?R?\$?\s*[\d.,]|\bantes\s+\*?R?\$?\s*[\d.,]|em vez de|caiu de|caiu pra|economiza|Economia de|Baixou o preço|\bde\s+\*?R?\$?\s*[\d.,]+\*?\s+por\s/i;
    if(!temEconomia&&marcaDePor.test(t))out.push('INVENTOU desconto de/por');
    // percentual só pode aparecer se foi digitado OU se é calculado de dois preços reais
    if(!temPct&&!temEconomia&&/\d{1,3}\s*\*?%\*?\s*(OFF|de desconto|a menos)/i.test(t))out.push('INVENTOU percentual');

    // formato por aba
    if(qual==='op3'){
      if(/#\w/.test(t))out.push('WhatsApp com hashtag');
    }else if(/\*/.test(t))out.push('negrito de WhatsApp fora do WhatsApp');
    return out;
  }

  const BRIEF=(o)=>Object.assign({prod:'Pizza Calabresa',de:'',por:'',val:'',desc:'',ctx:''},o);

  /* ─────────────── CONTRATO BÁSICO ─────────────── */

  test('devolve 3 opções de texto, sempre',()=>{
    solta();
    const o=gerar(BRIEF({por:'R$ 39,90'}));
    assert(o&&typeof o==='object','fBuildCopy não devolveu objeto');
    ['op1','op2','op3'].forEach(k=>{
      assert(typeof o[k]==='string','op '+k+' não é string: '+typeof o[k]);
      assert(o[k].trim().length>10,'op '+k+' veio vazia ou curta demais');
    });
  });

  test('fGetSegmentedCaptions (assinatura antiga) continua funcionando',()=>{
    solta();
    const o=fGetSegmentedCaptions('Pizza Calabresa','R$ 59,90','R$ 39,90','só hoje','');
    assert(o&&o.op1&&o.op2&&o.op3,'a assinatura de retrocompatibilidade quebrou');
  });

  test('as 3 opções nunca são iguais entre si',()=>{
    solta();
    for(let i=0;i<120;i++){
      const o=gerar(BRIEF({por:'R$ 39,90',de:'R$ 59,90'}));
      assert(o.op1!==o.op2&&o.op2!==o.op3&&o.op1!==o.op3,'duas opções saíram idênticas na rodada '+i);
    }
  });

  test('as 3 opções não dividem gancho, corpo nem CTA',()=>{
    solta();
    for(let i=0;i<120;i++){
      const o=gerar(BRIEF({por:'R$ 39,90',de:'R$ 59,90',prod:'Temaki Salmão'}));
      const linhas=tudo(o).map(corpoDe);
      const ganchos=linhas.map(l=>l[0]);
      const ctas=linhas.map(l=>l[l.length-1]);
      assert(new Set(ganchos).size===3,'gancho repetido entre as opções: '+JSON.stringify(ganchos));
      assert(new Set(ctas).size===3,'CTA repetido entre as opções: '+JSON.stringify(ctas));
    }
  });

  /* ─────────────── 1ª LEI: NÃO INVENTAR (cada caso é um bug que já saiu daqui) ─────────────── */

  test('regressão · validade vazia não vira promessa de prazo',()=>{
    solta();
    // Havia um chute pelo dia da semana: sem nada digitado saía "Válido neste fim de semana"
    // (sex/sáb/dom) ou "Válido por tempo limitado". A loja nunca combinou esse prazo.
    for(let i=0;i<200;i++){
      tudo(gerar(BRIEF({por:'R$ 39,90',val:''}))).forEach(t=>{
        assert(!/v[áa]lido/i.test(t),'inventou validade sem o campo: '+t);
        assert(!/tempo limitado|fim de semana/i.test(t),'inventou prazo sem o campo: '+t);
      });
    }
  });

  test('regressão · "de" igual ao "por" não anuncia desconto',()=>{
    solta();
    for(let i=0;i<200;i++){
      tudo(gerar(BRIEF({de:'R$ 39,90',por:'R$ 39,90'}))).forEach(t=>{
        assert(!/\bera\b|\bantes\b|Baixou o preço|em vez de|caiu/i.test(t),'anunciou desconto inexistente: '+t);
      });
    }
  });

  test('regressão · "de" MENOR que o "por" não anuncia desconto',()=>{
    solta();
    for(let i=0;i<200;i++){
      tudo(gerar(BRIEF({de:'R$ 19,90',por:'R$ 39,90'}))).forEach(t=>{
        assert(!/\bera\b|\bantes\b|Baixou o preço|em vez de|caiu|economiza/i.test(t),'inverteu a oferta: '+t);
      });
    }
  });

  test('regressão · preço zerado não vira "por R$ 0,00"',()=>{
    solta();
    for(let i=0;i<200;i++){
      tudo(gerar(BRIEF({por:'R$ 0,00'}))).forEach(t=>{
        assert(!/0,00/.test(t),'anunciou o produto de graça: '+t);
      });
    }
  });

  test('regressão · desconto de 0% não vira oferta',()=>{
    solta();
    for(let i=0;i<200;i++){
      tudo(gerar(BRIEF({por:'R$ 39,90',desc:'0%'}))).forEach(t=>{
        assert(!/0\s*%/.test(t),'"0% OFF" chegou na legenda: '+t);
      });
    }
  });

  test('regressão · sem preço nenhum, nenhuma copy cita R$',()=>{
    solta();
    for(let i=0;i<200;i++){
      tudo(gerar(BRIEF({prod:'Marmita Executiva',por:'',de:''}))).forEach(t=>{
        assert(!/R\$/.test(t),'inventou preço: '+t);
      });
    }
  });

  test('regressão · chave do franqueado não vaza nem é reinterpolada',()=>{
    solta();
    // `{{produto}}` é a sintaxe de campo do próprio Luma: se chegar sem substituir, o
    // interpolador do motor voltava a interpretar e a legenda saía com "* *"/"{por} {de}".
    const hostis=['{{produto}}','{por} {de}','{prod}','{val}'];
    hostis.forEach(h=>{
      for(let i=0;i<20;i++){
        tudo(gerar(BRIEF({prod:h,val:h,desc:h,por:'R$ 10,00'}))).forEach(t=>{
          assert(!/[{}]/.test(t),'chave vazou na legenda: '+t);
        });
      }
    });
  });

  test('regressão · campo que não é texto não vira "[object Object]"',()=>{
    solta();
    [{},[],null,undefined,NaN,true].forEach(v=>{
      for(let i=0;i<10;i++){
        tudo(fBuildCopy(v,v,v,v,v,'feed',v)).forEach(t=>{
          assert(typeof t==='string','saída não é string');
          assert(!/\[object Object\]|undefined|NaN/.test(t),'valor tóxico vazou: '+t);
        });
      }
    });
  });

  test('regressão · "Válido válido" e "off OFF" não acontecem',()=>{
    solta();
    ['Válido só hoje','válido até domingo','só hoje'].forEach(v=>{
      ['20% off','20% OFF','20%'].forEach(d=>{
        for(let i=0;i<12;i++){
          tudo(gerar(BRIEF({val:v,desc:d,por:'R$ 39,90'}))).forEach(t=>{
            assert(!/v[áa]lid[oa]\s+v[áa]lid[oa]/i.test(t),'"Válido válido" voltou: '+t);
            assert(!/off\s+off/i.test(t),'"off OFF" voltou: '+t);
          });
        }
      });
    });
  });

  test('regressão · nome de campanha nunca ocupa o lugar do produto',()=>{
    solta();
    /* Bug relatado com print em 16/09/2026: o franqueado pulou o campo do produto e a
       legenda saiu "Hoje tem Copa Do Mundo 2026. Confere o preço no app." — anunciando a
       PASTA em vez do que está na arte. A causa estava no chamador (chat.js terminava a
       busca em `|| camp.name`), mas o motor também tinha que aguentar produto vazio: aqui
       a campanha entra como CONTEXTO (último argumento), que é o papel legítimo dela. */
    const campanhas=['Copa Do Mundo 2026','Combo Com Desconto','Much+ Benefícios','Semana da Pizza'];
    campanhas.forEach(c=>{
      for(let i=0;i<30;i++){
        ['', 'R$ 39,90'].forEach(por=>{
          tudo(fBuildCopy('','',por,'','','feed',c)).forEach(t=>{
            assert(t.indexOf(c)<0,'o nome da campanha "'+c+'" vazou como produto: '+t);
          });
        });
      }
    });
  });

  test('sem produto, a copy continua íntegra (nada de "vontade de?")',()=>{
    solta();
    const achados=[];
    for(let i=0;i<150;i++){
      const b={prod:'',de:'',por:['','R$ 39,90','R$ 12,00'][i%3],val:['','só hoje'][i%2],desc:['','20%'][i%2],ctx:'Copa Do Mundo 2026'};
      const o=gerar(b);
      ['op1','op2','op3'].forEach(k=>{
        violacoes(o[k],b,k).forEach(v=>{if(achados.length<6)achados.push(v+'\n      '+o[k].replace(/\n/g,' ⏎ '));});
        // o gancho-pergunta existe pra NOMEAR o produto; sem produto ele não pode aparecer
        if(/\b(de|em|querer|fosse|pede)\s*\?/i.test(o[k]))achados.push('pergunta sem objeto: '+o[k].replace(/\n/g,' ⏎ '));
        const linhas=corpoDe(o[k]);
        linhas.forEach(l=>{if(/^\s*[.,:;—-]/.test(l))achados.push('linha começando quebrada: '+JSON.stringify(l));});
      });
    }
    assert(achados.length===0,achados.length+' problemas sem produto:\n    '+achados.join('\n    '));
  });

  test('economia em reais e em % bate com os preços informados',()=>{
    solta();
    for(let i=0;i<200;i++){
      tudo(gerar(BRIEF({de:'R$ 50,00',por:'R$ 40,00'}))).forEach(t=>{
        const reais=/Economia de R\$ ([\d,]+)|economiza \*?R\$ ([\d,]+)/i.exec(t);
        if(reais)assert((reais[1]||reais[2]).replace('*','')==='10,00','economia em reais errada: '+t);
        const pct=/(\d{1,3})\s*\*?%\*?\s*(?:de desconto|OFF|a menos)/i.exec(t);
        if(pct)assert(pct[1]==='20','percentual calculado errado (esperado 20%): '+t);
      });
    }
  });

  /* ─────────────── 3ª LEI: PT-BR SEM GÊNERO GRUDADO NO PRODUTO ─────────────── */

  test('nenhum molde encosta artigo/adjetivo de gênero no produto',()=>{
    solta();
    // O motor não sabe se a loja vende "a pizza" ou "o combo" — então os moldes são neutros.
    // "no Pizza", "O Marmita" e "Pizza fresquinho" eram erro garantido.
    const femininos=['Pizza Calabresa','Coxinha','Marmita Executiva','Salada Caesar','Esfiha de Queijo'];
    femininos.forEach(p=>{
      for(let i=0;i<40;i++){
        tudo(gerar(BRIEF({prod:p,por:'R$ 25,00',de:'R$ 35,00',desc:'20%'}))).forEach(t=>{
          const esc=p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
          assert(!new RegExp('\\b(no|o|um|do|ao|pelo)\\s+\\*?'+esc,'i').test(t),'artigo masculino colado no produto feminino: '+t);
          assert(!new RegExp(esc+'\\s*\\*?\\s+(fresquinho|pronto|gostoso|caprichado|quentinho)\\b','i').test(t),'adjetivo masculino concordando errado: '+t);
        });
      }
    });
  });

  /* ─────────────── AS 3 ABAS SÃO DIFERENTES DE VERDADE ─────────────── */

  test('WhatsApp: sem hashtag, com negrito real do app',()=>{
    solta();
    for(let i=0;i<80;i++){
      const o=gerar(BRIEF({por:'R$ 39,90',de:'R$ 59,90'}));
      assert(!/#\w/.test(o.op3),'a mensagem de WhatsApp saiu com hashtag: '+o.op3);
      assert(/\*[^*]+\*/.test(o.op3),'a mensagem de WhatsApp perdeu o negrito: '+o.op3);
      assert(!/\*/.test(o.op1)&&!/\*/.test(o.op2),'negrito de WhatsApp vazou para o feed');
    }
  });

  test('Promo vende (CTA de pedido) e Engajar conversa (CTA de engajamento)',()=>{
    solta();
    const ENG=_COPY_BLOCKS.ctas.engajamento,DEL=_COPY_BLOCKS.ctas.delivery;
    for(let i=0;i<80;i++){
      const o=gerar(BRIEF({por:'R$ 39,90'}));
      const ult=t=>{const l=corpoDe(t);return l[l.length-1];};
      assert(DEL.indexOf(ult(o.op1))>=0,'a aba Promo saiu sem CTA de pedido: '+ult(o.op1));
      assert(ENG.indexOf(ult(o.op2))>=0,'a aba Engajar saiu com CTA que não é de engajamento: '+ult(o.op2));
    }
  });

  test('Engajar abre no produto com pergunta boa parte das vezes',()=>{
    solta();
    let comPergunta=0;
    for(let i=0;i<200;i++){
      const o=gerar(BRIEF({prod:'Hambúrguer Artesanal',por:'R$ 32,00'}));
      if(/\?$/.test(corpoDe(o.op2)[0]))comPergunta++;
    }
    // Não é 100% de propósito: gerar várias artes seguidas não pode virar um interrogatório.
    assert(comPergunta>=100,'a aba Engajar virou Promo com CTA trocado (só '+comPergunta+'/200 aberturas em pergunta)');
  });

  test('gancho que nomeia o produto não deixa o corpo repetir o nome',()=>{
    solta();
    for(let i=0;i<200;i++){
      const o=gerar(BRIEF({prod:'Pizza Calabresa',por:'R$ 39,90',de:'R$ 59,90'}));
      tudo(o).forEach(t=>{
        const n=t.split('Pizza Calabresa').length-1;
        assert(n<=1,'o nome do produto apareceu '+n+'× na mesma copy: '+t);
      });
    }
  });

  test('Promo cabe antes do "ver mais" do Instagram (gancho + corpo ≤ 120)',()=>{
    solta();
    let estouros=0;
    for(let i=0;i<200;i++){
      const l=corpoDe(gerar(BRIEF({prod:'Pizza Calabresa',por:'R$ 39,90',de:'R$ 59,90'})).op1);
      if((l[0]+'  '+l[1]).length>120)estouros++;
    }
    assert(estouros===0,estouros+'/200 legendas de Promo estouraram os 120 caracteres');
  });

  /* ─────────────── SEGMENTAÇÃO ─────────────── */

  test('segmenta os produtos reais do delivery no tom certo',()=>{
    const esperado=[
      ['Pizza Calabresa','pizzas'],['Pizza Portuguesa','pizzas'],
      ['X-Bacon','lanches'],['Hambúrguer Artesanal','lanches'],['Smash Burger','lanches'],['Hamburguer duplo','lanches'],
      ['Temaki Salmão','japonesa'],['Combinado 20 peças','japonesa'],['Hot Roll','japonesa'],['Yakisoba','japonesa'],
      ['Açaí 500ml','acai'],['Acai com granola','acai'],['Açai tradicional','acai'],
      ['Marmita Executiva','refeicoes'],['Feijoada completa','refeicoes'],['Prato do dia','refeicoes'],
      ['Salada Caesar','saudavel'],['Bowl fit','saudavel'],
      ['Café da Manhã','cafe'],['Pão na chapa','cafe'],
      ['Pudim','sobremesas'],['Brownie','sobremesas'],['Milkshake de morango','sobremesas'],
      ['Coca-Cola 2L','bebidas'],['Cerveja long neck','bebidas'],
      ['Porção de Batata Frita','porcoes'],['Torresmo','porcoes'],
      ['Taco Mexicano','mexicana'],['Espaguete à Bolonhesa','massas'],['Lasanha','massas'],
      ['Picanha na Brasa','churrasco'],['Espetinho','churrasco'],
      ['Pastel de Carne','salgados'],['Coxinha','salgados'],['Esfiha de Queijo','salgados'],['Pastéis variados','salgados'],
      ['Combo Família','combos'],['Kit Casal','combos'],
    ];
    const erros=esperado.filter(([p,s])=>_fCopySegment(p)!==s)
      .map(([p,s])=>p+' → '+_fCopySegment(p)+' (esperado '+s+')');
    assert(erros.length===0,'segmentação errada:\n  '+erros.join('\n  '));
  });

  test('o nome da campanha ainda decide o segmento de um produto genérico',()=>{
    // "Combo 20 peças" sozinho é combo; dentro de uma campanha de sushi é japonesa.
    assert(_fCopySegment('Combo 20 peças')==='combos','sozinho deveria cair em combos');
    assert(_fCopySegment('Combo 20 peças Bora De Sushi Na Promo')==='japonesa','o contexto da campanha parou de pesar');
  });

  test('a hashtag do segmento chega na legenda',()=>{
    solta();
    const o=gerar(BRIEF({prod:'Açaí 500ml',por:'R$ 22,00'}));
    const tags=o.op1.split('\n').pop();
    assert(/#acai|#acaibowl|#acailovers|#gelado/.test(tags),'as hashtags do segmento sumiram: '+tags);
  });

  /* ─────────────── 2ª LEI: VARIEDADE ─────────────── */

  test('o embaralhamento é Fisher-Yates (distribuição uniforme)',()=>{
    // O `sort(() => Math.random() - 0.5)` antigo não é permutação uniforme: o comparador é
    // inconsistente, e os primeiros itens do banco ficavam no topo com frequência muito
    // maior. Variedade que existia no banco mas não chegava no franqueado.
    _fCopySetRandom(null);
    const base=[0,1,2,3,4,5,6,7,8,9];
    const contagem=base.map(()=>0);
    const N=20000;
    for(let i=0;i<N;i++)contagem[_fPickRandom(base,1)[0]]++;
    const esperado=N/base.length;
    const pior=Math.max(...contagem.map(c=>Math.abs(c-esperado)/esperado));
    assert(pior<0.15,'a 1ª posição do sorteio está enviesada em '+Math.round(pior*100)+'% — o shuffle não é uniforme');
  });

  test('a memória curta impede repetir o gancho da arte anterior',()=>{
    solta();
    const ganchos=[];
    for(let i=0;i<12;i++)tudo(gerar(BRIEF({prod:'Pizza Calabresa',por:'R$ 39,90'}))).forEach(t=>ganchos.push(corpoDe(t)[0]));
    let colisoes=0;
    for(let i=3;i<ganchos.length;i++)if(ganchos.slice(Math.max(0,i-3),i).indexOf(ganchos[i])>=0)colisoes++;
    assert(colisoes===0,colisoes+' ganchos se repetiram dentro de 3 gerações — a memória anti-repetição não está segurando');
  });

  test('o motor não trava quando a memória enche (banco esgotado)',()=>{
    solta();
    // Pior caso real: o Sheets gerando dezenas de linhas seguidas do mesmo produto.
    for(let i=0;i<60;i++){
      const o=gerar(BRIEF({prod:'Pizza Calabresa',por:'R$ 39,90'}));
      tudo(o).forEach(t=>assert(t.trim().length>10,'o motor secou na geração '+i+': '+JSON.stringify(t)));
    }
  });

  test('40 gerações do mesmo brief não repetem sempre as mesmas frases',()=>{
    solta();
    const ganchos=new Set(),corpos=new Set();
    for(let i=0;i<40;i++)tudo(gerar(BRIEF({prod:'Pizza Calabresa',por:'R$ 39,90',de:'R$ 59,90'}))).forEach(t=>{
      const l=corpoDe(t);ganchos.add(l[0]);corpos.add(l[1]);
    });
    assert(ganchos.size>=12,'só '+ganchos.size+' ganchos distintos em 120 copies — variedade baixa demais');
    assert(corpos.size>=10,'só '+corpos.size+' corpos distintos em 120 copies — variedade baixa demais');
  });

  test('a semente fixa torna a saída reproduzível (contrato de teste)',()=>{
    limpaMemoria();_fCopySetRandom(semente(42));
    const a=gerar(BRIEF({por:'R$ 39,90',de:'R$ 59,90'}));
    limpaMemoria();_fCopySetRandom(semente(42));
    const b=gerar(BRIEF({por:'R$ 39,90',de:'R$ 59,90'}));
    solta();
    assert(a.op1===b.op1&&a.op2===b.op2&&a.op3===b.op3,'a semente não fixa a saída — os testes ficariam instáveis');
  });

  /* ─────────────── FUZZ: a rede que pega o que ninguém pensou ─────────────── */

  test('fuzz · matriz de briefs reais × invariantes',()=>{
    solta();
    const PRODUTOS=['Pizza Calabresa','X-Bacon','Combo Família','Açaí 500ml','Temaki Salmão','Marmita Executiva',
      'Porção de Batata Frita','Coca-Cola 2L','Pudim','Salada Caesar','Café da Manhã','Taco Mexicano',
      'Espaguete à Bolonhesa','Picanha na Brasa','Pastel de Carne','Coxinha','Kit Casal','Hambúrguer Artesanal',
      'PRODUTO EM CAIXA ALTA','produto minúsculo','Açaí c/ granola & leite ninho','Pizza','Brownie com sorvete'];
    const PRECOS=['','R$ 39,90','39,90','R$ 9,90','R$ 129,00','1.234,56','R$ 0,00','10'];
    const DES=['','R$ 59,90','59,90','R$ 10,00','R$ 39,90','—'];
    const VALS=['','só hoje','Válido só hoje','hoje','20/09','até 20/09','Esta semana','31/12/2026'];
    const DESCS=['','20%','20% off','50% OFF','R$ 10 OFF','leve 2 pague 1','0%'];
    const CTXS=['','Bora De Sushi Na Promo','Semana da Pizza','Combo do Mês'];
    const pick=(a)=>a[Math.floor(Math.random()*a.length)];

    let n=0;const achados=[];
    for(const prod of PRODUTOS)for(const por of PRECOS)for(let r=0;r<4;r++){
      const b={prod:prod,de:pick(DES),por:por,val:pick(VALS),desc:pick(DESCS),ctx:pick(CTXS)};
      let o;
      try{o=gerar(b);}catch(e){achados.push('EXCEPTION '+e.message+' · '+JSON.stringify(b));continue;}
      ['op1','op2','op3'].forEach(k=>{
        n++;
        violacoes(o[k],b,k).forEach(v=>{
          if(achados.length<8)achados.push(v+' · '+JSON.stringify(b)+'\n      '+String(o[k]).replace(/\n/g,' ⏎ '));
        });
      });
    }
    assert(achados.length===0,achados.length+' violações em '+n+' copies:\n    '+achados.join('\n    '));
    window.__copyFuzzN=(window.__copyFuzzN||0)+n;
  });

  test('fuzz · entradas hostis não quebram o motor',()=>{
    solta();
    const HOSTIS=[undefined,null,'',' ',0,123,{},[],NaN,true,
      'Produto com nome absurdamente longo que nenhum franqueado digitaria mas que pode vir de uma planilha bagunçada',
      '<script>alert(1)</script>','{prod}','{por} {de}','R$','%','---','\n\n','\t',
      'Açaí 🍇 500ml','ÁÉÍÓÚ ÃÕ Ç','x'.repeat(300),'a"b\'c`d','Pizza & Cia.'];
    let n=0;const achados=[];
    for(const a of HOSTIS)for(const b of HOSTIS)for(const c of [undefined,null,'','R$ 10,00','abc']){
      let o;
      try{o=fBuildCopy(a,b,c,a,b,'feed',c);}catch(e){achados.push('EXCEPTION '+e.message);continue;}
      ['op1','op2','op3'].forEach(k=>{
        n++;
        const t=o[k];
        if(typeof t!=='string'){achados.push('não-string em '+k);return;}
        if(/undefined|\[object Object\]|NaN/.test(t))achados.push('tóxico: '+t.slice(0,120));
        if(/\{[a-zA-Z]+\}/.test(t))achados.push('placeholder: '+t.slice(0,120));
        if(/ {2,}/.test(t))achados.push('espaço duplo: '+JSON.stringify(t.slice(0,120)));
      });
    }
    assert(achados.length===0,achados.length+' problemas em '+n+' copies:\n    '+achados.slice(0,8).join('\n    '));
    window.__copyFuzzN=(window.__copyFuzzN||0)+n;
  });

  /* ─────────────── EXECUÇÃO ─────────────── */
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
      console.error('[copy-engine]',item.name,error);
      falhas.push({name:item.name,error:String(error&&error.message||error)});
    }
    results.appendChild(li);
  }
  _fCopySetRandom(null);
  const failed=cases.length-passed;
  summary.textContent=passed+'/'+cases.length+' cenários passaram'+(failed?' · '+failed+' falharam':' · motor de copy íntegro');
  summary.dataset.passed=String(passed);summary.dataset.total=String(cases.length);
  document.title=(failed?'FALHOU':'OK')+' — Copy ('+passed+'/'+cases.length+')';

  window.__lumaTest={passed:passed,total:cases.length,failures:falhas,
    notas:['fuzz gerou '+(window.__copyFuzzN||0)+' copies contra o catálogo de invariantes']};
})();
