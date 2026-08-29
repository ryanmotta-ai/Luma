/**
 * js/franqueado/prefs-panel.js
 *
 * Tela "Lojas e fotos" — aba do painel de conta (gOpenUserProfileModal).
 *
 * O franqueado já podia SALVAR uma loja (chat.js) e reusar FOTOS recentes
 * (upload-panel.js), mas não tinha onde MEXER nisso: renomear a pizzaria,
 * trocar o logo que veio torto, apagar a foto errada. Esta é essa tela.
 *
 * Não inventa dado novo: lê e escreve as MESMAS chaves de sempre —
 *   · lojas  → prefs.js (dm_lojas_v1)
 *   · fotos  → upload-panel.js (dm_recent_imgs_v1 + imagem no IndexedDB)
 *
 * Depende de: prefs.js, upload-panel.js, core/img-store.js (gResolveImgUrl/gIdbDel),
 *   chat.js (fResizeImageIfNeeded), core/toast.js (gEsc/gToast/gConfirm),
 *   franqueado/history.js (fFormatHistDate).
 */

const F_LOJAS_MAX = 12;                 // mesmo teto do slice de fSaveLojas
let _fppForm = null;                    // null | 'new' | id da loja em edição
let _fppDraftLogo = '';                 // logo pendente no formulário (dataURL)

/* ── Ícones (SVG inline, stroke currentColor — regra da casa: nada de emoji) ── */
const _FPP_ICO = {
  store:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l1-5h16l1 5"/><path d="M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><path d="M3 9h18"/></svg>',
  photo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.8"/><path d="m5 17 4.5-4.5 3 3L16 12l3 3"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  pencil:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/></svg>',
  close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  upload:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  whats:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l2.2-5.5A8.4 8.4 0 1 1 21 11.5z"/></svg>'
};

/* Cor só entra em style="" se for hex de verdade — dado do usuário não vira CSS cru. */
function _fppSafeColor(c){ return (typeof c==='string' && /^#[0-9a-fA-F]{3,8}$/.test(c.trim())) ? c.trim() : ''; }
function _fppInitial(nome){ const s=(nome||'?').trim(); return s ? s.charAt(0).toUpperCase() : '?'; }

/* ── Entrada externa: abre o painel de conta já nesta aba ── */
function fPrefsPanelOpen(){
  if(typeof gOpenUserProfileModal!=='function') return;
  gOpenUserProfileModal();
  setTimeout(()=>{ if(typeof gProfileSwitchTab==='function') gProfileSwitchTab('atalhos'); }, 60);
}

/* ── RENDER ── */
function fPrefsPanelRender(){
  const pane=document.getElementById('prof-pane-atalhos'); if(!pane) return;
  pane.innerHTML = _fppLojasHTML() + _fppFotosHTML();
  // Stagger da entrada: um índice por linha, o CSS cuida do resto.
  pane.querySelectorAll('.fpp-row,.fpp-photo').forEach((el,i)=>el.style.setProperty('--fi',Math.min(i,9)));
}

function _fppLojasHTML(){
  const lojas=(typeof fGetLojas==='function') ? fGetLojas() : [];
  const cheio=lojas.length>=F_LOJAS_MAX;
  const addBtn=`<button type="button" class="prof-btn prof-btn-secondary fpp-add" onclick="fPrefsPanelNewLoja()"${cheio?' disabled title="Você chegou no limite de '+F_LOJAS_MAX+' lojas. Apague uma para salvar outra."':''}>${_FPP_ICO.plus}<span>Adicionar loja</span></button>`;

  const lista = lojas.length
    ? `<ul class="fpp-list" role="list">${lojas.filter(l=>l.id!==_fppForm).map(l=>_fppLojaRow(l)).join('')}</ul>`
    : `<div class="fpp-empty">
         <span class="fpp-empty-ico">${_FPP_ICO.store}</span>
         <strong>Nenhuma loja salva ainda</strong>
         <span>Salve o logo, a cor e o WhatsApp de cada parceiro. Na próxima arte, um toque preenche tudo isso de uma vez.</span>
         <button type="button" class="prof-btn prof-btn-primary" onclick="fPrefsPanelNewLoja()">${_FPP_ICO.plus}<span>Adicionar a primeira loja</span></button>
       </div>`;

  return `<section class="fpp-sec" aria-labelledby="fpp-lojas-title">
    <div class="prof-section-head">
      <div>
        <h4 id="fpp-lojas-title">Minhas lojas</h4>
        <p>Os dados de cada parceiro salvos uma vez. No começo de cada arte, o Luma oferece a loja e você não redigita nada.</p>
      </div>
      ${lojas.length?addBtn:''}
    </div>
    ${_fppForm ? _fppFormHTML() : ''}
    ${lista}
    ${lojas.length?`<p class="fpp-note">${lojas.length} de ${F_LOJAS_MAX} lojas · guardadas neste aparelho</p>`:''}
  </section>`;
}

function _fppLojaRow(l){
  const id=gEsc(l.id||'');
  const nome=gEsc(l.nome||'Minha loja');
  const cor=_fppSafeColor(l.cor);
  const logo=l.logo?`<img src="${gEsc(l.logo)}" alt=""/>`:`<span class="fpp-avatar-txt">${gEsc(_fppInitial(l.nome))}</span>`;
  const meta=[];
  if(cor) meta.push(`<span class="fpp-meta-item"><i class="fpp-swatch" style="background:${cor}"></i>${gEsc(cor.toUpperCase())}</span>`);
  if(l.whatsapp) meta.push(`<span class="fpp-meta-item">${_FPP_ICO.whats}${gEsc(l.whatsapp)}</span>`);
  if(!l.logo) meta.push(`<span class="fpp-meta-item fpp-meta-warn">Sem logo salvo</span>`);

  return `<li class="fpp-row"${cor?` style="--fpp-accent:${cor}"`:''}>
    <span class="fpp-avatar" aria-hidden="true">${logo}</span>
    <span class="fpp-row-copy">
      <strong>${nome}</strong>
      <span class="fpp-row-meta">${meta.join('')||'<span class="fpp-meta-item">Só o nome salvo</span>'}</span>
    </span>
    <span class="fpp-row-acts">
      <button type="button" class="fpp-act" onclick="fPrefsPanelEditLoja('${id}')" title="Editar ${nome}" aria-label="Editar ${nome}">${_FPP_ICO.pencil}</button>
      <button type="button" class="fpp-act fpp-act-danger" onclick="fPrefsPanelDeleteLoja('${id}')" title="Excluir ${nome}" aria-label="Excluir ${nome}">${_FPP_ICO.trash}</button>
    </span>
  </li>`;
}

function _fppFormHTML(){
  const novo=_fppForm==='new';
  const l = novo ? {} : ((typeof fGetLojas==='function'?fGetLojas():[]).find(x=>x.id===_fppForm) || {});
  const logo=_fppDraftLogo || l.logo || '';
  const cor=_fppSafeColor(l.cor) || '#FF9000';
  return `<form class="fpp-form" onsubmit="fPrefsPanelSubmit(event)">
    <div class="fpp-form-head">
      <h5>${novo?'Nova loja':'Editar loja'}</h5>
      <button type="button" class="fpp-act" onclick="fPrefsPanelCancelForm()" aria-label="Fechar formulário">${_FPP_ICO.close}</button>
    </div>
    <div class="fpp-form-grid">
      <button type="button" class="fpp-logo-drop${logo?' has-img':''}" onclick="fPrefsPanelPickLogo()" aria-label="${logo?'Trocar o logo da loja':'Enviar o logo da loja'}">
        ${logo?`<img src="${gEsc(logo)}" alt="Logo da loja"/>`:`<span class="fpp-logo-drop-ico">${_FPP_ICO.upload}</span><span class="fpp-logo-drop-txt">Enviar logo<small>PNG ou JPG</small></span>`}
        <input type="file" id="fpp-logo-input" accept="image/png,image/jpeg,image/webp" hidden onchange="fPrefsPanelLogoFile(this)"/>
      </button>
      <div class="fpp-form-fields">
        <div class="prof-field">
          <label class="prof-label" for="fpp-nome">Nome da loja</label>
          <input class="prof-input" id="fpp-nome" maxlength="30" required placeholder="Ex.: Pizzaria do João" value="${gEsc(l.nome||'')}"/>
        </div>
        <div class="fpp-form-pair">
          <div class="prof-field">
            <label class="prof-label" for="fpp-cor">Cor da marca</label>
            <span class="fpp-color-wrap">
              <input type="color" id="fpp-cor" value="${cor}" aria-label="Escolher a cor da marca" oninput="document.getElementById('fpp-cor-hex').value=this.value.toUpperCase()"/>
              <input class="prof-input fpp-color-hex" id="fpp-cor-hex" maxlength="7" value="${gEsc(cor.toUpperCase())}" oninput="try{document.getElementById('fpp-cor').value=this.value}catch(e){}"/>
            </span>
          </div>
          <div class="prof-field">
            <label class="prof-label" for="fpp-whats">WhatsApp <span class="prof-field-optional">opcional</span></label>
            <input class="prof-input" id="fpp-whats" maxlength="20" placeholder="(54) 99999-0000" value="${gEsc(l.whatsapp||'')}"/>
          </div>
        </div>
      </div>
    </div>
    <div class="fpp-form-acts">
      ${logo?`<button type="button" class="fpp-link-btn" onclick="fPrefsPanelClearLogo()">Remover logo</button>`:'<span></span>'}
      <span class="fpp-form-btns">
        <button type="button" class="prof-btn prof-btn-secondary" onclick="fPrefsPanelCancelForm()">Cancelar</button>
        <button type="submit" class="prof-btn prof-btn-primary">Salvar loja</button>
      </span>
    </div>
  </form>`;
}

function _fppFotosHTML(){
  const fotos=(typeof fGetRecentImgs==='function') ? fGetRecentImgs() : [];
  const grid = fotos.length
    ? `<div class="fpp-photos">${fotos.map((r,i)=>{
        const when=(typeof fFormatHistDate==='function')?fFormatHistDate(r.ts):'';
        const tipo=(r.field==='logo_loja')?'Logo':'Foto';
        return `<figure class="fpp-photo">
          <button type="button" class="fpp-photo-btn" onclick="fPrefsPanelZoom(${i})" aria-label="Ver ${tipo.toLowerCase()} em tamanho maior">
            <img src="${gEsc(r.thumb||'')}" alt="${tipo} enviada em ${gEsc(when)}"/>
          </button>
          <button type="button" class="fpp-photo-del" onclick="fPrefsPanelDeletePhoto(${i})" title="Apagar esta foto" aria-label="Apagar esta foto">${_FPP_ICO.trash}</button>
          <figcaption>${gEsc(tipo)}<span>${gEsc(when)}</span></figcaption>
        </figure>`;
      }).join('')}</div>`
    : `<div class="fpp-empty">
         <span class="fpp-empty-ico">${_FPP_ICO.photo}</span>
         <strong>Nenhuma foto guardada ainda</strong>
         <span>Toda foto que você envia numa arte fica aqui pelas próximas ${F_RECENT_CAP} vezes — para reaproveitar sem enviar de novo.</span>
       </div>`;

  return `<section class="fpp-sec" aria-labelledby="fpp-fotos-title">
    <div class="prof-section-head">
      <div>
        <h4 id="fpp-fotos-title">Minhas fotos</h4>
        <p>As últimas ${F_RECENT_CAP} imagens que você enviou. No chat elas aparecem para reusar num toque, sem subir tudo de novo.</p>
      </div>
      ${(typeof fGetRecentImgs==='function' && fGetRecentImgs().length)
        ? `<button type="button" class="fpp-link-btn fpp-link-danger" onclick="fPrefsPanelClearPhotos()">Apagar todas</button>` : ''}
    </div>
    ${grid}
    <p class="fpp-note">Ficam guardadas só neste navegador. Em outro aparelho, envie de novo.</p>
  </section>`;
}

/* ── AÇÕES · LOJAS ── */
function fPrefsPanelNewLoja(){
  const lojas=(typeof fGetLojas==='function')?fGetLojas():[];
  if(lojas.length>=F_LOJAS_MAX){ if(typeof gToast==='function') gToast(`Limite de ${F_LOJAS_MAX} lojas. Apague uma para salvar outra.`,'warning'); return; }
  _fppForm='new'; _fppDraftLogo=''; fPrefsPanelRender();
  const n=document.getElementById('fpp-nome'); if(n) n.focus();
}
function fPrefsPanelEditLoja(id){
  _fppForm=id; _fppDraftLogo=''; fPrefsPanelRender();
  const n=document.getElementById('fpp-nome'); if(n){ n.focus(); try{ n.setSelectionRange(n.value.length,n.value.length); }catch(e){} }
}
function fPrefsPanelCancelForm(){ _fppForm=null; _fppDraftLogo=''; fPrefsPanelRender(); }
function fPrefsPanelPickLogo(){ const i=document.getElementById('fpp-logo-input'); if(i) i.click(); }
function fPrefsPanelClearLogo(){
  _fppDraftLogo='';
  // Some do formulário E da loja em edição: "remover" tem que remover de verdade.
  if(_fppForm && _fppForm!=='new' && typeof fGetLojas==='function'){
    const arr=fGetLojas(); const l=arr.find(x=>x.id===_fppForm);
    if(l){ delete l.logo; fSaveLojas(arr); }
  }
  fPrefsPanelRender();
}
function fPrefsPanelLogoFile(input){
  const file=input && input.files && input.files[0]; if(!file) return;
  if(!file.type.startsWith('image/')){ if(typeof gToast==='function') gToast('Esse arquivo não é uma imagem.','error'); return; }
  if(file.size>20*1024*1024){ if(typeof gToast==='function') gToast(`Imagem muito grande (${(file.size/1024/1024).toFixed(1)}MB). Máximo 20MB.`,'error'); return; }
  const rd=new FileReader();
  rd.onerror=()=>{ if(typeof gToast==='function') gToast('Não consegui ler essa imagem. Tente outra.','error'); };
  rd.onload=(e)=>{
    // 400px: mesmo teto do logo salvo pelo chat — logo grande estoura a cota do localStorage.
    const finish=(small)=>{ _fppDraftLogo=small; _fppKeepFormValues(); fPrefsPanelRender(); };
    if(typeof fResizeImageIfNeeded==='function') fResizeImageIfNeeded(e.target.result,400,finish);
    else finish(e.target.result);
  };
  rd.readAsDataURL(file);
}
// Guarda o que já foi digitado antes de um re-render (o form é reconstruído inteiro).
let _fppPending=null;
function _fppKeepFormValues(){
  const n=document.getElementById('fpp-nome');
  if(!n) return;
  _fppPending={nome:n.value, cor:(document.getElementById('fpp-cor-hex')||{}).value, whatsapp:(document.getElementById('fpp-whats')||{}).value};
  setTimeout(()=>{
    if(!_fppPending) return;
    const n2=document.getElementById('fpp-nome'); if(n2) n2.value=_fppPending.nome||'';
    const c2=document.getElementById('fpp-cor-hex'); if(c2 && _fppPending.cor){ c2.value=_fppPending.cor; const cp=document.getElementById('fpp-cor'); if(cp && _fppSafeColor(_fppPending.cor)) cp.value=_fppPending.cor; }
    const w2=document.getElementById('fpp-whats'); if(w2) w2.value=_fppPending.whatsapp||'';
    _fppPending=null;
  },0);
}
function fPrefsPanelSubmit(ev){
  if(ev) ev.preventDefault();
  const nome=((document.getElementById('fpp-nome')||{}).value||'').trim();
  if(!nome){ if(typeof gToast==='function') gToast('Dê um nome para a loja.','error'); const n=document.getElementById('fpp-nome'); if(n) n.focus(); return; }
  const corRaw=((document.getElementById('fpp-cor-hex')||{}).value||'').trim();
  const cor=_fppSafeColor(corRaw);
  if(corRaw && !cor){ if(typeof gToast==='function') gToast('A cor precisa ser um código hex, como #FF9000.','error'); return; }
  const whatsapp=((document.getElementById('fpp-whats')||{}).value||'').trim();

  const arr=(typeof fGetLojas==='function')?fGetLojas():[];
  const novo=_fppForm==='new';
  const atual=novo?null:arr.find(x=>x.id===_fppForm);
  const logo=_fppDraftLogo || (atual&&atual.logo) || '';
  const loja={ id: novo?('loja-'+Date.now()):_fppForm, nome, cor, whatsapp };
  if(logo) loja.logo=logo;

  let ok;
  if(novo){ arr.unshift(loja); ok=fSaveLojas(arr); }
  else{
    const i=arr.findIndex(x=>x.id===_fppForm);
    if(i<0){ if(typeof gToast==='function') gToast('Essa loja não existe mais.','error'); fPrefsPanelCancelForm(); return; }
    arr[i]=loja; ok=fSaveLojas(arr);
  }
  if(!ok) return;                       // fSaveLojas já avisou (cota cheia)
  _fppForm=null; _fppDraftLogo='';
  fPrefsPanelRender();
  if(typeof gToast==='function') gToast(novo?`Loja "${nome}" salva`:`Loja "${nome}" atualizada`);
}
async function fPrefsPanelDeleteLoja(id){
  const l=(typeof fGetLojas==='function')?fGetLojas().find(x=>x.id===id):null;
  const nome=(l&&l.nome)||'esta loja';
  if(typeof gConfirm==='function'){
    const ok=await gConfirm(`Apagar ${nome}? O logo e os dados salvos somem — as artes já geradas continuam intactas.`,{title:'Apagar loja',okLabel:'Apagar',danger:true});
    if(!ok) return;
  }
  if(typeof fRemoveLoja==='function') fRemoveLoja(id);
  if(_fppForm===id){ _fppForm=null; _fppDraftLogo=''; }
  fPrefsPanelRender();
  if(typeof gToast==='function') gToast('Loja apagada');
}

/* ── AÇÕES · FOTOS ── */
function fPrefsPanelDeletePhoto(i){
  const arr=(typeof fGetRecentImgs==='function')?fGetRecentImgs():[];
  if(!arr[i]) return;
  if(typeof fRemoveRecentImg==='function') fRemoveRecentImg(i);   // regrava o índice E limpa o IndexedDB
  fPrefsPanelRender();
}
async function fPrefsPanelClearPhotos(){
  const arr=(typeof fGetRecentImgs==='function')?fGetRecentImgs():[];
  if(!arr.length) return;
  if(typeof gConfirm==='function'){
    const ok=await gConfirm(`Apagar as ${arr.length} fotos guardadas? Você continua podendo enviar cada uma de novo.`,{title:'Apagar fotos',okLabel:'Apagar todas',danger:true});
    if(!ok) return;
  }
  arr.forEach(e=>_fppForgetIdb(e.ref));
  try{ localStorage.setItem(F_RECENT_KEY,'[]'); }catch(e){}
  fPrefsPanelRender();
  if(typeof gToast==='function') gToast('Fotos apagadas');
}
// Apagar do índice sem apagar a imagem deixaria lixo no IndexedDB pra sempre.
function _fppForgetIdb(ref){
  if(typeof gIdbDel!=='function' || !ref || ref.indexOf('idb://')!==0) return;
  try{ gIdbDel(ref.slice(6)); }catch(e){}
}
function fPrefsPanelZoom(i){
  const entry=((typeof fGetRecentImgs==='function')?fGetRecentImgs():[])[i]; if(!entry) return;
  let host=document.getElementById('fpp-zoom');
  if(!host){
    host=document.createElement('div'); host.id='fpp-zoom'; host.setAttribute('role','dialog');
    host.setAttribute('aria-modal','true'); host.setAttribute('aria-label','Foto em tamanho maior');
    host.addEventListener('click',(e)=>{ if(e.target===host) fPrefsPanelCloseZoom(); });
    document.body.appendChild(host);
    document.addEventListener('keydown',_fppZoomEsc);
  }
  host.innerHTML=`<figure class="fpp-zoom-box">
    <img src="${gEsc(entry.thumb||'')}" alt="Foto enviada" id="fpp-zoom-img"/>
    <button type="button" class="fpp-zoom-close" onclick="fPrefsPanelCloseZoom()" aria-label="Fechar">${_FPP_ICO.close}</button>
  </figure>`;
  requestAnimationFrame(()=>host.classList.add('open'));
  const btn=host.querySelector('.fpp-zoom-close'); if(btn) btn.focus();
  // A thumb entra na hora; a imagem cheia (IndexedDB) substitui quando chegar.
  Promise.resolve(typeof gResolveImgUrl==='function'?gResolveImgUrl(entry.ref):entry.ref)
    // Só troca por um dataURL de verdade: se a imagem sumiu do IndexedDB, a resolução
    // devolve nulo (ou a própria referência) e a thumb continua valendo — melhor uma
    // miniatura do que um ícone de imagem quebrada.
    .then(url=>{ const img=document.getElementById('fpp-zoom-img'); if(img&&url&&url.indexOf('idb://')!==0) img.src=url; })
    .catch(()=>{});
}
function _fppZoomEsc(e){ if(e.key==='Escape') fPrefsPanelCloseZoom(); }
function fPrefsPanelCloseZoom(){
  const host=document.getElementById('fpp-zoom'); if(!host) return;
  host.classList.remove('open');
  document.removeEventListener('keydown',_fppZoomEsc);
  setTimeout(()=>{ if(host&&host.parentNode) host.remove(); },180);
}
