/**
 * js/franqueado/history.js
 *
 * Historico de artes do franqueado: fGetHist, fSaveHist, fAddHist,
 * fMarkHistBaixada, fUpdateHistBadge, fRenderHist, fDownloadHist.
 * Persiste em localStorage (HIST_KEY).
 * Depende de: 00-config.js (HIST_KEY), 01-state.js (fState)
 */

/* ── HISTÓRICO ── */
function fGetHist(){try{return JSON.parse(localStorage.getItem(HIST_KEY)||'[]');}catch(e){return[];}}
function fSaveHist(a){
  let ok=true;
  try{localStorage.setItem(HIST_KEY,JSON.stringify(a.slice(0,50)));}
  catch(e){
    ok=false;
    if(typeof gToast==='function')gToast('Não consegui salvar no histórico — a memória do navegador encheu. Apague artes antigas e tente de novo.','error');
  }
  // sync Supabase (background, por usuário). .catch: uma rejeição do push (rede/RLS) não
  // pode virar unhandledrejection — o cache local já guardou; o push re-tenta depois.
  if(typeof fPushArtesToBackend==='function'){ try{ const p=fPushArtesToBackend(); if(p&&p.catch) p.catch(()=>{}); }catch(e){} }
  return ok;
}

/* ── Sync do histórico de artes com o Supabase (luma.artes — escopo do usuário) ──
   Offline-first: localStorage é cache; o banco é a fonte por usuário (cross-device).
   Fotos no `dados` vão inline por ora (C2 sobe pro Storage). */
function _fSbArtes(){ return (typeof gSupabase==='function')?gSupabase():window.sb; }
// Sobe uma foto base64 do franqueado pro bucket público luma-user-uploads → URL pública.
async function _fUploadUserImg(uid, sub, dataUrl){
  const sb=_fSbArtes();
  if(!sb || !uid || typeof dataUrl!=='string' || !dataUrl.startsWith('data:')) return null;
  try{
    const blob=await (await fetch(dataUrl)).blob();
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
  if(typeof dFolders!=='undefined'&&Array.isArray(dFolders)){
    for(const f of dFolders){
      const t=(f.templates||[]).find(x=>x&&x.id===mid);
      if(t) return t.remoteId||null;
    }
  }
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
  if(_fArtesPushBusy){ _fArtesPushQueued=true; return; }
  _fArtesPushBusy=true;
  try{
  const hist=fGetHist(); let changed=false;
  // RELE o storage antes de gravar: uma arte criada/baixada DURANTE os awaits abaixo nao
  // pode ser sobrescrita pelo snapshot velho. Mescla so os campos de sync (remoteId/_synced/
  // dados com URLs) sobre a lista atual -- status/baixada recentes vencem.
  const _persistirSync = ()=>{
    if(!changed) return;
    try{
      const cur=fGetHist();
      const byId=new Map(hist.map(h=>[h.id,h]));
      const merged=cur.map(c=>{
        const u=byId.get(c.id);
        return u ? Object.assign({}, c, {remoteId:u.remoteId, _synced:u._synced, dados:u.dados}) : c;
      });
      localStorage.setItem(HIST_KEY, JSON.stringify(merged.slice(0,50))); // setItem direto (nao fSaveHist) p/ nao recursar
      changed=false;
    }catch(e){}
  };
  // Os UUIDs nascem ANTES de qualquer await e vao pro storage NA HORA. Antes eles so eram
  // gravados no fim do lote: bastava a rede cair na 6a arte para as 5 ja enviadas perderem
  // o remoteId, ganharem UUID novo no proximo boot e o upsert (onConflict:'id') criar LINHA
  // NOVA -- era assim que a mesma arte aparecia 2, 3, 4 vezes em Minhas Artes.
  for(const h of hist){ if(!h._synced && !h.remoteId){ h.remoteId=gUuid(); changed=true; } }
  _persistirSync();
  for(const h of hist){
    if(h._synced) continue; // já no banco (status muda via fMarkBaixadaBackend)
    // sobe fotos ENVIADAS (base64) do dados pro Storage (bucket público); URLs externas ficam como estão
    const dados={...(h.dados||{})};
    let fotoPendente=false;
    for(const k in dados){
      if(typeof dados[k]==='string' && dados[k].startsWith('data:')){
        const url=await _fUploadUserImg(user.id, h.remoteId+'/'+k, dados[k]);
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
      template_id:_fTemplateUuidFor(h), material_name:h.materialName||null,
      dados:dados, prod:h.prod||null, por:h.por||null, de:h.de||null,
      status:h.status||'rascunho', sig:h._sig||null,
      baixada_em:h.tsBaixada?new Date(h.tsBaixada).toISOString():null,
      created_at:h.ts?new Date(h.ts).toISOString():undefined
    };
    let { error }=await sb.schema('luma').from('artes').upsert(row, {onConflict:'id'});
    // FK: se o template foi apagado no banco entre gerar e sincronizar, o vínculo não pode
    // segurar a arte inteira fora do histórico cross-device — regrava sem o vínculo.
    if(error && row.template_id){
      row.template_id=null;
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
  if(!sb || !remoteId) return;
  try{ await sb.schema('luma').from('artes').update({ status:'baixada', baixada_em:new Date(tsBaixada||Date.now()).toISOString() }).eq('id', remoteId); }catch(e){}
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
    dados:(r.dados&&typeof r.dados==='object')?r.dados:{},
    prod:r.prod||'', por:r.por||'', de:r.de||''
  };
}
async function fSyncArtesFromBackend(){
  const sb=_fSbArtes();
  const user=(typeof gCurrentUser==='function')?gCurrentUser():null;
  if(!sb || !user || !user.id) return;
  try{
    const { data, error }=await sb.schema('luma').from('artes').select('*').order('created_at',{ascending:false}).limit(50);
    if(error || !Array.isArray(data)) return;
    const remote=data.map(_fRowToArte);
    const rIds=new Set(remote.map(a=>a.remoteId));
    const extras=fGetHist().filter(h=>!h.remoteId || !rIds.has(h.remoteId)); // locais ainda não sincronizadas
    const merged=[...extras, ...remote].sort((a,b)=>(b.ts||0)-(a.ts||0)).slice(0,50);
    try{ localStorage.setItem(HIST_KEY, JSON.stringify(merged)); }catch(e){}
    if(typeof fUpdateHistBadge==='function') fUpdateHistBadge();
    if(typeof fRenderHist==='function') fRenderHist();
  }catch(e){}
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
  try{ localStorage.removeItem(HIST_KEY); }catch(e){}
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
  // Foto (data:) entra só pelo COMPRIMENTO — nunca o base64 inteiro: isso enchia o _sig de
  // megabytes por entrada no localStorage, mas o tamanho já distingue fotos diferentes.
  const _sigObj={};
  Object.keys(d||{}).sort().forEach(k=>{ const v=d[k]; _sigObj[k]=(typeof v==='string'&&v.startsWith('data:'))?('img:'+v.length):v; });
  const sig = c.id+'|'+f.id+'|'+JSON.stringify(_sigObj);
  const recent = h.find(x => x._sig===sig && (now - x.id) < 5*60*1000);
  if(recent){
    // Promove status: rascunho → baixada se for o caso
    if(status === 'baixada' && recent.status !== 'baixada'){
      recent.status = 'baixada';
      recent.tsBaixada = now;
      if(recent.remoteId && typeof fMarkBaixadaBackend==='function') fMarkBaixadaBackend(recent.remoteId, now);
    }
    fSaveHist(h); fUpdateHistBadge();
    return recent.id;
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
    dados:{...d},
    prod: d.produto || d.categoria || d.brinde || d.oferta || c.name,
    por: d.precoPor || d.desconto || '',
    de: d.precoDe || ''
  };
  h.unshift(entry);
  fSaveHist(h); fUpdateHistBadge();
  return entry.id;
}

// Promove uma entrada de rascunho pra baixada (chamado quando user baixa de fato)
function fMarkHistBaixada(id){
  const h = fGetHist();
  const item = h.find(x=>x.id===id);
  if(item && item.status !== 'baixada'){
    item.status = 'baixada';
    item.tsBaixada = Date.now();
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

