/**
 * js/academia/motion.js
 *
 * ACADEMIA — SISTEMA DE MOTION. As decisões de movimento do módulo moram AQUI,
 * não espalhadas em cada render. Quem anima chama um destes helpers.
 *
 * REGRA: nenhum valor de duração ou curva nasce neste arquivo. Tudo vem dos
 * tokens de `css/00-tokens.css` (4 durações + 5 curvas já existentes, mais o
 * --dur-celebration que a Academia acrescentou). Duração em ms na mão dentro de
 * JS é o mesmo erro que hex solto no CSS.
 *
 * O QUE SÓ ANIMA COM PROPÓSITO: cada helper aqui resolve um problema concreto
 * que a auditoria encontrou — progresso que aparecia pronto sem animar, altura
 * que saltava no acordeão, centro da aula que piscava ao trocar, histórico do
 * chat que re-animava inteiro a cada mensagem. Não há helper "para deixar bonito".
 *
 * REDUÇÃO DE MOVIMENTO: `acMotionReduzido()` é consultado por TODOS os helpers.
 * Nesse modo eles aplicam o ESTADO FINAL na hora — nunca escondem informação,
 * nunca pulam etapa. O CSS tem a sua própria guarda; isto cobre o que é JS.
 *
 * Depende de: nada. Carrega antes de academia.js.
 */

/* ══════════════════════════════════════════════════════════════
   PREFERÊNCIA DO USUÁRIO
══════════════════════════════════════════════════════════════ */
// Consultado a cada chamada (não cacheado): a pessoa pode virar a preferência do
// sistema com o app aberto, e o matchMedia é barato.
function acMotionReduzido(){
  try{ return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch(e){ return false; }
}

// Lê um token de duração e devolve em ms. Fonte única: o CSS.
function acDur(nome){
  if(acMotionReduzido()) return 0;
  try{
    const v = getComputedStyle(document.documentElement).getPropertyValue('--dur-'+nome).trim();
    if(/ms$/.test(v)) return parseFloat(v)||0;
    if(/s$/.test(v))  return (parseFloat(v)||0)*1000;
  }catch(e){}
  // Espelho dos tokens, só para o caso de o CSS não ter carregado ainda.
  return ({micro:140, fast:180, base:260, slow:420, celebration:720})[nome] || 200;
}
function acEase(nome){
  try{
    const v = getComputedStyle(document.documentElement).getPropertyValue('--ease-'+nome).trim();
    if(v) return v;
  }catch(e){}
  return 'ease';
}

/* ══════════════════════════════════════════════════════════════
   1) CASCATA DE ENTRADA
   Problema: a home aparecia inteira de uma vez. Solução: a ESTRUTURA entra
   imediatamente (nada de tela vazia) e só os blocos de conteúdo recebem um
   atraso curto e crescente. Teto de 6 itens e de ~180ms no total de atraso —
   acima disso a última linha demora a existir e a página parece lenta.
══════════════════════════════════════════════════════════════ */
function acCascata(raiz, seletor){
  if(!raiz || acMotionReduzido()) return;
  const itens = Array.from(raiz.querySelectorAll(seletor||'[data-ac-entra]'));
  itens.slice(0, 6).forEach((el, i)=>{
    el.style.setProperty('--ac-atraso', (i*30)+'ms');
    el.classList.add('ac-entra');
  });
  // Além do 6º item: entra sem atraso (ainda com fade), pra não virar fila lenta.
  itens.slice(6).forEach(el=>{ el.style.setProperty('--ac-atraso','0ms'); el.classList.add('ac-entra'); });
}

/* ══════════════════════════════════════════════════════════════
   2) NÚMERO E BARRA DE PROGRESSO
   Problema: o valor era escrito inline no HTML, então a transição CSS não tinha
   de onde partir e o progresso aparecia pronto. Agora o render pinta o valor
   ANTERIOR e estes helpers levam até o atual — é isso que dá a sensação de
   "avancei". O valor anterior fica em memória por chave.
══════════════════════════════════════════════════════════════ */
const _acProgAnterior = {};                      // chave → último valor mostrado
function acProgLembrado(chave, atual){
  const ant = _acProgAnterior[chave];
  return (ant==null) ? atual : ant;              // 1ª vez: parte do próprio valor
}
function acProgGuardar(chave, valor){ _acProgAnterior[chave] = valor; }

/**
 * Anima um número inteiro de `de` até `para` dentro do elemento.
 * Curto e legível: sem "roleta" girando dígitos aleatórios.
 * @param {Element} el
 * @param {number} de @param {number} para
 * @param {function} fmt formata o valor (padrão: inteiro + '%')
 */
function acAnimaNumero(el, de, para, fmt){
  if(!el) return;
  fmt = fmt || (n=>Math.round(n)+'%');
  if(acMotionReduzido() || de===para){ el.textContent = fmt(para); return; }
  const dur = acDur('slow');
  const t0 = performance.now();
  // easeOutCubic: chega ao valor e assenta — combina com o --ease-out do CSS.
  const passo = (agora)=>{
    // Clamp nos DOIS lados. O timestamp que o rAF entrega pode ser ANTERIOR ao
    // performance.now() capturado logo acima (ele marca o início do quadro), e aí
    // a fração ficava negativa: a easing cúbica devolvia valor abaixo do inicial
    // e o número piscava "-3%" antes de subir. (Medido no navegador.)
    const p = Math.min(1, Math.max(0, (agora-t0)/dur));
    const e = 1 - Math.pow(1-p, 3);
    el.textContent = fmt(de + (para-de)*e);
    if(p<1) requestAnimationFrame(passo);
    else el.textContent = fmt(para);            // fecha exato no valor
  };
  requestAnimationFrame(passo);
}

/** Leva a barra (o <i> dentro de .ac-barra) até a largura final. */
function acAnimaBarra(barra, pct){
  if(!barra) return;
  const i = barra.querySelector('i'); if(!i) return;
  const alvo = Math.max(0, Math.min(100, pct));
  if(acMotionReduzido()){ i.style.width = alvo+'%'; return; }
  // rAF duplo: garante que o browser registrou a largura inicial antes de trocar,
  // senão ele resolve como um único estilo e não há transição.
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ i.style.width = alvo+'%'; }));
}

/** Leva o anel de progresso (SVG) até o valor. Mesma mecânica da barra. */
function acAnimaAnel(circulo, pct, circunferencia){
  if(!circulo) return;
  const off = circunferencia * (1 - Math.max(0,Math.min(100,pct))/100);
  if(acMotionReduzido()){ circulo.style.strokeDashoffset = off.toFixed(1); return; }
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ circulo.style.strokeDashoffset = off.toFixed(1); }));
}

/* ══════════════════════════════════════════════════════════════
   3) ALTURA REAL (acordeão)
   Problema: os módulos da sidebar abriam com display:none → block, então a
   altura saltava. `height:auto` não é animável, então medimos o conteúdo,
   animamos até o número e devolvemos `auto` no fim (senão o conteúdo que cresce
   depois — uma aula nova — fica cortado).
══════════════════════════════════════════════════════════════ */
function acAltura(el, abrir){
  if(!el) return;
  if(acMotionReduzido()){
    el.style.height=''; el.style.overflow=''; el.hidden = !abrir; return;
  }
  const dur = acDur('base');
  el.style.overflow = 'hidden';
  if(abrir){
    el.hidden = false;
    const alvo = el.scrollHeight;
    el.style.height = '0px';
    requestAnimationFrame(()=>{
      el.style.transition = `height ${dur}ms ${acEase('out')}`;
      el.style.height = alvo+'px';
    });
    const fim = ()=>{ el.style.height=''; el.style.overflow=''; el.style.transition=''; el.removeEventListener('transitionend', fim); };
    el.addEventListener('transitionend', fim);
    // Rede de segurança: se o transitionend não vier (elemento removido, aba em
    // background), a altura fixa ficaria travada e cortaria conteúdo.
    setTimeout(fim, dur+80);
  }else{
    el.style.height = el.scrollHeight+'px';
    requestAnimationFrame(()=>{
      el.style.transition = `height ${dur}ms ${acEase('in')}`;
      el.style.height = '0px';
    });
    const fim = ()=>{ el.hidden = true; el.style.height=''; el.style.overflow=''; el.style.transition=''; el.removeEventListener('transitionend', fim); };
    el.addEventListener('transitionend', fim);
    setTimeout(fim, dur+80);
  }
}

/* ══════════════════════════════════════════════════════════════
   4) TROCA DE CONTEÚDO (crossfade curto)
   Problema: trocar de aula ou de aba substituía o innerHTML e a região piscava.
   Aqui o conteúdo antigo sai em fade rápido, o novo entra com fade + 6px.
   O contêiner NÃO é travado em altura: preservamos a altura mínima durante a
   troca só para a página não pular, e liberamos em seguida.
══════════════════════════════════════════════════════════════ */
function acTroca(el, pintar){
  if(!el){ return; }
  if(acMotionReduzido() || typeof pintar!=='function'){ if(pintar) pintar(); return; }
  const alturaAntes = el.offsetHeight;
  const durSai = acDur('micro'), durEntra = acDur('fast');
  el.style.transition = `opacity ${durSai}ms ${acEase('in')}`;
  el.style.opacity = '0';
  setTimeout(()=>{
    // minHeight evita o salto entre "vazio" e o conteúdo novo montado.
    if(alturaAntes) el.style.minHeight = alturaAntes+'px';
    pintar();
    el.style.transition = `opacity ${durEntra}ms ${acEase('out')}, transform ${durEntra}ms ${acEase('out')}`;
    el.style.transform = 'translateY(6px)';
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      el.style.opacity = '1';
      el.style.transform = 'none';
    }));
    setTimeout(()=>{
      el.style.transition=''; el.style.transform=''; el.style.minHeight='';
    }, durEntra+60);
  }, durSai);
}

/* ══════════════════════════════════════════════════════════════
   5) PULSO DE CONFIRMAÇÃO
   Feedback pontual de "isso aqui mudou agora" — usado na linha da aula que
   acabou de concluir e no card do módulo fechado. Uma classe, removida no fim:
   estado permanente de animação é o que transforma UI em árvore de natal.
══════════════════════════════════════════════════════════════ */
function acPulso(el, tipo){
  if(!el || acMotionReduzido()) return;
  const cls = 'ac-pulso' + (tipo?'-'+tipo:'');
  el.classList.remove(cls);
  void el.offsetWidth;              // reinicia a animação se ela já rodou
  el.classList.add(cls);
  const dur = acDur(tipo==='marco' ? 'celebration' : 'base');
  setTimeout(()=>el.classList.remove(cls), dur+120);
}

/* ══════════════════════════════════════════════════════════════
   6) SEQUÊNCIA (coreografia da splash)
   Passos com atraso relativo, canceláveis. Devolve uma função de cancelamento
   porque o usuário PODE pular a animação — e uma splash que não se deixa
   interromper é armadilha, não experiência.
══════════════════════════════════════════════════════════════ */
function acSequencia(passos){
  const timers = [];
  let acumulado = 0;
  (passos||[]).forEach(p=>{
    const espera = acMotionReduzido() ? 0 : (p.em!=null ? p.em : acumulado);
    acumulado = espera + (p.dur||0);
    if(espera<=0){ try{ p.faz&&p.faz(); }catch(e){} }
    else timers.push(setTimeout(()=>{ try{ p.faz&&p.faz(); }catch(e){} }, espera));
  });
  return function cancelar(){ timers.forEach(clearTimeout); timers.length=0; };
}

/* ══════════════════════════════════════════════════════════════
   7) SOM DE CONQUISTA
   Reusa o sistema que já existe (js/core/sound.js) — não cria áudio novo. Só no
   marco da FORMAÇÃO, nunca por aula. Silencia em redução de movimento (quem
   pede menos estímulo raramente quer o sonoro) e depende de interação prévia,
   que sempre houve: a pessoa clicou para concluir.
══════════════════════════════════════════════════════════════ */
function acSomConquista(){
  if(acMotionReduzido()) return;
  try{
    // gPlayBatchCompleteSound é o chime DE CONCLUSÃO da casa (duplo, Dó5→Sol5).
    // gPlayExportSuccessSound é de download — fica como reserva.
    if(typeof window.gPlayBatchCompleteSound === 'function') window.gPlayBatchCompleteSound();
    else if(typeof window.gPlayExportSuccessSound === 'function') window.gPlayExportSuccessSound();
  }catch(e){}
}
