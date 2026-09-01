/**
 * js/franqueado/prefs-panel.js
 *
 * Tela "Minhas fotos" — aba do painel de conta (gOpenUserProfileModal).
 *
 * O franqueado reusa FOTOS recentes (upload-panel.js), mas não tinha onde
 * MEXER nisso: apagar a foto errada, ver a imagem maior. Esta é essa tela.
 *
 * A gestão de perfis de loja saiu daqui (não faz sentido no momento do
 * produto). O dado continua existindo em prefs.js (dm_lojas_v1) e o chat
 * segue oferecendo a loja salva — só não há mais tela de gestão.
 *
 * Não inventa dado novo: lê e escreve a MESMA chave de sempre —
 *   · fotos  → upload-panel.js (dm_recent_imgs_v1 + imagem no IndexedDB)
 *
 * Depende de: upload-panel.js, core/img-store.js (gResolveImgUrl/gIdbDel),
 *   core/toast.js (gEsc/gToast/gConfirm), franqueado/history.js (fFormatHistDate).
 */

/* ── Ícones (SVG inline, stroke currentColor — regra da casa: nada de emoji) ── */
const _FPP_ICO = {
  photo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.8"/><path d="m5 17 4.5-4.5 3 3L16 12l3 3"/></svg>',
  trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/></svg>',
  close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'
};

/* ── Entrada externa: abre o painel de conta já nesta aba ── */
function fPrefsPanelOpen(){
  if(typeof gOpenUserProfileModal!=='function') return;
  gOpenUserProfileModal();
  setTimeout(()=>{ if(typeof gProfileSwitchTab==='function') gProfileSwitchTab('atalhos'); }, 60);
}

/* ── RENDER ── */
function fPrefsPanelRender(){
  const pane=document.getElementById('prof-pane-atalhos'); if(!pane) return;
  pane.innerHTML = _fppFotosHTML();
  // Stagger da entrada: um índice por linha, o CSS cuida do resto.
  pane.querySelectorAll('.fpp-photo').forEach((el,i)=>el.style.setProperty('--fi',Math.min(i,9)));
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
