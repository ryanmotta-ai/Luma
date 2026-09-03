/**
 * js/calendario/agenda.js
 *
 * CALENDÁRIO — as vistas de TEMPO: semana e dia.
 * A grade do mês responde "quando"; estas duas respondem "a que horas" e
 * "onde sobra espaço". Aqui moram: a régua de horas, a faixa de dia inteiro,
 * o posicionamento proporcional, a linha do agora, a detecção de conflito
 * lado a lado e os vãos livres.
 *
 * ⚠ POR QUE DUAS CAMADAS: no Luma quase todo evento é de DIA INTEIRO (uma
 * campanha não tem hora). Uma agenda só de horas ficaria vazia e mentiria
 * sobre o mês. Por isso a faixa de cima carrega as campanhas (como barras
 * contínuas) e a régua de baixo carrega o que tem hora — disparo de CRM,
 * live, reunião. Cada evento aparece exatamente uma vez.
 *
 * Depende de: calendario.js (estado, helpers de data, calCardEvento).
 */

/* ══════════════════════════════════════════════════════════════
   CONSTANTES DA RÉGUA
   A altura da hora é var CSS (--cal-h-hora) para o zoom não exigir JS; aqui
   guardamos só o espelho numérico usado no cálculo de posição.
══════════════════════════════════════════════════════════════ */
const CAL_H_INI = 6;    // a régua começa às 06h — antes disso a operação não roda
const CAL_H_FIM = 24;
function calAlturaHora(){
  const v=getComputedStyle(document.documentElement).getPropertyValue('--cal-h-hora');
  const n=parseFloat(v); return isNaN(n)?56:n;
}

/* ══════════════════════════════════════════════════════════════
   VISTA 3 — SEMANA
   Timeline vertical, sete colunas. Cada compromisso ocupa espaço
   proporcional à duração; o scroll abre já na hora útil.
══════════════════════════════════════════════════════════════ */
function calVistaSemana(){
  const dias=calSemanaDe(calState.ancora);
  const hoje=calHoje();
  const pistas=calPistasSemana(dias);
  const chao=calSempreNoAr();
  const temHora=calNoIntervalo(dias[0],dias[6]).some(e=>e.hora);
  const nada=!calNoIntervalo(dias[0],dias[6]).length;

  const cabecas=dias.map(d=>{
    const n=calDoDia(d).length;
    const cls=['cal-sh-d', d===hoje?'hoje':'', d===calState.selecionado?'sel':'', calFimDeSemana(d)?'fds':''].filter(Boolean).join(' ');
    return `<button class="${cls}" onclick="calSelecionar('${d}',{abrirDia:true})"
      aria-label="${gEsc(calFmtDiaLongo(d))}${n?`, ${n} eventos`:''}">
      <span class="cal-sh-sem">${gEsc(CAL_DIAS_C[calData(d).getDay()])}</span>
      <span class="cal-sh-num">${calData(d).getDate()}</span>
    </button>`;
  }).join('');

  return `<div class="cal-semana">
    ${chao}
    <div class="cal-sh">
      <div class="cal-sh-canto" aria-hidden="true">${calIco('relog')}</div>
      <div class="cal-sh-dias">${cabecas}</div>
    </div>

    ${pistas.length?`<div class="cal-allday">
      <span class="cal-allday-l">Campanhas</span>
      <div class="cal-allday-p" style="--pistas:${Math.min(pistas.length,5)}">
        ${pistas.slice(0,5).map((pista,pi)=>pista.map(f=>calFaixaSemana(f,pi)).join('')).join('')}
      </div>
    </div>`:''}

    ${nada
      ? `<div class="cal-semana-vazio">${calVazio('Semana livre','Nenhuma campanha cobre estes sete dias. As recorrentes seguem no ar.',
          `<button class="cal-cta cal-cta--calmo" onclick="calVista('mes')">Ver o mês</button>`)}</div>`
      : `<div class="cal-tl" id="cal-tl" role="grid" aria-label="Horários da semana">
          <div class="cal-tl-regua" aria-hidden="true">${calReguaHtml()}</div>
          <div class="cal-tl-cols">
            ${dias.map(d=>`<div class="cal-tl-col${d===hoje?' hoje':''}${calFimDeSemana(d)?' fds':''}" data-dia="${d}"
                ondblclick="calNovoNoClique(event,'${d}')">
              ${calGradeHoras()}
              ${calBlocosDoDia(d)}
              ${d===hoje?calLinhaAgora():''}
            </div>`).join('')}
          </div>
        </div>
        ${temHora?'':`<p class="cal-tl-nota">${calIco('relog')}Nenhum evento com hora marcada nesta semana — a régua fica de referência.</p>`}`}
  </div>`;
}

// As faixas de dia inteiro da semana, em pistas (mesma lógica do mês, mas
// recortada aos sete dias visíveis).
function calPistasSemana(dias){
  const a=dias[0], b=dias[6];
  // Mesma regra do mês: recorrente não ocupa pista (ver calPistas). Na semana
  // ela apareceria como sete barras de ponta a ponta, todas as semanas.
  const faixas=calNoIntervalo(a,b).filter(e=>!e.hora && e.tipo!=='recorrente')
    .sort((x,y)=> x.inicio!==y.inicio ? (x.inicio<y.inicio?-1:1) : (calDiff(x.inicio,x.fim)>calDiff(y.inicio,y.fim)?-1:1));
  const pistas=[];
  faixas.forEach(ev=>{
    const ini=Math.max(0, calDiff(a, ev.inicio)), fim=Math.min(6, calDiff(a, ev.fim));
    if(fim<0||ini>6) return;
    let p=0;
    while(pistas[p] && pistas[p].some(f=>!(f.fim<ini||f.ini>fim))) p++;
    pistas[p]=pistas[p]||[];
    pistas[p].push({ev, ini, fim, corta:{esq:ev.inicio<a, dir:ev.fim>b}});
  });
  return pistas;
}
function calFaixaSemana(f, pi){
  const ev=f.ev;
  const cls=['cal-faixa',`cal-t-${ev.tipo}`, ev.concluido?'concluido':'',
             f.corta.esq?'corta-esq':'', f.corta.dir?'corta-dir':'',
             calState.aberto===ev.id?'sel':''].filter(Boolean).join(' ');
  return `<button class="${cls}" style="--c:${f.ini};--n:${f.fim-f.ini+1};--p:${pi}"
    data-id="${gEsc(ev.id)}" onclick="calAbrirDetalhe('${gEsc(ev.id)}',event)"
    onmouseenter="calPreviewEntra(this,'${gEsc(ev.id)}')" onmouseleave="calPreviewSai()">
    <span class="cal-faixa-t">${gEsc(ev.titulo)}</span></button>`;
}

/* ══════════════════════════════════════════════════════════════
   VISTA 4 — DIA
   Agenda premium: blocos horários, eventos, conflitos e o espaço livre.
   O vão livre é mostrado de propósito — "o que sobra" é informação, não
   ausência de informação.
══════════════════════════════════════════════════════════════ */
function calVistaDia(){
  const d=calState.ancora, hoje=calHoje();
  const doDia=calDoDia(d);
  const inteiros=doDia.filter(e=>!e.hora && e.tipo!=='recorrente');
  const comHora=doDia.filter(e=>e.hora);
  const conflitos=calConflitosDoDia(d);

  return `<div class="cal-dia-v">
    <aside class="cal-dia-lado">
      <div class="cal-dia-cab">
        <p class="cal-dia-sem">${gEsc(CAL_DIAS[calData(d).getDay()])}${d===hoje?' · hoje':''}</p>
        <p class="cal-dia-big">${calData(d).getDate()}<em>${gEsc(CAL_MESES_C[calData(d).getMonth()])}</em></p>
      </div>
      ${calSempreNoAr()}
      ${inteiros.length?`<section class="cal-bloco">
        <h2 class="cal-bloco-h">No ar o dia inteiro</h2>
        <div class="cal-lista">${inteiros.map((e,i)=>`<div class="cal-cascata" style="--i:${i}">${calCardEvento(e,'card')}</div>`).join('')}</div>
      </section>`:''}
      ${conflitos.length?`<section class="cal-bloco">
        <h2 class="cal-bloco-h">Conflitos</h2>
        <ul class="cal-avisos">${conflitos.map(([a,b],i)=>`<li class="cal-aviso cal-aviso--conflito cal-cascata" style="--i:${i}">
          ${calIco('alerta')}<span><b>${gEsc(a.titulo)}</b> e <b>${gEsc(b.titulo)}</b> se cruzam às ${gEsc(a.hora)}</span></li>`).join('')}</ul>
      </section>`:''}
      ${calBlocoLivre(d, comHora)}
      ${!doDia.length?calVazio('Dia livre','Nada marcado. É um bom dia para preparar a próxima campanha.',
        calPodeEditar()?`<button class="cal-cta" onclick="calNovoEvento('${d}')">${calIco('mais')}<span>Criar evento</span></button>`:''):''}
    </aside>

    <div class="cal-dia-tl">
      <div class="cal-tl" id="cal-tl" role="grid" aria-label="Horários de ${gEsc(calFmtDiaLongo(d))}">
        <div class="cal-tl-regua" aria-hidden="true">${calReguaHtml()}</div>
        <div class="cal-tl-cols cal-tl-cols--um">
          <div class="cal-tl-col${d===hoje?' hoje':''}" data-dia="${d}" ondblclick="calNovoNoClique(event,'${d}')">
            ${calGradeHoras()}
            ${calVaosHtml(d, comHora)}
            ${calBlocosDoDia(d)}
            ${d===hoje?calLinhaAgora():''}
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

// Vãos livres entre eventos com hora — o "espaço livre" que o brief pede.
// Só entre 08h e 20h: madrugada livre não é informação.
function calVaos(iso, comHora){
  const ini=8*60, fim=20*60;
  const ocupados=(comHora||calDoDia(iso).filter(e=>e.hora))
    .map(e=>[calMin(e.hora), calMin(e.hora)+(e.duracao||60)])
    .sort((a,b)=>a[0]-b[0]);
  const vaos=[]; let cursor=ini;
  ocupados.forEach(([a,b])=>{
    if(a>cursor) vaos.push([cursor, Math.min(a,fim)]);
    cursor=Math.max(cursor,b);
  });
  if(cursor<fim) vaos.push([cursor,fim]);
  return vaos.filter(([a,b])=>b-a>=45);
}
function calVaosHtml(iso, comHora){
  if(!(comHora||[]).length) return '';
  return calVaos(iso, comHora).map(([a,b])=>{
    const top=((a-CAL_H_INI*60)/60), alt=((b-a)/60);
    if(top<0) return '';
    return `<div class="cal-vao" style="--t:${top};--h:${alt}" aria-hidden="true">
      <span>${calHora(a)} – ${calHora(b)} livre</span></div>`;
  }).join('');
}
function calBlocoLivre(iso, comHora){
  const vaos=calVaos(iso, comHora);
  if(!comHora.length || !vaos.length) return '';
  return `<section class="cal-bloco cal-bloco--calmo">
    <h2 class="cal-bloco-h">Espaço livre</h2>
    <ul class="cal-livres">
      ${vaos.slice(0,4).map(([a,b],i)=>`<li class="cal-cascata" style="--i:${i}">
        <b>${calHora(a)} – ${calHora(b)}</b><span>${Math.round((b-a)/60*10)/10}h livres</span>
        ${calPodeEditar()?`<button class="cal-link" onclick="calNovoEvento('${iso}','${calHora(a)}')">usar</button>`:''}
      </li>`).join('')}
    </ul>
  </section>`;
}

/* ══════════════════════════════════════════════════════════════
   RÉGUA E BLOCOS
══════════════════════════════════════════════════════════════ */
function calReguaHtml(){
  let h='';
  for(let i=CAL_H_INI;i<CAL_H_FIM;i++) h+=`<span class="cal-regua-h"><i>${String(i).padStart(2,'0')}:00</i></span>`;
  return h;
}
function calGradeHoras(){
  let h='';
  for(let i=CAL_H_INI;i<CAL_H_FIM;i++) h+=`<span class="cal-linha-h"${i%2?' data-meia="1"':''}></span>`;
  return h;
}

// Eventos com hora, posicionados por proporção. Conflito vira lado a lado:
// o grupo que se sobrepõe divide a largura, como agenda de verdade.
function calBlocosDoDia(iso){
  const lista=calDoDia(iso).filter(e=>e.hora && calMin(e.hora)!=null)
    .sort((a,b)=>calMin(a.hora)-calMin(b.hora));
  if(!lista.length) return '';
  // Agrupa em "clusters" que se tocam; dentro do cluster cada um pega 1/n.
  const grupos=[]; let atual=[], fimAtual=-1;
  lista.forEach(e=>{
    const a=calMin(e.hora), b=a+(e.duracao||60);
    if(atual.length && a<fimAtual){ atual.push(e); fimAtual=Math.max(fimAtual,b); }
    else { if(atual.length) grupos.push(atual); atual=[e]; fimAtual=b; }
  });
  if(atual.length) grupos.push(atual);

  return grupos.map(g=>g.map((e,i)=>{
    const a=calMin(e.hora), dur=e.duracao||60;
    const top=(a-CAL_H_INI*60)/60, alt=Math.max(dur/60, .5);
    if(top+alt<0) return '';
    // Bloco curto (até 45min) não tem altura para duas linhas: título e hora
    // passam a dividir a MESMA linha. Sem isso o título era cortado e sobrava
    // só "11:00–11:30" — a hora sem o que acontece nela.
    const cls=['cal-bloco-ev',`cal-t-${e.tipo}`, e.concluido?'concluido':'',
               dur<=45?'curto':'', g.length>1?'conflito':'', calState.aberto===e.id?'sel':''].filter(Boolean).join(' ');
    return `<article class="${cls}" style="--t:${top};--h:${alt};--n:${g.length};--i:${i}"
        data-id="${gEsc(e.id)}" tabindex="0" role="button"
        ${calPodeEditar()&&e.origem!=='oficial'?'draggable="true"':''}
        aria-label="${gEsc(e.titulo)}, ${gEsc(e.hora)}"
        onclick="calAbrirDetalhe('${gEsc(e.id)}',event)"
        onkeydown="calTeclaEvento(event,'${gEsc(e.id)}')"
        onmouseenter="calPreviewEntra(this,'${gEsc(e.id)}')" onmouseleave="calPreviewSai()">
      <span class="cal-ev-rail" aria-hidden="true"></span>
      <b class="cal-bloco-t">${gEsc(e.titulo)}</b>
      <span class="cal-bloco-h2">${gEsc(e.hora)}–${calHora(a+dur)}</span>
      ${e.escopo && e.escopo!=='Nacional'?`<span class="cal-ev-escopo">${gEsc(e.escopo)}</span>`:''}
    </article>`;
  }).join('')).join('');
}

// A linha do agora. Some fora do intervalo da régua em vez de encostar na borda.
function calLinhaAgora(){
  const agora=new Date(), min=agora.getHours()*60+agora.getMinutes();
  if(min < CAL_H_INI*60 || min > CAL_H_FIM*60) return '';
  const top=(min-CAL_H_INI*60)/60;
  return `<div class="cal-agora" style="--t:${top}" aria-label="Agora são ${calHora(min)}">
    <span class="cal-agora-pt"></span><span class="cal-agora-l"></span>
    <span class="cal-agora-h">${calHora(min)}</span></div>`;
}

/* ══════════════════════════════════════════════════════════════
   MONTAGEM DA AGENDA
   Faz o scroll cair na hora útil (ou no agora), religa o arrasto e mantém a
   linha do agora viva sem re-renderizar a vista inteira a cada minuto.
══════════════════════════════════════════════════════════════ */
let _calRelogio=null;
function calAgendaMontada(){
  calPillSeg();
  const tl=document.getElementById('cal-tl');
  if(tl){
    const agora=new Date(), min=agora.getHours()*60+agora.getMinutes();
    const alvoMin = (calState.ancora===calHoje() && min>CAL_H_INI*60) ? min-90 : 8*60;
    const y=Math.max(0, ((alvoMin-CAL_H_INI*60)/60)*calAlturaHora());
    // Sem animação no primeiro paint: rolar suave a partir do topo dá a
    // sensação de que a tela "escapou" antes de assentar.
    tl.scrollTop=y;
  }
  calLigaArrastoHora();
  clearInterval(_calRelogio);
  _calRelogio=setInterval(calAtualizaAgora, 60000);
  calAtualizaAgora();
}
function calAtualizaAgora(){
  const l=document.querySelector('.cal-agora');
  if(!l){ return; }
  const agora=new Date(), min=agora.getHours()*60+agora.getMinutes();
  if(min<CAL_H_INI*60||min>CAL_H_FIM*60){ l.remove(); return; }
  l.style.setProperty('--t', (min-CAL_H_INI*60)/60);
  const h=l.querySelector('.cal-agora-h'); if(h) h.textContent=calHora(min);
}

// Arrastar na régua: solta em outra coluna/hora e o evento assume o slot de
// 15 em 15 minutos (snap). Só equipe, nunca em evento oficial.
function calLigaArrastoHora(){
  if(!calPodeEditar()) return;
  let alvo=null;
  document.querySelectorAll('.cal-bloco-ev[draggable="true"]').forEach(n=>{
    n.addEventListener('dragstart', e=>{
      alvo=n.dataset.id; n.classList.add('arrastando');
      document.body.classList.add('cal-arrastando');
      try{ e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain', alvo); }catch(_){}
    });
    n.addEventListener('dragend', ()=>{ n.classList.remove('arrastando'); document.body.classList.remove('cal-arrastando'); alvo=null; });
  });
  document.querySelectorAll('.cal-tl-col').forEach(col=>{
    col.addEventListener('dragover', e=>{ if(!alvo) return; e.preventDefault(); col.classList.add('cal-alvo'); });
    col.addEventListener('dragleave', ()=>col.classList.remove('cal-alvo'));
    col.addEventListener('drop', e=>{
      e.preventDefault(); col.classList.remove('cal-alvo');
      if(!alvo) return;
      const ev=calById(alvo); if(!ev) return;
      if(ev.origem==='oficial'){ gToast('Horário oficial da rede não muda por arrasto.','error'); return; }
      const r=col.getBoundingClientRect();
      const min=Math.round(((e.clientY-r.top)/calAlturaHora()*60 + CAL_H_INI*60)/15)*15;
      ev.hora=calHora(Math.max(CAL_H_INI*60, Math.min(CAL_H_FIM*60-30, min)));
      const dias=calDiff(ev.inicio, col.dataset.dia);
      if(dias){ ev.inicio=calAddDias(ev.inicio,dias); ev.fim=calAddDias(ev.fim,dias); }
      calSalvarEvento(ev);
      gToast(`"${ev.titulo}" às ${ev.hora}.`,'success');
      calRender();
      requestAnimationFrame(()=>{
        const el=document.querySelector(`.cal-bloco-ev[data-id="${CSS.escape(ev.id)}"]`);
        if(el) el.classList.add('cal-pousou');
      });
    });
  });
}

// Duplo clique numa faixa vazia da régua cria o evento já naquela hora.
function calNovoNoClique(e, iso){
  if(!calPodeEditar()) return;
  // getBoundingClientRect já vem descontado do scroll: somar scrollTop aqui
  // jogaria o evento horas adiante assim que a régua estivesse rolada.
  const col=e.currentTarget, r=col.getBoundingClientRect();
  const min=Math.round(((e.clientY-r.top)/calAlturaHora()*60 + CAL_H_INI*60)/15)*15;
  calNovoEvento(iso, calHora(Math.max(CAL_H_INI*60, Math.min(CAL_H_FIM*60-30, min))));
}
