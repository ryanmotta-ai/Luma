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
  if(typeof gFeatureCan==='function' && !gFeatureCan('designer.assets','access')){
    if(typeof gFeatureBlockedFeedback==='function') gFeatureBlockedFeedback('designer.assets');
    return;
  }
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
  if (typeof dRenderPagesTray === 'function') dRenderPagesTray();
  gToast(dTheme === 'light' ? 'Tema claro' : 'Tema escuro');
}

/* ── BIBLIOTECA ── */
function dLibRenderCats() {
  const el = document.getElementById('d-lib-cats');
  if (!el) return;
  const all = ['Todos', ...dLibCats];
  el.innerHTML = all.map(cat =>
    `<button class="lib-cat ${cat === dLibActiveCat ? 'active' : ''}" data-cat="${gEsc(cat)}" onclick="dLibSetCat(this.dataset.cat)">${gEsc(cat)}</button>`
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
      <div style="color:var(--d-text); font-weight:600; font-size:13px; margin-bottom:2px;">Nenhum asset encontrado</div>
      <span style="opacity:0.6; font-size:11px;">Faça upload de imagens e logos para turbinar seus designs e tê-los sempre à mão.</span>
    </div>`;
    return;
  }
  grid.innerHTML = assets.map(a => {
    // draggable="false" na <img>: sem isto o navegador arrasta a IMAGEM (drag nativo) em vez
    // do cartão, e o dragstart do item nunca dispara.
    const preview = a.isSvg
      ? `<img src="${gEsc(a.url)}" alt="${gEsc(a.name)}" draggable="false" style="width:70%;height:70%;object-fit:contain">`
      : `<img src="${gEsc(a.url)}" alt="${gEsc(a.name)}" draggable="false" style="width:100%;height:100%;object-fit:cover">`;
    // draggable: arrastar leva o item pro ponto exato da prancheta (motor em layers.js —
    // _dArrastarElemento + o drop de canvas.js). Clicar continua criando no centro.
    return `<div class="lib-item" draggable="true" ondragstart="dLibDragStart(event,'${a.id}')" ondragend="dAssetDragEnd(event)"
      onclick="dLibUse('${a.id}')" title="${gEsc(a.name)} — arraste pra prancheta ou clique pra inserir no centro">
      ${preview}
      <span class="lib-item-name">${gEsc(a.name)}</span>
      <button class="lib-item-del" onclick="event.stopPropagation();dLibDelete('${a.id}')" title="Remover">×</button>
    </div>`;
  }).join('');
}

function dLibFilter(q) { dLibRender(q); }

function dLibUpload(inp) {
  let files = Array.from(inp.files);
  if (!files.length) return;
  // Mesmo teto do upload de moldura (`canvas.js`): asset da biblioteca vira base64 e é
  // SINCRONIZADO com o Supabase logo abaixo — sem guarda, um arquivo grande ia inteiro.
  const _teto = (typeof _DIMG_MAX_MB === 'number') ? _DIMG_MAX_MB : 8;
  const grandes = files.filter(f => f.size > _teto*1024*1024);
  if (grandes.length) {
    gToast('⚠ ' + grandes.length + ' arquivo(s) acima de ' + _teto + 'MB foram ignorados. Comprima antes de subir.', 'error');
  }
  files = files.filter(f => f.size <= _teto*1024*1024);
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
        if(typeof dPushLibToBackend==='function') dPushLibToBackend(); // sync Supabase (background, só designer)
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
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => { dz.classList.remove('dragover'); });
  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.classList.remove('dragover');
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

// Clique na biblioteca = camada nova na prancheta (ou preenche a moldura selecionada).
// O motor mora em layers.js (dElementoParaCamada) — o mesmo do clique na aba Assets.
function dLibUse(id) {
  const a = dLibAssets.find(x => x.id === id);
  if (!a) return;
  dElementoParaCamada(a.url, a.name);
}

function dLibDelete(id) {
  const _a=dLibAssets.find(x=>x.id===id);
  if(_a&&_a.remoteId&&typeof dDeleteLibFromBackend==='function') dDeleteLibFromBackend(_a.remoteId);
  dLibAssets = dLibAssets.filter(a => a.id !== id);
  dLibRender();
  gToast('Asset removido da biblioteca');
}
/* ── Sync da biblioteca de assets com o Supabase (luma.biblioteca_assets + Storage) ──
   A biblioteca não persistia (só memória); agora sobe imagens pro bucket e cataloga no banco. */
function _gSbLib(){ return (typeof gSupabase==='function')?gSupabase():window.sb; }
async function dPushLibToBackend(){
  const sb=_gSbLib(); if(!sb || typeof gIsAdmin!=='function' || !gIsAdmin()) return;
  try{
    for(const a of dLibAssets){
      if(!a || !a.url) continue;
      if(!a.remoteId) a.remoteId=gUuid(); // sempre UUID válido: fallback 'lib-…' quebrava o upsert (PK uuid) p/ sempre em file://-LAN
      if(typeof a.url==='string' && a.url.startsWith('data:')){
        try{
          const blob=await (await fetch(a.url)).blob();
          const ext=a.isSvg?'svg':((blob.type.split('/')[1]||'png').replace(/[^a-z0-9]/gi,'')||'png');
          const path='biblioteca/'+a.remoteId+'.'+ext;
          const { error }=await sb.storage.from('luma-template-assets').upload(path, blob, {upsert:true, contentType:blob.type||'image/png'});
          if(!error) a.url=sb.storage.from('luma-template-assets').getPublicUrl(path).data.publicUrl;
        }catch(e){}
      }
      if(typeof a.url!=='string' || a.url.startsWith('data:')) continue;
      await sb.schema('luma').from('biblioteca_assets').upsert({
        id:a.remoteId, nome:a.name||'asset', categoria:a.cat||'Geral', url:a.url, tipo:a.isSvg?'svg':'image'
      }, {onConflict:'id'});
    }
  }catch(e){}
}
async function dDeleteLibFromBackend(remoteId){
  const sb=_gSbLib(); if(!sb || !remoteId || typeof gIsAdmin!=='function' || !gIsAdmin()) return;
  await gRemoteDelete('biblioteca_assets','id',remoteId); // falhou → fila (re-tenta no boot)
}
async function dSyncLibFromBackend(){
  const sb=_gSbLib(); if(!sb) return;
  try{
    const { data, error }=await sb.schema('luma').from('biblioteca_assets').select('*').order('created_at',{ascending:false});
    if(error || !Array.isArray(data) || !data.length) return;
    const have=new Set(dLibAssets.map(a=>a.remoteId).filter(Boolean));
    data.forEach(r=>{
      if(!r.url || have.has(r.id)) return;
      dLibAssets.push({id:'lib-'+r.id, remoteId:r.id, name:r.nome||'asset', url:r.url, cat:r.categoria||'Geral', isSvg:r.tipo==='svg'});
      if(r.categoria && typeof dLibCats!=='undefined' && Array.isArray(dLibCats) && !dLibCats.includes(r.categoria)) dLibCats.push(r.categoria);
    });
    if(typeof dLibRenderCats==='function') dLibRenderCats();
    if(typeof dLibRender==='function') dLibRender();
  }catch(e){}
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
  if(typeof l.x==='number'){clone.x=l.x+20;clone.y=l.y+20;} // grupo pode não ter x/y (evita NaN)
  dLayers.push(clone);
  // Grupo: duplica também os filhos reapontando pro novo contêiner —
  // sem isso o Ctrl+D criava um grupo VAZIO (os filhos ficavam só no original).
  if(l.type==='group'){
    dLayers.filter(x=>x.parentId===l.id).forEach(ch=>{
      const c=JSON.parse(JSON.stringify(ch));
      c.id='l-'+(++dLyrCnt);
      c.parentId=clone.id;
      c.x=(ch.x||0)+20;c.y=(ch.y||0)+20;
      dLayers.push(c);
    });
  }
  dRenderCanvas();dRenderLayersList();dStats();dMarkUnsaved();
  dSelLayer(clone.id);
  setTimeout(()=>dFlashLayer(clone.id),50);
  gToast('✓ "'+clone.name+'" duplicado  (Ctrl+D)');
}

// Ctrl/Cmd + wheel = zoom suave ancorado no cursor (delega a dSetZoom)
document.getElementById('d-canvas-wrapper').addEventListener('wheel',function(e){
  // Zoom no crop mode (imagem in-line)
  if (typeof dCropState !== 'undefined' && dCropState) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.95 : 1.05;
    const l = dLayers.find(x => x.id === dCropState.id);
    if(l) {
      l.imgScale = (l.imgScale || 1) * factor;
      if (l.imgScale < 0.1) l.imgScale = 0.1;
      if (l.imgScale > 10) l.imgScale = 10;
      if(typeof dRenderCanvas==='function') dRenderCanvas();
    }
    return;
  }

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
  // Já editando ESTA camada → não reabre. O duplo clique tem dois caminhos (a detecção manual
  // no mousedown e o listener 'dblclick' nativo); se os dois disparassem no mesmo gesto, o
  // segundo fecharia e reabriria a edição, piscando e perdendo o cursor.
  if(dInlineEl && dInlineLayer && dInlineLayer.id===l.id) return;
  dEndInlineEdit(); // fechar qualquer edição anterior
  dInlineLayer=l;
  const ta=document.createElement('textarea');
  ta.className='canvas-layer-inline-edit';
  ta.value=l.content||'';
  const _fp=dTextFontParts(l.font);
  const _fs=l.fontSize||24, _lh=l.lineHeight||1.2;
  const _isBox=(l.textBox==='box');
  /* WYSIWYG de verdade: a caixa de edição herda TUDO que muda a métrica (leading, tracking,
     caixa alta, itálico, peso) e perde o padding e o fundo escuro. Faltando isso, o texto
     "pulava" ao dar duplo clique e pulava de volta ao confirmar — parecia bug de posição,
     era a textarea com outra tipografia (largura 100px mínima, line-height 1.2 fixo). */
  ta.wrap = _isBox ? 'soft' : 'off'; // point text não quebra linha — igual ao white-space:'pre' do render
  ta.style.cssText=`
    left:${l.x}px;top:${l.y}px;
    width:${Math.max(_isBox?l.w:0,24)}px;
    height:${Math.max(l.h,Math.ceil(_fs*_lh))}px;
    font-size:${_fs}px;
    line-height:${_lh};
    font-family:${_fp.family};font-weight:${l.fontWeightOverride||_fp.weight};
    ${l.italic?'font-style:italic;':''}
    ${l.textTransform?'text-transform:'+l.textTransform+';':''}
    ${l.letterSpacing?'letter-spacing:'+l.letterSpacing+'px;':''}
    color:${l.color||'#fff'};
    text-align:${l.textAlign||'left'};
    white-space:${_isBox?'pre-wrap':'pre'};
    padding:0;border:0;
    box-sizing:border-box;
    position:absolute;
    z-index:200;
    background:transparent;
  `;
  if(l.vertical) ta.style.writingMode='vertical-rl'; // texto vertical: textarea acompanha
  const frame=document.getElementById('d-canvas-frame');
  frame.appendChild(ta);
  dInlineEl=ta;
  /* A caixa cresce ENQUANTO se digita (é o mesmo contrato do dTextFitBox: no point text a
     caixa é o texto) e se re-ancora pelo textAlign/vAlign — sem isso o texto centralizado
     escorregava para a direita a cada tecla, porque a textarea só cresce para um lado. */
  const _fit=()=>{
    if(!_isBox && typeof dMeasureText==='function'){
      // {raw:true}: mede o que está NA textarea (token {{}} cru), mas com textTransform
      // aplicado — sem isso, texto em caixa alta media minúsculo e a caixa saía estreita.
      const _txt=(typeof dTextDisplayString==='function')?dTextDisplayString({...l,content:ta.value},{raw:true}):ta.value;
      const m=dMeasureText(_txt, l.font||"'Roboto Black'", _fs, Infinity, _lh, l.letterSpacing);
      ta.style.width=Math.max(24, Math.ceil(m.width)+2)+'px'; // +2px: o caret no fim do texto tem que caber
    }
    // rows=1 antes de medir: em 'height:auto' a textarea cai no default de 2 linhas e o
    // scrollHeight vinha o dobro do texto — a caixa de edição ficava alta e descentralizada.
    ta.rows=1;
    ta.style.height='auto';
    ta.style.height=ta.scrollHeight+'px';
    const _tw=ta.offsetWidth||l.w, _th=ta.offsetHeight||l.h, _al=l.textAlign||'left';
    if(!_isBox) ta.style.left=Math.round(_al==='center'?l.x+(l.w-_tw)/2:_al==='right'?l.x+(l.w-_tw):l.x)+'px';
    // vAlign padrão do editor centraliza o texto na caixa; a textarea começa no topo.
    if(l.vAlign!=='top') ta.style.top=Math.round(l.y+(l.h-_th)/2)+'px';
  };
  _fit();
  // Autocomplete de {{var}} também na edição inline (V1/V2)
  if(typeof dAttachVarAutocomplete==='function') dAttachVarAutocomplete(ta, val=>{ if(dInlineLayer)dInlineLayer.content=val; });
  // focar e selecionar tudo
  setTimeout(()=>{ta.focus();ta.select();},30);
  ta.addEventListener('input',_fit);
  ta.addEventListener('blur',dEndInlineEdit);
  ta.addEventListener('keydown',e=>{
    e.stopPropagation(); // não dispara atalhos do canvas durante a edição
    if(e.key==='Escape'){e.preventDefault();dEndInlineEdit(null,true);}
    else if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();dEndInlineEdit();} // Enter confirma; Shift+Enter = nova linha
  });
  // Esconder o original enquanto edita. 0 (e não 0.1): agora que a textarea é fiel à
  // tipografia, o fantasma a 10% aparecia levemente deslocado e lia-se como texto duplicado.
  elDiv.style.opacity='0';
}
function dEndInlineEdit(e,cancel){
  if(!dInlineEl||!dInlineLayer)return;
  // ── Máscara de texto (ferramenta mask-text): aplica o texto digitado como máscara alpha
  // da camada-alvo, remove o layer temporário e sai. (Consolidado da versão antiga de canvas.js.)
  if(dInlineLayer.isTempMaskText){
    const l=dInlineLayer, val=dInlineEl.value;
    // Textarea removido por re-render assíncrono (ex.: fonte carregou) → valor stale;
    // trata como cancel — o ramo normal já faz esse guard, este não fazia.
    const _staleMask=dInlineEl.isConnected===false;
    const target=(typeof dLayers!=='undefined')?dLayers.find(x=>x.id===l.targetMaskLayerId):null;
    if(!cancel && !_staleMask && target && val.trim()!=='' && target.w>0 && target.h>0){
      try{
        const mC=document.createElement('canvas'); mC.width=target.w; mC.height=target.h;
        const mx=mC.getContext('2d'); mx.clearRect(0,0,mC.width,mC.height);
        const lx=l.x-target.x, ly=l.y-target.y;
        const fp=(typeof dTextFontParts==='function')?dTextFontParts(l.font):{family:"'Roboto',sans-serif",weight:900};
        mx.font=`${fp.weight} ${l.fontSize||32}px ${fp.family}`; mx.fillStyle='#FFFFFF';
        const lines=val.split('\n');
        if(l.vertical){
          mx.textAlign='center'; mx.textBaseline='middle';
          const fs=l.fontSize||32, charStep=fs*1.1, colStep=fs*1.2, startX=lx+l.w/2+(lines.length*colStep)/2-colStep/2;
          lines.forEach((line,i)=>{ const tx=startX-i*colStep, chars=[...line], colH=chars.length*charStep;
            let ty = l.textAlign==='center'? ly+l.h/2-colH/2+charStep/2 : l.textAlign==='right'? ly+l.h-colH+charStep/2 : ly+charStep/2;
            chars.forEach((ch,j)=>mx.fillText(ch, tx, ty+j*charStep)); });
        } else {
          mx.textAlign=l.textAlign||'left'; mx.textBaseline='top';
          lines.forEach((line,i)=>{ const tx=l.textAlign==='center'?lx+l.w/2:l.textAlign==='right'?lx+l.w:lx; mx.fillText(line, tx, ly+i*(l.fontSize||32)*1.25); });
        }
        dHistoryPush(); target.mask=mC.toDataURL('image/png'); dMarkUnsaved();
        gToast('✓ Máscara de texto aplicada à camada');
      }catch(err){ gToast('⚠ Não foi possível gerar a máscara de texto','error'); }
    } else if(!cancel && target && (!(target.w>0)||!(target.h>0))){
      gToast('⚠ Camada-alvo sem dimensões válidas para máscara','error');
    }
    if(typeof dLayers!=='undefined') dLayers=dLayers.filter(x=>x.id!==l.id); // remove o temp
    if(target) dSelId=target.id;
    const _elM=dInlineEl; dInlineEl=null; dInlineLayer=null;   // idem: estado antes do remove (blur reentra)
    if(_elM.isConnected)_elM.remove();
    if(typeof dSetTool==='function')dSetTool('select');
    dRenderCanvas(); if(typeof dRenderLayersList==='function')dRenderLayersList();
    if(target&&typeof dShowProps==='function')dShowProps(target);
    return;
  }
  // Editor "fantasma": dRenderCanvas() faz frame.innerHTML='' e remove o textarea do DOM
  // sem limpar dInlineEl/dInlineLayer. Se isso aconteceu (ex.: o conteúdo foi editado pelo
  // painel via dInsertVar/dUpdateProp), o valor do textarea está DESATUALIZADO — gravá-lo
  // sobrescreveria a edição feita no painel (era isso que fazia a {{var}} "sumir").
  // Detecta pelo isConnected e descarta o valor stale; l.content já é a fonte da verdade.
  const stale = dInlineEl.isConnected===false;
  // Resolver por ID na hora de gravar: undo/redo e simulação TROCAM os objetos de dLayers
  // por clones, e a referência guardada ao abrir a edição pode estar morta — gravar nela
  // perderia o texto digitado em silêncio.
  const lv=(typeof dLayers!=='undefined'&&dLayers.find(x=>x.id===dInlineLayer.id))||dInlineLayer;
  // Abrir e fechar sem digitar nada NÃO é uma edição: gravar mesmo assim empilhava um passo
  // vazio no desfazer e acendia o "Não salvo" só por ter dado duplo clique na camada.
  if(!cancel && !stale && dInlineEl.value!==(lv.content||'')){
    dHistoryPush();
    lv.content=dInlineEl.value;
    if(typeof dSyncVarsFromContent==='function')dSyncVarsFromContent(lv.content); // auto-cria vars (3.1)
    if(typeof dTextFitBox==='function') dTextFitBox(lv); // caixa modular: abraça o texto novo
    // atualizar painel de props se visível (Fase 3: renderiza chips, não a sintaxe crua)
    const inp=document.getElementById('dp-content');
    if(inp&&document.getElementById('d-props-form').style.display!=='none'){
      if(typeof dFieldTokensToChips==='function') inp.innerHTML=dFieldTokensToChips(lv.content);
      else inp.textContent=lv.content;
    }
    dMarkUnsaved();
  }
  // Zerar o estado ANTES de remover o nó: tirar do DOM um campo com foco dispara 'blur',
  // que reentra aqui na mesma pilha. Com o estado já nulo a reentrada morre na primeira
  // linha; na ordem inversa ela tentava remover o mesmo nó duas vezes (NotFoundError) e
  // podia gravar o conteúdo em dobro.
  const _el=dInlineEl;
  dInlineEl=null;
  dInlineLayer=null;
  if(_el.isConnected)_el.remove();
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

// dToggleLock vive em layers.js (versão com dHistoryPush). A duplicata que existia aqui
// carregava depois e vencia — mas sem entrar no histórico (Ctrl+Z não desfazia o bloqueio).

/* ── BLOCOS REUTILIZÁVEIS (snippets) ── */
let dSnippets=[];
function _dEsc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function dLoadSnippets(){ try{const s=localStorage.getItem('yngs_snippets_v1');dSnippets=s?JSON.parse(s):[];}catch(e){dSnippets=[];} }
function dSaveSnippetsStore(){
  let ok=true;
  try{ localStorage.setItem('yngs_snippets_v1',JSON.stringify(dSnippets)); }
  catch(e){ ok=false; if(e&&(e.name==='QuotaExceededError'||e.code===22))gToast('⚠ Sem espaço para salvar o bloco.','error'); }
  if(typeof dPushSnippetsToBackend==='function') dPushSnippetsToBackend(); // sync Supabase (background, só designer)
  return ok;
}
/* ── Sync de snippets com o Supabase (luma.snippets) ── */
function _gSbSnip(){ return (typeof gSupabase==='function')?gSupabase():window.sb; }
async function dPushSnippetsToBackend(){
  const sb=_gSbSnip(); if(!sb || typeof gIsAdmin!=='function' || !gIsAdmin()) return;
  try{
    for(const s of dSnippets){
      if(!s.remoteId) s.remoteId=gUuid(); // sempre UUID válido (fallback 's-…' quebrava upsert em PK uuid)
      await sb.schema('luma').from('snippets').upsert({ id:s.remoteId, nome:s.name||'Bloco', layers:s.layers||[] }, {onConflict:'id'});
    }
    try{ localStorage.setItem('yngs_snippets_v1', JSON.stringify(dSnippets)); }catch(e){}
  }catch(e){}
}
async function dDeleteSnippetFromBackend(remoteId){
  const sb=_gSbSnip(); if(!sb || !remoteId || typeof gIsAdmin!=='function' || !gIsAdmin()) return;
  await gRemoteDelete('snippets','id',remoteId); // falhou → fila (re-tenta no boot)
}
async function dSyncSnippetsFromBackend(){
  const sb=_gSbSnip(); if(!sb) return;
  try{
    const { data, error }=await sb.schema('luma').from('snippets').select('*').order('created_at',{ascending:false});
    if(error || !Array.isArray(data)) return;
    const remote=data.map(r=>({id:'snip-'+r.id, remoteId:r.id, name:r.nome||'Bloco', layers:Array.isArray(r.layers)?r.layers:[]}));
    const extras=dSnippets.filter(s=>!s.remoteId || !data.some(r=>r.id===s.remoteId));
    dSnippets=[...remote, ...extras];
    try{ localStorage.setItem('yngs_snippets_v1', JSON.stringify(dSnippets)); }catch(e){}
    if(typeof dRenderSnippets==='function') dRenderSnippets();
  }catch(e){}
}
function dSaveSnippet(){
  const ids = dMultiSel.length ? dMultiSel.slice() : (dSelId?[dSelId]:[]);
  const layers = ids.map(id=>dLayers.find(l=>l.id===id)).filter(Boolean);
  if(!layers.length){gToast('Selecione 1 ou mais camadas para salvar como bloco');return;}
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
function dDeleteSnippet(id){ const s=dSnippets.find(x=>x.id===id); if(s&&s.remoteId&&typeof dDeleteSnippetFromBackend==='function')dDeleteSnippetFromBackend(s.remoteId); dSnippets=dSnippets.filter(x=>x.id!==id); dSaveSnippetsStore(); dRenderSnippets(); }
function dRenderSnippets(){
  const el=document.getElementById('d-snippets-list');if(!el)return;
  if(!dSnippets.length){ el.innerHTML='<div style="font-size:11px;color:var(--d-text3);padding:6px 0">Nenhum bloco salvo. Selecione camadas e clique em "Salvar bloco".</div>'; return; }
  el.innerHTML=dSnippets.map(s=>`<div style="display:flex;align-items:center;gap:6px;padding:5px 6px;border:1px solid var(--d-border);border-radius:6px;margin-bottom:5px">
    <span style="flex:1;font-size:12px;color:var(--d-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_dEsc(s.name)} <span style="color:var(--d-text3);font-size:10px">(${s.layers.length})</span></span>
    <button class="d-lyr-add" onclick="dInsertSnippet('${s.id}')">Inserir</button>
    <button class="ctx-btn" title="Excluir bloco" onclick="dDeleteSnippet('${s.id}')" style="color:var(--dm-red)">×</button>
  </div>`).join('');
}

/**
 * Abre o color picker nativo posicionado exatamente sobre o elemento swatch
 * para que o popover de cor do navegador apareça no local correto.
 * Usa position: fixed e getBoundingClientRect() para ignorar zoom/escala.
 * @param {HTMLElement} swatchEl — o elemento swatch clicado
 * @param {string} pickId — o ID do <input type="color"> correspondente
 */
function dOpenColorPicker(swatchEl, pickId) {
  const pick = document.getElementById(pickId);
  if (!pick) return;

  const rect = swatchEl.getBoundingClientRect();
  
  // Salva os estilos originais para restaurar depois
  const origParent = pick.parentNode;
  const origNextSibling = pick.nextSibling;
  const origPosition = pick.style.position;
  const origLeft = pick.style.left;
  const origTop = pick.style.top;
  const origWidth = pick.style.width;
  const origHeight = pick.style.height;
  const origOpacity = pick.style.opacity;
  const origDisplay = pick.style.display;
  const origPointerEvents = pick.style.pointerEvents;

  // Move para o body para evitar problemas com containers com transform
  document.body.appendChild(pick);

  // Posiciona o input exatamente sobre o swatch
  pick.style.position = 'fixed';
  pick.style.left = rect.left + 'px';
  pick.style.top = rect.top + 'px';
  pick.style.width = rect.width + 'px';
  pick.style.height = rect.height + 'px';
  pick.style.opacity = '0';
  pick.style.display = 'block';
  pick.style.pointerEvents = 'none';

  // Aciona o clique nativo
  pick.click();

  // Restaura o estado oculto/original após um curto período
  setTimeout(() => {
    pick.style.position = origPosition;
    pick.style.left = origLeft;
    pick.style.top = origTop;
    pick.style.width = origWidth;
    pick.style.height = origHeight;
    pick.style.opacity = origOpacity;
    pick.style.display = origDisplay;
    pick.style.pointerEvents = origPointerEvents;
    if (origParent) {
      origParent.insertBefore(pick, origNextSibling);
    }
  }, 1000);
}
