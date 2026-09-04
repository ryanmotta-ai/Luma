/**
 * js/calendario/calendario.js
 *
 * CALENDÁRIO — o módulo que responde "o que a rede comunica e quando".
 * Aqui moram: estado, camada de dados (seed local + ponto de troca para o
 * backend), helpers de data, roteamento das quatro vistas, a VISÃO GERAL
 * (dashboard) e a VISÃO MENSAL. A semana/dia vivem em agenda.js e o editor
 * de evento em evento.js.
 *
 * Prefixo `cal*` — f, d, g, ac e tut seguem intocados. Estado em `let` global
 * + re-render manual, como o resto da casa. Sem import/export, sem build.
 *
 * ⚠ FONTE DO DADO (decisão #1 do 07_ROADMAP, ainda aberta): hoje o calendário
 * nasce de `js/calendario/conteudo.js` — o conteúdo REAL do calendário que a
 * operação publica, portado por script em 03/09 (agosto e setembro de 2026).
 * `calFetch()` é o ÚNICO ponto de troca: quando a fonte virar planilha, tabela
 * ou Yungas, só ela muda — nenhuma vista sabe de onde o evento veio.
 * O rodapé mostra a fonte, a data do porte e QUAIS MESES existem, porque o
 * roadmap exige estado honesto: mês que a operação não publicou aparece vazio,
 * com o motivo escrito — não com uma recorrente projetada para parecer cheio.
 *
 * ⚠ QUEM EDITA: só a equipe DM (`gIsAdmin`). O franqueado lê, filtra e clica
 * para cair nas artes da campanha — é a fronteira que o 07_ROADMAP §4 define.
 *
 * Depende de: 00-config.js (CAMPS_ATIVAS/CAMPS_OUTRAS), core/toast.js (gToast,
 * gEsc, gConfirm), core/auth.js (gIsAdmin), core/supabase.js (gTrackEvent).
 */

/* ══════════════════════════════════════════════════════════════
   ESTADO
   Um objeto só (padrão fState/acState). `ancora` é a data de referência da
   vista corrente; `selecionado` é o dia que o usuário escolheu. Os dois são
   ISO 'YYYY-MM-DD' — nunca Date solto no estado, que Date carrega fuso e a
   comparação passa a depender da hora do clique.
══════════════════════════════════════════════════════════════ */
let calState = {
  vista: 'dash',        // dash | mes | semana | dia
  ancora: null,         // ISO — mês/semana/dia em foco
  selecionado: null,    // ISO — dia selecionado
  eventos: [],          // eventos materializados (oficiais + locais)
  filtros: [],          // tipos ativos; [] = tudo
  busca: '',
  carregando: false,
  erro: '',
  fonte: 'seed',        // seed | backend
  sync: 'ok',           // ok | sincronizando | offline | erro
  atualizadoEm: null,   // ISO datetime da última carga
  aberto: null,         // id do evento em foco (preview/detalhe)
  montado: false
};

const CAL_STORE = 'luma_cal_eventos_v1';   // eventos criados pela equipe
const CAL_PREFS = 'luma_cal_prefs_v1';     // vista e filtros que a pessoa deixou

/* ══════════════════════════════════════════════════════════════
   TIPOS DE EVENTO
   O acento de cada tipo é um TOKEN do projeto (00-tokens.css) — nenhum hex
   nasce aqui. `--cal-t-*` está declarado no modules/calendario.css; este
   objeto só diz qual é o nome, o rótulo e o peso na hierarquia.
   `peso` ordena a lista do dia: menor primeiro (mãe manda, recorrente é chão).
══════════════════════════════════════════════════════════════ */
const CAL_TIPOS = {
  mae:        { label:'Campanha-mãe',   curto:'Mãe',        peso:1, desc:'Carrega o mês. Cadastro novo, atenção máxima.' },
  crm:        { label:'Disparo de CRM', curto:'CRM',        peso:2, desc:'Push/inapp que a central dispara na data.' },
  especial:   { label:'Data especial',  curto:'Especial',   peso:3, desc:'Data do calendário que puxa demanda.' },
  social:     { label:'Conteúdo redes', curto:'Redes',      peso:4, desc:'Post de conteúdo, sem oferta cadastrada.' },
  recorrente: { label:'Recorrente',     curto:'Recorrente', peso:5, desc:'Roda o mês inteiro, estável.' }
};
const CAL_TIPOS_ORDEM = ['mae','crm','especial','social','recorrente'];

/* ══════════════════════════════════════════════════════════════
   ÍCONES (SVG inline, currentColor — nunca emoji: 04_DESIGN_SYSTEM §10)
══════════════════════════════════════════════════════════════ */
const CAL_ICO = {
  cal:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  ant:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>',
  prox:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>',
  mais:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  relog:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>',
  check:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
  alerta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 4.3 2.6 17.4A1.9 1.9 0 0 0 4.3 20.3h15.4a1.9 1.9 0 0 0 1.7-2.9L13.7 4.3a1.9 1.9 0 0 0-3.4 0Z"/><path d="M12 9.5v4"/><path d="M12 17h.01"/></svg>',
  play:   '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
  seta:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13"/><path d="m12 6 6 6-6 6"/></svg>',
  x:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  filtro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h18l-7 8v6l-4 2v-8Z"/></svg>',
  raio:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6Z"/></svg>',
  arte:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="m5 17 4.5-5 3.5 4 2.5-2.5L21 17"/><circle cx="9" cy="9" r="1.6"/></svg>',
  sync:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 0 1-15.2 6.5L3 16"/><path d="M3 12a9 9 0 0 1 15.2-6.5L21 8"/><path d="M3 21v-5h5M21 3v5h-5"/></svg>',
  off:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 2l20 20"/><path d="M8.5 16.4a5 5 0 0 1 7 0"/><path d="M5 13a10 10 0 0 1 3.2-2.1M19 13a10 10 0 0 0-6.6-2.9"/><path d="M2 8.8A15 15 0 0 1 7 6M22 8.8a15 15 0 0 0-8.7-2.7"/><path d="M12 20h.01"/></svg>',
  lupa:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  vazio:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M9 15.5h6"/></svg>',
  local:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>',
  lapis:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14.5 4.5 5 5L8 21H3v-5z"/><path d="m12 7 5 5"/></svg>'
};
function calIco(nome, cls){ return `<span class="cal-i${cls?' '+cls:''}" aria-hidden="true">${CAL_ICO[nome]||''}</span>`; }

/* ══════════════════════════════════════════════════════════════
   DATA — helpers
   Regra: ISO 'YYYY-MM-DD' é a moeda do módulo. Toda conversão para Date
   ancora ao MEIO-DIA local. Sem isso, `new Date('2026-09-07')` cai à
   meia-noite UTC e no Brasil vira dia 6 — o bug clássico de calendário.
══════════════════════════════════════════════════════════════ */
const CAL_MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const CAL_MESES_C = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const CAL_DIAS = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
const CAL_DIAS_C = ['dom','seg','ter','qua','qui','sex','sáb'];
// A semana começa na SEGUNDA (é como a operação lê o mês, e é o que a
// planilha oficial já usa). Índice 0 = segunda.
const CAL_HEAD = ['seg','ter','qua','qui','sex','sáb','dom'];

function calData(iso){ const p=String(iso||'').split('-'); return new Date(+p[0], (+p[1]||1)-1, +p[2]||1, 12, 0, 0, 0); }
function calISO(d){
  const m=String(d.getMonth()+1).padStart(2,'0'), dia=String(d.getDate()).padStart(2,'0');
  return `${d.getFullYear()}-${m}-${dia}`;
}
function calHoje(){ return calISO(new Date()); }
function calAddDias(iso, n){ const d=calData(iso); d.setDate(d.getDate()+n); return calISO(d); }
function calAddMeses(iso, n){
  const d=calData(iso), dia=d.getDate();
  d.setDate(1); d.setMonth(d.getMonth()+n);
  d.setDate(Math.min(dia, calDiasNoMes(d.getFullYear(), d.getMonth())));
  return calISO(d);
}
function calDiasNoMes(ano, mes){ return new Date(ano, mes+1, 0).getDate(); }
function calDiff(a, b){ return Math.round((calData(b)-calData(a))/86400000); }
// Índice 0=segunda … 6=domingo.
function calDiaSemana(iso){ return (calData(iso).getDay()+6)%7; }
function calSegundaDe(iso){ return calAddDias(iso, -calDiaSemana(iso)); }
function calMesmoMes(a, b){ return String(a).slice(0,7)===String(b).slice(0,7); }
function calFimDeSemana(iso){ const w=calDiaSemana(iso); return w===5||w===6; }

// A grade do mês: sempre 6 semanas × 7 dias, começando na segunda. Altura fixa
// impede o "pulo" de 5↔6 linhas ao trocar de mês — o conteúdo desliza, a moldura fica.
function calGradeMes(iso){
  const d=calData(iso); d.setDate(1);
  let cur=calSegundaDe(calISO(d));
  const out=[];
  for(let s=0;s<6;s++){ const semana=[]; for(let i=0;i<7;i++){ semana.push(cur); cur=calAddDias(cur,1); } out.push(semana); }
  return out;
}
function calSemanaDe(iso){ const seg=calSegundaDe(iso); return Array.from({length:7},(_,i)=>calAddDias(seg,i)); }

function calFmtMesPub(ym){ const d=calData(ym+'-01'); return `${CAL_MESES_C[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`; }
function calFmtMesAno(iso){ const d=calData(iso); return `${CAL_MESES[d.getMonth()]} de ${d.getFullYear()}`; }
function calFmtDiaLongo(iso){ const d=calData(iso); return `${CAL_DIAS[d.getDay()]}, ${d.getDate()} de ${CAL_MESES[d.getMonth()]}`; }
function calFmtDiaCurto(iso){ const d=calData(iso); return `${d.getDate()} ${CAL_MESES_C[d.getMonth()]}`; }
function calFmtIntervalo(ev){
  if(ev.inicio===ev.fim) return calFmtDiaCurto(ev.inicio);
  const a=calData(ev.inicio), b=calData(ev.fim);
  if(a.getMonth()===b.getMonth()) return `${a.getDate()} – ${b.getDate()} ${CAL_MESES_C[b.getMonth()]}`;
  return `${calFmtDiaCurto(ev.inicio)} – ${calFmtDiaCurto(ev.fim)}`;
}
// "hoje" / "amanhã" / "em 5 dias" / "há 3 dias". O relativo é o que o
// franqueado realmente lê: a data absoluta fica de apoio.
function calFmtRelativo(iso, base){
  const n=calDiff(base||calHoje(), iso);
  if(n===0) return 'hoje';
  if(n===1) return 'amanhã';
  if(n===-1) return 'ontem';
  if(n>1)  return n<7 ? `em ${n} dias` : (n<14 ? 'na semana que vem' : `em ${n} dias`);
  return `há ${-n} dias`;
}
function calFmtDataHora(dt){
  if(!dt) return '';
  const d=new Date(dt); if(isNaN(d)) return '';
  const hh=String(d.getHours()).padStart(2,'0'), mm=String(d.getMinutes()).padStart(2,'0');
  return `${d.getDate()} ${CAL_MESES_C[d.getMonth()]}, ${hh}:${mm}`;
}
// 'HH:MM' → minutos. Aceita '14', '14h', '14h30', '14:30'.
function calMin(hora){
  if(!hora) return null;
  const m=String(hora).match(/^(\d{1,2})\s*[:hH]?\s*(\d{2})?/);
  if(!m) return null;
  const h=Math.min(23, +m[1]), mi=Math.min(59, +(m[2]||0));
  return h*60+mi;
}
function calHora(min){
  if(min==null) return '';
  const h=Math.floor(min/60), m=min%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

/* ══════════════════════════════════════════════════════════════
   CAMADA DE DADOS
   calFetch() é o ÚNICO ponto de troca da fonte. Trocar para Supabase/CSV é
   reescrever esta função — nenhuma vista lê localStorage nem seed direto.
══════════════════════════════════════════════════════════════ */

// Eventos criados/editados pela equipe nesta máquina (até a fonte oficial existir).
function calLocais(){
  try{ const j=localStorage.getItem(CAL_STORE); const a=j?JSON.parse(j):[]; return Array.isArray(a)?a:[]; }
  catch(e){ return []; }
}
function calSalvaLocais(lista){
  try{ localStorage.setItem(CAL_STORE, JSON.stringify(lista)); return true; }
  catch(e){ gToast('Não consegui salvar: o armazenamento do navegador está cheio.','error'); return false; }
}

/**
 * PONTO DE TROCA DA FONTE. Hoje: seed + eventos locais da equipe.
 * Amanhã (decisão #1 do roadmap): `await sb.from('calendario').select(...)`,
 * ou o parse do CSV publicado pela operação. A assinatura não muda:
 * devolve { eventos, fonte, atualizadoEm } e o resto do módulo segue igual.
 */
async function calFetch(){
  const oficiais = [];
  const c = (typeof CAL_CONTEUDO!=='undefined') ? CAL_CONTEUDO : {};
  Object.keys(c).forEach(mes=>{
    (c[mes].eventos||[]).forEach(e=>oficiais.push({ ...e, origem:'oficial' }));
  });
  const locais = calLocais().map(e=>({ ...e, origem:'local' }));
  return { eventos:[...oficiais, ...locais], fonte:'portado', atualizadoEm:new Date().toISOString() };
}
// Os meses que a fonte oficial publicou. Fora deles o calendário NÃO inventa
// recorrente projetada: mês sem publicação é mês sem publicação, e a tela diz
// isso em vez de desenhar um mês plausível.
function calMesesPublicados(){
  return Object.keys((typeof CAL_CONTEUDO!=='undefined') ? CAL_CONTEUDO : {}).sort();
}
function calMesPublicado(iso){ return calMesesPublicados().indexOf(String(iso).slice(0,7))>=0; }

async function calCarregar(){
  calState.carregando = true; calState.erro=''; calState.sync='sincronizando';
  calRender();
  try{
    if(typeof navigator!=='undefined' && navigator.onLine===false){
      calState.sync='offline';
    }
    const r = await calFetch();
    calState.eventos = calNormaliza(r.eventos);
    calState.fonte = r.fonte;
    calState.atualizadoEm = r.atualizadoEm;
    calState.sync = (typeof navigator!=='undefined' && navigator.onLine===false) ? 'offline' : 'ok';
  }catch(e){
    calState.erro = 'Não consegui carregar o calendário.';
    calState.sync = 'erro';
  }
  calState.carregando=false;
  calRender();
}

// Toda entrada passa por aqui: campo faltando não pode virar `undefined` no
// meio de uma vista. Também é onde `fim` ganha o default de `inicio`.
function calNormaliza(lista){
  return (lista||[]).filter(e=>e && e.inicio).map(e=>({
    id: String(e.id || ('e'+Math.random().toString(36).slice(2,10))),
    titulo: String(e.titulo||'Sem título'),
    tipo: CAL_TIPOS[e.tipo] ? e.tipo : 'especial',
    inicio: e.inicio,
    fim: e.fim && e.fim>=e.inicio ? e.fim : e.inicio,
    hora: e.hora || null,
    duracao: e.duracao ? +e.duracao : (e.hora ? 60 : null),
    camp: e.camp || null,
    banner: e.banner || null,
    escopo: e.escopo || 'Nacional',
    regra: e.regra || '',
    nota: e.nota || '',
    concluido: !!e.concluido,
    origem: e.origem || 'local',
    // Conteúdo rico da fonte oficial (js/calendario/conteudo.js). Opcional:
    // evento criado pela equipe nasce sem nada disto e a folha se adapta.
    bucket: e.bucket || '',
    resumo: e.resumo || '',
    cadastro: e.cadastro || '',
    ativo: e.ativo || '',
    cadastrar: Array.isArray(e.cadastrar) ? e.cadastrar : [],
    exemplos: Array.isArray(e.exemplos) ? e.exemplos : [],
    regras: Array.isArray(e.regras) ? e.regras : [],
    dica: e.dica || '',
    disparos: Array.isArray(e.disparos) ? e.disparos : [],
    incentivo: e.incentivo || '',
    alerta: e.alerta || null
  })).sort(calCompara);
}

// Ordem canônica da lista de um dia: quem tem hora primeiro (na ordem do
// relógio), depois os do dia inteiro por peso do tipo. É a hierarquia que o
// brief pede — hoje, o que vem depois, o importante, o comum.
// Ordem da GRADE do mês, onde só cabem 2 chips: manda o PESO DO TIPO, não a
// hora. Medido na tela: em 15/09 os dois pushes de CRM (que têm hora) empurravam
// "Dia do Cliente · 30% OFF + LIVE" — a campanha-mãe do dia — para dentro do
// "+2 eventos". Numa célula que corta, o que sobra tem que ser o que importa.
function calComparaGrade(a,b){
  const pa=(CAL_TIPOS[a.tipo]||{}).peso||9, pb=(CAL_TIPOS[b.tipo]||{}).peso||9;
  if(pa!==pb) return pa-pb;
  return calCompara(a,b);
}
function calCompara(a,b){
  const ha=calMin(a.hora), hb=calMin(b.hora);
  if(ha!=null && hb!=null && ha!==hb) return ha-hb;
  if(ha!=null && hb==null) return -1;
  if(ha==null && hb!=null) return 1;
  const pa=(CAL_TIPOS[a.tipo]||{}).peso||9, pb=(CAL_TIPOS[b.tipo]||{}).peso||9;
  if(pa!==pb) return pa-pb;
  if(a.inicio!==b.inicio) return a.inicio<b.inicio?-1:1;
  return String(a.titulo).localeCompare(String(b.titulo),'pt-BR');
}

/* ── CONSULTAS ─────────────────────────────────────────────── */
function calFiltrado(){
  const f=calState.filtros, q=calState.busca.trim().toLowerCase();
  return calState.eventos.filter(e=>{
    if(f.length && f.indexOf(e.tipo)<0) return false;
    if(q && (e.titulo+' '+e.regra+' '+e.nota+' '+e.escopo).toLowerCase().indexOf(q)<0) return false;
    return true;
  });
}
function calCobre(ev, iso){ return ev.inicio<=iso && ev.fim>=iso; }
function calDoDia(iso, lista){ return (lista||calFiltrado()).filter(e=>calCobre(e,iso)).sort(calCompara); }
function calNoIntervalo(a, b, lista){ return (lista||calFiltrado()).filter(e=>e.fim>=a && e.inicio<=b); }
function calById(id){ return calState.eventos.find(e=>e.id===id) || null; }
function calMultiDia(ev){ return ev.inicio!==ev.fim; }
function calAtivoHoje(ev){ return calCobre(ev, calHoje()); }

// Campanha ligada ao evento → o clique cai nas artes que já existem.
function calCamp(ev){
  if(!ev || !ev.camp) return null;
  const todas=[].concat(typeof CAMPS_ATIVAS!=='undefined'?CAMPS_ATIVAS:[], typeof CAMPS_OUTRAS!=='undefined'?CAMPS_OUTRAS:[]);
  return todas.find(c=>c.id===ev.camp) || null;
}
// O GATE ÚNICO de edição do módulo. Role E flag, nesta ordem — igual ao
// `gModeAllowed` do main.js. Como CTA, "+" do dia, arrastar, concluir e apagar
// todos passam por aqui, a chave do Controle do produto alcança os cinco de uma
// vez; não existe caminho de edição que escape deste `if`.
function calPodeEditar(){
  if(typeof gIsAdmin!=='function' || !gIsAdmin()) return false;
  if(typeof gFeatureCan!=='function') return true;   // sem o motor, nada muda
  return gFeatureCan('calendario.edicao','create');
}
// Atalhos de leitura das outras três chaves. Sem o motor carregado tudo passa:
// flag indisponível nunca pode derrubar o módulo (feature-flags.js, fail-open).
function calFlag(chave, acao){
  return typeof gFeatureCan!=='function' || gFeatureCan(chave, acao||'access');
}
function calTemAgenda(){ return calFlag('calendario.agenda'); }
function calTemArtes(){  return calFlag('calendario.artes'); }
function calTemApres(){  return calFlag('calendario.apresentacao'); }

// A ARTE que identifica o evento. Vem do próprio evento (`banner`) ou, o caso
// comum, da campanha ligada (`banner` em CAMPS_*, js/00-config.js). O nome da
// campanha já está DENTRO da imagem — por isso quem exibe o banner não repete
// esse nome ao lado; repete a data e a regra, que a arte não carrega.
// Devolve null quando não há arte: aí a peça cai no tratamento tipográfico.
function calBanner(ev){
  if(!ev) return null;
  if(ev.banner) return ev.banner;
  const c=calCamp(ev);
  return (c && c.banner) || null;
}
// Um <img> de banner, com a queda embutida: arquivo que falta some sozinho e
// a peça continua legível. Sem isto, banner ausente deixaria um bloco cinza —
// e os arquivos entram aos poucos, campanha por campanha.
function calBannerImg(ev, cls){
  const src=calBanner(ev);
  if(!src) return '';
  return `<img class="cal-banner${cls?' '+cls:''}" src="${gEsc(src)}" alt="" loading="lazy" decoding="async"
    onerror="this.closest('[data-banner]')?.removeAttribute('data-banner');this.remove()">`;
}

/* ══════════════════════════════════════════════════════════════
   CRUD (só equipe DM — `calPodeEditar`)
══════════════════════════════════════════════════════════════ */
function calSalvarEvento(ev){
  if(!calPodeEditar()){ gToast('Só a equipe Delivery Much edita o calendário.','error'); return null; }
  const locais=calLocais();
  const i=locais.findIndex(x=>x.id===ev.id);
  const limpo={ id:ev.id||('e'+Date.now().toString(36)), titulo:ev.titulo, tipo:ev.tipo, inicio:ev.inicio,
                fim:ev.fim||ev.inicio, hora:ev.hora||null, duracao:ev.duracao||null, camp:ev.camp||null,
                banner:ev.banner||null, escopo:ev.escopo||'Nacional', regra:ev.regra||'',
                nota:ev.nota||'', concluido:!!ev.concluido };
  if(i>=0) locais[i]=limpo; else locais.push(limpo);
  if(!calSalvaLocais(locais)) return null;
  const j=calState.eventos.findIndex(x=>x.id===limpo.id);
  const norm=calNormaliza([{...limpo, origem:'local'}])[0];
  if(j>=0) calState.eventos[j]=norm; else calState.eventos.push(norm);
  calState.eventos.sort(calCompara);
  if(typeof gTrackEvent==='function') gTrackEvent('calendario_evento_salvo',{tipo:limpo.tipo});
  return norm;
}
async function calApagarEvento(id){
  const ev=calById(id); if(!ev) return false;
  if(ev.origem==='oficial'){ gToast('Evento oficial da rede não se apaga por aqui.','error'); return false; }
  const ok = typeof gConfirm==='function'
    ? await gConfirm(`Apagar "${ev.titulo}"?`, {title:'Apagar evento', okLabel:'Apagar', danger:true})
    : true;
  if(!ok) return false;
  calSalvaLocais(calLocais().filter(e=>e.id!==id));
  calState.eventos = calState.eventos.filter(e=>e.id!==id);
  if(calState.aberto===id) calState.aberto=null;
  gToast('Evento apagado.','success');
  calRender();
  return true;
}
function calAlternaConcluido(id){
  const ev=calById(id); if(!ev) return;
  if(!calPodeEditar()){ gToast('Só a equipe Delivery Much edita o calendário.','error'); return; }
  ev.concluido=!ev.concluido;
  if(ev.origem==='local') calSalvarEvento(ev);
  gToast(ev.concluido?'Marcado como concluído.':'Reaberto.','success');
  calRender();
}
// Mover (usado pelo arrastar). `dias` é o deslocamento; o evento inteiro anda junto.
function calMover(id, dias){
  const ev=calById(id); if(!ev || !dias) return false;
  if(!calPodeEditar()){ gToast('Só a equipe Delivery Much edita o calendário.','error'); return false; }
  if(ev.origem==='oficial'){ gToast('Data oficial da rede não muda por arrasto.','error'); return false; }
  ev.inicio=calAddDias(ev.inicio,dias); ev.fim=calAddDias(ev.fim,dias);
  calSalvarEvento(ev);
  return true;
}

/* ══════════════════════════════════════════════════════════════
   PREFERÊNCIAS (vista e filtros sobrevivem ao F5)
══════════════════════════════════════════════════════════════ */
function calLePrefs(){
  try{
    const p=JSON.parse(localStorage.getItem(CAL_PREFS)||'{}');
    if(p.vista && ['dash','mes','semana','dia'].indexOf(p.vista)>=0) calState.vista=p.vista;
    if((calState.vista==='semana'||calState.vista==='dia') && !calTemAgenda()) calState.vista='mes';
    if(Array.isArray(p.filtros)) calState.filtros=p.filtros.filter(t=>CAL_TIPOS[t]);
  }catch(e){}
}
function calGravaPrefs(){
  try{ localStorage.setItem(CAL_PREFS, JSON.stringify({vista:calState.vista, filtros:calState.filtros})); }catch(e){}
}

/* ══════════════════════════════════════════════════════════════
   NAVEGAÇÃO
══════════════════════════════════════════════════════════════ */
function calVista(v, botao){
  // Vale para TODO caminho de entrada — clique, atalho de teclado, preferência
  // restaurada do F5 e chamada pelo console. Mesmo raciocínio do setMode.
  if((v==='semana'||v==='dia') && !calTemAgenda()) v='mes';
  if(calState.vista===v) return;
  calState.vista=v; calGravaPrefs();
  calRender({direcao:0});
  if(botao) botao.blur();
  if(typeof gTrackEvent==='function') gTrackEvent('calendario_vista',{vista:v});
}
function calNavega(passo){
  const v=calState.vista;
  if(v==='mes')        calState.ancora=calAddMeses(calState.ancora, passo);
  else if(v==='semana')calState.ancora=calAddDias(calState.ancora, 7*passo);
  else                 calState.ancora=calAddDias(calState.ancora, passo);
  if(v!=='mes') calState.selecionado=calState.ancora;
  calRender({direcao:passo});
}
function calHojeIr(){
  const antes=calState.ancora;
  calState.ancora=calHoje(); calState.selecionado=calHoje();
  calRender({direcao: antes>calHoje()? -1 : (antes<calHoje()? 1 : 0)});
}
function calSelecionar(iso, opts){
  opts=opts||{};
  calState.selecionado=iso;
  if(!calMesmoMes(iso, calState.ancora) || calState.vista!=='mes') calState.ancora=iso;
  // Sem a agenda, "abrir o dia" seleciona o dia e fica no mês: trocar para uma
  // vista desligada devolveria o palco vazio.
  if(opts.abrirDia && calTemAgenda()){ calState.vista='dia'; calGravaPrefs(); }
  calRender();
}
function calFiltro(tipo){
  const i=calState.filtros.indexOf(tipo);
  if(i>=0) calState.filtros.splice(i,1); else calState.filtros.push(tipo);
  calGravaPrefs(); calRender();
}
function calLimpaFiltros(){ calState.filtros=[]; calState.busca=''; calGravaPrefs(); calRender(); }

// O clique no evento leva às artes: é a promessa do módulo. Sem campanha
// ligada, abrimos o detalhe em vez de fingir que há material.
function calAbrirArtes(id){
  const ev=calById(id); if(!ev) return;
  if(!calTemArtes()){
    if(typeof gFeatureBlockedFeedback==='function') gFeatureBlockedFeedback('calendario.artes');
    return;
  }
  const camp=calCamp(ev);
  if(!camp){ gToast('Este evento ainda não tem campanha ligada.','info'); return; }
  if(typeof setMode==='function') setMode('franqueado');
  if(typeof fSelectCamp==='function') fSelectCamp(camp.id);
  if(typeof gTrackEvent==='function') gTrackEvent('calendario_abriu_artes',{camp:camp.id});
}

/* ══════════════════════════════════════════════════════════════
   RENDER — o roteador
   Uma função pinta a moldura (topo, filtros, rodapé) e delega o palco para
   a vista. `direcao` (-1/0/1) manda o palco entrar deslizando do lado certo.
══════════════════════════════════════════════════════════════ */
function calRender(opts){
  opts=opts||{};
  const root=document.getElementById('cal-root');
  if(!root) return;
  if(!calState.ancora) calState.ancora=calHoje();
  if(!calState.selecionado) calState.selecionado=calHoje();

  root.innerHTML = calTopo() + calBarraFiltros()
    + `<div class="cal-palco" id="cal-palco"></div>`
    + calRodape();

  const palco=document.getElementById('cal-palco');
  if(calState.carregando && !calState.eventos.length){ palco.innerHTML=calEsqueleto(); return; }
  if(calState.erro){ palco.innerHTML=calErro(); return; }

  const v=calState.vista;
  palco.innerHTML = v==='dash' ? calVistaDash()
                  : v==='mes'  ? calVistaMes()
                  : v==='semana' ? calVistaSemana()
                  : calVistaDia();

  // Entrada do palco. Direção do deslize = direção da navegação; 0 = fade.
  const d=opts.direcao||0;
  palco.classList.add(d>0?'cal-entra-dir':(d<0?'cal-entra-esq':'cal-entra'));
  requestAnimationFrame(()=>palco.classList.add('cal-em'));

  if(v==='semana'||v==='dia') calAgendaMontada();
  if(v==='mes') calMesMontada();
  calFocoTeclado();
}

/* ── TOPO ─────────────────────────────────────────────────── */
function calTituloVista(){
  const v=calState.vista, a=calState.ancora;
  if(v==='dash') return 'Visão geral';
  if(v==='mes')  return calFmtMesAno(a);
  if(v==='semana'){
    const s=calSemanaDe(a);
    return `${calFmtDiaCurto(s[0])} – ${calFmtDiaCurto(s[6])}`;
  }
  return calFmtDiaLongo(a);
}
function calTopo(){
  const v=calState.vista;
  const abas=[['dash','Visão geral'],['mes','Mês']]
    .concat(calTemAgenda()?[['semana','Semana'],['dia','Dia']]:[]);
  const podeNavegar = v!=='dash';
  return `<header class="cal-topo">
    <div class="cal-topo-a">
      <h1 class="cal-h1" aria-live="polite">${gEsc(calTituloVista())}</h1>
      <div class="cal-nav" ${podeNavegar?'':'hidden'}>
        <button class="cal-nav-b" onclick="calNavega(-1)" aria-label="Anterior">${calIco('ant')}</button>
        <button class="cal-nav-hoje" onclick="calHojeIr()">Hoje</button>
        <button class="cal-nav-b" onclick="calNavega(1)" aria-label="Próximo">${calIco('prox')}</button>
      </div>
    </div>
    <div class="cal-seg" role="tablist" aria-label="Modo de visualização">
      <span class="cal-seg-pill" id="cal-seg-pill"></span>
      ${abas.map(([k,l])=>`<button class="cal-seg-b${v===k?' ativo':''}" role="tab" aria-selected="${v===k}"
        data-vista="${k}" onclick="calVista('${k}',this)">${l}</button>`).join('')}
    </div>
    <div class="cal-topo-c">
      <div class="cal-busca">
        ${calIco('lupa')}
        <input type="search" id="cal-busca" placeholder="Buscar campanha" value="${gEsc(calState.busca)}"
          oninput="calBuscaInput(this.value)" aria-label="Buscar no calendário">
      </div>
      ${calMesPublicado(calState.ancora) && calTemApres()?`<button class="cal-b-fantasma cal-b-apres" onclick="calApresAbrir()">
        ${calIco('play')}<span>Apresentação</span></button>`:''}
      ${calPodeEditar()?`<button class="cal-cta" onclick="calNovoEvento()">${calIco('mais')}<span>Novo evento</span></button>`:''}
    </div>
  </header>`;
}
let _calBuscaT=null;
function calBuscaInput(v){
  calState.busca=v;
  clearTimeout(_calBuscaT);
  _calBuscaT=setTimeout(()=>{ calRender(); const i=document.getElementById('cal-busca'); if(i){ i.focus(); i.setSelectionRange(i.value.length,i.value.length); } }, 220);
}

/* ── FILTROS ──────────────────────────────────────────────── */
function calBarraFiltros(){
  const ativos=calState.filtros;
  const conta={}; calState.eventos.forEach(e=>{ conta[e.tipo]=(conta[e.tipo]||0)+1; });
  return `<div class="cal-filtros" role="group" aria-label="Filtrar por tipo">
    <button class="cal-chip${ativos.length?'':' ativo'}" onclick="calLimpaFiltros()">Tudo</button>
    ${CAL_TIPOS_ORDEM.map(t=>`<button class="cal-chip cal-t-${t}${ativos.indexOf(t)>=0?' ativo':''}"
        onclick="calFiltro('${t}')" aria-pressed="${ativos.indexOf(t)>=0}" title="${gEsc(CAL_TIPOS[t].desc)}">
        <span class="cal-ponto"></span>${CAL_TIPOS[t].label}</button>`).join('')}
  </div>`;
}

/* ── RODAPÉ — estado honesto da fonte ─────────────────────── */
function calRodape(){
  const s=calState.sync;
  const mapa={
    ok:        [calIco('check'),  `Atualizado ${calFmtDataHora(calState.atualizadoEm)}`, 'ok'],
    sincronizando:[calIco('sync','girando'), 'Sincronizando…', 'sync'],
    offline:   [calIco('off'),    `Sem conexão · mostrando o que baixou ${calFmtDataHora(calState.atualizadoEm)}`, 'off'],
    erro:      [calIco('alerta'), 'Falha ao sincronizar · o que está na tela pode estar velho', 'erro']
  };
  const [ico,txt,cls]=mapa[s]||mapa.ok;
  const meses=calMesesPublicados();
  const fonte = calState.fonte==='portado'
    ? `Conteúdo do calendário oficial, portado em 03/09 · publicado: ${meses.map(calFmtMesPub).join(' e ')}`
    : 'Fonte oficial da operação, ao vivo';
  return `<footer class="cal-rodape cal-rodape--${cls}">
    <span class="cal-rodape-est">${ico}${gEsc(txt)}</span>
    <span class="cal-rodape-fonte">${gEsc(fonte)}</span>
  </footer>`;
}

/* ══════════════════════════════════════════════════════════════
   ESTADOS — esqueleto, erro, vazio
══════════════════════════════════════════════════════════════ */
function calEsqueleto(){
  const linha=n=>`<div class="cal-sk-linha" style="--i:${n}"></div>`;
  return `<div class="cal-sk" aria-busy="true" aria-label="Carregando o calendário">
    <div class="cal-sk-hero"></div>
    <div class="cal-sk-grade">${Array.from({length:12},(_,i)=>linha(i)).join('')}</div>
  </div>`;
}
function calErro(){
  return `<div class="cal-estado cal-estado--erro" role="alert">
    <span class="cal-estado-ico">${calIco('alerta')}</span>
    <h2>${gEsc(calState.erro)}</h2>
    <p>Pode ser a conexão. O calendário não inventa data: prefere não mostrar nada a mostrar errado.</p>
    <button class="cal-cta" onclick="calCarregar()">${calIco('sync')}<span>Tentar de novo</span></button>
  </div>`;
}
// Nunca "parecer vazio": o vazio explica e oferece a próxima ação.
function calVazio(titulo, texto, cta){
  return `<div class="cal-estado">
    <span class="cal-estado-ico">${calIco('vazio')}</span>
    <h2>${gEsc(titulo)}</h2>
    <p>${gEsc(texto)}</p>
    ${cta||''}
  </div>`;
}

/* ══════════════════════════════════════════════════════════════
   COMPONENTE — EVENT CARD
   Um componente, cinco estados (normal, hover, selecionado, concluído,
   conflito) e três densidades (chip na grade, linha na agenda, card na
   lista). Densidade é classe, não outro componente — evitar o segundo
   render de evento é a mesma regra dos motores únicos.
══════════════════════════════════════════════════════════════ */
function calCardEvento(ev, dens){
  const camp=calCamp(ev);
  const sel = calState.aberto===ev.id;
  const conf = calTemConflito(ev);
  const cls = [`cal-ev`,`cal-t-${ev.tipo}`,`cal-ev--${dens||'card'}`,
               ev.concluido?'concluido':'', sel?'sel':'', conf?'conflito':'',
               calAtivoHoje(ev)?'agora':''].filter(Boolean).join(' ');
  const quando = ev.hora ? `${gEsc(ev.hora)}${ev.duracao?`–${calHora(calMin(ev.hora)+ev.duracao)}`:''}` : calFmtIntervalo(ev);
  const arr = calPodeEditar() && ev.origem!=='oficial';
  // O banner só entra na densidade 'card': na grade do mês a faixa tem 19px de
  // altura e uma arte 5,5:1 ali vira borrão ilegível — lá quem identifica é o
  // trilho de cor. Medido antes de tentar.
  const banner = dens==='card' ? calBannerImg(ev) : '';
  return `<article class="${cls}${banner?' com-banner':''}" data-id="${gEsc(ev.id)}" tabindex="0" role="button"
      ${banner?'data-banner="1"':''} ${arr?'draggable="true"':''}
      aria-label="${gEsc(ev.titulo)} — ${gEsc(quando)}"
      onclick="calAbrirDetalhe('${gEsc(ev.id)}',event)"
      onkeydown="calTeclaEvento(event,'${gEsc(ev.id)}')"
      onmouseenter="calPreviewEntra(this,'${gEsc(ev.id)}')" onmouseleave="calPreviewSai()">
    <span class="cal-ev-rail" aria-hidden="true"></span>
    ${banner}
    <div class="cal-ev-corpo">
      <div class="cal-ev-l1">
        <span class="cal-ev-titulo">${gEsc(ev.titulo)}</span>
        ${ev.concluido?`<span class="cal-ev-ok" aria-label="Concluído">${calIco('check')}</span>`:''}
      </div>
      <div class="cal-ev-l2">
        <span class="cal-ev-quando">${quando}</span>
        ${ev.escopo && ev.escopo!=='Nacional'?`<span class="cal-ev-escopo">${gEsc(ev.escopo)}</span>`:''}
        ${conf?`<span class="cal-ev-conf">${calIco('alerta')}Conflito</span>`:''}
      </div>
      ${dens==='card' && ev.regra?`<p class="cal-ev-regra">${gEsc(ev.regra)}</p>`:''}
      ${dens==='card' && camp && calTemArtes()?`<button class="cal-ev-artes" onclick="event.stopPropagation();calAbrirArtes('${gEsc(ev.id)}')">
          ${calIco('arte')}<span>Ver as artes</span>${calIco('seta')}</button>`:''}
    </div>
  </article>`;
}
function calTeclaEvento(e, id){
  if(e.key==='Enter'||e.key===' '){ e.preventDefault(); calAbrirDetalhe(id,e); }
  if(e.key==='c'||e.key==='C'){ e.preventDefault(); calAlternaConcluido(id); }
}

// Conflito = dois eventos COM HORA no mesmo dia que se sobrepõem. Campanha do
// dia inteiro não conflita com nada: elas convivem por natureza.
function calTemConflito(ev){
  if(!ev.hora) return false;
  const ini=calMin(ev.hora), fim=ini+(ev.duracao||60);
  return calState.eventos.some(o=>{
    if(o.id===ev.id || !o.hora || o.inicio!==ev.inicio) return false;
    const a=calMin(o.hora), b=a+(o.duracao||60);
    return ini<b && a<fim;
  });
}
function calConflitosDoDia(iso){
  const lista=calDoDia(iso).filter(e=>e.hora);
  const out=[];
  for(let i=0;i<lista.length;i++) for(let j=i+1;j<lista.length;j++){
    const a=lista[i], b=lista[j];
    const a1=calMin(a.hora), a2=a1+(a.duracao||60), b1=calMin(b.hora), b2=b1+(b.duracao||60);
    if(a1<b2 && b1<a2) out.push([a,b]);
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════
   VISTA 1 — VISÃO GERAL (dashboard)
   Responde as quatro perguntas do brief sem trocar de tela: o que tenho
   hoje, o que vem depois, o que exige atenção, o que já foi concluído.
══════════════════════════════════════════════════════════════ */
function calVistaDash(){
  const hoje=calHoje();
  const doDia=calDoDia(hoje);
  const proximos=calProximos(6);
  return `<div class="cal-dash">
    ${calHero(hoje, doDia)}
    <div class="cal-dash-grade">
      <div class="cal-dash-a">
        ${calBlocoHoje(doDia)}
        ${calBlocoProximos(proximos)}
      </div>
      <aside class="cal-dash-b">
        ${calMini(calState.ancora)}
        ${calMetricas()}
        ${calBlocoAtencao()}
      </aside>
    </div>
  </div>`;
}

function calHero(hoje, doDia){
  const d=calData(hoje);
  const mae=doDia.filter(e=>e.tipo==='mae');
  const muda=doDia.filter(e=>e.tipo!=='recorrente');   // o que hoje tem de próprio
  const prox=calProximos(1)[0];
  // A frase responde, nesta ordem: o que tenho hoje → o que vem depois. Dizer
  // "5 ações ativas" quando as cinco são o chão recorrente é número honesto e
  // informação inútil: o franqueado quer saber o que MUDA hoje.
  const resumo = mae.length
    ? `${mae[0].titulo} está no ar hoje.`
    : (muda.length
        ? `${muda.length} ${muda.length===1?'ação começa ou termina hoje':'ações começam ou terminam hoje'}.`
        : (prox ? `Hoje só as recorrentes. ${prox.titulo} começa ${calFmtRelativo(prox.inicio)}.`
                : 'Hoje só as recorrentes. Nada novo marcado.'));
  return `<section class="cal-hero">
    <div class="cal-hero-data">
      <p class="cal-hero-sem">${gEsc(CAL_DIAS[d.getDay()])}</p>
      <p class="cal-hero-num"><span>${d.getDate()}</span><em>${gEsc(CAL_MESES_C[d.getMonth()])}</em></p>
    </div>
    <div class="cal-hero-txt">
      <p class="cal-hero-resumo">${gEsc(resumo)}</p>
      <button class="cal-hero-b" onclick="calVista('mes')">${calIco('cal')}<span>Ver o mês inteiro</span>${calIco('seta')}</button>
    </div>
  </section>`;
}

function calBlocoHoje(doDia){
  // Duas camadas separadas: o que hoje tem de próprio primeiro, o chão
  // recorrente depois — e em densidade menor, porque ele não muda.
  // Peso do tipo, não hora: o bloco "Hoje" é RESUMO, não linha do tempo. Com a
  // ordem cronológica os dois pushes de CRM das 11h ficavam acima da campanha-mãe
  // que carrega o dia. Cronologia é o trabalho da vista Dia, que tem régua.
  const muda=doDia.filter(e=>e.tipo!=='recorrente').sort(calComparaGrade);
  const chao=doDia.filter(e=>e.tipo==='recorrente');
  const feitos=muda.filter(e=>e.concluido).length;
  return `<section class="cal-bloco">
    <div class="cal-bloco-topo">
      <h2 class="cal-bloco-h">Hoje</h2>
      ${muda.length?`<span class="cal-bloco-meta">${muda.length} ${muda.length===1?'ação':'ações'}${feitos?` · ${feitos} concluída${feitos>1?'s':''}`:''}</span>`:''}
    </div>
    ${muda.length
      ? `<div class="cal-lista">${muda.map((e,i)=>`<div class="cal-cascata" style="--i:${i}">${calCardEvento(e,'card')}</div>`).join('')}</div>`
      : calVazio('Nada começa nem termina hoje','As recorrentes abaixo seguem no ar. Bom dia para adiantar a semana.',
          `<button class="cal-cta cal-cta--calmo" onclick="calVista('semana')">Ver a semana</button>`)}
    ${calChaoTira(chao, 'cal-chao--dash')}
  </section>`;
}

// "O que vem depois": os próximos N eventos que ainda não começaram.
function calProximos(n){
  const hoje=calHoje();
  return calFiltrado().filter(e=>e.inicio>hoje && e.tipo!=='recorrente')
    .sort((a,b)=> a.inicio<b.inicio?-1:(a.inicio>b.inicio?1:calCompara(a,b)))
    .slice(0,n);
}
function calBlocoProximos(lista){
  if(!lista.length) return '';
  return `<section class="cal-bloco">
    <div class="cal-bloco-topo">
      <h2 class="cal-bloco-h">Vem por aí</h2>
      <button class="cal-link" onclick="calVista('mes')">Ver o mês${calIco('seta')}</button>
    </div>
    <ol class="cal-prox">
      ${lista.map((e,i)=>`<li class="cal-prox-i cal-t-${e.tipo} cal-cascata" style="--i:${i}"
          tabindex="0" role="button" onclick="calSelecionar('${e.inicio}',{abrirDia:true})"
          onkeydown="if(event.key==='Enter'){calSelecionar('${e.inicio}',{abrirDia:true})}">
        <span class="cal-prox-quando"><b>${gEsc(calFmtRelativo(e.inicio))}</b><em>${gEsc(calFmtDiaCurto(e.inicio))}</em></span>
        <span class="cal-prox-tit">${gEsc(e.titulo)}</span>
        <span class="cal-prox-tipo">${gEsc(CAL_TIPOS[e.tipo].curto)}</span>
      </li>`).join('')}
    </ol>
  </section>`;
}

function calMetricas(){
  const hoje=calHoje();
  const mes=String(calState.ancora).slice(0,7);
  const doMes=calFiltrado().filter(e=>String(e.inicio).slice(0,7)===mes || String(e.fim).slice(0,7)===mes);
  const fimSemana=calAddDias(hoje,7);
  const cartoes=[
    ['Ativas agora', calFiltrado().filter(e=>calCobre(e,hoje)).length, 'mae'],
    ['Começam em 7 dias', calFiltrado().filter(e=>e.inicio>hoje && e.inicio<=fimSemana).length, 'especial'],
    ['Disparos de CRM', doMes.filter(e=>e.tipo==='crm').length, 'crm'],
    ['Datas especiais', doMes.filter(e=>e.tipo==='especial').length, 'social']
  ];
  return `<section class="cal-bloco cal-bloco--metricas">
    <h2 class="cal-bloco-h">O mês em números</h2>
    <div class="cal-met">
      ${cartoes.map(([l,v,t],i)=>`<div class="cal-met-c cal-t-${t} cal-cascata" style="--i:${i}">
        <b class="cal-met-v" data-num="${v}">${v}</b><span class="cal-met-l">${gEsc(l)}</span></div>`).join('')}
    </div>
  </section>`;
}

// "O que exige atenção": conflito de horário, campanha que termina hoje ou
// amanhã, e evento sem campanha ligada (o franqueado clica e não acha arte).
function calBlocoAtencao(){
  const hoje=calHoje(), avisos=[];
  calConflitosDoDia(hoje).slice(0,2).forEach(([a,b])=>{
    avisos.push(['conflito', `"${a.titulo}" e "${b.titulo}" se cruzam no horário`, a.id]);
  });
  calFiltrado().filter(e=>e.fim===hoje && e.tipo!=='recorrente' && e.inicio!==e.fim)
    .forEach(e=>avisos.push(['fim', `"${e.titulo}" termina hoje`, e.id]));
  calFiltrado().filter(e=>e.inicio===calAddDias(hoje,1) && e.tipo==='mae')
    .forEach(e=>avisos.push(['comeca', `"${e.titulo}" começa amanhã — cadastro precisa estar pronto`, e.id]));
  if(!avisos.length){
    return `<section class="cal-bloco cal-bloco--calmo">
      <h2 class="cal-bloco-h">Atenção</h2>
      <p class="cal-calmo">${calIco('check')}Nada pendente. O mês está sob controle.</p>
    </section>`;
  }
  return `<section class="cal-bloco">
    <h2 class="cal-bloco-h">Atenção</h2>
    <ul class="cal-avisos">
      ${avisos.slice(0,4).map((a,i)=>`<li class="cal-aviso cal-aviso--${a[0]} cal-cascata" style="--i:${i}"
        tabindex="0" role="button" onclick="calAbrirDetalhe('${gEsc(a[2])}')"
        onkeydown="if(event.key==='Enter'){calAbrirDetalhe('${gEsc(a[2])}')}">
        ${calIco('alerta')}<span>${gEsc(a[1])}</span></li>`).join('')}
    </ul>
  </section>`;
}

/* ══════════════════════════════════════════════════════════════
   COMPONENTE — MINI CALENDAR
   Versão compacta: só número, ponto de densidade e o dia de hoje. Serve de
   bússola no dashboard e de seletor no editor.
══════════════════════════════════════════════════════════════ */
function calMini(iso, opts){
  opts=opts||{};
  const grade=calGradeMes(iso), hoje=calHoje(), sel=opts.sel||calState.selecionado;
  const onclick=opts.onclick||"calSelecionar('%d')";
  const mesRef=String(iso).slice(0,7);
  return `<div class="cal-mini${opts.compacto?' compacto':''}">
    <div class="cal-mini-topo">
      <button class="cal-mini-nav" onclick="${opts.nav?opts.nav.replace('%p','-1'):"calMiniNav(-1)"}" aria-label="Mês anterior">${calIco('ant')}</button>
      <b class="cal-mini-mes">${gEsc(calFmtMesAno(iso))}</b>
      <button class="cal-mini-nav" onclick="${opts.nav?opts.nav.replace('%p','1'):"calMiniNav(1)"}" aria-label="Próximo mês">${calIco('prox')}</button>
    </div>
    <div class="cal-mini-head">${CAL_HEAD.map(d=>`<span>${d[0].toUpperCase()}</span>`).join('')}</div>
    <div class="cal-mini-grade">
      ${grade.flat().map(d=>{
        const fora=String(d).slice(0,7)!==mesRef;
        const n=calDoDia(d).length;
        const cls=['cal-mini-d', fora?'fora':'', d===hoje?'hoje':'', d===sel?'sel':''].filter(Boolean).join(' ');
        return `<button class="${cls}" onclick="${onclick.replace('%d',d)}" aria-label="${gEsc(calFmtDiaLongo(d))}${n?`, ${n} eventos`:''}"
          ${d===sel?'aria-current="date"':''}><i>${calData(d).getDate()}</i>
          ${n?`<span class="cal-mini-pts">${Array.from({length:Math.min(n,3)},()=>'<u></u>').join('')}</span>`:''}</button>`;
      }).join('')}
    </div>
  </div>`;
}
function calMiniNav(p){ calState.ancora=calAddMeses(calState.ancora,p); calRender({direcao:p}); }

/* ══════════════════════════════════════════════════════════════
   VISTA 2 — MÊS
   A tela principal. Célula grande, hairline em vez de caixa, e — a correção
   central do calendário antigo — campanha de vários dias vira UMA FAIXA
   contínua atravessando a semana, em vez de repetir o mesmo rótulo em cada
   célula. As faixas ocupam "pistas" (lanes); a célula reserva a altura delas.
══════════════════════════════════════════════════════════════ */
function calVistaMes(){
  const grade=calGradeMes(calState.ancora);
  const mesRef=String(calState.ancora).slice(0,7);
  // Mês que a operação NÃO publicou não ganha grade. Desenhar 42 células vazias
  // e explicar embaixo esconde o motivo atrás da dobra (medido: a mensagem caía
  // em y=886 num palco de 704) — a pessoa vê um mês em branco e conclui que
  // quebrou. Sem publicação, a explicação É a tela.
  if(!calMesPublicado(calState.ancora)){
    const ult=calMesesPublicados().slice(-1)[0]||'';
    return `<div class="cal-mes cal-mes--sem">${calVazio(
      'A operação ainda não publicou este mês',
      `O calendário oficial vai até ${calFmtMesPub(ult)}. Mês sem publicação fica vazio de propósito — o calendário não inventa data.`,
      `<button class="cal-cta cal-cta--calmo" onclick="calHojeIr()">Voltar para hoje</button>`)}</div>`;
  }
  const semanas=grade.map(sem=>calSemanaHtml(sem, mesRef)).join('');
  const vazio = !calNoIntervalo(grade[0][0], grade[5][6]).length;
  return `<div class="cal-mes">
    ${calSempreNoAr()}
    <div class="cal-mes-head" aria-hidden="true">${CAL_HEAD.map(d=>`<span>${d}</span>`).join('')}</div>
    <div class="cal-mes-grade" role="grid" aria-label="${gEsc(calFmtMesAno(calState.ancora))}">${semanas}</div>
    ${vazio?`<div class="cal-mes-vazio">${calVazio('Nenhum evento com este filtro',
      'Todos os eventos do mês estão escondidos pelo filtro atual.',
      `<button class="cal-cta cal-cta--calmo" onclick="calLimpaFiltros()">Mostrar tudo</button>`)}</div>`:''}
    ${calListaDoDiaSel()}
  </div>`;
}

// O chão do mês: as recorrentes, ditas uma vez. Ficam fora da grade de
// propósito (ver calPistas) — repetir "Combos Coca-Cola" trinta vezes não é
// informação, é ruído com cara de informação.
function calSempreNoAr(){
  const mes=String(calState.ancora).slice(0,7);
  const rec=calFiltrado().filter(e=>e.tipo==='recorrente' && String(e.inicio).slice(0,7)===mes);
  if(!rec.length) return '';
  return calChaoTira(rec);
}
// UM construtor da tira, usado pelo Mês, pela Semana, pelo Dia e pelo dashboard.
// Já existiu uma segunda cópia inline no dashboard: ela ficou para trás quando o
// chip ganhou banner, e a tira do dashboard voltou a ser só texto. É a regra dos
// motores únicos do 03_ENGINEERING valendo para um componente pequeno.
function calChaoTira(lista, cls){
  if(!lista || !lista.length) return '';
  return `<div class="cal-chao${cls?' '+cls:''}" role="group" aria-label="Campanhas que rodam o mês inteiro">
    <span class="cal-chao-l">Sempre no ar</span>
    <div class="cal-chao-is">${lista.map(calChaoItem).join('')}</div>
  </div>`;
}
// Com banner o chip VIRA o banner (a arte já diz o nome); sem banner, continua
// ponto + texto. Os dois convivem na mesma fileira sem desalinhar porque a
// altura é a mesma — a largura é que muda.
function calChaoItem(e){
  const src=calBanner(e);
  return `<button class="cal-chao-i cal-t-recorrente${src?' e-banner':''}" data-id="${gEsc(e.id)}"
    ${src?'data-banner="1"':''} title="${gEsc(e.titulo)}" aria-label="${gEsc(e.titulo)}"
    onclick="calAbrirDetalhe('${gEsc(e.id)}',event)"
    onmouseenter="calPreviewEntra(this,'${gEsc(e.id)}')" onmouseleave="calPreviewSai()">
    ${src?calBannerImg(e):`<span class="cal-ponto"></span>${gEsc(e.titulo)}`}</button>`;
}

// No celular a grade vira bússola e QUEM MANDA É A LISTA (07_ROADMAP §4).
// O bloco existe sempre no HTML; o CSS o esconde acima de 768px — assim não
// há um segundo caminho de render só para o telefone.
function calListaDoDiaSel(){
  // Mesma ordem do bloco "Hoje": peso do tipo. Cronologia é assunto da régua da
  // vista Dia — aqui é resumo, e resumo lidera pelo que carrega o dia.
  const d=calState.selecionado, lista=calDoDia(d).sort(calComparaGrade);
  return `<section class="cal-mes-lista" aria-label="Eventos do dia selecionado">
    <div class="cal-bloco-topo">
      <h2 class="cal-bloco-h">${gEsc(calFmtDiaLongo(d))}${d===calHoje()?' · hoje':''}</h2>
      <button class="cal-link" onclick="calSelecionar('${d}',{abrirDia:true})">Abrir o dia${calIco('seta')}</button>
    </div>
    ${lista.length
      ? `<div class="cal-lista">${lista.map((e,i)=>`<div class="cal-cascata" style="--i:${i}">${calCardEvento(e,'card')}</div>`).join('')}</div>`
      : calVazio('Dia sem evento','Toque em outro dia da grade acima para ver o que a rede comunica nele.','')}
  </section>`;
}

// Distribui as faixas de vários dias em pistas sem sobreposição.
// ⛔ RECORRENTE FICA DE FORA. Ela cobre o mês inteiro: virava cinco barras de
// ponta a ponta em TODAS as semanas, empurrando a Semana do Cliente para baixo
// do "+3 eventos". Era exatamente o defeito do calendário antigo. O chão do mês
// aparece uma vez, na tira "sempre no ar" (calSempreNoAr) — e a grade volta a
// mostrar o que MUDA, que é a informação que a data carrega.
function calPistas(semana){
  const a=semana[0], b=semana[6];
  const faixas=calNoIntervalo(a,b).filter(e=>e.tipo!=='recorrente').filter(calMultiDia)
    .sort((x,y)=> x.inicio!==y.inicio ? (x.inicio<y.inicio?-1:1)
                : ((calDiff(x.inicio,x.fim)>calDiff(y.inicio,y.fim))?-1:1));
  const pistas=[];
  faixas.forEach(ev=>{
    const ini=Math.max(0, calDiff(a, ev.inicio));
    const fim=Math.min(6, calDiff(a, ev.fim));
    if(fim<0||ini>6) return;
    let p=0;
    while(pistas[p] && pistas[p].some(f=>!(f.fim<ini || f.ini>fim))) p++;
    pistas[p]=pistas[p]||[];
    pistas[p].push({ev, ini, fim, corta:{esq:ev.inicio<a, dir:ev.fim>b}});
  });
  return pistas;
}

function calSemanaHtml(semana, mesRef){
  const hoje=calHoje();
  const pistas=calPistas(semana);
  const nPistas=Math.min(pistas.length, 4);
  const faixasHtml=pistas.slice(0,4).map((pista,pi)=>pista.map(f=>{
    const ev=f.ev, camp=calCamp(ev);
    const cls=['cal-faixa',`cal-t-${ev.tipo}`, ev.concluido?'concluido':'',
               f.corta.esq?'corta-esq':'', f.corta.dir?'corta-dir':'',
               calState.aberto===ev.id?'sel':''].filter(Boolean).join(' ');
    return `<button class="${cls}" style="--c:${f.ini};--n:${f.fim-f.ini+1};--p:${pi}"
      data-id="${gEsc(ev.id)}" ${calPodeEditar()&&ev.origem!=='oficial'?'draggable="true"':''}
      onclick="calAbrirDetalhe('${gEsc(ev.id)}',event)"
      onmouseenter="calPreviewEntra(this,'${gEsc(ev.id)}')" onmouseleave="calPreviewSai()"
      title="${gEsc(ev.titulo)} · ${gEsc(calFmtIntervalo(ev))}">
      <span class="cal-faixa-t">${gEsc(ev.titulo)}</span>
      ${camp?`<span class="cal-faixa-tag">${calIco('arte')}</span>`:''}
    </button>`;
  }).join('')).join('');

  const celulas=semana.map(d=>{
    const fora=String(d).slice(0,7)!==mesRef;
    const soltos=calDoDia(d).filter(e=>!calMultiDia(e)).sort(calComparaGrade);
    const extras=pistas.length>4 ? pistas.slice(4).reduce((n,p)=>n+p.filter(f=>f.ini<=calDiff(semana[0],d)&&f.fim>=calDiff(semana[0],d)).length,0) : 0;
    const mostra=soltos.slice(0,2), resto=soltos.length-mostra.length+extras;
    const cls=['cal-dia', fora?'fora':'', d===hoje?'hoje':'', d===calState.selecionado?'sel':'',
               calFimDeSemana(d)?'fds':''].filter(Boolean).join(' ');
    return `<div class="${cls}" role="gridcell" tabindex="${d===calState.selecionado?0:-1}"
        data-dia="${d}" aria-selected="${d===calState.selecionado}"
        aria-label="${gEsc(calFmtDiaLongo(d))}${soltos.length?`, ${soltos.length} eventos`:', sem eventos'}"
        onclick="calSelecionar('${d}')" ondblclick="calNovoEvento('${d}')"
        onkeydown="calTeclaDia(event,'${d}')">
      <div class="cal-dia-topo">
        <span class="cal-dia-num">${calData(d).getDate()}</span>
        ${calPodeEditar()?`<button class="cal-dia-add" tabindex="-1" aria-label="Novo evento em ${gEsc(calFmtDiaCurto(d))}"
           onclick="event.stopPropagation();calNovoEvento('${d}')">${calIco('mais')}</button>`:''}
      </div>
      <div class="cal-dia-corpo" style="--pistas:${nPistas}">
        ${mostra.map(e=>calCardEvento(e,'chip')).join('')}
        ${resto>0?`<button class="cal-dia-mais" onclick="event.stopPropagation();calSelecionar('${d}',{abrirDia:true})">+${resto} ${resto===1?'evento':'eventos'}</button>`:''}
      </div>
    </div>`;
  }).join('');

  return `<div class="cal-sem" role="row" style="--pistas:${nPistas}">
    ${celulas}
    <div class="cal-faixas" aria-hidden="false">${faixasHtml}</div>
  </div>`;
}

// Setas navegam a grade; Enter abre o dia; N cria evento no dia focado.
// ⚠ calRender troca o innerHTML inteiro: a célula com foco É DESTRUÍDA e o foco
// cai no <body>. Como o handler é inline na célula, a tecla seguinte não chega
// em ninguém — a seta funcionava uma vez só. Por isso marcamos a intenção ANTES
// do render e devolvemos o foco depois, em vez de tentar deduzi-lo do
// activeElement (que a essa altura já é o body).
let _calFocoGrade=false;
function calTeclaDia(e, iso){
  const passos={ArrowRight:1, ArrowLeft:-1, ArrowDown:7, ArrowUp:-7};
  if(passos[e.key]!==undefined){
    e.preventDefault();
    const alvo=calAddDias(iso, passos[e.key]);
    calState.selecionado=alvo;
    if(!calMesmoMes(alvo, calState.ancora)) calState.ancora=alvo;
    _calFocoGrade=true;
    calRender();
    return;
  }
  if(e.key==='Enter'||e.key===' '){ e.preventDefault(); _calFocoGrade=false; calSelecionar(iso,{abrirDia:true}); }
  if(e.key==='n'||e.key==='N'){ e.preventDefault(); calNovoEvento(iso); }
  if(e.key==='Home'){ e.preventDefault(); _calFocoGrade=true; calSelecionar(calSegundaDe(iso)); }
  if(e.key==='End'){ e.preventDefault(); _calFocoGrade=true; calSelecionar(calAddDias(calSegundaDe(iso),6)); }
}
function calFocoTeclado(){
  if(!_calFocoGrade) return;
  const alvo=document.querySelector('.cal-dia.sel[tabindex="0"]');
  if(alvo) alvo.focus(); else _calFocoGrade=false;
}
// Clique/toque devolve a condução ao ponteiro: sem isto o render seguinte
// roubaria o foco de volta para a grade no meio de outra interação.
document.addEventListener('pointerdown', ()=>{ _calFocoGrade=false; }, true);
function calMesMontada(){
  calPillSeg();
  calLigaArrasto(document.querySelectorAll('.cal-mes .cal-ev, .cal-faixa'), 'dia');
  calAnimaNumeros();
}

/* ── Pill do segmented control: acompanha o botão ativo ────── */
function calPillSeg(){
  const pill=document.getElementById('cal-seg-pill');
  const b=document.querySelector('.cal-seg-b.ativo');
  if(!pill||!b) return;
  pill.style.width=b.offsetWidth+'px';
  pill.style.transform=`translateX(${b.offsetLeft}px)`;
}
// Contagem que sobe em vez de aparecer pronta — o número vira um evento.
function calAnimaNumeros(){
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('.cal-met-v[data-num]').forEach(el=>{
    const alvo=+el.dataset.num||0; if(alvo<=0){ el.textContent='0'; return; }
    const t0=performance.now(), dur=520;
    const passo=t=>{
      const p=Math.min(1,(t-t0)/dur), v=Math.round(alvo*(1-Math.pow(1-p,3)));
      el.textContent=v;
      if(p<1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  });
}

/* ══════════════════════════════════════════════════════════════
   ARRASTAR & SOLTAR
   Físico: o cartão levanta (escala + sombra), acompanha o ponteiro e cai
   com mola. HTML5 drag nativo dá o transporte; a mola é CSS. Só equipe, e
   nunca em evento oficial — data da rede não muda por arrasto.
══════════════════════════════════════════════════════════════ */
let _calArrasto=null;
function calLigaArrasto(nodes, modo){
  if(!calPodeEditar()) return;
  nodes.forEach(n=>{
    if(!n.getAttribute('draggable')) return;
    n.addEventListener('dragstart', e=>{
      _calArrasto={id:n.dataset.id, modo};
      n.classList.add('arrastando');
      document.body.classList.add('cal-arrastando');
      try{ e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain', n.dataset.id); }catch(_){}
    });
    n.addEventListener('dragend', ()=>{
      n.classList.remove('arrastando');
      document.body.classList.remove('cal-arrastando');
      document.querySelectorAll('.cal-alvo').forEach(x=>x.classList.remove('cal-alvo'));
      _calArrasto=null;
    });
  });
  document.querySelectorAll('.cal-dia').forEach(c=>{
    c.addEventListener('dragover', e=>{ if(!_calArrasto) return; e.preventDefault(); c.classList.add('cal-alvo'); });
    c.addEventListener('dragleave', ()=>c.classList.remove('cal-alvo'));
    c.addEventListener('drop', e=>{
      e.preventDefault(); c.classList.remove('cal-alvo');
      if(!_calArrasto) return;
      const ev=calById(_calArrasto.id); if(!ev) return;
      const dias=calDiff(ev.inicio, c.dataset.dia);
      if(dias && calMover(ev.id, dias)){
        gToast(`"${ev.titulo}" movido para ${calFmtDiaCurto(c.dataset.dia)}.`,'success');
        calRender();
        requestAnimationFrame(()=>{
          const alvo=document.querySelector(`.cal-ev[data-id="${CSS.escape(ev.id)}"], .cal-faixa[data-id="${CSS.escape(ev.id)}"]`);
          if(alvo) alvo.classList.add('cal-pousou');
        });
      }
    });
  });
}

/* ══════════════════════════════════════════════════════════════
   MONTAGEM
   Lazy como o Estúdio e a Academia: só a primeira entrada paga a carga.
══════════════════════════════════════════════════════════════ */
function calInit(){
  const root=document.getElementById('cal-root');
  if(!root) return;
  if(calState.montado){ calRender(); return; }
  calState.montado=true;
  calLePrefs();
  calState.ancora=calHoje(); calState.selecionado=calHoje();
  calRender();
  // A apresentação do mês só pode ser decidida DEPOIS que o conteúdo chegou —
  // ela lê os eventos do mês para montar as cenas.
  calCarregar().then(()=>{ if(typeof calApresTalvez==='function') calApresTalvez(); });
  window.addEventListener('resize', calPillSeg);
  window.addEventListener('online',  ()=>{ calState.sync='ok'; calCarregar(); });
  window.addEventListener('offline', ()=>{ calState.sync='offline'; calRender(); });
  document.addEventListener('keydown', calAtalhosGlobais);
  // A gestão mudou uma chave (aqui ou em outra máquina) → o módulo se reconstrói
  // na hora, sem reload. Se a vista corrente acabou de ser desligada, calVista
  // já derruba para o Mês. Mesmo padrão do listener em main.js.
  window.addEventListener('luma:feature-flags-changed', ()=>{
    if(!document.body.classList.contains('mode-calendario')) return;
    if((calState.vista==='semana'||calState.vista==='dia') && !calTemAgenda()) calState.vista='mes';
    if(document.getElementById('cal-apres') && !calTemApres()) calApresFechar();
    calRender();
  });
  if(typeof gTrackEvent==='function') gTrackEvent('calendario_aberto',{});
}
// Atalhos do módulo (só quando a aba está na frente): M/S/D/G trocam a vista,
// T volta pra hoje, N cria, Esc fecha o que estiver aberto.
function calAtalhosGlobais(e){
  if(!document.body.classList.contains('mode-calendario')) return;
  // Com a apresentação aberta ela manda no teclado (tem handler próprio).
  if(document.getElementById('cal-apres')) return;
  const alvo=e.target, tag=(alvo&&alvo.tagName||'').toLowerCase();
  if(tag==='input'||tag==='textarea'||tag==='select'||(alvo&&alvo.isContentEditable)){
    if(e.key==='Escape') alvo.blur();
    return;
  }
  if(e.metaKey||e.ctrlKey||e.altKey) return;
  const k=e.key.toLowerCase();
  if(k==='g'){ e.preventDefault(); calVista('dash'); }
  else if(k==='m'){ e.preventDefault(); calVista('mes'); }
  else if(k==='s' && calTemAgenda()){ e.preventDefault(); calVista('semana'); }
  else if(k==='d' && calTemAgenda()){ e.preventDefault(); calVista('dia'); }
  else if(k==='t'){ e.preventDefault(); calHojeIr(); }
  else if(k==='n' && calPodeEditar()){ e.preventDefault(); calNovoEvento(calState.selecionado); }
  else if(e.key==='Escape'){ if(calFecharTudo()) e.preventDefault(); }
}
