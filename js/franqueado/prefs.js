/**
 * js/franqueado/prefs.js
 *
 * Preferências do franqueado persistidas localmente (cache offline-first):
 *  · Lojas salvas   — perfil de loja reaproveitável (logo/cor/whatsapp) p/ não redigitar.
 *  · Favoritos      — campanhas fixadas no topo da vitrine.
 *  · Materiais vistos — base do badge "novo" (designer publicou algo depois da última visita).
 *  · Busca do histórico — estado do filtro textual de "Minhas artes".
 *
 * Tudo em localStorage com try/catch (regra de persistência: quota ~5MB não pode derrubar o app).
 * Depende de: 00-config.js. Consumido por catalog.js, materials.js, chat.js.
 */

/* ── LOJAS SALVAS (perfil da loja — logo/cor/whatsapp reaproveitáveis) ──
   O franqueado atende vários restaurantes parceiros; salvar a "loja" evita
   reenviar o mesmo logo a cada arte. É só um passo no chat (sem tela de gerência). */
const F_LOJAS_KEY = 'dm_lojas_v1';
function fGetLojas(){ try{ return JSON.parse(localStorage.getItem(F_LOJAS_KEY)||'[]'); }catch(e){ return []; } }
function fSaveLojas(arr){
  try{ localStorage.setItem(F_LOJAS_KEY, JSON.stringify((arr||[]).slice(0,12))); return true; }
  catch(e){ if(typeof gToast==='function') gToast('Não consegui salvar a loja — a memória do navegador encheu. Apague o que não usa e tente de novo.','error'); return false; }
}
function fAddLoja(loja){
  const arr=fGetLojas();
  loja.id = loja.id || ('loja-'+Date.now());
  // Substitui se já existe uma loja com o mesmo nome (evita duplicata silenciosa).
  const i=arr.findIndex(l=>l.nome && loja.nome && l.nome.trim().toLowerCase()===loja.nome.trim().toLowerCase());
  if(i>=0) arr[i]=loja; else arr.unshift(loja);
  fSaveLojas(arr);
  return loja.id;
}
function fRemoveLoja(id){ fSaveLojas(fGetLojas().filter(l=>l.id!==id)); }

/* ── FAVORITOS (campanhas fixadas pelo franqueado) ── */
const F_FAVS_KEY = 'dm_favs_v1';
function fGetFavs(){ try{ return JSON.parse(localStorage.getItem(F_FAVS_KEY)||'[]'); }catch(e){ return []; } }
function fIsFav(id){ return fGetFavs().indexOf(id) >= 0; }
function _fSaveFavs(arr){ try{ localStorage.setItem(F_FAVS_KEY, JSON.stringify(arr)); }catch(e){} }
// Alterna o favorito e re-renderiza onde o franqueado está (home ou catálogo).
// ev: para o clique não "vazar" pro card (que abre a campanha).
function fToggleFav(id, ev){
  if(ev){ try{ ev.stopPropagation(); ev.preventDefault(); }catch(e){} }
  const arr=fGetFavs(); const i=arr.indexOf(id);
  if(i>=0){ arr.splice(i,1); if(typeof gToast==='function') gToast('Removida das favoritas'); }
  else { arr.unshift(id); if(typeof gToast==='function') gToast('Fixada nas favoritas'); }
  _fSaveFavs(arr);
  if(document.body.classList.contains('f-home-mode') && typeof fRenderHome==='function') fRenderHome({silent:true});
  else if(typeof fRestoreCatalog==='function') fRestoreCatalog();
}

/* ── MATERIAIS VISTOS (badge "novo") ──
   Guarda, por campanha, o timestamp da última vez que o franqueado ABRIU a pasta.
   Um material é "novo" se foi publicado depois disso — e só marcamos "novo" para
   campanhas que o franqueado JÁ abriu antes (senão tudo seria novo no 1º acesso). */
const F_SEEN_KEY = 'dm_seen_mats_v1';
function fGetSeen(){ try{ return JSON.parse(localStorage.getItem(F_SEEN_KEY)||'{}'); }catch(e){ return {}; } }
function fMarkCampSeen(campId){
  if(!campId) return;
  try{ const m=fGetSeen(); m[campId]=Date.now(); localStorage.setItem(F_SEEN_KEY, JSON.stringify(m)); }catch(e){}
}
function _fMatPublishedTs(t){ return (t && t.publishMeta && t.publishMeta.publicadoEm) || 0; }
function fMaterialIsNew(m, campId){
  const seen=fGetSeen()[campId];
  if(!seen) return false;                 // campanha nunca aberta → nada é "novo"
  return _fMatPublishedTs(m) > seen;
}
function fCampHasNew(c){
  if(!c) return false;
  const seen=fGetSeen()[c.id];
  if(!seen) return false;
  try{ return fGetMaterialsForCamp(c.id).filter(fIsMaterialValid).some(m=>_fMatPublishedTs(m)>seen); }
  catch(e){ return false; }
}

/* ── Busca textual do histórico ("Minhas artes") ── */
let fHistSearch='';
function fSetHistSearch(q){ fHistSearch = q||''; if(typeof fRenderHist==='function') fRenderHist(); }
