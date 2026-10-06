/**
 * js/franqueado/history.js
 *
 * Historico de artes do franqueado: fGetHist, fSaveHist, fAddHist,
 * fMarkHistBaixada, fUpdateHistBadge, fRenderHist, fDownloadHist.
 * Persiste em localStorage (HIST_KEY).
 * Depende de: 00-config.js (HIST_KEY), 01-state.js (fState)
 */

/* ── HISTÓRICO ── */
// Cache antigo não tem dono verificável: nunca atribuí-lo à próxima conta que entrar.
function fUserCacheKey(key, uid){
  const u=typeof gCurrentUser==='function'?gCurrentUser():null;
  return key+':user:'+encodeURIComponent(uid===undefined?(u&&u.id||'sem-sessao'):uid);
}
const _fHistRecovery=new Map(),_fHistRecoveryJobs=new Map();
let _fHistPage={owner:null,offset:0,more:false,busy:false};
function fGetHist(uid){
  const key=fUserCacheKey(HIST_KEY,uid);
  if(_fHistRecovery.has(key))return JSON.parse(JSON.stringify(_fHistRecovery.get(key)));
  try{const a=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(a)?a:[];}catch(e){return[];}
}
function _fHistBackup(key,items){
  if(typeof gIdbPut!=='function')return;
  const bytes=JSON.stringify(items);
  const job=(_fHistRecoveryJobs.get(key)||Promise.resolve()).catch(()=>{}).then(()=>gIdbPut('hist-recovery:'+key,bytes));
  _fHistRecoveryJobs.set(key,job);
  job.then(ok=>{
    if(_fHistRecoveryJobs.get(key)!==job)return;
    _fHistRecoveryJobs.delete(key);
    if(ok&&items.length&&key===fUserCacheKey(HIST_KEY)&&typeof gToast==='function')gToast('Sua arte foi recuperada e guardada neste aparelho.');
  }).catch(()=>{});
}
function _fStoreHist(key,items){
  try{
    localStorage.setItem(key,JSON.stringify(items));
    if(_fHistRecovery.has(key)||_fHistRecoveryJobs.has(key))_fHistBackup(key,[]);
    _fHistRecovery.delete(key);return true;
  }catch(e){
    // Mesmo sem quota, a arte continua acessível nesta sessão e tenta um store maior.
    _fHistRecovery.set(key,JSON.parse(JSON.stringify(items)));_fHistBackup(key,items);return false;
  }
}
async function fRecoverHist(uid){
  if(typeof gIdbGet!=='function')return;
  const key=fUserCacheKey(HIST_KEY,uid);
  try{
    const raw=await gIdbGet('hist-recovery:'+key),saved=raw&&JSON.parse(raw);
    if(!Array.isArray(saved)||!saved.length)return;
    const byId=new Map(saved.map(h=>[h.remoteId||h.id,h]));
    fGetHist(uid).forEach(h=>byId.set(h.remoteId||h.id,h));
    if(_fStoreHist(key,Array.from(byId.values()).sort((a,b)=>(b.ts||0)-(a.ts||0))))_fHistBackup(key,[]);
  }catch(e){}
}
function fSaveHist(a){
  const ok=_fStoreHist(fUserCacheKey(HIST_KEY),a);
  if(!ok&&typeof gToast==='function')gToast('A memória do navegador encheu. Sua arte continua nesta sessão; estou tentando guardar uma recuperação. Mantenha esta tela aberta.','error');
  // sync Supabase (background, por usuário). .catch: uma rejeição do push (rede/RLS) não
  // pode virar unhandledrejection — o cache local já guardou; o push re-tenta depois.
  if(typeof fPushArtesToBackend==='function'){ try{ const p=fPushArtesToBackend(); if(p&&p.catch) p.catch(()=>{}); }catch(e){} }
  return ok;
}

/* ── Sync do histórico de artes com o Supabase (luma.artes — escopo do usuário) ──
   Offline-first: localStorage é cache; o banco é a fonte por usuário (cross-device).
   Fotos no `dados` vão inline por ora (C2 sobe pro Storage). */
function _fSbArtes(){ if(typeof gVisitante==='function' && gVisitante()) return null; return (typeof gSupabase==='function')?gSupabase():window.sb; }
// Sobe uma foto base64 do franqueado pro bucket público luma-user-uploads → URL pública.
async function _fUploadUserImg(uid, sub, dataUrl){
  const sb=_fSbArtes();
  if(!sb || !uid || typeof dataUrl!=='string' || !dataUrl.startsWith('data:')) return null;
  try{
    const blob=await (await fetch(dataUrl)).blob();
    if(typeof gCurrentUser==='function'&&(!gCurrentUser()||gCurrentUser().id!==uid))return null;
    const ext=((blob.type.split('/')[1]||'png').split('+')[0]).replace(/[^a-z0-9]/gi,'')||'png';
    const path=uid+'/'+String(sub).replace(/[^a-zA-Z0-9_\/-]/g,'_')+'.'+ext;
    const { error }=await sb.storage.from('luma-user-uploads').upload(path, blob, {upsert:true, contentType:blob.type||'image/png'});
    if(error) return null;
    return sb.storage.from('luma-user-uploads').getPublicUrl(path).data.publicUrl;
  }catch(e){ return null; }
}
// Resolve o materialId LOCAL da arte pro UUID do template no banco (luma.artes.template_id
// é UUID com FK). Materiais-demo ('demo-...') e templates locais nunca sincronizados não
// têm UUID → null (linha antiga do banco também é null; o front já trata).
function _fTemplateUuidFor(h){
  const mid=h&&h.materialId; if(!mid) return null;
  // Mesmo motor do catálogo: casa por id local OU por UUID remoto (arte vinda do sync).
  const _t=(typeof fFindMaterialById==='function')?fFindMaterialById(mid):null;
  if(_t) return _t.remoteId||null;
  // Sem catálogo carregado: num device que só puxou do banco o id local JÁ é o UUID remoto.
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(mid))?mid:null;
}
// LOCK: dois pushes simultâneos (arte nova + retomada de sync) intercalavam uploads e
// regravavam o storage um por cima do outro. Um por vez; pedido no meio roda ao final.
let _fArtesPushBusy=false, _fArtesPushQueued=false;
async function fPushArtesToBackend(){
  const sb=_fSbArtes();
  const user=(typeof gCurrentUser==='function')?gCurrentUser():null;
  if(!sb || !user || !user.id) return;
  const cacheKey=fUserCacheKey(HIST_KEY,user.id);
  const sameUser=()=>{const u=typeof gCurrentUser==='function'?gCurrentUser():null; return !!u&&u.id===user.id;};
  if(_fArtesPushBusy){ _fArtesPushQueued=true; return; }
  _fArtesPushBusy=true;
  /* hist/changed/_persistirSync moram AQUI, no escopo da função, e não dentro do `try`.
     Enquanto eram `const` do bloco do try, o `_persistirSync()` do `finally` estourava
     ReferenceError em TODA chamada — inclusive no caminho de sucesso. O erro acontecia
     ANTES de `_fArtesPushBusy=false`, então o lock ficava preso pra sempre: depois do
     primeiro push da sessão, nenhuma arte voltava a subir e a interface seguia dizendo que
     a biblioteca estava no servidor. Só aparecia como rejeição engolida pelo `.catch(()=>{})`
     do fSaveHist. Pego pela suíte tests/franqueado-honestidade.html. */
  const hist=fGetHist(user.id); let changed=false;
  // RELE o storage antes de gravar: uma arte criada/baixada DURANTE os awaits abaixo nao
  // pode ser sobrescrita pelo snapshot velho. Mescla so os campos de sync (remoteId/_synced/
  // dados com URLs) sobre a lista atual -- status/baixada recentes vencem.
  const _persistirSync = ()=>{
    if(!changed) return;
    try{
      const cur=fGetHist(user.id);
      const byId=new Map(hist.map(h=>[h.id,h]));
      const merged=cur.map(c=>{
        const u=byId.get(c.id);
        if(!u) return c;
        const pending=!!c._statusPending && (!u._synced || c.tsBaixada!==u.tsBaixada);
        return Object.assign({},c,{remoteId:u.remoteId,_synced:pending?false:u._synced,_statusPending:pending,dados:u.dados});
      });
      _fStoreHist(cacheKey,merged); // cache capturado antes dos awaits
      changed=false;
    }catch(e){}
  };
  try{
  // Os UUIDs nascem ANTES de qualquer await e vao pro storage NA HORA. Antes eles so eram
  // gravados no fim do lote: bastava a rede cair na 6a arte para as 5 ja enviadas perderem
  // o remoteId, ganharem UUID novo no proximo boot e o upsert (onConflict:'id') criar LINHA
  // NOVA -- era assim que a mesma arte aparecia 2, 3, 4 vezes em Minhas Artes.
  for(const h of hist){ if(!h._synced && !h.remoteId){ h.remoteId=gUuid(); changed=true; } }
  _persistirSync();
  for(const h of hist){
    if(!sameUser()) break;
    if(h._synced) continue; // já no banco (status muda via fMarkBaixadaBackend)
    // Arte de material de DEMONSTRAÇÃO nunca sobe: no banco ela viraria linha igual à de
    // uma arte real (template_id null) e contaminaria o uso que a rede lê. Fica local, e o
    // card em "Minhas artes" diz que é demonstração.
    if(h._demo) continue;
    // sobe fotos ENVIADAS (base64) do dados pro Storage (bucket público); URLs externas ficam como estão
    const dados={...(h.dados||{})};
    let fotoPendente=false;
    for(const k in dados){
      if(typeof dados[k]==='string' && dados[k].startsWith('data:')){
        const url=await _fUploadUserImg(user.id, h.remoteId+'/'+k, dados[k]);
        if(!sameUser()) return;
        if(url) dados[k]=url;
        else fotoPendente=true;
      }
    }
    h.dados=dados;
    // Foto que não subiu (sem rede/RLS)? NÃO grava base64 no banco — era a raiz do problema
    // de tráfego (linha de MB re-baixada por todo device). A arte fica local (_synced falso)
    // e re-tenta no próximo push; mesmo padrão do designer (_dPushFoldersNow).
    if(fotoPendente){ console.warn('[artes] foto não subiu pro Storage — arte segue local, re-tenta no próximo sync'); continue; }
    const row={
      id:h.remoteId, user_id:user.id,
      camp_id:h.campId||null, camp_name:h.campName||null, camp_color:h.campColor||null,
      fmt_id:h.fmtId||null, fmt_name:h.fmtName||null,
      template_id:_fTemplateUuidFor(h), template_version_id:h.templateVersionId||null, material_name:h.materialName||null,
      dados:dados, prod:h.prod||null, por:h.por||null, de:h.de||null,
      status:h.status||'rascunho', sig:h._sig||null,
      baixada_em:h.tsBaixada?new Date(h.tsBaixada).toISOString():null,
      created_at:h.ts?new Date(h.ts).toISOString():undefined
    };
    let { error }=await sb.schema('luma').from('artes').upsert(row, {onConflict:'id'});
    // FK: se o template foi apagado no banco entre gerar e sincronizar, o vínculo não pode
    // segurar a arte inteira fora do histórico cross-device — regrava sem o vínculo.
    if(error && error.code==='23503' && (row.template_id || row.template_version_id) && sameUser()){
      row.template_id=null; row.template_version_id=null;
      ({ error }=await sb.schema('luma').from('artes').upsert(row, {onConflict:'id'}));
    }
    if(!error){ h._synced=true; changed=true; }
  }
  _persistirSync();
  } finally {
    // Tambem no finally: se um upload ou upsert lancar no meio do lote, o que JA subiu
    // precisa ficar marcado _synced -- senao volta a subir e duplica na proxima sessao.
    _persistirSync();
    _fArtesPushBusy=false;
    if(_fArtesPushQueued){ _fArtesPushQueued=false; setTimeout(()=>fPushArtesToBackend(),0); }
  }
}
async function fMarkBaixadaBackend(remoteId, tsBaixada){
  const sb=_fSbArtes();
  const user=typeof gCurrentUser==='function'?gCurrentUser():null;
  if(!sb || !remoteId || !user) return false;
  try{
    const {error}=await sb.schema('luma').from('artes').update({ status:'baixada', baixada_em:new Date(tsBaixada||Date.now()).toISOString() }).eq('id', remoteId).eq('user_id',user.id);
    if(error) return false;
    const hist=fGetHist(user.id), item=hist.find(h=>h.remoteId===remoteId);
    if(item && item.tsBaixada===tsBaixada){delete item._statusPending; item._synced=true; _fStoreHist(fUserCacheKey(HIST_KEY,user.id),hist);}
    return true;
  }catch(e){return false;}
}
function _fRowToArte(r){
  const t=r.created_at?new Date(r.created_at).getTime():Date.now();
  return {
    id:t, ts:t, remoteId:r.id, _synced:true,
    tsBaixada:r.baixada_em?new Date(r.baixada_em).getTime():null,
    status:r.status||'rascunho', _sig:r.sig||'',
    campId:r.camp_id, campName:r.camp_name, campColor:r.camp_color,
    // template_id (UUID) vira o materialId local: num device recém-sincronizado o id do
    // template no catálogo É o UUID do banco — "Editar" volta a achar o material de origem.
    fmtId:r.fmt_id, fmtName:r.fmt_name, materialId:r.template_id||null, materialName:r.material_name,
    templateVersionId:r.template_version_id||null,
    dados:(r.dados&&typeof r.dados==='object')?r.dados:{},
    prod:r.prod||'', por:r.por||'', de:r.de||''
  };
}
async function fSyncArtesFromBackend(loadMore){
  const sb=_fSbArtes();
  const user=(typeof gCurrentUser==='function')?gCurrentUser():null;
  if(!sb || !user || !user.id) return;
  if(_fHistPage.owner===user.id&&_fHistPage.busy)return;
  const page={owner:user.id,offset:loadMore&&_fHistPage.owner===user.id?_fHistPage.offset:0,more:!!loadMore,busy:true};
  _fHistPage=page;
  try{
    await fRecoverHist(user.id);
    if(!gCurrentUser()||gCurrentUser().id!==user.id)return;
    let query=sb.schema('luma').from('artes').select('*').eq('user_id',user.id).order('created_at',{ascending:false});
    const {data,error}=await (page.offset?query.range(page.offset,page.offset+49):query.limit(50));
    if(error || !Array.isArray(data)){if(loadMore&&typeof gToast==='function')gToast('Não consegui carregar as artes anteriores. Tente novamente.','error');return;}
    if(!gCurrentUser() || gCurrentUser().id!==user.id) return;
    const remote=data.map(_fRowToArte);
    const local=fGetHist(user.id);
    remote.forEach(r=>{const pending=local.find(h=>h.remoteId===r.remoteId&&h._statusPending); if(pending)Object.assign(r,{status:pending.status,tsBaixada:pending.tsBaixada,_statusPending:true,_synced:false});});
    const rIds=new Set(remote.map(a=>a.remoteId));
    const extras=local.filter(h=>!h.remoteId || !rIds.has(h.remoteId));
    const merged=[...extras, ...remote].sort((a,b)=>(b.ts||0)-(a.ts||0));
    _fStoreHist(fUserCacheKey(HIST_KEY,user.id),merged);
    page.offset+=data.length;page.more=data.length===50;
    if(typeof fUpdateHistBadge==='function') fUpdateHistBadge();
  }catch(e){if(loadMore&&typeof gToast==='function')gToast('Não consegui carregar as artes anteriores. Tente novamente.','error');}
  finally{
    page.busy=false;
    if(_fHistPage===page&&gCurrentUser()?.id===user.id&&typeof fRenderHist==='function')fRenderHist();
  }
}
async function fLoadMoreHist(){
  const prev=_fHistPage;
  if(prev.busy||!prev.more)return;
  const p=fSyncArtesFromBackend(true);
  if(typeof fRenderHist==='function')fRenderHist();
  await p;
  if(_fHistPage.offset===prev.offset)_fHistPage.more=prev.more;
  if(typeof fRenderHist==='function')fRenderHist();
}
function fHistMoreButton(){
  const u=typeof gCurrentUser==='function'?gCurrentUser():null;
  if(!u||_fHistPage.owner!==u.id||!_fHistPage.more)return '';
  return '<button class="empty-cta ghost" type="button" onclick="fLoadMoreHist()"'+(_fHistPage.busy?' disabled aria-busy="true"':'')+'>'+(_fHistPage.busy?'Carregando…':'Carregar artes anteriores')+'</button>';
}

/* ══════════════════════════════════════════════════════════════
   LIMPAR A BIBLIOTECA — irreversível. Só é chamada depois do gConfirm (fAskClearHist,
   em catalog.js): o porteiro é lá, a demolição é aqui.

   Apaga no BANCO PRIMEIRO e só então no localStorage. Na ordem inversa, o
   fSyncArtesFromBackend do próximo carregamento traria as 50 linhas de volta — limpeza
   de mentira, o pior resultado possível numa ação destrutiva. Se o banco recusar
   (rede/RLS), NADA é apagado e a pessoa fica sabendo: melhor falhar limpo do que dar
   uma sensação de apagado que o F5 desmente.

   O DELETE é filtrado por user_id de propósito, mesmo com a policy "dono apaga suas
   artes" já filtrando (20260618092000): a RLS é a fronteira, o filtro é a intenção
   explícita — e delete sem filtro nem sai do supabase-js.
══════════════════════════════════════════════════════════════ */
async function fClearHist(){
  const sb=_fSbArtes();
  const user=(typeof gCurrentUser==='function')?gCurrentUser():null;
  if(sb && user && user.id){
    try{
      const { error }=await sb.schema('luma').from('artes').delete().eq('user_id', user.id);
      if(error) throw error;
    }catch(e){
      console.warn('[Luma] limpar histórico falhou:', e);
      if(typeof gToast==='function') gToast('Não consegui apagar no servidor — nada foi removido. Verifique a conexão e tente de novo.','error');
      return false;
    }
  }
  try{ localStorage.removeItem(fUserCacheKey(HIST_KEY,user&&user.id||'sem-sessao')); }catch(e){}
  const key=fUserCacheKey(HIST_KEY,user&&user.id||'sem-sessao');
  _fHistRecovery.delete(key);_fHistBackup(key,[]);_fHistPage={owner:null,offset:0,more:false,busy:false};
  if(typeof fUpdateHistBadge==='function') fUpdateHistBadge();
  if(typeof fRenderHist==='function') fRenderHist();
  return true;
}

// F-08: status pode ser 'rascunho' (gerou mas não baixou) ou 'baixada' (clicou em baixar de verdade)
function fAddHist(d,c,f,status){
  const h=fGetHist();
  status = status || 'rascunho';
  // Dedup: se já existe entrada com mesma camp+fmt+dados nos últimos 5min, atualiza em vez de duplicar
  const now = Date.now();
  // Assinatura normalizada: chaves ordenadas (não duplicar quando só a ordem muda, M15).
  // Hash compacto de todos os bytes: imagens diferentes podem ter o mesmo comprimento.
  const _sigObj={};
  Object.keys(d||{}).sort().forEach(k=>{ const v=d[k]; if(typeof v==='string'&&v.startsWith('data:')){let hash=2166136261; for(let i=0;i<v.length;i++){hash^=v.charCodeAt(i);hash=Math.imul(hash,16777619);} _sigObj[k]='img:'+v.length+':'+(hash>>>0).toString(16);}else _sigObj[k]=v; });
  // O material entra na assinatura: o Kit da campanha gera DUAS peças de mesmo formato com as
  // mesmas respostas, e sem ele a segunda virava "a mesma arte" e sumia do histórico.
  const _mid = fState.material && fState.material.id;
  const sig = c.id+'|'+f.id+(_mid?'|m:'+_mid:'')+'|'+JSON.stringify(_sigObj);
  const recent = h.find(x => x._sig===sig && (now - x.id) < 5*60*1000);
  if(recent){
    // Promove status: rascunho → baixada se for o caso
    if(status === 'baixada' && recent.status !== 'baixada'){
      recent.status = 'baixada';
      recent.tsBaixada = now;
      recent._statusPending=true;recent._synced=false;
      if(recent.remoteId && typeof fMarkBaixadaBackend==='function') fMarkBaixadaBackend(recent.remoteId, now);
    }
    const saved=fSaveHist(h); fUpdateHistBadge();
    return saved?recent.id:null;
  }
  const entry = {
    id: now,
    ts: now,  // timestamp puro pra calcular data relativa
    tsBaixada: status === 'baixada' ? now : null,
    status,
    _sig: sig,
    campId:c.id, campName:c.name, campColor:c.color,
    fmtId:f.id, fmtName:f.name,
    materialId: fState.material?.id || null,
    materialName: fState.material?.name || null,
    // A versão do template com que ESTA arte foi feita: mudar o template amanhã não pode
    // mudar a arte de ontem (reabrir/rebaixar usa esta versão — fMaterialDaVersao).
    templateVersionId: fState.material?.versaoAtualId || null,
    _demo: !!(fState.material && fState.material._demo),
    dados:{...d},
    prod: d.produto || d.categoria || d.brinde || d.oferta || c.name,
    por: d.precoPor || d.desconto || '',
    de: d.precoDe || ''
  };
  h.unshift(entry);
  const saved=fSaveHist(h); fUpdateHistBadge();
  return saved?entry.id:null;
}

// Promove uma entrada de rascunho pra baixada (chamado quando user baixa de fato)
function fMarkHistBaixada(id){
  const h = fGetHist();
  const item = h.find(x=>x.id===id);
  if(item && item.status !== 'baixada'){
    item.status = 'baixada';
    item.tsBaixada = Date.now();
    item._statusPending=true;
    item._synced=false;
    fSaveHist(h);
    if(item.remoteId && typeof fMarkBaixadaBackend==='function') fMarkBaixadaBackend(item.remoteId, item.tsBaixada);
  }
}

function fUpdateHistBadge(){
  const n=fGetHist().length;
  const badge = document.getElementById('hist-badge');
  if(badge) badge.textContent = n>0 ? `(${n})` : '';
}

// Data relativa em pt-BR: "agora", "5min", "Hoje 14:32", "Ontem 09:15", "12/05 18:40"
function fFormatHistDate(ts){
  const now = Date.now();
  const diff = now - ts;
  if(diff < 60*1000) return 'agora';
  if(diff < 60*60*1000) return Math.floor(diff/60000) + 'min';
  const d = new Date(ts);
  const today = new Date(); today.setHours(0,0,0,0);
  const dDay = new Date(ts); dDay.setHours(0,0,0,0);
  const dayDiff = Math.round((today - dDay) / (24*60*60*1000));
  const hhmm = d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  if(dayDiff === 0) return 'Hoje ' + hhmm;
  if(dayDiff === 1) return 'Ontem ' + hhmm;
  if(dayDiff < 7) return `Há ${dayDiff}d ${hhmm}`;
  return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) + ' ' + hhmm;
}

