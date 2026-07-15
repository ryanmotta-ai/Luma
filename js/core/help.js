/**
 * js/core/help.js
 *
 * gOpenHelp, gCloseHelp — modal de ajuda com trilha de aprendizado e catálogo livre.
 * Depende de: tutorial/engine.js (tutOpen), core/auth.js (gCurrentUser)
 */

/* ══ CATÁLOGO DA CENTRAL DE AJUDA ══ */

const G_HELP_CATALOG=[
  // Franqueado
  {id:'primeira-arte', cat:'franqueado', icon:'▶️', title:'Criar minha primeira arte', sub:'Campanha → material → chat → download'},
  {id:'qual-formato', cat:'franqueado', icon:'📐', title:'Qual formato escolher', sub:'Story, Feed ou Post wide'},
  {id:'editar-arte', cat:'franqueado', icon:'✏️', title:'Editar uma arte que já fiz', sub:'Aba Minhas artes, filtros e edição'},
  {id:'enviar-foto', cat:'franqueado', icon:'📷', title:'Enviar a foto do produto', sub:'Upload, trocar e dicas de qualidade'},
  {id:'gerar-varios', cat:'franqueado', icon:'⚡', title:'Gerar várias artes (CSV)', sub:'Planilha → grade → baixar todos'},
  {id:'regras-marca', cat:'franqueado', icon:'💎', title:'Regras da marca DM', sub:'Cores, fontes e usos permitidos'},
  // Designer (Studio)
  {id:'studio-tour', cat:'designer', icon:'🧭', title:'Conheça o Estúdio', sub:'Toolbar, canvas, painéis e topbar'},
  {id:'criar-elementos', cat:'designer', icon:'➕', title:'Textos, formas e molduras', sub:'Ferramentas T, R, F e M'},
  {id:'editar-elementos', cat:'designer', icon:'🔲', title:'Selecionar, mover e organizar', sub:'Alinhar, agrupar, snap e réguas'},
  {id:'pintura', cat:'designer', icon:'🖌️', title:'Pincel e pintura', sub:'Presets, borracha, conta-gotas, carimbo'},
  {id:'variaveis', cat:'designer', icon:'🔧', title:'Variáveis', sub:'Aba Dados, campos, inserir no texto'},
  {id:'vinculos-regras', cat:'designer', icon:'⚙️', title:'Vínculos e regras condicionais', sub:'Cor/visibilidade por variável'},
  {id:'simular', cat:'designer', icon:'👁️', title:'Simular dados reais', sub:'Veja a arte como o franqueado gera'},
  {id:'pastas-capas', cat:'designer', icon:'📁', title:'Pastas e capas', sub:'Organização, capa e campanha'},
  {id:'blocos-fontes', cat:'designer', icon:'🧩', title:'Blocos e fontes da marca', sub:'Snippets reutilizáveis e upload de fontes'},
  {id:'publicar', cat:'designer', icon:'🚀', title:'Publicar para os franqueados', sub:'Permissões, validade e instruções'},
  {id:'exportar', cat:'designer', icon:'⬇️', title:'Preview e exportação', sub:'PNG/JPG em escala e SVG'},
  {id:'smart-resize', cat:'designer', icon:'↔️', title:'Smart Resize multi-formato', sub:'Story, Feed e Wide sem redesenhar'},
  {id:'importar-psd', cat:'designer', icon:'<span style="background:#31A8FF;color:#fff;border-radius:2px;font-size:8px;padding:1px 3px;font-weight:900;line-height:1.2">PSD</span>', title:'Importar PSD do Photoshop', sub:'Camadas, modos, variáveis e confirmar'},
  {id:'atalhos', cat:'designer', icon:'⌨️', title:'Atalhos do teclado', sub:'Trabalhe mais rápido no Estúdio'},
];

/* ══ TRILHAS DE APRENDIZADO ══ */

const G_HELP_TRAILS = {
  designer: [
    'studio-tour','criar-elementos','editar-elementos','pintura',
    'variaveis','vinculos-regras','simular',
    'pastas-capas','blocos-fontes','publicar',
    'exportar','smart-resize','importar-psd','atalhos'
  ],
  franqueado: [
    'primeira-arte','qual-formato','enviar-foto',
    'editar-arte','gerar-varios','regras-marca'
  ],
};

const G_HELP_KEYWORDS={
  'primeira-arte':['campanha','material','gerar','download'],
  'qual-formato':['story','feed','wide','post','formato'],
  'editar-arte':['historico','minhas artes','rascunho','duplicar'],
  'enviar-foto':['foto','imagem','upload','png','jpg','20mb'],
  'gerar-varios':['csv','planilha','lote','sheets','baixar todos'],
  'variaveis':['campo','dados','token','texto','preco'],
  'vinculos-regras':['regra','vinculo','hide','condicional','shrink'],
  'simular':['simulacao','preview','dados reais','overflow'],
  'publicar':['publicacao','template','validade','permissao'],
  'atalhos':['teclado','ctrl','zoom','desfazer','refazer'],
  'importar-psd':['psd','svg','photoshop','importar'],
};

const G_HELP_ARTICLES=[
  {id:'ajuda-pdf',cat:'franqueado',title:'Baixar a arte em PDF',sub:'Onde encontrar o download em PDF',keywords:['pdf','baixar','imprimir','download'],body:'Depois de gerar a arte, use Baixar PDF na tela final. Se a arte usar uma imagem por URL e a geracao falhar, confirme que a imagem esta publica.'},
  {id:'ajuda-csv',cat:'franqueado',title:'Gerar artes por planilha',sub:'CSV Modelo, envio e download em lote',keywords:['csv','planilha','lote','sheets','excel'],body:'Abra Gerar varios, baixe o CSV Modelo, preencha uma linha por produto e envie a planilha. Ao revisar a grade, use Baixar todos para gerar o ZIP.'},
  {id:'ajuda-upload',cat:'franqueado',title:'Enviar foto do produto',sub:'Formatos e limite de tamanho',keywords:['foto','imagem','upload','20mb','png','jpg'],body:'Envie imagens PNG ou JPG de ate 20 MB. Para imagens por URL, o endereco precisa ser publico para que a arte possa ser gerada.'},
];

const G_HELP_CONTEXTS={
  franqueado:['primeira-arte','gerar-varios','editar-arte'],
  designer:['studio-tour','variaveis','simular'],
  camadas:['editar-elementos','pintura','atalhos'],
  dados:['variaveis','vinculos-regras','simular'],
  campaigns:['pastas-capas','publicar','importar-psd'],
  linter:['publicar','editar-elementos','atalhos'],
};

let gHelpLastTrigger=null;
let gHelpPreviousOverflow='';
let gHelpTopicQuery='';

function gHelpSetTriggerState(isOpen){
  document.querySelectorAll('[data-help-trigger]').forEach(trigger=>{
    trigger.setAttribute('aria-expanded',isOpen?'true':'false');
  });
}

function gHelpFocusableElements(){
  const modal=document.getElementById('g-help-modal');
  if(!modal)return [];
  return [...modal.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter(el=>el.offsetParent!==null);
}

/* ══ HELPERS ══ */

function gHelpTutDone(){
  try{ return JSON.parse(localStorage.getItem('yngs_tutorials_done')||'[]'); }catch(e){ return []; }
}
function gHelpTutDuration(id){
  const t=(typeof TUTORIALS!=='undefined')?TUTORIALS[id]:null;
  if(!t||!t.scenes)return '';
  const ms=t.scenes.reduce((s,sc)=>s+(sc.duration||t.duration||4000),0);
  const sec=Math.round(ms/1000);
  return sec>=60 ? `~${Math.round(sec/60)} min` : `~${sec}s`;
}
function gHelpIsFirstVisit(){
  try{ return !localStorage.getItem('yngs_help_visited'); }catch(e){ return true; }
}
function gHelpMarkVisited(){
  try{ localStorage.setItem('yngs_help_visited','1'); }catch(e){}
}
function gHelpCurrentTrail(){
  const u=(typeof gCurrentUser==='function')?gCurrentUser():null;
  const role=u?u.role:'designer';
  return role==='franqueado' ? G_HELP_TRAILS.franqueado : G_HELP_TRAILS.designer;
}

function gHelpAllItems(){
  return G_HELP_CATALOG.concat(G_HELP_ARTICLES);
}
function gHelpFindItem(id){
  return gHelpAllItems().find(item=>item.id===id);
}
function gHelpItemMatches(item,query){
  const haystack=[item.title,item.sub,item.body].concat(G_HELP_KEYWORDS[item.id]||[],item.keywords||[]).join(' ').toLowerCase();
  return haystack.includes(query);
}
function gHelpContextIds(){
  const isDesigner=document.body.classList.contains('mode-designer');
  if(!isDesigner)return G_HELP_CONTEXTS.franqueado;
  const active=document.querySelector('.rpanel-tab.active')?.dataset.panel;
  return G_HELP_CONTEXTS[active]||G_HELP_CONTEXTS.designer;
}
function gHelpRenderContext(){
  const items=gHelpContextIds().map(gHelpFindItem).filter(Boolean);
  if(!items.length)return '';
  return `<section class="g-help-context" aria-labelledby="g-help-context-title">
    <div class="g-help-context-head">
      <span id="g-help-context-title">Nesta tela</span>
      <span>${document.body.classList.contains('mode-designer')?'Estudio':'Franqueado'}</span>
    </div>
    <div class="g-help-context-list">
      ${items.map(item=>`<button type="button" class="g-help-context-item" onclick="gHelpOpenItem('${item.id}')">${item.title}</button>`).join('')}
    </div>
  </section>`;
}
function gHelpRenderOnboarding(){
  const isFranqueado=(typeof gIsAdmin==='function')&&!gIsAdmin();
  if(!isFranqueado)return '';
  let progress={choseMaterial:false,downloadedPng:false,triedCsv:false};
  try{ progress=Object.assign(progress,JSON.parse(localStorage.getItem('luma_onboarding_franqueado')||'{}')); }catch(e){}
  const steps=[
    ['choseMaterial','Escolher material'],
    ['downloadedPng','Baixar arte'],
    ['triedCsv','Criar em lote'],
  ];
  const done=steps.filter(([key])=>progress[key]).length;
  if(done===steps.length)return '';
  return `<section class="g-help-onboarding" aria-labelledby="g-help-onboarding-title">
    <div class="g-help-context-head"><span id="g-help-onboarding-title">Primeiros passos</span><span>${done}/${steps.length}</span></div>
    <div class="g-help-onboarding-track"><span style="width:${Math.round(done/steps.length*100)}%"></span></div>
    <div class="g-help-onboarding-steps">${steps.map(([key,label])=>`<span class="${progress[key]?'done':''}">${progress[key]?'Concluido':'A fazer'}: ${label}</span>`).join('')}</div>
  </section>`;
}

/* ══ TRILHA ══ */

function gHelpRenderTrail(){
  const wrap=document.getElementById('g-help-trail-content'); if(!wrap)return;
  const trail=gHelpCurrentTrail();
  const done=gHelpTutDone();
  const firstVisit=gHelpIsFirstVisit();

  const doneCount=trail.filter(id=>done.includes(id)).length;
  const total=trail.length;
  const pct=Math.round(doneCount/total*100);
  const currentIdx=trail.findIndex(id=>!done.includes(id));
  const allDone=currentIdx===-1;

  // Barra de progresso
  const progressHtml=`
    <div class="g-help-trail-prog">
      <div class="g-help-prog-labels">
        <span class="g-help-prog-label">${allDone?'Trilha concluída 🎉':`${doneCount} de ${total} aulas`}</span>
        <span class="g-help-prog-pct">${pct}%</span>
      </div>
      <div class="g-help-prog-track"><div class="g-help-prog-fill" style="width:${pct}%"></div></div>
    </div>`;

  // CTA contextual
  let ctaHtml='';
  if(firstVisit && doneCount===0){
    ctaHtml=`
      <div class="g-help-trail-welcome">
        <div class="g-help-trail-welcome-emoji">👋</div>
        <div class="g-help-trail-welcome-title">Bem-vindo ao Luma!</div>
        <div class="g-help-trail-welcome-sub">Esta trilha guia você do zero até publicar seu primeiro template. Assista na ordem ou pule para o que precisar.</div>
        <button class="g-help-trail-cta" onclick="gHelpMarkVisited();gHelpPlay('${trail[0]}')">Começar agora →</button>
      </div>`;
  } else if(!allDone){
    const nextId=trail[currentIdx];
    const nextCard=G_HELP_CATALOG.find(t=>t.id===nextId);
    if(nextCard){
      const dur=gHelpTutDuration(nextId);
      ctaHtml=`
      <button type="button" class="g-help-trail-next" onclick="gHelpMarkVisited();gHelpPlay('${nextId}')">
          <span class="g-help-trail-next-label">Continue de onde parou · aula ${currentIdx+1}</span>
          <div class="g-help-trail-next-row">
            <span class="g-help-tut-icon des" style="width:32px;height:32px;font-size:15px;flex-shrink:0">${nextCard.icon}</span>
            <div class="g-help-trail-next-info">
              <div class="g-help-trail-next-title">${nextCard.title}</div>
              ${dur?`<div class="g-help-trail-next-dur">${dur}</div>`:''}
            </div>
            <div class="g-help-trail-next-play">▶</div>
          </div>
        </button>`;
    }
  } else {
    ctaHtml=`
      <div class="g-help-trail-complete">
        <div style="font-size:32px">🏆</div>
        <div class="g-help-trail-complete-title">Trilha concluída!</div>
        <div class="g-help-trail-complete-sub">Você assistiu todos os ${total} tutoriais desta trilha.</div>
      </div>`;
  }

  // Lista de passos
  const stepsHtml=trail.map((id,i)=>{
    const card=G_HELP_CATALOG.find(t=>t.id===id);
    if(!card) return '';
    const exists=(typeof TUTORIALS!=='undefined')&&TUTORIALS[id];
    const isDone=done.includes(id);
    const isCurrent=i===currentIdx;
    const state=isDone?'done':isCurrent?'current':'upcoming';
    const dur=gHelpTutDuration(id);
    const numHtml=isDone
      ?'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
      :(i+1);
    return `
      <button type="button" class="g-help-trail-step ${state}" ${exists?`onclick="gHelpMarkVisited();gHelpPlay('${id}')"`: 'disabled'}>
        <div class="g-help-trail-step-num">${numHtml}</div>
        <span class="g-help-tut-icon ${card.cat==='designer'?'des':'fra'}" style="width:28px;height:28px;font-size:13px;flex-shrink:0;border-radius:6px">${card.icon}</span>
        <div class="g-help-trail-step-info">
          <div class="g-help-trail-step-title">${card.title}</div>
          ${dur?`<div class="g-help-trail-step-dur">${dur}</div>`:''}
        </div>
        ${exists?'<div class="g-help-trail-step-play">▶</div>':''}
      </button>`;
  }).join('');

  wrap.innerHTML=progressHtml+ctaHtml+gHelpRenderContext()+gHelpRenderOnboarding()+`<div class="g-help-trail-steps">${stepsHtml}</div>`;
}

/* ══ CATÁLOGO ══ */

function gHelpRenderCatalog(query){
  const wrap=document.getElementById('g-help-tut-catalog'); if(!wrap)return;
  const q=(query||'').trim().toLowerCase();
  gHelpTopicQuery=query||'';
  const done=gHelpTutDone();
  const cats=[
    {key:'franqueado', name:'Para o franqueado', ico:'🍔', cls:'fra'},
    {key:'designer',  name:'Para o designer · Estúdio', ico:'🎨', cls:'des'},
  ];
  wrap.innerHTML=cats.map(cat=>{
    const tutorials=G_HELP_CATALOG.filter(t=>t.cat===cat.key)
      .filter(t=>typeof TUTORIALS!=='undefined'&&TUTORIALS[t.id])
      .filter(t=>!q||gHelpItemMatches(t,q));
    const articles=G_HELP_ARTICLES.filter(t=>t.cat===cat.key).filter(t=>!q||gHelpItemMatches(t,q));
    const items=tutorials.concat(articles);
    if(!items.length)return '';
    return `<div class="g-help-cat-group">
      <div class="g-help-cat-head">
        <span class="g-help-cat-ico ${cat.cls}">${cat.ico}</span>
        <span class="g-help-cat-name">${cat.name}</span>
        <span class="g-help-cat-count">${items.length}</span>
      </div>
      <div class="g-help-tut-grid">
        ${items.map(t=>`
          <button class="g-help-tut-card ${t.cat==='designer'?'des':'fra'}" onclick="gHelpOpenItem('${t.id}')">
            <span class="g-help-tut-play">▶</span>
            <span class="g-help-tut-icon">${t.icon||'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>'}</span>
            <span class="g-help-tut-title">${t.title}</span>
            <span class="g-help-tut-sub">${t.sub}</span>
            <span class="g-help-tut-meta">
              <span class="g-help-tut-dur">${typeof TUTORIALS!=='undefined'&&TUTORIALS[t.id]?gHelpTutDuration(t.id):'Guia rapido'}</span>
              ${done.includes(t.id)?'<span class="g-help-tut-done">✓ visto</span>':''}
            </span>
          </button>`).join('')}
      </div>
    </div>`;
  }).join('')||'<div style="font-size:12px;color:var(--text-3);text-align:center;padding:18px">Nenhum tutorial encontrado.</div>';
}

/* ══ NAVEGAÇÃO POR ABAS ══ */

function gHelpOpenItem(id){
  const item=gHelpFindItem(id);
  if(!item)return;
  if(typeof TUTORIALS!=='undefined'&&TUTORIALS[id]){ gHelpPlay(id); return; }
  const wrap=document.getElementById('g-help-tut-catalog');
  if(!wrap||!item.body)return;
  wrap.innerHTML=`<article class="g-help-topic" aria-labelledby="g-help-topic-title">
    <button type="button" class="g-help-topic-back" onclick="gHelpRenderCatalog(gHelpTopicQuery)">Voltar aos resultados</button>
    <span class="g-help-topic-eyebrow">Guia rapido</span>
    <h3 id="g-help-topic-title" tabindex="-1">${item.title}</h3>
    <p>${item.body}</p>
  </article>`;
  setTimeout(()=>document.getElementById('g-help-topic-title')?.focus(),0);
}

function gOpenHelpTopic(id,trigger){
  if(!gHelpFindItem(id))return;
  gOpenHelp(trigger);
  gHelpSwitchTab('catalogo');
  gHelpRenderCatalog('');
  gHelpOpenItem(id);
}

function gHelpSwitchTab(tab){
  ['trilha','catalogo'].forEach(t=>{
    const tabEl=document.getElementById('g-help-tab-'+t);
    tabEl?.classList.toggle('active',t===tab);
    tabEl?.setAttribute('aria-selected',t===tab?'true':'false');
    tabEl?.setAttribute('tabindex',t===tab?'0':'-1');
    document.getElementById('g-help-pane-'+t)?.classList.toggle('active',t===tab);
  });
  if(tab==='catalogo'){
    const s=document.getElementById('g-help-search');
    if(s&&!s.value) gHelpRenderCatalog('');
  }
  try{ localStorage.setItem('yngs_help_active_tab',tab); }catch(e){}
}

/* ══ ABERTURA / FECHAMENTO ══ */

function gHelpPlay(id){
  gHelpMarkVisited();
  gCloseHelp({restoreFocus:false});
  setTimeout(()=>tutOpen(id), 300);
}
function gOpenHelp(trigger){
  const modal=document.getElementById('g-help-modal');
  if(!modal)return;
  if(trigger instanceof HTMLElement)gHelpLastTrigger=trigger;
  else if(document.activeElement instanceof HTMLElement)gHelpLastTrigger=document.activeElement;
  gHelpRenderTrail();
  let savedTab='trilha';
  try{ savedTab=localStorage.getItem('yngs_help_active_tab')||'trilha'; }catch(e){}
  // Primeiro acesso sempre abre na trilha
  const tab=gHelpIsFirstVisit()?'trilha':savedTab;
  // Ativa a aba correta sem re-renderizar desnecessariamente
  ['trilha','catalogo'].forEach(t=>{
    const tabEl=document.getElementById('g-help-tab-'+t);
    tabEl?.classList.toggle('active',t===tab);
    tabEl?.setAttribute('aria-selected',t===tab?'true':'false');
    tabEl?.setAttribute('tabindex',t===tab?'0':'-1');
    document.getElementById('g-help-pane-'+t)?.classList.toggle('active',t===tab);
  });
  if(tab==='catalogo'){
    const s=document.getElementById('g-help-search');
    if(s) s.value='';
    gHelpRenderCatalog('');
  }
  gHelpPreviousOverflow=document.body.style.overflow;
  modal.classList.add('open');
  document.body.style.overflow='hidden';
  gHelpSetTriggerState(true);
  setTimeout(()=>document.getElementById('g-help-tab-'+tab)?.focus(),0);
}
function gCloseHelp(opts){
  const modal=document.getElementById('g-help-modal');
  if(!modal||!modal.classList.contains('open'))return;
  modal.classList.remove('open');
  document.body.style.overflow=gHelpPreviousOverflow;
  gHelpSetTriggerState(false);
  if(!opts||opts.restoreFocus!==false){
    const trigger=gHelpLastTrigger;
    setTimeout(()=>{ if(trigger&&document.contains(trigger))trigger.focus(); },0);
  }
}
function gHelpAction(action){
  const tutorialMap={iniciar:'primeira-arte',refazer:'editar-arte',formato:'qual-formato',marca:'regras-marca'};
  const tutId=tutorialMap[action];
  if(tutId){ gCloseHelp({restoreFocus:false}); setTimeout(()=>tutOpen(tutId),300); return; }
}

document.addEventListener('keydown',(e)=>{
  const modal=document.getElementById('g-help-modal');
  if(!modal?.classList.contains('open'))return;
  if(e.key==='Escape'){ e.preventDefault(); gCloseHelp(); return; }
  if(e.key!=='Tab')return;
  const focusables=gHelpFocusableElements();
  if(!focusables.length){ e.preventDefault(); modal.querySelector('.g-help-box')?.focus(); return; }
  const first=focusables[0];
  const last=focusables[focusables.length-1];
  if(e.shiftKey&&document.activeElement===first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey&&document.activeElement===last){ e.preventDefault(); first.focus(); }
});
