/**
 * js/franqueado/chat.js
 *
 * Fluxo conversacional completo: fStartChat, fNextStep, fAddBot, fAddUser,
 * fSend, fQR, fTyping, fGoBack, upload de imagem, confirm card, fGerarArte.
 * Depende de: 00-config.js, 01-state.js, franqueado/chat-input.js
 */

let fNextTimeout = null;

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
  // Mobile: ao começar o chat, traz o painel do chat pra frente (o layout de 2 colunas colapsa).
  try{ document.body.classList.add('f-mobile-chat'); }catch(e){}
  const _b=document.getElementById('f-msg-box'); if(_b){ _b.disabled=false; }
  fState.stepIdx=-1;fState.done=false;fUpdateProg();
  fState.extractedColors={};
  try { fUpdateLivePreview(); } catch(e){}
  try { fAttachInputGuard(); } catch(e){}
  const total = fState.camp.perguntas.length;
  let intro = `Você escolheu o material <strong>${gEsc(material.name)}</strong>. `;
  // Se tem instruções do designer, mostra (escapado — texto livre do designer)
  if(material.publishMeta?.instrucoes){
    intro += `<br><br><em style="display:block;margin-top:6px;padding:8px 10px;background:var(--dm-orange-bg);border-left:3px solid var(--dm-orange);font-size:12px;color:var(--text-2);border-radius:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg> ${gEsc(material.publishMeta.instrucoes)}</em><br>`;
  }
  intro += `Vou te fazer <strong>${total} pergunta${total>1?'s':''} rápida${total>1?'s':''}</strong> e gerar a arte. Leva ~1 minuto.<br>
  <div style="margin-top:8px;border-top:1px dashed var(--gray-mid);padding-top:6px;display:flex;align-items:center;justify-content:space-between;gap:8px">
    <span style="font-size:11px;color:var(--text-3)">Quer pular as perguntas?</span>
    <button onclick="fBulkOpen()" style="background:var(--dm-orange-bg);border:1px solid var(--dm-orange-tint);color:var(--dm-orange-d);font-size:11px;font-weight:600;padding:4px 10px;border-radius:var(--r-pill);cursor:pointer;display:inline-flex;align-items:center;gap:4px;transition:all 0.15s ease" onmouseover="this.style.background='var(--dm-orange-tint)'" onmouseout="this.style.background='var(--dm-orange-bg)'">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Gerar em Lote
    </button>
  </div>`;
  fAddBot(intro, []);
  clearTimeout(fNextTimeout);
  fNextTimeout = setTimeout(()=>fNextStep(),900);
}
function fAskCampSwitch(c){
  const msgs=document.getElementById('f-messages');
  const existing=document.getElementById('switch-confirm-msg');if(existing)existing.remove();
  const w=document.createElement('div');w.className='msg bot';w.id='switch-confirm-msg';
  w.innerHTML=`<div class="av"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#fff"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><line x1="8" y1="16" x2="8.01" y2="16" /><line x1="16" y1="16" x2="16.01" y2="16" /></svg></div><div>
    <div class="bbl">Trocar pra <strong>${gEsc(c.name)}</strong>? Você vai perder o progresso atual e poderá escolher um material da nova campanha.</div>
    <div class="qr-wrap">
      <div class="qr" onclick="fApplyCampSwitch(${JSON.stringify(c.id).replace(/"/g,'&quot;')},false)">Sim, trocar</div>
      <div class="qr" onclick="fCancelSwitch()" style="background:var(--gray-light);border-color:var(--gray-mid);color:var(--text-2)">Cancelar</div>
    </div>
  </div>`;
  msgs.appendChild(w);msgs.scrollTop=msgs.scrollHeight;
}
function fApplyCampSwitch(cId, keepData){
  const m=document.getElementById('switch-confirm-msg');if(m)m.remove();
  const c=(typeof fResolveCamp==='function')?fResolveCamp(cId):[...CAMPS_ATIVAS,...CAMPS_OUTRAS].find(x=>x.id===cId);
  if(!c)return;
  // Limpa estado (a troca via catálogo de materiais é nova arquitetura)
  fState.camp=c;fState.stepIdx=-1;fState.done=false;
  fState.dados={};
  fState.material=null;
  fRestoreCatalog();fUpdateCtx();
  fOpenMaterialCatalog(c);
}
function fCancelSwitch(){
  const m=document.getElementById('switch-confirm-msg');if(m)m.remove();
}
function fSelectFmt(id){
  const novoFmt=FMTS.find(f=>f.id===id);
  if(!novoFmt || (fState.fmt && fState.fmt.id===novoFmt.id)) return;
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
// Seletor de formato do rail foi removido (o formato vem do material, via fSelectMaterial;
// e o resultado ainda oferece "outro formato"). Mantida como no-op defensivo pois vários
// pontos (boot, preview, troca de campanha) ainda chamam — não quebrar nenhum caller.
function fRenderFmts(){
  const row=document.getElementById('f-fmt-row'); if(!row) return;
  row.innerHTML=FMTS.map(f=>`
    <div class="fmt-btn ${f.id===fState.fmt.id?'selected':''}" onclick="fSelectFmt('${f.id}')">
      <div class="fmt-btn-name">${f.name}</div>
      <div class="fmt-btn-dim">${f.dim}</div>
    </div>`).join('');
}
function fUpdateCtx(){
  // Sem campanha escolhida (boot) → rótulo neutro, não um contexto fantasma.
  const t=fState.camp?(fState.camp.name+' · '+fState.fmt.name):'Escolha uma campanha';
  const ctx=document.getElementById('f-ctx-tag'); if(ctx) ctx.textContent=t;
  const pill=document.getElementById('top-camp-pill'); if(pill) pill.textContent=t;
  try { fUpdateLivePreview(); } catch(e){}
}
function fUpdateProg(){
  const tot=(fState.camp&&fState.camp.perguntas)?fState.camp.perguntas.length:0, done=Math.max(0,fState.stepIdx);
  const el=document.getElementById('prog-fill'); if(el) el.style.width=(tot>0?Math.round(done/tot*100):0)+'%';
}
// Boas-vindas no boot: NÃO interroga sobre campanha nenhuma — só recebe o franqueado e o convida
// a escolher uma campanha. O chat real (fStartChat) só dispara após a escolha.
function fShowWelcome(){
  const msgs=document.getElementById('f-messages'); if(msgs) msgs.innerHTML='';
  fState.stepIdx=-1; fState.dados={}; fState.done=false; fState.material=null;
  try{ fUpdateProg(); }catch(e){}
  try{ fUpdateCtx(); }catch(e){}
  const box=document.getElementById('f-msg-box');
  if(box){ box.disabled=true; box.placeholder='Escolha uma campanha ao lado para começar 👈'; }
  try{ fAddBot('Oi! Eu sou a <strong>Luma</strong> 👋 Escolha uma campanha aqui do lado que eu monto a arte com você — leva ~1 minutinho.',[]); }catch(e){}
}


/* ── CHAT ── */
function fStartChat(){
  if(!fState.camp){ fShowWelcome(); return; } // sem campanha → boas-vindas, nunca interroga
  document.getElementById('f-messages').innerHTML='';
  const _b=document.getElementById('f-msg-box'); if(_b){ _b.disabled=false; } // reabilita (welcome desabilitou)
  fState.stepIdx=-1;fState.dados={};fState.done=false;fUpdateProg();
  fState.extractedColors={};
  try { fUpdateLivePreview(); } catch(e){}
  try { fAttachInputGuard(); } catch(e){}
  // F-05: mensagem inicial com contexto (quantas perguntas, tempo estimado)
  const total = fState.camp.perguntas.length;
  fAddBot(`Oi! Vou te fazer <strong>${total} pergunta${total>1?'s':''} rápida${total>1?'s':''}</strong> sobre <strong>${gEsc(fState.camp.name)}</strong> (formato ${gEsc(fState.fmt.name)}) e gerar a arte. Leva ~1 minuto.<br>
  <div style="margin-top:8px;border-top:1px dashed var(--gray-mid);padding-top:6px;display:flex;align-items:center;justify-content:space-between;gap:8px">
    <span style="font-size:11px;color:var(--text-3)">Quer pular as perguntas?</span>
    <button onclick="fBulkOpen()" style="background:var(--dm-orange-bg);border:1px solid var(--dm-orange-tint);color:var(--dm-orange-d);font-size:11px;font-weight:600;padding:4px 10px;border-radius:var(--r-pill);cursor:pointer;display:inline-flex;align-items:center;gap:4px;transition:all 0.15s ease" onmouseover="this.style.background='var(--dm-orange-tint)'" onmouseout="this.style.background='var(--dm-orange-bg)'">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Gerar em Lote
    </button>
  </div>`,[]);
  clearTimeout(fNextTimeout);
  fNextTimeout = setTimeout(()=>fNextStep(),900);
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
  const fieldHint = `<div class="field-hint"><span class="field-hint-type">${typeIcon}</span><span class="field-hint-text">${gEsc(cfg.label)} · até ${cfg.maxLen} caracteres</span></div>`;
  
  // Sugestão inteligente de cores a partir da foto do produto
  let sugestoes = p.sugestoes ? p.sugestoes.slice() : [];
  if (cfg.type === 'color') {
    const fotoColor = fState.extractedColors && (fState.extractedColors['foto_produto'] || Object.values(fState.extractedColors)[0]);
    if (fotoColor) {
      if (!sugestoes.includes(fotoColor)) {
        sugestoes.unshift(fotoColor);
      }
    }
  }

  fAddBot(`${stepLabel}${p.texto}${fieldHint}`, sugestoes, canGoBack);
  // Atualiza placeholder do input com dica do tipo
  fUpdateInputPlaceholder(p.id);
}

// Pergunta especial de upload de imagem
function fAddBotImageUpload(stepLabel, pergunta, canGoBack){
  const msgs=document.getElementById('f-messages');
  const w=document.createElement('div');w.className='msg bot';
  const uploadId='f-upload-'+Date.now();
  const fieldHint = `<div class="field-hint"><span class="field-hint-type"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:#fff"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></span><span class="field-hint-text">${gEsc(pergunta.label)} · imagem (PNG/JPG, máx 4MB)</span></div>`;
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
  // Falha de leitura: restaura a zona clicável (com o input) em vez de travar no skeleton.
  reader.onerror=()=>{
    fShowFieldError('Não consegui ler essa imagem. Tente outra.');
    const zEl=document.getElementById(uploadId+'-zone');
    if(zEl){
      zEl.classList.remove('f-upload-loading');
      zEl.innerHTML=`<input type="file" id="${uploadId}-input" accept="image/png,image/jpeg,image/webp" style="display:none" onchange="fHandleImageUpload(event,'${varId}','${uploadId}')">
        <div class="f-upload-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
        <div class="f-upload-title">Toque pra tentar de novo</div>
        <div class="f-upload-sub">PNG ou JPG, até 4MB</div>`;
    }
  };
  reader.onload=(e)=>{
    if(_bar)_bar.style.width='85%';
    const dataUrl=e.target.result;
    // Redimensiona se for muito grande (>1500px) pra economizar storage
    fResizeImageIfNeeded(dataUrl, 1500, (resizedUrl)=>{
      fState.dados[varId]=resizedUrl;

      // EXTRAÇÃO DE CORES COM COLOR THIEF
      try {
        if(window.ColorThief) {
          const imgTemp = new Image();
          imgTemp.onload = () => {
            try {
              const thief = new ColorThief();
              const rgb = thief.getColor(imgTemp);
              if (rgb && rgb.length === 3) {
                const hex = '#' + rgb.map(x => {
                  const s = x.toString(16);
                  return s.length === 1 ? '0' + s : s;
                }).join('');
                if(!fState.extractedColors) fState.extractedColors = {};
                fState.extractedColors[varId] = hex;
              }
            } catch(thiefErr) {
              console.warn('[ColorThief] Erro ao extrair cor:', thiefErr);
            }
          };
          imgTemp.src = resizedUrl;
        }
      } catch(colorThiefErr) {
        console.warn('[ColorThief] Falha ao ler imagem:', colorThiefErr);
      }

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
    
    if(window.pica){
      try {
        const pInstance = window.pica();
        pInstance.resize(img, cv, { quality: 3, alpha: true })
          .then(res => cb(res.toDataURL('image/jpeg', 0.88)))
          .catch(err => {
            console.warn('[Pica] Erro de render, fallback nativo:', err);
            const ctx=cv.getContext('2d');
            ctx.imageSmoothingQuality='high';
            ctx.drawImage(img,0,0,cv.width,cv.height);
            cb(cv.toDataURL('image/jpeg',0.88));
          });
        return;
      } catch(e) {
        console.warn('[Pica] Falha ao iniciar, fallback nativo:', e);
      }
    }
    
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
    while (msg.nextElementSibling) {
      msg.nextElementSibling.remove();
    }
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
  const bubbles = Array.from(msgs.querySelectorAll('.msg'));
  if (bubbles.length) {
    bubbles.pop().remove(); // Remove current question
    if (bubbles.length) {
      const prev = bubbles.pop();
      prev.remove();
      if (prev.classList.contains('user') && bubbles.length) {
        bubbles.pop().remove(); // Remove the actual previous bot question if previous was user text
      }
    }
  }
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
  // Exemplo definido pelo designer (no campo) tem prioridade — é o que ele escolheu mostrar aqui.
  const vDef = (typeof dVars!=='undefined' && dVars) ? dVars.find(x=>x.name===id) : null;
  const ex = (vDef && vDef.example!=null && String(vDef.example).trim()!=='') ? String(vDef.example).trim() : '';
  if(ex){ box.placeholder = 'Ex: '+ex; return; }
  const hints = {
    price:    'Ex: R$ 9,90',
    discount: 'Ex: 20% off ou R$ 5,00 off',
    code:     'Ex: BURGER10',
    text:     'Digite ou clique numa sugestão acima'
  };
  box.placeholder = hints[cfg.type] || hints.text;
}
function fMostrarConfirm(){
  // Nunca empilha 2 cards (digitar+Enter no confirm re-disparava fNextStep→fMostrarConfirm)
  const existing=document.getElementById('confirm-msg'); if(existing) existing.remove();
  // Input pausado enquanto o resumo está na tela — Editar/Alterar reabilitam.
  const _box=document.getElementById('f-msg-box');
  if(_box){ _box.disabled=true; _box.placeholder='Confira o resumo acima e confirme 👆'; }
  const d=fState.dados,c=fState.camp;
  const labels={produto:'Produto',precoDe:'Preço original',precoPor:'Preço promo',validade:'Validade',desconto:'Desconto',pedidoMin:'Pedido mínimo',bairros:'Cobertura',codigo:'Código',condicao:'Condição',brinde:'Brinde',categoria:'Categoria',oferta:'Oferta'};
  const rows=c.perguntas.map((p,i)=>{
    const valor = d[p.id];
    let labelRaw = labels[p.id] || p.label || p.id;
    const label = labelRaw.charAt(0).toUpperCase() + labelRaw.slice(1);
    let valDisplay;
    if(p.isImage){
      if(valor && valor.startsWith('data:image')){
        valDisplay = `<img class="confirm-thumb" src="${valor}" alt="${gEsc(label)}"/>`;
      } else {
        valDisplay = `<span class="confirm-val confirm-val-empty">— sem foto —</span>`;
      }
    } else {
      valDisplay = `<span class="confirm-val" title="${gEsc(valor||'')}">${gEsc(valor||'—')}</span>`;
    }
    return `<div class="confirm-row">
      <span class="confirm-label" title="${gEsc(label)}">${gEsc(label)}</span>
      <div class="confirm-val-wrap">${valDisplay}</div>
      <button class="confirm-edit" onclick="fEditCampo(${i})" title="Editar ${gEsc(label)}"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:3px;vertical-align:-1px"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>Editar</button>
    </div>`;
  }).join('');
  const msgs=document.getElementById('f-messages');
  const w=document.createElement('div');w.className='msg bot';w.id='confirm-msg';
  w.innerHTML=`<div class="av"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#fff"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><line x1="8" y1="16" x2="8.01" y2="16" /><line x1="16" y1="16" x2="16.01" y2="16" /></svg></div><div>
    <div class="bbl" style="padding-bottom:6px">Confere tudo antes de eu gerar a arte:</div>
    <div class="confirm-card">
      <div class="confirm-header">Resumo · ${gEsc(c.name)}</div>
      <div class="confirm-fields">${rows}</div>
      <div class="confirm-actions">
        <button class="confirm-btn cancel" onclick="fEditarTudo()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>Alterar</button>
        <button class="confirm-btn ok" onclick="fConfirmarGerar()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><polyline points="20 6 9 17 4 12"/></svg>Confirmar e gerar</button>
      </div>
      ${(fState.material&&fState.material.layers)?`<button class="confirm-bulk" onclick="fBulkOpen()" title="Gerar muitas artes de uma vez com o Luma Sheets"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Gerar em Lote (Luma Sheets)</button>`:''}
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
    const editPergunta = {...p, texto: `Envie uma nova <strong>${gEsc(label.toLowerCase())}</strong>`};
    fAddBotImageUpload(stepLabel, editPergunta, false);
    const box=document.getElementById('f-msg-box');
    if(box){box.disabled=true;box.placeholder='Use o botão de upload acima';}
  } else {
    fAddBot(`Qual é o novo valor para <strong>${gEsc(label)}</strong>?`,p.sugestoes);
    const box=document.getElementById('f-msg-box');
    if(box){box.disabled=false;}
    try { fUpdateInputPlaceholder(p.id); } catch(e){}
    try { fUpdateCharCount(); } catch(e){}
  }
}
function fEditarTudo(){const m=document.getElementById('confirm-msg');if(m)m.remove();fState.stepIdx=-1;fState.dados={};fState.editIdx=null;fStartChat();}
function fConfirmarGerar(){const m=document.getElementById('confirm-msg');if(m)m.remove();fGerarArte();}
// Snapshot por bolha de arte gerada: como editar+confirmar de novo empilha outra
// bolha, cada "Baixar"/"Outro formato" precisa operar sobre os dados DAQUELA arte,
// não sobre fState (que reflete só a última). Chaveado pelo id do canvas da bolha.
let _fArtSnapshots={};
let _fArtCaptions={}; // Cache das legendas geradas indexadas pelo canvasId/snapId

/**
 * Constrói 3 variações de texto em formato estruturado seguindo as diretrizes
 * de branding da Delivery Much (voz simples, amigável, direta, próxima).
 */
function fGenCaptionSuggestions(dados, camp, formato) {
  const prod = dados.produto || dados.categoria || dados.brinde || dados.oferta || camp.name;
  const por = dados.precoPor || dados.desconto || 'Ver no app';
  const de = dados.precoDe ? `De ${dados.precoDe}` : '';
  const val = dados.validade || '';
  const cupom = dados.codigo || '';
  const condicao = dados.condicao || '';
  const pedidoMin = dados.pedidoMin || '';
  const bairros = dados.bairros || '';
  const detalhes = dados.detalhes || '';

  // CTAs adaptados ao formato de arte (Feed/Instagram, Stories, Wide)
  let ctaText = "Corre pro app da Delivery Much e pede o seu! Link na bio! 📲";
  let hashFmt = "#feed";
  if (formato.id === 'story') {
    ctaText = "Acesse o link aqui nos Stories e faça seu pedido rápido! 📲";
    hashFmt = "#stories";
  } else if (formato.id === 'wide') {
    ctaText = "Confira no link do site ou app da Delivery Much! 📲";
    hashFmt = "#wide";
  }

  // Hashtags baseadas no produto
  const cleanProd = prod.toLowerCase().replace(/[^a-z0-9]/g, '');
  const hashtags = `#deliverymuch #pedircomida #${cleanProd} #comidaemcasa #oferta ${hashFmt}`;

  // 1. Variação Promoção (Foco em vendas e cupom)
  let promoText = `🚨 Bateu aquela fome? A gente resolve! 🚨\n\n`;
  promoText += `Olha só o que preparamos pra você hoje: *${prod}* por um precinho especial! 😋\n\n`;
  if (de) promoText += `💸 ~${de}~ | 👉 *Por apenas ${por}!*\n\n`;
  else promoText += `💸 *Por apenas ${por}!* 🤑\n\n`;
  if (cupom) promoText += `🎟️ Use o cupom *${cupom}* pra garantir aquele desconto extra no app!\n\n`;
  if (pedidoMin) promoText += `⚠️ Pedido mínimo: ${pedidoMin}.\n`;
  if (condicao) promoText += `*Condição:* ${condicao}\n`;
  if (bairros) promoText += `📍 Válido para a entrega em: ${bairros}\n`;
  if (detalhes) promoText += `📝 ${detalhes}\n`;
  if (val) promoText += `📅 Aproveita que essa oferta é válida ${val}!\n\n`;
  promoText += `${ctaText}\n\n${hashtags}`;

  // 2. Variação Engajamento (Foco em redes sociais, interação e comentários)
  let engajarText = `Quem também concorda que a vida fica bem melhor com ${prod}? 😍👇\n\n`;
  engajarText += `A nossa equipe preparou essa promoção especial pensando em você. `;
  if (de) engajarText += `Pra comer muito gastando pouco: de ~${de}~ por apenas *${por}*! 😱\n\n`;
  else engajarText += `Precinho super camarada de *${por}* pra alegrar seu dia! 🎉\n\n`;
  if (cupom) {
    engajarText += `🎟️ Cupom da vez: *${cupom}*\n`;
    engajarText += `Comente "QUERO" que a gente te manda o link direto no Direct! 💬👇\n\n`;
  } else {
    engajarText += `Qual é o seu acompanhamento ideal pra hoje? Comente aqui embaixo! 👇💬\n\n`;
  }
  if (val) engajarText += `🏃‍♂️ Mas ó, não vacila: vale ${val}.\n\n`;
  engajarText += `Marque aqui aquele amigo que vai pagar esse pra você hoje! 👇\n\n`;
  engajarText += `${ctaText}\n\n${hashtags}`;

  // 3. Variação WhatsApp (Foco em conversão direta)
  let whatsappText = `Olá! Tudo bem? Passando pra te dar uma notícia deliciosa! 🌟\n\n`;
  whatsappText += `Hoje tem *${prod}* na Delivery Much com um preço especial!\n\n`;
  if (de) whatsappText += `❌ ~${de}~\n✅ *Por apenas ${por}!*\n\n`;
  else whatsappText += `✅ *Por apenas ${por}!* 😍\n\n`;
  if (cupom) whatsappText += `🎟️ Use o cupom *${cupom}* no app!\n\n`;
  if (pedidoMin) whatsappText += `• Pedido mínimo: ${pedidoMin}\n`;
  if (bairros) whatsappText += `• Entrega em: ${bairros}\n`;
  if (val) whatsappText += `⏳ *Corre que é válido:* ${val}!\n\n`;
  whatsappText += `Quer garantir o seu? É só abrir o app da Delivery Much no link abaixo ou responder a essa mensagem que te ajudo!\n`;
  whatsappText += `👉 [Inserir Link do App/WhatsApp]`;

  return [
    { id: 'promo', label: '📢 Promo', text: promoText },
    { id: 'engajar', label: '🔥 Engajar', text: engajarText },
    { id: 'whatsapp', label: '💬 WhatsApp', text: whatsappText }
  ];
}

/**
 * Ponto de integração do Backend. Pedro/Equipe podem plugar uma requisição
 * a uma API de IA (LLM) nesta função no futuro.
 */
async function fFetchAICaptionSuggestions(dados, camp, formato) {
  return fGenCaptionSuggestions(dados, camp, formato);
}

/**
 * Alterna a aba de legenda selecionada e atualiza o conteúdo da caixa de texto.
 */
function fSwitchCaptionTab(btn, tabId, canvasId) {
  const container = btn.closest('.caption-assistant-panel');
  if (!container) return;
  
  const buttons = container.querySelectorAll('.caption-tab-btn');
  buttons.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  
  const box = document.getElementById('caption-content-' + canvasId);
  const caps = _fArtCaptions[canvasId];
  if (box && caps) {
    const selected = caps.find(c => c.id === tabId);
    if (selected) {
      box.innerHTML = gEsc(selected.text).replace(/\n/g, '<br>');
      container.dataset.activeTab = tabId;
    }
  }
}

/**
 * Copia o texto da legenda ativa para a área de transferência com feedback tátil.
 */
function fCopyCaption(canvasId) {
  const container = document.querySelector(`.caption-assistant-panel[data-canvas-id="${canvasId}"]`);
  if (!container) return;
  
  const activeTabId = container.dataset.activeTab || 'promo';
  const caps = _fArtCaptions[canvasId];
  if (!caps) return;
  
  const selected = caps.find(c => c.id === activeTabId);
  if (!selected) return;
  
  const textToCopy = selected.text;
  
  const success = () => {
    const copyBtn = container.querySelector('.caption-copy-btn');
    if (copyBtn) {
      const originalHTML = copyBtn.innerHTML;
      copyBtn.classList.add('copied');
      copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:2px"><polyline points="20 6 9 17 4 12"/></svg> Copiado!`;
      
      gToast('Legenda copiada com sucesso!');
      
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyBtn.innerHTML = originalHTML;
      }, 1500);
    }
  };
  
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(textToCopy)
      .then(success)
      .catch(err => {
        console.warn('Clipboard API falhou, usando fallback...', err);
        fCopyFallback(textToCopy, success);
      });
  } else {
    fCopyFallback(textToCopy, success);
  }
}

function fCopyFallback(text, cb) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    cb();
  } catch (e) {
    console.error('Erro ao copiar no fallback:', e);
    gToast('Não consegui copiar o texto automaticamente.', 'error');
  }
  document.body.removeChild(ta);
}

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
    if(typeof gTrackEvent==='function') gTrackEvent('arte_gerada',{camp_id:c.id,camp_name:c.name,fmt:fState.fmt.id,material_id:fState.material?.id||null});
    const msgs=document.getElementById('f-messages');
    const w=document.createElement('div');w.className='msg bot';
    // ID único pro canvas thumbnail
    const previewCanvasId = 'art-preview-'+Date.now();
    // Congela os dados desta arte pra os botões da bolha não usarem o estado futuro.
    // Inclui o MATERIAL: fRenderCanvasHelper lê fState.material — sem congelar, baixar
    // de uma bolha antiga após trocar de material renderizava o template errado.
    _fArtSnapshots[previewCanvasId] = {dados:{...d}, camp:c, fmt:fState.fmt, histId:fState._lastHistId, material:fState.material};
    
    // Gera as legendas da arte
    const suggestions = await fFetchAICaptionSuggestions(d, c, fState.fmt);
    _fArtCaptions[previewCanvasId] = suggestions;

    const captionHtml = `<div class="caption-assistant-panel" data-canvas-id="${previewCanvasId}" data-active-tab="promo">
      <div class="caption-assistant-title">Legenda do Post ✍️</div>
      <div class="caption-tabs">
        ${suggestions.map((s, idx) => `
          <button class="caption-tab-btn ${idx === 0 ? 'active' : ''}" onclick="fSwitchCaptionTab(this, '${s.id}', '${previewCanvasId}')">
            ${s.label}
          </button>
        `).join('')}
      </div>
      <div class="caption-content-box-wrap">
        <div class="caption-content-box" id="caption-content-${previewCanvasId}">
          ${gEsc(suggestions[0].text).replace(/\n/g, '<br>')}
        </div>
        <button class="caption-copy-btn" onclick="fCopyCaption('${previewCanvasId}')" title="Copiar legenda">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:2px">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copiar
        </button>
      </div>
    </div>`;

    // Se há material publicado, renderiza preview real via canvas; senão, fallback HTML
    const hasMaterial = fState.material && fState.material.layers && fState.material.layers.length;
    let canvasBlock = '';
    if(hasMaterial){
      // Aspecto NATIVO do material (1:1 do PSD) — o thumbnail usa a mesma geometria do
      // download. O canvas VISÍVEL fica pequeno (display size); o render nativo acontece
      // num offscreen reduzido depois (evita guardar um backing nativo gigante por bolha).
      const [mw, mh] = (typeof fMaterialSize==='function') ? fMaterialSize(fState.material, fState.fmt) : [1080,1920];
      const previewH = 280;
      const previewW = Math.round(previewH * (mw/mh));
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
        <div class="art-tag">${gEsc(c.name.toUpperCase())} · ${gEsc(fState.fmt.name.toUpperCase())}</div>
        <div class="art-prod">${gEsc(prod.toUpperCase())}</div>
        ${de?`<div class="art-de">${gEsc(de)}</div>`:''}
        <div class="art-por">${gEsc(por)}</div>
        ${val?`<div class="art-logo" style="font-size:7px;opacity:.5">${gEsc(val)}</div>`:''}
        <div class="art-brand-logo" role="img" aria-label="Luma"></div>
      </div>`;
    }
    w.innerHTML=`<div class="av"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#fff"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><line x1="8" y1="16" x2="8.01" y2="16" /><line x1="16" y1="16" x2="16.01" y2="16" /></svg></div><div>
      <div class="bbl" style="padding-bottom:6px;display:inline-flex;align-items:center;gap:4px">Arte gerada! <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="color:#22c55e"><polyline points="20 6 9 17 4 12"/></svg></div>
      <div class="art-wrap">
        ${canvasBlock}
        <div class="multi-fmt-row">
          ${FMTS.map(f=>`<div class="fmt-mini ${f.id===fState.fmt.id?'current':''}" onclick="fOutroFormato('${f.id}','${previewCanvasId}')">
            <div class="fmt-mini-thumb" style="background:${c.color}">${f.name.toUpperCase()}</div>
            <div class="fmt-mini-label" style="display:flex;align-items:center;justify-content:center;gap:3px">${f.name}${f.id===fState.fmt.id?' <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>':''}</div>
          </div>`).join('')}
        </div>
        ${captionHtml}
        <div class="art-footer" style="display:flex;gap:6px;">
          <div class="art-btn" onclick="fRefazer()" style="flex:1;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>Refazer</div>
          <div class="art-btn pri" onclick="fBaixar(this,'${previewCanvasId}')" style="flex:1.2;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>Baixar PNG</div>
          <div class="art-btn pri" onclick="fBaixarPDF(this,'${previewCanvasId}')" style="flex:1.2; background:var(--dm-red); border-color:var(--dm-red); box-shadow:0 2px 8px rgba(200,24,24,.35);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>Baixar PDF</div>
        </div>
      </div>
    </div>`;
    msgs.appendChild(w);msgs.scrollTop=msgs.scrollHeight;
    // Renderiza canvas thumbnail real
    if(hasMaterial){
      try {
        const cv = document.getElementById(previewCanvasId);
        if(cv){
          const [mw, mh] = (typeof fMaterialSize==='function') ? fMaterialSize(fState.material, fState.fmt) : [1080,1920];
          // Render no tamanho NATIVO num offscreen (mesma geometria do download) e desenha
          // reduzido no canvas visível — não guarda um backing nativo por bolha de resultado.
          const off = document.createElement('canvas'); off.width=mw; off.height=mh;
          const octx = off.getContext('2d');
          await fRenderTemplateLayers(octx, fState.material.layers, mw, mh, d, c);
          await fDrawDMLogo(octx, mw, mh);
          const ctx = cv.getContext('2d');
          ctx.clearRect(0,0,cv.width,cv.height);
          ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
          ctx.drawImage(off, 0,0,mw,mh, 0,0,cv.width,cv.height);
        }
      } catch(e){ console.warn('Erro ao renderizar preview:', e); }
    }
    try { fUpdateLivePreview(); } catch(e){}
    setTimeout(()=>fAddBot('Arte salva em <strong>Minhas artes</strong>! Clique em outro formato para gerar variações.',[]),500);
  },800);
}
async function fOutroFormato(id, snapId){
  const f=FMTS.find(x=>x.id===id);if(!f)return;
  const snap=(snapId&&_fArtSnapshots[snapId])||{dados:fState.dados,camp:fState.camp,fmt:fState.fmt,material:fState.material};
  // Guarda por BOLHA: compara com o formato desta arte, não com o global (outra bolha pode ter outro fmt)
  if(snap.fmt && f.id===snap.fmt.id) return;
  fState.fmt=f;fRenderFmts();fUpdateCtx();

  // Atualiza as sugestões de legenda para o novo formato
  const suggestions = await fFetchAICaptionSuggestions(snap.dados, snap.camp, f);
  _fArtCaptions[snapId] = suggestions;

  // Atualiza a UI se o card correspondente estiver no DOM
  const panel = document.querySelector(`.caption-assistant-panel[data-canvas-id="${snapId}"]`);
  if (panel) {
    const activeTabId = panel.dataset.activeTab || 'promo';
    
    // Atualiza os botões de abas
    const tabsContainer = panel.querySelector('.caption-tabs');
    if (tabsContainer) {
      tabsContainer.innerHTML = suggestions.map((s) => `
        <button class="caption-tab-btn ${s.id === activeTabId ? 'active' : ''}" onclick="fSwitchCaptionTab(this, '${s.id}', '${snapId}')">
          ${s.label}
        </button>
      `).join('');
    }
    
    // Atualiza a caixa de texto
    const box = document.getElementById('caption-content-' + snapId);
    if (box) {
      const selected = suggestions.find(s => s.id === activeTabId) || suggestions[0];
      box.innerHTML = gEsc(selected.text).replace(/\n/g, '<br>');
    }

    // Atualiza a fileira de formatos secundários (.fmt-mini) no card correspondente
    const card = panel.closest('.art-wrap');
    if (card) {
      const miniRows = card.querySelectorAll('.fmt-mini');
      miniRows.forEach(item => {
        if (item.getAttribute('onclick')?.includes(`'${id}'`)) {
          item.classList.add('current');
          const label = item.querySelector('.fmt-mini-label');
          if (label && !label.innerHTML.includes('svg')) {
            label.innerHTML = `${f.name} <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
          }
        } else {
          item.classList.remove('current');
          const label = item.querySelector('.fmt-mini-label');
          if (label) {
            label.innerHTML = label.textContent.trim();
          }
        }
      });
    }
  }

  // Gera com o MATERIAL da bolha (fRenderCanvasHelper lê fState.material) e só registra
  // como "baixada" se o PNG saiu de fato. Falha antes era rejeição async silenciosa.
  const prevMat=fState.material;
  if(snap.material) fState.material=snap.material;
  try{
    await fGenPNG(snap.dados,snap.camp,f);
    fAddHist(snap.dados,snap.camp,f,'baixada');
    if(typeof gTrackEvent==='function') gTrackEvent('arte_baixada',{camp_id:snap.camp.id,fmt:f.id,tipo:'png',outro_formato:true});
    snap.fmt=f; // a bolha agora "é" deste formato — o Baixar PNG dela acompanha
    gToast(`${f.name} baixado!`);
    await _fRerenderArtThumb(snapId, snap, f); // thumb acompanha a nova geometria
  }catch(e){
    console.warn('Falha ao gerar no formato '+f.name+':', e);
    gToast('Não consegui gerar nesse formato. Tente de novo.','error');
  }finally{
    fState.material=prevMat;
  }
}
// Re-renderiza o thumbnail de uma bolha de arte na geometria do formato dado —
// sem isso, trocar o formato atualizava o download mas o thumb ficava na proporção velha.
async function _fRerenderArtThumb(canvasId, snap, f){
  const cv=canvasId?document.getElementById(canvasId):null; if(!cv) return;
  const mat=snap.material||fState.material;
  if(!(mat&&mat.layers&&mat.layers.length)) return; // bolha fallback (sem material) não usa canvas
  const [mw,mh]=(typeof fMaterialSize==='function')?fMaterialSize(mat,f):[1080,1920];
  const previewH=280, previewW=Math.round(previewH*(mw/mh));
  const wrap=cv.closest('.art-canvas-real');
  if(wrap){ wrap.style.width=previewW+'px'; wrap.style.height=previewH+'px'; }
  cv.width=previewW; cv.height=previewH;
  const off=document.createElement('canvas'); off.width=mw; off.height=mh;
  const octx=off.getContext('2d');
  const prevMat=fState.material; fState.material=mat; // motor lê fState.material (bg + espaço nativo)
  try{
    await fRenderTemplateLayers(octx, mat.layers, mw, mh, snap.dados, snap.camp);
    const ctx=cv.getContext('2d');
    ctx.clearRect(0,0,cv.width,cv.height);
    ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
    ctx.drawImage(off, 0,0,mw,mh, 0,0,cv.width,cv.height);
  }catch(e){ console.warn('Thumb re-render falhou:', e); }
  finally{ fState.material=prevMat; }
}
async function fBaixar(btn, snapId){
  // Usa o snapshot da própria bolha (não o estado atual, que pode ser de outra arte).
  const snap=(snapId&&_fArtSnapshots[snapId])||{dados:fState.dados,camp:fState.camp,fmt:fState.fmt,histId:fState._lastHistId,material:fState.material};
  const restore=gBtnLoading(btn,'Gerando…');
  const prevMat=fState.material;
  if(snap.material) fState.material=snap.material; // gera com o material DESTA arte
  try{
    // Gera primeiro; só marca "baixada" se não lançar (canvas tainted, quota, etc.).
    await fGenPNG(snap.dados,snap.camp,snap.fmt);
    if(snap.histId){ fMarkHistBaixada(snap.histId); }
    else { fAddHist(snap.dados,snap.camp,snap.fmt,'baixada'); }
    if(typeof gTrackEvent==='function') gTrackEvent('arte_baixada',{camp_id:snap.camp.id,fmt:snap.fmt.id,tipo:'png'});
    gToast('Arte baixada!');
  }catch(e){
    console.warn('Falha ao gerar PNG:', e);
    gToast('Não consegui gerar o arquivo. Tente enviar a foto de novo pelo botão de upload, ou escolha outra imagem.','error');
  }finally{ fState.material=prevMat; restore(); }
}
function fRefazer(){fState.stepIdx=-1;fState.dados={};fState.done=false;fClearImgCache();_fArtSnapshots={};_fArtCaptions={};const msgs=document.getElementById('f-messages');if(msgs)msgs.innerHTML='';fUpdateProg();fAddBot(`Vamos refazer a arte da <strong>${gEsc(fState.camp.name)}</strong>.`,[]);clearTimeout(fNextTimeout);fNextTimeout=setTimeout(()=>fNextStep(),500);}
// Mobile: volta do chat para o catálogo (desfaz o colapso de colunas).
function fMobileBackToCatalog(){
  try{ document.body.classList.remove('f-mobile-chat'); }catch(e){}
}
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
  _fArtSnapshots={};_fArtCaptions={}; // evita acúmulo de snapshots/legendas de artes antigas
  document.getElementById('f-messages').innerHTML='';fUpdateProg();fStartChat();
}
function fCancelReset(){
  const m=document.getElementById('reset-confirm-msg');if(m)m.remove();
}

function fAddBot(html,qrs,canGoBack){
  const msgs=document.getElementById('f-messages');
  if(!msgs) return;
  const w=document.createElement('div');w.className='msg bot';
  let q='';
  if(qrs&&qrs.length){
    q=`<div class="qr-wrap">${qrs.map(x=>{
      const isColor = /^#[0-9A-F]{6}$/i.test(x.trim());
      if(isColor) {
        return `<div class="qr qr-color" data-qr="${gEsc(x)}" onclick="fQR(this.dataset.qr,this)" style="background:${gEsc(x)} !important; color:${fGetContrastColor(x)} !important; border-color:${gEsc(x)} !important; font-family:monospace; display:inline-flex; align-items:center; gap:6px;"><span style="width:10px; height:10px; border-radius:50%; background:#fff; border:1px solid rgba(0,0,0,0.25); display:inline-block;"></span>${gEsc(x)}</div>`;
      }
      return `<div class="qr" data-qr="${gEsc(x)}" onclick="fQR(this.dataset.qr,this)">${gEsc(x)}</div>`;
    }).join('')}</div>`;
  }
  // F-07: botão Voltar quando habilitado
  let back = '';
  if(canGoBack){
    back = `<div class="qr-back-wrap"><button class="qr-back" onclick="fGoBack()" title="Voltar uma pergunta"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>Voltar uma pergunta</button></div>`;
  }
  w.innerHTML=`<div class="av"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#fff"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><line x1="8" y1="16" x2="8.01" y2="16" /><line x1="16" y1="16" x2="16.01" y2="16" /></svg></div><div><div class="bbl">${html}</div>${q}${back}</div>`;
  msgs.appendChild(w);msgs.scrollTop=msgs.scrollHeight;
}

function fGetContrastColor(hex) {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#000000' : '#ffffff';
}

async function fBaixarPDF(btn, snapId){
  const snap=(snapId&&_fArtSnapshots[snapId])||{dados:fState.dados,camp:fState.camp,fmt:fState.fmt,histId:fState._lastHistId,material:fState.material};
  const restore=gBtnLoading(btn,'Gerando…');
  const prevMat=fState.material;
  if(snap.material) fState.material=snap.material; // gera com o material DESTA arte
  try{
    await fGenPDF(snap.dados, snap.camp, snap.fmt);
    if(snap.histId){ fMarkHistBaixada(snap.histId); }
    else { fAddHist(snap.dados,snap.camp,snap.fmt,'baixada'); }
    if(typeof gTrackEvent==='function') gTrackEvent('arte_baixada',{camp_id:snap.camp.id,fmt:snap.fmt.id,tipo:'pdf'});
    gToast('PDF baixado!');
  }catch(e){
    console.error('Falha ao gerar PDF:', e);
    gToast('Não consegui gerar o PDF. Se a arte usa imagem por URL, ela precisa ser pública.','error');
  }finally{ fState.material=prevMat; restore(); }
}
// Iniciais reais do usuário logado (nome/loja) — em vez do "FR" fixo (cheiro de protótipo).
function _fUserInitials(){
  try{
    // displayName vive em gAuthState.user (auth.js) — o caminho antigo (gAuthState.displayName)
    // era sempre undefined e o avatar caía no genérico "EU".
    const n=(typeof gAuthState!=='undefined'&&gAuthState&&gAuthState.user&&gAuthState.user.displayName)||(fState&&fState.loja)||'';
    const parts=String(n).trim().split(/\s+/).filter(Boolean);
    if(!parts.length) return 'EU';
    if(parts.length===1) return parts[0].slice(0,2).toUpperCase();
    return (parts[0][0]+parts[parts.length-1][0]).toUpperCase();
  }catch(e){ return 'EU'; }
}
function fAddUser(txt){
  const msgs=document.getElementById('f-messages');
  if(!msgs) return;
  const w=document.createElement('div');w.className='msg user';
  w.innerHTML=`<div><div class="bbl">${gEsc(txt)}</div></div><div class="av u">${_fUserInitials()}</div>`;
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

