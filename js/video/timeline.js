/**
 * js/video/timeline.js
 *
 * A TIMELINE — a rede de segurança. Existe para que qualquer decisão da IA
 * possa ser desfeita à mão (docs/LUMA-VIDEO.md §9, fase 3): por isso ela vem
 * ANTES da IA no cronograma, não depois.
 *
 * Uma trilha só (vídeo), porque é só isso que o compositor executa hoje.
 * Legenda, overlay e SFX ganham a própria trilha quando existirem — trilha
 * vazia na tela é promessa que a ferramenta não cumpre.
 *
 * ⚠ `vdTlPlayhead` é chamada a cada frame: ela move UM elemento por transform e
 * não toca no resto. Reconstruir a trilha 30×/s derrubaria a prévia (e perderia
 * a seleção do usuário no meio do gesto).
 *
 * Depende de: video/projeto.js, video/compositor.js.
 */

let vdSel = null;            // id do segmento selecionado (nunca a referência viva)
let _vdTlArrastando = false;

function vdTlRender(){
  const trilha = document.getElementById('vd-tl-track');
  if(!trilha) return;
  const total = vdDuracaoFinal() || 1;
  const segs = vdSegs();
  trilha.innerHTML = '';
  segs.forEach((s, i) => {
    const bloco = document.createElement('button');
    bloco.type = 'button';
    bloco.className = 'vd-seg' + (s.id === vdSel ? ' sel' : '');
    bloco.style.width = (vdSegDur(s) / total * 100) + '%';
    bloco.dataset.id = s.id;
    bloco.setAttribute('aria-label', 'Trecho ' + (i + 1) + ', ' + vdFmtTempo(vdSegDur(s)));
    // Rótulo só cabe em bloco largo; abaixo disso vira listra e o tempo mora no
    // inspetor. Texto miúdo ilegível é pior que nenhum texto.
    bloco.innerHTML = '<span class="vd-seg-dur">' + vdFmtTempo(vdSegDur(s)) + '</span>'
      + (s.zoom > 1.001 ? '<span class="vd-seg-tag">zoom</span>' : '');
    bloco.addEventListener('click', ev => { ev.stopPropagation(); vdSelecionar(s.id); });
    trilha.appendChild(bloco);
  });
  const ph = document.createElement('div');
  ph.id = 'vd-playhead'; ph.className = 'vd-playhead'; ph.setAttribute('aria-hidden', 'true');
  trilha.appendChild(ph);
  vdTlPlayhead(vdTempoLinha());
}

function vdTlPlayhead(t){
  const ph = document.getElementById('vd-playhead');
  if(!ph) return;
  const total = vdDuracaoFinal() || 1;
  ph.style.left = Math.min(Math.max(t / total, 0), 1) * 100 + '%';
  const rel = document.getElementById('vd-tempo');
  if(rel) rel.textContent = vdFmtTempo(t) + ' / ' + vdFmtTempo(total);
}

function vdSelecionar(id){
  vdSel = (vdSel === id) ? null : id;
  vdTlRender();
  vdRenderInspetor();
}

/* ── Arrastar o playhead ──────────────────────────────────────────────────
   Pointer events (não mouse/touch separados): um caminho só, e o `setPointerCapture`
   mantém o arrasto vivo quando o cursor sai da trilha. */
function vdTlPointerDown(ev){
  const trilha = document.getElementById('vd-tl-track');
  if(!trilha || !vdProj) return;
  _vdTlArrastando = true;
  try{ trilha.setPointerCapture(ev.pointerId); }catch(e){}
  vdPausar();
  vdTlPointerMove(ev);
}

function vdTlPointerMove(ev){
  if(!_vdTlArrastando) return;
  const trilha = document.getElementById('vd-tl-track');
  if(!trilha) return;
  const r = trilha.getBoundingClientRect();
  const frac = Math.min(Math.max((ev.clientX - r.left) / (r.width || 1), 0), 1);
  const t = frac * vdDuracaoFinal();
  vdIrPara(t);
  vdTlPlayhead(t);
}

function vdTlPointerUp(ev){
  if(!_vdTlArrastando) return;
  _vdTlArrastando = false;
  const trilha = document.getElementById('vd-tl-track');
  if(trilha) try{ trilha.releasePointerCapture(ev.pointerId); }catch(e){}
}
