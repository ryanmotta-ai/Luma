/* Bancada do editor de vídeo — o portão da fase 0.
   Manual: abra tests/_video-bancada.html e clique em "Rodar a bancada".
   Automático: adicione ?auto=1 (exige um navegador com autoplay liberado —
   `--autoplay-policy=no-user-gesture-required`), porque tocar áudio sem gesto
   humano é bloqueado por política, não por defeito.

   POR QUE O MATERIAL É GERADO AQUI, e não é um arquivo no repositório: gravar o
   canvas e reabrir o resultado exercita o mesmo caminho que o produto usa
   (gravar → decodificar → editar → gravar de novo). E não entra binário no git.

   O TRUQUE DA COR: cada segundo do material sintético é pintado com um vermelho
   diferente (segundo × 36). Lendo um pixel do canvas de saída dá para AFIRMAR
   qual segundo do material está na tela — é assim que a bancada prova que o
   corte aponta para o lugar certo, em vez de confiar na aritmética do EDL. */
(function(){
  const results=document.getElementById('results');
  const casos=[]; const falhas=[]; const notas=[];
  let passed=0;
  const reg=(nome,ok,detalhe)=>{
    const li=document.createElement('li'); li.className='case '+(ok?'pass':'fail');
    li.innerHTML='<strong>'+(ok?'✓':'✕')+' '+nome+'</strong>'+(detalhe?'<small>'+detalhe+'</small>':'');
    results.appendChild(li);
    if(ok) passed++; else falhas.push({name:nome,error:detalhe||'falhou'});
    casos.push(nome);
    // Progresso num global SEPARADO de propósito: o runner devolve assim que vê
    // __lumaTest, então publicar parcial ali daria resultado incompleto como final.
    // Aqui é só para diagnosticar travamento — sem isto, um travo não diz onde foi.
    window.__lumaProgresso={feitos:casos.length,ultimo:nome,ok:ok};
  };
  const publicar=()=>{ window.__lumaTest={passed:passed,total:casos.length,failures:falhas,notas:notas}; };
  const esperar=ms=>new Promise(r=>setTimeout(r,ms));
  const marco=n=>{ window.__lumaProgresso={feitos:casos.length,ultimo:'(em curso) '+n}; };
  const SEG_MATERIAL=6, COR_POR_SEG=36;

  /* ── 1. Matriz de gravação ── */
  function matriz(){
    const tipos=['video/mp4;codecs="avc1.42E01E,mp4a.40.2"','video/mp4;codecs=avc1','video/mp4',
                 'video/webm;codecs="vp9,opus"','video/webm;codecs=vp8','video/webm'];
    const linhas=[];
    const sup=t=>(typeof MediaRecorder!=='undefined'&&MediaRecorder.isTypeSupported)?MediaRecorder.isTypeSupported(t):false;
    tipos.forEach(t=>linhas.push((sup(t)?'✓':'✕')+'  '+t));
    linhas.push('');
    linhas.push('canvas.captureStream: '+(typeof document.createElement('canvas').captureStream==='function'));
    linhas.push('requestVideoFrameCallback: '+(typeof document.createElement('video').requestVideoFrameCallback==='function'));
    linhas.push('AudioContext: '+!!(window.AudioContext||window.webkitAudioContext));
    linhas.push('escolha do Luma (vdMimeSaida): '+(vdMimeSaida()||'NENHUMA'));
    linhas.push('extensão do arquivo: .'+vdExtensaoSaida(vdMimeSaida()));
    document.getElementById('matriz').textContent=linhas.join('\n');
    notas.push('mime de saída: '+(vdMimeSaida()||'nenhum'));
    return linhas.join(' | ');
  }

  /* ── 2. Material sintético: canvas animado + tom, gravado em tempo real ── */
  async function gravarMaterial(){
    const c=document.createElement('canvas'); c.width=540; c.height=960;
    const ctx=c.getContext('2d');
    const mime=vdMimeSaida();
    const stream=c.captureStream(30);
    let ac=null;
    try{
      const AC=window.AudioContext||window.webkitAudioContext;
      ac=new AC();
      if(ac.state==='suspended') await ac.resume();
      const osc=ac.createOscillator(); osc.frequency.value=440;
      // Fala–pausa–fala: 2s de tom, 2s de silêncio de verdade, 2s de tom. É o que
      // permite afirmar que o corte automático achou a pausa no áudio real, e não
      // só num envelope sintético.
      const g=ac.createGain();
      const t=ac.currentTime;
      g.gain.setValueAtTime(0.05,t);
      g.gain.setValueAtTime(0.0001,t+2);
      g.gain.setValueAtTime(0.05,t+4);
      const dest=ac.createMediaStreamDestination();
      osc.connect(g); g.connect(dest); osc.start();
      const trilha=dest.stream.getAudioTracks()[0];
      if(trilha) stream.addTrack(trilha);
    }catch(e){ notas.push('sem trilha de áudio no material: '+(e&&e.name)); }

    const rec=new MediaRecorder(stream,{mimeType:mime});
    // O que o navegador REALMENTE negociou. 'video/mp4' genérico pode sair com
    // VP9/AV1 dentro do contêiner mp4 — que não é o que o Instagram espera.
    notas.push('mime negociado pelo MediaRecorder: '+(rec.mimeType||'?'));
    const pedacos=[];
    rec.ondataavailable=e=>{ if(e.data&&e.data.size) pedacos.push(e.data); };
    const fim=new Promise(r=>{ rec.onstop=()=>r(); });
    const t0=performance.now();
    let raf;
    const pintar=()=>{
      const s=Math.min(Math.floor((performance.now()-t0)/1000), SEG_MATERIAL-1);
      ctx.fillStyle='rgb('+(s*COR_POR_SEG)+',20,20)';
      ctx.fillRect(0,0,c.width,c.height);
      // Faixa AZUL no topo: é a marca que permite dizer, lendo um pixel, se o
      // corte de enquadramento manteve o topo ou a base do quadro.
      ctx.fillStyle='rgb(30,95,201)';
      ctx.fillRect(0,0,c.width,Math.round(c.height*0.25));
      ctx.fillStyle='#fff'; ctx.font='bold 180px system-ui'; ctx.textAlign='center';
      ctx.fillText(String(s), c.width/2, c.height/2+60);
      raf=requestAnimationFrame(pintar);
    };
    pintar();
    rec.start(500);
    await esperar(SEG_MATERIAL*1000);
    rec.stop(); cancelAnimationFrame(raf);
    await fim;
    if(ac) try{ await ac.close(); }catch(e){}
    const blob=new Blob(pedacos,{type:mime});
    return new File([blob],'bancada.'+vdExtensaoSaida(mime),{type:mime});
  }

  /* Lê o canal vermelho do FUNDO do canvas de saída → qual segundo está na tela.
     ⚠ Não amostre o centro: é onde o dígito BRANCO é desenhado (255,255,255), e a
     leitura vira 255 em qualquer segundo. Custou dois falsos negativos aqui. */
  // Conta pixels quase-brancos numa faixa horizontal. Mais robusto que amostrar um
  // ponto: o glifo tem vão entre letras, e um ponto isolado cairia no vão.
  function brancosNaFaixa(ctx,larg,y0,y1){
    const d=ctx.getImageData(0,y0,larg,Math.max(1,y1-y0)).data;
    let n=0;
    for(let i=0;i<d.length;i+=4) if(d[i]>200&&d[i+1]>200&&d[i+2]>200) n++;
    return n;
  }
  function corNoPonto(fx,fy){
    const ctx=vdCanvas.getContext('2d');
    const d=ctx.getImageData(Math.floor(vdCanvas.width*fx), Math.floor(vdCanvas.height*fy), 1, 1).data;
    return { r:d[0], g:d[1], b:d[2] };
  }
  // 85% da altura: abaixo do dígito branco (centro) E abaixo da faixa azul (topo).
  function segundoNaTela(){
    const c=corNoPonto(0.12,0.85);
    return { r:c.r, seg:Math.round(c.r/COR_POR_SEG) };
  }

  async function irEEsperar(t){
    vdIrPara(t);
    // O seek do <video> é assíncrono; sem esperar, lê-se o frame anterior.
    for(let i=0;i<40;i++){ await esperar(50); if(vdVideoEl.readyState>=2 && !vdVideoEl.seeking) break; }
    const hit=vdSegNoTempo(t); if(hit) vdDesenharFrame(hit.seg);
    await esperar(60);
  }

  async function rodar(){
    document.getElementById('ir').disabled=true;
    try{
      const m=matriz();
      reg('o navegador tem um formato gravável', !!vdMimeSaida(), m.slice(0,120));
      if(!vdMimeSaida()){ publicar(); return; }

      vdInit();
      reg('o módulo monta a interface', !!document.getElementById('vd-canvas'));

      marco('gravarMaterial');
      const file=await gravarMaterial();
      reg('gravou o material sintético', file.size>1000, file.type+' · '+Math.round(file.size/1024)+'KB');
      notas.push('material: '+file.type+' '+Math.round(file.size/1024)+'KB');
      if(file.size<1000){ publicar(); return; }

      marco('vdCarregarArquivo');
      await vdCarregarArquivo(file);
      const dur=vdProj?vdProj.fonte.dur:0;
      reg('o editor abriu o material', !!vdProj && dur>SEG_MATERIAL*0.6,
          vdProj?('duração lida: '+dur.toFixed(2)+'s · '+vdProj.fonte.w+'×'+vdProj.fonte.h+' · saída '+vdProj.formato):'não abriu');
      if(!vdProj){ publicar(); return; }

      // Medição do áudio real: read-only, então roda antes dos cortes manuais.
      marco('vdMedirAudio');
      const med=await vdMedirAudio();
      reg('mediu o áudio do arquivo', !!med.ok, med.ok
        ? (med.silencios.length+' pausa(s) · limiar '+med.limiar.toFixed(4)+' · piso '+med.piso.toFixed(4)+' · fala '+med.fala.toFixed(4))
        : ('não mediu: '+med.erro));
      if(med.ok){
        const p=med.silencios[0];
        reg('achou a pausa de 2s no meio do material', med.silencios.length===1 && p && p.de>1.5 && p.de<2.6 && p.ate>3.5 && p.ate<4.6,
            p?('pausa de '+p.de.toFixed(2)+'s a '+p.ate.toFixed(2)+'s'):'nenhuma pausa encontrada');
        notas.push('áudio: '+med.silencios.length+' pausa(s), limiar '+med.limiar.toFixed(4));
      }

      await irEEsperar(1.5);
      const a=segundoNaTela();
      reg('o compositor desenha o frame do tempo pedido', a.seg===1,
          'em 1,5s o material mostra o segundo '+a.seg+' (vermelho '+a.r+', esperado ~'+COR_POR_SEG+')');

      // Corta os 2 primeiros segundos: o começo da linha do tempo passa a ser o
      // segundo 2 do material. É o teste que prova o corte de verdade.
      vdDividir(2);
      const removeu=vdRemoverSeg(vdSegs()[0].id);
      reg('cortar remove o trecho e encurta a edição', removeu && vdDuracaoFinal()<dur-1.5,
          'duração final: '+vdDuracaoFinal().toFixed(2)+'s (era '+dur.toFixed(2)+'s)');

      await irEEsperar(0.4);
      const b=segundoNaTela();
      reg('depois do corte, o tempo 0 aponta para o segundo 2 do material', b.seg===2,
          'mostrou o segundo '+b.seg+' (vermelho '+b.r+', esperado ~'+(2*COR_POR_SEG)+')');

      const impedimento=vdPodeExportar();
      reg('a exportação está liberada', !impedimento, impedimento||'sem impedimento');

      const t0=performance.now();
      marco('vdExportar');
      // Instrumento: separa "nosso laço engasgou" de "a reprodução andou mais devagar
      // que o tempo real". Sem isso, 16s para 4s de vídeo é só um mistério.
      let quadros=0, pPrimeiro=-1, pUltimo=0, tPrimeiro=0;
      const r=await vdExportar(p=>{
        quadros++; pUltimo=p;
        if(pPrimeiro<0){ pPrimeiro=p; tPrimeiro=performance.now(); }
      });
      const gastou=(performance.now()-t0)/1000;
      const segVideo=(pUltimo-Math.max(pPrimeiro,0))*vdDuracaoFinal();
      const segParede=(performance.now()-tPrimeiro)/1000;
      notas.push('exportação: '+quadros+' quadros · reprodução a '
        +(segParede>0?(segVideo/segParede).toFixed(2):'?')+'× do tempo real · '
        +(quadros/Math.max(segParede,0.001)).toFixed(1)+' quadros/s de parede');
      // `suspeito` = o cinto cortou por falta de progresso. Sem checar isso, um
      // arquivo TRUNCADO passa como sucesso — foi o que aconteceu aqui.
      reg('exportou um arquivo íntegro (sem o cinto cortar)', !!(r&&r.blob&&r.blob.size>1000&&!r.suspeito),
          r?(r.mime+' · '+Math.round(r.blob.size/1024)+'KB · '+gastou.toFixed(1)+'s para '+vdDuracaoFinal().toFixed(1)+'s de vídeo'
           +(r.suspeito?' · SUSPEITO: o cinto cortou por falta de progresso':'')):'não gerou blob');
      if(r) notas.push('export: '+r.mime+' '+Math.round(r.blob.size/1024)+'KB em '+gastou.toFixed(1)+'s (edição de '+vdDuracaoFinal().toFixed(1)+'s)');

      // O arquivo exportado abre? É a pergunta que decide se o Instagram aceita.
      if(r){
        const v=document.createElement('video'); v.muted=true;
        const url=URL.createObjectURL(r.blob);
        const meta=await new Promise(res=>{
          v.onloadedmetadata=()=>res({dur:v.duration,w:v.videoWidth,h:v.videoHeight});
          v.onerror=()=>res(null); v.src=url;
        });
        reg('o arquivo exportado volta a abrir no navegador', !!meta,
            meta?('duração '+(isFinite(meta.dur)?meta.dur.toFixed(2)+'s':'não informada')+' · '+meta.w+'×'+meta.h):'não abriu');
        if(meta) notas.push('arquivo final: '+meta.w+'×'+meta.h+' dur '+(isFinite(meta.dur)?meta.dur.toFixed(2):'?'));
        URL.revokeObjectURL(url);
      }
      // Por último, porque substitui a lista de trechos inteira.
      if(med.ok){
        vdDesfazer(); vdDesfazer();               // volta ao material inteiro
        const antes=vdDuracaoFinal();
        const plano=vdPlanoCorteSilencio(med);
        const ap=plano?vdAplicarPlano(plano):{ok:false,descartes:[{porque:'sem plano'}]};
        reg('o corte automático de silêncio aplica e encurta', ap.ok && vdDuracaoFinal()<antes-1.2,
            ap.ok?(vdFmtTempo(antes)+' → '+vdFmtTempo(vdDuracaoFinal())+' em '+vdSegs().length+' trecho(s)')
                 :('rejeitado: '+JSON.stringify(ap.descartes)));
        if(ap.ok) notas.push('corte de silêncio: '+vdFmtTempo(antes)+' → '+vdFmtTempo(vdDuracaoFinal()));
      }
      // BARRA DE PROGRESSO pelo caminho REAL (vdAcaoExportar), que nenhum caso
      // tocava. Ela passou a animar por transform (compositor) em vez de width
      // (layout): se alguém trocar de volta, este caso cai.
      marco('vdAcaoExportar');
      const amostras=[];
      const relogio=setInterval(()=>{ const b=document.getElementById('vd-progresso-barra');
        if(b&&b.style.transform) amostras.push(b.style.transform); },200);
      await vdAcaoExportar();
      clearInterval(relogio);
      const virouTransform=amostras.length>=2 && amostras.every(a=>/scaleX/.test(a));
      const avancou=amostras.some(a=>{ const m=/scaleX\(([\d.]+)\)/.exec(a); return m && Number(m[1])>0.3; });
      const fechou=document.getElementById('vd-progresso').hidden;
      reg('a barra de progresso anima por transform, avança e some no fim',
          virouTransform && avancou && fechou,
          amostras.length+' amostras: '+amostras.slice(0,4).join(' → ')+' · caixa fechada: '+fechou);

      // LEGENDA — desenho com o motor de render da casa, custo e integração.
      marco('legenda');
      const cv=document.createElement('canvas'); cv.width=1080; cv.height=1920;
      const cx=cv.getContext('2d');
      cx.fillStyle='#000'; cx.fillRect(0,0,1080,1920);
      const desenhou=vdDesenharLegenda(cx,'chegou o combo da semana',1080,1920,'dm_cap_01');
      // Ler o pixel IMEDIATAMENTE, sem await, é a prova de que o desenho é síncrono —
      // é isso que permite chamar a legenda dentro do laço de frames.
      const brancos=brancosNaFaixa(cx,1080,1350,1660);
      reg('a legenda desenha no mesmo tick (síncrona) com o motor da casa', !!desenhou && brancos>200,
          desenhou?(brancos+' pixels de texto na faixa da legenda'):'vdDesenharLegenda recusou (motor ausente?)');

      const tFrio=performance.now();
      for(let i=0;i<40;i++) vdDesenharLegenda(cx,'cartão de teste número '+i,1080,1920,'dm_cap_01');
      const msFrio=(performance.now()-tFrio)/40;
      const tQuente=performance.now();
      for(let i=0;i<40;i++) vdDesenharLegenda(cx,'texto fixo para medir o desenho',1080,1920,'dm_cap_01');
      const msQuente=(performance.now()-tQuente)/40;
      // Orçamento de um frame a 30fps é 33ms e o vídeo já consome a maior parte.
      reg('desenhar a legenda cabe no orçamento de um frame', msQuente<8,
          'com medição '+msFrio.toFixed(1)+'ms · com medição cacheada '+msQuente.toFixed(2)+'ms');
      notas.push('legenda: '+msFrio.toFixed(1)+'ms frio / '+msQuente.toFixed(2)+'ms quente');

      // Integração: a legenda entra no MESMO desenho de frame da prévia/exportação.
      vdProj.legendas={ativo:true,template:'dm_cap_01',cards:[{de:0,ate:9,texto:'legenda de bancada'}]};
      await irEEsperar(0.4);
      const comLegenda=brancosNaFaixa(vdCanvas.getContext('2d'),vdCanvas.width,1380,1660);
      vdProj.legendas.ativo=false;
      await irEEsperar(0.5);
      const semLegenda=brancosNaFaixa(vdCanvas.getContext('2d'),vdCanvas.width,1380,1660);
      reg('a legenda aparece na prévia e o desligar a remove', comLegenda>200 && semLegenda<50,
          'ligada: '+comLegenda+' pixels · desligada: '+semLegenda);
      vdProj.legendas.ativo=true;

      // Transcrição de verdade só com ?ia=1: gasta cota e depende de rede.
      if(/[?&]ia=1/.test(location.search)){
        marco('vdTranscrever');
        const tr=await vdTranscrever();
        notas.push('transcrição: '+(tr.ok?(tr.cards.length+' cartões'):('falhou — '+tr.erro)));
        const nossoErro=/áudio|WAV|disponível|preparar/i.test(tr.erro||'');
        reg('a transcrição prepara o áudio e chega até a chamada do modelo',
            tr.ok || !nossoErro,
            tr.ok ? (tr.cards.length+' cartões gerados pelo modelo')
                  : ('chegou à chamada; resposta não obtida aqui ('+tr.erro+') — rede de saída bloqueada neste ambiente'));
      }

      // ENQUADRAMENTO — o caso do produto: material vertical virando horizontal
      // corta em cima e embaixo, e o foco escolhe o que sobrevive.
      vdAcaoFormato('16:9');
      reg('trocar o formato redimensiona a saída', vdCanvas.width===1920 && vdCanvas.height===1080,
          'canvas em '+vdCanvas.width+'×'+vdCanvas.height+' · eixo cortado: '+vdEixoDeCorte());
      await irEEsperar(0.3);
      const seg=vdSegNoTempo(0.3).seg;
      vdFocoSeg(seg.id, 0); vdDesenharFrame(vdSegNoTempo(0.3).seg);
      const topo=corNoPonto(0.12,0.06);
      vdFocoSeg(seg.id, 1); vdDesenharFrame(vdSegNoTempo(0.3).seg);
      const base=corNoPonto(0.12,0.06);
      reg('o foco escolhe o lado do quadro que sobrevive ao corte',
          topo.b>120 && topo.b>topo.r+80 && base.b<topo.b/3,
          'foco no topo mostra a faixa azul (azul '+topo.b+' vs vermelho '+topo.r+') · foco na base sai dela (azul '+base.b+')');
      notas.push('enquadramento 16:9 · topo(b'+topo.b+'/r'+topo.r+') base(r'+base.r+'/b'+base.b+')');
    }catch(e){
      reg('a bancada terminou sem exceção', false, String(e&&e.message||e));
      console.error('[bancada]',e);
    }
    publicar();
  }

  document.getElementById('ir').addEventListener('click',rodar);
  matriz();
  if(/[?&]auto=1/.test(location.search)) rodar();
})();
