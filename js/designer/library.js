/**
 * js/designer/library.js
 *
 * Painel lateral e biblioteca de assets: dTogglePanel, dLibRenderCats,
 * dLibRender, dLibUpload, dLibUse, dLibDelete, dToggleTheme.
 * Depende de: designer/canvas.js
 */

/* ══════════════════════════════════════════════════════════════
   PAINEL LATERAL — toggle e biblioteca
══════════════════════════════════════════════════════════════ */
let dPanelOpen = 'panels'; // null | 'panels' | 'library'
let dLibCats = ['Geral', 'Logos', 'Backgrounds', 'Ícones'];
let dLibAssets = []; // {id, name, url, cat, isSvg}
let dLibActiveCat = 'Todos';

function dTogglePanel(panel) {
  const left = document.getElementById('d-left');
  if (!panel || dPanelOpen === panel) {
    // fechar
    dPanelOpen = null;
    left.classList.remove('panel-open');
    document.querySelectorAll('.d-icon-btn').forEach(b => b.classList.remove('active'));
  } else {
    dPanelOpen = panel;
    left.classList.add('panel-open');
    // mostrar painel correto
    document.querySelectorAll('.d-side-content').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('dpanel-' + panel);
    if (target) target.classList.add('active');
    // destacar ícone correto
    document.querySelectorAll('.d-icon-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('dibtn-' + panel);
    if (btn) btn.classList.add('active');
    // se biblioteca, renderizar
    if (panel === 'library') { dLibRenderCats(); dLibRender(); }
  }
}

/* ── DRAWER DE RECURSOS (Biblioteca + Assets) — substitui as antigas abas fixas ──
 * Os blocos #dtab-library e #dtab-assets são movidos (1x) do #d-right para o drawer,
 * preservando todos os IDs internos e seus handlers. */
let _dResMoved=false;
function dToggleResources(open){
  const dr=document.getElementById('d-resources-drawer');
  const bd=document.getElementById('d-resources-backdrop');
  if(!dr)return;
  const willOpen=(open===undefined)?!dr.classList.contains('open'):!!open;
  if(willOpen&&!_dResMoved){
    const lib=document.getElementById('dtab-library');
    const assets=document.getElementById('dtab-assets');
    const sl=document.getElementById('d-res-slot-lib');
    const sa=document.getElementById('d-res-slot-assets');
    if(lib&&sl){lib.classList.remove('hidden');sl.appendChild(lib);}
    if(assets&&sa){assets.classList.remove('hidden');sa.appendChild(assets);}
    _dResMoved=true;
  }
  dr.classList.toggle('open',willOpen);
  if(bd)bd.classList.toggle('open',willOpen);
  const btn=document.getElementById('dtool-resources');
  if(btn)btn.classList.toggle('active',willOpen);
  if(willOpen)dResourcesTab('lib');
}
function dResourcesTab(which){
  document.querySelectorAll('.d-res-tab').forEach(t=>t.classList.toggle('active',t.dataset.res===which));
  const sl=document.getElementById('d-res-slot-lib');
  const sa=document.getElementById('d-res-slot-assets');
  if(sl)sl.style.display=which==='lib'?'':'none';
  if(sa)sa.style.display=which==='assets'?'':'none';
  if(which==='lib'){if(typeof dLibRenderCats==='function')dLibRenderCats();if(typeof dLibRender==='function')dLibRender();}
  if(which==='assets'&&typeof dRenderSnippets==='function')dRenderSnippets();
}

/* ── TEMA ── */
let dTheme = 'light';
function dToggleTheme() {
  dTheme = dTheme === 'dark' ? 'light' : 'dark';
  document.body.classList.toggle('theme-light', dTheme === 'light');
  // trocar ícone
  document.getElementById('theme-icon-dark').style.display = dTheme === 'dark' ? '' : 'none';
  document.getElementById('theme-icon-light').style.display = dTheme === 'light' ? '' : 'none';
  // ajustar select options
  document.querySelectorAll('select option').forEach(o => {
    o.style.background = dTheme === 'light' ? '#fff' : '#222';
    o.style.color = dTheme === 'light' ? '#0A0A0A' : '#F0F0F0';
  });
  gToast(dTheme === 'light' ? '☀ Tema claro' : '🌙 Tema escuro');
}

/* ── BIBLIOTECA ── */
function dLibRenderCats() {
  const el = document.getElementById('d-lib-cats');
  if (!el) return;
  const all = ['Todos', ...dLibCats];
  el.innerHTML = all.map(cat =>
    `<button class="lib-cat ${cat === dLibActiveCat ? 'active' : ''}" onclick="dLibSetCat('${cat}')">${cat}</button>`
  ).join('');
}

function dLibSetCat(cat) {
  dLibActiveCat = cat;
  dLibRenderCats();
  dLibRender();
}

function dLibRender(filter) {
  const grid = document.getElementById('d-lib-grid');
  if (!grid) return;
  let assets = dLibAssets;
  if (dLibActiveCat !== 'Todos') assets = assets.filter(a => a.cat === dLibActiveCat);
  if (filter) assets = assets.filter(a => a.name.toLowerCase().includes(filter.toLowerCase()));
  if (!assets.length) {
    grid.innerHTML = `<div class="lib-empty">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:.3;margin:0 auto 6px;display:block"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
      Nenhum asset aqui.<br>Faça upload acima.
    </div>`;
    return;
  }
  grid.innerHTML = assets.map(a => {
    const preview = a.isSvg
      ? `<img src="${a.url}" alt="${gEsc(a.name)}" style="width:70%;height:70%;object-fit:contain">`
      : `<img src="${a.url}" alt="${gEsc(a.name)}" style="width:100%;height:100%;object-fit:cover">`;
    return `<div class="lib-item" onclick="dLibUse('${a.id}')" title="${gEsc(a.name)}">
      ${preview}
      <span class="lib-item-name">${gEsc(a.name)}</span>
      <button class="lib-item-del" onclick="event.stopPropagation();dLibDelete('${a.id}')" title="Remover">×</button>
    </div>`;
  }).join('');
}

function dLibFilter(q) { dLibRender(q); }

function dLibUpload(inp) {
  const files = Array.from(inp.files);
  if (!files.length) return;
  let done = 0;
  files.forEach(file => {
    const isSvg = file.type === 'image/svg+xml' || file.name.endsWith('.svg');
    const r = new FileReader();
    r.onload = e => {
      dLibAssets.push({
        id: 'lib-' + Date.now() + '-' + Math.random().toString(36).slice(2,6),
        name: file.name.replace(/\.[^.]+$/, ''),
        url: e.target.result,
        cat: dLibActiveCat === 'Todos' ? 'Geral' : dLibActiveCat,
        isSvg
      });
      done++;
      if (done === files.length) {
        dLibRender();
        gToast('✓ ' + done + ' asset(s) adicionado(s) à biblioteca');
        // também sincronizar com dAssets para compatibilidade
        dAssets = dLibAssets.map(a => ({name: a.name, url: a.url, emoji: '🖼'}));
      }
    };
    r.readAsDataURL(file);
  });
  inp.value = '';
}

// Drag & drop no dropzone
document.addEventListener('DOMContentLoaded', () => {
  const dz = document.getElementById('d-lib-dropzone');
  if (!dz) return;
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.style.borderColor = 'var(--dm-orange)'; });
  dz.addEventListener('dragleave', () => { dz.style.borderColor = ''; });
  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.style.borderColor = '';
    const inp = document.getElementById('d-lib-upload');
    // simular arquivos via DataTransfer
    const dt = e.dataTransfer;
    if (dt && dt.files.length) {
      // criar FileList-like usando DataTransfer
      const transfer = new DataTransfer();
      [...dt.files].forEach(f => transfer.items.add(f));
      inp.files = transfer.files;
      dLibUpload(inp);
    }
  });
});

function dLibUse(id) {
  const a = dLibAssets.find(x => x.id === id);
  if (!a) return;
  const l = dLayers.find(x => x.id === dSelId && (x.type === 'image' || x.type === 'frame'));
  if (!l) { gToast('Selecione um layer de imagem ou moldura primeiro'); return; }
  l.imgUrl = a.url;
  dRenderCanvas();
  const urlInp = document.getElementById('dp-imgurl');
  if (urlInp) urlInp.value = '[' + a.name + ']';
  gToast('✓ "' + a.name + '" aplicado');
}

function dLibDelete(id) {
  dLibAssets = dLibAssets.filter(a => a.id !== id);
  dLibRender();
  gToast('Asset removido da biblioteca');
}

function dLibNewCat() {
  const name = prompt('Nome da nova categoria:');
  if (!name || !name.trim()) return;
  const n = name.trim();
  if (dLibCats.includes(n)) { gToast('Categoria já existe'); return; }
  dLibCats.push(n);
  dLibActiveCat = n;
  dLibRenderCats();
  dLibRender();
  gToast('✓ Categoria "' + n + '" criada');
}


/* ── UNDO/REDO ── */
let dHistory=[], dHistoryIdx=-1;

function dDuplicateLayer(){
  const l=dLayers.find(x=>x.id===dSelId);if(!l)return;
  dHistoryPush();
  const clone=JSON.parse(JSON.stringify(l));
  clone.id='l-'+(++dLyrCnt);
  clone.name=l.name+' cópia';
  clone.x=l.x+20;clone.y=l.y+20;
  dLayers.push(clone);
  dRenderCanvas();dRenderLayersList();dStats();dMarkUnsaved();
  dSelLayer(clone.id);
  setTimeout(()=>dFlashLayer(clone.id),50);
  gToast('✓ "'+clone.name+'" duplicado  (Ctrl+D)');
}

// Ctrl/Cmd + wheel = zoom suave ancorado no cursor (delega a dSetZoom)
document.getElementById('d-canvas-wrapper').addEventListener('wheel',function(e){
  if(!e.ctrlKey&&!e.metaKey)return;
  e.preventDefault();
  const factor = e.deltaY>0 ? 0.9 : 1.1; // passos suaves
  if(typeof dSetZoom==='function') dSetZoom(dZoomLevel*factor, e.clientX, e.clientY);
},{passive:false});

// ResizeObserver: re-centraliza a prancheta quando janela/painel mudam de tamanho
// (preserva o zoom do usuário em vez de re-fit forçado)
if(typeof ResizeObserver!=='undefined'){
  new ResizeObserver(()=>{
    if(document.body.classList.contains('mode-designer')&&dLayers.length>0&&typeof dPositionArtboard==='function')dPositionArtboard();
  }).observe(document.getElementById('d-canvas-wrapper'));
}

/* ── Edição inline de texto ── */
let dInlineEl=null,dInlineLayer=null;
function dStartInlineEdit(l,elDiv){
  dEndInlineEdit(); // fechar qualquer edição anterior
  dInlineLayer=l;
  const ta=document.createElement('textarea');
  ta.className='canvas-layer-inline-edit';
  ta.value=l.content||'';
  ta.style.cssText=`
    left:${l.x}px;top:${l.y}px;
    width:${Math.max(l.w,100)}px;
    min-height:${Math.max(l.h,30)}px;
    font-size:${l.fontSize||24}px;
    font-family:${dTextFontParts(l.font).family};font-weight:${dTextFontParts(l.font).weight};
    color:${l.color||'#fff'};
    text-align:${l.textAlign||'left'};
    padding:2px 4px;
    box-sizing:border-box;
    position:absolute;
    z-index:200;
    background:rgba(0,0,0,0.2);
  `;
  const frame=document.getElementById('d-canvas-frame');
  frame.appendChild(ta);
  dInlineEl=ta;
  // Autocomplete de {{var}} também na edição inline (V1/V2)
  if(typeof dAttachVarAutocomplete==='function') dAttachVarAutocomplete(ta, val=>{ if(dInlineLayer)dInlineLayer.content=val; });
  // focar e selecionar tudo
  setTimeout(()=>{ta.focus();ta.select();},30);
  // auto-resize
  ta.addEventListener('input',()=>{
    ta.style.height='auto';
    ta.style.height=ta.scrollHeight+'px';
  });
  ta.addEventListener('blur',dEndInlineEdit);
  ta.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();dEndInlineEdit(null,true);}
    if(e.key==='Enter'&&!e.shiftKey&&l.font&&l.font.includes('Realce')){
      // Realce Black não tem Shift+Enter intuitivo, manter comportamento padrão
    }
  });
  // esconder o layer original visualmente enquanto edita
  elDiv.style.opacity='0.1';
}
function dEndInlineEdit(e,cancel){
  if(!dInlineEl||!dInlineLayer)return;
  // Editor "fantasma": dRenderCanvas() faz frame.innerHTML='' e remove o textarea do DOM
  // sem limpar dInlineEl/dInlineLayer. Se isso aconteceu (ex.: o conteúdo foi editado pelo
  // painel via dInsertVar/dUpdateProp), o valor do textarea está DESATUALIZADO — gravá-lo
  // sobrescreveria a edição feita no painel (era isso que fazia a {{var}} "sumir").
  // Detecta pelo isConnected e descarta o valor stale; l.content já é a fonte da verdade.
  const stale = dInlineEl.isConnected===false;
  if(!cancel && !stale){
    dHistoryPush();
    dInlineLayer.content=dInlineEl.value;
    if(typeof dSyncVarsFromContent==='function')dSyncVarsFromContent(dInlineLayer.content); // auto-cria vars (3.1)
    // atualizar painel de props se visível
    const inp=document.getElementById('dp-content');
    if(inp&&document.getElementById('d-props-form').style.display!=='none')inp.value=dInlineLayer.content;
    dMarkUnsaved();
  }
  if(dInlineEl.isConnected)dInlineEl.remove();
  dInlineEl=null;
  dInlineLayer=null;
  if(!stale)dRenderCanvas();
}

/* ── Layers panel resize ── */
function dLayersPanelResizeStart(e){
  e.preventDefault();
  const panel=document.getElementById('d-layers-panel');
  const startY=e.clientY, startH=panel.offsetHeight;
  function move(ev){
    const newH=Math.max(90,Math.min(window.innerHeight*.5,startH-(ev.clientY-startY)));
    panel.style.height=newH+'px';
  }
  function up(){document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);}
  document.addEventListener('mousemove',move);
  document.addEventListener('mouseup',up);
}

/* ── Hex color input helpers ── */
function dHexSync(hexInputId, colorVal){
  const inp=document.getElementById(hexInputId);
  if(inp)inp.value=colorVal.toUpperCase();
}
function dHexInput(colorPickId, swatchId, val, prop){
  // aceitar com ou sem #
  let hex=val.startsWith('#')?val:'#'+val;
  if(!/^#[0-9A-Fa-f]{6}$/.test(hex))return;
  const pick=document.getElementById(colorPickId);
  const sw=document.getElementById(swatchId);
  if(pick)pick.value=hex;
  if(sw)sw.style.background=hex;
  dUpdateProp(prop,hex);
}

function dToggleLock(e,id){
  e.stopPropagation();
  const l=dLayers.find(x=>x.id===id);if(!l)return;
  l.locked=!l.locked;
  if (l.type === 'group') {
    dLayers.forEach(x => {
      if (x.parentId === l.id) {
        x.locked = l.locked;
      }
    });
  }
  dRenderCanvas();dRenderLayersList();dMarkUnsaved();
  gToast(l.locked?'🔒 Layer bloqueado':'🔓 Layer desbloqueado');
}

/* ── BLOCOS REUTILIZÁVEIS (snippets) ── */
let dSnippets=[];
function _dEsc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function dLoadSnippets(){ try{const s=localStorage.getItem('yngs_snippets_v1');dSnippets=s?JSON.parse(s):[];}catch(e){dSnippets=[];} }
function dSaveSnippetsStore(){
  try{ localStorage.setItem('yngs_snippets_v1',JSON.stringify(dSnippets)); return true; }
  catch(e){ if(e&&(e.name==='QuotaExceededError'||e.code===22))gToast('⚠ Sem espaço para salvar o bloco.','error'); return false; }
}
function dSaveSnippet(){
  const ids = dMultiSel.length ? dMultiSel.slice() : (dSelId?[dSelId]:[]);
  const layers = ids.map(id=>dLayers.find(l=>l.id===id)).filter(Boolean);
  if(!layers.length){gToast('Selecione 1+ layers para salvar como bloco');return;}
  const name=(prompt('Nome do bloco:', 'Bloco '+(dSnippets.length+1))||'').trim();
  if(!name)return;
  // Normaliza para o canto sup-esq do conjunto e remove ids
  const minX=Math.min(...layers.map(l=>l.x)), minY=Math.min(...layers.map(l=>l.y));
  const norm=layers.map(l=>{const c=JSON.parse(JSON.stringify(l));c.x-=minX;c.y-=minY;delete c.id;
    // TODO(Fase 5): persistir imagens dos blocos; por ora descarta base64 (igual ao __local__)
    if(c.imgUrl&&c.imgUrl.startsWith('data:'))c.imgUrl='__local__';return c;});
  dSnippets.unshift({id:'snip-'+Date.now(),name,layers:norm});
  if(dSaveSnippetsStore()){ dRenderSnippets(); gToast('✓ Bloco salvo: '+name); }
}
function dInsertSnippet(id){
  const s=dSnippets.find(x=>x.id===id);if(!s)return;
  dHistoryPush();
  s.layers.forEach(l=>{const c=JSON.parse(JSON.stringify(l));c.id='l-'+(++dLyrCnt);c.x=(c.x||0)+40;c.y=(c.y||0)+40;dLayers.push(c);});
  dRenderCanvas();dRenderLayersList();dStats();dMarkUnsaved();dSetTool('select');
  gToast('Bloco "'+s.name+'" inserido');
}
function dDeleteSnippet(id){ dSnippets=dSnippets.filter(x=>x.id!==id); dSaveSnippetsStore(); dRenderSnippets(); }
function dRenderSnippets(){
  const el=document.getElementById('d-snippets-list');if(!el)return;
  if(!dSnippets.length){ el.innerHTML='<div style="font-size:11px;color:var(--d-text3);padding:6px 0">Nenhum bloco salvo. Selecione layers e clique em "Salvar bloco".</div>'; return; }
  el.innerHTML=dSnippets.map(s=>`<div style="display:flex;align-items:center;gap:6px;padding:5px 6px;border:1px solid var(--d-border);border-radius:6px;margin-bottom:5px">
    <span style="flex:1;font-size:12px;color:var(--d-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_dEsc(s.name)} <span style="color:var(--d-text3);font-size:10px">(${s.layers.length})</span></span>
    <button class="d-lyr-add" onclick="dInsertSnippet('${s.id}')">Inserir</button>
    <button class="ctx-btn" title="Excluir bloco" onclick="dDeleteSnippet('${s.id}')" style="color:var(--dm-red)">×</button>
  </div>`).join('');
}

