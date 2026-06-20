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
function dFontsPersist(){
  try{ localStorage.setItem('yngs_fonts_v1', JSON.stringify(dCustomFonts)); return true; }
  catch(e){
    if(e&&(e.name==='QuotaExceededError'||e.code===22))
      gToast('⚠ Não foi possível salvar a fonte: armazenamento cheio.','error');
    return false;
  }
}
function dFontsRestore(){
  try{
    const s=localStorage.getItem('yngs_fonts_v1');
    if(s){ const p=JSON.parse(s); if(Array.isArray(p)) dCustomFonts=p; }
  }catch(e){ dCustomFonts=[]; }
  dCustomFonts.forEach(dFontRegister);
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
  dCustomFonts.splice(i,1);
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
      <span class="font-preview" style="font-family:'${f.family}','Roboto',sans-serif">Aa</span>
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
