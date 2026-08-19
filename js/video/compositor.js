/**
 * js/video/compositor.js
 *
 * O COMPOSITOR — desenha o projeto num canvas, frame por frame. É o mesmo
 * caminho para a PRÉVIA e para a EXPORTAÇÃO: quem exporta é o mesmo laço que
 * quem mostra, só com um MediaRecorder pendurado no canvas. Dois caminhos
 * divergiriam, e "a prévia não bate com o arquivo final" é o defeito que este
 * projeto mais evita (03_ENGINEERING §5).
 *
 * Como o corte acontece sem FFmpeg: o corte é `currentTime = próximo trecho`.
 * Durante o salto o gravador fica em pause() e volta no evento `seeked` — é o
 * que dá corte sem remendo de arquivo e sem muxer.
 *
 * ⚠ ARMADILHA DE ORIGEM: desenhar no canvas um <video> de outra origem
 * CONTAMINA o canvas e `captureStream` para de funcionar (exportação morre com
 * o canvas em branco). Por isso toda fonte entra como `blob:` da mesma origem
 * (ver vdCarregarArquivo em video.js). Asset que um dia vier do Storage precisa
 * ser BAIXADO como Blob antes, nunca apontado por URL.
 *
 * Depende de: video/projeto.js (o EDL), core/toast.js (gToast).
 */

/* Saída por formato. O canvas trabalha na resolução final — o que se vê na tela
   é só CSS. 9:16 é o formato do Reels, que é o caso de uso. */
const VD_FORMATOS = { '9:16':[1080,1920], '1:1':[1080,1080], '16:9':[1920,1080] };
/* Teto de saída (decisão de produto): a exportação roda em TEMPO REAL, então
   90s de vídeo custam 90s de máquina. Acima disso o usuário acha que travou. */
const VD_MAX_SAIDA_SEG = 90;
const VD_FPS_SAIDA = 30;

let vdCanvas = null;        // canvas de saída (resolução final)
let vdVideoEl = null;       // <video> da fonte (escondido)
let _vdCtx = null;
let _vdIdx = 0;             // índice do segmento em execução
let _vdTocando = false;
let _vdLaco = null;         // id do requestVideoFrameCallback/rAF em voo
let _vdAoTempo = null;      // callback de UI a cada frame (playhead)
let _vdAoFim = null;

// Áudio: um grafo só, criado no primeiro gesto do usuário (AudioContext exige
// gesto). O <video> é a fonte; sai no alto-falante E numa trilha para gravar.
let _vdAudioCtx = null, _vdAudioSrc = null, _vdAudioDest = null;

// Exportação
let _vdRec = null, _vdPedacos = [], _vdExportando = false, _vdExportSuspeito = false;

/* ── MONTAGEM ────────────────────────────────────────────────────────── */

function vdCompositorMontar(canvas, video){
  vdCanvas = canvas; vdVideoEl = video;
  _vdCtx = canvas.getContext('2d', { alpha:false });
  _vdCtx.imageSmoothingEnabled = true;
  _vdCtx.imageSmoothingQuality = 'high';
  vdAjustarSaida();
}

function vdTamanhoSaida(){
  const f = (vdProj && vdProj.formato) || '9:16';
  return VD_FORMATOS[f] || VD_FORMATOS['9:16'];
}

function vdAjustarSaida(){
  if(!vdCanvas) return;
  const [W, H] = vdTamanhoSaida();
  if(vdCanvas.width !== W || vdCanvas.height !== H){ vdCanvas.width = W; vdCanvas.height = H; }
}

function vdCompositorCallbacks(aoTempo, aoFim){ _vdAoTempo = aoTempo; _vdAoFim = aoFim; }

/**
 * Troca o formato de saída. Redimensionar o canvas APAGA o conteúdo, então
 * redesenhar aqui não é zelo — sem isso a prévia fica preta até o próximo frame.
 */
function vdMudarFormato(f){
  if(!vdProj || !VD_FORMATOS[f] || vdProj.formato === f) return false;
  vdProj.formato = f;
  vdRegistrar('formato ' + f);
  vdAjustarSaida();
  const hit = vdSegNoTempo(vdTempoLinha());
  if(hit) vdDesenharFrame(hit.seg);
  return true;
}

/* ── DESENHO ─────────────────────────────────────────────────────────── */

/**
 * Onde o frame da fonte cai na saída — cover + zoom + FOCO, sem distorcer nunca.
 *
 * O foco existe porque o caso real da DM é vídeo gravado na horizontal virando
 * Reels vertical: o corte joga fora 60% da largura, e centralizar às cegas corta
 * justamente o produto quando ele não está no meio do quadro. `foco` de 0 a 1
 * escolhe o lado que sobrevive (0,5 = centro = comportamento antigo).
 *
 * FUNÇÃO PURA (testável sem canvas nem vídeo).
 * @returns {{dx:number,dy:number,dw:number,dh:number,escala:number,eixo:('x'|'y'|null)}}
 */
function vdEnquadrar(vw, vh, W, H, zoom, foco){
  const z = zoom > 0 ? zoom : 1;
  const f = (foco == null || !isFinite(foco)) ? 0.5 : Math.min(Math.max(foco, 0), 1);
  const escala = Math.max(W / vw, H / vh) * z;
  const dw = vw * escala, dh = vh * escala;
  // Sobra só existe no eixo que estourou; no outro, (W-dw) é ~0 e o foco não
  // muda nada — por isso um número só resolve os dois casos.
  const sobraX = W - dw, sobraY = H - dh;
  const eixo = sobraX < -0.5 ? 'x' : (sobraY < -0.5 ? 'y' : null);
  return { dx: sobraX * (eixo === 'x' ? f : 0.5), dy: sobraY * (eixo === 'y' ? f : 0.5),
           dw, dh, escala, eixo };
}

/** Qual eixo está sendo cortado com o formato atual. null = nada sobra. */
function vdEixoDeCorte(){
  if(!vdProj || !vdCanvas) return null;
  const vw = vdProj.fonte.w, vh = vdProj.fonte.h;
  if(!vw || !vh) return null;
  return vdEnquadrar(vw, vh, vdCanvas.width, vdCanvas.height, 1, 0.5).eixo;
}

function vdDesenharFrame(seg){
  if(!_vdCtx || !vdVideoEl) return;
  const W = vdCanvas.width, H = vdCanvas.height;
  const vw = vdVideoEl.videoWidth, vh = vdVideoEl.videoHeight;
  _vdCtx.fillStyle = '#000';
  _vdCtx.fillRect(0, 0, W, H);
  if(!vw || !vh) return;
  const q = vdEnquadrar(vw, vh, W, H, (seg && seg.zoom) || 1, seg && seg.foco);
  try{ _vdCtx.drawImage(vdVideoEl, q.dx, q.dy, q.dw, q.dh); }
  catch(e){ /* frame ainda não decodificado: o próximo callback desenha */ }
}

/** Tempo atual na LINHA DO TEMPO (o que o playhead mostra). */
function vdTempoLinha(){
  const segs = vdSegs();
  if(!segs.length || !vdVideoEl) return 0;
  const i = Math.min(_vdIdx, segs.length - 1);
  const dentro = Math.min(Math.max(vdVideoEl.currentTime - segs[i].de, 0), vdSegDur(segs[i]));
  return vdInicioLinha(i) + dentro;
}

/* ── TRANSPORTE (tocar / pausar / ir para) ───────────────────────────── */

function vdIrPara(tLinha){
  const hit = vdSegNoTempo(tLinha);
  if(!hit || !vdVideoEl) return;
  _vdIdx = hit.idx;
  _vdBuscar(hit.tFonte, () => { vdDesenharFrame(hit.seg); if(_vdAoTempo) _vdAoTempo(vdTempoLinha()); });
}

/** Seek com callback quando o frame novo está na tela.
 *
 *  Dois detalhes que custaram bug:
 *  1. Se o tempo já bate, NÃO há seek e 'seeked' nunca vem.
 *  2. 'seeked' não é garantia universal (tempo idêntico, arquivo sem índice), por
 *     isso o cinto de 700ms: sem ele a prévia fica no frame anterior pra sempre.
 *  Durante a exportação o gravador fica em pause() no salto — é o que evita o
 *  pedaço de vídeo velho entrar no corte. */
function _vdBuscar(tFonte, depois){
  if(!vdVideoEl) return;
  if(Math.abs(vdVideoEl.currentTime - tFonte) < VD_TOL && vdVideoEl.readyState >= 2){
    if(depois) depois();
    return;
  }
  const gravando = _vdExportando && _vdRec && _vdRec.state === 'recording';
  if(gravando){ try{ _vdRec.pause(); }catch(e){} }
  let feito = false;
  let cinto = 0;
  const aoBuscar = () => {
    if(feito) return;
    feito = true;
    clearTimeout(cinto);
    vdVideoEl.removeEventListener('seeked', aoBuscar);
    if(_vdExportando && _vdRec && _vdRec.state === 'paused'){ try{ _vdRec.resume(); }catch(e){} }
    if(depois) depois();
  };
  vdVideoEl.addEventListener('seeked', aoBuscar);
  cinto = setTimeout(aoBuscar, 700);
  try{ vdVideoEl.currentTime = tFonte; }
  catch(e){ aoBuscar(); }
}

function _vdGrafoAudio(){
  if(_vdAudioCtx) return;
  try{
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC || !vdVideoEl) return;
    _vdAudioCtx = new AC();
    _vdAudioSrc = _vdAudioCtx.createMediaElementSource(vdVideoEl);
    _vdAudioDest = _vdAudioCtx.createMediaStreamDestination();
    // Sai nos dois: alto-falante (prévia) e trilha (gravação). Sem o destination
    // o usuário exporta um vídeo mudo sem entender por quê.
    _vdAudioSrc.connect(_vdAudioCtx.destination);
    _vdAudioSrc.connect(_vdAudioDest);
  }catch(e){ _vdAudioCtx = null; _vdAudioSrc = null; _vdAudioDest = null; }
}

function vdTocando(){ return _vdTocando; }

async function vdTocar(){
  if(!vdVideoEl || !vdSegs().length || _vdTocando) return;
  _vdGrafoAudio();
  if(_vdAudioCtx && _vdAudioCtx.state === 'suspended'){ try{ await _vdAudioCtx.resume(); }catch(e){} }
  // Chegou no fim? tocar volta pro começo, como qualquer player.
  if(vdTempoLinha() >= vdDuracaoFinal() - VD_TOL) vdIrPara(0);
  _vdTocando = true;
  try{ await vdVideoEl.play(); }catch(e){ _vdTocando = false; return; }
  _vdAgendar();
}

function vdPausar(){
  _vdTocando = false;
  if(vdVideoEl) try{ vdVideoEl.pause(); }catch(e){}
}

/* O laço prefere requestVideoFrameCallback: ele dispara UMA vez por frame
   decodificado, então não desenha frame repetido nem perde frame quando o
   monitor e o vídeo têm taxas diferentes. rAF é o plano B. */
function _vdAgendar(){
  if(!_vdTocando || !vdVideoEl) return;
  if(vdVideoEl.requestVideoFrameCallback) _vdLaco = vdVideoEl.requestVideoFrameCallback(_vdFrame);
  else _vdLaco = requestAnimationFrame(_vdFrame);
}

function _vdFrame(){
  if(!_vdTocando) return;
  const segs = vdSegs();
  const seg = segs[Math.min(_vdIdx, segs.length - 1)];
  if(!seg){ _vdFinalizar(); return; }
  // Passou do fim do trecho: salta para o próximo (ou termina).
  if(vdVideoEl.currentTime >= seg.ate - VD_TOL){
    if(_vdIdx + 1 >= segs.length){ _vdFinalizar(); return; }
    _vdIdx++;
    const prox = segs[_vdIdx];
    _vdBuscar(prox.de, () => { if(_vdTocando) _vdAgendar(); });
    return;   // o próximo frame vem depois do seek
  }
  vdDesenharFrame(seg);
  if(_vdAoTempo) _vdAoTempo(vdTempoLinha());
  _vdAgendar();
}

function _vdFinalizar(){
  _vdTocando = false;
  if(vdVideoEl) try{ vdVideoEl.pause(); }catch(e){}
  if(_vdAoFim) _vdAoFim();
}

/* ── EXPORTAÇÃO ──────────────────────────────────────────────────────── */

/** Primeiro contêiner que o navegador REALMENTE grava, na ordem que serve a quem
 *  vai postar: mp4 com H.264 é o que o Instagram aceita sem conversão.
 *
 *  ⚠ MEDIDO NA BANCADA (tests/_video-bancada.html): 'video/mp4' SEM codec
 *  explícito responde `true` em navegador que não tem H.264 nenhum — e sai um mp4
 *  com VP9/AV1 dentro, que a rede recusa igual. Por isso o mp4 genérico ficou
 *  DEPOIS do webm explícito: entre um mp4 de codec desconhecido e um webm que eu
 *  sei o que é, o segundo é mais honesto com o usuário. */
function vdMimeSaida(){
  const tentativas = [
    'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
    'video/mp4;codecs=avc1',
    'video/webm;codecs="vp9,opus"',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4'
  ];
  if(typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  return tentativas.find(t => MediaRecorder.isTypeSupported(t)) || '';
}

function vdExtensaoSaida(mime){ return /mp4/i.test(mime) ? 'mp4' : 'webm'; }

/** O contêiner é mp4 COM H.264? É o que decide se o arquivo serve pro Instagram
 *  sem conversão — e é o que o aviso ao usuário precisa dizer. */
function vdSaidaEhH264(){
  const m = vdMimeSaida();
  return /mp4/i.test(m) && /avc1/i.test(m);
}

/** O navegador aguenta exportar? Devolve o motivo em PT-BR quando não. */
function vdPodeExportar(){
  if(!vdProj || !vdSegs().length) return 'Carregue um vídeo primeiro.';
  if(typeof MediaRecorder === 'undefined' || !vdCanvas || !vdCanvas.captureStream) return 'Este navegador não grava vídeo. Use o Chrome no computador.';
  if(!vdMimeSaida()) return 'Este navegador não tem um formato de vídeo que o Luma consiga gravar.';
  if(vdDuracaoFinal() > VD_MAX_SAIDA_SEG) return 'A edição tem ' + vdFmtTempo(vdDuracaoFinal()) + '. Corte para até ' + VD_MAX_SAIDA_SEG + 's antes de exportar.';
  return '';
}

/**
 * Exporta em tempo real: toca a edição do começo ao fim gravando o canvas.
 * @param {function(number):void} aoProgresso  0..1
 * @returns {Promise<{blob:Blob,mime:string,ext:string,suspeito:boolean}|null>}
 */
function vdExportar(aoProgresso){
  return new Promise(resolve => {
    const impedimento = vdPodeExportar();
    if(impedimento){ if(typeof gToast==='function') gToast(impedimento, 'error'); resolve(null); return; }

    const mime = vdMimeSaida();
    const total = vdDuracaoFinal();
    _vdGrafoAudio();
    let stream;
    try{
      stream = vdCanvas.captureStream(VD_FPS_SAIDA);
      const trilha = _vdAudioDest && _vdAudioDest.stream.getAudioTracks()[0];
      if(trilha) stream.addTrack(trilha);
    }catch(e){
      if(typeof gToast==='function') gToast('Não consegui capturar o vídeo do canvas neste navegador.', 'error');
      resolve(null); return;
    }

    _vdPedacos = []; _vdExportSuspeito = false;
    let cinto = 0;   // declarado aqui porque `encerrar` (abaixo) o limpa
    try{ _vdRec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8e6 }); }
    catch(e){ if(typeof gToast==='function') gToast('Não consegui iniciar a gravação: ' + (e && e.name || 'erro'), 'error'); resolve(null); return; }

    // Aba oculta estrangula o laço de frames: o canvas congela e o arquivo sai
    // com pedaço parado. Não há como impedir — dá para AVISAR, e é o honesto.
    const aoVisibilidade = () => { if(document.hidden) _vdExportSuspeito = true; };
    document.addEventListener('visibilitychange', aoVisibilidade);

    const encerrar = () => {
      document.removeEventListener('visibilitychange', aoVisibilidade);
      clearTimeout(cinto);
      _vdExportando = false;
      try{ stream.getTracks().forEach(t => t.stop()); }catch(e){}
    };

    _vdRec.ondataavailable = e => { if(e.data && e.data.size) _vdPedacos.push(e.data); };
    _vdRec.onerror = () => { encerrar(); resolve(null); };
    _vdRec.onstop = () => {
      encerrar();
      const blob = new Blob(_vdPedacos, { type: mime });
      _vdPedacos = [];
      resolve(blob.size ? { blob, mime, ext: vdExtensaoSaida(mime), suspeito: _vdExportSuspeito } : null);
    };

    _vdExportando = true;
    // CINTO: se o laço de frames parar (decodificação travada, aba estrangulada), o
    // _vdAoFim nunca chega e esta promessa nunca resolve — o usuário fica com a
    // barra girando pra sempre. Teto generoso (2× a duração + 8s) para não cortar
    // exportação lenta legítima; ao estourar, entrega o que gravou e AVISA.
    const tetoMs = total * 1000 * 2 + 8000;
    cinto = setTimeout(() => {
      if(!_vdExportando) return;
      _vdExportSuspeito = true;
      try{ if(_vdRec && _vdRec.state !== 'inactive') _vdRec.stop(); }catch(e){}
    }, tetoMs);
    const antesAoTempo = _vdAoTempo, antesAoFim = _vdAoFim;
    _vdAoTempo = t => { if(aoProgresso && total) aoProgresso(Math.min(t / total, 1)); if(antesAoTempo) antesAoTempo(t); };
    _vdAoFim = () => {
      _vdAoTempo = antesAoTempo; _vdAoFim = antesAoFim;
      // Um tiquinho de folga antes de parar: o último frame precisa entrar no
      // arquivo, e o recorder trabalha em pedaços.
      setTimeout(() => { try{ if(_vdRec.state !== 'inactive') _vdRec.stop(); }catch(e){ encerrar(); resolve(null); } }, 250);
      if(antesAoFim) antesAoFim();
    };

    vdIrPara(0);
    // start() só depois do primeiro frame estar no canvas, senão o arquivo
    // começa com um quadro preto.
    setTimeout(() => {
      try{ _vdRec.start(1000); }catch(e){ encerrar(); resolve(null); return; }
      vdTocar();
    }, 120);
  });
}

function vdExportando(){ return _vdExportando; }
