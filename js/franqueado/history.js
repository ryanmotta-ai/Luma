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
  try{localStorage.setItem(HIST_KEY,JSON.stringify(a.slice(0,50)));return true;}
  catch(e){
    if(typeof gToast==='function')gToast('⚠ Não foi possível salvar no histórico: armazenamento cheio.','error');
    return false;
  }
}

// F-08: status pode ser 'rascunho' (gerou mas não baixou) ou 'baixada' (clicou em baixar de verdade)
function fAddHist(d,c,f,status){
  const h=fGetHist();
  status = status || 'rascunho';
  // Dedup: se já existe entrada com mesma camp+fmt+dados nos últimos 5min, atualiza em vez de duplicar
  const now = Date.now();
  // Assinatura normalizada: ordena as chaves p/ não duplicar quando só a ordem muda (M15)
  const sig = c.id+'|'+f.id+'|'+JSON.stringify(d, Object.keys(d||{}).sort());
  const recent = h.find(x => x._sig===sig && (now - x.id) < 5*60*1000);
  if(recent){
    // Promove status: rascunho → baixada se for o caso
    if(status === 'baixada' && recent.status !== 'baixada'){
      recent.status = 'baixada';
      recent.tsBaixada = now;
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
  }
}

function fUpdateHistBadge(){
  const n=fGetHist().length;
  document.getElementById('hist-badge').textContent = n>0 ? `(${n})` : '';
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

