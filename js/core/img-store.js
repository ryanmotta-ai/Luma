/**
 * js/core/img-store.js
 *
 * Armazenamento de imagens grandes (fundos de PSD, fotos) em IndexedDB, fora do
 * localStorage. O localStorage tem ~5MB e estourava com fundos full-bleed, então
 * gPackImgUrl (00-config.js) descartava imagens >70KB pra '__local__' — e os fundos
 * sumiam após o reload. Agora imagens grandes vão pro IndexedDB e o localStorage guarda
 * só uma referência curta 'idb://<chave>', que é re-hidratada no boot.
 *
 * 100% vanilla, sem dependências. Tudo tolerante a falha: IndexedDB indisponível →
 * funções viram no-op e o caller cai no fallback antigo.
 */

const G_IDB_NAME = 'luma-img-v1';
const G_IDB_STORE = 'img';
let _gIdbPromise = null;

function _gIdbOpen(){
  if(_gIdbPromise) return _gIdbPromise;
  _gIdbPromise = new Promise((resolve, reject)=>{
    try{
      if(typeof indexedDB === 'undefined'){ reject(new Error('no-idb')); return; }
      const req = indexedDB.open(G_IDB_NAME, 1);
      req.onupgradeneeded = ()=>{
        const db = req.result;
        if(!db.objectStoreNames.contains(G_IDB_STORE)) db.createObjectStore(G_IDB_STORE);
      };
      req.onsuccess = ()=>resolve(req.result);
      req.onerror = ()=>reject(req.error);
    }catch(e){ reject(e); }
  });
  return _gIdbPromise;
}

// Hash determinístico (FNV-1a 32-bit) + comprimento → chave estável por conteúdo.
// Mesma imagem → mesma chave → não duplica no IndexedDB.
function gImgHash(str){
  let h = 0x811c9dc5;
  for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h>>>0).toString(36) + '-' + str.length.toString(36);
}

// Grava um dataURL no IndexedDB sob a chave dada. Promise<boolean>. Nunca rejeita.
function gIdbPut(key, dataUrl){
  return _gIdbOpen().then(db=>new Promise((resolve)=>{
    try{
      const tx = db.transaction(G_IDB_STORE, 'readwrite');
      tx.objectStore(G_IDB_STORE).put(dataUrl, key);
      tx.oncomplete = ()=>resolve(true);
      tx.onerror = ()=>resolve(false);
      tx.onabort = ()=>resolve(false);
    }catch(e){ resolve(false); }
  })).catch(()=>false);
}

// Lê um dataURL do IndexedDB. Promise<string|null>. Nunca rejeita.
function gIdbGet(key){
  return _gIdbOpen().then(db=>new Promise((resolve)=>{
    try{
      const tx = db.transaction(G_IDB_STORE, 'readonly');
      const r = tx.objectStore(G_IDB_STORE).get(key);
      r.onsuccess = ()=>resolve(r.result || null);
      r.onerror = ()=>resolve(null);
    }catch(e){ resolve(null); }
  })).catch(()=>null);
}

// Apaga uma imagem do IndexedDB. Promise<boolean>. Nunca rejeita.
// Usado quando o dono descarta a imagem de verdade (ex.: apagar uma foto recente):
// tirar só o índice do localStorage deixaria o blob órfão no aparelho pra sempre.
function gIdbDel(key){
  return _gIdbOpen().then(db=>new Promise((resolve)=>{
    try{
      const tx = db.transaction(G_IDB_STORE, 'readwrite');
      tx.objectStore(G_IDB_STORE).delete(key);
      tx.oncomplete = ()=>resolve(true);
      tx.onerror = ()=>resolve(false);
      tx.onabort = ()=>resolve(false);
    }catch(e){ resolve(false); }
  })).catch(()=>false);
}

// Resolve um imgUrl que pode ser 'idb://<chave>' → dataURL real. Outros valores passam direto.
// Promise<string|null>.
function gResolveImgUrl(url){
  if(typeof url === 'string' && url.indexOf('idb://') === 0) return gIdbGet(url.slice(6));
  return Promise.resolve(url);
}

// Re-hidrata um array de layers: troca imgUrl/mask 'idb://...' pelo dataURL real (in-place).
// Promise<boolean> — resolve true se alguma layer foi hidratada (caller pode re-renderizar).
function gHydrateLayers(layers){
  if(!Array.isArray(layers) || !layers.length) return Promise.resolve(false);
  const jobs = [];
  let changed = false;
  layers.forEach(l=>{
    if(l && typeof l.imgUrl === 'string' && l.imgUrl.indexOf('idb://') === 0){
      jobs.push(gIdbGet(l.imgUrl.slice(6)).then(u=>{ if(u){ l.imgUrl = u; changed = true; } }));
    }
    if(l && typeof l.mask === 'string' && l.mask.indexOf('idb://') === 0){
      jobs.push(gIdbGet(l.mask.slice(6)).then(u=>{ if(u){ l.mask = u; changed = true; } }));
    }
  });
  if(!jobs.length) return Promise.resolve(false);
  return Promise.all(jobs).then(()=>changed);
}

// Hidrata todas as layers de todos os templates de todas as pastas (boot do designer/franqueado).
// Promise<boolean> — true se algo mudou.
function gHydrateFolders(folders){
  if(!Array.isArray(folders) || !folders.length) return Promise.resolve(false);
  const groups = [];
  folders.forEach(f=>{ (f.templates||[]).forEach(t=>{ if(Array.isArray(t.layers)) groups.push(t.layers); }); });
  if(!groups.length) return Promise.resolve(false);
  return Promise.all(groups.map(gHydrateLayers)).then(rs=>rs.some(Boolean));
}
