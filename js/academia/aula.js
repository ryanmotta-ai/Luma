/**
 * js/academia/aula.js
 *
 * ACADEMIA — AMBIENTE DE AULA. O núcleo do módulo: três regiões no desktop
 * (estrutura do curso · aula · agente educacional), player MP4 com retomada e
 * as ferramentas de aprendizado em abas.
 *
 * DECISÃO DE PLAYER: `<video controls>` NATIVO + o que o nativo não dá.
 * O nativo já entrega play/pause, volume, tela cheia, barra de progresso,
 * tempo/duração, teclado e leitor de tela — de graça e melhor do que uma
 * reimplementação. Em cima dele construímos só o que falta pro produto:
 * retomada do ponto salvo, velocidade com rótulo visível, ±10s, medidor de
 * assistido honesto e persistência. Player 100% custom seria mais código e
 * menos acessível.
 *
 * ARMADILHA DE RE-RENDER: reconstruir o HTML da aula DESTRÓI o <video> e perde a
 * reprodução. Por isso o miolo só é remontado quando a AULA muda (_acAulaMontada);
 * sidebar, abas e agente têm re-render próprio em containers separados.
 *
 * Depende de: academia.js (acState, acProg, acSalvarProgresso, acVideoUrl…),
 * core/toast.js (gToast, gEsc, gConfirm), core/supabase.js (gTrackEvent).
 */

let _acAulaMontada = null;     // id da aula cujo DOM está montado
let acAulaAba = 'visao';       // visao | materiais | notas | transcricao | atividade
let _acVideoEl = null;
let _acAssistido = 0;          // segundos REALMENTE assistidos nesta sessão de aula
let _acUltimoTick = 0;
let _acSalvarTimer = null;
let _acNotaEditando = null;    // id da nota em edição (null = criando)

const AC_RASCUNHO_NOTA = 'yngs_ac_nota_rascunho_v1';

/* ══════════════════════════════════════════════════════════════
   RENDER — casca + partes
══════════════════════════════════════════════════════════════ */
function acRenderAula(root, opts){
  opts = opts||{};
  const aula = acAula(acState.aulaId);
  if(!aula){ acGo('home'); return; }

  // Aula bloqueada por pré-requisito: estado próprio, não erro seco.
  if(!acAulaLiberada(aula)){
    root.innerHTML = acAulaBloqueada(aula);
    _acAulaMontada = null;
    return;
  }

  // Casca ausente = o #ac-root foi reescrito por outra rota (home/gestão/certificado).
  // _acAulaMontada TEM de zerar junto: sem isso, voltar pra MESMA aula reconstruía a
  // casca e pulava acRenderAulaMain (o id não mudou) — a região central ficava vazia.
  if(!document.getElementById('ac-aula')){
    _acAulaMontada = null;
    root.innerHTML = `<div class="ac-aula" id="ac-aula">
      <button type="button" class="ac-side-veu" id="ac-side-veu" aria-label="Fechar estrutura do curso" onclick="acFecharPaineis()"></button>
      <nav class="ac-side" id="ac-aula-side" aria-label="Estrutura da formação"></nav>
      <main class="ac-main" id="ac-aula-main"></main>
      <aside class="ac-agente" id="ac-agente" aria-label="Agente educacional"></aside>
    </div>`;
  }
  acRenderSidebar();
  if(_acAulaMontada !== aula.id){
    // Crossfade só quando a casca JÁ existia (troca de aula dentro do ambiente).
    // Na primeira montagem não há de onde cruzar — animar ali só atrasaria a tela.
    const main = document.getElementById('ac-aula-main');
    const primeira = _acAulaMontada === null || !main || !main.childElementCount;
    if(primeira || typeof acTroca!=='function') acRenderAulaMain(aula);
    else acTroca(main, ()=>acRenderAulaMain(aula));
    _acAulaMontada = aula.id;
  }
  else acRenderAbas(aula);
  if(typeof acRenderAgente==='function') acRenderAgente(aula);
  acAplicarAgenteRecolhido();
}

function acAulaBloqueada(aula){
  const mod = aula._modulo || acModulo(aula.modulo_id);
  const prereq = mod && acModulo(mod.prereq_modulo_id);
  return `<div class="ac-home"><div class="ac-bloco">
    ${acVazio('lock','Esta aula ainda não está liberada',
      prereq?`Conclua as aulas obrigatórias de ${prereq.nome} para seguir para ${mod.nome}.`
            :'Conclua o módulo anterior para seguir.',
      `<button type="button" class="ac-btn ac-btn-ghost" onclick="acGo('home')">Voltar à jornada</button>`)}
  </div></div>`;
}

/* ══════════════════════════════════════════════════════════════
   COLUNA ESQUERDA — estrutura e progresso
══════════════════════════════════════════════════════════════ */
function acRenderSidebar(){
  const el = document.getElementById('ac-aula-side'); if(!el) return;
  const c = acState.curso, r = acResumo();
  el.innerHTML = `
    <div class="ac-side-topo">
      <button type="button" class="ac-side-voltar" onclick="acGo('home')">
        ${acIco('volta')} <span>Jornada</span>
      </button>
      <button type="button" class="ac-side-fechar" onclick="acFecharPaineis()" aria-label="Fechar estrutura do curso">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
    </div>
    <div class="ac-side-curso">
      <span class="ac-side-eyebrow">Formação</span>
      <strong class="ac-side-nome">${gEsc(c&&c.nome||'')}</strong>
      <span class="ac-barra ac-barra-sm" role="img" aria-label="${r.pct}% da formação concluída"><i style="width:${r.pct}%"></i></span>
      <span class="ac-side-pct">${r.pct}% · ${r.concluidas}/${r.total} aulas</span>
    </div>
    <ul class="ac-side-mods">
      ${(c&&c.modulos||[]).map(acSidebarModulo).join('')}
    </ul>`;
  // Aula atual visível sem o usuário caçar na lista (a lista pode ser longa).
  const ativo = el.querySelector('.ac-side-aula.is-atual');
  if(ativo && ativo.scrollIntoView) { try{ ativo.scrollIntoView({block:'nearest'}); }catch(e){} }
}

function acSidebarModulo(m){
  const est = acModuloEstado(m);
  const aulas = m.aulas||[];
  const temAtual = aulas.some(a=>a.id===acState.aulaId);
  // Aberto por padrão: o módulo da aula atual e o em andamento. Os outros ficam
  // recolhidos pra lista não virar um paredão de 40 linhas.
  const aberto = temAtual || est==='andamento';
  const feitas = aulas.filter(a=>acProg(a.id).concluida).length;
  const bloq = est==='bloqueado';
  return `<li class="ac-side-mod is-${est}${aberto?' is-aberto':''}">
    <button type="button" class="ac-side-mod-cab" aria-expanded="${aberto?'true':'false'}"
            aria-controls="ac-aulas-${m.id}" onclick="acToggleModulo(this)">
      <span class="ac-side-mod-ico" aria-hidden="true">${
        est==='concluido'?acIco('check'):est==='atualizado'?acIco('novo'):bloq?acIco('lock'):acIco('chev','ac-i-chev')}</span>
      <span class="ac-side-mod-txt">
        <span class="ac-side-mod-nome">${gEsc(m.nome)}</span>
        <span class="ac-side-mod-meta">${feitas}/${aulas.length}${bloq?' · bloqueado':''}</span>
      </span>
    </button>
    <ul class="ac-side-aulas" id="ac-aulas-${m.id}"${aberto?'':' hidden'}>${aulas.map(a=>acSidebarAula(a,m,bloq)).join('')}</ul>
  </li>`;
}

function acSidebarAula(a, m, bloq){
  const p = acProg(a.id);
  const atual = a.id===acState.aulaId;
  const atualizada = acAulaAtualizada(a);
  // Estado nunca só por cor: ícone (forma) + texto no aria-label.
  const ico = p.concluida ? acIco('check','ac-i-ok')
            : bloq ? acIco('lock')
            : atual ? acIco('play','ac-i-play')
            : `<span class="ac-side-dot" aria-hidden="true"></span>`;
  const rot = [
    p.concluida?'concluída':(p.posicao_seg>5?'em andamento':'não iniciada'),
    a.obrigatoria?'':'opcional',
    atualizada?'conteúdo atualizado':''
  ].filter(Boolean).join(', ');
  return `<li>
    <${bloq?'div':'button type="button"'} class="ac-side-aula${atual?' is-atual':''}${p.concluida?' is-ok':''}"
      ${bloq?'':`onclick="acAbrirAula('${a.id}')"`}
      ${atual?'aria-current="true"':''}
      ${bloq?'':`aria-label="${gEsc(a.titulo)} — ${rot}"`}>
      <span class="ac-side-aula-ico">${ico}</span>
      <span class="ac-side-aula-txt">
        <span class="ac-side-aula-nome">${gEsc(a.titulo)}</span>
        <span class="ac-side-aula-meta">
          ${a.duracao_seg?acFmtDur(a.duracao_seg):'sem vídeo'}
          ${a.obrigatoria?'':' · opcional'}
          ${p.salva?' · salva':''}
        </span>
      </span>
      ${atualizada?`<span class="ac-tag ac-tag-novo" title="Conteúdo atualizado depois de você ver">Novo</span>`:''}
    </${bloq?'div':'button'}>
  </li>`;
}

/**
 * Abre/fecha um módulo na sidebar animando a ALTURA real.
 * Antes era um toggle de classe com display:none → block: a altura pulava e as
 * aulas que a pessoa estava olhando desapareciam de um quadro pro outro.
 */
function acToggleModulo(btn){
  const li = btn && btn.closest('.ac-side-mod'); if(!li) return;
  const lista = li.querySelector('.ac-side-aulas');
  const abrir = !li.classList.contains('is-aberto');
  li.classList.toggle('is-aberto', abrir);
  btn.setAttribute('aria-expanded', abrir ? 'true' : 'false');
  if(typeof acAltura==='function') acAltura(lista, abrir);
  else if(lista) lista.hidden = !abrir;
}

// Troca de aula: salva o que está em curso antes de sair (posição + rascunho).
async function acAbrirAula(id){
  if(id===acState.aulaId){ acFecharPaineis(); return; }
  acAulaGuardarRascunho();
  await acSalvarPosicao(true);
  acState.aulaId = id;
  acAulaAba = 'visao';
  _acNotaEditando = null;
  _acAulaMontada = null;         // força remontar o miolo (novo vídeo)
  acFecharPaineis();
  acGo('aula', id);
}

/* ══════════════════════════════════════════════════════════════
   REGIÃO CENTRAL — conteúdo da aula
══════════════════════════════════════════════════════════════ */
function acRenderAulaMain(aula){
  const el = document.getElementById('ac-aula-main'); if(!el) return;
  const mod = aula._modulo || acModulo(aula.modulo_id);
  const p = acProg(aula.id);
  const aulas = acAulas();
  const i = aulas.findIndex(a=>a.id===aula.id);
  const ant = i>0 ? aulas[i-1] : null;
  const prox = i>=0 && i<aulas.length-1 ? aulas[i+1] : null;

  el.innerHTML = `
    <div class="ac-main-topo">
      <button type="button" class="ac-abrir-side" onclick="acAbrirSide()" aria-label="Abrir estrutura da formação">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10"/></svg>
        <span>Aulas</span>
      </button>
      <nav class="ac-crumb" aria-label="Você está em">
        <button type="button" class="ac-link" onclick="acGo('home')">${gEsc(acState.curso&&acState.curso.nome||'Formação')}</button>
        <span aria-hidden="true">/</span>
        <span>${gEsc(mod&&mod.nome||'')}</span>
      </nav>
      <button type="button" class="ac-abrir-agente" onclick="acAbrirAgente()" aria-label="Abrir o agente educacional">
        ${acIco('bot')}<span>Tirar dúvida</span>
      </button>
    </div>

    <header class="ac-aula-cab">
      <div class="ac-aula-cab-txt">
        <h1 class="ac-aula-titulo">${gEsc(aula.titulo)}</h1>
        ${aula.objetivo?`<p class="ac-aula-obj">${gEsc(aula.objetivo)}</p>`:''}
      </div>
      <div class="ac-aula-tags">
        ${p.concluida?`<span class="ac-tag ac-tag-concluido">${acIco('check')} Concluída</span>`:''}
        ${aula.obrigatoria?'':'<span class="ac-tag">Opcional</span>'}
        ${acAulaAtualizada(aula)?'<span class="ac-tag ac-tag-novo">Conteúdo atualizado</span>':''}
        ${acConcluiu()&&p.concluida?'<span class="ac-tag ac-tag-rev">Revisão</span>':''}
      </div>
    </header>

    <div id="ac-player-slot">${acPlayerHTML(aula)}</div>

    <div class="ac-abas-wrap">
      <div class="ac-abas" role="tablist" aria-label="Ferramentas da aula" id="ac-abas"></div>
      <div class="ac-aba-painel" id="ac-aba-painel" role="tabpanel" tabindex="0"></div>
    </div>

    <nav class="ac-nav-aula" aria-label="Navegação entre aulas">
      ${ant?`<button type="button" class="ac-btn ac-btn-ghost" onclick="acAbrirAula('${ant.id}')">
        ${acIco('volta')} <span class="ac-nav-lbl">Aula anterior</span></button>`:'<span></span>'}
      <div class="ac-nav-centro" id="ac-nav-centro">${acBotaoConcluirHTML(aula)}</div>
      ${prox?`<button type="button" class="ac-btn ac-btn-ghost" onclick="acAbrirAula('${prox.id}')">
        <span class="ac-nav-lbl">Próxima aula</span> ${acIco('seta')}</button>`:'<span></span>'}
    </nav>`;

  acRenderAbas(aula);
  acMontarPlayer(aula);
  acCarregarNotas(aula.id);   // assíncrono: a aba de anotações se re-renderiza quando chegam
  acTocarAcesso(aula.id);
  // Revisita pós-formação: registra sem tocar na conclusão oficial.
  if(acConcluiu() && p.concluida){
    acSalvarProgresso(aula.id, { revisitada_em: new Date().toISOString() });
    if(typeof gTrackEvent==='function') gTrackEvent('aula_revisitada',{aula_id:aula.id, curso_id:acState.curso.id});
  }
  if(typeof gTrackEvent==='function') gTrackEvent('aula_aberta',{aula_id:aula.id, curso_id:acState.curso&&acState.curso.id});
}

/* ══════════════════════════════════════════════════════════════
   PLAYER
══════════════════════════════════════════════════════════════ */
function acPlayerHTML(aula){
  const temVideo = !!(aula.video_url || aula.video_path);
  if(!temVideo){
    return `<div class="ac-sem-video">
      ${acIco('nota')}
      <div><strong>Esta aula é de leitura</strong>
      <span>Não há vídeo aqui — o conteúdo está no resumo e nos materiais abaixo.</span></div>
    </div>`;
  }
  const p = acProg(aula.id);
  const legenda = (aula.materiais||[]).find(m=>m&&m.tipo==='legenda');
  return `<figure class="ac-player" id="ac-player">
    <div class="ac-player-palco">
      <video id="ac-video" class="ac-video" controls playsinline preload="metadata"
             ${aula.thumb_url?`poster="${gEsc(aula.thumb_url)}"`:''}
             aria-label="Vídeo da aula ${gEsc(aula.titulo)}">
        ${legenda&&legenda.url?`<track kind="captions" srclang="pt-BR" label="Português" src="${gEsc(legenda.url)}" default>`:''}
      </video>
      <div class="ac-player-estado" id="ac-player-estado" aria-live="polite">
        <span class="mini-spinner" aria-hidden="true"></span> <span>Carregando o vídeo…</span>
      </div>
    </div>
    <figcaption class="ac-player-barra">
      <div class="ac-player-esq">
        <button type="button" class="ac-pbtn" onclick="acPular(-10)" title="Voltar 10 segundos" aria-label="Voltar 10 segundos">−10s</button>
        <button type="button" class="ac-pbtn" onclick="acPular(10)" title="Avançar 10 segundos" aria-label="Avançar 10 segundos">+10s</button>
        <label class="ac-vel">
          <span>Velocidade</span>
          <select id="ac-vel-sel" onchange="acVelocidade(this.value)">
            <option value="0.75">0,75×</option>
            <option value="1" selected>1×</option>
            <option value="1.25">1,25×</option>
            <option value="1.5">1,5×</option>
            <option value="2">2×</option>
          </select>
        </label>
      </div>
      <div class="ac-player-dir">
        <span class="ac-assistido" id="ac-assistido" role="img"
              aria-label="${Math.round((p.pct_assistido||0)*100)}% do vídeo assistido">
          <span class="ac-barra ac-barra-sm"><i style="width:${Math.round((p.pct_assistido||0)*100)}%"></i></span>
          <small id="ac-assistido-num">${Math.round((p.pct_assistido||0)*100)}% assistido</small>
        </span>
      </div>
    </figcaption>
  </figure>`;
}

async function acMontarPlayer(aula){
  _acVideoEl = null; _acAssistido = 0; _acUltimoTick = 0;
  const v = document.getElementById('ac-video'); if(!v) return;
  const estado = document.getElementById('ac-player-estado');
  const url = await acVideoUrl(aula);
  if(!url){
    if(estado) estado.innerHTML = `${acIco('alerta')} <span>Vídeo indisponível agora. Tente recarregar a página ou avise a equipe Delivery Much.</span>`;
    if(estado) estado.classList.add('is-erro');
    return;
  }
  _acVideoEl = v;

  v.addEventListener('loadedmetadata', ()=>{
    if(estado) estado.style.display='none';
    // Retomada: só se sobrou vídeo pela frente. Perto do fim, recomeçar é o que a
    // pessoa espera (senão o play cai no último segundo e "não acontece nada").
    // A margem é PROPORCIONAL (10% da duração, teto 10s): margem fixa de 10s
    // impedia retomada em qualquer aula curta — num vídeo de 14s, só posição
    // menor que 4s voltava. E usamos v.duration (o real) em vez do campo
    // declarado, que a equipe pode ter digitado errado.
    const p = acProg(aula.id);
    const dur = v.duration || aula.duracao_seg || 0;
    const margem = dur ? Math.min(10, dur*0.1) : 0;
    const retomarDe = (p.posicao_seg>5 && (!dur || p.posicao_seg < dur-margem)) ? p.posicao_seg : 0;
    // A retomada agora é ESCOLHA, não fato consumado: posicionamos o vídeo no
    // ponto salvo (é o que a pessoa quer em 9 de 10 casos) mas oferecemos
    // reiniciar numa faixa discreta sobre o player, sem modal e sem travar o play.
    if(retomarDe){
      try{ v.currentTime = retomarDe; }catch(e){}
      acMostrarRetomada(retomarDe);
      if(typeof gTrackEvent==='function') gTrackEvent('video_retomado',{aula_id:aula.id});
    }
  });
  v.addEventListener('waiting', ()=>{
    if(estado && !estado.classList.contains('is-erro')){ estado.style.display=''; acPlayerEstado('carregando'); }
  });
  let jaTocou=false;
  v.addEventListener('play', ()=>{
    _acUltimoTick = v.currentTime;
    if(!jaTocou){ jaTocou=true; if(typeof gTrackEvent==='function') gTrackEvent('video_iniciado',{aula_id:aula.id}); }
  });
  v.addEventListener('timeupdate', ()=>acVideoTick(aula));
  v.addEventListener('pause', ()=>{ acSalvarPosicao(); acPlayerEstado('pausado'); });
  v.addEventListener('playing', ()=>{ if(estado) estado.style.display='none'; acPlayerEstado('tocando'); });
  // FIM DO VÍDEO — antes daqui, este handler chamava acVideoTick(aula, true), que
  // forçava pct_assistido = 1 e concluía a aula. Isso FURAVA a própria regra do
  // módulo: arrastar a barra até o fim disparava 'ended' e a aula era concluída
  // com 0% assistido (medido: {pct:0} → {pct:1, concluida:true}).
  // Agora o fim do vídeo NÃO mexe no percentual — ele só grava o que foi de fato
  // assistido e apresenta a próxima ação. Quem assistiu de verdade já cruzou o
  // critério no timeupdate e a aula concluiu sozinha antes de chegar aqui.
  v.addEventListener('ended', ()=>{
    acVideoTick(aula);
    acSalvarPosicao(true);
    acPlayerEstado('fim');
    acMostrarFimDoVideo(aula);
  });
  v.addEventListener('error', ()=>{
    if(estado){
      estado.style.display='';
      estado.classList.add('is-erro');
      estado.innerHTML = `${acIco('alerta')} <span>Não consegui carregar este vídeo. Recarregue a página; se continuar, avise a equipe.</span>`;
    }
  });
  v.src = url;
}

/**
 * Conta o tempo REALMENTE assistido. Somar deltas pequenos (e ignorar salto de
 * seek) é o que impede "arrastei a barrinha até o fim" de valer como aula vista —
 * exatamente o que o produto pede.
 */
function acVideoTick(aula){
  const v = _acVideoEl; if(!v) return;
  const dur = v.duration || aula.duracao_seg || 0;
  const agora = v.currentTime;
  const delta = agora - _acUltimoTick;
  if(delta > 0 && delta < 2) _acAssistido += delta;   // >2s = seek, não conta
  _acUltimoTick = agora;

  const p = acProg(aula.id);
  const pctSessao = dur ? Math.min(1, _acAssistido/dur) : 0;
  // O total é o acumulado no banco + o desta sessão (quem assiste em duas visitas
  // também chega ao critério).
  // Sem atalho de "forçar 100%": o percentual é SEMPRE o acumulado real.
  const pct = Math.min(1, (p.pct_assistido||0) + pctSessao);
  const num = document.getElementById('ac-assistido-num');
  const barra = document.querySelector('#ac-assistido .ac-barra i');
  const box = document.getElementById('ac-assistido');
  // Escrita direta (sem helper de animação): isto roda ~4x por segundo durante a
  // reprodução, e animar cada tick seria trabalho jogado fora — a própria
  // frequência já produz um avanço contínuo suave.
  if(num) num.textContent = Math.round(pct*100)+'% assistido';
  if(barra) barra.style.width = Math.round(pct*100)+'%';
  if(box) box.setAttribute('aria-label', Math.round(pct*100)+'% do vídeo assistido');

  // Atingiu o critério e ainda não estava concluída → conclui sozinho (é o que a
  // pessoa espera depois de assistir), sem modal.
  const pctMin = acPctMin();
  if(!p.concluida && pct >= pctMin){
    acConcluirAula(aula.id, { auto:true, pct });
  }else{
    acAgendarSalvar(aula.id, agora, pct);
    // A dica "assista mais X%" é montada uma vez com o miolo da aula e ficava
    // CONGELADA no valor inicial (dizia 85% com metade do vídeo já visto).
    // Atualizamos só o texto — remontar o botão aqui roubaria o foco do teclado.
    const dica = document.querySelector('.ac-concl-dica');
    if(dica && !p.concluida){
      const falta = Math.max(1, Math.round((pctMin-pct)*100));
      dica.textContent = `Assista mais ${falta}% do vídeo para concluir esta aula.`;
    }
  }
}
/* ══════════════════════════════════════════════════════════════
   ESTADOS DO PLAYER · RETOMADA · FIM DO VÍDEO
   Tudo como faixa discreta DENTRO do palco do player: nada de modal por cima do
   vídeo (o pedido é explícito — não bloquear com modal invasivo).
══════════════════════════════════════════════════════════════ */
// Estado só como classe no palco: o CSS decide a aparência, o JS não sabe de cor.
function acPlayerEstado(estado){
  const palco = document.querySelector('#ac-player .ac-player-palco');
  if(!palco) return;
  palco.classList.remove('is-carregando','is-tocando','is-pausado','is-fim');
  if(estado) palco.classList.add('is-'+estado);
}

// Faixa de retomada: informa de onde voltou e oferece reiniciar. Some sozinha
// (a informação já cumpriu o papel) mas o botão fica alcançável enquanto está lá.
function acMostrarRetomada(seg){
  const palco = document.querySelector('#ac-player .ac-player-palco');
  if(!palco) return;
  const antiga = palco.querySelector('.ac-retomada'); if(antiga) antiga.remove();
  const el = document.createElement('div');
  el.className = 'ac-retomada';
  el.setAttribute('role','status');
  el.innerHTML = `<span class="ac-retomada-txt">Retomando de <strong>${acFmtTempo(seg)}</strong></span>
    <button type="button" class="ac-retomada-btn" onclick="acReiniciarVideo(this)">Começar do início</button>`;
  palco.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('is-visivel'));
  // 9s: tempo de ler e decidir sem a faixa virar parte fixa do player.
  clearTimeout(el._t);
  el._t = setTimeout(()=>{ el.classList.remove('is-visivel'); setTimeout(()=>el.remove(), 400); }, 9000);
}
function acReiniciarVideo(btn){
  const v = _acVideoEl; if(!v) return;
  try{ v.currentTime = 0; v.play&&v.play().catch(()=>{}); }catch(e){}
  const faixa = btn && btn.closest('.ac-retomada');
  if(faixa){ faixa.classList.remove('is-visivel'); setTimeout(()=>faixa.remove(), 400); }
  gToast('Começando do início');
}

// Fim do vídeo: apresenta a AÇÃO SEGUINTE em vez de sumir. Não conclui nada por
// conta própria (a regra de progresso é a única fonte disso) e não tira os
// controles — reassistir é um clique no próprio player.
function acMostrarFimDoVideo(aula){
  const palco = document.querySelector('#ac-player .ac-player-palco');
  if(!palco || !aula) return;
  const antiga = palco.querySelector('.ac-fimvideo'); if(antiga) antiga.remove();
  // A faixa de retomada sai de cena: ela fica atrás do véu do fim do vídeo e vira
  // ruído ilegível. Já cumpriu o papel dela quando o vídeo começou.
  const retomada = palco.querySelector('.ac-retomada');
  if(retomada){ clearTimeout(retomada._t); retomada.classList.remove('is-visivel'); setTimeout(()=>retomada.remove(), 300); }
  const p = acProg(aula.id);
  const aulas = acAulas();
  const i = aulas.findIndex(a=>a.id===aula.id);
  const prox = (i>=0 && i<aulas.length-1) ? aulas[i+1] : null;
  const temAtiv = !!(aula.atividade && (aula.atividade.itens||[]).length);
  const pctMin = acPctMin();
  const faltaAssistir = !p.concluida && (aula.duracao_seg||0)>0 && (p.pct_assistido||0) < pctMin;

  // A ação principal muda com a situação real — não é um botão fixo.
  let acao;
  if(faltaAssistir){
    acao = `<span class="ac-fimvideo-nota">Você pulou trechos do vídeo. Reveja o que faltou para concluir a aula.</span>`;
  }else if(temAtiv){
    acao = `<button type="button" class="ac-btn ac-btn-primario" onclick="acFimVideoIr('atividade')">Fazer a atividade</button>`;
  }else if(!p.concluida){
    acao = `<button type="button" class="ac-btn ac-btn-primario" onclick="acConcluirAula('${aula.id}');acFecharFimVideo()">Marcar como concluída</button>`;
  }else if(prox){
    acao = `<button type="button" class="ac-btn ac-btn-primario" onclick="acAbrirAula('${prox.id}')">Próxima aula</button>`;
  }else{
    acao = `<button type="button" class="ac-btn ac-btn-ghost" onclick="acGo('home')">Voltar à jornada</button>`;
  }

  const el = document.createElement('div');
  el.className = 'ac-fimvideo';
  el.setAttribute('role','group');
  el.setAttribute('aria-label','Fim do vídeo');
  el.innerHTML = `<div class="ac-fimvideo-box">
      <strong class="ac-fimvideo-t">${p.concluida?'Aula concluída':'Fim do vídeo'}</strong>
      ${acao}
      <div class="ac-fimvideo-sec">
        <button type="button" class="ac-link" onclick="acReiniciarVideo(this)">Reassistir</button>
        ${prox&&(p.concluida||!faltaAssistir)?`<button type="button" class="ac-link" onclick="acAbrirAula('${prox.id}')">Próxima aula</button>`:''}
        <button type="button" class="ac-link" onclick="acFecharFimVideo()">Fechar</button>
      </div>
    </div>`;
  palco.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('is-visivel'));
  const b = el.querySelector('.ac-btn, .ac-link'); if(b) setTimeout(()=>{ try{b.focus();}catch(e){} }, 260);
}
function acFecharFimVideo(){
  const el = document.querySelector('.ac-fimvideo');
  if(!el) return;
  el.classList.remove('is-visivel');
  setTimeout(()=>el.remove(), 300);
  acPlayerEstado('pausado');
}
function acFimVideoIr(aba){
  acFecharFimVideo();
  acTrocarAba(aba);
  const painel = document.getElementById('ac-aba-painel');
  if(painel && painel.scrollIntoView){ try{ painel.scrollIntoView({block:'nearest',behavior:'smooth'}); }catch(e){} }
}

function acPctMin(){
  const c = acState.curso;
  const v = c && c.criterios && Number(c.criterios.pct_min);
  return (v>0 && v<=1) ? v : 0.85;
}
// Gravação periódica (10s) — não a cada timeupdate (seriam ~4 por segundo).
// Desmontagem da aula (acGo saindo de 'aula'). O re-render troca o innerHTML do
// #ac-root, mas o <video> continua vivo em _acVideoEl: o audio segue tocando em
// segundo plano e o timer de 10s ainda grava progresso de uma aula ja desmontada.
// Grava a posicao agora (o que ja cancela o timer), pausa e solta a referencia.
// O listener de 'pause' dispara depois com _acVideoEl nulo -> sai cedo, sem 2a gravacao.
function acAulaDesmontar(){
  const v = _acVideoEl;
  if(!v) return;
  try{ acSalvarPosicao(true); }catch(e){}
  try{ v.pause(); }catch(e){}
  _acVideoEl = null; _acAssistido = 0; _acUltimoTick = 0;
}
function acAgendarSalvar(aulaId, pos, pct){
  if(_acSalvarTimer) return;
  _acSalvarTimer = setTimeout(()=>{
    _acSalvarTimer = null;
    acSalvarProgresso(aulaId, { posicao_seg: pos, pct_assistido: pct,
                                visto_conteudo_versao: (acAula(aulaId)||{}).conteudo_versao||1 });
  }, 10000);
}
// Gravação imediata (pausa, troca de aula, sair da página). `agora` cancela o timer.
async function acSalvarPosicao(agora){
  clearTimeout(_acSalvarTimer); _acSalvarTimer = null;
  const v = _acVideoEl, id = acState.aulaId;
  if(!id) return;
  const aula = acAula(id); if(!aula) return;
  if(!v){ return; }
  const dur = v.duration || aula.duracao_seg || 0;
  const p = acProg(id);
  const pct = dur ? Math.min(1, (p.pct_assistido||0) + Math.min(1,_acAssistido/dur)) : (p.pct_assistido||0);
  _acAssistido = 0;   // já contabilizado: não somar de novo na próxima gravação
  await acSalvarProgresso(id, { posicao_seg: v.currentTime||0, pct_assistido: pct,
                                visto_conteudo_versao: aula.conteudo_versao||1 });
  if(agora) return;
}
function acPular(seg){
  const v=_acVideoEl; if(!v) return;
  try{ v.currentTime = Math.max(0, Math.min((v.duration||1e9), v.currentTime + seg)); }catch(e){}
}
function acVelocidade(val){
  const v=_acVideoEl; if(!v) return;
  const n = Number(val)||1;
  v.playbackRate = n;
  try{ localStorage.setItem('yngs_ac_velocidade', String(n)); }catch(e){}
}
// Ir a um ponto do vídeo (transcrição e anotação com marcação de tempo usam isto)
function acIrPara(seg){
  const v=_acVideoEl;
  if(!v){ gToast('Esta aula não tem vídeo para navegar'); return; }
  try{ v.currentTime = Math.max(0, seg); v.play&&v.play().catch(()=>{}); }catch(e){}
  const pl=document.getElementById('ac-player');
  if(pl&&pl.scrollIntoView){ try{ pl.scrollIntoView({block:'center',behavior:'smooth'}); }catch(e){} }
}

// Sair da página / trocar de aba do navegador: grava sem depender de unload
// (pagehide é o único evento confiável no iOS).
window.addEventListener('pagehide', ()=>{ if(acState.rota==='aula') acSalvarPosicao(true); });
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState==='hidden' && acState.rota==='aula') acSalvarPosicao(true);
});

/* ══════════════════════════════════════════════════════════════
   CONCLUSÃO DA AULA
══════════════════════════════════════════════════════════════ */
function acBotaoConcluirHTML(aula){
  const p = acProg(aula.id);
  if(p.concluida){
    return `<div class="ac-concl-ok">${acIco('check')}
      <span>Concluída${p.concluida_em?` em ${acFmtData(p.concluida_em)}`:''}</span>
      <button type="button" class="ac-link" onclick="acSalvarParaRevisar('${aula.id}')">
        ${acProg(aula.id).salva?'Remover da revisão':'Salvar para revisar'}</button>
    </div>`;
  }
  const temVideo = !!(aula.video_url||aula.video_path) && (aula.duracao_seg||0)>0;
  const pctMin = acPctMin();
  const falta = temVideo && (p.pct_assistido||0) < pctMin;
  if(falta){
    const restante = Math.max(1, Math.round((pctMin-(p.pct_assistido||0))*100));
    return `<div class="ac-concl-pend">
      <button type="button" class="ac-btn ac-btn-primario" disabled aria-disabled="true">Marcar como concluída</button>
      <span class="ac-concl-dica">Assista mais ${restante}% do vídeo para concluir esta aula.</span>
    </div>`;
  }
  return `<button type="button" class="ac-btn ac-btn-primario" onclick="acConcluirAula('${aula.id}')">
    ${acIco('check')} Marcar como concluída</button>`;
}

/**
 * Conclui a aula. Celebração é DISCRETA por aula (toast) e só vira momento quando
 * fecha um módulo ou a formação — pedido explícito do produto.
 */
async function acConcluirAula(aulaId, opts){
  opts = opts||{};
  const aula = acAula(aulaId); if(!aula) return;
  const antes = acProg(aulaId);
  if(antes.concluida) return;

  const modAntes = acModuloEstado(aula._modulo||acModulo(aula.modulo_id));
  await acSalvarProgresso(aulaId, {
    concluida: true,
    pct_assistido: opts.pct!=null ? opts.pct : (antes.pct_assistido||( (aula.duracao_seg||0)?0:1 )),
    posicao_seg: _acVideoEl ? _acVideoEl.currentTime : antes.posicao_seg,
    visto_conteudo_versao: aula.conteudo_versao||1
  });
  if(typeof gTrackEvent==='function') gTrackEvent('aula_concluida',{aula_id:aulaId, curso_id:acState.curso&&acState.curso.id, auto:!!opts.auto});

  // Atualiza só o que mudou (não remonta o vídeo)
  acRenderSidebar();
  // Feedback imediato NO ITEM que mudou: a linha da aula pulsa e o check se
  // desenha. Sem isso a conclusão acontecia "em algum lugar" da lista.
  if(typeof acPulso==='function'){
    const linha = document.querySelector('.ac-side-aula.is-atual');
    if(linha){ acPulso(linha); const ico=linha.querySelector('.ac-i-ok'); if(ico) ico.classList.add('ac-risca'); }
  }
  const nav = document.getElementById('ac-nav-centro');
  if(nav) nav.innerHTML = acBotaoConcluirHTML(aula);
  acRenderAbas(aula);
  const tags = document.querySelector('.ac-aula-tags');
  if(tags && !tags.querySelector('.ac-tag-concluido')){
    tags.insertAdjacentHTML('afterbegin', `<span class="ac-tag ac-tag-concluido">${acIco('check')} Concluída</span>`);
  }

  const mod = acModulo(aula.modulo_id) || aula._modulo;
  const modDepois = acModuloEstado(mod);
  const r = acResumo();

  if(r.concluidas>=r.total && r.total>0){
    if(typeof gTrackEvent==='function') gTrackEvent('formacao_concluida',{curso_id:acState.curso&&acState.curso.id});
    acFestejar('formacao');
    return;
  }
  if(modAntes!=='concluido' && modDepois==='concluido'){
    if(typeof gTrackEvent==='function') gTrackEvent('modulo_concluido',{modulo_id:mod&&mod.id, curso_id:acState.curso&&acState.curso.id});
    // O card do módulo reconhece o fechamento ANTES do overlay: quando a pessoa
    // olha pra sidebar depois, o estado já mudou com destaque, não do nada.
    if(typeof acPulso==='function'){
      const li = document.querySelector('.ac-side-mod.is-concluido .ac-side-mod-cab');
      if(li) acPulso(li,'marco');
    }
    acFestejar('modulo', mod);
    return;
  }
  gToast('Aula concluída');
}

// Marco relevante: módulo fechado ou formação inteira. Overlay leve, dispensável,
// nunca bloqueia — e o próximo passo já está no botão.
function acFestejar(tipo, mod){
  const aulas = acAulas();
  const prox = aulas.find(a=>!acProg(a.id).concluida && acAulaLiberada(a));
  const formacao = tipo==='formacao';
  const el = document.createElement('div');
  el.className = 'ac-festa';
  el.setAttribute('role','dialog');
  el.setAttribute('aria-modal','true');
  el.setAttribute('aria-label', formacao?'Formação concluída':'Módulo concluído');
  el.innerHTML = `<div class="ac-festa-box">
    <span class="ac-festa-selo">${formacao?AC_ICO.medal:AC_ICO.check}</span>
    <strong class="ac-festa-titulo">${formacao?'Formação concluída':'Módulo concluído'}</strong>
    <p class="ac-festa-txt">${formacao
      ? 'Você concluiu todas as aulas obrigatórias da Formação do Franqueado. Seu certificado já pode ser emitido.'
      : `Você fechou o módulo ${gEsc((mod&&mod.nome)||'')}${prox?' e liberou o próximo':''}.`}</p>
    <div class="ac-festa-acoes">
      ${formacao
        ? `<button type="button" class="ac-btn ac-btn-primario" onclick="acFecharFesta();acGo('certificado')">Ver conclusão e certificado</button>`
        : (prox?`<button type="button" class="ac-btn ac-btn-primario" onclick="acFecharFesta();acAbrirAula('${prox.id}')">Continuar${prox?': '+gEsc(prox.titulo):''}</button>`:'')}
      <button type="button" class="ac-btn ac-btn-ghost" onclick="acFecharFesta()">${formacao?'Continuar aqui':'Fechar'}</button>
    </div>
  </div>`;
  document.body.appendChild(el);
  const btn = el.querySelector('.ac-btn'); if(btn) setTimeout(()=>{ try{btn.focus();}catch(e){} },40);
  // Esc fecha e devolve o foco — modal sem saída por teclado é armadilha.
  el._onKey = (ev)=>{ if(ev.key==='Escape'){ ev.preventDefault(); acFecharFesta(); } };
  document.addEventListener('keydown', el._onKey, true);
  el.addEventListener('mousedown', ev=>{ if(ev.target===el) acFecharFesta(); });
}
function acFecharFesta(){
  const el = document.querySelector('.ac-festa'); if(!el) return;
  if(el._onKey) document.removeEventListener('keydown', el._onKey, true);
  el.remove();
  const v = document.getElementById('ac-video'); if(v){ try{v.focus();}catch(e){} }
}

async function acSalvarParaRevisar(aulaId){
  const p = acProg(aulaId);
  await acSalvarProgresso(aulaId, { salva: !p.salva });
  gToast(!p.salva ? 'Aula salva para revisar' : 'Aula removida da revisão');
  acRenderSidebar();
  const aula = acAula(aulaId);
  const nav = document.getElementById('ac-nav-centro');
  if(nav && aula) nav.innerHTML = acBotaoConcluirHTML(aula);
}

/* ══════════════════════════════════════════════════════════════
   ABAS DE FERRAMENTAS
══════════════════════════════════════════════════════════════ */
function acRenderAbas(aula){
  const abasEl = document.getElementById('ac-abas');
  const painel = document.getElementById('ac-aba-painel');
  if(!abasEl || !painel) return;

  const temTrans = Array.isArray(aula.transcricao) && aula.transcricao.length>0;
  const mats = (aula.materiais||[]).filter(m=>m && m.tipo!=='legenda');
  const temAtiv = !!(aula.atividade && aula.atividade.tipo && (aula.atividade.itens||[]).length);
  const notas = acState.notas[aula.id]||[];
  const abas = [
    { id:'visao', rot:'Visão geral' },
    { id:'materiais', rot:'Materiais', n:mats.length },
    { id:'notas', rot:'Anotações', n:notas.length },
    temTrans ? { id:'transcricao', rot:'Transcrição' } : null,
    temAtiv ? { id:'atividade', rot:'Atividade' } : null
  ].filter(Boolean);
  if(!abas.some(a=>a.id===acAulaAba)) acAulaAba='visao';

  abasEl.innerHTML = abas.map(a=>`<button type="button" role="tab" id="ac-aba-${a.id}"
      class="ac-aba${acAulaAba===a.id?' is-atual':''}" aria-selected="${acAulaAba===a.id}"
      onclick="acTrocarAba('${a.id}')">${gEsc(a.rot)}${a.n?`<span class="ac-aba-n">${a.n}</span>`:''}</button>`).join('');
  painel.setAttribute('aria-labelledby','ac-aba-'+acAulaAba);

  const pintar = ()=>{
    if(acAulaAba==='visao')            painel.innerHTML = acAbaVisao(aula);
    else if(acAulaAba==='materiais')   painel.innerHTML = acAbaMateriais(aula, mats);
    else if(acAulaAba==='notas')       painel.innerHTML = acAbaNotas(aula);
    else if(acAulaAba==='transcricao') painel.innerHTML = acAbaTranscricao(aula);
    else if(acAulaAba==='atividade')   painel.innerHTML = acAbaAtividade(aula);
    if(acAulaAba==='notas') acRestaurarRascunho();
    if(acAulaAba==='materiais') acResolverLinksMateriais(aula);
  };
  // Crossfade só quando o painel TROCA de aba. Re-render da mesma aba (salvar uma
  // anotação, concluir a aula) pinta direto: animar ali pisca sem motivo.
  const mudouAba = painel.dataset.aba && painel.dataset.aba !== acAulaAba;
  painel.dataset.aba = acAulaAba;
  if(mudouAba && typeof acTroca==='function') acTroca(painel, pintar);
  else pintar();
}
function acTrocarAba(id){
  if(id==='notas' || acAulaAba==='notas') acAulaGuardarRascunho();
  acAulaAba = id;
  const aula = acAula(acState.aulaId); if(aula) acRenderAbas(aula);
  const p = document.getElementById('ac-aba-painel'); if(p){ try{p.focus();}catch(e){} }
}

function acAbaVisao(aula){
  const objs = Array.isArray(aula.objetivos) ? aula.objetivos : [];
  const aulas = acAulas();
  const i = aulas.findIndex(a=>a.id===aula.id);
  const prox = i>=0 && i<aulas.length-1 ? aulas[i+1] : null;
  if(!aula.resumo && !aula.descricao && !objs.length && !aula.objetivo){
    return acVazio('nota','Esta aula ainda não tem descrição','O conteúdo principal está no vídeo e nos materiais.');
  }
  return `<div class="ac-prosa">
    ${aula.objetivo?`<h3>Objetivo</h3><p>${gEsc(aula.objetivo)}</p>`:''}
    ${aula.resumo?`<h3>Resumo</h3><p>${gEsc(aula.resumo)}</p>`:''}
    ${aula.descricao?`<p>${gEsc(aula.descricao)}</p>`:''}
    ${objs.length?`<h3>Assuntos abordados</h3><ul>${objs.map(o=>`<li>${gEsc(o)}</li>`).join('')}</ul>`:''}
    ${prox?`<h3>Próximos passos</h3><p>Depois desta aula: <button type="button" class="ac-link" onclick="acAbrirAula('${prox.id}')">${gEsc(prox.titulo)}</button>.</p>`:''}
  </div>`;
}

const AC_MAT_ICO = { pdf:'arq', doc:'arq', planilha:'arq', checklist:'check', link:'seta', modelo:'arq' };
function acAbaMateriais(aula, mats){
  if(!mats.length){
    return acVazio('arq','Nenhum material nesta aula','Quando a equipe anexar PDFs, planilhas ou links, eles aparecem aqui.');
  }
  return `<ul class="ac-mats">${mats.map(m=>{
    const tipo = String(m.tipo||'link');
    const externo = !!m.url && !m.path;
    return `<li>
      <a class="ac-mat" id="ac-mat-${gEsc(m.id||'')}" href="${gEsc(m.url||'#')}"
         ${externo?'target="_blank" rel="noopener"':''}
         ${!m.url&&m.path?'data-path="'+gEsc(m.path)+'"':''}
         onclick="acMaterialAberto('${gEsc(m.id||'')}','${gEsc(aula.id)}')">
        <span class="ac-mat-ico">${acIco(AC_MAT_ICO[tipo]||'arq')}</span>
        <span class="ac-mat-txt">
          <strong>${gEsc(m.titulo||'Material')}</strong>
          <small>${gEsc(tipo)}${m.tamanho?` · ${gEsc(acFmtBytes(m.tamanho))}`:''}${externo?' · abre em nova aba':''}</small>
        </span>
        ${acIco('seta','ac-i-sm')}
      </a></li>`;
  }).join('')}</ul>`;
}
// Material no bucket privado não tem URL fixa: resolvemos a assinada após pintar
// (não travamos a renderização da aba esperando N assinaturas).
function acResolverLinksMateriais(aula){
  (aula.materiais||[]).forEach(async m=>{
    if(!m || m.url || !m.path) return;
    const el = document.getElementById('ac-mat-'+(m.id||''));
    if(!el) return;
    const url = await acMaterialUrl(m);
    if(url){ el.href = url; el.target='_blank'; el.rel='noopener'; }
    else {
      el.classList.add('is-off');
      el.removeAttribute('href');
      const s = el.querySelector('small'); if(s) s.textContent = 'indisponível agora';
    }
  });
}
function acMaterialAberto(matId, aulaId){
  if(typeof gTrackEvent==='function') gTrackEvent('material_acessado',{aula_id:aulaId, material_id:matId});
}
function acFmtBytes(n){
  n = Number(n)||0;
  if(n < 1024) return n+' B';
  if(n < 1024*1024) return (n/1024).toFixed(0)+' KB';
  return (n/1024/1024).toFixed(1)+' MB';
}

/* ── ANOTAÇÕES ── */
function acAbaNotas(aula){
  const notas = (acState.notas[aula.id]||[]).slice()
    .sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
  const emEdicao = _acNotaEditando ? notas.find(n=>n.id===_acNotaEditando) : null;
  const temVideo = !!(aula.video_url||aula.video_path);
  return `<div class="ac-notas">
    <form class="ac-nota-form" onsubmit="event.preventDefault();acSalvarNota()">
      <label class="ac-sr" for="ac-nota-txt">${emEdicao?'Editar anotação':'Nova anotação'}</label>
      <textarea id="ac-nota-txt" class="ac-nota-txt" rows="3"
        placeholder="${emEdicao?'Editando sua anotação…':'Escreva uma anotação sobre esta aula…'}"
        oninput="acAulaMarcarRascunho()">${emEdicao?gEsc(emEdicao.texto):''}</textarea>
      <div class="ac-nota-acoes">
        ${temVideo?`<label class="ac-check">
          <input type="checkbox" id="ac-nota-mom" ${emEdicao&&emEdicao.video_seg!=null?'checked':''}>
          <span>Marcar o momento do vídeo</span></label>`:''}
        <div class="ac-nota-btns">
          ${emEdicao?`<button type="button" class="ac-btn ac-btn-ghost" onclick="acCancelarNota()">Cancelar</button>`:''}
          <button type="submit" class="ac-btn ac-btn-primario">${emEdicao?'Salvar alterações':'Salvar anotação'}</button>
        </div>
      </div>
      <p class="ac-nota-priv">${acIco('lock','ac-i-sm')} Suas anotações são privadas — nem a equipe Delivery Much as vê.</p>
    </form>
    ${notas.length?`<ul class="ac-nota-lista">${notas.map(n=>`<li class="ac-nota">
      <div class="ac-nota-cab">
        ${n.video_seg!=null?`<button type="button" class="ac-nota-tempo" onclick="acIrPara(${Number(n.video_seg)||0})"
            title="Ir para este momento do vídeo">${acIco('play','ac-i-sm')} ${acFmtTempo(n.video_seg)}</button>`:'<span></span>'}
        <time>${acFmtDataHora(n.created_at)}</time>
      </div>
      <p class="ac-nota-corpo">${gEsc(n.texto)}</p>
      <div class="ac-nota-ops">
        <button type="button" class="ac-link" onclick="acEditarNota('${n.id}')">Editar</button>
        <button type="button" class="ac-link ac-link-perigo" onclick="acApagarNota('${n.id}')">Excluir</button>
      </div>
    </li>`).join('')}</ul>`
    : acVazio('nota','Nenhuma anotação ainda','Anote o que quiser lembrar depois — fica só com você.')}
  </div>`;
}

// Rascunho de anotação: em vez de perguntar "descartar?" ao navegar, PRESERVAMOS
// o texto no localStorage e devolvemos ao voltar. Ninguém perde o que escreveu.
function acAulaMarcarRascunho(){ /* o oninput existe só para o guard saber que há texto */ }
function acAulaTemRascunho(){
  const t = document.getElementById('ac-nota-txt');
  return !!(t && t.value && t.value.trim());
}
function acAulaGuardarRascunho(){
  const t = document.getElementById('ac-nota-txt');
  if(!t || !acState.aulaId) return true;
  try{
    const todos = JSON.parse(localStorage.getItem(AC_RASCUNHO_NOTA)||'{}');
    if(t.value && t.value.trim()) todos[acState.aulaId] = t.value;
    else delete todos[acState.aulaId];
    localStorage.setItem(AC_RASCUNHO_NOTA, JSON.stringify(todos));
  }catch(e){}
  return true;
}
function acRestaurarRascunho(){
  const t = document.getElementById('ac-nota-txt');
  if(!t || _acNotaEditando) return;
  try{
    const todos = JSON.parse(localStorage.getItem(AC_RASCUNHO_NOTA)||'{}');
    if(todos[acState.aulaId]){
      t.value = todos[acState.aulaId];
      const p = t.parentNode.querySelector('.ac-nota-priv');
      if(p && !p.dataset.rasc){ p.dataset.rasc='1'; p.insertAdjacentHTML('beforebegin',
        '<p class="ac-nota-rasc">Recuperamos o que você estava escrevendo.</p>'); }
    }
  }catch(e){}
}
function _acLimparRascunho(){
  try{
    const todos = JSON.parse(localStorage.getItem(AC_RASCUNHO_NOTA)||'{}');
    delete todos[acState.aulaId];
    localStorage.setItem(AC_RASCUNHO_NOTA, JSON.stringify(todos));
  }catch(e){}
}

async function acSalvarNota(){
  const t = document.getElementById('ac-nota-txt');
  const texto = t ? String(t.value||'').trim() : '';
  if(!texto){ gToast('Escreva algo antes de salvar a anotação','error'); if(t)t.focus(); return; }
  const aula = acAula(acState.aulaId); if(!aula) return;
  const mom = document.getElementById('ac-nota-mom');
  const videoSeg = (mom && mom.checked && _acVideoEl) ? Math.floor(_acVideoEl.currentTime||0)
                 : (mom && mom.checked ? 0 : null);

  const lu = _acLuma(), uid = _acUid();
  if(_acNotaEditando){
    const lista = acState.notas[aula.id]||[];
    const n = lista.find(x=>x.id===_acNotaEditando);
    if(n){ n.texto = texto; n.video_seg = videoSeg; }
    if(lu && uid && !acState.curso._demo){
      try{ await lu.from('aula_notas').update({texto, video_seg:videoSeg}).eq('id',_acNotaEditando).eq('user_id',uid); }
      catch(e){ console.warn('[academia] nota não atualizou:', e&&e.message||e); }
    }
    _acNotaEditando = null;
    gToast('Anotação atualizada');
  }else{
    const nova = { id:'local-'+Date.now(), aula_id:aula.id, texto, video_seg:videoSeg,
                   created_at:new Date().toISOString() };
    acState.notas[aula.id] = [nova].concat(acState.notas[aula.id]||[]);
    if(lu && uid && !acState.curso._demo){
      try{
        const { data, error } = await lu.from('aula_notas').insert({
          user_id:uid, curso_id:acState.curso.id, aula_id:aula.id, texto, video_seg:videoSeg
        }).select().maybeSingle();
        if(error) throw error;
        if(data){ // troca o id local pelo do banco (editar/excluir precisam do real)
          const i = (acState.notas[aula.id]||[]).findIndex(x=>x.id===nova.id);
          if(i>=0) acState.notas[aula.id][i] = data;
        }
      }catch(e){ console.warn('[academia] nota não subiu:', e&&e.message||e); }
    }
    if(typeof gTrackEvent==='function') gTrackEvent('nota_criada',{aula_id:aula.id});
    gToast('Anotação salva');
  }
  _acLimparRascunho();
  acRenderAbas(aula);
}
function acEditarNota(id){
  _acNotaEditando = id;
  const aula = acAula(acState.aulaId); if(aula) acRenderAbas(aula);
  const t = document.getElementById('ac-nota-txt'); if(t){ t.focus(); t.select&&t.select(); }
}
function acCancelarNota(){
  _acNotaEditando = null;
  const aula = acAula(acState.aulaId); if(aula) acRenderAbas(aula);
}
async function acApagarNota(id){
  const ok = await gConfirm('Excluir esta anotação? Isso não pode ser desfeito.',
                            {title:'Excluir anotação', okLabel:'Excluir', danger:true});
  if(!ok) return;
  const aula = acAula(acState.aulaId); if(!aula) return;
  acState.notas[aula.id] = (acState.notas[aula.id]||[]).filter(n=>n.id!==id);
  const lu=_acLuma(), uid=_acUid();
  if(lu && uid && !acState.curso._demo && String(id).indexOf('local-')!==0){
    try{ await lu.from('aula_notas').delete().eq('id',id).eq('user_id',uid); }
    catch(e){ console.warn('[academia] nota não apagou:', e&&e.message||e); }
  }
  if(_acNotaEditando===id) _acNotaEditando=null;
  gToast('Anotação excluída');
  acRenderAbas(aula);
}

// Notas da aula (carregadas ao abrir a aba pela primeira vez na sessão)
async function acCarregarNotas(aulaId){
  const lu=_acLuma(), uid=_acUid();
  if(!lu || !uid || !acState.curso || acState.curso._demo) return;
  if(acState.notas[aulaId]) return;
  try{
    const { data, error } = await lu.from('aula_notas').select('*')
      .eq('aula_id',aulaId).eq('user_id',uid).order('created_at',{ascending:false});
    if(error) throw error;
    acState.notas[aulaId] = data||[];
    if(acState.rota==='aula' && acState.aulaId===aulaId){
      const a=acAula(aulaId); if(a) acRenderAbas(a);
    }
  }catch(e){ console.warn('[academia] notas não carregaram:', e&&e.message||e); }
}

/* ── TRANSCRIÇÃO ── */
function acAbaTranscricao(aula){
  const tr = (aula.transcricao||[]);
  return `<div class="ac-trans">
    <div class="ac-trans-busca">
      <label class="ac-sr" for="ac-trans-q">Buscar na transcrição</label>
      <input id="ac-trans-q" type="search" placeholder="Buscar na transcrição…" oninput="acFiltrarTranscricao(this.value)">
    </div>
    <ol class="ac-trans-lista" id="ac-trans-lista">
      ${tr.map((t,i)=>`<li class="ac-trans-item" data-i="${i}">
        ${t.t!=null?`<button type="button" class="ac-trans-t" onclick="acIrPara(${Number(t.t)||0})"
           title="Ir para ${acFmtTempo(t.t)} do vídeo">${acFmtTempo(t.t)}</button>`:'<span class="ac-trans-t is-off">—</span>'}
        <p>${gEsc(t.texto||'')}</p></li>`).join('')}
    </ol>
    <p class="ac-trans-vazio" id="ac-trans-vazio" hidden>Nenhum trecho encontrado.</p>
  </div>`;
}
function acFiltrarTranscricao(q){
  q = String(q||'').trim().toLowerCase();
  const itens = document.querySelectorAll('#ac-trans-lista .ac-trans-item');
  let achou = 0;
  itens.forEach(li=>{
    const txt = (li.textContent||'').toLowerCase();
    const ok = !q || txt.indexOf(q)>=0;
    li.hidden = !ok;
    if(ok) achou++;
  });
  const vazio = document.getElementById('ac-trans-vazio');
  if(vazio) vazio.hidden = achou>0;
}

/* ── ATIVIDADE (formativa: registra tentativa, NÃO trava a conclusão) ── */
function acAbaAtividade(aula){
  const at = aula.atividade||{};
  const itens = at.itens||[];
  const p = acProg(aula.id);
  const ultima = (p.tentativas||[]).slice(-1)[0];
  return `<div class="ac-ativ">
    <h3 class="ac-ativ-titulo">${gEsc(at.titulo||'Revisão da aula')}</h3>
    <p class="ac-ativ-sub">${at.tipo==='checklist'
      ? 'Marque o que você já fez na prática.'
      : 'Uma revisão rápida para você conferir o próprio entendimento. Não vale nota.'}</p>
    <form id="ac-ativ-form" onsubmit="event.preventDefault();acEnviarAtividade()">
      ${itens.map((it,i)=>`<fieldset class="ac-ativ-item">
        <legend>${i+1}. ${gEsc(it.enunciado||'')}</legend>
        ${at.tipo==='checklist'
          ? `<label class="ac-check"><input type="checkbox" name="${gEsc(it.id||('i'+i))}"><span>Concluído</span></label>`
          : (it.opcoes||[]).map((o,j)=>`<label class="ac-radio">
              <input type="radio" name="${gEsc(it.id||('i'+i))}" value="${j}"> <span>${gEsc(o)}</span></label>`).join('')}
      </fieldset>`).join('')}
      <button type="submit" class="ac-btn ac-btn-primario">Conferir respostas</button>
    </form>
    <div id="ac-ativ-res" aria-live="polite">${ultima?acAtivResultadoHTML(aula, ultima):''}</div>
    ${(p.tentativas||[]).length>1?`<p class="ac-ativ-hist">${p.tentativas.length} tentativas registradas.</p>`:''}
  </div>`;
}
function acAtivResultadoHTML(aula, tent){
  const at = aula.atividade||{}, itens = at.itens||[];
  if(at.tipo==='checklist'){
    return `<div class="ac-ativ-res"><strong>${tent.acertos} de ${tent.total} itens marcados.</strong>
      <p>Use isto como lista de trabalho — o que falta marcar é o seu próximo passo.</p></div>`;
  }
  return `<div class="ac-ativ-res">
    <strong>${tent.acertos} de ${tent.total} ${tent.acertos===1?'certa':'certas'}.</strong>
    <ul>${itens.map(it=>{
      const resp = tent.respostas && tent.respostas[it.id];
      const ok = String(resp)===String(it.correta);
      return `<li class="${ok?'is-ok':'is-no'}">${ok?acIco('check'):acIco('alerta')}
        <span><strong>${gEsc(it.enunciado||'')}</strong>
        ${it.explicacao?`<small>${gEsc(it.explicacao)}</small>`:''}</span></li>`;
    }).join('')}</ul>
    <p class="ac-ativ-dica">Ficou dúvida em algum item? Pergunte ao agente ao lado — ele dá pistas sem entregar a resposta.</p>
  </div>`;
}
async function acEnviarAtividade(){
  const aula = acAula(acState.aulaId); if(!aula) return;
  const at = aula.atividade||{}, itens = at.itens||[];
  const form = document.getElementById('ac-ativ-form'); if(!form) return;
  const respostas = {};
  let acertos = 0;
  itens.forEach((it,i)=>{
    const nome = it.id||('i'+i);
    if(at.tipo==='checklist'){
      const cb = form.querySelector(`[name="${nome}"]`);
      respostas[nome] = !!(cb&&cb.checked);
      if(respostas[nome]) acertos++;
    }else{
      const sel = form.querySelector(`[name="${nome}"]:checked`);
      respostas[nome] = sel ? sel.value : null;
      if(sel && String(sel.value)===String(it.correta)) acertos++;
    }
  });
  const tent = { em:new Date().toISOString(), acertos, total:itens.length, respostas };
  const p = acProg(aula.id);
  await acSalvarProgresso(aula.id, { tentativas: (p.tentativas||[]).concat([tent]).slice(-10) });
  const res = document.getElementById('ac-ativ-res');
  if(res){ res.innerHTML = acAtivResultadoHTML(aula, tent); res.scrollIntoView&&res.scrollIntoView({block:'nearest',behavior:'smooth'}); }
  if(typeof gTrackEvent==='function') gTrackEvent('atividade_respondida',{aula_id:aula.id, acertos, total:itens.length});
}

/* ══════════════════════════════════════════════════════════════
   PAINÉIS (drawer no mobile · recolhível no desktop)
══════════════════════════════════════════════════════════════ */
function acAbrirSide(){
  document.body.classList.add('ac-side-open');
  const b = document.querySelector('#ac-aula-side .ac-side-fechar'); if(b){ try{b.focus();}catch(e){} }
}
function acAbrirAgente(){
  document.body.classList.add('ac-agente-open');
  document.body.classList.remove('ac-agente-recolhido');
  _acLembrarAgente(false);
  const t = document.getElementById('ac-agente-input'); if(t){ try{t.focus();}catch(e){} }
}
function acFecharPaineis(){
  document.body.classList.remove('ac-side-open','ac-agente-open');
}
function acRecolherAgente(){
  const rec = !document.body.classList.contains('ac-agente-recolhido');
  document.body.classList.toggle('ac-agente-recolhido', rec);
  document.body.classList.remove('ac-agente-open');
  _acLembrarAgente(rec);
}
// Aberto/fechado é preferência por usuário, guardada localmente (não é dado de negócio).
function _acLembrarAgente(recolhido){
  try{ localStorage.setItem('yngs_ac_agente_recolhido_'+(_acUid()||'anon'), recolhido?'1':'0'); }catch(e){}
}
function acAplicarAgenteRecolhido(){
  let rec = false;
  try{ rec = localStorage.getItem('yngs_ac_agente_recolhido_'+(_acUid()||'anon'))==='1'; }catch(e){}
  document.body.classList.toggle('ac-agente-recolhido', rec);
  try{
    const v = Number(localStorage.getItem('yngs_ac_velocidade'))||1;
    const sel = document.getElementById('ac-vel-sel');
    if(sel && v!==1){ sel.value = String(v); acVelocidade(v); }
  }catch(e){}
}

// Esc fecha os drawers (sem sequestrar o Esc de modais: só age se algum estiver aberto)
document.addEventListener('keydown', (e)=>{
  if(e.key!=='Escape') return;
  if(document.body.classList.contains('ac-side-open') || document.body.classList.contains('ac-agente-open')){
    e.preventDefault(); acFecharPaineis();
  }
}, false);
