/**
 * js/calendario/apresentacao.js
 *
 * CALENDÁRIO — A APRESENTAÇÃO DO MÊS.
 * O ritual que a operação fazia em PowerPoint (ver `Calendário JULHO - 2025.pdf`):
 * capa do mês → o que é novidade → as campanhas que ficam → e o mês assenta no
 * calendário. Aqui isso vira uma sequência de cenas em tela cheia que toca
 * sozinha na primeira vez do mês e depois vira botão.
 *
 * A ORDEM DAS CENAS É A DO DECK, não uma invenção:
 *   1. capa            — "SETEMBRO 2026" e a frase do mês
 *   2. numeros         — o mês em quatro números
 *   3. mae (uma cada)  — as campanhas-mãe / novidades, uma cena por campanha
 *   4. turbinar        — as aceleradoras, juntas
 *   5. manutencao      — as que ficam o mês inteiro
 *   6. datas           — datas especiais e conteúdo de redes
 *   7. fecho           — "o mês fica assim" e dissolve no calendário
 *
 * ⚠ A apresentação NÃO tem conteúdo próprio. Toda cena sai de `calState.eventos`
 * (ou seja, de `conteudo.js`). Escrever texto de campanha aqui criaria uma
 * segunda fonte que envelheceria sozinha — é a regra dos motores únicos.
 *
 * ⚠ Ela NÃO é um slideshow genérico: só existe para o mês que a operação
 * publicou. Mês sem publicação não tem apresentação (`calMesPublicado`).
 *
 * Depende de: calendario.js (estado, helpers, calBannerImg, CAL_TIPOS).
 */

const CAL_APRES_VISTA = 'luma_cal_apres_v1';   // último mês já apresentado

let calApres = { cenas:[], i:0, tocando:false, timer:null, mes:'' };

/* ══════════════════════════════════════════════════════════════
   MONTAGEM DAS CENAS
   Cada cena é { tipo, dur, html }. `dur` é quanto ela fica no ar no modo
   automático — cena com mais texto ganha mais tempo, porque ler leva tempo.
══════════════════════════════════════════════════════════════ */
function calApresCenas(ym){
  const evs = calState.eventos.filter(e=>String(e.inicio).slice(0,7)===ym || String(e.fim).slice(0,7)===ym);
  const d = calData(ym+'-01');
  const mes = CAL_MESES[d.getMonth()], ano = d.getFullYear();

  const doBucket = b => evs.filter(e=>e.bucket===b);
  const maes  = doBucket('mae-novidade');
  const turbo = doBucket('turbinar');
  const manut = doBucket('manutencao');
  const datas = evs.filter(e=>e.tipo==='especial' || e.tipo==='social')
                   .sort((a,b)=>a.inicio<b.inicio?-1:1);
  const crms  = evs.filter(e=>e.tipo==='crm');
  const cenas = [];

  /* 1 — CAPA */
  const manchete = maes.length
    ? `O mês da ${maes[0].titulo.split('·')[0].trim()}`
    : 'O calendário do mês';
  cenas.push({ tipo:'capa', dur:3400, html:`
    <div class="ap-capa">
      <p class="ap-capa-et" style="--i:0">Calendário de marketing</p>
      <h1 class="ap-capa-mes" style="--i:1">${gEsc(mes)}</h1>
      <p class="ap-capa-ano" style="--i:2">${ano}</p>
      <p class="ap-capa-sub" style="--i:3">${gEsc(manchete)}</p>
    </div>`});

  /* 2 — O MÊS EM NÚMEROS */
  const nums = [
    [maes.length, maes.length===1?'campanha-mãe':'campanhas-mãe', 'mae'],
    [turbo.length+manut.length, 'campanhas que ficam', 'recorrente'],
    [crms.reduce((a,e)=>a+(e.disparos?e.disparos.length:1),0), 'disparos de CRM', 'crm'],
    [datas.length, 'datas do mês', 'especial']
  ];
  cenas.push({ tipo:'numeros', dur:4200, html:`
    <div class="ap-bloco">
      <p class="ap-et" style="--i:0">${gEsc(mes)} em números</p>
      <div class="ap-nums">
        ${nums.map(([v,l,t],i)=>`<div class="ap-num cal-t-${t}" style="--i:${i+1}">
          <b data-num="${v}">0</b><span>${gEsc(l)}</span></div>`).join('')}
      </div>
    </div>`});

  /* 3 — UMA CENA POR CAMPANHA-MÃE (a ficha do deck) */
  maes.forEach((e,n)=>{
    const banner = calBannerImg(e, 'ap-banner');
    const pontos = (e.cadastrar||[]).slice(0,4);
    cenas.push({ tipo:'mae', dur: 6200, ev:e.id, html:`
      <div class="ap-bloco ap-ficha cal-t-${e.tipo}">
        <p class="ap-et" style="--i:0">${maes.length>1?`Campanha-mãe ${n+1} de ${maes.length}`:'A campanha-mãe do mês'}</p>
        ${banner?`<div class="ap-banner-cx" style="--i:1" data-banner="1">${banner}</div>`:''}
        <h2 class="ap-titulo" style="--i:2">${gEsc(e.titulo)}</h2>
        <div class="ap-meta" style="--i:3">
          <span class="ap-chip">${gEsc(calFmtIntervalo(e))}</span>
          ${e.escopo?`<span class="ap-chip">${gEsc(e.escopo)}</span>`:''}
          ${e.regra?`<span class="ap-chip ap-chip--forte">${gEsc(e.regra)}</span>`:''}
        </div>
        ${e.resumo?`<p class="ap-texto" style="--i:4">${gEsc(e.resumo)}</p>`:''}
        ${pontos.length?`<div class="ap-pontos" style="--i:5">
          <span class="ap-pontos-l">O que cadastrar</span>
          <ul>${pontos.map((t,i)=>`<li style="--j:${i}">${gEsc(t)}</li>`).join('')}</ul>
        </div>`:''}
        ${e.cadastro?`<p class="ap-nota" style="--i:6">${calIco('lapis')}${gEsc(e.cadastro)}</p>`:''}
      </div>`});
  });

  /* 4 e 5 — AS QUE FICAM (aceleradoras e manutenção) */
  const grupo = (lista, et, titulo, texto) => lista.length && cenas.push({
    tipo:'grupo', dur: 4200 + lista.length*500, html:`
    <div class="ap-bloco">
      <p class="ap-et" style="--i:0">${gEsc(et)}</p>
      <h2 class="ap-titulo" style="--i:1">${gEsc(titulo)}</h2>
      <p class="ap-texto" style="--i:2">${gEsc(texto)}</p>
      <div class="ap-cards" style="--i:3">
        ${lista.map((e,i)=>{
          const b=calBannerImg(e,'ap-card-banner');
          return `<div class="ap-card cal-t-${e.tipo}" style="--j:${i}" ${b?'data-banner="1"':''}>
            ${b||`<span class="ap-card-ponto"></span>`}
            <b>${gEsc(e.titulo)}</b>
            ${e.regra?`<span>${gEsc(e.regra)}</span>`:''}
          </div>`;
        }).join('')}
      </div>
    </div>`});
  grupo(turbo, 'Para turbinar', 'As aceleradoras',
        'Use quando o pico chegar — fim de semana, feriado, o dia da campanha-mãe.');
  grupo(manut, 'As que ficam', 'Presença o mês inteiro',
        'Cadastro simples, ritmo constante. É o chão da vitrine enquanto o resto entra e sai.');

  /* 6 — AS DATAS DO MÊS */
  if(datas.length) cenas.push({ tipo:'datas', dur: 3600 + datas.length*260, html:`
    <div class="ap-bloco">
      <p class="ap-et" style="--i:0">No radar</p>
      <h2 class="ap-titulo" style="--i:1">As datas de ${gEsc(mes)}</h2>
      <ol class="ap-datas" style="--i:2;--linhas:${Math.ceil(datas.length/2)}">
        ${datas.map((e,i)=>`<li class="cal-t-${e.tipo}" style="--j:${i}">
          <b>${calData(e.inicio).getDate()}</b>
          <span>${gEsc(e.titulo)}</span>
          <em>${gEsc(CAL_TIPOS[e.tipo].label)}</em>
        </li>`).join('')}
      </ol>
    </div>`});

  /* 7 — FECHO */
  cenas.push({ tipo:'fecho', dur:2800, html:`
    <div class="ap-capa ap-fecho">
      <p class="ap-capa-et" style="--i:0">É isso que a rede comunica em ${gEsc(mes)}</p>
      <h1 class="ap-fecho-t" style="--i:1">Bora?</h1>
      <p class="ap-capa-sub" style="--i:2">O calendário fica aqui, sempre que precisar consultar.</p>
    </div>`});

  return cenas;
}

/* ══════════════════════════════════════════════════════════════
   ABRIR / FECHAR
══════════════════════════════════════════════════════════════ */
function calApresAbrir(auto){
  const ym = String(calState.ancora).slice(0,7);
  // A chave do Controle do produto vale para os dois caminhos: o automático da
  // primeira vez do mês e o botão de rever.
  if(!calTemApres()){
    if(!auto && typeof gFeatureBlockedFeedback==='function') gFeatureBlockedFeedback('calendario.apresentacao');
    return false;
  }
  if(!calMesPublicado(ym)){
    if(!auto) gToast('A operação ainda não publicou este mês.','info');
    return false;
  }
  const cenas = calApresCenas(ym);
  if(!cenas.length) return false;

  calApres = { cenas, i:0, tocando:true, timer:null, mes:ym };
  let el = document.getElementById('cal-apres');
  if(!el){
    el = document.createElement('div');
    el.id='cal-apres'; el.className='cal-apres';
    el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true');
    el.setAttribute('aria-label','Apresentação do mês');
    document.body.appendChild(el);
  }
  document.body.classList.add('cal-apres-on');
  calApresPinta();
  requestAnimationFrame(()=>el.classList.add('on'));
  document.addEventListener('keydown', calApresTecla, true);
  calApresMarcaVista(ym);
  if(typeof gTrackEvent==='function') gTrackEvent('calendario_apresentacao',{mes:ym, auto:!!auto});
  return true;
}
function calApresFechar(){
  const el=document.getElementById('cal-apres'); if(!el) return false;
  clearTimeout(calApres.timer);
  calApres.tocando=false;
  el.classList.remove('on'); el.classList.add('saindo');
  document.body.classList.remove('cal-apres-on');
  document.removeEventListener('keydown', calApresTecla, true);
  setTimeout(()=>{ if(el.parentNode) el.parentNode.removeChild(el); }, 420);
  return true;
}

// A pessoa já viu a apresentação deste mês? Guarda o mês, não um booleano:
// assim outubro toca de novo sozinho sem ninguém precisar limpar nada.
function calApresJaViu(ym){
  try{ return localStorage.getItem(CAL_APRES_VISTA)===ym; }catch(e){ return false; }
}
function calApresMarcaVista(ym){
  try{ localStorage.setItem(CAL_APRES_VISTA, ym); }catch(e){}
}
// Chamado uma vez, na montagem do módulo.
function calApresTalvez(){
  const ym=calHoje().slice(0,7);
  if(calApresJaViu(ym) || !calMesPublicado(ym) || !calTemApres()) return;
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    calApresMarcaVista(ym);   // não abre, mas também não fica insistindo
    return;
  }
  setTimeout(()=>calApresAbrir(true), 620);   // deixa a view entrar antes
}

/* ══════════════════════════════════════════════════════════════
   RENDER E NAVEGAÇÃO
══════════════════════════════════════════════════════════════ */
function calApresPinta(){
  const el=document.getElementById('cal-apres'); if(!el) return;
  const c=calApres.cenas[calApres.i];
  el.innerHTML = `
    <div class="ap-trilho" aria-hidden="true">
      ${calApres.cenas.map((_,i)=>`<span class="ap-trilho-s${i<calApres.i?' feita':''}${i===calApres.i?' atual':''}"
        ><i style="--dur:${calApres.cenas[i].dur}ms"></i></span>`).join('')}
    </div>
    <button class="ap-sair" onclick="calApresFechar()">Pular<span class="ap-sair-k">Esc</span></button>
    <div class="ap-palco ap-cena--${c.tipo}" id="ap-palco">${c.html}</div>
    <div class="ap-ctrl">
      <button class="ap-nav" onclick="calApresIr(-1)" ${calApres.i?'':'disabled'} aria-label="Cena anterior">${calIco('ant')}</button>
      <button class="ap-play" onclick="calApresPlay()" aria-label="${calApres.tocando?'Pausar':'Continuar'}">
        ${calApres.tocando?'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'
                          :'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>'}
      </button>
      <button class="ap-nav" onclick="calApresIr(1)" aria-label="Próxima cena">${calIco('prox')}</button>
      <span class="ap-conta">${calApres.i+1} / ${calApres.cenas.length}</span>
    </div>`;
  if(calApres.cenas[calApres.i].tipo==='numeros') calApresNumeros();
  calApresAgenda();
}
// Avança sozinho. O timer é sempre recriado do zero — pausar e voltar não
// herda o tempo já corrido, que daria a impressão de cena "engolida".
function calApresAgenda(){
  clearTimeout(calApres.timer);
  if(!calApres.tocando) return;
  calApres.timer=setTimeout(()=>{
    if(calApres.i >= calApres.cenas.length-1) calApresFechar();
    else calApresIr(1);
  }, calApres.cenas[calApres.i].dur);
}
function calApresIr(passo){
  const n = calApres.i + passo;
  if(n < 0) return;
  if(n >= calApres.cenas.length){ calApresFechar(); return; }
  calApres.i = n;
  calApresPinta();
}
function calApresPlay(){
  calApres.tocando = !calApres.tocando;
  calApresPinta();
}
function calApresTecla(e){
  if(!document.getElementById('cal-apres')) return;
  const k=e.key;
  if(k==='Escape'){ e.preventDefault(); e.stopPropagation(); calApresFechar(); }
  else if(k==='ArrowRight'||k==='PageDown'){ e.preventDefault(); e.stopPropagation(); calApres.tocando=false; calApresIr(1); }
  else if(k==='ArrowLeft'||k==='PageUp'){ e.preventDefault(); e.stopPropagation(); calApres.tocando=false; calApresIr(-1); }
  else if(k===' '){ e.preventDefault(); e.stopPropagation(); calApresPlay(); }
}
// Os números da cena 2 sobem em vez de aparecer prontos.
function calApresNumeros(){
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    document.querySelectorAll('.ap-num b[data-num]').forEach(b=>b.textContent=b.dataset.num);
    return;
  }
  document.querySelectorAll('.ap-num b[data-num]').forEach((el,i)=>{
    const alvo=+el.dataset.num||0;
    const t0=performance.now()+220+i*90, dur=760;
    const passo=t=>{
      if(t<t0){ requestAnimationFrame(passo); return; }
      const p=Math.min(1,(t-t0)/dur);
      el.textContent=Math.round(alvo*(1-Math.pow(1-p,3)));
      if(p<1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  });
}
