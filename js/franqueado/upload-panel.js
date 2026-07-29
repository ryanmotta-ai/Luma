/**
 * js/franqueado/upload-panel.js
 *
 * Painel de upload do chat do franqueado: ao enviar uma foto, abre um painel com
 *  · Imagens recentes — as últimas usadas, pra reaproveitar sem re-upload.
 *  · Minhas lojas      — perfis de loja salvos (logo), quando o campo é o logo.
 *  · Enviar novo arquivo — o file picker de sempre.
 *
 * Depende de: franqueado/chat.js (_fApplyImageToField, fState, fProcessImageFile),
 *   franqueado/prefs.js (fGetLojas/fRemoveLoja), core/img-store.js (gIdbPut/gResolveImgUrl/gImgHash).
 *
 * ⚠ PERSISTÊNCIA (regra da casa §7): imagem grande NUNCA vai em base64 cru no
 * localStorage (estoura a cota ~5MB). A imagem real mora no IndexedDB (idb://) e o
 * localStorage guarda só o ÍNDICE leve: a referência idb + uma thumb pequena.
 */

const F_RECENT_KEY = 'dm_recent_imgs_v1';
const F_RECENT_CAP = 12;
const F_RECENT_THUMB = 140;            // px da miniatura guardada (leve p/ o localStorage)
let _fUpPanelVar = null, _fUpPanelUploadId = null;

/* ── STORE DE RECENTES (índice no localStorage; imagem no IndexedDB) ── */
function fGetRecentImgs(){
  try{ const a=JSON.parse(localStorage.getItem(F_RECENT_KEY)||'[]'); return Array.isArray(a)?a:[]; }
  catch(e){ return []; }
}
function _fSaveRecentImgs(arr){
  try{ localStorage.setItem(F_RECENT_KEY, JSON.stringify((arr||[]).slice(0,F_RECENT_CAP))); }catch(e){}
}
// Gera uma miniatura pequena (dataURL) a partir de uma imagem maior — só p/ o grid.
function _fMakeThumb(dataUrl, size, cb){
  try{
    const img=new Image();
    img.onload=()=>{
      try{
        const r=Math.min(size/img.width, size/img.height, 1);
        const w=Math.max(1,Math.round(img.width*r)), h=Math.max(1,Math.round(img.height*r));
        const c=document.createElement('canvas'); c.width=w; c.height=h;
        c.getContext('2d').drawImage(img,0,0,w,h);
        cb(c.toDataURL('image/jpeg',0.7));
      }catch(e){ cb(dataUrl); }
    };
    img.onerror=()=>cb(dataUrl);
    img.src=dataUrl;
  }catch(e){ cb(dataUrl); }
}
// Registra uma imagem já usada nos recentes. Fire-and-forget (não bloqueia o chat).
function fRecordRecentImg(resizedUrl, field){
  if(!resizedUrl || typeof resizedUrl!=='string') return;
  if(typeof gIdbPut!=='function' || typeof indexedDB==='undefined') return; // sem idb → não guarda cru
  const key = (typeof gImgHash==='function' ? gImgHash(resizedUrl) : 'rec-'+Date.now());
  const ref = 'idb://'+key;
  try{ gIdbPut(key, resizedUrl); }catch(e){ return; }
  _fMakeThumb(resizedUrl, F_RECENT_THUMB, (thumb)=>{
    let arr=fGetRecentImgs().filter(x=>x.ref!==ref);   // dedup: mesma imagem sobe pro topo
    arr.unshift({ref, thumb, ts:Date.now(), field:field||''});
    _fSaveRecentImgs(arr);
  });
}
function fRemoveRecentImg(i, ev){
  if(ev){ try{ ev.stopPropagation(); }catch(e){} }
  const arr=fGetRecentImgs(); if(i<0||i>=arr.length) return;
  arr.splice(i,1); _fSaveRecentImgs(arr);
  _fRenderUploadPanel(); // re-render in place
}

/* ── PAINEL ── */
function fOpenUploadPanel(varId, uploadId){
  _fUpPanelVar=varId; _fUpPanelUploadId=uploadId;
  const recents=fGetRecentImgs();
  const lojas=(varId==='logo_loja' && typeof fGetLojas==='function') ? fGetLojas() : [];
  // Nada guardado ainda → não faz sentido um painel vazio; vai direto pro arquivo.
  if(!recents.length && !lojas.length){ fUploadPanelNewFile(); return; }
  let host=document.getElementById('f-upload-panel');
  if(!host){
    host=document.createElement('div'); host.id='f-upload-panel';
    host.addEventListener('click',(e)=>{ if(e.target===host) fCloseUploadPanel(); });
    document.body.appendChild(host);
  }
  _fRenderUploadPanel();
  document.addEventListener('keydown', _fUpPanelEsc);
}
function _fUpPanelEsc(e){ if(e.key==='Escape') fCloseUploadPanel(); }
function fCloseUploadPanel(){
  const host=document.getElementById('f-upload-panel'); if(host) host.remove();
  document.removeEventListener('keydown', _fUpPanelEsc);
}
function _fRenderUploadPanel(){
  const host=document.getElementById('f-upload-panel'); if(!host) return;
  const isLogo=_fUpPanelVar==='logo_loja';
  const recents=fGetRecentImgs();
  const lojas=(isLogo && typeof fGetLojas==='function') ? fGetLojas() : [];
  const _icoClose='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  const _icoUp='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
  const _icoStore='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l1-5h16l1 5"/><path d="M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><path d="M3 9h18"/></svg>';
  const _icoTrash='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/></svg>';

  const recentGrid = recents.length
    ? `<div class="f-up-grid">${recents.map((r,i)=>`
        <button type="button" class="f-up-thumb" onclick="fPickRecentImg(${i})" title="Usar esta imagem">
          <img src="${r.thumb}" alt="Imagem recente"/>
          <span class="f-up-thumb-del" onclick="fRemoveRecentImg(${i},event)" title="Remover dos recentes" aria-label="Remover dos recentes">${_icoTrash}</span>
        </button>`).join('')}</div>`
    : `<p class="f-up-empty">Suas fotos usadas vão aparecer aqui pra reaproveitar.</p>`;

  const lojasBlock = isLogo ? `
    <div class="f-up-sec">
      <div class="f-up-sec-head">${_icoStore}<span>Minhas lojas</span></div>
      ${lojas.length
        ? `<div class="f-up-grid f-up-grid-lojas">${lojas.map(l=>`
            <button type="button" class="f-up-loja" onclick="fUploadPanelPickLoja('${l.id}')" title="Usar o logo de ${gEsc(l.nome||'loja')}">
              <span class="f-up-loja-logo">${l.logo?`<img src="${l.logo}" alt=""/>`:_icoStore}</span>
              <span class="f-up-loja-name">${gEsc(l.nome||'Minha loja')}</span>
              <span class="f-up-thumb-del" onclick="fUploadPanelDeleteLoja('${l.id}',event)" title="Excluir loja" aria-label="Excluir loja">${_icoTrash}</span>
            </button>`).join('')}</div>`
        : `<p class="f-up-empty">Salve uma loja ao enviar um logo — o perfil aparece aqui.</p>`}
    </div>` : '';

  host.innerHTML=`
    <div class="f-up-box" role="dialog" aria-modal="true" aria-label="Enviar imagem">
      <div class="f-up-head">
        <h2>${isLogo?'Escolher logo da loja':'Enviar uma foto'}</h2>
        <button type="button" class="f-up-close" onclick="fCloseUploadPanel()" aria-label="Fechar">${_icoClose}</button>
      </div>
      <div class="f-up-body">
        <button type="button" class="f-up-newfile" onclick="fUploadPanelNewFile()">
          <span class="f-up-newfile-ico">${_icoUp}</span>
          <span><strong>Enviar novo arquivo</strong><small>PNG ou JPG, até 20MB</small></span>
        </button>
        ${lojasBlock}
        <div class="f-up-sec">
          <div class="f-up-sec-head"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span>Imagens recentes</span></div>
          ${recentGrid}
        </div>
      </div>
    </div>`;
}

/* ── AÇÕES ── reusam _fApplyImageToField (mesmo finishing do upload normal) ── */
function fUploadPanelNewFile(){
  const inp=_fUpPanelUploadId && document.getElementById(_fUpPanelUploadId+'-input');
  fCloseUploadPanel();
  if(inp) inp.click();
}
function fPickRecentImg(i){
  const arr=fGetRecentImgs(); const entry=arr[i]; if(!entry){ fCloseUploadPanel(); return; }
  const varId=_fUpPanelVar, uploadId=_fUpPanelUploadId;
  // Resolve a referência idb:// → dataURL real (Promise). Aplica no mesmo caminho do upload.
  Promise.resolve(typeof gResolveImgUrl==='function' ? gResolveImgUrl(entry.ref) : entry.ref)
    .then((url)=>{
      if(!url){ if(typeof gToast==='function') gToast('Não consegui carregar essa imagem. Envie de novo.','error'); return; }
      // move pro topo (recém-usada)
      const cur=fGetRecentImgs().filter(x=>x.ref!==entry.ref); cur.unshift({...entry,ts:Date.now()}); _fSaveRecentImgs(cur);
      if(typeof _fApplyImageToField==='function') _fApplyImageToField(varId, uploadId, url);
    })
    .catch(()=>{ if(typeof gToast==='function') gToast('Não consegui carregar essa imagem. Envie de novo.','error'); });
  fCloseUploadPanel();
}
function fUploadPanelPickLoja(id){
  const loja=(typeof fGetLojas==='function') ? fGetLojas().find(l=>l.id===id) : null;
  const uploadId=_fUpPanelUploadId;
  fCloseUploadPanel();
  if(!loja || !loja.logo){ if(typeof gToast==='function') gToast('Essa loja não tem logo salvo.','error'); return; }
  if(typeof _fApplyImageToField==='function') _fApplyImageToField('logo_loja', uploadId, loja.logo);
  if(typeof gToast==='function') gToast(`Logo de ${loja.nome||'sua loja'} aplicado`);
}
function fUploadPanelDeleteLoja(id, ev){
  if(ev){ try{ ev.stopPropagation(); }catch(e){} }
  if(typeof fRemoveLoja==='function') fRemoveLoja(id);
  _fRenderUploadPanel();
}
