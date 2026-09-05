/**
 * js/academia/academia.js
 *
 * ACADEMIA DELIVERY MUCH — núcleo do módulo de formação do franqueado.
 * Aqui moram: estado, camada de dados (Supabase + cache local), roteamento
 * interno e a HOME DA JORNADA. O ambiente de aula vive em aula.js, o agente em
 * agente.js, a gestão em gestao.js e o certificado em certificado.js.
 *
 * NOME: o módulo é a "Academia"; a jornada dentro dele é a "Formação do
 * Franqueado". ⚠ NÃO chamar de "Implementação": esse nome já é a categoria de
 * MATERIAIS do catálogo (CAMPS_IMPLEMENTACAO / fRenderImplementacao) — dois
 * "Implementação" na mesma navegação confundiriam o franqueado.
 *
 * Prefixo `ac*` — os prefixos f, d e g seguem intocados. Estado em `let` global
 * + re-render manual, como o resto da casa. Sem import/export, sem build.
 *
 * Depende de: core/supabase.js (gSupabase, gTrackEvent), core/toast.js (gToast,
 * gEsc, gConfirm), core/auth.js (gCurrentUser, gIsAdmin).
 */

/* ══════════════════════════════════════════════════════════════
   ESTADO
   Um único objeto global (padrão fState/dLayers). Resolvemos aula/módulo
   sempre POR ID na hora de usar — o objeto do curso é trocado inteiro a cada
   sync, então guardar referência viva aponta pra objeto morto (armadilha
   documentada em 03_ENGINEERING §3).
══════════════════════════════════════════════════════════════ */
let acState = {
  curso: null,        // {id,nome,...,modulos:[{...,aulas:[]}]}
  matricula: null,    // {iniciado_em, ultimo_acesso, ultima_aula_id, concluido_em}
  progresso: {},      // aula_id → {posicao_seg,pct_assistido,concluida,salva,...}
  notas: {},          // aula_id → [{id,texto,video_seg,created_at}]
  certificado: null,
  aulaId: null,       // aula aberta no ambiente de aula
  rota: 'home',       // home | aula | gestao | certificado
  carregando: false,
  erro: '',           // mensagem de falha de carga (estado de erro da UI)
  demo: false,        // conteúdo de demonstração (sem backend ou sem curso publicado)
  preview: false      // equipe vendo como franqueado (banner de preview)
};

const AC_CACHE_CURSO = 'yngs_ac_curso_v1';
const AC_CACHE_PROG  = 'yngs_ac_prog_v1';
const AC_SLUG_PADRAO = 'formacao-franqueado';

/* ══════════════════════════════════════════════════════════════
   ÍCONES (SVG inline, currentColor — nunca emoji: ver 04_DESIGN_SYSTEM §10)
══════════════════════════════════════════════════════════════ */
const AC_ICO = {
  cap:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12.5V17c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5"/></svg>',
  play:  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
  lock:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  seta:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>',
  volta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m11 18-6-6 6-6"/></svg>',
  chev:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>',
  relog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>',
  medal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="15" r="6"/><path d="m9 9 -2.5-6h11L15 9"/><path d="m12 13 .9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2L9 15.2l2-.3Z"/></svg>',
  nota:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h11l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M14 4v6h6"/><path d="M8 14h8"/><path d="M8 17.5h5"/></svg>',
  marca: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z"/></svg>',
  arq:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3v5h5"/><path d="M15 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/></svg>',
  novo:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v18M3 12h18"/></svg>',
  alerta:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4l9 16H3z"/><path d="M12 10v4"/><path d="M12 17h.01"/></svg>',
  bot:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="10" width="18" height="11" rx="2.5"/><circle cx="12" cy="5" r="2"/><path d="M12 7v3"/><path d="M8.5 15h.01"/><path d="M15.5 15h.01"/></svg>',
  cfg:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.4-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4Z"/></svg>'
};
// Ícone com tamanho: os SVGs acima não trazem width/height (o CSS controla).
function acIco(nome, cls){ return `<span class="ac-i${cls?' '+cls:''}" aria-hidden="true">${AC_ICO[nome]||''}</span>`; }

/* ══════════════════════════════════════════════════════════════
   CONTEÚDO DE DEMONSTRAÇÃO
   Estrutura ILUSTRATIVA para o módulo funcionar antes de a equipe publicar a
   formação real. ⚠ Não é conteúdo oficial da Delivery Much — a UI marca como
   "demonstração" e a gestão pode semear isto no banco com um clique
   (acGestaoSemearDemo) e então editar. Sem vídeo: aula sem vídeo é um estado
   real e previsto, então a demo já exercita esse caminho.
══════════════════════════════════════════════════════════════ */
const AC_CURSO_DEMO = {
  id: 'demo-formacao', slug: AC_SLUG_PADRAO, _demo: true,
  nome: 'Formação do Franqueado',
  descricao: 'A jornada que acompanha você da assinatura do contrato ao primeiro mês de operação da sua cidade.',
  objetivo: 'Entender como a Delivery Much funciona, preparar a operação e conduzir a implementação da sua unidade com segurança.',
  carga_horaria_min: 480, versao: 1, publicado: true,
  criterios: { pct_min: 0.85 },
  certificado: { assinaturas: [{ nome: 'Delivery Much', cargo: 'Franqueadora' }], mensagem: '' },
  modulos: [
    { id:'demo-m1', nome:'Boas-vindas à jornada', ordem:0, publicado:true, prereq_modulo_id:null,
      descricao:'Como a formação funciona, o que você vai aprender e como pedir ajuda.',
      aulas:[
        { id:'demo-a1', titulo:'Bem-vindo à Delivery Much', ordem:0, publicado:true, obrigatoria:true, duracao_seg:420,
          objetivo:'Entender o que esperar da formação e como ela acompanha a sua implementação.',
          resumo:'Conteúdo de demonstração. Apresenta a estrutura da jornada: módulos, aulas, materiais, anotações e o agente educacional.',
          descricao:'Abertura da formação.', conteudo_versao:1,
          materiais:[{id:'d1',tipo:'checklist',titulo:'Checklist de primeiros passos (exemplo)',url:''}],
          transcricao:[], atividade:{} },
        { id:'demo-a2', titulo:'Como usar a Academia', ordem:1, publicado:true, obrigatoria:true, duracao_seg:300,
          objetivo:'Saber navegar entre aulas, marcar conclusão, anotar e tirar dúvidas.',
          resumo:'Conteúdo de demonstração. Mostra o ambiente de aula: player, abas, anotações e o agente.',
          descricao:'', conteudo_versao:1, materiais:[], transcricao:[], atividade:{} }
      ]},
    { id:'demo-m2', nome:'Conhecendo a Delivery Much', ordem:1, publicado:true, prereq_modulo_id:'demo-m1',
      descricao:'O modelo de negócio, a rede e o papel do franqueado na cidade.',
      aulas:[
        { id:'demo-a3', titulo:'O modelo de negócio', ordem:0, publicado:true, obrigatoria:true, duracao_seg:900,
          objetivo:'Compreender como a rede gera receita e qual é o papel da sua unidade.',
          resumo:'Conteúdo de demonstração, a ser validado pela equipe Delivery Much.',
          descricao:'', conteudo_versao:1, materiais:[], transcricao:[],
          atividade:{ tipo:'quiz', titulo:'Revisão rápida', itens:[
            { id:'q1', enunciado:'Quantos franqueados operam uma mesma cidade na Delivery Much?',
              opcoes:['Um, com exclusividade territorial','Dois, em regime de concorrência','Depende do tamanho da cidade'],
              correta:0, explicacao:'A exclusividade territorial por cidade é garantida em contrato.' }
          ]} },
        { id:'demo-a4', titulo:'A rede e o suporte da franqueadora', ordem:1, publicado:true, obrigatoria:false, duracao_seg:600,
          objetivo:'Saber a quem recorrer em cada tipo de dúvida.', resumo:'Conteúdo de demonstração.',
          descricao:'Aula opcional.', conteudo_versao:1, materiais:[], transcricao:[], atividade:{} }
      ]},
    { id:'demo-m3', nome:'Preparação da operação', ordem:2, publicado:true, prereq_modulo_id:'demo-m2',
      descricao:'O que precisa estar pronto antes de a cidade entrar no ar.',
      aulas:[
        { id:'demo-a5', titulo:'Estrutura mínima para começar', ordem:0, publicado:true, obrigatoria:true, duracao_seg:720,
          objetivo:'Montar a lista do que precisa existir antes do lançamento.',
          resumo:'Conteúdo de demonstração.', descricao:'', conteudo_versao:1,
          materiais:[{id:'d2',tipo:'planilha',titulo:'Planilha de preparação (exemplo)',url:''}],
          transcricao:[], atividade:{} }
      ]},
    { id:'demo-m4', nome:'Processos e ferramentas', ordem:3, publicado:true, prereq_modulo_id:'demo-m3',
      descricao:'Os sistemas da rede no dia a dia — inclusive o Luma.',
      aulas:[
        { id:'demo-a6', titulo:'Ferramentas da rede', ordem:0, publicado:true, obrigatoria:true, duracao_seg:660,
          objetivo:'Reconhecer cada sistema e para que ele serve.', resumo:'Conteúdo de demonstração.',
          descricao:'', conteudo_versao:1, materiais:[], transcricao:[], atividade:{} },
        { id:'demo-a7', titulo:'Criando suas artes no Luma', ordem:1, publicado:true, obrigatoria:true, duracao_seg:540,
          objetivo:'Gerar a primeira arte da sua cidade a partir de uma campanha.',
          resumo:'Conteúdo de demonstração. Na prática, esta aula termina com você criando uma arte de verdade na aba Franqueado.',
          descricao:'', conteudo_versao:1, materiais:[], transcricao:[], atividade:{} }
      ]},
    { id:'demo-m5', nome:'Implantação local', ordem:4, publicado:true, prereq_modulo_id:'demo-m4',
      descricao:'Captação de restaurantes e preparação do lançamento na cidade.',
      aulas:[
        { id:'demo-a8', titulo:'Captação dos primeiros restaurantes', ordem:0, publicado:true, obrigatoria:true, duracao_seg:840,
          objetivo:'Conduzir a primeira rodada de captação com método.', resumo:'Conteúdo de demonstração.',
          descricao:'', conteudo_versao:1, materiais:[], transcricao:[], atividade:{} }
      ]},
    { id:'demo-m6', nome:'Primeiros passos da unidade', ordem:5, publicado:true, prereq_modulo_id:'demo-m5',
      descricao:'O primeiro mês no ar: acompanhar, corrigir e crescer.',
      aulas:[
        { id:'demo-a9', titulo:'O primeiro mês no ar', ordem:0, publicado:true, obrigatoria:true, duracao_seg:600,
          objetivo:'Saber o que acompanhar nas primeiras semanas de operação.', resumo:'Conteúdo de demonstração.',
          descricao:'', conteudo_versao:1, materiais:[], transcricao:[], atividade:{} }
      ]}
  ]
};

/* ══════════════════════════════════════════════════════════════
   HELPERS DE DADOS (derivam tudo do acState — sem estado duplicado)
══════════════════════════════════════════════════════════════ */

// Lista PLANA de aulas na ordem da jornada. É a base de progresso, navegação e
// "próxima aula" — um único lugar decide a ordem (evita sidebar e home
// discordarem sobre qual é a aula seguinte).
function acAulas(){
  const c = acState.curso; if(!c || !Array.isArray(c.modulos)) return [];
  const out = [];
  c.modulos.forEach(m=>{
    (m.aulas||[]).forEach(a=>{ out.push(Object.assign({}, a, {_modulo:m})); });
  });
  return out;
}
function acAula(id){ return acAulas().find(a=>a.id===id) || null; }
function acModulo(id){
  const c=acState.curso; if(!c) return null;
  return (c.modulos||[]).find(m=>m.id===id) || null;
}
// Progresso sempre com forma completa: quem lê nunca precisa checar undefined.
function acProg(aulaId){
  const p = acState.progresso[aulaId];
  return p || { posicao_seg:0, pct_assistido:0, concluida:false, salva:false,
                visto_conteudo_versao:0, tentativas:[], concluida_em:null, revisitada_em:null };
}
function acConcluiu(){ return !!(acState.matricula && acState.matricula.concluido_em); }
function acIniciou(){ return !!acState.matricula; }

// Módulo liberado? Pré-requisito = TODAS as aulas obrigatórias do módulo anterior
// concluídas. Pós-formação libera tudo (revisão nunca é bloqueada).
function acModuloLiberado(mod){
  if(!mod) return false;
  if(acConcluiu()) return true;
  const prereqId = mod.prereq_modulo_id;
  if(!prereqId) return true;
  const prereq = acModulo(prereqId);
  if(!prereq) return true;                       // pré-requisito apagado não trava a jornada
  const obrig = (prereq.aulas||[]).filter(a=>a.obrigatoria);
  if(!obrig.length) return true;
  return obrig.every(a=>acProg(a.id).concluida);
}
function acAulaLiberada(aula){
  if(!aula) return false;
  return acModuloLiberado(aula._modulo || acModulo(aula.modulo_id));
}
// Conteúdo mudou depois de a pessoa ver a aula? (não mexe na conclusão — regra
// do produto: correção pequena não apaga formação)
function acAulaAtualizada(aula){
  const p = acProg(aula.id);
  return !!(p.visto_conteudo_versao && (aula.conteudo_versao||1) > p.visto_conteudo_versao);
}
function acModuloEstado(mod){
  const aulas = mod.aulas||[];
  if(!aulas.length) return 'vazio';
  if(!acModuloLiberado(mod)) return 'bloqueado';
  const obrig = aulas.filter(a=>a.obrigatoria);
  const base = obrig.length ? obrig : aulas;
  const feitas = base.filter(a=>acProg(a.id).concluida).length;
  if(feitas === 0) return 'nao_iniciado';
  if(feitas < base.length) return 'andamento';
  return aulas.some(acAulaAtualizada) ? 'atualizado' : 'concluido';
}
const AC_ESTADO_ROTULO = {
  vazio:'Sem aulas', bloqueado:'Bloqueado', nao_iniciado:'Não iniciado',
  andamento:'Em andamento', concluido:'Concluído', atualizado:'Atualizado'
};

// Resumo da jornada: a fonte única dos números da home E da sidebar.
function acResumo(){
  const aulas = acAulas();
  const obrig = aulas.filter(a=>a.obrigatoria);
  const base = obrig.length ? obrig : aulas;
  const concl = base.filter(a=>acProg(a.id).concluida);
  const pct = base.length ? Math.round((concl.length/base.length)*100) : 0;
  const restanteSeg = base.filter(a=>!acProg(a.id).concluida)
                          .reduce((s,a)=>s+(a.duracao_seg||0),0);
  // Próxima ação: a aula onde parou (se não concluída) > primeira não concluída liberada
  const ult = acState.matricula && acState.matricula.ultima_aula_id;
  const ultAula = ult ? acAula(ult) : null;
  let proxima = (ultAula && !acProg(ultAula.id).concluida && acAulaLiberada(ultAula)) ? ultAula : null;
  if(!proxima) proxima = aulas.find(a=>!acProg(a.id).concluida && acAulaLiberada(a)) || null;
  const moduloAtual = proxima ? (proxima._modulo||null)
                     : (acState.curso && (acState.curso.modulos||[]).slice(-1)[0]) || null;
  return { aulas, total:base.length, concluidas:concl.length, pct, restanteSeg,
           proxima, moduloAtual, ultAula,
           atualizadas: aulas.filter(acAulaAtualizada),
           salvas: aulas.filter(a=>acProg(a.id).salva) };
}

/* ── formatação ── */
function acFmtDur(seg){
  seg = Math.max(0, Math.round(seg||0));
  if(!seg) return '';
  const h = Math.floor(seg/3600), m = Math.round((seg%3600)/60);
  if(h) return m ? `${h} h ${String(m).padStart(2,'0')} min` : `${h} h`;
  return `${Math.max(1,m)} min`;
}
function acFmtTempo(seg){   // 00:00 do player e da transcrição
  seg = Math.max(0, Math.floor(seg||0));
  const m = Math.floor(seg/60), s = seg%60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function acFmtData(iso){
  if(!iso) return '';
  try{
    return new Date(iso).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'});
  }catch(e){ return ''; }
}
function acFmtDataHora(iso){
  if(!iso) return '';
  try{
    const d=new Date(iso), hoje=new Date();
    const mesmoDia = d.toDateString()===hoje.toDateString();
    const hora = d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    return mesmoDia ? `hoje às ${hora}` : `${acFmtData(iso)} às ${hora}`;
  }catch(e){ return ''; }
}

/* ══════════════════════════════════════════════════════════════
   CACHE LOCAL (offline-first: cache síncrono, Supabase é a fonte)
   Todo acesso em try/catch — a quota de ~5MB estoura e não pode derrubar o app.
══════════════════════════════════════════════════════════════ */
function _acCacheSalvar(){
  try{
    if(acState.curso && !acState.curso._demo){
      localStorage.setItem(AC_CACHE_CURSO, JSON.stringify(acState.curso));
    }
    localStorage.setItem(AC_CACHE_PROG, JSON.stringify({
      progresso: acState.progresso, matricula: acState.matricula
    }));
  }catch(e){ /* quota cheia: seguimos sem cache, o banco é a fonte */ }
}
function _acCacheLer(){
  try{
    const c = JSON.parse(localStorage.getItem(AC_CACHE_CURSO)||'null');
    if(c && c.id) acState.curso = c;
  }catch(e){}
  try{
    const p = JSON.parse(localStorage.getItem(AC_CACHE_PROG)||'null');
    if(p){
      if(p.progresso && typeof p.progresso==='object') acState.progresso = p.progresso;
      if(p.matricula) acState.matricula = p.matricula;
    }
  }catch(e){}
}

/* ══════════════════════════════════════════════════════════════
   CAMADA DE DADOS
══════════════════════════════════════════════════════════════ */
function _acSb(){ return (typeof gSupabase==='function') ? gSupabase() : window.sb; }
function _acLuma(){ const sb=_acSb(); return sb ? sb.schema('luma') : null; }
function _acUid(){ const u=(typeof gCurrentUser==='function')?gCurrentUser():null; return u&&u.id||''; }

/**
 * Carrega curso + progresso. NUNCA lança: em falha, cai no cache e, sem cache,
 * na estrutura de demonstração (o módulo tem de abrir mesmo offline).
 * @param {object} opts {silent:true} não re-renderiza no fim
 */
async function acCarregar(opts){
  opts = opts||{};
  const lu = _acLuma();
  acState.erro = '';
  if(!lu){
    // Modo local (sem credenciais): demonstração honesta, marcada na UI.
    if(!acState.curso){ acState.curso = AC_CURSO_DEMO; acState.demo = true; }
    if(!opts.silent) acRender();
    return;
  }
  acState.carregando = !acState.curso;   // só mostra skeleton na primeira carga
  if(acState.carregando && !opts.silent) acRender();
  try{
    // Rascunho não aparece pro franqueado (a RLS já filtra; o .eq é só o caminho
    // rápido). A equipe vê rascunho para poder trabalhar nele.
    const staff = (typeof gIsAdmin==='function') && gIsAdmin();
    let q = lu.from('cursos').select('*').order('ordem').limit(1);
    if(!staff) q = q.eq('publicado', true);
    const { data: cursos, error: eC } = await q;
    if(eC) throw eC;
    const curso = (cursos&&cursos[0]) || null;
    if(!curso){
      // Banco sem formação publicada: demonstração + convite pra equipe semear.
      acState.curso = AC_CURSO_DEMO; acState.demo = true;
      acState.carregando = false;
      if(!opts.silent) acRender();
      return;
    }
    acState.demo = false;

    const [{ data: mods, error: eM }, { data: aulas, error: eA }] = await Promise.all([
      lu.from('curso_modulos').select('*').eq('curso_id', curso.id).order('ordem'),
      lu.from('curso_aulas').select('*').eq('curso_id', curso.id).order('ordem')
    ]);
    if(eM) throw eM;
    if(eA) throw eA;

    curso.modulos = (mods||[]).map(m=>Object.assign({}, m, {
      aulas: (aulas||[]).filter(a=>a.modulo_id===m.id)
    }));
    acState.curso = curso;

    await acCarregarProgresso();
    _acCacheSalvar();
  }catch(e){
    console.warn('[academia] falha ao carregar a formação:', e&&e.message||e);
    if(!acState.curso){
      _acCacheLer();
      if(!acState.curso){ acState.curso = AC_CURSO_DEMO; acState.demo = true; }
      else acState.erro = 'Mostrando a última versão salva no aparelho — não consegui falar com o servidor.';
    }else{
      acState.erro = 'Não consegui atualizar a formação agora. O que está na tela é a última versão salva.';
    }
  }finally{
    acState.carregando = false;
    if(!opts.silent) acRender();
  }
}

// Progresso/matrícula/certificado do usuário logado. Separado do conteúdo porque
// é o que mais muda e o que a volta pra home precisa refrescar sozinho.
async function acCarregarProgresso(){
  const lu = _acLuma(), uid = _acUid(), curso = acState.curso;
  if(!lu || !uid || !curso || curso._demo) return;
  try{
    const [{ data: mat }, { data: prog }, { data: cert }] = await Promise.all([
      lu.from('matriculas').select('*').eq('curso_id', curso.id).eq('user_id', uid).maybeSingle(),
      lu.from('aula_progresso').select('*').eq('curso_id', curso.id).eq('user_id', uid),
      lu.from('certificados').select('*').eq('curso_id', curso.id).eq('user_id', uid)
        .order('emitido_em',{ascending:false}).limit(1)
    ]);
    acState.matricula = mat || null;
    const mapa = {};
    (prog||[]).forEach(p=>{ mapa[p.aula_id] = p; });
    acState.progresso = mapa;
    acState.certificado = (cert&&cert[0]) || null;
    _acCacheSalvar();
  }catch(e){ console.warn('[academia] progresso não carregou:', e&&e.message||e); }
}

/**
 * Grava progresso de uma aula. Local primeiro (síncrono, a UI responde já),
 * banco em seguida — o padrão offline-first da casa.
 * @param {string} aulaId
 * @param {object} campos subconjunto de {posicao_seg,pct_assistido,concluida,salva,...}
 */
async function acSalvarProgresso(aulaId, campos){
  const aula = acAula(aulaId); if(!aula) return;
  const atual = acProg(aulaId);
  // pct e posição NUNCA regridem por gravação de rotina: reabrir a aula e parar
  // no segundo 3 não pode apagar 90% já assistidos. Retrocesso explícito
  // (usuário arrastando) chega por acSalvarPosicao com força.
  const novo = Object.assign({}, atual, campos, {
    aula_id: aulaId, curso_id: acState.curso && acState.curso.id, user_id: _acUid()
  });
  if(campos.pct_assistido != null) novo.pct_assistido = Math.max(atual.pct_assistido||0, campos.pct_assistido);
  if(novo.concluida && !atual.concluida) novo.concluida_em = campos.concluida_em || new Date().toISOString();
  acState.progresso[aulaId] = novo;
  _acCacheSalvar();

  const lu = _acLuma(); if(!lu || !_acUid() || (acState.curso&&acState.curso._demo)) return;
  try{
    const linha = {
      user_id: _acUid(), curso_id: acState.curso.id, aula_id: aulaId,
      posicao_seg: Math.round(novo.posicao_seg||0),
      pct_assistido: Number((novo.pct_assistido||0).toFixed(4)),
      concluida: !!novo.concluida, concluida_em: novo.concluida_em||null,
      salva: !!novo.salva, revisitada_em: novo.revisitada_em||null,
      visto_conteudo_versao: novo.visto_conteudo_versao || (aula.conteudo_versao||1),
      tentativas: novo.tentativas||[]
    };
    const { data, error } = await lu.from('aula_progresso')
      .upsert(linha, { onConflict:'user_id,aula_id' }).select().maybeSingle();
    if(error) throw error;
    if(data) acState.progresso[aulaId] = data;
  }catch(e){
    // Falha de rede não pode virar erro na cara do usuário no meio de uma aula:
    // o valor local já está gravado e a próxima gravação re-tenta.
    console.warn('[academia] progresso não subiu (fica local):', e&&e.message||e);
  }
}

// Matrícula: o "curso iniciado". Idempotente (UNIQUE user+curso no banco).
async function acMatricular(){
  if(acState.matricula) { acTocarAcesso(); return acState.matricula; }
  const agora = new Date().toISOString();
  acState.matricula = { curso_id:acState.curso&&acState.curso.id, user_id:_acUid(),
                        iniciado_em:agora, ultimo_acesso:agora, ultima_aula_id:null, concluido_em:null };
  _acCacheSalvar();
  if(typeof gTrackEvent==='function') gTrackEvent('formacao_iniciada',{curso_id:acState.curso&&acState.curso.id});
  const lu=_acLuma(); if(!lu || !_acUid() || (acState.curso&&acState.curso._demo)) return acState.matricula;
  try{
    const { data, error } = await lu.from('matriculas')
      .upsert({ user_id:_acUid(), curso_id:acState.curso.id, iniciado_em:agora, ultimo_acesso:agora },
              { onConflict:'user_id,curso_id' }).select().maybeSingle();
    if(error) throw error;
    if(data) acState.matricula = data;
  }catch(e){ console.warn('[academia] matrícula não subiu:', e&&e.message||e); }
  return acState.matricula;
}

// Último acesso + última aula (é o que faz "continuar de onde parei" funcionar
// em outro aparelho). Debounce: trocar de aula rápido não vira rajada de PATCH.
let _acTocarTimer = null;
function acTocarAcesso(aulaId){
  if(!acState.matricula) return;
  acState.matricula.ultimo_acesso = new Date().toISOString();
  if(aulaId) acState.matricula.ultima_aula_id = aulaId;
  _acCacheSalvar();
  const lu=_acLuma(); if(!lu || !_acUid() || (acState.curso&&acState.curso._demo)) return;
  clearTimeout(_acTocarTimer);
  _acTocarTimer = setTimeout(()=>{
    lu.from('matriculas').update({
      ultimo_acesso: acState.matricula.ultimo_acesso,
      ultima_aula_id: acState.matricula.ultima_aula_id || null
    }).eq('user_id', _acUid()).eq('curso_id', acState.curso.id)
      .then(({error})=>{ if(error) console.warn('[academia] último acesso:', error.message); });
  }, 1500);
}

/* ── URL do vídeo: bucket privado exige URL assinada; link externo passa direto ──
   Cache em memória por aula: reabrir a mesma aula na sessão não gera assinatura
   nova a cada clique (a de 2h cobre a aula mais longa com folga). */
const _acUrlAssinada = new Map();
async function acVideoUrl(aula){
  if(!aula) return '';
  if(aula.video_url) return aula.video_url;
  if(!aula.video_path) return '';
  if(_acUrlAssinada.has(aula.video_path)) return _acUrlAssinada.get(aula.video_path);
  const sb=_acSb(); if(!sb) return '';
  try{
    const { data, error } = await sb.storage.from('luma-aulas')
      .createSignedUrl(aula.video_path, 7200);
    if(error) throw error;
    const url = (data&&data.signedUrl)||'';
    if(url) _acUrlAssinada.set(aula.video_path, url);
    return url;
  }catch(e){
    console.warn('[academia] URL do vídeo não gerou:', e&&e.message||e);
    return '';
  }
}
// Mesma regra para material no bucket (PDF/planilha). Link externo passa direto.
async function acMaterialUrl(mat){
  if(!mat) return '';
  if(mat.url) return mat.url;
  if(!mat.path) return '';
  const sb=_acSb(); if(!sb) return '';
  try{
    const { data, error } = await sb.storage.from('luma-aulas').createSignedUrl(mat.path, 3600);
    if(error) throw error;
    return (data&&data.signedUrl)||'';
  }catch(e){ return ''; }
}

/* ══════════════════════════════════════════════════════════════
   ROTEAMENTO INTERNO
   Sem router de verdade (é SPA sem build): uma rota em estado + re-render.
══════════════════════════════════════════════════════════════ */
function acGo(rota, arg){
  // Anotação com texto não salvo: proteger antes de sair da aula.
  if(acState.rota==='aula' && rota!=='aula' && typeof acAulaTemRascunho==='function' && acAulaTemRascunho()){
    if(!confirmDescartar()) return;
  }
  if(rota==='gestao' && !(typeof gIsAdmin==='function' && gIsAdmin())){
    gToast('Esta área é da equipe Delivery Much.','error'); return;
  }
  // Saindo da aula: acRender troca o innerHTML do #ac-root e o <video> sai do DOM,
  // mas segue vivo na referencia do player -- em varios navegadores o AUDIO continua
  // tocando e o timer de progresso ainda grava numa aula desmontada. Desmonta antes.
  if(acState.rota==='aula' && rota!=='aula' && typeof acAulaDesmontar==='function') acAulaDesmontar();
  const anterior = acState.rota;
  acState.rota = rota;
  if(rota==='aula' && arg) acState.aulaId = arg;
  if(rota!=='aula') acState.aulaId = acState.aulaId; // preserva pra "voltar à aula"
  acRender({ mudouRota: anterior!==rota });

  // Diálogo próprio (nunca confirm nativo) é assíncrono; aqui o guard precisa ser
  // síncrono pra poder abortar a navegação, então usamos uma checagem barata.
  function confirmDescartar(){
    // acAulaDescartarRascunho salva o texto pendente e devolve true — em vez de
    // perguntar e perder, PRESERVAMOS a anotação como rascunho local.
    return acAulaGuardarRascunho();
  }
}
// Volta pra jornada (usado por breadcrumb, botão e Esc na aula)
function acVoltarHome(){ acGo('home'); }

/* ══════════════════════════════════════════════════════════════
   RENDER — despacha pra view da rota
══════════════════════════════════════════════════════════════ */
function acRender(opts){
  opts=opts||{};
  const root = document.getElementById('ac-root'); if(!root) return;
  document.body.classList.toggle('ac-em-aula', acState.rota==='aula');
  if(acState.carregando && !acState.curso){ root.innerHTML = acSkeletonHome(); return; }
  if(acState.rota==='aula'   && typeof acRenderAula==='function'){ acRenderAula(root, opts); return; }
  if(acState.rota==='gestao' && typeof acRenderGestao==='function'){ acRenderGestao(root); return; }
  if(acState.rota==='certificado' && typeof acRenderCertificado==='function'){ acRenderCertificado(root); return; }
  acRenderHome(root);
}

/* ── Skeleton da home (loading coerente com o layout final, não spinner solto) ── */
function acSkeletonHome(){
  return `<div class="ac-home" aria-busy="true">
    <div class="ac-sk ac-sk-hero"></div>
    <div class="ac-home-grid">
      <div><div class="ac-sk ac-sk-bloco"></div><div class="ac-sk ac-sk-bloco"></div></div>
      <div><div class="ac-sk ac-sk-lado"></div></div>
    </div>
    <span class="ac-sr">Carregando a sua formação…</span>
  </div>`;
}

/* ══════════════════════════════════════════════════════════════
   HOME DA JORNADA — painel pessoal do franqueado (não grade de cursos)
══════════════════════════════════════════════════════════════ */
function acRenderHome(root){
  root = root || document.getElementById('ac-root'); if(!root) return;
  const c = acState.curso;
  if(!c){ root.innerHTML = acHomeVazia(); return; }

  const r = acResumo();
  const concluiu = acConcluiu();
  const iniciou = acIniciou();

  root.innerHTML = `<div class="ac-home">
    ${acHomeAvisos()}
    ${acHomeCabecalho(c, r, iniciou, concluiu)}
    <div class="ac-home-grid">
      <div class="ac-home-col">
        ${r.proxima && iniciou ? acHomeContinuar(r.proxima) : ''}
        ${acHomeMapa(c, r)}
      </div>
      <aside class="ac-home-col ac-home-lado">
        ${acHomeProgresso(r, concluiu)}
        ${acHomeCertificado(concluiu)}
        ${acHomeRecentes(r)}
        ${acHomeAjuda()}
      </aside>
    </div>
  </div>`;
  // A ESTRUTURA já está na tela (o innerHTML acima); a cascata só escalona a
  // entrada dos blocos de conteúdo. Nunca o contrário — layout que entra animado
  // é layout que demora a existir.
  if(typeof acCascata==='function') acCascata(root, '[data-ac-entra]');
  // Progresso: o HTML foi pintado com o valor ANTERIOR de propósito; agora
  // levamos até o atual, e é esse percurso que comunica "você avançou".
  acAnimaProgressoHome(r, concluiu);
  if(typeof gTrackEvent==='function') gTrackEvent('jornada_aberta',{ curso_id:c.id, pct:r.pct });
}

// Faixas de aviso: demonstração, erro de carga, preview da equipe.
function acHomeAvisos(){
  let out = '';
  if(acState.demo){
    const staff = (typeof gIsAdmin==='function') && gIsAdmin();
    out += `<div class="ac-aviso ac-aviso-info" role="status">
      ${acIco('alerta')}
      <div><strong>Conteúdo de demonstração.</strong>
      <span>A estrutura abaixo é um exemplo para você conhecer a Implementação — ainda não é o conteúdo oficial da Delivery Much.</span></div>
      ${staff?`<button type="button" class="ac-btn ac-btn-ghost" onclick="acGo('gestao')">Publicar a formação real</button>`:''}
    </div>`;
  }
  if(acState.erro){
    out += `<div class="ac-aviso ac-aviso-erro" role="alert">${acIco('alerta')}
      <div><span>${gEsc(acState.erro)}</span></div>
      <button type="button" class="ac-btn ac-btn-ghost" onclick="acCarregar()">Tentar de novo</button></div>`;
  }
  return out;
}

function acHomeCabecalho(c, r, iniciou, concluiu){
  const saudacao = (typeof fHomeGreeting==='function') ? fHomeGreeting() : 'Olá';
  // CTA muda com a situação (é a única ação primária da tela)
  let ctaLabel, ctaAcao, orienta;
  if(concluiu){
    ctaLabel = 'Revisar formação';
    ctaAcao  = r.proxima ? `acGo('aula','${r.proxima.id}')` : (r.aulas[0]?`acGo('aula','${r.aulas[0].id}')`:`acGo('home')`);
    orienta  = 'Você concluiu a formação. O conteúdo continua aqui sempre que precisar rever algo.';
  }else if(!iniciou){
    ctaLabel = 'Começar jornada';
    ctaAcao  = 'acIniciarJornada()';
    orienta  = 'Esta é a sua formação como franqueado. Ela acompanha a implementação da sua cidade, no seu ritmo.';
  }else{
    ctaLabel = 'Continuar de onde parei';
    ctaAcao  = r.proxima ? `acGo('aula','${r.proxima.id}')` : 'acGo(\'home\')';
    orienta  = r.moduloAtual ? `Você está no módulo ${r.moduloAtual.nome}.` : 'Continue de onde parou.';
  }
  const estado = concluiu ? 'Formação concluída' : (iniciou ? `${r.pct}% concluído` : 'Não iniciada');
  return `<header class="ac-hero${concluiu?' is-concluida':''}">
    <div class="ac-hero-txt">
      <span class="ac-hero-eyebrow">${acIco('cap')} Implementação Delivery Much</span>
      <p class="ac-hero-saudacao">${saudacao}</p>
      <h1 class="ac-hero-titulo">${gEsc(c.nome)}</h1>
      <p class="ac-hero-sub">${gEsc(orienta)}</p>
      <div class="ac-hero-acoes">
        <button type="button" class="ac-btn ac-btn-primario" onclick="${ctaAcao}">
          ${ctaLabel} ${acIco('seta')}
        </button>
        ${concluiu?`<button type="button" class="ac-btn ac-btn-ghost" onclick="acGo('certificado')">${acIco('medal')} Ver certificado</button>`:''}
        ${(typeof gIsAdmin==='function'&&gIsAdmin())?`<button type="button" class="ac-btn ac-btn-ghost" onclick="acGo('gestao')">${acIco('cfg')} Gerenciar conteúdo</button>`:''}
      </div>
    </div>
    <div class="ac-hero-anel" role="img" aria-label="${estado}">
      ${acAnelProgresso(r.pct, concluiu)}
      <span class="ac-hero-anel-rot">${gEsc(estado)}</span>
    </div>
  </header>`;
}

// Anel de progresso em SVG. Estado NÃO depende só de cor: o número está dentro
// e o rótulo textual fica ao lado (21 — acessibilidade).
const AC_ANEL_R = 46;
const AC_ANEL_C = 2*Math.PI*AC_ANEL_R;
function acAnelProgresso(pct, concluiu){
  // Pinta no valor ANTERIOR (na 1ª visita, no próprio valor): acAnimaProgressoHome
  // leva daqui até o atual. Escrever o valor final aqui era o motivo de o anel
  // aparecer pronto, sem nunca animar.
  const de = (typeof acProgLembrado==='function') ? acProgLembrado('formacao', pct) : pct;
  const off = AC_ANEL_C * (1 - Math.max(0,Math.min(100,de))/100);
  return `<svg class="ac-anel" viewBox="0 0 110 110" aria-hidden="true">
    <circle class="ac-anel-trilho" cx="55" cy="55" r="${AC_ANEL_R}"/>
    <circle class="ac-anel-fill${concluiu?' is-ok':''}" id="ac-anel-fill" cx="55" cy="55" r="${AC_ANEL_R}"
            style="stroke-dasharray:${AC_ANEL_C.toFixed(1)};stroke-dashoffset:${off.toFixed(1)}"/>
    <text class="ac-anel-num" id="ac-anel-num" x="55" y="60" text-anchor="middle">${de}%</text>
  </svg>`;
}

/**
 * Leva anel, barra grande e número até o valor atual depois do render.
 * Também guarda o valor pra próxima renderização saber de onde partir.
 */
function acAnimaProgressoHome(r, concluiu){
  if(typeof acAnimaAnel!=='function') return;   // motion.js ausente: nada quebra
  const de = acProgLembrado('formacao', r.pct);
  acAnimaAnel(document.getElementById('ac-anel-fill'), r.pct, AC_ANEL_C);
  acAnimaNumero(document.getElementById('ac-anel-num'), de, r.pct);
  acAnimaNumero(document.getElementById('ac-prog-num'), de, r.pct, n=>Math.round(n));
  acAnimaBarra(document.getElementById('ac-prog-barra'), r.pct);
  // Barras dos módulos: cada uma parte do seu próprio valor anterior.
  (acState.curso&&acState.curso.modulos||[]).forEach(m=>{
    const aulas = m.aulas||[];
    if(!aulas.length) return;
    const pctMod = Math.round(aulas.filter(a=>acProg(a.id).concluida).length/aulas.length*100);
    acAnimaBarra(document.getElementById('ac-barra-mod-'+m.id), pctMod);
    acProgGuardar('mod:'+m.id, pctMod);
  });
  acProgGuardar('formacao', r.pct);
}

function acHomeContinuar(aula){
  const p = acProg(aula.id);
  const dur = aula.duracao_seg||0;
  const restaSeg = dur ? Math.max(0, dur - (p.posicao_seg||0)) : 0;
  const pctVideo = dur ? Math.round(((p.posicao_seg||0)/dur)*100) : 0;
  const comecou = (p.posicao_seg||0) > 5;
  return `<section class="ac-bloco ac-continuar" data-ac-entra aria-labelledby="ac-cont-t">
    <h2 class="ac-bloco-titulo" id="ac-cont-t">Continue estudando</h2>
    <button type="button" class="ac-cont-card" onclick="acGo('aula','${aula.id}')"
            aria-label="${comecou?'Continuar':'Abrir'} a aula ${gEsc(aula.titulo)}">
      <span class="ac-cont-th">${acIco('play')}</span>
      <span class="ac-cont-info">
        <span class="ac-cont-mod">${gEsc((aula._modulo&&aula._modulo.nome)||'')}</span>
        <span class="ac-cont-nome">${gEsc(aula.titulo)}</span>
        <span class="ac-cont-meta">
          ${comecou?`parou em ${acFmtTempo(p.posicao_seg)}`:'ainda não começou'}
          ${dur?` · ${comecou?`faltam ${acFmtDur(restaSeg)}`:acFmtDur(dur)}`:''}
        </span>
        ${dur?`<span class="ac-barra" role="img" aria-label="${pctVideo}% do vídeo assistido"><i style="width:${pctVideo}%"></i></span>`:''}
      </span>
      <span class="ac-cont-go">${acIco('seta')}</span>
    </button>
  </section>`;
}

// MAPA DA JORNADA — sequência de etapas, não tabuleiro de videogame.
function acHomeMapa(c, r){
  const mods = (c.modulos||[]);
  if(!mods.length){
    return `<section class="ac-bloco"><h2 class="ac-bloco-titulo">Mapa da jornada</h2>
      ${acVazio('cap','Nenhum módulo publicado ainda','Quando a equipe Delivery Much publicar o conteúdo, ele aparece aqui.')}</section>`;
  }
  const atualId = r.proxima ? (r.proxima._modulo&&r.proxima._modulo.id) : null;
  return `<section class="ac-bloco" data-ac-entra aria-labelledby="ac-mapa-t">
    <h2 class="ac-bloco-titulo" id="ac-mapa-t">Mapa da jornada</h2>
    <ol class="ac-mapa">
      ${mods.map((m,i)=>acMapaItem(m,i,atualId===m.id)).join('')}
    </ol>
  </section>`;
}
function acMapaItem(m, i, ehAtual){
  const est = acModuloEstado(m);
  const aulas = m.aulas||[];
  const feitas = aulas.filter(a=>acProg(a.id).concluida).length;
  const dur = aulas.reduce((s,a)=>s+(a.duracao_seg||0),0);
  const bloq = est==='bloqueado';
  const prereq = bloq ? acModulo(m.prereq_modulo_id) : null;
  const primeira = aulas.find(a=>!acProg(a.id).concluida) || aulas[0];
  const abrir = (!bloq && primeira) ? `acGo('aula','${primeira.id}')` : '';
  // Marcador de estado com FORMA + texto, não só cor (acessibilidade).
  const marca = est==='concluido' ? acIco('check')
              : est==='atualizado' ? acIco('novo')
              : bloq ? acIco('lock')
              : `<span class="ac-mapa-num">${i+1}</span>`;
  return `<li class="ac-mapa-item is-${est}${ehAtual?' is-atual':''}">
    <span class="ac-mapa-marca" aria-hidden="true">${marca}</span>
    <${bloq?'div':'button type="button"'} class="ac-mapa-card"${abrir?` onclick="${abrir}"`:''}
      ${bloq?'':`aria-label="Abrir módulo ${gEsc(m.nome)}"`}>
      <span class="ac-mapa-topo">
        <span class="ac-mapa-nome">${gEsc(m.nome)}</span>
        <span class="ac-tag ac-tag-${est}">${AC_ESTADO_ROTULO[est]||''}</span>
        ${ehAtual?'<span class="ac-tag ac-tag-atual">Você está aqui</span>':''}
      </span>
      ${m.descricao?`<span class="ac-mapa-desc">${gEsc(m.descricao)}</span>`:''}
      <span class="ac-mapa-meta">
        ${aulas.length} ${aulas.length===1?'aula':'aulas'}${dur?` · ${acFmtDur(dur)}`:''}
        ${aulas.length?` · ${feitas}/${aulas.length} concluída${feitas===1?'':'s'}`:''}
      </span>
      ${bloq&&prereq?`<span class="ac-mapa-bloq">${acIco('lock')} Conclua ${gEsc(prereq.nome)} para liberar</span>`:''}
      ${aulas.length?`<span class="ac-barra ac-barra-sm${est==='concluido'?' is-ok':''}" id="ac-barra-mod-${m.id}" role="img" aria-label="${Math.round(feitas/aulas.length*100)}% do módulo concluído"><i style="width:${acProgLembrado('mod:'+m.id, Math.round(feitas/aulas.length*100))}%"></i></span>`:''}
    </${bloq?'div':'button'}>
  </li>`;
}

function acHomeProgresso(r, concluiu){
  const linhas = [
    ['Aulas concluídas', `${r.concluidas} de ${r.total}`],
    r.moduloAtual ? [concluiu?'Último módulo':'Módulo atual', r.moduloAtual.nome] : null,
    (!concluiu && r.restanteSeg) ? ['Tempo restante estimado', acFmtDur(r.restanteSeg)] : null,
    (acState.matricula&&acState.matricula.ultimo_acesso) ? ['Última atividade', acFmtDataHora(acState.matricula.ultimo_acesso)] : null,
    (acState.curso&&acState.curso.carga_horaria_min) ? ['Carga horária', acFmtDur(acState.curso.carga_horaria_min*60)] : null
  ].filter(Boolean);
  return `<section class="ac-bloco ac-lado-bloco" data-ac-entra aria-labelledby="ac-prog-t">
    <h2 class="ac-bloco-titulo" id="ac-prog-t">Seu progresso</h2>
    <div class="ac-prog-topo">
      <span class="ac-prog-pct"><span id="ac-prog-num">${acProgLembrado('formacao', r.pct)}</span><small>%</small></span>
      <span class="ac-prog-rot">${concluiu?'formação concluída':'da formação'}</span>
    </div>
    <span class="ac-barra ac-barra-lg" id="ac-prog-barra" role="img" aria-label="${r.pct}% da formação concluída"><i style="width:${acProgLembrado('formacao', r.pct)}%"></i></span>
    <dl class="ac-defs">
      ${linhas.map(([k,v])=>`<div><dt>${gEsc(k)}</dt><dd>${gEsc(v)}</dd></div>`).join('')}
    </dl>
    ${r.proxima?`<p class="ac-prox">Próxima ação: <button type="button" class="ac-link" onclick="acGo('aula','${r.proxima.id}')">${gEsc(r.proxima.titulo)}</button></p>`:''}
  </section>`;
}

function acHomeCertificado(concluiu){
  const cert = acState.certificado;
  if(concluiu || cert){
    const temVideo = (typeof acVideoCeoDisponivel==='function') && acVideoCeoDisponivel();
    const videoNovo = (typeof acVideoCeoNovo==='function') && acVideoCeoNovo();
    const jaViu = !!(acState.matricula && acState.matricula.video_visto_em);
    return `<section class="ac-bloco ac-lado-bloco ac-cert-card is-ok" data-ac-entra aria-labelledby="ac-cert-t">
      <h2 class="ac-bloco-titulo" id="ac-cert-t">Certificado</h2>
      <div class="ac-cert-selo">${acIco('medal')}</div>
      <p class="ac-cert-txt">Formação concluída${(acState.matricula&&acState.matricula.concluido_em)?` em ${acFmtData(acState.matricula.concluido_em)}`:''}.</p>
      ${cert?`<p class="ac-cert-cod">Código de validação <code>${gEsc(cert.codigo)}</code></p>`:''}
      <button type="button" class="ac-btn ac-btn-primario ac-btn-bloco" onclick="acGo('certificado')">
        ${cert?'Ver e baixar certificado':'Emitir certificado'}
      </button>
      ${temVideo?`<button type="button" class="ac-link ac-cert-link" onclick="acVerVideoCeos()">
        ${videoNovo&&jaViu?'Nova mensagem da liderança':(jaViu?'Rever a mensagem dos CEOs':'Ver a mensagem dos CEOs')}
        ${videoNovo?'<span class="ac-tag ac-tag-novo">Novo</span>':''}</button>`:''}
      ${cert?`<button type="button" class="ac-link ac-cert-link" onclick="acReverConclusao()">Rever a conclusão</button>`:''}
    </section>`;
  }
  const r = acResumo();
  const faltam = Math.max(0, r.total - r.concluidas);
  return `<section class="ac-bloco ac-lado-bloco ac-cert-card" data-ac-entra aria-labelledby="ac-cert-t">
    <h2 class="ac-bloco-titulo" id="ac-cert-t">Certificado</h2>
    <div class="ac-cert-selo is-lock">${acIco('lock')}</div>
    <p class="ac-cert-txt">Seu certificado é liberado quando você concluir as aulas obrigatórias da formação.</p>
    <p class="ac-cert-req">${faltam?`Faltam ${faltam} aula${faltam===1?'':'s'} obrigatória${faltam===1?'':'s'}.`:'Tudo pronto — confira a conclusão.'}</p>
    ${!faltam?`<button type="button" class="ac-btn ac-btn-primario ac-btn-bloco" onclick="acGo('certificado')">Concluir formação</button>`:''}
  </section>`;
}

// Materiais recentes / salvos / atualizações — só aparece quando há o que mostrar.
function acHomeRecentes(r){
  const notas = [];
  Object.keys(acState.notas||{}).forEach(aid=>{
    (acState.notas[aid]||[]).forEach(n=>notas.push(Object.assign({}, n, {_aula:acAula(aid)})));
  });
  notas.sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
  const itens = [];
  r.salvas.slice(0,3).forEach(a=>itens.push(
    `<li><button type="button" class="ac-rec" onclick="acGo('aula','${a.id}')">
      ${acIco('marca')}<span><strong>${gEsc(a.titulo)}</strong><small>salva para revisar</small></span></button></li>`));
  r.atualizadas.slice(0,3).forEach(a=>itens.push(
    `<li><button type="button" class="ac-rec" onclick="acGo('aula','${a.id}')">
      ${acIco('novo')}<span><strong>${gEsc(a.titulo)}</strong><small>conteúdo atualizado</small></span></button></li>`));
  notas.slice(0,3).forEach(n=>itens.push(
    `<li><button type="button" class="ac-rec" onclick="acGo('aula','${n.aula_id}')">
      ${acIco('nota')}<span><strong>${gEsc(String(n.texto||'').slice(0,48))}${String(n.texto||'').length>48?'…':''}</strong>
      <small>anotação${n._aula?` em ${gEsc(n._aula.titulo)}`:''}</small></span></button></li>`));
  if(!itens.length) return '';
  return `<section class="ac-bloco ac-lado-bloco" data-ac-entra aria-labelledby="ac-rec-t">
    <h2 class="ac-bloco-titulo" id="ac-rec-t">Retomar</h2>
    <ul class="ac-rec-lista">${itens.slice(0,6).join('')}</ul>
  </section>`;
}

function acHomeAjuda(){
  return `<section class="ac-bloco ac-lado-bloco ac-ajuda" data-ac-entra>
    <h2 class="ac-bloco-titulo">Onde pedir ajuda</h2>
    <p class="ac-ajuda-txt">Dentro de cada aula, o agente educacional responde dúvidas sobre aquele conteúdo. Para decisões oficiais da rede, fale com a equipe Delivery Much.</p>
    <div class="ac-ajuda-bot">${acIco('bot')} <span>Agente educacional disponível nas aulas</span></div>
  </section>`;
}

/* ── Estados vazios reutilizáveis (todo vazio orienta a próxima ação) ── */
function acVazio(ico, titulo, texto, cta){
  return `<div class="ac-vazio">
    <span class="ac-vazio-ico">${acIco(ico)}</span>
    <strong>${gEsc(titulo)}</strong>
    ${texto?`<span>${gEsc(texto)}</span>`:''}
    ${cta||''}
  </div>`;
}
function acHomeVazia(){
  const staff = (typeof gIsAdmin==='function') && gIsAdmin();
  return `<div class="ac-home">${acVazio('cap','Nenhuma formação disponível ainda',
    'Assim que a equipe Delivery Much publicar a formação, ela aparece aqui.',
    staff?`<button type="button" class="ac-btn ac-btn-primario" onclick="acGo('gestao')">Criar a formação</button>`:'')}</div>`;
}

/* ── Iniciar a jornada (CTA de primeiro acesso) ── */
async function acIniciarJornada(){
  await acMatricular();
  const r = acResumo();
  const primeira = r.proxima || r.aulas[0];
  if(primeira) acGo('aula', primeira.id);
  else { acRender(); gToast('A formação ainda não tem aulas publicadas'); }
}

/* ══════════════════════════════════════════════════════════════
   BOOT DO MÓDULO — chamado por setMode('academia') na primeira entrada
══════════════════════════════════════════════════════════════ */
let _acIniciado = false;
function acInit(){
  if(_acIniciado){
    // Reentrada: refresca só o progresso (conteúdo muda pouco, progresso muda sempre)
    Promise.resolve(acCarregarProgresso()).then(()=>{ if(acState.rota==='home') acRender(); });
    return;
  }
  _acIniciado = true;
  _acCacheLer();                 // pinta rápido com o cache
  if(acState.curso) acRender();
  // Depois do sync (não do cache): a experiência de conclusão só abre com dado
  // do SERVIDOR. Cobre quem concluiu e fechou o navegador antes de ver a splash.
  Promise.resolve(acCarregar()).then(()=>{
    if(typeof acConclusaoTalvezAbrir==='function') acConclusaoTalvezAbrir();
  });
}
