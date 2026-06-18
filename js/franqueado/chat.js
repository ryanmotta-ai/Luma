/**
 * js/franqueado/chat.js
 *
 * Fluxo conversacional completo: fStartChat, fNextStep, fAddBot, fAddUser,
 * fSend, fQR, fTyping, fGoBack, upload de imagem, confirm card, fGerarArte.
 * Depende de: 00-config.js, 01-state.js, franqueado/chat-input.js
 */

function fGetSuggestionsForVar(varName, camp){
  // Tenta achar sugestões nas perguntas da campanha original
  const orig = camp.perguntas?.find(p=>p.id===varName);
  if(orig && orig.sugestoes) return orig.sugestoes;
  // Defaults básicos
  const defaults = {
    produto: ['Combo Smash', 'X-Bacon', 'Pizza Calabresa', 'Sushi Combo'],
    precoPor: ['R$ 19,90', 'R$ 29,90', 'R$ 39,90'],
    precoDe: ['R$ 24,90', 'R$ 34,90', 'R$ 44,90'],
    desconto: ['20% off', '30% off', '50% off'],
    codigo: ['PROMO10', 'DM20', 'SUPER30'],
    validade: ['só hoje', 'até domingo', 'fim de semana'],
    detalhes: ['Frete grátis', 'Combo família', 'Edição limitada'],
  };
  return defaults[varName] || [];
}
function fStartChatComMaterial(material){
  document.getElementById('f-messages').innerHTML='';
  fState.stepIdx=-1;fState.done=false;fUpdateProg();
  try { fUpdateLivePreview(); } catch(e){}
  try { fAttachInputGuard(); } catch(e){}
  const total = fState.camp.perguntas.length;
  let intro = `Você escolheu o material <strong>${material.name}</strong>. `;
  // Se tem instruções do designer, mostra
  if(material.publishMeta?.instrucoes){
    intro += `<br><br><em style="display:block;margin-top:6px;padding:8px 10px;background:var(--dm-orange-bg);border-left:3px solid var(--dm-orange);font-size:12px;color:var(--text-2);border-radius:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg> ${material.publishMeta.instrucoes}</em><br>`;
  }
  intro += `Vou te fazer <strong>${total} pergunta${total>1?'s':''} rápida${total>1?'s':''}</strong> e gerar a arte. Leva ~1 minuto.`;
  fAddBot(intro, []);
  setTimeout(()=>fNextStep(),900);
}
function fAskCampSwitch(c){
  const msgs=document.getElementById('f-messages');
  const existing=document.getElementById('switch-confirm-msg');if(existing)existing.remove();
  const w=document.createElement('div');w.className='msg bot';w.id='switch-confirm-msg';
  w.innerHTML=`<div class="av"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#fff"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><line x1="8" y1="16" x2="8.01" y2="16" /><line x1="16" y1="16" x2="16.01" y2="16" /></svg></div><div>
    <div class="bbl">Trocar pra <strong>${c.name}</strong>? Você vai perder o progresso atual e poderá escolher um material da nova campanha.</div>
    <div class="qr-wrap">
      <div class="qr" onclick="fApplyCampSwitch(${JSON.stringify(c.id).replace(/"/g,'&quot;')},false)">Sim, trocar</div>
      <div class="qr" onclick="fCancelSwitch()" style="background:var(--gray-light);border-color:var(--gray-mid);color:var(--text-2)">Cancelar</div>
    </div>
  </div>`;
  msgs.appendChild(w);msgs.scrollTop=msgs.scrollHeight;
}
function fApplyCampSwitch(cId, keepData){
  const m=document.getElementById('switch-confirm-msg');if(m)m.remove();
  const all=[...CAMPS_ATIVAS,...CAMPS_OUTRAS];
  const c=all.find(x=>x.id===cId);if(!c)return;
  // Limpa estado (a troca via catálogo de materiais é nova arquitetura)
  fState.camp=c;fState.stepIdx=-1;fState.done=false;
  fState.dados={};
  fState.material=null;
  const {ativas:_a,outras:_o}=fGetCampaigns();fRenderCatalogs(_a,_o);fUpdateCtx();
  fOpenMaterialCatalog(c);
}
function fCancelSwitch(){
  const m=document.getElementById('switch-confirm-msg');if(m)m.remove();
}
function fSelectFmt(id){
  const novoFmt=FMTS.find(f=>f.id===id);
  if(!novoFmt || (fState.fmt && fState.fmt.id===novoFmt.id)) return;
  const erafmtAntigo = fState.fmt ? fState.fmt.name : '';
  fState.fmt=novoFmt;
  fRenderFmts();fUpdateCtx();
  // Se há dados, mantém — só reseta progresso visual; se já finalizou, regera com novo formato
  const temDados = Object.keys(fState.dados).length > 0;
  if(temDados && fState.done){
    // Regerar arte automaticamente no novo formato
    document.getElementById('f-messages').innerHTML='';
    fState.stepIdx=fState.camp.perguntas.length;fUpdateProg();
    fAddBot(`Trocando pra <strong>${novoFmt.name}</strong> mantendo as respostas... ⚡`,[]);
    setTimeout(()=>fGerarArte(),500);
    return;
  }
  if(temDados){
    // Continua de onde parou, sem zerar
    fAddBot(`Formato alterado pra <strong>${novoFmt.name}</strong>. Mantive suas respostas.`,[]);
    return;
  }
  // Sem dados: comportamento original
  fState.stepIdx=-1;fState.dados={};fState.done=false;fStartChat();
}
// Versão do fStartChat que respeita fState.dados já preenchidos e pula direto pra próxima pergunta não respondida
function fStartChatPreservandoDados(){
  document.getElementById('f-messages').innerHTML='';
  fUpdateProg();
  const pergs=fState.camp.perguntas;
  // Encontra primeiro índice ainda não respondido
  let firstEmpty=-1;
  for(let i=0;i<pergs.length;i++){
    if(fState.dados[pergs[i].id]==null || fState.dados[pergs[i].id]===''){firstEmpty=i;break;}
  }
  const camposReaproveitados = Object.keys(fState.dados).length;
  if(camposReaproveitados > 0){
    fAddBot(`Beleza! Reaproveitei <strong>${camposReaproveitados} resposta(s)</strong> da campanha anterior. ${firstEmpty<0?'Tudo já tá preenchido, vou pra confirmação.':'Continuo de onde paramos.'}`,[]);
  } else {
    fAddBot(`Vamos criar a arte da campanha <strong>${fState.camp.name}</strong> no formato <strong>${fState.fmt.name}</strong>. 🎨`,[]);
  }
  if(firstEmpty < 0){
    // Tudo preenchido: vai pra confirmação
    fState.stepIdx = pergs.length;
    setTimeout(()=>fMostrarConfirm(), 700);
  } else {
    fState.stepIdx = firstEmpty - 1;
    setTimeout(()=>fNextStep(),700);
  }
}
function fRenderFmts(){
  document.getElementById('f-fmt-row').innerHTML=FMTS.map(f=>`
    <div class="fmt-btn ${f.id===fState.fmt.id?'selected':''}" onclick="fSelectFmt('${f.id}')">
      <div class="fmt-btn-name">${f.name}</div>
      <div class="fmt-btn-dim">${f.dim}</div>
    </div>`).join('');
}
function fUpdateCtx(){
  const t=fState.camp.name+' · '+fState.fmt.name;
  document.getElementById('f-ctx-tag').textContent=t;
  document.getElementById('top-camp-pill').textContent=t;
  try { fUpdateLivePreview(); } catch(e){}
}
function fUpdateProg(){
  const tot=fState.camp.perguntas.length,done=Math.max(0,fState.stepIdx);
  document.getElementById('prog-fill').style.width=(tot>0?Math.round(done/tot*100):0)+'%';
}


/* ── CHAT ── */
function fStartChat(){
  document.getElementById('f-messages').innerHTML='';
  fState.stepIdx=-1;fState.dados={};fState.done=false;fUpdateProg();
  try { fUpdateLivePreview(); } catch(e){}
  try { fAttachInputGuard(); } catch(e){}
  // F-05: mensagem inicial com contexto (quantas perguntas, tempo estimado)
  const total = fState.camp.perguntas.length;
  fAddBot(`Oi! Vou te fazer <strong>${total} pergunta${total>1?'s':''} rápida${total>1?'s':''}</strong> sobre <strong>${fState.camp.name}</strong> (formato ${fState.fmt.name}) e gerar a arte. Leva ~1 minuto. Pode clicar nas sugestões pra responder mais rápido.`,[]);
  setTimeout(()=>fNextStep(),900);
}
function fNextStep(){
  fState.stepIdx++;fUpdateProg();
  const pergs=fState.camp.perguntas;
  if(fState.stepIdx>=pergs.length){fMostrarConfirm();return;}
  const p=pergs[fState.stepIdx];
  try { fUpdateLivePreview(); } catch(e){}
  try { fUpdateCharCount(); } catch(e){}
  // F-05: prefixo "Passo X de Y" pra dar senso de progresso numérico
  const stepLabel = `<span class="step-label">Passo ${fState.stepIdx+1} de ${pergs.length}</span>`;
  // F-07: botão "Voltar" aparece quando não é o primeiro passo
  const canGoBack = fState.stepIdx > 0 && fState.editIdx === null;
  // Pergunta de imagem: usa fAddBotImageUpload
  if(p.isImage){
    fAddBotImageUpload(stepLabel, p, canGoBack);
    // Desabilita input de texto
    const box=document.getElementById('f-msg-box');
    if(box){box.disabled=true;box.placeholder='Use o botão de upload acima';}
    return;
  }
  // Pergunta de texto normal
  const box=document.getElementById('f-msg-box');
  if(box){box.disabled=false;}
  const cfg = fGetFieldType(p.id);
  const typeIcon = {price:'R$', discount:'%', code:'#', text:'Aa'}[cfg.type] || 'Aa';
  const fieldHint = `<div class="field-hint"><span class="field-hint-type">${typeIcon}</span><span class="field-hint-text">${cfg.label} · até ${cfg.maxLen} caracteres</span></div>`;
  fAddBot(`${stepLabel}${p.texto}${fieldHint}`, p.sugestoes, canGoBack);
  // Atualiza placeholder do input com dica do tipo
  fUpdateInputPlaceholder(p.id);
}

// Pergunta especial de upload de imagem
function fAddBotImageUpload(stepLabel, pergunta, canGoBack){
  const msgs=document.getElementById('f-messages');
  const w=document.createElement('div');w.className='msg bot';
  const uploadId='f-upload-'+Date.now();
  const fieldHint = `<div class="field-hint"><span class="field-hint-type"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:#fff"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></span><span class="field-hint-text">${pergunta.label} · imagem (PNG/JPG, máx 4MB)</span></div>`;
  let back='';
  if(canGoBack){
    back = `<div class="qr-back-wrap"><button class="qr-back" onclick="fGoBack()" title="Voltar uma pergunta"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>Voltar uma pergunta</button></div>`;
  }
  w.innerHTML=`<div class="av"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#fff"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><line x1="8" y1="16" x2="8.01" y2="16" /><line x1="16" y1="16" x2="16.01" y2="16" /></svg></div><div>
    <div class="bbl">${stepLabel}${pergunta.texto}${fieldHint}</div>
    <div class="f-upload-zone" id="${uploadId}-zone" onclick="document.getElementById('${uploadId}-input').click()">
      <input type="file" id="${uploadId}-input" accept="image/png,image/jpeg,image/webp" style="display:none" onchange="fHandleImageUpload(event,'${pergunta.id}','${uploadId}')">
      <div class="f-upload-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </div>
      <div class="f-upload-title">Toque pra enviar uma foto</div>
      <div class="f-upload-sub">ou arraste a imagem aqui</div>
    </div>
    ${back}
  </div>`;
  msgs.appendChild(w);msgs.scrollTop=msgs.scrollHeight;
  // Habilita drag & drop na zona
  const zone=document.getElementById(uploadId+'-zone');
  if(zone){
    zone.addEventListener('dragover',(e)=>{e.preventDefault();zone.classList.add('drag-over');});
    zone.addEventListener('dragleave',()=>zone.classList.remove('drag-over'));
    zone.addEventListener('drop',(e)=>{
      e.preventDefault();zone.classList.remove('drag-over');
      const file=e.dataTransfer.files[0];
      if(file) fProcessImageFile(file, pergunta.id, uploadId);
    });
  }
}
function fHandleImageUpload(event, varId, uploadId){
  const file=event.target.files[0];
  if(!file) return;
  fProcessImageFile(file, varId, uploadId);
}
function fProcessImageFile(file, varId, uploadId){
  // Valida tipo e tamanho
  if(!file.type.startsWith('image/')){
    fShowFieldError('Esse arquivo não é uma imagem.');
    return;
  }
  if(file.size > 4*1024*1024){
    fShowFieldError(`Imagem muito grande (${(file.size/1024/1024).toFixed(1)}MB). Máximo 4MB.`);
    return;
  }
  // M1.2: feedback de processamento — skeleton + barra de progresso enquanto lê/redimensiona
  const zoneEl=document.getElementById(uploadId+'-zone');
  if(zoneEl){
    zoneEl.classList.add('f-upload-loading');
    zoneEl.innerHTML=`<div class="f-upload-skeleton"><div class="f-upload-skel-img"></div><div class="f-upload-progress"><div class="f-upload-progress-bar" id="${uploadId}-bar"></div></div><div class="f-upload-skel-label">Processando imagem…</div></div>`;
  }
  const _bar=document.getElementById(uploadId+'-bar');
  // Lê como dataURL
  const reader=new FileReader();
  reader.onprogress=(ev)=>{ if(_bar&&ev.lengthComputable){_bar.style.width=Math.round(ev.loaded/ev.total*70)+'%';} };
  reader.onload=(e)=>{
    if(_bar)_bar.style.width='85%';
    const dataUrl=e.target.result;
    // Redimensiona se for muito grande (>1500px) pra economizar storage
    fResizeImageIfNeeded(dataUrl, 1500, (resizedUrl)=>{
      fState.dados[varId]=resizedUrl;
      // Substitui a zona de upload pela prévia da foto
      const zone=document.getElementById(uploadId+'-zone');
      if(zone){
        zone.outerHTML=`<div class="f-upload-preview">
          <img src="${resizedUrl}" alt="Foto enviada"/>
          <div class="f-upload-preview-overlay">
            <span style="display:inline-flex;align-items:center;gap:4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><polyline points="20 6 9 17 4 12"/></svg>Foto enviada</span>
            <button class="f-upload-replace" onclick="fReplaceImage('${varId}',this)">Trocar</button>
          </div>
        </div>`;
      }
      // Habilita input de novo pra prox pergunta
      const box=document.getElementById('f-msg-box');
      if(box){box.disabled=false;}
      // Pula pra próxima pergunta automaticamente
      try { fUpdateLivePreview({animateField:varId}); } catch(e){}
      setTimeout(()=>{
        if(fState.editIdx !== null){fState.editIdx=null; fTyping(()=>fMostrarConfirm());}
        else { fTyping(()=>fNextStep()); }
      }, 600);
    });
  };
  reader.readAsDataURL(file);
}
function fResizeImageIfNeeded(dataUrl, maxDim, cb){
  const img=new Image();
  img.onload=()=>{
    const {width:w, height:h} = img;
    if(w <= maxDim && h <= maxDim){cb(dataUrl);return;}
    const scale = Math.min(maxDim/w, maxDim/h);
    const cv=document.createElement('canvas');
    cv.width=Math.round(w*scale); cv.height=Math.round(h*scale);
    const ctx=cv.getContext('2d');
    ctx.imageSmoothingQuality='high';
    ctx.drawImage(img,0,0,cv.width,cv.height);
    cb(cv.toDataURL('image/jpeg',0.88));
  };
  img.onerror=()=>cb(dataUrl);
  img.src=dataUrl;
}
function fReplaceImage(varId, btn){
  // Apaga o dado atual e força nova pergunta
  delete fState.dados[varId];
  // Acha a pergunta no fluxo (com proteção)
  const perguntas = fState.camp?.perguntas;
  if(!perguntas || !Array.isArray(perguntas)) return;
  const idx = perguntas.findIndex(p=>p.id===varId);
  if(idx < 0) return;
  // Remove a bolha atual (que tem a preview)
  const msg = btn.closest('.msg');
  if(msg){
    const next = msg.nextElementSibling;
    if(next) next.remove();
    msg.remove();
  }
  // Se o fluxo já terminou (ou está no card de confirmação), tratar como EDIÇÃO:
  // delega a fEditCampo, que marca editIdx → o novo upload volta ao confirm (chat.js:254).
  if(fState.done || fState.stepIdx >= perguntas.length){
    fState.done = false;
    fEditCampo(idx);
    return;
  }
  // Fluxo linear normal: re-pergunta a imagem e segue
  fState.stepIdx = idx-1;
  fTyping(()=>fNextStep());
}

// F-07: volta uma pergunta no fluxo do chat
function fGoBack(){
  if(fState.stepIdx <= 0 || fState.done || fState.editIdx !== null) return;
  const msgs = document.getElementById('f-messages');
  // Remove primeiro as bolhas transitórias (erro/typing) — elas é que quebravam a contagem
  ['field-err-msg','typing-el'].forEach(id=>{const e=document.getElementById(id);if(e)e.remove();});
  // Remove a pergunta atual (bot) e a resposta anterior (user) — as 2 últimas .msg reais
  const bubbles = Array.from(msgs.querySelectorAll('.msg'));
  for(let i=bubbles.length-1, removed=0; i>=0 && removed<2; i--, removed++){bubbles[i].remove();}
  // Volta um passo: limpa o dado de TODOS os passos a partir do alvo (evita valor velho na preview)
  const target = fState.stepIdx - 1;
  fState.camp.perguntas.forEach((p,idx)=>{ if(idx>=target) delete fState.dados[p.id]; });
  fState.stepIdx = target - 1; // fNextStep incrementa pra chegar no alvo
  fNextStep();
}

function fUpdateInputPlaceholder(id){
  const box = document.getElementById('f-msg-box');
  if(!box) return;
  const cfg = fGetFieldType(id);
  const hints = {
    price:    'Ex: R$ 9,90',
    discount: 'Ex: 20% off ou R$ 5,00 off',
    code:     'Ex: BURGER10',
    text:     'Digite ou clique numa sugestão acima'
  };
  box.placeholder = hints[cfg.type] || hints.text;
}
function fMostrarConfirm(){
  const d=fState.dados,c=fState.camp;
  const labels={produto:'Produto',precoDe:'Preço original',precoPor:'Preço promo',validade:'Validade',desconto:'Desconto',pedidoMin:'Pedido mínimo',bairros:'Cobertura',codigo:'Código',condicao:'Condição',brinde:'Brinde',categoria:'Categoria',oferta:'Oferta'};
  const rows=c.perguntas.map((p,i)=>{
    const valor = d[p.id];
    const label = labels[p.id] || p.label || p.id;
    let valDisplay;
    if(p.isImage){
      if(valor && valor.startsWith('data:image')){
        valDisplay = `<img class="confirm-thumb" src="${valor}" alt="${label}"/>`;
      } else {
        valDisplay = `<span class="confirm-val confirm-val-empty">— sem foto —</span>`;
      }
    } else {
      valDisplay = `<span class="confirm-val">${gEsc(valor||'—')}</span>`;
    }
    return `<div class="confirm-row">
      <span class="confirm-label">${label}</span>
      ${valDisplay}
      <button class="confirm-edit" onclick="fEditCampo(${i})">editar</button>
    </div>`;
  }).join('');
  const msgs=document.getElementById('f-messages');
  const w=document.createElement('div');w.className='msg bot';w.id='confirm-msg';
  w.innerHTML=`<div class="av"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#fff"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><line x1="8" y1="16" x2="8.01" y2="16" /><line x1="16" y1="16" x2="16.01" y2="16" /></svg></div><div>
    <div class="bbl" style="padding-bottom:6px">Confere tudo antes de eu gerar a arte:</div>
    <div class="confirm-card">
      <div class="confirm-header">Resumo · ${c.name}</div>
      <div class="confirm-fields">${rows}</div>
      <div class="confirm-actions">
        <button class="confirm-btn cancel" onclick="fEditarTudo()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>Alterar</button>
        <button class="confirm-btn ok" onclick="fConfirmarGerar()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><polyline points="20 6 9 17 4 12"/></svg>Confirmar e gerar</button>
      </div>
      ${(fState.material&&fState.material.layers)?`<button class="confirm-bulk" onclick="fBulkOpen()" title="Gerar muitas artes de uma vez a partir de uma planilha CSV"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Gerar vários (CSV)</button>`:''}
    </div>
  </div>`;
  msgs.appendChild(w);msgs.scrollTop=msgs.scrollHeight;
}
function fEditCampo(idx){
  fState.stepIdx=idx;fState.editIdx=idx;
  const p=fState.camp.perguntas[idx];
  const labels={produto:'Produto',precoDe:'Preço original',precoPor:'Preço promo',validade:'Validade',desconto:'Desconto',pedidoMin:'Pedido mínimo',bairros:'Cobertura',codigo:'Código',condicao:'Condição',brinde:'Brinde',categoria:'Categoria',oferta:'Oferta'};
  const label = labels[p.id] || p.label || p.id;
  
  // Em vez de remover o card inteiro, aplicamos classes de opacidade parcial
  const confirmMsg = document.getElementById('confirm-msg');
  if (confirmMsg) {
    confirmMsg.classList.add('editing-mode');
    const confirmCard = confirmMsg.querySelector('.confirm-card');
    if (confirmCard) confirmCard.classList.add('editing-mode');
    
    const rows = confirmMsg.querySelectorAll('.confirm-row');
    rows.forEach((row, i) => {
      if (i === idx) {
        row.classList.remove('row-dimmed');
        row.classList.add('row-highlight');
      } else {
        row.classList.remove('row-highlight');
        row.classList.add('row-dimmed');
      }
    });
  }
  
  if(p.isImage){
    const stepLabel = `<span class="step-label">Editando</span>`;
    const editPergunta = {...p, texto: `Envie uma nova <strong>${label.toLowerCase()}</strong>`};
    fAddBotImageUpload(stepLabel, editPergunta, false);
    const box=document.getElementById('f-msg-box');
    if(box){box.disabled=true;box.placeholder='Use o botão de upload acima';}
  } else {
    fAddBot(`Qual é o novo valor para <strong>${label}</strong>?`,p.sugestoes);
    const box=document.getElementById('f-msg-box');
    if(box){box.disabled=false;}
    try { fUpdateInputPlaceholder(p.id); } catch(e){}
    try { fUpdateCharCount(); } catch(e){}
  }
}
function fEditarTudo(){const m=document.getElementById('confirm-msg');if(m)m.remove();fState.stepIdx=-1;fState.dados={};fState.editIdx=null;fStartChat();}
function fConfirmarGerar(){const m=document.getElementById('confirm-msg');if(m)m.remove();fGerarArte();}
function fGerarArte(){
  fState.done=true;fUpdateProg();
  const d=fState.dados,c=fState.camp;
  fAddBot('Gerando sua arte agora... ⚡',[]);
  setTimeout(async ()=>{
    const prod=d.produto||d.categoria||d.brinde||d.oferta||c.name;
    const por=d.precoPor||d.desconto||'Ver no app';
    const de=d.precoDe?`De ${d.precoDe}`:'';
    const val=d.validade||'';
    fState._lastHistId = fAddHist(d,c,fState.fmt,'rascunho'); // id correto mesmo com dedup (C8)
    const msgs=document.getElementById('f-messages');
    const w=document.createElement('div');w.className='msg bot';
    // ID único pro canvas thumbnail
    const previewCanvasId = 'art-preview-'+Date.now();
    // Se há material publicado, renderiza preview real via canvas; senão, fallback HTML
    const hasMaterial = fState.material && fState.material.layers && fState.material.layers.length;
    let canvasBlock = '';
    if(hasMaterial){
      // Reserva espaço pro canvas thumbnail
      const fmtMap={story:[9,16],feed:[1,1],post:[12,6.28],wide:[12,6.28]};
      const [aw, ah] = fmtMap[fState.fmt.id] || [9,16];
      const previewH = 280;
      const previewW = Math.round(previewH * (aw/ah));
      canvasBlock = `<div class="art-canvas-real" style="background:${c.color};width:${previewW}px;height:${previewH}px"><canvas id="${previewCanvasId}" width="${previewW}" height="${previewH}" style="display:block;width:100%;height:100%"></canvas></div>`;
    } else {
      // Fallback HTML antigo
      const fotoProduto = d.foto_produto;
      const logoLoja = d.logo_loja;
      const fotoBlock = (fotoProduto && fotoProduto.startsWith('data:image'))
        ? `<div class="art-foto-wrap"><img class="art-foto" src="${fotoProduto}" alt=""/></div>` : '';
      const logoBlock = (logoLoja && logoLoja.startsWith('data:image'))
        ? `<img class="art-logo-loja" src="${logoLoja}" alt=""/>` : '';
      canvasBlock = `<div class="art-canvas ${fotoProduto?'has-foto':''}" style="background:${c.color}">
        ${logoBlock}
        ${fotoBlock}
        <div class="art-tag">${c.name.toUpperCase()} · ${fState.fmt.name.toUpperCase()}</div>
        <div class="art-prod">${prod.toUpperCase()}</div>
        ${de?`<div class="art-de">${de}</div>`:''}
        <div class="art-por">${por}</div>
        ${val?`<div class="art-logo" style="font-size:7px;opacity:.5">${val}</div>`:''}
        <div class="art-brand-logo" role="img" aria-label="Luma"></div>
      </div>`;
    }
    w.innerHTML=`<div class="av"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#fff"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><line x1="8" y1="16" x2="8.01" y2="16" /><line x1="16" y1="16" x2="16.01" y2="16" /></svg></div><div>
      <div class="bbl" style="padding-bottom:6px;display:inline-flex;align-items:center;gap:4px">Arte gerada! <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="color:#22c55e"><polyline points="20 6 9 17 4 12"/></svg></div>
      <div class="art-wrap">
        ${canvasBlock}
        <div class="multi-fmt-row">
          ${FMTS.map(f=>`<div class="fmt-mini ${f.id===fState.fmt.id?'current':''}" onclick="fOutroFormato('${f.id}')">
            <div class="fmt-mini-thumb" style="background:${c.color}">${f.name.toUpperCase()}</div>
            <div class="fmt-mini-label" style="display:flex;align-items:center;justify-content:center;gap:3px">${f.name}${f.id===fState.fmt.id?' <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>':''}</div>
          </div>`).join('')}
        </div>
        <div class="art-footer">
          <div class="art-btn" onclick="fRefazer()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>Refazer</div>
          <div class="art-btn pri" onclick="fBaixar(this)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>Baixar PNG</div>
        </div>
      </div>
    </div>`;
    msgs.appendChild(w);msgs.scrollTop=msgs.scrollHeight;
    // Renderiza canvas thumbnail real
    if(hasMaterial){
      try {
        const cv = document.getElementById(previewCanvasId);
        if(cv){
          const ctx = cv.getContext('2d');
          await fRenderTemplateLayers(ctx, fState.material.layers, cv.width, cv.height, d, c);
          await fDrawDMLogo(ctx, cv.width, cv.height);
        }
      } catch(e){ console.warn('Erro ao renderizar preview:', e); }
    }
    try { fUpdateLivePreview(); } catch(e){}
    setTimeout(()=>fAddBot('Arte salva em <strong>Minhas artes</strong>! Clique em outro formato para gerar variações.',[]),500);
  },800);
}
async function fOutroFormato(id){
  const f=FMTS.find(x=>x.id===id);if(!f||f.id===fState.fmt.id)return;
  fState.fmt=f;fRenderFmts();fUpdateCtx();
  fAddHist(fState.dados,fState.camp,f,'baixada');
  await fGenPNG(fState.dados,fState.camp,f);
  gToast(`${f.name} baixado!`);
}
async function fBaixar(btn){
  const restore=gBtnLoading(btn,'Gerando…');
  try{
    if(fState._lastHistId){ fMarkHistBaixada(fState._lastHistId); }
    else { fAddHist(fState.dados,fState.camp,fState.fmt,'baixada'); }
    await fGenPNG(fState.dados,fState.camp,fState.fmt);
    gToast('Arte baixada!');
  }finally{ restore(); }
}
function fRefazer(){fState.stepIdx=-1;fState.dados={};fState.done=false;fClearImgCache();document.getElementById('f-messages').innerHTML='';fUpdateProg();fAddBot(`Vamos refazer a arte da <strong>${fState.camp.name}</strong>.`,[]);setTimeout(()=>fNextStep(),500);}
function fResetFlow(){
  // Se não há nada preenchido, reseta direto sem perguntar
  const temDados = Object.keys(fState.dados).length > 0 || fState.stepIdx >= 0;
  if(!temDados){
    fState.stepIdx=-1;fState.dados={};fState.done=false;
    document.getElementById('f-messages').innerHTML='';fUpdateProg();fStartChat();
    return;
  }
  // Já tem dados — pede confirmação inline no chat
  const msgs=document.getElementById('f-messages');
  // Evita empilhar múltiplas confirmações
  const existing=document.getElementById('reset-confirm-msg');if(existing)existing.remove();
  const w=document.createElement('div');w.className='msg bot';w.id='reset-confirm-msg';
  w.innerHTML=`<div class="av"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#fff"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><line x1="8" y1="16" x2="8.01" y2="16" /><line x1="16" y1="16" x2="16.01" y2="16" /></svg></div><div>
    <div class="bbl">Tem certeza que quer recomeçar? Você vai perder as respostas dadas até aqui.</div>
    <div class="qr-wrap">
      <div class="qr" onclick="fConfirmReset()">Sim, recomeçar</div>
      <div class="qr" onclick="fCancelReset()" style="background:var(--gray-light);border-color:var(--gray-mid);color:var(--text-2)">Cancelar</div>
    </div>
  </div>`;
  msgs.appendChild(w);msgs.scrollTop=msgs.scrollHeight;
}
function fConfirmReset(){
  const m=document.getElementById('reset-confirm-msg');if(m)m.remove();
  fState.stepIdx=-1;fState.dados={};fState.done=false;fClearImgCache();
  document.getElementById('f-messages').innerHTML='';fUpdateProg();fStartChat();
}
function fCancelReset(){
  const m=document.getElementById('reset-confirm-msg');if(m)m.remove();
}

function fAddBot(html,qrs,canGoBack){
  const msgs=document.getElementById('f-messages');
  const w=document.createElement('div');w.className='msg bot';
  let q='';
  if(qrs&&qrs.length){
    q=`<div class="qr-wrap">${qrs.map(x=>`<div class="qr" data-qr="${gEsc(x)}" onclick="fQR(this.dataset.qr,this)">${gEsc(x)}</div>`).join('')}</div>`;
  }
  // F-07: botão Voltar quando habilitado
  let back = '';
  if(canGoBack){
    back = `<div class="qr-back-wrap"><button class="qr-back" onclick="fGoBack()" title="Voltar uma pergunta"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>Voltar uma pergunta</button></div>`;
  }
  w.innerHTML=`<div class="av"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#fff"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><line x1="8" y1="16" x2="8.01" y2="16" /><line x1="16" y1="16" x2="16.01" y2="16" /></svg></div><div><div class="bbl">${html}</div>${q}${back}</div>`;
  msgs.appendChild(w);msgs.scrollTop=msgs.scrollHeight;
}
function fAddUser(txt){
  const msgs=document.getElementById('f-messages');
  const w=document.createElement('div');w.className='msg user';
  w.innerHTML=`<div><div class="bbl">${gEsc(txt)}</div></div><div class="av u">FR</div>`;
  msgs.appendChild(w);msgs.scrollTop=msgs.scrollHeight;
}
function fTyping(cb){
  const msgs=document.getElementById('f-messages');
  const w=document.createElement('div');w.className='msg bot';w.id='typing-el';
  w.innerHTML=`<div class="av"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#fff"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><line x1="8" y1="16" x2="8.01" y2="16" /><line x1="16" y1="16" x2="16.01" y2="16" /></svg></div><div class="bbl"><div class="typing-row"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`;
  msgs.appendChild(w);msgs.scrollTop=msgs.scrollHeight;
  setTimeout(()=>{const t=document.getElementById('typing-el');if(t)t.remove();cb();},900);
}
function fQR(val, el){
  // QR clicado: aplica máscara E valida, espelhando fSend (M19 — sugestões dinâmicas
  // ou curtas não devem escapar da validação só por serem clicadas)
  const id = fState.camp.perguntas[fState.stepIdx]?.id;
  const masked = id ? fApplyMask(id, val) : val;
  const err = id ? fValidate(id, masked) : null;
  if(err){ fShowFieldError(err); return; }
  // M1.1: a sugestão transita visualmente — colapsa as outras e some suave a clicada
  if(el && el.classList){
    const wrap=el.closest('.qr-wrap');
    el.classList.add('qr-leaving');
    if(wrap){
      Array.from(wrap.children).forEach(c=>{ if(c!==el) c.style.opacity='0.25'; });
      // mede a altura atual antes de colapsar (max-height precisa de valor concreto)
      wrap.style.maxHeight=wrap.scrollHeight+'px';
      requestAnimationFrame(()=>wrap.classList.add('qr-wrap-collapsing'));
    }
    setTimeout(()=>{ fAddUser(masked); fSaveAdv(masked); }, 200);
    return;
  }
  fAddUser(masked);
  fSaveAdv(masked);
}
function fSend(){
  const b=document.getElementById('f-msg-box');
  const v=b.value.trim();
  if(!v)return;
  // Aplica máscara e valida antes de salvar
  const id = fState.camp.perguntas[fState.stepIdx]?.id;
  const masked = id ? fApplyMask(id, v) : v;
  const err = id ? fValidate(id, masked) : null;
  if(err){
    fShowFieldError(err);
    return;
  }
  b.value='';
  fAddUser(masked);
  fSaveAdv(masked);
}

