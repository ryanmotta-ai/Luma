/**
 * js/tutorial/engine.js
 *
 * Engine do TutorialEngine: tutState, tutOpen, tutClose, tutNext,
 * tutGoToScene, tutRenderScene, cursor virtual, spotlights, progress.
 * Depende de: 01-state.js, tutorial/catalog.js, tutorial/mocks.js
 * Exporta: tutOpen, tutClose, tutNext, tutPrev, tutTogglePlay, tutGoToScene
 */

/* ══════════════════════════════════════════════════════════════
   TUTORIAL ENGINE — sistema de tutoriais interativos
   ────────────────────────────────────────────────────────────── */

// Estado global do tutorial
let tutState = {
  activeId: null,        // id do tutorial em execução
  scenes: [],            // array de cenas do tutorial atual
  sceneIdx: -1,          // índice da cena atual
  playing: false,        // se tá tocando (auto-play)
  sceneTimer: null,      // timeout pra próxima cena
  sceneStartTs: 0,       // quando a cena atual começou
  sceneDuration: 4000,   // duração padrão por cena (ms)
  sceneTimers: [],       // timers internos da cena atual (cancelados em transição)
};

// Helper: agenda setTimeout que será cancelado quando a cena trocar
function tutSceneTimeout(fn, ms){
  const id = setTimeout(()=>{
    fn();
    // Remove da lista quando executa
    const idx = tutState.sceneTimers.indexOf(id);
    if(idx >= 0) tutState.sceneTimers.splice(idx, 1);
  }, ms);
  tutState.sceneTimers.push(id);
  return id;
}

// Cancela todos os timers internos da cena atual
function tutClearSceneTimers(){
  tutState.sceneTimers.forEach(id => clearTimeout(id));
  tutState.sceneTimers = [];
}


function tutOpen(id){
  if(typeof gFeatureCan==='function' && !gFeatureCan('global.tutorials','access')){
    if(typeof gFeatureBlockedFeedback==='function') gFeatureBlockedFeedback('global.tutorials');
    return;
  }
  const tutorial = TUTORIALS[id];
  if(!tutorial){ console.warn('Tutorial não encontrado:', id); return; }
  tutState.activeId = id;
  tutState.scenes = tutorial.scenes;
  tutState.sceneIdx = -1;
  // Atualiza header
  document.getElementById('tut-title').textContent = tutorial.title;
  document.getElementById('tut-finale-desc').textContent = `Agora você sabe ${tutorial.description.toLowerCase()}`;
  // Limpa finale anterior
  document.getElementById('tut-finale').classList.remove('show');
  // Renderiza progress dots
  tutRenderProgress();
  // Abre stage
  const stage = document.getElementById('tut-stage');
  stage.classList.add('open');
  document.body.style.overflow = 'hidden';
  // Focus trap básico — manda foco pro botão next
  setTimeout(()=>{
    document.getElementById('tut-btn-next')?.focus();
    tutState.playing = true;
    tutGoToScene(0);
  }, 100);
}

function tutClose(){
  document.getElementById('tut-exit-bar')?.classList.remove('show');
  const stage = document.getElementById('tut-stage');
  stage.classList.add('closing');
  tutPause();
  tutClearSceneTimers();
  clearTimeout(tutState.transitionTimer); // cancela transição pendente ao fechar
  setTimeout(()=>{
    stage.classList.remove('open','closing');
    document.body.style.overflow = '';
    tutState.activeId = null;
    tutState.sceneIdx = -1;
  }, 300);
}

function tutAskClose(){
  if(tutState.sceneIdx <= 0 || document.getElementById('tut-finale').classList.contains('show')){
    tutClose(); return;
  }
  tutPause();
  document.getElementById('tut-exit-bar').classList.add('show');
}

function tutExitCancel(){
  document.getElementById('tut-exit-bar').classList.remove('show');
  tutPlay();
}

function tutGoToScene(idx){
  if(idx < 0 || idx >= tutState.scenes.length){
    if(idx >= tutState.scenes.length){ tutShowFinale(); }
    return;
  }
  const prevScene = document.querySelector('.tut-scene .tut-scene-content');
  const sceneEl = document.getElementById('tut-scene');

  // Anima saída da cena anterior
  if(prevScene){
    prevScene.parentElement.classList.add('tut-scene-exit');
    clearTimeout(tutState.transitionTimer); // cancela transição pendente (navegação rápida)
    tutState.transitionTimer = setTimeout(()=>tutRenderScene(idx), 280);
  } else {
    tutRenderScene(idx);
  }
}

function tutRenderScene(idx){
  // Cancela timers internos da cena anterior pra evitar callbacks órfãos
  tutClearSceneTimers();
  tutState.sceneIdx = idx;
  const scene = tutState.scenes[idx];
  const sceneEl = document.getElementById('tut-scene');

  // Esconde cursor e tooltip durante transição
  document.getElementById('tut-cursor').classList.remove('show', 'clicking');
  document.getElementById('tut-tooltip').classList.remove('show');

  // Constrói cena
  sceneEl.innerHTML = scene.build();
  sceneEl.classList.remove('tut-scene-exit');
  sceneEl.classList.add('tut-scene-enter');
  setTimeout(()=>sceneEl.classList.remove('tut-scene-enter'), 550);

  // Roda hook after da cena (animações específicas)
  if(scene.after){
    tutSceneTimeout(()=>scene.after(), 100); // rastreado → cancelado em tutClearSceneTimers
  }

  // Posiciona tooltip se houver
  if(scene.tooltip){
    tutSceneTimeout(()=>tutShowTooltip(scene.tooltip), 600); // idem — evita tooltip da cena anterior aparecer
  }

  // Atualiza progresso
  tutUpdateProgress();
  tutUpdateButtons();

  // Auto-advance se tá playing
  tutState.sceneStartTs = Date.now();
  tutState.sceneDuration = scene.duration || 4000;
  if(tutState.playing){
    clearTimeout(tutState.sceneTimer);
    tutState.sceneTimer = setTimeout(()=>{
      if(tutState.playing) tutNext();
    }, tutState.sceneDuration);
  }
}

function tutShowTooltip(config){
  const tooltip = document.getElementById('tut-tooltip');
  document.getElementById('tut-tooltip-text').textContent = config.text;
  document.getElementById('tut-tooltip-step').textContent = `Passo ${tutState.sceneIdx + 1} de ${tutState.scenes.length}`;
  // Posiciona relativo ao target
  const target = document.querySelector(config.target);
  if(!target){ tooltip.classList.remove('show'); return; }
  const rect = target.getBoundingClientRect();
  const stageRect = document.getElementById('tut-stage-area').getBoundingClientRect();
  const placement = config.placement || 'bottom';
  tooltip.setAttribute('data-arrow', {top:'bottom',bottom:'top',left:'right',right:'left'}[placement]);
  // Posiciona
  let left = 0, top = 0;
  const ttW = 280, ttH = 80;
  if(placement === 'bottom'){
    left = rect.left - stageRect.left + rect.width/2 - ttW/2;
    top = rect.bottom - stageRect.top + 14;
  } else if(placement === 'top'){
    left = rect.left - stageRect.left + rect.width/2 - ttW/2;
    top = rect.top - stageRect.top - ttH - 14;
  } else if(placement === 'right'){
    left = rect.right - stageRect.left + 14;
    top = rect.top - stageRect.top + rect.height/2 - ttH/2;
  } else if(placement === 'left'){
    left = rect.left - stageRect.left - ttW - 14;
    top = rect.top - stageRect.top + rect.height/2 - ttH/2;
  }
  // Clamp pra não sair da stage
  const stageW = stageRect.width, stageH = stageRect.height;
  left = Math.max(12, Math.min(left, stageW - ttW - 12));
  top = Math.max(12, Math.min(top, stageH - ttH - 12));
  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
  tooltip.classList.add('show');
}

function tutMoveCursor(targetSel, action){
  const cursor = document.getElementById('tut-cursor');
  const target = document.querySelector(targetSel);
  if(!target) return;
  const rect = target.getBoundingClientRect();
  const stageRect = document.getElementById('tut-stage-area').getBoundingClientRect();
  const tx = rect.left - stageRect.left + rect.width/2;
  const ty = rect.top - stageRect.top + rect.height/2;
  cursor.style.transition = 'transform .9s cubic-bezier(.16,1,.3,1), opacity .3s';
  cursor.style.transform = `translate(${tx}px, ${ty}px)`;
  cursor.classList.add('show');
  if(action === 'click'){
    setTimeout(()=>{
      cursor.classList.add('clicking');
      setTimeout(()=>cursor.classList.remove('clicking'), 600);
    }, 950);
  }
}

function tutRenderProgress(){
  const wrap = document.getElementById('tut-progress');
  wrap.innerHTML = tutState.scenes.map((s, i) =>
    `<div class="tut-progress-dot" data-idx="${i}" onclick="tutGoToScene(${i})"></div>`
  ).join('');
}

function tutUpdateProgress(){
  document.querySelectorAll('.tut-progress-dot').forEach((dot, i) => {
    dot.classList.remove('done', 'current', 'paused');
    if(i < tutState.sceneIdx) dot.classList.add('done');
    else if(i === tutState.sceneIdx){
      dot.classList.add('current');
      dot.style.setProperty('--scene-duration', `${tutState.sceneDuration}ms`);
      if(!tutState.playing) dot.classList.add('paused');
    }
  });
}

function tutUpdateButtons(){
  const prev = document.getElementById('tut-btn-prev');
  const next = document.getElementById('tut-btn-next');
  const nextLabel = document.getElementById('tut-btn-next-label');
  prev.disabled = tutState.sceneIdx <= 0;
  if(tutState.sceneIdx >= tutState.scenes.length - 1){
    nextLabel.textContent = 'Finalizar';
  } else {
    nextLabel.textContent = 'Próximo';
  }
}

function tutNext(){
  if(tutState.sceneIdx >= tutState.scenes.length - 1){
    tutShowFinale();
  } else {
    tutGoToScene(tutState.sceneIdx + 1);
  }
}

function tutPrev(){
  if(tutState.sceneIdx > 0) tutGoToScene(tutState.sceneIdx - 1);
}

function tutTogglePlay(){
  if(tutState.playing){
    tutPause();
  } else {
    tutPlay();
  }
}

function tutPlay(){
  tutState.playing = true;
  document.getElementById('tut-icon-pause').style.display = '';
  document.getElementById('tut-icon-play').style.display = 'none';
  // Reinicia timer pra cena atual (com duração restante)
  const elapsed = Date.now() - tutState.sceneStartTs;
  const remaining = Math.max(500, tutState.sceneDuration - elapsed);
  clearTimeout(tutState.sceneTimer);
  tutState.sceneTimer = setTimeout(()=>{
    if(tutState.playing) tutNext();
  }, remaining);
  // Remove paused dos dots
  document.querySelectorAll('.tut-progress-dot.paused').forEach(d=>d.classList.remove('paused'));
}

function tutPause(){
  tutState.playing = false;
  clearTimeout(tutState.sceneTimer);
  document.getElementById('tut-icon-pause').style.display = 'none';
  document.getElementById('tut-icon-play').style.display = '';
  document.querySelectorAll('.tut-progress-dot.current').forEach(d=>d.classList.add('paused'));
}

function tutShowFinale(){
  tutPause();
  document.getElementById('tut-finale').classList.add('show');
  // Marca como concluído no localStorage
  try {
    const completed = JSON.parse(localStorage.getItem('yngs_tutorials_done')||'[]');
    if(!completed.includes(tutState.activeId)){
      completed.push(tutState.activeId);
      localStorage.setItem('yngs_tutorials_done', JSON.stringify(completed));
    }
  } catch(e){}
}

function tutReplay(){
  document.getElementById('tut-finale').classList.remove('show');
  tutState.playing = true;
  document.getElementById('tut-icon-pause').style.display = '';
  document.getElementById('tut-icon-play').style.display = 'none';
  tutGoToScene(0);
}

// Atalhos de teclado dentro do tutorial
document.addEventListener('keydown', (e)=>{
  const stage = document.getElementById('tut-stage');
  if(!stage || !stage.classList.contains('open')) return;
  if(e.key === 'Escape'){ e.preventDefault(); tutAskClose(); }
  else if(e.key === 'ArrowRight'){ e.preventDefault(); tutNext(); }
  else if(e.key === 'ArrowLeft'){ e.preventDefault(); tutPrev(); }
  else if(e.key === ' '){ e.preventDefault(); tutTogglePlay(); }
});
