/**
 * js/video/video.js
 *
 * O MÓDULO VÍDEO — a view, a entrada do arquivo, o transporte e a exportação.
 * Ponto de entrada: `vdInit()`, chamada por setMode('video') na primeira vez
 * (mesmo padrão lazy da Academia — main.js).
 *
 * DECISÕES DE PRODUTO já tomadas (docs/LUMA-VIDEO.md §14):
 *  · DESKTOP-ONLY — o gate abaixo de 1024px é CSS, igual ao do Estúdio.
 *  · Só equipe (gIsAdmin) — o franqueado não vê a aba, porque o celular dele não
 *    exporta. Rever quando a fase 0 medir iOS.
 *  · O vídeo NÃO sobe pra nuvem. Nada de Storage, nada de migration: o arquivo
 *    vive no navegador enquanto a aba está aberta.
 *
 * ⚠ POR QUE RECARREGAR PERDE O VÍDEO: o File do usuário não pode ser guardado
 * em localStorage e um objectURL morre com a aba. Guardar 150MB em IndexedDB
 * seria possível e ainda não vale — a sessão de edição é curta. O EDL é pequeno
 * e poderia persistir; sem o arquivo ele não abre nada, então também não persiste.
 * Isso é escolha, não esquecimento.
 *
 * Depende de: video/projeto.js, video/compositor.js, video/timeline.js,
 *   core/toast.js (gToast, gEsc, gConfirm).
 */

let vdPronto = false;
let vdFonte = null;      // {file, url} — fora do EDL de propósito (não é serializável)
/* A IA busca o vídeo dezenas de vezes para montar as folhas de contato. Deixar o
   transporte livre nesse meio-tempo faz o usuário disputar o cursor com o ingest
   — daí o mesmo tratamento que a exportação já recebe. */
let vdIaOcupado = false;

function vdInit(){
  if(vdPronto) return;
  const raiz = document.getElementById('vd-root');
  if(!raiz) return;
  raiz.innerHTML = _vdMarkup();

  vdCompositorMontar(document.getElementById('vd-canvas'), document.getElementById('vd-src'));
  vdCompositorCallbacks(t => vdTlPlayhead(t), () => _vdSincronizarTransporte());

  const palco = document.getElementById('vd-stage');
  palco.addEventListener('dragover', ev => { ev.preventDefault(); palco.classList.add('drag'); });
  palco.addEventListener('dragleave', () => palco.classList.remove('drag'));
  palco.addEventListener('drop', ev => {
    ev.preventDefault(); palco.classList.remove('drag');
    const f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
    if(f) vdCarregarArquivo(f);
  });

  const trilha = document.getElementById('vd-tl-track');
  trilha.addEventListener('pointerdown', vdTlPointerDown);
  trilha.addEventListener('pointermove', vdTlPointerMove);
  trilha.addEventListener('pointerup', vdTlPointerUp);
  trilha.addEventListener('pointercancel', vdTlPointerUp);

  document.addEventListener('keydown', _vdTecla);
  vdPronto = true;
}

function _vdMarkup(){
  return ''
  + '<div class="vd-wrap">'
  +   '<div class="vd-stage" id="vd-stage">'
  +     '<canvas id="vd-canvas" class="vd-canvas" width="1080" height="1920"></canvas>'
  +     '<video id="vd-src" class="vd-src" playsinline preload="metadata"></video>'
  +     '<div class="vd-empty" id="vd-empty">'
  +       '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 10l4.55-2.27A1 1 0 0121 8.62v6.76a1 1 0 01-1.45.89L15 14"/><rect x="3" y="6" width="12" height="12" rx="2"/></svg>'
  +       '<strong>Traga um vídeo pra editar</strong>'
  +       '<p>Arraste o arquivo aqui ou escolha no computador. Até 3 minutos.</p>'
  +       '<button type="button" class="vd-btn primary" onclick="document.getElementById(\'vd-file\').click()">Escolher vídeo</button>'
  +       '<input type="file" id="vd-file" accept="video/*" hidden onchange="vdCarregarArquivo(this.files[0]); this.value=\'\'">'
  +     '</div>'
  +     '<div class="vd-progresso" id="vd-progresso" hidden><div class="vd-progresso-barra" id="vd-progresso-barra"></div><span id="vd-progresso-txt">Exportando…</span></div>'
  +   '</div>'
  +   '<div class="vd-bar">'
  +     '<button type="button" class="vd-btn icon" id="vd-play" onclick="vdAlternarPlay()" aria-label="Tocar" disabled>'
  +       '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></button>'
  +     '<span class="vd-tempo" id="vd-tempo">0:00.0 / 0:00.0</span>'
  +     '<span class="vd-nome" id="vd-nome"></span>'
  +     '<span class="vd-flex"></span>'
  +     '<span class="vd-fmt" id="vd-fmt" role="group" aria-label="Formato de saída"></span>'
  +     '<button type="button" class="vd-btn" id="vd-dividir" onclick="vdAcaoDividir()" disabled>Dividir aqui</button>'
  +     '<button type="button" class="vd-btn" id="vd-ia" onclick="vdAcaoAutoEdit()" disabled>Editar com IA</button>'
  +     '<button type="button" class="vd-btn" id="vd-silencio" onclick="vdAcaoCortarSilencio()" disabled>Cortar silêncios</button>'
  +     '<button type="button" class="vd-btn" id="vd-legenda" onclick="vdAcaoLegenda()" disabled>Legendas</button>'
  +     '<button type="button" class="vd-btn" id="vd-undo" onclick="vdAcaoDesfazer()" disabled>Desfazer</button>'
  +     '<button type="button" class="vd-btn" id="vd-redo" onclick="vdAcaoRefazer()" disabled>Refazer</button>'
  +     '<button type="button" class="vd-btn primary" id="vd-exportar" onclick="vdAcaoExportar()" disabled>Exportar</button>'
  +   '</div>'
  +   '<div class="vd-tl">'
  +     '<div class="vd-tl-rot">Vídeo</div>'
  +     '<div class="vd-tl-track" id="vd-tl-track" role="slider" aria-label="Linha do tempo" tabindex="0"></div>'
  +   '</div>'
  +   '<div class="vd-inspector" id="vd-inspector"></div>'
  + '</div>';
}

/* ── ENTRADA ─────────────────────────────────────────────────────────── */

async function vdCarregarArquivo(file){
  if(!file) return;
  if(!/^video\//i.test(file.type || '')){
    gToast('Esse arquivo não é um vídeo. Envie um MP4 ou MOV.', 'error'); return;
  }
  const mb = file.size / 1048576;
  if(mb > VD_MAX_ENTRADA_MB){
    gToast('O vídeo tem ' + Math.round(mb) + 'MB. O limite é ' + VD_MAX_ENTRADA_MB + 'MB — envie um mais curto ou mais leve.', 'error'); return;
  }
  // Trocar de vídeo joga a edição fora: pergunta antes (gConfirm, nunca confirm()).
  if(vdProj && vdPodeDesfazer() && typeof gConfirm === 'function'){
    const segue = await gConfirm('Trocar o vídeo descarta a edição atual. Continuar?');
    if(!segue) return;
  }

  const video = document.getElementById('vd-src');
  const urlAntiga = vdFonte && vdFonte.url;
  const url = URL.createObjectURL(file);
  vdPausar();

  const meta = await new Promise(resolve => {
    const ok = () => { limpar(); resolve({ w: video.videoWidth, h: video.videoHeight }); };
    const erro = () => { limpar(); resolve(null); };
    const limpar = () => { video.removeEventListener('loadedmetadata', ok); video.removeEventListener('error', erro); };
    video.addEventListener('loadedmetadata', ok);
    video.addEventListener('error', erro);
    video.src = url;
  });
  if(meta) meta.dur = await _vdDuracaoConfiavel(video);

  if(!meta || !isFinite(meta.dur) || meta.dur <= 0){
    URL.revokeObjectURL(url);
    // Caso real e frequente: MOV com codec que o navegador não decodifica.
    gToast('Não consegui abrir esse vídeo. Converta para MP4 (H.264) e tente de novo.', 'error');
    return;
  }
  if(meta.dur > VD_MAX_ENTRADA_SEG){
    URL.revokeObjectURL(url);
    gToast('O vídeo tem ' + vdFmtTempo(meta.dur) + '. O limite é ' + (VD_MAX_ENTRADA_SEG / 60) + ' minutos.', 'error');
    return;
  }

  if(urlAntiga) URL.revokeObjectURL(urlAntiga);   // libera a memória do vídeo anterior
  vdFonte = { file, url };
  vdNovoProjeto({ nome: file.name, dur: meta.dur, w: meta.w, h: meta.h, mb: Math.round(mb) });
  vdSel = null;

  // Formato de saída segue a orientação do material: vídeo horizontal virado à
  // força em 9:16 perde metade da cena, e ninguém pediu isso.
  vdProj.formato = (meta.w > meta.h) ? '16:9' : '9:16';
  vdAjustarSaida();

  document.getElementById('vd-empty').hidden = true;
  // Vídeo curto de teste dava "0MB" — abaixo de 1MB o número honesto é em KB.
  const peso = mb < 1 ? Math.round(file.size / 1024) + 'KB' : mb.toFixed(mb < 10 ? 1 : 0) + 'MB';
  document.getElementById('vd-nome').innerHTML = gEsc(file.name) + ' · ' + peso;
  vdIrPara(0);
  vdTlRender();
  vdRenderFormato();
  vdRenderInspetor();
  _vdSincronizarTransporte();
  gToast('Vídeo carregado: ' + vdFmtTempo(meta.dur) + '.');
}

/**
 * Duração que dá pra confiar.
 *
 * ARMADILHA REAL (pega na bancada): WebM gravado por MediaRecorder — inclusive o
 * que o próprio Luma exporta — não traz duração no cabeçalho, e o navegador
 * responde `Infinity` até alguém procurar o fim do arquivo. Sem isto, o editor
 * recusava o vídeo dizendo "converta para MP4", o que era mentira.
 *
 * O truque é o padrão da plataforma: buscar um tempo absurdo faz o navegador ir
 * até o fim real e recalcular a duração.
 */
function _vdDuracaoConfiavel(video){
  if(isFinite(video.duration) && video.duration > 0) return Promise.resolve(video.duration);
  return new Promise(resolve => {
    let respondeu = false;
    const terminar = () => {
      if(respondeu) return;
      respondeu = true;
      video.removeEventListener('seeked', terminar);
      video.removeEventListener('timeupdate', terminar);
      const d = video.duration;
      // ⚠ Voltar ao início e ESPERAR: deixar um seek desta sondagem em voo faz o
      // primeiro 'seeked' do editor ser o DELA, e a prévia abre mostrando o
      // último frame do vídeo com o cursor no zero. (Visto na captura de tela.)
      let zerou = false;
      const zerado = () => {
        if(zerou) return;
        zerou = true;
        video.removeEventListener('seeked', zerado);
        resolve(isFinite(d) && d > 0 ? d : 0);
      };
      video.addEventListener('seeked', zerado);
      setTimeout(zerado, 1500);
      try{ video.currentTime = 0; }catch(e){ zerado(); }
    };
    video.addEventListener('seeked', terminar);
    video.addEventListener('timeupdate', terminar);
    // 3s de teto: arquivo corrompido não pode travar a interface pra sempre.
    setTimeout(terminar, 3000);
    try{ video.currentTime = 1e101; }catch(e){ terminar(); }
  });
}

/* ── AÇÕES ───────────────────────────────────────────────────────────── */

function vdAlternarPlay(){
  if(!vdProj) return;
  if(vdTocando()) vdPausar(); else vdTocar();
  _vdSincronizarTransporte();
}

function vdAcaoDividir(){
  if(!vdProj) return;
  const t = vdTempoLinha();
  if(!vdDividir(t)){ gToast('Não há onde dividir nesse ponto — mova o cursor para o meio de um trecho.', 'error'); return; }
  vdTlRender(); _vdSincronizarTransporte();
}

/**
 * Corte automático de silêncio — o motor de regras (video/ingest.js).
 *
 * Passa pelo MESMO `vdAplicarPlano` que a IA vai usar: um caminho de aplicação,
 * um histórico, um validador. Se o plano do motor de regras não passar na
 * validação, o problema aparece aqui e não na exportação.
 */
async function vdAcaoCortarSilencio(){
  if(!vdProj) return;
  // O plano substitui a lista de trechos inteira: trabalho manual anterior morre.
  if(vdPodeDesfazer() && typeof gConfirm === 'function'){
    const segue = await gConfirm('Cortar silêncios refaz os trechos e substitui os cortes que você fez à mão. Continuar?');
    if(!segue) return;
  }
  const btn = document.getElementById('vd-silencio');
  const rotulo = btn ? btn.textContent : '';
  if(btn){ btn.disabled = true; btn.textContent = 'Ouvindo o áudio…'; }
  const m = await vdMedirAudio();
  if(btn){ btn.textContent = rotulo; btn.disabled = false; }

  if(!m.ok){ gToast('Não consegui analisar o áudio: ' + m.erro + '. Você ainda pode cortar à mão.', 'error'); return; }
  const plano = vdPlanoCorteSilencio(m);
  if(!plano){ gToast('Não achei pausa longa o bastante para cortar neste vídeo.'); return; }

  const antes = vdDuracaoFinal();
  const r = vdAplicarPlano(plano);
  if(!r.ok){
    gToast('O corte automático não passou na validação — nada foi alterado.', 'error');
    console.warn('[video] plano do motor de regras rejeitado:', r.descartes);
    return;
  }
  vdSel = null;
  vdIrPara(0);
  vdTlRender(); vdRenderInspetor(); _vdSincronizarTransporte();
  if(r.descartes.length) console.warn('[video] descartes do corte automático:', r.descartes);
  gToast('Removi ' + m.silencios.length + ' pausa(s): ' + vdFmtTempo(antes) + ' → ' + vdFmtTempo(vdDuracaoFinal()) + '.');
}

/**
 * AUTO EDIT — a IA assiste ao vídeo e devolve um plano de corte.
 *
 * A interface aqui não decide NADA sobre a edição: quem escolhe é video/ia.js,
 * quem valida é vdValidarPlano, quem aplica é vdAplicarPlano. O que este handler
 * faz é o que só a interface pode fazer — pedir confirmação, mostrar em que etapa
 * a espera está e, no fim, MOSTRAR O PORQUÊ de cada corte.
 *
 * ⚠ O porquê não é enfeite: uma edição automática sem justificativa é indistinguível
 * de um bug, e o franqueado não tem como saber se o corte em 7,2s foi intenção ou
 * defeito. É por isso que `motivo` é obrigatório no validador e aparece no inspetor.
 */
async function vdAcaoAutoEdit(){
  if(!vdProj || vdExportando() || vdIaOcupado) return;
  if(typeof gAiReady !== 'function' || !gAiReady()){
    gToast('A IA não está disponível nesta sessão. Você ainda pode cortar silêncios e editar à mão.', 'error');
    return;
  }
  // Mesmo aviso do corte de silêncio: o plano substitui a lista de trechos inteira.
  if(vdPodeDesfazer() && typeof gConfirm === 'function'){
    const segue = await gConfirm('A edição da IA refaz os trechos e substitui os cortes que você fez à mão. Continuar?');
    if(!segue) return;
  }

  const caixa = document.getElementById('vd-progresso');
  const barra = document.getElementById('vd-progresso-barra');
  const txt = document.getElementById('vd-progresso-txt');
  caixa.hidden = false; barra.style.transform = 'scaleX(0)';
  txt.textContent = 'Preparando…';
  vdIaOcupado = true;
  _vdSincronizarTransporte();

  const r = await vdAutoEdit((p, etapa) => {
    barra.style.transform = 'scaleX(' + Math.min(Math.max(p, 0), 1).toFixed(4) + ')';
    // Etapa em vez de porcentagem seca: "decidindo os cortes" explica por que a
    // barra fica parada — é a espera da rede, e não um travamento.
    if(etapa) txt.textContent = 'A IA está ' + etapa + '…';
  });

  vdIaOcupado = false;
  caixa.hidden = true;

  if(!r.ok){
    gToast('A edição automática não saiu: ' + r.erro + '. Nada foi alterado.', 'error');
    if(r.descartes) console.warn('[video] plano da IA rejeitado:', r.descartes);
    _vdSincronizarTransporte();
    return;
  }
  vdSel = null;
  vdIrPara(0);
  vdTlRender(); vdRenderInspetor(); _vdSincronizarTransporte();
  if(r.descartes && r.descartes.length) console.warn('[video] descartes do plano da IA:', r.descartes);
  gToast('A IA editou: ' + vdFmtTempo(r.antes) + ' → ' + vdFmtTempo(r.depois)
    + ' em ' + vdSegs().length + ' trecho(s). Veja embaixo o motivo de cada escolha e revise antes de exportar.');
}

/**
 * Legendas. Na primeira vez transcreve (chamada de IA); depois é só liga/desliga —
 * refazer a transcrição a cada clique gastaria cota para receber o mesmo texto.
 *
 * Não passa pelo validador de EditPlan de propósito: legenda não é ação de
 * edição de trecho, é uma camada de exibição. O que a IA devolve aqui é TEXTO
 * COM TEMPO, e o filtro de sanidade (tempo fora do vídeo) está em vdTranscrever.
 */
async function vdAcaoLegenda(){
  if(!vdProj) return;
  const btn = document.getElementById('vd-legenda');

  // Já tem legenda: o clique só alterna.
  if(vdProj.legendas && vdProj.legendas.cards && vdProj.legendas.cards.length){
    vdProj.legendas.ativo = !vdProj.legendas.ativo;
    _vdRedesenhar();
    _vdSincronizarTransporte();
    gToast(vdProj.legendas.ativo ? 'Legendas ligadas.' : 'Legendas desligadas.');
    return;
  }

  if(typeof gAiReady !== 'function' || !gAiReady()){
    gToast('A transcrição não está disponível nesta sessão. Sem ela não consigo gerar legenda.', 'error');
    return;
  }
  const rotulo = btn ? btn.textContent : '';
  if(btn){ btn.disabled = true; btn.textContent = 'Transcrevendo…'; }
  const r = await vdTranscrever();
  if(btn){ btn.textContent = rotulo; btn.disabled = false; }

  if(!r.ok){ gToast('Não consegui gerar as legendas: ' + r.erro + '.', 'error'); return; }
  vdProj.legendas = { ativo:true, template:'dm_cap_01', cards:r.cards };
  vdRegistrar('legendas');
  _vdRedesenhar();
  _vdSincronizarTransporte();
  gToast('Legendas prontas: ' + r.cards.length + ' cartão(ões)'
    + (r.descartados ? ', ' + r.descartados + ' trecho(s) fora do vídeo descartado(s)' : '') + '. Revise antes de exportar.');
}

// Redesenha o frame atual sem mexer no transporte — usado quando muda algo que só
// afeta a IMAGEM (legenda, foco, formato).
function _vdRedesenhar(){
  const hit = vdSegNoTempo(vdTempoLinha());
  if(hit) vdDesenharFrame(hit.seg);
}

function vdAcaoRemover(){
  if(!vdSel) return;
  if(!vdRemoverSeg(vdSel)){ gToast('O último trecho não pode ser removido.', 'error'); return; }
  vdSel = null;
  vdIrPara(Math.min(vdTempoLinha(), vdDuracaoFinal()));
  vdTlRender(); vdRenderInspetor(); _vdSincronizarTransporte();
}

function vdAcaoMover(dir){
  if(!vdSel || !vdMoverSeg(vdSel, dir)) return;
  vdTlRender(); vdRenderInspetor(); _vdSincronizarTransporte();
}

function vdAcaoZoom(v){
  if(!vdSel || !vdZoomSeg(vdSel, v)) return;
  _vdRedesenhar();
  vdTlRender(); vdRenderInspetor();
}

function vdAcaoDesfazer(){
  if(!vdDesfazer()) return;
  _vdDepoisDoHistorico();
}

function vdAcaoRefazer(){
  if(!vdRefazer()) return;
  _vdDepoisDoHistorico();
}

// Desfazer/refazer TROCAM os objetos por clones: a seleção guardada pode não
// existir mais, e o playhead pode estar além do fim. Re-resolver por ID aqui é o
// que evita inspetor apontando pra objeto morto.
function _vdDepoisDoHistorico(){
  if(vdSel && vdSegIdx(vdSel) < 0) vdSel = null;
  vdIrPara(Math.min(vdTempoLinha(), Math.max(vdDuracaoFinal() - 0.05, 0)));
  vdTlRender(); vdRenderInspetor(); _vdSincronizarTransporte();
}

async function vdAcaoExportar(){
  if(!vdProj || vdExportando()) return;
  const impedimento = vdPodeExportar();
  if(impedimento){ gToast(impedimento, 'error'); return; }

  const barra = document.getElementById('vd-progresso-barra');
  const caixa = document.getElementById('vd-progresso');
  const txt = document.getElementById('vd-progresso-txt');
  caixa.hidden = false; barra.style.transform = 'scaleX(0)';
  txt.textContent = 'Exportando em tempo real — não troque de aba.';
  document.getElementById('vd-exportar').disabled = true;

  const r = await vdExportar(p => { barra.style.transform = 'scaleX(' + Math.min(Math.max(p, 0), 1).toFixed(4) + ')'; });

  caixa.hidden = true;
  document.getElementById('vd-exportar').disabled = false;
  _vdSincronizarTransporte();
  if(!r){ gToast('A exportação não gerou arquivo. Tente de novo com a aba em primeiro plano.', 'error'); return; }

  const limpo = (typeof fSanitizeNamePart === 'function' ? fSanitizeNamePart(vdProj.nome) : String(vdProj.nome || 'video')).replace(/\.[^.]+$/, '');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(r.blob);
  a.download = 'Luma_' + (limpo || 'video') + '.' + r.ext;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);

  if(r.suspeito) gToast('Pronto, mas a aba saiu de foco durante a exportação — confira se o vídeo não congelou em algum trecho.', 'error');
  else if(!vdSaidaEhH264()) gToast('Vídeo exportado em ' + r.ext.toUpperCase() + '. Este navegador não grava MP4 com H.264 — para postar direto no Instagram, use o Chrome no computador.');
  else gToast('Vídeo exportado.');
}

/* ── FORMATO DE SAÍDA ─────────────────────────────────────────────────────
   Três formatos porque são os três que a rede usa: Reels/Story (9:16), feed
   quadrado (1:1) e o horizontal de origem (16:9). Trocar o formato não redimensiona
   o vídeo: ele CORTA — e é aí que o foco do enquadramento passa a importar. */
const VD_FMT_ROTULOS = { '9:16':'Reels', '1:1':'Quadrado', '16:9':'Horizontal' };

function vdRenderFormato(){
  const el = document.getElementById('vd-fmt');
  if(!el) return;
  if(!vdProj){ el.innerHTML = ''; return; }
  el.innerHTML = Object.keys(VD_FMT_ROTULOS).map(f =>
    '<button type="button" class="vd-btn tiny' + (vdProj.formato === f ? ' sel' : '') + '"'
    + ' onclick="vdAcaoFormato(\'' + f + '\')"'
    + ' aria-pressed="' + (vdProj.formato === f ? 'true' : 'false') + '">' + f + '</button>'
  ).join('');
}

function vdAcaoFormato(f){
  if(!vdMudarFormato(f)) return;
  vdRenderFormato();
  vdRenderInspetor();       // o controle de enquadramento aparece/desaparece com o corte
  _vdSincronizarTransporte();
  const eixo = vdEixoDeCorte();
  if(eixo) gToast('Formato ' + f + ': o vídeo está sendo cortado ' + (eixo === 'x' ? 'nas laterais' : 'em cima e embaixo') + '. Use o enquadramento no trecho selecionado.');
}

function vdAcaoFoco(v){
  if(!vdSel || !vdFocoSeg(vdSel, v)) return;
  _vdRedesenhar();
  vdRenderInspetor();
  _vdSincronizarTransporte();
}

/* ── INSPETOR (contextual: só o que está selecionado) ─────────────────── */

// PT-BR sem jargão: "foco 0,15" não diz nada; "esquerda" diz.
function _vdRotuloFoco(eixo, f){
  const nomes = eixo === 'x' ? ['esquerda', 'centro', 'direita'] : ['topo', 'centro', 'base'];
  return f < 0.35 ? nomes[0] : (f > 0.65 ? nomes[2] : nomes[1]);
}

/* O que a IA fez e por quê. Vive no inspetor porque é o painel que já responde
   "o que está selecionado" — e depois de um Auto Edit a resposta honesta é "a IA
   mexeu em tudo, olhe o que ela decidiu". gEsc porque o texto vem do modelo. */
function _vdMarkupIaLog(){
  const log = (vdProj && vdProj.iaLog) || [];
  if(!log.length) return '';
  const rot = { segmentos:'Corte', reframe:'Enquadramento' };
  return '<div class="vd-ia-log">'
    + '<div class="vd-insp-head">O que a IA decidiu</div>'
    + '<ul>' + log.slice(0, 12).map(a =>
        '<li><span>' + gEsc(rot[a.tipo] || a.tipo) + '</span>' + gEsc(a.motivo) + '</li>').join('')
    + '</ul></div>';
}

function vdRenderInspetor(){
  const el = document.getElementById('vd-inspector');
  if(!el) return;
  const i = vdSel ? vdSegIdx(vdSel) : -1;
  if(i < 0){
    el.innerHTML = vdProj
      ? (_vdMarkupIaLog()
         + '<p class="vd-hint">Clique num trecho da linha do tempo para ajustar. <strong>Espaço</strong> toca, <strong>S</strong> divide no cursor.</p>')
      : '';
    return;
  }
  const s = vdSegs()[i];
  const eixo = vdEixoDeCorte();
  const foco = (s.foco == null) ? 0.5 : s.foco;
  el.innerHTML = ''
    // O motivo VIAJA no trecho (projeto.js grava em cada segmento), então o
    // "por quê" continua visível depois de selecionar — que é justo quando o
    // usuário está decidendo se aceita o corte da IA ou desfaz.
    + '<div class="vd-insp-ident"><div class="vd-insp-head">Trecho ' + (i + 1) + ' de ' + vdSegs().length + '</div>'
    +   (s.motivo ? '<div class="vd-insp-porque">' + gEsc(s.motivo) + '</div>' : '')
    + '</div>'
    + '<dl class="vd-insp-grid">'
    +   '<dt>Entra</dt><dd>' + vdFmtTempo(s.de) + '</dd>'
    +   '<dt>Sai</dt><dd>' + vdFmtTempo(s.ate) + '</dd>'
    +   '<dt>Duração</dt><dd>' + vdFmtTempo(vdSegDur(s)) + '</dd>'
    + '</dl>'
    + '<label class="vd-insp-zoom">Aproximação <output>' + s.zoom.toFixed(2) + '×</output>'
    +   '<input type="range" min="1" max="1.6" step="0.02" value="' + s.zoom + '" oninput="vdAcaoZoom(this.value)">'
    + '</label>'
    // Só aparece quando o formato realmente corta: controle sem efeito visível
    // ensina o usuário a desconfiar da ferramenta.
    + (eixo ? '<label class="vd-insp-zoom">Enquadramento <output>' + _vdRotuloFoco(eixo, foco) + '</output>'
    +   '<input type="range" min="0" max="1" step="0.02" value="' + foco + '" oninput="vdAcaoFoco(this.value)">'
    + '</label>' : '')
    + '<div class="vd-insp-acoes">'
    +   '<button type="button" class="vd-btn" onclick="vdAcaoMover(-1)"' + (i === 0 ? ' disabled' : '') + '>Mover antes</button>'
    +   '<button type="button" class="vd-btn" onclick="vdAcaoMover(1)"' + (i === vdSegs().length - 1 ? ' disabled' : '') + '>Mover depois</button>'
    +   '<button type="button" class="vd-btn danger" onclick="vdAcaoRemover()"' + (vdSegs().length <= 1 ? ' disabled' : '') + '>Remover trecho</button>'
    + '</div>';
}

/* ── ESTADO DOS BOTÕES ───────────────────────────────────────────────── */

function _vdSincronizarTransporte(){
  const tem = !!(vdProj && vdSegs().length) && !vdIaOcupado;
  const play = document.getElementById('vd-play');
  if(play){
    play.disabled = !tem;
    play.setAttribute('aria-label', vdTocando() ? 'Pausar' : 'Tocar');
    play.innerHTML = vdTocando()
      ? '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>'
      : '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  }
  const set = (id, on) => { const b = document.getElementById(id); if(b) b.disabled = !on; };
  set('vd-dividir', tem);
  set('vd-silencio', tem);
  set('vd-ia', tem && typeof gAiReady === 'function' && gAiReady());
  set('vd-legenda', tem);
  const bl = document.getElementById('vd-legenda');
  if(bl && tem){
    const temCards = !!(vdProj.legendas && vdProj.legendas.cards && vdProj.legendas.cards.length);
    bl.textContent = !temCards ? 'Legendas' : (vdProj.legendas.ativo ? 'Legendas: ligadas' : 'Legendas: desligadas');
    bl.classList.toggle('sel', temCards && vdProj.legendas.ativo);
  }
  set('vd-exportar', tem && !vdExportando());
  set('vd-undo', vdPodeDesfazer() && !vdIaOcupado);
  set('vd-redo', vdPodeRefazer() && !vdIaOcupado);
  vdTlPlayhead(vdTempoLinha());
}

/* ── TECLADO ─────────────────────────────────────────────────────────────
   Só quando o módulo está na frente e o foco não está num campo — senão o
   atalho engole o que a pessoa está digitando em outra área do Luma. */
function _vdTecla(ev){
  if(!document.body.classList.contains('mode-video') || !vdProj || vdExportando() || vdIaOcupado) return;
  const alvo = ev.target;
  if(alvo && (/^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName) || alvo.isContentEditable)) return;
  const k = ev.key.toLowerCase();
  if(k === ' '){ ev.preventDefault(); vdAlternarPlay(); return; }
  if(k === 's'){ ev.preventDefault(); vdAcaoDividir(); return; }
  if((k === 'delete' || k === 'backspace') && vdSel){ ev.preventDefault(); vdAcaoRemover(); return; }
  if((ev.ctrlKey || ev.metaKey) && k === 'z'){ ev.preventDefault(); if(ev.shiftKey) vdAcaoRefazer(); else vdAcaoDesfazer(); return; }
  if((ev.ctrlKey || ev.metaKey) && k === 'y'){ ev.preventDefault(); vdAcaoRefazer(); }
}
