/**
 * js/core/img-store.js
 *
 * Armazenamento de imagens grandes (fundos de PSD, fotos) em IndexedDB, fora do
 * localStorage. O localStorage tem ~5MB e estourava com fundos full-bleed, então
 * gPackImgUrl (00-config.js) descartava imagens >70KB pra '__local__' — e os fundos
 * sumiam após o reload. Agora imagens grandes vão pro IndexedDB e o localStorage guarda
 * só uma referência curta 'idb://<chave>', que é re-hidratada no boot.
 *
 * Sem dependências. Falha mantém os bytes no pack e permite recusar o save;
 * nunca anuncia idb:// antes de a transação confirmar.
 */

const G_IDB_NAME = 'luma-img-v1';
const G_IDB_STORE = 'img';
let _gIdbPromise = null;
const _gImgStored = new Map();
const _gImgWrites = new Map();

function _gIdbOpen(){
  if(_gIdbPromise) return _gIdbPromise;
  // Fotos e fundos sao dados criados pelo usuario. Pede ao navegador para nao
  // eliminar este storage sob pressao; se negar, o IndexedDB segue best-effort.
  try{
    if(typeof navigator!=='undefined' && navigator.storage && typeof navigator.storage.persist==='function'){
      navigator.storage.persist().catch(()=>{});
    }
  }catch(e){}
  _gIdbPromise = new Promise((resolve, reject)=>{
    let settled=false;
    const fail=e=>{if(settled)return;settled=true;clearTimeout(timer);reject(e);};
    const timer=setTimeout(()=>fail(new Error('idb-timeout')),8000);
    try{
      if(typeof indexedDB === 'undefined'){ fail(new Error('no-idb')); return; }
      const req = indexedDB.open(G_IDB_NAME, 1);
      req.onupgradeneeded = ()=>{
        const db = req.result;
        if(!db.objectStoreNames.contains(G_IDB_STORE)) db.createObjectStore(G_IDB_STORE);
      };
      req.onsuccess = ()=>{
        if(settled){req.result.close();return;}
        settled=true;clearTimeout(timer);resolve(req.result);
      };
      req.onerror = ()=>fail(req.error);
    }catch(e){ fail(e); }
  }).catch(e=>{_gIdbPromise=null;throw e;});
  return _gIdbPromise;
}

// Hash determinístico (FNV-1a 32-bit) + comprimento → chave estável por conteúdo.
// Mesma imagem → mesma chave → não duplica no IndexedDB.
function gImgHash(str){
  // AMOSTRAGEM em string grande. Uma foto de 10MB do celular (48MP) vira ~14 milhoes de
  // charCodeAt na thread principal: 3 a 8s de aba congelada no meio do upload, com o
  // aparelho esquentando e nenhum clique respondendo. Acima de 4k chars hasheamos so
  // inicio+fim -- o comprimento continua na chave, entao duas fotos diferentes com os
  // mesmos 2k primeiros E 2k ultimos caracteres de base64 E o mesmo tamanho exato nao
  // acontece na pratica. String curta (chave de cache da IA) segue com hash integral.
  // Trocar o hash NAO quebra o que ja esta gravado: a leitura usa a chave guardada no
  // 'idb://<chave>', nunca recalculada -- so a deduplicacao de um reenvio antigo se perde.
  const alvo = str.length > 4096 ? (str.slice(0,2048) + str.slice(-2048)) : str;
  let h = 0x811c9dc5;
  for(let i=0;i<alvo.length;i++){ h ^= alvo.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h>>>0).toString(36) + '-' + str.length.toString(36);
}

// Grava um dataURL no IndexedDB sob a chave dada. Promise<boolean>. Nunca rejeita.
function gIdbPut(key, dataUrl){
  if(_gImgStored.get(key)===dataUrl) return Promise.resolve(true);
  if(_gImgWrites.has(key)) return _gImgWrites.get(key).then(ok=>
    ok&&_gImgStored.get(key)!==dataUrl?gIdbPut(key,dataUrl):ok);
  const job=_gIdbOpen().then(db=>new Promise((resolve)=>{
    try{
      const tx = db.transaction(G_IDB_STORE, 'readwrite');
      tx.objectStore(G_IDB_STORE).put(dataUrl, key);
      let done=false;
      const finish=ok=>{
        if(done)return;done=true;clearTimeout(timer);
        if(ok)_gImgStored.set(key,dataUrl);
        resolve(ok);
      };
      const timer=setTimeout(()=>{try{tx.abort();}catch(e){}finish(false);},8000);
      tx.oncomplete = ()=>finish(true);
      tx.onerror = ()=>finish(false);
      tx.onabort = ()=>finish(false);
    }catch(e){ resolve(false); }
  })).catch(()=>false).finally(()=>_gImgWrites.delete(key));
  _gImgWrites.set(key,job);
  return job;
}

// O contrato síncrono de pack só pode anunciar uma referência DEPOIS do commit.
function gImgStoredRef(dataUrl){
  const key=gImgHash(dataUrl);
  return _gImgStored.get(key)===dataUrl ? 'idb://'+key : null;
}

// Callers assíncronos podem preparar o save sem trocar os dataURLs vivos das camadas.
function gImgStoreFlush(layers){
  const jobs=[];
  (layers||[]).forEach(l=>{
    ['imgUrl','mask','clipOwnMask'].forEach(prop=>{
      const u=l&&l[prop], limit=prop==='imgUrl'?G_IMG_KEEP_MAX:G_MASK_KEEP_MAX;
      if(typeof u==='string'&&u.startsWith('data:')&&u.length*0.75>limit)
        jobs.push(gIdbPut(gImgHash(u),u));
    });
  });
  return Promise.all(jobs).then(rs=>rs.every(Boolean));
}

// Lê um dataURL do IndexedDB. Promise<string|null>. Nunca rejeita.
function gIdbGet(key){
  return _gIdbOpen().then(db=>new Promise((resolve)=>{
    let timer=null;
    const finish=v=>{clearTimeout(timer);resolve(v);};
    try{
      const tx = db.transaction(G_IDB_STORE, 'readonly');
      const r = tx.objectStore(G_IDB_STORE).get(key);
      timer=setTimeout(()=>finish(null),8000);
      r.onsuccess = ()=>finish(r.result || null);
      r.onerror = ()=>finish(null);
      tx.onabort=()=>finish(null);
    }catch(e){ finish(null); }
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
      tx.oncomplete = ()=>{_gImgStored.delete(key);resolve(true);};
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
    ['imgUrl','mask','clipOwnMask'].forEach(prop=>{
      const ref=l&&l[prop];
      if(typeof ref==='string'&&ref.indexOf('idb://')===0)
        jobs.push(gIdbGet(ref.slice(6)).then(u=>{
          // Undo/sync pode trocar o recurso durante a leitura: não reponha bytes antigos.
          if(u&&l[prop]===ref){l[prop]=u;changed=true;}
        }));
    });
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
