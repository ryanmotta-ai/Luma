/**
 * js/video/ingest.js
 *
 * LEITURA DO MATERIAL e MOTOR DE REGRAS — a parte que corta sozinha SEM IA.
 *
 * A divisão do plano (docs/LUMA-VIDEO.md §4.3): precisão temporal é nossa,
 * semântica é do modelo. Silêncio, volume e duração são matemática — medir aqui
 * é exato, instantâneo e de graça. Perguntar a um LLM "onde tem pausa" seria
 * pagar para receber um chute pior.
 *
 * A SAÍDA É UM EditPlan, o mesmo contrato que a IA vai devolver. Não é enfeite:
 * assim o validador, o histórico e o caminho até a timeline são UM só, e o dia
 * em que o modelo entrar não inventa um segundo caminho de aplicação.
 *
 * As duas funções de decisão (`vdSilenciosDoEnvelope`, `vdManterSemSilencio`)
 * são PURAS — recebem números, devolvem números. É o que permite testá-las em
 * tests/video-edl.html sem áudio de verdade.
 *
 * Depende de: video/projeto.js, video/video.js (vdFonte), core/toast.js.
 */

/* Janela de medição. 50ms é o compromisso da casa: fino o bastante para achar a
   borda da fala, grosso o bastante para não confundir o intervalo entre sílabas
   com pausa. */
const VD_JANELA_SEG = 0.05;
/* Pausa mínima que vale cortar. Abaixo de ~0,8s o corte fica com cara de
   engasgo — o ritmo da fala precisa do respiro curto. */
const VD_SILENCIO_MIN = 0.8;
/* Respiro deixado nas bordas. Cortar exatamente onde a fala começa come a
   consoante inicial ("...bo" em vez de "combo") — 120ms resolve. */
const VD_RESPIRO = 0.12;
/* Piso absoluto de amplitude: abaixo disto é silêncio digital, não importa o
   piso de ruído da gravação. */
const VD_RMS_ABS = 0.004;
/* Pedaço de fala menor que isto não é fala: é clique, batida de mesa, resto. */
const VD_FALA_MIN = 0.25;

/**
 * Onde estão as pausas, a partir do envelope de energia.
 *
 * O limiar é ADAPTATIVO de propósito: gravação de celular em cozinha tem chão de
 * ruído alto, e um limiar fixo em -45dB acharia silêncio zero ali e silêncio
 * demais numa gravação limpa. Piso = percentil 10, fala = percentil 90, limiar =
 * 12dB acima do piso — com teto na metade do nível de fala para material que
 * simplesmente não tem pausa.
 *
 * FUNÇÃO PURA (testável sem áudio).
 * @param {Float32Array|number[]} rms  energia por janela
 * @param {number} janelaSeg  duração de cada janela em segundos
 * @returns {{silencios:Array<{de:number,ate:number}>, limiar:number, piso:number, fala:number}}
 */
function vdSilenciosDoEnvelope(rms, janelaSeg, opts){
  opts = opts || {};
  const minDur = opts.minDur != null ? opts.minDur : VD_SILENCIO_MIN;
  const n = rms.length;
  if(!n) return { silencios:[], limiar:0, piso:0, fala:0 };

  const ord = Array.prototype.slice.call(rms).sort((a, b) => a - b);
  const piso = ord[Math.floor(n * 0.10)];
  const fala = ord[Math.floor(n * 0.90)];
  let limiar = Math.max(piso * 4, VD_RMS_ABS);
  // Material sem pausa nenhuma: o piso já é quase o nível da fala, e 12dB acima
  // dele engoliria a fala inteira. Segurar na metade da fala evita "cortei tudo".
  if(limiar > fala * 0.5) limiar = Math.max(fala * 0.5, VD_RMS_ABS);

  const silencios = [];
  let inicio = -1;
  for(let i = 0; i < n; i++){
    const quieto = rms[i] < limiar;
    if(quieto && inicio < 0) inicio = i;
    if(!quieto && inicio >= 0){
      const de = inicio * janelaSeg, ate = i * janelaSeg;
      if(ate - de >= minDur) silencios.push({ de, ate });
      inicio = -1;
    }
  }
  if(inicio >= 0){
    const de = inicio * janelaSeg, ate = n * janelaSeg;
    if(ate - de >= minDur) silencios.push({ de, ate });
  }
  return { silencios, limiar, piso, fala };
}

/**
 * Inverte as pausas em trechos a MANTER, com respiro nas bordas.
 * FUNÇÃO PURA (testável sem áudio).
 * @returns {Array<{de:number,ate:number}>}
 */
function vdManterSemSilencio(silencios, dur, opts){
  opts = opts || {};
  const respiro = opts.respiro != null ? opts.respiro : VD_RESPIRO;
  const minFala = opts.minFala != null ? opts.minFala : VD_FALA_MIN;
  const manter = [];
  let cursor = 0;
  for(const s of (silencios || [])){
    const de = Math.max(0, Math.min(s.de, dur));
    const ate = Math.max(de, Math.min(s.ate, dur));
    // O trecho antes da pausa ganha respiro para dentro dela; como a pausa tem
    // pelo menos VD_SILENCIO_MIN (> 2×respiro), os dois lados nunca se cruzam —
    // é o que garante que o validador não veja sobreposição.
    const fim = Math.min(de + respiro, ate);
    if(fim - cursor >= minFala) manter.push({ de: cursor, ate: fim });
    cursor = Math.max(ate - respiro, de);
  }
  if(dur - cursor >= minFala) manter.push({ de: cursor, ate: dur });
  return manter;
}

/**
 * Mede o áudio do arquivo carregado. Guarda o resultado em `vdProj.audio` — a
 * medição é caríssima em relação ao resto (decodifica o áudio inteiro), então
 * roda uma vez por arquivo.
 *
 * ⚠ 16kHz de propósito: `new AudioContext({sampleRate:16000})` faz o navegador
 * reamostrar na decodificação. Para energia por janela isso é de sobra, e derruba
 * a memória de ~70MB (48kHz estéreo, 3 min) para ~11MB.
 *
 * @returns {Promise<{ok:boolean, erro?:string, silencios?:Array, dur?:number}>}
 */
async function vdMedirAudio(){
  if(vdProj && vdProj.audio) return vdProj.audio;
  if(!vdFonte || !vdFonte.file) return { ok:false, erro:'nenhum vídeo carregado' };
  let ctx = null;
  try{
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return { ok:false, erro:'este navegador não sabe ler áudio' };
    ctx = new AC({ sampleRate:16000 });
    const bytes = await vdFonte.file.arrayBuffer();
    const buf = await ctx.decodeAudioData(bytes);
    const dados = buf.getChannelData(0);          // mono basta: energia, não mixagem
    const porJanela = Math.max(1, Math.round(buf.sampleRate * VD_JANELA_SEG));
    const total = Math.floor(dados.length / porJanela);
    const rms = new Float32Array(total);
    for(let j = 0; j < total; j++){
      let soma = 0;
      const base = j * porJanela;
      for(let i = 0; i < porJanela; i++){ const v = dados[base + i]; soma += v * v; }
      rms[j] = Math.sqrt(soma / porJanela);
    }
    const r = vdSilenciosDoEnvelope(rms, VD_JANELA_SEG);
    const res = { ok:true, silencios:r.silencios, limiar:r.limiar, piso:r.piso, fala:r.fala,
                  dur:buf.duration, janelas:total };
    if(vdProj) vdProj.audio = res;
    return res;
  }catch(e){
    // Caso real: MOV cujo áudio o navegador não decodifica. Falha honesta, sem
    // segundo motor de análise inventado agora (ver docs/LUMA-VIDEO.md §0).
    return { ok:false, erro:(e && e.name === 'EncodingError') ? 'o navegador não decodifica o áudio deste arquivo' : 'não consegui ler o áudio' };
  }finally{
    if(ctx) try{ await ctx.close(); }catch(e){}
  }
}

/**
 * O plano de edição do motor de regras — MESMO formato que a IA devolve, para
 * passar pelo mesmo validador (`vdValidarPlano`) e pelo mesmo histórico.
 * @returns {object|null} EditPlan, ou null se não há o que cortar
 */
function vdPlanoCorteSilencio(medicao){
  if(!medicao || !medicao.ok || !medicao.silencios.length) return null;
  const dur = (vdProj && vdProj.fonte.dur) || medicao.dur || 0;
  const manter = vdManterSemSilencio(medicao.silencios, dur);
  if(!manter.length) return null;
  const perdido = dur - manter.reduce((t, m) => t + (m.ate - m.de), 0);
  return { acoes:[{
    tipo:'segmentos', manter,
    motivo: 'remove ' + medicao.silencios.length + ' pausa(s), ' + vdFmtTempo(perdido) + ' de silêncio'
  }] };
}
