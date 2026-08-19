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
      const r=await vdExportar(()=>{});
      const gastou=(performance.now()-t0)/1000;
      reg('exportou um arquivo com bytes', !!(r&&r.blob&&r.blob.size>1000),
          r?(r.mime+' · '+Math.round(r.blob.size/1024)+'KB · '+gastou.toFixed(1)+'s para '+vdDuracaoFinal().toFixed(1)+'s de vídeo'):'não gerou blob');
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
