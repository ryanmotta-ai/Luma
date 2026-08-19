/* Suíte do EDL de vídeo (js/video/projeto.js). Abra tests/video-edl.html ou rode
   `node scripts/run-browser-tests.js video-edl`.

   Por que estes casos: o corte não move bytes — ele é aritmética de tempo entre a
   LINHA DO TEMPO (o que o usuário vê) e a FONTE (o que o <video> procura). Errar
   essa conversão por 40ms é o defeito que ninguém vê no código e todo mundo vê no
   vídeo exportado. O validador do plano de IA entra aqui pelo mesmo motivo: é o
   único ponto que impede um plano inválido de virar exportação errada. */
(async function(){
  const results=document.getElementById('results');
  const summary=document.getElementById('summary');
  const cases=[]; const test=(name,fn)=>cases.push({name,fn});
  const assert=(c,m)=>{if(!c)throw new Error(m||'asserção falhou');};
  const perto=(a,b,tol)=>Math.abs(a-b)<=(tol||0.005);
  const novo=(dur)=>vdNovoProjeto({nome:'teste.mp4',dur:dur||30,w:1080,h:1920,mb:12});

  test('projeto novo nasce com o material inteiro, não editado',()=>{
    novo(30);
    assert(vdSegs().length===1,'deveria nascer com um segmento');
    assert(perto(vdDuracaoFinal(),30),'a duração final deveria ser a do vídeo');
    assert(!vdPodeDesfazer(),'não há o que desfazer num projeto recém-aberto');
  });

  test('linha do tempo mapeia para a fonte depois de um corte',()=>{
    novo(30);
    vdDividir(10);                 // 0–10 | 10–30
    assert(vdRemoverSeg(vdSegs()[0].id),'não removeu o primeiro trecho');
    assert(perto(vdDuracaoFinal(),20),'a duração final deveria cair para 20s');
    // O segundo 0 da linha do tempo agora é o segundo 10 do arquivo.
    assert(perto(vdSegNoTempo(0).tFonte,10),'o início da linha não aponta para 10s da fonte');
    assert(perto(vdSegNoTempo(5).tFonte,15),'o meio da linha não aponta para 15s da fonte');
  });

  test('dois cortes: o tempo salta o buraco do trecho removido',()=>{
    novo(30);
    vdDividir(10); vdDividir(20);   // 0–10 | 10–20 | 20–30
    vdRemoverSeg(vdSegs()[1].id);   // sobra 0–10 | 20–30
    assert(perto(vdDuracaoFinal(),20),'duração final errada');
    assert(perto(vdSegNoTempo(9.9).tFonte,9.9),'antes do buraco o tempo deveria ser igual');
    assert(perto(vdSegNoTempo(10.5).tFonte,20.5),'depois do buraco o tempo não saltou');
  });

  test('divisão na borda não cria trecho de lixo',()=>{
    novo(30);
    assert(!vdDividir(0),'dividir no zero não deveria criar segmento vazio');
    assert(!vdDividir(30),'dividir no fim não deveria criar segmento vazio');
    assert(vdSegs().length===1,'a divisão inválida mexeu no projeto');
  });

  test('o último trecho não pode ser removido',()=>{
    novo(30);
    assert(!vdRemoverSeg(vdSegs()[0].id),'removeu o único trecho e deixou o projeto sem prévia');
  });

  test('desfazer e refazer voltam ao estado exato',()=>{
    novo(30);
    vdDividir(10); vdRemoverSeg(vdSegs()[0].id);
    const antes=vdDuracaoFinal();
    assert(vdDesfazer(),'não desfez a remoção'); assert(perto(vdDuracaoFinal(),30),'desfazer não devolveu os 30s');
    assert(vdDesfazer(),'não desfez a divisão'); assert(vdSegs().length===1,'desfazer não devolveu o segmento único');
    assert(vdRefazer()&&vdRefazer(),'não refez as duas edições');
    assert(perto(vdDuracaoFinal(),antes),'refazer não chegou ao mesmo estado');
  });

  test('editar depois de desfazer descarta o futuro',()=>{
    novo(30);
    vdDividir(10); vdDividir(20);
    vdDesfazer();
    vdDividir(5);
    assert(!vdPodeRefazer(),'o futuro descartado continuou disponível');
  });

  test('estado é resolvido por ID — clone do desfazer não quebra a referência',()=>{
    novo(30);
    vdDividir(10);
    const idAlvo=vdSegs()[1].id;
    const refViva=vdSegs()[1];
    vdDesfazer(); vdRefazer();            // troca os objetos por clones
    assert(vdSegs().indexOf(refViva)<0,'o clone não aconteceu — o teste não vale');
    assert(vdSegIdx(idAlvo)===1,'resolver por ID deixou de achar o segmento após o clone');
  });

  test('zoom fica na faixa e não repete snapshot inútil',()=>{
    novo(30);
    vdZoomSeg(vdSegs()[0].id, 9);
    assert(perto(vdSegs()[0].zoom,1.6),'o zoom não foi limitado ao teto');
    assert(!vdZoomSeg(vdSegs()[0].id,1.6),'zoom igual deveria ser no-op');
  });

  /* ── VALIDADOR DO PLANO DE IA ── */

  test('plano válido vira segmentos limpos',()=>{
    novo(60);
    const r=vdValidarPlano({acoes:[
      {tipo:'segmentos',manter:[{de:0,ate:5},{de:8,ate:20}],motivo:'remove silêncio de 5 a 8'},
      {tipo:'reframe',de:9,ate:19,zoom:1.1,motivo:'aproximar o produto'}
    ]});
    assert(r.ok,'plano legítimo foi rejeitado');
    assert(r.segmentos.length===2,'não sobraram os dois trechos');
    assert(perto(r.segmentos[1].zoom,1.1),'o reframe não casou com o trecho');
    assert(r.descartes.length===0,'descartou algo válido: '+JSON.stringify(r.descartes));
  });

  test('plano sem lista de trechos é rejeitado',()=>{
    novo(60);
    assert(!vdValidarPlano({acoes:[{tipo:'reframe',de:1,ate:2,zoom:1.2,motivo:'aproxima'}]}).ok,'aceitou plano sem segmentos');
    assert(!vdValidarPlano({}).ok,'aceitou resposta sem ações');
    assert(!vdValidarPlano(null).ok,'aceitou resposta nula');
  });

  test('trecho fora do vídeo, invertido ou curto é descartado com motivo',()=>{
    novo(30);
    const r=vdValidarPlano({acoes:[{tipo:'segmentos',motivo:'corta',manter:[
      {de:0,ate:5},{de:40,ate:50},{de:20,ate:19},{de:10,ate:10.01}
    ]}]});
    assert(r.ok,'o trecho bom deveria sobreviver');
    assert(r.segmentos.length===1,'passou trecho inválido');
    assert(r.descartes.length===3,'faltou motivo para algum descarte: '+JSON.stringify(r.descartes));
    assert(r.descartes.every(d=>d.porque&&d.porque.length>5),'descarte sem explicação legível');
  });

  test('trechos sobrepostos não passam (duplicariam o áudio)',()=>{
    novo(30);
    const r=vdValidarPlano({acoes:[{tipo:'segmentos',motivo:'corta',manter:[{de:0,ate:10},{de:8,ate:15}]}]});
    assert(r.segmentos.length===1,'aceitou sobreposição');
    assert(r.descartes.some(d=>/sobrep/i.test(d.porque)),'não explicou a sobreposição');
  });

  test('ação sem motivo e ação não suportada são descartadas',()=>{
    novo(30);
    const r=vdValidarPlano({acoes:[
      {tipo:'segmentos',manter:[{de:0,ate:10}]},                       // sem motivo
      {tipo:'legendas',template:'dm_cap_02',motivo:'retenção'},        // não suportada ainda
      {tipo:'segmentos',manter:[{de:0,ate:10}],motivo:'este vale'}
    ]});
    assert(r.ok,'o plano com uma ação boa deveria valer');
    assert(r.descartes.some(d=>/sem motivo/.test(d.porque)),'aceitou ação sem motivo');
    assert(r.descartes.some(d=>d.acao==='legendas'),'aceitou calado uma ação que não sabe executar');
  });

  test('asset e id inventados não têm como entrar (nenhuma ação de asset é suportada)',()=>{
    novo(30);
    const r=vdValidarPlano({acoes:[
      {tipo:'segmentos',manter:[{de:0,ate:10}],motivo:'mantém a abertura'},
      {tipo:'overlay',escolha:'asset_que_nao_existe',em:2,motivo:'produto'},
      {tipo:'vinheta',posicao:'fim',escolha:'dm_outro_inventado',motivo:'marca'}
    ]});
    assert(r.segmentos.length===1&&r.ok,'o plano deveria valer só pelo corte');
    assert(r.descartes.filter(d=>d.acao==='overlay'||d.acao==='vinheta').length===2,'asset inventado não foi barrado');
  });

  test('aplicar plano é UMA edição no histórico e mexe na versão',()=>{
    novo(60);
    const v=vdProj.versao;
    const r=vdAplicarPlano({acoes:[{tipo:'segmentos',manter:[{de:0,ate:5},{de:8,ate:20}],motivo:'silêncio'}]});
    assert(r.ok&&vdSegs().length===2,'o plano não foi aplicado');
    assert(vdProj.versao===v+1,'a versão não subiu');
    assert(vdDesfazer()&&vdSegs().length===1,'um desfazer não voltou o plano inteiro');
  });

  test('plano com ações demais não trava a aba',()=>{
    novo(60);
    const acoes=[{tipo:'segmentos',manter:[{de:0,ate:10}],motivo:'mantém a abertura'}];
    for(let i=0;i<200;i++) acoes.push({tipo:'reframe',de:0,ate:1,zoom:1.1,motivo:'ruído'});
    const r=vdValidarPlano({acoes});
    assert(r.ok,'o plano com ruído deveria manter o corte válido');
    assert(r.descartes.some(d=>/mais de/.test(d.porque)),'não avisou que cortou o excedente');
  });

  test('duração muito acima do alvo é reportada, não silenciada',()=>{
    novo(120);
    vdProj.alvo_seg=30;
    const r=vdValidarPlano({acoes:[{tipo:'segmentos',manter:[{de:0,ate:100}]  ,motivo:'mantém quase tudo'}]});
    assert(r.ok,'o plano longo continua aplicável — o alvo é intenção');
    assert(r.descartes.some(d=>d.acao==='duração'),'não avisou que passou do alvo');
  });

  let passed=0; const falhas=[];
  for(const item of cases){
    const li=document.createElement('li'); li.className='case';
    try{ await item.fn(); passed++; li.classList.add('pass'); li.innerHTML='<strong>✓ '+item.name+'</strong>'; }
    catch(error){ li.classList.add('fail'); li.innerHTML='<strong>✕ '+item.name+'</strong><small>'+String(error&&error.message||error)+'</small>';
      console.error('[video-edl]',item.name,error); falhas.push({name:item.name,error:String(error&&error.message||error)}); }
    results.appendChild(li);
  }
  const failed=cases.length-passed;
  summary.textContent=passed+'/'+cases.length+' casos passaram'+(failed?' · '+failed+' falharam':' · EDL aprovado');
  document.title=(failed?'FALHOU':'OK')+' — EDL de vídeo ('+passed+'/'+cases.length+')';
  window.__lumaTest={passed:passed,total:cases.length,failures:falhas};
})();
