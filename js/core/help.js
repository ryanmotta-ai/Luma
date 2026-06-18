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
  return !localStorage.getItem('yngs_help_visited');
}
function gHelpMarkVisited(){
  try{ localStorage.setItem('yngs_help_visited','1'); }catch(e){}
}
function gHelpCurrentTrail(){
  const u=(typeof gCurrentUser==='function')?gCurrentUser():null;
  const role=u?u.role:'designer';
  return role==='franqueado' ? G_HELP_TRAILS.franqueado : G_HELP_TRAILS.designer;
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
        <div class="g-help-trail-next" onclick="gHelpMarkVisited();gHelpPlay('${nextId}')">
          <span class="g-help-trail-next-label">Continue de onde parou · aula ${currentIdx+1}</span>
          <div class="g-help-trail-next-row">
            <span class="g-help-tut-icon des" style="width:32px;height:32px;font-size:15px;flex-shrink:0">${nextCard.icon}</span>
            <div class="g-help-trail-next-info">
              <div class="g-help-trail-next-title">${nextCard.title}</div>
              ${dur?`<div class="g-help-trail-next-dur">${dur}</div>`:''}
            </div>
            <div class="g-help-trail-next-play">▶</div>
          </div>
        </div>`;
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
      <div class="g-help-trail-step ${state}" ${exists?`onclick="gHelpMarkVisited();gHelpPlay('${id}')"`:''}>
        <div class="g-help-trail-step-num">${numHtml}</div>
        <span class="g-help-tut-icon ${card.cat==='designer'?'des':'fra'}" style="width:28px;height:28px;font-size:13px;flex-shrink:0;border-radius:6px">${card.icon}</span>
        <div class="g-help-trail-step-info">
          <div class="g-help-trail-step-title">${card.title}</div>
          ${dur?`<div class="g-help-trail-step-dur">${dur}</div>`:''}
        </div>
        ${exists?'<div class="g-help-trail-step-play">▶</div>':''}
      </div>`;
  }).join('');

  wrap.innerHTML=progressHtml+ctaHtml+`<div class="g-help-trail-steps">${stepsHtml}</div>`;
}

/* ══ CATÁLOGO ══ */

function gHelpRenderCatalog(query){
  const wrap=document.getElementById('g-help-tut-catalog'); if(!wrap)return;
  const q=(query||'').trim().toLowerCase();
  const done=gHelpTutDone();
  const cats=[
    {key:'franqueado', name:'Para o franqueado', ico:'🍔', cls:'fra'},
    {key:'designer',  name:'Para o designer · Estúdio', ico:'🎨', cls:'des'},
  ];
  wrap.innerHTML=cats.map(cat=>{
    const items=G_HELP_CATALOG.filter(t=>t.cat===cat.key)
      .filter(t=>typeof TUTORIALS!=='undefined'&&TUTORIALS[t.id])
      .filter(t=>!q||t.title.toLowerCase().includes(q)||t.sub.toLowerCase().includes(q));
    if(!items.length)return '';
    return `<div class="g-help-cat-group">
      <div class="g-help-cat-head">
        <span class="g-help-cat-ico ${cat.cls}">${cat.ico}</span>
        <span class="g-help-cat-name">${cat.name}</span>
        <span class="g-help-cat-count">${items.length}</span>
      </div>
      <div class="g-help-tut-grid">
        ${items.map(t=>`
          <button class="g-help-tut-card ${t.cat==='designer'?'des':'fra'}" onclick="gHelpPlay('${t.id}')">
            <span class="g-help-tut-play">▶</span>
            <span class="g-help-tut-icon">${t.icon}</span>
            <span class="g-help-tut-title">${t.title}</span>
            <span class="g-help-tut-sub">${t.sub}</span>
            <span class="g-help-tut-meta">
              <span class="g-help-tut-dur">${gHelpTutDuration(t.id)}</span>
              ${done.includes(t.id)?'<span class="g-help-tut-done">✓ visto</span>':''}
            </span>
          </button>`).join('')}
      </div>
    </div>`;
  }).join('')||'<div style="font-size:12px;color:var(--text-3);text-align:center;padding:18px">Nenhum tutorial encontrado.</div>';
}

/* ══ NAVEGAÇÃO POR ABAS ══ */

function gHelpSwitchTab(tab){
  ['trilha','catalogo'].forEach(t=>{
    document.getElementById('g-help-tab-'+t)?.classList.toggle('active',t===tab);
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
  gCloseHelp();
  setTimeout(()=>tutOpen(id), 300);
}
function gOpenHelp(){
  gHelpRenderTrail();
  const savedTab=localStorage.getItem('yngs_help_active_tab')||'trilha';
  // Primeiro acesso sempre abre na trilha
  const tab=gHelpIsFirstVisit()?'trilha':savedTab;
  // Ativa a aba correta sem re-renderizar desnecessariamente
  ['trilha','catalogo'].forEach(t=>{
    document.getElementById('g-help-tab-'+t)?.classList.toggle('active',t===tab);
    document.getElementById('g-help-pane-'+t)?.classList.toggle('active',t===tab);
  });
  if(tab==='catalogo'){
    const s=document.getElementById('g-help-search');
    if(s) s.value='';
    gHelpRenderCatalog('');
  }
  document.getElementById('g-help-modal').classList.add('open');
  document.body.style.overflow='hidden';
}
function gCloseHelp(){
  document.getElementById('g-help-modal').classList.remove('open');
  document.body.style.overflow='';
}
function gHelpAction(action){
  const tutorialMap={iniciar:'primeira-arte',refazer:'editar-arte',formato:'qual-formato',marca:'regras-marca'};
  const tutId=tutorialMap[action];
  if(tutId){ gCloseHelp(); setTimeout(()=>tutOpen(tutId),300); return; }
}

// Esc fecha o modal
document.addEventListener('keydown',(e)=>{
  if(e.key==='Escape'&&document.getElementById('g-help-modal')?.classList.contains('open')) gCloseHelp();
});
