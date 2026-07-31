/**
 * js/franqueado/materials.js
 *
 * Catalogo de materiais do franqueado: fOpenMaterialCatalog,
 * fRenderMaterialCatalog, fRenderMaterialCard, fCloseMaterialCatalog, fSelectMaterial.
 * Depende de: 00-config.js, 01-state.js, franqueado/chat.js
 */

/* ── DEMO: material genérico por campanha (só quando a pasta NÃO tem material real publicado) ──
   Existe para a vitrine não ficar vazia em demonstrações enquanto o backend não publica templates
   (as capas já são hardcoded no config pelo mesmo motivo). NÃO entra em dFolders → não é
   sincronizado nem persistido, e é substituído pelos materiais reais assim que existirem.
   O template usa tokens {{var}} (chat de personalização funciona) e carrega _demoDados p/ a thumb
   sair preenchida (valores de preview da campanha) em vez de mostrar os placeholders crus. ── */
const _F_DEMO_MAT_CACHE={};
function _fDemoMaterial(camp){
  if(!camp || !camp.cover) return null;               // só pastas com capa associada
  if(_F_DEMO_MAT_CACHE[camp.id]) return _F_DEMO_MAT_CACHE[camp.id];
  const perg=Array.isArray(camp.perguntas)?camp.perguntas:[];
  const vars=perg.map(p=>p.id);
  const headVar=vars.includes('produto')?'produto':(vars[0]||'produto');
  const subVar=vars.includes('precoPor')?'precoPor':(vars.find(v=>v!==headVar)||null);
  const W=1080,H=1920, col=camp.color||'#FF9000';
  const _t=(id,extra)=>Object.assign({id:'l-demo-'+camp.id+'-'+id,type:'text',visible:true,opacity:100,textAlign:'center',textBox:'box',font:"'Roboto Black'",color:'#ffffff'},extra);
  const layers=[
    {id:'l-demo-'+camp.id+'-bg',type:'shape',shapeKind:'rect',x:0,y:0,w:W,h:H,fill:col,opacity:100,visible:true},
    {id:'l-demo-'+camp.id+'-scrim',type:'shape',shapeKind:'rect',x:0,y:1120,w:W,h:800,fill:'rgba(0,0,0,0.28)',opacity:100,visible:true},
    _t('tag',{content:camp.name,x:90,y:150,w:900,h:110,fontSize:46,font:"'Roboto',bold"}),
    _t('head',{content:'{{'+headVar+'}}',x:70,y:1200,w:940,h:360,fontSize:150}),
  ];
  if(subVar) layers.push(_t('sub',{content:'{{'+subVar+'}}',x:70,y:1580,w:940,h:220,fontSize:120,color:'#FFD200'}));
  const _demoDados={};
  _demoDados[headVar]=camp.previewProd||camp.name||'SEU PRODUTO';
  if(subVar){ const sp=perg.find(p=>p.id===subVar); _demoDados[subVar]=camp.previewPor||(sp&&sp.sugestoes&&sp.sugestoes[0])||'OFERTA'; }
  const mat={id:'demo-'+camp.id, name:'Modelo '+camp.name, fmt:'story', w:W, h:H, publishMeta:{publicado:true}, layers, _demo:true, _demoDados};
  _F_DEMO_MAT_CACHE[camp.id]=mat;
  return mat;
}
function _fAllCamps(){ const g=(typeof fGetCampaigns==='function')?fGetCampaigns():{ativas:CAMPS_ATIVAS,outras:CAMPS_OUTRAS}; return [...g.ativas, ...g.outras]; }
function _fDemoMaterialsForCamp(campId){ const c=_fAllCamps().find(x=>x.id===campId); const m=c?_fDemoMaterial(c):null; return m?[m]:[]; }
function _fFindDemoMaterial(materialId){ for(const c of _fAllCamps()){ const m=_fDemoMaterial(c); if(m && m.id===materialId) return m; } return null; }

function fGetMaterialsForCamp(campId){
  let real=[];
  if(typeof dFolders !== 'undefined' && dFolders){
    // Casa pela campId direta OU pelo nome da campanha como fallback
    const c=_fAllCamps().find(x=>x.id===campId);
    const folder = dFolders.find(f=>{
      if(f.campId===campId) return true;
      if(c && f.name===c.name) return true;
      if(f.remoteId===campId || f.id===campId) return true; // campanha dinâmica: camp.id = id da pasta
      return false;
    });
    if(folder && folder.templates) real=folder.templates.filter(t=>t.publishMeta && t.publishMeta.publicado);
  }
  if(real.length) return real;
  return _fDemoMaterialsForCamp(campId); // pasta sem material real → material-demo (vitrine na demo)
}
function fIsMaterialValid(material){
  if(!material.publishMeta || !material.publishMeta.validade) return true;
  const v=new Date(material.publishMeta.validade+'T23:59:59');
  return v.getTime() >= Date.now();
}

/* ── KIT DA CAMPANHA: preencher uma vez → gerar todos os materiais ──
   Reusa os dados já respondidos (fState.dados) e renderiza cada material publicado da
   campanha com o motor final, empacotando num ZIP. Pula materiais que não aproveitam
   nenhum dado preenchido (não gera arte vazia). Reusa fRenderMaterialToDataURL + JSZip. */
function _fKitBtnHtml(){
  try{
    const c=fState.camp; if(!c) return '';
    const mm=fGetMaterialsForCamp(c.id).filter(fIsMaterialValid);
    if(mm.length<2) return '';
    return `<button class="confirm-bulk" onclick="fGenerateCampaignKit()" title="Gerar todos os materiais desta campanha com os mesmos dados"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>Gerar kit da campanha (${mm.length})</button>`;
  }catch(e){ return ''; }
}
async function fGenerateCampaignKit(){
  const c=fState.camp; if(!c){ gToast('Escolha uma campanha primeiro.'); return; }
  if(typeof JSZip==='undefined'){ gToast('Não consegui preparar o pacote agora. Recarregue a página e tente de novo.','error'); return; }
  const mats=fGetMaterialsForCamp(c.id).filter(fIsMaterialValid);
  if(mats.length<2){ gToast('Esta campanha só tem um material — o kit precisa de dois ou mais.'); return; }
  const dados=fState.dados||{};
  const fmtMap={story:'story',feed:'feed',wide:'post',post:'post'};
  const zip=new JSZip();
  const prevMat=fState.material, prevFmt=fState.fmt;
  let ok=0, pulados=0;
  const usedNames=new Set();   // evita que 2 materiais de mesmo nome se sobrescrevam no ZIP
  const restoreBtn=(typeof gBtnLoading==='function') ? gBtnLoading(document.querySelector('[onclick="fGenerateCampaignKit()"]'),'Gerando…') : ()=>{};
  const progress=document.getElementById('f-kit-progress');
  const progressText=document.getElementById('f-kit-progress-text');
  const progressPct=document.getElementById('f-kit-progress-pct');
  const progressBar=document.getElementById('f-kit-progress-bar');
  const updateProgress=(done)=>{
    const pct=Math.round(done/mats.length*100);
    if(progressText) progressText.textContent=`Material ${done}/${mats.length}`;
    if(progressPct) progressPct.textContent=pct+'%';
    if(progressBar) progressBar.style.width=pct+'%';
  };
  if(progress){ progress.style.display='block'; updateProgress(0); }
  gToast('Gerando o kit da campanha…');
  for(let i=0;i<mats.length;i++){
    const m=mats[i];
    try{
      if(typeof fEnsureMaterialLayers==='function') await fEnsureMaterialLayers(m);
      if(!m.layers||!m.layers.length){ pulados++; continue; }
      // Pula material que não usa NENHUM dado já preenchido (sairia vazio → não vale a pena).
      const mvars=(typeof dExtractTemplateVars==='function')?dExtractTemplateVars(m.layers):[];
      if(mvars.length && !mvars.some(v=>dados[v]!=null && dados[v]!=='')){ pulados++; continue; }
      const fmt=FMTS.find(f=>f.id===(fmtMap[m.fmt]||m.fmt))||fState.fmt||FMTS[0];
      fState.material=m; fState.fmt=fmt;
      const dataUrl=await fRenderMaterialToDataURL(dados, c, fmt);
      const b64=dataUrl.split(',')[1];
      if(b64){
        let base=fSanitizeNamePart(m.name)||('Material_'+(ok+1)), name=base, n=2;
        while(usedNames.has(name.toLowerCase())){ name=base+'_'+(n++); } // nome único → nada some no ZIP
        usedNames.add(name.toLowerCase());
        zip.file(name+'.png', b64, {base64:true}); ok++;
      }
      else pulados++;
    }catch(e){ console.warn('[kit] material falhou:', e); pulados++; }
    finally{ updateProgress(i+1); }
  }
  fState.material=prevMat; fState.fmt=prevFmt;
  if(!ok){ restoreBtn(); if(progress) progress.style.display='none'; gToast('Não consegui gerar o kit — preencha ao menos um campo em comum aos materiais.','error'); return; }
  try{
    const blob=await zip.generateAsync({type:'blob'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='Kit_'+(fSanitizeNamePart(c.name)||'Campanha')+'.zip';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),5000);
  }catch(e){ console.error(e); restoreBtn(); if(progress) progress.style.display='none'; gToast('Não consegui montar o kit. Tente de novo.','error'); return; }
  restoreBtn();
  if(progress) progress.style.display='none';
  gToast(`Kit pronto: ${ok} materiais`+(pulados?` (${pulados} pulados — precisam de dados próprios)`:'')+'.');
  if(typeof fClearImgCache==='function') fClearImgCache();
}
/* ── TEMA POR CAMPANHA (1º caso: Much+) ──
   Campanha com `theme` — ou pasta com a tag/badge "MUCH+" — re-tokeniza o app
   enquanto o franqueado está dentro dela: body.camp-theme-<slug> (tokens em
   00-tokens.css), véu de transição e motion do logo no header (franqueado.css).
   Entradas: fOpenMaterialCatalog e fEditFromHist. Saídas: fGoHome e
   fCloseMaterialCatalog. ⚠ NÃO pendurar a remoção em fRestoreCatalog: é
   re-render do rail e roda com o franqueado DENTRO da campanha (favoritar
   uma campanha derrubava o tema no meio do fluxo). */
let _fCampThemeAtivo='';
function _fCampThemeOf(camp){
  if(!camp) return '';
  // Pasta marcada MUCH+ liga o tema mesmo sem `theme` explícito — o MKT cria a
  // pasta no Estúdio com o badge e a vitrine já veste o clube, sem mexer em código.
  const t=camp.theme||(/much\s*\+/i.test(camp.badge||'')?'muchplus':'');
  return String(t).toLowerCase().replace(/[^a-z0-9-]/g,''); // vira classe CSS — só slug seguro
}
function fApplyCampTheme(camp){
  const t=_fCampThemeOf(camp);
  if(t===_fCampThemeAtivo) return; // idempotente: re-entrar na mesma campanha não repete véu/vídeo
  if(!t){ fRemoveCampTheme(); return; }
  if(_fCampThemeAtivo) document.body.classList.remove('camp-theme-'+_fCampThemeAtivo);
  _fCampThemeAtivo=t;
  const reduz=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Guard do flip: ele roda ~400ms depois — se o franqueado já saiu (fGoHome) ou
  // trocou de tema nessa janela, aplicar agora "vestiria" a home. Aborta.
  const flip=()=>{ if(_fCampThemeAtivo!==t) return; document.body.classList.add('camp-theme-'+t); if(t==='muchplus') _fMuchPlusHeader(reduz); };
  if(reduz){ flip(); return; } // movimento reduzido: troca seca, sem véu
  // Véu "entrei em outro mundo": cobre a tela, o tema troca por baixo (~400ms,
  // quando o círculo já fechou — ninguém vê a costura) e evapora sozinho.
  const antigo=document.getElementById('f-camp-veil'); if(antigo) antigo.remove();
  const veil=document.createElement('div'); veil.id='f-camp-veil';
  veil.innerHTML='<div class="veil-layer veil-1"></div><div class="veil-layer veil-2"></div>'
    +(t==='muchplus'?'<img src="assets/logos/muchplus-trim.png" alt="" aria-hidden="true"/>':''); // -trim: PNG original é quadrado com ~70% de margem transparente
  document.body.appendChild(veil);
  void veil.offsetWidth; // commita o estado inicial do clip-path antes de animar
  veil.classList.add('on');
  if(t==='muchplus') _fPlayMuchPlusWooshSound();
  setTimeout(flip,700); // magenta já cobriu a tela (varredura 200–950ms)
  // Só o animationend do PRÓPRIO véu (fade final) remove — o das camadas/logo
  // borbulha antes e derrubaria o véu no meio da varredura.
  veil.addEventListener('animationend',e=>{ if(e.target===veil) veil.remove(); });
  setTimeout(()=>{ if(veil.isConnected) veil.remove(); },3000); // cinto: aba oculta não dispara animationend
}

/* ══ SOUND DESIGN MUCH+ (Sopro de Seda + Acorde Cristalino Fá#5/Dó#6) ══ */
function _fPlayMuchPlusWooshSound(){
  try{
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    if(!AudioContext) return;
    const ctx=new AudioContext();
    if(ctx.state==='suspended') ctx.resume();
    const now=ctx.currentTime;

    // 1. Sopro de Seda (Warm Velvet Sweep)
    const oscSwoosh=ctx.createOscillator();
    const gainSwoosh=ctx.createGain();
    const filterSwoosh=ctx.createBiquadFilter();

    oscSwoosh.type='sine';
    oscSwoosh.frequency.setValueAtTime(120,now);
    oscSwoosh.frequency.exponentialRampToValueAtTime(320,now+0.28);

    filterSwoosh.type='lowpass';
    filterSwoosh.frequency.setValueAtTime(350,now);

    gainSwoosh.gain.setValueAtTime(0.001,now);
    gainSwoosh.gain.exponentialRampToValueAtTime(0.14,now+0.15);
    gainSwoosh.gain.exponentialRampToValueAtTime(0.001,now+0.40);

    oscSwoosh.connect(filterSwoosh);
    filterSwoosh.connect(gainSwoosh);
    gainSwoosh.connect(ctx.destination);

    oscSwoosh.start(now);
    oscSwoosh.stop(now+0.42);

    // 2. Acorde de Cristal Harmônico (Fá#5 740Hz + Dó#6 1108Hz)
    const tCrystal=now+0.18;
    [739.99,1108.73].forEach(freq=>{
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      const filter=ctx.createBiquadFilter();

      osc.type='sine';
      osc.frequency.setValueAtTime(freq,tCrystal);

      filter.type='lowpass';
      filter.frequency.setValueAtTime(1600,tCrystal);

      gain.gain.setValueAtTime(0.001,tCrystal);
      gain.gain.exponentialRampToValueAtTime(0.08,tCrystal+0.04);
      gain.gain.exponentialRampToValueAtTime(0.001,tCrystal+0.55);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(tCrystal);
      osc.stop(tCrystal+0.60);
    });

    setTimeout(()=>{ try{ ctx.close(); }catch(e){} },1000);
  }catch(e){}
}
function _fMuchPlusHeader(semMotion){
  const brand=document.querySelector('#f-chat-head .f-assistant-brand');
  if(!brand||brand.querySelector('.muchplus-motion-wrap')) return;
  const wrap=document.createElement('div');
  wrap.className='muchplus-motion-wrap';
  // Markup estático (sem dado de usuário). Os irmãos originais da marca ficam
  // display:none via CSS — nunca sobrescrever o innerHTML do header (a versão
  // anterior duplicava o markup do index.html e as cópias iam divergir).
  wrap.innerHTML='<video src="assets/motion/logo_muchplus.webm" muted playsinline preload="auto" aria-hidden="true"></video>'
    +'<img src="assets/logos/muchplus-trim.png" alt="Much+" style="display:none"/>'; // -trim: sem as margens do PNG original, o logo ocupa a altura de verdade
  brand.appendChild(wrap);
  const vid=wrap.querySelector('video'), img=wrap.querySelector('img');
  let trocou=false;
  const troca=()=>{ if(trocou) return; trocou=true;
    vid.style.opacity='0';
    setTimeout(()=>{ vid.style.display='none'; img.style.display='block'; },250);
  };
  if(semMotion){ troca(); return; }
  // 1 ciclo do motion → assenta no logo estático. Fallbacks em camadas: o .mov
  // original (qtrle, 54MB) não decodificava em navegador NENHUM — o webm resolve,
  // mas erro de rede/decoder ainda cai no logo sem buraco visual.
  vid.onended=troca;
  vid.onerror=troca;
  // ⚠ NÃO dar play aqui: o header vive no #f-chat-col, que fica display:none
  // enquanto o franqueado navega nos materiais da pasta — o ciclo tocava
  // invisível e, ao abrir o chat, só restava o logo parado. O play (e os cintos
  // de fallback, senão trocariam antes de alguém ver) arma quando o header
  // realmente aparece (fSelectMaterial devolve o display do chat).
  let armado=false;
  const arma=()=>{
    if(armado||trocou) return; armado=true;
    const cinto=()=>setTimeout(troca,(vid.duration||3.4)*1000+800); // duração real + folga
    if(vid.readyState>=1) cinto(); else vid.onloadedmetadata=cinto;
    setTimeout(troca,8000); // último cinto: metadata nunca chegou
    const p=vid.play(); if(p&&p.catch) p.catch(troca); // autoplay bloqueado → direto ao logo
  };
  // Visível agora (ex.: retomada do histórico cai direto no chat) → toca já.
  // Escondido (navegando materiais) → fica pendurado em wrap._arma e o
  // _fMuchPlusHeaderPlay dispara quando o fSelectMaterial devolve o display.
  // (offsetParent + chamada explícita, e não IntersectionObserver: determinístico
  // e verificável — IO não tica em aba sem compositor.)
  if(vid.offsetParent!==null) arma();
  else wrap._arma=arma;
}
// Ponte do seam de visibilidade: o fSelectMaterial chama isto ao devolver o
// display do chat — se o motion do Much+ está pendurado esperando, toca agora.
function _fMuchPlusHeaderPlay(){
  const wrap=document.querySelector('#f-chat-head .muchplus-motion-wrap');
  if(wrap&&wrap._arma) wrap._arma();
}
function fRemoveCampTheme(){
  const tinha=_fCampThemeAtivo;
  if(tinha){ document.body.classList.remove('camp-theme-'+tinha); _fCampThemeAtivo=''; }
  const wrap=document.querySelector('#f-chat-head .muchplus-motion-wrap');
  if(wrap) wrap.remove(); // a marca original só estava display:none — reaparece sozinha (o _arma morre com o nó)
  const veil=document.getElementById('f-camp-veil'); if(veil) veil.remove();
  // Beat de saída: wipe reverso curto (~320ms) — o magenta recolhe e devolve o Luma.
  // Só quando havia tema de verdade (o guard `tinha` também evita beat duplo no
  // encadeamento fCloseMaterialCatalog → fGoHome) e sem reduced-motion.
  if(tinha && !(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)){
    const antigoOut=document.getElementById('f-camp-veil-out'); if(antigoOut) antigoOut.remove();
    const out=document.createElement('div'); out.id='f-camp-veil-out';
    document.body.appendChild(out);
    void out.offsetWidth;
    out.classList.add('on');
    out.addEventListener('animationend',()=>out.remove());
    setTimeout(()=>{ if(out.isConnected) out.remove(); },900); // cinto: aba oculta
  }
}

// Abre a "pasta" da campanha mostrando os materiais publicados
function fOpenMaterialCatalog(camp){
  fState.materialView=true;
  fState.material=null;
  fApplyCampTheme(camp); // campanha com tema (Much+) veste o app ao entrar na pasta
  // Mobile: o catálogo de materiais vive no #fran-right (escondido por padrão no
  // celular). Sem trazer o painel pra frente, tocar numa campanha caía numa tela
  // vazia. O "voltar" (fCloseMaterialCatalog) remove a classe e devolve o catálogo.
  try{ document.body.classList.add('f-mobile-chat','f-material-browser'); }catch(e){}
  const chatCol=document.getElementById('f-chat-col');
  let matView=document.getElementById('f-material-view');
  if(!matView){
    matView=document.createElement('div');
    matView.id='f-material-view';
    chatCol.parentNode.insertBefore(matView, chatCol);
  }
  
  chatCol.classList.add('fade-exit');
  
  setTimeout(() => {
    chatCol.style.display='none';
    chatCol.classList.remove('fade-exit');

    matView.style.display='flex';
    matView.classList.add('fade-enter');
    
    fRenderMaterialCatalog(camp, matView);

    matView.getBoundingClientRect(); // force reflow
    matView.classList.remove('fade-enter');
    matView.classList.add('fade-enter-active');

    setTimeout(() => {
      matView.classList.remove('fade-enter-active');
    }, 250);
  }, 200);
}
function fRenderMaterialCatalog(camp, container){
  const materials = fGetMaterialsForCamp(camp.id);
  const validMat = materials.filter(m=>fIsMaterialValid(m));
  const expired = materials.length - validMat.length;
  if(!validMat.length){
    container.innerHTML=`
      <div class="f-mat-shell">
        <header class="f-mat-hero">
          <button class="f-mat-back" type="button" onclick="fCloseMaterialCatalog()" aria-label="Voltar para campanhas">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          <div class="f-mat-head-title">
            <div class="f-mat-breadcrumb">Catálogo <span aria-hidden="true">/</span> Campanha</div>
            <h1 class="f-mat-camp-name">${gEsc(camp.name)}</h1>
            <p class="f-mat-camp-sub">Os materiais desta campanha aparecerão aqui assim que estiverem disponíveis.</p>
          </div>
        </header>
        <div class="f-mat-empty">
          <div class="f-mat-empty-icon" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 2h14M5 22h14M19 2v6.34a2 2 0 0 1-.586 1.414L13.828 14.4a2 2 0 0 0 0 2.828l4.586 4.586A2 2 0 0 1 19 21.23V22M5 2v6.34a2 2 0 0 0 .586 1.414L10.172 14.4a2 2 0 0 1 0 2.828l-4.586 4.586A2 2 0 0 0 5 21.23V22"/></svg></div>
          <div class="f-mat-empty-title">Novos materiais em preparação</div>
          <div class="f-mat-empty-text">${expired ? 'Os materiais anteriores desta campanha expiraram. ' : ''}Enquanto o time prepara as próximas opções, você pode explorar outra campanha.</div>
          <button class="f-mat-empty-action" type="button" onclick="fCloseMaterialCatalog()">Explorar campanhas</button>
        </div>
      </div>`;
    if(typeof fMarkCampSeen==='function') fMarkCampSeen(camp.id);
    return;
  }
  const fmtLabels={story:'Story',feed:'Feed',wide:'Post wide',post:'Post wide'};
  const formats=[...new Set(validMat.map(m=>fmtLabels[m.fmt]||'Story'))];
  container.innerHTML=`
    <div class="f-mat-shell">
      <header class="f-mat-hero">
        <button class="f-mat-back" type="button" onclick="fCloseMaterialCatalog()" aria-label="Voltar para campanhas">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <div class="f-mat-head-title">
          <div class="f-mat-breadcrumb">Catálogo <span aria-hidden="true">/</span> Campanha</div>
          <h1 class="f-mat-camp-name">${gEsc(camp.name)}</h1>
          <p class="f-mat-camp-sub">Escolha o formato ideal. Depois, o Luma guia você na personalização.</p>
          <div class="f-mat-summary" aria-label="Resumo da campanha">
            <span class="f-mat-count"><strong>${validMat.length}</strong> ${validMat.length>1?'materiais':'material'}</span>
            ${formats.map(fmt=>`<span class="f-mat-summary-chip">${gEsc(fmt)}</span>`).join('')}
          </div>
        </div>
        <div class="f-mat-hero-mark" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
      </header>
      <section class="f-mat-content" aria-labelledby="f-mat-section-title">
        <div class="f-mat-section-head">
          <div>
            <div class="f-mat-section-kicker">Materiais disponíveis</div>
            <h2 id="f-mat-section-title">Por onde você quer começar?</h2>
          </div>
          <p>Você poderá revisar tudo antes de baixar.</p>
        </div>
        <div class="f-mat-grid">
          ${validMat.map(m=>fRenderMaterialCard(m, camp)).join('')}
        </div>
      </section>
    </div>
  `;
  // Thumbs FIÉIS: renderiza a arte real de cada material (mesmo motor do PNG) por cima
  // do placeholder colorido — que permanece como fallback se o render falhar.
  if(typeof fRenderPreviewToCanvas==='function'){
    validMat.forEach(m=>{
      if(!(m.layers&&m.layers.length)) return;
      const cv=document.getElementById('f-mat-cv-'+m.id);
      if(!cv) return;
      const card=cv.closest('.f-mat-card');
      try{
        Promise.resolve(fRenderPreviewToCanvas(cv, m, {maxPx:520, camp:{color:camp.color||'#FF9000'}, dados:m._demoDados}))
          .then(()=>{ if(card) card.classList.remove('is-rendering'); })
          .catch(()=>{ if(card){ card.classList.remove('is-rendering'); card.classList.add('has-preview-error'); } });
      }catch(e){
        if(card){ card.classList.remove('is-rendering'); card.classList.add('has-preview-error'); }
      }
    });
  }
  // Só marca a campanha como "vista" DEPOIS de renderar os cards (fRenderMaterialCard lê o
  // seen anterior p/ decidir a tag "novo"); assim o badge some só na próxima abertura.
  if(typeof fMarkCampSeen==='function') fMarkCampSeen(camp.id);
}
function fRenderMaterialCard(material, camp){
  const validade = material.publishMeta.validade;
  let validadeLabel='';
  if(validade){
    const v=new Date(validade+'T23:59:59');
    const diff=Math.ceil((v.getTime()-Date.now())/(24*60*60*1000));
    if(diff<=3) validadeLabel=`<span class="f-mat-urgency" style="display:inline-flex;align-items:center;gap:4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${diff}d restantes</span>`;
    else validadeLabel=`<span class="f-mat-validade">válido até ${v.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}</span>`;
  }
  // Mini-prévia: usa fmt do template
  const fmtName = {story:'Story 9:16',feed:'Feed 1:1',wide:'Post wide',post:'Post wide'}[material.fmt] || 'Story';
  const isNew = (typeof fMaterialIsNew==='function') && fMaterialIsNew(material, camp.id);
  const renderState=(material.layers&&material.layers.length)?' is-rendering':'';
  return `<button class="f-mat-card${renderState}" type="button" onclick="fSelectMaterial('${material.id}',this)" aria-label="Personalizar ${gEsc(material.name)}, formato ${gEsc(fmtName)}">
    <div class="f-mat-preview">
      <div class="f-mat-thumb f-mat-thumb-${material.fmt||'story'}" style="background:${camp.color}">
        ${isNew?`<div class="f-mat-new">Novo</div>`:''}
        <div class="f-mat-thumb-prod">${gEsc(camp.previewProd||camp.name)}</div>
        ${camp.previewPor?`<div class="f-mat-thumb-por">${gEsc(camp.previewPor)}</div>`:''}
        <div class="f-mat-thumb-logo" role="img" aria-label="Delivery Much"></div>
        <canvas class="f-mat-cv" id="f-mat-cv-${material.id}" aria-hidden="true"></canvas>
        <div class="f-mat-thumb-tag">${material.fmt==='feed'?'FEED':material.fmt==='wide'||material.fmt==='post'?'POST':'STORY'}</div>
      </div>
      <div class="f-mat-preview-loading" aria-hidden="true"><span></span></div>
    </div>
    <div class="f-mat-info">
      <div class="f-mat-info-main">
        <div class="f-mat-name">${gEsc(material.name)}</div>
        <div class="f-mat-action" aria-hidden="true">Personalizar <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></div>
      </div>
      <div class="f-mat-meta">
        <span class="f-mat-fmt">${fmtName}</span>
        ${validadeLabel}
      </div>
    </div>
  </button>`;
}
function fCloseMaterialCatalog(){
  fState.materialView=false;
  try{ document.body.classList.remove('f-material-browser'); }catch(e){}
  fState.camp={id:'',name:'',color:'#FF9000',perguntas:[]};
  // Sai da pasta → o mundo volta a ser Luma JÁ AQUI (síncrono). Antes ficava pro
  // fRestoreCatalog dentro do setTimeout — e o early-return de navegação rápida
  // ("Minhas artes" na janela do fade) vazava o tema pra fora da campanha.
  if(typeof fRemoveCampTheme==='function') fRemoveCampTheme();
  const chatCol=document.getElementById('f-chat-col');
  const matView=document.getElementById('f-material-view');
  if(matView) {
    matView.classList.add('fade-exit');
  }

  setTimeout(() => {
    if(matView) {
      matView.style.display='none';
      matView.classList.remove('fade-exit');
    }

    chatCol.style.display='';
    chatCol.classList.add('fade-enter');

    // O usuário pode ter navegado DENTRO da janela do fade (200ms) — ex.: clicar em
    // "Minhas artes" logo após voltar. Este callback atrasado chamava fGoHome() mesmo
    // assim, derrubando o modo histórico e deixando o rail num estado misto (catálogo
    // escondido + histórico espremido) — o bug intermitente da página "toda bugada".
    // Estado mais novo vence: se já está no histórico ou noutro material, só limpa o fade.
    const _navegou = document.body.classList.contains('f-history-mode')
      || document.body.classList.contains('f-material-browser')
      || (fState && fState.material);
    if(_navegou){ chatCol.classList.remove('fade-enter'); return; }

    fRestoreCatalog();
    fUpdateCtx();
    // Voltar dos materiais → HOME (vitrine). O chat por trás fica no estado
    // de boas-vindas (fallback caso o modo home seja desligado).
    if(typeof fShowWelcome==='function') fShowWelcome();
    else { document.getElementById('f-messages').innerHTML=''; fAddBot('Escolha uma campanha no painel à esquerda pra começar.',[]); }
    if(typeof fGoHome==='function') fGoHome();

    chatCol.getBoundingClientRect(); // force reflow
    chatCol.classList.remove('fade-enter');
    chatCol.classList.add('fade-enter-active');

    setTimeout(() => {
      chatCol.classList.remove('fade-enter-active');
    }, 250);
  }, 200);
}
// Conjunto de variáveis usadas como IMAGEM num template (layers frame/image com imgVar).
// Helper único usado por fSelectMaterial e fEditFromHist para detecção consistente (M14).
function fMaterialImageVars(layers){
  const set=new Set();
  (layers||[]).forEach(l=>{ if(l.imgVar && (l.type==='frame'||l.type==='image')) set.add(l.imgVar); });
  return set;
}
// Garante as layers de um template sincronizado do backend (o sync de pastas não traz
// layers — lazy). O designer já faz isso em dLoadTemplate; sem o mesmo fetch AQUI,
// cross-device o chat nascia sem perguntas e a prévia mostrava um snapshot velho/vazio.
// Dedup: fetches concorrentes do mesmo template compartilham a mesma Promise
// (fila de thumbs da home + clique do usuário não baixam o mesmo JSON duas vezes).
const _fLayersFetch={}; // remoteId → Promise em andamento
async function fEnsureMaterialLayers(t){
  if(!t || !t._needsLayersFetch || !t.remoteId) return t;
  const sb=(typeof gSupabase==='function')?gSupabase():window.sb;
  if(!sb) return t;
  if(!_fLayersFetch[t.remoteId]){
    _fLayersFetch[t.remoteId]=(async()=>{
      try{
        const {data}=await sb.schema('luma').from('templates').select('layers').eq('id',t.remoteId).single();
        if(data){ t.layers=Array.isArray(data.layers)?data.layers:[]; t._needsLayersFetch=false; }
      }catch(e){ console.warn('[material] fetch de layers falhou:', e); }
      finally{ delete _fLayersFetch[t.remoteId]; }
    })();
  }
  await _fLayersFetch[t.remoteId];
  return t;
}
// Usuário clicou num material — entra no chat com perguntas geradas das variáveis do template
async function fSelectMaterial(materialId, card){
  // Acha o material em qualquer pasta
  let found=null, folderFound=null;
  if(typeof dFolders !== 'undefined' && dFolders){
    for(const f of dFolders){
      const t=f.templates.find(x=>x.id===materialId);
      if(t){ found=t; folderFound=f; break; }
    }
  }
  if(!found) found=_fFindDemoMaterial(materialId); // material-demo (pasta sem material real publicado)
  if(!found){ gToast('Não achei esse material.'); return; }
  // Catálogo leve: baixa os layers deste template agora (1ª vez neste aparelho)
  const title=card&&card.querySelector('.f-mat-name');
  const previousTitle=title&&title.innerHTML;
  const restoreLoading=()=>{
    if(!card) return;
    card.classList.remove('is-loading');
    card.style.pointerEvents='';
    if(title) title.innerHTML=previousTitle;
  };
  if(found._needsLayersFetch && card){
    card.classList.add('is-loading');
    card.style.pointerEvents='none';
    if(title) title.innerHTML='<span class="mini-spinner" aria-hidden="true"></span><span style="margin-left:6px">Abrindo material…</span>';
  }
  try{ await fEnsureMaterialLayers(found); }
  finally{ restoreLoading(); }
  if(found._needsLayersFetch){ // fetch falhou (sem rede?) — não entra no chat com material vazio
    gToast('Não consegui carregar este material. Verifique sua conexão e tente de novo.','error');
    return;
  }
  // Sincroniza formato com o do template (story/feed/wide → mapeia pra FMTS)
  const fmtMap = {story:'story', feed:'feed', wide:'post', post:'post'};
  const targetFmtId = fmtMap[found.fmt] || 'story';
  const targetFmt = FMTS.find(f=>f.id===targetFmtId);
  if(targetFmt) fState.fmt = targetFmt;
  fState.material=found;
  // Funil campanha → material → arte: precisa de camp_id + template_id p/ cruzar com os
  // outros eventos (antes só mandava o nome, o funil não fechava). campId da pasta dona.
  if(typeof gTrackEvent==='function') gTrackEvent('material_aberto',{
    camp_id:(folderFound&&(folderFound.campId||folderFound.remoteId||folderFound.id))||null,
    template_id:found.remoteId||found.id||null, template_name:found.name||'',
    fmt_id:found.fmt||'', demo:!!found._demo });
  if (typeof gTriggerOnboardingStep === 'function') {
    gTriggerOnboardingStep('choseMaterial');
  }
  fState.materialView=false;
  try{ document.body.classList.remove('f-material-browser'); }catch(e){}
  // Constrói perguntas a partir das variáveis do template + permissões definidas pelo designer
  const vars = dExtractTemplateVars(found.layers);
  // V7: respeita a ordem do catálogo dVars (designer reordena → muda a ordem das perguntas).
  // Vars sem entrada no catálogo vão para o fim, preservando a ordem original.
  if(typeof dVars!=='undefined' && dVars && dVars.length){
    const ord=n=>{const i=dVars.findIndex(v=>v.name===n);return i<0?Infinity:i;};
    vars.sort((a,b)=>{const da=ord(a),db=ord(b);return da===db?0:da-db;});
  }
  const permissoes = found.publishMeta?.permissoes || {};
  // Detecção robusta de variáveis tipo imagem: usa dVars OU verifica se a var é usada em layer frame/image
  const imageVarsByLayer = fMaterialImageVars(found.layers);
  const perguntas=[];
  vars.forEach(v=>{
    const perm = permissoes[v];
    // Se editável foi marcado como false, pula
    if(perm && perm.edit === false) return;
    const vDef = (typeof dVars !== 'undefined' && dVars) ? dVars.find(x=>x.name===v) : null;
    const label = vDef ? vDef.label : v.replace(/_/g,' ');
    const isImage = (vDef ? vDef.type==='image' : false) || imageVarsByLayer.has(v);
    if(isImage){
      // Pergunta especial de upload de imagem
      perguntas.push({
        id: v,
        texto: `Envie a <strong>${gEsc(label.toLowerCase())}</strong>`,
        sugestoes: [],
        isImage: true,
        label: label,
        maxLen: 0
      });
    } else {
      // Tipos ricos (4.1): select/boolean/color viram Quick Replies prontas
      let sugestoes;
      if(vDef && vDef.type==='select' && vDef.options && vDef.options.length) sugestoes=vDef.options.slice();
      else if(vDef && vDef.type==='boolean') sugestoes=['Sim','Não'];
      else if(vDef && vDef.type==='color' && vDef.palette && vDef.palette.length) sugestoes=vDef.palette.slice();
      else sugestoes=fGetSuggestionsForVar(v, fState.camp);
      perguntas.push({
        id: v,
        texto: `Qual é o <strong>${gEsc(label.toLowerCase())}</strong> que você quer usar?`,
        sugestoes,
        maxLen: perm?.maxLen || 32,
        label: label
      });
    }
  });
  // Se o template não tem nenhuma variável editável, mostra direto a confirmação
  if(!perguntas.length){
    perguntas.push({id:'_dummy', texto:'Este material não tem campos editáveis. Posso gerar do jeito que está?', sugestoes:['Sim, gerar agora'], maxLen:60, label:'confirmar'});
  }
  // Aplica perguntas customizadas à campanha atual
  fState.camp = {...fState.camp, perguntas, materialName: found.name};
  // Switch para a view de chat
  const chatCol=document.getElementById('f-chat-col');
  const matView=document.getElementById('f-material-view');
  if(matView) matView.style.display='none';
  chatCol.style.display='';
  if(typeof _fMuchPlusHeaderPlay==='function') _fMuchPlusHeaderPlay(); // header voltou a aparecer → motion do tema toca agora
  fUpdateCtx();
  // Limpa estado anterior
  fState.dados={};
  fState.done=false;
  fState.stepIdx=-1;
  // Inicia chat com mensagem específica deste material
  fStartChatComMaterial(found);
}
