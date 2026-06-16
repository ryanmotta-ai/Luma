/**
 * js/core/help.js
 *
 * gOpenHelp, gCloseHelp, gHelpAction — modal de ajuda e suporte.
 * Mapeia cards de ajuda para tutoriais via tutOpen().
 * Depende de: tutorial/engine.js (tutOpen)
 */

/* ══ MODAL DE AJUDA / SUPORTE ══ */

// Catálogo da Central de Ajuda: todos os tutoriais animados, por categoria.
// Cada card abre o tutorial via tutOpen(id) — o tutorial precisa existir em TUTORIALS.
const G_HELP_CATALOG=[
  // Franqueado
  {id:'primeira-arte', cat:'franqueado', icon:'▶', title:'Criar minha primeira arte', sub:'Campanha → material → chat → download'},
  {id:'qual-formato', cat:'franqueado', icon:'⊞', title:'Qual formato escolher', sub:'Story, Feed ou Post wide'},
  {id:'editar-arte', cat:'franqueado', icon:'↻', title:'Editar uma arte que já fiz', sub:'Aba Minhas artes, filtros e edição'},
  {id:'enviar-foto', cat:'franqueado', icon:'📷', title:'Enviar a foto do produto', sub:'Upload, trocar e dicas de qualidade'},
  {id:'gerar-varios', cat:'franqueado', icon:'⚡', title:'Gerar várias artes (CSV)', sub:'Planilha → grade → baixar todos'},
  {id:'regras-marca', cat:'franqueado', icon:'◆', title:'Regras da marca DM', sub:'Cores, fontes e usos permitidos'},
  // Designer (Studio)
  {id:'studio-tour', cat:'designer', icon:'🧭', title:'Conheça o Estúdio', sub:'Toolbar, canvas, painéis e topbar'},
  {id:'criar-elementos', cat:'designer', icon:'✚', title:'Textos, formas e molduras', sub:'Ferramentas T, R, F e M'},
  {id:'editar-elementos', cat:'designer', icon:'⌖', title:'Selecionar, mover e organizar', sub:'Alinhar, agrupar, snap e réguas'},
  {id:'pintura', cat:'designer', icon:'🖌', title:'Pincel e pintura', sub:'Presets, borracha, conta-gotas, carimbo'},
  {id:'variaveis', cat:'designer', icon:'{}', title:'Variáveis', sub:'Tipos, autocomplete, padrão e ordem'},
  {id:'vinculos-regras', cat:'designer', icon:'⚙', title:'Vínculos e regras condicionais', sub:'Cor/visibilidade por variável'},
  {id:'simular', cat:'designer', icon:'👁', title:'Simular dados reais', sub:'Veja a arte como o franqueado gera'},
  {id:'pastas-capas', cat:'designer', icon:'📁', title:'Pastas e capas', sub:'Organização, capa e campanha'},
  {id:'blocos-fontes', cat:'designer', icon:'🧩', title:'Blocos e fontes da marca', sub:'Snippets reutilizáveis e upload de fontes'},
  {id:'publicar', cat:'designer', icon:'🚀', title:'Publicar para os franqueados', sub:'Permissões, validade e instruções'},
  {id:'exportar', cat:'designer', icon:'⬇', title:'Preview e exportação', sub:'PNG/JPG em escala e SVG'},
  {id:'atalhos', cat:'designer', icon:'⌨', title:'Atalhos do teclado', sub:'Trabalhe mais rápido no Estúdio'},
];

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
// Renderiza o catálogo (com filtro de busca opcional)
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
      .filter(t=>typeof TUTORIALS!=='undefined'&&TUTORIALS[t.id]) // só os que existem
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
          <button class="g-help-tut-card ${cat.cls}" onclick="gHelpPlay('${t.id}')">
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
function gHelpPlay(id){
  gCloseHelp();
  setTimeout(()=>tutOpen(id), 300);
}
function gOpenHelp(){
  gHelpRenderCatalog('');
  const s=document.getElementById('g-help-search'); if(s)s.value='';
  document.getElementById('g-help-modal').classList.add('open');
  document.body.style.overflow='hidden';
}
function gCloseHelp(){
  document.getElementById('g-help-modal').classList.remove('open');
  document.body.style.overflow='';
}
function gHelpAction(action){
  // Mapeia ação do card de ajuda → tutorial correspondente
  const tutorialMap = {
    iniciar: 'primeira-arte',
    refazer: 'editar-arte',
    formato: 'qual-formato',
    marca: 'regras-marca',
  };
  const tutId = tutorialMap[action];
  if(tutId){
    gCloseHelp();
    setTimeout(()=>tutOpen(tutId), 300);
    return;
  }
  // Placeholder pros canais (Slack/email)
  const msgs = {
    slack: 'A integração com Slack está em desenvolvimento. Em breve este botão vai abrir o canal do time de design direto.',
    email: 'A integração de e-mail está em desenvolvimento. Em breve este botão vai abrir um chamado pro time interno.',
  };
  if(msgs[action]) gToast(msgs[action]);
}


// Esc fecha o modal
document.addEventListener('keydown', (e)=>{
  if(e.key==='Escape' && document.getElementById('g-help-modal')?.classList.contains('open')){
    gCloseHelp();
  }
});
