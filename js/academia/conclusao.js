/**
 * js/academia/conclusao.js
 *
 * ACADEMIA — EXPERIÊNCIA DE CONCLUSÃO DA FORMAÇÃO.
 * O momento em que o franqueado deixa de estar "em implementação" e passa a fazer
 * parte da rede como formado. Sequência em 4 telas dentro de um overlay:
 *
 *   1. CONFIRMAÇÃO  progresso fecha em 100%, mensagem curta
 *   2. SPLASH       nome, formação, selo, data, frase de nova jornada
 *   3. VÍDEO        mensagem institucional dos CEOs (configurável pela equipe)
 *   4. PRÓXIMA      certificado, revisão, retorno — um CTA principal
 *
 * GATILHO — só dispara quando TODAS forem verdade:
 *   • a conclusão está PERSISTIDA (matricula.concluido_em veio do banco);
 *   • existe certificado emitido (ou em emissão) para esta versão;
 *   • esta pessoa ainda não viu a experiência NESTA versão do curso.
 * Nunca disparamos por estado local: certificado e conclusão são do servidor.
 *
 * REVER — a home guarda uma entrada explícita ("Rever conclusão"), e o vídeo fica
 * acessível para sempre. A splash não volta sozinha; é ação do usuário.
 *
 * O QUE ESTE ARQUIVO NÃO FAZ: não decide se a formação está concluída (isso é da
 * RPC), não emite certificado (certificado.js) e não grava progresso de aula.
 *
 * Depende de: motion.js (acSequencia, acDur, acMotionReduzido, acSomConquista),
 * academia.js (acState, acResumo, _acLuma…), certificado.js (acBaixarCertificado).
 */

let _acConclusaoAberta = false;
let _acConclusaoCancelar = null;   // cancela a coreografia em curso (botão pular)
let _acConclusaoEtapa = '';
let _acVideoCeoEl = null;

/* ══════════════════════════════════════════════════════════════
   CONFIGURAÇÃO (vem de luma.cursos.conclusao — nunca hardcoded)
══════════════════════════════════════════════════════════════ */
function acConclusaoCfg(){
  const c = acState.curso || {};
  const raiz = (c.conclusao && typeof c.conclusao==='object') ? c.conclusao : {};
  const splash = raiz.splash || {};
  const video = raiz.video || {};
  return {
    splashAtiva: splash.ativa !== false,
    titulo:  splash.titulo  || 'Formação concluída',
    mensagem: splash.mensagem || 'Você concluiu sua jornada de formação como franqueado Delivery Much.',
    fraseFinal: splash.frase_final || 'Agora começa uma nova etapa da sua jornada na rede.',
    ctaLabel: splash.cta_label || 'Ver meu certificado',
    ctaDestino: splash.cta_destino || 'certificado',
    ctaUrl: splash.cta_url || '',
    video: {
      ativo: !!video.ativo && !!(video.path || video.url),
      versao: Number(video.versao)||1,
      titulo: video.titulo || 'Uma mensagem para o início da sua nova jornada',
      intro: video.intro || '',
      path: video.path || '', url: video.url || '',
      thumb: video.thumb_url || '', legenda: video.legenda_url || '',
      duracao: Number(video.duracao_seg)||0,
      obrigatorio: !!video.obrigatorio,
      ctaLabel: video.cta_label || 'Continuar'
    }
  };
}

/* ══════════════════════════════════════════════════════════════
   GATILHO E ESTADO
══════════════════════════════════════════════════════════════ */
// A pessoa já viu a experiência desta VERSÃO do curso?
function acConclusaoJaVista(){
  const m = acState.matricula, c = acState.curso;
  if(!m || !c) return true;
  const versao = c.versao || 1;
  return !!(m.splash_vista_em && (m.splash_versao||0) >= versao);
}
// Há uma mensagem institucional NOVA (vídeo com versão maior que a já vista)?
// Isso não reabre a splash — vira um aviso na home, como o produto pede.
function acVideoCeoNovo(){
  const cfg = acConclusaoCfg(), m = acState.matricula;
  if(!cfg.video.ativo || !m || !m.concluido_em) return false;
  const visto = m.video_visto_versao || 0;
  return cfg.video.versao > visto;
}
function acVideoCeoDisponivel(){ return acConclusaoCfg().video.ativo; }

/**
 * Chamado depois de a conclusão ser persistida (certificado.js) e no boot.
 * Abre a experiência só se ainda não foi vista nesta versão.
 * @returns {boolean} abriu?
 */
function acConclusaoTalvezAbrir(){
  const cfg = acConclusaoCfg();
  if(!cfg.splashAtiva) return false;
  if(!acConcluiu()) return false;                       // servidor não confirmou
  if(!acState.certificado) return false;                // sem certificado não é conclusão
  if(acConclusaoJaVista()) return false;
  acConclusaoAbrir({ primeiraVez:true });
  return true;
}

// Marca como vista. Local primeiro (a splash não pode voltar nem se a rede cair).
async function _acMarcarSplashVista(){
  const c = acState.curso; if(!acState.matricula || !c) return;
  const agora = new Date().toISOString();
  acState.matricula.splash_vista_em = agora;
  acState.matricula.splash_versao = c.versao || 1;
  if(typeof _acCacheSalvar==='function') _acCacheSalvar();
  const lu = _acLuma(); if(!lu || !_acUid() || c._demo) return;
  try{
    await lu.from('matriculas')
      .update({ splash_vista_em: agora, splash_versao: c.versao||1 })
      .eq('user_id', _acUid()).eq('curso_id', c.id);
  }catch(e){ console.warn('[academia] splash não registrou:', e&&e.message||e); }
}

async function _acMarcarVideo(campo){
  const c = acState.curso, cfg = acConclusaoCfg();
  if(!acState.matricula || !c) return;
  const agora = new Date().toISOString();
  acState.matricula[campo] = agora;
  acState.matricula.video_visto_versao = cfg.video.versao;
  if(typeof _acCacheSalvar==='function') _acCacheSalvar();
  const lu = _acLuma(); if(!lu || !_acUid() || c._demo) return;
  const patch = { video_visto_versao: cfg.video.versao };
  patch[campo] = agora;
  try{
    await lu.from('matriculas').update(patch).eq('user_id', _acUid()).eq('curso_id', c.id);
  }catch(e){ console.warn('[academia] vídeo não registrou:', e&&e.message||e); }
}
// Posição do vídeo institucional (retomada). Debounce: não é aula, não precisa
// da mesma frequência de gravação.
let _acVideoCeoTimer = null;
function _acSalvarPosVideoCeo(seg){
  const c = acState.curso; if(!acState.matricula || !c) return;
  acState.matricula.video_posicao_seg = Math.round(seg||0);
  const lu = _acLuma(); if(!lu || !_acUid() || c._demo) return;
  clearTimeout(_acVideoCeoTimer);
  _acVideoCeoTimer = setTimeout(()=>{
    lu.from('matriculas').update({ video_posicao_seg: acState.matricula.video_posicao_seg })
      .eq('user_id', _acUid()).eq('curso_id', c.id)
      .then(({error})=>{ if(error) console.warn('[academia] pos. vídeo CEOs:', error.message); });
  }, 4000);
}

/* ══════════════════════════════════════════════════════════════
   ABERTURA / FECHAMENTO
══════════════════════════════════════════════════════════════ */
/**
 * @param {object} opts {primeiraVez:bool, etapa:'splash'|'video'|'proxima', preview:bool}
 */
function acConclusaoAbrir(opts){
  opts = opts||{};
  if(_acConclusaoAberta) return;
  _acConclusaoAberta = true;
  const cfg = acConclusaoCfg();

  const ov = document.createElement('div');
  ov.className = 'ac-conc';
  ov.id = 'ac-conc';
  ov.setAttribute('role','dialog');
  ov.setAttribute('aria-modal','true');
  ov.setAttribute('aria-label', cfg.titulo);
  if(opts.preview) ov.classList.add('is-preview');
  ov.innerHTML = `
    <div class="ac-conc-fundo" aria-hidden="true"><span class="ac-conc-halo"></span></div>
    <div class="ac-conc-palco" id="ac-conc-palco"></div>
    <div class="ac-conc-rodape">
      <button type="button" class="ac-conc-pular" id="ac-conc-pular" onclick="acConclusaoPular()">Pular animação</button>
      <button type="button" class="ac-conc-fechar" onclick="acConclusaoFechar()" aria-label="Fechar a experiência de conclusão">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
    </div>`;
  document.body.appendChild(ov);
  document.body.classList.add('ac-conc-aberta');
  requestAnimationFrame(()=>ov.classList.add('is-visivel'));

  // Foco preso no overlay: Tab não pode escapar pra trás da celebração.
  ov._onKey = (ev)=>{
    if(ev.key==='Escape'){ ev.preventDefault(); acConclusaoFechar(); return; }
    if(ev.key!=='Tab') return;
    const alvos = ov.querySelectorAll('button:not([disabled]), a[href], video, [tabindex]:not([tabindex="-1"])');
    if(!alvos.length) return;
    const primeiro = alvos[0], ultimo = alvos[alvos.length-1];
    if(ev.shiftKey && document.activeElement===primeiro){ ev.preventDefault(); ultimo.focus(); }
    else if(!ev.shiftKey && document.activeElement===ultimo){ ev.preventDefault(); primeiro.focus(); }
  };
  document.addEventListener('keydown', ov._onKey, true);
  ov._focoAnterior = document.activeElement;

  const etapa = opts.etapa || (opts.primeiraVez ? 'confirmacao' : 'splash');
  acConclusaoIr(etapa, opts);
  if(opts.primeiraVez){
    _acMarcarSplashVista();
    if(typeof gTrackEvent==='function') gTrackEvent('conclusao_exibida',{curso_id:acState.curso&&acState.curso.id, versao:acState.curso&&acState.curso.versao});
  }
}

function acConclusaoFechar(){
  const ov = document.getElementById('ac-conc'); if(!ov) return;
  if(_acConclusaoCancelar){ _acConclusaoCancelar(); _acConclusaoCancelar=null; }
  if(_acVideoCeoEl){ try{ _acVideoCeoEl.pause(); }catch(e){} _acVideoCeoEl=null; }
  if(ov._onKey) document.removeEventListener('keydown', ov._onKey, true);
  ov.classList.remove('is-visivel');
  const foco = ov._focoAnterior;
  setTimeout(()=>{
    ov.remove();
    document.body.classList.remove('ac-conc-aberta');
    _acConclusaoAberta = false;
    _acConclusaoEtapa = '';
    if(foco && foco.focus){ try{ foco.focus(); }catch(e){} }
    // A home reflete o novo estado (modo pós-formação, aviso de mensagem nova).
    if(acState.rota==='home') acRender();
  }, acDur('base')+40);
}

// Pular: a coreografia é cancelada e a etapa aparece inteira. Nunca é uma
// espera obrigatória — splash que não se deixa interromper é armadilha.
function acConclusaoPular(){
  if(_acConclusaoCancelar){ _acConclusaoCancelar(); _acConclusaoCancelar=null; }
  const palco = document.getElementById('ac-conc-palco');
  if(palco) palco.querySelectorAll('[data-passo]').forEach(el=>el.classList.add('is-visivel'));
  const btn = document.getElementById('ac-conc-pular');
  if(btn) btn.hidden = true;
}

/* ══════════════════════════════════════════════════════════════
   ETAPAS
══════════════════════════════════════════════════════════════ */
function acConclusaoIr(etapa, opts){
  opts = opts||{};
  _acConclusaoEtapa = etapa;
  const palco = document.getElementById('ac-conc-palco'); if(!palco) return;
  if(_acConclusaoCancelar){ _acConclusaoCancelar(); _acConclusaoCancelar=null; }
  if(_acVideoCeoEl){ try{ _acVideoCeoEl.pause(); }catch(e){} _acVideoCeoEl=null; }
  const btnPular = document.getElementById('ac-conc-pular');
  if(btnPular) btnPular.hidden = (etapa!=='confirmacao' && etapa!=='splash') || acMotionReduzido();

  if(etapa==='confirmacao') return acConcEtapaConfirmacao(palco, opts);
  if(etapa==='video')       return acConcEtapaVideo(palco, opts);
  if(etapa==='proxima')     return acConcEtapaProxima(palco, opts);
  return acConcEtapaSplash(palco, opts);
}

/* ── ETAPA 1 — CONFIRMAÇÃO: o progresso FECHA em 100% na frente da pessoa ── */
function acConcEtapaConfirmacao(palco, opts){
  const r = acResumo();
  // Parte do valor que a home mostrava e completa: é o percurso que comunica
  // "acabou", não o número final aparecendo pronto.
  const de = (typeof acProgLembrado==='function') ? acProgLembrado('formacao', r.pct) : r.pct;
  const C = (typeof AC_ANEL_C!=='undefined') ? AC_ANEL_C : 2*Math.PI*46;
  palco.innerHTML = `<div class="ac-conc-conf">
    <div class="ac-conc-anel" data-passo="1">
      <svg viewBox="0 0 110 110" aria-hidden="true">
        <circle class="ac-conc-anel-trilho" cx="55" cy="55" r="46"/>
        <circle class="ac-conc-anel-fill" id="ac-conc-anel" cx="55" cy="55" r="46"
                style="stroke-dasharray:${C.toFixed(1)};stroke-dashoffset:${(C*(1-de/100)).toFixed(1)}"/>
      </svg>
      <span class="ac-conc-anel-num" id="ac-conc-num">${de}%</span>
    </div>
    <p class="ac-conc-conf-txt" data-passo="2">Você concluiu sua jornada de formação.</p>
    <span class="ac-sr" role="status">Formação concluída. Progresso 100 por cento.</span>
  </div>`;

  const passos = [
    { em:0,   faz:()=>palco.querySelector('[data-passo="1"]').classList.add('is-visivel') },
    { em:120, faz:()=>{
        acAnimaAnel(document.getElementById('ac-conc-anel'), 100, C);
        acAnimaNumero(document.getElementById('ac-conc-num'), de, 100);
        if(typeof acProgGuardar==='function') acProgGuardar('formacao', 100);
      } },
    { em:520, faz:()=>palco.querySelector('[data-passo="2"]').classList.add('is-visivel') },
    // A transição pra splash é automática, mas curta: a pessoa não fica assistindo.
    { em:1500, faz:()=>acConclusaoIr('splash', opts) }
  ];
  _acConclusaoCancelar = acSequencia(passos);
  if(acMotionReduzido()){
    // Redução de movimento: estado final imediato, sem percurso. A informação
    // continua toda na tela e a splash entra sem espera.
    palco.querySelectorAll('[data-passo]').forEach(el=>el.classList.add('is-visivel'));
    acConclusaoIr('splash', opts);
  }
}

/* ── ETAPA 2 — SPLASH: nome, formação, selo, data, nova jornada ── */
function acConcEtapaSplash(palco, opts){
  const cfg = acConclusaoCfg();
  const cert = acState.certificado || {};
  const nome = cert.nome_completo
    || ((typeof gAuthState!=='undefined' && gAuthState.user && gAuthState.user.displayName) || 'Franqueado');
  const quando = cert.concluido_em || (acState.matricula&&acState.matricula.concluido_em) || '';
  const temVideo = cfg.video.ativo;

  palco.innerHTML = `<div class="ac-conc-splash">
    <span class="ac-conc-selo" data-passo="1" aria-hidden="true">${AC_ICO.medal}</span>
    <span class="ac-conc-eyebrow" data-passo="2">${acIco('cap')} Academia Delivery Much</span>
    <h1 class="ac-conc-titulo" data-passo="2">${gEsc(cfg.titulo)}</h1>
    <p class="ac-conc-nome" data-passo="3">${gEsc(nome)}</p>
    <p class="ac-conc-msg" data-passo="4">${gEsc(cfg.mensagem)}</p>
    <dl class="ac-conc-meta" data-passo="4">
      <div><dt>Formação</dt><dd>${gEsc(cert.curso_nome || (acState.curso&&acState.curso.nome) || '')}</dd></div>
      ${quando?`<div><dt>Concluída em</dt><dd>${acFmtData(quando)}</dd></div>`:''}
      <div><dt>Progresso</dt><dd>100%</dd></div>
    </dl>
    <p class="ac-conc-frase" data-passo="5">${gEsc(cfg.fraseFinal)}</p>
    <div class="ac-conc-acoes" data-passo="6">
      ${temVideo
        ? `<button type="button" class="ac-btn ac-btn-primario ac-btn-conc" onclick="acConclusaoIr('video')">
             ${acIco('play')} Assistir à mensagem dos CEOs</button>
           ${cfg.video.obrigatorio?'':`<button type="button" class="ac-btn ac-conc-ghost" onclick="acConclusaoIr('proxima')">Ver depois</button>`}`
        : `<button type="button" class="ac-btn ac-btn-primario ac-btn-conc" onclick="acConclusaoIr('proxima')">Continuar ${acIco('seta')}</button>`}
    </div>
  </div>`;

  // Coreografia curta: ~900ms até o CTA existir. Acima disso a pessoa fica
  // esperando permissão pra agir na própria conquista.
  const passos = [
    { em:0,   faz:()=>_acPasso(palco,1) },
    { em:140, faz:()=>_acPasso(palco,2) },
    { em:300, faz:()=>{ _acPasso(palco,3); acSomConquista(); } },
    { em:460, faz:()=>_acPasso(palco,4) },
    { em:620, faz:()=>_acPasso(palco,5) },
    { em:780, faz:()=>{ _acPasso(palco,6);
        const b = palco.querySelector('.ac-btn-conc'); if(b){ try{b.focus();}catch(e){} }
        const p = document.getElementById('ac-conc-pular'); if(p) p.hidden = true; } }
  ];
  _acConclusaoCancelar = acSequencia(passos);
  if(acMotionReduzido()){
    palco.querySelectorAll('[data-passo]').forEach(el=>el.classList.add('is-visivel'));
    const b = palco.querySelector('.ac-btn-conc'); if(b){ try{b.focus();}catch(e){} }
  }
}
function _acPasso(palco, n){
  palco.querySelectorAll('[data-passo="'+n+'"]').forEach(el=>el.classList.add('is-visivel'));
}

/* ── ETAPA 3 — VÍDEO DOS CEOs ── */
async function acConcEtapaVideo(palco, opts){
  const cfg = acConclusaoCfg();
  if(!cfg.video.ativo){ return acConclusaoIr('proxima', opts); }
  const v = cfg.video;
  const pos = (acState.matricula && acState.matricula.video_posicao_seg) || 0;

  palco.innerHTML = `<div class="ac-conc-video">
    <div class="ac-conc-video-cab">
      <span class="ac-conc-eyebrow is-visivel">${acIco('cap')} Mensagem da liderança</span>
      <h2 class="ac-conc-video-t is-visivel">${gEsc(v.titulo)}</h2>
      ${v.intro?`<p class="ac-conc-video-intro is-visivel">${gEsc(v.intro)}</p>`:''}
    </div>
    <div class="ac-conc-video-palco">
      <video id="ac-video-ceo" class="ac-conc-video-el" controls playsinline preload="metadata"
             ${v.thumb?`poster="${gEsc(v.thumb)}"`:''}
             aria-label="${gEsc(v.titulo)}">
        ${v.legenda?`<track kind="captions" srclang="pt-BR" label="Português" src="${gEsc(v.legenda)}" default>`:''}
      </video>
      <div class="ac-conc-video-estado" id="ac-conc-video-estado" aria-live="polite">
        <span class="mini-spinner" aria-hidden="true"></span> <span>Carregando a mensagem…</span>
      </div>
    </div>
    <div class="ac-conc-video-acoes" id="ac-conc-video-acoes">
      ${v.obrigatorio
        ? `<p class="ac-conc-video-nota">Assista até o fim para seguir — é uma mensagem curta da liderança para quem acabou de se formar.</p>
           <button type="button" class="ac-btn ac-btn-primario ac-btn-conc" id="ac-conc-video-seguir" disabled aria-disabled="true">${gEsc(v.ctaLabel)}</button>`
        : `<button type="button" class="ac-btn ac-btn-primario ac-btn-conc" onclick="acConcVideoSeguir()">${gEsc(v.ctaLabel)}</button>
           <button type="button" class="ac-btn ac-conc-ghost" onclick="acConcVideoDepois()">Assistir depois</button>`}
    </div>
  </div>`;

  const el = document.getElementById('ac-video-ceo');
  const estado = document.getElementById('ac-conc-video-estado');
  const url = await acConcVideoUrl(v);
  if(!url){
    // Vídeo indisponível NÃO pode travar a conclusão — nem quando é obrigatório.
    // Falha técnica nossa não vira bloqueio pro franqueado.
    acConcVideoFalhou(estado, v);
    return;
  }
  _acVideoCeoEl = el;
  el.addEventListener('loadedmetadata', ()=>{
    if(estado) estado.style.display='none';
    if(pos>5 && el.duration && pos < el.duration-8){ try{ el.currentTime = pos; }catch(e){} }
  });
  el.addEventListener('playing', ()=>{ if(estado) estado.style.display='none'; });
  el.addEventListener('timeupdate', ()=>{ if(el.currentTime>1) _acSalvarPosVideoCeo(el.currentTime); });
  el.addEventListener('ended', ()=>{
    _acMarcarVideo('video_visto_em');
    if(typeof gTrackEvent==='function') gTrackEvent('conclusao_video_assistido',{curso_id:acState.curso&&acState.curso.id, versao:v.versao});
    const seguir = document.getElementById('ac-conc-video-seguir');
    if(seguir){ seguir.disabled=false; seguir.removeAttribute('aria-disabled'); seguir.onclick=acConcVideoSeguir; try{seguir.focus();}catch(e){} }
    else acConcVideoSeguir();
  });
  el.addEventListener('error', ()=>acConcVideoFalhou(estado, v));
  el.src = url;
  // Sem autoplay: a pessoa dá o play. Vídeo institucional que começa sozinho com
  // som é exatamente o que o produto proíbe.
}

// Falha do vídeo: explica, oferece tentar de novo e SEMPRE deixa seguir.
function acConcVideoFalhou(estado, v){
  if(estado){
    estado.style.display='';
    estado.classList.add('is-erro');
    estado.innerHTML = `${acIco('alerta')} <span>Não consegui carregar a mensagem agora.</span>`;
  }
  const acoes = document.getElementById('ac-conc-video-acoes');
  if(acoes){
    acoes.innerHTML = `<p class="ac-conc-video-nota">A mensagem da liderança fica disponível na sua jornada — você pode assistir quando ela voltar.</p>
      <button type="button" class="ac-btn ac-btn-primario ac-btn-conc" onclick="acConclusaoIr('video')">Tentar de novo</button>
      <button type="button" class="ac-btn ac-conc-ghost" onclick="acConclusaoIr('proxima')">Continuar</button>`;
    const b = acoes.querySelector('.ac-btn-conc'); if(b){ try{b.focus();}catch(e){} }
  }
}
function acConcVideoSeguir(){
  const cfg = acConclusaoCfg();
  if(!(acState.matricula && acState.matricula.video_visto_em)) _acMarcarVideo('video_visto_em');
  acConclusaoIr('proxima');
}
function acConcVideoDepois(){
  _acMarcarVideo('video_ignorado_em');
  if(typeof gTrackEvent==='function') gTrackEvent('conclusao_video_adiado',{curso_id:acState.curso&&acState.curso.id});
  // Sem linguagem de culpa: é opcional de verdade e continua acessível na home.
  gToast('Guardamos a mensagem na sua jornada — ela fica disponível quando quiser');
  acConclusaoIr('proxima');
}
// URL do vídeo institucional: mesma regra das aulas (bucket privado = assinada).
async function acConcVideoUrl(v){
  if(v.url) return v.url;
  if(!v.path) return '';
  const sb = _acSb(); if(!sb) return '';
  try{
    const { data, error } = await sb.storage.from('luma-aulas').createSignedUrl(v.path, 7200);
    if(error) throw error;
    return (data&&data.signedUrl)||'';
  }catch(e){
    console.warn('[academia] vídeo dos CEOs não assinou:', e&&e.message||e);
    return '';
  }
}

/* ── ETAPA 4 — PRÓXIMA JORNADA ── */
function acConcEtapaProxima(palco, opts){
  const cfg = acConclusaoCfg();
  const cert = acState.certificado;
  const r = acResumo();
  const salvas = r.salvas.slice(0,3);
  // Um CTA claramente principal; o resto é secundário e discreto.
  const principal = _acConcCtaPrincipal(cfg);

  palco.innerHTML = `<div class="ac-conc-proxima">
    <span class="ac-conc-eyebrow is-visivel">${acIco('cap')} Nova etapa</span>
    <h2 class="ac-conc-prox-t is-visivel">${gEsc(cfg.fraseFinal)}</h2>
    <p class="ac-conc-prox-s is-visivel">Sua formação fica registrada e o conteúdo continua aberto para consulta sempre que precisar.</p>

    <div class="ac-conc-cards is-visivel">
      <div class="ac-conc-card">
        <span class="ac-conc-card-ico">${acIco('medal')}</span>
        <strong>Certificado</strong>
        <span>${cert?`Código ${gEsc(cert.codigo)}`:'Em emissão — aparece na sua jornada'}</span>
      </div>
      <div class="ac-conc-card">
        <span class="ac-conc-card-ico">${acIco('cap')}</span>
        <strong>Revisão permanente</strong>
        <span>${r.total} aulas seguem disponíveis${salvas.length?`, ${salvas.length} ${salvas.length===1?'salva':'salvas'} por você`:''}</span>
      </div>
      ${acVideoCeoDisponivel()?`<div class="ac-conc-card">
        <span class="ac-conc-card-ico">${acIco('play')}</span>
        <strong>Mensagem da liderança</strong>
        <span>${(acState.matricula&&acState.matricula.video_visto_em)?'Disponível para rever':'Disponível quando quiser'}</span>
      </div>`:''}
      <div class="ac-conc-card">
        <span class="ac-conc-card-ico">${acIco('bot')}</span>
        <strong>Tutor e materiais</strong>
        <span>Continuam ativos em cada aula</span>
      </div>
    </div>

    <div class="ac-conc-acoes is-visivel">
      ${principal}
      <button type="button" class="ac-btn ac-conc-ghost" onclick="acConclusaoFechar();acGo('home')">Voltar à jornada</button>
    </div>
  </div>`;
  const b = palco.querySelector('.ac-btn-conc'); if(b) setTimeout(()=>{ try{b.focus();}catch(e){} }, 120);
  if(typeof gTrackEvent==='function') gTrackEvent('conclusao_concluida',{curso_id:acState.curso&&acState.curso.id});
}
// O destino do CTA é configurável pela equipe (não fica preso ao código).
function _acConcCtaPrincipal(cfg){
  const label = gEsc(cfg.ctaLabel);
  if(cfg.ctaDestino==='url' && /^https?:\/\//i.test(cfg.ctaUrl||'')){
    return `<a class="ac-btn ac-btn-primario ac-btn-conc" href="${gEsc(cfg.ctaUrl)}" target="_blank" rel="noopener"
              onclick="acConclusaoFechar()">${label}</a>`;
  }
  if(cfg.ctaDestino==='home'){
    return `<button type="button" class="ac-btn ac-btn-primario ac-btn-conc" onclick="acConclusaoFechar();acGo('home')">${label}</button>`;
  }
  if(cfg.ctaDestino==='aula'){
    const r = acResumo();
    const alvo = (r.salvas[0] || r.aulas[0]);
    if(alvo) return `<button type="button" class="ac-btn ac-btn-primario ac-btn-conc" onclick="acConclusaoFechar();acGo('aula','${alvo.id}')">${label}</button>`;
  }
  return `<button type="button" class="ac-btn ac-btn-primario ac-btn-conc" onclick="acConclusaoFechar();acGo('certificado')">${label}</button>`;
}

/* ══════════════════════════════════════════════════════════════
   ENTRADAS PÚBLICAS (home e gestão)
══════════════════════════════════════════════════════════════ */
// "Rever conclusão" — ação explícita, começa na splash (sem a contagem do anel,
// que só faz sentido no momento em que o progresso fecha).
function acReverConclusao(){ acConclusaoAbrir({ etapa:'splash' }); }
// "Ver a mensagem dos CEOs" — atalho direto ao vídeo, da home.
function acVerVideoCeos(){ acConclusaoAbrir({ etapa:'video' }); }
// Preview da equipe: mesma experiência, marcada, sem gravar nada no progresso.
function acPreviewConclusao(etapa){
  if(!acState.curso){ gToast('⚠ Crie a formação antes de pré-visualizar','error'); return; }
  acConclusaoAbrir({ etapa: etapa||'confirmacao', preview:true });
}
