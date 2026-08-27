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

  /* ── MOTOR DE REGRAS: silêncio (js/video/ingest.js) ──
     As duas funções de decisão são puras, então dá para montar o envelope à mão e
     afirmar o corte sem precisar de áudio de verdade. O áudio real é exercitado na
     bancada (tests/_video-bancada.html). */

  // Envelope sintético: lista de [duração em segundos, nível de energia].
  const env=(trechos,janela)=>{
    const j=janela||0.05; const out=[];
    trechos.forEach(([dur,nivel])=>{ const n=Math.round(dur/j); for(let i=0;i<n;i++) out.push(nivel); });
    return out;
  };

  test('acha a pausa no lugar certo entre duas falas',()=>{
    const r=vdSilenciosDoEnvelope(env([[2,0.20],[1.5,0.001],[2,0.20]]),0.05);
    assert(r.silencios.length===1,'esperava uma pausa, achou '+r.silencios.length);
    assert(perto(r.silencios[0].de,2,0.06)&&perto(r.silencios[0].ate,3.5,0.06),
      'pausa nos tempos errados: '+JSON.stringify(r.silencios[0]));
  });

  test('pausa curta demais não vira corte',()=>{
    const r=vdSilenciosDoEnvelope(env([[2,0.20],[0.4,0.001],[2,0.20]]),0.05);
    assert(r.silencios.length===0,'cortou uma pausa de 0,4s — o ritmo da fala precisa dela');
  });

  test('limiar é adaptativo: piso de ruído alto ainda revela a pausa',()=>{
    // Gravação de celular em ambiente barulhento: o "silêncio" tem energia 0.02,
    // que um limiar fixo em -50dBFS trataria como fala.
    const r=vdSilenciosDoEnvelope(env([[2,0.30],[1.2,0.02],[2,0.30]]),0.05);
    assert(r.silencios.length===1,'não achou a pausa acima do chão de ruído');
    assert(r.limiar>VD_RMS_ABS,'o limiar não se adaptou ao piso da gravação');
  });

  test('material sem pausa nenhuma não é cortado inteiro',()=>{
    // Fala contínua com variação normal: 12dB acima do piso passaria da fala e
    // marcaria tudo como silêncio se não houvesse o teto.
    const trechos=[]; for(let i=0;i<40;i++) trechos.push([0.5, 0.15+(i%3)*0.02]);
    const r=vdSilenciosDoEnvelope(env(trechos),0.05);
    const totalSilencio=r.silencios.reduce((t,s)=>t+(s.ate-s.de),0);
    assert(totalSilencio<2,'marcou '+totalSilencio.toFixed(1)+'s de silêncio numa fala contínua');
  });

  test('envelope vazio não quebra',()=>{
    const r=vdSilenciosDoEnvelope([],0.05);
    assert(r.silencios.length===0,'inventou silêncio a partir de nada');
  });

  test('inverter pausas deixa respiro nas bordas e não sobrepõe',()=>{
    const manter=vdManterSemSilencio([{de:2,ate:3.5}],6);
    assert(manter.length===2,'esperava dois trechos, veio '+manter.length);
    assert(manter[0].ate>2 && manter[0].ate<=2.2,'o trecho antes da pausa ficou sem respiro: '+manter[0].ate);
    assert(manter[1].de>=3.3 && manter[1].de<3.5,'o trecho depois da pausa ficou sem respiro: '+manter[1].de);
    assert(manter[0].ate<=manter[1].de,'os trechos se sobrepuseram — o validador recusaria');
  });

  test('fragmento curto entre duas pausas é descartado',()=>{
    // 0,15s de fala entre duas pausas é clique, não frase.
    const manter=vdManterSemSilencio([{de:1,ate:2},{de:2.15,ate:3.5}],5);
    assert(!manter.some(m=>(m.ate-m.de)<VD_FALA_MIN),'manteve um fragmento menor que o mínimo: '+JSON.stringify(manter));
  });

  test('o plano do motor de regras passa no MESMO validador da IA',()=>{
    novo(10);
    const medicao={ok:true,silencios:[{de:2,ate:3.2},{de:6,ate:7.5}],dur:10};
    const plano=vdPlanoCorteSilencio(medicao);
    assert(plano&&plano.acoes.length===1,'não gerou plano');
    assert(plano.acoes[0].motivo&&plano.acoes[0].motivo.length>3,'plano sem motivo seria descartado pelo validador');
    const r=vdValidarPlano(plano);
    assert(r.ok,'o validador recusou o plano do motor de regras: '+JSON.stringify(r.descartes));
    assert(r.descartes.length===0,'o plano gerou descarte: '+JSON.stringify(r.descartes));
    assert(r.segmentos.length===3,'esperava 3 trechos mantidos, veio '+r.segmentos.length);
  });

  test('aplicar o corte automático é uma edição desfazível',()=>{
    novo(10);
    const plano=vdPlanoCorteSilencio({ok:true,silencios:[{de:2,ate:3.2}],dur:10});
    const antes=vdDuracaoFinal();
    assert(vdAplicarPlano(plano).ok,'não aplicou');
    assert(vdDuracaoFinal()<antes-0.5,'a duração não caiu: '+vdDuracaoFinal());
    assert(vdDesfazer()&&perto(vdDuracaoFinal(),10),'um desfazer não voltou o material inteiro');
  });

  test('sem pausa nenhuma o motor não devolve plano (em vez de plano vazio)',()=>{
    novo(10);
    assert(vdPlanoCorteSilencio({ok:true,silencios:[],dur:10})===null,'devolveu plano sem ter o que cortar');
    assert(vdPlanoCorteSilencio({ok:false,erro:'x'})===null,'devolveu plano a partir de medição falha');
  });

  /* ── ENQUADRAMENTO (js/video/compositor.js, função pura) ──
     O caso que decide o produto: vídeo gravado na horizontal virando Reels. O corte
     joga fora 60% da largura, e centralizar às cegas corta o produto quando ele não
     está no meio do quadro. */

  test('mesma proporção não corta nada',()=>{
    const q=vdEnquadrar(1080,1920,1080,1920,1,0.5);
    assert(q.eixo===null,'inventou corte onde a proporção bate');
    assert(perto(q.dx,0)&&perto(q.dy,0),'deslocou um frame que cabia inteiro');
    assert(perto(q.dw,1080)&&perto(q.dh,1920),'redimensionou o que já servia');
  });

  test('horizontal em 9:16 corta as laterais, nunca distorce',()=>{
    const q=vdEnquadrar(1920,1080,1080,1920,1,0.5);
    assert(q.eixo==='x','o corte deveria ser nas laterais');
    assert(perto(q.dh,1920,1),'a altura deveria preencher a saída');
    assert(q.dw>1080,'a largura deveria estourar (é o que vira corte)');
    assert(perto(q.dw/q.dh, 1920/1080, 0.001),'a proporção da fonte foi distorcida');
  });

  test('foco escolhe o lado que sobrevive',()=>{
    const esq=vdEnquadrar(1920,1080,1080,1920,1,0);
    const cen=vdEnquadrar(1920,1080,1080,1920,1,0.5);
    const dir=vdEnquadrar(1920,1080,1080,1920,1,1);
    assert(perto(esq.dx,0),'foco 0 deveria alinhar a borda esquerda da fonte');
    assert(perto(dir.dx,1080-dir.dw),'foco 1 deveria alinhar a borda direita');
    assert(cen.dx<esq.dx&&cen.dx>dir.dx,'o centro deveria ficar entre os dois');
  });

  test('foco 0,5 é idêntico ao comportamento sem foco',()=>{
    const a=vdEnquadrar(1920,1080,1080,1920,1,0.5);
    const b=vdEnquadrar(1920,1080,1080,1920,1,null);
    assert(perto(a.dx,b.dx)&&perto(a.dy,b.dy),'ausência de foco mudou o enquadramento antigo');
  });

  test('vertical em 16:9 corta em cima e embaixo',()=>{
    const q=vdEnquadrar(1080,1920,1920,1080,1,0);
    assert(q.eixo==='y','o corte deveria ser vertical');
    assert(perto(q.dy,0),'foco 0 deveria alinhar o topo');
    assert(vdEnquadrar(1080,1920,1920,1080,1,1).dy<q.dy,'foco 1 deveria descer o quadro');
  });

  test('zoom aproxima sem quebrar a proporção e cria corte nos dois casos',()=>{
    const sem=vdEnquadrar(1080,1920,1080,1920,1,0.5);
    const com=vdEnquadrar(1080,1920,1080,1920,1.4,0.5);
    assert(perto(com.dw/sem.dw,1.4,0.01),'o zoom não escalou como pedido');
    assert(perto(com.dw/com.dh, 1080/1920, 0.001),'o zoom distorceu a fonte');
    assert(com.eixo!==null,'com zoom há sobra: deveria haver eixo de corte');
  });

  test('foco fora da faixa é contido, não explode',()=>{
    const a=vdEnquadrar(1920,1080,1080,1920,1,-5);
    const b=vdEnquadrar(1920,1080,1080,1920,1,99);
    assert(perto(a.dx,0),'foco negativo passou do limite');
    assert(perto(b.dx,1080-b.dw),'foco acima de 1 passou do limite');
  });

  test('reframe da IA pode pedir só o foco, sem zoom',()=>{
    novo(20);
    const r=vdValidarPlano({acoes:[
      {tipo:'segmentos',manter:[{de:0,ate:10}],motivo:'mantém a abertura'},
      {tipo:'reframe',de:1,ate:9,foco:0.2,motivo:'o produto está à esquerda do quadro'}
    ]});
    assert(r.ok,'recusou um reframe só de foco: '+JSON.stringify(r.descartes));
    assert(perto(r.segmentos[0].foco,0.2),'o foco pedido não chegou ao segmento');
    assert(perto(r.segmentos[0].zoom,1),'inventou zoom onde a IA não pediu');
  });

  test('foco inválido no plano da IA é descartado com motivo',()=>{
    novo(20);
    const r=vdValidarPlano({acoes:[
      {tipo:'segmentos',manter:[{de:0,ate:10}],motivo:'mantém a abertura'},
      {tipo:'reframe',de:1,ate:9,foco:7,motivo:'foco absurdo'}
    ]});
    assert(r.ok,'o corte válido deveria sobreviver');
    assert(r.descartes.some(d=>/foco fora da faixa/.test(d.porque)),'aceitou foco fora da faixa');
  });

  test('foco no segmento é edição desfazível e não repete snapshot',()=>{
    novo(20);
    const id=vdSegs()[0].id;
    assert(vdFocoSeg(id,0.2),'não aplicou o foco');
    assert(!vdFocoSeg(id,0.2),'foco igual deveria ser no-op');
    assert(vdDesfazer()&&vdSegs()[0].foco==null,'desfazer não removeu o foco');
  });

  /* ── LEGENDA: transcrição → cartões (js/video/legenda.js, funções puras) ──
     O desenho de verdade (motor de render, fonte real) é exercitado na bancada;
     aqui fica a parte que decide O QUE aparece e QUANDO. */

  test('texto curto vira um cartão só',()=>{
    const p=vdQuebrarFala('Chegou o combo novo',38);
    assert(p.length===1&&p[0]==='Chegou o combo novo','quebrou sem necessidade: '+JSON.stringify(p));
  });

  test('quebra respeita o teto de caracteres e não perde palavra',()=>{
    const fala='esse combo tem dois lanches duas batatas e dois refrigerantes por um preço muito bom';
    const p=vdQuebrarFala(fala,38);
    assert(p.length>1,'não quebrou um texto longo');
    assert(p.every(x=>x.length<=38),'pedaço acima do teto: '+JSON.stringify(p));
    assert(p.join(' ')===fala,'a quebra perdeu ou duplicou palavra: '+JSON.stringify(p));
  });

  test('quebra prefere fechar depois da pontuação',()=>{
    const p=vdQuebrarFala('Chegou o combo da semana. Aproveita hoje mesmo',38);
    assert(/\.$/.test(p[0]),'o primeiro cartão não fechou no ponto: '+JSON.stringify(p));
  });

  test('espaço repetido e sobra em branco não geram cartão vazio',()=>{
    assert(vdQuebrarFala('   ',38).length===0,'texto em branco virou cartão');
    assert(vdQuebrarFala(null,38).length===0,'nulo virou cartão');
    assert(vdQuebrarFala('a    b',38)[0]==='a b','não normalizou o espaço');
  });

  test('o tempo do trecho é dividido por caracteres, não igualmente',()=>{
    const cards=vdCardsDeTranscricao([{de:0,ate:6,texto:'curto '+'x'.repeat(60)}],{maxCaracteres:38});
    assert(cards.length===2,'esperava dois cartões, veio '+cards.length);
    const d0=cards[0].ate-cards[0].de, d1=cards[1].ate-cards[1].de;
    assert(d1>d0,'o cartão maior deveria ficar mais tempo na tela ('+d0.toFixed(2)+' vs '+d1.toFixed(2)+')');
  });

  test('cartão não fica pendurado além do teto de duração',()=>{
    const cards=vdCardsDeTranscricao([{de:0,ate:20,texto:'oi'}]);
    assert(cards[0].ate-cards[0].de<=VD_CARD_DUR_MAX+0.01,'cartão de '+(cards[0].ate-cards[0].de)+'s');
  });

  test('trecho inválido da IA não vira legenda',()=>{
    const cards=vdCardsDeTranscricao([
      {de:5,ate:3,texto:'tempo invertido'},
      {de:1,ate:2,texto:'   '},
      {de:'x',ate:2,texto:'tempo não numérico'},
      {de:2,ate:4,texto:'este vale'}
    ]);
    assert(cards.length===1&&/este vale/.test(cards[0].texto),'passou trecho inválido: '+JSON.stringify(cards));
  });

  test('cartão é achado pelo tempo da FONTE e respeita o liga/desliga',()=>{
    novo(30);
    vdProj.legendas={ativo:true,template:'dm_cap_01',cards:[{de:2,ate:4,texto:'primeiro'},{de:5,ate:7,texto:'segundo'}]};
    assert(vdCardEm(3)&&vdCardEm(3).texto==='primeiro','não achou o cartão do segundo 3');
    assert(vdCardEm(6)&&vdCardEm(6).texto==='segundo','não achou o cartão do segundo 6');
    assert(vdCardEm(4.5)===null,'inventou cartão no vão entre dois');
    assert(vdCardEm(20)===null,'inventou cartão depois do último');
    vdProj.legendas.ativo=false;
    assert(vdCardEm(3)===null,'legenda desligada continuou aparecendo');
  });

  test('a camada da legenda respeita a área segura e a centralização',()=>{
    const W=1080,H=1920;
    const c=vdLegendaCamada('CHEGOU O COMBO',W,H,'dm_cap_01');
    assert(c.type==='text'&&c.textAlign==='center','a legenda deveria ser texto centralizado');
    assert(c.y+c.h<=H*0.85,'o bloco invadiu a faixa reservada embaixo (UI do Reels)');
    assert(c.x>0&&c.x+c.w<W,'o bloco encostou nas bordas laterais');
    assert(perto(c.x,(W-c.w)/2,2),'o bloco não ficou centralizado na horizontal');
    assert(c.strokeW>=2&&c.strokeColor,'legenda sem contorno some em cima de vídeo claro');
    assert(c.content==='CHEGOU O COMBO','o template deveria aplicar caixa-alta');
  });

  test('a legenda escala com o formato de saída',()=>{
    const vert=vdLegendaCamada('teste',1080,1920,'dm_cap_01');
    const horiz=vdLegendaCamada('teste',1920,1080,'dm_cap_01');
    assert(horiz.fontSize<vert.fontSize,'a fonte deveria acompanhar a ALTURA da saída');
    assert(horiz.w>vert.w,'a caixa deveria acompanhar a LARGURA da saída');
  });

  test('template desconhecido cai no padrão em vez de quebrar',()=>{
    const c=vdLegendaCamada('teste',1080,1920,'inexistente');
    assert(c&&c.fontSize>0,'template inválido derrubou a legenda');
  });

  /* ── O DIRETOR (js/video/ia.js) ────────────────────────────────────────
     Só a parte que é PURA. A chamada ao modelo não entra em CI: custa cota, depende
     de rede e a resposta muda. O que dá para blindar é o que o modelo LÊ — e um
     contexto que mente (pausa errada, asset que não existe) produz plano ruim sem
     que nada quebre, que é o pior tipo de defeito. */

  test('o contexto da IA leva as pausas MEDIDAS, não uma estimativa',()=>{
    novo(30);
    const ctx=vdMontarContexto({ok:true,silencios:[{de:4.8,ate:7.2},{de:19.1,ate:20.5}]});
    assert(/4\.8 a 7\.2/.test(ctx),'a primeira pausa medida não apareceu no contexto');
    assert(/19\.1 a 20\.5/.test(ctx),'a segunda pausa medida não apareceu no contexto');
    assert(/2\.4s/.test(ctx),'a duração da pausa deveria vir calculada');
  });

  test('sem áudio legível o contexto DIZ que não sabe, em vez de omitir',()=>{
    novo(30);
    const ctx=vdMontarContexto({ok:false,erro:'trilha ausente',silencios:[]});
    assert(/nenhuma pausa/.test(ctx),'deveria declarar que não há pausa detectada');
    assert(/trilha ausente/.test(ctx),'o motivo da falha deveria chegar ao modelo');
  });

  test('o contexto nunca oferece asset que não existe nesta versão',()=>{
    novo(30);
    const ctx=vdMontarContexto({ok:true,silencios:[]});
    assert(/ASSETS DISPONÍVEIS: nenhum/.test(ctx),'sem esta linha o modelo propõe vinheta e o validador descarta na cara do usuário');
  });

  test('material horizontal em saída vertical avisa o modelo sobre o corte',()=>{
    vdNovoProjeto({nome:'h.mp4',dur:20,w:1920,h:1080,mb:9});
    vdProj.formato='9:16';
    const ctx=vdMontarContexto({ok:true,silencios:[]});
    assert(/horizontal/.test(ctx),'a orientação do material deveria estar no contexto');
    assert(/foco/.test(ctx),'sem o aviso, o modelo não sabe que precisa escolher o enquadramento');
    vdProj.formato='16:9';
    assert(!/joga fora as laterais/.test(vdMontarContexto({ok:true,silencios:[]})),'avisou de corte num formato que não corta');
  });

  test('montar o contexto não altera o projeto',()=>{
    novo(30);
    vdDividir(10);
    const antes=JSON.stringify(vdProj);
    vdMontarContexto({ok:true,silencios:[{de:1,ate:2}]});
    assert(JSON.stringify(vdProj)===antes,'vdMontarContexto mexeu no projeto — não é mais pura');
  });

  test('a transcrição existente entra no contexto com os tempos',()=>{
    novo(30);
    vdProj.legendas={ativo:true,template:'dm_cap_01',cards:[{de:0,ate:2.5,texto:'chegou o combo'}]};
    const ctx=vdMontarContexto({ok:true,silencios:[]});
    assert(/chegou o combo/.test(ctx),'a fala transcrita não chegou ao modelo');
    assert(/\[0\.0–2\.5\]/.test(ctx),'a fala deveria vir com o intervalo de tempo');
  });

  test('o log da IA sobrevive a desfazer e refazer',()=>{
    novo(30);
    const r=vdAplicarPlano({acoes:[{tipo:'segmentos',manter:[{de:0,ate:8}],motivo:'remove a pausa medida em 8s'}]});
    assert(r.ok,'o plano de teste deveria ser válido: '+JSON.stringify(r.descartes||[]));
    vdProj.iaLog=[{tipo:'segmentos',motivo:'remove a pausa medida em 8s'}];
    assert(vdReRegistrar(),'vdReRegistrar deveria costurar o log ao snapshot atual');
    assert(vdDesfazer(),'não desfez a edição da IA');
    assert(!(vdProj.iaLog&&vdProj.iaLog.length),'o material original não deveria carregar log de IA');
    assert(vdRefazer(),'não refez a edição da IA');
    assert(vdProj.iaLog&&vdProj.iaLog.length===1,'refazer devolveu os cortes SEM o motivo deles');
  });

  test('vdReRegistrar não cria entrada nova no histórico',()=>{
    novo(30);
    vdDividir(10);
    const podia=vdPodeDesfazer();
    vdProj.iaLog=[{tipo:'reframe',motivo:'teste'}];
    vdReRegistrar();
    assert(vdDesfazer()&&podia,'deveria desfazer a divisão em UM passo');
    assert(vdSegs().length===1,'vdReRegistrar empilhou um snapshot extra — o usuário desfaria duas vezes');
  });

  /* ── DURAÇÃO ALVO ────────────────────────────────────────────────────────
     O alvo é AJUSTE, não edição: o prompt e o validador leem, e desfazer um corte
     não pode mudar o que o usuário escolheu. */

  test('o alvo é ajuste: desfazer não devolve o alvo antigo',()=>{
    novo(30);
    vdDividir(10);
    assert(vdDefinirAlvo(60),'não aceitou o alvo de 60s');
    assert(vdDesfazer(),'não desfez a divisão');
    assert(vdProj.alvo_seg===60,'desfazer um corte reverteu o alvo escolhido');
    assert(vdRefazer()&&vdProj.alvo_seg===60,'refazer perdeu o alvo');
  });

  test('o alvo só aceita as durações da casa',()=>{
    novo(30);
    assert(!vdDefinirAlvo(7),'aceitou um alvo fora da lista');
    assert(!vdDefinirAlvo(30),'aceitou o alvo que já estava valendo');
    assert(vdProj.alvo_seg===30,'o alvo mudou numa chamada que deveria ser recusada');
  });

  test('o alvo entra no contexto que a IA lê',()=>{
    novo(120);
    vdDefinirAlvo(60);
    assert(/duração alvo: 60s/.test(vdMontarContexto({ok:true,silencios:[]})),'o alvo escolhido não chegou ao modelo');
  });

  test('o validador avisa quando o plano estoura o alvo, sem invalidar',()=>{
    novo(120);
    vdDefinirAlvo(15);
    const r=vdValidarPlano({acoes:[{tipo:'segmentos',manter:[{de:0,ate:100}],motivo:'mantém quase tudo'}]});
    assert(r.ok,'estourar o alvo não deveria invalidar o plano — o alvo é intenção');
    assert(r.descartes.some(d=>d.acao==='duração'),'o usuário não seria avisado de que a IA errou o tamanho');
  });

  /* ── LEGENDA: O CARTÃO É EDITÁVEL ────────────────────────────────────────
     A legenda é QUEIMADA no pixel. Transcrição errada sem conserto é defeito
     irreversível — daí o cartão vazio não desenhar (é o "remover" sem botão). */

  test('cartão sem texto não vira legenda',()=>{
    novo(30);
    vdProj.legendas={ativo:true,template:'dm_cap_01',cards:[{de:0,ate:5,texto:'   '}]};
    const c=vdCardEm(2);
    assert(c!==null,'o cartão deveria continuar existindo na lista');
    assert(!String(c.texto||'').trim(),'o texto em branco deveria ser reconhecível como vazio');
  });

  test('editar o texto do cartão não mexe no tempo dele',()=>{
    novo(30);
    vdProj.legendas={ativo:true,template:'dm_cap_01',cards:[{de:1,ate:3,texto:'combu da semana'}]};
    const c=vdCardEm(2);
    c.texto='combo da semana';
    const d=vdCardEm(2);
    assert(d===c,'o cartão no ponto deveria ser o mesmo objeto — a interface edita por referência');
    assert(perto(d.de,1)&&perto(d.ate,3),'editar o texto deslocou o tempo do cartão');
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
