/**
 * js/designer/fonts.js
 *
 * Fontes customizadas enviadas pelo usuário (.ttf/.otf/.woff/.woff2).
 * Registra via FontFace API em runtime, persiste base64 em localStorage e
 * disponibiliza nos seletores de fonte (props + barra de contexto) e no SVG.
 * Depende de: 00-config.js, core/toast.js, designer/canvas.js (dRenderCanvas).
 */

// [{name, family, dataUrl, weight}] — family é o nome usado em font-family / FontFace
let dCustomFonts = [];

// Fontes bundled em assets/fonts/ — registradas via @font-face em css/03-fonts.css.
// Usam o mesmo prefixo "custom:" no picker para aproveitar dTextFontParts.
const dBuiltinFonts = [
  { family:'Realce',         weight:900, label:'Realce Black'    },
  { family:'Obviously Wide', weight:700, label:'Obviously Wide'  },
  { family:'Obviously Black',weight:900, label:'Obviously Black' },
  { family:'Nek Salma',      weight:400, label:'Nek Salma'       },
  { family:'Dirty Weather',  weight:400, label:'Dirty Weather'   },
];

/* ── persistência ── */
// Serializa SEM as flags de runtime (_registered/_ff): se `_registered:true` vai
// pro localStorage, o dFontRegister early-returna no próximo boot e a fonte
// nunca mais é registrada — textos custom caíam em Roboto pra sempre.
function _dFontsJson(){
  return JSON.stringify(dCustomFonts.map(f=>{ const c=Object.assign({},f); delete c._registered; delete c._ff; return c; }));
}
function dFontsPersist(){
  let ok=true;
  try{ localStorage.setItem('yngs_fonts_v1', _dFontsJson()); }
  catch(e){
    ok=false;
    if(e&&(e.name==='QuotaExceededError'||e.code===22))
      gToast('⚠ Não foi possível salvar a fonte: armazenamento cheio.','error');
  }
  if(typeof dPushFontsToBackend==='function') dPushFontsToBackend(); // sync Supabase (background, só designer)
  return ok;
}
function dFontsRestore(){
  try{
    const s=localStorage.getItem('yngs_fonts_v1');
    if(s){ const p=JSON.parse(s); if(Array.isArray(p)) dCustomFonts=p; }
  }catch(e){ dCustomFonts=[]; }
  dCustomFonts.forEach(f=>{ delete f._registered; delete f._ff; }); // sane­amento de storage antigo com a flag gravada
  dCustomFonts.forEach(dFontRegister);
}

/* ── Sync de fontes com o Supabase (luma.fontes + bucket luma-fontes) ──
   Offline-first; o arquivo da fonte sobe pro Storage e o FontFace carrega da URL. */
function _gSbFont(){ return (typeof gSupabase==='function')?gSupabase():window.sb; }
async function dPushFontsToBackend(){
  const sb=_gSbFont();
  if(!sb || typeof gIsAdmin!=='function' || !gIsAdmin()) return;
  try{
    for(const f of dCustomFonts){
      if(!f || !f.dataUrl) continue;
      if(!f.remoteId) f.remoteId=(crypto&&crypto.randomUUID)?crypto.randomUUID():('f-'+Date.now()+Math.random().toString(36).slice(2));
      // sobe o arquivo da fonte pro Storage se ainda é base64
      if(typeof f.dataUrl==='string' && f.dataUrl.startsWith('data:')){
        try{
          const blob=await (await fetch(f.dataUrl)).blob();
          const ext=((blob.type.split('/')[1]||'ttf').replace(/[^a-z0-9]/gi,''))||'ttf';
          const path=f.remoteId+'/'+String(f.family||'fonte').replace(/[^a-zA-Z0-9_-]/g,'_')+'.'+ext;
          const { error }=await sb.storage.from('luma-fontes').upload(path, blob, {upsert:true, contentType:blob.type||'font/ttf'});
          if(!error) f.dataUrl=sb.storage.from('luma-fontes').getPublicUrl(path).data.publicUrl;
        }catch(e){}
      }
      if(typeof f.dataUrl!=='string' || f.dataUrl.startsWith('data:')) continue; // upload falhou → tenta no próximo save
      await sb.schema('luma').from('fontes').upsert({
        id:f.remoteId, family:f.family, nome:f.name||f.family, weight:f.weight||400,
        formato:(/\.([a-z0-9]+)(\?|$)/i.exec(f.dataUrl)||[])[1]||null, arquivo_url:f.dataUrl
      }, {onConflict:'id'});
    }
    try{ localStorage.setItem('yngs_fonts_v1', _dFontsJson()); }catch(e){}
  }catch(e){}
}
async function dDeleteFontFromBackend(remoteId){
  const sb=_gSbFont();
  if(!sb || !remoteId || typeof gIsAdmin!=='function' || !gIsAdmin()) return;
  await gRemoteDelete('fontes','id',remoteId); // falhou → fila (re-tenta no boot)
}
async function dSyncFontsFromBackend(){
  const sb=_gSbFont(); if(!sb) return;
  try{
    const { data, error }=await sb.schema('luma').from('fontes').select('*');
    if(error || !Array.isArray(data) || !data.length) return;
    const have=new Set(dCustomFonts.map(f=>f.family&&f.family.toLowerCase()));
    let added=false;
    data.forEach(r=>{
      if(!r.arquivo_url || !r.family || have.has(r.family.toLowerCase())) return;
      // family vem do banco → mesmo saneamento do upload local (senão uma linha
      // maliciosa injeta HTML nos selects/lista de fontes de quem sincroniza)
      const _fam=String(r.family).replace(/[^a-zA-Z0-9 _-]/g,'').trim();
      if(!_fam || have.has(_fam.toLowerCase())) return;
      const f={name:r.nome||_fam, family:_fam, dataUrl:r.arquivo_url, weight:r.weight||400, remoteId:r.id};
      dCustomFonts.push(f); dFontRegister(f); added=true;
    });
    if(added){
      try{ localStorage.setItem('yngs_fonts_v1', _dFontsJson()); }catch(e){}
      if(typeof dFontsRenderList==='function') dFontsRenderList();
      if(typeof dPopFontSelects==='function') dPopFontSelects();
    }
  }catch(e){}
}

/* ── registro no navegador (FontFace API) ── */
function dFontRegister(f){
  if(!f||!f.dataUrl||typeof FontFace==='undefined') return;
  if(f._registered) return;
  try{
    const ff=new FontFace(f.family, `url(${f.dataUrl})`, {weight:String(f.weight||400)});
    ff.load().then(loaded=>{
      document.fonts.add(loaded);
      f._registered=true;
      f._ff=loaded; // referência p/ desregistrar em dFontRemove
      // re-render pra aplicar a fonte assim que ela carrega
      if(typeof dRenderCanvas==='function') dRenderCanvas();
    }).catch(()=>{ /* arquivo inválido — ignora silenciosamente */ });
  }catch(e){}
}

// Gera um nome de família único (evita colidir com Roboto ou outra custom)
function dFontUniqueFamily(base){
  let fam=String(base||'').replace(/[^a-zA-Z0-9 _-]/g,'').trim()||'Fonte';
  if(/^roboto$/i.test(fam)) fam='Roboto Custom';
  let name=fam, i=2;
  while(dCustomFonts.some(f=>f.family.toLowerCase()===name.toLowerCase())){ name=fam+' '+i; i++; }
  return name;
}

/* ── upload ── */
function dFontUpload(input){
  const files=Array.from(input.files||[]);
  files.forEach(file=>{
    if(!/\.(ttf|otf|woff2?|woff)$/i.test(file.name) && !/font/i.test(file.type)){
      gToast('⚠ Formato não suportado — use .ttf, .otf, .woff ou .woff2','error');
      return;
    }
    if(file.size > 3*1024*1024){
      gToast('⚠ Fonte muito grande (máx 3MB). Prefira .woff2.','error');
      return;
    }
    const r=new FileReader();
    r.onload=e=>{
      const base=file.name.replace(/\.[^.]+$/,'');
      const family=dFontUniqueFamily(base);
      const f={name:base, family, dataUrl:e.target.result, weight:400};
      dCustomFonts.push(f);
      dFontRegister(f);
      const ok=dFontsPersist();
      dFontsRenderList();
      dPopFontSelects();
      gToast(ok?('✓ Fonte "'+base+'" adicionada'):('Fonte "'+base+'" adicionada (sessão atual — armazenamento cheio)'));
    };
    r.readAsDataURL(file);
  });
  input.value='';
}
function dFontRemove(i){
  const f=dCustomFonts[i]; if(!f) return;
  if(!confirm(`Remover a fonte "${f.name}"? Textos que a usam voltam pra Roboto.`)) return;
  if(f.remoteId && typeof dDeleteFontFromBackend==='function') dDeleteFontFromBackend(f.remoteId);
  dCustomFonts.splice(i,1);
  // Cumpre a promessa do confirm: desregistra do navegador e devolve as camadas
  // pra Roboto AGORA (antes nada mudava até o reload, e mudava sem aviso)
  try{ if(f._ff&&document.fonts) document.fonts.delete(f._ff); }catch(e){}
  const _fv='custom:'+f.family;
  if(typeof dLayers!=='undefined'&&dLayers.some(l=>l.font===_fv)){
    if(typeof dHistoryPush==='function') dHistoryPush();
    dLayers.forEach(l=>{ if(l.font===_fv) l.font="'Roboto Black'"; });
    if(typeof dMarkUnsaved==='function') dMarkUnsaved();
  }
  dFontsPersist();
  dFontsRenderList();
  dPopFontSelects();
  if(typeof dRenderCanvas==='function') dRenderCanvas();
  gToast('Fonte "'+f.name+'" removida');
}

/* ── lista na aba Assets ── */
function dFontsRenderList(){
  const el=document.getElementById('d-fonts-list'); if(!el) return;
  if(!dCustomFonts.length){
    el.innerHTML='<div style="font-size:11px;color:var(--d-text3);padding:4px 0">Nenhuma fonte enviada ainda.</div>';
    return;
  }
  el.innerHTML=dCustomFonts.map((f,i)=>`
    <div class="font-item">
      <span class="font-preview" style="font-family:'${gEsc(f.family)}','Roboto',sans-serif">Aa</span>
      <span class="font-name" title="${gEsc(f.name)}">${gEsc(f.name)}</span>
      <button class="font-del" onclick="dFontRemove(${i})" title="Remover fonte">×</button>
    </div>`).join('');
}

/* ── opções para os seletores de fonte ──
   value: presets Roboto como antes; "custom:Família" para bundled e enviadas. */
function dFontOptionsHTML(currentVal){
  const cur=String(currentVal||'');
  const isBlack = !cur || /black|realce/i.test(cur);
  const presets=[
    `<option value="'Roboto Black'" ${isBlack?'selected':''}>Roboto Black</option>`,
    `<option value="'Roboto'" ${cur==="'Roboto'"?'selected':''}>Roboto</option>`,
    `<option value="'Roboto',bold" ${cur==="'Roboto',bold"?'selected':''}>Roboto Bold</option>`,
    `<option value="'Roboto',300" ${cur==="'Roboto',300"?'selected':''}>Roboto Light</option>`,
    `<option value="'Roboto',100" ${cur==="'Roboto',100"?'selected':''}>Roboto Thin</option>`,
  ];
  const builtin=dBuiltinFonts.map(f=>{
    const v='custom:'+f.family;
    return `<option value="${v}" ${cur===v?'selected':''}>${gEsc(f.label)}</option>`;
  });
  const custom=dCustomFonts.map(f=>{
    const v='custom:'+f.family;
    return `<option value="${v}" ${cur===v?'selected':''}>${gEsc(f.name)}</option>`;
  });
  return presets.join('')
    +(builtin.length?`<option disabled>──── incluídas ────</option>`+builtin.join(''):'')
    +(custom.length?`<option disabled>──── enviadas ────</option>`+custom.join(''):'');
}
// Repovoa o seletor do painel de props (#dp-font). O da barra de contexto é
// reconstruído a cada dUpdateCtxBar via dFontOptionsHTML.
function dPopFontSelects(){
  const sel=document.getElementById('dp-font');
  if(sel){
    const l=(typeof dLayers!=='undefined')?dLayers.find(x=>x.id===dSelId):null;
    sel.innerHTML=dFontOptionsHTML(l?l.font:null);
  }
}
