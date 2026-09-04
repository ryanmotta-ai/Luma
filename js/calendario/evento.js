/**
 * js/calendario/evento.js
 *
 * CALENDÁRIO — tudo que acontece EM CIMA da grade:
 *   · Context preview — o resumo que aparece ao passar o ponteiro, sem modal
 *   · Detalhe do evento — a folha que expande do cartão clicado
 *   · Criar/editar — o fluxo progressivo (um campo puxa o próximo)
 *   · Date picker e Time picker — as duas experiências próprias
 *   · Smart suggestions — horários livres sugeridos na hora de escolher
 *
 * ⚠ Só a equipe DM cria e edita (`calPodeEditar`). Para o franqueado este
 * arquivo entrega apenas leitura: preview e detalhe.
 *
 * ⛔ NÃO EXISTE "adicionar na minha agenda". Aqui já morou um Quick Add em
 * linguagem natural ("Reunião amanhã às 14h") na home; saiu por decisão do Ryan
 * em 03/09, e o motivo vale para o que vier depois: este é o calendário de
 * MARKETING DA REDE, não a agenda pessoal do franqueado. O que se publica aqui
 * é campanha, disparo e data da operação — o que a rede comunica, não
 * compromisso de quem lê. É a mesma fronteira do `07_ROADMAP` §4 ("não tem
 * lembrete, nem planner pessoal, nem 'minha agenda'").
 *
 * Depende de: calendario.js (estado, helpers), agenda.js (calVaos),
 * core/toast.js (gToast, gEsc), core/auth.js (gIsAdmin).
 */

/* ══════════════════════════════════════════════════════════════
   RASCUNHO DO EDITOR
   `passo` é o motor da revelação progressiva: o formulário não nasce
   inteiro, cresce conforme a pessoa responde. É o oposto do formulário
   pesado que o brief manda evitar.
══════════════════════════════════════════════════════════════ */
let calEd = null;   // {id?, titulo, tipo, inicio, fim, hora, duracao, camp, escopo, regra, nota, passo}

function calNovoEvento(iso, hora){
  if(!calPodeEditar()){ gToast('Só a equipe Delivery Much edita o calendário.','error'); return; }
  calEd = { id:null, titulo:'', tipo:'mae', inicio:iso||calState.selecionado||calHoje(),
            fim:iso||calState.selecionado||calHoje(), hora:hora||null, duracao:hora?60:null,
            camp:null, escopo:'Nacional', regra:'', nota:'', passo:1, mini:iso||calState.selecionado||calHoje() };
  calAbreFolha('editor');
}
function calEditarEvento(id){
  const ev=calById(id); if(!ev) return;
  if(!calPodeEditar()){ gToast('Só a equipe Delivery Much edita o calendário.','error'); return; }
  if(ev.origem==='oficial'){ gToast('Evento oficial da rede: leitura apenas.','info'); return; }
  calEd = { ...ev, passo:9, mini:ev.inicio };
  calAbreFolha('editor');
}

/* ══════════════════════════════════════════════════════════════
   A FOLHA (sheet)
   Lateral no desktop, de baixo para cima no celular. Uma folha só serve
   detalhe e editor — dois overlays concorrentes seriam o segundo motor de
   modal, e o Luma já tem um (`_gDialog`) para confirmação.
══════════════════════════════════════════════════════════════ */
function calAbreFolha(modo){
  let el=document.getElementById('cal-folha');
  if(!el){
    el=document.createElement('div');
    el.id='cal-folha'; el.className='cal-folha';
    el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true');
    document.body.appendChild(el);
    el.addEventListener('click', e=>{ if(e.target===el) calFecharFolha(); });
  }
  el.dataset.modo=modo;
  calPintaFolha();
  el.classList.remove('saindo');
  requestAnimationFrame(()=>el.classList.add('aberta'));
  document.body.classList.add('cal-folha-on');
  // Foco no primeiro campo/ação — teclado nunca fica órfão atrás do overlay.
  setTimeout(()=>{
    const alvo=el.querySelector('[data-foco],input,button');
    if(alvo) alvo.focus();
  }, 120);
}
function calPintaFolha(){
  const el=document.getElementById('cal-folha'); if(!el) return;
  el.innerHTML = `<div class="cal-folha-cx" role="document">${el.dataset.modo==='editor'?calEditorHtml():calDetalheHtml()}</div>`;
  if(el.dataset.modo==='editor') calEditorMontado();
}
function calFecharFolha(){
  const el=document.getElementById('cal-folha'); if(!el) return false;
  el.classList.remove('aberta'); el.classList.add('saindo');
  document.body.classList.remove('cal-folha-on');
  setTimeout(()=>{ if(el&&el.parentNode) el.parentNode.removeChild(el); }, 260);
  calEd=null;
  if(calState.aberto){ calState.aberto=null; calRender(); }
  return true;
}
// Esc fecha na ordem certa: preview → folha. Devolve true se fechou algo.
function calFecharTudo(){
  if(calPreviewSai(true)) return true;
  if(document.getElementById('cal-folha')) return calFecharFolha();
  return false;
}

/* ══════════════════════════════════════════════════════════════
   DETALHE DO EVENTO
   Abre a partir do cartão clicado (expand, não pop): a folha nasce da
   posição do elemento — o CSS usa --ox/--oy que gravamos aqui.
══════════════════════════════════════════════════════════════ */
function calAbrirDetalhe(id, e){
  const ev=calById(id); if(!ev) return;
  if(e && e.stopPropagation) e.stopPropagation();
  calPreviewSai(true);
  calState.aberto=id;
  if(e && e.currentTarget && e.currentTarget.getBoundingClientRect){
    const r=e.currentTarget.getBoundingClientRect();
    document.documentElement.style.setProperty('--cal-ox', (r.left+r.width/2)+'px');
    document.documentElement.style.setProperty('--cal-oy', (r.top+r.height/2)+'px');
  }
  calAbreFolha('detalhe');
  document.querySelectorAll(`[data-id="${CSS.escape(id)}"]`).forEach(n=>n.classList.add('sel'));
}
function calDetalheHtml(){
  const ev=calById(calState.aberto);
  if(!ev) return `<div class="cal-folha-vazia">${calVazio('Evento não encontrado','Ele pode ter sido apagado em outra aba.','')}</div>`;
  const camp=calCamp(ev), tipo=CAL_TIPOS[ev.tipo];
  const conf=calTemConflito(ev);
  const editavel=calPodeEditar() && ev.origem!=='oficial';
  const banner=calBannerImg(ev,'cal-banner--folha');
  return `<header class="cal-fh cal-t-${ev.tipo}${banner?' com-banner':''}" ${banner?'data-banner="1"':''}>
    ${banner}
    <div class="cal-fh-l">
      <span class="cal-fh-tipo"><span class="cal-ponto"></span>${gEsc(tipo.label)}</span>
      <button class="cal-fh-x" onclick="calFecharFolha()" aria-label="Fechar">${calIco('x')}</button>
    </div>
  </header>
  <div class="cal-fb">
    <h2 class="cal-fb-t">${gEsc(ev.titulo)}</h2>
    <dl class="cal-fb-dl">
      <div><dt>${calIco('cal')}Quando</dt><dd>${gEsc(calFmtIntervalo(ev))}${ev.hora?` · ${gEsc(ev.hora)}–${calHora(calMin(ev.hora)+(ev.duracao||60))}`:''}
        <em>${gEsc(calFmtRelativo(ev.inicio))}</em></dd></div>
      <div><dt>${calIco('local')}Onde vale</dt><dd>${gEsc(ev.escopo)}</dd></div>
      ${ev.regra?`<div><dt>${calIco('raio')}Regra</dt><dd>${gEsc(ev.regra)}</dd></div>`:''}
      ${camp?`<div><dt>${calIco('arte')}Campanha</dt><dd>${gEsc(camp.name)}</dd></div>`:''}
    </dl>
    ${ev.nota?`<p class="cal-fb-nota">${gEsc(ev.nota)}</p>`:''}
    ${conf?`<p class="cal-fb-conf">${calIco('alerta')}Este horário se cruza com outro evento do mesmo dia.</p>`:''}
    ${ev.origem==='oficial'?`<p class="cal-fb-of">${calIco('check')}Evento oficial da rede. A data vem da operação — aqui é leitura.</p>`:''}
  </div>
  <footer class="cal-ff">
    ${camp?`<button class="cal-cta" onclick="calAbrirArtes('${gEsc(ev.id)}')">${calIco('arte')}<span>Ver as artes</span>${calIco('seta')}</button>`
          :`<button class="cal-cta cal-cta--calmo" onclick="calSelecionar('${ev.inicio}',{abrirDia:true});calFecharFolha()">${calIco('cal')}<span>Abrir o dia</span></button>`}
    ${calPodeEditar()?`<button class="cal-b-fantasma" onclick="calAlternaConcluido('${gEsc(ev.id)}');calPintaFolha()">
        ${calIco('check')}<span>${ev.concluido?'Reabrir':'Concluir'}</span></button>`:''}
    ${editavel?`<button class="cal-b-fantasma" onclick="calEditarEvento('${gEsc(ev.id)}')">${calIco('lapis')}<span>Editar</span></button>
      <button class="cal-b-fantasma cal-b-perigo" onclick="calApagarEvento('${gEsc(ev.id)}').then(ok=>{if(ok)calFecharFolha()})">Apagar</button>`:''}
  </footer>`;
}

/* ══════════════════════════════════════════════════════════════
   CONTEXT PREVIEW
   Passar o ponteiro mostra o resumo SEM abrir modal. Aparece com atraso
   (220ms) para não piscar enquanto o ponteiro atravessa a grade, e some na
   hora. No toque não existe hover: lá o clique já abre o detalhe.
══════════════════════════════════════════════════════════════ */
let _calPrevT=null, _calPrevEl=null;
function calPreviewEntra(node, id){
  if(window.matchMedia && window.matchMedia('(hover: none)').matches) return;
  clearTimeout(_calPrevT);
  _calPrevT=setTimeout(()=>calPreviewMostra(node,id), 220);
}
function calPreviewMostra(node, id){
  const ev=calById(id); if(!ev||!node||!node.isConnected) return;
  calPreviewSai(true);
  const camp=calCamp(ev), tipo=CAL_TIPOS[ev.tipo];
  const el=document.createElement('div');
  el.className=`cal-prev cal-t-${ev.tipo}`;
  el.setAttribute('role','tooltip');
  const banner=calBannerImg(ev,'cal-banner--prev');
  if(banner) el.setAttribute('data-banner','1');
  el.innerHTML=`${banner}<span class="cal-prev-tipo"><span class="cal-ponto"></span>${gEsc(tipo.label)}</span>
    <b class="cal-prev-t">${gEsc(ev.titulo)}</b>
    <span class="cal-prev-q">${gEsc(calFmtIntervalo(ev))}${ev.hora?` · ${gEsc(ev.hora)}`:''} · ${gEsc(calFmtRelativo(ev.inicio))}</span>
    ${ev.regra?`<span class="cal-prev-r">${gEsc(ev.regra)}</span>`:''}
    ${ev.escopo!=='Nacional'?`<span class="cal-prev-e">${gEsc(ev.escopo)}</span>`:''}
    ${camp?`<span class="cal-prev-c">${calIco('arte')}${gEsc(camp.name)} · clique para ver as artes</span>`:''}`;
  document.body.appendChild(el);
  const r=node.getBoundingClientRect(), b=el.getBoundingClientRect();
  let x=r.left+r.width/2-b.width/2, y=r.top-b.height-10;
  if(y<8){ y=r.bottom+10; el.classList.add('abaixo'); }
  x=Math.max(8, Math.min(x, window.innerWidth-b.width-8));
  el.style.left=x+'px'; el.style.top=y+'px';
  requestAnimationFrame(()=>el.classList.add('on'));
  _calPrevEl=el;
}
function calPreviewSai(imediato){
  clearTimeout(_calPrevT);
  if(!_calPrevEl) return false;
  const el=_calPrevEl; _calPrevEl=null;
  el.classList.remove('on');
  setTimeout(()=>{ if(el.parentNode) el.parentNode.removeChild(el); }, imediato?0:160);
  return true;
}

/* ══════════════════════════════════════════════════════════════
   EDITOR — revelação progressiva
   passo 1: título · 2: quando · 3: tipo e alcance · 9: tudo (edição)
   Nada de formulário de 9 campos na cara: o próximo campo só existe depois
   que o anterior tem resposta.
══════════════════════════════════════════════════════════════ */
function calEditorHtml(){
  if(!calEd) return '';
  const p=calEd.passo, novo=!calEd.id;
  const ver=n=>p>=n||p===9;
  // Três batidas, não nove campos: (1) o que acontece → (2) quando e de que
  // tipo → (3) o resto, por escolha. Tipo entra na 2ª e não numa 3ª própria
  // porque ele muda a leitura do evento inteiro: escondê-lo atrás de um clique
  // na data fazia todo evento novo nascer "campanha-mãe" sem ninguém decidir.
  return `<header class="cal-fh cal-t-${calEd.tipo}">
    <div class="cal-fh-l">
      <span class="cal-fh-tipo">${gEsc(novo?'Novo evento':'Editar evento')}</span>
      <button class="cal-fh-x" onclick="calFecharFolha()" aria-label="Fechar">${calIco('x')}</button>
    </div>
  </header>
  <form class="cal-fb cal-form" onsubmit="event.preventDefault();calEditorSalvar()">

    <label class="cal-campo">
      <span class="cal-campo-l">O que acontece</span>
      <input class="cal-in" type="text" data-foco value="${gEsc(calEd.titulo)}" maxlength="80"
        placeholder="Semana do Cliente" oninput="calEdSet('titulo',this.value)">
      <span class="cal-campo-ct">${calEd.titulo.length}/80</span>
    </label>

    <div class="cal-passo${ver(2)?' on':''}">
      <span class="cal-campo-l">Quando</span>
      <div class="cal-quando">
        <button type="button" class="cal-in cal-in--b" onclick="calAbreDatePicker('inicio')">
          ${calIco('cal')}<b>${gEsc(calFmtDiaCurto(calEd.inicio))}</b></button>
        <span class="cal-quando-ate">até</span>
        <button type="button" class="cal-in cal-in--b" onclick="calAbreDatePicker('fim')">
          <b>${gEsc(calFmtDiaCurto(calEd.fim))}</b></button>
      </div>
      <div class="cal-quando2">
        <button type="button" class="cal-in cal-in--b${calEd.hora?' tem':''}" onclick="calAbreTimePicker()">
          ${calIco('relog')}<b>${calEd.hora?gEsc(calEd.hora):'Dia inteiro'}</b></button>
        ${calEd.hora?`<button type="button" class="cal-link" onclick="calEdSet('hora',null);calPintaFolha()">tirar a hora</button>`:''}
      </div>
      ${calEd.hora?calSugestoes():''}
      ${calEdConflito()}
    </div>

    <div class="cal-passo${ver(2)?' on':''}">
      <span class="cal-campo-l">Tipo</span>
      <div class="cal-tipos">
        ${CAL_TIPOS_ORDEM.map(t=>`<button type="button" class="cal-tipo-b cal-t-${t}${calEd.tipo===t?' ativo':''}"
          onclick="calEdSet('tipo','${t}');calPintaFolha()" aria-pressed="${calEd.tipo===t}">
          <span class="cal-ponto"></span>${gEsc(CAL_TIPOS[t].curto)}</button>`).join('')}
      </div>
      <p class="cal-tipo-d">${gEsc(CAL_TIPOS[calEd.tipo].desc)}</p>
    </div>

    <div class="cal-passo${ver(2)?' on':''}">
      <label class="cal-campo">
        <span class="cal-campo-l">Onde vale</span>
        <input class="cal-in" type="text" value="${gEsc(calEd.escopo)}" maxlength="40"
          placeholder="Nacional" oninput="calEdSet('escopo',this.value)" list="cal-escopos">
        <datalist id="cal-escopos"><option value="Nacional"><option value="Só RS"><option value="Só SC"><option value="Sudeste"></datalist>
      </label>
    </div>

    <div class="cal-passo${p===9?' on':''}">
      <label class="cal-campo">
        <span class="cal-campo-l">Regra da oferta <em>opcional</em></span>
        <input class="cal-in" type="text" value="${gEsc(calEd.regra)}" maxlength="120"
          placeholder="A partir de 30% off" oninput="calEdSet('regra',this.value)">
      </label>
      <label class="cal-campo">
        <span class="cal-campo-l">Campanha ligada <em>o clique leva às artes</em></span>
        <select class="cal-in" onchange="calEdSet('camp',this.value||null)">
          <option value="">Sem campanha</option>
          ${calCampsOpcoes(calEd.camp)}
        </select>
      </label>
      <label class="cal-campo">
        <span class="cal-campo-l">Observação <em>opcional</em></span>
        <textarea class="cal-in cal-in--ta" rows="3" maxlength="280"
          placeholder="O que a operação precisa saber" oninput="calEdSet('nota',this.value)">${gEsc(calEd.nota)}</textarea>
      </label>
    </div>

    ${p<9?`<button type="button" class="cal-link cal-mais-campos" onclick="calEd.passo=9;calPintaFolha()">
       Mais detalhes (regra, campanha, observação)</button>`:''}
  </form>
  <footer class="cal-ff">
    <button class="cal-cta" onclick="calEditorSalvar()" ${calEd.titulo.trim()?'':'disabled'}>
      ${calIco('check')}<span>${gEsc(calEd.id?'Salvar':'Criar evento')}</span></button>
    <button class="cal-b-fantasma" onclick="calFecharFolha()">Cancelar</button>
  </footer>`;
}
function calCampsOpcoes(sel){
  const todas=[].concat(typeof CAMPS_ATIVAS!=='undefined'?CAMPS_ATIVAS:[], typeof CAMPS_OUTRAS!=='undefined'?CAMPS_OUTRAS:[]);
  return todas.map(c=>`<option value="${gEsc(c.id)}"${sel===c.id?' selected':''}>${gEsc(c.name)}</option>`).join('');
}
function calEdSet(k, v){
  if(!calEd) return;
  calEd[k]=v;
  if(k==='titulo' && calEd.passo<2 && String(v).trim().length>=2){ calEd.passo=2; calPintaFolha(); return; }
  if(k==='inicio' && calEd.fim<calEd.inicio) calEd.fim=calEd.inicio;
  if(k==='fim' && calEd.fim<calEd.inicio) calEd.inicio=calEd.fim;
  if(k==='hora') calEd.duracao=v?(calEd.duracao||60):null;
  const b=document.querySelector('.cal-ff .cal-cta');
  if(b) b.disabled=!String(calEd.titulo||'').trim();
  const ct=document.querySelector('.cal-campo-ct');
  if(ct && k==='titulo') ct.textContent=`${String(v).length}/80`;
}
function calEditorMontado(){
  const el=document.getElementById('cal-folha');
  if(el) el.querySelectorAll('.cal-passo.on').forEach((n,i)=>n.style.setProperty('--i',i));
}
function calEditorSalvar(){
  if(!calEd) return;
  if(!String(calEd.titulo||'').trim()){ gToast('Falta o nome do evento.','error'); return; }
  const ev=calSalvarEvento(calEd);
  if(!ev) return;
  gToast(calEd.id?'Evento atualizado.':'Evento criado.','success');
  const id=ev.id;
  calState.selecionado=ev.inicio;
  calFecharFolha();
  calRender();
  requestAnimationFrame(()=>{
    const n=document.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if(n){ n.classList.add('cal-nasceu'); n.scrollIntoView({block:'nearest'}); }
  });
}
// Conflito avisado ANTES de salvar, no lugar onde a decisão é tomada.
function calEdConflito(){
  if(!calEd || !calEd.hora) return '';
  const ini=calMin(calEd.hora), fim=ini+(calEd.duracao||60);
  const bate=calState.eventos.filter(o=>o.id!==calEd.id && o.hora && o.inicio===calEd.inicio)
    .filter(o=>{ const a=calMin(o.hora), b=a+(o.duracao||60); return ini<b && a<fim; });
  if(!bate.length) return '';
  return `<p class="cal-alerta">${calIco('alerta')}Cruza com <b>${gEsc(bate[0].titulo)}</b> (${gEsc(bate[0].hora)}).
    Dá para salvar assim mesmo — o calendário só avisa.</p>`;
}
// Smart suggestions: os primeiros vãos livres do dia escolhido.
function calSugestoes(){
  const vaos=calVaos(calEd.inicio, calDoDia(calEd.inicio).filter(e=>e.hora && e.id!==calEd.id));
  if(!vaos.length) return '';
  return `<div class="cal-sug">
    <span class="cal-sug-l">${calIco('raio')}Livre neste dia</span>
    ${vaos.slice(0,3).map(([a])=>`<button type="button" class="cal-sug-b"
      onclick="calEdSet('hora','${calHora(a)}');calPintaFolha()">${calHora(a)}</button>`).join('')}
  </div>`;
}

/* ══════════════════════════════════════════════════════════════
   DATE PICKER
   O mini calendário do módulo, reaproveitado (`calMini`) — não existe um
   segundo desenho de grade de mês no projeto.
══════════════════════════════════════════════════════════════ */
function calAbreDatePicker(campo){
  let el=document.getElementById('cal-pick');
  if(!el){ el=document.createElement('div'); el.id='cal-pick'; el.className='cal-pick'; document.body.appendChild(el);
    el.addEventListener('click', e=>{ if(e.target===el) calFechaPicker(); }); }
  el.dataset.campo=campo;
  calPintaDatePicker();
  requestAnimationFrame(()=>el.classList.add('on'));
}
function calPintaDatePicker(){
  const el=document.getElementById('cal-pick'); if(!el) return;
  const campo=el.dataset.campo, atual=calEd?calEd[campo]:calHoje();
  el.innerHTML=`<div class="cal-pick-cx" role="dialog" aria-label="Escolher data">
    <div class="cal-pick-h"><b>${gEsc(campo==='inicio'?'Começa em':'Termina em')}</b>
      <button class="cal-fh-x" onclick="calFechaPicker()" aria-label="Fechar">${calIco('x')}</button></div>
    ${calMini(calEd.mini||atual, {sel:atual, onclick:`calPickData('%d')`, nav:'calPickNav(%p)', compacto:true})}
    <div class="cal-pick-rap">
      <button onclick="calPickData('${calHoje()}')">Hoje</button>
      <button onclick="calPickData('${calAddDias(calHoje(),1)}')">Amanhã</button>
      <button onclick="calPickData('${calAddDias(calHoje(),7)}')">Em 7 dias</button>
    </div>
  </div>`;
}
function calPickNav(p){ if(calEd){ calEd.mini=calAddMeses(calEd.mini||calEd.inicio, p); calPintaDatePicker(); } }
function calPickData(iso){
  const el=document.getElementById('cal-pick'); if(!el||!calEd) return;
  calEdSet(el.dataset.campo, iso);
  calEd.mini=iso;
  calFechaPicker();
  calPintaFolha();
}
function calFechaPicker(){
  const el=document.getElementById('cal-pick'); if(!el) return;
  el.classList.remove('on');
  setTimeout(()=>{ if(el.parentNode) el.parentNode.removeChild(el); }, 200);
}

/* ══════════════════════════════════════════════════════════════
   TIME PICKER
   Rolagem de 15 em 15 minutos, com a coluna de duração ao lado. Sem
   <input type=time>: no Android ele abre o relógio do sistema e quebra o
   ritmo da folha.
══════════════════════════════════════════════════════════════ */
function calAbreTimePicker(){
  let el=document.getElementById('cal-pick');
  if(!el){ el=document.createElement('div'); el.id='cal-pick'; el.className='cal-pick'; document.body.appendChild(el);
    el.addEventListener('click', e=>{ if(e.target===el) calFechaPicker(); }); }
  const atual=calEd&&calEd.hora?calMin(calEd.hora):9*60;
  const dur=calEd&&calEd.duracao?calEd.duracao:60;
  const horas=[]; for(let m=CAL_H_INI*60;m<CAL_H_FIM*60;m+=15) horas.push(m);
  const duracoes=[15,30,45,60,90,120,180,240];
  el.innerHTML=`<div class="cal-pick-cx cal-pick-cx--hora" role="dialog" aria-label="Escolher horário">
    <div class="cal-pick-h"><b>Horário</b>
      <button class="cal-fh-x" onclick="calFechaPicker()" aria-label="Fechar">${calIco('x')}</button></div>
    <div class="cal-hp">
      <div class="cal-hp-col" id="cal-hp-h" role="listbox" aria-label="Hora">
        ${horas.map(m=>`<button role="option" aria-selected="${m===atual}" class="cal-hp-i${m===atual?' on':''}"
          data-m="${m}" onclick="calPickHora(${m})">${calHora(m)}</button>`).join('')}
      </div>
      <div class="cal-hp-col cal-hp-col--dur" role="listbox" aria-label="Duração">
        ${duracoes.map(d=>`<button role="option" aria-selected="${d===dur}" class="cal-hp-i${d===dur?' on':''}"
          onclick="calPickDur(${d})">${d<60?d+' min':(d/60)+'h'}</button>`).join('')}
      </div>
    </div>
    <div class="cal-pick-rap"><button onclick="calPickHora(null)">Dia inteiro</button></div>
  </div>`;
  requestAnimationFrame(()=>{
    el.classList.add('on');
    const on=document.querySelector('#cal-hp-h .cal-hp-i.on');
    if(on) on.scrollIntoView({block:'center'});
  });
}
function calPickHora(m){
  if(!calEd) return;
  calEdSet('hora', m==null?null:calHora(m));
  if(m==null){ calFechaPicker(); calPintaFolha(); return; }
  document.querySelectorAll('#cal-hp-h .cal-hp-i').forEach(b=>{
    const on=+b.dataset.m===m; b.classList.toggle('on',on); b.setAttribute('aria-selected',on);
  });
  const t=document.querySelector('.cal-quando2 .cal-in--b b'); if(t) t.textContent=calHora(m);
}
function calPickDur(d){
  if(!calEd) return;
  calEd.duracao=d;
  document.querySelectorAll('.cal-hp-col--dur .cal-hp-i').forEach(b=>{
    const on=b.textContent===(d<60?d+' min':(d/60)+'h');
    b.classList.toggle('on',on); b.setAttribute('aria-selected',on);
  });
}
